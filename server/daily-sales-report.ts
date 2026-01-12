import { db } from "./db";
import { 
  salesTransactions, 
  users, 
  emailNotificationSettings,
  emailLogs
} from "@shared/schema";
import { eq, sql, and, gte, lte, inArray } from "drizzle-orm";
import { emailService } from "./services/email";
import { wrapEmailContent } from "./email-templates";
import { toZonedTime, format as formatTZ } from "date-fns-tz";

const CHILE_TIMEZONE = 'America/Santiago';
const REPORT_HOUR = 17;
const REPORT_MINUTE = 30;

interface SegmentSales {
  segment: string;
  total: number;
  count: number;
}

interface SalespersonSales {
  salesperson: string;
  segment: string;
  total: number;
  count: number;
}

async function isReportEnabled(): Promise<boolean> {
  try {
    const settings = await db.select()
      .from(emailNotificationSettings)
      .where(eq(emailNotificationSettings.notificationType, 'reporte_diario_ventas'));
    
    return settings.length > 0 && settings[0].enabled === true;
  } catch (error) {
    console.error('[DAILY-REPORT] Error checking if report is enabled:', error);
    return false;
  }
}

async function getSupervisorsAndAdmins(): Promise<string[]> {
  try {
    const usersWithRoles = await db.select({
      email: users.email
    })
    .from(users)
    .where(
      and(
        eq(users.isActive, true),
        inArray(users.role, ['admin', 'supervisor'])
      )
    );
    
    return usersWithRoles
      .map(u => u.email)
      .filter((email): email is string => email !== null && email.length > 0);
  } catch (error) {
    console.error('[DAILY-REPORT] Error getting supervisors and admins:', error);
    return [];
  }
}

async function getTodaySales(): Promise<{
  bySegment: SegmentSales[];
  bySalesperson: SalespersonSales[];
  grandTotal: number;
  transactionCount: number;
}> {
  const now = toZonedTime(new Date(), CHILE_TIMEZONE);
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);
  
  console.log(`[DAILY-REPORT] Getting sales from ${todayStart.toISOString()} to ${todayEnd.toISOString()}`);
  
  try {
    const salesBySegment = await db.select({
      segment: salesTransactions.segment,
      total: sql<number>`COALESCE(SUM(${salesTransactions.totalAmount}), 0)`.as('total'),
      count: sql<number>`COUNT(*)`.as('count')
    })
    .from(salesTransactions)
    .where(
      and(
        gte(salesTransactions.transactionDate, todayStart),
        lte(salesTransactions.transactionDate, todayEnd)
      )
    )
    .groupBy(salesTransactions.segment);

    const salesBySalesperson = await db.select({
      salesperson: salesTransactions.salespersonName,
      segment: salesTransactions.segment,
      total: sql<number>`COALESCE(SUM(${salesTransactions.totalAmount}), 0)`.as('total'),
      count: sql<number>`COUNT(*)`.as('count')
    })
    .from(salesTransactions)
    .where(
      and(
        gte(salesTransactions.transactionDate, todayStart),
        lte(salesTransactions.transactionDate, todayEnd)
      )
    )
    .groupBy(salesTransactions.salespersonName, salesTransactions.segment)
    .orderBy(sql`SUM(${salesTransactions.totalAmount}) DESC`);

    const grandTotal = salesBySegment.reduce((sum, s) => sum + (Number(s.total) || 0), 0);
    const transactionCount = salesBySegment.reduce((sum, s) => sum + (Number(s.count) || 0), 0);

    return {
      bySegment: salesBySegment.map(s => ({
        segment: s.segment || 'Sin Segmento',
        total: Number(s.total) || 0,
        count: Number(s.count) || 0
      })),
      bySalesperson: salesBySalesperson.map(s => ({
        salesperson: s.salesperson || 'Sin Vendedor',
        segment: s.segment || 'Sin Segmento',
        total: Number(s.total) || 0,
        count: Number(s.count) || 0
      })),
      grandTotal,
      transactionCount
    };
  } catch (error) {
    console.error('[DAILY-REPORT] Error getting today sales:', error);
    return { bySegment: [], bySalesperson: [], grandTotal: 0, transactionCount: 0 };
  }
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

function generateReportHTML(sales: {
  bySegment: SegmentSales[];
  bySalesperson: SalespersonSales[];
  grandTotal: number;
  transactionCount: number;
}, dateStr: string): string {
  const segmentRows = sales.bySegment
    .sort((a, b) => b.total - a.total)
    .map(s => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: 500;">${s.segment}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">${s.count}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right; font-weight: 600; color: #2563eb;">${formatCurrency(s.total)}</td>
      </tr>
    `).join('');

  const salespersonRows = sales.bySalesperson
    .slice(0, 15)
    .map(s => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${s.salesperson}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${s.segment}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${s.count}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right; font-weight: 500;">${formatCurrency(s.total)}</td>
      </tr>
    `).join('');

  return wrapEmailContent(`
    <div style="text-align: center; margin-bottom: 30px;">
      <h1 style="color: #1e3a8a; margin: 0; font-size: 24px;">Reporte Diario de Ventas</h1>
      <p style="color: #6b7280; margin: 10px 0 0 0; font-size: 16px;">${dateStr}</p>
    </div>

    <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); color: white; padding: 25px; border-radius: 12px; margin-bottom: 25px; text-align: center;">
      <p style="margin: 0 0 5px 0; font-size: 14px; opacity: 0.9;">Total del Día</p>
      <p style="margin: 0; font-size: 36px; font-weight: 700;">${formatCurrency(sales.grandTotal)}</p>
      <p style="margin: 10px 0 0 0; font-size: 14px; opacity: 0.9;">${sales.transactionCount} transacciones</p>
    </div>

    <h2 style="color: #374151; font-size: 18px; margin: 25px 0 15px 0; padding-bottom: 10px; border-bottom: 2px solid #e5e7eb;">
      Ventas por Segmento
    </h2>
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px;">
      <thead>
        <tr style="background: #f3f4f6;">
          <th style="padding: 12px 10px; text-align: left; font-weight: 600; color: #374151;">Segmento</th>
          <th style="padding: 12px 10px; text-align: right; font-weight: 600; color: #374151;">Transacciones</th>
          <th style="padding: 12px 10px; text-align: right; font-weight: 600; color: #374151;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${segmentRows || '<tr><td colspan="3" style="padding: 20px; text-align: center; color: #9ca3af;">Sin ventas registradas</td></tr>'}
      </tbody>
    </table>

    <h2 style="color: #374151; font-size: 18px; margin: 25px 0 15px 0; padding-bottom: 10px; border-bottom: 2px solid #e5e7eb;">
      Top 15 Vendedores del Día
    </h2>
    <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
      <thead>
        <tr style="background: #f3f4f6;">
          <th style="padding: 10px 8px; text-align: left; font-weight: 600; color: #374151;">Vendedor</th>
          <th style="padding: 10px 8px; text-align: left; font-weight: 600; color: #374151;">Segmento</th>
          <th style="padding: 10px 8px; text-align: right; font-weight: 600; color: #374151;">Trans.</th>
          <th style="padding: 10px 8px; text-align: right; font-weight: 600; color: #374151;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${salespersonRows || '<tr><td colspan="4" style="padding: 20px; text-align: center; color: #9ca3af;">Sin vendedores registrados</td></tr>'}
      </tbody>
    </table>

    <div style="margin-top: 30px; padding: 15px; background: #f0f9ff; border-radius: 8px; text-align: center;">
      <p style="margin: 0; color: #0369a1; font-size: 13px;">
        Este reporte se genera automáticamente a las 17:30 después de la sincronización de datos.
      </p>
    </div>
  `);
}

export async function sendDailySalesReport(): Promise<void> {
  console.log('[DAILY-REPORT] Starting daily sales report generation...');
  
  try {
    const enabled = await isReportEnabled();
    if (!enabled) {
      console.log('[DAILY-REPORT] Report is disabled, skipping');
      return;
    }

    const recipients = await getSupervisorsAndAdmins();
    if (recipients.length === 0) {
      console.log('[DAILY-REPORT] No supervisors or admins found, skipping');
      return;
    }

    console.log(`[DAILY-REPORT] Sending to ${recipients.length} recipients: ${recipients.join(', ')}`);

    const sales = await getTodaySales();
    const now = toZonedTime(new Date(), CHILE_TIMEZONE);
    const dateStr = formatTZ(now, "EEEE d 'de' MMMM 'de' yyyy", { 
      timeZone: CHILE_TIMEZONE,
      locale: require('date-fns/locale/es').es
    });

    const htmlContent = generateReportHTML(sales, dateStr);
    const subject = `Reporte Diario de Ventas - ${formatTZ(now, 'dd/MM/yyyy', { timeZone: CHILE_TIMEZONE })}`;

    for (const recipient of recipients) {
      try {
        const success = await emailService.sendEmail({
          to: recipient,
          subject,
          html: htmlContent
        });
        
        if (success) {
          console.log(`[DAILY-REPORT] Report sent successfully to ${recipient}`);
          await db.insert(emailLogs).values({
            recipient,
            subject,
            notificationType: 'reporte_diario_ventas',
            status: 'sent',
            sentAt: new Date(),
            createdAt: new Date()
          });
        } else {
          throw new Error('Email service returned false');
        }
      } catch (error: any) {
        console.error(`[DAILY-REPORT] Failed to send report to ${recipient}:`, error.message);
        
        await db.insert(emailLogs).values({
          recipient,
          subject,
          notificationType: 'reporte_diario_ventas',
          status: 'failed',
          errorMessage: error.message,
          createdAt: new Date()
        });
      }
    }

    console.log('[DAILY-REPORT] Daily sales report completed');
  } catch (error: any) {
    console.error('[DAILY-REPORT] Error generating report:', error.message);
  }
}

function getMillisecondsUntilNextReport(): number {
  const now = toZonedTime(new Date(), CHILE_TIMEZONE);
  const targetTime = new Date(now);
  targetTime.setHours(REPORT_HOUR, REPORT_MINUTE, 0, 0);

  if (now >= targetTime) {
    targetTime.setDate(targetTime.getDate() + 1);
  }

  return targetTime.getTime() - now.getTime();
}

export function startDailySalesReportScheduler(): void {
  const msUntilNextReport = getMillisecondsUntilNextReport();
  const hoursUntil = Math.floor(msUntilNextReport / (1000 * 60 * 60));
  const minutesUntil = Math.floor((msUntilNextReport % (1000 * 60 * 60)) / (1000 * 60));

  console.log(`[DAILY-REPORT] Scheduler initialized - next report in ${hoursUntil}h ${minutesUntil}m (17:30 Chile time)`);

  setTimeout(() => {
    sendDailySalesReport();

    setInterval(() => {
      sendDailySalesReport();
    }, 24 * 60 * 60 * 1000);
  }, msUntilNextReport);
}
