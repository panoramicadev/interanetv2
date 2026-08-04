import { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import * as XLSX from "xlsx";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useFilter } from "@/contexts/FilterContext";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  TrendingUp,
  CheckCircle,
  XCircle,
  Clock,
  Download,
  BarChart3,
  PieChart as PieChartIcon,
  Calendar,
  Users,
  FileText,
  Loader2,
  Receipt,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CategoriaIcono,
  EstadoChip,
  EstadoVacio,
  KpiCard,
  SUPERFICIE,
  formatoMoneda,
} from "@/components/gastos/ui";
import { useLocation } from "wouter";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement,
} from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { Doughnut, Line } from 'react-chartjs-2';
import type { LucideIcon } from 'lucide-react';
import type { GastoEmpresarial, FundAllocation } from "@shared/schema";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useToast } from "@/hooks/use-toast";
import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker - using static file from public folder
// This avoids dynamic import issues in production builds
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

// Fetch with timeout helper
async function fetchWithTimeout(url: string, opts: RequestInit = {}, timeoutMs = 10000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...opts, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

// Wrap any promise with a hard timeout — prevents infinite hangs
function withTimeout<T>(promise: Promise<T>, ms: number, label = ''): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`Timeout ${ms}ms: ${label}`)), ms))
  ]);
}

// Load an Image element with a timeout — prevents hanging on bad src
function loadImageElement(src: string, timeoutMs = 10000): Promise<HTMLImageElement> {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const imgEl = new Image();
    const timer = setTimeout(() => { imgEl.src = ''; reject(new Error('Image load timeout')); }, timeoutMs);
    imgEl.onload = () => { clearTimeout(timer); resolve(imgEl); };
    imgEl.onerror = () => { clearTimeout(timer); reject(new Error('Image load error')); };
    imgEl.src = src;
  });
}

// Compress image via canvas — returns small JPEG base64
function compressImageToJpeg(imgElement: HTMLImageElement, maxWidth = 600, quality = 0.5): string {
  let w = imgElement.naturalWidth;
  let h = imgElement.naturalHeight;
  if (w > maxWidth) {
    h = Math.round(h * (maxWidth / w));
    w = maxWidth;
  }
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.drawImage(imgElement, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', quality);
}

// Fetch a file blob from URL — proxy first for external (avoids CORS), then direct fallback
async function fetchFileBlob(fileUrl: string): Promise<Blob> {
  const isExternal = fileUrl.startsWith('http') && !fileUrl.includes(window.location.hostname);

  if (isExternal) {
    // Server proxy FIRST — no CORS issues for server-to-server
    try {
      const proxyRes = await fetchWithTimeout(
        `/api/proxy-file?url=${encodeURIComponent(fileUrl)}`,
        { credentials: 'include' },
        8000
      );
      if (proxyRes.ok) return await proxyRes.blob();
      console.warn('[PDF] Proxy failed:', proxyRes.status, fileUrl.substring(0, 80));
    } catch (e) {
      console.warn('[PDF] Proxy error:', e, fileUrl.substring(0, 80));
    }
    // Fallback: direct fetch (might work for truly public URLs)
    try {
      const res = await fetchWithTimeout(fileUrl, {}, 8000);
      if (res.ok) return await res.blob();
    } catch {}
    throw new Error(`Failed to fetch external file: ${fileUrl.substring(0, 80)}`);
  }

  // Local URL
  const res = await fetchWithTimeout(fileUrl, { credentials: 'include' }, 10000);
  if (!res.ok) throw new Error(`Failed to fetch local: ${res.status}`);
  return await res.blob();
}

// Load image for PDF — fetches, compresses to small JPEG
async function loadImageForPdf(imageUrl: string, retries = 2): Promise<{ base64: string; format: 'JPEG' | 'PNG' | 'WEBP' }> {
  const absoluteUrl = imageUrl.startsWith('http')
    ? imageUrl
    : `${window.location.origin}${imageUrl}`;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // Try normalized endpoint first (handles EXIF rotation)
      let blob: Blob | null = null;
      try {
        const res = await fetchWithTimeout(`/api/image-normalized?url=${encodeURIComponent(absoluteUrl)}`, { credentials: 'include' }, 8000);
        if (res.ok) blob = await res.blob();
      } catch {}

      // Fallback to direct/proxy fetch
      if (!blob) {
        blob = await fetchFileBlob(absoluteUrl);
      }

      // Convert blob to Image, then compress to JPEG via canvas
      const objectUrl = URL.createObjectURL(blob);
      try {
        const imgEl = await loadImageElement(objectUrl, 6000);
        const compressed = compressImageToJpeg(imgEl, 600, 0.5);
        if (!compressed) throw new Error('Compression failed');
        return { base64: compressed, format: 'JPEG' };
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    } catch (err) {
      console.warn(`[PDF] Image load attempt ${attempt + 1}/${retries + 1} failed for: ${absoluteUrl.substring(0, 80)}`, err);
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 1500));
      } else {
        throw err;
      }
    }
  }
  throw new Error('All retries exhausted');
}

// Convert first page of PDF to compressed JPEG image
async function pdfToImage(pdfUrl: string, width: number = 500): Promise<string | null> {
  try {
    // Use proxy for external URLs to avoid CORS
    const isExternal = pdfUrl.startsWith('http') && !pdfUrl.includes(window.location.hostname);
    let blob: Blob;
    
    if (isExternal) {
      // Try proxy first (avoids CORS issues for Supabase PDFs)
      try {
        const proxyRes = await fetchWithTimeout(
          `/api/proxy-file?url=${encodeURIComponent(pdfUrl)}`,
          { credentials: 'include' },
          15000
        );
        if (proxyRes.ok) {
          blob = await proxyRes.blob();
        } else {
          throw new Error(`Proxy returned ${proxyRes.status}`);
        }
      } catch (proxyErr) {
        console.warn('[PDF-Preview] Proxy failed, trying direct:', proxyErr);
        const directRes = await fetchWithTimeout(pdfUrl, {}, 10000);
        if (!directRes.ok) throw new Error(`Direct fetch failed: ${directRes.status}`);
        blob = await directRes.blob();
      }
    } else {
      const res = await fetchWithTimeout(pdfUrl, { credentials: 'include' }, 10000);
      if (!res.ok) throw new Error(`Local fetch failed: ${res.status}`);
      blob = await res.blob();
    }

    const arrayBuffer = await blob.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    const page = await pdf.getPage(1);

    const viewport = page.getViewport({ scale: 1 });
    const scale = width / viewport.width;
    const scaledViewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return null;

    canvas.width = scaledViewport.width;
    canvas.height = scaledViewport.height;

    await page.render({ canvasContext: context, viewport: scaledViewport, canvas } as any).promise;

    return canvas.toDataURL('image/jpeg', 0.5);
  } catch (error) {
    console.error('[PDF-Preview] Error converting PDF to image:', error);
    return null;
  }
}

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement,
  ChartDataLabels
);

interface GastosSummary {
  totalPendiente: number;
  totalAprobado: number;
  totalRechazado: number;
  total: number;
  count: number;
}

interface GastosByCategoria {
  categoria: string;
  total: number;
  cantidad: number;
}

interface GastosByUser {
  userId: string;
  userName: string;
  total: number;
  cantidad: number;
}

interface GastosByDia {
  dia: string;
  total: number;
  cantidad: number;
}

const CATEGORIAS = [
  "Combustibles",
  "Peaje",
  "Colación",
  "Gestión Ventas",
  "Transporte",
  "Materiales",
  "Servicios",
  "Otros"
];

/**
 * Paleta categórica del dashboard: orden fijo arrancando por el naranja de
 * marca. Validada contra daltonismo (deutan/protan/tritan) sobre superficie
 * clara; los pares vecinos separan ΔE ≥ 9, así que las categorías se distinguen
 * sin depender solo del color (igual todas van con su nombre y su monto al lado).
 *
 * El color lo lleva la CATEGORÍA, no su posición en el ranking: se asigna por
 * `colorCategoria()` a partir de un orden estable, de manera que filtrar el
 * período no repinte las que quedan.
 */
const PALETA_CATEGORIAS = [
  '#fd6301', // marca
  '#2563eb',
  '#10b981',
  '#db2777',
  '#f59e0b',
  '#7c3aed',
  '#0d9488',
];

/** Todo lo que cae fuera de los 7 primeros slots se agrupa como "Otras". */
const COLOR_OTRAS = '#64748b';

/**
 * Colores de estado. Son reservados: no se reutilizan como color de serie.
 * Pendiente ámbar, aprobado verde, rechazado rojo, igual que los chips.
 */
const COLOR_ESTADO = {
  pendiente: '#d97706',
  aprobado: '#059669',
  rechazado: '#dc2626',
};

/** Tinta de ejes y grilla: recesiva, nunca compite con las marcas. */
const TINTA_EJE = 'rgba(100, 116, 139, 0.9)';
const TINTA_GRILLA = 'rgba(148, 163, 184, 0.16)';

/** Título de tarjeta del dashboard: ícono en chip naranja + título + extra. */
function TituloTarjeta({
  icono: Icono,
  titulo,
  extra,
}: {
  icono: LucideIcon;
  titulo: string;
  extra?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-orange-50 dark:bg-orange-950/40">
          <Icono className="size-4 text-[#fd6301]" strokeWidth={1.8} />
        </span>
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">{titulo}</h3>
      </div>
      {extra}
    </div>
  );
}

export interface DashboardExportHandle {
  handleExportPDF: () => void;
  handleExportCSV: () => void;
  canExport: boolean;
  hasData: boolean;
  isGeneratingPDF: boolean;
  isLoadingUsers: boolean;
}

interface DashboardProps {
  embedded?: boolean;
  onReady?: () => void;
}

const GastosEmpresarialesDashboard = forwardRef<DashboardExportHandle, DashboardProps>(function GastosEmpresarialesDashboard({ embedded = false, onReady }, ref) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const { gastosFilter, updateGastosFilter } = useFilter();
  const mes = gastosFilter.mes;
  const anio = gastosFilter.anio;
  const usuarioFilter = gastosFilter.usuarioFilter;
  const setMes = (v: string) => updateGastosFilter({ mes: v });
  const setAnio = (v: string) => updateGastosFilter({ anio: v });
  const setUsuarioFilter = (v: string) => updateGastosFilter({ usuarioFilter: v });
  const diaDesde = gastosFilter.diaDesde || '';
  const diaHasta = gastosFilter.diaHasta || '';
  const vista = gastosFilter.vista || 'all';
  const vistaValue = gastosFilter.vistaValue || '';

  const canExport = user?.role && !['salesperson', 'Salesperson', 'Vendedor', 'vendedor'].includes(user.role);
  const [estadoFilter, setEstadoFilter] = useState("todos");
  const [categoriaFilter, setCategoriaFilter] = useState("todos");
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  const getDateRange = (month: string, year: string) => {
    const m = parseInt(month);
    const y = parseInt(year);
    // Use day range if set, otherwise full month
    const fechaDesde = diaDesde || new Date(y, m - 1, 1).toISOString().split('T')[0];
    const fechaHasta = diaHasta || new Date(y, m, 0).toISOString().split('T')[0];
    return { fechaDesde, fechaHasta };
  };

  // Append the active "Vista" slice (segment / centro / categoría / estado)
  // to a URL string. Used by every analytics request below.
  const withVistaParams = (url: string): string => {
    if (vista === 'all' || !vistaValue) return url;
    const sep = url.includes('?') ? '&' : '?';
    if (vista === 'segmento') return `${url}${sep}segmentCode=${encodeURIComponent(vistaValue)}`;
    if (vista === 'centroCostos') return `${url}${sep}centroCostos=${encodeURIComponent(vistaValue)}`;
    if (vista === 'categoria') return `${url}${sep}categoria=${encodeURIComponent(vistaValue)}`;
    if (vista === 'estado') return `${url}${sep}estado=${encodeURIComponent(vistaValue)}`;
    return url;
  };

  const { data: summary, isLoading: isLoadingSummary } = useQuery<GastosSummary>({
    queryKey: ['/api/gastos-empresariales/analytics/summary', mes, anio, usuarioFilter, diaDesde, diaHasta, vista, vistaValue],
    queryFn: async () => {
      let url = `/api/gastos-empresariales/analytics/summary?mes=${mes}&anio=${anio}`;
      if (usuarioFilter !== 'todos') {
        url += `&userId=${usuarioFilter}`;
      }
      url = withVistaParams(url);
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) throw new Error('Error al cargar resumen');
      return response.json();
    }
  });

  const { data: porCategoria = [], isLoading: isLoadingCategoria } = useQuery<GastosByCategoria[]>({
    queryKey: ['/api/gastos-empresariales/analytics/por-categoria', mes, anio, usuarioFilter, diaDesde, diaHasta, vista, vistaValue],
    queryFn: async () => {
      let url = `/api/gastos-empresariales/analytics/por-categoria?mes=${mes}&anio=${anio}`;
      if (usuarioFilter !== 'todos') {
        url += `&userId=${usuarioFilter}`;
      }
      url = withVistaParams(url);
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) throw new Error('Error al cargar datos por categoría');
      return response.json();
    }
  });

  const { data: porUsuario = [], isLoading: isLoadingUsuario } = useQuery<GastosByUser[]>({
    queryKey: ['/api/gastos-empresariales/analytics/por-usuario', mes, anio, usuarioFilter, diaDesde, diaHasta, vista, vistaValue],
    queryFn: async () => {
      let url = `/api/gastos-empresariales/analytics/por-usuario?mes=${mes}&anio=${anio}`;
      if (usuarioFilter !== 'todos') {
        url += `&userId=${usuarioFilter}`;
      }
      url = withVistaParams(url);
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) throw new Error('Error al cargar datos por usuario');
      return response.json();
    }
  });


  const { data: porDia = [], isLoading: isLoadingDia } = useQuery<GastosByDia[]>({
    queryKey: ['/api/gastos-empresariales/analytics/por-dia', mes, anio, usuarioFilter, diaDesde, diaHasta, vista, vistaValue],
    queryFn: async () => {
      let url = `/api/gastos-empresariales/analytics/por-dia?mes=${mes}&anio=${anio}`;
      if (usuarioFilter !== 'todos') {
        url += `&userId=${usuarioFilter}`;
      }
      url = withVistaParams(url);
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) throw new Error('Error al cargar datos por día');
      return response.json();
    }
  });

  const { data: gastosRecientes = [] } = useQuery<GastoEmpresarial[]>({
    queryKey: ['/api/gastos-empresariales', mes, anio, usuarioFilter, diaDesde, diaHasta, vista, vistaValue],
    queryFn: async () => {
      const { fechaDesde, fechaHasta } = getDateRange(mes, anio);
      let url = `/api/gastos-empresariales?fechaDesde=${fechaDesde}&fechaHasta=${fechaHasta}&limit=500`;
      if (usuarioFilter !== 'todos') {
        url += `&userId=${usuarioFilter}`;
      }
      url = withVistaParams(url);
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) throw new Error('Error al cargar gastos recientes');
      return response.json();
    }
  });

  const { data: fondosData = [] } = useQuery<FundAllocation[]>({
    queryKey: ['/api/fund-allocations', mes, anio, usuarioFilter, diaDesde, diaHasta, vista, vistaValue],
    queryFn: async () => {
      let url = `/api/fund-allocations?limit=500`;
      if (usuarioFilter !== 'todos') {
        url += `&assignedToId=${usuarioFilter}`;
      }
      // Fund allocations are filtered client-side by date below; vista
      // (segmentCode / centroCostos) is also applied here so that the panel
      // only shows funds matching the active slice.
      if (vista === 'segmento' && vistaValue) {
        url += `&segmentCode=${encodeURIComponent(vistaValue)}`;
      } else if (vista === 'centroCostos' && vistaValue) {
        url += `&centroCostos=${encodeURIComponent(vistaValue)}`;
      }
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) throw new Error('Error al cargar fondos');
      const data = await response.json();
      const { fechaDesde, fechaHasta } = getDateRange(mes, anio);
      const startDate = new Date(fechaDesde);
      const endDate = new Date(fechaHasta);
      endDate.setHours(23, 59, 59, 999);
      return data.filter((f: FundAllocation) => {
        const created = new Date(f.createdAt as any);
        return created >= startDate && created <= endDate;
      });
    }
  });

  const { data: allUsers = [], isLoading: isLoadingUsers } = useQuery<any[]>({
    queryKey: ['/api/users/salespeople'],
  });

  const getUserName = (userId: string | null | undefined): string => {
    if (!userId) return 'Sin asignar';
    const user = allUsers.find((u: any) => u.id === userId);
    if (user) {
      if (user.fullName && user.fullName.trim()) {
        return user.fullName;
      }
      if (user.username) {
        if (user.username.includes('@')) {
          const namePart = user.username.split('@')[0];
          const formatted = namePart
            .replace(/[._]/g, ' ')
            .split(' ')
            .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
          return formatted;
        }
        return user.username;
      }
      return 'Usuario';
    }
    if (userId.includes('@')) {
      const namePart = userId.split('@')[0];
      return namePart
        .replace(/[._]/g, ' ')
        .split(' ')
        .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
    }
    return userId.length > 8 ? userId.substring(0, 8) + '...' : userId;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' });
  };

  const formatFullDate = (dateString: string) => {
    if (!dateString) return '-';
    const match = dateString.match(/^(\d{4})-(\d{2})-(\d{2})/);
    const date = match
      ? new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]))
      : new Date(dateString);
    return date.toLocaleDateString('es-CL', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  /** Monto abreviado para los ticks del eje: "$1,2M", "$450k". */
  const formatCurrencyCorto = (amount: number) => {
    const abs = Math.abs(amount);
    if (abs >= 1_000_000) return `$${(amount / 1_000_000).toLocaleString('es-CL', { maximumFractionDigits: 1 })}M`;
    if (abs >= 1_000) return `$${Math.round(amount / 1_000)}k`;
    return `$${amount}`;
  };

  /**
   * Color estable por categoría: el orden sale del catálogo conocido y, para lo
   * que no esté ahí, del alfabético de las categorías del período. Así una
   * categoría conserva su color aunque cambie el período o el ranking; de la
   * posición 8 en adelante todas van al gris de "Otras".
   */
  const ordenCategorias = (() => {
    const extras = porCategoria
      .map((c) => c.categoria)
      .filter((nombre) => !CATEGORIAS.includes(nombre))
      .sort((a, b) => a.localeCompare(b, 'es'));
    return [...CATEGORIAS, ...extras];
  })();

  const colorCategoria = (categoria: string) => {
    const i = ordenCategorias.indexOf(categoria);
    return i >= 0 && i < PALETA_CATEGORIAS.length ? PALETA_CATEGORIAS[i] : COLOR_OTRAS;
  };

  const statusChartData = {
    labels: ['Pendiente', 'Aprobado', 'Rechazado'],
    datasets: [{
      data: [
        summary?.totalPendiente || 0,
        summary?.totalAprobado || 0,
        summary?.totalRechazado || 0,
      ],
      backgroundColor: [COLOR_ESTADO.pendiente, COLOR_ESTADO.aprobado, COLOR_ESTADO.rechazado],
      // Aro del color de la superficie: separa los segmentos sin dibujar un
      // borde propio, que ensuciaría la lectura de las porciones chicas.
      borderColor: '#ffffff',
      borderWidth: 2,
      hoverOffset: 6,
    }]
  };

  const sortedDia = [...porDia].sort((a, b) => new Date(a.dia).getTime() - new Date(b.dia).getTime());
  const diaChartData = {
    labels: sortedDia.map(d => formatDate(d.dia)),
    datasets: [{
      label: 'Gasto diario',
      data: sortedDia.map(d => d.total),
      borderColor: '#fd6301',
      borderWidth: 2,
      // Degradado vertical bajo la línea: se arma con el contexto del canvas
      // porque su alto depende del área de dibujo, no del componente.
      backgroundColor: (ctx: any) => {
        const { chart } = ctx;
        if (!chart.chartArea) return 'rgba(253, 99, 1, 0.12)';
        const g = chart.ctx.createLinearGradient(0, chart.chartArea.top, 0, chart.chartArea.bottom);
        g.addColorStop(0, 'rgba(253, 99, 1, 0.22)');
        g.addColorStop(1, 'rgba(253, 99, 1, 0)');
        return g;
      },
      fill: true,
      tension: 0.35,
      pointRadius: 0,
      pointHoverRadius: 5,
      pointHoverBackgroundColor: '#fd6301',
      pointHoverBorderColor: '#ffffff',
      pointHoverBorderWidth: 2,
    }]
  };

  /** Tooltip común: oscuro, sin leyenda de color redundante. */
  const tooltipComun = {
    backgroundColor: 'rgba(15, 23, 42, 0.94)',
    padding: 10,
    cornerRadius: 10,
    displayColors: false,
    titleFont: { size: 12, weight: 'bold' as const },
    bodyFont: { size: 12 },
  };

  const pieOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '72%',
    plugins: {
      // La leyenda de estados va como filas con monto al costado del gráfico:
      // dice lo mismo que la de Chart.js y además muestra la plata.
      legend: { display: false },
      datalabels: { display: false },
      tooltip: {
        ...tooltipComun,
        callbacks: {
          label: (ctx: any) => `${ctx.label}: ${formatCurrency(ctx.parsed || 0)}`,
        },
      },
    },
  };

  const lineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index' as const, intersect: false },
    plugins: {
      legend: { display: false },
      datalabels: { display: false },
      tooltip: {
        ...tooltipComun,
        callbacks: {
          label: (ctx: any) => formatCurrency(ctx.parsed.y || 0),
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        border: { display: false },
        ticks: { color: TINTA_EJE, font: { size: 11 }, maxRotation: 0, autoSkipPadding: 16 },
      },
      y: {
        beginAtZero: true,
        grid: { color: TINTA_GRILLA },
        border: { display: false },
        ticks: {
          color: TINTA_EJE,
          font: { size: 11 },
          maxTicksLimit: 5,
          callback: (value: any) => formatCurrencyCorto(Number(value)),
        },
      },
    },
  };

  // Función para obtener gastos filtrados (reutilizable)
  const getFilteredGastos = () => {
    return gastosRecientes.filter(gasto => {
      const matchEstado = estadoFilter === 'todos' || gasto.estado === estadoFilter;
      const matchCategoria = categoriaFilter === 'todos' || gasto.categoria === categoriaFilter;
      // Apply day range filter client-side if set
      let matchDate = true;
      if (diaDesde || diaHasta) {
        const gastoDate = (gasto.fechaEmision || (gasto.createdAt as string) || '').substring(0, 10);
        if (diaDesde && gastoDate < diaDesde) matchDate = false;
        if (diaHasta && gastoDate > diaHasta) matchDate = false;
      }
      return matchEstado && matchCategoria && matchDate;
    });
  };

  const handleExportCSV = () => {
    const gastosParaExportar = getFilteredGastos();
    if (gastosParaExportar.length === 0) return;

    const excelData = gastosParaExportar.map(g => ({
      'Fecha': formatFullDate((g.fechaEmision || g.createdAt) as any),
      'Descripción': g.descripcion,
      'Categoría': g.categoria,
      'Monto': Number(g.monto) || 0,
      'Estado': g.estado,
      'Proveedor': g.proveedor || '-',
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(excelData);
    ws['!cols'] = [
      { wch: 14 }, // Fecha
      { wch: 35 }, // Descripción
      { wch: 18 }, // Categoría
      { wch: 14 }, // Monto
      { wch: 12 }, // Estado
      { wch: 25 }, // Proveedor
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'Gastos');

    // Build filename with filters
    let fileName = `gastos_${anio}_${mes}`;
    if (diaDesde || diaHasta) fileName += `_${diaDesde || 'inicio'}_a_${diaHasta || 'fin'}`;
    if (estadoFilter !== 'todos') fileName += `_${estadoFilter}`;
    if (categoriaFilter !== 'todos') fileName += `_${categoriaFilter.replace(/\s+/g, '_')}`;

    XLSX.writeFile(wb, `${fileName}.xlsx`);
  };

  const renderChartToImage = (chartData: any, chartType: 'pie' | 'bar' | 'doughnut', width: number, height: number): Promise<string> => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const scale = 2; // Reduced from 4 to optimize PDF size
      canvas.width = width * scale;
      canvas.height = height * scale;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(''); return; }

      ctx.scale(scale, scale);

      const chartConfig: any = {
        type: chartType,
        data: chartData,
        options: {
          responsive: false,
          animation: false,
          devicePixelRatio: scale,
          plugins: {
            legend: { display: chartType !== 'bar', position: 'right', labels: { font: { size: 14, weight: 'bold' } } },
            datalabels: { display: false }
          },
          scales: chartType === 'bar' ? {
            y: { beginAtZero: true, ticks: { font: { size: 12 } } },
            x: { ticks: { font: { size: 12 } } }
          } : undefined
        }
      };

      const chart = new ChartJS(ctx, chartConfig);
      setTimeout(() => {
        const imgData = canvas.toDataURL('image/png', 1.0);
        chart.destroy();
        resolve(imgData);
      }, 150);
    });
  };

  const handleExportPDF = async () => {
    const gastosParaExportar = getFilteredGastos();
    if (gastosParaExportar.length === 0 && fondosData.length === 0) return;

    setIsGeneratingPDF(true);
    try {
      // Enable compression to significantly reduce PDF file size
      const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4', compress: true });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 15;
      let yPos = margin;

      const monthName = months.find(m => m.value === mes)?.label || mes;

      const primaryColor: [number, number, number] = [29, 78, 216];
      const successColor: [number, number, number] = [22, 163, 74];
      const warningColor: [number, number, number] = [245, 158, 11];
      const dangerColor: [number, number, number] = [220, 38, 38];
      const grayLight: [number, number, number] = [248, 250, 252];
      const grayDark: [number, number, number] = [71, 85, 105];

      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.rect(0, 0, pageWidth, 45, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      doc.text('Reporte de Rendición de Gastos', pageWidth / 2, 18, { align: 'center' });

      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      const periodoText = (diaDesde || diaHasta)
        ? `Período: ${diaDesde || 'Inicio'} a ${diaHasta || 'Fin'}`
        : `Período: ${monthName} ${anio}`;
      doc.text(periodoText, pageWidth / 2, 28, { align: 'center' });

      const filtrosAplicados: string[] = [];
      if (estadoFilter !== 'todos') filtrosAplicados.push(`Estado: ${estadoFilter}`);
      if (categoriaFilter !== 'todos') filtrosAplicados.push(`Categoría: ${categoriaFilter}`);
      if (usuarioFilter !== 'todos') {
        const usuarioData = porUsuario.find((u: any) => u.userId === usuarioFilter);
        const nombreVendedor = usuarioData?.userName || getUserName(usuarioFilter);
        filtrosAplicados.push(`Vendedor: ${nombreVendedor}`);
      }

      doc.setFontSize(10);
      if (filtrosAplicados.length > 0) {
        doc.text(`Filtros: ${filtrosAplicados.join(' | ')}`, pageWidth / 2, 36, { align: 'center' });
      } else {
        doc.text(`Generado: ${new Date().toLocaleDateString('es-CL')}`, pageWidth / 2, 36, { align: 'center' });
      }

      yPos = 55;
      doc.setTextColor(0, 0, 0);

      if (summary) {
        const cardWidth = (pageWidth - margin * 2 - 15) / 4;
        const cardHeight = 28;
        const cardY = yPos;

        const kpis = [
          { label: 'Total Gastos', value: formatCurrency(summary.total), subtext: `${summary.count} registros`, color: primaryColor },
          { label: 'Aprobados', value: formatCurrency(summary.totalAprobado), subtext: '', color: successColor },
          { label: 'Pendientes', value: formatCurrency(summary.totalPendiente), subtext: '', color: warningColor },
          { label: 'Rechazados', value: formatCurrency(summary.totalRechazado), subtext: '', color: dangerColor },
        ];

        kpis.forEach((kpi, i) => {
          const cardX = margin + i * (cardWidth + 5);

          doc.setFillColor(grayLight[0], grayLight[1], grayLight[2]);
          doc.roundedRect(cardX, cardY, cardWidth, cardHeight, 3, 3, 'F');

          doc.setFillColor(kpi.color[0], kpi.color[1], kpi.color[2]);
          doc.rect(cardX, cardY, 3, cardHeight, 'F');

          doc.setFontSize(8);
          doc.setTextColor(grayDark[0], grayDark[1], grayDark[2]);
          doc.setFont('helvetica', 'normal');
          doc.text(kpi.label.toUpperCase(), cardX + 7, cardY + 8);

          doc.setFontSize(13);
          doc.setTextColor(kpi.color[0], kpi.color[1], kpi.color[2]);
          doc.setFont('helvetica', 'bold');
          doc.text(kpi.value, cardX + 7, cardY + 18);

          if (kpi.subtext) {
            doc.setFontSize(7);
            doc.setTextColor(grayDark[0], grayDark[1], grayDark[2]);
            doc.setFont('helvetica', 'normal');
            doc.text(kpi.subtext, cardX + 7, cardY + 24);
          }
        });

        yPos = cardY + cardHeight + 12;
      }

      doc.setTextColor(0, 0, 0);

      if (porCategoria.length > 0 && summary && summary.count > 0) {
        const chartWidth = 80;
        const chartHeight = 55;

        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text('Distribución por Categoría', margin, yPos);
        doc.text('Distribución por Estado', pageWidth / 2 + 10, yPos);
        yPos += 5;

        try {
          const pieData = {
            labels: porCategoria.map(c => c.categoria),
            datasets: [{
              // Mismos colores que en pantalla, para que el PDF no cuente otra
              // historia que el dashboard del que salió.
              data: porCategoria.map(c => c.total),
              backgroundColor: porCategoria.map(c => colorCategoria(c.categoria)),
              borderWidth: 1
            }]
          };
          const pieImg = await renderChartToImage(pieData, 'doughnut', chartWidth * 3, chartHeight * 3);
          if (pieImg) {
            doc.addImage(pieImg, 'PNG', margin, yPos, chartWidth, chartHeight);
          }

          const estadosData = {
            labels: ['Aprobado', 'Pendiente', 'Rechazado'],
            datasets: [{
              label: 'Monto',
              data: [summary.totalAprobado, summary.totalPendiente, summary.totalRechazado],
              backgroundColor: [COLOR_ESTADO.aprobado, COLOR_ESTADO.pendiente, COLOR_ESTADO.rechazado]
            }]
          };
          const barImg = await renderChartToImage(estadosData, 'bar', chartWidth * 3, chartHeight * 3);
          if (barImg) {
            doc.addImage(barImg, 'PNG', pageWidth / 2 + 10, yPos, chartWidth, chartHeight);
          }
        } catch (e) {
          console.log('Charts could not be rendered:', e);
        }

        yPos += chartHeight + 10;
      }

      if (fondosData.length > 0) {
        if (yPos > pageHeight - 60) {
          doc.addPage();
          yPos = margin;
        }

        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.text('Fondos Asignados', margin, yPos);
        yPos += 2;
        doc.setTextColor(0, 0, 0);

        autoTable(doc, {
          startY: yPos,
          head: [['Fecha Inicio', 'Fecha Término', 'Monto', 'Estado', 'Asignado Por']],
          body: fondosData.map(f => [
            formatFullDate(f.fechaInicio || f.createdAt as any),
            formatFullDate(f.fechaTermino || f.createdAt as any),
            formatCurrency(Number(f.montoInicial) || 0),
            f.estado || '-',
            (f as any).assignedByName || getUserName(f.assignedById) || '-'
          ]),
          theme: 'striped',
          headStyles: {
            fillColor: [29, 78, 216],
            textColor: 255,
            fontStyle: 'bold',
            fontSize: 9
          },
          bodyStyles: { fontSize: 8 },
          alternateRowStyles: { fillColor: [248, 250, 252] },
          margin: { left: margin, right: margin },
          tableWidth: 'auto'
        });

        yPos = (doc as any).lastAutoTable.finalY + 10;
      }

      const gastosAprobados = gastosParaExportar.filter(g => g.estado === 'aprobado');
      const gastosRechazados = gastosParaExportar.filter(g => g.estado === 'rechazado');
      const gastosPendientes = gastosParaExportar.filter(g => g.estado === 'pendiente');

      if (gastosAprobados.length > 0) {
        if (yPos > pageHeight - 60) {
          doc.addPage();
          yPos = margin;
        }

        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(successColor[0], successColor[1], successColor[2]);
        doc.text(`Gastos Aprobados (${gastosAprobados.length})`, margin, yPos);
        yPos += 2;
        doc.setTextColor(0, 0, 0);

        autoTable(doc, {
          startY: yPos,
          head: [['Fecha', 'Descripción', 'Categoría', 'Proveedor', 'Monto']],
          body: gastosAprobados.map(g => [
            formatFullDate((g.fechaEmision || g.createdAt) as any),
            String(g.descripcion || '-').substring(0, 35),
            g.categoria || '-',
            String(g.proveedor || '-').substring(0, 20),
            formatCurrency(Number(g.monto) || 0)
          ]),
          theme: 'striped',
          headStyles: {
            fillColor: [22, 163, 74],
            textColor: 255,
            fontStyle: 'bold',
            fontSize: 9
          },
          bodyStyles: { fontSize: 8 },
          alternateRowStyles: { fillColor: [240, 253, 244] },
          columnStyles: {
            0: { cellWidth: 28 },
            1: { cellWidth: 55 },
            2: { cellWidth: 30 },
            3: { cellWidth: 40 },
            4: { cellWidth: 27, halign: 'right' }
          },
          margin: { left: margin, right: margin }
        });

        yPos = (doc as any).lastAutoTable.finalY + 10;
      }

      if (gastosRechazados.length > 0) {
        if (yPos > pageHeight - 60) {
          doc.addPage();
          yPos = margin;
        }

        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(dangerColor[0], dangerColor[1], dangerColor[2]);
        doc.text(`Gastos Rechazados (${gastosRechazados.length})`, margin, yPos);
        yPos += 2;
        doc.setTextColor(0, 0, 0);

        autoTable(doc, {
          startY: yPos,
          head: [['Fecha', 'Descripción', 'Categoría', 'Proveedor', 'Monto']],
          body: gastosRechazados.map(g => [
            formatFullDate((g.fechaEmision || g.createdAt) as any),
            String(g.descripcion || '-').substring(0, 35),
            g.categoria || '-',
            String(g.proveedor || '-').substring(0, 20),
            formatCurrency(Number(g.monto) || 0)
          ]),
          theme: 'striped',
          headStyles: {
            fillColor: [220, 38, 38],
            textColor: 255,
            fontStyle: 'bold',
            fontSize: 9
          },
          bodyStyles: { fontSize: 8 },
          alternateRowStyles: { fillColor: [254, 242, 242] },
          columnStyles: {
            0: { cellWidth: 28 },
            1: { cellWidth: 55 },
            2: { cellWidth: 30 },
            3: { cellWidth: 40 },
            4: { cellWidth: 27, halign: 'right' }
          },
          margin: { left: margin, right: margin }
        });

        yPos = (doc as any).lastAutoTable.finalY + 10;
      }

      if (gastosPendientes.length > 0) {
        if (yPos > pageHeight - 60) {
          doc.addPage();
          yPos = margin;
        }

        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(warningColor[0], warningColor[1], warningColor[2]);
        doc.text(`Gastos Pendientes (${gastosPendientes.length})`, margin, yPos);
        yPos += 2;
        doc.setTextColor(0, 0, 0);

        autoTable(doc, {
          startY: yPos,
          head: [['Fecha', 'Descripción', 'Categoría', 'Proveedor', 'Monto']],
          body: gastosPendientes.map(g => [
            formatFullDate((g.fechaEmision || g.createdAt) as any),
            String(g.descripcion || '-').substring(0, 35),
            g.categoria || '-',
            String(g.proveedor || '-').substring(0, 20),
            formatCurrency(Number(g.monto) || 0)
          ]),
          theme: 'striped',
          headStyles: {
            fillColor: [245, 158, 11],
            textColor: 255,
            fontStyle: 'bold',
            fontSize: 9
          },
          bodyStyles: { fontSize: 8 },
          alternateRowStyles: { fillColor: [255, 251, 235] },
          columnStyles: {
            0: { cellWidth: 28 },
            1: { cellWidth: 55 },
            2: { cellWidth: 30 },
            3: { cellWidth: 40 },
            4: { cellWidth: 27, halign: 'right' }
          },
          margin: { left: margin, right: margin }
        });

        yPos = (doc as any).lastAutoTable.finalY + 10;
      }

      interface ImageInfo {
        url: string;
        previewUrl?: string | null;
        type: 'gasto' | 'fondo';
        vendedor: string;
        monto: string;
        fecha: string;
        fechaInicio?: string;
        fechaTermino?: string;
        financiamiento: string;
        descripcion?: string;
        categoria?: string;
        tipoDocumento?: string;
        proveedor?: string;
        estado?: string;
        tipoFondo?: string;
        ruta?: string;
        clientes?: string;
        ciudad?: string;
      }

      const allImages: ImageInfo[] = [];

      for (const fondo of fondosData) {
        if (fondo.comprobanteUrl) {
          const fechaInicio = fondo.fechaInicio ? formatFullDate(fondo.fechaInicio) : '-';
          const fechaTermino = fondo.fechaTermino ? formatFullDate(fondo.fechaTermino) : '-';
          allImages.push({
            url: fondo.comprobanteUrl,
            previewUrl: (fondo as any).comprobantePreviewUrl || null,
            type: 'fondo',
            vendedor: getUserName(fondo.assignedToId || ''),
            monto: formatCurrency(Number(fondo.montoInicial) || 0),
            fecha: '',
            fechaInicio: fechaInicio,
            fechaTermino: fechaTermino,
            financiamiento: 'Fondo Asignado',
            tipoFondo: fondo.fundType || 'General',
            estado: fondo.estado || '-',
            descripcion: fondo.descripcion || fondo.motivo || '-',
          });
        }
      }

      for (const gasto of gastosParaExportar) {
        // Primero añadir el documento adjunto del gasto (factura/boleta)
        if ((gasto as any).archivoUrl) {
          const esConFondo = gasto.fundingMode === 'con_fondo';
          allImages.push({
            url: (gasto as any).archivoUrl,
            previewUrl: null, // archivoUrl no tiene preview separado
            type: 'gasto',
            vendedor: getUserName(gasto.userId),
            monto: formatCurrency(Number(gasto.monto) || 0),
            fecha: formatFullDate((gasto.fechaEmision || gasto.createdAt) as any),
            financiamiento: esConFondo ? 'Con Fondo Asignado' : 'Restitución/Reembolso',
            descripcion: gasto.descripcion || '-',
            categoria: gasto.categoria || '-',
            tipoDocumento: gasto.tipoDocumento || 'Documento Adjunto',
            proveedor: gasto.proveedor || '-',
            estado: gasto.estado || '-',
            ruta: (gasto as any).ruta || '-',
            clientes: (gasto as any).clientes || '-',
            ciudad: (gasto as any).ciudad || '-',
          });
        }
        if (gasto.comprobanteUrl && gasto.comprobanteUrl !== (gasto as any).archivoUrl) {
          const esConFondo = gasto.fundingMode === 'con_fondo';
          allImages.push({
            url: gasto.comprobanteUrl,
            previewUrl: (gasto as any).comprobantePreviewUrl || null,
            type: 'gasto',
            vendedor: getUserName(gasto.userId),
            monto: formatCurrency(Number(gasto.monto) || 0),
            fecha: formatFullDate((gasto.fechaEmision || gasto.createdAt) as any),
            financiamiento: esConFondo ? 'Comprobante Transferencia (Fondo)' : 'Comprobante Transferencia (Reembolso)',
            descripcion: gasto.descripcion || '-',
            categoria: gasto.categoria || '-',
            tipoDocumento: 'Comprobante de Pago',
            proveedor: gasto.proveedor || '-',
            estado: gasto.estado || '-',
            ruta: (gasto as any).ruta || '-',
            clientes: (gasto as any).clientes || '-',
            ciudad: (gasto as any).ciudad || '-',
          });
        }
      }

      // Parche: Reemplazar dominios antiguos de Supabase por el nuevo para asegurar que carguen las imagenes
      for (let i = 0; i < allImages.length; i++) {
        if (allImages[i].url) {
          allImages[i].url = allImages[i].url.replace(/https?:\/\/[a-zA-Z0-9-]+\.supabase\.co/i, 'https://xyqnvkievatlsqestjuf.supabase.co');
        }
        if (allImages[i].previewUrl) {
          allImages[i].previewUrl = allImages[i].previewUrl.replace(/https?:\/\/[a-zA-Z0-9-]+\.supabase\.co/i, 'https://xyqnvkievatlsqestjuf.supabase.co');
        }
      }

      let imageErrors = 0;
      if (allImages.length > 0) {
        doc.addPage();
        yPos = margin;

        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Comprobantes Adjuntos', pageWidth / 2, yPos, { align: 'center' });
        yPos += 15;

        const infoColumnWidth = 75;
        const gapBetweenColumns = 8;
        const imageColumnStart = margin + infoColumnWidth + gapBetweenColumns;
        const imageMaxWidth = pageWidth - imageColumnStart - margin;

        // Pre-fetch all images in parallel batches (max 5 at a time) for speed
        const PER_IMAGE_TIMEOUT = 12000; // 12s per image — fast fail to keep PDF generation snappy
        const BATCH_SIZE = 5;
        type PreloadedImage = { base64: string; width: number; height: number } | null;
        const preloadedImages: PreloadedImage[] = new Array(allImages.length).fill(null);

        const preloadSingleImage = async (img: ImageInfo, index: number): Promise<void> => {
          try {
            const isPDF = img.url.toLowerCase().endsWith('.pdf');
            let result: PreloadedImage = null;

            if (isPDF) {
              // Try preview image first
              const previewPath = img.previewUrl || img.url.replace(/\.pdf$/i, '_preview.png');
              const previewUrl = previewPath.startsWith('http')
                ? previewPath
                : `${window.location.origin}${previewPath}`;

              try {
                const previewBlob = await fetchFileBlob(previewUrl);
                if (previewBlob.type.startsWith('image/')) {
                  const objUrl = URL.createObjectURL(previewBlob);
                  try {
                    const imgObj = await loadImageElement(objUrl, 10000);
                    const compressed = compressImageToJpeg(imgObj, 500, 0.4);
                    if (compressed) {
                      result = { base64: compressed, width: imgObj.naturalWidth > 600 ? 600 : imgObj.naturalWidth, height: imgObj.naturalHeight * ((imgObj.naturalWidth > 600 ? 600 : imgObj.naturalWidth) / imgObj.naturalWidth) };
                    }
                  } finally {
                    URL.revokeObjectURL(objUrl);
                  }
                }
              } catch {}

              // Fallback: render PDF first page client-side
              if (!result) {
                const pdfAbsoluteUrl = img.url.startsWith('http') ? img.url : `${window.location.origin}${img.url}`;
                const pdfImage = await pdfToImage(pdfAbsoluteUrl, 300);
                if (pdfImage) {
                  const imgObj = await loadImageElement(pdfImage, 10000);
                  result = { base64: pdfImage, width: imgObj.naturalWidth, height: imgObj.naturalHeight };
                }
              }
            } else {
              // Regular image
              const { base64 } = await loadImageForPdf(img.url, 1);
              const imgObj = await loadImageElement(base64, 10000);
              result = { base64, width: imgObj.naturalWidth, height: imgObj.naturalHeight };
            }

            preloadedImages[index] = result;
          } catch (e) {
            console.warn(`[PDF] Preload failed for image ${index}:`, img.url.substring(0, 60), e);
            preloadedImages[index] = null;
          }
        };

        // Phase 1: Process in parallel batches (fast)
        for (let batchStart = 0; batchStart < allImages.length; batchStart += BATCH_SIZE) {
          const batch = allImages.slice(batchStart, batchStart + BATCH_SIZE);
          await Promise.allSettled(
            batch.map((img, i) => {
              const isPdf = img.url.toLowerCase().endsWith('.pdf');
              const timeout = isPdf ? 20000 : PER_IMAGE_TIMEOUT; // PDFs need more time
              return withTimeout(
                preloadSingleImage(img, batchStart + i),
                timeout,
                `img-${batchStart + i}`
              ).catch(() => { preloadedImages[batchStart + i] = null; });
            })
          );
        }

        // Phase 2: Sequential retry for failed images — limited to 3 to keep it fast
        const failedIndices = preloadedImages.map((p, i) => p === null ? i : -1).filter(i => i >= 0);
        if (failedIndices.length > 0 && failedIndices.length <= 5) {
          const retrySlice = failedIndices.slice(0, 3);
          console.log(`[PDF] ${failedIndices.length} images failed, retrying ${retrySlice.length} sequentially...`);
          for (const idx of retrySlice) {
            try {
              await preloadSingleImage(allImages[idx], idx);
              if (preloadedImages[idx]) {
                console.log(`[PDF] ✅ Retry succeeded for image ${idx}`);
              }
            } catch (e) {
              console.warn(`[PDF] ❌ Final retry also failed for image ${idx}:`, e);
            }
          }
        } else if (failedIndices.length > 5) {
          console.warn(`[PDF] ${failedIndices.length} images failed — skipping retries (likely network issue)`);
        }

        // Now render all images into the PDF (fast — no network calls)
        for (let idx = 0; idx < allImages.length; idx++) {
          const img = allImages[idx];
          const preloaded = preloadedImages[idx];
          const isPDF = img.url.toLowerCase().endsWith('.pdf');
          const sectionHeight = img.type === 'fondo' ? 102 : 120;

          if (yPos + sectionHeight > pageHeight - 20) {
            doc.addPage();
            yPos = margin;
          }

          const sectionStartY = yPos;

          doc.setDrawColor(229, 231, 235);
          doc.setFillColor(255, 255, 255);
          doc.roundedRect(margin, yPos - 3, infoColumnWidth, sectionHeight, 3, 3, 'FD');

          const tipoLabel = img.type === 'fondo' ? 'COMPROBANTE DE FONDO' : 'COMPROBANTE DE GASTO';
          const headerColor = img.type === 'fondo' ? [22, 163, 74] : [59, 130, 246];
          doc.setFillColor(headerColor[0], headerColor[1], headerColor[2]);
          doc.roundedRect(margin, yPos - 3, infoColumnWidth, 10, 3, 3, 'F');
          doc.rect(margin, yPos + 4, infoColumnWidth, 3, 'F');

          doc.setFontSize(9);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(255, 255, 255);
          doc.text(tipoLabel, margin + infoColumnWidth / 2, yPos + 3, { align: 'center' });
          doc.setTextColor(0, 0, 0);
          yPos += 14;

          const labelX = margin + 4;
          const valueX = margin + 28;
          const lineHeight = 6.5;

          doc.setFontSize(8);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(100, 116, 139);
          doc.text('Vendedor', labelX, yPos);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(15, 23, 42);
          doc.text(String(img.vendedor).substring(0, 22), valueX, yPos);
          yPos += lineHeight;

          doc.setFont('helvetica', 'bold');
          doc.setTextColor(100, 116, 139);
          doc.text('Monto', labelX, yPos);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(22, 163, 74);
          doc.text(img.monto, valueX, yPos);
          yPos += lineHeight;

          if (img.type === 'fondo' && img.fechaInicio && img.fechaTermino) {
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(100, 116, 139);
            doc.text('F. Inicio', labelX, yPos);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(15, 23, 42);
            doc.text(img.fechaInicio, valueX, yPos);
            yPos += lineHeight;

            doc.setFont('helvetica', 'bold');
            doc.setTextColor(100, 116, 139);
            doc.text('F. Término', labelX, yPos);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(15, 23, 42);
            doc.text(img.fechaTermino, valueX, yPos);
            yPos += lineHeight;
          } else {
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(100, 116, 139);
            doc.text('Fecha', labelX, yPos);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(15, 23, 42);
            doc.text(img.fecha, valueX, yPos);
            yPos += lineHeight;
          }

          doc.setFont('helvetica', 'bold');
          doc.setTextColor(100, 116, 139);
          doc.text('Tipo', labelX, yPos);
          doc.setFont('helvetica', 'normal');
          const financColor = img.financiamiento.includes('Fondo') ? [22, 163, 74] : [234, 88, 12];
          doc.setTextColor(financColor[0], financColor[1], financColor[2]);
          doc.text(img.financiamiento, valueX, yPos);
          doc.setTextColor(0, 0, 0);
          yPos += lineHeight;

          if (img.type === 'gasto') {
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(100, 116, 139);
            doc.text('Categoría', labelX, yPos);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(15, 23, 42);
            doc.text(String(img.categoria || '-').substring(0, 18), valueX, yPos);
            yPos += lineHeight;

            doc.setFont('helvetica', 'bold');
            doc.setTextColor(100, 116, 139);
            doc.text('Documento', labelX, yPos);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(15, 23, 42);
            doc.text(String(img.tipoDocumento || '-').substring(0, 16), valueX, yPos);
            yPos += lineHeight;

            if (img.proveedor && img.proveedor !== '-') {
              doc.setFont('helvetica', 'bold');
              doc.setTextColor(100, 116, 139);
              doc.text('Proveedor', labelX, yPos);
              doc.setFont('helvetica', 'normal');
              doc.setTextColor(15, 23, 42);
              doc.text(String(img.proveedor).substring(0, 18), valueX, yPos);
              yPos += lineHeight;
            }

            if (img.ruta && img.ruta !== '-') {
              doc.setFont('helvetica', 'bold');
              doc.setTextColor(100, 116, 139);
              doc.text('Ruta', labelX, yPos);
              doc.setFont('helvetica', 'normal');
              doc.setTextColor(15, 23, 42);
              doc.text(String(img.ruta).substring(0, 18), valueX, yPos);
              yPos += lineHeight;
            }

            if (img.clientes && img.clientes !== '-') {
              doc.setFont('helvetica', 'bold');
              doc.setTextColor(100, 116, 139);
              doc.text('Cliente(s)', labelX, yPos);
              doc.setFont('helvetica', 'normal');
              doc.setTextColor(15, 23, 42);
              doc.text(String(img.clientes).substring(0, 18), valueX, yPos);
              yPos += lineHeight;
            }

            if (img.ciudad && img.ciudad !== '-') {
              doc.setFont('helvetica', 'bold');
              doc.setTextColor(100, 116, 139);
              doc.text('Ciudad', labelX, yPos);
              doc.setFont('helvetica', 'normal');
              doc.setTextColor(15, 23, 42);
              doc.text(String(img.ciudad).substring(0, 18), valueX, yPos);
              yPos += lineHeight;
            }
          } else {
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(100, 116, 139);
            doc.text('Tipo Fondo', labelX, yPos);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(15, 23, 42);
            doc.text(String(img.tipoFondo || '-').substring(0, 16), valueX, yPos);
            yPos += lineHeight;

            doc.setFont('helvetica', 'bold');
            doc.setTextColor(100, 116, 139);
            doc.text('Estado', labelX, yPos);
            doc.setFont('helvetica', 'normal');
            const estadoColor = img.estado === 'activo' ? [22, 163, 74] : [220, 38, 38];
            doc.setTextColor(estadoColor[0], estadoColor[1], estadoColor[2]);
            doc.text(String(img.estado || '-').substring(0, 16), valueX, yPos);
            doc.setTextColor(0, 0, 0);
            yPos += lineHeight;
          }

          if (img.descripcion && img.descripcion !== '-') {
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(100, 116, 139);
            doc.text('Nota', labelX, yPos);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(15, 23, 42);
            const notaMaxWidth = infoColumnWidth - 32;
            const notaLines = doc.splitTextToSize(String(img.descripcion), notaMaxWidth);
            const maxLines = Math.min(notaLines.length, 4);
            for (let i = 0; i < maxLines; i++) {
              doc.text(notaLines[i], valueX, yPos + (i * 4));
            }
            yPos += (maxLines - 1) * 4;
          }

          doc.setDrawColor(229, 231, 235);
          doc.setFillColor(249, 250, 251);
          doc.roundedRect(imageColumnStart, sectionStartY - 3, imageMaxWidth, sectionHeight, 3, 3, 'FD');

          const imgYPos = sectionStartY + 5;
          const imgMaxHeight = sectionHeight - 16;

          if (preloaded) {
            // Image was successfully preloaded — render it
            let imgWidth = preloaded.width;
            let imgHeight = preloaded.height;
            if (imgWidth > imageMaxWidth) { const r = imageMaxWidth / imgWidth; imgWidth = imageMaxWidth; imgHeight *= r; }
            if (imgHeight > imgMaxHeight) { const r = imgMaxHeight / imgHeight; imgHeight *= r; imgWidth *= r; }
            doc.addImage(preloaded.base64, 'JPEG', imageColumnStart, imgYPos, imgWidth, imgHeight, undefined, 'FAST');
          } else if (isPDF) {
            // PDF could not be rendered — show text link
            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(0, 0, 0);
            doc.text('Documento PDF:', imageColumnStart, imgYPos);
            doc.setTextColor(0, 0, 255);
            doc.textWithLink('[Ver PDF adjunto]', imageColumnStart, imgYPos + 7, { url: img.url });
            doc.setTextColor(0, 0, 0);
            imageErrors++;
          } else {
            // Regular image failed to load
            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(150, 150, 150);
            doc.text('[Imagen no disponible]', imageColumnStart + 5, imgYPos + 10);
            doc.setTextColor(0, 0, 0);
            imageErrors++;
          }

          yPos = sectionStartY + sectionHeight + 8;
        }
      }

      doc.save(`reporte_gastos_${anio}_${mes}.pdf`);

      if (imageErrors > 0) {
        toast({
          title: "PDF generado con advertencias",
          description: `El reporte se descargó, pero ${imageErrors} imagen${imageErrors > 1 ? 'es' : ''} no ${imageErrors > 1 ? 'pudieron' : 'pudo'} cargarse.`,
          variant: "default",
        });
      } else {
        toast({
          title: "PDF generado",
          description: "El reporte ha sido descargado exitosamente.",
        });
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: "Error al generar PDF",
        description: "Hubo un problema al generar el reporte. Por favor, intente nuevamente.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const months = [
    { value: '1', label: 'Enero' },
    { value: '2', label: 'Febrero' },
    { value: '3', label: 'Marzo' },
    { value: '4', label: 'Abril' },
    { value: '5', label: 'Mayo' },
    { value: '6', label: 'Junio' },
    { value: '7', label: 'Julio' },
    { value: '8', label: 'Agosto' },
    { value: '9', label: 'Septiembre' },
    { value: '10', label: 'Octubre' },
    { value: '11', label: 'Noviembre' },
    { value: '12', label: 'Diciembre' },
  ];

  const hasData = (summary?.count || 0) > 0 || fondosData.length > 0 || gastosRecientes.length > 0;

  useImperativeHandle(ref, () => ({
    handleExportPDF,
    handleExportCSV,
    canExport: !!canExport,
    hasData,
    isGeneratingPDF,
    isLoadingUsers,
  }), [handleExportPDF, handleExportCSV, canExport, hasData, isGeneratingPDF, isLoadingUsers]);

  useEffect(() => {
    if (onReady) onReady();
  }, [canExport, hasData, isGeneratingPDF, isLoadingUsers]);

  // ── Datos derivados de lo que ya trajeron las consultas ───────────────────
  const total = summary?.total || 0;
  const cantidad = summary?.count || 0;
  const promedio = cantidad > 0 ? total / cantidad : 0;
  const porcentaje = (valor: number) => (total > 0 ? Math.round((valor / total) * 100) : 0);

  const estados = [
    { clave: 'aprobado', label: 'Aprobado', monto: summary?.totalAprobado || 0, color: COLOR_ESTADO.aprobado },
    { clave: 'pendiente', label: 'Pendiente', monto: summary?.totalPendiente || 0, color: COLOR_ESTADO.pendiente },
    { clave: 'rechazado', label: 'Rechazado', monto: summary?.totalRechazado || 0, color: COLOR_ESTADO.rechazado },
  ];

  // Ranking de categorías: top 6 y el resto agrupado. Antes se graficaban
  // todas, y con un catálogo largo el gráfico quedaba ilegible.
  const categoriasOrdenadas = [...porCategoria].sort((a, b) => b.total - a.total);
  const restoCategorias = categoriasOrdenadas.slice(6);
  const categoriasVista = [
    ...categoriasOrdenadas.slice(0, 6).map((c) => ({
      nombre: c.categoria,
      total: c.total,
      cantidad: c.cantidad,
      color: colorCategoria(c.categoria),
    })),
    ...(restoCategorias.length > 0
      ? [{
          nombre: `Otras (${restoCategorias.length})`,
          total: restoCategorias.reduce((acc, c) => acc + c.total, 0),
          cantidad: restoCategorias.reduce((acc, c) => acc + c.cantidad, 0),
          color: COLOR_OTRAS,
        }]
      : []),
  ];
  const maxCategoria = Math.max(...categoriasVista.map((c) => c.total), 1);

  const usuariosTop = [...porUsuario].sort((a, b) => b.total - a.total).slice(0, 6);
  const maxUsuario = Math.max(...usuariosTop.map((u) => u.total), 1);

  const ultimosGastos = [...gastosRecientes]
    .sort((a, b) => {
      const fa = new Date((a.fechaEmision || a.createdAt) as any).getTime();
      const fb = new Date((b.fechaEmision || b.createdAt) as any).getTime();
      return fb - fa;
    })
    .slice(0, 6);

  return (
    <div className={embedded ? "space-y-4 md:space-y-5" : "space-y-4 p-4 sm:p-6 md:space-y-5 lg:p-8"}>
      {!embedded && (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Button
              variant="ghost"
              onClick={() => setLocation('/gastos-empresariales')}
              className="mb-2 rounded-2xl"
              data-testid="button-back"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver
            </Button>
            <h1 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-100 sm:text-3xl">
              Dashboard de Rendición de Gastos
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Análisis y métricas de gastos empresariales
            </p>
          </div>
          {canExport && (
            <div className="flex gap-2">
              <Button
                onClick={handleExportPDF}
                variant="default"
                disabled={!hasData || isGeneratingPDF || isLoadingUsers}
                title={isLoadingUsers ? 'Cargando datos de usuarios...' : undefined}
                data-testid="button-export-pdf"
              >
                {isGeneratingPDF || isLoadingUsers ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <FileText className="h-4 w-4 mr-2" />
                )}
                {isGeneratingPDF ? 'Generando...' : isLoadingUsers ? 'Cargando...' : 'Exportar PDF'}
              </Button>
              <Button
                onClick={handleExportCSV}
                variant="outline"
                disabled={!hasData}
                data-testid="button-export-csv"
              >
                <Download className="h-4 w-4 mr-2" />
                Exportar Excel
              </Button>
            </div>
          )}
        </div>
      )}


      {/* ── Indicadores del período ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        {isLoadingSummary ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[104px] rounded-2xl" />
          ))
        ) : (
          <>
            <KpiCard
              label="Total del período"
              value={formatoMoneda(total)}
              sub={`${cantidad} registro${cantidad !== 1 ? 's' : ''} · promedio ${formatoMoneda(promedio)}`}
              tono="marca"
              icono={TrendingUp}
              testId="text-total-gastos"
            />
            <KpiCard
              label="Por aprobar"
              value={formatoMoneda(summary?.totalPendiente || 0)}
              sub={`${porcentaje(summary?.totalPendiente || 0)}% del período`}
              tono="alerta"
              icono={Clock}
              testId="text-total-pendiente"
            />
            <KpiCard
              label="Aprobado"
              value={formatoMoneda(summary?.totalAprobado || 0)}
              sub={`${porcentaje(summary?.totalAprobado || 0)}% del período`}
              tono="ok"
              icono={CheckCircle}
              testId="text-total-aprobado"
            />
            <KpiCard
              label="Rechazado"
              value={formatoMoneda(summary?.totalRechazado || 0)}
              sub={`${porcentaje(summary?.totalRechazado || 0)}% del período`}
              tono="error"
              icono={XCircle}
              testId="text-total-rechazado"
            />
          </>
        )}
      </div>

      {!hasData ? (
        <EstadoVacio
          icono={Receipt}
          titulo="No hay gastos en este período"
          descripcion="Ajusta el período o el colaborador en los filtros de arriba, o carga uno nuevo desde la pestaña Añadir Gasto."
        />
      ) : (
        <>
          {/* ── Composición y evolución ────────────────────────────────── */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <section className={cn(SUPERFICIE, 'p-4 md:p-5')}>
              <TituloTarjeta icono={PieChartIcon} titulo="Distribución por estado" />
              <div className="relative mt-4 h-[180px]">
                <Doughnut data={statusChartData} options={pieOptions} />
                {/* El total va al centro del anillo: es el número que se busca
                    primero y evita tener que sumar las tres porciones. */}
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Total
                  </span>
                  <span className="text-lg font-bold tabular-nums text-slate-800 dark:text-slate-100">
                    {formatoMoneda(total)}
                  </span>
                </div>
              </div>
              <ul className="mt-4 space-y-2.5">
                {estados.map((e) => (
                  <li key={e.clave} className="flex items-center gap-2.5">
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: e.color }}
                      aria-hidden
                    />
                    <span className="flex-1 truncate text-sm text-slate-600 dark:text-slate-300">
                      {e.label}
                    </span>
                    <span className="text-sm font-semibold tabular-nums text-slate-800 dark:text-slate-100">
                      {formatoMoneda(e.monto)}
                    </span>
                    <span className="w-10 text-right text-xs tabular-nums text-slate-400">
                      {porcentaje(e.monto)}%
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            <section className={cn(SUPERFICIE, 'p-4 md:p-5 lg:col-span-2')}>
              <TituloTarjeta
                icono={Calendar}
                titulo="Evolución del período"
                extra={
                  sortedDia.length > 0 ? (
                    <span className="text-xs text-slate-400">
                      Máximo diario {formatoMoneda(Math.max(...sortedDia.map((d) => d.total)))}
                    </span>
                  ) : undefined
                }
              />
              <div className="mt-4 h-[280px]">
                {isLoadingDia ? (
                  <Skeleton className="h-full w-full rounded-xl" />
                ) : porDia.length > 0 ? (
                  <Line data={diaChartData} options={lineOptions} />
                ) : (
                  <p className="flex h-full items-center justify-center text-sm text-slate-400">
                    Sin movimientos en el período
                  </p>
                )}
              </div>
            </section>
          </div>

          {/* ── Rankings ───────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <section className={cn(SUPERFICIE, 'p-4 md:p-5')}>
              <TituloTarjeta icono={BarChart3} titulo="Gastos por categoría" />
              {isLoadingCategoria ? (
                <div className="mt-4 space-y-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 rounded-xl" />
                  ))}
                </div>
              ) : categoriasVista.length > 0 ? (
                <ul className="mt-4 space-y-3.5">
                  {categoriasVista.map((c) => (
                    <li key={c.nombre} className="space-y-1.5">
                      <div className="flex items-baseline gap-2.5">
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-700 dark:text-slate-200">
                          {c.nombre}
                        </span>
                        <span className="text-sm font-semibold tabular-nums text-slate-800 dark:text-slate-100">
                          {formatoMoneda(c.total)}
                        </span>
                        <span className="w-10 text-right text-xs tabular-nums text-slate-400">
                          {porcentaje(c.total)}%
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.max((c.total / maxCategoria) * 100, 2)}%`,
                            backgroundColor: c.color,
                          }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="py-10 text-center text-sm text-slate-400">Sin datos por categoría</p>
              )}
            </section>

            {user?.role !== 'salesperson' && (
              <section className={cn(SUPERFICIE, 'p-4 md:p-5')}>
                <TituloTarjeta icono={Users} titulo="Quiénes gastan más" />
                {isLoadingUsuario ? (
                  <div className="mt-4 space-y-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <Skeleton key={i} className="h-10 rounded-xl" />
                    ))}
                  </div>
                ) : usuariosTop.length > 0 ? (
                  <ul className="mt-4 space-y-3.5">
                    {usuariosTop.map((u, i) => (
                      <li key={u.userId} className="space-y-1.5">
                        <div className="flex items-baseline gap-2.5">
                          <span className="w-4 shrink-0 text-xs font-bold tabular-nums text-slate-300 dark:text-slate-600">
                            {i + 1}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-700 dark:text-slate-200">
                            {u.userName}
                          </span>
                          <span className="text-sm font-semibold tabular-nums text-slate-800 dark:text-slate-100">
                            {formatoMoneda(u.total)}
                          </span>
                          <span className="w-16 text-right text-xs tabular-nums text-slate-400">
                            {u.cantidad} gasto{u.cantidad !== 1 ? 's' : ''}
                          </span>
                        </div>
                        {/* Una sola serie: un solo tono, el largo lleva la magnitud. */}
                        <div className="ml-6 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                          <div
                            className="h-full rounded-full bg-[#fd6301] transition-all"
                            style={{ width: `${Math.max((u.total / maxUsuario) * 100, 2)}%` }}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="py-10 text-center text-sm text-slate-400">Sin datos por colaborador</p>
                )}
              </section>
            )}
          </div>

          {/* ── Últimos movimientos ────────────────────────────────────── */}
          {ultimosGastos.length > 0 && (
            <section className={cn(SUPERFICIE, 'p-4 md:p-5')}>
              <TituloTarjeta
                icono={Receipt}
                titulo="Últimos gastos cargados"
                extra={
                  <span className="text-xs text-slate-400">
                    {gastosRecientes.length} en el período
                  </span>
                }
              />
              <ul className="mt-2 divide-y divide-slate-100 dark:divide-slate-800">
                {ultimosGastos.map((g) => (
                  <li key={g.id} className="flex items-center gap-3 py-3">
                    <CategoriaIcono categoria={g.categoria} className="size-9" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">
                        {g.descripcion}
                      </p>
                      <p className="truncate text-xs text-slate-400">
                        {formatFullDate((g.fechaEmision || g.createdAt) as any)} · {g.categoria}
                        {user?.role !== 'salesperson' ? ` · ${getUserName(g.userId)}` : ''}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="text-sm font-semibold tabular-nums text-slate-800 dark:text-slate-100">
                        {formatoMoneda(g.monto)}
                      </span>
                      <EstadoChip estado={(g as any).estadoAprobacion || g.estado} />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
});

export default GastosEmpresarialesDashboard;
