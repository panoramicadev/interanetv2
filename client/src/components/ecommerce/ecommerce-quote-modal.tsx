import { useState } from "react";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { EcommerceOrder, getOrderItems, formatPrice } from "./order-detail-view";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { QuotePDFDocument } from "@/pages/tomador-pedidos";
import { pdf } from "@react-pdf/renderer";
import { FileText, Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";

interface EcommerceQuoteModalProps {
  order: EcommerceOrder;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

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
    validUntil: format(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), "yyyy-MM-dd"), // +7 days
    paymentCondition: order.paymentCondition || "transferencia",
    notes: order.notes ? `[Pedido eCommerce] ${order.notes}` : "[Pedido eCommerce]",
  });

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const items = getOrderItems(order);
      const subtotal = items.reduce((sum, i) => sum + (i.subtotal || (i.unitPrice || i.price || 0) * i.quantity), 0);
      const tax = Math.round(subtotal * 0.19);
      const total = subtotal + tax;

      // Create Quote
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

      // Format Items for syncing
      const syncItems = items.map(item => ({
        quoteId: savedQuote.id,
        type: "standard" as const,
        productName: item.productName,
        productCode: item.productCode || item.sku || "",
        productUnit: "UN",
        unitPrice: (item.unitPrice || item.price || 0).toString(),
        quantity: item.quantity.toString(),
      }));

      // Sync items
      await apiRequest(`/api/quotes/${savedQuote.id}/items/sync`, {
        method: 'PUT',
        data: { quoteData: quotePayload, items: syncItems }
      });

      // Generate PDF
      const blob = await pdf(<QuotePDFDocument quote={savedQuote} items={syncItems} />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Cotizacion_${savedQuote.quoteNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Cotización Generada",
        description: `Se descargó el PDF de la cotización ${savedQuote.quoteNumber}.`,
      });

      // Update Queries
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
