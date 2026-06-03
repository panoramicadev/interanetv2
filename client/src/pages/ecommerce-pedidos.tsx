import ErpOrdersTable from "@/components/ecommerce/erp-orders-table";

export default function EcommercePedidos() {
  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Pedidos</h1>
        <p className="text-sm text-gray-500 mt-1">Listado de pedidos del ERP. Los pedidos ingresados desde Panorámica Market quedan destacados.</p>
      </div>

      <ErpOrdersTable />
    </div>
  );
}
