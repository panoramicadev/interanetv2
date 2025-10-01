import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
  Filter,
  X,
  PackagePlus
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { apiRequest, queryClient } from "@/lib/queryClient";

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

interface Client {
  id: string;
  nokoen: string;
  koen: string;
}

interface Product {
  id: string;
  kopr: string;
  name: string;
  ud02pr: string;
}

interface SelectedProduct {
  productId: string;
  sku: string;
  name: string;
  formato: string;
}

export default function VisitasTecnicasPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterEstado, setFilterEstado] = useState<string>("all");
  const [filtroMes, setFiltroMes] = useState<string>("current");
  const [showNewVisitModal, setShowNewVisitModal] = useState(false);
  
  // Estados para el flujo de creación de visita
  const [visitStep, setVisitStep] = useState<'basic' | 'products' | 'evaluation'>('basic');
  const [visitData, setVisitData] = useState({
    clienteId: '',
    clienteName: '',
    nombreObra: '',
    direccionObra: '',
    fechaVisita: new Date().toISOString().split('T')[0],
  });
  const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>([]);
  const [productSearchTerm, setProductSearchTerm] = useState("");
  const [clientSearchTerm, setClientSearchTerm] = useState("");
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const clientDropdownRef = useRef<HTMLDivElement>(null);
  const [productEvaluations, setProductEvaluations] = useState<Record<string, string>>({});

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (clientDropdownRef.current && !clientDropdownRef.current.contains(event.target as Node)) {
        setShowClientDropdown(false);
      }
    };

    if (showClientDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showClientDropdown]);

  const handleNewVisit = () => {
    setShowNewVisitModal(true);
    setVisitStep('basic');
    setVisitData({
      clienteId: '',
      clienteName: '',
      nombreObra: '',
      direccionObra: '',
      fechaVisita: new Date().toISOString().split('T')[0],
    });
    setSelectedProducts([]);
    setProductSearchTerm("");
    setClientSearchTerm("");
    setShowClientDropdown(false);
    setProductEvaluations({});
  };
  
  const handleCloseModal = () => {
    setShowNewVisitModal(false);
    setVisitStep('basic');
    setClientSearchTerm("");
    setShowClientDropdown(false);
  };

  // Query para buscar clientes (AJAX search)
  const { data: clientSearchResults = [], isLoading: searchingClients } = useQuery<Client[]>({
    queryKey: ['/api/clients/search', clientSearchTerm],
    queryFn: async () => {
      if (!clientSearchTerm || clientSearchTerm.length < 3) {
        return [];
      }
      const response = await apiRequest(`/api/clients/search?q=${encodeURIComponent(clientSearchTerm)}`);
      return response.json();
    },
    enabled: showNewVisitModal && clientSearchTerm.length >= 3,
  });

  // Query para obtener la lista de productos
  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ['/api/products/list'],
    enabled: showNewVisitModal && visitStep === 'products',
  });

  const filteredProducts = products.filter(p => 
    productSearchTerm === '' ||
    p.name.toLowerCase().includes(productSearchTerm.toLowerCase()) ||
    p.kopr.toLowerCase().includes(productSearchTerm.toLowerCase())
  );

  const handleProductToggle = (product: Product, checked: boolean) => {
    if (checked) {
      setSelectedProducts(prev => [...prev, {
        productId: product.id,
        sku: product.kopr,
        name: product.name,
        formato: product.ud02pr || 'N/A'
      }]);
    } else {
      setSelectedProducts(prev => prev.filter(p => p.productId !== product.id));
    }
  };

  const handleRemoveProduct = (productId: string) => {
    setSelectedProducts(prev => prev.filter(p => p.productId !== productId));
  };

  const createVisitMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest('/api/visitas-tecnicas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/visitas-tecnicas/listado'] });
      queryClient.invalidateQueries({ queryKey: ['/api/visitas-tecnicas/estadisticas'] });
      handleCloseModal();
    },
  });

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
            <Button 
              className="w-full justify-start" 
              onClick={handleNewVisit}
              data-testid="button-nueva-visita"
            >
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
        <Button onClick={handleNewVisit} data-testid="button-crear-visita">
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
              <Button onClick={handleNewVisit} data-testid="button-primera-visita">
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

      {/* Modal para nueva visita técnica - Paso 1: Datos básicos */}
      {visitStep === 'basic' && (
        <Dialog open={showNewVisitModal} onOpenChange={handleCloseModal}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Nueva Visita Técnica - Datos Básicos</DialogTitle>
              <DialogDescription>
                Paso 1 de 3: Información general de la visita
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="space-y-2 relative" ref={clientDropdownRef}>
                <label className="text-sm font-medium">Cliente *</label>
                <div className="relative">
                  <Input
                    placeholder="Escribe para buscar cliente..."
                    value={visitData.clienteName || clientSearchTerm}
                    onChange={(e) => {
                      const value = e.target.value;
                      setClientSearchTerm(value);
                      setShowClientDropdown(true);
                      if (!value) {
                        setVisitData(prev => ({ ...prev, clienteId: '', clienteName: '' }));
                      }
                    }}
                    onFocus={() => {
                      if (clientSearchTerm.length >= 3) {
                        setShowClientDropdown(true);
                      }
                    }}
                    data-testid="input-search-cliente"
                    className="pr-10"
                  />
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                </div>
                <p className="text-xs text-muted-foreground">
                  Escribe al menos 3 caracteres para buscar
                </p>
                
                {showClientDropdown && clientSearchTerm.length >= 3 && (
                  <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-64 overflow-y-auto">
                    {searchingClients ? (
                      <div className="p-3 text-sm text-gray-500 text-center">
                        Buscando...
                      </div>
                    ) : clientSearchResults.length === 0 ? (
                      <div className="p-3 text-sm text-gray-500 text-center">
                        No se encontraron clientes
                      </div>
                    ) : (
                      clientSearchResults.map((client) => (
                        <button
                          key={client.id}
                          type="button"
                          className="w-full text-left px-3 py-2 hover:bg-gray-100 transition-colors text-sm"
                          onClick={() => {
                            setVisitData(prev => ({ 
                              ...prev, 
                              clienteId: client.id,
                              clienteName: client.nokoen 
                            }));
                            setClientSearchTerm('');
                            setShowClientDropdown(false);
                          }}
                          data-testid={`option-cliente-${client.id}`}
                        >
                          {client.nokoen}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Técnico Asignado</label>
                <Input 
                  value={user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : user?.email || ''} 
                  disabled
                  className="bg-gray-50"
                  data-testid="input-tecnico"
                />
                <p className="text-xs text-muted-foreground">
                  Automáticamente asignado al usuario actual
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nombre de la Obra *</label>
                  <Input 
                    placeholder="Ej: Edificio Las Condes 2025" 
                    value={visitData.nombreObra}
                    onChange={(e) => setVisitData(prev => ({ ...prev, nombreObra: e.target.value }))}
                    data-testid="input-nombre-obra" 
                  />
                  <p className="text-xs text-muted-foreground">
                    Cada cliente puede tener múltiples obras
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Fecha de Visita *</label>
                  <Input 
                    type="date" 
                    value={visitData.fechaVisita}
                    onChange={(e) => setVisitData(prev => ({ ...prev, fechaVisita: e.target.value }))}
                    data-testid="input-fecha-visita" 
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Dirección de la Obra *</label>
                <Input 
                  placeholder="Dirección completa de la obra" 
                  value={visitData.direccionObra}
                  onChange={(e) => setVisitData(prev => ({ ...prev, direccionObra: e.target.value }))}
                  data-testid="input-direccion" 
                />
              </div>
              
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button 
                  variant="outline" 
                  onClick={handleCloseModal} 
                  data-testid="button-cancelar"
                >
                  Cancelar
                </Button>
                <Button 
                  onClick={() => setVisitStep('products')} 
                  disabled={!visitData.clienteId || !visitData.nombreObra || !visitData.direccionObra}
                  data-testid="button-siguiente"
                >
                  Siguiente: Seleccionar Productos
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Modal para nueva visita técnica - Paso 2: Selección de productos */}
      {visitStep === 'products' && (
        <Dialog open={showNewVisitModal} onOpenChange={handleCloseModal}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle>Nueva Visita Técnica - Selección de Productos</DialogTitle>
              <DialogDescription>
                Paso 2 de 3: Selecciona los productos que se evaluarán en la visita
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
              {/* Productos seleccionados */}
              {selectedProducts.length > 0 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Productos Seleccionados ({selectedProducts.length})</label>
                  <ScrollArea className="h-24 border rounded-md p-2">
                    <div className="flex flex-wrap gap-2">
                      {selectedProducts.map((product) => (
                        <Badge key={product.productId} variant="secondary" className="gap-1">
                          {product.sku} - {product.name.substring(0, 30)}...
                          <button
                            onClick={() => handleRemoveProduct(product.productId)}
                            className="ml-1 hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}

              {/* Búsqueda de productos */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Buscar Productos</label>
                <Input
                  placeholder="Buscar por SKU o nombre de producto..."
                  value={productSearchTerm}
                  onChange={(e) => setProductSearchTerm(e.target.value)}
                  data-testid="input-buscar-producto"
                />
              </div>

              {/* Lista de productos */}
              <ScrollArea className="flex-1 border rounded-md">
                <div className="p-4 space-y-2">
                  {filteredProducts.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <PackagePlus className="mx-auto h-12 w-12 mb-2 opacity-50" />
                      <p>No se encontraron productos</p>
                    </div>
                  ) : (
                    filteredProducts.map((product) => {
                      const isSelected = selectedProducts.some(p => p.productId === product.id);
                      return (
                        <div
                          key={product.id}
                          className="flex items-start space-x-3 p-3 rounded-lg hover:bg-accent cursor-pointer"
                          onClick={() => handleProductToggle(product, !isSelected)}
                        >
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) => handleProductToggle(product, checked as boolean)}
                            className="mt-1"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" className="font-mono text-xs">{product.kopr}</Badge>
                              <Badge variant="secondary" className="text-xs">{product.ud02pr || 'N/A'}</Badge>
                            </div>
                            <p className="text-sm font-medium">{product.name}</p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
              
              <div className="flex justify-between gap-3 pt-4 border-t">
                <Button 
                  variant="outline" 
                  onClick={() => setVisitStep('basic')} 
                  data-testid="button-atras"
                >
                  Atrás
                </Button>
                <div className="flex gap-3">
                  <Button 
                    variant="outline" 
                    onClick={handleCloseModal} 
                    data-testid="button-cancelar-productos"
                  >
                    Cancelar
                  </Button>
                  <Button 
                    onClick={() => setVisitStep('evaluation')} 
                    disabled={selectedProducts.length === 0}
                    data-testid="button-crear-evaluacion"
                  >
                    Continuar a Evaluación ({selectedProducts.length})
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Modal para nueva visita técnica - Paso 3: Evaluación */}
      {visitStep === 'evaluation' && (
        <Dialog open={showNewVisitModal} onOpenChange={handleCloseModal}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle>Nueva Visita Técnica - Evaluación de Productos</DialogTitle>
              <DialogDescription>
                Paso 3 de 3: Evaluar {selectedProducts.length} producto(s) seleccionado(s)
              </DialogDescription>
            </DialogHeader>
            
            <ScrollArea className="flex-1">
              <div className="space-y-6 pr-4">
                {selectedProducts.map((product, index) => (
                  <Card key={product.productId} className="border-2">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Badge>{index + 1}</Badge>
                        {product.name}
                      </CardTitle>
                      <CardDescription className="flex gap-2">
                        <Badge variant="outline">SKU: {product.sku}</Badge>
                        <Badge variant="secondary">Formato: {product.formato}</Badge>
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Color</label>
                          <Input placeholder="Color del producto" data-testid={`input-color-${index}`} />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Lote</label>
                          <Input placeholder="Número de lote" data-testid={`input-lote-${index}`} />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Fecha de Llegada</label>
                          <Input type="date" data-testid={`input-fecha-llegada-${index}`} />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">M² Aplicados</label>
                          <Input type="number" placeholder="Metros cuadrados" data-testid={`input-m2-${index}`} />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium">% Avance</label>
                        <Input type="number" min="0" max="100" placeholder="Porcentaje de avance" data-testid={`input-avance-${index}`} />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Condiciones Climáticas</label>
                          <Input placeholder="Ej: Soleado, 20°C" data-testid={`input-clima-${index}`} />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">% Dilución</label>
                          <Input type="number" min="0" max="100" placeholder="Porcentaje de dilución" data-testid={`input-dilucion-${index}`} />
                        </div>
                      </div>

                      <div className="border-t pt-3 space-y-3">
                        <h4 className="font-medium text-sm">Evaluación Técnica</h4>
                        
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Aplicación</label>
                          <Select onValueChange={(value) => setProductEvaluations(prev => ({ ...prev, [product.productId]: value }))}>
                            <SelectTrigger data-testid={`select-aplicacion-${index}`}>
                              <SelectValue placeholder="Seleccionar evaluación" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="correcta">Correcta</SelectItem>
                              <SelectItem value="deficiente">Deficiente</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {productEvaluations[product.productId] === 'deficiente' && (
                          <div className="space-y-2 bg-red-50 p-3 rounded-lg border border-red-200">
                            <label className="text-sm font-medium text-red-900">Evidencia de Deficiencia *</label>
                            <Input 
                              placeholder="Describir el problema encontrado..." 
                              data-testid={`input-evidencia-${index}`}
                              className="bg-white"
                            />
                          </div>
                        )}

                        <div className="space-y-2">
                          <label className="text-sm font-medium">Observaciones Técnicas</label>
                          <Input placeholder="Observaciones sobre el producto..." data-testid={`input-observaciones-${index}`} />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
            
            <div className="flex justify-between gap-3 pt-4 border-t">
              <Button 
                variant="outline" 
                onClick={() => setVisitStep('products')} 
                data-testid="button-atras-evaluacion"
              >
                Atrás
              </Button>
              <div className="flex gap-3">
                <Button 
                  variant="outline" 
                  onClick={handleCloseModal} 
                  data-testid="button-cancelar-evaluacion"
                >
                  Cancelar
                </Button>
                <Button 
                  onClick={() => {
                    // Crear la visita con todos los datos
                    const visitCompleteData = {
                      ...visitData,
                      tecnicoId: user?.id,
                      productos: selectedProducts,
                      estado: 'completada'
                    };
                    createVisitMutation.mutate(visitCompleteData);
                  }}
                  disabled={createVisitMutation.isPending}
                  data-testid="button-finalizar"
                >
                  {createVisitMutation.isPending ? 'Creando...' : 'Crear Visita Técnica'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}