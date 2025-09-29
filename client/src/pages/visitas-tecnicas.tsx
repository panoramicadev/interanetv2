import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, 
  FileText, 
  BarChart3, 
  Calendar,
  MapPin,
  User,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Search,
  Filter
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface VisitaResumen {
  id: string;
  nombreObra: string;
  fechaVisita: string;
  tecnico: string;
  cliente: string;
  estado: 'borrador' | 'completada';
  productosEvaluados: number;
  reclamosTotal: number;
}

interface EstadisticasVisitas {
  totalVisitas: number;
  visitasCompletadas: number;
  visitasBorrador: number;
  aplicacionesCorrectas: number;
  aplicacionesDeficientes: number;
  reclamosPendientes: number;
  promedioProgreso: number;
}

export default function VisitasTecnicasPage() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterEstado, setFilterEstado] = useState<string>("all");
  const [filtroMes, setFiltroMes] = useState<string>("current");

  // Query para estadísticas del dashboard
  const { data: estadisticas, isLoading: loadingStats } = useQuery<EstadisticasVisitas>({
    queryKey: ['/api/visitas-tecnicas/estadisticas', filtroMes],
    enabled: activeTab === 'dashboard',
  });

  // Query para listado de visitas
  const { data: visitas, isLoading: loadingVisitas } = useQuery<VisitaResumen[]>({
    queryKey: ['/api/visitas-tecnicas/listado', searchTerm, filterEstado],
    enabled: activeTab === 'listado',
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-CL', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getEstadoBadge = (estado: string) => {
    switch (estado) {
      case 'completada':
        return <Badge variant="default" className="bg-green-500"><CheckCircle2 className="w-3 h-3 mr-1" />Completada</Badge>;
      case 'borrador':
        return <Badge variant="outline"><Clock className="w-3 h-3 mr-1" />Borrador</Badge>;
      default:
        return <Badge variant="secondary">{estado}</Badge>;
    }
  };

  const DashboardContent = () => (
    <div className="space-y-6">
      {/* Filtros del dashboard */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Dashboard de Visitas Técnicas</h2>
          <p className="text-muted-foreground">Estadísticas y resumen de inspecciones técnicas</p>
        </div>
        <Select value={filtroMes} onValueChange={setFiltroMes}>
          <SelectTrigger className="w-48" data-testid="select-filter-month">
            <SelectValue placeholder="Seleccionar período" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="current">Mes actual</SelectItem>
            <SelectItem value="last">Mes anterior</SelectItem>
            <SelectItem value="quarter">Último trimestre</SelectItem>
            <SelectItem value="year">Año actual</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Cards de estadísticas principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Visitas</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-total-visitas">
              {loadingStats ? "..." : estadisticas?.totalVisitas ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {loadingStats ? "..." : `${estadisticas?.visitasCompletadas ?? 0} completadas`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aplicaciones Correctas</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600" data-testid="stat-aplicaciones-correctas">
              {loadingStats ? "..." : estadisticas?.aplicacionesCorrectas ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Productos aplicados correctamente
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aplicaciones Deficientes</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600" data-testid="stat-aplicaciones-deficientes">
              {loadingStats ? "..." : estadisticas?.aplicacionesDeficientes ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Requieren atención técnica
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Reclamos Pendientes</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600" data-testid="stat-reclamos-pendientes">
              {loadingStats ? "..." : estadisticas?.reclamosPendientes ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Requieren seguimiento
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Resumen rápido */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Progreso Promedio
            </CardTitle>
            <CardDescription>
              Porcentaje promedio de avance en obras visitadas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold mb-2" data-testid="stat-progreso-promedio">
              {loadingStats ? "..." : `${estadisticas?.promedioProgreso ?? 0}%`}
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all"
                style={{ width: `${estadisticas?.promedioProgreso ?? 0}%` }}
              ></div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Acciones Rápidas
            </CardTitle>
            <CardDescription>
              Gestionar visitas técnicas y reportes
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button className="w-full justify-start" data-testid="button-nueva-visita">
              <Plus className="w-4 h-4 mr-2" />
              Nueva Visita Técnica
            </Button>
            <Button variant="outline" className="w-full justify-start" data-testid="button-exportar-reportes">
              <FileText className="w-4 h-4 mr-2" />
              Exportar Reportes
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const ListadoContent = () => (
    <div className="space-y-6">
      {/* Header con filtros */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Listado de Visitas</h2>
          <p className="text-muted-foreground">Gestiona y revisa todas las visitas técnicas</p>
        </div>
        <Button data-testid="button-crear-visita">
          <Plus className="w-4 h-4 mr-2" />
          Nueva Visita
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Buscar por nombre de obra..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
            data-testid="input-search-obra"
          />
        </div>
        <Select value={filterEstado} onValueChange={setFilterEstado}>
          <SelectTrigger className="w-48" data-testid="select-filter-estado">
            <SelectValue placeholder="Filtrar por estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="borrador">Borrador</SelectItem>
            <SelectItem value="completada">Completadas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Lista de visitas */}
      <div className="space-y-4">
        {loadingVisitas ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="h-6 bg-gray-200 rounded mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : visitas && visitas.length > 0 ? (
          visitas.map((visita) => (
            <Card key={visita.id} className="hover:shadow-md transition-shadow" data-testid={`card-visita-${visita.id}`}>
              <CardContent className="p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-lg" data-testid={`text-obra-${visita.id}`}>
                        {visita.nombreObra}
                      </h3>
                      {getEstadoBadge(visita.estado)}
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        <span data-testid={`text-fecha-${visita.id}`}>
                          {formatDate(visita.fechaVisita)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <User className="w-4 h-4" />
                        <span data-testid={`text-tecnico-${visita.id}`}>
                          {visita.tecnico}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <User className="w-4 h-4" />
                        <span data-testid={`text-cliente-${visita.id}`}>
                          {visita.cliente}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-sm">
                      <span className="text-blue-600" data-testid={`text-productos-${visita.id}`}>
                        {visita.productosEvaluados} productos evaluados
                      </span>
                      {visita.reclamosTotal > 0 && (
                        <span className="text-red-600" data-testid={`text-reclamos-${visita.id}`}>
                          {visita.reclamosTotal} reclamos
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" data-testid={`button-ver-${visita.id}`}>
                      Ver Detalle
                    </Button>
                    <Button variant="outline" size="sm" data-testid={`button-pdf-${visita.id}`}>
                      <FileText className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="p-8 text-center">
              <MapPin className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium mb-2">No hay visitas técnicas</h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm || filterEstado !== 'all' 
                  ? 'No se encontraron visitas que coincidan con los filtros aplicados.'
                  : 'Comienza creando tu primera visita técnica.'
                }
              </p>
              <Button data-testid="button-primera-visita">
                <Plus className="w-4 h-4 mr-2" />
                Nueva Visita Técnica
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 space-y-6">
        {/* Header principal */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Visitas Técnicas</h1>
            <p className="text-muted-foreground">
              Sistema de inspecciones técnicas para evaluación de productos
            </p>
          </div>
        </div>

        {/* Tabs principales */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="dashboard" data-testid="tab-dashboard">
              <BarChart3 className="w-4 h-4 mr-2" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="listado" data-testid="tab-listado">
              <FileText className="w-4 h-4 mr-2" />
              Visitas
            </TabsTrigger>
            <TabsTrigger value="reportes" data-testid="tab-reportes">
              <BarChart3 className="w-4 h-4 mr-2" />
              Reportes
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="mt-6">
            <DashboardContent />
          </TabsContent>

          <TabsContent value="listado" className="mt-6">
            <ListadoContent />
          </TabsContent>


          <TabsContent value="reportes" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Reportes Consolidados</CardTitle>
                <CardDescription>
                  Genera reportes detallados de visitas técnicas y análisis
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12">
                  <BarChart3 className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium mb-2">Módulo en desarrollo</h3>
                  <p className="text-muted-foreground">
                    Los reportes consolidados estarán disponibles próximamente
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}