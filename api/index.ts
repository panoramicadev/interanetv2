import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "../server/routes";
import { serveStatic } from "../server/vite";
import path from "path";
import { storage } from "../server/storage";
import { bootstrapDatabase } from "../server/migrations";

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: false, limit: '50mb' }));

// Serve product images from local storage
app.use('/product-images', express.static(path.join(process.cwd(), 'public', 'product-images')));

// Request logging
app.use((req, res, next) => {
    const start = Date.now();
    const reqPath = req.path;
    let capturedJsonResponse: Record<string, any> | undefined = undefined;

    const originalResJson = res.json;
    res.json = function (bodyJson, ...args) {
        capturedJsonResponse = bodyJson;
        return originalResJson.apply(res, [bodyJson, ...args]);
    };

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

let initialized = false;

async function ensureInitialized() {
    if (initialized) return;
    initialized = true;

    try {
        await bootstrapDatabase();
    } catch (error: any) {
        console.error('Bootstrap error:', error.message);
    }
}

// Register routes
const server = registerRoutes(app);

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
});

// Serve static files in production
serveStatic(app);

// Middleware to ensure DB is initialized
app.use(async (_req, _res, next) => {
    await ensureInitialized();
    next();
});

export default app;
