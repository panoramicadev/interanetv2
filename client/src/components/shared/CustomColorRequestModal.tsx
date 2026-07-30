/**
 * CustomColorRequestModal — Animated multi-step modal for requesting custom color quotes.
 * Works independently from QuoteContext / Cart. Submits directly to /api/b2c/quote-request.
 * Used from both tienda and cotizador pages.
 */

import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Palette,
  Search,
  Check,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  AlertTriangle,
  Send,
  Loader2,
  CheckCircle2,
  Package,
  Info,
  Droplet,
  Pipette,
  User,
  Mail,
  Phone,
  Building,
  MapPin,
  Layers,
} from 'lucide-react';
import { SEGMENTOS_COTIZACION_WEB } from '@shared/segmentos-cotizacion-web';

interface Props {
  open: boolean;
  onClose: () => void;
}

interface CatalogVariant {
  sku: string;
  format: string;
  minUnit?: number;
  stepSize?: number;
}

interface CatalogProduct {
  genericName: string;
  groupName?: string | null;
  imageUrl?: string | null;
  colors: Record<string, CatalogVariant[]>;
}

const MIN_TINETAS = 5;
const MIN_GALONES = 20;

// Sólo se cotiza color personalizado en Galón o Tineta (balde). Excluye 1/4 galón, litros, etc.
const isEligibleFormat = (f: string) => {
  const u = f.toLowerCase();
  if (u.includes('1/4') || u.includes('1/8') || u.includes('1/2')) return false;
  return u.includes('galon') || u.includes('galón') || u.includes('balde') || u.includes('tineta');
};
const isTineta = (f: string) => /balde|tineta/i.test(f);
const minQtyFor = (f: string) => (isTineta(f) ? MIN_TINETAS : MIN_GALONES);
const unitLabelFor = (f: string) => (isTineta(f) ? 'tinetas' : 'galones');

const COLOR_BRANDS = [
  { id: 'panoramica', label: 'Panorámica', hint: 'Código interno Panorámica' },
  { id: 'pantone', label: 'Pantone', hint: 'Ej. 18-1663 TCX' },
  { id: 'ral', label: 'RAL', hint: 'Ej. RAL 3020' },
  { id: 'ncs', label: 'NCS', hint: 'Ej. NCS S 1080-Y70R' },
  { id: 'sherwin', label: 'Sherwin Williams', hint: 'Código SW' },
  { id: 'benjamin', label: 'Benjamin Moore', hint: 'Código BM' },
  { id: 'otro', label: 'Otra marca', hint: 'Especifica en notas' },
];

// Quick color swatches as inspiration / shortcut
const QUICK_SWATCHES = [
  '#E63946', '#F4A261', '#E9C46A', '#2A9D8F', '#264653',
  '#1D3557', '#457B9D', '#A8DADC', '#FF6E23', '#6A4C93',
  '#22223B', '#4A4E69', '#9A8C98', '#C9ADA7', '#F2E9E4',
  '#000000', '#FFFFFF', '#8D99AE', '#EF233C', '#D90429',
];

type Step = 'intro' | 'product' | 'color' | 'contact' | 'success';

export default function CustomColorRequestModal({ open, onClose }: Props) {
  const [step, setStep] = useState<Step>('intro');
  const [search, setSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<CatalogProduct | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<string>('');

  // Color state
  const [brand, setBrand] = useState(COLOR_BRANDS[0].id);
  const [colorCode, setColorCode] = useState('');
  const [colorHex, setColorHex] = useState('#FF6E23');
  const [colorNotes, setColorNotes] = useState('');

  // Contact state
  const [form, setForm] = useState({
    visitorName: '',
    visitorEmail: '',
    visitorPhone: '',
    visitorCompany: '',
    visitorCity: '',
    // Rutea la solicitud al CRM del área correspondiente
    segmento: '',
    quantity: String(MIN_TINETAS),
    message: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset when closed
  useEffect(() => {
    if (!open) {
      const t = setTimeout(() => {
        setStep('intro');
        setSearch('');
        setSelectedProduct(null);
        setSelectedFormat('');
        setBrand(COLOR_BRANDS[0].id);
        setColorCode('');
        setColorHex('#FF6E23');
        setColorNotes('');
        setForm({
          visitorName: '',
          visitorEmail: '',
          visitorPhone: '',
          visitorCompany: '',
          visitorCity: '',
          segmento: '',
          quantity: String(MIN_TINETAS),
          message: '',
        });
        setErrors({});
      }, 350);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Lock body scroll
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [open]);

  // Fetch catalog
  const { data: catalogData, isLoading: catalogLoading } = useQuery({
    queryKey: ['/api/b2c/catalog', 'custom-color-modal'],
    queryFn: async () => {
      const res = await fetch('/api/b2c/catalog');
      return res.json();
    },
    enabled: open && step === 'product',
    staleTime: 5 * 60 * 1000,
  });

  const products: CatalogProduct[] = catalogData?.catalog || [];

  const filteredProducts = useMemo(() => {
    if (!search) return products;
    const q = search.toLowerCase();
    return products.filter(
      p =>
        p.genericName.toLowerCase().includes(q) ||
        (p.groupName || '').toLowerCase().includes(q)
    );
  }, [products, search]);

  // All formats available across colors for the selected product
  const availableFormats = useMemo(() => {
    if (!selectedProduct) return [];
    const formats = new Set<string>();
    Object.values(selectedProduct.colors).forEach(variants => {
      variants.forEach(v => {
        if (isEligibleFormat(v.format)) formats.add(v.format);
      });
    });
    return Array.from(formats);
  }, [selectedProduct]);

  // Auto-select first format when a product is chosen
  useEffect(() => {
    if (selectedProduct && !selectedFormat && availableFormats.length > 0) {
      setSelectedFormat(availableFormats[0]);
    }
  }, [selectedProduct, selectedFormat, availableFormats]);

  // Ajusta la cantidad mínima automáticamente según el formato elegido
  useEffect(() => {
    if (!selectedFormat) return;
    const min = minQtyFor(selectedFormat);
    setForm(p => {
      const current = Number(p.quantity);
      if (!current || current < min) return { ...p, quantity: String(min) };
      return p;
    });
  }, [selectedFormat]);

  const goNext = () => {
    const order: Step[] = ['intro', 'product', 'color', 'contact'];
    const idx = order.indexOf(step);
    if (idx >= 0 && idx < order.length - 1) setStep(order[idx + 1]);
  };

  const goBack = () => {
    const order: Step[] = ['intro', 'product', 'color', 'contact'];
    const idx = order.indexOf(step);
    if (idx > 0) setStep(order[idx - 1]);
  };

  const canGoNext = (): boolean => {
    if (step === 'intro') return true;
    if (step === 'product') return !!selectedProduct && !!selectedFormat;
    if (step === 'color') return !!colorCode.trim();
    return false;
  };

  const validateContact = () => {
    const e: Record<string, string> = {};
    if (!form.visitorName.trim()) e.visitorName = 'Nombre es requerido';
    if (!form.visitorEmail.trim()) e.visitorEmail = 'Email es requerido';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.visitorEmail))
      e.visitorEmail = 'Email inválido';
    if (!form.segmento) e.segmento = 'Selecciona tu segmento';
    const qty = Number(form.quantity);
    const min = minQtyFor(selectedFormat);
    const unit = unitLabelFor(selectedFormat);
    if (!qty || qty < min) e.quantity = `Mínimo ${min} ${unit}`;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateContact() || !selectedProduct) return;
    setIsSubmitting(true);
    setErrors({});

    try {
      const brandLabel =
        COLOR_BRANDS.find(b => b.id === brand)?.label || brand;
      const colorDescriptor = `${brandLabel}: ${colorCode.trim()}`;

      const payload = {
        visitorName: form.visitorName.trim(),
        visitorEmail: form.visitorEmail.trim(),
        visitorPhone: form.visitorPhone.trim() || null,
        visitorCompany: form.visitorCompany.trim() || null,
        visitorCity: form.visitorCity.trim() || null,
        segmento: form.segmento || undefined,
        message: [
          `COTIZACIÓN COLOR PERSONALIZADO`,
          `Producto: ${selectedProduct.genericName}`,
          `Formato: ${selectedFormat}`,
          `Marca de color: ${brandLabel}`,
          `Código: ${colorCode.trim()}`,
          colorHex ? `Hex aproximado: ${colorHex.toUpperCase()}` : null,
          colorNotes ? `Notas color: ${colorNotes.trim()}` : null,
          form.message ? `Mensaje adicional: ${form.message.trim()}` : null,
        ]
          .filter(Boolean)
          .join('\n'),
        items: [
          {
            sku: `CUSTOM-${selectedProduct.genericName
              .replace(/[^A-Z0-9]/gi, '')
              .toUpperCase()
              .slice(0, 20)}`,
            productName: selectedProduct.genericName,
            color: colorDescriptor,
            format: selectedFormat,
            quantity: Number(form.quantity),
            imageUrl: selectedProduct.imageUrl || undefined,
            itemType: 'custom_color' as const,
            customColorCode: colorCode.trim(),
            customColorBrand: brandLabel,
            customColorHex: colorHex.toUpperCase(),
            customColorNotes: colorNotes.trim() || undefined,
          },
        ],
      };

      const res = await fetch('/api/b2c/quote-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('request failed');

      setStep('success');
    } catch (err) {
      setErrors({ submit: 'Error al enviar. Intenta nuevamente.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!open) return null;

  const stepIndex = ['intro', 'product', 'color', 'contact'].indexOf(step);
  const totalSteps = 4;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[70] overflow-y-auto overscroll-contain"
          onClick={onClose}
        >
          {/* Blur backdrop */}
          <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md pointer-events-none" />

          {/* Animated color orbs */}
          <motion.div
            className="pointer-events-none fixed top-10 left-10 w-72 h-72 rounded-full blur-3xl opacity-40"
            style={{ background: colorHex }}
            animate={{ scale: [1, 1.15, 1], opacity: [0.35, 0.5, 0.35] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="pointer-events-none fixed bottom-10 right-10 w-80 h-80 rounded-full blur-3xl opacity-30 bg-[#FF6E23]"
            animate={{ scale: [1.1, 1, 1.1], opacity: [0.25, 0.45, 0.25] }}
            transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
          />

          <div className="relative min-h-full flex items-center justify-center p-2 sm:p-4 pointer-events-none">
          <motion.div
            key="modal"
            initial={{ opacity: 0, y: 30, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 280, damping: 28 }}
            className="relative bg-white rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-2xl max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-2rem)] overflow-hidden flex flex-col pointer-events-auto"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-5 sm:px-7 pt-5 pb-4 text-white shrink-0">
              <motion.div
                className="absolute inset-0 opacity-30"
                animate={{
                  background: [
                    `radial-gradient(circle at 0% 0%, ${colorHex}66 0%, transparent 50%)`,
                    `radial-gradient(circle at 100% 100%, ${colorHex}66 0%, transparent 50%)`,
                    `radial-gradient(circle at 0% 0%, ${colorHex}66 0%, transparent 50%)`,
                  ],
                }}
                transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
              />

              <button
                onClick={onClose}
                className="absolute top-3 right-3 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white/80 hover:text-white z-10"
                aria-label="Cerrar"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="relative flex items-center gap-3 mb-3">
                <motion.div
                  animate={{ rotate: [0, 12, -8, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                  className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-[#FF6E23] to-[#E55E13] flex items-center justify-center shadow-lg"
                >
                  <Palette className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </motion.div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold leading-tight">
                    Cotizar Color Personalizado
                  </h2>
                  <p className="text-[11px] sm:text-xs text-slate-300">
                    Creamos tu tono exacto a pedido
                  </p>
                </div>
              </div>

              {/* Step indicator */}
              {step !== 'success' && (
                <div className="relative flex items-center gap-1.5 sm:gap-2">
                  {Array.from({ length: totalSteps }).map((_, i) => (
                    <div key={i} className="flex-1 h-1 rounded-full bg-white/15 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{
                          width: i < stepIndex ? '100%' : i === stepIndex ? '100%' : '0%',
                        }}
                        transition={{ duration: 0.4, ease: 'easeOut' }}
                        className="h-full bg-gradient-to-r from-[#FF6E23] to-[#FFB347]"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Body */}
            <div className="flex-1 min-h-0 overflow-y-auto">
              <AnimatePresence mode="wait">
                {step === 'intro' && (
                  <motion.div
                    key="intro"
                    initial={{ opacity: 0, x: 40 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -40 }}
                    transition={{ duration: 0.3 }}
                    className="px-5 sm:px-7 py-6 sm:py-8"
                  >
                    <div className="text-center mb-6">
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', delay: 0.1, stiffness: 260 }}
                        className="inline-flex w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100 items-center justify-center mb-3"
                      >
                        <Sparkles className="w-8 h-8 text-[#FF6E23]" />
                      </motion.div>
                      <h3 className="text-xl sm:text-2xl font-bold text-slate-800 mb-1.5">
                        ¿Buscas un color único?
                      </h3>
                      <p className="text-sm text-slate-500 max-w-md mx-auto">
                        Fabricamos tu color a medida, partiendo desde un código Panorámica o de cualquier otra marca.
                      </p>
                    </div>

                    {/* Minimum alert */}
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                      className="relative overflow-hidden rounded-xl p-4 bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 mb-4"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                          <AlertTriangle className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-amber-900 mb-0.5">
                            Sólo en Galón o Tineta (balde)
                          </p>
                          <p className="text-xs text-amber-800/80">
                            Los colores personalizados se fabrican únicamente en formato{' '}
                            <strong>Galón</strong> o <strong>Tineta</strong>, con un pedido mínimo
                            de <strong>{MIN_TINETAS} tinetas</strong> o{' '}
                            <strong>{MIN_GALONES} galones</strong> del producto seleccionado.
                          </p>
                        </div>
                      </div>
                    </motion.div>

                    {/* Feature pills */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
                      {[
                        { icon: Droplet, text: 'Cualquier código' },
                        { icon: Palette, text: 'Panorámica u otra marca' },
                        { icon: Package, text: 'Respuesta en 24h' },
                      ].map(({ icon: Icon, text }, i) => (
                        <motion.div
                          key={text}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.3 + i * 0.08 }}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200"
                        >
                          <Icon className="w-4 h-4 text-[#FF6E23] shrink-0" />
                          <span className="text-xs font-medium text-slate-700">{text}</span>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {step === 'product' && (
                  <motion.div
                    key="product"
                    initial={{ opacity: 0, x: 40 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -40 }}
                    transition={{ duration: 0.3 }}
                    className="px-5 sm:px-7 py-5"
                  >
                    <div className="mb-4">
                      <h3 className="text-lg font-bold text-slate-800 mb-1">
                        Elige el producto
                      </h3>
                      <p className="text-xs text-slate-500">
                        Selecciona sobre qué producto Panorámica quieres el color personalizado.
                      </p>
                    </div>

                    {/* Search */}
                    <div className="relative mb-3">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Buscar por nombre de producto..."
                        className="w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-300 transition-all"
                      />
                    </div>

                    {/* Product list */}
                    <div className="max-h-64 overflow-y-auto pr-1 -mr-1 space-y-1.5">
                      {catalogLoading ? (
                        <div className="flex items-center justify-center py-10 text-slate-400">
                          <Loader2 className="w-6 h-6 animate-spin" />
                        </div>
                      ) : filteredProducts.length === 0 ? (
                        <div className="text-center py-10 text-slate-400 text-sm">
                          No se encontraron productos
                        </div>
                      ) : (
                        filteredProducts.map((p, idx) => {
                          const selected =
                            selectedProduct?.genericName === p.genericName;
                          return (
                            <motion.button
                              key={p.genericName}
                              initial={{ opacity: 0, y: 6 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: Math.min(idx * 0.02, 0.3) }}
                              onClick={() => {
                                setSelectedProduct(p);
                                setSelectedFormat('');
                              }}
                              className={`w-full flex items-center gap-3 p-2.5 rounded-xl border text-left transition-all ${
                                selected
                                  ? 'border-orange-400 bg-orange-50 shadow-sm'
                                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                              }`}
                            >
                              <div className="w-10 h-10 rounded-lg bg-slate-100 overflow-hidden shrink-0 flex items-center justify-center">
                                {p.imageUrl ? (
                                  <img
                                    src={p.imageUrl}
                                    alt={p.genericName}
                                    className="w-full h-full object-cover"
                                    loading="lazy"
                                  />
                                ) : (
                                  <Package className="w-5 h-5 text-slate-300" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-slate-800 truncate">
                                  {p.genericName}
                                </p>
                                {p.groupName && (
                                  <p className="text-[11px] text-slate-400 truncate">
                                    {p.groupName}
                                  </p>
                                )}
                              </div>
                              {selected && (
                                <motion.div
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  className="w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center shrink-0"
                                >
                                  <Check className="w-3.5 h-3.5 text-white" />
                                </motion.div>
                              )}
                            </motion.button>
                          );
                        })
                      )}
                    </div>

                    {/* Format selector */}
                    {selectedProduct && availableFormats.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-4 pt-4 border-t border-slate-100"
                      >
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                          <Package className="w-3 h-3" /> Formato
                        </label>
                        <div className="flex flex-wrap gap-1.5">
                          {availableFormats.map(f => (
                            <button
                              key={f}
                              onClick={() => setSelectedFormat(f)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                selectedFormat === f
                                  ? 'bg-slate-900 text-white shadow-sm'
                                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                              }`}
                            >
                              {f}
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </motion.div>
                )}

                {step === 'color' && (
                  <motion.div
                    key="color"
                    initial={{ opacity: 0, x: 40 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -40 }}
                    transition={{ duration: 0.3 }}
                    className="px-5 sm:px-7 py-5"
                  >
                    <div className="mb-4">
                      <h3 className="text-lg font-bold text-slate-800 mb-1">
                        Define tu color
                      </h3>
                      <p className="text-xs text-slate-500">
                        Indica el código y la marca. Puedes además elegir un color aproximado para referencia.
                      </p>
                    </div>

                    {/* Brand pills */}
                    <div className="mb-4">
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">
                        Marca / Sistema de color
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                        {COLOR_BRANDS.map(b => (
                          <button
                            key={b.id}
                            onClick={() => setBrand(b.id)}
                            className={`px-2.5 py-2 rounded-lg text-[11px] font-semibold transition-all text-center ${
                              brand === b.id
                                ? 'bg-gradient-to-br from-[#FF6E23] to-[#E55E13] text-white shadow-md'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            {b.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Code input */}
                    <div className="mb-4">
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                        <Pipette className="w-3 h-3" /> Código del color
                      </label>
                      <input
                        type="text"
                        value={colorCode}
                        onChange={e => setColorCode(e.target.value)}
                        placeholder={
                          COLOR_BRANDS.find(b => b.id === brand)?.hint ||
                          'Ingresa el código'
                        }
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-300 transition-all"
                      />
                      <p className="text-[11px] text-slate-400 mt-1.5">
                        {COLOR_BRANDS.find(b => b.id === brand)?.hint}
                      </p>
                    </div>

                    {/* Color picker + preview */}
                    <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 mb-4">
                      {/* Big preview */}
                      <motion.div
                        key={colorHex}
                        initial={{ scale: 0.95 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 250, damping: 25 }}
                        className="sm:col-span-2 relative rounded-xl overflow-hidden border border-slate-200 shadow-inner aspect-[4/3] sm:aspect-auto"
                        style={{ background: colorHex }}
                      >
                        <div className="absolute bottom-2 left-2 right-2 bg-white/85 backdrop-blur rounded-lg px-2 py-1 text-center">
                          <span className="text-[10px] font-mono font-semibold text-slate-700 tracking-wider">
                            {colorHex.toUpperCase()}
                          </span>
                        </div>
                      </motion.div>

                      {/* Hex input + native picker + notes */}
                      <div className="sm:col-span-3 space-y-2.5">
                        <div>
                          <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1 block">
                            Color aproximado (opcional)
                          </label>
                          <div className="flex items-center gap-2">
                            <div className="relative">
                              <input
                                type="color"
                                value={colorHex}
                                onChange={e => setColorHex(e.target.value)}
                                className="w-10 h-10 rounded-lg border border-slate-200 cursor-pointer bg-white"
                                style={{
                                  padding: 0,
                                  WebkitAppearance: 'none',
                                }}
                                aria-label="Elegir color"
                              />
                            </div>
                            <input
                              type="text"
                              value={colorHex}
                              onChange={e => {
                                const v = e.target.value;
                                if (/^#[0-9A-Fa-f]{0,6}$/.test(v) || v === '') setColorHex(v);
                              }}
                              placeholder="#FF6E23"
                              className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-300 uppercase"
                              maxLength={7}
                            />
                          </div>
                        </div>

                        {/* Quick swatches */}
                        <div>
                          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                            Sugerencias
                          </p>
                          <div className="grid grid-cols-10 gap-1">
                            {QUICK_SWATCHES.map(hex => (
                              <button
                                key={hex}
                                onClick={() => setColorHex(hex)}
                                className={`aspect-square rounded-md border transition-all ${
                                  colorHex.toUpperCase() === hex.toUpperCase()
                                    ? 'border-slate-800 scale-110 shadow-md'
                                    : 'border-slate-200 hover:scale-105'
                                }`}
                                style={{ background: hex }}
                                aria-label={`Color ${hex}`}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Notes */}
                    <div>
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">
                        Notas sobre el color (opcional)
                      </label>
                      <textarea
                        value={colorNotes}
                        onChange={e => setColorNotes(e.target.value)}
                        rows={2}
                        placeholder="Ej. acabado mate, referencia visual, marca específica, etc."
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-300 resize-none"
                      />
                    </div>
                  </motion.div>
                )}

                {step === 'contact' && (
                  <motion.div
                    key="contact"
                    initial={{ opacity: 0, x: 40 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -40 }}
                    transition={{ duration: 0.3 }}
                    className="px-5 sm:px-7 py-5"
                  >
                    <div className="mb-4">
                      <h3 className="text-lg font-bold text-slate-800 mb-1">
                        Tus datos
                      </h3>
                      <p className="text-xs text-slate-500">
                        Recibirás la cotización detallada en tu email.
                      </p>
                    </div>

                    {/* Recap card */}
                    {selectedProduct && (
                      <motion.div
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mb-4 p-3 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200"
                      >
                        <div className="flex items-start gap-3">
                          <motion.div
                            className="w-12 h-12 rounded-lg shadow-inner shrink-0 border border-slate-200"
                            style={{ background: colorHex }}
                            animate={{ scale: [1, 1.04, 1] }}
                            transition={{
                              duration: 2.5,
                              repeat: Infinity,
                              ease: 'easeInOut',
                            }}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                              Tu solicitud
                            </p>
                            <p className="text-sm font-bold text-slate-800 truncate">
                              {selectedProduct.genericName}
                              <span className="text-slate-400 font-medium">
                                {' '}· {selectedFormat}
                              </span>
                            </p>
                            <p className="text-xs text-slate-600 font-mono">
                              {COLOR_BRANDS.find(b => b.id === brand)?.label}:{' '}
                              {colorCode}
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Name */}
                      <div className="sm:col-span-2">
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                          <User className="w-3 h-3" /> Nombre *
                        </label>
                        <input
                          type="text"
                          value={form.visitorName}
                          onChange={e => {
                            setForm(p => ({ ...p, visitorName: e.target.value }));
                            if (errors.visitorName)
                              setErrors(p => ({ ...p, visitorName: '' }));
                          }}
                          className={`w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30 transition-all ${
                            errors.visitorName
                              ? 'border-red-300 bg-red-50'
                              : 'border-slate-200'
                          }`}
                          placeholder="Tu nombre completo"
                        />
                        {errors.visitorName && (
                          <p className="text-xs text-red-500 mt-1">
                            {errors.visitorName}
                          </p>
                        )}
                      </div>

                      {/* Email */}
                      <div>
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                          <Mail className="w-3 h-3" /> Email *
                        </label>
                        <input
                          type="email"
                          value={form.visitorEmail}
                          onChange={e => {
                            setForm(p => ({ ...p, visitorEmail: e.target.value }));
                            if (errors.visitorEmail)
                              setErrors(p => ({ ...p, visitorEmail: '' }));
                          }}
                          className={`w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30 transition-all ${
                            errors.visitorEmail
                              ? 'border-red-300 bg-red-50'
                              : 'border-slate-200'
                          }`}
                          placeholder="correo@empresa.cl"
                        />
                        {errors.visitorEmail && (
                          <p className="text-xs text-red-500 mt-1">
                            {errors.visitorEmail}
                          </p>
                        )}
                      </div>

                      {/* Phone */}
                      <div>
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                          <Phone className="w-3 h-3" /> Teléfono
                        </label>
                        <input
                          type="tel"
                          value={form.visitorPhone}
                          onChange={e =>
                            setForm(p => ({ ...p, visitorPhone: e.target.value }))
                          }
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
                          onChange={e =>
                            setForm(p => ({ ...p, visitorCompany: e.target.value }))
                          }
                          className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30 transition-all"
                          placeholder="Empresa (opcional)"
                        />
                      </div>

                      {/* Segmento — rutea la solicitud al CRM del área */}
                      <div>
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                          <Layers className="w-3 h-3" /> Segmento *
                        </label>
                        <select
                          value={form.segmento}
                          onChange={e => {
                            setForm(p => ({ ...p, segmento: e.target.value }));
                            if (errors.segmento) setErrors(p => ({ ...p, segmento: '' }));
                          }}
                          className={`w-full px-3 py-2.5 border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/30 transition-all ${
                            errors.segmento ? 'border-red-300 bg-red-50' : 'border-slate-200'
                          } ${form.segmento ? 'text-slate-800' : 'text-slate-400'}`}
                          data-testid="select-segmento-color"
                        >
                          <option value="">Selecciona tu segmento</option>
                          {SEGMENTOS_COTIZACION_WEB.map(s => (
                            <option key={s.value} value={s.value}>{s.label}</option>
                          ))}
                        </select>
                        {errors.segmento && (
                          <p className="text-xs text-red-500 mt-1">{errors.segmento}</p>
                        )}
                      </div>

                      {/* City */}
                      <div>
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> Ciudad
                        </label>
                        <input
                          type="text"
                          value={form.visitorCity}
                          onChange={e =>
                            setForm(p => ({ ...p, visitorCity: e.target.value }))
                          }
                          className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30 transition-all"
                          placeholder="Tu ciudad"
                        />
                      </div>

                      {/* Quantity */}
                      <div>
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                          <Package className="w-3 h-3" /> Cantidad {unitLabelFor(selectedFormat)} *
                        </label>
                        <input
                          type="number"
                          min={minQtyFor(selectedFormat)}
                          step={1}
                          value={form.quantity}
                          onChange={e => {
                            setForm(p => ({ ...p, quantity: e.target.value }));
                            if (errors.quantity)
                              setErrors(p => ({ ...p, quantity: '' }));
                          }}
                          className={`w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30 transition-all ${
                            errors.quantity
                              ? 'border-red-300 bg-red-50'
                              : 'border-slate-200'
                          }`}
                        />
                        {errors.quantity ? (
                          <p className="text-xs text-red-500 mt-1">
                            {errors.quantity}
                          </p>
                        ) : (
                          <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                            <Info className="w-3 h-3" /> Mínimo{' '}
                            {minQtyFor(selectedFormat)} {unitLabelFor(selectedFormat)}
                          </p>
                        )}
                      </div>

                      {/* Message */}
                      <div className="sm:col-span-2">
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">
                          Mensaje adicional
                        </label>
                        <textarea
                          value={form.message}
                          onChange={e =>
                            setForm(p => ({ ...p, message: e.target.value }))
                          }
                          rows={2}
                          placeholder="¿Alguna especificación?"
                          className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30 transition-all resize-none"
                        />
                      </div>
                    </div>

                    {errors.submit && (
                      <div className="mt-3 px-3 py-2 bg-red-50 text-red-600 text-sm rounded-lg">
                        {errors.submit}
                      </div>
                    )}
                  </motion.div>
                )}

                {step === 'success' && (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 220, damping: 22 }}
                    className="px-5 sm:px-7 py-10 flex flex-col items-center text-center"
                  >
                    <motion.div
                      initial={{ scale: 0, rotate: -90 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: 'spring', stiffness: 240, delay: 0.1 }}
                      className="relative w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center mb-5 shadow-xl shadow-emerald-500/30"
                    >
                      <CheckCircle2 className="w-10 h-10 text-white" />
                      <motion.div
                        className="absolute inset-0 rounded-full border-4 border-emerald-400"
                        animate={{ scale: [1, 1.5], opacity: [0.8, 0] }}
                        transition={{ duration: 1.6, repeat: Infinity }}
                      />
                    </motion.div>

                    <h3 className="text-xl font-bold text-slate-800 mb-1.5">
                      ¡Cotización enviada!
                    </h3>
                    <p className="text-sm text-slate-500 max-w-sm mb-6">
                      Recibimos tu solicitud de color personalizado. Nuestro equipo
                      te contactará en las próximas 24 horas con el detalle.
                    </p>

                    <button
                      onClick={onClose}
                      className="px-6 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition-colors"
                    >
                      Listo
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Footer actions */}
            {step !== 'success' && (
              <div className="px-5 sm:px-7 py-3 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between gap-2 shrink-0">
                <button
                  onClick={step === 'intro' ? onClose : goBack}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors rounded-lg"
                >
                  <ArrowLeft className="w-4 h-4" />
                  {step === 'intro' ? 'Cancelar' : 'Atrás'}
                </button>

                {step === 'contact' ? (
                  <button
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#FF6E23] to-[#E55E13] text-white text-sm font-bold rounded-xl hover:from-[#E55E13] hover:to-[#D54E03] transition-all shadow-lg shadow-orange-500/25 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Enviando...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" /> Enviar cotización
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    onClick={goNext}
                    disabled={!canGoNext()}
                    className="flex items-center gap-1.5 px-5 py-2.5 bg-gradient-to-r from-[#FF6E23] to-[#E55E13] text-white text-sm font-bold rounded-xl hover:from-[#E55E13] hover:to-[#D54E03] transition-all shadow-lg shadow-orange-500/25 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
                  >
                    {step === 'intro' ? 'Comenzar' : 'Continuar'}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
          </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
