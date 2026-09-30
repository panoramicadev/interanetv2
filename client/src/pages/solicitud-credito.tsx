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
 *
 * Se pide de dos formas: «Nueva solicitud», con los datos completos de un cliente
 * que todavía no tiene crédito, y «Aumento de crédito», para subirle la línea a
 * uno que ya compra (pedido del gerente comercial, sep-2026). Las dos llegan a
 * la misma bandeja y Finanzas las resuelve igual.
 */
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TABS_LIST_PILL, TAB_PILL } from "@/components/gastos/tabs-pill";
import { useCredito } from "@/components/clients/credito-panel";
import {
  AlertTriangle,
  Banknote,
  Building2,
  Check,
  Clock,
  FileSpreadsheet,
  FileText,
  Loader2,
  Paperclip,
  Search,
  Send,
  TrendingUp,
  Upload,
  Users,
  X,
} from "lucide-react";
import { DIAS_SOLICITUD_CREDITO } from "@shared/schema";
import { descargarSolicitudCreditoPdf } from "@/lib/solicitud-credito-pdf";
import {
  descargarCarpetaTributaria,
  descargarSolicitudCreditoCsv,
} from "@/lib/solicitud-credito-descargas";
import { esAumento, lineaActual } from "@/lib/solicitud-credito-datos";
import type { SolicitudCredito } from "@shared/schema";

const ROLES_RESUELVEN = ["admin", "supervisor", "encargado_area", "recursos_humanos"];
/**
 * Recepción marca "analizando" y nada más: recibe las carpetas y avisa que la
 * solicitud está en revisión, pero el monto lo decide Finanzas. Ve el panel de
 * resolución sin los botones de aprobar y rechazar ni el campo del monto.
 */
const ROLES_SOLO_ANALIZAN = ["reception"];

const FORM_VACIO = {
  razonSocial: "",
  rut: "",
  direccion: "",
  ciudad: "",
  telefono: "",
  giro: "",
  // Dos correos separados: por el de cobranza se cobra, al de DTE le llegan las
  // facturas electrónicas. El del SII es el que no puede faltar.
  correo: "",
  correoDte: "",
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
  // Sin plazo elegido a propósito: si viniera uno puesto, el vendedor lo manda
  // sin mirarlo y la solicitud sale con un plazo que nadie decidió.
  diasSolicitados: "",
};

type FormSolicitud = typeof FORM_VACIO;

const money = (valor: unknown) => {
  const n = Number(valor ?? 0);
  return Number.isFinite(n) ? `$${Math.round(n).toLocaleString("es-CL")}` : "—";
};

/** Deja solo los dígitos: es lo que se guarda y lo que se manda al servidor. */
const soloDigitos = (valor: string) => valor.replace(/\D/g, "").replace(/^0+(?=\d)/, "");

/**
 * Monto que se quiere decir con lo tipeado. Un crédito nunca es de pocos miles
 * de pesos, así que lo corto se lee en miles: 600 → $600.000 y 1000 → $1.000.000.
 * Desde 10.000 se toma tal cual (500000 → $500.000). Se muestra siempre el
 * resultado para que no haya sorpresas.
 */
const montoAprobado = (digitos: string) => {
  const n = Number(digitos);
  if (!n) return 0;
  return n < 10000 ? n * 1000 : n;
};

/** Lo que se ve mientras se escribe: $2.000.000. Vacío se queda vacío. */
const montoVisible = (digitos: string) =>
  digitos ? `$${Number(digitos).toLocaleString("es-CL")}` : "";

const fmtFecha = (valor: string | Date | null | undefined) => {
  if (!valor) return "—";
  const d = new Date(valor as any);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("es-CL");
};

const BADGE_ESTADO: Record<string, string> = {
  enviada: "bg-amber-100 text-amber-700 border-amber-200",
  // "analizando" es un paso intermedio, no un cierre: sigue en la bandeja.
  analizando: "bg-yellow-100 text-yellow-800 border-yellow-300",
  aprobada: "bg-emerald-100 text-emerald-700 border-emerald-200",
  rechazada: "bg-red-100 text-red-700 border-red-200",
};

export default function SolicitudCreditoPage() {
  return <SolicitudCreditoContent />;
}

/**
 * El formulario y su función para escribir en él, compartidos con los campos.
 *
 * ⚠️ `Campo` y `Seccion` TIENEN que vivir acá afuera, no dentro de
 * SolicitudCreditoContent. Cuando estaban definidos adentro, React los tomaba como
 * componentes nuevos en cada render: con cada tecla desmontaba el input y montaba otro
 * en su lugar, el foco se perdía y no se podía escribir en ningún campo del formulario
 * (reporte del usuario, sep-2026). Se pasan por contexto para no tener que arrastrar
 * `form` y `campo` como props en los veinte campos.
 */
const FormularioCreditoCtx = createContext<{
  form: FormSolicitud;
  campo: (k: keyof FormSolicitud, valor: string) => void;
} | null>(null);

function Campo({
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
}) {
  const ctx = useContext(FormularioCreditoCtx);
  if (!ctx) return null;
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1">
        {label} {obligatorio && <span className="text-[#fd6301]">obligatorio</span>}
      </div>
      <Input
        value={ctx.form[k]}
        onChange={(e) => ctx.campo(k, e.target.value)}
        placeholder={placeholder}
        type={tipo}
        className="h-9 rounded-xl text-sm"
        data-testid={`input-credito-${k}`}
      />
    </div>
  );
}

function Seccion({
  icono,
  titulo,
  children,
}: {
  icono: React.ReactNode;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200/70 dark:border-slate-700/60 bg-white dark:bg-slate-900/40 p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
        <span className="w-7 h-7 rounded-lg bg-[#fd6301] text-white dark:text-white flex items-center justify-center shadow-md shadow-[#fd6301]/25">
          {icono}
        </span>
        {titulo}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>
    </div>
  );
}

/** Rótulo de un campo, con la marca de obligatorio cuando corresponde. */
function Etiqueta({ texto, obligatorio }: { texto: string; obligatorio?: boolean }) {
  return (
    <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1">
      {texto} {obligatorio && <span className="text-[#fd6301]">obligatorio</span>}
    </div>
  );
}

/**
 * Plazos fijos en chips: son pocos y se eligen de un toque, así se ven todas las
 * opciones sin abrir nada. Los usan la solicitud nueva y el aumento.
 */
function ChipsDias({
  valor,
  onElegir,
  prefijoTestId = "",
}: {
  valor: string;
  onElegir: (dias: string) => void;
  prefijoTestId?: string;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {DIAS_SOLICITUD_CREDITO.map((dias) => {
        const activo = Number(valor) === dias;
        return (
          <button
            key={dias}
            type="button"
            onClick={() => onElegir(String(dias))}
            aria-pressed={activo}
            className={`h-9 px-4 rounded-xl text-xs font-bold tabular-nums border transition-all ${
              activo
                ? "bg-[#fd6301] text-white border-[#fd6301] shadow-sm shadow-[#fd6301]/25"
                : "bg-white dark:bg-slate-900/40 text-slate-600 dark:text-slate-300 border-slate-200/70 dark:border-slate-700/60 hover:border-[#fd6301]/50 hover:text-[#fd6301]"
            }`}
            data-testid={`chip-${prefijoTestId}dias-${dias}`}
          >
            {dias} días
          </button>
        );
      })}
    </div>
  );
}

type CarpetaAdjunta = { url: string; nombre: string };

/**
 * La carpeta tributaria, el adjunto con el que Finanzas evalúa. Es la misma en la
 * solicitud nueva y en el aumento: sube por el mismo /api/upload que el resto de
 * los adjuntos, y `onSubiendo` le avisa al formulario para que no se envíe con el
 * archivo a medio subir.
 */
function CarpetaTributaria({
  carpeta,
  onCarpeta,
  subiendo,
  onSubiendo,
  prefijoTestId = "",
}: {
  carpeta: CarpetaAdjunta | null;
  onCarpeta: (carpeta: CarpetaAdjunta | null) => void;
  subiendo: boolean;
  onSubiendo: (subiendo: boolean) => void;
  prefijoTestId?: string;
}) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const subir = async (file: File) => {
    onSubiendo(true);
    try {
      const datos = new FormData();
      datos.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: datos, credentials: "include" });
      if (!res.ok) throw new Error("No se pudo subir el archivo");
      const json = await res.json();
      const url = json.fileUrl || json.url;
      if (!url) throw new Error("El servidor no devolvió la ubicación del archivo");
      onCarpeta({ url, nombre: file.name });
    } catch (error: any) {
      toast({ title: "No se pudo adjuntar la carpeta", description: error?.message, variant: "destructive" });
    } finally {
      onSubiendo(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div>
      <Etiqueta texto="Carpeta tributaria" />
      <input
        ref={fileRef}
        type="file"
        className="hidden"
        accept=".pdf,.zip,.rar,.jpg,.jpeg,.png,.xlsx,.xls"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void subir(file);
        }}
        data-testid={`input-${prefijoTestId}carpeta-tributaria`}
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
            onClick={() => onCarpeta(null)}
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
          data-testid={`button-${prefijoTestId}adjuntar-carpeta`}
        >
          {subiendo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          {subiendo ? "Subiendo…" : "Adjuntar carpeta tributaria"}
        </Button>
      )}
    </div>
  );
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
  const [carpeta, setCarpeta] = useState<CarpetaAdjunta | null>(null);
  const [subiendo, setSubiendo] = useState(false);

  const soloAnaliza = ROLES_SOLO_ANALIZAN.includes(user?.role ?? "");
  const puedeResolver = ROLES_RESUELVEN.includes(user?.role ?? "") || soloAnaliza;

  const { data: solicitudes = [], isLoading } = useQuery<SolicitudCredito[]>({
    queryKey: ["/api/solicitudes-credito"],
    queryFn: async () => {
      const res = await apiRequest("/api/solicitudes-credito");
      return res.json();
    },
  });

  /**
   * Las solicitudes viven en dos pestañas distintas según si ya se cerraron.
   *
   * "Solicitudes" es la bandeja de trabajo: solo lo que sigue esperando
   * respuesta. "Estado" es el archivo de lo ya resuelto —aprobado o
   * rechazado—. Mezclarlas hacía que la bandeja creciera para siempre y que
   * lo pendiente se perdiera entre cierres viejos.
   */
  // Solo lo pendiente lleva número: es lo que le queda a alguien por hacer.
  // Los cierres no se cuentan — nadie tiene que actuar sobre ellos.
  const ESTADOS_PENDIENTES = ["enviada", "analizando"];
  const pendientes = solicitudes.filter((s) => ESTADOS_PENDIENTES.includes(s.estado));
  const resueltas = solicitudes.filter((s) => !ESTADOS_PENDIENTES.includes(s.estado));

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
    onSuccess: (actualizada: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/solicitudes-credito"] });
      toast({
        title:
          actualizada?.estado === "analizando"
            ? "Solicitud marcada en análisis"
            : "Solicitud resuelta",
      });
    },
    onError: (error: any) => {
      toast({ title: "No se pudo resolver", description: error?.message, variant: "destructive" });
    },
  });

  const campo = (k: keyof FormSolicitud, valor: string) => setForm((p) => ({ ...p, [k]: valor }));

  const obligatoriosOk =
    form.razonSocial.trim() &&
    form.rut.trim() &&
    form.direccion.trim() &&
    form.ciudad.trim() &&
    form.telefono.trim() &&
    form.correoDte.trim() &&
    Number(form.creditoSolicitado) > 0 &&
    Number(form.diasSolicitados) > 0;

  const enviarSolicitud = () => {
    if (!obligatoriosOk) {
      toast({
        title: "Faltan datos",
        description:
          "Razón social, RUT, dirección, ciudad, teléfono, correo DTE, crédito solicitado y plazo son obligatorios.",
        variant: "destructive",
      });
      return;
    }
    enviar.mutate({
      ...form,
      tipo: "nueva",
      correo: form.correo.trim() || null,
      correoDte: form.correoDte.trim(),
      creditoSolicitado: Number(form.creditoSolicitado),
      diasSolicitados: Number(form.diasSolicitados),
      carpetaTributariaUrl: carpeta?.url ?? null,
      carpetaTributariaNombre: carpeta?.nombre ?? null,
    });
  };

  return (
    <FormularioCreditoCtx.Provider value={{ form, campo }}>
    <div className={embedded ? "space-y-4 max-w-5xl" : "p-3 sm:p-5 space-y-4 max-w-5xl mx-auto"}>
      {embedded ? null : (
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-orange-500 to-[#fd6301] text-white flex items-center justify-center">
              <Banknote className="h-4 w-4" />
            </span>
            Solicitud de Crédito
          </h1>
        </div>
      )}

      <Tabs defaultValue="nueva">
        <TabsList className={TABS_LIST_PILL}>
          <TabsTrigger value="nueva" className={TAB_PILL} data-testid="tab-credito-nueva">
            Nueva solicitud
          </TabsTrigger>
          <TabsTrigger value="aumento" className={TAB_PILL} data-testid="tab-credito-aumento">
            Aumento de crédito
          </TabsTrigger>
          <TabsTrigger value="historial" className={TAB_PILL} data-testid="tab-credito-historial">
            Solicitudes
            {pendientes.length > 0 && (
              <span className="tabular-nums opacity-70">{pendientes.length}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="estado" className={TAB_PILL} data-testid="tab-credito-estado">
            Estado
          </TabsTrigger>
        </TabsList>

        <TabsContent value="nueva" className="mt-4 space-y-3">
          <Seccion icono={<Building2 className="h-3.5 w-3.5" />} titulo="Datos de la empresa">
            <Campo k="razonSocial" label="Razón social" obligatorio placeholder="Constructora ..." />
            <Campo k="rut" label="RUT" obligatorio placeholder="76.123.456-7" />
            <Campo k="direccion" label="Dirección" obligatorio />
            <Campo k="ciudad" label="Ciudad" obligatorio />
            <Campo k="telefono" label="Teléfono" obligatorio placeholder="+56 9 ..." />
            <Campo k="giro" label="Giro" />
            {/* En el teléfono, tipo email cambia el teclado: aparece la arroba. */}
            <Campo k="correo" label="Correo cobranza" placeholder="cobranza@empresa.cl" tipo="email" />
            <Campo
              k="correoDte"
              label="Correo receptor DTE (SII)"
              obligatorio
              placeholder="dte@empresa.cl"
              tipo="email"
            />
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
              <span className="w-7 h-7 rounded-lg bg-[#fd6301] text-white dark:text-white flex items-center justify-center shadow-md shadow-[#fd6301]/25">
                <FileText className="h-3.5 w-3.5" />
              </span>
              Crédito y carpeta tributaria
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-3">
                {/* El monto se escribe en pesos y se va separando solo mientras
                    se tipea ($2.000.000). Por dentro viaja el número pelado. */}
                <div>
                  <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1">
                    Crédito solicitado <span className="text-[#fd6301]">obligatorio</span>
                  </div>
                  <Input
                    value={montoVisible(form.creditoSolicitado)}
                    onChange={(e) => campo("creditoSolicitado", soloDigitos(e.target.value))}
                    placeholder="$0"
                    type="text"
                    inputMode="numeric"
                    className="h-9 rounded-xl text-sm font-semibold tabular-nums"
                    data-testid="input-credito-creditoSolicitado"
                  />
                </div>

                <div>
                  <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1">
                    Días solicitados <span className="text-[#fd6301]">obligatorio</span>
                  </div>
                  <ChipsDias valor={form.diasSolicitados} onElegir={(dias) => campo("diasSolicitados", dias)} />
                </div>
              </div>

              <CarpetaTributaria
                carpeta={carpeta}
                onCarpeta={setCarpeta}
                subiendo={subiendo}
                onSubiendo={setSubiendo}
              />
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

        {/* Montada siempre y escondida cuando no es la activa: así un aumento a
            medio llenar sobrevive a ir a mirar las Solicitudes, igual que la
            solicitud nueva, cuyo estado vive en este componente. */}
        <TabsContent value="aumento" forceMount className="mt-4 data-[state=inactive]:hidden">
          <AumentoCredito />
        </TabsContent>

        <TabsContent value="historial" className="mt-4">
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-slate-400 py-8 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
            </div>
          ) : pendientes.length === 0 ? (
            <p className="text-sm text-slate-400 py-10 text-center">
              No hay solicitudes esperando respuesta.
              {resueltas.length > 0 && " Las que ya se cerraron están en Estado."}
            </p>
          ) : (
            <div className="space-y-2">
              {pendientes.map((s) => (
                <FilaSolicitud
                  key={s.id}
                  solicitud={s}
                  puedeResolver={puedeResolver}
                  soloAnaliza={soloAnaliza}
                  resolviendo={resolver.isPending}
                  onResolver={(datos) => resolver.mutate({ id: s.id, datos })}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="estado" className="mt-4">
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-slate-400 py-8 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
            </div>
          ) : resueltas.length === 0 ? (
            <p className="text-sm text-slate-400 py-10 text-center">
              Todavía no hay solicitudes aprobadas ni rechazadas.
            </p>
          ) : (
            <div className="space-y-2">
              {resueltas.map((s) => (
                <FilaSolicitud
                  key={s.id}
                  solicitud={s}
                  puedeResolver={false}
                  soloAnaliza={soloAnaliza}
                  resolviendo={resolver.isPending}
                  onResolver={(datos) => resolver.mutate({ id: s.id, datos })}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
    </FormularioCreditoCtx.Provider>
  );
}

/** Un cliente del buscador (/api/clients/search, sin filtros de ventas). */
interface ClienteBuscado {
  id: string;
  nokoen: string;
  koen?: string | null;
  rten?: string | null;
  email?: string | null;
  foen?: string | null;
  dien?: string | null;
  comuna?: string | null;
  /** Cadena a la que pertenece la sucursal ("REDMAT"), cuando es una. */
  cadena?: string;
}

/**
 * La misma validación de correo que aplica el servidor. En la ficha del ERP hay
 * "NO TIENE" o dos direcciones juntas: eso no se prellena, porque el servidor
 * rechazaría la solicitud entera.
 */
const esCorreo = (valor: string) => z.string().email().safeParse(valor.trim()).success;

/** Una cifra del crédito del cliente, en el resumen del aumento. */
function CifraCredito({
  label,
  valor,
  detalle,
  alerta,
}: {
  label: string;
  valor: string;
  detalle?: string | null;
  alerta?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-200/70 dark:border-slate-700/60 bg-slate-50/60 dark:bg-slate-800/40 px-3 py-2">
      <div className="text-[9px] uppercase tracking-wider font-bold text-slate-400">{label}</div>
      <div
        className={`text-sm font-bold tabular-nums leading-tight ${
          alerta ? "text-red-600 dark:text-red-400" : "text-slate-800 dark:text-slate-100"
        }`}
      >
        {valor}
      </div>
      {detalle && <div className="text-[10px] text-slate-400 truncate">{detalle}</div>}
    </div>
  );
}

/**
 * Aumento de crédito: subirle la línea a un cliente que ya compra.
 *
 * No repite la ficha entera como una solicitud nueva: Finanzas ya conoce al
 * cliente. Se busca en la base, se ve con qué línea y qué deuda está hoy, y se
 * pide la línea nueva, el plazo y el porqué. Dirección, ciudad y teléfono
 * viajan desde la ficha tal como estén.
 *
 * Va aparte de SolicitudCreditoContent, con su propio estado y su propio envío:
 * mandar un aumento no tiene que borrar una solicitud nueva a medio llenar.
 */
function AumentoCredito() {
  const { toast } = useToast();
  const [busqueda, setBusqueda] = useState("");
  const [termino, setTermino] = useState("");
  const [cliente, setCliente] = useState<ClienteBuscado | null>(null);
  const [linea, setLinea] = useState("");
  // null = todavía no se eligió: rige el plazo que el cliente ya tiene, si es
  // uno de los que se ofrecen.
  const [dias, setDias] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");
  // null = el correo de la ficha; lo que se escriba lo reemplaza.
  const [correo, setCorreo] = useState<string | null>(null);
  const [correoDte, setCorreoDte] = useState("");
  const [rutEscrito, setRutEscrito] = useState("");
  const [carpeta, setCarpeta] = useState<CarpetaAdjunta | null>(null);
  const [subiendo, setSubiendo] = useState(false);

  // Se busca cuando se deja de tipear, no con cada letra.
  useEffect(() => {
    const t = setTimeout(() => setTermino(busqueda.trim()), 300);
    return () => clearTimeout(t);
  }, [busqueda]);

  const { data: resultados = [], isFetching: buscando } = useQuery<ClienteBuscado[]>({
    queryKey: ["/api/clients/search", "solicitud-credito", termino],
    queryFn: async () => {
      const res = await apiRequest(`/api/clients/search?q=${encodeURIComponent(termino)}`);
      return res.json();
    },
    enabled: !cliente && termino.length >= 2,
  });

  // La misma consulta que la pestaña Crédito de la ficha: la línea, la deuda y
  // el vencido que ve el vendedor son los que ve Finanzas en el cliente.
  const credito = useCredito(cliente?.nokoen, cliente?.rten);
  const ficha = credito.data?.client ?? null;
  const cupo = credito.data?.credit ?? null;

  const lineaHoy = cupo?.limit ?? null; // null = sin línea
  const solicitada = Number(linea) || 0;
  const noSube = !!lineaHoy && solicitada > 0 && solicitada <= lineaHoy;
  const diasHoy = ficha?.creditDays != null ? Math.round(ficha.creditDays) : null;
  const diasElegidos =
    dias ?? (diasHoy && (DIAS_SOLICITUD_CREDITO as readonly number[]).includes(diasHoy) ? String(diasHoy) : "");
  const rutFicha = ficha?.rut?.trim() || cliente?.rten?.trim() || "";
  const rut = rutFicha || rutEscrito.trim();
  const correoFicha = cliente?.email && esCorreo(cliente.email) ? cliente.email.trim() : "";
  const correoCobranza = correo ?? correoFicha;

  /** Vuelve a empezar: al cambiar de cliente, nada de lo escrito para el otro sirve. */
  const limpiar = () => {
    setCliente(null);
    setLinea("");
    setDias(null);
    setMotivo("");
    setCorreo(null);
    setCorreoDte("");
    setRutEscrito("");
    setCarpeta(null);
  };

  const enviar = useMutation({
    mutationFn: async (datos: Record<string, unknown>) => {
      const res = await apiRequest("/api/solicitudes-credito", { method: "POST", data: datos });
      return res.json();
    },
    onSuccess: () => {
      limpiar();
      setBusqueda("");
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

  const enviarAumento = () => {
    if (!cliente || !cupo) return;
    if (noSube) {
      toast({
        title: "La línea solicitada tiene que ser mayor que la actual",
        description: `Hoy tiene ${money(lineaHoy)}.`,
        variant: "destructive",
      });
      return;
    }
    if (!rut || solicitada <= 0 || !Number(diasElegidos) || !motivo.trim()) {
      toast({
        title: "Faltan datos",
        description: `${rut ? "" : "La ficha no tiene RUT: escríbelo. "}La nueva línea, el plazo y el motivo del aumento son obligatorios.`,
        variant: "destructive",
      });
      return;
    }
    if (correoCobranza.trim() && !esCorreo(correoCobranza)) {
      toast({ title: "Revisa el correo de cobranza", variant: "destructive" });
      return;
    }
    if (correoDte.trim() && !esCorreo(correoDte)) {
      toast({ title: "Revisa el correo DTE", variant: "destructive" });
      return;
    }
    enviar.mutate({
      tipo: "aumento",
      clienteId: ficha?.id ?? cliente.id,
      razonSocial: ficha?.name?.trim() || cliente.nokoen,
      rut,
      direccion: ficha?.address ?? cliente.dien ?? null,
      // Sin ciudad en la ficha, la comuna ubica igual al cliente.
      ciudad: ficha?.city ?? ficha?.comuna ?? cliente.comuna ?? null,
      telefono: ficha?.phone ?? cliente.foen ?? null,
      correo: correoCobranza.trim() || null,
      correoDte: correoDte.trim() || null,
      // La foto de hoy: desde dónde se sube. Con la línea nueva la ficha cambia.
      creditoActual: lineaHoy,
      diasActuales: diasHoy,
      creditoSolicitado: solicitada,
      diasSolicitados: Number(diasElegidos),
      motivo: motivo.trim(),
      carpetaTributariaUrl: carpeta?.url ?? null,
      carpetaTributariaNombre: carpeta?.nombre ?? null,
    });
  };

  const escribiendo = busqueda.trim();

  return (
    <div className="space-y-3">
      <Seccion icono={<Building2 className="h-3.5 w-3.5" />} titulo="Cliente">
        {!cliente ? (
          <div className="sm:col-span-2 space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
              <Input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Nombre, RUT o código del cliente…"
                className="h-9 pl-9 pr-9 rounded-xl text-sm"
                data-testid="input-aumento-buscar-cliente"
              />
              {buscando && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-slate-300" />
              )}
            </div>
            <div className="max-h-72 overflow-y-auto">
              {escribiendo.length < 2 ? (
                <p className="py-4 text-center text-xs text-slate-400">
                  Busca al cliente para ver su línea de hoy y pedir el aumento.
                </p>
              ) : termino === escribiendo && !buscando && resultados.length === 0 ? (
                <p className="py-4 text-center text-xs text-slate-400">Sin resultados.</p>
              ) : (
                resultados.slice(0, 20).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCliente(c)}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-orange-50/60 dark:hover:bg-orange-950/20 transition-colors"
                    data-testid={`option-aumento-cliente-${c.id}`}
                  >
                    <Building2 className="h-3.5 w-3.5 text-[#fd6301] flex-shrink-0" />
                    <span className="truncate flex-1 min-w-0">
                      {c.nokoen}
                      {c.cadena && <span className="font-normal text-slate-400"> · {c.cadena}</span>}
                    </span>
                    {(c.rten || c.comuna) && (
                      <span className="text-[11px] font-normal text-slate-400 truncate max-w-[40%] flex-shrink-0">
                        {c.rten || c.comuna}
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        ) : (
          <div className="sm:col-span-2 space-y-3">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-sm text-slate-800 dark:text-slate-100 truncate">
                  {ficha?.name ?? cliente.nokoen}
                </div>
                <div className="text-[11px] text-slate-400 truncate">
                  {[rutFicha && `RUT ${rutFicha}`, ficha?.clientCode ?? cliente.koen, cliente.cadena]
                    .filter(Boolean)
                    .join(" · ") || "Sin RUT en la ficha"}
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-8 rounded-lg text-xs flex-shrink-0"
                onClick={limpiar}
                data-testid="button-aumento-cambiar-cliente"
              >
                Cambiar
              </Button>
            </div>

            {credito.isLoading ? (
              <div className="flex items-center gap-2 py-2 text-xs text-slate-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Cargando la línea del cliente…
              </div>
            ) : !cupo ? (
              <div className="flex items-center gap-2 py-2 text-xs text-red-600">
                No se pudo cargar el crédito del cliente.
                <button
                  type="button"
                  onClick={() => credito.refetch()}
                  className="font-semibold underline"
                >
                  Reintentar
                </button>
              </div>
            ) : (
              <>
                {/* Lo que Finanzas va a mirar antes de subir la línea: cuánto
                    tiene, cuánto usa y si está al día. */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <CifraCredito
                    label="Línea actual"
                    valor={lineaHoy ? money(lineaHoy) : "Sin línea en el ERP"}
                    detalle={cupo.limitSource === "manual" ? "Fijada a mano en la intranet" : null}
                  />
                  <CifraCredito label="Usado" valor={money(cupo.used)} />
                  <CifraCredito
                    label="Disponible"
                    valor={
                      cupo.available == null
                        ? "—"
                        : cupo.available < 0
                          ? `-${money(-cupo.available)}`
                          : money(cupo.available)
                    }
                    detalle={cupo.exceeded ? "Excedido" : null}
                    alerta={cupo.exceeded}
                  />
                  <CifraCredito
                    label="Días de crédito"
                    valor={diasHoy ? `${diasHoy} días` : "—"}
                    detalle={ficha?.paymentCondition}
                  />
                </div>
                {cupo.overdue > 0 && (
                  <div className="flex items-center gap-2 rounded-xl border border-red-200/70 bg-red-50/60 dark:border-red-900/40 dark:bg-red-950/30 px-3 py-2 text-xs text-red-700 dark:text-red-300">
                    <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                    <span>
                      Tiene <span className="font-bold tabular-nums">{money(cupo.overdue)}</span> vencido
                      {cupo.oldestOverdueDays ? `, lo más antiguo hace ${cupo.oldestOverdueDays} días` : ""}.
                    </span>
                  </div>
                )}
              </>
            )}

            {/* Las sucursales de una cadena pueden no tener el RUT en su ficha, y
                sin RUT Finanzas no sabe a quién le sube la línea. */}
            {cupo && !rutFicha && (
              <div className="sm:w-1/2">
                <Etiqueta texto="RUT" obligatorio />
                <Input
                  value={rutEscrito}
                  onChange={(e) => setRutEscrito(e.target.value)}
                  placeholder="76.123.456-7"
                  className="h-9 rounded-xl text-sm"
                  data-testid="input-aumento-rut"
                />
              </div>
            )}
          </div>
        )}
      </Seccion>

      {cliente && (
        <Seccion icono={<TrendingUp className="h-3.5 w-3.5" />} titulo="Aumento solicitado">
          <div className="space-y-3">
            <div>
              <Etiqueta texto="Nueva línea solicitada" obligatorio />
              <Input
                value={montoVisible(linea)}
                onChange={(e) => setLinea(soloDigitos(e.target.value))}
                placeholder="$0"
                type="text"
                inputMode="numeric"
                className="h-9 rounded-xl text-sm font-semibold tabular-nums"
                data-testid="input-aumento-linea"
              />
              {/* Se pide la línea total, no lo que se suma: la diferencia a la
                  vista evita que alguien escriba solo el aumento. */}
              <p className="mt-1 pl-1 text-[11px] text-slate-400" data-testid="text-aumento-diferencia">
                {solicitada <= 0 ? (
                  "La línea total que quedaría, no lo que se suma."
                ) : noSube ? (
                  <span className="font-semibold text-red-600">
                    La línea solicitada tiene que ser mayor que la actual
                  </span>
                ) : lineaHoy ? (
                  <>
                    <span className="font-semibold tabular-nums text-[#fd6301]">
                      +{money(solicitada - lineaHoy)}
                    </span>{" "}
                    sobre la actual
                  </>
                ) : (
                  "Hoy no tiene línea: se pide desde cero."
                )}
              </p>
            </div>
            <div>
              <Etiqueta texto="Días solicitados" obligatorio />
              <ChipsDias valor={diasElegidos} onElegir={setDias} prefijoTestId="aumento-" />
            </div>
          </div>

          <div className="space-y-3">
            <CarpetaTributaria
              carpeta={carpeta}
              onCarpeta={setCarpeta}
              subiendo={subiendo}
              onSubiendo={setSubiendo}
              prefijoTestId="aumento-"
            />
            <div>
              <Etiqueta texto="Correo cobranza" />
              <Input
                value={correoCobranza}
                onChange={(e) => setCorreo(e.target.value)}
                placeholder="cobranza@empresa.cl"
                type="email"
                className="h-9 rounded-xl text-sm"
                data-testid="input-aumento-correo"
              />
            </div>
            <div>
              <Etiqueta texto="Correo receptor DTE (SII)" />
              <Input
                value={correoDte}
                onChange={(e) => setCorreoDte(e.target.value)}
                placeholder="dte@empresa.cl"
                type="email"
                className="h-9 rounded-xl text-sm"
                data-testid="input-aumento-correoDte"
              />
            </div>
          </div>

          <div className="sm:col-span-2">
            <Etiqueta texto="Motivo del aumento" obligatorio />
            <Textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
              placeholder="Por qué necesita más línea: compra más que antes, abrió otro local, tiene una obra nueva…"
              className="resize-none rounded-xl text-sm"
              data-testid="input-aumento-motivo"
            />
          </div>

          <div className="sm:col-span-2 flex justify-end">
            <Button
              onClick={enviarAumento}
              disabled={enviar.isPending || subiendo || !cupo}
              className="h-9 rounded-xl bg-gradient-to-r from-orange-500 to-[#fd6301] hover:from-[#e35400] hover:to-[#e35400] text-white text-sm font-semibold"
              data-testid="button-submit-aumento"
            >
              {enviar.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Enviar solicitud
            </Button>
          </div>
        </Seccion>
      )}
    </div>
  );
}

/**
 * Botón de descarga de la fila. Los tres se ven igual y se comportan igual:
 * cambian el icono por un spinner mientras bajan y quedan bloqueados entre sí,
 * para que no se disparen dos descargas encima.
 */
function Descarga({
  etiqueta,
  titulo,
  icono,
  cargando,
  deshabilitado,
  testId,
  onClick,
}: {
  etiqueta: string;
  titulo: string;
  icono: React.ReactNode;
  cargando: boolean;
  deshabilitado: boolean;
  testId: string;
  onClick: () => void;
}) {
  return (
    <Button
      variant="outline"
      size="sm"
      title={titulo}
      aria-label={titulo}
      disabled={deshabilitado}
      className="h-8 rounded-lg text-xs gap-1.5"
      onClick={onClick}
      data-testid={testId}
    >
      {cargando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : icono}
      {etiqueta}
    </Button>
  );
}

/** Una solicitud del listado, con la resolución de Finanzas cuando corresponde. */
function FilaSolicitud({
  solicitud,
  puedeResolver,
  soloAnaliza,
  resolviendo,
  onResolver,
}: {
  solicitud: SolicitudCredito;
  puedeResolver: boolean;
  soloAnaliza: boolean;
  resolviendo: boolean;
  onResolver: (datos: Record<string, unknown>) => void;
}) {
  const { toast } = useToast();
  const [abierto, setAbierto] = useState(false);
  const [detalle, setDetalle] = useState(false);
  const [bajando, setBajando] = useState<null | "pdf" | "carpeta" | "csv">(null);
  const [monto, setMonto] = useState("");
  // Arranca con el plazo pedido; Finanzas lo cambia si aprueba otro.
  const [dias, setDias] = useState(solicitud.diasSolicitados ? String(solicitud.diasSolicitados) : "");
  const [motivo, setMotivo] = useState("");
  const aumento = esAumento(solicitud);

  /** Las tres descargas se comportan igual: spinner mientras baja, aviso si falla. */
  const bajar = async (
    cual: "pdf" | "carpeta" | "csv",
    tituloError: string,
    hacer: () => Promise<void>,
  ) => {
    setBajando(cual);
    try {
      await hacer();
    } catch (error: any) {
      toast({ title: tituloError, description: error?.message, variant: "destructive" });
    } finally {
      setBajando(null);
    }
  };

  const dato = (label: string, valor: React.ReactNode, clase = "") => (
    <div className={clase}>
      <div className="text-[9px] uppercase tracking-wider font-bold text-slate-400">{label}</div>
      <div className="text-xs text-slate-700 dark:text-slate-200 break-words">{valor || "—"}</div>
    </div>
  );

  return (
    <div
      className="rounded-2xl border border-slate-200/70 dark:border-slate-700/60 bg-white dark:bg-slate-900/40 px-4 py-3"
      data-testid={`solicitud-credito-${solicitud.id}`}
    >
      <div className="flex flex-wrap items-center gap-3">
        {/* En celular el nombre del cliente se lleva la fila entera (pedido del
            usuario, sep-2026). Compartiendo línea con los montos y el estado le
            quedaban unos pocos píxeles: el nombre salía cortado ("B&A ...") y el
            vendedor bajaba partido en una columna de una palabra por línea. */}
        <div className="w-full min-w-0 sm:w-auto sm:flex-1">
          <div className="flex items-baseline gap-2 min-w-0">
            <span className="font-semibold text-sm text-slate-800 dark:text-slate-100 truncate">
              {solicitud.razonSocial}
            </span>
            <span className="shrink-0 text-xs font-normal text-slate-400">{solicitud.rut}</span>
          </div>
          <div className="text-[11px] text-slate-400 truncate">
            {solicitud.solicitanteNombre ?? "—"} · {fmtFecha(solicitud.createdAt)}
          </div>
          {/* Un aumento se lee desde dónde sube: lo solicitado es la línea total.
              Va en su propia línea y no junto al nombre, que ya compite por el
              ancho con los montos y los botones. */}
          {aumento && (
            <div
              className="mt-0.5 flex items-center gap-1.5 min-w-0 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums"
              title={`Línea actual ${lineaActual(solicitud)} → solicitada ${money(solicitud.creditoSolicitado)}`}
              data-testid={`text-aumento-lineas-${solicitud.id}`}
            >
              <Badge
                variant="outline"
                className="shrink-0 px-1.5 py-0 text-[9px] font-bold uppercase tracking-wider bg-orange-50 text-[#fd6301] border-orange-200 dark:bg-orange-950/30 dark:border-orange-900/40"
                data-testid={`badge-aumento-${solicitud.id}`}
              >
                Aumento
              </Badge>
              <span className="min-w-0 sm:truncate">
                Línea actual{" "}
                <span className="font-semibold text-slate-700 dark:text-slate-200">{lineaActual(solicitud)}</span>
                {" → "}solicitada{" "}
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  {money(solicitud.creditoSolicitado)}
                </span>
              </span>
            </div>
          )}
        </div>

        <div className="text-right">
          <div className="text-[9px] uppercase tracking-wider font-bold text-slate-400">Solicitado</div>
          <div className="text-sm font-bold tabular-nums text-slate-700 dark:text-slate-200">
            {money(solicitud.creditoSolicitado)}
          </div>
          {solicitud.diasSolicitados ? (
            <div className="text-[10px] font-semibold tabular-nums text-slate-400">
              a {solicitud.diasSolicitados} días
            </div>
          ) : null}
        </div>

        {solicitud.creditoAprobado != null && (
          <div className="text-right">
            <div className="text-[9px] uppercase tracking-wider font-bold text-slate-400">Aprobado</div>
            <div className="text-sm font-bold tabular-nums text-emerald-600">{money(solicitud.creditoAprobado)}</div>
            {solicitud.diasAprobados ? (
              <div className="text-[10px] font-semibold tabular-nums text-slate-400">
                a {solicitud.diasAprobados} días
              </div>
            ) : null}
          </div>
        )}

        <Badge variant="outline" className={`text-[10px] font-bold ${BADGE_ESTADO[solicitud.estado] ?? ""}`}>
          {solicitud.estado}
        </Badge>

        <Button
          variant="outline"
          size="sm"
          className="h-8 rounded-lg text-xs"
          onClick={() => setDetalle((v) => !v)}
          data-testid={`button-detalle-${solicitud.id}`}
        >
          {detalle ? "Ocultar" : "Ver datos"}
        </Button>

        {/* Las tres descargas: el PDF para archivar y mandar, la carpeta
            tributaria que subió el vendedor, y el CSV para trabajarla en Excel.
            Van agrupadas para que en el teléfono bajen juntas cuando la fila se
            parte, en vez de quedar una arriba y dos abajo. */}
        <div className="flex items-center gap-1.5">
          <Descarga
            etiqueta="PDF"
            titulo="Descargar la solicitud en PDF"
            icono={<FileText className="h-3.5 w-3.5" />}
            cargando={bajando === "pdf"}
            deshabilitado={bajando !== null}
            testId={`button-pdf-${solicitud.id}`}
            onClick={() =>
              bajar("pdf", "No se pudo generar el PDF", () =>
                descargarSolicitudCreditoPdf(solicitud),
              )
            }
          />
          <Descarga
            etiqueta="Carpeta"
            titulo={
              solicitud.carpetaTributariaUrl
                ? `Descargar la carpeta tributaria${
                    solicitud.carpetaTributariaNombre
                      ? ` (${solicitud.carpetaTributariaNombre})`
                      : ""
                  }`
                : "Esta solicitud se envió sin carpeta tributaria"
            }
            icono={<Paperclip className="h-3.5 w-3.5" />}
            cargando={bajando === "carpeta"}
            deshabilitado={bajando !== null || !solicitud.carpetaTributariaUrl}
            testId={`button-carpeta-${solicitud.id}`}
            onClick={() =>
              bajar("carpeta", "No se pudo bajar la carpeta tributaria", () =>
                descargarCarpetaTributaria(solicitud),
              )
            }
          />
          <Descarga
            etiqueta="CSV"
            titulo="Descargar en CSV para editarlo en Excel"
            icono={<FileSpreadsheet className="h-3.5 w-3.5" />}
            cargando={bajando === "csv"}
            deshabilitado={bajando !== null}
            testId={`button-csv-${solicitud.id}`}
            onClick={() =>
              bajar("csv", "No se pudo generar el CSV", async () =>
                descargarSolicitudCreditoCsv(solicitud),
              )
            }
          />
        </div>

        {puedeResolver && (
          <Button
            variant="outline"
            size="sm"
            className="h-8 rounded-lg text-xs"
            onClick={() => setAbierto((v) => !v)}
            data-testid={`button-resolver-${solicitud.id}`}
          >
            {soloAnaliza ? "Analizar" : "Resolver"}
          </Button>
        )}
      </div>

      {/* Todo lo que se envió en el formulario. La fila sola no alcanzaba para
          revisar una solicitud vieja: los socios, los bancos y el representante
          quedaban guardados pero no había dónde verlos. */}
      {detalle && (
        <div className="mt-3 border-t border-slate-100 dark:border-slate-700/40 pt-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
          {/* Un aumento empieza por el porqué y desde dónde se sube. No trae
              giro, socios, representante ni bancos: no se piden, porque
              Finanzas ya conoce al cliente. */}
          {aumento && (
            <>
              {dato(
                "Motivo del aumento",
                solicitud.motivo ? <span className="whitespace-pre-line">{solicitud.motivo}</span> : null,
                "col-span-2 sm:col-span-3",
              )}
              {dato("Línea actual", lineaActual(solicitud))}
              {dato("Línea solicitada", money(solicitud.creditoSolicitado))}
              {dato("Plazo actual", solicitud.diasActuales ? `${solicitud.diasActuales} días` : null)}
            </>
          )}
          {!aumento && dato("Giro", solicitud.giro)}
          {dato("Teléfono", solicitud.telefono)}
          {dato("Correo cobranza", solicitud.correo)}
          {dato("Correo DTE (SII)", solicitud.correoDte)}
          {dato("Dirección", solicitud.direccion)}
          {dato("Ciudad", solicitud.ciudad)}
          {dato("Plazo solicitado", solicitud.diasSolicitados ? `${solicitud.diasSolicitados} días` : null)}
          {solicitud.diasAprobados ? dato("Plazo aprobado", `${solicitud.diasAprobados} días`) : null}
          {!aumento && (
            <>
              {dato("Representante legal", solicitud.representanteNombre)}
              {dato("Cédula del representante", solicitud.representanteCedula)}
              {dato("Socio 1", solicitud.socio1Nombre)}
              {dato("Dirección socio 1", solicitud.socio1Direccion)}
              {dato("Socio 2", solicitud.socio2Nombre)}
              {dato("Dirección socio 2", solicitud.socio2Direccion)}
              {dato("Banco 1", solicitud.banco1)}
              {dato("Cuenta 1", solicitud.cuenta1)}
              {dato("Sucursal 1", solicitud.sucursal1)}
              {dato("Banco 2", solicitud.banco2)}
              {dato("Cuenta 2", solicitud.cuenta2)}
              {dato("Sucursal 2", solicitud.sucursal2)}
            </>
          )}
          {dato("Resuelta por", solicitud.resueltaPorNombre)}
          {dato("Resuelta el", solicitud.resueltaAt ? fmtFecha(solicitud.resueltaAt) : null)}
        </div>
      )}

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
          <div className={`grid grid-cols-1 gap-2 ${soloAnaliza ? "" : "sm:grid-cols-[1fr_9rem_2fr]"}`}>
            {/* Monto y plazo los decide Finanzas: quien solo analiza no los ve. */}
            {!soloAnaliza && (
              <>
                <div>
                  <Input
                    value={monto}
                    onChange={(e) => setMonto(soloDigitos(e.target.value))}
                    inputMode="numeric"
                    // En un aumento se aprueba la línea total, no lo que se suma.
                    placeholder={aumento ? "Nueva línea aprobada" : "Monto aprobado"}
                    className="h-9 rounded-xl text-sm"
                    data-testid={`input-credito-aprobado-${solicitud.id}`}
                  />
                  {monto && (
                    <div className="mt-1 pl-1 text-[11px] font-semibold tabular-nums text-emerald-600">
                      = {money(montoAprobado(monto))}
                    </div>
                  )}
                </div>
                <Input
                  value={dias}
                  onChange={(e) => setDias(soloDigitos(e.target.value))}
                  inputMode="numeric"
                  placeholder="Días de crédito"
                  className="h-9 rounded-xl text-sm"
                  data-testid={`input-credito-dias-${solicitud.id}`}
                />
              </>
            )}
            <Textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={1}
              placeholder={
                soloAnaliza ? "Observaciones (opcional)" : "Observaciones (obligatorias si se rechaza)"
              }
              className="min-h-[36px] resize-none rounded-xl text-sm"
              data-testid={`input-credito-observaciones-${solicitud.id}`}
            />
          </div>
          <div className="flex justify-end gap-2">
            {/* Analizando: avisa al vendedor que la están mirando sin cerrarla.
                No pide monto ni motivo —todavía no hay decisión— y la solicitud
                queda en la bandeja para aprobarla o rechazarla después. */}
            <Button
              variant="outline"
              size="sm"
              disabled={resolviendo || solicitud.estado === "analizando"}
              className="h-8 rounded-lg text-xs border-yellow-300 text-yellow-800 hover:bg-yellow-50"
              onClick={() =>
                onResolver({ estado: "analizando", observaciones: motivo.trim() || null })
              }
              data-testid={`button-credito-analizando-${solicitud.id}`}
            >
              <Clock className="h-3.5 w-3.5 mr-1" /> Analizando
            </Button>
            {!soloAnaliza && (
              <>
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
                  disabled={resolviendo || montoAprobado(monto) <= 0 || Number(dias) <= 0}
                  className="h-8 rounded-lg text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() =>
                    onResolver({
                      estado: "aprobada",
                      creditoAprobado: montoAprobado(monto),
                      diasAprobados: Number(dias),
                      observaciones: motivo.trim() || null,
                    })
                  }
                >
                  <Check className="h-3.5 w-3.5 mr-1" /> Aprobar
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
