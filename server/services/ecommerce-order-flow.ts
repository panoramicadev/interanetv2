/**
 * Lo que pasa cuando un pedido del Market entra "en firme" a Panorámica:
 * notificación interna y correos.
 *
 * Vivía inline en POST /api/ecommerce/orders/client. Se extrajo porque ahora hay
 * DOS puertas de entrada al mismo flujo:
 *   1. el titular compra y el pedido sale al toque;
 *   2. un comprador (sub-usuario) arma el pedido, queda en 'pending_client' y sale
 *      recién cuando el titular lo aprueba desde su panel.
 * Si esto se duplicaba, el segundo camino terminaba avisando distinto que el primero.
 *
 * Nada de acá puede voltear el pedido: el pedido ya está creado/aprobado cuando
 * se llama, así que cada paso falla en silencio y sigue.
 */
import { storage } from '../storage';
import * as NotifyHelper from '../notifications-helper';
import { emailService } from './email';
import { formatRutDisplay, rutMatchKey } from '@shared/rut';

/*
 * ── Por qué acá ya no se descuenta cupo ──────────────────────────────────────
 *
 * Existía consumirCupoDeCredito(), que al aprobarse un pedido a crédito sumaba
 * el total a clients.crsd y escribía clients.cren como "disponible". Las dos son
 * columnas del ERP: crsd es el CUPO autorizado sin documentar (no la deuda) y el
 * ETL de clientes las devuelve al valor de Softland en la siguiente corrida, así
 * que lo único que lograba era desfigurar el espejo del ERP entre ETL y ETL.
 *
 * De hecho nunca llegó a correr: la guarda era `if (clientRecordMatch.crlt)` y
 * crlt (cupo en letras) es 0 en todas las fichas — el mismo error de columna que
 * dejaba el límite de crédito en $0 en pantalla. Al corregir la columna esto
 * habría revivido escribiendo datos falsos, así que se eliminó.
 *
 * El uso de crédito sale de ventas.fact_ventas (documentos por cobrar), que es
 * lo que muestran la ficha, el Market y el panel de Cobranza. Un pedido recién
 * aprobado todavía no es un documento por cobrar: entra al cupo cuando se
 * factura y el ETL lo trae. Ver shared/credito.ts.
 */

/**
 * Un comprador armó un pedido: le avisamos al titular que lo tiene esperando.
 * Panorámica todavía no se entera del pedido — recién lo verá si el titular aprueba.
 */
export async function notificarPedidoPorAprobar(datos: {
  order: any;
  titular: any;
  clientName: string;
  compradorNombre: string;
  total: number;
  items: any[];
}): Promise<void> {
  const { order, titular, clientName, compradorNombre, total, items } = datos;

  try {
    if (titular?.id) {
      await storage.createNotification({
        userId: titular.id,
        type: 'ecommerce_order',
        title: 'Pedido pendiente de tu aprobación',
        message: `${compradorNombre} armó un pedido por $${Number(total).toFixed(0)}. Revísalo en tu panel para enviarlo a Panorámica.`,
        relatedOrderId: order.id,
        read: false,
      });
    }
  } catch (err) {
    console.warn('Warning: no se pudo notificar al titular del pedido por aprobar:', err);
  }

  try {
    if (titular?.email) {
      const { buildOrderPendingClientApprovalEmail } = await import('../email-templates');
      const built = buildOrderPendingClientApprovalEmail({
        clientName: clientName || 'Cliente',
        buyerName: compradorNombre,
        orderNumber: order.id,
        total: Number(total) || 0,
        items: (items || []).map((it: any) => ({
          name: it.productName || it.name || it.sku || 'Producto',
          quantity: Number(it.quantity) || 1,
          price: Number(it.totalPriceAfterDiscount ?? it.totalPrice) || undefined,
        })),
      });
      await emailService.sendEmail({
        to: titular.email,
        subject: built.subject,
        html: built.html,
      });
    }
  } catch (err) {
    console.warn('Warning: correo de pedido por aprobar falló:', err);
  }
}

/** Alguien del equipo comercial que tiene que enterarse del pedido. */
interface DestinatarioComercial {
  id: string;
  nombre: string;
  email: string;
  /** Vendedor a cargo o supervisor del área. */
  rol: 'vendedor' | 'supervisor';
  /** Por qué le llega el correo; se muestra en el cuerpo. */
  motivo: string;
}

/**
 * A quién le toca enterarse de un pedido del Market: el vendedor asignado a la
 * ficha del cliente y el supervisor de su área.
 *
 * El área comercial acá se ordena por vendedor, así que el supervisor sale de él:
 *   1. su supervisor directo (salespeople_users.supervisor_id);
 *   2. si no lo tiene cargado, el supervisor/encargado activo del mismo
 *      segmento (assigned_segment).
 * Devuelve lista vacía si no hay a quién avisar — el pedido no se cae por eso.
 */
async function resolverEquipoComercial(
  assignedSalespersonId: string | null | undefined,
): Promise<DestinatarioComercial[]> {
  if (!assignedSalespersonId) return [];

  const vendedor = await storage.getUser(assignedSalespersonId).catch(() => null);
  const vendedorNombre = (vendedor as any)?.salespersonName || null;
  const destinatarios: DestinatarioComercial[] = [];

  if (vendedor?.email) {
    destinatarios.push({
      id: vendedor.id,
      nombre: vendedorNombre || vendedor.email,
      email: vendedor.email,
      rol: 'vendedor',
      motivo: 'eres el vendedor a cargo de este cliente',
    });
  }

  const motivoSupervisor = vendedorNombre
    ? `supervisas a <strong>${vendedorNombre}</strong>, el vendedor a cargo de este cliente`
    : 'supervisas el área a cargo de este cliente';

  const supervisorId = await storage.getSupervisorIdDeVendedor(assignedSalespersonId).catch(() => null);
  let supervisor: DestinatarioComercial | null = null;

  if (supervisorId) {
    const sup = await storage.getUser(supervisorId).catch(() => null);
    if (sup?.email) {
      supervisor = {
        id: sup.id,
        nombre: (sup as any).salespersonName || sup.email,
        email: sup.email,
        rol: 'supervisor',
        motivo: motivoSupervisor,
      };
    }
  }

  // Sin supervisor directo caemos al del segmento del vendedor.
  const segmento = (vendedor as any)?.assignedSegment;
  if (!supervisor && segmento) {
    const { salespeopleUsers } = await import('@shared/schema');
    const { and, eq, inArray, isNotNull, ne } = await import('drizzle-orm');
    const { db } = await import('../db');

    const [sup] = await db
      .select()
      .from(salespeopleUsers)
      .where(and(
        eq(salespeopleUsers.assignedSegment, segmento),
        inArray(salespeopleUsers.role, ['supervisor', 'encargado_area']),
        eq(salespeopleUsers.isActive, true),
        isNotNull(salespeopleUsers.email),
        ne(salespeopleUsers.email, ''),
      ))
      .limit(1);

    if (sup?.email) {
      supervisor = {
        id: sup.id,
        nombre: sup.salespersonName || sup.email,
        email: sup.email,
        rol: 'supervisor',
        motivo: motivoSupervisor,
      };
    }
  }

  if (supervisor) destinatarios.push(supervisor);

  // Un vendedor que figura como su propio supervisor recibe un solo correo.
  const vistos = new Set<string>();
  return destinatarios.filter((d) => {
    const clave = d.email.trim().toLowerCase();
    if (vistos.has(clave)) return false;
    vistos.add(clave);
    return true;
  });
}

export interface AvisoPedidoNuevo {
  order: any;
  /** Ficha de `clients` usada para precios (puede ser null si no se pudo resolver). */
  client: any | null;
  clientName: string;
  clientEmail: string | null;
  assignedSalespersonId: string | null;
  items: Array<{ productName?: string; name?: string; sku?: string; quantity?: number; totalPrice?: number; totalPriceAfterDiscount?: number }>;
  total: number;
  subtotal: number;
  tax: number;
  paymentCondition: string | null;
  shippingAddress: string | null;
  notes: string | null;
  /** 'approved' si entró aprobado por crédito; 'pending' si espera revisión. */
  status: string;
  hasPurchaseOrder: boolean;
  /** Comprador que armó el pedido, si no fue el titular. */
  createdByName?: string | null;
}

/**
 * Avisa a Panorámica (notificación interna + correos) y al cliente que hay un
 * pedido nuevo. Cada envío es best-effort: el pedido ya existe.
 */
export async function avisarPedidoNuevo(datos: AvisoPedidoNuevo): Promise<void> {
  const {
    order, client, clientName, clientEmail, assignedSalespersonId,
    items, total, subtotal, tax, paymentCondition, shippingAddress, notes,
    status, hasPurchaseOrder, createdByName,
  } = datos;

  const porComprador = createdByName ? ` (armado por ${createdByName})` : '';

  // Create notification for salesperson or admin (non-blocking)
  try {
    const notificationUserId = assignedSalespersonId || await storage.getAdminUserId();
    if (notificationUserId) {
      await storage.createNotification({
        userId: notificationUserId,
        type: 'ecommerce_order',
        title: hasPurchaseOrder
          ? 'Pedido con OC — requiere revisión'
          : 'Nuevo pedido de cliente',
        message: `${clientName} ha realizado un pedido por $${total.toFixed(0)}${porComprador}${hasPurchaseOrder ? ' con OC adjunta. Revisa antes de aprobar.' : ''}`,
        relatedOrderId: order.id,
        read: false
      });
    }
  } catch (notifErr) {
    console.warn('Warning: Notification creation failed, order was still created:', notifErr);
  }

  // Email notification for new store order (pedido_nuevo)
  try {
    await NotifyHelper.notifyNuevaOrden(order.id, clientName || 'Cliente', Number(total) || 0);
  } catch (notifErr) {
    console.warn('Warning: notifyNuevaOrden failed:', notifErr);
  }

  const itemsParaCorreo = (items || []).map((it: any) => ({
    name: it.productName || it.name || it.sku || 'Producto',
    quantity: Number(it.quantity) || 1,
    price: Number(it.totalPriceAfterDiscount ?? it.totalPrice) || undefined,
  }));

  // Customer-facing auto-confirmation email
  try {
    if (clientEmail) {
      const { buildOrderReceivedEmail } = await import('../email-templates');
      const built = buildOrderReceivedEmail({
        clientName: clientName || 'Cliente',
        orderNumber: order.id,
        trackingCode: order.trackingCode || null,
        total: Number(total) || 0,
        items: itemsParaCorreo,
      });
      await NotifyHelper.sendAutoCustomerEmail({
        notificationType: 'ecommerce_sale_auto',
        to: clientEmail,
        subject: built.subject,
        html: built.html,
      });
    }
  } catch (autoErr) {
    console.warn('Warning: auto-confirmation email failed:', autoErr);
  }

  // Internal staff notification — pedidos de Panorámica Market.
  // Va siempre (no depende del toggle de emailNotificationSettings) a
  // contacto@pinturaspanoramica.cl con copia a fparra@pinturaspanoramica.cl,
  // más las copias por cliente que correspondan (ver COPIAS_POR_CLIENTE).
  try {
    const { buildOrderInternalNotifyEmail } = await import('../email-templates');
    const built = buildOrderInternalNotifyEmail(datosCorreoInterno(datos, itemsParaCorreo));
    await emailService.sendEmail({
      to: 'contacto@pinturaspanoramica.cl',
      cc: copiasAvisoInterno(datos).join(', '),
      subject: built.subject,
      html: built.html,
    });
  } catch (internalErr) {
    console.warn('Warning: internal order notification email failed:', internalErr);
  }

  await notificarEquipoComercial(datos);
}

/** Copia fija del aviso interno, para todos los pedidos. */
const COPIA_FIJA_AVISO_INTERNO = 'fparra@pinturaspanoramica.cl';

/**
 * Copias extra del aviso interno que dependen de QUÉ CLIENTE hizo el pedido.
 *
 * Se identifica por RUT y no por nombre, porque un mismo cliente entra con el
 * nombre de cada sucursal ("ELECTROCOM S.A. - MCT LOS ANGELES") y así la copia
 * sale igual desde cualquiera de ellas. `nombre` es solo el respaldo para las
 * fichas que llegan sin RUT.
 */
const COPIAS_POR_CLIENTE: Array<{ rut: string; nombre: RegExp; emails: string[] }> = [
  {
    // ELECTROCOM S.A. y sus sucursales.
    rut: '96355000-6',
    nombre: /electrocom/i,
    emails: ['lchaparro@pinturaspanoramica.cl'],
  },
];

/**
 * Destinatarios en copia del aviso interno de un pedido del Market: la copia de
 * siempre más las que ese cliente en particular tenga configuradas.
 */
function copiasAvisoInterno(datos: AvisoPedidoNuevo): string[] {
  const copias = [COPIA_FIJA_AVISO_INTERNO];

  const claveRut = rutMatchKey(datos.client?.rten);
  const nombre = datos.clientName || '';

  for (const regla of COPIAS_POR_CLIENTE) {
    const coincide = claveRut
      ? claveRut === rutMatchKey(regla.rut)
      : regla.nombre.test(nombre);
    if (!coincide) continue;
    for (const email of regla.emails) {
      if (!copias.includes(email)) copias.push(email);
    }
  }

  return copias;
}

/**
 * Datos del pedido para los correos internos (equipo y supervisor).
 * `rten` es el RUT de la ficha: `ruen` es la ruta y llegaba un "10" en el correo.
 */
function datosCorreoInterno(
  datos: AvisoPedidoNuevo,
  itemsParaCorreo: Array<{ name: string; quantity: number; price?: number }>,
) {
  const { order, client, clientName, clientEmail, total, subtotal, tax } = datos;
  const { paymentCondition, shippingAddress, notes, status, createdByName } = datos;

  return {
    orderNumber: order.id,
    trackingCode: order.trackingCode || null,
    clientName: clientName || 'Cliente',
    clientEmail: clientEmail || null,
    clientRut: formatRutDisplay(client?.rten) || null,
    clientPhone: (client as any)?.foen || (client as any)?.fichaOverrides?.phone || null,
    total: Number(total) || 0,
    subtotal: Number(subtotal) || 0,
    tax: Number(tax) || 0,
    paymentCondition: paymentCondition || null,
    shippingAddress: shippingAddress || null,
    notes: createdByName ? [`Pedido armado por ${createdByName}`, notes].filter(Boolean).join('\n') : notes,
    status: status === 'approved' ? 'Aprobado' : 'Pendiente de aprobación',
    items: itemsParaCorreo,
    salespersonName: order.assignedSalespersonName || null,
  };
}

/**
 * Le avisa por correo al vendedor a cargo del cliente y al supervisor de su área
 * que entró un pedido. Sólo se llama con pedidos confirmados: lo que un comprador
 * deja esperando el visto bueno de su titular ('pending_client') no se avisa acá —
 * eso es asunto del cliente, no de Panorámica.
 *
 * De paso deja registrado en el pedido a qué supervisor se le avisó
 * (`assignedSupervisorId`), que hasta ahora nunca se llenaba.
 */
export async function notificarEquipoComercial(datos: AvisoPedidoNuevo): Promise<void> {
  const { order, clientName, total, assignedSalespersonId } = datos;
  const refPedido = order.trackingCode || order.id;

  try {
    const destinatarios = await resolverEquipoComercial(assignedSalespersonId);
    if (destinatarios.length === 0) {
      console.warn(`[pedido ${refPedido}] sin vendedor ni supervisor a quién avisar (vendedor asignado: ${assignedSalespersonId || 'ninguno'})`);
      return;
    }

    const itemsParaCorreo = (datos.items || []).map((it: any) => ({
      name: it.productName || it.name || it.sku || 'Producto',
      quantity: Number(it.quantity) || 1,
      price: Number(it.totalPriceAfterDiscount ?? it.totalPrice) || undefined,
    }));
    const base = datosCorreoInterno(datos, itemsParaCorreo);
    const { buildOrderInternalNotifyEmail } = await import('../email-templates');

    // Uno por uno: si a alguno le falla el correo, el otro igual se entera.
    for (const destinatario of destinatarios) {
      try {
        const built = buildOrderInternalNotifyEmail({
          ...base,
          recipientIntro: `${destinatario.nombre}: recibes este aviso porque ${destinatario.motivo}. El pedido ya está en la intranet.`,
        });
        await emailService.sendEmail({
          to: destinatario.email,
          subject: built.subject,
          html: built.html,
        });
        console.log(`[pedido ${refPedido}] aviso al ${destinatario.rol}: ${destinatario.email} — ${clientName} $${Number(total).toFixed(0)}`);
      } catch (envioErr) {
        console.warn(`Warning: correo al ${destinatario.rol} (${destinatario.email}) falló:`, envioErr);
      }
    }

    // Queda asentado en el pedido a qué supervisor se le avisó.
    try {
      const supervisor = destinatarios.find((d) => d.rol === 'supervisor');
      if (supervisor && !order.assignedSupervisorId) {
        const { ecommerceOrders } = await import('@shared/schema');
        const { eq } = await import('drizzle-orm');
        const { db } = await import('../db');
        await db.update(ecommerceOrders)
          .set({ assignedSupervisorId: supervisor.id })
          .where(eq(ecommerceOrders.id, order.id));
      }
    } catch (persistErr) {
      console.warn('Warning: no se pudo guardar el supervisor en el pedido:', persistErr);
    }
  } catch (err) {
    console.warn('Warning: aviso al equipo comercial falló:', err);
  }
}
