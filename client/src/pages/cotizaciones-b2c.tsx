/**
 * CotizacionesB2C — Admin panel for managing B2C quote requests
 * Shows all quotation requests submitted from the public /cotizador
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileText, User, Mail, Phone, Building, MapPin, Calendar, Eye, ChevronDown, ChevronUp, Package, Clock, CheckCircle, MessageSquare, Filter, Search, RefreshCw, DollarSign, Palette, Printer, Trash2, StickyNote, Save, Layers } from 'lucide-react';
import { Link } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import QuoteRequestPricingModal from '@/components/b2c-admin/QuoteRequestPricingModal';
import { ETIQUETA_COTIZACION_WEB, segmentoCotizacionWebLabel } from '@shared/segmentos-cotizacion-web';

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
  visitorPhone?: string;
  visitorCompany?: string;
  visitorCity?: string;
  visitorRut?: string;
  segmento?: string;
  crmSeguimientoId?: string;
  message?: string;
  items: QuoteRequestItem[];
  itemCount: number;
  status: string;
  source: string;
  internalNotes?: string;
  quoteNumber?: string;
  subtotal?: string | number;
  taxAmount?: string | number;
  totalAmount?: string | number;
  pricedAt?: string;
  validUntilDate?: string;
  createdAt: string;
  updatedAt: string;
}

const fmtCLP = (n: number | string | undefined): string => {
  const num = typeof n === 'string' ? parseFloat(n) : (n || 0);
  return `$${Math.round(num || 0).toLocaleString('es-CL').replace(/,/g, '.')}`;
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  pending: { label: 'Pendiente', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', icon: Clock },
  contacted: { label: 'Contactado', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', icon: Phone },
  quoted: { label: 'Cotizado', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', icon: CheckCircle },
  sale: { label: 'Venta', color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200', icon: DollarSign },
  closed: { label: 'Cerrado', color: 'text-gray-700', bg: 'bg-gray-50 border-gray-200', icon: CheckCircle },
};

export default function CotizacionesB2CPage() {
  return <SolicitudesWebPanel />;
}

/**
 * SolicitudesWebPanel — reusable list of B2C quote requests (solicitudes web).
 * Rendered standalone in /cotizaciones-b2c and embedded as the "Solicitudes" tab in Pedidos.
 * Pass `embedded` to drop the standalone page header/padding.
 */
export function SolicitudesWebPanel({ embedded = false }: { embedded?: boolean }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [pricingRequest, setPricingRequest] = useState<QuoteRequest | null>(null);
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['/api/b2c/quote-requests'],
    queryFn: async () => {
      const res = await fetch('/api/b2c/quote-requests', { credentials: 'include' });
      if (!res.ok) throw new Error('Error al cargar solicitudes');
      return res.json();
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, internalNotes }: { id: string; status?: string; internalNotes?: string }) => {
      const body: Record<string, unknown> = {};
      if (status !== undefined) body.status = status;
      if (internalNotes !== undefined) body.internalNotes = internalNotes;
      const res = await fetch(`/api/b2c/quote-requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Error al actualizar');
      return res.json();
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['/api/b2c/quote-requests'] });
      toast({
        title: vars.status !== undefined ? 'Estado actualizado' : 'Nota guardada',
        description: 'La solicitud ha sido actualizada correctamente.',
      });
    },
    onError: () => {
      toast({ title: 'Error', description: 'No se pudo actualizar la solicitud.', variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/b2c/quote-requests/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message || 'Error al eliminar');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/b2c/quote-requests'] });
      toast({ title: 'Solicitud eliminada', description: 'La cotización fue eliminada correctamente.' });
      setExpandedId(null);
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err?.message || 'No se pudo eliminar.', variant: 'destructive' });
    },
  });

  const requests: QuoteRequest[] = data?.requests || [];

  // Filter
  const filtered = requests.filter(r => {
    if (filterStatus !== 'all' && r.status !== filterStatus) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        r.visitorName.toLowerCase().includes(term) ||
        r.visitorEmail.toLowerCase().includes(term) ||
        (r.visitorCompany || '').toLowerCase().includes(term) ||
        (r.visitorCity || '').toLowerCase().includes(term) ||
        (segmentoCotizacionWebLabel(r.segmento) || '').toLowerCase().includes(term)
      );
    }
    return true;
  });

  // Stats
  const stats = {
    total: requests.length,
    pending: requests.filter(r => r.status === 'pending').length,
    contacted: requests.filter(r => r.status === 'contacted').length,
    quoted: requests.filter(r => r.status === 'quoted').length,
    sale: requests.filter(r => r.status === 'sale').length,
  };

  const formatDate = (d: string) => {
    return new Date(d).toLocaleDateString('es-CL', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  return (
    <div className={embedded ? "space-y-6" : "p-4 md:p-6 max-w-7xl mx-auto space-y-6"}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        {embedded ? (
          <div>
            <p className="text-sm text-gray-500">
              Solicitudes recibidas desde el sitio web (cotizador público <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">/cotizador</code>)
            </p>
          </div>
        ) : (
          <div>
            <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
              <FileText className="w-6 h-6 text-[#FF6E23]" />
              Solicitudes de Cotización B2C
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Solicitudes recibidas desde el cotizador público <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">/cotizador</code>
            </p>
          </div>
        )}
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total', value: stats.total, color: 'text-gray-700', bg: 'bg-white' },
          { label: 'Pendientes', value: stats.pending, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Contactados', value: stats.contacted, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Cotizados', value: stats.quoted, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Ventas', value: stats.sale, color: 'text-orange-600', bg: 'bg-orange-50' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-xl border border-gray-100 px-4 py-2.5`}>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">{s.label}</p>
            <p className={`text-2xl font-black mt-0.5 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Buscar por nombre, email, empresa..."
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6E23]/20 focus:border-[#FF6E23]/40"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          {['all', 'pending', 'contacted', 'quoted', 'sale', 'closed'].map(status => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                filterStatus === status
                  ? 'bg-[#FF6E23] text-white shadow-sm'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {status === 'all' ? 'Todos' : STATUS_CONFIG[status]?.label || status}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-3 border-[#FF6E23] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <FileText className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-600">Sin solicitudes</h3>
          <p className="text-sm text-gray-400 mt-1">No hay solicitudes de cotización {filterStatus !== 'all' && `con estado "${STATUS_CONFIG[filterStatus]?.label}"`}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(request => {
            const isExpanded = expandedId === request.id;
            const statusCfg = STATUS_CONFIG[request.status] || STATUS_CONFIG.pending;
            const StatusIcon = statusCfg.icon;

            return (
              <div
                key={request.id}
                className={`bg-white rounded-xl border overflow-hidden transition-all ${
                  isExpanded ? 'border-[#FF6E23]/30 shadow-lg' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                {/* Row */}
                <div
                  className="flex items-center gap-4 p-4 cursor-pointer hover:bg-gray-50/50 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : request.id)}
                >
                  {/* Status */}
                  <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-bold ${statusCfg.bg} ${statusCfg.color}`}>
                    <StatusIcon className="w-3.5 h-3.5" />
                    {statusCfg.label}
                  </div>

                  {/* Name + email */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-800 text-sm truncate">{request.visitorName}</span>
                      {segmentoCotizacionWebLabel(request.segmento) && (
                        <span className="shrink-0 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold uppercase tracking-wide">
                          {segmentoCotizacionWebLabel(request.segmento)}
                        </span>
                      )}
                      {request.visitorCompany && (
                        <span className="text-xs text-gray-400 hidden sm:inline">· {request.visitorCompany}</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 truncate">{request.visitorEmail}</p>
                  </div>

                  {/* Items count */}
                  <div className="flex items-center gap-1 text-xs font-semibold text-gray-500 hidden sm:flex">
                    <Package className="w-3.5 h-3.5" />
                    {request.itemCount} producto{request.itemCount !== 1 ? 's' : ''}
                  </div>

                  {/* Date */}
                  <span className="text-xs text-gray-400 hidden md:block whitespace-nowrap">
                    {formatDate(request.createdAt)}
                  </span>

                  {/* Expand */}
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t border-gray-100 bg-gray-50/30">
                    <div className="p-5 grid md:grid-cols-2 gap-6">
                      {/* Left: Contact info */}
                      <div className="space-y-3">
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Datos de Contacto</h4>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="flex items-start gap-2">
                            <User className="w-4 h-4 text-gray-400 mt-0.5" />
                            <div>
                              <p className="text-[10px] text-gray-400 uppercase">Nombre</p>
                              <p className="text-sm font-semibold text-gray-800">{request.visitorName}</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-2">
                            <Mail className="w-4 h-4 text-gray-400 mt-0.5" />
                            <div>
                              <p className="text-[10px] text-gray-400 uppercase">Email</p>
                              <a href={`mailto:${request.visitorEmail}`} className="text-sm font-semibold text-blue-600 hover:underline">{request.visitorEmail}</a>
                            </div>
                          </div>
                          {request.visitorPhone && (
                            <div className="flex items-start gap-2">
                              <Phone className="w-4 h-4 text-gray-400 mt-0.5" />
                              <div>
                                <p className="text-[10px] text-gray-400 uppercase">Teléfono</p>
                                <a href={`tel:${request.visitorPhone}`} className="text-sm font-semibold text-gray-800">{request.visitorPhone}</a>
                              </div>
                            </div>
                          )}
                          {request.visitorCompany && (
                            <div className="flex items-start gap-2">
                              <Building className="w-4 h-4 text-gray-400 mt-0.5" />
                              <div>
                                <p className="text-[10px] text-gray-400 uppercase">Empresa</p>
                                <p className="text-sm font-semibold text-gray-800">{request.visitorCompany}</p>
                              </div>
                            </div>
                          )}
                          {request.visitorCity && (
                            <div className="flex items-start gap-2">
                              <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                              <div>
                                <p className="text-[10px] text-gray-400 uppercase">Ciudad</p>
                                <p className="text-sm font-semibold text-gray-800">{request.visitorCity}</p>
                              </div>
                            </div>
                          )}
                          {request.visitorRut && (
                            <div className="flex items-start gap-2">
                              <FileText className="w-4 h-4 text-gray-400 mt-0.5" />
                              <div>
                                <p className="text-[10px] text-gray-400 uppercase">RUT</p>
                                <p className="text-sm font-semibold text-gray-800">{request.visitorRut}</p>
                              </div>
                            </div>
                          )}
                          {segmentoCotizacionWebLabel(request.segmento) && (
                            <div className="flex items-start gap-2">
                              <Layers className="w-4 h-4 text-gray-400 mt-0.5" />
                              <div>
                                <p className="text-[10px] text-gray-400 uppercase">Segmento</p>
                                <p className="text-sm font-semibold text-gray-800">{segmentoCotizacionWebLabel(request.segmento)}</p>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Lead creado automáticamente en el CRM del segmento */}
                        {request.crmSeguimientoId && (
                          <Link
                            href={`/seguimiento-clientes/${request.crmSeguimientoId}`}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#FF6E23] hover:underline"
                          >
                            <Layers className="w-3.5 h-3.5" />
                            Ver lead en el CRM · etiqueta {ETIQUETA_COTIZACION_WEB}
                          </Link>
                        )}

                        {request.message && (
                          <div className="mt-3">
                            <div className="flex items-center gap-1.5 mb-1">
                              <MessageSquare className="w-3.5 h-3.5 text-gray-400" />
                              <p className="text-[10px] text-gray-400 uppercase font-bold">Mensaje</p>
                            </div>
                            <p className="text-sm text-gray-600 bg-white rounded-lg p-3 border border-gray-100 italic">
                              "{request.message}"
                            </p>
                          </div>
                        )}

                        {/* Status change */}
                        <div className="mt-4 pt-3 border-t border-gray-200">
                          <p className="text-[10px] text-gray-400 uppercase font-bold mb-2">Cambiar Estado</p>
                          <div className="flex gap-2 flex-wrap">
                            {['pending', 'contacted', 'quoted', 'sale', 'closed'].map(status => {
                              const cfg = STATUS_CONFIG[status];
                              const isCurrent = request.status === status;
                              return (
                                <button
                                  key={status}
                                  disabled={isCurrent}
                                  onClick={() => updateStatusMutation.mutate({ id: request.id, status })}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                                    isCurrent
                                      ? `${cfg.bg} ${cfg.color} cursor-default`
                                      : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50'
                                  }`}
                                >
                                  {cfg.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Internal notes */}
                        <div className="mt-4 pt-3 border-t border-gray-200">
                          <div className="flex items-center gap-1.5 mb-2">
                            <StickyNote className="w-3.5 h-3.5 text-[#FF6E23]" />
                            <p className="text-[10px] text-gray-400 uppercase font-bold">Notas internas del cliente</p>
                          </div>
                          {(() => {
                            const draft = notesDraft[request.id];
                            const current = request.internalNotes || '';
                            const value = draft !== undefined ? draft : current;
                            const dirty = draft !== undefined && draft !== current;
                            return (
                              <>
                                <textarea
                                  value={value}
                                  onChange={e =>
                                    setNotesDraft(prev => ({ ...prev, [request.id]: e.target.value }))
                                  }
                                  placeholder="Anota llamadas, acuerdos, preferencias del cliente..."
                                  rows={3}
                                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#FF6E23]/20 focus:border-[#FF6E23]/40 resize-y"
                                />
                                <div className="flex items-center justify-between mt-1.5">
                                  <span className="text-[10px] text-gray-400">
                                    {dirty ? 'Cambios sin guardar' : 'Guardado'}
                                  </span>
                                  <button
                                    type="button"
                                    disabled={!dirty || updateStatusMutation.isPending}
                                    onClick={() =>
                                      updateStatusMutation.mutate(
                                        { id: request.id, internalNotes: value },
                                        {
                                          onSuccess: () =>
                                            setNotesDraft(prev => {
                                              const next = { ...prev };
                                              delete next[request.id];
                                              return next;
                                            }),
                                        },
                                      )
                                    }
                                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                                  >
                                    <Save className="w-3.5 h-3.5" />
                                    Guardar nota
                                  </button>
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      </div>

                      {/* Right: Products */}
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                            Productos Solicitados ({request.itemCount})
                          </h4>
                          {request.quoteNumber && (
                            <span className="text-[10px] font-mono font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                              {request.quoteNumber}
                            </span>
                          )}
                        </div>
                        <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                          {(request.items || []).map((item: QuoteRequestItem, idx: number) => {
                            const isCustom = item.itemType === 'custom_color';
                            return (
                              <div
                                key={idx}
                                className={`flex items-center gap-3 p-2.5 rounded-lg border ${
                                  isCustom
                                    ? 'bg-gradient-to-r from-fuchsia-50/60 to-pink-50/60 border-fuchsia-200'
                                    : 'bg-white border-gray-100'
                                }`}
                              >
                                <div
                                  className="w-10 h-10 rounded-lg bg-gray-50 border border-gray-100 overflow-hidden flex-shrink-0 flex items-center justify-center"
                                  style={
                                    isCustom && item.customColorHex
                                      ? { background: item.customColorHex }
                                      : undefined
                                  }
                                >
                                  {!isCustom && item.imageUrl ? (
                                    <img src={item.imageUrl} alt={item.productName} className="w-full h-full object-contain p-1" />
                                  ) : !isCustom ? (
                                    <Package className="w-5 h-5 text-gray-200" />
                                  ) : (
                                    <Palette className="w-5 h-5 text-white drop-shadow" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <p className="text-xs font-bold text-gray-800 uppercase truncate">{item.productName}</p>
                                    {isCustom && (
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-gradient-to-r from-fuchsia-500 to-pink-500 text-white shrink-0">
                                        <Palette className="w-2.5 h-2.5" /> CUSTOM
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[10px] text-gray-400">
                                    {item.color && item.color !== 'Sin Color' ? `${item.color} · ` : ''}{item.format}
                                    <span className="ml-1.5 text-gray-300">SKU: {item.sku}</span>
                                  </p>
                                  {isCustom && (
                                    <p className="text-[10px] text-fuchsia-700 font-semibold mt-0.5">
                                      {item.customColorBrand}: {item.customColorCode}
                                      {item.customColorHex && ` · ${item.customColorHex.toUpperCase()}`}
                                    </p>
                                  )}
                                  {typeof item.unitPrice === 'number' && item.unitPrice > 0 && (
                                    <p className="text-[10px] text-slate-500 mt-0.5">
                                      <span className="font-semibold">{fmtCLP(item.unitPrice)}</span>
                                      {' × '}
                                      {item.quantity}
                                      {' = '}
                                      <span className="font-bold text-[#FF6E23]">{fmtCLP(item.lineTotal || item.unitPrice * item.quantity)}</span>
                                    </p>
                                  )}
                                </div>
                                <span className="text-sm font-black text-[#FF6E23] flex-shrink-0">
                                  x{item.quantity}
                                </span>
                              </div>
                            );
                          })}
                        </div>

                        {/* Totals (if priced) */}
                        {request.totalAmount && parseFloat(String(request.totalAmount)) > 0 && (
                          <div className="mt-3 p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                            <div className="flex justify-between text-xs text-slate-600">
                              <span>Subtotal</span>
                              <span className="font-semibold">{fmtCLP(request.subtotal)}</span>
                            </div>
                            <div className="flex justify-between text-xs text-slate-600">
                              <span>IVA 19%</span>
                              <span className="font-semibold">{fmtCLP(request.taxAmount)}</span>
                            </div>
                            <div className="flex justify-between text-sm font-black pt-1 border-t border-slate-200">
                              <span className="text-slate-800">Total</span>
                              <span className="text-[#FF6E23]">{fmtCLP(request.totalAmount)}</span>
                            </div>
                            {request.validUntilDate && (
                              <p className="text-[10px] text-slate-400 pt-1">
                                Válida hasta: {formatDate(request.validUntilDate)}
                              </p>
                            )}
                          </div>
                        )}

                        {/* Actions: pricing + PDF */}
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            onClick={() => setPricingRequest(request)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-gradient-to-r from-[#FF6E23] to-[#E55E13] text-white hover:from-[#E55E13] hover:to-[#D54E03] shadow-sm shadow-orange-500/20 transition-all"
                          >
                            <DollarSign className="w-3.5 h-3.5" />
                            {request.totalAmount && parseFloat(String(request.totalAmount)) > 0
                              ? 'Editar precios'
                              : 'Asignar precios'}
                          </button>
                          {request.totalAmount && parseFloat(String(request.totalAmount)) > 0 && (
                            <a
                              href={`/api/b2c/quote-requests/${request.id}/pdf`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 transition-all"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              Ver / imprimir PDF
                            </a>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-3 flex-wrap">
                      <span className="text-[10px] text-gray-400">
                        <Calendar className="w-3 h-3 inline mr-1" />
                        Recibida: {formatDate(request.createdAt)}
                        {request.updatedAt !== request.createdAt && (
                          <> · Actualizada: {formatDate(request.updatedAt)}</>
                        )}
                      </span>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          disabled={deleteMutation.isPending}
                          onClick={() => {
                            if (
                              window.confirm(
                                `¿Eliminar la solicitud de ${request.visitorName}? Esta acción no se puede deshacer.`,
                              )
                            ) {
                              deleteMutation.mutate(request.id);
                            }
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-red-50 border border-red-200 text-red-700 hover:bg-red-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Eliminar
                        </button>
                        <span className="text-[10px] text-gray-300">ID: {request.id}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pricing modal */}
      <QuoteRequestPricingModal
        open={!!pricingRequest}
        request={pricingRequest as any}
        onClose={() => setPricingRequest(null)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['/api/b2c/quote-requests'] });
          toast({
            title: 'Cotización guardada',
            description: 'Los precios fueron asignados correctamente.',
          });
        }}
      />
    </div>
  );
}
