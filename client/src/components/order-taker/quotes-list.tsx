import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  MoreVertical,
  Search,
  Filter,
  FileText,
  Calendar,
  User,
  DollarSign,
  Clock,
  CheckCircle,
  XCircle,
  Send,
  Package,
  Copy,
  Trash2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";

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

interface Quote {
  id: string;
  quoteNumber: string;
  clientName: string;
  clientRut?: string;
  clientEmail?: string;
  clientPhone?: string;
  clientAddress?: string;
  createdBy: string;
  status: "draft" | "sent" | "accepted" | "rejected" | "converted";
  validUntil?: string;
  notes?: string;
  total: string;
  taxAmount?: string;
  discount?: string;
  createdAt: string;
  updatedAt?: string;
}

const statusConfig = {
  draft: {
    label: "Borrador",
    color: "bg-gray-100 text-gray-800",
    icon: FileText,
  },
  sent: {
    label: "Enviada",
    color: "bg-blue-100 text-blue-800",
    icon: Send,
  },
  accepted: {
    label: "Aceptada",
    color: "bg-green-100 text-green-800",
    icon: CheckCircle,
  },
  rejected: {
    label: "Rechazada",
    color: "bg-red-100 text-red-800",
    icon: XCircle,
  },
  converted: {
    label: "Convertida a Pedido",
    color: "bg-purple-100 text-purple-800",
    icon: Package,
  },
};

export default function QuotesList() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  const { toast } = useToast();
  const { user } = useAuth();
  const [, navigate] = useLocation();

  // Build query parameters
  const buildQueryParams = () => {
    const params = new URLSearchParams();
    params.set('limit', itemsPerPage.toString());
    params.set('offset', ((currentPage - 1) * itemsPerPage).toString());
    
    if (statusFilter !== "all") {
      params.set('status', statusFilter);
    }
    
    if (searchTerm.trim()) {
      params.set('clientName', searchTerm.trim());
    }
    
    return params.toString();
  };

  const { data: quotes, isLoading, error } = useQuery<Quote[]>({
    queryKey: [`/api/quotes?${buildQueryParams()}`],
  });

  // Mutation to duplicate quote for editing
  const duplicateQuoteMutation = useMutation({
    mutationFn: async (quoteId: string) => {
      return await apiRequest(`/api/quotes/${quoteId}/duplicate`, {
        method: 'POST',
      });
    },
    onSuccess: (newQuote) => {
      toast({
        title: "Cotización duplicada",
        description: `Nueva cotización #${newQuote.quoteNumber} creada para editar. Abriendo editor...`,
      });
      // Invalidate all quote queries (fixes cache invalidation bug)
      queryClient.invalidateQueries({ 
        predicate: (query) => 
          typeof query.queryKey[0] === 'string' && 
          (query.queryKey[0] as string).startsWith('/api/quotes')
      });
      
      // Navigate immediately to tomador de pedidos with the new quote ID
      navigate(`/tomador-pedidos?quoteId=${newQuote.id}`);
    },
    onError: (error: any) => {
      toast({
        title: "Error al duplicar",
        description: error.message || "No se pudo duplicar la cotización",
        variant: "destructive",
      });
    },
  });

  const handleDuplicateForEdit = (quoteId: string) => {
    duplicateQuoteMutation.mutate(quoteId);
  };

  // Mutation to delete quote
  const deleteQuoteMutation = useMutation({
    mutationFn: async (quoteId: string) => {
      return await apiRequest(`/api/quotes/${quoteId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      toast({
        title: "Cotización eliminada",
        description: "La cotización ha sido eliminada exitosamente.",
      });
      // Invalidate all quote queries
      queryClient.invalidateQueries({ 
        predicate: (query) => 
          typeof query.queryKey[0] === 'string' && 
          (query.queryKey[0] as string).startsWith('/api/quotes')
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error al eliminar",
        description: error.message || "No se pudo eliminar la cotización",
        variant: "destructive",
      });
    },
  });

  const handleDeleteQuote = (quoteId: string, quoteNumber: string) => {
    // Simple confirmation using window.confirm
    if (window.confirm(`¿Estás seguro de que deseas eliminar la cotización ${quoteNumber}? Esta acción no se puede deshacer.`)) {
      deleteQuoteMutation.mutate(quoteId);
    }
  };

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

  const getStatusBadge = (status: Quote['status']) => {
    const config = statusConfig[status];
    const Icon = config.icon;
    
    return (
      <Badge variant="secondary" className={`${config.color} flex items-center gap-1`}>
        <Icon className="w-3 h-3" />
        {config.label}
      </Badge>
    );
  };

  const getTotalQuotes = () => quotes?.length || 0;
  const getQuotesByStatus = (status: Quote['status']) => 
    quotes?.filter(q => q.status === status).length || 0;

  if (error) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <XCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Error al cargar cotizaciones</h3>
          <p className="text-gray-500">No se pudieron cargar las cotizaciones. Inténtalo de nuevo.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{getTotalQuotes()}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Borradores</CardTitle>
            <FileText className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{getQuotesByStatus('draft')}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Enviadas</CardTitle>
            <Send className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{getQuotesByStatus('sent')}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aceptadas</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{getQuotesByStatus('accepted')}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Convertidas</CardTitle>
            <Package className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{getQuotesByStatus('converted')}</div>
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
            data-testid="input-search-quotes"
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
            <SelectItem value="sent">Enviadas</SelectItem>
            <SelectItem value="accepted">Aceptadas</SelectItem>
            <SelectItem value="rejected">Rechazadas</SelectItem>
            <SelectItem value="converted">Convertidas</SelectItem>
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
                  <TableHead className="text-left">Cotización</TableHead>
                  <TableHead className="text-left">Cliente</TableHead>
                  <TableHead className="text-left">Estado</TableHead>
                  <TableHead className="text-left">Monto</TableHead>
                  <TableHead className="text-left">Válida hasta</TableHead>
                  <TableHead className="text-left">Creada</TableHead>
                  <TableHead className="text-center">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={7} className="text-center py-8">
                        <div className="animate-pulse flex space-x-4">
                          <div className="flex-1 space-y-2 py-1">
                            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : quotes && quotes.length > 0 ? (
                  quotes.map((quote) => (
                    <TableRow 
                      key={quote.id} 
                      className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors"
                      data-testid={`quote-row-${quote.id}`}
                    >
                      <TableCell className="py-4">
                        <div className="font-medium text-gray-900" data-testid={`quote-number-${quote.id}`}>
                          #{quote.quoteNumber}
                        </div>
                        <div className="text-sm text-gray-500">
                          {quote.notes && quote.notes.length > 50 
                            ? `${quote.notes.substring(0, 50)}...` 
                            : quote.notes || 'Sin notas'
                          }
                        </div>
                      </TableCell>
                      
                      <TableCell className="py-4">
                        <div className="font-medium text-gray-900" data-testid={`client-name-${quote.id}`}>
                          {quote.clientName}
                        </div>
                        {quote.clientRut && (
                          <div className="text-sm text-gray-500">
                            RUT: {quote.clientRut}
                          </div>
                        )}
                      </TableCell>
                      
                      <TableCell className="py-4">
                        {getStatusBadge(quote.status)}
                      </TableCell>
                      
                      <TableCell className="py-4">
                        <div className="font-medium text-gray-900" data-testid={`total-amount-${quote.id}`}>
                          {formatCurrency(quote.total)}
                        </div>
                        {quote.discount && parseFloat(quote.discount) > 0 && (
                          <div className="text-sm text-green-600">
                            Descuento: {formatCurrency(quote.discount)}
                          </div>
                        )}
                      </TableCell>
                      
                      <TableCell className="py-4">
                        {quote.validUntil ? (
                          <div>
                            <div className="text-sm text-gray-900">
                              {formatDate(quote.validUntil)}
                            </div>
                            <div className="text-xs text-gray-500">
                              <Clock className="w-3 h-3 inline mr-1" />
                              {new Date(quote.validUntil) < new Date() ? 'Vencida' : 'Vigente'}
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-400">Sin vencimiento</span>
                        )}
                      </TableCell>
                      
                      <TableCell className="py-4">
                        <div className="text-sm text-gray-900">
                          {formatDate(quote.createdAt)}
                        </div>
                        <div className="text-xs text-gray-500">
                          {getTimeAgo(quote.createdAt)}
                        </div>
                      </TableCell>
                      
                      <TableCell className="py-4 text-center">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" data-testid={`actions-${quote.id}`}>
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem data-testid={`view-${quote.id}`}>
                              <FileText className="w-4 h-4 mr-2" />
                              Ver detalles
                            </DropdownMenuItem>
                            {(quote.status === 'draft' || quote.status === 'sent' || quote.status === 'accepted' || quote.status === 'rejected') && (
                              <DropdownMenuItem 
                                data-testid={`button-duplicate-quote-${quote.id}`}
                                onClick={() => handleDuplicateForEdit(quote.id)}
                                disabled={duplicateQuoteMutation.isPending}
                              >
                                <Copy className="w-4 h-4 mr-2" />
                                {duplicateQuoteMutation.isPending ? 'Duplicando...' : 'Duplicar para editar'}
                              </DropdownMenuItem>
                            )}
                            {(user?.role === 'admin' || user?.role === 'supervisor') && (
                              <DropdownMenuItem 
                                data-testid={`button-delete-quote-${quote.id}`}
                                onClick={() => handleDeleteQuote(quote.id, quote.quoteNumber)}
                                disabled={deleteQuoteMutation.isPending}
                                className="text-red-600 focus:text-red-600 focus:bg-red-50"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                {deleteQuoteMutation.isPending ? 'Eliminando...' : 'Eliminar'}
                              </DropdownMenuItem>
                            )}
                            {(quote.status === 'accepted' || quote.status === 'sent') && (
                              <DropdownMenuItem data-testid={`convert-${quote.id}`}>
                                <Package className="w-4 h-4 mr-2" />
                                Convertir a pedido
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12">
                      <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">
                        No hay cotizaciones
                      </h3>
                      <p className="text-gray-500">
                        {searchTerm || statusFilter !== "all" 
                          ? "No se encontraron cotizaciones con los filtros aplicados."
                          : "Aún no se han creado cotizaciones en el sistema."
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
    </div>
  );
}