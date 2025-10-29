import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { Plus, Phone, MessageSquare, Building2, Mail, MoreVertical, Filter, Grid3x3, List, Download, BookOpen, Trash2, Settings } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { CrmLead, CrmStage, InsertCrmLeadInput } from "@shared/schema";
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

export default function CRMPage() {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'leads' | 'promesas'>('leads');
  const [searchQuery, setSearchQuery] = useState('');
  const [segmentFilter, setSegmentFilter] = useState('all');
  const [vendedorFilter, setVendedorFilter] = useState('all');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  
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

  const { data: leads = [], isLoading } = useQuery<CrmLead[]>({
    queryKey: ['/api/crm/leads'],
  });

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

  // Filter leads by search query, segment, and salesperson
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
    
    return matchesSearch && matchesSegment && matchesVendedor;
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
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
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
              <CreateLeadForm onSuccess={() => setIsCreateDialogOpen(false)} />
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
          {/* Barra de búsqueda y filtros */}
          <div className="flex flex-col lg:flex-row items-start lg:items-center gap-2 sm:gap-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 flex-1 w-full">
              {/* Filtro de Segmento */}
              <Select value={segmentFilter} onValueChange={setSegmentFilter}>
                <SelectTrigger className="w-full sm:w-[200px] h-8 sm:h-10 text-xs sm:text-sm" data-testid="select-segment-filter">
                  <SelectValue placeholder="Todos los segmentos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los segmentos</SelectItem>
                  {segments.map((segment) => (
                    <SelectItem key={segment} value={segment}>{segment}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {/* Filtro de Vendedor */}
              <Select value={vendedorFilter} onValueChange={setVendedorFilter}>
                <SelectTrigger className="w-full sm:w-[200px] h-8 sm:h-10 text-xs sm:text-sm" data-testid="select-vendedor-filter">
                  <SelectValue placeholder="Todos los vendedores" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los vendedores</SelectItem>
                  {salespeople.filter(sp => sp && sp !== '.').map((salesperson) => (
                    <SelectItem key={salesperson} value={salesperson}>{salesperson}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Buscador */}
              <div className="flex-1 w-full min-w-[200px]">
                <Input
                  placeholder="Buscar..."
                  className="h-8 sm:h-10 text-xs sm:text-sm"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  data-testid="input-search-leads"
                />
              </div>
            </div>
            
            {isAdmin && (
              <Button variant="outline" size="sm" className="h-8 sm:h-9 hidden sm:flex" data-testid="button-manage-stages">
                <Settings className="w-4 h-4 mr-2" />
                Administrar Etapas
              </Button>
            )}
          </div>

          {/* Vista Desktop: Kanban - Columnas por etapa */}
          {!isMobile ? (
            <div className="overflow-x-auto pb-4" ref={scrollContainerRef}>
              <div className="flex gap-4" style={{ minWidth: 'max-content' }}>
              {stages.map((stage) => {
                const stageLeads = leadsByStage[stage.stageKey] || [];
                const stageBadge = STAGE_BADGE_MAP[stage.stageKey] || { 
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
                          <div className={`h-1 rounded-full ${stageBadge.bgColor}`} />
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
                                onToggleActivity={(field) => {
                                  const currentValue = field === 'hasCall' ? lead.hasCall : lead.hasWhatsapp;
                                  toggleActivityMutation.mutate({ id: lead.id, field, value: !currentValue });
                                }}
                                onChangeStage={(newStage) => updateStageMutation.mutate({ id: lead.id, stage: newStage })}
                                onDelete={() => deleteLeadMutation.mutate(lead.id)}
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
                const stageBadge = STAGE_BADGE_MAP[stage.stageKey] || { 
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
                        <div className={`h-2.5 w-0.5 rounded-full ${stageBadge.bgColor}`} />
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
                          onToggleActivity={(field) => {
                            const currentValue = field === 'hasCall' ? lead.hasCall : lead.hasWhatsapp;
                            toggleActivityMutation.mutate({ id: lead.id, field, value: !currentValue });
                          }}
                          onChangeStage={(newStage) => updateStageMutation.mutate({ id: lead.id, stage: newStage })}
                          onDelete={() => deleteLeadMutation.mutate(lead.id)}
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
    </div>
  );
}

function LeadCard({ 
  lead, 
  onToggleActivity,
  onChangeStage,
  onDelete,
  currentUser,
  isMobile = false
}: { 
  lead: CrmLead; 
  onToggleActivity: (field: 'hasCall' | 'hasWhatsapp') => void;
  onChangeStage: (stage: string) => void;
  onDelete: () => void;
  currentUser: any;
  isMobile?: boolean;
}) {
  const [showComments, setShowComments] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const stageBadge = STAGE_BADGE_MAP[lead.stage] || { label: lead.stage, bgColor: 'bg-gray-100', textColor: 'text-gray-700' };
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
      className={`hover:shadow-md transition-all bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 ${!isMobile ? 'cursor-move' : ''} ${isDragging ? 'opacity-50' : ''}`} 
      data-testid={`card-lead-${lead.id}`}
      draggable={!isMobile}
      onDragStart={!isMobile ? handleDragStart : undefined}
      onDragEnd={!isMobile ? handleDragEnd : undefined}
    >
      <CardContent className={isMobile ? "p-3 space-y-2" : "p-5 space-y-4"}>
        {/* Header con avatar y acciones */}
        <div className="flex items-start justify-between">
          <div className={`flex items-center flex-1 ${isMobile ? 'gap-2' : 'gap-3'}`}>
            <div className={`rounded-full ${avatarColor} flex items-center justify-center text-white font-semibold shadow-md flex-shrink-0 ${isMobile ? 'w-9 h-9 text-xs' : 'w-12 h-12 text-sm'}`}>
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className={`font-semibold text-gray-900 dark:text-gray-100 truncate ${isMobile ? 'text-sm' : 'text-base'}`}>
                {lead.clientName}
              </h4>
              <p className={`text-gray-500 dark:text-gray-400 mt-0.5 ${isMobile ? 'text-[10px]' : 'text-xs'}`}>
                Today {lead.createdAt ? new Date(lead.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : ''}
              </p>
            </div>
          </div>
          <div className={`flex items-center ${isMobile ? 'gap-0.5' : 'gap-1'}`}>
            <Button 
              variant="ghost" 
              size="sm" 
              className={`p-0 hover:bg-blue-50 dark:hover:bg-blue-900/20 ${isMobile ? 'h-7 w-7' : 'h-8 w-8'}`}
              onClick={() => setShowComments(!showComments)}
              title="Ver bitácora de comentarios"
            >
              <BookOpen className={`${isMobile ? 'w-3.5 h-3.5' : 'w-4 h-4'} ${showComments ? 'text-blue-600' : 'text-gray-600'}`} />
            </Button>
            {isAdmin && (
              <Button 
                variant="ghost" 
                size="sm" 
                className={`p-0 hover:bg-red-50 dark:hover:bg-red-900/20 ${isMobile ? 'h-7 w-7' : 'h-8 w-8'}`}
                onClick={onDelete}
                title="Eliminar lead"
              >
                <Trash2 className={`text-gray-600 hover:text-red-600 ${isMobile ? 'w-3.5 h-3.5' : 'w-4 h-4'}`} />
              </Button>
            )}
          </div>
        </div>

        {/* Información de contacto */}
        <div className={`text-sm ${isMobile ? 'space-y-1' : 'space-y-2'}`}>
          {lead.clientPhone && (
            <div className={`flex items-center text-gray-600 dark:text-gray-400 ${isMobile ? 'gap-1.5 text-xs' : 'gap-2'}`}>
              <Phone className={isMobile ? "w-3 h-3 flex-shrink-0" : "w-4 h-4 flex-shrink-0"} />
              <span>{lead.clientPhone}</span>
            </div>
          )}
          {lead.clientEmail && (
            <div className={`flex items-center text-gray-600 dark:text-gray-400 truncate ${isMobile ? 'gap-1.5 text-xs' : 'gap-2'}`}>
              <Mail className={isMobile ? "w-3 h-3 flex-shrink-0" : "w-4 h-4 flex-shrink-0"} />
              <span className="truncate">{lead.clientEmail}</span>
            </div>
          )}
          {lead.clientCompany && (
            <div className={`flex items-center text-gray-600 dark:text-gray-400 ${isMobile ? 'gap-1.5 text-xs' : 'gap-2'}`}>
              <Building2 className={isMobile ? "w-3 h-3 flex-shrink-0" : "w-4 h-4 flex-shrink-0"} />
              <span className="truncate">{lead.clientCompany}</span>
            </div>
          )}
        </div>

        {/* Botones de acción modernos */}
        <div className={`grid grid-cols-3 ${isMobile ? 'gap-1.5 pt-1' : 'gap-2 pt-2'}`}>
          <button
            onClick={handleCall}
            disabled={!lead.clientPhone}
            className={`flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750 transition-all disabled:opacity-40 disabled:cursor-not-allowed font-medium text-gray-700 dark:text-gray-300 ${isMobile ? 'gap-1 px-2 py-1.5 text-xs' : 'gap-1.5 px-3 py-2.5 text-sm'}`}
            data-testid={`button-call-${lead.id}`}
          >
            <Phone className={isMobile ? "w-3 h-3" : "w-4 h-4"} />
            <span>Llamar</span>
          </button>
          <button
            onClick={handleWhatsApp}
            disabled={!lead.clientPhone}
            className={`flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750 transition-all disabled:opacity-40 disabled:cursor-not-allowed font-medium text-gray-700 dark:text-gray-300 ${isMobile ? 'gap-1 px-2 py-1.5 text-xs' : 'gap-1.5 px-3 py-2.5 text-sm'}`}
            data-testid={`button-whatsapp-${lead.id}`}
          >
            <MessageSquare className={isMobile ? "w-3 h-3" : "w-4 h-4"} />
            <span>WhatsApp</span>
          </button>
          <button
            onClick={handleEmail}
            disabled={!lead.clientEmail}
            className={`flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750 transition-all disabled:opacity-40 disabled:cursor-not-allowed font-medium text-gray-700 dark:text-gray-300 ${isMobile ? 'gap-1 px-2 py-1.5 text-xs' : 'gap-1.5 px-3 py-2.5 text-sm'}`}
            data-testid={`button-email-${lead.id}`}
          >
            <Mail className={isMobile ? "w-3 h-3" : "w-4 h-4"} />
            <span>Email</span>
          </button>
        </div>

        {/* Selector de etapa */}
        <div className={isMobile ? "pt-1.5" : "pt-3"}>
          <Select value={lead.stage} onValueChange={(newStage) => onChangeStage(newStage)}>
            <SelectTrigger className={`w-full font-medium ${stageBadge.bgColor} ${stageBadge.textColor} border-0 ${isMobile ? 'h-7 text-[10px]' : 'h-9 text-xs'}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PIPELINE_STAGES.filter(s => s.id !== 'all').map((stage) => {
                const badge = STAGE_BADGE_MAP[stage.id];
                return (
                  <SelectItem key={stage.id} value={stage.id}>
                    <span className={`inline-block px-2 py-0.5 rounded ${badge.bgColor} ${badge.textColor}`}>
                      {badge.label}
                    </span>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        {/* Comentarios colapsables */}
        {showComments && (
          <div className={`border-t border-gray-200 dark:border-gray-800 ${isMobile ? 'pt-2' : 'pt-3'}`}>
            <LeadComments leadId={lead.id} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ListLeadRow({ 
  lead, 
  onToggleActivity,
  onChangeStage,
  onDelete,
  currentUser
}: { 
  lead: CrmLead; 
  onToggleActivity: (field: 'hasCall' | 'hasWhatsapp') => void;
  onChangeStage: (stage: string) => void;
  onDelete: () => void;
  currentUser: any;
}) {
  const stageBadge = STAGE_BADGE_MAP[lead.stage] || { label: lead.stage, bgColor: 'bg-gray-100', textColor: 'text-gray-700' };
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

  return (
    <Card className="hover:shadow-sm transition-shadow bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800" data-testid={`row-lead-${lead.id}`}>
      <CardContent className="p-4">
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
                <SelectTrigger className={`w-full h-8 text-xs font-medium ${stageBadge.bgColor} ${stageBadge.textColor} border-0`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PIPELINE_STAGES.filter(s => s.id !== 'all').map((stage) => {
                    const badge = STAGE_BADGE_MAP[stage.id];
                    return (
                      <SelectItem key={stage.id} value={stage.id}>
                        <span className={`inline-block px-2 py-0.5 rounded ${badge.bgColor} ${badge.textColor}`}>
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
      </CardContent>
    </Card>
  );
}

function LeadComments({ leadId }: { leadId: string }) {
  const [newComment, setNewComment] = useState('');
  const { toast } = useToast();

  const { data: comments = [] } = useQuery<any[]>({
    queryKey: ['/api/crm/leads', leadId, 'comments'],
  });

  const addCommentMutation = useMutation({
    mutationFn: async (comment: string) => {
      return apiRequest(`/api/crm/leads/${leadId}/comments`, {
        method: 'POST',
        data: { comment }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/leads', leadId, 'comments'] });
      setNewComment('');
      toast({
        title: "Comentario agregado",
      });
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
          className="text-xs"
          data-testid={`input-comment-${leadId}`}
        />
        <Button
          size="sm"
          onClick={() => newComment.trim() && addCommentMutation.mutate(newComment)}
          disabled={!newComment.trim() || addCommentMutation.isPending}
          data-testid={`button-add-comment-${leadId}`}
        >
          Enviar
        </Button>
      </div>
    </div>
  );
}

function CreateLeadForm({ onSuccess }: { onSuccess: () => void }) {
  const { toast } = useToast();

  const { data: segments = [] } = useQuery<string[]>({
    queryKey: ['/api/goals/data/segments'],
  });

  const { data: users = [] } = useQuery<any[]>({
    queryKey: ['/api/users'],
  });

  // Use the base schema directly without extra omits
  const form = useForm({
    defaultValues: {
      clientName: '',
      clientPhone: '',
      clientEmail: '',
      clientCompany: '',
      clientAddress: '',
      segment: '',
      salespersonId: '',
      notes: '',
      stage: 'lead' as const,
    },
  });

  const createLeadMutation = useMutation({
    mutationFn: async (data: any): Promise<CrmLead> => {
      console.log('🚀 [CREATE LEAD] Mutation started with data:', data);
      
      // Clean up empty strings to null for optional fields
      const cleanData = {
        clientName: data.clientName,
        salespersonId: data.salespersonId,
        stage: data.stage || 'lead',
        clientPhone: data.clientPhone || null,
        clientEmail: data.clientEmail || null,
        clientCompany: data.clientCompany || null,
        clientAddress: data.clientAddress || null,
        segment: data.segment || null,
        notes: data.notes || null,
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/leads'] });
      toast({
        title: "Lead creado",
        description: "El lead ha sido creado exitosamente",
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
