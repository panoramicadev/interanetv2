import { useEffect, useState } from 'react';
import { Search, FileText, Phone, Mail, Menu, X, Truck, MapPin, PackageSearch, LayoutGrid } from 'lucide-react';
import { useQuote } from '@/contexts/QuoteContext';

interface CotizadorHeaderProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  /** Enter en el buscador (en la página de producto lleva al catálogo filtrado). */
  onSearchSubmit?: (value: string) => void;
  onOpenQuotePanel: () => void;
  config?: {
    siteName?: string;
    logoUrl?: string;
    contactInfo?: { phone?: string; email?: string; whatsapp?: string };
  };
}

const NAV = [
  { href: '/', label: 'Catálogo', icon: LayoutGrid },
  { href: '/donde-comprar', label: 'Dónde comprar', icon: MapPin },
  { href: '/seguimiento', label: 'Seguir mi pedido', icon: PackageSearch },
];

// Minutos que faltan para el corte de despacho del día (12:00 hora de Chile); null si ya pasó.
function minutosParaCorte(): number | null {
  const [h, m] = new Intl.DateTimeFormat('es-CL', { timeZone: 'America/Santiago', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .format(new Date()).split(':').map(Number);
  const faltan = 12 * 60 - (h * 60 + m);
  return faltan > 0 ? faltan : null;
}

function CorteDespacho() {
  const [faltan, setFaltan] = useState(minutosParaCorte);
  useEffect(() => {
    const t = setInterval(() => setFaltan(minutosParaCorte()), 30_000);
    return () => clearInterval(t);
  }, []);
  if (faltan === null) return null;
  const h = Math.floor(faltan / 60);
  const m = faltan % 60;
  return (
    <span className="hidden sm:inline-flex items-center gap-1.5 ml-2 px-2 py-0.5 rounded-full bg-[#fd6301] text-white font-bold tabular-nums">
      Sale hoy si pides en {h > 0 ? `${h} h ` : ''}{m} min
    </span>
  );
}

export default function CotizadorHeader({ searchTerm, onSearchChange, onSearchSubmit, onOpenQuotePanel, config }: CotizadorHeaderProps) {
  const { state } = useQuote();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const path = typeof window !== 'undefined' ? window.location.pathname : '/';
  const contacto = config?.contactInfo;

  const buscador = (
    <div className="relative group">
      <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-[#fd6301] transition-colors pointer-events-none" />
      <input
        type="search"
        value={searchTerm}
        onChange={(e) => onSearchChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') onSearchSubmit?.(searchTerm.trim()); }}
        placeholder="Buscar productos"
        aria-label="Buscar productos"
        className="w-full h-11 pl-11 pr-4 rounded-full bg-slate-100 border border-transparent text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-slate-200 focus:ring-4 focus:ring-[#fd6301]/10 transition-all"
      />
    </div>
  );

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-slate-200/80">
      {/* Barra de aviso: una sola línea */}
      <div className="bg-slate-950 text-white/85 text-[11px] sm:text-xs" data-testid="barra-temuco">
        <div className="max-w-7xl mx-auto h-8 sm:h-9 px-4 flex items-center justify-center lg:justify-between gap-4">
          <p className="flex items-center gap-2 truncate">
            <Truck className="w-3.5 h-3.5 text-[#fd6301] flex-shrink-0" />
            <span className="truncate">
              <strong className="font-semibold text-white">Envío gratis en Temuco</strong>
              <span className="sm:hidden"> · despacho el mismo día</span>
              <span className="hidden sm:inline"> · Pedidos hasta las 12:00 se despachan el mismo día, a domicilio o a obra</span>
            </span>
            <CorteDespacho />
          </p>
          <div className="hidden lg:flex items-center gap-5 flex-shrink-0 text-white/70">
            {contacto?.phone && (
              <a href={`tel:${contacto.phone}`} className="flex items-center gap-1.5 hover:text-white transition-colors">
                <Phone className="w-3 h-3" />{contacto.phone}
              </a>
            )}
            {contacto?.email && (
              <a href={`mailto:${contacto.email}`} className="flex items-center gap-1.5 hover:text-white transition-colors">
                <Mail className="w-3 h-3" />{contacto.email}
              </a>
            )}
            <span>Por mayor y al detalle</span>
          </div>
        </div>
      </div>

      {/* Fila principal */}
      <div className="max-w-7xl mx-auto px-4">
        <div className="h-16 md:h-[72px] flex items-center gap-3 md:gap-8">
          <a href="/" className="flex-shrink-0" aria-label="Inicio">
            <img
              src={config?.logoUrl || '/panoramica-logo.png'}
              alt={config?.siteName || 'Pinturas Panorámica'}
              className="h-8 md:h-10 w-auto"
            />
          </a>

          <nav className="hidden lg:flex items-center gap-1">
            {NAV.map(({ href, label }) => {
              const activo = href === '/' ? path === '/' || path.startsWith('/productos') : path.startsWith(href);
              return (
                <a
                  key={href}
                  href={href}
                  className={`px-3 py-2 rounded-xl text-sm font-semibold transition-colors ${
                    activo ? 'text-slate-900' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  {label}
                </a>
              );
            })}
          </nav>

          <div className="hidden md:block flex-1 max-w-md ml-auto">{buscador}</div>

          <div className="flex items-center gap-1.5 ml-auto md:ml-0">
            <button
              onClick={onOpenQuotePanel}
              className="inline-flex items-center gap-2 h-11 pl-3.5 pr-3 sm:pl-4 sm:pr-3.5 rounded-2xl bg-[#fd6301] hover:bg-[#e35400] text-white text-sm font-semibold transition-colors"
              aria-label={`Mi cotización, ${state.itemCount} productos`}
            >
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">Mi cotización</span>
              <span className={`min-w-[22px] h-[22px] px-1.5 rounded-full text-xs font-bold flex items-center justify-center tabular-nums ${state.itemCount > 0 ? 'bg-white text-[#fd6301]' : 'bg-white/20 text-white'}`}>
                {state.itemCount}
              </span>
            </button>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden w-11 h-11 flex items-center justify-center rounded-2xl text-slate-700 hover:bg-slate-100 transition-colors"
              aria-label={mobileMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Buscador en celular: fila propia, ancho completo */}
        <div className="md:hidden pb-3">{buscador}</div>
      </div>

      {/* Menú en celular/tablet */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-slate-100 bg-white">
          <nav className="max-w-7xl mx-auto px-4 py-2">
            {NAV.map(({ href, label, icon: Icon }) => (
              <a key={href} href={href} className="flex items-center gap-3 px-2 py-3 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50">
                <span className="w-9 h-9 rounded-xl bg-orange-50 text-[#fd6301] flex items-center justify-center"><Icon className="w-4 h-4" /></span>
                {label}
              </a>
            ))}
            {(contacto?.phone || contacto?.email) && (
              <div className="mt-1 pt-3 pb-2 border-t border-slate-100 flex flex-col gap-2 px-2 text-sm text-slate-500">
                {contacto?.phone && <a href={`tel:${contacto.phone}`} className="flex items-center gap-2"><Phone className="w-4 h-4" />{contacto.phone}</a>}
                {contacto?.email && <a href={`mailto:${contacto.email}`} className="flex items-center gap-2"><Mail className="w-4 h-4" />{contacto.email}</a>}
              </div>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
