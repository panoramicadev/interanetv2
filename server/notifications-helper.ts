import { db } from './db';
import { notifications } from '@shared/schema';
import { nanoid } from 'nanoid';

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

export async function createAutoNotification(data: NotificationData) {
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
    return notificationId;
  } catch (error) {
    console.error('Error creando notificación automática:', error);
    return null;
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
  });
}

