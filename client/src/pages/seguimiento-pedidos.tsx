import ErpOrdersTable from "@/components/ecommerce/erp-orders-table";

// Vista de Pedidos del vendedor: usa el mismo listado de pedidos del ERP que ve
// el admin en Panorámica Market → Pedidos. El endpoint /api/ecommerce/erp-orders
// filtra los documentos por el vendedor logueado (rol salesperson), así que el
// vendedor solo ve sus propios pedidos con la misma UI (KPIs, filtros y detalle).
export default function SeguimientoPedidos() {
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
