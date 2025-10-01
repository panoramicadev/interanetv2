import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
//import panoramicaLogoPath from "@assets/Diseño sin título (27)_1757959070748.png"; // Commented due to special chars in filename"
import QuotesList from "@/components/order-taker/quotes-list";
import OrdersList from "@/components/order-taker/orders-list";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Search, ShoppingCart, User, MapPin, Phone, Plus, Minus, Trash2, FileText, Calculator, X, Package, Eye, MoreHorizontal, Edit, Mail, Download } from "lucide-react";
import { Link, useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { nanoid } from "nanoid";
import { Client, Order, PriceList, Quote } from "@shared/schema";
import html2pdf from "html2pdf.js";
// HTML/CSS PDF generator - replaces jsPDF for exact specification compliance

// Validation schema for edit order form
const editOrderSchema = z.object({
  clientName: z.string().min(1, "El nombre del cliente es requerido"),
  status: z.enum(['draft', 'pending', 'confirmed', 'cancelled']).default('draft'),
  notes: z.string().optional(),
});

type EditOrderFormData = z.infer<typeof editOrderSchema>;

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
  productUnit?: string; // Store the actual unit from price list data
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

// Edit Order Form Component
interface EditOrderFormProps {
  order: Order;
  onClose: () => void;
}

function EditOrderForm({ order, onClose }: EditOrderFormProps) {
  const { toast } = useToast();
  
  const form = useForm<EditOrderFormData>({
    resolver: zodResolver(editOrderSchema),
    defaultValues: {
      clientName: order.clientName || '',
      status: (order.status as EditOrderFormData['status']) || 'draft',
      notes: order.notes || '',
    },
  });

  const updateOrderMutation = useMutation({
    mutationFn: async (data: EditOrderFormData) => {
      return await apiRequest(`/api/orders/${order.id}`, {
        method: 'PATCH',
        data: {
          clientName: data.clientName,
          status: data.status,
          notes: data.notes,
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      toast({
        title: "Pedido actualizado",
        description: "Los cambios han sido guardados exitosamente.",
      });
      onClose();
    },
    onError: (error) => {
      console.error('Error updating order:', error);
      toast({
        title: "Error",
        description: "No se pudo actualizar el pedido. Inténtalo de nuevo.",
        variant: "destructive",
      });
    }
  });

  const onSubmit = (data: EditOrderFormData) => {
    updateOrderMutation.mutate(data);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="clientName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nombre del Cliente</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    data-testid="input-edit-client-name"
                    placeholder="Nombre del cliente"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Estado</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-edit-status">
                      <SelectValue placeholder="Seleccionar estado" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="draft">Borrador</SelectItem>
                    <SelectItem value="pending">Pendiente</SelectItem>
                    <SelectItem value="confirmed">Confirmado</SelectItem>
                    <SelectItem value="cancelled">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notas (Opcional)</FormLabel>
              <FormControl>
                <Textarea
                  {...field}
                  rows={3}
                  data-testid="textarea-edit-notes"
                  placeholder="Notas adicionales sobre el pedido..."
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2">
          <Button 
            type="button"
            variant="outline" 
            onClick={() => {
              form.reset();
              onClose();
            }}
            data-testid="button-cancel-edit"
            disabled={updateOrderMutation.isPending}
          >
            Cancelar
          </Button>
          <Button 
            type="submit"
            data-testid="button-save-edit"
            disabled={updateOrderMutation.isPending}
          >
            {updateOrderMutation.isPending ? (
              <>
                <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin mr-2" />
                Guardando...
              </>
            ) : (
              'Guardar Cambios'
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}

export default function TomadorPedidos() {
  const [location, navigate] = useLocation();
  
  // Tab management with URL sync
  const getActiveTabFromUrl = () => {
    const searchParams = new URLSearchParams(location.split('?')[1] || '');
    const tab = searchParams.get('tab');
    return tab === 'recientes' ? tab : 'constructor';
  };
  
  const [activeTab, setActiveTab] = useState(getActiveTabFromUrl);
  
  // Update URL when tab changes
  const handleTabChange = (newTab: string) => {
    setActiveTab(newTab);
    const currentPath = location.split('?')[0];
    const searchParams = new URLSearchParams(location.split('?')[1] || '');
    const quoteId = searchParams.get('quoteId');
    
    if (newTab === 'constructor') {
      // Preserve quoteId if it exists, otherwise remove all query params
      if (quoteId) {
        navigate(`${currentPath}?quoteId=${quoteId}`);
      } else {
        navigate(currentPath); // Remove query param for default tab
      }
    } else {
      // Preserve quoteId when switching to other tabs
      if (quoteId) {
        navigate(`${currentPath}?tab=${newTab}&quoteId=${quoteId}`);
      } else {
        navigate(`${currentPath}?tab=${newTab}`);
      }
    }
  };
  
  // Update active tab when URL changes
  useEffect(() => {
    setActiveTab(getActiveTabFromUrl());
  }, [location]);

  // Auto-load quote for editing when quoteId is in URL
  useEffect(() => {
    const searchParams = new URLSearchParams(location.split('?')[1] || '');
    const quoteId = searchParams.get('quoteId');
    
    if (quoteId) {
      // Load the quote and switch to constructor tab
      loadQuoteForEditing(quoteId);
      setActiveTab('constructor');
    }
  }, [location]);

  // Function to load a quote for editing
  const loadQuoteForEditing = async (quoteId: string) => {
    try {
      // Load quote and items using consistent apiRequest
      const quoteResponse = await apiRequest(`/api/quotes/${quoteId}`);
      const quote = await quoteResponse.json();
      
      const itemsResponse = await apiRequest(`/api/quotes/${quoteId}/items`).catch(() => null);
      const items = itemsResponse ? await itemsResponse.json() : [];
      
      // Set editing mode
      setEditingQuoteId(quoteId);
      
      // Populate form with quote data
      setQuoteForm({
        clientName: quote.clientName,
        clientRut: quote.clientRut || '',
        clientEmail: quote.clientEmail || '',
        clientPhone: quote.clientPhone || '',
        clientAddress: quote.clientAddress || '',
        validUntil: quote.validUntil || '',
        notes: quote.notes || '',
      });
      
      // Convert quote items to cart items with proper types
      const cartItems: CartItem[] = items.map((item: any) => ({
        id: item.id || nanoid(), // Generate stable unique ID
        type: 'standard' as const,
        productName: item.productName,
        productCode: item.productCode || '',
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        totalPrice: Number(item.totalPrice),
      }));
      
      setCart(cartItems);
      setShowQuoteBuilder(true);
      
      toast({
        title: "Cotización cargada",
        description: `Cotización #${quote.quoteNumber} cargada para editar`,
      });
      
    } catch (error) {
      console.error('Error loading quote:', error);
      toast({
        title: "Error",
        description: "No se pudo cargar la cotización",
        variant: "destructive"
      });
    }
  };
  
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [showClientSearch, setShowClientSearch] = useState(false); // Control client search visibility in mobile
  const [showQuoteBuilder, setShowQuoteBuilder] = useState(false);
  const [selectedClientForQuote, setSelectedClientForQuote] = useState<Client | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [quoteForm, setQuoteForm] = useState<QuoteFormData>(INITIAL_QUOTE_FORM);
  const [productSearchTerm, setProductSearchTerm] = useState("");
  const [editingQuoteId, setEditingQuoteId] = useState<string | null>(null); // Track if we're editing an existing quote
  const [selectedUnidad, setSelectedUnidad] = useState<string>("");
  const [selectedColor, setSelectedColor] = useState<string>("");
  const [selectedTiers, setSelectedTiers] = useState<Record<string, PriceTier>>({});
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [productQuantities, setProductQuantities] = useState<Record<string, number>>({});
  
  // Debounce search input for client search - wait 600ms after user stops typing
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 600);

    return () => clearTimeout(timer);
  }, [searchTerm]);
  
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [showCustomProductModal, setShowCustomProductModal] = useState(false);
  const [customProduct, setCustomProduct] = useState<CustomProductData>(INITIAL_CUSTOM_PRODUCT);
  const [selectedOrderForView, setSelectedOrderForView] = useState<Order | null>(null);
  const [selectedOrderForEdit, setSelectedOrderForEdit] = useState<Order | null>(null);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState<string | null>(null);
  const [editingPriceItem, setEditingPriceItem] = useState<string | null>(null); // Item ID for custom price editing
  const [customPriceInput, setCustomPriceInput] = useState("");
  const [customDiscountInput, setCustomDiscountInput] = useState("");
  const [priceInputMode, setPriceInputMode] = useState<"price" | "discount">("price");
  const [savedQuoteId, setSavedQuoteId] = useState<string | null>(null); // Track if current quote is saved
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false); // Track if quote has been edited
  const [showPdfViewer, setShowPdfViewer] = useState(false); // Control PDF viewer visibility
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null); // Store PDF blob URL
  const [defaultMobileTab, setDefaultMobileTab] = useState<"client" | "products" | "cart">("client"); // Default tab for mobile
  
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
      productUnit: "UN", // Default unit for custom products
    };
    setCart(prev => [...prev, newItem]);
    if (savedQuoteId) {
      setHasUnsavedChanges(true);
    }
    setShowCustomProductModal(false);
    setCustomProduct(INITIAL_CUSTOM_PRODUCT);
    toast({ title: 'Producto personalizado agregado' });
  };

  // Fetch available units for filtering
  const { data: availableUnits = [] } = useQuery<string[]>({
    queryKey: ["/api/price-list/units"],
    queryFn: async () => {
      const response = await fetch('/api/price-list/units', { credentials: 'include' });
      if (!response.ok) {
        throw new Error('Failed to fetch units');
      }
      return response.json();
    },
  });

  // Fetch colors for filtering
  const { data: availableColors = [] } = useQuery<string[]>({
    queryKey: ["/api/price-list/colors"],
    queryFn: async () => {
      const response = await fetch('/api/price-list/colors', { credentials: 'include' });
      if (!response.ok) {
        throw new Error('Failed to fetch colors');
      }
      return response.json();
    },
  });

  // Fetch products for quote builder
  const { data: priceListResponse, isLoading: priceListLoading } = useQuery({
    queryKey: ["/api/price-list", { search: productSearchTerm, unidad: selectedUnidad, color: selectedColor, limit: 50 }],
    queryFn: async () => {
      const params = new URLSearchParams({ search: productSearchTerm, limit: "50" });
      if (selectedUnidad) {
        params.set("unidad", selectedUnidad);
      }
      if (selectedColor) {
        params.set("color", selectedColor);
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

  // Fetch clients with search functionality (same structure as client management)
  const { data: clientsData, isLoading: isLoadingClients } = useQuery({
    queryKey: ['/api/clients', { search: debouncedSearchTerm }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (debouncedSearchTerm) params.set('search', debouncedSearchTerm);
      params.set('limit', '50'); // Limit results for performance
      params.set('offset', '0'); // Always start from first page
      
      const response = await fetch(`/api/clients?${params}`, { credentials: 'include' });
      if (!response.ok) {
        throw new Error('Failed to fetch clients');
      }
      return response.json() as Promise<{
        clients: Client[];
        totalCount: number;
        currentPage: number;
        totalPages: number;
      }>;
    },
    enabled: debouncedSearchTerm.length >= 2, // Only search when user has typed at least 2 characters
  });

  // Extract clients array from response (same as client management)
  const clients = clientsData?.clients || [];

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
      // Invalidate quotes query to refresh the list
      queryClient.invalidateQueries({ 
        predicate: (query) => 
          typeof query.queryKey[0] === 'string' && 
          (query.queryKey[0] as string).startsWith('/api/quotes')
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
      clientRut: client.rten || '', // Fixed: Use client.rten for RUT
      clientEmail: client.email || '',
      clientPhone: client.foen || '',
      clientAddress: client.dien || '',
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days from now
      notes: `Pedido para cliente: ${client.nokoen}`,
    });
    setCart([]);
    setDefaultMobileTab("products"); // Start on products tab since client info is filled
    setShowQuoteBuilder(true);
  };

  // Open quote builder for existing client
  const handleCreateQuoteForClient = (client: Client) => {
    setSelectedClientForQuote(client);
    setQuoteForm({
      ...INITIAL_QUOTE_FORM,
      clientName: client.nokoen,
      clientId: client.id,
      clientRut: client.rten || "", // Fixed: Use client.rten for RUT, not client.nokoen
      clientEmail: client.email || "",
      clientPhone: client.foen || "",
      clientAddress: `${client.dien || ""} ${client.comuna || ""}`.trim(),
    });
    setCart([]);
    setEditingQuoteId(null); // Clear editing state for new quote
    setDefaultMobileTab("products"); // Start on products tab since client info is filled
    setShowQuoteBuilder(true);
  };

  // Open quote builder for new client
  const handleCreateQuoteForNewClient = () => {
    setSelectedClientForQuote(null);
    setQuoteForm(INITIAL_QUOTE_FORM);
    setCart([]);
    setProductSearchTerm("");
    setEditingQuoteId(null); // Clear editing state for new quote
    setDefaultMobileTab("client"); // Start on client tab for new quotes
    setShowQuoteBuilder(true);
  };

  // Reset quote builder
  const resetQuoteBuilder = () => {
    setShowQuoteBuilder(false);
    setSelectedClientForQuote(null);
    setQuoteForm(INITIAL_QUOTE_FORM);
    setCart([]);
    setProductSearchTerm("");
    setEditingQuoteId(null); // Clear editing state
    setSavedQuoteId(null); // Clear saved state
    setHasUnsavedChanges(false); // Reset unsaved changes flag
    setDefaultMobileTab("client"); // Reset to default tab
  };

  // Order action handlers
  const handleViewOrder = (orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (order) {
      setSelectedOrderForView(order);
    }
  };

  const handleEditOrder = (orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (order) {
      setSelectedOrderForEdit(order);
    }
  };

  const handleDeleteOrder = (orderId: string) => {
    setShowDeleteConfirmation(orderId);
  };

  // Order mutations
  const updateOrderMutation = useMutation({
    mutationFn: async ({ orderId, data }: { orderId: string, data: Partial<Order> }) => {
      return await apiRequest(`/api/orders/${orderId}`, {
        method: 'PATCH',
        data
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      toast({
        title: "Pedido actualizado",
        description: "Los cambios han sido guardados exitosamente.",
      });
      setSelectedOrderForEdit(null);
    },
    onError: (error) => {
      console.error('Error updating order:', error);
      toast({
        title: "Error",
        description: "No se pudo actualizar el pedido. Inténtalo de nuevo.",
        variant: "destructive",
      });
    }
  });

  const deleteOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      return await apiRequest(`/api/orders/${orderId}`, {
        method: 'DELETE'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      toast({
        title: "Pedido eliminado",
        description: "El pedido ha sido eliminado exitosamente.",
      });
      setShowDeleteConfirmation(null);
    },
    onError: (error) => {
      console.error('Error deleting order:', error);
      toast({
        title: "Error",
        description: "No se pudo eliminar el pedido. Inténtalo de nuevo.",
        variant: "destructive",
      });
    }
  });

  const confirmDeleteOrder = (orderId: string) => {
    deleteOrderMutation.mutate(orderId);
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
        productUnit: product.unidad || "UN", // Store actual unit from product data
      };
      
      setCart(prev => [...prev, newItem]);
      if (savedQuoteId) {
        setHasUnsavedChanges(true);
      }
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
    
    if (savedQuoteId) {
      setHasUnsavedChanges(true);
    }
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

  // Apply custom price (manual price or discount percentage)
  const applyCustomPrice = () => {
    if (!editingPriceItem) return;

    const item = cart.find(i => i.id === editingPriceItem);
    if (!item) return;

    let newUnitPrice: number;

    if (priceInputMode === "price") {
      // Manual price
      const manualPrice = parseFloat(customPriceInput);
      if (isNaN(manualPrice) || manualPrice < 0) {
        toast({
          title: "Precio inválido",
          description: "Ingresa un precio válido",
          variant: "destructive"
        });
        return;
      }
      newUnitPrice = manualPrice;
    } else {
      // Discount percentage
      const discountPercent = parseFloat(customDiscountInput);
      if (isNaN(discountPercent) || discountPercent < 0 || discountPercent > 100) {
        toast({
          title: "Descuento inválido",
          description: "Ingresa un porcentaje entre 0 y 100",
          variant: "destructive"
        });
        return;
      }
      newUnitPrice = item.unitPrice * (1 - discountPercent / 100);
    }

    setCart(prev => prev.map(i =>
      i.id === editingPriceItem
        ? { ...i, unitPrice: newUnitPrice, totalPrice: newUnitPrice * i.quantity }
        : i
    ));

    setEditingPriceItem(null);
    setCustomPriceInput("");
    setCustomDiscountInput("");
    toast({
      title: "Precio personalizado aplicado",
      description: `Nuevo precio: ${formatCurrency(newUnitPrice)}`,
    });
  };

  // Remove item from cart
  const removeFromCart = (itemId: string) => {
    setCart(prev => prev.filter(item => item.id !== itemId));
    if (savedQuoteId) {
      setHasUnsavedChanges(true);
    }
    toast({
      title: "Producto eliminado",
      description: "Producto eliminado del presupuesto",
    });
  };

  // XSS Security: HTML escape function
  const escapeHtml = (text: string | null | undefined): string => {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  };

  // Create quote and download PDF function - integrated workflow
  const saveQuoteAndDownloadPDF = async () => {
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
      // First save the quote to get real server data
      const subtotal = cart.reduce((sum, item) => sum + item.totalPrice, 0);
      const tax = subtotal * 0.19; // 19% IVA
      const total = subtotal + tax;
      
      let savedQuote: Quote;
      const savedItems: any[] = [];
      
      if (editingQuoteId) {
        // Update existing quote
        const quoteData = {
          ...quoteForm,
          subtotal: subtotal.toString(),
          taxAmount: tax.toString(),
          total: total.toString(),
          status: "draft" as const,
          // Convert validUntil string to ISO string if it exists
          validUntil: quoteForm.validUntil ? new Date(quoteForm.validUntil).toISOString() : null,
        };

        const response = await apiRequest(`/api/quotes/${editingQuoteId}`, {
          method: 'PUT',
          data: quoteData
        });
        savedQuote = await response.json();

        // Delete existing items and add new ones
        const existingItemsResponse = await apiRequest(`/api/quotes/${editingQuoteId}/items`).catch(() => null);
        const existingItems = existingItemsResponse ? await existingItemsResponse.json() : [];
        for (const existingItem of existingItems) {
          await apiRequest(`/api/quote-items/${existingItem.id}`, { method: 'DELETE' }).catch(() => {});
        }

        // Add new items
        for (const item of cart) {
          const itemData = {
            quoteId: savedQuote.id,
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

          const itemResponse = await apiRequest(`/api/quotes/${savedQuote.id}/items`, {
            method: 'POST',
            data: itemData
          });

          if (itemResponse.ok) {
            const savedItem = await itemResponse.json();
            savedItems.push({ ...savedItem, productUnit: item.productUnit }); // Include unit data
          }
        }

        // Generate PDF with updated data (no order conversion for existing quotes)
        generatePDFFromQuote(savedQuote, savedItems);

        toast({
          title: "Cotización actualizada y PDF generado",
          description: `Cotización ${savedQuote.quoteNumber} actualizada y PDF descargado`,
        });
      } else {
        // Create new quote
        const quoteData = {
          ...quoteForm,
          subtotal: subtotal.toString(),
          taxAmount: tax.toString(),
          total: total.toString(),
          status: "draft" as const,
          // Convert validUntil string to ISO string if it exists
          validUntil: quoteForm.validUntil ? new Date(quoteForm.validUntil).toISOString() : null,
        };

        const response = await apiRequest('/api/quotes', {
          method: 'POST',
          data: quoteData
        });
        savedQuote = await response.json();

        // Add quote items
        for (const item of cart) {
          const itemData = {
            quoteId: savedQuote.id,
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

          const itemResponse = await apiRequest(`/api/quotes/${savedQuote.id}/items`, {
            method: 'POST',
            data: itemData
          });

          if (itemResponse.ok) {
            const savedItem = await itemResponse.json();
            savedItems.push({ ...savedItem, productUnit: item.productUnit }); // Include unit data
          }
        }

        // Convert quote to order so it appears in "Recent Orders" (only for new quotes)
        try {
          const convertResponse = await apiRequest(`/api/quotes/${savedQuote.id}/convert-to-order`, {
            method: 'POST',
            data: {}
          });
          
          if (convertResponse.ok) {
            const convertedOrder = await convertResponse.json();
            // Invalidate orders cache so the new order appears immediately in "Recent Orders"
            queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
            
            console.log(`Quote ${savedQuote.quoteNumber} converted to order ${convertedOrder.orderNumber}`);
            
            // Send email automatically after conversion to order
            try {
              await sendQuoteEmailWithPDF(savedQuote, savedItems);
              console.log('Email sent successfully after order conversion');
            } catch (emailError) {
              console.warn('Could not send email after order conversion:', emailError);
              // Don't fail the whole operation if email fails
            }
          }
        } catch (error) {
          console.warn('Could not convert quote to order, but quote was saved successfully:', error);
          // Don't fail the whole operation if order conversion fails
        }

        // Now generate PDF with real saved data
        generatePDFFromQuote(savedQuote, savedItems);

        toast({
          title: "Cotización creada y PDF generado",
          description: `Cotización ${savedQuote.quoteNumber} creada, descargada y agregada a pedidos recientes`,
        });
      }

      // Invalidate quotes query to refresh the list
      queryClient.invalidateQueries({ 
        predicate: (query) => 
          typeof query.queryKey[0] === 'string' && 
          (query.queryKey[0] as string).startsWith('/api/quotes')
      });

      resetQuoteBuilder();

    } catch (error) {
      console.error('Error creating quote and PDF:', error);
      toast({
        title: "Error",
        description: "Error al crear la cotización y generar el PDF",
        variant: "destructive",
      });
    }
  };

  // Generate PDF from saved quote data using HTML/CSS - EXACT specification compliance
  const generatePDFFromQuote = (quote: Quote, items: any[]) => {
    try {
      // Format data for Chilean standards
      const quoteDate = new Date(quote.createdAt || new Date()).toLocaleDateString('es-CL', { 
        day: '2-digit',
        month: '2-digit', 
        year: 'numeric'
      });

      // Calculate totals with proper formatting
      const subtotal = parseFloat(quote.subtotal || "0");
      const discount = 0; // Currently no discount system, but structure supports it
      const netTotal = subtotal - discount;
      const tax = parseFloat(quote.taxAmount || "0");
      const total = parseFloat(quote.total || "0");

      // Format currency in Chilean format (CLP with dots as thousand separators)
      const formatCurrency = (amount: number) => `$${Math.round(amount).toLocaleString('es-CL').replace(/,/g, '.')}`;

      // Build products table rows HTML with XSS protection
      const productRows = items.map(item => {
        const unitPrice = parseFloat(item.unitPrice);
        const lineTotal = parseFloat(item.totalPrice);
        const productUnit = escapeHtml(item.productUnit) || "UN";
        
        return `
          <tr>
            <td>
              <div class="product-name">${escapeHtml(item.productName)}</div>
              ${item.productCode || item.customSku ? `<div class="product-code">SKU: ${escapeHtml(item.productCode || item.customSku)}</div>` : ''}
            </td>
            <td class="text-center">${productUnit}</td>
            <td class="text-center">${parseFloat(item.quantity)}</td>
            <td class="text-right">${formatCurrency(unitPrice)}</td>
            <td class="text-right" style="color: #fd6301; font-weight: 600;">${formatCurrency(lineTotal)}</td>
          </tr>`;
      }).join('');

      // Build complete HTML with all real data mapped
      const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Cotización ${quote.quoteNumber}</title>
  <style>
    @page {
      size: A4;
      margin: 15mm;
    }
    body {
      font-family: Arial, sans-serif;
      margin: 0;
      padding: 0;
      color: #333;
      font-size: 14px;
      line-height: 1.4;
    }
    .container {
      max-width: 100%;
      margin: 0 auto;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 20px;
      border-bottom: 2px solid #fd6301;
      padding-bottom: 15px;
    }
    .header-left {
      flex-shrink: 0;
    }
    .header-right {
      text-align: right;
    }
    .header img {
      max-height: 60px;
      width: auto;
    }
    .header-left svg {
      height: 60px;
      width: auto;
    }
    .header h1 {
      color: #fd6301;
      margin: 0;
      font-size: 24px;
      font-weight: bold;
    }
    .header-info {
      font-size: 13px;
      color: #374151;
      margin-top: 8px;
    }
    .section {
      margin-bottom: 15px;
    }
    .section h3 {
      color: #fd6301;
      margin: 0 0 10px 0;
      font-size: 16px;
      font-weight: bold;
    }
    .client-info {
      background-color: #fff7ed;
      border: 1px solid #fdba74;
      padding: 12px;
      border-radius: 6px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      font-size: 13px;
    }
    .client-info p {
      margin: 0 0 8px 0;
    }
    .client-observations {
      grid-column: 1 / -1;
      margin-top: 8px;
      padding-top: 8px;
      border-top: 1px solid #fdba74;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 15px;
      font-size: 13px;
    }
    th {
      background: linear-gradient(to right, #fd6301, #e55100);
      color: white;
      padding: 8px;
      text-align: left;
      font-weight: bold;
      font-size: 12px;
    }
    td {
      padding: 8px;
      border-bottom: 1px solid #e5e7eb;
    }
    tr:hover {
      background-color: #fff7ed;
    }
    .text-right {
      text-align: right;
    }
    .text-center {
      text-align: center;
    }
    .product-name {
      font-weight: 600;
      color: #1f2937;
      font-size: 13px;
    }
    .product-code {
      color: #6b7280;
      font-size: 11px;
      margin-top: 2px;
    }
    .totals {
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
      padding: 15px;
      border-radius: 6px;
      margin-bottom: 15px;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      margin: 6px 0;
      font-size: 14px;
    }
    .total-row span:first-child {
      color: #374151;
      font-weight: 500;
    }
    .total-row span:last-child {
      font-weight: 600;
    }
    .final-total {
      font-size: 16px;
      font-weight: bold;
      border-top: 2px solid #e2e8f0;
      padding-top: 10px;
      margin-top: 8px;
    }
    .final-total span:last-child {
      color: #fd6301;
    }
    .discount-row span:last-child {
      color: #10b981;
    }
    .terms {
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
      padding: 12px;
      border-radius: 6px;
      margin-bottom: 15px;
    }
    .terms h4 {
      margin: 0 0 8px 0;
      font-size: 14px;
      color: #374151;
    }
    .terms ul {
      margin: 0;
      padding-left: 16px;
      font-size: 12px;
      color: #6b7280;
    }
    .terms li {
      margin-bottom: 4px;
    }
    .payment-info {
      background-color: #fff7ed;
      border: 1px solid #fdba74;
      padding: 12px;
      border-radius: 6px;
      font-size: 12px;
    }
    .payment-info h4 {
      color: #ea580c;
      margin: 0 0 10px 0;
      font-size: 14px;
    }
    .payment-info p {
      margin: 0 0 8px 0;
    }
    .payment-info a {
      color: #2563eb;
      text-decoration: underline;
      word-break: break-all;
    }
    .payment-section {
      margin-bottom: 10px;
    }
    .payment-section:last-child {
      margin-bottom: 0;
    }
    @media print {
      body { 
        margin: 0; 
        font-size: 12px;
      }
      .no-print { 
        display: none; 
      }
      .container {
        max-width: 100%;
      }
      .header {
        margin-bottom: 15px;
        padding-bottom: 10px;
      }
      .section {
        margin-bottom: 12px;
      }
      .totals {
        padding: 12px;
      }
      .payment-info {
        padding: 10px;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="header-left">
        <img src="/panoramica-logo.png" alt="Logo Panoramica 30 Años" style="width:220px;height:auto;display:block" />
      </div>
      <div class="header-right">
        <h1>COTIZACIÓN</h1>
        <div class="header-info">
          <p><strong>Fecha:</strong> ${quoteDate}</p>
          <p><strong>Cotización N°:</strong> ${escapeHtml(quote.quoteNumber)}</p>
        </div>
      </div>
    </div>

    <div class="section">
      <h3>Información del Cliente</h3>
      <div class="client-info">
        <p><strong>RUT:</strong> ${escapeHtml(quote.clientRut) || 'No especificado'}</p>
        <p><strong>Cliente:</strong> ${escapeHtml(quote.clientName)}</p>
        <p><strong>Email:</strong> ${escapeHtml(quote.clientEmail) || 'No especificado'}</p>
        <p><strong>Teléfono:</strong> ${escapeHtml(quote.clientPhone) || 'No especificado'}</p>
        <p><strong>Dirección:</strong> ${escapeHtml(quote.clientAddress) || 'No especificada'}</p>
        <p><strong>Ubicación:</strong> Chile</p>
        ${quote.notes ? `<div class="client-observations"><p><strong>Observaciones:</strong> ${escapeHtml(quote.notes)}</p></div>` : ''}
      </div>
    </div>

    <div class="section">
      <h3>Detalle de Productos</h3>
      <table>
        <thead>
          <tr>
            <th>Producto</th>
            <th class="text-center">Unidad</th>
            <th class="text-center">Cant.</th>
            <th class="text-right">Precio</th>
            <th class="text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          ${productRows}
        </tbody>
      </table>
    </div>

    <div class="section">
      <div class="totals">
        <div class="total-row">
          <span>Subtotal:</span>
          <span>${formatCurrency(subtotal)}</span>
        </div>
        ${discount > 0 ? `<div class="total-row discount-row">
          <span>Descuento aplicado:</span>
          <span>-${formatCurrency(discount)}</span>
        </div>` : ''}
        <div class="total-row">
          <span>Subtotal neto:</span>
          <span>${formatCurrency(netTotal)}</span>
        </div>
        <div class="total-row">
          <span>IVA (19%):</span>
          <span>${formatCurrency(tax)}</span>
        </div>
        <div class="total-row final-total">
          <span>Total Final:</span>
          <span>${formatCurrency(total)}</span>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="terms">
        <h4>Términos y Condiciones</h4>
        <ul>
          <li>Precios válidos por 7 días hábiles desde la emisión de esta cotización.</li>
          <li>Todos los precios están expresados en pesos chilenos (CLP) e incluyen IVA.</li>
          <li>Los productos están sujetos a disponibilidad de stock.</li>
          <li>Condiciones de pago: según acuerdo comercial.</li>
        </ul>
      </div>
    </div>

    <div class="section">
      <div class="payment-info">
        <h4>Información de Pagos</h4>
        <div class="payment-section">
          <p><strong>Link de pagos con tarjetas:</strong><br>
          <a href="https://micrositios.getnet.cl/pinturaspanoramica">https://micrositios.getnet.cl/pinturaspanoramica</a></p>
        </div>
        <div class="payment-section">
          <p><strong>Pagos con transferencia dirigirlos a:</strong><br>
          Pintureria Panoramica Limitada<br>
          RUT: 78.652.260-9<br>
          Cuenta Corriente Banco Santander: 2592916-0<br>
          Email: <a href="mailto:contacto@pinturaspanoramica.cl">contacto@pinturaspanoramica.cl</a></p>
        </div>
      </div>
    </div>
  </div>

  <div class="no-print" style="margin-top: 20px; text-align: center;">
    <button onclick="window.print()" style="padding: 10px 20px; background-color: #fd6301; color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: 600;">
      Imprimir / Descargar PDF
    </button>
  </div>
  <script>
    // Auto-trigger print dialog when page loads, including images
    window.addEventListener('load', function() {
      window.focus();
      window.print();
      setTimeout(function() {
        window.close();
      }, 250);
    });
  </script>
</body>
</html>`;

      // Open new window and write HTML content with improved auto-print
      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        
        // Enhanced auto-print with proper timing and window management
        printWindow.onload = () => {
          setTimeout(() => {
            printWindow.print();
            // Auto-close after print dialog (optional - remove if not desired)
            setTimeout(() => {
              try {
                printWindow.close();
              } catch (e) {
                // Ignore errors if user manually closed window
              }
            }, 1000);
          }, 500);
        };
      } else {
        throw new Error("No se pudo abrir la ventana del PDF. Verifique que no esté bloqueada por el navegador.");
      }

    } catch (error) {
      console.error('Error generating PDF:', error);
      throw error; // Re-throw to be handled by the main function
    }
  };

  // Download or view PDF based on device
  const downloadPDF = async () => {
    try {
      let quote, items;

      if (savedQuoteId) {
        // Fetch saved quote and items
        const quoteResponse = await apiRequest(`/api/quotes/${savedQuoteId}`);
        quote = await quoteResponse.json();
        
        const itemsResponse = await apiRequest(`/api/quotes/${savedQuoteId}/items`);
        items = await itemsResponse.json();
      } else {
        // Use current form data for unsaved quotes
        quote = {
          quoteNumber: 'BORRADOR',
          clientName: quoteForm.clientName || 'Sin especificar',
          clientEmail: quoteForm.clientEmail || '',
          clientPhone: quoteForm.clientPhone || '',
          status: 'draft',
          notes: quoteForm.notes || '',
          createdAt: new Date().toISOString(),
          total: cart.reduce((sum, item) => sum + item.totalPrice, 0)
        };
        
        items = cart.map(item => ({
          productName: item.productName,
          sku: item.customSku || item.productCode || '',
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
          productUnit: item.productUnit || 'UN'
        }));
      }

      // Generate PDF HTML
      const htmlContent = generatePDFHTML(quote, items);

      if (isMobile) {
        // For mobile: Create blob and show in viewer
        const blob = new Blob([htmlContent], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        setPdfBlobUrl(url);
        setShowPdfViewer(true);
      } else {
        // For desktop: Open in new window as before
        const printWindow = window.open('', '_blank', 'width=800,height=600');
        if (printWindow) {
          printWindow.document.write(htmlContent);
          printWindow.document.close();
          
          printWindow.onload = () => {
            setTimeout(() => {
              printWindow.print();
              setTimeout(() => {
                try {
                  printWindow.close();
                } catch (e) {
                  // Ignore errors if user manually closed window
                }
              }, 1000);
            }, 500);
          };
        } else {
          throw new Error("No se pudo abrir la ventana del PDF.");
        }
      }

    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: "Error",
        description: "Error al generar el PDF",
        variant: "destructive",
      });
    }
  };

  // Helper function to generate PDF HTML content
  const generatePDFHTML = (quote: Quote, items: any[]): string => {
    const quoteDate = new Date(quote.createdAt || new Date()).toLocaleDateString('es-CL', { 
      day: '2-digit',
      month: '2-digit', 
      year: 'numeric'
    });

    const subtotal = parseFloat(quote.subtotal || "0");
    const discount = 0;
    const netTotal = subtotal - discount;
    const tax = parseFloat(quote.taxAmount || "0");
    const total = parseFloat(quote.total || "0");

    const formatCurrency = (amount: number) => `$${Math.round(amount).toLocaleString('es-CL').replace(/,/g, '.')}`;

    const escapeHtml = (text: string | null | undefined) => {
      if (!text) return '';
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    };

    const productRows = items.map(item => {
      const unitPrice = parseFloat(item.unitPrice);
      const lineTotal = parseFloat(item.totalPrice);
      const productUnit = escapeHtml(item.productUnit) || "UN";
      
      return `
        <tr>
          <td>
            <div class="product-name">${escapeHtml(item.productName)}</div>
            ${item.productCode || item.customSku ? `<div class="product-code">SKU: ${escapeHtml(item.productCode || item.customSku)}</div>` : ''}
          </td>
          <td class="text-center">${productUnit}</td>
          <td class="text-center">${parseFloat(item.quantity)}</td>
          <td class="text-right">${formatCurrency(unitPrice)}</td>
          <td class="text-right" style="color: #fd6301; font-weight: 600;">${formatCurrency(lineTotal)}</td>
        </tr>`;
    }).join('');

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Presupuesto ${escapeHtml(quote.quoteNumber)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; padding: 20px; background: white; }
    .container { max-width: 800px; margin: 0 auto; }
    .header { background: linear-gradient(135deg, #fd6301 0%, #ff8c42 100%); color: white; padding: 30px; border-radius: 8px; margin-bottom: 30px; }
    .header h1 { font-size: 28px; margin-bottom: 8px; }
    .quote-number { font-size: 18px; opacity: 0.9; }
    .section { background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin-bottom: 20px; }
    .section-title { font-size: 16px; font-weight: 600; color: #fd6301; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 2px solid #fd6301; }
    .info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
    .info-item { padding: 8px 0; }
    .info-label { font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
    .info-value { font-size: 14px; color: #1e293b; font-weight: 500; }
    table { width: 100%; border-collapse: collapse; margin-top: 15px; }
    th { background: #f8fafc; padding: 12px; text-align: left; font-size: 12px; font-weight: 600; color: #475569; text-transform: uppercase; border-bottom: 2px solid #e2e8f0; }
    td { padding: 12px; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
    .product-name { font-weight: 500; color: #1e293b; }
    .product-code { font-size: 11px; color: #94a3b8; margin-top: 4px; }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .totals { margin-top: 20px; }
    .total-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 14px; }
    .total-row.final { background: #fd6301; color: white; padding: 15px; border-radius: 8px; margin-top: 10px; font-size: 18px; font-weight: 700; }
    .notes { background: #f8fafc; padding: 15px; border-radius: 6px; border-left: 4px solid #fd6301; margin-top: 20px; }
    .notes-title { font-weight: 600; color: #fd6301; margin-bottom: 8px; }
    .notes-content { color: #475569; font-size: 14px; line-height: 1.6; }
    
    /* Mobile adjustments */
    @media (max-width: 768px) {
      body { padding: 10px; font-size: 12px; }
      .container { max-width: 100%; }
      .header { padding: 15px; margin-bottom: 15px; }
      .header h1 { font-size: 18px; margin-bottom: 4px; }
      .quote-number { font-size: 14px; }
      .section { padding: 12px; margin-bottom: 12px; border-radius: 6px; }
      .section-title { font-size: 13px; margin-bottom: 10px; padding-bottom: 6px; }
      .info-grid { gap: 8px; }
      .info-item { padding: 4px 0; }
      .info-label { font-size: 9px; }
      .info-value { font-size: 11px; }
      table { margin-top: 8px; }
      th { padding: 6px 4px; font-size: 9px; }
      td { padding: 6px 4px; font-size: 10px; }
      .product-name { font-size: 10px; }
      .product-code { font-size: 8px; }
      .totals { margin-top: 12px; }
      .total-row { padding: 4px 0; font-size: 11px; }
      .total-row.final { padding: 10px; font-size: 14px; }
      .notes { padding: 10px; margin-top: 12px; }
      .notes-title { font-size: 11px; margin-bottom: 6px; }
      .notes-content { font-size: 10px; line-height: 1.4; }
    }
    
    @media print {
      body { padding: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>PRESUPUESTO</h1>
      <div class="quote-number">N° ${escapeHtml(quote.quoteNumber)}</div>
    </div>

    <div class="section">
      <div class="section-title">Información del Cliente</div>
      <div class="info-grid">
        <div class="info-item">
          <div class="info-label">Cliente</div>
          <div class="info-value">${escapeHtml(quote.clientName)}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Fecha</div>
          <div class="info-value">${quoteDate}</div>
        </div>
        ${quote.clientEmail ? `
        <div class="info-item">
          <div class="info-label">Email</div>
          <div class="info-value">${escapeHtml(quote.clientEmail)}</div>
        </div>` : ''}
        ${quote.clientPhone ? `
        <div class="info-item">
          <div class="info-label">Teléfono</div>
          <div class="info-value">${escapeHtml(quote.clientPhone)}</div>
        </div>` : ''}
      </div>
    </div>

    <div class="section">
      <div class="section-title">Detalle de Productos</div>
      <table>
        <thead>
          <tr>
            <th>Producto</th>
            <th class="text-center">Unidad</th>
            <th class="text-center">Cantidad</th>
            <th class="text-right">Precio Unit.</th>
            <th class="text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          ${productRows}
        </tbody>
      </table>

      <div class="totals">
        <div class="total-row">
          <span>Subtotal:</span>
          <span>${formatCurrency(subtotal)}</span>
        </div>
        <div class="total-row">
          <span>IVA (19%):</span>
          <span>${formatCurrency(tax)}</span>
        </div>
        <div class="total-row final">
          <span>TOTAL:</span>
          <span>${formatCurrency(total)}</span>
        </div>
      </div>
    </div>

    ${quote.notes ? `
    <div class="notes">
      <div class="notes-title">Notas</div>
      <div class="notes-content">${escapeHtml(quote.notes)}</div>
    </div>` : ''}
  </div>
</body>
</html>`;
  };

  // Generate PDF as base64 for email sending (doesn't open/download)
  const generatePDFAsBase64 = async (quote: Quote, items: any[]): Promise<string> => {
    try {
      // Format data for Chilean standards
      const quoteDate = new Date(quote.createdAt || new Date()).toLocaleDateString('es-CL', { 
        day: '2-digit',
        month: '2-digit', 
        year: 'numeric'
      });

      // Calculate totals with proper formatting
      const subtotal = parseFloat(quote.subtotal || "0");
      const discount = 0;
      const netTotal = subtotal - discount;
      const tax = parseFloat(quote.taxAmount || "0");
      const total = parseFloat(quote.total || "0");

      // Format currency in Chilean format (CLP with dots as thousand separators)
      const formatCurrency = (amount: number) => `$${Math.round(amount).toLocaleString('es-CL').replace(/,/g, '.')}`;

      // XSS protection helper function
      const escapeHtml = (text: string | null | undefined) => {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
      };

      // Build products table rows HTML with XSS protection
      const productRows = items.map(item => {
        const unitPrice = parseFloat(item.unitPrice);
        const lineTotal = parseFloat(item.totalPrice);
        const productUnit = escapeHtml(item.productUnit) || "UN";
        
        return `
          <tr>
            <td>
              <div class="product-name">${escapeHtml(item.productName)}</div>
              ${item.productCode || item.customSku ? `<div class="product-code">SKU: ${escapeHtml(item.productCode || item.customSku)}</div>` : ''}
            </td>
            <td class="text-center">${productUnit}</td>
            <td class="text-center">${parseFloat(item.quantity)}</td>
            <td class="text-right">${formatCurrency(unitPrice)}</td>
            <td class="text-right" style="color: #fd6301; font-weight: 600;">${formatCurrency(lineTotal)}</td>
          </tr>`;
      }).join('');

      // Build complete HTML (same as generatePDFFromQuote but for conversion to PDF)
      const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Cotización ${quote.quoteNumber}</title>
  <style>
    @page {
      size: A4;
      margin: 15mm;
    }
    body {
      font-family: Arial, sans-serif;
      margin: 0;
      padding: 20px;
      color: #333;
      font-size: 14px;
      line-height: 1.4;
    }
    .container {
      max-width: 100%;
      margin: 0 auto;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 20px;
      border-bottom: 2px solid #fd6301;
      padding-bottom: 15px;
    }
    .header-right {
      text-align: right;
    }
    .header h1 {
      color: #fd6301;
      margin: 0;
      font-size: 24px;
      font-weight: bold;
    }
    .header-info {
      font-size: 13px;
      color: #374151;
      margin-top: 8px;
    }
    .section {
      margin-bottom: 15px;
    }
    .section h3 {
      color: #fd6301;
      margin: 0 0 10px 0;
      font-size: 16px;
      font-weight: bold;
    }
    .client-info {
      background-color: #fff7ed;
      border: 1px solid #fdba74;
      padding: 12px;
      border-radius: 6px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      font-size: 13px;
    }
    .client-info p {
      margin: 0 0 8px 0;
    }
    .client-observations {
      grid-column: 1 / -1;
      margin-top: 8px;
      padding-top: 8px;
      border-top: 1px solid #fdba74;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 15px;
      font-size: 13px;
    }
    th {
      background: linear-gradient(to right, #fd6301, #e55100);
      color: white;
      padding: 8px;
      text-align: left;
      font-weight: bold;
      font-size: 12px;
    }
    td {
      padding: 8px;
      border-bottom: 1px solid #e5e7eb;
    }
    .text-right {
      text-align: right;
    }
    .text-center {
      text-align: center;
    }
    .product-name {
      font-weight: 600;
      color: #1f2937;
      font-size: 13px;
    }
    .product-code {
      color: #6b7280;
      font-size: 11px;
      margin-top: 2px;
    }
    .totals {
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
      padding: 15px;
      border-radius: 6px;
      margin-bottom: 15px;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      margin: 6px 0;
      font-size: 14px;
    }
    .total-row span:first-child {
      color: #374151;
      font-weight: 500;
    }
    .total-row span:last-child {
      font-weight: 600;
    }
    .final-total {
      font-size: 16px;
      font-weight: bold;
      border-top: 2px solid #e2e8f0;
      padding-top: 10px;
      margin-top: 8px;
    }
    .final-total span:last-child {
      color: #fd6301;
    }
    .terms {
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
      padding: 12px;
      border-radius: 6px;
      margin-bottom: 15px;
    }
    .terms h4 {
      margin: 0 0 8px 0;
      font-size: 14px;
      color: #374151;
    }
    .terms ul {
      margin: 0;
      padding-left: 16px;
      font-size: 12px;
      color: #6b7280;
    }
    .terms li {
      margin-bottom: 4px;
    }
    .payment-info {
      background-color: #fff7ed;
      border: 1px solid #fdba74;
      padding: 12px;
      border-radius: 6px;
      font-size: 12px;
    }
    .payment-info h4 {
      color: #ea580c;
      margin: 0 0 10px 0;
      font-size: 14px;
    }
    .payment-info p {
      margin: 0 0 8px 0;
    }
    .payment-section {
      margin-bottom: 10px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="header-left">
        <div style="width: 220px; height: 60px; background-color: #f3f4f6; display: flex; align-items: center; justify-content: center;">
          <span style="color: #6b7280;">Logo Panorámica</span>
        </div>
      </div>
      <div class="header-right">
        <h1>COTIZACIÓN</h1>
        <div class="header-info">
          <p><strong>Fecha:</strong> ${quoteDate}</p>
          <p><strong>Cotización N°:</strong> ${escapeHtml(quote.quoteNumber)}</p>
        </div>
      </div>
    </div>

    <div class="section">
      <h3>Información del Cliente</h3>
      <div class="client-info">
        <p><strong>RUT:</strong> ${escapeHtml(quote.clientRut) || 'No especificado'}</p>
        <p><strong>Cliente:</strong> ${escapeHtml(quote.clientName)}</p>
        <p><strong>Email:</strong> ${escapeHtml(quote.clientEmail) || 'No especificado'}</p>
        <p><strong>Teléfono:</strong> ${escapeHtml(quote.clientPhone) || 'No especificado'}</p>
        <p><strong>Dirección:</strong> ${escapeHtml(quote.clientAddress) || 'No especificada'}</p>
        <p><strong>Ubicación:</strong> Chile</p>
        ${quote.notes ? `<div class="client-observations"><p><strong>Observaciones:</strong> ${escapeHtml(quote.notes)}</p></div>` : ''}
      </div>
    </div>

    <div class="section">
      <h3>Detalle de Productos</h3>
      <table>
        <thead>
          <tr>
            <th>Producto</th>
            <th class="text-center">Unidad</th>
            <th class="text-center">Cant.</th>
            <th class="text-right">Precio</th>
            <th class="text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          ${productRows}
        </tbody>
      </table>
    </div>

    <div class="section">
      <div class="totals">
        <div class="total-row">
          <span>Subtotal:</span>
          <span>${formatCurrency(subtotal)}</span>
        </div>
        <div class="total-row">
          <span>Subtotal neto:</span>
          <span>${formatCurrency(netTotal)}</span>
        </div>
        <div class="total-row">
          <span>IVA (19%):</span>
          <span>${formatCurrency(tax)}</span>
        </div>
        <div class="total-row final-total">
          <span>Total Final:</span>
          <span>${formatCurrency(total)}</span>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="terms">
        <h4>Términos y Condiciones</h4>
        <ul>
          <li>Precios válidos por 7 días hábiles desde la emisión de esta cotización.</li>
          <li>Todos los precios están expresados en pesos chilenos (CLP) e incluyen IVA.</li>
          <li>Los productos están sujetos a disponibilidad de stock.</li>
          <li>Condiciones de pago: según acuerdo comercial.</li>
        </ul>
      </div>
    </div>

    <div class="section">
      <div class="payment-info">
        <h4>Información de Pagos</h4>
        <div class="payment-section">
          <p><strong>Link de pagos con tarjetas:</strong><br>
          https://micrositios.getnet.cl/pinturaspanoramica</p>
        </div>
        <div class="payment-section">
          <p><strong>Pagos con transferencia dirigirlos a:</strong><br>
          Pintureria Panoramica Limitada<br>
          RUT: 78.652.260-9<br>
          Cuenta Corriente Banco Santander: 2592916-0<br>
          Email: contacto@pinturaspanoramica.cl</p>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;

      // Create a temporary container with proper styles
      const container = document.createElement('div');
      container.style.position = 'absolute';
      container.style.left = '-9999px';
      container.style.width = '800px';
      container.style.fontFamily = 'Arial, sans-serif';
      container.style.background = 'white';
      container.style.padding = '20px';
      
      // Parse HTML and extract body content
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlContent, 'text/html');
      
      // Extract and inject styles
      const styleElement = doc.querySelector('style');
      if (styleElement) {
        const newStyle = document.createElement('style');
        newStyle.textContent = styleElement.textContent;
        container.appendChild(newStyle);
      }
      
      // Extract and inject body content
      const bodyContent = doc.body.innerHTML;
      const contentDiv = document.createElement('div');
      contentDiv.innerHTML = bodyContent;
      container.appendChild(contentDiv);
      
      document.body.appendChild(container);

      // Wait for content to render
      await new Promise(resolve => setTimeout(resolve, 500));

      // Generate PDF using html2pdf.js
      const opt = {
        margin: [10, 10, 10, 10] as [number, number, number, number],
        filename: `Cotizacion_${quote.quoteNumber}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const }
      };

      // Generate and get base64
      const pdfBlob = await html2pdf().set(opt).from(container).outputPdf('blob');
      
      // Clean up
      document.body.removeChild(container);

      // Convert blob to base64
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(pdfBlob);
      });

    } catch (error) {
      console.error('Error generating PDF as base64:', error);
      throw error;
    }
  };

  // Send quote email with PDF attachment
  const sendQuoteEmailWithPDF = async (quote: Quote, items: any[]) => {
    try {
      console.log('Generating PDF for email...');
      const pdfBase64 = await generatePDFAsBase64(quote, items);
      
      console.log('Sending email...');
      const response = await apiRequest(`/api/quotes/${quote.id}/send-email`, {
        method: 'POST',
        data: {
          pdfBase64,
          recipientEmail: 'contacto@pinturaspanoramica.cl'
        }
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Email sent successfully:', result);
        return true;
      } else {
        const error = await response.json();
        console.error('Failed to send email:', error);
        throw new Error(error.message || 'Failed to send email');
      }
    } catch (error) {
      console.error('Error sending quote email:', error);
      throw error;
    }
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
      
      let quote: Quote;
      
      if (editingQuoteId) {
        // Update existing quote
        const quoteData = {
          ...quoteForm,
          subtotal: subtotal.toString(),
          taxAmount: tax.toString(),
          total: total.toString(),
          status: "draft" as const,
          // Convert validUntil string to ISO string if it exists
          validUntil: quoteForm.validUntil ? new Date(quoteForm.validUntil).toISOString() : null,
        };

        const response = await apiRequest(`/api/quotes/${editingQuoteId}`, {
          method: 'PUT',
          data: quoteData
        });
        quote = await response.json();

        // Delete existing items and add new ones
        const existingItemsResponse = await apiRequest(`/api/quotes/${editingQuoteId}/items`).catch(() => null);
        const existingItems = existingItemsResponse ? await existingItemsResponse.json() : [];
        for (const existingItem of existingItems) {
          await apiRequest(`/api/quote-items/${existingItem.id}`, { method: 'DELETE' }).catch(() => {});
        }

        // Add new items
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

          await apiRequest(`/api/quotes/${quote.id}/items`, {
            method: 'POST',
            data: itemData
          });
        }

        toast({
          title: "Presupuesto actualizado",
          description: `Presupuesto ${quote.quoteNumber} actualizado exitosamente`,
        });
      } else {
        // Create new quote
        const quoteData = {
          ...quoteForm,
          subtotal: subtotal.toString(),
          taxAmount: tax.toString(),
          total: total.toString(),
          status: "draft" as const,
          // Convert validUntil string to ISO string if it exists
          validUntil: quoteForm.validUntil ? new Date(quoteForm.validUntil).toISOString() : null,
        };

        const response = await apiRequest('/api/quotes', {
          method: 'POST',
          data: quoteData
        });
        quote = await response.json();

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
      }

      // Invalidate quotes query to refresh the list
      queryClient.invalidateQueries({ 
        predicate: (query) => 
          typeof query.queryKey[0] === 'string' && 
          (query.queryKey[0] as string).startsWith('/api/quotes')
      });

      // Mark quote as saved and store ID for PDF and order actions
      setSavedQuoteId(quote.id);
      setEditingQuoteId(quote.id);
      setHasUnsavedChanges(false); // Reset unsaved changes flag

    } catch (error) {
      console.error('Error saving quote:', error);
      toast({
        title: "Error",
        description: "Error al guardar el presupuesto",
        variant: "destructive",
      });
    }
  };

  // Send order - Opens email client with PDF attached
  const sendOrder = async () => {
    if (!savedQuoteId) {
      toast({
        title: "Error",
        description: "Debe guardar el presupuesto primero",
        variant: "destructive",
      });
      return;
    }

    try {
      // Fetch saved quote and items
      const quoteResponse = await apiRequest(`/api/quotes/${savedQuoteId}`);
      const quote = await quoteResponse.json();
      
      const itemsResponse = await apiRequest(`/api/quotes/${savedQuoteId}/items`);
      const items = await itemsResponse.json();

      // Generate PDF HTML
      const htmlContent = generatePDFHTML(quote, items);
      
      // Create a temporary container with proper styles
      const container = document.createElement('div');
      container.style.position = 'absolute';
      container.style.left = '-9999px';
      container.style.width = '800px';
      container.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
      container.style.background = 'white';
      container.style.padding = '20px';
      
      // Parse HTML and extract body content
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlContent, 'text/html');
      
      // Extract and inject styles
      const styleElement = doc.querySelector('style');
      if (styleElement) {
        const newStyle = document.createElement('style');
        newStyle.textContent = styleElement.textContent;
        container.appendChild(newStyle);
      }
      
      // Extract and inject body content
      const bodyContent = doc.body.innerHTML;
      const contentDiv = document.createElement('div');
      contentDiv.innerHTML = bodyContent;
      container.appendChild(contentDiv);
      
      document.body.appendChild(container);

      // Wait for content to render
      await new Promise(resolve => setTimeout(resolve, 500));

      // Generate PDF using html2pdf.js
      const opt = {
        margin: [10, 10, 10, 10] as [number, number, number, number],
        filename: `Presupuesto-${quote.quoteNumber}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const }
      };

      // Generate PDF blob
      const pdfBlob = await html2pdf().set(opt).from(container).outputPdf('blob');
      
      // Clean up
      document.body.removeChild(container);
      
      // Create file for sharing
      const file = new File([pdfBlob], `Presupuesto-${quote.quoteNumber}.pdf`, { type: 'application/pdf' });

      // Try to use Web Share API (best for mobile)
      if (navigator.share) {
        try {
          await navigator.share({
            title: `Presupuesto ${quote.quoteNumber}`,
            text: `Presupuesto para ${quote.clientName}\n\nTotal: ${formatCurrency(parseFloat(quote.total || "0"))}`,
            files: [file]
          });
          console.log('PDF shared successfully via Web Share API');
          return; // Success - exit function
        } catch (shareError: any) {
          // If share failed or was cancelled, fall through to download method
          console.log('Web Share failed or cancelled, using download method:', shareError.message);
        }
      }
      
      // Fallback: Download PDF and open mailto
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Presupuesto-${quote.quoteNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Open mailto link
      const subject = encodeURIComponent(`Presupuesto ${quote.quoteNumber} - ${quote.clientName}`);
      const body = encodeURIComponent(`Adjunto encontrarás el presupuesto ${quote.quoteNumber}.\n\nCliente: ${quote.clientName}\nTotal: ${formatCurrency(parseFloat(quote.total || "0"))}\n\nSaludos,\nPinturas Panorámica`);
      const mailtoLink = `mailto:${quote.clientEmail || ''}?subject=${subject}&body=${body}`;
      
      // Small delay to ensure download starts before mailto opens
      setTimeout(() => {
        window.location.href = mailtoLink;
      }, 500);

      toast({
        title: "Preparando correo",
        description: "Se descargó el PDF. Adjúntalo manualmente al correo",
      });

    } catch (error) {
      console.error('Error preparing email:', error);
      toast({
        title: "Error",
        description: "No se pudo preparar el correo",
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
    <div className={`${
      isMobile 
        ? 'px-4 py-6' 
        : 'px-3 sm:px-4 lg:px-6 py-3 sm:py-4 lg:py-6 m-3 sm:m-4'
    }`}>
      <div className={`space-y-6 ${isMobile ? 'space-y-5' : ''}`}>
        {/* Header */}
        <div className={`${isMobile ? 'space-y-3' : 'space-y-4'}`}>
          <div>
            <h1 className={`font-semibold text-foreground ${
              isMobile ? 'text-xl mb-1' : 'text-2xl sm:text-3xl'
            }`}>
              Tomador de Pedidos
            </h1>
            <p className={`text-muted-foreground ${
              isMobile ? 'text-sm' : ''
            }`}>
              Constructor de presupuestos, cotizaciones y pedidos
            </p>
          </div>
        </div>

        {/* Create Quote Button - Hidden in mobile when client search is open */}
        {!(isMobile && showClientSearch) && (
          <div className={`${isMobile ? 'space-y-4' : 'flex justify-end'}`}>
            <Button
              onClick={handleCreateQuoteForNewClient}
              className={`bg-orange-500 hover:bg-orange-600 flex items-center justify-center gap-2 ${
                isMobile ? 'w-full h-10 text-sm font-medium' : ''
              }`}
              size={isMobile ? "sm" : "lg"}
              data-testid="button-create-quote-new-client"
            >
              <Calculator className="w-4 h-4" />
              {isMobile ? "Nuevo Presupuesto" : "Crear Presupuesto"}
            </Button>
          </div>
        )}

        {/* Client Search Section - Mobile Optimized */}
        {isMobile ? (
          // Mobile: Button to toggle search
          showClientSearch ? (
            <Card className="border-2 shadow-md">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <Search className="w-6 h-6" />
                    Buscar Cliente
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowClientSearch(false);
                      setSearchTerm("");
                      setDebouncedSearchTerm("");
                    }}
                    data-testid="button-close-client-search"
                  >
                    <X className="w-5 h-5" />
                  </Button>
                </div>
                <CardDescription className="text-base">
                  Ingresa el nombre del cliente para buscar en la base de datos
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 pt-2">
                <div className="relative">
                  <Search className="absolute left-4 top-4 h-5 w-5 text-muted-foreground" />
                  <Input
                    data-testid="input-client-search"
                    placeholder="Buscar cliente..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-12 h-14 text-base rounded-xl border-2 focus:border-orange-400"
                    style={{ fontSize: '16px' }} // Prevent zoom on iOS
                    autoFocus
                  />
                </div>

            {/* Search Results */}
            {debouncedSearchTerm.length >= 2 && (
              <div className="space-y-4">
                {isLoadingClients ? (
                  <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                      <Card key={i} className={isMobile ? 'border-2' : ''}>
                        <CardContent className={`${isMobile ? 'p-4' : 'p-4'} space-y-3`}>
                          <div className="flex items-center space-x-4">
                            <Skeleton className="h-12 w-12 rounded-full" />
                            <div className="space-y-2 flex-1">
                              <Skeleton className="h-4 w-[200px]" />
                              <Skeleton className="h-3 w-[150px]" />
                              <Skeleton className="h-3 w-[120px]" />
                            </div>
                          </div>
                          <div className={`${isMobile ? 'grid grid-cols-2 gap-2' : 'flex gap-2'}`}>
                            <Skeleton className="h-10 flex-1" />
                            <Skeleton className="h-10 flex-1" />
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : clients.length > 0 ? (
                  <div className={`space-y-4 max-h-96 overflow-y-auto ${isMobile ? 'space-y-6' : ''}`}>
                    {clients.map((client: Client) => (
                      <Card
                        key={client.id}
                        className={`hover:shadow-md transition-all duration-200 ${
                          isMobile ? 'border-2 shadow-sm' : ''
                        }`}
                      >
                        <CardContent className={`${isMobile ? 'p-4' : 'p-4'}`}>
                          {/* Client Header - More Compact */}
                          <div className={`${isMobile ? 'space-y-3' : 'flex items-start space-x-4 mb-4'}`}>
                            {!isMobile && (
                              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                                <User className="w-6 h-6 text-primary" />
                              </div>
                            )}
                            
                            <div className="flex-1 min-w-0">
                              {/* Client Name and RUT - More Compact Layout */}
                              <div className={`${isMobile ? 'mb-2' : 'mb-3'}`}>
                                <div className={`${isMobile ? 'flex items-start gap-3' : 'flex items-center gap-3 flex-wrap'}`}>
                                  {isMobile && (
                                    <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                                      <User className="w-6 h-6 text-primary" />
                                    </div>
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <h3 className={`font-semibold text-foreground ${isMobile ? 'text-base leading-tight mb-1' : 'text-base mb-1'}`} data-testid={`text-client-name-${client.id}`}>
                                      {client.nokoen}
                                    </h3>
                                    {client.rten && (
                                      <Badge variant="outline" className="text-xs font-medium">
                                        RUT: {client.rten}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </div>
                              
                              {/* Client Details - Compact Inline Layout */}
                              <div className={`${isMobile ? 'space-y-1' : 'space-y-1'}`}>
                                {client.dien && (
                                  <div className="flex items-start gap-2">
                                    <MapPin className="w-3 h-3 text-muted-foreground flex-shrink-0 mt-0.5" />
                                    <span className="text-xs text-muted-foreground leading-relaxed">
                                      {client.dien}{client.cmen ? `, ${client.cmen}` : ''}
                                    </span>
                                  </div>
                                )}
                                {client.foen && (
                                  <div className="flex items-center gap-2">
                                    <Phone className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                                    <span className="text-xs text-muted-foreground">
                                      {client.foen}
                                    </span>
                                  </div>
                                )}
                                
                                {/* Credit Info - Compact Inline Design */}
                                {client.crlt && (
                                  <div className={`${isMobile ? 'bg-muted/30 rounded-lg p-2 mt-2' : 'mt-2'} text-xs`}>
                                    <div className={`${isMobile ? 'grid grid-cols-2 gap-x-2 gap-y-1' : 'flex justify-between items-center'}`}>
                                      <span className="text-muted-foreground">Límite:</span>
                                      <span className="font-medium text-right">{formatCurrency(Number(client.crlt))}</span>
                                      <span className="text-muted-foreground">Disponible:</span>
                                      <span className="font-medium text-green-600 text-right">{formatCurrency(Number(client.cren) || 0)}</span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          {/* Action Button */}
                          <div className="mt-3">
                            <Button
                              data-testid={`button-create-quote-${client.id}`}
                              onClick={() => handleCreateQuoteForClient(client)}
                              className="w-full bg-orange-500 hover:bg-orange-600 flex items-center justify-center gap-2 h-10 text-sm font-medium"
                            >
                              <ShoppingCart className="w-4 h-4" />
                              Pedido / Presupuesto
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No se encontraron clientes con "{debouncedSearchTerm}"</p>
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
          ) : (
            <Button
              onClick={() => setShowClientSearch(true)}
              variant="outline"
              className="w-full h-14 border-2 border-dashed hover:border-orange-400 hover:bg-orange-50"
              data-testid="button-open-client-search"
            >
              <Search className="w-5 h-5 mr-2" />
              Buscar Cliente
            </Button>
          )
        ) : (
          // Desktop: Always show search
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
                <Search className="absolute left-4 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  data-testid="input-client-search"
                  placeholder="Buscar por nombre de cliente..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Search Results */}
              {debouncedSearchTerm.length >= 2 && (
                <div className="space-y-4">
                  {isLoadingClients ? (
                    <div className="space-y-3">
                      {[...Array(3)].map((_, i) => (
                        <Card key={i}>
                          <CardContent className="p-4 space-y-3">
                            <div className="flex items-center space-x-4">
                              <Skeleton className="h-12 w-12 rounded-full" />
                              <div className="space-y-2 flex-1">
                                <Skeleton className="h-4 w-[200px]" />
                                <Skeleton className="h-3 w-[150px]" />
                                <Skeleton className="h-3 w-[120px]" />
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Skeleton className="h-10 flex-1" />
                              <Skeleton className="h-10 flex-1" />
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : clients.length > 0 ? (
                    <div className="space-y-4 max-h-96 overflow-y-auto">
                      {clients.map((client: Client) => (
                        <Card
                          key={client.id}
                          className="hover:shadow-md transition-all duration-200"
                        >
                          <CardContent className="p-4">
                            {/* Client Header */}
                            <div className="flex items-start space-x-4 mb-4">
                              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                                <User className="w-6 h-6 text-primary" />
                              </div>
                              
                              <div className="flex-1 min-w-0">
                                {/* Client Name and RUT */}
                                <div className="mb-3">
                                  <div className="flex items-center gap-3 flex-wrap">
                                    <div className="flex-1 min-w-0">
                                      <h3 className="font-semibold text-foreground text-base mb-1" data-testid={`text-client-name-${client.id}`}>
                                        {client.nokoen}
                                      </h3>
                                      {client.rten && (
                                        <Badge variant="outline" className="text-xs font-medium">
                                          RUT: {client.rten}
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                
                                {/* Client Details */}
                                <div className="space-y-1">
                                  {client.dien && (
                                    <div className="flex items-start gap-2">
                                      <MapPin className="w-3 h-3 text-muted-foreground flex-shrink-0 mt-0.5" />
                                      <span className="text-xs text-muted-foreground leading-relaxed">
                                        {client.dien}{client.cmen ? `, ${client.cmen}` : ''}
                                      </span>
                                    </div>
                                  )}
                                  {client.foen && (
                                    <div className="flex items-center gap-2">
                                      <Phone className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                                      <span className="text-xs text-muted-foreground">
                                        {client.foen}
                                      </span>
                                    </div>
                                  )}
                                  
                                  {/* Credit Info */}
                                  {client.crlt && (
                                    <div className="mt-2 text-xs">
                                      <div className="flex justify-between items-center">
                                        <span className="text-muted-foreground">Límite:</span>
                                        <span className="font-medium">{formatCurrency(Number(client.crlt))}</span>
                                        <span className="text-muted-foreground">Disponible:</span>
                                        <span className="font-medium text-green-600">{formatCurrency(Number(client.cren) || 0)}</span>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                            
                            {/* Action Buttons */}
                            <div className="flex items-center gap-2 mt-4">
                              <Button
                                variant="outline"
                                data-testid={`button-create-quote-${client.id}`}
                                onClick={() => handleCreateQuoteForClient(client)}
                                className="flex items-center justify-center gap-2 h-10"
                              >
                                <Calculator className="w-4 h-4" />
                                Presupuesto
                              </Button>
                              <Button
                                data-testid={`button-create-order-${client.id}`}
                                onClick={() => handleCreateOrder(client)}
                                disabled={createOrderMutation.isPending}
                                className="bg-orange-500 hover:bg-orange-600 flex items-center justify-center gap-2 h-10"
                              >
                                <ShoppingCart className="w-4 h-4" />
                                {createOrderMutation.isPending ? "Creando..." : "Pedido"}
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No se encontraron clientes con "{debouncedSearchTerm}"</p>
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
        )}

        {/* Cotizaciones Recientes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Cotizaciones Recientes
            </CardTitle>
            <CardDescription>
              Historial de cotizaciones creadas en el sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            <QuotesList onEditQuote={loadQuoteForEditing} />
          </CardContent>
        </Card>
      </div>
    </div>

    {/* Quote Builder - Mobile Sheet / Desktop Dialog */}
    {isMobile ? (
      <Sheet open={showQuoteBuilder} onOpenChange={setShowQuoteBuilder}>
        <SheetContent side="bottom" className="h-[95vh] p-0">
          <SheetHeader className="p-4 pb-2 border-b">
            <SheetTitle className="flex items-center gap-2">
              <Calculator className="w-5 h-5" />
              Constructor de Presupuesto
            </SheetTitle>
            <SheetDescription className="sr-only">
              Crear presupuesto con productos y información del cliente
            </SheetDescription>
          </SheetHeader>
          <div className="flex flex-col h-[calc(95vh-60px)]">
            {/* Mobile Content */}
            <div className="flex-1 overflow-y-auto">
              <Tabs defaultValue={defaultMobileTab} className="h-full">
                <div className="border-b px-4">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="client" data-testid="tab-client-mobile">Cliente</TabsTrigger>
                    <TabsTrigger value="products" data-testid="tab-products-mobile">Productos</TabsTrigger>
                    <TabsTrigger value="cart" data-testid="tab-cart-mobile">
                      Carrito ({cart.length})
                    </TabsTrigger>
                  </TabsList>
                </div>
                
                <TabsContent value="client" className="p-4 space-y-4 m-0">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Información del Cliente</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <Label htmlFor="mobile-client-name">Nombre del Cliente *</Label>
                        <Input
                          id="mobile-client-name"
                          value={quoteForm.clientName}
                          onChange={(e) => setQuoteForm(prev => ({ ...prev, clientName: e.target.value }))}
                          data-testid="mobile-input-client-name"
                          placeholder="Nombre completo del cliente"
                          className="h-12 text-base"
                          style={{ fontSize: '16px' }}
                        />
                      </div>
                      <div>
                        <Label htmlFor="mobile-client-rut">RUT</Label>
                        <Input
                          id="mobile-client-rut"
                          value={quoteForm.clientRut}
                          onChange={(e) => setQuoteForm(prev => ({ ...prev, clientRut: e.target.value }))}
                          data-testid="mobile-input-client-rut"
                          placeholder="12345678-9"
                          className="h-12 text-base"
                          style={{ fontSize: '16px' }}
                        />
                      </div>
                      <div>
                        <Label htmlFor="mobile-client-email">Email</Label>
                        <Input
                          id="mobile-client-email"
                          type="email"
                          value={quoteForm.clientEmail}
                          onChange={(e) => setQuoteForm(prev => ({ ...prev, clientEmail: e.target.value }))}
                          data-testid="mobile-input-client-email"
                          placeholder="cliente@email.com"
                          className="h-12 text-base"
                          style={{ fontSize: '16px' }}
                          inputMode="email"
                        />
                      </div>
                      <div>
                        <Label htmlFor="mobile-client-phone">Teléfono</Label>
                        <Input
                          id="mobile-client-phone"
                          value={quoteForm.clientPhone}
                          onChange={(e) => setQuoteForm(prev => ({ ...prev, clientPhone: e.target.value }))}
                          data-testid="mobile-input-client-phone"
                          placeholder="+56 9 1234 5678"
                          className="h-12 text-base"
                          style={{ fontSize: '16px' }}
                          inputMode="tel"
                        />
                      </div>
                      <div>
                        <Label htmlFor="mobile-client-address">Dirección</Label>
                        <Input
                          id="mobile-client-address"
                          value={quoteForm.clientAddress}
                          onChange={(e) => setQuoteForm(prev => ({ ...prev, clientAddress: e.target.value }))}
                          data-testid="mobile-input-client-address"
                          placeholder="Dirección completa"
                          className="h-12 text-base"
                          style={{ fontSize: '16px' }}
                        />
                      </div>
                      <div>
                        <Label htmlFor="mobile-valid-until">Válido hasta</Label>
                        <Input
                          id="mobile-valid-until"
                          type="date"
                          value={quoteForm.validUntil}
                          onChange={(e) => setQuoteForm(prev => ({ ...prev, validUntil: e.target.value }))}
                          data-testid="mobile-input-valid-until"
                          className="h-12 text-base"
                          style={{ fontSize: '16px' }}
                        />
                      </div>
                      <div>
                        <Label htmlFor="mobile-notes">Notas</Label>
                        <Textarea
                          id="mobile-notes"
                          rows={3}
                          value={quoteForm.notes}
                          onChange={(e) => setQuoteForm(prev => ({ ...prev, notes: e.target.value }))}
                          data-testid="mobile-textarea-notes"
                          placeholder="Condiciones especiales, términos, etc."
                          className="text-base"
                          style={{ fontSize: '16px' }}
                        />
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="products" className="p-4 space-y-4 m-0">
                  {/* Mobile Product Search */}
                  <div className="space-y-4">
                    <div className="sticky top-0 bg-background z-10 pb-4">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                        <Input
                          placeholder="Buscar productos por nombre o SKU..."
                          value={productSearchTerm}
                          onChange={(e) => setProductSearchTerm(e.target.value)}
                          className="pl-10 h-12 text-base"
                          style={{ fontSize: '16px' }}
                          data-testid="mobile-search-products"
                        />
                      </div>
                      
                      {/* Mobile Filter Chips - Hidden temporarily per user request */}
                      {/* <div className="flex gap-2 mt-3 overflow-x-auto pb-2">
                        <Button
                          variant={selectedCategory === 'all' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setSelectedCategory('all')}
                          className="whitespace-nowrap h-9"
                          data-testid="mobile-category-all"
                        >
                          Todos
                        </Button>
                        <Button
                          variant={selectedCategory === 'pinturas' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setSelectedCategory('pinturas')}
                          className="whitespace-nowrap h-9"
                          data-testid="mobile-category-pinturas"
                        >
                          Pinturas
                        </Button>
                        <Button
                          variant={selectedCategory === 'accesorios' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setSelectedCategory('accesorios')}
                          className="whitespace-nowrap h-9"
                          data-testid="mobile-category-accesorios"
                        >
                          Accesorios
                        </Button>
                        <Button
                          variant={selectedCategory === 'barnices' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setSelectedCategory('barnices')}
                          className="whitespace-nowrap h-9"
                          data-testid="mobile-category-barnices"
                        >
                          Barnices
                        </Button>
                      </div> */}
                    </div>

                    {/* Mobile Product Results */}
                    <div className="space-y-3">
                      {priceList.length > 0 ? (
                        priceList.filter((product: PriceList) => {
                          // Filtrar solo por término de búsqueda (categorías ocultas temporalmente)
                          if (!productSearchTerm || productSearchTerm.trim().length === 0) return true;
                          
                          const productName = product.producto?.toLowerCase() || '';
                          const sku = product.codigo?.toLowerCase() || '';
                          const searchTermLower = productSearchTerm.toLowerCase().trim();
                          
                          return productName.includes(searchTermLower) || 
                                 sku.includes(searchTermLower);
                        }).map((product: PriceList) => (
                          <Card key={product.id} className="p-3">
                            <div className="space-y-3">
                              <div>
                                <div className="flex items-start justify-between mb-2">
                                  <div className="flex-1 min-w-0">
                                    <h4 className="font-medium text-sm leading-5 truncate">
                                      {product.producto}
                                    </h4>
                                    <p className="text-xs text-muted-foreground mt-1">
                                      SKU: {product.codigo}
                                    </p>
                                  </div>
                                  <div className="text-right ml-2">
                                    <p className="font-bold text-green-600">
                                      {formatCurrency(Number(product.lista) || 0)}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {product.unidad}
                                    </p>
                                  </div>
                                </div>
                              </div>
                              
                              {/* Mobile Add to Cart */}
                              <div className="flex items-center gap-2">
                                <div className="flex items-center space-x-1 flex-1">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      const qty = (productQuantities[product.codigo] || 1) - 1;
                                      setProductQuantities(prev => ({
                                        ...prev,
                                        [product.codigo]: Math.max(1, qty)
                                      }));
                                    }}
                                    className="h-8 w-8 p-0"
                                    data-testid={`mobile-decrease-${product.codigo}`}
                                  >
                                    <Minus className="w-3 h-3" />
                                  </Button>
                                  <span className="text-sm font-medium w-8 text-center">
                                    {productQuantities[product.codigo] || 1}
                                  </span>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      const qty = (productQuantities[product.codigo] || 1) + 1;
                                      setProductQuantities(prev => ({
                                        ...prev,
                                        [product.codigo]: Math.min(99, qty)
                                      }));
                                    }}
                                    className="h-8 w-8 p-0"
                                    data-testid={`mobile-increase-${product.codigo}`}
                                  >
                                    <Plus className="w-3 h-3" />
                                  </Button>
                                </div>
                                <Button
                                  onClick={() => {
                                    const quantity = productQuantities[product.codigo] || 1;
                                    const availableTiers = getAvailableTiers(product);
                                    const selectedTier = selectedTiers[product.codigo] || 'lista';
                                    const tierOption = availableTiers.find(tier => tier.key === selectedTier);
                                    const unitPrice = tierOption?.price || 0;
                                    
                                    const newItem: CartItem = {
                                      id: `${product.codigo}-${Date.now()}`,
                                      type: "standard",
                                      productName: product.producto,
                                      productCode: product.codigo,
                                      quantity,
                                      unitPrice,
                                      totalPrice: unitPrice * quantity,
                                      priceTier: selectedTier,
                                      tierPrices: availableTiers,
                                      productUnit: product.unidad || undefined,
                                    };

                                    setCart(prev => [...prev, newItem]);
                                    if (savedQuoteId) {
                                      setHasUnsavedChanges(true);
                                    }
                                    toast({
                                      title: "Producto agregado",
                                      description: `${product.producto} agregado al presupuesto`,
                                    });
                                  }}
                                  size="sm"
                                  className="h-8 px-4 bg-orange-500 hover:bg-orange-600"
                                  data-testid={`mobile-add-to-cart-${product.codigo}`}
                                >
                                  <ShoppingCart className="w-3 h-3 mr-1" />
                                  Agregar
                                </Button>
                              </div>
                            </div>
                          </Card>
                        ))
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
                          <p className="text-sm">No se encontraron productos</p>
                          <p className="text-xs mt-1">Intenta ajustar la búsqueda o categoría</p>
                        </div>
                      )}
                    </div>

                    {/* Mobile Quick Add Custom Product */}
                    <Card className="border-dashed border-2 border-orange-200">
                      <CardContent className="p-4">
                        <Button
                          variant="ghost"
                          onClick={() => setShowCustomProductModal(true)}
                          className="w-full h-12 text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                          data-testid="mobile-button-custom-product"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Producto Personalizado
                        </Button>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                <TabsContent value="cart" className="p-4 space-y-4 m-0">
                  {/* Mobile Cart */}
                  {cart.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <ShoppingCart className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p className="text-base font-medium">Carrito vacío</p>
                      <p className="text-sm mt-1">Agrega productos para crear un presupuesto</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Mobile Cart Items */}
                      <div className="space-y-3">
                        {cart.map((item) => (
                          <Card key={item.id} className="p-3">
                            <div className="space-y-3">
                              <div className="flex items-start justify-between">
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-medium text-sm leading-5">
                                    {item.productName}
                                  </h4>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    SKU: {item.productCode || item.customSku || 'N/A'}
                                  </p>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeFromCart(item.id)}
                                  className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                  data-testid={`mobile-remove-cart-${item.id}`}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>

                              {/* Price Tier Selection for Standard Products (Mobile) */}
                              {item.type === "standard" && item.tierPrices && item.tierPrices.length > 1 && (
                                <div className="space-y-2">
                                  <label className="text-xs text-muted-foreground">Precio:</label>
                                  <Select
                                    value={item.priceTier || 'lista'}
                                    onValueChange={(newTier) => updateCartItemPriceTier(item.id, newTier as PriceTier)}
                                  >
                                    <SelectTrigger className="h-9 text-sm" data-testid={`mobile-select-tier-${item.id}`}>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {item.tierPrices.map((tier) => (
                                        <SelectItem key={tier.key} value={tier.key}>
                                          {tier.label}: {formatCurrency(tier.price)}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              )}

                              {/* Custom Price Button (Mobile) */}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setEditingPriceItem(item.id);
                                  setCustomPriceInput(item.unitPrice.toString());
                                  setCustomDiscountInput("");
                                  setPriceInputMode("price");
                                }}
                                className="w-full h-8 text-xs"
                                data-testid={`mobile-custom-price-${item.id}`}
                              >
                                <Edit className="w-3 h-3 mr-1" />
                                Precio Personalizado
                              </Button>

                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-1">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => updateCartItemQuantity(item.id, item.quantity - 1)}
                                    className="h-9 w-9 p-0"
                                    data-testid={`mobile-cart-decrease-${item.id}`}
                                  >
                                    <Minus className="w-4 h-4" />
                                  </Button>
                                  <span className="text-base font-medium w-12 text-center bg-muted/50 h-9 flex items-center justify-center rounded">
                                    {item.quantity}
                                  </span>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => updateCartItemQuantity(item.id, item.quantity + 1)}
                                    className="h-9 w-9 p-0"
                                    data-testid={`mobile-cart-increase-${item.id}`}
                                  >
                                    <Plus className="w-4 h-4" />
                                  </Button>
                                </div>
                                <div className="text-right">
                                  <p className="text-xs text-muted-foreground">
                                    {formatCurrency(item.unitPrice)} c/u
                                  </p>
                                  <p className="text-base font-bold text-green-600">
                                    {formatCurrency(item.totalPrice)}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </Card>
                        ))}
                      </div>

                      {/* Mobile Cart Summary */}
                      <Card className="bg-muted/20">
                        <CardContent className="p-4">
                          <div className="space-y-3">
                            <div className="flex justify-between text-sm">
                              <span>Subtotal:</span>
                              <span className="font-medium" data-testid="mobile-cart-subtotal">
                                {formatCurrency(subtotal)}
                              </span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span>IVA (19%):</span>
                              <span className="font-medium" data-testid="mobile-cart-tax">
                                {formatCurrency(tax)}
                              </span>
                            </div>
                            <Separator />
                            <div className="flex justify-between font-bold text-lg">
                              <span>Total:</span>
                              <span className="text-green-600" data-testid="mobile-cart-total">
                                {formatCurrency(total)}
                              </span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Mobile Cart Actions */}
                      <div className="space-y-2">
                        <Button
                          variant="outline"
                          onClick={() => setCart([])}
                          className="w-full h-11 text-red-600 border-red-200 hover:bg-red-50"
                          data-testid="mobile-clear-cart"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Limpiar Carrito
                        </Button>
                      </div>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>
            
            {/* Sticky Bottom Actions for Mobile */}
            <div className="border-t p-4 bg-background">
              {!savedQuoteId ? (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={resetQuoteBuilder}
                    className="flex-1 h-12"
                    data-testid="mobile-button-cancel"
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={saveQuote}
                    disabled={!quoteForm.clientName || cart.length === 0}
                    className="flex-1 h-12 bg-orange-500 hover:bg-orange-600"
                    data-testid="mobile-button-save-quote"
                  >
                    Guardar
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <Button
                    onClick={downloadPDF}
                    variant="outline"
                    className="w-full h-12"
                    data-testid="mobile-button-download-pdf"
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Descargar PDF
                  </Button>
                  {(!savedQuoteId || hasUnsavedChanges) ? (
                    <Button
                      onClick={saveQuote}
                      disabled={!quoteForm.clientName || cart.length === 0}
                      className="w-full h-12 bg-orange-500 hover:bg-orange-600"
                      data-testid="mobile-button-save-quote"
                    >
                      Guardar
                    </Button>
                  ) : (
                    <Button
                      onClick={sendOrder}
                      className="w-full h-12 bg-orange-500 hover:bg-orange-600"
                      data-testid="mobile-button-send-order"
                    >
                      <Mail className="w-4 h-4 mr-2" />
                      Enviar
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    ) : (
      <Dialog open={showQuoteBuilder} onOpenChange={setShowQuoteBuilder}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden p-0">
          <DialogHeader className="p-6 pb-4">
            <DialogTitle className="flex items-center gap-2">
              <Calculator className="w-6 h-6" />
              Constructor de Presupuesto
            </DialogTitle>
          </DialogHeader>
        
        <div className="flex h-[calc(90vh-100px)]">
          {/* Left Side - Product Search and Client Info */}
          <div className="flex-1 p-6 overflow-y-auto border-r">
            <div className="space-y-6">
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
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="modal-unit-filter">Filtrar por tipo de envase (unidad)</Label>
                        <Select
                          value={selectedUnidad}
                          onValueChange={(value) => setSelectedUnidad(value === "all" ? "" : value)}
                        >
                          <SelectTrigger data-testid="modal-select-unit-filter">
                            <SelectValue placeholder="Todos los envases" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todos los envases</SelectItem>
                            {availableUnits.map((unit) => (
                              <SelectItem key={unit} value={unit}>
                                {unit}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="modal-color-filter">Filtrar por color</Label>
                        <Select
                          value={selectedColor}
                          onValueChange={(value) => setSelectedColor(value === "all" ? "" : value)}
                        >
                          <SelectTrigger data-testid="modal-select-color-filter">
                            <SelectValue placeholder="Todos los colores" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todos los colores</SelectItem>
                            {availableColors.map((color) => (
                              <SelectItem key={color} value={color}>
                                {color}
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
                          priceList.map((product: PriceList) => {
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
                                      <Link
                                        href={`/product/${encodeURIComponent(product.producto || '')}`}
                                        className="text-blue-600 hover:text-blue-800 hover:underline transition-colors cursor-pointer"
                                        onClick={(e) => e.stopPropagation()}
                                        data-testid={`link-product-${product.codigo}`}
                                      >
                                        {product.producto}
                                      </Link>
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
                                        onClick={(e) => {
                                          e.stopPropagation(); // Prevent double addition
                                          addProductToCart(product, selectedTier);
                                        }}
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
                          {/* Custom Price Button (Desktop) */}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setEditingPriceItem(item.id);
                              setCustomPriceInput(item.unitPrice.toString());
                              setCustomDiscountInput("");
                              setPriceInputMode("price");
                            }}
                            className="w-full h-7 text-xs mt-2"
                            data-testid={`desktop-custom-price-${item.id}`}
                          >
                            <Edit className="w-3 h-3 mr-1" />
                            Precio Personalizado
                          </Button>
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

                  <div className="flex flex-col gap-2">
                    <Button
                      onClick={downloadPDF}
                      variant="outline"
                      className="w-full"
                      data-testid="modal-button-download-pdf"
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      Descargar PDF
                    </Button>
                    {(!savedQuoteId || hasUnsavedChanges) && (
                      <Button
                        onClick={saveQuote}
                        className="w-full bg-orange-500 hover:bg-orange-600"
                        disabled={!quoteForm.clientName || cart.length === 0}
                        data-testid="modal-button-save-quote"
                      >
                        Guardar
                      </Button>
                    )}
                    {savedQuoteId && !hasUnsavedChanges && (
                      <Button
                        onClick={sendOrder}
                        className="w-full bg-orange-500 hover:bg-orange-600"
                        data-testid="modal-button-send-order"
                      >
                        <Mail className="w-4 h-4 mr-2" />
                        Enviar por Correo
                      </Button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    )}

    {/* Custom Product Modal */}
    <Dialog open={showCustomProductModal} onOpenChange={setShowCustomProductModal}>
      <DialogContent className="max-w-xl mx-4 sm:mx-auto rounded-xl border-0 shadow-xl">
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

    {/* View Order Modal */}
    <Dialog open={!!selectedOrderForView} onOpenChange={() => setSelectedOrderForView(null)}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5" />
            Detalles del Pedido
          </DialogTitle>
          <DialogDescription>
            Información completa y detallada del pedido seleccionado.
          </DialogDescription>
        </DialogHeader>
        {selectedOrderForView && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-semibold">Número de Pedido</Label>
                <p className="text-sm">{selectedOrderForView.orderNumber}</p>
              </div>
              <div>
                <Label className="text-sm font-semibold">Estado</Label>
                <Badge variant={getStatusBadgeVariant(selectedOrderForView.status || 'draft')}>
                  {getStatusLabel(selectedOrderForView.status || 'draft')}
                </Badge>
              </div>
              <div>
                <Label className="text-sm font-semibold">Cliente</Label>
                <p className="text-sm">{selectedOrderForView.clientName}</p>
              </div>
              <div>
                <Label className="text-sm font-semibold">Fecha de Creación</Label>
                <p className="text-sm">
                  {selectedOrderForView.createdAt ? new Date(selectedOrderForView.createdAt).toLocaleDateString('es-CL', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  }) : 'No disponible'}
                </p>
              </div>
            </div>
            {selectedOrderForView.notes && (
              <div>
                <Label className="text-sm font-semibold">Notas</Label>
                <p className="text-sm bg-muted p-3 rounded-lg">{selectedOrderForView.notes}</p>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setSelectedOrderForView(null)}>
                Cerrar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>

    {/* Edit Order Modal - React Hook Form implementation */}
    <Dialog open={!!selectedOrderForEdit} onOpenChange={() => setSelectedOrderForEdit(null)}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="w-5 h-5" />
            Editar Pedido
          </DialogTitle>
          <DialogDescription>
            Modificar la información básica del pedido seleccionado.
          </DialogDescription>
        </DialogHeader>
        {selectedOrderForEdit && (
          <EditOrderForm 
            order={selectedOrderForEdit} 
            onClose={() => setSelectedOrderForEdit(null)}
          />
        )}
      </DialogContent>
    </Dialog>

    {/* Delete Confirmation Dialog */}
    <Dialog open={!!showDeleteConfirmation} onOpenChange={() => setShowDeleteConfirmation(null)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="w-5 h-5" />
            Confirmar Eliminación
          </DialogTitle>
          <DialogDescription>
            Esta acción eliminará permanentemente el pedido seleccionado.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            ¿Estás seguro de que quieres eliminar este pedido? Esta acción no se puede deshacer.
          </p>
          <div className="flex justify-end gap-2">
            <Button 
              variant="outline" 
              onClick={() => setShowDeleteConfirmation(null)}
              data-testid="button-cancel-delete"
            >
              Cancelar
            </Button>
            <Button 
              variant="destructive"
              onClick={() => showDeleteConfirmation && confirmDeleteOrder(showDeleteConfirmation)}
              data-testid="button-confirm-delete"
            >
              Eliminar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    {/* Custom Price/Discount Dialog */}
    <Dialog open={!!editingPriceItem} onOpenChange={() => setEditingPriceItem(null)}>
      <DialogContent className={`${isMobile ? 'max-w-[95vw]' : 'max-w-md'}`}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="w-5 h-5" />
            Precio Personalizado
          </DialogTitle>
          <DialogDescription>
            Ingresa un precio manual o aplica un porcentaje de descuento
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {/* Toggle Price Mode */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={priceInputMode === "price" ? "default" : "outline"}
              onClick={() => setPriceInputMode("price")}
              className="h-10"
            >
              Precio Manual
            </Button>
            <Button
              variant={priceInputMode === "discount" ? "default" : "outline"}
              onClick={() => setPriceInputMode("discount")}
              className="h-10"
            >
              % Descuento
            </Button>
          </div>

          {/* Input for Manual Price */}
          {priceInputMode === "price" && (
            <div>
              <Label htmlFor="custom-price-input">Precio Unitario</Label>
              <Input
                id="custom-price-input"
                type="number"
                value={customPriceInput}
                onChange={(e) => setCustomPriceInput(e.target.value)}
                placeholder="Ej: 10000"
                className="h-12 text-base"
                style={{ fontSize: '16px' }}
                inputMode="decimal"
                data-testid="input-custom-price"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Ingresa el precio por unidad en pesos chilenos
              </p>
            </div>
          )}

          {/* Input for Discount Percentage */}
          {priceInputMode === "discount" && (
            <div>
              <Label htmlFor="custom-discount-input">Porcentaje de Descuento</Label>
              <Input
                id="custom-discount-input"
                type="number"
                value={customDiscountInput}
                onChange={(e) => setCustomDiscountInput(e.target.value)}
                placeholder="Ej: 15"
                className="h-12 text-base"
                style={{ fontSize: '16px' }}
                inputMode="decimal"
                min="0"
                max="100"
                data-testid="input-custom-discount"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Ingresa un valor entre 0 y 100 (%)
              </p>
              {customDiscountInput && editingPriceItem && (() => {
                const item = cart.find(i => i.id === editingPriceItem);
                if (!item) return null;
                const discountPercent = parseFloat(customDiscountInput);
                if (isNaN(discountPercent)) return null;
                const newPrice = item.unitPrice * (1 - discountPercent / 100);
                return (
                  <p className="text-sm font-medium text-green-600 mt-2">
                    Nuevo precio: {formatCurrency(newPrice)}
                  </p>
                );
              })()}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-4">
            <Button 
              variant="outline" 
              onClick={() => {
                setEditingPriceItem(null);
                setCustomPriceInput("");
                setCustomDiscountInput("");
              }}
              data-testid="button-cancel-custom-price"
            >
              Cancelar
            </Button>
            <Button 
              onClick={applyCustomPrice}
              className="bg-orange-500 hover:bg-orange-600"
              data-testid="button-apply-custom-price"
            >
              Aplicar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    
    {/* PDF Viewer for Mobile */}
    <Sheet open={showPdfViewer} onOpenChange={(open) => {
      setShowPdfViewer(open);
      if (!open && pdfBlobUrl) {
        URL.revokeObjectURL(pdfBlobUrl);
        setPdfBlobUrl(null);
      }
    }}>
      <SheetContent side="bottom" className="h-[95vh] p-0 flex flex-col">
        <SheetHeader className="p-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Vista Previa del Presupuesto
          </SheetTitle>
          <SheetDescription className="sr-only">
            Visualización del PDF del presupuesto
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 w-full overflow-hidden">
          {pdfBlobUrl && (
            <iframe
              src={pdfBlobUrl}
              className="w-full h-full border-0"
              title="Vista previa del presupuesto"
            />
          )}
        </div>
        <div className="border-t p-4 bg-background">
          <Button
            onClick={async () => {
              if (!savedQuoteId) return;
              try {
                const quoteResponse = await apiRequest(`/api/quotes/${savedQuoteId}`);
                const quote = await quoteResponse.json();
                
                const itemsResponse = await apiRequest(`/api/quotes/${savedQuoteId}/items`);
                const items = await itemsResponse.json();

                const htmlContent = generatePDFHTML(quote, items);
                
                // Create a temporary container (same method that works for preview)
                const container = document.createElement('div');
                container.innerHTML = htmlContent;
                container.style.position = 'absolute';
                container.style.left = '-9999px';
                container.style.top = '0';
                document.body.appendChild(container);

                // Wait for content to fully render
                await new Promise(resolve => setTimeout(resolve, 300));

                // Generate PDF with same settings as preview
                const opt = {
                  margin: [10, 10, 10, 10] as [number, number, number, number],
                  filename: `Presupuesto-${quote.quoteNumber}.pdf`,
                  image: { type: 'jpeg' as const, quality: 0.98 },
                  html2canvas: { 
                    scale: 2, 
                    useCORS: true,
                    logging: false,
                    width: 800,
                    windowWidth: 800
                  },
                  jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const }
                };

                await html2pdf().set(opt).from(container).save();
                
                // Clean up
                document.body.removeChild(container);

              } catch (error) {
                console.error('Error downloading PDF:', error);
                toast({
                  title: "Error",
                  description: "No se pudo descargar el archivo",
                  variant: "destructive",
                });
              }
            }}
            className="w-full h-12 bg-orange-500 hover:bg-orange-600"
            data-testid="button-download-pdf-file"
          >
            <Download className="w-4 h-4 mr-2" />
            Descargar Archivo
          </Button>
        </div>
      </SheetContent>
    </Sheet>

    {/* Mobile Bottom Navigation Bar - Hidden per user request */}
    {/* {isMobile && (
      <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-t-2 border-orange-200 px-4 py-3 z-50">
        <div className="flex items-center justify-around max-w-md mx-auto">
          <div className="text-center">
            <div className="flex flex-col items-center gap-1">
              <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                <Search className="w-6 h-6 text-orange-600" />
              </div>
              <span className="text-xs font-medium text-orange-600">Buscar</span>
            </div>
          </div>
          
          <div className="text-center">
            <Button
              variant="ghost"
              onClick={handleCreateQuoteForNewClient}
              className="flex flex-col items-center gap-1 p-2 h-auto"
              data-testid="mobile-nav-quote"
            >
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                <Calculator className="w-6 h-6 text-primary" />
              </div>
              <span className="text-xs font-medium">Presupuesto</span>
            </Button>
          </div>
          
          <div className="text-center relative">
            <div className="flex flex-col items-center gap-1">
              <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center relative">
                <ShoppingCart className="w-6 h-6 text-muted-foreground" />
                {cart.length > 0 && (
                  <Badge className="absolute -top-1 -right-1 bg-orange-500 text-white text-xs min-w-[20px] h-5 rounded-full flex items-center justify-center p-0">
                    {cart.length}
                  </Badge>
                )}
              </div>
              <span className="text-xs font-medium text-muted-foreground">Carrito</span>
            </div>
          </div>
          
          <div className="text-center">
            <Button
              variant="ghost"
              asChild
              className="flex flex-col items-center gap-1 p-2 h-auto"
              data-testid="mobile-nav-orders"
            >
              <Link href="/pedidos">
                <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center">
                  <FileText className="w-6 h-6 text-muted-foreground" />
                </div>
                <span className="text-xs font-medium text-muted-foreground">Pedidos</span>
              </Link>
            </Button>
          </div>
        </div>
      </div>
    )} */}
    
    {/* Bottom padding removed since mobile nav is hidden */}
    {/* {isMobile && <div className="h-20" />} */}
    </>
  );
}