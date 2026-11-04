/**
 * Selector de formato, color y cantidad del cotizador. Lo usan el detalle en ventana
 * (CotizadorProductDetail) y la página de producto (/productos/:slug), para que ambos
 * agreguen a la cotización exactamente igual.
 */
import { useState, type CSSProperties } from 'react';
import { Plus, Check, Minus, ShoppingCart, Box, Palette } from 'lucide-react';
import { useQuote } from '@/contexts/QuoteContext';
import { VENTA_POR_UNIDAD_COTIZADOR_WEB } from '@shared/venta-por-unidad';
import { imagenLiviana } from '@/lib/imagen-liviana';

export interface Variant {
  sku: string;
  name: string;
  color: string;
  format: string;
  available: boolean;
  minUnit: number;
  stepSize: number;
  imageUrl?: string;
}

export interface ProductData {
  genericName: string;
  groupName?: string;
  imageUrl?: string;
  breveResena?: string;
  descripcion?: string;
  usos?: string;
  presentacion?: string;
  tags?: string[];
  categories?: string[];
  colors: Record<string, Variant[]>;
}

export function useSeleccionCotizador(product: ProductData | null) {
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

  const updateQty = (sku: string, delta: number, min: number, step: number) => {
    setQuantities(prev => {
      const current = prev[sku] || 0;
      const next = current + delta;
      if (next <= 0) return { ...prev, [sku]: 0 };
      if (current === 0 && delta > 0) return { ...prev, [sku]: min };
      return { ...prev, [sku]: Math.max(min, next) };
    });
  };

  // Venta por unidad: la cantidad también se puede escribir.
  const setQty = (sku: string, value: string) => {
    const n = parseInt(value, 10);
    setQuantities(prev => ({ ...prev, [sku]: Number.isFinite(n) && n > 0 ? n : 0 }));
  };

  const addToQuote = (variant: Variant) => {
    if (!product) return;
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

  /** Agrega todo lo que tenga cantidad en el formato activo; devuelve cuántas líneas agregó. */
  const addAll = () => {
    let added = 0;
    variantsForFormat.forEach(v => {
      const qty = quantities[v.sku];
      if (qty && qty > 0) {
        addToQuote(v);
        added++;
      }
    });
    return added;
  };

  const hasItemsToAdd = Object.values(quantities).some(q => q > 0);

  return { formatsList, activeFormat, setActiveFormat, variantsForFormat, quantities, updateQty, setQty, addToQuote, addAll, hasItemsToAdd, isItemInQuote };
}

type Seleccion = ReturnType<typeof useSeleccionCotizador>;

export function SelectorVariantes({ sel, onAdded, onPreview }: {
  sel: Seleccion;
  onAdded?: () => void;
  /** Al pasar por un color se muestra su imagen en la vitrina; sin argumento, vuelve a la del producto. */
  onPreview?: (imageUrl?: string) => void;
}) {
  const { formatsList, activeFormat, setActiveFormat, variantsForFormat, quantities, updateQty, setQty, addToQuote, isItemInQuote } = sel;

  return (
    <>
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
                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 border active:scale-95 ${
                  format === activeFormat
                    ? 'bg-[#fd6301] border-[#fd6301] text-white shadow-lg shadow-orange-500/30 -translate-y-0.5'
                    : 'bg-white border-gray-200 text-gray-600 hover:border-[#fd6301]/40 hover:text-gray-900 hover:-translate-y-0.5'
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
        {/* key: al cambiar de formato las filas vuelven a entrar en cascada */}
        <div key={activeFormat} className="space-y-2" onMouseLeave={() => onPreview?.()}>
          {variantsForFormat.map((variant, i) => {
            const qty = quantities[variant.sku] || 0;
            const alreadyIn = isItemInQuote(variant.sku, variant.color, variant.format);

            return (
              <div
                key={variant.sku}
                onMouseEnter={() => variant.imageUrl && onPreview?.(variant.imageUrl)}
                style={{ '--cz-delay': `${Math.min(i, 10) * 45}ms` } as CSSProperties}
                className={`cz-subir group/fila flex items-center gap-3 p-3 rounded-2xl border transition-[background-color,border-color,box-shadow] duration-200 ${
                  qty > 0
                    ? 'bg-orange-50/70 border-[#fd6301]/40 shadow-md shadow-orange-500/10'
                    : alreadyIn ? 'bg-emerald-50/60 border-emerald-200' : 'bg-white border-gray-100 hover:border-gray-200 hover:shadow-md'
                }`}
              >
                <div className="w-11 h-11 rounded-full bg-gray-50 ring-2 ring-white shadow-md flex-shrink-0 overflow-hidden transition-transform duration-300 group-hover/fila:scale-110 group-hover/fila:rotate-6">
                  {variant.imageUrl ? (
                    <img src={imagenLiviana(variant.imageUrl, 80)} alt={variant.color} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gray-200" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-800 truncate">{variant.color}</p>
                  <p className="text-[10px] text-gray-400 truncate">
                    <span className={variant.available ? 'text-emerald-500' : ''}>{variant.available ? '●' : '○'}</span>{' '}
                    {variant.available ? 'Disponible' : 'Consultar'}
                    <span className="ml-1 text-gray-300">SKU: {variant.sku}</span>
                  </p>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => updateQty(variant.sku, -(variant.stepSize || 1), variant.minUnit, variant.stepSize)}
                    aria-label={`Restar ${variant.color}`}
                    className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 active:scale-90 transition-transform text-gray-600"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={qty}
                    readOnly={!VENTA_POR_UNIDAD_COTIZADOR_WEB}
                    onChange={(e) => setQty(variant.sku, e.target.value)}
                    onFocus={(e) => e.target.select()}
                    aria-label="Cantidad"
                    className={`w-10 h-9 transition-colors text-sm text-center font-black rounded-xl border outline-none focus:ring-1 focus:ring-[#fd6301] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${
                      qty > 0 ? 'bg-[#fd6301]/10 border-[#fd6301]/30 text-[#fd6301]' : 'bg-white border-gray-200 text-gray-400'
                    }`}
                  />
                  <button
                    onClick={() => updateQty(variant.sku, variant.stepSize || 1, variant.minUnit, variant.stepSize)}
                    aria-label={`Sumar ${variant.color}`}
                    className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 active:scale-90 transition-transform text-gray-600"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                  {qty > 0 && (
                    <button
                      onClick={() => {
                        addToQuote(variant);
                        onAdded?.();
                      }}
                      aria-label={`Agregar ${variant.color} a la cotización`}
                      className="cz-pop w-9 h-9 flex items-center justify-center rounded-xl bg-[#fd6301] text-white shadow-md shadow-orange-500/30 active:scale-90 transition-transform ml-0.5"
                    >
                      <ShoppingCart className="w-4 h-4" />
                    </button>
                  )}
                  {qty === 0 && alreadyIn && (
                    <div className="cz-pop w-9 h-9 flex items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 ml-0.5" title="Ya está en tu cotización">
                      <Check className="w-4 h-4" />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

export function BotonAgregarCotizacion({ sel, onAdded }: { sel: Seleccion; onAdded?: () => void }) {
  const { hasItemsToAdd, addAll, quantities } = sel;
  const conCantidad = Object.values(quantities).filter(q => q > 0);
  const unidades = conCantidad.reduce((s, q) => s + q, 0);
  return (
    <div>
    {hasItemsToAdd && (
      <p className="cz-subir text-xs text-gray-500 text-center mb-2">
        <span className="font-bold text-gray-800">{conCantidad.length}</span> {conCantidad.length === 1 ? 'color' : 'colores'} ·{' '}
        <span className="font-bold text-[#fd6301]">{unidades}</span> {unidades === 1 ? 'unidad' : 'unidades'}
      </p>
    )}
    <button
      onClick={() => { if (addAll() > 0) onAdded?.(); }}
      disabled={!hasItemsToAdd}
      className={`w-full flex items-center justify-center gap-2 py-3.5 font-bold rounded-2xl transition-all text-sm ${
        hasItemsToAdd
          ? 'bg-gradient-to-r from-[#fd6301] to-[#e35400] text-white active:scale-[0.98] shadow-lg hover:from-[#e35400] hover:to-[#c94a00]'
          : 'bg-gray-100 text-gray-400 cursor-not-allowed'
      }`}
    >
      <ShoppingCart className="w-4 h-4" />
      {hasItemsToAdd ? 'Agregar a mi cotización' : 'Selecciona una cantidad'}
    </button>
    </div>
  );
}
