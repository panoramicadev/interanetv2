import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { CartProvider } from "@/contexts/CartContext";
import { FilterProvider } from "@/contexts/FilterContext";
import { UpdateNotification } from "@/components/UpdateNotification";
import { TrackingScripts } from "@/components/tracking-scripts";
import { Guarded } from "@/components/guarded-route";
import { TourProvider, TourOverlay } from "@/components/guided-tour";
import DashboardLayout from "@/components/layout/dashboard-layout";
import ClientEcommerceLayout from "@/components/layout/client-ecommerce-layout";
import ClientOrderTracking from "@/pages/client-order-tracking";
import Landing from "@/pages/landing";
import Login from "@/pages/login";
import Shop from "@/pages/shop";
import Tienda from "@/pages/tienda";
import CatalogoPublico from "@/pages/catalogo-publico";
import ProductoPublic from "@/pages/producto-public";
import Cotizador from "@/pages/cotizador";
import Dashboard from "@/pages/dashboard";
import SupervisorDashboard from "@/pages/supervisor-dashboard";
import TecnicoObraDashboard from "@/pages/tecnico-obra-dashboard";
import MisVendedoresPage from "@/pages/mis-vendedores";
import ClientsDashboard from "@/pages/clients-dashboard";
import ClientBuyerDashboard from "@/pages/client-buyer-dashboard";
import Metas from "@/pages/metas";
import Comisiones from "@/pages/comisiones";
import TareasPage from "@/pages/tareas";
import RutasComerciales from "@/pages/rutas-comerciales";

import NVVPage from "@/pages/nvv";
import PromesasCompraPage from "@/pages/promesas-compra";
import Users from "@/pages/users";
import Products from "@/pages/products";
import Clients from "@/pages/clients";
import ClientesUnificado from "@/pages/clientes-unificado";
import OrdenesPage from "@/pages/ordenes";
import ListaPrecios from "@/pages/lista-precios";
import SegmentDetail from "@/pages/segment-detail";
import SucursalDetail from "@/pages/sucursal-detail";
import SalespersonDetail from "@/pages/salesperson-detail";
import ClientDetail from "@/pages/client-detail";
import ProductDetail from "@/pages/product-detail";
import ProductCatalogDetail from "@/pages/product-catalog-detail";
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
import PanoramicaMarketPage from "@/pages/panoramica-market";
import Logistica from "@/pages/logistica";
import LogisticaTms from "@/pages/logistica-tms";
import LogisticaRutas from "@/pages/logistica-rutas";
import CMmsCalendario from "@/pages/cmms-calendario";
import ApiKeysPage from "@/pages/api-keys";
import Marketing from "@/pages/marketing";
import Inventario from "@/pages/inventario";
import GastosEmpresariales from "@/pages/gastos-empresariales";
import GastosEmpresarialesForm from "@/pages/gastos-empresariales-form";
import GastosEmpresarialesDashboard from "@/pages/gastos-empresariales-dashboard";
import GestionFondos from "@/pages/gestion-fondos";
import Notificaciones from "@/pages/notificaciones";
import AiAssistantPage from "@/pages/ai-assistant";
import AdminCatalogos from "@/pages/admin-catalogos";
import Reception from "@/pages/reception";
import ClientPortal from "@/pages/client-portal";
import ClientDocumentos from "@/components/ecommerce/client-documents";
import TintometriaAdmin from "@/pages/tintometria-admin";
import TintometriaCalculadora from "@/pages/tintometria-calculadora";
import TintometriaSelector from "@/pages/tintometria-selector";
import Facturas from "@/pages/facturas";
import FacturasMainPage from "@/pages/facturas-main";
import MargenPage from "@/pages/margen";
import MetricasProductos from "@/pages/metricas-productos";
import ColoresPaleta from "@/pages/colores-paleta";
import ProductDashboard from "@/pages/product-dashboard";
import ETLMonitor from "@/pages/etl-monitor";
import DateSelectorDemo from "@/pages/date-selector-demo";
import ConfiguracionPage from "@/pages/configuracion";
import PresupuestoVentas from "@/pages/presupuesto-ventas";
import MisPedidos from "@/pages/mis-pedidos";
import SeguimientoPedidos from "@/pages/seguimiento-pedidos";
import SeguimientoClientes from "@/pages/seguimiento-clientes";
import SeguimientoClienteDetalle from "@/pages/seguimiento-cliente-detalle";
import AyudaMemoriaPage from "@/pages/ayuda-memoria";
import EcommercePedidos from "@/pages/ecommerce-pedidos";
import PedidoConfirmado from "@/pages/pedido-confirmado";
import SeguimientoPublico from "@/pages/seguimiento-publico";
import EcommerceUsuarios from "@/pages/ecommerce-usuarios";
import CotizacionesB2C from "@/pages/cotizaciones-b2c";
import MailingPage from "@/pages/mailing";
import CampanasPage from "@/pages/campanas";
import DondeComprar from "@/pages/donde-comprar";
import RetailLocationsAdmin from "@/pages/retail-locations-admin";
import Registro from "@/pages/registro";
import NotFound from "@/pages/not-found";

// Envuelve una página con el gate de permisos del sistema de Roles y
// Permisos, preservando las props que inyecta wouter (params, etc.).
// El resultado se cachea por (Componente, permiso) para mantener una
// identidad estable entre renders de Router: si no, wouter remontaría
// la página en cada render (perdiendo estado, scroll y datos cargados).
const guardedCache = new WeakMap<any, Map<string, any>>();
function guarded(permission: string, Component: any) {
  let byPermission = guardedCache.get(Component);
  if (!byPermission) {
    byPermission = new Map();
    guardedCache.set(Component, byPermission);
  }
  let wrapped = byPermission.get(permission);
  if (!wrapped) {
    wrapped = (props: any) => (
      <Guarded permission={permission}>
        <Component {...props} />
      </Guarded>
    );
    byPermission.set(permission, wrapped);
  }
  return wrapped;
}

// Tomador 2 (beta): misma página, variante v2. Convive con el tomador clásico
// para que los vendedores tengan respaldo si algo falla en el nuevo.
const TomadorPedidosV2 = (props: any) => <TomadorPedidos {...props} variant="v2" />;

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
      {/* B2C Cotizador público — sin auth, sin precios */}
      <Route path="/catalogo">{() => <Cotizador />}</Route>
      <Route path="/cotizador">{() => <Cotizador />}</Route>

      {/* Tienda pública accesible para todos */}
      <Route path="/tienda">{() => <Tienda />}</Route>
      <Route path="/shop">{() => <Shop />}</Route>
      <Route path="/carrito">{() => <Carrito />}</Route>
      <Route path="/pedido-confirmado">{() => <PedidoConfirmado />}</Route>

      {/* Seguimiento público de pedido — sin login, solo con el código */}
      <Route path="/seguimiento/:code">{() => <SeguimientoPublico />}</Route>
      <Route path="/seguimiento">{() => <SeguimientoPublico />}</Route>

      {/* Dónde comprar — mapa público con sucursales y ferreterías */}
      <Route path="/donde-comprar">{() => <DondeComprar />}</Route>

      {/* Landing pública de registro — Panorámica Market */}
      <Route path="/registro">{() => <Registro />}</Route>

      {/* Catálogo público de vendedores */}
      <Route path="/catalogo/:slug">{() => <CatalogoPublico />}</Route>

      {/* Página pública de producto (deep-link para Google Ads / Meta / WhatsApp) */}
      <Route path="/p/:slug">{() => <ProductoPublic />}</Route>

      {!user ? (
        <>
          <Route path="/" component={Login} />
          <Route path="/login" component={Login} />
          <Route path="/landing" component={Landing} />
          <Route component={Login} />
        </>
      ) : user.role === 'client' ? (
        <>
          {/* Client lands on /tienda by default */}
          <Route path="/" component={() => { window.location.replace('/tienda'); return null; }} />
          {/* Account management pages use eCommerce layout */}
          <Route path="/mi-cuenta">{() => <ClientEcommerceLayout><ClientPortal /></ClientEcommerceLayout>}</Route>
          <Route path="/mis-pedidos">{() => <ClientEcommerceLayout><ClientPortal /></ClientEcommerceLayout>}</Route>
          <Route path="/mi-credito">{() => <ClientEcommerceLayout><ClientPortal /></ClientEcommerceLayout>}</Route>
          <Route path="/seguimiento">{() => <ClientEcommerceLayout><ClientOrderTracking /></ClientEcommerceLayout>}</Route>
          <Route path="/mis-documentos">{() => <ClientEcommerceLayout><ClientDocumentos /></ClientEcommerceLayout>}</Route>
          <Route path="/panoramica-market-cliente">{() => <ClientEcommerceLayout><ClientPortal /></ClientEcommerceLayout>}</Route>
          <Route path="/client-portal">{() => <ClientEcommerceLayout><ClientPortal /></ClientEcommerceLayout>}</Route>
          <Route component={() => { window.location.replace('/tienda'); return null; }} />
        </>
      ) : (
        <DashboardLayout>
          <Switch>
            {/* Ruta principal - Dashboard según rol */}
            <Route path="/" component={() => {
              switch (user.role) {
                case 'admin':
                case 'supervisor':
                case 'encargado_area':
                case 'logistica_bodega':
                  return <Dashboard />;
                case 'salesperson':
                  // El vendedor ve el mismo dashboard del admin (Dashboard se auto-fija
                  // al filtro de su propio vendedor y renderiza SalespersonDetail con
                  // filtrado por producto/cliente limitado a sus datos).
                  return <Dashboard />;
                case 'tecnico_obra':
                  return <VisitasTecnicasPage />;
                case 'reception':
                  return <Reception />;
                case 'client':
                  return <ClientPortal />;
                case 'jefe_planta':
                case 'mantencion':
                  // Roles de mantención van al módulo de mantenciones
                  return <MantencionesPage />;
                case 'recursos_humanos':
                  // Recursos humanos aterriza en su módulo de comisiones
                  window.location.replace('/comisiones');
                  return null;
                case 'marketing':
                  // Todo su trabajo (solicitudes del equipo y tareas propias) vive en el
                  // módulo Marketing: aterriza en "Hoy", que le arma la lista del día.
                  // Va por Redirect y no renderizando <Marketing/> acá para que la URL
                  // sea la de la sección: así el sidebar marca dónde está parada.
                  return <Redirect to="/marketing/hoy" />;
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
            <Route path="/facturas" component={guarded("finanzas", FacturasMainPage)} />
            <Route path="/nvv" component={guarded("finanzas", FacturasMainPage)} />

            <Route path="/tareas" component={TareasPage} />
            <Route path="/rutas-comerciales" component={RutasComerciales} />
            <Route path="/usuarios" component={guarded("config.usuarios", Users)} />
            <Route path="/admin-catalogos" component={AdminCatalogos} />
            <Route path="/donde-comprar-admin" component={guarded("market.donde_comprar", RetailLocationsAdmin)} />
            <Route path="/productos" component={guarded("productos", Products)} />
            <Route path="/productos/:codigo" component={guarded("productos", ProductCatalogDetail)} />
            <Route path="/lista-precios" component={guarded("lista_precios", ListaPrecios)} />
            <Route path="/colores-paleta" component={guarded("productos", ColoresPaleta)} />
            <Route path="/ecommerce" component={guarded("market.configuracion", EcommerceAdmin)} />
            <Route path="/ecommerce-pedidos" component={guarded("market.pedidos", EcommercePedidos)} />
            {/* Sin entrada en el sidebar: la administración de sucursales (descuento de
                convenio, credenciales) todavía no está migrada a la ficha unificada de
                cliente, así que esta pantalla se entra por URL directa mientras tanto. */}
            <Route path="/ecommerce-usuarios" component={guarded("market.configuracion", EcommerceUsuarios)} />
            <Route path="/logistica" component={guarded("market.logistica", Logistica)} />
            <Route path="/logistica-tms" component={guarded("market.logistica", LogisticaTms)} />
            <Route path="/logistica-rutas" component={guarded("market.logistica", LogisticaRutas)} />
            <Route path="/cotizaciones-b2c" component={CotizacionesB2C} />
            <Route path="/mailing" component={guarded("market.mailing", MailingPage)} />
            <Route path="/campanas" component={guarded("market.campanas", CampanasPage)} />
            <Route path="/panoramica-market" component={PanoramicaMarketPage} />
            <Route path="/shopify-products" component={ShopifyProducts} />
            <Route path="/clientes" component={guarded("clientes", ClientesUnificado)} />
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
            <Route path="/metas" component={guarded("config.metas", Metas)} />
            <Route path="/comisiones" component={guarded("rrhh.comisiones", Comisiones)} />
            <Route path="/presupuesto-ventas" component={PresupuestoVentas} />
            <Route path="/promesas-compra" component={() => {
              // Solo admin, supervisor y salesperson pueden acceder a promesas de compra
              if (!user?.role || !['admin', 'supervisor', 'encargado_area', 'salesperson'].includes(user.role)) {
                window.location.replace('/');
                return null;
              }
              return <PromesasCompraPage />;
            }} />
            <Route path="/tomador-pedidos" component={guarded("tomador_pedidos", TomadorPedidos)} />
            <Route path="/tomador-pedidos-v2" component={guarded("tomador_pedidos", TomadorPedidosV2)} />
            <Route path="/seguimiento-pedidos" component={guarded("seguimiento_pedidos", SeguimientoPedidos)} />
            <Route path="/seguimiento-clientes/:id" component={guarded("clientes.seguimiento", SeguimientoClienteDetalle)} />
            <Route path="/seguimiento-clientes" component={guarded("clientes.seguimiento", SeguimientoClientes)} />
            <Route path="/ayuda-memoria" component={guarded("clientes.ayuda_memoria", AyudaMemoriaPage)} />
            <Route path="/presupuestos-avanzados" component={PresupuestosAvanzados} />
            <Route path="/tareas" component={TareasPage} />
            <Route path="/visitas-tecnicas" component={guarded("postventa.visitas", VisitasTecnicasPage)} />
            <Route path="/reclamos-generales" component={guarded("postventa.reclamos", ReclamosGeneralesPage)} />
            <Route path="/reclamos/resolucion/:id" component={guarded("postventa.reclamos", ReclamoResolucionPage)} />
            <Route path="/mantenciones" component={guarded("cmms.ordenes", MantencionesPage)} />
            <Route path="/cmms" component={guarded("cmms.dashboard", CMMSDashboard)} />
            <Route path="/cmms/dashboard" component={guarded("cmms.dashboard", CMMSDashboard)} />
            <Route path="/cmms/equipos" component={guarded("cmms.equipos", CMMSEquipos)} />
            <Route path="/cmms/proveedores" component={guarded("cmms.proveedores", CMmsProveedores)} />
            <Route path="/cmms/presupuesto" component={guarded("cmms.presupuesto", CMmsPresupuesto)} />
            <Route path="/cmms/gastos-materiales" component={guarded("cmms.gastos_materiales", CMmsGastosMateriales)} />
            <Route path="/cmms/planes-preventivos" component={guarded("cmms.planes_preventivos", CMmsPlanesPreventivos)} />
            <Route path="/cmms/mantenciones-planificadas" component={guarded("cmms.mantenciones_planificadas", CmmsMantencionesPlanificadas)} />
            <Route path="/cmms/calendario" component={guarded("cmms.calendario", CMmsCalendario)} />
            {/* Las secciones del módulo Marketing son rutas propias: el menú vive en
                el sidebar de la app y el ítem activo se resuelve por URL. */}
            <Route path="/marketing" component={guarded("marketing", Marketing)} />
            <Route path="/marketing/:seccion" component={guarded("marketing", Marketing)} />
            <Route path="/inventario" component={guarded("inventario", Inventario)} />
            <Route path="/gastos-empresariales" component={guarded("gastos", GastosEmpresariales)} />
            <Route path="/gestion-fondos" component={() => {
              window.location.replace('/gastos-empresariales');
              return null;
            }} />
            <Route path="/notificaciones" component={Notificaciones} />
            <Route path="/ai-assistant" component={AiAssistantPage} />
            <Route path="/api-keys" component={guarded("config.apikeys", ApiKeysPage)} />
            <Route path="/gastos-empresariales/nuevo" component={guarded("gastos", GastosEmpresarialesForm)} />
            <Route path="/gastos-empresariales/dashboard" component={guarded("gastos", GastosEmpresarialesDashboard)} />
            <Route path="/etl-monitor" component={guarded("etl_monitor", ETLMonitor)} />
            <Route path="/margen" component={guarded("margen", MargenPage)} />
            <Route path="/configuracion" component={guarded("configuracion", ConfiguracionPage)} />
            <Route path="/date-selector-demo" component={DateSelectorDemo} />

            {/* Rutas de Tintometría */}
            <Route path="/tintometria" component={() => {
              // Redirect to admin by default
              window.location.replace('/tintometria/admin');
              return null;
            }} />
            <Route path="/tintometria/admin" component={guarded("tintometria.admin", TintometriaAdmin)} />
            <Route path="/tintometria/calculadora" component={guarded("tintometria.calculadora", TintometriaCalculadora)} />
            <Route path="/tintometria/selector" component={guarded("tintometria.selector", TintometriaSelector)} />

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
            <Route path="/dashboard-productos" component={ProductDashboard} />

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
            <Route path="/mis-pedidos" component={guarded("mis_pedidos", MisPedidos)} />
            <Route path="/solicitar-cotizacion" component={() => <div className="p-6"><h1 className="text-2xl font-bold">Solicitar Cotización</h1><p>Página en construcción</p></div>} />
            <Route path="/client-portal" component={ClientPortal} />

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
            {/* TourProvider envuelve al Router para que las guías del asistente
                puedan navegar entre módulos sin cortarse. */}
            <TourProvider>
              <Toaster />
              <Router />
              <UpdateNotification />
              <TrackingScripts />
              <TourOverlay />
            </TourProvider>
          </TooltipProvider>
        </CartProvider>
      </FilterProvider>
    </QueryClientProvider>
  );
}

export default App;
