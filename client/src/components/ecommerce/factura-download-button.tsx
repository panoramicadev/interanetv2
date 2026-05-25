import { useState } from "react";
import { Download, Loader2, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface FacturaDownloadButtonProps {
  /** idmaeedo de la FCV en el ERP (sirve para construir la URL del DTE oficial). */
  idmaeedo: string | number;
  /** Folio para nombrar el archivo descargado. */
  folio?: string | null;
  /** "button" (texto + ícono) o "icon" (solo ícono compacto). */
  variant?: "button" | "icon";
  label?: string;
  className?: string;
}

/**
 * Descarga la factura OFICIAL (DTE timbrado) del cliente logueado desde
 * /api/ecommerce/client/facturas/:idmaeedo/pdf. El backend verifica que la
 * factura pertenezca al cliente antes de servir el PDF.
 */
export function FacturaDownloadButton({
  idmaeedo,
  folio,
  variant = "button",
  label = "Descargar factura",
  className = "",
}: FacturaDownloadButtonProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const handle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/ecommerce/client/facturas/${idmaeedo}/pdf`, {
        credentials: "include",
      });
      if (!res.ok) {
        let msg = "No pudimos generar la factura.";
        try {
          const data = await res.json();
          if (data?.message) msg = data.message;
        } catch {
          /* respuesta sin JSON */
        }
        throw new Error(msg);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Factura_${folio || idmaeedo}.pdf`;
      a.target = "_blank";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (err: any) {
      toast({
        title: "Factura no disponible",
        description: err?.message || "Intentá nuevamente más tarde.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={handle}
        disabled={loading}
        title={label}
        className={`p-2 rounded-lg text-blue-600 hover:text-blue-700 hover:bg-blue-50 transition-colors disabled:opacity-50 ${className}`}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handle}
      disabled={loading}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 text-xs font-bold hover:bg-blue-100 transition-colors disabled:opacity-50 ${className}`}
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
      {label}
    </button>
  );
}

export default FacturaDownloadButton;
