/**
 * Nuevo Cliente — el vendedor pide el alta, Administración crea el cliente.
 *
 * Acá NO se crea el cliente en el ERP: se registra la solicitud con todo lo que
 * hace falta para crearlo bien a la primera y se avisa por correo a Franco, con
 * copia al supervisor del vendedor y al propio vendedor.
 *
 * El módulo está disponible para todos los roles: cualquiera que trate con un
 * cliente nuevo tiene que poder pedir el alta. Lo que cambia por rol es el
 * alcance del listado (uno ve las suyas, el supervisor las de su equipo,
 * Administración todas) y quién puede marcar la solicitud como resuelta.
 *
 * El correo NUNCA hace fallar el envío: la solicitud ya quedó guardada, así que
 * si el correo se cae se registra el error y la solicitud sigue en pantalla.
 */
import type { Express } from 'express';
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { db } from './db';
import { requireAuth } from './auth';
import { emailService } from './services/email';
import {
  CONDICIONES_VENTA_NUEVO_CLIENTE,
  emailNotificationSettings,
  insertSolicitudNuevoClienteSchema,
  resolverSolicitudNuevoClienteSchema,
  salespeopleUsers,
  solicitudesNuevoCliente,
  type SolicitudNuevoCliente,
} from '../shared/schema';

/**
 * Destinatario fijo del aviso: Administración crea el cliente en el ERP.
 * Se puede reemplazar desde Configuración → Correos con el tipo
 * 'nuevo_cliente'; mientras no exista esa configuración, va acá.
 */
const CORREO_ADMINISTRACION = 'fparra@pinturaspanoramica.cl';

/** Marcan la solicitud como creada o rechazada. */
const ROLES_RESUELVEN = ['admin', 'supervisor', 'encargado_area', 'recursos_humanos', 'reception'];
/** Ven todas las solicitudes, resuelvan o no. */
const ROLES_VEN_TODO = ['admin', 'supervisor', 'encargado_area', 'recursos_humanos', 'reception'];

/**
 * Segmentos de respaldo. El catálogo real sale de ventas.stg_tabru; si esa
 * consulta falla (base de ventas no disponible en un ambiente local), el
 * formulario no se puede quedar sin opciones: sin segmento no hay alta.
 */
const SEGMENTOS_FALLBACK = ['FERRETERIAS', 'CONSTRUCCION', 'INDUSTRIAL', 'DIGITAL'];

const nombreDe = (usuario: any): string =>
  usuario?.salespersonName
  || `${usuario?.firstName ?? ''} ${usuario?.lastName ?? ''}`.trim()
  || usuario?.email
  || 'Sin nombre';

/** Supervisor a cargo de un vendedor, según el maestro de vendedores. */
async function supervisorDeVendedor(vendedorId: string): Promise<string | null> {
  if (!vendedorId) return null;
  const [fila] = await db
    .select({ supervisorId: salespeopleUsers.supervisorId })
    .from(salespeopleUsers)
    .where(eq(salespeopleUsers.id, vendedorId));
  return fila?.supervisorId ?? null;
}

/** Emails del supervisor y del propio solicitante, para la copia. */
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
      .where(eq(emailNotificationSettings.notificationType, 'nuevo_cliente'));
    if (!config || config.enabled === false) return { to: [], cc: [] };
    const partir = (raw: string | null | undefined) =>
      (raw ?? '').split(/[,;\n\r]+/).map((s) => s.trim()).filter(Boolean);
    return { to: partir(config.recipients), cc: partir(config.ccRecipients) };
  } catch (error: any) {
    console.error('[nuevo-cliente] no se pudo leer la configuración de correos:', error.message);
    return { to: [], cc: [] };
  }
}

const fmtFecha = (valor: Date | string | null | undefined) => {
  if (!valor) return '—';
  const d = new Date(valor as any);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('es-CL');
};

function cuerpoDelCorreo(s: SolicitudNuevoCliente): string {
  const fila = (label: string, valor: unknown) =>
    valor === null || valor === undefined || valor === ''
      ? ''
      : `<tr><td style="padding:4px 12px 4px 0;color:#64748b;font-size:13px">${label}</td>
           <td style="padding:4px 0;color:#0f172a;font-size:13px;font-weight:600">${valor}</td></tr>`;

  const siNo = (v: boolean) => (v ? 'SÍ' : 'NO');

  return `
    <p style="font-size:15px;color:#0f172a">
      <strong>${s.solicitanteNombre ?? 'Un vendedor'}</strong> pidió la creación del cliente
      <strong>${s.razonSocial}</strong>.
    </p>

    <p style="font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#94a3b8;margin:16px 0 4px">
      Datos del cliente
    </p>
    <table style="border-collapse:collapse;margin:0 0 8px">
      ${fila('Segmento', s.segmento)}
      ${fila('RUT', s.rut)}
      ${fila('Nombre / Razón social', s.razonSocial)}
      ${fila('Giro', s.giro)}
      ${fila('Teléfonos', s.telefonos)}
      ${fila('Correo de empresa', s.correoEmpresa)}
      ${fila('Ciudad', s.ciudad)}
      ${fila('Comuna', s.comuna)}
      ${fila('Dirección', s.direccion)}
      ${fila('Vendedor', s.vendedorNombre)}
      ${fila('Condición de venta (inicial)', s.condicionVenta)}
    </table>

    <p style="font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#94a3b8;margin:16px 0 4px">
      Recepción de documentos (facturación electrónica)
    </p>
    <table style="border-collapse:collapse;margin:0 0 8px">
      ${fila('Nombre', s.receptorNombre)}
      ${fila('Correo', s.receptorCorreo)}
      ${fila('Teléfono', s.receptorTelefono)}
    </table>

    <p style="font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#94a3b8;margin:16px 0 4px">
      Requerimientos para la facturación (archivos XML)
    </p>
    <table style="border-collapse:collapse;margin:0 0 8px">
      ${fila('Incluir orden de compra', siNo(s.requiereOrdenCompra))}
      ${fila('Incluir guía de despacho', siNo(s.requiereGuiaDespacho))}
    </table>

    <table style="border-collapse:collapse;margin:16px 0 0">
      ${fila('Solicitante', s.solicitanteNombre)}
      ${fila('Fecha de solicitud', fmtFecha(s.createdAt))}
    </table>
  `;
}

async function avisarPorCorreo(s: SolicitudNuevoCliente): Promise<void> {
  const copia = await correosDeCopia(s.solicitanteId, s.supervisorId);
  const config = await destinatariosConfigurados();

  // Franco por defecto; si Configuración → Correos define destinatarios para
  // 'nuevo_cliente', mandan esos. La copia al supervisor y al solicitante va
  // siempre, en los dos casos.
  const to = config.to.length > 0 ? config.to : [CORREO_ADMINISTRACION];
  const cc = Array.from(new Set([...config.cc, ...copia])).filter((email) => !to.includes(email));

  await emailService.sendEmail({
    to: to.join(', '),
    cc: cc.length ? cc.join(', ') : undefined,
    subject: `Nuevo cliente · ${s.razonSocial} · ${s.rut}`,
    html: cuerpoDelCorreo(s),
  });
}

export function registerNuevoClienteRoutes(app: Express): void {
  /**
   * Catálogos del formulario: segmentos del ERP, vendedores activos y las
   * condiciones de venta con las que puede partir un cliente nuevo.
   *
   * Va en un solo endpoint y con `requireAuth` a secas porque el módulo es para
   * todos los roles: el catálogo de segmentos que usa el CRM exige un permiso
   * que el vendedor común no tiene.
   */
  app.get('/api/nuevo-cliente/catalogos', requireAuth, async (_req: any, res) => {
    let segmentos: string[] = SEGMENTOS_FALLBACK;
    try {
      const result = await db.execute(
        sql`SELECT DISTINCT nokoru FROM ventas.stg_tabru WHERE nokoru IS NOT NULL AND nokoru <> '' ORDER BY nokoru`,
      );
      const desdeErp = (result.rows || [])
        .map((r: any) => String(r.nokoru).trim())
        .filter(Boolean);
      if (desdeErp.length > 0) segmentos = desdeErp;
    } catch (error: any) {
      console.error('[nuevo-cliente] no se pudo leer el catálogo de segmentos:', error.message);
    }

    let vendedores: { id: string; nombre: string }[] = [];
    try {
      const filas = await db
        .select({ id: salespeopleUsers.id, nombre: salespeopleUsers.salespersonName, role: salespeopleUsers.role })
        .from(salespeopleUsers)
        .where(eq(salespeopleUsers.isActive, true))
        .orderBy(asc(salespeopleUsers.salespersonName));
      // Los usuarios de rol "client" son cuentas del Market, no vendedores.
      vendedores = filas
        .filter((f) => f.role !== 'client')
        .map((f) => ({ id: f.id, nombre: f.nombre }));
    } catch (error: any) {
      console.error('[nuevo-cliente] no se pudo leer el maestro de vendedores:', error.message);
    }

    res.json({
      segmentos,
      vendedores,
      condicionesVenta: CONDICIONES_VENTA_NUEVO_CLIENTE,
    });
  });

  // Listado. El alcance lo decide el rol, no un parámetro.
  app.get('/api/solicitudes-nuevo-cliente', requireAuth, async (req: any, res) => {
    try {
      const usuario = req.user;
      let filas: SolicitudNuevoCliente[];

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
            .from(solicitudesNuevoCliente)
            .where(inArray(solicitudesNuevoCliente.solicitanteId, ids))
            .orderBy(desc(solicitudesNuevoCliente.createdAt));
        } else {
          filas = await db
            .select()
            .from(solicitudesNuevoCliente)
            .orderBy(desc(solicitudesNuevoCliente.createdAt));
        }
      } else {
        filas = await db
          .select()
          .from(solicitudesNuevoCliente)
          .where(eq(solicitudesNuevoCliente.solicitanteId, usuario.id))
          .orderBy(desc(solicitudesNuevoCliente.createdAt));
      }

      res.json(filas);
    } catch (error: any) {
      console.error('❌ Error al listar solicitudes de nuevo cliente:', error);
      res.status(500).json({ message: 'Error al obtener las solicitudes', error: error.message });
    }
  });

  app.post('/api/solicitudes-nuevo-cliente', requireAuth, async (req: any, res) => {
    try {
      const parsed = insertSolicitudNuevoClienteSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: 'Datos de la solicitud inválidos', errors: parsed.error.errors });
      }

      const usuario = req.user;
      // El supervisor sale del maestro de vendedores, no del formulario.
      const supervisorId =
        usuario.role === 'salesperson' ? await supervisorDeVendedor(usuario.id) : null;

      const [nueva] = await db
        .insert(solicitudesNuevoCliente)
        .values({
          ...parsed.data,
          vendedorId: parsed.data.vendedorId || null,
          estado: 'enviada',
          solicitanteId: usuario.id,
          solicitanteNombre: nombreDe(usuario),
          supervisorId,
        })
        .returning();

      // El correo va después de guardar y no puede voltear el request: la
      // solicitud ya existe, y un problema de correo no tiene que hacerla perder.
      avisarPorCorreo(nueva).catch((error) =>
        console.error('[nuevo-cliente] no se pudo enviar el aviso:', error?.message ?? error),
      );

      res.status(201).json(nueva);
    } catch (error: any) {
      console.error('❌ Error al crear la solicitud de nuevo cliente:', error);
      res.status(500).json({ message: 'Error al enviar la solicitud', error: error.message });
    }
  });

  // Resolver: marcar el cliente como creado o rechazar la solicitud.
  app.patch('/api/solicitudes-nuevo-cliente/:id', requireAuth, async (req: any, res) => {
    try {
      const usuario = req.user;
      if (!ROLES_RESUELVEN.includes(usuario.role)) {
        return res.status(403).json({ message: 'Tu rol no resuelve solicitudes de nuevo cliente' });
      }

      const parsed = resolverSolicitudNuevoClienteSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: 'Resolución inválida', errors: parsed.error.errors });
      }

      const [actualizada] = await db
        .update(solicitudesNuevoCliente)
        .set({
          estado: parsed.data.estado,
          observaciones: parsed.data.observaciones ?? null,
          resueltaPorId: usuario.id,
          resueltaPorNombre: nombreDe(usuario),
          resueltaAt: new Date(),
          updatedAt: new Date(),
        })
        .where(and(eq(solicitudesNuevoCliente.id, req.params.id), eq(solicitudesNuevoCliente.estado, 'enviada')))
        .returning();

      if (!actualizada) {
        return res.status(409).json({ message: 'La solicitud no existe o ya estaba resuelta' });
      }

      res.json(actualizada);
    } catch (error: any) {
      console.error('❌ Error al resolver la solicitud de nuevo cliente:', error);
      res.status(500).json({ message: 'Error al resolver la solicitud', error: error.message });
    }
  });
}
