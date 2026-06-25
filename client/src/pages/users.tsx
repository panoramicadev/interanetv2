import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Plus, Edit, Trash2, Users, Check, ChevronsUpDown, Search, Building2, UserCheck, UserX, X } from "lucide-react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertSalespersonUserSchema, type InsertSalespersonUserInput, type SalespersonUser } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { cn } from "@/lib/utils";
import type { User } from "@shared/schema";

// Etiquetas de rol centralizadas (label completo y versión corta para móvil/pestañas)
const ROLE_LABELS: Record<string, { label: string; short: string }> = {
  admin: { label: "Administrador", short: "Admin" },
  supervisor: { label: "Supervisor", short: "Supervisor" },
  encargado_area: { label: "Encargado de Área", short: "Enc. Área" },
  salesperson: { label: "Vendedor", short: "Vendedor" },
  tecnico_obra: { label: "Técnico de Obra", short: "Técnico" },
  jefe_planta: { label: "Jefe de Planta", short: "Jefe Planta" },
  mantencion: { label: "Mantención", short: "Mantención" },
  laboratorio: { label: "Laboratorio", short: "Laboratorio" },
  produccion: { label: "Producción", short: "Producción" },
  logistica_bodega: { label: "Logística y Bodega", short: "Logística" },
  planificacion: { label: "Planificación", short: "Planificación" },
  bodega_materias_primas: { label: "Bodega Materias Primas", short: "Bodega MP" },
  prevencion_riesgos: { label: "Prevención de Riesgos", short: "Prev. Riesgos" },
  recursos_humanos: { label: "Recursos Humanos", short: "RR.HH." },
  marketing: { label: "Marketing", short: "Marketing" },
  client: { label: "Cliente", short: "Cliente" },
  reception: { label: "Recepción", short: "Recepción" },
};

const getRoleLabel = (role: string | null, short = false) => {
  if (!role) return "Vendedor";
  const entry = ROLE_LABELS[role];
  if (!entry) return role;
  return short ? entry.short : entry.label;
};

// Fila liviana de cliente/sucursal para el selector de scope del encargado de área.
interface BranchRow {
  id: string;
  koen: string | null;
  nokoen: string;
  rten: string | null;
  parentClientId: string | null;
  branchLabel: string | null;
}

const normRut = (r: string | null) => (r || "").replace(/[.\-\s]/g, "").toUpperCase();
const fmtRut = (r: string | null) => (r && r.trim() ? r.trim() : "sin RUT");

// Caja de checkbox con buen affordance: vacía (borde) vs llena (azul + check).
function CheckBox({ checked }: { checked: boolean }) {
  return (
    <span
      className={cn(
        "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
        checked ? "border-indigo-600 bg-indigo-600 text-white" : "border-input bg-background",
      )}
    >
      {checked && <Check className="h-3 w-3" />}
    </span>
  );
}

// Selector de clientes/sucursales a los que queda ACOTADO un encargado de área.
// - Lista plana por defecto (cada cliente = una fila seleccionable).
// - Cuando un comercio tiene VARIAS sucursales (mismo RUT o misma matriz), se
//   agrupan con un atajo "Seleccionar todas". Es el caso MCT (Temuco/Castro/...).
// - Búsqueda por nombre/RUT/código; tope de render para no colgar con miles.
function BranchAssignmentSelector({
  branches,
  value,
  onChange,
}: {
  branches: BranchRow[];
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  const [search, setSearch] = useState("");
  const MAX_VISIBLE = 200;

  // Agrupar en "comercios": por RUT si existe; si no, por matriz (parentClientId); si no, solo.
  const companies = useMemo(() => {
    const map = new Map<string, { key: string; rut: string | null; items: BranchRow[] }>();
    for (const b of branches) {
      const rut = normRut(b.rten);
      const key = rut || (b.parentClientId ? `p:${b.parentClientId}` : `id:${b.id}`);
      if (!map.has(key)) map.set(key, { key, rut: b.rten, items: [] });
      map.get(key)!.items.push(b);
    }
    const list = Array.from(map.values()).map((c) => {
      const matriz = c.items.find((i) => !i.parentClientId) || c.items[0];
      return { ...c, name: matriz.nokoen, isMulti: c.items.length > 1 };
    });
    // Comercios multi-sucursal primero (son los que importa agrupar), luego alfabético.
    list.sort((a, b) => Number(b.isMulti) - Number(a.isMulti) || a.name.localeCompare(b.name));
    return list;
  }, [branches]);

  const term = search.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!term) return companies;
    return companies
      .map((c) => ({
        ...c,
        items: c.items.filter((b) =>
          [b.nokoen, b.rten, b.branchLabel, b.koen].filter(Boolean).join(" ").toLowerCase().includes(term),
        ),
      }))
      .filter((c) => c.items.length > 0);
  }, [companies, term]);

  const valueSet = new Set(value);
  const toggle = (id: string) => {
    const next = new Set(value);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(Array.from(next));
  };
  const toggleMany = (items: BranchRow[]) => {
    const ids = items.map((i) => i.id);
    const allSelected = ids.every((id) => valueSet.has(id));
    const next = new Set(value);
    if (allSelected) ids.forEach((id) => next.delete(id));
    else ids.forEach((id) => next.add(id));
    onChange(Array.from(next));
  };

  const selectedRows = branches.filter((b) => valueSet.has(b.id));

  // Tope de filas visibles (sumando ítems de cada comercio) para performance.
  let rendered = 0;
  let truncated = 0;
  const visible: typeof filtered = [];
  for (const c of filtered) {
    if (rendered >= MAX_VISIBLE) { truncated += c.items.length; continue; }
    const room = MAX_VISIBLE - rendered;
    if (c.items.length > room) {
      visible.push({ ...c, items: c.items.slice(0, room) });
      truncated += c.items.length - room;
      rendered = MAX_VISIBLE;
    } else {
      visible.push(c);
      rendered += c.items.length;
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          {value.length > 0 ? `${value.length} sucursal(es) seleccionada(s)` : "Ninguna seleccionada (verá todo)"}
        </span>
        {value.length > 0 && (
          <button type="button" className="text-xs font-medium text-indigo-600 hover:underline" onClick={() => onChange([])}>
            Limpiar
          </button>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre, RUT o código…"
          className="pl-8"
        />
      </div>

      <div className="max-h-[280px] overflow-y-auto rounded-md border bg-background">
        {branches.length === 0 && (
          <div className="p-3 text-sm text-muted-foreground">Cargando clientes…</div>
        )}
        {branches.length > 0 && filtered.length === 0 && (
          <div className="p-3 text-sm text-muted-foreground">Sin resultados para “{search}”.</div>
        )}

        {visible.map((c) =>
          c.isMulti ? (
            // Comercio con varias sucursales: encabezado + sucursales anidadas.
            <div key={c.key} className="border-b last:border-b-0">
              <div className="flex items-center justify-between gap-2 bg-muted/50 px-2 py-1.5">
                <span className="min-w-0 truncate text-xs font-semibold">
                  {c.name} <span className="font-normal text-muted-foreground">· {fmtRut(c.rut)} · {c.items.length} sucursales</span>
                </span>
                <button
                  type="button"
                  className="shrink-0 text-xs font-medium text-indigo-600 hover:underline"
                  onClick={() => toggleMany(c.items)}
                >
                  {c.items.every((i) => valueSet.has(i.id)) ? "Quitar todas" : "Seleccionar todas"}
                </button>
              </div>
              {c.items.map((b) => (
                <button
                  type="button"
                  key={b.id}
                  onClick={() => toggle(b.id)}
                  className="flex w-full items-center gap-2 px-2 py-1.5 pl-6 text-left text-sm hover:bg-accent"
                >
                  <CheckBox checked={valueSet.has(b.id)} />
                  <span className="min-w-0 truncate">{b.branchLabel || b.nokoen}</span>
                  {b.koen && <span className="ml-auto shrink-0 pl-2 text-xs text-muted-foreground">{b.koen}</span>}
                </button>
              ))}
            </div>
          ) : (
            // Cliente único: fila plana con nombre + RUT + código.
            <button
              type="button"
              key={c.key}
              onClick={() => toggle(c.items[0].id)}
              className="flex w-full items-center gap-2 border-b px-2 py-2 text-left text-sm last:border-b-0 hover:bg-accent"
            >
              <CheckBox checked={valueSet.has(c.items[0].id)} />
              <span className="min-w-0 flex-1 truncate">{c.items[0].nokoen}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{fmtRut(c.rut)}</span>
              {c.items[0].koen && (
                <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                  {c.items[0].koen}
                </span>
              )}
            </button>
          ),
        )}

        {truncated > 0 && (
          <div className="p-2 text-center text-xs text-muted-foreground">
            +{truncated} más — refiná la búsqueda para verlos
          </div>
        )}
      </div>

      {selectedRows.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedRows.map((b) => (
            <Badge key={b.id} variant="secondary" className="max-w-[200px] text-xs font-normal">
              <span className="truncate">{b.branchLabel || b.nokoen}</span>
              <button type="button" className="ml-1 shrink-0 hover:text-destructive" onClick={() => toggle(b.id)}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

export default function UsersPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<SalespersonUser | null>(null);
  const [roleFilter, setRoleFilter] = useState<string>("todos");
  const [statusFilter, setStatusFilter] = useState<"todos" | "activos" | "inactivos">("todos");
  const [searchTerm, setSearchTerm] = useState("");
  const [clientSearchOpen, setClientSearchOpen] = useState(false);
  const [createRutSearch, setCreateRutSearch] = useState('');
  const [editRutSearch, setEditRutSearch] = useState('');
  // Sucursales asignadas (scope de datos) para usuarios con rol encargado_area
  const [createBranches, setCreateBranches] = useState<string[]>([]);
  const [editBranches, setEditBranches] = useState<string[]>([]);

  // Verificar permiso del módulo (configurable en Roles y Permisos)
  const [, setLocation] = useLocation();
  const { can, isReady: permissionsReady } = usePermissions();

  useEffect(() => {
    if (user && permissionsReady && !can('config.usuarios')) {
      toast({
        title: "Acceso denegado",
        description: "Tu rol no tiene habilitada la gestión de usuarios.",
        variant: "destructive",
      });
      setTimeout(() => {
        setLocation('/');
      }, 1000);
    }
  }, [user, permissionsReady, can, toast, setLocation]);

  // Query para obtener usuarios
  const { data: salespeopleUsers = [], isLoading } = useQuery<SalespersonUser[]>({
    queryKey: ["/api/users/salespeople"],
    enabled: !!user && can('config.usuarios'),
  });

  // Roles presentes en los datos, ordenados por cantidad de usuarios
  const roleTabs = Object.entries(
    salespeopleUsers.reduce<Record<string, number>>((acc, u) => {
      const role = u.role ?? "salesperson";
      acc[role] = (acc[role] ?? 0) + 1;
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1]);

  // Filtrar usuarios según rol, estado y búsqueda
  const filteredUsers = salespeopleUsers.filter((userData) => {
    if (roleFilter !== "todos" && userData.role !== roleFilter) return false;
    if (statusFilter === "activos" && !userData.isActive) return false;
    if (statusFilter === "inactivos" && userData.isActive) return false;
    if (searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase();
      const haystack = [userData.salespersonName, userData.username, userData.email]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(term)) return false;
    }
    return true;
  });

  // Usuarios del rol seleccionado (para los contadores de estado de las pestañas)
  const usersInRole = roleFilter === "todos"
    ? salespeopleUsers
    : salespeopleUsers.filter(u => u.role === roleFilter);
  const activeInRole = usersInRole.filter(u => u.isActive).length;
  const inactiveInRole = usersInRole.length - activeInRole;
  const hasFilters = roleFilter !== "todos" || statusFilter !== "todos" || searchTerm.trim() !== "";

  // Función para obtener el nombre del supervisor
  const getSupervisorName = (supervisorId: string | null) => {
    if (!supervisorId || supervisorId === 'none') return 'Sin supervisor';
    const supervisor = availableSupervisors.find(s => s.id === supervisorId);
    return supervisor ? supervisor.salespersonName : 'Sin supervisor';
  };

  // Función para obtener sugerencia de segmento basado en ventas
  const getSegmentSuggestion = (assignedSegment: string | null) => {
    if (assignedSegment) return assignedSegment;

    // Si no tiene segmento asignado, sugerir el de mejores ventas
    const topSegment = segmentsData[0]; // Ya están ordenados por ventas DESC
    if (topSegment) {
      return `💡 ${topSegment.segment}`;
    }
    return 'Sin segmento';
  };

  // Query para obtener vendedores disponibles
  const { data: availableSalespeople = [] } = useQuery<string[]>({
    queryKey: ["/api/goals/data/salespeople"],
    enabled: user?.role === 'admin' || (user?.role === 'supervisor' || user?.role === 'encargado_area'),
  });

  // Query para obtener supervisores disponibles
  const { data: availableSupervisors = [] } = useQuery<SalespersonUser[]>({
    queryKey: ["/api/users/salespeople/supervisors"],
    enabled: user?.role === 'admin' || (user?.role === 'supervisor' || user?.role === 'encargado_area'),
  });

  // Query para obtener clientes disponibles
  const { data: availableClients = [] } = useQuery<string[]>({
    queryKey: ["/api/goals/data/clients"],
    enabled: user?.role === 'admin' || (user?.role === 'supervisor' || user?.role === 'encargado_area'),
  });

  // Query para obtener segmentos únicos (para asignación de usuarios)
  const { data: availableSegments = [] } = useQuery<string[]>({
    queryKey: ["/api/goals/data/segments"],
    enabled: user?.role === 'admin' || (user?.role === 'supervisor' || user?.role === 'encargado_area'),
  });

  // Árbol de clientes/sucursales para asignar el scope de datos de un encargado de área.
  // Solo admin/supervisor gestionan asignaciones (el endpoint lo restringe).
  const { data: branchesTree = [] } = useQuery<BranchRow[]>({
    queryKey: ["/api/clients/branches-tree"],
    enabled: !!user && (user?.role === 'admin' || user?.role === 'supervisor') && can('config.usuarios'),
  });

  // Conteo de sucursales asignadas por usuario, para mostrar el scope en la tabla.
  const { data: branchCounts = {} } = useQuery<Record<string, number>>({
    queryKey: ["/api/users/branch-assignment-counts"],
    enabled: !!user && (user?.role === 'admin' || user?.role === 'supervisor') && can('config.usuarios'),
  });

  // Query para obtener segmentos ordenados por ventas (para sugerencias)
  const { data: segmentsData = [] } = useQuery<Array<{ segment: string; totalSales: number; percentage: number }>>({
    queryKey: ["/api/sales/segments?period=2025-09&filterType=month"],
    enabled: user?.role === 'admin' || (user?.role === 'supervisor' || user?.role === 'encargado_area'),
  });

  // RUT search queries
  const { data: createRutResult } = useQuery<{ found: boolean; client: any }>({
    queryKey: ['/api/clients/search-by-rut', createRutSearch],
    queryFn: () => fetch(`/api/clients/search-by-rut?rut=${encodeURIComponent(createRutSearch)}`, { credentials: 'include' }).then(r => r.json()),
    enabled: createRutSearch.length >= 4,
  });

  const { data: editRutResult } = useQuery<{ found: boolean; client: any }>({
    queryKey: ['/api/clients/search-by-rut', editRutSearch],
    queryFn: () => fetch(`/api/clients/search-by-rut?rut=${encodeURIComponent(editRutSearch)}`, { credentials: 'include' }).then(r => r.json()),
    enabled: editRutSearch.length >= 4,
  });

  // Helper para extraer mensaje de error del backend
  const extractErrorMessage = (error: any): string => {
    try {
      // El error llega como "400: {"message":"Ya existe un usuario con ese nombre"}"
      const errorMsg = error.message || "";
      const jsonMatch = errorMsg.match(/\{.*\}/);
      if (jsonMatch) {
        const errorData = JSON.parse(jsonMatch[0]);
        return errorData.message || errorMsg;
      }
      return errorMsg || "Error desconocido";
    } catch {
      return error.message || "Error desconocido";
    }
  };

  // Mutation para crear usuario
  const createUserMutation = useMutation({
    mutationFn: async (userData: InsertSalespersonUserInput) => {
      const res = await apiRequest("POST", "/api/users/salespeople", userData);
      // Si es encargado de área, guardar sus sucursales asignadas (scope de datos).
      if (userData.role === 'encargado_area' && createBranches.length > 0) {
        try {
          const created: any = await res.clone().json();
          if (created?.id) {
            await apiRequest("PUT", `/api/users/salespeople/${created.id}/branch-assignments`, { clientIds: createBranches });
          }
        } catch { /* si falla, el admin puede asignarlas luego desde Editar */ }
      }
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users/salespeople"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users/branch-assignment-counts"] });
      createForm.reset();
      setCreateBranches([]);
      setIsCreateDialogOpen(false);
      toast({
        title: "Usuario creado",
        description: "El usuario se ha creado correctamente.",
      });
    },
    onError: (error: any) => {
      const errorMessage = extractErrorMessage(error);
      toast({
        title: "Error al crear usuario",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  // Mutation para actualizar usuario
  const updateUserMutation = useMutation({
    mutationFn: async ({ id, userData, branches }: { id: string; userData: Partial<InsertSalespersonUserInput>; branches?: string[] }) => {
      const res = await apiRequest("PUT", `/api/users/salespeople/${id}`, userData);
      // Reemplazar sucursales asignadas cuando aplica (scope de datos del encargado).
      if (branches !== undefined) {
        await apiRequest("PUT", `/api/users/salespeople/${id}/branch-assignments`, { clientIds: branches });
      }
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users/salespeople"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users/branch-assignment-counts"] });
      editForm.reset();
      setEditBranches([]);
      setIsEditDialogOpen(false);
      setEditingUser(null);
      toast({
        title: "Usuario actualizado",
        description: "El usuario se ha actualizado correctamente.",
      });
    },
    onError: (error: any) => {
      const errorMessage = extractErrorMessage(error);
      toast({
        title: "Error al actualizar usuario",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  // Mutation para eliminar usuario
  const deleteUserMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/users/salespeople/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users/salespeople"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users/branch-assignment-counts"] });
      toast({
        title: "Usuario eliminado",
        description: "El usuario se ha eliminado correctamente.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo eliminar el usuario.",
        variant: "destructive",
      });
    },
  });


  // Función para generar nombre de usuario automáticamente
  const generateUsername = (fullName: string): string => {
    const nameParts = fullName.trim().toLowerCase().split(' ');
    if (nameParts.length < 2) {
      return nameParts[0].substring(0, 4);
    }
    const firstLetter = nameParts[0].charAt(0);
    const firstLastName = nameParts[1];
    return firstLetter + firstLastName;
  };

  // Form para crear usuario
  const createForm = useForm<InsertSalespersonUserInput>({
    resolver: zodResolver(insertSalespersonUserSchema),
    defaultValues: {
      salespersonName: "",
      username: "",
      email: "",
      password: "",
      isActive: true,
      role: "salesperson",
      supervisorId: null,
      assignedSegment: null,
    },
  });

  // Watch salespersonName to auto-generate username
  const watchedSalesperson = createForm.watch("salespersonName");
  const watchedRole = createForm.watch("role");

  useEffect(() => {
    if (watchedSalesperson) {
      const autoUsername = generateUsername(watchedSalesperson);
      createForm.setValue("username", autoUsername);
    }
  }, [watchedSalesperson, createForm]);

  // Helper function to determine if a role should show segment field
  const shouldShowSegmentField = (role: string | null | undefined) => {
    const rolesWithoutSegment = ["laboratorio", "produccion", "logistica_bodega", "planificacion", "bodega_materias_primas", "prevencion_riesgos", "tecnico_obra", "client", "reception"];
    return role && !rolesWithoutSegment.includes(role);
  };

  // Clear fields when role changes
  useEffect(() => {
    if (watchedRole !== "salesperson") {
      createForm.setValue("supervisorId", null);
    }
    if (watchedRole !== "supervisor") {
      createForm.setValue("assignedSegment", null);
    }
    if (!shouldShowSegmentField(watchedRole)) {
      createForm.setValue("assignedSegment", null);
    }
  }, [watchedRole, createForm]);

  // Form para editar usuario
  const editForm = useForm<InsertSalespersonUserInput>({
    resolver: zodResolver(insertSalespersonUserSchema),
    defaultValues: {
      salespersonName: "",
      username: "",
      email: "",
      password: "",
      isActive: true,
      role: "salesperson",
      supervisorId: null,
      assignedSegment: null,
    },
  });

  // Logic for edit form - watch role changes
  const watchedEditRole = editForm.watch("role");
  useEffect(() => {
    if (watchedEditRole !== "salesperson") {
      editForm.setValue("supervisorId", null);
    }
    // Removed segment clearing - all roles can have segments now
  }, [watchedEditRole, editForm]);

  const handleCreateSubmit = (data: InsertSalespersonUserInput) => {
    // Limpiar campos según el rol
    const cleanedData = {
      ...data,
      supervisorId: data.role === "salesperson" && data.supervisorId !== "none" ? data.supervisorId : null,
      assignedSegment: data.assignedSegment && data.assignedSegment !== "none" ? data.assignedSegment : null
    };
    console.log("Enviando datos:", cleanedData);
    createUserMutation.mutate(cleanedData);
  };

  const handleEditSubmit = (data: InsertSalespersonUserInput) => {
    if (!editingUser) return;
    // Limpiar campos según el rol
    const cleanedData = {
      ...data,
      supervisorId: data.role === "salesperson" && data.supervisorId !== "none" ? data.supervisorId : null,
      assignedSegment: data.assignedSegment && data.assignedSegment !== "none" ? data.assignedSegment : null
    };

    // Filtrar contraseñas vacías para evitar sobrescribir contraseñas existentes
    if (!data.password || data.password.trim() === "") {
      delete cleanedData.password;
    }

    // Scope de datos: enviar sucursales solo si el rol (nuevo o previo) lo amerita.
    // - encargado_area => guardar la selección actual.
    // - dejó de ser encargado_area => limpiar ([]).
    // - nunca fue encargado_area => no tocar (undefined).
    const branches = data.role === 'encargado_area'
      ? editBranches
      : (editingUser.role === 'encargado_area' ? [] : undefined);

    console.log("Editando datos:", cleanedData);
    updateUserMutation.mutate({ id: editingUser.id, userData: cleanedData, branches });
  };

  const handleEdit = (user: SalespersonUser) => {
    setEditingUser(user);
    // Cargar las sucursales asignadas si es encargado de área (para precargar el selector).
    setEditBranches([]);
    if ((user.role ?? '') === 'encargado_area') {
      fetch(`/api/users/salespeople/${user.id}/branch-assignments`, { credentials: 'include' })
        .then((r) => r.json())
        .then((rows) => setEditBranches(Array.isArray(rows) ? rows.map((x: any) => x.clientId) : []))
        .catch(() => setEditBranches([]));
    }
    editForm.reset({
      salespersonName: user.salespersonName,
      username: user.username ?? "",
      email: user.email ?? "",
      password: "",
      isActive: user.isActive ?? true,
      role: (user.role ?? "salesperson") as "admin" | "supervisor" | "encargado_area" | "salesperson" | "tecnico_obra" | "client",
      supervisorId: user.supervisorId ?? "none",
      assignedSegment: user.assignedSegment ?? "none",
      clientRut: (user as any).clientRut ?? "",
    });
    setEditRutSearch((user as any).clientRut ?? '');
    setIsEditDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("¿Estás seguro de que deseas eliminar este usuario?")) {
      deleteUserMutation.mutate(id);
    }
  };

  if (user?.role !== 'admin' && (user?.role !== 'supervisor' && user?.role !== 'encargado_area')) {
    return null; // No renderizar nada si no es admin o supervisor
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 space-y-6">
        {/* Modern Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 text-white">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSA2MCAwIEwgMCAwIDAgNjAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjAzKSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-40" />
          <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20">
                <Users className="h-7 w-7 text-indigo-400" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Gestión de Usuarios</h1>
                <p className="text-slate-300 text-sm md:text-base mt-1">
                  Administra las cuentas de acceso y permisos del sistema
                </p>
              </div>
            </div>
            <div className="flex-shrink-0">
              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button data-testid="button-create-user" className="bg-indigo-600 hover:bg-indigo-700 border-0">
                    <Plus className="w-4 h-4 mr-2" />
                    Nuevo Usuario
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-hidden flex flex-col">
                  <DialogHeader className="shrink-0">
                    <DialogTitle>Crear Nuevo Usuario</DialogTitle>
                    <DialogDescription>
                      Crea una cuenta de acceso para un vendedor del sistema
                    </DialogDescription>
                  </DialogHeader>
                  <Form {...createForm}>
                    <form onSubmit={createForm.handleSubmit(handleCreateSubmit)} className="flex flex-col flex-1 min-h-0 overflow-hidden">
                      <div className="flex-1 min-h-0 space-y-4 overflow-y-auto px-1">
                      <FormField
                        control={createForm.control}
                        name="role"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Rol de Usuario</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value ?? "salesperson"}>
                              <FormControl>
                                <SelectTrigger data-testid="select-role">
                                  <SelectValue placeholder="Selecciona un rol" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="admin">Administrador</SelectItem>
                                <SelectItem value="supervisor">Supervisor</SelectItem>
                                <SelectItem value="encargado_area">Encargado de Área</SelectItem>
                                <SelectItem value="salesperson">Vendedor</SelectItem>
                                <SelectItem value="tecnico_obra">Técnico de Obra</SelectItem>
                                <SelectItem value="jefe_planta">Jefe de Planta</SelectItem>
                                <SelectItem value="mantencion">Mantención</SelectItem>
                                <SelectItem value="laboratorio">Laboratorio</SelectItem>
                                <SelectItem value="produccion">Producción</SelectItem>
                                <SelectItem value="logistica_bodega">Logística y Bodega</SelectItem>
                                <SelectItem value="planificacion">Planificación</SelectItem>
                                <SelectItem value="bodega_materias_primas">Bodega Materias Primas</SelectItem>
                                <SelectItem value="prevencion_riesgos">Prevención de Riesgos</SelectItem>
                                <SelectItem value="recursos_humanos">Recursos Humanos</SelectItem>
                                <SelectItem value="marketing">Marketing</SelectItem>
                                <SelectItem value="client">Cliente</SelectItem>
                                <SelectItem value="reception">Recepción</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Campo de nombre para todos los roles */}
                      <FormField
                        control={createForm.control}
                        name="salespersonName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nombre Completo</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                value={field.value ?? ''}
                                placeholder="Ingresa el nombre completo"
                                data-testid="input-user-name"
                              />
                            </FormControl>
                            <FormDescription>
                              Nombre de la persona o cliente que usará este usuario
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Campos específicos para vendedores */}
                      {createForm.watch("role") === "encargado_area" && (
                        <div className="space-y-3 p-4 bg-amber-50 rounded-lg border-l-4 border-amber-400">
                          <div className="flex items-center space-x-2">
                            <div className="w-2 h-2 bg-amber-400 rounded-full" />
                            <h4 className="font-medium text-amber-900">Sucursales asignadas (scope de datos)</h4>
                          </div>
                          <p className="text-xs text-amber-800">
                            El encargado verá estadísticas y comercios solo de estas sucursales. Sin asignar nada = ve todo.
                          </p>
                          <BranchAssignmentSelector branches={branchesTree} value={createBranches} onChange={setCreateBranches} />
                        </div>
                      )}

                      {createForm.watch("role") === "salesperson" && (
                        <div className="space-y-4 p-4 bg-blue-50 rounded-lg border-l-4 border-blue-400">
                          <div className="flex items-center space-x-2">
                            <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                            <h4 className="font-medium text-blue-900">Configuración de Vendedor</h4>
                          </div>

                          {availableSalespeople.filter(sp => !salespeopleUsers.some(user => user.salespersonName === sp)).length > 0 && (
                            <div className="text-sm text-muted-foreground">
                              <p className="mb-1">O selecciona de vendedores con ventas registradas:</p>
                              <Select
                                onValueChange={(value) => createForm.setValue("salespersonName", value)}
                                value={availableSalespeople.includes(createForm.watch("salespersonName") || '') ? createForm.watch("salespersonName") : ''}
                              >
                                <SelectTrigger data-testid="select-salesperson-name" className="bg-white">
                                  <SelectValue placeholder="Seleccionar de la lista" />
                                </SelectTrigger>
                                <SelectContent>
                                  {availableSalespeople
                                    .filter(sp => !salespeopleUsers.some(user => user.salespersonName === sp))
                                    .map((salesperson) => (
                                      <SelectItem key={salesperson} value={salesperson}>
                                        {salesperson}
                                      </SelectItem>
                                    ))
                                  }
                                </SelectContent>
                              </Select>
                            </div>
                          )}

                          <FormField
                            control={createForm.control}
                            name="supervisorId"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Supervisor Asignado</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value ?? "none"}>
                                  <FormControl>
                                    <SelectTrigger data-testid="select-supervisor">
                                      <SelectValue placeholder="Selecciona un supervisor" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="none">Sin supervisor</SelectItem>
                                    {availableSupervisors.map((supervisor) => (
                                      <SelectItem key={supervisor.id} value={supervisor.id}>
                                        {supervisor.salespersonName}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      )}

                      {/* Buscador de Clientes (Opcional para autocompletado) */}
                      {createForm.watch("role") === "client" && (
                        <FormItem className="flex flex-col p-3 bg-muted/50 rounded-lg border border-dashed">
                          <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Asistente de Importación (Opcional)</FormLabel>
                          <Popover open={clientSearchOpen} onOpenChange={setClientSearchOpen}>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
                                  role="combobox"
                                  className="w-full justify-between bg-white"
                                >
                                  Cargar datos de cliente sistema...
                                  <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-[400px] p-0" align="start">
                              <Command>
                                <CommandInput placeholder="Buscar cliente en sistema..." />
                                <CommandList>
                                  <CommandEmpty>No se encontró ningún cliente.</CommandEmpty>
                                  <CommandGroup>
                                    {availableClients
                                      .filter(client => !salespeopleUsers.some(user => user.salespersonName === client))
                                      .map((client) => (
                                        <CommandItem
                                          value={client}
                                          key={client}
                                          onSelect={() => {
                                            createForm.setValue("salespersonName", client);
                                            // Activar búsqueda de RUT para este cliente si es posible
                                            setClientSearchOpen(false);
                                          }}
                                        >
                                          <Check className="mr-2 h-4 w-4 opacity-0" />
                                          {client}
                                        </CommandItem>
                                      ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                          <p className="text-[10px] text-muted-foreground mt-1 italic">
                            Selecciona un cliente para autocompletar, o escribe los datos manualmente en los campos de arriba y abajo.
                          </p>
                        </FormItem>
                      )}

                      {/* RUT field for clients */}
                      {createForm.watch("role") === "client" && (
                        <div className="space-y-2">
                          <FormField
                            control={createForm.control}
                            name="clientRut"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>RUT del Cliente</FormLabel>
                                <div className="relative">
                                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                  <FormControl>
                                    <Input
                                      {...field}
                                      value={field.value ?? ''}
                                      placeholder="Ej: 76.123.456-7"
                                      className="pl-9"
                                      data-testid="input-client-rut"
                                      onChange={(e) => {
                                        field.onChange(e.target.value);
                                        setCreateRutSearch(e.target.value);
                                      }}
                                    />
                                  </FormControl>
                                </div>
                                <FormDescription>
                                  Ingresa el RUT para asociar este usuario con un cliente del sistema
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          {createRutResult?.found && createRutResult.client && (
                            <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                              <Building2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-emerald-800 truncate">{createRutResult.client.nokoen}</p>
                                <p className="text-xs text-emerald-600">RUT: {createRutResult.client.rten} • Código: {createRutResult.client.koen}</p>
                              </div>
                              <Check className="h-4 w-4 text-emerald-500 flex-shrink-0 ml-auto" />
                            </div>
                          )}
                          {createRutSearch.length >= 4 && createRutResult && !createRutResult.found && (
                            <div className="p-2 rounded-lg bg-amber-50 border border-amber-200">
                              <p className="text-xs text-amber-700">No se encontró un cliente con este RUT</p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* El campo salespersonName ya se muestra arriba siempre */}

                      {shouldShowSegmentField(watchedRole) && (
                        <FormField
                          control={createForm.control}
                          name="assignedSegment"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Segmento Asignado</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value ?? "none"}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-assigned-segment">
                                    <SelectValue placeholder="Selecciona un segmento" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="none">Sin segmento</SelectItem>
                                  {availableSegments.map((segment) => (
                                    <SelectItem key={segment} value={segment}>
                                      {segment}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                      <FormField
                        control={createForm.control}
                        name="username"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nombre de Usuario</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-username" placeholder="Se genera automáticamente" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={createForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email (opcional)</FormLabel>
                            <FormControl>
                              <Input type="email" {...field} data-testid="input-email" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={createForm.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Contraseña (opcional)</FormLabel>
                            <FormControl>
                              <Input type="password" {...field} data-testid="input-password" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={createForm.control}
                        name="isActive"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                            <div className="space-y-0.5">
                              <FormLabel>Usuario Activo</FormLabel>
                              <p className="text-sm text-muted-foreground">
                                El usuario puede acceder al sistema
                              </p>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value ?? true}
                                onCheckedChange={field.onChange}
                                data-testid="switch-is-active"
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      </div>
                      <DialogFooter className="shrink-0 border-t pt-4">
                        <Button type="submit" disabled={createUserMutation.isPending} data-testid="button-submit-create">
                          {createUserMutation.isPending ? "Creando..." : "Crear Usuario"}
                        </Button>
                      </DialogFooter>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>


        {/* Dialog de edición */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader className="shrink-0">
              <DialogTitle>Editar Usuario</DialogTitle>
              <DialogDescription>
                Modifica la información del usuario seleccionado
              </DialogDescription>
            </DialogHeader>
            <Form {...editForm}>
              <form onSubmit={editForm.handleSubmit(handleEditSubmit)} className="flex flex-col flex-1 min-h-0 overflow-hidden">
                <div className="flex-1 min-h-0 space-y-4 overflow-y-auto px-1">
                <FormField
                  control={editForm.control}
                  name="salespersonName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre Completo</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-edit-salesperson-name" readOnly />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre de Usuario</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-edit-username" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" {...field} data-testid="input-edit-email" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nueva Contraseña (dejar vacío para no cambiar)</FormLabel>
                      <FormControl>
                        <Input type="password" {...field} data-testid="input-edit-password" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rol</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value ?? "salesperson"}>
                        <FormControl>
                          <SelectTrigger data-testid="select-edit-role">
                            <SelectValue placeholder="Selecciona un rol" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="admin">Administrador</SelectItem>
                          <SelectItem value="supervisor">Supervisor</SelectItem>
                          <SelectItem value="encargado_area">Encargado de Área</SelectItem>
                          <SelectItem value="salesperson">Vendedor</SelectItem>
                          <SelectItem value="tecnico_obra">Técnico de Obra</SelectItem>
                          <SelectItem value="jefe_planta">Jefe de Planta</SelectItem>
                          <SelectItem value="mantencion">Mantención</SelectItem>
                          <SelectItem value="laboratorio">Laboratorio</SelectItem>
                          <SelectItem value="produccion">Producción</SelectItem>
                          <SelectItem value="logistica_bodega">Logística y Bodega</SelectItem>
                          <SelectItem value="planificacion">Planificación</SelectItem>
                          <SelectItem value="bodega_materias_primas">Bodega Materias Primas</SelectItem>
                          <SelectItem value="prevencion_riesgos">Prevención de Riesgos</SelectItem>
                          <SelectItem value="recursos_humanos">Recursos Humanos</SelectItem>
                          <SelectItem value="marketing">Marketing</SelectItem>
                          <SelectItem value="client">Cliente</SelectItem>
                          <SelectItem value="reception">Recepción</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {editForm.watch("role") === "encargado_area" && (
                  <div className="space-y-3 p-4 bg-amber-50 rounded-lg border-l-4 border-amber-400">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-amber-400 rounded-full" />
                      <h4 className="font-medium text-amber-900">Sucursales asignadas (scope de datos)</h4>
                    </div>
                    <p className="text-xs text-amber-800">
                      El encargado verá estadísticas y comercios solo de estas sucursales. Sin asignar nada = ve todo.
                    </p>
                    <BranchAssignmentSelector branches={branchesTree} value={editBranches} onChange={setEditBranches} />
                  </div>
                )}

                {editForm.watch("role") === "salesperson" && (
                  <FormField
                    control={editForm.control}
                    name="supervisorId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Supervisor</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value ?? "none"}>
                          <FormControl>
                            <SelectTrigger data-testid="select-edit-supervisor">
                              <SelectValue placeholder="Selecciona un supervisor" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">Sin supervisor</SelectItem>
                            {availableSupervisors.map((supervisor) => (
                              <SelectItem key={supervisor.id} value={supervisor.id}>
                                {supervisor.salespersonName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {shouldShowSegmentField(watchedEditRole) && (
                  <FormField
                    control={editForm.control}
                    name="assignedSegment"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Segmento Asignado</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value ?? "none"}>
                          <FormControl>
                            <SelectTrigger data-testid="select-edit-assigned-segment">
                              <SelectValue placeholder="Selecciona un segmento" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">Sin segmento</SelectItem>
                            {availableSegments.map((segment) => (
                              <SelectItem key={segment} value={segment}>
                                {segment}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {/* RUT field for client role in edit dialog */}
                {editForm.watch("role") === "client" && (
                  <div className="space-y-2">
                    <FormField
                      control={editForm.control}
                      name="clientRut"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>RUT del Cliente</FormLabel>
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <FormControl>
                              <Input
                                {...field}
                                value={field.value ?? ''}
                                placeholder="Ej: 76.123.456-7"
                                className="pl-9"
                                data-testid="input-edit-client-rut"
                                onChange={(e) => {
                                  field.onChange(e.target.value);
                                  setEditRutSearch(e.target.value);
                                }}
                              />
                            </FormControl>
                          </div>
                          <FormDescription>
                            Ingresa el RUT para asociar este usuario con un cliente del sistema
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    {editRutResult?.found && editRutResult.client && (
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                        <Building2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-emerald-800 truncate">{editRutResult.client.nokoen}</p>
                          <p className="text-xs text-emerald-600">RUT: {editRutResult.client.rten} • Código: {editRutResult.client.koen}</p>
                        </div>
                        <Check className="h-4 w-4 text-emerald-500 flex-shrink-0 ml-auto" />
                      </div>
                    )}
                    {editRutSearch.length >= 4 && editRutResult && !editRutResult.found && (
                      <div className="p-2 rounded-lg bg-amber-50 border border-amber-200">
                        <p className="text-xs text-amber-700">No se encontró un cliente con este RUT</p>
                      </div>
                    )}
                  </div>
                )}

                <FormField
                  control={editForm.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel>Usuario Activo</FormLabel>
                        <p className="text-sm text-muted-foreground">
                          El usuario puede acceder al sistema
                        </p>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value ?? true}
                          onCheckedChange={field.onChange}
                          data-testid="switch-edit-is-active"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                </div>
                <DialogFooter className="shrink-0 border-t pt-4">
                  <Button type="submit" disabled={updateUserMutation.isPending} data-testid="button-submit-edit">
                    {updateUserMutation.isPending ? "Actualizando..." : "Actualizar Usuario"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          <Card
            className={cn(
              "border shadow-sm cursor-pointer transition-all hover:shadow-md",
              statusFilter === "todos" ? "border-indigo-300 ring-1 ring-indigo-200 bg-indigo-50/50 dark:bg-indigo-950/30" : "border-transparent"
            )}
            onClick={() => setStatusFilter("todos")}
            data-testid="card-summary-total"
          >
            <CardContent className="p-3 sm:p-4 flex items-center gap-3">
              <div className="hidden sm:flex items-center justify-center w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/50">
                <Users className="h-5 w-5 text-indigo-600 dark:text-indigo-300" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Total usuarios</p>
                <p className="text-xl sm:text-2xl font-bold text-indigo-700 dark:text-indigo-300">{salespeopleUsers.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card
            className={cn(
              "border shadow-sm cursor-pointer transition-all hover:shadow-md",
              statusFilter === "activos" ? "border-green-300 ring-1 ring-green-200 bg-green-50/50 dark:bg-green-950/30" : "border-transparent"
            )}
            onClick={() => setStatusFilter("activos")}
            data-testid="card-summary-active"
          >
            <CardContent className="p-3 sm:p-4 flex items-center gap-3">
              <div className="hidden sm:flex items-center justify-center w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/50">
                <UserCheck className="h-5 w-5 text-green-600 dark:text-green-300" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Activos</p>
                <p className="text-xl sm:text-2xl font-bold text-green-600 dark:text-green-300">{salespeopleUsers.filter(u => u.isActive).length}</p>
              </div>
            </CardContent>
          </Card>
          <Card
            className={cn(
              "border shadow-sm cursor-pointer transition-all hover:shadow-md",
              statusFilter === "inactivos" ? "border-red-300 ring-1 ring-red-200 bg-red-50/50 dark:bg-red-950/30" : "border-transparent"
            )}
            onClick={() => setStatusFilter("inactivos")}
            data-testid="card-summary-inactive"
          >
            <CardContent className="p-3 sm:p-4 flex items-center gap-3">
              <div className="hidden sm:flex items-center justify-center w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/50">
                <UserX className="h-5 w-5 text-red-600 dark:text-red-300" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Inactivos</p>
                <p className="text-xl sm:text-2xl font-bold text-red-600 dark:text-red-300">{salespeopleUsers.filter(u => !u.isActive).length}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Role Tabs + Search */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3 sm:p-4 space-y-3">
            {/* Búsqueda */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por nombre, usuario o email..."
                className="pl-9 pr-9 bg-muted/30"
                data-testid="input-user-search"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Limpiar búsqueda"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Pestañas por rol */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
              <button
                type="button"
                onClick={() => setRoleFilter("todos")}
                className={cn(
                  "flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs sm:text-sm font-medium border transition-colors",
                  roleFilter === "todos"
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "bg-muted/40 text-muted-foreground border-transparent hover:bg-muted"
                )}
                data-testid="tab-role-todos"
              >
                Todos
                <span className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                  roleFilter === "todos" ? "bg-white/20" : "bg-muted-foreground/10"
                )}>
                  {salespeopleUsers.length}
                </span>
              </button>
              {roleTabs.map(([role, count]) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => setRoleFilter(role)}
                  className={cn(
                    "flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs sm:text-sm font-medium border transition-colors",
                    roleFilter === role
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "bg-muted/40 text-muted-foreground border-transparent hover:bg-muted"
                  )}
                  data-testid={`tab-role-${role}`}
                >
                  {getRoleLabel(role, true)}
                  <span className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                    roleFilter === role ? "bg-white/20" : "bg-muted-foreground/10"
                  )}>
                    {count}
                  </span>
                </button>
              ))}
            </div>

            {/* Sub-pestañas de estado dentro del rol seleccionado */}
            <div className="flex items-center gap-1.5">
              {([
                { value: "todos", label: "Todos", count: usersInRole.length },
                { value: "activos", label: "Activos", count: activeInRole },
                { value: "inactivos", label: "Inactivos", count: inactiveInRole },
              ] as const).map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setStatusFilter(tab.value)}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs font-medium border transition-colors",
                    statusFilter === tab.value
                      ? tab.value === "activos"
                        ? "bg-green-600 text-white border-green-600"
                        : tab.value === "inactivos"
                          ? "bg-red-600 text-white border-red-600"
                          : "bg-slate-700 text-white border-slate-700"
                      : "bg-muted/40 text-muted-foreground border-transparent hover:bg-muted"
                  )}
                  data-testid={`tab-status-${tab.value}`}
                >
                  {tab.label} ({tab.count})
                </button>
              ))}
              {hasFilters && (
                <button
                  type="button"
                  onClick={() => { setRoleFilter("todos"); setStatusFilter("todos"); setSearchTerm(""); }}
                  className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  data-testid="button-clear-filters"
                >
                  <X className="h-3 w-3" />
                  Limpiar filtros
                </button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Users Table */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg sm:text-xl flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                  Lista de Usuarios
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm mt-1">
                  {roleFilter === "todos"
                    ? "Gestiona los usuarios y sus permisos de acceso"
                    : `Mostrando rol: ${getRoleLabel(roleFilter)}${statusFilter !== "todos" ? ` · ${statusFilter === "activos" ? "Activos" : "Inactivos"}` : ""}`}
                </CardDescription>
              </div>
              <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200">
                {filteredUsers.length} usuarios
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                  <span className="text-muted-foreground text-sm">Cargando usuarios...</span>
                </div>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                <Users className="h-10 w-10 text-muted-foreground/40 mb-3" />
                <p className="font-medium text-sm">No se encontraron usuarios</p>
                <p className="text-xs text-muted-foreground mt-1">
                  No hay usuarios que coincidan con los filtros seleccionados.
                </p>
                {hasFilters && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4"
                    onClick={() => { setRoleFilter("todos"); setStatusFilter("todos"); setSearchTerm(""); }}
                    data-testid="button-empty-clear-filters"
                  >
                    <X className="h-3.5 w-3.5 mr-1.5" />
                    Limpiar filtros
                  </Button>
                )}
              </div>
            ) : (
              <>
                {/* Desktop Table */}
                <div className="hidden lg:block rounded-lg overflow-hidden border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <TableHead className="font-semibold text-xs uppercase tracking-wider">Nombre</TableHead>
                        <TableHead className="font-semibold text-xs uppercase tracking-wider">Usuario</TableHead>
                        <TableHead className="font-semibold text-xs uppercase tracking-wider">Email</TableHead>
                        <TableHead className="font-semibold text-xs uppercase tracking-wider">Rol</TableHead>
                        <TableHead className="font-semibold text-xs uppercase tracking-wider">Supervisor</TableHead>
                        <TableHead className="font-semibold text-xs uppercase tracking-wider">Segmento</TableHead>
                        <TableHead className="font-semibold text-xs uppercase tracking-wider">Estado</TableHead>
                        <TableHead className="font-semibold text-xs uppercase tracking-wider w-[100px]">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.map((user) => (
                        <TableRow key={user.id} className="hover:bg-muted/20 transition-colors">
                          <TableCell className="font-medium">{user.salespersonName}</TableCell>
                          <TableCell className="text-muted-foreground">{user.username || "Sin usuario"}</TableCell>
                          <TableCell className="text-muted-foreground">{user.email || "Sin email"}</TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <Badge variant={user.role === 'admin' ? 'default' : (user.role === 'supervisor' || user.role === 'encargado_area') ? 'default' : 'secondary'} className={user.role === 'admin' || (user.role === 'supervisor' || user.role === 'encargado_area') ? 'bg-indigo-600 hover:bg-indigo-700' : ''}>
                                {getRoleLabel(user.role)}
                              </Badge>
                              {user.role === 'encargado_area' && (
                                branchCounts[user.id] > 0 ? (
                                  <span className="inline-flex w-fit items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                                    <Building2 className="h-3 w-3" />
                                    {branchCounts[user.id]} sucursal(es)
                                  </span>
                                ) : (
                                  <span className="w-fit text-[11px] text-muted-foreground">Ve todo (sin acotar)</span>
                                )
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{getSupervisorName(user.supervisorId)}</TableCell>
                          <TableCell>
                            {user.assignedSegment ? (
                              <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full">
                                {user.assignedSegment}
                              </span>
                            ) : (
                              <div>
                                <span className="text-blue-600 font-medium text-xs">Sin asignar</span>
                                {segmentsData[0] && (
                                  <div className="text-xs text-muted-foreground mt-1">
                                    Sugerencia: {segmentsData[0].segment}
                                  </div>
                                )}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={user.isActive ? 'default' : 'destructive'} className={user.isActive ? 'bg-green-600 hover:bg-green-700' : ''}>
                              {user.isActive ? 'Activo' : 'Inactivo'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(user)}
                                data-testid={`button-edit-${user.id}`}
                                className="h-8 w-8 p-0 hover:bg-indigo-50 hover:text-indigo-600"
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(user.id)}
                                data-testid={`button-delete-${user.id}`}
                                className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-600 text-muted-foreground"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile Cards */}
                <div className="lg:hidden space-y-3">
                  {filteredUsers.map((user) => (
                    <Card key={user.id} className="border border-gray-200">
                      <CardContent className="p-4">
                        <div className="space-y-3">
                          {/* Header */}
                          <div className="flex justify-between items-start">
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-sm truncate">{user.salespersonName}</h3>
                              <p className="text-xs text-muted-foreground">{user.username || "Sin usuario"}</p>
                            </div>
                            <div className="flex items-center space-x-2 ml-2">
                              <Badge variant={user.isActive ? 'default' : 'destructive'} className="text-xs">
                                {user.isActive ? 'Activo' : 'Inactivo'}
                              </Badge>
                            </div>
                          </div>

                          {/* Details */}
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <span className="text-muted-foreground">Email:</span>
                              <p className="font-medium truncate">{user.email || "Sin email"}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Rol:</span>
                              <div className="mt-1">
                                <Badge variant={user.role === 'admin' || (user.role === 'supervisor' || user.role === 'encargado_area') ? 'default' : 'secondary'} className="text-xs">
                                  {getRoleLabel(user.role, true)}
                                </Badge>
                              </div>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Supervisor:</span>
                              <p className="font-medium text-xs">{getSupervisorName(user.supervisorId)}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Segmento:</span>
                              <p className={`font-medium text-xs ${!user.assignedSegment ? "text-blue-600" : ""}`}>
                                {getSegmentSuggestion(user.assignedSegment)}
                              </p>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex justify-end space-x-2 pt-2 border-t">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEdit(user)}
                              data-testid={`button-edit-${user.id}`}
                              className="text-xs px-2 py-1"
                            >
                              <Edit className="w-3 h-3 mr-1" />
                              Editar
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDelete(user.id)}
                              data-testid={`button-delete-${user.id}`}
                              className="text-xs px-2 py-1"
                            >
                              <Trash2 className="w-3 h-3 mr-1" />
                              Eliminar
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}