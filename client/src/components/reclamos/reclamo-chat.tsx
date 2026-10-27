import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { format, isToday } from "date-fns";
import { es } from "date-fns/locale";
import { Loader2, MessageSquare, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ICONO_CHIP_SM, ICONO_CHIP_ICONO_SM } from "@/lib/icono-chip";
import { ROLE_LABELS } from "@shared/permissions";
import type { ReclamoGeneralMensaje } from "@shared/schema";

/**
 * Chat de un reclamo: los involucrados (técnico, vendedor, laboratorio, áreas,
 * supervisor) conversan sobre el caso desde su ficha, como en el detalle del
 * Seguimiento del Panel de Trabajo. Se refresca solo cada 15 segundos.
 */
export function ReclamoChat({ reclamoId, userId }: { reclamoId: string; userId?: string }) {
  const [texto, setTexto] = useState("");
  const finRef = useRef<HTMLDivElement>(null);
  const clave = ["/api/reclamos-generales", reclamoId, "mensajes"];

  const { data: mensajes = [], isLoading } = useQuery<ReclamoGeneralMensaje[]>({
    queryKey: clave,
    queryFn: async () => (await apiRequest(`/api/reclamos-generales/${reclamoId}/mensajes`)).json(),
    refetchInterval: 15000,
  });

  const enviar = useMutation({
    mutationFn: async (mensaje: string) =>
      (await apiRequest(`/api/reclamos-generales/${reclamoId}/mensajes`, {
        method: "POST",
        data: { mensaje },
      })).json(),
    onSuccess: () => {
      setTexto("");
      queryClient.invalidateQueries({ queryKey: clave });
    },
  });

  // Al llegar mensajes nuevos, el último queda a la vista.
  useEffect(() => {
    finRef.current?.scrollIntoView({ block: "nearest" });
  }, [mensajes.length]);

  const mandar = () => {
    const limpio = texto.trim();
    if (limpio && !enviar.isPending) enviar.mutate(limpio);
  };

  return (
    <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900 flex flex-col lg:sticky lg:top-4 h-[70vh] min-h-[420px]">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 dark:border-slate-800">
        <div className={ICONO_CHIP_SM}>
          <MessageSquare className={ICONO_CHIP_ICONO_SM} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Conversación</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Habla con los involucrados en este reclamo</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-[#fd6301]" />
          </div>
        ) : mensajes.length === 0 ? (
          <div className="text-center py-10 text-sm text-slate-500 dark:text-slate-400">
            Todavía no hay mensajes. Escribe el primero.
          </div>
        ) : (
          mensajes.map((m) => {
            const mio = m.userId === userId;
            const cuando = m.createdAt ? new Date(m.createdAt) : null;
            return (
              <div key={m.id} className={`flex flex-col ${mio ? "items-end" : "items-start"}`}>
                <div className="flex items-baseline gap-1.5 mb-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                  <span className="font-semibold text-slate-700 dark:text-slate-200">{mio ? "Tú" : m.userName}</span>
                  {!mio && m.userRole && <span>· {ROLE_LABELS[m.userRole] ?? m.userRole}</span>}
                  {cuando && (
                    <span>· {format(cuando, isToday(cuando) ? "HH:mm" : "dd MMM · HH:mm", { locale: es })}</span>
                  )}
                </div>
                <div
                  className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm ${
                    mio
                      ? "bg-[#fd6301] text-white rounded-br-md"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-bl-md"
                  }`}
                >
                  {m.mensaje}
                </div>
              </div>
            );
          })
        )}
        <div ref={finRef} />
      </div>

      <div className="border-t border-slate-100 dark:border-slate-800 p-3" data-sin-brillo>
        <div className="flex items-end gap-2">
          <Textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              // Enter envía; Shift+Enter hace salto de línea.
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                mandar();
              }
            }}
            placeholder="Escribe un mensaje..."
            rows={2}
            className="resize-none rounded-2xl border-slate-200/70 dark:border-slate-800 focus-visible:border-[#fd6301] focus-visible:ring-orange-500/20"
            data-testid="input-mensaje-reclamo"
          />
          <Button
            onClick={mandar}
            disabled={!texto.trim() || enviar.isPending}
            className="h-10 w-10 p-0 rounded-2xl bg-[#fd6301] hover:bg-[#e35400] text-white shrink-0"
            aria-label="Enviar mensaje"
            data-testid="button-enviar-mensaje-reclamo"
          >
            {enviar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
        {enviar.isError && (
          <p className="mt-1.5 text-xs text-red-600">No se pudo enviar el mensaje. Intenta de nuevo.</p>
        )}
      </div>
    </div>
  );
}
