import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useCreditoCliente } from "@/hooks/useCreditoCliente";
import { useToast } from "@/hooks/use-toast";
import {
  Banknote, CreditCard, CheckCircle2, Info, FileUp, FileText, Loader2, X,
} from "lucide-react";

// Forma de pago + OC adjunta. Mismo contrato que el checkout del ecommerce:
// el backend interpreta 'credit' → aprobación inmediata + consumo de cupo, y
// 'transfer' → pendiente hasta subir comprobante.
export interface SuggestedPaymentValue {
  paymentMethod: "transfer" | "credit";
  purchaseOrderPdfUrl: string | null;
  purchaseOrderFileName: string | null;
}

// Solo lo que hace falta para detectar MCT. El cupo va por useCreditoCliente:
// clients.crlt y clients.cren no sirven para calcular disponible (ver el hook).
interface ClientData {
  nokoen?: string | null;
  gien?: string | null;
  parentNokoen?: string | null;
}

interface Props {
  /** Total estimado (con IVA) para el desglose de crédito. El backend recalcula. */
  total: number;
  value: SuggestedPaymentValue;
  onChange: (next: SuggestedPaymentValue) => void;
  /** Reporta si la selección es válida (MCT exige OC). */
  onValidityChange?: (valid: boolean) => void;
}

const formatPrice = (price: number): string =>
  `$${new Intl.NumberFormat("es-CL", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(price)}`;

export default function SuggestedOrderPayment({ total, value, onChange, onValidityChange }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [paymentMethodTouched, setPaymentMethodTouched] = useState(false);
  const [isUploadingOC, setIsUploadingOC] = useState(false);

  const { data: clientData } = useQuery<ClientData | null>({
    queryKey: ["/api/clients/by-user", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const res = await fetch(`/api/clients/by-user/${user.id}`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!user?.id && (user as any)?.role === "client",
  });

  const { creditAvailable, hasCredit, paymentCondition, tieneCupoQueMostrar } = useCreditoCliente();
  const isCredit = hasCredit;
  // "CREDITO 30 DIAS" → "30". Sin número, no se muestra plazo.
  const plazoCredito = paymentCondition?.match(/\d+/)?.[0] ?? null;

  const mctTokens = `${clientData?.nokoen || ""} ${clientData?.gien || ""} ${clientData?.parentNokoen || ""}`.toUpperCase();
  const isMCT = /\bMCT\b/.test(mctTokens);
  const requiresOC = isMCT;
  const isMissingRequiredOC = requiresOC && !value.purchaseOrderPdfUrl;
  const shouldHighlightOCUpload =
    isCredit && value.paymentMethod === "credit" && !value.purchaseOrderPdfUrl && !isUploadingOC;

  // Default a crédito si el cliente tiene crédito disponible (hasta que elija manualmente).
  useEffect(() => {
    if (isCredit && !paymentMethodTouched && value.paymentMethod !== "credit") {
      onChange({ ...value, paymentMethod: "credit" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCredit, paymentMethodTouched]);

  useEffect(() => {
    onValidityChange?.(!isMissingRequiredOC);
  }, [isMissingRequiredOC, onValidityChange]);

  const remaining = creditAvailable != null ? creditAvailable - total : null;

  const handleOcFile = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "Archivo muy grande", description: "El PDF no puede superar 10 MB.", variant: "destructive" });
      return;
    }
    setIsUploadingOC(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", credentials: "include", body: formData });
      if (!res.ok) throw new Error("Error al subir archivo");
      const data = await res.json();
      onChange({ ...value, purchaseOrderPdfUrl: data.url || data.fileUrl, purchaseOrderFileName: file.name });
      toast({ title: "✓ OC adjuntada", description: `"${file.name}" será incluida en tu pedido.` });
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "No se pudo subir el archivo", variant: "destructive" });
    } finally {
      setIsUploadingOC(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Selector de método de pago */}
      <div className="space-y-3">
        <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <Banknote className="h-4 w-4" />
          Método de Pago
        </label>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => { setPaymentMethodTouched(true); onChange({ ...value, paymentMethod: "transfer" }); }}
            className={`flex items-center justify-start gap-2 px-3 py-3 rounded-xl border text-sm font-medium transition-all ${
              value.paymentMethod === "transfer"
                ? "border-orange-500 bg-orange-50/50 text-orange-900 shadow-sm"
                : "border-gray-200 bg-white text-gray-600 hover:border-orange-200"
            }`}
          >
            <Banknote className={`h-4 w-4 ${value.paymentMethod === "transfer" ? "text-orange-500" : "text-gray-400"}`} />
            <span className="text-left font-semibold">Transferencia Bancaria</span>
          </button>

          <button
            type="button"
            onClick={() => { if (isCredit) { setPaymentMethodTouched(true); onChange({ ...value, paymentMethod: "credit" }); } }}
            disabled={!isCredit}
            className={`flex items-center justify-start gap-2 px-3 py-3 rounded-xl border text-sm font-medium transition-all ${
              !isCredit
                ? "opacity-60 cursor-not-allowed border-gray-100 bg-gray-50 text-gray-400"
                : value.paymentMethod === "credit"
                ? "border-blue-500 bg-blue-50/50 text-blue-900 shadow-sm"
                : "border-gray-200 bg-white text-gray-600 hover:border-blue-200"
            }`}
          >
            <CreditCard className={`h-4 w-4 ${!isCredit ? "text-gray-400" : value.paymentMethod === "credit" ? "text-blue-500" : "text-gray-400"}`} />
            <div className="text-left">
              <div className="font-semibold">Crédito</div>
              {isCredit && plazoCredito && (
                <div className="text-[10px] text-blue-600 mt-0.5 leading-tight">Plazo: {plazoCredito} días</div>
              )}
              {!isCredit && <div className="text-[10px] text-gray-400 leading-tight">No disponible</div>}
            </div>
          </button>
        </div>

        {/* Detalle del método elegido */}
        {value.paymentMethod === "credit" && isCredit ? (
          <div className="bg-blue-50 rounded-lg p-3 border border-blue-200 space-y-3">
            <div className="flex items-center gap-2 text-blue-800">
              <CheckCircle2 className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-semibold">Aprobación Inmediata</span>
            </div>
            {tieneCupoQueMostrar && (
              <div className="bg-white/60 rounded-lg p-2.5 space-y-1.5 border border-blue-100">
                {creditAvailable != null && (
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-blue-600/70">Disponible actual</span>
                    <span className="font-semibold text-blue-800">{formatPrice(creditAvailable)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center text-xs">
                  <span className="text-blue-600/70">Monto de esta compra</span>
                  <span className="font-bold text-orange-600">-{formatPrice(total)}</span>
                </div>
                {remaining != null && (
                  <div className="flex justify-between items-center text-xs pt-0.5 border-t border-blue-100">
                    <span className="font-semibold text-blue-700">Saldo después de compra</span>
                    <span className={`font-bold ${remaining >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                      {formatPrice(remaining)}
                    </span>
                  </div>
                )}
                {remaining != null && remaining < 0 && (
                  <div className="flex items-start gap-1.5 text-[10px] text-red-600 bg-red-50 p-1.5 rounded mt-1">
                    <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
                    <span>El monto excede tu crédito disponible. Tu ejecutivo deberá autorizarlo manualmente.</span>
                  </div>
                )}
              </div>
            )}
            <p className="text-xs text-blue-600/80">
              No necesitas subir comprobante. Tu pedido quedará en lista de despacho automáticamente.
            </p>
          </div>
        ) : value.paymentMethod === "transfer" ? (
          <div className="bg-orange-50/50 rounded-lg p-3 border border-orange-200">
            <div className="flex items-center gap-2 mb-1">
              <Info className="h-4 w-4 text-orange-600" />
              <span className="text-sm font-semibold text-orange-800">Requiere Validación</span>
            </div>
            <p className="text-xs text-orange-700 mt-1">
              Al confirmar, te facilitaremos los datos de la cuenta corriente. Tu pedido quedará <strong>Pendiente</strong> y comenzará a procesarse únicamente cuando subas la foto del comprobante de transferencia o depósito.
            </p>
          </div>
        ) : null}
      </div>

      {/* Orden de Compra (PDF) */}
      <div className={`space-y-2 rounded-xl transition-all ${isMissingRequiredOC ? "p-3 -mx-1 bg-red-50/70 ring-1 ring-red-300/70" : ""}`}>
        <label className={`text-sm font-medium flex items-center gap-2 ${isMissingRequiredOC ? "text-red-700" : shouldHighlightOCUpload ? "text-blue-700" : "text-gray-700"}`}>
          <FileUp className={`h-4 w-4 ${isMissingRequiredOC ? "text-red-500" : shouldHighlightOCUpload ? "text-blue-500" : ""}`} />
          Orden de Compra {requiresOC ? (
            <span className="text-[10px] font-semibold bg-red-500 text-white px-1.5 py-0.5 rounded-full">Obligatorio</span>
          ) : shouldHighlightOCUpload ? (
            <span className="text-[10px] font-semibold bg-blue-500 text-white px-1.5 py-0.5 rounded-full">Recomendado</span>
          ) : (
            <span className="text-xs font-normal text-gray-400">(opcional)</span>
          )}
        </label>
        <p className={`text-[11px] -mt-1 ${isMissingRequiredOC ? "text-red-600/90" : shouldHighlightOCUpload ? "text-blue-600/80" : "text-gray-400"}`}>
          {requiresOC
            ? "Como cliente MCT debes adjuntar la Orden de Compra en PDF para confirmar el pedido."
            : shouldHighlightOCUpload
            ? "Al pagar a crédito te recomendamos adjuntar tu OC en PDF para agilizar el despacho."
            : "Puedes adjuntar tu OC en formato PDF para que acompañe el pedido."}
        </p>

        {value.purchaseOrderPdfUrl ? (
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
              <FileText className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-emerald-800 truncate">{value.purchaseOrderFileName || "Orden de Compra.pdf"}</p>
              <p className="text-[10px] text-emerald-600">✓ Adjunto al pedido</p>
            </div>
            <button
              type="button"
              onClick={() => onChange({ ...value, purchaseOrderPdfUrl: null, purchaseOrderFileName: null })}
              className="p-1.5 rounded-lg hover:bg-emerald-100 text-emerald-500 hover:text-red-500 transition-colors flex-shrink-0"
              title="Eliminar archivo"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <>
            <label
              htmlFor="suggested-oc-upload"
              className={`relative flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed transition-all cursor-pointer ${
                isUploadingOC
                  ? "border-blue-300 bg-blue-50/50"
                  : shouldHighlightOCUpload
                  ? "border-blue-400 bg-blue-50 hover:bg-blue-100"
                  : "border-gray-200 hover:border-[#FF6E23]/50 hover:bg-orange-50/30"
              }`}
            >
              {isUploadingOC ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                  <span className="text-sm text-blue-600 font-medium">Subiendo...</span>
                </>
              ) : (
                <>
                  <FileUp className={`w-4 h-4 ${shouldHighlightOCUpload ? "text-blue-500" : "text-gray-400"}`} />
                  <span className={`text-sm font-medium ${shouldHighlightOCUpload ? "text-blue-700" : "text-gray-500"}`}>
                    Adjuntar PDF de Orden de Compra
                  </span>
                </>
              )}
            </label>
            <input
              id="suggested-oc-upload"
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              disabled={isUploadingOC}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleOcFile(file);
                e.target.value = "";
              }}
            />
          </>
        )}
      </div>
    </div>
  );
}
