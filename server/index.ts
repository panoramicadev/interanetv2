import express, { type Request, Response, NextFunction } from "express";
import compression from "compression";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import path from "path";
import { executeIncrementalETL, getETLConfig } from "./etl-incremental";
import { executeNVVETL } from "./etl-nvv";
import { storage } from "./storage";
import { startHealthMonitor } from "./etl-health-monitor";
import { runProductionMigrations, ensureOAuthTables, ensureMarketSubUserColumns, ensureTaskCommentsAudioColumns, migrateProductImageUrls, uploadLocalImagesToObjectStorage, populateProductFamilyAndColor, populateProductSlugs, bootstrapDatabase, syncMissingFundMovements, fixReclamosProduccionEstado } from "./migrations";
import { startDailySalesReportScheduler } from "./daily-sales-report";

// Evita que una promesa rechazada sin handler tumbe el proceso (Node 20 hace throw por defecto).
// Se logea con stack para poder diagnosticar y se mantiene el server vivo.
process.on('unhandledRejection', (reason: any, promise) => {
  const message = reason?.message ?? String(reason);
  const stack = reason?.stack ?? new Error().stack;
  console.error('🛑 [unhandledRejection]', message);
  if (stack) console.error(stack);
});

process.on('uncaughtException', (err: Error) => {
  console.error('🛑 [uncaughtException]', err?.message ?? err);
  if (err?.stack) console.error(err.stack);
});

const app = express();
// Gzip compression — reduces ~6.8MB JS bundle to ~1.9MB over the wire
app.use(compression());

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: false, limit: '50mb' }));

// Serve product images from local storage
app.use('/product-images', express.static(path.join(process.cwd(), 'public', 'product-images')));

// Simple request duration logging (no response body capture)
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    if (req.path.startsWith("/api")) {
      const duration = Date.now() - start;
      log(`${req.method} ${req.path} ${res.statusCode} in ${duration}ms`);
    }
  });
  next();
});

(async () => {
  // Aplicar bootstrap + migraciones SQL ANTES de aceptar tráfico.
  // Si una request llega antes de que termine, una query como /api/store/products/grouped
  // puede fallar (ej: columna agregada por migración pendiente).
  if (!process.env.VERCEL) {
    try {
      await bootstrapDatabase();
    } catch (error: any) {
      console.error('❌ Error en bootstrap de base de datos:', error.message);
    }
    try {
      await runProductionMigrations();
    } catch (error: any) {
      console.error('❌ Error crítico en migraciones:', error.message);
    }
    // Aparte del bucle de migraciones a propósito: si una migración anterior
    // falla, ese bucle corta y sin esto el login de los asistentes queda roto.
    try {
      await ensureOAuthTables();
    } catch (error: any) {
      console.error('❌ Error al verificar las tablas OAuth:', error.message);
    }
    // Idem: el listado de clientes y la ficha filtran por parent_user_id, así que
    // estas columnas no pueden depender de que el bucle de migraciones llegue al final.
    try {
      await ensureMarketSubUserColumns();
    } catch (error: any) {
      console.error('❌ Error al verificar columnas de compradores del Market:', error.message);
    }
    // Idem: el chat del Panel de Trabajo selecciona estas columnas en cada
    // lectura y en cada alta; sin ellas no carga ni deja escribir.
    try {
      await ensureTaskCommentsAudioColumns();
    } catch (error: any) {
      console.error('❌ Error al verificar columnas de audio del chat:', error.message);
    }
  }

  const server = registerRoutes(app);

  // OAuth 2.1 para el MCP. Va después de registerRoutes porque necesita la
  // sesión y passport que arma setupAuth(), y antes del catch-all de Vite.
  const { registerOAuthRoutes } = await import('./routes-oauth');
  registerOAuthRoutes(app);

  // Register B2C public quotation routes (isolated from B2B)
  const { registerB2CRoutes } = await import('./routes-b2c');
  registerB2CRoutes(app);

  // Register Web Push (PWA) routes
  const { registerPushRoutes } = await import('./routes-push');
  registerPushRoutes(app);

  // Register Mailing / Campañas de Marketing routes + scheduler
  const { registerCampaignRoutes } = await import('./routes-campaigns');
  registerCampaignRoutes(app);
  const { startCampaignScheduler } = await import('./services/campaigns');
  startCampaignScheduler();

  // Rendición de gastos v2: informes, catálogos, historial y reportes PDF/Excel
  const { registerRendicionRoutes } = await import('./routes-rendicion');
  registerRendicionRoutes(app);

  // Solicitud de crédito: el vendedor pide, Finanzas resuelve
  const { registerSolicitudesCreditoRoutes } = await import('./routes-solicitudes-credito');
  registerSolicitudesCreditoRoutes(app);

  // Nuevo Cliente: el vendedor pide el alta, Administración crea el cliente
  const { registerNuevoClienteRoutes } = await import('./routes-nuevo-cliente');
  registerNuevoClienteRoutes(app);

  // Compradores del Market: el cliente crea usuarios y aprueba sus pedidos
  const { registerMarketUsuariosRoutes } = await import('./routes-market-usuarios');
  registerMarketUsuariosRoutes(app);

  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    // Detect if this is an API request or an HTML navigation request
    const expectsHtml = req.accepts('html') && !req.path.startsWith('/api/') && !req.xhr;

    if (expectsHtml) {
      res.status(status).send(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Servicio temporalmente no disponible</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; background-color: #f8fafc; color: #1e293b; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; }
            .container { background-color: white; padding: 3rem; border-radius: 1rem; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); max-width: 500px; margin: 1rem; }
            h1 { color: #dc2626; margin-top: 0; }
            p { color: #64748b; line-height: 1.5; }
            .button { display: inline-block; margin-top: 1.5rem; background-color: #2563eb; color: white; padding: 0.75rem 1.5rem; border-radius: 0.5rem; text-decoration: none; font-weight: 500; }
            .button:hover { background-color: #1d4ed8; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Servicio no disponible</h1>
            <p>La plataforma está experimentando alta demanda o tareas de mantenimiento. Por favor, intenta actualizar la página en unos momentos.</p>
            <p style="font-size: 0.875rem; border-top: 1px solid #e2e8f0; padding-top: 1rem; margin-top: 1rem;">Detalle: ${message}</p>
            <a href="/" class="button">Refrescar página</a>
          </div>
        </body>
        </html>
      `);
    } else {
      res.status(status).json({ message });
    }
    
    // Only log, don't re-throw to prevent unhandled rejections if express doesn't catch it
    console.error(`[Express] Error handling request ${req.path}:`, message);
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
    const host = process.env.RAILWAY_ENVIRONMENT ? "0.0.0.0" : "127.0.0.1";
    server.listen({
      port,
      host,
    }, () => {
      log(`serving on port ${port}`);
      log('✅ Server ready for health checks');

      // Defer all heavy initialization to avoid blocking health checks
      setImmediate(() => {
        // Escape hatch para levantar solo la web (preview de UI) sin ETL/schedulers/jobs
        // que escriben en la BD compartida o pegan a sistemas externos.
        if (process.env.SKIP_BG_SERVICES === '1') {
          log('⏸️ Background services omitidos (SKIP_BG_SERVICES=1)');
          return;
        }
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

  // Migrar URLs de imágenes de productos a Object Storage
  try {
    await migrateProductImageUrls();
  } catch (error: any) {
    console.error('⚠️ Error al migrar URLs de imágenes:', error.message);
  }

  // Subir imágenes locales a Object Storage para persistencia
  // ONLY run on Replit (needs sidecar at 127.0.0.1:1106)
  if (process.env.REPLIT_DEV_DOMAIN || process.env.REPL_ID) {
    try {
      const uploadResult = await uploadLocalImagesToObjectStorage();
      if (uploadResult.uploaded > 0) {
        log(`☁️ Imágenes sincronizadas a Object Storage: ${uploadResult.uploaded} subidas, ${uploadResult.failed} errores`);
      }
    } catch (error: any) {
      console.error('⚠️ Error al sincronizar imágenes a Object Storage:', error.message);
    }
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

  // Generar slugs de productos para URLs públicas
  try {
    const slugResult = await populateProductSlugs();
    if (slugResult.updated > 0) {
      log(`🔗 Slugs generados: ${slugResult.updated} productos`);
    }
  } catch (error: any) {
    console.error('⚠️ Error al generar slugs:', error.message);
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
        log('📊 [ETL-SCHEDULER] (1/4) Starting Ventas Incremental...');
        const ventasResult = await executeIncrementalETL();
        if (ventasResult.success) {
          log(`✅ [ETL-SCHEDULER] Ventas: ${ventasResult.recordsProcessed} registros en ${ventasResult.executionTimeMs}ms`);
        } else {
          console.error(`❌ [ETL-SCHEDULER] Ventas falló: ${ventasResult.error}`);
        }
      } catch (error: any) {
        console.error('[ETL-SCHEDULER] Ventas ETL failed:', error.message);
      }

      // GDV
      try {
        const { executeGDVETL } = await import('./etl-gdv');
        log('📊 [ETL-SCHEDULER] (2/4) Starting GDV...');
        const gdvResult = await executeGDVETL();
        if (gdvResult.success) {
          log(`✅ [ETL-SCHEDULER] GDV: ${gdvResult.recordsProcessed} registros en ${gdvResult.executionTimeMs}ms`);
        } else {
          console.error(`❌ [ETL-SCHEDULER] GDV falló: ${(gdvResult as any).error}`);
        }
      } catch (error: any) {
        console.error('[ETL-SCHEDULER] GDV ETL failed:', error.message);
      }

      // NVV
      try {
        log('📊 [ETL-SCHEDULER] (3/4) Starting NVV...');
        const nvvResult = await executeNVVETL();
        if (nvvResult.success) {
          log(`✅ [ETL-SCHEDULER] NVV: ${nvvResult.records_processed} registros en ${nvvResult.execution_time_ms}ms`);
        } else {
          console.error(`❌ [ETL-SCHEDULER] NVV falló: ${(nvvResult as any).error}`);
        }
      } catch (error: any) {
        console.error('[ETL-SCHEDULER] NVV ETL failed:', error.message);
      }

      // Clientes (maestro MAEEN). Sin esto, un cliente creado en el ERP no
      // aparecía en la intranet hasta que alguien corría el ETL a mano desde
      // Monitor ETL → pestaña Clientes.
      try {
        const { executeClientETL } = await import('./etl-clients');
        log('📊 [ETL-SCHEDULER] (4/4) Starting Clientes...');
        const clientesResult = await executeClientETL();
        if (clientesResult.success) {
          log(`✅ [ETL-SCHEDULER] Clientes: ${clientesResult.recordsProcessed} registros en ${clientesResult.executionTimeMs}ms`);
        } else {
          console.error(`❌ [ETL-SCHEDULER] Clientes falló: ${(clientesResult as any).error}`);
        }
      } catch (error: any) {
        console.error('[ETL-SCHEDULER] Clientes ETL failed:', error.message);
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
