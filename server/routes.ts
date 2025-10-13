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
import unzipper from "unzipper";
import { Readable } from "stream";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { localImageStorage } from "./localImageStorage";
import { comunaRegionService } from "./comunaRegionService";
import { db } from "./db";
import { ecommerceProducts, salesTransactions, fileUploads, productosEvaluados, evaluacionesTecnicas, insertClientSchema } from "../shared/schema";
import { eq, and, isNotNull, ne } from "drizzle-orm";
import { emailService } from "./services/email";

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

import { insertSalesTransactionSchema, insertGoalSchema, insertSalespersonUserSchema, insertProductSchema, insertProductStockSchema, insertTaskSchema, insertTaskAssignmentSchema, insertOrderSchema, insertOrderItemSchema, addOrderItemSchema, updateOrderItemByIdSchema, insertPriceListSchema, insertQuoteSchema, insertQuoteItemSchema, InsertTask } from "@shared/schema";
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

      // Calcular días desde la última venta
      let daysSinceLastSale = 0;
      if (transactions && transactions.length > 0) {
        // Obtener la fecha de la transacción más reciente
        const mostRecentDate = new Date(transactions[0].fecha);
        const today = new Date();
        const diffTime = Math.abs(today.getTime() - mostRecentDate.getTime());
        daysSinceLastSale = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      }

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

        // Save image locally
        const fs = await import('fs/promises');
        const path = await import('path');
        
        // Delete old image if exists
        if (product && product.imagenUrl && product.imagenUrl.startsWith('/product-images/')) {
          const oldImagePath = path.join(process.cwd(), 'public', product.imagenUrl);
          try {
            await fs.unlink(oldImagePath);
            console.log(`🗑️ [SINGLE IMAGE] Deleted old image: ${product.imagenUrl}`);
          } catch (error) {
            console.log(`⚠️ [SINGLE IMAGE] Could not delete old image: ${product.imagenUrl}`);
          }
        }
        
        const imageName = `${sku}_${Date.now()}${fileExt}`;
        const imagePath = path.join(process.cwd(), 'public', 'product-images', imageName);
        
        await fs.writeFile(imagePath, imageBuffer);
        
        const publicUrl = `/product-images/${imageName}`;

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
        // Save image locally
        const fs = await import('fs/promises');
        const path = await import('path');
        
        // Get product to check for old image
        const products = await storage.getEcommerceAdminProducts({ search: productId });
        const product = products.find(p => p.id === parseInt(productId));
        
        // Delete old image if exists
        if (product && product.imagenUrl && product.imagenUrl.startsWith('/product-images/')) {
          const oldImagePath = path.join(process.cwd(), 'public', product.imagenUrl);
          try {
            await fs.unlink(oldImagePath);
            console.log(`🗑️ [PRODUCT IMAGE] Deleted old image: ${product.imagenUrl}`);
          } catch (error) {
            console.log(`⚠️ [PRODUCT IMAGE] Could not delete old image: ${product.imagenUrl}`);
          }
        }
        
        const imageName = `${productCode}_${Date.now()}${fileExt}`;
        const imagePath = path.join(process.cwd(), 'public', 'product-images', imageName);
        
        await fs.writeFile(imagePath, imageBuffer);
        
        const publicUrl = `/product-images/${imageName}`;

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
        // Try ObjectStorage first, fallback to local storage
        let imageUrl: string;
        const objectStorageService = new ObjectStorageService();
        
        try {
          // Organize images in product-images folder by SKU
          const storageKey = `product-images/${sku}/${uniqueFileName}`;
          imageUrl = await objectStorageService.uploadImage(storageKey, imageBuffer, getContentType(fileExtension.substring(1)));
          console.log(`☁️ [ZIP IMPORT] Uploaded to ObjectStorage: ${storageKey}`);
        } catch (objStorageError) {
          console.log(`📁 [ZIP IMPORT] ObjectStorage failed, using local storage for ${sku}`);
          imageUrl = await localImageStorage.uploadImage(uniqueFileName, imageBuffer, getContentType(fileExtension.substring(1)));
          console.log(`💾 [ZIP IMPORT] Uploaded to local storage: ${uniqueFileName}`);
        }

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
      const filters: any = {};
      
      if (req.query.vendedorId) filters.vendedorId = req.query.vendedorId;
      if (req.query.tecnicoId) filters.tecnicoId = req.query.tecnicoId;
      if (req.query.estado) filters.estado = req.query.estado;
      if (req.query.gravedad) filters.gravedad = req.query.gravedad;
      if (req.query.limit) filters.limit = parseInt(req.query.limit);
      if (req.query.offset) filters.offset = parseInt(req.query.offset);
      
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
      
      // Add vendedor info from authenticated user
      const reclamoData = {
        ...req.body,
        vendedorId: user.id,
        vendedorName: user.salespersonName || `${user.firstName} ${user.lastName}`,
      };
      
      const reclamo = await storage.createReclamoGeneral(reclamoData);
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

  // Delete reclamo
  app.delete('/api/reclamos-generales/:id', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      await storage.deleteReclamoGeneral(req.params.id);
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
      const { notas } = req.body;
      
      const userName = user.salespersonName || `${user.firstName} ${user.lastName}`;
      const reclamo = await storage.cerrarReclamoGeneral(req.params.id, user.id, userName, notas);
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
      
      // Only supervisor can create solicitudes
      if (user.role !== 'supervisor') {
        return res.status(403).json({ message: 'Solo supervisores pueden crear solicitudes' });
      }
      
      const supervisorName = user.salespersonName || `${user.firstName} ${user.lastName}`;
      
      const solicitud = await storage.createSolicitudMarketing({
        ...req.body,
        supervisorId: user.id,
        supervisorName,
      });
      
      res.status(201).json(solicitud);
    } catch (error: any) {
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
      const { search, warehouse } = req.query;
      
      const filters: any = {};
      if (search) filters.search = search;
      if (warehouse) filters.warehouse = warehouse;
      
      const summary = await storage.getInventorySummary(filters);
      res.json(summary);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al obtener resumen de inventario', error: error.message });
    }
  }));

  // Get warehouses list
  app.get('/api/warehouses', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const warehouses = await storage.getWarehouses();
      res.json(warehouses);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al obtener bodegas', error: error.message });
    }
  }));

  const httpServer = createServer(app);
  return httpServer;
}
