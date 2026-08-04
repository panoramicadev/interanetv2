import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, TrendingUp, BarChart3, Truck, DollarSign, FileSpreadsheet } from "lucide-react";
import { FacturasTable } from "@/components/facturas/facturas-table";
import NVVPage from "./nvv";
import GDVPage from "./gdv";
import ProyeccionPage from "./proyeccion";
import ListaPrecios from "./lista-precios";
import PresupuestoVentas from "./presupuesto-ventas";

export default function FacturasMainPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("lista-precios");

  // Check if the user is authorized
  if (!user || (user.role !== "admin" && (user.role !== "supervisor" && user.role !== "encargado_area") && user.role !== "logistica_bodega" && user.role !== "salesperson" && user.role !== "client" && user.role !== "reception")) {
    setLocation("/dashboard");
    return null;
  }

  // Check if user can see proyección tab
  const canSeeProyeccion = user.role !== 'salesperson';

  return (
    <div className="min-h-screen bg-white dark:bg-slate-900">
      {/* Modern SaaS Header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <div className="px-4 sm:px-6 lg:px-8 pt-6 pb-4">
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 bg-emerald-500/20 rounded-lg">
              <DollarSign className="h-5 w-5 text-emerald-400" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Finanzas</h1>
          </div>
          <p className="text-slate-400 text-sm ml-12">
            Precios, facturas, documentos y proyecciones
          </p>
        </div>

        {/* Tabs Navigation - inside header */}
        <div className="px-4 sm:px-6 lg:px-8">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="overflow-x-auto -mx-2 px-2 scrollbar-hide">
              <TabsList className="inline-flex min-w-max gap-0.5 p-1 bg-white/10 backdrop-blur-sm rounded-t-xl border-0 h-auto">
                <TabsTrigger
                  value="lista-precios"
                  className="flex items-center gap-1.5 whitespace-nowrap px-3 py-2 text-sm text-slate-300 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm rounded-lg transition-all duration-200 hover:text-white border-0"
                  data-testid="tab-lista-precios"
                >
                  <DollarSign className="h-3.5 w-3.5 flex-shrink-0" />
                  <span className="hidden sm:inline">Lista de Precios</span>
                  <span className="sm:hidden">Precios</span>
                </TabsTrigger>
                <TabsTrigger
                  value="facturas"
                  className="flex items-center gap-1.5 whitespace-nowrap px-3 py-2 text-sm text-slate-300 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm rounded-lg transition-all duration-200 hover:text-white border-0"
                  data-testid="tab-facturas"
                >
                  <FileText className="h-3.5 w-3.5 flex-shrink-0" />
                  <span className="hidden sm:inline">Facturas</span>
                  <span className="sm:hidden">Fact.</span>
                </TabsTrigger>
                <TabsTrigger
                  value="nvv"
                  className="flex items-center gap-1.5 whitespace-nowrap px-3 py-2 text-sm text-slate-300 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm rounded-lg transition-all duration-200 hover:text-white border-0"
                  data-testid="tab-nvv"
                >
                  <TrendingUp className="h-3.5 w-3.5 flex-shrink-0" />
                  <span className="hidden sm:inline">Notas de Venta</span>
                  <span className="sm:hidden">NVV</span>
                </TabsTrigger>
                <TabsTrigger
                  value="gdv"
                  className="flex items-center gap-1.5 whitespace-nowrap px-3 py-2 text-sm text-slate-300 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm rounded-lg transition-all duration-200 hover:text-white border-0"
                  data-testid="tab-gdv"
                >
                  <Truck className="h-3.5 w-3.5 flex-shrink-0" />
                  <span className="hidden sm:inline">Guías Despacho</span>
                  <span className="sm:hidden">GDV</span>
                </TabsTrigger>
                {canSeeProyeccion && (
                  <TabsTrigger
                    value="proyeccion"
                    className="flex items-center gap-1.5 whitespace-nowrap px-3 py-2 text-sm text-slate-300 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm rounded-lg transition-all duration-200 hover:text-white border-0"
                    data-testid="tab-proyeccion"
                  >
                    <BarChart3 className="h-3.5 w-3.5 flex-shrink-0" />
                    <span className="hidden sm:inline">Proyección</span>
                    <span className="sm:hidden">Proy.</span>
                  </TabsTrigger>
                )}
                <TabsTrigger
                  value="presupuesto-ventas"
                  className="flex items-center gap-1.5 whitespace-nowrap px-3 py-2 text-sm text-slate-300 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm rounded-lg transition-all duration-200 hover:text-white border-0"
                  data-testid="tab-presupuesto-ventas"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 flex-shrink-0" />
                  <span className="hidden sm:inline">Presupuesto</span>
                  <span className="sm:hidden">Presup.</span>
                </TabsTrigger>
              </TabsList>
            </div>
          </Tabs>
        </div>
      </div>

      {/* Tab Contents */}
      <div className="px-4 sm:px-6 lg:px-8 py-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          {/* Lista de Precios Tab */}
          <TabsContent value="lista-precios" className="mt-0">
            <ListaPrecios />
          </TabsContent>

          {/* Facturas Tab */}
          <TabsContent value="facturas" className="mt-0">
            <FacturasTable />
          </TabsContent>

          {/* NVV Tab */}
          <TabsContent value="nvv" className="mt-0">
            <NVVPage />
          </TabsContent>

          {/* GDV Tab */}
          <TabsContent value="gdv" className="mt-0">
            <GDVPage />
          </TabsContent>

          {/* Proyección Tab */}
          {canSeeProyeccion && (
            <TabsContent value="proyeccion" className="mt-0">
              <ProyeccionPage />
            </TabsContent>
          )}

          {/* Presupuesto Ventas Tab */}
          <TabsContent value="presupuesto-ventas" className="mt-0">
            <PresupuestoVentas />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

