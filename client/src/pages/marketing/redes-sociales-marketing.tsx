import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  CalendarDays,
  FileText,
  Gift,
  Images,
  Loader2,
  Paperclip,
  Pencil,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";

// ==================================================================================
// Redes Sociales (Marketing)
//
// Tres cosas que antes vivían en carpetas sueltas y grupos de WhatsApp:
//   • Guiones Reel — el guión escrito y su documento adjunto.
//   • Carruseles   — la pieza publicada, con sus imágenes guardadas.
//   • Concursos    — normalmente uno por mes, con mecánica, premio y ganador.
//
// Las tres comparten la misma mecánica (listar por mes/año, crear, editar y
// adjuntar archivos), así que la ficha, el diálogo y los adjuntos se arman con
// los mismos componentes y solo cambian los campos propios de cada una.
// ==================================================================================

type Archivo = { url: string; nombre: string; tipo?: string; subidoEn?: string };

interface ItemRedes {
  id: string;
  titulo: string;
  descripcion: string | null;
  plataforma: string;
  estado: string;
  archivos: Archivo[] | null;
  mes: number;
  anio: number;
  createdAt: string;
  [key: string]: any;
}

const PLATAFORMAS = [
  { value: "instagram", label: "Instagram" },
  { value: "tiktok", label: "TikTok" },
  { value: "facebook", label: "Facebook" },
  { value: "youtube", label: "YouTube" },
  { value: "linkedin", label: "LinkedIn" },
];

// Los estados siguen la convención de la intranet: verde lo terminado, ámbar lo
// que está en curso y gris lo que todavía es un borrador.
const ESTADOS: Record<string, { label: string; className: string }> = {
  borrador: { label: "Borrador", className: "bg-slate-100 text-slate-600 border-slate-200" },
  aprobado: { label: "Aprobado", className: "bg-amber-50 text-amber-700 border-amber-200" },
  grabado: { label: "Grabado", className: "bg-blue-50 text-blue-700 border-blue-200" },
  publicado: { label: "Publicado", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  planificacion: { label: "En planificación", className: "bg-slate-100 text-slate-600 border-slate-200" },
  activo: { label: "Activo", className: "bg-amber-50 text-amber-700 border-amber-200" },
  finalizado: { label: "Finalizado", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
};

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const BOTON_MARCA =
  "bg-[#fd6301] hover:bg-[#e35400] text-white shadow-md shadow-[#fd6301]/25 rounded-2xl transition-all";

const TAB_TRIGGER =
  "group inline-flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 text-xs sm:text-sm font-medium transition-all duration-200 text-slate-200 hover:text-white hover:bg-slate-800/70 data-[state=active]:bg-[#fd6301] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-[#fd6301]/30 dark:data-[state=active]:bg-[#fd6301] dark:data-[state=active]:text-white rounded-lg whitespace-nowrap";

function EstadoBadge({ estado }: { estado: string }) {
  const cfg = ESTADOS[estado] ?? { label: estado, className: "bg-slate-100 text-slate-600 border-slate-200" };
  return <Badge variant="outline" className={`text-[11px] font-semibold ${cfg.className}`}>{cfg.label}</Badge>;
}

function plataformaLabel(value: string) {
  return PLATAFORMAS.find((p) => p.value === value)?.label ?? value;
}

// ── Adjuntos ───────────────────────────────────────────────────────────────────
// Suben por /api/upload (el mismo camino que usan los comprobantes de Gastos) y
// después quedan guardados dentro del ítem: el archivo ya está en su lugar antes
// de que la ficha lo referencie.
function Adjuntos({
  archivos,
  onAgregar,
  onQuitar,
  subiendo,
}: {
  archivos: Archivo[];
  onAgregar: (file: File) => void;
  onQuitar: (index: number) => void;
  subiendo: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-[11px] uppercase tracking-wider font-bold text-slate-400">Archivos</Label>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="rounded-2xl h-8 text-xs border-slate-200 hover:border-orange-200 hover:text-[#fd6301]"
          disabled={subiendo}
          onClick={() => inputRef.current?.click()}
          data-testid="button-adjuntar-archivo"
        >
          {subiendo ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Upload className="h-3.5 w-3.5 mr-1.5" />}
          {subiendo ? "Subiendo…" : "Adjuntar"}
        </Button>
      </div>

      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onAgregar(file);
          e.target.value = "";
        }}
      />

      {archivos.length === 0 ? (
        <p className="text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-700 rounded-2xl px-3 py-4 text-center">
          Sin archivos todavía
        </p>
      ) : (
        <ul className="space-y-1.5">
          {archivos.map((a, i) => (
            <li
              key={`${a.url}-${i}`}
              className="flex items-center gap-2 rounded-2xl border border-slate-200/70 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/50 px-3 py-2"
            >
              <Paperclip className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <a
                href={a.url}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-medium text-slate-700 dark:text-slate-200 hover:text-[#fd6301] truncate flex-1"
              >
                {a.nombre}
              </a>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-7 w-7 rounded-lg text-slate-400 hover:text-red-600"
                onClick={() => onQuitar(i)}
                data-testid={`button-quitar-archivo-${i}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Sección genérica ───────────────────────────────────────────────────────────
interface CampoDef {
  name: string;
  label: string;
  tipo?: "texto" | "area" | "fecha" | "numero";
  placeholder?: string;
  ancho?: "full" | "medio";
}

interface SeccionProps {
  endpoint: string;
  titulo: string;
  singular: string;
  vacio: string;
  icono: any;
  estados: string[];
  campos: CampoDef[];
  /** Datos que se muestran en la tarjeta, además del título y la descripción. */
  resumen: (item: ItemRedes) => { label: string; valor: string }[];
  mes: number;
  anio: number;
}

function SeccionRedes({
  endpoint,
  titulo,
  singular,
  vacio,
  icono: Icono,
  estados,
  campos,
  resumen,
  mes,
  anio,
}: SeccionProps) {
  const { toast } = useToast();
  const queryKey = [endpoint, { mes, anio }];

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editando, setEditando] = useState<ItemRedes | null>(null);
  const [form, setForm] = useState<Record<string, any>>({});
  const [archivos, setArchivos] = useState<Archivo[]>([]);
  const [subiendo, setSubiendo] = useState(false);
  const [borrarId, setBorrarId] = useState<string | null>(null);

  const { data: items = [], isLoading } = useQuery<ItemRedes[]>({ queryKey });

  const cerrar = () => {
    setDialogOpen(false);
    setEditando(null);
    setForm({});
    setArchivos([]);
  };

  const invalidar = () => queryClient.invalidateQueries({ queryKey: [endpoint] });

  const guardar = useMutation({
    mutationFn: async (data: any) =>
      editando
        ? await apiRequest("PATCH", `${endpoint}/${editando.id}`, data)
        : await apiRequest("POST", endpoint, data),
    onSuccess: () => {
      invalidar();
      toast({ title: editando ? `${singular} actualizado` : `${singular} creado` });
      cerrar();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const eliminar = useMutation({
    mutationFn: async (id: string) => await apiRequest("DELETE", `${endpoint}/${id}`),
    onSuccess: () => {
      invalidar();
      toast({ title: `${singular} eliminado` });
      setBorrarId(null);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const abrirNuevo = () => {
    setEditando(null);
    setForm({ titulo: "", descripcion: "", plataforma: "instagram", estado: estados[0] });
    setArchivos([]);
    setDialogOpen(true);
  };

  const abrirEdicion = (item: ItemRedes) => {
    setEditando(item);
    const base: Record<string, any> = {
      titulo: item.titulo ?? "",
      descripcion: item.descripcion ?? "",
      plataforma: item.plataforma ?? "instagram",
      estado: item.estado ?? estados[0],
    };
    campos.forEach((c) => { base[c.name] = item[c.name] ?? ""; });
    setForm(base);
    setArchivos(item.archivos ?? []);
    setDialogOpen(true);
  };

  const subirArchivo = async (file: File) => {
    setSubiendo(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", credentials: "include", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "No se pudo subir el archivo");
      setArchivos((prev) => [
        ...prev,
        { url: data.url, nombre: file.name, tipo: file.type, subidoEn: new Date().toISOString() },
      ]);
      toast({ title: "Archivo adjuntado" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSubiendo(false);
    }
  };

  const enviar = () => {
    if (!form.titulo?.trim()) {
      toast({ title: "Falta el título", variant: "destructive" });
      return;
    }
    // Los campos vacíos van como null: un texto vacío en una fecha rompe el guardado.
    const payload: Record<string, any> = { mes, anio, archivos };
    Object.entries(form).forEach(([k, v]) => {
      payload[k] = typeof v === "string" && v.trim() === "" ? null : v;
    });
    payload.titulo = form.titulo.trim();
    guardar.mutate(payload);
  };

  const setCampo = (name: string, value: any) => setForm((f) => ({ ...f, [name]: value }));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Badge className="bg-gradient-to-r from-orange-500 to-[#fd6301] text-white border-0 text-sm font-semibold px-4 py-2 shadow-sm shadow-orange-500/25 rounded-full">
          {items.length} {items.length === 1 ? singular.toLowerCase() : titulo.toLowerCase()}
        </Badge>
        <Button onClick={abrirNuevo} className={BOTON_MARCA} data-testid={`button-nuevo-${singular.toLowerCase()}`}>
          <Plus className="h-4 w-4 mr-2" /> Nuevo {singular.toLowerCase()}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-[#fd6301]" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 py-16 px-6 text-center">
          <div className="h-12 w-12 rounded-2xl bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center mb-3">
            <Icono className="h-6 w-6 text-[#fd6301]" />
          </div>
          <p className="font-semibold text-slate-700 dark:text-slate-200">{vacio}</p>
          <p className="text-sm text-slate-400 mt-1">
            Todo lo que agregues acá queda guardado por mes, con sus archivos.
          </p>
          <Button onClick={abrirNuevo} className={`${BOTON_MARCA} mt-4`}>
            <Plus className="h-4 w-4 mr-2" /> Crear el primero
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {items.map((item) => {
            const adjuntos = item.archivos ?? [];
            const datos = resumen(item);
            return (
              <div
                key={item.id}
                className="rounded-2xl border border-slate-200/70 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-sm hover:border-orange-200 hover:shadow transition-all"
                data-testid={`card-${singular.toLowerCase()}-${item.id}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-slate-800 dark:text-slate-100 truncate">{item.titulo}</h3>
                      <EstadoBadge estado={item.estado} />
                    </div>
                    <p className="text-[11px] uppercase tracking-wider font-bold text-slate-400 mt-1">
                      {plataformaLabel(item.plataforma)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 rounded-lg text-slate-400 hover:text-[#fd6301]"
                      onClick={() => abrirEdicion(item)}
                      data-testid={`button-editar-${item.id}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 rounded-lg text-slate-400 hover:text-red-600"
                      onClick={() => setBorrarId(item.id)}
                      data-testid={`button-eliminar-${item.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {item.descripcion && (
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 line-clamp-2">{item.descripcion}</p>
                )}

                {datos.length > 0 && (
                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
                    {datos.map((r) => (
                      <div key={r.label} className="min-w-0">
                        <dt className="text-[10px] uppercase tracking-wider font-bold text-slate-400">{r.label}</dt>
                        <dd className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{r.valor}</dd>
                      </div>
                    ))}
                  </dl>
                )}

                {adjuntos.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {adjuntos.map((a, i) => (
                      <a
                        key={`${a.url}-${i}`}
                        href={a.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/70 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-3 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-[#fd6301] hover:border-orange-200 max-w-full"
                      >
                        <Paperclip className="h-3 w-3 shrink-0" />
                        <span className="truncate">{a.nombre}</span>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(o) => (o ? setDialogOpen(true) : cerrar())}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editando ? `Editar ${singular.toLowerCase()}` : `Nuevo ${singular.toLowerCase()}`}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Título</Label>
              <Input
                value={form.titulo ?? ""}
                onChange={(e) => setCampo("titulo", e.target.value)}
                placeholder={`Nombre del ${singular.toLowerCase()}`}
                data-testid="input-titulo"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Plataforma</Label>
                <Select value={form.plataforma ?? "instagram"} onValueChange={(v) => setCampo("plataforma", v)}>
                  <SelectTrigger data-testid="select-plataforma"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PLATAFORMAS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Estado</Label>
                <Select value={form.estado ?? estados[0]} onValueChange={(v) => setCampo("estado", v)}>
                  <SelectTrigger data-testid="select-estado"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {estados.map((e) => (
                      <SelectItem key={e} value={e}>{ESTADOS[e]?.label ?? e}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Descripción</Label>
              <Textarea
                rows={2}
                value={form.descripcion ?? ""}
                onChange={(e) => setCampo("descripcion", e.target.value)}
                placeholder="De qué se trata"
                data-testid="input-descripcion"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {campos.map((c) => (
                <div
                  key={c.name}
                  className={`space-y-1.5 ${c.ancho === "full" || c.tipo === "area" ? "sm:col-span-2" : ""}`}
                >
                  <Label>{c.label}</Label>
                  {c.tipo === "area" ? (
                    <Textarea
                      rows={4}
                      value={form[c.name] ?? ""}
                      onChange={(e) => setCampo(c.name, e.target.value)}
                      placeholder={c.placeholder}
                      data-testid={`input-${c.name}`}
                    />
                  ) : (
                    <Input
                      type={c.tipo === "fecha" ? "date" : c.tipo === "numero" ? "number" : "text"}
                      value={form[c.name] ?? ""}
                      onChange={(e) =>
                        setCampo(
                          c.name,
                          c.tipo === "numero"
                            ? (e.target.value === "" ? "" : Number(e.target.value))
                            : e.target.value,
                        )
                      }
                      placeholder={c.placeholder}
                      data-testid={`input-${c.name}`}
                    />
                  )}
                </div>
              ))}
            </div>

            <Adjuntos
              archivos={archivos}
              subiendo={subiendo}
              onAgregar={subirArchivo}
              onQuitar={(i) => setArchivos((prev) => prev.filter((_, idx) => idx !== i))}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" className="rounded-2xl" onClick={cerrar}>Cancelar</Button>
            <Button onClick={enviar} disabled={guardar.isPending} className={BOTON_MARCA} data-testid="button-guardar">
              {guardar.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!borrarId} onOpenChange={(o) => !o && setBorrarId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este {singular.toLowerCase()}?</AlertDialogTitle>
            <AlertDialogDescription>
              Se borra el registro y sus archivos dejan de estar enlazados. No se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-2xl">Cancelar</AlertDialogCancel>
            <Button
              variant="destructive"
              className="rounded-2xl"
              onClick={() => borrarId && eliminar.mutate(borrarId)}
              disabled={eliminar.isPending}
              data-testid="button-confirmar-eliminar"
            >
              {eliminar.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Eliminar
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Página ─────────────────────────────────────────────────────────────────────
export default function RedesSocialesMarketing() {
  const hoy = new Date();
  const [mes, setMes] = useState(hoy.getMonth() + 1);
  const [anio, setAnio] = useState(hoy.getFullYear());

  const anios = useMemo(() => {
    const actual = new Date().getFullYear();
    return [actual + 1, actual, actual - 1, actual - 2];
  }, []);

  const fmtFecha = (v?: string | null) => {
    if (!v) return "—";
    const [y, m, d] = String(v).slice(0, 10).split("-");
    return d ? `${d}-${m}-${y}` : String(v);
  };

  return (
    <div className="space-y-6">
      {/* El período manda en toda la pantalla: las tres secciones se guardan por mes. */}
      <div className="flex items-center gap-3 bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-700 rounded-2xl pl-2.5 pr-4 py-2.5 shadow-sm hover:border-orange-200 hover:shadow transition-all w-fit">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-orange-50 text-orange-600 flex-shrink-0">
          <CalendarDays className="h-4 w-4" />
        </div>
        <div className="flex flex-col leading-none">
          <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-0.5">Período</span>
          <div className="flex items-center gap-2">
            <Select value={String(mes)} onValueChange={(v) => setMes(Number(v))}>
              <SelectTrigger
                className="h-5 border-0 shadow-none p-0 gap-2 w-auto bg-transparent font-semibold text-sm text-slate-700 dark:text-slate-200 focus:ring-0 [&>svg]:h-3.5 [&>svg]:w-3.5 [&>svg]:opacity-60"
                data-testid="select-mes"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MESES.map((m, i) => (
                  <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={String(anio)} onValueChange={(v) => setAnio(Number(v))}>
              <SelectTrigger
                className="h-5 border-0 shadow-none p-0 gap-2 w-auto bg-transparent font-semibold text-sm text-slate-700 dark:text-slate-200 focus:ring-0 [&>svg]:h-3.5 [&>svg]:w-3.5 [&>svg]:opacity-60"
                data-testid="select-anio"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {anios.map((a) => (
                  <SelectItem key={a} value={String(a)}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <Tabs defaultValue="guiones" className="space-y-6">
        <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <TabsList className="inline-flex w-max sm:w-full sm:grid sm:grid-cols-3 h-auto gap-1.5 bg-[#0a0a0a] dark:bg-[#0a0a0a] p-1.5 border border-slate-800/80 dark:border-slate-800/80 rounded-2xl">
            <TabsTrigger value="guiones" className={TAB_TRIGGER} data-testid="tab-guiones-reel">
              <FileText className="h-4 w-4 shrink-0 hidden sm:block" /> Guiones Reel
            </TabsTrigger>
            <TabsTrigger value="carruseles" className={TAB_TRIGGER} data-testid="tab-carruseles">
              <Images className="h-4 w-4 shrink-0 hidden sm:block" /> Carruseles
            </TabsTrigger>
            <TabsTrigger value="concursos" className={TAB_TRIGGER} data-testid="tab-concursos">
              <Gift className="h-4 w-4 shrink-0 hidden sm:block" /> Concursos
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="guiones" className="mt-0">
          <SeccionRedes
            endpoint="/api/marketing/guiones-reel"
            titulo="Guiones"
            singular="Guión"
            vacio="Todavía no hay guiones de reel este mes"
            icono={FileText}
            estados={["borrador", "aprobado", "grabado", "publicado"]}
            campos={[
              { name: "fecha", label: "Fecha de grabación", tipo: "fecha" },
              { name: "guion", label: "Guión", tipo: "area", placeholder: "El texto del reel, escena por escena" },
            ]}
            resumen={(item) => [{ label: "Grabación", valor: fmtFecha(item.fecha) }]}
            mes={mes}
            anio={anio}
          />
        </TabsContent>

        <TabsContent value="carruseles" className="mt-0">
          <SeccionRedes
            endpoint="/api/marketing/carruseles"
            titulo="Carruseles"
            singular="Carrusel"
            vacio="Todavía no hay carruseles este mes"
            icono={Images}
            estados={["borrador", "aprobado", "publicado"]}
            campos={[
              { name: "fechaPublicacion", label: "Fecha de publicación", tipo: "fecha" },
              { name: "urlPublicacion", label: "Enlace de la publicación", placeholder: "https://…" },
              { name: "copy", label: "Copy de la publicación", tipo: "area", placeholder: "El texto que acompaña al carrusel" },
            ]}
            resumen={(item) => [{ label: "Publicación", valor: fmtFecha(item.fechaPublicacion) }]}
            mes={mes}
            anio={anio}
          />
        </TabsContent>

        <TabsContent value="concursos" className="mt-0">
          <SeccionRedes
            endpoint="/api/marketing/concursos"
            titulo="Concursos"
            singular="Concurso"
            vacio="Todavía no hay un concurso para este mes"
            icono={Gift}
            estados={["planificacion", "activo", "finalizado"]}
            campos={[
              { name: "fechaInicio", label: "Empieza", tipo: "fecha" },
              { name: "fechaFin", label: "Termina", tipo: "fecha" },
              { name: "premio", label: "Premio", placeholder: "Qué se gana" },
              { name: "ganador", label: "Ganador", placeholder: "Se completa al cerrar" },
              { name: "participantes", label: "Participantes", tipo: "numero" },
              { name: "urlPublicacion", label: "Enlace de la publicación", placeholder: "https://…" },
              { name: "mecanica", label: "Mecánica", tipo: "area", placeholder: "Cómo se participa" },
              { name: "bases", label: "Bases y condiciones", tipo: "area", placeholder: "Requisitos, plazos, restricciones" },
            ]}
            resumen={(item) => [
              { label: "Premio", valor: item.premio || "—" },
              { label: "Vigencia", valor: `${fmtFecha(item.fechaInicio)} → ${fmtFecha(item.fechaFin)}` },
              { label: "Ganador", valor: item.ganador || "—" },
              { label: "Participantes", valor: item.participantes != null ? String(item.participantes) : "—" },
            ]}
            mes={mes}
            anio={anio}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
