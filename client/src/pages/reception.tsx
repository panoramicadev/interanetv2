import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format } from "date-fns";
import { FileText, Package, DollarSign, Eye, CheckCircle, XCircle, Download, FileDown, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { pdf } from "@react-pdf/renderer";
import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";

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

// PDF Styles
const pdfStyles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 9,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  section: {
    marginBottom: 15,
  },
  table: {
    marginTop: 10,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingVertical: 8,
  },
  tableHeader: {
    backgroundColor: '#f3f4f6',
    fontWeight: 'bold',
  },
  col1: { width: '40%', paddingRight: 5 },
  col2: { width: '15%', paddingRight: 5, textAlign: 'right' },
  col3: { width: '15%', paddingRight: 5, textAlign: 'right' },
  col4: { width: '15%', paddingRight: 5, textAlign: 'right' },
  col5: { width: '15%', textAlign: 'right' },
  totals: {
    marginTop: 20,
    alignItems: 'flex-end',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: 200,
    marginBottom: 5,
  },
});

// PDF Document Component
const QuotePDFDocument = ({ quote, items }: { quote: QuoteWithItems; items: QuoteItem[] }) => {
  const formatCurrency = (value: number | string) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return `$${num.toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  return (
    <Document>
      <Page size="A4" style={pdfStyles.page}>
        <View style={pdfStyles.header}>
          <View>
            <Text style={pdfStyles.title}>PRESUPUESTO</Text>
            <Text>N° {quote.quoteNumber}</Text>
            <Text>Fecha: {format(new Date(quote.createdAt), 'dd/MM/yyyy')}</Text>
          </View>
        </View>

        <View style={pdfStyles.section}>
          <Text style={{ fontWeight: 'bold', marginBottom: 5 }}>Cliente:</Text>
          <Text>{quote.clientName}</Text>
          {quote.clientRut && <Text>RUT: {quote.clientRut}</Text>}
          {quote.clientEmail && <Text>Email: {quote.clientEmail}</Text>}
          {quote.clientPhone && <Text>Teléfono: {quote.clientPhone}</Text>}
        </View>

        <View style={pdfStyles.table}>
          <View style={[pdfStyles.tableRow, pdfStyles.tableHeader]}>
            <Text style={pdfStyles.col1}>Producto</Text>
            <Text style={pdfStyles.col2}>SKU</Text>
            <Text style={pdfStyles.col3}>Cantidad</Text>
            <Text style={pdfStyles.col4}>P. Unit.</Text>
            <Text style={pdfStyles.col5}>Total</Text>
          </View>
          {items.map((item, index) => (
            <View key={index} style={pdfStyles.tableRow}>
              <Text style={pdfStyles.col1}>{item.productName}</Text>
              <Text style={pdfStyles.col2}>{item.type === 'custom' ? item.customSku : item.productCode}</Text>
              <Text style={pdfStyles.col3}>{item.quantity}</Text>
              <Text style={pdfStyles.col4}>{formatCurrency(Number(item.unitPrice))}</Text>
              <Text style={pdfStyles.col5}>{formatCurrency(Number(item.totalPrice))}</Text>
            </View>
          ))}
        </View>

        <View style={pdfStyles.totals}>
          <View style={pdfStyles.totalRow}>
            <Text>Subtotal:</Text>
            <Text>{formatCurrency(Number(quote.subtotal))}</Text>
          </View>
          {quote.discount && Number(quote.discount) > 0 && (
            <View style={pdfStyles.totalRow}>
              <Text>Descuento:</Text>
              <Text>-{formatCurrency(Number(quote.discount))}</Text>
            </View>
          )}
          <View style={pdfStyles.totalRow}>
            <Text>IVA ({quote.taxRate || 19}%):</Text>
            <Text>{formatCurrency(Number(quote.taxAmount || 0))}</Text>
          </View>
          <View style={[pdfStyles.totalRow, { borderTopWidth: 1, paddingTop: 5 }]}>
            <Text style={{ fontWeight: 'bold' }}>Total:</Text>
            <Text style={{ fontWeight: 'bold' }}>{formatCurrency(Number(quote.total))}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
};

export default function Reception() {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [copiedSku, setCopiedSku] = useState<string | null>(null);
  const [selectedVendor, setSelectedVendor] = useState<string>("all");
  const [selectedClient, setSelectedClient] = useState<string>("all");

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

  // Filter sent, converted, and rejected quotes and apply additional filters
  const sentQuotes = quotes.filter(q => {
    // Include sent, converted, and rejected quotes
    if (!['sent', 'converted', 'rejected'].includes(q.status)) return false;
    if (selectedVendor !== 'all' && q.creatorName !== selectedVendor) return false;
    if (selectedClient !== 'all' && q.clientName !== selectedClient) return false;
    return true;
  });

  // Get unique vendors and clients from all sent/converted/rejected quotes for filter options
  const allSentQuotes = quotes.filter(q => ['sent', 'converted', 'rejected'].includes(q.status));
  const uniqueVendors = Array.from(new Set(allSentQuotes.map(q => q.creatorName).filter(Boolean)));
  const uniqueClients = Array.from(new Set(allSentQuotes.map(q => q.clientName).filter(Boolean)));

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
      converted: { label: 'Enviado como pedido', className: 'bg-purple-100 text-purple-800' },
    };
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.draft;
    return <Badge variant="secondary" className={config.className}>{config.label}</Badge>;
  };

  // Mutation to update quote status
  const updateStatusMutation = useMutation({
    mutationFn: async ({ quoteId, status }: { quoteId: string; status: string }) => {
      return await apiRequest(`/api/quotes/${quoteId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
    },
    onSuccess: (data, variables) => {
      // Immediately update the query cache with the new status
      queryClient.setQueryData(["/api/quotes", selectedQuoteId, "with-items"], (oldData: any) => {
        if (oldData) {
          return { ...oldData, status: variables.status };
        }
        return oldData;
      });
      
      // Update the quotes list cache
      queryClient.setQueryData(["/api/quotes"], (oldData: any) => {
        if (oldData && Array.isArray(oldData)) {
          return oldData.map((q: Quote) => 
            q.id === variables.quoteId ? { ...q, status: variables.status } : q
          );
        }
        return oldData;
      });
      
      // Then refetch to ensure data consistency
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/quotes", selectedQuoteId, "with-items"] });
      
      const statusLabels = {
        converted: "convertido a pedido",
        rejected: "rechazado",
      };
      
      toast({
        title: "Estado actualizado",
        description: `El presupuesto ha sido ${statusLabels[variables.status as keyof typeof statusLabels] || "actualizado"} correctamente.`,
      });
      
      // Close modal after a short delay to show the updated status
      setTimeout(() => {
        handleCloseModal();
      }, 1500);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo actualizar el estado del presupuesto.",
        variant: "destructive",
      });
    },
  });

  const handleConvertToOrder = () => {
    if (!selectedQuoteId) return;
    updateStatusMutation.mutate({ quoteId: selectedQuoteId, status: "converted" });
  };

  const handleReject = () => {
    if (!selectedQuoteId) return;
    updateStatusMutation.mutate({ quoteId: selectedQuoteId, status: "rejected" });
  };

  const generatePDFFilename = (clientName: string, createdAt: string | Date, quoteNumber: string): string => {
    const cleanName = clientName
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9\s]/g, "")
      .replace(/\s+/g, "")
      .substring(0, 30);
    
    const date = new Date(createdAt);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);
    
    const quoteNum = String(quoteNumber).padStart(3, '0');
    
    return `${cleanName}-${day}${month}${year}-${quoteNum}.pdf`;
  };

  const handleDownloadPDF = async (quote: QuoteWithItems) => {
    try {
      if (!quote.items || quote.items.length === 0) {
        toast({
          title: "Error",
          description: "No se pueden generar PDFs de presupuestos sin productos.",
          variant: "destructive",
        });
        return;
      }

      const pdfBlob = await pdf(<QuotePDFDocument quote={quote} items={quote.items} />).toBlob();
      const url = URL.createObjectURL(pdfBlob);
      
      const pdfFilename = generatePDFFilename(
        quote.clientName || 'Cliente',
        quote.createdAt || new Date(),
        quote.quoteNumber || 'XXX'
      );
      
      const a = document.createElement('a');
      a.href = url;
      a.download = pdfFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "PDF descargado",
        description: `El archivo ${pdfFilename} se ha descargado correctamente.`,
      });
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({
        title: "Error",
        description: "No se pudo generar el PDF.",
        variant: "destructive",
      });
    }
  };

  const handleDownloadRandomFile = async (quote: QuoteWithItems | Quote) => {
    try {
      // Obtener los items si no están presentes
      let quoteWithItems: QuoteWithItems;
      if ('items' in quote && quote.items) {
        quoteWithItems = quote as QuoteWithItems;
      } else {
        quoteWithItems = await queryClient.fetchQuery({
          queryKey: ["/api/quotes", quote.id, "with-items"],
        });
      }

      if (!quoteWithItems.items || quoteWithItems.items.length === 0) {
        toast({
          title: "Error",
          description: "No se pueden generar archivos de presupuestos sin productos.",
          variant: "destructive",
        });
        return;
      }

      // Obtener lista de precios completa para consultar unidades de productos
      // Crear mapa de unidades por código de producto
      const unitMap = new Map<string, string>();
      try {
        // Usar limit alto para obtener todos los productos
        const response = await fetch('/api/price-list?limit=10000', {
          credentials: 'include'
        });
        if (response.ok) {
          const data = await response.json();
          console.log('Respuesta API price-list:', JSON.stringify(data).substring(0, 500));
          const items = data?.items || [];
          console.log(`Lista de precios cargada: ${items.length} productos`);
          
          // Mostrar primeros 3 items para verificar estructura
          if (items.length > 0) {
            console.log('Ejemplo de item:', JSON.stringify(items[0]));
            console.log('Campos disponibles:', Object.keys(items[0]));
          }
          
          // Crear mapa de unidades por código
          items.forEach((item: Record<string, unknown>) => {
            const codigo = item.codigo as string;
            const unidad = item.unidad as string;
            if (codigo) {
              unitMap.set(codigo, unidad || '');
            }
          });
          console.log(`Mapa de unidades creado: ${unitMap.size} productos`);
          
          // Verificar productos específicos de la cotización
          const testCodes = ['PANES930BL001', 'PCA103MADPLU2', 'PANES930BL056'];
          testCodes.forEach(code => {
            const unidad = unitMap.get(code);
            console.log(`Test unitMap[${code}] = "${unidad}"`);
          });
        } else {
          console.error('Error al cargar lista de precios:', response.status, response.statusText);
        }
      } catch (e) {
        console.warn("No se pudo obtener lista de precios para unidades", e);
      }

      // Función para determinar si es unidad primaria (GL) o secundaria (1/4, BD, etc.)
      const isPrimaryUnit = (productCode: string): boolean => {
        const unidad = unitMap.get(productCode);
        if (unidad === undefined) {
          console.warn(`Producto no encontrado en mapa de unidades: ${productCode}`);
          return true; // Por defecto, asumir primaria
        }
        const unidadUpper = (unidad || '').toUpperCase().trim();
        // Unidad primaria: SOLO "GL" exacto (Galón)
        // Unidad secundaria: 1/4, BD, cualquier otra cosa que no sea exactamente "GL"
        const esPrimaria = unidadUpper === 'GL';
        console.log(`Producto ${productCode}: unidad="${unidadUpper}", primaria=${esPrimaria}`);
        return esPrimaria;
      };

      // Generar líneas según especificaciones (solo campos 1-6 obligatorios)
      // 1. Código del producto (max 20 chars, alfanumérico)
      // 2. cantidad udad 1 (max 10 chars, numérico) - cantidad si es unidad primaria
      // 3. cantidad udad 2 (max 10 chars, numérico) - cantidad si es unidad secundaria
      // 4. Unidad de transaccion (1=ud1 primaria, 2=ud2 secundaria)
      // 5. Bodega de Destino (max 3 chars, alfanumérico)
      // 6. Precio del articulo (max 10 chars, numérico con punto decimal)
      const lines = quoteWithItems.items.map(item => {
        // Campo 1: Código del producto (max 20 chars)
        const codigoRaw = item.type === 'custom' ? (item.customSku || '') : (item.productCode || '');
        const codigo = codigoRaw.substring(0, 20);
        
        // Determinar si es unidad primaria o secundaria
        const esPrimaria = item.type === 'custom' ? true : isPrimaryUnit(item.productCode || '');
        
        // Campo 2: cantidad udad 1 (si es unidad primaria)
        const cantidadUd1 = esPrimaria ? String(item.quantity || 0).substring(0, 10) : '0';
        
        // Campo 3: cantidad udad 2 (si es unidad secundaria)
        const cantidadUd2 = esPrimaria ? '0' : String(item.quantity || 0).substring(0, 10);
        
        // Campo 4: Unidad de transaccion (1=primaria, 2=secundaria)
        const unidadTransaccion = esPrimaria ? '1' : '2';
        
        // Campo 5: Bodega de Destino (max 3 chars) - vacío, se usará bodega actual
        const bodegaDestino = '';
        
        // Campo 6: Precio del articulo (max 10 chars, usar punto como decimal)
        const precio = String(item.unitPrice || 0).substring(0, 10);
        
        // Solo campos 1-6 obligatorios (separados por punto y coma)
        return `${codigo};${cantidadUd1};${cantidadUd2};${unidadTransaccion};${bodegaDestino};${precio}`;
      });

      // Máximo 13 líneas por documento
      const MAX_LINES_PER_FILE = 13;
      const totalChunks = Math.ceil(lines.length / MAX_LINES_PER_FILE);
      
      // Generar nombre base del archivo
      const cleanName = quoteWithItems.clientName
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9\s]/g, "")
        .replace(/\s+/g, "")
        .substring(0, 30);
      
      const date = new Date(quoteWithItems.createdAt);
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = String(date.getFullYear()).slice(-2);
      
      const baseFilename = `${cleanName}-${day}${month}${year}-${quoteWithItems.quoteNumber}`;
      
      if (totalChunks === 1) {
        // Solo un archivo
        const fileContent = lines.join('\n');
        const blob = new Blob([fileContent], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const filename = `${baseFilename}.txt`;
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        toast({
          title: "Archivo descargado",
          description: `El archivo ${filename} se ha descargado correctamente (${lines.length} líneas).`,
        });
      } else {
        // Múltiples archivos - descargar cada uno
        const downloadedFiles: string[] = [];
        
        for (let i = 0; i < totalChunks; i++) {
          const startIdx = i * MAX_LINES_PER_FILE;
          const endIdx = Math.min((i + 1) * MAX_LINES_PER_FILE, lines.length);
          const chunkLines = lines.slice(startIdx, endIdx);
          const fileContent = chunkLines.join('\n');
          
          const blob = new Blob([fileContent], { type: 'text/plain;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          const partNum = i + 1;
          const filename = `${baseFilename}_parte${partNum}.txt`;
          
          // Pequeño delay entre descargas para que el navegador las procese
          await new Promise(resolve => setTimeout(resolve, 300));
          
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          
          downloadedFiles.push(filename);
        }

        toast({
          title: "Archivos descargados",
          description: `Se descargaron ${totalChunks} archivos (${lines.length} líneas totales, máx. 13 por archivo).`,
        });
      }
    } catch (error) {
      console.error("Error generating file:", error);
      toast({
        title: "Error",
        description: "No se pudo generar el archivo de importación.",
        variant: "destructive",
      });
    }
  };

  const handleCopySku = async (sku: string) => {
    try {
      await navigator.clipboard.writeText(sku);
      setCopiedSku(sku);
      
      // Reset the copied state after 2 seconds
      setTimeout(() => {
        setCopiedSku(null);
      }, 2000);
    } catch (error) {
      console.error("Error copying SKU:", error);
    }
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
          <p className="text-gray-600">Presupuestos enviados y gestionados</p>
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
              <CardTitle className="text-sm font-medium">Filtro Activo</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                  Recepción
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Vendedor</label>
                <Select value={selectedVendor} onValueChange={setSelectedVendor}>
                  <SelectTrigger data-testid="select-vendor-filter">
                    <SelectValue placeholder="Todos los vendedores" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los vendedores</SelectItem>
                    {uniqueVendors.map((vendor) => (
                      <SelectItem key={vendor || 'unknown'} value={vendor || 'unknown'}>
                        {vendor}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Cliente</label>
                <Select value={selectedClient} onValueChange={setSelectedClient}>
                  <SelectTrigger data-testid="select-client-filter">
                    <SelectValue placeholder="Todos los clientes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los clientes</SelectItem>
                    {uniqueClients.map((client) => (
                      <SelectItem key={client} value={client}>
                        {client}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quotes List */}
        <Card>
          <CardHeader>
            <CardTitle>Presupuestos</CardTitle>
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
              <div className="space-y-4">
                {sentQuotes.map((quote) => (
                  <div
                    key={quote.id}
                    className="group border rounded-xl p-5 hover:shadow-md transition-all duration-200 cursor-pointer bg-white hover:border-blue-300"
                    onClick={() => handleViewQuote(quote.id)}
                    data-testid={`quote-${quote.id}`}
                  >
                    {/* Header - Quote Number and Status */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <h3 className="text-lg font-bold text-gray-900">
                          Presupuesto #{quote.quoteNumber}
                        </h3>
                        {getStatusBadge(quote.status)}
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-gray-900">
                          {formatCurrency(Number(quote.total || 0))}
                        </div>
                        <div className="text-sm text-gray-500">
                          Subtotal: {formatCurrency(Number(quote.subtotal || 0))}
                        </div>
                      </div>
                    </div>

                    {/* Info Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                      <div className="flex flex-col">
                        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Cliente</span>
                        <span className="text-sm font-medium text-gray-900">{quote.clientName}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Fecha</span>
                        <span className="text-sm font-medium text-gray-900">{formatDate(quote.createdAt)}</span>
                      </div>
                      {quote.creatorName && (
                        <div className="flex flex-col">
                          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Enviado por</span>
                          <span className="text-sm font-medium text-gray-900">{quote.creatorName}</span>
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewQuote(quote.id);
                        }}
                        className="flex items-center gap-2 hover:bg-blue-50 hover:border-blue-300"
                        data-testid={`button-view-quote-${quote.id}`}
                      >
                        <Eye className="h-4 w-4" />
                        <span>Ver</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async (e) => {
                          e.stopPropagation();
                          const quoteWithItems = await queryClient.fetchQuery({
                            queryKey: ["/api/quotes", quote.id, "with-items"],
                          });
                          handleDownloadPDF(quoteWithItems);
                        }}
                        className="flex items-center gap-2 hover:bg-green-50 hover:border-green-300"
                        data-testid={`button-download-pdf-${quote.id}`}
                      >
                        <Download className="h-4 w-4" />
                        <span>PDF</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownloadRandomFile(quote);
                        }}
                        className="flex items-center gap-2 hover:bg-purple-50 hover:border-purple-300"
                        data-testid={`button-download-random-${quote.id}`}
                      >
                        <FileDown className="h-4 w-4" />
                        <span>Archivo</span>
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
                              <div className="flex items-center gap-2">
                                <span>{item.type === 'custom' ? item.customSku : item.productCode}</span>
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleCopySku(item.type === 'custom' ? item.customSku || '' : item.productCode || '');
                                  }}
                                  type="button"
                                  className="p-1 hover:bg-gray-100 rounded transition-colors"
                                  title="Copiar SKU"
                                  data-testid={`button-copy-sku-${item.id}`}
                                >
                                  {copiedSku === (item.type === 'custom' ? item.customSku : item.productCode) ? (
                                    <Check className="h-3.5 w-3.5 text-green-600" />
                                  ) : (
                                    <Copy className="h-3.5 w-3.5 text-gray-500" />
                                  )}
                                </button>
                              </div>
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

                {/* Download Buttons */}
                <div className="border-t pt-6 flex gap-3 justify-between">
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={() => handleDownloadPDF(selectedQuote)}
                      data-testid="button-modal-download-pdf"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Descargar PDF
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleDownloadRandomFile(selectedQuote)}
                      data-testid="button-modal-download-random"
                    >
                      <FileDown className="h-4 w-4 mr-2" />
                      Archivo Random
                    </Button>
                  </div>

                  {/* Action Buttons - Only show for sent quotes */}
                  {selectedQuote.status === 'sent' && (
                    <div className="flex gap-3">
                      <Button
                        variant="outline"
                        onClick={handleReject}
                        disabled={updateStatusMutation.isPending}
                        className="border-red-300 text-red-700 hover:bg-red-50"
                        data-testid="button-reject-quote"
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        {updateStatusMutation.isPending ? "Procesando..." : "Rechazar"}
                      </Button>
                      <Button
                        onClick={handleConvertToOrder}
                        disabled={updateStatusMutation.isPending}
                        className="bg-green-600 hover:bg-green-700"
                        data-testid="button-convert-quote"
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        {updateStatusMutation.isPending ? "Procesando..." : "Convertir a Pedido"}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
