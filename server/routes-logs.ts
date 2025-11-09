import type { Express } from 'express';
import { productionLogger, LogLevel } from './production-logger';

export function registerLogRoutes(app: Express, requireRoles: any) {
  // Get production logs - Admin only
  app.get('/api/logs', requireRoles(['admin']), (req: any, res: any) => {
    const { 
      level, 
      category, 
      limit = 100, 
      startDate, 
      endDate 
    } = req.query;

    const options: any = {
      limit: parseInt(limit as string, 10),
    };

    if (level && Object.values(LogLevel).includes(level as LogLevel)) {
      options.level = level as LogLevel;
    }

    if (category) {
      options.category = category as string;
    }

    if (startDate) {
      options.startDate = new Date(startDate as string);
    }

    if (endDate) {
      options.endDate = new Date(endDate as string);
    }

    const logs = productionLogger.getLogs(options);
    const stats = productionLogger.getStats();

    res.json({
      logs,
      stats,
      totalReturned: logs.length,
    });
  });

  // Get log stats only - Admin only
  app.get('/api/logs/stats', requireRoles(['admin']), (req: any, res: any) => {
    const stats = productionLogger.getStats();
    res.json(stats);
  });

  // Clear logs - Admin only (use with caution)
  app.delete('/api/logs', requireRoles(['admin']), (req: any, res: any) => {
    productionLogger.clearLogs();
    res.json({ 
      success: true, 
      message: 'Logs cleared successfully' 
    });
  });
}
