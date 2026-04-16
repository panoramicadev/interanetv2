import { useState } from 'react';
import { Plus, Check, Package, Box, Minus, Eye, Palette, ChevronDown, X, ShoppingCart } from 'lucide-react';
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
}

export default function CotizadorProductCard({ product, onViewDetail }: Props) {
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

  // Count how many variants are already in quote
  const inQuoteCount = Object.values(product.colors).flat().filter(v => isItemInQuote(v.sku, v.color, v.format)).length;

  return (
    <>
      {/* ═══ CARD ═══ */}
      <div className="group bg-white rounded-2xl overflow-hidden border border-gray-100 hover:border-[#FF6E23]/30 hover:shadow-xl hover:shadow-orange-50/60 transition-all duration-300 flex flex-col">
        {/* Image */}
        <div
          className="relative aspect-[4/3] bg-gradient-to-br from-gray-50 to-white overflow-hidden cursor-pointer p-4"
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
              <Package className="w-14 h-14 text-gray-200" />
            </div>
          )}

          {/* Tags */}
          {product.tags && product.tags.length > 0 && (
            <div className="absolute top-2 left-2 flex flex-col gap-1">
              {product.tags.slice(0, 2).map(tag => (
                <span key={tag} className="text-[9px] px-2 py-0.5 rounded-md font-bold bg-[#FF6E23]/90 text-white backdrop-blur-sm">
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* In-quote badge */}
          {inQuoteCount > 0 && (
            <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 bg-emerald-500 text-white text-[10px] font-bold rounded-full">
              <Check className="w-3 h-3" /> En cotización
            </div>
          )}

          {/* View detail */}
          <button
            onClick={(e) => { e.stopPropagation(); onViewDetail(product); }}
            className="absolute bottom-2 right-2 p-2 bg-white/90 backdrop-blur-sm rounded-lg shadow-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white"
          >
            <Eye className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Info */}
        <div className="p-3 sm:p-4 flex-1 flex flex-col gap-2">
          {product.groupName && (
            <span className="text-[9px] font-bold text-[#FF6E23] uppercase tracking-widest">{product.groupName}</span>
          )}

          <h3 className="text-xs sm:text-sm font-bold uppercase text-gray-900 leading-tight line-clamp-2 tracking-tight">
            {product.genericName}
          </h3>

          {product.breveResena && (
            <p className="text-[11px] text-gray-500 line-clamp-2 leading-relaxed">{product.breveResena}</p>
          )}

          {/* Formats badges */}
          {Array.from(allFormats).length > 0 && (
            <div className="flex flex-wrap gap-1">
              {Array.from(allFormats).map(fmt => (
                <span
                  key={fmt}
                  className="inline-flex items-center gap-0.5 text-[9px] font-semibold px-2 py-0.5 rounded-md bg-slate-50 text-slate-500 border border-slate-200/60"
                >
                  <Box className="w-2.5 h-2.5" /> {fmt}
                </span>
              ))}
            </div>
          )}

          {/* Colors + availability */}
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1 bg-orange-50 text-[#FF6E23] text-[10px] font-bold px-2 py-0.5 rounded-md border border-orange-100/50">
              <Palette className="w-3 h-3" /> {colorKeys.length} Color{colorKeys.length !== 1 ? 'es' : ''}
            </span>
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* ═══ CTA BUTTON — opens selector ═══ */}
          <button
            onClick={() => setSelectorOpen(true)}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all active:scale-[0.97] bg-gradient-to-r from-[#FF6E23] to-[#E55E13] text-white hover:from-[#E55E13] hover:to-[#D54E03] shadow-sm mt-1"
          >
            <ShoppingCart className="w-4 h-4" />
            Seleccionar y Cotizar
          </button>
        </div>
      </div>

      {/* ═══ SELECTOR OVERLAY — Bottom sheet on mobile, modal on desktop ═══ */}
      {selectorOpen && (
        <div className="fixed inset-0 z-[60]" onClick={() => setSelectorOpen(false)}>
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

          {/* Content — bottom sheet on mobile, centered modal on desktop */}
          <div
            className="absolute inset-x-0 bottom-0 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:max-w-lg md:w-full md:mx-4 bg-white md:rounded-2xl rounded-t-2xl shadow-2xl max-h-[85vh] flex flex-col animate-in slide-in-from-bottom md:fade-in md:zoom-in-95 duration-300"
            onClick={e => e.stopPropagation()}
          >
            {/* Handle bar (mobile) */}
            <div className="md:hidden flex justify-center py-2">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>

            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-100">
              <div className="w-12 h-12 rounded-xl bg-gray-50 border border-gray-100 overflow-hidden flex-shrink-0 p-1">
                {product.imageUrl ? (
                  <img src={product.imageUrl} alt={product.genericName} className="w-full h-full object-contain" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center"><Package className="w-6 h-6 text-gray-200" /></div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold uppercase text-gray-900 truncate">{product.genericName}</h3>
                <p className="text-[11px] text-gray-400">{formatsList.length} formato{formatsList.length !== 1 ? 's' : ''} · {colorKeys.length} color{colorKeys.length !== 1 ? 'es' : ''}</p>
              </div>
              <button onClick={() => setSelectorOpen(false)} className="p-2 rounded-full hover:bg-gray-100 transition-colors">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* Step 1: Format selector */}
            <div className="px-5 py-3 border-b border-gray-50">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2.5">
                ① Selecciona formato
              </p>
              <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 snap-x scrollbar-hide">
                {formatsList.map(format => {
                  const isActive = format === activeFormat;
                  return (
                    <button
                      key={format}
                      onClick={() => setActiveFormat(format)}
                      className={`flex-shrink-0 snap-start px-4 py-3 rounded-xl text-sm font-bold transition-all border min-w-[100px] text-center ${
                        isActive
                          ? 'bg-[#FF6E23]/10 border-[#FF6E23] text-[#FF6E23] shadow-sm'
                          : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-gray-300 active:bg-gray-100'
                      }`}
                    >
                      <Box className={`w-4 h-4 mx-auto mb-1 ${isActive ? 'text-[#FF6E23]' : 'text-gray-400'}`} />
                      {format}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 2: Color list with quantity */}
            <div className="flex-1 overflow-y-auto">
              <div className="px-5 py-3">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2.5">
                  ② Selecciona colores y cantidades
                </p>
                <div className="space-y-2">
                  {variantsForFormat.map(variant => {
                    const qty = quantities[variant.sku] || 0;
                    const alreadyIn = isItemInQuote(variant.sku, variant.color, variant.format);

                    return (
                      <div
                        key={variant.sku}
                        className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                          qty > 0
                            ? 'bg-orange-50/50 border-[#FF6E23]/30'
                            : alreadyIn
                              ? 'bg-emerald-50/50 border-emerald-200'
                              : 'bg-white border-gray-100 hover:border-gray-200'
                        }`}
                      >
                        {/* Color thumbnail */}
                        <div className="w-11 h-11 rounded-full bg-gray-50 border-2 border-gray-200 flex-shrink-0 overflow-hidden">
                          {variant.imageUrl ? (
                            <img src={variant.imageUrl} alt={variant.color} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-gray-200" />
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-gray-800 truncate">{variant.color}</p>
                          <p className="text-[10px] text-gray-400">
                            {variant.available ? (
                              <span className="text-emerald-500">● Disponible</span>
                            ) : (
                              <span className="text-amber-500">○ Consultar</span>
                            )}
                          </p>
                        </div>

                        {/* Quantity + Add */}
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {/* Quantity controls — always visible for easy tap */}
                          <button
                            onClick={() => updateQty(variant.sku, -(variant.stepSize || 1), variant.minUnit, variant.stepSize)}
                            className="w-9 h-9 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-200 active:bg-gray-300 text-gray-600 transition-colors"
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
                            className="w-9 h-9 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-200 active:bg-gray-300 text-gray-600 transition-colors"
                          >
                            <Plus className="w-4 h-4" />
                          </button>

                          {/* Add button */}
                          {qty > 0 && (
                            <button
                              onClick={() => handleAddToQuote(variant)}
                              className="w-9 h-9 flex items-center justify-center rounded-lg bg-[#FF6E23] text-white hover:bg-[#E55E13] active:scale-95 transition-all ml-1"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          )}
                          {qty === 0 && alreadyIn && (
                            <div className="w-9 h-9 flex items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 ml-1">
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

            {/* Footer — quick add all with qty > 0 */}
            {Object.values(quantities).some(q => q > 0) && (
              <div className="border-t border-gray-100 px-5 py-3 bg-gray-50/80">
                <button
                  onClick={() => {
                    variantsForFormat.forEach(v => {
                      const qty = quantities[v.sku];
                      if (qty && qty > 0) handleAddToQuote(v);
                    });
                  }}
                  className="w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-[#FF6E23] to-[#E55E13] text-white font-bold rounded-xl hover:from-[#E55E13] hover:to-[#D54E03] active:scale-[0.98] transition-all shadow-md text-sm"
                >
                  <ShoppingCart className="w-4 h-4" />
                  Agregar {Object.values(quantities).filter(q => q > 0).length} color{Object.values(quantities).filter(q => q > 0).length !== 1 ? 'es' : ''} a cotización
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
