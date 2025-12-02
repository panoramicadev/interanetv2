import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ShoppingCart, User, DollarSign, Clock, CheckCircle, XCircle, Package, Eye, FileText, Loader2, Phone, Mail } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

interface OrderItem {
  productId: string;
  productName: string;
  productCode: string;
  quantity: number;
  price: number;
  subtotal: number;
}

interface EcommerceOrder {
  id: string;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  clientCompany?: string;
  assignedSalespersonId?: string;
  assignedSalespersonName?: string;
  status: "pending" | "approved" | "modified" | "rejected" | "sent";
  total: string;
  items: OrderItem[] | string;
  notes?: string;
  createdAt: string;
}

const statusConfig = {
  pending: {
    label: "Pendiente",
    color: "bg-yellow-100 text-yellow-800",
    icon: Clock,
  },
  approved: {
    label: "Aprobado",
    color: "bg-green-100 text-green-800",
    icon: CheckCircle,
  },
  modified: {
    label: "Modificado",
    color: "bg-blue-100 text-blue-800",
    icon: Package,
  },
  rejected: {
    label: "Rechazado",
    color: "bg-red-100 text-red-800",
    icon: XCircle,
  },
  sent: {
    label: "Enviado",
    color: "bg-purple-100 text-purple-800",
    icon: ShoppingCart,
  },
};

export default function EcommerceOrdersList() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedOrder, setSelectedOrder] = useState<EcommerceOrder | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const { data: orders = [], isLoading } = useQuery<EcommerceOrder[]>({
    queryKey: ['/api/ecommerce/orders', statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") {
        params.set('status', statusFilter);
      }
      const response = await fetch(`/api/ecommerce/orders?${params}`);
      if (!response.ok) throw new Error('Failed to fetch orders');
      return response.json();
    },
    retry: false,
  });

  const createQuoteMutation = useMutation({
    mutationFn: async (order: EcommerceOrder) => {
      const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
      
      const quoteData = {
        clientName: order.clientName,
        clientEmail: order.clientEmail || '',
        clientPhone: order.clientPhone || '',
        clientCompany: order.clientCompany || '',
        notes: order.notes ? `[Generado desde pedido ecommerce] ${order.notes}` : '[Generado desde pedido ecommerce]',
        items: items.map((item: OrderItem) => ({
          productCode: item.productCode,
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: item.price,
        })),
      };
      
      const response = await apiRequest('/api/quotes', {
        method: 'POST',
        body: JSON.stringify(quoteData),
      });
      
      return response;
    },
    onSuccess: (data) => {
      toast({
        title: "Cotización creada",
        description: "La cotización se ha generado exitosamente",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/quotes'] });
      setIsDetailOpen(false);
      navigate('/tomador-pedidos');
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo crear la cotización",
        variant: "destructive",
      });
    },
  });

  const formatPrice = (price: string | number) => {
    const numPrice = typeof price === 'string' ? parseFloat(price) : price;
    return `$${numPrice.toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "dd/MM/yyyy HH:mm", { locale: es });
    } catch {
      return dateString;
    }
  };

  const openOrderDetail = (order: EcommerceOrder) => {
    setSelectedOrder(order);
    setIsDetailOpen(true);
  };

  const getOrderItems = (order: EcommerceOrder): OrderItem[] => {
    if (!order.items) return [];
    return typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Pedidos de Clientes (Ecommerce)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex gap-4">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[200px]" data-testid="select-status-filter">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="pending">Pendientes</SelectItem>
                <SelectItem value="approved">Aprobados</SelectItem>
                <SelectItem value="modified">Modificados</SelectItem>
                <SelectItem value="rejected">Rechazados</SelectItem>
                <SelectItem value="sent">Enviados</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="text-center py-8 text-gray-500">Cargando pedidos...</div>
          ) : orders.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No hay pedidos {statusFilter !== "all" ? "con este estado" : ""}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Vendedor</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Productos</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => {
                  const status = statusConfig[order.status] || statusConfig.pending;
                  const Icon = status.icon;
                  const items = getOrderItems(order);
                  const itemCount = items.length;

                  return (
                    <TableRow 
                      key={order.id} 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => openOrderDetail(order)}
                      data-testid={`order-row-${order.id}`}
                    >
                      <TableCell>
                        <div>
                          <div className="font-medium">{order.clientName}</div>
                          {order.clientEmail && (
                            <div className="text-xs text-gray-500">{order.clientEmail}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {order.assignedSalespersonName || (
                          <span className="text-gray-400 text-sm">Sin asignar</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={status.color}>
                          <Icon className="h-3 w-3 mr-1" />
                          {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-semibold">
                        {formatPrice(order.total)}
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {formatDate(order.createdAt)}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{itemCount} producto{itemCount !== 1 ? 's' : ''}</span>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            openOrderDetail(order);
                          }}
                          data-testid={`button-view-order-${order.id}`}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}

          {orders.length > 0 && (
            <div className="mt-4 text-sm text-gray-600">
              Mostrando {orders.length} pedido{orders.length !== 1 ? 's' : ''}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de detalle del pedido */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Detalle del Pedido
            </DialogTitle>
            <DialogDescription>
              {selectedOrder && formatDate(selectedOrder.createdAt)}
            </DialogDescription>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-4">
              {/* Información del cliente */}
              <div className="bg-muted/50 rounded-lg p-4">
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Información del Cliente
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Nombre:</span>{" "}
                    <span className="font-medium">{selectedOrder.clientName}</span>
                  </div>
                  {selectedOrder.clientCompany && (
                    <div>
                      <span className="text-muted-foreground">Empresa:</span>{" "}
                      <span className="font-medium">{selectedOrder.clientCompany}</span>
                    </div>
                  )}
                  {selectedOrder.clientEmail && (
                    <div className="flex items-center gap-1">
                      <Mail className="h-3 w-3 text-muted-foreground" />
                      <span>{selectedOrder.clientEmail}</span>
                    </div>
                  )}
                  {selectedOrder.clientPhone && (
                    <div className="flex items-center gap-1">
                      <Phone className="h-3 w-3 text-muted-foreground" />
                      <span>{selectedOrder.clientPhone}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Estado del pedido */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Estado:</span>
                {(() => {
                  const status = statusConfig[selectedOrder.status] || statusConfig.pending;
                  const Icon = status.icon;
                  return (
                    <Badge className={status.color}>
                      <Icon className="h-3 w-3 mr-1" />
                      {status.label}
                    </Badge>
                  );
                })()}
              </div>

              <Separator />

              {/* Lista de productos */}
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Productos Solicitados
                </h3>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Producto</TableHead>
                        <TableHead className="text-center">Cantidad</TableHead>
                        <TableHead className="text-right">Precio Unit.</TableHead>
                        <TableHead className="text-right">Subtotal</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {getOrderItems(selectedOrder).map((item, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{item.productName}</div>
                              <div className="text-xs text-muted-foreground">{item.productCode}</div>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">{item.quantity}</TableCell>
                          <TableCell className="text-right">{formatPrice(item.price)}</TableCell>
                          <TableCell className="text-right font-medium">
                            {formatPrice(item.subtotal || item.price * item.quantity)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Total */}
                <div className="mt-4 flex justify-end">
                  <div className="bg-primary/10 rounded-lg px-4 py-2">
                    <span className="text-sm text-muted-foreground mr-2">Total:</span>
                    <span className="text-xl font-bold text-primary">
                      {formatPrice(selectedOrder.total)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Notas */}
              {selectedOrder.notes && (
                <>
                  <Separator />
                  <div>
                    <h3 className="font-semibold mb-2">Notas del Cliente</h3>
                    <p className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
                      {selectedOrder.notes}
                    </p>
                  </div>
                </>
              )}
            </div>
          )}

          <DialogFooter className="mt-4 gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setIsDetailOpen(false)}
              data-testid="button-close-detail"
            >
              Cerrar
            </Button>
            <Button
              onClick={() => selectedOrder && createQuoteMutation.mutate(selectedOrder)}
              disabled={createQuoteMutation.isPending}
              data-testid="button-generate-quote"
            >
              {createQuoteMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generando...
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4 mr-2" />
                  Generar Cotización
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
