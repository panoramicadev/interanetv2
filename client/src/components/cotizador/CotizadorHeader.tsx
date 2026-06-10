import { useState } from 'react';
import { Search, FileText, Phone, Mail, Menu, X } from 'lucide-react';
import { useQuote } from '@/contexts/QuoteContext';
import CustomColorButton from '@/components/shared/CustomColorButton';

interface CotizadorHeaderProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  onOpenQuotePanel: () => void;
  config?: {
    siteName?: string;
    logoUrl?: string;
    contactInfo?: { phone?: string; email?: string; whatsapp?: string };
  };
}

export default function CotizadorHeader({ searchTerm, onSearchChange, onOpenQuotePanel, config }: CotizadorHeaderProps) {
  const { state } = useQuote();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm">
      {/* Top bar */}
      <div className="bg-slate-900 text-white text-xs py-1.5 px-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <span className="hidden sm:block opacity-75">Cotizador de Productos — Sin compromiso, sin registro</span>
          <div className="flex items-center gap-4 ml-auto">
            {config?.contactInfo?.phone && (
              <a href={`tel:${config.contactInfo.phone}`} className="flex items-center gap-1 hover:text-orange-300 transition-colors">
                <Phone className="w-3 h-3" />{config.contactInfo.phone}
              </a>
            )}
            {config?.contactInfo?.email && (
              <a href={`mailto:${config.contactInfo.email}`} className="flex items-center gap-1 hover:text-orange-300 transition-colors">
                <Mail className="w-3 h-3" />{config.contactInfo.email}
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Main header */}
      <div className="max-w-7xl mx-auto px-4 py-2 md:py-3">
        <div className="flex items-center gap-2 md:gap-4">
          {/* Logo — same as tienda */}
          <a href="/catalogo" className="flex items-center cursor-pointer flex-shrink-0 group">
            <img
              src={config?.logoUrl || "/panoramica-logo.png"}
              alt={config?.siteName || "Panorámica"}
              className="h-8 md:h-11 w-auto transition-transform group-hover:scale-[1.02]"
            />
          </a>

          {/* Search */}
          <div className="flex-1 max-w-xl mx-auto">
            <div className="relative group flex">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 group-focus-within:text-[#FF6E23] transition-colors z-10" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Buscar productos por nombre, código o categoría..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50/50 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6E23]/20 focus:border-[#FF6E23]/40 transition-all placeholder:text-gray-400"
              />
            </div>
          </div>

          {/* Custom color request — oculto temporalmente */}
          {/* <CustomColorButton variant="compact" /> */}

          {/* Quote button */}
          <button
            onClick={onOpenQuotePanel}
            className="relative flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#FF6E23] to-[#E55E13] text-white rounded-xl font-medium text-sm hover:from-[#E55E13] hover:to-[#D54E03] transition-all shadow-sm hover:shadow-md active:scale-[0.98]"
          >
            <FileText className="w-4 h-4" />
            <span className="hidden sm:inline">Mi Cotización</span>
            {state.itemCount > 0 && (
              <span className="absolute -top-2 -right-2 w-5 h-5 bg-white text-[#FF6E23] rounded-full text-xs font-bold flex items-center justify-center shadow-sm ring-2 ring-[#FF6E23]">
                {state.itemCount}
              </span>
            )}
          </button>

          {/* Mobile menu */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="sm:hidden p-2 text-slate-600"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {mobileMenuOpen && (
        <div className="sm:hidden border-t border-slate-100 bg-white px-4 py-3 space-y-2">
          {config?.contactInfo?.phone && (
            <a href={`tel:${config.contactInfo.phone}`} className="flex items-center gap-2 text-sm text-slate-600 py-1">
              <Phone className="w-4 h-4" /> {config.contactInfo.phone}
            </a>
          )}
          {config?.contactInfo?.email && (
            <a href={`mailto:${config.contactInfo.email}`} className="flex items-center gap-2 text-sm text-slate-600 py-1">
              <Mail className="w-4 h-4" /> {config.contactInfo.email}
            </a>
          )}
        </div>
      )}
    </header>
  );
}
