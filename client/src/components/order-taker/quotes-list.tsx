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
  Mail,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";
import html2pdf from "html2pdf.js";

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
  creatorName?: string;
  creatorEmail?: string;
  creatorFirstName?: string;
  creatorLastName?: string;
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

interface QuotesListProps {
  onEditQuote?: (quoteId: string) => void;
}

export default function QuotesList({ onEditQuote }: QuotesListProps) {
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
    onSuccess: (newQuote: any) => {
      toast({
        title: "Cotización duplicada",
        description: `Nueva cotización #${newQuote?.quoteNumber || 'N/A'} creada para editar. Abriendo editor...`,
      });
      // Invalidate all quote queries (fixes cache invalidation bug)
      queryClient.invalidateQueries({ 
        predicate: (query) => 
          typeof query.queryKey[0] === 'string' && 
          (query.queryKey[0] as string).startsWith('/api/quotes')
      });
      
      // Navigate immediately to tomador de pedidos with the new quote ID
      if (newQuote?.id) {
        navigate(`/tomador-pedidos?quoteId=${newQuote.id}`);
      }
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

  // Mutation to update quote status
  const updateStatusMutation = useMutation({
    mutationFn: async ({ quoteId, status }: { quoteId: string; status: Quote['status'] }) => {
      return await apiRequest(`/api/quotes/${quoteId}/status`, {
        method: 'PATCH',
        data: { status }
      });
    },
    onSuccess: (updatedQuote: any) => {
      toast({
        title: "Estado actualizado",
        description: `Cotización ${updatedQuote?.quoteNumber || 'N/A'} actualizada exitosamente.`,
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
        title: "Error al actualizar estado",
        description: error.message || "No se pudo actualizar el estado",
        variant: "destructive",
      });
    },
  });

  const handleStatusChange = (quoteId: string, newStatus: Quote['status'], quoteNumber: string) => {
    const statusLabels: Record<Quote['status'], string> = {
      draft: 'borrador',
      sent: 'enviada',
      accepted: 'aprobada',
      rejected: 'cancelada',
      converted: 'convertida a pedido'
    };
    
    if (window.confirm(`¿Estás seguro de que deseas cambiar el estado de la cotización ${quoteNumber} a "${statusLabels[newStatus]}"?`)) {
      updateStatusMutation.mutate({ quoteId, status: newStatus });
    }
  };

  // Mutation to send email with PDF
  const sendEmailMutation = useMutation({
    mutationFn: async (quoteId: string) => {
      // Fetch quote details with items
      const quoteResponse = await apiRequest(`/api/quotes/${quoteId}/with-items`);
      const quoteData = await quoteResponse.json();
      
      // Generate PDF as base64
      const pdfBase64 = await generatePDFAsBase64(quoteData);
      
      // Send email
      return await apiRequest(`/api/quotes/${quoteId}/send-email`, {
        method: 'POST',
        data: {
          pdfBase64,
          recipientEmail: 'contacto@pinturaspanoramica.cl'
        }
      });
    },
    onSuccess: () => {
      toast({
        title: "Correo enviado",
        description: "El correo con el PDF de la cotización ha sido enviado exitosamente.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error al enviar correo",
        description: error.message || "No se pudo enviar el correo. Verifica la configuración SMTP.",
        variant: "destructive",
      });
    },
  });

  const handleSendEmail = (quoteId: string, quoteNumber: string) => {
    if (window.confirm(`¿Deseas enviar el PDF de la cotización ${quoteNumber} a contacto@pinturaspanoramica.cl?`)) {
      sendEmailMutation.mutate(quoteId);
    }
  };

  // Generate PDF as base64 for email (simplified version)
  const generatePDFAsBase64 = async (quoteData: any): Promise<string> => {
    const quote = quoteData;
    const items = quoteData.items || [];
    
    const quoteDate = new Date(quote.createdAt || new Date()).toLocaleDateString('es-CL', { 
      day: '2-digit',
      month: '2-digit', 
      year: 'numeric'
    });

    const subtotal = parseFloat(quote.subtotal || "0");
    const tax = parseFloat(quote.taxAmount || "0");
    const total = parseFloat(quote.total || "0");

    const formatCurrency = (amount: number) => `$${Math.round(amount).toLocaleString('es-CL').replace(/,/g, '.')}`;

    const escapeHtml = (text: string | null | undefined) => {
      if (!text) return '';
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    };

    const productRows = items.map((item: any) => {
      const unitPrice = parseFloat(item.unitPrice);
      const lineTotal = parseFloat(item.totalPrice);
      
      return `
        <tr>
          <td>
            <div style="font-weight: 600; color: #1f2937; font-size: 13px;">${escapeHtml(item.productName)}</div>
            ${item.productCode || item.customSku ? `<div style="color: #6b7280; font-size: 11px; margin-top: 2px;">SKU: ${escapeHtml(item.productCode || item.customSku)}</div>` : ''}
          </td>
          <td style="text-align: center;">UN</td>
          <td style="text-align: center;">${parseFloat(item.quantity)}</td>
          <td style="text-align: right;">${formatCurrency(unitPrice)}</td>
          <td style="text-align: right; color: #fd6301; font-weight: 600;">${formatCurrency(lineTotal)}</td>
        </tr>`;
    }).join('');

    const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; margin: 0; padding: 20px; color: #333; font-size: 14px; }
    .header { display: flex; justify-content: space-between; margin-bottom: 20px; border-bottom: 2px solid #fd6301; padding-bottom: 15px; }
    .header h1 { color: #fd6301; margin: 0; font-size: 24px; }
    table { width: 100%; border-collapse: collapse; margin: 15px 0; }
    th { background: #fd6301; color: white; padding: 8px; text-align: left; }
    td { padding: 8px; border-bottom: 1px solid #e5e7eb; }
    .totals { background: #f8fafc; padding: 15px; margin: 15px 0; }
    .total-row { display: flex; justify-content: space-between; margin: 6px 0; }
    .final-total { font-size: 16px; font-weight: bold; border-top: 2px solid #e2e8f0; padding-top: 10px; color: #fd6301; }
  </style>
</head>
<body>
  <div class="header">
    <div><div style="width: 220px; height: 60px; background: #f3f4f6; display: flex; align-items: center; justify-content: center;">Logo Panorámica</div></div>
    <div style="text-align: right;"><h1>COTIZACIÓN</h1><p>Fecha: ${quoteDate}</p><p>N°: ${escapeHtml(quote.quoteNumber)}</p></div>
  </div>
  <div style="background: #fff7ed; border: 1px solid #fdba74; padding: 12px; margin: 15px 0;">
    <p><strong>Cliente:</strong> ${escapeHtml(quote.clientName)}</p>
    ${quote.clientRut ? `<p><strong>RUT:</strong> ${escapeHtml(quote.clientRut)}</p>` : ''}
  </div>
  <table>
    <thead><tr><th>Producto</th><th style="text-align: center;">Unidad</th><th style="text-align: center;">Cant.</th><th style="text-align: right;">Precio</th><th style="text-align: right;">Total</th></tr></thead>
    <tbody>${productRows}</tbody>
  </table>
  <div class="totals">
    <div class="total-row"><span>Subtotal:</span><span>${formatCurrency(subtotal)}</span></div>
    <div class="total-row"><span>IVA (19%):</span><span>${formatCurrency(tax)}</span></div>
    <div class="total-row final-total"><span>Total Final:</span><span>${formatCurrency(total)}</span></div>
  </div>
</body>
</html>`;

    const element = document.createElement('div');
    element.innerHTML = htmlContent;
    element.style.position = 'absolute';
    element.style.left = '-9999px';
    document.body.appendChild(element);

    const opt = {
      margin: 0,
      filename: `Cotizacion_${quote.quoteNumber}.pdf`,
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    const pdfBlob = await html2pdf().set(opt).from(element).outputPdf('blob');
    document.body.removeChild(element);

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(pdfBlob);
    });
  };

  // Function to open quote in edit mode
  const handleEditQuote = (quoteId: string) => {
    if (onEditQuote) {
      onEditQuote(quoteId);
    } else {
      // Fallback to navigation if no prop is provided
      navigate(`/tomador-pedidos?quoteId=${quoteId}`);
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
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{getTotalQuotes()}</div>
          </CardContent>
        </Card>
        
        <Card className="hidden md:block">
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
                  <TableHead className="text-left hidden md:table-cell">Cotización</TableHead>
                  <TableHead className="text-left">Cliente</TableHead>
                  {(user?.role === 'admin' || user?.role === 'supervisor') && (
                    <TableHead className="text-left">Creado por</TableHead>
                  )}
                  <TableHead className="text-left">Estado</TableHead>
                  <TableHead className="text-left">Creada</TableHead>
                  <TableHead className="text-center">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={5} className="text-center py-8">
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
                      className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors cursor-pointer"
                      data-testid={`quote-row-${quote.id}`}
                      onClick={() => handleEditQuote(quote.id)}
                    >
                      <TableCell className="py-4 hidden md:table-cell">
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

                      {(user?.role === 'admin' || user?.role === 'supervisor') && (
                        <TableCell className="py-4">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-gray-400" />
                            <div>
                              <div className="text-sm text-gray-900 font-medium">
                                {quote.creatorName || 'Usuario desconocido'}
                              </div>
                              {quote.creatorEmail && (
                                <div className="text-xs text-gray-500">
                                  {quote.creatorEmail}
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                      )}
                      
                      <TableCell className="py-4">
                        {getStatusBadge(quote.status)}
                      </TableCell>
                      
                      <TableCell className="py-4">
                        <div className="text-sm text-gray-900">
                          {formatDate(quote.createdAt)}
                        </div>
                        <div className="text-xs text-gray-500">
                          {getTimeAgo(quote.createdAt)}
                        </div>
                      </TableCell>
                      
                      <TableCell 
                        className="py-4 text-center"
                        onClick={(e) => e.stopPropagation()} // Prevent row click when clicking actions
                      >
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" data-testid={`actions-${quote.id}`}>
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem 
                              data-testid={`view-${quote.id}`}
                              onClick={() => handleEditQuote(quote.id)}
                            >
                              <FileText className="w-4 h-4 mr-2" />
                              Ver / Editar
                            </DropdownMenuItem>
                            
                            <DropdownMenuItem 
                              data-testid={`send-email-${quote.id}`}
                              onClick={() => handleSendEmail(quote.id, quote.quoteNumber)}
                              disabled={sendEmailMutation.isPending}
                            >
                              <Mail className="w-4 h-4 mr-2" />
                              {sendEmailMutation.isPending ? 'Enviando correo...' : 'Enviar por correo'}
                            </DropdownMenuItem>
                            
                            {/* Status change options */}
                            {quote.status === 'draft' && (
                              <DropdownMenuItem 
                                data-testid={`status-sent-${quote.id}`}
                                onClick={() => handleStatusChange(quote.id, 'sent', quote.quoteNumber)}
                                disabled={updateStatusMutation.isPending}
                              >
                                <Send className="w-4 h-4 mr-2" />
                                Marcar como enviada
                              </DropdownMenuItem>
                            )}
                            
                            {quote.status === 'sent' && (
                              <>
                                <DropdownMenuItem 
                                  data-testid={`status-accepted-${quote.id}`}
                                  onClick={() => handleStatusChange(quote.id, 'accepted', quote.quoteNumber)}
                                  disabled={updateStatusMutation.isPending}
                                >
                                  <CheckCircle className="w-4 h-4 mr-2" />
                                  Marcar como aprobada
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  data-testid={`status-rejected-${quote.id}`}
                                  onClick={() => handleStatusChange(quote.id, 'rejected', quote.quoteNumber)}
                                  disabled={updateStatusMutation.isPending}
                                >
                                  <XCircle className="w-4 h-4 mr-2" />
                                  Marcar como cancelada
                                </DropdownMenuItem>
                              </>
                            )}
                            
                            {(quote.status === 'rejected' || quote.status === 'accepted') && (
                              <DropdownMenuItem 
                                data-testid={`status-draft-${quote.id}`}
                                onClick={() => handleStatusChange(quote.id, 'draft', quote.quoteNumber)}
                                disabled={updateStatusMutation.isPending}
                              >
                                <FileText className="w-4 h-4 mr-2" />
                                Volver a borrador
                              </DropdownMenuItem>
                            )}
                            
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
                    <TableCell colSpan={5} className="text-center py-12">
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