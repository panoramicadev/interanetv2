import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Users, 
  Building, 
  DollarSign,
  Calendar,
  FileText
} from "lucide-react";
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ChartDataLabels
);

interface NvvDashboardMetrics {
  totalRecords: number;
  totalSalespeople: number;
  totalCompanies: number;
  totalPendingAmount: number;
  averageOrderValue: number;
  topSalespeople: Array<{
    salesperson: string;
    totalAmount: number;
    recordCount: number;
  }>;
  topCompanies: Array<{
    company: string;
    totalAmount: number;
    recordCount: number;
  }>;
  statusBreakdown: Array<{
    status: string;
    count: number;
    amount: number;
  }>;
  regionBreakdown: Array<{
    region: string;
    count: number;
    amount: number;
  }>;
}

interface NvvRecord {
  id: string;
  // Direct CSV column fields
  NOKOEN: string | null; // Cliente
  KOPRCT: string | null; // SKU del producto
  NOKOPR: string | null; // Nombre del producto
  KOFULIDO: string | null; // Vendedor
  FEEMDO: string | null; // Fecha de emisión del documento
  FEERLI: string | null; // Fecha de compromiso
  CAPRCO2: string | null; // Cantidad confirmada
  CAPREX2: string | null; // Cantidad requerida
  PPPRNE: string | null; // Precio unitario neto
  // Additional CSV columns that we might need
  NUDO: string | null; // Número de documento
  TIDO: string | null; // Tipo de documento
  COMUNA: string | null; // Comuna
  OBSERVA: string | null; // Observaciones
  // New calculated columns from database
  cantidadPendiente: string | null; // New calculated column: CAPRCO2 - CAPREX2
  totalPendiente: string | null; // New calculated column: PPPRNE * cantidadPendiente
  // System fields
  status?: string;
  importBatch?: string;
  createdAt?: string;
  updatedAt?: string;
}

const statusLabels: Record<string, string> = {
  pending: "Pendiente",
  confirmed: "Confirmado",
  delivered: "Entregado",
  cancelled: "Cancelado"
};

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-blue-100 text-blue-800",
  delivered: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800"
};

export function NvvDashboard() {

  // Obtener sumatoria total sin filtros de fecha
  const { data: totalSummary, isLoading: isLoadingTotal } = useQuery<{
    totalAmount: number;
    totalRecords: number;
  }>({
    queryKey: ['/api/nvv/total'],
    retry: false,
  });

  // Obtener datos detallados de las notas de venta
  const { data: detailedData, isLoading: isLoadingDetails, error } = useQuery<NvvRecord[]>({
    queryKey: ['/api/nvv/pending'],
    queryFn: async () => {
      const response = await fetch('/api/nvv/pending?limit=500&offset=0');
      if (!response.ok) {
        throw new Error('Error al cargar datos detallados');
      }
      return response.json();
    },
    retry: false,
  });

  // Obtener mapeo de códigos de vendedor a nombres reales y segmentos
  const { data: salespersonMapping, isLoading: isLoadingMapping } = useQuery<{
    kofulidoToName: Record<string, string>;
    kofulidoToSegment: Record<string, string>;
    segments: Record<string, { count: number; amount: number }>;
  }>({
    queryKey: ['/api/sales-transactions/salesperson-mapping'],
    queryFn: async () => {
      const response = await fetch('/api/sales-transactions/salesperson-mapping');
      if (!response.ok) {
        throw new Error('Error al cargar mapeo de vendedores');
      }
      return response.json();
    },
    retry: false,
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  // Formato exacto para etiquetas en gráficos
  const formatCurrencyLabel = (amount: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('es-CL').format(num);
  };

  const formatDate = (dateString: string) => {
    return new Intl.DateTimeFormat('es-CL', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date(dateString));
  };

  const formatDateTime = (dateTimeString: string | null | undefined) => {
    if (!dateTimeString) return 'No disponible';
    try {
      const date = new Date(dateTimeString);
      return new Intl.DateTimeFormat('es-CL', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }).format(date);
    } catch (error) {
      return 'Fecha inválida';
    }
  };

  // Updated to use the pre-calculated totalPendiente column from database
  const calculatePendingAmount = (record: NvvRecord) => {
    // Use the new calculated column from database instead of manual calculation
    return parseFloat(record.totalPendiente || '0');
  };

  const getMonthFromDate = (dateString: string) => {
    if (!dateString) return 'Fecha no disponible';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('es-CL', {
      year: 'numeric',
      month: 'long'
    }).format(date);
  };

  const getMonthFromFEEMDO = (feemdo: string) => {
    if (!feemdo) return 'Fecha no disponible';
    
    try {
      // FEEMDO viene desde PostgreSQL en formato YYYY-MM-DD
      const date = new Date(feemdo);
      if (isNaN(date.getTime())) {
        return 'Fecha inválida';
      }
      
      return new Intl.DateTimeFormat('es-CL', {
        year: 'numeric',
        month: 'long'
      }).format(date);
    } catch (error) {
      return 'Fecha inválida';
    }
  };

  const formatFEEMDO = (feemdo: string) => {
    if (!feemdo) return 'Sin fecha';
    
    try {
      // Las fechas vienen desde PostgreSQL en formato YYYY-MM-DD
      const date = new Date(feemdo);
      if (isNaN(date.getTime())) {
        return 'Fecha inválida';
      }
      
      // Formatear a DD/MM/YYYY para mostrar
      return date.toLocaleDateString('es-CL', {
        day: '2-digit',
        month: '2-digit', 
        year: 'numeric'
      });
    } catch (error) {
      return 'Fecha inválida';
    }
  };

  const calculateMonthlyTotals = () => {
    if (!detailedData) return {};
    
    const monthlyTotals: Record<string, number> = {};
    
    detailedData.forEach(record => {
      const feemdo = record.FEEMDO;
      const month = getMonthFromFEEMDO(feemdo || '');
      const pendingAmount = calculatePendingAmount(record);
      
      if (monthlyTotals[month]) {
        monthlyTotals[month] += pendingAmount;
      } else {
        monthlyTotals[month] = pendingAmount;
      }
    });
    
    return monthlyTotals;
  };

  const calculateSalespersonTotals = () => {
    if (!detailedData) return {};
    
    const salespersonTotals: Record<string, { amount: number; count: number }> = {};
    
    detailedData.forEach((record: NvvRecord) => {
      const kofulido = record.KOFULIDO || '';
      // Usar nombre real del vendedor si está disponible, sino usar código
      const salesperson = salespersonMapping?.kofulidoToName?.[kofulido] || kofulido || 'Sin Vendedor';
      const pendingAmount = calculatePendingAmount(record);
      
      if (salespersonTotals[salesperson]) {
        salespersonTotals[salesperson].amount += pendingAmount;
        salespersonTotals[salesperson].count += 1;
      } else {
        salespersonTotals[salesperson] = { amount: pendingAmount, count: 1 };
      }
    });
    
    return salespersonTotals;
  };

  const calculateSegmentTotals = () => {
    if (!detailedData || !salespersonMapping) return {};
    
    const segmentTotals: Record<string, { amount: number; count: number }> = {};
    
    detailedData.forEach((record: NvvRecord) => {
      // Usar KOFULIDO (vendedor) para buscar el segmento desde el mapeo de ventas
      const salesperson = record.KOFULIDO?.trim();
      const segment = salesperson && salespersonMapping.kofulidoToSegment?.[salesperson]
        ? salespersonMapping.kofulidoToSegment[salesperson]
        : 'Sin Segmento';
      
      const pendingAmount = calculatePendingAmount(record);
      
      if (segmentTotals[segment]) {
        segmentTotals[segment].amount += pendingAmount;
        segmentTotals[segment].count += 1;
      } else {
        segmentTotals[segment] = { amount: pendingAmount, count: 1 };
      }
    });
    
    return segmentTotals;
  };

  if (isLoadingDetails || isLoadingMapping) {
    return (
      <Card className="p-6 text-center">
        <div className="animate-pulse text-gray-500">Cargando datos de notas de venta...</div>
      </Card>
    );
  }

  if (error || !detailedData) {
    return (
      <Card className="p-6 text-center">
        <div className="text-red-600 mb-2">Error al cargar datos de NVV</div>
        <p className="text-sm text-gray-600">
          Asegúrate de haber importado datos NVV primero
        </p>
      </Card>
    );
  }

  const monthlyTotals = calculateMonthlyTotals();
  const salespersonTotals = calculateSalespersonTotals();
  const segmentTotals = calculateSegmentTotals();

  // Preparar datos para el gráfico de vendedores
  const salespersonChartData = {
    labels: Object.keys(salespersonTotals),
    datasets: [
      {
        label: 'Monto Pendiente (CLP)',
        data: Object.values(salespersonTotals).map(item => item.amount),
        backgroundColor: 'rgba(59, 130, 246, 0.7)',
        borderColor: 'rgba(59, 130, 246, 1)',
        borderWidth: 1,
      }
    ],
  };

  const salespersonChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          font: {
            weight: 'bold' as const,
            size: 12
          }
        }
      },
      title: {
        display: true,
        text: 'NVV Pendientes por Vendedor',
        font: {
          weight: 'bold' as const,
          size: 16
        }
      },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            const value = context.raw;
            const salesperson = context.label;
            const count = salespersonTotals[salesperson]?.count || 0;
            return [
              `Monto: ${formatCurrency(value)}`,
              `NVV: ${count}`
            ];
          }
        },
        titleFont: {
          weight: 'bold' as const
        },
        bodyFont: {
          weight: 'bold' as const
        }
      },
      datalabels: {
        display: true,
        anchor: 'end' as const,
        align: 'top' as const,
        formatter: function(value: number) {
          return formatCurrencyLabel(value);
        },
        font: {
          weight: 'bold' as const,
          size: 11
        },
        color: '#1f2937',
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        borderColor: '#e5e7eb',
        borderWidth: 1,
        borderRadius: 4,
        padding: {
          top: 4,
          bottom: 4,
          left: 6,
          right: 6
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: function(value: any) {
            return formatCurrencyLabel(value);
          },
          font: {
            weight: 'bold' as const,
            size: 11
          }
        },
        title: {
          display: true,
          text: 'Monto Pendiente (CLP)',
          font: {
            weight: 'bold' as const,
            size: 12
          }
        }
      },
      x: {
        ticks: {
          font: {
            weight: 'bold' as const,
            size: 10
          },
          maxRotation: 45,
          minRotation: 0
        }
      }
    }
  };

  // Preparar datos para el gráfico de segmentos
  const segmentChartData = {
    labels: Object.keys(segmentTotals),
    datasets: [
      {
        label: 'Monto Pendiente (CLP)',
        data: Object.values(segmentTotals).map(item => item.amount),
        backgroundColor: 'rgba(34, 197, 94, 0.7)',
        borderColor: 'rgba(34, 197, 94, 1)',
        borderWidth: 1,
      }
    ],
  };

  const segmentChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          font: {
            weight: 'bold' as const,
            size: 12
          }
        }
      },
      title: {
        display: true,
        text: 'NVV Pendientes por Segmento de Cliente',
        font: {
          weight: 'bold' as const,
          size: 16
        }
      },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            const value = context.raw;
            const segment = context.label;
            const count = segmentTotals[segment]?.count || 0;
            return [
              `Monto: ${formatCurrency(value)}`,
              `NVV: ${count}`
            ];
          }
        },
        titleFont: {
          weight: 'bold' as const
        },
        bodyFont: {
          weight: 'bold' as const
        }
      },
      datalabels: {
        display: true,
        anchor: 'end' as const,
        align: 'top' as const,
        formatter: function(value: number) {
          return formatCurrencyLabel(value);
        },
        font: {
          weight: 'bold' as const,
          size: 11
        },
        color: '#1f2937',
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        borderColor: '#e5e7eb',
        borderWidth: 1,
        borderRadius: 4,
        padding: {
          top: 4,
          bottom: 4,
          left: 6,
          right: 6
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: function(value: any) {
            return formatCurrencyLabel(value);
          },
          font: {
            weight: 'bold' as const,
            size: 11
          }
        },
        title: {
          display: true,
          text: 'Monto Pendiente (CLP)',
          font: {
            weight: 'bold' as const,
            size: 12
          }
        }
      },
      x: {
        ticks: {
          font: {
            weight: 'bold' as const,
            size: 10
          },
          maxRotation: 45,
          minRotation: 0
        }
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Sumatoria Total NVV - Sin Filtros de Fecha */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <DollarSign className="h-5 w-5" />
            <span>Total NVV General</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingTotal ? (
            <div className="animate-pulse text-gray-500">Cargando total general...</div>
          ) : totalSummary ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gradient-to-r from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-lg p-6">
                <div className="text-sm font-medium text-green-600 dark:text-green-400 mb-2">
                  Monto Total Pendiente
                </div>
                <div className="text-3xl font-bold text-green-700 dark:text-green-300">
                  {formatCurrency(totalSummary.totalAmount)}
                </div>
              </div>
              <div className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-lg p-6">
                <div className="text-sm font-medium text-blue-600 dark:text-blue-400 mb-2">
                  Total de Registros
                </div>
                <div className="text-3xl font-bold text-blue-700 dark:text-blue-300">
                  {formatNumber(totalSummary.totalRecords)}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center text-gray-500 py-4">
              No hay datos disponibles
            </div>
          )}
        </CardContent>
      </Card>

      {/* Total NVV por Mes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Calendar className="h-5 w-5" />
            <span>Total NVV por Mes - Año Corrido</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {Object.keys(monthlyTotals).length === 0 ? (
            <div className="text-center text-gray-500 py-4">
              No hay datos de NVV disponibles
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(monthlyTotals)
                .sort(([a], [b]) => {
                  // Parsear los meses en formato "enero 2025", "diciembre 2024"
                  const monthNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
                  const parseMonthYear = (monthStr: string) => {
                    const parts = monthStr.toLowerCase().trim().split(' ');
                    if (parts.length < 2) return new Date(0);
                    const monthIndex = monthNames.indexOf(parts[0]);
                    const year = parseInt(parts[1]);
                    if (monthIndex === -1 || isNaN(year)) return new Date(0);
                    return new Date(year, monthIndex, 1);
                  };
                  return parseMonthYear(a).getTime() - parseMonthYear(b).getTime();
                })
                .map(([month, total]) => (
                  <div key={month} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                    <div className="text-sm font-medium text-gray-600 dark:text-gray-400">
                      {month}
                    </div>
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {formatCurrency(total)}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Gráfico por Vendedor */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Users className="h-5 w-5" />
            <span>NVV Pendientes por Vendedor</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {Object.keys(salespersonTotals).length === 0 ? (
            <div className="text-center text-gray-500 py-4">
              No hay datos de vendedores disponibles
            </div>
          ) : (
            <div className="h-96">
              <Bar data={salespersonChartData} options={salespersonChartOptions} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Gráfico por Segmento */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Building className="h-5 w-5" />
            <span>NVV Pendientes por Segmento de Cliente</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {Object.keys(segmentTotals).length === 0 ? (
            <div className="text-center text-gray-500 py-4">
              No hay datos de segmentos disponibles
            </div>
          ) : (
            <div className="h-96">
              <Bar data={segmentChartData} options={segmentChartOptions} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabla de Datos Detallados */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FileText className="h-5 w-5" />
            <span>Datos Detallados de Notas de Venta</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!detailedData || detailedData.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              No hay datos de notas de venta disponibles
            </div>
          ) : (
            <div className="h-96 w-full overflow-auto border rounded-lg">
              <Table className="min-w-max">
                <TableHeader className="sticky top-0 bg-white z-10">
                  <TableRow>
                    <TableHead className="min-w-[140px]">Fecha Documento</TableHead>
                    <TableHead className="min-w-[120px]">Mes NVV</TableHead>
                    <TableHead className="min-w-[100px]">Vendedor</TableHead>
                    <TableHead className="min-w-[150px]">Cliente (NOKOEN)</TableHead>
                    <TableHead className="min-w-[120px]">SKU (KOPRCT)</TableHead>
                    <TableHead className="min-w-[200px]">Producto (NOKOPR)</TableHead>
                    <TableHead className="min-w-[100px] text-right">Cant. Confirmada</TableHead>
                    <TableHead className="min-w-[100px] text-right">Cant. Requerida</TableHead>
                    <TableHead className="min-w-[100px] text-right">Precio Unit.</TableHead>
                    <TableHead className="min-w-[120px] text-right">Monto Pendiente</TableHead>
                    <TableHead className="min-w-[100px]">Estado</TableHead>
                    <TableHead className="min-w-[120px]">Fecha Compromiso</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detailedData.slice(0, 500).map((record) => {
                    const pendingAmount = calculatePendingAmount(record);
                    const caprco2 = record.CAPRCO2 ? parseFloat(record.CAPRCO2) : 0;
                    const caprex2 = record.CAPREX2 ? parseFloat(record.CAPREX2) : 0;
                    const ppprne = record.PPPRNE ? parseFloat(record.PPPRNE) : 0;
                    
                    // Usar campos directos de CSV
                    const nokoen = record.NOKOEN || 'Sin cliente';
                    const koprct = record.KOPRCT || 'Sin SKU';
                    const nokopr = record.NOKOPR || 'Sin producto';
                    const kofulido = record.KOFULIDO || 'Sin vendedor';
                    
                    return (
                      <TableRow key={record.id} data-testid={`row-nvv-${record.id}`}>
                        <TableCell className="min-w-[140px] text-sm" data-testid={`text-docdate-${record.id}`}>
                          {formatFEEMDO(record.FEEMDO || '')}
                        </TableCell>
                        <TableCell className="min-w-[120px]" data-testid={`text-month-${record.id}`}>
                          {getMonthFromFEEMDO(record.FEEMDO || '')}
                        </TableCell>
                        <TableCell className="font-medium min-w-[100px]" data-testid={`text-salesperson-${record.id}`}>
                          {kofulido}
                        </TableCell>
                        <TableCell className="min-w-[150px]" data-testid={`text-client-${record.id}`}>
                          {nokoen}
                        </TableCell>
                        <TableCell className="font-mono text-xs min-w-[120px]" data-testid={`text-sku-${record.id}`}>
                          {koprct}
                        </TableCell>
                        <TableCell className="min-w-[200px]" data-testid={`text-product-${record.id}`}>
                          {nokopr}
                        </TableCell>
                        <TableCell className="text-right min-w-[100px]" data-testid={`text-confirmed-${record.id}`}>
                          {formatNumber(caprco2)}
                        </TableCell>
                        <TableCell className="text-right min-w-[100px]" data-testid={`text-required-${record.id}`}>
                          {formatNumber(caprex2)}
                        </TableCell>
                        <TableCell className="text-right min-w-[100px]" data-testid={`text-unitprice-${record.id}`}>
                          {formatCurrency(ppprne)}
                        </TableCell>
                        <TableCell className="text-right font-medium min-w-[120px]" data-testid={`text-pending-${record.id}`}>
                          {formatCurrency(pendingAmount)}
                        </TableCell>
                        <TableCell className="min-w-[100px]" data-testid={`text-status-${record.id}`}>
                          <Badge className={statusColors[record.status || 'pending'] || "bg-gray-100 text-gray-800"}>
                            {statusLabels[record.status || 'pending'] || record.status || 'Pendiente'}
                          </Badge>
                        </TableCell>
                        <TableCell className="min-w-[120px]" data-testid={`text-date-${record.id}`}>
                          {formatFEEMDO(record.FEEMDO || '')}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
          <div className="mt-4 text-sm text-gray-600">
            Mostrando hasta 500 registros más recientes
          </div>
        </CardContent>
      </Card>
    </div>
  );
}