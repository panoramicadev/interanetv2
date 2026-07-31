/**
 * Rendición de gastos v2 — informes, catálogos e historial de estados.
 *
 * Portado desde primerosresultados/rendicion-gastos y adaptado al modelo
 * single-tenant de interanetv2 (roles de `users.role`, sin company_id ni RLS).
 *
 * Un INFORME agrupa gastos propios para enviarlos a aprobación como un bloque.
 * El total y la cantidad se DERIVAN siempre de los gastos vinculados
 * (`gastos_empresariales.informe_id`), nunca se almacenan: así no hay drift.
 *
 * El estado del informe es un artefacto de flujo independiente del estado de
 * cada gasto: aprobar un informe NO transiciona sus gastos ni toca el libro
 * mayor de fondos (eso sigue viviendo en las rutas de gastos de routes.ts).
 */
import type { Express } from 'express';
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { db } from './db';
import { requireAuth } from './auth';
import { storage } from './storage';
import {
  gastoCatalogos,
  gastosEmpresariales,
  historialEstadosGasto,
  informesRendicion,
  insertGastoCatalogoSchema,
  crearInformeRendicionSchema,
  users,
  TIPOS_CATALOGO_GASTO,
  type EstadoInformeRendicion,
} from '../shared/schema';
import { registerReportesRendicionRoutes } from './services/rendicion-reportes';

// ─── Roles ──────────────────────────────────────────────────────────────────
// Mismos conjuntos que usan las rutas de gastos en routes.ts, para que el
// módulo de informes no invente una jerarquía paralela.

/** Ven informes de todos y pueden aprobar/rechazar/pagar. */
const ROLES_APROBADOR = ['admin', 'recursos_humanos', 'supervisor', 'encargado_area'];
/** Administran los catálogos. */
const ROLES_ADMIN_CATALOGO = ['admin', 'recursos_humanos'];

const esAprobador = (role: string) => ROLES_APROBADOR.includes(role);

/** Estados de gasto que pueden entrar a un informe (aún no resueltos). */
const ESTADOS_GASTO_RENDIBLES = ['pendiente'];

// ─── Máquina de estados del informe ─────────────────────────────────────────
//   borrador ──enviar──> enviado
//   enviado  ──aprobar─> aprobado
//   enviado  ──rechazar> rechazado   (motivo OBLIGATORIO)
//   aprobado ──pagar───> pagado
//   rechazado ─reabrir─> borrador    (para corregir y reenviar)

type TransicionInforme = 'enviar' | 'aprobar' | 'rechazar' | 'pagar' | 'reabrir';

const TRANSICIONES: Record<TransicionInforme, [EstadoInformeRendicion, EstadoInformeRendicion][]> = {
  enviar: [['borrador', 'enviado']],
  aprobar: [['enviado', 'aprobado']],
  rechazar: [['enviado', 'rechazado']],
  pagar: [['aprobado', 'pagado']],
  reabrir: [['rechazado', 'borrador']],
};

function siguienteEstado(
  actual: string,
  transicion: TransicionInforme,
): EstadoInformeRendicion | null {
  const par = TRANSICIONES[transicion].find(([desde]) => desde === actual);
  return par ? par[1] : null;
}

const ETIQUETA_TRANSICION: Record<TransicionInforme, string> = {
  enviar: 'enviar',
  aprobar: 'aprobar',
  rechazar: 'rechazar',
  pagar: 'marcar como pagado',
  reabrir: 'reabrir',
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function nombreUsuario(u: { firstName?: string | null; lastName?: string | null; email?: string | null } | null | undefined): string {
  if (!u) return 'Usuario';
  const nombre = [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
  return nombre || u.email || 'Usuario';
}

/** Registra una entrada en el timeline unificado. Nunca hace fallar la operación. */
async function registrarHistorial(entrada: {
  entidad: 'gasto' | 'informe' | 'fondo';
  entidadId: string;
  estadoAnterior?: string | null;
  estadoNuevo: string;
  actorId?: string | null;
  actorNombre?: string | null;
  comentario?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await db.insert(historialEstadosGasto).values({
      entidad: entrada.entidad,
      entidadId: entrada.entidadId,
      estadoAnterior: entrada.estadoAnterior ?? null,
      estadoNuevo: entrada.estadoNuevo,
      actorId: entrada.actorId ?? null,
      actorNombre: entrada.actorNombre ?? null,
      comentario: entrada.comentario ?? null,
      metadata: entrada.metadata ?? {},
    });
  } catch (error: any) {
    console.error('[rendicion] No se pudo registrar historial:', error.message);
  }
}

/** Notifica sin romper la transacción de negocio si el envío falla. */
async function notificar(
  userIds: string[],
  payload: { title: string; message: string; type?: string; link?: string },
): Promise<void> {
  try {
    for (const userId of userIds) {
      await storage.createNotification({
        userId,
        title: payload.title,
        message: payload.message,
        type: payload.type ?? 'info',
        link: payload.link ?? '/gastos-empresariales?tab=informes',
      });
    }
  } catch (error: any) {
    console.error('[rendicion] No se pudo notificar:', error.message);
  }
}

async function idsDeRoles(roles: string[]): Promise<string[]> {
  try {
    const filas = await db
      .select({ id: users.id })
      .from(users)
      .where(inArray(users.role, roles));
    return filas.map((f) => f.id);
  } catch {
    return [];
  }
}

const money = (v: unknown) => Number(v ?? 0).toLocaleString('es-CL', { maximumFractionDigits: 0 });

/** Proyección de gasto que consume la UI de informes. */
const columnasGasto = {
  id: gastosEmpresariales.id,
  monto: gastosEmpresariales.monto,
  descripcion: gastosEmpresariales.descripcion,
  categoria: gastosEmpresariales.categoria,
  centroCostos: gastosEmpresariales.centroCostos,
  proyecto: gastosEmpresariales.proyecto,
  tipoDocumento: gastosEmpresariales.tipoDocumento,
  numeroDocumento: gastosEmpresariales.numeroDocumento,
  proveedor: gastosEmpresariales.proveedor,
  rutProveedor: gastosEmpresariales.rutProveedor,
  fechaEmision: gastosEmpresariales.fechaEmision,
  archivoUrl: gastosEmpresariales.archivoUrl,
  estado: gastosEmpresariales.estado,
  estadoAprobacion: gastosEmpresariales.estadoAprobacion,
  fundingMode: gastosEmpresariales.fundingMode,
  informeId: gastosEmpresariales.informeId,
  userId: gastosEmpresariales.userId,
  createdAt: gastosEmpresariales.createdAt,
} as const;

// ═══════════════════════════════════════════════════════════════════════════

export function registerRendicionRoutes(app: Express): void {
  // =========================================================================
  // CATÁLOGOS
  // =========================================================================

  /** Valores de los selectores del formulario de gasto. */
  app.get('/api/gasto-catalogos', requireAuth, async (req: any, res: any) => {
    try {
      const { tipo, incluirInactivos } = req.query;

      const condiciones = [];
      if (tipo) {
        if (!TIPOS_CATALOGO_GASTO.includes(tipo)) {
          return res.status(400).json({ message: `Tipo de catálogo inválido: ${tipo}` });
        }
        condiciones.push(eq(gastoCatalogos.tipo, tipo));
      }
      // Los inactivos solo se muestran en la pantalla de administración.
      if (incluirInactivos !== 'true') {
        condiciones.push(eq(gastoCatalogos.activo, true));
      }

      const filas = await db
        .select()
        .from(gastoCatalogos)
        .where(condiciones.length ? and(...condiciones) : undefined)
        .orderBy(gastoCatalogos.tipo, gastoCatalogos.orden, gastoCatalogos.nombre);

      res.json(filas);
    } catch (error: any) {
      console.error('[rendicion] Error al listar catálogos:', error);
      res.status(500).json({ message: 'Error al obtener catálogos', error: error.message });
    }
  });

  app.post('/api/gasto-catalogos', requireAuth, async (req: any, res: any) => {
    try {
      if (!ROLES_ADMIN_CATALOGO.includes(req.user.role)) {
        return res.status(403).json({ message: 'Solo admin o recursos humanos pueden editar catálogos' });
      }

      const datos = insertGastoCatalogoSchema.parse(req.body);
      const [creado] = await db.insert(gastoCatalogos).values(datos).returning();
      res.status(201).json(creado);
    } catch (error: any) {
      if (error?.name === 'ZodError') {
        return res.status(400).json({ message: 'Datos inválidos', errors: error.errors });
      }
      // 23505 = unique_violation sobre (tipo, nombre)
      if (error?.code === '23505') {
        return res.status(409).json({ message: 'Ya existe un ítem con ese nombre en este catálogo' });
      }
      console.error('[rendicion] Error al crear ítem de catálogo:', error);
      res.status(500).json({ message: 'Error al crear ítem', error: error.message });
    }
  });

  app.patch('/api/gasto-catalogos/:id', requireAuth, async (req: any, res: any) => {
    try {
      if (!ROLES_ADMIN_CATALOGO.includes(req.user.role)) {
        return res.status(403).json({ message: 'Solo admin o recursos humanos pueden editar catálogos' });
      }

      const permitidos = ['nombre', 'codigo', 'cuentaContable', 'requiereRutProveedor', 'orden', 'activo'];
      const cambios: Record<string, unknown> = {};
      for (const campo of permitidos) {
        if (req.body[campo] !== undefined) cambios[campo] = req.body[campo];
      }
      if (Object.keys(cambios).length === 0) {
        return res.status(400).json({ message: 'No hay cambios que aplicar' });
      }
      cambios.updatedAt = new Date();

      const [actualizado] = await db
        .update(gastoCatalogos)
        .set(cambios)
        .where(eq(gastoCatalogos.id, req.params.id))
        .returning();

      if (!actualizado) return res.status(404).json({ message: 'Ítem no encontrado' });
      res.json(actualizado);
    } catch (error: any) {
      if (error?.code === '23505') {
        return res.status(409).json({ message: 'Ya existe un ítem con ese nombre en este catálogo' });
      }
      console.error('[rendicion] Error al actualizar ítem de catálogo:', error);
      res.status(500).json({ message: 'Error al actualizar ítem', error: error.message });
    }
  });

  /**
   * Baja lógica: los gastos históricos guardan el NOMBRE como texto, así que
   * desactivar un ítem lo saca de los selectores sin tocar lo ya rendido.
   */
  app.delete('/api/gasto-catalogos/:id', requireAuth, async (req: any, res: any) => {
    try {
      if (!ROLES_ADMIN_CATALOGO.includes(req.user.role)) {
        return res.status(403).json({ message: 'Solo admin o recursos humanos pueden editar catálogos' });
      }

      const [desactivado] = await db
        .update(gastoCatalogos)
        .set({ activo: false, updatedAt: new Date() })
        .where(eq(gastoCatalogos.id, req.params.id))
        .returning();

      if (!desactivado) return res.status(404).json({ message: 'Ítem no encontrado' });
      res.json({ ok: true, item: desactivado });
    } catch (error: any) {
      console.error('[rendicion] Error al desactivar ítem de catálogo:', error);
      res.status(500).json({ message: 'Error al desactivar ítem', error: error.message });
    }
  });

  // =========================================================================
  // HISTORIAL DE ESTADOS
  // =========================================================================

  app.get('/api/gastos-historial/:entidad/:entidadId', requireAuth, async (req: any, res: any) => {
    try {
      const { entidad, entidadId } = req.params;
      if (!['gasto', 'informe', 'fondo'].includes(entidad)) {
        return res.status(400).json({ message: `Entidad inválida: ${entidad}` });
      }

      const filas = await db
        .select()
        .from(historialEstadosGasto)
        .where(
          and(
            eq(historialEstadosGasto.entidad, entidad),
            eq(historialEstadosGasto.entidadId, entidadId),
          ),
        )
        .orderBy(historialEstadosGasto.createdAt);

      res.json(filas);
    } catch (error: any) {
      console.error('[rendicion] Error al obtener historial:', error);
      res.status(500).json({ message: 'Error al obtener historial', error: error.message });
    }
  });

  // =========================================================================
  // INFORMES DE RENDICIÓN
  // =========================================================================

  /**
   * Listado. Colaboradores ven solo los propios; roles aprobadores ven todos
   * y pueden filtrar por `userId`.
   */
  app.get('/api/informes-rendicion', requireAuth, async (req: any, res: any) => {
    try {
      const user = req.user;
      const { estado, userId, periodo } = req.query;

      const condiciones = [];
      if (!esAprobador(user.role)) {
        condiciones.push(eq(informesRendicion.userId, user.id));
      } else if (userId) {
        condiciones.push(eq(informesRendicion.userId, userId));
      }
      if (estado) condiciones.push(eq(informesRendicion.estado, estado));
      if (periodo) condiciones.push(eq(informesRendicion.periodo, periodo));

      const filas = await db
        .select({
          id: informesRendicion.id,
          titulo: informesRendicion.titulo,
          periodo: informesRendicion.periodo,
          estado: informesRendicion.estado,
          observaciones: informesRendicion.observaciones,
          motivoRechazo: informesRendicion.motivoRechazo,
          segmentCode: informesRendicion.segmentCode,
          fechaEnvio: informesRendicion.fechaEnvio,
          fechaAprobacion: informesRendicion.fechaAprobacion,
          fechaPago: informesRendicion.fechaPago,
          createdAt: informesRendicion.createdAt,
          userId: informesRendicion.userId,
          userFirstName: users.firstName,
          userLastName: users.lastName,
          userEmail: users.email,
          // Derivados: nunca se almacenan, se recalculan de los gastos.
          total: sql<string>`coalesce(sum(${gastosEmpresariales.monto}), 0)`,
          cantidadGastos: sql<number>`count(${gastosEmpresariales.id})`,
        })
        .from(informesRendicion)
        .leftJoin(users, eq(users.id, informesRendicion.userId))
        .leftJoin(gastosEmpresariales, eq(gastosEmpresariales.informeId, informesRendicion.id))
        .where(condiciones.length ? and(...condiciones) : undefined)
        .groupBy(
          informesRendicion.id,
          users.firstName,
          users.lastName,
          users.email,
        )
        .orderBy(desc(informesRendicion.createdAt));

      res.json(
        filas.map((f) => ({
          id: f.id,
          titulo: f.titulo,
          periodo: f.periodo,
          estado: f.estado,
          observaciones: f.observaciones,
          motivoRechazo: f.motivoRechazo,
          segmentCode: f.segmentCode,
          fechaEnvio: f.fechaEnvio,
          fechaAprobacion: f.fechaAprobacion,
          fechaPago: f.fechaPago,
          createdAt: f.createdAt,
          total: String(f.total ?? '0'),
          cantidadGastos: Number(f.cantidadGastos ?? 0),
          usuario: {
            id: f.userId,
            nombre: nombreUsuario({
              firstName: f.userFirstName,
              lastName: f.userLastName,
              email: f.userEmail,
            }),
          },
        })),
      );
    } catch (error: any) {
      console.error('[rendicion] Error al listar informes:', error);
      res.status(500).json({ message: 'Error al obtener informes', error: error.message });
    }
  });

  /**
   * Gastos que pueden entrar a un informe: propios, sin informe y todavía
   * pendientes. Un aprobador puede armar el informe de otro pasando `userId`.
   */
  app.get('/api/informes-rendicion/gastos-disponibles', requireAuth, async (req: any, res: any) => {
    try {
      const user = req.user;
      const objetivo =
        esAprobador(user.role) && req.query.userId ? String(req.query.userId) : user.id;

      const filas = await db
        .select(columnasGasto)
        .from(gastosEmpresariales)
        .where(
          and(
            eq(gastosEmpresariales.userId, objetivo),
            isNull(gastosEmpresariales.informeId),
            inArray(gastosEmpresariales.estado, ESTADOS_GASTO_RENDIBLES),
          ),
        )
        .orderBy(desc(gastosEmpresariales.fechaEmision), desc(gastosEmpresariales.createdAt));

      res.json(filas);
    } catch (error: any) {
      console.error('[rendicion] Error al listar gastos disponibles:', error);
      res.status(500).json({ message: 'Error al obtener gastos disponibles', error: error.message });
    }
  });

  /** Detalle: informe + sus gastos + timeline. */
  app.get('/api/informes-rendicion/:id', requireAuth, async (req: any, res: any) => {
    try {
      const user = req.user;

      const [informe] = await db
        .select({
          informe: informesRendicion,
          userFirstName: users.firstName,
          userLastName: users.lastName,
          userEmail: users.email,
        })
        .from(informesRendicion)
        .leftJoin(users, eq(users.id, informesRendicion.userId))
        .where(eq(informesRendicion.id, req.params.id))
        .limit(1);

      if (!informe) return res.status(404).json({ message: 'Informe no encontrado' });
      if (!esAprobador(user.role) && informe.informe.userId !== user.id) {
        return res.status(403).json({ message: 'No autorizado para ver este informe' });
      }

      const gastos = await db
        .select(columnasGasto)
        .from(gastosEmpresariales)
        .where(eq(gastosEmpresariales.informeId, req.params.id))
        .orderBy(desc(gastosEmpresariales.fechaEmision), desc(gastosEmpresariales.createdAt));

      const historial = await db
        .select()
        .from(historialEstadosGasto)
        .where(
          and(
            eq(historialEstadosGasto.entidad, 'informe'),
            eq(historialEstadosGasto.entidadId, req.params.id),
          ),
        )
        .orderBy(historialEstadosGasto.createdAt);

      const total = gastos.reduce((acc, g) => acc + Number(g.monto ?? 0), 0);

      res.json({
        ...informe.informe,
        usuario: {
          id: informe.informe.userId,
          nombre: nombreUsuario({
            firstName: informe.userFirstName,
            lastName: informe.userLastName,
            email: informe.userEmail,
          }),
        },
        total: total.toFixed(2),
        cantidadGastos: gastos.length,
        gastos,
        historial,
      });
    } catch (error: any) {
      console.error('[rendicion] Error al obtener informe:', error);
      res.status(500).json({ message: 'Error al obtener informe', error: error.message });
    }
  });

  /** Alta: crea el informe y engancha los gastos elegidos en una transacción. */
  app.post('/api/informes-rendicion', requireAuth, async (req: any, res: any) => {
    try {
      const user = req.user;
      if (user.role === 'client') {
        return res.status(403).json({ message: 'No autorizado' });
      }

      const datos = crearInformeRendicionSchema.parse(req.body);
      // Un aprobador puede armar el informe de otro; el resto, solo el propio.
      const duenoId =
        esAprobador(user.role) && req.body.userId ? String(req.body.userId) : user.id;

      const ids = Array.from(new Set(datos.gastoIds));
      const gastos = await db
        .select({
          id: gastosEmpresariales.id,
          userId: gastosEmpresariales.userId,
          estado: gastosEmpresariales.estado,
          informeId: gastosEmpresariales.informeId,
          fechaEmision: gastosEmpresariales.fechaEmision,
          createdAt: gastosEmpresariales.createdAt,
          segmentCode: gastosEmpresariales.segmentCode,
        })
        .from(gastosEmpresariales)
        .where(inArray(gastosEmpresariales.id, ids));

      if (gastos.length !== ids.length) {
        return res.status(400).json({ message: 'Alguno de los gastos no existe' });
      }
      for (const g of gastos) {
        if (g.userId !== duenoId) {
          return res.status(403).json({ message: 'Todos los gastos deben ser del mismo colaborador' });
        }
        if (g.informeId) {
          return res.status(400).json({ message: 'Alguno de los gastos ya pertenece a un informe' });
        }
        if (!ESTADOS_GASTO_RENDIBLES.includes(g.estado)) {
          return res.status(400).json({ message: 'Solo puedes incluir gastos pendientes' });
        }
      }

      // Periodo = mes del gasto más reciente (YYYY-MM). Si un gasto no tiene
      // fecha de emisión cargada, cae a su fecha de creación.
      const periodo = gastos
        .map((g) => {
          const base = g.fechaEmision ?? g.createdAt?.toISOString().slice(0, 10);
          return base ? String(base).slice(0, 7) : null;
        })
        .filter((p): p is string => !!p)
        .sort()
        .at(-1) ?? new Date().toISOString().slice(0, 7);

      const segmentCode = gastos.find((g) => g.segmentCode)?.segmentCode ?? null;

      const creado = await db.transaction(async (tx) => {
        const [informe] = await tx
          .insert(informesRendicion)
          .values({
            titulo: datos.titulo,
            observaciones: datos.observaciones ?? null,
            periodo,
            userId: duenoId,
            creadoPorId: user.id,
            estado: 'borrador',
            segmentCode,
          })
          .returning();

        await tx
          .update(gastosEmpresariales)
          .set({ informeId: informe.id, updatedAt: new Date() })
          .where(inArray(gastosEmpresariales.id, ids));

        return informe;
      });

      await registrarHistorial({
        entidad: 'informe',
        entidadId: creado.id,
        estadoAnterior: null,
        estadoNuevo: 'borrador',
        actorId: user.id,
        actorNombre: nombreUsuario(user),
        comentario: `Informe creado con ${ids.length} gasto(s)`,
      });

      res.status(201).json(creado);
    } catch (error: any) {
      if (error?.name === 'ZodError') {
        return res.status(400).json({ message: 'Datos inválidos', errors: error.errors });
      }
      console.error('[rendicion] Error al crear informe:', error);
      res.status(500).json({ message: 'Error al crear informe', error: error.message });
    }
  });

  /** Edición de cabecera. Solo en borrador y por el dueño (o un aprobador). */
  app.patch('/api/informes-rendicion/:id', requireAuth, async (req: any, res: any) => {
    try {
      const user = req.user;
      const [informe] = await db
        .select()
        .from(informesRendicion)
        .where(eq(informesRendicion.id, req.params.id))
        .limit(1);

      if (!informe) return res.status(404).json({ message: 'Informe no encontrado' });
      if (informe.userId !== user.id && !esAprobador(user.role)) {
        return res.status(403).json({ message: 'No autorizado' });
      }
      if (informe.estado !== 'borrador') {
        return res.status(400).json({ message: 'Solo se puede editar un informe en borrador' });
      }

      const cambios: Record<string, unknown> = { updatedAt: new Date() };
      if (typeof req.body.titulo === 'string' && req.body.titulo.trim()) {
        cambios.titulo = req.body.titulo.trim();
      }
      if (req.body.observaciones !== undefined) {
        cambios.observaciones = req.body.observaciones || null;
      }

      const [actualizado] = await db
        .update(informesRendicion)
        .set(cambios)
        .where(eq(informesRendicion.id, req.params.id))
        .returning();

      res.json(actualizado);
    } catch (error: any) {
      console.error('[rendicion] Error al editar informe:', error);
      res.status(500).json({ message: 'Error al editar informe', error: error.message });
    }
  });

  /** Suma gastos a un informe en borrador. */
  app.post('/api/informes-rendicion/:id/gastos', requireAuth, async (req: any, res: any) => {
    try {
      const user = req.user;
      const ids: string[] = Array.from(new Set(req.body.gastoIds ?? []));
      if (ids.length === 0) {
        return res.status(400).json({ message: 'Selecciona al menos un gasto' });
      }

      const [informe] = await db
        .select()
        .from(informesRendicion)
        .where(eq(informesRendicion.id, req.params.id))
        .limit(1);

      if (!informe) return res.status(404).json({ message: 'Informe no encontrado' });
      if (informe.userId !== user.id && !esAprobador(user.role)) {
        return res.status(403).json({ message: 'No autorizado' });
      }
      if (informe.estado !== 'borrador') {
        return res.status(400).json({ message: 'Solo se pueden agregar gastos a un informe en borrador' });
      }

      const gastos = await db
        .select({
          id: gastosEmpresariales.id,
          userId: gastosEmpresariales.userId,
          estado: gastosEmpresariales.estado,
          informeId: gastosEmpresariales.informeId,
        })
        .from(gastosEmpresariales)
        .where(inArray(gastosEmpresariales.id, ids));

      if (gastos.length !== ids.length) {
        return res.status(400).json({ message: 'Alguno de los gastos no existe' });
      }
      for (const g of gastos) {
        if (g.userId !== informe.userId) {
          return res.status(400).json({ message: 'El gasto pertenece a otro colaborador' });
        }
        if (g.informeId) {
          return res.status(400).json({ message: 'Alguno de los gastos ya pertenece a un informe' });
        }
        if (!ESTADOS_GASTO_RENDIBLES.includes(g.estado)) {
          return res.status(400).json({ message: 'Solo puedes incluir gastos pendientes' });
        }
      }

      await db
        .update(gastosEmpresariales)
        .set({ informeId: informe.id, updatedAt: new Date() })
        .where(inArray(gastosEmpresariales.id, ids));

      res.json({ ok: true, agregados: ids.length });
    } catch (error: any) {
      console.error('[rendicion] Error al agregar gastos al informe:', error);
      res.status(500).json({ message: 'Error al agregar gastos', error: error.message });
    }
  });

  /** Quita un gasto del informe (el gasto queda suelto, no se borra). */
  app.delete('/api/informes-rendicion/:id/gastos/:gastoId', requireAuth, async (req: any, res: any) => {
    try {
      const user = req.user;
      const [informe] = await db
        .select()
        .from(informesRendicion)
        .where(eq(informesRendicion.id, req.params.id))
        .limit(1);

      if (!informe) return res.status(404).json({ message: 'Informe no encontrado' });
      if (informe.userId !== user.id && !esAprobador(user.role)) {
        return res.status(403).json({ message: 'No autorizado' });
      }
      if (informe.estado !== 'borrador') {
        return res.status(400).json({ message: 'Solo se pueden quitar gastos de un informe en borrador' });
      }

      const [actualizado] = await db
        .update(gastosEmpresariales)
        .set({ informeId: null, updatedAt: new Date() })
        .where(
          and(
            eq(gastosEmpresariales.id, req.params.gastoId),
            eq(gastosEmpresariales.informeId, req.params.id),
          ),
        )
        .returning({ id: gastosEmpresariales.id });

      if (!actualizado) {
        return res.status(404).json({ message: 'El gasto no pertenece a este informe' });
      }
      res.json({ ok: true });
    } catch (error: any) {
      console.error('[rendicion] Error al quitar gasto del informe:', error);
      res.status(500).json({ message: 'Error al quitar gasto', error: error.message });
    }
  });

  /** Borra el informe. Los gastos se liberan (FK ON DELETE SET NULL). */
  app.delete('/api/informes-rendicion/:id', requireAuth, async (req: any, res: any) => {
    try {
      const user = req.user;
      const [informe] = await db
        .select()
        .from(informesRendicion)
        .where(eq(informesRendicion.id, req.params.id))
        .limit(1);

      if (!informe) return res.status(404).json({ message: 'Informe no encontrado' });
      if (informe.userId !== user.id && user.role !== 'admin') {
        return res.status(403).json({ message: 'No autorizado' });
      }
      if (informe.estado !== 'borrador' && user.role !== 'admin') {
        return res.status(400).json({ message: 'Solo se puede eliminar un informe en borrador' });
      }

      await db.transaction(async (tx) => {
        await tx
          .update(gastosEmpresariales)
          .set({ informeId: null, updatedAt: new Date() })
          .where(eq(gastosEmpresariales.informeId, req.params.id));
        await tx.delete(informesRendicion).where(eq(informesRendicion.id, req.params.id));
      });

      res.json({ ok: true });
    } catch (error: any) {
      console.error('[rendicion] Error al eliminar informe:', error);
      res.status(500).json({ message: 'Error al eliminar informe', error: error.message });
    }
  });

  // ─── Transiciones de estado ───────────────────────────────────────────────

  /**
   * Aplica una transición del informe: valida permiso por rol, valida que el
   * estado actual la admita, persiste marcas de tiempo y deja rastro.
   */
  async function aplicarTransicion(
    req: any,
    res: any,
    transicion: TransicionInforme,
  ): Promise<void> {
    const user = req.user;
    const [informe] = await db
      .select()
      .from(informesRendicion)
      .where(eq(informesRendicion.id, req.params.id))
      .limit(1);

    if (!informe) {
      res.status(404).json({ message: 'Informe no encontrado' });
      return;
    }

    // Enviar y reabrir los hace el dueño (o un aprobador). Aprobar, rechazar
    // y pagar son exclusivos de roles aprobadores.
    if (transicion === 'enviar' || transicion === 'reabrir') {
      if (informe.userId !== user.id && !esAprobador(user.role)) {
        res.status(403).json({ message: 'No autorizado' });
        return;
      }
    } else if (!esAprobador(user.role)) {
      res.status(403).json({ message: 'Solo un aprobador puede realizar esta acción' });
      return;
    }

    const nuevo = siguienteEstado(informe.estado, transicion);
    if (!nuevo) {
      res.status(400).json({
        message: `No se puede ${ETIQUETA_TRANSICION[transicion]} un informe en estado "${informe.estado}"`,
      });
      return;
    }

    const motivoRechazo = (req.body?.motivoRechazo ?? req.body?.comentario ?? '').trim();
    if (transicion === 'rechazar' && !motivoRechazo) {
      res.status(400).json({ message: 'El motivo del rechazo es obligatorio' });
      return;
    }

    // Un informe sin gastos no tiene qué rendir.
    if (transicion === 'enviar') {
      const [{ cantidad }] = await db
        .select({ cantidad: sql<number>`count(*)` })
        .from(gastosEmpresariales)
        .where(eq(gastosEmpresariales.informeId, informe.id));
      if (Number(cantidad) === 0) {
        res.status(400).json({ message: 'El informe no tiene gastos' });
        return;
      }
    }

    const ahora = new Date();
    const cambios: Record<string, unknown> = { estado: nuevo, updatedAt: ahora };

    if (transicion === 'enviar') cambios.fechaEnvio = ahora;
    if (transicion === 'aprobar') {
      cambios.fechaAprobacion = ahora;
      cambios.aprobadorId = user.id;
      cambios.comentarioAprobacion = req.body?.comentario || null;
      cambios.motivoRechazo = null;
    }
    if (transicion === 'rechazar') {
      cambios.motivoRechazo = motivoRechazo;
      cambios.aprobadorId = user.id;
    }
    if (transicion === 'pagar') {
      cambios.fechaPago = ahora;
      if (req.body?.comprobantePagoUrl) cambios.comprobantePagoUrl = req.body.comprobantePagoUrl;
    }
    if (transicion === 'reabrir') {
      // Vuelve a borrador limpio para corregir y reenviar.
      cambios.motivoRechazo = null;
      cambios.fechaEnvio = null;
    }

    const [actualizado] = await db
      .update(informesRendicion)
      .set(cambios)
      .where(eq(informesRendicion.id, informe.id))
      .returning();

    await registrarHistorial({
      entidad: 'informe',
      entidadId: informe.id,
      estadoAnterior: informe.estado,
      estadoNuevo: nuevo,
      actorId: user.id,
      actorNombre: nombreUsuario(user),
      comentario: motivoRechazo || req.body?.comentario || null,
    });

    // ─── Notificaciones ───
    const [{ total }] = await db
      .select({ total: sql<string>`coalesce(sum(${gastosEmpresariales.monto}), 0)` })
      .from(gastosEmpresariales)
      .where(eq(gastosEmpresariales.informeId, informe.id));

    if (transicion === 'enviar') {
      const aprobadores = await idsDeRoles(['admin', 'recursos_humanos']);
      await notificar(aprobadores, {
        title: 'Nuevo informe de rendición pendiente',
        message: `${nombreUsuario(user)} envió el informe «${informe.titulo}» por $${money(total)}.`,
      });
    } else if (transicion === 'aprobar') {
      await notificar([informe.userId], {
        title: 'Informe de rendición aprobado',
        message: `Tu informe «${informe.titulo}» por $${money(total)} fue aprobado.`,
        type: 'success',
      });
    } else if (transicion === 'rechazar') {
      await notificar([informe.userId], {
        title: 'Informe de rendición rechazado',
        message: `Tu informe «${informe.titulo}» fue rechazado: ${motivoRechazo}`,
        type: 'warning',
      });
    } else if (transicion === 'pagar') {
      await notificar([informe.userId], {
        title: 'Informe de rendición pagado',
        message: `Se registró el pago de tu informe «${informe.titulo}» por $${money(total)}.`,
        type: 'success',
      });
    }

    res.json(actualizado);
  }

  const rutaTransicion = (ruta: string, transicion: TransicionInforme) => {
    app.post(`/api/informes-rendicion/:id/${ruta}`, requireAuth, async (req: any, res: any) => {
      try {
        await aplicarTransicion(req, res, transicion);
      } catch (error: any) {
        console.error(`[rendicion] Error en transición "${transicion}":`, error);
        if (!res.headersSent) {
          res.status(500).json({ message: 'Error al actualizar el informe', error: error.message });
        }
      }
    });
  };

  rutaTransicion('enviar', 'enviar');
  rutaTransicion('aprobar', 'aprobar');
  rutaTransicion('rechazar', 'rechazar');
  rutaTransicion('pagar', 'pagar');
  rutaTransicion('reabrir', 'reabrir');

  // =========================================================================
  // Reportes PDF / Excel
  // =========================================================================
  registerReportesRendicionRoutes(app);
}
