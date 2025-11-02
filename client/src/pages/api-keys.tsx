import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Key, Copy, Trash2, Power, PowerOff, Plus, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";

interface ApiKey {
  id: string;
  keyPrefix: string;
  name: string;
  description: string | null;
  role: string;
  isActive: boolean;
  lastUsedAt: string | null;
  usageCount: number;
  createdBy: string;
  createdAt: string;
  expiresAt: string | null;
}

export default function ApiKeysPage() {
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newKeyData, setNewKeyData] = useState({
    name: "",
    description: "",
    role: "readonly",
    expiresAt: ""
  });
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [showKeyDialog, setShowKeyDialog] = useState(false);

  const { data: apiKeys = [], isLoading } = useQuery<ApiKey[]>({
    queryKey: ["/api/api-keys"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof newKeyData) => {
      const response = await apiRequest("/api/api-keys", {
        method: "POST",
        body: JSON.stringify(data),
      });
      return response;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/api-keys"] });
      setIsCreateDialogOpen(false);
      setGeneratedKey(data.apiKey);
      setShowKeyDialog(true);
      setNewKeyData({ name: "", description: "", role: "readonly", expiresAt: "" });
      toast({
        title: "API Key creada",
        description: "Guarda esta clave en un lugar seguro, no podrás verla de nuevo.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Error al crear API key",
        variant: "destructive",
      });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      return await apiRequest(`/api/api-keys/${id}/toggle`, {
        method: "PATCH",
        body: JSON.stringify({ isActive }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/api-keys"] });
      toast({
        title: "Estado actualizado",
        description: "El estado de la API key ha sido actualizado.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Error al actualizar API key",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/api-keys/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/api-keys"] });
      toast({
        title: "API Key eliminada",
        description: "La API key ha sido eliminada correctamente.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Error al eliminar API key",
        variant: "destructive",
      });
    },
  });

  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    toast({
      title: "Copiado",
      description: "API key copiada al portapapeles",
    });
  };

  const handleCreateKey = () => {
    if (!newKeyData.name) {
      toast({
        title: "Error",
        description: "El nombre es requerido",
        variant: "destructive",
      });
      return;
    }
    createMutation.mutate(newKeyData);
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "admin":
        return <Badge variant="destructive">Admin</Badge>;
      case "read_write":
        return <Badge variant="default">Lectura/Escritura</Badge>;
      case "readonly":
        return <Badge variant="secondary">Solo Lectura</Badge>;
      default:
        return <Badge variant="outline">{role}</Badge>;
    }
  };

  const formatDate = (date: string | null) => {
    if (!date) return "Nunca";
    return new Date(date).toLocaleDateString("es-CL", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">API Keys</h1>
          <p className="text-gray-500 mt-1">
            Gestiona las claves de API para integrar con Make.com, Zapier y otras plataformas
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)} data-testid="button-create-api-key">
          <Plus className="mr-2 h-4 w-4" />
          Nueva API Key
        </Button>
      </div>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Las API keys permiten acceso programático a tu aplicación. Solo se muestra la clave completa una vez al crearla.
          <br />
          <strong>Endpoint base:</strong> <code className="bg-gray-100 px-2 py-1 rounded">{window.location.origin}/api/external</code>
        </AlertDescription>
      </Alert>

      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="animate-pulse h-32 bg-gray-200 rounded-lg"></div>
          ))}
        </div>
      ) : apiKeys.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Key className="h-12 w-12 text-gray-400 mb-4" />
            <p className="text-gray-500 text-center">
              No hay API keys creadas aún.
              <br />
              Crea tu primera API key para comenzar a integrar con servicios externos.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {apiKeys.map((key) => (
            <Card key={key.id} data-testid={`api-key-${key.id}`}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Key className="h-5 w-5 text-gray-500" />
                    <div>
                      <CardTitle className="text-lg">{key.name}</CardTitle>
                      <CardDescription className="font-mono text-xs mt-1">
                        {key.keyPrefix}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {getRoleBadge(key.role)}
                    <Switch
                      checked={key.isActive}
                      onCheckedChange={(checked) => toggleMutation.mutate({ id: key.id, isActive: checked })}
                      data-testid={`switch-toggle-${key.id}`}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (confirm("¿Estás seguro de eliminar esta API key?")) {
                          deleteMutation.mutate(key.id);
                        }
                      }}
                      data-testid={`button-delete-${key.id}`}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">Estado</p>
                    <p className="font-medium">
                      {key.isActive ? (
                        <span className="text-green-600 flex items-center">
                          <Power className="h-3 w-3 mr-1" />
                          Activa
                        </span>
                      ) : (
                        <span className="text-gray-400 flex items-center">
                          <PowerOff className="h-3 w-3 mr-1" />
                          Inactiva
                        </span>
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Usos</p>
                    <p className="font-medium">{key.usageCount.toLocaleString("es-CL")}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Último uso</p>
                    <p className="font-medium">{formatDate(key.lastUsedAt)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Creada</p>
                    <p className="font-medium">{formatDate(key.createdAt)}</p>
                  </div>
                </div>
                {key.description && (
                  <p className="text-sm text-gray-600 mt-4">{key.description}</p>
                )}
                {key.expiresAt && (
                  <div className="mt-4">
                    <Badge variant="outline" className="text-xs">
                      Expira: {formatDate(key.expiresAt)}
                    </Badge>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create API Key Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent data-testid="dialog-create-api-key">
          <DialogHeader>
            <DialogTitle>Crear Nueva API Key</DialogTitle>
            <DialogDescription>
              Configura los permisos y detalles de la nueva API key
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Nombre *</Label>
              <Input
                id="name"
                placeholder="Ej: Make.com Integration"
                value={newKeyData.name}
                onChange={(e) => setNewKeyData({ ...newKeyData, name: e.target.value })}
                data-testid="input-api-key-name"
              />
            </div>
            <div>
              <Label htmlFor="description">Descripción</Label>
              <Textarea
                id="description"
                placeholder="Describe para qué se usará esta API key"
                value={newKeyData.description}
                onChange={(e) => setNewKeyData({ ...newKeyData, description: e.target.value })}
                data-testid="input-api-key-description"
              />
            </div>
            <div>
              <Label htmlFor="role">Permisos</Label>
              <Select value={newKeyData.role} onValueChange={(value) => setNewKeyData({ ...newKeyData, role: value })}>
                <SelectTrigger data-testid="select-api-key-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="readonly">Solo Lectura</SelectItem>
                  <SelectItem value="read_write">Lectura y Escritura</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500 mt-1">
                {newKeyData.role === "readonly" && "Solo puede leer datos, no puede crear ni modificar"}
                {newKeyData.role === "read_write" && "Puede leer y escribir datos, pero no gestionar API keys"}
                {newKeyData.role === "admin" && "Acceso completo incluyendo gestión de API keys"}
              </p>
            </div>
            <div>
              <Label htmlFor="expiresAt">Fecha de Expiración (opcional)</Label>
              <Input
                id="expiresAt"
                type="datetime-local"
                value={newKeyData.expiresAt}
                onChange={(e) => setNewKeyData({ ...newKeyData, expiresAt: e.target.value })}
                data-testid="input-api-key-expires"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateKey} disabled={createMutation.isPending} data-testid="button-submit-api-key">
              {createMutation.isPending ? "Creando..." : "Crear API Key"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Show Generated Key Dialog */}
      <Dialog open={showKeyDialog} onOpenChange={setShowKeyDialog}>
        <DialogContent data-testid="dialog-show-api-key">
          <DialogHeader>
            <DialogTitle>¡API Key Creada!</DialogTitle>
            <DialogDescription>
              Guarda esta clave en un lugar seguro. Por seguridad, no podrás verla de nuevo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <Label>Tu API Key:</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => generatedKey && handleCopyKey(generatedKey)}
                  data-testid="button-copy-api-key"
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copiar
                </Button>
              </div>
              <code className="block bg-white p-3 rounded border text-sm font-mono break-all">
                {generatedKey}
              </code>
            </div>
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Incluye esta clave en el header <strong>X-API-Key</strong> de tus peticiones HTTP.
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowKeyDialog(false)} data-testid="button-close-dialog">
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
