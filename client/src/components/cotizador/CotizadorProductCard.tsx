import { useState } from 'react';
import { Plus, Check, Package, Box, Minus, Eye, Palette } from 'lucide-react';
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

  const colorKeys = Object.keys(product.colors)
    .sort((a, b) => product.colors[b].length - product.colors[a].length);

  // Get all unique formats
  const allFormats = new Set<string>();
  Object.values(product.colors).flat().forEach(v => {
    if (v.format) allFormats.add(v.format);
  });
  const formats = Array.from(allFormats);

  // Default to first color + first variant
  const [selectedColor, setSelectedColor] = useState(colorKeys[0] || '');
  const variants = product.colors[selectedColor] || [];
  const [selectedFormatIdx, setSelectedFormatIdx] = useState(0);

  // Filter variants by selected format
  const selectedFormat = formats[selectedFormatIdx] || '';
  const matchingVariant = variants.find(v => v.format === selectedFormat) || variants[0];

  const [quantity, setQuantity] = useState(matchingVariant?.minUnit || 1);
  const alreadyInQuote = matchingVariant ? isItemInQuote(matchingVariant.sku, matchingVariant.color, matchingVariant.format) : false;

  const handleAdd = () => {
    if (!matchingVariant) return;
    addItem({
      sku: matchingVariant.sku,
      productName: product.genericName,
      color: matchingVariant.color,
      format: matchingVariant.format,
      quantity,
      imageUrl: matchingVariant.imageUrl || product.imageUrl || undefined,
      minUnit: matchingVariant.minUnit,
      stepSize: matchingVariant.stepSize,
    });
    setQuantity(matchingVariant.minUnit || 1);
  };

  return (
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
        {/* Category */}
        {product.groupName && (
          <span className="text-[9px] font-bold text-[#FF6E23] uppercase tracking-widest">{product.groupName}</span>
        )}

        {/* Name */}
        <h3 className="text-xs sm:text-sm font-bold uppercase text-gray-900 leading-tight line-clamp-2 tracking-tight">
          {product.genericName}
        </h3>

        {/* Description */}
        {product.breveResena && (
          <p className="text-[11px] text-gray-500 line-clamp-2 leading-relaxed">{product.breveResena}</p>
        )}

        {/* Formats */}
        {formats.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {formats.map((fmt, idx) => (
              <button
                key={fmt}
                onClick={() => setSelectedFormatIdx(idx)}
                className={`inline-flex items-center gap-0.5 text-[9px] font-semibold px-2 py-0.5 rounded-md transition-all ${
                  idx === selectedFormatIdx
                    ? 'bg-[#FF6E23]/10 text-[#FF6E23] border border-[#FF6E23]/30'
                    : 'bg-slate-50 text-slate-500 border border-slate-200/60 hover:border-slate-300'
                }`}
              >
                <Box className="w-2.5 h-2.5" />
                {fmt}
              </button>
            ))}
          </div>
        )}

        {/* Colors + Info */}
        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 bg-orange-50 text-[#FF6E23] text-[10px] font-bold px-2 py-0.5 rounded-md border border-orange-100/50">
            <Palette className="w-3 h-3" /> {colorKeys.length} Color{colorKeys.length !== 1 ? 'es' : ''}
          </span>
          {matchingVariant && (
            <span className={`text-[10px] font-medium ${matchingVariant.available ? 'text-emerald-500' : 'text-amber-500'}`}>
              {matchingVariant.available ? '● Disponible' : '○ Consultar'}
            </span>
          )}
        </div>

        {/* Color selector — circular thumbnails (if > 1) */}
        {colorKeys.length > 1 && (
          <div className="flex gap-1.5 flex-wrap">
            {colorKeys.slice(0, 8).map(color => {
              const colorVariant = product.colors[color]?.[0];
              const isActive = selectedColor === color;
              return (
                <button
                  key={color}
                  onClick={() => { setSelectedColor(color); setQuantity(product.colors[color]?.[0]?.minUnit || 1); }}
                  title={color}
                  className={`w-7 h-7 rounded-full border-2 overflow-hidden flex-shrink-0 transition-all ${
                    isActive
                      ? 'border-[#FF6E23] ring-2 ring-orange-200 scale-110'
                      : 'border-gray-200 hover:border-gray-400'
                  }`}
                >
                  {colorVariant?.imageUrl ? (
                    <img src={colorVariant.imageUrl} alt={color} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gray-200" />
                  )}
                </button>
              );
            })}
            {colorKeys.length > 8 && (
              <span className="w-7 h-7 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-[9px] font-bold text-gray-400">
                +{colorKeys.length - 8}
              </span>
            )}
          </div>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Quantity + Add */}
        <div className="flex items-center gap-2 pt-1 mt-auto">
          <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => setQuantity(Math.max(matchingVariant?.minUnit || 1, quantity - (matchingVariant?.stepSize || 1)))}
              className="w-7 h-8 flex items-center justify-center text-gray-500 hover:bg-gray-50"
            >
              <Minus className="w-3 h-3" />
            </button>
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(Math.max(matchingVariant?.minUnit || 1, parseInt(e.target.value) || 1))}
              className="w-10 text-center text-xs font-bold border-x border-gray-200 h-8 focus:outline-none"
              min={matchingVariant?.minUnit || 1}
              step={matchingVariant?.stepSize || 1}
            />
            <button
              onClick={() => setQuantity(quantity + (matchingVariant?.stepSize || 1))}
              className="w-7 h-8 flex items-center justify-center text-gray-500 hover:bg-gray-50"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>

          <button
            onClick={handleAdd}
            disabled={!matchingVariant}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all active:scale-[0.97] ${
              alreadyInQuote
                ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                : 'bg-gradient-to-r from-[#FF6E23] to-[#E55E13] text-white hover:from-[#E55E13] hover:to-[#D54E03] shadow-sm'
            }`}
          >
            {alreadyInQuote ? <><Check className="w-3.5 h-3.5" /> Agregado</> : <><Plus className="w-3.5 h-3.5" /> Cotizar</>}
          </button>
        </div>
      </div>
    </div>
  );
}
