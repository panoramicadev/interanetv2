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
  // contacto@pinturaspanoramica.cl con copia a fparra@pinturaspanoramica.cl.
  try {
    const { buildOrderInternalNotifyEmail } = await import('../email-templates');
    const built = buildOrderInternalNotifyEmail({
      orderNumber: order.id,
      clientName: clientName || 'Cliente',
      clientEmail: clientEmail || null,
      clientRut: client?.ruen || null,
      clientPhone: (client as any)?.foen || (client as any)?.fichaOverrides?.phone || null,
      total: Number(total) || 0,
      subtotal: Number(subtotal) || 0,
      tax: Number(tax) || 0,
      paymentCondition: paymentCondition || null,
      shippingAddress: shippingAddress || null,
      notes: createdByName ? [`Pedido armado por ${createdByName}`, notes].filter(Boolean).join('\n') : notes,
      status: status === 'approved' ? 'Aprobado' : 'Pendiente de aprobación',
      items: itemsParaCorreo,
    });
    await emailService.sendEmail({
      to: 'contacto@pinturaspanoramica.cl',
      cc: 'fparra@pinturaspanoramica.cl',
      subject: built.subject,
      html: built.html,
    });
  } catch (internalErr) {
    console.warn('Warning: internal order notification email failed:', internalErr);
  }
}
