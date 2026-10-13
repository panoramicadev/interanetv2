/**
 * Compras de la obra — lo que la obra le compró de verdad a Panorámica.
 *
 * Se asocian los documentos (facturas, notas de venta y guías de despacho) a la
 * obra y de ahí sale, producto por producto, cuánto se compró contra lo que se
 * proyectó al empezar. Al asociar o sacar uno, Pedidas y Entregadas de los
 * productos se recalculan solas (ver server/obras-cantidades.ts).
 *
 * Los tres orígenes van SEPARADOS y no se suman: una nota de venta que después
 * se factura y se despacha es la misma compra apareciendo tres veces. Por eso
 * son tres columnas y no un total (ver server/obras-ventas.ts).
 *
 * El documento puede venir a nombre de otro cliente: en muchas obras el material
 * lo compra el contratista, no la constructora. Por eso el buscador no se acota
 * al RUT de la obra.
 *
 * Los documentos se vinculan SOLOS cuando no hay duda de qué obra son (ver
 * server/obras-ventas-auto.ts): el vendedor no ve las facturas, así que no
 * puede ir a buscarlas una por una. Los que podrían ser de más de una obra
 * aparecen como "por asignar" y se resuelven con un clic. El buscador queda
 * para lo que el sistema no puede ver, como las compras del contratista.
 */
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Check, ChevronDown, ChevronRight, ExternalLink, FileText, Link2, Loader2, Plus, Search, Sparkles, Truck, X } from "lucide-react";

type Origen = "facturado" | "nvv" | "gdv";

/** Cómo se llama cada origen en pantalla y de qué color va. */
const ORIGENES: Array<{ clave: Origen; titulo: string; corto: string; icono: JSX.Element; color: string }> = [
  { clave: "facturado", titulo: "Facturado", corto: "Fact.", icono: <FileText className="h-4 w-4" />, color: "text-emerald-600" },
  { clave: "nvv", titulo: "Notas de venta", corto: "NVV", icono: <Link2 className="h-4 w-4" />, color: "text-[#fd6301]" },
  { clave: "gdv", titulo: "Guías de despacho", corto: "GDV", icono: <Truck className="h-4 w-4" />, color: "text-sky-600" },
];

interface DocumentoAsociado {
  id: string;
  origen: Origen;
  tido: string | null;
  idmaeedo: string;
  nudo: string | null;
  clienteRut: string | null;
  clienteNombre: string | null;
  fechaEmision: string | null;
  montoDocumento: string | null;
  asociadoPorNombre: string | null;
  /** Con qué regla se vinculó solo; null si lo asoció una persona. */
  regla: string | null;
}

/** Por qué el sistema decidió que el documento era de esta obra. */
const MOTIVO_REGLA: Record<string, string> = {
  nvv_recepcion: "Recepción anotó esta nota de venta al ingresar la cotización de la obra",
  oc_cotizacion: "Trae la misma orden de compra que la cotización de la obra",
  obra_unica: "Es la única obra activa de la constructora y trae productos proyectados en ella",
  sku_exclusivo: "Sus productos solo están proyectados en esta obra",
};

interface DocumentoSugerido {
  origen: Origen;
  tido: string | null;
  idmaeedo: string;
  nudo: string | null;
  clienteNombre: string | null;
  fechaEmision: string | null;
  monto: number;
  /** Trae algún producto de los proyectados en la obra. */
  coincide: boolean;
}

/** "A, B y 4 más": una constructora grande tiene demasiadas obras para nombrarlas todas. */
const nombrarObras = (obras: string[]) =>
  obras.length <= 2 ? obras.join(" o ") : `${obras.slice(0, 2).join(", ")} y ${obras.length - 2} más`;

/** Cuántas sugerencias se ven sin desplegar: son para resolver, no para leer. */
const SUGERIDOS_VISIBLES = 5;

interface ProductoComprado {
  origen: Origen;
  kopr: string | null;
  nombre: string | null;
  cantidad: number;
  monto: number;
}

interface RespuestaVentas {
  documentos: DocumentoAsociado[];
  productos: ProductoComprado[];
  totales: Record<Origen, { monto: number; documentos: number }>;
  sugeridos?: { documentos: DocumentoSugerido[]; total: number; otrasObras: string[] };
}

interface ClienteConDocumentos {
  rut: string;
  nombre: string;
  documentos: number;
  ultimaCompra: string | null;
  /** Si apareció por la obra: cómo la nombra la observación del ERP. */
  obra?: string | null;
  documentosObra?: number;
}

interface Candidato {
  origen: Origen;
  tido: string | null;
  idmaeedo: string;
  nudo: string | null;
  clienteRut: string | null;
  clienteNombre: string | null;
  fechaEmision: string | null;
  monto: number;
  lineas: number;
  /** La observación del ERP: ahí se anota a qué obra va el documento. */
  observacion?: string | null;
  obraId: string | null;
  obraNombre: string | null;
}

/** Minúsculas y sin tildes, para comparar como escribe la gente. */
const normalizar = (v: string) =>
  v.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const pesos = (valor: number | string | null | undefined) =>
  `$${Math.round(Number(valor ?? 0)).toLocaleString("es-CL")}`;

const fecha = (iso: string | null) =>
  iso ? iso.split("-").reverse().join("-") : "—";


export function ComprasObra({
  obraId,
  obraNombre,
  clienteNombre,
}: {
  obraId: string;
  obraNombre: string;
  clienteNombre?: string | null;
}) {
  const { toast } = useToast();
  const [dialogBuscar, setDialogBuscar] = useState(false);
  const [verTodosSugeridos, setVerTodosSugeridos] = useState(false);
  // Documento abierto en "Documentos asociados": se ven sus productos.
  const [docAbierto, setDocAbierto] = useState<string | null>(null);

  const { data, isLoading } = useQuery<RespuestaVentas>({
    queryKey: ["/api/obras", obraId, "ventas"],
    queryFn: async () => {
      const res = await apiRequest(`/api/obras/${obraId}/ventas`);
      return res.json();
    },
  });

  const desasociar = useMutation({
    mutationFn: async (vinculoId: string) => {
      await apiRequest(`/api/obras/ventas/${vinculoId}/desasociar`, { method: "POST" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/obras", obraId, "ventas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/obra-productos"] });
      toast({ title: "Documento sacado de la obra", description: "Sus cantidades se descontaron de los productos." });
    },
    onError: (error: any) => {
      toast({ title: "No se pudo sacar el documento", description: error?.message, variant: "destructive" });
    },
  });

  // Resolver una sugerencia: es de esta obra (se asocia) o no (no se vuelve a
  // ofrecer acá). La fila sale de la lista en el acto.
  const resolverSugerido = useMutation({
    mutationFn: async ({ doc, esDeLaObra }: { doc: DocumentoSugerido; esDeLaObra: boolean }) => {
      const documento = { origen: doc.origen, idmaeedo: doc.idmaeedo };
      if (esDeLaObra) {
        await apiRequest(`/api/obras/${obraId}/ventas`, { method: "POST", data: { documentos: [documento] } });
      } else {
        await apiRequest(`/api/obras/${obraId}/ventas/descartar`, { method: "POST", data: documento });
      }
    },
    onMutate: async ({ doc }) => {
      const claveQuery = ["/api/obras", obraId, "ventas"];
      await queryClient.cancelQueries({ queryKey: claveQuery });
      const anterior = queryClient.getQueryData<RespuestaVentas>(claveQuery);
      queryClient.setQueryData<RespuestaVentas>(claveQuery, (actual) =>
        actual?.sugeridos
          ? {
              ...actual,
              sugeridos: {
                ...actual.sugeridos,
                total: Math.max(0, actual.sugeridos.total - 1),
                documentos: actual.sugeridos.documentos.filter((d) => d.idmaeedo !== doc.idmaeedo),
              },
            }
          : actual,
      );
      return { claveQuery, anterior };
    },
    onSuccess: (_data, { esDeLaObra }) => {
      toast({ title: esDeLaObra ? "Documento asociado a la obra" : "Listo, no se vuelve a sugerir en esta obra" });
    },
    onError: (error: any, _vars, context) => {
      if (context) queryClient.setQueryData(context.claveQuery, context.anterior);
      toast({ title: "No se pudo guardar", description: error?.message, variant: "destructive" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/obras", obraId, "ventas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/obra-productos"] });
    },
  });

  const sugeridos = data?.sugeridos?.documentos ?? [];
  const totalSugeridos = data?.sugeridos?.total ?? 0;
  const otrasObras = data?.sugeridos?.otrasObras ?? [];
  const sugeridosVisibles = verTodosSugeridos ? sugeridos : sugeridos.slice(0, SUGERIDOS_VISIBLES);

  const hayCompras = (data?.documentos?.length ?? 0) > 0;

  return (
    <div className="rounded-2xl border border-slate-200/70 dark:border-slate-700/60 bg-white dark:bg-slate-900/60 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-slate-200/70 dark:border-slate-700/60">
        {/* Sin el subtítulo "contra lo que se proyectó": esa comparación por
            producto se quitó (oct-2026); lo proyectado se ve en la planilla. */}
        <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 min-w-0">Compras de la obra</h4>
        <Button
          size="sm"
          onClick={() => setDialogBuscar(true)}
          className="rounded-xl bg-[#fd6301] hover:bg-[#e35400] text-white flex-shrink-0"
          data-testid={`button-obra-asociar-venta-${obraId}`}
        >
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Asociar documento
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-10 text-slate-300">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : !hayCompras ? (
        <div className="px-4 py-8 text-center">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Todavía no hay facturas ni notas de venta asociadas a esta obra.
          </p>
          <p className="text-[11px] text-slate-400 mt-1 max-w-md mx-auto">
            Se vinculan solas después de cada sincronización. Si lo compró el contratista, búscalo con «Asociar documento».
          </p>
        </div>
      ) : (
        <>
          {/* Los tres van por separado a propósito: sumarlos contaría la misma
              compra hasta tres veces (nota de venta → factura → guía). */}
          {/* Siempre en tres columnas: en celular apiladas ocupaban media pantalla. */}
          <div className="grid grid-cols-3 divide-x divide-slate-200/70 dark:divide-slate-700/60 border-b border-slate-200/70 dark:border-slate-700/60">
            {ORIGENES.map(({ clave: k, titulo, corto, icono, color }) => (
              <div key={k} className="px-2.5 sm:px-4 py-3 min-w-0">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <span className={`${color} [&>svg]:h-3.5 [&>svg]:w-3.5 sm:[&>svg]:h-4 sm:[&>svg]:w-4`}>{icono}</span>
                  <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 truncate">
                    <span className="sm:hidden">{corto}</span>
                    <span className="hidden sm:inline">{titulo}</span>
                  </span>
                </div>
                <div className="text-sm sm:text-lg font-bold text-slate-900 dark:text-slate-100 tabular-nums mt-1 truncate">
                  {pesos(data?.totales?.[k]?.monto)}
                </div>
                <div className="text-[11px] text-slate-400">
                  {data?.totales?.[k]?.documentos ?? 0} documento
                  {(data?.totales?.[k]?.documentos ?? 0) === 1 ? "" : "s"}
                </div>
              </div>
            ))}
          </div>

          {/* Sin la comparación por producto (Proyectado / Fact. / NVV / GDV / Falta
              comprar): se ocultó a pedido del usuario (oct-2026). */}

          {/* Documentos asociados */}
          <div className="border-t border-slate-200/70 dark:border-slate-700/60">
            <div className="px-4 pt-3 pb-1 text-[10px] uppercase tracking-wider font-bold text-slate-400">
              Documentos asociados
            </div>
            <ul className="divide-y divide-slate-100 dark:divide-slate-700/40">
              {(data?.documentos ?? []).map((d) => (
                // Letra chica y cada dato en una línea (pedido del usuario,
                // oct-2026): con la columna a media pantalla la fecha se partía.
                <li key={d.id} className="text-xs">
                  <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 w-8 sm:w-12 flex-shrink-0">
                    {d.tido ?? d.origen}
                  </span>
                  {/* Se pincha para ver el documento (pedido del usuario, oct-2026). */}
                  <button
                    type="button"
                    onClick={() => setDocAbierto(docAbierto === d.id ? null : d.id)}
                    className="inline-flex items-center gap-0.5 font-bold tabular-nums text-[#fd6301] hover:underline sm:w-20 flex-shrink-0 whitespace-nowrap text-left"
                    title="Ver el documento"
                    data-testid={`button-ver-documento-${d.id}`}
                  >
                    {docAbierto === d.id ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    {d.nudo ?? "—"}
                  </button>
                  <span className="text-slate-400 tabular-nums sm:w-[4.5rem] flex-shrink-0 whitespace-nowrap">{fecha(d.fechaEmision)}</span>
                  {/* En celular no cabe: es casi siempre la misma constructora. */}
                  <span className="hidden sm:block truncate flex-1 min-w-0 text-slate-500 dark:text-slate-400">
                    {d.clienteNombre ?? "—"}
                  </span>
                  <span className="sm:hidden flex-1" />
                  {d.regla && (
                    <span
                      className="inline-flex items-center gap-1 rounded-md bg-orange-50 dark:bg-orange-950/30 px-1.5 py-0.5 text-[10px] font-bold text-[#fd6301] flex-shrink-0"
                      title={MOTIVO_REGLA[d.regla] ?? "Vinculado solo"}
                      data-testid={`badge-obra-venta-auto-${d.id}`}
                    >
                      <Sparkles className="h-3 w-3" />
                      Automático
                    </span>
                  )}
                  <span className="tabular-nums font-semibold text-slate-700 dark:text-slate-200 flex-shrink-0 whitespace-nowrap">
                    {pesos(d.montoDocumento)}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={desasociar.isPending}
                    onClick={() => desasociar.mutate(d.id)}
                    className="h-6 w-6 sm:h-7 sm:w-7 rounded-lg text-slate-300 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 flex-shrink-0"
                    aria-label="Sacar de la obra"
                    data-testid={`button-obra-desasociar-${d.id}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                  </div>
                  {docAbierto === d.id && <DetalleDocumento vinculoId={d.id} idmaeedo={d.idmaeedo} tido={d.tido} />}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      {/* Lo que podría ser de esta obra pero el sistema no puede asegurar: la
          constructora tiene más de una obra con los mismos productos, o el
          documento no trae ninguno de los proyectados. Se decide acá. */}
      {!isLoading && sugeridos.length > 0 && (
        <div className="border-t border-slate-200/70 dark:border-slate-700/60 bg-amber-50/40 dark:bg-amber-950/10">
          <div className="px-4 pt-3 pb-1">
            <div className="text-[10px] uppercase tracking-wider font-bold text-amber-700 dark:text-amber-400">
              Documentos por asignar · {totalSugeridos}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              {otrasObras.length > 0
                ? `Facturas de la constructora que podrían ser de esta obra o de ${nombrarObras(otrasObras)}.`
                : "Facturas de la constructora desde que empezó la obra que no se pudieron asignar solas."}
            </p>
          </div>
          <ul className="divide-y divide-amber-100/70 dark:divide-slate-700/40">
            {sugeridosVisibles.map((d) => (
              <li key={`${d.origen}-${d.idmaeedo}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-xs">
                <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 w-12 flex-shrink-0">
                  {d.tido ?? d.origen}
                </span>
                <span className="font-bold tabular-nums text-slate-700 dark:text-slate-200 w-20 flex-shrink-0">
                  {d.nudo ?? "—"}
                </span>
                <span className="text-slate-400 tabular-nums w-24 flex-shrink-0">{fecha(d.fechaEmision)}</span>
                <span className="flex-1 min-w-0 truncate text-slate-500 dark:text-slate-400">
                  {d.coincide ? "Trae productos de esta obra" : "Sin productos de esta obra"}
                </span>
                <span className="tabular-nums font-semibold text-slate-700 dark:text-slate-200 flex-shrink-0">
                  {pesos(d.monto)}
                </span>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button
                    size="sm"
                    disabled={resolverSugerido.isPending}
                    onClick={() => resolverSugerido.mutate({ doc: d, esDeLaObra: true })}
                    className="h-7 rounded-lg px-2.5 text-[11px] bg-[#fd6301] hover:bg-[#e35400] text-white"
                    data-testid={`button-obra-sugerido-si-${d.idmaeedo}`}
                  >
                    <Check className="h-3 w-3 mr-1" />
                    Es de esta obra
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={resolverSugerido.isPending}
                    onClick={() => resolverSugerido.mutate({ doc: d, esDeLaObra: false })}
                    className="h-7 rounded-lg px-2.5 text-[11px] text-slate-500 hover:text-slate-700"
                    data-testid={`button-obra-sugerido-no-${d.idmaeedo}`}
                  >
                    No es
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          {sugeridos.length > SUGERIDOS_VISIBLES && (
            <button
              onClick={() => setVerTodosSugeridos((v) => !v)}
              className="w-full px-4 py-2 text-[11px] font-semibold text-slate-500 hover:text-[#fd6301] transition-colors text-left"
              data-testid={`button-obra-sugeridos-ver-${obraId}`}
            >
              {verTodosSugeridos
                ? "Ver menos"
                : totalSugeridos > sugeridos.length
                  ? `Ver los ${sugeridos.length} más recientes (de ${totalSugeridos})`
                  : `Ver los ${sugeridos.length}`}
            </button>
          )}
        </div>
      )}

      <DialogBuscarDocumentos
        abierto={dialogBuscar}
        onCerrar={() => setDialogBuscar(false)}
        obraId={obraId}
        obraNombre={obraNombre}
        sugerencia={clienteNombre ?? ""}
      />
    </div>
  );
}

/** Buscador de facturas, notas de venta y guías para colgar de la obra. */
function DialogBuscarDocumentos({
  abierto,
  onCerrar,
  obraId,
  obraNombre,
  sugerencia,
}: {
  abierto: boolean;
  onCerrar: () => void;
  obraId: string;
  obraNombre: string;
  sugerencia: string;
}) {
  const { toast } = useToast();
  const [busqueda, setBusqueda] = useState(sugerencia);
  const [elegidos, setElegidos] = useState<Set<string>>(new Set());
  // Primero se elige el cliente y después se ven SUS documentos. Buscando
  // documentos directo, un término común devolvía una mezcla de clientes y el
  // que se buscaba podía quedar fuera del tope sin que nadie se enterara.
  const [cliente, setCliente] = useState<ClienteConDocumentos | null>(null);
  // Un cliente grande tiene miles de documentos y la lista entera no se puede
  // recorrer a ojo. Se parte por el último año y se filtra por número.
  const [meses, setMeses] = useState(12);
  const [filtroDoc, setFiltroDoc] = useState("");

  // Se espera a que la persona deje de escribir: cada búsqueda también
  // consulta las observaciones en el ERP y no vale la pena hacerlo por letra.
  const [termino, setTermino] = useState(sugerencia.trim());
  useEffect(() => {
    const t = setTimeout(() => setTermino(busqueda.trim()), 350);
    return () => clearTimeout(t);
  }, [busqueda]);

  const desde = useMemo(() => {
    if (meses === 0) return "";
    const d = new Date();
    d.setMonth(d.getMonth() - meses);
    return d.toISOString().slice(0, 10);
  }, [meses]);

  const { data: clientes = [], isFetching: buscandoClientes } = useQuery<ClienteConDocumentos[]>({
    queryKey: ["/api/obras/ventas/clientes", termino],
    queryFn: async () => {
      const res = await apiRequest(`/api/obras/ventas/clientes?q=${encodeURIComponent(termino)}`);
      return res.json();
    },
    enabled: abierto && !cliente && termino.length >= 2,
  });

  const { data: candidatosCrudos = [], isFetching } = useQuery<Candidato[]>({
    queryKey: ["/api/obras/ventas/buscar", cliente?.rut, desde],
    queryFn: async () => {
      const qs = new URLSearchParams({ clienteRut: cliente!.rut });
      if (desde) qs.set("desde", desde);
      const res = await apiRequest(`/api/obras/ventas/buscar?${qs.toString()}`);
      return res.json();
    },
    enabled: abierto && !!cliente,
  });

  // El filtro por número se aplica sobre lo ya traído: es para encontrar una
  // factura puntual dentro del período, no para ir de nuevo al servidor.
  // Cada palabra tiene que aparecer en el número, el tipo o la observación,
  // en cualquier orden: "queule condominio" encuentra "C - CONDOMINIO QUEULE".
  const candidatos = useMemo(() => {
    const palabras = normalizar(filtroDoc).split(/\s+/).filter(Boolean);
    if (palabras.length === 0) return candidatosCrudos;
    return candidatosCrudos.filter((c) => {
      const texto = normalizar(`${c.nudo ?? ""} ${c.tido ?? ""} ${c.observacion ?? ""}`);
      return palabras.every((p) => texto.includes(p));
    });
  }, [candidatosCrudos, filtroDoc]);

  const elegirCliente = (c: ClienteConDocumentos) => {
    setCliente(c);
    // Si se llegó por la obra, la lista abre filtrada en esa obra y sin tope de
    // fecha: una obra larga tiene compras de hace más de un año.
    if (c.documentosObra) {
      setFiltroDoc(termino);
      setMeses(0);
    }
  };

  const volverAClientes = () => {
    setCliente(null);
    setElegidos(new Set());
    setFiltroDoc("");
  };

  const asociar = useMutation({
    mutationFn: async (documentos: Array<{ origen: Origen; idmaeedo: string }>) => {
      const res = await apiRequest(`/api/obras/${obraId}/ventas`, { method: "POST", data: { documentos } });
      return res.json();
    },
    onSuccess: (resultado: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/obras", obraId, "ventas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/obras/ventas/buscar"] });
      queryClient.invalidateQueries({ queryKey: ["/api/obra-productos"] });
      setElegidos(new Set());
      onCerrar();
      const n = resultado?.asociados?.length ?? 0;
      const repetidos: string[] = resultado?.repetidos ?? [];
      toast({
        title: n === 1 ? "Documento asociado a la obra" : `${n} documentos asociados a la obra`,
        description: [
          repetidos.length > 0 ? `Ya estaban en la obra y no se sumaron de nuevo: ${repetidos.join(", ")}.` : "",
          resultado?.erpRespondio === false
            ? "El sistema de la empresa no respondió: las cantidades se actualizan en la próxima sincronización."
            : "Pedidas y Entregadas ya se actualizaron en los productos.",
        ].filter(Boolean).join(" "),
      });
    },
    onError: (error: any) => {
      toast({ title: "No se pudieron asociar", description: error?.message, variant: "destructive" });
    },
  });

  const alternar = (c: Candidato) => {
    const k = `${c.origen}|${c.idmaeedo}`;
    setElegidos((prev) => {
      const siguiente = new Set(prev);
      if (siguiente.has(k)) siguiente.delete(k);
      else siguiente.add(k);
      return siguiente;
    });
  };

  return (
    <Dialog open={abierto} onOpenChange={(v) => { if (!v) onCerrar(); }}>
      {/* En celular ocupa la pantalla completa: la lista de documentos es lo
          que se usa y en la ventana chica quedaban dos o tres a la vista. */}
      <DialogContent
        className="sm:max-w-[720px] z-[70] max-sm:h-[100dvh] max-sm:max-h-[100dvh] max-sm:rounded-none max-sm:flex max-sm:flex-col"
        overlayClassName="z-[70]"
      >
        <DialogTitle className="text-base font-bold flex items-center gap-2">
          <span className="w-8 h-8 rounded-xl bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400 flex items-center justify-center">
            <FileText className="h-4 w-4" />
          </span>
          Asociar documentos a {obraNombre}
        </DialogTitle>
        <DialogDescription className="text-sm text-muted-foreground">
          {cliente
            ? `Todos los documentos de ${cliente.nombre}. Marca los que son de esta obra.`
            : "Busca por cliente, RUT u obra. Si lo compró el contratista, búscalo a él."}
        </DialogDescription>

        {cliente ? (
          <div className="flex items-center gap-2 rounded-2xl bg-orange-50 dark:bg-orange-950/30 px-3 py-2">
            <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 flex-shrink-0">Cliente</span>
            <span className="font-semibold text-sm text-slate-700 dark:text-slate-200 truncate flex-1 min-w-0">
              {cliente.nombre}
            </span>
            <span className="text-[11px] text-slate-400 tabular-nums flex-shrink-0">{cliente.rut}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={volverAClientes}
              className="h-7 rounded-lg text-xs text-slate-500 hover:text-orange-600 flex-shrink-0"
              data-testid="button-obra-cambiar-cliente"
            >
              Cambiar
            </Button>
          </div>
        ) : (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
            <Input
              autoFocus
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Cliente, RUT o nombre de la obra…"
              className="pl-9 rounded-2xl"
              data-testid="input-obra-buscar-venta"
            />
            {buscandoClientes && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-slate-300" />}
          </div>
        )}

        {/* Paso 1: elegir el cliente */}
        {!cliente && (
          <div className="max-h-80 max-sm:max-h-none max-sm:flex-1 max-sm:min-h-0 overflow-y-auto -mx-1 px-1">
            {termino.length < 2 && (
              <div className="py-8 text-center text-sm text-slate-400">Escribe al menos 2 letras</div>
            )}
            {/* La consulta barre las ventas de toda la empresa y tarda cerca de
                un segundo: sin esto la lista queda vacía y parece colgada. */}
            {termino.length >= 2 && buscandoClientes && clientes.length === 0 && (
              <div className="py-8 text-center text-slate-300">
                <Loader2 className="h-5 w-5 animate-spin mx-auto" />
              </div>
            )}
            {termino.length >= 2 && clientes.length === 0 && !buscandoClientes && (
              <div className="py-8 text-center text-sm text-slate-400">
                Ningún cliente ni obra con ventas para esa búsqueda
              </div>
            )}
            {clientes.map((c) => (
              <button
                key={c.rut}
                type="button"
                onClick={() => elegirCliente(c)}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left text-xs hover:bg-orange-50/60 dark:hover:bg-orange-950/20 transition-colors"
                data-testid={`option-obra-venta-cliente-${c.rut}`}
              >
                <span className="flex-1 min-w-0">
                  <span className="block truncate font-semibold text-slate-700 dark:text-slate-200">{c.nombre}</span>
                  {c.obra && (
                    <span className="block line-clamp-2 text-[11px] text-orange-600 dark:text-orange-400" title={c.obra}>
                      Obra: {c.obra}
                    </span>
                  )}
                </span>
                {/* En celular el RUT y la fecha se esconden: si no, el nombre y la
                    obra quedan sin espacio y la fila no dice de quién es. */}
                <span className="hidden md:inline text-slate-400 tabular-nums flex-shrink-0">{c.rut}</span>
                <span className="text-slate-400 flex-shrink-0 w-20 md:w-24 text-right">
                  {c.documentosObra
                    ? `${c.documentosObra} de la obra`
                    : `${c.documentos} doc${c.documentos === 1 ? "" : "s"}`}
                </span>
                <span className="hidden md:inline text-slate-400 tabular-nums flex-shrink-0 w-24 text-right">
                  {fecha(c.ultimaCompra)}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Paso 2: sus documentos */}
        {cliente && (
        <>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-0.5 rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
            {([
              { valor: 3, label: "3 meses" },
              { valor: 12, label: "1 año" },
              { valor: 0, label: "Todo" },
            ] as const).map((p) => (
              <button
                key={p.valor}
                type="button"
                onClick={() => setMeses(p.valor)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                  meses === p.valor
                    ? "bg-white dark:bg-slate-900 text-orange-600 shadow-sm"
                    : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                }`}
                data-testid={`button-obra-venta-periodo-${p.valor}`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <Input
            value={filtroDoc}
            onChange={(e) => setFiltroDoc(e.target.value)}
            placeholder="Filtrar por N°, tipo u obra…"
            className="h-8 rounded-xl text-xs flex-1 min-w-[140px]"
            data-testid="input-obra-filtrar-docs"
          />
          <span className="text-[11px] text-slate-400 tabular-nums flex-shrink-0">
            {isFetching ? "Buscando…" : `${candidatos.length} de ${candidatosCrudos.length}`}
          </span>
        </div>
        <div className="max-h-80 max-sm:max-h-none max-sm:flex-1 max-sm:min-h-0 overflow-y-auto -mx-1 px-1">
          {/* La consulta al ERP puede tardar medio minuto: se avisa con texto,
              si no el "0 de 0" se leía como que el cliente no tenía nada. */}
          {isFetching && (
            <div className="py-8 text-center" data-testid="text-buscando-documentos">
              <Loader2 className="h-6 w-6 animate-spin mx-auto text-[#fd6301]" />
              <p className="mt-2 text-sm font-medium text-slate-600 dark:text-slate-300">Buscando documentos en el ERP…</p>
              <p className="text-xs text-slate-400">Puede tardar hasta un minuto.</p>
            </div>
          )}
          {!isFetching && candidatos.length === 0 && (
            <div className="py-8 text-center text-sm text-slate-400">
              {candidatosCrudos.length > 0
                ? "Ningún documento con ese filtro en el período"
                : "Este cliente no tiene documentos en el período. Prueba con “Todo”."}
            </div>
          )}
          {candidatos.map((c) => {
            const k = `${c.origen}|${c.idmaeedo}`;
            const elegido = elegidos.has(k);
            const enOtraObra = !!c.obraId && c.obraId !== obraId;
            const enEsta = c.obraId === obraId;
            return (
              <button
                key={k}
                type="button"
                disabled={enEsta}
                onClick={() => alternar(c)}
                // En celular, dos líneas: arriba tipo, N°, fecha y monto; abajo la
                // observación (dice de qué obra es) y el aviso si ya está en otra.
                className={`w-full flex items-center max-sm:flex-wrap gap-2.5 max-sm:gap-x-2 max-sm:gap-y-1 px-3 py-2.5 rounded-xl text-left text-xs transition-colors ${
                  enEsta
                    ? "opacity-50 cursor-default"
                    : elegido
                      ? "bg-orange-50 dark:bg-orange-950/30"
                      : "hover:bg-slate-50 dark:hover:bg-slate-800/60"
                }`}
                data-testid={`option-obra-venta-${c.origen}-${c.idmaeedo}`}
              >
                <span
                  className={`h-4 w-4 rounded border flex-shrink-0 flex items-center justify-center ${
                    elegido ? "bg-[#fd6301] border-[#fd6301]" : "border-slate-300 dark:border-slate-600"
                  }`}
                >
                  {elegido && <span className="text-white text-[10px] leading-none">✓</span>}
                </span>
                <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 w-8 sm:w-10 flex-shrink-0">
                  {c.tido ?? c.origen}
                </span>
                <span className="font-bold tabular-nums text-slate-700 dark:text-slate-200 sm:w-20 flex-shrink-0">
                  {c.nudo ?? "—"}
                </span>
                <span className="text-slate-400 tabular-nums sm:w-24 flex-shrink-0">{fecha(c.fechaEmision)}</span>
                <span className="flex-1 min-w-0 max-sm:order-last max-sm:basis-full max-sm:pl-6">
                  <span className="hidden sm:block truncate text-slate-500 dark:text-slate-400">{c.clienteNombre ?? "—"}</span>
                  {c.observacion && (
                    <span className="block truncate text-[11px] text-slate-400" title={c.observacion}>
                      {c.observacion}
                    </span>
                  )}
                </span>
                <span className="tabular-nums font-semibold text-slate-700 dark:text-slate-200 flex-shrink-0 max-sm:ml-auto">
                  {pesos(c.monto)}
                </span>
                {/* Un documento colgado de dos obras contaría la compra dos
                    veces: se avisa antes, no después. */}
                {enEsta && (
                  <span className="text-[10px] uppercase font-bold text-emerald-600 flex-shrink-0 max-sm:order-last max-sm:pl-6">Ya está</span>
                )}
                {enOtraObra && (
                  <span className="text-[10px] uppercase font-bold text-amber-600 flex-shrink-0 max-w-[120px] truncate max-sm:order-last max-sm:pl-6 max-sm:max-w-full">
                    En {c.obraNombre}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        </>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" className="rounded-2xl" onClick={onCerrar}>
            Cancelar
          </Button>
          <Button
            disabled={elegidos.size === 0 || asociar.isPending}
            onClick={() =>
              asociar.mutate(
                Array.from(elegidos).map((k) => {
                  const [origen, idmaeedo] = k.split("|");
                  return { origen: origen as Origen, idmaeedo };
                }),
              )
            }
            className="rounded-2xl bg-[#fd6301] hover:bg-[#e35400] text-white"
            data-testid="button-obra-confirmar-asociar"
          >
            {asociar.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Asociar {elegidos.size > 0 ? `(${elegidos.size})` : ""}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Lo que trae un documento asociado (sus productos, cantidad y monto) y, si es
 * una factura, el PDF oficial del ERP. Se abre al pinchar su número.
 */
function DetalleDocumento({ vinculoId, idmaeedo, tido }: { vinculoId: string; idmaeedo: string; tido: string | null }) {
  const { user } = useAuth();
  const { data: lineas = [], isLoading } = useQuery<Array<{ kopr: string | null; nombre: string | null; cantidad: number; monto: number }>>({
    queryKey: ["/api/obras/ventas", vinculoId, "lineas"],
    queryFn: async () => {
      const res = await apiRequest(`/api/obras/ventas/${vinculoId}/lineas`);
      return res.json();
    },
  });
  // El PDF timbrado sale de la ruta de facturas del ERP (solo facturas; la deja
  // ver a admin, supervisor y encargado de área). Una nota de venta no tiene DTE.
  const esDte = !!tido && tido.trim().toUpperCase().startsWith("F");
  const puedePdf = ["admin", "supervisor", "encargado_area"].includes((user as any)?.role ?? "");

  return (
    <div className="mx-4 mb-3 rounded-xl border border-slate-200/70 dark:border-slate-700/60 bg-slate-50/60 dark:bg-slate-900/30 px-3 py-2">
      {isLoading ? (
        <div className="flex items-center gap-2 text-slate-400 py-1">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Cargando…
        </div>
      ) : lineas.length === 0 ? (
        <p className="text-slate-400 py-1">Sin productos guardados para este documento.</p>
      ) : (
        <table className="w-full">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-slate-400">
              <th className="text-left font-bold py-1">Producto</th>
              <th className="text-right font-bold py-1 px-2">Cant.</th>
              <th className="text-right font-bold py-1">Monto</th>
            </tr>
          </thead>
          <tbody>
            {lineas.map((l, i) => (
              <tr key={i} className="border-t border-slate-200/60 dark:border-slate-700/40">
                <td className="py-1 pr-2">
                  <div className="text-slate-700 dark:text-slate-200">{l.nombre ?? l.kopr ?? "—"}</div>
                  {l.kopr && <div className="text-[10px] text-slate-400 tabular-nums">{l.kopr}</div>}
                </td>
                <td className="py-1 px-2 text-right tabular-nums text-slate-600 dark:text-slate-300 whitespace-nowrap">
                  {fmtCantidad(l.cantidad)}
                </td>
                <td className="py-1 text-right tabular-nums font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap">
                  {pesos(l.monto)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {esDte && puedePdf && (
        <a
          href={`/api/erp/facturas/${idmaeedo}/pdf`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-1 font-semibold text-[#fd6301] hover:underline"
          data-testid={`link-pdf-documento-${vinculoId}`}
        >
          <ExternalLink className="h-3 w-3" />
          Ver PDF del documento
        </a>
      )}
    </div>
  );
}

const fmtCantidad = (n: number) => new Intl.NumberFormat("es-CL", { maximumFractionDigits: 1 }).format(n);
