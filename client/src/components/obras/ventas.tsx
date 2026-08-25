/**
 * Compras de la obra — lo que la obra le compró de verdad a Panorámica.
 *
 * La planilla lleva a mano lo pedido y lo entregado; esto trae lo que dice el
 * sistema de la empresa. Se asocian los documentos (facturas, notas de venta y
 * guías de despacho) a la obra y de ahí sale, producto por producto, cuánto se
 * compró contra lo que se proyectó al empezar.
 *
 * Los tres orígenes van SEPARADOS y no se suman: una nota de venta que después
 * se factura y se despacha es la misma compra apareciendo tres veces. Por eso
 * son tres columnas y no un total (ver server/obras-ventas.ts).
 *
 * El documento puede venir a nombre de otro cliente: en muchas obras el material
 * lo compra el contratista, no la constructora. Por eso el buscador no se acota
 * al RUT de la obra.
 */
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { etiquetaCortaUnidad } from "@/components/obras/unidades";
import { fmtDec } from "@/components/obras/formato";
import type { ObraProducto } from "@shared/schema";
import { AlertTriangle, FileText, Link2, Loader2, Plus, Search, Truck, X } from "lucide-react";

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
}

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
}

interface ClienteConDocumentos {
  rut: string;
  nombre: string;
  documentos: number;
  ultimaCompra: string | null;
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
  obraId: string | null;
  obraNombre: string | null;
}

const pesos = (valor: number | string | null | undefined) =>
  `$${Math.round(Number(valor ?? 0)).toLocaleString("es-CL")}`;

const fecha = (iso: string | null) =>
  iso ? iso.split("-").reverse().join("-") : "—";

/** Los SKU se comparan sin espacios ni mayúsculas: el ERP los escribe de las dos formas. */
const clave = (kopr: string | null | undefined) => (kopr ?? "").trim().toUpperCase();

export function ComprasObra({
  obraId,
  obraNombre,
  clienteNombre,
  productos,
}: {
  obraId: string;
  obraNombre: string;
  clienteNombre?: string | null;
  productos: ObraProducto[];
}) {
  const { toast } = useToast();
  const [dialogBuscar, setDialogBuscar] = useState(false);

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
      toast({ title: "Documento sacado de la obra" });
    },
    onError: (error: any) => {
      toast({ title: "No se pudo sacar el documento", description: error?.message, variant: "destructive" });
    },
  });

  /**
   * Una fila por producto: lo proyectado al empezar contra lo comprado en cada
   * uno de los tres orígenes. Abajo van los SKU que se compraron y no estaban
   * proyectados, que es justo lo que la planilla no mostraba.
   */
  const filas = useMemo(() => {
    const comprado = new Map<string, Record<Origen, number>>();
    const nombres = new Map<string, string>();
    for (const p of data?.productos ?? []) {
      const k = clave(p.kopr);
      if (!k) continue;
      const acum = comprado.get(k) ?? { facturado: 0, nvv: 0, gdv: 0 };
      acum[p.origen] += p.cantidad;
      comprado.set(k, acum);
      if (p.nombre && !nombres.has(k)) nombres.set(k, p.nombre);
    }

    const proyectadas = productos.map((p) => {
      const k = clave(p.kopr);
      const c = comprado.get(k);
      if (k) comprado.delete(k);
      return {
        clave: p.id,
        nombre: p.nombre,
        color: p.color,
        unidad: p.unidad,
        proyectado: Number(p.cantidadProyectada ?? 0),
        compras: c ?? { facturado: 0, nvv: 0, gdv: 0 },
        fueraDePlan: false,
      };
    });

    // Lo que quedó en el mapa se compró sin estar en la planilla de la obra.
    const sueltas = Array.from(comprado.entries()).map(([k, c]) => ({
      clave: `fuera-${k}`,
      nombre: nombres.get(k) ?? k,
      color: null as string | null,
      unidad: null as string | null,
      proyectado: 0,
      compras: c,
      fueraDePlan: true,
    }));

    return [...proyectadas, ...sueltas];
  }, [data?.productos, productos]);

  const hayCompras = (data?.documentos?.length ?? 0) > 0;

  return (
    <div className="rounded-2xl border border-slate-200/70 dark:border-slate-700/60 bg-white dark:bg-slate-900/60 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-slate-200/70 dark:border-slate-700/60">
        <div className="min-w-0">
          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">Compras de la obra</h4>
          <p className="text-[11px] text-slate-400">
            Lo que la obra compró de verdad, contra lo que se proyectó al empezar
          </p>
        </div>
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
            Busca los documentos por número de factura, nombre o RUT. Ojo: si el material lo compró el
            contratista, el documento va a estar a su nombre y no al de la constructora.
          </p>
        </div>
      ) : (
        <>
          {/* Los tres van por separado a propósito: sumarlos contaría la misma
              compra hasta tres veces (nota de venta → factura → guía). */}
          <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-200/70 dark:divide-slate-700/60 border-b border-slate-200/70 dark:border-slate-700/60">
            {ORIGENES.map(({ clave: k, titulo, icono, color }) => (
              <div key={k} className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className={color}>{icono}</span>
                  <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400">{titulo}</span>
                </div>
                <div className="text-lg font-bold text-slate-900 dark:text-slate-100 tabular-nums mt-1">
                  {pesos(data?.totales?.[k]?.monto)}
                </div>
                <div className="text-[11px] text-slate-400">
                  {data?.totales?.[k]?.documentos ?? 0} documento
                  {(data?.totales?.[k]?.documentos ?? 0) === 1 ? "" : "s"}
                </div>
              </div>
            ))}
          </div>

          {/* Comparación por producto */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[640px]">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-200/70 dark:border-slate-700/60">
                  <th className="text-left font-bold px-4 py-2">Producto</th>
                  <th className="text-center font-bold px-2 py-2">Proyectado</th>
                  {ORIGENES.map((o) => (
                    <th key={o.clave} className="text-center font-bold px-2 py-2">{o.corto}</th>
                  ))}
                  <th className="text-center font-bold px-2 py-2">Falta comprar</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => {
                  // "Falta comprar" se mide contra lo facturado: es la única de
                  // las tres que dice que la compra ya está cerrada.
                  const falta = f.proyectado - f.compras.facturado;
                  return (
                    <tr
                      key={f.clave}
                      className="border-b border-slate-100 dark:border-slate-700/40 last:border-0"
                    >
                      <td className="px-4 py-2">
                        <div className="font-semibold text-slate-700 dark:text-slate-200">{f.nombre}</div>
                        <div className="flex flex-wrap items-center gap-x-2 text-[10px] text-slate-400">
                          {f.color && <span className="uppercase">{f.color}</span>}
                          {f.unidad && <span>{etiquetaCortaUnidad(f.unidad)}</span>}
                          {f.fueraDePlan && (
                            <span className="inline-flex items-center gap-1 font-bold text-amber-600">
                              <AlertTriangle className="h-3 w-3" />
                              No estaba proyectado
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-2 py-2 text-center tabular-nums text-slate-500">
                        {f.proyectado > 0 ? fmtDec(f.proyectado) : "—"}
                      </td>
                      {ORIGENES.map((o) => (
                        <td key={o.clave} className="px-2 py-2 text-center tabular-nums font-semibold text-slate-700 dark:text-slate-200">
                          {f.compras[o.clave] > 0 ? fmtDec(f.compras[o.clave]) : <span className="text-slate-300">—</span>}
                        </td>
                      ))}
                      <td className="px-2 py-2 text-center tabular-nums font-bold">
                        {f.proyectado <= 0 ? (
                          <span className="text-slate-300">—</span>
                        ) : falta > 0 ? (
                          <span className="text-slate-700 dark:text-slate-200">{fmtDec(falta)}</span>
                        ) : (
                          <span className="text-emerald-600">Completo</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Documentos asociados */}
          <div className="border-t border-slate-200/70 dark:border-slate-700/60">
            <div className="px-4 pt-3 pb-1 text-[10px] uppercase tracking-wider font-bold text-slate-400">
              Documentos asociados
            </div>
            <ul className="divide-y divide-slate-100 dark:divide-slate-700/40">
              {(data?.documentos ?? []).map((d) => (
                <li key={d.id} className="flex items-center gap-3 px-4 py-2">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 w-12 flex-shrink-0">
                    {d.tido ?? d.origen}
                  </span>
                  <span className="font-bold tabular-nums text-slate-700 dark:text-slate-200 w-20 flex-shrink-0">
                    {d.nudo ?? "—"}
                  </span>
                  <span className="text-slate-400 tabular-nums w-24 flex-shrink-0">{fecha(d.fechaEmision)}</span>
                  <span className="truncate flex-1 min-w-0 text-slate-500 dark:text-slate-400">
                    {d.clienteNombre ?? "—"}
                  </span>
                  <span className="tabular-nums font-semibold text-slate-700 dark:text-slate-200 flex-shrink-0">
                    {pesos(d.montoDocumento)}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={desasociar.isPending}
                    onClick={() => desasociar.mutate(d.id)}
                    className="h-7 w-7 rounded-lg text-slate-300 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 flex-shrink-0"
                    aria-label="Sacar de la obra"
                    data-testid={`button-obra-desasociar-${d.id}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        </>
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

  const termino = busqueda.trim();

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
  const candidatos = useMemo(() => {
    const t = filtroDoc.trim().toLowerCase();
    if (!t) return candidatosCrudos;
    return candidatosCrudos.filter(
      (c) => (c.nudo ?? "").toLowerCase().includes(t) || (c.tido ?? "").toLowerCase().includes(t),
    );
  }, [candidatosCrudos, filtroDoc]);

  const volverAClientes = () => {
    setCliente(null);
    setElegidos(new Set());
  };

  const asociar = useMutation({
    mutationFn: async (documentos: Array<{ origen: Origen; idmaeedo: string }>) => {
      const res = await apiRequest(`/api/obras/${obraId}/ventas`, { method: "POST", data: { documentos } });
      return res.json();
    },
    onSuccess: (resultado: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/obras", obraId, "ventas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/obras/ventas/buscar"] });
      setElegidos(new Set());
      onCerrar();
      const n = resultado?.asociados?.length ?? 0;
      toast({ title: n === 1 ? "Documento asociado a la obra" : `${n} documentos asociados a la obra` });
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
      <DialogContent className="sm:max-w-[720px] z-[70]" overlayClassName="z-[70]">
        <DialogTitle className="text-base font-bold flex items-center gap-2">
          <span className="w-8 h-8 rounded-xl bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400 flex items-center justify-center">
            <FileText className="h-4 w-4" />
          </span>
          Asociar documentos a {obraNombre}
        </DialogTitle>
        <DialogDescription className="text-sm text-muted-foreground">
          {cliente
            ? `Todos los documentos de ${cliente.nombre}. Marca los que son de esta obra.`
            : "Busca el cliente por nombre o RUT. Si el material lo compró el contratista, búscalo a él y no a la constructora."}
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
              placeholder="Nombre o RUT del cliente…"
              className="pl-9 rounded-2xl"
              data-testid="input-obra-buscar-venta"
            />
            {buscandoClientes && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-slate-300" />}
          </div>
        )}

        {/* Paso 1: elegir el cliente */}
        {!cliente && (
          <div className="max-h-80 overflow-y-auto -mx-1 px-1">
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
                Ningún cliente con ventas para esa búsqueda
              </div>
            )}
            {clientes.map((c) => (
              <button
                key={c.rut}
                type="button"
                onClick={() => setCliente(c)}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left text-xs hover:bg-orange-50/60 dark:hover:bg-orange-950/20 transition-colors"
                data-testid={`option-obra-venta-cliente-${c.rut}`}
              >
                <span className="truncate flex-1 min-w-0 font-semibold text-slate-700 dark:text-slate-200">
                  {c.nombre}
                </span>
                <span className="text-slate-400 tabular-nums flex-shrink-0">{c.rut}</span>
                <span className="text-slate-400 flex-shrink-0 w-24 text-right">
                  {c.documentos} doc{c.documentos === 1 ? "" : "s"}
                </span>
                <span className="text-slate-400 tabular-nums flex-shrink-0 w-24 text-right">
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
            placeholder="Filtrar por N° o tipo…"
            className="h-8 rounded-xl text-xs flex-1 min-w-[140px]"
            data-testid="input-obra-filtrar-docs"
          />
          <span className="text-[11px] text-slate-400 tabular-nums flex-shrink-0">
            {candidatos.length} de {candidatosCrudos.length}
          </span>
        </div>
        <div className="max-h-80 overflow-y-auto -mx-1 px-1">
          {isFetching && (
            <div className="py-8 text-center text-slate-300"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>
          )}
          {!isFetching && candidatos.length === 0 && (
            <div className="py-8 text-center text-sm text-slate-400">
              {candidatosCrudos.length > 0
                ? "Ningún documento con ese número en el período"
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
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left text-xs transition-colors ${
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
                <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 w-10 flex-shrink-0">
                  {c.tido ?? c.origen}
                </span>
                <span className="font-bold tabular-nums text-slate-700 dark:text-slate-200 w-20 flex-shrink-0">
                  {c.nudo ?? "—"}
                </span>
                <span className="text-slate-400 tabular-nums w-24 flex-shrink-0">{fecha(c.fechaEmision)}</span>
                <span className="truncate flex-1 min-w-0 text-slate-500 dark:text-slate-400">
                  {c.clienteNombre ?? "—"}
                </span>
                <span className="tabular-nums font-semibold text-slate-700 dark:text-slate-200 flex-shrink-0">
                  {pesos(c.monto)}
                </span>
                {/* Un documento colgado de dos obras contaría la compra dos
                    veces: se avisa antes, no después. */}
                {enEsta && (
                  <span className="text-[10px] uppercase font-bold text-emerald-600 flex-shrink-0">Ya está</span>
                )}
                {enOtraObra && (
                  <span className="text-[10px] uppercase font-bold text-amber-600 flex-shrink-0 max-w-[120px] truncate">
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
