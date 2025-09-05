import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";

// Helper function to convert period and filterType to date range
function getDateRange(period?: string, filterType?: string): { startDate?: string; endDate?: string } {
  if (!period || !filterType) return {};
  
  const now = new Date();
  let startDate: Date | undefined;
  let endDate: Date | undefined;

  switch (filterType) {
    case 'day':
      // period format: "2025-09-05"
      startDate = new Date(period);
      endDate = new Date(period);
      endDate.setDate(endDate.getDate() + 1); // Next day to include full day
      break;
    case 'month':
      // period format: "2025-09" 
      if (period.includes('-')) {
        const [year, month] = period.split('-');
        startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
        endDate = new Date(parseInt(year), parseInt(month), 0);
      }
      break;
    case 'range':
      // Handle predefined ranges
      switch (period) {
        case 'last-7-days':
          endDate = new Date(now);
          startDate = new Date(now);
          startDate.setDate(startDate.getDate() - 7);
          break;
        case 'last-30-days':
          endDate = new Date(now);
          startDate = new Date(now);
          startDate.setDate(startDate.getDate() - 30);
          break;
        case 'last-90-days':
          endDate = new Date(now);
          startDate = new Date(now);
          startDate.setDate(startDate.getDate() - 90);
          break;
        // Add more ranges as needed
      }
      break;
  }

  return {
    startDate: startDate?.toISOString().split('T')[0],
    endDate: endDate?.toISOString().split('T')[0]
  };
}

import { insertSalesTransactionSchema, insertGoalSchema, insertSalespersonUserSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Sales metrics endpoint
  app.get('/api/sales/metrics', isAuthenticated, async (req, res) => {
    try {
      const { startDate, endDate, salesperson, segment, period, filterType } = req.query;
      const dateRange = getDateRange(period as string, filterType as string);
      
      const metrics = await storage.getSalesMetrics({
        startDate: (startDate as string) || dateRange.startDate,
        endDate: (endDate as string) || dateRange.endDate,
        salesperson: salesperson as string,
        segment: segment as string,
      });
      res.json(metrics);
    } catch (error) {
      console.error("Error fetching sales metrics:", error);
      res.status(500).json({ message: "Failed to fetch sales metrics" });
    }
  });

  // Sales transactions endpoint
  app.get('/api/sales/transactions', isAuthenticated, async (req, res) => {
    try {
      const { startDate, endDate, salesperson, segment, limit, offset, period, filterType } = req.query;
      const dateRange = getDateRange(period as string, filterType as string);
      
      const transactions = await storage.getSalesTransactions({
        startDate: (startDate as string) || dateRange.startDate,
        endDate: (endDate as string) || dateRange.endDate,
        salesperson: salesperson as string,
        segment: segment as string,
        limit: limit ? parseInt(limit as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined,
      });
      res.json(transactions);
    } catch (error) {
      console.error("Error fetching sales transactions:", error);
      res.status(500).json({ message: "Failed to fetch sales transactions" });
    }
  });

  // Top salespeople endpoint
  app.get('/api/sales/top-salespeople', isAuthenticated, async (req, res) => {
    try {
      const { limit, period, filterType } = req.query;
      const dateRange = getDateRange(period as string, filterType as string);
      
      const topSalespeople = await storage.getTopSalespeople(
        limit ? parseInt(limit as string) : undefined,
        dateRange.startDate,
        dateRange.endDate
      );
      res.json(topSalespeople);
    } catch (error) {
      console.error("Error fetching top salespeople:", error);
      res.status(500).json({ message: "Failed to fetch top salespeople" });
    }
  });

  // Top products endpoint
  app.get('/api/sales/top-products', isAuthenticated, async (req, res) => {
    try {
      const { limit, period, filterType } = req.query;
      const dateRange = getDateRange(period as string, filterType as string);
      
      const topProducts = await storage.getTopProducts(
        limit ? parseInt(limit as string) : undefined,
        dateRange.startDate,
        dateRange.endDate
      );
      res.json(topProducts);
    } catch (error) {
      console.error("Error fetching top products:", error);
      res.status(500).json({ message: "Failed to fetch top products" });
    }
  });

  // Top clients endpoint
  app.get('/api/sales/top-clients', isAuthenticated, async (req, res) => {
    try {
      const { limit, period, filterType } = req.query;
      const dateRange = getDateRange(period as string, filterType as string);
      
      const topClients = await storage.getTopClients(
        limit ? parseInt(limit as string) : undefined,
        dateRange.startDate,
        dateRange.endDate
      );
      res.json(topClients);
    } catch (error) {
      console.error("Error fetching top clients:", error);
      res.status(500).json({ message: "Failed to fetch top clients" });
    }
  });

  // Segment analysis endpoint
  app.get('/api/sales/segments', isAuthenticated, async (req, res) => {
    try {
      const { period, filterType } = req.query;
      const dateRange = getDateRange(period as string, filterType as string);
      
      const segmentAnalysis = await storage.getSegmentAnalysis(
        dateRange.startDate,
        dateRange.endDate
      );
      res.json(segmentAnalysis);
    } catch (error) {
      console.error("Error fetching segment analysis:", error);
      res.status(500).json({ message: "Failed to fetch segment analysis" });
    }
  });

  // Sales chart data endpoint
  app.get('/api/sales/chart-data', isAuthenticated, async (req, res) => {
    try {
      const { period = 'monthly', selectedPeriod, filterType } = req.query;
      
      // Si tenemos selectedPeriod y filterType, usamos esos para el filtro de fecha
      const dateRange = selectedPeriod && filterType 
        ? getDateRange(selectedPeriod as string, filterType as string)
        : { startDate: undefined, endDate: undefined };
      
      const chartData = await storage.getSalesChartData(
        period as 'weekly' | 'monthly' | 'daily',
        dateRange.startDate,
        dateRange.endDate
      );
      res.json(chartData);
    } catch (error) {
      console.error("Error fetching chart data:", error);
      res.status(500).json({ message: "Failed to fetch chart data" });
    }
  });

  // Segment detail route - clients by segment
  app.get("/api/sales/segment/:segmentName/clients", isAuthenticated, async (req, res) => {
    try {
      const { segmentName } = req.params;
      const { period, filterType = "month" } = req.query;
      
      const clients = await storage.getSegmentClients(segmentName, period as string, filterType as string);
      res.json(clients);
    } catch (error) {
      console.error("Error fetching segment clients:", error);
      res.status(500).json({ message: "Failed to fetch segment clients" });
    }
  });

  // Segment detail route - salespeople by segment
  app.get("/api/sales/segment/:segmentName/salespeople", isAuthenticated, async (req, res) => {
    try {
      const { segmentName } = req.params;
      const { period, filterType = "month" } = req.query;
      
      const salespeople = await storage.getSegmentSalespeople(segmentName, period as string, filterType as string);
      res.json(salespeople);
    } catch (error) {
      console.error("Error fetching segment salespeople:", error);
      res.status(500).json({ message: "Failed to fetch segment salespeople" });
    }
  });

  // Salesperson detail routes
  app.get("/api/sales/salesperson/:salespersonName/details", isAuthenticated, async (req, res) => {
    try {
      const { salespersonName } = req.params;
      const { period, filterType = "month" } = req.query;
      
      const details = await storage.getSalespersonDetails(salespersonName, period as string, filterType as string);
      res.json(details);
    } catch (error) {
      console.error("Error fetching salesperson details:", error);
      res.status(500).json({ message: "Failed to fetch salesperson details" });
    }
  });

  app.get("/api/sales/salesperson/:salespersonName/clients", isAuthenticated, async (req, res) => {
    try {
      const { salespersonName } = req.params;
      const { period, filterType = "month" } = req.query;
      
      const clients = await storage.getSalespersonClients(salespersonName, period as string, filterType as string);
      res.json(clients);
    } catch (error) {
      console.error("Error fetching salesperson clients:", error);
      res.status(500).json({ message: "Failed to fetch salesperson clients" });
    }
  });

  // Client detail routes
  app.get("/api/sales/client/:clientName/details", isAuthenticated, async (req, res) => {
    try {
      const { clientName } = req.params;
      const { period, filterType = "month" } = req.query;
      
      const details = await storage.getClientDetails(clientName, period as string, filterType as string);
      res.json(details);
    } catch (error) {
      console.error("Error fetching client details:", error);
      res.status(500).json({ message: "Failed to fetch client details" });
    }
  });

  app.get("/api/sales/client/:clientName/products", isAuthenticated, async (req, res) => {
    try {
      const { clientName } = req.params;
      const { period, filterType = "month" } = req.query;
      
      const products = await storage.getClientProducts(clientName, period as string, filterType as string);
      res.json(products);
    } catch (error) {
      console.error("Error fetching client products:", error);
      res.status(500).json({ message: "Failed to fetch client products" });
    }
  });

  // CSV import endpoint
  app.post('/api/sales/import', isAuthenticated, async (req, res) => {
    try {
      const { transactions } = req.body;
      
      if (!Array.isArray(transactions)) {
        return res.status(400).json({ message: "Invalid data format" });
      }

      // Validate each transaction
      const validatedTransactions = [];
      const errors = [];
      
      for (let i = 0; i < transactions.length; i++) {
        const transaction = transactions[i];
        
        
        try {
          const validated = insertSalesTransactionSchema.parse(transaction);
          validatedTransactions.push(validated);
        } catch (error: any) {
          errors.push({
            index: i,
            transaction: transaction.nudo || `Row ${i + 1}`,
            error: error.issues ? error.issues.map((issue: any) => `${issue.path.join('.')}: ${issue.message}`).join(', ') : error.message
          });
          console.warn(`Skipping invalid transaction at row ${i + 1}:`, transaction.nudo, error.issues);
        }
      }

      if (validatedTransactions.length === 0) {
        return res.status(400).json({ 
          message: "No valid transactions found",
          errors: errors.slice(0, 5) // Show first 5 errors
        });
      }

      await storage.insertMultipleSalesTransactions(validatedTransactions);
      
      res.json({ 
        message: "Data imported successfully",
        imported: validatedTransactions.length,
        total: transactions.length,
        errors: errors.length > 0 ? errors.slice(0, 5) : undefined
      });
    } catch (error) {
      console.error("Error importing sales data:", error);
      res.status(500).json({ message: "Failed to import sales data" });
    }
  });

  // Goals/Metas endpoints
  app.get('/api/goals', isAuthenticated, async (req, res) => {
    try {
      const { type } = req.query;
      const goals = type 
        ? await storage.getGoalsByType(type as string)
        : await storage.getGoals();
      res.json(goals);
    } catch (error) {
      console.error("Error fetching goals:", error);
      res.status(500).json({ message: "Failed to fetch goals" });
    }
  });

  app.post('/api/goals', isAuthenticated, async (req, res) => {
    try {
      // Validate the request body
      const validatedGoal = insertGoalSchema.parse(req.body);
      
      // Ensure target is null for global goals
      if (validatedGoal.type === 'global') {
        validatedGoal.target = null;
      }
      
      const goal = await storage.createGoal(validatedGoal);
      res.json(goal);
    } catch (error: any) {
      console.error("Error creating goal:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ 
          message: "Invalid data format", 
          details: error.issues.map((issue: any) => `${issue.path.join('.')}: ${issue.message}`).join(', ')
        });
      }
      res.status(500).json({ message: "Failed to create goal" });
    }
  });

  app.put('/api/goals/:id', isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      
      // Validate the request body (allow partial updates)
      const validatedGoal = insertGoalSchema.partial().parse(req.body);
      
      // Ensure target is null for global goals
      if (validatedGoal.type === 'global') {
        validatedGoal.target = null;
      }
      
      const goal = await storage.updateGoal(id, validatedGoal);
      res.json(goal);
    } catch (error: any) {
      console.error("Error updating goal:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ 
          message: "Invalid data format", 
          details: error.issues.map((issue: any) => `${issue.path.join('.')}: ${issue.message}`).join(', ')
        });
      }
      res.status(500).json({ message: "Failed to update goal" });
    }
  });

  app.delete('/api/goals/:id', isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteGoal(id);
      res.json({ message: "Goal deleted successfully" });
    } catch (error) {
      console.error("Error deleting goal:", error);
      res.status(500).json({ message: "Failed to delete goal" });
    }
  });

  // Goals form data endpoints
  app.get('/api/goals/data/segments', isAuthenticated, async (req, res) => {
    try {
      const segments = await storage.getUniqueSegments();
      res.json(segments);
    } catch (error) {
      console.error("Error fetching segments:", error);
      res.status(500).json({ message: "Failed to fetch segments" });
    }
  });

  app.get('/api/goals/data/salespeople', isAuthenticated, async (req, res) => {
    try {
      const salespeople = await storage.getUniqueSalespeople();
      res.json(salespeople);
    } catch (error) {
      console.error("Error fetching salespeople:", error);
      res.status(500).json({ message: "Failed to fetch salespeople" });
    }
  });

  // Goals progress endpoint
  app.get('/api/goals/progress', isAuthenticated, async (req, res) => {
    try {
      const goals = await storage.getGoals();
      const goalsWithProgress = await Promise.all(
        goals.map(async (goal) => {
          let currentSales = 0;
          
          switch (goal.type) {
            case 'global':
              currentSales = await storage.getGlobalSalesForPeriod(goal.period);
              break;
            case 'segment':
              if (goal.target) {
                currentSales = await storage.getSegmentSalesForPeriod(goal.target, goal.period);
              }
              break;
            case 'salesperson':
              if (goal.target) {
                currentSales = await storage.getSalespersonSalesForPeriod(goal.target, goal.period);
              }
              break;
          }

          const targetAmount = parseFloat(goal.amount);
          const percentage = targetAmount > 0 ? (currentSales / targetAmount) * 100 : 0;
          const remaining = Math.max(0, targetAmount - currentSales);

          return {
            ...goal,
            currentSales,
            targetAmount,
            percentage: Math.min(100, percentage),
            remaining,
            isCompleted: percentage >= 100
          };
        })
      );

      res.json(goalsWithProgress);
    } catch (error) {
      console.error("Error fetching goals progress:", error);
      res.status(500).json({ message: "Failed to fetch goals progress" });
    }
  });

  // Salesperson users management endpoints
  app.get('/api/users/salespeople', isAuthenticated, async (req, res) => {
    try {
      // Solo admin puede acceder a esta ruta
      const user = req.user as any;
      const userId = user.claims.sub;
      const userRecord = await storage.getUser(userId);
      
      if (userRecord?.role !== 'admin') {
        return res.status(403).json({ message: 'Acceso denegado. Solo administradores pueden gestionar usuarios.' });
      }

      const users = await storage.getSalespeopleUsers();
      res.json(users);
    } catch (error) {
      console.error("Error fetching salesperson users:", error);
      res.status(500).json({ message: "Failed to fetch salesperson users" });
    }
  });

  app.post('/api/users/salespeople', isAuthenticated, async (req, res) => {
    try {
      // Solo admin puede crear usuarios
      const user = req.user as any;
      const userId = user.claims.sub;
      const userRecord = await storage.getUser(userId);
      
      if (userRecord?.role !== 'admin') {
        return res.status(403).json({ message: 'Acceso denegado. Solo administradores pueden crear usuarios.' });
      }

      const validatedUser = insertSalespersonUserSchema.parse(req.body);
      
      // Hash de la contraseña si se proporciona
      if (validatedUser.password) {
        // En un entorno real, aquí usarías bcrypt para hashear la contraseña
        // Por simplicidad, la guardamos tal como viene (NO recomendado para producción)
        console.warn("ADVERTENCIA: La contraseña no está hasheada. Esto es solo para desarrollo.");
      }

      console.log("Datos validados:", validatedUser);
      const newUser = await storage.createSalespersonUser(validatedUser);
      console.log("Usuario creado exitosamente:", newUser);
      res.json(newUser);
    } catch (error: any) {
      console.error("Error creating salesperson user:", error);
      console.error("Error stack:", error.stack);
      console.error("Error name:", error.name);
      console.error("Error code:", error.code);
      if (error.name === 'ZodError') {
        return res.status(400).json({ 
          message: "Datos inválidos", 
          details: error.issues.map((issue: any) => `${issue.path.join('.')}: ${issue.message}`).join(', ')
        });
      }
      if (error.code === '23505') { // PostgreSQL unique violation
        return res.status(400).json({ 
          message: "Ya existe un usuario con esos datos",
          details: `Conflicto en: ${error.detail || 'campo único'}`
        });
      }
      res.status(500).json({ 
        message: "Failed to create salesperson user",
        error: error.message,
        details: error.stack
      });
    }
  });

  app.put('/api/users/salespeople/:id', isAuthenticated, async (req, res) => {
    try {
      // Solo admin puede actualizar usuarios
      const user = req.user as any;
      const userId = user.claims.sub;
      const userRecord = await storage.getUser(userId);
      
      if (userRecord?.role !== 'admin') {
        return res.status(403).json({ message: 'Acceso denegado. Solo administradores pueden actualizar usuarios.' });
      }

      const { id } = req.params;
      const validatedUser = insertSalespersonUserSchema.partial().parse(req.body);
      
      // Hash de la contraseña si se proporciona
      if (validatedUser.password) {
        console.warn("ADVERTENCIA: La contraseña no está hasheada. Esto es solo para desarrollo.");
      }

      const updatedUser = await storage.updateSalespersonUser(id, validatedUser);
      res.json(updatedUser);
    } catch (error: any) {
      console.error("Error updating salesperson user:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ 
          message: "Datos inválidos", 
          details: error.issues.map((issue: any) => `${issue.path.join('.')}: ${issue.message}`).join(', ')
        });
      }
      res.status(500).json({ message: "Failed to update salesperson user" });
    }
  });

  app.delete('/api/users/salespeople/:id', isAuthenticated, async (req, res) => {
    try {
      // Solo admin puede eliminar usuarios
      const user = req.user as any;
      const userId = user.claims.sub;
      const userRecord = await storage.getUser(userId);
      
      if (userRecord?.role !== 'admin') {
        return res.status(403).json({ message: 'Acceso denegado. Solo administradores pueden eliminar usuarios.' });
      }

      const { id } = req.params;
      await storage.deleteSalespersonUser(id);
      res.json({ message: 'Usuario eliminado correctamente' });
    } catch (error) {
      console.error("Error deleting salesperson user:", error);
      res.status(500).json({ message: "Failed to delete salesperson user" });
    }
  });

  app.get('/api/users/salespeople/supervisors', isAuthenticated, async (req, res) => {
    try {
      // Solo admin puede acceder a esta ruta
      const user = req.user as any;
      const userId = user.claims.sub;
      const userRecord = await storage.getUser(userId);
      
      if (userRecord?.role !== 'admin') {
        return res.status(403).json({ message: 'Acceso denegado. Solo administradores pueden acceder a la gestión de usuarios.' });
      }

      const supervisors = await storage.getSupervisors();
      res.json(supervisors);
    } catch (error) {
      console.error("Error fetching supervisors:", error);
      res.status(500).json({ message: "Failed to fetch supervisors" });
    }
  });


  const httpServer = createServer(app);
  return httpServer;
}
