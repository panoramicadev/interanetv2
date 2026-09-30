/**
 * Solicitudes a laboratorio de tintometría: el vendedor pide la fórmula y/o el
 * precio de un color para un cliente; laboratorio responde en el panel.
 *
 * Reemplaza la planilla "Solicitud de fórmula tintométrica" que circulaba por
 * correo: los mismos datos (cliente, ciudad, obra, color, cartilla, línea,
 * base, patrón y lote), pero con estado, un hilo de mensajes y avisos.
 *
 * Quién ve qué:
 *  - quien pide ve las suyas; su supervisor, las de su equipo;
 *  - laboratorio ("Bandeja de laboratorio") ve todas y responde;
 *  - la fórmula que responde laboratorio queda en la carta de colores, ligada al
 *    cliente y la obra, y la ve solo quien tiene "Ver fórmulas": el vendedor se
 *    entera de que está lista y del precio, no de las dosis (decisión de
 *    Panorámica, sep-2026: por ahora las fórmulas las ve solo el operador).
 *
 * El correo nunca hace fallar la operación: lo que se guardó queda guardado.
 */
import type { Express } from 'express';
import { and, desc, eq, inArray, or, sql } from 'drizzle-orm';
import { db } from './db';
import { requireAuth } from './auth';
import { requirePermission, userHasPermission } from './permissions';
import { emailService } from './services/email';
import {
  emailNotificationSettings,
  insertTintoSolicitudSchema,
  responderTintoSolicitudSchema,
  salespeopleUsers,
  tintoColores,
  tintoFormulas,
  tintoSolicitudMensajes,
  tintoSolicitudes,
  type TintoSolicitud,
} from '../shared/schema';
import { leerDosis, nombreCartilla, type ItemFormula } from '../shared/tintometria';

type Lado = 'solicitante' | 'laboratorio';

const TIPO_TEXTO: Record<string, string> = {
  formula: 'fórmula',
  precio: 'precio',
  formula_precio: 'fórmula y precio',
};

const nombreDe = (u: any): string =>
  u?.salespersonName || `${u?.firstName ?? ''} ${u?.lastName ?? ''}`.trim() || u?.email || 'Sin nombre';

const esLaboratorio = (u: any) => userHasPermission(u, 'tintometria.laboratorio');

const money = (v: unknown) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? `$${Math.round(n).toLocaleString('es-CL')}` : '—';
};

const escapar = (v: unknown) =>
  String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Base de los enlaces de los correos: la del despliegue o la del propio request. */
function urlBase(req: any): string {
  const origen = (req.headers?.origin as string | undefined) || '';
  return (process.env.PUBLIC_APP_URL || process.env.APP_URL || origen || '').replace(/\/+$/, '');
}

/** Supervisor de quien pide, del maestro de usuarios (cualquier rol puede tener). */
async function supervisorDe(usuarioId: string): Promise<string | null> {
  const [fila] = await db
    .select({ supervisorId: salespeopleUsers.supervisorId })
    .from(salespeopleUsers)
    .where(eq(salespeopleUsers.id, usuarioId));
  return fila?.supervisorId ?? null;
}

async function correosDe(ids: (string | null | undefined)[]): Promise<string[]> {
  const limpios = ids.filter((id): id is string => !!id);
  if (limpios.length === 0) return [];
  const filas = await db
    .select({ email: salespeopleUsers.email })
    .from(salespeopleUsers)
    .where(inArray(salespeopleUsers.id, limpios));
  return filas.map((f) => f.email).filter((e): e is string => !!e);
}

/** Correos de laboratorio: los configurados en Configuración → Correos y los usuarios con ese rol. */
async function correosLaboratorio(): Promise<string[]> {
  const correos: string[] = [];
  try {
    const [config] = await db
      .select()
      .from(emailNotificationSettings)
      .where(eq(emailNotificationSettings.notificationType, 'solicitud_laboratorio'));
    if (config && config.enabled !== false) {
      correos.push(...(config.recipients ?? '').split(/[,;\n\r]+/).map((s) => s.trim()).filter(Boolean));
    }
  } catch (error: any) {
    console.error('[laboratorio] no se pudo leer la configuración de correos:', error.message);
  }
  const lab = await db
    .select({ email: salespeopleUsers.email })
    .from(salespeopleUsers)
    .where(and(eq(salespeopleUsers.role, 'laboratorio'), eq(salespeopleUsers.isActive, true)));
  correos.push(...lab.map((l) => l.email).filter((e): e is string => !!e));
  return Array.from(new Set(correos));
}

function fichaHtml(s: TintoSolicitud): string {
  const fila = (label: string, valor: unknown) =>
    valor === null || valor === undefined || valor === ''
      ? ''
      : `<tr><td style="padding:4px 12px 4px 0;color:#64748b;font-size:13px">${label}</td>
           <td style="padding:4px 0;color:#0f172a;font-size:13px;font-weight:600">${escapar(valor)}</td></tr>`;
  return `
    <table style="border-collapse:collapse;margin:12px 0">
      ${fila('Pide', TIPO_TEXTO[s.tipo] ?? s.tipo)}
      ${fila('Cliente', s.clienteNombre)}
      ${fila('Ciudad', s.ciudad)}
      ${fila('Obra', s.obra)}
      ${fila('Color', [s.colorCodigo, s.colorNombre].filter(Boolean).join(' · '))}
      ${fila('Cartilla', s.cartilla ? nombreCartilla(s.cartilla) : null)}
      ${fila('Línea a desarrollar', s.linea)}
      ${fila('Base', s.base)}
      ${fila('Formato', s.formato)}
      ${fila('Cantidad estimada', s.cantidad)}
      ${fila('Patrón', s.patron)}
      ${fila('Lote', s.lote)}
      ${fila('Observaciones', s.observaciones)}
      ${fila('Vendedor', s.solicitanteNombre)}
    </table>`;
}

const boton = (url: string, texto: string) =>
  url
    ? `<p style="margin:16px 0"><a href="${url}" style="background:#fd6301;color:#fff;padding:10px 16px;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px">${texto}</a></p>`
    : '';

/** Manda un correo sin frenar nada: si falla, queda en el log. */
function enviar(opciones: { to: string[]; cc?: string[]; subject: string; html: string }) {
  const to = Array.from(new Set(opciones.to));
  const cc = Array.from(new Set(opciones.cc ?? [])).filter((e) => !to.includes(e));
  if (to.length === 0) {
    console.warn('[laboratorio] aviso sin destinatarios:', opciones.subject);
    return;
  }
  emailService
    .sendEmail({ to: to.join(', '), cc: cc.length ? cc.join(', ') : undefined, subject: opciones.subject, html: opciones.html })
    .catch((error: any) => console.error('[laboratorio] no se pudo enviar el aviso:', error?.message));
}

/** Lo que el usuario puede ver: laboratorio y admin todo; el resto, lo suyo y lo de su equipo. */
async function alcance(usuario: any) {
  if (await esLaboratorio(usuario)) return undefined;
  return or(eq(tintoSolicitudes.solicitanteId, usuario.id), eq(tintoSolicitudes.supervisorId, usuario.id));
}

/** De qué lado de la solicitud está el usuario: quien pide (y su supervisor) o laboratorio. */
async function ladoDe(usuario: any, s: TintoSolicitud): Promise<Lado> {
  if (s.solicitanteId === usuario.id || s.supervisorId === usuario.id) return 'solicitante';
  return 'laboratorio';
}

async function buscar(usuario: any, id: string): Promise<TintoSolicitud | null> {
  const filtro = await alcance(usuario);
  const [s] = await db
    .select()
    .from(tintoSolicitudes)
    .where(filtro ? and(eq(tintoSolicitudes.id, id), filtro) : eq(tintoSolicitudes.id, id));
  return s ?? null;
}

async function registrarEvento(
  solicitudId: string,
  usuario: any,
  lado: Lado,
  evento: string | null,
  texto: string | null,
  adjunto?: { url?: string | null; nombre?: string | null },
) {
  await db.insert(tintoSolicitudMensajes).values({
    solicitudId,
    autorId: usuario?.id ?? null,
    autorNombre: nombreDe(usuario),
    lado,
    texto,
    evento,
    adjuntoUrl: adjunto?.url ?? null,
    adjuntoNombre: adjunto?.nombre ?? null,
  });
  // Lo que escribe un lado queda como visto por ese lado y "nuevo" para el otro.
  await db
    .update(tintoSolicitudes)
    .set({
      ultimoMovimientoAt: sql`now()`,
      ultimoMovimientoDe: lado,
      ...(lado === 'solicitante' ? { vistaSolicitanteAt: sql`now()` } : { vistaLaboratorioAt: sql`now()` }),
      updatedAt: sql`now()`,
    })
    .where(eq(tintoSolicitudes.id, solicitudId));
}

/** Normaliza el código del color para guardarlo en la carta: "SW 7019" → "SW7019". */
function codigoParaCarta(cartilla: string, codigo: string): string {
  const c = codigo.trim().toUpperCase().replace(/\s+/g, ' ');
  if (cartilla === 'SW') {
    const m = /^SW[\s-]?(\d+)$/.exec(c) ?? /^(\d{4})$/.exec(c);
    if (m) return `SW${m[1]}`;
  }
  return c;
}

/** "Sherwin Williams", "SW", "sw " → "SW"; "Panorámica" → "PANORAMICA"; el resto en mayúsculas. */
function cartillaParaCarta(cartilla: string | null | undefined): string {
  const n = String(cartilla ?? '').trim().toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (!n) return 'OTRA';
  if (n === 'SW' || n.includes('SHERWIN')) return 'SW';
  if (n.includes('PANORAMICA') || n.includes('COPPER')) return 'PANORAMICA';
  return n.slice(0, 40);
}

export function registerTintometriaSolicitudesRoutes(app: Express) {
  // ── Listado ──────────────────────────────────────────────────────────────
  app.get('/api/tintometria/solicitudes', requireAuth, async (req: any, res) => {
    try {
      const usuario = req.user;
      const lab = await esLaboratorio(usuario);
      if (!lab && !(await userHasPermission(usuario, 'tintometria.solicitudes'))) {
        return res.status(403).json({ message: 'Acceso denegado. No tienes habilitado este módulo.' });
      }
      const filtro = await alcance(usuario);
      const filas = await db
        .select({
          solicitud: tintoSolicitudes,
          hex: tintoColores.hex,
          mensajes: sql<number>`(SELECT count(*)::int FROM tinto_solicitud_mensajes m WHERE m.solicitud_id = ${tintoSolicitudes.id} AND m.evento IS NULL)`,
        })
        .from(tintoSolicitudes)
        .leftJoin(tintoColores, eq(tintoColores.id, tintoSolicitudes.colorId))
        .where(filtro)
        .orderBy(desc(tintoSolicitudes.ultimoMovimientoAt))
        .limit(500);

      res.json(
        filas.map(({ solicitud: s, hex, mensajes }) => {
          const lado: Lado = s.solicitanteId === usuario.id || s.supervisorId === usuario.id ? 'solicitante' : 'laboratorio';
          const vista = lado === 'solicitante' ? s.vistaSolicitanteAt : s.vistaLaboratorioAt;
          const nueva =
            s.ultimoMovimientoDe !== lado &&
            (!vista || (s.ultimoMovimientoAt != null && new Date(s.ultimoMovimientoAt) > new Date(vista)));
          return { ...s, hex, mensajes, lado, nueva };
        }),
      );
    } catch (error: any) {
      console.error('[laboratorio] no se pudo listar:', error.message);
      res.status(500).json({ message: 'No se pudieron cargar las solicitudes' });
    }
  });

  /** Cuántas esperan que el usuario las mire: el número del menú. */
  app.get('/api/tintometria/solicitudes/pendientes', requireAuth, async (req: any, res) => {
    try {
      const usuario = req.user;
      const lab = await esLaboratorio(usuario);
      // IS NOT DISTINCT FROM y no "=": sin supervisor, "supervisor_id = X" da NULL
      // y el NOT de abajo dejaba afuera justo las solicitudes nuevas.
      const propias = sql`(${tintoSolicitudes.solicitanteId} IS NOT DISTINCT FROM ${usuario.id}
        OR ${tintoSolicitudes.supervisorId} IS NOT DISTINCT FROM ${usuario.id})`;
      const nuevasPropias = sql`(${propias} AND ${tintoSolicitudes.ultimoMovimientoDe} = 'laboratorio'
        AND (${tintoSolicitudes.vistaSolicitanteAt} IS NULL OR ${tintoSolicitudes.ultimoMovimientoAt} > ${tintoSolicitudes.vistaSolicitanteAt}))`;
      // Para laboratorio cuenta lo que está abierto y trae algo sin mirar.
      const nuevasLab = sql`(NOT ${propias} AND ${tintoSolicitudes.estado} IN ('enviada', 'en_desarrollo')
        AND ${tintoSolicitudes.ultimoMovimientoDe} = 'solicitante'
        AND (${tintoSolicitudes.vistaLaboratorioAt} IS NULL OR ${tintoSolicitudes.ultimoMovimientoAt} > ${tintoSolicitudes.vistaLaboratorioAt}))`;
      const [fila] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(tintoSolicitudes)
        .where(lab ? sql`(${nuevasPropias} OR ${nuevasLab})` : nuevasPropias);
      res.json({ count: fila?.n ?? 0 });
    } catch (error: any) {
      console.error('[laboratorio] no se pudo contar pendientes:', error.message);
      res.json({ count: 0 });
    }
  });

  // ── Detalle ──────────────────────────────────────────────────────────────
  app.get('/api/tintometria/solicitudes/:id', requireAuth, async (req: any, res) => {
    try {
      const s = await buscar(req.user, req.params.id);
      if (!s) return res.status(404).json({ message: 'Solicitud no encontrada' });

      const mensajes = await db
        .select()
        .from(tintoSolicitudMensajes)
        .where(eq(tintoSolicitudMensajes.solicitudId, s.id))
        .orderBy(tintoSolicitudMensajes.createdAt);

      const [color] = s.colorId
        ? await db.select().from(tintoColores).where(eq(tintoColores.id, s.colorId))
        : [];

      // La fórmula solo para quien tiene "Ver fórmulas"; al resto le basta con
      // saber que está lista.
      let formula = null;
      if (s.formulaId && (await userHasPermission(req.user, 'tintometria.formulas'))) {
        const [f] = await db.select().from(tintoFormulas).where(eq(tintoFormulas.id, s.formulaId));
        formula = f ?? null;
      }

      res.json({
        ...s,
        lado: await ladoDe(req.user, s),
        puedeResponder: await esLaboratorio(req.user),
        color: color ?? null,
        formula,
        mensajes,
      });
    } catch (error: any) {
      console.error('[laboratorio] no se pudo leer la solicitud:', error.message);
      res.status(500).json({ message: 'No se pudo cargar la solicitud' });
    }
  });

  /** Marca la solicitud como vista por el lado del usuario (apaga el "nuevo"). */
  app.post('/api/tintometria/solicitudes/:id/visto', requireAuth, async (req: any, res) => {
    try {
      const s = await buscar(req.user, req.params.id);
      if (!s) return res.status(404).json({ message: 'Solicitud no encontrada' });
      const lado = await ladoDe(req.user, s);
      await db
        .update(tintoSolicitudes)
        .set(lado === 'solicitante' ? { vistaSolicitanteAt: sql`now()` } : { vistaLaboratorioAt: sql`now()` })
        .where(eq(tintoSolicitudes.id, s.id));
      res.json({ ok: true });
    } catch (error: any) {
      res.status(500).json({ message: 'No se pudo marcar como vista' });
    }
  });

  // ── Crear ────────────────────────────────────────────────────────────────
  app.post(
    '/api/tintometria/solicitudes',
    requireAuth,
    requirePermission('tintometria.solicitudes'),
    async (req: any, res) => {
      try {
        const parsed = insertTintoSolicitudSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({
            message: parsed.error.errors[0]?.message || 'Datos de la solicitud inválidos',
            errors: parsed.error.errors,
          });
        }
        const usuario = req.user;
        const d = parsed.data;
        const [nueva] = await db
          .insert(tintoSolicitudes)
          .values({
            ...d,
            adjuntos: d.adjuntos ?? [],
            estado: 'enviada',
            solicitanteId: usuario.id,
            solicitanteNombre: nombreDe(usuario),
            supervisorId: await supervisorDe(usuario.id),
            vistaSolicitanteAt: sql`now()`,
            ultimoMovimientoDe: 'solicitante',
          })
          .returning();

        await db.insert(tintoSolicitudMensajes).values({
          solicitudId: nueva.id,
          autorId: usuario.id,
          autorNombre: nombreDe(usuario),
          lado: 'solicitante',
          evento: 'creada',
        });

        const enlace = `${urlBase(req)}/tintometria/solicitudes?id=${nueva.id}`;
        enviar({
          to: await correosLaboratorio(),
          cc: [...(await correosDe([usuario.id, nueva.supervisorId]))],
          subject: `Solicitud a laboratorio #${nueva.numero} · ${TIPO_TEXTO[nueva.tipo]} · ${nueva.colorCodigo} · ${nueva.clienteNombre}`,
          html: `
            <p style="font-size:15px;color:#0f172a"><strong>${escapar(nueva.solicitanteNombre)}</strong> pide
              <strong>${TIPO_TEXTO[nueva.tipo]}</strong> para el color <strong>${escapar(nueva.colorCodigo)}</strong>.</p>
            ${fichaHtml(nueva)}
            ${boton(enlace, 'Ver la solicitud')}`,
        });

        res.status(201).json(nueva);
      } catch (error: any) {
        console.error('[laboratorio] no se pudo crear la solicitud:', error);
        res.status(500).json({ message: 'No se pudo enviar la solicitud' });
      }
    },
  );

  // ── Mensajes ─────────────────────────────────────────────────────────────
  app.post('/api/tintometria/solicitudes/:id/mensajes', requireAuth, async (req: any, res) => {
    try {
      const s = await buscar(req.user, req.params.id);
      if (!s) return res.status(404).json({ message: 'Solicitud no encontrada' });
      const texto = String(req.body?.texto ?? '').trim().slice(0, 4000);
      const adjuntoUrl = req.body?.adjuntoUrl ? String(req.body.adjuntoUrl) : null;
      const adjuntoNombre = req.body?.adjuntoNombre ? String(req.body.adjuntoNombre).slice(0, 200) : null;
      if (!texto && !adjuntoUrl) return res.status(400).json({ message: 'Escribe un mensaje o adjunta un archivo.' });

      const lado = await ladoDe(req.user, s);
      await registrarEvento(s.id, req.user, lado, null, texto || null, { url: adjuntoUrl, nombre: adjuntoNombre });

      // El aviso va al otro lado de la conversación.
      const enlace = `${urlBase(req)}/tintometria/solicitudes?id=${s.id}`;
      const destinatarios =
        lado === 'solicitante' ? await correosLaboratorio() : await correosDe([s.solicitanteId, s.supervisorId]);
      enviar({
        to: destinatarios,
        subject: `Mensaje en la solicitud a laboratorio #${s.numero} · ${s.colorCodigo} · ${s.clienteNombre}`,
        html: `
          <p style="font-size:15px;color:#0f172a"><strong>${escapar(nombreDe(req.user))}</strong> escribió en la solicitud
            #${s.numero} (${escapar(s.colorCodigo)}, ${escapar(s.clienteNombre)}):</p>
          ${texto ? `<blockquote style="margin:12px 0;padding:8px 12px;border-left:3px solid #fd6301;color:#0f172a;font-size:14px">${escapar(texto).replace(/\n/g, '<br>')}</blockquote>` : ''}
          ${adjuntoUrl ? `<p style="font-size:13px">Adjuntó <a href="${escapar(adjuntoUrl)}" style="color:#fd6301">${escapar(adjuntoNombre || 'un archivo')}</a>.</p>` : ''}
          ${boton(enlace, 'Responder en el panel')}`,
      });

      res.status(201).json({ ok: true });
    } catch (error: any) {
      console.error('[laboratorio] no se pudo guardar el mensaje:', error.message);
      res.status(500).json({ message: 'No se pudo enviar el mensaje' });
    }
  });

  // ── Laboratorio: en desarrollo / rechazar ───────────────────────────────
  app.patch(
    '/api/tintometria/solicitudes/:id/estado',
    requireAuth,
    requirePermission('tintometria.laboratorio'),
    async (req: any, res) => {
      try {
        const estado = String(req.body?.estado ?? '');
        const motivo = String(req.body?.motivo ?? '').trim().slice(0, 4000);
        if (!['en_desarrollo', 'rechazada'].includes(estado)) {
          return res.status(400).json({ message: 'Estado inválido' });
        }
        if (estado === 'rechazada' && !motivo) {
          return res.status(400).json({ message: 'Indica el motivo del rechazo: es lo que lee el vendedor.' });
        }
        const s = await buscar(req.user, req.params.id);
        if (!s) return res.status(404).json({ message: 'Solicitud no encontrada' });
        if (s.estado === 'respondida' || s.estado === 'rechazada') {
          return res.status(409).json({ message: 'La solicitud ya está cerrada.' });
        }

        await db
          .update(tintoSolicitudes)
          .set({
            estado,
            ...(estado === 'rechazada'
              ? {
                  respuesta: motivo,
                  respondidaPorId: req.user.id,
                  respondidaPorNombre: nombreDe(req.user),
                  respondidaAt: sql`now()`,
                }
              : {}),
          })
          .where(eq(tintoSolicitudes.id, s.id));
        await registrarEvento(s.id, req.user, 'laboratorio', estado, estado === 'rechazada' ? motivo : null);

        if (estado === 'rechazada') {
          enviar({
            to: await correosDe([s.solicitanteId]),
            cc: await correosDe([s.supervisorId]),
            subject: `Laboratorio rechazó la solicitud #${s.numero} · ${s.colorCodigo} · ${s.clienteNombre}`,
            html: `
              <p style="font-size:15px;color:#0f172a">Laboratorio <strong style="color:#b91c1c">rechazó</strong> la solicitud
                #${s.numero} (${escapar(s.colorCodigo)} para ${escapar(s.clienteNombre)}).</p>
              <p style="font-size:14px;color:#0f172a"><strong>Motivo:</strong> ${escapar(motivo)}</p>
              ${boton(`${urlBase(req)}/tintometria/solicitudes?id=${s.id}`, 'Ver la solicitud')}`,
          });
        }
        res.json({ ok: true });
      } catch (error: any) {
        console.error('[laboratorio] no se pudo cambiar el estado:', error.message);
        res.status(500).json({ message: 'No se pudo cambiar el estado' });
      }
    },
  );

  // ── Laboratorio: responder ───────────────────────────────────────────────
  app.post(
    '/api/tintometria/solicitudes/:id/respuesta',
    requireAuth,
    requirePermission('tintometria.laboratorio'),
    async (req: any, res) => {
      try {
        const parsed = responderTintoSolicitudSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({ message: parsed.error.errors[0]?.message || 'Respuesta inválida' });
        }
        const d = parsed.data;
        const s = await buscar(req.user, req.params.id);
        if (!s) return res.status(404).json({ message: 'Solicitud no encontrada' });
        if (s.estado === 'respondida' || s.estado === 'rechazada') {
          return res.status(409).json({ message: 'La solicitud ya está cerrada.' });
        }

        const pideFormula = s.tipo === 'formula' || s.tipo === 'formula_precio';
        const pidePrecio = s.tipo === 'precio' || s.tipo === 'formula_precio';
        const items = (d.items ?? []).filter((i) => i.colorante && i.dosis);
        if (pideFormula && items.length === 0) {
          return res.status(400).json({ message: 'Carga al menos un colorante con su dosis.' });
        }
        if (pideFormula && !d.galones) {
          return res.status(400).json({ message: 'Indica para cuántos galones es la fórmula.' });
        }
        const malas = items.filter((i) => !leerDosis(i.dosis));
        if (malas.length > 0) {
          return res.status(400).json({
            message: `Dosis que no se entiende: ${malas.map((m) => `${m.colorante} ${m.dosis}`).join(', ')}. Se escribe como en el libro, por ejemplo 1Y30 o 0Y12-1.`,
          });
        }
        if (pidePrecio && (d.precio === null || d.precio === undefined)) {
          return res.status(400).json({ message: 'Indica el precio.' });
        }

        let formulaId: string | null = null;
        if (pideFormula) {
          // El color: el de la carta si se eligió de ahí; si no, se crea en su
          // cartilla (RAL, NCS o la que venga) para que la fórmula tenga dónde vivir.
          let colorId = s.colorId;
          if (!colorId) {
            const cartilla = cartillaParaCarta(s.cartilla);
            const codigo = codigoParaCarta(cartilla, s.colorCodigo);
            await db
              .insert(tintoColores)
              .values({ cartilla, codigo, nombre: s.colorNombre ?? null })
              .onConflictDoNothing();
            const [c] = await db
              .select({ id: tintoColores.id })
              .from(tintoColores)
              .where(and(eq(tintoColores.cartilla, cartilla), eq(tintoColores.codigo, codigo)));
            colorId = c.id;
          }
          const galones = String(d.galones);
          const itemsFormula: ItemFormula[] = items.map((i) => {
            // La dosis queda tal como la escribió laboratorio (con la Y en mayúscula).
            const dosis = i.dosis.replace(/y/g, 'Y').replace(/\s+/g, '');
            const leida = leerDosis(dosis)!;
            return {
              colorante: i.colorante.toUpperCase(),
              dosis: { [galones]: dosis },
              rayasPorGalon: Math.round((leida.totalRayas / Number(galones)) * 10000) / 10000,
            };
          });
          const [f] = await db
            .insert(tintoFormulas)
            .values({
              colorId,
              linea: s.linea.toUpperCase(),
              base: (d.base || s.base || 'SIN BASE').toUpperCase(),
              origen: 'laboratorio',
              items: itemsFormula,
              observaciones: d.respuesta ?? null,
              clienteId: s.clienteId,
              obra: s.obra,
              solicitudId: s.id,
              creadoPorId: req.user.id,
              creadoPorNombre: nombreDe(req.user),
            })
            .returning({ id: tintoFormulas.id });
          formulaId = f.id;
          if (!s.colorId) {
            await db.update(tintoSolicitudes).set({ colorId }).where(eq(tintoSolicitudes.id, s.id));
          }
        }

        const [actualizada] = await db
          .update(tintoSolicitudes)
          .set({
            estado: 'respondida',
            formulaId,
            precio: pidePrecio && d.precio != null ? String(d.precio) : null,
            precioUnidad: pidePrecio ? d.precioUnidad ?? null : null,
            respuesta: d.respuesta ?? null,
            respondidaPorId: req.user.id,
            respondidaPorNombre: nombreDe(req.user),
            respondidaAt: sql`now()`,
          })
          .where(eq(tintoSolicitudes.id, s.id))
          .returning();
        await registrarEvento(s.id, req.user, 'laboratorio', 'respondida', d.respuesta ?? null);

        const partes = [
          formulaId ? 'la fórmula ya está en la carta de colores para el operador' : null,
          pidePrecio ? `el precio es ${money(d.precio)}${d.precioUnidad ? ` ${escapar(d.precioUnidad)}` : ''}` : null,
        ].filter(Boolean);
        enviar({
          to: await correosDe([s.solicitanteId]),
          cc: await correosDe([s.supervisorId]),
          subject: `Laboratorio respondió la solicitud #${s.numero} · ${s.colorCodigo} · ${s.clienteNombre}`,
          html: `
            <p style="font-size:15px;color:#0f172a">Laboratorio respondió la solicitud #${s.numero}
              (${escapar(s.colorCodigo)} para ${escapar(s.clienteNombre)}): ${partes.join(' y ')}.</p>
            ${d.respuesta ? `<p style="font-size:14px;color:#0f172a"><strong>Observaciones:</strong> ${escapar(d.respuesta)}</p>` : ''}
            ${boton(`${urlBase(req)}/tintometria/solicitudes?id=${s.id}`, 'Ver la respuesta')}`,
        });

        res.json(actualizada);
      } catch (error: any) {
        console.error('[laboratorio] no se pudo responder:', error);
        res.status(500).json({ message: 'No se pudo guardar la respuesta' });
      }
    },
  );
}
