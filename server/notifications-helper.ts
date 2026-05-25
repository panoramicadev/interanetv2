import { db } from './db';
import { notifications, emailNotificationSettings, emailLogs } from '@shared/schema';
import { nanoid } from 'nanoid';
import { emailService } from './services/email';
import { wrapEmailContent } from './email-templates';
import { eq } from 'drizzle-orm';

interface NotificationData {
  targetType: 'general' | 'personal' | 'departamento';
  title: string;
  message: string;
  priority: 'baja' | 'media' | 'alta' | 'critica';
  targetUserId?: string;
  targetDepartment?: string;
  actionUrl?: string;
  createdByName: string;
}

export async function createAutoNotification(data: NotificationData & { emailNotificationType?: string }) {
  try {
    const result = await db.insert(notifications).values({
      userId: data.targetUserId || null,
      targetType: data.targetType,
      department: data.targetDepartment || null,
      type: 'auto_system',
      title: data.title,
      message: data.message,
      priority: data.priority,
      actionUrl: data.actionUrl || null,
      createdBy: 'system',
      createdByName: data.createdByName,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 días
      isArchived: false,
    }).returning({ id: notifications.id });

    const notificationId = result[0]?.id;
    console.log(`✅ Notificación automática creada: ${data.title}`);

    // Send email notification if configured
    if (data.emailNotificationType) {
      await sendEmailForNotification(data.emailNotificationType, data.title, data.message);
    }

    return notificationId;
  } catch (error) {
    console.error('Error creando notificación automática:', error);
    return null;
  }
}

/**
 * Checks email_notification_settings for the given type and sends emails
 * to configured recipients if enabled.
 */
async function sendEmailForNotification(notificationType: string, title: string, message: string) {
  try {
    const settings = await db.select()
      .from(emailNotificationSettings)
      .where(eq(emailNotificationSettings.notificationType, notificationType));
    
    const setting = settings[0];
    if (!setting || !setting.enabled || !setting.recipients) {
      return; // Not enabled or no recipients
    }

    const recipients = setting.recipients.split(',').map(e => e.trim()).filter(Boolean);
    if (recipients.length === 0) return;

    // Clean emoji from title for email subject
    const cleanTitle = title.replace(/[\u{1F600}-\u{1F6FF}\u{2600}-\u{2B55}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F900}-\u{1F9FF}]/gu, '').trim();
    const subject = `${cleanTitle} - Panorámica`;

    const priorityColors: Record<string, string> = {
      critica: '#dc2626',
      alta: '#ea580c',
      media: '#2563eb',
      baja: '#6b7280',
    };

    const htmlBody = wrapEmailContent(`
      <h2 style="color: #1a1f2e; margin: 0 0 20px 0; font-family: Arial, sans-serif;">
        ${title}
      </h2>
      <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
        ${message}
      </p>
      <div style="background-color: #f0f9ff; border-left: 4px solid #2196f3; padding: 15px; border-radius: 4px; margin: 20px 0;">
        <p style="color: #0369a1; margin: 0; font-size: 13px;">
          Este es un correo automático generado por el sistema de notificaciones Panorámica.
        </p>
      </div>
    `);

    const ccRecipients = setting.ccRecipients
      ? setting.ccRecipients.split(',').map(e => e.trim()).filter(Boolean).join(', ')
      : undefined;

    for (const recipient of recipients) {
      try {
        await emailService.sendEmail({
          to: recipient,
          cc: ccRecipients,
          subject,
          html: htmlBody,
        });

        await db.insert(emailLogs).values({
          recipient,
          subject,
          notificationType,
          status: 'sent',
          sentAt: new Date(),
          createdAt: new Date(),
        });

        console.log(`📧 Email de notificación enviado a ${recipient} (tipo: ${notificationType})`);
      } catch (error: any) {
        console.error(`❌ Error enviando email a ${recipient}:`, error.message);
        await db.insert(emailLogs).values({
          recipient,
          subject,
          notificationType,
          status: 'failed',
          errorMessage: error.message,
          createdAt: new Date(),
        });
      }
    }
  } catch (error) {
    console.error('Error en sendEmailForNotification:', error);
  }
}

// Notificaciones para Reclamos Generales
export async function notifyReclamoCreated(reclamoId: string, motivo: string, clientName: string, createdBy: string) {
  await createAutoNotification({
    targetType: 'general',
    title: '🔔 Nuevo Reclamo Registrado',
    message: `Cliente ${clientName} ha reportado: ${motivo}`,
    priority: 'alta',
    actionUrl: `/reclamos-generales`,
    createdByName: `Sistema - ${createdBy}`,
    emailNotificationType: 'reclamo_nuevo',
  });
}

export async function notifyReclamoAsignado(reclamoId: string, areaResponsable: string, motivo: string) {
  const departmentMap: Record<string, string> = {
    'produccion': 'Producción',
    'laboratorio': 'Laboratorio',
    'logistica': 'Logística',
    'aplicacion': 'Aplicación',
  };

  await createAutoNotification({
    targetType: 'departamento',
    title: '⚠️ Reclamo Asignado a tu Área',
    message: `Nuevo reclamo asignado: ${motivo}`,
    priority: 'alta',
    targetDepartment: departmentMap[areaResponsable] || areaResponsable,
    actionUrl: `/reclamos-generales`,
    createdByName: 'Sistema - Validación Técnica',
  });
}

export async function notifyReclamoResuelto(reclamoId: string, motivo: string, areaResponsable: string) {
  await createAutoNotification({
    targetType: 'general',
    title: '✅ Reclamo Resuelto',
    message: `Reclamo de ${motivo} ha sido resuelto por ${areaResponsable}`,
    priority: 'media',
    actionUrl: `/reclamos-generales`,
    createdByName: 'Sistema - Resolución',
  });
}

// Notificaciones para Mantención
export async function notifyMantencionCreada(equipmentName: string, severity: string, createdBy: string) {
  const priorityMap: Record<string, 'baja' | 'media' | 'alta' | 'critica'> = {
    'baja': 'baja',
    'media': 'media',
    'alta': 'alta',
    'critica': 'critica',
  };

  await createAutoNotification({
    targetType: 'departamento',
    title: '🔧 Nueva Solicitud de Mantención',
    message: `Equipo ${equipmentName} requiere mantención (${severity})`,
    priority: priorityMap[severity] || 'media',
    targetDepartment: 'Producción',
    actionUrl: `/mantenciones`,
    createdByName: `Sistema - ${createdBy}`,
    emailNotificationType: 'mantencion_preventiva',
  });
}

export async function notifyMantencionResuelta(equipmentName: string, assignedTo: string) {
  await createAutoNotification({
    targetType: 'general',
    title: '✅ Mantención Completada',
    message: `Mantención de ${equipmentName} completada por ${assignedTo}`,
    priority: 'media',
    actionUrl: `/mantenciones`,
    createdByName: 'Sistema - Mantención',
  });
}

/**
 * Sends a customer-facing automated email if the given notification type is enabled.
 * Uses emailNotificationSettings.ccRecipients as CC. Logs to emailLogs.
 */
export async function sendAutoCustomerEmail(opts: {
  notificationType: string;
  to: string;
  subject: string;
  html: string;
  force?: boolean;
}): Promise<boolean> {
  const TAG = `[auto-email:${opts.notificationType}]`;
  if (!opts.to) {
    console.log(`${TAG} sin destinatario, saltando`);
    return false;
  }
  try {
    const settings = await db.select()
      .from(emailNotificationSettings)
      .where(eq(emailNotificationSettings.notificationType, opts.notificationType));
    const setting = settings[0];
    // `force` lo usa un envío manual explícito (botón en la ficha del pedido): ignora el toggle global.
    if (!opts.force && (!setting || !setting.enabled)) {
      console.log(`${TAG} deshabilitado o no configurado, saltando`);
      return false;
    }
    const cc = setting?.ccRecipients
      ? setting.ccRecipients.split(',').map(s => s.trim()).filter(Boolean).join(', ')
      : undefined;

    await emailService.sendEmail({ to: opts.to, cc, subject: opts.subject, html: opts.html });
    await db.insert(emailLogs).values({
      recipient: [opts.to, cc].filter(Boolean).join(' | '),
      subject: opts.subject,
      notificationType: opts.notificationType,
      status: 'sent',
      sentAt: new Date(),
      createdAt: new Date(),
    });
    console.log(`${TAG} ✅ enviado a ${opts.to}${cc ? ` (cc: ${cc})` : ''}`);
    return true;
  } catch (error: any) {
    console.error(`${TAG} ❌ error:`, error?.message);
    try {
      await db.insert(emailLogs).values({
        recipient: opts.to,
        subject: opts.subject,
        notificationType: opts.notificationType,
        status: 'failed',
        errorMessage: error?.message || 'Error desconocido',
        createdAt: new Date(),
      });
    } catch {}
    return false;
  }
}

// Notificaciones para E-commerce
export async function notifyNuevaOrden(orderNumber: string, clientName: string, total: number) {
  await createAutoNotification({
    targetType: 'departamento',
    title: '🛒 Nueva Orden de E-commerce',
    message: `Cliente ${clientName} - Orden #${orderNumber} - Total: $${total.toLocaleString('es-CL')}`,
    priority: 'alta',
    targetDepartment: 'Logística',
    actionUrl: `/ecommerce`,
    createdByName: 'Sistema - E-commerce',
    emailNotificationType: 'pedido_nuevo',
  });
}

interface OrderModifiedNotifyOpts {
  orderId: string;
  orderNumber: string;
  clientEmail?: string | null;
  clientName?: string | null;
  newTotal: number;
  previousTotal?: number;
  paymentCondition?: string | null;
}

export async function notifyOrderModified(opts: OrderModifiedNotifyOpts, force = false): Promise<boolean> {
  if (!opts.clientEmail) {
    console.log(`[notifyOrderModified] orden ${opts.orderNumber} sin email de cliente, saltando`);
    return false;
  }
  try {
    const { buildOrderModifiedEmail } = await import('./email-templates');
    const cond = (opts.paymentCondition || '').toUpperCase();
    const isCredit = cond.includes('CREDITO') || cond.includes('CRÉDITO');
    const requiresReceiptUpdate = !isCredit;
    const base = (process.env.PUBLIC_BASE_URL || 'https://ai.pinturaspanoramica.cl').replace(/\/$/, '');
    // Link directo al pedido: el portal del cliente lo auto-abre al leer ?pedido=<id>.
    const orderUrl = `${base}/mis-pedidos?pedido=${encodeURIComponent(opts.orderId)}`;
    // Número legible (#4511012) derivado del UUID, igual que getNumericOrderId en el front.
    const displayNumber = opts.orderId.includes('-')
      ? String(parseInt(opts.orderId.replace(/-/g, '').substring(0, 6), 16) || opts.orderNumber)
      : opts.orderNumber;
    const built = buildOrderModifiedEmail({
      clientName: opts.clientName || 'Cliente',
      orderNumber: displayNumber,
      newTotal: opts.newTotal,
      previousTotal: opts.previousTotal,
      paymentCondition: opts.paymentCondition || undefined,
      requiresReceiptUpdate,
      orderUrl,
    });
    return await sendAutoCustomerEmail({
      notificationType: 'pedido_modificado',
      to: opts.clientEmail,
      subject: built.subject,
      html: built.html,
      force,
    });
  } catch (err: any) {
    console.warn(`[notifyOrderModified] error enviando email para orden ${opts.orderNumber}:`, err?.message);
    return false;
  }
}

// Notificaciones para Solicitudes de Catálogo Público
export async function notifySolicitudCatalogo(
  visitorName: string,
  visitorEmail: string,
  visitorCompany: string | undefined,
  salespersonName: string,
  itemCount: number
) {
  const companyPart = visitorCompany ? ` (${visitorCompany})` : '';
  await createAutoNotification({
    targetType: 'departamento',
    title: '📋 Nueva Solicitud de Catálogo',
    message: `${visitorName}${companyPart} solicitó cotización de ${itemCount} producto(s) al catálogo de ${salespersonName}. Contacto: ${visitorEmail}`,
    priority: 'alta',
    targetDepartment: 'Ventas',
    actionUrl: `/ecommerce-pedidos`,
    createdByName: 'Sistema - Catálogo Público',
    emailNotificationType: 'solicitud_catalogo',
  });
}

// Notificaciones para Gastos Empresariales
export async function notifyGastoCreado(categoria: string, monto: number, createdBy: string) {
  await createAutoNotification({
    targetType: 'departamento',
    title: '💰 Nuevo Gasto Registrado',
    message: `${createdBy} ha registrado un gasto de ${categoria} por $${monto.toLocaleString('es-CL')}`,
    priority: 'media',
    targetDepartment: 'Finanzas',
    actionUrl: `/gastos-empresariales`,
    createdByName: `Sistema - ${createdBy}`,
  });
}

export async function notifyGastoAprobado(categoria: string, monto: number, solicitante: string) {
  await createAutoNotification({
    targetType: 'personal',
    title: '✅ Gasto Aprobado',
    message: `Tu gasto de ${categoria} por $${monto.toLocaleString('es-CL')} ha sido aprobado`,
    priority: 'media',
    actionUrl: `/gastos-empresariales`,
    createdByName: 'Sistema - Aprobación',
  });
}

export async function notifyGastoRechazado(categoria: string, monto: number, motivo: string) {
  await createAutoNotification({
    targetType: 'personal',
    title: '❌ Gasto Rechazado',
    message: `Tu gasto de ${categoria} por $${monto.toLocaleString('es-CL')} fue rechazado. Motivo: ${motivo}`,
    priority: 'alta',
    actionUrl: `/gastos-empresariales`,
    createdByName: 'Sistema - Revisión',
  });
}

// Notificaciones para Inventario
export async function notifyStockBajo(productName: string, stock: number, minStock: number) {
  await createAutoNotification({
    targetType: 'departamento',
    title: '⚠️ Alerta de Stock Bajo',
    message: `Producto ${productName} tiene stock bajo: ${stock} unidades (mínimo: ${minStock})`,
    priority: 'alta',
    targetDepartment: 'Logística',
    actionUrl: `/inventario`,
    createdByName: 'Sistema - Inventario',
    emailNotificationType: 'stock_bajo',
  });
}

// Notificaciones para Marketing
export async function notifySolicitudMarketing(titulo: string, presupuesto: number, createdBy: string) {
  await createAutoNotification({
    targetType: 'departamento',
    title: '📢 Nueva Solicitud de Marketing',
    message: `${titulo} - Presupuesto solicitado: $${presupuesto.toLocaleString('es-CL')}`,
    priority: 'media',
    targetDepartment: 'Ventas',
    actionUrl: `/marketing`,
    createdByName: `Sistema - ${createdBy}`,
  });
}

// Notificaciones para Visitas Técnicas
export async function notifyVisitaTecnicaCreada(clientName: string, visitType: string, createdBy: string) {
  await createAutoNotification({
    targetType: 'general',
    title: '🔧 Nueva Visita Técnica Programada',
    message: `Cliente: ${clientName} - Tipo: ${visitType}`,
    priority: 'media',
    actionUrl: `/visitas-tecnicas`,
    createdByName: `Sistema - ${createdBy}`,
    emailNotificationType: 'visita_tecnica',
  });
}

