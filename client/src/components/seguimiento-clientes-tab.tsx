import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Search, Users, FileText, ChevronDown, ChevronUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";

export function SeguimientoClientesTab() {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClient, setSelectedClient] = useState<any | null>(null);
  const [isAddNoteOpen, setIsAddNoteOpen] = useState(false);
  const [noteContent, setNoteContent] = useState('');
  const [isCreateClientOpen, setIsCreateClientOpen] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientCompany, setNewClientCompany] = useState('');
  const [newClientSegment, setNewClientSegment] = useState('');
  const [suggestionSearch, setSuggestionSearch] = useState('');

  const isSalesperson = currentUser?.role === 'salesperson';

  const { data: clientesRecurrentes = [], isLoading } = useQuery<any[]>({
    queryKey: ['/api/crm/clientes-recurrentes'],
  });

  const { data: clientesSugeridos = [] } = useQuery<any[]>({
    queryKey: ['/api/crm/clientes-sugeridos'],
    enabled: isCreateClientOpen,
  });

  const addNoteMutation = useMutation({
    mutationFn: async ({ clientId, note }: { clientId: string; note: string }) => {
      return apiRequest('/api/crm/clientes-recurrentes/notes', {
        method: 'POST',
        data: { clientId, note, userId: currentUser?.id }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/clientes-recurrentes'] });
      toast({
        title: "Nota agregada",
        description: "La nota se guardó correctamente",
      });
      setIsAddNoteOpen(false);
      setNoteContent('');
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo agregar la nota",
        variant: "destructive",
      });
    },
  });

  const createClientMutation = useMutation({
    mutationFn: async (data: { clientName: string; clientCompany: string; segment: string }) => {
      return apiRequest('/api/crm/leads', {
        method: 'POST',
        data: {
          clientName: data.clientName,
          clientCompany: data.clientCompany,
          segment: data.segment,
          clientType: 'recurrente',
          stage: 'leads',
          priority: 'media',
          salespersonId: currentUser?.id,
          salespersonName: currentUser?.salespersonName || currentUser?.fullName,
          supervisorId: currentUser?.supervisorId || currentUser?.id,
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/clientes-recurrentes'] });
      toast({
        title: "Cliente agregado",
        description: "El cliente se agregó al seguimiento correctamente",
      });
      setIsCreateClientOpen(false);
      setNewClientName('');
      setNewClientCompany('');
      setNewClientSegment('');
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo agregar el cliente",
        variant: "destructive",
      });
    },
  });

  const filteredClients = clientesRecurrentes.filter(client => {
    const matchesSearch = !searchQuery || 
      client.clientName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.company?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesSalesperson = !isSalesperson || 
      client.salespersonId === currentUser?.id ||
      client.salespersonName === currentUser?.salespersonName;
    
    return matchesSearch && matchesSalesperson;
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="relative flex-1 w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Buscar cliente..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-seguimiento"
          />
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-sm">
            {filteredClients.length} clientes en seguimiento
          </Badge>
          <Dialog open={isCreateClientOpen} onOpenChange={(open) => {
            setIsCreateClientOpen(open);
            if (!open) {
              setSuggestionSearch('');
              setNewClientName('');
              setNewClientCompany('');
              setNewClientSegment('');
            }
          }}>
            <DialogTrigger asChild>
              <Button size="sm" data-testid="button-add-client-seguimiento">
                <Plus className="w-4 h-4 mr-1" />
                Nuevo Cliente
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Agregar Cliente al Seguimiento</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Clientes Sugeridos (últimos 12 meses)</Label>
                  <Input
                    placeholder="Buscar cliente..."
                    value={suggestionSearch}
                    onChange={(e) => setSuggestionSearch(e.target.value)}
                    data-testid="input-suggestion-search"
                  />
                  <div className="max-h-48 overflow-y-auto border rounded-md">
                    {clientesSugeridos
                      .filter(c => !suggestionSearch || c.clientName?.toLowerCase().includes(suggestionSearch.toLowerCase()))
                      .slice(0, 20)
                      .map((client, idx) => (
                        <div
                          key={idx}
                          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer border-b last:border-b-0 flex items-center justify-between"
                          onClick={() => {
                            setNewClientName(client.clientName);
                            setNewClientSegment(client.segment || '');
                            setSuggestionSearch('');
                          }}
                          data-testid={`suggestion-${idx}`}
                        >
                          <div className="flex-1">
                            <p className="font-medium text-sm">{client.clientName}</p>
                            <p className="text-xs text-gray-500">
                              {client.segment} • {client.salespersonName}
                            </p>
                          </div>
                          <Badge variant="secondary" className="text-xs">
                            {client.purchaseCount} compras
                          </Badge>
                        </div>
                      ))}
                    {clientesSugeridos.length === 0 && (
                      <p className="p-3 text-sm text-gray-500 text-center">Sin sugerencias disponibles</p>
                    )}
                  </div>
                </div>

                <div className="border-t pt-4 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="clientName">Nombre del Cliente *</Label>
                    <Input
                      id="clientName"
                      value={newClientName}
                      onChange={(e) => setNewClientName(e.target.value)}
                      placeholder="Nombre del cliente"
                      data-testid="input-new-client-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="clientCompany">Empresa</Label>
                    <Input
                      id="clientCompany"
                      value={newClientCompany}
                      onChange={(e) => setNewClientCompany(e.target.value)}
                      placeholder="Nombre de la empresa"
                      data-testid="input-new-client-company"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="segment">Segmento</Label>
                    <Select value={newClientSegment} onValueChange={setNewClientSegment}>
                      <SelectTrigger data-testid="select-new-client-segment">
                        <SelectValue placeholder="Seleccionar segmento" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Retail">Retail</SelectItem>
                        <SelectItem value="Industrial">Industrial</SelectItem>
                        <SelectItem value="Construcción">Construcción</SelectItem>
                        <SelectItem value="Automotriz">Automotriz</SelectItem>
                        <SelectItem value="Otro">Otro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex justify-end gap-2 pt-4">
                    <Button variant="outline" onClick={() => setIsCreateClientOpen(false)}>
                      Cancelar
                    </Button>
                    <Button
                      onClick={() => {
                        if (!newClientName.trim()) {
                          toast({
                            title: "Error",
                            description: "El nombre del cliente es requerido",
                            variant: "destructive",
                          });
                          return;
                        }
                        createClientMutation.mutate({
                          clientName: newClientName,
                          clientCompany: newClientCompany,
                          segment: newClientSegment,
                        });
                      }}
                      disabled={createClientMutation.isPending}
                      data-testid="button-submit-new-client"
                    >
                      {createClientMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-1" />
                      ) : null}
                      Agregar
                    </Button>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {filteredClients.length === 0 ? (
        <Card className="p-8 text-center">
          <Users className="w-12 h-12 mx-auto text-gray-400 mb-4" />
          <h3 className="font-semibold text-lg mb-2">Sin clientes en seguimiento</h3>
          <p className="text-gray-500 text-sm">
            Los clientes recurrentes aparecerán aquí para llevar un seguimiento de sus interacciones.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredClients.map((client) => (
            <Card key={client.id} className="p-4 hover:shadow-md transition-shadow" data-testid={`card-client-${client.id}`}>
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-semibold">{client.clientName}</h4>
                    {client.segment && (
                      <Badge variant="outline" className="text-xs">{client.segment}</Badge>
                    )}
                    {client.daysSinceLastPurchase != null && client.daysSinceLastPurchase > 60 && (
                      <Badge variant="destructive" className="text-xs">
                        {client.daysSinceLastPurchase} días sin comprar
                      </Badge>
                    )}
                  </div>
                  {client.company && (
                    <p className="text-sm text-gray-600 dark:text-gray-400">{client.company}</p>
                  )}
                  
                  <div className="flex flex-wrap items-center gap-3 text-xs">
                    <div className="flex items-center gap-1 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded">
                      <span className="text-blue-600 dark:text-blue-400 font-semibold">{client.purchaseCount || 0}</span>
                      <span className="text-blue-500 dark:text-blue-400">compras (12m)</span>
                    </div>
                    <div className="flex items-center gap-1 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded">
                      <span className="text-green-600 dark:text-green-400 font-semibold">
                        ${Number(client.totalAmount || 0).toLocaleString('es-CL')}
                      </span>
                      <span className="text-green-500 dark:text-green-400">total</span>
                    </div>
                    {client.avgTicket > 0 && (
                      <div className="flex items-center gap-1 bg-purple-50 dark:bg-purple-900/20 px-2 py-1 rounded">
                        <span className="text-purple-600 dark:text-purple-400 font-semibold">
                          ${Number(client.avgTicket || 0).toLocaleString('es-CL')}
                        </span>
                        <span className="text-purple-500 dark:text-purple-400">promedio</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    {client.lastPurchaseDate && (
                      <span>Última compra: {new Date(client.lastPurchaseDate).toLocaleDateString('es-CL')}</span>
                    )}
                    {client.salespersonName && (
                      <span>Vendedor: {client.salespersonName}</span>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSelectedClient(client);
                      setIsAddNoteOpen(true);
                    }}
                    data-testid={`button-add-note-${client.id}`}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Agregar Nota
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSelectedClient(selectedClient?.id === client.id ? null : client)}
                    data-testid={`button-toggle-notes-${client.id}`}
                  >
                    {selectedClient?.id === client.id ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>

              {selectedClient?.id === client.id && client.notes && client.notes.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-3">
                  <h5 className="font-medium text-sm flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Bitácora de Seguimiento
                  </h5>
                  <div className="space-y-2">
                    {client.notes.map((note: any, index: number) => (
                      <div key={index} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-sm">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-gray-700 dark:text-gray-300">
                            {note.userName || 'Usuario'}
                          </span>
                          <span className="text-xs text-gray-500">
                            {note.createdAt ? new Date(note.createdAt).toLocaleDateString('es-CL', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            }) : ''}
                          </span>
                        </div>
                        <p className="text-gray-600 dark:text-gray-400">{note.content}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isAddNoteOpen} onOpenChange={setIsAddNoteOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Agregar Nota - {selectedClient?.clientName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              placeholder="Escribe una nota sobre la interacción con el cliente..."
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              rows={4}
              data-testid="textarea-note-content"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsAddNoteOpen(false)}>
                Cancelar
              </Button>
              <Button
                onClick={() => {
                  if (selectedClient && noteContent.trim()) {
                    addNoteMutation.mutate({ 
                      clientId: selectedClient.id, 
                      note: noteContent.trim() 
                    });
                  }
                }}
                disabled={!noteContent.trim() || addNoteMutation.isPending}
                data-testid="button-save-note"
              >
                {addNoteMutation.isPending ? 'Guardando...' : 'Guardar Nota'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
