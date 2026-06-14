import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ShieldCheck,
  ShieldAlert,
  Lock,
  Search,
  RotateCcw,
  Save,
  Users as UsersIcon,
  CircleDot,
  Loader2,
} from "lucide-react";
import {
  PERMISSIONS,
  PERMISSION_GROUPS,
  ALL_PERMISSION_KEYS,
} from "@shared/permissions";

interface RolePermissionsEntry {
  role: string;
  label: string;
  locked: boolean;
  isCustomized: boolean;
  userCount: number;
  permissions: Record<string, boolean>;
}

interface RolePermissionsResponse {
  roles: RolePermissionsEntry[];
  storageAvailable: boolean;
}

export default function RolesPermisosPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);

  const isAdmin = user?.role === "admin";

  const { data, isLoading, isError } = useQuery<RolePermissionsResponse>({
    queryKey: ["/api/admin/role-permissions"],
    queryFn: async () => {
      const response = await fetch("/api/admin/role-permissions", { credentials: "include" });
      if (!response.ok) throw new Error(`${response.status}: ${response.statusText}`);
      return await response.json();
    },
    enabled: isAdmin,
    staleTime: 30 * 1000,
    // No recargar en segundo plano: una recarga mientras el admin edita
    // los switches reescribiría el borrador y perdería sus cambios. Tras
    // guardar/restaurar se refresca por la invalidación explícita.
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const roles = data?.roles || [];
  const current = roles.find((r) => r.role === selectedRole) || null;

  // Selección inicial: primer rol editable (admin se muestra bloqueado)
  useEffect(() => {
    if (!selectedRole && roles.length > 0) {
      const firstEditable = roles.find((r) => !r.locked);
      setSelectedRole((firstEditable || roles[0]).role);
    }
  }, [roles, selectedRole]);

  // Sincronizar el borrador al cambiar de rol o al llegar datos frescos
  useEffect(() => {
    if (current) setDraft({ ...current.permissions });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.role, current?.permissions]);

  const isDirty = useMemo(() => {
    if (!current) return false;
    return ALL_PERMISSION_KEYS.some((key) => !!draft[key] !== !!current.permissions[key]);
  }, [draft, current]);

  const activeCount = useMemo(
    () => ALL_PERMISSION_KEYS.filter((key) => draft[key]).length,
    [draft],
  );

  const saveMutation = useMutation({
    mutationFn: async ({ role, permissions }: { role: string; permissions: Record<string, boolean> }) => {
      const response = await apiRequest("PUT", `/api/admin/role-permissions/${role}`, { permissions });
      return await response.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/role-permissions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/permissions/me"] });
      toast({
        title: "Permisos guardados",
        description: `Los usuarios con rol ${current?.label || variables.role} verán los cambios al recargar la página.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error al guardar",
        description: error.message || "No se pudieron guardar los permisos.",
        variant: "destructive",
      });
    },
  });

  const resetMutation = useMutation({
    mutationFn: async (role: string) => {
      const response = await apiRequest("DELETE", `/api/admin/role-permissions/${role}`);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/role-permissions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/permissions/me"] });
      toast({
        title: "Permisos restaurados",
        description: "El rol volvió a sus permisos por defecto.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error al restaurar",
        description: error.message || "No se pudieron restaurar los permisos.",
        variant: "destructive",
      });
    },
  });

  if (!isAdmin) {
    return (
      <Alert variant="destructive">
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle>Solo administradores</AlertTitle>
        <AlertDescription>
          La configuración de roles y permisos está reservada al rol Administrador.
        </AlertDescription>
      </Alert>
    );
  }

  if (isError) {
    return (
      <Alert variant="destructive">
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle>No se pudo cargar la matriz de permisos</AlertTitle>
        <AlertDescription>Reintenta en unos segundos o revisa la conexión con el servidor.</AlertDescription>
      </Alert>
    );
  }

  const normalizedSearch = search.trim().toLowerCase();
  const visiblePermissions = normalizedSearch
    ? PERMISSIONS.filter(
        (p) =>
          p.label.toLowerCase().includes(normalizedSearch) ||
          p.description.toLowerCase().includes(normalizedSearch),
      )
    : PERMISSIONS;

  const groupsToRender = PERMISSION_GROUPS.map((group) => ({
    group,
    permissions: visiblePermissions.filter((p) => p.group === group.key),
  })).filter((entry) => entry.permissions.length > 0);

  const setGroup = (groupKey: string, value: boolean) => {
    const keys = PERMISSIONS.filter((p) => p.group === groupKey).map((p) => p.key);
    setDraft((prev) => {
      const next = { ...prev };
      for (const key of keys) next[key] = value;
      return next;
    });
  };

  const locked = !!current?.locked;

  return (
    <div className="space-y-4">
      {/* Encabezado */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <ShieldCheck className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-bold">Roles y Permisos</h2>
          <p className="text-sm text-muted-foreground">
            Define qué módulos puede ver cada rol. Los cambios afectan el menú lateral y el acceso a
            cada sección; los usuarios conectados los verán al recargar la página.
          </p>
        </div>
      </div>

      {data && !data.storageAvailable && (
        <Alert>
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Mostrando permisos por defecto</AlertTitle>
          <AlertDescription>
            No fue posible leer los permisos personalizados desde la base de datos. Puedes revisar
            los valores por defecto, pero guarda los cambios cuando la conexión se restablezca.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 lg:grid-cols-[300px_1fr] items-start">
        {/* Lista de roles */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Roles</CardTitle>
            <CardDescription>
              {roles.length > 0 ? `${roles.length} roles del sistema` : "Cargando roles…"}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-2 pt-0">
            {isLoading ? (
              <div className="space-y-2 p-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-lg" />
                ))}
              </div>
            ) : (
              <div className="space-y-1 max-h-[60vh] overflow-y-auto pr-1">
                {roles.map((entry) => {
                  const isSelected = entry.role === selectedRole;
                  return (
                    <button
                      key={entry.role}
                      onClick={() => setSelectedRole(entry.role)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left transition-colors ${
                        isSelected ? "bg-primary/10 text-primary" : "hover:bg-muted"
                      }`}
                      data-testid={`role-item-${entry.role}`}
                    >
                      {entry.locked ? (
                        <Lock className="w-3.5 h-3.5 flex-shrink-0 opacity-70" />
                      ) : (
                        <CircleDot
                          className={`w-3.5 h-3.5 flex-shrink-0 ${
                            entry.isCustomized ? "text-amber-500" : "opacity-30"
                          }`}
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{entry.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {entry.locked
                            ? "Acceso total"
                            : entry.isCustomized
                              ? "Personalizado"
                              : "Por defecto"}
                        </p>
                      </div>
                      <Badge variant="secondary" className="gap-1 flex-shrink-0">
                        <UsersIcon className="w-3 h-3" />
                        {entry.userCount}
                      </Badge>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Detalle del rol */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  {current?.label || "Selecciona un rol"}
                  {current?.isCustomized && !locked && (
                    <Badge variant="outline" className="text-amber-600 border-amber-300">
                      Personalizado
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  {locked
                    ? "El Administrador siempre tiene acceso completo a todos los módulos."
                    : `${activeCount} de ${ALL_PERMISSION_KEYS.length} módulos habilitados`}
                </CardDescription>
              </div>
              {!locked && current && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    disabled={!current.isCustomized || resetMutation.isPending}
                    onClick={() => setConfirmReset(true)}
                    data-testid="button-reset-role"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Restaurar defaults
                  </Button>
                </div>
              )}
            </div>
            {!locked && (
              <div className="relative mt-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar módulo…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-permission"
                />
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-5">
            {isLoading || !current ? (
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full rounded-lg" />
                ))}
              </div>
            ) : locked ? (
              <Alert>
                <Lock className="h-4 w-4" />
                <AlertTitle>Rol protegido</AlertTitle>
                <AlertDescription>
                  Para evitar que el sistema quede sin administración, este rol no puede
                  restringirse: siempre ve todos los módulos.
                </AlertDescription>
              </Alert>
            ) : (
              groupsToRender.map(({ group, permissions }) => {
                const groupKeys = PERMISSIONS.filter((p) => p.group === group.key).map((p) => p.key);
                const allOn = groupKeys.every((key) => draft[key]);
                const noneOn = groupKeys.every((key) => !draft[key]);
                return (
                  <div key={group.key} className="rounded-xl border">
                    <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b bg-muted/40 rounded-t-xl">
                      <div>
                        <p className="text-sm font-semibold">{group.label}</p>
                        <p className="text-xs text-muted-foreground">{group.description}</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          disabled={allOn}
                          onClick={() => setGroup(group.key, true)}
                          data-testid={`group-all-${group.key}`}
                        >
                          Todos
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          disabled={noneOn}
                          onClick={() => setGroup(group.key, false)}
                          data-testid={`group-none-${group.key}`}
                        >
                          Ninguno
                        </Button>
                      </div>
                    </div>
                    <div className="divide-y">
                      {permissions.map((permission) => {
                        const changed =
                          !!draft[permission.key] !== !!current.permissions[permission.key];
                        return (
                          <div
                            key={permission.key}
                            className="flex items-center justify-between gap-4 px-4 py-3"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium">{permission.label}</p>
                                {changed && (
                                  <span
                                    className="w-1.5 h-1.5 rounded-full bg-blue-500"
                                    title="Cambio sin guardar"
                                  />
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {permission.description}
                              </p>
                            </div>
                            <Switch
                              checked={!!draft[permission.key]}
                              onCheckedChange={(value) =>
                                setDraft((prev) => ({ ...prev, [permission.key]: value }))
                              }
                              data-testid={`switch-${permission.key}`}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      {/* Barra de cambios pendientes */}
      {isDirty && current && !locked && (
        <div className="sticky bottom-4 z-20">
          <div className="mx-auto max-w-xl rounded-xl border bg-background shadow-lg px-4 py-3 flex items-center justify-between gap-3">
            <p className="text-sm">
              <span className="font-medium">Cambios sin guardar</span>{" "}
              <span className="text-muted-foreground">en {current.label}</span>
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDraft({ ...current.permissions })}
                disabled={saveMutation.isPending}
                data-testid="button-discard-changes"
              >
                Descartar
              </Button>
              <Button
                size="sm"
                className="gap-1.5"
                onClick={() => saveMutation.mutate({ role: current.role, permissions: draft })}
                disabled={saveMutation.isPending}
                data-testid="button-save-permissions"
              >
                {saveMutation.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                Guardar cambios
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmación de restaurar defaults */}
      <AlertDialog open={confirmReset} onOpenChange={setConfirmReset}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Restaurar permisos por defecto?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará la personalización del rol {current?.label} y volverá a los permisos
              estándar del sistema. Esta acción no afecta a otros roles.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (current) resetMutation.mutate(current.role);
                setConfirmReset(false);
              }}
            >
              Restaurar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
