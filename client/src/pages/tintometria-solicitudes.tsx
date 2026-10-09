/**
 * Solicitudes a laboratorio: el vendedor pide la fórmula y/o el precio de un
 * color para un cliente; laboratorio responde acá mismo.
 *
 * Reemplaza la planilla "Solicitud de fórmula tintométrica" que se mandaba por
 * correo: el formulario pide los mismos datos, y la conversación con
 * laboratorio queda en el hilo de cada solicitud.
 *
 * Laboratorio (permiso "Bandeja de laboratorio") ve todas y responde; quien
 * pide ve las suyas, y su supervisor las del equipo. La fórmula que responde
 * laboratorio queda en la carta de colores y solo la ve quien tiene "Ver
 * fórmulas" (el operador); el vendedor ve que está lista y el precio.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Check,
  FlaskConical,
  Loader2,
  Paperclip,
  Plus,
  Search,
  Send,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TABS_LIST_PILL, TAB_PILL } from "@/components/gastos/tabs-pill";
import { ICONO_CHIP, ICONO_CHIP_ICONO } from "@/lib/icono-chip";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { dosisEnMl, leerDosis, nombreCartilla, nombreFormato, type ItemFormula } from "@shared/tintometria";
import type { TintoFormula, TintoSolicitud, TintoSolicitudMensaje } from "@shared/schema";

type Tipo = "formula" | "precio" | "formula_precio";

interface FilaLista extends TintoSolicitud {
  hex: string | null;
  mensajes: number;
  lado: "solicitante" | "laboratorio";
  nueva: boolean;
}

interface Detalle extends TintoSolicitud {
  lado: "solicitante" | "laboratorio";
  puedeResponder: boolean;
  color: { hex: string | null; nombre: string | null; codigo: string; cartilla: string } | null;
  formula: TintoFormula | null;
  mensajes: TintoSolicitudMensaje[];
}

interface ColorCarta {
  id: string;
  cartilla: string;
  codigo: string;
  nombre: string | null;
  hex: string | null;
}

const TIPOS: { valor: Tipo; texto: string }[] = [
  { valor: "formula", texto: "Fórmula" },
  { valor: "precio", texto: "Precio" },
  { valor: "formula_precio", texto: "Fórmula y precio" },
];
const TIPO_TEXTO: Record<string, string> = { formula: "Fórmula", precio: "Precio", formula_precio: "Fórmula y precio" };

const ESTADO: Record<string, { texto: string; clase: string }> = {
  enviada: { texto: "ENVIADA", clase: "bg-amber-100 text-amber-800 border-amber-200" },
  en_desarrollo: { texto: "EN DESARROLLO", clase: "bg-sky-100 text-sky-800 border-sky-200" },
  respondida: { texto: "APROBADA", clase: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  rechazada: { texto: "RECHAZADA", clase: "bg-red-100 text-red-700 border-red-200" },
};
const ABIERTAS = ["enviada", "en_desarrollo"];

const EVENTO: Record<string, string> = {
  creada: "envió la solicitud",
  en_desarrollo: "la tomó: está en desarrollo",
  respondida: "aprobó la solicitud",
  rechazada: "rechazó la solicitud",
};

const fmtFecha = (v: string | Date | null | undefined, conHora = false) => {
  if (!v) return "—";
  const d = new Date(v as any);
  if (Number.isNaN(d.getTime())) return "—";
  return conHora
    ? d.toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" })
    : d.toLocaleDateString("es-CL");
};
const money = (v: unknown) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? `$${Math.round(n).toLocaleString("es-CL")}` : "—";
};
const normalizar = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[\s-]+/g, "");

const CAMPO = "h-10 rounded-xl text-sm bg-slate-50/60 focus-visible:border-[#fd6301] focus-visible:ring-orange-500/20";
const ETIQUETA = "text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1";
// Los formatos que se pueden pedir. Se guardan juntos, en este orden: "Galón, Balde 4 gl".
const FORMATOS = ["1/4 de Galón", "Galón", "Balde 4 gl", "Balde 5 gl"] as const;
const BOTON_MARCA =
  "rounded-2xl bg-gradient-to-r from-[#fd6301] to-[#fd6301] hover:from-[#e35400] hover:to-[#e35400] text-white shadow-md shadow-orange-500/25";

async function subirArchivo(file: File): Promise<{ url: string; nombre: string }> {
  const datos = new FormData();
  datos.append("file", file);
  const res = await fetch("/api/upload", { method: "POST", body: datos, credentials: "include" });
  if (!res.ok) throw new Error("No se pudo subir el archivo");
  const json = await res.json();
  const url = json.fileUrl || json.url;
  if (!url) throw new Error("El servidor no devolvió la ubicación del archivo");
  return { url, nombre: file.name };
}

export default function TintometriaSolicitudesPage() {
  const { can } = usePermissions();
  const puedeSolicitar = can("tintometria.solicitudes");
  const esLaboratorio = can("tintometria.laboratorio");
  const busqueda = useSearch();
  const [, navegar] = useLocation();
  const params = useMemo(() => new URLSearchParams(busqueda), [busqueda]);
  const colorInicial = params.get("color");
  const [tab, setTab] = useState(colorInicial ? "nueva" : esLaboratorio || !puedeSolicitar ? "curso" : "nueva");
  const [abierta, setAbierta] = useState<string | null>(params.get("id"));

  // Un enlace de correo (?id=…) abre la solicitud directo.
  useEffect(() => {
    const id = params.get("id");
    if (id) setAbierta(id);
  }, [params]);

  const { data: solicitudes = [], isLoading } = useQuery<FilaLista[]>({
    queryKey: ["/api/tintometria/solicitudes"],
    refetchInterval: 60000,
  });
  const enCurso = solicitudes.filter((s) => ABIERTAS.includes(s.estado));
  const cerradas = solicitudes.filter((s) => !ABIERTAS.includes(s.estado));

  const cerrarDetalle = () => {
    setAbierta(null);
    if (params.get("id")) navegar("/tintometria/solicitudes", { replace: true });
  };

  return (
    <div className="p-3 sm:p-5 space-y-4 max-w-5xl mx-auto">
      <div className="flex items-start gap-3">
        <div className={ICONO_CHIP}>
          <FlaskConical className={ICONO_CHIP_ICONO} />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Solicitudes a laboratorio</h1>
          <p className="hidden sm:block text-sm text-slate-500 dark:text-slate-400">
            Pídele a laboratorio la fórmula o el precio de un color para un cliente, y sigue la respuesta acá.
          </p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className={TABS_LIST_PILL}>
          {puedeSolicitar && (
            <TabsTrigger value="nueva" className={TAB_PILL} data-testid="tab-lab-nueva">
              Nueva solicitud
            </TabsTrigger>
          )}
          <TabsTrigger value="curso" className={TAB_PILL} data-testid="tab-lab-curso">
            En curso
            {enCurso.length > 0 && <span className="tabular-nums opacity-70">{enCurso.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="cerradas" className={TAB_PILL} data-testid="tab-lab-cerradas">
            Cerradas
          </TabsTrigger>
        </TabsList>

        {puedeSolicitar && (
          <TabsContent value="nueva" className="mt-4">
            <NuevaSolicitud
              colorInicial={colorInicial}
              onEnviada={(id) => {
                setTab("curso");
                setAbierta(id);
                if (colorInicial) navegar("/tintometria/solicitudes", { replace: true });
              }}
            />
          </TabsContent>
        )}
        <TabsContent value="curso" className="mt-4">
          <Lista
            filas={enCurso}
            cargando={isLoading}
            vacio={esLaboratorio ? "No hay solicitudes esperando a laboratorio." : "No tienes solicitudes en curso."}
            onAbrir={setAbierta}
          />
        </TabsContent>
        <TabsContent value="cerradas" className="mt-4">
          <Lista filas={cerradas} cargando={isLoading} vacio="Todavía no hay solicitudes cerradas." onAbrir={setAbierta} />
        </TabsContent>
      </Tabs>

      <DetalleSolicitud id={abierta} onCerrar={cerrarDetalle} />
    </div>
  );
}

// ── Listado ────────────────────────────────────────────────────────────────

function Lista({
  filas,
  cargando,
  vacio,
  onAbrir,
}: {
  filas: FilaLista[];
  cargando: boolean;
  vacio: string;
  onAbrir: (id: string) => void;
}) {
  if (cargando) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
      </div>
    );
  }
  if (filas.length === 0) return <p className="py-12 text-center text-sm text-slate-400">{vacio}</p>;
  return (
    <div className="space-y-2">
      {filas.map((s) => {
        const estado = ESTADO[s.estado] ?? { texto: s.estado.toUpperCase(), clase: "" };
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onAbrir(s.id)}
            className="w-full text-left rounded-2xl border border-slate-200/70 dark:border-slate-700/60 bg-white dark:bg-slate-900/40 p-3 shadow-sm hover:border-orange-200 hover:shadow transition-all flex items-center gap-3"
            data-testid={`solicitud-lab-${s.numero}`}
          >
            <span
              className={`h-11 w-11 shrink-0 rounded-xl border border-slate-200/70 dark:border-slate-700/60 ${s.hex ? "" : "bg-slate-50 dark:bg-slate-800"}`}
              style={s.hex ? { backgroundColor: s.hex } : undefined}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2 min-w-0">
                <span className="text-xs text-slate-400 tabular-nums">#{s.numero}</span>
                <span className="truncate text-sm font-bold text-slate-800 dark:text-slate-100">
                  {s.colorCodigo}
                  {s.colorNombre ? <span className="font-normal text-slate-500"> · {s.colorNombre}</span> : null}
                </span>
                {s.nueva && <span className="h-2 w-2 shrink-0 rounded-full bg-[#fd6301]" title="Tiene novedades" />}
              </div>
              <div className="truncate text-xs text-slate-500">
                {s.clienteNombre} · {s.linea} · {TIPO_TEXTO[s.tipo] ?? s.tipo}
              </div>
              <div className="truncate text-[11px] text-slate-400">
                {s.solicitanteNombre ?? "—"} · {fmtFecha(s.createdAt)}
                {s.mensajes > 0 ? ` · ${s.mensajes} ${s.mensajes === 1 ? "mensaje" : "mensajes"}` : ""}
              </div>
            </div>
            <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${estado.clase}`}>{estado.texto}</span>
          </button>
        );
      })}
    </div>
  );
}

// ── Nueva solicitud ────────────────────────────────────────────────────────

const FORM_VACIO = {
  tipo: "formula" as Tipo,
  clienteId: null as string | null,
  clienteNombre: "",
  ciudad: "",
  obra: "",
  colorId: null as string | null,
  colorCodigo: "",
  colorNombre: "",
  cartilla: "",
  linea: "",
  base: "",
  formato: "",
  cantidad: "",
  patron: "",
  lote: "",
  observaciones: "",
};

function NuevaSolicitud({ colorInicial, onEnviada }: { colorInicial: string | null; onEnviada: (id: string) => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState(FORM_VACIO);
  const [adjuntos, setAdjuntos] = useState<{ url: string; nombre: string }[]>([]);
  const [subiendo, setSubiendo] = useState(false);
  const [continuacion, setContinuacion] = useState(false);
  const archivoRef = useRef<HTMLInputElement>(null);
  const set = <K extends keyof typeof FORM_VACIO>(k: K, v: (typeof FORM_VACIO)[K]) => setForm((f) => ({ ...f, [k]: v }));

  // La carta, para elegir el color de ahí (y que la fórmula quede en su ficha).
  const { data: carta = [] } = useQuery<ColorCarta[]>({ queryKey: ["/api/tintometria/carta"], staleTime: 5 * 60 * 1000 });
  useEffect(() => {
    if (!colorInicial || carta.length === 0) return;
    const c = carta.find((x) => x.id === colorInicial);
    if (c) setForm((f) => ({ ...f, colorId: c.id, colorCodigo: c.codigo, colorNombre: c.nombre ?? "", cartilla: c.cartilla }));
  }, [colorInicial, carta]);

  const enviar = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("/api/tintometria/solicitudes", {
        method: "POST",
        data: {
          ...form,
          ciudad: form.ciudad || null,
          obra: form.obra || null,
          colorNombre: form.colorNombre || null,
          cartilla: form.cartilla || null,
          base: form.base || null,
          formato: form.formato || null,
          cantidad: form.tipo === "formula" ? null : form.cantidad || null,
          patron: continuacion ? form.patron || null : null,
          lote: continuacion ? form.lote || null : null,
          observaciones: form.observaciones || null,
          adjuntos,
        },
      });
      return res.json();
    },
    onSuccess: (nueva: TintoSolicitud) => {
      setForm(FORM_VACIO);
      setAdjuntos([]);
      setContinuacion(false);
      queryClient.invalidateQueries({ queryKey: ["/api/tintometria/solicitudes"] });
      toast({ title: `Solicitud #${nueva.numero} enviada`, description: "Laboratorio la recibió por correo y en su bandeja." });
      onEnviada(nueva.id);
    },
    onError: (error: any) => toast({ title: "No se pudo enviar", description: error?.message, variant: "destructive" }),
  });

  const faltan = !form.clienteNombre.trim() || !form.colorCodigo.trim() || !form.linea.trim();

  const adjuntar = async (file: File) => {
    setSubiendo(true);
    try {
      const a = await subirArchivo(file);
      setAdjuntos((l) => [...l, a]);
    } catch (error: any) {
      toast({ title: "No se pudo adjuntar", description: error?.message, variant: "destructive" });
    } finally {
      setSubiendo(false);
      if (archivoRef.current) archivoRef.current.value = "";
    }
  };

  return (
    <div className="space-y-3">
      <Bloque numero={1} titulo="Qué necesitas">
        <div className="flex flex-wrap gap-1.5">
          {TIPOS.map((t) => (
            <button
              key={t.valor}
              type="button"
              onClick={() => set("tipo", t.valor)}
              aria-pressed={form.tipo === t.valor}
              className={`h-9 px-4 rounded-xl text-xs font-bold border transition-all ${
                form.tipo === t.valor
                  ? "bg-[#fd6301] text-white border-[#fd6301] shadow-sm shadow-[#fd6301]/25"
                  : "bg-white dark:bg-slate-900/40 text-slate-600 dark:text-slate-300 border-slate-200/70 dark:border-slate-700/60 hover:border-[#fd6301]/50 hover:text-[#fd6301]"
              }`}
              data-testid={`chip-tipo-${t.valor}`}
            >
              {t.texto}
            </button>
          ))}
        </div>
      </Bloque>

      <Bloque numero={2} titulo="Cliente">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <BuscadorCliente
            valor={form.clienteNombre}
            onEscribir={(v) => setForm((f) => ({ ...f, clienteNombre: v, clienteId: null }))}
            onElegir={(c) => setForm((f) => ({ ...f, clienteId: c.id, clienteNombre: c.nokoen, ciudad: f.ciudad || c.comuna || "" }))}
          />
          <div>
            <div className={ETIQUETA}>Ciudad</div>
            <Input value={form.ciudad} onChange={(e) => set("ciudad", e.target.value)} className={CAMPO} placeholder="Ej.: Concepción" />
          </div>
          <div className="sm:col-span-2">
            <div className={ETIQUETA}>Obra</div>
            <Input value={form.obra} onChange={(e) => set("obra", e.target.value)} className={CAMPO} placeholder="Si es para una obra, cuál" />
          </div>
        </div>
      </Bloque>

      <Bloque numero={3} titulo="Color">
        <BuscadorColor
          carta={carta}
          elegido={form.colorId}
          onElegir={(c) =>
            setForm((f) => ({ ...f, colorId: c.id, colorCodigo: c.codigo, colorNombre: c.nombre ?? "", cartilla: c.cartilla }))
          }
          onQuitar={() => setForm((f) => ({ ...f, colorId: null }))}
        />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <div className={ETIQUETA}>
              Código <span className="text-[#fd6301]">obligatorio</span>
            </div>
            <Input
              value={form.colorCodigo}
              onChange={(e) => setForm((f) => ({ ...f, colorCodigo: e.target.value, colorId: null }))}
              className={CAMPO}
              placeholder="Ej.: SW 7019"
              data-testid="input-lab-color-codigo"
            />
          </div>
          <div>
            <div className={ETIQUETA}>Nombre</div>
            <Input value={form.colorNombre} onChange={(e) => set("colorNombre", e.target.value)} className={CAMPO} placeholder="Ej.: Gauntlet Gray" />
          </div>
          <div>
            <div className={ETIQUETA}>Cartilla</div>
            <Input
              value={form.cartilla ? nombreCartilla(form.cartilla) : ""}
              onChange={(e) => setForm((f) => ({ ...f, cartilla: e.target.value, colorId: null }))}
              className={CAMPO}
              placeholder="Ej.: Sherwin-Williams, RAL, NCS"
            />
          </div>
        </div>
      </Bloque>

      <Bloque numero={4} titulo="Desarrollo">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <div className={ETIQUETA}>
              Línea a desarrollar <span className="text-[#fd6301]">obligatorio</span>
            </div>
            <Input value={form.linea} onChange={(e) => set("linea", e.target.value)} className={CAMPO} placeholder="Ej.: Textu EIFS G-25" data-testid="input-lab-linea" />
          </div>
          <div>
            <div className={ETIQUETA}>Base</div>
            <Input value={form.base} onChange={(e) => set("base", e.target.value)} className={CAMPO} placeholder="Ej.: Base oscura" />
          </div>
          <div>
            <div className={ETIQUETA}>Formato</div>
            <div className="flex flex-wrap gap-1.5">
              {FORMATOS.map((f) => {
                const elegidos = form.formato ? form.formato.split(", ") : [];
                const activo = elegidos.includes(f);
                return (
                  <button
                    key={f}
                    type="button"
                    aria-pressed={activo}
                    onClick={() =>
                      set("formato", FORMATOS.filter((x) => (x === f ? !activo : elegidos.includes(x))).join(", "))
                    }
                    className={`h-10 px-3 rounded-xl border text-sm transition-colors ${
                      activo
                        ? "border-[#fd6301] bg-[#fd6301] text-white font-semibold"
                        : "border-slate-200 bg-slate-50/60 text-slate-600 hover:border-[#fd6301]/50 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-300"
                    }`}
                    data-testid={`chip-lab-formato-${f}`}
                  >
                    {f}
                  </button>
                );
              })}
            </div>
          </div>
          {form.tipo !== "formula" && (
            <div>
              <div className={ETIQUETA}>Cantidad estimada</div>
              <Input value={form.cantidad} onChange={(e) => set("cantidad", e.target.value)} className={CAMPO} placeholder="Ej.: 20 tinetas" />
            </div>
          )}
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={continuacion}
            onChange={(e) => setContinuacion(e.target.checked)}
            className="h-4 w-4 accent-[#fd6301]"
          />
          Es continuación de obra (hay que igualar un patrón)
        </label>
        {continuacion && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className={ETIQUETA}>Patrón</div>
              <Input value={form.patron} onChange={(e) => set("patron", e.target.value)} className={CAMPO} />
            </div>
            <div>
              <div className={ETIQUETA}>Lote</div>
              <Input value={form.lote} onChange={(e) => set("lote", e.target.value)} className={CAMPO} />
            </div>
          </div>
        )}
        <div>
          <div className={ETIQUETA}>Observaciones</div>
          <Textarea
            value={form.observaciones}
            onChange={(e) => set("observaciones", e.target.value)}
            className="rounded-xl text-sm bg-slate-50/60 min-h-[72px]"
            placeholder="Lo que laboratorio tiene que saber: superficie, brillo, plazo…"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={archivoRef}
            type="file"
            className="hidden"
            accept=".jpg,.jpeg,.png,.webp,.pdf,.heic"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void adjuntar(f);
            }}
          />
          {adjuntos.map((a) => (
            <span key={a.url} className="inline-flex items-center gap-1.5 h-8 rounded-xl border border-emerald-200 bg-emerald-50/60 px-2.5 text-xs text-emerald-800">
              <Paperclip className="h-3.5 w-3.5" />
              <span className="max-w-[160px] truncate">{a.nombre}</span>
              <button onClick={() => setAdjuntos((l) => l.filter((x) => x.url !== a.url))} aria-label="Quitar adjunto">
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
          {adjuntos.length < 5 && (
            <Button
              type="button"
              variant="outline"
              onClick={() => archivoRef.current?.click()}
              disabled={subiendo}
              className="h-8 rounded-xl text-xs gap-1.5 border-dashed"
            >
              {subiendo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              {subiendo ? "Subiendo…" : "Adjuntar foto de la muestra"}
            </Button>
          )}
        </div>
      </Bloque>

      <div className="flex justify-end">
        <Button
          onClick={() => enviar.mutate()}
          disabled={faltan || enviar.isPending || subiendo}
          className={`h-10 ${BOTON_MARCA}`}
          data-testid="button-enviar-solicitud-lab"
        >
          {enviar.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
          Enviar a laboratorio
        </Button>
      </div>
    </div>
  );
}

function Bloque({ numero, titulo, children }: { numero: number; titulo: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200/70 dark:border-slate-700/60 bg-white dark:bg-slate-900/40 p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
        <span className="w-6 h-6 rounded-lg bg-[#fd6301] text-white text-xs flex items-center justify-center shadow-md shadow-[#fd6301]/25">
          {numero}
        </span>
        {titulo}
      </div>
      {children}
    </div>
  );
}

function BuscadorCliente({
  valor,
  onEscribir,
  onElegir,
}: {
  valor: string;
  onEscribir: (v: string) => void;
  onElegir: (c: { id: string; nokoen: string; comuna?: string | null }) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [termino, setTermino] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setTermino(valor.trim()), 300);
    return () => clearTimeout(t);
  }, [valor]);
  const { data: resultados = [], isFetching } = useQuery<Array<{ id: string; nokoen: string; rten?: string | null; comuna?: string | null }>>({
    queryKey: [`/api/clients/search?q=${encodeURIComponent(termino)}`],
    enabled: abierto && termino.length >= 2,
  });
  return (
    <div className="relative">
      <div className={ETIQUETA}>
        Cliente <span className="text-[#fd6301]">obligatorio</span>
      </div>
      <Input
        value={valor}
        onChange={(e) => {
          onEscribir(e.target.value);
          setAbierto(true);
        }}
        onFocus={() => setAbierto(true)}
        onBlur={() => setTimeout(() => setAbierto(false), 150)}
        className={CAMPO}
        placeholder="Busca por nombre o RUT, o escríbelo si no está"
        data-testid="input-lab-cliente"
      />
      {abierto && termino.length >= 2 && (resultados.length > 0 || isFetching) && (
        <div className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
          {isFetching && resultados.length === 0 ? (
            <div className="p-3 text-xs text-slate-400">Buscando…</div>
          ) : (
            resultados.slice(0, 20).map((c) => (
              <button
                key={c.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onElegir(c);
                  setAbierto(false);
                }}
                className="w-full px-3 py-2 text-left text-sm hover:bg-orange-50 dark:hover:bg-slate-800"
              >
                <span className="font-medium text-slate-800 dark:text-slate-100">{c.nokoen}</span>
                {c.rten && <span className="text-xs text-slate-400"> · {c.rten}</span>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function BuscadorColor({
  carta,
  elegido,
  onElegir,
  onQuitar,
}: {
  carta: ColorCarta[];
  elegido: string | null;
  onElegir: (c: ColorCarta) => void;
  onQuitar: () => void;
}) {
  const [q, setQ] = useState("");
  const color = elegido ? carta.find((c) => c.id === elegido) : null;
  const n = normalizar(q.trim());
  const resultados = n
    ? carta.filter((c) => normalizar(c.codigo).includes(n) || normalizar(c.nombre ?? "").includes(n)).slice(0, 12)
    : [];

  if (color) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 px-3 py-2">
        <span
          className="h-8 w-8 rounded-lg border border-slate-200/70"
          style={color.hex ? { backgroundColor: color.hex } : undefined}
        />
        <div className="min-w-0 flex-1 text-sm">
          <span className="font-bold text-slate-800">{color.codigo}</span>
          {color.nombre && <span className="text-slate-600"> · {color.nombre}</span>}
          <span className="text-xs text-slate-500"> · {nombreCartilla(color.cartilla)}</span>
        </div>
        <button onClick={onQuitar} className="text-emerald-700 hover:text-red-600" aria-label="Quitar el color de la carta">
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className={`${CAMPO} pl-9`}
        placeholder="Búscalo en la Pantonera Digital (código o nombre), o escríbelo abajo"
        data-testid="input-lab-buscar-color"
      />
      {resultados.length > 0 && (
        <div className="absolute z-20 mt-1 w-full max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
          {resultados.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                onElegir(c);
                setQ("");
              }}
              className="w-full px-3 py-2 text-left text-sm hover:bg-orange-50 dark:hover:bg-slate-800 flex items-center gap-2"
            >
              <span className="h-5 w-5 rounded border border-slate-200/70 shrink-0" style={c.hex ? { backgroundColor: c.hex } : undefined} />
              <span className="font-medium text-slate-800 dark:text-slate-100">{c.codigo}</span>
              {c.nombre && <span className="text-slate-500">· {c.nombre}</span>}
              <span className="ml-auto text-xs text-slate-400">{nombreCartilla(c.cartilla)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Detalle, respuesta e hilo ──────────────────────────────────────────────

function DetalleSolicitud({ id, onCerrar }: { id: string | null; onCerrar: () => void }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const { data: s, isLoading } = useQuery<Detalle>({
    queryKey: [`/api/tintometria/solicitudes/${id}`],
    enabled: !!id,
  });
  // Laboratorio carga la fórmula / el precio solo después de apretar "Aprobar".
  const [aprobando, setAprobando] = useState(false);
  useEffect(() => setAprobando(false), [id]);

  // Abrirla la marca como vista para este lado y apaga el número del menú.
  useEffect(() => {
    if (!id) return;
    fetch(`/api/tintometria/solicitudes/${id}/visto`, { method: "POST", credentials: "include" })
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/tintometria/solicitudes/pendientes"] });
        queryClient.invalidateQueries({ queryKey: ["/api/tintometria/solicitudes"] });
      })
      .catch(() => {});
  }, [id, s?.mensajes?.length]);

  const refrescar = () => {
    queryClient.invalidateQueries({ queryKey: [`/api/tintometria/solicitudes/${id}`] });
    queryClient.invalidateQueries({ queryKey: ["/api/tintometria/solicitudes"] });
    queryClient.invalidateQueries({ queryKey: ["/api/tintometria/solicitudes/pendientes"] });
  };

  const cambiarEstado = useMutation({
    mutationFn: async (datos: { estado: string; motivo?: string }) =>
      (await apiRequest(`/api/tintometria/solicitudes/${id}/estado`, { method: "PATCH", data: datos })).json(),
    onSuccess: (_r, datos) => {
      refrescar();
      toast({ title: datos.estado === "rechazada" ? "Solicitud rechazada" : "Marcada en desarrollo" });
    },
    onError: (error: any) => toast({ title: "No se pudo cambiar el estado", description: error?.message, variant: "destructive" }),
  });

  const abierta = s && ABIERTAS.includes(s.estado);
  const estado = s ? ESTADO[s.estado] ?? { texto: s.estado.toUpperCase(), clase: "" } : null;

  return (
    <Dialog open={!!id} onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl">
        {isLoading || !s ? (
          <div className="flex items-center gap-2 py-10 justify-center text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
          </div>
        ) : (
          <>
            <DialogHeader className="text-left">
              <DialogTitle className="flex flex-wrap items-center gap-2">
                <span>
                  #{s.numero} · {s.colorCodigo}
                </span>
                {estado && (
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${estado.clase}`}>{estado.texto}</span>
                )}
              </DialogTitle>
              <DialogDescription>
                {TIPO_TEXTO[s.tipo]} para {s.clienteNombre} · pedida por {s.solicitanteNombre ?? "—"} el {fmtFecha(s.createdAt)}
              </DialogDescription>
            </DialogHeader>

            <div className="flex gap-3">
              {s.color?.hex && <span className="h-16 w-16 shrink-0 rounded-xl" style={{ backgroundColor: s.color.hex }} />}
              <dl className="grid flex-1 grid-cols-2 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-3">
                <Dato titulo="Color" valor={[s.colorCodigo, s.colorNombre].filter(Boolean).join(" · ")} />
                <Dato titulo="Cartilla" valor={s.cartilla ? nombreCartilla(s.cartilla) : null} />
                <Dato titulo="Línea" valor={s.linea} />
                <Dato titulo="Base" valor={s.base} />
                <Dato titulo="Formato" valor={s.formato} />
                <Dato titulo="Cantidad" valor={s.cantidad} />
                <Dato titulo="Ciudad" valor={s.ciudad} />
                <Dato titulo="Obra" valor={s.obra} />
                <Dato titulo="Patrón / lote" valor={[s.patron, s.lote].filter(Boolean).join(" · ") || null} />
              </dl>
            </div>
            {s.observaciones && <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-line">{s.observaciones}</p>}
            {Array.isArray(s.adjuntos) && (s.adjuntos as any[]).length > 0 && (
              <div className="flex flex-wrap gap-2">
                {(s.adjuntos as Array<{ url: string; nombre?: string }>).map((a) => (
                  <a
                    key={a.url}
                    href={a.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-xs text-slate-600 hover:border-orange-200 hover:text-[#fd6301]"
                  >
                    <Paperclip className="h-3.5 w-3.5" /> {a.nombre || "Adjunto"}
                  </a>
                ))}
              </div>
            )}

            {(s.estado === "respondida" || s.estado === "rechazada") && <Respuesta s={s} />}

            {s.puedeResponder && abierta && (
              <div className="flex flex-wrap gap-2">
                {s.estado === "enviada" && (
                  <Button
                    variant="outline"
                    className="rounded-2xl h-9 text-sm"
                    disabled={cambiarEstado.isPending}
                    onClick={() => cambiarEstado.mutate({ estado: "en_desarrollo" })}
                    data-testid="button-lab-en-desarrollo"
                  >
                    Tomarla: en desarrollo
                  </Button>
                )}
                <RechazarBoton onRechazar={(motivo) => cambiarEstado.mutate({ estado: "rechazada", motivo })} />
                {s.estado === "en_desarrollo" && !aprobando && (
                  <Button
                    className="rounded-2xl h-9 text-sm bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => setAprobando(true)}
                    data-testid="button-lab-aprobar"
                  >
                    <Check className="h-4 w-4 mr-1.5" /> Aprobar
                  </Button>
                )}
              </div>
            )}
            {s.puedeResponder && s.estado === "en_desarrollo" && aprobando && (
              <FormularioRespuesta s={s} onRespondida={refrescar} onCancelar={() => setAprobando(false)} />
            )}

            <Hilo s={s} miId={(user as any)?.id} onEnviado={refrescar} />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Dato({ titulo, valor }: { titulo: string; valor: string | null | undefined }) {
  if (!valor) return null;
  return (
    <div className="min-w-0">
      <dt className="text-[10px] uppercase tracking-wider font-bold text-slate-400">{titulo}</dt>
      <dd className="truncate text-slate-800 dark:text-slate-100">{valor}</dd>
    </div>
  );
}

function Respuesta({ s }: { s: Detalle }) {
  if (s.estado === "rechazada") {
    return (
      <div className="flex gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
        <div>
          <div className="font-semibold">Laboratorio la rechazó{s.respondidaPorNombre ? ` (${s.respondidaPorNombre})` : ""}</div>
          {s.respuesta && <div className="whitespace-pre-line">{s.respuesta}</div>}
        </div>
      </div>
    );
  }
  const items = (s.formula?.items as ItemFormula[] | undefined) ?? [];
  const galones = items[0] ? Object.keys(items[0].dosis ?? {})[0] : null;
  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-3 space-y-2 dark:border-emerald-500/30 dark:bg-emerald-500/10">
      <div className="flex items-center gap-2 text-sm font-bold text-emerald-800 dark:text-emerald-300">
        <Check className="h-4 w-4" /> Laboratorio la aprobó
        <span className="font-normal text-emerald-700/80">
          {s.respondidaPorNombre ? `· ${s.respondidaPorNombre} ` : ""}· {fmtFecha(s.respondidaAt, true)}
        </span>
      </div>
      {s.precio != null && (
        <div className="text-sm text-slate-800 dark:text-slate-100">
          Precio: <span className="font-bold tabular-nums">{money(s.precio)}</span>
          {s.precioUnidad ? ` ${s.precioUnidad}` : ""}
        </div>
      )}
      {s.formulaId && !s.formula && (
        <div className="text-sm text-slate-700 dark:text-slate-200">
          La fórmula está lista y quedó en la Pantonera Digital para el operador.
        </div>
      )}
      {s.formula && (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-slate-500">
              <th className="text-left font-bold pb-1">Colorante</th>
              <th className="text-right font-bold pb-1">{galones ? nombreFormato(galones) : "Dosis"}</th>
              <th className="text-right font-bold pb-1">≈ ml</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => {
              const d = galones ? it.dosis?.[galones] : undefined;
              const ml = dosisEnMl(d);
              return (
                <tr key={it.colorante} className="border-t border-emerald-100 dark:border-emerald-500/20">
                  <td className="py-1 font-bold">{it.colorante}</td>
                  <td className="py-1 text-right font-semibold tabular-nums slashed-zero">{d ?? "—"}</td>
                  <td className="py-1 text-right tabular-nums text-slate-500">
                    {ml === null ? "—" : ml.toLocaleString("es-CL", { maximumFractionDigits: 1 })}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {s.respuesta && <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-line">{s.respuesta}</p>}
    </div>
  );
}

function RechazarBoton({ onRechazar }: { onRechazar: (motivo: string) => void }) {
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState("");
  if (!abierto) {
    return (
      <Button variant="outline" className="rounded-2xl h-9 text-sm text-red-600 hover:text-red-700" onClick={() => setAbierto(true)}>
        Rechazar
      </Button>
    );
  }
  return (
    <div className="w-full space-y-2 rounded-xl border border-red-200 p-3">
      <Textarea
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
        placeholder="Por qué se rechaza: es lo que lee el vendedor"
        className="rounded-xl text-sm min-h-[64px]"
        autoFocus
      />
      <div className="flex gap-2 justify-end">
        <Button variant="ghost" className="rounded-2xl h-9" onClick={() => setAbierto(false)}>
          Cancelar
        </Button>
        <Button
          className="rounded-2xl h-9 bg-red-600 hover:bg-red-700 text-white"
          disabled={!motivo.trim()}
          onClick={() => onRechazar(motivo.trim())}
        >
          Rechazar solicitud
        </Button>
      </div>
    </div>
  );
}

/** Galones del formato pedido, si se entiende ("4 galones" → 4, "galón" → 1). Si
 * pidieron varios, vale el primero. */
function galonesDelFormato(formato: string | null | undefined): string {
  const t = String(formato ?? "").split(",")[0].toLowerCase();
  const n = /(\d+(?:[.,]\d+)?)\s*(?:gl|gal)/.exec(t);
  if (n) return n[1].replace(",", ".");
  if (/1\/4/.test(t)) return "0.25";
  if (/gal[oó]n/.test(t)) return "1";
  return "";
}

function FormularioRespuesta({ s, onRespondida, onCancelar }: { s: Detalle; onRespondida: () => void; onCancelar: () => void }) {
  const { toast } = useToast();
  const pideFormula = s.tipo === "formula" || s.tipo === "formula_precio";
  const pidePrecio = s.tipo === "precio" || s.tipo === "formula_precio";
  const [galones, setGalones] = useState(galonesDelFormato(s.formato));
  const [base, setBase] = useState(s.base ?? "");
  const [items, setItems] = useState<{ colorante: string; dosis: string }[]>([{ colorante: "", dosis: "" }]);
  const [precio, setPrecio] = useState("");
  const [unidad, setUnidad] = useState(s.formato ? `por ${s.formato}` : "");
  const [observaciones, setObservaciones] = useState("");

  const responder = useMutation({
    mutationFn: async () =>
      (
        await apiRequest(`/api/tintometria/solicitudes/${s.id}/respuesta`, {
          method: "POST",
          data: {
            galones: pideFormula ? Number(galones.replace(",", ".")) : null,
            base: base || null,
            items: pideFormula ? items.filter((i) => i.colorante.trim() && i.dosis.trim()) : [],
            precio: pidePrecio ? Number(precio.replace(/\D/g, "")) : null,
            precioUnidad: pidePrecio ? unidad || null : null,
            respuesta: observaciones || null,
          },
        })
      ).json(),
    onSuccess: () => {
      onRespondida();
      toast({ title: "Solicitud aprobada", description: "El vendedor recibió la respuesta por correo y en el panel." });
    },
    onError: (error: any) => toast({ title: "No se pudo responder", description: error?.message, variant: "destructive" }),
  });

  const setItem = (i: number, campo: "colorante" | "dosis", v: string) =>
    setItems((l) => l.map((it, j) => (j === i ? { ...it, [campo]: v } : it)));
  const dosisMala = items.some((i) => i.dosis.trim() && !leerDosis(i.dosis));
  const incompleta =
    (pideFormula && (!galones || items.every((i) => !i.colorante.trim() || !i.dosis.trim()))) ||
    (pidePrecio && !precio.replace(/\D/g, ""));

  return (
    <div className="rounded-2xl border border-slate-200/70 dark:border-slate-700/60 p-3 space-y-3">
      <div className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
        <FlaskConical className="h-4 w-4 text-[#fd6301]" /> Aprobar: carga la respuesta
      </div>
      {pideFormula && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className={ETIQUETA}>Fórmula para (galones)</div>
              <Input
                value={galones}
                onChange={(e) => setGalones(e.target.value)}
                inputMode="decimal"
                className={CAMPO}
                placeholder="4"
                data-testid="input-lab-galones"
              />
            </div>
            <div>
              <div className={ETIQUETA}>Base</div>
              <Input value={base} onChange={(e) => setBase(e.target.value)} className={CAMPO} placeholder="Ej.: Base oscura" />
            </div>
          </div>
          <div className="space-y-1.5">
            <div className={ETIQUETA}>Colorantes y dosis (como en el libro: 0Y57, 1Y30-1)</div>
            {items.map((it, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  value={it.colorante}
                  onChange={(e) => setItem(i, "colorante", e.target.value.toUpperCase())}
                  className={`${CAMPO} w-24`}
                  placeholder="KX"
                  data-testid={`input-lab-colorante-${i}`}
                />
                <Input
                  value={it.dosis}
                  onChange={(e) => setItem(i, "dosis", e.target.value)}
                  className={`${CAMPO} flex-1 tabular-nums slashed-zero ${
                    it.dosis.trim() && !leerDosis(it.dosis) ? "border-red-300 focus-visible:border-red-400" : ""
                  }`}
                  placeholder="0Y57"
                  data-testid={`input-lab-dosis-${i}`}
                />
                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setItems((l) => l.filter((_, j) => j !== i))}
                    className="px-2 text-slate-400 hover:text-red-600"
                    aria-label="Quitar colorante"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
            {items.length < 8 && (
              <button
                type="button"
                onClick={() => setItems((l) => [...l, { colorante: "", dosis: "" }])}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#fd6301] hover:text-[#e35400]"
              >
                <Plus className="h-3.5 w-3.5" /> Agregar colorante
              </button>
            )}
            {dosisMala && <p className="text-xs text-red-600">Hay una dosis que no se entiende: se escribe como 0Y57 o 1Y30-1.</p>}
          </div>
        </>
      )}
      {pidePrecio && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className={ETIQUETA}>Precio</div>
            <Input
              value={precio ? `$${Number(precio.replace(/\D/g, "") || 0).toLocaleString("es-CL")}` : ""}
              onChange={(e) => setPrecio(e.target.value.replace(/\D/g, ""))}
              inputMode="numeric"
              className={`${CAMPO} tabular-nums font-semibold`}
              placeholder="$0"
              data-testid="input-lab-precio"
            />
          </div>
          <div>
            <div className={ETIQUETA}>Unidad</div>
            <Input value={unidad} onChange={(e) => setUnidad(e.target.value)} className={CAMPO} placeholder="por galón" />
          </div>
        </div>
      )}
      <div>
        <div className={ETIQUETA}>Observaciones</div>
        <Textarea
          value={observaciones}
          onChange={(e) => setObservaciones(e.target.value)}
          className="rounded-xl text-sm min-h-[64px] bg-slate-50/60"
          placeholder="Ej.: el color húmedo se ve más claro; agitar cada balde más de 5 minutos"
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" className="rounded-2xl h-9" onClick={onCancelar} disabled={responder.isPending}>
          Cancelar
        </Button>
        <Button
          onClick={() => responder.mutate()}
          disabled={incompleta || dosisMala || responder.isPending}
          className={`h-9 ${BOTON_MARCA}`}
          data-testid="button-lab-responder"
        >
          {responder.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
          Aprobar y enviar
        </Button>
      </div>
    </div>
  );
}

function Hilo({ s, miId, onEnviado }: { s: Detalle; miId?: string; onEnviado: () => void }) {
  const { toast } = useToast();
  const [texto, setTexto] = useState("");
  const [adjunto, setAdjunto] = useState<{ url: string; nombre: string } | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const archivoRef = useRef<HTMLInputElement>(null);

  const enviar = useMutation({
    mutationFn: async () =>
      (
        await apiRequest(`/api/tintometria/solicitudes/${s.id}/mensajes`, {
          method: "POST",
          data: { texto, adjuntoUrl: adjunto?.url ?? null, adjuntoNombre: adjunto?.nombre ?? null },
        })
      ).json(),
    onSuccess: () => {
      setTexto("");
      setAdjunto(null);
      onEnviado();
    },
    onError: (error: any) => toast({ title: "No se pudo enviar el mensaje", description: error?.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-2 border-t border-slate-100 dark:border-slate-800 pt-3">
      <div className="text-sm font-bold text-slate-700 dark:text-slate-200">Conversación con laboratorio</div>
      <div className="space-y-2">
        {s.mensajes.map((m) => {
          if (m.evento) {
            return (
              <div key={m.id} className="text-center text-[11px] text-slate-400">
                {m.autorNombre} {EVENTO[m.evento] ?? m.evento} · {fmtFecha(m.createdAt, true)}
              </div>
            );
          }
          const mio = m.autorId === miId;
          return (
            <div key={m.id} className={`flex ${mio ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                  mio
                    ? "bg-[#fd6301] text-white rounded-br-md"
                    : "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100 rounded-bl-md"
                }`}
              >
                {!mio && (
                  <div className="text-[11px] font-semibold opacity-70">
                    {m.autorNombre} · {m.lado === "laboratorio" ? "Laboratorio" : "Solicitante"}
                  </div>
                )}
                {m.texto && <div className="whitespace-pre-line">{m.texto}</div>}
                {m.adjuntoUrl && (
                  <a href={m.adjuntoUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs underline">
                    <Paperclip className="h-3 w-3" /> {m.adjuntoNombre || "Adjunto"}
                  </a>
                )}
                <div className={`mt-0.5 text-[10px] ${mio ? "text-white/70" : "text-slate-400"}`}>{fmtFecha(m.createdAt, true)}</div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex items-end gap-2">
        <input
          ref={archivoRef}
          type="file"
          className="hidden"
          accept=".jpg,.jpeg,.png,.webp,.pdf,.heic,.xlsx,.xls"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            setSubiendo(true);
            try {
              setAdjunto(await subirArchivo(f));
            } catch (error: any) {
              toast({ title: "No se pudo adjuntar", description: error?.message, variant: "destructive" });
            } finally {
              setSubiendo(false);
              if (archivoRef.current) archivoRef.current.value = "";
            }
          }}
        />
        <button
          type="button"
          onClick={() => archivoRef.current?.click()}
          disabled={subiendo}
          className="h-10 w-10 shrink-0 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 hover:text-[#fd6301] hover:border-orange-200"
          aria-label="Adjuntar archivo"
        >
          {subiendo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
        </button>
        <div className="flex-1 space-y-1">
          {adjunto && (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2 py-0.5 text-xs text-emerald-800">
              <Paperclip className="h-3 w-3" /> {adjunto.nombre}
              <button onClick={() => setAdjunto(null)} aria-label="Quitar adjunto">
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          <Textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Escribe un mensaje"
            className="rounded-xl text-sm min-h-[40px] max-h-32 bg-slate-50/60"
            rows={1}
            data-testid="input-lab-mensaje"
          />
        </div>
        <Button
          onClick={() => enviar.mutate()}
          disabled={(!texto.trim() && !adjunto) || enviar.isPending}
          className={`h-10 w-10 p-0 shrink-0 ${BOTON_MARCA}`}
          aria-label="Enviar mensaje"
          data-testid="button-lab-enviar-mensaje"
        >
          {enviar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
