/**
 * CotizadorPage — B2C Public Quotation Platform
 * 
 * 100% public, no authentication required.
 * Shows product catalog WITHOUT prices.
 * Allows visitors to build a product list and request a quotation.
 */

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { QuoteProvider } from '@/contexts/QuoteContext';
import CotizadorHeader from '@/components/cotizador/CotizadorHeader';
import ProductCardExpandable from '@/components/shared/ProductCardExpandable';
import CotizadorProductDetail from '@/components/cotizador/CotizadorProductDetail';
import CotizadorQuotePanel from '@/components/cotizador/CotizadorQuotePanel';
import CotizadorContactForm from '@/components/cotizador/CotizadorContactForm';
import { Filter, ChevronDown, ChevronLeft, ChevronRight, Loader2, Search, ArrowRight, ShieldCheck, Truck, Clock, Star } from 'lucide-react';

function CotizadorContent() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [quotePanelOpen, setQuotePanelOpen] = useState(false);
  const [contactFormOpen, setContactFormOpen] = useState(false);
  const [detailProduct, setDetailProduct] = useState<any>(null);
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);

  // Fetch public config
  const { data: config } = useQuery({
    queryKey: ['/api/b2c/config'],
    queryFn: async () => {
      const res = await fetch('/api/b2c/config');
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  // Fetch categories
  const { data: categoriesData } = useQuery({
    queryKey: ['/api/b2c/catalog/categories'],
    queryFn: async () => {
      const res = await fetch('/api/b2c/catalog/categories');
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  // Fetch catalog
  const { data: catalogData, isLoading } = useQuery({
    queryKey: ['/api/b2c/catalog', searchTerm, selectedCategory],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchTerm) params.set('search', searchTerm);
      if (selectedCategory !== 'all') params.set('category', selectedCategory);
      const res = await fetch(`/api/b2c/catalog?${params}`);
      return res.json();
    },
    staleTime: 30_000,
  });

  // Fetch banners — sólo los configurados para el cotizador (admin: eCommerce ▸ Cotizador)
  const { data: bannersData } = useQuery({
    queryKey: ['/api/b2c/banners'],
    queryFn: async () => {
      const res = await fetch('/api/b2c/banners');
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const heroBanners: any[] = ((bannersData?.banners || []) as any[])
    .filter((b) => b.tipoVisualizacion === 'cotizador' && b.imagenDesktop)
    .sort((a, b) => (a.orden || 0) - (b.orden || 0));

  // Auto-rotación del carrusel cuando hay más de un banner
  useEffect(() => {
    if (heroBanners.length < 2) return;
    const interval = setInterval(() => {
      setCurrentSlide(prev => (prev + 1) % heroBanners.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [heroBanners.length]);

  const categories: string[] = categoriesData?.categories || [];
  const products = catalogData?.catalog || [];

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Header */}
      <CotizadorHeader
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        onOpenQuotePanel={() => setQuotePanelOpen(true)}
        config={config}
      />

      {/* ═══ HERO — Banners administrables (eCommerce ▸ Cotizador) ═══ */}
      {heroBanners.length > 0 ? (
        <section className="w-full relative overflow-hidden bg-slate-100" data-testid="cotizador-banner-carousel">
          <div className="relative w-full group">
            {heroBanners.map((banner: any, index: number) => {
              const activeIndex = currentSlide % heroBanners.length;
              const image = (
                <picture>
                  {banner.imagenMobile && <source media="(max-width: 768px)" srcSet={banner.imagenMobile} />}
                  <img
                    src={banner.imagenDesktop}
                    alt={banner.titulo || 'Banner cotizador'}
                    loading={index === 0 ? 'eager' : 'lazy'}
                    decoding="async"
                    className="w-full h-auto object-contain block"
                  />
                </picture>
              );
              return (
                <div
                  key={banner.id}
                  className={`w-full transition-opacity duration-500 ${
                    index === activeIndex ? 'opacity-100 relative z-10' : 'opacity-0 absolute top-0 left-0 z-0'
                  }`}
                  data-testid={`cotizador-banner-slide-${index}`}
                >
                  {banner.linkUrl ? (
                    <a href={banner.linkUrl} target="_blank" rel="noopener noreferrer" className="block w-full">
                      {image}
                    </a>
                  ) : image}
                </div>
              );
            })}

            {heroBanners.length > 1 && (
              <>
                <button
                  onClick={() => setCurrentSlide(prev => (prev === 0 ? heroBanners.length - 1 : prev - 1))}
                  className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 w-8 h-8 sm:w-10 sm:h-10 bg-black/30 hover:bg-black/50 text-white rounded-full flex items-center justify-center backdrop-blur-sm transition-all z-20 md:opacity-0 md:group-hover:opacity-100"
                  aria-label="Banner anterior"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setCurrentSlide(prev => (prev + 1) % heroBanners.length)}
                  className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 w-8 h-8 sm:w-10 sm:h-10 bg-black/30 hover:bg-black/50 text-white rounded-full flex items-center justify-center backdrop-blur-sm transition-all z-20 md:opacity-0 md:group-hover:opacity-100"
                  aria-label="Banner siguiente"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-20">
                  {heroBanners.map((_: any, index: number) => (
                    <button
                      key={index}
                      onClick={() => setCurrentSlide(index)}
                      aria-label={`Ir al banner ${index + 1}`}
                      className={`h-1.5 rounded-full transition-all ${
                        index === currentSlide % heroBanners.length ? 'w-6 bg-[#fd6301]' : 'w-1.5 bg-white/70 hover:bg-white'
                      }`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </section>
      ) : (
      <section className="relative overflow-hidden">
        {/* Background image — painted building / construction */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1503594384566-461fe158e797?auto=format&fit=crop&w=2000&q=70')`,
          }}
        />
        {/* Dark gradient overlay for readability */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#1a1a2e]/95 via-[#16213e]/90 to-[#0f3460]/92" />
        <div className="absolute inset-0 opacity-30" style={{
          backgroundImage: `radial-gradient(circle at 25% 50%, rgba(255,110,35,0.3) 0%, transparent 50%),
                           radial-gradient(circle at 75% 50%, rgba(255,110,35,0.15) 0%, transparent 50%)`
        }} />
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#FF6E23]/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-[#FF6E23]/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/3" />

        <div className="relative max-w-7xl mx-auto px-4 py-6 md:py-16 lg:py-20">
          <div className="max-w-3xl">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FF6E23]/20 border border-[#FF6E23]/30 mb-3 md:mb-6">
              <Star className="w-3.5 h-3.5 text-[#FF6E23]" />
              <span className="text-[10px] md:text-xs font-semibold text-[#FF6E23] uppercase tracking-wider">Cotización Mayorista</span>
            </div>

            <h1 className="text-2xl md:text-4xl lg:text-5xl font-black text-white leading-[1.1] tracking-tight mb-2 md:mb-4">
              SOLICITA TU{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FF6E23] to-[#FFB347]">
                COTIZACIÓN MAYORISTA
              </span>{' '}
              EN MINUTOS
            </h1>

            <p className="text-sm md:text-lg text-gray-300 leading-relaxed mb-4 md:mb-8 max-w-2xl">
              Explora nuestro catálogo completo de productos, selecciona las cantidades que necesitas y recibe una cotización personalizada directamente en tu correo.
            </p>

            {/* Feature pills */}
            <div className="flex flex-wrap gap-2 md:gap-3 mb-4 md:mb-8">
              {[
                { icon: ShieldCheck, text: 'Sin registro necesario' },
                { icon: Truck, text: 'Despacho a todo Chile' },
                { icon: Clock, text: 'Respuesta en 24hrs' },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-1.5 md:gap-2 px-2.5 md:px-4 py-1.5 md:py-2 rounded-lg md:rounded-xl bg-white/10 backdrop-blur-sm border border-white/10">
                  <Icon className="w-3.5 h-3.5 md:w-4 md:h-4 text-[#FF6E23]" />
                  <span className="text-xs md:text-sm font-medium text-white">{text}</span>
                </div>
              ))}
            </div>

            {/* CTA */}
            <button
              onClick={() => {
                document.getElementById('catalogo')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="group inline-flex items-center gap-2 px-5 md:px-6 py-2.5 md:py-3 bg-gradient-to-r from-[#FF6E23] to-[#E55E13] text-white text-sm md:text-base font-bold rounded-xl hover:from-[#E55E13] hover:to-[#D54E03] transition-all shadow-lg shadow-orange-500/30 active:scale-[0.98]"
            >
              Explorar Catálogo
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </section>
      )}

      {/* ═══ CATALOG ═══ */}
      <div id="catalogo" className="max-w-7xl mx-auto px-4 py-6">
        {/* Toolbar — category dropdown + result count */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-5">
          {/* Category dropdown */}
          <div className="relative">
            <button
              onClick={() => setCategoryDropdownOpen(!categoryDropdownOpen)}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:border-gray-300 transition-all shadow-sm min-w-[220px] justify-between"
            >
              <span className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-[#FF6E23]" />
                {selectedCategory === 'all' ? 'Todas las categorías' : selectedCategory}
              </span>
              <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${categoryDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            {categoryDropdownOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setCategoryDropdownOpen(false)} />
                <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-xl shadow-xl z-40 overflow-hidden max-h-80 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200">
                  <button
                    onClick={() => { setSelectedCategory('all'); setCategoryDropdownOpen(false); }}
                    className={`w-full text-left px-4 py-2.5 text-sm font-medium transition-colors ${
                      selectedCategory === 'all' ? 'bg-orange-50 text-[#FF6E23] font-bold' : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Todas las categorías
                  </button>
                  {categories.map(cat => (
                    <button
                      key={cat}
                      onClick={() => { setSelectedCategory(cat); setCategoryDropdownOpen(false); }}
                      className={`w-full text-left px-4 py-2.5 text-sm font-medium border-t border-gray-50 transition-colors ${
                        selectedCategory === cat ? 'bg-orange-50 text-[#FF6E23] font-bold' : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Active filter chip */}
          {selectedCategory !== 'all' && (
            <button
              onClick={() => setSelectedCategory('all')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FF6E23]/10 text-[#FF6E23] rounded-full text-xs font-semibold hover:bg-[#FF6E23]/20 transition-colors"
            >
              {selectedCategory}
              <span className="w-4 h-4 rounded-full bg-[#FF6E23]/20 flex items-center justify-center text-[10px]">✕</span>
            </button>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Result count */}
          <p className="text-sm text-gray-400 font-medium">
            {isLoading ? 'Cargando...' : (
              <>
                <span className="font-bold text-gray-700">{products.length}</span> producto{products.length !== 1 ? 's' : ''}
                {searchTerm && <> para "<span className="text-[#FF6E23]">{searchTerm}</span>"</>}
              </>
            )}
          </p>
        </div>

        {/* Product grid — 3 columns */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="w-12 h-12 border-4 border-[#FF6E23] border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-sm text-gray-400 font-medium">Cargando catálogo...</p>
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-20 h-20 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
              <Search className="w-10 h-10 text-gray-300" />
            </div>
            <h3 className="font-bold text-lg text-gray-700 mb-1">Sin resultados</h3>
            <p className="text-sm text-gray-400 max-w-sm">
              No encontramos productos con esos criterios. Intenta con otro término o categoría.
            </p>
            <button
              onClick={() => { setSearchTerm(''); setSelectedCategory('all'); }}
              className="mt-4 px-5 py-2 text-sm text-[#FF6E23] hover:bg-orange-50 rounded-lg font-bold transition-colors"
            >
              Ver todo el catálogo
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
            {products.map((product: any) => (
              <ProductCardExpandable
                key={product.genericName}
                mode="cotizador"
                product={product}
                onViewDetail={setDetailProduct}
                onOpenQuotePanel={() => setQuotePanelOpen(true)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ═══ FOOTER ═══ */}
      <footer className="bg-gradient-to-br from-[#1a1a2e] to-[#16213e] text-white py-10 mt-16">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="text-center md:text-left">
              <img
                src={config?.logoUrl || "/panoramica-logo.png"}
                alt={config?.siteName || "Panorámica"}
                className="h-10 w-auto mx-auto md:mx-0 mb-2 brightness-0 invert opacity-80"
              />
              <p className="text-gray-400 text-sm">Cotizador de productos — Solicita tu cotización mayorista sin compromiso</p>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-4 text-sm text-gray-400">
              {config?.contactInfo?.phone && (
                <a href={`tel:${config.contactInfo.phone}`} className="hover:text-[#FF6E23] transition-colors font-medium">{config.contactInfo.phone}</a>
              )}
              {config?.contactInfo?.email && (
                <a href={`mailto:${config.contactInfo.email}`} className="hover:text-[#FF6E23] transition-colors font-medium">{config.contactInfo.email}</a>
              )}
              {config?.contactInfo?.whatsapp && (
                <a href={`https://wa.me/${config.contactInfo.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener" className="hover:text-[#FF6E23] transition-colors font-medium">
                  WhatsApp
                </a>
              )}
            </div>
          </div>
          <div className="border-t border-white/10 mt-6 pt-4 text-center text-xs text-gray-500">
            © {new Date().getFullYear()} {config?.siteName || 'Pinturas Panorámica'}. Todos los derechos reservados.
          </div>
        </div>
      </footer>

      {/* ═══ MODALS ═══ */}
      <CotizadorQuotePanel
        open={quotePanelOpen}
        onClose={() => setQuotePanelOpen(false)}
        onSubmit={() => { setQuotePanelOpen(false); setContactFormOpen(true); }}
      />
      <CotizadorContactForm
        open={contactFormOpen}
        onClose={() => setContactFormOpen(false)}
      />
      <CotizadorProductDetail
        product={detailProduct}
        open={!!detailProduct}
        onClose={() => setDetailProduct(null)}
        onOpenQuotePanel={() => setQuotePanelOpen(true)}
      />
    </div>
  );
}

// Wrap with QuoteProvider — independent from CartProvider
export default function CotizadorPage() {
  return (
    <QuoteProvider>
      <CotizadorContent />
    </QuoteProvider>
  );
}
