/**
 * CotizadorPage — B2C Public Quotation Platform
 * 
 * 100% public, no authentication required.
 * Shows product catalog WITHOUT prices.
 * Allows visitors to build a product list and request a quotation.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { QuoteProvider } from '@/contexts/QuoteContext';
import CotizadorHeader from '@/components/cotizador/CotizadorHeader';
import ProductCardExpandable from '@/components/shared/ProductCardExpandable';
import CotizadorProductDetail from '@/components/cotizador/CotizadorProductDetail';
import CotizadorQuotePanel from '@/components/cotizador/CotizadorQuotePanel';
import CotizadorContactForm from '@/components/cotizador/CotizadorContactForm';
import CotizadorHero from '@/components/cotizador/CotizadorHero';
import CotizadorFooter from '@/components/cotizador/CotizadorFooter';
import { Filter, ChevronDown, Search } from 'lucide-react';

function CotizadorContent() {
  // ?buscar= llega desde el buscador de la página de producto
  const [searchTerm, setSearchTerm] = useState(() => new URLSearchParams(window.location.search).get('buscar') || '');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [quotePanelOpen, setQuotePanelOpen] = useState(false);
  const [contactFormOpen, setContactFormOpen] = useState(false);
  const [detailProduct, setDetailProduct] = useState<any>(null);
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);

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


  // Catálogo completo (sin filtros) para el hero: misma clave que la primera carga, sale de caché
  const { data: fullCatalogData } = useQuery({
    queryKey: ['/api/b2c/catalog', '', 'all'],
    queryFn: async () => {
      const res = await fetch('/api/b2c/catalog');
      return res.json();
    },
    staleTime: 30_000,
  });

  const categories: string[] = categoriesData?.categories || [];
  const products = catalogData?.catalog || [];
  const heroCatalog = fullCatalogData?.catalog || [];

  const scrollToCatalog = () => document.getElementById('catalogo')?.scrollIntoView({ behavior: 'smooth' });

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Header */}
      <CotizadorHeader
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        onOpenQuotePanel={() => setQuotePanelOpen(true)}
        config={config}
      />

      {/* ═══ HERO ═══ */}
      <CotizadorHero
        products={heroCatalog}
        categories={categories}
        config={config}
        onExplore={scrollToCatalog}
        onSelectCategory={(cat) => { setSelectedCategory(cat); scrollToCatalog(); }}
        onViewDetail={setDetailProduct}
      />

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
                <Filter className="w-4 h-4 text-[#fd6301]" />
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
                      selectedCategory === 'all' ? 'bg-orange-50 text-[#fd6301] font-bold' : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Todas las categorías
                  </button>
                  {categories.map(cat => (
                    <button
                      key={cat}
                      onClick={() => { setSelectedCategory(cat); setCategoryDropdownOpen(false); }}
                      className={`w-full text-left px-4 py-2.5 text-sm font-medium border-t border-gray-50 transition-colors ${
                        selectedCategory === cat ? 'bg-orange-50 text-[#fd6301] font-bold' : 'text-gray-700 hover:bg-gray-50'
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
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#fd6301]/10 text-[#fd6301] rounded-full text-xs font-semibold hover:bg-[#fd6301]/20 transition-colors"
            >
              {selectedCategory}
              <span className="w-4 h-4 rounded-full bg-[#fd6301]/20 flex items-center justify-center text-[10px]">✕</span>
            </button>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Result count */}
          <p className="text-sm text-gray-400 font-medium">
            {isLoading ? 'Cargando...' : (
              <>
                <span className="font-bold text-gray-700">{products.length}</span> producto{products.length !== 1 ? 's' : ''}
                {searchTerm && <> para "<span className="text-[#fd6301]">{searchTerm}</span>"</>}
              </>
            )}
          </p>
        </div>

        {/* Product grid — 3 columns */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="w-12 h-12 border-4 border-[#fd6301] border-t-transparent rounded-full animate-spin mb-4" />
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
              className="mt-4 px-5 py-2 text-sm text-[#fd6301] hover:bg-orange-50 rounded-lg font-bold transition-colors"
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
      <CotizadorFooter config={config} />

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
