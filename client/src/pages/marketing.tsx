import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Plus, TrendingUp, DollarSign, FileText, Calendar, CheckCircle, XCircle, Clock, Loader2, Package, AlertTriangle, Edit, Trash2, X, Circle, CheckSquare, ChevronLeft, ChevronRight, ClipboardList, Play, Check, Target, Search, ExternalLink, BarChart3, Video, History, MinusCircle, ArrowUpRight, ArrowDownLeft, Receipt, LayoutGrid, List } from "lucide-react";
import AdsAnalyticsPage from "./ads-analytics";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from "date-fns";
import { es } from "date-fns/locale";
import { formatDateForAPI, parseDateFromAPI } from "@/lib/dateUtils";

import CreatividadesMarketing from "./marketing/creatividades-marketing";
import PresupuestoTabMarketing from "./marketing/presupuesto-tab-marketing";
import GastosTabMarketing from "./marketing/gastos-tab-marketing";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

// Zod schema para Tareas de Marketing
const createMarketingTaskSchema = z.object({
  title: z.string().min(1, "Título es requerido"),
  description: z.string().optional(),
  type: z.enum(["texto", "formulario", "visita"]).default("texto"),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  dueDate: z.string().optional().or(z.null()),
  clienteId: z.string().optional().or(z.null()),
  clienteNombre: z.string().optional().or(z.null()),
  assignments: z.array(z.object({
    assigneeType: z.enum(["supervisor", "salesperson"]),
    assigneeId: z.string().min(1, "Destinatario requerido"),
  })).min(1, "Debe asignar al menos un destinatario"),
});

type CreateMarketingTaskInput = z.infer<typeof createMarketingTaskSchema>;

interface MarketingMetrics {
  presupuestoTotal: number;
  presupuestoUtilizado: number;
  presupuestoComprometido: number;
  presupuestoDisponible: number;
  totalSolicitudes: number;
  solicitudesPorEstado: {
    solicitado: number;
    en_proceso: number;
    completado: number;
    rechazado: number;
  };
}

interface HitoMarketing {
  id: string;
  titulo: string;
  descripcion: string | null;
  fecha: string;
  tipo: 'general' | 'campaña' | 'evento' | 'deadline';
  color: string;
  completado: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

interface TareaMarketing {
  id: string;
  titulo: string;
  descripcion: string | null;
  estado: 'pendiente' | 'en_proceso' | 'completado';
  prioridad: 'baja' | 'media' | 'alta';
  fechaLimite: string | null;
  solicitudId: string | null;
  asignadoAId: string | null;
  asignadoANombre: string | null;
  creadoPorId: string;
  creadoPorNombre: string | null;
  completadoEn: string | null;
  mes: number;
  anio: number;
  createdAt: string;
  updatedAt: string;
}

export default function Marketing() {
  const { user } = useAuth();
  const { toast } = useToast();
  const currentDate = new Date();
  const [selectedMes, setSelectedMes] = useState(currentDate.getMonth() + 1);
  const [selectedAnio, setSelectedAnio] = useState(currentDate.getFullYear());
  const [selectedEstado, setSelectedEstado] = useState<string>("todos");
  const [presupuestoDialogOpen, setPresupuestoDialogOpen] = useState(false);
  const [solicitudDialogOpen, setSolicitudDialogOpen] = useState(false);

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" data-testid="loader-spinner" />
      </div>
    );
  }

  // Only admin, supervisor and salesperson can access marketing module
  if (user.role !== 'admin' && user.role !== 'supervisor' && user.role !== 'salesperson') {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Acceso Denegado</CardTitle>
            <CardDescription>No tienes permisos para acceder a este módulo.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const mesesNombres = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];

  const isAdmin = user.role === 'admin' || user.role === 'supervisor';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950/20">
      <div className="container mx-auto px-4 py-8 space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
              <TrendingUp className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white" data-testid="text-page-title">
                Marketing
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">Gestión de presupuesto, solicitudes e inventario de marketing</p>
            </div>
          </div>
        </div>

        {/* 4 Tabs */}
        <Tabs defaultValue="dashboard" className="w-full">
          <div>
            <TabsList className="flex w-full gap-1 h-auto p-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
              {isAdmin && (
                <TabsTrigger
                  value="dashboard"
                  data-testid="tab-dashboard"
                  className="flex flex-1 items-center justify-center gap-2 py-2 text-sm font-medium rounded-xl data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-all"
                >
                  <BarChart3 className="h-4 w-4 shrink-0" />
                  <span className="hidden sm:inline">Dashboard</span>
                </TabsTrigger>
              )}

              <TabsTrigger
                value="tareas"
                data-testid="tab-tareas-marketing"
                className="flex flex-1 items-center justify-center gap-2 py-2 text-sm font-medium rounded-xl data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-all"
              >
                <FileText className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">Tareas</span>
              </TabsTrigger>

              {isAdmin && (
                <TabsTrigger
                  value="calendario"
                  data-testid="tab-calendario"
                  className="flex flex-1 items-center justify-center gap-2 py-2 text-sm font-medium rounded-xl data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-all"
                >
                  <Calendar className="h-4 w-4 shrink-0" />
                  <span className="hidden sm:inline">Calendario</span>
                </TabsTrigger>
              )}

              <TabsTrigger
                value="inventario"
                data-testid="tab-inventario"
                className="flex flex-1 items-center justify-center gap-2 py-2 text-sm font-medium rounded-xl data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-all"
              >
                <Package className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">Inventario</span>
              </TabsTrigger>

              {isAdmin && (
                <TabsTrigger
                  value="presupuesto"
                  data-testid="tab-presupuesto"
                  className="flex flex-1 items-center justify-center gap-2 py-2 text-sm font-medium rounded-xl data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-all"
                >
                  <DollarSign className="h-4 w-4 shrink-0" />
                  <span className="hidden sm:inline">Presupuesto</span>
                </TabsTrigger>
              )}

              {isAdmin && (
                <TabsTrigger
                  value="gastos"
                  data-testid="tab-gastos"
                  className="flex flex-1 items-center justify-center gap-2 py-2 text-sm font-medium rounded-xl data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-all"
                >
                  <Receipt className="h-4 w-4 shrink-0" />
                  <span className="hidden sm:inline">Gastos</span>
                </TabsTrigger>
              )}
            </TabsList>
          </div>

          {/* Tab: Dashboard (Métricas + Presupuesto) */}
          {isAdmin && (
            <TabsContent value="dashboard" className="space-y-6">
              {/* Period selector */}
              <div className="flex flex-wrap items-end gap-4">
                <div className="flex-1 min-w-[140px]">
                  <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Mes</Label>
                  <Select value={selectedMes.toString()} onValueChange={(v) => setSelectedMes(parseInt(v))}>
                    <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {mesesNombres.map((mes, i) => (
                        <SelectItem key={i + 1} value={(i + 1).toString()}>{mes}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1 min-w-[100px]">
                  <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Año</Label>
                  <Select value={selectedAnio.toString()} onValueChange={(v) => setSelectedAnio(parseInt(v))}>
                    <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[2024, 2025, 2026].map((a) => (
                        <SelectItem key={a} value={a.toString()}>{a}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {user.role === 'admin' && (
                  <Button
                    onClick={() => setPresupuestoDialogOpen(true)}
                    className="rounded-xl bg-indigo-600 hover:bg-indigo-700"
                    data-testid="button-config-presupuesto"
                  >
                    <DollarSign className="mr-2 h-4 w-4" />
                    Configurar Presupuesto
                  </Button>
                )}
              </div>

              <MetricsDashboard mes={selectedMes} anio={selectedAnio} />

              {/* Creatividades section in dashboard */}
              <CreatividadesMarketing
                mes={selectedMes}
                anio={selectedAnio}
                userRole={user.role}
              />
            </TabsContent>
          )}

          {/* Tab: Solicitudes */}
          <TabsContent value="tareas" className="space-y-6">
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex-1 min-w-[140px]">
                <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Mes</Label>
                <Select value={selectedMes.toString()} onValueChange={(v) => setSelectedMes(parseInt(v))}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {mesesNombres.map((mes, i) => (
                      <SelectItem key={i + 1} value={(i + 1).toString()}>{mes}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 min-w-[100px]">
                <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Año</Label>
                <Select value={selectedAnio.toString()} onValueChange={(v) => setSelectedAnio(parseInt(v))}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[2024, 2025, 2026].map((a) => (
                      <SelectItem key={a} value={a.toString()}>{a}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={() => setSolicitudDialogOpen(true)}
                data-testid="button-nueva-solicitud"
                className="rounded-xl bg-indigo-600 hover:bg-indigo-700"
              >
                <Plus className="mr-2 h-4 w-4" />
                Nueva Tarea
              </Button>
            </div>

            <MarketingTasksList mes={selectedMes} anio={selectedAnio} userRole={user.role} />
          </TabsContent>

          {/* Tab: Calendario (Hitos + Tareas + Creatividades) */}
          {isAdmin && (
            <TabsContent value="calendario" className="space-y-6">
              <CalendarioHitos
                mes={selectedMes}
                anio={selectedAnio}
                userRole={user.role}
                onMesChange={setSelectedMes}
                onAnioChange={setSelectedAnio}
              />
            </TabsContent>
          )}

          {/* Tab: Inventario */}
          <TabsContent value="inventario" className="space-y-6">
            <InventarioMarketing userRole={user.role} />
          </TabsContent>

          {/* Tab: Presupuesto (tabla Excel) */}
          {isAdmin && (
            <TabsContent value="presupuesto" className="space-y-6">
              <PresupuestoTabMarketing userRole={user.role} />
            </TabsContent>
          )}

          {/* Tab: Gastos */}
          {isAdmin && (
            <TabsContent value="gastos" className="space-y-6">
              <GastosTabMarketing userRole={user.role} />
            </TabsContent>
          )}
        </Tabs>

        {/* Dialogs */}
        <PresupuestoDialog
          open={presupuestoDialogOpen}
          onOpenChange={setPresupuestoDialogOpen}
          mes={selectedMes}
          anio={selectedAnio}
        />

        <MarketingTaskDialog open={solicitudDialogOpen} onOpenChange={setSolicitudDialogOpen} />
      </div>
    </div>
  );
}

// Metrics Dashboard Component
function MetricsDashboard({ mes, anio }: { mes: number; anio: number }) {
  const [gastosModalOpen, setGastosModalOpen] = useState(false);

  const { data: metrics, isLoading } = useQuery<MarketingMetrics>({
    queryKey: ['/api/marketing/metrics', mes, anio],
    queryFn: async () => {
      const response = await fetch(`/api/marketing/metrics/${mes}/${anio}`, {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Error al cargar métricas');
      }
      return response.json();
    },
  });

  const { data: gastos = [] } = useQuery<any[]>({
    queryKey: ['/api/marketing/gastos', mes, anio],
    queryFn: async () => {
      const res = await fetch(`/api/marketing/gastos?mes=${mes}&anio=${anio}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Error al cargar gastos');
      return res.json();
    },
    enabled: gastosModalOpen,
  });

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-3">
        {[
          'bg-gradient-to-br from-indigo-500 to-purple-600',
          'bg-gradient-to-br from-emerald-500 to-teal-600',
          'bg-gradient-to-br from-amber-500 to-orange-600',
        ].map((gradient, i) => (
          <Card key={i} className={`border-0 shadow-md ${gradient} text-white`}>
            <CardContent className="pt-6 flex items-center gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-white/70" />
              <p className="text-sm text-white/70">Cargando...</p>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const presupuestoUtilizadoPct = metrics
    ? (metrics.presupuestoUtilizado / metrics.presupuestoTotal) * 100
    : 0;

  return (
    <>
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-0 shadow-md bg-gradient-to-br from-indigo-500 to-purple-600 text-white" data-testid="card-presupuesto-total">
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-indigo-100">Presupuesto Total</p>
            <p className="text-2xl font-bold mt-1">
              ${metrics && metrics.presupuestoTotal != null ? metrics.presupuestoTotal.toLocaleString('es-CL') : '0'}
            </p>
            <p className="text-xs text-indigo-200 mt-1">
              Presupuesto mensual asignado
            </p>
          </CardContent>
        </Card>

        <Card
          className="border-0 shadow-md bg-gradient-to-br from-emerald-500 to-teal-600 text-white cursor-pointer hover:brightness-110 transition-all active:scale-[0.98]"
          data-testid="card-presupuesto-utilizado"
          onClick={() => setGastosModalOpen(true)}
        >
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-emerald-100">Presupuesto Utilizado</p>
            <p className="text-2xl font-bold mt-1">
              ${metrics && metrics.presupuestoUtilizado != null ? metrics.presupuestoUtilizado.toLocaleString('es-CL') : '0'}
            </p>
            <div className="mt-2">
              <div className="w-full bg-white/20 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${presupuestoUtilizadoPct > 90 ? 'bg-red-300' :
                    presupuestoUtilizadoPct > 70 ? 'bg-yellow-300' :
                      'bg-white/80'
                    }`}
                  style={{ width: `${Math.min(presupuestoUtilizadoPct, 100)}%` }}
                />
              </div>
              <p className="text-xs text-emerald-200 mt-1">
                {isNaN(presupuestoUtilizadoPct) ? '0.0' : presupuestoUtilizadoPct.toFixed(1)}% utilizado &middot; <span className="underline underline-offset-2">Ver detalle</span>
              </p>
            </div>
            {metrics && metrics.presupuestoComprometido > 0 && (
              <div className="mt-3 pt-2 border-t border-white/20">
                <p className="text-xs text-emerald-100">
                  Comprometido (cotización/OC): <span className="font-semibold">${metrics.presupuestoComprometido.toLocaleString('es-CL')}</span>
                </p>
                <p className="text-xs text-emerald-200 mt-0.5">
                  Total con comprometido: <span className="font-semibold">${(metrics.presupuestoUtilizado + metrics.presupuestoComprometido).toLocaleString('es-CL')}</span>
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-gradient-to-br from-amber-500 to-orange-600 text-white" data-testid="card-presupuesto-disponible">
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-amber-100">Presupuesto Disponible</p>
            <p className="text-2xl font-bold mt-1">
              ${metrics && metrics.presupuestoDisponible != null ? metrics.presupuestoDisponible.toLocaleString('es-CL') : '0'}
            </p>
            <p className="text-xs text-amber-200 mt-1">
              {metrics?.totalSolicitudes || 0} solicitudes totales
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Gastos Detail Modal */}
      <Dialog open={gastosModalOpen} onOpenChange={setGastosModalOpen}>
        <DialogContent className="sm:max-w-[750px] max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-emerald-600" />
              Gastos — {['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'][mes - 1]} {anio}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-auto">
            {gastos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                <Receipt className="h-12 w-12 mb-3 opacity-30" />
                <p className="font-medium">Sin gastos registrados para este mes</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b-2 border-slate-200">
                    <th className="px-3 py-2 text-left font-bold text-slate-600">Concepto</th>
                    <th className="px-3 py-2 text-left font-bold text-slate-600">Categoría</th>
                    <th className="px-3 py-2 text-left font-bold text-slate-600">Proveedor</th>
                    <th className="px-3 py-2 text-center font-bold text-slate-600">N° Factura</th>
                    <th className="px-3 py-2 text-center font-bold text-slate-600">Estado</th>
                    <th className="px-3 py-2 text-right font-bold text-slate-600">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {gastos.map((g: any, idx: number) => (
                    <tr key={g.id} className={`border-b border-slate-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                      <td className="px-3 py-2">
                        <div className="font-medium text-slate-800">{g.concepto}</div>
                        {g.descripcion && <div className="text-xs text-slate-400 line-clamp-1">{g.descripcion}</div>}
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-600">{g.categoria || '—'}</td>
                      <td className="px-3 py-2 text-xs text-slate-600">{g.proveedor || '—'}</td>
                      <td className="px-3 py-2 text-center text-xs text-slate-500">{g.numeroFactura || '—'}</td>
                      <td className="px-3 py-2 text-center">
                        <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full font-medium border ${g.estado === 'facturado' ? 'bg-emerald-50 text-emerald-700 border-emerald-300' :
                          g.estado === 'con_oc' ? 'bg-blue-50 text-blue-700 border-blue-300' :
                            'bg-yellow-50 text-yellow-700 border-yellow-300'
                          }`}>
                          {g.estado === 'facturado' ? 'Facturado' : g.estado === 'con_oc' ? 'Con OC' : 'Pendiente'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-semibold text-slate-800">
                        ${parseFloat(g.monto || '0').toLocaleString('es-CL', { maximumFractionDigits: 0 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-800 text-white">
                    <td className="px-3 py-2 font-bold" colSpan={5}>Total</td>
                    <td className="px-3 py-2 text-right font-bold tabular-nums">
                      ${gastos.reduce((sum: number, g: any) => sum + parseFloat(g.monto || '0'), 0).toLocaleString('es-CL', { maximumFractionDigits: 0 })}
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setGastosModalOpen(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Pasos Checklist Component
function PasosChecklist({
  solicitudId,
  pasos,
  userRole,
}: {
  solicitudId: string;
  pasos: { nombre: string; completado: boolean; orden: number }[];
  userRole: string;
}) {
  const { toast } = useToast();

  const togglePasoMutation = useMutation({
    mutationFn: async ({ index }: { index: number }) => {
      return await apiRequest('PATCH', `/api/marketing/solicitudes/${solicitudId}/pasos/${index}/toggle`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/marketing/solicitudes'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo actualizar el paso",
        variant: "destructive",
      });
    },
  });

  const handleToggle = (index: number) => {
    if (userRole === 'admin' || userRole === 'supervisor') {
      togglePasoMutation.mutate({ index });
    }
  };

  if (!pasos || pasos.length === 0) {
    return <span className="text-muted-foreground italic text-sm">Sin pasos</span>;
  }

  return (
    <div className="space-y-1">
      {pasos.map((paso, index) => (
        <div key={index} className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={paso.completado}
            onChange={() => handleToggle(index)}
            disabled={userRole !== 'admin' && userRole !== 'supervisor'}
            className="h-4 w-4 cursor-pointer disabled:cursor-not-allowed"
            data-testid={`checkbox-paso-${index}`}
          />
          <span className={`text-sm ${paso.completado ? 'line-through text-muted-foreground' : ''}`}>
            {paso.nombre}
          </span>
        </div>
      ))}
    </div>
  );
}

// Marketing Tasks List Component
function MarketingTasksList({ mes, anio, userRole }: { mes: number; anio: number; userRole: string; }) {
  const { data: tasks, isLoading } = useQuery<any[]>({
    queryKey: ['/api/tasks/marketing', mes, anio],
    queryFn: async () => {
      const response = await fetch('/api/tasks');
      if (!response.ok) {
        throw new Error('Error al cargar tareas');
      }
      const allTasks = await response.json();
      return allTasks.filter((t: any) => t.segmento === 'marketing');
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tareas de Marketing</CardTitle>
      </CardHeader>
      <CardContent>
        {tasks && tasks.length > 0 ? (
          <div className="space-y-4">
            {tasks.map((task: any) => (
              <Card key={task.id} className="p-4 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-lg">{task.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{task.description}</p>
                  </div>
                  <Badge>{task.status}</Badge>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            No hay tareas de marketing registradas en este mes.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Presupuesto Dialog Component
function PresupuestoDialog({
  open,
  onOpenChange,
  mes,
  anio,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mes: number;
  anio: number;
}) {
  const { toast } = useToast();
  const currentDate = new Date();
  const [presupuestoTotal, setPresupuestoTotal] = useState("");
  const [selectedMes, setSelectedMes] = useState(currentDate.getMonth() + 1);
  const [selectedAnio, setSelectedAnio] = useState(currentDate.getFullYear());

  const mesesNombres = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];

  const { data: presupuestoActual } = useQuery({
    queryKey: ['/api/marketing/presupuesto', selectedMes, selectedAnio],
    queryFn: async () => {
      const response = await fetch(`/api/marketing/presupuesto/${selectedMes}/${selectedAnio}`, {
        credentials: 'include'
      });
      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error('Error al cargar presupuesto');
      }
      return response.json();
    },
    enabled: open,
  });

  const saveMutation = useMutation({
    mutationFn: async (data: { mes: number; anio: number; presupuestoTotal: number }) => {
      return await apiRequest('POST', '/api/marketing/presupuesto', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/marketing/presupuesto'] });
      queryClient.invalidateQueries({ queryKey: ['/api/marketing/metrics'] });
      toast({
        title: "Presupuesto guardado",
        description: "El presupuesto ha sido configurado correctamente",
      });
      onOpenChange(false);
      setPresupuestoTotal("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo guardar el presupuesto",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    const monto = parseFloat(presupuestoTotal);
    if (isNaN(monto) || monto <= 0) {
      toast({
        title: "Error",
        description: "Ingrese un monto válido",
        variant: "destructive",
      });
      return;
    }

    saveMutation.mutate({
      mes: selectedMes,
      anio: selectedAnio,
      presupuestoTotal: monto,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="dialog-presupuesto" className="w-[95vw] sm:w-full">
        <DialogHeader>
          <DialogTitle>Configurar Presupuesto Mensual</DialogTitle>
          <DialogDescription>
            Seleccione el período y configure el presupuesto total
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="mes-presupuesto">Mes</Label>
              <Select
                value={selectedMes.toString()}
                onValueChange={(value) => setSelectedMes(parseInt(value))}
              >
                <SelectTrigger id="mes-presupuesto" data-testid="select-mes-presupuesto">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {mesesNombres.map((mes, index) => (
                    <SelectItem key={index + 1} value={(index + 1).toString()}>
                      {mes}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="anio-presupuesto">Año</Label>
              <Select
                value={selectedAnio.toString()}
                onValueChange={(value) => setSelectedAnio(parseInt(value))}
              >
                <SelectTrigger id="anio-presupuesto" data-testid="select-anio-presupuesto">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[2024, 2025, 2026].map((anio) => (
                    <SelectItem key={anio} value={anio.toString()}>
                      {anio}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {presupuestoActual && (
            <div className="p-4 bg-muted rounded-md">
              <p className="text-sm text-muted-foreground">Presupuesto actual para {mesesNombres[selectedMes - 1]} {selectedAnio}:</p>
              <p className="text-2xl font-bold">
                ${parseFloat(presupuestoActual.presupuestoTotal).toLocaleString('es-CL')}
              </p>
            </div>
          )}
          <div>
            <Label htmlFor="presupuestoTotal">Presupuesto Total (CLP)</Label>
            <Input
              id="presupuestoTotal"
              type="number"
              placeholder="Ej: 5000000"
              value={presupuestoTotal}
              onChange={(e) => setPresupuestoTotal(e.target.value)}
              data-testid="input-presupuesto-total"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="button-cancelar-presupuesto"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={saveMutation.isPending}
            data-testid="button-guardar-presupuesto"
          >
            {saveMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Guardando...
              </>
            ) : (
              'Guardar'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


// Marketing Task Dialog
function MarketingTaskDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void; }) {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const { data: users = [] } = useQuery<any[]>({
    queryKey: ['/api/users'],
    queryFn: async () => {
      const res = await fetch('/api/users');
      return res.json();
    }
  });

  const form = useForm<CreateMarketingTaskInput>({
    resolver: zodResolver(createMarketingTaskSchema),
    defaultValues: {
      title: "",
      description: "",
      type: "texto",
      priority: "medium",
      dueDate: null,
      clienteId: null,
      clienteNombre: null,
      assignments: [],
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateMarketingTaskInput & { segmento: string }) => {
      const res = await apiRequest("POST", "/api/tasks", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tasks/marketing'] });
      toast({ title: "Tarea de marketing creada" });
      onOpenChange(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const onSubmit = (data: CreateMarketingTaskInput) => {
    createMutation.mutate({ ...data, segmento: "marketing" });
  };

  const handleUserToggle = (userId: string, role: string) => {
    const currentAssignments = form.getValues('assignments') || [];
    const existingIndex = currentAssignments.findIndex((a) => a.assigneeId === userId);
    if (existingIndex >= 0) {
      form.setValue(
        'assignments',
        currentAssignments.filter((a) => a.assigneeId !== userId),
        { shouldValidate: true }
      );
    } else {
      form.setValue(
        'assignments',
        [...currentAssignments, { assigneeType: role === 'supervisor' || role === 'admin' ? 'supervisor' : 'salesperson', assigneeId: userId }],
        { shouldValidate: true }
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[650px] p-0 overflow-hidden bg-slate-50/50">
        <DialogHeader className="p-6 pb-4 bg-slate-900 border-b relative overflow-hidden">
          <div className="absolute inset-0 bg-grid-white/[0.02] bg-[length:16px_16px]" />
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 blur-[50px] rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
          
          <div className="relative flex items-start gap-4">
            <div className="p-2.5 bg-blue-500/20 rounded-xl border border-blue-500/20 shadow-inner">
              <CheckSquare className="h-6 w-6 text-blue-400" />
            </div>
            <div>
              <DialogTitle className="text-xl text-white font-semibold">Nueva Tarea de Marketing</DialogTitle>
              <DialogDescription className="text-slate-400 mt-1">
                Completa los detalles de la tarea (Segmento: Marketing por defecto)
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="p-4 sm:p-6 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
            
            {/* Sección 1: Info Básica */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                Información de la tarea
              </div>
              <div className="bg-slate-50/80 rounded-xl border border-slate-100 p-4 space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold text-slate-500 uppercase tracking-wider">TÍTULO *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Ej: Revisar campaña de redes sociales..."
                          className="bg-white border-slate-200"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold text-slate-500 uppercase tracking-wider">DESCRIPCIÓN</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Agrega detalles, instrucciones o contexto..."
                          className="min-h-[100px] resize-none bg-white border-slate-200"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Sección 2: Plazos (2 columnas porque quitamos segmento y prioridad visualmente) */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                Fecha Límite
              </div>
              <div className="bg-slate-50/80 rounded-xl border border-slate-100 p-4">
                <FormField
                  control={form.control}
                  name="dueDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold text-slate-500 uppercase tracking-wider">FECHA LÍMITE</FormLabel>
                      <FormControl>
                        <Input
                          type="datetime-local"
                          className="bg-white border-slate-200"
                          {...field}
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Sección 3: Asignaciones */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <div className="w-1.5 h-1.5 rounded-full bg-violet-500" />
                Equipo Asignado *
              </div>
              <div className="bg-slate-50/80 rounded-xl border border-slate-100 p-4">
                <FormField
                  control={form.control}
                  name="assignments"
                  render={() => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        SELECCIONAR DESTINATARIOS
                      </FormLabel>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                        {users.filter(u => u.active).map((u) => {
                          const isSelected = form.watch('assignments')?.some((a) => a.assigneeId === u.id);
                          return (
                            <div
                              key={u.id}
                              onClick={() => handleUserToggle(u.id, u.role)}
                              className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all ${isSelected ? 'bg-indigo-50 border-indigo-200 shadow-sm' : 'bg-white border-slate-200 hover:border-indigo-100 hover:bg-slate-50'}`}
                            >
                              <div className={`flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center ${isSelected ? 'bg-indigo-500 border-indigo-500' : 'border-slate-300'}`}>
                                {isSelected && <Check className="h-3 w-3 text-white" />}
                              </div>
                              <div className="min-w-0">
                                <p className={`text-sm font-medium truncate ${isSelected ? 'text-indigo-900' : 'text-slate-700'}`}>
                                  {u.nombre || u.username}
                                </p>
                                <p className="text-[10px] text-slate-500 uppercase tracking-wider">{u.role}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <DialogFooter className="sticky bottom-0 bg-white pt-4 mt-6 border-t border-slate-100 flex items-center justify-end gap-3 sm:justify-end">
              <Button type="button" variant="outline" className="rounded-xl font-medium" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createMutation.isPending} className="rounded-xl font-medium bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md shadow-blue-500/20">
                {createMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creando...</>
                ) : (
                  <><Plus className="h-4 w-4 mr-2" /> Crear Tarea</>
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// Inventario Marketing Component
function InventarioMarketing({ userRole }: { userRole: string }) {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [inventarioDialogOpen, setInventarioDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [retiroDialogOpen, setRetiroDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [movimientoItem, setMovimientoItem] = useState<any>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const { data: items = [], isLoading } = useQuery<any[]>({
    queryKey: ['/api/marketing/inventario', search],
    enabled: true,
  });

  const { data: summary } = useQuery<{
    totalItems: number;
    stockBajo: number;
    valorTotal: number;
  }>({
    queryKey: ['/api/marketing/inventario/summary'],
    enabled: true,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/marketing/inventario/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/marketing/inventario'] });
      queryClient.invalidateQueries({ queryKey: ['/api/marketing/inventario/summary'] });
      toast({ title: "Item eliminado" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleEdit = (item: any) => { setSelectedItem(item); setInventarioDialogOpen(true); };
  const handleRetiro = (item: any) => { setMovimientoItem(item); setRetiroDialogOpen(true); };
  const handleHistory = (item: any) => { setMovimientoItem(item); setHistoryDialogOpen(true); };
  const handleDelete = (id: string) => { if (confirm("¿Eliminar este item?")) deleteMutation.mutate(id); };

  const estadoConfig: Record<string, { label: string; color: string; dot: string }> = {
    disponible: { label: "Disponible", color: "bg-emerald-50 text-emerald-600 border-emerald-200", dot: "bg-emerald-500" },
    agotado: { label: "Agotado", color: "bg-red-50 text-red-600 border-red-200", dot: "bg-red-500" },
    por_llegar: { label: "Por Llegar", color: "bg-amber-50 text-amber-600 border-amber-200", dot: "bg-amber-500" },
  };

  const filteredItems = items.filter(item =>
    item.nombre?.toLowerCase().includes(search.toLowerCase()) ||
    item.descripcion?.toLowerCase().includes(search.toLowerCase()) ||
    item.ubicacion?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* KPI Summary */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-600 p-5 text-white shadow-lg">
            <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-white/10" />
            <div className="relative">
              <div className="flex items-center gap-2 text-indigo-100 text-xs font-semibold uppercase tracking-wider">
                <Package className="h-3.5 w-3.5" /> Total Items
              </div>
              <p className="text-3xl font-bold mt-1">{summary.totalItems}</p>
              <p className="text-xs text-indigo-200 mt-1">Productos en inventario</p>
            </div>
          </div>
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 p-5 text-white shadow-lg">
            <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-white/10" />
            <div className="relative">
              <div className="flex items-center gap-2 text-amber-100 text-xs font-semibold uppercase tracking-wider">
                <AlertTriangle className="h-3.5 w-3.5" /> Stock Bajo
              </div>
              <p className="text-3xl font-bold mt-1">{summary.stockBajo}</p>
              <p className="text-xs text-amber-200 mt-1">Requieren reposición</p>
            </div>
          </div>
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 p-5 text-white shadow-lg">
            <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-white/10" />
            <div className="relative">
              <div className="flex items-center gap-2 text-emerald-100 text-xs font-semibold uppercase tracking-wider">
                <DollarSign className="h-3.5 w-3.5" /> Valorización
              </div>
              <p className="text-3xl font-bold mt-1">${summary.valorTotal.toLocaleString('es-CL')}</p>
              <p className="text-xs text-emerald-200 mt-1">Valor total del inventario</p>
            </div>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Buscar por nombre, descripción o ubicación..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 rounded-xl"
          />
        </div>
        <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5">
          <Button variant={viewMode === 'grid' ? 'default' : 'ghost'} size="sm" className="h-8 rounded-md" onClick={() => setViewMode('grid')}>
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button variant={viewMode === 'list' ? 'default' : 'ghost'} size="sm" className="h-8 rounded-md" onClick={() => setViewMode('list')}>
            <List className="h-4 w-4" />
          </Button>
        </div>
        {userRole === 'admin' && (
          <Button onClick={() => { setSelectedItem(null); setInventarioDialogOpen(true); }} className="ml-auto rounded-xl bg-indigo-600 hover:bg-indigo-700">
            <Plus className="mr-2 h-4 w-4" /> Nuevo Item
          </Button>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-indigo-500" /></div>
      ) : filteredItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <Package className="h-12 w-12 mb-4 opacity-30" />
          <p className="text-lg font-medium">Sin items en inventario</p>
          <p className="text-sm">Agrega materiales y suministros de marketing.</p>
        </div>
      ) : viewMode === 'grid' ? (
        /* ──── GRID VIEW ──── */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredItems.map((item: any) => {
            const isLowStock = item.cantidad <= (item.stockMinimo || 0);
            const stockPercent = item.stockMinimo ? Math.min(100, (item.cantidad / item.stockMinimo) * 100) : 100;
            const est = estadoConfig[item.estado as keyof typeof estadoConfig] || estadoConfig.disponible;

            return (
              <Card key={item.id} className={`group relative overflow-hidden border transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 ${isLowStock ? 'border-amber-200 bg-amber-50/30' : 'border-slate-200 bg-white dark:bg-slate-900'}`}>
                {/* Low stock ribbon */}
                {isLowStock && (
                  <div className="absolute top-0 right-0 bg-amber-500 text-white text-[9px] font-bold px-2.5 py-0.5 rounded-bl-lg">
                    STOCK BAJO
                  </div>
                )}

                <CardContent className="p-4">
                  {/* Name + Description */}
                  <div className="mb-3">
                    <h3 className="font-semibold text-sm text-slate-900 dark:text-white line-clamp-1 leading-snug">{item.nombre}</h3>
                    <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">{item.descripcion || '—'}</p>
                  </div>

                  {/* Stock bar */}
                  <div className="mb-3">
                    <div className="flex justify-between items-baseline mb-1">
                      <span className="text-2xl font-bold text-slate-900 dark:text-white">{item.cantidad}</span>
                      <span className="text-[11px] text-slate-400 font-medium">{item.unidad}</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${isLowStock ? 'bg-amber-500' : stockPercent > 60 ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                        style={{ width: `${Math.max(5, stockPercent)}%` }}
                      />
                    </div>
                    {item.stockMinimo > 0 && (
                      <p className="text-[10px] text-slate-400 mt-1">Mín: {item.stockMinimo}</p>
                    )}
                  </div>

                  {/* Meta row */}
                  <div className="flex items-center justify-between text-[11px] mb-3">
                    <div className="flex items-center gap-1 text-slate-500">
                      <Target className="h-3 w-3" />
                      <span className="truncate max-w-[100px]">{item.ubicacion || '—'}</span>
                    </div>
                    <span className="font-mono text-slate-600 font-medium">
                      {item.costoUnitario ? `$${parseFloat(item.costoUnitario).toLocaleString('es-CL')}` : '—'}
                    </span>
                  </div>

                  {/* Status + Actions */}
                  <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
                    <Badge variant="outline" className={`text-[10px] rounded-full px-2 py-0 ${est.color}`}>
                      <span className={`inline-block h-1.5 w-1.5 rounded-full mr-1 ${est.dot}`} />
                      {est.label}
                    </Badge>
                    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-blue-600" title="Historial" onClick={() => handleHistory(item)}>
                        <History className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-amber-600" title="Retirar" disabled={item.cantidad <= 0} onClick={() => handleRetiro(item)}>
                        <MinusCircle className="h-3.5 w-3.5" />
                      </Button>
                      {userRole === 'admin' && (
                        <>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-indigo-600" onClick={() => handleEdit(item)}>
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-red-600" onClick={() => handleDelete(item.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        /* ──── LIST VIEW ──── */
        <Card className="border-0 shadow-md overflow-hidden rounded-2xl">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 dark:bg-slate-800/50 border-b">
                  <TableHead className="py-3 pl-6 font-semibold text-slate-600">Producto</TableHead>
                  <TableHead className="py-3 font-semibold text-slate-600">Stock</TableHead>
                  <TableHead className="py-3 font-semibold text-slate-600">Ubicación</TableHead>
                  <TableHead className="py-3 font-semibold text-slate-600">Costo Unit.</TableHead>
                  <TableHead className="py-3 font-semibold text-slate-600">Estado</TableHead>
                  <TableHead className="py-3 pr-6 text-right font-semibold text-slate-600">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((item: any) => {
                  const isLowStock = item.cantidad <= (item.stockMinimo || 0);
                  const est = estadoConfig[item.estado as keyof typeof estadoConfig] || estadoConfig.disponible;
                  return (
                    <TableRow key={item.id} className="group border-slate-100 hover:bg-slate-50/80 transition-colors">
                      <TableCell className="py-3 pl-6">
                        <div>
                          <span className="font-semibold text-sm text-slate-900 dark:text-white">{item.nombre}</span>
                          <span className="text-xs text-slate-400 block line-clamp-1">{item.descripcion || '—'}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-3">
                        <div className="flex items-center gap-2">
                          <span className={`font-bold text-sm ${isLowStock ? 'text-amber-600' : 'text-slate-800'}`}>{item.cantidad}</span>
                          <span className="text-[11px] text-slate-400">{item.unidad}</span>
                          {isLowStock && (
                            <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[9px] px-1.5 py-0">BAJO</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="py-3 text-sm text-slate-600">
                        <div className="flex items-center gap-1.5"><Target className="h-3 w-3 text-slate-300" />{item.ubicacion || '—'}</div>
                      </TableCell>
                      <TableCell className="py-3 font-mono text-sm text-slate-600">
                        {item.costoUnitario ? `$${parseFloat(item.costoUnitario).toLocaleString('es-CL')}` : '—'}
                      </TableCell>
                      <TableCell className="py-3">
                        <Badge variant="outline" className={`text-[10px] rounded-full px-2 ${est.color}`}>
                          <span className={`inline-block h-1.5 w-1.5 rounded-full mr-1 ${est.dot}`} />{est.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-3 pr-6 text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-blue-600" onClick={() => handleHistory(item)}><History className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-amber-600" disabled={item.cantidad <= 0} onClick={() => handleRetiro(item)}><MinusCircle className="h-3.5 w-3.5" /></Button>
                          {userRole === 'admin' && (
                            <>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-indigo-600" onClick={() => handleEdit(item)}><Edit className="h-3.5 w-3.5" /></Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-red-600" onClick={() => handleDelete(item.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Dialogs */}
      <InventarioDialog open={inventarioDialogOpen} onOpenChange={setInventarioDialogOpen} item={selectedItem} />
      <RetiroDialog open={retiroDialogOpen} onOpenChange={setRetiroDialogOpen} item={movimientoItem} />
      <HistorialMovimientosDialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen} item={movimientoItem} />
    </div>
  );
}

// Retiro Dialog Component
function RetiroDialog({
  open,
  onOpenChange,
  item,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: any | null;
}) {
  const { toast } = useToast();
  const [cantidad, setCantidad] = useState("");
  const [nota, setNota] = useState("");

  const retiroMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", `/api/marketing/inventario/${item.id}/movimientos`, {
        ...data,
        tipo: 'salida'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/marketing/inventario'] });
      queryClient.invalidateQueries({ queryKey: ['/api/marketing/inventario/summary'] });
      toast({
        title: "Retiro registrado",
        description: `Se han retirado ${cantidad} ${item.unidad} de ${item.nombre}`,
      });
      onOpenChange(false);
      setCantidad("");
      setNota("");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Error al registrar el retiro",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseInt(cantidad);
    if (!qty || qty <= 0) {
      toast({ title: "Error", description: "La cantidad debe ser mayor a 0", variant: "destructive" });
      return;
    }
    if (qty > item.cantidad) {
      toast({ title: "Error", description: "No hay suficiente stock para este retiro", variant: "destructive" });
      return;
    }
    retiroMutation.mutate({ cantidad: qty, nota });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px] rounded-3xl p-0 overflow-hidden border-none shadow-2xl">
        <div className="bg-slate-950 p-6 text-white pb-10">
          <div className="h-12 w-12 rounded-2xl bg-amber-500/20 flex items-center justify-center mb-4">
            <MinusCircle className="h-6 w-6 text-amber-500" />
          </div>
          <DialogTitle className="text-2xl font-bold">Registrar Retiro</DialogTitle>
          <DialogDescription className="text-slate-400 mt-1">
            Indica la cantidad a retirar de <strong>{item?.nombre}</strong>.
          </DialogDescription>
        </div>

        <form onSubmit={handleSubmit} className="p-6 -mt-6 bg-white dark:bg-slate-900 rounded-t-3xl shadow-2xl">
          <div className="flex bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl mb-6 items-center justify-between border border-slate-100 dark:border-slate-700">
            <div className="flex flex-col">
              <span className="text-xs font-bold text-slate-500 uppercase">Stock Actual</span>
              <span className="text-xl font-black text-slate-950 dark:text-white">{item?.cantidad} {item?.unidad}</span>
            </div>
            <Package className="h-8 w-8 text-slate-200" />
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">Cantidad a retirar</Label>
              <Input
                type="number"
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
                placeholder="0"
                className="py-6 rounded-2xl border-slate-100 dark:border-slate-800 focus-visible:ring-amber-500"
                required
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">Nota / Destino (Opcional)</Label>
              <Textarea
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                placeholder="Ej: Evento sucursal, Marketing externo..."
                className="rounded-2xl border-slate-100 dark:border-slate-800 focus-visible:ring-amber-500 resize-none h-24"
              />
            </div>
          </div>

          <div className="flex gap-3 mt-8">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="flex-1 py-6 rounded-2xl font-bold text-slate-500">
              Cancelar
            </Button>
            <Button type="submit" disabled={retiroMutation.isPending} className="flex-1 py-6 rounded-2xl font-bold bg-slate-950 hover:bg-slate-800 text-white shadow-xl">
              {retiroMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : "Confirmar Retiro"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Historial de Movimientos Dialog Component
function HistorialMovimientosDialog({
  open,
  onOpenChange,
  item,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: any | null;
}) {
  const { data: movimientos = [], isLoading } = useQuery<any[]>({
    queryKey: [`/api/marketing/inventario/${item?.id}/movimientos`],
    enabled: !!item && open,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[620px] p-0 rounded-3xl overflow-hidden border-none shadow-2xl max-h-[85vh] flex flex-col">
        <div className="bg-slate-950 p-6 text-white shrink-0">
          <div className="flex items-center gap-4 mb-2">
            <div className="h-10 w-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
              <History className="h-5 w-5 text-blue-500" />
            </div>
            <DialogTitle className="text-xl font-bold">Historial de Movimientos</DialogTitle>
          </div>
          <DialogDescription className="text-slate-400">
            Registro total de entradas y retiros para <strong>{item?.nombre}</strong>
          </DialogDescription>
        </div>

        <div className="flex-1 overflow-y-auto p-4 bg-white dark:bg-slate-900 overscroll-contain">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Cargando registros...</p>
            </div>
          ) : movimientos.length === 0 ? (
            <div className="text-center py-20 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border-2 border-dashed border-slate-100 dark:border-slate-800">
              <ClipboardList className="h-12 w-12 text-slate-200 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-widest">Sin movimientos</h3>
              <p className="text-xs text-slate-400 mt-1">Este item aún no registra entradas ni salidas</p>
            </div>
          ) : (
            <div className="space-y-3">
              {movimientos.map((mov: any) => (
                <div key={mov.id} className="group p-4 bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700 hover:border-blue-500/30 transition-all hover:shadow-md">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2">
                      <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${mov.tipo === 'entrada' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'}`}>
                        {mov.tipo === 'entrada' ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownLeft className="h-4 w-4" />}
                      </div>
                      <div>
                        <div className="text-xs font-black uppercase tracking-tighter text-slate-400 italic">
                          {format(new Date(mov.createdAt), "dd MMM, HH:mm", { locale: es })}
                        </div>
                        <div className="text-sm font-bold text-slate-900 dark:text-white">
                          {mov.tipo === 'entrada' ? 'Ingreso stock' : 'Retiro material'}
                        </div>
                      </div>
                    </div>
                    <div className={`text-xl font-black ${mov.tipo === 'entrada' ? 'text-emerald-500' : 'text-amber-500'}`}>
                      {mov.tipo === 'entrada' ? '+' : '-'}{mov.cantidad}
                      <span className="text-[10px] ml-0.5 opacity-50 font-medium">u</span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-50 dark:border-slate-800 flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-xs">
                      <div className="h-5 w-5 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center font-bold text-[10px] text-slate-500">
                        {mov.usuarioNombre?.charAt(0)}
                      </div>
                      <span className="text-slate-500">Registrado por: <strong>{mov.usuarioNombre}</strong></span>
                    </div>
                    {mov.nota && (
                      <div className="text-xs text-slate-400 bg-slate-50 dark:bg-slate-800 p-2 rounded-lg italic">
                        "{mov.nota}"
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 bg-slate-50 dark:bg-slate-800 shrink-0 border-t border-slate-100 dark:border-slate-700">
          <Button onClick={() => onOpenChange(false)} className="w-full py-6 rounded-2xl font-bold bg-slate-200 text-slate-600 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-300 border-none transition-all">
            Cerrar Historial
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Inventario Dialog Component
function InventarioDialog({
  open,
  onOpenChange,
  item,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: any | null;
}) {
  const { toast } = useToast();
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [unidad, setUnidad] = useState("unidades");
  const [ubicacion, setUbicacion] = useState("");
  const [costoUnitario, setCostoUnitario] = useState("");
  const [proveedor, setProveedor] = useState("");
  const [estado, setEstado] = useState("disponible");
  const [stockMinimo, setStockMinimo] = useState("");

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      if (item) {
        return await apiRequest("PATCH", `/api/marketing/inventario/${item.id}`, data);
      } else {
        return await apiRequest("POST", "/api/marketing/inventario", data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/marketing/inventario'] });
      queryClient.invalidateQueries({ queryKey: ['/api/marketing/inventario/summary'] });
      toast({
        title: item ? "Item actualizado" : "Item creado",
        description: item
          ? "El item ha sido actualizado correctamente"
          : "El item ha sido creado correctamente",
      });
      onOpenChange(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Error al guardar el item",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setNombre("");
    setDescripcion("");
    setCantidad("");
    setUnidad("unidades");
    setUbicacion("");
    setCostoUnitario("");
    setProveedor("");
    setEstado("disponible");
    setStockMinimo("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre || !cantidad) {
      toast({
        title: "Error",
        description: "Nombre y cantidad son requeridos",
        variant: "destructive",
      });
      return;
    }

    const data = {
      nombre,
      descripcion: descripcion || null,
      cantidad: parseInt(cantidad),
      unidad,
      ubicacion: ubicacion || null,
      costoUnitario: costoUnitario ? parseFloat(costoUnitario) : null,
      proveedor: proveedor || null,
      estado,
      stockMinimo: stockMinimo ? parseInt(stockMinimo) : 0,
    };

    saveMutation.mutate(data);
  };

  useEffect(() => {
    if (item && open) {
      setNombre(item.nombre || "");
      setDescripcion(item.descripcion || "");
      setCantidad(item.cantidad?.toString() || "");
      setUnidad(item.unidad || "unidades");
      setUbicacion(item.ubicacion || "");
      setCostoUnitario(item.costoUnitario?.toString() || "");
      setProveedor(item.proveedor || "");
      setEstado(item.estado || "disponible");
      setStockMinimo(item.stockMinimo?.toString() || "");
    } else if (!open) {
      resetForm();
    }
  }, [item, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[650px] rounded-3xl p-0 overflow-hidden border-none shadow-2xl max-h-[95vh] flex flex-col">
        <div className="bg-slate-950 p-6 text-white shrink-0">
          <div className="flex items-center gap-4 mb-2">
            <div className="h-12 w-12 rounded-2xl bg-blue-500/20 flex items-center justify-center">
              {item ? <Edit className="h-6 w-6 text-blue-500" /> : <Plus className="h-6 w-6 text-blue-500" />}
            </div>
            <div>
              <DialogTitle className="text-2xl font-bold">{item ? "Editar Item" : "Nuevo Item de Inventario"}</DialogTitle>
              <DialogDescription className="text-slate-400 mt-1 font-medium italic">
                {item ? "Actualiza los detalles del producto" : "Registra un nuevo producto en el inventario"}
              </DialogDescription>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 bg-white dark:bg-slate-900 overscroll-contain">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4 md:col-span-2">
              <div className="space-y-2">
                <Label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Nombre del Producto</Label>
                <Input
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Ej: Pendón Roller lona PRO"
                  className="py-6 rounded-2xl border-slate-100 dark:border-slate-800 focus-visible:ring-blue-500 text-lg font-bold"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Descripción</Label>
                <Textarea
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  placeholder="Detalles adicionales, dimensiones, marca..."
                  className="rounded-2xl border-slate-100 dark:border-slate-800 focus-visible:ring-blue-500 resize-none h-24"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Stock Inicial</Label>
              <Input
                type="number"
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
                placeholder="0"
                className="py-6 rounded-2xl border-slate-100 dark:border-slate-800 focus-visible:ring-blue-500"
                required
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Unidad de Medida</Label>
              <Select value={unidad} onValueChange={setUnidad}>
                <SelectTrigger className="py-6 rounded-2xl border-slate-100 dark:border-slate-800 focus-visible:ring-blue-500">
                  <SelectValue placeholder="Seleccionar unidad" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-none shadow-2xl">
                  <SelectItem value="unidades">Unidades</SelectItem>
                  <SelectItem value="metros">Metros</SelectItem>
                  <SelectItem value="kg">Kilogramos</SelectItem>
                  <SelectItem value="packs">Packs</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Stock Mínimo (Alerta)</Label>
              <Input
                type="number"
                value={stockMinimo}
                onChange={(e) => setStockMinimo(e.target.value)}
                placeholder="0"
                className="py-6 rounded-2xl border-slate-100 dark:border-slate-800 focus-visible:ring-blue-500"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Ubicación</Label>
              <Input
                value={ubicacion}
                onChange={(e) => setUbicacion(e.target.value)}
                placeholder="Ej: Estante B-4"
                className="py-6 rounded-2xl border-slate-100 dark:border-slate-800 focus-visible:ring-blue-500"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Costo Unitario ($)</Label>
              <Input
                type="number"
                value={costoUnitario}
                onChange={(e) => setCostoUnitario(e.target.value)}
                placeholder="0"
                className="py-6 rounded-2xl border-slate-100 dark:border-slate-800 focus-visible:ring-blue-500"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Estado</Label>
              <Select value={estado} onValueChange={setEstado}>
                <SelectTrigger className="py-6 rounded-2xl border-slate-100 dark:border-slate-800 focus-visible:ring-blue-500 font-bold uppercase tracking-wider text-[10px]">
                  <SelectValue placeholder="Estado inicial" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-none shadow-2xl">
                  <SelectItem value="disponible">DISPONIBLE</SelectItem>
                  <SelectItem value="agotado">AGOTADO</SelectItem>
                  <SelectItem value="por_llegar">POR LLEGAR</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Proveedor (Opcional)</Label>
              <Input
                value={proveedor}
                onChange={(e) => setProveedor(e.target.value)}
                placeholder="Nombre del proveedor o tienda"
                className="py-6 rounded-2xl border-slate-100 dark:border-slate-800 focus-visible:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex gap-4 mt-10">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="flex-1 py-7 rounded-2xl font-bold text-slate-500 hover:bg-slate-50">
              Cancelar
            </Button>
            <Button type="submit" disabled={saveMutation.isPending} className="flex-1 py-7 rounded-2xl font-bold bg-slate-950 hover:bg-black text-white shadow-xl transition-all shadow-blue-500/10 hover:shadow-blue-500/20 active:scale-95">
              {saveMutation.isPending ? <Loader2 className="h-6 w-6 animate-spin" /> : item ? "Guardar Cambios" : "Crear Producto"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
// Tareas Marketing Component
function TareasMarketing({
  mes,
  anio,
  userRole
}: {
  mes: number;
  anio: number;
  userRole: string;
}) {
  const { toast } = useToast();
  const [tareaDialogOpen, setTareaDialogOpen] = useState(false);
  const [selectedTarea, setSelectedTarea] = useState<TareaMarketing | null>(null);
  const [filtroEstado, setFiltroEstado] = useState<string>("todos");

  const { data: tareas = [], isLoading } = useQuery<TareaMarketing[]>({
    queryKey: ['/api/marketing/tareas', mes, anio],
    queryFn: async () => {
      const response = await fetch(`/api/marketing/tareas?mes=${mes}&anio=${anio}`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Error al cargar tareas');
      return response.json();
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async (tareaId: string) => {
      return await apiRequest('POST', `/api/marketing/tareas/${tareaId}/toggle`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/marketing/tareas'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo cambiar el estado",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (tareaId: string) => {
      return await apiRequest('DELETE', `/api/marketing/tareas/${tareaId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/marketing/tareas'] });
      toast({
        title: "Tarea eliminada",
        description: "La tarea ha sido eliminada correctamente",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo eliminar la tarea",
        variant: "destructive",
      });
    },
  });

  const tareasFiltradas = filtroEstado === "todos"
    ? tareas
    : tareas.filter(t => t.estado === filtroEstado);

  const estadoConfig = {
    pendiente: { label: "Pendiente", color: "bg-gray-500", icon: Circle },
    en_proceso: { label: "En Proceso", color: "bg-yellow-500", icon: Play },
    completado: { label: "Completado", color: "bg-green-500", icon: Check },
  };

  const prioridadConfig = {
    baja: { label: "Baja", color: "bg-blue-100 text-blue-800" },
    media: { label: "Media", color: "bg-yellow-100 text-yellow-800" },
    alta: { label: "Alta", color: "bg-red-100 text-red-800" },
  };

  const handleToggleEstado = (tareaId: string) => {
    toggleMutation.mutate(tareaId);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-2">
          <Label>Filtrar por estado:</Label>
          <Select value={filtroEstado} onValueChange={setFiltroEstado}>
            <SelectTrigger className="w-[180px]" data-testid="select-filtro-estado-tareas">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="pendiente">Pendientes</SelectItem>
              <SelectItem value="en_proceso">En Proceso</SelectItem>
              <SelectItem value="completado">Completados</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {(userRole === 'admin' || userRole === 'supervisor') && (
          <Button onClick={() => { setSelectedTarea(null); setTareaDialogOpen(true); }} data-testid="button-nueva-tarea">
            <Plus className="h-4 w-4 mr-2" />
            Nueva Tarea
          </Button>
        )}
      </div>

      {tareasFiltradas.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ClipboardList className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">
              No hay tareas para este período
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {tareasFiltradas.map((tarea) => {
            const config = estadoConfig[tarea.estado];
            const prioridadCfg = prioridadConfig[tarea.prioridad];
            const IconEstado = config.icon;

            return (
              <Card key={tarea.id} className="hover:shadow-md transition-shadow" data-testid={`card-tarea-${tarea.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <button
                      onClick={() => handleToggleEstado(tarea.id)}
                      disabled={toggleMutation.isPending}
                      className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white transition-all hover:opacity-80 ${config.color}`}
                      data-testid={`button-toggle-tarea-${tarea.id}`}
                    >
                      <IconEstado className="h-4 w-4" />
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className={`font-medium ${tarea.estado === 'completado' ? 'line-through text-muted-foreground' : ''}`}>
                            {tarea.titulo}
                          </h4>
                          {tarea.descripcion && (
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                              {tarea.descripcion}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Badge className={prioridadCfg.color}>
                            {prioridadCfg.label}
                          </Badge>
                          <Badge className={`${config.color} text-white`}>
                            {config.label}
                          </Badge>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                        {tarea.fechaLimite && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(tarea.fechaLimite), 'dd/MM/yyyy', { locale: es })}
                          </span>
                        )}
                        {tarea.asignadoANombre && (
                          <span>Asignado a: {tarea.asignadoANombre}</span>
                        )}
                        {tarea.creadoPorNombre && (
                          <span>Creado por: {tarea.creadoPorNombre}</span>
                        )}
                      </div>
                    </div>

                    {userRole === 'admin' && (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => { setSelectedTarea(tarea); setTareaDialogOpen(true); }}
                          data-testid={`button-editar-tarea-${tarea.id}`}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteMutation.mutate(tarea.id)}
                          disabled={deleteMutation.isPending}
                          data-testid={`button-eliminar-tarea-${tarea.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <TareaDialog
        open={tareaDialogOpen}
        onOpenChange={setTareaDialogOpen}
        tarea={selectedTarea}
        mes={mes}
        anio={anio}
      />
    </div>
  );
}

// Tarea Dialog Component
function TareaDialog({
  open,
  onOpenChange,
  tarea,
  mes,
  anio,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tarea: TareaMarketing | null;
  mes: number;
  anio: number;
}) {
  const { toast } = useToast();
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [prioridad, setPrioridad] = useState("media");
  const [fechaLimite, setFechaLimite] = useState("");

  useEffect(() => {
    if (open) {
      if (tarea) {
        setTitulo(tarea.titulo);
        setDescripcion(tarea.descripcion || "");
        setPrioridad(tarea.prioridad);
        setFechaLimite(tarea.fechaLimite || "");
      } else {
        setTitulo("");
        setDescripcion("");
        setPrioridad("media");
        setFechaLimite("");
      }
    }
  }, [open, tarea]);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest('POST', '/api/marketing/tareas', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/marketing/tareas'] });
      toast({
        title: "Tarea creada",
        description: "La tarea ha sido creada correctamente",
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo crear la tarea",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest('PATCH', `/api/marketing/tareas/${tarea?.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/marketing/tareas'] });
      toast({
        title: "Tarea actualizada",
        description: "Los cambios han sido guardados",
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo actualizar la tarea",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    if (!titulo.trim()) {
      toast({
        title: "Error",
        description: "El título es requerido",
        variant: "destructive",
      });
      return;
    }

    const data = {
      titulo,
      descripcion: descripcion || null,
      prioridad,
      fechaLimite: fechaLimite || null,
      mes,
      anio,
    };

    if (tarea) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" data-testid="dialog-tarea">
        <DialogHeader>
          <DialogTitle>{tarea ? 'Editar Tarea' : 'Nueva Tarea'}</DialogTitle>
          <DialogDescription>
            {tarea ? 'Modifique los detalles de la tarea' : 'Complete los campos para crear una nueva tarea'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="titulo-tarea">Título*</Label>
            <Input
              id="titulo-tarea"
              placeholder="Ej: Diseñar banner promocional"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              data-testid="input-titulo-tarea"
            />
          </div>

          <div>
            <Label htmlFor="descripcion-tarea">Descripción</Label>
            <Textarea
              id="descripcion-tarea"
              placeholder="Describa los detalles de la tarea..."
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={3}
              data-testid="input-descripcion-tarea"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="prioridad-tarea">Prioridad</Label>
              <Select value={prioridad} onValueChange={setPrioridad}>
                <SelectTrigger data-testid="select-prioridad-tarea">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="baja">Baja</SelectItem>
                  <SelectItem value="media">Media</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="fecha-limite-tarea">Fecha Límite</Label>
              <Input
                id="fecha-limite-tarea"
                type="date"
                value={fechaLimite}
                onChange={(e) => setFechaLimite(e.target.value)}
                data-testid="input-fecha-limite-tarea"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="button-cancelar-tarea"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending}
            data-testid="button-guardar-tarea"
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Guardando...
              </>
            ) : (
              tarea ? 'Guardar Cambios' : 'Crear Tarea'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Calendario Component
function CalendarioHitos({
  mes,
  anio,
  userRole,
  onMesChange,
  onAnioChange
}: {
  mes: number;
  anio: number;
  userRole: string;
  onMesChange: (mes: number) => void;
  onAnioChange: (anio: number) => void;
}) {
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [hitoDialogOpen, setHitoDialogOpen] = useState(false);
  const [selectedHito, setSelectedHito] = useState<HitoMarketing | null>(null);

  const handlePrevMonth = () => {
    if (mes === 1) {
      onMesChange(12);
      onAnioChange(anio - 1);
    } else {
      onMesChange(mes - 1);
    }
  };

  const handleNextMonth = () => {
    if (mes === 12) {
      onMesChange(1);
      onAnioChange(anio + 1);
    } else {
      onMesChange(mes + 1);
    }
  };

  const handleToday = () => {
    const today = new Date();
    onMesChange(today.getMonth() + 1);
    onAnioChange(today.getFullYear());
  };

  const { data: hitos, isLoading: hitosLoading } = useQuery<HitoMarketing[]>({
    queryKey: ['/api/marketing/hitos', mes, anio],
    queryFn: async () => {
      const response = await fetch(`/api/marketing/hitos?mes=${mes}&anio=${anio}`, {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Error al cargar hitos');
      }
      return response.json();
    },
  });

  const { data: tareas, isLoading: tareasLoading } = useQuery<TareaMarketing[]>({
    queryKey: ['/api/marketing/tareas', mes, anio, 'calendario'],
    queryFn: async () => {
      const response = await fetch(`/api/marketing/tareas?mes=${mes}&anio=${anio}&incluirPorFechaLimite=true`, {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Error al cargar tareas');
      }
      return response.json();
    },
  });

  const { data: creatividades, isLoading: creatividadesLoading } = useQuery<any[]>({
    queryKey: ['/api/marketing/creatividades', mes, anio, 'calendario'],
    queryFn: async () => {
      const response = await fetch(`/api/marketing/creatividades?mes=${mes}&anio=${anio}`, {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Error al cargar creatividades');
      }
      return response.json();
    },
  });

  const isLoading = hitosLoading || tareasLoading || creatividadesLoading;

  const currentMonth = new Date(anio, mes - 1, 1);
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Get day of week for first day (0 = Sunday, 1 = Monday, etc.)
  const firstDayOfWeek = monthStart.getDay();
  // Adjust to start week on Monday (0 = Monday, 6 = Sunday)
  const startPadding = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

  const handleDayClick = (day: Date) => {
    setSelectedDate(day);
    setSelectedHito(null);
    setHitoDialogOpen(true);
  };

  const handleHitoClick = (hito: HitoMarketing, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedHito(hito);
    const parsedDate = parseDateFromAPI(hito.fecha);
    setSelectedDate(parsedDate || new Date());
    setHitoDialogOpen(true);
  };

  const getHitosForDay = (day: Date) => {
    if (!hitos) return [];
    return hitos.filter(hito => {
      const hitoDate = parseDateFromAPI(hito.fecha);
      return hitoDate && isSameDay(hitoDate, day);
    });
  };

  const getTareasForDay = (day: Date) => {
    if (!tareas) return [];
    return tareas.filter(tarea => {
      if (!tarea.fechaLimite) return false;
      const tareaDate = parseDateFromAPI(tarea.fechaLimite);
      return tareaDate && isSameDay(tareaDate, day);
    });
  };

  const getCreatividadesForDay = (day: Date) => {
    if (!creatividades) return [];
    return creatividades.filter(creatividad => {
      if (!creatividad.fechaPublicacion) return false;
      const creatividadDate = parseDateFromAPI(creatividad.fechaPublicacion);
      return creatividadDate && isSameDay(creatividadDate, day);
    });
  };

  const tipoColors = {
    general: 'bg-blue-500',
    campaña: 'bg-purple-500',
    evento: 'bg-green-500',
    deadline: 'bg-red-500',
  };

  const tareaEstadoColors = {
    pendiente: 'bg-orange-500',
    en_proceso: 'bg-yellow-500',
    completado: 'bg-emerald-600',
  };

  const creatividadEstadoColors = {
    planificacion: 'bg-slate-400',
    grabacion: 'bg-yellow-500',
    edicion: 'bg-blue-400',
    completado: 'bg-emerald-500',
    publicado: 'bg-fuchsia-600',
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="space-y-3">
            {/* Navegación de mes */}
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrevMonth}
                data-testid="button-prev-month"
                className="h-8 w-8 p-0"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <CardTitle className="text-lg sm:text-xl text-center">
                {format(currentMonth, 'MMMM yyyy', { locale: es })}
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={handleNextMonth}
                data-testid="button-next-month"
                className="h-8 w-8 p-0"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Botones de acción */}
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={handleToday}
                data-testid="button-hoy"
                className="h-8 text-xs"
              >
                Hoy
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedDate(new Date());
                  setSelectedHito(null);
                  setHitoDialogOpen(true);
                }}
                data-testid="button-nuevo-hito"
                className="h-8 text-xs"
              >
                <Plus className="mr-1 h-3 w-3" />
                Nuevo
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <div className="space-y-3">
              {/* Legend */}
              <div className="flex flex-wrap gap-2 sm:gap-4 text-xs sm:text-sm">
                <div className="flex items-center gap-1 sm:gap-2">
                  <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-blue-500" />
                  <span>General</span>
                </div>
                <div className="flex items-center gap-1 sm:gap-2">
                  <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-purple-500" />
                  <span>Campaña</span>
                </div>
                <div className="flex items-center gap-1 sm:gap-2">
                  <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-green-500" />
                  <span>Evento</span>
                </div>
                <div className="flex items-center gap-1 sm:gap-2">
                  <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-red-500" />
                  <span>Deadline</span>
                </div>
                <div className="border-l border-border pl-2 sm:pl-4 flex items-center gap-1 sm:gap-2">
                  <ClipboardList className="w-3 h-3 sm:w-4 sm:h-4 text-orange-500" />
                  <span>Tareas</span>
                </div>
                <div className="flex items-center gap-1 sm:gap-2">
                  <Video className="w-3 h-3 sm:w-4 sm:h-4 text-fuchsia-600" />
                  <span>Creatividades</span>
                </div>
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-1 sm:gap-2">
                {/* Day headers */}
                {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((day) => (
                  <div key={day} className="text-center font-semibold text-[10px] sm:text-sm py-1 sm:py-2">
                    {day}
                  </div>
                ))}

                {/* Empty cells for days before month starts */}
                {Array.from({ length: startPadding }).map((_, i) => (
                  <div key={`empty-${i}`} className="min-h-[60px] sm:min-h-[100px] bg-muted/30 rounded-lg" />
                ))}

                {/* Days of the month */}
                {daysInMonth.map((day) => {
                  const dayHitos = getHitosForDay(day);
                  const dayTareas = getTareasForDay(day);
                  const dayCreatividades = getCreatividadesForDay(day);
                  const isToday = isSameDay(day, new Date());
                  const totalItems = dayHitos.length + dayTareas.length + dayCreatividades.length;
                  const maxVisible = 3;
                  let itemsShown = 0;

                  return (
                    <div
                      key={day.toISOString()}
                      className={`min-h-[60px] sm:min-h-[100px] border rounded-lg p-1 sm:p-2 cursor-pointer hover:bg-muted/50 transition-colors ${isToday ? 'border-primary border-2' : 'border-border'
                        }`}
                      onClick={() => handleDayClick(day)}
                      data-testid={`calendar-day-${format(day, 'yyyy-MM-dd')}`}
                    >
                      <div className={`text-[10px] sm:text-sm font-semibold mb-0.5 sm:mb-1 ${isToday ? 'text-primary' : ''}`}>
                        {format(day, 'd')}
                      </div>
                      <div className="space-y-0.5 sm:space-y-1">
                        {/* Mostrar hitos */}
                        {dayHitos.slice(0, maxVisible).map((hito) => {
                          itemsShown++;
                          return (
                            <div
                              key={`hito-${hito.id}`}
                              className={`text-[8px] sm:text-xs p-0.5 sm:p-1 rounded truncate cursor-pointer ${tipoColors[hito.tipo]} text-white flex items-center gap-0.5 sm:gap-1`}
                              onClick={(e) => handleHitoClick(hito, e)}
                              title={hito.titulo}
                              data-testid={`hito-${hito.id}`}
                            >
                              {hito.completado && <CheckSquare className="h-2 w-2 sm:h-3 sm:w-3 flex-shrink-0" />}
                              <span className="truncate">{hito.titulo}</span>
                            </div>
                          );
                        })}
                        {/* Mostrar tareas (solo si hay espacio después de los hitos) */}
                        {dayTareas.slice(0, Math.max(0, maxVisible - itemsShown)).map((tarea) => {
                          itemsShown++;
                          return (
                            <div
                              key={`tarea-${tarea.id}`}
                              className={`text-[8px] sm:text-xs p-0.5 sm:p-1 rounded truncate cursor-pointer ${tareaEstadoColors[tarea.estado as keyof typeof tareaEstadoColors]} text-white flex items-center gap-0.5 sm:gap-1`}
                              onClick={(e) => e.stopPropagation()}
                              title={`Tarea: ${tarea.titulo}`}
                              data-testid={`tarea-cal-${tarea.id}`}
                            >
                              <ClipboardList className="h-2 w-2 sm:h-3 sm:w-3 flex-shrink-0" />
                              <span className="truncate">{tarea.titulo}</span>
                            </div>
                          );
                        })}
                        {/* Mostrar creatividades (solo si hay espacio) */}
                        {dayCreatividades.slice(0, Math.max(0, maxVisible - itemsShown)).map((creatividad) => {
                          itemsShown++;
                          return (
                            <div
                              key={`creatividad-${creatividad.id}`}
                              className={`text-[8px] sm:text-xs p-0.5 sm:p-1 rounded truncate cursor-pointer ${creatividadEstadoColors[creatividad.estado as keyof typeof creatividadEstadoColors]} text-white flex items-center gap-0.5 sm:gap-1`}
                              onClick={(e) => e.stopPropagation()}
                              title={`Creatividad: ${creatividad.titulo}`}
                            >
                              <Video className="h-2 w-2 sm:h-3 sm:w-3 flex-shrink-0" />
                              <span className="truncate">{creatividad.titulo}</span>
                            </div>
                          );
                        })}
                        {totalItems > maxVisible && (
                          <div className="text-[8px] sm:text-xs text-muted-foreground">
                            +{totalItems - maxVisible}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <HitoDialog
        open={hitoDialogOpen}
        onOpenChange={setHitoDialogOpen}
        selectedDate={selectedDate}
        hito={selectedHito}
        userRole={userRole}
      />
    </>
  );
}

// Hito Dialog Component
function HitoDialog({
  open,
  onOpenChange,
  selectedDate,
  hito,
  userRole,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: Date | null;
  hito: HitoMarketing | null;
  userRole: string;
}) {
  const { toast } = useToast();
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [tipo, setTipo] = useState<'general' | 'campaña' | 'evento' | 'deadline'>('general');
  const [completado, setCompletado] = useState(false);

  useEffect(() => {
    if (hito) {
      setTitulo(hito.titulo);
      setDescripcion(hito.descripcion || '');
      setTipo(hito.tipo);
      setCompletado(hito.completado);
    } else {
      setTitulo('');
      setDescripcion('');
      setTipo('general');
      setCompletado(false);
    }
  }, [hito, open]);

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      if (hito) {
        return await apiRequest('PATCH', `/api/marketing/hitos/${hito.id}`, data);
      } else {
        return await apiRequest('POST', '/api/marketing/hitos', data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/marketing/hitos'] });
      toast({
        title: "Éxito",
        description: hito ? "Hito actualizado correctamente" : "Hito creado correctamente",
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo guardar el hito",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!hito) return;
      return await apiRequest('DELETE', `/api/marketing/hitos/${hito.id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/marketing/hitos'] });
      toast({
        title: "Éxito",
        description: "Hito eliminado correctamente",
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo eliminar el hito",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    if (!titulo.trim()) {
      toast({
        title: "Error",
        description: "El título es requerido",
        variant: "destructive",
      });
      return;
    }

    if (!selectedDate) {
      toast({
        title: "Error",
        description: "La fecha es requerida",
        variant: "destructive",
      });
      return;
    }

    const data = {
      titulo: titulo.trim(),
      descripcion: descripcion.trim() || null,
      fecha: formatDateForAPI(selectedDate),
      tipo,
      completado,
    };

    saveMutation.mutate(data);
  };

  const handleDelete = () => {
    if (window.confirm('¿Estás seguro de que deseas eliminar este hito?')) {
      deleteMutation.mutate();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" data-testid="dialog-hito">
        <DialogHeader>
          <DialogTitle>{hito ? 'Editar Hito' : 'Nuevo Hito'}</DialogTitle>
          <DialogDescription>
            {selectedDate ? format(selectedDate, 'dd/MM/yyyy', { locale: es }) : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="titulo">Título *</Label>
            <Input
              id="titulo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Título del hito"
              data-testid="input-titulo-hito"
            />
          </div>

          <div>
            <Label htmlFor="descripcion">Descripción</Label>
            <Textarea
              id="descripcion"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Descripción opcional"
              rows={3}
              data-testid="input-descripcion-hito"
            />
          </div>

          <div>
            <Label htmlFor="tipo">Tipo</Label>
            <Select
              value={tipo}
              onValueChange={(value: any) => setTipo(value)}
            >
              <SelectTrigger data-testid="select-tipo-hito">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="general">General</SelectItem>
                <SelectItem value="campaña">Campaña</SelectItem>
                <SelectItem value="evento">Evento</SelectItem>
                <SelectItem value="deadline">Deadline</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Marcar como completado - Card destacado */}
          <div className={`flex items-center justify-between p-4 rounded-lg border-2 transition-all ${completado
            ? 'bg-green-50 border-green-500'
            : 'bg-gray-50 border-gray-200'
            }`}>
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-full ${completado ? 'bg-green-500' : 'bg-gray-400'
                }`}>
                <CheckSquare className="h-5 w-5 text-white" />
              </div>
              <div>
                <Label htmlFor="completado" className="text-sm font-semibold cursor-pointer">
                  Marcar como completado
                </Label>
                <p className="text-xs text-muted-foreground">
                  {completado ? 'Este hito está completado' : 'Hito pendiente'}
                </p>
              </div>
            </div>
            <Switch
              id="completado"
              checked={completado}
              onCheckedChange={setCompletado}
              data-testid="switch-completado-hito"
            />
          </div>
        </div>

        {/* Botón de eliminar arriba en móvil */}
        {hito && userRole === 'admin' && (
          <div className="pb-2 sm:hidden">
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              data-testid="button-eliminar-hito"
              className="w-full"
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Eliminando...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Eliminar
                </>
              )}
            </Button>
          </div>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {/* Botón de eliminar en desktop */}
          <div className="hidden sm:block sm:mr-auto">
            {hito && userRole === 'admin' && (
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                data-testid="button-eliminar-hito-desktop"
              >
                {deleteMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Eliminando...
                  </>
                ) : (
                  <>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Eliminar
                  </>
                )}
              </Button>
            )}
          </div>

          {/* Botones principales */}
          <div className="flex gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              data-testid="button-cancelar-hito"
              className="flex-1 sm:flex-none"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={saveMutation.isPending}
              data-testid="button-guardar-hito"
              className="flex-1 sm:flex-none"
            >
              {saveMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                'Guardar'
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// SEO Tracking Component
interface SeoCampaign {
  id: string;
  nombre: string;
  dominio: string;
  descripcion: string | null;
  activo: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

interface SeoKeywordData {
  id: string;
  campaignId: string;
  keyword: string;
  urlObjetivo: string | null;
  ubicacion: string;
  idioma: string;
  dispositivo: string;
  ultimaPosicion: number | null;
  ultimaConsulta: string | null;
  activo: boolean;
  createdAt: string;
  historial: SeoPositionHistoryData[];
}

interface SeoPositionHistoryData {
  id: string;
  keywordId: string;
  posicion: number | null;
  urlEncontrada: string | null;
  titulo: string | null;
  snippet: string | null;
  pagina: number | null;
  totalResultados: number | null;
  fechaConsulta: string;
  busquedasRestantes: number | null;
}

function SeoTracking() {
  const { toast } = useToast();
  const [selectedCampaign, setSelectedCampaign] = useState<SeoCampaign | null>(null);
  const [campaignDialogOpen, setCampaignDialogOpen] = useState(false);
  const [keywordDialogOpen, setKeywordDialogOpen] = useState(false);
  const [checkingPosition, setCheckingPosition] = useState<string | null>(null);
  const [checkingAll, setCheckingAll] = useState(false);

  // Campaign form state
  const [campaignNombre, setCampaignNombre] = useState('');
  const [campaignDominio, setCampaignDominio] = useState('');
  const [campaignDescripcion, setCampaignDescripcion] = useState('');

  // Keyword form state
  const [keywordText, setKeywordText] = useState('');
  const [keywordUrl, setKeywordUrl] = useState('');
  const [keywordUbicacion, setKeywordUbicacion] = useState('Chile');
  const [keywordDispositivo, setKeywordDispositivo] = useState('desktop');

  // Fetch campaigns
  const { data: campaigns = [], isLoading: loadingCampaigns, refetch: refetchCampaigns } = useQuery<SeoCampaign[]>({
    queryKey: ['/api/seo/campaigns'],
  });

  // Fetch keywords for selected campaign
  const { data: keywords = [], isLoading: loadingKeywords, refetch: refetchKeywords } = useQuery<SeoKeywordData[]>({
    queryKey: ['/api/seo/campaigns', selectedCampaign?.id, 'keywords'],
    enabled: !!selectedCampaign,
  });

  // Create campaign mutation
  const createCampaignMutation = useMutation({
    mutationFn: async (campaignData: { nombre: string; dominio: string; descripcion: string }) => {
      return await apiRequest('/api/seo/campaigns', {
        method: 'POST',
        data: campaignData,
      });
    },
    onSuccess: () => {
      toast({ title: 'Campaña creada exitosamente' });
      queryClient.invalidateQueries({ queryKey: ['/api/seo/campaigns'] });
      setCampaignDialogOpen(false);
      setCampaignNombre('');
      setCampaignDominio('');
      setCampaignDescripcion('');
    },
    onError: (error: any) => {
      toast({ title: 'Error al crear campaña', description: error.message, variant: 'destructive' });
    },
  });

  // Create keyword mutation
  const createKeywordMutation = useMutation({
    mutationFn: async (keywordData: any) => {
      return await apiRequest('/api/seo/keywords', {
        method: 'POST',
        data: keywordData,
      });
    },
    onSuccess: () => {
      toast({ title: 'Keyword agregada exitosamente' });
      queryClient.invalidateQueries({ queryKey: ['/api/seo/campaigns', selectedCampaign?.id, 'keywords'] });
      setKeywordDialogOpen(false);
      setKeywordText('');
      setKeywordUrl('');
    },
    onError: (error: any) => {
      toast({ title: 'Error al agregar keyword', description: error.message, variant: 'destructive' });
    },
  });

  // Delete keyword mutation
  const deleteKeywordMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/seo/keywords/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      toast({ title: 'Keyword eliminada' });
      queryClient.invalidateQueries({ queryKey: ['/api/seo/campaigns', selectedCampaign?.id, 'keywords'] });
    },
  });

  // Delete campaign mutation
  const deleteCampaignMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/seo/campaigns/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      toast({ title: 'Campaña eliminada exitosamente' });
      setSelectedCampaign(null);
      queryClient.invalidateQueries({ queryKey: ['/api/seo/campaigns'] });
    },
    onError: (error: any) => {
      toast({ title: 'Error al eliminar campaña', description: error.message, variant: 'destructive' });
    },
  });

  // Check position mutation
  const checkPositionMutation = useMutation({
    mutationFn: async (keywordId: string) => {
      setCheckingPosition(keywordId);
      return await apiRequest('/api/seo/check-position', {
        method: 'POST',
        data: { keywordId },
      });
    },
    onSuccess: (data: any) => {
      if (data.posicion) {
        toast({ title: `Posición encontrada: #${data.posicion}` });
      } else {
        toast({ title: 'No se encontró en los primeros 100 resultados', variant: 'destructive' });
      }
      queryClient.invalidateQueries({ queryKey: ['/api/seo/campaigns', selectedCampaign?.id, 'keywords'] });
      setCheckingPosition(null);
    },
    onError: (error: any) => {
      toast({ title: 'Error al verificar posición', description: error.message, variant: 'destructive' });
      setCheckingPosition(null);
    },
  });

  // Check all positions mutation
  const checkAllMutation = useMutation({
    mutationFn: async (campaignId: string) => {
      setCheckingAll(true);
      return await apiRequest(`/api/seo/campaigns/${campaignId}/check-all`, { method: 'POST' });
    },
    onSuccess: (data: any) => {
      toast({ title: `Verificación completada: ${data.total} keywords procesadas` });
      queryClient.invalidateQueries({ queryKey: ['/api/seo/campaigns', selectedCampaign?.id, 'keywords'] });
      setCheckingAll(false);
    },
    onError: (error: any) => {
      toast({ title: 'Error al verificar posiciones', description: error.message, variant: 'destructive' });
      setCheckingAll(false);
    },
  });

  const handleCreateCampaign = () => {
    if (!campaignNombre || !campaignDominio) {
      toast({ title: 'Complete los campos requeridos', variant: 'destructive' });
      return;
    }
    createCampaignMutation.mutate({
      nombre: campaignNombre,
      dominio: campaignDominio,
      descripcion: campaignDescripcion,
    });
  };

  const handleCreateKeyword = () => {
    if (!keywordText || !selectedCampaign) {
      toast({ title: 'Complete los campos requeridos', variant: 'destructive' });
      return;
    }
    createKeywordMutation.mutate({
      campaignId: selectedCampaign.id,
      keyword: keywordText,
      urlObjetivo: keywordUrl || null,
      ubicacion: keywordUbicacion,
      idioma: 'es',
      activo: true,
    });
  };

  const getPositionColor = (pos: number | null) => {
    if (!pos) return 'text-gray-400';
    if (pos <= 3) return 'text-green-500';
    if (pos <= 10) return 'text-yellow-500';
    if (pos <= 20) return 'text-orange-500';
    return 'text-red-500';
  };

  const getPositionBadge = (pos: number | null) => {
    if (!pos) return <Badge variant="secondary">No encontrado</Badge>;
    if (pos <= 3) return <Badge className="bg-green-500">#{pos}</Badge>;
    if (pos <= 10) return <Badge className="bg-yellow-500">#{pos}</Badge>;
    if (pos <= 20) return <Badge className="bg-orange-500">#{pos}</Badge>;
    return <Badge variant="destructive">#{pos}</Badge>;
  };

  if (loadingCampaigns) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Posicionamiento Web</h2>
          <p className="text-muted-foreground">Monitoreo de posiciones en Google con SerpAPI</p>
        </div>
        <Button onClick={() => setCampaignDialogOpen(true)} data-testid="button-nueva-campana">
          <Plus className="mr-2 h-4 w-4" />
          Nueva Campaña
        </Button>
      </div>

      {/* Campaign Selection */}
      {campaigns.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <TrendingUp className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No hay campañas</h3>
            <p className="text-muted-foreground mb-4">Crea tu primera campaña para comenzar a monitorear posiciones</p>
            <Button onClick={() => setCampaignDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Crear Campaña
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Seleccionar Campaña</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Select
                  value={selectedCampaign?.id || ''}
                  onValueChange={(value) => {
                    const camp = campaigns.find(c => c.id === value);
                    setSelectedCampaign(camp || null);
                  }}
                >
                  <SelectTrigger data-testid="select-campana" className="flex-1">
                    <SelectValue placeholder="Selecciona una campaña" />
                  </SelectTrigger>
                  <SelectContent>
                    {campaigns.map((campaign) => (
                      <SelectItem key={campaign.id} value={campaign.id}>
                        {campaign.nombre} - {campaign.dominio}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedCampaign && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="destructive"
                        size="icon"
                        data-testid="button-eliminar-campana"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar campaña?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta acción no se puede deshacer. Se eliminarán la campaña "{selectedCampaign.nombre}" y todas sus keywords asociadas.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteCampaignMutation.mutate(selectedCampaign.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          data-testid="button-confirmar-eliminar-campana"
                        >
                          Eliminar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Keywords Table */}
          {selectedCampaign && (
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <div>
                    <CardTitle>Keywords - {selectedCampaign.nombre}</CardTitle>
                    <CardDescription>Dominio: {selectedCampaign.dominio}</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => checkAllMutation.mutate(selectedCampaign.id)}
                      disabled={checkingAll || keywords.length === 0}
                      data-testid="button-verificar-todas"
                    >
                      {checkingAll ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Verificando...
                        </>
                      ) : (
                        <>
                          <TrendingUp className="mr-2 h-4 w-4" />
                          Verificar Todas
                        </>
                      )}
                    </Button>
                    <Button onClick={() => setKeywordDialogOpen(true)} data-testid="button-agregar-keyword">
                      <Plus className="mr-2 h-4 w-4" />
                      Agregar Keyword
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loadingKeywords ? (
                  <div className="flex justify-center p-4">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : keywords.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No hay keywords configuradas</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Keyword</TableHead>
                          <TableHead>Ubicación</TableHead>
                          <TableHead>Dispositivo</TableHead>
                          <TableHead>Posición</TableHead>
                          <TableHead>Última Consulta</TableHead>
                          <TableHead>Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {keywords.map((kw) => (
                          <TableRow key={kw.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium">{kw.keyword}</p>
                                {kw.urlObjetivo && (
                                  <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                                    {kw.urlObjetivo}
                                  </p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>{kw.ubicacion}</TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {kw.dispositivo === 'desktop' ? '🖥️ Desktop' : '📱 Mobile'}
                              </Badge>
                            </TableCell>
                            <TableCell>{getPositionBadge(kw.ultimaPosicion)}</TableCell>
                            <TableCell>
                              {kw.ultimaConsulta ? (
                                <span className="text-sm">
                                  {format(new Date(kw.ultimaConsulta), 'dd/MM/yy HH:mm', { locale: es })}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => checkPositionMutation.mutate(kw.id)}
                                  disabled={checkingPosition === kw.id}
                                  data-testid={`button-verificar-${kw.id}`}
                                >
                                  {checkingPosition === kw.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <TrendingUp className="h-4 w-4" />
                                  )}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => deleteKeywordMutation.mutate(kw.id)}
                                  data-testid={`button-eliminar-${kw.id}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Position History Chart */}
          {selectedCampaign && keywords.length > 0 && keywords.some(k => k.historial.length > 0) && (
            <Card>
              <CardHeader>
                <CardTitle>Historial de Posiciones</CardTitle>
                <CardDescription>Evolución de las posiciones en el tiempo</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {keywords.filter(k => k.historial.length > 0).map((kw) => (
                    <div key={kw.id} className="border rounded-lg p-4">
                      <h4 className="font-semibold mb-2">{kw.keyword}</h4>
                      <div className="flex flex-wrap gap-2">
                        {kw.historial.slice(0, 10).reverse().map((h, idx) => (
                          <div key={h.id} className="text-center">
                            <div className={`text-lg font-bold ${getPositionColor(h.posicion)}`}>
                              {h.posicion || '-'}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {format(new Date(h.fechaConsulta), 'dd/MM', { locale: es })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Campaign Dialog */}
      <Dialog open={campaignDialogOpen} onOpenChange={setCampaignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva Campaña SEO</DialogTitle>
            <DialogDescription>
              Crea una campaña para monitorear las posiciones de tu sitio web
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="campaignNombre">Nombre de la Campaña *</Label>
              <Input
                id="campaignNombre"
                value={campaignNombre}
                onChange={(e) => setCampaignNombre(e.target.value)}
                placeholder="Ej: Pinturas Panorámica"
                data-testid="input-nombre-campana"
              />
            </div>
            <div>
              <Label htmlFor="campaignDominio">Dominio a Monitorear *</Label>
              <Input
                id="campaignDominio"
                value={campaignDominio}
                onChange={(e) => setCampaignDominio(e.target.value)}
                placeholder="Ej: pinturaspanoramica.cl"
                data-testid="input-dominio-campana"
              />
            </div>
            <div>
              <Label htmlFor="campaignDescripcion">Descripción</Label>
              <Textarea
                id="campaignDescripcion"
                value={campaignDescripcion}
                onChange={(e) => setCampaignDescripcion(e.target.value)}
                placeholder="Descripción opcional"
                data-testid="input-descripcion-campana"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCampaignDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleCreateCampaign}
              disabled={createCampaignMutation.isPending}
              data-testid="button-crear-campana"
            >
              {createCampaignMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creando...
                </>
              ) : (
                'Crear Campaña'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Keyword Dialog */}
      <Dialog open={keywordDialogOpen} onOpenChange={setKeywordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agregar Keyword</DialogTitle>
            <DialogDescription>
              Agrega una palabra clave para monitorear su posición en Google
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="keywordText">Palabra Clave *</Label>
              <Input
                id="keywordText"
                value={keywordText}
                onChange={(e) => setKeywordText(e.target.value)}
                placeholder="Ej: pinturas chile"
                data-testid="input-keyword"
              />
            </div>
            <div>
              <Label htmlFor="keywordUrl">URL Objetivo (opcional)</Label>
              <Input
                id="keywordUrl"
                value={keywordUrl}
                onChange={(e) => setKeywordUrl(e.target.value)}
                placeholder="Ej: /productos/pinturas"
                data-testid="input-url-keyword"
              />
            </div>
            <div>
              <Label htmlFor="keywordUbicacion">Ubicación</Label>
              <Select value={keywordUbicacion} onValueChange={setKeywordUbicacion}>
                <SelectTrigger data-testid="select-ubicacion">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Chile">Chile</SelectItem>
                  <SelectItem value="Santiago, Chile">Santiago</SelectItem>
                  <SelectItem value="Valparaiso, Chile">Valparaíso</SelectItem>
                  <SelectItem value="Concepcion, Chile">Concepción</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-sm text-muted-foreground">
              Se analizará automáticamente la posición en Desktop y Mobile
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setKeywordDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleCreateKeyword}
              disabled={createKeywordMutation.isPending}
              data-testid="button-crear-keyword"
            >
              {createKeywordMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Agregando...
                </>
              ) : (
                'Agregar Keyword'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface Competidor {
  id: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ProductoMonitoreo {
  id: string;
  nombreProducto: string;
  precioListaGL: string | null;
  precioLista14: string | null;
  precioListaBalde4: string | null;
  precioListaBalde5: string | null;
  activo: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

interface PrecioCompetencia {
  id: string;
  productoMonitoreoId: string;
  competidorId: string;
  formato: string | null;
  precioWeb: string | null;
  precioFerreteria: string | null;
  precioConstruccion: string | null;
  fechaRegistro: string;
  notas: string | null;
  urlReferencia: string | null;
  productoNombre: string;
  productoFormato: string | null;
  competidorNombre: string;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

function PreciosCompetencia({ userRole }: { userRole: string }) {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProducto, setSelectedProducto] = useState<ProductoMonitoreo | null>(null);
  const [productoDialogOpen, setProductoDialogOpen] = useState(false);
  const [precioDialogOpen, setPrecioDialogOpen] = useState(false);
  const [filtroFormato, setFiltroFormato] = useState<"TODOS" | "GL" | "14" | "BALDE4" | "BALDE5">("TODOS");
  const [competidorDialogOpen, setCompetidorDialogOpen] = useState(false);
  const [editingProducto, setEditingProducto] = useState<ProductoMonitoreo | null>(null);
  const [editingCompetidor, setEditingCompetidor] = useState<Competidor | null>(null);

  const [nuevoProducto, setNuevoProducto] = useState({
    nombreProducto: "",
    precioListaGL: "",
    precioLista14: "",
    precioListaBalde4: "",
    precioListaBalde5: "",
  });

  const [nuevoPrecio, setNuevoPrecio] = useState({
    productoMonitoreoId: "",
    competidorId: "",
    formato: "GL" as "GL" | "14" | "BALDE4" | "BALDE5",
    precioWeb: "",
    precioFerreteria: "",
    precioConstruccion: "",
    notas: "",
    urlReferencia: "",
  });

  const [nuevoCompetidor, setNuevoCompetidor] = useState({
    nombre: "",
    descripcion: "",
  });

  const { data: productos = [], isLoading: loadingProductos } = useQuery<ProductoMonitoreo[]>({
    queryKey: ["/api/marketing/productos-monitoreo"],
  });

  const { data: competidores = [], isLoading: loadingCompetidores } = useQuery<Competidor[]>({
    queryKey: ["/api/marketing/competidores"],
  });

  const { data: preciosProducto = [], isLoading: loadingPrecios, refetch: refetchPrecios } = useQuery<PrecioCompetencia[]>({
    queryKey: ["/api/marketing/productos-monitoreo", selectedProducto?.id, "precios"],
    enabled: !!selectedProducto,
  });

  const createProductoMutation = useMutation({
    mutationFn: async (data: typeof nuevoProducto) => {
      return await apiRequest("/api/marketing/productos-monitoreo", { method: "POST", data });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marketing/productos-monitoreo"] });
      toast({ title: "Producto creado", description: "El producto se agregó correctamente" });
      setProductoDialogOpen(false);
      setNuevoProducto({ nombreProducto: "", precioListaGL: "", precioLista14: "", precioListaBalde4: "", precioListaBalde5: "" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Error al crear producto", variant: "destructive" });
    },
  });

  const updateProductoMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof nuevoProducto }) => {
      return await apiRequest(`/api/marketing/productos-monitoreo/${id}`, { method: "PATCH", data });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marketing/productos-monitoreo"] });
      toast({ title: "Producto actualizado", description: "El producto se actualizó correctamente" });
      setProductoDialogOpen(false);
      setEditingProducto(null);
      setNuevoProducto({ nombreProducto: "", precioListaGL: "", precioLista14: "", precioListaBalde4: "", precioListaBalde5: "" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Error al actualizar producto", variant: "destructive" });
    },
  });

  const deleteProductoMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/marketing/productos-monitoreo/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marketing/productos-monitoreo"] });
      toast({ title: "Producto eliminado", description: "El producto se eliminó correctamente" });
      if (selectedProducto) setSelectedProducto(null);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Error al eliminar producto", variant: "destructive" });
    },
  });

  const createCompetidorMutation = useMutation({
    mutationFn: async (data: { nombre: string; descripcion: string }) => {
      return await apiRequest("/api/marketing/competidores", { method: "POST", data });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marketing/competidores"] });
      toast({ title: "Competidor creado", description: "El competidor se creó correctamente" });
      setCompetidorDialogOpen(false);
      setNuevoCompetidor({ nombre: "", descripcion: "" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Error al crear competidor", variant: "destructive" });
    },
  });

  const updateCompetidorMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { nombre: string; descripcion: string } }) => {
      return await apiRequest(`/api/marketing/competidores/${id}`, { method: "PATCH", data });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marketing/competidores"] });
      toast({ title: "Competidor actualizado", description: "El competidor se actualizó correctamente" });
      setCompetidorDialogOpen(false);
      setEditingCompetidor(null);
      setNuevoCompetidor({ nombre: "", descripcion: "" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Error al actualizar competidor", variant: "destructive" });
    },
  });

  const createPrecioMutation = useMutation({
    mutationFn: async (data: typeof nuevoPrecio) => {
      return await apiRequest("/api/marketing/precios-competencia", { method: "POST", data });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marketing/productos-monitoreo", selectedProducto?.id, "precios"] });
      toast({ title: "Precio registrado", description: "El precio de competencia se registró correctamente" });
      setPrecioDialogOpen(false);
      setNuevoPrecio({ productoMonitoreoId: "", competidorId: "", formato: "GL", precioWeb: "", precioFerreteria: "", precioConstruccion: "", notas: "", urlReferencia: "" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Error al registrar precio", variant: "destructive" });
    },
  });

  const deletePrecioMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/marketing/precios-competencia/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marketing/productos-monitoreo", selectedProducto?.id, "precios"] });
      toast({ title: "Precio eliminado", description: "El registro se eliminó correctamente" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Error al eliminar precio", variant: "destructive" });
    },
  });

  const handleEditProducto = (producto: ProductoMonitoreo) => {
    setEditingProducto(producto);
    setNuevoProducto({
      nombreProducto: producto.nombreProducto,
      precioListaGL: producto.precioListaGL || "",
      precioLista14: producto.precioLista14 || "",
      precioListaBalde4: producto.precioListaBalde4 || "",
      precioListaBalde5: producto.precioListaBalde5 || "",
    });
    setProductoDialogOpen(true);
  };

  const handleEditCompetidor = (competidor: Competidor) => {
    setEditingCompetidor(competidor);
    setNuevoCompetidor({
      nombre: competidor.nombre,
      descripcion: competidor.descripcion || "",
    });
    setCompetidorDialogOpen(true);
  };

  const handleSaveProducto = () => {
    if (!nuevoProducto.nombreProducto) {
      toast({ title: "Error", description: "El nombre del producto es obligatorio", variant: "destructive" });
      return;
    }
    if (editingProducto) {
      updateProductoMutation.mutate({ id: editingProducto.id, data: nuevoProducto });
    } else {
      createProductoMutation.mutate(nuevoProducto);
    }
  };

  const handleSaveCompetidor = () => {
    if (!nuevoCompetidor.nombre) {
      toast({ title: "Error", description: "El nombre es obligatorio", variant: "destructive" });
      return;
    }
    if (editingCompetidor) {
      updateCompetidorMutation.mutate({ id: editingCompetidor.id, data: nuevoCompetidor });
    } else {
      createCompetidorMutation.mutate(nuevoCompetidor);
    }
  };

  const handleAddPrecio = () => {
    if (!selectedProducto) return;
    setNuevoPrecio({
      productoMonitoreoId: selectedProducto.id,
      competidorId: "",
      formato: "GL",
      precioWeb: "",
      precioFerreteria: "",
      precioConstruccion: "",
      notas: "",
      urlReferencia: "",
    });
    setPrecioDialogOpen(true);
  };

  const handleSavePrecio = () => {
    if (!nuevoPrecio.competidorId) {
      toast({ title: "Error", description: "El competidor es obligatorio", variant: "destructive" });
      return;
    }
    createPrecioMutation.mutate(nuevoPrecio);
  };

  const formatPrice = (price: string | null) => {
    if (!price) return "-";
    const num = parseFloat(price);
    return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(num);
  };

  const filteredProductos = productos.filter(p => {
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      if (!p.nombreProducto.toLowerCase().includes(search)) {
        return false;
      }
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Precios de Competencia</h2>
          <p className="text-muted-foreground">Monitorea precios de productos propios vs competencia</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setEditingCompetidor(null);
              setNuevoCompetidor({ nombre: "", descripcion: "" });
              setCompetidorDialogOpen(true);
            }}
            data-testid="button-gestionar-competidores"
          >
            <Target className="mr-2 h-4 w-4" />
            Competidores
          </Button>
          <Button
            onClick={() => {
              setEditingProducto(null);
              setNuevoProducto({ nombreProducto: "", precioListaGL: "", precioLista14: "", precioListaBalde4: "", precioListaBalde5: "" });
              setProductoDialogOpen(true);
            }}
            data-testid="button-nuevo-producto"
          >
            <Plus className="mr-2 h-4 w-4" />
            Nuevo Producto
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Productos a Monitorear
              </CardTitle>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar producto..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-producto"
                />
              </div>
            </CardHeader>
            <CardContent>
              {loadingProductos ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : filteredProductos.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No hay productos registrados</p>
              ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {filteredProductos.map((p) => (
                    <div
                      key={p.id}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${selectedProducto?.id === p.id ? "border-primary bg-primary/5" : "hover:bg-muted"
                        }`}
                      onClick={() => setSelectedProducto(p)}
                      data-testid={`card-producto-${p.id}`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className="font-medium">{p.nombreProducto}</p>
                          <div className="flex gap-2 text-xs text-muted-foreground mt-1">
                            {p.precioListaGL && <span>GL: {formatPrice(p.precioListaGL)}</span>}
                            {p.precioLista14 && <span>1/4: {formatPrice(p.precioLista14)}</span>}
                          </div>
                        </div>
                        <div className="text-right text-xs text-muted-foreground">
                          {p.precioListaBalde4 && <div>B4: {formatPrice(p.precioListaBalde4)}</div>}
                          {p.precioListaBalde5 && <div>B5: {formatPrice(p.precioListaBalde5)}</div>}
                        </div>
                      </div>
                      <div className="flex gap-1 mt-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); handleEditProducto(p); }}
                          data-testid={`button-edit-producto-${p.id}`}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-500"
                              onClick={(e) => e.stopPropagation()}
                              data-testid={`button-delete-producto-${p.id}`}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Eliminar Producto</AlertDialogTitle>
                              <AlertDialogDescription>
                                ¿Eliminar "{p.nombreProducto}"? Esto también eliminará todos sus precios de competencia.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteProductoMutation.mutate(p.id)}>
                                Eliminar
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Target className="h-4 w-4" />
                Competidores ({competidores.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingCompetidores ? (
                <div className="flex justify-center py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              ) : competidores.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-2">No hay competidores</p>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {competidores.map((c) => (
                    <Badge
                      key={c.id}
                      variant="secondary"
                      className="cursor-pointer hover:bg-secondary/80"
                      onClick={() => handleEditCompetidor(c)}
                    >
                      {c.nombre}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          {selectedProducto ? (
            <Card>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>{selectedProducto.nombreProducto}</CardTitle>
                    <CardDescription>
                      <div className="flex flex-wrap gap-3 mt-1">
                        {selectedProducto.precioListaGL && <span>GL: <span className="font-semibold text-primary">{formatPrice(selectedProducto.precioListaGL)}</span></span>}
                        {selectedProducto.precioLista14 && <span>1/4: <span className="font-semibold text-primary">{formatPrice(selectedProducto.precioLista14)}</span></span>}
                        {selectedProducto.precioListaBalde4 && <span>B4GL: <span className="font-semibold text-primary">{formatPrice(selectedProducto.precioListaBalde4)}</span></span>}
                        {selectedProducto.precioListaBalde5 && <span>B5GL: <span className="font-semibold text-primary">{formatPrice(selectedProducto.precioListaBalde5)}</span></span>}
                      </div>
                    </CardDescription>
                  </div>
                  <Button onClick={handleAddPrecio} data-testid="button-agregar-precio">
                    <Plus className="mr-2 h-4 w-4" />
                    Agregar Precio Competidor
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loadingPrecios ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : preciosProducto.length === 0 ? (
                  <div className="text-center py-8">
                    <TrendingUp className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No hay precios de competencia registrados</p>
                    <p className="text-sm text-muted-foreground mt-1">Agrega precios de competidores para comparar</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex gap-2 flex-wrap">
                      <Button
                        variant={filtroFormato === "TODOS" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setFiltroFormato("TODOS")}
                      >
                        Todos
                      </Button>
                      <Button
                        variant={filtroFormato === "GL" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setFiltroFormato("GL")}
                      >
                        Galón
                      </Button>
                      <Button
                        variant={filtroFormato === "14" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setFiltroFormato("14")}
                      >
                        1/4 Galón
                      </Button>
                      <Button
                        variant={filtroFormato === "BALDE4" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setFiltroFormato("BALDE4")}
                      >
                        Balde 4GL
                      </Button>
                      <Button
                        variant={filtroFormato === "BALDE5" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setFiltroFormato("BALDE5")}
                      >
                        Balde 5GL
                      </Button>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Competidor</TableHead>
                          <TableHead>Formato</TableHead>
                          <TableHead className="text-right">Precio Web</TableHead>
                          <TableHead className="text-right">Precio Ferretería</TableHead>
                          <TableHead className="text-right">Precio Construcción</TableHead>
                          <TableHead>Fecha</TableHead>
                          <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {preciosProducto
                          .filter(p => filtroFormato === "TODOS" || p.formato === filtroFormato)
                          .map((p) => {
                            const formatoLabel = p.formato === "GL" ? "Galón" : p.formato === "14" ? "1/4 Galón" : p.formato === "BALDE4" ? "Balde 4GL" : p.formato === "BALDE5" ? "Balde 5GL" : p.formato || "-";
                            return (
                              <TableRow key={p.id} data-testid={`row-precio-${p.id}`}>
                                <TableCell>
                                  <Badge variant="outline">{p.competidorNombre}</Badge>
                                </TableCell>
                                <TableCell>
                                  <Badge variant="secondary">{formatoLabel}</Badge>
                                </TableCell>
                                <TableCell className="text-right font-medium">
                                  {formatPrice(p.precioWeb)}
                                </TableCell>
                                <TableCell className="text-right">
                                  {formatPrice(p.precioFerreteria)}
                                </TableCell>
                                <TableCell className="text-right">
                                  {formatPrice(p.precioConstruccion)}
                                </TableCell>
                                <TableCell>
                                  {format(new Date(p.fechaRegistro), "dd/MM/yyyy", { locale: es })}
                                  {p.urlReferencia && (
                                    <a
                                      href={p.urlReferencia}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="ml-2 inline-flex items-center text-blue-500 hover:text-blue-700"
                                    >
                                      <ExternalLink className="h-3 w-3" />
                                    </a>
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  {(userRole === 'admin' || userRole === 'supervisor') && (
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="text-red-500 hover:text-red-700"
                                          data-testid={`button-delete-precio-${p.id}`}
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent>
                                        <AlertDialogHeader>
                                          <AlertDialogTitle>Eliminar Precio</AlertDialogTitle>
                                          <AlertDialogDescription>
                                            ¿Eliminar este registro de precio?
                                          </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                          <AlertDialogAction onClick={() => deletePrecioMutation.mutate(p.id)}>
                                            Eliminar
                                          </AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Package className="h-16 w-16 text-muted-foreground mb-4" />
                <p className="text-xl font-medium text-muted-foreground">Selecciona un producto</p>
                <p className="text-sm text-muted-foreground mt-1">Elige un producto de la lista para ver y agregar precios de competencia</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Dialog open={productoDialogOpen} onOpenChange={setProductoDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingProducto ? "Editar Producto" : "Nuevo Producto a Monitorear"}</DialogTitle>
            <DialogDescription>
              {editingProducto ? "Modifica los datos del producto" : "Agrega un producto para comparar precios con la competencia"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nombre del Producto *</Label>
              <Input
                value={nuevoProducto.nombreProducto}
                onChange={(e) => setNuevoProducto({ ...nuevoProducto, nombreProducto: e.target.value })}
                placeholder="Ej: Esmalte al agua blanco"
                data-testid="input-producto-nombre"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Precio Galón (GL)</Label>
                <Input
                  type="number"
                  value={nuevoProducto.precioListaGL}
                  onChange={(e) => setNuevoProducto({ ...nuevoProducto, precioListaGL: e.target.value })}
                  placeholder="0"
                  data-testid="input-producto-precio-gl"
                />
              </div>
              <div>
                <Label>Precio 1/4 Galón</Label>
                <Input
                  type="number"
                  value={nuevoProducto.precioLista14}
                  onChange={(e) => setNuevoProducto({ ...nuevoProducto, precioLista14: e.target.value })}
                  placeholder="0"
                  data-testid="input-producto-precio-14"
                />
              </div>
              <div>
                <Label>Precio Balde (4 GL)</Label>
                <Input
                  type="number"
                  value={nuevoProducto.precioListaBalde4}
                  onChange={(e) => setNuevoProducto({ ...nuevoProducto, precioListaBalde4: e.target.value })}
                  placeholder="0"
                  data-testid="input-producto-precio-balde4"
                />
              </div>
              <div>
                <Label>Precio Balde (5 GL)</Label>
                <Input
                  type="number"
                  value={nuevoProducto.precioListaBalde5}
                  onChange={(e) => setNuevoProducto({ ...nuevoProducto, precioListaBalde5: e.target.value })}
                  placeholder="0"
                  data-testid="input-producto-precio-balde5"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProductoDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSaveProducto}
              disabled={createProductoMutation.isPending || updateProductoMutation.isPending}
              data-testid="button-guardar-producto"
            >
              {(createProductoMutation.isPending || updateProductoMutation.isPending) ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                editingProducto ? "Actualizar" : "Crear"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={precioDialogOpen} onOpenChange={setPrecioDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Precio de Competencia</DialogTitle>
            <DialogDescription>
              Agrega el precio de un competidor para "{selectedProducto?.nombreProducto}"
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Competidor *</Label>
                <div className="flex gap-2">
                  <Select
                    value={nuevoPrecio.competidorId}
                    onValueChange={(v) => setNuevoPrecio({ ...nuevoPrecio, competidorId: v })}
                  >
                    <SelectTrigger data-testid="select-precio-competidor" className="flex-1">
                      <SelectValue placeholder="Seleccionar competidor..." />
                    </SelectTrigger>
                    <SelectContent>
                      {competidores.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setCompetidorDialogOpen(true)}
                    title="Agregar nuevo competidor"
                    data-testid="button-add-competidor-inline"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div>
                <Label>Formato *</Label>
                <Select
                  value={nuevoPrecio.formato}
                  onValueChange={(v: "GL" | "14" | "BALDE4" | "BALDE5") => setNuevoPrecio({ ...nuevoPrecio, formato: v })}
                >
                  <SelectTrigger data-testid="select-precio-formato">
                    <SelectValue placeholder="Seleccionar formato..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GL">Galón (GL)</SelectItem>
                    <SelectItem value="14">1/4 Galón</SelectItem>
                    <SelectItem value="BALDE4">Balde 4 GL</SelectItem>
                    <SelectItem value="BALDE5">Balde 5 GL</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Precio Web</Label>
                <Input
                  type="number"
                  value={nuevoPrecio.precioWeb}
                  onChange={(e) => setNuevoPrecio({ ...nuevoPrecio, precioWeb: e.target.value })}
                  placeholder="0"
                  data-testid="input-precio-web"
                />
              </div>
              <div>
                <Label>Precio Ferretería</Label>
                <Input
                  type="number"
                  value={nuevoPrecio.precioFerreteria}
                  onChange={(e) => setNuevoPrecio({ ...nuevoPrecio, precioFerreteria: e.target.value })}
                  placeholder="0"
                  data-testid="input-precio-ferreteria"
                />
              </div>
              <div>
                <Label>Precio Construcción</Label>
                <Input
                  type="number"
                  value={nuevoPrecio.precioConstruccion}
                  onChange={(e) => setNuevoPrecio({ ...nuevoPrecio, precioConstruccion: e.target.value })}
                  placeholder="0"
                  data-testid="input-precio-construccion"
                />
              </div>
            </div>
            <div>
              <Label>URL de Referencia</Label>
              <Input
                value={nuevoPrecio.urlReferencia}
                onChange={(e) => setNuevoPrecio({ ...nuevoPrecio, urlReferencia: e.target.value })}
                placeholder="https://..."
                data-testid="input-precio-url"
              />
            </div>
            <div>
              <Label>Notas</Label>
              <Textarea
                value={nuevoPrecio.notas}
                onChange={(e) => setNuevoPrecio({ ...nuevoPrecio, notas: e.target.value })}
                placeholder="Observaciones adicionales..."
                rows={2}
                data-testid="input-precio-notas"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPrecioDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSavePrecio}
              disabled={createPrecioMutation.isPending}
              data-testid="button-guardar-precio"
            >
              {createPrecioMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : "Registrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={competidorDialogOpen} onOpenChange={setCompetidorDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCompetidor ? "Editar Competidor" : "Nuevo Competidor"}</DialogTitle>
            <DialogDescription>
              {editingCompetidor ? "Modifica los datos del competidor" : "Agrega un nuevo competidor para monitorear"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nombre *</Label>
              <Input
                value={nuevoCompetidor.nombre}
                onChange={(e) => setNuevoCompetidor({ ...nuevoCompetidor, nombre: e.target.value })}
                placeholder="Ej: Sherwin Williams"
                data-testid="input-competidor-nombre"
              />
            </div>
            <div>
              <Label>Descripción</Label>
              <Textarea
                value={nuevoCompetidor.descripcion}
                onChange={(e) => setNuevoCompetidor({ ...nuevoCompetidor, descripcion: e.target.value })}
                placeholder="Información adicional..."
                rows={2}
                data-testid="input-competidor-descripcion"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompetidorDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSaveCompetidor}
              disabled={createCompetidorMutation.isPending || updateCompetidorMutation.isPending}
              data-testid="button-guardar-competidor"
            >
              {(createCompetidorMutation.isPending || updateCompetidorMutation.isPending) ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                editingCompetidor ? "Actualizar" : "Crear"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
