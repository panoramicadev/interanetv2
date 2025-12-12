import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Plus, Phone, MessageSquare, Building2, Mail, MoreVertical, Filter, Grid3x3, List, Download, BookOpen, Trash2, Settings, Edit, AlertCircle, X, User, Home, Clock, MapPin } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { CrmLead, CrmStage, InsertCrmLeadInput, ClienteInactivo } from "@shared/schema";
import { insertCrmLeadSchema } from "@shared/schema";
import PromesasCompraPage from "./promesas-compra";

const PIPELINE_STAGES = [
  { id: 'all', name: 'Todos', color: 'bg-gray-100 dark:bg-gray-800' },
  { id: 'lead', name: 'Nuevo', color: 'bg-orange-100 dark:bg-orange-900' },
  { id: 'contacto', name: 'Contacto', color: 'bg-blue-100 dark:bg-blue-900' },
  { id: 'visita', name: 'Visita', color: 'bg-amber-100 dark:bg-amber-900' },
  { id: 'lista_precio', name: 'Lista Precio', color: 'bg-cyan-100 dark:bg-cyan-900' },
  { id: 'campana', name: 'Campaña', color: 'bg-purple-100 dark:bg-purple-900' },
  { id: 'primera_venta', name: 'Primera Venta', color: 'bg-indigo-100 dark:bg-indigo-900' },
  { id: 'promesa', name: 'Promesa', color: 'bg-emerald-100 dark:bg-emerald-900' },
  { id: 'venta', name: 'Venta', color: 'bg-green-100 dark:bg-green-900' },
] as const;

const STAGE_BADGE_MAP: Record<string, { label: string; bgColor: string; textColor: string }> = {
  lead: { label: 'Nuevo', bgColor: 'bg-orange-100 dark:bg-orange-900/30', textColor: 'text-orange-700 dark:text-orange-300' },
  contacto: { label: 'Contacto', bgColor: 'bg-blue-100 dark:bg-blue-900/30', textColor: 'text-blue-700 dark:text-blue-300' },
  visita: { label: 'Visita', bgColor: 'bg-amber-100 dark:bg-amber-900/30', textColor: 'text-amber-700 dark:text-amber-300' },
  lista_precio: { label: 'Lista Precio', bgColor: 'bg-cyan-100 dark:bg-cyan-900/30', textColor: 'text-cyan-700 dark:text-cyan-300' },
  campana: { label: 'Campaña', bgColor: 'bg-purple-100 dark:bg-purple-900/30', textColor: 'text-purple-700 dark:text-purple-300' },
  primera_venta: { label: 'Primera Venta', bgColor: 'bg-indigo-100 dark:bg-indigo-900/30', textColor: 'text-indigo-700 dark:text-indigo-300' },
  promesa: { label: 'Promesa', bgColor: 'bg-emerald-100 dark:bg-emerald-900/30', textColor: 'text-emerald-700 dark:text-emerald-300' },
  venta: { label: 'Venta', bgColor: 'bg-green-100 dark:bg-green-900/30', textColor: 'text-green-700 dark:text-green-300' },
};

// Utility function to calculate days since last update
function getDaysSinceUpdate(lead: CrmLead): number {
  const updateDate = lead.updatedAt ? new Date(lead.updatedAt) : new Date(lead.createdAt || new Date());
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - updateDate.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

// Get alert style based on days inactive
function getInactivityAlert(days: number): { show: boolean; level: 'warning' | 'danger' | 'critical'; message: string; bgColor: string; textColor: string; borderColor: string } | null {
  if (days >= 21) {
    return {
      show: true,
      level: 'critical',
      message: `Sin movimiento por ${days} días`,
      bgColor: 'bg-red-50 dark:bg-red-900/20',
      textColor: 'text-red-700 dark:text-red-400',
      borderColor: 'border-red-300 dark:border-red-700'
    };
  } else if (days >= 14) {
    return {
      show: true,
      level: 'danger',
      message: `Sin movimiento por ${days} días`,
      bgColor: 'bg-orange-50 dark:bg-orange-900/20',
      textColor: 'text-orange-700 dark:text-orange-400',
      borderColor: 'border-orange-300 dark:border-orange-700'
    };
  } else if (days >= 7) {
    return {
      show: true,
      level: 'warning',
      message: `Sin movimiento por ${days} días`,
      bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
      textColor: 'text-yellow-700 dark:text-yellow-400',
      borderColor: 'border-yellow-300 dark:border-yellow-700'
    };
  }
  return null;
}

export default function CRMPage() {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'leads' | 'promesas'>('leads');
  const [clientTypeFilter] = useState<'nuevos'>('nuevos');
  const [searchQuery, setSearchQuery] = useState('');
  const [segmentFilter, setSegmentFilter] = useState('all');
  
  // For salesperson role, auto-filter to their own leads
  const isSalesperson = currentUser?.role === 'salesperson';
  const currentSalespersonName = currentUser?.salespersonName || `${currentUser?.firstName || ''} ${currentUser?.lastName || ''}`.trim();
  const [vendedorFilter, setVendedorFilter] = useState(isSalesperson ? currentSalespersonName : 'all');
  
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isStageManagementOpen, setIsStageManagementOpen] = useState(false);
  const [isInactiveClientsDialogOpen, setIsInactiveClientsDialogOpen] = useState(false);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [prefilledClientData, setPrefilledClientData] = useState<ClienteInactivo | null>(null);
  const [selectedLead, setSelectedLead] = useState<CrmLead | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  
  const columnRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const savedScrollPosition = useRef<number>(0);
  const isAdmin = currentUser?.role === 'admin';

  // Detect mobile view
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Load custom stages from database
  const { data: stages = [] } = useQuery<CrmStage[]>({
    queryKey: ['/api/crm/stages'],
  });

  // Create dynamic stage badge map from database stages
  const dynamicStageBadgeMap = stages.reduce((acc, stage) => {
    acc[stage.stageKey] = {
      label: stage.name,
      bgColor: stage.color,
      textColor: 'text-gray-700 dark:text-gray-300'
    };
    return acc;
  }, {} as Record<string, { label: string; bgColor: string; textColor: string }>);

  // Merge with static map as fallback
  const stageBadgeMap = { ...STAGE_BADGE_MAP, ...dynamicStageBadgeMap };

  const { data: leads = [], isLoading } = useQuery<CrmLead[]>({
    queryKey: ['/api/crm/leads'],
  });

  const { data: inactiveClients = [] } = useQuery<ClienteInactivo[]>({
    queryKey: ['/api/crm/inactive-clients'],
  });

  // Filter out dismissed and already added inactive clients
  const activeInactiveClients = inactiveClients.filter(client => !client.dismissed && !client.addedToCrm);

  const { data: segments = [] } = useQuery<string[]>({
    queryKey: ['/api/goals/data/segments'],
  });

  const { data: salespeople = [] } = useQuery<string[]>({
    queryKey: ['/api/goals/data/salespeople'],
  });

  const toggleActivityMutation = useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: 'hasCall' | 'hasWhatsapp'; value: boolean }) => {
      return apiRequest(`/api/crm/leads/${id}`, {
        method: 'PUT',
        data: { [field]: value }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/leads'] });
    },
  });

  const updateStageMutation = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: string }) => {
      // Guardar la posición del scroll antes de la mutación
      if (scrollContainerRef.current) {
        savedScrollPosition.current = scrollContainerRef.current.scrollLeft;
      }
      
      return apiRequest(`/api/crm/leads/${id}`, {
        method: 'PUT',
        data: { stage }
      });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/leads'] });
      toast({
        title: "Etapa actualizada",
        description: "El lead ha sido movido exitosamente",
      });
      
      // Restaurar la posición del scroll después de la actualización
      setTimeout(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollLeft = savedScrollPosition.current;
        }
      }, 50);
    },
  });

  const deleteLeadMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/crm/leads/${id}`, {
        method: 'DELETE'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/leads'] });
      toast({
        title: "Lead eliminado",
        description: "El lead ha sido eliminado exitosamente",
      });
    },
  });

  const dismissInactiveClientMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/crm/inactive-clients/${id}/dismiss`, {
        method: 'POST'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/inactive-clients'] });
      toast({
        title: "Cliente descartado",
        description: "El cliente inactivo ha sido descartado",
      });
    },
  });

  // Filter leads by search query, segment, salesperson, and client type
  const filteredLeads = leads.filter(lead => {
    // Search filter
    const matchesSearch = !searchQuery || 
      lead.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (lead.clientEmail || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (lead.clientPhone || '').toLowerCase().includes(searchQuery.toLowerCase());
    
    // Segment filter
    const matchesSegment = segmentFilter === 'all' || lead.segment === segmentFilter;
    
    // Salesperson filter
    const matchesVendedor = vendedorFilter === 'all' || lead.salespersonName === vendedorFilter;
    
    // Client type filter - acepta ambos indicadores (clientType y hasHistoricalSales como fallback)
    const matchesClientType = clientTypeFilter === 'todos' || 
      (clientTypeFilter === 'nuevos' && (lead.clientType === 'nuevo' || (!lead.clientType && !lead.hasHistoricalSales))) ||
      (clientTypeFilter === 'recurrentes' && (lead.clientType === 'recurrente' || lead.hasHistoricalSales));
    
    return matchesSearch && matchesSegment && matchesVendedor && matchesClientType;
  });

  // Group leads by stage
  const leadsByStage = stages.reduce((acc, stage) => {
    acc[stage.stageKey] = filteredLeads.filter(lead => lead.stage === stage.stageKey);
    return acc;
  }, {} as Record<string, CrmLead[]>);

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
          <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-2 sm:p-6 space-y-2 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">Leads</h1>
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-0.5 sm:mt-1 hidden sm:block">
            Gestión de clientes y promesas de compra
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" className="h-8 text-xs sm:text-sm sm:h-9" data-testid="button-export">
            <Download className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-2" />
            <span className="hidden sm:inline">Export</span>
          </Button>
          <Dialog open={isCreateDialogOpen} onOpenChange={(open) => {
            setIsCreateDialogOpen(open);
            if (!open) setPrefilledClientData(null);
          }}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-8 text-xs sm:text-sm sm:h-9" data-testid="button-create-lead">
                <Plus className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                Nuevo Lead
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Crear Nuevo Lead</DialogTitle>
              </DialogHeader>
              <CreateLeadForm 
                onSuccess={() => {
                  setIsCreateDialogOpen(false);
                  setPrefilledClientData(null);
                }} 
                prefilledData={prefilledClientData}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Tabs principales */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'leads' | 'promesas')}>
        <TabsList className="h-9 sm:h-10">
          <TabsTrigger value="leads" className="text-xs sm:text-sm" data-testid="tab-leads">Leads</TabsTrigger>
          <TabsTrigger value="promesas" className="text-xs sm:text-sm" data-testid="tab-promesas">Promesas de Compra</TabsTrigger>
        </TabsList>

        {/* Tab de Leads */}
        <TabsContent value="leads" className="space-y-2 sm:space-y-4">
          {/* Inactive Clients Alert */}
          {activeInactiveClients.length > 0 && (
            <Alert className="bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800">
              <AlertCircle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
              <AlertDescription className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-orange-800 dark:text-orange-200">
                    Clientes que requieren atención: <strong>{activeInactiveClients.length}</strong>
                  </span>
                  <Badge variant="secondary" className="bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200">
                    {activeInactiveClients.length}
                  </Badge>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-8 text-xs"
                  onClick={() => setIsInactiveClientsDialogOpen(true)}
                  data-testid="button-view-inactive-clients"
                >
                  Ver Detalles
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Barra de búsqueda y filtros */}
          <div className="flex flex-col gap-2 sm:gap-3">
            {/* Fila de filtros: en móvil horizontal, en desktop también horizontal */}
            <div className="flex flex-row items-center gap-2 sm:gap-3 w-full">
              {/* Filtro de Segmento */}
              <Select value={segmentFilter} onValueChange={setSegmentFilter}>
                <SelectTrigger className="flex-1 sm:w-[200px] h-8 sm:h-10 text-xs sm:text-sm" data-testid="select-segment-filter">
                  <SelectValue placeholder={isMobile ? "Segmentos" : "Todos los segmentos"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los segmentos</SelectItem>
                  {segments.map((segment) => (
                    <SelectItem key={segment} value={segment}>{segment}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {/* Filtro de Vendedor - Solo para admin y supervisor */}
              {!isSalesperson && (
                <Select value={vendedorFilter} onValueChange={setVendedorFilter}>
                  <SelectTrigger className="flex-1 sm:w-[200px] h-8 sm:h-10 text-xs sm:text-sm" data-testid="select-vendedor-filter">
                    <SelectValue placeholder={isMobile ? "Vendedores" : "Todos los vendedores"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los vendedores</SelectItem>
                    {salespeople.filter(sp => sp && sp !== '.').map((salesperson) => (
                      <SelectItem key={salesperson} value={salesperson}>{salesperson}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              
              {/* Botón Administrar Etapas en desktop */}
              {isAdmin && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-8 sm:h-9 hidden lg:flex" 
                  onClick={() => setIsStageManagementOpen(true)}
                  data-testid="button-manage-stages"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Administrar Etapas
                </Button>
              )}
            </div>

            {/* Buscador en su propia fila */}
            <div className="w-full">
              <Input
                placeholder="Buscar..."
                className="h-8 sm:h-10 text-xs sm:text-sm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="input-search-leads"
              />
            </div>
          </div>

          {/* Vista Desktop: Kanban - Columnas por etapa */}
          {!isMobile ? (
            <div className="overflow-x-auto pb-4" ref={scrollContainerRef}>
              <div className="flex gap-4" style={{ minWidth: 'max-content' }}>
              {stages.map((stage) => {
                const stageLeads = leadsByStage[stage.stageKey] || [];
                const stageBadge = stageBadgeMap[stage.stageKey] || { 
                  label: stage.name, 
                  bgColor: stage.color, 
                  textColor: 'text-gray-700 dark:text-gray-300' 
                };

                const handleDragOver = (e: React.DragEvent) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                };

                const handleDragEnter = (e: React.DragEvent) => {
                  e.preventDefault();
                  setDragOverStage(stage.stageKey);
                };

                const handleDragLeave = (e: React.DragEvent) => {
                  if (e.currentTarget === e.target) {
                    setDragOverStage(null);
                  }
                };

                const handleDrop = (e: React.DragEvent) => {
                  e.preventDefault();
                  const leadId = e.dataTransfer.getData('leadId');
                  const currentStage = e.dataTransfer.getData('currentStage');
                  
                  setDragOverStage(null);
                  
                  if (currentStage !== stage.stageKey && leadId) {
                    updateStageMutation.mutate({ id: leadId, stage: stage.stageKey });
                  }
                };
                
                const isDropTarget = dragOverStage === stage.stageKey;
                
                return (
                  <div 
                    key={stage.id} 
                    className="flex-shrink-0" 
                    style={{ width: '320px' }}
                    ref={(el) => { columnRefs.current[stage.stageKey] = el; }}
                    onDragOver={handleDragOver}
                    onDragEnter={handleDragEnter}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                  >
                    <Card className={`h-full transition-all ${isDropTarget ? 'ring-2 ring-blue-400 bg-blue-50/50 dark:bg-blue-900/10' : ''}`}>
                      <CardContent className="p-4">
                        {/* Encabezado de columna */}
                        <div className="mb-4">
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                              {stage.name}
                            </h3>
                            <Badge variant="secondary" className="text-xs">
                              {stageLeads.length} Leads
                            </Badge>
                          </div>
                          <div 
                            className={`h-1 rounded-full ${stageBadge.bgColor.startsWith('bg-') ? stageBadge.bgColor : ''}`}
                            style={!stageBadge.bgColor.startsWith('bg-') ? { backgroundColor: stageBadge.bgColor } : undefined}
                          />
                        </div>

                        {/* Leads en esta columna */}
                        <div className="space-y-3 max-h-[600px] overflow-y-auto min-h-[100px]">
                          {stageLeads.length === 0 ? (
                            <div className="text-center py-8 text-gray-400 text-sm">
                              {isDropTarget ? 'Suelta aquí' : 'Sin leads'}
                            </div>
                          ) : (
                            stageLeads.map((lead) => (
                              <LeadCard
                                key={lead.id}
                                lead={lead}
                                currentUser={currentUser}
                                isMobile={false}
                                stageBadgeMap={stageBadgeMap}
                                stages={stages}
                                onToggleActivity={(field) => {
                                  const currentValue = field === 'hasCall' ? lead.hasCall : lead.hasWhatsapp;
                                  toggleActivityMutation.mutate({ id: lead.id, field, value: !currentValue });
                                }}
                                onChangeStage={(newStage) => updateStageMutation.mutate({ id: lead.id, stage: newStage })}
                                onDelete={() => deleteLeadMutation.mutate(lead.id)}
                                onViewDetails={() => {
                                  setSelectedLead(lead);
                                  setIsDetailModalOpen(true);
                                }}
                              />
                            ))
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                );
              })}
              </div>
            </div>
          ) : (
            /* Vista Móvil: Lista vertical agrupada por etapa */
            <div className="space-y-2">
              {stages.map((stage) => {
                const stageLeads = leadsByStage[stage.stageKey] || [];
                const stageBadge = stageBadgeMap[stage.stageKey] || { 
                  label: stage.name, 
                  bgColor: stage.color, 
                  textColor: 'text-gray-700 dark:text-gray-300' 
                };
                
                if (stageLeads.length === 0) return null;
                
                return (
                  <div key={stage.id} className="space-y-1.5">
                    {/* Encabezado de sección */}
                    <div className="flex items-center justify-between px-0.5">
                      <div className="flex items-center gap-1.5">
                        <div 
                          className={`h-2.5 w-0.5 rounded-full ${stageBadge.bgColor.startsWith('bg-') ? stageBadge.bgColor : ''}`}
                          style={!stageBadge.bgColor.startsWith('bg-') ? { backgroundColor: stageBadge.bgColor } : undefined}
                        />
                        <h3 className="font-semibold text-xs text-gray-900 dark:text-gray-100">
                          {stage.name}
                        </h3>
                      </div>
                      <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                        {stageLeads.length}
                      </Badge>
                    </div>
                    
                    {/* Lista de leads */}
                    <div className="space-y-2">
                      {stageLeads.map((lead) => (
                        <LeadCard
                          key={lead.id}
                          lead={lead}
                          currentUser={currentUser}
                          isMobile={true}
                          stageBadgeMap={stageBadgeMap}
                          stages={stages}
                          onToggleActivity={(field) => {
                            const currentValue = field === 'hasCall' ? lead.hasCall : lead.hasWhatsapp;
                            toggleActivityMutation.mutate({ id: lead.id, field, value: !currentValue });
                          }}
                          onChangeStage={(newStage) => updateStageMutation.mutate({ id: lead.id, stage: newStage })}
                          onDelete={() => deleteLeadMutation.mutate(lead.id)}
                          onViewDetails={() => {
                            setSelectedLead(lead);
                            setIsDetailModalOpen(true);
                          }}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Tab de Promesas */}
        <TabsContent value="promesas">
          <PromesasCompraPage />
        </TabsContent>
      </Tabs>

      {/* Diálogo de Administración de Etapas */}
      <StageManagementDialog 
        open={isStageManagementOpen}
        onOpenChange={setIsStageManagementOpen}
      />

      {/* Diálogo de Clientes Inactivos */}
      <Dialog open={isInactiveClientsDialogOpen} onOpenChange={setIsInactiveClientsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Clientes Inactivos</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {activeInactiveClients.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No hay clientes inactivos</p>
            ) : (
              activeInactiveClients.map((client) => (
                <Card key={client.id} className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div>
                        <h4 className="font-semibold text-lg">{client.clientName}</h4>
                        {client.segment && (
                          <Badge variant="outline" className="mt-1">
                            {client.segment}
                          </Badge>
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">Días sin comprar:</span>
                          <p className="font-semibold text-orange-600">{client.daysSinceLastPurchase || 0} días</p>
                        </div>
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">Última compra:</span>
                          <p className="font-semibold">
                            {client.lastPurchaseDate 
                              ? new Date(client.lastPurchaseDate).toLocaleDateString('es-CL')
                              : 'N/A'}
                          </p>
                        </div>
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">Total año:</span>
                          <p className="font-semibold">
                            ${Number(client.totalPurchasesLastYear || 0).toLocaleString('es-CL')}
                          </p>
                        </div>
                      </div>
                      {client.salespersonName && (
                        <p className="text-xs text-gray-500">
                          Vendedor: {client.salespersonName}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button
                        size="sm"
                        onClick={() => {
                          setPrefilledClientData(client);
                          setIsInactiveClientsDialogOpen(false);
                          setIsCreateDialogOpen(true);
                        }}
                        data-testid={`button-add-to-crm-${client.id}`}
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Añadir al CRM
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => dismissInactiveClientMutation.mutate(client.id)}
                        data-testid={`button-dismiss-${client.id}`}
                      >
                        <X className="w-4 h-4 mr-1" />
                        Descartar
                      </Button>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Detalles del Lead */}
      <LeadDetailModal
        lead={selectedLead}
        open={isDetailModalOpen}
        onOpenChange={(open) => {
          setIsDetailModalOpen(open);
          if (!open) {
            setSelectedLead(null);
          }
        }}
      />
    </div>
  );
}

function LeadCard({ 
  lead, 
  onToggleActivity,
  onChangeStage,
  onDelete,
  onViewDetails,
  currentUser,
  isMobile = false,
  stageBadgeMap,
  stages
}: { 
  lead: CrmLead; 
  onToggleActivity: (field: 'hasCall' | 'hasWhatsapp') => void;
  onChangeStage: (stage: string) => void;
  onDelete: () => void;
  onViewDetails: () => void;
  currentUser: any;
  isMobile?: boolean;
  stageBadgeMap: Record<string, { label: string; bgColor: string; textColor: string }>;
  stages: CrmStage[];
}) {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const stageBadge = stageBadgeMap[lead.stage] || { label: lead.stage, bgColor: 'bg-gray-100', textColor: 'text-gray-700' };
  const isAdmin = currentUser?.role === 'admin';
  
  // Get initials for avatar
  const initials = lead.clientName
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  // Avatar background colors (cycling through palette)
  const avatarColors = [
    'bg-gradient-to-br from-blue-400 to-blue-600',
    'bg-gradient-to-br from-purple-400 to-purple-600',
    'bg-gradient-to-br from-pink-400 to-pink-600',
    'bg-gradient-to-br from-green-400 to-green-600',
    'bg-gradient-to-br from-orange-400 to-orange-600',
    'bg-gradient-to-br from-teal-400 to-teal-600',
  ];
  const avatarColor = avatarColors[lead.id.charCodeAt(0) % avatarColors.length];

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('leadId', lead.id);
    e.dataTransfer.setData('currentStage', lead.stage);
    e.dataTransfer.effectAllowed = 'move';
    setIsDragging(true);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  const handleCall = () => {
    if (lead.clientPhone) {
      window.location.href = `tel:${lead.clientPhone}`;
    }
  };

  const handleEmail = () => {
    if (lead.clientEmail) {
      window.location.href = `mailto:${lead.clientEmail}`;
    }
  };

  const handleWhatsApp = () => {
    if (lead.clientPhone) {
      const cleanPhone = lead.clientPhone.replace(/\D/g, '');
      window.open(`https://wa.me/${cleanPhone}`, '_blank');
    }
  };

  return (
    <Card 
      className={`overflow-hidden rounded-lg hover:shadow-md transition-all duration-200 bg-white dark:bg-gray-900 border border-gray-200/60 dark:border-gray-700/60 ${!isMobile ? 'cursor-move hover:cursor-pointer' : 'cursor-pointer'} ${isDragging ? 'opacity-50 scale-95' : 'hover:border-gray-300 dark:hover:border-gray-600'}`} 
      data-testid={`card-lead-${lead.id}`}
      draggable={!isMobile}
      onDragStart={!isMobile ? handleDragStart : undefined}
      onDragEnd={!isMobile ? handleDragEnd : undefined}
      onClick={onViewDetails}
    >
      <CardContent className={isMobile ? "p-2.5 space-y-2" : "p-3 space-y-2"}>
        {/* Header con avatar y nombre completo */}
        <div className="flex items-start justify-between gap-2 min-w-0">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className={`rounded-full ${avatarColor} flex items-center justify-center text-white font-bold shadow-sm flex-shrink-0 ${isMobile ? 'w-8 h-8 text-[10px]' : 'w-9 h-9 text-xs'}`}>
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className={`font-semibold text-gray-900 dark:text-gray-100 leading-tight ${isMobile ? 'text-xs' : 'text-sm'}`}>
                {lead.clientName}
              </h4>
              <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                {(lead as any).clientCity && (
                  <>
                    <MapPin className="w-3 h-3 flex-shrink-0" />
                    <span className={`${isMobile ? 'text-[10px]' : 'text-xs'}`}>{(lead as any).clientCity}</span>
                    <span className="mx-1">·</span>
                  </>
                )}
                <span className={`${isMobile ? 'text-[10px]' : 'text-xs'}`}>
                  {lead.createdAt ? new Date(lead.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : ''}
                </span>
              </div>
            </div>
          </div>
          {isAdmin && (
            <Button 
              variant="ghost" 
              size="sm" 
              className={`rounded hover:bg-gray-100 dark:hover:bg-gray-700/50 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 ${isMobile ? 'h-6 w-6 p-0' : 'h-7 w-7 p-0'}`}
              onClick={(e) => { e.stopPropagation(); setIsEditDialogOpen(true); }}
              title="Editar lead"
              data-testid={`button-edit-${lead.id}`}
            >
              <Edit className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>

        {/* Modal de edición */}
        {isAdmin && (
          <EditLeadDialog
            lead={lead}
            open={isEditDialogOpen}
            onOpenChange={setIsEditDialogOpen}
            onDelete={onDelete}
          />
        )}

        {/* Alerta de inactividad - compacta */}
        {(() => {
          const daysSinceUpdate = getDaysSinceUpdate(lead);
          const alert = getInactivityAlert(daysSinceUpdate);
          
          if (alert) {
            return (
              <div className={`flex items-center gap-1.5 px-2 py-1 rounded border ${alert.bgColor} ${alert.borderColor}`} data-testid={`alert-inactivity-${lead.id}`}>
                <Clock className={`flex-shrink-0 w-3 h-3 ${alert.textColor}`} />
                <span className={`flex-1 font-medium text-[10px] ${alert.textColor}`}>
                  {alert.message}
                </span>
              </div>
            );
          }
          return null;
        })()}

        {/* Info compacta: teléfono, email, RUT en una línea */}
        <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-gray-600 dark:text-gray-400 ${isMobile ? 'text-[10px]' : 'text-xs'}`}>
          {lead.clientPhone && (
            <div className="flex items-center gap-1">
              <Phone className="w-3 h-3" />
              <span>{lead.clientPhone}</span>
            </div>
          )}
          {lead.clientEmail && (
            <div className="flex items-center gap-1 truncate max-w-[140px]">
              <Mail className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{lead.clientEmail}</span>
            </div>
          )}
          {lead.clientCompany && (
            <div className="flex items-center gap-1">
              <Building2 className="w-3 h-3" />
              <span className="truncate max-w-[100px]">{lead.clientCompany}</span>
            </div>
          )}
        </div>

        {/* Tipo de cliente - badge compacto */}
        {lead.clientType && (
          <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
            lead.clientType === 'recurrente' 
              ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' 
              : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
          }`}>
            <User className="w-2.5 h-2.5" />
            {lead.clientType === 'recurrente' ? 'Recurrente' : 'Nuevo'}
          </div>
        )}

        {/* Botones de acción compactos */}
        <div className="grid grid-cols-3 gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); handleCall(); }}
            disabled={!lead.clientPhone}
            className="flex items-center justify-center gap-1 rounded border border-blue-200 dark:border-blue-700/50 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/30 disabled:opacity-40 disabled:cursor-not-allowed text-[10px] font-medium py-1"
            data-testid={`button-call-${lead.id}`}
          >
            <Phone className="w-3 h-3" />
            Lla...
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleWhatsApp(); }}
            disabled={!lead.clientPhone}
            className="flex items-center justify-center gap-1 rounded border border-green-200 dark:border-green-700/50 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/30 disabled:opacity-40 disabled:cursor-not-allowed text-[10px] font-medium py-1"
            data-testid={`button-whatsapp-${lead.id}`}
          >
            <MessageSquare className="w-3 h-3" />
            Wha...
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleEmail(); }}
            disabled={!lead.clientEmail}
            className="flex items-center justify-center gap-1 rounded border border-purple-200 dark:border-purple-700/50 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/30 disabled:opacity-40 disabled:cursor-not-allowed text-[10px] font-medium py-1"
            data-testid={`button-email-${lead.id}`}
          >
            <Mail className="w-3 h-3" />
            Email
          </button>
        </div>

        {/* Selector de etapa y botón de detalles */}
        <div className="flex gap-1.5 min-w-0">
          <div className="flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
            <Select value={lead.stage} onValueChange={(newStage) => onChangeStage(newStage)}>
              <SelectTrigger 
                className={`w-full font-medium rounded shadow-sm h-7 text-[10px] ${stageBadge.bgColor.startsWith('bg-') ? stageBadge.bgColor : ''} ${stageBadge.textColor} border-0`}
                style={!stageBadge.bgColor.startsWith('bg-') ? { backgroundColor: stageBadge.bgColor } : undefined}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {stages.filter(stage => stage.stageKey && stage.stageKey.trim() !== '').map((stage) => {
                  const badge = stageBadgeMap[stage.stageKey] || { label: stage.name, bgColor: stage.color, textColor: 'text-gray-700 dark:text-gray-300' };
                  const isHexColor = !badge.bgColor.startsWith('bg-');
                  return (
                    <SelectItem key={stage.id} value={stage.stageKey}>
                      <span 
                        className={`inline-block px-2 py-0.5 rounded font-medium ${isHexColor ? '' : badge.bgColor} ${badge.textColor}`}
                        style={isHexColor ? { backgroundColor: badge.bgColor } : undefined}
                      >
                        {badge.label}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
          <Button 
            variant="outline"
            size="sm" 
            className="flex-shrink-0 rounded h-7 px-2 text-[10px] bg-white dark:bg-gray-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-700"
            onClick={(e) => { e.stopPropagation(); onViewDetails(); }}
            title="Ver detalles"
            data-testid={`button-details-${lead.id}`}
          >
            <BookOpen className="w-3.5 h-3.5 mr-1" />
            Detalles
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ListLeadRow({ 
  lead, 
  onToggleActivity,
  onChangeStage,
  onDelete,
  currentUser,
  stageBadgeMap,
  stages
}: { 
  lead: CrmLead; 
  onToggleActivity: (field: 'hasCall' | 'hasWhatsapp') => void;
  onChangeStage: (stage: string) => void;
  onDelete: () => void;
  currentUser: any;
  stageBadgeMap: Record<string, { label: string; bgColor: string; textColor: string }>;
  stages: CrmStage[];
}) {
  const stageBadge = stageBadgeMap[lead.stage] || { label: lead.stage, bgColor: 'bg-gray-100', textColor: 'text-gray-700' };
  const isAdmin = currentUser?.role === 'admin';
  
  const initials = lead.clientName
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const avatarColors = [
    'bg-gradient-to-br from-blue-400 to-blue-600',
    'bg-gradient-to-br from-purple-400 to-purple-600',
    'bg-gradient-to-br from-pink-400 to-pink-600',
    'bg-gradient-to-br from-green-400 to-green-600',
    'bg-gradient-to-br from-orange-400 to-orange-600',
    'bg-gradient-to-br from-teal-400 to-teal-600',
  ];
  const avatarColor = avatarColors[lead.id.charCodeAt(0) % avatarColors.length];

  const daysSinceUpdate = getDaysSinceUpdate(lead);
  const alert = getInactivityAlert(daysSinceUpdate);

  return (
    <Card className="hover:shadow-sm transition-shadow bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800" data-testid={`row-lead-${lead.id}`}>
      <CardContent className="p-4">
        <div className="space-y-3">
          <div className="flex items-center gap-4">
            {/* Avatar */}
            <div className={`w-10 h-10 rounded-full ${avatarColor} flex items-center justify-center text-white font-semibold text-sm shadow-md flex-shrink-0`}>
              {initials}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-4 gap-2 sm:gap-4">
            <div className="min-w-0">
              <h4 className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate">
                {lead.clientName}
              </h4>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {lead.createdAt ? new Date(lead.createdAt).toLocaleDateString('es-CL') : ''}
              </p>
            </div>
            
            <div className="min-w-0">
              {lead.clientPhone && (
                <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                  <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate">{lead.clientPhone}</span>
                </div>
              )}
              {lead.clientEmail && (
                <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400 mt-1">
                  <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate">{lead.clientEmail}</span>
                </div>
              )}
            </div>

            <div className="flex items-center min-w-[140px]">
              <Select value={lead.stage} onValueChange={(newStage) => onChangeStage(newStage)}>
                <SelectTrigger 
                  className={`w-full h-8 text-xs font-medium ${stageBadge.bgColor.startsWith('bg-') ? stageBadge.bgColor : ''} ${stageBadge.textColor} border-0`}
                  style={!stageBadge.bgColor.startsWith('bg-') ? { backgroundColor: stageBadge.bgColor } : undefined}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {stages.filter(stage => stage.stageKey && stage.stageKey.trim() !== '').map((stage) => {
                    const badge = stageBadgeMap[stage.stageKey] || { label: stage.name, bgColor: stage.color, textColor: 'text-gray-700 dark:text-gray-300' };
                    const isHexColor = !badge.bgColor.startsWith('bg-');
                    return (
                      <SelectItem key={stage.id} value={stage.stageKey}>
                        <span 
                          className={`inline-block px-2 py-0.5 rounded ${isHexColor ? '' : badge.bgColor} ${badge.textColor}`}
                          style={isHexColor ? { backgroundColor: badge.bgColor } : undefined}
                        >
                          {badge.label}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2 justify-start sm:justify-end">
              <Button
                variant="ghost"
                size="sm"
                className={`h-8 w-8 p-0 ${
                  lead.hasCall ? 'text-green-600 bg-green-50 dark:bg-green-900/20' : ''
                }`}
                onClick={() => onToggleActivity('hasCall')}
                data-testid={`checkbox-llamada-${lead.id}`}
              >
                <Phone className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className={`h-8 w-8 p-0 ${
                  lead.hasWhatsapp ? 'text-green-600 bg-green-50 dark:bg-green-900/20' : ''
                }`}
                onClick={() => onToggleActivity('hasWhatsapp')}
                data-testid={`checkbox-whatsapp-${lead.id}`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
              </Button>
              
              {isAdmin && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 w-8 p-0 hover:bg-red-50 dark:hover:bg-red-900/20"
                  onClick={onDelete}
                  title="Eliminar lead"
                >
                  <Trash2 className="w-3.5 h-3.5 text-gray-600 hover:text-red-600" />
                </Button>
              )}
            </div>
          </div>
        </div>

          {/* Alerta de inactividad */}
          {alert && (
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ml-14 ${alert.bgColor} ${alert.borderColor}`} data-testid={`alert-inactivity-list-${lead.id}`}>
              <Clock className={`flex-shrink-0 w-4 h-4 ${alert.textColor}`} />
              <span className={`flex-1 font-medium text-xs ${alert.textColor}`}>
                {alert.message}
              </span>
              <AlertCircle className={`flex-shrink-0 w-4 h-4 ${alert.textColor}`} />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function LeadDetailModal({ 
  lead, 
  open, 
  onOpenChange 
}: { 
  lead: CrmLead | null; 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
}) {
  const [activeTab, setActiveTab] = useState<'info' | 'bitacora' | 'recomendaciones'>('info');

  // Reset tab when modal closes
  useEffect(() => {
    if (!open) {
      setActiveTab('info');
    }
  }, [open]);

  // Lazy-load recommendations only when tab is visited
  const { data: recommendations, isLoading: isLoadingRecommendations } = useQuery({
    queryKey: ['/api/crm/leads', lead?.id, 'recommendations'],
    enabled: open && activeTab === 'recomendaciones' && !!lead?.id,
  });

  if (!lead) return null;

  const stageBadge = STAGE_BADGE_MAP[lead.stage] || { label: lead.stage, bgColor: 'bg-gray-100 dark:bg-gray-800', textColor: 'text-gray-700 dark:text-gray-300' };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" data-testid={`modal-lead-detail-${lead.id}`}>
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-gray-900 dark:text-gray-100">
            {lead.clientName}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="info" data-testid="tab-trigger-info">Información</TabsTrigger>
            <TabsTrigger value="bitacora" data-testid="tab-trigger-bitacora">Bitácora</TabsTrigger>
            <TabsTrigger value="recomendaciones" data-testid="tab-trigger-recomendaciones">Recomendaciones</TabsTrigger>
          </TabsList>

          {/* Tab: Información */}
          <TabsContent value="info" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-sm font-medium text-gray-500 dark:text-gray-400">Cliente</Label>
                <p className="text-base font-semibold text-gray-900 dark:text-gray-100">{lead.clientName}</p>
              </div>
              {lead.clientPhone && (
                <div className="space-y-1">
                  <Label className="text-sm font-medium text-gray-500 dark:text-gray-400 flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    Teléfono
                  </Label>
                  <div className="flex items-center gap-2">
                    <p className="text-base text-gray-900 dark:text-gray-100">{lead.clientPhone}</p>
                    {lead.hasWhatsapp && (
                      <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 flex items-center gap-1">
                        <MessageSquare className="w-3 h-3" />
                        WhatsApp
                      </Badge>
                    )}
                  </div>
                </div>
              )}
              {lead.clientEmail && (
                <div className="space-y-1">
                  <Label className="text-sm font-medium text-gray-500 dark:text-gray-400 flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    Email
                  </Label>
                  <p className="text-base text-gray-900 dark:text-gray-100">{lead.clientEmail}</p>
                </div>
              )}
              {lead.clientCompany && (
                <div className="space-y-1">
                  <Label className="text-sm font-medium text-gray-500 dark:text-gray-400">Empresa</Label>
                  <p className="text-base text-gray-900 dark:text-gray-100">{lead.clientCompany}</p>
                </div>
              )}
              {lead.clientAddress && (
                <div className="space-y-1">
                  <Label className="text-sm font-medium text-gray-500 dark:text-gray-400">Dirección</Label>
                  <p className="text-base text-gray-900 dark:text-gray-100">{lead.clientAddress}</p>
                </div>
              )}
              {lead.segment && (
                <div className="space-y-1">
                  <Label className="text-sm font-medium text-gray-500 dark:text-gray-400">Segmento</Label>
                  <p className="text-base text-gray-900 dark:text-gray-100">{lead.segment}</p>
                </div>
              )}
              <div className="space-y-1">
                <Label className="text-sm font-medium text-gray-500 dark:text-gray-400">Etapa</Label>
                <Badge className={`${stageBadge.bgColor} ${stageBadge.textColor} font-medium`}>
                  {stageBadge.label}
                </Badge>
              </div>
              <div className="space-y-1">
                <Label className="text-sm font-medium text-gray-500 dark:text-gray-400">Tipo de Cliente</Label>
                <Badge className={lead.clientType === 'recurrente' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'}>
                  {lead.clientType === 'recurrente' ? 'Cliente Recurrente' : 'Cliente Nuevo'}
                </Badge>
              </div>
              {lead.nombreObra && (
                <div className="space-y-1 md:col-span-2">
                  <Label className="text-sm font-medium text-gray-500 dark:text-gray-400">Nombre de Obra</Label>
                  <p className="text-base text-gray-900 dark:text-gray-100">{lead.nombreObra}</p>
                </div>
              )}
              {lead.notes && (
                <div className="space-y-1 md:col-span-2">
                  <Label className="text-sm font-medium text-gray-500 dark:text-gray-400">Notas</Label>
                  <p className="text-base text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{lead.notes}</p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Tab: Bitácora */}
          <TabsContent value="bitacora">
            <LeadComments leadId={lead.id} />
          </TabsContent>

          {/* Tab: Recomendaciones */}
          <TabsContent value="recomendaciones" className="space-y-4">
            {isLoadingRecommendations ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-32 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : recommendations ? (
              <div className="space-y-4">
                {/* Actividad del Cliente */}
                <Card>
                  <CardContent className="p-4 space-y-3">
                    <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100 flex items-center gap-2">
                      <User className="w-5 h-5" />
                      Actividad del Cliente
                    </h3>
                    {recommendations.clientActivity.isInactive ? (
                      <div className="space-y-2">
                        <Alert className="bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800">
                          <AlertCircle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                          <AlertDescription className="text-orange-700 dark:text-orange-300">
                            Cliente inactivo desde hace {recommendations.clientActivity.daysSinceLastPurchase} días
                          </AlertDescription>
                        </Alert>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                            <p className="text-xs text-gray-500 dark:text-gray-400">Última Compra</p>
                            <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                              ${(recommendations.clientActivity.lastPurchaseAmount || 0).toLocaleString('es-CL')}
                            </p>
                          </div>
                          <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                            <p className="text-xs text-gray-500 dark:text-gray-400">Ventas Históricas</p>
                            <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                              ${(recommendations.clientActivity.totalHistoricalSales || 0).toLocaleString('es-CL')}
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 dark:text-gray-400">Cliente activo - sin alertas de inactividad</p>
                    )}
                  </CardContent>
                </Card>

                {/* Patrones Estacionales */}
                <Card>
                  <CardContent className="p-4 space-y-3">
                    <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100 flex items-center gap-2">
                      <Clock className="w-5 h-5" />
                      Patrones Estacionales
                    </h3>
                    {recommendations.isSeasonal ? (
                      <div className="space-y-2">
                        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                          <p className="text-sm font-medium text-blue-900 dark:text-blue-100">{recommendations.purchasePattern}</p>
                          <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                            Fecha esperada de compra: {recommendations.expectedPurchaseDate}
                          </p>
                          <p className="text-xs text-blue-700 dark:text-blue-300">
                            Monto promedio: ${(recommendations.averagePurchaseAmount || 0).toLocaleString('es-CL')}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 dark:text-gray-400">Sin patrones estacionales detectados</p>
                    )}
                  </CardContent>
                </Card>

                {/* Productos en Tendencia */}
                <Card>
                  <CardContent className="p-4 space-y-3">
                    <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100 flex items-center gap-2">
                      <AlertCircle className="w-5 h-5" />
                      Productos en Tendencia
                    </h3>
                    {recommendations.trendingProducts && recommendations.trendingProducts.length > 0 ? (
                      <div className="space-y-2">
                        {recommendations.trendingProducts.map((product: any, idx: number) => (
                          <div key={idx} className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                            <div className="flex items-center justify-between">
                              <p className="font-medium text-green-900 dark:text-green-100">{product.productName}</p>
                              <Badge className="bg-green-600 dark:bg-green-700 text-white">
                                +{product.growthRate}%
                              </Badge>
                            </div>
                            <p className="text-xs text-green-700 dark:text-green-300 mt-1">{product.recommendation}</p>
                            <p className="text-xs text-green-600 dark:text-green-400">
                              Ventas recientes: ${product.recentSales.toLocaleString('es-CL')}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 dark:text-gray-400">Sin productos recomendados</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  No se pudieron cargar las recomendaciones. Intenta nuevamente.
                </AlertDescription>
              </Alert>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function LeadComments({ leadId }: { leadId: string }) {
  const [newComment, setNewComment] = useState('');
  const { toast } = useToast();
  const { user } = useAuth();

  const { data: comments = [] } = useQuery<any[]>({
    queryKey: ['/api/crm/leads', leadId, 'comments'],
  });

  const addCommentMutation = useMutation({
    mutationFn: async (comment: string) => {
      const response = await apiRequest(`/api/crm/leads/${leadId}/comments`, {
        method: 'POST',
        data: { comment }
      });
      return response.json();
    },
    onMutate: async (newCommentText) => {
      // Cancelar queries en progreso
      await queryClient.cancelQueries({ queryKey: ['/api/crm/leads', leadId, 'comments'] });
      
      // Guardar el estado anterior
      const previousComments = queryClient.getQueryData(['/api/crm/leads', leadId, 'comments']);
      
      // Optimistically update con el nuevo comentario
      const optimisticComment = {
        id: `temp-${Date.now()}`,
        comment: newCommentText,
        userName: user?.salespersonName || `${user?.firstName} ${user?.lastName}`,
        createdAt: new Date().toISOString(),
      };
      
      queryClient.setQueryData(
        ['/api/crm/leads', leadId, 'comments'],
        (old: any[] = []) => [...old, optimisticComment]
      );
      
      // Limpiar input inmediatamente
      setNewComment('');
      
      return { previousComments };
    },
    onError: (err, newComment, context) => {
      // Revertir en caso de error
      if (context?.previousComments) {
        queryClient.setQueryData(['/api/crm/leads', leadId, 'comments'], context.previousComments);
      }
      toast({
        title: "Error",
        description: "No se pudo agregar el comentario",
        variant: "destructive",
      });
    },
    onSettled: () => {
      // Refetch después de que todo esté listo para sincronizar con el servidor
      queryClient.invalidateQueries({ queryKey: ['/api/crm/leads', leadId, 'comments'] });
    },
  });

  return (
    <div className="space-y-2">
      <div className="space-y-1 max-h-40 overflow-y-auto">
        {comments.map((comment) => (
          <div key={comment.id} className="text-xs bg-gray-50 dark:bg-gray-800 p-2 rounded">
            <div className="font-semibold text-gray-700 dark:text-gray-300">
              {comment.userName}
            </div>
            <div className="text-gray-600 dark:text-gray-400">{comment.comment}</div>
            <div className="text-gray-400 dark:text-gray-500 text-[10px] mt-1">
              {new Date(comment.createdAt).toLocaleString('es-CL')}
            </div>
          </div>
        ))}
        {comments.length === 0 && (
          <div className="text-center text-gray-400 text-xs py-2">Sin comentarios</div>
        )}
      </div>
      <div className="flex gap-2">
        <Input
          placeholder="Escribe un comentario..."
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && newComment.trim()) {
              e.preventDefault();
              addCommentMutation.mutate(newComment);
            }
          }}
          className="text-xs"
          data-testid={`input-comment-${leadId}`}
        />
        <Button
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            if (newComment.trim()) {
              addCommentMutation.mutate(newComment);
            }
          }}
          disabled={!newComment.trim() || addCommentMutation.isPending}
          data-testid={`button-add-comment-${leadId}`}
        >
          Enviar
        </Button>
      </div>
    </div>
  );
}

function CreateLeadForm({ onSuccess, prefilledData }: { onSuccess: () => void; prefilledData?: ClienteInactivo | null }) {
  const { toast } = useToast();
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(clientSearchQuery);
    }, 600);
    return () => clearTimeout(timer);
  }, [clientSearchQuery]);

  const { data: segments = [] } = useQuery<string[]>({
    queryKey: ['/api/goals/data/segments'],
  });

  const { data: users = [] } = useQuery<any[]>({
    queryKey: ['/api/users'],
  });

  // Buscar clientes usando el mismo endpoint que tomador-pedidos
  const { data: clientsData, isLoading: isSearching } = useQuery({
    queryKey: ['/api/clients', { search: debouncedSearchQuery }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (debouncedSearchQuery) params.set('search', debouncedSearchQuery);
      params.set('limit', '50');
      params.set('offset', '0');
      
      const response = await fetch(`/api/clients?${params}`, { credentials: 'include' });
      if (!response.ok) throw new Error('Error al buscar clientes');
      return response.json();
    },
    enabled: debouncedSearchQuery.trim().length >= 2,
  });

  const clients = clientsData?.clients || [];

  // Obtener etapas disponibles para usar la primera como valor por defecto
  const { data: stages = [] } = useQuery<CrmStage[]>({
    queryKey: ['/api/crm/stages'],
  });

  // Obtener la primera etapa disponible (la de menor order)
  const defaultStage = stages.length > 0 ? stages[0].stageKey : 'lead';

  // Cerrar dropdown cuando se hace clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowClientDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Create validation schema for the form
  const formSchema = z.object({
    clientName: z.string().min(1, "Nombre del cliente es requerido"),
    salespersonId: z.string().min(1, "Vendedor es requerido"),
    stage: z.string().default(defaultStage),
    clientPhone: z.string().optional(),
    clientEmail: z.string().email("Email inválido").optional().or(z.literal("")),
    clientCompany: z.string().optional(),
    clientAddress: z.string().optional(),
    segment: z.string().optional(),
    notes: z.string().optional(),
    clientType: z.enum(["nuevo", "recurrente"]).default("nuevo"),
    nombreObra: z.string().optional(),
  });

  const { user: currentUser } = useAuth();
  const isSalesperson = currentUser?.role === 'salesperson';

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      clientName: prefilledData?.clientName || '',
      clientPhone: prefilledData?.clientPhone || '',
      clientEmail: prefilledData?.clientEmail || '',
      clientCompany: '',
      clientAddress: '',
      segment: prefilledData?.segment || '',
      salespersonId: prefilledData?.salespersonId || (isSalesperson ? currentUser?.id || '' : ''),
      notes: '',
      stage: defaultStage,
      clientType: prefilledData ? 'recurrente' : 'nuevo',
      nombreObra: '',
    },
  });

  // Update form when prefilledData changes (cliente inactivo desde panel)
  useEffect(() => {
    if (prefilledData) {
      // Auto-rellenar todos los campos inmediatamente cuando se hace clic en "Añadir al CRM"
      form.reset({
        clientName: prefilledData.clientName || '',
        clientPhone: prefilledData.clientPhone || '',
        clientEmail: prefilledData.clientEmail || '',
        clientCompany: '',
        clientAddress: prefilledData.clientAddress || '',
        segment: prefilledData.segment || '',
        salespersonId: prefilledData.salespersonId || '',
        notes: `Cliente inactivo desde hace ${prefilledData.daysSinceLastPurchase} días`,
        stage: defaultStage,
        clientType: 'recurrente',
        nombreObra: '',
      });
      
      // Marcar como cliente asociado
      setClientSearchQuery(prefilledData.clientName || '');
      setSelectedClientId(prefilledData.clientName || '');
    }
  }, [prefilledData, defaultStage]);

  // Función para auto-rellenar el formulario cuando se selecciona un cliente del buscador
  const handleClientSelect = (client: any) => {
    setSelectedClientId(client.id || client.koen);
    setClientSearchQuery(client.clientName || client.nokoen || '');
    setShowClientDropdown(false);
    
    // Rellenar con datos del cliente (estructura de /api/clients)
    form.setValue('clientName', client.clientName || client.nokoen || '');
    form.setValue('clientCompany', client.businessName || client.rten || '');
    form.setValue('clientAddress', client.address || client.dien || '');
    form.setValue('segment', client.segment || client.gien || '');
    form.setValue('clientType', 'recurrente'); // Cliente existente = recurrente
    
    // Email y teléfono
    if (client.email) form.setValue('clientEmail', client.email);
    if (client.phone || client.foen) form.setValue('clientPhone', client.phone || client.foen);
  };

  const handleClearClient = () => {
    setSelectedClientId('');
    setClientSearchQuery('');
    setShowClientDropdown(false);
    form.reset();
  };

  const createLeadMutation = useMutation({
    mutationFn: async (data: any): Promise<CrmLead> => {
      console.log('🚀 [CREATE LEAD] Mutation started with data:', data);
      
      // Clean up empty strings to null for optional fields
      const cleanData = {
        clientName: data.clientName,
        salespersonId: data.salespersonId,
        stage: data.stage || defaultStage,
        clientPhone: data.clientPhone || null,
        clientEmail: data.clientEmail || null,
        clientCompany: data.clientCompany || null,
        clientAddress: data.clientAddress || null,
        segment: data.segment || null,
        notes: data.notes || null,
        hasHistoricalSales: data.clientType === 'recurrente',
        clientType: data.clientType || 'nuevo',
        nombreObra: data.nombreObra || null,
      };
      
      console.log('📤 [CREATE LEAD] Sending cleaned data to backend:', cleanData);
      
      try {
        const response = await apiRequest('/api/crm/leads', {
          method: 'POST',
          data: cleanData
        });
        const result = await response.json();
        console.log('✅ [CREATE LEAD] Success response:', result);
        return result;
      } catch (error) {
        console.error('❌ [CREATE LEAD] Error:', error);
        throw error;
      }
    },
    onSuccess: async (newLead) => {
      console.log('🎉 [CREATE LEAD] Success! New lead:', newLead);
      
      // If this lead was created from an inactive client, mark it as added
      if (prefilledData?.id) {
        try {
          await apiRequest(`/api/crm/inactive-clients/${prefilledData.id}/add-to-crm`, {
            method: 'POST',
            data: { leadId: newLead.id }
          });
          console.log('✅ [CREATE LEAD] Inactive client marked as added to CRM');
          queryClient.invalidateQueries({ queryKey: ['/api/crm/inactive-clients'] });
        } catch (error) {
          console.error('❌ [CREATE LEAD] Failed to mark inactive client as added:', error);
        }
      }
      
      queryClient.invalidateQueries({ queryKey: ['/api/crm/leads'] });
      toast({
        title: "Lead creado",
        description: prefilledData 
          ? "El cliente inactivo ha sido añadido al CRM exitosamente"
          : "El lead ha sido creado exitosamente",
      });
      form.reset();
      onSuccess();
    },
    onError: (error: any) => {
      console.error('Error creating lead:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudo crear el lead",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: any) => {
    console.log('📝 [FORM SUBMIT] Form data:', data);
    console.log('📝 [FORM SUBMIT] Form errors:', form.formState.errors);
    console.log('📝 [FORM SUBMIT] Form is valid:', form.formState.isValid);
    
    createLeadMutation.mutate(data);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {/* Buscador de Cliente Existente */}
        <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Buscar Cliente Existente (opcional)
          </label>
          <div className="relative" ref={dropdownRef}>
            <Input
              placeholder="Escribe para buscar cliente por nombre, empresa o código..."
              value={clientSearchQuery}
              onChange={(e) => {
                const value = e.target.value;
                setClientSearchQuery(value);
                // Solo mostrar dropdown si hay al menos 2 caracteres
                setShowClientDropdown(value.trim().length >= 2);
              }}
              className="w-full"
              data-testid="input-search-client"
            />
            {selectedClientId && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 px-2"
                onClick={handleClearClient}
              >
                ✕
              </Button>
            )}
            
            {/* Dropdown de resultados */}
            {showClientDropdown && debouncedSearchQuery.trim().length >= 2 && (
              <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-60 overflow-y-auto">
                {isSearching ? (
                  <div className="px-3 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                    Buscando...
                  </div>
                ) : clients.length > 0 ? (
                  clients.map((client: any) => (
                    <button
                      key={client.id || client.koen}
                      type="button"
                      className="w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-0"
                      onClick={() => handleClientSelect(client)}
                      data-testid={`client-option-${client.id || client.koen}`}
                    >
                      <div className="font-medium text-sm text-gray-900 dark:text-gray-100">
                        {client.clientName || client.nokoen}
                      </div>
                      {(client.businessName || client.rten) && (
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {client.businessName || client.rten}
                        </div>
                      )}
                      {(client.rut || client.koen) && (
                        <div className="text-xs text-gray-400 dark:text-gray-500">
                          RUT: {client.rut || client.koen}
                        </div>
                      )}
                      {(client.segment || client.gien) && (
                        <div className="text-xs text-blue-600 dark:text-blue-400">
                          {client.segment || client.gien}
                        </div>
                      )}
                    </button>
                  ))
                ) : (
                  <div className="px-3 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                    No se encontraron clientes con ese criterio.
                  </div>
                )}
              </div>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Los resultados aparecerán al escribir al menos 2 caracteres. Deja vacío para crear un lead completamente nuevo.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="clientName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nombre del Cliente *</FormLabel>
                <FormControl>
                  <Input {...field} data-testid="input-client-name" placeholder="Juan Pérez" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="clientCompany"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Empresa</FormLabel>
                <FormControl>
                  <Input {...field} data-testid="input-company-name" placeholder="Empresa S.A." />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="clientPhone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Teléfono</FormLabel>
                <FormControl>
                  <Input {...field} data-testid="input-phone" placeholder="+56 9 1234 5678" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="clientEmail"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input {...field} type="email" data-testid="input-email" placeholder="correo@ejemplo.com" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className={`grid grid-cols-1 ${!isSalesperson ? 'sm:grid-cols-2' : ''} gap-4`}>
          <FormField
            control={form.control}
            name="segment"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Segmento</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-segment">
                      <SelectValue placeholder="Selecciona segmento" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {segments.map((segment) => (
                      <SelectItem key={segment} value={segment}>{segment}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          {!isSalesperson && (
            <FormField
              control={form.control}
              name="salespersonId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Vendedor Asignado *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-salesperson">
                        <SelectValue placeholder="Selecciona vendedor" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {users
                        .filter((u: any) => u.role === 'salesperson' || u.role === 'supervisor' || u.role === 'admin')
                        .map((user: any) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.salespersonName || user.firstName || user.email}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </div>

        <FormField
          control={form.control}
          name="clientAddress"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Dirección</FormLabel>
              <FormControl>
                <Input {...field} data-testid="input-address" placeholder="Av. Principal 123, Santiago" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="clientType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tipo de Cliente *</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger data-testid="select-client-type">
                    <SelectValue placeholder="Selecciona tipo de cliente" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="nuevo">Cliente Nuevo</SelectItem>
                  <SelectItem value="recurrente">Cliente Recurrente</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {form.watch('segment')?.toLowerCase().includes('construc') && (
          <FormField
            control={form.control}
            name="nombreObra"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nombre de la Obra</FormLabel>
                <FormControl>
                  <Input {...field} data-testid="input-nombre-obra" placeholder="Ej: Edificio Los Ángeles, Casa Particular" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notas</FormLabel>
              <FormControl>
                <Textarea {...field} rows={3} data-testid="textarea-notes" placeholder="Notas adicionales..." />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2 pt-4">
          <Button type="submit" disabled={createLeadMutation.isPending} data-testid="button-submit-lead">
            {createLeadMutation.isPending ? 'Creando...' : 'Crear Lead'}
          </Button>
        </div>
      </form>
    </Form>
  );
}

function EditLeadDialog({ 
  lead, 
  open, 
  onOpenChange,
  onDelete 
}: { 
  lead: CrmLead; 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
  onDelete: () => void;
}) {
  const { toast } = useToast();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const { data: segments = [] } = useQuery<string[]>({
    queryKey: ['/api/goals/data/segments'],
  });

  const { data: users = [] } = useQuery<any[]>({
    queryKey: ['/api/users'],
  });

  const formSchema = z.object({
    clientName: z.string().min(1, "Nombre del cliente es requerido"),
    salespersonId: z.string().min(1, "Vendedor es requerido"),
    clientPhone: z.string().optional(),
    clientEmail: z.string().email("Email inválido").optional().or(z.literal("")),
    clientCompany: z.string().optional(),
    clientAddress: z.string().optional(),
    segment: z.string().optional(),
    notes: z.string().optional(),
    clientType: z.enum(["nuevo", "recurrente"]).default("nuevo"),
    nombreObra: z.string().optional(),
  });

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      clientName: lead.clientName || '',
      clientPhone: lead.clientPhone || '',
      clientEmail: lead.clientEmail || '',
      clientCompany: lead.clientCompany || '',
      clientAddress: lead.clientAddress || '',
      segment: lead.segment || '',
      salespersonId: lead.salespersonId || '',
      notes: lead.notes || '',
      clientType: lead.clientType || 'nuevo',
      nombreObra: lead.nombreObra || '',
    },
  });

  // Reset form when lead changes or dialog opens
  useEffect(() => {
    if (open) {
      form.reset({
        clientName: lead.clientName || '',
        clientPhone: lead.clientPhone || '',
        clientEmail: lead.clientEmail || '',
        clientCompany: lead.clientCompany || '',
        clientAddress: lead.clientAddress || '',
        segment: lead.segment || '',
        salespersonId: lead.salespersonId || '',
        notes: lead.notes || '',
        clientType: lead.clientType || 'nuevo',
        nombreObra: lead.nombreObra || '',
      });
    }
  }, [open, lead, form]);

  const updateLeadMutation = useMutation({
    mutationFn: async (data: any) => {
      // Find the selected salesperson's name from users list
      const selectedUser = users.find((u: any) => u.id === data.salespersonId);
      const salespersonName = selectedUser?.salespersonName || selectedUser?.firstName || selectedUser?.email || lead.salespersonName;
      
      const cleanData = {
        clientName: data.clientName,
        salespersonId: data.salespersonId,
        salespersonName: salespersonName, // Preserve denormalized name
        supervisorId: lead.supervisorId, // Preserve supervisor assignment
        clientPhone: data.clientPhone || null,
        clientEmail: data.clientEmail || null,
        clientCompany: data.clientCompany || null,
        clientAddress: data.clientAddress || null,
        segment: data.segment || null,
        notes: data.notes || null,
        clientType: data.clientType || 'nuevo',
        nombreObra: data.nombreObra || null,
        hasHistoricalSales: data.clientType === 'recurrente',
      };
      
      return apiRequest(`/api/crm/leads/${lead.id}`, {
        method: 'PUT',
        data: cleanData
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/leads'] });
      toast({
        title: "Lead actualizado",
        description: "Los cambios se han guardado exitosamente",
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo actualizar el lead",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: any) => {
    updateLeadMutation.mutate(data);
  };

  const handleDelete = () => {
    onDelete();
    setShowDeleteConfirm(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Lead</DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="clientName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre del Cliente *</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-edit-client-name" placeholder="Juan Pérez" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="clientCompany"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Empresa</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-edit-company-name" placeholder="Empresa S.A." />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="clientPhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Teléfono</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-edit-phone" placeholder="+56 9 1234 5678" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="clientEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input {...field} type="email" data-testid="input-edit-email" placeholder="correo@ejemplo.com" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="segment"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Segmento</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-edit-segment">
                          <SelectValue placeholder="Selecciona segmento" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {segments.map((segment) => (
                          <SelectItem key={segment} value={segment}>{segment}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="salespersonId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vendedor Asignado *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-edit-salesperson">
                          <SelectValue placeholder="Selecciona vendedor" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {users
                          .filter((u: any) => u.role === 'salesperson' || u.role === 'supervisor' || u.role === 'admin')
                          .map((user: any) => (
                            <SelectItem key={user.id} value={user.id}>
                              {user.salespersonName || user.firstName || user.email}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="clientAddress"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Dirección</FormLabel>
                  <FormControl>
                    <Input {...field} data-testid="input-edit-address" placeholder="Av. Principal 123, Santiago" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="clientType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Cliente *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-edit-client-type">
                        <SelectValue placeholder="Selecciona tipo de cliente" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="nuevo">Cliente Nuevo</SelectItem>
                      <SelectItem value="recurrente">Cliente Recurrente</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {form.watch('segment')?.toLowerCase().includes('construc') && (
              <FormField
                control={form.control}
                name="nombreObra"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre de la Obra</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-edit-nombre-obra" placeholder="Ej: Edificio Los Ángeles, Casa Particular" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notas</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={3} data-testid="textarea-edit-notes" placeholder="Notas adicionales..." />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-between items-center gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
              {!showDeleteConfirm ? (
                <>
                  <Button 
                    type="button" 
                    variant="destructive" 
                    onClick={() => setShowDeleteConfirm(true)}
                    data-testid="button-show-delete-confirm"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Eliminar Lead
                  </Button>
                  <div className="flex gap-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => onOpenChange(false)}
                      data-testid="button-cancel-edit"
                    >
                      Cancelar
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={updateLeadMutation.isPending}
                      data-testid="button-submit-edit-lead"
                    >
                      {updateLeadMutation.isPending ? 'Guardando...' : 'Guardar Cambios'}
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm text-red-600 dark:text-red-400 font-medium">
                    ¿Estás seguro de eliminar este lead?
                  </p>
                  <div className="flex gap-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setShowDeleteConfirm(false)}
                      data-testid="button-cancel-delete"
                    >
                      Cancelar
                    </Button>
                    <Button 
                      type="button" 
                      variant="destructive" 
                      onClick={handleDelete}
                      data-testid="button-confirm-delete"
                    >
                      Sí, Eliminar
                    </Button>
                  </div>
                </>
              )}
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function StageManagementDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { toast } = useToast();
  const [editingStage, setEditingStage] = useState<CrmStage | null>(null);
  const [newStageName, setNewStageName] = useState('');
  const [newStageColor, setNewStageColor] = useState('#e5e7eb');

  const { data: stages = [], isLoading } = useQuery<CrmStage[]>({
    queryKey: ['/api/crm/stages'],
  });

  const createStageMutation = useMutation({
    mutationFn: async (data: { name: string; color: string }) => {
      return apiRequest('/api/crm/stages', {
        method: 'POST',
        data: {
          name: data.name,
          stageKey: data.name.toLowerCase().replace(/\s+/g, '_'),
          color: data.color,
          order: stages.length
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/stages'] });
      toast({ title: "Etapa creada", description: "La etapa ha sido creada exitosamente" });
      setNewStageName('');
      setNewStageColor('#e5e7eb');
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo crear la etapa", variant: "destructive" });
    },
  });

  const updateStageMutation = useMutation({
    mutationFn: async ({ id, name, color }: { id: string; name: string; color: string }) => {
      return apiRequest(`/api/crm/stages/${id}`, {
        method: 'PUT',
        data: { name, color }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/stages'] });
      toast({ title: "Etapa actualizada", description: "La etapa ha sido actualizada exitosamente" });
      setEditingStage(null);
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo actualizar la etapa", variant: "destructive" });
    },
  });

  const deleteStageMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/crm/stages/${id}`, {
        method: 'DELETE'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/stages'] });
      toast({ title: "Etapa eliminada", description: "La etapa ha sido eliminada exitosamente" });
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo eliminar la etapa", variant: "destructive" });
    },
  });

  const handleCreate = () => {
    if (!newStageName.trim()) {
      toast({ title: "Error", description: "El nombre de la etapa es requerido", variant: "destructive" });
      return;
    }
    createStageMutation.mutate({ name: newStageName, color: newStageColor });
  };

  const handleUpdate = () => {
    if (!editingStage || !editingStage.name.trim()) {
      toast({ title: "Error", description: "El nombre de la etapa es requerido", variant: "destructive" });
      return;
    }
    updateStageMutation.mutate({ id: editingStage.id, name: editingStage.name, color: editingStage.color });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Administrar Etapas del Pipeline</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Crear Nueva Etapa */}
          <div className="p-4 border border-dashed border-gray-300 dark:border-gray-700 rounded-lg">
            <h3 className="font-medium mb-3">Crear Nueva Etapa</h3>
            <div className="flex gap-2">
              <Input
                placeholder="Nombre de la etapa"
                value={newStageName}
                onChange={(e) => setNewStageName(e.target.value)}
                className="flex-1"
                data-testid="input-new-stage-name"
              />
              <input
                type="color"
                value={newStageColor}
                onChange={(e) => setNewStageColor(e.target.value)}
                className="w-12 h-10 rounded cursor-pointer"
                title="Color de la etapa"
              />
              <Button 
                onClick={handleCreate}
                disabled={createStageMutation.isPending}
                data-testid="button-create-stage"
              >
                <Plus className="w-4 h-4 mr-2" />
                Crear
              </Button>
            </div>
          </div>

          {/* Lista de Etapas Existentes */}
          <div>
            <h3 className="font-medium mb-3">Etapas Existentes</h3>
            {isLoading ? (
              <div className="text-center py-4 text-gray-500">Cargando...</div>
            ) : stages.length === 0 ? (
              <div className="text-center py-4 text-gray-500">No hay etapas creadas</div>
            ) : (
              <div className="space-y-2">
                {stages.map((stage) => (
                  <div
                    key={stage.id}
                    className="flex items-center gap-2 p-3 border border-gray-200 dark:border-gray-800 rounded-lg"
                    data-testid={`stage-item-${stage.id}`}
                  >
                    {editingStage?.id === stage.id ? (
                      <>
                        <Input
                          value={editingStage.name}
                          onChange={(e) => setEditingStage({ ...editingStage, name: e.target.value })}
                          className="flex-1"
                          data-testid={`input-edit-stage-${stage.id}`}
                        />
                        <input
                          type="color"
                          value={editingStage.color}
                          onChange={(e) => setEditingStage({ ...editingStage, color: e.target.value })}
                          className="w-12 h-10 rounded cursor-pointer"
                        />
                        <Button
                          size="sm"
                          onClick={handleUpdate}
                          disabled={updateStageMutation.isPending}
                          data-testid={`button-save-stage-${stage.id}`}
                        >
                          Guardar
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingStage(null)}
                          data-testid={`button-cancel-edit-${stage.id}`}
                        >
                          Cancelar
                        </Button>
                      </>
                    ) : (
                      <>
                        <div
                          className="w-8 h-8 rounded flex-shrink-0"
                          style={{ backgroundColor: stage.color }}
                        />
                        <span className="flex-1 font-medium">{stage.name}</span>
                        <span className="text-xs text-gray-500">({stage.stageKey})</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingStage(stage)}
                          data-testid={`button-edit-stage-${stage.id}`}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            if (confirm(`¿Estás seguro de eliminar la etapa "${stage.name}"?`)) {
                              deleteStageMutation.mutate(stage.id);
                            }
                          }}
                          disabled={deleteStageMutation.isPending}
                          data-testid={`button-delete-stage-${stage.id}`}
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
