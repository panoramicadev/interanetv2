/**
 * Nuevo Cliente — el vendedor pide el alta, Administración crea el cliente.
 *
 * El formulario no crea el cliente: junta de una sola vez todo lo que hoy se
 * pide por WhatsApp y se pierde (quién recibe la factura, si el XML necesita
 * orden de compra o guía de despacho) y lo manda por correo a Administración
 * con copia al supervisor.
 *
 * Los tres datos que el usuario no tiene que escribir —solicitante, fecha y, si
 * es vendedor, su propio nombre en el campo Vendedor— vienen cargados: el
 * formulario arranca listo, como el de Rendición de Gastos.
 */
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ComunaSelect } from "@/components/shared/comuna-select";
import { SUPERFICIE, EstadoVacio } from "@/components/gastos/ui";
import { TABS_LIST_PILL, TAB_PILL } from "@/components/gastos/tabs-pill";
import { cn } from "@/lib/utils";
import {
  Building2, Check, Loader2, Send, UserPlus, X,
} from "lucide-react";
import type { SolicitudNuevoCliente } from "@shared/schema";

/** Marcan la solicitud como creada o rechazada (mismo criterio que el servidor). */
const ROLES_RESUELVEN = ["admin", "supervisor", "encargado_area", "recursos_humanos", "reception"];

const FORM_VACIO = {
  segmento: "",
  rut: "",
  razonSocial: "",
  giro: "",
  telefonos: "",
  correoEmpresa: "",
  ciudad: "",
  comuna: "",
  direccion: "",
  vendedorId: "",
  vendedorNombre: "",
  condicionVenta: "",
  receptorNombre: "",
  receptorCorreo: "",
  receptorTelefono: "",
};

type FormNuevoCliente = typeof FORM_VACIO;

interface Catalogos {
  segmentos: string[];
  vendedores: { id: string; nombre: string }[];
  condicionesVenta: string[];
}

const fmtFecha = (valor: string | Date | null | undefined) => {
  if (!valor) return "—";
  const d = new Date(valor as any);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("es-CL");
};

const BADGE_ESTADO: Record<string, { label: string; className: string }> = {
  enviada: { label: "Enviada", className: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300" },
  creado: { label: "Cliente creado", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300" },
  rechazada: { label: "Rechazada", className: "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300" },
};

/** Campos del formulario: radio, fondo y foco naranja, iguales en todo el módulo. */
const INPUT = "h-10 rounded-xl bg-slate-50/60 border-slate-200/80 text-sm " +
  "focus-visible:border-[#fd6301] focus-visible:ring-2 focus-visible:ring-orange-500/20 " +
  "dark:bg-slate-900/40 dark:border-slate-700";

export default function NuevoClientePage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [form, setForm] = useState<FormNuevoCliente>(FORM_VACIO);
  const [requiereOrdenCompra, setRequiereOrdenCompra] = useState(true);
  const [requiereGuiaDespacho, setRequiereGuiaDespacho] = useState(true);

  const puedeResolver = ROLES_RESUELVEN.includes((user as any)?.role ?? "");

  const nombreUsuario =
    (user as any)?.salespersonName
    || `${(user as any)?.firstName ?? ""} ${(user as any)?.lastName ?? ""}`.trim()
    || (user as any)?.email
    || "—";

  const { data: catalogos } = useQuery<Catalogos>({
    queryKey: ["/api/nuevo-cliente/catalogos"],
    queryFn: async () => {
      const res = await apiRequest("/api/nuevo-cliente/catalogos");
      return res.json();
    },
    staleTime: 10 * 60 * 1000,
  });

  const { data: solicitudes = [], isLoading } = useQuery<SolicitudNuevoCliente[]>({
    queryKey: ["/api/solicitudes-nuevo-cliente"],
    queryFn: async () => {
      const res = await apiRequest("/api/solicitudes-nuevo-cliente");
      return res.json();
    },
  });

  // El vendedor se precarga con el propio usuario cuando existe en el maestro:
  // en la enorme mayoría de las altas el vendedor a cargo es quien la pide.
  useEffect(() => {
    if (!user || !catalogos?.vendedores?.length) return;
    setForm((prev) => {
      if (prev.vendedorNombre) return prev;
      const propio = catalogos.vendedores.find((v) => v.id === (user as any).id);
      return propio ? { ...prev, vendedorId: propio.id, vendedorNombre: propio.nombre } : prev;
    });
  }, [user, catalogos]);

  const enviar = useMutation({
    mutationFn: async (datos: Record<string, unknown>) => {
      const res = await apiRequest("/api/solicitudes-nuevo-cliente", { method: "POST", data: datos });
      return res.json();
    },
    onSuccess: () => {
      setForm(FORM_VACIO);
      setRequiereOrdenCompra(true);
      setRequiereGuiaDespacho(true);
      queryClient.invalidateQueries({ queryKey: ["/api/solicitudes-nuevo-cliente"] });
      toast({
        title: "Solicitud enviada",
        description: "Administración la recibió por correo, con copia a tu supervisor y a ti.",
      });
    },
    onError: (error: any) => {
      toast({ title: "No se pudo enviar", description: error?.message, variant: "destructive" });
    },
  });

  const resolver = useMutation({
    mutationFn: async ({ id, datos }: { id: string; datos: Record<string, unknown> }) => {
      const res = await apiRequest(`/api/solicitudes-nuevo-cliente/${id}`, { method: "PATCH", data: datos });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/solicitudes-nuevo-cliente"] });
      toast({ title: "Solicitud resuelta" });
    },
    onError: (error: any) => {
      toast({ title: "No se pudo resolver", description: error?.message, variant: "destructive" });
    },
  });

  const campo = (k: keyof FormNuevoCliente, valor: string) => setForm((p) => ({ ...p, [k]: valor }));

  /** Lo que falta para poder enviar, en el orden en que se ve en pantalla. */
  const faltantes = useMemo(() => {
    const requeridos: [keyof FormNuevoCliente, string][] = [
      ["segmento", "Segmento"],
      ["rut", "RUT"],
      ["razonSocial", "Nombre / Razón social"],
      ["giro", "Giro"],
      ["telefonos", "Teléfonos"],
      ["correoEmpresa", "Correo de empresa"],
      ["ciudad", "Ciudad"],
      ["comuna", "Comuna"],
      ["direccion", "Dirección"],
      ["vendedorNombre", "Vendedor"],
      ["condicionVenta", "Condición de venta"],
      ["receptorNombre", "Nombre de quien recibe los documentos"],
      ["receptorCorreo", "Correo de quien recibe los documentos"],
      ["receptorTelefono", "Teléfono de quien recibe los documentos"],
    ];
    return requeridos.filter(([k]) => !form[k].trim()).map(([, label]) => label);
  }, [form]);

  const enviarSolicitud = () => {
    if (faltantes.length > 0) {
      toast({
        title: "Faltan datos",
        description: `Completá: ${faltantes.join(", ")}.`,
        variant: "destructive",
      });
      return;
    }
    enviar.mutate({
      ...form,
      vendedorId: form.vendedorId || null,
      requiereOrdenCompra,
      requiereGuiaDespacho,
    });
  };

  return (
    <div className="p-3 sm:p-5 space-y-4 max-w-5xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-orange-500 to-[#fd6301] text-white flex items-center justify-center shadow-lg shadow-orange-500/25 flex-shrink-0">
          <UserPlus className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-slate-800 dark:text-white">Nuevo Cliente</h1>
          <p className="text-sm text-muted-foreground hidden md:block">
            Se envía a Administración para que cree el cliente, con copia a tu supervisor y a ti.
          </p>
        </div>
      </div>

      <Tabs defaultValue="nueva">
        <TabsList className={TABS_LIST_PILL}>
          <TabsTrigger value="nueva" className={TAB_PILL} data-testid="tab-nuevo-cliente-nueva">
            Nueva solicitud
          </TabsTrigger>
          <TabsTrigger value="historial" className={TAB_PILL} data-testid="tab-nuevo-cliente-historial">
            Solicitudes
            {solicitudes.length > 0 && (
              <span className="tabular-nums opacity-70">{solicitudes.length}</span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="nueva" className="mt-4 space-y-3">
          <Bloque numero={1} titulo="Datos del cliente">
            <Campo label="Segmento">
              <Select value={form.segmento} onValueChange={(v) => campo("segmento", v)}>
                <SelectTrigger className={INPUT} data-testid="select-nuevo-cliente-segmento">
                  <SelectValue placeholder="Seleccionar segmento…" />
                </SelectTrigger>
                <SelectContent>
                  {(catalogos?.segmentos ?? []).map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Campo>

            <Campo label="RUT">
              <Input
                value={form.rut}
                onChange={(e) => campo("rut", e.target.value)}
                placeholder="76.123.456-7"
                className={INPUT}
                data-testid="input-nuevo-cliente-rut"
              />
            </Campo>

            <Campo label="Nombre / Razón social" ancho>
              <Input
                value={form.razonSocial}
                onChange={(e) => campo("razonSocial", e.target.value)}
                placeholder="Comercial ..."
                className={INPUT}
                data-testid="input-nuevo-cliente-razon-social"
              />
            </Campo>

            <Campo label="Giro" ancho>
              <Input
                value={form.giro}
                onChange={(e) => campo("giro", e.target.value)}
                placeholder="Venta al por menor de materiales de construcción"
                className={INPUT}
                data-testid="input-nuevo-cliente-giro"
              />
            </Campo>

            <Campo label="Teléfonos">
              <Input
                value={form.telefonos}
                onChange={(e) => campo("telefonos", e.target.value)}
                placeholder="+56 9 ... / +56 2 ..."
                className={INPUT}
                data-testid="input-nuevo-cliente-telefonos"
              />
            </Campo>

            <Campo label="Correo de empresa">
              <Input
                value={form.correoEmpresa}
                onChange={(e) => campo("correoEmpresa", e.target.value)}
                type="email"
                placeholder="contacto@empresa.cl"
                className={INPUT}
                data-testid="input-nuevo-cliente-correo"
              />
            </Campo>

            <Campo label="Ciudad">
              <Input
                value={form.ciudad}
                onChange={(e) => campo("ciudad", e.target.value)}
                placeholder="Santiago"
                className={INPUT}
                data-testid="input-nuevo-cliente-ciudad"
              />
            </Campo>

            <Campo label="Comuna">
              {/* Catálogo oficial de las 346 comunas: el campo libre dejaba entrar
                  "las condes", "LAS CONDES" y "Las  Condes" como tres valores. */}
              <ComunaSelect
                value={form.comuna}
                onChange={(c) => campo("comuna", c ?? "")}
                className={cn(INPUT, "w-full justify-between font-normal")}
                data-testid="select-nuevo-cliente-comuna"
              />
            </Campo>

            <Campo label="Dirección" ancho>
              <Input
                value={form.direccion}
                onChange={(e) => campo("direccion", e.target.value)}
                placeholder="Av. ... 1234"
                className={INPUT}
                data-testid="input-nuevo-cliente-direccion"
              />
            </Campo>
          </Bloque>

          <Bloque numero={2} titulo="Vendedor y condición comercial">
            <Campo label="Vendedor">
              <Select
                value={form.vendedorId}
                onValueChange={(v) => {
                  const vendedor = catalogos?.vendedores.find((x) => x.id === v);
                  setForm((p) => ({
                    ...p,
                    vendedorId: vendedor?.id ?? "",
                    vendedorNombre: vendedor?.nombre ?? "",
                  }));
                }}
              >
                <SelectTrigger className={INPUT} data-testid="select-nuevo-cliente-vendedor">
                  <SelectValue placeholder="Seleccionar vendedor…" />
                </SelectTrigger>
                <SelectContent>
                  {(catalogos?.vendedores ?? []).map((v) => (
                    <SelectItem key={v.id} value={v.id}>{v.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Campo>

            <Campo label="Condición de venta (inicial)">
              <Select value={form.condicionVenta} onValueChange={(v) => campo("condicionVenta", v)}>
                <SelectTrigger className={INPUT} data-testid="select-nuevo-cliente-condicion">
                  <SelectValue placeholder="Seleccionar condición…" />
                </SelectTrigger>
                <SelectContent>
                  {(catalogos?.condicionesVenta ?? []).map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Campo>
          </Bloque>

          <Bloque
            numero={3}
            titulo="Persona responsable de recepción de documentos"
            bajada="Obligatorio para todos los clientes: todos son facturadores electrónicos."
          >
            <Campo label="Nombre">
              <Input
                value={form.receptorNombre}
                onChange={(e) => campo("receptorNombre", e.target.value)}
                className={INPUT}
                data-testid="input-nuevo-cliente-receptor-nombre"
              />
            </Campo>

            <Campo label="Correo">
              <Input
                value={form.receptorCorreo}
                onChange={(e) => campo("receptorCorreo", e.target.value)}
                type="email"
                placeholder="facturas@empresa.cl"
                className={INPUT}
                data-testid="input-nuevo-cliente-receptor-correo"
              />
            </Campo>

            <Campo label="Teléfono">
              <Input
                value={form.receptorTelefono}
                onChange={(e) => campo("receptorTelefono", e.target.value)}
                placeholder="+56 9 ..."
                className={INPUT}
                data-testid="input-nuevo-cliente-receptor-telefono"
              />
            </Campo>
          </Bloque>

          <Bloque
            numero={4}
            titulo="Requerimientos para la facturación"
            bajada="Qué datos necesita el cliente dentro de la factura electrónica para poder aceptarla."
          >
            <Campo label="Incluir orden de compra">
              <SiNo
                valor={requiereOrdenCompra}
                onChange={setRequiereOrdenCompra}
                testId="orden-compra"
              />
            </Campo>

            <Campo label="Incluir guía de despacho">
              <SiNo
                valor={requiereGuiaDespacho}
                onChange={setRequiereGuiaDespacho}
                testId="guia-despacho"
              />
            </Campo>
          </Bloque>

          {/* Solicitante y fecha no se piden: son del sistema. Se muestran para
              que quien envía vea con qué nombre y con qué fecha va a quedar. */}
          <div className={cn(SUPERFICIE, "p-4 flex flex-col sm:flex-row sm:items-end gap-4")}>
            <div className="grid grid-cols-2 gap-4 flex-1 min-w-0">
              <div>
                <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1">
                  Nombre del solicitante
                </div>
                <div
                  className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate"
                  data-testid="text-nuevo-cliente-solicitante"
                >
                  {nombreUsuario}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1">
                  Fecha de solicitud
                </div>
                <div className="text-sm font-semibold text-slate-700 dark:text-slate-200 tabular-nums">
                  {new Date().toLocaleDateString("es-CL")}
                </div>
              </div>
            </div>

            <Button
              onClick={enviarSolicitud}
              disabled={enviar.isPending}
              className="h-10 rounded-2xl bg-[#fd6301] hover:bg-[#e35400] text-white shadow-md shadow-orange-500/25 transition-all text-sm font-semibold px-5"
              data-testid="button-submit-nuevo-cliente"
            >
              {enviar.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Enviar solicitud
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="historial" className="mt-4">
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-slate-400 py-8 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
            </div>
          ) : solicitudes.length === 0 ? (
            <EstadoVacio
              icono={UserPlus}
              titulo="Todavía no hay solicitudes"
              descripcion="Cuando envíes una solicitud de alta, va a aparecer acá con su estado."
            />
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

/** Bloque numerado del formulario (mismo patrón que el alta de gasto). */
function Bloque({
  numero,
  titulo,
  bajada,
  children,
}: {
  numero: number;
  titulo: string;
  bajada?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn(SUPERFICIE, "p-4 space-y-3")}>
      <div className="flex items-start gap-2.5">
        <span className="h-7 w-7 rounded-xl bg-gradient-to-br from-orange-500 to-[#fd6301] text-white text-xs font-bold flex items-center justify-center flex-shrink-0 shadow-md shadow-orange-500/25">
          {numero}
        </span>
        <div className="min-w-0">
          <div className="text-sm font-bold text-slate-700 dark:text-slate-200">{titulo}</div>
          {bajada && <p className="text-xs text-slate-400 mt-0.5">{bajada}</p>}
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>
    </div>
  );
}

/** Etiqueta micro-uppercase + control. Todos los campos son obligatorios. */
function Campo({
  label,
  ancho,
  children,
}: {
  label: string;
  ancho?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={ancho ? "sm:col-span-2" : undefined}>
      <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1">{label}</div>
      {children}
    </div>
  );
}

/** Control segmentado Sí/No, con "Sí" como opción por defecto. */
function SiNo({
  valor,
  onChange,
  testId,
}: {
  valor: boolean;
  onChange: (v: boolean) => void;
  testId: string;
}) {
  const opcion = (activo: boolean) =>
    cn(
      "flex-1 h-8 rounded-full text-sm font-medium transition-colors",
      activo
        ? "bg-white text-[#fd6301] shadow-sm dark:bg-slate-700 dark:text-orange-400"
        : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200",
    );

  return (
    <div className="flex items-center gap-1 h-10 rounded-full border border-slate-200/60 bg-slate-100/70 p-1 dark:border-slate-700/60 dark:bg-slate-800/60">
      <button type="button" onClick={() => onChange(true)} className={opcion(valor)} data-testid={`button-${testId}-si`}>
        Sí
      </button>
      <button type="button" onClick={() => onChange(false)} className={opcion(!valor)} data-testid={`button-${testId}-no`}>
        No
      </button>
    </div>
  );
}

/** Una solicitud del listado, con la resolución de Administración cuando corresponde. */
function FilaSolicitud({
  solicitud,
  puedeResolver,
  resolviendo,
  onResolver,
}: {
  solicitud: SolicitudNuevoCliente;
  puedeResolver: boolean;
  resolviendo: boolean;
  onResolver: (datos: Record<string, unknown>) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [detalle, setDetalle] = useState(false);
  const [motivo, setMotivo] = useState("");

  const badge = BADGE_ESTADO[solicitud.estado] ?? {
    label: solicitud.estado,
    className: "bg-slate-100 text-slate-600",
  };

  const dato = (label: string, valor: React.ReactNode) => (
    <div>
      <div className="text-[9px] uppercase tracking-wider font-bold text-slate-400">{label}</div>
      <div className="text-xs text-slate-700 dark:text-slate-200 break-words">{valor || "—"}</div>
    </div>
  );

  return (
    <div className={cn(SUPERFICIE, "px-4 py-3")} data-testid={`solicitud-nuevo-cliente-${solicitud.id}`}>
      <div className="flex flex-wrap items-center gap-3">
        <span className="h-8 w-8 rounded-xl bg-[#fd6301]/15 text-[#fd6301] flex items-center justify-center flex-shrink-0">
          <Building2 className="h-4 w-4" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="font-semibold text-sm text-slate-800 dark:text-slate-100 truncate">
            {solicitud.razonSocial}
            <span className="ml-2 text-xs font-normal text-slate-400">{solicitud.rut}</span>
          </div>
          <div className="text-[11px] text-slate-400 truncate">
            {solicitud.segmento} · {solicitud.vendedorNombre} · {solicitud.condicionVenta} ·{" "}
            {solicitud.solicitanteNombre ?? "—"} · {fmtFecha(solicitud.createdAt)}
          </div>
        </div>

        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider",
            badge.className,
          )}
        >
          {badge.label}
        </span>

        <Button
          variant="outline"
          size="sm"
          className="h-8 rounded-lg text-xs"
          onClick={() => setDetalle((v) => !v)}
          data-testid={`button-detalle-${solicitud.id}`}
        >
          {detalle ? "Ocultar" : "Ver datos"}
        </Button>

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

      {detalle && (
        <div className="mt-3 border-t border-slate-100 dark:border-slate-700/40 pt-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
          {dato("Giro", solicitud.giro)}
          {dato("Teléfonos", solicitud.telefonos)}
          {dato("Correo de empresa", solicitud.correoEmpresa)}
          {dato("Dirección", solicitud.direccion)}
          {dato("Comuna", solicitud.comuna)}
          {dato("Ciudad", solicitud.ciudad)}
          {dato("Recibe documentos", solicitud.receptorNombre)}
          {dato("Correo receptor", solicitud.receptorCorreo)}
          {dato("Teléfono receptor", solicitud.receptorTelefono)}
          {dato("Orden de compra en factura", solicitud.requiereOrdenCompra ? "Sí" : "No")}
          {dato("Guía de despacho en factura", solicitud.requiereGuiaDespacho ? "Sí" : "No")}
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
          <Textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={1}
            placeholder="Observaciones (obligatorias si se rechaza)"
            className="min-h-[40px] resize-none rounded-xl text-sm"
            data-testid={`input-nuevo-cliente-observaciones-${solicitud.id}`}
          />
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
              disabled={resolviendo}
              className="h-8 rounded-lg text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => onResolver({ estado: "creado", observaciones: motivo.trim() || null })}
            >
              <Check className="h-3.5 w-3.5 mr-1" /> Cliente creado
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
