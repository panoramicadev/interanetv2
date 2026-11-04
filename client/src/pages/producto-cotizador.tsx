/**
 * Página de producto del cotizador público: tienda.pinturaspanoramica.cl/productos/:slug.
 * Muestra la ficha completa y agrega a la misma cotización que el catálogo (QuoteContext
 * persiste en localStorage, así que la lista se mantiene al ir y volver).
 */
import { useEffect, useState, type CSSProperties } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRoute, useLocation, Link } from 'wouter';
import { ChevronRight, Package, ArrowLeft, ArrowRight, Truck, ShieldCheck, Clock, Share2, Check, Box, Palette, FileText, Wrench, PackageOpen } from 'lucide-react';
import { QuoteProvider } from '@/contexts/QuoteContext';
import CotizadorHeader from '@/components/cotizador/CotizadorHeader';
import CotizadorQuotePanel from '@/components/cotizador/CotizadorQuotePanel';
import CotizadorContactForm from '@/components/cotizador/CotizadorContactForm';
import CotizadorFooter from '@/components/cotizador/CotizadorFooter';
import { useSeleccionCotizador, SelectorVariantes, BotonAgregarCotizacion, type ProductData } from '@/components/cotizador/CotizadorSelector';
import { imagenLiviana } from '@/lib/imagen-liviana';
import { slugProducto } from '@/lib/slug-producto';
import { useAparecer } from '@/hooks/use-aparecer';
import CotizadorVitrina from '@/components/cotizador/CotizadorVitrina';

function Ficha({ product, onOpenQuotePanel }: { product: ProductData; onOpenQuotePanel: () => void }) {
  const sel = useSeleccionCotizador(product);
  const [copiado, setCopiado] = useState(false);
  // Imagen de la vitrina: la del producto, o la del color que se está mirando
  const [vistaPrevia, setVistaPrevia] = useState<string | undefined>();
  const [colorFijo, setColorFijo] = useState<string | undefined>();
  const imagenVitrina = vistaPrevia || colorFijo || product.imageUrl;

  const compartir = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: product.genericName, url });
      else {
        await navigator.clipboard.writeText(url);
        setCopiado(true);
        setTimeout(() => setCopiado(false), 2000);
      }
    } catch { /* el usuario canceló */ }
  };

  const secciones = [
    { titulo: 'Descripción', icono: FileText, texto: product.descripcion },
    { titulo: 'Usos', icono: Wrench, texto: product.usos },
    { titulo: 'Presentación', icono: PackageOpen, texto: product.presentacion },
  ].filter((s) => s.texto);
  const [seccion, setSeccion] = useState(secciones[0]?.titulo);
  const seccionActiva = secciones.find((s) => s.titulo === seccion);

  // Un color por miniatura (la primera variante con imagen de cada color)
  const miniaturas = Object.entries(product.colors)
    .map(([color, vs]) => ({ color, imageUrl: vs.find((v) => v.imageUrl)?.imageUrl }))
    .filter((m): m is { color: string; imageUrl: string } => !!m.imageUrl && m.imageUrl !== product.imageUrl)
    .slice(0, 8);
  const formatos = new Set(Object.values(product.colors).flat().map((v) => v.format)).size;
  const colores = Object.keys(product.colors).length;

  const retraso = (i: number) => ({ '--cz-delay': `${i * 70}ms` } as CSSProperties);

  return (
    <div className="grid lg:grid-cols-[1fr_1fr] gap-6 lg:gap-12 items-start">
      {/* Vitrina */}
      <div className="lg:sticky lg:top-32 space-y-3">
        <CotizadorVitrina
          imageUrl={imagenVitrina}
          alt={product.genericName}
          className="aspect-square rounded-3xl border border-slate-200/70 shadow-xl shadow-orange-500/5"
        >
          {product.tags && product.tags.length > 0 && (
            <div className="absolute top-4 left-4 z-10 flex flex-wrap gap-1.5">
              {product.tags.map((tag, i) => (
                <span key={tag} style={retraso(i + 3)} className="cz-subir px-2.5 py-1 rounded-full bg-white text-[11px] font-bold text-[#fd6301] shadow-sm">{tag}</span>
              ))}
            </div>
          )}
          <div className="absolute bottom-4 left-4 right-4 z-10 flex gap-2">
            {[
              { icono: Box, valor: formatos, texto: formatos === 1 ? 'formato' : 'formatos' },
              { icono: Palette, valor: colores, texto: colores === 1 ? 'color' : 'colores' },
            ].map(({ icono: Icono, valor, texto }, i) => (
              <div key={texto} style={retraso(i + 4)} className="cz-subir flex items-center gap-2 px-3 py-2 rounded-2xl bg-white/80 backdrop-blur border border-white shadow-sm">
                <Icono className="w-4 h-4 text-[#fd6301]" />
                <span className="text-sm font-black text-slate-900 tabular-nums">{valor}</span>
                <span className="text-[11px] font-semibold text-slate-500">{texto}</span>
              </div>
            ))}
          </div>
        </CotizadorVitrina>

        {miniaturas.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <button
              onClick={() => setColorFijo(undefined)}
              className={`flex-shrink-0 w-16 h-16 rounded-2xl border-2 bg-white p-1.5 transition-all hover:-translate-y-0.5 ${!colorFijo ? 'border-[#fd6301] shadow-md shadow-orange-500/20' : 'border-slate-200 hover:border-slate-300'}`}
              aria-label="Imagen del producto"
            >
              {product.imageUrl && <img src={imagenLiviana(product.imageUrl, 120)} alt="" className="w-full h-full object-contain" />}
            </button>
            {miniaturas.map((m, i) => (
              <button
                key={m.color}
                onClick={() => setColorFijo(m.imageUrl)}
                style={retraso(i)}
                className={`cz-subir flex-shrink-0 w-16 h-16 rounded-2xl border-2 bg-white p-1.5 transition-all hover:-translate-y-0.5 ${colorFijo === m.imageUrl ? 'border-[#fd6301] shadow-md shadow-orange-500/20' : 'border-slate-200 hover:border-slate-300'}`}
                title={m.color}
                aria-label={`Ver ${m.color}`}
              >
                <img src={imagenLiviana(m.imageUrl, 120)} alt="" loading="lazy" className="w-full h-full object-contain" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Información y selector */}
      <div className="space-y-5">
        <div>
          {product.groupName && (
            <p style={retraso(0)} className="cz-subir text-xs font-bold uppercase tracking-[0.15em] text-[#fd6301] mb-2">{product.groupName}</p>
          )}
          <h1 style={retraso(1)} className="cz-subir text-3xl sm:text-5xl font-black text-slate-900 uppercase tracking-tight leading-[1.02]">{product.genericName}</h1>
          <div className="cz-raya mt-4 h-1.5 rounded-full bg-gradient-to-r from-[#fd6301] to-amber-400" />
          {product.breveResena && <p style={retraso(2)} className="cz-subir mt-4 text-base sm:text-lg text-slate-600 leading-relaxed">{product.breveResena}</p>}
        </div>

        <div style={retraso(3)} className="cz-subir rounded-3xl border border-slate-200/70 bg-white p-4 sm:p-5 shadow-xl shadow-slate-900/5 space-y-4">
          <SelectorVariantes sel={sel} onAdded={onOpenQuotePanel} onPreview={setVistaPrevia} />
          <BotonAgregarCotizacion sel={sel} onAdded={onOpenQuotePanel} />
          <p className="text-[11px] text-slate-400 text-center">Cotización sin compromiso · sin registro · respuesta en 24 horas</p>
        </div>

        <div style={retraso(4)} className="cz-subir grid grid-cols-3 gap-2">
          {[
            { icon: Truck, text: 'Envío gratis en Temuco' },
            { icon: Clock, text: 'Despacho el mismo día' },
            { icon: ShieldCheck, text: 'Por mayor y al detalle' },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="group flex flex-col items-center text-center gap-1.5 rounded-2xl bg-slate-50 p-3 border border-transparent hover:border-orange-200 hover:bg-orange-50/60 transition-colors">
              <Icon className="w-4 h-4 text-[#fd6301] transition-transform group-hover:scale-125" />
              <span className="text-[11px] font-semibold text-slate-600 leading-tight">{text}</span>
            </div>
          ))}
        </div>

        {secciones.length > 0 && (
          <div style={retraso(5)} className="cz-subir rounded-3xl border border-slate-200/70 bg-slate-50/60 overflow-hidden">
            <div className="flex gap-1 p-1 bg-slate-100/80" role="tablist">
              {secciones.map(({ titulo, icono: Icono }) => (
                <button
                  key={titulo}
                  role="tab"
                  aria-selected={titulo === seccion}
                  onClick={() => setSeccion(titulo)}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-2xl text-xs font-bold transition-all ${
                    titulo === seccion ? 'bg-white text-[#fd6301] shadow-sm' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Icono className="w-3.5 h-3.5" /> {titulo}
                </button>
              ))}
            </div>
            <p key={seccion} className="cz-subir px-4 py-4 text-sm text-slate-600 leading-relaxed whitespace-pre-line">{seccionActiva?.texto}</p>
          </div>
        )}

        <button
          onClick={compartir}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl border border-slate-200 text-sm font-semibold text-slate-600 hover:border-orange-200 hover:text-[#fd6301] transition-colors"
        >
          {copiado ? <Check className="w-4 h-4 text-emerald-500" /> : <Share2 className="w-4 h-4" />}
          {copiado ? 'Enlace copiado' : 'Compartir producto'}
        </button>
      </div>
    </div>
  );
}

function Relacionado({ p, i }: { p: ProductData; i: number }) {
  const ref = useAparecer<HTMLDivElement>();
  return (
    <div ref={ref} className="cz-revelar" style={{ '--cz-delay': `${i * 80}ms` } as CSSProperties}>
    <Link
      href={`/productos/${slugProducto(p.genericName)}`}
      className="group block rounded-3xl border border-slate-200/70 bg-white p-3 sm:p-4 hover:border-orange-200 hover:shadow-xl hover:shadow-orange-500/10 hover:-translate-y-1 transition-[box-shadow,border-color,translate]"
    >
      <div className="relative aspect-square rounded-2xl bg-gradient-to-br from-slate-50 to-orange-50/60 flex items-center justify-center mb-3 overflow-hidden">
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_50%_60%,rgba(253,99,1,.18),transparent_60%)] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        <img src={imagenLiviana(p.imageUrl, 360)} alt={p.genericName} loading="lazy" className="relative w-[80%] h-[80%] object-contain transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-3" />
      </div>
      <p className="text-sm font-bold text-slate-800 leading-snug line-clamp-2 group-hover:text-[#fd6301] transition-colors">{p.genericName}</p>
      <p className="text-xs text-slate-400 mt-0.5">{Object.keys(p.colors || {}).length} colores</p>
    </Link>
    </div>
  );
}

function ProductoCotizadorContent() {
  const [, params] = useRoute<{ slug: string }>('/productos/:slug');
  const [, setLocation] = useLocation();
  const slug = params?.slug || '';
  const [searchTerm, setSearchTerm] = useState('');
  const [quotePanelOpen, setQuotePanelOpen] = useState(false);
  const [contactFormOpen, setContactFormOpen] = useState(false);

  const { data: config } = useQuery({
    queryKey: ['/api/b2c/config'],
    queryFn: async () => (await fetch('/api/b2c/config')).json(),
    staleTime: 5 * 60 * 1000,
  });

  // Mismo catálogo y misma clave de caché que la portada: si se viene de ahí, no se vuelve a pedir
  const { data: catalogData, isLoading } = useQuery({
    queryKey: ['/api/b2c/catalog', '', 'all'],
    queryFn: async () => (await fetch('/api/b2c/catalog')).json(),
    staleTime: 30_000,
  });

  const catalog: ProductData[] = catalogData?.catalog || [];
  const product = catalog.find((p) => slugProducto(p.genericName) === slug) || null;
  const relacionados = product
    ? catalog.filter((p) => p !== product && p.imageUrl && p.groupName === product.groupName).slice(0, 4)
    : [];

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [slug]);

  useEffect(() => {
    if (!product) return;
    const prev = document.title;
    document.title = `${product.genericName} · Pinturas Panorámica`;
    return () => { document.title = prev; };
  }, [product]);

  return (
    <div className="min-h-screen bg-white">
      <CotizadorHeader
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        onSearchSubmit={(term) => setLocation(term ? `/?buscar=${encodeURIComponent(term)}` : '/')}
        onOpenQuotePanel={() => setQuotePanelOpen(true)}
        config={config}
      />

      <main className="max-w-7xl mx-auto px-4 py-5 sm:py-8">
        <nav className="flex items-center gap-1.5 text-xs text-slate-400 mb-5 sm:mb-8 min-w-0">
          <Link href="/" className="inline-flex items-center gap-1 hover:text-[#fd6301] font-semibold flex-shrink-0">
            <ArrowLeft className="w-3.5 h-3.5" /> Catálogo
          </Link>
          {product?.groupName && (
            <>
              <ChevronRight className="w-3 h-3 flex-shrink-0" />
              <span className="flex-shrink-0">{product.groupName}</span>
            </>
          )}
          {product && (
            <>
              <ChevronRight className="w-3 h-3 flex-shrink-0" />
              <span className="text-slate-600 font-semibold truncate">{product.genericName}</span>
            </>
          )}
        </nav>

        {isLoading ? (
          <div className="flex justify-center py-32">
            <div className="w-12 h-12 border-4 border-[#fd6301] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !product ? (
          <div className="flex flex-col items-center text-center py-24">
            <div className="w-20 h-20 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
              <Package className="w-10 h-10 text-slate-300" />
            </div>
            <h1 className="text-xl font-black text-slate-800 mb-1">No encontramos este producto</h1>
            <p className="text-sm text-slate-500 mb-5">Puede que haya cambiado de nombre o ya no esté en el catálogo.</p>
            <Link href="/" className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-[#fd6301] hover:bg-[#e35400] text-white text-sm font-bold">
              Ver el catálogo <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <>
            <Ficha key={product.genericName} product={product} onOpenQuotePanel={() => setQuotePanelOpen(true)} />

            {relacionados.length > 0 && (
              <section className="mt-14 sm:mt-20">
                <div className="flex items-end justify-between mb-4">
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 uppercase tracking-tight">También en {product.groupName?.toLowerCase()}</h2>
                  <Link href="/" className="hidden sm:inline-flex items-center gap-1 text-sm font-bold text-[#fd6301] hover:text-[#e35400]">
                    Ver todo <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                  {relacionados.map((p, i) => <Relacionado key={p.genericName} p={p} i={i} />)}
                </div>
              </section>
            )}
          </>
        )}
      </main>

      <CotizadorFooter config={config} />

      <CotizadorQuotePanel
        open={quotePanelOpen}
        onClose={() => setQuotePanelOpen(false)}
        onSubmit={() => { setQuotePanelOpen(false); setContactFormOpen(true); }}
      />
      <CotizadorContactForm open={contactFormOpen} onClose={() => setContactFormOpen(false)} />
    </div>
  );
}

export default function ProductoCotizadorPage() {
  return (
    <QuoteProvider>
      <ProductoCotizadorContent />
    </QuoteProvider>
  );
}
