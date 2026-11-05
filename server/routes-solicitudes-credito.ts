/**
 * Solicitud de Crédito — el vendedor pide, Finanzas resuelve.
 *
 * Antes vivía como una pestaña maqueta dentro de /facturas: el submit hacía
 * console.log y limpiaba el formulario. Acá la solicitud se guarda, se avisa por
 * correo y queda con su estado hasta que Finanzas la aprueba o la rechaza.
 *
 * Hay dos tipos y siguen el mismo flujo: crédito para un cliente nuevo y aumento
 * de la línea de uno que ya compra (`tipo = 'aumento'`). Cambian los datos que
 * se piden y cómo se lee el correo, no quién pide, ve ni resuelve.
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
/**
 * Marcan "analizando" y NADA más. Recepción recibe las carpetas y avisa que la
 * solicitud está en revisión, pero el monto lo sigue decidiendo Finanzas: si
 * desde acá llega una aprobación o un rechazo, se corta con 403.
 */
const ROLES_SOLO_ANALIZAN = ['reception'];

/**
 * Quien actualiza la ficha del cliente en cuanto hay resolución. Va como
 * destinatario del aviso de aprobación/rechazo junto al vendedor. Si mañana lo
 * hace otra persona, se cambia acá y listo.
 */
const CORREO_FICHA_CLIENTE = 'fparra@pinturaspanoramica.cl';
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

const esAumento = (s: SolicitudCredito) => s.tipo === 'aumento';

/** La línea que tenía el cliente al pedir el aumento. Sin línea se dice, no se muestra $0. */
const lineaActual = (s: SolicitudCredito) =>
  Number(s.creditoActual) > 0 ? money(s.creditoActual) : 'Sin línea';

/** Dirección y ciudad en una sola fila. En un aumento pueden faltar las dos. */
const direccionCompleta = (s: SolicitudCredito) =>
  [s.direccion, s.ciudad].map((v) => v?.trim()).filter(Boolean).join(', ') || null;

/** Supervisor a cargo de un vendedor, según el maestro de vendedores. */
async function supervisorDeVendedor(vendedorId: string): Promise<string | null> {
  if (!vendedorId) return null;
  const [fila] = await db
    .select({ supervisorId: salespeopleUsers.supervisorId })
    .from(salespeopleUsers)
    .where(eq(salespeopleUsers.id, vendedorId));
  return fila?.supervisorId ?? null;
}

/**
 * Correos del vendedor que pidió y de su supervisor, por separado.
 *
 * Van separados a propósito: el supervisor es destinatario (autoriza) y el
 * vendedor va en copia (solo se entera). Antes salían mezclados en la misma
 * bolsa y los dos terminaban en el mismo campo.
 */
async function correosDelFlujo(
  solicitanteId: string | null,
  supervisorId: string | null,
): Promise<{ vendedor: string | null; supervisor: string | null }> {
  const ids = [solicitanteId, supervisorId].filter((id): id is string => !!id);
  if (ids.length === 0) return { vendedor: null, supervisor: null };
  const filas = await db
    .select({ id: salespeopleUsers.id, email: salespeopleUsers.email })
    .from(salespeopleUsers)
    .where(inArray(salespeopleUsers.id, ids));
  const emailDe = (id: string | null) =>
    (id ? filas.find((f) => f.id === id)?.email : null) ?? null;
  return { vendedor: emailDe(solicitanteId), supervisor: emailDe(supervisorId) };
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

  // En un aumento el cliente ya compra: lo que Finanzas necesita ver primero es
  // desde qué línea se sube, hasta cuánto y por qué.
  const cifras = esAumento(s)
    ? `
      ${fila('Línea actual', lineaActual(s))}
      ${fila('Línea solicitada', money(s.creditoSolicitado))}
      ${fila('Plazo actual', s.diasActuales ? `${s.diasActuales} días` : null)}
      ${fila('Plazo solicitado', s.diasSolicitados ? `${s.diasSolicitados} días` : null)}
      ${fila('Motivo del aumento', s.motivo)}`
    : `
      ${fila('Crédito solicitado', money(s.creditoSolicitado))}
      ${fila('Plazo solicitado', s.diasSolicitados ? `${s.diasSolicitados} días` : null)}`;

  return `
    <p style="font-size:15px;color:#0f172a">
      <strong>${s.solicitanteNombre ?? 'Un vendedor'}</strong> envió una solicitud de
      ${esAumento(s) ? '<strong>aumento de crédito</strong>' : 'crédito'} para
      <strong>${s.razonSocial}</strong>${esAumento(s) ? ', que ya es cliente' : ''}.
    </p>
    <table style="border-collapse:collapse;margin:12px 0">
      ${fila('RUT', s.rut)}
      ${cifras}
      ${fila('Giro', s.giro)}
      ${fila('Dirección', direccionCompleta(s))}
      ${fila('Teléfono', s.telefono)}
      ${fila('Correo cobranza', s.correo)}
      ${fila('Correo DTE (SII)', s.correoDte)}
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

/**
 * A quién le llega una solicitud enviada (y después, sus correcciones).
 * null = no hay a quién avisarle.
 */
async function destinatariosDeLaSolicitud(
  s: SolicitudCredito,
): Promise<{ to: string[]; cc: string[] } | null> {
  const { vendedor, supervisor } = await correosDelFlujo(s.solicitanteId, s.supervisorId);
  const config = await destinatariosConfigurados();

  const unicos = (lista: (string | null)[]) =>
    Array.from(new Set(lista.filter((e): e is string => !!e)));

  // Para: los que tienen que actuar — el supervisor del vendedor y quien esté
  // configurado en Configuración → Correos (Finanzas).
  let to = unicos([supervisor, ...config.to]);
  // Copia: los que solo se enteran — el vendedor que la pidió, más los fijos.
  let cc = unicos([vendedor, ...config.cc]).filter((email) => !to.includes(email));

  // Si no hay a quién dirigirla, el aviso sale igual a los de la copia antes que
  // perderse: una configuración vacía no tiene que dejar la solicitud sin avisar.
  if (to.length === 0) {
    to = cc;
    cc = [];
  }
  if (to.length === 0) {
    console.warn('[solicitud-credito] sin destinatarios: no hay correos configurados ni del solicitante/supervisor');
    return null;
  }
  return { to, cc };
}

async function avisarPorCorreo(s: SolicitudCredito): Promise<void> {
  const destinatarios = await destinatariosDeLaSolicitud(s);
  if (!destinatarios) return;
  const { to, cc } = destinatarios;

  const plazo = s.diasSolicitados ? ` a ${s.diasSolicitados} días` : '';
  await emailService.sendEmail({
    to: to.join(', '),
    cc: cc.length ? cc.join(', ') : undefined,
    subject: esAumento(s)
      ? `Solicitud de aumento de crédito · ${s.razonSocial} · ${lineaActual(s)} → ${money(s.creditoSolicitado)}${plazo}`
      : `Solicitud de crédito · ${s.razonSocial} · ${money(s.creditoSolicitado)}${plazo}`,
    html: cuerpoDelCorreo(s),
  });
}

/**
 * Lo que el vendedor puede corregir después de enviarla, con cómo se lee en el
 * correo. Lo del flujo (estado, montos aprobados, la foto de la línea en un
 * aumento) no está: eso no lo cambia el vendedor.
 */
const CAMPOS_EDITABLES: { key: keyof SolicitudCredito; label: string; leer?: (s: SolicitudCredito) => string | null }[] = [
  { key: 'razonSocial', label: 'Razón social' },
  { key: 'rut', label: 'RUT' },
  { key: 'direccion', label: 'Dirección' },
  { key: 'ciudad', label: 'Ciudad' },
  { key: 'telefono', label: 'Teléfono' },
  { key: 'giro', label: 'Giro' },
  { key: 'correo', label: 'Correo cobranza' },
  { key: 'correoDte', label: 'Correo DTE (SII)' },
  { key: 'socio1Nombre', label: 'Socio 1' },
  { key: 'socio1Direccion', label: 'Dirección socio 1' },
  { key: 'socio2Nombre', label: 'Socio 2' },
  { key: 'socio2Direccion', label: 'Dirección socio 2' },
  { key: 'representanteNombre', label: 'Representante legal' },
  { key: 'representanteCedula', label: 'Cédula del representante' },
  { key: 'banco1', label: 'Banco 1' },
  { key: 'cuenta1', label: 'Cuenta 1' },
  { key: 'sucursal1', label: 'Sucursal 1' },
  { key: 'banco2', label: 'Banco 2' },
  { key: 'cuenta2', label: 'Cuenta 2' },
  { key: 'sucursal2', label: 'Sucursal 2' },
  { key: 'creditoSolicitado', label: 'Crédito solicitado', leer: (s) => money(s.creditoSolicitado) },
  { key: 'diasSolicitados', label: 'Plazo solicitado', leer: (s) => (s.diasSolicitados ? `${s.diasSolicitados} días` : null) },
  { key: 'motivo', label: 'Motivo del aumento' },
  {
    key: 'carpetaTributariaUrl',
    label: 'Carpeta tributaria',
    leer: (s) => (s.carpetaTributariaUrl ? s.carpetaTributariaNombre || 'adjunta' : null),
  },
];

/** Qué cambió entre la versión guardada y la corregida, ya legible. */
function cambiosEntre(antes: SolicitudCredito, despues: SolicitudCredito) {
  const leer = (c: (typeof CAMPOS_EDITABLES)[number], s: SolicitudCredito) =>
    (c.leer ? c.leer(s) : (s[c.key] as string | null))?.toString().trim() || null;
  return CAMPOS_EDITABLES
    .map((c) => ({ label: c.label, antes: leer(c, antes), despues: leer(c, despues) }))
    .filter((c) => c.antes !== c.despues);
}

/**
 * Aviso de que el vendedor completó o corrigió una solicitud que ya estaba en
 * la bandeja. Le llega a los mismos que recibieron la original, con lo que
 * cambió: así Finanzas no evalúa con el dato viejo ni tiene que buscar la
 * diferencia.
 */
async function avisarCorreccionPorCorreo(
  s: SolicitudCredito,
  cambios: ReturnType<typeof cambiosEntre>,
): Promise<void> {
  const destinatarios = await destinatariosDeLaSolicitud(s);
  if (!destinatarios) return;
  const { to, cc } = destinatarios;

  const filas = cambios
    .map(
      (c) => `<tr>
        <td style="padding:4px 12px 4px 0;color:#64748b;font-size:13px">${c.label}</td>
        <td style="padding:4px 12px 4px 0;color:#94a3b8;font-size:13px;text-decoration:line-through">${c.antes ?? '—'}</td>
        <td style="padding:4px 0;color:#0f172a;font-size:13px;font-weight:600">${c.despues ?? '—'}</td>
      </tr>`,
    )
    .join('');

  await emailService.sendEmail({
    to: to.join(', '),
    cc: cc.length ? cc.join(', ') : undefined,
    subject: `Solicitud de ${esAumento(s) ? 'aumento de crédito' : 'crédito'} actualizada · ${s.razonSocial}`,
    html: `
      <p style="font-size:15px;color:#0f172a">
        <strong>${s.solicitanteNombre ?? 'El vendedor'}</strong> actualizó la solicitud de
        ${esAumento(s) ? 'aumento de crédito' : 'crédito'} de <strong>${s.razonSocial}</strong>.
      </p>
      <table style="border-collapse:collapse;margin:12px 0">${filas}</table>
      ${
        s.carpetaTributariaUrl
          ? `<p style="font-size:14px"><a href="${s.carpetaTributariaUrl}" style="color:#fd6301;font-weight:600">
               Ver carpeta tributaria${s.carpetaTributariaNombre ? ` (${s.carpetaTributariaNombre})` : ''}
             </a></p>`
          : ''
      }
    `,
  });
}

/** Mientras Finanzas no la cierre, el vendedor todavía puede completarla. */
const ESTADOS_EDITABLES = ['enviada', 'analizando'];

/** Plazo vigente de la solicitud: el aprobado si lo hay, si no el pedido. */
const diasDe = (s: SolicitudCredito) => s.diasAprobados ?? s.diasSolicitados;

/**
 * Cuerpo del aviso de resolución. Lleva lo justo para actualizar la ficha del
 * cliente sin tener que entrar al sistema: cliente, RUT, plazo y monto aprobado.
 */
function cuerpoDeLaResolucion(s: SolicitudCredito): string {
  const aprobada = s.estado === 'aprobada';
  const aumento = esAumento(s);
  const fila = (label: string, valor: unknown) =>
    valor === null || valor === undefined || valor === ''
      ? ''
      : `<tr><td style="padding:4px 12px 4px 0;color:#64748b;font-size:13px">${label}</td>
           <td style="padding:4px 0;color:#0f172a;font-size:13px;font-weight:600">${valor}</td></tr>`;

  // En un aumento lo aprobado es la línea total que queda: se rotula así para
  // que nadie la cargue en la ficha como si fuera lo que se suma.
  return `
    <p style="font-size:15px;color:#0f172a">
      La solicitud de ${aumento ? 'aumento de crédito' : 'crédito'} de <strong>${s.razonSocial}</strong> fue
      <strong style="color:${aprobada ? '#047857' : '#b91c1c'}">${aprobada ? 'APROBADA' : 'RECHAZADA'}</strong>${
        s.resueltaPorNombre ? ` por ${s.resueltaPorNombre}` : ''
      }.
    </p>
    <table style="border-collapse:collapse;margin:12px 0">
      ${fila('Cliente', s.razonSocial)}
      ${fila('RUT', s.rut)}
      ${fila('Días de crédito', diasDe(s) ? `${diasDe(s)} días` : null)}
      ${aumento ? fila('Línea actual', lineaActual(s)) : ''}
      ${fila(aumento ? 'Línea solicitada' : 'Crédito solicitado', money(s.creditoSolicitado))}
      ${aprobada ? fila(aumento ? 'Nueva línea aprobada' : 'Monto aprobado', money(s.creditoAprobado)) : ''}
      ${fila('Vendedor', s.solicitanteNombre)}
      ${fila('Observaciones', s.observaciones)}
    </table>
    ${
      aprobada
        ? `<p style="font-size:13px;color:#475569">Con esto ya se puede actualizar la ficha del cliente.</p>`
        : ''
    }
  `;
}

/**
 * Aviso de resolución: sale solo cuando la solicitud se aprueba o se rechaza
 * (no cuando queda "analizando", porque ahí todavía no hay nada que cargar en la
 * ficha del cliente).
 *
 * Para: el vendedor que la pidió —es quien sigue al cliente— y quien actualiza
 * la ficha. Copia: su supervisor y los correos configurados en Configuración →
 * Correos.
 */
async function avisarResolucionPorCorreo(s: SolicitudCredito): Promise<void> {
  const { vendedor, supervisor } = await correosDelFlujo(s.solicitanteId, s.supervisorId);
  const config = await destinatariosConfigurados();

  const unicos = (lista: (string | null)[]) =>
    Array.from(new Set(lista.filter((e): e is string => !!e)));

  let to = unicos([vendedor, CORREO_FICHA_CLIENTE]);
  let cc = unicos([supervisor, ...config.to, ...config.cc]).filter((email) => !to.includes(email));

  if (to.length === 0) {
    to = cc;
    cc = [];
  }
  if (to.length === 0) {
    console.warn('[solicitud-credito] resolución sin destinatarios: no hay correos del vendedor ni configurados');
    return;
  }

  const aprobada = s.estado === 'aprobada';
  await emailService.sendEmail({
    to: to.join(', '),
    cc: cc.length ? cc.join(', ') : undefined,
    subject: `${esAumento(s) ? 'Aumento de crédito' : 'Crédito'} ${aprobada ? 'APROBADO' : 'RECHAZADO'} · ${s.razonSocial}${
      aprobada ? ` · ${money(s.creditoAprobado)}` : ''
    }${diasDe(s) ? ` a ${diasDe(s)} días` : ''}`,
    html: cuerpoDeLaResolucion(s),
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
      // El supervisor sale del maestro de usuarios, no del formulario: es
      // justamente lo que antes había que vincular a mano. Vale para cualquier
      // rol: desde sep-2026 todo usuario puede tener supervisor, y si la
      // solicitud ya aparece en su lista, también tiene que llegarle el aviso.
      const supervisorId = await supervisorDeVendedor(usuario.id);

      const datos = parsed.data;
      const [nueva] = await db
        .insert(solicitudesCredito)
        .values({
          ...datos,
          correo: datos.correo || null,
          correoDte: datos.correoDte || null,
          creditoSolicitado: String(datos.creditoSolicitado),
          // En un aumento, la línea que el cliente tenía al pedirlo (null = no tenía).
          creditoActual:
            datos.tipo === 'aumento' && datos.creditoActual != null ? String(datos.creditoActual) : null,
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

  // Completar o corregir los datos de una solicitud ya enviada. Al vendedor le
  // falta seguido algún antecedente (pedido del usuario, nov-2026): antes la
  // única salida era mandar otra solicitud. Solo quien la pidió, y solo
  // mientras siga pendiente: una vez resuelta, lo aprobado se apoya en lo que
  // había en ese momento.
  app.patch('/api/solicitudes-credito/:id/datos', requireAuth, async (req: any, res) => {
    try {
      const usuario = req.user;
      const [actual] = await db
        .select()
        .from(solicitudesCredito)
        .where(eq(solicitudesCredito.id, req.params.id));
      if (!actual) return res.status(404).json({ message: 'La solicitud no existe' });
      if (actual.solicitanteId !== usuario.id) {
        return res.status(403).json({ message: 'Solo quien envió la solicitud puede editarla' });
      }
      if (!ESTADOS_EDITABLES.includes(actual.estado)) {
        return res.status(409).json({ message: 'La solicitud ya fue resuelta: no se puede editar' });
      }

      // Las mismas reglas que al enviarla. El tipo, el cliente y la foto de la
      // línea en un aumento no los cambia la corrección: vienen de lo guardado.
      const parsed = insertSolicitudCreditoSchema.safeParse({
        ...req.body,
        tipo: actual.tipo,
        creditoActual: actual.creditoActual,
        diasActuales: actual.diasActuales,
      });
      if (!parsed.success) {
        return res.status(400).json({
          message: parsed.error.errors[0]?.message ?? 'Datos de la solicitud inválidos',
          errors: parsed.error.errors,
        });
      }

      const datos = parsed.data;
      const [actualizada] = await db
        .update(solicitudesCredito)
        .set({
          ...datos,
          tipo: actual.tipo,
          clienteId: actual.clienteId,
          correo: datos.correo || null,
          correoDte: datos.correoDte || null,
          creditoSolicitado: String(datos.creditoSolicitado),
          creditoActual: actual.creditoActual,
          diasActuales: actual.diasActuales,
          updatedAt: new Date(),
        })
        // Se vuelve a exigir aquí por si Finanzas la resolvió mientras tanto.
        .where(
          and(
            eq(solicitudesCredito.id, actual.id),
            eq(solicitudesCredito.solicitanteId, usuario.id),
            inArray(solicitudesCredito.estado, ESTADOS_EDITABLES),
          ),
        )
        .returning();

      if (!actualizada) {
        return res.status(409).json({ message: 'La solicitud ya fue resuelta: no se puede editar' });
      }

      const cambios = cambiosEntre(actual, actualizada);
      if (cambios.length > 0) {
        avisarCorreccionPorCorreo(actualizada, cambios).catch((error) =>
          console.error('[solicitud-credito] no se pudo avisar la corrección:', error?.message ?? error),
        );
      }

      res.json(actualizada);
    } catch (error: any) {
      console.error('❌ Error al editar la solicitud de crédito:', error);
      res.status(500).json({ message: 'Error al guardar los cambios', error: error.message });
    }
  });

  // Resolver: aprobar (con monto), rechazar (con motivo) o marcarla "analizando".
  // "analizando" NO es una resolución: la solicitud sigue pendiente (se puede
  // aprobar o rechazar después) y por eso no se le estampa quién ni cuándo la
  // resolvió, ni se toca el monto aprobado.
  app.patch('/api/solicitudes-credito/:id', requireAuth, async (req: any, res) => {
    try {
      const usuario = req.user;
      const soloAnaliza = ROLES_SOLO_ANALIZAN.includes(usuario.role);
      if (!ROLES_FINANZAS.includes(usuario.role) && !soloAnaliza) {
        return res.status(403).json({ message: 'Tu rol no resuelve solicitudes de crédito' });
      }

      const parsed = resolverSolicitudCreditoSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: 'Resolución inválida', errors: parsed.error.errors });
      }

      // El rol que solo analiza no aprueba ni rechaza, aunque lo pida a mano.
      if (soloAnaliza && parsed.data.estado !== 'analizando') {
        return res
          .status(403)
          .json({ message: 'Tu rol solo puede marcar la solicitud como "analizando"' });
      }

      const enAnalisis = parsed.data.estado === 'analizando';

      if (parsed.data.estado === 'aprobada' && !parsed.data.diasAprobados) {
        return res.status(400).json({ message: 'Para aprobar hay que indicar los días de crédito' });
      }

      const [actualizada] = await db
        .update(solicitudesCredito)
        .set({
          estado: parsed.data.estado,
          ...(enAnalisis
            ? {}
            : {
                creditoAprobado:
                  parsed.data.estado === 'aprobada' && parsed.data.creditoAprobado != null
                    ? String(parsed.data.creditoAprobado)
                    : null,
                diasAprobados:
                  parsed.data.estado === 'aprobada' ? parsed.data.diasAprobados ?? null : null,
                resueltaPorId: usuario.id,
                resueltaPorNombre: nombreDe(usuario),
                resueltaAt: new Date(),
              }),
          observaciones: parsed.data.observaciones ?? null,
          updatedAt: new Date(),
        })
        // Desde 'analizando' también se puede resolver: si no, una solicitud
        // puesta en análisis quedaba trabada para siempre.
        .where(
          and(
            eq(solicitudesCredito.id, req.params.id),
            inArray(solicitudesCredito.estado, ['enviada', 'analizando']),
          ),
        )
        .returning();

      if (!actualizada) {
        return res.status(409).json({ message: 'La solicitud no existe o ya estaba resuelta' });
      }

      // Igual que al crearla: el correo nunca hace fallar la operación. La
      // solicitud ya quedó resuelta; si el correo se cae, se registra el error.
      if (!enAnalisis) {
        avisarResolucionPorCorreo(actualizada).catch((error) =>
          console.error('[solicitud-credito] no se pudo avisar la resolución:', error?.message ?? error),
        );
      }

      res.json(actualizada);
    } catch (error: any) {
      console.error('❌ Error al resolver la solicitud de crédito:', error);
      res.status(500).json({ message: 'Error al resolver la solicitud', error: error.message });
    }
  });
}
