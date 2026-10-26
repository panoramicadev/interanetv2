/**
 * Solicitud de Muestra: el vendedor pide una muestra (producto, color o material
 * de exhibición) para un cliente que ya existe.
 *
 * Flujo (oct-2026):
 *  1. pendiente — la aprueba o la rechaza el supervisor de quien la pide (o el
 *     admin). Sin supervisor asignado, cualquier usuario con rol supervisor.
 *  2. en_curso — Franco (permiso "Muestras: NVV y cierre") crea la NVV y la
 *     registra acá; laboratorio y logística ("Muestras: preparar y conversar")
 *     la preparan. Todos conversan en el hilo con el vendedor y el supervisor.
 *  3. cerrada — Franco la cierra cuando la muestra se entregó. Necesita la NVV.
 *
 * Quién ve qué:
 *  - quien pide ve las suyas; su supervisor, las de su equipo;
 *  - laboratorio y logística, todas las aprobadas (en curso y cerradas);
 *  - Administración y admin, todas.
 *
 * El correo nunca hace fallar la operación: lo que se guardó queda guardado.
 */
import type { Express } from 'express';
import { and, desc, eq, inArray, isNull, or, sql, type SQL } from 'drizzle-orm';
import { db } from './db';
import { requireAuth } from './auth';
import { requirePermission, userHasPermission } from './permissions';
import { emailService } from './services/email';
import {
  emailNotificationSettings,
  insertSolicitudMuestraSchema,
  salespeopleUsers,
  solicitudesMuestra,
  solicitudMuestraMensajes,
  type ItemSolicitudMuestra,
  type SolicitudMuestra,
} from '../shared/schema';

/**
 * Destinatario fijo del aviso de muestra aprobada: Franco crea la NVV. Se puede
 * reemplazar desde Configuración → Correos con el tipo 'solicitud_muestra'.
 */
const CORREO_ADMINISTRACION = 'fparra@pinturaspanoramica.cl';

/** Quienes preparan la muestra y conversan en el hilo, además de los permisos. */
const ROLES_LABORATORIO = ['laboratorio'];
const ROLES_LOGISTICA = ['logistica_bodega', 'area_logistica'];

const TIPO_TEXTO: Record<string, string> = {
  producto: 'producto de línea',
  color: 'desarrollo',
  material: 'material de exhibición',
};

const nombreDe = (u: any): string =>
  u?.salespersonName || `${u?.firstName ?? ''} ${u?.lastName ?? ''}`.trim() || u?.email || 'Sin nombre';

const escapar = (v: unknown) =>
  String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

// Quienes no participan en las muestras aunque su rol les dé todos los permisos
// (yoel paredes es admin, oct-2026): no las ven, no las aprueban ni las gestionan.
const FUERA_DE_MUESTRAS = new Set(['yparedes@pinturaspanoramica.cl']);
const fueraDeMuestras = (u: any) => FUERA_DE_MUESTRAS.has(String(u?.email ?? '').trim().toLowerCase());

const gestiona = async (u: any) => !fueraDeMuestras(u) && (await userHasPermission(u, 'solicitud_muestra.gestion'));
const veBandeja = async (u: any) =>
  !fueraDeMuestras(u) && ((await gestiona(u)) || (await userHasPermission(u, 'solicitud_muestra.bandeja')));

/** Base de los enlaces de los correos: la del despliegue o la del propio request. */
function urlBase(req: any): string {
  const origen = (req.headers?.origin as string | undefined) || '';
  return (process.env.PUBLIC_APP_URL || process.env.APP_URL || origen || '').replace(/\/+$/, '');
}

const enlace = (req: any, id: string) => `${urlBase(req)}/solicitud-muestra?id=${id}`;

/** Supervisor de quien pide, del maestro de usuarios (cualquier rol puede tener). */
async function supervisorDe(usuarioId: string): Promise<string | null> {
  const [fila] = await db
    .select({ supervisorId: salespeopleUsers.supervisorId })
    .from(salespeopleUsers)
    .where(eq(salespeopleUsers.id, usuarioId));
  return fila?.supervisorId ?? null;
}

// Quien no aprueba a su supervisor del maestro sino a otra persona: las muestras
// de Patricio Ghisellini (supervisor) las aprueba Paolo Chaparro (oct-2026).
const APROBADOR_ESPECIAL: Record<string, string> = {
  'pghisellini@pinturaspanoramica.cl': 'pandreschaparro@pinturaspanoramica.cl',
};

/** Quien aprueba las muestras de este usuario: el aprobador especial o su supervisor. */
async function aprobadorDe(usuario: any): Promise<string | null> {
  const especial = APROBADOR_ESPECIAL[String(usuario?.email ?? '').trim().toLowerCase()];
  if (especial) {
    const [fila] = await db
      .select({ id: salespeopleUsers.id })
      .from(salespeopleUsers)
      .where(and(eq(salespeopleUsers.email, especial), eq(salespeopleUsers.isActive, true)));
    if (fila) return fila.id;
  }
  return supervisorDe(usuario.id);
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

async function correosDeRoles(roles: string[]): Promise<string[]> {
  const filas = await db
    .select({ email: salespeopleUsers.email })
    .from(salespeopleUsers)
    .where(and(inArray(salespeopleUsers.role, roles), eq(salespeopleUsers.isActive, true)));
  return filas.map((f) => f.email).filter((e): e is string => !!e);
}

/** Administración: lo configurado en Configuración → Correos, o Franco. */
async function correosAdministracion(): Promise<string[]> {
  try {
    const [config] = await db
      .select()
      .from(emailNotificationSettings)
      .where(eq(emailNotificationSettings.notificationType, 'solicitud_muestra'));
    if (config && config.enabled !== false) {
      const lista = (config.recipients ?? '').split(/[,;\n\r]+/).map((s) => s.trim()).filter(Boolean);
      if (lista.length > 0) return lista;
    }
  } catch (error: any) {
    console.error('[muestras] no se pudo leer la configuración de correos:', error.message);
  }
  return [CORREO_ADMINISTRACION];
}

const itemsDe = (s: SolicitudMuestra): ItemSolicitudMuestra[] =>
  Array.isArray(s.items) ? (s.items as ItemSolicitudMuestra[]) : [];

function fichaHtml(s: SolicitudMuestra): string {
  const fila = (label: string, valor: unknown) =>
    valor === null || valor === undefined || valor === ''
      ? ''
      : `<tr><td style="padding:4px 12px 4px 0;color:#64748b;font-size:13px">${label}</td>
           <td style="padding:4px 0;color:#0f172a;font-size:13px;font-weight:600">${escapar(valor)}</td></tr>`;
  const items = itemsDe(s)
    .map(
      (i) =>
        `<li style="font-size:13px;color:#0f172a;margin:2px 0"><strong>${i.cantidad ? `${i.cantidad} × ` : ''}${escapar(i.formato)}</strong> · ${escapar(i.producto)}${i.sku ? ` (${escapar(i.sku)})` : ''}${
          i.color ? ` · ${escapar(i.color)}` : ''
        }</li>`,
    )
    .join('');
  return `
    <table style="border-collapse:collapse;margin:12px 0 4px">
      ${fila('Tipo de muestra', TIPO_TEXTO[s.tipo] ?? s.tipo)}
      ${fila('Cliente', [s.clienteNombre, s.clienteRut].filter(Boolean).join(' · '))}
      ${fila(s.tipo === 'material' ? 'Sucursal' : 'Obra / Sucursal', s.obra)}
      ${fila('Motivo', s.motivo)}
      ${fila('Pedida por', s.solicitanteNombre)}
      ${fila('NVV', s.nvvNumero)}
    </table>
    ${items ? `<ul style="margin:4px 0 12px;padding-left:18px">${items}</ul>` : ''}`;
}

const boton = (url: string, texto: string) =>
  url
    ? `<p style="margin:16px 0"><a href="${url}" style="background:#fd6301;color:#fff;padding:10px 16px;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px">${texto}</a></p>`
    : '';

/** Manda un correo sin frenar nada: si falla, queda en el log. */
function enviar(opciones: { to: string[]; cc?: string[]; excluir?: string[]; subject: string; html: string }) {
  const fuera = new Set((opciones.excluir ?? []).map((e) => e.toLowerCase()));
  const to = Array.from(new Set(opciones.to)).filter((e) => !fuera.has(e.toLowerCase()));
  const cc = Array.from(new Set(opciones.cc ?? [])).filter((e) => !to.includes(e) && !fuera.has(e.toLowerCase()));
  if (to.length === 0) {
    console.warn('[muestras] aviso sin destinatarios:', opciones.subject);
    return;
  }
  emailService
    .sendEmail({ to: to.join(', '), cc: cc.length ? cc.join(', ') : undefined, subject: opciones.subject, html: opciones.html })
    .catch((error: any) => console.error('[muestras] no se pudo enviar el aviso:', error?.message));
}

const asunto = (s: SolicitudMuestra, que: string) => `${que} · muestra #${s.numero} · ${s.clienteNombre}`;

/**
 * Planificación ve las solicitudes de todos los vendedores, pero de mirón:
 * no aprueba (ver `puedeAprobar`) ni escribe en las ajenas.
 */
const esObservador = (u: any) => u?.role === 'planificacion';
const esAjena = (u: any, s: SolicitudMuestra) => s.solicitanteId !== u.id && s.supervisorId !== u.id;

/** Lo que el usuario puede ver. `undefined` = todo. */
async function alcance(usuario: any): Promise<SQL | undefined> {
  if (await gestiona(usuario)) return undefined;
  if (esObservador(usuario)) return undefined;
  const condiciones: SQL[] = [
    eq(solicitudesMuestra.solicitanteId, usuario.id),
    eq(solicitudesMuestra.supervisorId, usuario.id),
  ];
  // Sin supervisor asignado, la aprueba cualquier supervisor: tiene que verla.
  if (usuario.role === 'supervisor') condiciones.push(isNull(solicitudesMuestra.supervisorId));
  if (await veBandeja(usuario)) condiciones.push(inArray(solicitudesMuestra.estado, ['en_curso', 'cerrada']));
  return or(...condiciones);
}

function puedeAprobar(usuario: any, s: SolicitudMuestra): boolean {
  if (s.estado !== 'pendiente' || fueraDeMuestras(usuario)) return false;
  if (usuario.role === 'admin') return true;
  if (s.supervisorId) return s.supervisorId === usuario.id;
  return usuario.role === 'supervisor';
}

/** Cómo aparece el autor en el hilo, según su papel en ESTA solicitud. */
async function rolEnHilo(usuario: any, s: SolicitudMuestra): Promise<string> {
  if (s.solicitanteId === usuario.id) return 'Solicitante';
  if (s.supervisorId === usuario.id || (!s.supervisorId && usuario.role === 'supervisor')) return 'Supervisor';
  if (ROLES_LABORATORIO.includes(usuario.role)) return 'Laboratorio';
  if (ROLES_LOGISTICA.includes(usuario.role)) return 'Logística';
  if (await gestiona(usuario)) return 'Administración';
  return 'Panorámica';
}

async function buscar(usuario: any, id: string): Promise<SolicitudMuestra | null> {
  const filtro = await alcance(usuario);
  const [s] = await db
    .select()
    .from(solicitudesMuestra)
    .where(filtro ? and(eq(solicitudesMuestra.id, id), filtro) : eq(solicitudesMuestra.id, id));
  return s ?? null;
}

async function registrarEvento(
  s: SolicitudMuestra,
  usuario: any,
  evento: string | null,
  texto: string | null,
  adjunto?: { url?: string | null; nombre?: string | null },
) {
  await db.insert(solicitudMuestraMensajes).values({
    solicitudId: s.id,
    autorId: usuario?.id ?? null,
    autorNombre: nombreDe(usuario),
    autorRol: await rolEnHilo(usuario, s),
    texto,
    evento,
    adjuntoUrl: adjunto?.url ?? null,
    adjuntoNombre: adjunto?.nombre ?? null,
  });
  await db
    .update(solicitudesMuestra)
    .set({ ultimoMovimientoAt: sql`now()`, updatedAt: sql`now()` })
    .where(eq(solicitudesMuestra.id, s.id));
}

/** Todos los que participan de una muestra aprobada, para avisarles de un mensaje. */
async function participantes(s: SolicitudMuestra): Promise<string[]> {
  const autores = await db
    .selectDistinct({ id: solicitudMuestraMensajes.autorId })
    .from(solicitudMuestraMensajes)
    .where(eq(solicitudMuestraMensajes.solicitudId, s.id));
  const correos = await correosDe([s.solicitanteId, s.supervisorId, ...autores.map((a) => a.id)]);
  if (s.estado === 'en_curso') {
    correos.push(...(await correosAdministracion()));
    correos.push(...(await correosDeRoles([...ROLES_LABORATORIO, ...ROLES_LOGISTICA])));
  }
  return Array.from(new Set(correos));
}

export function registerSolicitudesMuestraRoutes(app: Express) {
  // ── Listado ──────────────────────────────────────────────────────────────
  app.get('/api/solicitudes-muestra', requireAuth, async (req: any, res) => {
    try {
      const usuario = req.user;
      if (!(await userHasPermission(usuario, 'solicitud_muestra')) && !(await veBandeja(usuario))) {
        return res.status(403).json({ message: 'Acceso denegado. No tienes habilitado este módulo.' });
      }
      const filtro = await alcance(usuario);
      const filas = await db
        .select({
          solicitud: solicitudesMuestra,
          mensajes: sql<number>`(SELECT count(*)::int FROM solicitud_muestra_mensajes m WHERE m.solicitud_id = ${solicitudesMuestra.id} AND m.evento IS NULL)`,
        })
        .from(solicitudesMuestra)
        .where(filtro)
        .orderBy(desc(solicitudesMuestra.ultimoMovimientoAt))
        .limit(500);

      res.json(filas.map(({ solicitud: s, mensajes }) => ({ ...s, mensajes, puedeAprobar: puedeAprobar(usuario, s) })));
    } catch (error: any) {
      console.error('[muestras] no se pudo listar:', error.message);
      res.status(500).json({ message: 'No se pudieron cargar las solicitudes' });
    }
  });

  // ── Detalle ──────────────────────────────────────────────────────────────
  app.get('/api/solicitudes-muestra/:id', requireAuth, async (req: any, res) => {
    try {
      const s = await buscar(req.user, req.params.id);
      if (!s) return res.status(404).json({ message: 'Solicitud no encontrada' });
      const mensajes = await db
        .select()
        .from(solicitudMuestraMensajes)
        .where(eq(solicitudMuestraMensajes.solicitudId, s.id))
        .orderBy(solicitudMuestraMensajes.createdAt);
      res.json({
        ...s,
        mensajes,
        puedeAprobar: puedeAprobar(req.user, s),
        puedeGestionar: s.estado === 'en_curso' && (await gestiona(req.user)),
      });
    } catch (error: any) {
      console.error('[muestras] no se pudo leer la solicitud:', error.message);
      res.status(500).json({ message: 'No se pudo cargar la solicitud' });
    }
  });

  // ── Crear ────────────────────────────────────────────────────────────────
  app.post('/api/solicitudes-muestra', requireAuth, requirePermission('solicitud_muestra'), async (req: any, res) => {
    try {
      const parsed = insertSolicitudMuestraSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: parsed.error.errors[0]?.message || 'Datos de la solicitud inválidos',
          errors: parsed.error.errors,
        });
      }
      const usuario = req.user;
      const d = parsed.data;
      const [nueva] = await db
        .insert(solicitudesMuestra)
        .values({
          ...d,
          clienteRut: d.clienteRut || null,
          obra: d.obra || null,
          motivo: d.motivo || null,
          items: d.items.map((i) => ({
            producto: i.producto,
            sku: i.sku || null,
            color: i.color || null,
            formato: i.formato,
            cantidad: d.tipo === 'material' ? null : i.cantidad ?? null,
          })),
          estado: 'pendiente',
          solicitanteId: usuario.id,
          solicitanteNombre: nombreDe(usuario),
          supervisorId: await aprobadorDe(usuario),
        })
        .returning();
      await registrarEvento(nueva, usuario, 'creada', null);

      // El aviso va a quien la aprueba: su supervisor o, si no tiene, los supervisores.
      const aprobadores = nueva.supervisorId ? await correosDe([nueva.supervisorId]) : await correosDeRoles(['supervisor']);
      enviar({
        to: aprobadores,
        cc: await correosDe([usuario.id]),
        subject: asunto(nueva, 'Aprobar'),
        html: `
          <p style="font-size:15px;color:#0f172a"><strong>${escapar(nueva.solicitanteNombre)}</strong> pide una muestra de
            <strong>${TIPO_TEXTO[nueva.tipo]}</strong> para <strong>${escapar(nueva.clienteNombre)}</strong>.
            Necesita tu aprobación.</p>
          ${fichaHtml(nueva)}
          ${boton(enlace(req, nueva.id), 'Aprobar o rechazar')}`,
      });

      const [aprobador] = nueva.supervisorId
        ? await db.select({ nombre: salespeopleUsers.salespersonName }).from(salespeopleUsers).where(eq(salespeopleUsers.id, nueva.supervisorId))
        : [];
      res.status(201).json({ ...nueva, aprobadorNombre: aprobador?.nombre ?? null });
    } catch (error: any) {
      console.error('[muestras] no se pudo crear la solicitud:', error);
      res.status(500).json({ message: 'No se pudo enviar la solicitud' });
    }
  });

  // ── Supervisor: aprobar o rechazar ───────────────────────────────────────
  app.post('/api/solicitudes-muestra/:id/aprobacion', requireAuth, async (req: any, res) => {
    try {
      const aprobar = req.body?.aprobar === true;
      const motivo = String(req.body?.motivo ?? '').trim().slice(0, 4000);
      if (!aprobar && !motivo) {
        return res.status(400).json({ message: 'Indica el motivo del rechazo: es lo que lee quien la pidió.' });
      }
      const s = await buscar(req.user, req.params.id);
      if (!s) return res.status(404).json({ message: 'Solicitud no encontrada' });
      if (!puedeAprobar(req.user, s)) {
        return res.status(s.estado === 'pendiente' ? 403 : 409).json({
          message: s.estado === 'pendiente' ? 'La aprueba el supervisor de quien la pidió.' : 'La solicitud ya no está pendiente.',
        });
      }

      const [actualizada] = await db
        .update(solicitudesMuestra)
        .set({
          estado: aprobar ? 'en_curso' : 'rechazada',
          aprobadaPorId: req.user.id,
          aprobadaPorNombre: nombreDe(req.user),
          aprobadaAt: sql`now()`,
          motivoRechazo: aprobar ? null : motivo,
        })
        .where(and(eq(solicitudesMuestra.id, s.id), eq(solicitudesMuestra.estado, 'pendiente')))
        .returning();
      if (!actualizada) return res.status(409).json({ message: 'La solicitud ya no está pendiente.' });
      await registrarEvento(actualizada, req.user, aprobar ? 'aprobada' : 'rechazada', motivo || null);

      if (aprobar) {
        // Franco crea la NVV; laboratorio y logística la preparan.
        enviar({
          to: await correosAdministracion(),
          cc: [
            ...(await correosDe([s.solicitanteId, s.supervisorId])),
            ...(await correosDeRoles([...ROLES_LABORATORIO, ...ROLES_LOGISTICA])),
          ],
          subject: asunto(actualizada, 'Crear NVV'),
          html: `
            <p style="font-size:15px;color:#0f172a"><strong>${escapar(nombreDe(req.user))}</strong>
              <strong style="color:#047857">aprobó</strong> la muestra #${actualizada.numero}. Queda en curso: falta crear la NVV
              y preparar la muestra.</p>
            ${motivo ? `<p style="font-size:14px;color:#0f172a"><strong>Comentario:</strong> ${escapar(motivo)}</p>` : ''}
            ${fichaHtml(actualizada)}
            ${boton(enlace(req, s.id), 'Ver la solicitud')}`,
        });
      } else {
        enviar({
          to: await correosDe([s.solicitanteId]),
          subject: asunto(actualizada, 'Rechazada'),
          html: `
            <p style="font-size:15px;color:#0f172a"><strong>${escapar(nombreDe(req.user))}</strong>
              <strong style="color:#b91c1c">rechazó</strong> la muestra #${actualizada.numero} para ${escapar(actualizada.clienteNombre)}.</p>
            <p style="font-size:14px;color:#0f172a"><strong>Motivo:</strong> ${escapar(motivo)}</p>
            ${boton(enlace(req, s.id), 'Ver la solicitud')}`,
        });
      }
      res.json(actualizada);
    } catch (error: any) {
      console.error('[muestras] no se pudo aprobar/rechazar:', error.message);
      res.status(500).json({ message: 'No se pudo guardar la decisión' });
    }
  });

  // ── Administración: registrar la NVV ─────────────────────────────────────
  app.post(
    '/api/solicitudes-muestra/:id/nvv',
    requireAuth,
    requirePermission('solicitud_muestra.gestion'),
    async (req: any, res) => {
      try {
        const nvv = String(req.body?.nvv ?? '').trim().slice(0, 40);
        if (!nvv) return res.status(400).json({ message: 'Indica el número de la NVV.' });
        const s = await buscar(req.user, req.params.id);
        if (!s) return res.status(404).json({ message: 'Solicitud no encontrada' });
        if (s.estado !== 'en_curso') return res.status(409).json({ message: 'La NVV se registra con la muestra en curso.' });

        const [actualizada] = await db
          .update(solicitudesMuestra)
          .set({ nvvNumero: nvv, nvvRegistradaPorNombre: nombreDe(req.user), nvvRegistradaAt: sql`now()` })
          .where(eq(solicitudesMuestra.id, s.id))
          .returning();
        await registrarEvento(actualizada, req.user, 'nvv', `NVV ${nvv}`);
        res.json(actualizada);
      } catch (error: any) {
        console.error('[muestras] no se pudo registrar la NVV:', error.message);
        res.status(500).json({ message: 'No se pudo registrar la NVV' });
      }
    },
  );

  // ── Administración: cerrar (la muestra se entregó) ───────────────────────
  app.post(
    '/api/solicitudes-muestra/:id/cerrar',
    requireAuth,
    requirePermission('solicitud_muestra.gestion'),
    async (req: any, res) => {
      try {
        const comentario = String(req.body?.comentario ?? '').trim().slice(0, 4000);
        const s = await buscar(req.user, req.params.id);
        if (!s) return res.status(404).json({ message: 'Solicitud no encontrada' });
        if (s.estado !== 'en_curso') return res.status(409).json({ message: 'Solo se cierra una muestra en curso.' });
        if (!s.nvvNumero) return res.status(400).json({ message: 'Registra la NVV antes de cerrarla.' });

        const [actualizada] = await db
          .update(solicitudesMuestra)
          .set({ estado: 'cerrada', cerradaPorId: req.user.id, cerradaPorNombre: nombreDe(req.user), cerradaAt: sql`now()` })
          .where(and(eq(solicitudesMuestra.id, s.id), eq(solicitudesMuestra.estado, 'en_curso')))
          .returning();
        if (!actualizada) return res.status(409).json({ message: 'Solo se cierra una muestra en curso.' });
        await registrarEvento(actualizada, req.user, 'cerrada', comentario || null);

        enviar({
          to: await correosDe([s.solicitanteId]),
          cc: await correosDe([s.supervisorId]),
          subject: asunto(actualizada, 'Entregada'),
          html: `
            <p style="font-size:15px;color:#0f172a">La muestra #${actualizada.numero} para ${escapar(actualizada.clienteNombre)}
              se <strong style="color:#047857">entregó</strong> y quedó cerrada (NVV ${escapar(actualizada.nvvNumero)}).</p>
            ${comentario ? `<p style="font-size:14px;color:#0f172a"><strong>Comentario:</strong> ${escapar(comentario)}</p>` : ''}
            ${boton(enlace(req, s.id), 'Ver la solicitud')}`,
        });
        res.json(actualizada);
      } catch (error: any) {
        console.error('[muestras] no se pudo cerrar:', error.message);
        res.status(500).json({ message: 'No se pudo cerrar la solicitud' });
      }
    },
  );

  // ── Conversación ─────────────────────────────────────────────────────────
  app.post('/api/solicitudes-muestra/:id/mensajes', requireAuth, async (req: any, res) => {
    try {
      const s = await buscar(req.user, req.params.id);
      if (!s) return res.status(404).json({ message: 'Solicitud no encontrada' });
      if (esObservador(req.user) && esAjena(req.user, s)) {
        return res.status(403).json({ message: 'Solo puedes ver esta solicitud: no es tuya.' });
      }
      if (s.estado === 'rechazada' || s.estado === 'cerrada') {
        return res.status(409).json({ message: 'La solicitud ya está cerrada.' });
      }
      const texto = String(req.body?.texto ?? '').trim().slice(0, 4000);
      const adjuntoUrl = req.body?.adjuntoUrl ? String(req.body.adjuntoUrl) : null;
      const adjuntoNombre = req.body?.adjuntoNombre ? String(req.body.adjuntoNombre).slice(0, 200) : null;
      if (!texto && !adjuntoUrl) return res.status(400).json({ message: 'Escribe un mensaje o adjunta un archivo.' });

      await registrarEvento(s, req.user, null, texto || null, { url: adjuntoUrl, nombre: adjuntoNombre });

      enviar({
        to: await participantes(s),
        excluir: req.user.email ? [req.user.email] : [],
        subject: asunto(s, 'Mensaje'),
        html: `
          <p style="font-size:15px;color:#0f172a"><strong>${escapar(nombreDe(req.user))}</strong> escribió en la muestra
            #${s.numero} (${escapar(s.clienteNombre)}):</p>
          ${texto ? `<blockquote style="margin:12px 0;padding:8px 12px;border-left:3px solid #fd6301;color:#0f172a;font-size:14px">${escapar(texto).replace(/\n/g, '<br>')}</blockquote>` : ''}
          ${adjuntoUrl ? `<p style="font-size:13px">Adjuntó <a href="${escapar(adjuntoUrl)}" style="color:#fd6301">${escapar(adjuntoNombre || 'un archivo')}</a>.</p>` : ''}
          ${boton(enlace(req, s.id), 'Responder en la intranet')}`,
      });
      res.status(201).json({ ok: true });
    } catch (error: any) {
      console.error('[muestras] no se pudo guardar el mensaje:', error.message);
      res.status(500).json({ message: 'No se pudo enviar el mensaje' });
    }
  });
}
