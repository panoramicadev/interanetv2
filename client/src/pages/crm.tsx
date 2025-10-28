import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, Phone, MessageSquare, User, Building2, Calendar, MapPin } from "lucide-react";
import type { CrmLead } from "@shared/schema";

const PIPELINE_STAGES = [
  { id: 'lead', name: 'Lead', color: 'bg-slate-100 dark:bg-slate-800' },
  { id: 'contacto', name: 'Contacto', color: 'bg-blue-100 dark:bg-blue-900' },
  { id: 'visita', name: 'Visita', color: 'bg-purple-100 dark:bg-purple-900' },
  { id: 'lista_precio', name: 'Lista Precio', color: 'bg-amber-100 dark:bg-amber-900' },
  { id: 'campana', name: 'Campaña', color: 'bg-orange-100 dark:bg-orange-900' },
  { id: 'primera_venta', name: 'Primera Venta', color: 'bg-teal-100 dark:bg-teal-900' },
  { id: 'promesa', name: 'Promesa', color: 'bg-green-100 dark:bg-green-900' },
  { id: 'venta', name: 'Venta', color: 'bg-emerald-100 dark:bg-emerald-900' },
] as const;

export default function CRMPage() {
  const { toast } = useToast();
  const [selectedStage, setSelectedStage] = useState<string | null>(null);
  const [segmentFilter, setSegmentFilter] = useState<string>('all');
  const [draggedLead, setDraggedLead] = useState<CrmLead | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const { data: leads = [], isLoading } = useQuery<CrmLead[]>({
    queryKey: ['/api/crm/leads', segmentFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (segmentFilter !== 'all') {
        params.append('segment', segmentFilter);
      }
      return fetch(`/api/crm/leads?${params}`).then(r => r.json());
    },
  });

  const { data: segments = [] } = useQuery<string[]>({
    queryKey: ['/api/goals/data/segments'],
  });

  const updateLeadMutation = useMutation({
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
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo actualizar la etapa",
        variant: "destructive",
      });
    },
  });

  const toggleActivityMutation = useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: 'hasCall' | 'hasWhatsapp'; value: boolean }) => {
      return apiRequest(`/api/crm/leads/${id}`, 'PUT', { [field]: value });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/leads'] });
    },
  });

  const handleDragStart = (lead: CrmLead) => {
    setDraggedLead(lead);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (stage: string) => {
    if (draggedLead && draggedLead.stage !== stage) {
      updateLeadMutation.mutate({ id: draggedLead.id, stage });
    }
    setDraggedLead(null);
  };

  const getLeadsByStage = (stage: string) => {
    return leads.filter(lead => lead.stage === stage);
  };

  const handleToggleActivity = (lead: CrmLead, field: 'hasCall' | 'hasWhatsapp') => {
    const currentValue = field === 'hasCall' ? lead.hasCall : lead.hasWhatsapp;
    toggleActivityMutation.mutate({ id: lead.id, field, value: !currentValue });
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
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Pipeline CRM</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Gestión del ciclo de vida del cliente
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={segmentFilter} onValueChange={setSegmentFilter}>
            <SelectTrigger className="w-[200px]" data-testid="select-segment-filter">
              <SelectValue placeholder="Filtrar por segmento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los segmentos</SelectItem>
              {segments.map((segment) => (
                <SelectItem key={segment} value={segment}>{segment}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-lead">
                <Plus className="w-4 h-4 mr-2" />
                Nuevo Lead
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Crear Nuevo Lead</DialogTitle>
              </DialogHeader>
              <CreateLeadForm onSuccess={() => setIsCreateDialogOpen(false)} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="grid grid-cols-4 gap-4 overflow-x-auto pb-4">
        {PIPELINE_STAGES.map((stage) => {
          const stageLeads = getLeadsByStage(stage.id);
          return (
            <div
              key={stage.id}
              className={`min-w-[280px] rounded-lg border-2 border-dashed ${
                draggedLead && draggedLead.stage !== stage.id 
                  ? 'border-blue-400 bg-blue-50 dark:bg-blue-950' 
                  : 'border-gray-200 dark:border-gray-700'
              }`}
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(stage.id)}
              data-testid={`column-${stage.id}`}
            >
              <div className={`${stage.color} rounded-t-lg p-3 border-b`}>
                <h3 className="font-semibold text-sm flex items-center justify-between">
                  <span>{stage.name}</span>
                  <Badge variant="secondary" className="text-xs">
                    {stageLeads.length}
                  </Badge>
                </h3>
              </div>
              <div className="p-2 space-y-2 min-h-[200px] max-h-[calc(100vh-300px)] overflow-y-auto">
                {stageLeads.map((lead) => (
                  <LeadCard 
                    key={lead.id} 
                    lead={lead}
                    onDragStart={() => handleDragStart(lead)}
                    onToggleActivity={handleToggleActivity}
                  />
                ))}
                {stageLeads.length === 0 && (
                  <div className="text-center text-gray-400 dark:text-gray-600 text-sm py-8">
                    Sin leads
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-4 gap-4 mt-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Total Leads
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{leads.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Llamadas Realizadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {leads.filter(l => l.hasCall).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
              WhatsApp Enviados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {leads.filter(l => l.hasWhatsapp).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
              En Venta
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {getLeadsByStage('venta').length}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function LeadCard({ 
  lead, 
  onDragStart,
  onToggleActivity 
}: { 
  lead: CrmLead; 
  onDragStart: () => void;
  onToggleActivity: (lead: CrmLead, field: 'hasCall' | 'hasWhatsapp') => void;
}) {
  const [showComments, setShowComments] = useState(false);

  return (
    <Card
      className="cursor-move hover:shadow-md transition-shadow"
      draggable
      onDragStart={onDragStart}
      data-testid={`card-lead-${lead.id}`}
    >
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h4 className="font-semibold text-sm text-gray-900 dark:text-gray-100">
              {lead.clientName}
            </h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-1">
              <Building2 className="w-3 h-3" />
              {lead.clientCompany || 'Sin empresa'}
            </p>
          </div>
          <Badge variant="outline" className="text-xs">
            {lead.segment}
          </Badge>
        </div>

        {lead.clientPhone && (
          <p className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-1">
            <Phone className="w-3 h-3" />
            {lead.clientPhone}
          </p>
        )}

        {lead.clientEmail && (
          <p className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-1 truncate">
            <User className="w-3 h-3" />
            {lead.clientEmail}
          </p>
        )}

        {lead.clientAddress && (
          <p className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-1 truncate">
            <MapPin className="w-3 h-3" />
            {lead.clientAddress}
          </p>
        )}

        {lead.lastContactDate && (
          <p className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            Último contacto: {new Date(lead.lastContactDate).toLocaleDateString('es-CL')}
          </p>
        )}

        {/* Activity Checkboxes */}
        <div className="flex items-center gap-3 pt-2 border-t">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleActivity(lead, 'hasCall');
            }}
            className={`flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors ${
              lead.hasCall
                ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
            data-testid={`checkbox-llamada-${lead.id}`}
          >
            <Phone className="w-3 h-3" />
            Llamada
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleActivity(lead, 'hasWhatsapp');
            }}
            className={`flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors ${
              lead.hasWhatsapp
                ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
            data-testid={`checkbox-whatsapp-${lead.id}`}
          >
            <MessageSquare className="w-3 h-3" />
            WhatsApp
          </button>
        </div>

        <div className="text-xs text-gray-500 dark:text-gray-400 pt-1">
          Vendedor: {lead.salespersonName}
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="w-full text-xs mt-2"
          onClick={() => setShowComments(!showComments)}
          data-testid={`button-comments-${lead.id}`}
        >
          {showComments ? 'Ocultar' : 'Ver'} Comentarios
        </Button>

        {showComments && <LeadComments leadId={lead.id} />}
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
      return apiRequest(`/api/crm/leads/${leadId}/comments`, 'POST', { comment });
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
    <div className="space-y-2 border-t pt-2 mt-2">
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
  const [formData, setFormData] = useState({
    clientName: '',
    companyName: '',
    contactPerson: '',
    phone: '',
    email: '',
    address: '',
    segment: '',
    salespersonId: '',
    notes: '',
  });

  const { data: segments = [] } = useQuery<string[]>({
    queryKey: ['/api/goals/data/segments'],
  });

  const { data: salespeople = [] } = useQuery<string[]>({
    queryKey: ['/api/goals/data/salespeople'],
  });

  const { data: users = [] } = useQuery<any[]>({
    queryKey: ['/api/users'],
  });

  const createLeadMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('/api/crm/leads', 'POST', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/leads'] });
      toast({
        title: "Lead creado",
        description: "El lead ha sido creado exitosamente",
      });
      onSuccess();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo crear el lead",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.clientName || !formData.segment || !formData.salespersonId) {
      toast({
        title: "Error",
        description: "Por favor completa todos los campos requeridos",
        variant: "destructive",
      });
      return;
    }
    createLeadMutation.mutate(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="clientName">Nombre del Cliente *</Label>
          <Input
            id="clientName"
            value={formData.clientName}
            onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
            required
            data-testid="input-client-name"
          />
        </div>
        <div>
          <Label htmlFor="companyName">Empresa</Label>
          <Input
            id="companyName"
            value={formData.companyName}
            onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
            data-testid="input-company-name"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="contactPerson">Persona de Contacto</Label>
          <Input
            id="contactPerson"
            value={formData.contactPerson}
            onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
            data-testid="input-contact-person"
          />
        </div>
        <div>
          <Label htmlFor="phone">Teléfono</Label>
          <Input
            id="phone"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            data-testid="input-phone"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            data-testid="input-email"
          />
        </div>
        <div>
          <Label htmlFor="segment">Segmento *</Label>
          <Select value={formData.segment} onValueChange={(value) => setFormData({ ...formData, segment: value })}>
            <SelectTrigger data-testid="select-segment">
              <SelectValue placeholder="Selecciona segmento" />
            </SelectTrigger>
            <SelectContent>
              {segments.map((segment) => (
                <SelectItem key={segment} value={segment}>{segment}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="address">Dirección</Label>
        <Input
          id="address"
          value={formData.address}
          onChange={(e) => setFormData({ ...formData, address: e.target.value })}
          data-testid="input-address"
        />
      </div>

      <div>
        <Label htmlFor="salespersonId">Vendedor Asignado *</Label>
        <Select value={formData.salespersonId} onValueChange={(value) => setFormData({ ...formData, salespersonId: value })}>
          <SelectTrigger data-testid="select-salesperson">
            <SelectValue placeholder="Selecciona vendedor" />
          </SelectTrigger>
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
      </div>

      <div>
        <Label htmlFor="notes">Notas</Label>
        <Textarea
          id="notes"
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          rows={3}
          data-testid="textarea-notes"
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={createLeadMutation.isPending} data-testid="button-submit-lead">
          {createLeadMutation.isPending ? 'Creando...' : 'Crear Lead'}
        </Button>
      </div>
    </form>
  );
}
