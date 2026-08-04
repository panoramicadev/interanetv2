/**
 * Solicitud de Crédito — el vendedor pide, Finanzas resuelve.
 *
 * Antes vivía como una pestaña maqueta dentro de /facturas: el submit hacía
 * console.log y limpiaba el formulario. Acá la solicitud se guarda, se avisa por
 * correo y queda con su estado hasta que Finanzas la aprueba o la rechaza.
 *
 * Quién ve qué:
 *  - el vendedor ve las suyas;
 *  - el supervisor, las de su equipo;
 *  - Finanzas (admin, recursos_humanos, encargado_area) y quien tenga el módulo,
 *    todas — son ellos los que resuelven.
 *
 * El correo NUNCA hace fallar el envío: la solicitud ya quedó guardada, así que
 * si el correo se cae se registra el error y la solicitud sigue en pantalla.
 */
import type { Express } from 'express';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from './db';
import { requireAuth } from './auth';
import { emailService } from './services/email';
import {
  emailNotificationSettings,
  insertSolicitudCreditoSchema,
  resolverSolicitudCreditoSchema,
  salespeopleUsers,
  solicitudesCredito,
  type SolicitudCredito,
} from '../shared/schema';

/** Resuelven solicitudes (aprobar / rechazar). */
const ROLES_FINANZAS = ['admin', 'supervisor', 'encargado_area', 'recursos_humanos'];
/** Ven todas las solicitudes, resuelvan o no. */
const ROLES_VEN_TODO = ['admin', 'supervisor', 'encargado_area', 'recursos_humanos', 'reception'];

const nombreDe = (usuario: any): string =>
  usuario?.salespersonName
  || `${usuario?.firstName ?? ''} ${usuario?.lastName ?? ''}`.trim()
  || usuario?.email
  || 'Sin nombre';

const money = (valor: unknown) => {
  const n = Number(valor ?? 0);
  return Number.isFinite(n) ? `$${Math.round(n).toLocaleString('es-CL')}` : '—';
};

/** Supervisor a cargo de un vendedor, según el maestro de vendedores. */
async function supervisorDeVendedor(vendedorId: string): Promise<string | null> {
  if (!vendedorId) return null;
  const [fila] = await db
    .select({ supervisorId: salespeopleUsers.supervisorId })
    .from(salespeopleUsers)
    .where(eq(salespeopleUsers.id, vendedorId));
  return fila?.supervisorId ?? null;
}

/** Emails del supervisor de un vendedor y del propio vendedor, para la copia. */
async function correosDeCopia(solicitanteId: string | null, supervisorId: string | null): Promise<string[]> {
  const ids = [solicitanteId, supervisorId].filter((id): id is string => !!id);
  if (ids.length === 0) return [];
  const filas = await db
    .select({ email: salespeopleUsers.email })
    .from(salespeopleUsers)
    .where(inArray(salespeopleUsers.id, ids));
  return filas.map((f) => f.email).filter((e): e is string => !!e);
}

/** Destinatarios configurados en Configuración → Correos (pueden no existir). */
async function destinatariosConfigurados(): Promise<{ to: string[]; cc: string[] }> {
  try {
    const [config] = await db
      .select()
      .from(emailNotificationSettings)
      .where(eq(emailNotificationSettings.notificationType, 'solicitud_credito'));
    if (!config || config.enabled === false) return { to: [], cc: [] };
    const partir = (raw: string | null | undefined) =>
      (raw ?? '').split(/[,;\n\r]+/).map((s) => s.trim()).filter(Boolean);
    return { to: partir(config.recipients), cc: partir(config.ccRecipients) };
  } catch (error: any) {
    console.error('[solicitud-credito] no se pudo leer la configuración de correos:', error.message);
    return { to: [], cc: [] };
  }
}

function cuerpoDelCorreo(s: SolicitudCredito): string {
  const fila = (label: string, valor: unknown) =>
    valor === null || valor === undefined || valor === ''
      ? ''
      : `<tr><td style="padding:4px 12px 4px 0;color:#64748b;font-size:13px">${label}</td>
           <td style="padding:4px 0;color:#0f172a;font-size:13px;font-weight:600">${valor}</td></tr>`;

  return `
    <p style="font-size:15px;color:#0f172a">
      <strong>${s.solicitanteNombre ?? 'Un vendedor'}</strong> envió una solicitud de crédito para
      <strong>${s.razonSocial}</strong>.
    </p>
    <table style="border-collapse:collapse;margin:12px 0">
      ${fila('RUT', s.rut)}
      ${fila('Crédito solicitado', money(s.creditoSolicitado))}
      ${fila('Giro', s.giro)}
      ${fila('Dirección', `${s.direccion}, ${s.ciudad}`)}
      ${fila('Teléfono', s.telefono)}
      ${fila('Correo', s.correo)}
      ${fila('Representante legal', s.representanteNombre)}
      ${fila('Banco', s.banco1 ? `${s.banco1}${s.cuenta1 ? ` · cuenta ${s.cuenta1}` : ''}` : null)}
    </table>
    ${
      s.carpetaTributariaUrl
        ? `<p style="font-size:14px"><a href="${s.carpetaTributariaUrl}" style="color:#fd6301;font-weight:600">
             Ver carpeta tributaria${s.carpetaTributariaNombre ? ` (${s.carpetaTributariaNombre})` : ''}
           </a></p>`
        : `<p style="font-size:13px;color:#b45309">Se envió <strong>sin carpeta tributaria adjunta</strong>.</p>`
    }
  `;
}

async function avisarPorCorreo(s: SolicitudCredito): Promise<void> {
  const copia = await correosDeCopia(s.solicitanteId, s.supervisorId);
  const config = await destinatariosConfigurados();

  // Sin destinatarios configurados el aviso sale igual: va a quienes sí están
  // definidos (supervisor y vendedor). Perder el aviso por una configuración
  // vacía sería peor que mandarlo solo a ellos.
  const to = config.to.length > 0 ? config.to : copia;
  if (to.length === 0) {
    console.warn('[solicitud-credito] sin destinatarios: no hay correos configurados ni del solicitante/supervisor');
    return;
  }
  const cc = Array.from(new Set([...config.cc, ...(config.to.length > 0 ? copia : [])])).filter(
    (email) => !to.includes(email),
  );

  await emailService.sendEmail({
    to: to.join(', '),
    cc: cc.length ? cc.join(', ') : undefined,
    subject: `Solicitud de crédito · ${s.razonSocial} · ${money(s.creditoSolicitado)}`,
    html: cuerpoDelCorreo(s),
  });
}

export function registerSolicitudesCreditoRoutes(app: Express): void {
  // Listado. El alcance lo decide el rol, no un parámetro.
  app.get('/api/solicitudes-credito', requireAuth, async (req: any, res) => {
    try {
      const usuario = req.user;
      let filas: SolicitudCredito[];

      if (ROLES_VEN_TODO.includes(usuario.role)) {
        if (usuario.role === 'supervisor' || usuario.role === 'encargado_area') {
          // Su equipo: las que él mismo envió más las de sus vendedores.
          const equipo = await db
            .select({ id: salespeopleUsers.id })
            .from(salespeopleUsers)
            .where(eq(salespeopleUsers.supervisorId, usuario.id));
          const ids = [usuario.id, ...equipo.map((e) => e.id)];
          filas = await db
            .select()
            .from(solicitudesCredito)
            .where(inArray(solicitudesCredito.solicitanteId, ids))
            .orderBy(desc(solicitudesCredito.createdAt));
        } else {
          filas = await db.select().from(solicitudesCredito).orderBy(desc(solicitudesCredito.createdAt));
        }
      } else {
        filas = await db
          .select()
          .from(solicitudesCredito)
          .where(eq(solicitudesCredito.solicitanteId, usuario.id))
          .orderBy(desc(solicitudesCredito.createdAt));
      }

      res.json(filas);
    } catch (error: any) {
      console.error('❌ Error al listar solicitudes de crédito:', error);
      res.status(500).json({ message: 'Error al obtener las solicitudes', error: error.message });
    }
  });

  app.post('/api/solicitudes-credito', requireAuth, async (req: any, res) => {
    try {
      const parsed = insertSolicitudCreditoSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: 'Datos de la solicitud inválidos', errors: parsed.error.errors });
      }

      const usuario = req.user;
      // El supervisor sale del maestro de vendedores, no del formulario: es
      // justamente lo que antes había que vincular a mano.
      const supervisorId =
        usuario.role === 'salesperson' ? await supervisorDeVendedor(usuario.id) : null;

      const [nueva] = await db
        .insert(solicitudesCredito)
        .values({
          ...parsed.data,
          correo: parsed.data.correo || null,
          creditoSolicitado: String(parsed.data.creditoSolicitado),
          estado: 'enviada',
          solicitanteId: usuario.id,
          solicitanteNombre: nombreDe(usuario),
          supervisorId,
        })
        .returning();

      // El correo va después de guardar y no puede voltear el request: la
      // solicitud ya existe, y un problema de correo no tiene que hacerla perder.
      avisarPorCorreo(nueva).catch((error) =>
        console.error('[solicitud-credito] no se pudo enviar el aviso:', error?.message ?? error),
      );

      res.status(201).json(nueva);
    } catch (error: any) {
      console.error('❌ Error al crear la solicitud de crédito:', error);
      res.status(500).json({ message: 'Error al enviar la solicitud', error: error.message });
    }
  });

  // Resolver: aprobar (con monto) o rechazar (con motivo).
  app.patch('/api/solicitudes-credito/:id', requireAuth, async (req: any, res) => {
    try {
      const usuario = req.user;
      if (!ROLES_FINANZAS.includes(usuario.role)) {
        return res.status(403).json({ message: 'Tu rol no resuelve solicitudes de crédito' });
      }

      const parsed = resolverSolicitudCreditoSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: 'Resolución inválida', errors: parsed.error.errors });
      }

      const [actualizada] = await db
        .update(solicitudesCredito)
        .set({
          estado: parsed.data.estado,
          creditoAprobado:
            parsed.data.estado === 'aprobada' && parsed.data.creditoAprobado != null
              ? String(parsed.data.creditoAprobado)
              : null,
          observaciones: parsed.data.observaciones ?? null,
          resueltaPorId: usuario.id,
          resueltaPorNombre: nombreDe(usuario),
          resueltaAt: new Date(),
          updatedAt: new Date(),
        })
        .where(and(eq(solicitudesCredito.id, req.params.id), eq(solicitudesCredito.estado, 'enviada')))
        .returning();

      if (!actualizada) {
        return res.status(409).json({ message: 'La solicitud no existe o ya estaba resuelta' });
      }

      res.json(actualizada);
    } catch (error: any) {
      console.error('❌ Error al resolver la solicitud de crédito:', error);
      res.status(500).json({ message: 'Error al resolver la solicitud', error: error.message });
    }
  });
}
