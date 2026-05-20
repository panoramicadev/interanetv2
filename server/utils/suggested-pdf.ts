// PDF del pedido sugerido. Reutiliza el MISMO renderer/template del tomador de
// pedidos (renderQuotePdf → renderQuoteHtml) para que el documento sea idéntico
// al de las cotizaciones, cambiando solo el rótulo a "PEDIDO SUGERIDO".

import { renderQuotePdf } from './quote-pdf-renderer';

export interface SuggestedPdfClient {
  clientName?: string | null;
  clientRut?: string | null;
  clientEmail?: string | null;
  clientPhone?: string | null;
  clientAddress?: string | null;
  notes?: string | null;
  paymentCondition?: string | null;
}

export interface SuggestedPdfInput extends SuggestedPdfClient {
  /** Número/identificador a mostrar en el PDF (ej: id corto del sugerido). */
  orderNumber: string;
  /** Fecha de emisión. */
  createdAt?: Date | string | null;
  /** Items ya resueltos por resolveItemsPricing. */
  items: any[];
  logoUrl?: string | null;
}

/** Mapea un item resuelto del sugerido a la forma que consume el template del PDF. */
function toPdfItem(it: any) {
  return {
    productName: it.productName ?? it.name ?? 'Producto',
    productCode: it.sku ?? it.productCode ?? null,
    customSku: it.customSku ?? null,
    productUnit: it.productUnit ?? it.selectedPackaging ?? it.unidad ?? 'UN',
    quantity: it.quantity ?? 1,
    unitPrice: it.unitPriceAfterDiscount ?? it.unitPrice ?? 0,
    totalPrice: it.totalPriceAfterDiscount ?? it.totalPrice ?? 0,
  };
}

export async function renderSuggestedOrderPdf(input: SuggestedPdfInput): Promise<Buffer> {
  const quoteLike = {
    quoteNumber: input.orderNumber,
    clientName: input.clientName ?? 'Cliente',
    clientRut: input.clientRut ?? null,
    clientEmail: input.clientEmail ?? null,
    clientPhone: input.clientPhone ?? null,
    clientAddress: input.clientAddress ?? null,
    notes: input.notes ?? null,
    paymentCondition: input.paymentCondition ?? null,
    createdAt: input.createdAt ?? new Date(),
  };
  const items = (input.items || []).map(toPdfItem);
  return renderQuotePdf(quoteLike, items, input.logoUrl ?? null, {
    documentLabel: 'PEDIDO SUGERIDO',
    documentNumberLabel: 'Sugerido N°',
  });
}
