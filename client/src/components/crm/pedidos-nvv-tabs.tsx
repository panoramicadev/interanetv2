/**
 * Pestañas de documentos ERP del detalle de Seguimiento de Clientes:
 * - PedidosTab: documentos detectados vía /detectar-compras (GDV/NVV/FCV).
 * - NVVTab: notas de venta y guías de los últimos 6 meses, agrupadas por documento.
 * Extraídas de seguimiento-clientes.tsx para que la lista y el detalle no
 * dependan entre sí. Usan react-query (con caché corta) porque Radix
 * desmonta las pestañas inactivas y /detectar-compras es costoso en el
 * servidor: sin caché, cada cambio de pestaña re-dispara el escaneo ERP.
 */
import { useQuery } from "@tanstack/react-query";
import { Link2, RefreshCw, ShoppingCart, FileText, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatCLP } from "@/lib/crm-seguimiento";

// Colores de estado de documento ERP (compartidos por ambas pestañas).
const ESTADO_DOC_COLORS: Record<string, string> = {
  "Facturado": "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  "Pendiente": "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
  "Anulado": "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  "En Proceso": "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  "Despachado": "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
};

function SinRutVinculado({ detalle }: { detalle: string }) {
  return (
    <div className="text-center py-8 text-muted-foreground">
      <Link2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
      <p className="text-sm font-medium">Sin RUT vinculado</p>
      <p className="text-xs mt-1">{detalle}</p>
    </div>
  );
}

function ErrorConReintento({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="text-center py-8 text-muted-foreground">
      <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-amber-500 opacity-70" />
      <p className="text-sm font-medium">No se pudieron cargar los documentos</p>
      <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
        <RefreshCw className="w-3 h-3 mr-1.5" />
        Reintentar
      </Button>
    </div>
  );
}

// ─── Pedidos Tab (inside detail page) ────────────────────────────────
export function PedidosTab({ client }: { client: any }) {
  const hasRut = !!(client.rut || client.clienteId);

  const { data: pedidos, isLoading, isError, refetch, isFetching } = useQuery<any[]>({
    queryKey: ["/api/crm/seguimiento", client.id, "detectar-compras"],
    queryFn: async () => {
      const res = await fetch(`/api/crm/seguimiento/${client.id}/detectar-compras`);
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const data = await res.json();
      return data.compras || [];
    },
    enabled: hasRut,
    staleTime: 60_000,
    retry: 1,
  });

  if (!hasRut) {
    return <SinRutVinculado detalle='Vincula un RUT en la pestaña "RUT / Compras" para ver pedidos.' />;
  }

  if (isError) {
    return <ErrorConReintento onRetry={() => refetch()} />;
  }

  if (isLoading || pedidos === undefined) {
    return (
      <div className="flex items-center justify-center py-8">
        <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (pedidos.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <ShoppingCart className="w-8 h-8 mx-auto mb-2 opacity-30" />
        <p className="text-sm font-medium">Sin pedidos registrados</p>
        <p className="text-xs mt-1">No se encontraron documentos de venta para este cliente.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium text-muted-foreground">{pedidos.length} documentos encontrados</p>
        <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching} className="h-7 text-xs">
          <RefreshCw className={`w-3 h-3 mr-1 ${isFetching ? "animate-spin" : ""}`} />
          Actualizar
        </Button>
      </div>
      <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
        {pedidos.map((p: any, i: number) => {
          const estadoLabel = p.eslido || "Pendiente";
          const estadoClass = ESTADO_DOC_COLORS[estadoLabel] || "bg-muted text-muted-foreground";
          return (
            <div key={p.id || i} className="bg-muted/20 border rounded-lg p-3 hover:bg-muted/30 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-semibold">{p.tido} #{p.nudo}</span>
                    <Badge className={`text-[10px] px-1.5 py-0 h-5 border-0 ${estadoClass}`}>
                      {estadoLabel}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 truncate">{p.nokoprct || "Sin detalle de producto"}</p>
                </div>
                <div className="text-right flex-shrink-0 ml-3">
                  <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                    {formatCLP(p.vanedo || 0)}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{formatDate(p.feemdo)}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── NVV Tab (Seguimiento Pedido / Notas de Venta) ────────────────────
export function NVVTab({ client }: { client: any }) {
  const hasRut = !!(client.rut || client.clienteId);

  const { data: nvvs, isLoading, isError, refetch, isFetching } = useQuery<any[]>({
    queryKey: ["/api/crm/seguimiento", client.id, "nvv"],
    queryFn: async () => {
      const res = await fetch(`/api/crm/seguimiento/${client.id}/nvv`);
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const data = await res.json();
      return data.nvvs || [];
    },
    enabled: hasRut,
    staleTime: 60_000,
    retry: 1,
  });

  if (!hasRut) {
    return <SinRutVinculado detalle='Vincula un RUT en la pestaña "RUT / Compras" para ver las NVV.' />;
  }

  if (isError) {
    return <ErrorConReintento onRetry={() => refetch()} />;
  }

  if (isLoading || nvvs === undefined) {
    return (
      <div className="flex items-center justify-center py-8">
        <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (nvvs.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
        <p className="text-sm font-medium">Sin pedidos en curso</p>
        <p className="text-xs mt-1">No se encontraron NVV o GDV para este cliente.</p>
      </div>
    );
  }

  // Group by tido+nudo to show grouped docs
  const groupedByNudo: Record<string, any[]> = {};
  for (const nvv of nvvs) {
    const key = `${nvv.tido}-${nvv.nudo || 'sin-numero'}`;
    if (!groupedByNudo[key]) groupedByNudo[key] = [];
    groupedByNudo[key].push(nvv);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium text-muted-foreground">
          {Object.keys(groupedByNudo).length} pedidos encontrados ({nvvs.length} líneas)
        </p>
        <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching} className="h-7 text-xs">
          <RefreshCw className={`w-3 h-3 mr-1 ${isFetching ? "animate-spin" : ""}`} />
          Actualizar
        </Button>
      </div>
      <div className="max-h-80 overflow-y-auto space-y-3 pr-1">
        {Object.entries(groupedByNudo).map(([nudo, items]) => {
          const firstItem = items[0];
          const estadoLabel = firstItem.eslido || firstItem.esdo || "Pendiente";
          const estadoClass = ESTADO_DOC_COLORS[estadoLabel] || "bg-muted text-muted-foreground";
          const totalMonto = items.reduce((sum: number, item: any) => sum + parseFloat(item.vanedo || "0"), 0);

          return (
            <div key={nudo} className="border rounded-lg overflow-hidden">
              {/* NVV Header */}
              <div className="bg-muted/30 px-3 py-2 flex items-center justify-between border-b">
                <div className="flex items-center gap-2">
                  <FileText className={`w-4 h-4 ${firstItem.tido === 'GDV' ? 'text-purple-500' : 'text-amber-500'}`} />
                  <span className="font-mono text-sm font-semibold">{firstItem.tido} #{firstItem.nudo}</span>
                  <Badge className={`text-[10px] px-1.5 py-0 h-5 border-0 ${estadoClass}`}>
                    {estadoLabel}
                  </Badge>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                    {formatCLP(totalMonto)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{formatDate(firstItem.feemdo)}</p>
                </div>
              </div>
              {/* Line items */}
              <div className="divide-y">
                {items.map((item: any, i: number) => (
                  <div key={item.id || i} className="px-3 py-1.5 flex items-center justify-between text-xs hover:bg-muted/10">
                    <span className="text-muted-foreground flex-1 truncate pr-2">
                      {item.nokoprct || "Sin detalle"}
                    </span>
                    <span className="font-medium text-right flex-shrink-0">
                      {formatCLP(item.vanedo || 0)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
