/**
 * Bitácora de una obra — lo que pasa en terreno y no es un número.
 *
 * Es UNA POR OBRA, no una del cliente: la constructora con cinco proyectos tiene
 * cinco historias distintas, y mezcladas la nota no sirve para nada. Va como una
 * fila más de la planilla, debajo de los productos de la obra, porque se escribe
 * en el mismo momento en que se cargan los números de la visita.
 *
 * La escribe cualquiera que entre a la obra —incluido el vendedor—; borrar solo
 * lo propio, salvo admin y supervisor.
 */
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { BookOpen, FileText, Loader2, Send, Trash2 } from "lucide-react";
import type { ObraBitacora } from "@shared/schema";

const fmtCuando = (valor: string | Date | null | undefined) => {
  if (!valor) return "";
  const d = new Date(valor as any);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("es-CL", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
};

interface CotizacionDeObra {
  id: string;
  quoteNumber: string;
  clientName: string;
  status: string | null;
  total: string | null;
  createdAt: string | null;
}

/**
 * Las cotizaciones que se le hicieron a esta obra — el camino de vuelta del
 * campo "Obra" del tomador de pedidos. Sin esto la relación se veía solo desde
 * la cotización, que es el lado que no se mira cuando se está en la obra.
 */
function CotizacionesDeObra({ obraId }: { obraId: string }) {
  const { data: cotizaciones = [] } = useQuery<CotizacionDeObra[]>({
    queryKey: ["/api/obras", obraId, "cotizaciones"],
    queryFn: async () => {
      const res = await apiRequest(`/api/obras/${obraId}/cotizaciones`);
      return res.json();
    },
  });

  if (cotizaciones.length === 0) return null;

  const fmtMonto = (valor: string | null) => {
    const n = Number(valor ?? 0);
    return Number.isFinite(n) ? `$${Math.round(n).toLocaleString("es-CL")}` : "—";
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold text-slate-400">
        <FileText className="h-3 w-3" />
        Cotizaciones de esta obra
        <span className="tabular-nums text-slate-300">· {cotizaciones.length}</span>
      </div>
      <ul className="space-y-1">
        {cotizaciones.map((c) => (
          <li
            key={c.id}
            className="flex items-center gap-2 rounded-lg border border-slate-200/70 dark:border-slate-700/60 bg-white dark:bg-slate-900/40 px-2.5 py-1.5 text-xs"
            data-testid={`cotizacion-obra-${c.id}`}
          >
            <span className="font-bold tabular-nums text-slate-600 dark:text-slate-300">{c.quoteNumber}</span>
            <span className="text-slate-400 truncate flex-1 min-w-0">{c.clientName}</span>
            <span className="tabular-nums font-semibold text-slate-600 dark:text-slate-300">{fmtMonto(c.total)}</span>
            <span className="text-[10px] uppercase tracking-wide text-slate-400">{c.status ?? "—"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function BitacoraObra({ obraId, obraNombre }: { obraId: string; obraNombre: string }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [texto, setTexto] = useState("");

  const clave = ["/api/obras", obraId, "bitacora"];

  // Escribir o borrar cambia además la última nota y el contador que muestra el
  // listado de Seguimiento → Obras (que los pide todos juntos, no obra por obra).
  const refrescar = () => {
    queryClient.invalidateQueries({ queryKey: clave });
    queryClient.invalidateQueries({ queryKey: ["/api/obras/bitacora-resumen"] });
  };

  const { data: notas = [], isLoading } = useQuery<ObraBitacora[]>({
    queryKey: clave,
    queryFn: async () => {
      const res = await apiRequest(`/api/obras/${obraId}/bitacora`);
      return res.json();
    },
  });

  const escribir = useMutation({
    mutationFn: async (nota: string) => {
      const res = await apiRequest(`/api/obras/${obraId}/bitacora`, { method: "POST", data: { texto: nota } });
      return res.json();
    },
    onSuccess: () => {
      setTexto("");
      refrescar();
    },
    onError: (error: any) => {
      toast({ title: "No se pudo guardar la nota", description: error?.message, variant: "destructive" });
    },
  });

  const borrar = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest(`/api/obras/bitacora/${id}`, { method: "DELETE" });
    },
    onSuccess: refrescar,
    onError: (error: any) => {
      toast({ title: "No se pudo borrar la nota", description: error?.message, variant: "destructive" });
    },
  });

  const mandan = user?.role === "admin" || user?.role === "supervisor" || user?.role === "encargado_area";
  const puedeBorrar = (nota: ObraBitacora) => mandan || nota.autorId === user?.id;

  const guardar = () => {
    const limpio = texto.trim();
    if (!limpio) return;
    escribir.mutate(limpio);
  };

  return (
    <div className="space-y-2.5">
      <CotizacionesDeObra obraId={obraId} />

      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold text-slate-400">
        <BookOpen className="h-3 w-3" />
        Bitácora de {obraNombre}
        {notas.length > 0 && <span className="tabular-nums text-slate-300">· {notas.length}</span>}
      </div>

      <div className="flex items-start gap-2">
        <Textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            // Enter manda, Shift+Enter hace salto: se escribe de a una línea
            // desde el celular, en la obra.
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              guardar();
            }
          }}
          rows={2}
          placeholder="Qué pasó en la obra: avance, quién estaba, qué quedó pendiente…"
          className="min-h-[52px] resize-none rounded-xl text-sm"
          data-testid={`input-bitacora-${obraId}`}
        />
        <Button
          onClick={guardar}
          disabled={!texto.trim() || escribir.isPending}
          className="h-9 rounded-xl bg-gradient-to-r from-orange-500 to-[#fd6301] hover:from-[#e35400] hover:to-[#e35400] text-white text-xs font-semibold flex-shrink-0"
          data-testid={`button-bitacora-guardar-${obraId}`}
        >
          {escribir.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-xs text-slate-400 py-1">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Cargando…
        </div>
      ) : notas.length === 0 ? (
        <p className="text-xs text-slate-400">
          Todavía no hay notas de esta obra. Lo que se escriba acá queda con la obra, no con la constructora.
        </p>
      ) : (
        <ul className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
          {notas.map((nota) => (
            <li
              key={nota.id}
              className="group/nota rounded-xl border border-slate-200/70 dark:border-slate-700/60 bg-white dark:bg-slate-900/40 px-3 py-2"
              data-testid={`nota-bitacora-${nota.id}`}
            >
              <div className="flex items-start gap-2">
                <p className="flex-1 min-w-0 text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap break-words">
                  {nota.texto}
                </p>
                {puedeBorrar(nota) && (
                  <button
                    onClick={() => borrar.mutate(nota.id)}
                    className="opacity-0 group-hover/nota:opacity-100 focus:opacity-100 text-slate-300 hover:text-red-600 transition-all flex-shrink-0"
                    aria-label="Borrar nota"
                    data-testid={`button-borrar-nota-${nota.id}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <div className="mt-1 text-[10px] text-slate-400">
                {nota.autorNombre || "—"} · {fmtCuando(nota.createdAt)}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
