import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, TrendingUp, BarChart3, Truck, DollarSign, FileSpreadsheet, Receipt } from "lucide-react";
import { FacturasTable } from "@/components/facturas/facturas-table";
import NVVPage from "./nvv";
import GDVPage from "./gdv";
import ProyeccionPage from "./proyeccion";
import ListaPrecios from "./lista-precios";
import PresupuestoVentas from "./presupuesto-ventas";
import DetalleFacturacion from "@/components/finanzas/detalle-facturacion";
import { ICONO_CHIP, ICONO_CHIP_ICONO } from "@/lib/icono-chip";
import { TABS_MODULO, TAB_MODULO } from "@/lib/tab-modulo";

export default function FacturasMainPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("lista-precios");

  // Check if the user is authorized
  if (!user || (user.role !== "admin" && (user.role !== "supervisor" && user.role !== "encargado_area") && user.role !== "logistica_bodega" && user.role !== "salesperson" && user.role !== "client" && user.role !== "reception" && user.role !== "planificacion")) {
    setLocation("/dashboard");
    return null;
  }

  // Check if user can see proyección tab
  // Planificación solo consulta precios y documentos: sin Proyección ni Presupuesto.
  // El admin trabaja solo con Lista de Precios y Detalle facturación (pedido nov-2026).
  // Los demás roles entran a sus documentos únicamente por estas pestañas: siguen igual.
  const canSeeDocumentos = user.role !== 'admin';
  const canSeeProyeccion = canSeeDocumentos && user.role !== 'salesperson' && user.role !== 'planificacion';
  const canSeePresupuesto = canSeeDocumentos && user.role !== 'planificacion';
  // Recepción lo tiene en su panel de inicio.
  const canSeeDetalleFacturacion = user.role === 'admin';

  return (
    <div className="min-h-screen bg-white dark:bg-slate-900">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900">
        <div className="px-4 sm:px-6 lg:px-8 pt-6 pb-4">
          <div className="flex items-center gap-3">
            <div className={ICONO_CHIP}>
              <DollarSign className={ICONO_CHIP_ICONO} />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">Finanzas</h1>
              <p className="hidden sm:block text-slate-500 dark:text-slate-400 text-sm">
                Precios, facturas, documentos y proyecciones
              </p>
            </div>
          </div>
        </div>

        {/* Tabs Navigation - inside header */}
        <div className="px-4 sm:px-6 lg:px-8">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="overflow-x-auto scrollbar-hide">
              <TabsList className={TABS_MODULO}>
                <TabsTrigger
                  value="lista-precios"
                  className={TAB_MODULO}
                  data-testid="tab-lista-precios"
                >
                  <DollarSign className="h-3.5 w-3.5 flex-shrink-0" />
                  <span className="hidden sm:inline">Lista de Precios / Costos / Margen</span>
                  <span className="sm:hidden">Precios</span>
                </TabsTrigger>
                {canSeeDocumentos && (
                  <>
                    <TabsTrigger
                      value="facturas"
                      className={TAB_MODULO}
                      data-testid="tab-facturas"
                    >
                      <FileText className="h-3.5 w-3.5 flex-shrink-0" />
                      <span className="hidden sm:inline">Facturas</span>
                      <span className="sm:hidden">Fact.</span>
                    </TabsTrigger>
                    <TabsTrigger
                      value="nvv"
                      className={TAB_MODULO}
                      data-testid="tab-nvv"
                    >
                      <TrendingUp className="h-3.5 w-3.5 flex-shrink-0" />
                      <span className="hidden sm:inline">Notas de Venta</span>
                      <span className="sm:hidden">NVV</span>
                    </TabsTrigger>
                    <TabsTrigger
                      value="gdv"
                      className={TAB_MODULO}
                      data-testid="tab-gdv"
                    >
                      <Truck className="h-3.5 w-3.5 flex-shrink-0" />
                      <span className="hidden sm:inline">Guías Despacho</span>
                      <span className="sm:hidden">GDV</span>
                    </TabsTrigger>
                  </>
                )}
                {canSeeProyeccion && (
                  <TabsTrigger
                    value="proyeccion"
                    className={TAB_MODULO}
                    data-testid="tab-proyeccion"
                  >
                    <BarChart3 className="h-3.5 w-3.5 flex-shrink-0" />
                    <span className="hidden sm:inline">Proyección</span>
                    <span className="sm:hidden">Proy.</span>
                  </TabsTrigger>
                )}
                {canSeePresupuesto && (
                  <TabsTrigger
                    value="presupuesto-ventas"
                    className={TAB_MODULO}
                    data-testid="tab-presupuesto-ventas"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5 flex-shrink-0" />
                    <span className="hidden sm:inline">Presupuesto</span>
                    <span className="sm:hidden">Presup.</span>
                  </TabsTrigger>
                )}
                {canSeeDetalleFacturacion && (
                  <TabsTrigger
                    value="detalle-facturacion"
                    className={TAB_MODULO}
                    data-testid="tab-detalle-facturacion"
                  >
                    <Receipt className="h-3.5 w-3.5 flex-shrink-0" />
                    <span className="hidden sm:inline">Detalle de Documentos</span>
                    <span className="sm:hidden">Detalle</span>
                  </TabsTrigger>
                )}
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

          {canSeeDocumentos && (
            <>
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
            </>
          )}

          {/* Proyección Tab */}
          {canSeeProyeccion && (
            <TabsContent value="proyeccion" className="mt-0">
              <ProyeccionPage />
            </TabsContent>
          )}

          {/* Presupuesto Ventas Tab */}
          {canSeePresupuesto && (
            <TabsContent value="presupuesto-ventas" className="mt-0">
              <PresupuestoVentas />
            </TabsContent>
          )}

          {/* Detalle Facturación Tab */}
          {canSeeDetalleFacturacion && (
            <TabsContent value="detalle-facturacion" className="mt-0">
              <DetalleFacturacion />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}

