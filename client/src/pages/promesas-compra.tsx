import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { format, startOfWeek, endOfWeek, getISOWeek, getYear, addWeeks, subWeeks, startOfMonth } from "date-fns";
import { es } from "date-fns/locale";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Calendar, TrendingUp, TrendingDown, CheckCircle, XCircle, Loader2, Search, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";

function getWeekOfMonth(date: Date): number {
  const firstDayOfMonth = startOfMonth(date);
  const firstWeekStart = startOfWeek(firstDayOfMonth, { weekStartsOn: 1 });
  const currentWeekStart = startOfWeek(date, { weekStartsOn: 1 });
  
  const weeksDiff = Math.floor((currentWeekStart.getTime() - firstWeekStart.getTime()) / (7 * 24 * 60 * 60 * 1000));
  
  return weeksDiff + 1;
}

function getWeekRangeInMonth(date: Date): { start: Date; end: Date } {
  let weekStart = startOfWeek(date, { weekStartsOn: 1 });
  let weekEnd = endOfWeek(date, { weekStartsOn: 1 });
  
  const currentMonth = date.getMonth();
  const lastDayOfMonth = new Date(date.getFullYear(), currentMonth + 1, 0);
  
  if (weekEnd.getMonth() !== currentMonth) {
    weekEnd = lastDayOfMonth;
  }
  
  return { start: weekStart, end: weekEnd };
}

interface PromesaCompra {
  id: string;
  vendedorId: string;
  clienteId: string;
  clienteNombre: string;
  montoPrometido: string;
  semana: string;
  anio: number;
  numeroSemana: number;
  fechaInicio: Date;
  fechaFin: Date;
  observaciones: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface PromesaCumplimiento {
  promesa: PromesaCompra;
  ventasReales: number;
  cumplimiento: number;
  estado: 'cumplido' | 'superado' | 'no_cumplido';
  canDelete: boolean;
}

interface Cliente {
  id: string;
  nokoen: string;
  koen: string;
}

export default function PromesasCompraPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [searchClient, setSearchClient] = useState("");
  const [selectedWeek, setSelectedWeek] = useState(new Date());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [promesaToDelete, setPromesaToDelete] = useState<string | null>(null);
  const currentWeek = `${getYear(selectedWeek)}-${String(getISOWeek(selectedWeek)).padStart(2, '0')}`;
  const currentYear = getYear(selectedWeek);
  
  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest('DELETE', `/api/promesas-compra/${id}`);
    },
    onSuccess: () => {
      toast({
        title: "Promesa eliminada",
        description: "La promesa de compra ha sido eliminada correctamente",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/promesas-compra/cumplimiento/reporte', currentYear, currentWeek] });
      setDeleteDialogOpen(false);
      setPromesaToDelete(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo eliminar la promesa de compra",
        variant: "destructive",
      });
    },
  });

  // Query para obtener clientes (same as tomador-pedidos)
  const { data: clientsData } = useQuery({
    queryKey: ['/api/clients', { search: searchClient }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchClient) params.set('search', searchClient);
      params.set('limit', '50');
      params.set('offset', '0');
      
      const response = await fetch(`/api/clients?${params}`, { credentials: 'include' });
      if (!response.ok) {
        throw new Error('Failed to fetch clients');
      }
      return response.json() as Promise<{
        clients: Cliente[];
        totalCount: number;
        currentPage: number;
        totalPages: number;
      }>;
    },
    enabled: searchClient.length >= 2,
  });

  // Extract clients array from response
  const clientes = clientsData?.clients || [];

  // Query para obtener promesas con cumplimiento
  const { data: promesasCumplimiento = [], isLoading } = useQuery<PromesaCumplimiento[]>({
    queryKey: ['/api/promesas-compra/cumplimiento/reporte', currentYear, currentWeek],
    queryFn: async () => {
      const response = await fetch(`/api/promesas-compra/cumplimiento/reporte?anio=${currentYear}&semana=${currentWeek}`, {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Failed to fetch promesas');
      }
      return response.json();
    },
    enabled: !!user,
  });

  // Calcular resumen
  const resumen = {
    totalPromesas: promesasCumplimiento.length,
    totalPrometido: promesasCumplimiento.reduce((sum, p) => sum + parseFloat(p.promesa.montoPrometido), 0),
    totalVendido: promesasCumplimiento.reduce((sum, p) => sum + p.ventasReales, 0),
    cumplidas: promesasCumplimiento.filter(p => p.estado === 'cumplido').length,
    superadas: promesasCumplimiento.filter(p => p.estado === 'superado').length,
    noCumplidas: promesasCumplimiento.filter(p => p.estado === 'no_cumplido').length,
  };

  const goToPreviousWeek = () => {
    setSelectedWeek(prev => subWeeks(prev, 1));
  };

  const goToNextWeek = () => {
    setSelectedWeek(prev => addWeeks(prev, 1));
  };

  const goToCurrentWeek = () => {
    setSelectedWeek(new Date());
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Promesas de Compra Semanales</h1>
          <p className="text-muted-foreground mt-1">
            Registra compromisos de compra y compara con ventas reales
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)} data-testid="button-nueva-promesa">
          <Plus className="mr-2 h-4 w-4" />
          Nueva Promesa
        </Button>
      </div>

      {/* Selector de semana */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Selección de Semana</CardTitle>
              <CardDescription>
                Semana {getWeekOfMonth(selectedWeek)} de {format(selectedWeek, 'MMMM yyyy', { locale: es })} ({format(getWeekRangeInMonth(selectedWeek).start, 'dd MMM', { locale: es })} - {format(getWeekRangeInMonth(selectedWeek).end, 'dd MMM', { locale: es })})
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={goToPreviousWeek} data-testid="button-semana-anterior">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={goToCurrentWeek} data-testid="button-semana-actual">
                Hoy
              </Button>
              <Button variant="outline" size="sm" onClick={goToNextWeek} data-testid="button-semana-siguiente">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Resumen de cumplimiento */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Prometido</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${resumen.totalPrometido.toLocaleString('es-CL')}</div>
            <p className="text-xs text-muted-foreground mt-1">{resumen.totalPromesas} promesas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Vendido</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${resumen.totalVendido.toLocaleString('es-CL')}</div>
            <p className="text-xs text-muted-foreground mt-1">Facturas + NVV</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Cumplidas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{resumen.cumplidas + resumen.superadas}</div>
            <p className="text-xs text-muted-foreground mt-1">{resumen.superadas} superadas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">No Cumplidas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{resumen.noCumplidas}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {resumen.totalPromesas > 0 ? Math.round((resumen.noCumplidas / resumen.totalPromesas) * 100) : 0}% del total
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Lista de promesas con cumplimiento */}
      <Card>
        <CardHeader>
          <CardTitle>Detalle de Promesas</CardTitle>
          <CardDescription>Comparación de compromisos vs. ventas reales</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : promesasCumplimiento.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No hay promesas registradas para esta semana</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Desktop view */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-medium">Cliente</th>
                      <th className="text-right py-3 px-4 font-medium">Prometido</th>
                      <th className="text-right py-3 px-4 font-medium">Vendido</th>
                      <th className="text-right py-3 px-4 font-medium">Cumplimiento</th>
                      <th className="text-center py-3 px-4 font-medium">Estado</th>
                      <th className="text-left py-3 px-4 font-medium">Observaciones</th>
                      <th className="text-center py-3 px-4 font-medium">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {promesasCumplimiento.map((item) => (
                      <tr key={item.promesa.id} className="border-b hover:bg-muted/50" data-testid={`row-promesa-${item.promesa.id}`}>
                        <td className="py-3 px-4 font-medium">{item.promesa.clienteNombre}</td>
                        <td className="text-right py-3 px-4">${parseFloat(item.promesa.montoPrometido).toLocaleString('es-CL')}</td>
                        <td className="text-right py-3 px-4">${item.ventasReales.toLocaleString('es-CL')}</td>
                        <td className="text-right py-3 px-4">
                          <div className="flex items-center justify-end gap-2">
                            <span className={item.cumplimiento >= 100 ? 'text-green-600 font-semibold' : item.cumplimiento >= 70 ? 'text-yellow-600' : 'text-red-600'}>
                              {item.cumplimiento.toFixed(1)}%
                            </span>
                            {item.cumplimiento >= 100 ? (
                              <TrendingUp className="h-4 w-4 text-green-600" />
                            ) : (
                              <TrendingDown className="h-4 w-4 text-red-600" />
                            )}
                          </div>
                        </td>
                        <td className="text-center py-3 px-4">
                          {item.estado === 'superado' && (
                            <Badge className="bg-green-500 text-white">
                              <CheckCircle className="mr-1 h-3 w-3" />
                              Superado
                            </Badge>
                          )}
                          {item.estado === 'cumplido' && (
                            <Badge className="bg-blue-500 text-white">
                              <CheckCircle className="mr-1 h-3 w-3" />
                              Cumplido
                            </Badge>
                          )}
                          {item.estado === 'no_cumplido' && (
                            <Badge variant="destructive">
                              <XCircle className="mr-1 h-3 w-3" />
                              No Cumplido
                            </Badge>
                          )}
                        </td>
                        <td className="py-3 px-4 text-sm text-muted-foreground">{item.promesa.observaciones || '-'}</td>
                        <td className="py-3 px-4">
                          {item.canDelete && (
                            <div className="flex justify-center">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setPromesaToDelete(item.promesa.id);
                                  setDeleteDialogOpen(true);
                                }}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                data-testid={`button-delete-${item.promesa.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile view */}
              <div className="lg:hidden space-y-4">
                {promesasCumplimiento.map((item) => (
                  <Card key={item.promesa.id} data-testid={`card-promesa-${item.promesa.id}`}>
                    <CardContent className="pt-6">
                      <div className="space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-semibold">{item.promesa.clienteNombre}</p>
                            {item.promesa.observaciones && (
                              <p className="text-sm text-muted-foreground mt-1">{item.promesa.observaciones}</p>
                            )}
                          </div>
                          {item.estado === 'superado' && (
                            <Badge className="bg-green-500 text-white">
                              <CheckCircle className="mr-1 h-3 w-3" />
                              Superado
                            </Badge>
                          )}
                          {item.estado === 'cumplido' && (
                            <Badge className="bg-blue-500 text-white">
                              <CheckCircle className="mr-1 h-3 w-3" />
                              Cumplido
                            </Badge>
                          )}
                          {item.estado === 'no_cumplido' && (
                            <Badge variant="destructive">
                              <XCircle className="mr-1 h-3 w-3" />
                              No Cumplido
                            </Badge>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs text-muted-foreground">Prometido</p>
                            <p className="text-lg font-semibold">${parseFloat(item.promesa.montoPrometido).toLocaleString('es-CL')}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Vendido</p>
                            <p className="text-lg font-semibold">${item.ventasReales.toLocaleString('es-CL')}</p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t">
                          <span className="text-sm text-muted-foreground">Cumplimiento</span>
                          <div className="flex items-center gap-2">
                            <span className={`text-lg font-semibold ${item.cumplimiento >= 100 ? 'text-green-600' : item.cumplimiento >= 70 ? 'text-yellow-600' : 'text-red-600'}`}>
                              {item.cumplimiento.toFixed(1)}%
                            </span>
                            {item.cumplimiento >= 100 ? (
                              <TrendingUp className="h-5 w-5 text-green-600" />
                            ) : (
                              <TrendingDown className="h-5 w-5 text-red-600" />
                            )}
                          </div>
                        </div>
                        
                        {/* Botón eliminar en mobile */}
                        {item.canDelete && (
                          <div className="pt-3 border-t">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setPromesaToDelete(item.promesa.id);
                                setDeleteDialogOpen(true);
                              }}
                              className="w-full text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                              data-testid={`button-delete-mobile-${item.promesa.id}`}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Eliminar promesa
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog para crear promesa */}
      <CreatePromesaDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        selectedWeek={selectedWeek}
        clientes={clientes}
        searchClient={searchClient}
        setSearchClient={setSearchClient}
      />
      
      {/* Dialog de confirmación para eliminar */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar promesa de compra?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. La promesa de compra será eliminada permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setDeleteDialogOpen(false);
              setPromesaToDelete(null);
            }}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (promesaToDelete) {
                  deleteMutation.mutate(promesaToDelete);
                }
              }}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Eliminando...
                </>
              ) : (
                'Eliminar'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Dialog para crear promesa
function CreatePromesaDialog({
  open,
  onOpenChange,
  selectedWeek,
  clientes,
  searchClient,
  setSearchClient,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedWeek: Date;
  clientes: Cliente[];
  searchClient: string;
  setSearchClient: (value: string) => void;
}) {
  const { toast } = useToast();
  const [selectedClient, setSelectedClient] = useState<Cliente | null>(null);
  const [montoPrometido, setMontoPrometido] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [isManualEntry, setIsManualEntry] = useState(false);
  const [manualClienteNombre, setManualClienteNombre] = useState("");
  const [manualClienteId, setManualClienteId] = useState("");

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest('POST', '/api/promesas-compra', data);
    },
    onSuccess: () => {
      // Invalidate all promesas queries with a prefix match
      queryClient.invalidateQueries({ 
        queryKey: ['/api/promesas-compra'],
        refetchType: 'all'
      });
      queryClient.invalidateQueries({ 
        queryKey: ['/api/promesas-compra/cumplimiento/reporte'],
        refetchType: 'all'
      });
      toast({
        title: "Promesa creada",
        description: "La promesa de compra se ha registrado correctamente",
      });
      onOpenChange(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo crear la promesa",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setSelectedClient(null);
    setMontoPrometido("");
    setObservaciones("");
    setSearchClient("");
    setIsManualEntry(false);
    setManualClienteNombre("");
    setManualClienteId("");
  };

  const handleSubmit = () => {
    // Validar según el modo de entrada
    if (isManualEntry) {
      if (!manualClienteNombre.trim() || !montoPrometido) {
        toast({
          title: "Error",
          description: "Por favor complete todos los campos requeridos (nombre del cliente y monto)",
          variant: "destructive",
        });
        return;
      }
    } else {
      if (!selectedClient || !montoPrometido) {
        toast({
          title: "Error",
          description: "Por favor seleccione un cliente y complete el monto",
          variant: "destructive",
        });
        return;
      }
    }

    const { start: weekStart, end: weekEnd } = getWeekRangeInMonth(selectedWeek);
    const weekNumber = getISOWeek(selectedWeek);
    const year = getYear(selectedWeek);

    createMutation.mutate({
      clienteId: isManualEntry ? (manualClienteId.trim() || 'MANUAL') : selectedClient!.koen,
      clienteNombre: isManualEntry ? manualClienteNombre.trim() : selectedClient!.nokoen,
      clienteTipo: "activo", // CRÍTICO: Campo requerido por el schema
      montoPrometido: parseFloat(montoPrometido),
      semana: `${year}-${String(weekNumber).padStart(2, '0')}`,
      anio: year,
      numeroSemana: weekNumber,
      fechaInicio: format(weekStart, 'yyyy-MM-dd'),
      fechaFin: format(weekEnd, 'yyyy-MM-dd'),
      observaciones: observaciones || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto" data-testid="dialog-crear-promesa">
        <DialogHeader>
          <DialogTitle>Nueva Promesa de Compra</DialogTitle>
          <DialogDescription>
            Registra un compromiso de compra para la semana {getWeekOfMonth(selectedWeek)} de {format(selectedWeek, 'MMMM yyyy', { locale: es })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Selector de cliente */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Cliente *</Label>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => {
                  setIsManualEntry(!isManualEntry);
                  setSelectedClient(null);
                  setSearchClient("");
                  setManualClienteNombre("");
                  setManualClienteId("");
                }}
                data-testid="button-toggle-manual"
              >
                {isManualEntry ? 'Buscar en lista' : 'Ingreso manual'}
              </Button>
            </div>
            
            {isManualEntry ? (
              <div className="space-y-3 mt-2">
                <div>
                  <Label htmlFor="manualNombre">Nombre del Cliente *</Label>
                  <Input
                    id="manualNombre"
                    placeholder="Ingrese el nombre del cliente"
                    value={manualClienteNombre}
                    onChange={(e) => setManualClienteNombre(e.target.value)}
                    className="mt-1"
                    data-testid="input-manual-nombre"
                  />
                </div>
                <div>
                  <Label htmlFor="manualCodigo">Código del Cliente (Opcional)</Label>
                  <Input
                    id="manualCodigo"
                    placeholder="Ej: CLI001"
                    value={manualClienteId}
                    onChange={(e) => setManualClienteId(e.target.value)}
                    className="mt-1"
                    data-testid="input-manual-codigo"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Si no tiene código, se asignará automáticamente</p>
                </div>
              </div>
            ) : selectedClient ? (
              <div className="flex items-center gap-2 mt-2">
                <div className="flex-1 p-2 border rounded bg-muted">
                  <p className="font-medium">{selectedClient.nokoen}</p>
                  <p className="text-sm text-muted-foreground">Código: {selectedClient.koen}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setSelectedClient(null)}>
                  Cambiar
                </Button>
              </div>
            ) : (
              <>
                <div className="relative mt-2">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar cliente..."
                    value={searchClient}
                    onChange={(e) => setSearchClient(e.target.value)}
                    className="pl-8"
                    data-testid="input-buscar-cliente"
                  />
                </div>
                {clientes.length > 0 && (
                  <div className="mt-2 max-h-48 overflow-y-auto border rounded">
                    {clientes.map((cliente) => (
                      <button
                        key={cliente.id}
                        onClick={() => setSelectedClient(cliente)}
                        className="w-full text-left p-2 hover:bg-muted transition-colors"
                        data-testid={`button-seleccionar-cliente-${cliente.koen}`}
                      >
                        <p className="font-medium">{cliente.nokoen}</p>
                        <p className="text-sm text-muted-foreground">Código: {cliente.koen}</p>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Monto prometido */}
          <div>
            <Label htmlFor="monto">Monto Prometido *</Label>
            <Input
              id="monto"
              type="number"
              placeholder="Ej: 1500000"
              value={montoPrometido}
              onChange={(e) => setMontoPrometido(e.target.value)}
              className="mt-2"
              data-testid="input-monto-prometido"
            />
          </div>

          {/* Observaciones */}
          <div>
            <Label htmlFor="observaciones">Observaciones</Label>
            <Textarea
              id="observaciones"
              placeholder="Notas adicionales (opcional)"
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              className="mt-2"
              data-testid="textarea-observaciones"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancelar">
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={createMutation.isPending} data-testid="button-guardar-promesa">
            {createMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Guardando...
              </>
            ) : (
              'Guardar Promesa'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
