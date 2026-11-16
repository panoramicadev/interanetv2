import ErpOrdersTable from "@/components/ecommerce/erp-orders-table";
import PedidosEmpresaExterna from "@/components/empresa-externa/pedidos-empresa-externa";
import { useEmpresaExterna } from "@/hooks/use-empresa-externa";

// Vista de Pedidos del vendedor: usa el mismo listado de pedidos del ERP que ve
// el admin en Panorámica Market → Pedidos. El endpoint /api/ecommerce/erp-orders
// filtra los documentos por el vendedor logueado (rol salesperson), así que el
// vendedor solo ve sus propios pedidos con la misma UI (KPIs, filtros y detalle).
//
// Un usuario de empresa externa (Pinturería del Sur) ve las notas de venta de
// SU empresa, leídas desde Random.
export default function SeguimientoPedidos() {
  const { empresa } = useEmpresaExterna();
  if (empresa) return <PedidosEmpresaExterna />;

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Pedidos</h1>
        <p className="text-sm text-gray-500 mt-1">
          Listado de tus pedidos del ERP. Los pedidos ingresados desde Panorámica Market quedan destacados.
        </p>
      </div>

      <ErpOrdersTable />
    </div>
  );
}
