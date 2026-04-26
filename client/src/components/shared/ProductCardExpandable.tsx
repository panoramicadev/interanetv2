/**
 * ProductCardExpandable — Shared product card used by both the store (tienda)
 * and the wholesale-quote catalog (cotizador).
 *
 * Visual design: horizontal collapsed row → full-width expanded panel with
 * format tabs, color list and quantity controls. Same effects and animations
 * across both modes.
 *
 * Two modes:
 *   - `store`:      shows prices / offers / convenio badges, calls `onAddToCart`
 *   - `cotizador`:  hides all prices, writes to QuoteContext via useQuote()
 *
 * State (expansion, active format, per-variant quantities) is managed
 * internally per card, so each card is independent and the page-level
 * component stays simple.
 */
import { useState, useMemo, useContext } from 'react';
import {
  ImageIcon,
  Palette,
  Box,
  Info,
  ChevronRight,
  X,
  Plus,
  Minus,
  ShoppingCart,
  Check,
} from 'lucide-react';
import { QuoteContext } from '@/contexts/QuoteContext';

// TEMPORAL — rebranding de "STAIN" a "Nuevo Eco Stain" sólo en la UI.
// Quitar estas 2 constantes y los usos de <NuevoBadgeTemp /> / displayProductName()
// cuando se normalice el nombre en la base de datos.
export const TEMP_PRODUCT_NAME_OVERRIDES: Record<string, string> = {
  STAIN: 'Nuevo Eco Stain',
};
export const displayProductName = (name: string) =>
  TEMP_PRODUCT_NAME_OVERRIDES[name?.toUpperCase?.()] ?? name;
export const isTempRebrandedName = (name: string) =>
  !!TEMP_PRODUCT_NAME_OVERRIDES[name?.toUpperCase?.()];
export const NuevoBadgeTemp = ({ className = '' }: { className?: string }) => (
  <span
    className={`nuevo-badge-temp relative z-10 inline-flex items-center gap-0.5 text-[8px] sm:text-[9px] font-semibold uppercase tracking-[0.08em] px-1.5 py-[1px] rounded-[4px] ${className}`}
    title="Producto renovado"
  >
    <span className="relative z-10">Nuevo</span>
  </span>
);
export const EcoBadgeTemp = ({ className = '' }: { className?: string }) => (
  <span
    className={`eco-badge-temp relative z-10 inline-flex items-center gap-1 text-[8px] sm:text-[9px] font-medium normal-case tracking-normal px-1.5 py-[1px] rounded-[4px] ${className}`}
    title="Formulación con resina reciclada"
  >
    <span className="relative z-10">♻ Resina reciclada</span>
  </span>
);
export const TempBadges = ({ className = '' }: { className?: string }) => (
  <span className={`inline-flex items-center gap-1 align-middle ${className}`}>
    <NuevoBadgeTemp />
    <EcoBadgeTemp />
  </span>
);

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface SharedVariant {
  sku: string;
  name?: string;
  color: string;
  format: string;
  minUnit: number;
  stepSize: number;
  imageUrl?: string | null;
  // Store-only fields
  price?: number | null;
  originalPrice?: number | null;
  offerPrice?: number | null;
  stock?: number;
  // Cotizador-only field
  available?: boolean;
  // Pass-through — may carry extra data the parent needs on callbacks
  [key: string]: any;
}

export interface SharedProduct {
  genericName: string;
  groupName?: string | null;
  imageUrl?: string | null;
  breveResena?: string | null;
  tags?: string[];
  colors: Record<string, SharedVariant[]>;
}

export interface AdminTag {
  name: string;
  color: string;
}

interface BaseProps {
  product: SharedProduct;
  /** Known admin tag color palette — used for colored tag pills (store only). */
  adminTags?: AdminTag[];
  /** Start expanded. */
  initialExpanded?: boolean;
}

interface StoreModeProps extends BaseProps {
  mode: 'store';
  /** Branch discount percent — shown in CONVENIO badge. */
  branchDiscountPct?: number;
  /** Called with variants+quantities when user clicks "Añadir al Carrito". */
  onAddToCart: (variants: SharedVariant[], quantities: Record<string, number>) => void;
  /** Called when the small "Detalles" button in the collapsed header is clicked. */
  onOpenInfoModal?: (genericName: string) => void;
  /** Called when "Ver Detalles" in the expanded footer is clicked. */
  onOpenDetail?: (product: SharedProduct, variant: SharedVariant) => void;
}

interface CotizadorModeProps extends BaseProps {
  mode: 'cotizador';
  /** Opens the floating quote panel after adding items. */
  onOpenQuotePanel: () => void;
  /** Called when "Detalles" button is clicked. */
  onViewDetail?: (product: SharedProduct) => void;
}

export type ProductCardExpandableProps = StoreModeProps | CotizadorModeProps;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const TAG_BG: Record<string, string> = {
  green: 'bg-emerald-500/90',
  blue: 'bg-blue-500/90',
  amber: 'bg-amber-500/90',
  red: 'bg-rose-500/90',
  purple: 'bg-violet-500/90',
  pink: 'bg-pink-500/90',
  cyan: 'bg-cyan-500/90',
  orange: 'bg-orange-500/90',
  indigo: 'bg-indigo-500/90',
  teal: 'bg-teal-500/90',
};

const TAG_BG_SOLID: Record<string, string> = {
  green: 'bg-emerald-500',
  blue: 'bg-blue-500',
  amber: 'bg-amber-500',
  red: 'bg-rose-500',
  purple: 'bg-violet-500',
  pink: 'bg-pink-500',
  cyan: 'bg-cyan-500',
  orange: 'bg-orange-500',
  indigo: 'bg-indigo-500',
  teal: 'bg-teal-500',
};

function formatPriceCL(price: number | string | null | undefined): string {
  if (!price || price === 0 || price === '0') return '';
  const n = typeof price === 'string' ? parseFloat(price) : price;
  if (isNaN(n) || n === 0) return '';
  return `$${new Intl.NumberFormat('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function ProductCardExpandable(props: ProductCardExpandableProps) {
  const { product, adminTags = [], initialExpanded = false } = props;
  const [packagingModalOpen, setPackagingModalOpen] = useState(false);
  const onPackagingRulesClick = () => setPackagingModalOpen(true);
  const isStore = props.mode === 'store';
  const isCotizador = props.mode === 'cotizador';

  // Quote context — `useContext` returns undefined if no provider in the tree
  // (as in the store / tienda). Cotizador wraps in QuoteProvider so we get the
  // real context.
  const quoteCtxRaw = useContext(QuoteContext);
  const quoteCtx = isCotizador ? quoteCtxRaw : undefined;

  // ── Local state ──
  const [expanded, setExpanded] = useState(initialExpanded);
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  // ── Derived ──
  const colorKeys = useMemo(
    () => Object.keys(product.colors).sort((a, b) => product.colors[b].length - product.colors[a].length),
    [product.colors],
  );

  const { formatsMap, formatsList, allFormats } = useMemo(() => {
    const map = new Map<string, SharedVariant[]>();
    const all = new Set<string>();
    Object.values(product.colors)
      .flat()
      .forEach(v => {
        if (!map.has(v.format)) map.set(v.format, []);
        map.get(v.format)!.push(v);
        if (v.format) all.add(v.format);
      });
    return {
      formatsMap: map,
      formatsList: Array.from(map.keys()),
      allFormats: all,
    };
  }, [product.colors]);

  const [activeFormat, setActiveFormat] = useState<string>(formatsList[0] || '');
  const variantsForFormat = formatsMap.get(activeFormat) || formatsMap.get(formatsList[0]) || [];

  const branchDiscountPct = isStore ? (props as StoreModeProps).branchDiscountPct || 0 : 0;

  const activeFormatData =
    variantsForFormat.find(v => v.offerPrice && v.offerPrice > 0) || variantsForFormat[0];

  // Store mode: compute subtotals
  const allProductVariants = useMemo(() => Object.values(product.colors).flat(), [product.colors]);

  const formatTotal = useMemo(() => {
    if (!isStore) return 0;
    return variantsForFormat.reduce((acc, v) => {
      const q = quantities[v.sku] || 0;
      const ep = (v.offerPrice && v.offerPrice > 0) ? v.offerPrice : (v.price || 0);
      return acc + ep * q;
    }, 0);
  }, [isStore, variantsForFormat, quantities]);

  const { globalProductTotal, globalProductItemCount } = useMemo(() => {
    if (!isStore) return { globalProductTotal: 0, globalProductItemCount: 0 };
    let total = 0;
    let count = 0;
    allProductVariants.forEach(v => {
      const q = quantities[v.sku] || 0;
      const ep = (v.offerPrice && v.offerPrice > 0) ? v.offerPrice : (v.price || 0);
      total += ep * q;
      count += q;
    });
    return { globalProductTotal: total, globalProductItemCount: count };
  }, [isStore, allProductVariants, quantities]);

  // Cotizador mode: count in-quote variants
  const inQuoteCount = useMemo(() => {
    if (!isCotizador || !quoteCtx) return 0;
    return allProductVariants.filter(v => quoteCtx.isItemInQuote(v.sku, v.color, v.format)).length;
  }, [isCotizador, quoteCtx, allProductVariants]);

  // ── Handlers ──
  const toggleExpanded = () => setExpanded(v => !v);

  const updateQty = (variant: SharedVariant, delta: number) => {
    const step = variant.stepSize || 1;
    const min = variant.minUnit || 1;
    setQuantities(prev => {
      const current = prev[variant.sku] || 0;
      if (delta > 0 && current === 0) return { ...prev, [variant.sku]: min };
      const next = current + delta;
      if (next <= 0) return { ...prev, [variant.sku]: 0 };
      return { ...prev, [variant.sku]: Math.max(min, Math.floor(next / step) * step) };
    });
  };

  const setQty = (sku: string, value: number) => {
    setQuantities(prev => ({ ...prev, [sku]: Math.max(0, value) }));
  };

  const handleStoreAddToCart = () => {
    if (!isStore) return;
    (props as StoreModeProps).onAddToCart(allProductVariants, quantities);
    // Parent is responsible for resetting quantities; we also reset locally
    // after successful call to keep the UI in sync.
    setQuantities({});
  };

  const handleCotizadorAddAll = () => {
    if (!isCotizador || !quoteCtx) return;
    let added = 0;
    allProductVariants.forEach(v => {
      const qty = quantities[v.sku] || 0;
      if (qty > 0) {
        quoteCtx.addItem({
          sku: v.sku,
          productName: product.genericName,
          color: v.color,
          format: v.format,
          quantity: qty,
          imageUrl: v.imageUrl || product.imageUrl || undefined,
          minUnit: v.minUnit,
          stepSize: v.stepSize,
        });
        added++;
      }
    });
    if (added > 0) {
      setQuantities({});
      setTimeout(() => (props as CotizadorModeProps).onOpenQuotePanel(), 150);
    }
  };

  // Filter tags: store validates against adminTags for coloring.
  // Cotizador accepts any tag and uses a uniform orange style.
  const displayedTags = isStore
    ? (product.tags || []).filter(t => adminTags.some(at => at.name === t))
    : (product.tags || []);

  return (
    <>
    <div
      className={`rounded-2xl overflow-hidden transition-all duration-300 flex flex-col ${
        expanded
          ? 'border border-[#FF6E23]/30 shadow-xl shadow-orange-100/40 bg-white lg:col-span-2 ring-1 ring-[#FF6E23]/10'
          : 'border border-gray-200/80 bg-white hover:border-gray-300/80 hover:shadow-lg hover:shadow-gray-100/60'
      }`}
    >
      {/* ═══ Header (clickable) ═══ */}
      <div
        className={`cursor-pointer transition-all duration-200 ${
          expanded ? 'bg-gradient-to-r from-orange-50/80 to-amber-50/60' : 'hover:bg-gray-50/40'
        }`}
        onClick={toggleExpanded}
      >
        {!expanded ? (
          <div className="flex">
            {/* Product Image */}
            <div className="w-28 sm:w-40 flex-shrink-0 overflow-hidden bg-gradient-to-br from-gray-50 to-white relative group p-2 sm:p-3">
              {product.imageUrl ? (
                <img
                  src={product.imageUrl}
                  alt={product.genericName}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-contain aspect-square transition-transform duration-300 group-hover:scale-105 rounded-xl"
                  onError={e => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center aspect-square">
                  <ImageIcon className="w-10 h-10 text-gray-200" />
                </div>
              )}

              {/* Tags overlay */}
              {displayedTags.length > 0 && (
                <div className="absolute top-1 left-1 sm:top-2 sm:left-2 flex flex-col gap-1.5">
                  {displayedTags.slice(0, 2).map(tag => {
                    const tagDef = adminTags.find(at => at.name === tag);
                    const bgClass = TAG_BG[tagDef?.color || 'orange'] || 'bg-[#FF6E23]/90';
                    return (
                      <span
                        key={tag}
                        className={`text-[8px] sm:text-[9px] px-1.5 sm:px-2 py-0.5 rounded-md font-bold whitespace-nowrap backdrop-blur-sm ${bgClass} text-white`}
                      >
                        {tag}
                      </span>
                    );
                  })}
                </div>
              )}

              {/* Cotizador: in-quote badge */}
              {isCotizador && inQuoteCount > 0 && (
                <div className="absolute top-1 right-1 sm:top-2 sm:right-2 flex items-center gap-0.5 px-1.5 py-0.5 bg-emerald-500 text-white text-[8px] sm:text-[10px] font-bold rounded-full shadow-sm">
                  <Check className="w-2.5 h-2.5" />
                  <span className="hidden sm:inline">En cotización</span>
                </div>
              )}
            </div>

            {/* Product Info */}
            <div className="flex-1 p-3 sm:p-4 flex flex-col justify-between min-w-0">
              <div>
                {/* TEMPORAL: rebranding Stain → Nuevo Eco Stain */}
                {isTempRebrandedName(product.genericName) && (
                  <div className="mb-1">
                    <TempBadges />
                  </div>
                )}
                <h3 className="text-[13px] sm:text-sm font-bold uppercase leading-tight text-gray-900 line-clamp-2 tracking-tight">
                  {displayProductName(product.genericName)}
                </h3>
                {product.breveResena && (
                  <p className="text-[13px] text-gray-600 mt-1.5 line-clamp-2 leading-relaxed italic">
                    {product.breveResena}
                  </p>
                )}

                {/* Formats */}
                {allFormats.size > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2.5">
                    {Array.from(allFormats).map(fmt => (
                      <span
                        key={fmt}
                        className="inline-flex items-center gap-1 text-[9px] sm:text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-50 text-slate-600 border border-slate-200/60 shadow-sm"
                      >
                        <Box className="w-2.5 h-2.5 text-slate-400" />
                        {fmt}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1.5 mt-2.5">
                <span
                  title="Colores Disponibles"
                  className="inline-flex items-center gap-1 bg-orange-50 text-[#FF6E23] text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-md shadow-sm border border-orange-100/50"
                >
                  <Palette className="w-3 h-3" /> {colorKeys.length}{' '}
                  <span className="font-semibold">Color{colorKeys.length !== 1 ? 'es' : ''}</span>
                </span>
                <span className="flex-1" />
                {(isStore && (props as StoreModeProps).onOpenInfoModal) || (isCotizador && (props as CotizadorModeProps).onViewDetail) ? (
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      if (isStore) (props as StoreModeProps).onOpenInfoModal?.(product.genericName);
                      else (props as CotizadorModeProps).onViewDetail?.(product);
                    }}
                    className="hidden sm:inline-flex items-center gap-1 text-[10px] font-semibold text-gray-500 hover:text-[#FF6E23] bg-gray-50 hover:bg-orange-50 px-2.5 py-1 rounded-lg transition-all"
                  >
                    <Info className="w-3 h-3" /> Detalles
                  </button>
                ) : null}
                <ChevronRight className="h-4 w-4 text-gray-300" />
              </div>
            </div>
          </div>
        ) : (
          /* Expanded header — compact horizontal bar */
          <div className="px-4 py-3 flex items-center gap-3">
            {/* TEMPORAL: rebranding Stain → Nuevo Eco Stain */}
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {isTempRebrandedName(product.genericName) && <TempBadges />}
              <h3 className="text-sm font-bold uppercase text-[#FF6E23] min-w-0 truncate">
                {displayProductName(product.genericName)}
              </h3>
            </div>
            {displayedTags.length > 0 && (
              <div className="flex items-center gap-1">
                {displayedTags.slice(0, 2).map(tag => {
                  const tagDef = adminTags.find(at => at.name === tag);
                  const bgClass = TAG_BG_SOLID[tagDef?.color || 'orange'] || 'bg-[#FF6E23]';
                  return (
                    <span key={tag} className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${bgClass} text-white`}>
                      {tag}
                    </span>
                  );
                })}
              </div>
            )}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span
                title="Colores Disponibles"
                className="inline-flex items-center gap-1 bg-orange-50 text-[#FF6E23] text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm border border-orange-100/50"
              >
                <Palette className="w-2.5 h-2.5" /> {colorKeys.length} Color{colorKeys.length !== 1 ? 'es' : ''}
              </span>
            </div>
            <div className="w-6 h-6 rounded-full flex items-center justify-center bg-gray-200 hover:bg-red-100 text-gray-500 hover:text-red-500 transition-colors flex-shrink-0">
              <X className="h-3.5 w-3.5" />
            </div>
          </div>
        )}
      </div>

      {/* ═══ Expanded panel ═══ */}
      <div
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{
          maxHeight: expanded ? '600px' : '0px',
          opacity: expanded ? 1 : 0,
        }}
      >
        <div className="border-t border-[#FF6E23]/10 flex flex-col pt-3 bg-gradient-to-br from-gray-50/50 to-white">
          {/* Format tabs */}
          <div className="px-5 mb-4">
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2 block">
              Selecciona el Formato
            </span>
            <div className="flex overflow-x-auto gap-2 pb-2 custom-scrollbar snap-x">
              {formatsList.map(format => {
                const isActive = format === activeFormat;
                return (
                  <button
                    key={format}
                    onClick={e => {
                      e.stopPropagation();
                      setActiveFormat(format);
                    }}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border whitespace-nowrap flex-shrink-0 snap-start ${
                      isActive
                        ? 'bg-orange-50/80 border-[#FF6E23] text-[#FF6E23] shadow-sm'
                        : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {format}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Main area: image/summary (left) + colors list (right) */}
          <div className="flex flex-col md:flex-row gap-5 px-5 pb-5">
            {/* Left: Format summary */}
            <div className="hidden md:flex w-44 flex-shrink-0 flex-col items-center">
              <div className="w-full aspect-square rounded-2xl overflow-hidden bg-white shadow-sm border border-gray-100 p-4 mb-3">
                {product.imageUrl ? (
                  <img
                    src={product.imageUrl}
                    alt={product.genericName}
                    className="w-full h-full object-contain"
                    onError={e => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="w-10 h-10 text-gray-200" />
                  </div>
                )}
              </div>
              <div className="text-center w-full">
                <span className="text-xs font-bold text-gray-800 line-clamp-2">{activeFormat}</span>

                {/* Price (store only) */}
                {isStore && activeFormatData?.price && activeFormatData.price > 0 && (
                  <div className="mt-1">
                    {activeFormatData.offerPrice && activeFormatData.offerPrice > 0 ? (
                      <>
                        <span className="inline-block bg-rose-500 text-white text-[9px] px-1.5 py-0 rounded mb-1 font-bold">
                          OFERTA
                        </span>
                        <span className="text-xs text-gray-400 line-through block">
                          {formatPriceCL(activeFormatData.price)}
                        </span>
                        <span className="text-sm font-black text-rose-600 block">
                          {formatPriceCL(activeFormatData.offerPrice)}
                        </span>
                      </>
                    ) : activeFormatData.originalPrice && activeFormatData.originalPrice > activeFormatData.price ? (
                      <>
                        <span
                          className="inline-block bg-emerald-500 text-white text-[9px] px-1.5 py-0 rounded mb-1 font-bold"
                          title={`Descuento convenio ${branchDiscountPct}%`}
                        >
                          CONVENIO -{branchDiscountPct}%
                        </span>
                        <span className="text-xs text-gray-400 line-through block">
                          {formatPriceCL(activeFormatData.originalPrice)}
                        </span>
                        <span className="text-sm font-black text-emerald-600 block">
                          {formatPriceCL(activeFormatData.price)}
                        </span>
                      </>
                    ) : (
                      <span className="text-sm font-black text-[#FF6E23] block">
                        {formatPriceCL(activeFormatData.price)}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Right: Color list */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-3 border-b border-gray-100 pb-2">
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
                  Colores Disponibles · {variantsForFormat.length}
                </span>
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest hidden sm:block">
                  Cantidades
                </span>
              </div>

              <div className="space-y-2.5 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {variantsForFormat.map(variant => {
                  const variantQty = quantities[variant.sku] || 0;
                  const alreadyInQuote = isCotizador && quoteCtx ? quoteCtx.isItemInQuote(variant.sku, variant.color, variant.format) : false;

                  return (
                    <div
                      key={variant.sku}
                      className={`flex items-center justify-between gap-3 p-2.5 rounded-xl border transition-all ${
                        variantQty > 0
                          ? 'bg-orange-50/30 border-[#FF6E23]/30'
                          : alreadyInQuote
                          ? 'bg-emerald-50/30 border-emerald-200'
                          : 'bg-white border-gray-100 hover:border-gray-200'
                      }`}
                    >
                      {/* Color info */}
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-10 h-10 rounded-full bg-gray-50 border border-gray-200 shadow-inner flex-shrink-0 overflow-hidden relative">
                          {variant.imageUrl ? (
                            <img
                              src={variant.imageUrl}
                              alt={variant.color}
                              className="w-full h-full object-cover"
                              onError={e => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <div className="w-full h-full bg-gray-200" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-gray-800 truncate">{variant.color}</div>

                          {isStore && (
                            <>
                              {/* Mobile: full offer display */}
                              <div className="text-[10px] text-gray-400 mt-0.5 md:hidden">
                                {variant.offerPrice && variant.offerPrice > 0 ? (
                                  <>
                                    <span className="inline-block bg-rose-500 text-white text-[8px] px-1 py-0 mr-1 rounded font-bold">
                                      OFERTA
                                    </span>
                                    <span className="line-through text-gray-300">{formatPriceCL(variant.price)}</span>{' '}
                                    <span className="text-rose-600 font-bold">{formatPriceCL(variant.offerPrice)}</span>
                                  </>
                                ) : variant.originalPrice && variant.originalPrice > (variant.price || 0) ? (
                                  <>
                                    <span
                                      className="inline-block bg-emerald-500 text-white text-[8px] px-1 py-0 mr-1 rounded font-bold"
                                      title={`Descuento convenio ${branchDiscountPct}%`}
                                    >
                                      CONVENIO -{branchDiscountPct}%
                                    </span>
                                    <span className="line-through text-gray-300">{formatPriceCL(variant.originalPrice)}</span>{' '}
                                    <span className="text-emerald-600 font-bold">{formatPriceCL(variant.price)}</span>
                                  </>
                                ) : (
                                  variant.price ? formatPriceCL(variant.price) : 'Consultar'
                                )}
                              </div>
                              {/* Desktop: inline offer */}
                              {variant.offerPrice && variant.offerPrice > 0 ? (
                                <div className="hidden md:flex items-center gap-1.5 mt-0.5">
                                  <span className="text-[10px] line-through text-gray-300">
                                    {formatPriceCL(variant.price)}
                                  </span>
                                  <span className="text-xs font-bold text-rose-600">
                                    {formatPriceCL(variant.offerPrice)}
                                  </span>
                                </div>
                              ) : variant.originalPrice && variant.originalPrice > (variant.price || 0) ? (
                                <div className="hidden md:flex items-center gap-1.5 mt-0.5">
                                  <span className="text-[10px] line-through text-gray-300">
                                    {formatPriceCL(variant.originalPrice)}
                                  </span>
                                  <span className="text-xs font-bold text-emerald-600">
                                    {formatPriceCL(variant.price)}
                                  </span>
                                </div>
                              ) : null}
                            </>
                          )}

                          {isCotizador && (
                            <p className="text-[10px] text-gray-400 mt-0.5">
                              {variant.available === false ? '○ Consultar' : '● Disponible'}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Quantity controls */}
                      <div className="flex items-center gap-3 flex-shrink-0">
                        {/* Subtotal preview — store only */}
                        {isStore && variantQty > 0 && variant.price && (() => {
                          const effectiveUnitPrice =
                            variant.offerPrice && variant.offerPrice > 0 ? variant.offerPrice : variant.price;
                          return (
                            <div
                              className={`hidden sm:block text-xs font-bold ${
                                variant.offerPrice && variant.offerPrice > 0 ? 'text-rose-600' : 'text-[#FF6E23]'
                              }`}
                            >
                              {formatPriceCL(effectiveUnitPrice * variantQty)}
                            </div>
                          );
                        })()}

                        <div className="inline-flex items-center rounded-lg overflow-hidden border border-gray-200 bg-white shadow-sm h-9">
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              setQty(variant.sku, Math.max(0, variantQty - (variant.stepSize || 1)));
                            }}
                            className="w-10 h-full flex items-center justify-center bg-gray-50 hover:bg-gray-100 text-gray-500 transition-colors disabled:opacity-40"
                            disabled={variantQty === 0}
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>

                          {/* Display-only: la cantidad sólo se ajusta con +/− para respetar el formato (galón=4, ¼=6, etc.) */}
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={e => {
                              e.stopPropagation();
                              if (typeof onPackagingRulesClick === 'function') onPackagingRulesClick();
                            }}
                            onKeyDown={e => {
                              if (e.key !== 'Tab') {
                                e.preventDefault();
                                if (typeof onPackagingRulesClick === 'function') onPackagingRulesClick();
                              }
                            }}
                            className="w-12 h-full flex items-center justify-center text-sm font-bold border-x border-gray-200 select-none cursor-help"
                            title="Las pinturas se venden por bulto. Usá los botones +/− para ajustar."
                          >
                            {variantQty || 0}
                          </div>

                          <button
                            onClick={e => {
                              e.stopPropagation();
                              const nextQty =
                                variantQty === 0
                                  ? variant.minUnit || 1
                                  : variantQty + (variant.stepSize || 1);
                              setQty(variant.sku, nextQty);
                            }}
                            className="w-10 h-full flex items-center justify-center bg-gray-50 hover:bg-gray-100 text-gray-500 transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Cotizador: "already in quote" indicator */}
                        {isCotizador && alreadyInQuote && variantQty === 0 && (
                          <div className="hidden sm:flex w-9 h-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600" title="Ya en cotización">
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

          {/* Bottom action bar */}
          <div className="bg-white border-t border-gray-100 p-4 sticky bottom-0 z-10 flex items-center justify-between gap-3 shadow-[0_-4px_20px_rgba(0,0,0,0.02)]">
            {isStore ? (
              <div className="flex flex-col">
                <span className="text-[10px] font-semibold text-gray-400 uppercase">
                  {globalProductItemCount > 0
                    ? `Subtotal Seleccionado (${globalProductItemCount} unid.)`
                    : 'Subtotal Formato'}
                </span>
                <span className="text-lg font-black text-gray-900">
                  {formatPriceCL(globalProductTotal > 0 ? globalProductTotal : formatTotal)}
                </span>
              </div>
            ) : (
              <div className="flex flex-col">
                <span className="text-[10px] font-semibold text-gray-400 uppercase">Seleccionados</span>
                <span className="text-lg font-black text-gray-900">
                  {Object.values(quantities).reduce((acc, q) => acc + (q || 0), 0)}{' '}
                  <span className="text-xs font-semibold text-gray-500">unid.</span>
                </span>
              </div>
            )}

            <div className="flex items-center gap-2">
              {isStore && (props as StoreModeProps).onOpenDetail && (
                <button
                  className="h-11 px-4 rounded-xl border-2 border-[#FF6E23] text-[#FF6E23] hover:bg-[#FF6E23]/5 transition-all duration-300 font-bold text-sm flex items-center gap-2"
                  onClick={e => {
                    e.stopPropagation();
                    (props as StoreModeProps).onOpenDetail?.(product, activeFormatData || variantsForFormat[0]);
                  }}
                >
                  <Info className="h-4 w-4" />
                  <span className="hidden sm:inline">Ver Detalles</span>
                </button>
              )}

              {isCotizador && (props as CotizadorModeProps).onViewDetail && (
                <button
                  className="h-11 px-4 rounded-xl border-2 border-[#FF6E23] text-[#FF6E23] hover:bg-[#FF6E23]/5 transition-all duration-300 font-bold text-sm flex items-center gap-2"
                  onClick={e => {
                    e.stopPropagation();
                    (props as CotizadorModeProps).onViewDetail?.(product);
                  }}
                >
                  <Info className="h-4 w-4" />
                  <span className="hidden sm:inline">Ver Detalles</span>
                </button>
              )}

              <button
                className="h-11 px-6 rounded-xl bg-[#FF6E23] hover:bg-[#E55E13] text-white transition-all duration-300 font-bold text-sm flex items-center gap-2 shadow-lg shadow-orange-500/20 hover:shadow-orange-500/40 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:hover:shadow-orange-500/20 group"
                onClick={e => {
                  e.stopPropagation();
                  if (isStore) handleStoreAddToCart();
                  else handleCotizadorAddAll();
                }}
                disabled={
                  isStore
                    ? globalProductTotal === 0
                    : Object.values(quantities).every(q => !q || q === 0)
                }
              >
                <ShoppingCart className="h-4 w-4 transition-transform duration-300 group-hover:scale-110" />
                <span className="hidden sm:inline">
                  {isStore ? 'Añadir al Carrito' : 'Agregar a Cotización'}
                </span>
                <span className="sm:hidden">{isStore ? 'Añadir' : 'Cotizar'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
    {packagingModalOpen && (
      <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setPackagingModalOpen(false)}>
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 relative" onClick={(e) => e.stopPropagation()}>
          <button onClick={() => setPackagingModalOpen(false)} className="absolute top-3 right-3 w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-500" aria-label="Cerrar">
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center flex-shrink-0">
              <Info className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-lg">Cantidades por bulto</h3>
              <p className="text-sm text-gray-500 mt-1">No es posible seleccionar cantidades libres.</p>
            </div>
          </div>
          <p className="text-sm text-gray-700 leading-relaxed mb-4">
            Las pinturas se entregan en su formato original de venta. Por eso las cantidades se ajustan en bloques:
          </p>
          <ul className="space-y-2 text-sm">
            <li className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg">
              <span className="font-bold text-orange-600 w-20">Galón</span>
              <span className="text-gray-700">se vende de a <strong>4 unidades</strong></span>
            </li>
            <li className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg">
              <span className="font-bold text-orange-600 w-20">¼ Galón</span>
              <span className="text-gray-700">se vende de a <strong>6 unidades</strong></span>
            </li>
            <li className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg">
              <span className="font-bold text-orange-600 w-20">Balde</span>
              <span className="text-gray-700">se vende por <strong>unidad</strong></span>
            </li>
          </ul>
          <p className="text-xs text-gray-500 mt-4">Usá los botones <strong>+</strong> y <strong>−</strong> para ajustar.</p>
          <button onClick={() => setPackagingModalOpen(false)} className="mt-5 w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-2.5 rounded-xl transition">
            Entendido
          </button>
        </div>
      </div>
    )}
    </>
  );
}

