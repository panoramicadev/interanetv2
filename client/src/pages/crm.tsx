import { useState, useEffect } from "react";
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
import { Plus, Phone, MessageSquare, Building2, Mail, MoreVertical, Filter, Grid3x3, List, Download, BookOpen, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { CrmLead, InsertCrmLeadInput } from "@shared/schema";
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
  const [activeTab, setActiveTab] = useState<'leads' | 'promesas'>('leads');
  const [selectedStage, setSelectedStage] = useState<string>('all');
  const [segmentFilter, setSegmentFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  
  // Auto-detect mobile and force list view
  const [isMobile, setIsMobile] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Detect mobile on mount and window resize
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 640; // sm breakpoint
      setIsMobile(mobile);
      if (mobile) setViewMode('list');
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const { data: leads = [], isLoading } = useQuery<CrmLead[]>({
    queryKey: ['/api/crm/leads', segmentFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (segmentFilter !== 'all') {
        params.append('segment', segmentFilter);
      }
      const response = await fetch(`/api/crm/leads?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch leads');
      }
      return response.json();
    },
  });

  const { data: segments = [] } = useQuery<string[]>({
    queryKey: ['/api/goals/data/segments'],
  });

  const toggleActivityMutation = useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: 'hasCall' | 'hasWhatsapp'; value: boolean }) => {
      return apiRequest(`/api/crm/leads/${id}`, 'PUT', { [field]: value });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/leads'] });
    },
  });

  const updateStageMutation = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: string }) => {
      return apiRequest(`/api/crm/leads/${id}`, 'PUT', { stage });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/leads'] });
      toast({
        title: "Etapa actualizada",
        description: "El lead ha sido movido exitosamente",
      });
    },
  });

  const deleteLeadMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/crm/leads/${id}`, 'DELETE');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/leads'] });
      toast({
        title: "Lead eliminado",
        description: "El lead ha sido eliminado exitosamente",
      });
    },
  });

  const filteredLeads = leads.filter(lead => {
    const matchesStage = selectedStage === 'all' || lead.stage === selectedStage;
    const matchesSearch = !searchQuery || 
      lead.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (lead.clientEmail || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (lead.clientPhone || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStage && matchesSearch;
  });

  const getLeadCountByStage = (stage: string) => {
    if (stage === 'all') return leads.length;
    return leads.filter(l => l.stage === stage).length;
  };

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
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">Leads</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Gestión de clientes y promesas de compra
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="outline" size="sm" data-testid="button-export">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" data-testid="button-create-lead">
                <Plus className="w-4 h-4 mr-2" />
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
        <TabsList>
          <TabsTrigger value="leads" data-testid="tab-leads">Leads</TabsTrigger>
          <TabsTrigger value="promesas" data-testid="tab-promesas">Promesas de Compra</TabsTrigger>
        </TabsList>

        {/* Tab de Leads */}
        <TabsContent value="leads" className="space-y-4">
          {/* Filtros superiores */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 flex-1 w-full">
              <Select value={selectedStage} onValueChange={setSelectedStage}>
                <SelectTrigger className="w-full sm:w-[180px]" data-testid="select-status-filter">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  {PIPELINE_STAGES.filter(s => s.id !== 'all').map((stage) => (
                    <SelectItem key={stage.id} value={stage.id}>{stage.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={segmentFilter} onValueChange={setSegmentFilter}>
                <SelectTrigger className="w-full sm:w-[180px]" data-testid="select-segment-filter">
                  <SelectValue placeholder="All Sources" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sources</SelectItem>
                  {segments.map((segment) => (
                    <SelectItem key={segment} value={segment}>{segment}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button variant="outline" size="sm" data-testid="button-filter">
                <Filter className="w-4 h-4 mr-2" />
                Filter
              </Button>

              {/* Search field inline with filters */}
              <div className="flex-1 min-w-[200px]">
                <Input
                  placeholder="Buscar por nombre, email o teléfono..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  data-testid="input-search-leads"
                />
              </div>
            </div>

            {/* View mode toggle - desktop only, disabled on mobile */}
            {!isMobile && (
              <div className="hidden sm:block">
                <ToggleGroup type="single" value={viewMode} onValueChange={(v) => v && setViewMode(v as 'grid' | 'list')}>
                  <ToggleGroupItem value="grid" aria-label="Grid view" data-testid="toggle-grid-view">
                    <Grid3x3 className="w-4 h-4" />
                  </ToggleGroupItem>
                  <ToggleGroupItem value="list" aria-label="List view" data-testid="toggle-list-view">
                    <List className="w-4 h-4" />
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>
            )}
          </div>

          {/* Status Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {PIPELINE_STAGES.filter(s => s.id !== 'all').slice(0, 4).map((stage) => {
              const count = getLeadCountByStage(stage.id);
              const stageBadge = STAGE_BADGE_MAP[stage.id];
              return (
                <Card key={stage.id} className="hover:shadow-sm transition-shadow cursor-pointer" onClick={() => setSelectedStage(stage.id)}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className={`w-2 h-2 rounded-full ${stageBadge.bgColor}`} />
                      <span className="text-xs text-gray-500 dark:text-gray-400">{count} Leads</span>
                    </div>
                    <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">{stage.name}</div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Grid/List de leads */}
          <div className="mt-6">
            {filteredLeads.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 dark:text-gray-400">No se encontraron leads</p>
              </div>
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredLeads.map((lead) => (
                  <LeadCard
                    key={lead.id}
                    lead={lead}
                    onToggleActivity={(field) => {
                      const currentValue = field === 'hasCall' ? lead.hasCall : lead.hasWhatsapp;
                      toggleActivityMutation.mutate({ id: lead.id, field, value: !currentValue });
                    }}
                    onChangeStage={(stage) => updateStageMutation.mutate({ id: lead.id, stage })}
                    onDelete={() => deleteLeadMutation.mutate(lead.id)}
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredLeads.map((lead) => (
                  <ListLeadRow
                    key={lead.id}
                    lead={lead}
                    onToggleActivity={(field) => {
                      const currentValue = field === 'hasCall' ? lead.hasCall : lead.hasWhatsapp;
                      toggleActivityMutation.mutate({ id: lead.id, field, value: !currentValue });
                    }}
                    onChangeStage={(stage) => updateStageMutation.mutate({ id: lead.id, stage })}
                    onDelete={() => deleteLeadMutation.mutate(lead.id)}
                  />
                ))}
              </div>
            )}
          </div>
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
  onDelete
}: { 
  lead: CrmLead; 
  onToggleActivity: (field: 'hasCall' | 'hasWhatsapp') => void;
  onChangeStage: (stage: string) => void;
  onDelete: () => void;
}) {
  const [showComments, setShowComments] = useState(false);
  const stageBadge = STAGE_BADGE_MAP[lead.stage] || { label: lead.stage, bgColor: 'bg-gray-100', textColor: 'text-gray-700' };
  
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

  return (
    <Card className="hover:shadow-md transition-shadow bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800" data-testid={`card-lead-${lead.id}`}>
      <CardContent className="p-5 space-y-4">
        {/* Header con avatar y acciones */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3 flex-1">
            <div className={`w-12 h-12 rounded-full ${avatarColor} flex items-center justify-center text-white font-semibold text-sm shadow-md flex-shrink-0`}>
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-base text-gray-900 dark:text-gray-100 truncate">
                {lead.clientName}
              </h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Today {lead.createdAt ? new Date(lead.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8 w-8 p-0 hover:bg-blue-50 dark:hover:bg-blue-900/20"
              onClick={() => setShowComments(!showComments)}
              title="Ver bitácora de comentarios"
            >
              <BookOpen className={`w-4 h-4 ${showComments ? 'text-blue-600' : 'text-gray-600'}`} />
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8 w-8 p-0 hover:bg-red-50 dark:hover:bg-red-900/20"
              onClick={onDelete}
              title="Eliminar lead"
            >
              <Trash2 className="w-4 h-4 text-gray-600 hover:text-red-600" />
            </Button>
          </div>
        </div>

        {/* Información de contacto */}
        <div className="space-y-2.5 text-sm">
          {lead.clientPhone && (
            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
              <Phone className="w-4 h-4 flex-shrink-0" />
              <span>{lead.clientPhone}</span>
            </div>
          )}
          {lead.clientEmail && (
            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 truncate">
              <Mail className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">{lead.clientEmail}</span>
            </div>
          )}
          {lead.clientCompany && (
            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
              <Building2 className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">{lead.clientCompany}</span>
            </div>
          )}
        </div>

        {/* Badge de estado */}
        <div className="flex items-center justify-center pt-3">
          <Badge className={`${stageBadge.bgColor} ${stageBadge.textColor} border-0 px-4 py-1.5 text-xs font-medium`}>
            {stageBadge.label}
          </Badge>
        </div>

        {/* Comentarios colapsables */}
        {showComments && (
          <div className="pt-3 border-t border-gray-200 dark:border-gray-800">
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
  onDelete
}: { 
  lead: CrmLead; 
  onToggleActivity: (field: 'hasCall' | 'hasWhatsapp') => void;
  onChangeStage: (stage: string) => void;
  onDelete: () => void;
}) {
  const stageBadge = STAGE_BADGE_MAP[lead.stage] || { label: lead.stage, bgColor: 'bg-gray-100', textColor: 'text-gray-700' };
  
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

            <div className="flex items-center">
              <Badge className={`${stageBadge.bgColor} ${stageBadge.textColor} border-0 px-3 py-1 text-xs font-medium`}>
                {stageBadge.label}
              </Badge>
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
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={onDelete} className="text-red-600">
                    Eliminar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
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
