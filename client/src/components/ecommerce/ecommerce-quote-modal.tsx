import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { EcommerceOrder, getOrderItems } from "./order-detail-view";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { generatePDFFromQuote } from "@/lib/quote-pdf-html";
import { getShippingKey } from "@shared/format-utils";
import { FileText, Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";

interface EcommerceQuoteModalProps {
  order: EcommerceOrder;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const SHIPPING_LABELS: Record<string, string> = {
  '1_4_galon': 'Despacho 1/4 Galón',
  'galon': 'Despacho Galón',
  'bd_4gl': 'Despacho Balde 4GL',
  'bd_5gl': 'Despacho Balde 5GL',
};

export function EcommerceQuoteModal({ order, open, onOpenChange, onSuccess }: EcommerceQuoteModalProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isGenerating, setIsGenerating] = useState(false);

  const [formData, setFormData] = useState({
    clientName: order.clientName || "",
    clientRut: "",
    clientEmail: order.clientEmail || "",
    clientPhone: order.clientPhone || "",
    clientAddress: order.shippingAddress || "",
    validUntil: format(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), "yyyy-MM-dd"),
    paymentCondition: order.paymentCondition || "transferencia",
    notes: order.notes ? `[Pedido eCommerce] ${order.notes}` : "[Pedido eCommerce]",
  });

  // Same shipping-rates source and normalization logic as tomador-pedidos
  const { data: rawShippingRates = {} } = useQuery<Record<string, any>>({
    queryKey: ['/api/ecommerce/shipping-rates'],
    queryFn: async () => {
      try {
        const res = await fetch('/api/ecommerce/shipping-rates', { credentials: 'include' });
        if (!res.ok) return {};
        return res.json();
      } catch { return {}; }
    },
    staleTime: 60000,
  });

  const shippingRates: Record<string, number> = {};
  const shippingSkus: Record<string, string> = {};
  for (const [key, val] of Object.entries(rawShippingRates)) {
    if (typeof val === 'object' && val !== null) {
      shippingRates[key] = (val as any).price || 0;
      shippingSkus[key] = (val as any).sku || '';
    } else {
      shippingRates[key] = Number(val) || 0;
    }
  }

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const items = getOrderItems(order);

      // One flete line per order item so each product's despacho is distinguishable.
      // Order items use `selectedPackaging` (or `productUnit`) to carry the unit
      // (e.g. "Galon", "Balde 4 Galones"); we resolve it to a shipping-rate key.
      const shippingLineItems = items
        .map(item => {
          const unit = (item as any).selectedPackaging || (item as any).productUnit;
          if (!unit) return null;
          const key = getShippingKey(unit);
          if (!key || !shippingRates[key]) return null;
          const qty = Number(item.quantity) || 0;
          if (qty <= 0) return null;
          return {
            key,
            sku: shippingSkus[key] || key,
            label: `${SHIPPING_LABELS[key] || `Despacho ${key}`} - ${item.productName}`,
            qty,
            unitPrice: shippingRates[key],
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);

      const productsSubtotal = items.reduce(
        (sum, i) => sum + (i.subtotal || (i.unitPrice || i.price || 0) * i.quantity),
        0,
      );
      const shippingSubtotal = shippingLineItems.reduce((sum, s) => sum + s.unitPrice * s.qty, 0);
      const subtotal = productsSubtotal + shippingSubtotal;
      const tax = Math.round(subtotal * 0.19);
      const total = subtotal + tax;

      const quotePayload = {
        clientName: formData.clientName,
        clientRut: formData.clientRut,
        clientEmail: formData.clientEmail,
        clientPhone: formData.clientPhone,
        clientAddress: formData.clientAddress,
        notes: formData.notes,
        validUntil: formData.validUntil ? new Date(formData.validUntil).toISOString() : null,
        paymentCondition: formData.paymentCondition,
        subtotal: subtotal.toString(),
        taxAmount: tax.toString(),
        total: total.toString(),
        status: "draft" as const,
        createdBy: user?.id,
      };

      const resQuote = await apiRequest('/api/quotes', {
        method: 'POST',
        data: quotePayload,
      });
      const savedQuote = await resQuote.json();

      const productSyncItems = items.map(item => {
        const unit = (item as any).selectedPackaging || (item as any).productUnit || "UN";
        const unitPrice = item.unitPrice || item.price || 0;
        const quantity = Number(item.quantity) || 0;
        return {
          quoteId: savedQuote.id,
          type: "standard" as const,
          productName: item.productName,
          productCode: item.productCode || item.sku || "",
          productUnit: unit,
          unitPrice: unitPrice.toString(),
          quantity: quantity.toString(),
          totalPrice: (unitPrice * quantity).toString(),
          pricingMode: 'direct',
        };
      });

      const shippingSyncItems = shippingLineItems.map(shipItem => ({
        quoteId: savedQuote.id,
        type: "standard" as const,
        productName: shipItem.label,
        productCode: shipItem.sku,
        productUnit: 'UN',
        quantity: shipItem.qty.toString(),
        unitPrice: shipItem.unitPrice.toString(),
        totalPrice: (shipItem.qty * shipItem.unitPrice).toString(),
        pricingMode: 'direct',
      }));

      const syncItems = [...productSyncItems, ...shippingSyncItems];

      await apiRequest(`/api/quotes/${savedQuote.id}/items/sync`, {
        method: 'PUT',
        data: { quoteData: quotePayload, items: syncItems },
      });

      generatePDFFromQuote(savedQuote, syncItems);

      toast({
        title: "Cotización Generada",
        description: `Se generó el PDF de la cotización ${savedQuote.quoteNumber}.`,
      });

      queryClient.invalidateQueries({ queryKey: ['/api/quotes'] });

      if (onSuccess) onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error al generar",
        description: error.message || "Ocurrió un error inesperado.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#FF6E23]" />
            Generar Cotización Rápida
          </DialogTitle>
          <DialogDescription>
            Revisa los datos del pedido antes de generar el documento final de la cotización. Para cambiar productos o añadir descuentos avanzados, por favor utiliza el Tomador de Pedidos regular.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 mt-2">
          <div className="space-y-2">
            <Label>Cliente</Label>
            <Input value={formData.clientName} onChange={(e) => handleChange("clientName", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>RUT</Label>
            <Input value={formData.clientRut} onChange={(e) => handleChange("clientRut", e.target.value)} placeholder="Opcional" />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={formData.clientEmail} onChange={(e) => handleChange("clientEmail", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Teléfono</Label>
            <Input value={formData.clientPhone} onChange={(e) => handleChange("clientPhone", e.target.value)} />
          </div>
          <div className="space-y-2 col-span-2">
            <Label>Dirección</Label>
            <Input value={formData.clientAddress} onChange={(e) => handleChange("clientAddress", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Válido hasta</Label>
            <Input type="date" value={formData.validUntil} onChange={(e) => handleChange("validUntil", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Condición de Pago</Label>
            <Select value={formData.paymentCondition} onValueChange={(val) => handleChange("paymentCondition", val)}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccione..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="transferencia">Transferencia Bancaria</SelectItem>
                <SelectItem value="boton_pago">Botón de Pago (Tarjeta)</SelectItem>
                <SelectItem value="credito">Crédito</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 col-span-2">
            <Label>Notas</Label>
            <Textarea value={formData.notes} onChange={(e) => handleChange("notes", e.target.value)} rows={3} />
          </div>
        </div>

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isGenerating}>
            Cancelar
          </Button>
          <Button onClick={handleGenerate} disabled={isGenerating} className="bg-[#FF6E23] hover:bg-[#E55E13] text-white">
            {isGenerating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generando...</> : "Guardar Cotización y Descargar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
