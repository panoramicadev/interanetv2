import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Truck, Package, DollarSign, ChevronDown, User } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

interface SalespersonPendingGDVProps {
  salesperson: string;
}

interface GDVRecord {
  numeroGuia: string;
  fecha: string;
  cliente: string;
  codigoCliente: string;
  producto: string;
  cantidad: number;
  monto: number;
}

interface ClientGroup {
  uniqueKey: string;
  clientCode: string;
  clientName: string;
  totalAmount: number;
  totalUnits: number;
  totalGuias: number;
  records: GDVRecord[];
}

export default function SalespersonPendingGDV({
  salesperson
}: SalespersonPendingGDVProps) {
  const [showAll, setShowAll] = useState(false);
  
  const { data: gdvData, isLoading } = useQuery<GDVRecord[]>({
    queryKey: [`/api/gdv/by-salesperson`, salesperson],
    queryFn: async () => {
      const params = new URLSearchParams({ salesperson });
      const response = await fetch(`/api/gdv/by-salesperson?${params}`, {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Error al cargar GDV pendientes');
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

  const groupedByClient: ClientGroup[] = gdvData ? 
    Object.values(
      gdvData.reduce((acc, record) => {
        const normalizedCode = record.codigoCliente?.trim().toUpperCase() || '';
        const normalizedName = record.cliente?.trim().toUpperCase() || '';
        const uniqueKey = normalizedCode || normalizedName || 'SIN_CODIGO';
        const displayCode = record.codigoCliente?.trim() || record.cliente?.trim() || 'Sin código';
        const displayName = record.cliente?.trim() || 'Cliente sin nombre';
        
        if (!acc[uniqueKey]) {
          acc[uniqueKey] = {
            uniqueKey,
            clientCode: displayCode,
            clientName: displayName,
            totalAmount: 0,
            totalUnits: 0,
            totalGuias: 0,
            records: []
          };
        }
        
        acc[uniqueKey].totalAmount += record.monto || 0;
        acc[uniqueKey].totalUnits += record.cantidad || 0;
        acc[uniqueKey].totalGuias += 1;
        acc[uniqueKey].records.push(record);
        
        return acc;
      }, {} as Record<string, ClientGroup>)
    ).sort((a, b) => b.totalAmount - a.totalAmount) : [];

  const totalAmount = groupedByClient.reduce((sum, g) => sum + g.totalAmount, 0);
  const totalUnits = groupedByClient.reduce((sum, g) => sum + g.totalUnits, 0);
  const totalGuias = gdvData?.length || 0;
  const uniqueClients = groupedByClient.length;

  const displayedClients = showAll ? groupedByClient : groupedByClient.slice(0, 5);

  if (isLoading) {
    return (
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Truck className="h-5 w-5 text-purple-500" />
            Guías de Despacho Pendientes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-20 bg-gray-200 rounded" />
            <div className="h-20 bg-gray-200 rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!gdvData || gdvData.length === 0) {
    return null;
  }

  return (
    <Card className="border-0 shadow-sm" data-testid="salesperson-pending-gdv">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Truck className="h-5 w-5 text-purple-500" />
            Guías de Despacho Pendientes
          </CardTitle>
          <div className="flex gap-2">
            <Badge variant="outline" className="text-purple-600 border-purple-200 bg-purple-50">
              {uniqueClients} clientes
            </Badge>
            <Badge variant="outline" className="text-orange-600 border-orange-200 bg-orange-50">
              {totalGuias} líneas
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-3 border border-purple-200">
            <div className="flex items-center gap-2 text-purple-600 mb-1">
              <DollarSign className="h-4 w-4" />
              <span className="text-xs font-medium">Monto Pendiente</span>
            </div>
            <p className="text-lg font-bold text-purple-700">{formatCurrency(totalAmount)}</p>
          </div>
          
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-3 border border-blue-200">
            <div className="flex items-center gap-2 text-blue-600 mb-1">
              <Package className="h-4 w-4" />
              <span className="text-xs font-medium">Unidades Pendientes</span>
            </div>
            <p className="text-lg font-bold text-blue-700">{totalUnits.toLocaleString('es-CL')}</p>
          </div>
          
          <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-3 border border-orange-200">
            <div className="flex items-center gap-2 text-orange-600 mb-1">
              <Truck className="h-4 w-4" />
              <span className="text-xs font-medium">Total Líneas</span>
            </div>
            <p className="text-lg font-bold text-orange-700">{totalGuias}</p>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-500">Por Cliente</p>
          
          <Accordion type="multiple" className="space-y-2">
            {displayedClients.map((clientGroup, index) => (
              <AccordionItem 
                key={clientGroup.uniqueKey} 
                value={clientGroup.uniqueKey}
                className="border rounded-lg bg-white shadow-sm"
                data-testid={`gdv-client-${index}`}
              >
                <AccordionTrigger className="px-3 py-2 hover:no-underline hover:bg-gray-50">
                  <div className="flex items-center justify-between w-full mr-2">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-gray-400" />
                      <div className="text-left">
                        <p className="font-medium text-sm">{clientGroup.clientName}</p>
                        <p className="text-xs text-gray-500">{clientGroup.totalGuias} línea{clientGroup.totalGuias !== 1 ? 's' : ''}</p>
                      </div>
                    </div>
                    <div className="flex gap-4 text-right">
                      <div>
                        <p className="text-xs text-gray-500">Unidades</p>
                        <p className="text-sm font-semibold text-blue-600">{clientGroup.totalUnits.toLocaleString('es-CL')}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Monto Total</p>
                        <p className="text-sm font-semibold text-purple-600">{formatCurrency(clientGroup.totalAmount)}</p>
                      </div>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-3 pb-3">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Guía</TableHead>
                          <TableHead className="text-xs">Fecha</TableHead>
                          <TableHead className="text-xs">Producto</TableHead>
                          <TableHead className="text-xs text-right">Cant.</TableHead>
                          <TableHead className="text-xs text-right">Monto</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {clientGroup.records.map((record, idx) => (
                          <TableRow key={`${record.numeroGuia}-${idx}`}>
                            <TableCell className="text-xs font-medium">{record.numeroGuia}</TableCell>
                            <TableCell className="text-xs">{formatDate(record.fecha)}</TableCell>
                            <TableCell className="text-xs max-w-[200px] truncate" title={record.producto}>
                              {record.producto}
                            </TableCell>
                            <TableCell className="text-xs text-right">{record.cantidad.toLocaleString('es-CL')}</TableCell>
                            <TableCell className="text-xs text-right font-medium text-purple-600">
                              {formatCurrency(record.monto)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>

          {groupedByClient.length > 5 && (
            <button
              onClick={() => setShowAll(!showAll)}
              className="w-full py-2 text-sm text-purple-600 hover:text-purple-700 flex items-center justify-center gap-1"
              data-testid="toggle-gdv-clients"
            >
              <ChevronDown className={`h-4 w-4 transition-transform ${showAll ? 'rotate-180' : ''}`} />
              {showAll ? 'Ver menos' : `Ver todos los ${groupedByClient.length} clientes`}
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
