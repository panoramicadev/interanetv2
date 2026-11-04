/**
 * CotizadorPage — B2C Public Quotation Platform
 * 
 * 100% public, no authentication required.
 * Shows product catalog WITHOUT prices.
 * Allows visitors to build a product list and request a quotation.
 */

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { QuoteProvider } from '@/contexts/QuoteContext';
import CotizadorHeader from '@/components/cotizador/CotizadorHeader';
import ProductCardExpandable from '@/components/shared/ProductCardExpandable';
import CotizadorProductDetail from '@/components/cotizador/CotizadorProductDetail';
import CotizadorQuotePanel from '@/components/cotizador/CotizadorQuotePanel';
import CotizadorContactForm from '@/components/cotizador/CotizadorContactForm';
import CotizadorHero from '@/components/cotizador/CotizadorHero';
import CotizadorFooter from '@/components/cotizador/CotizadorFooter';
import { Search, LayoutGrid, Layers, ArrowDownAZ } from 'lucide-react';
import { useAparecer } from '@/hooks/use-aparecer';

type Orden = 'categoria' | 'az';
const OTROS = 'Otros productos';

/** Envoltorio que hace entrar cada tarjeta al aparecer en pantalla. */
function Revelar({ i, children }: { i: number; children: ReactNode }) {
  const ref = useAparecer<HTMLDivElement>();
  return <div ref={ref} className="cz-revelar" style={{ '--cz-delay': `${(i % 2) * 70}ms` } as CSSProperties}>{children}</div>;
}

function CotizadorContent() {
  // ?buscar= llega desde el buscador de la página de producto
  const [searchTerm, setSearchTerm] = useState(() => new URLSearchParams(window.location.search).get('buscar') || '');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [quotePanelOpen, setQuotePanelOpen] = useState(false);
  const [contactFormOpen, setContactFormOpen] = useState(false);
  const [detailProduct, setDetailProduct] = useState<any>(null);
  const [orden, setOrden] = useState<Orden>('categoria');
  // La barra de categorías se pega justo bajo el encabezado, que cambia de alto
  // (en celular el buscador baja a una segunda fila): se mide en vez de fijarlo.
  const [altoHeader, setAltoHeader] = useState(0);
  useEffect(() => {
    const header = document.querySelector('header');
    if (!header) return;
    const medir = () => setAltoHeader(header.getBoundingClientRect().height);
    medir();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(medir);
    ro.observe(header);
    return () => ro.disconnect();
  }, []);

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

  // Por categoría: secciones con título (A–Z dentro de cada una). A–Z o con filtro: una sola grilla.
  const secciones = useMemo(() => {
    const porNombre = (a: any, b: any) => a.genericName.localeCompare(b.genericName, 'es');
    if (orden === 'az' || selectedCategory !== 'all') {
      return [{ titulo: null as string | null, items: [...products].sort(porNombre) }];
    }
    const grupos = new Map<string, any[]>();
    products.forEach((p: any) => {
      const k = p.groupName || OTROS;
      if (!grupos.has(k)) grupos.set(k, []);
      grupos.get(k)!.push(p);
    });
    return Array.from(grupos.entries())
      .sort(([a], [b]) => (a === OTROS ? 1 : b === OTROS ? -1 : a.localeCompare(b, 'es')))
      .map(([titulo, items]) => ({ titulo, items: items.sort(porNombre) }));
  }, [products, orden, selectedCategory]);

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
        {/* Barra: categorías en pastillas (queda pegada bajo el encabezado), orden y conteo */}
        <div data-sin-brillo="" style={{ top: altoHeader }} className="sticky z-30 -mx-4 px-4 pt-3 pb-2.5 mb-5 bg-[#F8FAFC]/90 backdrop-blur-md border-b border-slate-200/70">
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0 flex gap-2 overflow-x-auto pr-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [mask-image:linear-gradient(to_right,black_90%,transparent)]">
              {['all', ...categories].map(cat => {
                const activa = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`flex-shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs sm:text-sm font-semibold whitespace-nowrap border transition-all duration-200 active:scale-95 ${
                      activa
                        ? 'bg-[#fd6301] border-[#fd6301] text-white shadow-md shadow-orange-500/30'
                        : 'bg-white border-gray-200 text-gray-600 hover:border-[#fd6301]/40 hover:text-gray-900'
                    }`}
                  >
                    {cat === 'all' && <LayoutGrid className="w-3.5 h-3.5" />}
                    {cat === 'all' ? 'Todo' : cat}
                  </button>
                );
              })}
            </div>

            <div className="hidden sm:flex flex-shrink-0 items-center p-1 rounded-xl bg-white border border-gray-200">
              {([
                { id: 'categoria', texto: 'Por categoría', icono: Layers },
                { id: 'az', texto: 'A–Z', icono: ArrowDownAZ },
              ] as const).map(({ id, texto, icono: Icono }) => (
                <button
                  key={id}
                  onClick={() => setOrden(id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    orden === id ? 'bg-orange-50 text-[#fd6301]' : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  <Icono className="w-3.5 h-3.5" /> {texto}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between mt-2">
            <p className="text-xs text-gray-400 font-medium">
              {isLoading ? 'Cargando...' : (
                <>
                  <span className="font-bold text-gray-700">{products.length}</span> producto{products.length !== 1 ? 's' : ''}
                  {searchTerm && <> para "<span className="text-[#fd6301]">{searchTerm}</span>"</>}
                </>
              )}
            </p>
            <button
              onClick={() => setOrden(orden === 'az' ? 'categoria' : 'az')}
              className="sm:hidden inline-flex items-center gap-1 text-xs font-semibold text-gray-500"
            >
              {orden === 'az'
                ? <><Layers className="w-3.5 h-3.5" /> Por categoría</>
                : <><ArrowDownAZ className="w-3.5 h-3.5" /> Ordenar A–Z</>}
            </button>
          </div>
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
          <div key={`${selectedCategory}|${orden}`} className="space-y-10 animate-in fade-in duration-300">
            {secciones.map(seccion => (
              <section key={seccion.titulo ?? 'todo'}>
                {seccion.titulo && (
                  <div className="flex items-center gap-3 mb-4">
                    <span className="w-1.5 h-6 rounded-full bg-gradient-to-b from-[#fd6301] to-amber-400" />
                    <h2 className="text-lg sm:text-xl font-black text-gray-900 tracking-tight">{seccion.titulo}</h2>
                    <span className="px-2 py-0.5 rounded-full bg-orange-50 text-[#fd6301] text-xs font-bold tabular-nums">{seccion.items.length}</span>
                    <span className="flex-1 h-px bg-gradient-to-r from-gray-200 to-transparent" />
                  </div>
                )}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
                  {seccion.items.map((product: any, i: number) => (
                    <Revelar key={product.genericName} i={i}>
                      <ProductCardExpandable
                        mode="cotizador"
                        product={product}
                        onViewDetail={setDetailProduct}
                        onOpenQuotePanel={() => setQuotePanelOpen(true)}
                      />
                    </Revelar>
                  ))}
                </div>
              </section>
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
