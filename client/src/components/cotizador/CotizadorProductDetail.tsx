import { useState } from 'react';
import { X, Plus, Check, Package, Palette, ChevronRight } from 'lucide-react';
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
}

export default function CotizadorProductDetail({ product, open, onClose }: Props) {
  const { addItem, isItemInQuote } = useQuote();

  if (!open || !product) return null;

  const colorNames = Object.keys(product.colors);
  const [selectedColor, setSelectedColor] = useState(colorNames[0] || '');
  const variants = product.colors[selectedColor] || [];
  const [selectedVariantIdx, setSelectedVariantIdx] = useState(0);
  const variant = variants[selectedVariantIdx];
  const [quantity, setQuantity] = useState(variant?.minUnit || 1);

  const alreadyInQuote = variant ? isItemInQuote(variant.sku, variant.color, variant.format) : false;

  const handleAdd = () => {
    if (!variant) return;
    addItem({
      sku: variant.sku,
      productName: product.genericName,
      color: variant.color,
      format: variant.format,
      quantity,
      imageUrl: variant.imageUrl || product.imageUrl || undefined,
      minUnit: variant.minUnit,
      stepSize: variant.stepSize,
    });
  };

  const getColorDot = (colorName: string) => {
    const c = colorName.toUpperCase();
    const map: Record<string, string> = {
      'BLANCO': '#FFFFFF', 'NEGRO': '#1a1a1a', 'GRIS': '#9ca3af', 'ROJO': '#ef4444',
      'AZUL': '#3b82f6', 'VERDE': '#22c55e', 'AMARILLO': '#eab308', 'CAFÉ': '#92400e',
      'NARANJA': '#f97316', 'TRANSPARENTE': 'transparent', 'MARFIL': '#FFFFF0',
    };
    for (const [key, hex] of Object.entries(map)) {
      if (c.includes(key)) return hex;
    }
    return '#d1d5db';
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Close */}
        <button onClick={onClose} className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/80 backdrop-blur-sm hover:bg-white shadow-sm transition-all">
          <X className="w-5 h-5 text-slate-600" />
        </button>

        <div className="grid md:grid-cols-2 gap-0">
          {/* Image */}
          <div className="bg-gradient-to-br from-slate-50 to-slate-100 p-8 flex items-center justify-center min-h-[300px] md:min-h-[400px] rounded-tl-2xl md:rounded-bl-2xl">
            {product.imageUrl ? (
              <img
                src={product.imageUrl}
                alt={product.genericName}
                className="max-w-full max-h-[350px] object-contain drop-shadow-lg"
              />
            ) : (
              <Package className="w-32 h-32 text-slate-200" />
            )}
          </div>

          {/* Info */}
          <div className="p-6 md:p-8 space-y-5">
            {/* Category breadcrumb */}
            {product.groupName && (
              <div className="flex items-center gap-1 text-xs text-slate-400">
                <span>Catálogo</span>
                <ChevronRight className="w-3 h-3" />
                <span className="text-orange-500 font-medium">{product.groupName}</span>
              </div>
            )}

            {/* Name */}
            <h2 className="text-xl md:text-2xl font-bold text-slate-900 uppercase tracking-wide leading-tight">
              {product.genericName}
            </h2>

            {/* Tags */}
            {product.tags && product.tags.length > 0 && (
              <div className="flex gap-1.5 flex-wrap">
                {product.tags.map(tag => (
                  <span key={tag} className="px-2.5 py-1 bg-orange-50 text-orange-600 text-xs font-semibold rounded-full">
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Brief description */}
            {product.breveResena && (
              <p className="text-sm text-slate-600 leading-relaxed">{product.breveResena}</p>
            )}

            {/* Detailed description */}
            {product.descripcion && (
              <div>
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">Descripción</h4>
                <p className="text-sm text-slate-600 leading-relaxed">{product.descripcion}</p>
              </div>
            )}

            {/* Uses */}
            {product.usos && (
              <div>
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">Usos</h4>
                <p className="text-sm text-slate-600 leading-relaxed">{product.usos}</p>
              </div>
            )}

            {/* Presentation */}
            {product.presentacion && (
              <div>
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">Presentación</h4>
                <p className="text-sm text-slate-600 leading-relaxed">{product.presentacion}</p>
              </div>
            )}

            {/* Divider */}
            <hr className="border-slate-100" />

            {/* Color selector */}
            {colorNames.length > 1 && (
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5" /> Color: <span className="text-slate-800 normal-case">{selectedColor}</span>
                </label>
                <div className="flex gap-2 flex-wrap mt-1.5">
                  {colorNames.map(color => (
                    <button
                      key={color}
                      onClick={() => { setSelectedColor(color); setSelectedVariantIdx(0); setQuantity((product.colors[color]?.[0]?.minUnit) || 1); }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                        selectedColor === color
                          ? 'border-orange-400 bg-orange-50 text-orange-700'
                          : 'border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <span className="w-3.5 h-3.5 rounded-full border border-slate-200" style={{ backgroundColor: getColorDot(color) }} />
                      {color}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Format selector */}
            {variants.length > 0 && (
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2 block">
                  Formato
                </label>
                <div className="flex gap-2 flex-wrap">
                  {variants.map((v, idx) => (
                    <button
                      key={v.sku}
                      onClick={() => { setSelectedVariantIdx(idx); setQuantity(v.minUnit); }}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                        idx === selectedVariantIdx
                          ? 'border-orange-400 bg-orange-50 text-orange-700'
                          : 'border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      {v.format}
                      <span className={`ml-1.5 text-[10px] ${v.available ? 'text-emerald-500' : 'text-amber-500'}`}>
                        {v.available ? '● Disponible' : '○ Consultar'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Quantity + Add */}
            <div className="flex items-center gap-3 pt-2">
              <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden">
                <button
                  onClick={() => setQuantity(Math.max(variant?.minUnit || 1, quantity - (variant?.stepSize || 1)))}
                  className="px-3.5 py-2.5 text-slate-500 hover:bg-slate-50 font-bold"
                >−</button>
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(variant?.minUnit || 1, parseInt(e.target.value) || 1))}
                  className="w-16 text-center font-semibold border-x border-slate-200 py-2.5 focus:outline-none"
                  min={variant?.minUnit || 1}
                  step={variant?.stepSize || 1}
                />
                <button
                  onClick={() => setQuantity(quantity + (variant?.stepSize || 1))}
                  className="px-3.5 py-2.5 text-slate-500 hover:bg-slate-50 font-bold"
                >+</button>
              </div>

              <button
                onClick={handleAdd}
                disabled={!variant}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold transition-all active:scale-[0.97] shadow-sm ${
                  alreadyInQuote
                    ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                    : 'bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:from-orange-600 hover:to-orange-700'
                }`}
              >
                {alreadyInQuote ? (
                  <><Check className="w-5 h-5" /> Agregar Más</>
                ) : (
                  <><Plus className="w-5 h-5" /> Agregar a Cotización</>
                )}
              </button>
            </div>

            {variant && (
              <p className="text-[11px] text-slate-400">
                SKU: {variant.sku} — Min: {variant.minUnit} {variant.stepSize > 1 ? `(múltiplos de ${variant.stepSize})` : ''}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
