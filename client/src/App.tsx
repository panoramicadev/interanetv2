import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { CartProvider } from "@/contexts/CartContext";
import { UpdateNotification } from "@/components/UpdateNotification";
import DashboardLayout from "@/components/layout/dashboard-layout";
import Landing from "@/pages/landing";
import Login from "@/pages/login";
import Shop from "@/pages/shop";
import Tienda from "@/pages/tienda";
import Dashboard from "@/pages/dashboard";
import SalespersonDashboard from "@/pages/salesperson-dashboard";
import SupervisorDashboard from "@/pages/supervisor-dashboard";
import TecnicoObraDashboard from "@/pages/tecnico-obra-dashboard";
import MisVendedoresPage from "@/pages/mis-vendedores";
import ClientsDashboard from "@/pages/clients-dashboard";
import ClientBuyerDashboard from "@/pages/client-buyer-dashboard";
import Metas from "@/pages/metas";
import TareasPage from "@/pages/tareas";
import NVVPage from "@/pages/nvv";
import Users from "@/pages/users";
import Products from "@/pages/products";
import Clients from "@/pages/clients";
import OrdenesPage from "@/pages/ordenes";
import ListaPrecios from "@/pages/lista-precios";
import SegmentDetail from "@/pages/segment-detail";
import SalespersonDetail from "@/pages/salesperson-detail";
import ClientDetail from "@/pages/client-detail";
import ProductDetail from "@/pages/product-detail";
import TomadorPedidos from "@/pages/tomador-pedidos";
import EcommerceAdmin from "@/pages/ecommerce-admin";
import Carrito from "@/pages/carrito";
import QuotesPage from "@/pages/quotes";
import OrdersPage from "@/pages/orders";
import VisitasTecnicasPage from "@/pages/visitas-tecnicas";
import ReclamosGeneralesPage from "@/pages/reclamos-generales";
import Marketing from "@/pages/marketing";
import Inventario from "@/pages/inventario";
import GastosEmpresariales from "@/pages/gastos-empresariales";
import GastosEmpresarialesForm from "@/pages/gastos-empresariales-form";
import GastosEmpresarialesDashboard from "@/pages/gastos-empresariales-dashboard";
import PromesasCompra from "@/pages/promesas-compra";
import Reception from "@/pages/reception";
import TintometriaAdmin from "@/pages/tintometria-admin";
import TintometriaCalculadora from "@/pages/tintometria-calculadora";
import TintometriaSelector from "@/pages/tintometria-selector";
import Facturas from "@/pages/facturas";
import MetricasProductos from "@/pages/metricas-productos";
import ETLMonitor from "@/pages/etl-monitor";
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
                default:
                  return <Dashboard />;
              }
            }} />
            
            {/* Rutas específicas de admin */}
            <Route path="/nvv" component={NVVPage} />
            <Route path="/usuarios" component={Users} />
            <Route path="/productos" component={Products} />
            <Route path="/lista-precios" component={ListaPrecios} />
            <Route path="/ecommerce" component={EcommerceAdmin} />
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
            <Route path="/facturas" component={Facturas} />
            <Route path="/tomador-pedidos" component={TomadorPedidos} />
            <Route path="/tareas" component={TareasPage} />
            <Route path="/visitas-tecnicas" component={VisitasTecnicasPage} />
            <Route path="/reclamos-generales" component={ReclamosGeneralesPage} />
            <Route path="/marketing" component={Marketing} />
            <Route path="/inventario" component={Inventario} />
            <Route path="/gastos-empresariales" component={GastosEmpresariales} />
            <Route path="/gastos-empresariales/nuevo" component={GastosEmpresarialesForm} />
            <Route path="/gastos-empresariales/dashboard" component={GastosEmpresarialesDashboard} />
            <Route path="/promesas-compra" component={PromesasCompra} />
            <Route path="/etl-monitor" component={ETLMonitor} />
            
            {/* Rutas de Tintometría */}
            <Route path="/tintometria" component={() => {
              // Redirect to admin by default
              window.location.replace('/tintometria/admin');
              return null;
            }} />
            <Route path="/tintometria/admin" component={TintometriaAdmin} />
            <Route path="/tintometria/calculadora" component={TintometriaCalculadora} />
            <Route path="/tintometria/selector" component={TintometriaSelector} />
            
            <Route path="/segment/:segmentName" component={SegmentDetail} />
            <Route path="/salesperson/:salespersonName" component={SalespersonDetail} />
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
      <CartProvider>
        <TooltipProvider>
          <Router />
          <UpdateNotification />
        </TooltipProvider>
      </CartProvider>
    </QueryClientProvider>
  );
}

export default App;
