import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import DashboardLayout from "@/components/layout/dashboard-layout";
import Landing from "@/pages/landing";
import Login from "@/pages/login";
import Shop from "@/pages/shop";
import Dashboard from "@/pages/dashboard";
import SalespersonDashboard from "@/pages/salesperson-dashboard";
import SupervisorDashboard from "@/pages/supervisor-dashboard";
import MisVendedoresPage from "@/pages/mis-vendedores";
import ClientsDashboard from "@/pages/clients-dashboard";
import ClientBuyerDashboard from "@/pages/client-buyer-dashboard";
import Metas from "@/pages/metas";
import TareasPage from "@/pages/tareas";
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
      <Route path="/tienda" component={Shop} />
      <Route path="/shop" component={Shop} />
      
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
                case 'client':
                  return <ClientBuyerDashboard />;
                default:
                  return <Dashboard />;
              }
            }} />
            
            {/* Rutas específicas de admin */}
            <Route path="/usuarios" component={Users} />
            <Route path="/productos" component={Products} />
            <Route path="/lista-precios" component={ListaPrecios} />
            <Route path="/ecommerce" component={EcommerceAdmin} />
            <Route path="/clientes" component={Clients} />
            <Route path="/ordenes" component={OrdenesPage} />
            <Route path="/products" component={() => {
              // Redirect from /products to /productos
              window.location.replace('/productos');
              return null;
            }} />
            <Route path="/metas" component={Metas} />
            <Route path="/tomador-pedidos" component={TomadorPedidos} />
            <Route path="/tareas" component={TareasPage} />
            <Route path="/segment/:segmentName" component={SegmentDetail} />
            <Route path="/salesperson/:salespersonName" component={SalespersonDetail} />
            <Route path="/client/:clientName" component={ClientDetail} />
            <Route path="/product/:productName" component={ProductDetail} />
            
            {/* Rutas específicas de vendedor */}
            <Route path="/mis-clientes" component={ClientsDashboard} />
            <Route path="/presupuestos" component={() => <div className="p-6"><h1 className="text-2xl font-bold">Presupuestos</h1><p>Página en construcción</p></div>} />
            
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
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
