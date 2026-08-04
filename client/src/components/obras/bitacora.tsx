/**
 * Bitácora de una obra — el hilo de lo que va pasando en terreno.
 *
 * La planilla y el panel de productos cuentan CUÁNTO (viviendas pintadas,
 * tinetas pedidas, saldo en obra). Lo que no cabía en ningún número es el
 * relato: que la cuadrilla entró recién el lunes, que el mandante cambió el
 * color de la fachada, que quedó una tineta abierta en bodega. Eso es lo que se
 * escribe acá, y es lo que se lee antes de llamar a la constructora.
 *
 * Las entradas viven en `pedido_bitacora` con documentoTipo='obra' — la misma
 * tabla genérica (nota + tipo + autor + fecha) que ya usan la ficha del cliente
 * y las solicitudes de marketing. No hay tabla nueva: el formato es idéntico y
 * los endpoints /api/bitacora ya existen.
 */
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertTriangle,
  Loader2,
  MapPin,
  MessageSquare,
  Paintbrush,
  Send,
  ShoppingCart,
  Trash2,
} from "lucide-react";
import type { ObraConCliente, PedidoBitacora } from "@shared/schema";

/**
 * Tipos de entrada de la bitácora de obra.
 *
 * Son los del `tipo` de pedido_bitacora (texto libre en la base), elegidos para
 * lo que de verdad se anota en una obra: la visita, cómo viene el avance, el
 * pedido que se prometió y el problema que hay que resolver.
 */
export const OBRA_BITACORA_TIPOS = [
  { value: "visita", label: "Visita", icon: MapPin, color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" },
  { value: "avance", label: "Avance", icon: Paintbrush, color: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300" },
  { value: "pedido", label: "Pedido", icon: ShoppingCart, color: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" },
  { value: "problema", label: "Problema", icon: AlertTriangle, color: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300" },
  { value: "nota", label: "Nota", icon: MessageSquare, color: "bg-slate-100 text-slate-600 dark:bg-slate-700/60 dark:text-slate-300" },
] as const;

export const tipoBitacora = (tipo: string | null | undefined) =>
  OBRA_BITACORA_TIPOS.find((t) => t.value === tipo) ?? OBRA_BITACORA_TIPOS[4];

/** Clave de caché de las entradas de una obra (para invalidar desde afuera). */
export const claveBitacoraObra = (obraId: string) => ["/api/bitacora", "obra", obraId];

const fechaLarga = new Intl.DateTimeFormat("es-CL", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export const fmtFecha = (valor: string | Date | null | undefined) => {
  if (!valor) return "—";
  const d = new Date(valor);
  return isNaN(d.getTime()) ? "—" : fechaLarga.format(d);
};

/** "hace 3 días" — la antigüedad es lo primero que se mira en un hilo. */
export const hace = (valor: string | Date | null | undefined) => {
  if (!valor) return "";
  const d = new Date(valor);
  if (isNaN(d.getTime())) return "";
  const min = Math.round((Date.now() - d.getTime()) / 60000);
  if (min < 1) return "recién";
  if (min < 60) return `hace ${min} min`;
  const horas = Math.round(min / 60);
  if (horas < 24) return `hace ${horas} h`;
  const dias = Math.round(horas / 24);
  if (dias < 31) return `hace ${dias} ${dias === 1 ? "día" : "días"}`;
  const meses = Math.round(dias / 30);
  return `hace ${meses} ${meses === 1 ? "mes" : "meses"}`;
};

export function BitacoraObra({ obra }: { obra: ObraConCliente }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [tipo, setTipo] = useState<string>("visita");
  const [nota, setNota] = useState("");

  // Una entrada de bitácora es un registro de lo que pasó: la borra quien la
  // escribió, o quien manda en el área si quedó mal cargada.
  const puedeBorrarTodo =
    user?.role === "admin" || user?.role === "supervisor" || user?.role === "encargado_area";

  const { data: entradas = [], isLoading } = useQuery<PedidoBitacora[]>({
    queryKey: claveBitacoraObra(obra.id),
    queryFn: async () => {
      const params = new URLSearchParams({ documentoTipo: "obra", documentoId: obra.id });
      const res = await apiRequest(`/api/bitacora?${params}`);
      return res.json();
    },
  });

  const invalidar = () => {
    queryClient.invalidateQueries({ queryKey: claveBitacoraObra(obra.id) });
    // El listado de obras muestra la última entrada y el contador de cada una.
    queryClient.invalidateQueries({ queryKey: ["/api/obras/bitacora-resumen"] });
  };

  const agregar = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("/api/bitacora", {
        method: "POST",
        data: {
          documentoTipo: "obra",
          documentoId: obra.id,
          // Con qué obra y de qué constructora, para que la entrada se entienda
          // sola si algún día se lee fuera de esta pantalla (documento_numero es
          // varchar(100): el nombre de la obra va recortado a esa medida).
          documentoNumero: obra.nombre.slice(0, 100),
          clienteNombre: obra.clienteNombre,
          nota: nota.trim(),
          tipo,
        },
      });
      return res.json();
    },
    onSuccess: () => {
      setNota("");
      invalidar();
    },
    onError: (error: any) => {
      toast({ title: "No se pudo guardar la entrada", description: error?.message, variant: "destructive" });
    },
  });

  const eliminar = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest(`/api/bitacora/${id}`, { method: "DELETE" });
    },
    onSuccess: invalidar,
    onError: (error: any) => {
      toast({ title: "No se pudo eliminar la entrada", description: error?.message, variant: "destructive" });
    },
  });

  const enviar = () => {
    if (!nota.trim()) return;
    agregar.mutate();
  };

  return (
    <div className="space-y-4">
      {/* ---------- Escribir ---------- */}
      <div className="rounded-2xl border border-slate-200/70 dark:border-slate-700/60 bg-white dark:bg-slate-800/40 p-3.5 shadow-sm">
        <div className="flex flex-wrap gap-1.5">
          {OBRA_BITACORA_TIPOS.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setTipo(t.value)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold transition-all ${t.color} ${
                tipo === t.value
                  ? "ring-2 ring-offset-1 ring-slate-400 dark:ring-offset-slate-900"
                  : "opacity-70 hover:opacity-100"
              }`}
              data-testid={`button-bitacora-tipo-${t.value}`}
            >
              <t.icon className="h-3 w-3" />
              {t.label}
            </button>
          ))}
        </div>
        <Textarea
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          onKeyDown={(e) => {
            // Enter manda; Shift+Enter hace párrafo. Una bitácora se escribe de a
            // una línea, así que pedir el mouse para guardar sobra.
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              enviar();
            }
          }}
          placeholder={`¿Qué pasó en ${obra.nombre}? (visita, avance, pedido prometido, problema…)`}
          rows={3}
          className="mt-3 rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 focus:border-orange-400 focus:ring-orange-400/20 resize-none"
          data-testid="input-bitacora-nota"
        />
        <div className="mt-2.5 flex items-center justify-between gap-3">
          <span className="text-[11px] text-slate-400">Enter para guardar · Shift + Enter para otra línea</span>
          <Button
            onClick={enviar}
            disabled={!nota.trim() || agregar.isPending}
            className="rounded-2xl bg-gradient-to-r from-[#fd6301] to-[#fd6301] hover:from-[#e35400] hover:to-[#e35400] text-white shadow-md shadow-orange-500/25 transition-all"
            data-testid="button-bitacora-guardar"
          >
            {agregar.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            Registrar
          </Button>
        </div>
      </div>

      {/* ---------- Hilo ---------- */}
      {isLoading ? (
        <div className="flex items-center justify-center py-10 text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : entradas.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40 px-6 py-10 text-center">
          <MessageSquare className="h-7 w-7 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
          <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">Bitácora vacía</p>
          <p className="text-xs text-slate-400 mt-1">
            Anota la primera visita a la obra: lo que se vio en terreno y lo que quedó comprometido.
          </p>
        </div>
      ) : (
        <div data-testid="lista-bitacora-obra">
          {entradas.map((entrada, i) => {
            const cfg = tipoBitacora(entrada.tipo);
            const ultima = i === entradas.length - 1;
            const puedeBorrar = puedeBorrarTodo || entrada.autorId === user?.id;
            return (
              <div key={entrada.id} className="flex gap-3 relative">
                {!ultima && (
                  <div className="absolute left-[17px] top-9 w-px h-[calc(100%-16px)] bg-slate-200 dark:bg-slate-700" />
                )}
                <div className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center z-10 ${cfg.color}`}>
                  <cfg.icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0 pb-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${cfg.color}`}>
                      {cfg.label}
                    </span>
                    <span
                      className="text-[11px] text-slate-400 ml-auto whitespace-nowrap"
                      title={fmtFecha(entrada.createdAt)}
                    >
                      {hace(entrada.createdAt)}
                    </span>
                    {puedeBorrar && (
                      <button
                        onClick={() => eliminar.mutate(entrada.id)}
                        className="text-slate-300 hover:text-red-500 transition-colors p-0.5 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20"
                        title="Eliminar entrada"
                        data-testid={`button-bitacora-eliminar-${entrada.id}`}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-slate-700 dark:text-slate-200 mt-1 whitespace-pre-wrap">{entrada.nota}</p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    por {entrada.autorNombre} · {fmtFecha(entrada.createdAt)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default BitacoraObra;
