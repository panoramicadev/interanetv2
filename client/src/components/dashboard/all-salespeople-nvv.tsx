import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ShoppingCart, Package, DollarSign, User, ChevronDown, FileText, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface AllSalespeopleNVVProps {
  selectedPeriod: string;
  filterType: "day" | "month" | "year" | "range";
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

interface SalespersonGroup {
  salespersonCode: string;
  salespersonName: string;
  totalAmount: number;
  totalUnits: number;
  totalOrders: number;
  records: NVVRecord[];
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

export default function AllSalespeopleNVV({
  selectedPeriod,
  filterType
}: AllSalespeopleNVVProps) {
  const [showAll, setShowAll] = useState(false);
  
  const { data: salespeopleData, isLoading } = useQuery<SalespersonGroup[]>({
    queryKey: [`/api/nvv/all-by-salespeople`],
    queryFn: async () => {
      const response = await fetch(`/api/nvv/all-by-salespeople`, {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Error al cargar NVV pendientes');
      }
      return response.json();
    }
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Group each salesperson's records by client
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

  // Calculate global totals
  const totalPendingAmount = salespeopleData?.reduce((sum, sp) => sum + sp.totalAmount, 0) || 0;
  const totalPendingUnits = salespeopleData?.reduce((sum, sp) => sum + sp.totalUnits, 0) || 0;
  const totalOrders = salespeopleData?.reduce((sum, sp) => sum + sp.totalOrders, 0) || 0;
  const totalSalespeople = salespeopleData?.length || 0;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Notas de Venta Pendientes - Todos los Vendedores
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 bg-gray-100 rounded-lg animate-pulse" />
        </CardContent>
      </Card>
    );
  }

  if (!salespeopleData || salespeopleData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Notas de Venta Pendientes - Todos los Vendedores
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Package className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">
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
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Notas de Venta Pendientes - Todos los Vendedores
          </CardTitle>
          <div className="flex gap-2">
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
              {totalSalespeople} {totalSalespeople === 1 ? 'vendedor' : 'vendedores'}
            </Badge>
            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
              {totalOrders} {totalOrders === 1 ? 'pedido' : 'pedidos'}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex items-center gap-2 text-blue-700 mb-1">
              <ShoppingCart className="h-4 w-4" />
              <span className="text-xs font-medium">Total Pedidos</span>
            </div>
            <div className="text-2xl font-bold text-blue-900">{totalOrders}</div>
          </div>
          
          <div className="bg-purple-50 rounded-lg p-4">
            <div className="flex items-center gap-2 text-purple-700 mb-1">
              <Package className="h-4 w-4" />
              <span className="text-xs font-medium">Unidades Pendientes</span>
            </div>
            <div className="text-2xl font-bold text-purple-900">
              {totalPendingUnits.toLocaleString('es-CL', { maximumFractionDigits: 0 })}
            </div>
          </div>
          
          <div className="bg-amber-50 rounded-lg p-4">
            <div className="flex items-center gap-2 text-amber-700 mb-1">
              <DollarSign className="h-4 w-4" />
              <span className="text-xs font-medium">Monto Pendiente</span>
            </div>
            <div className="text-2xl font-bold text-amber-900">
              {formatCurrency(totalPendingAmount)}
            </div>
          </div>
        </div>

        {/* Grouped by Salesperson with nested Client Accordion */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Por Vendedor</h3>
          <div>
            <Accordion type="single" collapsible className="space-y-2">
              {(showAll ? salespeopleData : salespeopleData.slice(0, 5)).map((salespersonGroup) => {
              const clientGroups = groupRecordsByClient(salespersonGroup.records);
              
              return (
                <AccordionItem 
                  key={salespersonGroup.salespersonCode} 
                  value={salespersonGroup.salespersonCode}
                  className="border rounded-lg overflow-hidden"
                  data-testid={`salesperson-group-${salespersonGroup.salespersonCode}`}
                >
                  <AccordionTrigger 
                    className="px-4 py-3 hover:bg-gray-50 hover:no-underline"
                    data-testid={`salesperson-trigger-${salespersonGroup.salespersonCode}`}
                  >
                    <div className="flex items-center justify-between w-full pr-4">
                      <div className="flex items-center gap-3">
                        <div className="bg-green-100 p-2 rounded-lg">
                          <Users className="h-4 w-4 text-green-600" />
                        </div>
                        <div className="text-left">
                          <div className="font-semibold text-gray-900">{salespersonGroup.salespersonName}</div>
                          <div className="text-xs text-gray-500">
                            {clientGroups.length} {clientGroups.length === 1 ? 'cliente' : 'clientes'} • {salespersonGroup.totalOrders} {salespersonGroup.totalOrders === 1 ? 'documento' : 'documentos'}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="text-sm text-gray-500">Unidades</div>
                          <div className="font-semibold text-purple-700">
                            {salespersonGroup.totalUnits.toLocaleString('es-CL', { maximumFractionDigits: 0 })}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-gray-500">Monto Total</div>
                          <div className="font-bold text-amber-700">
                            {formatCurrency(salespersonGroup.totalAmount)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    <div className="bg-gray-50 rounded-lg p-4 mt-2">
                      <div className="flex items-center gap-2 mb-3 text-gray-700">
                        <User className="h-4 w-4" />
                        <span className="text-sm font-medium">Clientes</span>
                      </div>
                      
                      {/* Nested accordion for clients */}
                      <Accordion type="single" collapsible className="space-y-2">
                        {clientGroups.map((clientGroup) => (
                          <AccordionItem
                            key={`${salespersonGroup.salespersonCode}-${clientGroup.uniqueKey}`}
                            value={`${salespersonGroup.salespersonCode}-${clientGroup.uniqueKey}`}
                            className="border rounded-lg bg-white"
                            data-testid={`client-group-${clientGroup.uniqueKey}`}
                          >
                            <AccordionTrigger className="px-3 py-2 hover:bg-gray-50">
                              <div className="flex items-center justify-between w-full pr-4">
                                <div className="text-left">
                                  <div className="font-medium text-sm">{clientGroup.clientName}</div>
                                  <div className="text-xs text-gray-500">
                                    {clientGroup.totalOrders} {clientGroup.totalOrders === 1 ? 'documento' : 'documentos'}
                                  </div>
                                </div>
                                <div className="flex items-center gap-3">
                                  <div className="text-right">
                                    <div className="text-xs text-gray-500">Unidades</div>
                                    <div className="text-sm font-semibold text-purple-700">
                                      {clientGroup.totalUnits.toLocaleString('es-CL', { maximumFractionDigits: 0 })}
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <div className="text-xs text-gray-500">Monto</div>
                                    <div className="text-sm font-bold text-amber-700">
                                      {formatCurrency(clientGroup.totalAmount)}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent className="px-3 pb-3">
                              <div className="bg-gray-50 rounded p-3 mt-2 space-y-2">
                                {clientGroup.records.map((record) => (
                                  <div 
                                    key={record.id} 
                                    className="bg-white rounded border p-3"
                                    data-testid={`nvv-record-${record.id}`}
                                  >
                                    <div className="flex items-center justify-between mb-2">
                                      <div>
                                        <div className="font-semibold text-sm">{record.NUDO}</div>
                                        <div className="text-xs text-gray-500">{record.TIDO}</div>
                                      </div>
                                      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                                        {formatCurrency(record.totalPendiente)}
                                      </Badge>
                                    </div>
                                    <div className="text-xs text-gray-600 space-y-1">
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
                  </AccordionContent>
                </AccordionItem>
              );
              })}
            </Accordion>
            
            {/* Ver más button */}
            {salespeopleData.length > 5 && (
              <div className="mt-4 text-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAll(!showAll)}
                  className="w-full"
                  data-testid="button-toggle-show-all"
                >
                  {showAll ? 'Ver menos' : `Ver más (${salespeopleData.length - 5} más)`}
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
