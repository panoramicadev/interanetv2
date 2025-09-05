import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import multer from "multer";
import Papa from "papaparse";

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

import { insertSalesTransactionSchema, insertGoalSchema, insertSalespersonUserSchema, insertProductSchema, insertProductStockSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', async (req: any, res) => {
    try {
      // Check if there's a simulated user in session
      if (req.session?.simulatedUser) {
        const user = await storage.getSalespersonUser(req.session.simulatedUser);
        if (user) {
          return res.json(user);
        }
      }

      // Check for authenticated Replit user
      if (req.isAuthenticated && req.isAuthenticated()) {
        const userId = req.user?.claims?.sub;
        if (userId) {
          const user = await storage.getUser(userId);
          if (user) {
            return res.json(user);
          }
        }
      }
      
      // No user found - return null instead of 401 to allow login page to show
      res.json(null);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Simulate login for testing
  app.post('/api/auth/simulate-login', async (req, res) => {
    try {
      const { userId } = req.body;
      if (!userId) {
        return res.status(400).json({ message: "User ID is required" });
      }

      const user = await storage.getSalespersonUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Store user ID in session
      req.session.simulatedUser = userId;
      res.json({ message: "Login successful", user });
    } catch (error) {
      console.error("Error in simulate login:", error);
      res.status(500).json({ message: "Failed to simulate login" });
    }
  });

  // Logout
  app.post('/api/auth/logout', async (req, res) => {
    try {
      // Clear simulated user from session
      if (req.session) {
        req.session.simulatedUser = null;
      }
      res.json({ message: "Logout successful" });
    } catch (error) {
      console.error("Error in logout:", error);
      res.status(500).json({ message: "Failed to logout" });
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

  // Vendedor-specific metrics endpoint
  app.get('/api/sales/metrics/salesperson/:salespersonName', isAuthenticated, async (req, res) => {
    try {
      const { salespersonName } = req.params;
      const { startDate, endDate, period, filterType } = req.query;
      const dateRange = getDateRange(period as string, filterType as string);
      
      const metrics = await storage.getSalesMetrics({
        startDate: (startDate as string) || dateRange.startDate,
        endDate: (endDate as string) || dateRange.endDate,
        salesperson: salespersonName,
      });
      res.json(metrics);
    } catch (error) {
      console.error("Error fetching salesperson metrics:", error);
      res.status(500).json({ message: "Failed to fetch salesperson metrics" });
    }
  });

  // Vendedor-specific clients endpoint  
  app.get('/api/sales/clients/salesperson/:salespersonName', isAuthenticated, async (req, res) => {
    try {
      const { salespersonName } = req.params;
      const { startDate, endDate, period, filterType } = req.query;
      const dateRange = getDateRange(period as string, filterType as string);
      
      const clients = await storage.getTopClients(10, 
        (startDate as string) || dateRange.startDate,
        (endDate as string) || dateRange.endDate,
        salespersonName
      );
      res.json(clients);
    } catch (error) {
      console.error("Error fetching salesperson clients:", error);
      res.status(500).json({ message: "Failed to fetch salesperson clients" });
    }
  });

  // Vendedor-specific sales chart data
  app.get('/api/sales/chart-data/salesperson/:salespersonName', isAuthenticated, async (req, res) => {
    try {
      const { salespersonName } = req.params;
      const { period = 'monthly', selectedPeriod, filterType } = req.query;
      const chartData = await storage.getSalesChartData(period as 'weekly' | 'monthly' | 'daily', undefined, undefined, salespersonName);
      res.json(chartData);
    } catch (error) {
      console.error("Error fetching salesperson chart data:", error);
      res.status(500).json({ message: "Failed to fetch salesperson chart data" });
    }
  });

  // Vendedor-specific goals
  app.get('/api/goals/salesperson/:salespersonName', isAuthenticated, async (req, res) => {
    try {
      const { salespersonName } = req.params;
      const goals = await storage.getGoalsBySalesperson(salespersonName);
      res.json(goals);
    } catch (error) {
      console.error("Error fetching salesperson goals:", error);
      res.status(500).json({ message: "Failed to fetch salesperson goals" });
    }
  });

  // Vendedor-specific alerts
  app.get('/api/alerts/salesperson/:salespersonName', isAuthenticated, async (req, res) => {
    try {
      const { salespersonName } = req.params;
      const alerts = await storage.getSalespersonAlerts(salespersonName);
      res.json(alerts);
    } catch (error) {
      console.error("Error fetching salesperson alerts:", error);
      res.status(500).json({ message: "Failed to fetch salesperson alerts" });
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

  // Client buyer dashboard endpoints
  app.get("/api/sales/client/:clientName/last-order", async (req, res) => {
    try {
      const { clientName } = req.params;
      const lastOrder = await storage.getClientLastOrder(clientName);
      res.json(lastOrder);
    } catch (error) {
      console.error("Error fetching client last order:", error);
      res.status(500).json({ message: "Failed to fetch client last order" });
    }
  });

  app.get("/api/sales/client/:clientName/purchase-history", async (req, res) => {
    try {
      const { clientName } = req.params;
      const { limit = "10" } = req.query;
      const purchaseHistory = await storage.getClientPurchaseHistory(clientName, parseInt(limit as string));
      res.json(purchaseHistory);
    } catch (error) {
      console.error("Error fetching client purchase history:", error);
      res.status(500).json({ message: "Failed to fetch client purchase history" });
    }
  });

  // Análisis categorizado de clientes para vendedores
  app.get("/api/sales/salesperson/:salespersonName/clients-analysis", isAuthenticated, async (req, res) => {
    try {
      const { salespersonName } = req.params;
      
      const analysis = await storage.getSalespersonClientsAnalysis(salespersonName);
      res.json(analysis);
    } catch (error) {
      console.error("Error fetching salesperson clients analysis:", error);
      res.status(500).json({ message: "Failed to fetch salesperson clients analysis" });
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

  app.get('/api/goals/data/clients', isAuthenticated, async (req, res) => {
    try {
      const clients = await storage.getUniqueClients();
      res.json(clients);
    } catch (error) {
      console.error("Error fetching clients:", error);
      res.status(500).json({ message: "Failed to fetch clients" });
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
  app.get('/api/users/salespeople', async (req, res) => {
    try {
      const users = await storage.getSalespeopleUsers();
      res.json(users);
    } catch (error) {
      console.error("Error fetching salesperson users:", error);
      res.status(500).json({ message: "Failed to fetch salesperson users" });
    }
  });

  app.post('/api/users/salespeople', async (req, res) => {
    console.log("🚀 POST /api/users/salespeople iniciado");
    console.log("📦 Body recibido:", req.body);
    try {
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

  app.put('/api/users/salespeople/:id', async (req: any, res) => {
    try {
      // Solo admin puede actualizar usuarios
      console.log('[DEBUG] Update user - Full req.session:', req.session);
      console.log('[DEBUG] Update user - req.session.simulatedUser:', req.session?.simulatedUser);
      console.log('[DEBUG] Update user - req.user:', req.user);
      
      let userId;
      let userRecord;

      // Verificar si hay una sesión simulada
      if (req.session?.simulatedUser) {
        console.log('[DEBUG] Using simulated user');
        userId = req.session.simulatedUser;
        userRecord = await storage.getSalespersonUser(userId);
      } else if (req.user?.claims?.sub) {
        console.log('[DEBUG] Using authenticated user');
        userId = req.user.claims.sub;
        userRecord = await storage.getUser(userId);
      } else {
        console.log('[DEBUG] No authentication found');
        return res.status(401).json({ message: 'Usuario no autenticado' });
      }
      
      console.log('[DEBUG] userRecord:', userRecord);
      console.log('[DEBUG] userRecord.role:', userRecord?.role);
      
      if (userRecord?.role !== 'admin') {
        console.log('[DEBUG] Access denied - role is not admin');
        return res.status(403).json({ message: 'Acceso denegado. Solo administradores pueden actualizar usuarios.' });
      }
      
      console.log('[DEBUG] Access granted - user is admin');

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

  app.delete('/api/users/salespeople/:id', async (req: any, res) => {
    try {
      // Solo admin puede eliminar usuarios
      let userId;
      let userRecord;

      // Verificar si hay una sesión simulada
      if (req.session?.simulatedUser) {
        userId = req.session.simulatedUser;
        userRecord = await storage.getSalespersonUser(userId);
      } else if (req.user?.claims?.sub) {
        userId = req.user.claims.sub;
        userRecord = await storage.getUser(userId);
      } else {
        return res.status(401).json({ message: 'Usuario no autenticado' });
      }
      
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

  app.get('/api/users/salespeople/supervisors', async (req: any, res) => {
    try {
      // Solo admin puede acceder a esta ruta
      let userId;
      let userRecord;

      // Verificar si hay una sesión simulada
      if (req.session?.simulatedUser) {
        userId = req.session.simulatedUser;
        userRecord = await storage.getSalespersonUser(userId);
      } else if (req.user?.claims?.sub) {
        userId = req.user.claims.sub;
        userRecord = await storage.getUser(userId);
      } else {
        return res.status(401).json({ message: 'Usuario no autenticado' });
      }
      
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

  // Rutas específicas para supervisores
  app.get('/api/supervisor/:supervisorId/salespeople', async (req: any, res) => {
    try {
      const { supervisorId } = req.params;
      console.log(`[DEBUG] Fetching salespeople for supervisor ID: ${supervisorId}`);
      
      const salespeople = await storage.getSalespeopleUnderSupervisor(supervisorId);
      console.log(`[DEBUG] Found ${salespeople.length} salespeople:`, salespeople.map(sp => sp.salespersonName));
      console.log(`[DEBUG] Complete response being sent:`, JSON.stringify(salespeople, null, 2));
      res.json(salespeople);
    } catch (error) {
      console.error("Error fetching supervisor salespeople:", error);
      res.status(500).json({ message: "Failed to fetch supervisor salespeople" });
    }
  });

  app.get('/api/supervisor/:supervisorId/goals', async (req: any, res) => {
    try {
      // Verificar autenticación
      let userId;
      let userRecord;

      if (req.session?.simulatedUser) {
        userId = req.session.simulatedUser;
        userRecord = await storage.getSalespersonUser(userId);
      } else if (req.user?.claims?.sub) {
        userId = req.user.claims.sub;
        userRecord = await storage.getUser(userId);
      } else {
        return res.status(401).json({ message: 'Usuario no autenticado' });
      }

      const { supervisorId } = req.params;
      
      console.log('[DEBUG] Fetching goals for supervisor:', supervisorId);
      const goals = await storage.getSupervisorGoals(supervisorId);
      console.log('[DEBUG] Goals found:', goals);
      res.json(goals);
    } catch (error) {
      console.error("Error fetching supervisor goals:", error);
      res.status(500).json({ message: "Failed to fetch supervisor goals" });
    }
  });

  // Obtener progreso de metas del supervisor (formato compatible con GoalsProgress)
  app.get('/api/supervisor/:supervisorId/goals/progress', async (req: any, res) => {
    try {
      // Para desarrollo, permitir acceso directo sin autenticación estricta
      // En producción, estas verificaciones deberían ser más estrictas

      const { supervisorId } = req.params;
      
      console.log('[DEBUG] Fetching goals progress for supervisor:', supervisorId);
      const supervisorGoals = await storage.getSupervisorGoals(supervisorId);
      
      // Convertir al formato GoalProgress para compatibilidad con el componente
      const progressData = supervisorGoals.map((goal: any) => ({
        id: goal.id,
        type: goal.type,
        target: goal.target,
        amount: goal.amount || goal.targetAmount?.toString(),
        period: goal.period,
        description: goal.description,
        currentSales: goal.currentSales || 0,
        targetAmount: goal.targetAmount || parseInt(goal.amount),
        percentage: goal.progress || 0,
        remaining: goal.remaining || (goal.targetAmount - goal.currentSales),
        isCompleted: (goal.progress || 0) >= 100
      }));

      console.log('[DEBUG] Progress data for supervisor:', progressData);
      res.json(progressData);
    } catch (error) {
      console.error("Error fetching supervisor goals progress:", error);
      res.status(500).json({ message: "Failed to fetch supervisor goals progress" });
    }
  });

  app.get('/api/supervisor/:supervisorId/alerts', async (req: any, res) => {
    try {
      const { supervisorId } = req.params;
      
      const alerts = await storage.getSupervisorAlerts(supervisorId);
      res.json(alerts);
    } catch (error) {
      console.error("Error fetching supervisor alerts:", error);
      res.status(500).json({ message: "Failed to fetch supervisor alerts" });
    }
  });

  // Crear meta para vendedor
  app.post('/api/supervisor/:supervisorId/goals', async (req: any, res) => {
    try {
      // Verificar autenticación
      let userId;
      let userRecord;

      if (req.session?.simulatedUser) {
        userId = req.session.simulatedUser;
        userRecord = await storage.getSalespersonUser(userId);
      } else if (req.user?.claims?.sub) {
        userId = req.user.claims.sub;
        userRecord = await storage.getUser(userId);
      } else {
        return res.status(401).json({ message: 'Usuario no autenticado' });
      }

      const { supervisorId } = req.params;
      
      // Verificar que el usuario logueado es el supervisor
      if (userRecord?.id !== supervisorId || userRecord?.role !== 'supervisor') {
        return res.status(403).json({ message: 'Solo el supervisor puede crear metas para sus vendedores' });
      }

      const { salespersonId, salespersonName, description, amount, period } = req.body;
      
      // Verificar que el vendedor está bajo la supervisión de este supervisor
      const salesperson = await storage.getSalespersonUser(salespersonId);
      if (!salesperson || salesperson.supervisorId !== supervisorId) {
        return res.status(403).json({ message: 'El vendedor no está bajo tu supervisión' });
      }

      // Crear la meta
      const goal = await storage.createGoal({
        type: 'salesperson',
        target: salespersonName,
        amount: amount.toString(),
        period,
        description
      });

      console.log('[DEBUG] Created goal:', goal);
      res.json(goal);
    } catch (error) {
      console.error("Error creating goal:", error);
      res.status(500).json({ message: "Failed to create goal" });
    }
  });

  // Editar meta existente
  app.put('/api/supervisor/:supervisorId/goals/:goalId', async (req: any, res) => {
    try {
      // Verificar autenticación
      let userId;
      let userRecord;

      if (req.session?.simulatedUser) {
        userId = req.session.simulatedUser;
        userRecord = await storage.getSalespersonUser(userId);
      } else if (req.user?.claims?.sub) {
        userId = req.user.claims.sub;
        userRecord = await storage.getUser(userId);
      } else {
        return res.status(401).json({ message: 'Usuario no autenticado' });
      }

      const { supervisorId, goalId } = req.params;
      
      // Verificar que el usuario logueado es el supervisor
      if (userRecord?.id !== supervisorId || userRecord?.role !== 'supervisor') {
        return res.status(403).json({ message: 'Solo el supervisor puede editar metas de sus vendedores' });
      }

      // Obtener la meta existente
      const existingGoal = await storage.getGoal(goalId);
      if (!existingGoal) {
        return res.status(404).json({ message: 'Meta no encontrada' });
      }

      // Verificar que la meta es de un vendedor bajo su supervisión
      const salesperson = await storage.getSalespersonUserByName(existingGoal.target);
      if (!salesperson || salesperson.supervisorId !== supervisorId) {
        return res.status(403).json({ message: 'No puedes editar metas de vendedores que no están bajo tu supervisión' });
      }

      const { description, amount, period } = req.body;
      
      // Actualizar la meta
      const updatedGoal = await storage.updateGoal(goalId, {
        description,
        amount: amount.toString(),
        period
      });

      console.log('[DEBUG] Updated goal:', updatedGoal);
      res.json(updatedGoal);
    } catch (error) {
      console.error("Error updating goal:", error);
      res.status(500).json({ message: "Failed to update goal" });
    }
  });


  // Configure multer for file uploads
  const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
  });

  // Product routes
  app.get('/api/products', isAuthenticated, async (req: any, res) => {
    try {
      const { search, active, hasPrices, warehouseCode, limit = 50, offset = 0 } = req.query;
      
      const filters = {
        search: search || undefined,
        active: active !== undefined ? active === 'true' : undefined,
        hasPrices: hasPrices !== undefined ? hasPrices === 'true' : undefined,
        warehouseCode: warehouseCode || undefined,
        limit: parseInt(limit),
        offset: parseInt(offset)
      };

      const products = await storage.getProducts(filters);
      res.json(products);
    } catch (error) {
      console.error("Error fetching products:", error);
      res.status(500).json({ message: "Failed to fetch products" });
    }
  });

  app.get('/api/products/:sku', isAuthenticated, async (req: any, res) => {
    try {
      const { sku } = req.params;
      const product = await storage.getProduct(sku);
      
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }

      res.json(product);
    } catch (error) {
      console.error("Error fetching product:", error);
      res.status(500).json({ message: "Failed to fetch product" });
    }
  });

  app.get('/api/products/:sku/stock', isAuthenticated, async (req: any, res) => {
    try {
      const { sku } = req.params;
      const { warehouseCode, branchCode } = req.query;
      
      let stock;
      if (warehouseCode) {
        stock = await storage.getProductStockByWarehouse(sku, warehouseCode, branchCode);
      } else {
        stock = await storage.getProductStock(sku);
      }

      res.json(stock);
    } catch (error) {
      console.error("Error fetching product stock:", error);
      res.status(500).json({ message: "Failed to fetch product stock" });
    }
  });

  app.get('/api/products/:sku/analytics', isAuthenticated, async (req: any, res) => {
    try {
      const { sku } = req.params;
      const analytics = await storage.getProductAnalytics(sku);
      res.json(analytics);
    } catch (error) {
      console.error("Error fetching product analytics:", error);
      res.status(500).json({ message: "Failed to fetch product analytics" });
    }
  });

  app.get('/api/products/:sku/price-history', isAuthenticated, async (req: any, res) => {
    try {
      const { sku } = req.params;
      const history = await storage.getProductPriceHistory(sku);
      res.json(history);
    } catch (error) {
      console.error("Error fetching price history:", error);
      res.status(500).json({ message: "Failed to fetch price history" });
    }
  });

  // Get all warehouses
  app.get('/api/warehouses', isAuthenticated, async (req: any, res) => {
    try {
      const warehouses = await storage.getWarehouses();
      res.json(warehouses);
    } catch (error) {
      console.error("Error fetching warehouses:", error);
      res.status(500).json({ message: "Failed to fetch warehouses" });
    }
  });

  // Get stock summary by warehouse
  app.get('/api/warehouses/stock-summary', isAuthenticated, async (req: any, res) => {
    try {
      const stockSummary = await storage.getStockSummaryByWarehouse();
      res.json(stockSummary);
    } catch (error) {
      console.error("Error fetching warehouse stock summary:", error);
      res.status(500).json({ message: "Failed to fetch warehouse stock summary" });
    }
  });

  // Get detailed stock for a specific warehouse
  app.get('/api/warehouses/:warehouseCode/stock', isAuthenticated, async (req: any, res) => {
    try {
      const { warehouseCode } = req.params;
      const { branchCode } = req.query;
      const stock = await storage.getWarehouseStock(warehouseCode, branchCode as string);
      res.json(stock);
    } catch (error) {
      console.error("Error fetching warehouse stock:", error);
      res.status(500).json({ message: "Failed to fetch warehouse stock" });
    }
  });

  app.put('/api/products/:sku/price', isAuthenticated, async (req: any, res) => {
    try {
      const { sku } = req.params;
      const { price, reason } = req.body;
      
      if (!price || isNaN(price)) {
        return res.status(400).json({ message: "Valid price is required" });
      }

      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const product = await storage.updateProductPrice(sku, parseFloat(price), userId, reason);
      res.json(product);
    } catch (error) {
      console.error("Error updating product price:", error);
      res.status(500).json({ message: "Failed to update product price" });
    }
  });

  // CSV Import endpoint
  app.post('/api/products/import-csv', isAuthenticated, upload.single('csvFile'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No CSV file provided" });
      }

      const csvContent = req.file.buffer.toString('utf-8');
      
      // Parse CSV using Papa Parse
      const parseResult = Papa.parse(csvContent, {
        header: true,
        delimiter: ';', // CSV uses semicolon as delimiter
        skipEmptyLines: true,
        transformHeader: (header: string) => header.trim()
      });

      if (parseResult.errors.length > 0) {
        return res.status(400).json({ 
          message: "CSV parsing errors", 
          errors: parseResult.errors 
        });
      }

      // Transform CSV data to match our schema
      const csvData = parseResult.data.map((row: any) => ({
        sku: row.KOPR?.trim(),
        name: row.NOKOPR?.trim(),
        unit1: row.UD01PR?.trim(),
        unit2: row.UD02PR?.trim(),
        branchCode: row.KOSU?.trim(),
        warehouseCode: row.KOBO?.trim(),
        warehouseLocation: row.DATOSUBIC?.trim(),
        physicalStock1: parseFloat(row.STFI1?.replace(',', '.')) || 0,
        physicalStock2: parseFloat(row.STFI2?.replace(',', '.')) || 0,
        availableStock1: parseFloat(row.STDV1?.replace(',', '.')) || 0,
        availableStock2: parseFloat(row.STDV2?.replace(',', '.')) || 0,
        committedStock1: parseFloat(row.STOCNV1?.replace(',', '.')) || 0,
        committedStock2: parseFloat(row.STOCNV2?.replace(',', '.')) || 0,
        unitRatio: parseFloat(row.RLUD?.replace(',', '.')) || 1,
        fmpr: row.FMPR?.trim(),
        pfpr: row.PFPR?.trim(),
        hfpr: row.HFPR?.trim(),
        rupr: row.RUPR?.trim(),
        mrpr: row.MRPR?.trim()
      })).filter((row: any) => row.sku && row.name); // Filter out empty rows

      const result = await storage.importProductStockFromCSV(csvData);
      
      res.json({
        message: "CSV import completed",
        result
      });
    } catch (error) {
      console.error("Error importing CSV:", error);
      res.status(500).json({ message: "Failed to import CSV", error: error });
    }
  });

  // Warehouse and branch routes
  app.get('/api/warehouses', isAuthenticated, async (req: any, res) => {
    try {
      const warehouses = await storage.getWarehouses();
      res.json(warehouses);
    } catch (error) {
      console.error("Error fetching warehouses:", error);
      res.status(500).json({ message: "Failed to fetch warehouses" });
    }
  });

  app.get('/api/branches', isAuthenticated, async (req: any, res) => {
    try {
      const branches = await storage.getBranches();
      res.json(branches);
    } catch (error) {
      console.error("Error fetching branches:", error);
      res.status(500).json({ message: "Failed to fetch branches" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
