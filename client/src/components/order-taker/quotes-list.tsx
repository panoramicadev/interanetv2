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
import { useIsMobile } from "@/hooks/use-mobile";

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
  const [creatorFilter, setCreatorFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [displayLimit, setDisplayLimit] = useState(20);
  const { toast } = useToast();
  const { user } = useAuth();
  const [, navigate] = useLocation();

  // Build query parameters
  const buildQueryParams = () => {
    const params = new URLSearchParams();
    params.set('limit', '500'); // Get more records for client-side filtering
    params.set('offset', '0');

    if (statusFilter !== "all") {
      params.set('status', statusFilter);
    }

    if (searchTerm.trim()) {
      params.set('clientName', searchTerm.trim());
    }

    if (creatorFilter !== "all") {
      params.set('createdBy', creatorFilter);
    }

    if (dateFrom) {
      params.set('dateFrom', dateFrom);
    }

    if (dateTo) {
      params.set('dateTo', dateTo);
    }

    return params.toString();
  };

  const { data: quotes, isLoading, error } = useQuery<Quote[]>({
    queryKey: [`/api/quotes?${buildQueryParams()}`],
  });

  // Get unique creators for filter dropdown
  const { data: creators } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ['/api/quotes/creators'],
  });

  // Reset display limit when filters change
  const handleFilterChange = () => {
    setDisplayLimit(20);
  };

  // Paginated quotes
  const displayedQuotes = quotes?.slice(0, displayLimit) || [];
  const hasMore = quotes && quotes.length > displayLimit;

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

  const isMobile = useIsMobile();

  return (
    <div className="space-y-4">
      {/* Filters - Mobile Compact */}
      <div className={`${isMobile ? 'space-y-3' : 'flex flex-col sm:flex-row gap-4'}`}>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Buscar por nombre de cliente..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); handleFilterChange(); }}
            className={`pl-10 ${isMobile ? 'h-11 rounded-xl text-sm' : ''}`}
            style={isMobile ? { fontSize: '16px' } : undefined}
            data-testid="input-search-quotes"
          />
        </div>

        <div className={`${isMobile ? 'grid grid-cols-2 gap-2' : 'flex gap-4'}`}>
          <Select value={statusFilter} onValueChange={(value) => { setStatusFilter(value); handleFilterChange(); }}>
            <SelectTrigger className={`${isMobile ? 'h-10 rounded-xl text-xs' : 'w-full sm:w-[200px]'}`} data-testid="select-status-filter">
              <Filter className="w-3.5 h-3.5 mr-1.5" />
              <SelectValue placeholder="Estado" />
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

          {/* Creator Filter - Only for admin/supervisor */}
          {(user?.role === 'admin' || user?.role === 'supervisor') && creators && creators.length > 0 && (
            <Select value={creatorFilter} onValueChange={(value) => { setCreatorFilter(value); handleFilterChange(); }}>
              <SelectTrigger className={`${isMobile ? 'h-10 rounded-xl text-xs' : 'w-full sm:w-[200px]'}`} data-testid="select-creator-filter">
                <User className="w-3.5 h-3.5 mr-1.5" />
                <SelectValue placeholder="Emisor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los emisores</SelectItem>
                {creators.map((creator) => (
                  <SelectItem key={creator.id} value={creator.id}>
                    {creator.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Date Filters - Compact Row */}
      {!isMobile && (
        <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); handleFilterChange(); }}
              className="w-[150px]"
              placeholder="Desde"
              data-testid="input-date-from"
            />
            <span className="text-gray-400">-</span>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); handleFilterChange(); }}
              className="w-[150px]"
              placeholder="Hasta"
              data-testid="input-date-to"
            />
          </div>
          {(dateFrom || dateTo || creatorFilter !== "all" || statusFilter !== "all" || searchTerm) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setDateFrom("");
                setDateTo("");
                setCreatorFilter("all");
                setStatusFilter("all");
                setSearchTerm("");
                handleFilterChange();
              }}
              data-testid="button-clear-filters"
            >
              Limpiar filtros
            </Button>
          )}
        </div>
      )}

      {/* Mobile Card View / Desktop Table View */}
      {isMobile ? (
        <div className="space-y-3">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-100 p-4 space-y-3 animate-pulse">
                <div className="flex justify-between">
                  <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                  <div className="h-5 bg-gray-200 rounded-full w-16"></div>
                </div>
                <div className="h-3 bg-gray-100 rounded w-1/3"></div>
                <div className="h-3 bg-gray-100 rounded w-1/2"></div>
              </div>
            ))
          ) : displayedQuotes && displayedQuotes.length > 0 ? (
            displayedQuotes.map((quote) => {
              const status = statusConfig[quote.status] || statusConfig.draft;
              const StatusIcon = status.icon;
              return (
                <div
                  key={quote.id}
                  className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 active:bg-gray-50 transition-colors"
                  onClick={() => handleEditQuote(quote.id)}
                  data-testid={`quote-row-${quote.id}`}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-sm truncate" data-testid={`client-name-${quote.id}`}>
                        {quote.clientName}
                      </p>
                      {quote.clientRut && (
                        <p className="text-xs text-gray-400 mt-0.5">RUT: {quote.clientRut}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge className={`${status.color} text-[10px] px-2 py-0.5 font-medium`}>
                        <StatusIcon className="w-3 h-3 mr-1" />
                        {status.label}
                      </Badge>
                      <div onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" data-testid={`actions-${quote.id}`}>
                              <MoreVertical className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEditQuote(quote.id)}>
                              <FileText className="w-4 h-4 mr-2" /> Ver / Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleSendEmail(quote.id, quote.quoteNumber)} disabled={sendEmailMutation.isPending}>
                              <Mail className="w-4 h-4 mr-2" /> Compartir
                            </DropdownMenuItem>
                            {(quote.status === 'draft' || quote.status === 'sent' || quote.status === 'accepted' || quote.status === 'rejected') && (
                              <DropdownMenuItem onClick={() => handleDuplicateForEdit(quote.id)} disabled={duplicateQuoteMutation.isPending}>
                                <Copy className="w-4 h-4 mr-2" /> Duplicar
                              </DropdownMenuItem>
                            )}
                            {(user?.role === 'admin' || user?.role === 'supervisor') && (
                              <DropdownMenuItem onClick={() => handleDeleteQuote(quote.id, quote.quoteNumber)} disabled={deleteQuoteMutation.isPending} className="text-red-600 focus:text-red-600 focus:bg-red-50">
                                <Trash2 className="w-4 h-4 mr-2" /> Eliminar
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      {(user?.role === 'admin' || user?.role === 'supervisor') && (
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {quote.creatorName || 'Desconocido'}
                        </span>
                      )}
                      <span>{getTimeAgo(quote.createdAt)}</span>
                    </div>
                    <span className="text-sm font-bold text-gray-900">
                      ${parseFloat(quote.total).toLocaleString('es-CL', { minimumFractionDigits: 0 })}
                    </span>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-10">
              <FileText className="mx-auto h-10 w-10 text-gray-300 mb-3" />
              <p className="text-sm font-medium text-gray-500">No hay cotizaciones</p>
              <p className="text-xs text-gray-400 mt-1">
                {searchTerm || statusFilter !== "all" ? "Intenta con otros filtros." : "Crea tu primera cotización."}
              </p>
            </div>
          )}
        </div>
      ) : (
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-gray-200">
                  <TableHead className="text-left hidden md:table-cell">Cotización</TableHead>
                  <TableHead className="text-left">Cliente</TableHead>
                  <TableHead className="text-left">Estado</TableHead>
                  {(user?.role === 'admin' || user?.role === 'supervisor') && (
                    <TableHead className="text-left">Creado por</TableHead>
                  )}
                  <TableHead className="text-left">Creada</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead className="text-center w-36">Acciones</TableHead>
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
                ) : displayedQuotes && displayedQuotes.length > 0 ? (
                  displayedQuotes.map((quote) => (
                    <TableRow
                      key={quote.id}
                      className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors cursor-pointer group"
                      data-testid={`quote-row-${quote.id}`}
                      onClick={() => handleEditQuote(quote.id)}
                    >
                      <TableCell className="py-4 hidden md:table-cell">
                        <div className="font-medium text-gray-900" data-testid={`quote-number-${quote.id}`}>
                          #{quote.quoteNumber}
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">
                          {quote.notes && quote.notes.length > 40
                            ? `${quote.notes.substring(0, 40)}...`
                            : quote.notes || 'Sin notas'
                          }
                        </div>
                      </TableCell>

                      <TableCell className="py-4">
                        <div className="font-medium text-gray-900" data-testid={`client-name-${quote.id}`}>
                          {quote.clientName}
                        </div>
                        {quote.clientRut && (
                          <div className="text-xs text-gray-400 mt-0.5">
                            RUT: {quote.clientRut}
                          </div>
                        )}
                      </TableCell>

                      <TableCell className="py-4" onClick={(e) => e.stopPropagation()}>
                        {getStatusBadge(quote.status)}
                        {quote.status === 'accepted' && quote.notes?.includes('[NVV-AUTO]') && (
                          <div className="text-[9px] text-emerald-600 font-medium mt-0.5 flex items-center gap-0.5">
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            Auto NVV
                          </div>
                        )}
                      </TableCell>

                      {(user?.role === 'admin' || user?.role === 'supervisor') && (
                        <TableCell className="py-4">
                          <div className="flex items-center gap-2">
                            <User className="w-3.5 h-3.5 text-gray-400" />
                            <div>
                              <div className="text-sm text-gray-900 font-medium">
                                {quote.creatorName || 'Desconocido'}
                              </div>
                              {quote.creatorEmail && (
                                <div className="text-[10px] text-gray-400">
                                  {quote.creatorEmail}
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                      )}

                      <TableCell className="py-4">
                        <div className="text-sm text-gray-900">
                          {formatDate(quote.createdAt)}
                        </div>
                        <div className="text-[10px] text-gray-400">
                          {getTimeAgo(quote.createdAt)}
                        </div>
                      </TableCell>

                      <TableCell className="py-4 text-right">
                        <span className="font-bold text-blue-600">
                          {formatCurrency(quote.total || '0')}
                        </span>
                      </TableCell>

                      <TableCell
                        className="py-4"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center gap-1 justify-center">
                          {/* Quick action: Mark as sent (draft only) */}
                          {quote.status === 'draft' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                              onClick={() => handleStatusChange(quote.id, 'sent', quote.quoteNumber)}
                              disabled={updateStatusMutation.isPending}
                              title="Marcar como enviada"
                            >
                              <Send className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {/* Quick action: Send email */}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                            onClick={() => handleSendEmail(quote.id, quote.quoteNumber)}
                            disabled={sendEmailMutation.isPending}
                            title="Compartir por email"
                          >
                            <Mail className="h-3.5 w-3.5" />
                          </Button>
                          {/* More actions dropdown */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 hover:bg-gray-100" data-testid={`actions-${quote.id}`}>
                                <MoreVertical className="h-3.5 w-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem
                                data-testid={`view-${quote.id}`}
                                onClick={() => handleEditQuote(quote.id)}
                                className="text-xs gap-2"
                              >
                                <FileText className="w-3.5 h-3.5" />
                                Ver / Editar
                              </DropdownMenuItem>

                              {quote.status === 'draft' && (
                                <DropdownMenuItem
                                  data-testid={`status-sent-${quote.id}`}
                                  onClick={() => handleStatusChange(quote.id, 'sent', quote.quoteNumber)}
                                  disabled={updateStatusMutation.isPending}
                                  className="text-xs gap-2"
                                >
                                  <Send className="w-3.5 h-3.5" />
                                  Marcar como enviada
                                </DropdownMenuItem>
                              )}

                              {quote.status === 'sent' && (
                                <DropdownMenuItem
                                  data-testid={`status-rejected-${quote.id}`}
                                  onClick={() => handleStatusChange(quote.id, 'rejected', quote.quoteNumber)}
                                  disabled={updateStatusMutation.isPending}
                                  className="text-xs gap-2"
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                  Marcar como rechazada
                                </DropdownMenuItem>
                              )}

                              {(quote.status === 'rejected' || quote.status === 'accepted') && (
                                <DropdownMenuItem
                                  data-testid={`status-draft-${quote.id}`}
                                  onClick={() => handleStatusChange(quote.id, 'draft', quote.quoteNumber)}
                                  disabled={updateStatusMutation.isPending}
                                  className="text-xs gap-2"
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                  Volver a borrador
                                </DropdownMenuItem>
                              )}

                              {(quote.status === 'draft' || quote.status === 'sent' || quote.status === 'accepted' || quote.status === 'rejected') && (
                                <DropdownMenuItem
                                  data-testid={`button-duplicate-quote-${quote.id}`}
                                  onClick={() => handleDuplicateForEdit(quote.id)}
                                  disabled={duplicateQuoteMutation.isPending}
                                  className="text-xs gap-2"
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                  Duplicar para editar
                                </DropdownMenuItem>
                              )}
                              {(user?.role === 'admin' || user?.role === 'supervisor') && (
                                <DropdownMenuItem
                                  data-testid={`button-delete-quote-${quote.id}`}
                                  onClick={() => handleDeleteQuote(quote.id, quote.quoteNumber)}
                                  disabled={deleteQuoteMutation.isPending}
                                  className="text-xs gap-2 text-red-600 focus:text-red-600 focus:bg-red-50"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  Eliminar
                                </DropdownMenuItem>
                              )}
                              {(quote.status === 'accepted' || quote.status === 'sent') && (
                                <DropdownMenuItem data-testid={`convert-${quote.id}`} className="text-xs gap-2">
                                  <Package className="w-3.5 h-3.5" />
                                  Convertir a pedido
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12">
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
      )}

      {/* Load More Button */}
      {hasMore && (
        <div className="flex justify-center pt-4">
          <Button
            variant="outline"
            onClick={() => setDisplayLimit(prev => prev + 20)}
            className="w-full sm:w-auto"
            data-testid="button-load-more"
          >
            <Clock className="w-4 h-4 mr-2" />
            Cargar más cotizaciones ({displayLimit} de {quotes?.length || 0})
          </Button>
        </div>
      )}

      {/* Results summary */}
      {quotes && quotes.length > 0 && (
        <div className="text-center text-sm text-gray-500">
          Mostrando {Math.min(displayLimit, quotes.length)} de {quotes.length} cotizaciones
        </div>
      )}
    </div>
  );
}