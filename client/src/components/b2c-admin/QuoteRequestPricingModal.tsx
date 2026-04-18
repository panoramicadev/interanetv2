/**
 * QuoteRequestPricingModal — Admin modal to assign prices to a B2C quote_request.
 * After submit: calls /api/b2c/quote-requests/:id/pricing, then opens the PDF in a new tab.
 */

import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Save,
  FileText,
  Package,
  Loader2,
  CheckCircle2,
  Palette,
  DollarSign,
  AlertCircle,
} from 'lucide-react';

interface QuoteRequestItem {
  sku: string;
  productName: string;
  color?: string;
  format?: string;
  quantity: number;
  imageUrl?: string;
  itemType?: 'standard' | 'custom_color';
  customColorCode?: string;
  customColorBrand?: string;
  customColorHex?: string;
  customColorNotes?: string;
  unitPrice?: number;
  lineTotal?: number;
}

interface QuoteRequest {
  id: string;
  visitorName: string;
  visitorEmail: string;
  visitorCompany?: string;
  items: QuoteRequestItem[];
  status: string;
  quoteNumber?: string;
  subtotal?: string | number;
  taxAmount?: string | number;
  totalAmount?: string | number;
  internalNotes?: string;
}

interface Props {
  open: boolean;
  request: QuoteRequest | null;
  onClose: () => void;
  onSuccess: () => void;
}

const TAX_RATE = 0.19;

const fmtCLP = (n: number): string =>
  `$${Math.round(n).toLocaleString('es-CL').replace(/,/g, '.')}`;

export default function QuoteRequestPricingModal({ open, request, onClose, onSuccess }: Props) {
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState('');
  const [validDays, setValidDays] = useState(7);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize from request
  useEffect(() => {
    if (!request) return;
    const initial: Record<string, string> = {};
    (request.items || []).forEach((it, idx) => {
      const key = `${idx}`;
      initial[key] = it.unitPrice ? String(it.unitPrice) : '';
    });
    setPrices(initial);
    setNotes(request.internalNotes || '');
    setError(null);
  }, [request]);

  const totals = useMemo(() => {
    if (!request) return { subtotal: 0, tax: 0, total: 0 };
    let subtotal = 0;
    (request.items || []).forEach((it, idx) => {
      const price = parseFloat(prices[`${idx}`] || '0') || 0;
      subtotal += Math.round(price * (it.quantity || 0));
    });
    const tax = Math.round(subtotal * TAX_RATE);
    return { subtotal, tax, total: subtotal + tax };
  }, [prices, request]);

  const allPriced = useMemo(() => {
    if (!request) return false;
    return (request.items || []).every((_, idx) => {
      const p = parseFloat(prices[`${idx}`] || '0');
      return !isNaN(p) && p > 0;
    });
  }, [prices, request]);

  if (!open || !request) return null;

  const handleSubmit = async (andOpenPdf: boolean) => {
    if (!allPriced) {
      setError('Debes asignar un precio mayor a 0 a cada producto');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        items: (request.items || []).map((it, idx) => ({
          sku: it.sku,
          color: it.color,
          format: it.format,
          unitPrice: parseFloat(prices[`${idx}`] || '0') || 0,
        })),
        internalNotes: notes,
        validDays,
      };
      const res = await fetch(
        `/api/b2c/quote-requests/${request.id}/pricing`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message || 'Error al guardar');
      }
      if (andOpenPdf) {
        window.open(`/api/b2c/quote-requests/${request.id}/pdf`, '_blank');
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Error al guardar');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] flex items-center justify-center p-2 sm:p-4"
          onClick={onClose}
        >
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />

          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 280, damping: 28 }}
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[94vh] overflow-hidden flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-5 sm:px-7 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FF6E23] to-[#E55E13] flex items-center justify-center shadow-sm">
                  <DollarSign className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-800">
                    Asignar Precios
                  </h2>
                  <p className="text-xs text-slate-500">
                    {request.visitorName}
                    {request.visitorCompany && ` · ${request.visitorCompany}`}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 sm:px-7 py-4">
              {/* Items table */}
              <div className="mb-5">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
                  Productos Solicitados
                </h3>
                <div className="space-y-2">
                  {(request.items || []).map((item, idx) => {
                    const isCustom = item.itemType === 'custom_color';
                    const priceVal = prices[`${idx}`] || '';
                    const priceNum = parseFloat(priceVal) || 0;
                    const line = Math.round(priceNum * (item.quantity || 0));

                    return (
                      <div
                        key={idx}
                        className={`flex items-center gap-3 p-3 rounded-xl border ${
                          isCustom
                            ? 'bg-gradient-to-r from-fuchsia-50/50 to-pink-50/50 border-fuchsia-200'
                            : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        {/* Image / swatch */}
                        <div
                          className="w-12 h-12 rounded-lg bg-white border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center relative"
                          style={
                            isCustom && item.customColorHex
                              ? { background: item.customColorHex }
                              : undefined
                          }
                        >
                          {!isCustom && item.imageUrl ? (
                            <img
                              src={item.imageUrl}
                              alt={item.productName}
                              className="w-full h-full object-contain p-1"
                            />
                          ) : !isCustom ? (
                            <Package className="w-5 h-5 text-slate-300" />
                          ) : (
                            <Palette className="w-5 h-5 text-white drop-shadow" />
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="text-sm font-bold text-slate-800 truncate">
                              {item.productName}
                            </p>
                            {isCustom && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-gradient-to-r from-fuchsia-500 to-pink-500 text-white">
                                <Palette className="w-2.5 h-2.5" /> CUSTOM
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500">
                            {item.color && item.color !== 'Sin Color'
                              ? `${item.color} · `
                              : ''}
                            {item.format} · SKU: {item.sku}
                          </p>
                          {isCustom && (
                            <p className="text-[11px] text-fuchsia-700 font-medium mt-0.5">
                              {item.customColorBrand}: {item.customColorCode}
                              {item.customColorHex &&
                                ` · ${item.customColorHex.toUpperCase()}`}
                            </p>
                          )}
                        </div>

                        {/* Quantity */}
                        <div className="text-center shrink-0">
                          <p className="text-[10px] text-slate-400 uppercase font-bold">
                            Cant.
                          </p>
                          <p className="text-sm font-bold text-slate-700">
                            {item.quantity}
                          </p>
                        </div>

                        {/* Unit price input */}
                        <div className="shrink-0 w-32">
                          <p className="text-[10px] text-slate-400 uppercase font-bold mb-0.5">
                            Precio unit. *
                          </p>
                          <div className="relative">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                              $
                            </span>
                            <input
                              type="number"
                              min={0}
                              step={1}
                              value={priceVal}
                              onChange={e =>
                                setPrices(p => ({
                                  ...p,
                                  [`${idx}`]: e.target.value,
                                }))
                              }
                              placeholder="0"
                              className="w-full pl-6 pr-2 py-1.5 border border-slate-300 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-400 transition-all"
                            />
                          </div>
                        </div>

                        {/* Line total */}
                        <div className="text-right shrink-0 w-28">
                          <p className="text-[10px] text-slate-400 uppercase font-bold">
                            Total línea
                          </p>
                          <p className="text-sm font-black text-[#FF6E23]">
                            {line > 0 ? fmtCLP(line) : '—'}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Totals + options */}
              <div className="grid md:grid-cols-2 gap-4">
                {/* Options */}
                <div className="space-y-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">
                      Observaciones internas (aparecen en el PDF)
                    </label>
                    <textarea
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      rows={3}
                      placeholder="Notas visibles al cliente en la cotización..."
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30 resize-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">
                      Validez (días)
                    </label>
                    <div className="flex gap-1.5">
                      {[7, 15, 30, 60].map(d => (
                        <button
                          key={d}
                          onClick={() => setValidDays(d)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                            validDays === d
                              ? 'bg-slate-900 text-white'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {d} días
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Totals */}
                <div className="rounded-xl bg-gradient-to-br from-slate-50 to-white border border-slate-200 p-4">
                  <div className="flex justify-between text-sm text-slate-600 mb-1.5">
                    <span>Subtotal</span>
                    <span className="font-semibold text-slate-800">
                      {fmtCLP(totals.subtotal)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm text-slate-600 mb-1.5">
                    <span>IVA (19%)</span>
                    <span className="font-semibold text-slate-800">
                      {fmtCLP(totals.tax)}
                    </span>
                  </div>
                  <div className="flex justify-between text-base font-black pt-2 border-t border-slate-200">
                    <span className="text-slate-800">Total final</span>
                    <motion.span
                      key={totals.total}
                      initial={{ scale: 0.95, opacity: 0.6 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="text-[#FF6E23]"
                    >
                      {fmtCLP(totals.total)}
                    </motion.span>
                  </div>
                </div>
              </div>

              {error && (
                <div className="mt-3 px-3 py-2 bg-red-50 text-red-600 text-sm rounded-lg flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" /> {error}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 sm:px-7 py-3 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between gap-2 shrink-0 flex-wrap">
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                {allPriced ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />{' '}
                    Todos los precios asignados
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-4 h-4 text-amber-500" /> Falta
                    asignar precios
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={onClose}
                  disabled={submitting}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900 hover:bg-white rounded-lg transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => handleSubmit(false)}
                  disabled={submitting || !allPriced}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-bold rounded-xl hover:bg-slate-800 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Guardar
                </button>
                <button
                  onClick={() => handleSubmit(true)}
                  disabled={submitting || !allPriced}
                  className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-[#FF6E23] to-[#E55E13] text-white text-sm font-bold rounded-xl hover:from-[#E55E13] hover:to-[#D54E03] transition-all shadow-lg shadow-orange-500/25 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <FileText className="w-4 h-4" />
                  )}
                  Guardar y abrir PDF
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
