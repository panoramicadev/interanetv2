/**
 * Solicitud de Muestra: el vendedor pide una muestra de producto, de un color o
 * material de exhibición para un cliente que ya existe.
 *
 * El supervisor de quien la pide la aprueba o la rechaza. Aprobada queda "en
 * curso": Franco (Administración) crea la NVV y la registra acá, laboratorio y
 * logística la preparan, y todos conversan en el hilo de la solicitud. Franco la
 * cierra cuando la muestra se entregó.
 *
 * Mismo esqueleto que Solicitudes a laboratorio (tintometria-solicitudes.tsx):
 * pestañas Nueva / En curso / Cerradas y el detalle en un diálogo con el hilo.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertTriangle, Check, Loader2, PaintBucket, Paperclip, Plus, Send, Trash2, X } from "lucide-react";
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
import type { ItemSolicitudMuestra, SolicitudMuestra, SolicitudMuestraMensaje } from "@shared/schema";

type Tipo = "producto" | "color" | "material";

interface FilaLista extends SolicitudMuestra {
  mensajes: number;
  puedeAprobar: boolean;
}

interface Detalle extends SolicitudMuestra {
  mensajes: SolicitudMuestraMensaje[];
  puedeAprobar: boolean;
  puedeGestionar: boolean;
}

const TIPOS: { valor: Tipo; texto: string }[] = [
  { valor: "producto", texto: "Producto de Línea" },
  { valor: "color", texto: "Desarrollo" },
  { valor: "material", texto: "Material de exhibición" },
];
// Los valores guardados siguen siendo producto / color: solo cambió cómo se llaman (oct-2026).
const TIPO_TEXTO: Record<string, string> = { producto: "Producto de Línea", color: "Desarrollo", material: "Material de exhibición" };

/** Material de exhibición va a una sucursal; producto y color, a una obra o a una sucursal. */
const lugarDe = (tipo: string) => (tipo === "material" ? "Sucursal" : "Obra / Sucursal");

const ESTADO: Record<string, { texto: string; clase: string }> = {
  pendiente: { texto: "POR APROBAR", clase: "bg-amber-100 text-amber-800 border-amber-200" },
  en_curso: { texto: "EN CURSO", clase: "bg-sky-100 text-sky-800 border-sky-200" },
  cerrada: { texto: "ENTREGADA", clase: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  rechazada: { texto: "RECHAZADA", clase: "bg-red-100 text-red-700 border-red-200" },
};
const ABIERTAS = ["pendiente", "en_curso"];

const EVENTO: Record<string, string> = {
  creada: "envió la solicitud",
  aprobada: "la aprobó: queda en curso",
  rechazada: "la rechazó",
  nvv: "registró la NVV",
  cerrada: "la cerró: muestra entregada",
};

const fmtFecha = (v: string | Date | null | undefined, conHora = false) => {
  if (!v) return "—";
  const d = new Date(v as any);
  if (Number.isNaN(d.getTime())) return "—";
  return conHora
    ? d.toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" })
    : d.toLocaleDateString("es-CL");
};
const itemsDe = (s: SolicitudMuestra): ItemSolicitudMuestra[] =>
  Array.isArray(s.items) ? (s.items as ItemSolicitudMuestra[]) : [];

const CAMPO = "h-10 rounded-xl text-sm bg-slate-50/60 focus-visible:border-[#fd6301] focus-visible:ring-orange-500/20";
const ETIQUETA = "text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1";
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

export default function SolicitudMuestraPage() {
  const { can } = usePermissions();
  const puedeSolicitar = can("solicitud_muestra");
  const veTodas = can("solicitud_muestra.gestion") || can("solicitud_muestra.bandeja");
  const busqueda = useSearch();
  const [, navegar] = useLocation();
  const params = useMemo(() => new URLSearchParams(busqueda), [busqueda]);
  const [tab, setTab] = useState(params.get("id") || veTodas || !puedeSolicitar ? "curso" : "nueva");
  const [abierta, setAbierta] = useState<string | null>(params.get("id"));

  // Un enlace de correo (?id=…) abre la solicitud directo.
  useEffect(() => {
    const id = params.get("id");
    if (id) setAbierta(id);
  }, [params]);

  const { data: solicitudes = [], isLoading } = useQuery<FilaLista[]>({
    queryKey: ["/api/solicitudes-muestra"],
    refetchInterval: 60000,
  });
  const enCurso = solicitudes.filter((s) => ABIERTAS.includes(s.estado));
  const cerradas = solicitudes.filter((s) => !ABIERTAS.includes(s.estado));

  const cerrarDetalle = () => {
    setAbierta(null);
    if (params.get("id")) navegar("/solicitud-muestra", { replace: true });
  };

  return (
    <div className="p-3 sm:p-5 space-y-4 max-w-5xl mx-auto">
      <div className="flex items-start gap-3">
        <div className={ICONO_CHIP}>
          <PaintBucket className={ICONO_CHIP_ICONO} />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Solicitud de Muestra</h1>
          <p className="hidden sm:block text-sm text-slate-500 dark:text-slate-400">
            Pide una muestra para un cliente: tu supervisor la aprueba, Administración crea la NVV y la cierra cuando se entregó.
          </p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className={TABS_LIST_PILL}>
          {puedeSolicitar && (
            <TabsTrigger value="nueva" className={TAB_PILL} data-testid="tab-muestra-nueva">
              Nueva solicitud
            </TabsTrigger>
          )}
          <TabsTrigger value="curso" className={TAB_PILL} data-testid="tab-muestra-curso">
            En curso
            {enCurso.length > 0 && <span className="tabular-nums opacity-70">{enCurso.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="cerradas" className={TAB_PILL} data-testid="tab-muestra-cerradas">
            Cerradas
          </TabsTrigger>
        </TabsList>

        {puedeSolicitar && (
          <TabsContent value="nueva" className="mt-4">
            <NuevaSolicitud
              onEnviada={(id) => {
                setTab("curso");
                setAbierta(id);
              }}
            />
          </TabsContent>
        )}
        <TabsContent value="curso" className="mt-4">
          <Lista filas={enCurso} cargando={isLoading} vacio="No hay muestras en curso." onAbrir={setAbierta} />
        </TabsContent>
        <TabsContent value="cerradas" className="mt-4">
          <Lista filas={cerradas} cargando={isLoading} vacio="Todavía no hay muestras cerradas." onAbrir={setAbierta} />
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
        const items = itemsDe(s);
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onAbrir(s.id)}
            className="w-full text-left rounded-2xl border border-slate-200/70 dark:border-slate-700/60 bg-white dark:bg-slate-900/40 p-3 shadow-sm hover:border-orange-200 hover:shadow transition-all flex items-center gap-3"
            data-testid={`solicitud-muestra-${s.numero}`}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2 min-w-0">
                <span className="text-xs text-slate-400 tabular-nums">#{s.numero}</span>
                <span className="truncate text-sm font-bold text-slate-800 dark:text-slate-100">{s.clienteNombre}</span>
                {s.puedeAprobar && <span className="h-2 w-2 shrink-0 rounded-full bg-[#fd6301]" title="Espera tu aprobación" />}
              </div>
              <div className="truncate text-xs text-slate-500">
                {TIPO_TEXTO[s.tipo] ?? s.tipo} · {items.map((i) => `${i.producto} (${i.formato})`).join(", ") || "—"}
              </div>
              <div className="truncate text-[11px] text-slate-400">
                {s.solicitanteNombre ?? "—"} · {fmtFecha(s.createdAt)}
                {s.nvvNumero ? ` · NVV ${s.nvvNumero}` : ""}
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

// En Producto de Línea el producto se elige de la lista de precios: `sku` y `formato`
// (su unidad) vienen de ahí y no se escriben.
const ITEM_VACIO = { producto: "", sku: "", color: "", formato: "" };
// Los formatos que se pueden pedir, los mismos de Solicitudes a laboratorio. Se
// guardan juntos, en este orden: "Galón, Balde 4 gl". Material de exhibición no
// va en envase: ahí se escribe la cantidad.
const FORMATOS = ["1/4 de Galón", "Galón", "Balde 4 gl", "Balde 5 gl"] as const;
const FORM_VACIO = {
  tipo: "producto" as Tipo,
  clienteId: null as string | null,
  clienteNombre: "",
  clienteRut: "",
  obra: "",
  motivo: "",
};

const PISTAS: Record<Tipo, { producto: string; color: string }> = {
  producto: { producto: "Ej.: Látex Profesional", color: "Ej.: Blanco" },
  color: { producto: "Ej.: Esmalte al agua", color: "Ej.: SW 7019 Gauntlet Gray" },
  material: { producto: "Ej.: Cartilla de colores", color: "" },
};

function NuevaSolicitud({ onEnviada }: { onEnviada: (id: string) => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState(FORM_VACIO);
  const [items, setItems] = useState([{ ...ITEM_VACIO }]);
  const set = <K extends keyof typeof FORM_VACIO>(k: K, v: (typeof FORM_VACIO)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const setItem = (i: number, campo: keyof typeof ITEM_VACIO, v: string) =>
    setItems((l) => l.map((it, j) => (j === i ? { ...it, [campo]: v } : it)));

  const enviar = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("/api/solicitudes-muestra", {
        method: "POST",
        data: {
          ...form,
          clienteRut: form.clienteRut || null,
          obra: form.obra || null,
          motivo: form.motivo || null,
          items: items
            .filter((i) => i.producto.trim() || i.formato.trim())
            .map((i) => ({
              producto: i.producto,
              sku: form.tipo === "producto" ? i.sku || null : null,
              color: form.tipo === "color" ? i.color || null : null,
              formato: i.formato,
            })),
        },
      });
      return res.json();
    },
    onSuccess: (nueva: SolicitudMuestra) => {
      setForm(FORM_VACIO);
      setItems([{ ...ITEM_VACIO }]);
      queryClient.invalidateQueries({ queryKey: ["/api/solicitudes-muestra"] });
      toast({ title: `Muestra #${nueva.numero} enviada`, description: "Tu supervisor la recibió por correo para aprobarla." });
      onEnviada(nueva.id);
    },
    onError: (error: any) => toast({ title: "No se pudo enviar", description: error?.message, variant: "destructive" }),
  });

  const lineasListas = items.filter((i) => i.producto.trim() && i.formato.trim());
  const lineaAMedias = items.some((i) => (i.producto.trim() || i.formato.trim()) && !(i.producto.trim() && i.formato.trim()));
  const faltan = !form.clienteId || lineasListas.length === 0 || lineaAMedias;
  const pista = PISTAS[form.tipo];

  return (
    <div className="space-y-3">
      <Bloque numero={1} titulo="Qué muestra necesitas">
        <div className="flex flex-wrap gap-1.5">
          {TIPOS.map((t) => (
            <button
              key={t.valor}
              type="button"
              onClick={() => {
                // Producto de Línea se elige del catálogo y los otros se escriben: lo de uno no sirve en el otro.
                if ((form.tipo === "producto") !== (t.valor === "producto")) {
                  setItems([{ ...ITEM_VACIO }]);
                } else if ((form.tipo === "material") !== (t.valor === "material")) {
                  // Entre envase y cantidad tampoco: "Galón" no es una cantidad de cartillas.
                  setItems((l) => l.map((it) => ({ ...it, formato: "" })));
                }
                set("tipo", t.valor);
              }}
              aria-pressed={form.tipo === t.valor}
              className={`h-9 px-4 rounded-xl text-xs font-bold border transition-all ${
                form.tipo === t.valor
                  ? "bg-[#fd6301] text-white border-[#fd6301] shadow-sm shadow-[#fd6301]/25"
                  : "bg-white dark:bg-slate-900/40 text-slate-600 dark:text-slate-300 border-slate-200/70 dark:border-slate-700/60 hover:border-[#fd6301]/50 hover:text-[#fd6301]"
              }`}
              data-testid={`chip-muestra-tipo-${t.valor}`}
            >
              {t.texto}
            </button>
          ))}
        </div>
      </Bloque>

      <Bloque numero={2} titulo="Cliente">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <BuscadorCliente
            elegido={form.clienteId ? { nombre: form.clienteNombre, rut: form.clienteRut } : null}
            onElegir={(c) => setForm((f) => ({ ...f, clienteId: c.id, clienteNombre: c.nokoen, clienteRut: c.rten ?? "" }))}
            onQuitar={() => setForm((f) => ({ ...f, clienteId: null, clienteNombre: "", clienteRut: "" }))}
          />
          <div>
            {/* Se guarda en `obra` en los tres tipos; solo cambia cómo se llama (ver `lugarDe`). */}
            <div className={ETIQUETA}>{lugarDe(form.tipo)}</div>
            <Input
              value={form.obra}
              onChange={(e) => set("obra", e.target.value)}
              className={CAMPO}
              placeholder={form.tipo === "material" ? "Si es para una sucursal, cuál" : "Si es para una obra o sucursal, cuál"}
            />
          </div>
        </div>
      </Bloque>

      <Bloque numero={3} titulo="Productos">
        <div className="space-y-2">
          {items.map((it, i) => {
            const elegidos = it.formato ? it.formato.split(", ") : [];
            const quitar = () => setItems((l) => (l.length > 1 ? l.filter((_, j) => j !== i) : [{ ...ITEM_VACIO }]));
            if (form.tipo === "producto") {
              return (
                <div key={i} className={`flex items-end gap-2 ${i > 0 ? "border-t border-slate-100 dark:border-slate-800 pt-3" : ""}`}>
                  <BuscadorProducto
                    elegido={it.sku ? { codigo: it.sku, producto: it.producto, unidad: it.formato } : null}
                    indice={i}
                    onElegir={(p) =>
                      setItems((l) =>
                        l.map((x, j) => (j === i ? { ...x, producto: p.producto, sku: p.codigo, formato: p.unidad || "—", color: "" } : x)),
                      )
                    }
                    onQuitar={() => setItems((l) => l.map((x, j) => (j === i ? { ...ITEM_VACIO } : x)))}
                  />
                  <button type="button" onClick={quitar} className="h-10 px-2 text-slate-400 hover:text-red-600" aria-label="Quitar línea">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            }
            return (
              <div key={i} className={`space-y-2 ${i > 0 ? "border-t border-slate-100 dark:border-slate-800 pt-3" : ""}`}>
                <div className="grid grid-cols-[1fr_auto] sm:grid-cols-[3fr_2fr_auto] gap-2 items-end">
                  {/* Sin color (material), el basurero va al lado del producto y no solo en otra línea. */}
                  <div className={form.tipo === "material" ? "" : "col-span-2 sm:col-span-1"}>
                    <div className={ETIQUETA}>
                      Producto <span className="text-[#fd6301]">obligatorio</span>
                    </div>
                    <Input
                      value={it.producto}
                      onChange={(e) => setItem(i, "producto", e.target.value)}
                      className={CAMPO}
                      placeholder={pista.producto}
                      data-testid={`input-muestra-producto-${i}`}
                    />
                  </div>
                  {form.tipo !== "material" ? (
                    <div>
                      <div className={ETIQUETA}>Color</div>
                      <Input value={it.color} onChange={(e) => setItem(i, "color", e.target.value)} className={CAMPO} placeholder={pista.color} />
                    </div>
                  ) : (
                    <div className="hidden sm:block" />
                  )}
                  <button
                    type="button"
                    onClick={() => setItems((l) => (l.length > 1 ? l.filter((_, j) => j !== i) : [{ ...ITEM_VACIO }]))}
                    className="h-10 px-2 text-slate-400 hover:text-red-600"
                    aria-label="Quitar línea"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                {form.tipo === "material" ? (
                  <div className="sm:max-w-[240px]">
                    <div className={ETIQUETA}>
                      Cantidad <span className="text-[#fd6301]">obligatorio</span>
                    </div>
                    <Input
                      value={it.formato}
                      onChange={(e) => setItem(i, "formato", e.target.value)}
                      className={CAMPO}
                      placeholder="Ej.: 20 unidades"
                      data-testid={`input-muestra-cantidad-${i}`}
                    />
                  </div>
                ) : (
                  <div>
                    <div className={ETIQUETA}>
                      Formato <span className="text-[#fd6301]">obligatorio</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {FORMATOS.map((f) => {
                        const activo = elegidos.includes(f);
                        return (
                          <button
                            key={f}
                            type="button"
                            aria-pressed={activo}
                            onClick={() =>
                              setItem(i, "formato", FORMATOS.filter((x) => (x === f ? !activo : elegidos.includes(x))).join(", "))
                            }
                            className={`h-10 px-3 rounded-xl border text-sm transition-colors ${
                              activo
                                ? "border-[#fd6301] bg-[#fd6301] text-white font-semibold"
                                : "border-slate-200 bg-slate-50/60 text-slate-600 hover:border-[#fd6301]/50 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-300"
                            }`}
                            data-testid={`chip-muestra-formato-${i}-${f}`}
                          >
                            {f}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {items.length < 15 && (
            <button
              type="button"
              onClick={() => setItems((l) => [...l, { ...ITEM_VACIO }])}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#fd6301] hover:text-[#e35400]"
            >
              <Plus className="h-3.5 w-3.5" /> Agregar otro producto
            </button>
          )}
        </div>
        <div>
          <div className={ETIQUETA}>Motivo / comentario</div>
          <Textarea
            value={form.motivo}
            onChange={(e) => set("motivo", e.target.value)}
            className="rounded-xl text-sm bg-slate-50/60 min-h-[72px]"
            placeholder="Para qué es: prueba en obra, licitación, reclamo, exhibición…"
          />
        </div>
      </Bloque>

      <div className="flex justify-end">
        <Button
          onClick={() => enviar.mutate()}
          disabled={faltan || enviar.isPending}
          className={`h-10 ${BOTON_MARCA}`}
          data-testid="button-enviar-solicitud-muestra"
        >
          {enviar.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
          Enviar a aprobación
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

interface ProductoLista {
  codigo: string;
  producto: string;
  unidad: string | null;
}

/** Producto de Línea: se busca en la lista de precios (código o nombre) y se elige de ahí. */
function BuscadorProducto({
  elegido,
  indice,
  onElegir,
  onQuitar,
}: {
  elegido: { codigo: string; producto: string; unidad: string } | null;
  indice: number;
  onElegir: (p: ProductoLista) => void;
  onQuitar: () => void;
}) {
  const [valor, setValor] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [termino, setTermino] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setTermino(valor.trim()), 300);
    return () => clearTimeout(t);
  }, [valor]);
  const { data, isFetching } = useQuery<{ items: ProductoLista[] }>({
    queryKey: [`/api/price-list?search=${encodeURIComponent(termino)}&limit=20`],
    enabled: abierto && termino.length >= 2,
  });
  const resultados = data?.items ?? [];
  const etiqueta = (
    <div className={ETIQUETA}>
      Producto <span className="text-[#fd6301]">obligatorio</span>
    </div>
  );

  if (elegido) {
    return (
      <div className="min-w-0 flex-1">
        {etiqueta}
        <div className="flex items-center gap-2 min-h-10 rounded-xl border border-emerald-200 bg-emerald-50/60 px-3 py-1.5 dark:border-emerald-500/30 dark:bg-emerald-500/10">
          <Check className="h-4 w-4 text-emerald-600 shrink-0" />
          <div className="min-w-0 flex-1 text-sm">
            <div className="font-semibold text-slate-800 dark:text-slate-100 leading-tight">{elegido.producto}</div>
            <div className="text-xs text-slate-500">
              {elegido.codigo}
              {elegido.unidad && elegido.unidad !== "—" ? ` · ${elegido.unidad}` : ""}
            </div>
          </div>
          <button onClick={onQuitar} className="text-emerald-700 hover:text-red-600" aria-label="Cambiar producto">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }
  const sinResultados = abierto && termino.length >= 2 && !isFetching && resultados.length === 0;
  return (
    <div className="relative min-w-0 flex-1">
      {etiqueta}
      <Input
        value={valor}
        onChange={(e) => {
          setValor(e.target.value);
          setAbierto(true);
        }}
        onFocus={() => setAbierto(true)}
        onBlur={() => setTimeout(() => setAbierto(false), 150)}
        className={CAMPO}
        placeholder="Búscalo por nombre o código"
        data-testid={`input-muestra-producto-${indice}`}
      />
      {abierto && termino.length >= 2 && (resultados.length > 0 || isFetching || sinResultados) && (
        <div className="absolute z-20 mt-1 w-full max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
          {isFetching && resultados.length === 0 ? (
            <div className="p-3 text-xs text-slate-400">Buscando…</div>
          ) : sinResultados ? (
            <div className="p-3 text-xs text-slate-500">No hay productos con ese nombre o código en la lista de precios.</div>
          ) : (
            resultados.map((p) => (
              <button
                key={p.codigo}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onElegir(p);
                  setValor("");
                  setAbierto(false);
                }}
                className="w-full px-3 py-2 text-left text-sm hover:bg-orange-50 dark:hover:bg-slate-800"
              >
                <div className="font-medium text-slate-800 dark:text-slate-100">{p.producto}</div>
                <div className="text-xs text-slate-400">
                  {p.codigo}
                  {p.unidad ? ` · ${p.unidad}` : ""}
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/** Solo clientes que ya existen: hay que elegirlo de la lista, no se escribe a mano. */
function BuscadorCliente({
  elegido,
  onElegir,
  onQuitar,
}: {
  elegido: { nombre: string; rut: string } | null;
  onElegir: (c: { id: string; nokoen: string; rten?: string | null }) => void;
  onQuitar: () => void;
}) {
  const [valor, setValor] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [termino, setTermino] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setTermino(valor.trim()), 300);
    return () => clearTimeout(t);
  }, [valor]);
  const { data: resultados = [], isFetching } = useQuery<Array<{ id: string; nokoen: string; rten?: string | null }>>({
    queryKey: [`/api/clients/search?q=${encodeURIComponent(termino)}`],
    enabled: abierto && termino.length >= 2,
  });

  if (elegido) {
    return (
      <div>
        <div className={ETIQUETA}>
          Cliente <span className="text-[#fd6301]">obligatorio</span>
        </div>
        <div className="flex items-center gap-2 h-10 rounded-xl border border-emerald-200 bg-emerald-50/60 px-3 dark:border-emerald-500/30 dark:bg-emerald-500/10">
          <Check className="h-4 w-4 text-emerald-600 shrink-0" />
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
            {elegido.nombre}
            {elegido.rut && <span className="font-normal text-slate-500"> · {elegido.rut}</span>}
          </span>
          <button onClick={onQuitar} className="text-emerald-700 hover:text-red-600" aria-label="Cambiar cliente">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }
  const sinResultados = abierto && termino.length >= 2 && !isFetching && resultados.length === 0;
  return (
    <div className="relative">
      <div className={ETIQUETA}>
        Cliente <span className="text-[#fd6301]">obligatorio</span>
      </div>
      <Input
        value={valor}
        onChange={(e) => {
          setValor(e.target.value);
          setAbierto(true);
        }}
        onFocus={() => setAbierto(true)}
        onBlur={() => setTimeout(() => setAbierto(false), 150)}
        className={CAMPO}
        placeholder="Búscalo por nombre o RUT"
        data-testid="input-muestra-cliente"
      />
      {abierto && termino.length >= 2 && (resultados.length > 0 || isFetching || sinResultados) && (
        <div className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
          {isFetching && resultados.length === 0 ? (
            <div className="p-3 text-xs text-slate-400">Buscando…</div>
          ) : sinResultados ? (
            <div className="p-3 text-xs text-slate-500">
              No está en el maestro de clientes. Si es nuevo, primero pide su alta en Nuevo Cliente.
            </div>
          ) : (
            resultados.slice(0, 20).map((c) => (
              <button
                key={c.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onElegir(c);
                  setValor("");
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

// ── Detalle, acciones e hilo ───────────────────────────────────────────────

function DetalleSolicitud({ id, onCerrar }: { id: string | null; onCerrar: () => void }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const { data: s, isLoading } = useQuery<Detalle>({
    queryKey: [`/api/solicitudes-muestra/${id}`],
    enabled: !!id,
  });

  const refrescar = () => {
    queryClient.invalidateQueries({ queryKey: [`/api/solicitudes-muestra/${id}`] });
    queryClient.invalidateQueries({ queryKey: ["/api/solicitudes-muestra"] });
  };

  const accion = useMutation({
    mutationFn: async ({ ruta, datos }: { ruta: string; datos: Record<string, unknown>; ok: string }) =>
      (await apiRequest(`/api/solicitudes-muestra/${id}/${ruta}`, { method: "POST", data: datos })).json(),
    onSuccess: (_r, v) => {
      refrescar();
      toast({ title: v.ok });
    },
    onError: (error: any) => toast({ title: "No se pudo guardar", description: error?.message, variant: "destructive" }),
  });

  const estado = s ? ESTADO[s.estado] ?? { texto: s.estado.toUpperCase(), clase: "" } : null;
  const abierta = s && ABIERTAS.includes(s.estado);

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
                  #{s.numero} · {s.clienteNombre}
                </span>
                {estado && (
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${estado.clase}`}>{estado.texto}</span>
                )}
              </DialogTitle>
              <DialogDescription>
                Muestra de {(TIPO_TEXTO[s.tipo] ?? s.tipo).toLowerCase()} · pedida por {s.solicitanteNombre ?? "—"} el{" "}
                {fmtFecha(s.createdAt)}
              </DialogDescription>
            </DialogHeader>

            <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-3">
              <Dato titulo="RUT" valor={s.clienteRut} />
              <Dato titulo={lugarDe(s.tipo)} valor={s.obra} />
              <Dato titulo="Aprobada por" valor={s.estado !== "rechazada" ? s.aprobadaPorNombre : null} />
              <Dato titulo="NVV" valor={s.nvvNumero} />
              <Dato titulo="Entregada" valor={s.cerradaAt ? fmtFecha(s.cerradaAt) : null} />
            </dl>

            <div className="rounded-2xl border border-slate-200/70 dark:border-slate-700/60 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/50">
                  <tr className="text-[10px] uppercase tracking-wider text-slate-500">
                    <th className="text-left font-bold px-3 py-1.5">Producto</th>
                    <th className="text-left font-bold px-3 py-1.5">Color</th>
                    <th className="text-right font-bold px-3 py-1.5">{s.tipo === "material" ? "Cantidad" : "Formato"}</th>
                  </tr>
                </thead>
                <tbody>
                  {itemsDe(s).map((it, i) => (
                    <tr key={i} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="px-3 py-1.5 text-slate-800 dark:text-slate-100">
                        {it.producto}
                        {it.sku && <div className="text-xs text-slate-400">{it.sku}</div>}
                      </td>
                      <td className="px-3 py-1.5 text-slate-600 dark:text-slate-300">{it.color || "—"}</td>
                      <td className="px-3 py-1.5 text-right font-semibold text-slate-800 dark:text-slate-100">{it.formato}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {s.motivo && <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-line">{s.motivo}</p>}

            {s.estado === "rechazada" && (
              <div className="flex gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold">Rechazada{s.aprobadaPorNombre ? ` por ${s.aprobadaPorNombre}` : ""}</div>
                  {s.motivoRechazo && <div className="whitespace-pre-line">{s.motivoRechazo}</div>}
                </div>
              </div>
            )}

            {s.puedeAprobar && (
              <Aprobacion
                ocupado={accion.isPending}
                onAprobar={(motivo) => accion.mutate({ ruta: "aprobacion", datos: { aprobar: true, motivo }, ok: "Muestra aprobada" })}
                onRechazar={(motivo) =>
                  accion.mutate({ ruta: "aprobacion", datos: { aprobar: false, motivo }, ok: "Muestra rechazada" })
                }
              />
            )}

            {s.puedeGestionar && (
              <Gestion
                s={s}
                ocupado={accion.isPending}
                onNvv={(nvv) => accion.mutate({ ruta: "nvv", datos: { nvv }, ok: "NVV registrada" })}
                onCerrar={(comentario) => accion.mutate({ ruta: "cerrar", datos: { comentario }, ok: "Muestra cerrada" })}
              />
            )}

            <Hilo s={s} miId={(user as any)?.id} abierta={!!abierta} onEnviado={refrescar} />
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

function Aprobacion({
  ocupado,
  onAprobar,
  onRechazar,
}: {
  ocupado: boolean;
  onAprobar: (comentario: string) => void;
  onRechazar: (motivo: string) => void;
}) {
  const [texto, setTexto] = useState("");
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-3 space-y-2 dark:border-amber-500/30 dark:bg-amber-500/10">
      <div className="text-sm font-bold text-slate-700 dark:text-slate-200">Espera tu aprobación</div>
      <Textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Comentario (si la rechazas, el motivo es obligatorio: es lo que lee quien la pidió)"
        className="rounded-xl text-sm min-h-[56px] bg-white dark:bg-slate-900/40"
      />
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          variant="outline"
          className="rounded-2xl h-9 text-sm text-red-600 hover:text-red-700"
          disabled={ocupado || !texto.trim()}
          onClick={() => onRechazar(texto.trim())}
          data-testid="button-muestra-rechazar"
        >
          Rechazar
        </Button>
        <Button
          className="rounded-2xl h-9 text-sm bg-emerald-600 hover:bg-emerald-700 text-white"
          disabled={ocupado}
          onClick={() => onAprobar(texto.trim())}
          data-testid="button-muestra-aprobar"
        >
          <Check className="h-4 w-4 mr-1.5" /> Aprobar
        </Button>
      </div>
    </div>
  );
}

function Gestion({
  s,
  ocupado,
  onNvv,
  onCerrar,
}: {
  s: Detalle;
  ocupado: boolean;
  onNvv: (nvv: string) => void;
  onCerrar: (comentario: string) => void;
}) {
  const [nvv, setNvv] = useState(s.nvvNumero ?? "");
  const [comentario, setComentario] = useState("");
  useEffect(() => setNvv(s.nvvNumero ?? ""), [s.nvvNumero]);
  return (
    <div className="rounded-2xl border border-slate-200/70 dark:border-slate-700/60 p-3 space-y-3">
      <div className="text-sm font-bold text-slate-700 dark:text-slate-200">Administración</div>
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <div className={ETIQUETA}>Número de NVV</div>
          <Input value={nvv} onChange={(e) => setNvv(e.target.value)} className={CAMPO} placeholder="Ej.: 0000123456" data-testid="input-muestra-nvv" />
        </div>
        <Button
          variant="outline"
          className="rounded-2xl h-10 text-sm"
          disabled={ocupado || !nvv.trim() || nvv.trim() === (s.nvvNumero ?? "")}
          onClick={() => onNvv(nvv.trim())}
          data-testid="button-muestra-guardar-nvv"
        >
          {s.nvvNumero ? "Cambiar NVV" : "Registrar NVV"}
        </Button>
      </div>
      <div>
        <div className={ETIQUETA}>Comentario de cierre</div>
        <Textarea
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
          className="rounded-xl text-sm min-h-[56px] bg-slate-50/60"
          placeholder="Opcional: cómo y cuándo se entregó"
        />
      </div>
      <div className="flex items-center justify-end gap-3">
        {!s.nvvNumero && <span className="text-xs text-slate-500">Registra la NVV para poder cerrarla.</span>}
        <Button
          className={`h-9 ${BOTON_MARCA}`}
          disabled={ocupado || !s.nvvNumero}
          onClick={() => onCerrar(comentario.trim())}
          data-testid="button-muestra-cerrar"
        >
          <Check className="h-4 w-4 mr-1.5" /> Muestra entregada: cerrar
        </Button>
      </div>
    </div>
  );
}

function Hilo({ s, miId, abierta, onEnviado }: { s: Detalle; miId?: string; abierta: boolean; onEnviado: () => void }) {
  const { toast } = useToast();
  const [texto, setTexto] = useState("");
  const [adjunto, setAdjunto] = useState<{ url: string; nombre: string } | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const archivoRef = useRef<HTMLInputElement>(null);

  const enviar = useMutation({
    mutationFn: async () =>
      (
        await apiRequest(`/api/solicitudes-muestra/${s.id}/mensajes`, {
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
      <div className="text-sm font-bold text-slate-700 dark:text-slate-200">Conversación</div>
      <div className="space-y-2">
        {s.mensajes.map((m) => {
          if (m.evento) {
            return (
              <div key={m.id} className="text-center text-[11px] text-slate-400">
                {m.autorNombre} {EVENTO[m.evento] ?? m.evento}
                {m.texto ? `: ${m.texto}` : ""} · {fmtFecha(m.createdAt, true)}
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
                    {m.autorNombre}
                    {m.autorRol ? ` · ${m.autorRol}` : ""}
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
      {abierta ? (
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
              data-testid="input-muestra-mensaje"
            />
          </div>
          <Button
            onClick={() => enviar.mutate()}
            disabled={(!texto.trim() && !adjunto) || enviar.isPending}
            className={`h-10 w-10 p-0 shrink-0 ${BOTON_MARCA}`}
            aria-label="Enviar mensaje"
            data-testid="button-muestra-enviar-mensaje"
          >
            {enviar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      ) : (
        <p className="text-xs text-slate-400">La solicitud está cerrada: ya no se puede escribir.</p>
      )}
    </div>
  );
}
