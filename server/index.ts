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

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
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
})();

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
  
  // Start ETL automatic scheduler with configurable interval
  try {
    const config = await getETLConfig('ventas_incremental');
    const intervalMinutes = config.intervalMinutes || 15;
    const ETL_INTERVAL = intervalMinutes * 60 * 1000;
    
    log(`🔄 ETL automatic scheduler initialized (runs every ${intervalMinutes} minutes)`);
    
    setTimeout(async () => {
      try {
        log('📊 Running initial ETL on startup...');
        await executeIncrementalETL();
      } catch (error: any) {
        console.error('Initial ETL execution failed:', error.message);
      }
    }, 30000);
    
    setInterval(async () => {
      try {
        log('📊 Running scheduled ETL update...');
        await executeIncrementalETL();
      } catch (error: any) {
        console.error('Scheduled ETL execution failed:', error.message);
      }
    }, ETL_INTERVAL);
  } catch (error: any) {
    console.error('Failed to initialize ETL scheduler:', error.message);
    log('⚠️  ETL scheduler failed to initialize - using default 15 minute interval');
    
    const ETL_INTERVAL = 15 * 60 * 1000;
    setInterval(async () => {
      try {
        log('📊 Running scheduled ETL update...');
        await executeIncrementalETL();
      } catch (error: any) {
        console.error('Scheduled ETL execution failed:', error.message);
      }
    }, ETL_INTERVAL);
  }

  // Start NVV ETL automatic scheduler
  try {
    const nvvConfig = await getETLConfig('nvv');
    const nvvIntervalMinutes = nvvConfig.intervalMinutes || 240;
    const NVV_ETL_INTERVAL = nvvIntervalMinutes * 60 * 1000;
    
    log(`🔄 NVV ETL automatic scheduler initialized (runs every ${nvvIntervalMinutes} minutes)`);
    
    setTimeout(async () => {
      try {
        log('📊 Running initial NVV ETL on startup...');
        await executeNVVETL();
      } catch (error: any) {
        console.error('Initial NVV ETL execution failed:', error.message);
      }
    }, 120000);
    
    setInterval(async () => {
      try {
        log('📊 Running scheduled NVV ETL update...');
        await executeNVVETL();
      } catch (error: any) {
        console.error('Scheduled NVV ETL execution failed:', error.message);
      }
    }, NVV_ETL_INTERVAL);
  } catch (error: any) {
    console.error('Failed to initialize NVV ETL scheduler:', error.message);
    log('⚠️  NVV ETL scheduler failed to initialize');
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
        
        if (count > 0) {
          const { notifyClientesInactivos } = await import('./notifications-helper');
          await notifyClientesInactivos(count);
          log(`✅ Notification sent: ${count} inactive clients detected`);
        }
      } catch (error: any) {
        console.error('Initial inactive clients update failed:', error.message);
      }
    }, 60000);
    
    setInterval(async () => {
      try {
        log('🔔 Running scheduled inactive clients update...');
        const count = await storage.updateInactiveClients();
        log(`✅ Updated ${count} inactive clients alerts`);
        
        if (count > 0) {
          const { notifyClientesInactivos } = await import('./notifications-helper');
          await notifyClientesInactivos(count);
          log(`✅ Notification sent: ${count} inactive clients detected`);
        }
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
  
  log('✅ Background services initialization completed');
}
