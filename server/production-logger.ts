import type { Request } from 'express';

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL'
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  category: string;
  message: string;
  context?: Record<string, any>;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
  user?: {
    id: number;
    username: string;
    role: string;
  };
  request?: {
    method: string;
    url: string;
    ip?: string;
  };
}

class ProductionLogger {
  private logs: LogEntry[] = [];
  private maxLogs: number = 1000;
  private enableConsole: boolean = true;

  constructor(options?: { maxLogs?: number; enableConsole?: boolean }) {
    this.maxLogs = options?.maxLogs || 1000;
    this.enableConsole = options?.enableConsole !== false;
  }

  private createLogEntry(
    level: LogLevel,
    category: string,
    message: string,
    options?: {
      context?: Record<string, any>;
      error?: Error | any;
      user?: any;
      request?: Request;
    }
  ): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
    };

    if (options?.context) {
      entry.context = this.sanitizeContext(options.context);
    }

    if (options?.error) {
      entry.error = {
        name: options.error.name || 'Error',
        message: options.error.message,
        stack: options.error.stack,
        code: options.error.code,
      };
    }

    if (options?.user) {
      entry.user = {
        id: options.user.id,
        username: options.user.username,
        role: options.user.role,
      };
    }

    if (options?.request) {
      entry.request = {
        method: options.request.method,
        url: options.request.url,
        ip: options.request.ip,
      };
    }

    return entry;
  }

  private sanitizeContext(context: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {};
    const sensitiveKeys = ['password', 'token', 'secret', 'apikey', 'api_key'];

    for (const [key, value] of Object.entries(context)) {
      const keyLower = key.toLowerCase();
      if (sensitiveKeys.some(sensitive => keyLower.includes(sensitive))) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = JSON.stringify(value).substring(0, 500);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  private addLog(entry: LogEntry) {
    this.logs.push(entry);
    
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    if (this.enableConsole) {
      this.printToConsole(entry);
    }
  }

  private printToConsole(entry: LogEntry) {
    const emoji = {
      [LogLevel.DEBUG]: '🐛',
      [LogLevel.INFO]: 'ℹ️',
      [LogLevel.WARN]: '⚠️',
      [LogLevel.ERROR]: '❌',
      [LogLevel.CRITICAL]: '🚨',
    }[entry.level];

    const prefix = `${emoji} [${entry.level}] [${entry.category}]`;
    const timestamp = new Date(entry.timestamp).toLocaleTimeString('es-CL');

    console.log(`\n${prefix} ${timestamp}`);
    console.log(`   ${entry.message}`);

    if (entry.context && Object.keys(entry.context).length > 0) {
      console.log(`   📋 Context:`, JSON.stringify(entry.context, null, 2));
    }

    if (entry.user) {
      console.log(`   👤 User: ${entry.user.username} (${entry.user.role})`);
    }

    if (entry.request) {
      console.log(`   🌐 Request: ${entry.request.method} ${entry.request.url}`);
    }

    if (entry.error) {
      console.error(`   💥 Error: ${entry.error.name}: ${entry.error.message}`);
      if (entry.error.stack) {
        console.error(`   📚 Stack:\n${entry.error.stack.split('\n').slice(0, 5).join('\n')}`);
      }
    }
  }

  debug(category: string, message: string, options?: {
    context?: Record<string, any>;
    user?: any;
    request?: Request;
  }) {
    const entry = this.createLogEntry(LogLevel.DEBUG, category, message, options);
    this.addLog(entry);
  }

  info(category: string, message: string, options?: {
    context?: Record<string, any>;
    user?: any;
    request?: Request;
  }) {
    const entry = this.createLogEntry(LogLevel.INFO, category, message, options);
    this.addLog(entry);
  }

  warn(category: string, message: string, options?: {
    context?: Record<string, any>;
    error?: Error | any;
    user?: any;
    request?: Request;
  }) {
    const entry = this.createLogEntry(LogLevel.WARN, category, message, options);
    this.addLog(entry);
  }

  error(category: string, message: string, options?: {
    context?: Record<string, any>;
    error?: Error | any;
    user?: any;
    request?: Request;
  }) {
    const entry = this.createLogEntry(LogLevel.ERROR, category, message, options);
    this.addLog(entry);
  }

  critical(category: string, message: string, options?: {
    context?: Record<string, any>;
    error?: Error | any;
    user?: any;
    request?: Request;
  }) {
    const entry = this.createLogEntry(LogLevel.CRITICAL, category, message, options);
    this.addLog(entry);
  }

  getLogs(options?: {
    level?: LogLevel;
    category?: string;
    limit?: number;
    startDate?: Date;
    endDate?: Date;
  }): LogEntry[] {
    let filteredLogs = [...this.logs];

    if (options?.level) {
      filteredLogs = filteredLogs.filter(log => log.level === options.level);
    }

    if (options?.category) {
      filteredLogs = filteredLogs.filter(log => log.category === options.category);
    }

    if (options?.startDate) {
      filteredLogs = filteredLogs.filter(log => new Date(log.timestamp) >= options.startDate!);
    }

    if (options?.endDate) {
      filteredLogs = filteredLogs.filter(log => new Date(log.timestamp) <= options.endDate!);
    }

    const limit = options?.limit || filteredLogs.length;
    return filteredLogs.slice(-limit);
  }

  clearLogs() {
    this.logs = [];
  }

  getStats() {
    const stats = {
      total: this.logs.length,
      byLevel: {} as Record<LogLevel, number>,
      byCategory: {} as Record<string, number>,
      recentErrors: this.logs
        .filter(log => log.level === LogLevel.ERROR || log.level === LogLevel.CRITICAL)
        .slice(-10),
    };

    for (const log of this.logs) {
      stats.byLevel[log.level] = (stats.byLevel[log.level] || 0) + 1;
      stats.byCategory[log.category] = (stats.byCategory[log.category] || 0) + 1;
    }

    return stats;
  }
}

export const productionLogger = new ProductionLogger({
  maxLogs: 2000,
  enableConsole: true,
});

export function createETLLogger(etlName: string) {
  return {
    info: (message: string, context?: Record<string, any>) => 
      productionLogger.info(`ETL:${etlName}`, message, { context }),
    
    warn: (message: string, context?: Record<string, any>, error?: Error) => 
      productionLogger.warn(`ETL:${etlName}`, message, { context, error }),
    
    error: (message: string, context?: Record<string, any>, error?: Error) => 
      productionLogger.error(`ETL:${etlName}`, message, { context, error }),
    
    critical: (message: string, context?: Record<string, any>, error?: Error) => 
      productionLogger.critical(`ETL:${etlName}`, message, { context, error }),
  };
}
