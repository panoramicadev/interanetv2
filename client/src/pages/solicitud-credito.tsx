/**
 * Solicitud de Crédito — el vendedor pide, Finanzas resuelve.
 *
 * Antes esto era una pestaña dentro de /facturas que no guardaba nada: el envío
 * hacía console.log y limpiaba el formulario. Acá la solicitud queda registrada,
 * dispara el aviso por correo (con copia al supervisor y al propio vendedor) y
 * se sigue por su estado hasta que Finanzas la aprueba o la rechaza.
 *
 * La carpeta tributaria se sube por /api/upload —el mismo camino que el resto de
 * los adjuntos del sistema— y en la solicitud queda su enlace.
 */
import { useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Banknote,
  Building2,
  Check,
  FileText,
  Loader2,
  Paperclip,
  Send,
  Upload,
  Users,
  X,
} from "lucide-react";
import type { SolicitudCredito } from "@shared/schema";

const ROLES_RESUELVEN = ["admin", "supervisor", "encargado_area", "recursos_humanos"];

const FORM_VACIO = {
  razonSocial: "",
  rut: "",
  direccion: "",
  ciudad: "",
  telefono: "",
  giro: "",
  correo: "",
  socio1Nombre: "",
  socio1Direccion: "",
  socio2Nombre: "",
  socio2Direccion: "",
  representanteNombre: "",
  representanteCedula: "",
  banco1: "",
  cuenta1: "",
  sucursal1: "",
  banco2: "",
  cuenta2: "",
  sucursal2: "",
  creditoSolicitado: "",
};

type FormSolicitud = typeof FORM_VACIO;

const money = (valor: unknown) => {
  const n = Number(valor ?? 0);
  return Number.isFinite(n) ? `$${Math.round(n).toLocaleString("es-CL")}` : "—";
};

const fmtFecha = (valor: string | Date | null | undefined) => {
  if (!valor) return "—";
  const d = new Date(valor as any);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("es-CL");
};

const BADGE_ESTADO: Record<string, string> = {
  enviada: "bg-amber-100 text-amber-700 border-amber-200",
  aprobada: "bg-emerald-100 text-emerald-700 border-emerald-200",
  rechazada: "bg-red-100 text-red-700 border-red-200",
};

export default function SolicitudCreditoPage() {
  return <SolicitudCreditoContent />;
}

/**
 * El mismo módulo, embebible como pestaña del Panel de Trabajo (tareas.tsx).
 * Con `embedded` se omiten el encabezado y el ancho de página: el panel ya
 * pone su propio header y su contenedor.
 */
export function SolicitudCreditoContent({ embedded = false }: { embedded?: boolean }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [form, setForm] = useState<FormSolicitud>(FORM_VACIO);
  const [carpeta, setCarpeta] = useState<{ url: string; nombre: string } | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const puedeResolver = ROLES_RESUELVEN.includes(user?.role ?? "");

  const { data: solicitudes = [], isLoading } = useQuery<SolicitudCredito[]>({
    queryKey: ["/api/solicitudes-credito"],
    queryFn: async () => {
      const res = await apiRequest("/api/solicitudes-credito");
      return res.json();
    },
  });

  const enviar = useMutation({
    mutationFn: async (datos: Record<string, unknown>) => {
      const res = await apiRequest("/api/solicitudes-credito", { method: "POST", data: datos });
      return res.json();
    },
    onSuccess: () => {
      setForm(FORM_VACIO);
      setCarpeta(null);
      queryClient.invalidateQueries({ queryKey: ["/api/solicitudes-credito"] });
      toast({
        title: "Solicitud enviada",
        description: "Finanzas la recibió por correo, con copia a tu supervisor y a ti.",
      });
    },
    onError: (error: any) => {
      toast({ title: "No se pudo enviar", description: error?.message, variant: "destructive" });
    },
  });

  const resolver = useMutation({
    mutationFn: async ({ id, datos }: { id: string; datos: Record<string, unknown> }) => {
      const res = await apiRequest(`/api/solicitudes-credito/${id}`, { method: "PATCH", data: datos });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/solicitudes-credito"] });
      toast({ title: "Solicitud resuelta" });
    },
    onError: (error: any) => {
      toast({ title: "No se pudo resolver", description: error?.message, variant: "destructive" });
    },
  });

  const campo = (k: keyof FormSolicitud, valor: string) => setForm((p) => ({ ...p, [k]: valor }));

  const subirCarpeta = async (file: File) => {
    setSubiendo(true);
    try {
      const datos = new FormData();
      datos.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: datos, credentials: "include" });
      if (!res.ok) throw new Error("No se pudo subir el archivo");
      const json = await res.json();
      const url = json.fileUrl || json.url;
      if (!url) throw new Error("El servidor no devolvió la ubicación del archivo");
      setCarpeta({ url, nombre: file.name });
    } catch (error: any) {
      toast({ title: "No se pudo adjuntar la carpeta", description: error?.message, variant: "destructive" });
    } finally {
      setSubiendo(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const obligatoriosOk =
    form.razonSocial.trim() &&
    form.rut.trim() &&
    form.direccion.trim() &&
    form.ciudad.trim() &&
    form.telefono.trim() &&
    Number(form.creditoSolicitado) > 0;

  const enviarSolicitud = () => {
    if (!obligatoriosOk) {
      toast({
        title: "Faltan datos",
        description: "Razón social, RUT, dirección, ciudad, teléfono y crédito solicitado son obligatorios.",
        variant: "destructive",
      });
      return;
    }
    enviar.mutate({
      ...form,
      correo: form.correo.trim() || null,
      creditoSolicitado: Number(form.creditoSolicitado),
      carpetaTributariaUrl: carpeta?.url ?? null,
      carpetaTributariaNombre: carpeta?.nombre ?? null,
    });
  };

  const Campo = ({
    k,
    label,
    obligatorio,
    placeholder,
    tipo = "text",
  }: {
    k: keyof FormSolicitud;
    label: string;
    obligatorio?: boolean;
    placeholder?: string;
    tipo?: string;
  }) => (
    <div>
      <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1">
        {label} {obligatorio && <span className="text-[#fd6301]">obligatorio</span>}
      </div>
      <Input
        value={form[k]}
        onChange={(e) => campo(k, e.target.value)}
        placeholder={placeholder}
        type={tipo}
        className="h-9 rounded-xl text-sm"
        data-testid={`input-credito-${k}`}
      />
    </div>
  );

  const Seccion = ({
    icono,
    titulo,
    children,
  }: {
    icono: React.ReactNode;
    titulo: string;
    children: React.ReactNode;
  }) => (
    <div className="rounded-2xl border border-slate-200/70 dark:border-slate-700/60 bg-white dark:bg-slate-900/40 p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
        <span className="w-7 h-7 rounded-lg bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400 flex items-center justify-center">
          {icono}
        </span>
        {titulo}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>
    </div>
  );

  return (
    <div className={embedded ? "space-y-4 max-w-5xl" : "p-3 sm:p-5 space-y-4 max-w-5xl mx-auto"}>
      {embedded ? (
        <p className="text-sm text-muted-foreground">
          Se envía a Finanzas con copia a tu supervisor y a ti. Adjuntá la carpeta tributaria para que puedan evaluarla.
        </p>
      ) : (
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-orange-500 to-[#fd6301] text-white flex items-center justify-center">
              <Banknote className="h-4 w-4" />
            </span>
            Solicitud de Crédito
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Se envía a Finanzas con copia a tu supervisor y a ti. Adjuntá la carpeta tributaria para que puedan evaluarla.
          </p>
        </div>
      )}

      <Tabs defaultValue="nueva">
        <TabsList className="h-9 bg-muted/50 p-0.5 rounded-lg">
          <TabsTrigger value="nueva" className="text-xs rounded-md px-3" data-testid="tab-credito-nueva">
            Nueva solicitud
          </TabsTrigger>
          <TabsTrigger value="historial" className="text-xs rounded-md px-3" data-testid="tab-credito-historial">
            Solicitudes
            {solicitudes.length > 0 && (
              <span className="ml-1.5 tabular-nums text-slate-400">{solicitudes.length}</span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="nueva" className="mt-4 space-y-3">
          <Seccion icono={<Building2 className="h-3.5 w-3.5" />} titulo="Datos de la empresa">
            <Campo k="razonSocial" label="Razón social" obligatorio placeholder="Constructora ..." />
            <Campo k="rut" label="RUT" obligatorio placeholder="76.123.456-7" />
            <Campo k="direccion" label="Dirección" obligatorio />
            <Campo k="ciudad" label="Ciudad" obligatorio />
            <Campo k="telefono" label="Teléfono" obligatorio placeholder="+56 9 ..." />
            <Campo k="correo" label="Correo" placeholder="contacto@empresa.cl" />
            <Campo k="giro" label="Giro" />
          </Seccion>

          <Seccion icono={<Users className="h-3.5 w-3.5" />} titulo="Socios y representante legal">
            <Campo k="socio1Nombre" label="Socio 1" />
            <Campo k="socio1Direccion" label="Dirección socio 1" />
            <Campo k="socio2Nombre" label="Socio 2" />
            <Campo k="socio2Direccion" label="Dirección socio 2" />
            <Campo k="representanteNombre" label="Representante legal" />
            <Campo k="representanteCedula" label="Cédula del representante" />
          </Seccion>

          <Seccion icono={<Banknote className="h-3.5 w-3.5" />} titulo="Bancos">
            <Campo k="banco1" label="Banco 1" />
            <Campo k="cuenta1" label="Cuenta 1" />
            <Campo k="sucursal1" label="Sucursal 1" />
            <Campo k="banco2" label="Banco 2" />
            <Campo k="cuenta2" label="Cuenta 2" />
            <Campo k="sucursal2" label="Sucursal 2" />
          </Seccion>

          <div className="rounded-2xl border border-slate-200/70 dark:border-slate-700/60 bg-white dark:bg-slate-900/40 p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
              <span className="w-7 h-7 rounded-lg bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400 flex items-center justify-center">
                <FileText className="h-3.5 w-3.5" />
              </span>
              Crédito y carpeta tributaria
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Campo k="creditoSolicitado" label="Crédito solicitado" obligatorio tipo="number" placeholder="0" />

              {/* La carpeta tributaria es el adjunto con el que Finanzas evalúa;
                  sube por el mismo /api/upload que el resto de los adjuntos. */}
              <div>
                <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1">
                  Carpeta tributaria
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  className="hidden"
                  accept=".pdf,.zip,.rar,.jpg,.jpeg,.png,.xlsx,.xls"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void subirCarpeta(file);
                  }}
                  data-testid="input-carpeta-tributaria"
                />
                {carpeta ? (
                  <div className="flex items-center gap-2 h-9 rounded-xl border border-emerald-200 bg-emerald-50/60 px-3">
                    <Paperclip className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0" />
                    <a
                      href={carpeta.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-medium text-emerald-800 truncate flex-1 min-w-0 hover:underline"
                    >
                      {carpeta.nombre}
                    </a>
                    <button
                      onClick={() => setCarpeta(null)}
                      className="text-emerald-600 hover:text-red-600 flex-shrink-0"
                      aria-label="Quitar la carpeta adjunta"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => fileRef.current?.click()}
                    disabled={subiendo}
                    className="w-full h-9 rounded-xl text-xs justify-start gap-2 border-dashed"
                    data-testid="button-adjuntar-carpeta"
                  >
                    {subiendo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                    {subiendo ? "Subiendo…" : "Adjuntar carpeta tributaria"}
                  </Button>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <Button
                onClick={enviarSolicitud}
                disabled={enviar.isPending || subiendo}
                className="h-9 rounded-xl bg-gradient-to-r from-orange-500 to-[#fd6301] hover:from-[#e35400] hover:to-[#e35400] text-white text-sm font-semibold"
                data-testid="button-submit-credito"
              >
                {enviar.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Enviar solicitud
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="historial" className="mt-4">
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-slate-400 py-8 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
            </div>
          ) : solicitudes.length === 0 ? (
            <p className="text-sm text-slate-400 py-10 text-center">Todavía no hay solicitudes enviadas.</p>
          ) : (
            <div className="space-y-2">
              {solicitudes.map((s) => (
                <FilaSolicitud
                  key={s.id}
                  solicitud={s}
                  puedeResolver={puedeResolver && s.estado === "enviada"}
                  resolviendo={resolver.isPending}
                  onResolver={(datos) => resolver.mutate({ id: s.id, datos })}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

/** Una solicitud del listado, con la resolución de Finanzas cuando corresponde. */
function FilaSolicitud({
  solicitud,
  puedeResolver,
  resolviendo,
  onResolver,
}: {
  solicitud: SolicitudCredito;
  puedeResolver: boolean;
  resolviendo: boolean;
  onResolver: (datos: Record<string, unknown>) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [monto, setMonto] = useState("");
  const [motivo, setMotivo] = useState("");

  return (
    <div
      className="rounded-2xl border border-slate-200/70 dark:border-slate-700/60 bg-white dark:bg-slate-900/40 px-4 py-3"
      data-testid={`solicitud-credito-${solicitud.id}`}
    >
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-sm text-slate-800 dark:text-slate-100 truncate">
            {solicitud.razonSocial}
            <span className="ml-2 text-xs font-normal text-slate-400">{solicitud.rut}</span>
          </div>
          <div className="text-[11px] text-slate-400">
            {solicitud.solicitanteNombre ?? "—"} · {fmtFecha(solicitud.createdAt)}
            {solicitud.carpetaTributariaUrl ? (
              <>
                {" · "}
                <a
                  href={solicitud.carpetaTributariaUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-orange-600 font-semibold hover:underline"
                >
                  carpeta tributaria
                </a>
              </>
            ) : (
              " · sin carpeta tributaria"
            )}
          </div>
        </div>

        <div className="text-right">
          <div className="text-[9px] uppercase tracking-wider font-bold text-slate-400">Solicitado</div>
          <div className="text-sm font-bold tabular-nums text-slate-700 dark:text-slate-200">
            {money(solicitud.creditoSolicitado)}
          </div>
        </div>

        {solicitud.creditoAprobado != null && (
          <div className="text-right">
            <div className="text-[9px] uppercase tracking-wider font-bold text-slate-400">Aprobado</div>
            <div className="text-sm font-bold tabular-nums text-emerald-600">{money(solicitud.creditoAprobado)}</div>
          </div>
        )}

        <Badge variant="outline" className={`text-[10px] font-bold ${BADGE_ESTADO[solicitud.estado] ?? ""}`}>
          {solicitud.estado}
        </Badge>

        {puedeResolver && (
          <Button
            variant="outline"
            size="sm"
            className="h-8 rounded-lg text-xs"
            onClick={() => setAbierto((v) => !v)}
            data-testid={`button-resolver-${solicitud.id}`}
          >
            Resolver
          </Button>
        )}
      </div>

      {solicitud.observaciones && (
        <p className="mt-2 text-xs text-slate-500 border-t border-slate-100 dark:border-slate-700/40 pt-2">
          {solicitud.observaciones}
          {solicitud.resueltaPorNombre && (
            <span className="text-slate-400"> · {solicitud.resueltaPorNombre}</span>
          )}
        </p>
      )}

      {abierto && puedeResolver && (
        <div className="mt-3 border-t border-slate-100 dark:border-slate-700/40 pt-3 space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Input
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              type="number"
              placeholder="Monto aprobado"
              className="h-9 rounded-xl text-sm"
              data-testid={`input-credito-aprobado-${solicitud.id}`}
            />
            <Textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={1}
              placeholder="Observaciones (obligatorias si se rechaza)"
              className="min-h-[36px] resize-none rounded-xl text-sm"
              data-testid={`input-credito-observaciones-${solicitud.id}`}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={resolviendo || !motivo.trim()}
              className="h-8 rounded-lg text-xs border-red-200 text-red-700 hover:bg-red-50"
              onClick={() => onResolver({ estado: "rechazada", observaciones: motivo.trim() })}
            >
              <X className="h-3.5 w-3.5 mr-1" /> Rechazar
            </Button>
            <Button
              size="sm"
              disabled={resolviendo || Number(monto) <= 0}
              className="h-8 rounded-lg text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() =>
                onResolver({
                  estado: "aprobada",
                  creditoAprobado: Number(monto),
                  observaciones: motivo.trim() || null,
                })
              }
            >
              <Check className="h-3.5 w-3.5 mr-1" /> Aprobar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
