import { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./useAuth";
import { computeEffectivePermissions } from "@shared/permissions";

interface PermissionsResponse {
  role: string;
  permissions: Record<string, boolean>;
}

/**
 * Permisos efectivos del usuario actual (sistema de Roles y Permisos).
 *
 * - `can(key)` responde de inmediato: mientras el server no contesta (o si
 *   falla) usa los defaults de código del rol, de modo que la app se
 *   comporta como antes de existir el sistema.
 * - `isReady` indica que ya hay respuesta definitiva del server; los gates
 *   de ruta esperan esto para no mostrar contenido restringido por un
 *   instante.
 */
export function usePermissions() {
  const { user } = useAuth();
  const role = (user as any)?.role || "";

  const { data, isFetched, isError } = useQuery<PermissionsResponse | null>({
    queryKey: ["/api/permissions/me"],
    queryFn: async () => {
      const response = await fetch("/api/permissions/me", {
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (response.status === 401) return null;
      if (!response.ok) throw new Error(`${response.status}: ${response.statusText}`);
      return await response.json();
    },
    enabled: !!user,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
    retry: 1,
  });

  const fallback = useMemo(
    () => (role ? computeEffectivePermissions(role) : {}),
    [role],
  );

  const effective = (data && data.role === role ? data.permissions : null) ?? fallback;

  const can = useCallback(
    (key: string) => {
      if (role === "admin") return true;
      return !!effective[key];
    },
    [role, effective],
  );

  return {
    can,
    permissions: effective,
    role,
    // Sin usuario no hay nada que esperar; con usuario, listo cuando el
    // server respondió (ok o error — en error rigen los defaults).
    isReady: !user || isFetched || isError,
  };
}
