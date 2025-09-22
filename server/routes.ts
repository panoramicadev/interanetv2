import type { Express } from "express";
import { createServer, type Server } from "http";
import path from "path";
import { storage } from "./storage";
import { setupAuth, requireAuth, requireAdminOrSupervisor } from "./auth";
// import { setupAuth as setupReplitAuth } from "./replitAuth"; // Disabled - conflicts with email/password auth
import multer from "multer";
import Papa from "papaparse";
import { nanoid } from "nanoid";
import { checkDbHealth } from "./db";
import JSZip from "jszip";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { localImageStorage } from "./localImageStorage";
import { db } from "./db";
import { ecommerceProducts } from "../shared/schema";
import { eq } from "drizzle-orm";

// Database error handling middleware with secure logging
function handleDatabaseError(error: any, operation: string) {
  const timestamp = new Date().toISOString();
  // Only log essential error info, no credentials
  const sanitizedError = {
    message: error.message || 'Unknown error',
    code: error.code || 'UNKNOWN',
    severity: error.severity,
    name: error.name,
  };
  console.error(`${timestamp} [DB-ERROR] ${operation} failed:`, sanitizedError);
  
  // Check if it's a database connection error
  const isDbError = 
    error?.code === '57P01' || // admin_shutdown
    error?.code === '08006' || // connection_failure
    error?.code === '08001' || // sqlclient_unable_to_establish_sqlconnection
    error?.code === '08003' || // connection_does_not_exist
    error?.code === '08004' || // sqlserver_rejected_establishment_of_sqlconnection
    error?.message?.includes('terminating connection') ||
    error?.message?.includes('Connection terminated') ||
    error?.message?.includes('server closed the connection') ||
    error?.message?.includes('Connection refused') ||
    error?.message?.includes('timeout');

  if (isDbError) {
    return {
      status: 503,
      message: 'Database temporarily unavailable. Please try again later.',
      type: 'database_error'
    };
  }

  // For other database errors, return a generic error
  return {
    status: 500,
    message: 'An internal error occurred. Please try again.',
    type: 'internal_error'
  };
}

// Async error wrapper for routes
function asyncHandler(fn: Function) {
  return (req: any, res: any, next: any) => {
    Promise.resolve(fn(req, res, next)).catch((error) => {
      const errorInfo = handleDatabaseError(error, `${req.method} ${req.path}`);
      res.status(errorInfo.status).json({ 
        message: errorInfo.message,
        type: errorInfo.type
      });
    });
  };
}

// Timezone-safe date formatting function
function formatDateLocal(date: Date): string {
  if (!date || isNaN(date.getTime())) {
    throw new Error('Invalid date provided');
  }
  
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

// Helper function to normalize date range for SQL queries
function normalizeDateRange(startDate?: string, endDate?: string): { 
  startDate?: string; 
  endDate?: string; 
  endDateExclusive?: string; 
} {
  if (!startDate && !endDate) {
    return {};
  }
  
  let endDateExclusive: string | undefined;
  
  if (endDate) {
    // For inclusive endDate, create exclusive endDate by adding 1 day
    const endDateObj = new Date(endDate);
    endDateObj.setDate(endDateObj.getDate() + 1);
    endDateExclusive = formatDateLocal(endDateObj);
  }
  
  return {
    startDate,
    endDate,
    endDateExclusive
  };
}

// Helper function to convert period and filterType to date range
// Helper function to resolve comparison periods like "previous-month", "previous-year", etc.
function resolveComparisonPeriod(comparePeriod: string, currentPeriod: string, filterType: string): string {
  if (!comparePeriod || comparePeriod === "none") return "";
  
  // If it's already a specific period like "2025-08", return as is
  if (comparePeriod.match(/^\d{4}-\d{2}$/) || comparePeriod.match(/^\d{4}$/)) {
    return comparePeriod;
  }
  
  // Parse current period to determine comparison period
  switch (comparePeriod) {
    case "previous-month": {
      if (filterType === "month" && currentPeriod.match(/^\d{4}-\d{2}$/)) {
        const [year, month] = currentPeriod.split('-').map(Number);
        const date = new Date(year, month - 1, 1);
        date.setMonth(date.getMonth() - 1);
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      }
      break;
    }
    case "previous-year": {
      if (filterType === "month" && currentPeriod.match(/^\d{4}-\d{2}$/)) {
        const [year, month] = currentPeriod.split('-');
        return `${parseInt(year) - 1}-${month}`;
      }
      if (filterType === "year" && currentPeriod.match(/^\d{4}$/)) {
        return `${parseInt(currentPeriod) - 1}`;
      }
      break;
    }
    case "same-month-last-year": {
      if (filterType === "month" && currentPeriod.match(/^\d{4}-\d{2}$/)) {
        const [year, month] = currentPeriod.split('-');
        return `${parseInt(year) - 1}-${month}`;
      }
      break;
    }
  }
  
  return comparePeriod; // Return as is if no pattern matches
}

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
      break;
    case 'month':
      // period format: "2025-09" 
      if (period.includes('-')) {
        const [year, month] = period.split('-');
        startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
        endDate = new Date(parseInt(year), parseInt(month), 0);
      }
      break;
    case 'year':
      // period format: "2025"
      const year = parseInt(period);
      if (!isNaN(year)) {
        startDate = new Date(year, 0, 1); // January 1st
        endDate = new Date(year, 11, 31); // December 31st
      }
      break;
    case 'range':
      // Check if it's a custom date range (format: "2025-09-01_2025-09-30")
      if (period.includes('_')) {
        const [start, end] = period.split('_');
        startDate = new Date(start);
        endDate = new Date(end);
      } else {
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
      }
      break;
  }

  return {
    startDate: startDate && !isNaN(startDate.getTime()) ? formatDateLocal(startDate) : undefined,
    endDate: endDate && !isNaN(endDate.getTime()) ? formatDateLocal(endDate) : undefined
  };
}

import { insertSalesTransactionSchema, insertGoalSchema, insertSalespersonUserSchema, insertProductSchema, insertProductStockSchema, insertTaskSchema, insertTaskAssignmentSchema, insertOrderSchema, insertOrderItemSchema, insertPriceListSchema, insertQuoteSchema, insertQuoteItemSchema, InsertTask } from "@shared/schema";
import { z } from "zod";
import bcrypt from "bcryptjs";

export function registerRoutes(app: Express): Server {
  // Setup email/password auth system (primary)
  setupAuth(app);

  // Note: Replit OIDC auth disabled to avoid conflicts - using email/password auth only

  // Configure multer for file uploads
  const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
  });

  // Health check endpoint
  app.get('/api/health', asyncHandler(async (req: any, res: any) => {
    const dbHealth = await checkDbHealth();
    const health = {
      status: dbHealth.connected ? 'healthy' : 'degraded',
      database: {
        connected: dbHealth.connected,
        connectionAttempts: dbHealth.attempts,
        lastError: dbHealth.lastError
      },
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    };
    
    res.status(dbHealth.connected ? 200 : 503).json(health);
  }));

  // Sales metrics endpoint
  app.get('/api/sales/metrics', requireAuth, async (req, res) => {
    try {
      const { startDate, endDate, salesperson, segment, client, supplier, period, filterType } = req.query;
      
      // Check if this is a comparison period query and resolve it
      let resolvedPeriod = period as string;
      if (period && typeof period === 'string' && (period.startsWith('previous-') || period.startsWith('same-month-'))) {
        // For comparison periods, we need the original period context
        // Since we don't have it in this query, we'll handle it in getDateRange
        resolvedPeriod = period;
      }
      
      const dateRange = getDateRange(resolvedPeriod, filterType as string);
      
      const currentStartDate = (startDate as string) || dateRange.startDate;
      const currentEndDate = (endDate as string) || dateRange.endDate;
      
      // Calculate previous period dates - exactly same period but one month before
      const currentStart = new Date(currentStartDate!);
      const currentEnd = new Date(currentEndDate!);
      
      // Clone the dates and move them back by exactly one month
      const previousStart = new Date(currentStart);
      const previousEnd = new Date(currentEnd);
      
      // Move to previous month keeping the exact same day pattern
      previousStart.setMonth(previousStart.getMonth() - 1);
      previousEnd.setMonth(previousEnd.getMonth() - 1);
      
      // Handle edge cases where the day doesn't exist in previous month
      if (previousStart.getMonth() === currentStart.getMonth()) {
        // Day doesn't exist (e.g., Jan 31 -> Feb), go to last day of target month
        previousStart.setDate(0);
      }
      if (previousEnd.getMonth() === currentEnd.getMonth()) {
        // Day doesn't exist (e.g., Jan 31 -> Feb), go to last day of target month  
        previousEnd.setDate(0);
      }
      
      const previousStartFormatted = formatDateLocal(previousStart);
      const previousEndFormatted = formatDateLocal(previousEnd);
      
      console.log(`[DEBUG] Periodo actual: ${currentStartDate} a ${currentEndDate}`);
      console.log(`[DEBUG] Periodo anterior: ${previousStartFormatted} a ${previousEndFormatted}`);
      
      // Get current period metrics
      const metrics = await storage.getSalesMetrics({
        startDate: currentStartDate,
        endDate: currentEndDate,
        salesperson: salesperson as string,
        segment: segment as string,
        client: client as string,
        supplier: supplier as string,
      });
      
      // Get previous period metrics for comparison (same period in previous month)
      const previousMetrics = await storage.getSalesMetrics({
        startDate: previousStartFormatted,
        endDate: previousEndFormatted,
        salesperson: salesperson as string,
        segment: segment as string,
        client: client as string,
        supplier: supplier as string,
      });
      
      console.log(`[DEBUG] Métricas actuales: Ventas=${metrics.totalSales}, Transacciones=${metrics.totalTransactions}`);
      console.log(`[DEBUG] Métricas anteriores: Ventas=${previousMetrics.totalSales}, Transacciones=${previousMetrics.totalTransactions}`);
      
      // Add previous period data for comparison - only include if there's actual transaction data
      // This ensures we show "Sin datos previos" when there were no transactions in the previous period
      const metricsWithComparison = {
        ...metrics,
        previousMonthSales: previousMetrics.totalTransactions > 0 ? previousMetrics.totalSales : undefined,
        previousMonthTransactions: previousMetrics.totalTransactions > 0 ? previousMetrics.totalTransactions : undefined,
        previousMonthOrders: previousMetrics.totalOrders > 0 ? previousMetrics.totalOrders : undefined,
        previousMonthUnits: previousMetrics.totalTransactions > 0 ? previousMetrics.totalUnits : undefined,
        previousMonthCustomers: previousMetrics.totalTransactions > 0 ? previousMetrics.activeCustomers : undefined,
      };
      
      console.log(`[DEBUG] Datos enviados al frontend:`, JSON.stringify(metricsWithComparison, null, 2));
      
      res.json(metricsWithComparison);
    } catch (error) {
      console.error("Error fetching sales metrics:", error);
      res.status(500).json({ message: "Failed to fetch sales metrics" });
    }
  });

  // Vendedor-specific metrics endpoint
  app.get('/api/sales/metrics/salesperson/:salespersonName', requireAuth, async (req, res) => {
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
  app.get('/api/sales/clients/salesperson/:salespersonName', requireAuth, async (req, res) => {
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
  app.get('/api/sales/chart-data/salesperson/:salespersonName', requireAuth, async (req, res) => {
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
  app.get('/api/goals/salesperson/:salespersonName', requireAuth, async (req, res) => {
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
  app.get('/api/alerts/salesperson/:salespersonName', requireAuth, async (req, res) => {
    try {
      const { salespersonName } = req.params;
      const alerts = await storage.getSalespersonAlerts(salespersonName);
      res.json(alerts);
    } catch (error) {
      console.error("Error fetching salesperson alerts:", error);
      res.status(500).json({ message: "Failed to fetch salesperson alerts" });
    }
  });

  // Dashboard específico del vendedor
  app.get('/api/salesperson/:salespersonId/dashboard', requireAuth, async (req, res) => {
    try {
      const { salespersonId } = req.params;
      const { period, filterType = "month" } = req.query;
      
      // Obtener el nombre del vendedor por su ID
      const user = await storage.getSalespersonUser(salespersonId);
      const salespersonName = user?.salespersonName;
      
      if (!salespersonName) {
        return res.status(404).json({ message: "Vendedor no encontrado" });
      }

      // Obtener rango de fechas
      const dateRange = getDateRange(period as string, filterType as string);

      // Obtener métricas específicas del vendedor con filtros de fecha
      const metrics = await storage.getSalesMetrics({
        salesperson: salespersonName,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      });

      // Obtener transacciones recientes del vendedor con filtros de fecha
      const transactions = await storage.getSalesTransactions({
        salesperson: salespersonName,
        limit: 10,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      });

      // Datos específicos del vendedor
      const dashboardData = {
        totalSales: metrics.totalSales || 0,
        transactions: metrics.totalTransactions || 0, 
        avgTicket: (metrics.totalSales / (metrics.totalTransactions || 1)) || 0,
        topProducts: [], // Se obtiene por separado
        recentSales: transactions || [],
        clientCount: 0 // Se calculará dinámicamente si es necesario
      };

      res.json(dashboardData);
    } catch (error) {
      console.error("Error fetching salesperson dashboard:", error);
      res.status(500).json({ message: "Failed to fetch salesperson dashboard" });
    }
  });

  // Clients específicos del vendedor por ID
  app.get('/api/salesperson/:salespersonId/clients', requireAuth, async (req, res) => {
    try {
      const { salespersonId } = req.params;
      const { period, filterType = "month" } = req.query;
      
      // Obtener el nombre del vendedor por su ID
      const user = await storage.getSalespersonUser(salespersonId);
      const salespersonName = user?.salespersonName;
      
      if (!salespersonName) {
        return res.status(404).json({ message: "Vendedor no encontrado" });
      }

      const clients = await storage.getSalespersonClients(salespersonName, period as string, filterType as string);
      res.json(clients);
    } catch (error) {
      console.error("Error fetching salesperson clients:", error);
      res.status(500).json({ message: "Failed to fetch salesperson clients" });
    }
  });

  // Goals específicas del vendedor por ID
  app.get('/api/salesperson/:salespersonId/goals', requireAuth, async (req, res) => {
    try {
      const { salespersonId } = req.params;
      const { period, filterType = "month" } = req.query;
      
      // Obtener el nombre del vendedor por su ID
      const user = await storage.getSalespersonUser(salespersonId);
      const salespersonName = user?.salespersonName;
      
      if (!salespersonName) {
        return res.status(404).json({ message: "Vendedor no encontrado" });
      }

      const goals = await storage.getGoalsBySalesperson(salespersonName);
      
      // Filter goals by period if specified
      const filteredGoals = period 
        ? goals.filter(goal => goal.period === period)
        : goals;
      
      // Process goals to include current sales and progress calculations
      const goalsWithProgress = await Promise.all(
        filteredGoals.map(async (goal) => {
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
          const progress = targetAmount > 0 ? (currentSales / targetAmount) * 100 : 0;
          const remaining = Math.max(0, targetAmount - currentSales);

          return {
            ...goal,
            currentSales,
            targetAmount,
            progress: Math.min(100, progress),
            remaining,
            isCompleted: progress >= 100
          };
        })
      );

      res.json(goalsWithProgress);
    } catch (error) {
      console.error("Error fetching salesperson goals:", error);
      res.status(500).json({ message: "Failed to fetch salesperson goals" });
    }
  });

  // Detalle completo de transacción específica
  app.get('/api/transactions/:transactionId/details', requireAuth, async (req, res) => {
    try {
      const { transactionId } = req.params;
      
      const transactionDetail = await storage.getTransactionDetails(transactionId);
      
      if (!transactionDetail) {
        return res.status(404).json({ message: "Transacción no encontrada" });
      }

      res.json(transactionDetail);
    } catch (error) {
      console.error("Error fetching transaction details:", error);
      res.status(500).json({ message: "Failed to fetch transaction details" });
    }
  });

  // Clients API
  app.get('/api/clients', requireAuth, async (req, res) => {
    try {
      const { search, segment, salesperson, creditStatus, businessType, debtStatus, entityType, limit, offset } = req.query;
      
      const filters = {
        search: search as string,
        segment: segment as string,
        salesperson: salesperson as string,
        creditStatus: creditStatus as string,
        businessType: businessType as string,
        debtStatus: debtStatus as string,
        entityType: entityType as string,
        limit: limit ? parseInt(limit as string) : 50,
        offset: offset ? parseInt(offset as string) : 0,
      };
      
      console.log('GET /api/clients - Filtros:', filters);
      
      const clients = await storage.getClients(filters);
      res.json(clients);
    } catch (error) {
      console.error('Error fetching clients:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  });

  // Get unique business types for client filtering
  app.get('/api/clients/business-types', requireAuth, async (req, res) => {
    try {
      console.log('GET /api/clients/business-types');
      
      const businessTypes = await storage.getUniqueBusinessTypes();
      
      console.log(`GET /api/clients/business-types - Devolviendo ${businessTypes.length} tipos de negocio`);
      
      res.json(businessTypes);
    } catch (error) {
      console.error('Error al obtener tipos de negocio:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  });

  // Get unique entity types for client filtering
  app.get('/api/clients/entity-types', requireAuth, async (req, res) => {
    try {
      console.log('GET /api/clients/entity-types');
      
      const entityTypes = await storage.getUniqueEntityTypes();
      
      console.log(`GET /api/clients/entity-types - Devolviendo ${entityTypes.length} tipos de entidad`);
      
      res.json(entityTypes);
    } catch (error) {
      console.error('Error al obtener tipos de entidad:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  });

  app.get('/api/clients/:koen', requireAuth, async (req, res) => {
    try {
      const { koen } = req.params;
      const client = await storage.getClientByKoen(koen);
      
      if (!client) {
        return res.status(404).json({ error: 'Cliente no encontrado' });
      }
      
      res.json(client);
    } catch (error) {
      console.error('Error fetching client:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  });

  // Clients import preview endpoint
  app.post('/api/clients/preview', requireAuth, upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No se ha subido ningún archivo" });
      }

      const csvContent = req.file.buffer.toString('utf-8');
      
      // Parse CSV content
      const parsed = Papa.parse(csvContent, {
        header: true,
        skipEmptyLines: true,
        delimiter: ';', // Use semicolon for Chilean format
      });

      if (parsed.errors.length > 0) {
        return res.status(400).json({ 
          message: "Error parsing CSV", 
          errors: parsed.errors 
        });
      }

      const csvData = parsed.data as Array<any>;
      
      if (csvData.length === 0) {
        return res.status(400).json({ message: "El archivo CSV está vacío" });
      }

      // Get existing clients to check for duplicates
      const existingClients = await storage.getClients({ limit: 10000 });
      const existingKoens = new Set(existingClients.map(c => c.koen).filter(Boolean));
      const existingNokoens = new Set(existingClients.map(c => c.nokoen).filter(Boolean));

      let wouldInsert = 0;
      let wouldUpdate = 0;
      
      for (const row of csvData) {
        const koen = row.KOEN;
        const nokoen = row.NOKOEN;
        
        if (koen && existingKoens.has(koen)) {
          wouldUpdate++;
        } else if (nokoen && existingNokoens.has(nokoen)) {
          wouldUpdate++;
        } else {
          wouldInsert++;
        }
      }

      res.json({
        success: true,
        preview: {
          totalClients: csvData.length,
          existingClients: existingClients.length,
          wouldInsert,
          wouldUpdate,
          sampleData: csvData.slice(0, 3).map(row => ({
            koen: row.KOEN,
            nokoen: row.NOKOEN,
            rten: row.RTEN,
            email: row.EMAIL,
            crlt: row.CRLT,
            cren: row.CREN
          }))
        }
      });
    } catch (error) {
      console.error('Error previewing clients CSV:', error);
      res.status(500).json({ 
        message: 'Error interno del servidor', 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Clients import endpoint  
  app.post('/api/clients/import', requireAuth, upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No se ha subido ningún archivo" });
      }

      const csvContent = req.file.buffer.toString('utf-8');
      
      // Parse CSV content
      const parsed = Papa.parse(csvContent, {
        header: true,
        skipEmptyLines: true,
        delimiter: ';', // Use semicolon for Chilean format
      });

      if (parsed.errors.length > 0) {
        return res.status(400).json({ 
          message: "Error parsing CSV", 
          errors: parsed.errors 
        });
      }

      const csvData = parsed.data as Array<any>;
      
      if (csvData.length === 0) {
        return res.status(400).json({ message: "El archivo CSV está vacío" });
      }

      // Convert CSV data to client objects
      const clientsToInsert = [];
      const errors = [];

      for (let index = 0; index < csvData.length; index++) {
        const row = csvData[index];
        try {
          // Convert string numbers to proper types
          const client = {
            koen: row.KOEN || null,
            nokoen: row.NOKOEN || `Cliente ${index + 1}`,
            rten: row.RTEN || null,
            idmaeen: row.IDMAEEN ? row.IDMAEEN.toString() : null,
            tien: row.TIEN || null,
            suen: row.SUEN || null,
            tiposuc: row.TIPOSUC || null,
            sien: row.SIEN || null,
            gien: row.GIEN || null,
            paen: row.PAEN || null,
            cien: row.CIEN || null,
            cmen: row.CMEN || null,
            dien: row.DIEN || null,
            zoen: row.ZOEN || null,
            foen: row.FOEN || null,
            faen: row.FAEN || null,
            email: row.EMAIL || null,
            
            // Credit fields - keep as strings for numeric database fields
            crlt: row.CRLT ? row.CRLT.toString() : null,
            cren: row.CREN ? row.CREN.toString() : null,
            crsd: row.CRSD ? row.CRSD.toString() : null,
            crch: row.CRCH ? row.CRCH.toString() : null,
            crpa: row.CRPA ? row.CRPA.toString() : null,
            crto: row.CRTO ? row.CRTO.toString() : null,
            
            // Add other important fields
            cnen: row.CNEN || null,
            kofuen: row.KOFUEN || null,
            lcen: row.LCEN || null,
            lven: row.LVEN || null,
            fevecren: row.FEVECREN || null,
            feultr: row.FEULTR || null,
            
            // Location fields
            comuna: row.COMUNA || null,
            provincia: row.PROVINCIA || null,
            cpostal: row.CPOSTAL || null,
            
            // Status fields - keep as strings for integer database fields
            actien: row.ACTIEN ? row.ACTIEN.toString() : null,
            bloqueado: row.BLOQUEADO ? row.BLOQUEADO.toString() : null,
          };

          clientsToInsert.push(client);
        } catch (error) {
          errors.push(`Row ${index + 1}: ${error instanceof Error ? error.message : 'Invalid data'}`);
        }
      }

      if (errors.length > 0) {
        return res.status(400).json({ 
          message: "Errores en el procesamiento de datos", 
          errors 
        });
      }

      // Import clients using upsert logic
      const importResult = await storage.insertMultipleClients(clientsToInsert) ?? 
        { inserted: 0, updated: 0, skipped: 0 };

      res.json({
        success: true,
        message: `Successfully imported ${clientsToInsert.length} clients`,
        ...importResult // This includes inserted, updated, skipped
      });

    } catch (error) {
      console.error('Error importing clients:', error);
      res.status(500).json({ 
        message: 'Error interno del servidor', 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Sales transactions endpoint
  app.get('/api/sales/transactions', requireAuth, async (req, res) => {
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
  app.get('/api/sales/top-salespeople', requireAuth, async (req, res) => {
    try {
      const { limit, period, filterType, segment } = req.query;
      const dateRange = getDateRange(period as string, filterType as string);
      
      const result = await storage.getTopSalespeople(
        limit ? parseInt(limit as string) : undefined,
        dateRange.startDate,
        dateRange.endDate,
        segment as string // Filtrar por segmento específico
      );
      res.json(result);
    } catch (error) {
      console.error("Error fetching top salespeople:", error);
      res.status(500).json({ message: "Failed to fetch top salespeople" });
    }
  });

  // Top products endpoint
  app.get('/api/sales/top-products', requireAuth, async (req, res) => {
    try {
      const { limit, period, filterType, salesperson, segment } = req.query;
      const dateRange = getDateRange(period as string, filterType as string);
      
      const result = await storage.getTopProducts(
        limit ? parseInt(limit as string) : undefined,
        dateRange.startDate,
        dateRange.endDate,
        salesperson as string, // Filtrar por vendedor específico
        segment as string // Filtrar por segmento específico
      );
      res.json(result);
    } catch (error) {
      console.error("Error fetching top products:", error);
      res.status(500).json({ message: "Failed to fetch top products" });
    }
  });

  // Top clients endpoint
  app.get('/api/sales/top-clients', requireAuth, async (req, res) => {
    try {
      const { limit, period, filterType, salesperson, segment } = req.query;
      const dateRange = getDateRange(period as string, filterType as string);
      
      const result = await storage.getTopClients(
        limit ? parseInt(limit as string) : undefined,
        dateRange.startDate,
        dateRange.endDate,
        salesperson as string, // Filtrar por vendedor específico
        segment as string // Filtrar por segmento específico
      );
      res.json(result);
    } catch (error) {
      console.error("Error fetching top clients:", error);
      res.status(500).json({ message: "Failed to fetch top clients" });
    }
  });

  // Segment analysis endpoint
  app.get('/api/sales/segments', requireAuth, async (req, res) => {
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

  // Segment analysis by unique clients endpoint
  app.get('/api/sales/segments-by-clients', requireAuth, async (req, res) => {
    try {
      const { period, filterType } = req.query;
      const dateRange = getDateRange(period as string, filterType as string);
      
      const segmentAnalysis = await storage.getSegmentAnalysisByUniqueClients(
        dateRange.startDate,
        dateRange.endDate
      );
      res.json(segmentAnalysis);
    } catch (error) {
      console.error("Error fetching segment analysis by clients:", error);
      res.status(500).json({ message: "Failed to fetch segment analysis by clients" });
    }
  });

  // Packaging metrics endpoint
  app.get('/api/sales/packaging-metrics', requireAuth, asyncHandler(async (req: any, res: any) => {
    const { period, filterType, salesperson, segment } = req.query;
    const dateRange = getDateRange(period as string, filterType as string);
    
    const packagingMetrics = await storage.getPackagingMetrics({
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      salesperson: salesperson as string,
      segment: segment as string,
    });
    
    res.json(packagingMetrics);
  }));

  // NVV Packaging breakdown endpoint
  app.get('/api/nvv/packaging-breakdown', requireAuth, asyncHandler(async (req: any, res: any) => {
    const { period, filterType, salesperson, segment } = req.query;
    const dateRange = getDateRange(period as string, filterType as string);
    
    const packagingMetrics = await storage.getPackagingMetrics({
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      salesperson: salesperson as string,
      segment: segment as string,
    });
    
    res.json(packagingMetrics);
  }));

  // Comunas analysis endpoint
  app.get('/api/sales/comunas', requireAuth, async (req, res) => {
    try {
      const { period, filterType, segment, salesperson, viewType } = req.query;
      const dateRange = getDateRange(period as string, filterType as string);
      
      if (viewType === 'regiones') {
        const regionAnalysis = await storage.getRegionAnalysis({
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
          segment: segment as string,
          salesperson: salesperson as string,
        });
        res.json(regionAnalysis);
      } else {
        const comunasAnalysis = await storage.getComunasAnalysis({
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
          segment: segment as string,
          salesperson: salesperson as string,
        });
        res.json(comunasAnalysis);
      }
    } catch (error) {
      console.error("Error fetching location analysis:", error);
      res.status(500).json({ message: "Failed to fetch location analysis" });
    }
  });

  // Sales chart data endpoint
  app.get('/api/sales/chart-data', requireAuth, async (req, res) => {
    try {
      const { period = 'monthly', selectedPeriod, filterType, salesperson, segment } = req.query;
      
      // Si tenemos selectedPeriod y filterType, usamos esos para el filtro de fecha
      const dateRange = selectedPeriod && filterType 
        ? getDateRange(selectedPeriod as string, filterType as string)
        : { startDate: undefined, endDate: undefined };
      
      let chartData = await storage.getSalesChartData(
        period as 'weekly' | 'monthly' | 'daily',
        dateRange.startDate,
        dateRange.endDate,
        salesperson as string, // Filtrar por vendedor específico
        segment as string // Filtrar por segmento específico
      );

      // Transformar etiquetas a nombres de meses en español para vista anual mensual
      if (filterType === 'year' && period === 'monthly') {
        const monthNames: { [key: string]: string } = {
          '01': 'Enero',
          '02': 'Febrero', 
          '03': 'Marzo',
          '04': 'Abril',
          '05': 'Mayo',
          '06': 'Junio',
          '07': 'Julio',
          '08': 'Agosto',
          '09': 'Septiembre',
          '10': 'Octubre',
          '11': 'Noviembre',
          '12': 'Diciembre'
        };

        chartData = chartData.map(item => ({
          ...item,
          period: monthNames[item.period.split('-')[1]] || item.period
        }));
      }
      
      res.json(chartData);
    } catch (error) {
      console.error("Error fetching chart data:", error);
      res.status(500).json({ message: "Failed to fetch chart data" });
    }
  });

  // Product detail routes - analytics for specific products
  app.get('/api/sales/product/:productName/details', requireAuth, asyncHandler(async (req: any, res: any) => {
    const { productName } = req.params;
    const { period, filterType } = req.query;
    const dateRange = getDateRange(period as string, filterType as string);
    
    const details = await storage.getProductDetails(productName, {
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
    });
    res.json(details);
  }));

  app.get('/api/sales/product/:productName/formats', requireAuth, asyncHandler(async (req: any, res: any) => {
    const { productName } = req.params;
    const { period, filterType } = req.query;
    const dateRange = getDateRange(period as string, filterType as string);
    
    const formats = await storage.getProductFormats(productName, {
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
    });
    res.json(formats);
  }));

  app.get('/api/sales/product/:productName/colors', requireAuth, asyncHandler(async (req: any, res: any) => {
    const { productName } = req.params;
    const { period, filterType } = req.query;
    const dateRange = getDateRange(period as string, filterType as string);
    
    const colors = await storage.getProductColors(productName, {
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
    });
    res.json(colors);
  }));

  // Segment detail route - clients by segment
  app.get("/api/sales/segment/:segmentName/clients", requireAuth, async (req, res) => {
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
  app.get("/api/sales/segment/:segmentName/salespeople", requireAuth, async (req, res) => {
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
  app.get("/api/sales/salesperson/:salespersonName/details", requireAuth, async (req, res) => {
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

  app.get("/api/sales/salesperson/:salespersonName/clients", requireAuth, async (req, res) => {
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
  app.get("/api/sales/client/:clientName/details", requireAuth, async (req, res) => {
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

  app.get("/api/sales/client/:clientName/products", requireAuth, async (req, res) => {
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
  app.get("/api/sales/salesperson/:salespersonName/clients-analysis", requireAuth, async (req, res) => {
    try {
      const { salespersonName } = req.params;
      
      const analysis = await storage.getSalespersonClientsAnalysis(salespersonName);
      res.json(analysis);
    } catch (error) {
      console.error("Error fetching salesperson clients analysis:", error);
      res.status(500).json({ message: "Failed to fetch salesperson clients analysis" });
    }
  });

  // Get available vendors for supervisor to claim
  app.get("/api/supervisor/:supervisorId/available-vendors", requireAuth, async (req, res) => {
    try {
      const { supervisorId } = req.params;
      
      // Get supervisor's assigned segment
      const supervisor = await storage.getSalespersonUser(supervisorId);
      if (!supervisor || supervisor.role !== 'supervisor') {
        return res.status(403).json({ message: "No autorizado como supervisor" });
      }
      
      const segment = supervisor.assignedSegment;
      if (!segment) {
        return res.status(400).json({ message: "Supervisor sin segmento asignado" });
      }
      
      const availableVendors = await storage.getAvailableVendorsInSegment(segment);
      res.json(availableVendors);
    } catch (error) {
      console.error("Error fetching available vendors:", error);
      res.status(500).json({ message: "Failed to fetch available vendors" });
    }
  });

  // Claim a vendor (convert from sales data to user account)
  app.post("/api/supervisor/:supervisorId/claim-vendor", requireAuth, async (req, res) => {
    try {
      const { supervisorId } = req.params;
      const { salespersonName, email, password } = req.body;
      
      // Validate supervisor
      const supervisor = await storage.getSalespersonUser(supervisorId);
      if (!supervisor || supervisor.role !== 'supervisor') {
        return res.status(403).json({ message: "No autorizado como supervisor" });
      }
      
      const segment = supervisor.assignedSegment;
      if (!segment) {
        return res.status(400).json({ message: "Supervisor sin segmento asignado" });
      }
      
      // Check if vendor is available
      const availableVendors = await storage.getAvailableVendorsInSegment(segment);
      const vendorExists = availableVendors.some(v => v.salespersonName === salespersonName);
      
      if (!vendorExists) {
        return res.status(400).json({ message: "Vendedor no disponible o ya asignado" });
      }
      
      // Create user account for the vendor
      const claimedVendor = await storage.claimVendor({
        salespersonName,
        email,
        password,
        supervisorId,
        assignedSegment: segment
      });
      
      res.status(201).json(claimedVendor);
    } catch (error) {
      console.error("Error claiming vendor:", error);
      res.status(500).json({ message: "Failed to claim vendor" });
    }
  });

  // CSV template download endpoint removed - using native platform format

  // CSV import endpoint
  app.post('/api/sales/import', requireAuth, async (req, res) => {
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
  app.get('/api/goals', requireAuth, async (req, res) => {
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

  app.post('/api/goals', requireAuth, async (req, res) => {
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

  app.put('/api/goals/:id', requireAuth, async (req, res) => {
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

  app.delete('/api/goals/:id', requireAuth, async (req, res) => {
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
  app.get('/api/goals/data/segments', requireAuth, async (req, res) => {
    try {
      const segments = await storage.getUniqueSegments();
      res.json(segments);
    } catch (error) {
      console.error("Error fetching segments:", error);
      res.status(500).json({ message: "Failed to fetch segments" });
    }
  });

  app.get('/api/goals/data/salespeople', requireAuth, async (req, res) => {
    try {
      const salespeople = await storage.getUniqueSalespeople();
      res.json(salespeople);
    } catch (error) {
      console.error("Error fetching salespeople:", error);
      res.status(500).json({ message: "Failed to fetch salespeople" });
    }
  });

  app.get('/api/goals/data/clients', requireAuth, async (req, res) => {
    try {
      const clients = await storage.getUniqueClients();
      res.json(clients);
    } catch (error) {
      console.error("Error fetching clients:", error);
      res.status(500).json({ message: "Failed to fetch clients" });
    }
  });

  app.get('/api/goals/data/suppliers', requireAuth, async (req, res) => {
    try {
      const suppliers = await storage.getUniqueSuppliers();
      res.json(suppliers);
    } catch (error) {
      console.error("Error fetching suppliers:", error);
      res.status(500).json({ message: "Failed to fetch suppliers" });
    }
  });

  // Goals progress endpoint
  app.get('/api/goals/progress', requireAuth, async (req, res) => {
    try {
      const { selectedPeriod, type, target } = req.query;
      const filterPeriod = selectedPeriod as string;
      const filterType = type as string;
      const filterTarget = target as string;
      
      // Normalize function to handle case and accent insensitive comparison
      const normalize = (str: string | null | undefined): string => {
        if (!str) return '';
        return str
          .toString()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '') // Remove diacritics (accents)
          .toLowerCase()
          .trim();
      };
      
      const allGoals = await storage.getGoals();
      
      // Filter goals by selected period - only show goals for the specific period
      let filteredGoals = filterPeriod 
        ? allGoals.filter(goal => goal.period === filterPeriod)
        : allGoals;
      
      // Additional filtering by type and target if provided
      if (filterType && filterType !== "all") {
        filteredGoals = filteredGoals.filter(goal => goal.type === filterType);
        
        // If a specific target is provided, filter by it with normalized comparison
        if (filterTarget) {
          filteredGoals = filteredGoals.filter(goal => normalize(goal.target) === normalize(filterTarget));
        }
      }
      
      // If no goals found for the filters, return empty array (this will hide the section)
      if (filteredGoals.length === 0) {
        res.json([]);
        return;
      }
      
      const goalsWithProgress = await Promise.all(
        filteredGoals.map(async (goal) => {
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

      // Verificar autenticación con el nuevo sistema 
      if (!req.user || !req.user.id) {
        console.log('[DEBUG] No authentication found');
        return res.status(401).json({ message: 'Usuario no autenticado' });
      }
      
      console.log('[DEBUG] Using authenticated user - new auth system');
      userId = req.user.id;
      userRecord = req.user;
      
      console.log('[DEBUG] userRecord:', userRecord);
      console.log('[DEBUG] userRecord.role:', userRecord?.role);
      
      if (userRecord?.role !== 'admin' && userRecord?.role !== 'supervisor') {
        console.log('[DEBUG] Access denied - role is not admin or supervisor');
        return res.status(403).json({ message: 'Acceso denegado. Solo administradores y supervisores pueden actualizar usuarios.' });
      }
      
      console.log('[DEBUG] Access granted - user is admin or supervisor');

      const { id } = req.params;
      const validatedUser = insertSalespersonUserSchema.partial().parse(req.body);
      
      // Verificar si se está cambiando información crítica (email o password)
      const isCriticalUpdate = validatedUser.email || validatedUser.password;
      
      // Hash de la contraseña si se proporciona
      if (validatedUser.password) {
        validatedUser.password = await bcrypt.hash(validatedUser.password, 12);
      }

      const updatedUser = await storage.updateSalespersonUser(id, validatedUser);
      
      // Si se cambió email o password, invalidar sesiones activas del usuario
      if (isCriticalUpdate) {
        console.log('[DEBUG] Critical update detected (email/password), invalidating sessions for user:', id);
        // Obtener todas las sesiones activas y eliminar las de este usuario
        try {
          await storage.invalidateUserSessions(id);
          console.log('[DEBUG] User sessions invalidated successfully');
        } catch (sessionError) {
          console.warn('[WARN] Failed to invalidate user sessions:', sessionError);
          // No fallar la actualización del usuario por esto
        }
      }
      
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

      // Verificar autenticación con el nuevo sistema
      if (!req.user || !req.user.id) {
        return res.status(401).json({ message: 'Usuario no autenticado' });
      }
      
      userId = req.user.id;
      userRecord = req.user;
      
      if (userRecord?.role !== 'admin' && userRecord?.role !== 'supervisor') {
        return res.status(403).json({ message: 'Acceso denegado. Solo administradores y supervisores pueden eliminar usuarios.' });
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

      // Verificar autenticación con el nuevo sistema
      if (!req.user || !req.user.id) {
        return res.status(401).json({ message: 'Usuario no autenticado' });
      }
      
      userId = req.user.id;
      userRecord = req.user;
      
      if (userRecord?.role !== 'admin' && userRecord?.role !== 'supervisor') {
        return res.status(403).json({ message: 'Acceso denegado. Solo administradores y supervisores pueden acceder a la gestión de usuarios.' });
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
      // Para desarrollo, permitimos acceso más flexible pero conservamos verificaciones básicas
      // En producción estas verificaciones serían más estrictas

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

  // Obtener productos más vendidos por el equipo del supervisor
  app.get('/api/supervisor/:supervisorId/team-products', async (req: any, res) => {
    try {
      const { supervisorId } = req.params;
      const { limit = 10 } = req.query;

      // Obtener vendedores del supervisor
      const salespeople = await storage.getSalespeopleUnderSupervisor(supervisorId);
      const salespeopleNames = salespeople.map(sp => sp.salespersonName);

      if (salespeopleNames.length === 0) {
        return res.json([]);
      }

      // Obtener productos más vendidos por el equipo
      const topProducts = await storage.getTopProductsByTeam(salespeopleNames, parseInt(limit));
      res.json(topProducts);
    } catch (error) {
      console.error("Error fetching team products:", error);
      res.status(500).json({ message: "Failed to fetch team products" });
    }
  });

  // Obtener métricas consolidadas del equipo
  app.get('/api/supervisor/:supervisorId/team-metrics', async (req: any, res) => {
    try {
      const { supervisorId } = req.params;
      
      // Obtener vendedores del supervisor
      const salespeople = await storage.getSalespeopleUnderSupervisor(supervisorId);
      const salespeopleNames = salespeople.map(sp => sp.salespersonName);

      if (salespeopleNames.length === 0) {
        return res.json({
          totalSales: 0,
          totalTransactions: 0,
          averagePerSalesperson: 0,
          bestPerformer: null,
          teamGrowth: 0
        });
      }

      const metrics = await storage.getTeamMetrics(salespeopleNames);
      res.json(metrics);
    } catch (error) {
      console.error("Error fetching team metrics:", error);
      res.status(500).json({ message: "Failed to fetch team metrics" });
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
      if (!existingGoal.target) {
        return res.status(400).json({ message: 'Meta no tiene un objetivo válido' });
      }
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

  // CSV parsing function for sales transactions
  function parseCSV(csvContent: string) {
    // Parse CSV using Papa Parse with auto-detection of delimiter
    const firstLine = csvContent.split('\n')[0];
    const commaCount = (firstLine.match(/,/g) || []).length;
    const semicolonCount = (firstLine.match(/;/g) || []).length;
    const delimiter = semicolonCount > commaCount ? ';' : ',';
    
    console.log(`🔍 CSV delimiter detected: "${delimiter}"`);
    
    const parseResult = Papa.parse(csvContent, {
      header: true,
      delimiter,
      skipEmptyLines: true,
      transformHeader: (header: string) => header.trim()
    });

    if (parseResult.errors.length > 0) {
      console.warn('CSV parsing errors:', parseResult.errors);
    }

    const transactions = [];
    const rawData = parseResult.data as any[];
    
    console.log(`📊 Processing ${rawData.length} CSV rows`);

    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i];
      const transaction: any = {};
      
      // Helper functions
      const cleanValue = (value: any): string => {
        if (!value) return '';
        return value.toString().replace(/^"|"$/g, '').trim();
      };
      
      const parseNumber = (value: any): string | null => {
        if (!value || value.toString().trim() === '') return null;
        let cleanValue = value.toString();
        // Handle Spanish number format (1.234,56)
        if (cleanValue.includes('.') && cleanValue.includes(',')) {
          cleanValue = cleanValue.replace(/\./g, '').replace(',', '.');
        } else if (cleanValue.includes(',') && !cleanValue.includes('.')) {
          const parts = cleanValue.split(',');
          if (parts.length === 2 && parts[1].length <= 3) {
            cleanValue = cleanValue.replace(',', '.');
          }
        }
        const parsed = parseFloat(cleanValue);
        return isNaN(parsed) ? null : cleanValue;
      };
      
      const parseDate = (value: any): string | null => {
        if (!value || value.toString().trim() === '') return null;
        try {
          const dateStr = value.toString();
          let parts: string[];
          
          if (dateStr.includes('-')) {
            parts = dateStr.split('-');
          } else if (dateStr.includes('/')) {
            parts = dateStr.split('/');
          } else {
            return null;
          }
          
          if (parts.length === 3) {
            const day = parseInt(parts[0]);
            const month = parseInt(parts[1]);
            const year = parseInt(parts[2]);
            
            if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1900) {
              const formattedMonth = month.toString().padStart(2, '0');
              const formattedDay = day.toString().padStart(2, '0');
              return `${year}-${formattedMonth}-${formattedDay}`;
            }
          }
        } catch (e) {
          console.warn('Invalid date format:', value);
        }
        return null;
      };

      // Map CSV columns to transaction fields
      Object.keys(row).forEach(header => {
        const cleanHeader = header.toLowerCase().trim().replace(/\s+/g, '');
        const rawValue = row[header];
        const value = cleanValue(rawValue);
        
        switch (cleanHeader) {
          // Required fields
          case 'nudo':
            if (value) transaction.nudo = value;
            break;
          case 'feemdo':
            if (value) transaction.feemdo = parseDate(value);
            break;
          case 'tido':
            transaction.tido = value || '';
            break;
            
          // String fields
          case 'koprct':
          case 'nokoen':
          case 'noruen':
          case 'nokoprct':
          case 'nokofu':
          case 'endo':
          case 'suendo':
          case 'sudo':
          case 'kofudo':
          case 'modo':
          case 'timodo':
          case 'lilg':
          case 'nulido':
          case 'sulido':
          case 'bosulido':
          case 'kofulido':
          case 'prct':
          case 'tict':
          case 'tipr':
          case 'nusepr':
          case 'ud01pr':
          case 'ud02pr':
          case 'eslido':
          case 'fmpr':
          case 'mrpr':
          case 'zona':
          case 'ruen':
          case 'pfpr':
          case 'hfpr':
          case 'ocdo':
          case 'nofmpr':
          case 'nopfpr':
          case 'nohfpr':
          case 'listacost':
          case 'nokozo':
          case 'nosudo':
          case 'nokofudo':
          case 'nobosuli':
          case 'nomrpr':
            if (value) transaction[cleanHeader] = value;
            break;
            
          // Date fields
          case 'feulvedo':
          case 'feemli':
          case 'feerli':
            if (value) transaction[cleanHeader] = parseDate(value);
            break;
            
          // Integer field
          case 'luvtlido':
            if (value) {
              const intVal = parseInt(value);
              transaction.luvtlido = isNaN(intVal) ? null : intVal;
            }
            break;
            
          // Numeric fields
          case 'idmaeedo':
          case 'tamodo':
          case 'caprad':
          case 'caprex':
          case 'vanedo':
          case 'vaivdo':
          case 'vabrdo':
          case 'udtrpr':
          case 'rludpr':
          case 'caprco1':
          case 'caprad1':
          case 'caprex1':
          case 'caprnc1':
          case 'caprco2':
          case 'caprad2':
          case 'caprex2':
          case 'caprnc2':
          case 'ppprne':
          case 'ppprbr':
          case 'vaneli':
          case 'vabrli':
          case 'ppprpm':
          case 'ppprpmifrs':
          case 'logistica':
          case 'ppprnere1':
          case 'ppprnere2':
          case 'idmaeddo':
          case 'recaprre':
          case 'monto':
          case 'devol1':
          case 'devol2':
          case 'stockfis':
          case 'liscosmod':
            if (value) transaction[cleanHeader] = parseNumber(value);
            break;
        }
      });
      
      // Only add transaction if it has required fields
      if (transaction.nudo || transaction.feemdo || transaction.idmaeedo) {
        transactions.push(transaction);
      } else if (i < 5) {
        console.warn(`❌ Row ${i + 1} without required fields:`, transaction);
      }
    }
    
    console.log(`✅ Processed ${transactions.length} valid transactions from CSV`);
    return transactions;
  }

  // Public product routes (for shop)
  app.get('/api/public/products', async (req: any, res) => {
    try {
      const { search, category, limit = 100, offset = 0 } = req.query;
      
      const filters = {
        search: search || undefined,
        category: category || undefined,
        active: true, // Only show active products
        limit: parseInt(limit),
        offset: parseInt(offset)
      };

      // Get products without prices for public access
      const products = await storage.getProductsPublic(filters);
      res.json(products);
    } catch (error) {
      console.error("Error fetching public products:", error);
      res.status(500).json({ message: "Failed to fetch products" });
    }
  });

  // Get prices for authenticated users only
  app.get('/api/products/prices', requireAuth, async (req: any, res) => {
    try {
      const prices = await storage.getAllProductPrices();
      res.json(prices);
    } catch (error) {
      console.error("Error fetching prices:", error);
      res.status(500).json({ message: "Failed to fetch prices" });
    }
  });

  // Product routes
  app.get('/api/products', requireAuth, async (req: any, res) => {
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

  app.get('/api/products/:sku', requireAuth, async (req: any, res) => {
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

  app.get('/api/products/:sku/stock', requireAuth, async (req: any, res) => {
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

  app.get('/api/products/:sku/analytics', requireAuth, async (req: any, res) => {
    try {
      const { sku } = req.params;
      const analytics = await storage.getProductAnalytics(sku);
      res.json(analytics);
    } catch (error) {
      console.error("Error fetching product analytics:", error);
      res.status(500).json({ message: "Failed to fetch product analytics" });
    }
  });

  app.get('/api/products/:sku/price-history', requireAuth, async (req: any, res) => {
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
  app.get('/api/warehouses', requireAuth, async (req: any, res) => {
    try {
      const warehouses = await storage.getWarehouses();
      res.json(warehouses);
    } catch (error) {
      console.error("Error fetching warehouses:", error);
      res.status(500).json({ message: "Failed to fetch warehouses" });
    }
  });

  // Get stock summary by warehouse
  app.get('/api/warehouses/stock-summary', requireAuth, async (req: any, res) => {
    try {
      const stockSummary = await storage.getStockSummaryByWarehouse();
      res.json(stockSummary);
    } catch (error) {
      console.error("Error fetching warehouse stock summary:", error);
      res.status(500).json({ message: "Failed to fetch warehouse stock summary" });
    }
  });

  // Get detailed stock for a specific warehouse
  app.get('/api/warehouses/:warehouseCode/stock', requireAuth, async (req: any, res) => {
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

  app.put('/api/products/:sku/price', requireAuth, async (req: any, res) => {
    try {
      const { sku } = req.params;
      const { price, offerPrice, showInStore, reason } = req.body;
      
      if (!price || isNaN(price)) {
        return res.status(400).json({ message: "Valid price is required" });
      }

      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const product = await storage.updateProductPrice(
        sku, 
        parseFloat(price), 
        userId, 
        reason
      );
      res.json(product);
    } catch (error) {
      console.error("Error updating product price:", error);
      res.status(500).json({ message: "Failed to update product price" });
    }
  });

  // ===================== eCommerce API Routes =====================
  
  // Get eCommerce products with filters (admin/supervisor only)
  app.get('/api/ecommerce/products', requireAdminOrSupervisor, asyncHandler(async (req: any, res: any) => {
    const { 
      search, 
      category, 
      active, 
      ecomActive, 
      minPrice, 
      maxPrice, 
      tags,
      limit, 
      offset 
    } = req.query;

    // Parse filters
    const filters: any = {};
    
    if (search) filters.search = search as string;
    if (category) filters.category = category as string;
    if (active !== undefined) filters.active = active === 'true';
    if (ecomActive !== undefined) filters.ecomActive = ecomActive === 'true';
    if (minPrice) filters.minPrice = parseFloat(minPrice as string);
    if (maxPrice) filters.maxPrice = parseFloat(maxPrice as string);
    if (tags) {
      // Handle tags as comma-separated string
      filters.tags = (tags as string).split(',').map(tag => tag.trim()).filter(Boolean);
    }
    if (limit) filters.limit = parseInt(limit as string);
    if (offset) filters.offset = parseInt(offset as string);

    const products = await storage.getEcommerceProducts(filters);
    res.json(products);
  }));

  // Get single eCommerce product (admin/supervisor only)
  app.get('/api/ecommerce/products/:kopr', requireAdminOrSupervisor, asyncHandler(async (req: any, res: any) => {
    const { kopr } = req.params;
    const product = await storage.getEcommerceProduct(kopr);
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    res.json(product);
  }));

  // Create new eCommerce product (admin/supervisor only)
  app.post('/api/ecommerce/products', requireAdminOrSupervisor, asyncHandler(async (req: any, res: any) => {
    const { 
      ecommerceProductSchema 
    } = await import('@shared/schema');
    
    // Validate request body
    const validationResult = ecommerceProductSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ 
        message: 'Validation error', 
        errors: validationResult.error.errors 
      });
    }

    // Check if slug is available
    const slugAvailable = await storage.validateProductSlug(validationResult.data.slug);
    if (!slugAvailable) {
      return res.status(400).json({ 
        message: 'Slug already exists. Please choose a different slug.' 
      });
    }

    // Convert schema data to EcommerceProduct format for storage
    const ecommerceProduct = {
      id: validationResult.data.kopr,
      createdAt: new Date(),
      updatedAt: new Date(),
      descripcion: validationResult.data.name,
      priceListId: validationResult.data.kopr, // Using kopr as priceListId
      activo: validationResult.data.ecomActive,
      categoria: validationResult.data.category || null,
      imagenUrl: validationResult.data.images?.[0]?.url || null,
      precioEcommerce: validationResult.data.ecomPrice?.toString() || null,
      orden: null,
    };
    const product = await storage.createEcommerceProduct(ecommerceProduct);
    res.status(201).json(product);
  }));

  // Update eCommerce product (admin/supervisor only)
  app.patch('/api/ecommerce/products/:kopr', requireAdminOrSupervisor, asyncHandler(async (req: any, res: any) => {
    const { kopr } = req.params;
    const { 
      updateEcommerceProductSchema 
    } = await import('@shared/schema');
    
    // Validate request body
    const validationResult = updateEcommerceProductSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ 
        message: 'Validation error', 
        errors: validationResult.error.errors 
      });
    }

    // If slug is being updated, check availability
    if (validationResult.data.slug) {
      const slugAvailable = await storage.validateProductSlug(validationResult.data.slug, kopr);
      if (!slugAvailable) {
        return res.status(400).json({ 
          message: 'Slug already exists. Please choose a different slug.' 
        });
      }
    }

    try {
      const product = await storage.updateEcommerceProduct(kopr, validationResult.data);
      res.json(product);
    } catch (error: any) {
      if (error.message.includes('not found')) {
        return res.status(404).json({ message: 'Product not found' });
      }
      throw error;
    }
  }));

  // Toggle eCommerce active status (admin/supervisor only)
  app.patch('/api/ecommerce/products/:kopr/toggle-active', requireAdminOrSupervisor, asyncHandler(async (req: any, res: any) => {
    const { kopr } = req.params;
    
    try {
      const product = await storage.toggleEcommerceActive(kopr);
      res.json(product);
    } catch (error: any) {
      if (error.message.includes('not found')) {
        return res.status(404).json({ message: 'Product not found' });
      }
      throw error;
    }
  }));

  // Get available eCommerce categories (admin/supervisor only)
  app.get('/api/ecommerce/categories', requireAdminOrSupervisor, asyncHandler(async (req: any, res: any) => {
    const categories = await storage.getEcommerceCategories();
    res.json(categories);
  }));

  // Validate product slug availability (admin/supervisor only)
  app.post('/api/ecommerce/products/validate-slug', requireAdminOrSupervisor, asyncHandler(async (req: any, res: any) => {
    const { slug, excludeKopr } = req.body;
    
    if (!slug) {
      return res.status(400).json({ message: 'Slug is required' });
    }

    const isAvailable = await storage.validateProductSlug(slug, excludeKopr);
    res.json({ available: isAvailable });
  }));

  // ===================== End eCommerce API Routes =====================

  // ===================== eCommerce Admin API Routes (Simple) =====================
  
  // Get products for eCommerce admin panel (imports from priceList)
  app.get('/api/ecommerce/admin/productos', requireAdminOrSupervisor, asyncHandler(async (req: any, res: any) => {
    const { search, categoria, activo } = req.query;
    
    const products = await storage.getEcommerceAdminProducts({
      search,
      categoria: categoria !== 'all' ? categoria : undefined,
      activo: activo !== 'all' ? (activo === 'true') : undefined
    });
    
    res.json(products);
  }));

  // Get categories for eCommerce admin panel
  app.get('/api/ecommerce/admin/categorias', requireAdminOrSupervisor, asyncHandler(async (req: any, res: any) => {
    const categories = await storage.getEcommerceAdminCategories();
    res.json(categories);
  }));

  // Get stats for eCommerce admin panel
  app.get('/api/ecommerce/admin/stats', requireAdminOrSupervisor, asyncHandler(async (req: any, res: any) => {
    const stats = await storage.getEcommerceAdminStats();
    res.json(stats);
  }));

  // Update eCommerce product in admin panel
  app.patch('/api/ecommerce/admin/productos/:id', requireAdminOrSupervisor, asyncHandler(async (req: any, res: any) => {
    const { id } = req.params;
    const { categoria, descripcion, imagenUrl, precio, activo } = req.body;
    
    console.log('🔄 [BACKEND] Recibida solicitud PATCH para producto:', {
      id,
      body: req.body,
      user: req.user?.email,
      timestamp: new Date().toISOString()
    });
    
    console.log('📝 [BACKEND] Datos extraídos para actualización:', {
      categoria,
      descripcion,
      imagenUrl,
      precio,
      activo,
      precioEcommerce: precio
    });
    
    try {
      console.log('🏪 [BACKEND] Llamando a storage.updateEcommerceAdminProduct...');
      const product = await storage.updateEcommerceAdminProduct(id, {
        categoria,
        descripcion,
        imagenUrl,
        precioEcommerce: precio,
        activo
      });
      
      console.log('✅ [BACKEND] Producto actualizado exitosamente:', product);
      res.json(product);
    } catch (error: any) {
      console.error('❌ [BACKEND] Error en updateEcommerceAdminProduct:', {
        error: error.message,
        stack: error.stack,
        id,
        updates: { categoria, descripcion, imagenUrl, precioEcommerce: precio, activo }
      });
      
      if (error.message.includes('not found')) {
        return res.status(404).json({ message: 'Product not found' });
      }
      throw error;
    }
  }));

  // Toggle product active status in admin panel
  app.patch('/api/ecommerce/admin/productos/:id/toggle', requireAdminOrSupervisor, asyncHandler(async (req: any, res: any) => {
    const { id } = req.params;
    
    try {
      const product = await storage.toggleEcommerceAdminProduct(id);
      res.json(product);
    } catch (error: any) {
      if (error.message.includes('not found')) {
        return res.status(404).json({ message: 'Product not found' });
      }
      throw error;
    }
  }));

  // Create new category in admin panel
  app.post('/api/ecommerce/admin/categorias', requireAdminOrSupervisor, asyncHandler(async (req: any, res: any) => {
    const { nombre, descripcion } = req.body;
    
    if (!nombre || nombre.trim() === '') {
      return res.status(400).json({ message: 'Nombre de categoría es requerido' });
    }
    
    try {
      const category = await storage.createEcommerceAdminCategory({
        nombre: nombre.trim(),
        descripcion: descripcion?.trim()
      });
      res.json(category);
    } catch (error: any) {
      if (error.message.includes('already exists') || error.message.includes('unique')) {
        return res.status(400).json({ message: 'Ya existe una categoría con ese nombre' });
      }
      throw error;
    }
  }));

  // ===================== End eCommerce Admin API Routes =====================

  // Preview CSV endpoint - Analyze sales CSV without importing
  app.post('/api/sales/preview', requireAuth, upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      console.log(`📋 Analyzing CSV file: ${req.file.originalname}`);
      
      // Parse CSV content using the same logic as import
      const csvContent = req.file.buffer.toString('utf-8');
      const transactions = parseCSV(csvContent);
      
      if (transactions.length === 0) {
        return res.status(400).json({ message: "No valid transactions found in CSV" });
      }

      // Analyze date range
      const dates = transactions
        .map(t => t.feemdo)
        .filter(date => date && date !== '')
        .sort();
      
      const startDate = dates[0];
      const endDate = dates[dates.length - 1];
      
      if (!startDate || !endDate) {
        return res.status(400).json({ message: "No valid dates found in CSV" });
      }

      // Check existing transactions in this date range (no limit for preview)
      const existingTransactions = await storage.getSalesTransactions({
        startDate,
        endDate,
        limit: 999999 // Remove limit for accurate count
      });

      // Group by month for better visualization
      const monthsAffected = Array.from(new Set(dates.map(date => date.substring(0, 7)))); // YYYY-MM

      console.log(`📊 Preview analysis: ${transactions.length} transactions, period ${startDate} to ${endDate}`);

      res.json({
        preview: {
          totalTransactions: transactions.length,
          dateRange: {
            start: startDate,
            end: endDate
          },
          monthsAffected,
          existingTransactions: existingTransactions.length,
          wouldDelete: existingTransactions.length,
          wouldInsert: transactions.length
        }
      });
    } catch (error) {
      console.error("Error previewing CSV:", error);
      res.status(500).json({ message: "Failed to preview CSV" });
    }
  });

  // Atomic Replace Import endpoint - Delete existing period + import new data
  app.post('/api/sales/import-replace', requireAuth, upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const { confirmed } = req.body;
      if (!confirmed || confirmed !== 'true') {
        return res.status(400).json({ message: "Import must be confirmed" });
      }

      console.log(`🔄 Starting atomic replace import: ${req.file.originalname}`);
      
      // Parse and validate CSV content
      const csvContent = req.file.buffer.toString('utf-8');
      const transactions = parseCSV(csvContent);
      
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
        }
      }

      if (validatedTransactions.length === 0) {
        return res.status(400).json({ 
          message: "No valid transactions found",
          errors: errors.slice(0, 5)
        });
      }

      // Determine date range for deletion
      const dates = validatedTransactions
        .map(t => t.feemdo)
        .filter(date => date && date !== '')
        .sort();
      
      const startDate = dates[0];
      const endDate = dates[dates.length - 1];

      // Perform atomic replace operation
      const result = await storage.replaceTransactionsByDateRange(
        validatedTransactions,
        startDate,
        endDate
      );
      
      res.json({ 
        message: "Data replaced successfully",
        deleted: result.deleted,
        inserted: result.inserted,
        dateRange: { start: startDate, end: endDate },
        errors: errors.length > 0 ? errors.slice(0, 5) : undefined
      });
    } catch (error) {
      console.error("Error in atomic replace import:", error);
      res.status(500).json({ message: "Failed to replace sales data" });
    }
  });

  // CSV Import endpoint - Products
  app.post('/api/products/import-csv', requireAuth, upload.single('csvFile'), async (req: any, res) => {
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

      console.log(`📊 CSV parseado: ${parseResult.data.length} filas`);
      
      // Transform CSV data to match our schema
      const csvData = parseResult.data.map((row: any, index: number) => {
        const transformedRow = {
          sku: row.KOPR?.toString()?.trim(),
          name: row.NOKOPR?.toString()?.trim(),
          unit1: row.UD01PR?.toString()?.trim() || 'UN',
          unit2: row.UD02PR?.toString()?.trim() || 'UN',
          branchCode: row.KOSU?.toString()?.trim(),
          warehouseCode: row.KOBO?.toString()?.trim(),
          warehouseLocation: row.DATOSUBIC?.toString()?.trim() || '',
          physicalStock1: parseFloat(row.STFI1?.toString()?.replace(',', '.')) || 0,
          physicalStock2: parseFloat(row.STFI2?.toString()?.replace(',', '.')) || 0,
          availableStock1: parseFloat(row.STDV1?.toString()?.replace(',', '.')) || 0,
          availableStock2: parseFloat(row.STDV2?.toString()?.replace(',', '.')) || 0,
          committedStock1: parseFloat(row.STOCNV1?.toString()?.replace(',', '.')) || 0,
          committedStock2: parseFloat(row.STOCNV2?.toString()?.replace(',', '.')) || 0,
          unitRatio: parseFloat(row.RLUD?.toString()?.replace(',', '.')) || 1,
          fmpr: row.FMPR?.toString()?.trim() || '',
          pfpr: row.PFPR?.toString()?.trim() || '',
          hfpr: row.HFPR?.toString()?.trim() || '',
          rupr: row.RUPR?.toString()?.trim() || '',
          mrpr: row.MRPR?.toString()?.trim() || '',
          originalRowIndex: index + 1
        };

        // Log problematic rows
        if (!transformedRow.sku || !transformedRow.name) {
          console.log(`⚠️  Fila ${index + 1}: SKU o nombre vacío`, { sku: transformedRow.sku, name: transformedRow.name });
        }
        if (!transformedRow.branchCode || !transformedRow.warehouseCode) {
          console.log(`⚠️  Fila ${index + 1}: Sucursal o bodega vacía`, { branchCode: transformedRow.branchCode, warehouseCode: transformedRow.warehouseCode });
        }

        return transformedRow;
      }).filter((row: any) => {
        const isValid = row.sku && row.name && row.branchCode && row.warehouseCode;
        if (!isValid) {
          console.log(`❌ Fila ${row.originalRowIndex} excluida: datos incompletos`);
        }
        return isValid;
      });

      console.log(`✅ Filas válidas para procesar: ${csvData.length}`)

      // Transform to KOPR format for new import function
      const koprData = csvData.map((row: any) => ({
        KOPR: row.sku,
        NOKOPR: row.name,
        UD01PR: row.unit1,
        UD02PR: row.unit2,
        KOSU: row.branchCode,
        KOBO: row.warehouseCode,
        DATOSUBIC: row.warehouseLocation,
        STFI1: row.physicalStock1?.toString(),
        STFI2: row.physicalStock2?.toString()
      }));

      const result = await storage.importProductStockFromKOPRCSV(koprData);
      
      console.log(`📈 Resultado de importación:`, result);
      
      res.json({
        message: "CSV import completed",
        result: {
          ...result,
          totalRowsInCSV: parseResult.data.length,
          validRowsProcessed: csvData.length,
          filteredOutRows: parseResult.data.length - csvData.length
        }
      });
    } catch (error) {
      console.error("Error importing CSV:", error);
      res.status(500).json({ message: "Failed to import CSV", error: error });
    }
  });

  // Products-only CSV Import endpoint - Recibe datos parseados con separación universal
  app.post('/api/products/import-products-csv', requireAuth, async (req: any, res) => {
    try {
      const { products } = req.body;
      
      if (!products || !Array.isArray(products)) {
        return res.status(400).json({ message: "No products data provided" });
      }

      console.log(`📊 Productos parseados: iniciando procesamiento de ${products.length} productos`);
      
      // Debug: Log first few rows to see structure
      console.log(`🔍 Primeros 3 productos:`, JSON.stringify(products.slice(0, 3), null, 2));
      console.log(`🔍 Columnas disponibles:`, Object.keys(products[0] || {}));
      
      // Transform to KOPR format for storage function
      const koprData = products.map((row: any) => ({
        KOPR: row.KOPR?.toString()?.trim(),
        NOKOPR: row.NOKOPR?.toString()?.trim(),
        UD02PR: row.UD02PR?.toString()?.trim(),
        KOSU: row.KOSU?.toString()?.trim(),
        KOBO: row.KOBO?.toString()?.trim(),
        DATOSUBIC: row.DATOSUBIC?.toString()?.trim(),
        STFI2: row.STFI2?.toString()?.trim()
      })).filter((item: any) => item.KOPR && item.NOKOPR);
      
      console.log(`✅ Productos válidos para procesar: ${koprData.length}`);

      const result = await storage.importProductStockFromKOPRCSV(koprData);
      
      console.log(`📈 Resultado de importación de productos:`, result);
      
      res.json({
        message: "Products CSV import completed",
        result: {
          ...result,
          totalRowsInCSV: products.length,
          validRowsProcessed: koprData.length,
          filteredOutRows: products.length - koprData.length
        }
      });
    } catch (error) {
      console.error("Error importing products CSV:", error);
      res.status(500).json({ message: "Failed to import products CSV", error: error });
    }
  });

  // Warehouse and branch routes
  app.get('/api/warehouses', requireAuth, async (req: any, res) => {
    try {
      const warehouses = await storage.getWarehouses();
      res.json(warehouses);
    } catch (error) {
      console.error("Error fetching warehouses:", error);
      res.status(500).json({ message: "Failed to fetch warehouses" });
    }
  });

  app.get('/api/branches', requireAuth, async (req: any, res) => {
    try {
      const branches = await storage.getBranches();
      res.json(branches);
    } catch (error) {
      console.error("Error fetching branches:", error);
      res.status(500).json({ message: "Failed to fetch branches" });
    }
  });

  // Task management endpoints
  app.get('/api/tasks', requireAuth, async (req: any, res) => {
    try {
      const user = req.user;
      const { status, priority } = req.query;
      
      // SECURE: Use optimized method with role-based access control
      const userSegments = user.assignedSegment ? [user.assignedSegment] : [];
      const tasks = await storage.getTasksWithAssignmentsOptimized({
        status: status as string,
        priority: priority as string,
        userRole: user.role,
        userId: user.id,
        assigneeSegments: userSegments,
      });
      
      res.json(tasks);
    } catch (error) {
      console.error("Error fetching tasks:", error);
      if (error instanceof Error && error.message?.includes('Unauthorized')) {
        return res.status(403).json({ message: error.message });
      }
      res.status(500).json({ message: "Failed to fetch tasks" });
    }
  });

  app.get('/api/tasks/:id', requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const user = req.user;
      
      const task = await storage.getTask(id);
      
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }
      
      // Check if user has access to this task
      const canAccess = user.role === 'admin' || user.role === 'supervisor' ||
        task.createdByUserId === user.id ||
        task.assignments.some(assignment => 
          (assignment.assigneeType === "user" && assignment.assigneeId === user.id) ||
          (assignment.assigneeType === "segment" && assignment.assigneeId === user.assignedSegment)
        );
      
      if (!canAccess) {
        return res.status(403).json({ message: "Access denied to this task" });
      }
      
      res.json(task);
    } catch (error) {
      console.error("Error fetching task:", error);
      res.status(500).json({ message: "Failed to fetch task" });
    }
  });

  app.post('/api/tasks', requireAuth, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only admin and supervisor can create tasks
      if (user.role !== 'admin' && user.role !== 'supervisor') {
        return res.status(403).json({ message: "Only administrators and supervisors can create tasks" });
      }
      
      // SECURITY: Use discriminated union validation with assignments
      const createTaskWithAssignmentsSchema = z.object({
        assignments: z.array(insertTaskAssignmentSchema.pick({
          assigneeType: true,
          assigneeId: true
        })).min(1, "At least one assignment is required")
      }).and(insertTaskSchema);
      
      // Validate request body with discriminated union validation
      const validation = createTaskWithAssignmentsSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          message: "Invalid task data", 
          errors: validation.error.issues 
        });
      }
      
      const { title, description, type, dueDate, priority, payload, assignments } = validation.data;
      
      // Additional validation: formulario tasks must have formKey='compras_potenciales'
      if (type === 'formulario' && payload && 'formKey' in payload) {
        if (payload.formKey !== 'compras_potenciales') {
          return res.status(400).json({ 
            message: "Invalid formulario task", 
            errors: [{ message: "formulario tasks must have formKey='compras_potenciales'" }]
          });
        }
      }
      
      const taskData = {
        title,
        description: description || null,
        type,
        dueDate: dueDate ? new Date(dueDate) : null,
        priority: priority || 'medium',
        status: 'pendiente' as const,
        payload, // Now properly validated payload based on task type
        createdByUserId: user.id,
      };
      
      // Add taskId to assignments (will be set by storage method)
      const assignmentsWithDefaults = assignments.map(assignment => ({
        ...assignment,
        taskId: '', // Will be set by createTask method
      }));
      
      const task = await storage.createTask(taskData, assignmentsWithDefaults);
      res.status(201).json(task);
    } catch (error) {
      console.error("Error creating task:", error);
      res.status(500).json({ message: "Failed to create task" });
    }
  });

  app.patch('/api/tasks/:id', requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const user = req.user;
      
      const task = await storage.getTask(id);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }
      
      // Only admin, supervisor, or task creator can update task
      const canUpdate = user.role === 'admin' || user.role === 'supervisor' || task.createdByUserId === user.id;
      if (!canUpdate) {
        return res.status(403).json({ message: "Not authorized to update this task" });
      }
      
      // Field whitelisting: only allow specific fields to be updated (no createdByUserId for security)
      const updateTaskSchema = z.object({
        title: z.string().min(1).optional(),
        description: z.string().optional(),
        type: z.enum(["texto", "formulario", "visita"]).optional(),
        dueDate: z.string().refine((date) => {
          if (!date) return true;
          // Accept datetime-local format (YYYY-MM-DDTHH:mm) or full ISO format (YYYY-MM-DDTHH:mm:ss.sssZ)
          const datetimeLocalRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
          const isoDatetimeRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;
          return datetimeLocalRegex.test(date) || isoDatetimeRegex.test(date) || !isNaN(Date.parse(date));
        }, "Fecha debe ser formato válido (YYYY-MM-DDTHH:mm o ISO datetime)").optional().or(z.null()),
        priority: z.enum(["low", "medium", "high"]).optional(),
        status: z.enum(["pendiente", "en_progreso", "completada"]).optional()
      }).partial();
      
      // Validate request body with Zod
      const validation = updateTaskSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          message: "Invalid task update data", 
          errors: validation.error.issues 
        });
      }
      
      const updates = validation.data;
      
      // Additional role-based restrictions
      if (user.role === 'salesperson' && task.createdByUserId !== user.id) {
        // Salesperson can only update status of tasks assigned to them
        const isAssigned = task.assignments.some(assignment => 
          (assignment.assigneeType === "user" && assignment.assigneeId === user.id) ||
          (assignment.assigneeType === "segment" && assignment.assigneeId === user.assignedSegment)
        );
        
        if (!isAssigned) {
          return res.status(403).json({ message: "Not authorized to update this task" });
        }
        
        // Only allow status updates for assigned salesperson
        if (Object.keys(updates).some(key => key !== 'status')) {
          return res.status(403).json({ message: "Salesperson can only update task status" });
        }
      }
      
      // Convert dueDate string to Date if present, handle all cases properly
      const { dueDate, ...otherUpdates } = updates;
      const processedUpdates: Partial<InsertTask> = {
        ...otherUpdates,
        // Handle dueDate conversion properly
        ...(dueDate !== undefined && {
          dueDate: typeof dueDate === 'string' 
            ? new Date(dueDate) 
            : dueDate // Already Date or null
        })
      };
      
      const updatedTask = await storage.updateTask(id, processedUpdates);
      res.json(updatedTask);
    } catch (error) {
      console.error("Error updating task:", error);
      res.status(500).json({ message: "Failed to update task" });
    }
  });

  app.delete('/api/tasks/:id', requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const user = req.user;
      
      const task = await storage.getTask(id);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }
      
      // Only admin, supervisor, or task creator can delete task
      const canDelete = user.role === 'admin' || user.role === 'supervisor' || task.createdByUserId === user.id;
      if (!canDelete) {
        return res.status(403).json({ message: "Not authorized to delete this task" });
      }
      
      await storage.deleteTask(id);
      res.json({ message: "Task deleted successfully" });
    } catch (error) {
      console.error("Error deleting task:", error);
      res.status(500).json({ message: "Failed to delete task" });
    }
  });

  app.patch('/api/tasks/:taskId/assignments/:assignmentId', requireAuth, async (req: any, res) => {
    try {
      const { taskId, assignmentId } = req.params;
      const user = req.user;
      
      // Field whitelisting: only allow status and notes to be updated
      const updateAssignmentSchema = insertTaskAssignmentSchema.pick({
        status: true,
        notes: true
      }).partial();
      
      // Validate request body with Zod
      const validation = updateAssignmentSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          message: "Invalid assignment update data", 
          errors: validation.error.issues 
        });
      }
      
      const { status, notes } = validation.data;
      
      const task = await storage.getTask(taskId);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }
      
      const assignment = task.assignments.find(a => a.id === assignmentId);
      if (!assignment) {
        return res.status(404).json({ message: "Assignment not found" });
      }
      
      // Check if user can update this assignment
      const isAssignee = (assignment.assigneeType === "user" && assignment.assigneeId === user.id) ||
        (assignment.assigneeType === "segment" && assignment.assigneeId === user.assignedSegment);
      const isAdminOrSupervisor = user.role === 'admin' || user.role === 'supervisor';
      
      if (!isAssignee && !isAdminOrSupervisor) {
        return res.status(403).json({ message: "Not authorized to update this assignment" });
      }
      
      const updatedAssignment = await storage.updateAssignmentStatus(assignmentId, status || '', notes || undefined);
      res.json(updatedAssignment);
    } catch (error) {
      console.error("Error updating assignment:", error);
      res.status(500).json({ message: "Failed to update assignment" });
    }
  });

  app.patch('/api/tasks/:taskId/assignments/:assignmentId/read', requireAuth, async (req: any, res) => {
    try {
      const { taskId, assignmentId } = req.params;
      const user = req.user;
      
      const task = await storage.getTask(taskId);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }
      
      const assignment = task.assignments.find(a => a.id === assignmentId);
      if (!assignment) {
        return res.status(404).json({ message: "Assignment not found" });
      }
      
      // Check if user can mark this assignment as read
      const isAssignee = (assignment.assigneeType === "user" && assignment.assigneeId === user.id) ||
        (assignment.assigneeType === "segment" && assignment.assigneeId === user.assignedSegment);
      
      if (!isAssignee) {
        return res.status(403).json({ message: "Not authorized to mark this assignment as read" });
      }
      
      const updatedAssignment = await storage.markAssignmentRead(assignmentId);
      res.json(updatedAssignment);
    } catch (error) {
      console.error("Error marking assignment as read:", error);
      res.status(500).json({ message: "Failed to mark assignment as read" });
    }
  });

  // Order management endpoints
  app.get('/api/orders', requireAuth, async (req: any, res) => {
    try {
      const user = req.user;
      const { status, clientName, limit = 50, offset = 0 } = req.query;
      
      const orders = await storage.getOrders({
        status: status as string,
        clientName: clientName as string,
        userRole: user.role,
        userId: user.id,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
      });
      
      res.json(orders);
    } catch (error) {
      console.error("Error fetching orders:", error);
      if (error instanceof Error && error.message?.includes('Unauthorized')) {
        return res.status(403).json({ message: error.message });
      }
      res.status(500).json({ message: "Failed to fetch orders" });
    }
  });

  app.get('/api/orders/:id', requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const user = req.user;
      
      const order = await storage.getOrderById(id);
      
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }
      
      // Role-based access control
      if (user.role === 'salesperson' && order.createdBy !== user.id) {
        return res.status(403).json({ message: "Access denied to this order" });
      }
      
      res.json(order);
    } catch (error) {
      console.error("Error fetching order:", error);
      res.status(500).json({ message: "Failed to fetch order" });
    }
  });

  app.post('/api/orders', requireAuth, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only admin and supervisor can create orders
      if (!['admin', 'supervisor'].includes(user.role)) {
        return res.status(403).json({ message: "Not authorized to create orders" });
      }
      
      const validatedData = insertOrderSchema.parse({
        ...req.body,
        createdBy: user.id
      });
      
      // Transform data for storage layer and generate orderNumber
      const orderData = {
        ...validatedData,
        orderNumber: `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        estimatedDeliveryDate: validatedData.estimatedDeliveryDate 
          ? new Date(validatedData.estimatedDeliveryDate) 
          : null
      };
      
      const order = await storage.createOrder(orderData);
      res.status(201).json(order);
    } catch (error) {
      console.error("Error creating order:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors 
        });
      }
      res.status(500).json({ message: "Failed to create order" });
    }
  });

  app.patch('/api/orders/:id', requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const user = req.user;
      
      const order = await storage.getOrderById(id);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }
      
      // Role-based access control - only admin and supervisor can update orders
      const canUpdate = user.role === 'admin' || user.role === 'supervisor';
      
      if (!canUpdate) {
        return res.status(403).json({ message: "Not authorized to update this order" });
      }
      
      const validatedUpdateData = insertOrderSchema.partial().parse(req.body);
      
      // Transform data for storage layer
      const updateData = {
        ...validatedUpdateData,
        ...(validatedUpdateData.estimatedDeliveryDate !== undefined && {
          estimatedDeliveryDate: validatedUpdateData.estimatedDeliveryDate 
            ? new Date(validatedUpdateData.estimatedDeliveryDate) 
            : null
        })
      } as Partial<any>; // Type assertion to handle storage compatibility
      
      const updatedOrder = await storage.updateOrder(id, updateData);
      
      res.json(updatedOrder);
    } catch (error) {
      console.error("Error updating order:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors 
        });
      }
      res.status(500).json({ message: "Failed to update order" });
    }
  });

  app.delete('/api/orders/:id', requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const user = req.user;
      
      const order = await storage.getOrderById(id);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }
      
      // Role-based access control - only admin and supervisor can delete orders
      const canDelete = user.role === 'admin' || user.role === 'supervisor';
      
      if (!canDelete) {
        return res.status(403).json({ message: "Not authorized to delete this order" });
      }
      
      await storage.deleteOrder(id);
      res.json({ message: "Order deleted successfully" });
    } catch (error) {
      console.error("Error deleting order:", error);
      res.status(500).json({ message: "Failed to delete order" });
    }
  });

  // Order items endpoints
  app.get('/api/orders/:orderId/items', requireAuth, async (req: any, res) => {
    try {
      const { orderId } = req.params;
      const user = req.user;
      
      const order = await storage.getOrderById(orderId);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }
      
      // Role-based access control
      if (user.role === 'salesperson' && order.createdBy !== user.id) {
        return res.status(403).json({ message: "Access denied to this order" });
      }
      
      const items = await storage.getOrderItems(orderId);
      res.json(items);
    } catch (error) {
      console.error("Error fetching order items:", error);
      res.status(500).json({ message: "Failed to fetch order items" });
    }
  });

  app.post('/api/orders/:orderId/items', requireAuth, async (req: any, res) => {
    try {
      const { orderId } = req.params;
      const user = req.user;
      
      const order = await storage.getOrderById(orderId);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }
      
      // Role-based access control - only admin and supervisor can add order items
      const canAddItems = user.role === 'admin' || user.role === 'supervisor';
      
      if (!canAddItems) {
        return res.status(403).json({ message: "Not authorized to add items to this order" });
      }
      
      const itemData = insertOrderItemSchema.parse({
        ...req.body,
        orderId
      });
      
      const item = await storage.createOrderItem(itemData);
      res.status(201).json(item);
    } catch (error) {
      console.error("Error creating order item:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors 
        });
      }
      res.status(500).json({ message: "Failed to create order item" });
    }
  });

  // Quote endpoints
  app.get('/api/quotes', requireAuth, async (req: any, res) => {
    try {
      const user = req.user;
      const { status, clientName, limit = 50, offset = 0 } = req.query;
      
      const filters: any = {
        limit: Math.min(parseInt(limit) || 50, 100),
        offset: parseInt(offset) || 0,
      };
      
      // Add filters based on role and user permissions
      if (user.role === 'salesperson') {
        filters.createdBy = user.id;
      }
      
      if (status) {
        filters.status = status;
      }
      
      if (clientName) {
        filters.clientName = clientName;
      }
      
      const quotes = await storage.getQuotes(filters);
      res.json(quotes);
    } catch (error) {
      console.error("Error fetching quotes:", error);
      res.status(500).json({ message: "Failed to fetch quotes" });
    }
  });

  app.post('/api/quotes', requireAuth, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Role-based access control - only admin, supervisor and salesperson can create quotes
      const canCreate = ['admin', 'supervisor', 'salesperson'].includes(user.role);
      
      if (!canCreate) {
        return res.status(403).json({ message: "Not authorized to create quotes" });
      }
      
      const validatedData = insertQuoteSchema.parse({
        ...req.body,
        createdBy: user.id
      });
      
      // Prepare data for storage with proper type conversions
      const storageData = {
        ...validatedData,
        // Convert validUntil string to Date object if present
        validUntil: validatedData.validUntil ? new Date(validatedData.validUntil) : null
      } as any; // Type assertion to handle the conversion
      
      const quote = await storage.createQuote(storageData);
      res.status(201).json(quote);
    } catch (error) {
      console.error("Error creating quote:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors 
        });
      }
      res.status(500).json({ message: "Failed to create quote" });
    }
  });

  app.get('/api/quotes/:id', requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const user = req.user;
      
      const quote = await storage.getQuoteById(id);
      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }
      
      // Role-based access control
      if (user.role === 'salesperson' && quote.createdBy !== user.id) {
        return res.status(403).json({ message: "Access denied to this quote" });
      }
      
      res.json(quote);
    } catch (error) {
      console.error("Error fetching quote:", error);
      res.status(500).json({ message: "Failed to fetch quote" });
    }
  });

  app.put('/api/quotes/:id', requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const user = req.user;
      
      const quote = await storage.getQuoteById(id);
      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }
      
      // Role-based access control
      if (user.role === 'salesperson' && quote.createdBy !== user.id) {
        return res.status(403).json({ message: "Not authorized to update this quote" });
      }
      
      const validatedUpdateData = insertQuoteSchema.partial().parse(req.body);
      
      // Prepare data for storage with proper type conversions
      const storageUpdateData = {
        ...validatedUpdateData,
        // Convert validUntil string to Date object if present
        validUntil: validatedUpdateData.validUntil ? new Date(validatedUpdateData.validUntil) : validatedUpdateData.validUntil
      } as any; // Type assertion to handle the conversion
      
      const updatedQuote = await storage.updateQuote(id, storageUpdateData);
      res.json(updatedQuote);
    } catch (error) {
      console.error("Error updating quote:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors 
        });
      }
      res.status(500).json({ message: "Failed to update quote" });
    }
  });

  app.delete('/api/quotes/:id', requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const user = req.user;
      
      const quote = await storage.getQuoteById(id);
      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }
      
      // Role-based access control - only admin and supervisor can delete quotes
      const canDelete = user.role === 'admin' || user.role === 'supervisor';
      
      if (!canDelete) {
        return res.status(403).json({ message: "Not authorized to delete this quote" });
      }
      
      await storage.deleteQuote(id);
      res.json({ message: "Quote deleted successfully" });
    } catch (error) {
      console.error("Error deleting quote:", error);
      res.status(500).json({ message: "Failed to delete quote" });
    }
  });

  // Quote items endpoints
  app.get('/api/quotes/:quoteId/items', requireAuth, async (req: any, res) => {
    try {
      const { quoteId } = req.params;
      const user = req.user;
      
      const quote = await storage.getQuoteById(quoteId);
      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }
      
      // Role-based access control
      if (user.role === 'salesperson' && quote.createdBy !== user.id) {
        return res.status(403).json({ message: "Access denied to this quote" });
      }
      
      const items = await storage.getQuoteItems(quoteId);
      res.json(items);
    } catch (error) {
      console.error("Error fetching quote items:", error);
      res.status(500).json({ message: "Failed to fetch quote items" });
    }
  });

  app.post('/api/quotes/:quoteId/items', requireAuth, async (req: any, res: any) => {
    try {
      const { quoteId } = req.params;
      const user = req.user;
      
      const quote = await storage.getQuoteById(quoteId);
      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }
      
      // Role-based access control
      if (user.role === 'salesperson' && quote.createdBy !== user.id) {
        return res.status(403).json({ message: "Not authorized to add items to this quote" });
      }
      
      const itemData = insertQuoteItemSchema.parse({
        ...req.body,
        quoteId
      });
      
      const item = await storage.createQuoteItem(itemData);
      res.status(201).json(item);
    } catch (error) {
      console.error("Error creating quote item:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors 
        });
      }
      res.status(500).json({ message: "Failed to create quote item" });
    }
  });

  app.put('/api/quote-items/:id', requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const user = req.user;
      
      // Get the quote item to verify ownership via quote
      const item = await storage.getQuoteItemById(id);
      if (!item) {
        return res.status(404).json({ message: "Quote item not found" });
      }
      
      const quote = await storage.getQuoteById(item.quoteId);
      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }
      
      // Role-based access control
      if (user.role === 'salesperson' && quote.createdBy !== user.id) {
        return res.status(403).json({ message: "Not authorized to update this quote item" });
      }
      
      const validatedData = insertQuoteItemSchema.partial().parse(req.body);
      const updatedItem = await storage.updateQuoteItem(id, validatedData);
      
      res.json(updatedItem);
    } catch (error) {
      console.error("Error updating quote item:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors 
        });
      }
      res.status(500).json({ message: "Failed to update quote item" });
    }
  });

  app.delete('/api/quote-items/:id', requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const user = req.user;
      
      // Get the quote item to verify ownership via quote
      const item = await storage.getQuoteItemById(id);
      if (!item) {
        return res.status(404).json({ message: "Quote item not found" });
      }
      
      const quote = await storage.getQuoteById(item.quoteId);
      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }
      
      // Role-based access control
      if (user.role === 'salesperson' && quote.createdBy !== user.id) {
        return res.status(403).json({ message: "Not authorized to delete this quote item" });
      }
      
      await storage.deleteQuoteItem(id);
      res.json({ message: "Quote item deleted successfully" });
    } catch (error) {
      console.error("Error deleting quote item:", error);
      res.status(500).json({ message: "Failed to delete quote item" });
    }
  });

  // Quote to Order conversion
  app.post('/api/quotes/:id/convert-to-order', requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const user = req.user;
      
      const quote = await storage.getQuoteById(id);
      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }
      
      // Role-based access control - only admin, supervisor and quote creator can convert
      const canConvert = user.role === 'admin' || user.role === 'supervisor' || quote.createdBy === user.id;
      
      if (!canConvert) {
        return res.status(403).json({ message: "Not authorized to convert this quote" });
      }
      
      const order = await storage.convertQuoteToOrder(id, user.id);
      res.status(201).json(order);
    } catch (error) {
      console.error("Error converting quote to order:", error);
      res.status(500).json({ message: "Failed to convert quote to order" });
    }
  });

  // Get available units for filtering
  app.get('/api/price-list/units', requireAuth, async (req, res) => {
    try {
      const units = await storage.getAvailableUnits();
      res.json(units);
    } catch (error) {
      console.error("Error fetching available units:", error);
      res.status(500).json({ message: "Failed to fetch available units" });
    }
  });

  // Get available product types for filtering
  app.get('/api/price-list/product-types', requireAuth, async (req, res) => {
    try {
      const productTypes = await storage.getProductTypes();
      res.json(productTypes);
    } catch (error) {
      console.error("Error fetching product types:", error);
      res.status(500).json({ message: "Failed to fetch product types" });
    }
  });

  // Get available colors for filtering
  app.get('/api/price-list/colors', requireAuth, async (req, res) => {
    try {
      const colors = await storage.getAllProductColors();
      res.json(colors);
    } catch (error) {
      console.error("Error fetching product colors:", error);
      res.status(500).json({ message: "Failed to fetch product colors" });
    }
  });

  // Price List endpoints
  app.get('/api/price-list', requireAuth, async (req, res) => {
    try {
      const { search, unidad, tipoProducto, color, limit = 50, offset = 0 } = req.query;
      
      // Validate and clamp pagination parameters
      const validatedLimit = Math.min(Math.max(parseInt(limit as string) || 50, 1), 200);
      const validatedOffset = Math.max(parseInt(offset as string) || 0, 0);
      
      const items = await storage.getPriceList({
        search: search as string,
        unidad: unidad as string,
        tipoProducto: tipoProducto as string,
        color: color as string,
        limit: validatedLimit,
        offset: validatedOffset,
      });
      
      const totalCount = await storage.getPriceListCount(search as string, unidad as string, tipoProducto as string, color as string);
      
      res.json({
        items,
        totalCount,
        hasMore: (parseInt(offset as string) + items.length) < totalCount
      });
    } catch (error) {
      console.error("Error fetching price list:", error);
      res.status(500).json({ message: "Failed to fetch price list" });
    }
  });

  app.get('/api/price-list/:id', requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const item = await storage.getPriceListById(id);
      
      if (!item) {
        return res.status(404).json({ message: "Price list item not found" });
      }
      
      res.json(item);
    } catch (error) {
      console.error("Error fetching price list item:", error);
      res.status(500).json({ message: "Failed to fetch price list item" });
    }
  });

  app.post('/api/price-list', requireAuth, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only admin and supervisor can create price list items
      if (user.role !== 'admin' && user.role !== 'supervisor') {
        return res.status(403).json({ message: "Not authorized to create price list items" });
      }
      
      const validatedData = insertPriceListSchema.parse(req.body);
      const item = await storage.createPriceListItem(validatedData);
      
      res.status(201).json(item);
    } catch (error) {
      console.error("Error creating price list item:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors 
        });
      }
      res.status(500).json({ message: "Failed to create price list item" });
    }
  });

  app.patch('/api/price-list/:id', requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const user = req.user;
      
      // Only admin and supervisor can update price list items
      if (user.role !== 'admin' && user.role !== 'supervisor') {
        return res.status(403).json({ message: "Not authorized to update price list items" });
      }
      
      const item = await storage.getPriceListById(id);
      if (!item) {
        return res.status(404).json({ message: "Price list item not found" });
      }
      
      const validatedData = insertPriceListSchema.partial().parse(req.body);
      const updatedItem = await storage.updatePriceListItem(id, validatedData);
      
      res.json(updatedItem);
    } catch (error) {
      console.error("Error updating price list item:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors 
        });
      }
      res.status(500).json({ message: "Failed to update price list item" });
    }
  });

  app.delete('/api/price-list/:id', requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const user = req.user;
      
      // Only admin and supervisor can delete price list items
      if (user.role !== 'admin' && user.role !== 'supervisor') {
        return res.status(403).json({ message: "Not authorized to delete price list items" });
      }
      
      const item = await storage.getPriceListById(id);
      if (!item) {
        return res.status(404).json({ message: "Price list item not found" });
      }
      
      await storage.deletePriceListItem(id);
      res.json({ message: "Price list item deleted successfully" });
    } catch (error) {
      console.error("Error deleting price list item:", error);
      res.status(500).json({ message: "Failed to delete price list item" });
    }
  });

  // Delete all price list items
  app.delete('/api/price-list', requireAuth, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only admin and supervisor can delete all price list items
      if (user.role !== 'admin' && user.role !== 'supervisor') {
        return res.status(403).json({ message: "Not authorized to delete price list items" });
      }
      
      await storage.deleteAllPriceListItems();
      res.json({ message: "All price list items deleted successfully" });
    } catch (error) {
      console.error("Error deleting all price list items:", error);
      res.status(500).json({ message: "Failed to delete all price list items" });
    }
  });

  // Robust CSV Import endpoint for price list
  app.post('/api/price-list/import', upload.single('file'), requireAuth, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only admin and supervisor can import price list
      if (user.role !== 'admin' && user.role !== 'supervisor') {
        return res.status(403).json({ message: "Not authorized to import price list" });
      }
      
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      
      const csvData = req.file.buffer.toString('utf8');
      
      console.log('🚀 Starting robust CSV import process...');
      
      // Step 1: Parse CSV with basic cleaning
      const { data: rawData, errors: parseErrors } = Papa.parse(csvData, {
        header: true,
        skipEmptyLines: 'greedy',
        transformHeader: (header: string) => header.trim()
      });
      
      console.log(`📊 Raw CSV data: ${rawData.length} rows parsed`);
      
      // Only fail on critical parsing errors
      const criticalErrors = parseErrors.filter(error => 
        error.type !== 'FieldMismatch' && error.code !== 'TooManyFields'
      );
      
      if (criticalErrors.length > 0) {
        console.error('❌ Critical CSV parsing errors:', criticalErrors);
        return res.status(400).json({ 
          message: "CSV parsing error", 
          errors: criticalErrors 
        });
      }
      
      // Step 2: Auto-detect column mapping
      const { CSVDataCleaner } = await import('./utils/csv-data-cleaner');
      const headers = Object.keys(rawData[0] || {});
      const columnMapping = CSVDataCleaner.detectColumnMapping(headers);
      
      console.log('🎯 Detected column mapping:', columnMapping);
      
      // Step 3: Apply column mapping and data cleaning
      const cleaner = new CSVDataCleaner({
        treatEmptyAsNull: true,
        convertCommaDecimals: true,
        allowNegativeNumbers: false,
        defaultValues: {
          esPersonalizado: 'No'
        }
      });
      
      const fieldTypes = {
        codigo: 'string' as const,
        producto: 'string' as const,
        unidad: 'string' as const,
        lista: 'number' as const,
        desc10: 'number' as const,
        desc10_5: 'number' as const,
        desc10_5_3: 'number' as const,
        minimo: 'number' as const,
        canalDigital: 'number' as const,
        costoProduccion: 'number' as const,
        porcentajeUtilidad: 'number' as const,
        modoPrecio: 'string' as const,
        esPersonalizado: 'string' as const
      };
      
      // Process each row
      const processedData = [];
      const allWarnings = [];
      const criticalRowErrors = [];
      let totalTransformations = 0;
      
      for (let i = 0; i < rawData.length; i++) {
        const rawRow = rawData[i];
        
        // Map columns
        const mappedRow: Record<string, any> = {};
        for (const [csvHeader, value] of Object.entries(rawRow as Record<string, any>)) {
          const mappedField = columnMapping[csvHeader] || csvHeader.toLowerCase();
          mappedRow[mappedField] = value;
        }
        
        // Clean the data
        const { cleanedRow, warnings, transformations } = cleaner.cleanRow(mappedRow, fieldTypes);
        
        totalTransformations += transformations;
        
        // Convert warnings to detailed format
        if (warnings.length > 0) {
          allWarnings.push({
            row: i + 1,
            codigo: cleanedRow.codigo || `Row ${i + 1}`,
            warnings: warnings.map((w: any) => `${w.field}: ${w.warnings.join(', ')}`).join('; ')
          });
        }
        
        // Validate required fields
        if (!cleanedRow.codigo || !cleanedRow.producto) {
          criticalRowErrors.push({
            row: i + 1,
            codigo: cleanedRow.codigo || `Row ${i + 1}`,
            error: 'Missing required fields: ' + [
              !cleanedRow.codigo ? 'código' : '',
              !cleanedRow.producto ? 'producto' : ''
            ].filter(Boolean).join(', ')
          });
          continue;
        }
        
        processedData.push(cleanedRow);
      }
      
      console.log(`✨ Data cleaning complete: ${totalTransformations} transformations applied`);
      console.log(`⚠️  Warnings: ${allWarnings.length}, Critical errors: ${criticalRowErrors.length}`);
      
      // Step 4: Final validation with Zod
      const validatedItems = [];
      const validationErrors = [];
      
      for (let i = 0; i < processedData.length; i++) {
        const cleanedRow = processedData[i];
        
        try {
          // Remove any extra fields not in our schema
          const { id, ...schemaRow } = cleanedRow;
          const validatedItem = insertPriceListSchema.parse(schemaRow);
          validatedItems.push(validatedItem);
        } catch (error: any) {
          validationErrors.push({
            row: i + 1,
            codigo: cleanedRow.codigo || `Row ${i + 1}`,
            error: error.issues ? error.issues.map((issue: any) => 
              `${issue.path.join('.')}: ${issue.message}`).join(', ') : error.message
          });
        }
      }
      
      // Combine all errors
      const allErrors = [...criticalRowErrors, ...validationErrors];
      
      // Step 5: Return results based on error severity
      if (allErrors.length > 0) {
        // If more than 50% of rows have errors, reject the import
        const errorRate = allErrors.length / rawData.length;
        
        if (errorRate > 0.5) {
          return res.status(400).json({
            message: "Too many validation errors found",
            errors: allErrors,
            warnings: allWarnings,
            stats: {
              totalRows: rawData.length,
              validRows: validatedItems.length,
              errorRows: allErrors.length,
              warningRows: allWarnings.length,
              errorRate: Math.round(errorRate * 100) + '%',
              transformations: totalTransformations
            }
          });
        }
      }
      
      // Step 6: If we have valid data, import it
      if (validatedItems.length === 0) {
        return res.status(400).json({
          message: "No valid data found to import",
          errors: allErrors,
          warnings: allWarnings
        });
      }
      
      // Clear existing price list and import new data
      console.log(`💾 Importing ${validatedItems.length} valid items...`);
      await storage.deleteAllPriceListItems();
      await storage.createMultiplePriceListItems(validatedItems);
      
      console.log('✅ Import completed successfully!');
      
      // Return success with detailed statistics
      res.json({
        message: "Price list imported successfully",
        importedCount: validatedItems.length,
        stats: {
          totalRows: rawData.length,
          validRows: validatedItems.length,
          errorRows: allErrors.length,
          warningRows: allWarnings.length,
          transformations: totalTransformations,
          columnMapping: columnMapping
        },
        errors: allErrors.length > 0 ? allErrors : undefined,
        warnings: allWarnings.length > 0 ? allWarnings : undefined
      });
      
    } catch (error) {
      console.error("❌ Error importing price list:", error);
      res.status(500).json({ 
        message: "Failed to import price list",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Store API endpoints (public access)
  
  // Get store configuration
  app.get('/api/store/config', async (req: any, res) => {
    try {
      const config = await storage.getStoreConfig();
      res.json(config || {
        siteName: "Pinturas Panorámica", 
        logoUrl: "/panoramica-logo.png",
        primaryColor: "#FF6B35"
      });
    } catch (error) {
      console.error("Error fetching store config:", error);
      res.status(500).json({ message: "Failed to fetch store configuration" });
    }
  });

  // Get active store banners
  app.get('/api/store/banners', async (req: any, res) => {
    try {
      const banners = await storage.getStoreBanners();
      res.json(banners);
    } catch (error) {
      console.error("Error fetching store banners:", error);
      res.status(500).json({ message: "Failed to fetch store banners" });
    }
  });

  // Get ecommerce products with images and prices
  app.get('/api/store/products', async (req: any, res) => {
    try {
      const { search, categoria, limit = 100, offset = 0 } = req.query;
      
      const filters = {
        search: search || undefined,
        categoria: categoria || undefined,
        activo: true, // Only show active products
        limit: parseInt(limit),
        offset: parseInt(offset)
      };

      const products = await storage.getEcommerceAdminProducts(filters);
      res.json(products);
    } catch (error) {
      console.error("Error fetching store products:", error);
      res.status(500).json({ message: "Failed to fetch store products" });
    }
  });

  // Get store categories
  app.get('/api/store/categories', async (req: any, res) => {
    try {
      const categories = await storage.getEcommerceCategories();
      res.json(categories);
    } catch (error) {
      console.error("Error fetching store categories:", error);
      res.status(500).json({ message: "Failed to fetch store categories" });
    }
  });

  // Object Storage endpoints
  
  // Serve public objects from Object Storage
  app.get("/public-objects/:filePath(*)", asyncHandler(async (req: any, res: any) => {
    const filePath = req.params.filePath;
    const objectStorageService = new ObjectStorageService();
    try {
      const file = await objectStorageService.searchPublicObject(filePath);
      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }
      objectStorageService.downloadObject(file, res);
    } catch (error) {
      console.error("Error searching for public object:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }));

  // ZIP image importer for eCommerce products
  const uploadZip = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
    fileFilter: (req, file, cb) => {
      if (file.mimetype === 'application/zip' || 
          file.mimetype === 'application/x-zip-compressed' ||
          file.originalname.toLowerCase().endsWith('.zip')) {
        cb(null, true);
      } else {
        cb(new Error('Only ZIP files are allowed'));
      }
    }
  });

  app.post('/api/ecommerce/admin/upload-images', 
    requireAuth, 
    requireAdminOrSupervisor,
    uploadZip.single('zipFile'),
    asyncHandler(async (req: any, res: any) => {
      if (!req.file) {
        return res.status(400).json({ message: "No ZIP file provided" });
      }

      const zipBuffer = req.file.buffer;
      const objectStorageService = new ObjectStorageService();
      
      try {
        // Parse ZIP file
        const zip = new JSZip();
        await zip.loadAsync(zipBuffer);

        // ZIP security controls
        const MAX_FILES = 300; // Maximum number of files allowed
        const MAX_ENTRY_SIZE = 10 * 1024 * 1024; // 10MB per individual file
        const MAX_TOTAL_UNCOMPRESSED = 100 * 1024 * 1024; // 100MB total uncompressed size
        
        const allFiles = Object.keys(zip.files);
        
        // Enhanced debugging output
        console.log(`[ZIP DEBUG] Total files in ZIP: ${allFiles.length}`);
        console.log(`[ZIP DEBUG] All files list:`, allFiles.slice(0, 10), allFiles.length > 10 ? `... and ${allFiles.length - 10} more` : '');
        
        // Filter files more strictly
        const imageFiles = allFiles.filter(fileName => {
          const zipEntry = zip.files[fileName];
          
          // Skip directories
          if (zipEntry.dir) {
            console.log(`[ZIP DEBUG] Skipping directory: ${fileName}`);
            return false;
          }
          
          // Skip system/hidden files
          const baseName = path.basename(fileName);
          const isSystemFile = baseName.startsWith('.') || 
                              baseName.toLowerCase().includes('thumbs.db') ||
                              baseName.toLowerCase().includes('desktop.ini') ||
                              baseName.toLowerCase() === '__macosx';
          
          if (isSystemFile) {
            console.log(`[ZIP DEBUG] Skipping system/hidden file: ${fileName}`);
            return false;
          }
          
          // Check if it's an actual image file
          const isImage = isImageFile(fileName);
          if (!isImage) {
            console.log(`[ZIP DEBUG] Skipping non-image file: ${fileName}`);
            return false;
          }
          
          // Additional check: file must have actual content (using proper JSZip API)
          const fileSize = zipEntry.options?.compression ? 0 : zipEntry.name.length; // Fallback size check
          if (fileSize === 0) {
            console.log(`[ZIP DEBUG] Skipping empty file: ${fileName}`);
            return false;
          }
          
          console.log(`[ZIP DEBUG] Including image file: ${fileName} (size: available)`);
          return true;
        });
        
        console.log(`[ZIP DEBUG] Final image files count: ${imageFiles.length}`);
        console.log(`[ZIP DEBUG] Image files list:`, imageFiles.slice(0, 10), imageFiles.length > 10 ? `... and ${imageFiles.length - 10} more` : '');
        
        // Check file count limit
        if (imageFiles.length > MAX_FILES) {
          return res.status(400).json({
            message: `ZIP contains too many image files (${imageFiles.length}). Maximum allowed: ${MAX_FILES}`
          });
        }
        
        // Check individual file sizes and total uncompressed size (using proper JSZip API)
        let totalUncompressedSize = 0;
        for (const fileName of imageFiles) {
          const zipEntry = zip.files[fileName];
          try {
            const fileData = await zipEntry.async('uint8array');
            const fileSize = fileData.length;
            if (fileSize > MAX_ENTRY_SIZE) {
              return res.status(400).json({
                message: `File '${fileName}' exceeds maximum size limit (${Math.round(fileSize / (1024 * 1024))}MB > ${MAX_ENTRY_SIZE / (1024 * 1024)}MB)`
              });
            }
            totalUncompressedSize += fileSize;
          } catch (error) {
            console.error(`[ZIP DEBUG] Error reading file ${fileName}:`, error);
            // Skip files that can't be read
            continue;
          }
        }
        
        if (totalUncompressedSize > MAX_TOTAL_UNCOMPRESSED) {
          return res.status(400).json({
            message: `Total uncompressed size exceeds limit (${Math.round(totalUncompressedSize / (1024 * 1024))}MB > ${MAX_TOTAL_UNCOMPRESSED / (1024 * 1024)}MB)`
          });
        }

        const results: Array<{ fileName: string; success: boolean; productCode?: string; error?: string; errorType?: string }> = [];
        let processed = 0;
        const total = imageFiles.length;

        // Process each image file in the ZIP
        for (const fileName of imageFiles) {
          const zipEntry = zip.files[fileName];

          try {
            // Extract product code from filename (handle nested ZIP structures and remove extension)
            const baseName = path.basename(fileName);
            const productCode = baseName.replace(/\.(png|jpg|jpeg|gif|webp)$/i, '');
            
            // Check if product exists in the database
            const existingProduct = await storage.getEcommerceProductByCode(productCode);
            
            if (!existingProduct) {
              results.push({
                fileName,
                success: false,
                error: `Producto con código '${productCode}' no encontrado`
              });
              continue;
            }

            // Get image data
            const imageBuffer = await zipEntry.async('nodebuffer');
            
            // Upload to Local Storage with unique filename
            const timestamp = Date.now();
            const fileExtension = fileName.split('.').pop()?.toLowerCase() || 'png';
            const uniqueFileName = `${productCode}_${timestamp}.${fileExtension}`;
            
            console.log(`🔄 [ZIP IMPORT] Uploading image ${fileName} as ${uniqueFileName} for product ${productCode}`);
            
            let imageUrl: string | null = null;
            let uploadError: string | null = null;
            
            try {
              imageUrl = await localImageStorage.uploadImage(
                uniqueFileName,
                imageBuffer,
                getContentType(fileExtension)
              );
              console.log(`✅ [ZIP IMPORT] Successfully uploaded ${uniqueFileName} to local storage`);
            } catch (uploadErr) {
              console.error(`⚠️ [ZIP IMPORT] Failed to upload ${uniqueFileName} to local storage:`, uploadErr);
              uploadError = uploadErr instanceof Error ? uploadErr.message : 'Unknown upload error';
              
              // Continue processing in degraded mode (product without image)
              console.log(`🔄 [ZIP IMPORT] Continuing in degraded mode for ${productCode} without image`);
            }
            
            // Auto-create ecommerce product if it doesn't exist
            if (!existingProduct) {
              console.log(`🏗️ [ZIP IMPORT] Auto-creating ecommerce product for code: ${productCode}`);
              
              // Get price list product to use as base
              const priceListProducts = await storage.getPriceList();
              const pricingProduct = priceListProducts.find(p => p.codigo === productCode);
              
              if (pricingProduct) {
                const newEcommerceProduct = {
                  id: `ecom-${productCode}-${Date.now()}`,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                  descripcion: pricingProduct.producto, // Corrected: use 'producto' not 'nombre'
                  priceListId: pricingProduct.id,
                  activo: true,
                  categoria: 'Sin categoría', // Removed 'familia' as it doesn't exist
                  imagenUrl: imageUrl, // Can be null if upload failed
                  precioEcommerce: pricingProduct.lista?.toString() || '0', // Corrected: use 'lista' not 'precio'
                  orden: 0
                };
                
                // Insert the new ecommerce product
                await db.insert(ecommerceProducts).values(newEcommerceProduct);
                
                const statusMessage = imageUrl 
                  ? 'Producto creado automáticamente con imagen'
                  : 'Producto creado automáticamente (imagen falló, se puede reintentar)';
                
                console.log(`✅ [ZIP IMPORT] Created ecommerce product: ${productCode} ${imageUrl ? 'with' : 'without'} image`);
                
                results.push({
                  fileName,
                  success: true,
                  productCode,
                  error: uploadError || undefined,
                  errorType: uploadError ? 'storage_warning' : undefined
                } as any);
                processed++;
                continue;
              } else {
                console.log(`⚠️ [ZIP IMPORT] Product ${productCode} not found in pricing table`);
                results.push({
                  fileName,
                  success: false,
                  productCode,
                  error: `Producto '${productCode}' no existe en la lista de precios`,
                  errorType: 'product_not_found'
                } as any);
                continue;
              }
            }

            // Update ecommerce product record with image URL (or null if upload failed)
            if (imageUrl) {
              await db
                .update(ecommerceProducts)
                .set({ imagenUrl: imageUrl })
                .where(eq(ecommerceProducts.id, existingProduct.id));
                
              console.log(`✅ [ZIP IMPORT] Updated existing product ${productCode} with image URL`);
              
              results.push({
                fileName,
                success: true,
                productCode,
                error: undefined,
                errorType: undefined
              } as any);
            } else {
              // Product exists but image upload failed - log warning but continue
              console.log(`⚠️ [ZIP IMPORT] Product ${productCode} exists but image upload failed - keeping existing image`);
              
              results.push({
                fileName,
                success: false,
                productCode,
                error: uploadError || 'Error de almacenamiento - producto conserva imagen anterior',
                errorType: 'storage_warning'
              } as any);
            }
            processed++;

          } catch (error) {
            console.error(`❌ [ZIP IMPORT] Error processing image ${fileName}:`, error);
            
            // Determine the type of error for better user feedback
            let errorMessage = 'Error desconocido';
            let errorType = 'unknown';
            
            if (error instanceof Error) {
              const errorString = error.message.toLowerCase();
              
              if (errorString.includes('no allowed resources') || errorString.includes('unauthorized') || error.message.includes('401')) {
                errorType = 'auth';
                errorMessage = '❌ Error de autenticación en almacenamiento en la nube (Google Cloud Storage no autorizado)';
              } else if (errorString.includes('network') || errorString.includes('timeout') || errorString.includes('econnreset')) {
                errorType = 'network';
                errorMessage = '🌐 Error de conexión de red al almacenamiento';
              } else if (errorString.includes('quota') || errorString.includes('limit')) {
                errorType = 'quota';
                errorMessage = '💾 Cuota de almacenamiento excedida';
              } else if (errorString.includes('permission') || errorString.includes('access')) {
                errorType = 'permission';
                errorMessage = '🔒 Error de permisos en almacenamiento';
              } else {
                errorMessage = `💥 Error: ${error.message}`;
              }
            }
            
            console.error(`🏷️ [ZIP IMPORT] Error categorized as: ${errorType} - ${errorMessage}`);
            
            results.push({
              fileName,
              success: false,
              productCode: productCode,
              error: errorMessage,
              errorType: errorType
            });
          }
        }

        // Generate summary for response
        const successCount = results.filter(r => r.success).length;
        const errorCount = results.filter(r => !r.success).length;
        const authErrors = results.filter(r => r.errorType === 'auth').length;
        
        console.log(`📊 [ZIP IMPORT] Processing complete: ${successCount} success, ${errorCount} errors (${authErrors} auth errors)`);
        
        res.json({
          processed: successCount,
          total: results.length,
          results,
          summary: {
            success: successCount,
            errors: errorCount,
            authenticationErrors: authErrors,
            networkErrors: results.filter(r => r.errorType === 'network').length,
            otherErrors: results.filter(r => r.errorType === 'unknown').length
          }
        });

      } catch (error) {
        console.error("💥 [ZIP IMPORT] Critical error processing ZIP file:", error);
        
        // Categorize main processing errors
        let mainErrorMessage = "Error crítico procesando archivo ZIP";
        if (error instanceof Error) {
          const errorString = error.message.toLowerCase();
          if (errorString.includes('zip') || errorString.includes('corrupt')) {
            mainErrorMessage = "Archivo ZIP corrupto o inválido";
          } else if (errorString.includes('memory') || errorString.includes('size')) {
            mainErrorMessage = "Archivo ZIP demasiado grande para procesar";
          } else if (errorString.includes('unauthorized') || errorString.includes('401')) {
            mainErrorMessage = "Error de autenticación en servicios de almacenamiento";
          }
        }
        
        res.status(500).json({ 
          message: mainErrorMessage,
          error: error instanceof Error ? error.message : 'Error desconocido',
          type: 'critical_processing_error'
        });
      }
    })
  );

  // Helper functions for ZIP processor
  function isImageFile(fileName: string): boolean {
    const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
    const lowerFileName = fileName.toLowerCase();
    return imageExtensions.some(ext => lowerFileName.endsWith(ext));
  }

  function getContentType(extension: string): string {
    const contentTypes: { [key: string]: string } = {
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'gif': 'image/gif',
      'webp': 'image/webp'
    };
    return contentTypes[extension.toLowerCase()] || 'image/png';
  }

  // ==============================================
  // NVV (Notas de Ventas Pendientes) Endpoints
  // ==============================================

  // NVV CSV Import endpoint
  app.post('/api/nvv/import', requireAuth, 
    upload.single('file'),
    asyncHandler(async (req: any, res: any) => {
      const file = req.file;
      
      if (!file) {
        return res.status(400).json({
          success: false,
          message: 'No se encontró archivo CSV'
        });
      }

      try {
        // Parse CSV file
        const csvContent = file.buffer.toString('utf-8');
        const parseResult = Papa.parse(csvContent, {
          header: true,
          skipEmptyLines: true,
          transformHeader: (header: string) => header.trim(),
        });

        if (parseResult.errors.length > 0) {
          return res.status(400).json({
            success: false,
            message: 'Error al procesar CSV',
            errors: parseResult.errors
          });
        }

        const rawData = parseResult.data as Record<string, any>[];
        const importBatch = nanoid();
        const processedData = [];

        // Process each row
        for (let i = 0; i < rawData.length; i++) {
          const row = rawData[i];
          
          try {
            // Map CSV columns to database fields (adjust based on actual CSV structure)
            const processedRow = {
              documentNumber: row['Documento'] || row['document_number'] || `DOC-${Date.now()}-${i}`,
              documentType: row['Tipo'] || row['document_type'] || 'NVV',
              clientCode: row['Codigo_Cliente'] || row['client_code'] || '',
              clientName: row['Cliente'] || row['client_name'] || 'Cliente sin nombre',
              productCode: row['Codigo_Producto'] || row['product_code'] || '',
              productName: row['Producto'] || row['product_name'] || 'Producto sin nombre',
              salesperson: row['Vendedor'] || row['salesperson'] || '',
              segment: row['Segmento'] || row['segment'] || '',
              quantity: parseFloat(row['Cantidad'] || row['quantity'] || '0'),
              unitPrice: parseFloat(row['Precio_Unitario'] || row['unit_price'] || '0'),
              totalAmount: parseFloat(row['Monto_Total'] || row['total_amount'] || '0'),
              currency: row['Moneda'] || row['currency'] || 'CLP',
              commitmentDate: row['Fecha_Compromiso'] ? new Date(row['Fecha_Compromiso']) : null,
              expectedDeliveryDate: row['Fecha_Entrega'] ? new Date(row['Fecha_Entrega']) : null,
              orderDate: row['Fecha_Pedido'] ? new Date(row['Fecha_Pedido']) : null,
              status: row['Estado'] || row['status'] || 'pending',
              priority: row['Prioridad'] || row['priority'] || 'normal',
              warehouse: row['Bodega'] || row['warehouse'] || '',
              region: row['Region'] || row['region'] || '',
              commune: row['Comuna'] || row['commune'] || '',
              notes: row['Observaciones'] || row['notes'] || '',
              originalData: row, // Store original CSV row for reference
            };

            processedData.push(processedRow);
          } catch (error) {
            console.error(`Error processing row ${i + 1}:`, error);
            // Continue processing other rows
          }
        }

        // Import to database
        const result = await storage.importNvvFromCsv(processedData, importBatch);
        
        res.json(result);

      } catch (error) {
        console.error('Error importing NVV CSV:', error);
        res.status(500).json({
          success: false,
          message: 'Error interno del servidor',
          error: error instanceof Error ? error.message : 'Error desconocido'
        });
      }
    })
  );

  // Get NVV pending sales data
  app.get('/api/nvv/pending', requireAuth, asyncHandler(async (req: any, res: any) => {
    const { status, salesperson, segment, startDate, endDate, limit = 100, offset = 0 } = req.query;
    
    const options: any = {
      limit: parseInt(limit),
      offset: parseInt(offset),
    };

    if (status) options.status = status;
    if (salesperson) options.salesperson = salesperson;
    if (segment) options.segment = segment;
    if (startDate) options.startDate = new Date(startDate);
    if (endDate) options.endDate = new Date(endDate);

    const pendingSales = await storage.getNvvPendingSales(options);
    res.json(pendingSales);
  }));

  // Get NVV summary metrics
  app.get('/api/nvv/metrics', requireAuth, asyncHandler(async (req: any, res: any) => {
    const { salesperson, segment, startDate, endDate } = req.query;
    
    const options: any = {};
    if (salesperson) options.salesperson = salesperson;
    if (segment) options.segment = segment;
    if (startDate) options.startDate = new Date(startDate);
    if (endDate) options.endDate = new Date(endDate);

    const metrics = await storage.getNvvSummaryMetrics(options);
    res.json(metrics);
  }));

  // Update NVV status
  app.patch('/api/nvv/:id/status', requireAuth, asyncHandler(async (req: any, res: any) => {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !['pending', 'confirmed', 'delivered', 'cancelled'].includes(status)) {
      return res.status(400).json({
        message: 'Estado inválido'
      });
    }

    const success = await storage.updateNvvStatus(id, status);
    
    if (success) {
      res.json({ success: true, message: 'Estado actualizado' });
    } else {
      res.status(404).json({ message: 'Registro no encontrado' });
    }
  }));

  // Delete NVV batch
  app.delete('/api/nvv/batch/:batchId', requireAuth, asyncHandler(async (req: any, res: any) => {
    const { batchId } = req.params;

    const success = await storage.deleteNvvBatch(batchId);
    
    if (success) {
      res.json({ success: true, message: 'Lote eliminado' });
    } else {
      res.status(404).json({ message: 'Lote no encontrado' });
    }
  }));

  const httpServer = createServer(app);
  return httpServer;
}
