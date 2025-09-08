import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link, useLocation } from "wouter";
import { ShoppingCart, BarChart } from "lucide-react";

export default function Landing() {
  const [, setLocation] = useLocation();
  
  const handleLogin = () => {
    setLocation("/login");
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-4xl w-full grid gap-6 md:grid-cols-2">
        {/* Sistema de Ventas Card */}
        <Card className="transition-all hover:shadow-lg">
          <CardContent className="p-8">
            <div className="text-center mb-8">
              <BarChart className="h-16 w-16 text-blue-600 mx-auto mb-4" />
              <h1 className="text-3xl font-bold text-foreground mb-2">
                Sistema de Ventas
              </h1>
              <p className="text-muted-foreground">
                Accede a tu dashboard de análisis y gestión de ventas
              </p>
            </div>
            
            <Button 
              onClick={handleLogin}
              className="w-full mb-4"
              data-testid="button-login"
            >
              Iniciar Sesión al Dashboard
            </Button>
            
            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                Sistema profesional de análisis de ventas
              </p>
            </div>
          </CardContent>
        </Card>

{/* Tienda temporalmente deshabilitada para el lanzamiento inicial */}
      </div>
    </div>
  );
}
