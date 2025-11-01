import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import path from "path";
import { executeIncrementalETL, getETLConfig } from "./etl-incremental";
import { storage } from "./storage";

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
    host: "0.0.0.0",
    reusePort: true,
  }, async () => {
    log(`serving on port ${port}`);
    
    // Start ETL automatic scheduler with configurable interval
    try {
      const config = await getETLConfig('ventas_incremental');
      const intervalMinutes = config.intervalMinutes || 15;
      const ETL_INTERVAL = intervalMinutes * 60 * 1000; // Convert minutes to milliseconds
      
      log(`🔄 ETL automatic scheduler initialized (runs every ${intervalMinutes} minutes)`);
      
      // Run ETL on startup after 30 seconds (give the app time to fully initialize)
      setTimeout(async () => {
        try {
          log('📊 Running initial ETL on startup...');
          await executeIncrementalETL();
        } catch (error: any) {
          console.error('Initial ETL execution failed:', error.message);
        }
      }, 30000);
      
      // Schedule ETL to run at configured interval
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
      
      // Fallback to default interval
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

    // Start inactive clients update scheduler (runs daily)
    try {
      const INACTIVE_CLIENTS_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
      
      log('🔔 Inactive clients alert scheduler initialized (runs every 24 hours)');
      
      // Run on startup after 1 minute (give the app time to fully initialize)
      setTimeout(async () => {
        try {
          log('🔔 Running initial inactive clients update on startup...');
          const count = await storage.updateInactiveClients();
          log(`✅ Updated ${count} inactive clients alerts`);
          
          // 🔔 Notificar si hay clientes inactivos
          if (count > 0) {
            const { notifyClientesInactivos } = await import('./notifications-helper');
            await notifyClientesInactivos(count);
            log(`✅ Notification sent: ${count} inactive clients detected`);
          }
        } catch (error: any) {
          console.error('Initial inactive clients update failed:', error.message);
        }
      }, 60000);
      
      // Schedule to run daily
      setInterval(async () => {
        try {
          log('🔔 Running scheduled inactive clients update...');
          const count = await storage.updateInactiveClients();
          log(`✅ Updated ${count} inactive clients alerts`);
          
          // 🔔 Notificar si hay clientes inactivos
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
  });
})();
