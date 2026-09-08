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
  soloRoles,
  children,
}: {
  permission: string;
  /**
   * Roles que además del permiso pueden entrar. Se usa para los módulos donde
   * el permiso no alcanza como cerrojo porque un admin podría asignarlo por
   * error desde el panel: hoy, Remuneraciones (sueldos de toda la empresa).
   * El servidor aplica la misma restricción; esto solo evita que alguien vea
   * una pantalla que igual le va a responder 403.
   */
  soloRoles?: string[];
  children: React.ReactNode;
}) {
  const { can, isReady, role } = usePermissions();

  if (!isReady) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (soloRoles && !soloRoles.includes(role)) return <AccessDenied />;
  if (!can(permission)) return <AccessDenied />;
  return <>{children}</>;
}
