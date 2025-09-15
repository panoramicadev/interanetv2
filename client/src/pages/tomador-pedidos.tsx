import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Search, ShoppingCart, User, MapPin, Phone } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Client, Order } from "@shared/schema";

export default function TomadorPedidos() {
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();

  // Fetch clients with search functionality
  const { data: clients = [], isLoading: isLoadingClients } = useQuery({
    queryKey: ['/api/clients', { search: searchTerm }],
    queryFn: async () => {
      const params = new URLSearchParams({ search: searchTerm });
      const response = await fetch(`/api/clients?${params}`, { credentials: 'include' });
      if (!response.ok) {
        throw new Error('Failed to fetch clients');
      }
      return response.json();
    },
    enabled: searchTerm.length >= 2, // Only search when user has typed at least 2 characters
  });

  // Fetch existing orders
  const { data: orders = [], isLoading: isLoadingOrders } = useQuery<Order[]>({
    queryKey: ['/api/orders'],
    queryFn: async () => {
      const response = await fetch('/api/orders', { credentials: 'include' });
      if (!response.ok) {
        throw new Error('Failed to fetch orders');
      }
      return response.json();
    },
  });

  // Create order mutation
  const createOrderMutation = useMutation<Order, Error, { clientName: string; clientId?: string; notes?: string }>({
    mutationFn: async (orderData) => {
      const response = await apiRequest('/api/orders', {
        method: 'POST',
        data: orderData
      });
      return response.json();
    },
    onSuccess: (newOrder: Order) => {
      toast({
        title: "¡Pedido creado exitosamente!",
        description: `Pedido ${newOrder.orderNumber} creado para ${newOrder.clientName}`,
      });
      // Invalidate orders query to refresh the list
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error al crear pedido",
        description: error.message || "Ocurrió un error inesperado",
        variant: "destructive",
      });
    },
  });

  const handleCreateOrder = (client: Client) => {
    createOrderMutation.mutate({
      clientName: client.nokoen,
      clientId: client.id,
      notes: `Pedido creado para cliente: ${client.nokoen} (RUT: ${client.rten})`,
    });
  };

  const formatCurrency = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined) return "N/A";
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP'
    }).format(amount);
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'draft': return 'secondary';
      case 'confirmed': return 'default';
      case 'processing': return 'outline';
      case 'completed': return 'default';
      case 'cancelled': return 'destructive';
      default: return 'secondary';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'draft': return 'Borrador';
      case 'confirmed': return 'Confirmado';
      case 'processing': return 'Procesando';
      case 'completed': return 'Completado';
      case 'cancelled': return 'Cancelado';
      default: return status;
    }
  };

  return (
    <div className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 lg:py-6 m-3 sm:m-4">
      <div className="space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
            Tomador de Pedidos
          </h1>
          <p className="text-muted-foreground">
            Busca clientes y crea pedidos de manera rápida y eficiente
          </p>
        </div>

        {/* Client Search Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="w-5 h-5" />
              Buscar Cliente
            </CardTitle>
            <CardDescription>
              Ingresa el nombre del cliente para buscar en la base de datos
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                data-testid="input-client-search"
                placeholder="Buscar por nombre de cliente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Search Results */}
            {searchTerm.length >= 2 && (
              <div className="space-y-4">
                {isLoadingClients ? (
                  <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="flex items-center space-x-4 p-4 border rounded-lg">
                        <Skeleton className="h-12 w-12 rounded-full" />
                        <div className="space-y-2 flex-1">
                          <Skeleton className="h-4 w-[250px]" />
                          <Skeleton className="h-4 w-[200px]" />
                        </div>
                        <Skeleton className="h-10 w-32" />
                      </div>
                    ))}
                  </div>
                ) : clients.length > 0 ? (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {clients.map((client: Client) => (
                      <div
                        key={client.id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center space-x-4 flex-1">
                          <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                            <User className="w-6 h-6 text-primary" />
                          </div>
                          <div className="space-y-1 flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-medium text-foreground truncate" data-testid={`text-client-name-${client.id}`}>
                                {client.nokoen}
                              </h3>
                              {client.rten && (
                                <Badge variant="outline" className="text-xs">
                                  RUT: {client.rten}
                                </Badge>
                              )}
                            </div>
                            <div className="space-y-1 text-sm text-muted-foreground">
                              {client.dien && (
                                <div className="flex items-center gap-1">
                                  <MapPin className="w-3 h-3" />
                                  <span className="truncate">{client.dien}{client.cmen ? `, ${client.cmen}` : ''}</span>
                                </div>
                              )}
                              {client.foen && (
                                <div className="flex items-center gap-1">
                                  <Phone className="w-3 h-3" />
                                  <span>{client.foen}</span>
                                </div>
                              )}
                              {client.crlt && (
                                <div className="text-xs">
                                  Límite crédito: {formatCurrency(Number(client.crlt))} | 
                                  Disponible: {formatCurrency(Number(client.cren) || 0)}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        <Button
                          data-testid={`button-create-order-${client.id}`}
                          onClick={() => handleCreateOrder(client)}
                          disabled={createOrderMutation.isPending}
                          className="flex items-center gap-2 ml-4"
                        >
                          <ShoppingCart className="w-4 h-4" />
                          {createOrderMutation.isPending ? "Creando..." : "Crear Pedido"}
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No se encontraron clientes con "{searchTerm}"</p>
                    <p className="text-sm">Intenta con un término de búsqueda diferente</p>
                  </div>
                )}
              </div>
            )}

            {searchTerm.length > 0 && searchTerm.length < 2 && (
              <div className="text-center py-4 text-muted-foreground">
                <p className="text-sm">Ingresa al menos 2 caracteres para buscar clientes</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Orders Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" />
              Pedidos Recientes
            </CardTitle>
            <CardDescription>
              Los últimos pedidos creados en el sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingOrders ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center justify-between p-3 border rounded">
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-4 w-[200px]" />
                      <Skeleton className="h-3 w-[150px]" />
                    </div>
                    <Skeleton className="h-6 w-20" />
                  </div>
                ))}
              </div>
            ) : orders.length > 0 ? (
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {orders.slice(0, 10).map((order: Order) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between p-3 border rounded hover:bg-muted/50 transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium" data-testid={`text-order-number-${order.id}`}>
                          {order.orderNumber}
                        </span>
                        <span className="text-muted-foreground">-</span>
                        <span data-testid={`text-order-client-${order.id}`}>
                          {order.clientName}
                        </span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {order.createdAt ? new Date(order.createdAt).toLocaleDateString('es-CL', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        }) : 'Fecha no disponible'}
                      </div>
                    </div>
                    <Badge variant={getStatusBadgeVariant(order.status || 'draft')}>
                      {getStatusLabel(order.status || 'draft')}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <ShoppingCart className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No hay pedidos recientes</p>
                <p className="text-sm">Los pedidos aparecerán aquí una vez que sean creados</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}