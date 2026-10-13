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
import { FileText, Loader2, MessageSquare, Send, Trash2 } from "lucide-react";
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

export function BitacoraObra({ obraId }: { obraId: string; obraNombre?: string }) {
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

  // Mismo molde que el chat de Seguimiento (pedido del usuario, oct-2026): barra
  // de título, la conversación en burbujas —las propias a la derecha en naranjo,
  // las de los demás a la izquierda con su nombre— y el campo abajo.
  const ordenadas = [...notas].sort(
    (x, y) => new Date(x.createdAt as any).getTime() - new Date(y.createdAt as any).getTime(),
  );

  return (
    <div className="space-y-3">
      <CotizacionesDeObra obraId={obraId} />

      <div className="rounded-2xl border border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-900/40 overflow-hidden flex flex-col">
        <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-700/60 flex items-center gap-2">
          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 min-w-0">
            <MessageSquare className="h-4 w-4 text-orange-600 flex-shrink-0" />
            {/* Sin el nombre de la obra (pedido del usuario, oct-2026). */}
            <span className="truncate">Bitácora / Chat</span>
          </h4>
        </div>

        {/* Alto para leer varios mensajes sin hacer scroll (pedido del usuario, oct-2026). */}
        <div className="min-h-[10rem] sm:min-h-[18rem] max-h-[24rem] sm:max-h-[34rem] overflow-y-auto bg-slate-50/40 dark:bg-slate-900/20">
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
            </div>
          ) : ordenadas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 sm:py-10 px-6 text-center">
              <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
                <MessageSquare className="h-6 w-6 text-slate-400" />
              </div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Sin mensajes aún</p>
              <p className="text-xs text-slate-400 mt-1">Escribe el primer mensaje de esta bitácora</p>
            </div>
          ) : (
            <div className="p-4 space-y-2">
              {ordenadas.map((nota) => {
                const mia = nota.autorId === user?.id;
                return (
                  <div
                    key={nota.id}
                    className={`group/nota flex flex-col ${mia ? "items-end" : "items-start"}`}
                    data-testid={`nota-bitacora-${nota.id}`}
                  >
                    {!mia && (
                      <span className="text-[11px] font-semibold ml-1 mb-0.5 text-slate-500">{nota.autorNombre || "—"}</span>
                    )}
                    <div className={`flex items-end gap-1.5 max-w-[85%] ${mia ? "flex-row-reverse" : ""}`}>
                      <div
                        className={`rounded-2xl px-3 py-2 shadow-sm ${
                          mia
                            ? "bg-[#fd6301] text-white rounded-br-md"
                            : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-bl-md"
                        }`}
                      >
                        <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{nota.texto}</p>
                        <span className={`block text-[10px] mt-0.5 text-right ${mia ? "text-white/70" : "text-slate-400"}`}>
                          {fmtCuando(nota.createdAt)}
                        </span>
                      </div>
                      {puedeBorrar(nota) && (
                        <button
                          onClick={() => borrar.mutate(nota.id)}
                          className="opacity-0 group-hover/nota:opacity-100 focus:opacity-100 text-slate-300 hover:text-red-600 transition-all flex-shrink-0 mb-1"
                          aria-label="Borrar mensaje"
                          data-testid={`button-borrar-nota-${nota.id}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="px-3 lg:px-4 py-3 border-t border-slate-200 dark:border-slate-700/60">
          <div className="flex items-end gap-2">
            <Textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => {
                // Enter manda, Shift+Enter hace salto, igual que en Seguimiento.
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  guardar();
                }
              }}
              rows={1}
              placeholder="Escribe un mensaje…"
              enterKeyHint="send"
              className="flex-1 min-h-[40px] max-h-[120px] py-2 text-base md:text-sm resize-none rounded-xl focus:border-orange-400 focus:ring-orange-400/20"
              data-testid={`input-bitacora-${obraId}`}
            />
            <Button
              onClick={guardar}
              disabled={!texto.trim() || escribir.isPending}
              size="sm"
              className="h-10 w-10 p-0 rounded-xl bg-gradient-to-r from-orange-500 to-[#fd6301] hover:from-[#fd6301] hover:to-[#e35400] shadow-md flex-shrink-0"
              aria-label="Enviar mensaje"
              data-testid={`button-bitacora-guardar-${obraId}`}
            >
              {escribir.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
