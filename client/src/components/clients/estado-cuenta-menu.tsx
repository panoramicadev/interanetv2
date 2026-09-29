// ═══════════════════════════════════════════════════════════════════════════
// ESTADO DE CUENTA — botón de descarga del panel de crédito
// ═══════════════════════════════════════════════════════════════════════════
// Baja el estado de cuenta del cliente —sus documentos pendientes con folio,
// emisión, vencimiento y montos— en PDF o en Excel. Pedido de Recepción: sacar
// ese detalle desde Random toma unos doce pasos por cliente.
//
// El archivo lo arma el servidor (GET /api/clients/estado-cuenta) con la misma
// función que calcula este panel, así que dice lo mismo que la pantalla. El PDF
// es además el que viaja adjunto en el correo de cobranza.
import { useState } from "react";
import { ChevronDown, Download, Eye, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";

export type FormatoEstadoCuenta = "pdf" | "xlsx";

/**
 * URL del estado de cuenta. Nombre y RUT tienen que ser los mismos con los que
 * la pantalla pidió el crédito: con otros, el alcance de fichas podría cambiar.
 * `ver` abre el PDF en el navegador en vez de descargarlo.
 */
export function urlEstadoCuenta(
  clientName: string | null | undefined,
  rut: string | null | undefined,
  formato: FormatoEstadoCuenta,
  ver = false,
) {
  const params = new URLSearchParams({ formato });
  if (clientName) params.set("name", clientName);
  if (rut) params.set("rut", rut);
  if (ver) params.set("ver", "1");
  return `/api/clients/estado-cuenta?${params.toString()}`;
}

/** Abre el PDF en una pestaña nueva: desde ahí se lee, se imprime o se guarda. */
export function verEstadoCuentaPdf(clientName: string | null | undefined, rut?: string | null) {
  window.open(urlEstadoCuenta(clientName, rut, "pdf", true), "_blank", "noopener");
}

/** El nombre que manda el servidor ("Estado de cuenta - CLIENTE - 2026-09-28.pdf"). */
function nombreDesdeCabecera(cabecera: string | null): string | null {
  if (!cabecera) return null;
  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(cabecera);
  if (utf8) {
    try {
      return decodeURIComponent(utf8[1]);
    } catch {
      /* cae al nombre ASCII */
    }
  }
  const ascii = /filename="([^"]+)"/i.exec(cabecera);
  return ascii ? ascii[1] : null;
}

async function descargar(url: string, nombreRespaldo: string) {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) {
    let mensaje = "No se pudo generar el estado de cuenta.";
    try {
      const data = await res.json();
      if (data?.message) mensaje = data.message;
    } catch {
      /* respuesta sin JSON */
    }
    throw new Error(mensaje);
  }
  const blob = await res.blob();
  const nombre = nombreDesdeCabecera(res.headers.get("Content-Disposition")) || nombreRespaldo;
  const enlace = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = enlace;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(enlace), 2000);
}

export function EstadoCuentaMenu({
  clientName,
  rut,
  className,
}: {
  clientName: string | null | undefined;
  rut?: string | null;
  className?: string;
}) {
  const { toast } = useToast();
  const [bajando, setBajando] = useState<FormatoEstadoCuenta | null>(null);

  const bajar = async (formato: FormatoEstadoCuenta) => {
    if (bajando) return;
    setBajando(formato);
    try {
      await descargar(urlEstadoCuenta(clientName, rut, formato), `Estado de cuenta.${formato}`);
    } catch (e: any) {
      toast({
        title: "No se pudo descargar el estado de cuenta",
        description: e?.message || "Inténtalo de nuevo en un momento.",
        variant: "destructive",
      });
    } finally {
      setBajando(null);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="sm"
          className={
            className ||
            "w-full rounded-2xl bg-[#fd6301] text-white shadow-sm shadow-[#fd6301]/25 hover:bg-[#e35400] sm:w-auto"
          }
          disabled={!!bajando}
          data-testid="button-estado-cuenta"
        >
          {bajando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
          {bajando ? "Generando…" : "Estado de cuenta"}
          <ChevronDown className="ml-1.5 h-3.5 w-3.5 opacity-80" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52 rounded-xl">
        <DropdownMenuItem onClick={() => verEstadoCuentaPdf(clientName, rut)} data-testid="menu-estado-cuenta-ver">
          <Eye className="mr-2 h-4 w-4 text-slate-500" /> Ver PDF
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => bajar("pdf")} data-testid="menu-estado-cuenta-pdf">
          <FileText className="mr-2 h-4 w-4 text-slate-500" /> Descargar PDF
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => bajar("xlsx")} data-testid="menu-estado-cuenta-excel">
          <FileSpreadsheet className="mr-2 h-4 w-4 text-slate-500" /> Descargar Excel
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default EstadoCuentaMenu;
