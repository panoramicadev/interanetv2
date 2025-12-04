import { useState, useMemo, useRef, useCallback } from 'react';
import { useRoute } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
  Phone, 
  Mail, 
  ShoppingCart, 
  Plus, 
  Minus, 
  Trash2, 
  Send, 
  Search,
  Package,
  CheckCircle2,
  Loader2,
  Building,
  Palette,
  Layers,
  Store,
  User,
  X
} from 'lucide-react';
import { SiWhatsapp } from 'react-icons/si';
import { apiRequest } from '@/lib/queryClient';

type ProductFormat = {
  id: string;
  codigo: string;
  unidad: string;
  precio: number;
  imagenUrl: string | null;
};

type ProductColor = {
  color: string;
  formats: ProductFormat[];
};

type ProductFamily = {
  family: string;
  imagenUrl: string | null;
  categoria: string | null;
  descripcion: string | null;
  colors: ProductColor[];
};

type SalespersonProfile = {
  id: string;
  salespersonName: string;
  publicSlug: string;
  profileImageUrl?: string | null;
  publicPhone?: string | null;
  publicEmail?: string | null;
  bio?: string | null;
  catalogEnabled: boolean;
};

type CartItem = {
  id: string;
  codigo: string;
  producto: string;
  unidad: string;
  precio: number;
  imagenUrl: string | null;
  quantity: number;
};

const quoteFormSchema = z.object({
  visitorName: z.string().min(1, 'Nombre es requerido'),
  visitorEmail: z.string().email('Email inválido'),
  visitorPhone: z.string().optional(),
  visitorCompany: z.string().optional(),
  message: z.string().optional(),
});

type QuoteFormData = z.infer<typeof quoteFormSchema>;

export default function CatalogoPublico() {
  const [, params] = useRoute('/catalogo/:slug');
  const slug = params?.slug || '';
  const { toast } = useToast();
  
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isQuoteDialogOpen, setIsQuoteDialogOpen] = useState(false);
  const [isSuccessDialogOpen, setIsSuccessDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedColors, setSelectedColors] = useState<Record<string, string>>({});
  const [selectedFormats, setSelectedFormats] = useState<Record<string, string>>({});
  const [flyingProduct, setFlyingProduct] = useState<{ 
    id: string; 
    imagenUrl: string | null; 
    startX: number; 
    startY: number;
  } | null>(null);
  const cartButtonRef = useRef<HTMLButtonElement>(null);
  
  const [isClientDialogOpen, setIsClientDialogOpen] = useState(false);
  const [clientBusinessName, setClientBusinessName] = useState('');
  const [tempRut, setTempRut] = useState('');
  const [isSearchingClient, setIsSearchingClient] = useState(false);
  const [rutError, setRutError] = useState('');
  
  const form = useForm<QuoteFormData>({
    resolver: zodResolver(quoteFormSchema),
    defaultValues: {
      visitorName: '',
      visitorEmail: '',
      visitorPhone: '',
      visitorCompany: '',
      message: '',
    },
  });

  const { data, isLoading, error } = useQuery<{
    salesperson: SalespersonProfile;
    products: ProductFamily[];
    isGrouped: boolean;
  }>({
    queryKey: ['/api/public/catalogos', slug, 'grouped'],
    queryFn: async () => {
      const response = await fetch(`/api/public/catalogos/${slug}?grouped=true`);
      if (!response.ok) throw new Error('Failed to fetch catalog');
      return response.json();
    },
    enabled: !!slug,
  });

  const submitQuoteMutation = useMutation({
    mutationFn: async (quoteData: QuoteFormData) => {
      const items = cart.map(item => ({
        productId: item.id,
        productName: item.producto,
        sku: item.codigo,
        quantity: Number(item.quantity),
        unitPrice: Number(item.precio),
      }));
      
      return await apiRequest(`/api/public/catalogos/${slug}/cotizacion`, {
        method: 'POST',
        data: {
          ...quoteData,
          items,
        },
      });
    },
    onSuccess: () => {
      setIsQuoteDialogOpen(false);
      setIsSuccessDialogOpen(true);
      setCart([]);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'No se pudo enviar la solicitud',
      });
    },
  });

  const filteredFamilies = useMemo(() => {
    if (!data?.products) return [];
    
    if (!searchTerm) return data.products;
    
    return data.products.filter(family => 
      family.family.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [data?.products, searchTerm]);

  const getSelectedProduct = useCallback((family: ProductFamily): ProductFormat | null => {
    const selectedColor = selectedColors[family.family];
    const selectedFormat = selectedFormats[family.family];
    
    if (!selectedColor || !selectedFormat) return null;
    
    const colorData = family.colors.find(c => c.color === selectedColor);
    if (!colorData) return null;
    
    return colorData.formats.find(f => f.unidad === selectedFormat) || null;
  }, [selectedColors, selectedFormats]);

  const addToCart = useCallback((family: ProductFamily, product: ProductFormat, event?: React.MouseEvent) => {
    if (event && cartButtonRef.current) {
      const buttonRect = event.currentTarget.getBoundingClientRect();
      const startX = buttonRect.left + buttonRect.width / 2;
      const startY = buttonRect.top;
      
      setFlyingProduct({
        id: product.id,
        imagenUrl: product.imagenUrl,
        startX,
        startY,
      });
      
      setTimeout(() => setFlyingProduct(null), 600);
    }
    
    const selectedColor = selectedColors[family.family] || '';
    const productName = `${family.family} ${selectedColor}`.trim();
    
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { 
        id: product.id,
        codigo: product.codigo,
        producto: productName,
        unidad: product.unidad,
        precio: product.precio,
        imagenUrl: product.imagenUrl,
        quantity: 1 
      }];
    });
    
    toast({
      title: 'Producto agregado',
      description: `${productName} - ${product.unidad} agregado al carrito`,
    });
  }, [selectedColors, toast]);

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.id !== productId));
  };

  const updateQuantity = (productId: string, quantity: number | string) => {
    const numQuantity = typeof quantity === 'string' ? parseInt(quantity, 10) : quantity;
    if (isNaN(numQuantity) || numQuantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart(prev =>
      prev.map(item =>
        item.id === productId ? { ...item, quantity: numQuantity } : item
      )
    );
  };

  const cartTotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.precio * item.quantity, 0);
  }, [cart]);

  const cartItemCount = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  }, [cart]);

  const onSubmitQuote = (formData: QuoteFormData) => {
    submitQuoteMutation.mutate(formData);
  };

  const getWhatsAppLink = (phone: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    return `https://wa.me/${cleanPhone}`;
  };

  const handleColorChange = (familyName: string, color: string) => {
    setSelectedColors(prev => ({ ...prev, [familyName]: color }));
    setSelectedFormats(prev => {
      const newFormats = { ...prev };
      delete newFormats[familyName];
      return newFormats;
    });
  };

  const handleFormatChange = (familyName: string, format: string) => {
    setSelectedFormats(prev => ({ ...prev, [familyName]: format }));
  };

  const getAvailableFormats = (family: ProductFamily): ProductFormat[] => {
    const selectedColor = selectedColors[family.family];
    if (!selectedColor) return [];
    
    const colorData = family.colors.find(c => c.color === selectedColor);
    return colorData?.formats || [];
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-400 mx-auto mb-4"></div>
          <p className="text-slate-400">Cargando catálogo...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
        <Card className="max-w-md w-full mx-4 bg-slate-800 border-slate-700">
          <CardContent className="pt-6 text-center">
            <Package className="h-16 w-16 mx-auto mb-4 text-slate-500" />
            <h2 className="text-xl font-semibold mb-2 text-white">Catálogo no encontrado</h2>
            <p className="text-slate-400">
              El catálogo que buscas no existe o no está disponible.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { salesperson, products } = data;

  const handleClientConfirm = async () => {
    if (!tempRut.trim()) return;
    
    setIsSearchingClient(true);
    setRutError('');
    
    try {
      const response = await fetch(`/api/public/clients/search-by-rut?rut=${encodeURIComponent(tempRut.trim())}`);
      const result = await response.json();
      
      if (response.ok && result.found) {
        setClientBusinessName(result.clientName);
        setIsClientDialogOpen(false);
        setTempRut('');
      } else {
        setRutError(result.message || 'Cliente no encontrado. Verifica el RUT ingresado.');
      }
    } catch (error) {
      setRutError('Error al buscar cliente. Intenta nuevamente.');
    } finally {
      setIsSearchingClient(false);
    }
  };

  const handleClearClient = () => {
    setClientBusinessName('');
    setRutError('');
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Client Identification Banner */}
      {!clientBusinessName && (
        <div 
          className="bg-gradient-to-r from-amber-500 to-orange-500 text-white cursor-pointer hover:from-amber-600 hover:to-orange-600 transition-all"
          onClick={() => setIsClientDialogOpen(true)}
          data-testid="banner-client-question"
        >
          <div className="container mx-auto px-4 py-2 flex items-center justify-center gap-2">
            <Store className="w-4 h-4" />
            <span className="text-sm font-medium">¿Eres cliente? Haz clic aquí para identificarte</span>
          </div>
        </div>
      )}

      {/* Client Identification Dialog */}
      <Dialog open={isClientDialogOpen} onOpenChange={(open) => {
        setIsClientDialogOpen(open);
        if (!open) {
          setTempRut('');
          setRutError('');
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Store className="w-5 h-5 text-amber-500" />
              Identificación de Cliente
            </DialogTitle>
            <DialogDescription>
              Ingresa el RUT de tu comercio para una atención personalizada.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label htmlFor="clientRut" className="text-sm font-medium">
                RUT del Comercio
              </label>
              <Input
                id="clientRut"
                placeholder="Ej: 76.123.456-7"
                value={tempRut}
                onChange={(e) => {
                  setTempRut(e.target.value);
                  setRutError('');
                }}
                onKeyDown={(e) => e.key === 'Enter' && !isSearchingClient && handleClientConfirm()}
                data-testid="input-client-rut"
                disabled={isSearchingClient}
              />
              {rutError && (
                <p className="text-sm text-red-500" data-testid="text-rut-error">{rutError}</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsClientDialogOpen(false);
                setTempRut('');
                setRutError('');
              }}
              disabled={isSearchingClient}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleClientConfirm}
              disabled={!tempRut.trim() || isSearchingClient}
              className="bg-amber-500 hover:bg-amber-600 text-white"
              data-testid="button-confirm-client"
            >
              {isSearchingClient ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Buscando...
                </>
              ) : (
                'Confirmar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Hero Banner */}
      <header className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 overflow-hidden">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-1/2 -right-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-1/2 -left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"></div>
        </div>
        
        <div className="relative container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-shrink-0">
              <img
                src="/panoramica-icon.png"
                alt="Pinturas Panorámica"
                className="w-12 h-12 md:w-16 md:h-16 object-contain"
                data-testid="company-logo"
              />
            </div>
            
            <div className="flex-1 min-w-0 overflow-hidden">
              <div className="flex items-center gap-2">
                <h1 className="text-base md:text-xl lg:text-2xl font-bold text-white truncate" data-testid="salesperson-name">
                  {clientBusinessName || salesperson.salespersonName}
                </h1>
                {clientBusinessName && (
                  <button 
                    onClick={handleClearClient}
                    className="p-1 hover:bg-white/20 rounded-full transition-colors flex-shrink-0"
                    title="Cerrar sesión"
                    data-testid="button-clear-client"
                  >
                    <X className="w-4 h-4 text-white/70 hover:text-white" />
                  </button>
                )}
              </div>
              
              {clientBusinessName ? (
                <p className="text-sm text-amber-300 mt-1" data-testid="attended-by">
                  Atendido por {salesperson.salespersonName}
                </p>
              ) : salesperson.bio && (
                <p className="hidden md:block text-sm text-slate-300 mt-1 line-clamp-2" data-testid="salesperson-bio">
                  {salesperson.bio}
                </p>
              )}
              
              <div className="flex gap-1 mt-2 overflow-x-auto pb-1 hide-scrollbar" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                {salesperson.publicPhone && (
                  <a 
                    href={getWhatsAppLink(salesperson.publicPhone)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 bg-green-500 hover:bg-green-600 text-white px-2 py-1 rounded-full text-xs font-medium transition-all flex-shrink-0"
                    data-testid="button-whatsapp"
                  >
                    <SiWhatsapp className="w-3.5 h-3.5" />
                    WhatsApp
                  </a>
                )}
                
                {salesperson.publicPhone && (
                  <a 
                    href={`tel:${salesperson.publicPhone}`}
                    className="inline-flex items-center gap-1 bg-slate-700/80 hover:bg-slate-600 text-white px-2 py-1 rounded-full text-xs font-medium transition-all border border-slate-600 flex-shrink-0"
                    data-testid="salesperson-phone"
                  >
                    <Phone className="w-3 h-3" />
                    Teléfono
                  </a>
                )}
                
                {salesperson.publicEmail && (
                  <a 
                    href={`mailto:${salesperson.publicEmail}`}
                    className="inline-flex items-center gap-1 bg-slate-700/80 hover:bg-slate-600 text-white px-2 py-1 rounded-full text-xs font-medium transition-all border border-slate-600 flex-shrink-0"
                    data-testid="salesperson-email"
                  >
                    <Mail className="w-3 h-3" />
                    Correo
                  </a>
                )}
              </div>
            </div>
            
            <div className="flex-shrink-0 ml-2 relative">
              <Button
                ref={cartButtonRef}
                onClick={() => setIsQuoteDialogOpen(true)}
                disabled={cart.length === 0}
                size="sm"
                className="bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold shadow-md h-9 w-9 p-0 md:w-auto md:px-3 md:gap-1"
                data-testid="button-open-cart"
              >
                <ShoppingCart className="h-4 w-4" />
                <span className="hidden md:inline">Cotizar</span>
              </Button>
              {cartItemCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-white text-amber-600 text-xs h-5 min-w-5 px-1 rounded-full flex items-center justify-center font-semibold shadow-sm">
                  {cartItemCount}
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Flying Product Animation */}
      {flyingProduct && cartButtonRef.current && (
        <div
          className="fixed z-[100] pointer-events-none"
          style={{
            left: flyingProduct.startX,
            top: flyingProduct.startY,
            animation: 'flyToCart 0.5s ease-in forwards',
            '--cart-x': `${cartButtonRef.current.getBoundingClientRect().left + cartButtonRef.current.getBoundingClientRect().width / 2 - flyingProduct.startX}px`,
            '--cart-y': `${cartButtonRef.current.getBoundingClientRect().top + cartButtonRef.current.getBoundingClientRect().height / 2 - flyingProduct.startY}px`,
          } as React.CSSProperties}
        >
          <div className="w-12 h-12 rounded-lg bg-white shadow-xl border-2 border-amber-400 overflow-hidden transform -translate-x-1/2 -translate-y-1/2">
            {flyingProduct.imagenUrl ? (
              <img src={flyingProduct.imagenUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-slate-100">
                <Package className="h-6 w-6 text-amber-500" />
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes flyToCart {
          0% { transform: translate(0, 0) scale(1); opacity: 1; }
          50% { transform: translate(calc(var(--cart-x) * 0.5), calc(var(--cart-y) * 0.5 - 30px)) scale(0.8); opacity: 0.9; }
          100% { transform: translate(var(--cart-x), var(--cart-y)) scale(0.3); opacity: 0; }
        }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>

      {/* Search */}
      <div className="sticky top-0 z-40 bg-white border-b shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar productos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              data-testid="input-search"
            />
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            {filteredFamilies.length} producto{filteredFamilies.length !== 1 ? 's' : ''} disponible{filteredFamilies.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Products Grid - Grouped View */}
      <div className="container mx-auto px-4 py-6">
        {filteredFamilies.length === 0 ? (
          <div className="text-center py-12">
            <Package className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">No se encontraron productos</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredFamilies.map(family => {
              const selectedColor = selectedColors[family.family];
              const selectedFormat = selectedFormats[family.family];
              const availableFormats = getAvailableFormats(family);
              const selectedProduct = getSelectedProduct(family);
              const cartItem = selectedProduct ? cart.find(item => item.id === selectedProduct.id) : null;
              const displayImage = selectedProduct?.imagenUrl || family.imagenUrl;
              
              return (
                <Card 
                  key={family.family} 
                  className="overflow-hidden hover:shadow-lg transition-shadow"
                  data-testid={`product-family-${family.family}`}
                >
                  {/* Product Image */}
                  <div className="aspect-square relative bg-slate-100">
                    {displayImage ? (
                      <img
                        src={displayImage}
                        alt={family.family}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="h-16 w-16 text-muted-foreground/30" />
                      </div>
                    )}
                    
                    {family.categoria && (
                      <Badge variant="secondary" className="absolute top-2 left-2 text-xs">
                        {family.categoria}
                      </Badge>
                    )}
                    
                    {family.colors.length > 1 && (
                      <Badge variant="outline" className="absolute top-2 right-2 text-xs bg-white/90">
                        {family.colors.length} colores
                      </Badge>
                    )}
                  </div>
                  
                  <CardContent className="p-4 space-y-3">
                    {/* Family Name */}
                    <h3 className="font-semibold text-base line-clamp-2" title={family.family}>
                      {family.family}
                    </h3>
                    
                    {/* Color Selector */}
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground flex items-center gap-1">
                        <Palette className="h-3 w-3" />
                        Color
                      </label>
                      <Select
                        value={selectedColor || ''}
                        onValueChange={(value) => handleColorChange(family.family, value)}
                      >
                        <SelectTrigger className="h-9" data-testid={`select-color-${family.family}`}>
                          <SelectValue placeholder="Seleccionar color" />
                        </SelectTrigger>
                        <SelectContent>
                          {family.colors.map(colorOption => (
                            <SelectItem key={colorOption.color} value={colorOption.color}>
                              {colorOption.color}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {/* Format Selector */}
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground flex items-center gap-1">
                        <Layers className="h-3 w-3" />
                        Formato
                      </label>
                      <Select
                        value={selectedFormat || ''}
                        onValueChange={(value) => handleFormatChange(family.family, value)}
                        disabled={!selectedColor}
                      >
                        <SelectTrigger className="h-9" data-testid={`select-format-${family.family}`}>
                          <SelectValue placeholder={selectedColor ? "Seleccionar formato" : "Primero selecciona color"} />
                        </SelectTrigger>
                        <SelectContent>
                          {availableFormats.map(format => (
                            <SelectItem key={format.unidad} value={format.unidad}>
                              {format.unidad} - ${format.precio.toLocaleString('es-CL')}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {/* Price Display */}
                    {selectedProduct && (
                      <div className="flex items-center justify-between pt-2 border-t">
                        <div>
                          <span className="text-lg font-bold text-primary">
                            ${selectedProduct.precio.toLocaleString('es-CL')}
                          </span>
                          <span className="text-xs text-muted-foreground ml-1">
                            /{selectedProduct.unidad}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          SKU: {selectedProduct.codigo}
                        </span>
                      </div>
                    )}
                    
                    {/* Add to cart / Quantity controls */}
                    {selectedProduct && (
                      cartItem ? (
                        <div className="flex items-center justify-between">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-9 w-9"
                            onClick={() => updateQuantity(selectedProduct.id, cartItem.quantity - 1)}
                            data-testid={`button-decrease-${selectedProduct.id}`}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <span className="font-semibold text-lg">{cartItem.quantity}</span>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-9 w-9"
                            onClick={() => updateQuantity(selectedProduct.id, cartItem.quantity + 1)}
                            data-testid={`button-increase-${selectedProduct.id}`}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <Button
                          className="w-full"
                          onClick={(e) => addToCart(family, selectedProduct, e)}
                          data-testid={`button-add-${family.family}`}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Agregar al carrito
                        </Button>
                      )
                    )}
                    
                    {!selectedProduct && (
                      <Button className="w-full" disabled>
                        Selecciona color y formato
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Quote Dialog */}
      <Dialog open={isQuoteDialogOpen} onOpenChange={setIsQuoteDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Solicitar Cotización
            </DialogTitle>
            <DialogDescription>
              Completa tus datos y te contactaremos con la cotización
            </DialogDescription>
          </DialogHeader>
          
          {/* Cart Summary */}
          <div className="space-y-3 max-h-48 overflow-y-auto">
            {cart.map(item => (
              <div key={item.id} className="flex items-center gap-3 p-2 bg-muted rounded-lg">
                <div className="w-12 h-12 rounded overflow-hidden bg-slate-100 flex-shrink-0">
                  {item.imagenUrl ? (
                    <img src={item.imagenUrl} alt={item.producto} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{item.producto}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.unidad} x {item.quantity}
                  </p>
                </div>
                
                <div className="text-right flex-shrink-0">
                  <p className="font-semibold">
                    ${(item.precio * item.quantity).toLocaleString('es-CL')}
                  </p>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => removeFromCart(item.id)}
                    data-testid={`button-remove-${item.id}`}
                  >
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
          
          <div className="flex justify-between items-center py-2 border-t border-b">
            <span className="font-medium">Total:</span>
            <span className="text-xl font-bold text-primary">
              ${cartTotal.toLocaleString('es-CL')}
            </span>
          </div>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmitQuote)} className="space-y-4">
              <FormField
                control={form.control}
                name="visitorName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre completo *</FormLabel>
                    <FormControl>
                      <Input placeholder="Tu nombre" {...field} data-testid="input-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="visitorEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Correo electrónico *</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="tu@email.com" {...field} data-testid="input-email" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="visitorPhone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Teléfono</FormLabel>
                      <FormControl>
                        <Input placeholder="+56 9 1234 5678" {...field} data-testid="input-phone" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="visitorCompany"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Empresa</FormLabel>
                      <FormControl>
                        <Input placeholder="Nombre de empresa" {...field} data-testid="input-company" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={form.control}
                name="message"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mensaje adicional</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="¿Algún comentario o pregunta?"
                        className="resize-none"
                        rows={3}
                        {...field}
                        data-testid="input-message"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsQuoteDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={submitQuoteMutation.isPending}
                  data-testid="button-submit-quote"
                >
                  {submitQuoteMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Enviar Solicitud
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Success Dialog */}
      <Dialog open={isSuccessDialogOpen} onOpenChange={setIsSuccessDialogOpen}>
        <DialogContent className="max-w-sm">
          <div className="text-center py-6">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <DialogTitle className="mb-2">¡Solicitud Enviada!</DialogTitle>
            <DialogDescription>
              Hemos recibido tu solicitud de cotización. {salesperson.salespersonName} se pondrá en contacto contigo pronto.
            </DialogDescription>
          </div>
          <DialogFooter>
            <Button
              className="w-full"
              onClick={() => setIsSuccessDialogOpen(false)}
              data-testid="button-close-success"
            >
              Continuar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
