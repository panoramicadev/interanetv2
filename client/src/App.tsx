import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import Landing from "@/pages/landing";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import SalespersonDashboard from "@/pages/salesperson-dashboard";
import SupervisorDashboard from "@/pages/supervisor-dashboard";
import ClientsDashboard from "@/pages/clients-dashboard";
import Metas from "@/pages/metas";
import Users from "@/pages/users";
import SegmentDetail from "@/pages/segment-detail";
import SalespersonDetail from "@/pages/salesperson-detail";
import ClientDetail from "@/pages/client-detail";
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
      {!user ? (
        <>
          <Route path="/" component={Login} />
          <Route path="/login" component={Login} />
          <Route component={Login} />
        </>
      ) : (
        <>
          {/* Rutas según el rol del usuario */}
          {user.role === 'admin' && (
            <>
              <Route path="/" component={Dashboard} />
              <Route path="/metas" component={Metas} />
              <Route path="/usuarios" component={Users} />
              <Route path="/segment/:segmentName" component={SegmentDetail} />
              <Route path="/salesperson/:salespersonName" component={SalespersonDetail} />
              <Route path="/client/:clientName" component={ClientDetail} />
            </>
          )}
          {user.role === 'supervisor' && (
            <>
              <Route path="/" component={SupervisorDashboard} />
              <Route path="/metas" component={Metas} />
              <Route path="/segment/:segmentName" component={SegmentDetail} />
              <Route path="/salesperson/:salespersonName" component={SalespersonDetail} />
              <Route path="/client/:clientName" component={ClientDetail} />
            </>
          )}
          {user.role === 'salesperson' && (
            <>
              <Route path="/" component={SalespersonDashboard} />
              <Route path="/mis-clientes" component={ClientsDashboard} />
              <Route path="/client/:clientName" component={ClientDetail} />
            </>
          )}
          {user.role === 'client' && (
            <>
              <Route path="/" component={Dashboard} />
            </>
          )}
        </>
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
