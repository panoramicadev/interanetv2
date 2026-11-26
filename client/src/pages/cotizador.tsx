/**
 * CotizadorPage — catálogo público para cotizar (/catalogo y /cotizador).
 *
 * Mismo diseño que la tienda (/tienda): encabezado con buscador, banner a todo
 * el ancho, barra de categorías y etiquetas, y la grilla de tarjetas. Pero acá
 * no hay precios ni carro: cada producto se suma a "Mi cotización" de a una
 * unidad (VENTA_POR_UNIDAD_COTIZADOR_WEB), no por bulto como en la tienda.
 * No pide iniciar sesión.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { QuoteProvider, useQuote } from '@/contexts/QuoteContext';
import ProductCardExpandable from '@/components/shared/ProductCardExpandable';
import CotizadorProductDetail from '@/components/cotizador/CotizadorProductDetail';
import CotizadorQuotePanel from '@/components/cotizador/CotizadorQuotePanel';
import CotizadorContactForm from '@/components/cotizador/CotizadorContactForm';
import CotizadorFooter from '@/components/cotizador/CotizadorFooter';
import CustomColorButton from '@/components/shared/CustomColorButton';
import { useIsMobile } from '@/hooks/use-mobile';
import { rutaCatalogo } from '@/lib/slug-producto';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
  Search, X, FileText, ChevronDown, Check, Grid3X3,
  Tag, Package, ClipboardCheck, CircleDollarSign, Truck, ShieldCheck,
} from 'lucide-react';

interface TopbarConfig {
  phone?: { value: string; visible: boolean };
  email?: { value: string; visible: boolean };
  address?: { value: string; visible: boolean };
  customText?: { value: string; visible: boolean };
}

/** Colores de las etiquetas que define el administrador (los mismos de la tienda). */
const TAG_UI_COLORS: Record<string, { bg: string; text: string; activeBg: string; activeText: string }> = {
  green: { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', activeBg: 'bg-emerald-500 border-emerald-500', activeText: 'text-white' },
  blue: { bg: 'bg-blue-50 border-blue-200', text: 'text-blue-700', activeBg: 'bg-blue-500 border-blue-500', activeText: 'text-white' },
  amber: { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', activeBg: 'bg-amber-500 border-amber-500', activeText: 'text-white' },
  red: { bg: 'bg-rose-50 border-rose-200', text: 'text-rose-700', activeBg: 'bg-rose-500 border-rose-500', activeText: 'text-white' },
  purple: { bg: 'bg-violet-50 border-violet-200', text: 'text-violet-700', activeBg: 'bg-violet-500 border-violet-500', activeText: 'text-white' },
  pink: { bg: 'bg-pink-50 border-pink-200', text: 'text-pink-700', activeBg: 'bg-pink-500 border-pink-500', activeText: 'text-white' },
  cyan: { bg: 'bg-cyan-50 border-cyan-200', text: 'text-cyan-700', activeBg: 'bg-cyan-500 border-cyan-500', activeText: 'text-white' },
  orange: { bg: 'bg-orange-50 border-orange-200', text: 'text-orange-700', activeBg: 'bg-orange-500 border-orange-500', activeText: 'text-white' },
  indigo: { bg: 'bg-indigo-50 border-indigo-200', text: 'text-indigo-700', activeBg: 'bg-indigo-500 border-indigo-500', activeText: 'text-white' },
  teal: { bg: 'bg-teal-50 border-teal-200', text: 'text-teal-700', activeBg: 'bg-teal-500 border-teal-500', activeText: 'text-white' },
};
const TAG_GRIS = { bg: 'bg-gray-50 border-gray-200', text: 'text-gray-700', activeBg: 'bg-gray-600 border-gray-600', activeText: 'text-white' };

async function leer<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.json();
}

/** Lo que se ofrece al cotizar; va en la franja de arriba del encabezado. */
const VENTAJAS = [
  { Icono: CircleDollarSign, texto: 'Facilidades de pago' },
  { Icono: Truck, texto: 'Despachos a todo Chile' },
  { Icono: ShieldCheck, texto: 'Sin registro necesario' },
];

/**
 * Banner del catálogo, armado en la página (antes era una imagen subida desde
 * el administrador). A la izquierda, la foto del camión pegada al borde y en
 * semicírculo hacia la derecha; a la derecha el texto. En celular, la foto
 * arriba y el texto abajo. La foto y
 * el logo Market salen de esa imagen: client/public/catalogo/.
 */
function BannerCotizacion() {
  return (
    <section className="w-full bg-white border-b border-gray-100 overflow-hidden" data-testid="banner-catalogo">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@700;800;900&display=swap');
        .cz-display { font-family: 'Montserrat', 'Inter', system-ui, sans-serif; }
        @keyframes cz-entra-texto  { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }
        .cz-texto  { animation: cz-entra-texto .8s .25s cubic-bezier(.2,.8,.2,1) both; }
        @media (prefers-reduced-motion: reduce) {
          .cz-texto { animation: none; }
        }
      `}</style>
      <div className="grid md:grid-cols-[42%_1fr]">
        {/* La foto del camión pegada al borde izquierdo, recta, y en semicírculo a la derecha */}
        <div className="relative w-[90%] md:w-[calc(100%-14px)] aspect-[16/11] md:aspect-auto md:min-h-[420px] lg:min-h-[500px]">
          {/* Medialuna naranja que remata la curva */}
          <div className="absolute inset-y-0 left-0 -right-2.5 md:-right-3.5 rounded-r-full bg-[#fd6301]" aria-hidden="true" />
          <div className="absolute inset-0 rounded-r-full overflow-hidden bg-slate-200 [transform:translateZ(0)]">
            <img
              src="/catalogo/banner-camion.jpg"
              alt="Camión de despacho Panorámica en carretera"
              fetchPriority="high"
              decoding="async"
              className="absolute inset-0 w-full h-full object-cover object-[45%_62%]"
            />
          </div>
        </div>

        <div className="cz-texto relative flex flex-col justify-center px-5 py-7 sm:px-8 md:px-10 lg:px-16 xl:px-20 md:py-10">
          {/* Misma receta que las secciones de pinturaspanoramica.cl: etiqueta de color,
              título Montserrat Black en negro y color, y botón con borde. */}
          <p className="cz-display mb-3 lg:mb-4 text-xs lg:text-sm font-extrabold uppercase tracking-wider text-[#fd6301]">
            Market Panorámica
          </p>

          <h2 className="cz-display font-black uppercase leading-[0.95] text-gray-950">
            <span className="block text-[22px] sm:text-[28px] md:text-[2.6vw] 2xl:text-[46px]">Solicita tu</span>
            <span className="block text-[#fd6301] text-[34px] sm:text-[46px] md:text-[4.6vw] 2xl:text-[80px] my-1 lg:my-1.5">
              Cotización<br />mayorista
            </span>
            <span className="block text-[22px] sm:text-[28px] md:text-[2.6vw] 2xl:text-[46px]">en minutos</span>
          </h2>

          <p className="mt-4 lg:mt-6 max-w-xl text-sm sm:text-base lg:text-lg leading-snug text-gray-700">
            Explora nuestro catálogo completo de productos, selecciona las cantidades que necesitas y{' '}
            <strong className="font-semibold text-gray-900">recibe una cotización personalizada directamente en tu correo.</strong>
          </p>

          <a
            href="#catalogo"
            onClick={e => {
              e.preventDefault();
              document.getElementById('catalogo')?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="cz-display mt-6 lg:mt-8 self-start inline-flex items-center h-11 px-7 rounded-full border-2 border-gray-950 text-xs lg:text-sm font-bold uppercase tracking-wide text-gray-950 hover:bg-gray-950 hover:text-white transition-colors"
          >
            Ver productos
          </a>
        </div>
      </div>
    </section>
  );
}

/** Botón "Mi cotización", en el lugar del carro de la tienda. */
function BotonCotizacion({ onClick }: { onClick: () => void }) {
  const { state } = useQuote();
  const total = state.itemCount;
  return (
    <button
      onClick={onClick}
      className="relative flex items-center gap-2 h-10 px-2 lg:px-3 rounded-2xl text-gray-700 hover:bg-[#fd6301]/10 hover:text-[#fd6301] transition-colors"
      aria-label="Mi cotización"
      data-testid="button-mi-cotizacion"
    >
      <span className="relative">
        <FileText className="h-6 w-6" />
        {total > 0 && (
          <span className="absolute -top-2 -right-2 bg-[#fd6301] text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center border-2 border-white tabular-nums">
            {total > 99 ? '99+' : total}
          </span>
        )}
      </span>
      <span className="hidden lg:inline text-sm font-bold whitespace-nowrap">Mi cotización</span>
    </button>
  );
}

function CotizadorContent() {
  const isMobile = useIsMobile();

  // ?buscar= llega desde el buscador de la página de producto
  const [searchTerm, setSearchTerm] = useState(() => new URLSearchParams(window.location.search).get('buscar') || '');
  const [debouncedSearch, setDebouncedSearch] = useState(searchTerm);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [showCategoriesDropdown, setShowCategoriesDropdown] = useState(false);
  const [quotePanelOpen, setQuotePanelOpen] = useState(false);
  const [contactFormOpen, setContactFormOpen] = useState(false);
  const [detailProduct, setDetailProduct] = useState<any>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(t);
  }, [searchTerm]);

  // La barra de filtros se pega justo bajo el encabezado, que cambia de alto
  // (en celular el logo va en su propia fila): se mide en vez de fijarlo.
  const headerRef = useRef<HTMLElement>(null);
  const [headerHeight, setHeaderHeight] = useState(0);
  // En celular la barra de familias también queda pegada arriba: se descuenta al bajar a los productos
  const barraRef = useRef<HTMLElement>(null);
  const [altoBarra, setAltoBarra] = useState(0);
  useEffect(() => {
    const el = barraRef.current;
    if (!el) { setAltoBarra(0); return; }
    const medir = () => setAltoBarra(el.offsetHeight);
    medir();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, [isMobile]);
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const medir = () => setHeaderHeight(el.offsetHeight);
    medir();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── Datos públicos ──
  const { data: config } = useQuery<any>({
    queryKey: ['/api/b2c/config'],
    queryFn: () => leer('/api/b2c/config'),
    staleTime: 5 * 60 * 1000,
  });

  const { data: topbar } = useQuery<TopbarConfig>({
    queryKey: ['/api/ecommerce/topbar-config'],
    queryFn: () => leer('/api/ecommerce/topbar-config'),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const { data: categoriesData } = useQuery<{ categories: string[] }>({
    queryKey: ['/api/b2c/catalog/categories'],
    queryFn: () => leer('/api/b2c/catalog/categories'),
    staleTime: 5 * 60 * 1000,
  });

  // Orden de las categorías de la tienda, para que las dos páginas se lean igual
  const { data: ordenTienda = [] } = useQuery<string[]>({
    queryKey: ['/api/store/categories'],
    queryFn: () => leer('/api/store/categories'),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const { data: adminTags = [] } = useQuery<{ name: string; color: string }[]>({
    queryKey: ['/api/store/tags'],
    queryFn: () => leer('/api/store/tags'),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  // La búsqueda la resuelve el servidor (busca también por código, color y descripción).
  // La familia y la etiqueta se filtran acá, sobre lo que ya llegó: cambiar de familia es
  // instantáneo y no deja la lista en blanco esperando al servidor. Al buscar, la lista
  // anterior queda a la vista hasta que llega la nueva.
  const { data: catalogData, isLoading, isFetching } = useQuery<{ catalog: any[] }>({
    queryKey: ['/api/b2c/catalog', debouncedSearch, 'all'],
    queryFn: () => leer(debouncedSearch ? `/api/b2c/catalog?search=${encodeURIComponent(debouncedSearch)}` : '/api/b2c/catalog'),
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });

  // Catálogo completo, para contar etiquetas sin importar el filtro
  const { data: fullCatalogData } = useQuery<{ catalog: any[] }>({
    queryKey: ['/api/b2c/catalog', '', 'all'],
    queryFn: () => leer('/api/b2c/catalog'),
    staleTime: 30_000,
  });

  // Las mismas familias que la tienda: las que se definen en Productos > Categorías,
  // en ese orden. Un producto sin una de ellas asignada (como en la tienda) sale
  // solo en "Todos". Si esa lista no llega, se muestran las del catálogo.
  const categories = useMemo(() => {
    const lista = categoriesData?.categories || [];
    if (ordenTienda.length > 0) return ordenTienda.filter(c => lista.includes(c));
    return [...lista].sort((a, b) => a.localeCompare(b, 'es'));
  }, [categoriesData, ordenTienda]);

  const conteoFamilia = useMemo(() => {
    const cuenta = new Map<string, number>();
    (fullCatalogData?.catalog || []).forEach(p => {
      (p.categories || []).forEach((c: string) => cuenta.set(c, (cuenta.get(c) || 0) + 1));
    });
    return cuenta;
  }, [fullCatalogData]);
  const totalCatalogo = fullCatalogData?.catalog?.length ?? 0;

  const availableTags = useMemo(() => {
    const colores = new Map(adminTags.map(t => [t.name, t.color]));
    const cuenta = new Map<string, number>();
    (fullCatalogData?.catalog || []).forEach(p => {
      (p.tags || []).forEach((tag: string) => {
        if (colores.has(tag)) cuenta.set(tag, (cuenta.get(tag) || 0) + 1);
      });
    });
    return Array.from(cuenta.entries())
      .map(([name, count]) => ({ name, count, color: colores.get(name) || 'gray' }))
      .sort((a, b) => b.count - a.count);
  }, [fullCatalogData, adminTags]);

  const products = useMemo(() => {
    let lista = catalogData?.catalog || [];
    if (selectedCategory !== 'all') lista = lista.filter(p => (p.categories || []).includes(selectedCategory));
    if (selectedTag) lista = lista.filter(p => (p.tags || []).includes(selectedTag));
    return lista;
  }, [catalogData, selectedCategory, selectedTag]);

  const cambiarBusqueda = (valor: string) => {
    setSearchTerm(valor);
    if (valor) {
      setSelectedCategory('all');
      setSelectedTag(null);
    }
  };

  const limpiarFiltros = () => {
    setSearchTerm('');
    setSelectedCategory('all');
    setSelectedTag(null);
  };

  const elegirFamilia = (familia: string) => {
    setSelectedCategory(familia);
    setSelectedTag(null);
    // Después de que la lista se vuelve a dibujar con la familia elegida
    setTimeout(() => document.getElementById('catalogo')?.scrollIntoView({ behavior: 'smooth' }), 0);
  };

  const elegirEtiqueta = (nombre: string) => {
    setSelectedTag(selectedTag === nombre ? null : nombre);
    setSelectedCategory('all');
  };

  const abrirCotizacion = () => setQuotePanelOpen(true);
  const buscando = searchTerm !== debouncedSearch || (isFetching && !!debouncedSearch);

  const textoCorto = topbar?.customText?.visible && topbar.customText.value ? topbar.customText.value : null;

  return (
    <div className="min-h-screen bg-white">
      {/* ═══ Encabezado ═══ */}
      <header ref={headerRef} className="bg-white sticky top-0 z-50 border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Franja de arriba: lo que se ofrece al cotizar */}
          {/* En escritorio: las ventajas al medio y "Cotiza sin costo" a la derecha */}
          <div className="flex flex-col items-center gap-1.5 md:grid md:grid-cols-[1fr_auto_1fr] md:gap-4 py-1.5 md:py-1 text-[10px] md:text-[11px] text-gray-500 border-b border-gray-100/80">
            <span className="hidden md:block" aria-hidden="true" />
            <ul className="flex flex-wrap items-center justify-center gap-x-3 md:gap-x-5 gap-y-1">
              {VENTAJAS.map(({ Icono, texto }) => (
                <li key={texto} className="flex items-center gap-1 whitespace-nowrap">
                  <Icono className="h-3 w-3 flex-shrink-0" />
                  {texto}
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-center justify-center md:justify-end gap-2 md:gap-3 w-full md:w-auto">
              <span className="text-[#fd6301] font-semibold flex items-center gap-1">
                <ClipboardCheck className="h-3 w-3" />
                Cotiza sin costo y sin registrarte
              </span>
              {textoCorto && (
                <>
                  <span className="hidden md:inline text-gray-200">|</span>
                  <span className="text-[#fd6301] font-semibold text-center">{textoCorto}</span>
                </>
              )}
            </div>
          </div>

          {/* Logo, buscador y acciones */}
          <div className="flex flex-wrap md:flex-nowrap items-center justify-between py-2 md:py-3 gap-x-2 gap-y-2 md:gap-4">
            <div className="w-full md:w-auto flex justify-center md:justify-start flex-shrink-0">
              <a
                href={rutaCatalogo()}
                onClick={e => {
                  // Ya estamos en el catálogo: vuelve arriba y limpia filtros sin recargar la página
                  e.preventDefault();
                  limpiarFiltros();
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="flex items-center flex-shrink-0 group"
                aria-label="Catálogo"
              >
                <img
                  src="/catalogo/market-panoramica.png"
                  alt="Market Panorámica"
                  className="h-9 md:h-10 w-auto transition-transform group-hover:scale-[1.02]"
                />
              </a>
            </div>

            <div className="flex-1 md:max-w-xl mx-1 md:mx-0">
              <div className="relative w-full group">
                {buscando ? (
                  <div className="absolute left-3 md:left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 md:h-4 md:w-4 border-2 border-[#fd6301] border-t-transparent rounded-full animate-spin z-10" />
                ) : (
                  <Search className="absolute left-3 md:left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 md:h-4 md:w-4 text-gray-400 group-focus-within:text-[#fd6301] transition-colors z-10 pointer-events-none" />
                )}
                <input
                  type="search"
                  value={searchTerm}
                  onChange={e => cambiarBusqueda(e.target.value)}
                  placeholder={isMobile ? 'Buscar productos...' : 'Buscar productos...'}
                  aria-label="Buscar productos"
                  className="w-full h-9 md:h-10 pl-8 md:pl-10 pr-9 md:pr-[13.5rem] text-xs md:text-sm rounded-xl border border-gray-200 bg-gray-50/80 hover:bg-white focus:bg-white focus:outline-none focus:border-[#fd6301] focus:ring-2 focus:ring-[#fd6301]/10 transition-all shadow-sm [&::-webkit-search-cancel-button]:hidden"
                  data-testid="input-search-catalogo"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 md:right-[13.75rem] top-1/2 -translate-y-1/2 h-4 w-4 md:h-5 md:w-5 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center text-gray-500 transition-colors z-10"
                    aria-label="Borrar búsqueda"
                  >
                    <X className="h-2.5 w-2.5 md:h-3 md:w-3" />
                  </button>
                )}

                {/* Menú desplegable de familias, al final del buscador (en celular va en la barra de abajo) */}
                <div className="hidden md:block absolute right-1 top-1 bottom-1 w-[13rem]">
                  {/* modal={false}: el menú no bloquea la página mientras se cierra, así el
                      salto a los productos ocurre al tiro y no queda "pegado". */}
                  <DropdownMenu modal={false}>
                    <DropdownMenuTrigger asChild>
                      <button
                        className="h-full w-full flex items-center justify-between gap-2 pl-3 pr-2.5 rounded-lg border-l border-gray-200 text-xs font-semibold text-gray-700 hover:bg-white hover:text-[#fd6301] data-[state=open]:bg-white data-[state=open]:text-[#fd6301] transition-colors"
                        data-testid="menu-familias"
                      >
                        <span className="flex items-center gap-1.5 min-w-0">
                          <Grid3X3 className="h-3.5 w-3.5 flex-shrink-0 text-[#fd6301]" />
                          <span className="truncate uppercase tracking-wide">{selectedCategory === 'all' ? 'Catálogo' : selectedCategory}</span>
                        </span>
                        <ChevronDown className="h-3.5 w-3.5 flex-shrink-0 opacity-60" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      sideOffset={8}
                      onCloseAutoFocus={e => e.preventDefault()}
                      className="w-64 rounded-xl p-1.5 shadow-xl border-gray-200/80"
                    >
                      {[{ id: 'all', texto: 'Todas las familias', total: totalCatalogo }, ...categories.map(c => ({ id: c, texto: c, total: conteoFamilia.get(c) || 0 }))].map(({ id, texto, total }) => {
                        const activa = selectedCategory === id && !selectedTag;
                        return (
                          <DropdownMenuItem
                            key={id}
                            onSelect={() => elegirFamilia(id)}
                            className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-xs font-semibold cursor-pointer ${activa ? 'bg-orange-50 text-[#fd6301] focus:bg-orange-50 focus:text-[#fd6301]' : 'text-gray-700'}`}
                          >
                            <span className="truncate">{texto}</span>
                            <span className="flex items-center gap-1.5 flex-shrink-0">
                              {total > 0 && <span className={`text-[10px] tabular-nums ${activa ? 'text-[#fd6301]' : 'text-gray-400'}`}>{total}</span>}
                              {activa && <Check className="h-3.5 w-3.5" />}
                            </span>
                          </DropdownMenuItem>
                        );
                      })}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <CustomColorButton variant={isMobile ? 'icon' : 'compact'} />
              <BotonCotizacion onClick={abrirCotizacion} />
            </div>
          </div>
        </div>
      </header>

      {/* ═══ Banner a todo el ancho (se esconde al buscar) ═══ */}
      {!searchTerm && <BannerCotizacion />}

      {/* ═══ Barra de familias y etiquetas: solo en celular, donde el menú del buscador no cabe ═══ */}
      {isMobile && (
      <section
        ref={barraRef}
        data-sin-brillo=""
        className="bg-white border-b border-gray-100 sticky z-40"
        style={{ top: `${headerHeight}px` }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5">
          <div className="flex items-center gap-2">
              <div className="flex flex-col gap-2 w-full">
                <div className="w-full relative">
                  <button
                    onClick={() => setShowCategoriesDropdown(v => !v)}
                    className={`h-9 w-full text-[11px] font-bold rounded-xl gap-1.5 flex items-center justify-between px-3 transition-all duration-300 ${
                      showCategoriesDropdown
                        ? 'bg-[#fd6301] text-white shadow-lg shadow-orange-200/50 border border-[#fd6301]'
                        : 'bg-white text-gray-700 border border-gray-200 shadow-sm hover:border-orange-200 hover:shadow-md'
                    }`}
                  >
                    <span className="flex items-center gap-1.5 min-w-0">
                      <Grid3X3 className={`h-3.5 w-3.5 flex-shrink-0 ${showCategoriesDropdown ? 'text-white' : 'text-[#fd6301]'}`} />
                      <span className="truncate">{selectedCategory === 'all' ? 'Categorías' : selectedCategory}</span>
                      <span className={`tabular-nums font-semibold ${showCategoriesDropdown ? 'text-white/80' : 'text-gray-400'}`}>· {products.length}</span>
                    </span>
                    <ChevronDown className={`h-3.5 w-3.5 flex-shrink-0 transition-transform duration-300 ${showCategoriesDropdown ? 'rotate-180' : ''}`} />
                  </button>

                  <div
                    className="overflow-hidden transition-all duration-300 ease-in-out"
                    style={{
                      maxHeight: showCategoriesDropdown ? `${(categories.length + 1) * 44 + 40}px` : '0px',
                      opacity: showCategoriesDropdown ? 1 : 0,
                    }}
                  >
                    <div className="pt-2 pb-1">
                      <div className="bg-white rounded-xl border border-gray-100 shadow-lg shadow-gray-200/50 overflow-hidden">
                        {['all', ...categories].map(cat => {
                          const activa = selectedCategory === cat && !selectedTag;
                          return (
                            <button
                              key={cat}
                              onClick={() => { setSelectedCategory(cat); setSelectedTag(null); setShowCategoriesDropdown(false); }}
                              className={`w-full flex items-center justify-between px-4 py-2.5 text-xs font-bold transition-colors border-l-[3px] ${
                                activa
                                  ? 'bg-gradient-to-r from-orange-50 to-amber-50 text-[#fd6301] border-l-[#fd6301]'
                                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 border-l-transparent'
                              }`}
                            >
                              <span>{cat === 'all' ? 'Todas las categorías' : cat}</span>
                              {activa && <Check className="h-3.5 w-3.5 text-[#fd6301]" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {availableTags.length > 0 && (
                  <div className="grid gap-2 py-0.5" style={{ gridTemplateColumns: `repeat(${Math.min(availableTags.length, 3)}, 1fr)` }}>
                    {availableTags.map(({ name, color }) => {
                      const activa = selectedTag === name;
                      const c = TAG_UI_COLORS[color] || TAG_GRIS;
                      return (
                        <button
                          key={name}
                          onClick={() => elegirEtiqueta(name)}
                          className={`px-2 py-1.5 rounded-full text-[9px] font-bold transition-all border flex items-center justify-center gap-1 whitespace-nowrap hover:shadow-sm ${activa ? `${c.activeBg} ${c.activeText}` : `${c.bg} ${c.text}`}`}
                        >
                          <Tag className="h-2.5 w-2.5 flex-shrink-0" />
                          {name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
          </div>
        </div>
      </section>
      )}

      {/* ═══ Productos ═══ (los botones "Ver productos" y el menú de familias bajan hasta acá) */}
      <section
        id="catalogo"
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8"
        style={{ scrollMarginTop: `${headerHeight + altoBarra}px` }}
      >
        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-pulse text-gray-500 mb-4">Cargando productos...</div>
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />
              ))}
            </div>
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-gray-200">
            <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No se encontraron productos</h3>
            <p className="text-gray-500 mb-4">Intenta cambiar la búsqueda o la categoría seleccionada.</p>
            <button
              onClick={limpiarFiltros}
              className="h-10 px-4 rounded-2xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:border-orange-200 hover:text-[#fd6301] transition-colors"
            >
              Limpiar filtros
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {products.map(product => (
              <ProductCardExpandable
                key={product.genericName}
                mode="cotizador"
                product={product}
                adminTags={adminTags}
                onViewDetail={setDetailProduct}
                onOpenQuotePanel={abrirCotizacion}
              />
            ))}
          </div>
        )}
      </section>

      <CotizadorFooter config={config} />

      {/* ═══ Cotización, datos de contacto y detalle ═══ */}
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
        onOpenQuotePanel={abrirCotizacion}
      />
    </div>
  );
}

// La cotización tiene su propio estado, aparte del carro de la tienda
export default function CotizadorPage() {
  return (
    <QuoteProvider>
      <CotizadorContent />
    </QuoteProvider>
  );
}
