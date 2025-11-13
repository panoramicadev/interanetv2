import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X, Package, Calendar, User, MapPin, Hash, DollarSign, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface TransactionDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactionId: string;
  nudo?: string;
}

interface TransactionDetail {
  id: string;
  nudo: string;
  feemdo: string; // fecha
  nokoen: string; // cliente
  nokofu: string; // vendedor
  noruen: string; // segmento
  nokopr: string; // producto
  koprct: string; // SKU
  caprad2: number; // cantidad
  vanedo: number; // monto
  // Campos adicionales para mostrar más detalle
  tido?: string;
  endo?: string;
  modo?: string;
  vabrdo?: number;
  vaivdo?: number;
  ppprne?: number;
  ppprbr?: number;
  udtrpr?: number;
}

export default function TransactionDetailModal({ 
  isOpen, 
  onClose, 
  transactionId,
  nudo 
}: TransactionDetailModalProps) {
  // Fetch detalles específicos de la transacción
  const { data: transactionDetail, isLoading, error } = useQuery({
    queryKey: [`/api/transactions/${transactionId}/details`],
    enabled: isOpen && !!transactionId,
  });

  const transaction = transactionDetail as TransactionDetail;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
    }).format(amount || 0);
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "dd 'de' MMMM, yyyy", { locale: es });
    } catch {
      return dateStr;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Hash className="h-5 w-5 text-blue-600" />
              Detalle de Transacción
              {(nudo || transaction?.nudo) && (
                <Badge variant="outline" className="ml-2">
                  NUDO: {nudo || transaction?.nudo}
                </Badge>
              )}
            </DialogTitle>
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600">Cargando detalles...</span>
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <p className="text-red-600">Error al cargar los detalles de la transacción</p>
            <Button variant="outline" onClick={onClose} className="mt-4">
              Cerrar
            </Button>
          </div>
        ) : transaction ? (
          <div className="space-y-6">
            {/* Información General */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Información General
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Fecha:</span>
                      <span className="text-sm font-medium">
                        {formatDate(transaction.feemdo)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Cliente:</span>
                      <span className="text-sm font-medium">
                        {transaction.nokoen}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Vendedor:</span>
                      <span className="text-sm font-medium">
                        {transaction.nokofu}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Segmento:</span>
                      <span className="text-sm font-medium">
                        {transaction.noruen}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Tipo Documento:</span>
                      <span className="text-sm font-medium">
                        {transaction.tido || 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Número Documento:</span>
                      <span className="text-sm font-medium">
                        {transaction.endo || 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Detalle del Producto */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Producto
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h4 className="font-medium text-blue-900 mb-2">
                      {transaction.nokopr}
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">SKU:</span>
                        <p className="font-mono font-medium">{transaction.koprct}</p>
                      </div>
                      <div>
                        <span className="text-gray-600">Cantidad:</span>
                        <p className="font-medium">{transaction.caprad2?.toLocaleString()} unidades</p>
                      </div>
                      <div>
                        <span className="text-gray-600">Unidad de Medida:</span>
                        <p className="font-medium">{transaction.udtrpr || 'N/A'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Información Financiera */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Información Financiera
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center p-2 bg-green-50 rounded">
                      <span className="text-sm text-green-700">Total Venta:</span>
                      <span className="font-bold text-green-900">
                        {formatCurrency(transaction.vanedo)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Valor Bruto:</span>
                      <span className="text-sm font-medium">
                        {formatCurrency(transaction.vabrdo || 0)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Valor con IVA:</span>
                      <span className="text-sm font-medium">
                        {formatCurrency(transaction.vaivdo || 0)}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Precio Unitario Neto:</span>
                      <span className="text-sm font-medium">
                        {formatCurrency(transaction.ppprne || 0)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Precio Unitario Bruto:</span>
                      <span className="text-sm font-medium">
                        {formatCurrency(transaction.ppprbr || 0)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Factor Conversión:</span>
                      <span className="text-sm font-medium">
                        {transaction.udtrpr ? `1 ${transaction.udtrpr}` : 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Información Técnica */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Información Técnica
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">ID Transacción:</span>
                    <span className="font-mono text-xs">{transaction.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Modalidad:</span>
                    <span className="font-medium">{transaction.modo || 'N/A'}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Acciones */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="outline" onClick={onClose}>
                Cerrar
              </Button>
              <Button 
                onClick={() => {
                  // Aquí se puede agregar funcionalidad para imprimir o exportar
                  window.print();
                }}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Imprimir Detalle
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-600">No se encontraron detalles para esta transacción</p>
            <Button variant="outline" onClick={onClose} className="mt-4">
              Cerrar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}