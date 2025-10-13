import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format } from "date-fns";
import { FileText, Package, DollarSign, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Quote {
  id: string;
  quoteNumber: string;
  clientName: string;
  clientRut?: string;
  clientEmail?: string;
  clientPhone?: string;
  clientAddress?: string;
  status: "draft" | "sent" | "accepted" | "rejected" | "converted";
  subtotal: number;
  discount?: number;
  taxRate?: number;
  taxAmount?: number;
  total: number;
  notes?: string;
  validUntil?: string;
  createdAt: string;
  salespersonName?: string;
  creatorName?: string;
  creatorEmail?: string;
  creatorFirstName?: string;
  creatorLastName?: string;
}

interface QuoteItem {
  id: string;
  quoteId: string;
  type: "standard" | "custom";
  productCode?: string;
  productName: string;
  customSku?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  notes?: string;
}

interface QuoteWithItems extends Quote {
  items: QuoteItem[];
}

export default function Reception() {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Redirect if not reception user
  useEffect(() => {
    if (!isLoading && (!user || user.role !== 'reception')) {
      toast({
        title: "Acceso denegado",
        description: "No tienes permisos para acceder a esta página.",
        variant: "destructive",
      });
      setLocation("/");
    }
  }, [user, isLoading, toast, setLocation]);

  // Fetch quotes with status "sent"
  const { data: quotes = [], isLoading: isLoadingQuotes } = useQuery<Quote[]>({
    queryKey: ["/api/quotes"],
    enabled: !!user && user.role === 'reception',
  });

  // Fetch selected quote details
  const { data: selectedQuote, isLoading: isLoadingQuoteDetails } = useQuery<QuoteWithItems>({
    queryKey: ["/api/quotes", selectedQuoteId, "with-items"],
    enabled: !!selectedQuoteId,
  });

  // Filter only sent quotes
  const sentQuotes = quotes.filter(q => q.status === 'sent');

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "dd/MM/yyyy");
  };

  const handleViewQuote = (quoteId: string) => {
    setSelectedQuoteId(quoteId);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedQuoteId(null);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      draft: { label: 'Borrador', className: 'bg-gray-100 text-gray-800' },
      sent: { label: 'Enviado', className: 'bg-blue-100 text-blue-800' },
      accepted: { label: 'Aceptado', className: 'bg-green-100 text-green-800' },
      rejected: { label: 'Rechazado', className: 'bg-red-100 text-red-800' },
      converted: { label: 'Convertido', className: 'bg-purple-100 text-purple-800' },
    };
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.draft;
    return <Badge variant="secondary" className={config.className}>{config.label}</Badge>;
  };

  if (isLoading || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Recepción</h1>
          <p className="text-gray-600">Presupuestos enviados pendientes de gestión</p>
        </div>

        {/* Stats Card */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Presupuestos</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{sentQuotes.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Monto Total</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(sentQuotes.reduce((sum, q) => sum + Number(q.total || 0), 0))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Estado</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                  Enviados
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quotes List */}
        <Card>
          <CardHeader>
            <CardTitle>Presupuestos Enviados</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingQuotes ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                <p className="text-muted-foreground text-sm">Cargando presupuestos...</p>
              </div>
            ) : sentQuotes.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-500">No hay presupuestos enviados en este momento</p>
              </div>
            ) : (
              <div className="space-y-3">
                {sentQuotes.map((quote) => (
                  <div
                    key={quote.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => handleViewQuote(quote.id)}
                    data-testid={`quote-${quote.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-gray-900">
                          Presupuesto #{quote.quoteNumber}
                        </h3>
                        <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                          Enviado
                        </Badge>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-sm text-gray-600">
                        <div>
                          <span className="font-medium">Cliente:</span> {quote.clientName}
                        </div>
                        <div>
                          <span className="font-medium">Fecha:</span> {formatDate(quote.createdAt)}
                        </div>
                        {quote.creatorName && (
                          <div>
                            <span className="font-medium">Enviado por:</span> {quote.creatorName}
                          </div>
                        )}
                        {quote.salespersonName && (
                          <div>
                            <span className="font-medium">Vendedor:</span> {quote.salespersonName}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 ml-4">
                      <div className="text-right">
                        <div className="text-lg font-bold text-gray-900">
                          {formatCurrency(Number(quote.total || 0))}
                        </div>
                        <div className="text-xs text-gray-500">
                          Subtotal: {formatCurrency(Number(quote.subtotal || 0))}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewQuote(quote.id);
                        }}
                        data-testid={`button-view-quote-${quote.id}`}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        Ver
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quote Details Modal */}
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Detalles del Presupuesto</DialogTitle>
            </DialogHeader>
            
            {isLoadingQuoteDetails ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                <p className="text-muted-foreground text-sm">Cargando detalles...</p>
              </div>
            ) : selectedQuote ? (
              <div className="space-y-6">
                {/* Header Info */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">
                        Presupuesto #{selectedQuote.quoteNumber}
                      </h3>
                      <p className="text-sm text-gray-600">
                        Creado el {formatDate(selectedQuote.createdAt)}
                      </p>
                    </div>
                    {getStatusBadge(selectedQuote.status)}
                  </div>

                  {/* Client Info */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <h4 className="font-semibold text-gray-700 mb-2">Información del Cliente</h4>
                      <div className="space-y-1 text-sm">
                        <p><span className="font-medium">Nombre:</span> {selectedQuote.clientName}</p>
                        {selectedQuote.clientRut && (
                          <p><span className="font-medium">RUT:</span> {selectedQuote.clientRut}</p>
                        )}
                        {selectedQuote.clientEmail && (
                          <p><span className="font-medium">Email:</span> {selectedQuote.clientEmail}</p>
                        )}
                        {selectedQuote.clientPhone && (
                          <p><span className="font-medium">Teléfono:</span> {selectedQuote.clientPhone}</p>
                        )}
                        {selectedQuote.clientAddress && (
                          <p><span className="font-medium">Dirección:</span> {selectedQuote.clientAddress}</p>
                        )}
                      </div>
                    </div>

                    <div>
                      <h4 className="font-semibold text-gray-700 mb-2">Información del Presupuesto</h4>
                      <div className="space-y-1 text-sm">
                        {selectedQuote.creatorName && (
                          <p><span className="font-medium">Enviado por:</span> {selectedQuote.creatorName}</p>
                        )}
                        {selectedQuote.validUntil && (
                          <p><span className="font-medium">Válido hasta:</span> {formatDate(selectedQuote.validUntil)}</p>
                        )}
                        {selectedQuote.notes && (
                          <p><span className="font-medium">Notas:</span> {selectedQuote.notes}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Items Table */}
                <div>
                  <h4 className="font-semibold text-gray-700 mb-3">Productos</h4>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Producto
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            SKU
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Cantidad
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Precio Unit.
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Total
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {selectedQuote.items?.map((item) => (
                          <tr key={item.id}>
                            <td className="px-4 py-3 text-sm text-gray-900">
                              {item.productName}
                              {item.notes && (
                                <p className="text-xs text-gray-500 mt-1">{item.notes}</p>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {item.type === 'custom' ? item.customSku : item.productCode}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900 text-right">
                              {item.quantity}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900 text-right">
                              {formatCurrency(Number(item.unitPrice))}
                            </td>
                            <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right">
                              {formatCurrency(Number(item.totalPrice))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Totals */}
                <div className="border-t pt-4">
                  <div className="max-w-sm ml-auto space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Subtotal:</span>
                      <span className="font-medium">{formatCurrency(Number(selectedQuote.subtotal))}</span>
                    </div>
                    {selectedQuote.discount && Number(selectedQuote.discount) > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Descuento:</span>
                        <span className="font-medium text-red-600">-{formatCurrency(Number(selectedQuote.discount))}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">IVA ({selectedQuote.taxRate || 19}%):</span>
                      <span className="font-medium">{formatCurrency(Number(selectedQuote.taxAmount || 0))}</span>
                    </div>
                    <div className="flex justify-between text-lg font-bold border-t pt-2">
                      <span>Total:</span>
                      <span>{formatCurrency(Number(selectedQuote.total))}</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
