import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Search, ShoppingCart, User, MapPin, Phone, Plus, Minus, Trash2, FileText, Calculator, X, Package } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Client, Order, PriceList, Quote } from "@shared/schema";

// Types for price tiers and cart management
type PriceTier = 'lista' | 'desc10' | 'desc10_5' | 'desc10_5_3' | 'minimo' | 'canalDigital';

interface PriceTierOption {
  key: PriceTier;
  label: string;
  price: number;
}

interface CartItem {
  id: string;
  type: "standard" | "custom";
  productName: string;
  productCode?: string;
  customSku?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  priceTier?: PriceTier; // Price tier selected for standard products
  tierPrices?: PriceTierOption[]; // Available price tiers stored with item
  costOfProduction?: number;
  profitMargin?: number;
  pricingMode?: "calculated" | "direct";
}

interface QuoteFormData {
  clientName: string;
  clientId?: string;
  clientRut?: string;
  clientEmail?: string;
  clientPhone?: string;
  clientAddress?: string;
  validUntil?: string;
  notes?: string;
}

interface CustomProductData {
  productName: string;
  sku: string;
  pricingMode: "calculated" | "direct";
  costOfProduction: number;
  profitMargin: number;
  directPrice: number;
  quantity: number;
}

const INITIAL_QUOTE_FORM: QuoteFormData = {
  clientName: "",
  clientId: undefined,
  clientRut: "",
  clientEmail: "",
  clientPhone: "",
  clientAddress: "",
  validUntil: "",
  notes: "",
};

const INITIAL_CUSTOM_PRODUCT: CustomProductData = {
  productName: "",
  sku: "",
  pricingMode: "calculated",
  costOfProduction: 0,
  profitMargin: 55,
  directPrice: 0,
  quantity: 1,
};

export default function TomadorPedidos() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showQuoteBuilder, setShowQuoteBuilder] = useState(false);
  const [selectedClientForQuote, setSelectedClientForQuote] = useState<Client | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [quoteForm, setQuoteForm] = useState<QuoteFormData>(INITIAL_QUOTE_FORM);
  const [productSearchTerm, setProductSearchTerm] = useState("");
  const [selectedUnidad, setSelectedUnidad] = useState<string>("");
  const [selectedTiers, setSelectedTiers] = useState<Record<string, PriceTier>>({});
  const { toast } = useToast();
  const [showCustomProductModal, setShowCustomProductModal] = useState(false);
  const [customProduct, setCustomProduct] = useState<CustomProductData>(INITIAL_CUSTOM_PRODUCT);
  
  const computedCustomUnitPrice = customProduct.pricingMode === 'calculated'
    ? Math.round(customProduct.costOfProduction * (1 + customProduct.profitMargin / 100))
    : customProduct.directPrice;
  
  const addCustomProductToCart = () => {
    if (!customProduct.productName.trim() || customProduct.quantity <= 0) {
      toast({ title: 'Datos incompletos', description: 'Completa nombre y cantidad', variant: 'destructive' });
      return;
    }
    const unitPrice = computedCustomUnitPrice;
    const newItem: CartItem = {
      id: `custom-${Date.now()}`,
      type: 'custom',
      productName: customProduct.productName,
      customSku: customProduct.sku || undefined,
      quantity: customProduct.quantity,
      unitPrice,
      totalPrice: unitPrice * customProduct.quantity,
      costOfProduction: customProduct.pricingMode === 'calculated' ? customProduct.costOfProduction : undefined,
      profitMargin: customProduct.pricingMode === 'calculated' ? customProduct.profitMargin : undefined,
      pricingMode: customProduct.pricingMode,
    };
    setCart(prev => [...prev, newItem]);
    setShowCustomProductModal(false);
    setCustomProduct(INITIAL_CUSTOM_PRODUCT);
    toast({ title: 'Producto personalizado agregado' });
  };

  // Fetch available units for filtering
  const { data: availableUnits = [] } = useQuery({
    queryKey: ["/api/price-list/units"],
    queryFn: async () => {
      const response = await fetch('/api/price-list/units', { credentials: 'include' });
      if (!response.ok) {
        throw new Error('Failed to fetch units');
      }
      return response.json() as string[];
    },
  });

  // Fetch products for quote builder
  const { data: priceListResponse, isLoading: priceListLoading } = useQuery({
    queryKey: ["/api/price-list", { search: productSearchTerm, unidad: selectedUnidad, limit: 50 }],
    queryFn: async () => {
      const params = new URLSearchParams({ search: productSearchTerm, limit: "50" });
      if (selectedUnidad) {
        params.set("unidad", selectedUnidad);
      }
      const response = await fetch(`/api/price-list?${params}`, { credentials: 'include' });
      if (!response.ok) {
        throw new Error('Failed to fetch products');
      }
      return response.json();
    },
    enabled: productSearchTerm.length >= 2,
  });
  
  // Extract the items array from the response
  const priceList = priceListResponse?.items || [];

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

  // Create quote mutation
  const createQuoteMutation = useMutation<Quote, Error, any>({
    mutationFn: async (quoteData) => {
      const response = await apiRequest('/api/quotes', {
        method: 'POST',
        data: quoteData
      });
      return response.json();
    },
    onSuccess: (newQuote: Quote) => {
      toast({
        title: "¡Presupuesto creado exitosamente!",
        description: `Presupuesto ${newQuote.quoteNumber} creado para ${newQuote.clientName}`,
      });
      resetQuoteBuilder();
    },
    onError: (error: any) => {
      toast({
        title: "Error al crear presupuesto",
        description: error.message || "Ocurrió un error inesperado",
        variant: "destructive",
      });
    },
  });

  const handleCreateOrder = (client: Client) => {
    // Open quote builder to add products first before creating order
    setSelectedClientForQuote(client);
    setQuoteForm({
      clientName: client.nokoen,
      clientRut: client.rten || '',
      clientEmail: client.emen || '',
      clientPhone: client.foen || '',
      clientAddress: client.dien || '',
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days from now
      notes: `Pedido para cliente: ${client.nokoen}`,
    });
    setCart([]);
    setShowQuoteBuilder(true);
  };

  // Open quote builder for existing client
  const handleCreateQuoteForClient = (client: Client) => {
    setSelectedClientForQuote(client);
    setQuoteForm({
      ...INITIAL_QUOTE_FORM,
      clientName: client.glosa || client.nokoen,
      clientId: client.id,
      clientRut: client.nokoen,
      clientEmail: client.email || "",
      clientPhone: client.telefono || "",
      clientAddress: `${client.direccion || ""} ${client.comuna || ""}`.trim(),
    });
    setShowQuoteBuilder(true);
  };

  // Open quote builder for new client
  const handleCreateQuoteForNewClient = () => {
    setSelectedClientForQuote(null);
    setQuoteForm(INITIAL_QUOTE_FORM);
    setCart([]);
    setProductSearchTerm("");
    setShowQuoteBuilder(true);
  };

  // Reset quote builder
  const resetQuoteBuilder = () => {
    setShowQuoteBuilder(false);
    setSelectedClientForQuote(null);
    setQuoteForm(INITIAL_QUOTE_FORM);
    setCart([]);
    setProductSearchTerm("");
  };

  // Add product to cart with selected price tier
  const addProductToCart = (product: PriceList, selectedTier: PriceTier = 'lista') => {
    // Get price based on selected tier
    const getTierPrice = (product: PriceList, tier: PriceTier): number => {
      const tierFields = {
        lista: product.lista,
        desc10: product.desc10,
        desc10_5: product.desc10_5,
        desc10_5_3: product.desc10_5_3,
        minimo: product.minimo,
        canalDigital: product.canalDigital,
      };
      return parseFloat(tierFields[tier]?.toString() || product.lista?.toString() || "0");
    };

    const price = getTierPrice(product, selectedTier);
    
    const existingItem = cart.find(item => 
      item.type === "standard" && 
      item.productCode === product.codigo && 
      item.priceTier === selectedTier
    );

    if (existingItem) {
      updateCartItemQuantity(existingItem.id, existingItem.quantity + 1);
      toast({
        title: "Producto actualizado",
        description: `Se aumentó la cantidad de ${product.producto}`,
      });
    } else {
      const availableTiers = getAvailableTiers(product);
      const newItem: CartItem = {
        id: `item-${Date.now()}-${Math.random()}`,
        type: "standard",
        productName: product.producto || "Producto sin nombre",
        productCode: product.codigo,
        quantity: 1,
        unitPrice: price,
        totalPrice: price,
        priceTier: selectedTier,
        tierPrices: availableTiers,
      };
      
      setCart(prev => [...prev, newItem]);
      toast({
        title: "Producto agregado",
        description: `${product.producto} agregado al presupuesto`,
      });
    }
  };

  // Update cart item quantity
  const updateCartItemQuantity = (itemId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeFromCart(itemId);
      return;
    }

    setCart(prev => prev.map(item => 
      item.id === itemId 
        ? { ...item, quantity: newQuantity, totalPrice: item.unitPrice * newQuantity }
        : item
    ));
  };

  // Update cart item price tier
  const updateCartItemPriceTier = (itemId: string, newTier: PriceTier) => {
    setCart(prev => prev.map(item => {
      if (item.id === itemId && item.type === "standard" && item.tierPrices) {
        // Use stored tier prices instead of searching current product list
        const tierOption = item.tierPrices.find(tier => tier.key === newTier);
        if (!tierOption) {
          console.warn(`Tier ${newTier} not found in stored prices for item ${itemId}`);
          return item;
        }

        const newUnitPrice = tierOption.price;
        return {
          ...item,
          priceTier: newTier,
          unitPrice: newUnitPrice,
          totalPrice: newUnitPrice * item.quantity
        };
      }
      return item;
    }));
    
    toast({
      title: "Precio actualizado",
      description: `Se cambió el precio del producto`,
    });
  };

  // Remove item from cart
  const removeFromCart = (itemId: string) => {
    setCart(prev => prev.filter(item => item.id !== itemId));
    toast({
      title: "Producto eliminado",
      description: "Producto eliminado del presupuesto",
    });
  };

  // Save quote
  const saveQuote = async () => {
    if (!quoteForm.clientName.trim()) {
      toast({
        title: "Error",
        description: "Debe especificar un nombre de cliente",
        variant: "destructive",
      });
      return;
    }

    if (cart.length === 0) {
      toast({
        title: "Error", 
        description: "Debe agregar al menos un producto",
        variant: "destructive",
      });
      return;
    }

    try {
      // Calculate totals
      const subtotal = cart.reduce((sum, item) => sum + item.totalPrice, 0);
      const tax = subtotal * 0.19; // 19% IVA
      const total = subtotal + tax;
      
      // Create quote
      const quoteData = {
        ...quoteForm,
        total: total.toString(),
        status: "draft" as const,
      };

      const response = await apiRequest('/api/quotes', {
        method: 'POST',
        data: quoteData
      });
      const quote: Quote = await response.json();

      // Add quote items
      for (const item of cart) {
        const itemData = {
          quoteId: quote.id,
          type: item.type,
          productName: item.productName,
          productCode: item.productCode,
          customSku: item.customSku,
          quantity: item.quantity.toString(),
          unitPrice: item.unitPrice.toString(),
          totalPrice: item.totalPrice.toString(),
          costOfProduction: item.costOfProduction?.toString(),
          profitMargin: item.profitMargin?.toString(),
          pricingMode: item.pricingMode,
        };

        const itemResponse = await apiRequest(`/api/quotes/${quote.id}/items`, {
          method: 'POST',
          data: itemData
        });

        if (!itemResponse.ok) {
          console.error('Failed to add quote item:', await itemResponse.text());
        }
      }

      toast({
        title: "Presupuesto guardado",
        description: `Presupuesto ${quote.quoteNumber} creado exitosamente`,
      });

      resetQuoteBuilder();

    } catch (error) {
      console.error('Error saving quote:', error);
      toast({
        title: "Error",
        description: "Error al guardar el presupuesto",
        variant: "destructive",
      });
    }
  };

  const formatCurrency = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined) return "N/A";
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP'
    }).format(amount);
  };

  // Helper function to get available price tiers for a product
  const getAvailableTiers = (product: PriceList): PriceTierOption[] => {
    const tiers: PriceTierOption[] = [];
    
    const tierMappings = [
      { key: 'lista' as PriceTier, label: 'Lista', field: product.lista },
      { key: 'desc10' as PriceTier, label: '10%', field: product.desc10 },
      { key: 'desc10_5' as PriceTier, label: '10%+5%', field: product.desc10_5 },
      { key: 'desc10_5_3' as PriceTier, label: '10%+5%+3%', field: product.desc10_5_3 },
      { key: 'minimo' as PriceTier, label: 'Mínimo', field: product.minimo },
      { key: 'canalDigital' as PriceTier, label: 'Digital', field: product.canalDigital },
    ];
    
    for (const tier of tierMappings) {
      const price = parseFloat(tier.field?.toString() || '0');
      if (price > 0) {
        tiers.push({
          key: tier.key,
          label: tier.label,
          price: price,
        });
      }
    }
    
    return tiers;
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

  // Calculate totals
  const subtotal = cart.reduce((sum, item) => sum + item.totalPrice, 0);
  const tax = subtotal * 0.19; // 19% IVA
  const total = subtotal + tax;

  return (
    <>
    <div className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 lg:py-6 m-3 sm:m-4">
      <div className="space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
                Tomador de Pedidos
              </h1>
              <p className="text-muted-foreground">
                Busca clientes y crea pedidos de manera rápida y eficiente
              </p>
            </div>
            <Button
              onClick={handleCreateQuoteForNewClient}
              className="flex items-center gap-2"
              size="lg"
              data-testid="button-create-quote-new-client"
            >
              <Calculator className="w-5 h-5" />
              Crear Presupuesto
            </Button>
          </div>
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
                        <div className="flex items-center gap-2 ml-4">
                          <Button
                            variant="outline"
                            data-testid={`button-create-quote-${client.id}`}
                            onClick={() => handleCreateQuoteForClient(client)}
                            className="flex items-center gap-2"
                          >
                            <Calculator className="w-4 h-4" />
                            Presupuesto
                          </Button>
                          <Button
                            data-testid={`button-create-order-${client.id}`}
                            onClick={() => handleCreateOrder(client)}
                            disabled={createOrderMutation.isPending}
                            className="flex items-center gap-2"
                          >
                            <ShoppingCart className="w-4 h-4" />
                            {createOrderMutation.isPending ? "Creando..." : "Crear Pedido"}
                          </Button>
                        </div>
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

    {/* Quote Builder Modal */}
    <Dialog open={showQuoteBuilder} onOpenChange={setShowQuoteBuilder}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden p-0">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Calculator className="w-6 h-6" />
              Constructor de Presupuesto
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={resetQuoteBuilder}
              data-testid="button-close-quote-builder"
            >
              <X className="w-4 h-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex h-[calc(90vh-100px)]">
          {/* Left Side - Product Search and Client Info */}
          <div className="flex-1 p-6 overflow-y-auto border-r">
            <div className="space-y-6">
              {/* Client Info Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Información del Cliente</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="modal-client-name">Nombre del Cliente *</Label>
                      <Input
                        id="modal-client-name"
                        value={quoteForm.clientName}
                        onChange={(e) => setQuoteForm(prev => ({ ...prev, clientName: e.target.value }))}
                        data-testid="modal-input-client-name"
                        placeholder="Nombre completo del cliente"
                      />
                    </div>
                    <div>
                      <Label htmlFor="modal-client-rut">RUT</Label>
                      <Input
                        id="modal-client-rut"
                        value={quoteForm.clientRut}
                        onChange={(e) => setQuoteForm(prev => ({ ...prev, clientRut: e.target.value }))}
                        data-testid="modal-input-client-rut"
                        placeholder="12345678-9"
                      />
                    </div>
                    <div>
                      <Label htmlFor="modal-client-email">Email</Label>
                      <Input
                        id="modal-client-email"
                        type="email"
                        value={quoteForm.clientEmail}
                        onChange={(e) => setQuoteForm(prev => ({ ...prev, clientEmail: e.target.value }))}
                        data-testid="modal-input-client-email"
                        placeholder="cliente@email.com"
                      />
                    </div>
                    <div>
                      <Label htmlFor="modal-client-phone">Teléfono</Label>
                      <Input
                        id="modal-client-phone"
                        value={quoteForm.clientPhone}
                        onChange={(e) => setQuoteForm(prev => ({ ...prev, clientPhone: e.target.value }))}
                        data-testid="modal-input-client-phone"
                        placeholder="+56 9 1234 5678"
                      />
                    </div>
                    <div className="col-span-2">
                      <Label htmlFor="modal-client-address">Dirección</Label>
                      <Input
                        id="modal-client-address"
                        value={quoteForm.clientAddress}
                        onChange={(e) => setQuoteForm(prev => ({ ...prev, clientAddress: e.target.value }))}
                        data-testid="modal-input-client-address"
                        placeholder="Dirección completa"
                      />
                    </div>
                    <div>
                      <Label htmlFor="modal-valid-until">Válido hasta</Label>
                      <Input
                        id="modal-valid-until"
                        type="date"
                        value={quoteForm.validUntil}
                        onChange={(e) => setQuoteForm(prev => ({ ...prev, validUntil: e.target.value }))}
                        data-testid="modal-input-valid-until"
                      />
                    </div>
                    <div>
                      <Label htmlFor="modal-notes">Notas</Label>
                      <Textarea
                        id="modal-notes"
                        rows={2}
                        value={quoteForm.notes}
                        onChange={(e) => setQuoteForm(prev => ({ ...prev, notes: e.target.value }))}
                        data-testid="modal-textarea-notes"
                        placeholder="Condiciones especiales, términos, etc."
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Product Search Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Search className="w-5 h-5" />
                    Buscar Productos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="modal-product-search">Buscar producto por código o descripción</Label>
                        <Input
                          id="modal-product-search"
                          type="text"
                          placeholder="Ej: ESMALTE, E001, pintura..."
                          value={productSearchTerm}
                          onChange={(e) => setProductSearchTerm(e.target.value)}
                          data-testid="modal-input-product-search"
                        />
                      </div>
                      <div>
                        <Label htmlFor="modal-unit-filter">Filtrar por tipo de envase (unidad)</Label>
                        <Select
                          value={selectedUnidad}
                          onValueChange={setSelectedUnidad}
                        >
                          <SelectTrigger data-testid="modal-select-unit-filter">
                            <SelectValue placeholder="Todos los envases" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">Todos los envases</SelectItem>
                            {availableUnits.map((unit) => (
                              <SelectItem key={unit} value={unit}>
                                {unit}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {productSearchTerm.length >= 2 && (
                      <div className="space-y-2 max-h-96 overflow-y-auto border rounded-lg">
                        {priceListLoading ? (
                          <div className="text-center py-4">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
                            <p className="text-sm text-muted-foreground mt-2">Buscando productos...</p>
                          </div>
                        ) : priceList.length === 0 ? (
                          <div className="text-center py-4">
                            <p className="text-muted-foreground">No se encontraron productos</p>
                          </div>
                        ) : (
                          priceList.map((product) => {
                            const availableTiers = getAvailableTiers(product);
                            const selectedTier = selectedTiers[product.codigo] || 'lista';
                            const selectedPrice = availableTiers.find(tier => tier.key === selectedTier)?.price || 0;
                            
                            return (
                              <div
                                key={product.id}
                                className="border-b p-3 hover:bg-muted/50 cursor-pointer transition-colors"
                                onClick={() => addProductToCart(product, selectedTier)}
                                data-testid={`modal-product-${product.codigo}`}
                              >
                                <div className="flex justify-between items-start">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      <Badge variant="secondary" className="text-xs">
                                        {product.codigo}
                                      </Badge>
                                    </div>
                                    <h4 className="font-medium text-sm mb-1">
                                      {product.producto}
                                    </h4>
                                    <p className="text-xs text-muted-foreground">
                                      Unidad: {product.unidad || "N/A"}
                                    </p>
                                  </div>
                                  <div className="text-right flex-1">
                                    <div className="space-y-2">
                                      <div className="text-xs text-muted-foreground">Precios disponibles:</div>
                                      <Select
                                        value={selectedTier}
                                        onValueChange={(newTier) => {
                                          setSelectedTiers(prev => ({
                                            ...prev,
                                            [product.codigo]: newTier as PriceTier
                                          }));
                                        }}
                                      >
                                        <SelectTrigger className="w-full text-xs" data-testid={`select-price-${product.codigo}`}>
                                          <SelectValue placeholder="Seleccionar precio" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {availableTiers.map((tier) => (
                                            <SelectItem key={tier.key} value={tier.key}>
                                              {tier.label}: {formatCurrency(tier.price)}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                      <div className="text-right">
                                        <p className="font-bold text-green-600 text-lg">
                                          {formatCurrency(selectedPrice)}
                                        </p>
                                      </div>
                                      <Button 
                                        size="sm" 
                                        className="mt-1"
                                        onClick={() => addProductToCart(product, selectedTier)}
                                        data-testid={`button-add-${product.codigo}`}
                                      >
                                        <Plus className="w-3 h-3" />
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}

                    {/* Add Custom Product Button */}
                    <Separator />
                    <Button
                      variant="outline"
                      size="lg"
                      onClick={() => setShowCustomProductModal(true)}
                      className="w-full border-dashed border-2 border-blue-300 text-blue-600 hover:bg-blue-50"
                      data-testid="modal-button-custom-product"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Agregar Producto Personalizado
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Right Side - Cart and Summary */}
          <div className="w-96 p-6 bg-muted/30">
            <div className="space-y-6">
              {/* Cart Header */}
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5" />
                  Carrito ({cart.length})
                </h3>
                {cart.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCart([])}
                    data-testid="modal-button-clear-cart"
                  >
                    Limpiar
                  </Button>
                )}
              </div>

              {/* Cart Items */}
              {cart.length === 0 ? (
                <div className="text-center py-8">
                  <ShoppingCart className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">No hay productos en el carrito</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {cart.map((item) => (
                    <div
                      key={item.id}
                      className="bg-background border rounded-lg p-3"
                      data-testid={`modal-cart-item-${item.id}`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <h4 className="font-medium text-sm">{item.productName}</h4>
                          {item.productCode && (
                            <Badge variant="secondary" className="text-xs mt-1">
                              {item.productCode}
                            </Badge>
                          )}
                          {item.type === "standard" && item.tierPrices && (() => {
                            // Use stored tier prices instead of searching current product list
                            const availableTiers = item.tierPrices;
                            if (availableTiers.length <= 1) return null;
                            
                            return (
                              <div className="mt-2">
                                <label className="text-xs text-muted-foreground">Precio:</label>
                                <Select
                                  value={item.priceTier || 'lista'}
                                  onValueChange={(newTier) => updateCartItemPriceTier(item.id, newTier as PriceTier)}
                                >
                                  <SelectTrigger className="h-6 text-xs mt-1" data-testid={`select-tier-${item.id}`}>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {availableTiers.map((tier) => (
                                      <SelectItem key={tier.key} value={tier.key}>
                                        {tier.label}: {formatCurrency(tier.price)}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            );
                          })()}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFromCart(item.id)}
                          data-testid={`modal-button-remove-${item.id}`}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => updateCartItemQuantity(item.id, item.quantity - 1)}
                            data-testid={`modal-button-decrease-${item.id}`}
                          >
                            <Minus className="w-3 h-3" />
                          </Button>
                          <span className="w-8 text-center text-sm font-medium">
                            {item.quantity}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => updateCartItemQuantity(item.id, item.quantity + 1)}
                            data-testid={`modal-button-increase-${item.id}`}
                          >
                            <Plus className="w-3 h-3" />
                          </Button>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">
                            {formatCurrency(item.unitPrice)} c/u
                          </p>
                          <p className="font-medium text-green-600">
                            {formatCurrency(item.totalPrice)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Summary */}
              {cart.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Subtotal:</span>
                      <span data-testid="modal-text-subtotal">{formatCurrency(subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>IVA (19%):</span>
                      <span data-testid="modal-text-tax">{formatCurrency(tax)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between font-bold text-lg">
                      <span>Total:</span>
                      <span className="text-green-600" data-testid="modal-text-total">
                        {formatCurrency(total)}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      data-testid="modal-button-download-pdf"
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      Descargar PDF
                    </Button>
                    <Button
                      onClick={saveQuote}
                      className="flex-1"
                      disabled={!quoteForm.clientName || cart.length === 0}
                      data-testid="modal-button-save-quote"
                    >
                      Guardar
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    {/* Custom Product Modal */}
    <Dialog open={showCustomProductModal} onOpenChange={setShowCustomProductModal}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            Producto Personalizado
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="custom-product-name">Nombre del Producto *</Label>
              <Input
                id="custom-product-name"
                value={customProduct.productName}
                onChange={(e) => setCustomProduct(p => ({ ...p, productName: e.target.value }))}
                data-testid="input-custom-name"
                placeholder="Ej: PRODUCTO ESPECIAL"
              />
            </div>
            <div>
              <Label htmlFor="custom-product-sku">SKU (Opcional)</Label>
              <Input
                id="custom-product-sku"
                value={customProduct.sku}
                onChange={(e) => setCustomProduct(p => ({ ...p, sku: e.target.value }))}
                data-testid="input-custom-sku"
                placeholder="Ej: PROD-001"
              />
            </div>
          </div>

          <Tabs 
            value={customProduct.pricingMode} 
            onValueChange={(v) => setCustomProduct(p => ({ ...p, pricingMode: v as 'calculated' | 'direct' }))}
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="calculated">Cálculo (Costo + Utilidad)</TabsTrigger>
              <TabsTrigger value="direct">Precio Directo</TabsTrigger>
            </TabsList>

            <TabsContent value="calculated" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="custom-cost">Costo de Producción</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">$</span>
                    <Input
                      id="custom-cost"
                      type="number"
                      className="pl-8"
                      value={customProduct.costOfProduction || ""}
                      onChange={(e) => setCustomProduct(p => ({ ...p, costOfProduction: Number(e.target.value) || 0 }))}
                      data-testid="input-custom-cost"
                      placeholder="0"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="custom-margin">Porcentaje de Utilidad</Label>
                  <div className="relative">
                    <Input
                      id="custom-margin"
                      type="number"
                      className="pr-8"
                      value={customProduct.profitMargin || ""}
                      onChange={(e) => setCustomProduct(p => ({ ...p, profitMargin: Number(e.target.value) || 0 }))}
                      data-testid="input-custom-margin"
                      placeholder="55"
                    />
                    <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">%</span>
                  </div>
                </div>
              </div>
              <div>
                <Label htmlFor="custom-quantity">Cantidad</Label>
                <Input
                  id="custom-quantity"
                  type="number"
                  value={customProduct.quantity || ""}
                  onChange={(e) => setCustomProduct(p => ({ ...p, quantity: Number(e.target.value) || 1 }))}
                  data-testid="input-custom-quantity"
                  placeholder="1"
                />
              </div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <div className="font-semibold text-green-600">
                  {formatCurrency(computedCustomUnitPrice)}
                </div>
                <div className="text-sm text-green-600">
                  {customProduct.profitMargin}% de utilidad
                </div>
              </div>
            </TabsContent>

            <TabsContent value="direct" className="space-y-4">
              <div>
                <Label htmlFor="custom-direct-price">Precio Final</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    id="custom-direct-price"
                    type="number"
                    className="pl-8"
                    value={customProduct.directPrice || ""}
                    onChange={(e) => setCustomProduct(p => ({ ...p, directPrice: Number(e.target.value) || 0 }))}
                    data-testid="input-custom-direct"
                    placeholder="0"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="custom-quantity-direct">Cantidad</Label>
                <Input
                  id="custom-quantity-direct"
                  type="number"
                  value={customProduct.quantity || ""}
                  onChange={(e) => setCustomProduct(p => ({ ...p, quantity: Number(e.target.value) || 1 }))}
                  data-testid="input-custom-quantity-direct"
                  placeholder="1"
                />
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-2 pt-4">
            <Button 
              variant="outline" 
              onClick={() => setShowCustomProductModal(false)}
              data-testid="button-cancel-custom"
            >
              Cancelar
            </Button>
            <Button 
              onClick={addCustomProductToCart}
              disabled={!customProduct.productName.trim() || customProduct.quantity <= 0}
              className="bg-orange-500 hover:bg-orange-600"
              data-testid="button-add-custom-to-cart"
            >
              <Plus className="w-4 h-4 mr-2" />
              Añadir al Presupuesto
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}