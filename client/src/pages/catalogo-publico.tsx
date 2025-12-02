import { useState, useMemo } from 'react';
import { useRoute } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
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
import { Textarea } from '@/components/ui/textarea';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
  User, 
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
  Building
} from 'lucide-react';
import { SiWhatsapp } from 'react-icons/si';
import { apiRequest } from '@/lib/queryClient';

type CatalogProduct = {
  id: string;
  codigo: string;
  producto: string;
  unidad?: string | null;
  precio: number;
  categoria?: string | null;
  descripcion?: string | null;
  imagenUrl?: string | null;
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

type CartItem = CatalogProduct & { quantity: number };

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
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  
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
    products: CatalogProduct[];
  }>({
    queryKey: ['/api/public/catalogos', slug],
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

  const categories = useMemo(() => {
    if (!data?.products) return [];
    const cats = new Set(data.products.map(p => p.categoria).filter(Boolean));
    return Array.from(cats) as string[];
  }, [data?.products]);

  const filteredProducts = useMemo(() => {
    if (!data?.products) return [];
    
    return data.products.filter(product => {
      const matchesSearch = !searchTerm || 
        product.producto.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.codigo.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesCategory = !selectedCategory || product.categoria === selectedCategory;
      
      return matchesSearch && matchesCategory;
    });
  }, [data?.products, searchTerm, selectedCategory]);

  const addToCart = (product: CatalogProduct) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
    
    toast({
      title: 'Producto agregado',
      description: `${product.producto} agregado al carrito`,
    });
  };

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

  const onSubmitQuote = (data: QuoteFormData) => {
    submitQuoteMutation.mutate(data);
  };

  const getWhatsAppLink = (phone: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    return `https://wa.me/${cleanPhone}`;
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

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Hero Banner */}
      <header className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-1/2 -right-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-1/2 -left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"></div>
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-amber-500/5 via-transparent to-transparent"></div>
        </div>
        
        <div className="relative container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            {/* Company Logo */}
            <div className="relative flex-shrink-0">
              <img
                src="/panoramica-icon.png"
                alt="Pinturas Panorámica"
                className="w-12 h-12 md:w-16 md:h-16 object-contain"
                data-testid="company-logo"
              />
            </div>
            
            {/* Info Section */}
            <div className="flex-1 min-w-0">
              {/* Name */}
              <h1 className="text-base md:text-xl lg:text-2xl font-bold text-white truncate" data-testid="salesperson-name">
                {salesperson.salespersonName}
              </h1>
              
              {/* Bio - hidden on mobile, shown on larger screens */}
              {salesperson.bio && (
                <p className="hidden md:block text-sm text-slate-300 mt-1 line-clamp-2" data-testid="salesperson-bio">
                  {salesperson.bio}
                </p>
              )}
              
              {/* Contact Buttons */}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {salesperson.publicPhone && (
                  <a 
                    href={getWhatsAppLink(salesperson.publicPhone)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 bg-green-500 hover:bg-green-600 text-white px-2.5 py-1 rounded-full text-xs font-medium transition-all"
                    data-testid="button-whatsapp"
                  >
                    <SiWhatsapp className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">WhatsApp</span>
                  </a>
                )}
                
                {salesperson.publicPhone && (
                  <a 
                    href={`tel:${salesperson.publicPhone}`}
                    className="inline-flex items-center gap-1 bg-slate-700/80 hover:bg-slate-600 text-white px-2.5 py-1 rounded-full text-xs font-medium transition-all border border-slate-600"
                    data-testid="salesperson-phone"
                  >
                    <Phone className="w-3 h-3" />
                    <span className="hidden sm:inline">{salesperson.publicPhone}</span>
                    <span className="sm:hidden">Llamar</span>
                  </a>
                )}
                
                {salesperson.publicEmail && (
                  <a 
                    href={`mailto:${salesperson.publicEmail}`}
                    className="inline-flex items-center gap-1 bg-slate-700/80 hover:bg-slate-600 text-white px-2.5 py-1 rounded-full text-xs font-medium transition-all border border-slate-600"
                    data-testid="salesperson-email"
                  >
                    <Mail className="w-3 h-3" />
                    Email
                  </a>
                )}
              </div>
            </div>
            
            {/* Cart Button - always visible */}
            <div className="flex-shrink-0">
              <Button
                onClick={() => setIsQuoteDialogOpen(true)}
                disabled={cart.length === 0}
                size="sm"
                className="bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold gap-1 shadow-md text-xs md:text-sm"
                data-testid="button-open-cart"
              >
                <ShoppingCart className="h-4 w-4" />
                <span className="hidden sm:inline">Cotizar</span>
                {cartItemCount > 0 && (
                  <Badge variant="secondary" className="ml-0.5 bg-white text-amber-600 text-xs h-5 px-1.5">
                    {cartItemCount}
                  </Badge>
                )}
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Search and Filters */}
      <div className="sticky top-0 z-40 bg-white border-b shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar productos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="input-search"
              />
            </div>
            
            {categories.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant={selectedCategory === null ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory(null)}
                  data-testid="filter-all"
                >
                  Todos
                </Button>
                {categories.map(cat => (
                  <Button
                    key={cat}
                    variant={selectedCategory === cat ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedCategory(cat)}
                    data-testid={`filter-category-${cat}`}
                  >
                    {cat}
                  </Button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Products Grid */}
      <div className="container mx-auto px-4 py-6">
        {filteredProducts.length === 0 ? (
          <div className="text-center py-12">
            <Package className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">No se encontraron productos</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {filteredProducts.map(product => {
              const cartItem = cart.find(item => item.id === product.id);
              
              return (
                <Card 
                  key={product.id} 
                  className="overflow-hidden hover:shadow-lg transition-shadow group"
                  data-testid={`product-card-${product.id}`}
                >
                  {/* Product Image */}
                  <div className="aspect-square relative bg-slate-100">
                    {product.imagenUrl ? (
                      <img
                        src={product.imagenUrl}
                        alt={product.producto}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="h-12 w-12 text-muted-foreground/30" />
                      </div>
                    )}
                    
                    {product.categoria && (
                      <Badge 
                        variant="secondary" 
                        className="absolute top-2 left-2 text-xs"
                      >
                        {product.categoria}
                      </Badge>
                    )}
                  </div>
                  
                  <CardContent className="p-3">
                    <h3 className="font-medium text-sm line-clamp-2 mb-1" title={product.producto}>
                      {product.producto}
                    </h3>
                    <p className="text-xs text-muted-foreground mb-2">
                      SKU: {product.codigo}
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-primary">
                        ${product.precio.toLocaleString('es-CL')}
                      </span>
                      {product.unidad && (
                        <span className="text-xs text-muted-foreground">
                          /{product.unidad}
                        </span>
                      )}
                    </div>
                    
                    {/* Add to cart / Quantity controls */}
                    {cartItem ? (
                      <div className="flex items-center justify-between mt-3">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => updateQuantity(product.id, cartItem.quantity - 1)}
                          data-testid={`button-decrease-${product.id}`}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="font-medium">{cartItem.quantity}</span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => updateQuantity(product.id, cartItem.quantity + 1)}
                          data-testid={`button-increase-${product.id}`}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        className="w-full mt-3 h-8"
                        size="sm"
                        onClick={() => addToCart(product)}
                        data-testid={`button-add-${product.id}`}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Agregar
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Floating Cart Summary (Mobile) */}
      {cart.length > 0 && (
        <div className="fixed bottom-4 left-4 right-4 sm:hidden z-50">
          <Button
            className="w-full gap-2 h-14 text-lg shadow-lg bg-amber-500 hover:bg-amber-600 text-slate-900"
            onClick={() => setIsQuoteDialogOpen(true)}
            data-testid="button-mobile-cart"
          >
            <ShoppingCart className="h-5 w-5" />
            Solicitar Cotización ({cartItemCount})
            <span className="ml-auto">${cartTotal.toLocaleString('es-CL')}</span>
          </Button>
        </div>
      )}

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
          
          {/* Cart Items */}
          <div className="space-y-3 max-h-48 overflow-y-auto">
            {cart.map(item => (
              <div 
                key={item.id} 
                className="flex items-center gap-3 p-2 bg-slate-50 rounded-lg"
                data-testid={`cart-item-${item.id}`}
              >
                <div className="w-12 h-12 bg-white rounded overflow-hidden flex-shrink-0">
                  {item.imagenUrl ? (
                    <img src={item.imagenUrl} alt={item.producto} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="h-6 w-6 text-muted-foreground/30" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{item.producto}</p>
                  <p className="text-xs text-muted-foreground">
                    ${item.precio.toLocaleString('es-CL')} x {item.quantity}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) => updateQuantity(item.id, parseInt(e.target.value) || 1)}
                    className="w-16 h-8 text-center"
                    data-testid={`input-quantity-${item.id}`}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => removeFromCart(item.id)}
                    data-testid={`button-remove-${item.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
          
          <Separator />
          
          {/* Total */}
          <div className="flex justify-between items-center font-semibold text-lg">
            <span>Total Estimado:</span>
            <span className="text-primary">${cartTotal.toLocaleString('es-CL')}</span>
          </div>
          
          <Separator />
          
          {/* Contact Form */}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmitQuote)} className="space-y-4">
              <FormField
                control={form.control}
                name="visitorName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre completo *</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input {...field} placeholder="Tu nombre" className="pl-10" data-testid="input-name" />
                      </div>
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
                    <FormLabel>Email *</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input {...field} type="email" placeholder="tu@email.com" className="pl-10" data-testid="input-email" />
                      </div>
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
                        <div className="relative">
                          <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input {...field} placeholder="+56 9..." className="pl-10" data-testid="input-phone" />
                        </div>
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
                        <div className="relative">
                          <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input {...field} placeholder="Tu empresa" className="pl-10" data-testid="input-company" />
                        </div>
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
                    <FormLabel>Mensaje (opcional)</FormLabel>
                    <FormControl>
                      <Textarea 
                        {...field} 
                        placeholder="¿Algún detalle adicional sobre tu pedido?"
                        rows={3}
                        data-testid="input-message"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button
                  type="submit"
                  className="w-full gap-2"
                  disabled={submitQuoteMutation.isPending}
                  data-testid="button-submit-quote"
                >
                  {submitQuoteMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Enviar Solicitud de Cotización
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
        <DialogContent className="max-w-sm text-center">
          <div className="py-6">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <DialogTitle className="mb-2">¡Solicitud Enviada!</DialogTitle>
            <DialogDescription>
              Hemos recibido tu solicitud de cotización. {salesperson.salespersonName} te contactará pronto.
            </DialogDescription>
          </div>
          <DialogFooter>
            <Button 
              onClick={() => setIsSuccessDialogOpen(false)} 
              className="w-full"
              data-testid="button-close-success"
            >
              Continuar Navegando
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
