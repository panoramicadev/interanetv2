import type { Express } from "express";
import { createServer, type Server } from "http";
import path from "path";
import fs from "fs";
import { storage } from "./storage";
import { setupAuth, requireAuth, requireAdminOrSupervisor, requireCommercialAccess, requirePlantOperationsAccess, requireRoles, requireCMMSFullAccess, requireCMMSMaintenance, requireCMMSPlantStaff } from "./auth";
// import { setupAuth as setupReplitAuth } from "./replitAuth"; // Disabled - conflicts with email/password auth
import multer from "multer";
import Papa from "papaparse";
import { nanoid } from "nanoid";
import { checkDbHealth } from "./db";
import JSZip from "jszip";
import unzipper from "unzipper";
import { Readable } from "stream";
import * as XLSX from "xlsx";
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
  insertFundAllocationSchema,
  insertFundRecurringConfigSchema,
  fundMovements,
  insertPromesaCompraSchema,
  insertHitoMarketingSchema,
  nvvPendingSales,
  factVentas,
  gastosEmpresariales,
  // CMMS tables
  mantencionesPlanificadas,
  solicitudesMantencion,
  // CMMS validation schemas
  insertEquipoCriticoSchema,
  insertProveedorMantencionSchema,
  insertPresupuestoMantencionSchema,
  insertGastoMaterialMantencionSchema,
  insertPlanPreventivoSchema,
  // Email notification settings
  emailNotificationSettings,
  emailLogs,
  smtpConfig,
  // Presupuesto de ventas
  presupuestoVentas,
  bulkPresupuestoVentasSchema,
  // AI Chat
  chatMessages,
  aiKnowledgeBase,
  // Marketing
  gastosMarketing,
} from "../shared/schema";
import { eq, and, isNotNull, isNull, ne, sql, desc, or, sum, countDistinct } from "drizzle-orm";
import { emailService } from "./services/email";
import { executeIncrementalETL, getETLStatus, updateETLConfig, etlProgressEmitter, sqlServerBreaker } from "./etl-incremental";
import { executeGDVETL, gdvEtlProgressEmitter, gdvSqlServerBreaker } from "./etl-gdv";
import { executeNVVETL, nvvEtlProgressEmitter, nvvSqlServerBreaker, getNVVProgressHistory } from "./etl-nvv";
import * as NotifyHelper from "./notifications-helper";
import { format } from "date-fns";
import { wrapEmailContent } from "./email-templates";
import { getAuthUrl, handleCallback, getValidAccessToken, disconnectGmail, isOAuthConfigured, validateStateToken, sendEmailWithOAuth, testConnection, getConnectionStatus } from "./gmail-oauth";
import { convertPdfToImage, isPdfFile } from "./pdf-to-image";
import sharp from "sharp";
import { processAgentMessage, type AiUserContext, type AiMessage } from "./ai-agent";
import { randomUUID } from "crypto";

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
import { registerLogRoutes } from './routes-logs';

// Middleware to ensure salespeople can only access their own data
// Must be used after requireAuth middleware
function requireOwnDataOrAdmin(req: any, res: any, next: any) {
  const user = req.user;

  if (!user) {
    return res.status(401).json({ message: "No autenticado" });
  }

  // Allow admins, supervisors, and jefe_planta to access all data
  if (user.role === 'admin' || user.role === 'supervisor' || user.role === 'jefe_planta') {
    return next();
  }

  // Validate salespersonName parameter exists
  const requestedSalesperson = req.params.salespersonName;
  if (!requestedSalesperson) {
    return res.status(400).json({ message: "Nombre de vendedor requerido" });
  }

  // Normalize function: decode URI, trim, lowercase
  const normalize = (str: string): string => {
    try {
      return decodeURIComponent(str).trim().toLowerCase();
    } catch {
      return str.trim().toLowerCase();
    }
  };

  // For salespeople, validate they're only accessing their own data
  if (user.role === 'salesperson') {
    const userSalespersonName = user.salespersonName || `${user.firstName || ''} ${user.lastName || ''}`.trim();
    const normalizedRequested = normalize(requestedSalesperson);
    const normalizedUser = normalize(userSalespersonName);

    if (normalizedRequested !== normalizedUser) {
      return res.status(403).json({
        message: "No tienes permiso para acceder a datos de otros vendedores"
      });
    }

    return next();
  }

  // All other roles (marketing, client, tecnico_obra, etc.) are denied
  return res.status(403).json({
    message: "No tienes permiso para acceder a esta información"
  });
}

export function registerRoutes(app: Express): Server {
  // Setup email/password auth system (primary)
  setupAuth(app);

  // Register log routes (admin only)
  registerLogRoutes(app, requireRoles);

  // Note: Replit OIDC auth disabled to avoid conflicts - using email/password auth only

  // Mount external API routes (with API key auth)
  app.use('/api/external', externalApiRouter);

  // Image normalization endpoint - applies EXIF rotation for PDF generation
  // Security: Requires authentication and validates URLs against allowed domains
  app.get('/api/image-normalized', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const imageUrl = req.query.url as string;

      if (!imageUrl) {
        return res.status(400).json({ message: 'URL de imagen requerida' });
      }

      // Security: Validate URL to prevent SSRF attacks
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(imageUrl);
      } catch {
        return res.status(400).json({ message: 'URL inválida' });
      }

      // Only allow HTTPS and HTTP protocols
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        return res.status(400).json({ message: 'Protocolo no permitido' });
      }

      // Block localhost and private IP ranges
      const hostname = parsedUrl.hostname.toLowerCase();
      const blockedPatterns = [
        'localhost', '127.0.0.1', '0.0.0.0', '::1',
        /^10\.\d+\.\d+\.\d+$/, /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/, /^192\.168\.\d+\.\d+$/,
        /^169\.254\.\d+\.\d+$/, // Link-local
        'metadata.google.internal', '169.254.169.254' // Cloud metadata endpoints
      ];

      for (const pattern of blockedPatterns) {
        if (typeof pattern === 'string' && hostname === pattern) {
          return res.status(403).json({ message: 'URL no permitida' });
        }
        if (pattern instanceof RegExp && pattern.test(hostname)) {
          return res.status(403).json({ message: 'URL no permitida' });
        }
      }

      // Allowed domains for image sources (Object Storage, CDN, Replit)
      const allowedDomains = [
        'storage.googleapis.com',
        'storage.cloud.google.com',
        'objectstorage.replit.dev',
        'replit.dev',
        'replit.app',
        'repl.co',
        process.env.REPLIT_DEV_DOMAIN || '',
        process.env.REPL_SLUG ? `${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co` : ''
      ].filter(Boolean);

      const isAllowedDomain = allowedDomains.some(domain =>
        hostname === domain || hostname.endsWith(`.${domain}`)
      );

      if (!isAllowedDomain) {
        console.warn(`[IMAGE-NORM] Blocked request to non-allowed domain: ${hostname}. Allowed: ${allowedDomains.join(', ')}`);
        return res.status(403).json({ message: 'Dominio de imagen no permitido' });
      }

      // Fetch the image from the URL
      const response = await fetch(imageUrl);
      if (!response.ok) {
        return res.status(404).json({ message: 'Imagen no encontrada' });
      }

      // Validate content-type is an image
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.startsWith('image/')) {
        return res.status(400).json({ message: 'El recurso no es una imagen' });
      }

      // Limit file size (max 20MB)
      const contentLength = response.headers.get('content-length');
      if (contentLength && parseInt(contentLength) > 20 * 1024 * 1024) {
        return res.status(413).json({ message: 'Imagen demasiado grande' });
      }

      const arrayBuffer = await response.arrayBuffer();
      const inputBuffer = Buffer.from(arrayBuffer);

      // Use Sharp to auto-rotate based on EXIF orientation and strip metadata
      // .rotate() without parameters reads EXIF orientation and applies it
      const normalizedBuffer = await sharp(inputBuffer)
        .rotate() // Auto-rotate based on EXIF
        .withMetadata({ orientation: undefined }) // Remove orientation metadata after rotation
        .toBuffer();

      // Set appropriate headers
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
      res.send(normalizedBuffer);
    } catch (error) {
      console.error('Error normalizing image:', error);
      res.status(500).json({
        message: 'Error al procesar la imagen',
        error: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  }));

  // Configure multer for file uploads
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
  });

  // Generic file upload endpoint for authenticated users
  app.post('/api/upload', requireAuth, upload.single('file'), asyncHandler(async (req: any, res: any) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No se ha subido ningún archivo' });
      }

      const file = req.file;
      const timestamp = Date.now();
      const randomId = nanoid(8);
      const fileExtension = path.extname(file.originalname);
      const fileName = `upload-${timestamp}-${randomId}${fileExtension}`;

      let fileUrl: string;
      let previewUrl: string | null = null;

      // Try cloud storage first, fall back to local disk
      if (process.env.PUBLIC_OBJECT_SEARCH_PATHS) {
        const objectStorageService = new ObjectStorageService();
        fileUrl = await objectStorageService.uploadImage(fileName, file.buffer, file.mimetype);
        console.log(`☁️ [UPLOAD] File uploaded to cloud: ${fileName} -> ${fileUrl}`);

        if (isPdfFile(file.mimetype, file.originalname)) {
          try {
            const previewBuffer = await convertPdfToImage(file.buffer, 600);
            if (previewBuffer) {
              const previewFileName = `upload-${timestamp}-${randomId}-preview.png`;
              previewUrl = await objectStorageService.uploadImage(previewFileName, previewBuffer, 'image/png');
            }
          } catch (previewError) {
            console.warn('⚠️ [UPLOAD] Failed to generate PDF preview:', previewError);
          }
        }
      } else {
        // Local file storage fallback
        const uploadsDir = path.join(process.cwd(), 'server', 'uploads');
        const fs = await import('fs');
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }
        const filePath = path.join(uploadsDir, fileName);
        fs.writeFileSync(filePath, file.buffer);
        fileUrl = `/api/uploads/${fileName}`;
        console.log(`💾 [UPLOAD] File saved locally: ${fileName} -> ${fileUrl}`);
      }

      res.json({ url: fileUrl, previewUrl });
    } catch (error: any) {
      console.error('Error uploading file:', error);
      res.status(500).json({ message: 'Error al subir archivo', error: error.message });
    }
  }));

  // Serve locally uploaded files
  app.get('/api/uploads/:filename', (req: any, res: any) => {
    const filename = req.params.filename;
    const uploadsDir = path.resolve(process.cwd(), 'server', 'uploads');
    const filePath = path.join(uploadsDir, filename);

    console.log(`📂 [GET-UPLOAD] Requesting: ${filename}`);
    console.log(`📂 [GET-UPLOAD] Full path: ${filePath}`);

    if (fs.existsSync(filePath)) {
      // Set proper Content-Type based on file extension
      const ext = path.extname(filename).toLowerCase();
      const contentTypes: Record<string, string> = {
        '.pdf': 'application/pdf',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.doc': 'application/msword',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.xls': 'application/vnd.ms-excel',
        '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      };

      const contentType = contentTypes[ext] || 'application/octet-stream';
      res.setHeader('Content-Type', contentType);

      // Check if download is requested via query param, otherwise inline for preview
      const wantsDownload = req.query.download === 'true';
      if (wantsDownload) {
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      } else {
        res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
      }

      res.sendFile(filePath);
    } else {
      console.warn(`❌ [GET-UPLOAD] File NOT found: ${filePath}`);
      res.status(404).json({
        message: 'Archivo no encontrado en el servidor',
        filename,
        path: filePath
      });
    }
  });

  // Fast readiness check - responds immediately for Cloud Run health checks
  app.get('/api/ready', (req: any, res: any) => {
    res.status(200).json({ status: 'ready', timestamp: new Date().toISOString() });
  });

  // Health check endpoint - Production monitoring
  app.get('/api/health', asyncHandler(async (req: any, res: any) => {
    const dbHealth = await checkDbHealth();

    // Get last ETL execution
    let lastETL: any = null;
    let etlHealthy = true;
    let etlWarnings: string[] = [];

    try {
      const lastExecutions = await db
        .select()
        .from(sql`ventas.etl_execution_log`)
        .orderBy(desc(sql`start_time`))
        .limit(1);

      if (lastExecutions.length > 0) {
        const last = lastExecutions[0] as any;
        lastETL = {
          status: last.status,
          executionDate: last.start_time,
          recordsProcessed: last.records_processed,
          executionTimeMs: last.execution_time_ms,
          period: last.period
        };

        // Check if last ETL failed
        if (last.status === 'failed') {
          etlHealthy = false;
          etlWarnings.push('Última ejecución ETL falló');
        }

        // Check if last execution was too long ago (>45 min = problema con scheduler)
        const timeSinceLastETL = Date.now() - new Date(last.start_time).getTime();
        const minutesSince = timeSinceLastETL / (1000 * 60);
        if (minutesSince > 45) {
          etlHealthy = false;
          etlWarnings.push(`Última ejecución hace ${Math.round(minutesSince)} minutos (esperado: cada 30 min)`);
        }
      } else {
        etlWarnings.push('No hay historial de ejecuciones ETL');
      }
    } catch (error: any) {
      console.error('[HEALTH] Error checking ETL status:', error.message);
      etlWarnings.push('Error verificando estado ETL');
      etlHealthy = false;
    }

    // Get circuit breaker stats
    const breakerStats = sqlServerBreaker.getStats();
    const breakerHealthy = breakerStats.state !== 'OPEN';

    // Data quality check - critical fields
    let dataQualityHealthy = true;
    let dataQualityWarnings: string[] = [];

    try {
      const qualityCheck = await db.execute(sql`
        SELECT 
          COUNT(*) as total_records,
          SUM(CASE WHEN nokoen IS NULL THEN 1 ELSE 0 END) as null_clients,
          SUM(CASE WHEN nokofu IS NULL THEN 1 ELSE 0 END) as null_salespeople,
          SUM(CASE WHEN noruen IS NULL THEN 1 ELSE 0 END) as null_segments
        FROM ventas.fact_ventas
        WHERE last_etl_sync >= NOW() - INTERVAL '24 hours'
      `);

      const quality = qualityCheck.rows[0] as any;
      const totalRecent = Number(quality.total_records);

      if (totalRecent > 0) {
        const nullClientsPercent = (Number(quality.null_clients) / totalRecent) * 100;
        const nullSalesPercent = (Number(quality.null_salespeople) / totalRecent) * 100;
        const nullSegmentsPercent = (Number(quality.null_segments) / totalRecent) * 100;

        if (nullClientsPercent > 10) {
          dataQualityWarnings.push(`${nullClientsPercent.toFixed(1)}% clientes NULL`);
          dataQualityHealthy = false;
        }
        if (nullSalesPercent > 10) {
          dataQualityWarnings.push(`${nullSalesPercent.toFixed(1)}% vendedores NULL`);
          dataQualityHealthy = false;
        }
        if (nullSegmentsPercent > 10) {
          dataQualityWarnings.push(`${nullSegmentsPercent.toFixed(1)}% segmentos NULL`);
          dataQualityHealthy = false;
        }
      }
    } catch (error: any) {
      console.error('[HEALTH] Error checking data quality:', error.message);
      dataQualityWarnings.push('Error verificando calidad de datos');
    }

    // Overall system health - only DB connectivity is critical for health check
    const systemHealthy = dbHealth.connected;
    const allServicesHealthy = dbHealth.connected && etlHealthy && breakerHealthy && dataQualityHealthy;
    const systemStatus = allServicesHealthy ? 'healthy' : (systemHealthy ? 'degraded' : 'unhealthy');

    const health = {
      status: systemStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: {
        connected: dbHealth.connected,
        connectionAttempts: dbHealth.attempts,
        lastError: dbHealth.lastError
      },
      etl: {
        healthy: etlHealthy,
        lastExecution: lastETL,
        warnings: etlWarnings
      },
      sqlServer: {
        circuitBreaker: {
          state: breakerStats.state,
          healthy: breakerHealthy,
          failures: breakerStats.failures,
          successes: breakerStats.successes,
          nextAttemptTime: breakerStats.nextAttemptTime > 0
            ? new Date(breakerStats.nextAttemptTime).toISOString()
            : null
        }
      },
      dataQuality: {
        healthy: dataQualityHealthy,
        warnings: dataQualityWarnings
      }
    };

    // Only return 503 if database is completely unreachable
    // ETL/circuit breaker/data quality issues are reported but don't fail the health check
    res.status(systemHealthy ? 200 : 503).json(health);
  }));

  // Sales metrics endpoint
  app.get('/api/sales/metrics', requireCommercialAccess, async (req, res) => {
    try {
      const { startDate, endDate, salesperson, segment, client, supplier, period, filterType, product } = req.query;

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

      // Validate that we have valid dates before proceeding
      if (!currentStartDate || !currentEndDate) {
        return res.status(400).json({ message: "Missing required date parameters" });
      }

      // Calculate previous year dates - exactly same period but one year before (year-over-year comparison)
      // IMPORTANT: Parse date strings by splitting components to avoid timezone shifting.
      // new Date('YYYY-MM-DD') parses as UTC midnight, which in Chile (UTC-3) becomes the previous day.
      const parseDateSafe = (dateStr: string): Date => {
        const [y, m, d] = dateStr.split('-').map(Number);
        return new Date(y, m - 1, d); // local time, no UTC shift
      };
      const currentStart = parseDateSafe(currentStartDate);
      const currentEnd = parseDateSafe(currentEndDate);

      // Validate that dates are valid
      if (isNaN(currentStart.getTime()) || isNaN(currentEnd.getTime())) {
        return res.status(400).json({ message: "Invalid date format" });
      }

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
        product: product as string,
      });

      // Get previous year metrics for comparison (same period in previous year - year-over-year)
      const previousMetrics = await storage.getSalesMetrics({
        startDate: previousStartFormatted,
        endDate: previousEndFormatted,
        salesperson: salesperson as string,
        segment: segment as string,
        client: client as string,
        supplier: supplier as string,
        product: product as string,
      });

      console.log(`[DEBUG] Métricas actuales: Ventas=${metrics.totalSales}, Transacciones=${metrics.totalTransactions}`);
      console.log(`[DEBUG] Métricas año anterior: Ventas=${previousMetrics.totalSales}, Transacciones=${previousMetrics.totalTransactions}`);

      const commonFilters = {
        salesperson: salesperson as string,
        segment: segment as string,
        client: client as string,
      };

      const [newClients, previousNewClients] = await Promise.all([
        storage.getNewClientsCount({
          startDate: currentStartDate,
          endDate: currentEndDate,
          ...commonFilters,
        }),
        storage.getNewClientsCount({
          startDate: previousStartFormatted,
          endDate: previousEndFormatted,
          ...commonFilters,
        }),
      ]);

      const metricsWithComparison = {
        ...metrics,
        newClients,
        previousMonthSales: previousMetrics.totalTransactions > 0 ? previousMetrics.totalSales : undefined,
        previousMonthTransactions: previousMetrics.totalTransactions > 0 ? previousMetrics.totalTransactions : undefined,
        previousMonthOrders: previousMetrics.totalOrders > 0 ? previousMetrics.totalOrders : undefined,
        previousMonthUnits: previousMetrics.totalTransactions > 0 ? previousMetrics.totalUnits : undefined,
        previousMonthCustomers: previousMetrics.totalTransactions > 0 ? previousMetrics.activeCustomers : undefined,
        previousMonthGdvSales: previousMetrics.totalTransactions > 0 ? previousMetrics.gdvSales : undefined,
        previousNewClients,
      };

      console.log(`[DEBUG] Datos enviados al frontend:`, JSON.stringify(metricsWithComparison, null, 2));

      res.json(metricsWithComparison);
    } catch (error) {
      console.error("Error fetching sales metrics:", error);
      res.status(500).json({ message: "Failed to fetch sales metrics" });
    }
  });

  app.get('/api/sales/new-clients', requireCommercialAccess, async (req, res) => {
    try {
      const { period, filterType, salesperson, segment, client } = req.query;
      const dateRange = getDateRange(period as string, filterType as string);
      const startDate = dateRange.startDate;
      const endDate = dateRange.endDate;

      if (!startDate || !endDate) {
        return res.status(400).json({ message: "Missing required date parameters" });
      }

      const newClients = await storage.getNewClientsList({
        startDate,
        endDate,
        salesperson: salesperson as string,
        segment: segment as string,
        client: client as string,
      });

      res.json(newClients);
    } catch (error) {
      console.error("Error fetching new clients list:", error);
      res.status(500).json({ message: "Failed to fetch new clients list" });
    }
  });

  // Available periods endpoint - returns months and years with actual data
  app.get('/api/sales/available-periods', requireCommercialAccess, async (req, res) => {
    try {
      const periods = await storage.getAvailablePeriods();
      res.json(periods);
    } catch (error) {
      console.error("Error fetching available periods:", error);
      res.status(500).json({ message: "Failed to fetch available periods" });
    }
  });

  // Yearly totals endpoint - returns current and previous year totals
  // When current year has minimal data (early in year), shows previous year as main reference
  app.get('/api/sales/yearly-totals', requireCommercialAccess, async (req, res) => {
    try {
      const { segment, salesperson, client, endDateStr } = req.query;

      let currentYear = new Date().getFullYear();
      if (typeof endDateStr === 'string' && endDateStr.match(/^\d{4}/)) {
        currentYear = parseInt(endDateStr.substring(0, 4), 10);
      }

      const filters = {
        segment: segment as string,
        salesperson: salesperson as string,
        client: client as string,
      };

      // First get current year totals
      const currentTotals = await storage.getYearlyTotals(currentYear, filters, endDateStr as string);
      console.log(`[getYearlyTotals API] Req endDateStr: ${endDateStr}, Year: ${currentYear}, Totals: `, currentTotals);

      // If we're in the first days of a new year and current year has very little data,
      // return previous year as the main reference for better UX
      // ONLY apply this if no specific historical period was requested (endDateStr represents an interactive filter)
      const isEarlyInYear = !endDateStr && new Date().getMonth() === 0 && new Date().getDate() <= 15; // First 15 days of January
      const hasMinimalCurrentData = Math.abs(currentTotals.currentYearTotal) < 1000000; // Less than 1M in sales

      if (isEarlyInYear && hasMinimalCurrentData) {
        // Get previous year as main reference
        const previousYearTotals = await storage.getYearlyTotals(currentYear - 1, filters, endDateStr as string);
        res.json({
          ...previousYearTotals,
          note: `Mostrando ${currentYear - 1} como referencia principal (${currentYear} recién inicia)`
        });
      } else {
        res.json(currentTotals);
      }
    } catch (error) {
      console.error("Error fetching yearly totals:", error);
      res.status(500).json({ message: "Failed to fetch yearly totals" });
    }
  });

  // Best year historical endpoint - returns the best year and its total
  app.get('/api/sales/best-year', requireCommercialAccess, async (req, res) => {
    try {
      const { segment, salesperson, client } = req.query;
      const bestYear = await storage.getBestYearHistorical({
        segment: segment as string,
        salesperson: salesperson as string,
        client: client as string,
      });
      res.json(bestYear);
    } catch (error) {
      console.error("Error fetching best year:", error);
      res.status(500).json({ message: "Failed to fetch best year" });
    }
  });

  // Search clients from sales transactions (finds ALL clients including those not in dim_clientes)
  app.get('/api/sales/clients-search', requireAuth, async (req, res) => {
    try {
      const { search, limit = '500' } = req.query;
      if (!search || (search as string).length < 1) {
        return res.json({ clients: [] });
      }

      // Search unique clients from fact_ventas
      const searchPattern = `%${search}%`;
      const results = await db
        .selectDistinct({
          nokoen: factVentas.nokoen,
          koen: factVentas.nokoen, // Use nokoen as ID since koen might be empty
        })
        .from(factVentas)
        .where(sql`${factVentas.nokoen} ILIKE ${searchPattern}`)
        .limit(parseInt(limit as string));

      const clients = results.map(r => ({
        id: r.koen || r.nokoen,
        koen: r.koen || r.nokoen,
        nokoen: r.nokoen,
        rten: '',
      }));

      res.json({ clients });
    } catch (error) {
      console.error("Error searching clients from sales:", error);
      res.status(500).json({ message: "Failed to search clients" });
    }
  });

  // GDV Pending global endpoint - returns all pending GDV (no date filters)
  // Returns GDV where esdo IS NULL or esdo != 'C' (open/pending deliveries)
  app.get('/api/sales/gdv-pending', requireCommercialAccess, async (req, res) => {
    try {
      const { salesperson, segment, client } = req.query;

      const metrics = await storage.getGdvPendingGlobal({
        salesperson: salesperson as string,
        segment: segment as string,
        client: client as string,
      });

      res.json(metrics);
    } catch (error) {
      console.error("Error fetching GDV pending:", error);
      res.status(500).json({ message: "Failed to fetch GDV pending" });
    }
  });

  // Vendedor-specific metrics endpoint
  app.get('/api/sales/metrics/salesperson/:salespersonName', requireAuth, requireOwnDataOrAdmin, async (req, res) => {
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
  app.get('/api/sales/clients/salesperson/:salespersonName', requireAuth, requireOwnDataOrAdmin, async (req, res) => {
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
  app.get('/api/sales/chart-data/salesperson/:salespersonName', requireAuth, requireOwnDataOrAdmin, async (req, res) => {
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
  app.get('/api/goals/salesperson/:salespersonName', requireAuth, requireOwnDataOrAdmin, async (req, res) => {
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
  app.get('/api/alerts/salesperson/:salespersonName', requireAuth, requireOwnDataOrAdmin, async (req, res) => {
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
  app.get('/api/salesperson/:salespersonId/dashboard', requireCommercialAccess, async (req, res) => {
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
  app.get('/api/salesperson/:salespersonId/clients', requireCommercialAccess, async (req, res) => {
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
  app.get('/api/salesperson/:salespersonId/goals', requireCommercialAccess, async (req, res) => {
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
      const { search, segment, salesperson, creditStatus, businessType, debtStatus, entityType, salesPeriod, limit, offset } = req.query;

      const filters = {
        search: search as string,
        segment: segment as string,
        salesperson: salesperson as string,
        creditStatus: creditStatus as string,
        businessType: businessType as string,
        debtStatus: debtStatus as string,
        entityType: entityType as string,
        salesPeriod: salesPeriod as string,
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

  // Check if RUT exists in clients database
  app.get('/api/clients/check-rut', requireAuth, async (req, res) => {
    try {
      const { rut } = req.query;

      if (!rut || typeof rut !== 'string') {
        return res.status(400).json({ message: 'RUT es requerido' });
      }

      // Clean the RUT for comparison (remove dots, dashes, and spaces)
      const cleanRut = rut.replace(/[\.\-\s]/g, '').trim().toUpperCase();

      // Search for client with this RUT using the original format
      const clients = await storage.getClients({ search: rut.trim(), limit: 50 });

      // Check if any client has this exact RUT (normalized comparison)
      const exists = clients.some((client: any) => {
        if (!client.rten) return false;
        // Normalize client RUT the same way
        const clientRut = client.rten.replace(/[\.\-\s]/g, '').trim().toUpperCase();
        return clientRut === cleanRut;
      });

      res.json({ exists, rut: rut.trim() });
    } catch (error) {
      console.error('Error checking RUT:', error);
      res.status(500).json({ message: 'Error al verificar RUT' });
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

  // Client search endpoint (AJAX autocomplete) - MUST be before /:koen route
  app.get('/api/clients/search', requireAuth, async (req, res) => {
    try {
      const { q, period, filterType, segment, salesperson } = req.query;

      console.log('[CLIENT SEARCH] Query params:', { q, period, filterType, segment, salesperson });

      if (!q || typeof q !== 'string' || q.trim().length < 2) {
        console.log('[CLIENT SEARCH] Returning empty array - query too short');
        return res.json([]);
      }

      const searchTerm = q.trim();

      // Determine if we're searching with sales filters or just basic client directory
      const hasSalesFilters = period || filterType || segment || salesperson;

      console.log('[CLIENT SEARCH] Has sales filters?', hasSalesFilters);

      if (!hasSalesFilters) {
        // Simple client directory lookup (for obras, autocomplete without filters, etc.)
        console.log('[CLIENT SEARCH] Using searchClientsByName for term:', searchTerm);
        const results = await storage.searchClientsByName(searchTerm);
        console.log('[CLIENT SEARCH] Results from searchClientsByName:', results.length);
        return res.json(results);
      }

      // Search with sales filters (for analytics, dashboards, etc.)
      console.log('[CLIENT SEARCH] Using searchClients with filters');
      let startDate, endDate;
      if (period && filterType) {
        const dateRange = getDateRange(period as string, filterType as string);
        startDate = dateRange.startDate;
        endDate = dateRange.endDate;
      }

      const results = await storage.searchClients(
        searchTerm.toLowerCase(),
        startDate,
        endDate,
        salesperson as string,
        segment as string
      );

      console.log('[CLIENT SEARCH] Results from searchClients:', results.length);
      res.json(results);
    } catch (error) {
      console.error("[CLIENT SEARCH] Error searching clients:", error);
      res.status(500).json({ message: "Failed to search clients" });
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
          console.log(`📈 Analysis progress: ${i}/${csvData.length} (${((i / csvData.length) * 100).toFixed(1)}%)`);
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
    'foen', 'email', 'kofuen', 'lcen', 'contab', 'ruen', 'cobrador', 'bloqueado', 'actien',
    'cpen', 'fevecren', 'feultr', 'koplcr', 'habilita'
  ]);

  // Numeric fields that require strict validation 
  const numericClientFields = new Set([
    'idmaeen', 'crsd', 'crch', 'crlt', 'crpa', 'crto', 'cren', 'nuvecr', 'dccr', 'incr',
    'popicr', 'porprefen', 'diacobra', 'dimoper', 'imptoret', 'podetrac', 'proteacum',
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
  app.get('/api/sales/transactions', requireCommercialAccess, async (req, res) => {
    try {
      const { startDate, endDate, salesperson, segment, limit, offset, period, filterType, client, product } = req.query;
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
        client: client as string,
        product: product as string,
      });
      res.json(transactions);
    } catch (error) {
      console.error("Error fetching sales transactions:", error);
      res.status(500).json({ message: "Failed to fetch sales transactions" });
    }
  });

  // Top salespeople endpoint
  app.get('/api/sales/top-salespeople', requireCommercialAccess, async (req, res) => {
    try {
      const { limit, period, filterType, segment, client, product } = req.query;
      const dateRange = getDateRange(period as string, filterType as string);

      const result = await storage.getTopSalespeople(
        limit ? parseInt(limit as string) : undefined,
        dateRange.startDate,
        dateRange.endDate,
        segment as string, // Filtrar por segmento específico
        client as string, // Filtrar por cliente específico
        product as string // Filtrar por producto específico
      );
      res.json(result);
    } catch (error) {
      console.error("Error fetching top salespeople:", error);
      res.status(500).json({ message: "Failed to fetch top salespeople" });
    }
  });

  // Salespeople search endpoint (AJAX autocomplete)
  app.get('/api/salespeople/search', requireCommercialAccess, async (req, res) => {
    try {
      const { q, period, filterType, segment, client, product } = req.query;

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

      const results = await storage.searchSalespeople(
        searchTerm,
        startDate,
        endDate,
        segment as string,
        client as string,
        product as string
      );

      res.json(results);
    } catch (error) {
      console.error("Error searching salespeople:", error);
      res.status(500).json({ message: "Failed to search salespeople" });
    }
  });

  // Salesperson clients search endpoint (AJAX autocomplete)
  app.get('/api/salespeople/:salespersonName/clients/search', requireAuth, requireOwnDataOrAdmin, async (req, res) => {
    try {
      const { salespersonName } = req.params;
      const { q, period, filterType, segment } = req.query;

      if (!q || typeof q !== 'string' || q.trim().length < 2) {
        return res.json([]);
      }

      const searchTerm = q.trim();

      const results = await storage.searchSalespersonClients(
        salespersonName,
        searchTerm,
        period as string,
        filterType as string,
        segment as string
      );

      res.json(results);
    } catch (error) {
      console.error("Error searching salesperson clients:", error);
      res.status(500).json({ message: "Failed to search salesperson clients" });
    }
  });

  // Get salesperson client details endpoint (for accordion expansion)
  app.get('/api/salespeople/:salespersonName/clients/:clientName/details', requireAuth, requireOwnDataOrAdmin, async (req, res) => {
    try {
      const { salespersonName, clientName } = req.params;
      const { period, filterType } = req.query;

      if (!period || !filterType) {
        return res.status(400).json({ message: "Period and filterType are required" });
      }

      const details = await storage.getSalespersonClientDetails(
        decodeURIComponent(salespersonName),
        decodeURIComponent(clientName),
        period as string,
        filterType as string
      );

      res.json(details);
    } catch (error) {
      console.error("Error fetching salesperson client details:", error);
      res.status(500).json({ message: "Failed to fetch salesperson client details" });
    }
  });

  // Salesperson products search endpoint (AJAX autocomplete)
  app.get('/api/salespeople/:salespersonName/products/search', requireAuth, requireOwnDataOrAdmin, async (req, res) => {
    try {
      const { salespersonName } = req.params;
      const { q, period, filterType, segment } = req.query;

      if (!q || typeof q !== 'string' || q.trim().length < 2) {
        return res.json([]);
      }

      const searchTerm = q.trim();

      const results = await storage.searchSalespersonProducts(
        salespersonName,
        searchTerm,
        period as string,
        filterType as string,
        segment as string
      );

      res.json(results);
    } catch (error) {
      console.error("Error searching salesperson products:", error);
      res.status(500).json({ message: "Failed to search salesperson products" });
    }
  });

  // Get salesperson product details endpoint (for accordion expansion)
  app.get('/api/salespeople/:salespersonName/products/:productName/details', requireAuth, requireOwnDataOrAdmin, async (req, res) => {
    try {
      const { salespersonName, productName } = req.params;
      const { period, filterType } = req.query;

      console.log('[Product Details] Request:', { salespersonName, productName, period, filterType });

      if (!period || !filterType) {
        return res.status(400).json({ message: "Period and filterType are required" });
      }

      const details = await storage.getSalespersonProductDetails(
        decodeURIComponent(salespersonName),
        decodeURIComponent(productName),
        period as string,
        filterType as string
      );

      console.log('[Product Details] Response:', details);
      res.json(details);
    } catch (error) {
      console.error("[Product Details] Error fetching salesperson product details:", error);
      res.status(500).json({ message: "Failed to fetch salesperson product details" });
    }
  });

  // Get salesperson recent transactions endpoint
  app.get('/api/salespeople/:salespersonName/transactions/recent', requireAuth, requireOwnDataOrAdmin, async (req, res) => {
    try {
      const { salespersonName } = req.params;
      const { limit } = req.query;

      console.log('[Recent Transactions] Request:', { salespersonName, limit });

      const transactions = await storage.getSalespersonRecentTransactions(
        decodeURIComponent(salespersonName),
        limit ? parseInt(limit as string) : 10
      );

      console.log(`[Recent Transactions] Returning ${transactions.length} transactions`);
      res.json(transactions);
    } catch (error) {
      console.error("[Recent Transactions] Error fetching recent transactions:", error);
      res.status(500).json({ message: "Failed to fetch recent transactions" });
    }
  });

  // Top products endpoint
  app.get('/api/sales/top-products', requireCommercialAccess, async (req, res) => {
    try {
      const { limit, period, filterType, salesperson, segment, client } = req.query;
      const dateRange = getDateRange(period as string, filterType as string);

      const result = await storage.getTopProducts(
        limit ? parseInt(limit as string) : undefined,
        dateRange.startDate,
        dateRange.endDate,
        salesperson as string, // Filtrar por vendedor específico
        segment as string, // Filtrar por segmento específico
        client as string // Filtrar por cliente específico
      );
      res.json(result);
    } catch (error) {
      console.error("Error fetching top products:", error);
      res.status(500).json({ message: "Failed to fetch top products" });
    }
  });

  // Product details endpoint
  app.get('/api/sales/top-products/:productName/details', requireCommercialAccess, async (req, res) => {
    try {
      const { productName } = req.params;
      const { period, filterType, salesperson, segment } = req.query;
      const dateRange = getDateRange(period as string, filterType as string);

      const result = await storage.getProductDetails(
        decodeURIComponent(productName),
        dateRange.startDate,
        dateRange.endDate,
        salesperson as string,
        segment as string
      );

      if (!result) {
        return res.status(404).json({ message: "Product not found or has no sales data" });
      }

      res.json(result);
    } catch (error) {
      console.error("Error fetching product details:", error);
      res.status(500).json({ message: "Failed to fetch product details" });
    }
  });

  // Salesperson details endpoint
  app.get('/api/sales/top-salespeople/:salesperson/details', requireCommercialAccess, async (req, res) => {
    try {
      const { salesperson } = req.params;
      const { period, filterType, segment } = req.query;
      const dateRange = getDateRange(period as string, filterType as string);

      const result = await storage.getSalespersonDetails(
        decodeURIComponent(salesperson),
        dateRange.startDate,
        dateRange.endDate,
        segment as string
      );

      if (!result) {
        return res.status(404).json({ message: "Salesperson not found or has no sales data" });
      }

      res.json(result);
    } catch (error) {
      console.error("Error fetching salesperson details:", error);
      res.status(500).json({ message: "Failed to fetch salesperson details" });
    }
  });

  // Top clients endpoint
  app.get('/api/sales/top-clients', requireCommercialAccess, async (req, res) => {
    try {
      const { limit, period, filterType, salesperson, segment, product } = req.query;
      const dateRange = getDateRange(period as string, filterType as string);

      const result = await storage.getTopClients(
        limit ? parseInt(limit as string) : undefined,
        dateRange.startDate,
        dateRange.endDate,
        salesperson as string, // Filtrar por vendedor específico
        segment as string, // Filtrar por segmento específico
        product as string // Filtrar por producto específico
      );
      res.json(result);
    } catch (error) {
      console.error("Error fetching top clients:", error);
      res.status(500).json({ message: "Failed to fetch top clients" });
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

  // Search products grouped by parent name (strips format/color variants)
  app.get('/api/products/search-parent', requireAuth, async (req, res) => {
    try {
      const { q, period, filterType } = req.query;

      if (!q || typeof q !== 'string' || q.trim().length < 2) {
        return res.json([]);
      }

      const searchTerm = q.trim().toLowerCase();

      let startDate, endDate;
      if (period && filterType) {
        const dateRange = getDateRange(period as string, filterType as string);
        startDate = dateRange.startDate;
        endDate = dateRange.endDate;
      }

      const results = await storage.searchParentProducts(searchTerm, startDate, endDate);
      res.json(results);
    } catch (error) {
      console.error("Error searching parent products:", error);
      res.status(500).json({ message: "Failed to search parent products" });
    }
  });

  // Get parent product variants with format/color breakdown
  app.get('/api/sales/product-parent/:parentName/variants', requireCommercialAccess, asyncHandler(async (req: any, res: any) => {
    const { parentName } = req.params;
    const { period, filterType } = req.query;
    const dateRange = getDateRange(period as string, filterType as string);

    const variants = await storage.getParentProductVariants(decodeURIComponent(parentName), {
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
    });
    res.json(variants);
  }));

  // Segment analysis endpoint
  app.get('/api/sales/segments', requireCommercialAccess, async (req, res) => {
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
  app.get('/api/sales/segments-by-clients', requireCommercialAccess, async (req, res) => {
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
  app.get('/api/sales/packaging-metrics', requireCommercialAccess, asyncHandler(async (req: any, res: any) => {
    const { period, filterType, salesperson, segment, branch, client } = req.query;
    const dateRange = getDateRange(period as string, filterType as string);

    const packagingMetrics = await storage.getPackagingMetrics({
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      salesperson: salesperson as string,
      segment: segment as string,
      branch: branch as string,
      client: client as string,
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
  app.get('/api/sales/comunas', requireCommercialAccess, async (req, res) => {
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
  app.get('/api/sales/chart-data', requireCommercialAccess, async (req, res) => {
    try {
      const { period = 'monthly', selectedPeriod, filterType, salesperson, segment, client, product } = req.query;

      // Si tenemos selectedPeriod y filterType, usamos esos para el filtro de fecha
      const dateRange = selectedPeriod && filterType
        ? getDateRange(selectedPeriod as string, filterType as string)
        : { startDate: undefined, endDate: undefined };

      console.log('[CHART-DATA DEBUG] Request params:', { period, selectedPeriod, filterType, salesperson, segment, client, product });
      console.log('[CHART-DATA DEBUG] Date range calculated:', dateRange);

      let chartData = await storage.getSalesChartData(
        period as 'weekly' | 'monthly' | 'daily',
        dateRange.startDate,
        dateRange.endDate,
        salesperson as string, // Filtrar por vendedor específico
        segment as string, // Filtrar por segmento específico
        client as string, // Filtrar por cliente específico
        product as string // Filtrar por producto específico
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
  app.get('/api/sales/product/:productName/details', requireCommercialAccess, asyncHandler(async (req: any, res: any) => {
    const { productName } = req.params;
    const { period, filterType } = req.query;
    const dateRange = getDateRange(period as string, filterType as string);

    const details = await storage.getProductDetails(productName, {
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
    });
    res.json(details);
  }));

  app.get('/api/sales/product/:productName/formats', requireCommercialAccess, asyncHandler(async (req: any, res: any) => {
    const { productName } = req.params;
    const { period, filterType } = req.query;
    const dateRange = getDateRange(period as string, filterType as string);

    const formats = await storage.getProductFormats(productName, {
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
    });
    res.json(formats);
  }));

  app.get('/api/sales/product/:productName/colors', requireCommercialAccess, asyncHandler(async (req: any, res: any) => {
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

  // Segment client recurrence - new vs recurring clients
  app.get("/api/sales/segment/:segmentName/client-recurrence", requireAuth, async (req, res) => {
    try {
      const { segmentName } = req.params;
      const { period, filterType = "month" } = req.query;

      const recurrence = await storage.getSegmentClientRecurrence(segmentName, period as string, filterType as string);
      res.json(recurrence);
    } catch (error) {
      console.error("Error fetching segment client recurrence:", error);
      res.status(500).json({ message: "Failed to fetch segment client recurrence" });
    }
  });

  // Segment-scoped top salespeople (alias to /api/sales/top-salespeople with segment filter)
  app.get("/api/segments/:segment/top-salespeople", requireAuth, async (req, res) => {
    try {
      const { segment } = req.params;
      const { limit, period, filterType } = req.query;
      const dateRange = getDateRange(period as string, filterType as string);

      const result = await storage.getTopSalespeople(
        limit ? parseInt(limit as string) : undefined,
        dateRange.startDate,
        dateRange.endDate,
        decodeURIComponent(segment)
      );
      res.json(result);
    } catch (error) {
      console.error("Error fetching segment top salespeople:", error);
      res.status(500).json({ message: "Failed to fetch segment top salespeople" });
    }
  });

  // Segment-scoped salesperson search
  app.get("/api/segments/:segment/top-salespeople/search", requireAuth, async (req, res) => {
    try {
      const { segment } = req.params;
      const { q, period, filterType } = req.query;

      if (!q || typeof q !== 'string' || q.trim().length < 2) {
        return res.json([]);
      }

      const searchTerm = q.trim().toLowerCase();
      let startDate, endDate;
      if (period && filterType) {
        const dateRange = getDateRange(period as string, filterType as string);
        startDate = dateRange.startDate;
        endDate = dateRange.endDate;
      }

      const results = await storage.searchSalespeople(
        searchTerm,
        startDate,
        endDate,
        decodeURIComponent(segment)
      );

      res.json(results);
    } catch (error) {
      console.error("Error searching segment salespeople:", error);
      res.status(500).json({ message: "Failed to search segment salespeople" });
    }
  });

  // Segment-scoped salesperson clients (expanded accordion data)
  app.get("/api/segments/:segment/top-salespeople/:salesperson/clients", requireAuth, async (req, res) => {
    try {
      const { segment, salesperson } = req.params;
      const { period, filterType, limit } = req.query;

      const result = await storage.getSalespersonClients(
        decodeURIComponent(salesperson),
        period as string,
        filterType as string,
        decodeURIComponent(segment),
        limit ? parseInt(limit as string) : undefined
      );

      res.json(result);
    } catch (error) {
      console.error("Error fetching segment salesperson clients:", error);
      res.status(500).json({ message: "Failed to fetch segment salesperson clients" });
    }
  });

  // Segment-scoped top clients (alias to /api/sales/top-clients with segment filter)
  app.get("/api/segments/:segment/top-clients", requireAuth, async (req, res) => {
    try {
      const { segment } = req.params;
      const { limit, period, filterType } = req.query;
      const dateRange = getDateRange(period as string, filterType as string);

      const result = await storage.getTopClients(
        limit ? parseInt(limit as string) : undefined,
        dateRange.startDate,
        dateRange.endDate,
        undefined, // salesperson filter
        decodeURIComponent(segment)
      );
      res.json(result);
    } catch (error) {
      console.error("Error fetching segment top clients:", error);
      res.status(500).json({ message: "Failed to fetch segment top clients" });
    }
  });

  // Segment-scoped client search
  app.get("/api/segments/:segment/top-clients/search", requireAuth, async (req, res) => {
    try {
      const { segment } = req.params;
      const { q, period, filterType } = req.query;

      if (!q || typeof q !== 'string' || q.trim().length < 2) {
        return res.json([]);
      }

      const searchTerm = q.trim().toLowerCase();
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
        undefined, // salesperson filter
        decodeURIComponent(segment)
      );

      res.json(results);
    } catch (error) {
      console.error("Error searching segment clients:", error);
      res.status(500).json({ message: "Failed to search segment clients" });
    }
  });

  // Segment-scoped client products (expanded accordion data)
  app.get("/api/segments/:segment/top-clients/:client/products", requireAuth, async (req, res) => {
    try {
      const { segment, client } = req.params;
      const { period, filterType } = req.query;

      // Get client products using existing method
      // Note: getClientProducts() does not currently support segment filtering
      // Products are filtered by client and period only
      const products = await storage.getClientProducts(
        decodeURIComponent(client),
        period as string,
        filterType as string
      );

      res.json(products);
    } catch (error) {
      console.error("Error fetching segment client products:", error);
      res.status(500).json({ message: "Failed to fetch segment client products" });
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
  app.get("/api/sales/salesperson/:salespersonName/details", requireAuth, requireOwnDataOrAdmin, async (req, res) => {
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
  app.get("/api/sales/salesperson/:salespersonName/metrics", requireAuth, requireOwnDataOrAdmin, async (req, res) => {
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

  app.get("/api/sales/salesperson/:salespersonName/clients", requireAuth, requireOwnDataOrAdmin, async (req, res) => {
    try {
      const { salespersonName } = req.params;
      const { period, filterType = "month", segment, limit } = req.query;

      const clients = await storage.getSalespersonClients(
        salespersonName,
        period as string,
        filterType as string,
        segment as string | undefined,
        limit ? parseInt(limit as string) : undefined
      );
      res.json(clients);
    } catch (error) {
      console.error("Error fetching salesperson clients:", error);
      res.status(500).json({ message: "Failed to fetch salesperson clients" });
    }
  });

  app.get("/api/sales/salesperson/:salespersonName/products", requireAuth, requireOwnDataOrAdmin, async (req, res) => {
    try {
      const { salespersonName } = req.params;
      const { period, filterType = "month", segment, limit } = req.query;

      const products = await storage.getSalespersonProducts(
        salespersonName,
        period as string,
        filterType as string,
        segment as string | undefined,
        limit ? parseInt(limit as string) : undefined
      );
      res.json(products);
    } catch (error) {
      console.error("Error fetching salesperson products:", error);
      res.status(500).json({ message: "Failed to fetch salesperson products" });
    }
  });

  app.get("/api/sales/salesperson/:salespersonName/segments", requireAuth, requireOwnDataOrAdmin, async (req, res) => {
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

  // Salesperson NVV pending sales - Uses fact_nvv table via storage layer
  app.get("/api/sales/salesperson/:salespersonName/nvv-pending", requireAuth, requireOwnDataOrAdmin, async (req, res) => {
    try {
      const { salespersonName } = req.params;
      const { period, filterType = "month" } = req.query;

      // Calculate date range based on period
      let startDate: Date | undefined;
      let endDate: Date | undefined;

      if (period) {
        switch (filterType) {
          case 'month':
            const [year, month] = (period as string).split('-');
            startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
            endDate = new Date(parseInt(year), parseInt(month), 0);
            break;
          case 'year':
            startDate = new Date(parseInt(period as string), 0, 1);
            endDate = new Date(parseInt(period as string), 11, 31);
            break;
        }
      }

      // Use storage layer which queries fact_nvv (the active NVV table)
      const nvvRecords = await storage.getNvvBySalesperson({
        salesperson: salespersonName,
        startDate,
        endDate
      });

      // Aggregate by client
      const clientMap = new Map<string, { totalPending: number; documentCount: Set<string> }>();

      for (const record of nvvRecords) {
        const clientName = record.NOKOEN || 'Sin Cliente';
        if (!clientMap.has(clientName)) {
          clientMap.set(clientName, { totalPending: 0, documentCount: new Set() });
        }
        const client = clientMap.get(clientName)!;
        client.totalPending += record.totalPendiente || 0;
        if (record.NUDO) client.documentCount.add(record.NUDO);
      }

      const clients = Array.from(clientMap.entries())
        .map(([clientName, data]) => ({
          clientName,
          totalPending: data.totalPending,
          documentCount: data.documentCount.size
        }))
        .sort((a, b) => b.totalPending - a.totalPending);

      const totalNVV = clients.reduce((sum, item) => sum + item.totalPending, 0);
      const totalDocuments = clients.reduce((sum, item) => sum + item.documentCount, 0);

      res.json({
        total: totalNVV,
        documentCount: totalDocuments,
        clients
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
  app.get("/api/sales/salesperson/:salespersonName/clients-analysis", requireAuth, requireOwnDataOrAdmin, async (req, res) => {
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
  app.get("/api/sales/salesperson/:salespersonName/smart-notifications", requireAuth, requireOwnDataOrAdmin, async (req, res) => {
    try {
      const { salespersonName } = req.params;

      const notifications = await storage.getSalespersonSmartNotifications(salespersonName);
      res.json(notifications);
    } catch (error) {
      console.error("Error fetching smart notifications:", error);
      res.status(500).json({ message: "Failed to fetch smart notifications" });
    }
  });

  // Get client last purchase details for salesperson
  app.get("/api/sales/salesperson/:salespersonName/client-purchase-details/:clientName", requireAuth, requireOwnDataOrAdmin, async (req, res) => {
    try {
      const { salespersonName, clientName } = req.params;

      const details = await storage.getClientLastPurchaseDetails(salespersonName, clientName);
      res.json(details);
    } catch (error) {
      console.error("Error fetching client purchase details:", error);
      res.status(500).json({ message: "Failed to fetch client purchase details" });
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

  // ⚠️ DEPRECATED - CSV import endpoint (legacy backup system)
  // This endpoint is DEPRECATED and maintained only as emergency backup.
  // Primary data source is fact_ventas populated by automated ETL sync from SQL Server.
  // Data imported via this endpoint will NOT appear in dashboards (writes to legacy salesTransactions table).
  // Use only in emergency situations when ETL system is unavailable.
  app.post('/api/sales/import', requireAuth, async (req, res) => {
    try {
      console.warn('⚠️  DEPRECATED ENDPOINT USED: /api/sales/import - Este sistema está obsoleto. Usar ETL automático (fact_ventas) como fuente principal.');

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

      // Add deprecation warning to response
      res.set('X-Deprecated-API', 'true');
      res.set('X-Deprecation-Warning', 'Este endpoint está obsoleto. Los datos NO aparecerán en dashboards. Usar ETL automático como fuente principal.');

      res.json({
        message: "Data imported successfully",
        imported: validatedTransactions.length,
        total: transactions.length,
        errors: errors.length > 0 ? errors.slice(0, 5) : undefined,
        warning: "⚠️  SISTEMA OBSOLETO: Datos importados a tabla legacy. NO aparecerán en dashboards que usan fact_ventas (ETL)."
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
  app.get('/api/goals', requireCommercialAccess, async (req, res) => {
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
  app.get('/api/goals/data/segments', requireCommercialAccess, async (req, res) => {
    try {
      const segments = await storage.getUniqueSegments();
      res.json(segments);
    } catch (error) {
      console.error("Error fetching segments:", error);
      res.status(500).json({ message: "Failed to fetch segments" });
    }
  });

  app.get('/api/goals/data/salespeople', requireCommercialAccess, async (req, res) => {
    try {
      const { period, filterType } = req.query;
      const dateRange = period && filterType ? getDateRange(period as string, filterType as string) : {};
      const salespeople = await storage.getUniqueSalespeople(dateRange);
      res.json(salespeople);
    } catch (error) {
      console.error("Error fetching salespeople:", error);
      res.status(500).json({ message: "Failed to fetch salespeople" });
    }
  });

  app.get('/api/goals/data/clients', requireCommercialAccess, async (req, res) => {
    try {
      const clients = await storage.getUniqueClients();
      res.json(clients);
    } catch (error) {
      console.error("Error fetching clients:", error);
      res.status(500).json({ message: "Failed to fetch clients" });
    }
  });

  app.get('/api/goals/data/suppliers', requireCommercialAccess, async (req, res) => {
    try {
      const suppliers = await storage.getUniqueSuppliers();
      res.json(suppliers);
    } catch (error) {
      console.error("Error fetching suppliers:", error);
      res.status(500).json({ message: "Failed to fetch suppliers" });
    }
  });

  // Goals progress endpoint
  app.get('/api/goals/progress', requireCommercialAccess, async (req, res) => {
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
  app.get('/api/api-keys', requireCommercialAccess, async (req: any, res) => {
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

  app.post('/api/api-keys', requireCommercialAccess, async (req: any, res) => {
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

  app.patch('/api/api-keys/:id/toggle', requireCommercialAccess, async (req: any, res) => {
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

  app.delete('/api/api-keys/:id', requireCommercialAccess, async (req: any, res) => {
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

  // ================================
  // INTEGRATIONS & META ADS OAUTH
  // ================================

  // Get all integrations
  app.get('/api/integrations', requireAdminOrSupervisor, async (req: any, res) => {
    try {
      const allIntegrations = await storage.getIntegrations();
      // Whitelist approach - only expose safe fields, never tokens
      const sanitized = allIntegrations.map(i => ({
        id: i.id,
        platform: i.platform,
        name: i.name,
        accountId: i.accountId,
        accountName: i.accountName,
        status: i.status,
        lastSync: i.lastSync,
        tokenExpiresAt: i.tokenExpiresAt,
        createdBy: i.createdBy,
        createdAt: i.createdAt,
        updatedAt: i.updatedAt,
      }));
      res.json(sanitized);
    } catch (error) {
      console.error('Error fetching integrations:', error);
      res.status(500).json({ message: 'Error al obtener integraciones' });
    }
  });

  // Delete/disconnect integration
  app.delete('/api/integrations/:id', requireAdminOrSupervisor, async (req: any, res) => {
    try {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Solo administradores pueden desconectar integraciones' });
      }
      await storage.deleteIntegration(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting integration:', error);
      res.status(500).json({ message: 'Error al eliminar integración' });
    }
  });

  // Sync integration data
  app.post('/api/integrations/:id/sync', requireAdminOrSupervisor, async (req: any, res) => {
    try {
      const integration = await storage.getIntegrationById(req.params.id);
      if (!integration) {
        return res.status(404).json({ message: 'Integración no encontrada' });
      }

      if (integration.platform === 'meta_ads') {
        // Sync Meta Ads data
        await storage.updateIntegration(integration.id, { lastSync: new Date() });
      }

      res.json({ success: true, message: 'Sincronización iniciada' });
    } catch (error) {
      console.error('Error syncing integration:', error);
      res.status(500).json({ message: 'Error al sincronizar' });
    }
  });

  // Start Meta Ads OAuth flow
  app.post('/api/oauth/meta_ads/start', requireAdminOrSupervisor, async (req: any, res) => {
    try {
      const metaAppId = process.env.META_APP_ID;
      const metaAppSecret = process.env.META_APP_SECRET;

      if (!metaAppId || !metaAppSecret) {
        return res.status(400).json({
          message: 'Las credenciales de Meta Ads no están configuradas. Configure META_APP_ID y META_APP_SECRET en las variables de entorno.'
        });
      }

      // Generate session ID for security
      const sessionId = `meta_oauth_${Date.now()}_${nanoid(8)}`;

      // Store state in session
      req.session.metaOAuth = {
        sessionId,
        userId: req.user.id,
        startedAt: new Date().toISOString(),
      };

      // Build OAuth URL
      const redirectUri = process.env.META_REDIRECT_URI ||
        `${process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : ''}/api/oauth/meta/callback`;

      const scope = 'ads_read,ads_management,business_management';
      const authUrl = `https://www.facebook.com/v18.0/dialog/oauth?` +
        `client_id=${metaAppId}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&state=${sessionId}` +
        `&scope=${encodeURIComponent(scope)}`;

      res.json({ authUrl });
    } catch (error) {
      console.error('Error starting Meta OAuth:', error);
      res.status(500).json({ message: 'Error al iniciar autenticación' });
    }
  });

  // Meta Ads OAuth callback
  app.get('/api/oauth/meta/callback', async (req: any, res) => {
    try {
      const { code, state, error: oauthError, error_description } = req.query;

      if (oauthError) {
        console.error('Meta OAuth error:', oauthError, error_description);
        return res.redirect('/configuracion?tab=integraciones&oauth=error&message=' + encodeURIComponent(error_description || oauthError));
      }

      // Validate session state - immediately extract and delete to prevent replay attacks
      const metaOAuth = req.session.metaOAuth;
      if (!metaOAuth || metaOAuth.sessionId !== state) {
        return res.redirect('/configuracion?tab=integraciones&oauth=error&message=Sesión+inválida');
      }

      // Immediately clear session state to prevent reuse (single-use state)
      const userId = metaOAuth.userId;
      delete req.session.metaOAuth;

      const metaAppId = process.env.META_APP_ID;
      const metaAppSecret = process.env.META_APP_SECRET;
      const redirectUri = process.env.META_REDIRECT_URI ||
        `${process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : ''}/api/oauth/meta/callback`;

      // Exchange code for access token
      const tokenUrl = `https://graph.facebook.com/v18.0/oauth/access_token?` +
        `client_id=${metaAppId}` +
        `&client_secret=${metaAppSecret}` +
        `&code=${code}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}`;

      const tokenResponse = await fetch(tokenUrl);
      const tokenData = await tokenResponse.json();

      if (tokenData.error) {
        console.error('Meta token error:', tokenData.error);
        return res.redirect('/configuracion?tab=integraciones&oauth=error&message=' + encodeURIComponent(tokenData.error.message));
      }

      // Exchange for long-lived token (60 days)
      const longLivedTokenUrl = `https://graph.facebook.com/v18.0/oauth/access_token?` +
        `grant_type=fb_exchange_token` +
        `&client_id=${metaAppId}` +
        `&client_secret=${metaAppSecret}` +
        `&fb_exchange_token=${tokenData.access_token}`;

      const longLivedResponse = await fetch(longLivedTokenUrl);
      const longLivedData = await longLivedResponse.json();

      const accessToken = longLivedData.access_token || tokenData.access_token;
      const expiresIn = longLivedData.expires_in || 5184000; // Default 60 days
      const expiresAt = new Date(Date.now() + expiresIn * 1000);

      // Get user's ad accounts
      const adAccountsUrl = `https://graph.facebook.com/v18.0/me/adaccounts?fields=id,name,account_status&access_token=${accessToken}`;
      const adAccountsResponse = await fetch(adAccountsUrl);
      const adAccountsData = await adAccountsResponse.json();

      let accountId = null;
      let accountName = 'Meta Ads';

      if (adAccountsData.data && adAccountsData.data.length > 0) {
        // Use first active ad account
        const activeAccount = adAccountsData.data.find((a: any) => a.account_status === 1) || adAccountsData.data[0];
        accountId = activeAccount.id;
        accountName = activeAccount.name || `Meta Ads (${activeAccount.id})`;
      }

      // Save integration to database
      await storage.createIntegration({
        platform: 'meta_ads',
        name: accountName,
        accountId: accountId,
        accountName: accountName,
        status: 'active',
        accessToken: accessToken,
        tokenExpiresAt: expiresAt,
        createdBy: userId,
      });

      res.redirect('/configuracion?tab=integraciones&oauth=success&platform=meta');
    } catch (error) {
      console.error('Error in Meta OAuth callback:', error);
      res.redirect('/configuracion?tab=integraciones&oauth=error&message=Error+interno');
    }
  });

  // Get Meta Ads insights/metrics
  app.get('/api/meta-ads/insights', requireAdminOrSupervisor, async (req: any, res) => {
    try {
      const { datePreset = 'last_30d' } = req.query;

      // Get active Meta Ads integration
      const integration = await storage.getActiveIntegration('meta_ads');
      if (!integration) {
        return res.status(404).json({ message: 'No hay integración de Meta Ads activa' });
      }

      if (!integration.accountId) {
        return res.status(400).json({ message: 'No hay cuenta de anuncios configurada' });
      }

      // Fetch insights from Meta Graph API
      const insightsUrl = `https://graph.facebook.com/v18.0/${integration.accountId}/insights?` +
        `fields=impressions,clicks,spend,cpc,ctr,reach,actions,cost_per_action_type` +
        `&date_preset=${datePreset}` +
        `&access_token=${integration.accessToken}`;

      const response = await fetch(insightsUrl);
      const data = await response.json();

      if (data.error) {
        console.error('Meta API error:', data.error);
        if (data.error.code === 190) {
          // Token expired, update status
          await storage.updateIntegration(integration.id, { status: 'error' });
          return res.status(401).json({ message: 'Token de Meta expirado. Reconecte la integración.' });
        }
        return res.status(400).json({ message: data.error.message });
      }

      // Update last sync
      await storage.updateIntegration(integration.id, { lastSync: new Date() });

      res.json({
        insights: data.data || [],
        accountId: integration.accountId,
        accountName: integration.accountName,
        lastSync: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error fetching Meta Ads insights:', error);
      res.status(500).json({ message: 'Error al obtener métricas de Meta Ads' });
    }
  });

  // Get Meta Ads campaigns
  app.get('/api/meta-ads/campaigns', requireAdminOrSupervisor, async (req: any, res) => {
    try {
      const integration = await storage.getActiveIntegration('meta_ads');
      if (!integration || !integration.accountId) {
        return res.status(404).json({ message: 'No hay integración de Meta Ads activa' });
      }

      const campaignsUrl = `https://graph.facebook.com/v18.0/${integration.accountId}/campaigns?` +
        `fields=id,name,status,objective,daily_budget,lifetime_budget,start_time,stop_time,insights{impressions,clicks,spend,reach}` +
        `&access_token=${integration.accessToken}`;

      const response = await fetch(campaignsUrl);
      const data = await response.json();

      if (data.error) {
        console.error('Meta campaigns error:', data.error);
        return res.status(400).json({ message: data.error.message });
      }

      res.json({
        campaigns: data.data || [],
        accountName: integration.accountName,
      });
    } catch (error) {
      console.error('Error fetching Meta Ads campaigns:', error);
      res.status(500).json({ message: 'Error al obtener campañas' });
    }
  });

  app.get('/api/sales/projection-insight', requireCommercialAccess, async (req: any, res) => {
    try {
      const { period, filterType, salesperson, segment, client, projectionType } = req.query;
      const pType = (projectionType as string) || 'cierre_mes';

      let salespersonFilter = '';
      if (salesperson) salespersonFilter = ` AND nokofu = '${(salesperson as string).replace(/'/g, "''")}'`;
      let segmentFilter = '';
      if (segment) segmentFilter = ` AND noruen = '${(segment as string).replace(/'/g, "''")}'`;
      let clientFilter = '';
      if (client) clientFilter = ` AND nokoen = '${(client as string).replace(/'/g, "''")}'`;

      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth();

      let targetStartDate: Date;
      let targetEndDate: Date;
      let projectionLabel: string;

      const mFullNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

      switch (pType) {
        case 'siguiente_mes': {
          const nextM = currentMonth + 1;
          targetStartDate = new Date(currentYear, nextM, 1);
          targetEndDate = new Date(currentYear, nextM + 1, 0);
          projectionLabel = `${mFullNames[targetStartDate.getMonth()]} ${targetStartDate.getFullYear()}`;
          break;
        }
        case 'cierre_semestre': {
          const semStart = currentMonth < 6 ? 0 : 6;
          const semesterEnd = currentMonth < 6 ? 5 : 11;
          targetStartDate = new Date(currentYear, semStart, 1);
          targetEndDate = new Date(currentYear, semesterEnd + 1, 0);
          projectionLabel = semesterEnd === 5 ? `1er Semestre ${currentYear}` : `2do Semestre ${currentYear}`;
          break;
        }
        case 'cierre_ano': {
          targetStartDate = new Date(currentYear, 0, 1);
          targetEndDate = new Date(currentYear, 11, 31);
          projectionLabel = `Año ${currentYear}`;
          break;
        }
        default: {
          targetStartDate = new Date(currentYear, currentMonth, 1);
          targetEndDate = new Date(currentYear, currentMonth + 1, 0);
          projectionLabel = `${mFullNames[currentMonth]} ${currentYear}`;
          break;
        }
      }

      const totalDays = Math.ceil((targetEndDate.getTime() - targetStartDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      const currentMonthStart = new Date(currentYear, currentMonth, 1).toISOString().split('T')[0];
      const todayStr = now.toISOString().split('T')[0];

      const historyRefDate = new Date(currentYear, currentMonth, 1);
      const histRefStr = historyRefDate.toISOString().split('T')[0];

      const monthlyQuery = `
        SELECT 
          TO_CHAR(feemdo::date, 'YYYY-MM') as period,
          EXTRACT(MONTH FROM feemdo::date) as month_num,
          EXTRACT(YEAR FROM feemdo::date) as year_num,
          SUM(CASE WHEN tido != 'GDV' THEN CAST(monto AS NUMERIC) ELSE 0 END) as total_sales,
          COUNT(DISTINCT nudo) as orders,
          COUNT(DISTINCT EXTRACT(DAY FROM feemdo::date)) as active_days
        FROM ventas.fact_ventas
        WHERE feemdo >= ('${histRefStr}'::date - INTERVAL '25 months')
          AND feemdo < '${histRefStr}'
          AND nokofu IS NOT NULL AND nokofu != '.'
          ${salespersonFilter}${segmentFilter}${clientFilter}
        GROUP BY TO_CHAR(feemdo::date, 'YYYY-MM'), EXTRACT(MONTH FROM feemdo::date), EXTRACT(YEAR FROM feemdo::date)
        ORDER BY period
      `;

      const monthlyResult = await db.execute(sql.raw(monthlyQuery));
      const monthlyData = (monthlyResult.rows as any[]).map(r => ({
        period: r.period,
        monthNum: parseInt(r.month_num),
        yearNum: parseInt(r.year_num),
        sales: parseFloat(r.total_sales) || 0,
        orders: parseInt(r.orders) || 0,
        activeDays: parseInt(r.active_days) || 0,
      }));

      if (monthlyData.length < 3) {
        return res.json({ projection: null, projectionLabel, justification: 'Datos históricos insuficientes para generar una proyección confiable.' });
      }

      const currentMonthQuery = `
        SELECT 
          SUM(CASE WHEN tido != 'GDV' THEN CAST(monto AS NUMERIC) ELSE 0 END) as total_sales,
          COUNT(DISTINCT nudo) as orders,
          COUNT(DISTINCT EXTRACT(DAY FROM feemdo::date)) as active_days
        FROM ventas.fact_ventas
        WHERE feemdo >= '${currentMonthStart}'
          AND feemdo <= '${todayStr}'
          AND nokofu IS NOT NULL AND nokofu != '.'
          ${salespersonFilter}${segmentFilter}${clientFilter}
      `;
      const currentMonthResult = await db.execute(sql.raw(currentMonthQuery));
      const cmData = currentMonthResult.rows[0] as any;
      const currentMonthSales = parseFloat(cmData?.total_sales) || 0;
      const currentMonthActiveDays = parseInt(cmData?.active_days) || 0;

      const actualMonthsQuery = `
        SELECT 
          TO_CHAR(feemdo::date, 'YYYY-MM') as period,
          EXTRACT(MONTH FROM feemdo::date) as month_num,
          SUM(CASE WHEN tido != 'GDV' THEN CAST(monto AS NUMERIC) ELSE 0 END) as total_sales
        FROM ventas.fact_ventas
        WHERE feemdo >= '${targetStartDate.toISOString().split('T')[0]}'
          AND feemdo <= '${todayStr}'
          AND nokofu IS NOT NULL AND nokofu != '.'
          ${salespersonFilter}${segmentFilter}${clientFilter}
        GROUP BY TO_CHAR(feemdo::date, 'YYYY-MM'), EXTRACT(MONTH FROM feemdo::date)
        ORDER BY period
      `;
      const actualMonthsResult = await db.execute(sql.raw(actualMonthsQuery));
      const actualMonthsData: Record<number, number> = {};
      let totalActualSales = 0;
      for (const r of actualMonthsResult.rows as any[]) {
        const mNum = parseInt(r.month_num);
        const sales = parseFloat(r.total_sales) || 0;
        actualMonthsData[mNum] = sales;
        totalActualSales += sales;
      }

      const last12 = monthlyData.slice(-12);
      const last6 = monthlyData.slice(-6);
      const avg12 = last12.reduce((s, m) => s + m.sales, 0) / last12.length;
      const avg6 = last6.reduce((s, m) => s + m.sales, 0) / last6.length;

      const seasonalAvg: Record<number, { total: number; count: number }> = {};
      for (const m of monthlyData) {
        if (!seasonalAvg[m.monthNum]) seasonalAvg[m.monthNum] = { total: 0, count: 0 };
        seasonalAvg[m.monthNum].total += m.sales;
        seasonalAvg[m.monthNum].count += 1;
      }

      const trendDirection6 = avg6 > avg12 ? 'alza' : avg6 < avg12 * 0.95 ? 'baja' : 'estable';
      const trendMultiplier = trendDirection6 === 'alza' ? (avg6 / avg12) : trendDirection6 === 'baja' ? (avg6 / avg12) : 1;

      const projectMonth = (monthNum: number): number => {
        const seasonal = seasonalAvg[monthNum];
        if (seasonal && seasonal.count >= 1) {
          return (seasonal.total / seasonal.count) * trendMultiplier;
        }
        return (avg6 * 0.6 + avg12 * 0.4) * trendMultiplier;
      };

      let projectedSales: number;
      let currentSales: number;
      let methodology: string;
      let elapsedDays: number;
      const monthlyBreakdown: { month: string; projected: number; isActual: boolean }[] = [];

      const mNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

      const buildMultiMonthProjection = (rangeStart: number, rangeEnd: number) => {
        let accumulated = 0;
        for (let m = rangeStart; m <= rangeEnd; m++) {
          if (m < currentMonth) {
            const actual = actualMonthsData[m + 1] || 0;
            accumulated += actual;
            monthlyBreakdown.push({ month: mNames[m], projected: Math.round(actual), isActual: true });
          } else if (m === currentMonth) {
            if (currentMonthActiveDays > 3) {
              const daysInM = new Date(currentYear, m + 1, 0).getDate();
              const dailyRate = currentMonthSales / currentMonthActiveDays;
              const proj = dailyRate * Math.round(daysInM * 0.72);
              accumulated += proj;
              monthlyBreakdown.push({ month: mNames[m], projected: Math.round(proj), isActual: false });
            } else {
              const proj = projectMonth(m + 1);
              accumulated += proj;
              monthlyBreakdown.push({ month: mNames[m], projected: Math.round(proj), isActual: false });
            }
          } else {
            const proj = projectMonth(m + 1);
            accumulated += proj;
            monthlyBreakdown.push({ month: mNames[m], projected: Math.round(proj), isActual: false });
          }
        }
        return accumulated;
      };

      switch (pType) {
        case 'cierre_mes': {
          currentSales = currentMonthSales;
          const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
          elapsedDays = now.getDate();
          if (currentMonthActiveDays > 3) {
            const dailyRate = currentMonthSales / currentMonthActiveDays;
            const businessDays = Math.round(daysInMonth * 0.72);
            const runRate = dailyRate * businessDays;
            const weightedAvg = avg6 * 0.6 + avg12 * 0.4;
            projectedSales = runRate * 0.65 + weightedAvg * 0.35;
            methodology = 'run_rate_blended';
          } else {
            projectedSales = projectMonth(currentMonth + 1);
            methodology = 'historical_seasonal';
          }
          monthlyBreakdown.push({ month: mNames[currentMonth], projected: Math.round(projectedSales), isActual: false });
          break;
        }
        case 'siguiente_mes': {
          currentSales = 0;
          elapsedDays = 0;
          projectedSales = projectMonth(targetStartDate.getMonth() + 1);
          methodology = 'historical_seasonal';
          monthlyBreakdown.push({ month: mNames[targetStartDate.getMonth()], projected: Math.round(projectedSales), isActual: false });
          break;
        }
        case 'cierre_semestre': {
          const semStart = currentMonth < 6 ? 0 : 6;
          const semEnd = currentMonth < 6 ? 5 : 11;
          currentSales = totalActualSales;
          elapsedDays = Math.ceil((now.getTime() - new Date(currentYear, semStart, 1).getTime()) / (1000 * 60 * 60 * 24));
          projectedSales = buildMultiMonthProjection(semStart, semEnd);
          methodology = 'seasonal_accumulated';
          break;
        }
        case 'cierre_ano': {
          currentSales = totalActualSales;
          elapsedDays = Math.ceil((now.getTime() - new Date(currentYear, 0, 1).getTime()) / (1000 * 60 * 60 * 24));
          projectedSales = buildMultiMonthProjection(0, 11);
          methodology = 'seasonal_accumulated';
          break;
        }
        default: {
          projectedSales = avg6 * 0.6 + avg12 * 0.4;
          currentSales = currentMonthSales;
          elapsedDays = now.getDate();
          methodology = 'historical_average';
        }
      }

      const maxMonth = Math.max(...last12.map(m => m.sales));
      const minMonth = Math.min(...last12.map(m => m.sales));
      const bestMonth = last12.find(m => m.sales === maxMonth);
      const worstMonth = last12.find(m => m.sales === minMonth);
      const volatility = maxMonth > 0 ? ((maxMonth - minMonth) / maxMonth * 100).toFixed(0) : '0';

      const samePeriodLastYear = monthlyData.find(m => {
        const [y, mo] = m.period.split('-').map(Number);
        return y === currentYear - 1 && mo === currentMonth + 1;
      });
      const yoyChange = samePeriodLastYear
        ? ((projectedSales - samePeriodLastYear.sales) / samePeriodLastYear.sales * 100)
        : null;

      const formatCLP = (n: number) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n);
      const formatMName = (p: string) => {
        const [y, m] = p.split('-');
        return `${mNames[parseInt(m) - 1]} ${y}`;
      };

      const factors: string[] = [];

      if (pType === 'cierre_mes' && methodology === 'run_rate_blended') {
        factors.push(`Con ${currentMonthActiveDays} días activos de venta y un acumulado de ${formatCLP(currentMonthSales)}, el ritmo actual proyecta un cierre de ${formatCLP(projectedSales)}.`);
      } else if (pType === 'siguiente_mes') {
        const targetMName = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'][targetStartDate.getMonth()];
        factors.push(`La proyección para ${targetMName} se basa en el promedio estacional de ese mes ajustado por la tendencia reciente.`);
      } else if (pType === 'cierre_semestre') {
        const remaining = monthlyBreakdown.filter(b => !b.isActual).length;
        factors.push(`Se proyectan ${remaining} meses restantes del semestre usando promedios estacionales con ajuste de tendencia. Acumulado real a la fecha: ${formatCLP(currentSales)}.`);
      } else if (pType === 'cierre_ano') {
        const remaining = monthlyBreakdown.filter(b => !b.isActual).length;
        factors.push(`Se proyectan ${remaining} meses restantes del año usando promedios estacionales. Acumulado real del año: ${formatCLP(currentSales)}.`);
      }

      if (trendDirection6 === 'alza') {
        const pctUp = ((avg6 - avg12) / avg12 * 100).toFixed(1);
        factors.push(`Tendencia al alza: los últimos 6 meses crecieron un ${pctUp}% respecto al promedio de 12 meses.`);
      } else if (trendDirection6 === 'baja') {
        const pctDown = ((avg12 - avg6) / avg12 * 100).toFixed(1);
        factors.push(`Tendencia a la baja: los últimos 6 meses cayeron un ${pctDown}% respecto al promedio anual.`);
      } else {
        factors.push(`Las ventas se mantienen estables entre los promedios de 6 y 12 meses.`);
      }

      if (bestMonth) {
        factors.push(`Mejor mes reciente: ${formatMName(bestMonth.period)} (${formatCLP(bestMonth.sales)}). Menor: ${formatMName(worstMonth!.period)} (${formatCLP(worstMonth!.sales)}).`);
      }

      if (samePeriodLastYear && yoyChange !== null) {
        const dir = yoyChange >= 0 ? 'superior' : 'inferior';
        factors.push(`${Math.abs(parseFloat(yoyChange.toFixed(1)))}% ${dir} al mismo mes del año anterior.`);
      }

      res.json({
        projection: Math.round(projectedSales),
        projectionLabel,
        projectionType: pType,
        currentSales: Math.round(currentSales),
        avg12: Math.round(avg12),
        avg6: Math.round(avg6),
        trend: trendDirection6,
        yoyChange: yoyChange ? parseFloat(yoyChange.toFixed(1)) : null,
        samePeriodLastYear: samePeriodLastYear ? Math.round(samePeriodLastYear.sales) : null,
        methodology,
        elapsedDays,
        totalDays,
        currentActiveDays: currentMonthActiveDays,
        currentOrders: parseInt(cmData?.orders) || 0,
        bestMonth: bestMonth ? { period: bestMonth.period, sales: Math.round(bestMonth.sales) } : null,
        worstMonth: worstMonth ? { period: worstMonth.period, sales: Math.round(worstMonth.sales) } : null,
        monthlyBreakdown,
        justification: factors.join(' '),
        factors,
      });
    } catch (error) {
      console.error('Error generating projection insight:', error);
      res.status(500).json({ message: 'Error al generar proyección de ventas' });
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
      // Admin, supervisor y tecnico_obra pueden acceder (para asignación de tareas)
      let userId;
      let userRecord;

      // Verificar autenticación con el nuevo sistema
      if (!req.user || !req.user.id) {
        return res.status(401).json({ message: 'Usuario no autenticado' });
      }

      userId = req.user.id;
      userRecord = req.user;

      if (userRecord?.role !== 'admin' && userRecord?.role !== 'supervisor' && userRecord?.role !== 'tecnico_obra') {
        return res.status(403).json({ message: 'Acceso denegado. Solo administradores, supervisores y técnicos pueden acceder a la gestión de usuarios.' });
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

  // ==================================================================================
  // PUBLIC CATALOG ROUTES (for salesperson public catalogs)
  // ==================================================================================

  // Get public salesperson catalog (profile + products)
  app.get('/api/public/catalogos/:slug', async (req: any, res) => {
    try {
      const { slug } = req.params;
      const { grouped } = req.query;

      // Get salesperson by slug
      const salesperson = await storage.getPublicSalespersonBySlug(slug);

      if (!salesperson) {
        return res.status(404).json({ message: 'Catálogo no encontrado' });
      }

      // Get active ecommerce products (grouped or flat)
      const products = grouped === 'true'
        ? await storage.getGroupedCatalogProducts()
        : await storage.getPublicCatalogProducts();

      res.json({
        salesperson,
        products,
        isGrouped: grouped === 'true'
      });
    } catch (error) {
      console.error('Error fetching public catalog:', error);
      res.status(500).json({ message: 'Error al cargar el catálogo' });
    }
  });

  // Get grouped products for public catalog
  app.get('/api/public/products/grouped', async (req: any, res) => {
    try {
      const groupedProducts = await storage.getGroupedCatalogProducts();
      res.json(groupedProducts);
    } catch (error) {
      console.error('Error fetching grouped products:', error);
      res.status(500).json({ message: 'Error al cargar productos agrupados' });
    }
  });

  // Search client by RUT for public catalog identification
  app.get('/api/public/clients/search-by-rut', async (req: any, res) => {
    try {
      const { rut } = req.query;

      if (!rut || typeof rut !== 'string') {
        return res.status(400).json({ message: 'RUT es requerido' });
      }

      // Clean and normalize RUT (remove dots and dashes, uppercase)
      const cleanRut = rut.replace(/\./g, '').replace(/-/g, '').toUpperCase().trim();

      if (cleanRut.length < 7) {
        return res.status(400).json({ message: 'RUT inválido' });
      }

      // Search client by RUT in the clients table
      const client = await storage.getClientByRut(cleanRut);

      if (!client) {
        return res.status(404).json({ message: 'Cliente no encontrado' });
      }

      // Get client's loyalty status based on their purchase history
      let loyaltyTier = null;
      let nextTier = null;
      let amountToNextTier = 0;
      let totalSalesLast90Days = 0;
      try {
        const loyaltyStatus = await storage.getClientLoyaltyStatus(client.nokoen);
        if (loyaltyStatus) {
          if (loyaltyStatus.currentTier) {
            loyaltyTier = {
              code: loyaltyStatus.currentTier.codigo,
              name: loyaltyStatus.currentTier.nombre
            };
          }
          if (loyaltyStatus.nextTier) {
            nextTier = {
              code: loyaltyStatus.nextTier.codigo,
              name: loyaltyStatus.nextTier.nombre,
              minAmount: Number(loyaltyStatus.nextTier.montoMinimo)
            };
          }
          amountToNextTier = loyaltyStatus.amountToNextTier;
          totalSalesLast90Days = loyaltyStatus.totalSalesLast90Days;
        }
      } catch (e) {
        console.error('Error fetching loyalty status:', e);
      }

      // Return client info with loyalty tier and progress to next tier
      res.json({
        found: true,
        clientName: client.nokoen,
        clientCode: client.koen,
        clientEmail: client.emailen || null,
        clientPhone: client.telen || null,
        loyaltyTier,
        nextTier,
        amountToNextTier,
        totalSalesLast90Days
      });
    } catch (error) {
      console.error('Error searching client by RUT:', error);
      res.status(500).json({ message: 'Error al buscar cliente' });
    }
  });

  // Submit quote request from public catalog (no auth required)
  app.post('/api/public/catalogos/:slug/cotizacion', async (req: any, res) => {
    try {
      const { slug } = req.params;
      const { publicQuoteRequestSchema } = await import('@shared/schema');

      // Get salesperson by slug
      const salesperson = await storage.getPublicSalespersonBySlug(slug);

      if (!salesperson) {
        return res.status(404).json({ message: 'Catálogo no encontrado' });
      }

      // Validate request body
      const validation = publicQuoteRequestSchema.safeParse(req.body);

      if (!validation.success) {
        return res.status(400).json({
          message: 'Datos inválidos',
          errors: validation.error.errors
        });
      }

      // Create quote request
      const quote = await storage.createPublicQuoteRequest(salesperson.id, validation.data);

      res.status(201).json({
        message: 'Solicitud de cotización enviada exitosamente',
        quoteId: quote.id
      });
    } catch (error) {
      console.error('Error creating public quote:', error);
      res.status(500).json({ message: 'Error al enviar la solicitud de cotización' });
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

  // ===================== Grouped Product Catalog API =====================
  // IMPORTANT: This must be registered BEFORE /api/products/:sku to avoid Express matching 'grouped-catalog' as a :sku param

  app.get('/api/products/grouped-catalog', requireAuth, asyncHandler(async (req: any, res: any) => {
    const { search, groupFilter } = req.query;

    const result = await db.execute(sql`
      SELECT
        ep.id as ecom_id,
        ep.categoria as group_name,
        ep.descripcion as description,
        ep.activo as activo,
        ep.precio_ecommerce as precio,
        ep.variant_parent_sku,
        ep.variant_generic_display_name,
        ep.variant_index,
        ep.color,
        ep.variant_label,
        ep.is_main_variant,
        ep.min_unit,
        ep.step_size,
        ep.format_unit,
        ep.packaging_unit_name,
        ep.weight, ep.weight_unit,
        ep.length, ep.length_unit,
        ep.width, ep.width_unit,
        ep.height, ep.height_unit,
        ep.volume, ep.volume_unit,
        ep.packaging_package_name, ep.packaging_package_unit, ep.packaging_amount_per_package,
        ep.packaging_box_name, ep.packaging_box_unit, ep.packaging_amount_per_box,
        ep.packaging_pallet_name, ep.packaging_pallet_unit, ep.packaging_amount_per_pallet,
        ep.group_id,
        pl.codigo as sku,
        pl.producto as product_name,
        pl.unidad as unit,
        pl.lista as price_list
      FROM ecommerce_products ep
      INNER JOIN price_list pl ON ep.price_list_id = pl.id
      WHERE ep.categoria IS NOT NULL
      ORDER BY ep.variant_generic_display_name, ep.format_unit, ep.variant_index
    `);

    const rows = Array.isArray(result) ? result : (result as any).rows || [];

    // New structure: Product -> Formats -> Colors
    const productsMap = new Map<string, {
      genericName: string;
      parentSku: string | null;
      groupName: string | null;
      formats: Map<string, any[]>;
    }>();

    for (const row of rows as any[]) {
      const groupName = row.group_name || null;
      const parentSku = row.variant_parent_sku || row.sku;

      // Obtener el formato limpio desde packaging_unit_name
      const formatUnit = row.packaging_unit_name || row.format_unit || row.unit || 'Sin formato';

      // Extraer nombre base desde product_name (quitando el color al final)
      const fullName = row.product_name || 'Sin Nombre';

      // Lista de colores conocidos para quitar del final del nombre
      const colorSuffixes = [
        'NATURAL', 'BLANCO', 'NEGRO', 'GRIS', 'ROJO', 'AZUL', 'VERDE', 'AMARILLO', 'CAFE',
        'OCRE', 'NARANJO', 'BERMELLON', 'ROBLE', 'NOGAL', 'MAPLE', 'CAOBA', 'ALERCE',
        'BLANCO HOSPITALARIO', 'BEIGE HOSPITALARIO', 'CELESTE CLINICO', 'GRIS BOX',
        'ROSA MATERNO', 'VERDE URGENCIA', 'BASE OSCURA', 'BASE INCOLORA', 'INCOLORO',
        'GRIS OSCURO', 'AZUL CANADA', 'CAFE', 'GRIS MAQUINARIA'
      ];

      let baseName = fullName;
      for (const color of colorSuffixes) {
        if (baseName.toUpperCase().endsWith(' ' + color)) {
          baseName = baseName.substring(0, baseName.length - color.length - 1).trim();
          break;
        }
      }
      const genericName = baseName || fullName;
      const unit = formatUnit;

      if (search) {
        const s = (search as string).toLowerCase();
        const matches =
          row.sku?.toLowerCase().includes(s) ||
          row.product_name?.toLowerCase().includes(s) ||
          genericName.toLowerCase().includes(s) ||
          (row.color && row.color.toLowerCase().includes(s)) ||
          (groupName && groupName.toLowerCase().includes(s));
        if (!matches) continue;
      }

      if (groupFilter && groupFilter !== 'all' && groupName !== groupFilter) continue;

      if (!productsMap.has(genericName)) {
        productsMap.set(genericName, {
          genericName,
          parentSku,
          groupName,
          formats: new Map(),
        });
      }
      const product = productsMap.get(genericName)!;

      if (!product.formats.has(unit)) {
        product.formats.set(unit, []);
      }

      product.formats.get(unit)!.push({
        ecomId: row.ecom_id,
        sku: row.sku,
        name: row.product_name,
        color: row.color,
        unit: unit,
        groupName: groupName,
        price: row.precio,
        priceList: row.price_list,
        minUnit: row.min_unit,
        stepSize: row.step_size,
        variantIndex: row.variant_index,
        isMainVariant: row.is_main_variant,
        description: row.description,
        dimensions: {
          weight: row.weight, weightUnit: row.weight_unit,
          length: row.length, lengthUnit: row.length_unit,
          width: row.width, widthUnit: row.width_unit,
          height: row.height, heightUnit: row.height_unit,
          volume: row.volume, volumeUnit: row.volume_unit,
        },
        packaging: {
          packageName: row.packaging_package_name,
          packageUnit: row.packaging_package_unit,
          amountPerPackage: row.packaging_amount_per_package,
          boxName: row.packaging_box_name,
          boxUnit: row.packaging_box_unit,
          amountPerBox: row.packaging_amount_per_box,
          palletName: row.packaging_pallet_name,
          palletUnit: row.packaging_pallet_unit,
          amountPerPallet: row.packaging_amount_per_pallet,
        },
      });
    }

    // Convert Map to object for JSON response
    const catalog = Array.from(productsMap.values()).map(p => ({
      genericName: p.genericName,
      parentSku: p.parentSku,
      groupName: p.groupName,
      formats: Object.fromEntries(p.formats),
    }));

    const availableGroups = [...new Set((rows as any[]).map((r: any) => r.group_name).filter(Boolean))].sort();

    res.json({ catalog, availableGroups, totalProducts: (rows as any[]).length });
  }));

  // Import grouped catalog CSV into ecommerce_products
  app.post('/api/products/import-grouped-catalog', requireAuth, asyncHandler(async (req: any, res: any) => {
    // Only admin can import
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ message: 'Solo administradores pueden importar el catálogo' });
    }

    const { products } = req.body;
    if (!products || !Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ message: 'No se recibieron productos para importar' });
    }

    console.log(`📦 Importando catálogo agrupado: ${products.length} filas`);

    // Build a map of price_list.codigo -> price_list.id
    const plResult = await db.execute(sql`SELECT id, codigo FROM price_list`);
    const plRows = Array.isArray(plResult) ? plResult : (plResult as any).rows || [];
    const priceListMap = new Map<string, number>();
    for (const row of plRows as any[]) {
      if (row.codigo) {
        priceListMap.set(row.codigo.trim().toUpperCase(), row.id);
      }
    }

    let imported = 0;
    let skipped = 0;
    let notFound = 0;
    const notFoundSkus: string[] = [];

    for (const row of products) {
      const sku = (row.productId || '').trim();
      if (!sku) { skipped++; continue; }

      const plId = priceListMap.get(sku.toUpperCase());

      // If SKU not found in price_list, insert it first
      let finalPlId = plId;
      if (!finalPlId) {
        // Create a price_list entry for this SKU
        const insertResult = await db.execute(sql`
          INSERT INTO price_list (codigo, producto, unidad)
          VALUES (${sku}, ${(row.name || '').trim()}, ${(row.packaging_unitName || '').trim()})
          ON CONFLICT (codigo) DO UPDATE SET producto = EXCLUDED.producto
          RETURNING id
        `);
        const insertRows = Array.isArray(insertResult) ? insertResult : (insertResult as any).rows || [];
        if (insertRows.length > 0) {
          finalPlId = (insertRows[0] as any).id;
          priceListMap.set(sku.toUpperCase(), finalPlId);
        } else {
          notFound++;
          if (notFoundSkus.length < 20) notFoundSkus.push(sku);
          continue;
        }
      }

      const groupName = (row['Nombre Producto - Grupo'] || row.groupName || '').trim();
      const color = (row.variant_features_0_value || row.color || '').trim() || null;
      const description = (row.description || '').trim() || null;
      const productName = (row.name || '').trim();
      const packagingUnitName = (row.packaging_unitName || '').trim() || null;
      const pricePerUnit = row.pricePerUnit ? parseFloat(row.pricePerUnit) : null;

      // Dimensions
      const weight = row.dimensions_weight ? parseFloat(row.dimensions_weight) : null;
      const weightUnit = (row.dimensions_weightUnit || '').trim() || null;
      const length = row.dimensions_length ? parseFloat(row.dimensions_length) : null;
      const lengthUnit = (row.dimensions_lengthUnit || '').trim() || null;
      const width = row.dimensions_width ? parseFloat(row.dimensions_width) : null;
      const widthUnit = (row.dimensions_widthUnit || '').trim() || null;
      const height = row.dimensions_height ? parseFloat(row.dimensions_height) : null;
      const heightUnit = (row.dimensions_heightUnit || '').trim() || null;
      const volume = row.dimensions_volume ? parseFloat(row.dimensions_volume) : null;
      const volumeUnit = (row.dimensions_volumeUnit || '').trim() || null;

      // Constraints
      const minUnit = row.constraints_minUnit ? parseInt(row.constraints_minUnit) : 1;
      const stepSize = row.constraints_stepSize ? parseInt(row.constraints_stepSize) : 1;

      // Packaging
      const pkgUnit = (row.packaging_unit || '').trim() || null;
      const pkgPackageName = (row.packaging_packageName || '').trim() || null;
      const pkgPackageUnit = (row.packaging_packageUnit || '').trim() || null;
      const pkgAmountPerPackage = row.packaging_amountPerPackage ? parseInt(row.packaging_amountPerPackage) : null;
      const pkgBoxName = (row.packaging_boxName || '').trim() || null;
      const pkgBoxUnit = (row.packaging_boxUnit || '').trim() || null;
      const pkgAmountPerBox = row.packaging_amountPerBox ? parseInt(row.packaging_amountPerBox) : null;
      const pkgPalletName = (row.packaging_palletName || '').trim() || null;
      const pkgPalletUnit = (row.packaging_palletUnit || '').trim() || null;
      const pkgAmountPerPallet = row.packaging_amountPerPallet ? parseInt(row.packaging_amountPerPallet) : null;

      try {
        await db.execute(sql`
          INSERT INTO ecommerce_products (
            price_list_id, activo, categoria, descripcion,
            variant_generic_display_name, color, format_unit,
            precio_ecommerce, min_unit, step_size,
            weight, weight_unit, length, length_unit,
            width, width_unit, height, height_unit,
            volume, volume_unit,
            packaging_package_name, packaging_package_unit, packaging_amount_per_package,
            packaging_box_name, packaging_box_unit, packaging_amount_per_box,
            packaging_pallet_name, packaging_pallet_unit, packaging_amount_per_pallet,
            updated_at
          ) VALUES (
            ${finalPlId!.toString()}, true, ${groupName || 'Sin Categoría'}, ${description},
            ${groupName || productName}, ${color}, ${packagingUnitName},
            ${pricePerUnit}, ${minUnit}, ${stepSize},
            ${weight}, ${weightUnit}, ${length}, ${lengthUnit},
            ${width}, ${widthUnit}, ${height}, ${heightUnit},
            ${volume}, ${volumeUnit},
            ${pkgPackageName}, ${pkgPackageUnit}, ${pkgAmountPerPackage},
            ${pkgBoxName}, ${pkgBoxUnit}, ${pkgAmountPerBox},
            ${pkgPalletName}, ${pkgPalletUnit}, ${pkgAmountPerPallet},
            NOW()
          )
          ON CONFLICT (price_list_id) DO UPDATE SET
            activo = true,
            categoria = EXCLUDED.categoria,
            descripcion = EXCLUDED.descripcion,
            variant_generic_display_name = EXCLUDED.variant_generic_display_name,
            color = EXCLUDED.color,
            format_unit = EXCLUDED.format_unit,
            precio_ecommerce = EXCLUDED.precio_ecommerce,
            min_unit = EXCLUDED.min_unit,
            step_size = EXCLUDED.step_size,
            weight = EXCLUDED.weight,
            weight_unit = EXCLUDED.weight_unit,
            length = EXCLUDED.length,
            length_unit = EXCLUDED.length_unit,
            width = EXCLUDED.width,
            width_unit = EXCLUDED.width_unit,
            height = EXCLUDED.height,
            height_unit = EXCLUDED.height_unit,
            volume = EXCLUDED.volume,
            volume_unit = EXCLUDED.volume_unit,
            packaging_package_name = EXCLUDED.packaging_package_name,
            packaging_package_unit = EXCLUDED.packaging_package_unit,
            packaging_amount_per_package = EXCLUDED.packaging_amount_per_package,
            packaging_box_name = EXCLUDED.packaging_box_name,
            packaging_box_unit = EXCLUDED.packaging_box_unit,
            packaging_amount_per_box = EXCLUDED.packaging_amount_per_box,
            packaging_pallet_name = EXCLUDED.packaging_pallet_name,
            packaging_pallet_unit = EXCLUDED.packaging_pallet_unit,
            packaging_amount_per_pallet = EXCLUDED.packaging_amount_per_pallet,
            updated_at = NOW()
        `);
        imported++;
      } catch (err: any) {
        console.warn(`⚠️ Error importando SKU ${sku}:`, err.message);
        skipped++;
      }
    }

    console.log(`✅ Importación catálogo agrupado: ${imported} importados, ${skipped} omitidos, ${notFound} SKUs no encontrados`);

    res.json({
      message: 'Importación completada',
      imported,
      skipped,
      notFound,
      notFoundSkus,
      total: products.length,
    });
  }));

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
    const { categoria, descripcion, imagenUrl, precio, activo, groupId, variantLabel, isMainVariant, productFamily, color } = req.body;

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
      isMainVariant,
      productFamily,
      color
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
        isMainVariant,
        productFamily,
        color
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

  // Import products from catalog CSV
  app.post('/api/ecommerce/admin/productos/import-catalog', requireAdminOrSupervisor, asyncHandler(async (req: any, res: any) => {
    const { data } = req.body;

    if (!Array.isArray(data) || data.length === 0) {
      return res.status(400).json({ message: 'Se requiere una lista de productos para importar' });
    }

    try {
      const result = await storage.importEcommerceProductsFromCatalogCsv(data);
      res.json({
        success: true,
        productsCreated: result.productsCreated,
        productsUpdated: result.productsUpdated,
        errors: result.errors
      });
    } catch (error: any) {
      console.error('Error importing catalog products:', error);
      throw error;
    }
  }));

  // Clear all ecommerce products
  app.delete('/api/ecommerce/admin/productos/clear-all', requireAdminOrSupervisor, asyncHandler(async (req: any, res: any) => {
    try {
      const result = await storage.clearAllEcommerceProducts();
      res.json({
        success: true,
        deletedCount: result.deletedCount
      });
    } catch (error: any) {
      console.error('Error clearing products:', error);
      throw error;
    }
  }));

  // Bulk assign products to a group
  app.post('/api/ecommerce/admin/productos/bulk-assign', requireAdminOrSupervisor, asyncHandler(async (req: any, res: any) => {
    const { productIds, groupId } = req.body;

    if (!Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({ message: 'Se requiere una lista de productos' });
    }

    if (!groupId) {
      return res.status(400).json({ message: 'Se requiere un grupo destino' });
    }

    try {
      const result = await storage.bulkAssignProductsToGroup(productIds, groupId);
      res.json({ success: true, count: result.count });
    } catch (error: any) {
      console.error('Error in bulk assign:', error);
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
    const { search, categoria, activo, withVariations } = req.query;

    // If withVariations=true, return groups with nested variations
    if (withVariations === 'true') {
      const groupsWithVariations = await storage.getProductGroupsWithVariations();
      return res.json(groupsWithVariations);
    }

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

  // Reassign variation to different group
  app.post('/api/ecommerce/admin/variaciones/:id/reasignar', requireAdminOrSupervisor, asyncHandler(async (req: any, res: any) => {
    const { id: variationId } = req.params;
    const { newGroupId } = req.body;

    if (!variationId) {
      return res.status(400).json({ message: 'variationId es requerido' });
    }

    await storage.reassignVariationToGroup(variationId, newGroupId || null);
    res.json({ message: newGroupId ? 'Variación reasignada correctamente' : 'Variación desagrupada correctamente' });
  }));

  // ===================== Shopify-Style Products API Routes =====================

  // Get all Shopify products with variants
  app.get('/api/shopify/products', requireAdminOrSupervisor, asyncHandler(async (req: any, res: any) => {
    const { search, category, status, productType, limit, offset } = req.query;

    const products = await storage.getShopifyProducts({
      search,
      category,
      status: status as 'draft' | 'active' | 'archived' | undefined,
      productType,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
    });

    res.json(products);
  }));

  // Get single Shopify product with variants
  app.get('/api/shopify/products/:id', requireAdminOrSupervisor, asyncHandler(async (req: any, res: any) => {
    const { id } = req.params;
    const product = await storage.getShopifyProduct(id);

    if (!product) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }

    res.json(product);
  }));

  // Get Shopify product by handle (URL slug)
  app.get('/api/shopify/products/handle/:handle', requireAdminOrSupervisor, asyncHandler(async (req: any, res: any) => {
    const { handle } = req.params;
    const product = await storage.getShopifyProductByHandle(handle);

    if (!product) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }

    res.json(product);
  }));

  // Create new Shopify product
  app.post('/api/shopify/products', requireAdminOrSupervisor, asyncHandler(async (req: any, res: any) => {
    const { insertShopifyProductSchema } = await import('@shared/schema');

    try {
      const validated = insertShopifyProductSchema.parse(req.body);
      const product = await storage.createShopifyProduct(validated);
      res.status(201).json(product);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: 'Datos inválidos', errors: error.errors });
      }
      throw error;
    }
  }));

  // Update Shopify product
  app.patch('/api/shopify/products/:id', requireAdminOrSupervisor, asyncHandler(async (req: any, res: any) => {
    const { id } = req.params;
    const { updateShopifyProductSchema } = await import('@shared/schema');

    try {
      const validated = updateShopifyProductSchema.parse(req.body);
      const updated = await storage.updateShopifyProduct(id, validated);
      res.json(updated);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: 'Datos inválidos', errors: error.errors });
      }
      throw error;
    }
  }));

  // Delete Shopify product
  app.delete('/api/shopify/products/:id', requireAdminOrSupervisor, asyncHandler(async (req: any, res: any) => {
    const { id } = req.params;
    await storage.deleteShopifyProduct(id);
    res.json({ message: 'Producto eliminado correctamente' });
  }));

  // Update Shopify product options
  app.put('/api/shopify/products/:id/options', requireAdminOrSupervisor, asyncHandler(async (req: any, res: any) => {
    const { id } = req.params;
    const { options } = req.body;

    if (!Array.isArray(options)) {
      return res.status(400).json({ message: 'options debe ser un array' });
    }

    const updatedOptions = await storage.updateShopifyProductOptions(id, options);
    res.json(updatedOptions);
  }));

  // Create Shopify product variant
  app.post('/api/shopify/products/:productId/variants', requireAdminOrSupervisor, asyncHandler(async (req: any, res: any) => {
    const { productId } = req.params;
    const { insertShopifyProductVariantSchema } = await import('@shared/schema');

    try {
      const validated = insertShopifyProductVariantSchema.parse({ ...req.body, productId });
      const variant = await storage.createShopifyProductVariant(validated);
      res.status(201).json(variant);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: 'Datos inválidos', errors: error.errors });
      }
      throw error;
    }
  }));

  // Update Shopify product variant
  app.patch('/api/shopify/variants/:id', requireAdminOrSupervisor, asyncHandler(async (req: any, res: any) => {
    const { id } = req.params;
    const { updateShopifyProductVariantSchema } = await import('@shared/schema');

    try {
      const validated = updateShopifyProductVariantSchema.parse(req.body);
      const updated = await storage.updateShopifyProductVariant(id, validated);
      res.json(updated);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: 'Datos inválidos', errors: error.errors });
      }
      throw error;
    }
  }));

  // Delete Shopify product variant
  app.delete('/api/shopify/variants/:id', requireAdminOrSupervisor, asyncHandler(async (req: any, res: any) => {
    const { id } = req.params;
    await storage.deleteShopifyProductVariant(id);
    res.json({ message: 'Variante eliminada correctamente' });
  }));

  // Get variant by SKU
  app.get('/api/shopify/variants/sku/:sku', requireAdminOrSupervisor, asyncHandler(async (req: any, res: any) => {
    const { sku } = req.params;
    const variant = await storage.getShopifyVariantBySku(sku);

    if (!variant) {
      return res.status(404).json({ message: 'Variante no encontrada' });
    }

    res.json(variant);
  }));

  // Import products from CSV (Shopify-style)
  app.post('/api/shopify/products/import', requireAdminOrSupervisor, upload.single('file'), asyncHandler(async (req: any, res: any) => {
    if (!req.file) {
      return res.status(400).json({ message: 'No se proporcionó archivo CSV' });
    }

    const Papa = require('papaparse');
    const csvContent = req.file.buffer.toString('utf-8');
    const parsed = Papa.parse(csvContent, { header: true, skipEmptyLines: true });

    if (parsed.errors.length > 0) {
      return res.status(400).json({
        message: 'Error al parsear CSV',
        errors: parsed.errors.slice(0, 5)
      });
    }

    const result = await storage.importShopifyProductsFromCsv(parsed.data);

    res.json({
      message: `Importación completada: ${result.productsCreated} productos, ${result.variantsCreated} variantes`,
      ...result
    });
  }));

  // Public endpoint for Shopify products (no auth required)
  app.get('/api/public/shopify/products', async (req: any, res: any) => {
    try {
      const products = await storage.getShopifyProductsForPublicCatalog();
      res.json(products);
    } catch (error) {
      console.error('Error fetching public Shopify products:', error);
      res.status(500).json({ message: 'Error al cargar productos' });
    }
  });

  // ===================== End Shopify-Style Products API Routes =====================

  // ===================== End eCommerce Admin API Routes =====================

  // ⚠️ DEPRECATED - Preview CSV endpoint (legacy backup system)
  // This endpoint is DEPRECATED and maintained only as emergency backup.
  // Analyzes legacy salesTransactions table, NOT fact_ventas (ETL).
  app.post('/api/sales/preview', requireAuth, upload.single('file'), async (req, res) => {
    try {
      console.warn('⚠️  DEPRECATED ENDPOINT USED: /api/sales/preview - Este sistema está obsoleto.');

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

      res.set('X-Deprecated-API', 'true');
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
        },
        warning: "⚠️  SISTEMA OBSOLETO: Verifica tabla legacy, NO fact_ventas (ETL)."
      });
    } catch (error) {
      console.error("Error previewing CSV:", error);
      res.status(500).json({ message: "Failed to preview CSV" });
    }
  });

  // ⚠️ DEPRECATED - Atomic Replace Import endpoint (legacy backup system)
  // This endpoint is DEPRECATED and maintained only as emergency backup.
  // Writes to legacy salesTransactions table. Data will NOT appear in dashboards.
  // Primary data source is fact_ventas populated by automated ETL sync from SQL Server.
  app.post('/api/sales/import-replace', requireAuth, upload.single('file'), async (req, res) => {
    try {
      console.warn('⚠️  DEPRECATED ENDPOINT USED: /api/sales/import-replace - Este sistema está obsoleto. Usar ETL automático.');

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

      res.set('X-Deprecated-API', 'true');
      res.set('X-Deprecation-Warning', 'Este endpoint está obsoleto. Los datos NO aparecerán en dashboards. Usar ETL automático.');

      res.json({
        message: "Data replaced successfully",
        deleted: result.deleted,
        inserted: result.inserted,
        dateRange: { start: startDate, end: endDate },
        errors: errors.length > 0 ? errors.slice(0, 5) : undefined,
        warning: "⚠️  SISTEMA OBSOLETO: Datos importados a tabla legacy. NO aparecerán en dashboards que usan fact_ventas (ETL)."
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
          (assignment.assigneeType === "supervisor" && assignment.assigneeId === user.id) ||
          (assignment.assigneeType === "salesperson" && assignment.assigneeId === user.id)
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

      // Admin, supervisor and tecnico_obra can create tasks
      if (user.role !== 'admin' && user.role !== 'supervisor' && user.role !== 'tecnico_obra') {
        return res.status(403).json({ message: "Only administrators, supervisors and technical staff can create tasks" });
      }

      // SECURITY: Use discriminated union validation with assignments
      // Schema for task creation - payload is optional
      const createTaskWithAssignmentsSchema = z.object({
        title: z.string().min(1, "Título es requerido"),
        description: z.string().optional(),
        type: z.enum(["texto", "formulario", "visita"]).default("texto"),
        priority: z.enum(["low", "medium", "high"]).default("medium"),
        dueDate: z.string().refine((date) => {
          if (!date) return true;
          const datetimeLocalRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
          const isoDatetimeRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;
          return datetimeLocalRegex.test(date) || isoDatetimeRegex.test(date) || !isNaN(Date.parse(date));
        }, "Fecha debe ser formato válido").optional().or(z.null()),
        segmento: z.string().optional(),
        payload: z.any().optional(), // Optional payload - will use defaults if not provided
        assignments: z.array(z.object({
          assigneeType: z.enum(["supervisor", "salesperson"]),
          assigneeId: z.string().min(1, "Destinatario requerido"),
        })).min(1, "Debe asignar al menos un destinatario"),
      });

      // Validate request body
      const validation = createTaskWithAssignmentsSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          message: "Invalid task data",
          errors: validation.error.issues
        });
      }

      const { title, description, type, dueDate, priority, payload, assignments, segmento } = validation.data;

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
        segmento,
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
  // Task Comments - Sistema de comentarios en hilo
  // ==================================================================================

  // Get comments for an assignment
  app.get('/api/tasks/:taskId/assignments/:assignmentId/comments', requireAuth, async (req: any, res) => {
    try {
      const { assignmentId } = req.params;
      const comments = await storage.getTaskComments(assignmentId);
      res.json(comments);
    } catch (error) {
      console.error("Error fetching comments:", error);
      res.status(500).json({ message: "Failed to fetch comments" });
    }
  });

  // Add a comment to an assignment
  app.post('/api/tasks/:taskId/assignments/:assignmentId/comments', requireAuth, async (req: any, res) => {
    try {
      const { taskId, assignmentId } = req.params;
      const user = req.user;
      const { content } = req.body;

      if (!content || content.trim() === '') {
        return res.status(400).json({ message: "El comentario no puede estar vacío" });
      }

      const task = await storage.getTask(taskId);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }

      const assignment = task.assignments.find(a => a.id === assignmentId);
      if (!assignment) {
        return res.status(404).json({ message: "Assignment not found" });
      }

      // Determine author name
      const authorName = user.name || user.fullName || user.email || 'Usuario';

      const comment = await storage.addTaskComment({
        assignmentId,
        authorId: user.id,
        authorName,
        content: content.trim()
      });

      res.status(201).json(comment);
    } catch (error) {
      console.error("Error adding comment:", error);
      res.status(500).json({ message: "Failed to add comment" });
    }
  });

  // Delete a comment (only author can delete)
  app.delete('/api/tasks/:taskId/assignments/:assignmentId/comments/:commentId', requireAuth, async (req: any, res) => {
    try {
      const { commentId } = req.params;
      const user = req.user;

      await storage.deleteTaskComment(commentId, user.id);
      res.json({ message: "Comment deleted successfully" });
    } catch (error) {
      console.error("Error deleting comment:", error);
      res.status(500).json({ message: "Failed to delete comment" });
    }
  });

  // ==================================================================================
  // Users endpoint for CRM
  // ==================================================================================

  // Get all users (for dropdowns like salesperson assignment)
  app.get('/api/users', requireCommercialAccess, async (req: any, res) => {
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
  app.get('/api/users/clients/search', requireCommercialAccess, async (req: any, res) => {
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
      const { status, clientName, createdBy, dateFrom, dateTo, limit = 50, offset = 0 } = req.query;

      const filters: any = {
        limit: Math.min(parseInt(limit) || 500, 500),
        offset: parseInt(offset) || 0,
      };

      // Add filters based on role and user permissions
      if (user.role === 'salesperson') {
        filters.createdBy = user.id;
      } else if (createdBy) {
        filters.createdBy = createdBy;
      }

      if (status) {
        filters.status = status;
      }

      if (clientName) {
        filters.clientName = clientName;
      }

      if (dateFrom) {
        filters.dateFrom = dateFrom;
      }

      if (dateTo) {
        filters.dateTo = dateTo;
      }

      const quotes = await storage.getQuotes(filters);
      res.json(quotes);
    } catch (error) {
      console.error("Error fetching quotes:", error);
      res.status(500).json({ message: "Failed to fetch quotes" });
    }
  });

  // Get unique quote creators for filter dropdown
  app.get('/api/quotes/creators', requireAuth, async (req: any, res) => {
    try {
      const creators = await storage.getQuoteCreators();
      res.json(creators);
    } catch (error) {
      console.error("Error fetching quote creators:", error);
      res.status(500).json({ message: "Failed to fetch quote creators" });
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

      // Debug: Log incoming productUnit
      console.log('[QUOTE-ITEM] Creating item with productUnit:', req.body.productUnit, '| Full body:', JSON.stringify(req.body));

      const itemData = insertQuoteItemSchema.parse({
        ...req.body,
        quoteId
      });

      // Debug: Log parsed itemData
      console.log('[QUOTE-ITEM] Parsed itemData productUnit:', (itemData as any).productUnit);

      const item = await storage.createQuoteItem(itemData);

      // Debug: Log saved item
      console.log('[QUOTE-ITEM] Saved item productUnit:', item.productUnit);

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

  // Serve printable quote PDF page
  app.get('/api/quotes/:id/pdf', requireAuth, async (req: any, res) => {
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

      const items = (quote as any).items || [];

      // Format helpers
      const escHtml = (s: string | null | undefined) => {
        if (!s) return '';
        return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      };
      const fmtCLP = (n: number) => `$${Math.round(n).toLocaleString('es-CL').replace(/,/g, '.')}`;
      const quoteDate = new Date(quote.createdAt || new Date()).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });

      const subtotal = parseFloat(quote.subtotal || "0");
      const tax = parseFloat(quote.taxAmount || "0");
      const total = parseFloat(quote.total || "0");

      const productRows = items.map((item: any) => {
        const unitPrice = parseFloat(item.unitPrice || "0");
        const lineTotal = parseFloat(item.totalPrice || String(unitPrice * parseFloat(item.quantity || "1")));
        return `<tr>
          <td><div style="font-weight:600">${escHtml(item.productName)}</div>
          ${item.productCode ? `<div style="color:#6b7280;font-size:11px">SKU: ${escHtml(item.productCode)}</div>` : ''}</td>
          <td style="text-align:center">${escHtml(item.productUnit) || 'UN'}</td>
          <td style="text-align:center">${parseFloat(item.quantity || "1")}</td>
          <td style="text-align:right">${fmtCLP(unitPrice)}</td>
          <td style="text-align:right;color:#fd6301;font-weight:600">${fmtCLP(lineTotal)}</td>
        </tr>`;
      }).join('');

      const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Cotización ${escHtml(quote.quoteNumber)}</title>
<style>
  @page { size: A4; margin: 15mm; }
  body { font-family: Arial, sans-serif; margin: 0; padding: 20px; color: #333; font-size: 14px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; border-bottom: 2px solid #fd6301; padding-bottom: 15px; }
  .header h1 { color: #fd6301; margin: 0; font-size: 24px; }
  .header-info { font-size: 13px; color: #374151; margin-top: 8px; }
  .header-info p { margin: 4px 0; }
  .section { margin-bottom: 15px; }
  .section h3 { color: #fd6301; margin: 0 0 10px 0; font-size: 16px; }
  .client-info { background: #fff7ed; border: 1px solid #fdba74; padding: 12px; border-radius: 6px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 13px; }
  .client-info p { margin: 0 0 8px 0; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 13px; }
  th { background: linear-gradient(to right, #fd6301, #e55100); color: white; padding: 8px; text-align: left; font-size: 12px; }
  td { padding: 8px; border-bottom: 1px solid #e5e7eb; }
  .totals { background: #f8fafc; border: 1px solid #e2e8f0; padding: 15px; border-radius: 6px; margin-bottom: 15px; }
  .total-row { display: flex; justify-content: space-between; margin: 6px 0; font-size: 14px; }
  .total-row span:first-child { color: #374151; font-weight: 500; }
  .total-row span:last-child { font-weight: 600; }
  .final-total { font-size: 16px; font-weight: bold; border-top: 2px solid #e2e8f0; padding-top: 10px; margin-top: 8px; }
  .final-total span:last-child { color: #fd6301; }
  .terms { background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 6px; margin-bottom: 15px; }
  .terms h4 { margin: 0 0 8px 0; font-size: 14px; color: #374151; }
  .terms ul { margin: 0; padding-left: 16px; font-size: 12px; color: #6b7280; }
  .terms li { margin-bottom: 4px; }
  .payment-info { background: #fff7ed; border: 1px solid #fdba74; padding: 12px; border-radius: 6px; font-size: 12px; }
  .payment-info h4 { color: #ea580c; margin: 0 0 10px 0; font-size: 14px; }
  .payment-info p { margin: 0 0 8px 0; }
  .payment-info a { color: #2563eb; }
  .no-print { margin-top: 20px; text-align: center; }
  @media print { .no-print { display: none; } body { padding: 0; } }
</style></head><body>
<div>
  <div class="header">
    <div><img src="/panoramica-logo.png" alt="Panorámica" style="width:220px;height:auto" /></div>
    <div style="text-align:right">
      <h1>COTIZACIÓN</h1>
      <div class="header-info">
        <p><strong>Fecha:</strong> ${quoteDate}</p>
        <p><strong>Cotización N°:</strong> ${escHtml(quote.quoteNumber)}</p>
      </div>
    </div>
  </div>
  <div class="section">
    <h3>Información del Cliente</h3>
    <div class="client-info">
      <p><strong>RUT:</strong> ${escHtml(quote.clientRut) || 'No especificado'}</p>
      <p><strong>Cliente:</strong> ${escHtml(quote.clientName)}</p>
      <p><strong>Email:</strong> ${escHtml(quote.clientEmail) || 'No especificado'}</p>
      <p><strong>Teléfono:</strong> ${escHtml(quote.clientPhone) || 'No especificado'}</p>
      <p><strong>Dirección:</strong> ${escHtml(quote.clientAddress) || 'No especificada'}</p>
      <p><strong>Ubicación:</strong> Chile</p>
      ${quote.notes ? `<div style="grid-column:1/-1;margin-top:8px;padding-top:8px;border-top:1px solid #fdba74"><p><strong>Observaciones:</strong> ${escHtml(quote.notes)}</p></div>` : ''}
    </div>
  </div>
  <div class="section">
    <h3>Detalle de Productos</h3>
    <table><thead><tr>
      <th>Producto</th><th style="text-align:center">Unidad</th><th style="text-align:center">Cant.</th><th style="text-align:right">Precio</th><th style="text-align:right">Total</th>
    </tr></thead><tbody>${productRows}</tbody></table>
  </div>
  <div class="section">
    <div class="totals">
      <div class="total-row"><span>Subtotal:</span><span>${fmtCLP(subtotal)}</span></div>
      <div class="total-row"><span>IVA (19%):</span><span>${fmtCLP(tax)}</span></div>
      <div class="total-row final-total"><span>Total Final:</span><span>${fmtCLP(total)}</span></div>
    </div>
  </div>
  <div class="section">
    <div class="terms"><h4>Términos y Condiciones</h4><ul>
      <li>Precios válidos por 7 días hábiles desde la emisión de esta cotización.</li>
      <li>Todos los precios están expresados en pesos chilenos (CLP) e incluyen IVA.</li>
      <li>Los productos están sujetos a disponibilidad de stock.</li>
      <li>Condiciones de pago: según acuerdo comercial.</li>
    </ul></div>
  </div>
  <div class="section">
    <div class="payment-info"><h4>Información de Pagos</h4>
      <p><strong>Link de pagos con tarjetas:</strong><br><a href="https://micrositios.getnet.cl/pinturaspanoramica">https://micrositios.getnet.cl/pinturaspanoramica</a></p>
      <p><strong>Pagos con transferencia dirigirlos a:</strong><br>Pintureria Panoramica Limitada<br>RUT: 78.652.260-9<br>Cuenta Corriente Banco Santander: 2592916-0<br>Email: <a href="mailto:contacto@pinturaspanoramica.cl">contacto@pinturaspanoramica.cl</a></p>
    </div>
  </div>
</div>
<div class="no-print">
  <button onclick="window.print()" style="padding:10px 20px;background:#fd6301;color:white;border:none;border-radius:5px;cursor:pointer;font-weight:600;font-size:14px">
    Imprimir / Descargar PDF
  </button>
</div>
</body></html>`;

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(html);
    } catch (error) {
      console.error("Error generating quote PDF:", error);
      res.status(500).json({ message: "Failed to generate quote PDF" });
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

      // Validate and clamp pagination parameters (allow up to 10000 for bulk operations like reception file export)
      const validatedLimit = Math.min(Math.max(parseInt(limit as string) || 50, 1), 10000);
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

  // Segment Prices endpoints
  app.get('/api/segment-prices/:segment', requireAuth, async (req, res) => {
    try {
      const { segment } = req.params;
      const prices = await storage.getSegmentPrices(segment);
      res.json(prices);
    } catch (error) {
      console.error("Error fetching segment prices:", error);
      res.status(500).json({ message: "Failed to fetch segment prices" });
    }
  });

  app.post('/api/segment-prices/import', upload.single('file'), requireAuth, async (req: any, res) => {
    try {
      const { segment } = req.body;
      if (!segment) {
        return res.status(400).json({ message: "Segment code is required" });
      }

      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const csvData = req.file.buffer.toString('utf8');
      const { data: rawData, errors: parseErrors } = Papa.parse(csvData, {
        header: true,
        skipEmptyLines: 'greedy'
      });

      if (parseErrors.length > 0) {
        return res.status(400).json({ message: "CSV parsing error", errors: parseErrors });
      }

      const results = [];
      for (const row of rawData as any[]) {
        if (!row.codigo || !row.precioPromedio) continue;

        const item = {
          segmentCode: segment,
          codigo: row.codigo,
          producto: row.producto || '',
          precioPromedio: row.precioPromedio.toString().replace(',', '.'),
          unidad: row.unidad || '',
          updatedBy: req.user.username
        };

        results.push(await storage.upsertSegmentPrice(item));
      }

      res.json({ message: `Imported ${results.length} prices for segment ${segment}`, count: results.length });
    } catch (error) {
      console.error("Error importing segment prices:", error);
      res.status(500).json({ message: "Failed to import segment prices" });
    }
  });

  // Product Content (Fichas Técnicas) endpoints
  app.get('/api/product-content/:codigo', requireAuth, async (req, res) => {
    try {
      const { codigo } = req.params;
      const content = await storage.getProductContent(codigo);
      res.json(content || { codigo, fichasTecnicas: [], hojasSeguridad: [] });
    } catch (error) {
      console.error("Error fetching product content:", error);
      res.status(500).json({ message: "Failed to fetch product content" });
    }
  });

  app.put('/api/product-content/:codigo', requireAuth, async (req: any, res) => {
    try {
      const { codigo } = req.params;
      const user = req.user;
      const data = { ...req.body, codigo, updatedBy: user.username };
      const result = await storage.upsertProductContent(data);
      res.json(result);
    } catch (error) {
      console.error("Error updating product content:", error);
      res.status(500).json({ message: "Failed to update product content" });
    }
  });

  // Inventory by product SKU (for cross-reference in the catalog)
  app.get('/api/inventory/by-product/:sku', requireAuth, async (req, res) => {
    try {
      const { sku } = req.params;
      const stock = await storage.getInventoryByProduct(sku);
      res.json(stock);
    } catch (error) {
      console.error("Error fetching inventory by product:", error);
      res.status(500).json({ message: "Failed to fetch inventory for product" });
    }
  });

  // Product Questions (AI feedback loop)
  app.get('/api/product-questions/:codigo', requireAuth, async (req, res) => {
    try {
      const { codigo } = req.params;
      const questions = await storage.getProductQuestions(codigo);
      res.json(questions);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch product questions" });
    }
  });

  app.post('/api/product-questions', requireAuth, async (req, res) => {
    try {
      const { codigo, pregunta, contexto } = req.body;
      if (!codigo || !pregunta) return res.status(400).json({ message: "codigo and pregunta required" });
      const question = await storage.logProductQuestion({ codigo, pregunta, contexto });
      res.json(question);
    } catch (error) {
      res.status(500).json({ message: "Failed to log product question" });
    }
  });

  app.put('/api/product-questions/:id/resolve', requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const updated = await storage.resolveProductQuestion(id, req.user.username);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Failed to resolve product question" });
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

  // Serve public objects from Object Storage with local fallback
  app.get("/public-objects/:filePath(*)", asyncHandler(async (req: any, res: any) => {
    const filePath = req.params.filePath;
    const objectStorageService = new ObjectStorageService();
    const wantsDownload = req.query.download === 'true';

    try {
      // First try Object Storage
      const file = await objectStorageService.searchPublicObject(filePath);
      if (file) {
        // Get metadata to check content type
        const [metadata] = await file.getMetadata();
        const contentType = metadata.contentType || 'application/octet-stream';

        // Set Content-Type header
        res.setHeader('Content-Type', contentType);

        // Set Content-Disposition for download if requested
        if (wantsDownload) {
          const fileName = filePath.split('/').pop() || 'download';
          res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        } else {
          res.setHeader('Content-Disposition', 'inline');
        }

        // Stream the file
        const stream = file.createReadStream();
        stream.on('error', (err) => {
          console.error('Stream error:', err);
          if (!res.headersSent) res.status(500).json({ error: 'Error streaming file' });
        });
        return stream.pipe(res);
      }
    } catch (error) {
      console.warn("Object Storage search failed, trying local fallback:", error);
    }

    // Fallback to local file system for product images
    if (filePath.startsWith('product-images/')) {
      const localPath = path.join(process.cwd(), 'public', filePath);
      try {
        const fs = await import('fs/promises');
        await fs.access(localPath);

        // Set Content-Type based on extension
        const ext = path.extname(filePath).toLowerCase();
        const contentTypes: Record<string, string> = {
          '.pdf': 'application/pdf', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
          '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp',
        };
        const contentType = contentTypes[ext] || 'application/octet-stream';
        res.setHeader('Content-Type', contentType);

        if (wantsDownload) {
          const fileName = filePath.split('/').pop() || 'download';
          res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        } else {
          res.setHeader('Content-Disposition', 'inline');
        }

        return res.sendFile(localPath);
      } catch {
        // File doesn't exist locally either
      }
    }

    return res.status(404).json({ error: "File not found" });
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
  //
  // ⚠️ ARCHITECTURE NOTE (December 2025):
  // The NVV system now uses ETL-based data from nvv.fact_nvv.
  //
  // CURRENT (ACTIVE) endpoints - use nvv.fact_nvv from ETL:
  //   - GET /api/nvv/pending
  //   - GET /api/nvv/total
  //   - GET /api/nvv/metrics
  //   - GET /api/nvv/dashboard
  //   - GET /api/nvv/by-salesperson/:salesperson
  //   - GET /api/nvv/etl/status (ETL management)
  //   - POST /api/nvv/etl/run (ETL trigger)
  //
  // DEPRECATED endpoints - use nvv_pending_sales table (CSV import):
  //   - POST /api/nvv/import - DEPRECATED
  //   - DELETE /api/nvv/clear-all - DEPRECATED
  //   - DELETE /api/nvv/batch/:batchId - DEPRECATED
  //
  // See: server/etl-nvv.ts for the current ETL implementation
  // ==============================================

  /**
   * @deprecated This endpoint is DEPRECATED. NVV data is now loaded via automated ETL.
   * See /api/nvv/etl/run for triggering the current ETL process.
   */
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

  /**
   * @deprecated This endpoint is DEPRECATED. It operates on the deprecated nvv_pending_sales table.
   * NVV data is now managed via ETL which handles its own cleanup through full synchronization.
   */
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

  // Get NVV total summary without date filters (supports segment filter)
  app.get('/api/nvv/total', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const { salesperson, segment } = req.query;
      const options: { salesperson?: string; segment?: string } = {};

      if (salesperson) options.salesperson = salesperson as string;
      if (segment) options.segment = segment as string;

      const totalSummary = await storage.getNvvTotalSummary(options);
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
    const { salesperson, segment, client, startDate, endDate, period, filterType } = req.query;

    // Use same date range logic as sales metrics
    const dateRange = getDateRange(period as string, filterType as string);

    const options: any = {};
    if (salesperson) options.salesperson = salesperson;
    if (segment) options.segment = segment;
    if (client) options.client = client;

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

  /**
   * @deprecated This endpoint is DEPRECATED. It operates on the deprecated nvv_pending_sales table.
   * NVV batch management is now handled by ETL through full synchronization.
   */
  app.delete('/api/nvv/batch/:batchId', requireAuth, asyncHandler(async (req: any, res: any) => {
    const { batchId } = req.params;

    const success = await storage.deleteNvvBatch(batchId);

    if (success) {
      res.json({ success: true, message: 'Lote eliminado' });
    } else {
      res.status(404).json({ message: 'Lote no encontrado' });
    }
  }));

  // Get salesperson mapping endpoint - using ETL fact_ventas
  app.get('/api/sales-transactions/salesperson-mapping', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      // Get unique salesperson mapping from ETL fact_ventas
      const salespersonResults = await db
        .selectDistinct({
          kofulido: factVentas.kofudo,
          nokofu: factVentas.nokofu,
        })
        .from(factVentas)
        .where(
          and(
            isNotNull(factVentas.kofudo),
            isNotNull(factVentas.nokofu),
            ne(factVentas.kofudo, ''),
            ne(factVentas.nokofu, '')
          )
        );

      // Create mapping object
      const kofulidoToName: Record<string, string> = {};
      salespersonResults.forEach(result => {
        if (result.kofulido && result.nokofu) {
          kofulidoToName[result.kofulido] = result.nokofu;
        }
      });

      // Get unique segments from ETL fact_ventas
      const segmentResults = await db
        .selectDistinct({
          segment: factVentas.noruen,
        })
        .from(factVentas)
        .where(
          and(
            isNotNull(factVentas.noruen),
            ne(factVentas.noruen, '')
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

      // Get mapping from salesperson (kofudo) to segment (noruen)
      const salespersonSegmentResults = await db
        .selectDistinct({
          kofulido: factVentas.kofudo,
          noruen: factVentas.noruen,
        })
        .from(factVentas)
        .where(
          and(
            isNotNull(factVentas.kofudo),
            isNotNull(factVentas.noruen),
            ne(factVentas.kofudo, ''),
            ne(factVentas.noruen, '')
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

  // Get NVV salesperson mapping from fact_nvv table
  // This endpoint provides the correct mapping for NVV data (KOFULIDO -> name and segment)
  app.get('/api/nvv/salesperson-mapping', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      // Get unique salesperson mapping from fact_nvv (NVV ETL data)
      const salespersonResults = await db.execute(sql`
        SELECT DISTINCT kofulido, nombre_vendedor
        FROM nvv.fact_nvv 
        WHERE kofulido IS NOT NULL 
          AND kofulido != ''
          AND nombre_vendedor IS NOT NULL
          AND nombre_vendedor != ''
      `);

      // Create mapping object: kofulido -> nombre_vendedor
      const kofulidoToName: Record<string, string> = {};
      salespersonResults.rows.forEach((result: any) => {
        if (result.kofulido && result.nombre_vendedor) {
          kofulidoToName[result.kofulido.trim()] = result.nombre_vendedor.trim();
        }
      });

      // Get mapping from kofulido to segment from fact_nvv
      const segmentResults = await db.execute(sql`
        SELECT DISTINCT kofulido, nombre_segmento_cliente
        FROM nvv.fact_nvv 
        WHERE kofulido IS NOT NULL 
          AND kofulido != ''
          AND nombre_segmento_cliente IS NOT NULL
          AND nombre_segmento_cliente != ''
      `);

      // Create mapping: kofulido -> primary segment (first non-empty segment found)
      const kofulidoToSegment: Record<string, string> = {};
      segmentResults.rows.forEach((result: any) => {
        if (result.kofulido && result.nombre_segmento_cliente) {
          const code = result.kofulido.trim();
          // Only set if not already set (keep first match)
          if (!kofulidoToSegment[code]) {
            kofulidoToSegment[code] = result.nombre_segmento_cliente.trim();
          }
        }
      });

      // Get unique segments
      const uniqueSegmentsResult = await db.execute(sql`
        SELECT DISTINCT nombre_segmento_cliente 
        FROM nvv.fact_nvv 
        WHERE nombre_segmento_cliente IS NOT NULL 
          AND nombre_segmento_cliente != ''
        ORDER BY nombre_segmento_cliente
      `);

      const segments: string[] = uniqueSegmentsResult.rows
        .map((r: any) => r.nombre_segmento_cliente?.trim())
        .filter((s: string) => s);

      res.json({
        kofulidoToName,
        kofulidoToSegment,
        segments
      });
    } catch (error: any) {
      console.error('Error fetching NVV salesperson mapping:', error);
      res.status(500).json({ message: 'Failed to fetch NVV salesperson mapping' });
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

  // Get NVV by segment
  // Uses line-level vendor code (kofulido) from factVentas to map NVV to segments
  // This ensures correct mapping since nvvPendingSales.KOFULIDO stores the line-level vendor
  app.get('/api/nvv/by-segment', requireAuth, asyncHandler(async (req: any, res: any) => {
    const { segment } = req.query;

    if (!segment) {
      return res.status(400).json({ message: 'Segment parameter is required' });
    }

    // Delegate to storage layer which uses factVentas.kofulido (line-level vendor)
    // to correctly match against nvvPendingSales.KOFULIDO
    const nvvData = await storage.getNvvBySegment({
      segment: segment as string
    });

    res.json(nvvData);
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
    const { period, filterType, segment, salesperson } = req.query;

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
      endDate,
      segment: segment as string | undefined,
      salesperson: salesperson as string | undefined
    });

    res.json(nvvData);
  }));

  // Get NVV for a specific salesperson
  app.get('/api/nvv/salesperson/:name', requireAuth, asyncHandler(async (req: any, res: any) => {
    const salespersonName = decodeURIComponent(req.params.name);
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

    const nvvData = await storage.getSalespersonNvv(salespersonName, {
      startDate,
      endDate
    });

    if (!nvvData) {
      return res.status(404).json({ error: 'Vendedor no encontrado o sin NVV pendientes' });
    }

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
  // EMAIL NOTIFICATION SETTINGS ENDPOINTS
  // ==============================================

  // Get all email notification settings
  app.get('/api/admin/email-notification-settings', requireAdminOrSupervisor, asyncHandler(async (req: any, res: any) => {
    try {
      const settings = await db.select().from(emailNotificationSettings).orderBy(emailNotificationSettings.displayName);
      res.json(settings);
    } catch (error: any) {
      console.error('❌ Error al obtener configuraciones de notificación:', error);
      res.status(500).json({ message: 'Error al obtener configuraciones', error: error.message });
    }
  }));

  // Get SMTP status (from database)
  app.get('/api/admin/smtp-status', requireAdminOrSupervisor, asyncHandler(async (req: any, res: any) => {
    try {
      const configs = await db.select().from(smtpConfig).where(eq(smtpConfig.id, 'default'));
      const config = configs[0];

      if (config && config.email && config.password) {
        res.json({
          configured: true,
          host: config.host,
          user: config.email,
          fromName: config.fromName
        });
      } else {
        res.json({
          configured: false,
          host: 'No configurado',
          user: 'No configurado'
        });
      }
    } catch (error: any) {
      res.json({
        configured: false,
        host: 'No configurado',
        user: 'No configurado'
      });
    }
  }));

  // Get SMTP config (for editing)
  app.get('/api/admin/smtp-config', requireAdminOrSupervisor, asyncHandler(async (req: any, res: any) => {
    try {
      const configs = await db.select().from(smtpConfig).where(eq(smtpConfig.id, 'default'));
      if (configs.length > 0) {
        const config = configs[0];
        res.json({
          host: config.host,
          port: config.port,
          email: config.email,
          password: config.password ? '••••••••' : '',
          fromName: config.fromName,
          hasPassword: !!config.password
        });
      } else {
        res.json({
          host: 'smtp.gmail.com',
          port: 587,
          email: '',
          password: '',
          fromName: 'Panoramica',
          hasPassword: false
        });
      }
    } catch (error: any) {
      console.error('❌ Error al obtener configuración SMTP:', error);
      res.status(500).json({ message: 'Error al obtener configuración', error: error.message });
    }
  }));

  // Update SMTP config
  app.post('/api/admin/smtp-config', requireAdminOrSupervisor, asyncHandler(async (req: any, res: any) => {
    try {
      const { host, port, email, password, fromName } = req.body;

      if (!email) {
        return res.status(400).json({ message: 'El email es requerido' });
      }

      const existingConfigs = await db.select().from(smtpConfig).where(eq(smtpConfig.id, 'default'));

      if (existingConfigs.length > 0) {
        const updateData: any = {
          host: host || 'smtp.gmail.com',
          port: port || 587,
          email,
          fromName: fromName || 'Panoramica',
          updatedAt: new Date()
        };
        if (password && password !== '••••••••') {
          updateData.password = password;
        }
        await db.update(smtpConfig).set(updateData).where(eq(smtpConfig.id, 'default'));
      } else {
        await db.insert(smtpConfig).values({
          id: 'default',
          host: host || 'smtp.gmail.com',
          port: port || 587,
          email,
          password: password || '',
          fromName: fromName || 'Panoramica'
        });
      }

      res.json({ success: true, message: 'Configuración guardada correctamente' });
    } catch (error: any) {
      console.error('❌ Error al guardar configuración SMTP:', error);
      res.status(500).json({ message: 'Error al guardar configuración', error: error.message });
    }
  }));

  // Get email logs
  app.get('/api/admin/email-logs', requireAdminOrSupervisor, asyncHandler(async (req: any, res: any) => {
    try {
      const logs = await db.select()
        .from(emailLogs)
        .orderBy(desc(emailLogs.createdAt))
        .limit(100);
      res.json(logs);
    } catch (error: any) {
      console.error('❌ Error al obtener historial de correos:', error);
      res.status(500).json({ message: 'Error al obtener historial de correos', error: error.message });
    }
  }));

  // Test SMTP connection (using database config or Gmail OAuth)
  app.post('/api/admin/smtp-test', requireAdminOrSupervisor, asyncHandler(async (req: any, res: any) => {
    const { testEmail } = req.body;

    try {
      console.log('[SMTP-TEST] Starting connection test...');
      const configs = await db.select().from(smtpConfig).where(eq(smtpConfig.id, 'default'));
      const config = configs[0];

      console.log('[SMTP-TEST] Config found:', config ? {
        authMethod: config.authMethod,
        hasRefreshToken: !!config.oauthRefreshToken,
        email: config.oauthEmail || config.email
      } : 'No config');

      // Check if Gmail OAuth is configured
      if (config?.authMethod === 'oauth' && config?.oauthRefreshToken) {
        console.log('[SMTP-TEST] Using OAuth mode');
        // Use the new testConnection function
        const result = await testConnection(testEmail || undefined);
        console.log('[SMTP-TEST] testConnection result:', result);

        if (result.success && testEmail) {
          // Log the test email
          await db.insert(emailLogs).values({
            recipient: testEmail,
            subject: 'Prueba de conexión Gmail - Panoramica',
            notificationType: 'test',
            status: 'sent',
            sentAt: new Date(),
          });
        }

        if (result.success) {
          return res.json({
            success: true,
            message: result.message,
            details: result.details
          });
        } else {
          return res.status(400).json({
            success: false,
            message: result.message,
            details: result.details
          });
        }
      }

      // Fallback to traditional SMTP
      console.log('[SMTP-TEST] No OAuth config, checking SMTP fallback');
      if (!config || !config.email || !config.password) {
        console.log('[SMTP-TEST] No SMTP config available');
        return res.status(400).json({
          success: false,
          message: 'SMTP no configurado. Guarda la configuración primero o conecta Gmail OAuth.'
        });
      }

      const nodemailer = await import('nodemailer');
      const transporter = nodemailer.default.createTransport({
        host: config.host,
        port: config.port,
        secure: config.port === 465,
        auth: {
          user: config.email,
          pass: config.password,
        },
        tls: {
          rejectUnauthorized: false,
        },
      });

      // Verify connection
      await transporter.verify();

      // Send test email if provided
      if (testEmail) {
        const fromAddress = config.fromName
          ? `"${config.fromName}" <${config.email}>`
          : config.email;

        await transporter.sendMail({
          from: fromAddress,
          to: testEmail,
          subject: '🧪 Correo de Prueba - Panoramica',
          html: wrapEmailContent(`
            <h2 style="color: #1a1f2e; margin: 0 0 20px 0; font-family: Arial, sans-serif;">¡Conexión Exitosa!</h2>
            <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 0 0 15px 0;">
              Este es un correo de prueba enviado desde el sistema Panoramica.
            </p>
            <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
              Tu configuración de SMTP está funcionando correctamente.
            </p>
            <div style="background-color: #e8f5e9; border-left: 4px solid #4caf50; padding: 15px; border-radius: 4px; margin: 20px 0;">
              <p style="color: #2e7d32; margin: 0; font-size: 14px;">
                ✓ Servidor SMTP conectado correctamente
              </p>
            </div>
            <p style="color: #666; font-size: 12px; margin: 20px 0 0 0;">
              Enviado el ${format(new Date(), "dd/MM/yyyy HH:mm")}
            </p>
          `),
        });

        // Log the test email
        await db.insert(emailLogs).values({
          recipient: testEmail,
          subject: '🧪 Correo de Prueba - Panoramica',
          notificationType: 'test',
          status: 'sent',
          sentAt: new Date(),
        });
      }

      res.json({
        success: true,
        message: testEmail
          ? `Conexión exitosa. Correo de prueba enviado a ${testEmail}`
          : 'Conexión SMTP verificada exitosamente'
      });
    } catch (error: any) {
      console.error('❌ Error en prueba SMTP:', error);
      res.status(400).json({
        success: false,
        message: `Error de conexión: ${error.message}`
      });
    }
  }));

  // Google OAuth routes for Gmail
  app.get('/api/oauth/google/authorize', requireAdminOrSupervisor, asyncHandler(async (req: any, res: any) => {
    try {
      if (!isOAuthConfigured()) {
        return res.status(400).json({
          success: false,
          message: 'Google OAuth no está configurado en el servidor'
        });
      }

      const { url: authUrl, state } = getAuthUrl();
      res.json({ authUrl });
    } catch (error: any) {
      console.error('❌ Error generando URL OAuth:', error);
      res.status(500).json({
        success: false,
        message: `Error: ${error.message}`
      });
    }
  }));

  app.get('/api/oauth/google/callback', asyncHandler(async (req: any, res: any) => {
    try {
      const { code, error, state } = req.query;

      if (error) {
        return res.redirect('/admin?tab=correos&oauth=error&message=' + encodeURIComponent(error));
      }

      if (!code) {
        return res.redirect('/admin?tab=correos&oauth=error&message=No+se+recibió+código+de+autorización');
      }

      // Validate state token for CSRF protection
      if (!state || !validateStateToken(state as string)) {
        console.error('❌ OAuth callback: Invalid or missing state token');
        return res.redirect('/admin?tab=correos&oauth=error&message=Token+de+seguridad+inválido.+Intenta+nuevamente.');
      }

      const result = await handleCallback(code as string);

      res.redirect('/admin?tab=correos&oauth=success&email=' + encodeURIComponent(result.email));
    } catch (error: any) {
      console.error('❌ Error en callback OAuth:', error);
      res.redirect('/admin?tab=correos&oauth=error&message=' + encodeURIComponent(error.message));
    }
  }));

  app.get('/api/oauth/google/status', requireAdminOrSupervisor, asyncHandler(async (req: any, res: any) => {
    try {
      const status = await getConnectionStatus();
      res.json(status);
    } catch (error: any) {
      console.error('❌ Error obteniendo estado OAuth:', error);
      res.status(500).json({
        success: false,
        message: `Error: ${error.message}`
      });
    }
  }));

  app.post('/api/oauth/google/disconnect', requireAdminOrSupervisor, asyncHandler(async (req: any, res: any) => {
    try {
      await disconnectGmail();
      res.json({ success: true, message: 'Gmail desvinculado correctamente' });
    } catch (error: any) {
      console.error('❌ Error desvinculando Gmail:', error);
      res.status(500).json({
        success: false,
        message: `Error: ${error.message}`
      });
    }
  }));

  // Initialize default notification settings
  app.post('/api/admin/email-notification-settings/initialize', requireAdminOrSupervisor, asyncHandler(async (req: any, res: any) => {
    try {
      const defaultSettings = [
        { notificationType: 'pedido_nuevo', displayName: 'Pedido Nuevo', description: 'Notificar cuando se crea un nuevo pedido de cliente', enabled: false },
        { notificationType: 'reclamo_nuevo', displayName: 'Reclamo Nuevo', description: 'Notificar cuando se registra un nuevo reclamo', enabled: false },
        { notificationType: 'cotizacion_convertida', displayName: 'Cotización Convertida', description: 'Notificar cuando una cotización se convierte en pedido', enabled: false },
        { notificationType: 'stock_bajo', displayName: 'Stock Bajo', description: 'Alertar cuando el inventario está bajo el mínimo', enabled: false },
        { notificationType: 'tarea_asignada', displayName: 'Tarea Asignada', description: 'Notificar cuando se asigna una tarea a un usuario', enabled: false },
        { notificationType: 'alerta_inactividad', displayName: 'Alerta de Inactividad', description: 'Notificar sobre clientes sin compras recientes', enabled: false },
        { notificationType: 'visita_tecnica', displayName: 'Visita Técnica Programada', description: 'Notificar sobre nuevas visitas técnicas', enabled: false },
        { notificationType: 'mantencion_preventiva', displayName: 'Mantención Preventiva', description: 'Alertar sobre mantenciones programadas', enabled: false },
        { notificationType: 'reporte_diario_ventas', displayName: 'Reporte Diario de Ventas', description: 'Enviar resumen de ventas del día a las 17:30 (solo supervisores y administradores)', enabled: false },
      ];

      for (const setting of defaultSettings) {
        await db.insert(emailNotificationSettings)
          .values(setting)
          .onConflictDoNothing();
      }

      res.json({ success: true, message: 'Configuraciones inicializadas correctamente' });
    } catch (error: any) {
      console.error('❌ Error al inicializar configuraciones:', error);
      res.status(500).json({ message: 'Error al inicializar configuraciones', error: error.message });
    }
  }));

  // Update email notification setting
  const updateEmailNotificationSettingSchema = z.object({
    enabled: z.boolean().optional(),
    recipients: z.string().nullable().optional(),
    ccRecipients: z.string().nullable().optional(),
  }).strict();

  app.patch('/api/admin/email-notification-settings/:id', requireAdminOrSupervisor, asyncHandler(async (req: any, res: any) => {
    try {
      const { id } = req.params;

      const validation = updateEmailNotificationSettingSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          message: 'Datos inválidos',
          errors: validation.error.errors
        });
      }

      const { enabled, recipients, ccRecipients } = validation.data;

      const updateData: { updatedAt: Date; enabled?: boolean; recipients?: string | null; ccRecipients?: string | null } = {
        updatedAt: new Date()
      };
      if (typeof enabled === 'boolean') updateData.enabled = enabled;
      if (recipients !== undefined) updateData.recipients = recipients;
      if (ccRecipients !== undefined) updateData.ccRecipients = ccRecipients;

      await db.update(emailNotificationSettings)
        .set(updateData)
        .where(eq(emailNotificationSettings.id, id));

      res.json({ success: true });
    } catch (error: any) {
      console.error('❌ Error al actualizar configuración:', error);
      res.status(500).json({ message: 'Error al actualizar configuración', error: error.message });
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

  // Get estadísticas mensuales para gráficos
  app.get('/api/visitas-tecnicas/estadisticas-mensuales', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const estadisticas = await storage.getEstadisticasMensualesVisitas();
      res.json(estadisticas);
    } catch (error: any) {
      console.error('❌ Error al obtener estadísticas mensuales de visitas técnicas:', error);
      res.status(500).json({
        message: 'Error al obtener estadísticas mensuales',
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

  // Guardar firmas de visita técnica
  app.post('/api/visitas-tecnicas/:id/firmas', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const { firmaTecnicoNombre, firmaTecnicoData, firmaRecepcionistaNombre, firmaRecepcionistaData } = req.body;

      console.log('📝 Guardando firmas para visita:', id);

      const visitaActualizada = await storage.updateVisitaTecnica(id, {
        firmaTecnicoNombre,
        firmaTecnicoData,
        recepcionistaNombre: firmaRecepcionistaNombre, // Also update the existing field
        firmaRecepcionistaData,
        fechaFirma: new Date(),
      });

      if (!visitaActualizada) {
        return res.status(404).json({
          message: 'Visita técnica no encontrada'
        });
      }

      console.log('✅ Firmas guardadas correctamente para visita:', id);
      res.json(visitaActualizada);
    } catch (error: any) {
      console.error('❌ Error al guardar firmas:', error);
      res.status(500).json({
        message: 'Error al guardar firmas',
        error: error.message
      });
    }
  }));

  // Update visita técnica - Con validación de seguridad completa
  app.put('/api/visitas-tecnicas/:id', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const userRole = req.user?.role;

      // 1. Verificar que la visita existe
      const visitaExistente = await storage.getVisitaTecnicaById(id);
      if (!visitaExistente) {
        return res.status(404).json({
          message: 'Visita técnica no encontrada'
        });
      }

      // 2. Verificar autorización: solo el técnico asignado, vendedor, admin o supervisor pueden editar
      const rolesPermitidos = ['admin', 'supervisor', 'gerente'];
      const esTecnicoAsignado = visitaExistente.tecnicoId === userId;
      const esVendedorAsignado = visitaExistente.vendedorId === userId;
      const tieneRolPermitido = rolesPermitidos.includes(userRole);

      if (!esTecnicoAsignado && !esVendedorAsignado && !tieneRolPermitido) {
        return res.status(403).json({
          message: 'No tiene permisos para editar esta visita técnica'
        });
      }

      // 3. Sanitizar campos de texto para prevenir XSS
      const sanitizeText = (text: any): string | null => {
        if (text === null || text === undefined) return null;
        if (typeof text !== 'string') return String(text);
        return text
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#x27;')
          .trim();
      };

      // 4. Campos permitidos para actualización con sanitización
      const datosLimpios: any = {};
      const camposTexto = [
        'nombreObra', 'direccionObra', 'clienteManual', 'recepcionistaNombre',
        'recepcionistaCargo', 'tipoSuperficie', 'condicionesClimaticas',
        'dilucion', 'observacionesGenerales', 'comentarios', 'firmaTecnicoNombre'
      ];
      const camposId = ['obraId', 'tecnicoId', 'vendedorId', 'clienteId'];
      const camposEnum = ['estado', 'aplicacionGeneral', 'ambiente'];
      const camposBase64 = ['firmaTecnicoData', 'firmaRecepcionistaData'];

      // Sanitizar campos de texto
      for (const campo of camposTexto) {
        if (campo in req.body) {
          datosLimpios[campo] = sanitizeText(req.body[campo]);
        }
      }

      // Validar campos de ID (solo strings alfanuméricos y guiones)
      const idRegex = /^[a-zA-Z0-9\-_]+$/;
      for (const campo of camposId) {
        if (campo in req.body) {
          const valor = req.body[campo];
          if (valor === null || valor === '') {
            datosLimpios[campo] = null;
          } else if (typeof valor === 'string' && idRegex.test(valor)) {
            datosLimpios[campo] = valor;
          }
        }
      }

      // Validar campos enum
      const enumsValidos: Record<string, string[]> = {
        estado: ['borrador', 'completada'],
        aplicacionGeneral: ['correcta', 'deficiente'],
        ambiente: ['interior', 'exterior']
      };
      for (const campo of camposEnum) {
        if (campo in req.body) {
          const valor = req.body[campo];
          if (valor === null || (enumsValidos[campo] && enumsValidos[campo].includes(valor))) {
            datosLimpios[campo] = valor;
          }
        }
      }

      // Validar campos base64 (firmas) - limitar tamaño
      for (const campo of camposBase64) {
        if (campo in req.body) {
          const valor = req.body[campo];
          if (valor === null || valor === '') {
            datosLimpios[campo] = null;
          } else if (typeof valor === 'string' && valor.length < 500000) {
            // Aceptar firmas base64 de tamaño razonable
            datosLimpios[campo] = valor;
          }
        }
      }

      // Parsear fecha si viene
      if ('fechaFirma' in req.body) {
        const fecha = req.body.fechaFirma;
        if (fecha === null) {
          datosLimpios.fechaFirma = null;
        } else if (fecha instanceof Date) {
          datosLimpios.fechaFirma = fecha;
        } else if (typeof fecha === 'string') {
          const fechaParsed = new Date(fecha);
          if (!isNaN(fechaParsed.getTime())) {
            datosLimpios.fechaFirma = fechaParsed;
          }
        }
      }

      // 5. Verificar que hay datos para actualizar
      if (Object.keys(datosLimpios).length === 0) {
        return res.status(400).json({
          message: 'No se proporcionaron campos válidos para actualizar'
        });
      }

      const visitaActualizada = await storage.updateVisitaTecnica(id, datosLimpios);

      if (!visitaActualizada) {
        return res.status(500).json({
          message: 'Error al actualizar la visita técnica'
        });
      }

      // 6. Respuesta con datos esenciales (sin firmas base64 completas)
      const respuesta = {
        id: visitaActualizada.id,
        nombreObra: visitaActualizada.nombreObra,
        direccionObra: visitaActualizada.direccionObra,
        estado: visitaActualizada.estado,
        clienteId: visitaActualizada.clienteId,
        clienteManual: visitaActualizada.clienteManual,
        tecnicoId: visitaActualizada.tecnicoId,
        vendedorId: visitaActualizada.vendedorId,
        updatedAt: visitaActualizada.updatedAt,
        success: true
      };

      res.json(respuesta);
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

  // GET evidencias de una visita técnica
  app.get('/api/visitas-tecnicas/:id/evidencias', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const evidenciasResult = await storage.getEvidenciasByVisitaId(id);
      res.json(evidenciasResult);
    } catch (error: any) {
      console.error('❌ Error al obtener evidencias:', error);
      res.status(500).json({
        message: 'Error al obtener evidencias',
        error: error.message
      });
    }
  }));

  // POST subir evidencia/foto a una visita técnica
  app.post('/api/visitas-tecnicas/:id/evidencias', requireAuth, upload.single('file'), asyncHandler(async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const { tipo, descripcion, productoEvaluadoId, reclamoId } = req.body;
      const file = req.file;

      if (!file) {
        return res.status(400).json({
          message: 'No se proporcionó archivo'
        });
      }

      // Validar tipo de archivo
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
      if (!allowedTypes.includes(file.mimetype)) {
        return res.status(400).json({
          message: 'Tipo de archivo no permitido. Solo se aceptan imágenes (JPEG, PNG, WebP, GIF)'
        });
      }

      // Validar tamaño (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        return res.status(400).json({
          message: 'El archivo es demasiado grande. Máximo 10MB'
        });
      }

      // Generar nombre único para el archivo
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(2, 8);
      const extension = file.originalname.split('.').pop() || 'jpg';
      const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_').substring(0, 50);
      const fileName = `visitas-tecnicas/${id}/${timestamp}-${randomId}-${sanitizedName}`;

      // Subir al Object Storage
      const objectStorageService = new ObjectStorageService();
      const fileUrl = await objectStorageService.uploadImage(fileName, file.buffer, file.mimetype);

      // Crear registro en base de datos
      const evidenciaData = {
        visitaId: id,
        tipoEvidencia: tipo || 'general',
        descripcion: descripcion || null,
        productoEvaluadoId: productoEvaluadoId || null,
        reclamoId: reclamoId || null,
        nombreArchivo: file.originalname,
        urlArchivo: fileUrl,
        tipoArchivo: file.mimetype,
        tamanio: file.size
      };

      const evidencia = await storage.createEvidencia(evidenciaData);
      console.log(`📷 Evidencia subida para visita ${id}: ${fileUrl}`);
      res.status(201).json(evidencia);
    } catch (error: any) {
      console.error('❌ Error al crear evidencia:', error);
      res.status(500).json({
        message: 'Error al crear evidencia',
        error: error.message
      });
    }
  }));

  // DELETE eliminar evidencia
  app.delete('/api/visitas-tecnicas/evidencias/:evidenciaId', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const { evidenciaId } = req.params;
      const userId = req.user?.id;
      const userRole = req.user?.role;

      // Obtener la evidencia para verificar permisos
      const evidencia = await storage.getEvidenciaById(evidenciaId);
      if (!evidencia) {
        return res.status(404).json({
          message: 'Evidencia no encontrada'
        });
      }

      // Verificar permisos: admin, supervisor, gerente, o el técnico/vendedor asignado a la visita
      const rolesPermitidos = ['admin', 'supervisor', 'gerente'];
      let tienePermiso = rolesPermitidos.includes(userRole);

      if (!tienePermiso && evidencia.visitaId) {
        const visita = await storage.getVisitaTecnicaById(evidencia.visitaId);
        if (visita) {
          tienePermiso = visita.tecnicoId === userId || visita.vendedorId === userId;
        }
      }

      if (!tienePermiso) {
        return res.status(403).json({
          message: 'No tiene permisos para eliminar esta evidencia'
        });
      }

      // Intentar eliminar del Object Storage (no bloquear si falla)
      if (evidencia.urlArchivo) {
        try {
          const objectStorageService = new ObjectStorageService();
          await objectStorageService.deleteObject(evidencia.urlArchivo);
        } catch (deleteError) {
          console.warn('No se pudo eliminar archivo del storage:', deleteError);
        }
      }

      // Eliminar de la base de datos
      await storage.deleteEvidencia(evidenciaId);
      console.log(`🗑️ Evidencia eliminada: ${evidenciaId}`);

      res.json({ success: true, message: 'Evidencia eliminada correctamente' });
    } catch (error: any) {
      console.error('❌ Error al eliminar evidencia:', error);
      res.status(500).json({
        message: 'Error al eliminar evidencia',
        error: error.message
      });
    }
  }));

  // PATCH actualizar evaluación técnica de un producto
  app.patch('/api/visitas-tecnicas/evaluaciones/:productoEvaluadoId', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const { productoEvaluadoId } = req.params;
      const evaluacionData = req.body;

      // Buscar si existe una evaluación para este producto
      const [existingEval] = await db
        .select()
        .from(evaluacionesTecnicas)
        .where(eq(evaluacionesTecnicas.productoEvaluadoId, productoEvaluadoId));

      if (existingEval) {
        // Actualizar evaluación existente
        const [updated] = await db
          .update(evaluacionesTecnicas)
          .set({
            ...evaluacionData,
            updatedAt: new Date()
          })
          .where(eq(evaluacionesTecnicas.productoEvaluadoId, productoEvaluadoId))
          .returning();

        return res.json(updated);
      } else {
        // Crear nueva evaluación si no existe
        const [created] = await db
          .insert(evaluacionesTecnicas)
          .values({
            productoEvaluadoId,
            ...evaluacionData
          })
          .returning();

        return res.status(201).json(created);
      }
    } catch (error: any) {
      console.error('❌ Error al actualizar evaluación:', error);
      res.status(500).json({
        message: 'Error al actualizar evaluación',
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

  // Get notifications for recent reclamos and resolutions (last 24 hours)
  app.get('/api/reclamos-generales/notificaciones', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const notificaciones = await storage.getReclamosNotificaciones();
      res.json(notificaciones);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al obtener notificaciones', error: error.message });
    }
  }));

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
      const { getRoleArea, canViewAllReclamos } = await import('@shared/reclamosAreas');

      // Admin, supervisor y jefe_planta pueden ver todos los reclamos de todas las áreas
      if (!canViewAllReclamos(user.role)) {
        const userArea = getRoleArea(user.role);

        // Usuarios de área (laboratorio, produccion, etc.) ven todos los reclamos de su área
        if (userArea) {
          // Filtrar por área responsable para ver todos los reclamos en la cola del área
          filters.areaResponsable = userArea;
        }
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

      const userName = user.salespersonName || `${user.firstName} ${user.lastName}`;

      // Para técnicos de obra: auto-validar el reclamo (saltar paso de validación técnica)
      // El estado va directamente a "en_laboratorio" o según el área asignada
      const isTecnicoObra = user.role === 'tecnico_obra';

      // Determinar el estado inicial según quién crea el reclamo
      let estadoInicial = 'registrado'; // Default: pendiente de validación técnica
      let areaResponsableActual = null;

      if (isTecnicoObra) {
        // Técnico de obra crea el reclamo: auto-validado, va directo al área asignada
        const areaAsignadaInicial = req.body.areaAsignadaInicial;
        if (areaAsignadaInicial === 'laboratorio') {
          estadoInicial = 'en_laboratorio';
        } else if (areaAsignadaInicial === 'produccion') {
          estadoInicial = 'en_produccion';
          areaResponsableActual = areaAsignadaInicial;
        } else {
          estadoInicial = 'en_area_responsable';
          areaResponsableActual = areaAsignadaInicial;
        }
      }

      // Add vendedor info from authenticated user
      const reclamoData = {
        ...req.body,
        vendedorId: user.id,
        vendedorName: userName,
        estado: estadoInicial,
        // Si es técnico de obra, asignarse a sí mismo como técnico
        ...(isTecnicoObra && {
          tecnicoId: user.id,
          tecnicoName: userName,
          fechaAsignacionTecnico: new Date(),
          validadoPorTecnico: true,
          procedeReclamo: true,
          areaResponsableActual: areaResponsableActual || req.body.areaAsignadaInicial,
        }),
      };

      const reclamo = await storage.createReclamoGeneral(reclamoData);

      // Si el técnico creó el reclamo, agregar entrada de historial indicando auto-validación
      if (isTecnicoObra) {
        await storage.createReclamoGeneralHistorial({
          reclamoId: reclamo.id,
          estadoAnterior: 'registrado',
          estadoNuevo: estadoInicial,
          userId: user.id,
          userName: userName,
          notas: 'Reclamo creado y validado automáticamente por el técnico de obra',
        });
      }

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

      const { informe, categoriaResponsable, photos, documents } = req.body;

      if (!informe) {
        return res.status(400).json({ message: 'El informe es requerido' });
      }

      if (!categoriaResponsable) {
        return res.status(400).json({ message: 'La categoría responsable es requerida' });
      }

      // Photos and documents are now optional - validate only that they're arrays if provided
      const photoArray = Array.isArray(photos) ? photos : [];
      const documentArray = Array.isArray(documents) ? documents : [];

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
      const reclamo = await storage.updateResolucionLaboratorio(req.params.id, informe, categoriaResponsable, photoArray, user.id, userName, documentArray);

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

      // Validar que el usuario tiene rol de área, laboratorio, jefe_planta, o rol organizacional
      const isAreaRole = user.role && (
        user.role.startsWith('area_') ||
        user.role === 'laboratorio' ||
        user.role === 'jefe_planta' ||
        organizationalRoles.includes(user.role)
      );
      if (!isAreaRole) {
        return res.status(403).json({ message: 'No tiene permisos para subir resoluciones' });
      }

      const { resolucionDescripcion, photos, documents } = req.body;

      if (!resolucionDescripcion) {
        return res.status(400).json({ message: 'La descripción de la resolución es requerida' });
      }

      // Photos and documents are now optional - validate only that they're arrays if provided
      const photoArray = Array.isArray(photos) ? photos : [];
      const documentArray = Array.isArray(documents) ? documents : [];

      const userName = user.salespersonName || `${user.firstName} ${user.lastName}`;

      try {
        const reclamo = await storage.updateResolucionArea(
          req.params.id,
          resolucionDescripcion,
          photoArray,
          user.id,
          userName,
          user.role,
          documentArray
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
      const allowedRoles = ['admin', 'supervisor', 'jefe_planta', 'mantencion', 'produccion', 'planificacion', 'logistica_bodega', 'bodega_materias_primas'];
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
      const allowedRoles = ['admin', 'supervisor', 'jefe_planta', 'mantencion', 'produccion', 'planificacion', 'logistica_bodega', 'bodega_materias_primas'];
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
      const allowedRoles = ['admin', 'supervisor', 'jefe_planta', 'mantencion', 'produccion', 'planificacion', 'logistica_bodega', 'bodega_materias_primas'];
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
      const allowedRoles = ['admin', 'supervisor', 'jefe_planta', 'mantencion', 'produccion', 'planificacion', 'logistica_bodega', 'bodega_materias_primas'];
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

      // Only admin, supervisor, jefe_planta, mantencion, and produccion can update
      const allowedRoles = ['admin', 'supervisor', 'jefe_planta', 'mantencion', 'produccion'];
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

      // Admin, jefe_planta, mantencion, and produccion can delete anytime
      const canDeleteAnytime = ['admin', 'jefe_planta', 'mantencion', 'produccion'].includes(user.role);

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
      const allowedRoles = ['admin', 'supervisor', 'jefe_planta', 'mantencion', 'produccion', 'planificacion', 'logistica_bodega', 'bodega_materias_primas'];
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

      // Only admin, supervisor, jefe_planta, mantencion, and produccion can assign técnico
      const allowedRoles = ['admin', 'supervisor', 'jefe_planta', 'mantencion', 'produccion'];
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

      // Only admin, supervisor, jefe_planta, mantencion, and produccion can change estado
      const allowedRoles = ['admin', 'supervisor', 'jefe_planta', 'mantencion', 'produccion'];
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

      // Only admin, supervisor, jefe_planta, mantencion, and produccion can submit resolucion
      const allowedRoles = ['admin', 'supervisor', 'jefe_planta', 'mantencion', 'produccion'];
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

      // Only admin, supervisor, jefe_planta, mantencion, and produccion can close
      const allowedRoles = ['admin', 'supervisor', 'jefe_planta', 'mantencion', 'produccion'];
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
  app.post('/api/mantenciones/:id/pausar', requireAuth, requireRoles(['admin', 'supervisor', 'jefe_planta', 'mantencion', 'produccion']), asyncHandler(async (req: any, res: any) => {
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
  app.post('/api/mantenciones/:id/reanudar', requireAuth, requireRoles(['admin', 'supervisor', 'jefe_planta', 'mantencion', 'produccion']), asyncHandler(async (req: any, res: any) => {
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
      const result = await storage.getGastosMaterialesMantencion({
        otId: req.params.id
      });

      // Return only the data array for OT-specific gastos (no pagination needed)
      res.json(result.data || []);
    } catch (error: any) {
      console.error('Error al obtener gastos:', error);
      res.status(400).json({ message: error.message || 'Error al obtener gastos' });
    }
  }));

  // Agregar gasto a OT
  app.post('/api/mantenciones/:id/gastos', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;

      // Only admin, supervisor, jefe_planta, mantencion, and produccion can add gastos
      const allowedRoles = ['admin', 'supervisor', 'jefe_planta', 'mantencion', 'produccion'];
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

      // Only admin, supervisor, jefe_planta, mantencion, and produccion can update asignacion
      const allowedRoles = ['admin', 'supervisor', 'jefe_planta', 'mantencion', 'produccion'];
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
  app.get('/api/cmms/equipos', requireAuth, requireCMMSFullAccess, asyncHandler(async (req: any, res: any) => {
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
  app.get('/api/cmms/equipos/:id', requireAuth, requireCMMSFullAccess, asyncHandler(async (req: any, res: any) => {
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
  app.get('/api/cmms/equipos/:id/componentes', requireAuth, requireCMMSFullAccess, asyncHandler(async (req: any, res: any) => {
    try {
      const componentes = await storage.getComponentesDeEquipo(req.params.id);
      res.json(componentes);
    } catch (error: any) {
      console.error('Error al obtener componentes:', error);
      res.status(500).json({ message: 'Error al obtener componentes', error: error.message });
    }
  }));

  // GET mantenciones planificadas de un equipo
  app.get('/api/cmms/equipos/:id/mantenciones-planificadas', requireAuth, requireCMMSMaintenance, asyncHandler(async (req: any, res: any) => {
    try {
      const results = await db
        .select({
          id: mantencionesPlanificadas.id,
          equipoId: mantencionesPlanificadas.equipoId,
          equipoNombre: mantencionesPlanificadas.equipoNombre,
          titulo: mantencionesPlanificadas.titulo,
          descripcion: mantencionesPlanificadas.descripcion,
          categoria: mantencionesPlanificadas.categoria,
          costoEstimado: mantencionesPlanificadas.costoEstimado,
          mes: mantencionesPlanificadas.mes,
          anio: mantencionesPlanificadas.anio,
          area: mantencionesPlanificadas.area,
          estado: mantencionesPlanificadas.estado,
          prioridad: mantencionesPlanificadas.prioridad,
          notas: mantencionesPlanificadas.notas,
          otGeneradaId: mantencionesPlanificadas.otGeneradaId,
          creadoPorId: mantencionesPlanificadas.creadoPorId,
          creadoPorName: mantencionesPlanificadas.creadoPorName,
          createdAt: mantencionesPlanificadas.createdAt,
          updatedAt: mantencionesPlanificadas.updatedAt,
        })
        .from(mantencionesPlanificadas)
        .where(eq(mantencionesPlanificadas.equipoId, req.params.id))
        .orderBy(desc(mantencionesPlanificadas.anio), desc(mantencionesPlanificadas.mes));
      res.json(results);
    } catch (error: any) {
      console.error('Error al obtener mantenciones planificadas:', error);
      res.status(500).json({ message: 'Error al obtener mantenciones planificadas', error: error.message });
    }
  }));

  // GET todas las órdenes de trabajo (para exportación)
  app.get('/api/cmms/ordenes-trabajo', requireAuth, requireCMMSPlantStaff, asyncHandler(async (req: any, res: any) => {
    try {
      const results = await db
        .select({
          id: solicitudesMantencion.id,
          equipoId: solicitudesMantencion.equipoId,
          equipoNombre: solicitudesMantencion.equipoNombre,
          equipoCodigo: solicitudesMantencion.equipoCodigo,
          descripcionProblema: solicitudesMantencion.descripcionProblema,
          accionTomada: solicitudesMantencion.resolucionDescripcion,
          area: solicitudesMantencion.area,
          prioridad: solicitudesMantencion.prioridad,
          gravedad: solicitudesMantencion.gravedad,
          estado: solicitudesMantencion.estado,
          fechaResolucion: solicitudesMantencion.fechaResolucion,
          tecnicoNombre: solicitudesMantencion.tecnicoAsignadoName,
          createdAt: solicitudesMantencion.createdAt,
          updatedAt: solicitudesMantencion.updatedAt,
        })
        .from(solicitudesMantencion)
        .orderBy(desc(solicitudesMantencion.createdAt));
      res.json(results);
    } catch (error: any) {
      console.error('Error al obtener órdenes de trabajo:', error);
      res.status(500).json({ message: 'Error al obtener órdenes de trabajo', error: error.message });
    }
  }));

  // GET órdenes de trabajo de un equipo
  app.get('/api/cmms/equipos/:id/ordenes-trabajo', requireAuth, requireCMMSPlantStaff, asyncHandler(async (req: any, res: any) => {
    try {
      const results = await db
        .select({
          id: solicitudesMantencion.id,
          equipoId: solicitudesMantencion.equipoId,
          equipoNombre: solicitudesMantencion.equipoNombre,
          descripcionProblema: solicitudesMantencion.descripcionProblema,
          area: solicitudesMantencion.area,
          prioridad: solicitudesMantencion.prioridad,
          gravedad: solicitudesMantencion.gravedad,
          estado: solicitudesMantencion.estado,
          fechaInicio: solicitudesMantencion.fechaInicio,
          fechaFin: solicitudesMantencion.fechaFin,
          solicitanteId: solicitudesMantencion.solicitanteId,
          solicitanteNombre: solicitudesMantencion.solicitanteNombre,
          tecnicoAsignadoId: solicitudesMantencion.tecnicoAsignadoId,
          tecnicoAsignadoNombre: solicitudesMantencion.tecnicoAsignadoNombre,
          createdAt: solicitudesMantencion.createdAt,
          updatedAt: solicitudesMantencion.updatedAt,
        })
        .from(solicitudesMantencion)
        .where(eq(solicitudesMantencion.equipoId, req.params.id))
        .orderBy(desc(solicitudesMantencion.createdAt));
      res.json(results);
    } catch (error: any) {
      console.error('Error al obtener órdenes de trabajo:', error);
      res.status(500).json({ message: 'Error al obtener órdenes de trabajo', error: error.message });
    }
  }));

  // GET equipos principales (sin padre)
  app.get('/api/cmms/equipos-principales', requireAuth, requireCMMSFullAccess, asyncHandler(async (req: any, res: any) => {
    try {
      const equiposPrincipales = await storage.getEquiposPrincipales();
      res.json(equiposPrincipales);
    } catch (error: any) {
      console.error('Error al obtener equipos principales:', error);
      res.status(500).json({ message: 'Error al obtener equipos principales', error: error.message });
    }
  }));

  // POST create new equipo crítico
  app.post('/api/cmms/equipos', requireAuth, requireCMMSFullAccess, asyncHandler(async (req: any, res: any) => {
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
  app.patch('/api/cmms/equipos/:id', requireAuth, requireCMMSFullAccess, asyncHandler(async (req: any, res: any) => {
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
  app.delete('/api/cmms/equipos/:id', requireAuth, requireCMMSFullAccess, asyncHandler(async (req: any, res: any) => {
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
  app.get('/api/cmms/proveedores', requireAuth, requireCMMSFullAccess, asyncHandler(async (req: any, res: any) => {
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
  app.get('/api/cmms/proveedores/:id', requireAuth, requireCMMSFullAccess, asyncHandler(async (req: any, res: any) => {
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
  app.post('/api/cmms/proveedores', requireAuth, requireCMMSFullAccess, asyncHandler(async (req: any, res: any) => {
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
  app.patch('/api/cmms/proveedores/:id', requireAuth, requireCMMSFullAccess, asyncHandler(async (req: any, res: any) => {
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
  app.delete('/api/cmms/proveedores/:id', requireAuth, requireCMMSFullAccess, asyncHandler(async (req: any, res: any) => {
    try {
      await storage.deleteProveedorMantencion(req.params.id);
      res.json({ message: 'Proveedor eliminado exitosamente' });
    } catch (error: any) {
      console.error('Error al eliminar proveedor:', error);
      res.status(500).json({ message: 'Error al eliminar proveedor', error: error.message });
    }
  }));

  // ===== PRESUPUESTO MANTENCIÓN ROUTES =====

  // GET presupuestos con filtros opcionales
  app.get('/api/cmms/presupuesto', requireAuth, requireCMMSFullAccess, asyncHandler(async (req: any, res: any) => {
    try {
      const { anio, area } = req.query;
      const filters: { anio?: number; area?: string } = {};

      if (anio) {
        filters.anio = parseInt(anio);
      }
      if (area && area !== 'global') {
        filters.area = area;
      }

      const presupuestos = await storage.getPresupuestosMantencion(filters);
      res.json(presupuestos);
    } catch (error: any) {
      console.error('Error al obtener presupuestos:', error);
      res.status(500).json({ message: 'Error al obtener presupuestos', error: error.message });
    }
  }));

  // POST create presupuesto
  app.post('/api/cmms/presupuesto', requireAuth, requireCMMSFullAccess, asyncHandler(async (req: any, res: any) => {
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
  app.patch('/api/cmms/presupuesto/:id', requireAuth, requireCMMSFullAccess, asyncHandler(async (req: any, res: any) => {
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
  app.delete('/api/cmms/presupuesto/:id', requireAuth, requireCMMSFullAccess, asyncHandler(async (req: any, res: any) => {
    try {
      await storage.deletePresupuestoMantencion(req.params.id);
      res.json({ message: 'Presupuesto eliminado exitosamente' });
    } catch (error: any) {
      console.error('Error al eliminar presupuesto:', error);
      res.status(500).json({ message: 'Error al eliminar presupuesto', error: error.message });
    }
  }));

  // ===== GASTOS DE MATERIALES ROUTES =====

  // GET gastos de materiales (with filters and pagination)
  app.get('/api/cmms/gastos-materiales', requireAuth, requireCMMSFullAccess, asyncHandler(async (req: any, res: any) => {
    try {
      const { otId, area, anio, mes, startDate, endDate, page, pageSize } = req.query;
      const result = await storage.getGastosMaterialesMantencion({
        otId,
        area,
        anio,
        mes,
        startDate,
        endDate,
        page: page ? parseInt(page) : undefined,
        pageSize: pageSize ? parseInt(pageSize) : undefined
      });
      res.json(result);
    } catch (error: any) {
      console.error('Error al obtener gastos:', error);
      res.status(500).json({ message: 'Error al obtener gastos', error: error.message });
    }
  }));

  // GET gasto by ID
  app.get('/api/cmms/gastos-materiales/:id', requireAuth, requireCMMSFullAccess, asyncHandler(async (req: any, res: any) => {
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
  app.post('/api/cmms/gastos-materiales', requireAuth, requireCMMSFullAccess, asyncHandler(async (req: any, res: any) => {
    try {
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
  app.patch('/api/cmms/gastos-materiales/:id', requireAuth, requireCMMSFullAccess, asyncHandler(async (req: any, res: any) => {
    try {
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
  app.delete('/api/cmms/gastos-materiales/:id', requireAuth, requireCMMSFullAccess, asyncHandler(async (req: any, res: any) => {
    try {
      await storage.deleteGastoMaterialMantencion(req.params.id);
      res.json({ message: 'Gasto eliminado exitosamente' });
    } catch (error: any) {
      console.error('Error al eliminar gasto:', error);
      res.status(500).json({ message: 'Error al eliminar gasto', error: error.message });
    }
  }));

  // GET export gastos to Excel (DEBE IR ANTES DE /:id)
  app.get('/api/cmms/gastos-materiales-export', requireAuth, requireCMMSFullAccess, asyncHandler(async (req: any, res: any) => {
    try {
      const { area, anio, mes } = req.query;

      const gastos = await storage.getGastosMaterialesForExport({ area, anio, mes });

      const excelData = gastos.map(gasto => ({
        'Fecha': format(new Date(gasto.fecha), 'dd/MM/yyyy'),
        'Item': gasto.item,
        'Descripción': gasto.descripcion || '',
        'Cantidad': parseFloat(gasto.cantidad),
        'Costo Unitario': parseFloat(gasto.costoUnitario),
        'Costo Total': parseFloat(gasto.costoTotal),
        'Área': gasto.area || 'Sin asignar',
        'OT #': gasto.ot ? gasto.ot.id : '',
        'Equipo OT': gasto.ot ? gasto.ot.equipoNombre : '',
        'Descripción OT': gasto.ot ? gasto.ot.descripcionProblema : '',
        'Estado OT': gasto.ot ? gasto.ot.estado : '',
        'Gravedad OT': gasto.ot ? gasto.ot.gravedad : '',
        'Proveedor': gasto.proveedor ? gasto.proveedor.nombre : '',
      }));

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(excelData);

      ws['!cols'] = [
        { wch: 12 }, // Fecha
        { wch: 35 }, // Item
        { wch: 40 }, // Descripción
        { wch: 10 }, // Cantidad
        { wch: 15 }, // Costo Unitario
        { wch: 15 }, // Costo Total
        { wch: 25 }, // Área
        { wch: 12 }, // OT #
        { wch: 30 }, // Equipo OT
        { wch: 45 }, // Descripción OT
        { wch: 15 }, // Estado OT
        { wch: 12 }, // Gravedad OT
        { wch: 30 }, // Proveedor
      ];

      XLSX.utils.book_append_sheet(wb, ws, 'Gastos de Materiales');

      const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

      const periodo = mes
        ? `${anio}-${String(mes).padStart(2, '0')}`
        : anio || 'todos';
      const filename = `gastos_materiales_${periodo}_${format(new Date(), 'yyyyMMdd_HHmmss')}.xlsx`;

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.send(excelBuffer);
    } catch (error: any) {
      console.error('Error al exportar gastos:', error);
      res.status(500).json({ message: 'Error al exportar gastos', error: error.message });
    }
  }));

  // ===== PLANES PREVENTIVOS ROUTES =====

  // GET plantilla Excel para gastos materiales (DEBE IR ANTES DE /:id)
  app.get('/api/cmms/gastos-materiales/plantilla-excel', requireAuth, requireCMMSFullAccess, asyncHandler(async (req: any, res: any) => {
    try {
      // Crear workbook y worksheet
      const wb = XLSX.utils.book_new();

      // Datos de ejemplo para la plantilla
      const plantillaData = [
        {
          'Fecha (YYYY-MM-DD)': '2025-01-15',
          'Item': 'Tornillos hexagonales M8',
          'Descripción': 'Tornillos para reparación de máquina dispersora',
          'Cantidad': 50,
          'Costo Unitario': 250,
          'Área': 'produccion',
          'Proveedor ID': ''
        },
        {
          'Fecha (YYYY-MM-DD)': '2025-01-16',
          'Item': 'Aceite lubricante SAE 40',
          'Descripción': 'Aceite para mantenimiento preventivo',
          'Cantidad': 20,
          'Costo Unitario': 5000,
          'Área': 'mantencion',
          'Proveedor ID': ''
        },
        {
          'Fecha (YYYY-MM-DD)': '2025-01-17',
          'Item': 'Candados de seguridad',
          'Descripción': 'Candados para área de almacenamiento',
          'Cantidad': 10,
          'Costo Unitario': 5800,
          'Área': 'servicios_generales',
          'Proveedor ID': ''
        }
      ];

      const ws = XLSX.utils.json_to_sheet(plantillaData);

      // Ajustar ancho de columnas
      ws['!cols'] = [
        { wch: 20 }, // Fecha
        { wch: 30 }, // Item
        { wch: 40 }, // Descripción
        { wch: 10 }, // Cantidad
        { wch: 15 }, // Costo Unitario
        { wch: 25 }, // Área
        { wch: 15 }  // Proveedor ID
      ];

      XLSX.utils.book_append_sheet(wb, ws, "Gastos Materiales");

      // Agregar hoja de instrucciones
      const instrucciones = [
        { Columna: 'Fecha (YYYY-MM-DD)', Descripción: 'Fecha del gasto en formato YYYY-MM-DD (ej: 2025-01-15)', Requerido: 'SÍ' },
        { Columna: 'Item', Descripción: 'Nombre del material o repuesto', Requerido: 'SÍ' },
        { Columna: 'Descripción', Descripción: 'Descripción detallada del gasto (opcional)', Requerido: 'NO' },
        { Columna: 'Cantidad', Descripción: 'Cantidad de unidades (número)', Requerido: 'SÍ' },
        { Columna: 'Costo Unitario', Descripción: 'Costo por unidad en pesos chilenos (número)', Requerido: 'SÍ' },
        { Columna: 'Área', Descripción: 'Área del gasto: administracion, produccion, laboratorio, bodega_materias_primas, bodega_productos_terminados, servicios_generales, mantencion, comercial', Requerido: 'NO' },
        { Columna: 'Proveedor ID', Descripción: 'ID del proveedor (opcional, dejar vacío si no aplica)', Requerido: 'NO' }
      ];

      const wsInstrucciones = XLSX.utils.json_to_sheet(instrucciones);
      wsInstrucciones['!cols'] = [
        { wch: 20 },
        { wch: 80 },
        { wch: 10 }
      ];
      XLSX.utils.book_append_sheet(wb, wsInstrucciones, "Instrucciones");

      // Generar buffer
      const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=plantilla_gastos_materiales.xlsx');
      res.send(excelBuffer);
    } catch (error: any) {
      console.error('Error al generar plantilla Excel:', error);
      res.status(500).json({ message: 'Error al generar plantilla Excel', error: error.message });
    }
  }));

  // Función compartida para parsear y validar Excel de gastos materiales
  const parseAndValidateGastosExcel = async (fileBuffer: Buffer, mode: 'preview' | 'import' = 'import') => {
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });

    // Leer la primera hoja
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet);

    if (!jsonData || jsonData.length === 0) {
      throw new Error('El archivo Excel está vacío o no tiene el formato correcto');
    }

    const gastosValidos = [];
    const errores = [];
    const filasParseadas = mode === 'preview' ? [] : undefined; // Solo crear array en preview

    // Procesar cada fila
    for (let i = 0; i < jsonData.length; i++) {
      const row: any = jsonData[i];
      const rowNumber = i + 2; // +2 porque Excel empieza en 1 y hay header

      try {
        // Mapear y normalizar columnas del Excel - soportar AMBOS formatos
        // Formato plantilla: "Fecha (YYYY-MM-DD)", "Item", "Costo Unitario", "Área"
        // Formato ERP: "EMISION", "DESCRIPCIO", "TOTAL", "TIPOTRANSA"

        let fechaRaw = row['Fecha (YYYY-MM-DD)'] || row['Fecha'] || row['EMISION'];
        const itemRaw = row['Item'] || row['DESCRIPCIO'];
        const descripcionRaw = row['Descripción'] || row['Descripcion'] || row['FAMDOCU'];
        const cantidadRaw = row['Cantidad'] || row['CANTIDAD'];

        // Costo unitario puede venir directo o calculado desde TOTAL
        let costoUnitarioRaw = row['Costo Unitario'];
        const totalRaw = row['TOTAL'];

        // Si viene del formato ERP (tiene TOTAL pero no Costo Unitario), calcular
        if (!costoUnitarioRaw && totalRaw && cantidadRaw) {
          const cantidad = parseFloat(cantidadRaw);
          const total = parseFloat(totalRaw);
          costoUnitarioRaw = cantidad > 0 ? (total / cantidad) : total;
        }

        // Áreas: mapear formato ERP a formato interno
        const areaRaw = row['Área'] || row['Area'] || row['TIPOTRANSA'];
        const proveedorIdRaw = row['Proveedor ID'] || row['ProveedorId'];

        // Convertir fecha de número Excel a string YYYY-MM-DD si es necesario
        if (typeof fechaRaw === 'number') {
          const excelDate = new Date((fechaRaw - 25569) * 86400 * 1000);
          const year = excelDate.getFullYear();
          const month = String(excelDate.getMonth() + 1).padStart(2, '0');
          const day = String(excelDate.getDate()).padStart(2, '0');
          fechaRaw = `${year}-${month}-${day}`;
        }

        // Normalizar strings (trim y verificar vacíos)
        const fecha = typeof fechaRaw === 'string' ? fechaRaw.trim() : fechaRaw;
        const item = typeof itemRaw === 'string' ? itemRaw.trim() : itemRaw;
        const descripcion = typeof descripcionRaw === 'string' && descripcionRaw.trim() !== '' ? descripcionRaw.trim() : null;

        // Mapear áreas del formato ERP al formato interno
        let area = null;
        if (typeof areaRaw === 'string' && areaRaw.trim() !== '') {
          const areaUpper = areaRaw.trim().toUpperCase();
          const areaMap: { [key: string]: string } = {
            'ADMINISTRACION': 'administracion',
            'BODEGA MATERIAS PRIMAS': 'bodega_materias_primas',
            'BODEGA PRODUCTOS TERMINADOS': 'bodega_productos_terminados',
            'COMERCIAL': 'comercial',
            'LABORATORIO': 'laboratorio',
            'MANTENCION': 'mantencion',
            'PRODUCCION': 'produccion',
            'SERVICIOS GENERALES': 'servicios_generales'
          };
          area = areaMap[areaUpper] || areaRaw.trim().toLowerCase().replace(/\s+/g, '_');
        }

        const proveedorId = typeof proveedorIdRaw === 'string' && proveedorIdRaw.trim() !== '' ? proveedorIdRaw.trim() : null;

        // Validar campos requeridos ANTES de parsear
        if (!fecha || !item || cantidadRaw === undefined || cantidadRaw === null || cantidadRaw === '' ||
          costoUnitarioRaw === undefined || costoUnitarioRaw === null || costoUnitarioRaw === '') {
          const error = 'Faltan campos requeridos (Fecha, Item, Cantidad, Costo Unitario)';
          errores.push({ fila: rowNumber, error });
          if (mode === 'preview') {
            const datosError = {
              'Fecha (YYYY-MM-DD)': fecha || '',
              'Fecha': fecha || '',
              'Item': item || '',
              'Descripción': descripcion || '',
              'Cantidad': cantidadRaw || '',
              'Costo Unitario': costoUnitarioRaw || '',
              'Costo Total': '',
              'Área': area || '',
              'Area': area || ''
            };
            filasParseadas!.push({ fila: rowNumber, estado: 'error', error, datos: datosError });
          }
          continue;
        }

        // Parsear números después de validar que existen
        const cantidad = parseFloat(cantidadRaw);
        const costoUnitario = parseFloat(costoUnitarioRaw);

        // Validar que los números son válidos
        if (isNaN(cantidad) || isNaN(costoUnitario)) {
          const error = 'Cantidad y Costo Unitario deben ser números válidos';
          errores.push({ fila: rowNumber, error });
          if (mode === 'preview') {
            const datosError = {
              'Fecha (YYYY-MM-DD)': fecha || '',
              'Fecha': fecha || '',
              'Item': item || '',
              'Descripción': descripcion || '',
              'Cantidad': cantidadRaw || '',
              'Costo Unitario': costoUnitarioRaw || '',
              'Costo Total': '',
              'Área': area || '',
              'Area': area || ''
            };
            filasParseadas!.push({ fila: rowNumber, estado: 'error', error, datos: datosError });
          }
          continue;
        }

        // Calcular costo total
        const costoTotal = cantidad * costoUnitario;

        // Crear el objeto de datos validado
        const gastoData = {
          fecha,
          item,
          descripcion,
          cantidad,
          costoUnitario,
          costoTotal,
          area,
          otId: null,
          proveedorId,
          adjuntoUrl: null
        };

        // Validar con schema de Zod
        const validatedData = insertGastoMaterialMantencionSchema.parse(gastoData);
        gastosValidos.push(validatedData);

        // Solo agregar detalles de fila en modo preview
        if (mode === 'preview') {
          // Crear objeto de datos con nombres de columnas normalizados para el frontend
          const datosNormalizados = {
            'Fecha (YYYY-MM-DD)': fecha,
            'Fecha': fecha,
            'Item': item,
            'Descripción': descripcion || '',
            'Cantidad': cantidad,
            'Costo Unitario': costoUnitario,
            'Costo Total': costoTotal,
            'Área': area || '',
            'Area': area || ''
          };
          filasParseadas!.push({
            fila: rowNumber,
            estado: 'valido',
            datos: datosNormalizados
          });
        }

      } catch (error: any) {
        const errorMsg = error.message || 'Error al procesar la fila';
        errores.push({ fila: rowNumber, error: errorMsg });
        if (mode === 'preview') {
          // Intentar extraer datos que puedan existir para mostrar en preview
          const datosError = {
            'Fecha (YYYY-MM-DD)': row['Fecha (YYYY-MM-DD)'] || row['Fecha'] || row['EMISION'] || '',
            'Fecha': row['Fecha (YYYY-MM-DD)'] || row['Fecha'] || row['EMISION'] || '',
            'Item': row['Item'] || row['DESCRIPCIO'] || '',
            'Descripción': row['Descripción'] || row['Descripcion'] || row['FAMDOCU'] || '',
            'Cantidad': row['Cantidad'] || row['CANTIDAD'] || '',
            'Costo Unitario': row['Costo Unitario'] || '',
            'Costo Total': row['TOTAL'] || '',
            'Área': row['Área'] || row['Area'] || row['TIPOTRANSA'] || '',
            'Area': row['Área'] || row['Area'] || row['TIPOTRANSA'] || ''
          };
          filasParseadas!.push({ fila: rowNumber, estado: 'error', error: errorMsg, datos: datosError });
        }
      }
    }

    return {
      totalFilas: jsonData.length,
      filasValidas: gastosValidos.length,
      filasConError: errores.length,
      gastosValidos,
      errores,
      filasParseadas: filasParseadas || []
    };
  };

  // POST importar Excel de gastos materiales (DEBE IR ANTES DE /:id)
  app.post('/api/cmms/gastos-materiales/importar-excel', requireAuth, requireCMMSFullAccess, upload.single('file'), asyncHandler(async (req: any, res: any) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No se envió ningún archivo' });
      }

      const isPreview = req.query.preview === 'true';

      // Usar función compartida de parsing y validación
      const resultado = await parseAndValidateGastosExcel(req.file.buffer, isPreview ? 'preview' : 'import');

      // Si es preview, solo retornar datos parseados sin guardar
      if (isPreview) {
        return res.json({
          mode: 'preview',
          totalFilas: resultado.totalFilas,
          filasValidas: resultado.filasValidas,
          filasConError: resultado.filasConError,
          filasParseadas: resultado.filasParseadas,
          errores: resultado.errores
        });
      }

      // Si no es preview, proceder con la importación
      const gastosCreados = [];
      for (const gastoData of resultado.gastosValidos) {
        const gastoCreado = await storage.createGastoMaterialMantencion(gastoData);
        gastosCreados.push(gastoCreado);
      }

      res.status(201).json({
        mode: 'import',
        message: `Importación completada: ${gastosCreados.length} gastos creados, ${resultado.filasConError} errores`,
        gastosCreados: gastosCreados.length,
        errores: resultado.errores.length > 0 ? resultado.errores : null
      });

    } catch (error: any) {
      console.error('Error al importar Excel:', error);
      res.status(500).json({ message: 'Error al importar Excel', error: error.message });
    }
  }));

  // GET gasto by ID
  app.get('/api/cmms/gastos-materiales/:id', requireAuth, requireCMMSFullAccess, asyncHandler(async (req: any, res: any) => {
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
  app.post('/api/cmms/gastos-materiales', requireAuth, requireCMMSFullAccess, asyncHandler(async (req: any, res: any) => {
    try {
      console.log('[DEBUG] Datos recibidos en POST gastos-materiales:', JSON.stringify(req.body, null, 2));

      // Validate input with Zod schema
      const validatedData = insertGastoMaterialMantencionSchema.parse(req.body);

      const gasto = await storage.createGastoMaterialMantencion(validatedData);
      res.status(201).json(gasto);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        console.error('[DEBUG] Error de validación Zod:', JSON.stringify(error.errors, null, 2));
        return res.status(400).json({ message: 'Datos inválidos', errors: error.errors });
      }
      console.error('Error al crear gasto:', error);
      res.status(500).json({ message: 'Error al crear gasto', error: error.message });
    }
  }));

  // PUT update gasto (full update)
  app.put('/api/cmms/gastos-materiales/:id', requireAuth, requireCMMSFullAccess, asyncHandler(async (req: any, res: any) => {
    try {
      // Validate input with Zod schema (full update)
      const validatedData = insertGastoMaterialMantencionSchema.parse(req.body);

      // Recalculate costoTotal server-side to prevent tampering
      const cantidad = parseFloat(validatedData.cantidad);
      const costoUnitario = parseFloat(validatedData.costoUnitario);
      const costoTotal = (cantidad * costoUnitario).toString();

      const dataWithRecalculatedTotal = {
        ...validatedData,
        costoTotal
      };

      const gasto = await storage.updateGastoMaterialMantencion(req.params.id, dataWithRecalculatedTotal);
      res.json(gasto);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: 'Datos inválidos', errors: error.errors });
      }
      console.error('Error al actualizar gasto:', error);
      res.status(500).json({ message: 'Error al actualizar gasto', error: error.message });
    }
  }));

  // PATCH update gasto (partial update)
  app.patch('/api/cmms/gastos-materiales/:id', requireAuth, requireCMMSFullAccess, asyncHandler(async (req: any, res: any) => {
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
  app.delete('/api/cmms/gastos-materiales/:id', requireAuth, requireCMMSFullAccess, asyncHandler(async (req: any, res: any) => {
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
  app.get('/api/cmms/planes-preventivos', requireAuth, requireCMMSMaintenance, asyncHandler(async (req: any, res: any) => {
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
  app.get('/api/cmms/planes-preventivos/vencidos', requireAuth, requireCMMSMaintenance, asyncHandler(async (req: any, res: any) => {
    try {
      const planes = await storage.getPlanesPreventivosVencidos();
      res.json(planes);
    } catch (error: any) {
      console.error('Error al obtener planes vencidos:', error);
      res.status(500).json({ message: 'Error al obtener planes vencidos', error: error.message });
    }
  }));

  // GET plan preventivo by ID
  app.get('/api/cmms/planes-preventivos/:id', requireAuth, requireCMMSMaintenance, asyncHandler(async (req: any, res: any) => {
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
  app.post('/api/cmms/planes-preventivos', requireAuth, requireCMMSMaintenance, asyncHandler(async (req: any, res: any) => {
    try {
      console.log('[PLANES-PREVENTIVOS] POST - Datos recibidos:', JSON.stringify(req.body, null, 2));
      const validatedData = insertPlanPreventivoSchema.parse(req.body);
      console.log('[PLANES-PREVENTIVOS] Datos validados:', JSON.stringify(validatedData, null, 2));
      const plan = await storage.createPlanPreventivo(validatedData);
      console.log('[PLANES-PREVENTIVOS] Plan creado exitosamente:', plan.id);

      // 🔧 AUTO-GENERAR OT si el plan está activo y la fecha de próxima ejecución es hoy o anterior
      if (plan.activo && plan.proximaEjecucion) {
        const now = new Date();
        const proximaEjecucion = new Date(plan.proximaEjecucion);

        // Comparar solo las fechas (sin horas)
        now.setHours(0, 0, 0, 0);
        proximaEjecucion.setHours(0, 0, 0, 0);

        if (proximaEjecucion <= now) {
          console.log(`🔧 [AUTO-GEN] Plan ${plan.id} tiene fecha <= hoy y está activo, generando OT automáticamente...`);
          try {
            const ot = await storage.generateOTFromPlan(plan);
            console.log(`✅ [AUTO-GEN] OT ${ot.id} generada automáticamente para plan ${plan.nombrePlan}`);

            // Calcular próxima ejecución
            const nextExecution = storage.calculateNextExecution(
              proximaEjecucion,
              plan.frecuencia
            );

            // Actualizar el plan con la nueva próxima ejecución
            await storage.updatePlanPreventivo(plan.id, {
              proximaEjecucion: nextExecution.toISOString().split('T')[0],
            });
          } catch (otError: any) {
            console.error(`❌ [AUTO-GEN] Error generando OT para plan ${plan.id}:`, otError.message);
            // No fallar toda la operación, solo registrar el error
          }
        }
      }

      res.status(201).json(plan);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        console.error('[PLANES-PREVENTIVOS] Error de validación Zod:', JSON.stringify(error.errors, null, 2));
        return res.status(400).json({ message: 'Datos inválidos', errors: error.errors });
      }
      console.error('[PLANES-PREVENTIVOS] Error al crear plan:', error);
      res.status(500).json({ message: 'Error al crear plan', error: error.message });
    }
  }));

  // PATCH update plan preventivo
  app.patch('/api/cmms/planes-preventivos/:id', requireAuth, requireCMMSMaintenance, asyncHandler(async (req: any, res: any) => {
    try {
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
  app.delete('/api/cmms/planes-preventivos/:id', requireAuth, requireCMMSFullAccess, asyncHandler(async (req: any, res: any) => {
    try {
      await storage.deletePlanPreventivo(req.params.id);
      res.json({ message: 'Plan eliminado exitosamente' });
    } catch (error: any) {
      console.error('Error al eliminar plan:', error);
      res.status(500).json({ message: 'Error al eliminar plan', error: error.message });
    }
  }));

  // ===== PLANES PREVENTIVOS ROUTES =====

  // GET planes preventivos (with filters)
  app.get('/api/cmms/planes-preventivos', requireAuth, requireCMMSMaintenance, asyncHandler(async (req: any, res: any) => {
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
  app.get('/api/cmms/planes-preventivos/vencidos', requireAuth, requireCMMSMaintenance, asyncHandler(async (req: any, res: any) => {
    try {
      const planes = await storage.getPlanesPreventivosVencidos();
      res.json(planes);
    } catch (error: any) {
      console.error('Error al obtener planes vencidos:', error);
      res.status(500).json({ message: 'Error al obtener planes vencidos', error: error.message });
    }
  }));

  // GET plan preventivo by ID
  app.get('/api/cmms/planes-preventivos/:id', requireAuth, requireCMMSMaintenance, asyncHandler(async (req: any, res: any) => {
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

  // PATCH update plan preventivo
  app.patch('/api/cmms/planes-preventivos/:id', requireAuth, requireCMMSMaintenance, asyncHandler(async (req: any, res: any) => {
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
  app.delete('/api/cmms/planes-preventivos/:id', requireAuth, requireCMMSFullAccess, asyncHandler(async (req: any, res: any) => {
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
  app.get('/api/cmms/mantenciones-planificadas', requireAuth, requireCMMSMaintenance, asyncHandler(async (req: any, res: any) => {
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
  app.get('/api/cmms/mantenciones-planificadas/:id', requireAuth, requireCMMSMaintenance, asyncHandler(async (req: any, res: any) => {
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
  app.post('/api/cmms/mantenciones-planificadas', requireAuth, requireCMMSMaintenance, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      console.log('[MANTENCION-CREATE] Body recibido:', JSON.stringify(req.body, null, 2));
      const validatedData = insertMantencionPlanificadaSchema.parse(req.body);
      console.log('[MANTENCION-CREATE] Datos validados:', JSON.stringify(validatedData, null, 2));

      const nuevaMantencion = await storage.createMantencionPlanificada({
        ...validatedData,
        creadoPorId: user.id,
        creadoPorName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
      });

      console.log('[MANTENCION-CREATE] Mantención creada exitosamente:', nuevaMantencion.id);
      res.status(201).json(nuevaMantencion);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        console.error('[MANTENCION-CREATE] Error de validación Zod:', JSON.stringify(error.errors, null, 2));
        return res.status(400).json({ message: 'Datos inválidos', errors: error.errors });
      }
      console.error('Error al crear mantención planificada:', error);
      res.status(500).json({ message: 'Error al crear mantención planificada', error: error.message });
    }
  }));

  // PATCH actualizar mantención planificada
  app.patch('/api/cmms/mantenciones-planificadas/:id', requireAuth, requireCMMSMaintenance, asyncHandler(async (req: any, res: any) => {
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
  app.delete('/api/cmms/mantenciones-planificadas/:id', requireAuth, requireCMMSFullAccess, asyncHandler(async (req: any, res: any) => {
    try {
      await storage.deleteMantencionPlanificada(req.params.id);
      res.json({ message: 'Mantención planificada eliminada exitosamente' });
    } catch (error: any) {
      console.error('Error al eliminar mantención planificada:', error);
      res.status(500).json({ message: 'Error al eliminar mantención planificada', error: error.message });
    }
  }));

  // GET presupuesto ejecutado del mes (gastos reales de OTs)
  app.get('/api/cmms/presupuesto-ejecutado/:anio/:mes', requireAuth, requireCMMSFullAccess, asyncHandler(async (req: any, res: any) => {
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
  app.get('/api/cmms/metrics', requireAuth, requireCMMSFullAccess, asyncHandler(async (req: any, res: any) => {
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
  app.post('/api/cmms/scheduler/run-preventive', requireAuth, requireCMMSFullAccess, asyncHandler(async (req: any, res: any) => {
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
  app.post('/api/marketing/presupuesto', requireCommercialAccess, asyncHandler(async (req: any, res: any) => {
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

  app.get('/api/marketing/presupuesto/:mes/:anio', requireCommercialAccess, asyncHandler(async (req: any, res: any) => {
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

  // Presupuesto Marketing Items (tabla Excel) routes
  app.get('/api/marketing/presupuesto-items/:anio', requireCommercialAccess, asyncHandler(async (req: any, res: any) => {
    try {
      const anio = parseInt(req.params.anio);
      const items = await storage.getPresupuestoMarketingItems(anio);
      res.json(items);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al obtener items de presupuesto', error: error.message });
    }
  }));

  app.post('/api/marketing/presupuesto-items', requireCommercialAccess, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      if (user.role !== 'admin' && user.role !== 'supervisor') {
        return res.status(403).json({ message: 'No autorizado' });
      }
      const item = await storage.createPresupuestoMarketingItem(req.body);
      res.status(201).json(item);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al crear item de presupuesto', error: error.message });
    }
  }));

  app.patch('/api/marketing/presupuesto-items/:id', requireCommercialAccess, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      if (user.role !== 'admin' && user.role !== 'supervisor') {
        return res.status(403).json({ message: 'No autorizado' });
      }
      const item = await storage.updatePresupuestoMarketingItem(req.params.id, req.body);
      res.json(item);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al actualizar item de presupuesto', error: error.message });
    }
  }));

  app.delete('/api/marketing/presupuesto-items/:id', requireCommercialAccess, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      if (user.role !== 'admin') {
        return res.status(403).json({ message: 'No autorizado' });
      }
      await storage.deletePresupuestoMarketingItem(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: 'Error al eliminar item de presupuesto', error: error.message });
    }
  }));

  // Creatividades Marketing routes
  app.get('/api/marketing/creatividades', requireCommercialAccess, asyncHandler(async (req: any, res: any) => {
    try {
      const mes = parseInt(req.query.mes as string) || new Date().getMonth() + 1;
      const anio = parseInt(req.query.anio as string) || new Date().getFullYear();
      const items = await storage.getCreatividadesMarketing(mes, anio);
      res.json(items);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al obtener creatividades', error: error.message });
    }
  }));

  app.post('/api/marketing/creatividades', requireCommercialAccess, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      const item = await storage.createCreatividadMarketing({
        ...req.body,
        creadoPorId: user.id.toString(),
      });
      res.status(201).json(item);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al crear creatividad', error: error.message });
    }
  }));

  app.patch('/api/marketing/creatividades/:id', requireCommercialAccess, asyncHandler(async (req: any, res: any) => {
    try {
      const item = await storage.updateCreatividadMarketing(req.params.id, req.body);
      res.json(item);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al actualizar creatividad', error: error.message });
    }
  }));

  app.delete('/api/marketing/creatividades/:id', requireCommercialAccess, asyncHandler(async (req: any, res: any) => {
    try {
      await storage.deleteCreatividadMarketing(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: 'Error al eliminar creatividad', error: error.message });
    }
  }));

  // Gastos Marketing routes
  app.get('/api/marketing/gastos', requireCommercialAccess, asyncHandler(async (req: any, res: any) => {
    try {
      const { mes, anio } = req.query;
      if (!mes || !anio) {
        return res.status(400).json({ message: 'mes y anio son requeridos' });
      }
      const gastos = await storage.getGastosMarketing(parseInt(mes as string), parseInt(anio as string));
      res.json(gastos);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al obtener gastos', error: error.message });
    }
  }));

  app.get('/api/marketing/gastos/anio/:anio', requireCommercialAccess, asyncHandler(async (req: any, res: any) => {
    try {
      const gastos = await storage.getGastosMarketingByAnio(parseInt(req.params.anio));
      res.json(gastos);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al obtener gastos', error: error.message });
    }
  }));

  app.post('/api/marketing/gastos', requireCommercialAccess, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      if (user.role !== 'admin' && user.role !== 'supervisor') {
        return res.status(403).json({ message: 'Solo admin/supervisor pueden registrar gastos' });
      }
      const gasto = await storage.createGastoMarketing({
        ...req.body,
        creadoPorId: user.id,
      });
      res.json(gasto);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al crear gasto', error: error.message });
    }
  }));

  app.patch('/api/marketing/gastos/:id', requireCommercialAccess, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      if (user.role !== 'admin' && user.role !== 'supervisor') {
        return res.status(403).json({ message: 'Solo admin/supervisor pueden editar gastos' });
      }
      const gasto = await storage.updateGastoMarketing(req.params.id, req.body);
      res.json(gasto);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al actualizar gasto', error: error.message });
    }
  }));

  app.delete('/api/marketing/gastos/:id', requireCommercialAccess, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      if (user.role !== 'admin' && user.role !== 'supervisor') {
        return res.status(403).json({ message: 'Solo admin/supervisor pueden eliminar gastos' });
      }
      await storage.deleteGastoMarketing(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: 'Error al eliminar gasto', error: error.message });
    }
  }));

  // Add comment to a marketing gasto
  app.post('/api/marketing/gastos/:id/comentarios', requireCommercialAccess, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      const { contenido } = req.body;
      if (!contenido || !contenido.trim()) {
        return res.status(400).json({ message: 'El comentario no puede estar vacío' });
      }

      // Get current gasto by ID
      const [currentGasto] = await db
        .select()
        .from(gastosMarketing)
        .where(eq(gastosMarketing.id, req.params.id));

      if (!currentGasto) {
        return res.status(404).json({ message: 'Gasto no encontrado' });
      }

      const existingComments = (currentGasto.comentarios as any[]) || [];
      const newComment = {
        autor: user.name || user.username || 'Usuario',
        autorId: user.id,
        contenido: contenido.trim(),
        fecha: new Date().toISOString(),
      };

      const updatedGasto = await storage.updateGastoMarketing(req.params.id, {
        comentarios: [...existingComments, newComment],
      } as any);

      res.json(updatedGasto);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al agregar comentario', error: error.message });
    }
  }));

  // Creatividades approval routes
  app.patch('/api/marketing/creatividades/:id/aprobar', requireCommercialAccess, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      if (user.role !== 'admin' && user.role !== 'supervisor') {
        return res.status(403).json({ message: 'Solo admin/supervisor pueden aprobar ideas' });
      }
      const result = await storage.updateCreatividadMarketing(req.params.id, {
        estadoAprobacion: 'aprobada',
        aprobadoPorId: user.id,
        motivoRechazo: null,
      });
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al aprobar', error: error.message });
    }
  }));

  app.patch('/api/marketing/creatividades/:id/rechazar', requireCommercialAccess, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      if (user.role !== 'admin' && user.role !== 'supervisor') {
        return res.status(403).json({ message: 'Solo admin/supervisor pueden rechazar ideas' });
      }
      const { motivoRechazo } = req.body;
      const result = await storage.updateCreatividadMarketing(req.params.id, {
        estadoAprobacion: 'rechazada',
        aprobadoPorId: user.id,
        motivoRechazo: motivoRechazo || 'Sin motivo especificado',
      });
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al rechazar', error: error.message });
    }
  }));

  // Guiones Marketing routes
  app.get('/api/marketing/guiones/:creatividadId', requireCommercialAccess, asyncHandler(async (req: any, res: any) => {
    try {
      const guion = await storage.getGuionByCreatividadId(req.params.creatividadId);
      res.json(guion);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al obtener guión', error: error.message });
    }
  }));

  app.post('/api/marketing/guiones', requireCommercialAccess, asyncHandler(async (req: any, res: any) => {
    try {
      const guion = await storage.createGuionMarketing(req.body);
      res.json(guion);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al crear guión', error: error.message });
    }
  }));

  app.patch('/api/marketing/guiones/:id', requireCommercialAccess, asyncHandler(async (req: any, res: any) => {
    try {
      const guion = await storage.updateGuionMarketing(req.params.id, req.body);
      res.json(guion);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al actualizar guión', error: error.message });
    }
  }));

  // Proveedores Marketing routes
  app.get('/api/marketing/proveedores', requireCommercialAccess, asyncHandler(async (req: any, res: any) => {
    try {
      const proveedores = await storage.getProveedoresMarketing();
      res.json(proveedores);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al obtener proveedores', error: error.message });
    }
  }));

  app.post('/api/marketing/proveedores', requireCommercialAccess, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      if (user.role !== 'admin' && user.role !== 'supervisor') {
        return res.status(403).json({ message: 'Solo admin/supervisor pueden crear proveedores' });
      }
      const proveedor = await storage.createProveedorMarketing(req.body);
      res.json(proveedor);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al crear proveedor', error: error.message });
    }
  }));

  app.patch('/api/marketing/proveedores/:id', requireCommercialAccess, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      if (user.role !== 'admin' && user.role !== 'supervisor') {
        return res.status(403).json({ message: 'Solo admin/supervisor pueden editar proveedores' });
      }
      const proveedor = await storage.updateProveedorMarketing(req.params.id, req.body);
      res.json(proveedor);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al actualizar proveedor', error: error.message });
    }
  }));

  app.delete('/api/marketing/proveedores/:id', requireCommercialAccess, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      if (user.role !== 'admin' && user.role !== 'supervisor') {
        return res.status(403).json({ message: 'Solo admin/supervisor pueden eliminar proveedores' });
      }
      await storage.deleteProveedorMarketing(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: 'Error al eliminar proveedor', error: error.message });
    }
  }));

  // Solicitudes Marketing routes
  app.post('/api/marketing/solicitudes', requireCommercialAccess, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;

      // Admin, supervisor and salesperson can create solicitudes
      if (user.role !== 'supervisor' && user.role !== 'admin' && user.role !== 'salesperson') {
        return res.status(403).json({ message: 'Solo administradores, supervisores y vendedores pueden crear solicitudes' });
      }

      let solicitanteId = user.id;
      let solicitanteName = `${user.firstName} ${user.lastName}`;

      // If admin is creating, they can specify solicitanteId
      if (user.role === 'admin' && req.body.solicitanteId) {
        const solicitante = await storage.getUser(parseInt(req.body.solicitanteId));
        if (!solicitante) {
          return res.status(404).json({ message: 'Solicitante no encontrado' });
        }

        // Only allow admin, supervisor or salesperson roles
        if (!['admin', 'supervisor', 'salesperson'].includes(solicitante.role)) {
          return res.status(400).json({ message: 'El usuario seleccionado debe ser administrador, supervisor o vendedor' });
        }

        solicitanteId = solicitante.id;
        solicitanteName = `${solicitante.firstName} ${solicitante.lastName}`;
      } else if ((user.role === 'supervisor' || user.role === 'salesperson') && req.body.solicitanteId) {
        // Supervisors and salespersons can only create for themselves
        if (parseInt(req.body.solicitanteId) !== user.id) {
          return res.status(403).json({ message: 'Solo puedes crear solicitudes a tu nombre' });
        }
      }

      // Prepare solicitud data - use supervisorId field for backwards compatibility
      const solicitudData: any = {
        ...req.body,
        supervisorId: solicitanteId.toString(),
        supervisorName: solicitanteName,
      };

      // Convert fechaEntrega to proper format if provided
      if (solicitudData.fechaEntrega) {
        // Ensure it's in YYYY-MM-DD format (remove time if present)
        solicitudData.fechaEntrega = solicitudData.fechaEntrega.split('T')[0];
      }

      // Validate urgency limit: max 3 "alta" urgency solicitudes per user
      if (solicitudData.urgencia === 'alta') {
        const urgentSolicitudes = await storage.getSolicitudesMarketingByUrgency(solicitanteId.toString(), 'alta');
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
        solicitanteName
      );

      res.status(201).json(solicitud);
    } catch (error: any) {
      console.error('Error creating marketing solicitud:', error);
      res.status(500).json({ message: 'Error al crear solicitud', error: error.message });
    }
  }));

  // Endpoint para obtener solicitantes (admin, supervisor, vendedor)
  app.get('/api/marketing/solicitantes', requireCommercialAccess, asyncHandler(async (req: any, res: any) => {
    try {
      const solicitantes = await storage.getMarketingSolicitantes();
      res.json(solicitantes);
    } catch (error: any) {
      console.error('Error getting marketing solicitantes:', error);
      res.status(500).json({ message: 'Error al obtener solicitantes', error: error.message });
    }
  }));

  app.get('/api/marketing/solicitudes', requireCommercialAccess, asyncHandler(async (req: any, res: any) => {
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

  app.get('/api/marketing/solicitudes/:id', requireCommercialAccess, asyncHandler(async (req: any, res: any) => {
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

  app.patch('/api/marketing/solicitudes/:id', requireCommercialAccess, asyncHandler(async (req: any, res: any) => {
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

  app.delete('/api/marketing/solicitudes/:id', requireCommercialAccess, asyncHandler(async (req: any, res: any) => {
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
  app.post('/api/marketing/solicitudes/:id/estado', requireCommercialAccess, asyncHandler(async (req: any, res: any) => {
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
  app.patch('/api/marketing/solicitudes/:id/pasos', requireCommercialAccess, asyncHandler(async (req: any, res: any) => {
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
  app.patch('/api/marketing/solicitudes/:id/pasos/:index/toggle', requireCommercialAccess, asyncHandler(async (req: any, res: any) => {
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
  app.patch('/api/marketing/solicitudes/:id/notas', requireCommercialAccess, asyncHandler(async (req: any, res: any) => {
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

  // Upload imagen de referencia para solicitud de marketing
  app.post('/api/marketing/solicitudes/:id/imagen', requireCommercialAccess, upload.single('imagen'), asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      const solicitud = await storage.getSolicitudMarketingById(req.params.id);

      if (!solicitud) {
        return res.status(404).json({ message: 'Solicitud no encontrada' });
      }

      // Supervisor can upload to their own solicitudes, admin can upload to all
      if (user.role === 'supervisor' && solicitud.supervisorId !== user.id) {
        return res.status(403).json({ message: 'No autorizado' });
      }

      if (user.role !== 'admin' && user.role !== 'supervisor') {
        return res.status(403).json({ message: 'No autorizado' });
      }

      const file = req.file as Express.Multer.File;
      if (!file) {
        return res.status(400).json({ message: 'No se subió ninguna imagen' });
      }

      // Upload to object storage
      const fileName = `marketing/referencias/${req.params.id}/${nanoid()}_${file.originalname}`;
      const objectStorage = new ObjectStorageService();
      const uploadResult = await objectStorage.uploadFile(fileName, file.buffer, {
        contentType: file.mimetype,
      });

      // Update solicitud with image URL
      const updated = await storage.updateSolicitudMarketing(req.params.id, {
        urlReferencia: uploadResult.publicUrl || fileName
      });

      res.json({
        success: true,
        urlReferencia: uploadResult.publicUrl || fileName,
        solicitud: updated
      });
    } catch (error: any) {
      console.error('Error al subir imagen de referencia:', error);
      res.status(500).json({ message: 'Error al subir imagen', error: error.message });
    }
  }));

  // Marketing metrics
  app.get('/api/marketing/metrics/:mes/:anio', requireCommercialAccess, asyncHandler(async (req: any, res: any) => {
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
  app.post('/api/marketing/inventario', requireCommercialAccess, asyncHandler(async (req: any, res: any) => {
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

  app.get('/api/marketing/inventario', requireCommercialAccess, asyncHandler(async (req: any, res: any) => {
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

  app.get('/api/marketing/inventario/summary', requireCommercialAccess, asyncHandler(async (req: any, res: any) => {
    try {
      const summary = await storage.getInventarioMarketingSummary();
      res.json(summary);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al obtener resumen de inventario', error: error.message });
    }
  }));

  app.get('/api/marketing/inventario/:id', requireCommercialAccess, asyncHandler(async (req: any, res: any) => {
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

  app.patch('/api/marketing/inventario/:id', requireCommercialAccess, asyncHandler(async (req: any, res: any) => {
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

  app.delete('/api/marketing/inventario/:id', requireCommercialAccess, asyncHandler(async (req: any, res: any) => {
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

  app.post('/api/marketing/inventario/:id/movimientos', requireCommercialAccess, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      const itemId = req.params.id;

      const movementData = {
        ...req.body,
        itemId,
        usuarioId: user.id.toString(),
        usuarioNombre: `${user.firstName} ${user.lastName}`,
      };

      const movimiento = await storage.createInventarioMarketingMovimiento(movementData);
      res.status(201).json(movimiento);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al registrar movimiento', error: error.message });
    }
  }));

  app.get('/api/marketing/inventario/:id/movimientos', requireCommercialAccess, asyncHandler(async (req: any, res: any) => {
    try {
      const movimientos = await storage.getInventarioMarketingMovimientosByItemId(req.params.id);
      res.json(movimientos);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al obtener movimientos', error: error.message });
    }
  }));

  // ==================================================================================
  // HITOS DE MARKETING routes
  // ==================================================================================

  // Get all hitos
  app.get('/api/marketing/hitos', requireCommercialAccess, asyncHandler(async (req: any, res: any) => {
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
  app.get('/api/marketing/hitos/:id', requireCommercialAccess, asyncHandler(async (req: any, res: any) => {
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
  app.post('/api/marketing/hitos', requireCommercialAccess, asyncHandler(async (req: any, res: any) => {
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
  app.patch('/api/marketing/hitos/:id', requireCommercialAccess, asyncHandler(async (req: any, res: any) => {
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
  app.delete('/api/marketing/hitos/:id', requireCommercialAccess, asyncHandler(async (req: any, res: any) => {
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
  // PRECIOS DE COMPETENCIA routes
  // ==================================================================================

  // Get all competidores
  app.get('/api/marketing/competidores', requireCommercialAccess, asyncHandler(async (req: any, res: any) => {
    try {
      const competidores = await storage.getCompetidores();
      res.json(competidores);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al obtener competidores', error: error.message });
    }
  }));

  // Create competidor
  app.post('/api/marketing/competidores', requireCommercialAccess, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      if (user.role !== 'admin' && user.role !== 'supervisor') {
        return res.status(403).json({ message: 'No tienes permisos para crear competidores' });
      }
      const competidor = await storage.createCompetidor(req.body);
      res.status(201).json(competidor);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al crear competidor', error: error.message });
    }
  }));

  // Update competidor
  app.patch('/api/marketing/competidores/:id', requireCommercialAccess, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      if (user.role !== 'admin' && user.role !== 'supervisor') {
        return res.status(403).json({ message: 'No tienes permisos para editar competidores' });
      }
      const competidor = await storage.updateCompetidor(req.params.id, req.body);
      res.json(competidor);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al actualizar competidor', error: error.message });
    }
  }));

  // Delete competidor
  app.delete('/api/marketing/competidores/:id', requireCommercialAccess, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      if (user.role !== 'admin') {
        return res.status(403).json({ message: 'Solo admin puede eliminar competidores' });
      }
      await storage.deleteCompetidor(req.params.id);
      res.json({ message: 'Competidor eliminado correctamente' });
    } catch (error: any) {
      res.status(500).json({ message: 'Error al eliminar competidor', error: error.message });
    }
  }));

  // ==================================================================================
  // PRODUCTOS MONITOREO routes (Productos propios para monitoreo de precios)
  // ==================================================================================

  // Get all productos monitoreo
  app.get('/api/marketing/productos-monitoreo', requireCommercialAccess, asyncHandler(async (req: any, res: any) => {
    try {
      const { activo, search } = req.query;
      const filters: any = {};
      // Por defecto solo mostrar productos activos, a menos que se pida explícitamente ver todos
      if (activo === 'false') {
        filters.activo = false;
      } else {
        filters.activo = true; // Por defecto solo activos
      }
      if (search) filters.search = search;

      const productos = await storage.getProductosMonitoreo(filters);
      res.json(productos);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al obtener productos de monitoreo', error: error.message });
    }
  }));

  // Get single producto monitoreo by ID
  app.get('/api/marketing/productos-monitoreo/:id', requireCommercialAccess, asyncHandler(async (req: any, res: any) => {
    try {
      const producto = await storage.getProductoMonitoreoById(req.params.id);
      if (!producto) {
        return res.status(404).json({ message: 'Producto no encontrado' });
      }
      res.json(producto);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al obtener producto', error: error.message });
    }
  }));

  // Get precios for a specific producto monitoreo
  app.get('/api/marketing/productos-monitoreo/:id/precios', requireCommercialAccess, asyncHandler(async (req: any, res: any) => {
    try {
      const precios = await storage.getPreciosByProductoMonitoreoId(req.params.id);
      res.json(precios);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al obtener precios del producto', error: error.message });
    }
  }));

  // Create producto monitoreo
  app.post('/api/marketing/productos-monitoreo', requireCommercialAccess, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      if (user.role !== 'admin' && user.role !== 'supervisor') {
        return res.status(403).json({ message: 'No tienes permisos para crear productos de monitoreo' });
      }
      const productoData = {
        nombreProducto: req.body.nombreProducto,
        precioListaGL: req.body.precioListaGL ? String(req.body.precioListaGL) : null,
        precioLista14: req.body.precioLista14 ? String(req.body.precioLista14) : null,
        precioListaBalde4: req.body.precioListaBalde4 ? String(req.body.precioListaBalde4) : null,
        precioListaBalde5: req.body.precioListaBalde5 ? String(req.body.precioListaBalde5) : null,
        createdBy: user.id,
      };
      const producto = await storage.createProductoMonitoreo(productoData);
      res.status(201).json(producto);
    } catch (error: any) {
      console.error('[ERROR] Error creating producto monitoreo:', error);
      res.status(500).json({ message: 'Error al crear producto de monitoreo', error: error.message });
    }
  }));

  // Update producto monitoreo
  app.patch('/api/marketing/productos-monitoreo/:id', requireCommercialAccess, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      if (user.role !== 'admin' && user.role !== 'supervisor') {
        return res.status(403).json({ message: 'No tienes permisos para editar productos de monitoreo' });
      }
      const producto = await storage.updateProductoMonitoreo(req.params.id, req.body);
      res.json(producto);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al actualizar producto', error: error.message });
    }
  }));

  // Delete producto monitoreo (soft delete)
  app.delete('/api/marketing/productos-monitoreo/:id', requireCommercialAccess, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      if (user.role !== 'admin') {
        return res.status(403).json({ message: 'Solo admin puede eliminar productos de monitoreo' });
      }
      await storage.deleteProductoMonitoreo(req.params.id);
      res.json({ message: 'Producto eliminado correctamente' });
    } catch (error: any) {
      res.status(500).json({ message: 'Error al eliminar producto', error: error.message });
    }
  }));

  // ==================================================================================
  // PRECIOS DE COMPETENCIA routes
  // ==================================================================================

  // Get all precios competencia with filters
  app.get('/api/marketing/precios-competencia', requireCommercialAccess, asyncHandler(async (req: any, res: any) => {
    try {
      const { productoMonitoreoId, competidorId, fechaDesde, fechaHasta, search } = req.query;
      const filters: any = {};
      if (productoMonitoreoId) filters.productoMonitoreoId = productoMonitoreoId;
      if (competidorId) filters.competidorId = competidorId;
      if (fechaDesde) filters.fechaDesde = fechaDesde;
      if (fechaHasta) filters.fechaHasta = fechaHasta;
      if (search) filters.search = search;

      const precios = await storage.getPreciosCompetencia(filters);
      res.json(precios);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al obtener precios de competencia', error: error.message });
    }
  }));

  // Get single precio by ID
  app.get('/api/marketing/precios-competencia/:id', requireCommercialAccess, asyncHandler(async (req: any, res: any) => {
    try {
      const precio = await storage.getPrecioCompetenciaById(req.params.id);
      if (!precio) {
        return res.status(404).json({ message: 'Precio no encontrado' });
      }
      res.json(precio);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al obtener precio', error: error.message });
    }
  }));

  // Create precio competencia
  app.post('/api/marketing/precios-competencia', requireCommercialAccess, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      const { productoMonitoreoId, competidorId, precioWeb, precioFerreteria, precioConstruccion, notas, urlReferencia } = req.body;
      const precioData = {
        productoMonitoreoId,
        competidorId,
        precioWeb: precioWeb && precioWeb !== '' ? precioWeb : null,
        precioFerreteria: precioFerreteria && precioFerreteria !== '' ? precioFerreteria : null,
        precioConstruccion: precioConstruccion && precioConstruccion !== '' ? precioConstruccion : null,
        notas: notas || null,
        urlReferencia: urlReferencia || null,
        createdBy: user.id,
      };
      const precio = await storage.createPrecioCompetencia(precioData);
      res.status(201).json(precio);
    } catch (error: any) {
      console.error('[PRECIO-COMPETENCIA] Error creating precio:', error);
      res.status(500).json({ message: 'Error al crear precio de competencia', error: error.message });
    }
  }));

  // Update precio competencia
  app.patch('/api/marketing/precios-competencia/:id', requireCommercialAccess, asyncHandler(async (req: any, res: any) => {
    try {
      const precio = await storage.updatePrecioCompetencia(req.params.id, req.body);
      res.json(precio);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al actualizar precio', error: error.message });
    }
  }));

  // Delete precio competencia
  app.delete('/api/marketing/precios-competencia/:id', requireCommercialAccess, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      if (user.role !== 'admin' && user.role !== 'supervisor') {
        return res.status(403).json({ message: 'No tienes permisos para eliminar precios' });
      }
      await storage.deletePrecioCompetencia(req.params.id);
      res.json({ message: 'Precio eliminado correctamente' });
    } catch (error: any) {
      res.status(500).json({ message: 'Error al eliminar precio', error: error.message });
    }
  }));

  // ==================================================================================
  // TAREAS DE MARKETING routes
  // ==================================================================================

  // Get all tareas with filters
  app.get('/api/marketing/tareas', requireCommercialAccess, asyncHandler(async (req: any, res: any) => {
    try {
      const { mes, anio, estado, asignadoAId, incluirPorFechaLimite } = req.query;

      const filters: any = {
        tipo: 'marketing', // Solo mostrar tareas de marketing
      };
      if (mes) filters.mes = parseInt(mes);
      if (anio) filters.anio = parseInt(anio);
      if (estado) filters.estado = estado;
      if (asignadoAId) filters.asignadoAId = asignadoAId;
      if (incluirPorFechaLimite === 'true') filters.incluirPorFechaLimite = true;

      const tareas = await storage.getTareasMarketing(filters);
      res.json(tareas);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al obtener tareas', error: error.message });
    }
  }));

  // Get single tarea by ID
  app.get('/api/marketing/tareas/:id', requireCommercialAccess, asyncHandler(async (req: any, res: any) => {
    try {
      const tarea = await storage.getTareaMarketingById(req.params.id);
      if (!tarea) {
        return res.status(404).json({ message: 'Tarea no encontrada' });
      }
      res.json(tarea);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al obtener tarea', error: error.message });
    }
  }));

  // Create new tarea
  app.post('/api/marketing/tareas', requireCommercialAccess, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;

      // Only admin and supervisor can create tareas
      if (user.role !== 'admin' && user.role !== 'supervisor') {
        return res.status(403).json({ message: 'Solo admin y supervisor pueden crear tareas' });
      }

      const tareaData = {
        ...req.body,
        tipo: 'marketing', // Siempre tipo marketing cuando se crea desde el módulo de marketing
        creadoPorId: user.id,
        creadoPorNombre: user.salespersonName || `${user.firstName} ${user.lastName}`,
      };

      const tarea = await storage.createTareaMarketing(tareaData);
      res.status(201).json(tarea);
    } catch (error: any) {
      console.error('Error creating marketing tarea:', error);
      res.status(500).json({ message: 'Error al crear tarea', error: error.message });
    }
  }));

  // Update tarea
  app.patch('/api/marketing/tareas/:id', requireCommercialAccess, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      const tarea = await storage.getTareaMarketingById(req.params.id);

      if (!tarea) {
        return res.status(404).json({ message: 'Tarea no encontrada' });
      }

      // Admin can update any tarea, others can only update if they created it or are assigned
      if (user.role !== 'admin' && tarea.creadoPorId !== user.id && tarea.asignadoAId !== user.id) {
        return res.status(403).json({ message: 'No autorizado para modificar esta tarea' });
      }

      const updated = await storage.updateTareaMarketing(req.params.id, req.body);
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al actualizar tarea', error: error.message });
    }
  }));

  // Toggle tarea estado
  app.post('/api/marketing/tareas/:id/toggle', requireCommercialAccess, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      const tarea = await storage.getTareaMarketingById(req.params.id);

      if (!tarea) {
        return res.status(404).json({ message: 'Tarea no encontrada' });
      }

      // Admin and supervisor can toggle any tarea, assigned users can toggle their own
      if (user.role !== 'admin' && user.role !== 'supervisor' && tarea.asignadoAId !== user.id) {
        return res.status(403).json({ message: 'No autorizado para modificar el estado de esta tarea' });
      }

      const updated = await storage.toggleTareaMarketingEstado(req.params.id);
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al cambiar estado de tarea', error: error.message });
    }
  }));

  // Delete tarea
  app.delete('/api/marketing/tareas/:id', requireCommercialAccess, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;

      // Only admin can delete tareas
      if (user.role !== 'admin') {
        return res.status(403).json({ message: 'Solo admin puede eliminar tareas' });
      }

      await storage.deleteTareaMarketing(req.params.id);
      res.json({ message: 'Tarea eliminada correctamente' });
    } catch (error: any) {
      res.status(500).json({ message: 'Error al eliminar tarea', error: error.message });
    }
  }));

  // ==================================================================================
  // TAREAS GENERALES routes (Sistema unificado de tareas)
  // ==================================================================================

  // Get all tareas with role-based filtering
  app.get('/api/tareas', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      const { mes, anio, estado, tipo, asignadoAId } = req.query;

      // Solo admin, supervisor y salesperson pueden acceder
      if (!['admin', 'supervisor', 'salesperson'].includes(user.role)) {
        return res.status(403).json({ message: 'No tienes permisos para acceder a las tareas' });
      }

      const filters: any = {};
      if (mes) filters.mes = parseInt(mes);
      if (anio) filters.anio = parseInt(anio);
      if (estado) filters.estado = estado;
      if (tipo) filters.tipo = tipo;

      // Aplicar filtros según rol
      if (user.role === 'salesperson') {
        // Vendedor solo ve sus propias tareas asignadas
        filters.asignadoAId = user.id;
      } else if (user.role === 'supervisor') {
        // Supervisor ve sus tareas y las de sus vendedores
        if (asignadoAId) {
          filters.asignadoAId = asignadoAId;
        } else {
          const vendedores = await storage.getVendedoresBySupervisor(user.id);
          const vendedorIds = vendedores.map(v => v.id);
          vendedorIds.push(user.id); // Incluir al supervisor mismo
          filters.asignadoAIds = vendedorIds;
        }
      } else if (user.role === 'admin') {
        // Admin puede filtrar por asignadoAId si lo proporciona
        if (asignadoAId) filters.asignadoAId = asignadoAId;
      }

      const tareas = await storage.getTareasMarketing(filters);
      res.json(tareas);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al obtener tareas', error: error.message });
    }
  }));

  // Get available users for task assignment (based on role) - MUST be before /:id route
  app.get('/api/tareas/usuarios-asignables', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;

      if (user.role !== 'admin' && user.role !== 'supervisor') {
        return res.status(403).json({ message: 'No tienes permisos para ver usuarios asignables' });
      }

      let usuarios: any[] = [];

      if (user.role === 'admin') {
        // Admin puede asignar a cualquier usuario con rol comercial
        const allUsers = await storage.getAllUsers();
        usuarios = allUsers.filter((u: any) => ['admin', 'supervisor', 'salesperson'].includes(u.role));
      } else if (user.role === 'supervisor') {
        // Supervisor puede asignar a sí mismo y a sus vendedores
        const vendedores = await storage.getVendedoresBySupervisor(user.id);
        const currentUser = await storage.getUserById(user.id);
        usuarios = [currentUser, ...vendedores].filter(Boolean);
      }

      res.json(usuarios.map((u: any) => ({
        id: u.id,
        nombre: u.salespersonName || `${u.firstName || ''} ${u.lastName || ''}`.trim(),
        role: u.role,
        email: u.email,
      })));
    } catch (error: any) {
      res.status(500).json({ message: 'Error al obtener usuarios asignables', error: error.message });
    }
  }));

  // Get single tarea by ID
  app.get('/api/tareas/:id', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      const tarea = await storage.getTareaMarketingById(req.params.id);

      if (!tarea) {
        return res.status(404).json({ message: 'Tarea no encontrada' });
      }

      // Verificar permisos de visualización
      if (user.role === 'salesperson' && tarea.asignadoAId !== user.id) {
        return res.status(403).json({ message: 'No tienes permisos para ver esta tarea' });
      }

      if (user.role === 'supervisor') {
        const vendedores = await storage.getVendedoresBySupervisor(user.id);
        const vendedorIds = vendedores.map(v => v.id);
        vendedorIds.push(user.id);
        if (!vendedorIds.includes(tarea.asignadoAId || '') && tarea.asignadoAId !== user.id) {
          return res.status(403).json({ message: 'No tienes permisos para ver esta tarea' });
        }
      }

      res.json(tarea);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al obtener tarea', error: error.message });
    }
  }));

  // Create new tarea
  app.post('/api/tareas', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;

      // Solo admin y supervisor pueden crear tareas
      if (user.role !== 'admin' && user.role !== 'supervisor') {
        return res.status(403).json({ message: 'Solo admin y supervisor pueden crear tareas' });
      }

      const { asignadoAId, tipo = 'general' } = req.body;

      // Validar que supervisor solo puede asignar a sus vendedores
      if (user.role === 'supervisor' && asignadoAId && asignadoAId !== user.id) {
        const vendedores = await storage.getVendedoresBySupervisor(user.id);
        const vendedorIds = vendedores.map(v => v.id);
        if (!vendedorIds.includes(asignadoAId)) {
          return res.status(403).json({ message: 'Solo puedes asignar tareas a tus vendedores' });
        }
      }

      // Obtener nombre del asignado
      let asignadoANombre = null;
      if (asignadoAId) {
        const asignadoUser = await storage.getUserById(asignadoAId);
        if (asignadoUser) {
          asignadoANombre = asignadoUser.salespersonName || `${asignadoUser.firstName || ''} ${asignadoUser.lastName || ''}`.trim();
        }
      }

      const tareaData = {
        ...req.body,
        tipo,
        creadoPorId: user.id,
        creadoPorNombre: user.salespersonName || `${user.firstName || ''} ${user.lastName || ''}`.trim(),
        asignadoANombre,
      };

      const tarea = await storage.createTareaMarketing(tareaData);
      res.status(201).json(tarea);
    } catch (error: any) {
      console.error('Error creating tarea:', error);
      res.status(500).json({ message: 'Error al crear tarea', error: error.message });
    }
  }));

  // Update tarea
  app.patch('/api/tareas/:id', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      const tarea = await storage.getTareaMarketingById(req.params.id);

      if (!tarea) {
        return res.status(404).json({ message: 'Tarea no encontrada' });
      }

      // Verificar permisos de edición
      if (user.role === 'salesperson') {
        // Vendedor solo puede cambiar el estado de sus propias tareas
        if (tarea.asignadoAId !== user.id) {
          return res.status(403).json({ message: 'No tienes permisos para modificar esta tarea' });
        }
        // Solo puede modificar el estado
        const allowedFields = ['estado'];
        const updates: any = {};
        for (const field of allowedFields) {
          if (req.body[field] !== undefined) {
            updates[field] = req.body[field];
          }
        }
        const updated = await storage.updateTareaMarketing(req.params.id, updates);
        return res.json(updated);
      }

      if (user.role === 'supervisor') {
        const vendedores = await storage.getVendedoresBySupervisor(user.id);
        const vendedorIds = vendedores.map(v => v.id);
        vendedorIds.push(user.id);

        // Verificar que la tarea pertenece a su equipo
        if (tarea.creadoPorId !== user.id && !vendedorIds.includes(tarea.asignadoAId || '')) {
          return res.status(403).json({ message: 'No tienes permisos para modificar esta tarea' });
        }

        // Validar que si cambia asignadoAId, sea a alguien de su equipo
        if (req.body.asignadoAId && !vendedorIds.includes(req.body.asignadoAId)) {
          return res.status(403).json({ message: 'Solo puedes asignar tareas a tus vendedores' });
        }
      }

      // Obtener nombre del asignado si cambia
      if (req.body.asignadoAId) {
        const asignadoUser = await storage.getUserById(req.body.asignadoAId);
        if (asignadoUser) {
          req.body.asignadoANombre = asignadoUser.salespersonName || `${asignadoUser.firstName || ''} ${asignadoUser.lastName || ''}`.trim();
        }
      }

      const updated = await storage.updateTareaMarketing(req.params.id, req.body);
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al actualizar tarea', error: error.message });
    }
  }));

  // Toggle tarea estado
  app.post('/api/tareas/:id/toggle', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      const tarea = await storage.getTareaMarketingById(req.params.id);

      if (!tarea) {
        return res.status(404).json({ message: 'Tarea no encontrada' });
      }

      // Verificar permisos
      if (user.role === 'salesperson' && tarea.asignadoAId !== user.id) {
        return res.status(403).json({ message: 'No tienes permisos para modificar esta tarea' });
      }

      if (user.role === 'supervisor') {
        const vendedores = await storage.getVendedoresBySupervisor(user.id);
        const vendedorIds = vendedores.map(v => v.id);
        vendedorIds.push(user.id);
        if (!vendedorIds.includes(tarea.asignadoAId || '')) {
          return res.status(403).json({ message: 'No tienes permisos para modificar esta tarea' });
        }
      }

      const updated = await storage.toggleTareaMarketingEstado(req.params.id);
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al cambiar estado de tarea', error: error.message });
    }
  }));

  // Delete tarea
  app.delete('/api/tareas/:id', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;

      // Solo admin puede eliminar tareas
      if (user.role !== 'admin') {
        return res.status(403).json({ message: 'Solo admin puede eliminar tareas' });
      }

      await storage.deleteTareaMarketing(req.params.id);
      res.json({ message: 'Tarea eliminada correctamente' });
    } catch (error: any) {
      res.status(500).json({ message: 'Error al eliminar tarea', error: error.message });
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
      let inventory = await storage.getInventoryWithPrices(filters);

      // Security: Hide price and value data from salespeople
      if (user && user.role === 'salesperson') {
        inventory = inventory.map((item: any) => {
          const { averagePrice, totalValue, ...rest } = item;
          return rest;
        });
      }

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
      let summary = await storage.getInventorySummaryWithPrices(filters);

      // Security: Hide total value from salespeople
      if (user && user.role === 'salesperson') {
        const { totalValue, ...rest } = summary;
        summary = { ...rest, totalValue: 0 };
      }

      res.json(summary);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al obtener resumen de inventario con precios', error: error.message });
    }
  }));

  // Sync products from ERP to PostgreSQL
  app.post('/api/inventory/sync', requirePlantOperationsAccess, asyncHandler(async (req: any, res: any) => {
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
  app.get('/api/inventory/sync-history', requirePlantOperationsAccess, asyncHandler(async (req: any, res: any) => {
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
  // GDV ETL SYNCHRONIZATION routes
  // ==================================================================================

  // Sync GDV from ERP to PostgreSQL
  app.post('/api/etl/sync-gdv', requireRoles(['admin', 'supervisor']), asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      if (!user || !user.id || !user.email) {
        return res.status(401).json({ message: 'Usuario no autenticado' });
      }

      console.log(`📦 Starting GDV ETL sync requested by ${user.email}`);

      // Execute in background (non-blocking) — like ventas ETL
      const gdvPromise = executeGDVETL();

      gdvPromise
        .then((result: any) => {
          console.log(`✅ GDV ETL completed: ${result.recordsProcessed} records in ${result.executionTimeMs}ms`);
        })
        .catch((error) => {
          console.error('❌ GDV ETL background error:', error.message);
        });

      // Return immediately
      res.json({
        success: true,
        message: 'Sincronización de GDV iniciada en segundo plano',
        isRunning: true,
      });
    } catch (error: any) {
      console.error('Error in GDV sync endpoint:', error);
      res.status(500).json({ message: 'Error al sincronizar GDV', error: error.message });
    }
  }));

  // Get GDV sync history
  app.get('/api/etl/sync-gdv/history', requireRoles(['admin', 'supervisor']), asyncHandler(async (req: any, res: any) => {
    try {
      // Validate and clamp limit/offset
      let limit = 20;
      let offset = 0;

      if (req.query.limit) {
        const parsedLimit = parseInt(req.query.limit as string);
        if (isNaN(parsedLimit) || parsedLimit < 1) {
          return res.status(400).json({ message: 'El parámetro limit debe ser un número positivo' });
        }
        limit = Math.min(parsedLimit, 100); // Cap at 100
      }

      if (req.query.offset) {
        const parsedOffset = parseInt(req.query.offset as string);
        if (isNaN(parsedOffset) || parsedOffset < 0) {
          return res.status(400).json({ message: 'El parámetro offset debe ser un número no negativo' });
        }
        offset = parsedOffset;
      }

      const history = await storage.getGdvSyncHistory(limit, offset);
      res.json(history);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al obtener historial de sincronización de GDV', error: error.message });
    }
  }));

  // Get GDV summary (totales por estado)
  app.get('/api/etl/gdv/summary', requireRoles(['admin', 'supervisor']), asyncHandler(async (req: any, res: any) => {
    try {
      // Normalize sucursales: handle both comma-delimited strings and repeated query params
      let sucursales: string[] | undefined = undefined;
      if (req.query.sucursales) {
        const raw = req.query.sucursales;
        const values = Array.isArray(raw) ? raw : raw.split(',');
        const filtered = values.map((v: string) => v.trim()).filter((v: string) => v !== '');
        sucursales = filtered.length > 0 ? filtered : undefined;
      }

      const filters = {
        startDate: req.query.startDate as string | undefined,
        endDate: req.query.endDate as string | undefined,
        sucursales,
      };
      const summary = await storage.getGdvSummary(filters);
      res.json(summary);
    } catch (error: any) {
      console.error('[GDV Summary Error]', error);
      res.status(500).json({ message: 'Error al obtener resumen de GDV', error: error.message });
    }
  }));

  // Get GDV by vendedor
  app.get('/api/etl/gdv/by-vendedor', requireRoles(['admin', 'supervisor']), asyncHandler(async (req: any, res: any) => {
    try {
      const filters = {
        startDate: req.query.startDate as string | undefined,
        endDate: req.query.endDate as string | undefined,
      };
      const metrics = await storage.getGdvByVendedor(filters);
      res.json(metrics);
    } catch (error: any) {
      console.error('[GDV By Vendedor Error]', error);
      res.status(500).json({ message: 'Error al obtener métricas de GDV por vendedor', error: error.message });
    }
  }));

  // Get GDV pending records (all individual records)
  app.get('/api/etl/gdv/pending-records', requireRoles(['admin', 'supervisor', 'logistica_bodega']), asyncHandler(async (req: any, res: any) => {
    try {
      const limit = parseInt(req.query.limit as string) || 500;
      const records = await storage.getGdvPendingRecords(limit);
      res.json(records);
    } catch (error: any) {
      console.error('[GDV Pending Records Error]', error);
      res.status(500).json({ message: 'Error al obtener registros GDV pendientes', error: error.message });
    }
  }));

  // Get GDV by salesperson (for dashboard view)
  app.get('/api/gdv/by-salesperson', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const salesperson = req.query.salesperson as string;
      if (!salesperson) {
        return res.status(400).json({ message: 'Se requiere el parámetro salesperson' });
      }
      const records = await storage.getGdvBySalesperson(salesperson);
      res.json(records);
    } catch (error: any) {
      console.error('[GDV By Salesperson Error]', error);
      res.status(500).json({ message: 'Error al obtener GDV por vendedor', error: error.message });
    }
  }));

  // Get all GDV grouped by salesperson (for main dashboard view)
  app.get('/api/gdv/all-by-salespeople', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const { segment, salesperson } = req.query;
      const gdvData = await storage.getAllGdvGroupedBySalespeople(segment as string | undefined, salesperson as string | undefined);
      res.json(gdvData);
    } catch (error: any) {
      console.error('[GDV All By Salespeople Error]', error);
      res.status(500).json({ message: 'Error al obtener GDV por vendedor', error: error.message });
    }
  }));

  // ==================================================================================
  // NVV ETL SYNCHRONIZATION routes
  // ==================================================================================

  // Sync NVV from ERP to PostgreSQL
  app.post('/api/etl/sync-nvv', requireRoles(['admin', 'supervisor']), asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      if (!user || !user.id || !user.email) {
        return res.status(401).json({ message: 'Usuario no autenticado' });
      }

      console.log(`📦 Starting NVV ETL sync requested by ${user.email}`);

      const result = await executeNVVETL();

      if (!result.success) {
        return res.status(500).json({
          message: 'Error al sincronizar NVV desde ERP',
          error: result.error,
          ...result,
        });
      }

      res.json({
        message: 'Sincronización de NVV completada exitosamente',
        ...result,
      });
    } catch (error: any) {
      console.error('Error in NVV sync endpoint:', error);
      res.status(500).json({ message: 'Error al sincronizar NVV', error: error.message });
    }
  }));

  // Get NVV sync history
  app.get('/api/etl/sync-nvv/history', requireRoles(['admin', 'supervisor']), asyncHandler(async (req: any, res: any) => {
    try {
      // Validate and clamp limit/offset
      let limit = 20;
      let offset = 0;

      if (req.query.limit) {
        const parsedLimit = parseInt(req.query.limit as string);
        if (isNaN(parsedLimit) || parsedLimit < 1) {
          return res.status(400).json({ message: 'El parámetro limit debe ser un número positivo' });
        }
        limit = Math.min(parsedLimit, 100); // Cap at 100
      }

      if (req.query.offset) {
        const parsedOffset = parseInt(req.query.offset as string);
        if (isNaN(parsedOffset) || parsedOffset < 0) {
          return res.status(400).json({ message: 'El parámetro offset debe ser un número no negativo' });
        }
        offset = parsedOffset;
      }

      const history = await storage.getNvvSyncHistory(limit, offset);
      res.json(history);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al obtener historial de sincronización de NVV', error: error.message });
    }
  }));

  // Get NVV summary (totales por estado)
  app.get('/api/etl/nvv/summary', requireRoles(['admin', 'supervisor']), asyncHandler(async (req: any, res: any) => {
    try {
      // Normalize array query params
      const normalizeArray = (raw: any): string[] | undefined => {
        if (!raw) return undefined;
        const values = Array.isArray(raw) ? raw : raw.split(',');
        const filtered = values.map((v: string) => v.trim()).filter((v: string) => v !== '');
        return filtered.length > 0 ? filtered : undefined;
      };

      const filters = {
        startDate: req.query.startDate as string | undefined,
        endDate: req.query.endDate as string | undefined,
        sucursales: normalizeArray(req.query.sucursales),
        vendedores: normalizeArray(req.query.vendedores),
        bodegas: normalizeArray(req.query.bodegas),
        estado: req.query.estado as 'open' | 'closed' | undefined,
        pendingOnly: req.query.pendingOnly === 'true',
        minAmount: req.query.minAmount ? parseFloat(req.query.minAmount as string) : undefined,
        maxAmount: req.query.maxAmount ? parseFloat(req.query.maxAmount as string) : undefined,
      };

      const summary = await storage.getNvvSummary(filters);
      res.json(summary);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al obtener resumen de NVV', error: error.message });
    }
  }));

  // Get NVV by sucursal
  app.get('/api/etl/nvv/by-sucursal', requireRoles(['admin', 'supervisor']), asyncHandler(async (req: any, res: any) => {
    try {
      // Normalize array query params
      const normalizeArray = (raw: any): string[] | undefined => {
        if (!raw) return undefined;
        const values = Array.isArray(raw) ? raw : raw.split(',');
        const filtered = values.map((v: string) => v.trim()).filter((v: string) => v !== '');
        return filtered.length > 0 ? filtered : undefined;
      };

      const filters = {
        startDate: req.query.startDate as string | undefined,
        endDate: req.query.endDate as string | undefined,
        sucursales: normalizeArray(req.query.sucursales),
        vendedores: normalizeArray(req.query.vendedores),
        bodegas: normalizeArray(req.query.bodegas),
        estado: req.query.estado as 'open' | 'closed' | undefined,
        pendingOnly: req.query.pendingOnly === 'true',
        minAmount: req.query.minAmount ? parseFloat(req.query.minAmount as string) : undefined,
        maxAmount: req.query.maxAmount ? parseFloat(req.query.maxAmount as string) : undefined,
      };

      const metrics = await storage.getNvvBySucursal(filters);
      res.json(metrics);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al obtener métricas de NVV por sucursal', error: error.message });
    }
  }));

  // Get NVV by vendedor
  app.get('/api/etl/nvv/by-vendedor', requireRoles(['admin', 'supervisor']), asyncHandler(async (req: any, res: any) => {
    try {
      // Normalize array query params
      const normalizeArray = (raw: any): string[] | undefined => {
        if (!raw) return undefined;
        const values = Array.isArray(raw) ? raw : raw.split(',');
        const filtered = values.map((v: string) => v.trim()).filter((v: string) => v !== '');
        return filtered.length > 0 ? filtered : undefined;
      };

      const filters = {
        startDate: req.query.startDate as string | undefined,
        endDate: req.query.endDate as string | undefined,
        sucursales: normalizeArray(req.query.sucursales),
        vendedores: normalizeArray(req.query.vendedores),
        bodegas: normalizeArray(req.query.bodegas),
        estado: req.query.estado as 'open' | 'closed' | undefined,
        pendingOnly: req.query.pendingOnly === 'true',
        minAmount: req.query.minAmount ? parseFloat(req.query.minAmount as string) : undefined,
        maxAmount: req.query.maxAmount ? parseFloat(req.query.maxAmount as string) : undefined,
      };

      const metrics = await storage.getNvvByVendedor(filters);
      res.json(metrics);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al obtener métricas de NVV por vendedor', error: error.message });
    }
  }));

  // Get NVV by bodega
  app.get('/api/etl/nvv/by-bodega', requireRoles(['admin', 'supervisor']), asyncHandler(async (req: any, res: any) => {
    try {
      // Normalize array query params
      const normalizeArray = (raw: any): string[] | undefined => {
        if (!raw) return undefined;
        const values = Array.isArray(raw) ? raw : raw.split(',');
        const filtered = values.map((v: string) => v.trim()).filter((v: string) => v !== '');
        return filtered.length > 0 ? filtered : undefined;
      };

      const filters = {
        startDate: req.query.startDate as string | undefined,
        endDate: req.query.endDate as string | undefined,
        sucursales: normalizeArray(req.query.sucursales),
        vendedores: normalizeArray(req.query.vendedores),
        bodegas: normalizeArray(req.query.bodegas),
        estado: req.query.estado as 'open' | 'closed' | undefined,
        pendingOnly: req.query.pendingOnly === 'true',
        minAmount: req.query.minAmount ? parseFloat(req.query.minAmount as string) : undefined,
        maxAmount: req.query.maxAmount ? parseFloat(req.query.maxAmount as string) : undefined,
      };

      const metrics = await storage.getNvvByBodega(filters);
      res.json(metrics);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al obtener métricas de NVV por bodega', error: error.message });
    }
  }));

  // Get NVV by segmento cliente
  app.get('/api/etl/nvv/by-segmento-cliente', requireRoles(['admin', 'supervisor']), asyncHandler(async (req: any, res: any) => {
    try {
      // Normalize array query params
      const normalizeArray = (raw: any): string[] | undefined => {
        if (!raw) return undefined;
        const values = Array.isArray(raw) ? raw : raw.split(',');
        const filtered = values.map((v: string) => v.trim()).filter((v: string) => v !== '');
        return filtered.length > 0 ? filtered : undefined;
      };

      const filters = {
        startDate: req.query.startDate as string | undefined,
        endDate: req.query.endDate as string | undefined,
        sucursales: normalizeArray(req.query.sucursales),
        vendedores: normalizeArray(req.query.vendedores),
        bodegas: normalizeArray(req.query.bodegas),
        estado: req.query.estado as 'open' | 'closed' | undefined,
        pendingOnly: req.query.pendingOnly === 'true',
        minAmount: req.query.minAmount ? parseFloat(req.query.minAmount as string) : undefined,
        maxAmount: req.query.maxAmount ? parseFloat(req.query.maxAmount as string) : undefined,
      };

      const metrics = await storage.getNvvBySegmentoCliente(filters);
      res.json(metrics);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al obtener métricas de NVV por segmento', error: error.message });
    }
  }));

  // Get NVV documents (paginated list)
  app.get('/api/etl/nvv/documents', requireRoles(['admin', 'supervisor']), asyncHandler(async (req: any, res: any) => {
    try {
      // Normalize array query params
      const normalizeArray = (raw: any): string[] | undefined => {
        if (!raw) return undefined;
        const values = Array.isArray(raw) ? raw : raw.split(',');
        const filtered = values.map((v: string) => v.trim()).filter((v: string) => v !== '');
        return filtered.length > 0 ? filtered : undefined;
      };

      // Pagination
      let page = 1;
      let pageSize = 20;

      if (req.query.page) {
        const parsedPage = parseInt(req.query.page as string);
        if (isNaN(parsedPage) || parsedPage < 1) {
          return res.status(400).json({ message: 'El parámetro page debe ser un número positivo' });
        }
        page = parsedPage;
      }

      if (req.query.pageSize) {
        const parsedPageSize = parseInt(req.query.pageSize as string);
        if (isNaN(parsedPageSize) || parsedPageSize < 1) {
          return res.status(400).json({ message: 'El parámetro pageSize debe ser un número positivo' });
        }
        pageSize = Math.min(parsedPageSize, 100); // Cap at 100
      }

      const filters = {
        startDate: req.query.startDate as string | undefined,
        endDate: req.query.endDate as string | undefined,
        sucursales: normalizeArray(req.query.sucursales),
        vendedores: normalizeArray(req.query.vendedores),
        bodegas: normalizeArray(req.query.bodegas),
        estado: req.query.estado as 'open' | 'closed' | undefined,
        pendingOnly: req.query.pendingOnly === 'true',
        minAmount: req.query.minAmount ? parseFloat(req.query.minAmount as string) : undefined,
        maxAmount: req.query.maxAmount ? parseFloat(req.query.maxAmount as string) : undefined,
      };

      const result = await storage.getNvvDocuments(filters, { page, pageSize });
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al obtener documentos NVV', error: error.message });
    }
  }));

  // Get NVV state changes (document-level change tracking)
  app.get('/api/etl/nvv/state-changes', requireRoles(['admin', 'supervisor']), asyncHandler(async (req: any, res: any) => {
    try {
      const executionId = req.query.executionId as string | undefined;
      let limit = 50;
      let offset = 0;

      if (req.query.limit) {
        const parsedLimit = parseInt(req.query.limit as string);
        if (isNaN(parsedLimit) || parsedLimit < 1) {
          return res.status(400).json({ message: 'El parámetro limit debe ser un número positivo' });
        }
        limit = Math.min(parsedLimit, 200); // Cap at 200
      }

      if (req.query.offset) {
        const parsedOffset = parseInt(req.query.offset as string);
        if (isNaN(parsedOffset) || parsedOffset < 0) {
          return res.status(400).json({ message: 'El parámetro offset debe ser un número no negativo' });
        }
        offset = parsedOffset;
      }

      const result = await storage.getNvvStateChanges({ executionId, limit, offset });
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al obtener cambios de estado NVV', error: error.message });
    }
  }));

  // ==================================================================================
  // GASTOS EMPRESARIALES routes
  // ==================================================================================

  // Upload evidencia file for gastos empresariales
  // Nomenclatura: gastos/evidencia_{userId}_{YYYYMMDD}_{randomId}.{ext}
  app.post('/api/gastos-empresariales/upload-evidencia', requireAuth, upload.single('file'), asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;

      // Only salesperson, supervisor, admin and recursos_humanos can upload evidence
      if (!['salesperson', 'supervisor', 'admin', 'recursos_humanos'].includes(user.role)) {
        return res.status(403).json({ message: 'No autorizado para subir evidencia' });
      }

      if (!req.file) {
        return res.status(400).json({ message: 'No se ha subido ningún archivo' });
      }

      const file = req.file;
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
      const randomId = nanoid(6);
      const fileExtension = path.extname(file.originalname).toLowerCase();
      const userIdShort = user.id.slice(0, 8);

      // Estructura organizada: gastos/evidencia_{userId}_{fecha}_{randomId}.{ext}
      const fileName = `gastos/evidencia_${userIdShort}_${dateStr}_${randomId}${fileExtension}`;

      // Upload to Object Storage (permanent storage)
      const objectStorageService = new ObjectStorageService();
      const imageUrl = await objectStorageService.uploadImage(fileName, file.buffer, file.mimetype);
      console.log(`☁️ [GASTO-EVIDENCIA] Uploaded: ${fileName}`);

      let previewUrl: string | null = null;

      if (isPdfFile(file.mimetype, file.originalname)) {
        console.log(`📄 [GASTO-EVIDENCIA] PDF detected, generating preview...`);
        try {
          const previewBuffer = await convertPdfToImage(file.buffer, 600);
          if (previewBuffer) {
            const previewFileName = `gastos/evidencia_${userIdShort}_${dateStr}_${randomId}_preview.png`;
            previewUrl = await objectStorageService.uploadImage(previewFileName, previewBuffer, 'image/png');
            console.log(`🖼️ [GASTO-EVIDENCIA] Preview generated: ${previewFileName}`);
          }
        } catch (previewError) {
          console.warn('⚠️ [GASTO-EVIDENCIA] Failed to generate PDF preview:', previewError);
        }
      }

      res.json({ url: imageUrl, fileName, previewUrl });
    } catch (error: any) {
      console.error('Error uploading evidencia:', error);
      res.status(500).json({ message: 'Error al subir archivo', error: error.message });
    }
  }));

  // Upload comprobante de transferencia for fund allocations
  // Nomenclatura: fondos/comprobante_{fundId}_{YYYYMMDD}_{randomId}.{ext}
  app.post('/api/fund-allocations/upload-comprobante', requireAuth, upload.single('file'), asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;

      // Only admin and HR can upload fund transfer receipts
      if (!['admin', 'recursos_humanos'].includes(user.role)) {
        return res.status(403).json({ message: 'No autorizado para subir comprobante de fondo' });
      }

      if (!req.file) {
        return res.status(400).json({ message: 'No se ha subido ningún archivo' });
      }

      const file = req.file;
      const fundId = req.body.fundId || 'sin-id';
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
      const randomId = nanoid(6);
      const fileExtension = path.extname(file.originalname).toLowerCase();
      const fundIdShort = fundId.slice(0, 8);

      // Estructura organizada: fondos/comprobante_{fundId}_{fecha}_{randomId}.{ext}
      const fileName = `fondos/comprobante_${fundIdShort}_${dateStr}_${randomId}${fileExtension}`;

      // Upload to Object Storage (permanent storage)
      const objectStorageService = new ObjectStorageService();
      const imageUrl = await objectStorageService.uploadImage(fileName, file.buffer, file.mimetype);
      console.log(`☁️ [FONDO-COMPROBANTE] Uploaded: ${fileName}`);

      let previewUrl: string | null = null;

      if (isPdfFile(file.mimetype, file.originalname)) {
        console.log(`📄 [FONDO-COMPROBANTE] PDF detected, generating preview...`);
        try {
          const previewBuffer = await convertPdfToImage(file.buffer, 600);
          if (previewBuffer) {
            const previewFileName = `fondos/comprobante_${fundIdShort}_${dateStr}_${randomId}_preview.png`;
            previewUrl = await objectStorageService.uploadImage(previewFileName, previewBuffer, 'image/png');
            console.log(`🖼️ [FONDO-COMPROBANTE] Preview generated: ${previewFileName}`);
          }
        } catch (previewError) {
          console.warn('⚠️ [FONDO-COMPROBANTE] Failed to generate PDF preview:', previewError);
        }
      }

      res.json({ url: imageUrl, fileName, previewUrl });
    } catch (error: any) {
      console.error('Error uploading comprobante de fondo:', error);
      res.status(500).json({ message: 'Error al subir archivo', error: error.message });
    }
  }));

  // Upload solicitud de fondo evidence (employee requesting funds)
  // Nomenclatura: fondos/solicitud_{userId}_{YYYYMMDD}_{randomId}.{ext}
  app.post('/api/fund-allocations/upload-solicitud', requireAuth, upload.single('file'), asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;

      if (!req.file) {
        return res.status(400).json({ message: 'No se ha subido ningún archivo' });
      }

      const file = req.file;
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
      const randomId = nanoid(6);
      const fileExtension = path.extname(file.originalname).toLowerCase();
      const userIdShort = user.id.slice(0, 8);

      // Estructura organizada: fondos/solicitud_{userId}_{fecha}_{randomId}.{ext}
      const fileName = `fondos/solicitud_${userIdShort}_${dateStr}_${randomId}${fileExtension}`;

      // Upload to Object Storage (permanent storage)
      const objectStorageService = new ObjectStorageService();
      const imageUrl = await objectStorageService.uploadImage(fileName, file.buffer, file.mimetype);
      console.log(`☁️ [FONDO-SOLICITUD] Uploaded: ${fileName}`);
      res.json({ url: imageUrl, fileName });
    } catch (error: any) {
      console.error('Error uploading solicitud de fondo:', error);
      res.status(500).json({ message: 'Error al subir archivo', error: error.message });
    }
  }));

  // OCR extraction from receipt/invoice image
  app.post('/api/gastos-empresariales/ocr-extract', requireAuth, upload.single('file'), asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;

      if (!['salesperson', 'supervisor', 'admin', 'recursos_humanos'].includes(user.role)) {
        return res.status(403).json({ message: 'No autorizado' });
      }

      if (!req.file) {
        return res.status(400).json({ message: 'No se ha subido ningún archivo' });
      }

      const file = req.file;

      // Check if it's an image (not PDF for now)
      if (!file.mimetype.startsWith('image/')) {
        return res.json({
          success: false,
          message: 'OCR solo disponible para imágenes. Por favor ingrese los datos manualmente.',
          data: null
        });
      }

      // Convert image to base64
      const base64Image = file.buffer.toString('base64');
      const imageDataUrl = `data:${file.mimetype};base64,${base64Image}`;

      // Use OpenAI Vision to extract data
      const OpenAI = (await import('openai')).default;
      const openai = new OpenAI({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });

      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Analiza esta imagen de un documento comercial chileno (boleta, factura, o recibo) y extrae la siguiente información en formato JSON:
                
{
  "monto": (número, el monto total a pagar, sin símbolo de moneda ni puntos de miles),
  "descripcion": (string, una breve descripción del gasto basada en los items o concepto del documento),
  "numeroDocumento": (string, número de folio, número de boleta o factura),
  "rutProveedor": (string, RUT del emisor/proveedor en formato XX.XXX.XXX-X),
  "proveedor": (string, razón social o nombre del emisor/proveedor),
  "fechaEmision": (string, fecha de emisión en formato YYYY-MM-DD),
  "tipoDocumento": (string, uno de: "Boleta", "Factura", "Recibo", "Otro")
}

Si no puedes identificar algún campo, déjalo como null. Responde SOLO con el JSON, sin explicaciones adicionales.`
              },
              {
                type: 'image_url',
                image_url: {
                  url: imageDataUrl,
                }
              }
            ]
          }
        ],
        max_tokens: 500,
      });

      const content = response.choices[0]?.message?.content || '{}';

      // Parse the JSON response
      let extractedData;
      try {
        // Remove markdown code blocks if present
        const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        extractedData = JSON.parse(jsonStr);
      } catch (parseError) {
        console.error('Error parsing OCR response:', content);
        return res.json({
          success: false,
          message: 'No se pudo interpretar el documento',
          data: null
        });
      }

      console.log('🔍 [OCR] Extracted data:', extractedData);

      res.json({
        success: true,
        message: 'Datos extraídos correctamente',
        data: extractedData
      });
    } catch (error: any) {
      console.error('Error in OCR extraction:', error);
      res.json({
        success: false,
        message: 'Error al procesar el documento',
        data: null
      });
    }
  }));

  // Create gasto
  app.post('/api/gastos-empresariales', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;

      // Only salesperson, supervisor, admin and recursos_humanos can create expenses
      if (!['salesperson', 'supervisor', 'admin', 'recursos_humanos'].includes(user.role)) {
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

      if (user.role === 'salesperson' && validated.fechaEmision) {
        const emisionDate = new Date(validated.fechaEmision + 'T12:00:00');
        const now = new Date();
        if (emisionDate.getMonth() !== now.getMonth() || emisionDate.getFullYear() !== now.getFullYear()) {
          return res.status(400).json({ message: 'La fecha de emisión debe estar dentro del mes calendario actual' });
        }
      }

      const isConFondo = validated.fundingMode === 'con_fondo' && validated.fundAllocationId;
      if (isConFondo) {
        const allocation = await storage.getFundAllocationById(validated.fundAllocationId!);
        if (!allocation) {
          return res.status(400).json({ message: 'Fondo asignado no encontrado' });
        }
        if (allocation.fechaTermino) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const termino = new Date(allocation.fechaTermino + 'T23:59:59');
          if (today > termino) {
            return res.status(400).json({ message: 'El fondo asignado ha expirado. La fecha de término ya pasó.' });
          }
        }
        const balance = await storage.getFundAllocationBalance(validated.fundAllocationId!);
        const gastoMonto = parseFloat(validated.monto?.toString() || '0');
        if (gastoMonto > balance.saldoDisponible) {
          return res.status(400).json({ message: `Saldo insuficiente. Disponible: $${balance.saldoDisponible.toLocaleString('es-CL')}, Gasto: $${gastoMonto.toLocaleString('es-CL')}` });
        }
        validated.estado = 'pendiente';
        validated.tipoGasto = 'Con Fondos Asignados';
        validated.estadoAprobacion = 'pendiente_rrhh';
      } else {
        validated.tipoGasto = 'Reembolso';
        validated.estadoAprobacion = 'pendiente_rrhh';
      }

      const gasto = await storage.createGastoEmpresarial(validated);

      if (isConFondo && validated.fundAllocationId) {
        await storage.createFundMovement({
          allocationId: validated.fundAllocationId,
          tipoMovimiento: 'gasto_pendiente',
          gastoId: gasto.id,
          monto: `-${validated.monto}`,
          descripcion: `Gasto pendiente: ${validated.descripcion || validated.categoria}`,
          creadoPorId: targetUserId,
        });
      }

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
      // Supervisor, recursos_humanos and admin can see all and filter by userId
      if (user.role === 'salesperson') {
        filters.userId = user.id;
      } else if (userId) {
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

      if (!['supervisor', 'admin', 'recursos_humanos'].includes(user.role)) {
        return res.status(403).json({ message: 'Solo supervisores, admin o recursos humanos pueden aprobar gastos' });
      }

      const gasto = await storage.aprobarGastoEmpresarial(req.params.id, user.id);
      res.json(gasto);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al aprobar gasto', error: error.message });
    }
  }));

  // Reject gasto (supervisor/admin only) - Legacy endpoint
  app.post('/api/gastos-empresariales/:id/rechazar', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;

      if (!['supervisor', 'admin', 'recursos_humanos'].includes(user.role)) {
        return res.status(403).json({ message: 'Solo supervisores, admin o recursos humanos pueden rechazar gastos' });
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

  app.patch('/api/gastos-empresariales/:id/fecha-emision', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;

      if (!['admin', 'recursos_humanos'].includes(user.role)) {
        return res.status(403).json({ message: 'Solo admin o recursos humanos pueden editar la fecha de emisión' });
      }

      const { fechaEmision } = req.body;
      if (!fechaEmision || !/^\d{4}-\d{2}-\d{2}$/.test(fechaEmision)) {
        return res.status(400).json({ message: 'Fecha de emisión inválida. Formato esperado: YYYY-MM-DD' });
      }

      const testDate = new Date(fechaEmision + 'T12:00:00');
      if (isNaN(testDate.getTime())) {
        return res.status(400).json({ message: 'Fecha de emisión inválida' });
      }

      const gasto = await storage.updateGastoEmpresarial(req.params.id, { fechaEmision });
      res.json(gasto);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al actualizar fecha de emisión', error: error.message });
    }
  }));

  app.patch('/api/gastos-empresariales/:id/editar', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;

      if (!['admin', 'recursos_humanos'].includes(user.role)) {
        return res.status(403).json({ message: 'Solo admin o recursos humanos pueden editar gastos' });
      }

      const existing = await storage.getGastoEmpresarialById(req.params.id);
      if (!existing) {
        return res.status(404).json({ message: 'Gasto no encontrado' });
      }

      const allowedFields = ['monto', 'descripcion', 'categoria', 'tipoDocumento', 'proveedor', 'rutProveedor', 'numeroDocumento', 'fechaEmision', 'ruta', 'clientes', 'ciudad', 'fundingMode', 'fundAllocationId'];
      const updates: any = {};
      for (const field of allowedFields) {
        if (req.body[field] !== undefined && req.body[field] !== '') {
          updates[field] = req.body[field];
        } else if (req.body[field] === '' && !['monto', 'descripcion', 'categoria'].includes(field)) {
          updates[field] = null;
        }
      }

      if (updates.fundingMode === 'reembolso') {
        updates.fundAllocationId = null;
      }

      if (updates.fechaEmision && !/^\d{4}-\d{2}-\d{2}$/.test(updates.fechaEmision)) {
        return res.status(400).json({ message: 'Fecha de emisión inválida. Formato: YYYY-MM-DD' });
      }

      if (req.body.createdAt) {
        const newCreatedAt = new Date(req.body.createdAt);
        if (isNaN(newCreatedAt.getTime())) {
          return res.status(400).json({ message: 'Fecha de creación inválida' });
        }
        updates.createdAt = newCreatedAt;
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ message: 'No se proporcionaron campos para editar' });
      }

      const gasto = await storage.updateGastoEmpresarial(req.params.id, updates);
      res.json(gasto);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al editar gasto', error: error.message });
    }
  }));

  // ==================================================================================
  // FLUJO DE APROBACIÓN DE DOS NIVELES PARA REEMBOLSOS
  // ==================================================================================

  // Get reembolsos pendientes para supervisor
  app.get('/api/gastos-empresariales/reembolsos/pendientes-supervisor', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;

      if (!['supervisor', 'admin'].includes(user.role)) {
        return res.status(403).json({ message: 'No autorizado' });
      }

      const reembolsos = await storage.getReembolsosPendientesSupervisor(user.id);
      res.json(reembolsos);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al obtener reembolsos pendientes', error: error.message });
    }
  }));

  // Get reembolsos pendientes para RRHH
  app.get('/api/gastos-empresariales/reembolsos/pendientes-rrhh', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;

      if (!['admin', 'recursos_humanos'].includes(user.role)) {
        return res.status(403).json({ message: 'No autorizado' });
      }

      const reembolsos = await storage.getReembolsosPendientesRrhh();
      res.json(reembolsos);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al obtener reembolsos pendientes', error: error.message });
    }
  }));

  // [DEPRECATED] Aprobar reembolso por supervisor - kept for backward compatibility with existing pendiente_supervisor records
  app.post('/api/gastos-empresariales/:id/supervisor-approve', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;

      if (!['supervisor', 'admin'].includes(user.role)) {
        return res.status(403).json({ message: 'Solo supervisores pueden aprobar en esta etapa' });
      }

      const gasto = await storage.getGastoEmpresarialById(req.params.id);
      if (!gasto) {
        return res.status(404).json({ message: 'Gasto no encontrado' });
      }

      if (gasto.estadoAprobacion !== 'pendiente_supervisor') {
        return res.status(400).json({ message: 'Este reembolso no está pendiente de aprobación de supervisor' });
      }

      const { comentario } = req.body;
      const result = await storage.aprobarReembolsoSupervisor(req.params.id, user.id, comentario);

      // Notificar a RRHH
      try {
        const rrhhUsers = await storage.getUsersByRole('recursos_humanos');
        for (const rrhhUser of rrhhUsers) {
          await storage.createNotification({
            userId: rrhhUser.id,
            title: 'Nuevo reembolso pendiente de aprobación',
            message: `El supervisor ha aprobado un reembolso de $${gasto.monto}. Requiere tu aprobación final.`,
            type: 'info',
            link: '/gastos-empresariales',
          });
        }
      } catch (notifError) {
        console.error('Error al enviar notificación a RRHH:', notifError);
      }

      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al aprobar reembolso', error: error.message });
    }
  }));

  // [DEPRECATED] Rechazar reembolso por supervisor - kept for backward compatibility with existing pendiente_supervisor records
  app.post('/api/gastos-empresariales/:id/supervisor-reject', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;

      if (!['supervisor', 'admin'].includes(user.role)) {
        return res.status(403).json({ message: 'Solo supervisores pueden rechazar en esta etapa' });
      }

      const gasto = await storage.getGastoEmpresarialById(req.params.id);
      if (!gasto) {
        return res.status(404).json({ message: 'Gasto no encontrado' });
      }

      if (gasto.estadoAprobacion !== 'pendiente_supervisor') {
        return res.status(400).json({ message: 'Este reembolso no está pendiente de aprobación de supervisor' });
      }

      const { motivoRechazo } = req.body;
      if (!motivoRechazo) {
        return res.status(400).json({ message: 'El motivo del rechazo es requerido' });
      }

      const result = await storage.rechazarReembolsoSupervisor(req.params.id, user.id, motivoRechazo);

      // Notificar al solicitante
      try {
        await storage.createNotification({
          userId: gasto.userId,
          title: 'Reembolso rechazado por supervisor',
          message: `Tu solicitud de reembolso de $${gasto.monto} ha sido rechazada. Motivo: ${motivoRechazo}`,
          type: 'warning',
          link: '/gastos-empresariales',
        });
      } catch (notifError) {
        console.error('Error al enviar notificación:', notifError);
      }

      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al rechazar reembolso', error: error.message });
    }
  }));

  // Aprobar reembolso por RRHH (aprobación final)
  app.post('/api/gastos-empresariales/:id/rrhh-approve', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;

      if (!['admin', 'recursos_humanos'].includes(user.role)) {
        return res.status(403).json({ message: 'Solo RRHH puede dar aprobación final' });
      }

      const gasto = await storage.getGastoEmpresarialById(req.params.id);
      if (!gasto) {
        return res.status(404).json({ message: 'Gasto no encontrado' });
      }

      if (!['pendiente_rrhh', 'pendiente_supervisor'].includes(gasto.estadoAprobacion || '')) {
        return res.status(400).json({ message: 'Este gasto no está pendiente de aprobación de RRHH' });
      }

      const { comentario } = req.body;
      const comprobanteUrl = gasto.archivoUrl || null;

      const result = await storage.aprobarReembolsoRrhh(req.params.id, user.id, comprobanteUrl, comentario);

      if (gasto.fundingMode === 'con_fondo' && gasto.fundAllocationId) {
        try {
          const existingMovements = await storage.getFundMovements(gasto.fundAllocationId);
          const pendingMovement = existingMovements.find(
            m => m.gastoId === gasto.id && m.tipoMovimiento === 'gasto_pendiente'
          );
          if (pendingMovement) {
            await db.update(fundMovements)
              .set({ tipoMovimiento: 'gasto_aprobado', descripcion: `Gasto aprobado por RRHH: ${gasto.descripcion || gasto.categoria}` })
              .where(eq(fundMovements.id, pendingMovement.id));
          } else {
            await storage.createFundMovement({
              allocationId: gasto.fundAllocationId,
              tipoMovimiento: 'gasto_aprobado',
              gastoId: gasto.id,
              monto: `-${gasto.monto}`,
              descripcion: `Gasto aprobado por RRHH: ${gasto.descripcion || gasto.categoria}`,
              creadoPorId: user.id,
            });
          }
        } catch (movError) {
          console.error('Error al registrar movimiento de fondo aprobado:', movError);
        }
      }

      try {
        await storage.createNotification({
          userId: gasto.userId,
          title: gasto.fundingMode === 'con_fondo' ? 'Gasto aprobado' : 'Reembolso aprobado',
          message: `Tu ${gasto.fundingMode === 'con_fondo' ? 'gasto' : 'solicitud de reembolso'} de $${gasto.monto} ha sido aprobado${gasto.fundingMode !== 'con_fondo' ? ' y procesado' : ''}.`,
          type: 'success',
          link: '/gastos-empresariales',
        });
      } catch (notifError) {
        console.error('Error al enviar notificación:', notifError);
      }

      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al aprobar gasto', error: error.message });
    }
  }));

  // Rechazar reembolso por RRHH
  app.post('/api/gastos-empresariales/:id/rrhh-reject', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;

      if (!['admin', 'recursos_humanos'].includes(user.role)) {
        return res.status(403).json({ message: 'Solo RRHH puede rechazar en esta etapa' });
      }

      const gasto = await storage.getGastoEmpresarialById(req.params.id);
      if (!gasto) {
        return res.status(404).json({ message: 'Gasto no encontrado' });
      }

      if (!['pendiente_rrhh', 'pendiente_supervisor'].includes(gasto.estadoAprobacion || '')) {
        return res.status(400).json({ message: 'Este gasto no está pendiente de aprobación de RRHH' });
      }

      const { motivoRechazo } = req.body;
      if (!motivoRechazo) {
        return res.status(400).json({ message: 'El motivo del rechazo es requerido' });
      }

      const result = await storage.rechazarReembolsoRrhh(req.params.id, user.id, motivoRechazo);

      if (gasto.fundingMode === 'con_fondo' && gasto.fundAllocationId) {
        try {
          const existingMovements = await storage.getFundMovements(gasto.fundAllocationId);
          const pendingMovement = existingMovements.find(
            m => m.gastoId === gasto.id && m.tipoMovimiento === 'gasto_pendiente'
          );
          if (pendingMovement) {
            await db.update(fundMovements)
              .set({ tipoMovimiento: 'gasto_rechazado', descripcion: `Gasto rechazado por RRHH: ${motivoRechazo}` })
              .where(eq(fundMovements.id, pendingMovement.id));
          }
        } catch (movError) {
          console.error('Error al registrar movimiento de fondo rechazado:', movError);
        }
      }

      try {
        await storage.createNotification({
          userId: gasto.userId,
          title: gasto.fundingMode === 'con_fondo' ? 'Gasto rechazado por RRHH' : 'Reembolso rechazado por RRHH',
          message: `Tu ${gasto.fundingMode === 'con_fondo' ? 'gasto' : 'solicitud de reembolso'} de $${gasto.monto} ha sido rechazado. Motivo: ${motivoRechazo}`,
          type: 'warning',
          link: '/gastos-empresariales',
        });
      } catch (notifError) {
        console.error('Error al enviar notificación:', notifError);
      }

      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al rechazar reembolso', error: error.message });
    }
  }));

  // Get gastos summary
  app.get('/api/gastos-empresariales/analytics/summary', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      const { mes, anio, userId } = req.query;

      const filters: any = {};

      // Salesperson can only see their own summary
      // Supervisor, recursos_humanos and admin can see all
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
      // Supervisor, recursos_humanos and admin can see all
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

  // Get months where a specific user has expenses (for smart navigation)
  app.get('/api/gastos-empresariales/analytics/meses-con-gastos', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      let { userId } = req.query;
      if (!userId) {
        return res.status(400).json({ message: 'userId es requerido' });
      }

      if (user.role === 'salesperson' && userId !== user.id) {
        userId = user.id;
      }

      const results = await db
        .select({
          mes: sql<number>`EXTRACT(MONTH FROM ${gastosEmpresariales.createdAt})`,
          anio: sql<number>`EXTRACT(YEAR FROM ${gastosEmpresariales.createdAt})`,
          cantidad: sql<number>`COUNT(*)`,
          total: sql<number>`SUM(${gastosEmpresariales.monto})`,
        })
        .from(gastosEmpresariales)
        .where(eq(gastosEmpresariales.userId, userId))
        .groupBy(
          sql`EXTRACT(MONTH FROM ${gastosEmpresariales.createdAt})`,
          sql`EXTRACT(YEAR FROM ${gastosEmpresariales.createdAt})`
        )
        .orderBy(
          desc(sql`EXTRACT(YEAR FROM ${gastosEmpresariales.createdAt})`),
          desc(sql`EXTRACT(MONTH FROM ${gastosEmpresariales.createdAt})`)
        );

      res.json(results.map(r => ({
        mes: parseInt(r.mes as any),
        anio: parseInt(r.anio as any),
        cantidad: parseInt(r.cantidad as any),
        total: parseFloat(r.total as any) || 0,
      })));
    } catch (error: any) {
      res.status(500).json({ message: 'Error al obtener meses', error: error.message });
    }
  }));

  // Get ALL users who have ANY expense (for dropdown filter)
  app.get('/api/gastos-empresariales/analytics/usuarios', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;

      // Only admin, recursos_humanos and supervisor can see all users
      if (!['admin', 'recursos_humanos', 'supervisor'].includes(user.role)) {
        // For other roles, just return their own user info
        return res.json([{ userId: user.id, userName: user.fullName || user.username }]);
      }

      const data = await storage.getAllUsersWithGastos();
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al obtener lista de usuarios', error: error.message });
    }
  }));

  // Get gastos by user (admin/recursos_humanos/supervisor can see all)
  app.get('/api/gastos-empresariales/analytics/por-usuario', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      const { mes, anio, userId } = req.query;

      const filters: any = {};

      // Salesperson can only see their own data
      // Supervisor, recursos_humanos and admin can see all
      if (user.role === 'salesperson') {
        filters.userId = user.id;
      } else if (!['admin', 'recursos_humanos', 'supervisor'].includes(user.role)) {
        return res.status(403).json({ message: 'No autorizado' });
      } else if (userId) {
        // Admin/HR/Supervisor can filter by specific user
        filters.userId = userId;
      }

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
      // Supervisor, recursos_humanos and admin can see all
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
  // GESTIÓN DE FONDOS ROUTES
  // ==================================================================================

  // Create fund allocation (Admin/HR only)
  app.post('/api/fund-allocations', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;

      if (!['admin', 'recursos_humanos'].includes(user.role)) {
        return res.status(403).json({ message: 'Solo Admin o Recursos Humanos pueden asignar fondos' });
      }

      const validated = insertFundAllocationSchema.parse({
        ...req.body,
        assignedById: user.id,
      });

      const allocation = await storage.createFundAllocation(validated);
      res.status(201).json(allocation);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: 'Datos inválidos', errors: error.errors });
      }
      res.status(500).json({ message: 'Error al crear asignación de fondo', error: error.message });
    }
  }));

  // Get fund allocations with filters
  app.get('/api/fund-allocations', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      const { assignedToId, estado, limit, offset } = req.query;

      const filters: any = {};

      // Non-admin/HR users see: funds assigned TO them + their own solicitudes
      if (!['admin', 'recursos_humanos'].includes(user.role)) {
        filters.userScope = user.id; // Will fetch assignedToId=user.id OR (estado='solicitud' AND assignedById=user.id)
      } else if (assignedToId) {
        filters.assignedToId = assignedToId;
      }

      if (estado) filters.estado = estado;
      if (limit) filters.limit = parseInt(limit as string);
      if (offset) filters.offset = parseInt(offset as string);

      const allocations = await storage.getFundAllocations(filters);

      // Enrich with balance info
      const enriched = await Promise.all(
        allocations.map(async (alloc) => {
          const balance = await storage.getFundAllocationBalance(alloc.id);
          return { ...alloc, ...balance };
        })
      );

      res.json(enriched);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al obtener asignaciones', error: error.message });
    }
  }));

  // Get single fund allocation with balance
  app.get('/api/fund-allocations/:id', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const allocation = await storage.getFundAllocationById(req.params.id);

      if (!allocation) {
        return res.status(404).json({ message: 'Asignación no encontrada' });
      }

      const balance = await storage.getFundAllocationBalance(allocation.id);
      const movements = await storage.getFundMovements(allocation.id);

      res.json({ ...allocation, ...balance, movements });
    } catch (error: any) {
      res.status(500).json({ message: 'Error al obtener asignación', error: error.message });
    }
  }));

  // Update fund allocation (Admin/HR only)
  app.patch('/api/fund-allocations/:id', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;

      if (!['admin', 'recursos_humanos'].includes(user.role)) {
        return res.status(403).json({ message: 'No autorizado' });
      }

      const current = await storage.getFundAllocationById(req.params.id);
      if (!current) {
        return res.status(404).json({ message: 'Fondo no encontrado' });
      }

      const updateData: any = {};
      const newMonto = (req.body.montoInicial !== undefined && req.body.montoInicial !== null && req.body.montoInicial !== '')
        ? parseFloat(String(req.body.montoInicial))
        : null;
      if (newMonto !== null) {
        updateData.montoInicial = String(newMonto);
      }
      if (req.body.fechaInicio !== undefined) updateData.fechaInicio = req.body.fechaInicio;
      if (req.body.fechaTermino !== undefined) updateData.fechaTermino = req.body.fechaTermino;
      if (req.body.nombre !== undefined) updateData.nombre = req.body.nombre;
      if (req.body.motivo !== undefined) updateData.motivo = req.body.motivo;

      if (current.estado === 'cerrado') {
        updateData.estado = 'activo';
        updateData.estadoAprobacion = 'aprobado';
      }

      const oldBalance = await storage.getFundAllocationBalance(req.params.id);
      console.log(`[FUND-EDIT] Fund ${req.params.id}: before montoInicial=${current.montoInicial}, balance:`, oldBalance);

      const updated = await storage.updateFundAllocation(req.params.id, updateData);

      if (newMonto !== null) {
        const balanceAfterUpdate = await storage.getFundAllocationBalance(req.params.id);
        const resetAdjustment = newMonto - balanceAfterUpdate.saldoDisponible;
        if (Math.abs(resetAdjustment) > 0.01) {
          const oldMontoNum = parseFloat(String(current.montoInicial || 0));
          await storage.createFundMovement({
            allocationId: req.params.id,
            tipoMovimiento: 'ajuste',
            monto: String(resetAdjustment),
            descripcion: `Edición de fondo: monto inicial cambiado de $${oldMontoNum.toLocaleString('es-CL')} a $${newMonto.toLocaleString('es-CL')}. Saldo reiniciado a $${newMonto.toLocaleString('es-CL')}.`,
            creadoPorId: user.id,
          });
          console.log(`[FUND-EDIT] Created adjustment movement of ${resetAdjustment} to reset saldo to ${newMonto}`);
        }
      }

      const finalBalance = await storage.getFundAllocationBalance(req.params.id);
      console.log(`[FUND-EDIT] Fund ${req.params.id}: after montoInicial=${updated.montoInicial}, finalBalance:`, finalBalance);
      res.json({ ...updated, ...finalBalance });
    } catch (error: any) {
      res.status(500).json({ message: 'Error al actualizar asignación', error: error.message });
    }
  }));

  // Close fund allocation (Admin/HR only)
  app.post('/api/fund-allocations/:id/close', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;

      if (!['admin', 'recursos_humanos'].includes(user.role)) {
        return res.status(403).json({ message: 'No autorizado' });
      }

      const closed = await storage.closeFundAllocation(req.params.id);
      res.json(closed);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al cerrar asignación', error: error.message });
    }
  }));

  // Approve fund allocation (Admin/HR only) - requires transfer receipt
  app.post('/api/fund-allocations/:id/approve', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      console.log('[APPROVE FUND] Request received:', { id: req.params.id, comprobanteUrl: req.body.comprobanteUrl, comprobantePreviewUrl: req.body.comprobantePreviewUrl, userId: user.id });

      if (!['admin', 'recursos_humanos'].includes(user.role)) {
        return res.status(403).json({ message: 'No autorizado' });
      }

      const { comprobanteUrl, comprobantePreviewUrl } = req.body;

      if (!comprobanteUrl) {
        return res.status(400).json({ message: 'El comprobante de transferencia es requerido' });
      }

      const approved = await storage.approveFundAllocation(req.params.id, comprobanteUrl, user.id, comprobantePreviewUrl);
      console.log('[APPROVE FUND] Result:', approved);
      res.json(approved);
    } catch (error: any) {
      console.error('[APPROVE FUND] Error:', error);
      res.status(500).json({ message: 'Error al aprobar asignación', error: error.message });
    }
  }));

  // Reject fund allocation (Admin/HR only) - requires reason
  app.post('/api/fund-allocations/:id/reject', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;

      if (!['admin', 'recursos_humanos'].includes(user.role)) {
        return res.status(403).json({ message: 'No autorizado' });
      }

      const { motivoRechazo } = req.body;

      if (!motivoRechazo) {
        return res.status(400).json({ message: 'El motivo del rechazo es requerido' });
      }

      const rejected = await storage.rejectFundAllocation(req.params.id, motivoRechazo, user.id);
      res.json(rejected);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al rechazar asignación', error: error.message });
    }
  }));

  // Add adjustment to fund (Admin/HR only)
  app.post('/api/fund-allocations/:id/adjust', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;

      if (!['admin', 'recursos_humanos'].includes(user.role)) {
        return res.status(403).json({ message: 'No autorizado' });
      }

      const { monto, descripcion } = req.body;

      if (!monto || typeof monto !== 'number') {
        return res.status(400).json({ message: 'Monto requerido' });
      }

      const movement = await storage.createFundMovement({
        allocationId: req.params.id,
        tipoMovimiento: 'ajuste',
        monto: monto.toString(),
        descripcion: descripcion || 'Ajuste manual',
        creadoPorId: user.id,
      });

      res.status(201).json(movement);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al crear ajuste', error: error.message });
    }
  }));

  // Get movements for a fund allocation
  app.get('/api/fund-allocations/:id/movements', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const movements = await storage.getFundMovements(req.params.id);
      res.json(movements);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al obtener movimientos', error: error.message });
    }
  }));

  // Delete fund allocation (Admin only)
  app.delete('/api/fund-allocations/:id', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;

      if (user.role !== 'admin' && user.role !== 'recursos_humanos') {
        return res.status(403).json({ message: 'Solo administradores y RRHH pueden eliminar fondos' });
      }

      const allocation = await storage.getFundAllocationById(req.params.id);
      if (!allocation) {
        return res.status(404).json({ message: 'Fondo no encontrado' });
      }

      await storage.deleteFundAllocation(req.params.id);
      res.json({ message: 'Fondo eliminado exitosamente' });
    } catch (error: any) {
      console.error('Error deleting fund allocation:', error);
      res.status(500).json({ message: 'Error al eliminar fondo', error: error.message });
    }
  }));

  // Get user's active fund allocations with balances
  app.get('/api/fund-allocations/user/:userId', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      const targetUserId = req.params.userId;

      // Salesperson and supervisor can only see their own
      if ((user.role === 'salesperson' || user.role === 'supervisor') && user.id !== targetUserId) {
        return res.status(403).json({ message: 'No autorizado' });
      }

      const allocations = await storage.getUserActiveFundAllocations(targetUserId);
      res.json(allocations);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al obtener fondos del usuario', error: error.message });
    }
  }));

  // Get fund summary (Admin/HR sees all, others see their own)
  app.get('/api/fund-allocations/summary/global', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      const { userId } = req.query;

      let targetUserId: string | undefined;

      // Salesperson and supervisor can only see their own fund summary
      if (user.role === 'salesperson' || user.role === 'supervisor') {
        targetUserId = user.id;
      } else if (userId) {
        targetUserId = userId as string;
      }

      const summary = await storage.getFundAllocationSummary(targetUserId);
      res.json(summary);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al obtener resumen de fondos', error: error.message });
    }
  }));

  // Request fund allocation (any authenticated user can request)
  app.post('/api/fondos/solicitar', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      const { monto, motivo, centroCostos, fechaTermino, segmentCode } = req.body;

      if (!monto || monto <= 0) {
        return res.status(400).json({ message: 'El monto debe ser mayor a 0' });
      }

      if (!segmentCode) {
        return res.status(400).json({ message: 'El segmento es requerido para solicitar fondos' });
      }

      // All fund allocations go directly to RRHH approval (supervisor step removed)

      // Create fund allocation with multi-level approval flow
      const allocation = await storage.createFundAllocation({
        nombre: `Solicitud de ${user.fullName || user.username}`,
        descripcion: motivo || '',
        montoInicial: monto.toString(),
        assignedToId: user.id,
        assignedById: user.id, // Self-requested
        estado: 'solicitud',
        estadoAprobacion: 'pendiente_rrhh',
        segmentCode: segmentCode,
        fechaInicio: new Date().toISOString().split('T')[0],
        fechaTermino: fechaTermino || null,
        centroCostos: centroCostos || null,
        motivo: motivo || null,
        supervisorAprobadorId: null,
        fechaAprobacionSupervisor: null,
        comentarioSupervisor: null,
      });

      try {
        const { db } = await import('./db');
        const { users } = await import('../shared/schema');
        const { or, eq } = await import('drizzle-orm');

        const rrhhUsers = await db.select({ id: users.id, role: users.role })
          .from(users)
          .where(or(eq(users.role, 'recursos_humanos'), eq(users.role, 'admin')));

        for (const rrhhUser of rrhhUsers) {
          await storage.createNotification({
            userId: rrhhUser.id,
            type: 'fund_request',
            title: 'Nueva solicitud de fondos',
            message: `${user.fullName || user.username} ha solicitado fondos por $${Number(monto).toLocaleString('es-CL')} - Requiere aprobación de RRHH`,
            priority: 'high',
            metadata: { allocationId: allocation.id },
          });
        }
      } catch (notifError) {
        console.error('Error sending notification to RRHH:', notifError);
      }

      res.status(201).json(allocation);
    } catch (error: any) {
      console.error('Error creating fund request:', error);
      res.status(500).json({ message: 'Error al crear solicitud de fondo', error: error.message });
    }
  }));

  // ==================================================================================
  // FLUJO DE APROBACIÓN MULTI-NIVEL PARA FONDOS
  // ==================================================================================

  // Get segment supervisors (Admin/HR only)
  app.get('/api/segment-supervisors', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      if (!['admin', 'recursos_humanos'].includes(user.role)) {
        return res.status(403).json({ message: 'No autorizado' });
      }

      const { segmentCode } = req.query;
      const supervisors = await storage.getSegmentSupervisors(segmentCode as string | undefined);
      res.json(supervisors);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al obtener supervisores de segmento', error: error.message });
    }
  }));

  // Create segment supervisor assignment (Admin/HR only)
  app.post('/api/segment-supervisors', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      if (!['admin', 'recursos_humanos'].includes(user.role)) {
        return res.status(403).json({ message: 'No autorizado' });
      }

      const { segmentCode, supervisorUserId } = req.body;
      if (!segmentCode || !supervisorUserId) {
        return res.status(400).json({ message: 'Se requiere segmentCode y supervisorUserId' });
      }

      const supervisor = await storage.createSegmentSupervisor({ segmentCode, supervisorUserId });
      res.status(201).json(supervisor);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al crear asignación de supervisor', error: error.message });
    }
  }));

  // Delete segment supervisor assignment (Admin/HR only)
  app.delete('/api/segment-supervisors/:id', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      if (!['admin', 'recursos_humanos'].includes(user.role)) {
        return res.status(403).json({ message: 'No autorizado' });
      }

      await storage.deleteSegmentSupervisor(req.params.id);
      res.json({ message: 'Asignación eliminada' });
    } catch (error: any) {
      res.status(500).json({ message: 'Error al eliminar asignación', error: error.message });
    }
  }));

  // Get fund allocations pending supervisor approval
  app.get('/api/fund-allocations/pending/supervisor', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      if (!['supervisor', 'admin'].includes(user.role)) {
        return res.status(403).json({ message: 'No autorizado' });
      }

      const allocations = await storage.getFundAllocationsPendingSupervisor(user.id);
      res.json(allocations);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al obtener solicitudes pendientes', error: error.message });
    }
  }));

  // Get fund allocations pending RRHH approval
  app.get('/api/fund-allocations/pending/rrhh', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      if (!['recursos_humanos', 'admin'].includes(user.role)) {
        return res.status(403).json({ message: 'No autorizado' });
      }

      const allocations = await storage.getFundAllocationsPendingRRHH();
      res.json(allocations);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al obtener solicitudes pendientes RRHH', error: error.message });
    }
  }));

  // Supervisor approve fund allocation
  app.post('/api/fund-allocations/:id/supervisor-approve', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      if (!['supervisor', 'admin'].includes(user.role)) {
        return res.status(403).json({ message: 'No autorizado' });
      }

      const { comentario } = req.body;
      const allocation = await storage.supervisorApproveFund(req.params.id, user.id, comentario);

      // Send notification to all RRHH and admin users
      try {
        // Query users with role 'rrhh' or 'admin' directly
        const { db } = await import('./db');
        const { users } = await import('../shared/schema');
        const { or, eq } = await import('drizzle-orm');

        const rrhhUsers = await db.select({ id: users.id, role: users.role })
          .from(users)
          .where(or(eq(users.role, 'recursos_humanos'), eq(users.role, 'admin')));

        for (const rrhhUser of rrhhUsers) {
          await storage.createNotification({
            userId: rrhhUser.id,
            type: 'fund_request',
            title: 'Solicitud de fondo aprobada por supervisor',
            message: `La solicitud de fondo "${allocation.nombre}" fue aprobada por el supervisor y requiere aprobación de RRHH`,
            priority: 'high',
            metadata: { allocationId: allocation.id },
          });
        }
      } catch (notifError) {
        console.error('Error sending notification:', notifError);
      }

      res.json(allocation);
    } catch (error: any) {
      res.status(500).json({ message: error.message || 'Error al aprobar solicitud' });
    }
  }));

  // Supervisor reject fund allocation
  app.post('/api/fund-allocations/:id/supervisor-reject', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      if (!['supervisor', 'admin'].includes(user.role)) {
        return res.status(403).json({ message: 'No autorizado' });
      }

      const { comentario } = req.body;
      if (!comentario) {
        return res.status(400).json({ message: 'Se requiere un comentario para rechazar' });
      }

      const allocation = await storage.supervisorRejectFund(req.params.id, user.id, comentario);

      // Send notification to requester
      try {
        await storage.createNotification({
          userId: allocation.assignedToId,
          type: 'fund_request',
          title: 'Solicitud de fondo rechazada',
          message: `Tu solicitud de fondo "${allocation.nombre}" fue rechazada por el supervisor: ${comentario}`,
          priority: 'high',
          metadata: { allocationId: allocation.id },
        });
      } catch (notifError) {
        console.error('Error sending notification:', notifError);
      }

      res.json(allocation);
    } catch (error: any) {
      res.status(500).json({ message: error.message || 'Error al rechazar solicitud' });
    }
  }));

  // RRHH approve fund allocation
  app.post('/api/fund-allocations/:id/rrhh-approve', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      if (!['recursos_humanos', 'admin'].includes(user.role)) {
        return res.status(403).json({ message: 'No autorizado' });
      }

      const { comprobanteUrl, comentario } = req.body;
      if (!comprobanteUrl) {
        return res.status(400).json({ message: 'Se requiere el comprobante de transferencia' });
      }

      const allocation = await storage.rrhhApproveFund(req.params.id, user.id, comprobanteUrl, comentario);

      // Send notification to requester
      try {
        await storage.createNotification({
          userId: allocation.assignedToId,
          type: 'fund_request',
          title: 'Solicitud de fondo aprobada',
          message: `Tu solicitud de fondo "${allocation.nombre}" fue aprobada. Los fondos ya están disponibles.`,
          priority: 'high',
          metadata: { allocationId: allocation.id },
        });
      } catch (notifError) {
        console.error('Error sending notification:', notifError);
      }

      res.json(allocation);
    } catch (error: any) {
      res.status(500).json({ message: error.message || 'Error al aprobar solicitud' });
    }
  }));

  // RRHH reject fund allocation
  app.post('/api/fund-allocations/:id/rrhh-reject', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      if (!['recursos_humanos', 'admin'].includes(user.role)) {
        return res.status(403).json({ message: 'No autorizado' });
      }

      const { comentario } = req.body;
      if (!comentario) {
        return res.status(400).json({ message: 'Se requiere un comentario para rechazar' });
      }

      const allocation = await storage.rrhhRejectFund(req.params.id, user.id, comentario);

      // Send notification to requester
      try {
        await storage.createNotification({
          userId: allocation.assignedToId,
          type: 'fund_request',
          title: 'Solicitud de fondo rechazada por RRHH',
          message: `Tu solicitud de fondo "${allocation.nombre}" fue rechazada por RRHH: ${comentario}`,
          priority: 'high',
          metadata: { allocationId: allocation.id },
        });
      } catch (notifError) {
        console.error('Error sending notification:', notifError);
      }

      res.json(allocation);
    } catch (error: any) {
      res.status(500).json({ message: error.message || 'Error al rechazar solicitud' });
    }
  }));

  // Get fund allocation approval history
  app.get('/api/fund-allocations/:id/approval-history', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const history = await storage.getFundApprovalHistory(req.params.id);
      res.json(history);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al obtener historial de aprobación', error: error.message });
    }
  }));

  // Recharge approved fund allocation (admin/rrhh only)
  app.patch('/api/fund-allocations/:id/recharge', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      const allocationId = req.params.id;

      // Solo admin y rrhh pueden recargar fondos
      if (!['admin', 'recursos_humanos'].includes(user.role)) {
        return res.status(403).json({ message: 'No autorizado para recargar fondos' });
      }

      const { rechargeMode, rechargeAmount, newFechaInicio, newFechaTermino, comentario } = req.body;

      if (!comentario) {
        return res.status(400).json({ message: 'El comentario es requerido' });
      }

      const result = await storage.rechargeFundAllocation({
        allocationId,
        performedById: user.id,
        performedByName: user.salespersonName || user.username || user.email,
        rechargeMode: rechargeMode || 'gastado',
        rechargeAmount: rechargeAmount ? parseFloat(rechargeAmount) : undefined,
        newFechaInicio,
        newFechaTermino,
        comentario
      });

      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message || 'Error al recargar fondo' });
    }
  }));

  // Get fund allocation recharge history
  app.get('/api/fund-allocations/:id/recharge-history', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const history = await storage.getFundRechargeHistory(req.params.id);
      res.json(history);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al obtener historial de recargas', error: error.message });
    }
  }));

  // ==================================================================================
  // FONDOS RECURRENTES ROUTES
  // ==================================================================================

  app.post('/api/fund-recurring-configs', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      if (!['admin', 'recursos_humanos'].includes(user.role)) {
        return res.status(403).json({ message: 'Solo Admin o RRHH pueden crear fondos recurrentes' });
      }
      const validated = insertFundRecurringConfigSchema.parse({
        ...req.body,
        assignedById: user.id,
      });
      const config = await storage.createFundRecurringConfig(validated);
      await storage.processRecurringFunds();
      res.status(201).json(config);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: 'Datos inválidos', errors: error.errors });
      }
      res.status(500).json({ message: 'Error al crear fondo recurrente', error: error.message });
    }
  }));

  app.get('/api/fund-recurring-configs', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      if (!['admin', 'recursos_humanos'].includes(user.role)) {
        return res.status(403).json({ message: 'No autorizado' });
      }
      const configs = await storage.getFundRecurringConfigs();
      res.json(configs);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al obtener fondos recurrentes', error: error.message });
    }
  }));

  app.patch('/api/fund-recurring-configs/:id', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      if (!['admin', 'recursos_humanos'].includes(user.role)) {
        return res.status(403).json({ message: 'No autorizado' });
      }
      const { nombre, montoMensual } = req.body;
      const updates: any = {};
      if (nombre) updates.nombre = nombre;
      if (montoMensual) updates.montoMensual = montoMensual;
      const updated = await storage.updateFundRecurringConfig(req.params.id, updates);
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al actualizar fondo recurrente', error: error.message });
    }
  }));

  app.post('/api/fund-recurring-configs/:id/toggle', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      if (!['admin', 'recursos_humanos'].includes(user.role)) {
        return res.status(403).json({ message: 'No autorizado' });
      }
      const config = await storage.getFundRecurringConfigById(req.params.id);
      if (!config) {
        return res.status(404).json({ message: 'Configuración no encontrada' });
      }
      const updated = await storage.toggleFundRecurringConfig(req.params.id, !config.isActive);
      if (updated.isActive) {
        await storage.processRecurringFunds();
      }
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: 'Error al cambiar estado', error: error.message });
    }
  }));

  app.delete('/api/fund-recurring-configs/:id', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      if (!['admin', 'recursos_humanos'].includes(user.role)) {
        return res.status(403).json({ message: 'No autorizado' });
      }
      await storage.deleteFundRecurringConfig(req.params.id);
      res.json({ message: 'Fondo recurrente eliminado' });
    } catch (error: any) {
      res.status(500).json({ message: 'Error al eliminar fondo recurrente', error: error.message });
    }
  }));

  app.post('/api/fund-recurring-configs/process', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      if (!['admin', 'recursos_humanos'].includes(user.role)) {
        return res.status(403).json({ message: 'No autorizado' });
      }
      const result = await storage.processRecurringFunds();
      res.json({ message: 'Procesamiento completado', ...result });
    } catch (error: any) {
      res.status(500).json({ message: 'Error al procesar fondos recurrentes', error: error.message });
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

      // Automáticamente agregar el cliente a seguimiento (CRM Lead) si no existe ya
      try {
        const clienteId = validatedData.clienteId;
        const clienteName = validatedData.clienteNombre || 'Cliente';

        // Verificar si el cliente ya existe como lead
        const existingLeads = await storage.getLeads({ salespersonId: vendedorId });
        const clienteYaEnSeguimiento = existingLeads.some(
          (lead: any) => lead.clientId === clienteId || lead.clientName === clienteName
        );

        if (!clienteYaEnSeguimiento) {
          // Crear un nuevo lead con etapa "promesa"
          await storage.createLead({
            clientId: clienteId,
            clientName: clienteName,
            salespersonId: vendedorId,
            stage: 'promesa',
            priority: 'medium',
            notes: `Cliente agregado automáticamente por promesa de compra - Monto: $${validatedData.montoPrometido?.toLocaleString('es-CL') || 0}`,
          });
          console.log(`✅ Cliente "${clienteName}" agregado automáticamente a seguimiento`);
        }
      } catch (seguimientoError: any) {
        // No fallar la creación de promesa si falla el seguimiento
        console.error('Error al agregar cliente a seguimiento:', seguimientoError.message);
      }

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

  // Get promesas con cumplimiento (comparación con ventas reales)
  // IMPORTANTE: Esta ruta debe estar ANTES de /:id para evitar conflictos de matching
  app.get('/api/promesas-compra/cumplimiento/reporte', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;
      const { vendedorId, semana, anio, startDate, endDate } = req.query;

      const filters: any = {};

      // Salesperson can only see their own data
      if (user.role === 'salesperson') {
        filters.vendedorId = user.id;
      } else if (user.role === 'supervisor') {
        // Supervisor can only see data from salespeople under their supervision
        // Uses the same method as the salespeople dropdown for consistency
        const salespeopleUnderSupervisor = await storage.getSalespeopleUnderSupervisor(user.id);
        if (salespeopleUnderSupervisor.length > 0) {
          filters.vendedorIds = salespeopleUnderSupervisor.map((s: any) => s.id);
        }
        // If a specific vendedorId is requested, only allow if it's under the supervisor
        if (vendedorId) {
          if (!filters.vendedorIds || filters.vendedorIds.includes(vendedorId)) {
            filters.vendedorId = vendedorId;
          }
        }
      } else if (vendedorId) {
        // Admin can filter by any vendedor
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

      // Add canDelete flag to each promesa based on user authorization
      const resultadosConPermisos = await Promise.all(
        resultados.map(async (item: any) => {
          let canDelete = false;

          if (user.role === 'admin') {
            // Admin can delete any promesa
            canDelete = true;
          } else if (user.role === 'salesperson') {
            // Salesperson can delete their own promesas
            canDelete = item.promesa.vendedorId === user.id;
          } else if (user.role === 'supervisor') {
            // Supervisor can delete promesas of salespeople under their supervision
            const salespersonUser = await storage.getSalespersonUserById(item.promesa.vendedorId);
            canDelete = salespersonUser?.supervisorId === user.id;
          }

          return {
            ...item,
            canDelete
          };
        })
      );

      // Keep the nested structure that the frontend expects
      res.json(resultadosConPermisos);
    } catch (error: any) {
      console.error('[ERROR] /api/promesas-compra/cumplimiento/reporte:', error);
      res.status(500).json({ message: 'Error al obtener reporte de cumplimiento', error: error.message });
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
      if (user.role === 'salesperson') {
        // Salesperson solo puede eliminar sus propias promesas
        if (promesa.vendedorId !== user.id) {
          return res.status(403).json({ message: 'No autorizado para eliminar esta promesa' });
        }
      } else if (user.role === 'supervisor') {
        // Supervisor puede eliminar promesas de vendedores bajo su supervisión
        const salespersonUser = await storage.getSalespersonUserById(promesa.vendedorId);

        if (!salespersonUser) {
          return res.status(404).json({ message: 'Vendedor no encontrado' });
        }

        // Verificar que el vendedor pertenece al supervisor
        if (salespersonUser.supervisorId !== user.id) {
          return res.status(403).json({ message: 'No autorizado para eliminar promesas de este vendedor' });
        }
      }
      // Admin puede eliminar cualquier promesa (no requiere verificación adicional)

      await storage.deletePromesaCompra(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: 'Error al eliminar promesa de compra', error: error.message });
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

      // 🔀 ROUTER: Ejecutar ETL específico según etlName
      // Execute ETL in background (non-blocking)
      const etlPromise = etlName === 'nvv'
        ? executeNVVETL()
        : etlName === 'gdv'
          ? executeGDVETL()
          : executeIncrementalETL(etlName as string);

      etlPromise
        .then((result: any) => {
          console.log('\n╔═══════════════════════════════════════════════════════════════╗');
          console.log('║  ✅ ETL BACKGROUND EXECUTION COMPLETADO                      ║');
          console.log('╚═══════════════════════════════════════════════════════════════╝');

          const recordsProcessed = result.recordsProcessed ?? result.records_processed ?? 0;
          const executionTime = result.executionTimeMs ?? result.execution_time_ms ?? 0;

          console.log(`📊 Registros procesados: ${recordsProcessed}`);
          console.log(`⏱️  Tiempo de ejecución: ${executionTime}ms`);
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

  // ═══════════════════════════════════════════════════════════════
  // Sync All ETLs — Runs Ventas → GDV → NVV sequentially
  // ═══════════════════════════════════════════════════════════════

  // Track sync-all state — live per-ETL status for real-time modal
  let syncAllRunning = false;
  let syncAllStatus: any = null; // Live status (updated during execution)

  app.post('/api/etl/sync-all', requireAdminOrSupervisor, asyncHandler(async (req: any, res: any) => {
    try {
      if (syncAllRunning) {
        return res.status(409).json({
          success: false,
          message: 'Ya hay una sincronización completa en ejecución',
        });
      }

      console.log(`\n🔄 [SYNC-ALL] Iniciado por: ${req.user.email}`);
      syncAllRunning = true;

      // Initialize live status — all pending (with progress fields)
      syncAllStatus = {
        ventas: { status: 'pending', recordsProcessed: 0, executionTimeMs: 0, error: null, progress: 0, progressMessage: '' },
        gdv: { status: 'pending', recordsProcessed: 0, executionTimeMs: 0, error: null, progress: 0, progressMessage: '' },
        nvv: { status: 'pending', recordsProcessed: 0, executionTimeMs: 0, error: null, progress: 0, progressMessage: '' },
        totalRecords: 0,
        totalTimeMs: 0,
        completedAt: null,
      };

      // Run in background
      (async () => {
        const startTime = Date.now();

        // 1/3 — Ventas
        try {
          syncAllStatus.ventas.status = 'running';
          console.log('📊 [SYNC-ALL] (1/3) Starting Ventas...');
          // Listen to progress events
          const ventasProgressListener = (event: any) => {
            syncAllStatus.ventas.progress = event.percentage || 0;
            syncAllStatus.ventas.progressMessage = event.message || '';
          };
          etlProgressEmitter.on('progress', ventasProgressListener);
          try {
            const ventasResult = await executeIncrementalETL();
            syncAllStatus.ventas = { status: 'done', recordsProcessed: ventasResult.recordsProcessed, executionTimeMs: ventasResult.executionTimeMs, error: ventasResult.error || null, progress: 100, progressMessage: 'Completado' };
            console.log(`✅ [SYNC-ALL] Ventas: ${ventasResult.recordsProcessed} registros`);
          } finally {
            etlProgressEmitter.off('progress', ventasProgressListener);
          }
        } catch (error: any) {
          syncAllStatus.ventas = { status: 'error', recordsProcessed: 0, executionTimeMs: 0, error: error.message, progress: 0, progressMessage: '' };
          console.error('[SYNC-ALL] Ventas failed:', error.message);
        }

        // 2/3 — GDV
        try {
          syncAllStatus.gdv.status = 'running';
          console.log('📊 [SYNC-ALL] (2/3) Starting GDV...');
          const gdvProgressListener = (event: any) => {
            syncAllStatus.gdv.progress = event.percentage || 0;
            syncAllStatus.gdv.progressMessage = event.message || '';
          };
          gdvEtlProgressEmitter.on('progress', gdvProgressListener);
          try {
            const gdvResult = await executeGDVETL();
            syncAllStatus.gdv = { status: 'done', recordsProcessed: gdvResult.recordsProcessed, executionTimeMs: gdvResult.executionTimeMs, error: gdvResult.error || null, progress: 100, progressMessage: 'Completado' };
            console.log(`✅ [SYNC-ALL] GDV: ${gdvResult.recordsProcessed} registros`);
          } finally {
            gdvEtlProgressEmitter.off('progress', gdvProgressListener);
          }
        } catch (error: any) {
          syncAllStatus.gdv = { status: 'error', recordsProcessed: 0, executionTimeMs: 0, error: error.message, progress: 0, progressMessage: '' };
          console.error('[SYNC-ALL] GDV failed:', error.message);
        }

        // 3/3 — NVV
        try {
          syncAllStatus.nvv.status = 'running';
          console.log('📊 [SYNC-ALL] (3/3) Starting NVV...');
          const nvvProgressListener = (event: any) => {
            syncAllStatus.nvv.progress = event.percentage || 0;
            syncAllStatus.nvv.progressMessage = event.message || '';
          };
          nvvEtlProgressEmitter.on('progress', nvvProgressListener);
          try {
            const nvvResult = await executeNVVETL();
            syncAllStatus.nvv = { status: 'done', recordsProcessed: nvvResult.records_processed, executionTimeMs: nvvResult.execution_time_ms, error: nvvResult.error || null, progress: 100, progressMessage: 'Completado' };
            console.log(`✅ [SYNC-ALL] NVV: ${nvvResult.records_processed} registros`);
          } finally {
            nvvEtlProgressEmitter.off('progress', nvvProgressListener);
          }
        } catch (error: any) {
          syncAllStatus.nvv = { status: 'error', recordsProcessed: 0, executionTimeMs: 0, error: error.message, progress: 0, progressMessage: '' };
          console.error('[SYNC-ALL] NVV failed:', error.message);
        }

        syncAllStatus.totalRecords = (syncAllStatus.ventas.recordsProcessed || 0) + (syncAllStatus.gdv.recordsProcessed || 0) + (syncAllStatus.nvv.recordsProcessed || 0);
        syncAllStatus.totalTimeMs = Date.now() - startTime;
        syncAllStatus.completedAt = new Date().toISOString();
        syncAllRunning = false;

        console.log(`\n✅ [SYNC-ALL] Completed: ${syncAllStatus.totalRecords} total records in ${(syncAllStatus.totalTimeMs / 1000).toFixed(1)}s`);
      })().catch((err) => {
        console.error('[SYNC-ALL] Unexpected error:', err);
        syncAllRunning = false;
      });

      res.json({
        success: true,
        message: 'Sincronización completa iniciada (Ventas → GDV → NVV)',
        isRunning: true,
      });
    } catch (error: any) {
      syncAllRunning = false;
      console.error('[SYNC-ALL] Error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }));

  // Check sync-all live status (polled by frontend modal)
  app.get('/api/etl/sync-all/status', requireAdminOrSupervisor, asyncHandler(async (req: any, res: any) => {
    res.json({
      isRunning: syncAllRunning,
      etls: syncAllStatus,
    });
  }));

  // ETL Progress Stream (Server-Sent Events) - Real-time progress updates
  app.get('/api/etl/progress', requireAdminOrSupervisor, (req: any, res: any) => {
    const { etlName = 'ventas_incremental' } = req.query;

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    // 🔀 ROUTER: Seleccionar el emitter correcto según etlName
    const emitter = etlName === 'nvv' ? nvvEtlProgressEmitter :
      etlName === 'gdv' ? gdvEtlProgressEmitter :
        etlProgressEmitter;

    // 📼 REPLAY BUFFER: Enviar eventos históricos primero (solo para NVV por ahora)
    if (etlName === 'nvv') {
      const historicalEvents = getNVVProgressHistory();
      historicalEvents.forEach(event => {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      });
    }

    const progressListener = (event: any) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    emitter.on('progress', progressListener);

    // Cleanup on client disconnect
    req.on('close', () => {
      emitter.off('progress', progressListener);
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
      await storage.cancelETLExecution(runningExecution.id, req.user.email, etlName as string);

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

  // Helper functions for ETL diagnostics
  async function runNVVDiagnostics(req: any, res: any) {
    console.log('\n╔═══════════════════════════════════════════════════════════════╗');
    console.log('║  🔍 DIAGNÓSTICO DE PRODUCCIÓN - ETL SCHEMA NVV               ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝\n');

    const diagnosticResults: any = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'unknown',
      etlName: 'nvv',
      checks: []
    };

    // 1. Check database connection
    try {
      await db.execute(sql`SELECT 1 as test`);
      diagnosticResults.checks.push({ name: 'database_connection', status: 'OK', success: true });
    } catch (err: any) {
      diagnosticResults.checks.push({ name: 'database_connection', status: 'ERROR', success: false, error: err.message });
    }

    // 2. Check NVV schema exists
    try {
      const schemasResult = await db.execute(sql`SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'nvv'`);
      const hasNVVSchema = schemasResult.rows.length > 0;
      diagnosticResults.checks.push({ name: 'nvv_schema_exists', status: hasNVVSchema ? 'OK' : 'ERROR', success: hasNVVSchema });
    } catch (err: any) {
      diagnosticResults.checks.push({ name: 'nvv_schema_exists', status: 'ERROR', success: false, error: err.message });
    }

    // 3. Check NVV tables
    try {
      const tablesResult = await db.execute(sql`
        SELECT table_name FROM information_schema.tables WHERE table_schema = 'nvv' ORDER BY table_name
      `);
      const expectedTables = ['stg_maeedo_nvv', 'stg_maeddo_nvv', 'fact_nvv', 'nvv_sync_log'];
      const foundTables = tablesResult.rows.map((row: any) => row.table_name);
      const missingTables = expectedTables.filter(t => !foundTables.includes(t));

      diagnosticResults.checks.push({
        name: 'nvv_tables',
        status: missingTables.length === 0 ? 'OK' : 'INCOMPLETE',
        success: missingTables.length === 0,
        totalTables: foundTables.length,
        missingTables: missingTables.length > 0 ? missingTables : undefined
      });
    } catch (err: any) {
      diagnosticResults.checks.push({ name: 'nvv_tables', status: 'ERROR', success: false, error: err.message });
    }

    // 4. Check fact_nvv record count
    try {
      const countResult = await db.execute(sql`SELECT COUNT(*) as count FROM nvv.fact_nvv`);
      const count = parseInt(countResult.rows[0]?.count || '0');
      diagnosticResults.checks.push({ name: 'fact_nvv_records', status: 'OK', success: true, recordCount: count });
    } catch (err: any) {
      diagnosticResults.checks.push({ name: 'fact_nvv_records', status: 'ERROR', success: false, error: err.message });
    }

    // Calculate summary
    const successful = diagnosticResults.checks.filter((c: any) => c.success).length;
    const errors = diagnosticResults.checks.filter((c: any) => !c.success).length;

    diagnosticResults.summary = { successful, errors, warnings: 0, total: diagnosticResults.checks.length };

    console.log(`✅ Diagnóstico NVV completado: ${successful} exitosas, ${errors} errores\n`);
    return res.json(diagnosticResults);
  }

  async function runGDVDiagnostics(req: any, res: any) {
    console.log('\n╔═══════════════════════════════════════════════════════════════╗');
    console.log('║  🔍 DIAGNÓSTICO DE PRODUCCIÓN - ETL SCHEMA GDV               ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝\n');

    const diagnosticResults: any = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'unknown',
      etlName: 'gdv',
      checks: []
    };

    // 1. Check database connection
    try {
      await db.execute(sql`SELECT 1 as test`);
      diagnosticResults.checks.push({ name: 'database_connection', status: 'OK', success: true });
    } catch (err: any) {
      diagnosticResults.checks.push({ name: 'database_connection', status: 'ERROR', success: false, error: err.message });
    }

    // 2. Check GDV schema exists
    try {
      const schemasResult = await db.execute(sql`SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'gdv'`);
      const hasGDVSchema = schemasResult.rows.length > 0;
      diagnosticResults.checks.push({ name: 'gdv_schema_exists', status: hasGDVSchema ? 'OK' : 'ERROR', success: hasGDVSchema });
    } catch (err: any) {
      diagnosticResults.checks.push({ name: 'gdv_schema_exists', status: 'ERROR', success: false, error: err.message });
    }

    // 3. Check GDV tables
    try {
      const tablesResult = await db.execute(sql`
        SELECT table_name FROM information_schema.tables WHERE table_schema = 'gdv' ORDER BY table_name
      `);
      const expectedTables = ['stg_maeedo_gdv', 'stg_maeddo_gdv', 'fact_gdv', 'gdv_sync_log'];
      const foundTables = tablesResult.rows.map((row: any) => row.table_name);
      const missingTables = expectedTables.filter(t => !foundTables.includes(t));

      diagnosticResults.checks.push({
        name: 'gdv_tables',
        status: missingTables.length === 0 ? 'OK' : 'INCOMPLETE',
        success: missingTables.length === 0,
        totalTables: foundTables.length,
        missingTables: missingTables.length > 0 ? missingTables : undefined
      });
    } catch (err: any) {
      diagnosticResults.checks.push({ name: 'gdv_tables', status: 'ERROR', success: false, error: err.message });
    }

    // 4. Check fact_gdv record count
    try {
      const countResult = await db.execute(sql`SELECT COUNT(*) as count FROM gdv.fact_gdv`);
      const count = parseInt(countResult.rows[0]?.count || '0');
      diagnosticResults.checks.push({ name: 'fact_gdv_records', status: 'OK', success: true, recordCount: count });
    } catch (err: any) {
      diagnosticResults.checks.push({ name: 'fact_gdv_records', status: 'ERROR', success: false, error: err.message });
    }

    // Calculate summary
    const successful = diagnosticResults.checks.filter((c: any) => c.success).length;
    const errors = diagnosticResults.checks.filter((c: any) => !c.success).length;

    diagnosticResults.summary = { successful, errors, warnings: 0, total: diagnosticResults.checks.length };

    console.log(`✅ Diagnóstico GDV completado: ${successful} exitosas, ${errors} errores\n`);
    return res.json(diagnosticResults);
  }

  // Production Diagnostics - Admin only, logs detailed info to server console
  app.post('/api/etl/diagnostics', requireRoles(['admin']), asyncHandler(async (req: any, res: any) => {
    try {
      const { etlName = 'ventas_incremental' } = req.query;

      // 🔀 ROUTER: Ejecutar diagnóstico específico según etlName
      if (etlName === 'nvv') {
        return await runNVVDiagnostics(req, res);
      } else if (etlName === 'gdv') {
        return await runGDVDiagnostics(req, res);
      }

      // Default: Diagnóstico de Ventas (código existente)
      console.log('\n╔═══════════════════════════════════════════════════════════════╗');
      console.log('║  🔍 DIAGNÓSTICO DE PRODUCCIÓN - ETL SCHEMA VENTAS            ║');
      console.log('╚═══════════════════════════════════════════════════════════════╝\n');

      const diagnosticResults: any = {
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'unknown',
        etlName: 'ventas',
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
      const stagingTableNames = ['stg_maeedo', 'stg_maeddo', 'stg_maeen', 'stg_maepr', 'stg_tabbo', 'stg_tabpp', 'stg_tabru', 'stg_maeven'];

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

      // stg_maeddo - Crear o actualizar estructura
      try {
        // Intentar crear la tabla
        await db.execute(sql`
          CREATE TABLE IF NOT EXISTS ventas.stg_maeddo (
            idmaeddo NUMERIC(20,0) PRIMARY KEY,
            idmaeedo NUMERIC(20,0) NOT NULL,
            koprct TEXT,
            nokopr TEXT,
            udtrpr TEXT,
            kofulido TEXT,
            caprco1 NUMERIC(18,4),
            caprco2 NUMERIC(18,4),
            preuni NUMERIC(18,6),
            vaneli NUMERIC(18,4),
            feemli TIMESTAMP,
            feerli TIMESTAMP,
            devol1 NUMERIC(18,4),
            devol2 NUMERIC(18,4),
            stockfis NUMERIC(18,4)
          )
        `);

        // Si la tabla ya existía, asegurar que tiene las columnas correctas
        // Esto corrige tablas creadas con 'caprco' en lugar de 'caprco1' y 'caprco2'
        try {
          await db.execute(sql`ALTER TABLE ventas.stg_maeddo ADD COLUMN IF NOT EXISTS kofulido TEXT`);
          await db.execute(sql`ALTER TABLE ventas.stg_maeddo ADD COLUMN IF NOT EXISTS caprco1 NUMERIC(18,4)`);
          await db.execute(sql`ALTER TABLE ventas.stg_maeddo ADD COLUMN IF NOT EXISTS caprco2 NUMERIC(18,4)`);
          // Eliminar columna incorrecta 'caprco' si existe
          await db.execute(sql`ALTER TABLE ventas.stg_maeddo DROP COLUMN IF EXISTS caprco CASCADE`);
        } catch (alterErr: any) {
          console.warn(`   ⚠️  Error actualizando estructura de stg_maeddo:`, alterErr.message);
        }

        console.log(`   ✅ stg_maeddo verificada con caprco1 y caprco2`);
        migrationsExecuted.push('Tabla stg_maeddo verificada/actualizada con estructura correcta (caprco1, caprco2)');
      } catch (err: any) {
        errors.push(`Error creando/actualizando stg_maeddo: ${err.message}`);
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
            tipr TEXT
          )
        `);
        console.log(`   ✅ stg_maepr creada`);
      } catch (err: any) {
        errors.push(`Error creando stg_maepr: ${err.message}`);
        console.error(`   ❌ Error stg_maepr:`, err.message);
      }

      // stg_maeven
      try {
        await db.execute(sql`
          CREATE TABLE ventas.stg_maeven (
            kofu TEXT PRIMARY KEY,
            nokofu TEXT
          )
        `);
        console.log(`   ✅ stg_maeven creada`);
      } catch (err: any) {
        errors.push(`Error creando stg_maeven: ${err.message}`);
        console.error(`   ❌ Error stg_maeven:`, err.message);
      }

      // stg_tabbo (composite primary key)
      try {
        await db.execute(sql`
          CREATE TABLE ventas.stg_tabbo (
            suli TEXT NOT NULL,
            bosuli TEXT NOT NULL,
            nobosuli TEXT,
            PRIMARY KEY (suli, bosuli)
          )
        `);
        console.log(`   ✅ stg_tabbo creada`);
      } catch (err: any) {
        errors.push(`Error creando stg_tabbo: ${err.message}`);
        console.error(`   ❌ Error stg_tabbo:`, err.message);
      }

      // stg_tabru
      try {
        await db.execute(sql`
          CREATE TABLE ventas.stg_tabru (
            koru TEXT PRIMARY KEY,
            nokoru TEXT
          )
        `);
        console.log(`   ✅ stg_tabru creada`);
      } catch (err: any) {
        errors.push(`Error creando stg_tabru: ${err.message}`);
        console.error(`   ❌ Error stg_tabru:`, err.message);
      }

      // stg_tabpp
      try {
        await db.execute(sql`
          CREATE TABLE ventas.stg_tabpp (
            kopr TEXT PRIMARY KEY,
            listacost NUMERIC(18,4),
            liscosmod NUMERIC(18,4)
          )
        `);
        console.log(`   ✅ stg_tabpp creada`);
      } catch (err: any) {
        errors.push(`Error creando stg_tabpp: ${err.message}`);
        console.error(`   ❌ Error stg_tabpp:`, err.message);
      }


      migrationsExecuted.push('Tablas staging recreadas con estructura correcta');
      console.log('');

      // 6. GDV Schema and tables - Complete column definitions
      console.log('6️⃣  Verificando/creando schema y tablas GDV...');
      try {
        await db.execute(sql`CREATE SCHEMA IF NOT EXISTS gdv`);
        console.log('   ✅ Schema GDV OK');

        // stg_maeen_gdv - ALL columns
        await db.execute(sql`
          CREATE TABLE IF NOT EXISTS gdv.stg_maeen_gdv (
            koen TEXT PRIMARY KEY,
            nokoen TEXT,
            rut TEXT,
            ruen TEXT,
            zona TEXT,
            kofuen TEXT
          )
        `);
        await db.execute(sql`ALTER TABLE gdv.stg_maeen_gdv ADD COLUMN IF NOT EXISTS rut TEXT`);
        await db.execute(sql`ALTER TABLE gdv.stg_maeen_gdv ADD COLUMN IF NOT EXISTS ruen TEXT`);
        await db.execute(sql`ALTER TABLE gdv.stg_maeen_gdv ADD COLUMN IF NOT EXISTS zona TEXT`);
        await db.execute(sql`ALTER TABLE gdv.stg_maeen_gdv ADD COLUMN IF NOT EXISTS kofuen TEXT`);
        console.log('   ✅ stg_maeen_gdv OK');

        // stg_maeddo_gdv - ALL columns
        await db.execute(sql`
          CREATE TABLE IF NOT EXISTS gdv.stg_maeddo_gdv (
            idmaeddo NUMERIC(20, 0) PRIMARY KEY,
            idmaeedo NUMERIC(20, 0),
            koprct TEXT,
            sulido TEXT,
            bosulido TEXT,
            kofulido TEXT,
            eslido TEXT,
            caprco1 NUMERIC(18, 4),
            caprco2 NUMERIC(18, 4),
            caprad1 NUMERIC(18, 4),
            caprad2 NUMERIC(18, 4),
            caprnc1 NUMERIC(18, 4),
            caprnc2 NUMERIC(18, 4),
            vaneli NUMERIC(18, 4),
            feemli DATE,
            feerli TIMESTAMP,
            devol1 NUMERIC(18, 4),
            devol2 NUMERIC(18, 4),
            stockfis NUMERIC(18, 4),
            nokopr TEXT,
            udtrpr TEXT,
            nulido TEXT,
            luvtlido TEXT,
            preuni NUMERIC(18, 6)
          )
        `);
        await db.execute(sql`ALTER TABLE gdv.stg_maeddo_gdv ADD COLUMN IF NOT EXISTS nokopr TEXT`);
        await db.execute(sql`ALTER TABLE gdv.stg_maeddo_gdv ADD COLUMN IF NOT EXISTS udtrpr TEXT`);
        await db.execute(sql`ALTER TABLE gdv.stg_maeddo_gdv ADD COLUMN IF NOT EXISTS nulido TEXT`);
        await db.execute(sql`ALTER TABLE gdv.stg_maeddo_gdv ADD COLUMN IF NOT EXISTS luvtlido TEXT`);
        await db.execute(sql`ALTER TABLE gdv.stg_maeddo_gdv ADD COLUMN IF NOT EXISTS preuni NUMERIC(18, 6)`);
        await db.execute(sql`ALTER TABLE gdv.stg_maeddo_gdv ADD COLUMN IF NOT EXISTS sulido TEXT`);
        await db.execute(sql`ALTER TABLE gdv.stg_maeddo_gdv ADD COLUMN IF NOT EXISTS bosulido TEXT`);
        console.log('   ✅ stg_maeddo_gdv OK');

        // stg_maeedo_gdv
        await db.execute(sql`
          CREATE TABLE IF NOT EXISTS gdv.stg_maeedo_gdv (
            idmaeedo NUMERIC(20, 0) PRIMARY KEY,
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
            vanedo NUMERIC(18, 4),
            vaivdo NUMERIC(18, 4),
            vabrdo NUMERIC(18, 4),
            lilg TEXT,
            modo TEXT,
            timodo TEXT,
            tamodo NUMERIC(18, 4),
            ocdo TEXT,
            feulvedo DATE
          )
        `);
        console.log('   ✅ stg_maeedo_gdv OK');

        // stg_maepr_gdv
        await db.execute(sql`
          CREATE TABLE IF NOT EXISTS gdv.stg_maepr_gdv (
            kopr TEXT PRIMARY KEY,
            nomrpr TEXT,
            nokopr TEXT,
            ud01pr TEXT,
            ud02pr TEXT,
            tipr TEXT
          )
        `);
        console.log('   ✅ stg_maepr_gdv OK');

        // stg_maeven_gdv
        await db.execute(sql`
          CREATE TABLE IF NOT EXISTS gdv.stg_maeven_gdv (
            kofu TEXT PRIMARY KEY,
            nokofu TEXT
          )
        `);
        console.log('   ✅ stg_maeven_gdv OK');

        // stg_tabbo_gdv
        await db.execute(sql`
          CREATE TABLE IF NOT EXISTS gdv.stg_tabbo_gdv (
            suli TEXT NOT NULL,
            bosuli TEXT NOT NULL,
            nobosuli TEXT,
            PRIMARY KEY (suli, bosuli)
          )
        `);
        console.log('   ✅ stg_tabbo_gdv OK');

        // stg_tabru_gdv
        await db.execute(sql`
          CREATE TABLE IF NOT EXISTS gdv.stg_tabru_gdv (
            koru TEXT PRIMARY KEY,
            nokoru TEXT
          )
        `);
        console.log('   ✅ stg_tabru_gdv OK');

        // fact_gdv - ALL columns used by ETL
        await db.execute(sql`
          CREATE TABLE IF NOT EXISTS gdv.fact_gdv (
            idmaeddo NUMERIC(20, 0) PRIMARY KEY,
            idmaeedo NUMERIC(20, 0),
            tido TEXT,
            nudo NUMERIC(20, 0),
            endo TEXT,
            suendo TEXT,
            sudo NUMERIC(20, 0),
            feemdo DATE,
            feulvedo DATE,
            esdo TEXT,
            espgdo TEXT,
            kofudo TEXT,
            modo TEXT,
            timodo TEXT,
            tamodo NUMERIC(18, 6),
            vanedo NUMERIC(18, 4),
            vaivdo NUMERIC(18, 4),
            vabrdo NUMERIC(18, 4),
            lilg TEXT,
            bosulido NUMERIC(20, 0),
            kofulido TEXT,
            koprct TEXT,
            ud01pr TEXT,
            ud02pr TEXT,
            caprco1 NUMERIC(18, 4),
            caprco2 NUMERIC(18, 4),
            caprad1 NUMERIC(18, 4),
            caprad2 NUMERIC(18, 4),
            caprnc1 NUMERIC(18, 4),
            caprnc2 NUMERIC(18, 4),
            vaneli NUMERIC(18, 4),
            feemli TIMESTAMP,
            feerli TIMESTAMP,
            devol1 NUMERIC(18, 4),
            devol2 NUMERIC(18, 4),
            stockfis NUMERIC(18, 4),
            ocdo TEXT,
            nokoprct TEXT,
            nosudo TEXT,
            nokofu TEXT,
            nobosuli TEXT,
            nokoen TEXT,
            noruen TEXT,
            monto NUMERIC(18, 4),
            eslido TEXT,
            cantidad_pendiente BOOLEAN DEFAULT FALSE,
            last_etl_sync TIMESTAMP,
            data_source TEXT
          )
        `);
        // Add missing columns to existing fact_gdv table
        await db.execute(sql`ALTER TABLE gdv.fact_gdv ADD COLUMN IF NOT EXISTS suendo TEXT`);
        await db.execute(sql`ALTER TABLE gdv.fact_gdv ADD COLUMN IF NOT EXISTS feulvedo DATE`);
        await db.execute(sql`ALTER TABLE gdv.fact_gdv ADD COLUMN IF NOT EXISTS espgdo TEXT`);
        await db.execute(sql`ALTER TABLE gdv.fact_gdv ADD COLUMN IF NOT EXISTS kofudo TEXT`);
        await db.execute(sql`ALTER TABLE gdv.fact_gdv ADD COLUMN IF NOT EXISTS modo TEXT`);
        await db.execute(sql`ALTER TABLE gdv.fact_gdv ADD COLUMN IF NOT EXISTS timodo TEXT`);
        await db.execute(sql`ALTER TABLE gdv.fact_gdv ADD COLUMN IF NOT EXISTS tamodo NUMERIC(18, 6)`);
        await db.execute(sql`ALTER TABLE gdv.fact_gdv ADD COLUMN IF NOT EXISTS vanedo NUMERIC(18, 4)`);
        await db.execute(sql`ALTER TABLE gdv.fact_gdv ADD COLUMN IF NOT EXISTS vaivdo NUMERIC(18, 4)`);
        await db.execute(sql`ALTER TABLE gdv.fact_gdv ADD COLUMN IF NOT EXISTS vabrdo NUMERIC(18, 4)`);
        await db.execute(sql`ALTER TABLE gdv.fact_gdv ADD COLUMN IF NOT EXISTS ud01pr TEXT`);
        await db.execute(sql`ALTER TABLE gdv.fact_gdv ADD COLUMN IF NOT EXISTS ud02pr TEXT`);
        await db.execute(sql`ALTER TABLE gdv.fact_gdv ADD COLUMN IF NOT EXISTS caprco1 NUMERIC(18, 4)`);
        await db.execute(sql`ALTER TABLE gdv.fact_gdv ADD COLUMN IF NOT EXISTS caprco2 NUMERIC(18, 4)`);
        await db.execute(sql`ALTER TABLE gdv.fact_gdv ADD COLUMN IF NOT EXISTS caprad1 NUMERIC(18, 4)`);
        await db.execute(sql`ALTER TABLE gdv.fact_gdv ADD COLUMN IF NOT EXISTS caprad2 NUMERIC(18, 4)`);
        await db.execute(sql`ALTER TABLE gdv.fact_gdv ADD COLUMN IF NOT EXISTS caprnc1 NUMERIC(18, 4)`);
        await db.execute(sql`ALTER TABLE gdv.fact_gdv ADD COLUMN IF NOT EXISTS caprnc2 NUMERIC(18, 4)`);
        await db.execute(sql`ALTER TABLE gdv.fact_gdv ADD COLUMN IF NOT EXISTS feemli TIMESTAMP`);
        await db.execute(sql`ALTER TABLE gdv.fact_gdv ADD COLUMN IF NOT EXISTS feerli TIMESTAMP`);
        await db.execute(sql`ALTER TABLE gdv.fact_gdv ADD COLUMN IF NOT EXISTS devol1 NUMERIC(18, 4)`);
        await db.execute(sql`ALTER TABLE gdv.fact_gdv ADD COLUMN IF NOT EXISTS devol2 NUMERIC(18, 4)`);
        await db.execute(sql`ALTER TABLE gdv.fact_gdv ADD COLUMN IF NOT EXISTS stockfis NUMERIC(18, 4)`);
        await db.execute(sql`ALTER TABLE gdv.fact_gdv ADD COLUMN IF NOT EXISTS ocdo TEXT`);
        await db.execute(sql`ALTER TABLE gdv.fact_gdv ADD COLUMN IF NOT EXISTS nokoprct TEXT`);
        await db.execute(sql`ALTER TABLE gdv.fact_gdv ADD COLUMN IF NOT EXISTS nosudo TEXT`);
        await db.execute(sql`ALTER TABLE gdv.fact_gdv ADD COLUMN IF NOT EXISTS nokofu TEXT`);
        await db.execute(sql`ALTER TABLE gdv.fact_gdv ADD COLUMN IF NOT EXISTS nobosuli TEXT`);
        await db.execute(sql`ALTER TABLE gdv.fact_gdv ADD COLUMN IF NOT EXISTS nokoen TEXT`);
        await db.execute(sql`ALTER TABLE gdv.fact_gdv ADD COLUMN IF NOT EXISTS noruen TEXT`);
        await db.execute(sql`ALTER TABLE gdv.fact_gdv ADD COLUMN IF NOT EXISTS cantidad_pendiente BOOLEAN DEFAULT FALSE`);
        await db.execute(sql`ALTER TABLE gdv.fact_gdv ADD COLUMN IF NOT EXISTS last_etl_sync TIMESTAMP`);
        await db.execute(sql`ALTER TABLE gdv.fact_gdv ADD COLUMN IF NOT EXISTS data_source TEXT`);
        console.log('   ✅ fact_gdv OK');

        // gdv_sync_log
        await db.execute(sql`
          CREATE TABLE IF NOT EXISTS gdv.gdv_sync_log (
            id SERIAL PRIMARY KEY,
            started_at TIMESTAMP NOT NULL DEFAULT NOW(),
            completed_at TIMESTAMP,
            status TEXT DEFAULT 'running',
            records_processed INTEGER DEFAULT 0,
            error_message TEXT
          )
        `);
        console.log('   ✅ gdv_sync_log OK');

        migrationsExecuted.push('Schema GDV y todas sus tablas creadas/actualizadas');
        console.log('   ✅ Todas las tablas GDV verificadas\n');
      } catch (err: any) {
        errors.push(`Error en migraciones GDV: ${err.message}`);
        console.error('   ❌ Error GDV:', err.message, '\n');
      }

      // 7. Insert default ETL config if not exists
      console.log('7️⃣  Insertando configuración ETL por defecto...');
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

  // Run NVV ETL migrations - Admin only, creates missing tables in nvv schema
  app.post('/api/etl/run-nvv-migrations', requireRoles(['admin']), asyncHandler(async (req: any, res: any) => {
    try {
      console.log('\n╔═══════════════════════════════════════════════════════════════╗');
      console.log('║  🔧 EJECUTANDO MIGRACIONES ETL - SCHEMA NVV                  ║');
      console.log('╚═══════════════════════════════════════════════════════════════╝\n');

      const migrationsExecuted: string[] = [];
      const errors: string[] = [];

      // 1. Ensure nvv schema exists
      console.log('1️⃣  Verificando/creando schema "nvv"...');
      try {
        await db.execute(sql`CREATE SCHEMA IF NOT EXISTS nvv`);
        migrationsExecuted.push('Schema "nvv" verificado/creado');
        console.log('   ✅ Schema "nvv" OK\n');
      } catch (err: any) {
        errors.push(`Error creando schema nvv: ${err.message}`);
        console.error('   ❌ Error:', err.message, '\n');
      }

      // 2. Create NVV configuration in etl_config (generic table)
      console.log('2️⃣  Creando configuración de NVV en etl_config...');
      try {
        await db.execute(sql`
          INSERT INTO ventas.etl_config (etl_name, custom_watermark, use_custom_watermark, timeout_minutes, interval_minutes)
          VALUES ('nvv', '2025-01-01 00:00:00', true, 5, 30)
          ON CONFLICT (etl_name) DO UPDATE SET
            custom_watermark = EXCLUDED.custom_watermark,
            use_custom_watermark = EXCLUDED.use_custom_watermark,
            timeout_minutes = EXCLUDED.timeout_minutes,
            interval_minutes = EXCLUDED.interval_minutes
        `);
        migrationsExecuted.push('Configuración de NVV creada en etl_config');
        console.log('   ✅ Configuración de NVV en etl_config creada\n');
      } catch (err: any) {
        errors.push(`Error creando configuración de NVV: ${err.message}`);
        console.error('   ❌ Error:', err.message, '\n');
      }

      // Note: NVV now uses the generic etl_execution_log table in ventas schema
      // Legacy nvv_sync_log table is no longer needed

      // 3. Create fact_nvv table
      console.log('3️⃣  Verificando/creando tabla nvv.fact_nvv...');
      try {
        await db.execute(sql`
          CREATE TABLE IF NOT EXISTS nvv.fact_nvv (
            idmaeddo BIGINT PRIMARY KEY,
            idmaeedo BIGINT,
            nudo VARCHAR,
            tido VARCHAR,
            endo VARCHAR,
            sudo VARCHAR,
            nosudo VARCHAR,
            feemdo DATE,
            feer DATE,
            koprct VARCHAR,
            nokopr TEXT,
            tipr VARCHAR,
            pfpr VARCHAR,
            fmpr VARCHAR,
            mrpr VARCHAR,
            caprco1 NUMERIC(18,5),
            caprad1 NUMERIC(18,5),
            caprex1 NUMERIC(18,5),
            ud01pr VARCHAR,
            caprco2 NUMERIC(18,5),
            caprad2 NUMERIC(18,5),
            caprex2 NUMERIC(18,5),
            ud02pr VARCHAR,
            ppprne NUMERIC(18,5),
            vaneli NUMERIC(18,5),
            feemli DATE,
            feerli DATE,
            eslido VARCHAR,
            nulido VARCHAR,
            kofulido VARCHAR,
            nombre_vendedor VARCHAR,
            bosulido VARCHAR,
            nombre_bodega VARCHAR,
            koen VARCHAR,
            nokoen TEXT,
            ruen VARCHAR,
            nombre_segmento_cliente TEXT,
            rupr VARCHAR,
            nombre_segmento TEXT,
            cantidad_pendiente BOOLEAN,
            last_etl_sync TIMESTAMP
          )
        `);
        migrationsExecuted.push('Tabla nvv.fact_nvv verificada/creada');
        console.log('   ✅ Tabla fact_nvv verificada\n');
      } catch (err: any) {
        errors.push(`Error creando fact_nvv: ${err.message}`);
        console.error('   ❌ Error:', err.message, '\n');
      }

      // 4. Create staging tables
      console.log('4️⃣  Creando tablas staging...');

      // stg_maeedo_nvv
      try {
        await db.execute(sql`
          CREATE TABLE IF NOT EXISTS nvv.stg_maeedo_nvv (
            idmaeedo BIGINT PRIMARY KEY,
            empresa VARCHAR,
            tido VARCHAR,
            nudo VARCHAR,
            endo VARCHAR,
            sudo VARCHAR,
            kofudo VARCHAR,
            suli VARCHAR,
            bosulido VARCHAR,
            feemdo DATE,
            feer DATE,
            modo VARCHAR,
            timodo VARCHAR
          )
        `);
        console.log('   ✅ stg_maeedo_nvv creada');
      } catch (err: any) {
        errors.push(`Error creando stg_maeedo_nvv: ${err.message}`);
        console.error('   ❌ Error stg_maeedo_nvv:', err.message);
      }

      // stg_maeddo_nvv
      try {
        await db.execute(sql`
          CREATE TABLE IF NOT EXISTS nvv.stg_maeddo_nvv (
            idmaeddo BIGINT PRIMARY KEY,
            idmaeedo BIGINT NOT NULL,
            koprct VARCHAR,
            nokopr TEXT,
            tipr VARCHAR,
            pfpr VARCHAR,
            fmpr VARCHAR,
            mrpr VARCHAR,
            caprco1 NUMERIC(18,5),
            caprad1 NUMERIC(18,5),
            caprex1 NUMERIC(18,5),
            ud01pr VARCHAR,
            caprco2 NUMERIC(18,5),
            caprad2 NUMERIC(18,5),
            caprex2 NUMERIC(18,5),
            ud02pr VARCHAR,
            ppprne NUMERIC(18,5),
            vaneli NUMERIC(18,5),
            feemli DATE,
            feerli DATE,
            eslido VARCHAR,
            nulido VARCHAR,
            kofulido VARCHAR,
            bosulido VARCHAR,
            rupr VARCHAR
          )
        `);
        console.log('   ✅ stg_maeddo_nvv creada');
      } catch (err: any) {
        errors.push(`Error creando stg_maeddo_nvv: ${err.message}`);
        console.error('   ❌ Error stg_maeddo_nvv:', err.message);
      }

      // stg_maeen_nvv
      try {
        await db.execute(sql`
          CREATE TABLE IF NOT EXISTS nvv.stg_maeen_nvv (
            koen VARCHAR PRIMARY KEY,
            nokoen TEXT,
            ruen VARCHAR
          )
        `);
        console.log('   ✅ stg_maeen_nvv creada');
      } catch (err: any) {
        errors.push(`Error creando stg_maeen_nvv: ${err.message}`);
        console.error('   ❌ Error stg_maeen_nvv:', err.message);
      }

      // stg_maepr_nvv
      try {
        await db.execute(sql`
          CREATE TABLE IF NOT EXISTS nvv.stg_maepr_nvv (
            kopr VARCHAR PRIMARY KEY,
            nokopr TEXT,
            rupr VARCHAR
          )
        `);
        console.log('   ✅ stg_maepr_nvv creada');
      } catch (err: any) {
        errors.push(`Error creando stg_maepr_nvv: ${err.message}`);
        console.error('   ❌ Error stg_maepr_nvv:', err.message);
      }

      // stg_maeven_nvv
      try {
        await db.execute(sql`
          CREATE TABLE IF NOT EXISTS nvv.stg_maeven_nvv (
            kofu VARCHAR PRIMARY KEY,
            nokofu VARCHAR
          )
        `);
        console.log('   ✅ stg_maeven_nvv creada');
      } catch (err: any) {
        errors.push(`Error creando stg_maeven_nvv: ${err.message}`);
        console.error('   ❌ Error stg_maeven_nvv:', err.message);
      }

      // stg_tabbo_nvv
      try {
        await db.execute(sql`
          CREATE TABLE IF NOT EXISTS nvv.stg_tabbo_nvv (
            kobo VARCHAR,
            kosu VARCHAR,
            nokobo VARCHAR,
            PRIMARY KEY (kobo, kosu)
          )
        `);
        console.log('   ✅ stg_tabbo_nvv creada');
      } catch (err: any) {
        errors.push(`Error creando stg_tabbo_nvv: ${err.message}`);
        console.error('   ❌ Error stg_tabbo_nvv:', err.message);
      }

      migrationsExecuted.push('Tablas staging de NVV creadas');
      console.log('');

      console.log('╔═══════════════════════════════════════════════════════════════╗');
      console.log('║  📊 RESUMEN DE MIGRACIONES NVV                               ║');
      console.log('╚═══════════════════════════════════════════════════════════════╝');
      console.log(`Total migraciones ejecutadas: ${migrationsExecuted.length}`);
      console.log(`Total errores: ${errors.length}`);
      console.log('═══════════════════════════════════════════════════════════════\n');

      res.json({
        success: errors.length === 0,
        message: errors.length === 0
          ? 'Migraciones NVV ejecutadas exitosamente'
          : 'Migraciones NVV completadas con algunos errores',
        migrations: migrationsExecuted,
        errors: errors.length > 0 ? errors : undefined
      });

    } catch (error: any) {
      console.error('❌ Error fatal en migraciones NVV:', error);
      res.status(500).json({
        success: false,
        error: 'Error ejecutando migraciones NVV. Ver logs del servidor.'
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

  // ==================== SEO TRACKING API ====================

  // Get all SEO campaigns
  app.get('/api/seo/campaigns', requireAdminOrSupervisor, asyncHandler(async (req: any, res: any) => {
    const campaigns = await storage.getSeoCampaigns();
    res.json(campaigns);
  }));

  // Get single SEO campaign
  app.get('/api/seo/campaigns/:id', requireAdminOrSupervisor, asyncHandler(async (req: any, res: any) => {
    const campaign = await storage.getSeoCampaign(req.params.id);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaña no encontrada' });
    }
    res.json(campaign);
  }));

  // Create SEO campaign
  app.post('/api/seo/campaigns', requireAdminOrSupervisor, asyncHandler(async (req: any, res: any) => {
    const { nombre, dominio, descripcion } = req.body;
    const campaign = await storage.createSeoCampaign({
      nombre,
      dominio,
      descripcion,
      createdBy: req.user.id,
      activo: true,
    });
    res.status(201).json(campaign);
  }));

  // Update SEO campaign
  app.patch('/api/seo/campaigns/:id', requireAdminOrSupervisor, asyncHandler(async (req: any, res: any) => {
    const campaign = await storage.updateSeoCampaign(req.params.id, req.body);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaña no encontrada' });
    }
    res.json(campaign);
  }));

  // Delete SEO campaign
  app.delete('/api/seo/campaigns/:id', requireAdminOrSupervisor, asyncHandler(async (req: any, res: any) => {
    await storage.deleteSeoCampaign(req.params.id);
    res.json({ success: true });
  }));

  // Get keywords for a campaign (with history)
  app.get('/api/seo/campaigns/:id/keywords', requireAdminOrSupervisor, asyncHandler(async (req: any, res: any) => {
    const keywords = await storage.getSeoKeywordsWithHistory(req.params.id);
    res.json(keywords);
  }));

  // Create keyword (only desktop version to save API credits)
  app.post('/api/seo/keywords', requireAdminOrSupervisor, asyncHandler(async (req: any, res: any) => {
    const { campaignId, keyword, urlObjetivo, ubicacion, idioma, activo } = req.body;

    // Create desktop version only (to save SerpAPI credits)
    const desktopKeyword = await storage.createSeoKeyword({
      campaignId,
      keyword,
      urlObjetivo,
      ubicacion: ubicacion || 'Chile',
      idioma: idioma || 'es',
      dispositivo: 'desktop',
      activo: activo !== false,
    });

    res.status(201).json({ desktop: desktopKeyword });
  }));

  // Update keyword
  app.patch('/api/seo/keywords/:id', requireAdminOrSupervisor, asyncHandler(async (req: any, res: any) => {
    const keyword = await storage.updateSeoKeyword(req.params.id, req.body);
    if (!keyword) {
      return res.status(404).json({ error: 'Keyword no encontrada' });
    }
    res.json(keyword);
  }));

  // Delete keyword
  app.delete('/api/seo/keywords/:id', requireAdminOrSupervisor, asyncHandler(async (req: any, res: any) => {
    await storage.deleteSeoKeyword(req.params.id);
    res.json({ success: true });
  }));

  // Check position using SerpAPI
  app.post('/api/seo/check-position', requireAdminOrSupervisor, asyncHandler(async (req: any, res: any) => {
    const { keywordId } = req.body;

    const keyword = await storage.getSeoKeyword(keywordId);
    if (!keyword) {
      return res.status(404).json({ error: 'Keyword no encontrada' });
    }

    const campaign = await storage.getSeoCampaign(keyword.campaignId);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaña no encontrada' });
    }

    // Get SerpAPI key from environment
    const serpApiKey = process.env.SERPAPI_API_KEY;
    if (!serpApiKey) {
      return res.status(400).json({ error: 'API key de SerpAPI no configurada. Por favor configure SERPAPI_API_KEY en las variables de entorno.' });
    }

    try {
      // Build SerpAPI URL with correct parameters for Chile
      const locationMap: { [key: string]: string } = {
        'Chile': 'Chile',
        'Santiago, Chile': 'Santiago, Santiago Metropolitan Region, Chile',
        'Valparaiso, Chile': 'Valparaiso, Valparaiso Region, Chile',
        'Concepcion, Chile': 'Concepcion, Biobio Region, Chile',
      };

      const serpLocation = locationMap[keyword.ubicacion] || 'Chile';

      const params = new URLSearchParams({
        api_key: serpApiKey,
        engine: 'google',
        q: keyword.keyword,
        location: serpLocation,
        google_domain: 'google.cl',
        hl: keyword.idioma || 'es',
        gl: 'cl',
        device: keyword.dispositivo || 'desktop',
        num: '100',
      });

      console.log(`[SEO] Checking position for: "${keyword.keyword}" in ${serpLocation} (${keyword.dispositivo})`);
      console.log(`[SEO] Domain to find: ${campaign.dominio}`);

      const serpResponse = await fetch(`https://serpapi.com/search.json?${params}`);
      const serpData = await serpResponse.json();

      if (serpData.error) {
        console.error('[SEO] SerpAPI error:', serpData.error);
        return res.status(400).json({ error: serpData.error });
      }

      // Find domain position in results
      const organicResults = serpData.organic_results || [];
      console.log(`[SEO] Found ${organicResults.length} organic results`);

      let posicion: number | null = null;
      let urlEncontrada: string | null = null;
      let titulo: string | null = null;
      let snippet: string | null = null;

      // Clean domain for comparison - remove protocol and www
      const domainToFind = campaign.dominio.toLowerCase()
        .replace(/^(https?:\/\/)/, '')
        .replace(/^www\./, '')
        .split('/')[0]; // Get just the domain part

      console.log(`[SEO] Looking for domain: ${domainToFind}`);

      for (let i = 0; i < organicResults.length; i++) {
        const result = organicResults[i];
        const resultUrl = (result.link || '').toLowerCase();
        const resultDomain = resultUrl
          .replace(/^(https?:\/\/)/, '')
          .replace(/^www\./, '')
          .split('/')[0];

        // Check if domains match
        if (resultDomain === domainToFind || resultDomain.endsWith('.' + domainToFind)) {
          posicion = result.position || (i + 1);
          urlEncontrada = result.link;
          titulo = result.title;
          snippet = result.snippet;
          console.log(`[SEO] Found at position ${posicion}: ${result.link}`);
          break;
        }
      }

      if (!posicion) {
        console.log(`[SEO] Domain not found in top ${organicResults.length} results`);
        // Log first 5 results for debugging
        organicResults.slice(0, 5).forEach((r: any, i: number) => {
          console.log(`[SEO] Result ${i + 1}: ${r.link}`);
        });
      }

      // Save to history
      const historyEntry = await storage.createSeoPositionHistory({
        keywordId,
        posicion,
        urlEncontrada,
        titulo,
        snippet,
        pagina: posicion ? Math.ceil(posicion / 10) : null,
        totalResultados: serpData.search_information?.total_results || null,
        busquedasRestantes: serpData.search_metadata?.credits_left || null,
      });

      res.json({
        posicion,
        urlEncontrada,
        titulo,
        snippet,
        totalResultados: serpData.search_information?.total_results,
        busquedasRestantes: serpData.search_metadata?.credits_left,
        historyEntry,
      });
    } catch (error: any) {
      console.error('Error calling SerpAPI:', error);
      res.status(500).json({ error: 'Error al consultar SerpAPI: ' + error.message });
    }
  }));

  // Check all keywords in a campaign
  app.post('/api/seo/campaigns/:id/check-all', requireAdminOrSupervisor, asyncHandler(async (req: any, res: any) => {
    const keywords = await storage.getSeoKeywords(req.params.id);
    const activeKeywords = keywords.filter(k => k.activo);

    if (activeKeywords.length === 0) {
      return res.json({ message: 'No hay keywords activas para verificar', results: [] });
    }

    const serpApiKey = process.env.SERPAPI_API_KEY;
    if (!serpApiKey) {
      return res.status(400).json({ error: 'API key de SerpAPI no configurada' });
    }

    const campaign = await storage.getSeoCampaign(req.params.id);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaña no encontrada' });
    }

    const results: any[] = [];
    const domainToFind = campaign.dominio.toLowerCase()
      .replace(/^(https?:\/\/)/, '')
      .replace(/^www\./, '')
      .split('/')[0];

    const locationMap: { [key: string]: string } = {
      'Chile': 'Chile',
      'Santiago, Chile': 'Santiago, Santiago Metropolitan Region, Chile',
      'Valparaiso, Chile': 'Valparaiso, Valparaiso Region, Chile',
      'Concepcion, Chile': 'Concepcion, Biobio Region, Chile',
    };

    for (const keyword of activeKeywords) {
      try {
        const serpLocation = locationMap[keyword.ubicacion] || 'Chile';

        const params = new URLSearchParams({
          api_key: serpApiKey,
          engine: 'google',
          q: keyword.keyword,
          location: serpLocation,
          google_domain: 'google.cl',
          hl: keyword.idioma || 'es',
          gl: 'cl',
          device: keyword.dispositivo || 'desktop',
          num: '100',
        });

        console.log(`[SEO] Checking: "${keyword.keyword}" (${keyword.dispositivo})`);
        console.log(`[SEO] Domain to find: "${domainToFind}"`);
        console.log(`[SEO] Request params: num=100, location=${serpLocation}`);

        const serpResponse = await fetch(`https://serpapi.com/search.json?${params}`);
        const serpData = await serpResponse.json();

        // Log search metadata for debugging
        if (serpData.search_metadata) {
          console.log(`[SEO] Search metadata:`, JSON.stringify({
            total_results: serpData.search_information?.total_results,
            time_taken: serpData.search_metadata?.total_time_taken,
            google_url: serpData.search_metadata?.google_url?.substring(0, 100)
          }));
        }

        if (!serpData.error) {
          let allOrganicResults = serpData.organic_results || [];
          console.log(`[SEO] Received ${allOrganicResults.length} organic results (requested 100)`);

          let posicion: number | null = null;
          let urlEncontrada: string | null = null;
          let titulo: string | null = null;
          let snippet: string | null = null;

          // Search in first batch of results
          for (let i = 0; i < allOrganicResults.length; i++) {
            const result = allOrganicResults[i];
            const resultDomain = (result.link || '').toLowerCase()
              .replace(/^(https?:\/\/)/, '')
              .replace(/^www\./, '')
              .split('/')[0];

            if (resultDomain === domainToFind || resultDomain.endsWith('.' + domainToFind)) {
              posicion = result.position || (i + 1);
              urlEncontrada = result.link;
              titulo = result.title;
              snippet = result.snippet;
              console.log(`[SEO] Found "${keyword.keyword}" at position ${posicion}: ${result.link}`);
              break;
            }
          }

          // If not found and we got less than 100 results, try pagination (up to page 5 = position 50)
          if (!posicion && allOrganicResults.length < 50) {
            const maxPages = 5;
            for (let page = 2; page <= maxPages && !posicion; page++) {
              const startPos = (page - 1) * 10;
              console.log(`[SEO] Searching page ${page} (start=${startPos})...`);

              const pageParams = new URLSearchParams({
                api_key: serpApiKey,
                engine: 'google',
                q: keyword.keyword,
                location: serpLocation,
                google_domain: 'google.cl',
                hl: keyword.idioma || 'es',
                gl: 'cl',
                device: keyword.dispositivo || 'desktop',
                start: String(startPos),
                num: '10',
              });

              try {
                const pageResponse = await fetch(`https://serpapi.com/search.json?${pageParams}`);
                const pageData = await pageResponse.json();

                if (!pageData.error && pageData.organic_results) {
                  const pageResults = pageData.organic_results;
                  console.log(`[SEO] Page ${page}: received ${pageResults.length} results`);

                  for (let i = 0; i < pageResults.length; i++) {
                    const result = pageResults[i];
                    const resultDomain = (result.link || '').toLowerCase()
                      .replace(/^(https?:\/\/)/, '')
                      .replace(/^www\./, '')
                      .split('/')[0];

                    if (resultDomain === domainToFind || resultDomain.endsWith('.' + domainToFind)) {
                      // Calculate absolute position: use result.position if available, otherwise calculate from page offset
                      posicion = result.position || (startPos + i + 1);
                      // If result.position seems to be relative to the page (1-10), add offset
                      if (result.position && result.position <= 10 && startPos > 0) {
                        posicion = startPos + result.position;
                      }
                      urlEncontrada = result.link;
                      titulo = result.title;
                      snippet = result.snippet;
                      console.log(`[SEO] Found "${keyword.keyword}" at absolute position ${posicion} (page ${page}, offset ${startPos}): ${result.link}`);
                      break;
                    }
                  }
                }

                // Small delay between page requests
                await new Promise(resolve => setTimeout(resolve, 300));
              } catch (pageError) {
                console.error(`[SEO] Error fetching page ${page}:`, pageError);
              }
            }
          }

          if (!posicion) {
            console.log(`[SEO] Not found in top 50 results. First 5 results for debugging:`);
            allOrganicResults.slice(0, 5).forEach((r: any, idx: number) => {
              const d = (r.link || '').replace(/^(https?:\/\/)/, '').replace(/^www\./, '').split('/')[0];
              console.log(`[SEO]   ${idx + 1}. ${d} - ${r.link}`);
            });
          }

          await storage.createSeoPositionHistory({
            keywordId: keyword.id,
            posicion,
            urlEncontrada,
            titulo,
            snippet,
            pagina: posicion ? Math.ceil(posicion / 10) : null,
            totalResultados: serpData.search_information?.total_results || null,
            busquedasRestantes: serpData.search_metadata?.credits_left || null,
          });

          results.push({
            keyword: keyword.keyword,
            posicion,
            urlEncontrada,
            busquedasRestantes: serpData.search_metadata?.credits_left,
          });
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error: any) {
        results.push({
          keyword: keyword.keyword,
          error: error.message,
        });
      }
    }

    res.json({ results, total: results.length });
  }));

  // Get position history for a keyword
  app.get('/api/seo/keywords/:id/history', requireAdminOrSupervisor, asyncHandler(async (req: any, res: any) => {
    const limit = parseInt(req.query.limit as string) || 30;
    const history = await storage.getSeoPositionHistory(req.params.id, limit);
    res.json(history);
  }));

  // ==================================================================================
  // PANORAMICA MARKET - Programa de Lealtad de Clientes
  // ==================================================================================

  // Get all loyalty tiers
  app.get('/api/loyalty/tiers', requireAuth, asyncHandler(async (req: any, res: any) => {
    const tiers = await storage.getLoyaltyTiers();
    res.json(tiers);
  }));

  // Get tier by code
  app.get('/api/loyalty/tiers/code/:code', requireAuth, asyncHandler(async (req: any, res: any) => {
    const tier = await storage.getLoyaltyTierByCode(req.params.code);
    if (!tier) {
      return res.status(404).json({ error: 'Tier no encontrado' });
    }
    res.json(tier);
  }));

  // Create loyalty tier (admin only)
  app.post('/api/loyalty/tiers', requireAdminOrSupervisor, asyncHandler(async (req: any, res: any) => {
    const tier = await storage.createLoyaltyTier(req.body);
    res.status(201).json(tier);
  }));

  // Update loyalty tier (admin only)
  app.patch('/api/loyalty/tiers/:id', requireAdminOrSupervisor, asyncHandler(async (req: any, res: any) => {
    const tier = await storage.updateLoyaltyTier(req.params.id, req.body);
    if (!tier) {
      return res.status(404).json({ error: 'Tier no encontrado' });
    }
    res.json(tier);
  }));

  // Delete loyalty tier (admin only)
  app.delete('/api/loyalty/tiers/:id', requireAdminOrSupervisor, asyncHandler(async (req: any, res: any) => {
    const deleted = await storage.deleteLoyaltyTier(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Tier no encontrado' });
    }
    res.json({ success: true });
  }));

  // Get benefits for a tier
  app.get('/api/loyalty/tiers/:id/benefits', requireAuth, asyncHandler(async (req: any, res: any) => {
    const benefits = await storage.getLoyaltyTierBenefits(req.params.id);
    res.json(benefits);
  }));

  // Create benefit for a tier
  app.post('/api/loyalty/benefits', requireAdminOrSupervisor, asyncHandler(async (req: any, res: any) => {
    const benefit = await storage.createLoyaltyTierBenefit(req.body);
    res.status(201).json(benefit);
  }));

  // Update benefit
  app.patch('/api/loyalty/benefits/:id', requireAdminOrSupervisor, asyncHandler(async (req: any, res: any) => {
    const benefit = await storage.updateLoyaltyTierBenefit(req.params.id, req.body);
    if (!benefit) {
      return res.status(404).json({ error: 'Beneficio no encontrado' });
    }
    res.json(benefit);
  }));

  // Delete benefit
  app.delete('/api/loyalty/benefits/:id', requireAdminOrSupervisor, asyncHandler(async (req: any, res: any) => {
    const deleted = await storage.deleteLoyaltyTierBenefit(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Beneficio no encontrado' });
    }
    res.json({ success: true });
  }));

  // Get clients by tier
  app.get('/api/loyalty/tiers/:id/clients', requireAuth, asyncHandler(async (req: any, res: any) => {
    const clients = await storage.getClientsByLoyaltyTier(req.params.id);
    res.json(clients);
  }));

  // Get client loyalty status
  app.get('/api/loyalty/client-status', requireAuth, asyncHandler(async (req: any, res: any) => {
    const clientName = req.query.clientName as string;
    if (!clientName) {
      return res.status(400).json({ error: 'clientName es requerido' });
    }
    const status = await storage.getClientLoyaltyStatus(clientName);
    res.json(status);
  }));

  // Get all tiers with their client counts (summary for dashboard)
  app.get('/api/loyalty/summary', requireAuth, asyncHandler(async (req: any, res: any) => {
    const tiers = await storage.getLoyaltyTiers();
    const summary = await Promise.all(
      tiers.map(async (tier) => {
        const clients = await storage.getClientsByLoyaltyTier(tier.id);
        const benefits = await storage.getLoyaltyTierBenefits(tier.id);
        return {
          ...tier,
          clientCount: clients.length,
          totalSales: clients.reduce((sum, c) => sum + c.totalSales, 0),
          benefitCount: benefits.length,
        };
      })
    );
    res.json(summary);
  }));

  // ==================================================================================
  // WHATSAPP CONFIGURATION ENDPOINTS
  // ==================================================================================

  // WhatsApp Webhook Verification (required by Meta)
  app.get('/api/whatsapp/webhook', asyncHandler(async (req: any, res: any) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token) {
      const config = await storage.getWhatsAppConfig();

      if (mode === 'subscribe' && token === config?.webhookVerifyToken) {
        console.log('✅ WhatsApp webhook verified');
        return res.status(200).send(challenge);
      } else {
        console.log('❌ WhatsApp webhook verification failed');
        return res.sendStatus(403);
      }
    }
    res.sendStatus(400);
  }));

  // WhatsApp Webhook for incoming messages
  app.post('/api/whatsapp/webhook', asyncHandler(async (req: any, res: any) => {
    const body = req.body;

    if (body.object === 'whatsapp_business_account') {
      // Process incoming messages or status updates
      body.entry?.forEach((entry: any) => {
        entry.changes?.forEach((change: any) => {
          if (change.field === 'messages') {
            const messages = change.value?.messages;
            if (messages) {
              messages.forEach((message: any) => {
                console.log('📱 WhatsApp message received:', {
                  from: message.from,
                  type: message.type,
                  timestamp: message.timestamp
                });
              });
            }
          }
        });
      });

      return res.sendStatus(200);
    }
    res.sendStatus(404);
  }));

  // Get WhatsApp configuration
  app.get('/api/whatsapp/config', requireAdminOrSupervisor, asyncHandler(async (req: any, res: any) => {
    try {
      const config = await storage.getWhatsAppConfig();
      if (!config) {
        return res.json({
          phoneNumberId: '',
          businessAccountId: '',
          accessToken: '',
          webhookVerifyToken: '',
          isConfigured: false,
          lastConnectionTest: null,
          connectionStatus: 'unknown'
        });
      }
      res.json({
        phoneNumberId: config.phoneNumberId || '',
        businessAccountId: config.businessAccountId || '',
        accessToken: '••••••••', // Never send the actual token
        webhookVerifyToken: config.webhookVerifyToken || '',
        isConfigured: !!(config.phoneNumberId && config.accessToken),
        lastConnectionTest: config.lastConnectionTest,
        connectionStatus: config.connectionStatus || 'unknown'
      });
    } catch (error: any) {
      res.status(500).json({ message: 'Error al obtener configuración de WhatsApp', error: error.message });
    }
  }));

  // Save WhatsApp configuration
  app.post('/api/whatsapp/config', requireAdminOrSupervisor, asyncHandler(async (req: any, res: any) => {
    try {
      const { phoneNumberId, businessAccountId, accessToken, webhookVerifyToken } = req.body;

      await storage.saveWhatsAppConfig({
        phoneNumberId,
        businessAccountId,
        accessToken,
        webhookVerifyToken
      });

      res.json({ success: true, message: 'Configuración guardada correctamente' });
    } catch (error: any) {
      res.status(500).json({ message: 'Error al guardar configuración de WhatsApp', error: error.message });
    }
  }));

  // Test WhatsApp connection
  app.post('/api/whatsapp/test-connection', requireAdminOrSupervisor, asyncHandler(async (req: any, res: any) => {
    try {
      const config = await storage.getWhatsAppConfig();

      if (!config || !config.phoneNumberId || !config.accessToken) {
        return res.json({
          success: false,
          message: 'Configuración de WhatsApp no encontrada o incompleta'
        });
      }

      // Test connection to WhatsApp Business API
      const response = await fetch(
        `https://graph.facebook.com/v18.0/${config.phoneNumberId}`,
        {
          headers: {
            'Authorization': `Bearer ${config.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const data = await response.json();

      if (response.ok && data.id) {
        // Update connection status
        await storage.updateWhatsAppConnectionStatus('connected');
        res.json({
          success: true,
          message: `Conexión exitosa. Número verificado: ${data.display_phone_number || data.id}`
        });
      } else {
        await storage.updateWhatsAppConnectionStatus('error');
        res.json({
          success: false,
          message: data.error?.message || 'Error al conectar con la API de WhatsApp'
        });
      }
    } catch (error: any) {
      await storage.updateWhatsAppConnectionStatus('error');
      res.json({
        success: false,
        message: error.message || 'Error de conexión con WhatsApp'
      });
    }
  }));

  // Send test WhatsApp message
  app.post('/api/whatsapp/send-test', requireAdminOrSupervisor, asyncHandler(async (req: any, res: any) => {
    try {
      const { phoneNumber } = req.body;

      if (!phoneNumber) {
        return res.json({
          success: false,
          message: 'Número de teléfono requerido'
        });
      }

      const config = await storage.getWhatsAppConfig();

      if (!config || !config.phoneNumberId || !config.accessToken) {
        return res.json({
          success: false,
          message: 'Configuración de WhatsApp no encontrada o incompleta'
        });
      }

      // Format phone number (remove spaces, dashes, and leading +)
      const formattedPhone = phoneNumber.replace(/[\s\-\+]/g, '');

      // Send test message via WhatsApp Business API
      const response = await fetch(
        `https://graph.facebook.com/v18.0/${config.phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${config.accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: formattedPhone,
            type: 'text',
            text: {
              body: '¡Hola! Este es un mensaje de prueba desde Panoramica. Si recibiste este mensaje, la integración de WhatsApp está funcionando correctamente.'
            }
          })
        }
      );

      const data = await response.json();

      if (response.ok && data.messages?.[0]?.id) {
        res.json({
          success: true,
          message: `Mensaje enviado exitosamente a ${formattedPhone}`
        });
      } else {
        res.json({
          success: false,
          message: data.error?.message || 'Error al enviar el mensaje'
        });
      }
    } catch (error: any) {
      res.json({
        success: false,
        message: error.message || 'Error al enviar mensaje de prueba'
      });
    }
  }));

  // Admin endpoint: Migrate existing PDFs to generate preview images
  app.post('/api/admin/migrate-pdf-previews', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;

      if (user.role !== 'admin') {
        return res.status(403).json({ message: 'Solo administradores pueden ejecutar migraciones' });
      }

      const results: any[] = [];
      const objectStorageService = new ObjectStorageService();

      // 1. Get PDFs from gastos_empresariales without preview
      const gastosConPdf = await db
        .select({
          id: gastosEmpresariales.id,
          archivoUrl: gastosEmpresariales.archivoUrl,
          comprobantePreviewUrl: gastosEmpresariales.comprobantePreviewUrl,
        })
        .from(gastosEmpresariales)
        .where(
          and(
            sql`${gastosEmpresariales.archivoUrl} ILIKE '%.pdf'`,
            or(
              isNull(gastosEmpresariales.comprobantePreviewUrl),
              eq(gastosEmpresariales.comprobantePreviewUrl, '')
            )
          )
        );

      console.log(`[MIGRATION] Found ${gastosConPdf.length} gastos with PDF without preview`);

      for (const gasto of gastosConPdf) {
        try {
          if (!gasto.archivoUrl) continue;

          // Download PDF from Object Storage
          const pdfResponse = await fetch(`${req.protocol}://${req.get('host')}${gasto.archivoUrl}`, {
            credentials: 'include'
          });

          if (!pdfResponse.ok) {
            results.push({ id: gasto.id, type: 'gasto', status: 'error', message: 'No se pudo descargar el PDF' });
            continue;
          }

          const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());

          // Convert to image
          const previewBuffer = await convertPdfToImage(pdfBuffer, 600);

          if (!previewBuffer) {
            results.push({ id: gasto.id, type: 'gasto', status: 'error', message: 'No se pudo convertir el PDF' });
            continue;
          }

          // Upload preview image
          const previewFileName = gasto.archivoUrl.replace(/\.pdf$/i, '_preview.png').replace(/^\/public-objects\//, '');
          const previewUrl = await objectStorageService.uploadImage(previewFileName, previewBuffer, 'image/png');

          // Update database
          await db
            .update(gastosEmpresariales)
            .set({ comprobantePreviewUrl: previewUrl })
            .where(eq(gastosEmpresariales.id, gasto.id));

          results.push({ id: gasto.id, type: 'gasto', status: 'success', previewUrl });
          console.log(`[MIGRATION] Gasto ${gasto.id} preview generated: ${previewUrl}`);
        } catch (error: any) {
          results.push({ id: gasto.id, type: 'gasto', status: 'error', message: error.message });
          console.error(`[MIGRATION] Error processing gasto ${gasto.id}:`, error.message);
        }
      }

      // 2. Get PDFs from fund_allocations without preview
      const fondosConPdf = await db
        .select({
          id: fundAllocations.id,
          comprobanteUrl: fundAllocations.comprobanteUrl,
          comprobantePreviewUrl: fundAllocations.comprobantePreviewUrl,
        })
        .from(fundAllocations)
        .where(
          and(
            sql`${fundAllocations.comprobanteUrl} ILIKE '%.pdf'`,
            or(
              isNull(fundAllocations.comprobantePreviewUrl),
              eq(fundAllocations.comprobantePreviewUrl, '')
            )
          )
        );

      console.log(`[MIGRATION] Found ${fondosConPdf.length} fondos with PDF without preview`);

      for (const fondo of fondosConPdf) {
        try {
          if (!fondo.comprobanteUrl) continue;

          // Download PDF from Object Storage
          const pdfResponse = await fetch(`${req.protocol}://${req.get('host')}${fondo.comprobanteUrl}`, {
            credentials: 'include'
          });

          if (!pdfResponse.ok) {
            results.push({ id: fondo.id, type: 'fondo', status: 'error', message: 'No se pudo descargar el PDF' });
            continue;
          }

          const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());

          // Convert to image
          const previewBuffer = await convertPdfToImage(pdfBuffer, 600);

          if (!previewBuffer) {
            results.push({ id: fondo.id, type: 'fondo', status: 'error', message: 'No se pudo convertir el PDF' });
            continue;
          }

          // Upload preview image
          const previewFileName = fondo.comprobanteUrl.replace(/\.pdf$/i, '_preview.png').replace(/^\/public-objects\//, '');
          const previewUrl = await objectStorageService.uploadImage(previewFileName, previewBuffer, 'image/png');

          // Update database
          await db
            .update(fundAllocations)
            .set({ comprobantePreviewUrl: previewUrl })
            .where(eq(fundAllocations.id, fondo.id));

          results.push({ id: fondo.id, type: 'fondo', status: 'success', previewUrl });
          console.log(`[MIGRATION] Fondo ${fondo.id} preview generated: ${previewUrl}`);
        } catch (error: any) {
          results.push({ id: fondo.id, type: 'fondo', status: 'error', message: error.message });
          console.error(`[MIGRATION] Error processing fondo ${fondo.id}:`, error.message);
        }
      }

      const successCount = results.filter(r => r.status === 'success').length;
      const errorCount = results.filter(r => r.status === 'error').length;

      res.json({
        message: `Migración completada: ${successCount} exitosos, ${errorCount} errores`,
        totalProcessed: results.length,
        successCount,
        errorCount,
        results
      });
    } catch (error: any) {
      console.error('[MIGRATION] Error:', error);
      res.status(500).json({ message: 'Error en la migración', error: error.message });
    }
  }));

  // Endpoint para listar PDFs en el bucket (diagnóstico)
  app.get('/api/admin/list-bucket-pdfs', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;

      if (user.role !== 'admin') {
        return res.status(403).json({ message: 'Solo administradores' });
      }

      const objectStorageService = new ObjectStorageService();
      const prefix = (req.query.prefix as string) || 'fondos/';

      const files = await objectStorageService.listFiles(prefix);
      const pdfs = files.filter(f => f.name.toLowerCase().endsWith('.pdf'));

      res.json({
        prefix,
        total: files.length,
        pdfs: pdfs.length,
        files: pdfs
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }));

  // Endpoint para migrar PDFs directamente del bucket (sin depender de la base de datos)
  app.post('/api/admin/migrate-bucket-pdfs', requireAuth, asyncHandler(async (req: any, res: any) => {
    try {
      const user = req.user;

      if (user.role !== 'admin') {
        return res.status(403).json({ message: 'Solo administradores pueden ejecutar migraciones' });
      }

      const objectStorageService = new ObjectStorageService();
      const prefix = (req.body.prefix as string) || 'fondos/';
      const results: any[] = [];

      // Listar PDFs en el bucket
      const files = await objectStorageService.listFiles(prefix);
      const pdfs = files.filter(f => f.name.toLowerCase().endsWith('.pdf') && !f.name.includes('_preview'));

      console.log(`[BUCKET MIGRATION] Found ${pdfs.length} PDFs in ${prefix}`);

      for (const pdf of pdfs) {
        try {
          // Verificar si ya existe preview
          const previewName = pdf.name.replace(/\.pdf$/i, '_preview.png');
          const existingPreviews = files.filter(f => f.name === previewName);

          if (existingPreviews.length > 0) {
            results.push({ name: pdf.name, status: 'skipped', message: 'Preview ya existe' });
            continue;
          }

          // Descargar PDF
          const pdfUrl = `${req.protocol}://${req.get('host')}/public-objects/${pdf.name.split('/').slice(-2).join('/')}`;
          console.log(`[BUCKET MIGRATION] Downloading: ${pdfUrl}`);

          const pdfResponse = await fetch(pdfUrl);

          if (!pdfResponse.ok) {
            results.push({ name: pdf.name, status: 'error', message: `No se pudo descargar: ${pdfResponse.status}` });
            continue;
          }

          const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());

          // Convertir a imagen
          const previewBuffer = await convertPdfToImage(pdfBuffer, 600);

          if (!previewBuffer) {
            results.push({ name: pdf.name, status: 'error', message: 'No se pudo convertir el PDF' });
            continue;
          }

          // Subir preview
          const previewFileName = pdf.name.replace(/\.pdf$/i, '_preview.png');
          const previewUrl = await objectStorageService.uploadImage(previewFileName, previewBuffer, 'image/png');

          results.push({ name: pdf.name, status: 'success', previewUrl });
          console.log(`[BUCKET MIGRATION] Preview generated: ${previewUrl}`);
        } catch (error: any) {
          results.push({ name: pdf.name, status: 'error', message: error.message });
          console.error(`[BUCKET MIGRATION] Error:`, error.message);
        }
      }

      const successCount = results.filter(r => r.status === 'success').length;
      const skippedCount = results.filter(r => r.status === 'skipped').length;
      const errorCount = results.filter(r => r.status === 'error').length;

      res.json({
        message: `Migración de bucket completada: ${successCount} exitosos, ${skippedCount} omitidos, ${errorCount} errores`,
        prefix,
        totalPdfs: pdfs.length,
        successCount,
        skippedCount,
        errorCount,
        results
      });
    } catch (error: any) {
      console.error('[BUCKET MIGRATION] Error:', error);
      res.status(500).json({ message: 'Error en la migración', error: error.message });
    }
  }));

  // ==================================================================================
  // PRESUPUESTO DE VENTAS - Importación masiva de presupuestos
  // ==================================================================================

  // GET: List budget records by year
  app.get('/api/presupuesto-ventas', requireAuth, asyncHandler(async (req: any, res: any) => {
    const anio = parseInt(req.query.anio as string) || new Date().getFullYear();
    const records = await db
      .select()
      .from(presupuestoVentas)
      .where(eq(presupuestoVentas.anio, anio))
      .orderBy(presupuestoVentas.categoria, presupuestoVentas.entidad, presupuestoVentas.mes);
    res.json(records);
  }));

  // GET: List available years
  app.get('/api/presupuesto-ventas/years', requireAuth, asyncHandler(async (req: any, res: any) => {
    const years = await db
      .selectDistinct({ anio: presupuestoVentas.anio })
      .from(presupuestoVentas)
      .orderBy(desc(presupuestoVentas.anio));
    res.json(years.map(y => y.anio));
  }));

  // POST: Bulk upsert budget records
  app.post('/api/presupuesto-ventas/bulk', requireAdminOrSupervisor, asyncHandler(async (req: any, res: any) => {
    try {
      const parsed = bulkPresupuestoVentasSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: 'Datos inválidos',
          details: parsed.error.errors
        });
      }

      const { records } = parsed.data;
      let upserted = 0;

      // Process in batches of 100 for performance
      const batchSize = 100;
      for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize);

        for (const record of batch) {
          await db
            .insert(presupuestoVentas)
            .values({
              anio: record.anio,
              mes: record.mes,
              categoria: record.categoria,
              entidad: record.entidad,
              monto: record.monto,
            })
            .onConflictDoUpdate({
              target: [presupuestoVentas.anio, presupuestoVentas.mes, presupuestoVentas.categoria, presupuestoVentas.entidad],
              set: {
                monto: sql`EXCLUDED.monto`,
                updatedAt: sql`NOW()`,
              },
            });
          upserted++;
        }
      }

      res.json({
        success: true,
        message: `${upserted} registros importados exitosamente`,
        count: upserted,
      });
    } catch (error: any) {
      console.error('[PRESUPUESTO] Bulk import error:', error);
      res.status(500).json({ error: 'Error al importar presupuesto: ' + error.message });
    }
  }));

  // DELETE: Remove all records for a year
  app.delete('/api/presupuesto-ventas', requireAdminOrSupervisor, asyncHandler(async (req: any, res: any) => {
    const anio = parseInt(req.query.anio as string);
    if (!anio) {
      return res.status(400).json({ error: 'Parámetro anio es requerido' });
    }

    const deleted = await db
      .delete(presupuestoVentas)
      .where(eq(presupuestoVentas.anio, anio))
      .returning();

    res.json({
      success: true,
      message: `${deleted.length} registros eliminados del año ${anio}`,
      count: deleted.length,
    });
  }));

  // ==================================================================================
  // AI CHAT ASSISTANT ENDPOINTS
  // ==================================================================================

  // POST /api/chat/message — Send a message to the AI assistant
  app.post('/api/chat/message', requireAuth, asyncHandler(async (req: any, res: any) => {
    const userId = req.user?.id;
    const userRole = req.user?.role || 'salesperson';
    const salespersonName = req.user?.salespersonName || null;
    const firstName = req.user?.firstName || '';
    const lastName = req.user?.lastName || '';

    const { message, sessionId: clientSessionId } = req.body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ error: 'El mensaje no puede estar vacío.' });
    }

    const sessionId = clientSessionId || randomUUID();

    // Save user message to DB
    await db.insert(chatMessages).values({
      userId,
      role: 'user',
      content: message.trim(),
      sessionId,
    });

    // Load conversation history for this session (last 20 messages for context)
    const history = await db
      .select()
      .from(chatMessages)
      .where(and(
        eq(chatMessages.userId, userId),
        eq(chatMessages.sessionId, sessionId)
      ))
      .orderBy(chatMessages.createdAt)
      .limit(20);

    // Build conversation context (exclude the message we just saved — it's the current one)
    const conversationHistory: AiMessage[] = history
      .slice(0, -1) // exclude last (current user message)
      .filter((m: any) => m.role === 'user' || m.role === 'assistant')
      .map((m: any) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content || '',
      }));

    // Build user context
    const userContext: AiUserContext = {
      userId,
      role: userRole,
      salespersonName: salespersonName || undefined,
      firstName,
      lastName,
    };

    // Process with AI agent — include knowledge base content
    const kbItems = await db.select().from(aiKnowledgeBase);
    const knowledgeBase = kbItems.map((k: any) => ({
      title: k.title,
      content: k.content || '',
      fileType: k.fileType || 'text',
    }));
    const result = await processAgentMessage(message.trim(), conversationHistory, userContext, knowledgeBase);

    // Save assistant response to DB
    await db.insert(chatMessages).values({
      userId,
      role: 'assistant',
      content: result.response,
      toolCalls: result.toolsUsed.length > 0 ? result.toolsUsed : null,
      metadata: { tokensUsed: result.tokensUsed, model: 'gpt-4o-mini' },
      sessionId,
    });

    res.json({
      response: result.response,
      sessionId,
      toolsUsed: result.toolsUsed,
      tokensUsed: result.tokensUsed,
    });
  }));

  // GET /api/chat/history — Get chat history for current user
  app.get('/api/chat/history', requireAuth, asyncHandler(async (req: any, res: any) => {
    const userId = req.user?.id;
    const { sessionId, limit: limitStr } = req.query;
    const limit = Math.min(parseInt(limitStr as string) || 50, 100);

    let query = db
      .select()
      .from(chatMessages)
      .where(
        sessionId
          ? and(eq(chatMessages.userId, userId), eq(chatMessages.sessionId, sessionId as string))
          : eq(chatMessages.userId, userId)
      )
      .orderBy(desc(chatMessages.createdAt))
      .limit(limit);

    const messages = await query;

    // Return in chronological order
    res.json({
      messages: messages.reverse().map((m: any) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        toolCalls: m.toolCalls,
        sessionId: m.sessionId,
        createdAt: m.createdAt,
      })),
      sessionId: sessionId || null,
    });
  }));

  // ═══════════════════════════════════════════════════════════════════
  // PUBLIC AI CHAT ENDPOINTS (for visitors in public catalog)
  // ═══════════════════════════════════════════════════════════════════

  // POST /api/public/chat/message — Send a message to the AI assistant from public catalog
  app.post('/api/public/chat/message', asyncHandler(async (req: any, res: any) => {
    const { message, sessionId: clientSessionId, salespersonSlug } = req.body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ error: 'El mensaje no puede estar vacío.' });
    }

    if (!salespersonSlug) {
      return res.status(400).json({ error: 'Se requiere el slug del vendedor.' });
    }

    // Identify salesperson
    const salesperson = await storage.getPublicSalespersonBySlug(salespersonSlug);
    if (!salesperson) {
      return res.status(404).json({ error: 'Vendedor no encontrado.' });
    }

    const sessionId = clientSessionId || `visitor-${randomUUID()}`;

    // Save user message to DB (userId as null for visitors)
    await db.insert(chatMessages).values({
      userId: null,
      role: 'user',
      content: message.trim(),
      sessionId,
    });

    // Load conversation history for this session
    const history = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.sessionId, sessionId))
      .orderBy(chatMessages.createdAt)
      .limit(20);

    const conversationHistory: AiMessage[] = history
      .slice(0, -1)
      .filter((m: any) => m.role === 'user' || m.role === 'assistant')
      .map((m: any) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content || '',
      }));

    // Build visitor context
    const userContext: AiUserContext = {
      userId: undefined,
      role: 'public',
      salespersonName: salesperson.salespersonName,
      firstName: 'Visitante',
      lastName: '',
    };

    // Process with AI agent — include knowledge base
    const kbItems = await db.select().from(aiKnowledgeBase);
    const knowledgeBase = kbItems.map((k: any) => ({
      title: k.title,
      content: k.content || '',
      fileType: k.fileType || 'text',
    }));

    const result = await processAgentMessage(message.trim(), conversationHistory, userContext, knowledgeBase);

    // Save assistant response to DB
    await db.insert(chatMessages).values({
      userId: null,
      role: 'assistant',
      content: result.response,
      toolCalls: result.toolsUsed.length > 0 ? result.toolsUsed : null,
      metadata: { tokensUsed: result.tokensUsed, model: 'gpt-4o-mini', public: true },
      sessionId,
    });

    res.json({
      response: result.response,
      sessionId,
      toolsUsed: result.toolsUsed,
      tokensUsed: result.tokensUsed,
    });
  }));

  // GET /api/public/chat/history — Get chat history for visitors
  app.get('/api/public/chat/history', asyncHandler(async (req: any, res: any) => {
    const { sessionId, limit: limitStr } = req.query;

    if (!sessionId) {
      return res.json({ messages: [], sessionId: null });
    }

    const limit = Math.min(parseInt(limitStr as string) || 50, 100);

    const messages = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.sessionId, sessionId as string))
      .orderBy(desc(chatMessages.createdAt))
      .limit(limit);

    res.json({
      messages: messages.reverse().map((m: any) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        toolCalls: m.toolCalls,
        sessionId: m.sessionId,
        createdAt: m.createdAt,
      })),
      sessionId: sessionId || null,
    });
  }));

  // ═══════════════════════════════════════════════════════════════════
  // AI KNOWLEDGE BASE ENDPOINTS
  // ═══════════════════════════════════════════════════════════════════

  // GET /api/ai-knowledge — List all knowledge base items
  app.get('/api/ai-knowledge', requireAuth, asyncHandler(async (req: any, res: any) => {
    const items = await db
      .select()
      .from(aiKnowledgeBase)
      .orderBy(desc(aiKnowledgeBase.createdAt));

    res.json({ items });
  }));

  // POST /api/ai-knowledge — Add a new knowledge base item
  app.post('/api/ai-knowledge', requireAuth, asyncHandler(async (req: any, res: any) => {
    const userId = req.user?.id;
    const userRole = req.user?.role;

    // Only admins can manage knowledge base
    if (userRole !== 'admin') {
      return res.status(403).json({ message: 'Solo los administradores pueden gestionar la base de conocimiento.' });
    }

    const { title, content, fileType } = req.body;

    if (!title || !content) {
      return res.status(400).json({ message: 'Se requiere título y contenido.' });
    }

    const [item] = await db.insert(aiKnowledgeBase).values({
      title,
      content,
      fileType: fileType || 'text',
      userId,
    }).returning();

    res.json({ success: true, item });
  }));

  // PUT /api/ai-knowledge/:id — Update a knowledge base item
  app.put('/api/ai-knowledge/:id', requireAuth, asyncHandler(async (req: any, res: any) => {
    const userRole = req.user?.role;
    if (userRole !== 'admin') {
      return res.status(403).json({ message: 'Solo los administradores pueden gestionar la base de conocimiento.' });
    }

    const { id } = req.params;
    const { title, content } = req.body;

    const [updated] = await db.update(aiKnowledgeBase)
      .set({ title, content, updatedAt: new Date() })
      .where(eq(aiKnowledgeBase.id, id))
      .returning();

    if (!updated) {
      return res.status(404).json({ message: 'Item no encontrado.' });
    }

    res.json({ success: true, item: updated });
  }));

  // DELETE /api/ai-knowledge/:id — Delete a knowledge base item
  app.delete('/api/ai-knowledge/:id', requireAuth, asyncHandler(async (req: any, res: any) => {
    const userRole = req.user?.role;
    if (userRole !== 'admin') {
      return res.status(403).json({ message: 'Solo los administradores pueden gestionar la base de conocimiento.' });
    }

    const { id } = req.params;
    const [deleted] = await db.delete(aiKnowledgeBase)
      .where(eq(aiKnowledgeBase.id, id))
      .returning();

    if (!deleted) {
      return res.status(404).json({ message: 'Item no encontrado.' });
    }

    res.json({ success: true });
  }));

  const httpServer = createServer(app);
  return httpServer;
}
