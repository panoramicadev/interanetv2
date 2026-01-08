import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { CartProvider } from "@/contexts/CartContext";
import { FilterProvider } from "@/contexts/FilterContext";
import { UpdateNotification } from "@/components/UpdateNotification";
import { 
  canViewCMMS, 
  canViewCMMSDashboard,
  canAccessCMMSFull, 
  canAccessPlanesPreventivos, 
  canAccessMantencionesPlanificadas, 
  canAccessGastosMateriales, 
  canViewCalendar 
} from "@/lib/cmmsPermissions";
import DashboardLayout from "@/components/layout/dashboard-layout";
import Landing from "@/pages/landing";
import Login from "@/pages/login";
import Shop from "@/pages/shop";
import Tienda from "@/pages/tienda";
import CatalogoPublico from "@/pages/catalogo-publico";
import Dashboard from "@/pages/dashboard";
import SalespersonDashboard from "@/pages/salesperson-dashboard";
import SupervisorDashboard from "@/pages/supervisor-dashboard";
import TecnicoObraDashboard from "@/pages/tecnico-obra-dashboard";
import MisVendedoresPage from "@/pages/mis-vendedores";
import ClientsDashboard from "@/pages/clients-dashboard";
import ClientBuyerDashboard from "@/pages/client-buyer-dashboard";
import Metas from "@/pages/metas";
import TareasPage from "@/pages/tareas";
import CRMPage from "@/pages/crm";
import NVVPage from "@/pages/nvv";
import PromesasCompraPage from "@/pages/promesas-compra";
import Users from "@/pages/users";
import Products from "@/pages/products";
import Clients from "@/pages/clients";
import OrdenesPage from "@/pages/ordenes";
import ListaPrecios from "@/pages/lista-precios";
import SegmentDetail from "@/pages/segment-detail";
import SucursalDetail from "@/pages/sucursal-detail";
import SalespersonDetail from "@/pages/salesperson-detail";
import ClientDetail from "@/pages/client-detail";
import ProductDetail from "@/pages/product-detail";
import TomadorPedidos from "@/pages/tomador-pedidos";
import PresupuestosAvanzados from "@/pages/presupuestos-avanzados";
import EcommerceAdmin from "@/pages/ecommerce-admin";
import ShopifyProducts from "@/pages/shopify-products";
import Carrito from "@/pages/carrito";
import QuotesPage from "@/pages/quotes";
import OrdersPage from "@/pages/orders";
import VisitasTecnicasPage from "@/pages/visitas-tecnicas";
import ReclamosGeneralesPage from "@/pages/reclamos-generales";
import ReclamoResolucionPage from "@/pages/reclamo-resolucion";
import MantencionesPage from "@/pages/mantenciones";
import CMMSDashboard from "@/pages/cmms-dashboard";
import CMMSEquipos from "@/pages/cmms-equipos";
import CMmsProveedores from "@/pages/cmms-proveedores";
import CMmsPresupuesto from "@/pages/cmms-presupuesto";
import CMmsGastosMateriales from "@/pages/cmms-gastos-materiales";
import CMmsPlanesPreventivos from "@/pages/cmms-planes-preventivos";
import CmmsMantencionesPlanificadas from "@/pages/cmms-mantenciones-planificadas";
import CMmsCalendario from "@/pages/cmms-calendario";
import ApiKeysPage from "@/pages/api-keys";
import Marketing from "@/pages/marketing";
import Inventario from "@/pages/inventario";
import GastosEmpresariales from "@/pages/gastos-empresariales";
import GastosEmpresarialesForm from "@/pages/gastos-empresariales-form";
import GastosEmpresarialesDashboard from "@/pages/gastos-empresariales-dashboard";
import GestionFondos from "@/pages/gestion-fondos";
import Notificaciones from "@/pages/notificaciones";
import AdminCatalogos from "@/pages/admin-catalogos";
import Reception from "@/pages/reception";
import TintometriaAdmin from "@/pages/tintometria-admin";
import TintometriaCalculadora from "@/pages/tintometria-calculadora";
import TintometriaSelector from "@/pages/tintometria-selector";
import Facturas from "@/pages/facturas";
import FacturasMainPage from "@/pages/facturas-main";
import MetricasProductos from "@/pages/metricas-productos";
import ETLMonitor from "@/pages/etl-monitor";
import DateSelectorDemo from "@/pages/date-selector-demo";
import ConfiguracionPage from "@/pages/configuracion";
import NotFound from "@/pages/not-found";

function Router() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <Switch>
      {/* Tienda pública accesible para todos */}
      <Route path="/tienda">{() => <Tienda />}</Route>
      <Route path="/shop">{() => <Shop />}</Route>
      <Route path="/carrito">{() => <Carrito />}</Route>

      {/* Catálogo público de vendedores */}
      <Route path="/catalogo/:slug">{() => <CatalogoPublico />}</Route>

      {!user ? (
        <>
          <Route path="/" component={Login} />
          <Route path="/login" component={Login} />
          <Route path="/landing" component={Landing} />
          <Route component={Login} />
        </>
      ) : (
        <DashboardLayout>
          <Switch>
            {/* Ruta principal - Dashboard según rol */}
            <Route path="/" component={() => {
              switch (user.role) {
                case 'admin':
                case 'supervisor':
                case 'logistica_bodega':
                  return <Dashboard />;
                case 'salesperson':
                  return <SalespersonDashboard />;
                case 'tecnico_obra':
                  return <VisitasTecnicasPage />;
                case 'reception':
                  return <Reception />;
                case 'client':
                  // Los clientes van directamente al ecommerce
                  window.location.replace('/tienda');
                  return null;
                case 'jefe_planta':
                case 'mantencion':
                  // Roles de mantención van al módulo de mantenciones
                  return <MantencionesPage />;
                case 'recursos_humanos':
                  // Recursos humanos va directamente a la gestión de gastos
                  window.location.replace('/gastos-empresariales');
                  return null;
                case 'produccion':
                case 'planificacion':
                case 'bodega_materias_primas':
                case 'prevencion_riesgos':
                case 'laboratorio':
                case 'area_produccion':
                case 'area_logistica':
                case 'area_aplicacion':
                case 'area_materia_prima':
                case 'area_colores':
                case 'area_envase':
                case 'area_etiqueta':
                  // Roles de laboratorio y áreas responsables van a Reclamos Generales
                  return <ReclamosGeneralesPage />;
                default:
                  return <Dashboard />;
              }
            }} />

            {/* Rutas específicas de admin */}
            <Route path="/facturas" component={FacturasMainPage} />
            <Route path="/nvv" component={FacturasMainPage} />
            <Route path="/crm" component={() => {
              // Solo admin, supervisor y salesperson pueden acceder al CRM
              if (!user?.role || !['admin', 'supervisor', 'salesperson'].includes(user.role)) {
                window.location.replace('/');
                return null;
              }
              return <CRMPage />;
            }} />
            <Route path="/tareas" component={TareasPage} />
            <Route path="/usuarios" component={Users} />
            <Route path="/admin-catalogos" component={AdminCatalogos} />
            <Route path="/productos" component={Products} />
            <Route path="/lista-precios" component={ListaPrecios} />
            <Route path="/ecommerce" component={EcommerceAdmin} />
            <Route path="/shopify-products" component={ShopifyProducts} />
            <Route path="/clientes" component={Clients} />
            <Route path="/ordenes" component={OrdenesPage} />
            <Route path="/pedidos" component={() => {
              // Redirect from /pedidos to /tomador-pedidos recientes tab
              window.location.replace('/tomador-pedidos?tab=recientes');
              return null;
            }} />
            <Route path="/products" component={() => {
              // Redirect from /products to /productos
              window.location.replace('/productos');
              return null;
            }} />
            <Route path="/metas" component={Metas} />
            <Route path="/promesas-compra" component={() => {
              // Solo admin, supervisor y salesperson pueden acceder a promesas de compra
              if (!user?.role || !['admin', 'supervisor', 'salesperson'].includes(user.role)) {
                window.location.replace('/');
                return null;
              }
              return <PromesasCompraPage />;
            }} />
            <Route path="/tomador-pedidos" component={TomadorPedidos} />
            <Route path="/presupuestos-avanzados" component={PresupuestosAvanzados} />
            <Route path="/tareas" component={TareasPage} />
            <Route path="/visitas-tecnicas" component={VisitasTecnicasPage} />
            <Route path="/reclamos-generales" component={ReclamosGeneralesPage} />
            <Route path="/reclamos/resolucion/:id" component={ReclamoResolucionPage} />
            <Route path="/mantenciones" component={MantencionesPage} />
            <Route path="/cmms" component={() => {
              // Solo roles con gestión pueden ver el dashboard CMMS (admin, jefe_planta, mantencion, supervisor)
              if (!canViewCMMSDashboard(user?.role)) {
                window.location.replace('/');
                return null;
              }
              return <CMMSDashboard />;
            }} />
            <Route path="/cmms/dashboard" component={() => {
              // Solo roles con gestión pueden ver el dashboard CMMS (admin, jefe_planta, mantencion, supervisor)
              if (!canViewCMMSDashboard(user?.role)) {
                window.location.replace('/');
                return null;
              }
              return <CMMSDashboard />;
            }} />
            <Route path="/cmms/equipos" component={() => {
              // Solo admin y jefe_planta pueden gestionar equipos
              if (!canAccessCMMSFull(user?.role)) {
                window.location.replace('/');
                return null;
              }
              return <CMMSEquipos />;
            }} />
            <Route path="/cmms/proveedores" component={() => {
              // Solo admin y jefe_planta pueden gestionar proveedores
              if (!canAccessCMMSFull(user?.role)) {
                window.location.replace('/');
                return null;
              }
              return <CMmsProveedores />;
            }} />
            <Route path="/cmms/presupuesto" component={() => {
              // Solo admin y jefe_planta pueden gestionar presupuesto
              if (!canAccessCMMSFull(user?.role)) {
                window.location.replace('/');
                return null;
              }
              return <CMmsPresupuesto />;
            }} />
            <Route path="/cmms/gastos-materiales" component={() => {
              // Solo admin y jefe_planta pueden ver gastos de materiales
              if (!canAccessGastosMateriales(user?.role)) {
                window.location.replace('/');
                return null;
              }
              return <CMmsGastosMateriales />;
            }} />
            <Route path="/cmms/planes-preventivos" component={() => {
              // Admin, jefe_planta y mantencion pueden gestionar planes preventivos
              if (!canAccessPlanesPreventivos(user?.role)) {
                window.location.replace('/');
                return null;
              }
              return <CMmsPlanesPreventivos />;
            }} />
            <Route path="/cmms/mantenciones-planificadas" component={() => {
              // Admin, jefe_planta y mantencion pueden gestionar mantenciones planificadas
              if (!canAccessMantencionesPlanificadas(user?.role)) {
                window.location.replace('/');
                return null;
              }
              return <CmmsMantencionesPlanificadas />;
            }} />
            <Route path="/cmms/calendario" component={() => {
              // Todos los roles de planta pueden ver el calendario
              if (!canViewCalendar(user?.role)) {
                window.location.replace('/');
                return null;
              }
              return <CMmsCalendario />;
            }} />
            <Route path="/marketing" component={Marketing} />
            <Route path="/inventario" component={Inventario} />
            <Route path="/gastos-empresariales" component={GastosEmpresariales} />
            <Route path="/gestion-fondos" component={() => {
              window.location.replace('/gastos-empresariales');
              return null;
            }} />
            <Route path="/notificaciones" component={Notificaciones} />
            <Route path="/api-keys" component={ApiKeysPage} />
            <Route path="/gastos-empresariales/nuevo" component={GastosEmpresarialesForm} />
            <Route path="/gastos-empresariales/dashboard" component={GastosEmpresarialesDashboard} />
            <Route path="/etl-monitor" component={ETLMonitor} />
            <Route path="/configuracion" component={ConfiguracionPage} />
            <Route path="/date-selector-demo" component={DateSelectorDemo} />

            {/* Rutas de Tintometría */}
            <Route path="/tintometria" component={() => {
              // Redirect to admin by default
              window.location.replace('/tintometria/admin');
              return null;
            }} />
            <Route path="/tintometria/admin" component={TintometriaAdmin} />
            <Route path="/tintometria/calculadora" component={TintometriaCalculadora} />
            <Route path="/tintometria/selector" component={TintometriaSelector} />

            <Route path="/segment/:segmentName">
              {(params: any) => <SegmentDetail segmentName={params.segmentName} />}
            </Route>
            <Route path="/sucursal/:branchName">
              {(params: any) => <SucursalDetail branchName={params.branchName} />}
            </Route>
            <Route path="/salesperson/:salespersonName">
              {(params: any) => <SalespersonDetail salespersonName={params.salespersonName} />}
            </Route>
            <Route path="/client/:clientName" component={ClientDetail} />
            <Route path="/product/:productName" component={ProductDetail} />
            <Route path="/metricas-productos" component={MetricasProductos} />

            {/* Rutas específicas de vendedor */}
            <Route path="/mis-clientes" component={ClientsDashboard} />
            <Route path="/presupuestos" component={() => {
              // Redirect from /presupuestos to /tomador-pedidos recientes tab
              window.location.replace('/tomador-pedidos?tab=recientes');
              return null;
            }} />

            {/* Rutas específicas de supervisor */}
            <Route path="/mis-vendedores" component={MisVendedoresPage} />
            <Route path="/reportes" component={() => <div className="p-6"><h1 className="text-2xl font-bold">Reportes</h1><p>Página en construcción</p></div>} />

            {/* Rutas específicas de cliente */}
            <Route path="/mis-pedidos" component={() => <div className="p-6"><h1 className="text-2xl font-bold">Mis Pedidos</h1><p>Página en construcción</p></div>} />
            <Route path="/solicitar-cotizacion" component={() => <div className="p-6"><h1 className="text-2xl font-bold">Solicitar Cotización</h1><p>Página en construcción</p></div>} />

            {/* 404 para rutas no encontradas */}
            <Route component={NotFound} />
          </Switch>
        </DashboardLayout>
      )}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <FilterProvider>
        <CartProvider>
          <TooltipProvider>
            <Router />
            <UpdateNotification />
          </TooltipProvider>
        </CartProvider>
      </FilterProvider>
    </QueryClientProvider>
  );
}

export default App;
