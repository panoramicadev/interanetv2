/**
 * Cotizaciones Web — solicitudes que llegan desde el cotizador público (/cotizador).
 *
 * Quién ve qué lo decide el servidor (GET /api/b2c/quote-requests): el admin ve
 * todas y filtra por segmento; el supervisor ve solo las de su área. Cada
 * solicitud trae `puedeAsignar`: el admin asigna vendedor en cualquier segmento
 * y el supervisor solo donde su área lo permite (hoy Ferretería). Asignar deja
 * la cotización en "Asignado", pasa el lead del CRM al vendedor y le avisa por
 * correo.
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileText, User, Mail, Phone, Building, MapPin, Calendar, ChevronDown, Package, Clock,
  CheckCircle, MessageSquare, Search, RefreshCw, DollarSign, Palette, Printer, Trash2,
  StickyNote, Save, Layers, Building2, UserCheck, UserPlus, Loader2,
} from 'lucide-react';
import { Link } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { EstadoVacio, SUPERFICIE, BOTON_MARCA } from '@/components/gastos/ui';
import QuoteRequestPricingModal from '@/components/b2c-admin/QuoteRequestPricingModal';
import {
  ETIQUETA_COTIZACION_WEB,
  SEGMENTOS_COTIZACION_WEB,
  getSegmentoCotizacionWeb,
  segmentoCotizacionWebLabel,
} from '@shared/segmentos-cotizacion-web';

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
  assignedToUserId?: string | null;
  assignedToName?: string | null;
  puedeAsignar?: boolean;
  createdAt: string;
  updatedAt: string;
}

interface QuoteRequestsResponse {
  requests: QuoteRequest[];
  acceso: { todos: boolean; segmento?: string | null };
}

const sinTildes = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const fmtCLP =(n: number | string | undefined): string => {
  const num = typeof n === 'string' ? parseFloat(n) : (n || 0);
  return `$${Math.round(num || 0).toLocaleString('es-CL').replace(/,/g, '.')}`;
};

const STATUS_CONFIG: Record<string, { label: string; chip: string; icon: any }> = {
  pending: { label: 'Pendiente', chip: 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/40 dark:border-amber-900 dark:text-amber-300', icon: Clock },
  assigned: { label: 'Asignado', chip: 'bg-orange-50 border-orange-200 text-[#fd6301] dark:bg-orange-950/40 dark:border-orange-900', icon: UserCheck },
  contacted: { label: 'Contactado', chip: 'bg-sky-50 border-sky-200 text-sky-700 dark:bg-sky-950/40 dark:border-sky-900 dark:text-sky-300', icon: Phone },
  quoted: { label: 'Cotizado', chip: 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-900 dark:text-emerald-300', icon: CheckCircle },
  sale: { label: 'Venta', chip: 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-900 dark:text-emerald-300', icon: DollarSign },
  closed: { label: 'Cerrado', chip: 'bg-slate-50 border-slate-200 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300', icon: CheckCircle },
};
const ESTADOS = ['pending', 'assigned', 'contacted', 'quoted', 'sale', 'closed'];

const BOTON_SECUNDARIO = 'inline-flex items-center justify-center gap-2 h-10 px-4 text-sm font-semibold rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-orange-200 hover:text-[#fd6301] transition-all disabled:opacity-40';
/** Botón de contacto (Llamar / WhatsApp / Correo) del detalle. */
const ACCION_CONTACTO = 'inline-flex items-center justify-center gap-1.5 h-10 px-2 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-orange-200 hover:text-[#fd6301] transition-all';
const MICRO_LABEL ='text-[10px] uppercase tracking-wider font-bold text-slate-400';

// ── Resumen: tarjetas que filtran (molde de Seguimiento en pages/tareas.tsx) ──

const HORAS = 60 * 60 * 1000;
/** Una cotización sin vendedor más de esto ya se considera atrasada. */
const HORAS_ATRASO = 48;
const horasDesde = (fecha: string) => (Date.now() - new Date(fecha).getTime()) / HORAS;

type FiltroResumen = 'sin-vendedor' | 'con-vendedor' | 'nuevas' | 'atrasadas' | 'cotizadas' | 'ventas';

const FILTROS_RESUMEN: Record<FiltroResumen, (r: QuoteRequest) => boolean> = {
  'sin-vendedor': r => !r.assignedToUserId && r.status !== 'closed',
  'con-vendedor': r => !!r.assignedToUserId,
  nuevas: r => horasDesde(r.createdAt) <= HORAS_ATRASO,
  atrasadas: r => r.status === 'pending' && !r.assignedToUserId && horasDesde(r.createdAt) > HORAS_ATRASO,
  cotizadas: r => r.status === 'quoted',
  ventas: r => r.status === 'sale',
};

const GRUPOS_RESUMEN: Array<{
  titulo: string;
  Icono: any;
  filtros: Array<{ id: FiltroResumen; etiqueta: string; alerta?: boolean }>;
}> = [
  {
    titulo: 'Vendedor',
    Icono: UserCheck,
    filtros: [
      { id: 'sin-vendedor', etiqueta: 'sin vendedor', alerta: true },
      { id: 'con-vendedor', etiqueta: 'con vendedor' },
    ],
  },
  {
    titulo: 'Atención',
    Icono: Clock,
    filtros: [
      { id: 'nuevas', etiqueta: `nuevas ${HORAS_ATRASO} h` },
      { id: 'atrasadas', etiqueta: `atrasadas ${HORAS_ATRASO / 24}+ días`, alerta: true },
    ],
  },
  {
    titulo: 'Resultado',
    Icono: CheckCircle,
    filtros: [
      { id: 'cotizadas', etiqueta: 'cotizadas' },
      { id: 'ventas', etiqueta: 'ventas' },
    ],
  },
];

function TarjetaResumen({ icono, titulo, activo, opciones }: {
  icono: React.ReactNode;
  titulo: string;
  activo: boolean;
  opciones: Array<{ id: string; valor: number; etiqueta: string; alerta?: boolean; sel: boolean; onClick: () => void }>;
}) {
  return (
    <div className={cn(
      'rounded-2xl border bg-white dark:bg-slate-800/40 p-3 sm:p-4 shadow-sm transition-all',
      activo ? 'border-[#fd6301] ring-2 ring-[#fd6301]/20' : 'border-slate-200/80 dark:border-slate-700/60',
    )}>
      <div className="flex items-center gap-2 mb-2.5 text-slate-900 dark:text-slate-100">
        <span className="w-5 h-5 flex items-center justify-center flex-shrink-0">{icono}</span>
        <span className="text-sm font-semibold">{titulo}</span>
      </div>
      <div className={cn('grid gap-1.5', opciones.length === 3 ? 'grid-cols-3' : 'grid-cols-2')}>
        {opciones.map(o => (
          <button
            key={o.id}
            type="button"
            onClick={o.onClick}
            className={cn(
              'rounded-xl px-2 py-1.5 text-left transition-colors min-w-0',
              o.sel ? 'bg-[#fd6301] text-white' : 'bg-slate-50 hover:bg-orange-50 dark:bg-slate-900/40 dark:hover:bg-orange-950/30',
            )}
            data-testid={`kpi-${o.id}`}
            title={o.sel ? 'Quitar filtro' : 'Ver estas cotizaciones'}
          >
            <div className={cn(
              'text-xl font-bold leading-none tabular-nums',
              o.sel ? 'text-white' : o.alerta && o.valor > 0 ? 'text-[#fd6301]' : 'text-slate-900 dark:text-slate-100',
            )}>
              {o.valor}
            </div>
            <p className={cn('text-[11px] mt-1 leading-tight truncate', o.sel ? 'text-white/90' : 'text-slate-500 dark:text-slate-400')}>
              {o.etiqueta}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function CotizacionesB2CPage() {
  return <SolicitudesWebPanel />;
}

export function SolicitudesWebPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterSegmento, setFilterSegmento] = useState<string>('all');
  const [kpiFiltro, setKpiFiltro] = useState<FiltroResumen | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [pricingRequest, setPricingRequest] = useState<QuoteRequest | null>(null);
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});

  const { data, isLoading, isFetching, refetch } = useQuery<QuoteRequestsResponse>({
    queryKey: ['/api/b2c/quote-requests'],
    queryFn: async () => {
      const res = await fetch('/api/b2c/quote-requests', { credentials: 'include' });
      if (!res.ok) throw new Error('Error al cargar solicitudes');
      return res.json();
    },
  });

  const invalidar = () => queryClient.invalidateQueries({ queryKey: ['/api/b2c/quote-requests'] });

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
      invalidar();
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
      invalidar();
      toast({ title: 'Solicitud eliminada', description: 'La cotización fue eliminada correctamente.' });
      setExpandedId(null);
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err?.message || 'No se pudo eliminar.', variant: 'destructive' });
    },
  });

  const requests: QuoteRequest[] = data?.requests || [];
  // Solo el admin elige Área: el supervisor ya recibe nada más que las de la suya.
  const verTodas = !!data?.acceso?.todos;

  // El segmento acota todo lo demás (KPIs incluidos); el estado y la búsqueda, solo la lista.
  const delSegmento = requests.filter(r =>
    filterSegmento === 'all' || getSegmentoCotizacionWeb(r.segmento)?.value === filterSegmento,
  );
  const filtered = delSegmento.filter(r => {
    if (kpiFiltro && !FILTROS_RESUMEN[kpiFiltro](r)) return false;
    if (searchTerm) {
      // Sin tildes ni mayúsculas: "hernandez" encuentra a "Hernández".
      const term = sinTildes(searchTerm.trim());
      return [r.visitorName, r.visitorEmail, r.visitorCompany, r.visitorCity, r.assignedToName]
        .some(v => sinTildes(v || '').includes(term));
    }
    return true;
  });

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('es-CL', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4 md:space-y-5">
      {/* Encabezado */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {/* Ícono naranjo suelto, sin fondo (pedido del usuario, oct-2026). */}
          <FileText className="h-6 w-6 text-[#fd6301] shrink-0" />
          <h1 className="text-xl md:text-2xl font-bold text-slate-800 dark:text-slate-100 min-w-0">Cotizaciones Web</h1>
        </div>
        {/* Chico y a la derecha, también en celular (pedido del usuario, oct-2026). */}
        <button
          onClick={() => refetch()}
          title="Actualizar"
          className="shrink-0 inline-flex items-center gap-1.5 h-8 px-3 text-xs font-semibold rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-orange-200 hover:text-[#fd6301] transition-all"
        >
          <RefreshCw className={cn('w-3.5 h-3.5', isFetching && 'animate-spin')} />
          <span className="hidden sm:inline">Actualizar</span>
        </button>
      </div>

      {/* Buscador */}
      <div className="relative w-full sm:max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          placeholder="Buscar cliente o vendedor..."
          className="w-full h-10 pl-10 pr-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:border-[#fd6301] focus:ring-2 focus:ring-orange-500/20"
        />
      </div>

      {/* Resumen: cada número filtra la lista (mismo molde que Seguimiento del Panel de Trabajo) */}
      <div className={cn('grid grid-cols-1 min-[420px]:grid-cols-2 gap-2.5 sm:gap-3', verTodas ? 'lg:grid-cols-4' : 'lg:grid-cols-3')}>
        {verTodas && (
          <TarjetaResumen
            icono={<Building2 className="h-5 w-5" />}
            titulo="Área"
            activo={filterSegmento !== 'all'}
            opciones={SEGMENTOS_COTIZACION_WEB.map(s => ({
              id: s.value,
              valor: requests.filter(r => getSegmentoCotizacionWeb(r.segmento)?.value === s.value).length,
              etiqueta: s.crmSegmento,
              sel: filterSegmento === s.value,
              onClick: () => setFilterSegmento(filterSegmento === s.value ? 'all' : s.value),
            }))}
          />
        )}
        {GRUPOS_RESUMEN.map(g => (
          <TarjetaResumen
            key={g.titulo}
            icono={<g.Icono className="h-5 w-5" />}
            titulo={g.titulo}
            activo={g.filtros.some(f => f.id === kpiFiltro)}
            opciones={g.filtros.map(f => ({
              id: f.id,
              valor: delSegmento.filter(FILTROS_RESUMEN[f.id]).length,
              etiqueta: f.etiqueta,
              alerta: f.alerta,
              sel: kpiFiltro === f.id,
              onClick: () => setKpiFiltro(kpiFiltro === f.id ? null : f.id),
            }))}
          />
        ))}
      </div>

      {/* Sin fila de pestañas por estado (pedido del usuario, oct-2026): filtran las
          tarjetas de arriba, y el estado se cambia en el detalle de cada cotización. */}

      {/* Lista */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-7 h-7 text-[#fd6301] animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <EstadoVacio
          icono={FileText}
          titulo="Sin solicitudes"
          descripcion={
            kpiFiltro || searchTerm || filterSegmento !== 'all'
              ? 'Ninguna cotización calza con el filtro. Toca de nuevo el número elegido para quitarlo.'
              : 'Cuando llegue una cotización desde el sitio web va a aparecer acá.'
          }
        />
      ) : (
        <div className="space-y-3">
          {filtered.map(request => {
            const isExpanded = expandedId === request.id;
            const statusCfg = STATUS_CONFIG[request.status] || STATUS_CONFIG.pending;
            const StatusIcon = statusCfg.icon;
            const segmentoLabel = segmentoCotizacionWebLabel(request.segmento);

            return (
              <div
                key={request.id}
                className={cn(SUPERFICIE, 'overflow-hidden transition-all', isExpanded ? 'border-orange-200 shadow-md dark:border-orange-900' : 'hover:border-slate-300 dark:hover:border-slate-600')}
              >
                {/* Fila */}
                <button
                  type="button"
                  className="w-full flex flex-wrap sm:flex-nowrap items-center gap-x-4 gap-y-2 p-4 text-left hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : request.id)}
                >
                  <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-bold shrink-0', statusCfg.chip)}>
                    <StatusIcon className="w-3.5 h-3.5" />
                    {statusCfg.label}
                  </span>

                  <div className="flex-1 min-w-0 basis-full sm:basis-auto order-last sm:order-none">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-semibold text-slate-800 dark:text-slate-100 text-sm truncate">{request.visitorName}</span>
                      {segmentoLabel && (
                        <span className="shrink-0 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-bold uppercase tracking-wide">
                          {segmentoLabel}
                        </span>
                      )}
                      {request.visitorCompany && (
                        <span className="text-xs text-slate-400 hidden md:inline truncate">· {request.visitorCompany}</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 truncate">{request.visitorEmail}</p>
                  </div>

                  <span
                    className={cn(
                      'inline-flex items-center gap-1.5 text-xs font-semibold shrink-0',
                      request.assignedToName ? 'text-slate-600 dark:text-slate-300' : 'text-amber-600 dark:text-amber-400',
                    )}
                  >
                    {/* Con vendedor va solo el nombre: el chip "Asignado" ya lleva el ícono. */}
                    {!request.assignedToName && <UserPlus className="w-3.5 h-3.5" />}
                    {request.assignedToName || 'Sin vendedor'}
                  </span>

                  <span className="hidden lg:inline-flex items-center gap-1 text-xs font-semibold text-slate-500 shrink-0">
                    <Package className="w-3.5 h-3.5" />
                    {request.itemCount} producto{request.itemCount !== 1 ? 's' : ''}
                  </span>

                  <span className="text-xs text-slate-400 hidden md:block whitespace-nowrap shrink-0">
                    {formatDate(request.createdAt)}
                  </span>

                  <ChevronDown className={cn('w-4 h-4 text-slate-400 shrink-0 ml-auto sm:ml-0 transition-transform', isExpanded && 'rotate-180')} />
                </button>

                {/* Detalle */}
                {isExpanded && (
                  <div className="border-t border-slate-100 dark:border-slate-800">
                    <div className="p-4 md:p-5 grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Izquierda: vendedor, contacto, estado, notas */}
                      <div className="space-y-5 min-w-0">
                        <AsignacionVendedor request={request} />

                        <div className="space-y-3">
                          <h4 className={MICRO_LABEL}>Datos de contacto</h4>

                          {/* Contactar a un toque: lo primero que se hace desde el teléfono */}
                          <div className={cn('grid gap-2', request.visitorPhone ? 'grid-cols-3' : 'grid-cols-1')}>
                            {request.visitorPhone && (
                              <a href={`tel:${request.visitorPhone}`} className={ACCION_CONTACTO}>
                                <Phone className="w-4 h-4" />
                                Llamar
                              </a>
                            )}
                            {request.visitorPhone && (
                              <a
                                href={`https://wa.me/${request.visitorPhone.replace(/\D/g, '')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={ACCION_CONTACTO}
                              >
                                <MessageSquare className="w-4 h-4" />
                                WhatsApp
                              </a>
                            )}
                            <a href={`mailto:${request.visitorEmail}`} className={ACCION_CONTACTO}>
                              <Mail className="w-4 h-4" />
                              Correo
                            </a>
                          </div>

                          <div className="grid grid-cols-2 gap-x-3 gap-y-3">
                            <div className="col-span-2">
                              <Dato icono={User} label="Nombre">{request.visitorName}</Dato>
                            </div>
                            <div className="col-span-2">
                              <Dato icono={Mail} label="Email">
                                <span className="break-all">{request.visitorEmail}</span>
                              </Dato>
                            </div>
                            {request.visitorPhone && <Dato icono={Phone} label="Teléfono">{request.visitorPhone}</Dato>}
                            {request.visitorCompany && <Dato icono={Building} label="Empresa">{request.visitorCompany}</Dato>}
                            {request.visitorCity && <Dato icono={MapPin} label="Ciudad">{request.visitorCity}</Dato>}
                            {request.visitorRut && <Dato icono={FileText} label="RUT">{request.visitorRut}</Dato>}
                            {segmentoLabel && <Dato icono={Layers} label="Segmento">{segmentoLabel}</Dato>}
                          </div>

                          {request.crmSeguimientoId && (
                            <Link
                              href={`/seguimiento-clientes/${request.crmSeguimientoId}`}
                              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#fd6301] hover:underline"
                              title={`Etiqueta ${ETIQUETA_COTIZACION_WEB}`}
                            >
                              <Layers className="w-3.5 h-3.5" />
                              Ver lead en el CRM
                            </Link>
                          )}

                          {request.message && (
                            <div className="rounded-2xl bg-orange-50 dark:bg-orange-950/30 border-l-4 border-[#fd6301] px-4 py-3">
                              <div className="flex items-center gap-1.5 mb-1">
                                <MessageSquare className="w-3.5 h-3.5 text-[#fd6301]" />
                                <p className={MICRO_LABEL}>Mensaje</p>
                              </div>
                              <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap">{request.message}</p>
                            </div>
                          )}
                        </div>

                        <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                          <p className={cn(MICRO_LABEL, 'mb-2')}>Cambiar estado</p>
                          <div className="flex gap-2 flex-wrap">
                            {ESTADOS.map(status => {
                              const cfg = STATUS_CONFIG[status];
                              const isCurrent = request.status === status;
                              return (
                                <button
                                  key={status}
                                  disabled={isCurrent || updateStatusMutation.isPending}
                                  onClick={() => updateStatusMutation.mutate({ id: request.id, status })}
                                  className={cn(
                                    'px-3 py-1.5 rounded-2xl text-xs font-bold border transition-all',
                                    isCurrent
                                      ? cn(cfg.chip, 'cursor-default')
                                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500 hover:border-orange-200 hover:text-[#fd6301]',
                                  )}
                                >
                                  {cfg.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                          <div className="flex items-center gap-1.5 mb-2">
                            <StickyNote className="w-3.5 h-3.5 text-[#fd6301]" />
                            <p className={MICRO_LABEL}>Notas internas del cliente</p>
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
                                  onChange={e => setNotesDraft(prev => ({ ...prev, [request.id]: e.target.value }))}
                                  placeholder="Anota llamadas, acuerdos, preferencias del cliente..."
                                  rows={3}
                                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/60 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-[#fd6301] focus:ring-2 focus:ring-orange-500/20 resize-y"
                                />
                                <div className="flex items-center justify-between mt-1.5">
                                  <span className="text-[10px] text-slate-400">{dirty ? 'Cambios sin guardar' : 'Guardado'}</span>
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
                                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-2xl text-xs font-bold bg-[#0a0a0a] text-white hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
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

                      {/* Derecha: productos y precios */}
                      <div className="min-w-0">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className={MICRO_LABEL}>Productos solicitados ({request.itemCount})</h4>
                          {request.quoteNumber && (
                            <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300 px-2 py-0.5 rounded-full">
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
                                className={cn(
                                  'flex items-center gap-3 p-2.5 rounded-xl border',
                                  isCustom
                                    ? 'bg-fuchsia-50/60 border-fuchsia-200 dark:bg-fuchsia-950/20 dark:border-fuchsia-900'
                                    : 'bg-white border-slate-100 dark:bg-slate-900 dark:border-slate-800',
                                )}
                              >
                                <div
                                  className="w-10 h-10 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 overflow-hidden flex-shrink-0 flex items-center justify-center"
                                  style={isCustom && item.customColorHex ? { background: item.customColorHex } : undefined}
                                >
                                  {!isCustom && item.imageUrl ? (
                                    <img src={item.imageUrl} alt={item.productName} className="w-full h-full object-contain p-1" />
                                  ) : !isCustom ? (
                                    <Package className="w-5 h-5 text-slate-300" />
                                  ) : (
                                    <Palette className="w-5 h-5 text-white drop-shadow" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <p className="text-xs font-bold text-slate-800 dark:text-slate-100 uppercase truncate">{item.productName}</p>
                                    {isCustom && (
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-fuchsia-500 text-white shrink-0">
                                        <Palette className="w-2.5 h-2.5" /> CUSTOM
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[10px] text-slate-400">
                                    {item.color && item.color !== 'Sin Color' ? `${item.color} · ` : ''}{item.format}
                                    <span className="ml-1.5 text-slate-300">SKU: {item.sku}</span>
                                  </p>
                                  {isCustom && (
                                    <p className="text-[10px] text-fuchsia-700 dark:text-fuchsia-300 font-semibold mt-0.5">
                                      {item.customColorBrand}: {item.customColorCode}
                                      {item.customColorHex && ` · ${item.customColorHex.toUpperCase()}`}
                                    </p>
                                  )}
                                  {typeof item.unitPrice === 'number' && item.unitPrice > 0 && (
                                    <p className="text-[10px] text-slate-500 mt-0.5 tabular-nums">
                                      <span className="font-semibold">{fmtCLP(item.unitPrice)}</span>
                                      {' × '}{item.quantity}{' = '}
                                      <span className="font-bold text-[#fd6301]">{fmtCLP(item.lineTotal || item.unitPrice * item.quantity)}</span>
                                    </p>
                                  )}
                                </div>
                                <span className="text-sm font-bold text-[#fd6301] flex-shrink-0 tabular-nums">x{item.quantity}</span>
                              </div>
                            );
                          })}
                        </div>

                        {request.totalAmount && parseFloat(String(request.totalAmount)) > 0 && (
                          <div className="mt-3 p-3 rounded-2xl bg-orange-50 dark:bg-orange-950/30 space-y-1 tabular-nums">
                            <div className="flex justify-between text-xs text-slate-600 dark:text-slate-300">
                              <span>Subtotal</span>
                              <span className="font-semibold">{fmtCLP(request.subtotal)}</span>
                            </div>
                            <div className="flex justify-between text-xs text-slate-600 dark:text-slate-300">
                              <span>IVA 19%</span>
                              <span className="font-semibold">{fmtCLP(request.taxAmount)}</span>
                            </div>
                            <div className="flex justify-between text-sm font-bold pt-1 border-t border-orange-200/70 dark:border-orange-900">
                              <span className="text-slate-800 dark:text-slate-100">Total</span>
                              <span className="text-[#fd6301]">{fmtCLP(request.totalAmount)}</span>
                            </div>
                            {request.validUntilDate && (
                              <p className="text-[10px] text-slate-400 pt-1">Válida hasta: {formatDate(request.validUntilDate)}</p>
                            )}
                          </div>
                        )}

                        <div className="mt-3 flex flex-col sm:flex-row gap-2">
                          <button
                            onClick={() => setPricingRequest(request)}
                            className={cn(BOTON_MARCA, 'inline-flex items-center justify-center gap-2 h-10 px-4 text-sm font-semibold')}
                          >
                            <DollarSign className="w-4 h-4" />
                            {request.totalAmount && parseFloat(String(request.totalAmount)) > 0 ? 'Editar precios' : 'Asignar precios'}
                          </button>
                          {request.totalAmount && parseFloat(String(request.totalAmount)) > 0 && (
                            <a
                              href={`/api/b2c/quote-requests/${request.id}/pdf`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={BOTON_SECUNDARIO}
                            >
                              <Printer className="w-4 h-4" />
                              Ver / imprimir PDF
                            </a>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Pie */}
                    <div className="px-4 md:px-5 py-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 flex-wrap">
                      <span className="text-[10px] text-slate-400">
                        <Calendar className="w-3 h-3 inline mr-1" />
                        Recibida: {formatDate(request.createdAt)}
                        {request.updatedAt !== request.createdAt && <> · Actualizada: {formatDate(request.updatedAt)}</>}
                      </span>
                      <button
                        type="button"
                        disabled={deleteMutation.isPending}
                        onClick={() => {
                          if (window.confirm(`¿Eliminar la solicitud de ${request.visitorName}? Esta acción no se puede deshacer.`)) {
                            deleteMutation.mutate(request.id);
                          }
                        }}
                        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-2xl text-xs font-bold border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/40 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Eliminar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <QuoteRequestPricingModal
        open={!!pricingRequest}
        request={pricingRequest as any}
        onClose={() => setPricingRequest(null)}
        onSuccess={() => {
          invalidar();
          toast({ title: 'Cotización guardada', description: 'Los precios fueron asignados correctamente.' });
        }}
      />
    </div>
  );
}

function Dato({ icono: Icono, label, children }: { icono: any; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 min-w-0">
      <Icono className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-[10px] text-slate-400 uppercase">{label}</p>
        <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">{children}</div>
      </div>
    </div>
  );
}

/**
 * Bloque "Vendedor asignado" del detalle. Quien puede asignar elige de la lista
 * del segmento; el resto ve a quién quedó y quién la asigna.
 */
function AsignacionVendedor({ request }: { request: QuoteRequest }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [elegido, setElegido] = useState<string>('');

  const { data: vendedoresData, isLoading } = useQuery<{ vendedores: { id: string; nombre: string; role?: string }[] }>({
    queryKey: ['/api/b2c/quote-requests', request.id, 'vendedores'],
    queryFn: async () => {
      const res = await fetch(`/api/b2c/quote-requests/${request.id}/vendedores`, { credentials: 'include' });
      if (!res.ok) throw new Error('Error al cargar vendedores');
      return res.json();
    },
    enabled: !!request.puedeAsignar,
  });
  const vendedores = vendedoresData?.vendedores ?? [];

  const asignar = useMutation({
    mutationFn: async (vendedorId: string) => {
      const res = await fetch(`/api/b2c/quote-requests/${request.id}/asignar`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ vendedorId }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message || 'No se pudo asignar');
      return body;
    },
    onSuccess: (body: any) => {
      setElegido('');
      queryClient.invalidateQueries({ queryKey: ['/api/b2c/quote-requests'] });
      toast({
        title: 'Vendedor asignado',
        description: `${body?.assignedToName || 'El vendedor'} recibió un correo con el lead${request.crmSeguimientoId ? ' y ya lo tiene en su CRM' : ''}.`,
      });
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err?.message || 'No se pudo asignar.', variant: 'destructive' });
    },
  });

  // Con vendedor, el bloque arranca mostrando a quién quedó; "Cambiar" abre la lista.
  const [eligiendo, setEligiendo] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const abierta = !!request.puedeAsignar && (eligiendo || !request.assignedToUserId);
  const elegidoNombre = vendedores.find(v => v.id === elegido)?.nombre;
  const termino = busqueda.trim().toLowerCase();
  const visibles = termino ? vendedores.filter(v => v.nombre.toLowerCase().includes(termino)) : vendedores;

  const Avatar = ({ nombre, activo }: { nombre: string; activo?: boolean }) => (
    <span className={cn(
      'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
      activo ? 'bg-white text-[#fd6301]' : 'bg-orange-50 text-[#fd6301] dark:bg-orange-950/40',
    )}>
      {nombre.trim().charAt(0).toUpperCase()}
    </span>
  );

  return (
    <div className="rounded-2xl border border-slate-200/70 dark:border-slate-700 p-3.5 min-w-0">
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-1.5">
          <UserCheck className="w-3.5 h-3.5 text-[#fd6301]" />
          <p className={MICRO_LABEL}>Vendedor asignado</p>
        </div>
        {request.puedeAsignar && request.assignedToUserId && (
          <button
            type="button"
            onClick={() => { setEligiendo(!eligiendo); setElegido(''); setBusqueda(''); }}
            className="text-xs font-semibold text-[#fd6301] hover:underline"
          >
            {eligiendo ? 'Cancelar' : 'Cambiar'}
          </button>
        )}
      </div>

      {/* A quién quedó (o quién la asigna) */}
      {!abierta && (
        request.assignedToName ? (
          <div className="flex items-center gap-2.5 min-w-0">
            <Avatar nombre={request.assignedToName} />
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{request.assignedToName}</span>
          </div>
        ) : (
          <p className="text-sm font-semibold text-amber-600 dark:text-amber-400">Sin vendedor · la asigna el administrador</p>
        )
      )}

      {/* Lista para elegir: se toca la fila, sin desplegable */}
      {abierta && (
        <div className="space-y-2.5">
          {vendedores.length > 6 && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                placeholder="Buscar vendedor..."
                className="w-full h-9 pl-8 pr-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/60 text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:border-[#fd6301] focus:ring-2 focus:ring-orange-500/20"
              />
            </div>
          )}

          <div className="max-h-64 overflow-y-auto -mx-1 px-1 space-y-1" role="radiogroup" aria-label="Vendedores">
            {isLoading ? (
              [0, 1, 2].map(i => (
                <div key={i} className="flex items-center gap-2.5 p-2">
                  <span className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 animate-pulse" />
                  <span className="h-3 w-40 rounded-full bg-slate-100 dark:bg-slate-800 animate-pulse" />
                </div>
              ))
            ) : visibles.length === 0 ? (
              <p className="text-xs text-slate-400 px-2 py-3">
                {vendedores.length === 0 ? 'No hay vendedores activos en este segmento.' : 'Ningún vendedor coincide con la búsqueda.'}
              </p>
            ) : (
              visibles.map(v => {
                const sel = elegido === v.id;
                const actual = request.assignedToUserId === v.id;
                return (
                  <button
                    key={v.id}
                    type="button"
                    role="radio"
                    aria-checked={sel}
                    disabled={actual || asignar.isPending}
                    onClick={() => setElegido(sel ? '' : v.id)}
                    data-testid={`vendedor-${v.id}`}
                    className={cn(
                      'w-full flex items-center gap-2.5 p-2 rounded-xl text-left transition-colors min-w-0',
                      sel
                        ? 'bg-[#fd6301] text-white'
                        : 'hover:bg-orange-50 dark:hover:bg-orange-950/30 disabled:opacity-50 disabled:hover:bg-transparent',
                    )}
                  >
                    <Avatar nombre={v.nombre} activo={sel} />
                    <span className={cn('text-sm font-medium truncate flex-1', sel ? 'text-white' : 'text-slate-700 dark:text-slate-200')}>
                      {v.nombre}
                    </span>
                    {v.role === 'supervisor' && (
                      <span className={cn('text-[10px] font-bold uppercase tracking-wide shrink-0', sel ? 'text-white/80' : 'text-slate-400')}>
                        Supervisor
                      </span>
                    )}
                    {actual && <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400 shrink-0">Actual</span>}
                    {sel && <CheckCircle className="w-4 h-4 text-white shrink-0" />}
                  </button>
                );
              })
            )}
          </div>

          <button
            type="button"
            disabled={!elegido || asignar.isPending}
            onClick={() => asignar.mutate(elegido, { onSuccess: () => setEligiendo(false) })}
            className={cn(BOTON_MARCA, 'w-full inline-flex items-center justify-center gap-2 h-10 px-4 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed')}
            data-testid={`asignar-${request.id}`}
          >
            {asignar.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
            <span className="truncate">{elegidoNombre ? `Asignar a ${elegidoNombre}` : 'Elige un vendedor'}</span>
          </button>
          <p className="text-[11px] text-slate-400 leading-snug">
            Le llega un correo{request.crmSeguimientoId ? ' y el lead queda a su nombre en el CRM' : ''}.
          </p>
        </div>
      )}
    </div>
  );
}
