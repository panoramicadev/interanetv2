/**
 * Conversación de los reclamos: mensajes, no leídos y avisos.
 * ---------------------------------------------------------------
 * Lo usan la intranet (server/routes.ts) y el asistente
 * (server/routes-external.ts), así los dos cuentan los no leídos igual y
 * avisan a las mismas personas.
 */
import { and, eq, inArray, isNull, ne, or, sql } from 'drizzle-orm';
import { db } from '../db';
import { storage } from '../storage';
import {
  notificationReads,
  notifications,
  reclamosGenerales,
  reclamosGeneralesMensajes,
  reclamosMensajesLecturas,
  users,
} from '@shared/schema';
import * as NotifyHelper from '../notifications-helper';
import { sendPushForNotification } from '../push';

interface Persona { id: string; role?: string | null }

/**
 * Áreas que tienen un reclamo en su cola: la actual y su equivalente operativa
 * (p. ej. "envase" lo atiende Logística). Misma regla para avisar y para contar.
 */
export async function areasDelReclamo(reclamo: {
  areaResponsableActual?: string | null;
  categoriaResponsable?: string | null;
  areaAsignadaInicial?: string | null;
}) {
  const { mapToOperativeArea, normalizeAreaName } = await import('@shared/reclamosAreas');
  const area = reclamo.areaResponsableActual || reclamo.categoriaResponsable || reclamo.areaAsignadaInicial;
  return new Set<string | null>([normalizeAreaName(area), mapToOperativeArea(area)].filter(Boolean));
}

/**
 * Mensajes de reclamos que la persona todavía no lee: total y por reclamo.
 * Sale de los mensajes mismos (no de los avisos de la campana), así cuentan
 * también los que llegaron antes de que existieran los avisos. No leído = lo
 * que escribió otro después de la última vez que la persona abrió esa
 * conversación, en reclamos donde está metida (los mismos a quienes se avisa).
 */
export async function contarMensajesSinLeer(yo: Persona): Promise<{ count: number; porReclamo: Record<string, number> }> {
  const filas = await db
    .select({ reclamoId: reclamosGeneralesMensajes.reclamoId, n: sql<number>`count(*)::int` })
    .from(reclamosGeneralesMensajes)
    .leftJoin(
      reclamosMensajesLecturas,
      and(
        eq(reclamosMensajesLecturas.reclamoId, reclamosGeneralesMensajes.reclamoId),
        eq(reclamosMensajesLecturas.userId, yo.id),
      ),
    )
    .where(and(
      ne(reclamosGeneralesMensajes.userId, yo.id),
      or(
        isNull(reclamosMensajesLecturas.id),
        sql`${reclamosGeneralesMensajes.createdAt} > ${reclamosMensajesLecturas.leidoHasta}`,
      ),
    ))
    .groupBy(reclamosGeneralesMensajes.reclamoId);
  if (filas.length === 0) return { count: 0, porReclamo: {} };

  const { getRoleArea } = await import('@shared/reclamosAreas');
  const ids = filas.map((f) => f.reclamoId);
  const reclamos = await db
    .select({
      id: reclamosGenerales.id,
      vendedorId: reclamosGenerales.vendedorId,
      tecnicoId: reclamosGenerales.tecnicoId,
      responsableAreaId: reclamosGenerales.responsableAreaId,
      areaResponsableActual: reclamosGenerales.areaResponsableActual,
      categoriaResponsable: reclamosGenerales.categoriaResponsable,
      areaAsignadaInicial: reclamosGenerales.areaAsignadaInicial,
    })
    .from(reclamosGenerales)
    .where(inArray(reclamosGenerales.id, ids));
  const escribi = new Set(
    (await db
      .selectDistinct({ reclamoId: reclamosGeneralesMensajes.reclamoId })
      .from(reclamosGeneralesMensajes)
      .where(and(eq(reclamosGeneralesMensajes.userId, yo.id), inArray(reclamosGeneralesMensajes.reclamoId, ids)))
    ).map((e) => e.reclamoId),
  );
  const miArea = getRoleArea(yo.role ?? '');
  const involucrados = new Set<string>();
  for (const r of reclamos) {
    const metido = yo.role === 'admin'
      || [r.vendedorId, r.tecnicoId, r.responsableAreaId].includes(yo.id)
      || escribi.has(r.id)
      || (!!miArea && (await areasDelReclamo(r)).has(miArea));
    if (metido) involucrados.add(r.id);
  }

  const porReclamo: Record<string, number> = {};
  let count = 0;
  for (const f of filas) {
    if (!involucrados.has(f.reclamoId)) continue;
    porReclamo[f.reclamoId] = f.n;
    count += f.n;
  }
  return { count, porReclamo };
}

/** Mensajes de un reclamo, del más antiguo al más nuevo. */
export async function mensajesDelReclamo(reclamoId: string) {
  return db.select().from(reclamosGeneralesMensajes)
    .where(eq(reclamosGeneralesMensajes.reclamoId, reclamoId))
    .orderBy(reclamosGeneralesMensajes.createdAt);
}

/**
 * Guarda un mensaje en la conversación y avisa a los involucrados (después de
 * guardar: si el aviso falla, el mensaje igual quedó).
 * Devuelve null si el reclamo no existe.
 */
export async function escribirMensajeReclamo(params: {
  reclamoId: string;
  autor: { id: string; nombre: string; role?: string | null };
  mensaje: string;
}) {
  const reclamo = await storage.getReclamoGeneralWithDetails(params.reclamoId);
  if (!reclamo) return null;
  const [nuevo] = await db.insert(reclamosGeneralesMensajes).values({
    reclamoId: params.reclamoId,
    userId: params.autor.id,
    userName: params.autor.nombre,
    userRole: params.autor.role ?? null,
    mensaje: params.mensaje,
  }).returning();
  avisarMensajeReclamo(reclamo, params.autor.id, params.autor.nombre, params.mensaje).catch((err: any) =>
    console.error('[reclamos] no se pudo avisar el mensaje:', err?.message),
  );
  return nuevo;
}

/**
 * Manda a la campana (y al teléfono, si lo tiene activado) un aviso de mensaje
 * nuevo a quienes están metidos en el reclamo: quien lo registró, el técnico,
 * el responsable del área, quienes ya escribieron, el equipo del área asignada
 * y los administradores. Nunca a quien escribió.
 */
export async function avisarMensajeReclamo(reclamo: any, autorId: string, autorNombre: string, mensaje: string) {
  const { getRoleArea } = await import('@shared/reclamosAreas');

  const destinatarios = new Set<string>(
    [reclamo.vendedorId, reclamo.tecnicoId, reclamo.responsableAreaId].filter(Boolean),
  );

  const escribieron = await db
    .selectDistinct({ userId: reclamosGeneralesMensajes.userId })
    .from(reclamosGeneralesMensajes)
    .where(eq(reclamosGeneralesMensajes.reclamoId, reclamo.id));
  escribieron.forEach((e) => e.userId && destinatarios.add(e.userId));

  // Equipo del área: los roles que ven ese reclamo en su cola (la misma
  // equivalencia que usa la lista, p. ej. "envase" lo atiende Logística).
  const areas = await areasDelReclamo(reclamo);
  const todos = await db.select({ id: users.id, role: users.role }).from(users);
  for (const u of todos) {
    if (u.role === 'admin') destinatarios.add(u.id);
    else if (areas.size > 0 && areas.has(getRoleArea(u.role))) destinatarios.add(u.id);
  }
  destinatarios.delete(autorId);
  if (destinatarios.size === 0) return;

  // Correo a quien registró el reclamo: solo si no tiene ya un aviso sin leer de
  // esta conversación, así una seguidilla de mensajes no le llena la bandeja.
  // Se decide antes de guardar el aviso nuevo, que contaría como "sin leer".
  const creadorId: string | null = reclamo.vendedorId && reclamo.vendedorId !== autorId ? reclamo.vendedorId : null;
  let correoAlCreador = false;
  if (creadorId) {
    const [pendiente] = await db
      .select({ id: notifications.id })
      .from(notifications)
      .leftJoin(
        notificationReads,
        and(eq(notificationReads.notificationId, notifications.id), eq(notificationReads.userId, creadorId)),
      )
      .where(and(
        eq(notifications.userId, creadorId),
        eq(notifications.type, 'reclamo_mensaje'),
        eq(notifications.relatedReclamoId, reclamo.id),
        isNull(notificationReads.id),
      ))
      .limit(1);
    correoAlCreador = !pendiente;
  }

  const numero = reclamo.numeroTrazabilidad ? `N° ${reclamo.numeroTrazabilidad}` : 'un reclamo';
  const titulo = `Mensaje nuevo en reclamo ${numero}`;
  const resumen = mensaje.length > 140 ? `${mensaje.slice(0, 140)}…` : mensaje;
  const texto = `${autorNombre} escribió en el reclamo de ${reclamo.clientName}: "${resumen}"`;
  const actionUrl = `/reclamos-generales?reclamo=${reclamo.id}`;

  await db.insert(notifications).values(
    Array.from(destinatarios).map((userId) => ({
      userId,
      targetType: 'personal',
      type: 'reclamo_mensaje',
      title: titulo,
      message: texto,
      priority: 'media',
      relatedReclamoId: reclamo.id,
      actionUrl,
      createdBy: autorId,
      createdByName: autorNombre,
    })),
  );

  for (const userId of Array.from(destinatarios)) {
    sendPushForNotification({ targetType: 'personal', targetUserId: userId, title: titulo, message: texto, actionUrl })
      .catch((err: any) => console.error('[push] Error enviando push:', err?.message));
  }

  if (correoAlCreador && creadorId) {
    const [creador] = await db
      .select({ email: users.email, firstName: users.firstName })
      .from(users)
      .where(eq(users.id, creadorId));
    if (!creador?.email) return;
    const { buildReclamoMensajeEmail } = await import('../email-templates');
    const { subject, html } = buildReclamoMensajeEmail({
      destinatarioNombre: creador.firstName || reclamo.vendedorName,
      autorNombre,
      reclamoId: reclamo.id,
      numeroTrazabilidad: reclamo.numeroTrazabilidad,
      clientName: reclamo.clientName,
      productName: reclamo.productName,
      mensaje,
    });
    await NotifyHelper.sendAutoCustomerEmail({
      notificationType: 'reclamo_mensaje',
      to: creador.email,
      subject,
      html,
      force: true,
    });
  }
}

/** Al ver la conversación: sus avisos quedan leídos y se guarda hasta dónde leyó. */
export async function marcarMensajesLeidos(reclamoId: string, userId: string): Promise<{ marcados: number }> {
  const pendientes = await db
    .select({ id: notifications.id })
    .from(notifications)
    .leftJoin(
      notificationReads,
      and(eq(notificationReads.notificationId, notifications.id), eq(notificationReads.userId, userId)),
    )
    .where(and(
      eq(notifications.userId, userId),
      eq(notifications.type, 'reclamo_mensaje'),
      eq(notifications.relatedReclamoId, reclamoId),
      isNull(notificationReads.id),
    ));
  if (pendientes.length > 0) {
    await db
      .insert(notificationReads)
      .values(pendientes.map((p) => ({ notificationId: p.id, userId })))
      .onConflictDoNothing();
  }
  // Hasta aquí leyó esta conversación: lo de antes deja de contar como no leído.
  try {
    await db
      .insert(reclamosMensajesLecturas)
      .values({ reclamoId, userId, leidoHasta: sql`now()` })
      .onConflictDoUpdate({
        target: [reclamosMensajesLecturas.reclamoId, reclamosMensajesLecturas.userId],
        set: { leidoHasta: sql`now()` },
      });
  } catch (err: any) {
    console.error('[reclamos] no se pudo guardar la lectura de la conversación:', err?.message);
  }
  return { marcados: pendientes.length };
}
