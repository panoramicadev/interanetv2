import { useState } from 'react';
import { X, Send, CheckCircle, Loader2, User, Mail, Phone, Building, MapPin, FileText, MessageSquare, Plus, Minus, Trash2, Layers } from 'lucide-react';
import { useQuote } from '@/contexts/QuoteContext';
import { SEGMENTOS_COTIZACION_WEB } from '@shared/segmentos-cotizacion-web';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function CotizadorContactForm({ open, onClose }: Props) {
  const { state, clearQuote, updateQuantity, removeItem } = useQuote();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [form, setForm] = useState({
    visitorName: '',
    visitorEmail: '',
    visitorPhone: '',
    visitorCompany: '',
    visitorCity: '',
    visitorRut: '',
    // Rutea la solicitud al CRM del área correspondiente
    segmento: '',
    message: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  if (!open) return null;

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.visitorName.trim()) e.visitorName = 'Nombre es requerido';
    if (!form.visitorEmail.trim()) e.visitorEmail = 'Email es requerido';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.visitorEmail)) e.visitorEmail = 'Email inválido';
    if (!form.segmento) e.segmento = 'Selecciona tu segmento';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setIsSubmitting(true);

    try {
      const payload = {
        ...form,
        items: state.items.map(item => ({
          sku: item.sku,
          productName: item.productName,
          color: item.color,
          format: item.format,
          quantity: item.quantity,
          imageUrl: item.imageUrl,
        })),
      };

      const res = await fetch('/api/b2c/quote-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('Error al enviar');

      setSubmitted(true);
      setTimeout(() => {
        clearQuote();
        onClose();
        setSubmitted(false);
        setForm({ visitorName: '', visitorEmail: '', visitorPhone: '', visitorCompany: '', visitorCity: '', visitorRut: '', segmento: '', message: '' });
      }, 3000);
    } catch (err) {
      setErrors({ submit: 'Error al enviar la solicitud. Intenta nuevamente.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
  };

  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      <div
        className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-4 right-4 z-10 p-2 rounded-full bg-slate-100 hover:bg-slate-200 transition-colors">
          <X className="w-4 h-4 text-slate-500" />
        </button>

        {submitted ? (
          /* Success state */
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mb-5 animate-in zoom-in duration-300">
              <CheckCircle className="w-10 h-10 text-emerald-500" />
            </div>
            <h3 className="text-2xl font-bold text-slate-800 mb-2">¡Solicitud Enviada!</h3>
            <p className="text-slate-500 max-w-sm">
              Hemos recibido tu cotización con {state.itemCount} productos. Nuestro equipo comercial te contactará pronto.
            </p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="px-6 pt-6 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2 mb-1">
                <FileText className="w-5 h-5 text-orange-500" />
                <h2 className="text-lg font-bold text-slate-800">Solicitar Cotización</h2>
              </div>
              <p className="text-sm text-slate-400">
                Completa tus datos y recibirás una cotización detallada en tu email
              </p>
            </div>

            {/* Summary */}
            <div className="px-6 py-3 bg-orange-50/50 border-b border-orange-100">
              <p className="text-xs font-semibold text-orange-600 uppercase tracking-widest mb-2">Resumen de productos</p>
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {state.items.map(item => {
                  const step = item.stepSize || 1;
                  const minUnit = item.minUnit || step;
                  const dec = () => {
                    const next = item.quantity - step;
                    if (next < minUnit) {
                      removeItem(item.id);
                    } else {
                      updateQuantity(item.id, next);
                    }
                  };
                  const inc = () => updateQuantity(item.id, item.quantity + step);
                  return (
                    <div key={item.id} className="flex items-center justify-between gap-2 text-sm">
                      <span className="text-slate-600 truncate pr-2 flex-1 min-w-0">
                        {item.productName} {item.color && item.color !== 'Sin Color' ? `- ${item.color}` : ''} ({item.format})
                      </span>
                      <div className="flex items-center gap-1 bg-white border border-orange-200 rounded-lg px-1 py-0.5 shrink-0">
                        <button
                          type="button"
                          onClick={dec}
                          className="p-1 rounded-md text-orange-600 hover:bg-orange-50 active:scale-95 transition"
                          aria-label="Disminuir cantidad"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-slate-800 font-semibold text-sm min-w-[1.75rem] text-center">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={inc}
                          className="p-1 rounded-md text-orange-600 hover:bg-orange-50 active:scale-95 transition"
                          aria-label="Aumentar cantidad"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        className="p-1.5 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 transition shrink-0"
                        aria-label="Eliminar producto"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
                {state.items.length === 0 && (
                  <p className="text-sm text-slate-400 italic">No hay productos en la cotización</p>
                )}
              </div>
            </div>

            {/* Form */}
            <div className="p-6 space-y-4">
              {/* Segmento — define a qué equipo comercial llega la solicitud */}
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Layers className="w-3 h-3" /> Segmento *
                </label>
                <select
                  value={form.segmento}
                  onChange={e => handleChange('segmento', e.target.value)}
                  className={`w-full px-3 py-2.5 border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/30 transition-all ${
                    errors.segmento ? 'border-red-300 bg-red-50' : 'border-slate-200'
                  } ${form.segmento ? 'text-slate-800' : 'text-slate-400'}`}
                  data-testid="select-segmento-cotizacion"
                >
                  <option value="">Selecciona tu segmento</option>
                  {SEGMENTOS_COTIZACION_WEB.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
                {errors.segmento
                  ? <p className="text-xs text-red-500 mt-1">{errors.segmento}</p>
                  : <p className="text-[11px] text-slate-400 mt-1">Nos permite derivarte al equipo comercial de tu rubro.</p>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Name */}
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <User className="w-3 h-3" /> Nombre *
                  </label>
                  <input
                    type="text"
                    value={form.visitorName}
                    onChange={e => handleChange('visitorName', e.target.value)}
                    className={`w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30 transition-all ${
                      errors.visitorName ? 'border-red-300 bg-red-50' : 'border-slate-200'
                    }`}
                    placeholder="Tu nombre completo"
                  />
                  {errors.visitorName && <p className="text-xs text-red-500 mt-1">{errors.visitorName}</p>}
                </div>

                {/* Email */}
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <Mail className="w-3 h-3" /> Email *
                  </label>
                  <input
                    type="email"
                    value={form.visitorEmail}
                    onChange={e => handleChange('visitorEmail', e.target.value)}
                    className={`w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30 transition-all ${
                      errors.visitorEmail ? 'border-red-300 bg-red-50' : 'border-slate-200'
                    }`}
                    placeholder="correo@empresa.cl"
                  />
                  {errors.visitorEmail && <p className="text-xs text-red-500 mt-1">{errors.visitorEmail}</p>}
                </div>

                {/* Phone */}
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <Phone className="w-3 h-3" /> Teléfono
                  </label>
                  <input
                    type="tel"
                    value={form.visitorPhone}
                    onChange={e => handleChange('visitorPhone', e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30 transition-all"
                    placeholder="+56 9 1234 5678"
                  />
                </div>

                {/* Company */}
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <Building className="w-3 h-3" /> Empresa
                  </label>
                  <input
                    type="text"
                    value={form.visitorCompany}
                    onChange={e => handleChange('visitorCompany', e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30 transition-all"
                    placeholder="Nombre de empresa (opcional)"
                  />
                </div>

                {/* City */}
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> Ciudad
                  </label>
                  <input
                    type="text"
                    value={form.visitorCity}
                    onChange={e => handleChange('visitorCity', e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30 transition-all"
                    placeholder="Tu ciudad"
                  />
                </div>

                {/* RUT */}
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    RUT
                  </label>
                  <input
                    type="text"
                    value={form.visitorRut}
                    onChange={e => handleChange('visitorRut', e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30 transition-all"
                    placeholder="12.345.678-9 (opcional)"
                  />
                </div>
              </div>

              {/* Message */}
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <MessageSquare className="w-3 h-3" /> Mensaje adicional
                </label>
                <textarea
                  value={form.message}
                  onChange={e => handleChange('message', e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30 transition-all resize-none"
                  placeholder="¿Alguna especificación o pregunta adicional?"
                />
              </div>

              {errors.submit && (
                <div className="px-3 py-2 bg-red-50 text-red-600 text-sm rounded-lg">{errors.submit}</div>
              )}

              {/* Submit */}
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || state.items.length === 0}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold rounded-xl hover:from-orange-600 hover:to-orange-700 transition-all shadow-lg active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> Enviando...</>
                ) : (
                  <><Send className="w-5 h-5" /> Enviar Solicitud de Cotización</>
                )}
              </button>

              <p className="text-center text-[11px] text-slate-400">
                Al enviar, acepta que nos comuniquemos con usted para proporcionarle la cotización solicitada.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
