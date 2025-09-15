import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Search, ShoppingCart, User, MapPin, Phone, Plus, Minus, Trash2, FileText, Calculator, X, Package, Eye, MoreHorizontal, Edit } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Client, Order, PriceList, Quote } from "@shared/schema";
import jsPDF from "jspdf";

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
  const [searchTerm, setSearchTerm] = useState("");
  const [showQuoteBuilder, setShowQuoteBuilder] = useState(false);
  const [selectedClientForQuote, setSelectedClientForQuote] = useState<Client | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [quoteForm, setQuoteForm] = useState<QuoteFormData>(INITIAL_QUOTE_FORM);
  const [productSearchTerm, setProductSearchTerm] = useState("");
  const [selectedUnidad, setSelectedUnidad] = useState<string>("");
  const [selectedColor, setSelectedColor] = useState<string>("");
  const [selectedTiers, setSelectedTiers] = useState<Record<string, PriceTier>>({});
  const { toast } = useToast();
  const [showCustomProductModal, setShowCustomProductModal] = useState(false);
  const [customProduct, setCustomProduct] = useState<CustomProductData>(INITIAL_CUSTOM_PRODUCT);
  const [selectedOrderForView, setSelectedOrderForView] = useState<Order | null>(null);
  const [selectedOrderForEdit, setSelectedOrderForEdit] = useState<Order | null>(null);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState<string | null>(null);
  
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
      clientRut: client.rten || '', // Fixed: Use client.rten for RUT
      clientEmail: client.email || '',
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
      clientName: client.nokoen,
      clientId: client.id,
      clientRut: client.rten || "", // Fixed: Use client.rten for RUT, not client.nokoen
      clientEmail: client.email || "",
      clientPhone: client.foen || "",
      clientAddress: `${client.dien || ""} ${client.comuna || ""}`.trim(),
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
      const savedQuote: Quote = await response.json();

      // Add quote items
      const savedItems: any[] = [];
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

      // Now generate PDF with real saved data
      generatePDFFromQuote(savedQuote, savedItems);

      toast({
        title: "Cotización creada y PDF generado",
        description: `Cotización ${savedQuote.quoteNumber} creada y descargada exitosamente`,
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

  // Generate PDF from saved quote data
  const generatePDFFromQuote = (quote: Quote, items: any[]) => {

    try {
      const pdf = new jsPDF();
      const pageWidth = pdf.internal.pageSize.width;
      const margin = 20;
      const maxLineWidth = pageWidth - 2 * margin;
      let currentY = 20;

      // Modern color scheme that complements Panoramica logo
      const colors = {
        primary: [0, 123, 255],      // Blue #007BFF
        accent: [255, 165, 0],       // Orange #FFA500
        lightBlue: [232, 244, 253],  // Light Blue #E8F4FD
        lightOrange: [255, 249, 230], // Light Orange #FFF9E6
        lightGray: [248, 249, 250],  // Light Gray #F8F9FA
        border: [224, 224, 224],     // Gray #E0E0E0
        text: [51, 51, 51],          // Dark Gray #333333
        textSecondary: [85, 85, 85]  // Medium Gray #555555
      };

      // Use REAL quote number and date from saved quote
      const quoteNumber = quote.quoteNumber; // Real server-generated quote number
      const quoteDate = new Date(quote.createdAt || new Date()).toLocaleDateString('es-CL', { 
        day: '2-digit',
        month: 'long', 
        year: 'numeric'
      });

      // Header section with modern design and logo space
      // Create rounded header container
      const [r1, g1, b1] = colors.lightBlue;
      pdf.setFillColor(r1, g1, b1);
      const [r2, g2, b2] = colors.primary;
      pdf.setDrawColor(r2, g2, b2);
      pdf.setLineWidth(0.5);
      pdf.roundedRect(margin, currentY, pageWidth - 2 * margin, 50, 8, 8, 'FD');
      
      // Logo space (left side) - Add Panoramica text placeholder
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      const [r3, g3, b3] = colors.primary;
      pdf.setTextColor(r3, g3, b3);
      pdf.text("PANORAMICA", margin + 10, currentY + 20);
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "normal");
      const [r3b, g3b, b3b] = colors.textSecondary;
      pdf.setTextColor(r3b, g3b, b3b);
      pdf.text("System", margin + 10, currentY + 32);
      
      // Quote title and info (right side)
      pdf.setFontSize(20);
      pdf.setFont("helvetica", "bold");
      const [r4, g4, b4] = colors.primary;
      pdf.setTextColor(r4, g4, b4);
      pdf.text("COTIZACIÓN", pageWidth - margin - 10, currentY + 15, { align: "right" });
      
      pdf.setFontSize(11);
      pdf.setFont("helvetica", "normal");
      const [r5, g5, b5] = colors.text;
      pdf.setTextColor(r5, g5, b5);
      pdf.text(`Fecha: ${quoteDate}`, pageWidth - margin - 10, currentY + 28, { align: "right" });
      pdf.text(`Cotización N°: ${quoteNumber}`, pageWidth - margin - 10, currentY + 40, { align: "right" });
      
      currentY += 70;

      // Client information section with rounded container
      const clientSectionHeight = 55;
      
      // Create rounded container for client info
      const [r6, g6, b6] = colors.lightGray;
      pdf.setFillColor(r6, g6, b6);
      const [r7, g7, b7] = colors.border;
      pdf.setDrawColor(r7, g7, b7);
      pdf.setLineWidth(0.5);
      pdf.roundedRect(margin, currentY, pageWidth - 2 * margin, clientSectionHeight, 6, 6, 'FD');
      
      // Section title with accent bar
      const [r8, g8, b8] = colors.accent;
      pdf.setFillColor(r8, g8, b8);
      pdf.roundedRect(margin + 10, currentY + 8, 3, 12, 1.5, 1.5, 'F');
      
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      const [r9, g9, b9] = colors.primary;
      pdf.setTextColor(r9, g9, b9);
      pdf.text("INFORMACIÓN DEL CLIENTE", margin + 20, currentY + 17);
      
      // Two-column layout for client info within container
      const leftColumn = margin + 15;
      const rightColumn = pageWidth / 2 + 5;
      
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      const [r10, g10, b10] = colors.text;
      pdf.setTextColor(r10, g10, b10);
      
      // Left column - Use real quote data
      let leftY = currentY + 30;
      if (quote.clientRut) {
        pdf.setFont("helvetica", "bold");
        pdf.text("RUT:", leftColumn, leftY);
        pdf.setFont("helvetica", "normal");
        pdf.text(quote.clientRut, leftColumn + 20, leftY);
        leftY += 8;
      }
      
      if (quote.clientEmail) {
        pdf.setFont("helvetica", "bold");
        pdf.text("Email:", leftColumn, leftY);
        pdf.setFont("helvetica", "normal");
        pdf.text(quote.clientEmail, leftColumn + 25, leftY);
        leftY += 8;
      }
      
      if (quote.clientAddress) {
        pdf.setFont("helvetica", "bold");
        pdf.text("Dirección:", leftColumn, leftY);
        pdf.setFont("helvetica", "normal");
        const addressText = pdf.splitTextToSize(quote.clientAddress, 65);
        pdf.text(addressText, leftColumn + 35, leftY);
        leftY += 8;
      }

      // Right column - Use real quote data
      let rightY = currentY + 30;
      pdf.setFont("helvetica", "bold");
      pdf.text("Cliente:", rightColumn, rightY);
      pdf.setFont("helvetica", "normal");
      const clientNameText = pdf.splitTextToSize(quote.clientName, 75);
      pdf.text(clientNameText, rightColumn + 25, rightY);
      rightY += 8;
      
      if (quote.clientPhone) {
        pdf.setFont("helvetica", "bold");
        pdf.text("Teléfono:", rightColumn, rightY);
        pdf.setFont("helvetica", "normal");
        pdf.text(quote.clientPhone, rightColumn + 30, rightY);
        rightY += 8;
      }
      
      currentY += clientSectionHeight + 15;

      // Observaciones section (if notes exist) - Use real quote data
      if (quote.notes && quote.notes.trim()) {
        const notesHeight = 40;
        
        // Create rounded container for notes
        const [r11, g11, b11] = colors.lightOrange;
        pdf.setFillColor(r11, g11, b11);
        const [r12, g12, b12] = colors.accent;
        pdf.setDrawColor(r12, g12, b12);
        pdf.setLineWidth(0.5);
        pdf.roundedRect(margin, currentY, pageWidth - 2 * margin, notesHeight, 6, 6, 'FD');
        
        // Section title with accent bar
        pdf.setFillColor(r12, g12, b12);
        pdf.roundedRect(margin + 10, currentY + 8, 3, 12, 1.5, 1.5, 'F');
        
        pdf.setFontSize(14);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(r12, g12, b12);
        pdf.text("OBSERVACIONES", margin + 20, currentY + 17);
        
        pdf.setFontSize(10);
        pdf.setFont("helvetica", "normal");
        const [r13, g13, b13] = colors.text;
        pdf.setTextColor(r13, g13, b13);
        const splitNotes = pdf.splitTextToSize(quote.notes, pageWidth - 4 * margin);
        pdf.text(splitNotes, margin + 15, currentY + 30);
        currentY += notesHeight + 15;
      }

      // Product details section with modern table design
      const tableHeaderHeight = 25;
      const tableItemHeight = items.length * 20 + 10;
      const totalTableHeight = tableHeaderHeight + tableItemHeight;
      
      // Create rounded container for products table
      const [r14, g14, b14] = colors.lightGray;
      pdf.setFillColor(r14, g14, b14);
      const [r15, g15, b15] = colors.border;
      pdf.setDrawColor(r15, g15, b15);
      pdf.setLineWidth(0.5);
      pdf.roundedRect(margin, currentY, pageWidth - 2 * margin, totalTableHeight, 6, 6, 'FD');
      
      // Section title with accent bar
      const [r16, g16, b16] = colors.primary;
      pdf.setFillColor(r16, g16, b16);
      pdf.roundedRect(margin + 10, currentY + 8, 3, 12, 1.5, 1.5, 'F');
      
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(r16, g16, b16);
      pdf.text("DETALLE DE PRODUCTOS", margin + 20, currentY + 17);
      
      currentY += 30;

      // Modern table header design within container
      const colWidths = {
        product: 85,
        unit: 20,
        quantity: 20,
        price: 35,
        total: 40
      };

      // Create header background within container
      const [r17, g17, b17] = colors.primary;
      pdf.setFillColor(r17, g17, b17);
      pdf.roundedRect(margin + 10, currentY, pageWidth - 2 * margin - 20, 15, 4, 4, 'F');
      
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(255, 255, 255); // White text on blue background
      
      const headerY = currentY + 10;
      pdf.text("Producto", margin + 15, headerY);
      pdf.text("Unidad", margin + 15 + colWidths.product, headerY);
      pdf.text("Cant.", margin + 15 + colWidths.product + colWidths.unit, headerY);
      pdf.text("Precio", margin + 15 + colWidths.product + colWidths.unit + colWidths.quantity, headerY);
      pdf.text("Total", margin + 15 + colWidths.product + colWidths.unit + colWidths.quantity + colWidths.price, headerY);
      
      currentY += 25;

      // Table content - Use real saved item data
      pdf.setFont("helvetica", "normal");
      const [r18, g18, b18] = colors.text;
      pdf.setTextColor(r18, g18, b18);
      
      items.forEach((item, index) => {
        // Alternate row background for better readability
        if (index % 2 === 1) {
          pdf.setFillColor(250, 250, 250);
          pdf.rect(margin + 10, currentY - 2, pageWidth - 2 * margin - 20, 16, 'F');
        }
        
        // Product name
        pdf.setFont("helvetica", "bold");
        pdf.text(item.productName, margin + 15, currentY + 5);
        
        // SKU (if exists)
        if (item.productCode || item.customSku) {
          pdf.setFontSize(8);
          pdf.setFont("helvetica", "normal");
          const [r19, g19, b19] = colors.textSecondary;
          pdf.setTextColor(r19, g19, b19);
          pdf.text(`SKU: ${item.productCode || item.customSku}`, margin + 15, currentY + 12);
          pdf.setFontSize(10);
          pdf.setTextColor(r18, g18, b18);
        }
        
        // Use REAL product unit data instead of hardcoded "UN"
        const productUnit = item.productUnit || "UN";
        pdf.setFont("helvetica", "normal");
        pdf.text(productUnit, margin + 15 + colWidths.product, currentY + 5);
        pdf.text(parseFloat(item.quantity).toString(), margin + 15 + colWidths.product + colWidths.unit, currentY + 5);
        
        // Format price with dots as thousands separator
        const unitPrice = parseFloat(item.unitPrice);
        const totalPrice = parseFloat(item.totalPrice);
        const formattedPrice = `$${Math.round(unitPrice).toLocaleString('es-CL').replace(/,/g, '.')}`;
        const formattedTotal = `$${Math.round(totalPrice).toLocaleString('es-CL').replace(/,/g, '.')}`;
        
        pdf.text(formattedPrice, margin + 15 + colWidths.product + colWidths.unit + colWidths.quantity, currentY + 5);
        
        // Highlight total price
        pdf.setFont("helvetica", "bold");
        pdf.text(formattedTotal, margin + 15 + colWidths.product + colWidths.unit + colWidths.quantity + colWidths.price, currentY + 5);
        pdf.setFont("helvetica", "normal");
        
        currentY += 16;
      });

      currentY += 25;

      // Financial summary with modern rounded container - Use real quote totals
      const subtotal = parseFloat(quote.subtotal || "0");
      const subtotalNeto = subtotal; // Same as subtotal in this case  
      const tax = parseFloat(quote.taxAmount || "0");
      const total = parseFloat(quote.total || "0");

      const summaryHeight = 70;
      const summaryWidth = 100;
      const summaryX = pageWidth - margin - summaryWidth;
      
      // Create rounded container for financial summary with accent color
      const [r20, g20, b20] = colors.lightBlue;
      pdf.setFillColor(r20, g20, b20);
      const [r21, g21, b21] = colors.primary;
      pdf.setDrawColor(r21, g21, b21);
      pdf.setLineWidth(1);
      pdf.roundedRect(summaryX, currentY, summaryWidth, summaryHeight, 8, 8, 'FD');

      // Inner content positioning
      const labelX = summaryX + 10;
      const valueX = summaryX + summaryWidth - 10;
      let summaryY = currentY + 15;

      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      const [r22, g22, b22] = colors.text;
      pdf.setTextColor(r22, g22, b22);
      
      pdf.text("Subtotal:", labelX, summaryY);
      pdf.text(`$${Math.round(subtotal).toLocaleString('es-CL').replace(/,/g, '.')}`, valueX, summaryY, { align: "right" });
      summaryY += 8;

      pdf.text("Subtotal neto:", labelX, summaryY);
      pdf.text(`$${Math.round(subtotalNeto).toLocaleString('es-CL').replace(/,/g, '.')}`, valueX, summaryY, { align: "right" });
      summaryY += 8;

      pdf.text("IVA (19%):", labelX, summaryY);
      pdf.text(`$${Math.round(tax).toLocaleString('es-CL').replace(/,/g, '.')}`, valueX, summaryY, { align: "right" });
      summaryY += 10;

      // Total with accent styling
      pdf.setFontSize(12);
      pdf.setFont("helvetica", "bold");
      const [r23, g23, b23] = colors.primary;
      pdf.setTextColor(r23, g23, b23);
      pdf.text("TOTAL FINAL:", labelX, summaryY);
      pdf.text(`$${Math.round(total).toLocaleString('es-CL').replace(/,/g, '.')}`, valueX, summaryY, { align: "right" });
      
      currentY += summaryHeight + 25;

      // Terms and conditions section with modern rounded container
      const termsHeight = 55;
      
      // Create rounded container for terms
      const [r24, g24, b24] = colors.lightGray;
      pdf.setFillColor(r24, g24, b24);
      const [r25, g25, b25] = colors.border;
      pdf.setDrawColor(r25, g25, b25);
      pdf.setLineWidth(0.5);
      pdf.roundedRect(margin, currentY, pageWidth - 2 * margin, termsHeight, 6, 6, 'FD');
      
      // Section title with accent bar
      const [r26, g26, b26] = colors.accent;
      pdf.setFillColor(r26, g26, b26);
      pdf.roundedRect(margin + 10, currentY + 8, 3, 12, 1.5, 1.5, 'F');
      
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(r26, g26, b26);
      pdf.text("TÉRMINOS Y CONDICIONES", margin + 20, currentY + 17);

      pdf.setFontSize(9);
      pdf.setFont("helvetica", "normal");
      const [r27, g27, b27] = colors.text;
      pdf.setTextColor(r27, g27, b27);
      
      const terms = [
        "• Precios válidos por 7 días hábiles desde la emisión de esta cotización.",
        "• Todos los precios están expresados en pesos chilenos (CLP) e incluyen IVA.",
        "• Los productos están sujetos a disponibilidad de stock.",
        "• Condiciones de pago: según acuerdo comercial."
      ];

      let termsY = currentY + 28;
      terms.forEach(term => {
        pdf.text(term, margin + 15, termsY);
        termsY += 6;
      });
      
      currentY += termsHeight + 15;

      // Payment information section with modern rounded container
      const paymentHeight = 65;
      
      // Create rounded container for payment info with accent border
      const [r28, g28, b28] = colors.lightOrange;
      pdf.setFillColor(r28, g28, b28);
      const [r29, g29, b29] = colors.accent;
      pdf.setDrawColor(r29, g29, b29);
      pdf.setLineWidth(1);
      pdf.roundedRect(margin, currentY, pageWidth - 2 * margin, paymentHeight, 8, 8, 'FD');
      
      // Section title with accent bar
      pdf.setFillColor(r29, g29, b29);
      pdf.roundedRect(margin + 10, currentY + 8, 3, 12, 1.5, 1.5, 'F');
      
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(r29, g29, b29);
      pdf.text("INFORMACIÓN DE PAGOS", margin + 20, currentY + 17);

      pdf.setFontSize(9);
      pdf.setFont("helvetica", "normal");
      const [r30, g30, b30] = colors.text;
      pdf.setTextColor(r30, g30, b30);
      
      let paymentY = currentY + 30;
      
      // Payment link with modern styling
      pdf.setFont("helvetica", "bold");
      pdf.text("Link de pagos con tarjetas:", margin + 15, paymentY);
      pdf.setFont("helvetica", "normal");
      const [r31, g31, b31] = colors.primary;
      pdf.setTextColor(r31, g31, b31);
      pdf.text("https://micrositios.getnet.cl/pinturaspanoramica", margin + 70, paymentY);
      paymentY += 10;

      // Bank transfer info - split into two columns
      pdf.setTextColor(r30, g30, b30);
      const leftPaymentX = margin + 15;
      const rightPaymentX = pageWidth / 2 + 10;
      
      pdf.setFont("helvetica", "bold");
      pdf.text("Transferencia Bancaria:", leftPaymentX, paymentY);
      paymentY += 8;
      
      pdf.setFont("helvetica", "normal");
      pdf.text("Pintureria Panoramica Limitada", leftPaymentX, paymentY);
      pdf.text("RUT: 78.652.260-9", rightPaymentX, paymentY);
      paymentY += 6;
      
      pdf.text("Cuenta Corriente Banco Santander: 2592916-0", leftPaymentX, paymentY);
      paymentY += 6;
      
      pdf.text("Email: contacto@pinturaspanoramica.cl", leftPaymentX, paymentY);
      
      currentY += paymentHeight + 10;

      // Save the PDF with real quote number and client name
      pdf.save(`Cotizacion_${quote.quoteNumber}_${quote.clientName.replace(/\s+/g, '_')}.pdf`);
      
      // Don't show PDF-specific toast here as the main function shows a combined success message

    } catch (error) {
      console.error('Error generating PDF:', error);
      throw error; // Re-throw to be handled by the main function
    }
  };

  // Legacy PDF download function (kept for compatibility, but now just calls the integrated function)
  const downloadPDF = () => {
    saveQuoteAndDownloadPDF();
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
                    <div className="space-y-1 flex-1">
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
                    <div className="flex items-center gap-2">
                      <Badge variant={getStatusBadgeVariant(order.status || 'draft')}>
                        {getStatusLabel(order.status || 'draft')}
                      </Badge>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 w-8 p-0"
                            data-testid={`button-actions-${order.id}`}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => handleViewOrder(order.id)}
                            data-testid={`action-view-${order.id}`}
                          >
                            <Eye className="mr-2 h-4 w-4" />
                            Ver detalles
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleEditOrder(order.id)}
                            data-testid={`action-edit-${order.id}`}
                          >
                            <Edit className="mr-2 h-4 w-4" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleDeleteOrder(order.id)}
                            className="text-destructive"
                            data-testid={`action-delete-${order.id}`}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
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
                      onClick={downloadPDF}
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
    </>
  );
}