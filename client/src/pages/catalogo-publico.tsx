import { useState } from 'react';
import { useRoute } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Phone,
  Mail,
  ShoppingCart,
  Check,
  CheckCircle2,
  Loader2,
  Building,
  Package,
  Store,
  User,
  Sparkles,
  ListOrdered,
} from 'lucide-react';
import { SiWhatsapp } from 'react-icons/si';
import AiChatView from '@/components/ai-chat/AiChatView';
import { useAiChat } from '@/hooks/useAiChat';
import PublicCatalogProducts from '@/components/public-catalog-products';
import { useCartItemCount, useCart } from '@/hooks/useCart';
import { BillingSummary } from '@/components/cart';
import { Trash2, Minus, Plus } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

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

const formatCurrency = (price: number): string => {
  return `$${new Intl.NumberFormat('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(price)}`;
};

function CartCheckoutModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { state, removeItem, updateQuantity } = useCart();

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <ShoppingCart className="w-5 h-5 text-orange-500" />
            Mi Pedido — {state.itemCount} producto{state.itemCount !== 1 ? 's' : ''}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Revisa tu pedido y confirma
          </DialogDescription>
        </DialogHeader>

        {state.items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-6">
            <ShoppingCart className="h-12 w-12 text-slate-300 mb-4" />
            <p className="text-lg font-medium text-slate-700">Tu carrito está vacío</p>
            <p className="text-sm text-slate-500 mt-1">Agrega productos para crear tu pedido</p>
            <Button onClick={onClose} className="mt-6 bg-orange-500 hover:bg-orange-600 text-white">Seguir comprando</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-0 overflow-hidden" style={{ maxHeight: 'calc(90vh - 100px)' }}>
            {/* Left: Cart Items */}
            <div className="lg:col-span-3 border-r overflow-y-auto" style={{ maxHeight: 'calc(90vh - 100px)' }}>
              <div className="divide-y">
                {state.items.map((item) => (
                  <div key={item.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-sm uppercase">{item.productName}</h4>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {item.selectedColor && <span className="uppercase">{item.selectedColor}</span>}
                          {item.selectedColor && item.selectedPackaging && ' · '}
                          {item.selectedPackaging}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">SKU: {item.productCode || 'N/A'}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeItem(item.id)}
                        className="h-7 w-7 p-0 text-red-400 hover:text-red-600 hover:bg-red-50 flex-shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => updateQuantity(item.id, Math.max(item.minQuantity, item.quantity - (item.quantityStep || 1)))}
                          className="h-8 w-8 p-0"
                        >
                          <Minus className="w-3 h-3" />
                        </Button>
                        <Input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateQuantity(item.id, parseInt(e.target.value) || item.minQuantity)}
                          className="h-8 w-14 text-center text-sm font-medium [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => updateQuantity(item.id, item.quantity + (item.quantityStep || 1))}
                          className="h-8 w-8 p-0"
                        >
                          <Plus className="w-3 h-3" />
                        </Button>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-400">{formatCurrency(item.unitPrice)} c/u</p>
                        <p className="text-sm font-bold text-orange-600">{formatCurrency(item.subtotal)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Billing Summary */}
            <div className="lg:col-span-2 overflow-y-auto bg-slate-50" style={{ maxHeight: 'calc(90vh - 100px)' }}>
              <BillingSummary />
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function CatalogoPublico() {
  const [, params] = useRoute('/catalogo/:slug');
  const slug = params?.slug || '';

  const [isClientDialogOpen, setIsClientDialogOpen] = useState(false);
  const [clientBusinessName, setClientBusinessName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientLoyaltyTier, setClientLoyaltyTier] = useState<{
    code: string;
    name: string;
  } | null>(null);
  const [clientNextTier, setClientNextTier] = useState<{
    code: string;
    name: string;
    minAmount: number;
  } | null>(null);
  const [clientAmountToNextTier, setClientAmountToNextTier] = useState<number>(0);
  const [clientTotalSales, setClientTotalSales] = useState<number>(0);
  const [tempRut, setTempRut] = useState('');
  const [isSearchingClient, setIsSearchingClient] = useState(false);
  const [rutError, setRutError] = useState('');

  const aiChat = useAiChat({ isPublic: true, salespersonSlug: slug });
  const [activeTab, setActiveTab] = useState<'productos' | 'ia'>('productos');
  const cartItemCount = useCartItemCount();
  const [isCartOpen, setIsCartOpen] = useState(false);

  const { data, isLoading, error } = useQuery<{
    salesperson: SalespersonProfile;
  }>({
    queryKey: ['/api/public/catalogos', slug, 'grouped'],
    queryFn: async () => {
      const response = await fetch(`/api/public/catalogos/${slug}?grouped=true`);
      if (!response.ok) throw new Error('Failed to fetch catalog');
      return response.json();
    },
    enabled: !!slug,
  });

  const getWhatsAppLink = (phone: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    return `https://wa.me/${cleanPhone}`;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getTierBadgeColor = (tierCode: string) => {
    switch (tierCode.toLowerCase()) {
      case 'platinum':
        return 'bg-gradient-to-r from-slate-400 to-slate-300 text-slate-900';
      case 'gold':
        return 'bg-gradient-to-r from-amber-400 to-yellow-300 text-amber-900';
      case 'lider':
        return 'bg-gradient-to-r from-blue-500 to-cyan-400 text-white';
      default:
        return 'bg-slate-600 text-white';
    }
  };

  const handleClientConfirm = async () => {
    if (!tempRut.trim()) return;

    setIsSearchingClient(true);
    setRutError('');

    try {
      const response = await fetch(`/api/public/clients/search-by-rut?rut=${encodeURIComponent(tempRut.trim())}`);
      const result = await response.json();

      if (response.ok && result.found) {
        setClientBusinessName(result.clientName);
        setClientEmail(result.clientEmail || '');
        setClientPhone(result.clientPhone || '');
        setClientLoyaltyTier(result.loyaltyTier || null);
        setClientNextTier(result.nextTier || null);
        setClientAmountToNextTier(result.amountToNextTier || 0);
        setClientTotalSales(result.totalSalesLast90Days || 0);
        setIsClientDialogOpen(false);
        setTempRut('');
      } else {
        setRutError(result.message || 'Cliente no encontrado. Verifica el RUT ingresado.');
      }
    } catch {
      setRutError('Error al buscar cliente. Intenta nuevamente.');
    } finally {
      setIsSearchingClient(false);
    }
  };

  const handleClearClient = () => {
    setClientBusinessName('');
    setClientEmail('');
    setClientPhone('');
    setClientLoyaltyTier(null);
    setClientNextTier(null);
    setClientAmountToNextTier(0);
    setClientTotalSales(0);
    setRutError('');
  };

  // Loading state
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

  // Error state
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

  const { salesperson } = data;

  // Suggestions for the public chat
  const publicSuggestions = [
    "Necesito pintura para exterior",
    "¿Qué esmaltes al agua tienen?",
    "Quiero cotizar productos para una obra",
    "¿Tienen barniz marino?",
    "Busco anticorrosivo en galón",
    "¿Cuáles son sus productos más vendidos?",
  ];

  return (
    <div className="h-screen flex flex-col bg-slate-50 overflow-hidden">
      {/* Client Identification Banner */}
      {!clientBusinessName && (
        <div
          className="bg-gradient-to-r from-amber-500 to-orange-500 text-white cursor-pointer hover:from-amber-600 hover:to-orange-600 transition-all flex-shrink-0"
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

      {/* Premium Digital Business Card Header */}
      <header className="relative bg-slate-900 overflow-hidden border-b border-white/5 flex-shrink-0">
        <div className="absolute inset-0">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-amber-500/10 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2"></div>
          <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[120px] translate-y-1/2 -translate-x-1/2"></div>
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.03]"></div>
        </div>

        <div className="relative container mx-auto px-4 py-6 md:py-8">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-4 md:gap-8">
            {/* Salesperson Image */}
            <div className="relative group">
              <div className="w-20 h-20 md:w-24 md:h-24 rounded-3xl overflow-hidden border-4 border-white/10 shadow-2xl bg-gradient-to-br from-slate-800 to-slate-700 flex items-center justify-center">
                {salesperson.profileImageUrl ? (
                  <img
                    src={salesperson.profileImageUrl}
                    alt={salesperson.salespersonName}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                ) : (
                  <User className="w-10 h-10 md:w-12 md:h-12 text-white/20" />
                )}
              </div>
              <div className="absolute -bottom-1.5 -right-1.5 w-7 h-7 md:w-8 md:h-8 bg-amber-500 rounded-xl flex items-center justify-center shadow-lg border-2 border-slate-900 group-hover:scale-110 transition-transform">
                <Check className="w-3.5 h-3.5 md:w-4 md:h-4 text-slate-900 font-bold" />
              </div>
            </div>

            <div className="flex-1 text-center md:text-left space-y-3 min-w-0">
              <div className="space-y-0.5">
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                  <h1 className="text-xl md:text-3xl font-black text-white tracking-tight drop-shadow-sm" data-testid="salesperson-name">
                    {clientBusinessName || salesperson.salespersonName}
                  </h1>
                  {clientBusinessName && clientLoyaltyTier && (
                    <Badge className={`${getTierBadgeColor(clientLoyaltyTier.code)} border-none px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest`}>
                      {clientLoyaltyTier.name}
                    </Badge>
                  )}
                  {clientBusinessName && (
                    <button
                      onClick={handleClearClient}
                      className="ml-1 px-2 py-0.5 text-[10px] font-medium bg-white/20 hover:bg-white/30 text-white rounded-lg transition-colors"
                      data-testid="button-clear-client"
                    >
                      Salir
                    </button>
                  )}
                </div>
                <div className="flex items-center justify-center md:justify-start gap-2 text-amber-400/80 font-medium">
                  <Building className="w-3.5 h-3.5" />
                  <span className="text-xs md:text-sm">Ejecutivo Comercial · Pinturas Panorámica</span>
                </div>
              </div>

              {clientBusinessName ? (
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-slate-300 text-xs">
                  <User className="w-3 h-3 text-amber-500" />
                  Sesión personalizada · <span className="text-white font-semibold">Atendido por {salesperson.salespersonName}</span>
                </div>
              ) : salesperson.bio && (
                <p className="max-w-xl text-slate-400 text-xs md:text-sm leading-relaxed line-clamp-1 md:line-clamp-2">
                  {salesperson.bio}
                </p>
              )}

              {/* Contact Buttons */}
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 md:gap-3">
                {salesperson.publicPhone && (
                  <a
                    href={getWhatsAppLink(salesperson.publicPhone)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-center gap-1.5 bg-[#25D366] hover:bg-[#20ba5a] text-white px-3 py-2 rounded-xl text-xs font-bold shadow-lg transition-all hover:-translate-y-0.5 active:scale-95"
                  >
                    <SiWhatsapp className="w-4 h-4" />
                    <span className="hidden sm:inline">WhatsApp</span>
                  </a>
                )}

                {salesperson.publicPhone && (
                  <a
                    href={`tel:${salesperson.publicPhone}`}
                    className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-xl text-xs font-bold border border-white/10 backdrop-blur-sm transition-all hover:-translate-y-0.5 active:scale-95"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Llamar</span>
                  </a>
                )}

                {salesperson.publicEmail && (
                  <a
                    href={`mailto:${salesperson.publicEmail}`}
                    className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-xl text-xs font-bold border border-white/10 backdrop-blur-sm transition-all hover:-translate-y-0.5 active:scale-95"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Email</span>
                  </a>
                )}
              </div>
            </div>

            {/* Company Logo */}
            <div className="hidden md:block absolute top-4 right-4 md:top-6 md:right-6 opacity-20 md:opacity-30">
              <img src="/panoramica-logo.png" alt="Panoramica" className="h-6 md:h-8 w-auto brightness-0 invert" />
            </div>
          </div>
        </div>
      </header>

      {/* Loyalty Tier Progress */}
      {clientBusinessName && clientNextTier && clientAmountToNextTier > 0 && (
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 border-b border-amber-500/30 flex-shrink-0" data-testid="next-tier-progress">
          <div className="container mx-auto px-4 py-2">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-slate-300">
                    Te faltan <span className="font-bold text-amber-400">{formatCurrency(clientAmountToNextTier)}</span> para alcanzar
                  </span>
                  <span className={`font-bold px-2 py-0.5 rounded-full text-xs ${getTierBadgeColor(clientNextTier.code)}`}>
                    {clientNextTier.name}
                  </span>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, Math.max(5, (clientTotalSales / clientNextTier.minAmount) * 100))}%`
                    }}
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Compras últimos 90 días: {formatCurrency(clientTotalSales)}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Max Tier Message */}
      {clientBusinessName && !clientNextTier && clientLoyaltyTier && (
        <div className="bg-gradient-to-r from-amber-500 to-amber-600 text-white flex-shrink-0" data-testid="max-tier-message">
          <div className="container mx-auto px-4 py-1.5 flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span className="text-xs font-medium">¡Felicitaciones! Ya eres parte de nuestra categoría máxima</span>
          </div>
        </div>
      )}

      {/* Tab Navigation + Main Content */}
      <main className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {/* Tab Bar */}
        <div className="flex-shrink-0 bg-white border-b border-slate-200 shadow-sm">
          <div className="flex">
            <button
              onClick={() => setActiveTab('productos')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold transition-all border-b-2 ${activeTab === 'productos'
                ? 'border-orange-500 text-orange-600 bg-orange-50/50'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                }`}
            >
              <ListOrdered className="h-4 w-4" />
              Productos
            </button>
            <button
              onClick={() => setActiveTab('ia')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold transition-all border-b-2 ${activeTab === 'ia'
                ? 'border-blue-500 text-blue-600 bg-blue-50/50'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                }`}
            >
              <Sparkles className="h-4 w-4" />
              Asistente IA
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {activeTab === 'productos' ? (
            <PublicCatalogProducts />
          ) : (
            <AiChatView
              messages={aiChat.messages}
              isLoading={aiChat.isLoading}
              error={aiChat.error}
              onSendMessage={aiChat.sendMessage}
              onClearHistory={aiChat.clearHistory}
              onNewConversation={aiChat.newConversation}
              suggestions={publicSuggestions}
              welcomeTitle={`¡Hola! Soy el asistente de ${salesperson.salespersonName}`}
              welcomeSubtitle="Cuéntame qué productos necesitas y te ayudo a armar tu pedido."
            />
          )}
        </div>

        {/* Floating Cart Button */}
        {cartItemCount > 0 && (
          <div className="fixed bottom-6 right-6 z-50">
            <Button
              className="h-14 w-14 rounded-full bg-orange-500 hover:bg-orange-600 text-white shadow-xl shadow-orange-500/30 relative"
              onClick={() => setIsCartOpen(true)}
            >
              <ShoppingCart className="h-6 w-6" />
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">
                {cartItemCount}
              </span>
            </Button>
          </div>
        )}

        {/* Cart Checkout Modal */}
        <CartCheckoutModal isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
      </main>
    </div>
  );
}
