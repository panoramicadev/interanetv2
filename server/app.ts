import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./vite";
import path from "path";
import { bootstrapDatabase, runProductionMigrations } from "./migrations";

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: false, limit: '50mb' }));

// Serve product images from local storage
app.use('/product-images', express.static(path.join(process.cwd(), 'public', 'product-images')));

// Request logging
app.use((req, res, next) => {
    const start = Date.now();
    const reqPath = req.path;

    res.on("finish", () => {
        const duration = Date.now() - start;
        if (reqPath.startsWith("/api")) {
            let logLine = `${req.method} ${reqPath} ${res.statusCode} in ${duration}ms`;
            if (logLine.length > 80) {
                logLine = logLine.slice(0, 79) + "…";
            }
            console.log(logLine);
        }
    });

    next();
});

// Register routes
registerRoutes(app);

// Error handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
});

// Serve static files in production
if (process.env.NODE_ENV === "production") {
    serveStatic(app);
}

// Lazy initialization for serverless
let initialized = false;
const originalHandler = app;

const handler = async (req: any, res: any) => {
    if (!initialized) {
        initialized = true;
        try {
            await bootstrapDatabase();
            await runProductionMigrations();
        } catch (error: any) {
            console.error('Init error:', error.message);
        }
    }
    return originalHandler(req, res);
};

export default handler;
export { app };
