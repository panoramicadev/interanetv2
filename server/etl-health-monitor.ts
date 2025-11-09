/**
 * ETL Health Monitor
 * 
 * Sistema de monitoreo automático que verifica el health check
 * endpoint HTTP y genera alertas cuando detecta problemas en producción.
 * 
 * IMPORTANTE: Este monitor llama al endpoint /api/health via HTTP para
 * validar toda la stack (Express, routing, middleware, etc.), no solo la DB.
 */

import { db } from './db';
import { sql } from 'drizzle-orm';

interface HealthStatus {
  status: string;
  database: {
    connected: boolean;
  };
  etl: {
    healthy: boolean;
    warnings: string[];
    lastExecution?: any;
  };
  sqlServer: {
    circuitBreaker: {
      state: string;
      healthy: boolean;
      failures: number;
    };
  };
  dataQuality: {
    healthy: boolean;
    warnings: string[];
  };
}

// Estado anterior para detectar cambios
let previousHealth: HealthStatus | null = null;
let consecutiveFailures = 0;
const FAILURE_THRESHOLD = 3; // Alertar después de 3 fallos consecutivos

/**
 * Verifica el estado del sistema llamando al endpoint HTTP /api/health
 * Esto valida toda la stack (Express, routing, middleware, DB, ETL)
 */
export async function checkSystemHealth(): Promise<HealthStatus> {
  try {
    const port = parseInt(process.env.PORT || '5000', 10);
    const healthUrl = `http://localhost:${port}/api/health`;
    
    // Call health endpoint via HTTP (validates entire stack)
    const response = await fetch(healthUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });
    
    // Parse response
    let currentHealth: HealthStatus;
    
    if (response.ok) {
      // HTTP 200 - system healthy
      currentHealth = await response.json();
    } else if (response.status === 503) {
      // HTTP 503 - system degraded
      currentHealth = await response.json();
    } else {
      // Unexpected status - treat as degraded
      console.error(`[HEALTH-MONITOR] Unexpected HTTP status: ${response.status}`);
      currentHealth = {
        status: 'degraded',
        database: { connected: false },
        etl: { healthy: false, warnings: ['Health endpoint returned unexpected status'] },
        sqlServer: { circuitBreaker: { state: 'UNKNOWN', healthy: false, failures: 0 } },
        dataQuality: { healthy: false, warnings: ['Unable to verify'] }
      };
    }
    
    // Detect state changes and generate alerts
    await detectAndAlert(currentHealth, response.status);
    
    previousHealth = currentHealth;
    return currentHealth;
    
  } catch (error: any) {
    // Network error or health endpoint unreachable
    console.error('[HEALTH-MONITOR] Error calling health endpoint:', error.message);
    
    const degradedHealth: HealthStatus = {
      status: 'degraded',
      database: { connected: false },
      etl: { healthy: false, warnings: ['Health endpoint unreachable'] },
      sqlServer: { circuitBreaker: { state: 'UNKNOWN', healthy: false, failures: 0 } },
      dataQuality: { healthy: false, warnings: ['Unable to verify'] }
    };
    
    await detectAndAlert(degradedHealth, 0);
    previousHealth = degradedHealth;
    
    return degradedHealth;
  }
}

/**
 * Detecta cambios de estado y genera alertas
 */
async function detectAndAlert(currentHealth: HealthStatus, httpStatus: number) {
  try {
    const warnings: string[] = [];
    let severity: 'critical' | 'warning' | 'info' = 'info';
    
    // HTTP STATUS CHECK (validates entire stack)
    if (httpStatus === 0) {
      warnings.push('🔴 Health endpoint unreachable - Express/Vite posiblemente caído');
      severity = 'critical';
      consecutiveFailures++;
    } else if (httpStatus !== 200 && httpStatus !== 503) {
      warnings.push(`⚠️ Health endpoint retornó código inesperado: ${httpStatus}`);
      if (severity !== 'critical') severity = 'warning';
      consecutiveFailures++;
    }
    
    // DATABASE ISSUES
    if (!currentHealth.database.connected) {
      warnings.push('❌ Base de datos PostgreSQL desconectada');
      severity = 'critical';
      consecutiveFailures++;
    }
    
    // ETL ISSUES
    if (!currentHealth.etl.healthy) {
      warnings.push(...currentHealth.etl.warnings.map(w => `⚠️ ETL: ${w}`));
      if (severity !== 'critical') severity = 'warning';
      consecutiveFailures++;
    }
    
    // CIRCUIT BREAKER OPEN
    if (currentHealth.sqlServer.circuitBreaker.state === 'OPEN') {
      warnings.push(`🔴 Circuit Breaker ABIERTO - SQL Server inaccesible (${currentHealth.sqlServer.circuitBreaker.failures} fallos)`);
      severity = 'critical';
      consecutiveFailures++;
    } else if (currentHealth.sqlServer.circuitBreaker.state === 'HALF_OPEN') {
      warnings.push('⚠️ Circuit Breaker en HALF_OPEN - SQL Server recuperándose');
      if (severity === 'info') severity = 'warning';
    }
    
    // DATA QUALITY ISSUES
    if (!currentHealth.dataQuality.healthy) {
      warnings.push(...currentHealth.dataQuality.warnings.map(w => `⚠️ Calidad de Datos: ${w}`));
      if (severity === 'info') severity = 'warning';
    }
    
    // Generate alert only if:
    // 1. System is degraded
    // 2. State changed from healthy to degraded
    // 3. After FAILURE_THRESHOLD consecutive failures
    const systemDegraded = currentHealth.status === 'degraded';
    const stateChanged = !previousHealth || previousHealth.status !== currentHealth.status;
    
    if (systemDegraded && (stateChanged || consecutiveFailures >= FAILURE_THRESHOLD)) {
      await createAlert({
        title: severity === 'critical' ? '🚨 Sistema ETL CRÍTICO' : '⚠️ Alerta Sistema ETL',
        message: warnings.join('\n'),
        severity,
        health: currentHealth
      });
      
      // Reset counter after alerting
      if (consecutiveFailures >= FAILURE_THRESHOLD) {
        consecutiveFailures = 0;
      }
    } else if (currentHealth.status === 'healthy' && previousHealth?.status === 'degraded') {
      // System recovered
      await createAlert({
        title: '✅ Sistema ETL Recuperado',
        message: 'El sistema ha vuelto a estado saludable',
        severity: 'info',
        health: currentHealth
      });
      consecutiveFailures = 0;
    } else if (currentHealth.status === 'healthy') {
      // Reset failure counter if system is healthy
      consecutiveFailures = 0;
    }
    
  } catch (error: any) {
    console.error('[HEALTH-MONITOR] Error detecting/alerting:', error.message);
  }
}

/**
 * Crea una notificación de alerta en el sistema
 */
async function createAlert(alert: {
  title: string;
  message: string;
  severity: 'critical' | 'warning' | 'info';
  health: HealthStatus;
}) {
  try {
    console.log(`[HEALTH-MONITOR] ${alert.severity.toUpperCase()}: ${alert.title}`);
    console.log(`[HEALTH-MONITOR] ${alert.message}`);
    
    // Create internal notification for admins
    await db.execute(sql`
      INSERT INTO notifications (
        user_id,
        title,
        message,
        type,
        created_at
      )
      SELECT 
        id,
        ${alert.title},
        ${alert.message},
        'system',
        NOW()
      FROM users
      WHERE role = 'admin'
    `);
    
    console.log(`[HEALTH-MONITOR] ✅ Notificación creada para administradores`);
    
  } catch (error: any) {
    console.error('[HEALTH-MONITOR] Error creating alert notification:', error.message);
  }
}

/**
 * Inicia el monitor de salud con intervalo configurable
 */
export function startHealthMonitor(intervalMinutes: number = 10) {
  const intervalMs = intervalMinutes * 60 * 1000;
  
  console.log(`🏥 Health Monitor iniciado (intervalo: ${intervalMinutes} minutos)`);
  
  // Run initial check after 2 minutes (give system time to start)
  setTimeout(async () => {
    try {
      console.log('[HEALTH-MONITOR] Ejecutando verificación inicial...');
      await checkSystemHealth();
    } catch (error: any) {
      console.error('[HEALTH-MONITOR] Error en verificación inicial:', error.message);
    }
  }, 120000);
  
  // Run periodically
  setInterval(async () => {
    try {
      console.log('[HEALTH-MONITOR] Ejecutando verificación periódica...');
      await checkSystemHealth();
    } catch (error: any) {
      console.error('[HEALTH-MONITOR] Error en verificación periódica:', error.message);
    }
  }, intervalMs);
}
