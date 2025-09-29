import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  MoreVertical,
  Search,
  Filter,
  Package,
  Calendar,
  User,
  DollarSign,
  Clock,
  CheckCircle,
  XCircle,
  FileText,
  Truck,
  AlertTriangle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";

interface Order {
  id: string;
  orderNumber: string;
  clientName: string;
  clientRut?: string;
  clientEmail?: string;
  clientPhone?: string;
  clientAddress?: string;
  createdBy: string;
  status: "draft" | "confirmed" | "processing" | "completed" | "cancelled";
  priority: "low" | "medium" | "high" | "urgent";
  notes?: string;
  estimatedDeliveryDate?: string;
  totalAmount: string;
  taxAmount?: string;
  discountAmount?: string;
  createdAt: string;
  updatedAt?: string;
}

const statusConfig = {
  draft: {
    label: "Borrador",
    color: "bg-gray-100 text-gray-800",
    icon: FileText,
  },
  confirmed: {
    label: "Confirmado",
    color: "bg-blue-100 text-blue-800",
    icon: CheckCircle,
  },
  processing: {
    label: "En Proceso",
    color: "bg-yellow-100 text-yellow-800",
    icon: Clock,
  },
  completed: {
    label: "Completado",
    color: "bg-green-100 text-green-800",
    icon: Package,
  },
  cancelled: {
    label: "Cancelado",
    color: "bg-red-100 text-red-800",
    icon: XCircle,
  },
};

const priorityConfig = {
  low: {
    label: "Baja",
    color: "bg-gray-100 text-gray-600",
  },
  medium: {
    label: "Media",
    color: "bg-blue-100 text-blue-600",
  },
  high: {
    label: "Alta",
    color: "bg-orange-100 text-orange-600",
  },
  urgent: {
    label: "Urgente",
    color: "bg-red-100 text-red-600",
  },
};

export default function OrdersPage() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Build query parameters
  const buildQueryParams = () => {
    const params = new URLSearchParams();
    params.set('limit', itemsPerPage.toString());
    params.set('offset', ((currentPage - 1) * itemsPerPage).toString());
    
    if (statusFilter !== "all") {
      params.set('status', statusFilter);
    }
    
    if (priorityFilter !== "all") {
      params.set('priority', priorityFilter);
    }
    
    if (searchTerm.trim()) {
      params.set('clientName', searchTerm.trim());
    }
    
    return params.toString();
  };

  const { data: orders, isLoading, error } = useQuery<Order[]>({
    queryKey: [`/api/orders?${buildQueryParams()}`],
  });

  const formatCurrency = (amount: string | number) => {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
    }).format(numAmount);
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return format(date, "d 'de' MMMM, yyyy", { locale: es });
    } catch {
      return 'Fecha inválida';
    }
  };

  const getTimeAgo = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffInMs = now.getTime() - date.getTime();
      
      const minutes = Math.floor(diffInMs / (1000 * 60));
      const hours = Math.floor(diffInMs / (1000 * 60 * 60));
      const days = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
      
      if (days > 0) {
        return `hace ${days} día${days > 1 ? 's' : ''}`;
      } else if (hours > 0) {
        return `hace ${hours} hora${hours > 1 ? 's' : ''}`;
      } else if (minutes > 0) {
        return `hace ${minutes} min`;
      } else {
        return 'hace unos segundos';
      }
    } catch {
      return 'fecha inválida';
    }
  };

  const getStatusBadge = (status: Order['status']) => {
    const config = statusConfig[status];
    const Icon = config.icon;
    
    return (
      <Badge variant="secondary" className={`${config.color} flex items-center gap-1`}>
        <Icon className="w-3 h-3" />
        {config.label}
      </Badge>
    );
  };

  const getPriorityBadge = (priority: Order['priority']) => {
    const config = priorityConfig[priority];
    
    return (
      <Badge variant="outline" className={`${config.color} text-xs`}>
        {config.label}
      </Badge>
    );
  };

  const getTotalOrders = () => orders?.length || 0;
  const getOrdersByStatus = (status: Order['status']) => 
    orders?.filter(o => o.status === status).length || 0;
  const getOrdersByPriority = (priority: Order['priority']) => 
    orders?.filter(o => o.priority === priority).length || 0;

  if (error) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <XCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Error al cargar pedidos</h3>
          <p className="text-gray-500">No se pudieron cargar los pedidos. Inténtalo de nuevo.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Pedidos</h1>
          <p className="text-gray-600 mt-1">
            Gestiona y revisa todos los pedidos confirmados del sistema
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{getTotalOrders()}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Confirmados</CardTitle>
            <CheckCircle className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{getOrdersByStatus('confirmed')}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">En Proceso</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{getOrdersByStatus('processing')}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completados</CardTitle>
            <Package className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{getOrdersByStatus('completed')}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Urgentes</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{getOrdersByPriority('urgent')}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Buscar por nombre de cliente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
            data-testid="input-search-orders"
          />
        </div>
        
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[200px]" data-testid="select-status-filter">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Filtrar por estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="draft">Borradores</SelectItem>
            <SelectItem value="confirmed">Confirmados</SelectItem>
            <SelectItem value="processing">En proceso</SelectItem>
            <SelectItem value="completed">Completados</SelectItem>
            <SelectItem value="cancelled">Cancelados</SelectItem>
          </SelectContent>
        </Select>

        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-full sm:w-[150px]" data-testid="select-priority-filter">
            <AlertTriangle className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Prioridad" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las prioridades</SelectItem>
            <SelectItem value="urgent">Urgente</SelectItem>
            <SelectItem value="high">Alta</SelectItem>
            <SelectItem value="medium">Media</SelectItem>
            <SelectItem value="low">Baja</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-gray-200">
                  <TableHead className="text-left">Pedido</TableHead>
                  <TableHead className="text-left">Cliente</TableHead>
                  <TableHead className="text-left">Estado</TableHead>
                  <TableHead className="text-left">Prioridad</TableHead>
                  <TableHead className="text-left">Monto</TableHead>
                  <TableHead className="text-left">Entrega estimada</TableHead>
                  <TableHead className="text-left">Creado</TableHead>
                  <TableHead className="text-center">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={8} className="text-center py-8">
                        <div className="animate-pulse flex space-x-4">
                          <div className="flex-1 space-y-2 py-1">
                            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : orders && orders.length > 0 ? (
                  orders.map((order) => (
                    <TableRow 
                      key={order.id} 
                      className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors"
                      data-testid={`order-row-${order.id}`}
                    >
                      <TableCell className="py-4">
                        <div className="font-medium text-gray-900" data-testid={`order-number-${order.id}`}>
                          #{order.orderNumber}
                        </div>
                        <div className="text-sm text-gray-500">
                          {order.notes && order.notes.length > 50 
                            ? `${order.notes.substring(0, 50)}...` 
                            : order.notes || 'Sin notas'
                          }
                        </div>
                      </TableCell>
                      
                      <TableCell className="py-4">
                        <div className="font-medium text-gray-900" data-testid={`client-name-${order.id}`}>
                          {order.clientName}
                        </div>
                        {order.clientRut && (
                          <div className="text-sm text-gray-500">
                            RUT: {order.clientRut}
                          </div>
                        )}
                      </TableCell>
                      
                      <TableCell className="py-4">
                        {getStatusBadge(order.status)}
                      </TableCell>

                      <TableCell className="py-4">
                        {getPriorityBadge(order.priority)}
                      </TableCell>
                      
                      <TableCell className="py-4">
                        <div className="font-medium text-gray-900" data-testid={`total-amount-${order.id}`}>
                          {formatCurrency(order.totalAmount)}
                        </div>
                        {order.discountAmount && parseFloat(order.discountAmount) > 0 && (
                          <div className="text-sm text-green-600">
                            Descuento: {formatCurrency(order.discountAmount)}
                          </div>
                        )}
                      </TableCell>
                      
                      <TableCell className="py-4">
                        {order.estimatedDeliveryDate ? (
                          <div>
                            <div className="text-sm text-gray-900">
                              {formatDate(order.estimatedDeliveryDate)}
                            </div>
                            <div className="text-xs text-gray-500">
                              <Truck className="w-3 h-3 inline mr-1" />
                              {new Date(order.estimatedDeliveryDate) < new Date() ? 'Retrasado' : 'En plazo'}
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-400">Sin fecha estimada</span>
                        )}
                      </TableCell>
                      
                      <TableCell className="py-4">
                        <div className="text-sm text-gray-900">
                          {formatDate(order.createdAt)}
                        </div>
                        <div className="text-xs text-gray-500">
                          {getTimeAgo(order.createdAt)}
                        </div>
                      </TableCell>
                      
                      <TableCell className="py-4 text-center">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" data-testid={`actions-${order.id}`}>
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem data-testid={`view-${order.id}`}>
                              <Package className="w-4 h-4 mr-2" />
                              Ver detalles
                            </DropdownMenuItem>
                            {(order.status === 'draft' || order.status === 'confirmed') && (
                              <DropdownMenuItem data-testid={`edit-${order.id}`}>
                                <User className="w-4 h-4 mr-2" />
                                Editar
                              </DropdownMenuItem>
                            )}
                            {order.status === 'confirmed' && (
                              <DropdownMenuItem data-testid={`process-${order.id}`}>
                                <Clock className="w-4 h-4 mr-2" />
                                Marcar en proceso
                              </DropdownMenuItem>
                            )}
                            {order.status === 'processing' && (
                              <DropdownMenuItem data-testid={`complete-${order.id}`}>
                                <CheckCircle className="w-4 h-4 mr-2" />
                                Marcar completado
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12">
                      <Package className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">
                        No hay pedidos
                      </h3>
                      <p className="text-gray-500">
                        {searchTerm || statusFilter !== "all" || priorityFilter !== "all"
                          ? "No se encontraron pedidos con los filtros aplicados."
                          : "Aún no se han creado pedidos en el sistema."
                        }
                      </p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination would go here if needed */}
    </div>
  );
}