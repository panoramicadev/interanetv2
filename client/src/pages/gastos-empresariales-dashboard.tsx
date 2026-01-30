import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  ArrowLeft, 
  TrendingUp, 
  DollarSign, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Download,
  FileSpreadsheet,
  Filter,
  BarChart3,
  PieChart as PieChartIcon,
  Calendar,
  Users,
  FolderOpen,
  FileText,
  Loader2
} from "lucide-react";
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
import { Bar, Pie, Doughnut, Line } from 'react-chartjs-2';
import type { GastoEmpresarial, FundAllocation } from "@shared/schema";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useToast } from "@/hooks/use-toast";
import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

// Function to convert first page of PDF to base64 image
async function pdfToImage(pdfUrl: string, width: number = 400): Promise<string | null> {
  try {
    // Fetch PDF as ArrayBuffer to handle CORS properly
    const response = await fetch(pdfUrl, { credentials: 'include' });
    if (!response.ok) {
      console.error('Failed to fetch PDF:', response.status);
      return null;
    }
    const arrayBuffer = await response.arrayBuffer();
    
    // Load PDF from ArrayBuffer data
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
    
    await page.render({
      canvasContext: context,
      viewport: scaledViewport
    }).promise;
    
    return canvas.toDataURL('image/png');
  } catch (error) {
    console.error('Error converting PDF to image:', error);
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
  "Colación",
  "Gestión Ventas",
  "Transporte",
  "Materiales",
  "Servicios",
  "Otros"
];

const COLORS = {
  primary: 'rgba(59, 130, 246, 0.8)',
  success: 'rgba(16, 185, 129, 0.8)',
  warning: 'rgba(251, 191, 36, 0.8)',
  danger: 'rgba(239, 68, 68, 0.8)',
  purple: 'rgba(139, 92, 246, 0.8)',
  orange: 'rgba(251, 146, 60, 0.8)',
  teal: 'rgba(20, 184, 166, 0.8)',
  pink: 'rgba(236, 72, 153, 0.8)',
};

const CATEGORY_COLORS = [
  COLORS.primary,
  COLORS.success,
  COLORS.warning,
  COLORS.purple,
  COLORS.orange,
  COLORS.teal,
  COLORS.pink,
  COLORS.danger,
];

interface DashboardProps {
  embedded?: boolean;
}

export default function GastosEmpresarialesDashboard({ embedded = false }: DashboardProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const currentMonth = new Date().getMonth() + 1;
  
  const canExport = user?.role && !['salesperson', 'Salesperson', 'Vendedor', 'vendedor'].includes(user.role);
  const currentYear = new Date().getFullYear();
  
  const [mes, setMes] = useState(currentMonth.toString());
  const [anio, setAnio] = useState(currentYear.toString());
  const [usuarioFilter, setUsuarioFilter] = useState("todos");
  const [estadoFilter, setEstadoFilter] = useState("todos");
  const [categoriaFilter, setCategoriaFilter] = useState("todos");
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  
  const getDateRange = (month: string, year: string) => {
    const m = parseInt(month);
    const y = parseInt(year);
    const fechaDesde = new Date(y, m - 1, 1).toISOString().split('T')[0];
    const fechaHasta = new Date(y, m, 0).toISOString().split('T')[0];
    return { fechaDesde, fechaHasta };
  };

  const { data: summary, isLoading: isLoadingSummary } = useQuery<GastosSummary>({
    queryKey: ['/api/gastos-empresariales/analytics/summary', mes, anio, usuarioFilter],
    queryFn: async () => {
      let url = `/api/gastos-empresariales/analytics/summary?mes=${mes}&anio=${anio}`;
      if (usuarioFilter !== 'todos') {
        url += `&userId=${usuarioFilter}`;
      }
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) throw new Error('Error al cargar resumen');
      return response.json();
    }
  });

  const { data: porCategoria = [], isLoading: isLoadingCategoria } = useQuery<GastosByCategoria[]>({
    queryKey: ['/api/gastos-empresariales/analytics/por-categoria', mes, anio, usuarioFilter],
    queryFn: async () => {
      let url = `/api/gastos-empresariales/analytics/por-categoria?mes=${mes}&anio=${anio}`;
      if (usuarioFilter !== 'todos') {
        url += `&userId=${usuarioFilter}`;
      }
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) throw new Error('Error al cargar datos por categoría');
      return response.json();
    }
  });

  const { data: porUsuario = [], isLoading: isLoadingUsuario } = useQuery<GastosByUser[]>({
    queryKey: ['/api/gastos-empresariales/analytics/por-usuario', mes, anio, usuarioFilter],
    queryFn: async () => {
      let url = `/api/gastos-empresariales/analytics/por-usuario?mes=${mes}&anio=${anio}`;
      if (usuarioFilter !== 'todos') {
        url += `&userId=${usuarioFilter}`;
      }
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) throw new Error('Error al cargar datos por usuario');
      return response.json();
    }
  });

  const { data: porDia = [], isLoading: isLoadingDia } = useQuery<GastosByDia[]>({
    queryKey: ['/api/gastos-empresariales/analytics/por-dia', mes, anio, usuarioFilter],
    queryFn: async () => {
      let url = `/api/gastos-empresariales/analytics/por-dia?mes=${mes}&anio=${anio}`;
      if (usuarioFilter !== 'todos') {
        url += `&userId=${usuarioFilter}`;
      }
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) throw new Error('Error al cargar datos por día');
      return response.json();
    }
  });

  const { data: gastosRecientes = [] } = useQuery<GastoEmpresarial[]>({
    queryKey: ['/api/gastos-empresariales', mes, anio, usuarioFilter],
    queryFn: async () => {
      const { fechaDesde, fechaHasta } = getDateRange(mes, anio);
      let url = `/api/gastos-empresariales?fechaDesde=${fechaDesde}&fechaHasta=${fechaHasta}&limit=500`;
      if (usuarioFilter !== 'todos') {
        url += `&userId=${usuarioFilter}`;
      }
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) throw new Error('Error al cargar gastos recientes');
      return response.json();
    }
  });

  const { data: fondosData = [] } = useQuery<FundAllocation[]>({
    queryKey: ['/api/fund-allocations', mes, anio, usuarioFilter],
    queryFn: async () => {
      let url = `/api/fund-allocations?limit=500`;
      if (usuarioFilter !== 'todos') {
        url += `&assignedToId=${usuarioFilter}`;
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
    const date = new Date(dateString);
    return date.toLocaleDateString('es-CL', { 
      day: '2-digit', 
      month: 'short',
      year: 'numeric'
    });
  };

  const getEstadoBadge = (estado: string) => {
    switch (estado) {
      case 'aprobado':
        return <Badge className="bg-green-100 text-green-800">Aprobado</Badge>;
      case 'rechazado':
        return <Badge className="bg-red-100 text-red-800">Rechazado</Badge>;
      default:
        return <Badge className="bg-yellow-100 text-yellow-800">Pendiente</Badge>;
    }
  };

  const statusChartData = {
    labels: ['Pendiente', 'Aprobado', 'Rechazado'],
    datasets: [{
      data: [
        summary?.totalPendiente || 0,
        summary?.totalAprobado || 0,
        summary?.totalRechazado || 0,
      ],
      backgroundColor: [COLORS.warning, COLORS.success, COLORS.danger],
      borderWidth: 0,
    }]
  };

  const categoriaChartData = {
    labels: porCategoria.map(c => c.categoria),
    datasets: [{
      label: 'Monto por Categoría',
      data: porCategoria.map(c => c.total),
      backgroundColor: CATEGORY_COLORS.slice(0, porCategoria.length),
      borderRadius: 4,
    }]
  };

  const usuarioChartData = {
    labels: porUsuario.slice(0, 10).map(u => {
      const parts = u.userName.split(' ');
      return parts.length > 1 ? `${parts[0]} ${parts[1]?.[0] || ''}.` : u.userName;
    }),
    datasets: [{
      label: 'Gasto por Vendedor',
      data: porUsuario.slice(0, 10).map(u => u.total),
      backgroundColor: COLORS.primary,
      borderRadius: 4,
    }]
  };

  const sortedDia = [...porDia].sort((a, b) => new Date(a.dia).getTime() - new Date(b.dia).getTime());
  const diaChartData = {
    labels: sortedDia.map(d => formatDate(d.dia)),
    datasets: [{
      label: 'Gasto Diario',
      data: sortedDia.map(d => d.total),
      borderColor: COLORS.primary,
      backgroundColor: 'rgba(59, 130, 246, 0.2)',
      fill: true,
      tension: 0.3,
    }]
  };

  const pieOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
      },
      datalabels: {
        formatter: (value: number, ctx: any) => {
          const total = ctx.dataset.data.reduce((a: number, b: number) => a + b, 0);
          if (total === 0 || value === 0) return '';
          const percentage = Math.round((value / total) * 100);
          return percentage >= 5 ? `${percentage}%` : '';
        },
        color: '#fff',
        font: { weight: 'bold' as const, size: 12 },
      }
    },
  };

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      datalabels: { display: false },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value: any) => formatCurrency(value),
        }
      }
    }
  };

  const horizontalBarOptions = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y' as const,
    plugins: {
      legend: { display: false },
      datalabels: { display: false },
    },
    scales: {
      x: {
        beginAtZero: true,
        ticks: {
          callback: (value: any) => formatCurrency(value),
        }
      },
      y: {
        ticks: {
          font: { size: 11 }
        }
      }
    }
  };

  const lineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      datalabels: { display: false },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value: any) => formatCurrency(value),
        }
      }
    }
  };

  // Función para obtener gastos filtrados (reutilizable)
  const getFilteredGastos = () => {
    return gastosRecientes.filter(gasto => {
      const matchEstado = estadoFilter === 'todos' || gasto.estado === estadoFilter;
      const matchCategoria = categoriaFilter === 'todos' || gasto.categoria === categoriaFilter;
      return matchEstado && matchCategoria;
    });
  };

  const handleExportCSV = () => {
    const gastosParaExportar = getFilteredGastos();
    if (gastosParaExportar.length === 0) return;
    
    const headers = ['Fecha', 'Descripción', 'Categoría', 'Monto', 'Estado', 'Proveedor'];
    const rows = gastosParaExportar.map(g => [
      formatFullDate((g.fechaEmision || g.createdAt) as any),
      g.descripcion,
      g.categoria,
      g.monto,
      g.estado,
      g.proveedor || '-'
    ]);
    
    // Agregar info de filtros al nombre del archivo
    let fileName = `gastos_${anio}_${mes}`;
    if (estadoFilter !== 'todos') fileName += `_${estadoFilter}`;
    if (categoriaFilter !== 'todos') fileName += `_${categoriaFilter.replace(/\s+/g, '_')}`;
    
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${fileName}.csv`;
    link.click();
  };

  const renderChartToImage = (chartData: any, chartType: 'pie' | 'bar' | 'doughnut', width: number, height: number): Promise<string> => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const scale = 4;
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
      const doc = new jsPDF('p', 'mm', 'a4');
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
      doc.text(`Período: ${monthName} ${anio}`, pageWidth / 2, 28, { align: 'center' });
      
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
              data: porCategoria.map(c => c.total),
              backgroundColor: ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'],
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
              backgroundColor: ['#16A34A', '#F59E0B', '#DC2626']
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
          head: [['Fecha', 'Monto', 'Estado', 'Asignado Por']],
          body: fondosData.map(f => [
            formatFullDate(f.createdAt as any),
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
        financiamiento: string;
        descripcion?: string;
        categoria?: string;
        tipoDocumento?: string;
        proveedor?: string;
        estado?: string;
        tipoFondo?: string;
      }
      
      const allImages: ImageInfo[] = [];
      
      for (const fondo of fondosData) {
        if (fondo.comprobanteUrl) {
          allImages.push({
            url: fondo.comprobanteUrl,
            previewUrl: (fondo as any).comprobantePreviewUrl || null,
            type: 'fondo',
            vendedor: getUserName(fondo.assignedToId || ''),
            monto: formatCurrency(Number(fondo.montoInicial) || 0),
            fecha: formatFullDate(fondo.createdAt as any),
            financiamiento: 'Fondo Asignado',
            tipoFondo: fondo.fundType || 'General',
            estado: fondo.estado || '-',
            descripcion: fondo.descripcion || fondo.motivo || '-',
          });
        }
      }
      
      for (const gasto of gastosParaExportar) {
        if (gasto.comprobanteUrl) {
          const esConFondo = gasto.fundingMode === 'con_fondo';
          allImages.push({
            url: gasto.comprobanteUrl,
            previewUrl: (gasto as any).comprobantePreviewUrl || null,
            type: 'gasto',
            vendedor: getUserName(gasto.userId),
            monto: formatCurrency(Number(gasto.monto) || 0),
            fecha: formatFullDate((gasto.fechaEmision || gasto.createdAt) as any),
            financiamiento: esConFondo ? 'Con Fondo Asignado' : 'Restitución/Reembolso',
            descripcion: gasto.descripcion || '-',
            categoria: gasto.categoria || '-',
            tipoDocumento: gasto.tipoDocumento || '-',
            proveedor: gasto.proveedor || '-',
            estado: gasto.estado || '-',
          });
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
        
        for (const img of allImages) {
          try {
            const isPDF = img.url.toLowerCase().endsWith('.pdf');
            const sectionHeight = 95;
            
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
            
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(100, 116, 139);
            doc.text('Fecha', labelX, yPos);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(15, 23, 42);
            doc.text(img.fecha, valueX, yPos);
            yPos += lineHeight;
            
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
              doc.text(String(img.descripcion).substring(0, 22), valueX, yPos);
            }
            
            doc.setDrawColor(229, 231, 235);
            doc.setFillColor(249, 250, 251);
            doc.roundedRect(imageColumnStart, sectionStartY - 3, imageMaxWidth, sectionHeight, 3, 3, 'FD');
            
            const imgYPos = sectionStartY + 5;
            const imgMaxHeight = sectionHeight - 16;
            
            if (isPDF) {
              let pdfPreviewLoaded = false;
              
              const previewUrl = img.previewUrl || img.url.replace(/\.pdf$/i, '_preview.png');
              
              try {
                const previewResponse = await fetch(previewUrl, { credentials: 'include' });
                if (previewResponse.ok) {
                  const previewBlob = await previewResponse.blob();
                  const previewBase64 = await new Promise<string>((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result as string);
                    reader.readAsDataURL(previewBlob);
                  });
                  
                  const imgObj = new Image();
                  await new Promise((resolve, reject) => {
                    imgObj.onload = resolve;
                    imgObj.onerror = reject;
                    imgObj.src = previewBase64;
                  });
                  
                  let imgWidth = imgObj.width;
                  let imgHeight = imgObj.height;
                  
                  if (imgWidth > imageMaxWidth) {
                    const ratio = imageMaxWidth / imgWidth;
                    imgWidth = imageMaxWidth;
                    imgHeight = imgHeight * ratio;
                  }
                  if (imgHeight > imgMaxHeight) {
                    const ratio = imgMaxHeight / imgHeight;
                    imgHeight = imgMaxHeight;
                    imgWidth = imgWidth * ratio;
                  }
                  
                  doc.addImage(previewBase64, 'PNG', imageColumnStart, imgYPos, imgWidth, imgHeight, undefined, 'FAST');
                  doc.setFontSize(7);
                  doc.setTextColor(100, 116, 139);
                  doc.text('(Vista previa del PDF)', imageColumnStart, imgYPos + imgHeight + 4);
                  doc.setTextColor(0, 0, 0);
                  pdfPreviewLoaded = true;
                }
              } catch (previewError) {
                console.log('Server preview not available, trying client-side conversion');
              }
              
              if (!pdfPreviewLoaded) {
                const pdfImage = await pdfToImage(img.url, 400);
                if (pdfImage) {
                  const imgObj = new Image();
                  await new Promise((resolve, reject) => {
                    imgObj.onload = resolve;
                    imgObj.onerror = reject;
                    imgObj.src = pdfImage;
                  });
                  
                  let imgWidth = imgObj.width;
                  let imgHeight = imgObj.height;
                  
                  if (imgWidth > imageMaxWidth) {
                    const ratio = imageMaxWidth / imgWidth;
                    imgWidth = imageMaxWidth;
                    imgHeight = imgHeight * ratio;
                  }
                  if (imgHeight > imgMaxHeight) {
                    const ratio = imgMaxHeight / imgHeight;
                    imgHeight = imgMaxHeight;
                    imgWidth = imgWidth * ratio;
                  }
                  
                  doc.addImage(pdfImage, 'PNG', imageColumnStart, imgYPos, imgWidth, imgHeight, undefined, 'FAST');
                  doc.setFontSize(7);
                  doc.setTextColor(100, 116, 139);
                  doc.text('(Primera página del PDF)', imageColumnStart, imgYPos + imgHeight + 4);
                  doc.setTextColor(0, 0, 0);
                  pdfPreviewLoaded = true;
                }
              }
              
              if (!pdfPreviewLoaded) {
                doc.setFontSize(9);
                doc.setFont('helvetica', 'normal');
                doc.text('Documento PDF:', imageColumnStart, imgYPos);
                doc.setTextColor(0, 0, 255);
                doc.textWithLink('[Ver PDF adjunto]', imageColumnStart, imgYPos + 7, { url: img.url });
                doc.setTextColor(0, 0, 0);
              }
            } else {
              const response = await fetch(img.url);
              if (!response.ok) throw new Error(`HTTP ${response.status}`);
              const blob = await response.blob();
              const base64 = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.readAsDataURL(blob);
              });
              
              let imgFormat: 'JPEG' | 'PNG' | 'WEBP' = 'JPEG';
              if (base64.includes('data:image/png')) {
                imgFormat = 'PNG';
              } else if (base64.includes('data:image/webp')) {
                imgFormat = 'WEBP';
              }
              
              const imgObj = new Image();
              await new Promise((resolve, reject) => {
                imgObj.onload = resolve;
                imgObj.onerror = reject;
                imgObj.src = base64;
              });
              
              let imgWidth = imgObj.width;
              let imgHeight = imgObj.height;
              
              if (imgWidth > imageMaxWidth) {
                const ratio = imageMaxWidth / imgWidth;
                imgWidth = imageMaxWidth;
                imgHeight = imgHeight * ratio;
              }
              if (imgHeight > imgMaxHeight) {
                const ratio = imgMaxHeight / imgHeight;
                imgHeight = imgMaxHeight;
                imgWidth = imgWidth * ratio;
              }
              
              doc.addImage(base64, imgFormat, imageColumnStart, imgYPos, imgWidth, imgHeight, undefined, 'FAST');
            }
            
            yPos = sectionStartY + sectionHeight + 8;
            
          } catch (e) {
            console.error('Error loading image:', img.url, e);
            imageErrors++;
            doc.setFontSize(9);
            doc.text(`Comprobante - ${img.vendedor} - [Error al cargar imagen]`, margin, yPos);
            yPos += 15;
          }
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

  const years = Array.from({ length: 5 }, (_, i) => (currentYear - i).toString());

  // Usar la función de filtrado para la vista
  const filteredGastos = getFilteredGastos();

  const hasData = (summary?.count || 0) > 0 || fondosData.length > 0 || gastosRecientes.length > 0;

  return (
    <div className={embedded ? "space-y-6" : "p-4 sm:p-6 lg:p-8 space-y-6"}>
      {!embedded && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <Button
              variant="ghost"
              onClick={() => setLocation('/gastos-empresariales')}
              className="mb-2"
              data-testid="button-back"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver
            </Button>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
              Dashboard de Rendición de Gastos
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
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
                Exportar CSV
              </Button>
            </div>
          )}
        </div>
      )}

      {embedded && canExport && (
        <div className="flex gap-2 justify-end">
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
            Exportar CSV
          </Button>
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 overflow-x-auto pb-2">
            <div className="flex items-center gap-2 flex-shrink-0">
              <Calendar className="h-4 w-4 text-gray-500" />
              <Select value={mes} onValueChange={setMes}>
                <SelectTrigger className="w-[120px]" data-testid="select-mes">
                  <SelectValue placeholder="Mes" />
                </SelectTrigger>
                <SelectContent>
                  {months.map(month => (
                    <SelectItem key={month.value} value={month.value}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={anio} onValueChange={setAnio}>
                <SelectTrigger className="w-[85px]" data-testid="select-anio">
                  <SelectValue placeholder="Año" />
                </SelectTrigger>
                <SelectContent>
                  {years.map(year => (
                    <SelectItem key={year} value={year}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <Users className="h-4 w-4 text-gray-500" />
              <Select value={usuarioFilter} onValueChange={setUsuarioFilter}>
                <SelectTrigger className="w-[150px]" data-testid="select-usuario">
                  <SelectValue placeholder="Usuario" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los usuarios</SelectItem>
                  {porUsuario.map(user => (
                    <SelectItem key={user.userId} value={user.userId}>
                      {user.userName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <Clock className="h-4 w-4 text-gray-500" />
              <Select value={estadoFilter} onValueChange={setEstadoFilter}>
                <SelectTrigger className="w-[130px]" data-testid="select-estado-dashboard">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="pendiente">Pendiente</SelectItem>
                  <SelectItem value="aprobado">Aprobado</SelectItem>
                  <SelectItem value="rechazado">Rechazado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <FolderOpen className="h-4 w-4 text-gray-500" />
              <Select value={categoriaFilter} onValueChange={setCategoriaFilter}>
                <SelectTrigger className="w-[140px]" data-testid="select-categoria-dashboard">
                  <SelectValue placeholder="Categoría" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas</SelectItem>
                  {CATEGORIAS.map(cat => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Gastos</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-gastos">
              {isLoadingSummary ? '...' : formatCurrency(summary?.total || 0)}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {summary?.count || 0} registro{(summary?.count || 0) !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-yellow-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendiente</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600" data-testid="text-total-pendiente">
              {isLoadingSummary ? '...' : formatCurrency(summary?.totalPendiente || 0)}
            </div>
            <p className="text-xs text-gray-500 mt-1">Por aprobar</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aprobado</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600" data-testid="text-total-aprobado">
              {isLoadingSummary ? '...' : formatCurrency(summary?.totalAprobado || 0)}
            </div>
            <p className="text-xs text-gray-500 mt-1">Aprobados</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rechazado</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600" data-testid="text-total-rechazado">
              {isLoadingSummary ? '...' : formatCurrency(summary?.totalRechazado || 0)}
            </div>
            <p className="text-xs text-gray-500 mt-1">Rechazados</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Gastos del Período ({filteredGastos.length})
            {(estadoFilter !== 'todos' || categoriaFilter !== 'todos') && (
              <Badge variant="secondary" className="ml-2 text-xs">Filtrado</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredGastos.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Proveedor</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                    <TableHead className="text-center">Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredGastos.map((gasto) => (
                    <TableRow key={gasto.id} data-testid={`row-gasto-${gasto.id}`}>
                      <TableCell className="whitespace-nowrap">
                        {formatFullDate(gasto.createdAt as any)}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {gasto.descripcion}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{gasto.categoria}</Badge>
                      </TableCell>
                      <TableCell>{gasto.proveedor || '-'}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(parseFloat(gasto.monto as any))}
                      </TableCell>
                      <TableCell className="text-center">
                        {getEstadoBadge(gasto.estado)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex items-center justify-center h-32 text-gray-500">
              {gastosRecientes.length > 0 ? 'No hay gastos que coincidan con los filtros' : 'No hay gastos registrados'}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <PieChartIcon className="h-5 w-5" />
              Distribución por Estado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              {hasData ? (
                <Doughnut data={statusChartData} options={pieOptions} />
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                  No hay datos disponibles
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Gastos por Categoría
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              {porCategoria.length > 0 ? (
                <Bar data={categoriaChartData} options={barOptions} />
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                  No hay datos disponibles
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5" />
              Top 10 Vendedores con más Gastos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {porUsuario.length > 0 ? (
                <Bar data={usuarioChartData} options={horizontalBarOptions} />
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                  No hay datos disponibles
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Evolución Diaria del Mes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {porDia.length > 0 ? (
                <Line data={diaChartData} options={lineOptions} />
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                  No hay datos disponibles
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
