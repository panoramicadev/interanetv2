import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ShoppingCart, Package, Calendar, DollarSign, ChevronDown, FileText, User } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";

interface SalespersonPendingNVVProps {
  salesperson: string;
  selectedPeriod?: string;
  filterType?: "day" | "month" | "year";
  applyPeriodFilter?: boolean;
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

export default function SalespersonPendingNVV({
  salesperson,
  selectedPeriod,
  filterType,
  applyPeriodFilter = true
}: SalespersonPendingNVVProps) {
  const [showAll, setShowAll] = useState(false);

  const { data: nvvData, isLoading } = useQuery<NVVRecord[]>({
    queryKey: [`/api/nvv/by-salesperson`, salesperson, applyPeriodFilter ? selectedPeriod : 'all', applyPeriodFilter ? filterType : 'all'],
    queryFn: async () => {
      const params = new URLSearchParams({
        salesperson
      });

      // Solo agregar filtros de período si applyPeriodFilter es true
      if (applyPeriodFilter && selectedPeriod && filterType) {
        params.append('period', selectedPeriod);
        params.append('filterType', filterType);
      }

      const response = await fetch(`/api/nvv/by-salesperson?${params}`, {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Error al cargar NVV pendientes');
      }
      return response.json();
    },
    enabled: !!salesperson
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-CL', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Group data by client using ENDO (client code) as unique identifier
  const groupedByClient: ClientGroup[] = nvvData ? 
    Object.values(
      nvvData.reduce((acc, record) => {
        // Normalize ENDO and NOKOEN for grouping
        const normalizedEndo = record.ENDO?.trim().toUpperCase() || '';
        const normalizedNokoen = record.NOKOEN?.trim().toUpperCase() || '';

        // Use ENDO as primary key, only fall back to NOKOEN if ENDO is empty
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
      }, {} as Record<string, ClientGroup>)
    ).sort((a, b) => b.totalAmount - a.totalAmount) // Sort by total amount descending
  : [];

  // Calculate global totals
  const totalPendingAmount = nvvData?.reduce((sum, record) => sum + record.totalPendiente, 0) || 0;
  const totalPendingUnits = nvvData?.reduce((sum, record) => sum + record.cantidadPendiente, 0) || 0;
  const totalOrders = nvvData?.length || 0;
  const totalClients = groupedByClient.length;

  if (isLoading) {
    return (
      <Card>
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

  if (!nvvData || nvvData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Notas de Venta Pendientes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Package className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No hay notas de venta pendientes en este período
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base sm:text-xl">
            <ShoppingCart className="h-4 w-4 sm:h-5 sm:w-5" />
            <span className="hidden sm:inline">Notas de Venta Pendientes</span>
            <span className="sm:hidden">Pendientes</span>
          </CardTitle>
          <div className="flex gap-1 sm:gap-2">
            <Badge variant="outline" className="bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700 text-xs px-1.5 sm:px-2.5">
              {totalClients} {totalClients === 1 ? 'cliente' : 'clientes'}
            </Badge>
            <Badge variant="outline" className="bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-700 text-xs px-1.5 sm:px-2.5">
              {totalOrders} pedidos
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
              {formatCurrency(totalPendingAmount)}
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
              {totalPendingUnits.toLocaleString('es-CL', { maximumFractionDigits: 0 })}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-700 rounded-lg p-3 sm:p-4 shadow-sm">
            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-500 mb-1">
              <div className="p-1 sm:p-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <ShoppingCart className="h-3 w-3 sm:h-4 sm:w-4" />
              </div>
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Total Pedidos</span>
            </div>
            <div className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-gray-100">{totalOrders}</div>
          </div>
        </div>

        {/* Grouped by Client with Accordion */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Por Cliente</h3>
          <div>
            <Accordion type="single" collapsible className="space-y-2">
              {(showAll ? groupedByClient : groupedByClient.slice(0, 5)).map((clientGroup, index) => (
              <AccordionItem 
                key={clientGroup.uniqueKey} 
                value={clientGroup.uniqueKey}
                className="border rounded-lg overflow-hidden"
                data-testid={`client-group-${clientGroup.uniqueKey}`}
              >
                <AccordionTrigger 
                  className="px-2 sm:px-4 py-2 sm:py-3 hover:bg-gray-50 dark:hover:bg-gray-800 hover:no-underline"
                  data-testid={`client-trigger-${clientGroup.uniqueKey}`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between w-full pr-2 sm:pr-4 gap-2">
                    {/* Client info */}
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                      <div className="bg-blue-100 dark:bg-blue-900/30 p-1.5 sm:p-2 rounded-lg shrink-0">
                        <User className="h-3 w-3 sm:h-4 sm:w-4 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className="text-left min-w-0 flex-1">
                        <div className="font-semibold text-sm sm:text-base text-gray-900 dark:text-gray-100 break-words line-clamp-2 sm:truncate">{clientGroup.clientName}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {clientGroup.totalOrders} {clientGroup.totalOrders === 1 ? 'doc' : 'documentos'}
                        </div>
                      </div>
                    </div>
                    {/* Stats grid - 2 columns on mobile, row on desktop */}
                    <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:gap-4 shrink-0 w-full sm:w-auto">
                      <div className="text-left sm:text-right">
                        <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Unidades</div>
                        <div className="font-semibold text-sm sm:text-base text-purple-700 dark:text-purple-300">
                          {clientGroup.totalUnits.toLocaleString('es-CL', { maximumFractionDigits: 0 })}
                        </div>
                      </div>
                      <div className="text-left sm:text-right">
                        <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Monto Total</div>
                        <div className="font-bold text-sm sm:text-base text-amber-700 dark:text-amber-300">
                          {formatCurrency(clientGroup.totalAmount)}
                        </div>
                      </div>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-2 sm:px-4 pb-4 overflow-hidden">
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2 sm:p-4 mt-2 overflow-hidden">
                    <div className="flex items-center gap-2 mb-3 text-gray-700 dark:text-gray-300">
                      <FileText className="h-4 w-4" />
                      <span className="text-sm font-medium">Documentos</span>
                    </div>

                    {/* Mobile Card View */}
                    <div className="sm:hidden space-y-3 overflow-hidden">
                      {clientGroup.records.map((record) => (
                        <div 
                          key={record.id} 
                          className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-700 rounded-lg p-3 space-y-2 overflow-hidden"
                          data-testid={`nvv-detail-${record.id}`}
                        >
                          {/* Documento y Fecha */}
                          <div className="flex flex-wrap justify-between items-start gap-2 pb-2 border-b border-gray-200 dark:border-gray-700">
                            <div className="min-w-0 flex-1">
                              <div className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate">{record.NUDO}</div>
                              <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{record.TIDO}</div>
                            </div>
                            <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400 shrink-0">
                              <Calendar className="h-3 w-3" />
                              {formatDate(record.FEEMDO)}
                            </div>
                          </div>

                          {/* Producto */}
                          <div className="overflow-hidden">
                            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Producto</div>
                            <div className="font-medium text-sm text-gray-900 dark:text-gray-100 line-clamp-2">{record.NOKOPR}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{record.KOPRCT}</div>
                          </div>

                          {/* Cantidades - 2 columnas en pantallas muy pequeñas */}
                          <div className="grid grid-cols-2 xs:grid-cols-3 gap-2 pt-2">
                            <div className="min-w-0">
                              <div className="text-[10px] xs:text-xs text-gray-500 dark:text-gray-400">Requerida</div>
                              <div className="text-xs xs:text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                                {record.CAPREX2.toLocaleString('es-CL', { maximumFractionDigits: 0 })}
                              </div>
                            </div>
                            <div className="min-w-0">
                              <div className="text-[10px] xs:text-xs text-gray-500 dark:text-gray-400">Confirmada</div>
                              <div className="text-xs xs:text-sm font-medium text-blue-600 dark:text-blue-400 truncate">
                                {record.CAPRCO2.toLocaleString('es-CL', { maximumFractionDigits: 0 })}
                              </div>
                            </div>
                            <div className="min-w-0 col-span-2 xs:col-span-1">
                              <div className="text-[10px] xs:text-xs text-gray-500 dark:text-gray-400">Pendiente</div>
                              <div className="text-xs xs:text-sm font-bold text-amber-700 dark:text-amber-300 truncate">
                                {record.cantidadPendiente.toLocaleString('es-CL', { maximumFractionDigits: 0 })}
                              </div>
                            </div>
                          </div>

                          {/* Precio y Monto Total */}
                          <div className="flex flex-wrap justify-between items-center gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                            <div className="min-w-0">
                              <div className="text-[10px] xs:text-xs text-gray-500 dark:text-gray-400">Precio Unit.</div>
                              <div className="text-xs xs:text-sm text-gray-700 dark:text-gray-300 truncate">
                                {formatCurrency(record.PPPRNE)}
                              </div>
                            </div>
                            <div className="text-right min-w-0">
                              <div className="text-[10px] xs:text-xs text-gray-500 dark:text-gray-400">Monto Pend.</div>
                              <div className="text-sm xs:text-base font-bold text-amber-700 dark:text-amber-300 truncate">
                                {formatCurrency(record.totalPendiente)}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Desktop Table View */}
                    <div className="hidden sm:block overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Documento</TableHead>
                            <TableHead>Fecha</TableHead>
                            <TableHead>Producto</TableHead>
                            <TableHead className="text-right">Cant. Req.</TableHead>
                            <TableHead className="text-right">Cant. Conf.</TableHead>
                            <TableHead className="text-right">Cant. Pend.</TableHead>
                            <TableHead className="text-right">Precio Unit.</TableHead>
                            <TableHead className="text-right">Monto Pend.</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {clientGroup.records.map((record) => (
                            <TableRow key={record.id} data-testid={`nvv-detail-${record.id}`}>
                              <TableCell className="font-medium">
                                <div>
                                  <div className="font-semibold text-gray-900 dark:text-gray-100">{record.NUDO}</div>
                                  <div className="text-xs text-gray-500 dark:text-gray-400">{record.TIDO}</div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1 text-sm">
                                  <Calendar className="h-3 w-3 text-gray-400" />
                                  {formatDate(record.FEEMDO)}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="max-w-xs">
                                  <div className="font-medium text-sm truncate">{record.NOKOPR}</div>
                                  <div className="text-xs text-gray-500">{record.KOPRCT}</div>
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <span className="text-sm">
                                  {record.CAPREX2.toLocaleString('es-CL', { maximumFractionDigits: 2 })}
                                </span>
                              </TableCell>
                              <TableCell className="text-right">
                                <span className="text-sm text-blue-600 font-medium">
                                  {record.CAPRCO2.toLocaleString('es-CL', { maximumFractionDigits: 2 })}
                                </span>
                              </TableCell>
                              <TableCell className="text-right">
                                <Badge variant="outline" className="bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-700">
                                  {record.cantidadPendiente.toLocaleString('es-CL', { maximumFractionDigits: 2 })}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right text-sm text-gray-600 dark:text-gray-400">
                                {formatCurrency(record.PPPRNE)}
                              </TableCell>
                              <TableCell className="text-right">
                                <span className="font-semibold text-amber-700 dark:text-amber-300">
                                  {formatCurrency(record.totalPendiente)}
                                </span>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
              ))}
            </Accordion>

            {/* Ver más button */}
            {groupedByClient.length > 5 && (
              <div className="mt-4 text-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAll(!showAll)}
                  className="w-full"
                  data-testid="button-toggle-show-all"
                >
                  {showAll ? 'Ver menos' : `Ver más (${groupedByClient.length - 5} más)`}
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
