/**
 * Mensajes destacados — la franja neón de la pantalla de inicio.
 *
 * - GET  /api/mensajes-destacados/mios           los que le tocan a quien mira (vigentes)
 * - GET  /api/mensajes-destacados                los que puede administrar quien pide
 * - POST /api/mensajes-destacados                crea uno
 * - PATCH /api/mensajes-destacados/:id           edita / pausa / reactiva
 * - POST /api/mensajes-destacados/:id/archivar   lo saca de la lista (no se borra)
 * - GET  /api/mensajes-destacados/meta-valores   los números de la meta, para la vista previa
 *
 * Datos que se rellenan solos: un mensaje puede llevar {mes}, {meta},
 * {llevamos}, {avance} y {falta}. Al mostrarlo se cambian por la meta global
 * del mes en curso y lo vendido hasta ahora, igual que la tarjeta "Meta
 * Global" del dashboard en modo combinado: facturado + NVV + GDV pendientes.
 * Si el mes no tiene meta global, esos mensajes no se muestran.
 *
 * Quién escribe a quién:
 * - admin: a cualquier rol o a todos ('todos').
 * - supervisor: solo a vendedores ('salesperson'), y le llega únicamente a los
 *   vendedores de su área: los que le reportan a un supervisor de ese mismo
 *   segmento (o, si el supervisor no tiene área, a los que le reportan a él).
 */

import type { Express } from 'express';
import { z } from 'zod';
import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { db } from './db';
import {
  mensajesDestacados,
  salespeopleUsers,
  MENSAJE_COLORES,
  type MensajeDestacado,
} from '@shared/schema';
import { CONFIGURABLE_ROLES } from '@shared/permissions';
import { requireAuth, requireRoles } from './auth';
import { normalizePanelSegmento } from './panel-changes';
import { storage } from './storage';

const AUDIENCIA_TODOS = 'todos';
const AUDIENCIAS = [AUDIENCIA_TODOS, ...CONFIGURABLE_ROLES.filter((r) => r !== 'admin')];

/** Día en hora de Chile (YYYY-MM-DD). */
function hoyChile(d = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d);
}

const fecha = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida')
  .nullable()
  .optional()
  .transform((v) => v || null);

const mensajeSchema = z
  .object({
    texto: z.string().trim().min(3, 'El mensaje es muy corto').max(280, 'Máximo 280 caracteres'),
    audiencia: z.string().refine((a) => AUDIENCIAS.includes(a), 'Destino inválido'),
    color: z.enum(MENSAJE_COLORES).default('naranjo'),
    activo: z.boolean().default(true),
    desde: fecha,
    hasta: fecha,
  })
  .refine((m) => !m.desde || !m.hasta || m.desde <= m.hasta, {
    message: 'La fecha "hasta" no puede ser anterior a "desde"',
    path: ['hasta'],
  });

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];
const MARCA = /\{(mes|meta|llevamos|avance|falta)\}/g;
const tieneMarcas = (texto: string) => /\{(mes|meta|llevamos|avance|falta)\}/.test(texto);

/** $3.252 millones (en la franja, la cifra completa no se alcanza a leer). */
function pesos(n: number): string {
  if (Math.abs(n) >= 1_000_000) {
    return `$${Math.round(n / 1_000_000).toLocaleString('es-CL')} millones`;
  }
  return `$${Math.round(n).toLocaleString('es-CL')}`;
}

type ValoresMeta = Record<'mes' | 'meta' | 'llevamos' | 'avance' | 'falta', string>;

// Se recalcula a lo más cada 10 minutos: todos los inicios piden lo mismo.
let cacheMeta: { hasta: number; valores: ValoresMeta | null } | null = null;
const DIEZ_MINUTOS = 10 * 60 * 1000;

/** Meta global del mes en curso y lo que se lleva (facturado + NVV + GDV).
 *  null si el mes no tiene meta global. */
async function valoresMeta(): Promise<ValoresMeta | null> {
  if (cacheMeta && cacheMeta.hasta > Date.now()) return cacheMeta.valores;

  const hoy = hoyChile();
  const periodo = hoy.slice(0, 7);
  const metaGlobal = (await storage.getGoals()).find((g) => g.type === 'global' && g.period === periodo);

  let valores: ValoresMeta | null = null;
  if (metaGlobal) {
    const meta = parseFloat(metaGlobal.amount) || 0;
    const [facturado, nvv, gdv] = await Promise.all([
      storage.getGlobalSalesForPeriod(periodo, []),
      storage.getAllNvvGroupedBySalespeople({}),
      storage.getAllGdvGroupedBySalespeople(),
    ]);
    const llevamos = facturado
      + nvv.reduce((t, v) => t + (Number(v.totalAmount) || 0), 0)
      + gdv.reduce((t, v) => t + (Number(v.totalAmount) || 0), 0);
    const avance = meta > 0 ? (llevamos / meta) * 100 : 0;
    valores = {
      mes: MESES[Number(hoy.slice(5, 7)) - 1],
      meta: pesos(meta),
      llevamos: pesos(llevamos),
      avance: `${avance.toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`,
      falta: pesos(Math.max(0, meta - llevamos)),
    };
  }
  cacheMeta = { hasta: Date.now() + DIEZ_MINUTOS, valores };
  return valores;
}

const rellenar = (texto: string, v: ValoresMeta) =>
  texto.replace(MARCA, (_, clave: keyof ValoresMeta) => v[clave]);

function nombreDe(u: any): string {
  const full = [u?.firstName, u?.lastName].filter(Boolean).join(' ').trim();
  return u?.salespersonName || full || u?.email || 'Usuario';
}

/** El supervisor solo administra lo suyo; el admin, todo. */
function puedeAdministrar(user: any, m: MensajeDestacado): boolean {
  if (user.role === 'admin') return true;
  return user.role === 'supervisor' && m.creadoPorId === user.id;
}

const requireEditor = requireRoles(['admin', 'supervisor']);

export function registerMensajesDestacadosRoutes(app: Express) {
  // Lo que ve quien mira la pantalla de inicio.
  app.get('/api/mensajes-destacados/mios', requireAuth, async (req: any, res) => {
    try {
      const user = req.user;
      const role: string = user.role;
      const hoy = hoyChile();

      const filas = await db
        .select()
        .from(mensajesDestacados)
        .where(and(
          isNull(mensajesDestacados.archivadoAt),
          eq(mensajesDestacados.activo, true),
          inArray(mensajesDestacados.audiencia, [AUDIENCIA_TODOS, role]),
        ))
        .orderBy(desc(mensajesDestacados.createdAt));

      const vigentes = filas.filter((m) => (!m.desde || m.desde <= hoy) && (!m.hasta || m.hasta >= hoy));

      // Mensajes de supervisor: solo para los vendedores de su área.
      let areaVendedor: string | null = null;
      if (role === 'salesperson' && vigentes.some((m) => m.creadoPorRol === 'supervisor') && user.supervisorId) {
        const [sup] = await db
          .select({ assignedSegment: salespeopleUsers.assignedSegment })
          .from(salespeopleUsers)
          .where(eq(salespeopleUsers.id, user.supervisorId))
          .limit(1);
        areaVendedor = normalizePanelSegmento(sup?.assignedSegment);
      }
      if (!areaVendedor) areaVendedor = normalizePanelSegmento(user.assignedSegment);

      const visibles = vigentes.filter((m) => {
        if (m.creadoPorRol !== 'supervisor') return true;
        if (m.creadoPorId === user.supervisorId) return true;
        return !!m.segmento && m.segmento === areaVendedor;
      });

      // Los datos de la meta se rellenan al mostrar. Si el cálculo falla, el
      // mensaje sale con "…" en vez de los números; si el mes no tiene meta, no sale.
      let conDatos = visibles;
      if (visibles.some((m) => tieneMarcas(m.texto))) {
        let valores: ValoresMeta | null;
        try {
          valores = await valoresMeta();
        } catch (error) {
          console.error('[mensajes-destacados] meta:', error);
          valores = { mes: '…', meta: '…', llevamos: '…', avance: '…', falta: '…' };
        }
        conDatos = visibles
          .filter((m) => valores || !tieneMarcas(m.texto))
          .map((m) => (valores && tieneMarcas(m.texto) ? { ...m, texto: rellenar(m.texto, valores) } : m));
      }

      res.json(conDatos.map((m) => ({
        id: m.id,
        texto: m.texto,
        color: m.color,
        autor: m.creadoPorNombre,
        updatedAt: m.updatedAt,
      })));
    } catch (error: any) {
      console.error('[mensajes-destacados] mios:', error);
      res.status(500).json({ message: 'No se pudieron cargar los mensajes' });
    }
  });

  // Números de la meta para la vista previa de Configuración → Mensajes.
  app.get('/api/mensajes-destacados/meta-valores', requireAuth, requireEditor, async (_req, res) => {
    try {
      res.json({ valores: await valoresMeta() });
    } catch (error: any) {
      console.error('[mensajes-destacados] meta-valores:', error);
      res.status(500).json({ message: 'No se pudo calcular la meta' });
    }
  });

  // Lista para administrar en Configuración → Mensajes.
  app.get('/api/mensajes-destacados', requireAuth, requireEditor, async (req: any, res) => {
    try {
      const user = req.user;
      const filtros = [isNull(mensajesDestacados.archivadoAt)];
      if (user.role !== 'admin') filtros.push(eq(mensajesDestacados.creadoPorId, user.id));
      const filas = await db
        .select()
        .from(mensajesDestacados)
        .where(and(...filtros))
        .orderBy(desc(mensajesDestacados.createdAt));
      res.json(filas);
    } catch (error: any) {
      console.error('[mensajes-destacados] lista:', error);
      res.status(500).json({ message: 'No se pudieron cargar los mensajes' });
    }
  });

  app.post('/api/mensajes-destacados', requireAuth, requireEditor, async (req: any, res) => {
    const user = req.user;
    const parsed = mensajeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0]?.message || 'Datos inválidos' });
    }
    const data = parsed.data;
    if (user.role === 'supervisor' && data.audiencia !== 'salesperson') {
      return res.status(403).json({ message: 'El supervisor solo puede escribirle a los vendedores' });
    }
    try {
      const [creado] = await db
        .insert(mensajesDestacados)
        .values({
          ...data,
          segmento: user.role === 'supervisor' ? normalizePanelSegmento(user.assignedSegment) : null,
          creadoPorId: user.id,
          creadoPorNombre: nombreDe(user),
          creadoPorRol: user.role,
        })
        .returning();
      res.status(201).json(creado);
    } catch (error: any) {
      console.error('[mensajes-destacados] crear:', error);
      res.status(500).json({ message: 'No se pudo guardar el mensaje' });
    }
  });

  app.patch('/api/mensajes-destacados/:id', requireAuth, requireEditor, async (req: any, res) => {
    const user = req.user;
    try {
      const [actual] = await db
        .select()
        .from(mensajesDestacados)
        .where(and(eq(mensajesDestacados.id, req.params.id), isNull(mensajesDestacados.archivadoAt)))
        .limit(1);
      if (!actual) return res.status(404).json({ message: 'Mensaje no encontrado' });
      if (!puedeAdministrar(user, actual)) {
        return res.status(403).json({ message: 'Este mensaje lo administra otra persona' });
      }

      const parsed = mensajeSchema.safeParse({
        texto: actual.texto,
        audiencia: actual.audiencia,
        color: actual.color,
        activo: actual.activo,
        desde: actual.desde,
        hasta: actual.hasta,
        ...req.body,
      });
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0]?.message || 'Datos inválidos' });
      }
      if (actual.creadoPorRol === 'supervisor' && parsed.data.audiencia !== 'salesperson') {
        return res.status(403).json({ message: 'Un mensaje de supervisor solo puede ir a los vendedores' });
      }

      const [editado] = await db
        .update(mensajesDestacados)
        .set({ ...parsed.data, updatedAt: new Date() })
        .where(eq(mensajesDestacados.id, actual.id))
        .returning();
      res.json(editado);
    } catch (error: any) {
      console.error('[mensajes-destacados] editar:', error);
      res.status(500).json({ message: 'No se pudo guardar el mensaje' });
    }
  });

  app.post('/api/mensajes-destacados/:id/archivar', requireAuth, requireEditor, async (req: any, res) => {
    const user = req.user;
    try {
      const [actual] = await db
        .select()
        .from(mensajesDestacados)
        .where(and(eq(mensajesDestacados.id, req.params.id), isNull(mensajesDestacados.archivadoAt)))
        .limit(1);
      if (!actual) return res.status(404).json({ message: 'Mensaje no encontrado' });
      if (!puedeAdministrar(user, actual)) {
        return res.status(403).json({ message: 'Este mensaje lo administra otra persona' });
      }
      await db
        .update(mensajesDestacados)
        .set({ archivadoAt: new Date(), activo: false, updatedAt: new Date() })
        .where(eq(mensajesDestacados.id, actual.id));
      res.json({ ok: true });
    } catch (error: any) {
      console.error('[mensajes-destacados] archivar:', error);
      res.status(500).json({ message: 'No se pudo archivar el mensaje' });
    }
  });
}
