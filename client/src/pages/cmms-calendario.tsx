import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowLeft, ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, Wrench, CheckCircle2 } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths, parseISO } from "date-fns";
import { es } from "date-fns/locale";

interface PlanPreventivo {
  id: string;
  equipoId: string;
  nombrePlan: string;
  descripcion?: string;
  tareasPreventivas?: string;
  proximaEjecucion: string;
  frecuencia: string;
  activo: boolean;
  equipo?: {
    nombre: string;
    area: string | null;
  };
}

interface Mantencion {
  id: string;
  equipoNombre: string;
  equipoCodigo?: string;
  estado: string;
  gravedad: string;
  tipoMantencion: string;
  createdAt: string;
  area: string;
  descripcionProblema: string;
  checklistTareas?: string;
  tecnicoAsignadoName?: string;
  proveedorAsignadoName?: string;
  tipoAsignacion?: string;
  fechaProgramada?: string;
  ubicacion?: string;
}

interface CalendarioEvento {
  id: string;
  tipo: 'plan' | 'ot';
  titulo: string;
  fecha: Date;
  estado?: string;
  gravedad?: string;
  frecuencia?: string;
  area?: string;
  data: PlanPreventivo | Mantencion;
}

export default function CMmsCalendario() {
  const [, setLocation] = useLocation();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [filterTipo, setFilterTipo] = useState<string>("all");
  const [selectedEvento, setSelectedEvento] = useState<CalendarioEvento | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Fetch planes preventivos
  const { data: planes = [] } = useQuery<PlanPreventivo[]>({
    queryKey: ["/api/cmms/planes-preventivos"],
  });

  // Fetch mantenciones
  const { data: mantenciones = [] } = useQuery<Mantencion[]>({
    queryKey: ["/api/mantenciones"],
  });

  // Get start and end of current month
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Get day of week for first day (0 = Sunday, 6 = Saturday)
  const firstDayOfWeek = monthStart.getDay();

  // Create calendar events
  const eventos: CalendarioEvento[] = [
    ...planes
      .filter(p => p.activo)
      .map(p => ({
        id: `plan-${p.id}`,
        tipo: 'plan' as const,
        titulo: p.nombrePlan,
        fecha: parseISO(p.proximaEjecucion),
        frecuencia: p.frecuencia,
        area: p.equipo?.area || undefined,
        data: p,
      })),
    ...mantenciones
      .filter(m => m.estado !== 'cerrado')
      .map(m => ({
        id: `ot-${m.id}`,
        tipo: 'ot' as const,
        titulo: m.equipoNombre,
        fecha: parseISO(m.createdAt),
        estado: m.estado,
        gravedad: m.gravedad,
        area: m.area,
        data: m,
      })),
  ];

  // Filter events by type
  const filteredEventos = filterTipo === "all" 
    ? eventos 
    : eventos.filter(e => e.tipo === filterTipo);

  // Get events for a specific day
  const getEventosForDay = (day: Date) => {
    return filteredEventos.filter(evento => isSameDay(evento.fecha, day));
  };

  const handlePreviousMonth = () => {
    setCurrentDate(subMonths(currentDate, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(addMonths(currentDate, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const handleEventClick = (evento: CalendarioEvento) => {
    setSelectedEvento(evento);
    setDialogOpen(true);
  };

  const getEventoBadgeColor = (evento: CalendarioEvento) => {
    if (evento.tipo === 'plan') {
      return 'bg-blue-500 hover:bg-blue-600 text-white';
    }
    // OT badges based on gravedad
    switch (evento.gravedad) {
      case 'critica':
        return 'bg-red-500 hover:bg-red-600 text-white';
      case 'alta':
        return 'bg-orange-500 hover:bg-orange-600 text-white';
      case 'media':
        return 'bg-yellow-500 hover:bg-yellow-600 text-white';
      default:
        return 'bg-gray-500 hover:bg-gray-600 text-white';
    }
  };

  const getEstadoIcon = (estado?: string) => {
    switch (estado) {
      case 'registrado':
        return <Clock className="h-3 w-3" />;
      case 'en_reparacion':
        return <Wrench className="h-3 w-3" />;
      case 'resuelto':
        return <CheckCircle2 className="h-3 w-3" />;
      default:
        return <CalendarIcon className="h-3 w-3" />;
    }
  };

  const totalEventos = filteredEventos.filter(e => 
    isSameMonth(e.fecha, currentDate)
  ).length;

  const planesCount = filteredEventos.filter(e => 
    e.tipo === 'plan' && isSameMonth(e.fecha, currentDate)
  ).length;

  const otsCount = filteredEventos.filter(e => 
    e.tipo === 'ot' && isSameMonth(e.fecha, currentDate)
  ).length;

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 lg:p-8" data-testid="page-cmms-calendario">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation("/cmms")}
              data-testid="button-back"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-foreground flex items-center gap-2" data-testid="text-title">
                <CalendarIcon className="h-8 w-8" />
                Calendario de Mantención
              </h1>
              <p className="text-muted-foreground" data-testid="text-subtitle">
                Planes preventivos y órdenes de trabajo programadas
              </p>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Eventos</CardTitle>
              <CalendarIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-eventos">{totalEventos}</div>
              <p className="text-xs text-muted-foreground">Este mes</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Planes Preventivos</CardTitle>
              <Clock className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600" data-testid="text-total-planes">{planesCount}</div>
              <p className="text-xs text-muted-foreground">Programados</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Órdenes de Trabajo</CardTitle>
              <Wrench className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600" data-testid="text-total-ots">{otsCount}</div>
              <p className="text-xs text-muted-foreground">Activas</p>
            </CardContent>
          </Card>
        </div>

        {/* Controls */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4 md:items-center md:justify-between">
              {/* Month Navigation */}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handlePreviousMonth}
                  data-testid="button-prev-month"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="min-w-[200px] text-center">
                  <h2 className="text-xl font-semibold capitalize" data-testid="text-current-month">
                    {format(currentDate, "MMMM yyyy", { locale: es })}
                  </h2>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleNextMonth}
                  data-testid="button-next-month"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  onClick={handleToday}
                  data-testid="button-today"
                >
                  Hoy
                </Button>
              </div>

              {/* Filters */}
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">Filtrar:</label>
                <Select value={filterTipo} onValueChange={setFilterTipo}>
                  <SelectTrigger className="w-[180px]" data-testid="select-filter-tipo">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los eventos</SelectItem>
                    <SelectItem value="plan">Solo Planes</SelectItem>
                    <SelectItem value="ot">Solo OTs</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Calendar Grid */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-7 gap-2">
              {/* Day headers */}
              {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map((day, index) => (
                <div key={day} className="text-center font-semibold text-sm text-muted-foreground p-2" data-testid={`header-day-${index}`}>
                  {day}
                </div>
              ))}

              {/* Empty cells before first day */}
              {Array.from({ length: firstDayOfWeek }).map((_, index) => (
                <div key={`empty-${index}`} className="border rounded-lg p-2 bg-muted/20 min-h-[100px]" />
              ))}

              {/* Days of month */}
              {daysInMonth.map((day) => {
                const dayEventos = getEventosForDay(day);
                const isToday = isSameDay(day, new Date());

                return (
                  <div
                    key={day.toISOString()}
                    className={`border rounded-lg p-2 min-h-[100px] transition-colors ${
                      isToday ? 'bg-primary/5 border-primary' : 'hover:bg-accent'
                    }`}
                    data-testid={`day-cell-${format(day, 'yyyy-MM-dd')}`}
                  >
                    <div className={`text-sm font-medium mb-1 ${isToday ? 'text-primary font-bold' : ''}`}>
                      {format(day, 'd')}
                    </div>
                    <div className="space-y-1">
                      {dayEventos.slice(0, 3).map((evento) => (
                        <Badge
                          key={evento.id}
                          className={`w-full text-xs cursor-pointer justify-start ${getEventoBadgeColor(evento)}`}
                          onClick={() => handleEventClick(evento)}
                          data-testid={`evento-badge-${evento.id}`}
                        >
                          <span className="mr-1">{getEstadoIcon(evento.estado)}</span>
                          <span className="truncate">{evento.titulo}</span>
                        </Badge>
                      ))}
                      {dayEventos.length > 3 && (
                        <div className="text-xs text-muted-foreground text-center">
                          +{dayEventos.length - 3} más
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Event Details Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {selectedEvento?.tipo === 'plan' ? 'Plan Preventivo' : 'Orden de Trabajo'}
              </DialogTitle>
              <DialogDescription>
                {selectedEvento && format(selectedEvento.fecha, "dd 'de' MMMM, yyyy", { locale: es })}
              </DialogDescription>
            </DialogHeader>
            {selectedEvento && (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Título</label>
                  <p className="text-lg font-semibold">{selectedEvento.titulo}</p>
                </div>

                {selectedEvento.tipo === 'plan' && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Equipo</label>
                        <p className="font-medium">{(selectedEvento.data as PlanPreventivo).equipo?.nombre || 'Tarea General'}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Frecuencia</label>
                        <p className="capitalize font-medium">{selectedEvento.frecuencia}</p>
                      </div>
                      {selectedEvento.area && (
                        <div className="col-span-2">
                          <label className="text-sm font-medium text-muted-foreground">Área</label>
                          <p className="capitalize">{selectedEvento.area.replace(/_/g, ' ')}</p>
                        </div>
                      )}
                    </div>

                    {(selectedEvento.data as PlanPreventivo).descripcion && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Descripción</label>
                        <p className="mt-1 text-sm">{(selectedEvento.data as PlanPreventivo).descripcion}</p>
                      </div>
                    )}

                    {(selectedEvento.data as PlanPreventivo).tareasPreventivas && (
                      <div className="border rounded-lg p-4 bg-blue-50 dark:bg-blue-950/30">
                        <h3 className="font-semibold mb-3 flex items-center gap-2">
                          <span>📋</span> Checklist de Tareas Preventivas
                        </h3>
                        <ul className="space-y-2 list-none">
                          {(selectedEvento.data as PlanPreventivo).tareasPreventivas!.split('\n').filter(line => line.trim()).map((tarea, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-sm">
                              <span className="text-blue-500 mt-0.5">•</span>
                              <span className="flex-1">{tarea.trim()}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                )}

                {selectedEvento.tipo === 'ot' && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Estado</label>
                        <div className="mt-1">
                          <Badge variant="outline" className="capitalize">
                            {selectedEvento.estado?.replace(/_/g, ' ')}
                          </Badge>
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Gravedad</label>
                        <div className="mt-1">
                          <Badge variant="outline" className="capitalize">
                            {selectedEvento.gravedad}
                          </Badge>
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Área</label>
                        <p className="capitalize">{selectedEvento.area?.replace(/_/g, ' ')}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Tipo</label>
                        <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 capitalize">
                          {(selectedEvento.data as Mantencion).tipoMantencion}
                        </Badge>
                      </div>
                      {(selectedEvento.data as Mantencion).equipoCodigo && (
                        <div>
                          <label className="text-sm font-medium text-muted-foreground">Código Equipo</label>
                          <p className="font-medium">{(selectedEvento.data as Mantencion).equipoCodigo}</p>
                        </div>
                      )}
                      {(selectedEvento.data as Mantencion).ubicacion && (
                        <div>
                          <label className="text-sm font-medium text-muted-foreground">Ubicación</label>
                          <p className="font-medium">{(selectedEvento.data as Mantencion).ubicacion}</p>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Descripción del Problema</label>
                      <p className="mt-1 text-sm">{(selectedEvento.data as Mantencion).descripcionProblema}</p>
                    </div>

                    {(selectedEvento.data as Mantencion).checklistTareas && (
                      <div className="border rounded-lg p-4 bg-blue-50 dark:bg-blue-950/30">
                        <h3 className="font-semibold mb-3 flex items-center gap-2">
                          <span>📋</span> Checklist de Tareas Preventivas
                        </h3>
                        <ul className="space-y-2 list-none">
                          {(selectedEvento.data as Mantencion).checklistTareas!.split('\n').filter(line => line.trim()).map((tarea, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-sm">
                              <span className="text-blue-500 mt-0.5">•</span>
                              <span className="flex-1">{tarea.trim()}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {((selectedEvento.data as Mantencion).tecnicoAsignadoName || (selectedEvento.data as Mantencion).proveedorAsignadoName) && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Asignado a</label>
                        <p className="mt-1">
                          {(selectedEvento.data as Mantencion).tipoAsignacion === 'tecnico_interno' && (selectedEvento.data as Mantencion).tecnicoAsignadoName ? (
                            `👷 ${(selectedEvento.data as Mantencion).tecnicoAsignadoName} (Técnico Interno)`
                          ) : (selectedEvento.data as Mantencion).tipoAsignacion === 'proveedor_externo' && (selectedEvento.data as Mantencion).proveedorAsignadoName ? (
                            `🏢 ${(selectedEvento.data as Mantencion).proveedorAsignadoName} (Proveedor Externo)`
                          ) : (
                            'Sin asignar'
                          )}
                        </p>
                      </div>
                    )}

                    {(selectedEvento.data as Mantencion).fechaProgramada && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Fecha Programada</label>
                        <p className="mt-1">
                          📅 {format(parseISO((selectedEvento.data as Mantencion).fechaProgramada!), "dd/MM/yyyy", { locale: es })}
                        </p>
                      </div>
                    )}
                  </>
                )}

                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button variant="outline" onClick={() => setDialogOpen(false)} data-testid="button-close-dialog">
                    Cerrar
                  </Button>
                  {selectedEvento.tipo === 'plan' && (
                    <Button onClick={() => setLocation('/cmms/planes-preventivos')} data-testid="button-view-plan">
                      Ver Plan
                    </Button>
                  )}
                  {selectedEvento.tipo === 'ot' && (
                    <Button onClick={() => setLocation('/mantenciones')} data-testid="button-view-ot">
                      Ver OT
                    </Button>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
