/**
 * Hero del cotizador público. Mensaje a la izquierda (con la palabra destacada rotando)
 * y, a la derecha, una vitrina animada con los productos destacados reales del catálogo.
 * Abajo, las categorías. El movimiento es mínimo y respeta prefers-reduced-motion.
 */
import { useEffect, useRef, useState } from 'react';
import { imagenLiviana } from '@/lib/imagen-liviana';
import { ArrowRight, Check, MessageCircle, Palette, Package } from 'lucide-react';

interface CotizadorHeroProps {
  products: any[];
  categories: string[];
  config: any;
  onExplore: () => void;
  onSelectCategory: (category: string) => void;
  onViewDetail: (product: any) => void;
}

const ROTATING_WORDS = ['pinturas', 'esmaltes', 'estucos', 'barnices', 'texturas'];

const STEPS = [
  { n: '1', text: 'Elige tus productos' },
  { n: '2', text: 'Define cantidades' },
  { n: '3', text: 'Recibe tu cotización' },
];

// Solo animaciones baratas (opacity/transform, una vez o al cambiar): nada corre en bucle.
const HERO_CSS = `
@keyframes ch-up { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
@keyframes ch-fade { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
@keyframes ch-slide { from { transform: translateY(100%); } to { transform: none; } }
@keyframes ch-progress { from { transform: scaleX(0); } to { transform: scaleX(1); } }
.ch-up { opacity: 0; animation: ch-up .5s ease-out forwards; }
.ch-word-clip { display: inline-block; overflow: hidden; vertical-align: bottom; }
.ch-word { display: inline-block; animation: ch-slide .32s cubic-bezier(.2,.8,.2,1); }
.ch-pop { animation: ch-fade .4s ease-out; }
.ch-progress { transform-origin: left; animation: ch-progress 5s linear; }
@media (prefers-reduced-motion: reduce) {
  .ch-up, .ch-word, .ch-pop, .ch-progress { animation: none !important; opacity: 1 !important; }
}
`;

// Vitrina del hero, en este orden (elegidos por comercial). Si alguno sale del catálogo,
// se completa con los destacados.
const VITRINA = ['ESMALTE AL AGUA COPPER', 'VITROPLUS', 'STAIN', 'LATEX SUPER CUBRIENTE', 'ANTICORROSIVO ESTRUCTURAL'];

function pickHeroProducts(products: any[]) {
  const withImage = products.filter((p) => p.imageUrl);
  const elegidos = VITRINA.map((n) => withImage.find((p) => p.genericName === n)).filter(Boolean);
  const featured = withImage.filter((p) => !elegidos.includes(p) && (p.tags || []).some((t: string) => t.startsWith('Destacado')));
  const rest = withImage.filter((p) => !elegidos.includes(p) && !featured.includes(p));
  return [...elegidos, ...featured, ...rest].slice(0, 5);
}

function formatsOf(product: any): string[] {
  const set = new Set<string>();
  Object.values(product.colors || {}).forEach((variants: any) => variants.forEach((v: any) => v.format && set.add(v.format)));
  return Array.from(set);
}

export default function CotizadorHero({ products, categories, config, onExplore, onSelectCategory, onViewDetail }: CotizadorHeroProps) {
  const heroProducts = pickHeroProducts(products);
  const whatsapp = config?.contactInfo?.whatsapp?.replace(/\D/g, '');
  const [wordIndex, setWordIndex] = useState(0);
  const [active, setActive] = useState(0);
  // Fuera de pantalla no se anima nada: ahorra CPU y batería al recorrer el catálogo
  const sectionRef = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const el = sectionRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    const t = setInterval(() => setWordIndex((i) => (i + 1) % ROTATING_WORDS.length), 2400);
    return () => clearInterval(t);
  }, [visible]);

  useEffect(() => {
    if (!visible || heroProducts.length < 2) return;
    const t = setTimeout(() => setActive((i) => (i + 1) % heroProducts.length), 5000);
    return () => clearTimeout(t);
  }, [active, heroProducts.length, visible]);

  const product = heroProducts[active % Math.max(heroProducts.length, 1)];
  const colorCount = product ? Object.keys(product.colors || {}).length : 0;
  const formats = product ? formatsOf(product) : [];

  return (
    <section ref={sectionRef} className="relative overflow-hidden bg-white" data-testid="cotizador-hero">
      <style>{HERO_CSS}</style>

      {/* Fondo suave (gradiente plano, sin blur) */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,#fff1e6_0%,transparent_55%)]" />

      <div className="relative max-w-7xl mx-auto px-4 pt-6 pb-8 md:pt-14 md:pb-14">
        {/* Celular: mensaje → vitrina → acciones. Escritorio: mensaje y acciones a la izquierda, vitrina a la derecha */}
        <div className="grid lg:grid-cols-[1.05fr_1fr] lg:grid-rows-[1fr_auto] gap-x-14 gap-y-6 lg:gap-y-0">
          {/* Mensaje */}
          <div className="lg:col-start-1 lg:row-start-1 lg:self-end">
            <p className="ch-up text-[11px] md:text-sm font-bold uppercase tracking-[0.18em] text-slate-400 mb-3 md:mb-5" style={{ animationDelay: '0ms' }}>
              <span className="hidden sm:inline">Pinturas Panorámica · </span><span className="text-[#fd6301]">Por mayor y al detalle</span>
            </p>

            <h1 className="ch-up uppercase text-[2.2rem] leading-[1] sm:text-[3.4rem] lg:text-[3.9rem] font-black text-slate-900 tracking-tight mb-5 md:mb-6" style={{ animationDelay: '60ms' }}>
              Cotiza tus
              <br />
              {/* Entra deslizándose dentro de un recorte, sin transparencia: nunca se ve a medias */}
              <span className="ch-word-clip">
                <span key={wordIndex} className="ch-word text-[#fd6301]">{ROTATING_WORDS[wordIndex]}</span>
              </span>
              <br />
              en minutos
            </h1>

            <p className="ch-up text-[15px] md:text-lg text-slate-600 leading-relaxed max-w-lg lg:mb-8" style={{ animationDelay: '160ms' }}>
              Desde un galón para tu casa hasta el pedido completo de tu obra. Arma tu lista y recibe
              una cotización en tu correo.
            </p>
          </div>

          {/* Acciones */}
          <div className="lg:col-start-1 lg:row-start-2 lg:self-start order-last lg:order-none">
            <div className="ch-up flex flex-col sm:flex-row gap-3 mb-6 md:mb-10" style={{ animationDelay: '240ms' }}>
              <button
                onClick={onExplore}
                className="group inline-flex items-center justify-center gap-2 px-7 py-4 bg-gradient-to-r from-[#fd6301] to-[#fd6301] hover:from-[#e35400] hover:to-[#e35400] text-white text-base font-bold rounded-2xl shadow-lg shadow-[#fd6301]/30 transition-all active:scale-[0.98]"
                data-testid="hero-explorar"
              >
                Explorar catálogo
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
              {whatsapp && (
                <a
                  href={`https://wa.me/${whatsapp}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-7 py-4 bg-white border border-slate-200 hover:border-orange-200 hover:bg-orange-50/50 text-slate-700 text-base font-semibold rounded-2xl shadow-sm transition-all"
                >
                  <MessageCircle className="w-4 h-4 text-emerald-500" />
                  Hablar con un vendedor
                </a>
              )}
            </div>

            {/* Cómo funciona: 3 columnas en celular, en línea en escritorio */}
            <ol className="ch-up grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-x-2 sm:gap-y-3" style={{ animationDelay: '320ms' }}>
              {STEPS.map((s, i) => (
                <li key={s.n} className="flex flex-col sm:flex-row items-center sm:items-center text-center sm:text-left gap-1.5 sm:gap-2 rounded-2xl bg-slate-50 sm:bg-transparent p-2.5 sm:p-0">
                  <span className="flex items-center justify-center w-7 h-7 rounded-full bg-slate-900 text-white text-xs font-bold flex-shrink-0">{s.n}</span>
                  <span className="text-[11px] sm:text-sm font-semibold text-slate-700 leading-tight">{s.text}</span>
                  {i < STEPS.length - 1 && <span className="hidden sm:block w-4 h-px bg-slate-300" />}
                </li>
              ))}
            </ol>
          </div>

          {/* Vitrina animada */}
          {product && (
            <div className="ch-up relative lg:col-start-2 lg:row-start-1 lg:row-span-2 lg:self-center" style={{ animationDelay: '200ms' }}>
              <div className="relative aspect-[4/3] lg:aspect-[1/1] max-h-[560px] w-full rounded-[2rem] bg-gradient-to-br from-[#fd6301] to-[#e35400] overflow-hidden shadow-2xl shadow-[#fd6301]/25">
                {/* Decoración estática (arcos del logo) */}
                <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-white/10" />
                <svg className="absolute left-1/2 top-[42%] -translate-x-1/2 -translate-y-1/2 w-[480px] h-[480px] opacity-15" viewBox="0 0 400 400" fill="none" aria-hidden>
                  {[190, 150, 110].map((r) => (
                    <circle key={r} cx="200" cy="200" r={r} stroke="white" strokeWidth="2" />
                  ))}
                </svg>

                {/* Producto */}
                <button
                  onClick={() => onViewDetail(product)}
                  className="absolute inset-0 flex items-center justify-center pb-[4.5rem] sm:pb-28"
                  aria-label={`Ver ${product.genericName}`}
                >
                  <span className="absolute bottom-[38%] sm:bottom-[36%] w-44 h-8 rounded-[50%] bg-[radial-gradient(closest-side,rgba(0,0,0,0.28),transparent)]" />
                  <span key={product.genericName} className="ch-pop relative">
                    <span className="block">
                      <img
                        src={imagenLiviana(product.imageUrl, 600)}
                        alt={product.genericName}
                        className="w-36 h-36 sm:w-56 sm:h-56 lg:w-72 lg:h-72 object-contain"
                      />
                    </span>
                  </span>
                </button>

                {(product.tags || [])[0] && (
                  <span key={`tag-${product.genericName}`} className="ch-pop absolute top-3 left-3 sm:top-5 sm:left-5 px-2.5 sm:px-3 py-1 rounded-full bg-white text-[11px] sm:text-xs font-bold text-[#fd6301] shadow-sm">
                    {product.tags[0]}
                  </span>
                )}

                {/* Ficha */}
                <div className="absolute left-3 right-3 bottom-3 sm:left-4 sm:right-4 sm:bottom-4 bg-white rounded-2xl px-3.5 py-3 sm:p-4 shadow-xl overflow-hidden">
                  <div key={`info-${product.genericName}`} className="ch-pop flex items-center gap-3 sm:gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-0.5 truncate">{product.groupName || product.categories?.[0]}</p>
                      <p className="text-[15px] sm:text-base font-black text-slate-900 leading-tight truncate">{product.genericName}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 whitespace-nowrap">
                        {colorCount > 0 && <span className="flex items-center gap-1"><Palette className="w-3.5 h-3.5 text-[#fd6301]" />{colorCount} {colorCount === 1 ? 'color' : 'colores'}</span>}
                        {formats.length > 0 && <span className="flex items-center gap-1"><Package className="w-3.5 h-3.5 text-[#fd6301]" />{formats.length} {formats.length === 1 ? 'formato' : 'formatos'}</span>}
                      </div>
                    </div>
                    <button
                      onClick={() => onViewDetail(product)}
                      className="flex-shrink-0 inline-flex items-center gap-1.5 px-3.5 sm:px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold rounded-2xl transition-colors"
                    >
                      Cotizar <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {heroProducts.length > 1 && (
                    <div className="absolute left-0 bottom-0 h-1 w-full bg-slate-100">
                      <div key={`bar-${active}`} className="ch-progress h-full bg-[#fd6301]" />
                    </div>
                  )}
                </div>
              </div>

              {/* Miniaturas */}
              {heroProducts.length > 1 && (
                <div className="flex justify-center gap-2 mt-3 sm:mt-4">
                  {heroProducts.map((p, i) => (
                    <button
                      key={p.genericName}
                      onClick={() => setActive(i)}
                      aria-label={p.genericName}
                      className={`w-11 h-11 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-white border p-1.5 transition-all ${
                        i === active ? 'border-[#fd6301] ring-2 ring-[#fd6301]/20 scale-105' : 'border-slate-200 opacity-60 hover:opacity-100'
                      }`}
                    >
                      <img src={imagenLiviana(p.imageUrl, 120)} alt="" loading="lazy" className="w-full h-full object-contain" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Categorías (fila con scroll horizontal, sin animación) */}
      {categories.length > 0 && (
        <div className="relative border-y border-slate-200/70 bg-slate-50/80 py-3">
          <div className="max-w-7xl mx-auto px-4 flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => onSelectCategory(cat)}
                className="flex items-center gap-2 flex-shrink-0 px-4 py-2 rounded-full bg-white border border-slate-200 text-xs font-semibold text-slate-600 hover:border-[#fd6301] hover:text-[#fd6301] transition-colors capitalize"
              >
                <Check className="w-3 h-3 text-[#fd6301]" />
                {cat.toLowerCase()}
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
