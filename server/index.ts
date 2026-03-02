import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import path from "path";
import { executeIncrementalETL, getETLConfig } from "./etl-incremental";
import { executeNVVETL } from "./etl-nvv";
import { storage } from "./storage";
import { startHealthMonitor } from "./etl-health-monitor";
import { runProductionMigrations, migrateProductImageUrls, uploadLocalImagesToObjectStorage, populateProductFamilyAndColor, bootstrapDatabase, syncMissingFundMovements, fixReclamosProduccionEstado } from "./migrations";
import { startDailySalesReportScheduler } from "./daily-sales-report";

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: false, limit: '50mb' }));

// Serve product images from local storage
app.use('/product-images', express.static(path.join(process.cwd(), 'public', 'product-images')));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Only start listening when NOT in Vercel serverless mode
  if (!process.env.VERCEL) {
    const port = parseInt(process.env.PORT || '5000', 10);
    server.listen({
      port,
      host: "127.0.0.1",
    }, () => {
      log(`serving on port ${port}`);
      log('✅ Server ready for health checks');

      // Defer all heavy initialization to avoid blocking health checks
      setImmediate(() => {
        initializeBackgroundServices().catch(err => {
          console.error('Background services initialization error:', err.message);
        });
      });
    });
  }
})();

// Export app for Vercel serverless
export default app;

// Background services initialization - runs after server is ready
async function initializeBackgroundServices() {
  log('🚀 Starting background services initialization...');

  // Bootstrap de base de datos - crea esquemas y tablas base ANTES de migraciones
  try {
    await bootstrapDatabase();
  } catch (error: any) {
    console.error('❌ Error en bootstrap de base de datos:', error.message);
    console.error('La aplicación continuará, pero algunas funciones pueden no estar disponibles');
  }

  // Ejecutar migraciones de base de datos
  try {
    await runProductionMigrations();
  } catch (error: any) {
    console.error('❌ Error crítico en migraciones:', error.message);
    console.error('La aplicación continuará, pero algunas funciones pueden no estar disponibles');
  }

  // Migrar URLs de imágenes de productos a Object Storage
  try {
    await migrateProductImageUrls();
  } catch (error: any) {
    console.error('⚠️ Error al migrar URLs de imágenes:', error.message);
  }

  // Subir imágenes locales a Object Storage para persistencia
  try {
    const uploadResult = await uploadLocalImagesToObjectStorage();
    if (uploadResult.uploaded > 0) {
      log(`☁️ Imágenes sincronizadas a Object Storage: ${uploadResult.uploaded} subidas, ${uploadResult.failed} errores`);
    }
  } catch (error: any) {
    console.error('⚠️ Error al sincronizar imágenes a Object Storage:', error.message);
  }

  // Poblar campos de familia y color de productos
  try {
    const familyResult = await populateProductFamilyAndColor();
    if (familyResult.updated > 0) {
      log(`🏷️ Productos clasificados: ${familyResult.updated} actualizados`);
    }
  } catch (error: any) {
    console.error('⚠️ Error al clasificar productos:', error.message);
  }

  // Sincronizar movimientos de fondos faltantes
  try {
    const syncResult = await syncMissingFundMovements();
    if (syncResult.synced > 0) {
      log(`💰 Movimientos de fondos sincronizados: ${syncResult.synced} creados, ${syncResult.errors} errores`);
    }
  } catch (error: any) {
    console.error('⚠️ Error al sincronizar movimientos de fondos:', error.message);
  }

  // Corregir reclamos de producción con estado incorrecto
  try {
    await fixReclamosProduccionEstado();
  } catch (error: any) {
    console.error('⚠️ Error al corregir estados de reclamos:', error.message);
  }

  // Inicializar catálogos públicos para todos los vendedores
  try {
    const result = await storage.initializePublicCatalogs();
    if (result.updated > 0) {
      log(`📚 Catálogos públicos inicializados: ${result.updated} vendedores configurados`);
    }
  } catch (error: any) {
    console.error('⚠️ Error al inicializar catálogos públicos:', error.message);
  }

  // ═══════════════════════════════════════════════════════════════
  // ETL Time-Based Scheduler — Runs all ETLs at 10:00, 14:00, 18:00 Chile time
  // ═══════════════════════════════════════════════════════════════
  try {
    const SCHEDULE_HOURS = [10, 14, 18]; // Chile time (America/Santiago)
    const SCHEDULER_CHECK_INTERVAL = 60 * 1000; // Check every 1 minute
    let lastScheduledRun = ''; // Track last run to prevent duplicates

    const getChileHourMinute = (): { hour: number; minute: number; key: string } => {
      const now = new Date();
      const chileTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Santiago' }));
      const hour = chileTime.getHours();
      const minute = chileTime.getMinutes();
      return { hour, minute, key: `${chileTime.toDateString()}-${hour}` };
    };

    const runAllETLs = async (trigger: string) => {
      log(`📊 [ETL-SCHEDULER] Running all ETLs (${trigger})...`);

      // Ventas Incremental
      try {
        log('📊 [ETL-SCHEDULER] (1/3) Starting Ventas Incremental...');
        const ventasResult = await executeIncrementalETL();
        log(`✅ [ETL-SCHEDULER] Ventas: ${ventasResult.recordsProcessed} registros en ${ventasResult.executionTimeMs}ms`);
      } catch (error: any) {
        console.error('[ETL-SCHEDULER] Ventas ETL failed:', error.message);
      }

      // GDV
      try {
        const { executeGDVETL } = await import('./etl-gdv');
        log('📊 [ETL-SCHEDULER] (2/3) Starting GDV...');
        const gdvResult = await executeGDVETL();
        log(`✅ [ETL-SCHEDULER] GDV: ${gdvResult.recordsProcessed} registros en ${gdvResult.executionTimeMs}ms`);
      } catch (error: any) {
        console.error('[ETL-SCHEDULER] GDV ETL failed:', error.message);
      }

      // NVV
      try {
        log('📊 [ETL-SCHEDULER] (3/3) Starting NVV...');
        const nvvResult = await executeNVVETL();
        log(`✅ [ETL-SCHEDULER] NVV: ${nvvResult.records_processed} registros en ${nvvResult.execution_time_ms}ms`);
      } catch (error: any) {
        console.error('[ETL-SCHEDULER] NVV ETL failed:', error.message);
      }

      log('✅ [ETL-SCHEDULER] All ETLs completed');
    };

    // Time-based scheduler: check every minute if it's time to run
    setInterval(() => {
      const { hour, minute, key } = getChileHourMinute();

      // Run if we're at a scheduled hour within the first minute window AND haven't run this slot yet
      if (SCHEDULE_HOURS.includes(hour) && minute < 2 && lastScheduledRun !== key) {
        lastScheduledRun = key;
        runAllETLs(`scheduled ${hour}:00`).catch(err => {
          console.error('[ETL-SCHEDULER] Scheduled run failed:', err.message);
        });
      }
    }, SCHEDULER_CHECK_INTERVAL);

    // Run initial ETL sync 30 seconds after startup
    setTimeout(async () => {
      try {
        await runAllETLs('startup');
      } catch (error: any) {
        console.error('[ETL-SCHEDULER] Initial ETL run failed:', error.message);
      }
    }, 30000);

    const { hour: nowHour } = getChileHourMinute();
    const nextRun = SCHEDULE_HOURS.find(h => h > nowHour) || SCHEDULE_HOURS[0];
    log(`🔄 ETL scheduler initialized — runs at ${SCHEDULE_HOURS.map(h => `${h}:00`).join(', ')} Chile time`);
    log(`🔄 Next scheduled run: ${nextRun}:00 Chile time`);
  } catch (error: any) {
    console.error('Failed to initialize ETL scheduler:', error.message);
    log('⚠️  ETL scheduler failed to initialize');
  }

  // Start inactive clients update scheduler (runs daily)
  try {
    const INACTIVE_CLIENTS_INTERVAL = 24 * 60 * 60 * 1000;

    log('🔔 Inactive clients alert scheduler initialized (runs every 24 hours)');

    setTimeout(async () => {
      try {
        log('🔔 Running initial inactive clients update on startup...');
        const count = await storage.updateInactiveClients();
        log(`✅ Updated ${count} inactive clients alerts`);

      } catch (error: any) {
        console.error('Initial inactive clients update failed:', error.message);
      }
    }, 60000);

    setInterval(async () => {
      try {
        log('🔔 Running scheduled inactive clients update...');
        const count = await storage.updateInactiveClients();
        log(`✅ Updated ${count} inactive clients alerts`);
      } catch (error: any) {
        console.error('Scheduled inactive clients update failed:', error.message);
      }
    }, INACTIVE_CLIENTS_INTERVAL);
  } catch (error: any) {
    console.error('Failed to initialize inactive clients scheduler:', error.message);
  }

  // Start low stock check scheduler (runs every hour)
  try {
    const LOW_STOCK_CHECK_INTERVAL = 60 * 60 * 1000;

    log('📦 Low stock alert scheduler initialized (runs every hour)');

    setTimeout(async () => {
      try {
        log('📦 Running initial low stock check on startup...');
        await storage.checkAndNotifyLowStock();
        log('✅ Low stock check completed');
      } catch (error: any) {
        console.error('Initial low stock check failed:', error.message);
      }
    }, 120000);

    setInterval(async () => {
      try {
        log('📦 Running scheduled low stock check...');
        await storage.checkAndNotifyLowStock();
        log('✅ Low stock check completed');
      } catch (error: any) {
        console.error('Scheduled low stock check failed:', error.message);
      }
    }, LOW_STOCK_CHECK_INTERVAL);
  } catch (error: any) {
    console.error('Failed to initialize low stock scheduler:', error.message);
  }

  // Start preventive maintenance scheduler (runs daily)
  try {
    const PREVENTIVE_MAINTENANCE_INTERVAL = 24 * 60 * 60 * 1000;

    log('🔧 Preventive maintenance scheduler initialized (runs daily)');

    setTimeout(async () => {
      try {
        log('🔧 Running initial preventive maintenance check on startup...');
        const otsGenerated = await storage.processPreventiveMaintenanceSchedule();
        log(`✅ Preventive maintenance check completed - ${otsGenerated} OTs generated`);
      } catch (error: any) {
        console.error('Initial preventive maintenance check failed:', error.message);
      }
    }, 150000);

    setInterval(async () => {
      try {
        log('🔧 Running scheduled preventive maintenance check...');
        const otsGenerated = await storage.processPreventiveMaintenanceSchedule();
        log(`✅ Preventive maintenance check completed - ${otsGenerated} OTs generated`);
      } catch (error: any) {
        console.error('Scheduled preventive maintenance check failed:', error.message);
      }
    }, PREVENTIVE_MAINTENANCE_INTERVAL);
  } catch (error: any) {
    console.error('Failed to initialize preventive maintenance scheduler:', error.message);
  }

  // Start ETL health monitor (runs every 10 minutes)
  try {
    startHealthMonitor(10);
  } catch (error: any) {
    console.error('Failed to initialize ETL health monitor:', error.message);
  }

  // Start daily sales report scheduler (runs at 17:30 Chile time)
  try {
    startDailySalesReportScheduler();
    log('📊 Daily sales report scheduler initialized (runs at 17:30 Chile time)');
  } catch (error: any) {
    console.error('Failed to initialize daily sales report scheduler:', error.message);
  }

  // Start recurring funds scheduler (checks every 6 hours)
  try {
    const RECURRING_FUNDS_INTERVAL = 6 * 60 * 60 * 1000;

    setTimeout(async () => {
      try {
        log('🔄 Running initial recurring funds check on startup...');
        const result = await storage.processRecurringFunds();
        log(`✅ Recurring funds check completed - ${result.created} created, ${result.closed} closed`);
      } catch (error: any) {
        console.error('Initial recurring funds check failed:', error.message);
      }
    }, 60000);

    setInterval(async () => {
      try {
        log('🔄 Running scheduled recurring funds check...');
        const result = await storage.processRecurringFunds();
        log(`✅ Recurring funds check completed - ${result.created} created, ${result.closed} closed`);
      } catch (error: any) {
        console.error('Scheduled recurring funds check failed:', error.message);
      }
    }, RECURRING_FUNDS_INTERVAL);

    log('🔄 Recurring funds scheduler initialized (runs every 6 hours)');
  } catch (error: any) {
    console.error('Failed to initialize recurring funds scheduler:', error.message);
  }

  log('✅ Background services initialization completed');
}
