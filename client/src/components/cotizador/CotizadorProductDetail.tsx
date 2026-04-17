import { useState } from 'react';
import { X, Plus, Check, Package, ChevronRight, Minus, ShoppingCart, Box, Palette } from 'lucide-react';
import { useQuote } from '@/contexts/QuoteContext';

interface Variant {
  sku: string;
  name: string;
  color: string;
  format: string;
  available: boolean;
  minUnit: number;
  stepSize: number;
  imageUrl?: string;
}

interface ProductData {
  genericName: string;
  groupName?: string;
  imageUrl?: string;
  breveResena?: string;
  descripcion?: string;
  usos?: string;
  presentacion?: string;
  tags?: string[];
  colors: Record<string, Variant[]>;
}

interface Props {
  product: ProductData | null;
  open: boolean;
  onClose: () => void;
  onOpenQuotePanel?: () => void;
}

export default function CotizadorProductDetail({ product, open, onClose, onOpenQuotePanel }: Props) {
  const { addItem, isItemInQuote } = useQuote();

  const formatsMap = new Map<string, Variant[]>();
  if (product) {
    Object.values(product.colors).flat().forEach(v => {
      if (!formatsMap.has(v.format)) formatsMap.set(v.format, []);
      formatsMap.get(v.format)!.push(v);
    });
  }
  const formatsList = Array.from(formatsMap.keys());

  const [activeFormat, setActiveFormat] = useState(formatsList[0] || '');
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  if (product && formatsList.length > 0 && !formatsMap.has(activeFormat)) {
    setActiveFormat(formatsList[0]);
  }

  const variantsForFormat = formatsMap.get(activeFormat) || [];

  if (!open || !product) return null;

  const updateQty = (sku: string, delta: number, min: number, step: number) => {
    setQuantities(prev => {
      const current = prev[sku] || 0;
      const next = current + delta;
      if (next <= 0) return { ...prev, [sku]: 0 };
      if (current === 0 && delta > 0) return { ...prev, [sku]: min };
      return { ...prev, [sku]: Math.max(min, next) };
    });
  };

  const handleAddToQuote = (variant: Variant) => {
    const qty = quantities[variant.sku] || variant.minUnit;
    addItem({
      sku: variant.sku,
      productName: product.genericName,
      color: variant.color,
      format: variant.format,
      quantity: qty,
      imageUrl: variant.imageUrl || product.imageUrl || undefined,
      minUnit: variant.minUnit,
      stepSize: variant.stepSize,
    });
    setQuantities(prev => ({ ...prev, [variant.sku]: 0 }));
  };

  const handleAddAllAndOpen = () => {
    let added = 0;
    variantsForFormat.forEach(v => {
      const qty = quantities[v.sku];
      if (qty && qty > 0) {
        handleAddToQuote(v);
        added++;
      }
    });
    if (added > 0 && onOpenQuotePanel) {
      onClose();
      setTimeout(() => onOpenQuotePanel(), 200);
    }
  };

  const hasItemsToAdd = Object.values(quantities).some(q => q > 0);

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
            <img src={product.imageUrl} alt={product.genericName} className="max-w-full max-h-[420px] object-contain drop-shadow-xl" />
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
                <span className="text-[#FF6E23] font-medium">{product.groupName}</span>
              </div>
            )}

            <h2 className="text-lg sm:text-xl font-black text-gray-900 uppercase tracking-wide leading-tight pr-10">
              {product.genericName}
            </h2>

            {product.tags && product.tags.length > 0 && (
              <div className="flex gap-1.5 flex-wrap">
                {product.tags.map(tag => (
                  <span key={tag} className="px-2 py-0.5 bg-orange-50 text-[#FF6E23] text-[10px] sm:text-xs font-bold rounded-full">
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

            {/* Format selector — always visible */}
            {formatsList.length > 0 && (
              <div className="pt-2 border-t border-gray-100">
                <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <Box className="w-3 h-3" /> Formato
                </h4>
                <div className="flex gap-2 flex-wrap">
                  {formatsList.map(format => (
                    <button
                      key={format}
                      onClick={() => setActiveFormat(format)}
                      className={`px-4 py-2 rounded-lg text-xs font-bold transition-all border ${
                        format === activeFormat
                          ? 'bg-[#FF6E23] border-[#FF6E23] text-white shadow-md'
                          : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      {format}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Colors + quantity — always visible */}
            <div>
              <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <Palette className="w-3 h-3" /> {variantsForFormat.length > 1 ? 'Color y cantidad' : 'Cantidad'}
              </h4>
              <div className="space-y-2">
                {variantsForFormat.map(variant => {
                  const qty = quantities[variant.sku] || 0;
                  const alreadyIn = isItemInQuote(variant.sku, variant.color, variant.format);

                  return (
                    <div
                      key={variant.sku}
                      className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                        qty > 0 ? 'bg-orange-50/50 border-[#FF6E23]/30' : alreadyIn ? 'bg-emerald-50/50 border-emerald-200' : 'bg-white border-gray-100'
                      }`}
                    >
                      <div className="w-11 h-11 rounded-full bg-gray-50 border-2 border-gray-200 flex-shrink-0 overflow-hidden">
                        {variant.imageUrl ? (
                          <img src={variant.imageUrl} alt={variant.color} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-gray-200" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-800 truncate">{variant.color}</p>
                        <p className="text-[10px] text-gray-400">
                          {variant.available ? '● Disponible' : '○ Consultar'}
                          <span className="ml-1 text-gray-300">SKU: {variant.sku}</span>
                        </p>
                      </div>

                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => updateQty(variant.sku, -(variant.stepSize || 1), variant.minUnit, variant.stepSize)}
                          className="w-9 h-9 flex items-center justify-center rounded-lg bg-gray-100 active:bg-gray-200 text-gray-600"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className={`w-9 h-9 flex items-center justify-center text-sm font-bold rounded-lg border ${
                          qty > 0 ? 'bg-[#FF6E23]/10 border-[#FF6E23]/30 text-[#FF6E23]' : 'bg-white border-gray-200 text-gray-400'
                        }`}>
                          {qty}
                        </span>
                        <button
                          onClick={() => updateQty(variant.sku, variant.stepSize || 1, variant.minUnit, variant.stepSize)}
                          className="w-9 h-9 flex items-center justify-center rounded-lg bg-gray-100 active:bg-gray-200 text-gray-600"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                        {qty > 0 && (
                          <button
                            onClick={() => {
                              handleAddToQuote(variant);
                              if (onOpenQuotePanel) {
                                onClose();
                                setTimeout(() => onOpenQuotePanel(), 200);
                              }
                            }}
                            className="w-9 h-9 flex items-center justify-center rounded-lg bg-[#FF6E23] text-white active:scale-95 transition-all ml-0.5"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        )}
                        {qty === 0 && alreadyIn && (
                          <div className="w-9 h-9 flex items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 ml-0.5">
                            <Check className="w-4 h-4" />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Sticky action footer */}
          <div className="px-5 py-3 sm:px-6 sm:py-4 border-t border-gray-100 bg-white flex-shrink-0">
            <button
              onClick={handleAddAllAndOpen}
              disabled={!hasItemsToAdd}
              className={`w-full flex items-center justify-center gap-2 py-3.5 font-bold rounded-xl transition-all text-sm ${
                hasItemsToAdd
                  ? 'bg-gradient-to-r from-[#FF6E23] to-[#E55E13] text-white active:scale-[0.98] shadow-lg hover:from-[#E55E13] hover:to-[#D54E03]'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
            >
              <ShoppingCart className="w-4 h-4" />
              {hasItemsToAdd ? 'Agregar a mi cotización' : 'Selecciona una cantidad'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
