import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Package, Search, Warehouse } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { bodegasInventarioDe } from "@shared/empresas-externas";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { pedirEmpresaExterna, useEmpresaExterna } from "@/hooks/use-empresa-externa";

interface Stock {
  codigo: string;
  producto: string;
  unidad: string;
  fisico: number;
  comprometido: number;
  disponible: number;
  /** Solo en la bodega propia: último costo de compra por unidad de stock. */
  ultimoCosto?: number | null;
  ultimoCostoFecha?: string | null;
}

const CLP = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });
const fechaCostoCorta = (f?: string | null) =>
  f ? new Date(f + "T00:00:00").toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "2-digit" }) : "";

const NUM = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 2 });
const normalizar = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Inventario de una empresa externa (Pinturería del Sur), leído en vivo desde
 * Random. Se elige la bodega: la propia (SUR) o una de Panorámica (Planta
 * Lautaro), para ver qué hay antes de comprar. Solo cantidades, sin costos.
 *
 * "Comprometido" es lo reservado por notas de venta abiertas. En la empresa 02
 * hay muchas notas antiguas que quedaron abiertas en el ERP, así que ese número
 * suele ser alto: el dato que manda es el stock físico.
 */
export default function InventarioEmpresaExterna() {
  const { empresa, consulta } = useEmpresaExterna();
  const [busqueda, setBusqueda] = useState("");
  const [soloConStock, setSoloConStock] = useState(true);
  const bodegas = empresa ? bodegasInventarioDe(empresa) : [];
  const [bodegaId, setBodegaId] = useState("propia");
  const bodega = bodegas.find((b) => b.id === bodegaId) || bodegas[0];
  // El costo es solo de la bodega propia; las de Panorámica van sin costos.
  const conCosto = bodegaId === "propia";

  const { data = [], isLoading, error } = useQuery<Stock[]>({
    queryKey: ["empresa-externa", "inventario", bodegaId, consulta],
    queryFn: () => pedirEmpresaExterna("inventario", { bodega: bodegaId }, consulta),
    staleTime: 2 * 60_000,
  });

  const filas = useMemo(() => {
    const q = normalizar(busqueda.trim());
    return data.filter(
      (s) =>
        (!soloConStock || s.fisico > 0) &&
        (!q || normalizar(s.producto).includes(q) || normalizar(s.codigo).includes(q)),
    );
  }, [data, busqueda, soloConStock]);

  return (
    <div className="p-3 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 bg-white dark:bg-slate-900 min-h-screen">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/25 shrink-0">
          <Package className="h-6 w-6 text-white" />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100" data-testid="text-page-title">Inventario</h1>
          <p className="hidden sm:block text-sm text-gray-500 dark:text-gray-400">
            Stock al día desde el sistema de facturación: tu bodega o la de Panorámica.
          </p>
        </div>
      </div>

      <div className="modern-card p-3 sm:p-4 flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3">
        {bodegas.length > 1 && (
          <div className="flex items-center gap-2">
            <Warehouse className="h-4 w-4 text-[#fd6301] shrink-0" />
            <Select value={bodegaId} onValueChange={setBodegaId}>
              <SelectTrigger className="h-9 w-full sm:w-[260px] rounded-xl" data-testid="select-bodega-empresa">
                <SelectValue>{bodega?.nombre}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {bodegas.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="relative flex-1 sm:min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre o código"
            className="pl-9 rounded-xl"
            data-testid="input-buscar-inventario-empresa"
          />
        </div>
        <div className="flex items-center justify-between sm:justify-start gap-3">
          <div className="flex items-center gap-2">
            <Switch id="solo-con-stock" checked={soloConStock} onCheckedChange={setSoloConStock} />
            <Label htmlFor="solo-con-stock" className="text-sm">Solo con stock</Label>
          </div>
          <span className="text-sm text-gray-500 dark:text-gray-400 tabular-nums">{filas.length} productos</span>
        </div>
      </div>

      {error ? (
        <div className="modern-card p-6 text-sm text-red-600">{(error as Error).message}</div>
      ) : isLoading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-[#fd6301]" />
        </div>
      ) : filas.length === 0 ? (
        <div className="modern-card p-10 text-center text-sm text-gray-500 dark:text-gray-400">
          No hay productos que coincidan con la búsqueda.
        </div>
      ) : (
        <>
          {/* Escritorio: tabla */}
          <div className="hidden md:block modern-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-gray-500 dark:text-gray-400">
                <tr>
                  <th className="text-left font-medium px-4 py-3">Producto</th>
                  <th className="text-left font-medium px-4 py-3">Código</th>
                  <th className="text-right font-medium px-4 py-3">Stock físico</th>
                  <th className="text-right font-medium px-4 py-3" title="Reservado por notas de venta abiertas">Comprometido</th>
                  <th className="text-right font-medium px-4 py-3">Disponible</th>
                  {conCosto && (
                    <th className="text-right font-medium px-4 py-3" title="Última factura de compra, neto por unidad de stock">Último costo</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filas.map((s) => (
                  <tr key={s.codigo} className="hover:bg-orange-50/50 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-2.5 text-gray-900 dark:text-gray-100">{s.producto}</td>
                    <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400 font-mono text-xs">{s.codigo}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-gray-900 dark:text-white">
                      {NUM.format(s.fisico)} <span className="font-normal text-gray-500">{s.unidad}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-gray-600 dark:text-gray-300">{NUM.format(s.comprometido)}</td>
                    <td className={`px-4 py-2.5 text-right tabular-nums ${s.disponible < 0 ? "text-[#fd6301]" : "text-gray-700 dark:text-gray-200"}`}>
                      {NUM.format(s.disponible)}
                    </td>
                    {conCosto && (
                      <td className="px-4 py-2.5 text-right tabular-nums text-gray-900 dark:text-gray-100">
                        {s.ultimoCosto ? (
                          <>
                            {CLP.format(s.ultimoCosto)}
                            <span className="block text-[10px] text-gray-400">{s.unidad && `por ${s.unidad} · `}{fechaCostoCorta(s.ultimoCostoFecha)}</span>
                          </>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Celular: lista */}
          <div className="md:hidden space-y-2">
            {filas.map((s) => (
              <div key={s.codigo} className="modern-card p-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{s.producto}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">{s.codigo}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold tabular-nums text-gray-900 dark:text-white">
                    {NUM.format(s.fisico)} {s.unidad}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">Disp. {NUM.format(s.disponible)}</p>
                  {conCosto && s.ultimoCosto ? (
                    <p className="text-xs text-gray-700 dark:text-gray-300 tabular-nums">Costo {CLP.format(s.ultimoCosto)}</p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
