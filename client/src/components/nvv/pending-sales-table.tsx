import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

  // Build query parameters - simplified to show all data
  const queryParams = new URLSearchParams();
  queryParams.set('limit', pageSize.toString());
  queryParams.set('offset', ((currentPage - 1) * pageSize).toString());

  const { data: pendingSales, isLoading, error } = useQuery<NvvPendingSales[]>({
    queryKey: ['/api/nvv/pending', queryParams.toString()],
    retry: false,
  });

  const updateStatus = async (id: string, status: string) => {
    try {
      await apiRequest(`/api/nvv/${id}/status`, {
        method: 'PATCH',
        data: { status }
      });

      queryClient.invalidateQueries({ queryKey: ['/api/nvv/pending'] });
      queryClient.invalidateQueries({ queryKey: ['/api/nvv/metrics'] });

      toast({
        title: "Estado actualizado",
        description: `El estado se cambió a ${statusLabels[status]}`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo actualizar el estado",
        variant: "destructive",
      });
    }
  };

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
                      <TableHead>Vendedor</TableHead>
                      <TableHead>Cantidad</TableHead>
                      <TableHead>Monto</TableHead>
                      <TableHead>Fecha Compromiso</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingSales.map((sale) => (
                      <TableRow key={sale.id} data-testid={`sale-row-${sale.id}`}>
                        <TableCell className="font-medium">
                          <div>
                            <div className="font-semibold">{sale.documentNumber}</div>
                            <div className="text-sm text-gray-500">{sale.documentType}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{sale.clientName}</div>
                            <div className="text-sm text-gray-500">{sale.clientCode}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{sale.productName}</div>
                            <div className="text-sm text-gray-500">{sale.productCode}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{sale.salesperson}</div>
                            {sale.segment && (
                              <div className="text-sm text-gray-500">{sale.segment}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {(sale.quantity || 0).toLocaleString('es-CL')}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(Number(sale.totalAmount) || 0)}
                        </TableCell>
                        <TableCell>
                          {formatDate(sale.commitmentDate)}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={sale.status || 'pending'}
                            onValueChange={(value) => updateStatus(sale.id, value)}
                          >
                            <SelectTrigger className="w-32">
                              <Badge className={statusColors[sale.status || 'pending'] || "bg-gray-100 text-gray-800"}>
                                {statusLabels[sale.status || 'pending'] || sale.status}
                              </Badge>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">Pendiente</SelectItem>
                              <SelectItem value="confirmed">Confirmado</SelectItem>
                              <SelectItem value="delivered">Entregado</SelectItem>
                              <SelectItem value="cancelled">Cancelado</SelectItem>
                            </SelectContent>
                          </Select>
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
                    ))}
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