import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Archive, Megaphone, Pencil, Send, Sparkles, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { FranjaMensajes, type MensajeVisible } from "@/components/mensajes/franja-mensajes";
import { CONFIGURABLE_ROLES, ROLE_LABELS } from "@shared/permissions";
import { ICONO_CHIP, ICONO_CHIP_ICONO } from "@/lib/icono-chip";
import { ideasPara } from "@/lib/mensajes-ideas";

interface Mensaje {
  id: string;
  texto: string;
  audiencia: string;
  segmento: string | null;
  color: string;
  activo: boolean;
  desde: string | null;
  hasta: string | null;
  creadoPorId: string;
  creadoPorNombre: string | null;
  creadoPorRol: string;
  updatedAt: string;
}

const COLORES: { value: string; label: string; hex: string }[] = [
  { value: "naranjo", label: "Naranjo", hex: "#fd6301" },
  { value: "cian", label: "Cian", hex: "#22d3ee" },
  { value: "verde", label: "Verde", hex: "#22c55e" },
  { value: "rosa", label: "Rosa", hex: "#ec4899" },
  { value: "amarillo", label: "Amarillo", hex: "#facc15" },
];

const SEGMENTO_LABEL: Record<string, string> = {
  ferreterias: "Ferretería",
  construccion: "Construcción",
  digital: "Digital / Industrial",
  marketing: "Marketing",
};

const MAX = 280;

const audienciaLabel = (a: string) =>
  a === "todos" ? "Todos los roles" : ROLE_LABELS[a] || a;

function hoyChile(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

function estadoDe(m: Mensaje): { label: string; clase: string } {
  const hoy = hoyChile();
  if (!m.activo) return { label: "PAUSADO", clase: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" };
  if (m.desde && m.desde > hoy) return { label: "PROGRAMADO", clase: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300" };
  if (m.hasta && m.hasta < hoy) return { label: "VENCIDO", clase: "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300" };
  return { label: "EN PANTALLA", clase: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300" };
}

const fechaCorta = (f: string) => {
  const [y, m, d] = f.split("-");
  return `${d}/${m}/${y}`;
};

const CAMPO = "rounded-xl bg-slate-50/60 dark:bg-slate-800/60 focus-visible:border-[#fd6301] focus-visible:ring-orange-500/20";
const BOTON_PRIMARIO = "rounded-2xl bg-[#fd6301] hover:bg-[#e35400] text-white shadow-md shadow-[#fd6301]/25";

const VACIO = { texto: "", audiencia: "todos", color: "naranjo", desde: "", hasta: "" };

export default function MensajesConfigPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const esAdmin = user?.role === "admin";
  const areaSupervisor = SEGMENTO_LABEL[((user as any)?.assignedSegment || "").toLowerCase()] ||
    (user as any)?.assignedSegment || null;

  const [form, setForm] = useState(() => ({ ...VACIO, audiencia: esAdmin ? "todos" : "salesperson" }));
  const [editando, setEditando] = useState<Mensaje | null>(null);
  const [archivar, setArchivar] = useState<Mensaje | null>(null);

  const { data: mensajes = [], isLoading } = useQuery<Mensaje[]>({
    queryKey: ["/api/mensajes-destacados"],
  });

  const refrescar = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/mensajes-destacados"] });
    queryClient.invalidateQueries({ queryKey: ["/api/mensajes-destacados/mios"] });
  };

  const errorToast = async (e: any) => {
    let msg = "No se pudo guardar";
    try {
      const raw = String(e?.message || "");
      const json = JSON.parse(raw.slice(raw.indexOf("{")));
      msg = json.message || msg;
    } catch {
      if (e?.message) msg = e.message;
    }
    toast({ title: "Error", description: msg, variant: "destructive" });
  };

  const guardar = useMutation({
    mutationFn: async () => {
      const body = {
        texto: form.texto,
        audiencia: esAdmin ? form.audiencia : "salesperson",
        color: form.color,
        desde: form.desde || null,
        hasta: form.hasta || null,
      };
      if (editando) return apiRequest("PATCH", `/api/mensajes-destacados/${editando.id}`, body);
      return apiRequest("POST", "/api/mensajes-destacados", { ...body, activo: true });
    },
    onSuccess: () => {
      toast({ title: editando ? "Mensaje actualizado" : "Mensaje publicado" });
      setEditando(null);
      setForm({ ...VACIO, audiencia: esAdmin ? "todos" : "salesperson" });
      refrescar();
    },
    onError: errorToast,
  });

  const cambiarActivo = useMutation({
    mutationFn: (m: Mensaje) => apiRequest("PATCH", `/api/mensajes-destacados/${m.id}`, { activo: !m.activo }),
    onSuccess: refrescar,
    onError: errorToast,
  });

  const archivarMut = useMutation({
    mutationFn: (m: Mensaje) => apiRequest("POST", `/api/mensajes-destacados/${m.id}/archivar`),
    onSuccess: () => {
      toast({ title: "Mensaje archivado" });
      setArchivar(null);
      refrescar();
    },
    onError: errorToast,
  });

  const editar = (m: Mensaje) => {
    setEditando(m);
    setForm({ texto: m.texto, audiencia: m.audiencia, color: m.color, desde: m.desde || "", hasta: m.hasta || "" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelarEdicion = () => {
    setEditando(null);
    setForm({ ...VACIO, audiencia: esAdmin ? "todos" : "salesperson" });
  };

  const vistaPrevia: MensajeVisible[] = useMemo(
    () => [{
      id: "vista-previa",
      texto: form.texto.trim() || "Escribe tu mensaje y míralo acá como lo verá tu equipo",
      color: form.color,
      autor: null,
      updatedAt: "",
    }],
    [form.texto, form.color],
  );

  const audiencias = ["todos", ...CONFIGURABLE_ROLES.filter((r) => r !== "admin")];
  const ideas = useMemo(() => ideasPara(esAdmin ? form.audiencia : "salesperson"), [esAdmin, form.audiencia]);
  const textoValido = form.texto.trim().length >= 3;

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <div className={ICONO_CHIP}>
          <Megaphone className={ICONO_CHIP_ICONO} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Mensajes destacados</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {esAdmin
              ? "Aparecen en una franja neón arriba de la pantalla de inicio de cada rol."
              : `Aparecen en una franja neón arriba del inicio de los vendedores${areaSupervisor ? ` de ${areaSupervisor}` : " que te reportan"}.`}
          </p>
        </div>
      </div>

      {/* Formulario + vista previa */}
      <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold text-slate-800 dark:text-slate-100">
            {editando ? "Editar mensaje" : "Nuevo mensaje"}
          </h3>
          {editando && (
            <Button variant="ghost" size="sm" className="rounded-2xl" onClick={cancelarEdicion}>
              <X className="h-4 w-4 mr-1" /> Cancelar edición
            </Button>
          )}
        </div>

        <div className="space-y-1.5">
          <Textarea
            value={form.texto}
            onChange={(e) => setForm((f) => ({ ...f, texto: e.target.value.slice(0, MAX) }))}
            placeholder="Ej: ¡Este viernes cierra el mes! Ingresen sus notas de venta antes de las 13:00"
            rows={2}
            className={CAMPO}
            data-testid="mensaje-texto"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 text-right tabular-nums">{form.texto.length}/{MAX}</p>
        </div>

        {/* Ideas para empezar: cambian según a quién va el mensaje. Tocar una
            llena el texto y el color; después se ajusta a gusto. */}
        <div className="space-y-1.5" data-sin-brillo>
          <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold text-slate-400">
            <Sparkles className="h-3 w-3 text-[#fd6301]" /> Ideas para empezar
          </span>
          <div className="flex gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {ideas.map((idea) => {
              const hex = COLORES.find((c) => c.value === idea.color)?.hex || "#fd6301";
              const elegida = form.texto === idea.texto;
              return (
                <button
                  key={idea.titulo}
                  type="button"
                  title={idea.texto}
                  onClick={() => setForm((f) => ({ ...f, texto: idea.texto.slice(0, MAX), color: idea.color }))}
                  className={`shrink-0 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${elegida
                    ? "border-[#fd6301] bg-orange-50 text-[#fd6301] dark:bg-orange-500/10"
                    : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-orange-200 hover:text-[#fd6301]"}`}
                  data-testid={`mensaje-idea-${idea.titulo}`}
                >
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: hex, boxShadow: `0 0 6px ${hex}` }} />
                  {idea.titulo}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="space-y-1.5 lg:col-span-1">
            <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Para</span>
            {esAdmin ? (
              <Select value={form.audiencia} onValueChange={(v) => setForm((f) => ({ ...f, audiencia: v }))}>
                <SelectTrigger className={CAMPO} data-testid="mensaje-audiencia"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {audiencias.map((a) => (
                    <SelectItem key={a} value={a}>{audienciaLabel(a)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className={`h-10 px-3 flex items-center text-sm border border-input ${CAMPO}`}>
                Vendedores{areaSupervisor ? ` · ${areaSupervisor}` : ""}
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Desde (opcional)</span>
            <Input type="date" value={form.desde} onChange={(e) => setForm((f) => ({ ...f, desde: e.target.value }))} className={CAMPO} />
          </div>
          <div className="space-y-1.5">
            <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Hasta (opcional)</span>
            <Input type="date" value={form.hasta} min={form.desde || undefined} onChange={(e) => setForm((f) => ({ ...f, hasta: e.target.value }))} className={CAMPO} />
          </div>
          <div className="space-y-1.5">
            <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Color del neón</span>
            <div className="flex items-center gap-2 h-10">
              {COLORES.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  title={c.label}
                  aria-label={c.label}
                  aria-pressed={form.color === c.value}
                  onClick={() => setForm((f) => ({ ...f, color: c.value }))}
                  className={`h-7 w-7 rounded-full transition-all ${form.color === c.value ? "ring-2 ring-offset-2 ring-slate-900 dark:ring-white dark:ring-offset-slate-900 scale-110" : "opacity-70 hover:opacity-100"}`}
                  style={{ backgroundColor: c.hex, boxShadow: `0 0 10px ${c.hex}` }}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Vista previa</span>
          <FranjaMensajes vistaPrevia={vistaPrevia} className="!px-0 !pt-0" />
        </div>

        <div className="flex justify-end">
          <Button
            className={BOTON_PRIMARIO}
            disabled={!textoValido || guardar.isPending}
            onClick={() => guardar.mutate()}
            data-testid="mensaje-guardar"
          >
            <Send className="h-4 w-4 mr-2" />
            {guardar.isPending ? "Guardando…" : editando ? "Guardar cambios" : "Publicar mensaje"}
          </Button>
        </div>
      </div>

      {/* Lista */}
      <div className="space-y-3">
        <h3 className="font-semibold text-slate-800 dark:text-slate-100">
          {esAdmin ? "Mensajes publicados" : "Tus mensajes"}
        </h3>
        {isLoading ? (
          <p className="text-sm text-gray-500">Cargando…</p>
        ) : mensajes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 p-8 text-center text-sm text-gray-500 dark:text-gray-400">
            Todavía no hay mensajes. El primero que publiques aparece al tiro en el inicio.
          </div>
        ) : (
          <div className="space-y-2">
            {mensajes.map((m) => {
              const estado = estadoDe(m);
              const hex = COLORES.find((c) => c.value === m.color)?.hex || "#fd6301";
              return (
                <div
                  key={m.id}
                  className={`flex flex-col sm:flex-row sm:items-center gap-3 rounded-2xl border bg-white dark:bg-slate-900 p-3 sm:p-4 ${editando?.id === m.id ? "border-[#fd6301]" : "border-slate-200/70 dark:border-slate-800"}`}
                >
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <span className="mt-1.5 h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: hex, boxShadow: `0 0 8px ${hex}` }} />
                    <div className="min-w-0">
                      <p className="text-sm text-slate-800 dark:text-slate-100 break-words">{m.texto}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Para <span className="font-medium text-slate-700 dark:text-slate-300">{audienciaLabel(m.audiencia)}</span>
                        {m.segmento ? ` · ${SEGMENTO_LABEL[m.segmento] || m.segmento}` : ""}
                        {m.desde || m.hasta ? ` · ${m.desde ? fechaCorta(m.desde) : "…"} → ${m.hasta ? fechaCorta(m.hasta) : "…"}` : ""}
                        {esAdmin && m.creadoPorNombre ? ` · por ${m.creadoPorNombre}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 sm:flex-shrink-0 justify-end">
                    <span className={`text-[10px] font-bold tracking-wider px-2 py-1 rounded-full ${estado.clase}`}>{estado.label}</span>
                    <Switch
                      checked={m.activo}
                      onCheckedChange={() => cambiarActivo.mutate(m)}
                      disabled={cambiarActivo.isPending}
                      aria-label={m.activo ? "Pausar" : "Activar"}
                      title={m.activo ? "Pausar" : "Activar"}
                      className="data-[state=checked]:bg-[#fd6301]"
                    />
                    <Button variant="ghost" size="icon" className="rounded-lg h-8 w-8" title="Editar" onClick={() => editar(m)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="rounded-lg h-8 w-8 hover:text-rose-600" title="Archivar" onClick={() => setArchivar(m)}>
                      <Archive className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <AlertDialog open={!!archivar} onOpenChange={(o) => !o && setArchivar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Archivar este mensaje?</AlertDialogTitle>
            <AlertDialogDescription>
              Deja de mostrarse y sale de esta lista. Si lo necesitas de nuevo, tendrás que crearlo otra vez.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-2xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className={BOTON_PRIMARIO}
              onClick={() => archivar && archivarMut.mutate(archivar)}
            >
              Archivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
