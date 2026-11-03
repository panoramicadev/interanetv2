/**
 * App del subdominio tienda.pinturaspanoramica.cl: solo el cotizador público y sus
 * páginas hermanas. Vive aparte de App.tsx para que el visitante no descargue la
 * intranet completa (gráficos, PDF, más de cien módulos); main.tsx elige cuál cargar.
 */
import { lazy, Suspense } from "react";
import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TrackingScripts } from "@/components/tracking-scripts";
import Cotizador from "@/pages/cotizador";

const ProductoPublic = lazy(() => import("@/pages/producto-public"));
const ProductoCotizador = lazy(() => import("@/pages/producto-cotizador"));
const DondeComprar = lazy(() => import("@/pages/donde-comprar"));
const SeguimientoPublico = lazy(() => import("@/pages/seguimiento-publico"));

export default function TiendaApp() {
  return (
    <QueryClientProvider client={queryClient}>
      <Toaster />
      <TrackingScripts />
      {/* data-sin-brillo: sin el brillo infinito de los botones naranjos (index.css); en la tienda pesaba */}
      <div data-sin-brillo="">
        <Suspense fallback={<div className="min-h-screen" />}>
          <Switch>
            <Route path="/productos/:slug">{() => <ProductoCotizador />}</Route>
            <Route path="/p/:slug">{() => <ProductoPublic />}</Route>
            <Route path="/donde-comprar">{() => <DondeComprar />}</Route>
            <Route path="/seguimiento/:code">{() => <SeguimientoPublico />}</Route>
            <Route path="/seguimiento">{() => <SeguimientoPublico />}</Route>
            <Route>{() => <Cotizador />}</Route>
          </Switch>
        </Suspense>
      </div>
    </QueryClientProvider>
  );
}
