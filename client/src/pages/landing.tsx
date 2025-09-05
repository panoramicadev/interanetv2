import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function Landing() {
  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <Card className="max-w-md w-full">
        <CardContent className="p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Sistema de Ventas
            </h1>
            <p className="text-muted-foreground">
              Accede a tu dashboard de análisis
            </p>
          </div>
          
          <Button 
            onClick={handleLogin}
            className="w-full"
            data-testid="button-login"
          >
            Iniciar Sesión
          </Button>
          
          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              Usa tu cuenta de Replit para acceder al sistema
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
