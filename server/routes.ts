import type { Express } from "express";
import { createServer, type Server } from "http";
import path from "path";
import { storage } from "./storage";
import { setupAuth, requireAuth, requireAdminOrSupervisor, requireRoles } from "./auth";
// import { setupAuth as setupReplitAuth } from "./replitAuth"; // Disabled - conflicts with email/password auth
import multer from "multer";
import Papa from "papaparse";
import { nanoid } from "nanoid";
import { checkDbHealth } from "./db";
import JSZip from "jszip";
import unzipper from "unzipper";
import { Readable } from "stream";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { comunaRegionService } from "./comunaRegionService";
import { db } from "./db";
import { 
  ecommerceProducts, 
  salesTransactions, 
  fileUploads, 
  productosEvaluados, 
  evaluacionesTecnicas, 
  insertClientSchema, 
  insertGastoEmpresarialSchema, 
  insertPromesaCompraSchema, 
  insertHitoMarketingSchema, 
  nvvPendingSales, 
  factVentas,
  // CMMS validation schemas
  insertEquipoCriticoSchema,
  insertProveedorMantencionSchema,
  insertPresupuestoMantencionSchema,
  insertGastoMaterialMantencionSchema,
  insertPlanPreventivoSchema
} from "../shared/schema";
import { eq, and, isNotNull, ne, sql, desc, or } from "drizzle-orm";
import { emailService } from "./services/email";
import { executeIncrementalETL, getETLStatus, updateETLConfig, etlProgressEmitter } from "./etl-incremental";
import * as NotifyHelper from "./notifications-helper";

// Date parsing utility function - handles DD/MM/YYYY and DD-MM-YYYY formats
function parseDate(value: any): string | null {
  if (!value || value.toString().trim() === '') return null;
  
  try {
    const dateStr = value.toString().trim();
    let parts: string[];
    
    // Handle different separators
    if (dateStr.includes('/')) {
      parts = dateStr.split('/');
    } else if (dateStr.includes('-')) {
      parts = dateStr.split('-');
    } else {
      return null;
    }
    
    if (parts.length !== 3) return null;
    
    // Parse numbers
    const day = parseInt(parts[0]);
    const month = parseInt(parts[1]); 
    const year = parseInt(parts[2]);
    
    // Validate ranges
    if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
    if (day < 1 || day > 31) return null;
    if (month < 1 || month > 12) return null;
    if (year < 1900 || year > 2100) return null; // Reasonable year range
    
    // Format as YYYY-MM-DD
    const formattedMonth = month.toString().padStart(2, '0');
    const formattedDay = day.toString().padStart(2, '0');
    return `${year}-${formattedMonth}-${formattedDay}`;
    
  } catch (e) {
    console.warn('Error parsing date:', value, e);
    return null;
  }
}

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
      // Handle special month values
      if (period === 'current-month') {
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();
        startDate = new Date(currentYear, currentMonth, 1);
        // For current-month, use today as the end date (not the last day of month)
        endDate = new Date(currentYear, currentMonth, now.getDate());
      } else if (period === 'last-month') {
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();
        startDate = new Date(currentYear, currentMonth - 1, 1);
        endDate = new Date(currentYear, currentMonth, 0);
      } else if (period.includes('-')) {
        // period format: "2025-09" 
        const [year, month] = period.split('-');
        const periodYear = parseInt(year);
        const periodMonth = parseInt(month) - 1; // 0-indexed
        
        startDate = new Date(periodYear, periodMonth, 1);
        
        // Check if this is the current month
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();
        
        if (periodYear === currentYear && periodMonth === currentMonth) {
          // If it's the current month, use today as the end date
          endDate = new Date(currentYear, currentMonth, now.getDate());
        } else {
          // If it's a past month, use the last day of that month
          endDate = new Date(periodYear, periodMonth + 1, 0);
        }
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

import { insertSalesTransactionSchema, insertGoalSchema, insertSalespersonUserSchema, insertProductSchema, insertProductStockSchema, insertTaskSchema, insertTaskAssignmentSchema, insertOrderSchema, insertOrderItemSchema, addOrderItemSchema, updateOrderItemByIdSchema, insertPriceListSchema, insertQuoteSchema, insertQuoteItemSchema, InsertTask, insertSolicitudMantencionSchema, insertMantencionPhotoSchema, insertCrmLeadSchema, insertCrmCommentSchema, insertNotificationSchema, insertApiKeySchema, insertProyeccionVentaSchema, insertMantencionPlanificadaSchema } from "@shared/schema";
import { z } from "zod";
import bcrypt from "bcryptjs";
import externalApiRouter from './routes-external';
import { nanoid } from 'nanoid';

export function registerRoutes(app: Express): Server {
  // Setup email/password auth system (primary)
  setupAuth(app);

  // Note: Replit OIDC auth disabled to avoid conflicts - using email/password auth only
  
  // Mount external API routes (with API key auth)
  app.use('/api/external', externalApiRouter);

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
      
      // Calculate previous year dates - exactly same period but one year before (year-over-year comparison)
      const currentStart = new Date(currentStartDate!);
      const currentEnd = new Date(currentEndDate!);
      
      // Clone the dates and move them back by exactly one year
      const previousStart = new Date(currentStart);
      const previousEnd = new Date(currentEnd);
      
      // Move to same period in previous year (year-over-year)
      previousStart.setFullYear(previousStart.getFullYear() - 1);
      previousEnd.setFullYear(previousEnd.getFullYear() - 1);
      
      // Handle edge case for Feb 29 in leap years
      if (currentStart.getMonth() === 1 && currentStart.getDate() === 29) {
        // If current is Feb 29 and previous year is not a leap year, use Feb 28
        if (previousStart.getMonth() !== 1) {
          previousStart.setMonth(1, 28);
        }
      }
      if (currentEnd.getMonth() === 1 && currentEnd.getDate() === 29) {
        // If current is Feb 29 and previous year is not a leap year, use Feb 28
        if (previousEnd.getMonth() !== 1) {
          previousEnd.setMonth(1, 28);
        }
      }
      
      const previousStartFormatted = formatDateLocal(previousStart);
      const previousEndFormatted = formatDateLocal(previousEnd);
      
      console.log(`[DEBUG] Periodo actual: ${currentStartDate} a ${currentEndDate}`);
      console.log(`[DEBUG] Periodo año anterior: ${previousStartFormatted} a ${previousEndFormatted}`);
      
      // Get current period metrics
      const metrics = await storage.getSalesMetrics({
        startDate: currentStartDate,
        endDate: currentEndDate,
        salesperson: salesperson as string,
        segment: segment as string,
        client: client as string,
        supplier: supplier as string,
      });
      
      // Get previous year metrics for comparison (same period in previous year - year-over-year)
      const previousMetrics = await storage.getSalesMetrics({
        startDate: previousStartFormatted,
        endDate: previousEndFormatted,
        salesperson: salesperson as string,
        segment: segment as string,
        client: client as string,
        supplier: supplier as string,
      });
      
      console.log(`[DEBUG] Métricas actuales: Ventas=${metrics.totalSales}, Transacciones=${metrics.totalTransactions}`);
      console.log(`[DEBUG] Métricas año anterior: Ventas=${previousMetrics.totalSales}, Transacciones=${previousMetrics.totalTransactions}`);
      
      // Add previous year data for comparison (year-over-year) - only include if there's actual transaction data
      // This ensures we show "Sin datos previos" when there were no transactions in the previous year period
      const metricsWithComparison = {
        ...metrics,
        previousMonthSales: previousMetrics.totalTransactions > 0 ? previousMetrics.totalSales : undefined,
        previousMonthTransactions: previousMetrics.totalTransactions > 0 ? previousMetrics.totalTransactions : undefined,
        previousMonthOrders: previousMetrics.totalOrders > 0 ? previousMetrics.totalOrders : undefined,
        previousMonthUnits: previousMetrics.totalTransactions > 0 ? previousMetrics.totalUnits : undefined,
        previousMonthCustomers: previousMetrics.totalTransactions > 0 ? previousMetrics.activeCustomers : undefined,
        previousMonthGdvSales: previousMetrics.totalTransactions > 0 ? previousMetrics.gdvSales : undefined,
      };
      
      console.log(`[DEBUG] Datos enviados al frontend:`, JSON.stringify(metricsWithComparison, null, 2));
      
      res.json(metricsWithComparison);
    } catch (error) {
      console.error("Error fetching sales metrics:", error);
      res.status(500).json({ message: "Failed to fetch sales metrics" });
    }
  });

  // Available periods endpoint - returns months and years with actual data
  app.get('/api/sales/available-periods', requireAuth, async (req, res) => {
    try {
      const periods = await storage.getAvailablePeriods();
      res.json(periods);
    } catch (error) {
      console.error("Error fetching available periods:", error);
      res.status(500).json({ message: "Failed to fetch available periods" });
    }
  });

  // Yearly totals endpoint - returns current and previous year totals
  app.get('/api/sales/yearly-totals', requireAuth, async (req, res) => {
    try {
      const currentYear = new Date().getFullYear();
      const totals = await storage.getYearlyTotals(currentYear);
      res.json(totals);
    } catch (error) {
      console.error("Error fetching yearly totals:", error);
      res.status(500).json({ message: "Failed to fetch yearly totals" });
    }
  });

  // Best year historical endpoint - returns the best year and its total
  app.get('/api/sales/best-year', requireAuth, async (req, res) => {
    try {
      const bestYear = await storage.getBestYearHistorical();
      res.json(bestYear);
    } catch (error) {
      console.error("Error fetching best year:", error);
      res.status(500).json({ message: "Failed to fetch best year" });
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

      // Obtener todos los clientes únicos que ha atendido el vendedor en el período
      const clientsData = await storage.getSalespersonClients(salespersonName, period as string, filterType as string);
      const clientCount = Array.isArray(clientsData) ? clientsData.length : 0;

      // Obtener días desde la última venta REAL (sin filtros de período)
      const allTimeDetails = await storage.getSalespersonDetails(salespersonName);
      const daysSinceLastSale = allTimeDetails.daysSinceLastSale || 0;

      // Calcular productividad (transacciones por cliente)
      const productivity = clientCount > 0 ? (metrics.totalTransactions || 0) / clientCount : 0;

      // Datos específicos del vendedor
      const dashboardData = {
        totalSales: metrics.totalSales || 0,
        transactions: metrics.totalTransactions || 0, 
        avgTicket: (metrics.totalSales / (metrics.totalTransactions || 1)) || 0,
        topProducts: [], // Se obtiene por separado
        recentSales: transactions || [],
        clientCount: clientCount,
        daysSinceLastSale: daysSinceLastSale,
        productivity: Number(productivity.toFixed(1))
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
      
      // Convert "current-month" to actual period (e.g., "2025-10")
      let actualPeriod = period as string;
      if (period === 'current-month') {
        const now = new Date();
        actualPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      } else if (period === 'last-month') {
        const now = new Date();
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        actualPeriod = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`;
      }
      
      // Filter goals by period if specified
      const filteredGoals = period 
        ? goals.filter(goal => goal.period === actualPeriod)
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
      
      // Get both clients and total count in parallel for better performance
      const [clients, totalCount] = await Promise.all([
        storage.getClients(filters),
        storage.getClientsCount(filters)
      ]);
      
      res.json({
        clients,
        totalCount,
        currentPage: Math.floor((filters.offset || 0) / (filters.limit || 50)) + 1,
        totalPages: Math.ceil(totalCount / (filters.limit || 50))
      });
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

  // Get client data by user ID - for authenticated clients
  app.get('/api/clients/by-user/:userId', requireAuth, async (req, res) => {
    try {
      const { userId } = req.params;
      
      const client = await storage.getClientByUserId(userId);
      
      if (!client) {
        return res.status(404).json({ message: 'Cliente no encontrado' });
      }
      
      res.json(client);
    } catch (error) {
      console.error('Error al obtener datos del cliente:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  });

  // Get simple client list (lightweight, no metrics) - for dropdowns and basic lists
  app.get('/api/clients/simple', requireAuth, async (req, res) => {
    try {
      const clients = await storage.getSimpleClients();
      res.json(clients);
    } catch (error) {
      console.error('Error al obtener lista simple de clientes:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  });

  // Search clients by name (AJAX search with query parameter)
  app.get('/api/clients/search', requireAuth, async (req, res) => {
    try {
      const { q } = req.query;
      const searchTerm = typeof q === 'string' ? q.trim() : '';
      
      if (!searchTerm || searchTerm.length < 3) {
        return res.json([]);
      }
      
      const clients = await storage.searchClientsByName(searchTerm);
      res.json(clients);
    } catch (error) {
      console.error('Error al buscar clientes:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  });

  // Create new client manually
  app.post('/api/clients', requireAuth, async (req, res) => {
    try {
      const validatedData = insertClientSchema.parse(req.body);
      const newClient = await storage.insertClient(validatedData);
      res.status(201).json(newClient);
    } catch (error: any) {
      console.error('Error al crear cliente:', error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: 'Datos inválidos', details: error.errors });
      }
      if (error.code === '23505') {
        return res.status(409).json({ error: 'El código de cliente ya existe' });
      }
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

  // Clients import preview endpoint - OPTIMIZED for large files (20,000 rows x 500 columns)
  app.post('/api/clients/preview', requireAuth, upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No se ha subido ningún archivo" });
      }

      const csvContent = req.file.buffer.toString('utf-8');
      console.log(`📄 Processing CSV file: ${(csvContent.length / 1024 / 1024).toFixed(2)}MB`);
      
      // Parse CSV content with streaming support for large files
      const parsed = Papa.parse(csvContent, {
        header: true,
        skipEmptyLines: true,
        delimiter: ';', // Use semicolon for Chilean format
        dynamicTyping: false, // Keep all as strings for consistency
        transform: (value) => value?.trim() // Trim whitespace
      });

      if (parsed.errors.length > 0) {
        console.error('CSV parsing errors:', parsed.errors);
        return res.status(400).json({ 
          message: "Error parsing CSV", 
          errors: parsed.errors.slice(0, 5) // Limit error output
        });
      }

      const csvData = parsed.data as Array<any>;
      console.log(`📊 Parsed ${csvData.length} rows with ${Object.keys(csvData[0] || {}).length} columns`);
      
      if (csvData.length === 0) {
        return res.status(400).json({ message: "El archivo CSV está vacío" });
      }

      // For large files, optimize duplicate checking with SIMPLE lookup
      console.log('🔍 Performing fast duplicate analysis...');
      const analysisStart = Date.now();
      
      // Simple approach: just estimate duplicates without full lookup for preview
      const existingKoens = new Set();
      const existingNokoens = new Set();

      let wouldInsert = 0;
      let wouldUpdate = 0;
      
      // Process in chunks for memory efficiency on large files
      const ANALYSIS_CHUNK_SIZE = 1000;
      for (let i = 0; i < csvData.length; i += ANALYSIS_CHUNK_SIZE) {
        const chunk = csvData.slice(i, i + ANALYSIS_CHUNK_SIZE);
        
        for (const row of chunk) {
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
        
        // Progress logging for large files
        if (csvData.length > 5000 && i % 5000 === 0) {
          console.log(`📈 Analysis progress: ${i}/${csvData.length} (${((i/csvData.length)*100).toFixed(1)}%)`);
        }
      }
      
      const analysisTime = Date.now() - analysisStart;
      console.log(`⚡ Analysis completed in ${analysisTime}ms`);

      res.json({
        success: true,
        preview: {
          totalClients: csvData.length,
          existingClients: 0, // Simplified for preview
          wouldInsert: csvData.length, // All new for simplified preview
          wouldUpdate: 0,
          fileSize: `${(csvContent.length / 1024 / 1024).toFixed(2)}MB`,
          columnCount: Object.keys(csvData[0] || {}).length,
          analysisTime: `${analysisTime}ms`,
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

  // Clients import endpoint - OPTIMIZED for massive files (20,000 rows x 500 columns)
  app.post('/api/clients/import', requireAuth, upload.single('file'), async (req, res) => {
    const importStartTime = Date.now();
    
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No se ha subido ningún archivo" });
      }

      const csvContent = req.file.buffer.toString('utf-8');
      const fileSizeMB = (csvContent.length / 1024 / 1024).toFixed(2);
      console.log(`🚀 MASSIVE CLIENT IMPORT STARTED: ${fileSizeMB}MB file`);
      
      // Parse CSV content with optimizations for large files
      const parseStart = Date.now();
      const parsed = Papa.parse(csvContent, {
        header: true,
        skipEmptyLines: true,
        delimiter: ';', // Use semicolon for Chilean format
        dynamicTyping: false, // Keep all as strings for performance
        transform: (value) => value?.trim(), // Trim whitespace
        fastMode: false, // Ensure proper parsing for large files
        preview: 0 // Parse entire file
      });

      if (parsed.errors.length > 0) {
        console.error('CSV parsing errors:', parsed.errors.slice(0, 10));
        return res.status(400).json({ 
          message: "Error parsing CSV", 
          errors: parsed.errors.slice(0, 5) // Limit error output
        });
      }

      const csvData = parsed.data as Array<any>;
      const parseTime = Date.now() - parseStart;
      const columnCount = Object.keys(csvData[0] || {}).length;
      
      console.log(`📊 PARSED: ${csvData.length} rows × ${columnCount} columns in ${parseTime}ms`);
      
      if (csvData.length === 0) {
        return res.status(400).json({ message: "El archivo CSV está vacío" });
      }

      // Memory-efficient processing for large files
      const processingStart = Date.now();
      const clientsToInsert = [];
      const errors = [];
      const PROCESSING_CHUNK_SIZE = 1000; // Process 1000 rows at a time

      console.log(`⚙️  PROCESSING: ${csvData.length} rows in chunks of ${PROCESSING_CHUNK_SIZE}...`);
      
      for (let i = 0; i < csvData.length; i += PROCESSING_CHUNK_SIZE) {
        const chunk = csvData.slice(i, i + PROCESSING_CHUNK_SIZE);
        const chunkNumber = Math.floor(i / PROCESSING_CHUNK_SIZE) + 1;
        const totalChunks = Math.ceil(csvData.length / PROCESSING_CHUNK_SIZE);
        
        console.log(`📦 Processing chunk ${chunkNumber}/${totalChunks} (rows ${i + 1}-${Math.min(i + PROCESSING_CHUNK_SIZE, csvData.length)})`);
        
        for (let index = 0; index < chunk.length; index++) {
          const row = chunk[index];
          const globalIndex = i + index;
          
          try {
            // DYNAMIC COLUMN MAPPING - Support any number of columns
            const client: any = {
              nokoen: row.NOKOEN || `Cliente ${globalIndex + 1}`, // Required field
            };
            
            // Map ALL available columns dynamically
            const columnMappings = {
              // Core fields
              koen: 'KOEN',
              rten: 'RTEN', 
              idmaeen: 'IDMAEEN',
              tien: 'TIEN',
              suen: 'SUEN',
              tiposuc: 'TIPOSUC',
              sien: 'SIEN',
              gien: 'GIEN',
              
              // Location fields
              paen: 'PAEN',
              cien: 'CIEN', 
              cmen: 'CMEN',
              dien: 'DIEN',
              zoen: 'ZOEN',
              comuna: 'COMUNA',
              provincia: 'PROVINCIA',
              departame: 'DEPARTAME',
              distrito: 'DISTRITO',
              codubigeo: 'CODUBIGEO',
              urbaniz: 'URBANIZ',
              cpostal: 'CPOSTAL',
              
              // Contact fields
              foen: 'FOEN',
              faen: 'FAEN', 
              email: 'EMAIL',
              emailcomer: 'EMAILCOMER',
              cnen: 'CNEN',
              cnen2: 'CNEN2',
              
              // Credit fields (convert to strings for numeric DB fields)
              crsd: 'CRSD',
              crch: 'CRCH',
              crlt: 'CRLT',
              crpa: 'CRPA',
              crto: 'CRTO',
              cren: 'CREN',
              fevecren: 'FEVECREN',
              feultr: 'FEULTR',
              nuvecr: 'NUVECR',
              dccr: 'DCCR',
              incr: 'INCR',
              popicr: 'POPICR',
              koplcr: 'KOPLCR',
              
              // Sales fields
              kofuen: 'KOFUEN',
              lcen: 'LCEN',
              lven: 'LVEN',
              prefen: 'PREFEN',
              porprefen: 'PORPREFEN',
              
              // Status fields (convert to strings for integer DB fields)
              bloqueado: 'BLOQUEADO',
              actien: 'ACTIEN',
              habilita: 'HABILITA',
              bloqencom: 'BLOQENCOM',
              blovenex: 'BLOVENEX'
            };
            
            // Apply CORE FIELDS ONLY with strict type validation to avoid parameter limit
            for (const [dbField, csvColumn] of Object.entries(columnMappings)) {
              if (row[csvColumn] !== undefined && row[csvColumn] !== null && row[csvColumn] !== '') {
                const rawValue = row[csvColumn];
                
                // Only process core fields to limit parameters
                if (!coreClientFields.has(dbField) && !numericClientFields.has(dbField) && !integerClientFields.has(dbField)) {
                  continue; // Skip non-essential fields to reduce parameter count
                }
                
                // Apply strict type validation
                if (numericClientFields.has(dbField)) {
                  const numValue = safeNumericConvert(rawValue, dbField);
                  if (numValue !== null) {
                    (client as any)[dbField] = numValue;
                  }
                } else if (integerClientFields.has(dbField)) {
                  const intValue = safeIntegerConvert(rawValue, dbField);
                  if (intValue !== null) {
                    (client as any)[dbField] = intValue;
                  }
                } else {
                  // Text fields - safe to convert to string
                  (client as any)[dbField] = rawValue.toString().trim();
                }
              }
            }
            
            // Skip additional columns to limit parameters and avoid SQL parameter limit errors
            // Only process essential core fields for reliable import

            clientsToInsert.push(client);
          } catch (error) {
            errors.push(`Row ${globalIndex + 1}: ${error instanceof Error ? error.message : 'Invalid data'}`);
          }
        }
      }
      
      const processingTime = Date.now() - processingStart;
      console.log(`⚡ PROCESSING COMPLETED: ${clientsToInsert.length} clients ready in ${processingTime}ms`);

      if (errors.length > 0) {
        console.warn(`⚠️  Processing errors: ${errors.length}`);
        if (errors.length > clientsToInsert.length * 0.1) { // More than 10% errors
          return res.status(400).json({ 
            message: `Too many errors (${errors.length}): Import aborted`, 
            errors: errors.slice(0, 10) // Show first 10 errors
          });
        }
      }

      // MASSIVE IMPORT with optimized batch processing
      console.log(`💾 STARTING MASSIVE DATABASE IMPORT: ${clientsToInsert.length} clients...`);
      
      // 🔍 DETAILED LOGGING - Sample data inspection before import
      if (clientsToInsert.length > 0) {
        const sampleClient = clientsToInsert[0];
        console.log(`📋 SAMPLE CLIENT DATA:`, {
          fields: Object.keys(sampleClient).length,
          sample: JSON.stringify(sampleClient, null, 2).substring(0, 500) + '...',
          types: Object.entries(sampleClient).slice(0, 10).map(([key, value]) => `${key}: ${typeof value} = "${value}"`)
        });
        
        // Check for problematic values
        const problemFields = [];
        for (const [field, value] of Object.entries(sampleClient)) {
          if (value && typeof value === 'string' && /[A-Za-z]/.test(value) && field.toLowerCase().includes('cr')) {
            problemFields.push(`${field} = "${value}"`);
          }
        }
        if (problemFields.length > 0) {
          console.warn(`⚠️  POTENTIAL NUMERIC FIELD ISSUES:`, problemFields);
        }
      }
      
      const importResult = await storage.insertMultipleClientsSimple(clientsToInsert);

      const totalTime = Date.now() - importStartTime;
      console.log(`🎉 MASSIVE IMPORT COMPLETED: ${totalTime}ms total`);
      
      res.json({
        success: true,
        message: `Successfully processed ${clientsToInsert.length} clients from ${fileSizeMB}MB file`,
        ...importResult,
        performance: {
          fileSize: `${fileSizeMB}MB`,
          totalRows: csvData.length,
          totalColumns: columnCount,
          parseTime: `${parseTime}ms`,
          processingTime: `${processingTime}ms`,
          totalTime: `${totalTime}ms`,
          rowsPerSecond: Math.round(csvData.length / (totalTime / 1000))
        },
        errors: errors.length > 0 ? {
          count: errors.length,
          sample: errors.slice(0, 5)
        } : undefined
      });

    } catch (error) {
      const totalTime = Date.now() - importStartTime;
      console.error(`💥 MASSIVE IMPORT FAILED after ${totalTime}ms:`, error);
      res.status(500).json({ 
        message: 'Error interno del servidor durante importación masiva', 
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTime: `${totalTime}ms`
      });
    }
  });

  // Asignar credenciales de acceso a un cliente (crear usuario con rol client)
  app.post('/api/clients/:koen/assign-credentials', requireAuth, async (req: any, res) => {
    try {
      const { koen } = req.params;
      const user = req.user;
      
      // Solo admin y supervisor pueden asignar credenciales
      if (!['admin', 'supervisor'].includes(user.role)) {
        return res.status(403).json({ message: "No autorizado para asignar credenciales" });
      }
      
      // Validar datos con Zod
      const credentialsSchema = z.object({
        email: z.string().email("Email inválido"),
        password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
        salespersonUserId: z.string().optional(),
      });
      
      const validatedData = credentialsSchema.parse(req.body);
      
      // Obtener información del cliente
      const client = await storage.getClientByKoen(koen);
      if (!client) {
        return res.status(404).json({ message: "Cliente no encontrado" });
      }
      
      // Verificar si el cliente ya tiene un usuario asignado
      if (client.userId) {
        return res.status(400).json({ message: "Este cliente ya tiene credenciales asignadas" });
      }
      
      // Verificar si ya existe un usuario con ese email
      const existingUser = await storage.getUserByEmail(validatedData.email);
      if (existingUser) {
        return res.status(400).json({ message: "Ya existe un usuario con ese email" });
      }
      
      // Si se proporciona salespersonUserId, verificar que existe
      if (validatedData.salespersonUserId) {
        const salesperson = await storage.getUserById(validatedData.salespersonUserId);
        if (!salesperson) {
          return res.status(400).json({ message: "El vendedor especificado no existe" });
        }
        if (!['salesperson', 'admin', 'supervisor'].includes(salesperson.role || '')) {
          return res.status(400).json({ message: "El usuario especificado no es un vendedor válido" });
        }
      }
      
      // Hash de la contraseña
      const hashedPassword = await bcrypt.hash(validatedData.password, 12);
      
      // Crear usuario con rol client
      const newUser = await storage.createUser({
        email: validatedData.email,
        password: hashedPassword,
        firstName: client.nokoen || '',
        lastName: '',
        role: 'client',
      });
      
      // Actualizar cliente con el userId y el vendedor asignado
      const updateData: any = {
        userId: newUser.id,
      };
      
      if (validatedData.salespersonUserId) {
        updateData.assignedSalespersonUserId = validatedData.salespersonUserId;
      }
      
      if (client.koen) {
        await storage.updateClient(client.koen, updateData);
      }
      
      res.json({
        success: true,
        message: "Credenciales asignadas exitosamente",
        userId: newUser.id,
        email: newUser.email
      });
    } catch (error) {
      console.error("Error asignando credenciales:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Error de validación", 
          errors: error.errors 
        });
      }
      res.status(500).json({ 
        message: "Error al asignar credenciales", 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  // Core client fields for reliable import (essential fields only to avoid parameter limit)
  const coreClientFields = new Set([
    'koen', 'nokoen', 'rten', 'tien', 'gien', 'paen', 'cien', 'cmen', 'dien', 'comuna',
    'foen', 'email', 'kofuen', 'lcen', 'contab', 'ruen', 'cobrador', 'bloqueado', 'actien'
  ]);

  // Numeric fields that require strict validation 
  const numericClientFields = new Set([
    'idmaeen', 'crsd', 'crch', 'crlt', 'crpa', 'crto', 'cren', 'nuvecr', 'dccr', 'incr', 
    'popicr', 'porprefen', 'cpen', 'diacobra', 'dimoper', 'imptoret', 'podetrac', 'proteacum', 
    'protevige', 'diasvenci', 'diprve', 'valivenpag', 'porceliga', 'gpslat', 'gpslon'
  ]);

  // Integer fields that require strict validation
  const integerClientFields = new Set([
    'rutalun', 'rutamar', 'rutamie', 'rutajue', 'rutavie', 'rutasab', 'rutadom',
    'bloqueado', 'actien', 'bloqencom', 'blovenex', 'agretiva', 'agretiibb', 'agretgan',
    'agperiva', 'agperiibb', 'podetrac', 'nvvpidepie', 'recepelect', 'nvvobli', 'occobli',
    'secuecom', 'secueven', 'avisadpven'
  ]);

  // Function to safely convert and validate numeric values
  const safeNumericConvert = (value: any, fieldName: string): number | null => {
    if (value === null || value === undefined || value === '') return null;
    
    const strValue = value.toString().trim();
    
    // Skip obvious text values
    if (/[A-Za-z]/.test(strValue) && !strValue.match(/^-?\d+\.?\d*$/)) {
      console.warn(`⚠️  SKIPPING NON-NUMERIC VALUE for ${fieldName}: "${strValue}"`);
      return null;
    }
    
    // Try to parse as number
    const numValue = parseFloat(strValue.replace(/[^\d.-]/g, ''));
    if (isNaN(numValue)) {
      console.warn(`⚠️  INVALID NUMERIC VALUE for ${fieldName}: "${strValue}"`);
      return null;
    }
    
    return numValue;
  };

  // Function to safely convert and validate integer values
  const safeIntegerConvert = (value: any, fieldName: string): number | null => {
    if (value === null || value === undefined || value === '') return null;
    
    const strValue = value.toString().trim();
    
    // Skip text values
    if (/[A-Za-z]/.test(strValue)) {
      console.warn(`⚠️  SKIPPING NON-INTEGER VALUE for ${fieldName}: "${strValue}"`);
      return null;
    }
    
    // Try to parse as integer
    const intValue = parseInt(strValue.replace(/[^\d-]/g, ''));
    if (isNaN(intValue)) {
      console.warn(`⚠️  INVALID INTEGER VALUE for ${fieldName}: "${strValue}"`);
      return null;
    }
    
    return intValue;
  };

  // Sales transactions endpoint
  app.get('/api/sales/transactions', requireAuth, async (req, res) => {
    try {
      const { startDate, endDate, salesperson, segment, limit, offset, period, filterType } = req.query;
      const dateRange = getDateRange(period as string, filterType as string);
      
      // Enforce role-based access control for salespeople
      let salespersonFilter = salesperson as string;
      if (req.user?.role === 'salesperson') {
        // Force filter to authenticated user's salesperson name
        salespersonFilter = (req.user as any).salespersonName;
        
        // If salesperson name is not available, return empty result for security
        if (!salespersonFilter) {
          return res.json([]);
        }
      }
      
      const transactions = await storage.getSalesTransactions({
        startDate: (startDate as string) || dateRange.startDate,
        endDate: (endDate as string) || dateRange.endDate,
        salesperson: salespersonFilter,
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

  // Client search endpoint (AJAX autocomplete)
  app.get('/api/clients/search', requireAuth, async (req, res) => {
    try {
      const { q, period, filterType, segment, salesperson } = req.query;
      
      if (!q || typeof q !== 'string' || q.trim().length < 2) {
        return res.json([]);
      }
      
      const searchTerm = q.trim().toLowerCase();
      
      // Get date range if period is provided
      let startDate, endDate;
      if (period && filterType) {
        const dateRange = getDateRange(period as string, filterType as string);
        startDate = dateRange.startDate;
        endDate = dateRange.endDate;
      }
      
      const results = await storage.searchClients(
        searchTerm,
        startDate,
        endDate,
        salesperson as string,
        segment as string
      );
      
      res.json(results);
    } catch (error) {
      console.error("Error searching clients:", error);
      res.status(500).json({ message: "Failed to search clients" });
    }
  });

  // Product search endpoint (AJAX autocomplete)
  app.get('/api/products/search', requireAuth, async (req, res) => {
    try {
      const { q, period, filterType, segment, salesperson } = req.query;
      
      if (!q || typeof q !== 'string' || q.trim().length < 2) {
        return res.json([]);
      }
      
      const searchTerm = q.trim().toLowerCase();
      
      // Get date range if period is provided
      let startDate, endDate;
      if (period && filterType) {
        const dateRange = getDateRange(period as string, filterType as string);
        startDate = dateRange.startDate;
        endDate = dateRange.endDate;
      }
      
      const results = await storage.searchProducts(
        searchTerm,
        startDate,
        endDate,
        salesperson as string,
        segment as string
      );
      
      res.json(results);
    } catch (error) {
      console.error("Error searching products:", error);
      res.status(500).json({ message: "Failed to search products" });
    }
  });

  // Segment analysis endpoint
  app.get('/api/sales/segments', requireAuth, async (req, res) => {
    try {
      const { period, filterType, salesperson, segment } = req.query;
      const dateRange = getDateRange(period as string, filterType as string);
      
      const segmentAnalysis = await storage.getSegmentAnalysis(
        dateRange.startDate,
        dateRange.endDate,
        salesperson as string,
        segment as string
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
    const { period, filterType, salesperson, segment, branch } = req.query;
    const dateRange = getDateRange(period as string, filterType as string);
    
    const packagingMetrics = await storage.getPackagingMetrics({
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      salesperson: salesperson as string,
      segment: segment as string,
      branch: branch as string,
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
      
      console.log('[CHART-DATA DEBUG] Request params:', { period, selectedPeriod, filterType, salesperson, segment });
      console.log('[CHART-DATA DEBUG] Date range calculated:', dateRange);
      
      let chartData = await storage.getSalesChartData(
        period as 'weekly' | 'monthly' | 'daily',
        dateRange.startDate,
        dateRange.endDate,
        salesperson as string, // Filtrar por vendedor específico
        segment as string // Filtrar por segmento específico
      );
      
      console.log('[CHART-DATA DEBUG] Result count:', chartData?.length || 0);

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

  // Segment monthly breakdown (for year exports)
  app.get("/api/sales/segment/:segmentName/monthly-breakdown", requireAuth, async (req, res) => {
    try {
      const { segmentName } = req.params;
      const { year } = req.query;
      
      if (!year) {
        return res.status(400).json({ message: "Year parameter is required" });
      }
      
      const monthlyData = await storage.getSegmentMonthlyBreakdown(segmentName, year as string);
      res.json(monthlyData);
    } catch (error) {
      console.error("Error fetching segment monthly breakdown:", error);
      res.status(500).json({ message: "Failed to fetch segment monthly breakdown" });
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

  // Branch detail route - clients by branch
  app.get("/api/sales/branch/:branchName/clients", requireAuth, async (req, res) => {
    try {
      const { branchName } = req.params;
      const { period, filterType = "month" } = req.query;
      
      const clients = await storage.getBranchClients(branchName, period as string, filterType as string);
      res.json(clients);
    } catch (error) {
      console.error("Error fetching branch clients:", error);
      res.status(500).json({ message: "Failed to fetch branch clients" });
    }
  });

  // Branch detail route - salespeople by branch
  app.get("/api/sales/branch/:branchName/salespeople", requireAuth, async (req, res) => {
    try {
      const { branchName } = req.params;
      const { period, filterType = "month" } = req.query;
      
      const salespeople = await storage.getBranchSalespeople(branchName, period as string, filterType as string);
      res.json(salespeople);
    } catch (error) {
      console.error("Error fetching branch salespeople:", error);
      res.status(500).json({ message: "Failed to fetch branch salespeople" });
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

  // Salesperson metrics endpoint (for comparative charts)
  app.get("/api/sales/salesperson/:salespersonName/metrics", requireAuth, async (req, res) => {
    try {
      const { salespersonName } = req.params;
      const { period, filterType = "month" } = req.query;
      
      const details = await storage.getSalespersonDetails(salespersonName, period as string, filterType as string);
      
      // Return only the metrics needed for comparative charts
      res.json({
        totalSales: details.totalSales,
        totalClients: details.totalClients,
        totalTransactions: details.transactionCount,
        averageTicket: details.averageTicket
      });
    } catch (error) {
      console.error("Error fetching salesperson metrics:", error);
      res.status(500).json({ message: "Failed to fetch salesperson metrics" });
    }
  });

  app.get("/api/sales/salesperson/:salespersonName/clients", requireAuth, async (req, res) => {
    try {
      const { salespersonName } = req.params;
      const { period, filterType = "month", segment } = req.query;
      
      const clients = await storage.getSalespersonClients(
        salespersonName, 
        period as string, 
        filterType as string,
        segment as string | undefined
      );
      res.json(clients);
    } catch (error) {
      console.error("Error fetching salesperson clients:", error);
      res.status(500).json({ message: "Failed to fetch salesperson clients" });
    }
  });

  app.get("/api/sales/salesperson/:salespersonName/products", requireAuth, async (req, res) => {
    try {
      const { salespersonName } = req.params;
      const { period, filterType = "month", segment } = req.query;
      
      const products = await storage.getSalespersonProducts(
        salespersonName, 
        period as string, 
        filterType as string,
        segment as string | undefined
      );
      res.json(products);
    } catch (error) {
      console.error("Error fetching salesperson products:", error);
      res.status(500).json({ message: "Failed to fetch salesperson products" });
    }
  });

  app.get("/api/sales/salesperson/:salespersonName/segments", requireAuth, async (req, res) => {
    try {
      const { salespersonName } = req.params;
      const { period, filterType = "month" } = req.query;
      
      const segments = await storage.getSalespersonSegments(salespersonName, period as string, filterType as string);
      res.json(segments);
    } catch (error) {
      console.error("Error fetching salesperson segments:", error);
      res.status(500).json({ message: "Failed to fetch salesperson segments" });
    }
  });

  // Salesperson NVV pending sales
  app.get("/api/sales/salesperson/:salespersonName/nvv-pending", requireAuth, async (req, res) => {
    try {
      const { salespersonName } = req.params;
      const { period, filterType = "month" } = req.query;
      
      // Build date conditions based on period
      const conditions = [];
      if (period) {
        switch (filterType) {
          case 'month':
            const [year, month] = (period as string).split('-');
            conditions.push(
              sql`EXTRACT(YEAR FROM "FEEMLI") = ${year} AND EXTRACT(MONTH FROM "FEEMLI") = ${month}`
            );
            break;
          case 'year':
            conditions.push(sql`EXTRACT(YEAR FROM "FEEMLI") = ${period}`);
            break;
        }
      }
      
      conditions.push(sql`"NOKOFU" = ${salespersonName}`);
      
      const nvvData = await db
        .select({
          clientName: nvvPendingSales.NOKOEN,
          totalPending: sql<number>`SUM(${nvvPendingSales.total_pendiente})`,
          documentCount: sql<number>`COUNT(DISTINCT ${nvvPendingSales.NUDO})`,
        })
        .from(nvvPendingSales)
        .where(and(...conditions))
        .groupBy(nvvPendingSales.NOKOEN)
        .orderBy(desc(sql`SUM(${nvvPendingSales.total_pendiente})`));
      
      const totalNVV = nvvData.reduce((sum, item) => sum + Number(item.totalPending), 0);
      const totalDocuments = nvvData.reduce((sum, item) => sum + Number(item.documentCount), 0);
      
      res.json({
        total: totalNVV,
        documentCount: totalDocuments,
        clients: nvvData.map(item => ({
          clientName: item.clientName,
          totalPending: Number(item.totalPending),
          documentCount: Number(item.documentCount),
        }))
      });
    } catch (error) {
      console.error("Error fetching salesperson NVV pending:", error);
      res.status(500).json({ message: "Failed to fetch NVV pending sales" });
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

  // Notificaciones inteligentes de ventas para vendedores
  app.get("/api/sales/salesperson/:salespersonName/smart-notifications", requireAuth, async (req, res) => {
    try {
      const { salespersonName } = req.params;
      
      const notifications = await storage.getSalespersonSmartNotifications(salespersonName);
      res.json(notifications);
    } catch (error) {
      console.error("Error fetching smart notifications:", error);
      res.status(500).json({ message: "Failed to fetch smart notifications" });
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

      // Record this import in file upload registry
      try {
        await storage.recordFileUpload({
          fileType: 'sales',
          fileName: 'sales_data.csv', // Generic name since we don't have actual filename
          uploadedBy: (req.user as any)?.id || 'unknown',
          recordsImported: validatedTransactions.length,
          recordsErrors: errors.length,
          status: errors.length > 0 ? 'partial' : 'success',
          errorMessage: errors.length > 0 ? `${errors.length} validation errors` : null,
          fileSize: JSON.stringify(transactions).length, // Approximate size
        });
      } catch (uploadRecordError) {
        console.error('Failed to record file upload:', uploadRecordError);
        // Don't fail the main import for this
      }
      
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

  // File uploads registry endpoints
  app.get('/api/files/last-upload', requireAuth, async (req, res) => {
    try {
      const { fileType } = req.query;
      const lastUpload = await storage.getLastFileUpload(fileType as string);
      
      if (!lastUpload) {
        return res.status(404).json({ message: "No file uploads found" });
      }
      
      res.json(lastUpload);
    } catch (error) {
      console.error("Error fetching last file upload:", error);
      res.status(500).json({ message: "Failed to fetch last file upload" });
    }
  });

  app.get('/api/files/history', requireAuth, async (req, res) => {
    try {
      const { fileType, limit } = req.query;
      const history = await storage.getFileUploadHistory(
        fileType as string, 
        limit ? parseInt(limit as string) : 10
      );
      res.json(history);
    } catch (error) {
      console.error("Error fetching file upload history:", error);
      res.status(500).json({ message: "Failed to fetch file upload history" });
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

  // API Keys management endpoints (admin only)
  app.get('/api/api-keys', requireAuth, async (req: any, res) => {
    try {
      // Only admin and supervisor can view API keys
      if (req.user.role !== 'admin' && req.user.role !== 'supervisor') {
        return res.status(403).json({ message: 'No autorizado' });
      }

      const keys = await storage.getApiKeys();
      
      // Don't return the actual key hash
      const sanitizedKeys = keys.map(key => ({
        id: key.id,
        keyPrefix: key.keyPrefix,
        name: key.name,
        description: key.description,
        role: key.role,
        isActive: key.isActive,
        lastUsedAt: key.lastUsedAt,
        usageCount: key.usageCount,
        createdBy: key.createdBy,
        createdAt: key.createdAt,
        expiresAt: key.expiresAt,
      }));

      res.json(sanitizedKeys);
    } catch (error) {
      console.error('Error fetching API keys:', error);
      res.status(500).json({ message: 'Error al obtener API keys' });
    }
  });

  app.post('/api/api-keys', requireAuth, async (req: any, res) => {
    try {
      // Only admin can create API keys
      if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'No autorizado' });
      }

      const { name, description, role, expiresAt } = req.body;

      if (!name) {
        return res.status(400).json({ message: 'El nombre es requerido' });
      }

      // Generate a random API key
      const apiKey = `mk_${role || 'readonly'}_${nanoid(32)}`;
      const keyHash = await bcrypt.hash(apiKey, 10);
      const keyPrefix = apiKey.substring(0, 16) + '...';

      const newKey = await storage.createApiKey({
        name,
        description: description || null,
        role: role || 'readonly',
        createdBy: req.user.id,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        keyHash,
        keyPrefix,
      });

      // Return the full API key ONLY on creation (it won't be accessible again)
      res.json({
        ...newKey,
        apiKey, // Only shown once
        keyHash: undefined, // Don't expose hash
      });
    } catch (error) {
      console.error('Error creating API key:', error);
      res.status(500).json({ message: 'Error al crear API key' });
    }
  });

  app.patch('/api/api-keys/:id/toggle', requireAuth, async (req: any, res) => {
    try {
      // Only admin can toggle API keys
      if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'No autorizado' });
      }

      const { id } = req.params;
      const { isActive } = req.body;

      const updated = await storage.toggleApiKeyStatus(id, isActive);
      
      if (!updated) {
        return res.status(404).json({ message: 'API key no encontrada' });
      }

      res.json({ ...updated, keyHash: undefined });
    } catch (error) {
      console.error('Error toggling API key:', error);
      res.status(500).json({ message: 'Error al actualizar API key' });
    }
  });

  app.delete('/api/api-keys/:id', requireAuth, async (req: any, res) => {
    try {
      // Only admin can delete API keys
      if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'No autorizado' });
      }

      const { id } = req.params;
      const deleted = await storage.deleteApiKey(id);
      
      if (!deleted) {
        return res.status(404).json({ message: 'API key no encontrada' });
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting API key:', error);
      res.status(500).json({ message: 'Error al eliminar API key' });
    }
  });

  // Proyección de Ventas - Historical data endpoint
  app.get('/api/proyeccion/historical', requireAuth, async (req, res) => {
    try {
      const { type, salespersonCode, segment } = req.query;
      const viewType = (type as string) || 'salesperson';
      
      // Get data from the last 36 months for better forecasting
      const endDate = new Date();
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 36);
      
      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];
      
      // Build additional filters
      let additionalFilters = '';
      if (viewType === 'salesperson' && salespersonCode && salespersonCode !== 'all') {
        additionalFilters += ` AND nokofu = '${salespersonCode}'`;
      }
      if (viewType === 'segment' && segment && segment !== 'all') {
        additionalFilters += ` AND noruen = '${segment}'`;
      }
      
      // Query historical monthly sales from fact_ventas
      const query = `
        SELECT 
          ${viewType === 'salesperson' ? 'nokofu as entity' : 'noruen as entity'},
          TO_CHAR(feemdo::date, 'YYYY-MM') as period,
          SUM(CAST(vabrdo AS NUMERIC)) as total_sales
        FROM ventas.fact_ventas
        WHERE feemdo >= $1 
          AND feemdo <= $2
          AND tido NOT IN ('GDV')
          ${viewType === 'salesperson' ? 'AND nokofu IS NOT NULL AND nokofu != \'.\'' : 'AND noruen IS NOT NULL'}
          ${additionalFilters}
        GROUP BY ${viewType === 'salesperson' ? 'nokofu' : 'noruen'}, TO_CHAR(feemdo::date, 'YYYY-MM')
        ORDER BY entity, period
      `;
      
      const result = await db.execute(sql.raw(query.replace('$1', `'${startDateStr}'`).replace('$2', `'${endDateStr}'`)));
      
      // Group by entity (salesperson or segment)
      const groupedData: Record<string, any[]> = {};
      
      for (const row of result.rows as any[]) {
        const entity = row.entity;
        if (!groupedData[entity]) {
          groupedData[entity] = [];
        }
        groupedData[entity].push({
          period: row.period,
          totalSales: parseFloat(row.total_sales) || 0,
        });
      }
      
      // Convert to array format
      const historicalData = Object.entries(groupedData).map(([entity, monthlySales]) => {
        // Sort by period
        monthlySales.sort((a, b) => a.period.localeCompare(b.period));
        
        return {
          [viewType === 'salesperson' ? 'salesperson' : 'segment']: entity,
          monthlySales,
        };
      });
      
      // Filter out entities with insufficient data (less than 12 months)
      const filteredData = historicalData.filter(item => item.monthlySales.length >= 12);
      
      res.json(filteredData);
    } catch (error) {
      console.error('Error fetching projection historical data:', error);
      res.status(500).json({ message: 'Error al obtener datos históricos para proyección' });
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
        validatedUser.password = await bcrypt.hash(validatedUser.password, 12);
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

  // Get simplified list of products for dropdowns (id, kopr, name, ud02pr only)
  app.get('/api/products/list', requireAuth, async (req: any, res) => {
    try {
      const products = await storage.getProductsForDropdown();
      res.json(products);
    } catch (error) {
      console.error('Error al obtener lista de productos:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
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

  // Get all warehouses (optionally filtered by branch)
  app.get('/api/warehouses', requireAuth, async (req: any, res) => {
    try {
      const { branch } = req.query;
      const warehouses = await storage.getWarehouses(branch as string);
      res.json(warehouses);
    } catch (error) {
      console.error("Error fetching warehouses:", error);
      res.status(500).json({ message: "Failed to fetch warehouses" });
    }
  });

  // Get all branches
  app.get('/api/branches', requireAuth, async (req: any, res) => {
    try {
      const branches = await storage.getBranches();
      res.json(branches);
    } catch (error) {
      console.error("Error fetching branches:", error);
      res.status(500).json({ message: "Failed to fetch branches" });
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

  // ===================== eCommerce Orders API Routes =====================
  
  // Create order from client (authenticated clients only)
  app.post('/api/ecommerce/orders/client', requireAuth, asyncHandler(async (req: any, res: any) => {
    const { insertEcommerceOrderSchema } = await import('@shared/schema');
    
    // Validate user is authenticated
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: 'No autenticado' });
    }
    
    try {
      // Validate request body
      const validationResult = insertEcommerceOrderSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: 'Error de validación', 
          errors: validationResult.error.errors 
        });
      }
      
      const orderData = validationResult.data;
      const clientId = req.user.id;
      
      // Get client details to find assigned salesperson
      const client = await storage.getClientByUserId(clientId);
      
      // Prepare order data with client and salesperson info
      const orderToCreate = {
        ...orderData,
        clientId,
        clientName: req.user.email || 'Cliente',
        clientEmail: req.user.email,
        assignedSalespersonId: client?.assignedSalespersonUserId || null,
        assignedSalespersonName: null, // Will be populated if there's a salesperson
        status: 'pending'
      };
      
      // If there's an assigned salesperson, get their name
      if (client?.assignedSalespersonUserId) {
        const salesperson = await storage.getUser(client.assignedSalespersonUserId);
        if (salesperson) {
          orderToCreate.assignedSalespersonName = salesperson.email || 'Vendedor';
        }
      }
      
      // Create the order
      const order = await storage.createEcommerceOrder(orderToCreate);
      
      // Create notification for salesperson or admin
      const notificationUserId = orderToCreate.assignedSalespersonId || await storage.getAdminUserId();
      
      if (notificationUserId) {
        await storage.createNotification({
          userId: notificationUserId,
          type: 'ecommerce_order',
          title: 'Nuevo pedido de cliente',
          message: `${orderToCreate.clientName} ha realizado un pedido por $${Number(orderData.total).toFixed(0)}`,
          relatedOrderId: order.id,
          read: false
        });
      }
      
      res.status(201).json(order);
    } catch (error: any) {
      console.error('Error creating client order:', error);
      res.status(500).json({ message: 'Error al crear el pedido' });
    }
  }));

  // Get ecommerce orders for salesperson/admin (order taker view)
  app.get('/api/ecommerce/orders', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      
      // Build filters based on user role
      const filters: any = {};
      
      if (user.role === 'salesperson') {
        // Salesperson sees only their assigned orders
        filters.salespersonId = user.id;
      } else if (user.role === 'admin' || user.role === 'supervisor') {
        // Admin/supervisor see all orders
        // Optionally filter by status if provided
        if (req.query.status && req.query.status !== 'all') {
          filters.status = req.query.status;
        }
      } else {
        // Other roles can't access this endpoint
        return res.status(403).json({ message: 'No autorizado' });
      }
      
      const orders = await storage.getEcommerceOrders(filters);
      res.json(orders);
    } catch (error) {
      console.error('Error fetching ecommerce orders:', error);
      res.status(500).json({ message: 'Error al obtener pedidos' });
    }
  }));

  // ===================== End eCommerce Orders API Routes =====================

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
    const { categoria, descripcion, imagenUrl, precio, activo, groupId, variantLabel, isMainVariant } = req.body;
    
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
      precioEcommerce: precio,
      groupId,
      variantLabel,
      isMainVariant
    });
    
    try {
      console.log('🏪 [BACKEND] Llamando a storage.updateEcommerceAdminProduct...');
      const product = await storage.updateEcommerceAdminProduct(id, {
        categoria,
        descripcion,
        imagenUrl,
        precioEcommerce: precio,
        activo,
        groupId,
        variantLabel,
        isMainVariant
      });
      
      console.log('✅ [BACKEND] Producto actualizado exitosamente:', product);
      res.json(product);
    } catch (error: any) {
      console.error('❌ [BACKEND] Error en updateEcommerceAdminProduct:', {
        error: error.message,
        stack: error.stack,
        id,
        updates: { categoria, descripcion, imagenUrl, precioEcommerce: precio, activo, groupId, variantLabel, isMainVariant }
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

  // ===================== Product Groups API Routes =====================

  // Create new product group
  app.post('/api/ecommerce/admin/grupos', requireAdminOrSupervisor, asyncHandler(async (req: any, res: any) => {
    const { insertEcommerceProductGroupSchema } = await import('@shared/schema');
    
    try {
      const validated = insertEcommerceProductGroupSchema.parse(req.body);
      const group = await storage.createProductGroup(validated);
      res.json(group);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: 'Datos inválidos', errors: error.errors });
      }
      throw error;
    }
  }));

  // Get all product groups
  app.get('/api/ecommerce/admin/grupos', requireAdminOrSupervisor, asyncHandler(async (req: any, res: any) => {
    const { search, categoria, activo } = req.query;
    
    const groups = await storage.getProductGroups({
      search,
      categoria: categoria !== 'all' ? categoria : undefined,
      activo: activo && activo !== 'all' ? (activo === 'true') : undefined
    });
    
    res.json(groups);
  }));

  // Get single product group with variants
  app.get('/api/ecommerce/admin/grupos/:id', requireAdminOrSupervisor, asyncHandler(async (req: any, res: any) => {
    const { id } = req.params;
    
    const groupData = await storage.getProductGroupWithVariants(id);
    
    if (!groupData) {
      return res.status(404).json({ message: 'Grupo no encontrado' });
    }
    
    res.json(groupData);
  }));

  // Update product group
  app.patch('/api/ecommerce/admin/grupos/:id', requireAdminOrSupervisor, asyncHandler(async (req: any, res: any) => {
    const { id } = req.params;
    const { updateEcommerceProductGroupSchema } = await import('@shared/schema');
    
    try {
      const validated = updateEcommerceProductGroupSchema.parse(req.body);
      const updated = await storage.updateProductGroup(id, validated);
      res.json(updated);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: 'Datos inválidos', errors: error.errors });
      }
      if (error.message.includes('not found') || error.message.includes('no encontrado')) {
        return res.status(404).json({ message: 'Grupo no encontrado' });
      }
      throw error;
    }
  }));

  // Delete product group
  app.delete('/api/ecommerce/admin/grupos/:id', requireAdminOrSupervisor, asyncHandler(async (req: any, res: any) => {
    const { id } = req.params;
    
    await storage.deleteProductGroup(id);
    res.json({ message: 'Grupo eliminado correctamente' });
  }));

  // Assign product to group
  app.post('/api/ecommerce/admin/grupos/:id/assign', requireAdminOrSupervisor, asyncHandler(async (req: any, res: any) => {
    const { id: groupId } = req.params;
    const { productId, variantLabel, isMainVariant } = req.body;
    
    if (!productId) {
      return res.status(400).json({ message: 'productId es requerido' });
    }
    
    await storage.assignProductToGroup(productId, groupId, variantLabel, isMainVariant);
    res.json({ message: 'Producto asignado al grupo correctamente' });
  }));

  // Remove product from group
  app.post('/api/ecommerce/admin/grupos/:id/remove', requireAdminOrSupervisor, asyncHandler(async (req: any, res: any) => {
    const { productId } = req.body;
    
    if (!productId) {
      return res.status(400).json({ message: 'productId es requerido' });
    }
    
    await storage.removeProductFromGroup(productId);
    res.json({ message: 'Producto removido del grupo correctamente' });
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
      
      // Field whitelisting: only allow status, notes, and evidenceImages to be updated
      const updateAssignmentSchema = insertTaskAssignmentSchema.pick({
        status: true,
        notes: true,
        evidenceImages: true
      }).partial();
      
      // Validate request body with Zod
      const validation = updateAssignmentSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          message: "Invalid assignment update data", 
          errors: validation.error.issues 
        });
      }
      
      const { status, notes, evidenceImages } = validation.data;
      
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
      
      const updatedAssignment = await storage.updateAssignmentStatus(
        assignmentId, 
        status || '', 
        notes || undefined,
        evidenceImages || undefined
      );
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

  // ==================================================================================
  // Users endpoint for CRM
  // ==================================================================================
  
  // Get all users (for dropdowns like salesperson assignment)
  app.get('/api/users', requireAuth, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Only admin, supervisor, and salesperson can view users list
      if (!['admin', 'supervisor', 'salesperson'].includes(user.role)) {
        return res.status(403).json({ message: "No autorizado" });
      }
      
      const users = await storage.getSalespeopleUsers();
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Search clients (for CRM lead creation from existing clients)
  app.get('/api/users/clients/search', requireAuth, async (req: any, res) => {
    try {
      const user = req.user;
      const { q } = req.query;
      
      // Only admin, supervisor, and salesperson can view client list
      if (!['admin', 'supervisor', 'salesperson'].includes(user.role)) {
        return res.status(403).json({ message: "No autorizado" });
      }
      
      // Require at least 2 characters for search
      if (!q || typeof q !== 'string' || q.trim().length < 2) {
        return res.json([]);
      }
      
      // Search clients directly from fact_ventas (data warehouse) to ensure we get real recurring clients
      const searchTerm = q.trim().toLowerCase();
      const clientsFromSales = await db
        .selectDistinct({
          id: factVentas.koen,
          nokoen: factVentas.nokoen,
          koen: factVentas.koen,
          rten: factVentas.gien,
          gien: factVentas.gien,
          dien: sql<string | null>`NULL`.as('dien'),
          foen: sql<string | null>`NULL`.as('foen'),
          email: sql<string | null>`NULL`.as('email'),
        })
        .from(factVentas)
        .where(
          or(
            sql`LOWER(${factVentas.nokoen}) LIKE ${`%${searchTerm}%`}`,
            sql`LOWER(${factVentas.koen}) LIKE ${`%${searchTerm}%`}`
          )
        )
        .orderBy(desc(factVentas.nokoen))
        .limit(100);
      
      res.json(clientsFromSales);
    } catch (error) {
      console.error("Error searching clients:", error);
      res.status(500).json({ message: "Failed to search clients" });
    }
  });

  // ==================================================================================
  // CRM Pipeline endpoints
  // ==================================================================================

  // Get all leads with filters
  app.get('/api/crm/leads', requireAuth, async (req: any, res) => {
    try {
      const user = req.user;
      const { stage, segment } = req.query;
      
      // Build filters based on user role
      const filters: any = {};
      
      if (stage) {
        filters.stage = stage as string;
      }
      if (segment && user.role === 'admin') {
        // Only admins can manually filter by segment
        filters.segment = segment as string;
      }
      
      // Role-based filtering
      if (user.role === 'salesperson') {
        // Salespeople see only their own leads
        filters.salespersonId = user.id;
      } else if (user.role === 'supervisor') {
        // Supervisors see leads from their assigned segment
        if (user.assignedSegment) {
          filters.segment = user.assignedSegment;
        }
      }
      // Admin sees all leads (no additional filter)
      
      const leads = await storage.getAllLeads(filters);
      res.json(leads);
    } catch (error) {
      console.error("Error fetching CRM leads:", error);
      res.status(500).json({ message: "Failed to fetch leads" });
    }
  });

  // Get single lead by ID
  app.get('/api/crm/leads/:id', requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const user = req.user;
      
      const lead = await storage.getLeadById(id);
      
      if (!lead) {
        return res.status(404).json({ message: "Lead not found" });
      }
      
      // Check authorization based on role
      let canView = false;
      if (user.role === 'admin') {
        canView = true;
      } else if (user.role === 'supervisor') {
        // Supervisor can view if lead is in their segment
        canView = lead.segment === user.assignedSegment;
      } else if (user.role === 'salesperson') {
        // Salesperson can view only their own leads
        canView = lead.salespersonId === user.id;
      }
      
      if (!canView) {
        return res.status(403).json({ message: "Not authorized to view this lead" });
      }
      
      res.json(lead);
    } catch (error) {
      console.error("Error fetching lead:", error);
      res.status(500).json({ message: "Failed to fetch lead" });
    }
  });

  // Create new lead
  app.post('/api/crm/leads', requireAuth, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Validate request body
      const validation = insertCrmLeadSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          message: "Invalid lead data", 
          errors: validation.error.issues 
        });
      }
      
      // Get salesperson info
      const salesperson = await storage.getSalespersonUser(validation.data.salespersonId);
      if (!salesperson) {
        return res.status(400).json({ message: "Salesperson not found" });
      }
      
      const leadData = {
        ...validation.data,
        salespersonName: salesperson.salespersonName,
        supervisorId: salesperson.supervisorId || undefined,
      };
      
      const newLead = await storage.createLead(leadData);
      
      // 🔔 Notificación automática: Nuevo lead creado
      await NotifyHelper.notifyNuevoLead(
        leadData.clientName,
        leadData.segment || 'Sin segmento',
        leadData.salespersonName
      );
      
      res.status(201).json(newLead);
    } catch (error) {
      console.error("Error creating lead:", error);
      res.status(500).json({ message: "Failed to create lead" });
    }
  });

  // Update lead (including stage changes, activity tracking)
  app.put('/api/crm/leads/:id', requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const user = req.user;
      
      const lead = await storage.getLeadById(id);
      if (!lead) {
        return res.status(404).json({ message: "Lead not found" });
      }
      
      // Check authorization
      const canEdit = user.role === 'admin' || 
                     user.role === 'supervisor' || 
                     lead.salespersonId === user.id;
      
      if (!canEdit) {
        return res.status(403).json({ message: "Not authorized to edit this lead" });
      }
      
      const updatedLead = await storage.updateLead(id, req.body);
      res.json(updatedLead);
    } catch (error) {
      console.error("Error updating lead:", error);
      res.status(500).json({ message: "Failed to update lead" });
    }
  });

  // Delete lead
  app.delete('/api/crm/leads/:id', requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const user = req.user;
      
      const lead = await storage.getLeadById(id);
      if (!lead) {
        return res.status(404).json({ message: "Lead not found" });
      }
      
      // Only admin or supervisor can delete
      if (user.role !== 'admin' && user.role !== 'supervisor') {
        return res.status(403).json({ message: "Not authorized to delete leads" });
      }
      
      await storage.deleteLead(id);
      res.json({ message: "Lead deleted successfully" });
    } catch (error) {
      console.error("Error deleting lead:", error);
      res.status(500).json({ message: "Failed to delete lead" });
    }
  });

  // Get comments for a lead
  app.get('/api/crm/leads/:id/comments', requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const user = req.user;
      
      const lead = await storage.getLeadById(id);
      if (!lead) {
        return res.status(404).json({ message: "Lead not found" });
      }
      
      // Check authorization
      const canView = user.role === 'admin' || 
                     user.role === 'supervisor' || 
                     lead.salespersonId === user.id;
      
      if (!canView) {
        return res.status(403).json({ message: "Not authorized to view comments" });
      }
      
      const comments = await storage.getLeadComments(id);
      res.json(comments);
    } catch (error) {
      console.error("Error fetching comments:", error);
      res.status(500).json({ message: "Failed to fetch comments" });
    }
  });

  // Create comment for a lead
  app.post('/api/crm/leads/:id/comments', requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const user = req.user;
      const { comment } = req.body;
      
      if (!comment || comment.trim() === '') {
        return res.status(400).json({ message: "Comment is required" });
      }
      
      const lead = await storage.getLeadById(id);
      if (!lead) {
        return res.status(404).json({ message: "Lead not found" });
      }
      
      // Check authorization
      const canComment = user.role === 'admin' || 
                        user.role === 'supervisor' || 
                        lead.salespersonId === user.id;
      
      if (!canComment) {
        return res.status(403).json({ message: "Not authorized to comment" });
      }
      
      // Get user name
      const userRecord = await storage.getSalespersonUser(user.id);
      const userName = userRecord?.salespersonName || user.firstName || 'Usuario';
      
      const newComment = await storage.createLeadComment({
        leadId: id,
        userId: user.id,
        userName,
        comment: comment.trim(),
      });
      
      res.status(201).json(newComment);
    } catch (error) {
      console.error("Error creating comment:", error);
      res.status(500).json({ message: "Failed to create comment" });
    }
  });

  // Get CRM statistics
  app.get('/api/crm/stats', requireAuth, async (req: any, res) => {
    try {
      const user = req.user;
      const { startDate, endDate } = req.query;
      
      const filters: any = {};
      
      if (startDate) filters.startDate = startDate as string;
      if (endDate) filters.endDate = endDate as string;
      
      // Role-based filtering
      if (user.role === 'salesperson') {
        filters.salespersonId = user.id;
      } else if (user.role === 'supervisor') {
        filters.supervisorId = user.id;
      }
      
      const stats = await storage.getCrmStats(filters);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching CRM stats:", error);
      res.status(500).json({ message: "Failed to fetch CRM statistics" });
    }
  });

  // ==================================================================================
  // CRM Stages Management
  // ==================================================================================

  // Get all stages
  app.get('/api/crm/stages', requireAuth, async (req: any, res) => {
    try {
      const stages = await storage.getAllStages();
      res.json(stages);
    } catch (error) {
      console.error("Error fetching stages:", error);
      res.status(500).json({ message: "Failed to fetch stages" });
    }
  });

  // Create new stage (admin only)
  app.post('/api/crm/stages', requireAuth, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (user.role !== 'admin') {
        return res.status(403).json({ message: "Only admins can create stages" });
      }
      
      const newStage = await storage.createStage(req.body);
      res.status(201).json(newStage);
    } catch (error) {
      console.error("Error creating stage:", error);
      res.status(500).json({ message: "Failed to create stage" });
    }
  });

  // Update stage (admin only)
  app.put('/api/crm/stages/:id', requireAuth, async (req: any, res) => {
    try {
      const user = req.user;
      const { id } = req.params;
      
      if (user.role !== 'admin') {
        return res.status(403).json({ message: "Only admins can update stages" });
      }
      
      const updated = await storage.updateStage(id, req.body);
      res.json(updated);
    } catch (error) {
      console.error("Error updating stage:", error);
      res.status(500).json({ message: "Failed to update stage" });
    }
  });

  // Delete stage (admin only)
  app.delete('/api/crm/stages/:id', requireAuth, async (req: any, res) => {
    try {
      const user = req.user;
      const { id } = req.params;
      
      if (user.role !== 'admin') {
        return res.status(403).json({ message: "Only admins can delete stages" });
      }
      
      await storage.deleteStage(id);
      res.json({ message: "Stage deleted successfully" });
    } catch (error) {
      console.error("Error deleting stage:", error);
      res.status(500).json({ message: "Failed to delete stage" });
    }
  });

  // Reorder stages (admin only)
  app.post('/api/crm/stages/reorder', requireAuth, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (user.role !== 'admin') {
        return res.status(403).json({ message: "Only admins can reorder stages" });
      }
      
      const { stageOrders } = req.body;
      await storage.reorderStages(stageOrders);
      res.json({ message: "Stages reordered successfully" });
    } catch (error) {
      console.error("Error reordering stages:", error);
      res.status(500).json({ message: "Failed to reorder stages" });
    }
  });

  // Inactive clients endpoints
  app.get('/api/crm/inactive-clients', requireAuth, async (req: any, res) => {
    try {
      const user = req.user;
      const { includeDismissed } = req.query;

      // Aplicar filtros de rol desde el backend basándose en el usuario autenticado
      // NO confiar en parámetros de consulta para seguridad
      const inactiveClients = await storage.getInactiveClients({
        userId: user.id,
        role: user.role,
        includeDismissed: includeDismissed === 'true',
      });

      res.json(inactiveClients);
    } catch (error) {
      console.error("Error fetching inactive clients:", error);
      res.status(500).json({ message: "Failed to fetch inactive clients" });
    }
  });

  app.post('/api/crm/inactive-clients/update', requireAuth, async (req: any, res) => {
    try {
      const user = req.user;

      // Only admin and supervisors can update inactive clients list
      if (user.role !== 'admin' && user.role !== 'supervisor') {
        return res.status(403).json({ message: "Only admins and supervisors can update inactive clients" });
      }

      const count = await storage.updateInactiveClients();
      res.json({ message: `Updated ${count} inactive clients successfully`, count });
    } catch (error) {
      console.error("Error updating inactive clients:", error);
      res.status(500).json({ message: "Failed to update inactive clients" });
    }
  });

  app.post('/api/crm/inactive-clients/:id/add-to-crm', requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { leadId } = req.body;

      if (!leadId) {
        return res.status(400).json({ message: "Lead ID is required" });
      }

      const success = await storage.markInactiveClientAddedToCrm(id, leadId);
      
      if (success) {
        res.json({ message: "Client marked as added to CRM successfully" });
      } else {
        res.status(500).json({ message: "Failed to mark client as added to CRM" });
      }
    } catch (error) {
      console.error("Error marking client as added to CRM:", error);
      res.status(500).json({ message: "Failed to mark client as added to CRM" });
    }
  });

  app.post('/api/crm/inactive-clients/:id/dismiss', requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;

      const success = await storage.dismissInactiveClient(id);
      
      if (success) {
        res.json({ message: "Alert dismissed successfully" });
      } else {
        res.status(500).json({ message: "Failed to dismiss alert" });
      }
    } catch (error) {
      console.error("Error dismissing alert:", error);
      res.status(500).json({ message: "Failed to dismiss alert" });
    }
  });

  // ============================================
  // NOTIFICATION ENDPOINTS - Sistema robusto de notificaciones internas
  // ============================================

  // Get all notifications for current user (filtered by role and department)
  app.get('/api/notifications', requireAuth, async (req: any, res) => {
    try {
      const user = req.user;
      const { isArchived = 'false', type, priority, department } = req.query;
      
      const filters = {
        isArchived: isArchived === 'true',
        type: type as string,
        priority: priority as string,
        department: department as string,
      };
      
      const notifications = await storage.getNotificationsForUser(user.id, user.role, user.assignedSegment, filters);
      res.json(notifications);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });

  // ==================== NOTIFICATIONS SYSTEM ====================
  // Authorized roles for creating notifications
  const NOTIFICATION_CREATOR_ROLES = ['admin', 'supervisor', 'logistica_bodega', 'logistica', 'laboratorio', 'area_produccion', 'area_logistica', 'area_aplicacion', 'produccion', 'planificacion'];
  
  // Authorized roles for archiving notifications
  const NOTIFICATION_ARCHIVER_ROLES = ['admin', 'supervisor'];
  
  // Get unread notification count for current user
  app.get('/api/notifications/unread-count', requireAuth, async (req: any, res) => {
    try {
      const user = req.user;
      
      const count = await storage.getUnreadNotificationCount(user.id, user.role, user.assignedSegment);
      res.json({ count });
    } catch (error) {
      console.error("Error fetching unread count:", error);
      res.status(500).json({ message: "Failed to fetch unread count" });
    }
  });

  // Create new notification (manual) - Only authorized roles can create
  app.post('/api/notifications', requireRoles(NOTIFICATION_CREATOR_ROLES), async (req: any, res) => {
    try {
      const user = req.user;
      
      // Validate request body
      const validatedData = insertNotificationSchema.parse({
        ...req.body,
        createdBy: user.id,
        createdByName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
      });
      
      const notification = await storage.createNotification(validatedData);
      res.status(201).json(notification);
    } catch (error: any) {
      console.error("Error creating notification:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ 
          message: "Datos inválidos", 
          details: error.issues.map((issue: any) => `${issue.path.join('.')}: ${issue.message}`).join(', ')
        });
      }
      res.status(500).json({ message: "Failed to create notification" });
    }
  });

  // Mark notification as read
  app.post('/api/notifications/:id/read', requireAuth, async (req: any, res) => {
    try {
      const user = req.user;
      const { id } = req.params;
      
      const success = await storage.markNotificationAsRead(id, user.id);
      
      if (success) {
        res.json({ message: "Notification marked as read" });
      } else {
        res.status(500).json({ message: "Failed to mark notification as read" });
      }
    } catch (error) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({ message: "Failed to mark notification as read" });
    }
  });

  // Archive notification - Only admin and supervisor can archive
  app.post('/api/notifications/:id/archive', requireRoles(NOTIFICATION_ARCHIVER_ROLES), async (req: any, res) => {
    try {
      const user = req.user;
      const { id } = req.params;
      
      const success = await storage.archiveNotification(id, user.id);
      
      if (success) {
        res.json({ message: "Notification archived successfully" });
      } else {
        res.status(500).json({ message: "Failed to archive notification" });
      }
    } catch (error) {
      console.error("Error archiving notification:", error);
      res.status(500).json({ message: "Failed to archive notification" });
    }
  });

  // Get read statistics for a notification (who has read it)
  app.get('/api/notifications/:id/reads', requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      
      const reads = await storage.getNotificationReads(id);
      res.json(reads);
    } catch (error) {
      console.error("Error fetching notification reads:", error);
      res.status(500).json({ message: "Failed to fetch notification reads" });
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
      
      const itemData = addOrderItemSchema.parse(req.body);
      
      const item = await storage.addOrderItem(orderId, itemData);
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

  // Update quote status
  app.patch('/api/quotes/:id/status', requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const user = req.user;
      
      const quote = await storage.getQuoteById(id);
      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }
      
      // Role-based access control
      if (user.role === 'salesperson' && quote.createdBy !== user.id) {
        return res.status(403).json({ message: "Not authorized to update this quote" });
      }
      
      // Reception can only update status to "converted" or "rejected" and only for "sent" quotes
      if (user.role === 'reception') {
        if (quote.status !== 'sent') {
          return res.status(403).json({ message: "Solo se pueden actualizar presupuestos enviados" });
        }
        if (!['converted', 'rejected'].includes(status)) {
          return res.status(403).json({ message: "Recepción solo puede marcar como convertido o rechazado" });
        }
      }
      
      // Validate status
      const validStatuses = ["draft", "sent", "accepted", "rejected", "converted"];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: "Invalid status value" });
      }
      
      const updatedQuote = await storage.updateQuote(id, { status });
      res.json(updatedQuote);
    } catch (error) {
      console.error("Error updating quote status:", error);
      res.status(500).json({ message: "Failed to update quote status" });
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
      
      // Recalculate quote totals after adding item
      await storage.recalculateQuoteTotals(quoteId);
      
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
      const updatedItem = await storage.updateQuoteItemById(id, validatedData);
      
      // Recalculate quote totals after updating item
      await storage.recalculateQuoteTotals(item.quoteId);
      
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
      
      await storage.deleteQuoteItemById(id);
      
      // Recalculate quote totals after deleting item
      await storage.recalculateQuoteTotals(item.quoteId);
      
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

  // Duplicate Quote for editing (creates new quote based on existing one)
  app.post('/api/quotes/:id/duplicate', requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const user = req.user;
      
      const originalQuote = await storage.getQuoteById(id);
      if (!originalQuote) {
        return res.status(404).json({ message: "Quote not found" });
      }
      
      // Role-based access control - admin, supervisor, and quote creator can duplicate
      const canDuplicate = user.role === 'admin' || user.role === 'supervisor' || originalQuote.createdBy === user.id;
      
      if (!canDuplicate) {
        return res.status(403).json({ message: "Not authorized to duplicate this quote" });
      }
      
      // Use the atomic duplicate method
      const newQuote = await storage.duplicateQuote(id, user.id);
      
      res.status(201).json({
        ...newQuote,
        message: `Nueva cotización creada basada en #${originalQuote.quoteNumber}`
      });
    } catch (error) {
      console.error("Error duplicating quote:", error);
      res.status(500).json({ message: "Failed to duplicate quote" });
    }
  });

  // Enhanced CRUD endpoints for Orders with items
  app.get('/api/orders/:id/with-items', requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const user = req.user;
      
      const order = await storage.getOrderWithItems(id);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }
      
      // Role-based access control
      const canView = user.role === 'admin' || user.role === 'supervisor' || order.createdBy === user.id;
      
      if (!canView) {
        return res.status(403).json({ message: "Access denied to this order" });
      }
      
      res.json(order);
    } catch (error) {
      console.error("Error fetching order with items:", error);
      res.status(500).json({ message: "Failed to fetch order with items" });
    }
  });

  // Update individual order item with automatic recalculation
  app.patch('/api/order-items/:id', requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const user = req.user;
      
      // Get the order item to verify ownership via order
      const item = await storage.getOrderItemById(id);
      if (!item) {
        return res.status(404).json({ message: "Order item not found" });
      }
      
      const order = await storage.getOrderById(item.orderId);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }
      
      // Role-based access control - only admin and supervisor can update order items
      const canUpdate = user.role === 'admin' || user.role === 'supervisor';
      
      if (!canUpdate) {
        return res.status(403).json({ message: "Not authorized to update this order item" });
      }
      
      const validatedData = updateOrderItemByIdSchema.parse(req.body);
      const updatedItem = await storage.updateOrderItemById(id, validatedData);
      
      res.json(updatedItem);
    } catch (error) {
      console.error("Error updating order item:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors 
        });
      }
      res.status(500).json({ message: "Failed to update order item" });
    }
  });

  // Delete individual order item with automatic recalculation
  app.delete('/api/order-items/:id', requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const user = req.user;
      
      // Get the order item to verify ownership via order
      const item = await storage.getOrderItemById(id);
      if (!item) {
        return res.status(404).json({ message: "Order item not found" });
      }
      
      const order = await storage.getOrderById(item.orderId);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }
      
      // Role-based access control - only admin and supervisor can delete order items
      const canDelete = user.role === 'admin' || user.role === 'supervisor';
      
      if (!canDelete) {
        return res.status(403).json({ message: "Not authorized to delete this order item" });
      }
      
      await storage.deleteOrderItemById(id);
      res.json({ message: "Order item deleted successfully" });
    } catch (error) {
      console.error("Error deleting order item:", error);
      res.status(500).json({ message: "Failed to delete order item" });
    }
  });

  // Enhanced CRUD endpoints for Quotes with items
  app.get('/api/quotes/:id/with-items', requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const user = req.user;
      
      const quote = await storage.getQuoteWithItems(id);
      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }
      
      // Role-based access control
      if (user.role === 'salesperson' && quote.createdBy !== user.id) {
        return res.status(403).json({ message: "Access denied to this quote" });
      }
      
      res.json(quote);
    } catch (error) {
      console.error("Error fetching quote with items:", error);
      res.status(500).json({ message: "Failed to fetch quote with items" });
    }
  });

  // Send quote PDF via email
  app.post('/api/quotes/:id/send-email', requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const user = req.user;
      const { pdfBase64, recipientEmail } = req.body;

      if (!pdfBase64) {
        return res.status(400).json({ message: "PDF data is required" });
      }

      // Check if email service is configured
      if (!emailService.isConfigured()) {
        return res.status(503).json({ 
          message: "Email service not configured. Please contact administrator.",
          configured: false
        });
      }

      // Get quote to verify access and get quote details
      const quote = await storage.getQuoteById(id);
      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }

      // Role-based access control
      const canSend = user.role === 'admin' || user.role === 'supervisor' || quote.createdBy === user.id;
      if (!canSend) {
        return res.status(403).json({ message: "Not authorized to send this quote" });
      }

      // Convert base64 to buffer
      const pdfBuffer = Buffer.from(pdfBase64, 'base64');

      // Send email with default recipient or custom one
      const recipient = recipientEmail || 'contacto@pinturaspanoramica.cl';
      await emailService.sendQuoteEmail(
        quote.quoteNumber,
        quote.clientName,
        pdfBuffer,
        recipient
      );

      res.json({ 
        message: "Email sent successfully",
        sentTo: recipient
      });
    } catch (error) {
      console.error("Error sending quote email:", error);
      res.status(500).json({ 
        message: "Failed to send email",
        error: error instanceof Error ? error.message : "Unknown error"
      });
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

  // Get ecommerce products with images and prices (excluding grouped products)
  app.get('/api/store/products', async (req: any, res) => {
    try {
      const { search, categoria } = req.query;
      
      const filters = {
        search: search || undefined,
        categoria: categoria || undefined,
        activo: true, // Only show active products
        groupId: null // Only fetch products WITHOUT a group (ungrouped products)
      };

      const ungroupedProducts = await storage.getEcommerceAdminProducts(filters);
      
      res.json(ungroupedProducts);
    } catch (error) {
      console.error("Error fetching store products:", error);
      res.status(500).json({ message: "Failed to fetch store products" });
    }
  });

  // Get store categories (including product groups)
  app.get('/api/store/categories', async (req: any, res) => {
    try {
      // Get categories from individual products
      const productCategories = await storage.getEcommerceCategories();
      
      // Get categories from product groups
      const groups = await storage.getProductGroups({ activo: true });
      const groupCategories = groups
        .map(g => g.categoria)
        .filter((cat): cat is string => !!cat && cat.trim() !== '');
      
      // Combine and deduplicate categories
      const allCategories = Array.from(new Set([...productCategories, ...groupCategories])).sort();
      
      res.json(allCategories);
    } catch (error) {
      console.error("Error fetching store categories:", error);
      res.status(500).json({ message: "Failed to fetch store categories" });
    }
  });

  // Get product groups with variants for store
  app.get('/api/store/groups', async (req: any, res) => {
    try {
      const groups = await storage.getProductGroups({ activo: true });
      
      // For each group, fetch its variant products
      const groupsWithProducts = await Promise.all(
        groups.map(async (group) => {
          const products = await storage.getEcommerceAdminProducts({
            groupId: group.id,
            activo: true
          });
          
          return {
            ...group,
            productos: products
          };
        })
      );
      
      // Only return groups that have products
      const activeGroups = groupsWithProducts.filter(g => g.productos.length > 0);
      res.json(activeGroups);
    } catch (error) {
      console.error("Error fetching store product groups:", error);
      res.status(500).json({ message: "Failed to fetch product groups" });
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

  // Single image uploader for eCommerce products
  const uploadSingleImage = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit for single images
    fileFilter: (req, file, cb) => {
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      if (validTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Only image files (JPG, PNG, GIF, WEBP) are allowed'));
      }
    }
  });

  // Upload single image and auto-associate by SKU (filename)
  app.post('/api/ecommerce/admin/upload-single-image',
    requireAuth,
    requireAdminOrSupervisor,
    uploadSingleImage.single('image'),
    asyncHandler(async (req: any, res: any) => {
      if (!req.file) {
        return res.status(400).json({ message: "No image file provided" });
      }

      const imageBuffer = req.file.buffer;
      const fileName = req.file.originalname;
      const fileExt = fileName.substring(fileName.lastIndexOf('.'));
      
      // Extract SKU from filename (remove extension)
      const sku = fileName.substring(0, fileName.lastIndexOf('.')).toUpperCase();
      
      console.log(`📸 [SINGLE IMAGE] Uploading image: ${fileName} -> SKU: ${sku}`);

      try {
        // Find product by SKU
        const products = await storage.getEcommerceAdminProducts({ search: sku });
        const product = products.find(p => p.codigo.toUpperCase() === sku);

        // Upload to Object Storage (permanent storage)
        const objectStorageService = new ObjectStorageService();
        const imageName = `${sku}_${Date.now()}${fileExt}`;
        const publicUrl = await objectStorageService.uploadImage(
          imageName, 
          imageBuffer, 
          req.file.mimetype || 'image/png'
        );
        
        console.log(`☁️ [SINGLE IMAGE] Uploaded to Object Storage: ${imageName}`);

        if (product) {
          // Update product with image URL immediately
          await storage.updateEcommerceAdminProduct(product.id, { imagenUrl: publicUrl });
          console.log(`✅ [SINGLE IMAGE] Image replaced for product: ${product.producto}`);
          
          res.json({
            success: true,
            matched: true,
            productCode: sku,
            productName: product.producto,
            imageUrl: publicUrl,
            message: `Imagen asociada a: ${product.producto}`
          });
        } else {
          console.log(`⚠️ [SINGLE IMAGE] No product found for SKU: ${sku}`);
          res.json({
            success: true,
            matched: false,
            productCode: sku,
            imageUrl: publicUrl,
            message: `Imagen subida pero no se encontró producto con SKU: ${sku}`
          });
        }
      } catch (error) {
        console.error('❌ [SINGLE IMAGE] Error uploading image:', error);
        res.status(500).json({
          message: "Error al subir imagen",
          error: error instanceof Error ? error.message : 'Error desconocido'
        });
      }
    })
  );

  // Upload image for specific product
  app.post('/api/ecommerce/admin/upload-product-image',
    requireAuth,
    requireAdminOrSupervisor,
    uploadSingleImage.single('image'),
    asyncHandler(async (req: any, res: any) => {
      if (!req.file) {
        return res.status(400).json({ message: "No image file provided" });
      }

      const { productId, productCode } = req.body;
      
      if (!productId || !productCode) {
        return res.status(400).json({ message: "Product ID and code are required" });
      }

      const imageBuffer = req.file.buffer;
      const fileName = req.file.originalname;
      const fileExt = fileName.substring(fileName.lastIndexOf('.'));
      
      console.log(`📸 [PRODUCT IMAGE] Uploading image for product: ${productCode} (ID: ${productId})`);

      try {
        // Upload to Object Storage (permanent storage)
        const objectStorageService = new ObjectStorageService();
        const imageName = `${productCode}_${Date.now()}${fileExt}`;
        const publicUrl = await objectStorageService.uploadImage(
          imageName, 
          imageBuffer, 
          req.file.mimetype || 'image/png'
        );
        
        console.log(`☁️ [PRODUCT IMAGE] Uploaded to Object Storage: ${imageName}`);

        // Update product with image URL immediately
        await storage.updateEcommerceAdminProduct(productId, { imagenUrl: publicUrl });
        
        console.log(`✅ [PRODUCT IMAGE] Image uploaded for product: ${productCode}`);
        
        res.json({
          success: true,
          productId,
          productCode,
          imageUrl: publicUrl,
          message: `Imagen actualizada para producto: ${productCode}`
        });
      } catch (error) {
        console.error('❌ [PRODUCT IMAGE] Error uploading image:', error);
        res.status(500).json({
          message: "Error al subir imagen",
          error: error instanceof Error ? error.message : 'Error desconocido'
        });
      }
    })
  );

  // ZIP image importer for eCommerce products
  const uploadZip = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit (increased from 50MB)
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

  // New improved streaming ZIP image importer with job-based processing
  app.post('/api/ecommerce/admin/upload-images', 
    requireAuth, 
    requireAdminOrSupervisor,
    uploadZip.single('zipFile'),
    asyncHandler(async (req: any, res: any) => {
      if (!req.file) {
        return res.status(400).json({ message: "No ZIP file provided" });
      }

      const { user } = req as any;
      const zipBuffer = req.file.buffer;
      const fileName = req.file.originalname;
      const fileSize = req.file.size;
      
      console.log(`🚀 [ZIP IMPORT] Starting new ZIP import job: ${fileName} (${Math.round(fileSize / (1024 * 1024))}MB)`);

      try {
        // Create a job record immediately for tracking
        const jobId = nanoid();
        const jobRecord = {
          id: jobId,
          fileType: 'image_zip',
          fileName: fileName,
          uploadedBy: user.id,
          status: 'pending',
          fileSize: fileSize,
          totalFiles: 0,
          processedFiles: 0,
          successfulFiles: 0,
          failedFiles: 0,
          progressData: {
            currentBatch: 0,
            totalBatches: 0,
            currentFile: '',
            phase: 'initializing'
          },
          resultData: {
            results: [],
            summary: {
              matched: 0,
              unmatched: 0,
              errors: []
            }
          }
        };

        await db.insert(fileUploads).values(jobRecord);
        
        console.log(`📋 [ZIP IMPORT] Created job record: ${jobId}`);

        // Start background processing (don't await - return jobId immediately)
        processZipInBackground(jobId, zipBuffer, fileName, user.id).catch(error => {
          console.error(`💥 [ZIP IMPORT] Background job ${jobId} failed:`, error);
          // Update job status to error
          updateJobStatus(jobId, 'error', `Critical error: ${error.message || error}`);
        });

        // Return job ID immediately for polling
        res.json({
          jobId: jobId,
          message: "Importación iniciada. Use el jobId para consultar el progreso.",
          status: "started"
        });

      } catch (error) {
        console.error("💥 [ZIP IMPORT] Critical error starting job:", error);
        
        res.status(500).json({ 
          message: "Error crítico iniciando importación",
          error: error instanceof Error ? error.message : 'Error desconocido',
          type: 'job_creation_error'
        });
      }
    })
  );

  // Get job status endpoint
  app.get('/api/ecommerce/admin/upload-images/:jobId/status',
    requireAuth,
    requireAdminOrSupervisor,
    asyncHandler(async (req: any, res: any) => {
      const { jobId } = req.params;
      
      try {
        const job = await db
          .select()
          .from(fileUploads)
          .where(eq(fileUploads.id, jobId))
          .limit(1);

        if (job.length === 0) {
          return res.status(404).json({ message: "Job not found" });
        }

        const jobData = job[0];
        
        res.json({
          jobId: jobId,
          status: jobData.status,
          fileName: jobData.fileName,
          fileSize: jobData.fileSize,
          totalFiles: jobData.totalFiles,
          processedFiles: jobData.processedFiles,
          successfulFiles: jobData.successfulFiles,
          failedFiles: jobData.failedFiles,
          isCompleted: jobData.isCompleted,
          progressData: jobData.progressData,
          resultData: jobData.resultData,
          uploadedAt: jobData.uploadedAt,
          completedAt: jobData.completedAt,
          errorMessage: jobData.errorMessage
        });

      } catch (error) {
        console.error("Error fetching job status:", error);
        res.status(500).json({ message: "Failed to fetch job status" });
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

  // Security validation for file paths (prevent Zip Slip attacks)
  function isValidFilePath(filePath: string): boolean {
    // Reject paths containing ".." or starting with "/"
    if (filePath.includes('..') || filePath.startsWith('/') || filePath.includes('\\')) {
      return false;
    }
    // Reject system files and directories
    const fileName = path.basename(filePath);
    if (fileName.startsWith('.') || fileName.toLowerCase().includes('__macosx')) {
      return false;
    }
    return true;
  }

  // Extract product SKU from filename
  function extractProductSku(fileName: string): string {
    const baseName = path.basename(fileName);
    // Remove file extension and clean up
    const sku = baseName.replace(/\.(png|jpg|jpeg|gif|webp)$/i, '');
    // Normalize: uppercase, trim spaces, replace common separators
    return sku.trim().toUpperCase().replace(/[-_\s]+/g, '');
  }

  // Update job status in database
  async function updateJobStatus(
    jobId: string, 
    status: string, 
    errorMessage?: string,
    updateData: Partial<{
      totalFiles: number;
      processedFiles: number;
      successfulFiles: number;
      failedFiles: number;
      progressData: any;
      resultData: any;
      isCompleted: boolean;
    }> = {}
  ): Promise<void> {
    try {
      const updateFields: any = { 
        status,
        ...updateData
      };

      if (errorMessage) {
        updateFields.errorMessage = errorMessage;
      }

      if (status === 'success' || status === 'error' || status === 'partial') {
        updateFields.isCompleted = true;
        updateFields.completedAt = new Date();
      }

      await db
        .update(fileUploads)
        .set(updateFields)
        .where(eq(fileUploads.id, jobId));

      console.log(`📊 [ZIP IMPORT] Updated job ${jobId} status: ${status}`);
    } catch (error) {
      console.error(`💥 [ZIP IMPORT] Failed to update job ${jobId} status:`, error);
    }
  }

  // Background processing function with streaming ZIP support
  async function processZipInBackground(
    jobId: string,
    zipBuffer: Buffer,
    fileName: string,
    userId: string
  ): Promise<void> {
    console.log(`🔄 [ZIP IMPORT] Starting background processing for job ${jobId}`);

    try {
      await updateJobStatus(jobId, 'processing', undefined, {
        progressData: { phase: 'scanning', currentFile: '', currentBatch: 0 }
      });

      // Security limits
      const MAX_FILES = 300;
      const MAX_ENTRY_SIZE = 10 * 1024 * 1024; // 10MB per file
      const MAX_TOTAL_SIZE = 100 * 1024 * 1024; // 100MB total
      const BATCH_SIZE = 50; // Process 50 images per batch

      // First pass: scan ZIP to get file list and validate
      const imageFiles: Array<{ path: string; sku: string }> = [];
      let totalUncompressedSize = 0;

      console.log(`🔍 [ZIP IMPORT] Scanning ZIP contents...`);

      // Create readable stream from buffer for unzipper
      const zipStream = Readable.from(zipBuffer);
      
      await new Promise<void>((resolve, reject) => {
        zipStream
          .pipe(unzipper.Parse())
          .on('entry', (entry) => {
            const fileName = entry.path;
            const type = entry.type;
            const size = entry.vars.uncompressedSize || 0;

            // Skip directories
            if (type === 'Directory') {
              entry.autodrain();
              return;
            }

            // Validate file path security
            if (!isValidFilePath(fileName)) {
              console.log(`🚫 [ZIP IMPORT] Skipping invalid path: ${fileName}`);
              entry.autodrain();
              return;
            }

            // Check if it's an image file
            if (!isImageFile(fileName)) {
              entry.autodrain();
              return;
            }

            // Check file size limit
            if (size > MAX_ENTRY_SIZE) {
              console.log(`🚫 [ZIP IMPORT] File too large: ${fileName} (${Math.round(size / (1024 * 1024))}MB)`);
              entry.autodrain();
              return;
            }

            totalUncompressedSize += size;
            const sku = extractProductSku(fileName);
            
            if (sku) {
              imageFiles.push({ path: fileName, sku });
              console.log(`✅ [ZIP IMPORT] Found image: ${fileName} -> SKU: ${sku}`);
            } else {
              console.log(`⚠️ [ZIP IMPORT] Could not extract SKU from: ${fileName}`);
            }

            entry.autodrain();
          })
          .on('error', reject)
          .on('end', resolve);
      });

      console.log(`📊 [ZIP IMPORT] Scan complete: ${imageFiles.length} images found`);

      // Validate limits
      if (imageFiles.length > MAX_FILES) {
        throw new Error(`ZIP contains too many images (${imageFiles.length}). Maximum: ${MAX_FILES}`);
      }

      if (totalUncompressedSize > MAX_TOTAL_SIZE) {
        throw new Error(`Total uncompressed size too large (${Math.round(totalUncompressedSize / (1024 * 1024))}MB). Maximum: ${Math.round(MAX_TOTAL_SIZE / (1024 * 1024))}MB`);
      }

      // Update job with total file count
      const totalBatches = Math.ceil(imageFiles.length / BATCH_SIZE);
      await updateJobStatus(jobId, 'processing', undefined, {
        totalFiles: imageFiles.length,
        progressData: { 
          phase: 'processing', 
          currentBatch: 0, 
          totalBatches,
          currentFile: '',
          totalImages: imageFiles.length 
        }
      });

      // Process images in batches
      const results: Array<{
        fileName: string;
        sku: string;
        success: boolean;
        error?: string;
        errorType?: string;
      }> = [];

      let processedCount = 0;
      let successCount = 0;
      let failedCount = 0;

      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        const batchStart = batchIndex * BATCH_SIZE;
        const batchEnd = Math.min(batchStart + BATCH_SIZE, imageFiles.length);
        const batch = imageFiles.slice(batchStart, batchEnd);

        console.log(`🔄 [ZIP IMPORT] Processing batch ${batchIndex + 1}/${totalBatches} (${batch.length} files)`);

        await updateJobStatus(jobId, 'processing', undefined, {
          progressData: { 
            phase: 'processing', 
            currentBatch: batchIndex + 1, 
            totalBatches,
            currentFile: batch[0]?.path || '',
            batchSize: batch.length
          }
        });

        // Process batch concurrently but with limited concurrency
        const batchPromises = batch.map(async (fileInfo, index) => {
          // Add small delay between files to avoid overwhelming the system
          await new Promise(resolve => setTimeout(resolve, index * 10));
          
          return await processImageFile(jobId, zipBuffer, fileInfo.path, fileInfo.sku);
        });

        const batchResults = await Promise.allSettled(batchPromises);

        // Process batch results
        batchResults.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            results.push(result.value);
            if (result.value.success) {
              successCount++;
            } else {
              failedCount++;
            }
          } else {
            results.push({
              fileName: batch[index].path,
              sku: batch[index].sku,
              success: false,
              error: result.reason?.message || 'Unknown error',
              errorType: 'processing_error'
            });
            failedCount++;
          }
          processedCount++;
        });

        // Update progress after batch
        await updateJobStatus(jobId, 'processing', undefined, {
          processedFiles: processedCount,
          successfulFiles: successCount,
          failedFiles: failedCount
        });

        // Yield control to event loop between batches
        await new Promise(resolve => setImmediate(resolve));
      }

      // Final status determination
      let finalStatus = 'success';
      if (failedCount > 0) {
        finalStatus = successCount > 0 ? 'partial' : 'error';
      }

      const summary = {
        totalProcessed: processedCount,
        successful: successCount,
        failed: failedCount,
        matched: results.filter(r => r.success).length,
        unmatched: results.filter(r => !r.success && r.errorType === 'product_not_found').length,
        errors: results.filter(r => !r.success).map(r => ({
          file: r.fileName,
          sku: r.sku,
          error: r.error,
          type: r.errorType
        }))
      };

      await updateJobStatus(jobId, finalStatus, undefined, {
        processedFiles: processedCount,
        successfulFiles: successCount,
        failedFiles: failedCount,
        isCompleted: true,
        progressData: { 
          phase: 'completed', 
          currentBatch: totalBatches, 
          totalBatches,
          currentFile: '' 
        },
        resultData: {
          results,
          summary
        }
      });

      console.log(`✅ [ZIP IMPORT] Job ${jobId} completed: ${successCount} success, ${failedCount} failed`);

    } catch (error) {
      console.error(`💥 [ZIP IMPORT] Job ${jobId} failed:`, error);
      await updateJobStatus(jobId, 'error', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  // Process individual image file from ZIP
  async function processImageFile(
    jobId: string,
    zipBuffer: Buffer,
    filePath: string,
    sku: string
  ): Promise<{
    fileName: string;
    sku: string;
    success: boolean;
    error?: string;
    errorType?: string;
  }> {
    try {
      console.log(`🖼️ [ZIP IMPORT] Processing image: ${filePath} (SKU: ${sku})`);

      // Check if product exists
      const existingProduct = await storage.getEcommerceProductByCode(sku);
      
      if (!existingProduct) {
        return {
          fileName: filePath,
          sku,
          success: false,
          error: `Producto con código '${sku}' no encontrado`,
          errorType: 'product_not_found'
        };
      }

      // Extract image data from ZIP
      const imageBuffer = await extractImageFromZip(zipBuffer, filePath);
      if (!imageBuffer) {
        return {
          fileName: filePath,
          sku,
          success: false,
          error: 'No se pudo extraer la imagen del ZIP',
          errorType: 'extraction_error'
        };
      }

      // Upload image with organized path structure
      const timestamp = Date.now();
      const fileExtension = path.extname(filePath).toLowerCase() || '.png';
      const uniqueFileName = `${sku}_${timestamp}${fileExtension}`;
      
      try {
        // Upload to Object Storage (permanent storage)
        const objectStorageService = new ObjectStorageService();
        const storageKey = `product-images/${sku}/${uniqueFileName}`;
        const imageUrl = await objectStorageService.uploadImage(storageKey, imageBuffer, getContentType(fileExtension.substring(1)));
        console.log(`☁️ [ZIP IMPORT] Uploaded to ObjectStorage: ${storageKey}`);

        // Update product with new image URL
        await db
          .update(ecommerceProducts)
          .set({ imagenUrl: imageUrl })
          .where(eq(ecommerceProducts.id, existingProduct.id));

        console.log(`✅ [ZIP IMPORT] Updated product ${sku} with image`);

        return {
          fileName: filePath,
          sku,
          success: true
        };

      } catch (uploadError) {
        console.error(`💥 [ZIP IMPORT] Upload failed for ${sku}:`, uploadError);
        return {
          fileName: filePath,
          sku,
          success: false,
          error: uploadError instanceof Error ? uploadError.message : 'Error de carga',
          errorType: 'upload_error'
        };
      }

    } catch (error) {
      console.error(`💥 [ZIP IMPORT] Error processing ${filePath}:`, error);
      return {
        fileName: filePath,
        sku,
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
        errorType: 'processing_error'
      };
    }
  }

  // Extract specific image from ZIP buffer
  async function extractImageFromZip(zipBuffer: Buffer, targetPath: string): Promise<Buffer | null> {
    return new Promise((resolve) => {
      const zipStream = Readable.from(zipBuffer);
      let found = false;
      
      zipStream
        .pipe(unzipper.Parse())
        .on('entry', (entry) => {
          if (entry.path === targetPath && !found) {
            found = true;
            const chunks: Buffer[] = [];
            
            entry.on('data', (chunk) => chunks.push(chunk));
            entry.on('end', () => {
              const buffer = Buffer.concat(chunks);
              resolve(buffer);
            });
            entry.on('error', () => resolve(null));
          } else {
            entry.autodrain();
          }
        })
        .on('error', () => resolve(null))
        .on('end', () => {
          if (!found) resolve(null);
        });
    });
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
            // Map CSV columns DIRECTLY to database fields with EXACT NAMES
            // Store all values as strings - Drizzle will convert them appropriately 
            const processedRow: any = {};
            
            // Map all CSV columns directly to database fields
            const csvFields = [
              'IDMAEEDO', 'TIDO', 'NUDO', 'ENDO', 'SUENDO', 'SUDO', 'FEEMDO', 'FEER', 
              'MODO', 'TIMODO', 'TIDEVE', 'TIDEVEFE', 'TIDEVEHO', 'PPPRNE', 'TAMOPPPR', 
              'VANELI', 'FEEMLI', 'KOFULIDO', 'LILG', 'PRCT', 'NULIDO', 'FEERLI', 
              'SULIDO', 'BOSULIDO', 'LUVTLIDO', 'KOPRCT', 'UD01PR', 'NOKOZO', 'IDMAEDDO',
              'NUSEPR', 'CAPRCO1', 'CAPRAD1', 'CAPREX1', 'UD02PR', 'CAPRCO2', 'CAPRAD2', 
              'CAPREX2', 'OCDO', 'OBDO', 'NOKOEN', 'ZOEN', 'DIEN', 'COMUNA', 'TIPR',
              'NOKOPR', 'PFPR', 'FMPR', 'RUPR', 'MRPR', 'STFI1', 'STFI2', 'PRRG', 
              'KOPRTE', 'ENDOFI', 'UBICACION', 'OBSERVA'
            ];
            
            // Date fields that need parseDate processing
            const dateFields = ['FEEMDO', 'FEER', 'TIDEVEFE', 'FEEMLI', 'FEERLI'];
            
            csvFields.forEach(field => {
              if (dateFields.includes(field)) {
                // Parse date fields with parseDate function
                processedRow[field] = row[field] ? parseDate(row[field]) : null;
              } else {
                // All other fields as strings or null
                processedRow[field] = row[field] || null;
              }
            });
            
            // System fields
            processedRow.importBatch = importBatch;

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
    const { status, salesperson, segment, startDate, endDate, limit = 500, offset = 0 } = req.query;
    
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

  // Clear all NVV data - DESTRUCTIVE OPERATION
  app.delete('/api/nvv/clear-all', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      // Restrict to admin role only for safety
      if (req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Solo administradores pueden eliminar todos los datos NVV'
        });
      }

      const result = await storage.clearAllNvvData();
      res.json(result);
    } catch (error) {
      console.error('Error clearing NVV data:', error);
      res.status(500).json({
        success: false,
        message: 'Error al eliminar datos NVV'
      });
    }
  }));

  // Get NVV total summary without date filters
  app.get('/api/nvv/total', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const totalSummary = await storage.getNvvTotalSummary();
      res.json(totalSummary);
    } catch (error) {
      console.error('Error fetching NVV total summary:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener sumatoria total NVV'
      });
    }
  }));

  // Get NVV summary metrics
  app.get('/api/nvv/metrics', requireAuth, asyncHandler(async (req: any, res: any) => {
    const { salesperson, segment, startDate, endDate, period, filterType } = req.query;
    
    // Use same date range logic as sales metrics
    const dateRange = getDateRange(period as string, filterType as string);
    
    const options: any = {};
    if (salesperson) options.salesperson = salesperson;
    if (segment) options.segment = segment;
    
    // Use date range if period/filterType provided, otherwise use startDate/endDate
    if (period && filterType && dateRange.startDate && dateRange.endDate) {
      options.startDate = new Date(dateRange.startDate);
      options.endDate = new Date(dateRange.endDate);
    } else {
      if (startDate) options.startDate = new Date(startDate);
      if (endDate) options.endDate = new Date(endDate);
    }

    const metrics = await storage.getNvvSummaryMetrics(options);
    res.json(metrics);
  }));

  // Update NVV status - temporarily disabled 
  app.patch('/api/nvv/:id/status', requireAuth, asyncHandler(async (req: any, res: any) => {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !['pending', 'confirmed', 'delivered', 'cancelled'].includes(status)) {
      return res.status(400).json({
        message: 'Estado inválido'
      });
    }

    // TODO: Implement updateNvvStatus function in storage
    // const success = await storage.updateNvvStatus(id, status);
    
    // Temporarily return success
    res.json({ success: true, message: 'Estado actualizado (temporalmente deshabilitado)' });
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

  // Get salesperson mapping endpoint - using direct sales transactions queries
  app.get('/api/sales-transactions/salesperson-mapping', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      // Get unique salesperson mapping directly from sales transactions
      const salespersonResults = await db
        .selectDistinct({
          kofulido: salesTransactions.kofulido,
          nokofu: salesTransactions.nokofu,
        })
        .from(salesTransactions)
        .where(
          and(
            isNotNull(salesTransactions.kofulido),
            isNotNull(salesTransactions.nokofu),
            ne(salesTransactions.kofulido, ''),
            ne(salesTransactions.nokofu, '')
          )
        );

      // Create mapping object
      const kofulidoToName: Record<string, string> = {};
      salespersonResults.forEach(result => {
        if (result.kofulido && result.nokofu) {
          kofulidoToName[result.kofulido] = result.nokofu;
        }
      });

      // Get unique segments directly from sales transactions
      const segmentResults = await db
        .selectDistinct({
          segment: salesTransactions.noruen,
        })
        .from(salesTransactions)
        .where(
          and(
            isNotNull(salesTransactions.noruen),
            ne(salesTransactions.noruen, '')
          )
        );

      const segments: Record<string, { count: number; amount: number }> = {};
      segmentResults.forEach(result => {
        if (result.segment) {
          segments[result.segment] = {
            count: 1,
            amount: 0 // We can calculate this later if needed
          };
        }
      });

      // Get mapping from salesperson (kofulido) to segment (noruen)
      const salespersonSegmentResults = await db
        .selectDistinct({
          kofulido: salesTransactions.kofulido,
          noruen: salesTransactions.noruen,
        })
        .from(salesTransactions)
        .where(
          and(
            isNotNull(salesTransactions.kofulido),
            isNotNull(salesTransactions.noruen),
            ne(salesTransactions.kofulido, ''),
            ne(salesTransactions.noruen, '')
          )
        );

      const kofulidoToSegment: Record<string, string> = {};
      salespersonSegmentResults.forEach(result => {
        if (result.kofulido && result.noruen) {
          kofulidoToSegment[result.kofulido] = result.noruen;
        }
      });

      res.json({
        kofulidoToName,
        kofulidoToSegment,
        segments
      });
    } catch (error: any) {
      console.error('Error fetching salesperson mapping:', error);
      res.status(500).json({ message: 'Failed to fetch salesperson mapping' });
    }
  }));

  // Get NVV Dashboard metrics
  app.get('/api/nvv/dashboard', requireAuth, asyncHandler(async (req: any, res: any) => {
    const metrics = await storage.getNvvDashboardMetrics();
    res.json(metrics);
  }));

  // Get NVV by salesperson with period filtering
  app.get('/api/nvv/by-salesperson', requireAuth, asyncHandler(async (req: any, res: any) => {
    const { salesperson, period, filterType } = req.query;

    if (!salesperson) {
      return res.status(400).json({ message: 'Salesperson parameter is required' });
    }

    // Get date range for filtering
    const dateRange = getDateRange(period as string, filterType as string);

    // Convert string dates to Date objects
    let startDate: Date | undefined;
    let endDate: Date | undefined;
    
    if (dateRange.startDate) {
      startDate = new Date(dateRange.startDate);
    }
    if (dateRange.endDate) {
      endDate = new Date(dateRange.endDate);
    }

    const nvvData = await storage.getNvvBySalesperson({
      salesperson: salesperson as string,
      startDate,
      endDate
    });

    res.json(nvvData);
  }));

  // Get NVV by segment (usando misma lógica que el gráfico del módulo NVV)
  app.get('/api/nvv/by-segment', requireAuth, asyncHandler(async (req: any, res: any) => {
    const { segment } = req.query;

    if (!segment) {
      return res.status(400).json({ message: 'Segment parameter is required' });
    }

    // Usar la MISMA lógica que el gráfico del módulo NVV:
    // 1. Obtener mapping kofulido → segment de sales_transactions
    // 2. Filtrar NVV por los KOFULIDO que mapean a este segmento
    
    // Get kofulido to segment mapping
    const salespersonSegmentResults = await db
      .selectDistinct({
        kofulido: salesTransactions.kofulido,
        noruen: salesTransactions.noruen,
      })
      .from(salesTransactions)
      .where(
        and(
          isNotNull(salesTransactions.kofulido),
          isNotNull(salesTransactions.noruen),
          ne(salesTransactions.kofulido, ''),
          ne(salesTransactions.noruen, '')
        )
      );

    const kofulidoToSegment: Record<string, string> = {};
    salespersonSegmentResults.forEach(result => {
      if (result.kofulido && result.noruen) {
        kofulidoToSegment[result.kofulido] = result.noruen;
      }
    });

    // Find all KOFULIDO codes that map to this segment
    const kofulidoCodes = Object.entries(kofulidoToSegment)
      .filter(([_, seg]) => seg.trim().toUpperCase() === segment.toString().trim().toUpperCase())
      .map(([kofulido, _]) => kofulido.trim().toUpperCase())
      .filter(Boolean);

    if (kofulidoCodes.length === 0) {
      console.log(`No salespeople found mapping to segment: ${segment}`);
      return res.json([]);
    }

    console.log(`Found ${kofulidoCodes.length} salespeople mapping to segment ${segment}: ${kofulidoCodes.join(', ')}`);

    // Get all NVV for these salespeople (sin filtros de fecha)
    const nvvData = await db
      .select({
        id: nvvPendingSales.id,
        NUDO: nvvPendingSales.NUDO,
        TIDO: nvvPendingSales.TIDO,
        FEEMDO: nvvPendingSales.FEEMDO,
        ENDO: nvvPendingSales.ENDO,
        NOKOEN: nvvPendingSales.NOKOEN,
        NOKOPR: nvvPendingSales.NOKOPR,
        KOPRCT: nvvPendingSales.KOPRCT,
        CAPREX2: nvvPendingSales.CAPREX2,
        CAPRCO2: nvvPendingSales.CAPRCO2,
        PPPRNE: nvvPendingSales.PPPRNE,
        cantidadPendiente: nvvPendingSales.cantidadPendiente,
        totalPendiente: nvvPendingSales.totalPendiente
      })
      .from(nvvPendingSales)
      .where(
        and(
          isNotNull(nvvPendingSales.KOFULIDO),
          sql`TRIM(UPPER(${nvvPendingSales.KOFULIDO})) IN (${sql.raw(kofulidoCodes.map(k => `'${k}'`).join(','))})`
        )
      )
      .orderBy(desc(nvvPendingSales.FEEMDO));

    console.log(`Found ${nvvData.length} NVV records for segment ${segment}`);

    const results = nvvData.map(row => ({
      id: row.id,
      NUDO: row.NUDO || '',
      TIDO: row.TIDO || '',
      FEEMDO: row.FEEMDO?.toString() || '',
      ENDO: row.ENDO || '',
      NOKOEN: row.NOKOEN || '',
      NOKOPR: row.NOKOPR || '',
      KOPRCT: row.KOPRCT || '',
      CAPREX2: Number(row.CAPREX2) || 0,
      CAPRCO2: Number(row.CAPRCO2) || 0,
      PPPRNE: Number(row.PPPRNE) || 0,
      cantidadPendiente: Number(row.cantidadPendiente) || 0,
      totalPendiente: Number(row.totalPendiente) || 0
    }));

    res.json(results);
  }));

  // Get NVV by branch (usando misma lógica que by-segment pero filtrando por nosudo)
  app.get('/api/nvv/by-branch', requireAuth, asyncHandler(async (req: any, res: any) => {
    const { branch } = req.query;

    if (!branch) {
      return res.status(400).json({ message: 'Branch parameter is required' });
    }

    const nvvData = await storage.getNVVByBranch(branch as string);

    const results = nvvData.map(row => ({
      id: row.id,
      NUDO: row.NUDO || '',
      TIDO: row.TIDO || '',
      FEEMDO: row.FEEMDO?.toString() || '',
      ENDO: row.ENDO || '',
      NOKOEN: row.NOKOEN || '',
      VABRDO: Number(row.VABRDO) || 0,
      KOFULIDO: row.KOFULIDO || ''
    }));

    res.json(results);
  }));

  // Get all NVV grouped by salespeople
  app.get('/api/nvv/all-by-salespeople', requireAuth, asyncHandler(async (req: any, res: any) => {
    const { period, filterType } = req.query;

    // Get date range for filtering if provided
    let startDate: Date | undefined;
    let endDate: Date | undefined;
    
    if (period && filterType) {
      const dateRange = getDateRange(period as string, filterType as string);
      // Convert string dates to Date objects
      if (dateRange.startDate) {
        startDate = new Date(dateRange.startDate);
      }
      if (dateRange.endDate) {
        endDate = new Date(dateRange.endDate);
      }
    }

    const nvvData = await storage.getAllNvvGroupedBySalespeople({
      startDate,
      endDate
    });

    res.json(nvvData);
  }));

  // Get total pending NVV amount
  app.get('/api/nvv/total-pending', requireAuth, asyncHandler(async (req: any, res: any) => {
    const total = await storage.getTotalPendingNVV();
    res.json({ total });
  }));

  // Region Management Endpoints
  // Load Comuna-Region mapping from CSV
  app.post('/api/admin/regions/load', requireAdminOrSupervisor, asyncHandler(async (req: any, res: any) => {
    try {
      console.log('🗺️ Loading comuna-region mapping from CSV...');
      await comunaRegionService.initialize();
      
      const stats = await comunaRegionService.getMappingStats();
      res.json({
        success: true,
        message: 'Comuna-region mapping loaded successfully',
        stats
      });
    } catch (error: any) {
      console.error('❌ Failed to load comuna-region mapping:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to load comuna-region mapping',
        error: error.message
      });
    }
  }));

  // Reload Comuna-Region mapping from CSV
  app.post('/api/admin/regions/reload', requireAdminOrSupervisor, asyncHandler(async (req: any, res: any) => {
    try {
      console.log('🔄 Reloading comuna-region mapping...');
      await comunaRegionService.reloadMapping();
      
      const stats = await comunaRegionService.getMappingStats();
      res.json({
        success: true,
        message: 'Comuna-region mapping reloaded successfully',
        stats
      });
    } catch (error: any) {
      console.error('❌ Failed to reload comuna-region mapping:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to reload comuna-region mapping',
        error: error.message
      });
    }
  }));

  // Get Comuna-Region mapping statistics
  app.get('/api/admin/regions/stats', requireAdminOrSupervisor, asyncHandler(async (req: any, res: any) => {
    try {
      const stats = await comunaRegionService.getMappingStats();
      res.json(stats);
    } catch (error: any) {
      console.error('❌ Failed to get mapping stats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get mapping statistics',
        error: error.message
      });
    }
  }));

  // Test Comuna region mapping for specific comunas
  app.post('/api/admin/regions/test', requireAdminOrSupervisor, asyncHandler(async (req: any, res: any) => {
    try {
      const { comunas } = req.body;
      
      if (!Array.isArray(comunas)) {
        return res.status(400).json({
          success: false,
          message: 'comunas parameter must be an array'
        });
      }

      const results = [];
      for (const comuna of comunas) {
        const result = await comunaRegionService.findRegion(comuna);
        results.push({
          input: comuna,
          ...result
        });
      }

      res.json({
        success: true,
        results
      });
    } catch (error: any) {
      console.error('❌ Failed to test comuna mapping:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to test comuna mapping',
        error: error.message
      });
    }
  }));

  // Get diagnostics about unmatched comunas from actual transaction data
  app.get('/api/admin/regions/diagnostics', requireAdminOrSupervisor, asyncHandler(async (req: any, res: any) => {
    try {
      // Get unique comunas from current transaction data
      const unmatchedComunas = await storage.getUnmatchedComunas();
      
      // Test each one with the mapping service
      const diagnostics = [];
      for (const comunaData of unmatchedComunas) {
        const result = await comunaRegionService.findRegion(comunaData.comuna);
        diagnostics.push({
          comuna: comunaData.comuna,
          transactionCount: comunaData.transactionCount,
          totalSales: comunaData.totalSales,
          mappingResult: result
        });
      }

      // Sort by transaction count (highest impact first)
      diagnostics.sort((a, b) => b.transactionCount - a.transactionCount);

      const stats = await comunaRegionService.getMappingStats();
      
      res.json({
        success: true,
        diagnostics,
        summary: {
          totalUnmatchedComunas: diagnostics.length,
          totalUnmatchedTransactions: diagnostics.reduce((sum, d) => sum + d.transactionCount, 0),
          totalUnmatchedSales: diagnostics.reduce((sum, d) => sum + d.totalSales, 0),
          mappingStats: stats
        }
      });
    } catch (error: any) {
      console.error('❌ Failed to get region diagnostics:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get region diagnostics',
        error: error.message
      });
    }
  }));

  // ==============================================
  // OBRAS (PROJECTS/WORKS) ENDPOINTS
  // ==============================================

  // Get all obras or filter by clienteId
  app.get('/api/obras', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const { clienteId } = req.query;
      const obras = await storage.getObras(clienteId);
      res.json(obras);
    } catch (error: any) {
      console.error('❌ Error al obtener obras:', error);
      res.status(500).json({
        message: 'Error al obtener obras',
        error: error.message
      });
    }
  }));

  // Get obra by ID
  app.get('/api/obras/:id', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const obra = await storage.getObra(id);
      
      if (!obra) {
        return res.status(404).json({ message: 'Obra no encontrada' });
      }
      
      res.json(obra);
    } catch (error: any) {
      console.error('❌ Error al obtener obra:', error);
      res.status(500).json({
        message: 'Error al obtener obra',
        error: error.message
      });
    }
  }));

  // Create new obra
  app.post('/api/obras', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const nuevaObra = await storage.createObra(req.body);
      res.status(201).json(nuevaObra);
    } catch (error: any) {
      console.error('❌ Error al crear obra:', error);
      res.status(500).json({
        message: 'Error al crear obra',
        error: error.message
      });
    }
  }));

  // Update obra
  app.put('/api/obras/:id', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const obraActualizada = await storage.updateObra(id, req.body);
      res.json(obraActualizada);
    } catch (error: any) {
      console.error('❌ Error al actualizar obra:', error);
      res.status(500).json({
        message: 'Error al actualizar obra',
        error: error.message
      });
    }
  }));

  // Delete obra
  app.delete('/api/obras/:id', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const { id } = req.params;
      await storage.deleteObra(id);
      res.json({ message: 'Obra eliminada correctamente' });
    } catch (error: any) {
      console.error('❌ Error al eliminar obra:', error);
      res.status(500).json({
        message: 'Error al eliminar obra',
        error: error.message
      });
    }
  }));

  // ==============================================
  // VISITAS TÉCNICAS ENDPOINTS
  // ==============================================

  // Get estadísticas dashboard de visitas técnicas
  app.get('/api/visitas-tecnicas/estadisticas/:periodo?', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const { periodo = 'current' } = req.params;
      const estadisticas = await storage.getEstadisticasVisitasTecnicas({ periodo });
      res.json(estadisticas);
    } catch (error: any) {
      console.error('❌ Error al obtener estadísticas de visitas técnicas:', error);
      res.status(500).json({
        message: 'Error al obtener estadísticas de visitas técnicas',
        error: error.message
      });
    }
  }));

  // Get listado de visitas técnicas con filtros
  app.get('/api/visitas-tecnicas/listado', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const { search, estado, tecnico, limit = 20, offset = 0 } = req.query;
      
      const options = {
        search: search || undefined,
        estado: estado !== 'all' ? estado : undefined,
        tecnico: tecnico || undefined,
        limit: parseInt(limit),
        offset: parseInt(offset)
      };

      const visitas = await storage.getListadoVisitasTecnicas(options);
      res.json(visitas);
    } catch (error: any) {
      console.error('❌ Error al obtener listado de visitas técnicas:', error);
      res.status(500).json({
        message: 'Error al obtener listado de visitas técnicas',
        error: error.message
      });
    }
  }));

  // Create nueva visita técnica
  app.post('/api/visitas-tecnicas', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      console.log('📝 Recibiendo datos de visita técnica:', JSON.stringify(req.body, null, 2));
      
      // Validar datos básicos requeridos
      const { nombreObra, direccionObra, tecnicoId, clienteId, productos, estado, recepcionistaNombre, recepcionistaCargo, observacionesGenerales } = req.body;
      
      console.log('🔍 Validando campos:', { nombreObra, direccionObra, tecnicoId, clienteId, productosCount: productos?.length });
      
      if (!nombreObra || !direccionObra || !tecnicoId) {
        const camposFaltantes = [];
        if (!nombreObra) camposFaltantes.push('nombreObra');
        if (!direccionObra) camposFaltantes.push('direccionObra');
        if (!tecnicoId) camposFaltantes.push('tecnicoId');
        
        console.error('❌ Faltan campos:', camposFaltantes);
        return res.status(400).json({
          message: `Faltan campos requeridos: ${camposFaltantes.join(', ')}`
        });
      }

      // Crear visita técnica con datos básicos
      const visitaData = {
        nombreObra,
        direccionObra,
        tecnicoId,
        clienteId: clienteId || null,
        recepcionistaNombre: recepcionistaNombre || null,
        recepcionistaCargo: recepcionistaCargo || null,
        observacionesGenerales: observacionesGenerales || null,
        estado: estado || 'borrador'
      };

      console.log('💾 Creando visita con datos:', visitaData);
      const nuevaVisita = await storage.createVisitaTecnica(visitaData);
      console.log('✅ Visita creada con ID:', nuevaVisita.id);
      
      // 🔔 Notificación automática: Nueva visita técnica programada
      const user = req.user;
      const creatorName = user.salespersonName || `${user.firstName} ${user.lastName}` || user.email;
      await NotifyHelper.notifyVisitaTecnicaCreada(
        visitaData.nombreObra,
        estado || 'Evaluación',
        creatorName
      );

      // Si hay productos, crearlos junto con sus evaluaciones
      if (productos && productos.length > 0) {
        console.log(`📦 Procesando ${productos.length} productos evaluados...`);
        
        for (const producto of productos) {
          // Detectar si es producto personalizado (custom-xxxx) o del catálogo
          const isCustomProduct = producto.productId?.startsWith('custom-');
          
          // Crear producto evaluado con todos los campos del esquema
          const productoData = {
            visitaId: nuevaVisita.id,
            productoId: isCustomProduct ? null : (producto.productId || null),
            productoManual: isCustomProduct ? producto.name : null,
            formato: producto.formato || null,
            color: producto.evaluacion?.color || null,
            lote: producto.evaluacion?.lote || null,
            fechaLlegada: producto.evaluacion?.fechaLlegada || null,
            metrosCuadradosAplicados: producto.evaluacion?.m2Aplicados ? producto.evaluacion.m2Aplicados.toString() : null,
            porcentajeAvance: producto.evaluacion?.avance ? producto.evaluacion.avance.toString() : null
          };

          console.log('  💾 Guardando producto:', producto.name);
          const [productoEvaluado] = await db.insert(productosEvaluados).values([productoData]).returning();
          
          // Si tiene evaluación técnica, crearla
          if (producto.evaluacion && productoEvaluado) {
            const evaluacionData = {
              productoEvaluadoId: productoEvaluado.id,
              aplicacion: producto.evaluacion.aplicacion || null,
              condicionesClimaticas: producto.evaluacion.clima || null,
              dilucion: producto.evaluacion.dilucion ? producto.evaluacion.dilucion.toString() : null,
              anomalias: producto.evaluacion.evidenciaDeficiencia || null,
              observacionesTecnicas: producto.evaluacion.observaciones || null,
              imagenesUrls: producto.evaluacion.imagenes || []
            };

            console.log('  📋 Guardando evaluación para:', producto.name);
            await db.insert(evaluacionesTecnicas).values([evaluacionData]);
          }
        }
        
        console.log('✅ Todos los productos y evaluaciones guardados');
      }

      res.status(201).json(nuevaVisita);
    } catch (error: any) {
      console.error('❌ Error al crear visita técnica:', error);
      res.status(500).json({
        message: 'Error al crear visita técnica',
        error: error.message
      });
    }
  }));

  // Get detalle de visita técnica
  app.get('/api/visitas-tecnicas/:id', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const visita = await storage.getVisitaTecnicaById(id);
      
      if (!visita) {
        return res.status(404).json({
          message: 'Visita técnica no encontrada'
        });
      }

      res.json(visita);
    } catch (error: any) {
      console.error('❌ Error al obtener visita técnica:', error);
      res.status(500).json({
        message: 'Error al obtener visita técnica',
        error: error.message
      });
    }
  }));

  // Update visita técnica
  app.put('/api/visitas-tecnicas/:id', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const visitaActualizada = await storage.updateVisitaTecnica(id, req.body);
      
      if (!visitaActualizada) {
        return res.status(404).json({
          message: 'Visita técnica no encontrada'
        });
      }

      res.json(visitaActualizada);
    } catch (error: any) {
      console.error('❌ Error al actualizar visita técnica:', error);
      res.status(500).json({
        message: 'Error al actualizar visita técnica',
        error: error.message
      });
    }
  }));

  // Delete visita técnica
  app.delete('/api/visitas-tecnicas/:id', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const { id } = req.params;
      
      // Solo permitir eliminar visitas en estado borrador
      const visita = await storage.getVisitaTecnicaById(id);
      if (!visita) {
        return res.status(404).json({
          message: 'Visita técnica no encontrada'
        });
      }

      if (visita.estado === 'completada') {
        return res.status(400).json({
          message: 'No se puede eliminar una visita técnica completada'
        });
      }

      const eliminada = await storage.deleteVisitaTecnica(id);
      res.json({ success: true, message: 'Visita técnica eliminada' });
    } catch (error: any) {
      console.error('❌ Error al eliminar visita técnica:', error);
      res.status(500).json({
        message: 'Error al eliminar visita técnica',
        error: error.message
      });
    }
  }));

  // Get productos para catálogo de visitas técnicas
  app.get('/api/visitas-tecnicas/productos', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const { clienteId, search } = req.query;
      
      const options = {
        clienteId: clienteId || undefined,
        search: search || undefined,
        active: true
      };

      const productos = await storage.getProductosParaVisitas(options);
      res.json(productos);
    } catch (error: any) {
      console.error('❌ Error al obtener productos para visitas:', error);
      res.status(500).json({
        message: 'Error al obtener productos para visitas',
        error: error.message
      });
    }
  }));

  // Get técnicos disponibles
  app.get('/api/visitas-tecnicas/tecnicos', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const tecnicos = await storage.getTecnicosDisponibles();
      res.json(tecnicos);
    } catch (error: any) {
      console.error('❌ Error al obtener técnicos:', error);
      res.status(500).json({
        message: 'Error al obtener técnicos',
        error: error.message
      });
    }
  }));

  // Upload evidencia para visita técnica
  app.post('/api/visitas-tecnicas/:id/evidencias', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const { tipo, descripcion, productoEvaluadoId, reclamoId } = req.body;
      
      // TODO: Implementar upload de archivos con multer
      // Por ahora solo crear el registro en base de datos
      
      const evidenciaData = {
        visitaId: id,
        tipoEvidencia: tipo,
        descripcion,
        productoEvaluadoId: productoEvaluadoId || null,
        reclamoId: reclamoId || null,
        nombreArchivo: 'temp-file.jpg', // Temporal
        urlArchivo: '/temp/evidencia.jpg', // Temporal
        tipoArchivo: 'image/jpeg',
        tamanio: 0
      };

      const evidencia = await storage.createEvidencia(evidenciaData);
      res.status(201).json(evidencia);
    } catch (error: any) {
      console.error('❌ Error al crear evidencia:', error);
      res.status(500).json({
        message: 'Error al crear evidencia',
        error: error.message
      });
    }
  }));

  // Completar visita técnica (cambiar estado a completada)
  app.post('/api/visitas-tecnicas/:id/completar', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const { id } = req.params;
      
      // Validar que la visita existe y tiene los datos mínimos
      const visita = await storage.getVisitaTecnicaById(id);
      if (!visita) {
        return res.status(404).json({
          message: 'Visita técnica no encontrada'
        });
      }

      if (visita.estado === 'completada') {
        return res.status(400).json({
          message: 'La visita técnica ya está completada'
        });
      }

      // Cambiar estado a completada
      const visitaCompletada = await storage.updateVisitaTecnica(id, { estado: 'completada' });
      res.json(visitaCompletada);
    } catch (error: any) {
      console.error('❌ Error al completar visita técnica:', error);
      res.status(500).json({
        message: 'Error al completar visita técnica',
        error: error.message
      });
    }
  }));

  // =============================================================================
  // TINTOMETRÍA ROUTES
  // =============================================================================

  // PIGMENTS routes
  app.get('/api/tintometria/pigments', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const pigments = await storage.getAllPigments();
      res.json(pigments);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al obtener pigmentos', error: error.message });
    }
  }));

  app.get('/api/tintometria/pigments/:id', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const pigment = await storage.getPigmentById(parseInt(req.params.id));
      if (!pigment) {
        return res.status(404).json({ message: 'Pigmento no encontrado' });
      }
      res.json(pigment);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al obtener pigmento', error: error.message });
    }
  }));

  app.post('/api/tintometria/pigments', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const pigment = await storage.createPigment(req.body);
      res.status(201).json(pigment);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al crear pigmento', error: error.message });
    }
  }));

  app.put('/api/tintometria/pigments/:id', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const pigment = await storage.updatePigment(parseInt(req.params.id), req.body);
      res.json(pigment);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al actualizar pigmento', error: error.message });
    }
  }));

  app.delete('/api/tintometria/pigments/:id', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      await storage.deletePigment(parseInt(req.params.id));
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: 'Error al eliminar pigmento', error: error.message });
    }
  }));

  // BASES routes
  app.get('/api/tintometria/bases', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const bases = await storage.getAllBases();
      res.json(bases);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al obtener bases', error: error.message });
    }
  }));

  app.get('/api/tintometria/bases/:id', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const base = await storage.getBaseById(parseInt(req.params.id));
      if (!base) {
        return res.status(404).json({ message: 'Base no encontrada' });
      }
      res.json(base);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al obtener base', error: error.message });
    }
  }));

  app.post('/api/tintometria/bases', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const base = await storage.createBase(req.body);
      res.status(201).json(base);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al crear base', error: error.message });
    }
  }));

  app.put('/api/tintometria/bases/:id', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const base = await storage.updateBase(parseInt(req.params.id), req.body);
      res.json(base);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al actualizar base', error: error.message });
    }
  }));

  app.delete('/api/tintometria/bases/:id', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      await storage.deleteBase(parseInt(req.params.id));
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: 'Error al eliminar base', error: error.message });
    }
  }));

  // ENVASES routes
  app.get('/api/tintometria/envases', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const envases = await storage.getAllEnvases();
      res.json(envases);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al obtener envases', error: error.message });
    }
  }));

  app.get('/api/tintometria/envases/:id', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const envase = await storage.getEnvaseById(parseInt(req.params.id));
      if (!envase) {
        return res.status(404).json({ message: 'Envase no encontrado' });
      }
      res.json(envase);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al obtener envase', error: error.message });
    }
  }));

  app.post('/api/tintometria/envases', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const envase = await storage.createEnvase(req.body);
      res.status(201).json(envase);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al crear envase', error: error.message });
    }
  }));

  app.put('/api/tintometria/envases/:id', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const envase = await storage.updateEnvase(parseInt(req.params.id), req.body);
      res.json(envase);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al actualizar envase', error: error.message });
    }
  }));

  app.delete('/api/tintometria/envases/:id', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      await storage.deleteEnvase(parseInt(req.params.id));
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: 'Error al eliminar envase', error: error.message });
    }
  }));

  // COLORES routes
  app.get('/api/tintometria/colores', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const colores = await storage.getAllColores();
      res.json(colores);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al obtener colores', error: error.message });
    }
  }));

  app.get('/api/tintometria/colores/:id', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const color = await storage.getColorById(parseInt(req.params.id));
      if (!color) {
        return res.status(404).json({ message: 'Color no encontrado' });
      }
      res.json(color);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al obtener color', error: error.message });
    }
  }));

  app.post('/api/tintometria/colores', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const color = await storage.createColor(req.body);
      res.status(201).json(color);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al crear color', error: error.message });
    }
  }));

  app.put('/api/tintometria/colores/:id', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const color = await storage.updateColor(parseInt(req.params.id), req.body);
      res.json(color);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al actualizar color', error: error.message });
    }
  }));

  app.delete('/api/tintometria/colores/:id', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      await storage.deleteColor(parseInt(req.params.id));
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: 'Error al eliminar color', error: error.message });
    }
  }));

  // RECETAS routes
  app.get('/api/tintometria/recetas', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const { colorId } = req.query;
      let recetas;
      if (colorId) {
        recetas = await storage.getRecetasByColorId(colorId as string);
      } else {
        recetas = await storage.getAllRecetas();
      }
      res.json(recetas);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al obtener recetas', error: error.message });
    }
  }));

  app.get('/api/tintometria/recetas/:id', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const receta = await storage.getRecetaById(parseInt(req.params.id));
      if (!receta) {
        return res.status(404).json({ message: 'Receta no encontrada' });
      }
      res.json(receta);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al obtener receta', error: error.message });
    }
  }));

  app.post('/api/tintometria/recetas', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const receta = await storage.createReceta(req.body);
      res.status(201).json(receta);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al crear receta', error: error.message });
    }
  }));

  app.put('/api/tintometria/recetas/:id', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const receta = await storage.updateReceta(parseInt(req.params.id), req.body);
      res.json(receta);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al actualizar receta', error: error.message });
    }
  }));

  app.delete('/api/tintometria/recetas/:id', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      await storage.deleteReceta(parseInt(req.params.id));
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: 'Error al eliminar receta', error: error.message });
    }
  }));

  // PARÁMETROS routes
  app.get('/api/tintometria/parametros', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const parametros = await storage.getAllParametros();
      res.json(parametros);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al obtener parámetros', error: error.message });
    }
  }));

  app.get('/api/tintometria/parametros/:id', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const parametro = await storage.getParametroById(parseInt(req.params.id));
      if (!parametro) {
        return res.status(404).json({ message: 'Parámetro no encontrado' });
      }
      res.json(parametro);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al obtener parámetro', error: error.message });
    }
  }));

  app.post('/api/tintometria/parametros', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const parametro = await storage.createParametro(req.body);
      res.status(201).json(parametro);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al crear parámetro', error: error.message });
    }
  }));

  app.put('/api/tintometria/parametros/:id', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const parametro = await storage.updateParametro(parseInt(req.params.id), req.body);
      res.json(parametro);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al actualizar parámetro', error: error.message });
    }
  }));

  app.delete('/api/tintometria/parametros/:id', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      await storage.deleteParametro(parseInt(req.params.id));
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: 'Error al eliminar parámetro', error: error.message });
    }
  }));

  // CALCULATE COLOR COST route
  app.post('/api/tintometria/calculate', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const { colorId, envaseId } = req.body;
      if (!colorId || !envaseId) {
        return res.status(400).json({ message: 'colorId y envaseId son requeridos' });
      }
      
      const calculation = await storage.calculateColorCost(colorId, envaseId);
      if (!calculation) {
        return res.status(404).json({ message: 'Color o envase no encontrado' });
      }
      
      res.json(calculation);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al calcular costo', error: error.message });
    }
  }));

  // ==================================================================================
  // RECLAMOS GENERALES ROUTES
  // ==================================================================================

  // Get all reclamos with optional filters
  app.get('/api/reclamos-generales', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      const filters: any = {};
      
      if (req.query.vendedorId) filters.vendedorId = req.query.vendedorId;
      if (req.query.tecnicoId) filters.tecnicoId = req.query.tecnicoId;
      if (req.query.estado) filters.estado = req.query.estado;
      if (req.query.gravedad) filters.gravedad = req.query.gravedad;
      if (req.query.limit) filters.limit = parseInt(req.query.limit);
      if (req.query.offset) filters.offset = parseInt(req.query.offset);
      
      // Filtrar automáticamente por área responsable si el usuario tiene rol de área
      // Usa taxonomía compartida para roles de área y organizacionales
      const { getRoleArea } = await import('@shared/reclamosAreas');
      const userArea = getRoleArea(user.role);
      
      // Usuarios de área (laboratorio, produccion, etc.) ven reclamos que les fueron asignados específicamente
      if (userArea) {
        // Filtrar por reclamos asignados específicamente al usuario como responsable del área
        filters.responsableAreaId = user.id;
      }
      
      const reclamos = await storage.getReclamosGenerales(filters);
      res.json(reclamos);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al obtener reclamos', error: error.message });
    }
  }));

  // Get reclamo by ID
  app.get('/api/reclamos-generales/:id', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const reclamo = await storage.getReclamoGeneralById(req.params.id);
      
      if (!reclamo) {
        return res.status(404).json({ message: 'Reclamo no encontrado' });
      }
      
      res.json(reclamo);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al obtener reclamo', error: error.message });
    }
  }));

  // Get reclamo with photos and historial
  app.get('/api/reclamos-generales/:id/details', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const reclamo = await storage.getReclamoGeneralWithDetails(req.params.id);
      
      if (!reclamo) {
        return res.status(404).json({ message: 'Reclamo no encontrado' });
      }
      
      res.json(reclamo);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al obtener detalles del reclamo', error: error.message });
    }
  }));

  // Create reclamo
  app.post('/api/reclamos-generales', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      
      // Only salesperson, admin, supervisor, and tecnico_obra can create reclamos
      const allowedRoles = ['salesperson', 'admin', 'supervisor', 'tecnico_obra'];
      if (!allowedRoles.includes(user.role)) {
        return res.status(403).json({ 
          message: 'No tiene permisos para crear reclamos. Solo vendedores, administradores, supervisores y técnicos pueden crear reclamos.' 
        });
      }
      
      // Add vendedor info from authenticated user
      const reclamoData = {
        ...req.body,
        vendedorId: user.id,
        vendedorName: user.salespersonName || `${user.firstName} ${user.lastName}`,
      };
      
      const reclamo = await storage.createReclamoGeneral(reclamoData);
      
      // 🔔 Notificación automática: Nuevo reclamo creado
      await NotifyHelper.notifyReclamoCreated(
        reclamo.id, 
        reclamoData.motivo,
        reclamoData.clientName || 'Cliente',
        reclamoData.vendedorName
      );
      
      res.status(201).json(reclamo);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al crear reclamo', error: error.message });
    }
  }));

  // Update reclamo
  app.patch('/api/reclamos-generales/:id', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const reclamo = await storage.updateReclamoGeneral(req.params.id, req.body);
      res.json(reclamo);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al actualizar reclamo', error: error.message });
    }
  }));

  // Delete reclamo (admin, tecnico_obra, or creator within 5 minutes for rollback)
  app.delete('/api/reclamos-generales/:id', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      const reclamoId = req.params.id;
      
      // Admin and tecnico_obra can always delete
      if (user.role === 'admin' || user.role === 'tecnico_obra') {
        await storage.deleteReclamoGeneral(reclamoId);
        return res.status(204).send();
      }
      
      // Creator can delete their own reclamo if it's recent (for rollback purposes)
      const reclamo = await storage.getReclamoGeneralById(reclamoId);
      if (!reclamo) {
        return res.status(404).json({ message: 'Reclamo no encontrado' });
      }
      
      // Check if user is the creator
      if (reclamo.vendedorId !== user.id) {
        return res.status(403).json({ message: 'No tiene permiso para eliminar este reclamo' });
      }
      
      // Check if reclamo is recent (within 5 minutes)
      const createdAt = new Date(reclamo.fechaRegistro || '');
      const now = new Date();
      const minutesDiff = (now.getTime() - createdAt.getTime()) / (1000 * 60);
      
      if (minutesDiff > 5) {
        return res.status(403).json({ message: 'Solo puede eliminar reclamos recientes (< 5 minutos)' });
      }
      
      await storage.deleteReclamoGeneral(reclamoId);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: 'Error al eliminar reclamo', error: error.message });
    }
  }));

  // Assign tecnico to reclamo
  app.post('/api/reclamos-generales/:id/assign-tecnico', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      const { tecnicoId, tecnicoName } = req.body;
      
      if (!tecnicoId || !tecnicoName) {
        return res.status(400).json({ message: 'tecnicoId y tecnicoName son requeridos' });
      }
      
      const userName = user.salespersonName || `${user.firstName} ${user.lastName}`;
      const reclamo = await storage.assignTecnicoToReclamo(
        req.params.id,
        tecnicoId,
        tecnicoName,
        user.id,
        userName
      );
      
      res.json(reclamo);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al asignar técnico', error: error.message });
    }
  }));

  // Update reclamo estado
  app.post('/api/reclamos-generales/:id/update-estado', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      const { nuevoEstado, notas } = req.body;
      
      if (!nuevoEstado) {
        return res.status(400).json({ message: 'nuevoEstado es requerido' });
      }
      
      const userName = user.salespersonName || `${user.firstName} ${user.lastName}`;
      const reclamo = await storage.updateReclamoGeneralEstado(
        req.params.id,
        nuevoEstado,
        user.id,
        userName,
        notas
      );
      
      res.json(reclamo);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al actualizar estado', error: error.message });
    }
  }));

  // Derivar to laboratorio
  app.post('/api/reclamos-generales/:id/derivar-laboratorio', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      const userName = user.salespersonName || `${user.firstName} ${user.lastName}`;
      
      const reclamo = await storage.derivarReclamoGeneralLaboratorio(req.params.id, user.id, userName);
      res.json(reclamo);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al derivar a laboratorio', error: error.message });
    }
  }));

  // Derivar to producción
  app.post('/api/reclamos-generales/:id/derivar-produccion', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      const userName = user.salespersonName || `${user.firstName} ${user.lastName}`;
      
      const reclamo = await storage.derivarReclamoGeneralProduccion(req.params.id, user.id, userName);
      res.json(reclamo);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al derivar a producción', error: error.message });
    }
  }));

  // Validación técnica
  app.post('/api/reclamos-generales/:id/validacion-tecnica', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      const { procede, areaResponsable, notas } = req.body;
      
      // Validaciones
      if (typeof procede !== 'boolean') {
        return res.status(400).json({ message: 'El campo procede es requerido y debe ser booleano' });
      }
      
      if (procede && !areaResponsable) {
        return res.status(400).json({ message: 'El área responsable es requerida cuando el reclamo procede' });
      }
      
      const userName = user.salespersonName || `${user.firstName} ${user.lastName}`;
      const reclamo = await storage.validarReclamoTecnico(
        req.params.id, 
        procede, 
        areaResponsable,
        notas,
        user.id, 
        userName
      );
      
      res.json(reclamo);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al validar reclamo', error: error.message });
    }
  }));

  // Update informe laboratorio
  app.post('/api/reclamos-generales/:id/informe-laboratorio', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      const { informe } = req.body;
      
      if (!informe) {
        return res.status(400).json({ message: 'informe es requerido' });
      }
      
      const userName = user.salespersonName || `${user.firstName} ${user.lastName}`;
      const reclamo = await storage.updateInformeLaboratorio(req.params.id, informe, user.id, userName);
      res.json(reclamo);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al actualizar informe', error: error.message });
    }
  }));

  // Update informe producción
  app.post('/api/reclamos-generales/:id/informe-produccion', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      const { informe } = req.body;
      
      if (!informe) {
        return res.status(400).json({ message: 'informe es requerido' });
      }
      
      const userName = user.salespersonName || `${user.firstName} ${user.lastName}`;
      const reclamo = await storage.updateInformeProduccion(req.params.id, informe, user.id, userName);
      res.json(reclamo);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al actualizar informe', error: error.message });
    }
  }));

  // Update informe técnico
  app.post('/api/reclamos-generales/:id/informe-tecnico', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      const { informe } = req.body;
      
      if (!informe) {
        return res.status(400).json({ message: 'informe es requerido' });
      }
      
      const userName = user.salespersonName || `${user.firstName} ${user.lastName}`;
      const reclamo = await storage.updateInformeTecnico(req.params.id, informe, user.id, userName);
      res.json(reclamo);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al actualizar informe', error: error.message });
    }
  }));

  // Cerrar reclamo
  app.post('/api/reclamos-generales/:id/cerrar', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      const { notas, photos } = req.body;
      
      const userName = user.salespersonName || `${user.firstName} ${user.lastName}`;
      const reclamo = await storage.cerrarReclamoGeneral(req.params.id, user.id, userName, notas, photos);
      res.json(reclamo);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al cerrar reclamo', error: error.message });
    }
  }));

  // Photos operations
  app.post('/api/reclamos-generales/:id/photos', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const photoData = {
        reclamoId: req.params.id,
        ...req.body,
      };
      
      const photo = await storage.createReclamoGeneralPhoto(photoData);
      res.status(201).json(photo);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al crear foto', error: error.message });
    }
  }));

  app.get('/api/reclamos-generales/:id/photos', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const photos = await storage.getReclamoGeneralPhotos(req.params.id);
      res.json(photos);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al obtener fotos', error: error.message });
    }
  }));

  app.delete('/api/reclamos-generales/photos/:id', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      await storage.deleteReclamoGeneralPhoto(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: 'Error al eliminar foto', error: error.message });
    }
  }));

  // Historial operations
  app.get('/api/reclamos-generales/:id/historial', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const historial = await storage.getReclamoGeneralHistorial(req.params.id);
      res.json(historial);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al obtener historial', error: error.message });
    }
  }));

  // Resolución del laboratorio con evidencia
  app.post('/api/reclamos-generales/:id/resolucion-laboratorio', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      
      // Validar que solo laboratorio puede subir resolución
      if (user.role !== 'laboratorio') {
        return res.status(403).json({ message: 'Solo usuarios con rol laboratorio pueden subir resoluciones' });
      }
      
      const { informe, categoriaResponsable, photos } = req.body;
      
      if (!informe) {
        return res.status(400).json({ message: 'El informe es requerido' });
      }

      if (!categoriaResponsable) {
        return res.status(400).json({ message: 'La categoría responsable es requerida' });
      }
      
      if (!photos || !Array.isArray(photos) || photos.length === 0) {
        return res.status(400).json({ message: 'Se requiere al menos una foto de evidencia' });
      }
      
      // Verificar que el reclamo existe y está en el estado correcto
      const existingReclamo = await storage.getReclamoGeneralById(req.params.id);
      if (!existingReclamo) {
        return res.status(404).json({ message: 'Reclamo no encontrado' });
      }
      
      if (existingReclamo.estado !== 'en_laboratorio') {
        return res.status(400).json({ message: 'El reclamo no está en estado "En Laboratorio"' });
      }
      
      if (existingReclamo.informeLaboratorio) {
        return res.status(400).json({ message: 'Este reclamo ya tiene una resolución del laboratorio' });
      }
      
      const userName = user.salespersonName || `${user.firstName} ${user.lastName}`;
      const reclamo = await storage.updateResolucionLaboratorio(req.params.id, informe, categoriaResponsable, photos, user.id, userName);
      
      if (!reclamo) {
        return res.status(409).json({ message: 'El reclamo ya tiene una resolución o fue modificado por otro usuario' });
      }
      
      res.json(reclamo);
    } catch (error: any) {
      console.error('Error al subir resolución:', error);
      res.status(500).json({ message: 'Error al subir resolución' });
    }
  }));

  // Resolución genérica para áreas responsables
  app.post('/api/reclamos-generales/:id/resolucion-area', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      
      // Definir roles organizacionales permitidos
      const organizationalRoles = ['produccion', 'logistica_bodega', 'planificacion', 'bodega_materias_primas', 'prevencion_riesgos'];
      
      // Validar que el usuario tiene rol de área, laboratorio, o rol organizacional
      const isAreaRole = user.role && (
        user.role.startsWith('area_') || 
        user.role === 'laboratorio' ||
        organizationalRoles.includes(user.role)
      );
      if (!isAreaRole) {
        return res.status(403).json({ message: 'No tiene permisos para subir resoluciones' });
      }
      
      const { resolucionDescripcion, photos } = req.body;
      
      if (!resolucionDescripcion) {
        return res.status(400).json({ message: 'La descripción de la resolución es requerida' });
      }
      
      if (!photos || !Array.isArray(photos) || photos.length === 0) {
        return res.status(400).json({ message: 'Se requiere al menos una foto de evidencia' });
      }
      
      const userName = user.salespersonName || `${user.firstName} ${user.lastName}`;
      
      try {
        const reclamo = await storage.updateResolucionArea(
          req.params.id, 
          resolucionDescripcion, 
          photos, 
          user.id, 
          userName,
          user.role
        );
        
        if (!reclamo) {
          return res.status(409).json({ message: 'El reclamo ya tiene una resolución o fue modificado por otro usuario' });
        }
        
        res.json(reclamo);
      } catch (error: any) {
        // Manejar errores de validación del storage
        if (error.message.includes('no está en estado') || error.message.includes('No tiene permisos')) {
          return res.status(400).json({ message: error.message });
        }
        throw error;
      }
    } catch (error: any) {
      console.error('Error al subir resolución:', error);
      res.status(500).json({ message: 'Error al subir resolución' });
    }
  }));

  // Get resolución photos
  app.get('/api/reclamos-generales/:id/resolucion-photos', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const photos = await storage.getReclamoGeneralResolucionPhotos(req.params.id);
      res.json(photos);
    } catch (error: any) {
      console.error('Error al obtener fotos de resolución:', error);
      res.status(500).json({ message: 'Error al obtener fotos de resolución' });
    }
  }));

  // ==================================================================================
  // MANTENCIÓN MODULE ROUTES
  // ==================================================================================

  // Get all solicitudes de mantención with optional filters
  app.get('/api/mantenciones', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      
      // Only specific roles can access mantenciones
      const allowedRoles = ['admin', 'supervisor', 'produccion', 'planificacion', 'logistica_bodega', 'bodega_materias_primas'];
      if (!allowedRoles.includes(user.role)) {
        return res.status(403).json({ message: 'No autorizado para acceder a mantenciones' });
      }

      const filters: any = {};
      
      if (req.query.solicitanteId) filters.solicitanteId = req.query.solicitanteId;
      if (req.query.tecnicoAsignadoId) filters.tecnicoAsignadoId = req.query.tecnicoAsignadoId;
      if (req.query.estado) filters.estado = req.query.estado;
      if (req.query.gravedad) filters.gravedad = req.query.gravedad;
      if (req.query.area) filters.area = req.query.area;
      
      const solicitudes = await storage.getSolicitudesMantencion(filters);
      res.json(solicitudes);
    } catch (error: any) {
      console.error('Error al obtener solicitudes de mantención:', error);
      res.status(500).json({ message: 'Error al obtener solicitudes de mantención', error: error.message });
    }
  }));

  // Get solicitud de mantención by ID
  app.get('/api/mantenciones/:id', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      
      // Only specific roles can access mantenciones
      const allowedRoles = ['admin', 'supervisor', 'produccion', 'planificacion', 'logistica_bodega', 'bodega_materias_primas'];
      if (!allowedRoles.includes(user.role)) {
        return res.status(403).json({ message: 'No autorizado para acceder a mantenciones' });
      }

      const solicitud = await storage.getSolicitudMantencionById(req.params.id);
      
      if (!solicitud) {
        return res.status(404).json({ message: 'Solicitud de mantención no encontrada' });
      }
      
      res.json(solicitud);
    } catch (error: any) {
      console.error('Error al obtener solicitud de mantención:', error);
      res.status(500).json({ message: 'Error al obtener solicitud de mantención', error: error.message });
    }
  }));

  // Get solicitud de mantención with photos and historial
  app.get('/api/mantenciones/:id/details', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      
      // Only specific roles can access mantenciones
      const allowedRoles = ['admin', 'supervisor', 'produccion', 'planificacion', 'logistica_bodega', 'bodega_materias_primas'];
      if (!allowedRoles.includes(user.role)) {
        return res.status(403).json({ message: 'No autorizado para acceder a mantenciones' });
      }

      const solicitud = await storage.getSolicitudMantencionWithDetails(req.params.id);
      
      if (!solicitud) {
        return res.status(404).json({ message: 'Solicitud de mantención no encontrada' });
      }
      
      res.json(solicitud);
    } catch (error: any) {
      console.error('Error al obtener detalles de mantención:', error);
      res.status(500).json({ message: 'Error al obtener detalles de mantención', error: error.message });
    }
  }));

  // Create new solicitud de mantención with photos
  app.post('/api/mantenciones', requireAuth, upload.array('photos', 10), asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      
      // Only specific roles can create mantenciones
      const allowedRoles = ['admin', 'supervisor', 'produccion', 'planificacion', 'logistica_bodega', 'bodega_materias_primas'];
      if (!allowedRoles.includes(user.role)) {
        return res.status(403).json({ message: 'No autorizado para crear solicitudes de mantención' });
      }

      console.log('📝 Request body:', req.body);
      console.log('📷 Files:', req.files);

      // Validate request body with Zod schema
      const solicitudData = {
        ...req.body,
        solicitanteId: user.id,
        solicitanteName: user.name || user.username,
        estado: 'pendiente',
      };

      // Parse and validate with schema
      const validatedData = insertSolicitudMantencionSchema.parse(solicitudData);

      const solicitud = await storage.createSolicitudMantencion(validatedData);
      
      // 🔔 Notificación automática: Nueva solicitud de mantención
      await NotifyHelper.notifyMantencionCreada(
        validatedData.equipoNombre,
        validatedData.gravedad,
        validatedData.solicitanteName || 'Usuario'
      );
      
      // Process uploaded photos
      if (req.files && req.files.length > 0) {
        const objectStorageService = new ObjectStorageService();
        const uploadedPhotos = await Promise.all(
          req.files.map(async (file: Express.Multer.File, index: number) => {
            try {
              // Get file extension and create unique filename
              const fileExtension = path.extname(file.originalname).toLowerCase() || '.jpg';
              const timestamp = Date.now();
              const uniqueFileName = `${solicitud.id}_${timestamp}_${index}${fileExtension}`;
              const storageKey = `mantencion-photos/${solicitud.id}/${uniqueFileName}`;
              
              // Upload to object storage
              const photoUrl = await objectStorageService.uploadImage(
                storageKey, 
                file.buffer, 
                file.mimetype || getContentType(fileExtension.substring(1))
              );
              
              // Create photo record in database
              return await storage.createMantencionPhoto({
                mantencionId: solicitud.id,
                photoUrl,
                description: null,
              });
            } catch (uploadError) {
              console.error('Error uploading photo:', uploadError);
              // If upload fails, we still want to create the solicitud, so we don't throw here
              return null;
            }
          })
        );
        
        // Filter out any failed uploads
        const successfulPhotos = uploadedPhotos.filter(photo => photo !== null);
        
        // Return solicitud with photos
        return res.status(201).json({ ...solicitud, photos: successfulPhotos });
      }
      
      res.status(201).json(solicitud);
    } catch (error: any) {
      console.error('Error al crear solicitud de mantención:', error);
      
      // Handle Zod validation errors
      if (error.name === 'ZodError') {
        return res.status(400).json({ 
          message: 'Datos inválidos', 
          errors: error.errors 
        });
      }
      
      res.status(500).json({ message: 'Error al crear solicitud de mantención', error: error.message });
    }
  }));

  // Update solicitud de mantención
  app.patch('/api/mantenciones/:id', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      
      // Only admin, supervisor, and produccion can update
      const allowedRoles = ['admin', 'supervisor', 'produccion'];
      if (!allowedRoles.includes(user.role)) {
        return res.status(403).json({ message: 'No autorizado para actualizar solicitudes de mantención' });
      }

      // Validate partial update with schema
      const partialSchema = insertSolicitudMantencionSchema.partial();
      const validatedData = partialSchema.parse(req.body);

      const solicitud = await storage.updateSolicitudMantencion(req.params.id, validatedData);
      res.json(solicitud);
    } catch (error: any) {
      console.error('Error al actualizar solicitud de mantención:', error);
      
      // Handle Zod validation errors
      if (error.name === 'ZodError') {
        return res.status(400).json({ 
          message: 'Datos inválidos', 
          errors: error.errors 
        });
      }
      
      res.status(500).json({ message: 'Error al actualizar solicitud de mantención', error: error.message });
    }
  }));

  // Delete solicitud de mantención
  app.delete('/api/mantenciones/:id', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      const solicitud = await storage.getSolicitudMantencionById(req.params.id);

      if (!solicitud) {
        return res.status(404).json({ message: 'Solicitud de mantención no encontrada' });
      }

      // Admin and produccion can delete anytime
      const canDeleteAnytime = user.role === 'admin' || user.role === 'produccion';
      
      if (!canDeleteAnytime) {
        // Other users can only delete their own within 5 minutes
        if (solicitud.solicitanteId !== user.id) {
          return res.status(403).json({ message: 'Solo el creador puede eliminar la solicitud' });
        }

        const now = new Date();
        const createdAt = new Date(solicitud.fechaSolicitud);
        const diffMinutes = (now.getTime() - createdAt.getTime()) / (1000 * 60);

        if (diffMinutes > 5) {
          return res.status(403).json({ message: 'Solo se puede eliminar dentro de los primeros 5 minutos' });
        }
      }

      await storage.deleteSolicitudMantencion(req.params.id);
      res.json({ message: 'Solicitud de mantención eliminada exitosamente' });
    } catch (error: any) {
      console.error('Error al eliminar solicitud de mantención:', error);
      res.status(500).json({ message: 'Error al eliminar solicitud de mantención', error: error.message });
    }
  }));

  // Upload photos for solicitud de mantención
  app.post('/api/mantenciones/:id/photos', requireAuth, upload.array('photos', 10), asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      
      // Only specific roles can upload photos
      const allowedRoles = ['admin', 'supervisor', 'produccion', 'planificacion', 'logistica_bodega', 'bodega_materias_primas'];
      if (!allowedRoles.includes(user.role)) {
        return res.status(403).json({ message: 'No autorizado para subir fotos' });
      }

      const solicitud = await storage.getSolicitudMantencionById(req.params.id);
      if (!solicitud) {
        return res.status(404).json({ message: 'Solicitud de mantención no encontrada' });
      }

      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).json({ message: 'No se subieron fotos' });
      }

      const photoUrls = files.map(file => file.path);
      
      const photos = await Promise.all(
        photoUrls.map((photoUrl, index) => 
          storage.createMantencionPhoto({
            mantencionId: req.params.id,
            photoUrl,
            description: req.body[`descriptions[${index}]`] || null,
          })
        )
      );

      res.status(201).json(photos);
    } catch (error: any) {
      console.error('Error al subir fotos:', error);
      res.status(500).json({ message: 'Error al subir fotos', error: error.message });
    }
  }));

  // Get photos for solicitud de mantención
  app.get('/api/mantenciones/:id/photos', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const photos = await storage.getMantencionPhotos(req.params.id);
      res.json(photos);
    } catch (error: any) {
      console.error('Error al obtener fotos:', error);
      res.status(500).json({ message: 'Error al obtener fotos' });
    }
  }));

  // Delete photo
  app.delete('/api/mantenciones/photos/:photoId', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      await storage.deleteMantencionPhoto(req.params.photoId);
      res.json({ message: 'Foto eliminada exitosamente' });
    } catch (error: any) {
      console.error('Error al eliminar foto:', error);
      res.status(500).json({ message: 'Error al eliminar foto' });
    }
  }));

  // Assign técnico to mantención
  app.post('/api/mantenciones/:id/assign-tecnico', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      
      // Only admin, supervisor, and produccion can assign técnico
      const allowedRoles = ['admin', 'supervisor', 'produccion'];
      if (!allowedRoles.includes(user.role)) {
        return res.status(403).json({ message: 'No autorizado para asignar técnicos' });
      }

      // Validate request data
      const assignSchema = z.object({
        tecnicoId: z.string().min(1, 'El ID del técnico es requerido'),
        tecnicoName: z.string().min(1, 'El nombre del técnico es requerido'),
      });

      const { tecnicoId, tecnicoName } = assignSchema.parse(req.body);

      const solicitud = await storage.assignTecnicoToMantencion(
        req.params.id,
        tecnicoId,
        tecnicoName,
        user.id,
        user.name || user.username
      );

      res.json(solicitud);
    } catch (error: any) {
      console.error('Error al asignar técnico:', error);
      
      // Handle Zod validation errors
      if (error.name === 'ZodError') {
        return res.status(400).json({ 
          message: 'Datos inválidos', 
          errors: error.errors 
        });
      }
      
      res.status(500).json({ message: 'Error al asignar técnico', error: error.message });
    }
  }));

  // Change estado
  app.post('/api/mantenciones/:id/cambiar-estado', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      
      // Only admin, supervisor, and produccion can change estado
      const allowedRoles = ['admin', 'supervisor', 'produccion'];
      if (!allowedRoles.includes(user.role)) {
        return res.status(403).json({ message: 'No autorizado para cambiar estado' });
      }

      // Validate request data
      const estadoSchema = z.object({
        nuevoEstado: z.enum(['registrado', 'en_reparacion', 'resuelto', 'cerrado'], {
          errorMap: () => ({ message: 'Estado inválido' })
        }),
        notas: z.string().optional(),
      });

      const { nuevoEstado, notas } = estadoSchema.parse(req.body);

      const solicitud = await storage.updateMantencionEstado(
        req.params.id,
        nuevoEstado,
        user.id,
        user.name || user.username,
        notas
      );

      res.json(solicitud);
    } catch (error: any) {
      console.error('Error al cambiar estado:', error);
      
      // Handle Zod validation errors
      if (error.name === 'ZodError') {
        return res.status(400).json({ 
          message: 'Datos inválidos', 
          errors: error.errors 
        });
      }
      
      res.status(500).json({ message: 'Error al cambiar estado', error: error.message });
    }
  }));

  // Submit resolución (admin, supervisor, produccion)
  app.post('/api/mantenciones/:id/resolucion', requireAuth, upload.array('photos', 10), asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      
      // Only admin, supervisor, and produccion can submit resolucion
      const allowedRoles = ['admin', 'supervisor', 'produccion'];
      if (!allowedRoles.includes(user.role)) {
        return res.status(403).json({ message: 'No tiene permisos para enviar resoluciones' });
      }

      // Validate resolution data
      const resolucionSchema = z.object({
        resolucionDescripcion: z.string().min(10, 'La descripción de la resolución debe tener al menos 10 caracteres'),
        costoReal: z.string().optional().transform(val => val ? parseFloat(val) : undefined),
        tiempoReal: z.string().optional().transform(val => val ? parseInt(val) : undefined),
        repuestosUtilizados: z.string().optional(),
      });

      const validatedData = resolucionSchema.parse(req.body);
      const files = req.files as Express.Multer.File[];

      // Process uploaded photos - upload to Object Storage first
      let photos: Array<{ photoUrl: string; description: string }> = [];
      
      if (files && files.length > 0) {
        const objectStorageService = new ObjectStorageService();
        photos = await Promise.all(
          files.map(async (file: Express.Multer.File, index: number) => {
            try {
              // Get file extension and create unique filename
              const fileExtension = path.extname(file.originalname).toLowerCase() || '.jpg';
              const timestamp = Date.now();
              const uniqueFileName = `resolucion_${req.params.id}_${timestamp}_${index}${fileExtension}`;
              const storageKey = `mantencion-resolucion/${req.params.id}/${uniqueFileName}`;
              
              // Upload to object storage
              const photoUrl = await objectStorageService.uploadImage(
                storageKey, 
                file.buffer, 
                file.mimetype || getContentType(fileExtension.substring(1))
              );
              
              return {
                photoUrl,
                description: req.body[`descriptions[${index}]`] || 'Evidencia de resolución',
              };
            } catch (uploadError) {
              console.error('Error uploading resolution photo:', uploadError);
              throw uploadError;
            }
          })
        );
      }

      const solicitud = await storage.updateResolucionMantencion(
        req.params.id,
        validatedData.resolucionDescripcion,
        photos,
        user.id,
        user.name || user.username,
        validatedData.costoReal,
        validatedData.tiempoReal,
        validatedData.repuestosUtilizados
      );

      if (!solicitud) {
        return res.status(409).json({ message: 'La solicitud ya tiene una resolución o fue modificada por otro usuario' });
      }

      res.json(solicitud);
    } catch (error: any) {
      console.error('Error al subir resolución:', error);
      
      // Handle Zod validation errors
      if (error.name === 'ZodError') {
        return res.status(400).json({ 
          message: 'Datos inválidos', 
          errors: error.errors 
        });
      }
      
      res.status(500).json({ message: 'Error al subir resolución', error: error.message });
    }
  }));

  // Get resolución photos
  app.get('/api/mantenciones/:id/resolucion-photos', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const photos = await storage.getMantencionResolucionPhotos(req.params.id);
      res.json(photos);
    } catch (error: any) {
      console.error('Error al obtener fotos de resolución:', error);
      res.status(500).json({ message: 'Error al obtener fotos de resolución' });
    }
  }));

  // Get historial
  app.get('/api/mantenciones/:id/historial', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const historial = await storage.getMantencionHistorial(req.params.id);
      res.json(historial);
    } catch (error: any) {
      console.error('Error al obtener historial:', error);
      res.status(500).json({ message: 'Error al obtener historial' });
    }
  }));

  // Cerrar solicitud de mantención
  app.post('/api/mantenciones/:id/cerrar', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      
      // Only admin, supervisor, and produccion can close
      const allowedRoles = ['admin', 'supervisor', 'produccion'];
      if (!allowedRoles.includes(user.role)) {
        return res.status(403).json({ message: 'No autorizado para cerrar solicitudes' });
      }

      const { notas } = req.body;

      const solicitud = await storage.cerrarMantencion(
        req.params.id,
        user.id,
        user.name || user.username,
        notas
      );

      res.json(solicitud);
    } catch (error: any) {
      console.error('Error al cerrar solicitud:', error);
      res.status(500).json({ message: 'Error al cerrar solicitud', error: error.message });
    }
  }));

  // ===== NUEVAS FUNCIONALIDADES AVANZADAS OT =====
  
  // Pausar OT (solo admin, supervisor, produccion)
  app.post('/api/mantenciones/:id/pausar', requireAuth, requireRoles(['admin', 'supervisor', 'produccion']), asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      
      const pausarSchema = z.object({
        motivo: z.string().min(10, 'El motivo debe tener al menos 10 caracteres'),
        fechaProgramada: z.string().nullable().optional(), // Permitir reasignar fecha al pausar
      });

      const { motivo, fechaProgramada } = pausarSchema.parse(req.body);

      const solicitud = await storage.pausarMantencion(
        req.params.id,
        motivo,
        fechaProgramada,
        user.id,
        user.name || user.username
      );

      res.json(solicitud);
    } catch (error: any) {
      console.error('Error al pausar OT:', error);
      
      if (error.name === 'ZodError') {
        return res.status(400).json({ 
          message: 'Datos inválidos', 
          errors: error.errors 
        });
      }
      
      res.status(400).json({ message: error.message || 'Error al pausar orden de trabajo' });
    }
  }));

  // Reanudar OT (solo admin, supervisor, produccion)
  app.post('/api/mantenciones/:id/reanudar', requireAuth, requireRoles(['admin', 'supervisor', 'produccion']), asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      
      const reanudarSchema = z.object({
        notas: z.string().optional(),
      });

      const { notas } = reanudarSchema.parse(req.body);

      const solicitud = await storage.reanudarMantencion(
        req.params.id,
        notas || null,
        user.id,
        user.name || user.username
      );

      res.json(solicitud);
    } catch (error: any) {
      console.error('Error al reanudar OT:', error);
      
      if (error.name === 'ZodError') {
        return res.status(400).json({ 
          message: 'Datos inválidos', 
          errors: error.errors 
        });
      }
      
      res.status(400).json({ message: error.message || 'Error al reanudar orden de trabajo' });
    }
  }));

  // Iniciar trabajo en OT (solo admin, supervisor, produccion, técnico asignado)
  app.post('/api/mantenciones/:id/iniciar-trabajo', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      
      const solicitud = await storage.iniciarTrabajoMantencion(
        req.params.id,
        user.id,
        user.name || user.username,
        user.role
      );

      res.json(solicitud);
    } catch (error: any) {
      console.error('Error al iniciar trabajo:', error);
      res.status(400).json({ message: error.message || 'Error al iniciar orden de trabajo' });
    }
  }));

  // Obtener gastos de una OT
  app.get('/api/mantenciones/:id/gastos', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const gastos = await storage.getGastosMaterialesMantencion({
        otId: req.params.id
      });

      res.json(gastos);
    } catch (error: any) {
      console.error('Error al obtener gastos:', error);
      res.status(400).json({ message: error.message || 'Error al obtener gastos' });
    }
  }));

  // Agregar gasto a OT
  app.post('/api/mantenciones/:id/gastos', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      
      // Only admin, supervisor, and produccion can add gastos
      const allowedRoles = ['admin', 'supervisor', 'produccion'];
      if (!allowedRoles.includes(user.role)) {
        return res.status(403).json({ message: 'No autorizado para agregar gastos' });
      }

      const gastoSchema = z.object({
        item: z.string().min(1, 'El nombre del item es requerido'),
        descripcion: z.string().optional(),
        cantidad: z.string().or(z.number()).transform(val => {
          const num = typeof val === 'string' ? parseFloat(val) : val;
          if (isNaN(num) || num <= 0) throw new Error('Cantidad inválida');
          return num.toString();
        }),
        costoUnitario: z.string().or(z.number()).transform(val => {
          const num = typeof val === 'string' ? parseFloat(val) : val;
          if (isNaN(num) || num < 0) throw new Error('Costo unitario inválido');
          return num.toString();
        }),
        proveedorId: z.string().optional(),
        adjuntoUrl: z.string().optional(),
      });

      const validatedData = gastoSchema.parse(req.body);
      
      // Calcular costoTotal = cantidad * costoUnitario
      const cantidad = parseFloat(validatedData.cantidad);
      const costoUnitario = parseFloat(validatedData.costoUnitario);
      const costoTotal = (cantidad * costoUnitario).toString();

      const gasto = await storage.agregarGastoAMantencion(req.params.id, {
        item: validatedData.item,
        descripcion: validatedData.descripcion || null,
        cantidad: validatedData.cantidad,
        costoUnitario: validatedData.costoUnitario,
        costoTotal,
        proveedorId: validatedData.proveedorId || null,
        adjuntoUrl: validatedData.adjuntoUrl || null,
        fecha: new Date(),
      });

      res.status(201).json(gasto);
    } catch (error: any) {
      console.error('Error al agregar gasto:', error);
      
      if (error.name === 'ZodError') {
        return res.status(400).json({ 
          message: 'Datos inválidos', 
          errors: error.errors 
        });
      }
      
      res.status(500).json({ message: error.message || 'Error al agregar gasto' });
    }
  }));

  // Actualizar asignación de OT (técnico o proveedor)
  app.patch('/api/mantenciones/:id/asignacion', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      
      // Only admin, supervisor, and produccion can update asignacion
      const allowedRoles = ['admin', 'supervisor', 'produccion'];
      if (!allowedRoles.includes(user.role)) {
        return res.status(403).json({ message: 'No autorizado para actualizar asignación' });
      }

      const asignacionSchema = z.object({
        tipoEjecucion: z.enum(['inmediata', 'programada']).nullable().optional(),
        fechaProgramada: z.string().nullable().optional(),
        tipoAsignacion: z.enum(['tecnico_interno', 'proveedor_externo']).nullable().optional(),
        tecnicoAsignadoId: z.string().nullable().optional(),
        tecnicoAsignadoName: z.string().nullable().optional(),
        proveedorAsignadoId: z.string().nullable().optional(),
        proveedorAsignadoName: z.string().nullable().optional(),
      });

      const validatedData = asignacionSchema.parse(req.body);

      const solicitud = await storage.actualizarAsignacionMantencion(
        req.params.id,
        validatedData,
        user.id,
        user.name || user.username
      );

      res.json(solicitud);
    } catch (error: any) {
      console.error('Error al actualizar asignación:', error);
      
      if (error.name === 'ZodError') {
        return res.status(400).json({ 
          message: 'Datos inválidos', 
          errors: error.errors 
        });
      }
      
      res.status(500).json({ message: error.message || 'Error al actualizar asignación' });
    }
  }));

  // ==================================================================================
  // CMMS - COMPUTERIZED MAINTENANCE MANAGEMENT SYSTEM ROUTES
  // ==================================================================================

  // ===== EQUIPOS CRÍTICOS ROUTES =====
  
  // GET all equipos críticos (with filters)
  app.get('/api/cmms/equipos', requireAuth, requireRoles(['admin', 'supervisor', 'produccion']), asyncHandler(async (req: any, res: any) => {
    try {
      const { area, criticidad, estadoActual } = req.query;
      const equipos = await storage.getEquiposCriticos({ area, criticidad, estadoActual });
      res.json(equipos);
    } catch (error: any) {
      console.error('Error al obtener equipos:', error);
      res.status(500).json({ message: 'Error al obtener equipos', error: error.message });
    }
  }));

  // GET equipo crítico by ID
  app.get('/api/cmms/equipos/:id', requireAuth, requireRoles(['admin', 'supervisor', 'produccion']), asyncHandler(async (req: any, res: any) => {
    try {
      const equipo = await storage.getEquipoCriticoById(req.params.id);
      if (!equipo) {
        return res.status(404).json({ message: 'Equipo no encontrado' });
      }
      res.json(equipo);
    } catch (error: any) {
      console.error('Error al obtener equipo:', error);
      res.status(500).json({ message: 'Error al obtener equipo', error: error.message });
    }
  }));

  // GET componentes de un equipo
  app.get('/api/cmms/equipos/:id/componentes', requireAuth, requireRoles(['admin', 'supervisor', 'produccion']), asyncHandler(async (req: any, res: any) => {
    try {
      const componentes = await storage.getComponentesDeEquipo(req.params.id);
      res.json(componentes);
    } catch (error: any) {
      console.error('Error al obtener componentes:', error);
      res.status(500).json({ message: 'Error al obtener componentes', error: error.message });
    }
  }));

  // GET equipos principales (sin padre)
  app.get('/api/cmms/equipos-principales', requireAuth, requireRoles(['admin', 'supervisor', 'produccion']), asyncHandler(async (req: any, res: any) => {
    try {
      const equiposPrincipales = await storage.getEquiposPrincipales();
      res.json(equiposPrincipales);
    } catch (error: any) {
      console.error('Error al obtener equipos principales:', error);
      res.status(500).json({ message: 'Error al obtener equipos principales', error: error.message });
    }
  }));

  // POST create new equipo crítico
  app.post('/api/cmms/equipos', requireAuth, requireRoles(['admin', 'supervisor', 'produccion']), asyncHandler(async (req: any, res: any) => {
    try {
      // Validate input with Zod schema
      const validatedData = insertEquipoCriticoSchema.parse(req.body);
      
      const equipo = await storage.createEquipoCritico(validatedData);
      res.status(201).json(equipo);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: 'Datos inválidos', errors: error.errors });
      }
      console.error('Error al crear equipo:', error);
      res.status(500).json({ message: 'Error al crear equipo', error: error.message });
    }
  }));

  // PATCH update equipo crítico
  app.patch('/api/cmms/equipos/:id', requireAuth, requireRoles(['admin', 'supervisor', 'produccion']), asyncHandler(async (req: any, res: any) => {
    try {
      // Validate input with partial schema for updates
      const validatedData = insertEquipoCriticoSchema.partial().parse(req.body);
      
      const equipo = await storage.updateEquipoCritico(req.params.id, validatedData);
      res.json(equipo);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: 'Datos inválidos', errors: error.errors });
      }
      console.error('Error al actualizar equipo:', error);
      res.status(500).json({ message: 'Error al actualizar equipo', error: error.message });
    }
  }));

  // DELETE equipo crítico
  app.delete('/api/cmms/equipos/:id', requireAuth, requireRoles(['admin']), asyncHandler(async (req: any, res: any) => {
    try {
      await storage.deleteEquipoCritico(req.params.id);
      res.json({ message: 'Equipo eliminado exitosamente' });
    } catch (error: any) {
      console.error('Error al eliminar equipo:', error);
      res.status(500).json({ message: 'Error al eliminar equipo', error: error.message });
    }
  }));

  // ===== PROVEEDORES EXTERNOS ROUTES =====
  
  // GET all proveedores (with filters)
  app.get('/api/cmms/proveedores', requireAuth, requireRoles(['admin', 'supervisor', 'produccion']), asyncHandler(async (req: any, res: any) => {
    try {
      const { activo } = req.query;
      const proveedores = await storage.getProveedoresMantencion({ 
        activo: activo === 'true' ? true : activo === 'false' ? false : undefined 
      });
      res.json(proveedores);
    } catch (error: any) {
      console.error('Error al obtener proveedores:', error);
      res.status(500).json({ message: 'Error al obtener proveedores', error: error.message });
    }
  }));

  // GET proveedor by ID
  app.get('/api/cmms/proveedores/:id', requireAuth, requireRoles(['admin', 'supervisor', 'produccion']), asyncHandler(async (req: any, res: any) => {
    try {
      const proveedor = await storage.getProveedorMantencionById(req.params.id);
      if (!proveedor) {
        return res.status(404).json({ message: 'Proveedor no encontrado' });
      }
      res.json(proveedor);
    } catch (error: any) {
      console.error('Error al obtener proveedor:', error);
      res.status(500).json({ message: 'Error al obtener proveedor', error: error.message });
    }
  }));

  // POST create new proveedor
  app.post('/api/cmms/proveedores', requireAuth, requireRoles(['admin', 'supervisor']), asyncHandler(async (req: any, res: any) => {
    try {
      // Validate input with Zod schema
      const validatedData = insertProveedorMantencionSchema.parse(req.body);
      
      const proveedor = await storage.createProveedorMantencion(validatedData);
      res.status(201).json(proveedor);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: 'Datos inválidos', errors: error.errors });
      }
      console.error('Error al crear proveedor:', error);
      res.status(500).json({ message: 'Error al crear proveedor', error: error.message });
    }
  }));

  // PATCH update proveedor
  app.patch('/api/cmms/proveedores/:id', requireAuth, requireRoles(['admin', 'supervisor']), asyncHandler(async (req: any, res: any) => {
    try {
      // Validate input with partial schema for updates
      const validatedData = insertProveedorMantencionSchema.partial().parse(req.body);
      
      const proveedor = await storage.updateProveedorMantencion(req.params.id, validatedData);
      res.json(proveedor);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: 'Datos inválidos', errors: error.errors });
      }
      console.error('Error al actualizar proveedor:', error);
      res.status(500).json({ message: 'Error al actualizar proveedor', error: error.message });
    }
  }));

  // DELETE proveedor
  app.delete('/api/cmms/proveedores/:id', requireAuth, requireRoles(['admin']), asyncHandler(async (req: any, res: any) => {
    try {
      await storage.deleteProveedorMantencion(req.params.id);
      res.json({ message: 'Proveedor eliminado exitosamente' });
    } catch (error: any) {
      console.error('Error al eliminar proveedor:', error);
      res.status(500).json({ message: 'Error al eliminar proveedor', error: error.message });
    }
  }));

  // ===== PRESUPUESTO MANTENCIÓN ROUTES =====

  // GET presupuestos por año
  app.get('/api/cmms/presupuesto/:anio', requireAuth, requireRoles(['admin', 'supervisor']), asyncHandler(async (req: any, res: any) => {
    try {
      const anio = parseInt(req.params.anio);
      const presupuestos = await storage.getPresupuestosMantencion(anio);
      res.json(presupuestos);
    } catch (error: any) {
      console.error('Error al obtener presupuestos:', error);
      res.status(500).json({ message: 'Error al obtener presupuestos', error: error.message });
    }
  }));

  // POST create presupuesto
  app.post('/api/cmms/presupuesto', requireAuth, requireRoles(['admin']), asyncHandler(async (req: any, res: any) => {
    try {
      // Validate input with Zod schema
      const validatedData = insertPresupuestoMantencionSchema.parse(req.body);
      
      const presupuesto = await storage.createPresupuestoMantencion(validatedData);
      res.status(201).json(presupuesto);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: 'Datos inválidos', errors: error.errors });
      }
      console.error('Error al crear presupuesto:', error);
      res.status(500).json({ message: 'Error al crear presupuesto', error: error.message });
    }
  }));

  // PATCH update presupuesto
  app.patch('/api/cmms/presupuesto/:id', requireAuth, requireRoles(['admin']), asyncHandler(async (req: any, res: any) => {
    try {
      // Validate input with partial schema for updates
      const validatedData = insertPresupuestoMantencionSchema.partial().parse(req.body);
      
      const presupuesto = await storage.updatePresupuestoMantencion(req.params.id, validatedData);
      res.json(presupuesto);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: 'Datos inválidos', errors: error.errors });
      }
      console.error('Error al actualizar presupuesto:', error);
      res.status(500).json({ message: 'Error al actualizar presupuesto', error: error.message });
    }
  }));

  // DELETE presupuesto
  app.delete('/api/cmms/presupuesto/:id', requireAuth, requireRoles(['admin']), asyncHandler(async (req: any, res: any) => {
    try {
      await storage.deletePresupuestoMantencion(req.params.id);
      res.json({ message: 'Presupuesto eliminado exitosamente' });
    } catch (error: any) {
      console.error('Error al eliminar presupuesto:', error);
      res.status(500).json({ message: 'Error al eliminar presupuesto', error: error.message });
    }
  }));

  // ===== GASTOS DE MATERIALES ROUTES =====

  // GET gastos de materiales (with filters)
  app.get('/api/cmms/gastos-materiales', requireAuth, requireRoles(['admin', 'supervisor', 'produccion']), asyncHandler(async (req: any, res: any) => {
    try {
      const { otId, area, startDate, endDate } = req.query;
      const gastos = await storage.getGastosMaterialesMantencion({ otId, area, startDate, endDate });
      res.json(gastos);
    } catch (error: any) {
      console.error('Error al obtener gastos:', error);
      res.status(500).json({ message: 'Error al obtener gastos', error: error.message });
    }
  }));

  // GET gasto by ID
  app.get('/api/cmms/gastos-materiales/:id', requireAuth, requireRoles(['admin', 'supervisor', 'produccion']), asyncHandler(async (req: any, res: any) => {
    try {
      const gasto = await storage.getGastoMaterialMantencionById(req.params.id);
      if (!gasto) {
        return res.status(404).json({ message: 'Gasto no encontrado' });
      }
      res.json(gasto);
    } catch (error: any) {
      console.error('Error al obtener gasto:', error);
      res.status(500).json({ message: 'Error al obtener gasto', error: error.message });
    }
  }));

  // POST create gasto
  app.post('/api/cmms/gastos-materiales', requireAuth, requireRoles(['admin', 'supervisor', 'produccion']), asyncHandler(async (req: any, res: any) => {
    try {
      // Validate input with Zod schema
      const validatedData = insertGastoMaterialMantencionSchema.parse(req.body);
      
      const gasto = await storage.createGastoMaterialMantencion(validatedData);
      res.status(201).json(gasto);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: 'Datos inválidos', errors: error.errors });
      }
      console.error('Error al crear gasto:', error);
      res.status(500).json({ message: 'Error al crear gasto', error: error.message });
    }
  }));

  // PATCH update gasto
  app.patch('/api/cmms/gastos-materiales/:id', requireAuth, requireRoles(['admin', 'supervisor', 'produccion']), asyncHandler(async (req: any, res: any) => {
    try {
      // Validate input with partial schema for updates
      const validatedData = insertGastoMaterialMantencionSchema.partial().parse(req.body);
      
      const gasto = await storage.updateGastoMaterialMantencion(req.params.id, validatedData);
      res.json(gasto);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: 'Datos inválidos', errors: error.errors });
      }
      console.error('Error al actualizar gasto:', error);
      res.status(500).json({ message: 'Error al actualizar gasto', error: error.message });
    }
  }));

  // DELETE gasto
  app.delete('/api/cmms/gastos-materiales/:id', requireAuth, requireRoles(['admin']), asyncHandler(async (req: any, res: any) => {
    try {
      await storage.deleteGastoMaterialMantencion(req.params.id);
      res.json({ message: 'Gasto eliminado exitosamente' });
    } catch (error: any) {
      console.error('Error al eliminar gasto:', error);
      res.status(500).json({ message: 'Error al eliminar gasto', error: error.message });
    }
  }));

  // ===== PLANES PREVENTIVOS ROUTES =====

  // GET planes preventivos (with filters)
  app.get('/api/cmms/planes-preventivos', requireAuth, requireRoles(['admin', 'supervisor', 'produccion']), asyncHandler(async (req: any, res: any) => {
    try {
      const { equipoId, activo } = req.query;
      const planes = await storage.getPlanesPreventivos({ 
        equipoId,
        activo: activo === 'true' ? true : activo === 'false' ? false : undefined 
      });
      res.json(planes);
    } catch (error: any) {
      console.error('Error al obtener planes:', error);
      res.status(500).json({ message: 'Error al obtener planes', error: error.message });
    }
  }));

  // GET planes preventivos vencidos
  app.get('/api/cmms/planes-preventivos/vencidos', requireAuth, requireRoles(['admin', 'supervisor', 'produccion']), asyncHandler(async (req: any, res: any) => {
    try {
      const planes = await storage.getPlanesPreventivosVencidos();
      res.json(planes);
    } catch (error: any) {
      console.error('Error al obtener planes vencidos:', error);
      res.status(500).json({ message: 'Error al obtener planes vencidos', error: error.message });
    }
  }));

  // GET plan preventivo by ID
  app.get('/api/cmms/planes-preventivos/:id', requireAuth, requireRoles(['admin', 'supervisor', 'produccion']), asyncHandler(async (req: any, res: any) => {
    try {
      const plan = await storage.getPlanPreventivoById(req.params.id);
      if (!plan) {
        return res.status(404).json({ message: 'Plan no encontrado' });
      }
      res.json(plan);
    } catch (error: any) {
      console.error('Error al obtener plan:', error);
      res.status(500).json({ message: 'Error al obtener plan', error: error.message });
    }
  }));

  // POST create plan preventivo
  app.post('/api/cmms/planes-preventivos', requireAuth, requireRoles(['admin', 'supervisor', 'produccion']), asyncHandler(async (req: any, res: any) => {
    try {
      // Validate input with Zod schema
      const validatedData = insertPlanPreventivoSchema.parse(req.body);
      
      const plan = await storage.createPlanPreventivo(validatedData);
      res.status(201).json(plan);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: 'Datos inválidos', errors: error.errors });
      }
      console.error('Error al crear plan:', error);
      res.status(500).json({ message: 'Error al crear plan', error: error.message });
    }
  }));

  // PATCH update plan preventivo
  app.patch('/api/cmms/planes-preventivos/:id', requireAuth, requireRoles(['admin', 'supervisor', 'produccion']), asyncHandler(async (req: any, res: any) => {
    try {
      // Validate input with partial schema for updates
      const validatedData = insertPlanPreventivoSchema.partial().parse(req.body);
      
      const plan = await storage.updatePlanPreventivo(req.params.id, validatedData);
      res.json(plan);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: 'Datos inválidos', errors: error.errors });
      }
      console.error('Error al actualizar plan:', error);
      res.status(500).json({ message: 'Error al actualizar plan', error: error.message });
    }
  }));

  // DELETE plan preventivo
  app.delete('/api/cmms/planes-preventivos/:id', requireAuth, requireRoles(['admin']), asyncHandler(async (req: any, res: any) => {
    try {
      await storage.deletePlanPreventivo(req.params.id);
      res.json({ message: 'Plan eliminado exitosamente' });
    } catch (error: any) {
      console.error('Error al eliminar plan:', error);
      res.status(500).json({ message: 'Error al eliminar plan', error: error.message });
    }
  }));

  // ===== MANTENCIONES PLANIFICADAS =====

  // GET lista de mantenciones planificadas
  app.get('/api/cmms/mantenciones-planificadas', requireAuth, requireRoles(['admin', 'supervisor', 'produccion']), asyncHandler(async (req: any, res: any) => {
    try {
      const { anio, estado, area } = req.query;
      const filters: any = {};
      if (anio) filters.anio = parseInt(anio);
      if (estado) filters.estado = estado;
      if (area) filters.area = area;
      
      const mantenciones = await storage.getMantencionesPlanificadas(filters);
      res.json(mantenciones);
    } catch (error: any) {
      console.error('Error al obtener mantenciones planificadas:', error);
      res.status(500).json({ message: 'Error al obtener mantenciones planificadas', error: error.message });
    }
  }));

  // GET mantención planificada por ID
  app.get('/api/cmms/mantenciones-planificadas/:id', requireAuth, requireRoles(['admin', 'supervisor', 'produccion']), asyncHandler(async (req: any, res: any) => {
    try {
      const mantencion = await storage.getMantencionPlanificadaById(req.params.id);
      if (!mantencion) {
        return res.status(404).json({ message: 'Mantención planificada no encontrada' });
      }
      res.json(mantencion);
    } catch (error: any) {
      console.error('Error al obtener mantención planificada:', error);
      res.status(500).json({ message: 'Error al obtener mantención planificada', error: error.message });
    }
  }));

  // POST crear mantención planificada
  app.post('/api/cmms/mantenciones-planificadas', requireAuth, requireRoles(['admin', 'supervisor', 'produccion']), asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      const validatedData = insertMantencionPlanificadaSchema.parse(req.body);
      
      const nuevaMantencion = await storage.createMantencionPlanificada({
        ...validatedData,
        creadoPorId: user.id,
        creadoPorName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
      });
      
      res.status(201).json(nuevaMantencion);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: 'Datos inválidos', errors: error.errors });
      }
      console.error('Error al crear mantención planificada:', error);
      res.status(500).json({ message: 'Error al crear mantención planificada', error: error.message });
    }
  }));

  // PATCH actualizar mantención planificada
  app.patch('/api/cmms/mantenciones-planificadas/:id', requireAuth, requireRoles(['admin', 'supervisor', 'produccion']), asyncHandler(async (req: any, res: any) => {
    try {
      console.log('[MANTENCION-UPDATE] ID:', req.params.id);
      console.log('[MANTENCION-UPDATE] Body recibido:', JSON.stringify(req.body, null, 2));
      const validatedData = insertMantencionPlanificadaSchema.partial().parse(req.body);
      console.log('[MANTENCION-UPDATE] Datos validados:', JSON.stringify(validatedData, null, 2));
      const mantencion = await storage.updateMantencionPlanificada(req.params.id, validatedData);
      console.log('[MANTENCION-UPDATE] Resultado:', JSON.stringify(mantencion, null, 2));
      res.json(mantencion);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        console.error('[MANTENCION-UPDATE] Error de validación Zod:', error.errors);
        return res.status(400).json({ message: 'Datos inválidos', errors: error.errors });
      }
      console.error('Error al actualizar mantención planificada:', error);
      res.status(500).json({ message: 'Error al actualizar mantención planificada', error: error.message });
    }
  }));

  // DELETE mantención planificada
  app.delete('/api/cmms/mantenciones-planificadas/:id', requireAuth, requireRoles(['admin']), asyncHandler(async (req: any, res: any) => {
    try {
      await storage.deleteMantencionPlanificada(req.params.id);
      res.json({ message: 'Mantención planificada eliminada exitosamente' });
    } catch (error: any) {
      console.error('Error al eliminar mantención planificada:', error);
      res.status(500).json({ message: 'Error al eliminar mantención planificada', error: error.message });
    }
  }));

  // GET presupuesto ejecutado del mes (gastos reales de OTs)
  app.get('/api/cmms/presupuesto-ejecutado/:anio/:mes', requireAuth, requireRoles(['admin', 'supervisor']), asyncHandler(async (req: any, res: any) => {
    try {
      const { anio, mes } = req.params;
      const { area } = req.query;
      const ejecutado = await storage.getPresupuestoEjecutadoDelMes(
        parseInt(anio),
        parseInt(mes),
        area
      );
      res.json({ ejecutado });
    } catch (error: any) {
      console.error('Error al obtener presupuesto ejecutado:', error);
      res.status(500).json({ message: 'Error al obtener presupuesto ejecutado', error: error.message });
    }
  }));

  // ===== CMMS METRICS & DASHBOARDS =====

  // GET CMMS metrics/KPIs
  app.get('/api/cmms/metrics', requireAuth, requireRoles(['admin', 'supervisor', 'produccion']), asyncHandler(async (req: any, res: any) => {
    try {
      const { startDate, endDate, area } = req.query;
      const metrics = await storage.getCMMSMetrics({ startDate, endDate, area });
      res.json(metrics);
    } catch (error: any) {
      console.error('Error al obtener métricas CMMS:', error);
      res.status(500).json({ message: 'Error al obtener métricas', error: error.message });
    }
  }));

  // POST ejecutar scheduler de mantenimiento preventivo (TEMPORAL - SOLO PARA PRUEBAS)
  app.post('/api/cmms/scheduler/run-preventive', requireAuth, requireRoles(['admin']), asyncHandler(async (req: any, res: any) => {
    try {
      console.log('🔧 [MANUAL] Ejecutando scheduler de mantenimiento preventivo...');
      const otsGenerated = await storage.processPreventiveMaintenanceSchedule();
      console.log(`✅ [MANUAL] Scheduler completado - ${otsGenerated} OTs generadas`);
      res.json({ 
        success: true, 
        otsGenerated,
        message: `Scheduler ejecutado exitosamente. ${otsGenerated} OTs generadas.`
      });
    } catch (error: any) {
      console.error('Error al ejecutar scheduler:', error);
      res.status(500).json({ message: 'Error al ejecutar scheduler', error: error.message });
    }
  }));

  // ==================================================================================
  // MARKETING MODULE routes
  // ==================================================================================
  
  // Presupuesto Marketing routes
  app.post('/api/marketing/presupuesto', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      
      // Only admin can create/update presupuesto
      if (user.role !== 'admin') {
        return res.status(403).json({ message: 'No autorizado' });
      }
      
      const { mes, anio, presupuestoTotal } = req.body;
      
      // Check if presupuesto already exists for this period
      const existing = await storage.getPresupuestoMarketing(mes, anio);
      
      if (existing) {
        // Update existing
        const updated = await storage.updatePresupuestoMarketing(existing.id, { presupuestoTotal });
        return res.json(updated);
      } else {
        // Create new
        const presupuesto = await storage.createPresupuestoMarketing({
          mes,
          anio,
          presupuestoTotal,
        });
        return res.status(201).json(presupuesto);
      }
    } catch (error: any) {
      res.status(500).json({ message: 'Error al guardar presupuesto', error: error.message });
    }
  }));

  app.get('/api/marketing/presupuesto/:mes/:anio', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const mes = parseInt(req.params.mes);
      const anio = parseInt(req.params.anio);
      
      const presupuesto = await storage.getPresupuestoMarketing(mes, anio);
      
      if (!presupuesto) {
        return res.status(404).json({ message: 'Presupuesto no encontrado' });
      }
      
      res.json(presupuesto);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al obtener presupuesto', error: error.message });
    }
  }));

  // Solicitudes Marketing routes
  app.post('/api/marketing/solicitudes', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      
      // Only supervisor and admin can create solicitudes
      if (user.role !== 'supervisor' && user.role !== 'admin') {
        return res.status(403).json({ message: 'Solo supervisores y administradores pueden crear solicitudes' });
      }
      
      let supervisorId = user.id;
      let supervisorName = user.salespersonName || `${user.firstName} ${user.lastName}`;
      
      // If admin is creating, they must specify supervisorId
      if (user.role === 'admin') {
        if (!req.body.supervisorId) {
          return res.status(400).json({ message: 'Debe especificar el supervisor' });
        }
        
        // Get supervisor info
        const supervisor = await storage.getUser(req.body.supervisorId);
        if (!supervisor) {
          return res.status(404).json({ message: 'Supervisor no encontrado' });
        }
        
        if (supervisor.role !== 'supervisor') {
          return res.status(400).json({ message: 'El usuario seleccionado debe ser supervisor' });
        }
        
        supervisorId = supervisor.id;
        supervisorName = supervisor.salespersonName || `${supervisor.firstName} ${supervisor.lastName}`;
      }
      
      // Prepare solicitud data
      const solicitudData: any = {
        ...req.body,
        supervisorId,
        supervisorName,
      };
      
      // Convert fechaEntrega to proper format if provided
      if (solicitudData.fechaEntrega) {
        // Ensure it's in YYYY-MM-DD format (remove time if present)
        solicitudData.fechaEntrega = solicitudData.fechaEntrega.split('T')[0];
      }
      
      // Validate urgency limit: max 3 "alta" urgency solicitudes per user
      if (solicitudData.urgencia === 'alta') {
        const urgentSolicitudes = await storage.getSolicitudesMarketingByUrgency(supervisorId, 'alta');
        const activeUrgentCount = urgentSolicitudes.filter(s => 
          s.estado !== 'completado' && s.estado !== 'rechazado'
        ).length;
        
        if (activeUrgentCount >= 3) {
          return res.status(400).json({ 
            message: 'No puedes tener más de 3 solicitudes con urgencia alta activas. Completa o cancela algunas antes de crear una nueva.' 
          });
        }
      }
      
      const solicitud = await storage.createSolicitudMarketing(solicitudData);
      
      // 🔔 Notificación automática: Nueva solicitud de marketing
      await NotifyHelper.notifySolicitudMarketing(
        solicitudData.titulo,
        solicitudData.presupuestoSolicitado || 0,
        supervisorName
      );
      
      res.status(201).json(solicitud);
    } catch (error: any) {
      console.error('Error creating marketing solicitud:', error);
      res.status(500).json({ message: 'Error al crear solicitud', error: error.message });
    }
  }));

  app.get('/api/marketing/solicitudes', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      const { mes, anio, estado } = req.query;
      
      const filters: any = {};
      
      if (mes) filters.mes = parseInt(mes as string);
      if (anio) filters.anio = parseInt(anio as string);
      if (estado) filters.estado = estado as string;
      
      // Supervisors can only see their own solicitudes
      if (user.role === 'supervisor') {
        filters.supervisorId = user.id;
      }
      
      const solicitudes = await storage.getSolicitudesMarketing(filters);
      res.json(solicitudes);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al obtener solicitudes', error: error.message });
    }
  }));

  app.get('/api/marketing/solicitudes/:id', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const solicitud = await storage.getSolicitudMarketingById(req.params.id);
      
      if (!solicitud) {
        return res.status(404).json({ message: 'Solicitud no encontrada' });
      }
      
      res.json(solicitud);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al obtener solicitud', error: error.message });
    }
  }));

  app.patch('/api/marketing/solicitudes/:id', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      const solicitud = await storage.getSolicitudMarketingById(req.params.id);
      
      if (!solicitud) {
        return res.status(404).json({ message: 'Solicitud no encontrada' });
      }
      
      // Only admin can update estado, only supervisor can update their own solicitudes
      if (req.body.estado && user.role !== 'admin') {
        return res.status(403).json({ message: 'Solo admin puede cambiar el estado' });
      }
      
      if (user.role === 'supervisor' && solicitud.supervisorId !== user.id) {
        return res.status(403).json({ message: 'No autorizado' });
      }
      
      // Validate urgency limit when changing to "alta"
      if (req.body.urgencia === 'alta' && solicitud.urgencia !== 'alta') {
        const urgentSolicitudes = await storage.getSolicitudesMarketingByUrgency(solicitud.supervisorId!, 'alta');
        const activeUrgentCount = urgentSolicitudes.filter(s => 
          s.id !== solicitud.id && s.estado !== 'completado' && s.estado !== 'rechazado'
        ).length;
        
        if (activeUrgentCount >= 3) {
          return res.status(400).json({ 
            message: 'No puedes tener más de 3 solicitudes con urgencia alta activas. Completa o cancela algunas antes de cambiar la urgencia.' 
          });
        }
      }
      
      const updated = await storage.updateSolicitudMarketing(req.params.id, req.body);
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al actualizar solicitud', error: error.message });
    }
  }));

  app.delete('/api/marketing/solicitudes/:id', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      
      // Only admin can delete
      if (user.role !== 'admin') {
        return res.status(403).json({ message: 'No autorizado' });
      }
      
      await storage.deleteSolicitudMarketing(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: 'Error al eliminar solicitud', error: error.message });
    }
  }));

  // Cambiar estado de solicitud
  app.post('/api/marketing/solicitudes/:id/estado', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      const { estado, motivoRechazo, monto, pdfPresupuesto } = req.body;
      
      // Only admin can change estado
      if (user.role !== 'admin') {
        return res.status(403).json({ message: 'Solo admin puede cambiar el estado' });
      }
      
      if (!estado) {
        return res.status(400).json({ message: 'Estado es requerido' });
      }
      
      if (estado === 'rechazado' && !motivoRechazo) {
        return res.status(400).json({ message: 'Motivo de rechazo es requerido' });
      }
      
      const solicitud = await storage.updateSolicitudMarketingEstado(req.params.id, estado, motivoRechazo, monto, pdfPresupuesto);
      res.json(solicitud);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al cambiar estado', error: error.message });
    }
  }));

  // Update pasos for a solicitud
  app.patch('/api/marketing/solicitudes/:id/pasos', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      const solicitud = await storage.getSolicitudMarketingById(req.params.id);
      
      if (!solicitud) {
        return res.status(404).json({ message: 'Solicitud no encontrada' });
      }
      
      // Supervisor can update their own solicitudes, admin can update all
      if (user.role === 'supervisor' && solicitud.supervisorId !== user.id) {
        return res.status(403).json({ message: 'No autorizado' });
      }
      
      if (user.role !== 'admin' && user.role !== 'supervisor') {
        return res.status(403).json({ message: 'No autorizado' });
      }
      
      const { pasos } = req.body;
      
      if (!Array.isArray(pasos)) {
        return res.status(400).json({ message: 'Pasos debe ser un array' });
      }
      
      const updated = await storage.updateSolicitudMarketing(req.params.id, { pasos });
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al actualizar pasos', error: error.message });
    }
  }));

  // Toggle paso completado
  app.patch('/api/marketing/solicitudes/:id/pasos/:index/toggle', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      const solicitud = await storage.getSolicitudMarketingById(req.params.id);
      
      if (!solicitud) {
        return res.status(404).json({ message: 'Solicitud no encontrada' });
      }
      
      // Supervisor can update their own solicitudes, admin can update all
      if (user.role === 'supervisor' && solicitud.supervisorId !== user.id) {
        return res.status(403).json({ message: 'No autorizado' });
      }
      
      if (user.role !== 'admin' && user.role !== 'supervisor') {
        return res.status(403).json({ message: 'No autorizado' });
      }
      
      const index = parseInt(req.params.index);
      const pasos = (solicitud.pasos as any[]) || [];
      
      if (index < 0 || index >= pasos.length) {
        return res.status(400).json({ message: 'Índice de paso inválido' });
      }
      
      pasos[index].completado = !pasos[index].completado;
      
      const updated = await storage.updateSolicitudMarketing(req.params.id, { pasos });
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al actualizar paso', error: error.message });
    }
  }));

  // Update solicitud notas
  app.patch('/api/marketing/solicitudes/:id/notas', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      const solicitud = await storage.getSolicitudMarketingById(req.params.id);
      
      if (!solicitud) {
        return res.status(404).json({ message: 'Solicitud no encontrada' });
      }
      
      // Supervisor can update their own solicitudes, admin can update all
      if (user.role === 'supervisor' && solicitud.supervisorId !== user.id) {
        return res.status(403).json({ message: 'No autorizado' });
      }
      
      if (user.role !== 'admin' && user.role !== 'supervisor') {
        return res.status(403).json({ message: 'No autorizado' });
      }
      
      const { notas } = req.body;
      
      const updated = await storage.updateSolicitudMarketing(req.params.id, { notas });
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al actualizar notas', error: error.message });
    }
  }));

  // Marketing metrics
  app.get('/api/marketing/metrics/:mes/:anio', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const mes = parseInt(req.params.mes);
      const anio = parseInt(req.params.anio);
      
      const metrics = await storage.getMarketingMetrics(mes, anio);
      res.json(metrics);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al obtener métricas', error: error.message });
    }
  }));

  // Inventario Marketing routes
  app.post('/api/marketing/inventario', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      
      // Only admin can create inventory items
      if (user.role !== 'admin') {
        return res.status(403).json({ message: 'Solo admin puede crear items de inventario' });
      }
      
      const item = await storage.createInventarioMarketing(req.body);
      res.json(item);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al crear item de inventario', error: error.message });
    }
  }));

  app.get('/api/marketing/inventario', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const { search, estado } = req.query;
      
      const filters: any = {};
      if (search) filters.search = search as string;
      if (estado) filters.estado = estado as string;
      
      const items = await storage.getInventarioMarketing(filters);
      res.json(items);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al obtener inventario', error: error.message });
    }
  }));

  app.get('/api/marketing/inventario/summary', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const summary = await storage.getInventarioMarketingSummary();
      res.json(summary);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al obtener resumen de inventario', error: error.message });
    }
  }));

  app.get('/api/marketing/inventario/:id', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const item = await storage.getInventarioMarketingById(req.params.id);
      
      if (!item) {
        return res.status(404).json({ message: 'Item no encontrado' });
      }
      
      res.json(item);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al obtener item', error: error.message });
    }
  }));

  app.patch('/api/marketing/inventario/:id', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      
      // Only admin can update inventory items
      if (user.role !== 'admin') {
        return res.status(403).json({ message: 'Solo admin puede actualizar items de inventario' });
      }
      
      const item = await storage.updateInventarioMarketing(req.params.id, req.body);
      res.json(item);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al actualizar item', error: error.message });
    }
  }));

  app.delete('/api/marketing/inventario/:id', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      
      // Only admin can delete inventory items
      if (user.role !== 'admin') {
        return res.status(403).json({ message: 'Solo admin puede eliminar items de inventario' });
      }
      
      await storage.deleteInventarioMarketing(req.params.id);
      res.json({ message: 'Item eliminado correctamente' });
    } catch (error: any) {
      res.status(500).json({ message: 'Error al eliminar item', error: error.message });
    }
  }));

  // ==================================================================================
  // HITOS DE MARKETING routes
  // ==================================================================================

  // Get all hitos
  app.get('/api/marketing/hitos', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const { mes, anio } = req.query;
      
      const filters: any = {};
      if (mes) filters.mes = parseInt(mes);
      if (anio) filters.anio = parseInt(anio);
      
      const hitos = await storage.getHitosMarketing(filters);
      res.json(hitos);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al obtener hitos', error: error.message });
    }
  }));

  // Get hito by ID
  app.get('/api/marketing/hitos/:id', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const hito = await storage.getHitoMarketingById(req.params.id);
      
      if (!hito) {
        return res.status(404).json({ message: 'Hito no encontrado' });
      }
      
      res.json(hito);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al obtener hito', error: error.message });
    }
  }));

  // Create hito
  app.post('/api/marketing/hitos', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      
      // Only admin and supervisor can create hitos
      if (user.role !== 'admin' && user.role !== 'supervisor') {
        return res.status(403).json({ message: 'No tienes permisos para crear hitos' });
      }
      
      const validatedData = insertHitoMarketingSchema.parse({
        ...req.body,
        createdBy: user.id,
      });
      
      const hito = await storage.createHitoMarketing(validatedData);
      res.status(201).json(hito);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: 'Datos inválidos', errors: error.errors });
      }
      res.status(500).json({ message: 'Error al crear hito', error: error.message });
    }
  }));

  // Update hito
  app.patch('/api/marketing/hitos/:id', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      
      // Only admin and supervisor can update hitos
      if (user.role !== 'admin' && user.role !== 'supervisor') {
        return res.status(403).json({ message: 'No tienes permisos para editar hitos' });
      }
      
      const hito = await storage.updateHitoMarketing(req.params.id, req.body);
      res.json(hito);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al actualizar hito', error: error.message });
    }
  }));

  // Delete hito
  app.delete('/api/marketing/hitos/:id', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      
      // Only admin can delete hitos
      if (user.role !== 'admin') {
        return res.status(403).json({ message: 'Solo admin puede eliminar hitos' });
      }
      
      await storage.deleteHitoMarketing(req.params.id);
      res.json({ message: 'Hito eliminado correctamente' });
    } catch (error: any) {
      res.status(500).json({ message: 'Error al eliminar hito', error: error.message });
    }
  }));

  // ==================================================================================
  // INVENTORY routes
  // ==================================================================================
  
  // Get inventory with filters
  app.get('/api/inventory', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const { search, warehouse } = req.query;
      
      const filters: any = {};
      if (search) filters.search = search;
      if (warehouse) filters.warehouse = warehouse;
      
      const inventory = await storage.getInventory(filters);
      res.json(inventory);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al obtener inventario', error: error.message });
    }
  }));

  // Get inventory summary
  app.get('/api/inventory/summary', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const { search, warehouse, branch } = req.query;
      
      const filters: any = {};
      if (search) filters.search = search;
      if (warehouse) filters.warehouse = warehouse;
      if (branch) filters.branch = branch;
      
      const summary = await storage.getInventorySummary(filters);
      res.json(summary);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al obtener resumen de inventario', error: error.message });
    }
  }));

  // Get inventory with prices from SQL Server
  app.get('/api/inventory-with-prices', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const { search, warehouse, branch } = req.query;
      
      const filters: any = {};
      if (search) filters.search = search;
      if (warehouse) filters.warehouse = warehouse;
      if (branch) filters.branch = branch;
      
      // Auto-sync: Check if we need to sync inventory in background
      const user = req.user;
      if (user && user.id && user.email) {
        const lastSync = await storage.getLastSync();
        const now = Date.now();
        const oneMinute = 60000; // 1 minute in milliseconds
        
        if (!lastSync || (now - new Date(lastSync.createdAt).getTime()) > oneMinute) {
          console.log('🔄 Auto-sync: Last sync was more than 1 minute ago, triggering background sync...');
          // Trigger sync in background without waiting
          storage.syncProductsFromERP(user.id, user.email).then(result => {
            if (result.status === 'success') {
              console.log(`✅ Auto-sync completed: ${result.productsNew} new, ${result.productsUpdated} updated`);
            } else {
              console.log(`⚠️ Auto-sync ${result.status}: ${result.errorMessage || 'unknown error'}`);
            }
          }).catch(err => {
            console.error('❌ Auto-sync error:', err.message);
          });
        }
      }
      
      // Return data immediately (don't wait for sync)
      const inventory = await storage.getInventoryWithPrices(filters);
      res.json(inventory);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al obtener inventario con precios', error: error.message });
    }
  }));

  // Get inventory summary with prices and total value
  app.get('/api/inventory/summary-with-prices', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const { search, warehouse, branch, hideNoStock, hideZZProducts } = req.query;
      
      const filters: any = {};
      if (search) filters.search = search;
      if (warehouse) filters.warehouse = warehouse;
      if (branch) filters.branch = branch;
      if (hideNoStock === 'true') filters.hideNoStock = true;
      if (hideZZProducts === 'true') filters.hideZZProducts = true;
      
      // Auto-sync: Check if we need to sync inventory in background
      const user = req.user;
      if (user && user.id && user.email) {
        const lastSync = await storage.getLastSync();
        const now = Date.now();
        const oneMinute = 60000; // 1 minute in milliseconds
        
        if (!lastSync || (now - new Date(lastSync.createdAt).getTime()) > oneMinute) {
          console.log('🔄 Auto-sync: Last sync was more than 1 minute ago, triggering background sync...');
          // Trigger sync in background without waiting
          storage.syncProductsFromERP(user.id, user.email).then(result => {
            if (result.status === 'success') {
              console.log(`✅ Auto-sync completed: ${result.productsNew} new, ${result.productsUpdated} updated`);
            } else {
              console.log(`⚠️ Auto-sync ${result.status}: ${result.errorMessage || 'unknown error'}`);
            }
          }).catch(err => {
            console.error('❌ Auto-sync error:', err.message);
          });
        }
      }
      
      // Return data immediately (don't wait for sync)
      const summary = await storage.getInventorySummaryWithPrices(filters);
      res.json(summary);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al obtener resumen de inventario con precios', error: error.message });
    }
  }));

  // Sync products from ERP to PostgreSQL
  app.post('/api/inventory/sync', requireRoles('admin', 'supervisor'), asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      if (!user || !user.id || !user.email) {
        return res.status(401).json({ message: 'Usuario no autenticado' });
      }

      console.log(`🔄 Starting inventory sync requested by ${user.email}`);
      
      const result = await storage.syncProductsFromERP(user.id, user.email);
      
      if (result.status === 'error') {
        return res.status(500).json({
          message: 'Error al sincronizar catálogo',
          error: result.errorMessage,
          ...result,
        });
      }

      res.json({
        message: 'Sincronización completada exitosamente',
        ...result,
      });
    } catch (error: any) {
      console.error('Error in sync endpoint:', error);
      res.status(500).json({ message: 'Error al sincronizar catálogo', error: error.message });
    }
  }));

  // Get last sync info
  app.get('/api/inventory/last-sync', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const lastSync = await storage.getLastSync();
      res.json(lastSync);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al obtener última sincronización', error: error.message });
    }
  }));

  // Get sync history
  app.get('/api/inventory/sync-history', requireRoles('admin', 'supervisor'), asyncHandler(async (req: any, res: any) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
      const history = await storage.getSyncHistory(limit);
      res.json(history);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al obtener historial de sincronización', error: error.message });
    }
  }));

  // ==================================================================================
  // SALES ETL SYNCHRONIZATION routes
  // ==================================================================================

  // Sync sales from ERP to PostgreSQL
  app.post('/api/etl/sync-sales', requireRoles(['admin', 'supervisor']), asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      if (!user || !user.id || !user.email) {
        return res.status(401).json({ message: 'Usuario no autenticado' });
      }

      const { startDate, endDate, mode = 'incremental' } = req.body;

      // Validate required fields
      if (!startDate || !endDate) {
        return res.status(400).json({ 
          message: 'Fechas de inicio y fin son requeridas',
          error: 'startDate and endDate are required' 
        });
      }

      // Validate mode
      if (!['incremental', 'full'].includes(mode)) {
        return res.status(400).json({ 
          message: 'Modo inválido',
          error: 'mode must be "incremental" or "full"' 
        });
      }

      console.log(`🔄 Starting sales ETL sync requested by ${user.email}`);
      console.log(`📅 Period: ${startDate} to ${endDate} (${mode})`);
      
      const result = await storage.syncSalesFromERP(user.id, user.email, startDate, endDate, mode);
      
      if (result.status === 'error') {
        return res.status(500).json({
          message: 'Error al sincronizar ventas desde ERP',
          error: result.errorMessage,
          ...result,
        });
      }

      res.json({
        message: result.status === 'success' 
          ? 'Sincronización completada exitosamente' 
          : 'Sincronización completada con advertencias',
        ...result,
      });
    } catch (error: any) {
      console.error('Error in sales sync endpoint:', error);
      res.status(500).json({ message: 'Error al sincronizar ventas', error: error.message });
    }
  }));

  // Get last sales sync info
  app.get('/api/etl/sync-sales/status', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const lastSync = await storage.getLastSalesSync();
      res.json(lastSync);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al obtener última sincronización de ventas', error: error.message });
    }
  }));

  // Get sales sync history
  app.get('/api/etl/sync-sales/history', requireRoles(['admin', 'supervisor']), asyncHandler(async (req: any, res: any) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
      const history = await storage.getSalesSyncHistory(limit);
      res.json(history);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al obtener historial de sincronización de ventas', error: error.message });
    }
  }));

  // Get last sales watermark (for incremental sync)
  app.get('/api/etl/sync-sales/watermark', requireRoles(['admin', 'supervisor']), asyncHandler(async (req: any, res: any) => {
    try {
      const watermark = await storage.getLastSalesWatermark();
      res.json({ watermark });
    } catch (error: any) {
      res.status(500).json({ message: 'Error al obtener watermark de sincronización', error: error.message });
    }
  }));

  // ==================================================================================
  // GASTOS EMPRESARIALES routes
  // ==================================================================================

  // Upload evidencia file
  app.post('/api/gastos-empresariales/upload-evidencia', requireAuth, upload.single('file'), asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      
      // Only salesperson, supervisor and admin can upload evidence
      if (!['salesperson', 'supervisor', 'admin'].includes(user.role)) {
        return res.status(403).json({ message: 'No autorizado para subir evidencia' });
      }
      
      if (!req.file) {
        return res.status(400).json({ message: 'No se ha subido ningún archivo' });
      }

      const file = req.file;
      const timestamp = Date.now();
      const randomId = nanoid(8);
      const fileExtension = path.extname(file.originalname);
      const fileName = `gasto-evidencia-${timestamp}-${randomId}${fileExtension}`;

      // Upload to Object Storage (permanent storage)
      const objectStorageService = new ObjectStorageService();
      const imageUrl = await objectStorageService.uploadImage(fileName, file.buffer, file.mimetype);
      console.log(`☁️ [EVIDENCIA] Uploaded to Object Storage: ${fileName}`);
      res.json({ url: imageUrl });
    } catch (error: any) {
      console.error('Error uploading evidencia:', error);
      res.status(500).json({ message: 'Error al subir archivo', error: error.message });
    }
  }));

  // Create gasto
  app.post('/api/gastos-empresariales', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      
      // Only salesperson, supervisor and admin can create expenses
      if (!['salesperson', 'supervisor', 'admin'].includes(user.role)) {
        return res.status(403).json({ message: 'No autorizado para crear gastos' });
      }
      
      // Admin and supervisor can create expenses on behalf of other users
      // Salesperson can only create their own expenses
      let targetUserId = user.id;
      if (['admin', 'supervisor'].includes(user.role) && req.body.userId) {
        targetUserId = req.body.userId;
      }
      
      const validated = insertGastoEmpresarialSchema.parse({
        ...req.body,
        userId: targetUserId,
      });
      
      const gasto = await storage.createGastoEmpresarial(validated);
      
      // 🔔 Notificación automática: Nuevo gasto creado
      const creatorName = user.salespersonName || `${user.firstName} ${user.lastName}` || user.email;
      await NotifyHelper.notifyGastoCreado(
        validated.categoria,
        validated.monto,
        creatorName
      );
      
      res.status(201).json(gasto);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: 'Datos inválidos', errors: error.errors });
      }
      res.status(500).json({ message: 'Error al crear gasto', error: error.message });
    }
  }));

  // Get gastos with filters
  app.get('/api/gastos-empresariales', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      const { estado, fechaDesde, fechaHasta, categoria, userId, limit, offset } = req.query;
      
      const filters: any = {};
      
      // Salesperson can only see their own expenses
      if (user.role === 'salesperson') {
        filters.userId = user.id;
      } else if (userId) {
        // Supervisor and admin can filter by userId
        filters.userId = userId;
      }
      
      if (estado) filters.estado = estado;
      if (fechaDesde) filters.fechaDesde = fechaDesde;
      if (fechaHasta) filters.fechaHasta = fechaHasta;
      if (categoria) filters.categoria = categoria;
      if (limit) filters.limit = parseInt(limit);
      if (offset) filters.offset = parseInt(offset);
      
      const gastos = await storage.getGastosEmpresariales(filters);
      res.json(gastos);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al obtener gastos', error: error.message });
    }
  }));

  // Get gasto by ID
  app.get('/api/gastos-empresariales/:id', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      const gasto = await storage.getGastoEmpresarialById(req.params.id);
      
      if (!gasto) {
        return res.status(404).json({ message: 'Gasto no encontrado' });
      }
      
      // Salesperson can only see their own expense
      if (user.role === 'salesperson' && gasto.userId !== user.id) {
        return res.status(403).json({ message: 'No autorizado' });
      }
      
      res.json(gasto);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al obtener gasto', error: error.message });
    }
  }));

  // Update gasto
  app.patch('/api/gastos-empresariales/:id', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      const gasto = await storage.getGastoEmpresarialById(req.params.id);
      
      if (!gasto) {
        return res.status(404).json({ message: 'Gasto no encontrado' });
      }
      
      // Only the creator can update pending expenses
      if (gasto.estado !== 'pendiente' || gasto.userId !== user.id) {
        return res.status(403).json({ message: 'No se puede modificar este gasto' });
      }
      
      const updated = await storage.updateGastoEmpresarial(req.params.id, req.body);
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al actualizar gasto', error: error.message });
    }
  }));

  // Delete gasto
  app.delete('/api/gastos-empresariales/:id', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      const gasto = await storage.getGastoEmpresarialById(req.params.id);
      
      if (!gasto) {
        return res.status(404).json({ message: 'Gasto no encontrado' });
      }
      
      // Only the creator can delete pending expenses or admin
      if ((gasto.estado !== 'pendiente' || gasto.userId !== user.id) && user.role !== 'admin') {
        return res.status(403).json({ message: 'No se puede eliminar este gasto' });
      }
      
      await storage.deleteGastoEmpresarial(req.params.id);
      res.json({ message: 'Gasto eliminado correctamente' });
    } catch (error: any) {
      res.status(500).json({ message: 'Error al eliminar gasto', error: error.message });
    }
  }));

  // Approve gasto (supervisor/admin only)
  app.post('/api/gastos-empresariales/:id/aprobar', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      
      if (!['supervisor', 'admin'].includes(user.role)) {
        return res.status(403).json({ message: 'Solo supervisores y admin pueden aprobar gastos' });
      }
      
      const gasto = await storage.aprobarGastoEmpresarial(req.params.id, user.id);
      res.json(gasto);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al aprobar gasto', error: error.message });
    }
  }));

  // Reject gasto (supervisor/admin only)
  app.post('/api/gastos-empresariales/:id/rechazar', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      
      if (!['supervisor', 'admin'].includes(user.role)) {
        return res.status(403).json({ message: 'Solo supervisores y admin pueden rechazar gastos' });
      }
      
      const { comentario } = req.body;
      if (!comentario) {
        return res.status(400).json({ message: 'El comentario es requerido para rechazar' });
      }
      
      const gasto = await storage.rechazarGastoEmpresarial(req.params.id, user.id, comentario);
      res.json(gasto);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al rechazar gasto', error: error.message });
    }
  }));

  // Get gastos summary
  app.get('/api/gastos-empresariales/analytics/summary', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      const { mes, anio, userId } = req.query;
      
      const filters: any = {};
      
      // Salesperson can only see their own summary
      if (user.role === 'salesperson') {
        filters.userId = user.id;
      } else if (userId) {
        filters.userId = userId;
      }
      
      if (mes) filters.mes = parseInt(mes);
      if (anio) filters.anio = parseInt(anio);
      
      const summary = await storage.getGastosEmpresarialesSummary(filters);
      res.json(summary);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al obtener resumen', error: error.message });
    }
  }));

  // Get gastos by categoria
  app.get('/api/gastos-empresariales/analytics/por-categoria', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      const { mes, anio, userId } = req.query;
      
      const filters: any = {};
      
      // Salesperson can only see their own analytics
      if (user.role === 'salesperson') {
        filters.userId = user.id;
      } else if (userId) {
        filters.userId = userId;
      }
      
      if (mes) filters.mes = parseInt(mes);
      if (anio) filters.anio = parseInt(anio);
      
      const data = await storage.getGastosEmpresarialesByCategoria(filters);
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al obtener datos por categoría', error: error.message });
    }
  }));

  // Get gastos by user (supervisor/admin only)
  app.get('/api/gastos-empresariales/analytics/por-usuario', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      
      if (!['supervisor', 'admin'].includes(user.role)) {
        return res.status(403).json({ message: 'No autorizado' });
      }
      
      const { mes, anio } = req.query;
      
      const filters: any = {};
      if (mes) filters.mes = parseInt(mes);
      if (anio) filters.anio = parseInt(anio);
      
      const data = await storage.getGastosEmpresarialesByUser(filters);
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al obtener datos por usuario', error: error.message });
    }
  }));

  // Get gastos by day
  app.get('/api/gastos-empresariales/analytics/por-dia', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      const { mes, anio, userId } = req.query;
      
      const filters: any = {};
      
      // Salesperson can only see their own analytics
      if (user.role === 'salesperson') {
        filters.userId = user.id;
      } else if (userId) {
        filters.userId = userId;
      }
      
      if (mes) filters.mes = parseInt(mes);
      if (anio) filters.anio = parseInt(anio);
      
      const data = await storage.getGastosEmpresarialesByDia(filters);
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al obtener datos por día', error: error.message });
    }
  }));

  // ==================================================================================
  // PROMESAS DE COMPRA ROUTES
  // ==================================================================================

  // Create promesa de compra (salesperson only)
  app.post('/api/promesas-compra', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      
      if (!['salesperson', 'supervisor', 'admin'].includes(user.role)) {
        return res.status(403).json({ message: 'No autorizado' });
      }
      
      // Determinar el vendedorId correcto según el rol
      let vendedorId: string;
      if (user.role === 'salesperson') {
        // Los vendedores solo pueden crear promesas para sí mismos
        vendedorId = user.id;
      } else {
        // Admin/supervisor pueden crear para cualquier vendedor
        vendedorId = req.body.vendedorId || user.id;
      }
      
      const validatedData = insertPromesaCompraSchema.parse({
        ...req.body,
        vendedorId: vendedorId
      });
      
      const promesa = await storage.createPromesaCompra(validatedData);
      res.status(201).json(promesa);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: 'Datos inválidos', errors: error.errors });
      }
      res.status(500).json({ message: 'Error al crear promesa de compra', error: error.message });
    }
  }));

  // Get promesas de compra
  app.get('/api/promesas-compra', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      const { vendedorId, clienteId, semana, anio, limit, offset } = req.query;
      
      const filters: any = {};
      
      // Salesperson can only see their own promesas
      if (user.role === 'salesperson') {
        filters.vendedorId = user.id;
      } else if (vendedorId) {
        filters.vendedorId = vendedorId;
      }
      
      if (clienteId) filters.clienteId = clienteId;
      if (semana) filters.semana = semana;
      if (anio) filters.anio = parseInt(anio);
      if (limit) filters.limit = parseInt(limit);
      if (offset) filters.offset = parseInt(offset);
      
      const promesas = await storage.getPromesasCompra(filters);
      res.json(promesas);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al obtener promesas de compra', error: error.message });
    }
  }));

  // Get promesa de compra by ID
  app.get('/api/promesas-compra/:id', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      const promesa = await storage.getPromesaCompraById(req.params.id);
      
      if (!promesa) {
        return res.status(404).json({ message: 'Promesa no encontrada' });
      }
      
      // Check authorization
      if (user.role === 'salesperson' && promesa.vendedorId !== user.id) {
        return res.status(403).json({ message: 'No autorizado' });
      }
      
      res.json(promesa);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al obtener promesa de compra', error: error.message });
    }
  }));

  // Update promesa de compra
  app.patch('/api/promesas-compra/:id', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      const promesa = await storage.getPromesaCompraById(req.params.id);
      
      if (!promesa) {
        return res.status(404).json({ message: 'Promesa no encontrada' });
      }
      
      // Check authorization
      if (user.role === 'salesperson' && promesa.vendedorId !== user.id) {
        return res.status(403).json({ message: 'No autorizado' });
      }
      
      const updated = await storage.updatePromesaCompra(req.params.id, req.body);
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al actualizar promesa de compra', error: error.message });
    }
  }));

  // Delete promesa de compra
  app.delete('/api/promesas-compra/:id', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      const promesa = await storage.getPromesaCompraById(req.params.id);
      
      if (!promesa) {
        return res.status(404).json({ message: 'Promesa no encontrada' });
      }
      
      // Check authorization
      if (user.role === 'salesperson' && promesa.vendedorId !== user.id) {
        return res.status(403).json({ message: 'No autorizado' });
      }
      
      await storage.deletePromesaCompra(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: 'Error al eliminar promesa de compra', error: error.message });
    }
  }));

  // Update promesa de compra (solo admin/supervisor)
  app.patch('/api/promesas-compra/:id', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      
      // Solo admin y supervisor pueden editar
      if (!['admin', 'supervisor'].includes(user.role)) {
        return res.status(403).json({ message: 'No autorizado para editar promesas' });
      }
      
      const { id } = req.params;
      const { ventasRealesManual, observaciones } = req.body;
      
      const promesa = await storage.updatePromesaCompra(id, {
        ventasRealesManual: ventasRealesManual ? parseFloat(ventasRealesManual) : null,
        observaciones
      });
      
      res.json(promesa);
    } catch (error: any) {
      console.error('[ERROR] /api/promesas-compra/:id:', error);
      res.status(500).json({ message: 'Error al actualizar promesa', error: error.message });
    }
  }));

  // Get promesas con cumplimiento (comparación con ventas reales)
  app.get('/api/promesas-compra/cumplimiento/reporte', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      const { vendedorId, semana, anio, startDate, endDate } = req.query;
      
      const filters: any = {};
      
      // Salesperson can only see their own data
      if (user.role === 'salesperson') {
        filters.vendedorId = user.id;
      } else if (vendedorId) {
        filters.vendedorId = vendedorId;
      }
      
      // Use startDate/endDate if provided, otherwise use semana/anio
      if (startDate && endDate) {
        filters.startDate = startDate;
        filters.endDate = endDate;
      } else {
        if (semana) filters.semana = semana;
        if (anio) filters.anio = parseInt(anio);
      }
      
      console.log('🔍 [PROMESAS] Query filters:', JSON.stringify(filters, null, 2));
      console.log('🔍 [PROMESAS] User role:', user.role, '| User ID:', user.id);
      
      const resultados = await storage.getPromesasConCumplimiento(filters);
      
      console.log(`✅ [PROMESAS] Found ${resultados.length} promesas`);
      if (resultados.length > 0) {
        console.log('📊 [PROMESAS] Sample:', JSON.stringify(resultados[0], null, 2));
      }
      
      // Keep the nested structure that the frontend expects
      res.json(resultados);
    } catch (error: any) {
      console.error('[ERROR] /api/promesas-compra/cumplimiento/reporte:', error);
      res.status(500).json({ message: 'Error al obtener reporte de cumplimiento', error: error.message });
    }
  }));

  // ============================================================================
  // ETL Routes - Automatic incremental data warehouse updates
  // ============================================================================

  // Execute ETL manually (admin/supervisor only)
  app.post('/api/etl/execute', requireAdminOrSupervisor, asyncHandler(async (req: any, res: any) => {
    try {
      const { etlName = 'ventas_incremental' } = req.query;
      console.log('\n╔═══════════════════════════════════════════════════════════════╗');
      console.log('║  🚀 ETL MANUAL EXECUTION INICIADO                            ║');
      console.log('╚═══════════════════════════════════════════════════════════════╝');
      console.log(`👤 Solicitado por: ${req.user.email}`);
      console.log(`📝 ETL: ${etlName}`);
      console.log(`⏰ Timestamp: ${new Date().toISOString()}\n`);
      
      // Execute ETL in background (non-blocking)
      executeIncrementalETL(etlName as string)
        .then((result) => {
          console.log('\n╔═══════════════════════════════════════════════════════════════╗');
          console.log('║  ✅ ETL BACKGROUND EXECUTION COMPLETADO                      ║');
          console.log('╚═══════════════════════════════════════════════════════════════╝');
          console.log(`📊 Registros procesados: ${result.recordsProcessed}`);
          console.log(`⏱️  Tiempo de ejecución: ${result.executionTimeMs}ms`);
          console.log(`📅 Watermark: ${result.watermarkDate}`);
          console.log('═══════════════════════════════════════════════════════════════\n');
        })
        .catch((error) => {
          console.error('\n╔═══════════════════════════════════════════════════════════════╗');
          console.error('║  ❌ ETL BACKGROUND EXECUTION ERROR                           ║');
          console.error('╚═══════════════════════════════════════════════════════════════╝');
          console.error('🔴 Error completo:', error);
          console.error('📝 Mensaje:', error.message);
          console.error('📚 Stack trace:', error.stack);
          console.error('═══════════════════════════════════════════════════════════════\n');
        });
      
      // Return immediately
      console.log('✅ Respuesta enviada al cliente: ETL iniciado en segundo plano\n');
      res.json({ 
        success: true, 
        message: 'ETL iniciado en segundo plano',
        isRunning: true
      });
    } catch (error: any) {
      console.error('\n❌ ETL EXECUTION ERROR (endpoint):', error);
      console.error('Stack:', error.stack);
      res.status(500).json({ 
        success: false,
        error: error.message 
      });
    }
  }));

  // ETL Progress Stream (Server-Sent Events) - Real-time progress updates
  app.get('/api/etl/progress', requireAdminOrSupervisor, (req: any, res: any) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    const progressListener = (event: any) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    etlProgressEmitter.on('progress', progressListener);

    // Cleanup on client disconnect
    req.on('close', () => {
      etlProgressEmitter.off('progress', progressListener);
      res.end();
    });
  });

  // Get ETL status and history
  app.get('/api/etl/status', requireAdminOrSupervisor, asyncHandler(async (req: any, res: any) => {
    try {
      const { etlName = 'ventas_incremental', startDate, endDate } = req.query;
      const status = await getETLStatus(
        etlName as string, 
        startDate as string | undefined, 
        endDate as string | undefined
      );
      res.json(status);
    } catch (error: any) {
      res.status(500).json({ 
        error: error.message 
      });
    }
  }));

  // Cancel a running ETL process (admin/supervisor only)
  app.post('/api/etl/cancel', requireAdminOrSupervisor, asyncHandler(async (req: any, res: any) => {
    try {
      const { etlName = 'ventas_incremental' } = req.query;
      console.log(`🚫 ETL cancellation requested by: ${req.user.email} for ETL: ${etlName}`);
      
      // Find the currently running ETL execution
      const runningExecution = await storage.getRunningETLExecution(etlName as string);
      
      if (!runningExecution) {
        return res.status(404).json({ 
          success: false,
          message: 'No hay ningún proceso ETL en ejecución para cancelar' 
        });
      }
      
      // Mark the execution as cancelled
      await storage.cancelETLExecution(runningExecution.id, req.user.email);
      
      console.log(`✅ ETL ${etlName} cancelled successfully by ${req.user.email}`);
      
      res.json({ 
        success: true,
        message: 'Proceso ETL cancelado exitosamente',
        executionId: runningExecution.id
      });
    } catch (error: any) {
      console.error('ETL cancellation error:', error);
      res.status(500).json({ 
        success: false,
        error: error.message 
      });
    }
  }));

  // Update ETL configuration (watermark, timeout, interval) - admin/supervisor only
  app.post('/api/etl/config', requireAdminOrSupervisor, asyncHandler(async (req: any, res: any) => {
    try {
      const { etlName = 'ventas_incremental' } = req.query;
      const { customWatermark, timeoutMinutes, intervalMinutes, keepCustomWatermark } = req.body;
      
      console.log('═══════════════════════════════════════════════════════');
      console.log(`⚙️  ETL config update requested`);
      console.log(`   User: ${req.user?.email || 'unknown'}`);
      console.log(`   ETL: ${etlName}`);
      console.log(`   Body received:`, JSON.stringify(req.body, null, 2));
      console.log(`   Watermark: ${customWatermark || 'no change'}`);
      console.log(`   Timeout: ${timeoutMinutes || 'no change'} minutes`);
      console.log(`   Interval: ${intervalMinutes || 'no change'} minutes`);
      console.log(`   Keep watermark: ${keepCustomWatermark !== undefined ? keepCustomWatermark : 'no change'}`);
      console.log('═══════════════════════════════════════════════════════');
      
      console.log('⏳ Calling updateETLConfig...');
      const config = await updateETLConfig(
        etlName as string,
        customWatermark ? new Date(customWatermark) : undefined,
        customWatermark ? true : false, // Activar watermark personalizado si se proporciona
        keepCustomWatermark,
        timeoutMinutes ? parseInt(timeoutMinutes) : undefined,
        intervalMinutes ? parseInt(intervalMinutes) : undefined
      );
      
      console.log('✅ ETL config updated successfully:', config);
      
      res.json({ 
        success: true,
        message: 'Configuración ETL actualizada exitosamente',
        config
      });
    } catch (error: any) {
      console.error('❌ ETL config update error (DETAILED):', {
        message: error.message,
        stack: error.stack,
        name: error.name,
        code: error.code,
        detail: error.detail
      });
      res.status(500).json({ 
        success: false,
        error: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }));

  // Production Diagnostics - Admin only, logs detailed info to server console
  app.post('/api/etl/diagnostics', requireRoles(['admin']), asyncHandler(async (req: any, res: any) => {
    try {
      console.log('\n╔═══════════════════════════════════════════════════════════════╗');
      console.log('║  🔍 DIAGNÓSTICO DE PRODUCCIÓN - ETL SCHEMA VENTAS            ║');
      console.log('╚═══════════════════════════════════════════════════════════════╝\n');
      
      const diagnosticResults: any = {
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'unknown',
        checks: []
      };

      // 1. Check database connection
      console.log('1️⃣  Verificando conexión a base de datos...');
      try {
        await db.execute(sql`SELECT 1 as test`);
        diagnosticResults.checks.push({ name: 'database_connection', status: 'OK' });
        console.log('   ✅ Conexión OK\n');
      } catch (err: any) {
        diagnosticResults.checks.push({ name: 'database_connection', status: 'ERROR', error: err.message });
        console.error('   ❌ Error de conexión:', err.message, '\n');
      }

      // 2. Check current user and search_path
      console.log('2️⃣  Verificando usuario actual y search_path...');
      try {
        const userResult = await db.execute(sql`SELECT current_user, current_database(), current_schema()`);
        const searchPathResult = await db.execute(sql`SHOW search_path`);
        
        console.log('   Usuario actual:', userResult.rows[0]);
        console.log('   Search path:', searchPathResult.rows[0]);
        
        diagnosticResults.checks.push({ 
          name: 'user_and_search_path', 
          status: 'OK',
          searchPath: searchPathResult.rows[0]?.search_path
        });
        console.log('   ✅ Usuario y search_path obtenidos\n');
      } catch (err: any) {
        diagnosticResults.checks.push({ name: 'user_and_search_path', status: 'ERROR', error: err.message });
        console.error('   ❌ Error:', err.message, '\n');
      }

      // 3. List all schemas
      console.log('3️⃣  Listando schemas disponibles...');
      try {
        const schemasResult = await db.execute(sql`
          SELECT schema_name 
          FROM information_schema.schemata 
          ORDER BY schema_name
        `);
        
        console.log('   Schemas encontrados:');
        schemasResult.rows.forEach((row: any) => {
          console.log(`     - ${row.schema_name}`);
        });
        
        const hasVentasSchema = schemasResult.rows.some((row: any) => row.schema_name === 'ventas');
        diagnosticResults.checks.push({ 
          name: 'schemas_list', 
          status: 'OK',
          hasVentasSchema,
          totalSchemas: schemasResult.rows.length
        });
        console.log(`   ✅ Total schemas: ${schemasResult.rows.length}, Schema 'ventas': ${hasVentasSchema ? 'SÍ' : 'NO'}\n`);
      } catch (err: any) {
        diagnosticResults.checks.push({ name: 'schemas_list', status: 'ERROR', error: err.message });
        console.error('   ❌ Error:', err.message, '\n');
      }

      // 4. Check if ventas schema tables exist
      console.log('4️⃣  Verificando tablas en schema "ventas"...');
      try {
        const tablesResult = await db.execute(sql`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = 'ventas'
          ORDER BY table_name
        `);
        
        console.log('   Tablas en schema "ventas":');
        tablesResult.rows.forEach((row: any) => {
          console.log(`     - ${row.table_name}`);
        });
        
        const expectedTables = ['stg_maeedo', 'stg_maeddo', 'fact_ventas', 'etl_config', 'etl_execution_log'];
        const foundTables = tablesResult.rows.map((row: any) => row.table_name);
        const missingTables = expectedTables.filter(t => !foundTables.includes(t));
        
        diagnosticResults.checks.push({ 
          name: 'ventas_schema_tables', 
          status: missingTables.length === 0 ? 'OK' : 'INCOMPLETE',
          totalTables: foundTables.length,
          missingTables: missingTables.length > 0 ? missingTables : undefined
        });
        
        if (missingTables.length > 0) {
          console.log(`   ⚠️  Tablas faltantes: ${missingTables.join(', ')}`);
        }
        console.log(`   ✅ Total tablas en "ventas": ${foundTables.length}\n`);
      } catch (err: any) {
        diagnosticResults.checks.push({ name: 'ventas_schema_tables', status: 'ERROR', error: err.message });
        console.error('   ❌ Error:', err.message, '\n');
      }

      // 5. Try to access fact_ventas with full schema qualification
      console.log('5️⃣  Intentando acceso a ventas.fact_ventas...');
      try {
        const countResult = await db.execute(sql`SELECT COUNT(*) as count FROM ventas.fact_ventas`);
        const count = countResult.rows[0]?.count;
        
        diagnosticResults.checks.push({ 
          name: 'fact_ventas_access_qualified', 
          status: 'OK',
          recordCount: parseInt(count)
        });
        console.log(`   ✅ Acceso exitoso. Registros: ${count}\n`);
      } catch (err: any) {
        diagnosticResults.checks.push({ 
          name: 'fact_ventas_access_qualified', 
          status: 'ERROR', 
          error: err.message,
          errorCode: err.code
        });
        console.error('   ❌ Error accediendo con schema calificado:', err.message);
        console.error('   Código de error:', err.code, '\n');
      }

      // 6. Try to access fact_ventas WITHOUT schema qualification
      console.log('6️⃣  Intentando acceso a fact_ventas SIN schema calificado...');
      try {
        const countResult = await db.execute(sql`SELECT COUNT(*) as count FROM fact_ventas`);
        const count = countResult.rows[0]?.count;
        
        diagnosticResults.checks.push({ 
          name: 'fact_ventas_access_unqualified', 
          status: 'OK',
          recordCount: parseInt(count)
        });
        console.log(`   ✅ Acceso exitoso. Registros: ${count}\n`);
      } catch (err: any) {
        diagnosticResults.checks.push({ 
          name: 'fact_ventas_access_unqualified', 
          status: 'ERROR', 
          error: err.message,
          errorCode: err.code
        });
        console.error('   ❌ Error accediendo SIN schema calificado:', err.message);
        console.error('   Código de error:', err.code, '\n');
      }

      // 7. Check etl_config table
      console.log('7️⃣  Verificando tabla ventas.etl_config...');
      try {
        const configResult = await db.execute(sql`
          SELECT etl_name, custom_watermark, use_custom_watermark, timeout_minutes 
          FROM ventas.etl_config 
          WHERE etl_name = 'ventas_incremental'
        `);
        
        if (configResult.rows.length > 0) {
          console.log('   Configuración actual:', configResult.rows[0]);
          diagnosticResults.checks.push({ 
            name: 'etl_config_access', 
            status: 'OK',
            hasConfig: true
          });
        } else {
          console.log('   ⚠️  No existe configuración para ventas_incremental');
          diagnosticResults.checks.push({ 
            name: 'etl_config_access', 
            status: 'OK',
            hasConfig: false
          });
        }
        console.log('   ✅ Tabla etl_config accesible\n');
      } catch (err: any) {
        diagnosticResults.checks.push({ 
          name: 'etl_config_access', 
          status: 'ERROR', 
          error: err.message 
        });
        console.error('   ❌ Error:', err.message, '\n');
      }

      // 8. Check user permissions on ventas schema
      console.log('8️⃣  Verificando permisos en schema "ventas"...');
      try {
        const permsResult = await db.execute(sql`
          SELECT 
            has_schema_privilege(current_user, 'ventas', 'USAGE') as has_usage,
            has_schema_privilege(current_user, 'ventas', 'CREATE') as has_create
        `);
        
        console.log('   Permisos del usuario actual:');
        console.log('     - USAGE en schema "ventas":', permsResult.rows[0]?.has_usage);
        console.log('     - CREATE en schema "ventas":', permsResult.rows[0]?.has_create);
        
        diagnosticResults.checks.push({ 
          name: 'ventas_schema_permissions', 
          status: 'OK',
          hasUsage: permsResult.rows[0]?.has_usage,
          hasCreate: permsResult.rows[0]?.has_create
        });
        console.log('   ✅ Permisos verificados\n');
      } catch (err: any) {
        diagnosticResults.checks.push({ 
          name: 'ventas_schema_permissions', 
          status: 'ERROR', 
          error: err.message 
        });
        console.error('   ❌ Error:', err.message, '\n');
      }

      // 9. Test Drizzle ORM access to factVentas
      console.log('9️⃣  Probando acceso vía Drizzle ORM a factVentas...');
      try {
        const drizzleResult = await db
          .select({ count: sql<number>`count(*)` })
          .from(factVentas)
          .limit(1);
        
        diagnosticResults.checks.push({ 
          name: 'drizzle_fact_ventas_access', 
          status: 'OK',
          recordCount: drizzleResult[0]?.count
        });
        console.log(`   ✅ Drizzle ORM funciona. Registros: ${drizzleResult[0]?.count}\n`);
      } catch (err: any) {
        diagnosticResults.checks.push({ 
          name: 'drizzle_fact_ventas_access', 
          status: 'ERROR', 
          error: err.message,
          errorCode: err.code
        });
        console.error('   ❌ Error con Drizzle ORM:', err.message);
        console.error('   Código de error:', err.code, '\n');
      }

      // 10. Environment checks (NO sensitive data)
      console.log('🔟 Verificando variables de entorno críticas...');
      const envChecks = {
        hasDatabaseUrl: !!process.env.DATABASE_URL,
        hasNodeEnv: !!process.env.NODE_ENV,
        nodeEnv: process.env.NODE_ENV
      };
      console.log('   Variables:', envChecks);
      diagnosticResults.checks.push({ 
        name: 'environment_variables', 
        status: 'OK',
        ...envChecks
      });
      console.log('   ✅ Variables verificadas\n');

      // Summary
      const errorCount = diagnosticResults.checks.filter((c: any) => c.status === 'ERROR').length;
      const warningCount = diagnosticResults.checks.filter((c: any) => c.status === 'INCOMPLETE').length;
      
      console.log('╔═══════════════════════════════════════════════════════════════╗');
      console.log('║  📊 RESUMEN DEL DIAGNÓSTICO                                  ║');
      console.log('╚═══════════════════════════════════════════════════════════════╝');
      console.log(`Total verificaciones: ${diagnosticResults.checks.length}`);
      console.log(`✅ Exitosas: ${diagnosticResults.checks.length - errorCount - warningCount}`);
      console.log(`⚠️  Advertencias: ${warningCount}`);
      console.log(`❌ Errores: ${errorCount}`);
      console.log('═══════════════════════════════════════════════════════════════\n');

      // Return sanitized summary (no sensitive data)
      const response = {
        success: true,
        message: 'Diagnóstico completado',
        summary: {
          timestamp: diagnosticResults.timestamp,
          environment: diagnosticResults.environment,
          totalChecks: diagnosticResults.checks.length,
          successful: diagnosticResults.checks.length - errorCount - warningCount,
          warnings: warningCount,
          errors: errorCount,
          criticalIssues: diagnosticResults.checks
            .filter((c: any) => c.status === 'ERROR')
            .map((c: any) => c.name)
        },
        checks: diagnosticResults.checks.map((check: any) => ({
          name: check.name,
          success: check.status === 'OK',
          details: check.status === 'OK' 
            ? `✅ ${check.name.replace(/_/g, ' ')}`
            : check.status === 'INCOMPLETE'
            ? `⚠️ ${check.name.replace(/_/g, ' ')} - Incompleto`
            : `❌ ${check.name.replace(/_/g, ' ')}`,
          error: check.error || undefined
        }))
      };
      
      console.log('[DIAGNOSTIC RESPONSE] Enviando respuesta al cliente:', JSON.stringify(response, null, 2));
      res.json(response);

    } catch (error: any) {
      console.error('❌ Error fatal en diagnóstico:', error);
      res.status(500).json({ 
        success: false,
        error: 'Error ejecutando diagnóstico. Ver logs del servidor.' 
      });
    }
  }));

  // Run ETL migrations - Admin only, creates missing tables in ventas schema
  app.post('/api/etl/run-migrations', requireRoles(['admin']), asyncHandler(async (req: any, res: any) => {
    try {
      console.log('\n╔═══════════════════════════════════════════════════════════════╗');
      console.log('║  🔧 EJECUTANDO MIGRACIONES ETL - SCHEMA VENTAS               ║');
      console.log('╚═══════════════════════════════════════════════════════════════╝\n');
      
      const migrationsExecuted: string[] = [];
      const errors: string[] = [];

      // 1. Ensure ventas schema exists
      console.log('1️⃣  Verificando/creando schema "ventas"...');
      try {
        await db.execute(sql`CREATE SCHEMA IF NOT EXISTS ventas`);
        migrationsExecuted.push('Schema "ventas" verificado/creado');
        console.log('   ✅ Schema "ventas" OK\n');
      } catch (err: any) {
        errors.push(`Error creando schema: ${err.message}`);
        console.error('   ❌ Error:', err.message, '\n');
      }

      // 2. Create etl_config table
      console.log('2️⃣  Creando tabla ventas.etl_config...');
      try {
        await db.execute(sql`
          CREATE TABLE IF NOT EXISTS ventas.etl_config (
            id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
            etl_name VARCHAR(100) NOT NULL UNIQUE,
            custom_watermark TIMESTAMP,
            use_custom_watermark BOOLEAN NOT NULL DEFAULT false,
            keep_custom_watermark BOOLEAN NOT NULL DEFAULT false,
            timeout_minutes INTEGER NOT NULL DEFAULT 10,
            interval_minutes INTEGER NOT NULL DEFAULT 15,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
          )
        `);
        migrationsExecuted.push('Tabla ventas.etl_config creada');
        console.log('   ✅ Tabla etl_config creada\n');
      } catch (err: any) {
        errors.push(`Error creando etl_config: ${err.message}`);
        console.error('   ❌ Error:', err.message, '\n');
      }

      // 3. Create etl_execution_log table
      console.log('3️⃣  Creando/actualizando tabla ventas.etl_execution_log...');
      try {
        // First create the table if it doesn't exist
        await db.execute(sql`
          CREATE TABLE IF NOT EXISTS ventas.etl_execution_log (
            id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
            etl_name VARCHAR(100) NOT NULL DEFAULT 'ventas_incremental',
            execution_date TIMESTAMP NOT NULL DEFAULT NOW(),
            status VARCHAR(20) NOT NULL,
            period VARCHAR(100) NOT NULL,
            document_types TEXT NOT NULL,
            branches TEXT NOT NULL,
            records_processed INTEGER,
            execution_time_ms BIGINT,
            error_message TEXT,
            watermark_date TIMESTAMP
          )
        `);

        // Then add missing columns if table already existed with old schema
        const columnsToAdd = [
          'etl_name VARCHAR(100) DEFAULT \'ventas_incremental\'',
          'execution_date TIMESTAMP DEFAULT NOW()',
          'status VARCHAR(20)',
          'period VARCHAR(100)',
          'document_types TEXT',
          'branches TEXT',
          'records_processed INTEGER',
          'execution_time_ms BIGINT',
          'error_message TEXT',
          'watermark_date TIMESTAMP'
        ];

        let columnsAdded = 0;
        for (const column of columnsToAdd) {
          const columnName = column.split(' ')[0];
          try {
            await db.execute(sql.raw(`
              ALTER TABLE ventas.etl_execution_log 
              ADD COLUMN IF NOT EXISTS ${column}
            `));
            columnsAdded++;
          } catch (colErr: any) {
            // Column might already exist, that's OK
            if (!colErr.message.includes('already exists')) {
              console.error(`   ⚠️  Error agregando columna ${columnName}:`, colErr.message);
            }
          }
        }

        // Update column types to ensure they're large enough
        console.log('   📏 Actualizando tamaños de columnas...');
        const columnTypeUpdates = [
          'ALTER TABLE ventas.etl_execution_log ALTER COLUMN etl_name TYPE VARCHAR(100)',
          'ALTER TABLE ventas.etl_execution_log ALTER COLUMN status TYPE VARCHAR(20)',
          'ALTER TABLE ventas.etl_execution_log ALTER COLUMN period TYPE VARCHAR(100)',
          'ALTER TABLE ventas.etl_execution_log ALTER COLUMN execution_time_ms TYPE BIGINT'
        ];

        for (const alterQuery of columnTypeUpdates) {
          try {
            await db.execute(sql.raw(alterQuery));
          } catch (alterErr: any) {
            // Ignore errors if column doesn't exist yet
            if (!alterErr.message.includes('does not exist')) {
              console.error(`   ⚠️  Error actualizando tipo de columna:`, alterErr.message);
            }
          }
        }

        migrationsExecuted.push(`Tabla ventas.etl_execution_log actualizada (${columnsAdded} columnas verificadas/agregadas, tamaños actualizados)`);
        console.log(`   ✅ Tabla etl_execution_log actualizada (${columnsAdded} columnas, tamaños corregidos)\n`);
      } catch (err: any) {
        errors.push(`Error creando/actualizando etl_execution_log: ${err.message}`);
        console.error('   ❌ Error:', err.message, '\n');
      }

      // 4. Ensure fact_ventas exists with base structure, then add missing columns
      console.log('4️⃣  Verificando/completando estructura de ventas.fact_ventas...');
      try {
        // First, create table if not exists with minimal structure
        await db.execute(sql`
          CREATE TABLE IF NOT EXISTS ventas.fact_ventas (
            idmaeddo NUMERIC(20,0) PRIMARY KEY,
            idmaeedo NUMERIC(20,0),
            CONSTRAINT unique_idmaeedo_idmaeddo UNIQUE (idmaeedo, idmaeddo)
          )
        `);
        console.log('   ✅ Tabla base verificada');
        
        // Add all required columns using ALTER TABLE (safe, preserves data)
        const columnsToAdd = [
          'tido TEXT',
          'nudo NUMERIC(20,0)',
          'endo TEXT',
          'suendo TEXT',
          'sudo NUMERIC(20,0)',
          'feemdo DATE',
          'feulvedo DATE',
          'esdo TEXT',
          'espgdo TEXT',
          'kofudo TEXT',
          'modo TEXT',
          'timodo TEXT',
          'tamodo TEXT',
          'caprad NUMERIC(18,5)',
          'caprex NUMERIC(18,5)',
          'vanedo NUMERIC(18,5)',
          'vaivdo NUMERIC(18,5)',
          'vabrdo NUMERIC(18,5)',
          'lilg TEXT',
          'nulido NUMERIC(20,0)',
          'sulido NUMERIC(20,0)',
          'luvtlido DATE',
          'bosulido TEXT',
          'kofulido TEXT',
          'prct TEXT',
          'tict TEXT',
          'tipr TEXT',
          'nusepr TEXT',
          'koprct TEXT',
          'udtrpr INTEGER',
          'rludpr NUMERIC(18,5)',
          'caprco1 NUMERIC(18,5)',
          'caprad1 NUMERIC(18,5)',
          'caprex1 NUMERIC(18,5)',
          'caprnc1 NUMERIC(18,5)',
          'ud01pr NUMERIC(18,5)',
          'caprco2 NUMERIC(18,5)',
          'caprad2 NUMERIC(18,5)',
          'caprex2 NUMERIC(18,5)',
          'caprnc2 NUMERIC(18,5)',
          'ud02pr NUMERIC(18,5)',
          'ppprne TEXT',
          'ppprbr TEXT',
          'vaneli NUMERIC(18,5)',
          'vabrli NUMERIC(18,5)',
          'feemli DATE',
          'feerli DATE',
          'ppprpm TEXT',
          'ppprpmifrs TEXT',
          'logistica TEXT',
          'eslido TEXT',
          'ppprnere1 TEXT',
          'ppprnere2 TEXT',
          'fmpr TEXT',
          'mrpr TEXT',
          'zona TEXT',
          'ruen TEXT',
          'recaprre TEXT',
          'pfpr TEXT',
          'hfpr TEXT',
          'monto NUMERIC(18,5)',
          'ocdo TEXT',
          'nokoprct TEXT',
          'nokozo TEXT',
          'nosudo TEXT',
          'nokofu TEXT',
          'nokofudo TEXT',
          'nobosuli TEXT',
          'nokoen TEXT',
          'noruen TEXT',
          'nomrpr TEXT',
          'nofmpr TEXT',
          'nopfpr TEXT',
          'nohfpr TEXT',
          'devol1 NUMERIC(18,5)',
          'devol2 NUMERIC(18,5)',
          'stockfis NUMERIC(18,5)',
          'listacost TEXT',
          'liscosmod TEXT',
          'last_etl_sync TIMESTAMP',
          'koen TEXT',
          'kofu TEXT',
        ];

        let columnsAdded = 0;
        for (const column of columnsToAdd) {
          const columnName = column.split(' ')[0];
          try {
            await db.execute(sql.raw(`
              ALTER TABLE ventas.fact_ventas 
              ADD COLUMN IF NOT EXISTS ${column}
            `));
            columnsAdded++;
          } catch (colErr: any) {
            // Column might already exist, that's OK
            if (!colErr.message.includes('already exists')) {
              console.error(`   ⚠️  Error agregando columna ${columnName}:`, colErr.message);
            }
          }
        }
        
        migrationsExecuted.push(`Tabla ventas.fact_ventas completada (${columnsAdded} columnas agregadas/verificadas)`);
        console.log(`   ✅ ${columnsAdded} columnas verificadas/agregadas\n`);
      } catch (err: any) {
        errors.push(`Error completando fact_ventas: ${err.message}`);
        console.error('   ❌ Error:', err.message, '\n');
      }

      // 5. Recreate staging tables with correct structure
      console.log('5️⃣  Recreando tablas staging con estructura correcta...');
      console.log('   ⚠️  Las tablas staging son temporales - se limpian en cada ETL');
      
      // Drop existing staging tables first
      const stagingTableNames = ['stg_maeedo', 'stg_maeddo', 'stg_maeen', 'stg_maepr', 'stg_tabbo', 'stg_tabpp', 'stg_tabru', 'stg_maeven', 'stg_tabfu'];
      
      for (const tableName of stagingTableNames) {
        try {
          await db.execute(sql.raw(`DROP TABLE IF EXISTS ventas.${tableName} CASCADE`));
          console.log(`   🗑️  Dropped ventas.${tableName}`);
        } catch (err: any) {
          console.error(`   ⚠️  Error dropping ${tableName}:`, err.message);
        }
      }

      // Create with correct structure using Drizzle schema
      // stg_maeedo
      try {
        await db.execute(sql`
          CREATE TABLE ventas.stg_maeedo (
            idmaeedo NUMERIC(20,0) PRIMARY KEY,
            empresa TEXT,
            tido TEXT,
            nudo TEXT,
            endo TEXT,
            suendo TEXT,
            endofi TEXT,
            tigedo TEXT,
            sudo TEXT,
            luvtdo TEXT,
            feemdo DATE,
            kofudo TEXT,
            esdo TEXT,
            espgdo TEXT,
            suli TEXT,
            bosulido TEXT,
            feer DATE,
            vanedo NUMERIC(18,4),
            vaivdo NUMERIC(18,4),
            vabrdo NUMERIC(18,4),
            lilg TEXT,
            modo TEXT,
            timodo TEXT,
            tamodo NUMERIC(18,4),
            ocdo TEXT
          )
        `);
        console.log(`   ✅ stg_maeedo creada`);
      } catch (err: any) {
        errors.push(`Error creando stg_maeedo: ${err.message}`);
        console.error(`   ❌ Error stg_maeedo:`, err.message);
      }

      // stg_maeddo
      try {
        await db.execute(sql`
          CREATE TABLE ventas.stg_maeddo (
            idmaeddo NUMERIC(20,0) PRIMARY KEY,
            idmaeedo NUMERIC(20,0) NOT NULL,
            koprct TEXT,
            nokopr TEXT,
            udtrpr TEXT,
            caprco NUMERIC(18,4),
            preuni NUMERIC(18,6),
            vaneli NUMERIC(18,4),
            feemli TIMESTAMP,
            feerli TIMESTAMP,
            devol1 NUMERIC(18,4),
            devol2 NUMERIC(18,4),
            stockfis NUMERIC(18,4)
          )
        `);
        console.log(`   ✅ stg_maeddo creada`);
      } catch (err: any) {
        errors.push(`Error creando stg_maeddo: ${err.message}`);
        console.error(`   ❌ Error stg_maeddo:`, err.message);
      }

      // stg_maeen
      try {
        await db.execute(sql`
          CREATE TABLE ventas.stg_maeen (
            koen TEXT PRIMARY KEY,
            nokoen TEXT,
            rut TEXT,
            ruen TEXT,
            zona TEXT,
            kofuen TEXT
          )
        `);
        console.log(`   ✅ stg_maeen creada`);
      } catch (err: any) {
        errors.push(`Error creando stg_maeen: ${err.message}`);
        console.error(`   ❌ Error stg_maeen:`, err.message);
      }

      // stg_maepr
      try {
        await db.execute(sql`
          CREATE TABLE ventas.stg_maepr (
            kopr TEXT PRIMARY KEY,
            nomrpr TEXT,
            ud01pr TEXT,
            ud02pr TEXT,
            nokoen TEXT,
            fmpr TEXT,
            pfpr TEXT,
            hfpr TEXT
          )
        `);
        console.log(`   ✅ stg_maepr creada`);
      } catch (err: any) {
        errors.push(`Error creando stg_maepr: ${err.message}`);
        console.error(`   ❌ Error stg_maepr:`, err.message);
      }

      // stg_tabbo, stg_tabpp, stg_tabru, stg_maeven, stg_tabfu
      const simpleStagingTables = [
        { name: 'stg_tabbo', sql: `CREATE TABLE ventas.stg_tabbo (kobo TEXT PRIMARY KEY, nokobo TEXT)` },
        { name: 'stg_tabpp', sql: `CREATE TABLE ventas.stg_tabpp (kopr TEXT PRIMARY KEY, nokopr TEXT, fmpr TEXT, pfpr TEXT, hfpr TEXT)` },
        { name: 'stg_tabru', sql: `CREATE TABLE ventas.stg_tabru (koru TEXT PRIMARY KEY, noruen TEXT)` },
        { name: 'stg_maeven', sql: `CREATE TABLE ventas.stg_maeven (kofu TEXT PRIMARY KEY, nokofu TEXT, kofupr TEXT, kofumay TEXT)` },
        { name: 'stg_tabfu', sql: `CREATE TABLE ventas.stg_tabfu (kofu TEXT PRIMARY KEY, nokofu TEXT)` },
      ];

      for (const table of simpleStagingTables) {
        try {
          await db.execute(sql.raw(table.sql));
          console.log(`   ✅ ${table.name} creada`);
        } catch (err: any) {
          errors.push(`Error creando ${table.name}: ${err.message}`);
          console.error(`   ❌ Error ${table.name}:`, err.message);
        }
      }
      
      migrationsExecuted.push('Tablas staging recreadas con estructura correcta');
      console.log('');

      // 6. Insert default ETL config if not exists
      console.log('6️⃣  Insertando configuración ETL por defecto...');
      try {
        await db.execute(sql`
          INSERT INTO ventas.etl_config (etl_name, custom_watermark, use_custom_watermark, timeout_minutes, interval_minutes)
          VALUES ('ventas_incremental', '2025-01-02 00:00:00', true, 3, 15)
          ON CONFLICT (etl_name) DO NOTHING
        `);
        migrationsExecuted.push('Configuración ETL por defecto insertada');
        console.log('   ✅ Configuración por defecto insertada\n');
      } catch (err: any) {
        errors.push(`Error insertando config por defecto: ${err.message}`);
        console.error('   ❌ Error:', err.message, '\n');
      }

      console.log('╔═══════════════════════════════════════════════════════════════╗');
      console.log('║  📊 RESUMEN DE MIGRACIONES                                   ║');
      console.log('╚═══════════════════════════════════════════════════════════════╝');
      console.log(`Total migraciones ejecutadas: ${migrationsExecuted.length}`);
      console.log(`Total errores: ${errors.length}`);
      console.log('═══════════════════════════════════════════════════════════════\n');

      res.json({
        success: errors.length === 0,
        message: errors.length === 0 
          ? 'Migraciones ejecutadas exitosamente' 
          : 'Migraciones completadas con algunos errores',
        migrations: migrationsExecuted,
        errors: errors.length > 0 ? errors : undefined
      });

    } catch (error: any) {
      console.error('❌ Error fatal en migraciones:', error);
      res.status(500).json({ 
        success: false,
        error: 'Error ejecutando migraciones. Ver logs del servidor.' 
      });
    }
  }));

  // ============================================================================================
  // PROYECCIONES DE VENTAS - Manual Forecasting System
  // ============================================================================================

  // Get historical sales data aggregated by year
  app.get('/api/proyecciones/historico', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      const { years, months, salespersonCode, segment, search, limit, offset, onlyWithAllPeriods, sortOrder } = req.query;
      
      const filters: any = {};
      
      if (years) {
        filters.years = years.split(',').map((y: string) => parseInt(y));
      }
      
      if (months) {
        filters.months = months.split(',').map((m: string) => parseInt(m));
      }

      if (search && typeof search === 'string') {
        filters.search = search;
      }

      if (limit) {
        filters.limit = parseInt(limit as string);
      }

      if (offset) {
        filters.offset = parseInt(offset as string);
      }

      if (onlyWithAllPeriods === 'true') {
        filters.onlyWithAllPeriods = true;
      }

      if (sortOrder && typeof sortOrder === 'string') {
        filters.sortOrder = sortOrder; // desc, asc, az, za
      }
      
      // Role-based filtering
      if (user.role === 'salesperson') {
        // Salespeople can only see their own historical data
        const salespersonUser = await storage.getSalespersonUser(user.id);
        const userSalespersonCode = salespersonUser?.salespersonName || user.salespersonName;
        
        if (!userSalespersonCode) {
          return res.status(403).json({ 
            message: "Tu cuenta no tiene un código de vendedor asignado. Contacta al administrador." 
          });
        }
        filters.salespersonCode = userSalespersonCode;
      } else if (user.role === 'supervisor') {
        // Supervisors can only see data from their segment
        if (!user.assignedSegment) {
          return res.status(403).json({ 
            message: "Tu cuenta no tiene un segmento asignado. Contacta al administrador." 
          });
        }
        filters.segment = user.assignedSegment;
      } else if (user.role === 'admin') {
        // Admins can filter by any salesperson or segment
        if (salespersonCode) {
          filters.salespersonCode = salespersonCode;
        }
        // Allow segment filter for display (does not affect save operations)
        if (segment && segment !== 'all') {
          filters.segment = segment;
        }
      }
      
      const data = await storage.getHistoricoVentasPorAnio(filters);
      res.json(data);
    } catch (error: any) {
      console.error('Error fetching historical sales:', error);
      res.status(500).json({ error: error.message });
    }
  }));

  // Get available years with sales data
  app.get('/api/proyecciones/years', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const years = await storage.getYearsWithData();
      res.json(years);
    } catch (error: any) {
      console.error('Error fetching years with data:', error);
      res.status(500).json({ error: error.message });
    }
  }));

  // Get salespeople list
  app.get('/api/proyecciones/salespeople', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      let salespeople = await storage.getSalespeopleList();
      
      // Filter salespeople by segment for supervisors
      if (user.role === 'supervisor' && user.assignedSegment) {
        // Get salespeople who have sales in the supervisor's segment
        const salespeopleInSegment = await storage.getSalespeopleBySegment(user.assignedSegment);
        const validCodes = new Set(salespeopleInSegment.map((s: any) => s.code));
        salespeople = salespeople.filter(sp => validCodes.has(sp.code));
      }
      
      res.json(salespeople);
    } catch (error: any) {
      console.error('Error fetching salespeople list:', error);
      res.status(500).json({ error: error.message });
    }
  }));

  // Get segments list
  app.get('/api/proyecciones/segments', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const segments = await storage.getSegmentsList();
      res.json(segments);
    } catch (error: any) {
      console.error('Error fetching segments list:', error);
      res.status(500).json({ error: error.message });
    }
  }));

  // Get manual projections
  app.get('/api/proyecciones/manual', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      const { years, months, salespersonCode, segment } = req.query;
      
      const filters: any = {};
      
      if (years) {
        filters.years = years.split(',').map((y: string) => parseInt(y));
      }
      
      if (months) {
        filters.months = months.split(',').map((m: string) => parseInt(m));
      }
      
      // Role-based filtering
      if (user.role === 'salesperson') {
        // Salespeople can only see their own projections
        // Check both salespeople_users table and regular users table with salespersonName
        const salespersonUser = await storage.getSalespersonUser(user.id);
        const userSalespersonCode = salespersonUser?.salespersonName || user.salespersonName;
        
        if (!userSalespersonCode) {
          return res.status(403).json({ 
            message: "Tu cuenta no tiene un código de vendedor asignado. Contacta al administrador." 
          });
        }
        filters.salespersonCode = userSalespersonCode;
      } else if (user.role === 'supervisor') {
        // Supervisors can only see projections from their segment
        if (!user.assignedSegment) {
          return res.status(403).json({ 
            message: "Tu cuenta no tiene un segmento asignado. Contacta al administrador." 
          });
        }
        filters.segment = user.assignedSegment;
      } else if (user.role === 'admin') {
        // Admins can filter by any salesperson or segment
        if (salespersonCode) {
          filters.salespersonCode = salespersonCode;
        }
        if (segment) {
          filters.segment = segment;
        }
      }
      
      const projections = await storage.getProyeccionesVentas(filters);
      res.json(projections);
    } catch (error: any) {
      console.error('Error fetching manual projections:', error);
      res.status(500).json({ error: error.message });
    }
  }));

  // Upsert (create or update) manual projection
  app.post('/api/proyecciones/manual', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      
      // Validate request body
      const validated = insertProyeccionVentaSchema.parse({
        ...req.body,
        createdBy: user.id,
        createdByName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
      });
      
      // Role-based authorization
      if (user.role === 'salesperson') {
        // Salespeople can only create/edit projections for themselves
        // Check both salespeople_users table and regular users table with salespersonName
        const salespersonUser = await storage.getSalespersonUser(user.id);
        const userSalespersonCode = salespersonUser?.salespersonName || user.salespersonName;
        
        if (!userSalespersonCode) {
          return res.status(403).json({ 
            message: "Tu usuario no tiene un código de vendedor asignado" 
          });
        }
        
        if (validated.salespersonCode !== userSalespersonCode) {
          return res.status(403).json({ 
            message: "No tienes permiso para crear proyecciones para otros vendedores" 
          });
        }
      } else if (user.role === 'supervisor') {
        // Supervisors can only create/edit projections for their segment
        if (validated.segment && validated.segment !== user.assignedSegment) {
          return res.status(403).json({ 
            message: "No tienes permiso para crear proyecciones fuera de tu segmento" 
          });
        }
      }
      // Admins can create/edit for anyone
      
      const proyeccion = await storage.upsertProyeccionVenta(validated);
      
      res.status(201).json(proyeccion);
    } catch (error: any) {
      console.error('Error upserting manual projection:', error);
      if (error.name === 'ZodError') {
        return res.status(400).json({
          message: "Datos inválidos",
          details: error.issues.map((issue: any) => `${issue.path.join('.')}: ${issue.message}`).join(', ')
        });
      }
      res.status(500).json({ error: error.message });
    }
  }));

  // Delete manual projection
  app.delete('/api/proyecciones/manual/:id', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      const { id } = req.params;
      
      // Get the projection to check permissions
      const projection = await storage.getProyeccionById(id);
      if (!projection) {
        return res.status(404).json({ message: "Proyección no encontrada" });
      }
      
      // Role-based authorization
      if (user.role === 'salesperson') {
        // Salespeople can only delete their own projections
        // Check both salespeople_users table and regular users table with salespersonName
        const salespersonUser = await storage.getSalespersonUser(user.id);
        const userSalespersonCode = salespersonUser?.salespersonName || user.salespersonName;
        
        if (!userSalespersonCode) {
          return res.status(403).json({ 
            message: "Tu usuario no tiene un código de vendedor asignado" 
          });
        }
        
        if (projection.salespersonCode !== userSalespersonCode) {
          return res.status(403).json({ 
            message: "No tienes permiso para eliminar proyecciones de otros vendedores" 
          });
        }
      } else if (user.role === 'supervisor') {
        // Supervisors can only delete projections from their segment
        if (projection.segment !== user.assignedSegment) {
          return res.status(403).json({ 
            message: "No tienes permiso para eliminar proyecciones fuera de tu segmento" 
          });
        }
      }
      // Admins can delete any projection
      
      await storage.deleteProyeccionVenta(id);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting manual projection:', error);
      res.status(500).json({ error: error.message });
    }
  }));

  // Get aggregated projection data for charts (Proyección Automática page)
  app.get('/api/proyecciones/charts', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      const { years, months, salespersonCode, segment } = req.query;
      
      const filters: any = {};
      
      if (years) {
        filters.years = years.split(',').map((y: string) => parseInt(y));
      }
      
      if (months) {
        filters.months = months.split(',').map((m: string) => parseInt(m));
      }
      
      // Role-based filtering (same as manual projections endpoint)
      if (user.role === 'salesperson') {
        const salespersonUser = await storage.getSalespersonUser(user.id);
        const userSalespersonCode = salespersonUser?.salespersonName || user.salespersonName;
        
        if (!userSalespersonCode) {
          return res.status(403).json({ 
            message: "Tu cuenta no tiene un código de vendedor asignado. Contacta al administrador." 
          });
        }
        filters.salespersonCode = userSalespersonCode;
      } else if (user.role === 'supervisor') {
        if (!user.assignedSegment) {
          return res.status(403).json({ 
            message: "Tu cuenta no tiene un segmento asignado. Contacta al administrador." 
          });
        }
        filters.segment = user.assignedSegment;
      } else if (user.role === 'admin') {
        if (salespersonCode) {
          filters.salespersonCode = salespersonCode;
        }
        if (segment) {
          filters.segment = segment;
        }
      }
      
      // Get all projections (segment and salesperson filters NOT applied in query to preserve save flows)
      const projections = await storage.getProyeccionesVentas({ years: filters.years, months: filters.months });
      
      // Filter projections: only future projections (month !== null)
      let futureProjections = projections.filter(p => p.month !== null);
      
      // Apply salesperson filter post-query (using contains match for flexibility)
      if (filters.salespersonCode) {
        futureProjections = futureProjections.filter(p => 
          p.salespersonCode && (
            p.salespersonCode === filters.salespersonCode ||
            filters.salespersonCode.includes(p.salespersonCode) ||
            p.salespersonCode.includes(filters.salespersonCode)
          )
        );
      }
      
      // Apply segment filter post-query (to avoid breaking save functionality)
      if (filters.segment) {
        futureProjections = futureProjections.filter(p => p.segment === filters.segment);
      }
      
      // Aggregate data for charts
      const clientData: Record<string, { clientName: string; segment: string; total: number; byMonth: Record<string, number> }> = {};
      const segmentData: Record<string, { total: number; byMonth: Record<string, number> }> = {};
      const salespersonData: Record<string, { total: number; byMonth: Record<string, number> }> = {};
      
      futureProjections.forEach(proj => {
        const amount = Number(proj.projectedAmount);
        const monthKey = `${proj.year}-${proj.month}`;
        
        // By client
        if (!clientData[proj.clientCode]) {
          clientData[proj.clientCode] = {
            clientName: proj.clientName || proj.clientCode,
            segment: proj.segment || 'Sin Segmento',
            total: 0,
            byMonth: {}
          };
        }
        clientData[proj.clientCode].total += amount;
        clientData[proj.clientCode].byMonth[monthKey] = (clientData[proj.clientCode].byMonth[monthKey] || 0) + amount;
        
        // By segment
        const segmentKey = proj.segment || 'Sin Segmento';
        if (!segmentData[segmentKey]) {
          segmentData[segmentKey] = { total: 0, byMonth: {} };
        }
        segmentData[segmentKey].total += amount;
        segmentData[segmentKey].byMonth[monthKey] = (segmentData[segmentKey].byMonth[monthKey] || 0) + amount;
        
        // By salesperson
        if (!salespersonData[proj.salespersonCode]) {
          salespersonData[proj.salespersonCode] = { total: 0, byMonth: {} };
        }
        salespersonData[proj.salespersonCode].total += amount;
        salespersonData[proj.salespersonCode].byMonth[monthKey] = (salespersonData[proj.salespersonCode].byMonth[monthKey] || 0) + amount;
      });
      
      res.json({
        byClient: Object.entries(clientData).map(([code, data]) => ({
          clientCode: code,
          clientName: data.clientName,
          segment: data.segment,
          total: data.total,
          byMonth: data.byMonth
        })).sort((a, b) => b.total - a.total),
        
        bySegment: Object.entries(segmentData).map(([segment, data]) => ({
          segment,
          total: data.total,
          byMonth: data.byMonth
        })).sort((a, b) => b.total - a.total),
        
        bySalesperson: Object.entries(salespersonData).map(([code, data]) => ({
          salespersonCode: code,
          total: data.total,
          byMonth: data.byMonth
        })).sort((a, b) => b.total - a.total)
      });
    } catch (error: any) {
      console.error('Error fetching chart data:', error);
      res.status(500).json({ error: error.message });
    }
  }));

  const httpServer = createServer(app);
  return httpServer;
}
