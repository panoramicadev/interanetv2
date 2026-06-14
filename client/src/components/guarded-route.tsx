import { Link } from "wouter";
import { ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/hooks/usePermissions";

/** Página 403: el rol no tiene habilitado el módulo */
export function AccessDenied() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-rose-500/10 flex items-center justify-center mb-5">
          <ShieldOff className="w-8 h-8 text-rose-500" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Sin acceso a este módulo</h1>
        <p className="text-muted-foreground mb-6">
          Tu rol no tiene habilitada esta sección. Si crees que deberías poder
          verla, pide a un administrador que la active en{" "}
          <span className="font-medium">Configuración → Roles y Permisos</span>.
        </p>
        <Link href="/">
          <Button data-testid="access-denied-home">Volver al inicio</Button>
        </Link>
      </div>
    </div>
  );
}

/**
 * Envuelve una página y exige un permiso del sistema de Roles y Permisos.
 * Mientras se confirma con el server muestra un loader breve para no
 * destellar contenido restringido.
 */
export function Guarded({
  permission,
  children,
}: {
  permission: string;
  children: React.ReactNode;
}) {
  const { can, isReady } = usePermissions();

  if (!isReady) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!can(permission)) return <AccessDenied />;
  return <>{children}</>;
}
