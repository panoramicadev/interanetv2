/**
 * Memorice Colores Patagonia — juego público de la Feria Redmat 2026.
 *
 * - GET  /memorice                         página del juego (pública, HTML estático)
 * - GET  /api/public/memorice/ranking      top 10 del día (sin teléfono ni correo)
 * - POST /api/public/memorice/partidas     guarda una partida registrada
 * - GET  /api/memorice/admin               panel del organizador (admin/supervisor)
 *
 * Cada jugador registrado entra como lead del CRM de Ferretería
 * (crm_seguimiento_clientes) con la etiqueta "FERIA REDMAT", asignado al
 * encargado del área igual que el cotizador web. Una falla del CRM nunca
 * pierde la partida: el ranking va primero.
 *
 * El tiempo lo mide el navegador del jugador: no hay forma de impedir del todo
 * una trampa, así que solo se descartan tiempos imposibles (MIN_MS) y el
 * organizador revisa el podio antes de entregar el premio.
 */

import type { Express, Request } from 'express';
import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { and, asc, eq, isNotNull, or } from 'drizzle-orm';
import { db } from './db';
import {
  juegoMemoricePartidas,
  crmSeguimientoClientes,
  crmSeguimientoHitos,
  type JuegoMemoricePartida,
} from '@shared/schema';
import { requireAuth, requireAdminOrSupervisor } from './auth';
import {
  findExistingLead,
  parseEtiquetas,
  resolveOwnerForSegmento,
} from './services/crm-web-lead.service';
import { logPanelChange, normalizePanelSegmento } from './panel-changes';

const EVENTO = 'feria-redmat-2026';
const ETIQUETA = 'FERIA REDMAT';
const SEGMENTO_VALUE = 'ferreteria';
const SEGMENTO_CRM = 'Ferretería';
const AUTOR_ID = 'sistema';
const AUTOR_NOMBRE = 'Memorice Feria Redmat';
const VENDEDOR_SIN_ASIGNAR_ID = 'web-sin-asignar';
const VENDEDOR_SIN_ASIGNAR_NOMBRE = 'Sin asignar (web)';
/** 16 cartas: dar vuelta todo sin errar toma más que esto. */
const MIN_MS = 6000;
const MIN_INTENTOS = 8;

/** Día en hora de Chile (YYYY-MM-DD): el ranking corta a medianoche local. */
function diaChile(d = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d);
}

const normTel = (t: string) => (t || '').replace(/\D/g, '').slice(-9);

function fmt(ms: number): string {
  const s = ms / 1000;
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${(s - m * 60).toFixed(1).padStart(4, '0')}`;
}

const partidaSchema = z.object({
  nombre: z.string().trim().min(2).max(120),
  ferreteria: z.string().trim().min(2).max(160),
  ciudad: z.string().trim().max(120).optional().default(''),
  telefono: z.string().trim().max(40).refine(t => normTel(t).length >= 8, 'Teléfono inválido'),
  email: z.string().trim().toLowerCase().email().max(160),
  ms: z.number().int().min(MIN_MS).max(60 * 60 * 1000),
  intentos: z.number().int().min(MIN_INTENTOS).max(10000),
});

/** Límite simple por IP para que nadie llene el CRM a punta de POST. */
const hits = new Map<string, number[]>();
function rateLimited(req: Request, max = 120, windowMs = 10 * 60 * 1000): boolean {
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'x';
  const now = Date.now();
  const list = (hits.get(ip) || []).filter(t => now - t < windowMs);
  list.push(now);
  hits.set(ip, list);
  return list.length > max;
}

/** Mejor partida por persona (teléfono), ordenada por tiempo; empate: quien llegó primero. */
function mejorPorPersona(rows: JuegoMemoricePartida[]): JuegoMemoricePartida[] {
  const best = new Map<string, JuegoMemoricePartida>();
  for (const r of rows) {
    const cur = best.get(r.telefonoNorm);
    if (!cur || r.ms < cur.ms || (r.ms === cur.ms && r.createdAt < cur.createdAt)) best.set(r.telefonoNorm, r);
  }
  return Array.from(best.values()).sort((a, b) => a.ms - b.ms || +a.createdAt - +b.createdAt);
}

async function partidasDelDia(dia: string) {
  return db.select().from(juegoMemoricePartidas)
    .where(and(eq(juegoMemoricePartidas.evento, EVENTO), eq(juegoMemoricePartidas.dia, dia)))
    .orderBy(asc(juegoMemoricePartidas.createdAt));
}

/**
 * Lleva al jugador al CRM de Ferretería. Solo la primera partida de la persona
 * toca el CRM: las siguientes reutilizan el vínculo y no agregan hitos.
 */
async function syncJugadorCrm(p: z.infer<typeof partidaSchema>, dia: string): Promise<string | null> {
  const tel = normTel(p.telefono);
  const [previa] = await db.select({ id: juegoMemoricePartidas.crmSeguimientoId })
    .from(juegoMemoricePartidas)
    .where(and(
      eq(juegoMemoricePartidas.evento, EVENTO),
      isNotNull(juegoMemoricePartidas.crmSeguimientoId),
      or(eq(juegoMemoricePartidas.telefonoNorm, tel), eq(juegoMemoricePartidas.email, p.email))!,
    ))
    .limit(1);
  if (previa?.id) return previa.id;

  const detalle = [
    `Jugó el Memorice Colores Patagonia en la Feria Redmat (${dia}).`,
    `Ferretería: ${p.ferreteria}${p.ciudad ? ` · ${p.ciudad}` : ''}`,
    `Teléfono: ${p.telefono} · Correo: ${p.email}`,
  ].join('\n');

  const existing = await findExistingLead(p.email, null);
  if (existing) {
    const tags = parseEtiquetas(existing.etiquetas);
    if (!tags.some(t => t.trim().toUpperCase() === ETIQUETA)) tags.push(ETIQUETA);
    await db.update(crmSeguimientoClientes).set({
      etiquetas: JSON.stringify(tags),
      segmento: existing.segmento || SEGMENTO_CRM,
      telefono: existing.telefono || p.telefono,
      empresa: existing.empresa || p.ferreteria,
      comuna: existing.comuna || p.ciudad || null,
      ultimoContacto: new Date(),
      updatedAt: new Date(),
    }).where(eq(crmSeguimientoClientes.id, existing.id));
    await db.insert(crmSeguimientoHitos).values({
      seguimientoId: existing.id, tipo: 'contacto', descripcion: detalle,
      autorId: AUTOR_ID, autorNombre: AUTOR_NOMBRE, autoDetectado: true,
    });
    return existing.id;
  }

  const owner = await resolveOwnerForSegmento(SEGMENTO_VALUE);
  if (!owner) {
    console.warn(`[Memorice] Sin encargado de Ferretería: el lead de ${p.email} queda "${VENDEDOR_SIN_ASIGNAR_NOMBRE}".`);
  }
  const [created] = await db.insert(crmSeguimientoClientes).values({
    nombre: p.nombre,
    telefono: p.telefono,
    email: p.email,
    empresa: p.ferreteria,
    comuna: p.ciudad || null,
    segmento: SEGMENTO_CRM,
    vendedorId: owner?.id || VENDEDOR_SIN_ASIGNAR_ID,
    vendedorNombre: owner?.name || VENDEDOR_SIN_ASIGNAR_NOMBRE,
    estado: 'prospecto',
    origen: 'manual',
    etiquetas: JSON.stringify([ETIQUETA]),
    notas: detalle,
    ultimoContacto: new Date(),
  }).returning();
  await db.insert(crmSeguimientoHitos).values({
    seguimientoId: created.id, tipo: 'contacto', descripcion: detalle,
    autorId: AUTOR_ID, autorNombre: AUTOR_NOMBRE, autoDetectado: true,
  });
  await logPanelChange(null, {
    section: 'crm',
    action: 'created',
    entityType: 'crm_cliente',
    entityId: created.id,
    title: `"${created.nombre}" (${p.ferreteria}) entró al CRM desde el Memorice de la Feria Redmat`,
    segmento: normalizePanelSegmento(created.segmento),
  });
  return created.id;
}

function htmlPath(): string | null {
  const candidates = [
    path.resolve(process.cwd(), 'dist', 'public', 'memorice', 'index.html'),
    path.resolve(process.cwd(), 'client', 'public', 'memorice', 'index.html'),
  ];
  return candidates.find(p => fs.existsSync(p)) || null;
}

export function registerMemoriceRoutes(app: Express) {
  app.get(['/memorice', '/memorice/'], (_req, res) => {
    const file = htmlPath();
    if (!file) return res.status(404).send('Memorice no disponible');
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(file);
  });

  app.get('/api/public/memorice/ranking', async (req, res) => {
    try {
      const dia = typeof req.query.dia === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.dia) ? req.query.dia : diaChile();
      const lista = mejorPorPersona(await partidasDelDia(dia));
      res.json({
        dia,
        hoy: diaChile(),
        jugadores: lista.length,
        top: lista.slice(0, 10).map(r => ({ nombre: r.nombre, ferreteria: r.ferreteria, ciudad: r.ciudad, ms: r.ms })),
      });
    } catch (err: any) {
      console.error('[Memorice] ranking:', err?.message || err);
      res.status(500).json({ message: 'No se pudo cargar el ranking' });
    }
  });

  app.post('/api/public/memorice/partidas', async (req, res) => {
    if (rateLimited(req)) return res.status(429).json({ message: 'Demasiadas partidas seguidas. Espera un momento.' });
    const parsed = partidaSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Revisa tus datos.', errors: parsed.error.errors });
    const p = parsed.data;
    const dia = diaChile();
    try {
      const [row] = await db.insert(juegoMemoricePartidas).values({
        evento: EVENTO, dia,
        nombre: p.nombre, ferreteria: p.ferreteria, ciudad: p.ciudad || null,
        telefono: p.telefono, telefonoNorm: normTel(p.telefono), email: p.email,
        ms: p.ms, intentos: p.intentos,
      }).returning();

      try {
        const leadId = await syncJugadorCrm(p, dia);
        if (leadId) {
          await db.update(juegoMemoricePartidas).set({ crmSeguimientoId: leadId })
            .where(eq(juegoMemoricePartidas.id, row.id));
        }
      } catch (err: any) {
        console.error('[Memorice] No se pudo llevar al jugador al CRM:', err?.message || err);
      }

      const lista = mejorPorPersona(await partidasDelDia(dia));
      const idx = lista.findIndex(r => r.telefonoNorm === row.telefonoNorm);
      const mejor = lista[idx];
      res.json({
        dia,
        posicion: idx + 1,
        jugadores: lista.length,
        mejorMs: mejor?.ms ?? row.ms,
        esMejor: mejor?.id === row.id,
      });
    } catch (err: any) {
      console.error('[Memorice] guardar partida:', err?.message || err);
      res.status(500).json({ message: 'No se pudo guardar la partida' });
    }
  });

  app.get('/api/memorice/admin', requireAuth, requireAdminOrSupervisor, async (req, res) => {
    try {
      const dias = await db.selectDistinct({ dia: juegoMemoricePartidas.dia }).from(juegoMemoricePartidas)
        .where(eq(juegoMemoricePartidas.evento, EVENTO));
      const dia = typeof req.query.dia === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.dia) ? req.query.dia : diaChile();
      const rows = await partidasDelDia(dia);
      const lista = mejorPorPersona(rows);
      res.json({
        dia,
        dias: Array.from(new Set([...dias.map(d => d.dia), diaChile()])).sort(),
        partidas: rows.length,
        ranking: lista.map((r, i) => ({
          lugar: i + 1, nombre: r.nombre, ferreteria: r.ferreteria, ciudad: r.ciudad,
          telefono: r.telefono, email: r.email, ms: r.ms, tiempo: fmt(r.ms), intentos: r.intentos,
          crmSeguimientoId: r.crmSeguimientoId, hora: r.createdAt,
        })),
      });
    } catch (err: any) {
      console.error('[Memorice] admin:', err?.message || err);
      res.status(500).json({ message: 'No se pudo cargar el panel' });
    }
  });
}

