import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ShoppingCart, User, DollarSign, Clock, CheckCircle, XCircle, Package, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

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

interface EcommerceOrder {
  id: string;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  assignedSalespersonName?: string;
  status: "pending" | "approved" | "modified" | "rejected" | "sent";
  total: string;
  items: any;
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
  const { toast } = useToast();
  const { user } = useAuth();

  // Fetch ecommerce orders
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

  return (
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
        {/* Filters */}
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

        {/* Table */}
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
                const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
                const itemCount = Array.isArray(items) ? items.length : 0;

                return (
                  <TableRow key={order.id}>
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
                        onClick={() => {
                          toast({
                            title: "Detalles del pedido",
                            description: `Pedido de ${order.clientName}. ${order.notes ? `Notas: ${order.notes}` : 'Sin notas'}`,
                          });
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

        {/* Summary */}
        {orders.length > 0 && (
          <div className="mt-4 text-sm text-gray-600">
            Mostrando {orders.length} pedido{orders.length !== 1 ? 's' : ''}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
