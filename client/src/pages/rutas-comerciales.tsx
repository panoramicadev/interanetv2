import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { MapPin, Plus, Trash2, Search, ChevronDown, ChevronRight, User, Building2, Loader2, CalendarDays } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface Ruta {
  id: string;
  nombre: string;
  vendedorId: string;
  supervisorId: string;
  segmento: string | null;
  estado: string;
  fecha: string | null;
  vendedores?: Array<{ id: string; nombre: string | null }>;
  observaciones: string | null;
  createdAt: string;
}
interface RutaCliente {
  id: string;
  rutaId: string;
  clienteId: string;
  clienteNombre: string;
  orden: number | null;
  visitado: boolean | null;
}
interface Vendedor {
  id: string;
  salespersonName: string;
  assignedSegment?: string | null;
}
interface Cliente {
  id: string;
  nokoen: string;
  koen: string;
}

const ESTADO_BADGE: Record<string, string> = {
  activa: "bg-emerald-100 text-emerald-700 border-emerald-200",
  pausada: "bg-amber-100 text-amber-700 border-amber-200",
  completada: "bg-slate-100 text-slate-600 border-slate-200",
};
const ESTADO_LABEL: Record<string, string> = {
  activa: "Activa",
  pausada: "Pausada",
  completada: "Completada",
};

export default function RutasComerciales() {
  return (
    <div className="container mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 m-3 sm:m-4">
      <RutasComercialesContent />
    </div>
  );
}

/**
 * Contenido reutilizable de Rutas Comerciales.
 * Se usa como página standalone (envuelto en el container de arriba) y
 * embebido como pestaña dentro del Panel de Trabajo (tareas.tsx).
 */
export function RutasComercialesContent() {
  const { user } = useAuth();
  const { toast } = useToast();
  const canManage = user?.role === "admin" || user?.role === "supervisor" || user?.role === "encargado_area";
  // Borrar rutas es exclusivo del admin; supervisores/encargados solo las gestionan.
  const isAdmin = user?.role === "admin";

  const [showCreate, setShowCreate] = useState(false);
  const [nombre, setNombre] = useState("");
  const [vendedorIds, setVendedorIds] = useState<string[]>([]);
  const [fecha, setFecha] = useState("");
  const [estado, setEstado] = useState("activa");
  const [expandedRuta, setExpandedRuta] = useState<string | null>(null);

  const { data: rutas = [], isLoading } = useQuery<Ruta[]>({ queryKey: ["/api/rutas"], enabled: !!user });
  const { data: vendedores = [] } = useQuery<Vendedor[]>({ queryKey: ["/api/rutas/vendedores"], enabled: canManage });

  const vendedorName = (id: string) => vendedores.find((v) => v.id === id)?.salespersonName || "Vendedor";
  const toggleVendedor = (id: string) =>
    setVendedorIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  // Nombres de los vendedores de una ruta: usa los guardados y cae al catálogo si falta el nombre.
  const rutaVendedorNames = (ruta: Ruta): string => {
    const list = ruta.vendedores?.length ? ruta.vendedores : (ruta.vendedorId ? [{ id: ruta.vendedorId, nombre: null }] : []);
    return list.map((v) => v.nombre || vendedorName(v.id)).join(", ") || "Sin vendedor";
  };

  const createMutation = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/rutas", { nombre: nombre.trim(), vendedorIds, fecha: fecha || null, estado }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rutas"] });
      setShowCreate(false);
      setNombre("");
      setVendedorIds([]);
      setFecha("");
      setEstado("activa");
      toast({ title: "Ruta creada", description: "La ruta comercial se creó correctamente." });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message || "No se pudo crear la ruta.", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/rutas/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rutas"] });
      toast({ title: "Ruta eliminada" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message || "No se pudo eliminar.", variant: "destructive" }),
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="space-y-0.5">
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white flex items-center justify-center flex-shrink-0 shadow-md shadow-indigo-500/25">
              <MapPin className="w-5 h-5" />
            </span>
            Rutas Comerciales
          </h1>
          <p className="text-sm text-muted-foreground">
            Rutas de visita que el supervisor asigna a los vendedores para vender pinturas.
          </p>
        </div>
        {canManage && (
          <Dialog open={showCreate} onOpenChange={setShowCreate}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white shadow-md shadow-indigo-500/25">
                <Plus className="h-4 w-4 mr-2" />
                Nueva Ruta
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[480px]">
              <DialogHeader>
                <DialogTitle>Nueva Ruta Comercial</DialogTitle>
                <DialogDescription>Define un nombre, fecha y asigna uno o más vendedores.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Nombre *</Label>
                  <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Zona Sur — Ferreterías" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Fecha de la ruta</Label>
                  <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Vendedores * {vendedorIds.length > 0 && <span className="text-indigo-500 normal-case">({vendedorIds.length} seleccionado{vendedorIds.length > 1 ? "s" : ""})</span>}
                  </Label>
                  <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100">
                    {vendedores.length === 0 ? (
                      <div className="px-3 py-2 text-xs text-slate-400">No hay vendedores disponibles</div>
                    ) : (
                      vendedores.map((v) => (
                        <label key={v.id} className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-indigo-50/60 transition-colors">
                          <Checkbox checked={vendedorIds.includes(v.id)} onCheckedChange={() => toggleVendedor(v.id)} />
                          <span className="text-sm text-slate-700">{v.salespersonName}</span>
                        </label>
                      ))
                    )}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Estado</Label>
                  <Select value={estado} onValueChange={setEstado}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="activa">Activa</SelectItem>
                      <SelectItem value="pausada">Pausada</SelectItem>
                      <SelectItem value="completada">Completada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
                <Button
                  className="bg-indigo-600 hover:bg-indigo-700 text-white"
                  disabled={!nombre.trim() || vendedorIds.length === 0 || createMutation.isPending}
                  onClick={() => createMutation.mutate()}
                >
                  {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Crear Ruta"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="text-center py-16">
          <div className="animate-spin rounded-full h-10 w-10 border-3 border-indigo-200 border-t-indigo-600 mx-auto mb-4" />
          <p className="text-slate-500 text-sm">Cargando rutas...</p>
        </div>
      ) : rutas.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-500/25">
            <MapPin className="h-8 w-8 text-white" />
          </div>
          <h3 className="text-lg font-bold text-slate-800 mb-1">No hay rutas</h3>
          <p className="text-sm text-slate-500">
            {canManage ? "Crea la primera ruta comercial para tu equipo." : "Aún no tienes rutas asignadas."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {rutas.map((ruta) => {
            const isExpanded = expandedRuta === ruta.id;
            return (
              <div key={ruta.id} className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3">
                  <button
                    onClick={() => setExpandedRuta(isExpanded ? null : ruta.id)}
                    className="flex items-center gap-3 flex-1 min-w-0 text-left"
                  >
                    {isExpanded ? <ChevronDown className="h-4 w-4 text-slate-400 flex-shrink-0" /> : <ChevronRight className="h-4 w-4 text-slate-400 flex-shrink-0" />}
                    <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                      <MapPin className="h-4 w-4 text-indigo-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-800 truncate">{ruta.nombre}</p>
                      <p className="text-xs text-slate-500 flex items-center gap-1 truncate">
                        <User className="h-3 w-3 flex-shrink-0" /> <span className="truncate">{rutaVendedorNames(ruta)}</span>
                      </p>
                    </div>
                    {ruta.fecha && (
                      <span className="hidden sm:flex items-center gap-1 text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded-md px-2 py-1 flex-shrink-0">
                        <CalendarDays className="h-3 w-3" /> {format(new Date(ruta.fecha), "dd MMM yyyy", { locale: es })}
                      </span>
                    )}
                  </button>
                  <Badge variant="outline" className={`text-[11px] ${ESTADO_BADGE[ruta.estado] || ESTADO_BADGE.activa}`}>
                    {ESTADO_LABEL[ruta.estado] || ruta.estado}
                  </Badge>
                  {isAdmin && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <button className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all" title="Eliminar ruta">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>¿Eliminar la ruta "{ruta.nombre}"?</AlertDialogTitle>
                          <AlertDialogDescription>Se quitarán también todos los clientes asignados a esta ruta. No se puede deshacer.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => deleteMutation.mutate(ruta.id)}>Eliminar</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
                {isExpanded && (
                  <div className="border-t border-slate-100 bg-slate-50/50 p-4">
                    <RutaClientesPanel rutaId={ruta.id} canManage={canManage} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function RutaClientesPanel({ rutaId, canManage }: { rutaId: string; canManage: boolean }) {
  const { toast } = useToast();
  const [search, setSearch] = useState("");

  const { data: clientes = [], isLoading } = useQuery<RutaCliente[]>({ queryKey: [`/api/rutas/${rutaId}/clientes`] });
  const { data: results = [] } = useQuery<Cliente[]>({
    queryKey: ["/api/clients/search", search],
    queryFn: async () => {
      if (search.trim().length < 3) return [];
      const r = await apiRequest(`/api/clients/search?q=${encodeURIComponent(search)}`);
      return r.json();
    },
    enabled: search.trim().length >= 3,
  });

  const addMutation = useMutation({
    mutationFn: async (c: Cliente) => apiRequest("POST", `/api/rutas/${rutaId}/clientes`, { clienteId: c.koen, clienteNombre: c.nokoen }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/rutas/${rutaId}/clientes`] });
      queryClient.invalidateQueries({ queryKey: ["/api/rutas"] });
      setSearch("");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message || "No se pudo agregar el cliente.", variant: "destructive" }),
  });

  const removeMutation = useMutation({
    mutationFn: async (koen: string) => apiRequest("DELETE", `/api/rutas/${rutaId}/clientes/${encodeURIComponent(koen)}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [`/api/rutas/${rutaId}/clientes`] }),
    onError: (e: any) => toast({ title: "Error", description: e.message || "No se pudo quitar el cliente.", variant: "destructive" }),
  });

  const yaEnRuta = (koen: string) => clientes.some((c) => c.clienteId === koen);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
          <Building2 className="h-3.5 w-3.5" /> Clientes en la ruta ({clientes.length})
        </h4>
      </div>

      {isLoading ? (
        <p className="text-xs text-slate-400">Cargando clientes...</p>
      ) : clientes.length === 0 ? (
        <p className="text-xs text-slate-400 italic">Sin clientes en esta ruta todavía.</p>
      ) : (
        <div className="space-y-1.5">
          {clientes.map((c) => (
            <div key={c.id} className="flex items-center gap-2.5 bg-white border border-slate-200 rounded-lg px-3 py-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                <Building2 className="h-3.5 w-3.5 text-emerald-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-800 truncate">{c.clienteNombre}</p>
                <p className="text-[11px] text-slate-400">Código: {c.clienteId}</p>
              </div>
              {c.visitado && <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">Visitado</Badge>}
              {canManage && (
                <button
                  onClick={() => removeMutation.mutate(c.clienteId)}
                  disabled={removeMutation.isPending}
                  className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all flex-shrink-0"
                  title="Quitar de la ruta"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {canManage && (
        <div className="pt-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar cliente por nombre o código..."
              className="pl-9 h-9 text-sm bg-white"
            />
          </div>
          {search.trim().length >= 3 && results.length > 0 && (
            <div className="mt-1.5 max-h-48 overflow-y-auto border rounded-lg bg-white shadow-sm divide-y divide-slate-100">
              {results.map((c) => {
                const added = yaEnRuta(c.koen);
                return (
                  <button
                    key={c.id}
                    disabled={added || addMutation.isPending}
                    onClick={() => addMutation.mutate(c)}
                    className="w-full px-3 py-2 text-left hover:bg-indigo-50/60 transition-colors flex items-center justify-between gap-2 disabled:opacity-50"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{c.nokoen}</p>
                      <p className="text-[11px] text-slate-400">Código: {c.koen}</p>
                    </div>
                    {added ? (
                      <span className="text-[10px] text-emerald-600 font-semibold flex-shrink-0">En ruta</span>
                    ) : (
                      <Plus className="h-4 w-4 text-indigo-600 flex-shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
          {search.trim().length >= 3 && results.length === 0 && (
            <p className="text-xs text-slate-400 italic mt-1.5">No se encontraron clientes.</p>
          )}
        </div>
      )}
    </div>
  );
}
