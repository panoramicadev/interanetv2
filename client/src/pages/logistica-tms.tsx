import TmsOrdersPanel from "@/components/logistica/tms-orders-panel";
import { Truck } from "lucide-react";

export default function LogisticaTms() {
  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-y-auto w-full">
      <main className="flex-1 w-full max-w-[1600px] mx-auto p-4 lg:p-8 space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-[#FF6E23] flex items-center justify-center">
            <Truck className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Despachos (TMS)</h1>
            <p className="text-sm text-gray-500">
              Estado real de todas las órdenes en el sistema de envíos. Buscá por RUT para ver las de un cliente puntual.
            </p>
          </div>
        </div>
        <TmsOrdersPanel />
      </main>
    </div>
  );
}
