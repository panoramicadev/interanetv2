import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Calendar, ChevronLeft, ChevronRight, Eye, Edit, Trash2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { NvvPendingSales } from "@shared/schema";

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

export function PendingSalesTable() {
  const { toast } = useToast();
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);

  const { data: pendingSales, isLoading, error } = useQuery<NvvPendingSales[]>({
    queryKey: ['/api/nvv/pending', pageSize, currentPage],
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: pageSize.toString(),
        offset: ((currentPage - 1) * pageSize).toString(),
      });
      
      const response = await fetch(`/api/nvv/pending?${params}`, {
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Error al cargar datos NVV');
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
    }).format(amount);
  };

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('es-CL');
  };

  // Función para extraer y calcular datos NVV
  const calculateNvvData = (sale: any) => {
    const originalData = sale.originalData || {};
    
    const caprex2 = parseFloat(originalData.CAPREX2 || '0');
    const caprco2 = parseFloat(originalData.CAPRCO2 || '0');
    const ppprne = parseFloat(originalData.PPPRNE || '0');
    
    const cantidadPendiente = caprco2 - caprex2;
    const montoPendiente = cantidadPendiente * ppprne;
    
    return {
      cantidadRequerida: caprex2,
      cantidadConfirmada: caprco2,
      cantidadPendiente,
      precioUnitario: ppprne,
      montoPendiente,
      clienteNombre: originalData.NOKOEN || sale.clientName || 'Sin nombre',
      productoNombre: originalData.NOKOPR || sale.productName || 'Sin nombre',
      productoCode: originalData.KOPRCT || sale.productCode || '',
    };
  };

  if (error) {
    return (
      <Card className="p-6">
        <div className="text-center">
          <div className="text-red-600 mb-2">Error al cargar datos</div>
          <p className="text-sm text-gray-600">
            Asegúrate de haber importado datos NVV primero
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Data Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Calendar className="h-5 w-5" />
            <span>Notas de Ventas Pendientes</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center space-x-4 animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-20"></div>
                  <div className="h-4 bg-gray-200 rounded w-32"></div>
                  <div className="h-4 bg-gray-200 rounded w-24"></div>
                  <div className="h-4 bg-gray-200 rounded w-32"></div>
                  <div className="h-4 bg-gray-200 rounded w-20"></div>
                </div>
              ))}
            </div>
          ) : !pendingSales || pendingSales.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-gray-500 mb-2">No hay datos disponibles</div>
              <p className="text-sm text-gray-400">
                Importa un archivo CSV para ver las notas de ventas pendientes
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table data-testid="pending-sales-table">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Documento</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Producto</TableHead>
                      <TableHead>Cant. Requerida</TableHead>
                      <TableHead>Cant. Confirmada</TableHead>
                      <TableHead>Cant. Pendiente</TableHead>
                      <TableHead>Precio Unit.</TableHead>
                      <TableHead>Monto Pendiente</TableHead>
                      <TableHead>Fecha Compromiso</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingSales.map((sale) => {
                      const nvvData = calculateNvvData(sale);
                      return (
                        <TableRow key={sale.id} data-testid={`sale-row-${sale.id}`}>
                          <TableCell className="font-medium">
                            <div>
                              <div className="font-semibold">{sale.documentNumber}</div>
                              <div className="text-sm text-gray-500">{sale.documentType}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">{nvvData.clienteNombre}</div>
                              <div className="text-sm text-gray-500">{sale.clientCode}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">{nvvData.productoNombre}</div>
                              <div className="text-sm text-gray-500">{nvvData.productoCode}</div>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="font-medium text-blue-600">
                              {nvvData.cantidadRequerida.toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="font-medium text-green-600">
                              {nvvData.cantidadConfirmada.toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className={`font-medium ${nvvData.cantidadPendiente > 0 ? 'text-orange-600' : nvvData.cantidadPendiente < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                              {nvvData.cantidadPendiente.toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(nvvData.precioUnitario)}
                          </TableCell>
                          <TableCell className="text-right font-bold">
                            <span className={`${nvvData.montoPendiente > 0 ? 'text-orange-600' : nvvData.montoPendiente < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                              {formatCurrency(nvvData.montoPendiente)}
                            </span>
                          </TableCell>
                          <TableCell>
                            {formatDate(sale.commitmentDate)}
                          </TableCell>
                          <TableCell>
                            <Badge className={statusColors[sale.status || 'pending'] || "bg-gray-100 text-gray-800"}>
                              {statusLabels[sale.status || 'pending'] || sale.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                data-testid={`button-view-${sale.id}`}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-gray-500">
                  Mostrando {Math.min(pageSize, pendingSales.length)} de {pendingSales.length} registros
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    data-testid="button-prev-page"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm">Página {currentPage}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => p + 1)}
                    disabled={pendingSales.length < pageSize}
                    data-testid="button-next-page"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}