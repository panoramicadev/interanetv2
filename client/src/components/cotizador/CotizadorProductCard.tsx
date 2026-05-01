import { useState } from 'react';
import { Plus, Check, Package, Box, Minus, Eye, Palette, X, ShoppingCart } from 'lucide-react';
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
  tags?: string[];
  colors: Record<string, Variant[]>;
}

interface Props {
  product: ProductData;
  onViewDetail: (product: ProductData) => void;
  onOpenQuotePanel: () => void;
}

export default function CotizadorProductCard({ product, onViewDetail, onOpenQuotePanel }: Props) {
  const { addItem, isItemInQuote } = useQuote();
  const [selectorOpen, setSelectorOpen] = useState(false);

  const colorKeys = Object.keys(product.colors)
    .sort((a, b) => product.colors[b].length - product.colors[a].length);

  // Build formats map
  const formatsMap = new Map<string, Variant[]>();
  Object.values(product.colors).flat().forEach(v => {
    if (!formatsMap.has(v.format)) formatsMap.set(v.format, []);
    formatsMap.get(v.format)!.push(v);
  });
  const formatsList = Array.from(formatsMap.keys());
  const [activeFormat, setActiveFormat] = useState(formatsList[0] || '');
  const variantsForFormat = formatsMap.get(activeFormat) || [];

  // Get all unique formats for badges
  const allFormats = new Set<string>();
  Object.values(product.colors).flat().forEach(v => {
    if (v.format) allFormats.add(v.format);
  });

  // Per-variant quantity
  const [quantities, setQuantities] = useState<Record<string, number>>({});

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

  // Get ALL variants (across all formats)
  const allVariants = Object.values(product.colors).flat();

  const handleAddAllAndOpenPanel = () => {
    let added = 0;
    // Add ALL variants with qty > 0, regardless of which format tab is active
    allVariants.forEach(v => {
      const qty = quantities[v.sku];
      if (qty && qty > 0) {
        handleAddToQuote(v);
        added++;
      }
    });
    if (added > 0) {
      setSelectorOpen(false);
      setTimeout(() => onOpenQuotePanel(), 150);
    }
  };

  // Count pending items per format (for badge on tab)
  const pendingCountByFormat = (format: string) => {
    const variants = formatsMap.get(format) || [];
    return variants.filter(v => (quantities[v.sku] || 0) > 0).length;
  };

  // Total pending across ALL formats
  const totalPending = allVariants.filter(v => (quantities[v.sku] || 0) > 0).length;

  // Count how many variants are already in quote
  const inQuoteCount = Object.values(product.colors).flat().filter(v => isItemInQuote(v.sku, v.color, v.format)).length;

  return (
    <>
      {/* ═══ CARD ═══ */}
      <div className="group bg-white rounded-2xl overflow-hidden border border-gray-100 hover:border-[#FF6E23]/30 hover:shadow-xl hover:shadow-orange-50/60 transition-all duration-300 flex flex-col">
        {/* Image */}
        <div
          className="relative aspect-[4/3] bg-gradient-to-br from-gray-50 to-white overflow-hidden cursor-pointer p-3 sm:p-4"
          onClick={() => onViewDetail(product)}
        >
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.genericName}
              className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Package className="w-12 h-12 text-gray-200" />
            </div>
          )}

          {/* Tags */}
          {product.tags && product.tags.length > 0 && (
            <div className="absolute top-1.5 left-1.5 flex flex-col gap-1">
              {product.tags.slice(0, 2).map(tag => (
                <span key={tag} className="text-[8px] sm:text-[9px] px-1.5 py-0.5 rounded-md font-bold bg-[#FF6E23]/90 text-white">
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* In-quote badge */}
          {inQuoteCount > 0 && (
            <div className="absolute top-1.5 right-1.5 flex items-center gap-0.5 px-1.5 py-0.5 bg-emerald-500 text-white text-[8px] sm:text-[10px] font-bold rounded-full">
              <Check className="w-2.5 h-2.5" /> <span className="hidden sm:inline">En cotización</span>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="p-2.5 sm:p-4 flex-1 flex flex-col gap-1.5 sm:gap-2">
          {product.groupName && (
            <span className="text-[8px] sm:text-[9px] font-bold text-[#FF6E23] uppercase tracking-widest">{product.groupName}</span>
          )}

          <h3 className="text-[11px] sm:text-sm font-bold uppercase text-gray-900 leading-tight line-clamp-2 tracking-tight">
            {product.genericName}
          </h3>

          {product.breveResena && (
            <p className="text-[10px] sm:text-[11px] text-gray-500 line-clamp-2 leading-relaxed hidden sm:block">{product.breveResena}</p>
          )}

          {/* Formats badges */}
          {Array.from(allFormats).length > 0 && (
            <div className="flex flex-wrap gap-1">
              {Array.from(allFormats).slice(0, 3).map(fmt => (
                <span key={fmt} className="text-[8px] sm:text-[9px] font-semibold px-1.5 py-0.5 rounded bg-slate-50 text-slate-500 border border-slate-200/60">
                  {fmt}
                </span>
              ))}
              {Array.from(allFormats).length > 3 && (
                <span className="text-[8px] sm:text-[9px] font-semibold px-1.5 py-0.5 rounded bg-slate-50 text-slate-400">
                  +{Array.from(allFormats).length - 3}
                </span>
              )}
            </div>
          )}

          {/* Colors */}
          <div className="flex items-center gap-1">
            <span className="inline-flex items-center gap-0.5 bg-orange-50 text-[#FF6E23] text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded border border-orange-100/50">
              <Palette className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> {colorKeys.length}
            </span>
          </div>

          <div className="flex-1" />

          {/* CTA — opens selector */}
          <button
            onClick={() => setSelectorOpen(true)}
            className="w-full flex items-center justify-center gap-1.5 py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm font-bold transition-all active:scale-[0.97] bg-gradient-to-r from-[#FF6E23] to-[#E55E13] text-white hover:from-[#E55E13] hover:to-[#D54E03] shadow-sm mt-1"
          >
            <ShoppingCart className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="sm:hidden">Cotizar</span>
            <span className="hidden sm:inline">Seleccionar y Cotizar</span>
          </button>
        </div>
      </div>

      {/* ═══ SELECTOR — Bottom sheet (mobile) / Modal (desktop) ═══ */}
      {selectorOpen && (
        <div className="fixed inset-0 z-[60]" onClick={() => setSelectorOpen(false)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

          <div
            className="absolute inset-x-0 bottom-0 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:max-w-lg md:w-full md:mx-4 bg-white md:rounded-2xl rounded-t-2xl shadow-2xl max-h-[88vh] flex flex-col animate-in slide-in-from-bottom md:fade-in md:zoom-in-95 duration-300"
            onClick={e => e.stopPropagation()}
          >
            {/* Handle bar (mobile) */}
            <div className="md:hidden flex justify-center pt-2 pb-1">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>

            {/* Header */}
            <div className="flex items-center gap-3 px-4 sm:px-5 py-3 border-b border-gray-100">
              <div className="w-11 h-11 rounded-xl bg-gray-50 border border-gray-100 overflow-hidden flex-shrink-0 p-1">
                {product.imageUrl ? (
                  <img src={product.imageUrl} alt="" className="w-full h-full object-contain" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center"><Package className="w-5 h-5 text-gray-200" /></div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold uppercase text-gray-900 truncate">{product.genericName}</h3>
                <p className="text-[11px] text-gray-400">{formatsList.length} formato{formatsList.length !== 1 ? 's' : ''} · {colorKeys.length} color{colorKeys.length !== 1 ? 'es' : ''}</p>
              </div>
              <button onClick={() => setSelectorOpen(false)} className="p-2 rounded-full hover:bg-gray-100 transition-colors -mr-1">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* Step 1: Formats */}
            <div className="px-4 sm:px-5 py-3 border-b border-gray-50 bg-gray-50/50">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                ① Formato
              </p>
              <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 snap-x">
                {formatsList.map(format => {
                  const isActive = format === activeFormat;
                  const pendingCount = pendingCountByFormat(format);
                  return (
                    <button
                      key={format}
                      onClick={() => setActiveFormat(format)}
                      className={`relative flex-shrink-0 snap-start px-4 py-2.5 rounded-xl text-xs font-bold transition-all border min-w-[90px] text-center ${
                        isActive
                          ? 'bg-[#FF6E23] border-[#FF6E23] text-white shadow-md'
                          : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 active:bg-gray-100'
                      }`}
                    >
                      {format}
                      {pendingCount > 0 && !isActive && (
                        <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-[#FF6E23] text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-sm">
                          {pendingCount}
                        </span>
                      )}
                      {pendingCount > 0 && isActive && (
                        <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-white text-[#FF6E23] text-[10px] font-bold rounded-full flex items-center justify-center shadow-sm ring-2 ring-[#FF6E23]">
                          {pendingCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 2: Colors with quantity */}
            <div className="flex-1 overflow-y-auto overscroll-contain">
              <div className="px-4 sm:px-5 py-3">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                  ② Color y cantidad
                </p>
                <div className="space-y-2">
                  {variantsForFormat.map(variant => {
                    const qty = quantities[variant.sku] || 0;
                    const alreadyIn = isItemInQuote(variant.sku, variant.color, variant.format);

                    return (
                      <div
                        key={variant.sku}
                        className={`flex items-center gap-2.5 sm:gap-3 p-2.5 sm:p-3 rounded-xl border transition-all ${
                          qty > 0
                            ? 'bg-orange-50/50 border-[#FF6E23]/30'
                            : alreadyIn
                              ? 'bg-emerald-50/50 border-emerald-200'
                              : 'bg-white border-gray-100'
                        }`}
                      >
                        {/* Thumbnail */}
                        <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-gray-50 border-2 border-gray-200 flex-shrink-0 overflow-hidden">
                          {variant.imageUrl ? (
                            <img src={variant.imageUrl} alt={variant.color} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-gray-200" />
                          )}
                        </div>

                        {/* Color name */}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs sm:text-sm font-bold text-gray-800 truncate">{variant.color}</p>
                          <p className="text-[9px] sm:text-[10px] text-gray-400">
                            {variant.available ? '● Disponible' : '○ Consultar'}
                          </p>
                        </div>

                        {/* Quantity + add */}
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={() => updateQty(variant.sku, -(variant.stepSize || 1), variant.minUnit, variant.stepSize)}
                            className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg bg-gray-100 active:bg-gray-200 text-gray-600"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className={`w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center text-xs sm:text-sm font-bold rounded-lg border ${
                            qty > 0 ? 'bg-[#FF6E23]/10 border-[#FF6E23]/30 text-[#FF6E23]' : 'bg-white border-gray-200 text-gray-400'
                          }`}>
                            {qty}
                          </span>
                          <button
                            onClick={() => updateQty(variant.sku, variant.stepSize || 1, variant.minUnit, variant.stepSize)}
                            className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg bg-gray-100 active:bg-gray-200 text-gray-600"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>

                          {qty > 0 && (
                            <button
                              onClick={() => {
                                handleAddToQuote(variant);
                                // Auto-open quote panel after single add on mobile
                                setTimeout(() => onOpenQuotePanel(), 150);
                              }}
                              className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg bg-[#FF6E23] text-white active:scale-95 transition-all ml-0.5"
                              title="Agregar a cotización"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {qty === 0 && alreadyIn && (
                            <div className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 ml-0.5">
                              <Check className="w-3.5 h-3.5" />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Footer — add ALL pending across all formats */}
            {totalPending > 0 && (
              <div className="border-t border-gray-100 px-4 sm:px-5 py-3 bg-white safe-area-bottom">
                <button
                  onClick={handleAddAllAndOpenPanel}
                  className="w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-[#FF6E23] to-[#E55E13] text-white font-bold rounded-xl active:scale-[0.98] transition-all shadow-lg text-sm"
                >
                  <ShoppingCart className="w-4 h-4" />
                  Agregar {totalPending} producto{totalPending !== 1 ? 's' : ''} a mi cotización
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
