import { X, Package, ChevronRight, ArrowUpRight } from 'lucide-react';
import { imagenLiviana } from '@/lib/imagen-liviana';
import { urlProducto } from '@/lib/slug-producto';
import { useSeleccionCotizador, SelectorVariantes, BotonAgregarCotizacion, type ProductData } from './CotizadorSelector';

interface Props {
  product: ProductData | null;
  open: boolean;
  onClose: () => void;
  onOpenQuotePanel?: () => void;
}

export default function CotizadorProductDetail({ product, open, onClose, onOpenQuotePanel }: Props) {
  const sel = useSeleccionCotizador(product);

  if (!open || !product) return null;

  const closeAndOpenPanel = () => {
    if (!onOpenQuotePanel) return;
    onClose();
    setTimeout(() => onOpenQuotePanel(), 200);
  };

  return (
    <div className="fixed inset-0 z-[60]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Modal — full screen on mobile, centered on desktop */}
      <div
        className="absolute inset-0 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:max-w-5xl sm:w-full sm:max-h-[92vh] bg-white sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col sm:flex-row animate-in fade-in sm:zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Close */}
        <button onClick={onClose} className="absolute top-3 right-3 z-20 p-2 rounded-full bg-white/90 backdrop-blur-sm hover:bg-white shadow-md">
          <X className="w-5 h-5 text-gray-600" />
        </button>

        {/* ═══ LEFT: Image ═══ */}
        <div className="w-full sm:w-[42%] bg-gradient-to-br from-gray-50 to-white p-6 sm:p-8 flex items-center justify-center min-h-[260px] sm:min-h-[520px] flex-shrink-0">
          {product.imageUrl ? (
            <img src={imagenLiviana(product.imageUrl, 840)} alt={product.genericName} className="max-w-full max-h-[420px] object-contain drop-shadow-xl" />
          ) : (
            <Package className="w-24 h-24 text-gray-200" />
          )}
        </div>

        {/* ═══ RIGHT: Info + Selector (all visible, scrollable) ═══ */}
        <div className="flex-1 flex flex-col overflow-hidden sm:border-l sm:border-gray-100 min-h-0">
          <div className="flex-1 overflow-y-auto px-5 py-4 sm:px-6 sm:py-5 space-y-4">
            {product.groupName && (
              <div className="flex items-center gap-1 text-xs text-gray-400">
                <span>Catálogo</span>
                <ChevronRight className="w-3 h-3" />
                <span className="text-[#fd6301] font-medium">{product.groupName}</span>
              </div>
            )}

            <h2 className="text-lg sm:text-xl font-black text-gray-900 uppercase tracking-wide leading-tight pr-10">
              {product.genericName}
            </h2>

            <a
              href={urlProducto(product.genericName)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#fd6301]/30 bg-orange-50 text-[#fd6301] hover:bg-[#fd6301] hover:text-white text-xs font-bold transition-colors"
              data-testid="detalle-ver-pagina"
            >
              Ver página del producto <ArrowUpRight className="w-3.5 h-3.5" />
            </a>

            {product.tags && product.tags.length > 0 && (
              <div className="flex gap-1.5 flex-wrap">
                {product.tags.map(tag => (
                  <span key={tag} className="px-2 py-0.5 bg-orange-50 text-[#fd6301] text-[10px] sm:text-xs font-bold rounded-full">
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {product.breveResena && (
              <p className="text-sm text-gray-600 leading-relaxed">{product.breveResena}</p>
            )}

            {product.descripcion && (
              <div>
                <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Descripción</h4>
                <p className="text-sm text-gray-600 leading-relaxed">{product.descripcion}</p>
              </div>
            )}

            {product.usos && (
              <div>
                <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Usos</h4>
                <p className="text-sm text-gray-600 leading-relaxed">{product.usos}</p>
              </div>
            )}

            <SelectorVariantes sel={sel} onAdded={closeAndOpenPanel} />
          </div>

          {/* Sticky action footer */}
          <div className="px-5 py-3 sm:px-6 sm:py-4 border-t border-gray-100 bg-white flex-shrink-0">
            <BotonAgregarCotizacion sel={sel} onAdded={closeAndOpenPanel} />
          </div>
        </div>
      </div>
    </div>
  );
}
