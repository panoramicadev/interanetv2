import { X, Trash2, FileText, Send, Minus, Plus, Package } from 'lucide-react';
import { useQuote } from '@/contexts/QuoteContext';

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: () => void;
}

export default function CotizadorQuotePanel({ open, onClose, onSubmit }: Props) {
  const { state, removeItem, updateQuantity, clearQuote } = useQuote();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[55]" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      {/* Panel — slide from right */}
      <div
        className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-300"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-orange-500" />
            <h2 className="font-bold text-lg text-slate-800">Mi Cotización</h2>
            {state.itemCount > 0 && (
              <span className="px-2 py-0.5 bg-orange-100 text-orange-600 text-xs font-bold rounded-full">
                {state.itemCount}
              </span>
            )}
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto">
          {state.items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-6 py-12">
              <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                <Package className="w-10 h-10 text-slate-300" />
              </div>
              <h3 className="font-semibold text-lg text-slate-700 mb-1">Sin productos</h3>
              <p className="text-sm text-slate-400 max-w-[240px]">
                Agrega productos del catálogo para armar tu solicitud de cotización
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {state.items.map(item => (
                <div key={item.id} className="flex gap-3 p-4 hover:bg-slate-50/50 transition-colors">
                  {/* Image */}
                  <div className="w-14 h-14 flex-shrink-0 rounded-lg bg-slate-100 overflow-hidden">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.productName} className="w-full h-full object-contain p-1" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="w-6 h-6 text-slate-300" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold text-slate-800 truncate uppercase">{item.productName}</h4>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {item.color && item.color !== 'Sin Color' ? `${item.color} · ` : ''}{item.format}
                    </p>
                    <p className="text-[10px] text-slate-300 mt-0.5">SKU: {item.sku}</p>

                    {/* Quantity */}
                    <div className="flex items-center gap-1.5 mt-2">
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity - (item.stepSize || 1))}
                        className="w-6 h-6 flex items-center justify-center rounded bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-sm font-semibold text-slate-700 w-8 text-center">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity + (item.stepSize || 1))}
                        className="w-6 h-6 flex items-center justify-center rounded bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Remove */}
                  <button
                    onClick={() => removeItem(item.id)}
                    className="p-1.5 text-slate-300 hover:text-red-500 transition-colors self-start"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {state.items.length > 0 && (
          <div className="border-t border-slate-100 p-4 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Total de productos</span>
              <span className="font-bold text-slate-800">{state.itemCount} {state.itemCount === 1 ? 'producto' : 'productos'}</span>
            </div>

            <button
              onClick={onSubmit}
              className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-semibold rounded-xl hover:from-orange-600 hover:to-orange-700 transition-all shadow-md active:scale-[0.98]"
            >
              <Send className="w-4 h-4" />
              Solicitar Cotización
            </button>

            <button
              onClick={clearQuote}
              className="w-full py-2 text-sm text-slate-400 hover:text-red-500 transition-colors"
            >
              Vaciar lista
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
