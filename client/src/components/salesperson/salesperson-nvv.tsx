import { useQuery } from "@tanstack/react-query";
import { ShoppingCart, Package, DollarSign, User } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface SalespersonNVVProps {
  salespersonName: string;
  selectedPeriod?: string;
  filterType?: "day" | "month" | "year" | "range";
}

interface NVVRecord {
  id: string;
  NUDO: string;
  TIDO: string;
  FEEMDO: string;
  ENDO: string;
  NOKOEN: string;
  NOKOPR: string;
  KOPRCT: string;
  CAPREX2: number;
  CAPRCO2: number;
  PPPRNE: number;
  cantidadPendiente: number;
  totalPendiente: number;
}

interface ClientGroup {
  uniqueKey: string;
  clientCode: string;
  clientName: string;
  totalAmount: number;
  totalUnits: number;
  totalOrders: number;
  records: NVVRecord[];
}

interface SalespersonNVVData {
  salespersonCode: string;
  salespersonName: string;
  totalAmount: number;
  totalUnits: number;
  totalOrders: number;
  records: NVVRecord[];
}

export default function SalespersonNVV({
  salespersonName,
  selectedPeriod,
  filterType
}: SalespersonNVVProps) {
  const { data: nvvData, isLoading } = useQuery<SalespersonNVVData | null>({
    queryKey: [`/api/nvv/salesperson`, salespersonName, selectedPeriod, filterType],
    queryFn: async () => {
      const encodedName = encodeURIComponent(salespersonName);
      const params = new URLSearchParams();
      if (selectedPeriod) params.append('period', selectedPeriod);
      if (filterType) params.append('filterType', filterType);
      
      const response = await fetch(`/api/nvv/salesperson/${encodedName}?${params.toString()}`, {
        credentials: 'include'
      });
      
      if (response.status === 404) {
        return null;
      }
      
      if (!response.ok) {
        throw new Error('Error al cargar NVV pendientes');
      }
      
      return response.json();
    },
    enabled: !!salespersonName
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Group records by client
  const groupRecordsByClient = (records: NVVRecord[]): ClientGroup[] => {
    const grouped = records.reduce((acc, record) => {
      const normalizedEndo = record.ENDO?.trim().toUpperCase() || '';
      const normalizedNokoen = record.NOKOEN?.trim().toUpperCase() || '';
      
      const uniqueKey = normalizedEndo || normalizedNokoen || 'SIN_CODIGO';
      const displayCode = record.ENDO?.trim() || record.NOKOEN?.trim() || 'Sin código';
      const displayName = record.NOKOEN?.trim() || 'Cliente sin nombre';
      
      if (!acc[uniqueKey]) {
        acc[uniqueKey] = {
          uniqueKey,
          clientCode: displayCode,
          clientName: displayName,
          totalAmount: 0,
          totalUnits: 0,
          totalOrders: 0,
          records: []
        };
      }
      
      acc[uniqueKey].totalAmount += record.totalPendiente;
      acc[uniqueKey].totalUnits += record.cantidadPendiente;
      acc[uniqueKey].totalOrders += 1;
      acc[uniqueKey].records.push(record);
      
      return acc;
    }, {} as Record<string, ClientGroup>);

    return Object.values(grouped).sort((a, b) => b.totalAmount - a.totalAmount);
  };

  if (isLoading) {
    return (
      <Card className="rounded-2xl shadow-md border-0 bg-gradient-to-br from-orange-50/80 via-amber-50/60 to-orange-100/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Notas de Venta Pendientes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
        </CardContent>
      </Card>
    );
  }

  if (!nvvData || nvvData.totalOrders === 0) {
    return (
      <Card className="rounded-2xl shadow-md border-0 bg-gradient-to-br from-green-50/80 via-emerald-50/60 to-green-100/40">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-green-500 rounded-full p-2 sm:p-3">
                <ShoppingCart className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-base sm:text-lg font-bold text-gray-900">
                  Notas de Venta Pendientes
                </CardTitle>
                <p className="text-xs sm:text-sm text-gray-600 mt-0.5">
                  Estado de pedidos pendientes
                </p>
              </div>
            </div>
            <Badge variant="outline" className="bg-green-100 text-green-700 border-green-200">
              Todo al día
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Package className="h-12 w-12 text-green-300 dark:text-green-600 mx-auto mb-3" />
            <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">
              ¡Excelente! No tienes notas de venta pendientes
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
              Todos tus pedidos están al día
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const clientGroups = groupRecordsByClient(nvvData.records);

  return (
    <Card className="rounded-2xl shadow-md border-0 bg-gradient-to-br from-orange-50/80 via-amber-50/60 to-orange-100/40">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-orange-500 rounded-full p-2 sm:p-3">
              <ShoppingCart className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-base sm:text-lg font-bold text-gray-900">
                Notas de Venta Pendientes
              </CardTitle>
              <p className="text-xs sm:text-sm text-gray-600 mt-0.5">
                Pedidos por entregar
              </p>
            </div>
          </div>
          <div className="flex gap-1 sm:gap-2">
            <Badge variant="outline" className="bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700 text-xs px-1.5 sm:px-2.5">
              {clientGroups.length} {clientGroups.length === 1 ? 'cliente' : 'clientes'}
            </Badge>
            <Badge variant="outline" className="bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-700 text-xs px-1.5 sm:px-2.5">
              {nvvData.totalOrders} {nvvData.totalOrders === 1 ? 'pedido' : 'pedidos'}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-700 rounded-lg p-3 sm:p-4 shadow-sm">
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-500 mb-1">
              <div className="p-1 sm:p-1.5 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                <DollarSign className="h-3 w-3 sm:h-4 sm:w-4" />
              </div>
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Monto Pendiente</span>
            </div>
            <div className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-gray-100">
              {formatCurrency(nvvData.totalAmount)}
            </div>
          </div>
          
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-700 rounded-lg p-3 sm:p-4 shadow-sm">
            <div className="flex items-center gap-2 text-purple-600 dark:text-purple-500 mb-1">
              <div className="p-1 sm:p-1.5 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <Package className="h-3 w-3 sm:h-4 sm:w-4" />
              </div>
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Unidades Pendientes</span>
            </div>
            <div className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-gray-100">
              {nvvData.totalUnits.toLocaleString('es-CL', { maximumFractionDigits: 0 })}
            </div>
          </div>
          
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-700 rounded-lg p-3 sm:p-4 shadow-sm">
            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-500 mb-1">
              <div className="p-1 sm:p-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <User className="h-3 w-3 sm:h-4 sm:w-4" />
              </div>
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Clientes</span>
            </div>
            <div className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-gray-100">{clientGroups.length}</div>
          </div>
        </div>

        {/* Grouped by Client with nested Documents Accordion */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Por Cliente</h3>
          <div>
            <Accordion type="single" collapsible className="space-y-2">
              {clientGroups.map((clientGroup) => (
                <AccordionItem
                  key={clientGroup.uniqueKey}
                  value={clientGroup.uniqueKey}
                  className="border rounded-lg bg-white dark:bg-slate-900"
                  data-testid={`client-group-${clientGroup.uniqueKey}`}
                >
                  <AccordionTrigger className="px-2 sm:px-3 py-2 sm:py-3 hover:bg-gray-50 dark:hover:bg-gray-800">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between w-full pr-2 sm:pr-4 gap-2">
                      {/* Client name and documents */}
                      <div className="text-left min-w-0 flex-1">
                        <div className="font-medium text-sm sm:text-base text-gray-900 dark:text-gray-100 break-words line-clamp-2 sm:truncate">
                          {clientGroup.clientName}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {clientGroup.totalOrders} {clientGroup.totalOrders === 1 ? 'documento' : 'documentos'}
                        </div>
                      </div>
                      {/* Stats grid - 2 columns on mobile, row on desktop */}
                      <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:gap-3 shrink-0 w-full sm:w-auto">
                        <div className="text-left sm:text-right">
                          <div className="text-xs text-gray-500 dark:text-gray-400">Unidades</div>
                          <div className="text-sm font-semibold text-purple-700 dark:text-purple-300">
                            {clientGroup.totalUnits.toLocaleString('es-CL', { maximumFractionDigits: 0 })}
                          </div>
                        </div>
                        <div className="text-left sm:text-right">
                          <div className="text-xs text-gray-500 dark:text-gray-400">Monto</div>
                          <div className="text-sm font-bold text-amber-700 dark:text-amber-300">
                            {formatCurrency(clientGroup.totalAmount)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-3 pb-3">
                    <div className="bg-gray-50 dark:bg-gray-800 rounded p-3 mt-2 space-y-2">
                      {clientGroup.records.map((record) => (
                        <div 
                          key={record.id} 
                          className="bg-white dark:bg-slate-900 rounded border dark:border-gray-700 p-3"
                          data-testid={`nvv-record-${record.id}`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <div className="font-semibold text-sm text-gray-900 dark:text-gray-100">{record.NUDO}</div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">{record.TIDO}</div>
                            </div>
                            <Badge variant="outline" className="bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-700">
                              {formatCurrency(record.totalPendiente)}
                            </Badge>
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                            <div><span className="font-medium">Producto:</span> {record.NOKOPR}</div>
                            <div className="flex justify-between">
                              <span><span className="font-medium">Requerido:</span> {record.CAPREX2.toLocaleString('es-CL')}</span>
                              <span><span className="font-medium">Confirmado:</span> {record.CAPRCO2.toLocaleString('es-CL')}</span>
                              <span><span className="font-medium">Pendiente:</span> {record.cantidadPendiente.toLocaleString('es-CL')}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
