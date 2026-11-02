import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import DetalleFacturacion from "@/components/finanzas/detalle-facturacion";

export default function Reception() {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Redirect if not reception user
  useEffect(() => {
    if (!isLoading && (!user || user.role !== 'reception')) {
      toast({
        title: "Acceso denegado",
        description: "No tienes permisos para acceder a esta página.",
        variant: "destructive",
      });
      setLocation("/");
    }
  }, [user, isLoading, toast, setLocation]);

  if (isLoading || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-slate-900 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <DetalleFacturacion />
      </div>
    </div>
  );
}
