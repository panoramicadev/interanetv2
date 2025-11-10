import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, FileText, Package, ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface Factura {
  idmaeedo: string;
  idmaeddo: string;
  tido: string;
  nudo: string;
  feemdo: string;
  nokoen: string;
  nokofu: string;
  noruen: string;
  nokopr: string;
  caprco2: string;
  monto: string;
  esdo: string;
}

export function FacturasTable() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const itemsPerPage = 50;

  const toggleRow = (id: string) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const buildQueryParams = () => {
    const params = new URLSearchParams();
    params.set('limit', itemsPerPage.toString());
    params.set('offset', ((currentPage - 1) * itemsPerPage).toString());
    
    // For salesperson role, the backend automatically filters by their name
    // For other roles, they see all transactions
    if (user?.role === 'salesperson' && (user as any).salespersonName) {
      params.set('salesperson', (user as any).salespersonName);
    }
    
    return params.toString();
  };

  const { data: facturas, isLoading, error } = useQuery<Factura[]>({
    queryKey: [`/api/sales/transactions?${buildQueryParams()}`],
  });

  const formatCurrency = (amount: string | number) => {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
    }).format(numAmount);
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return format(date, "dd MMM yyyy", { locale: es });
    } catch {
      return dateStr;
    }
  };

  const getDocumentTypeBadge = (tido: string) => {
    const types: { [key: string]: { label: string; variant: "default" | "secondary" | "destructive" | "outline" } } = {
      'FCV': { label: 'Factura', variant: 'default' },
      'BLV': { label: 'Boleta', variant: 'secondary' },
      'NCV': { label: 'Nota Crédito', variant: 'destructive' },
      'FDB': { label: 'Factura Débito', variant: 'outline' },
    };
    const type = types[tido] || { label: tido, variant: 'outline' as const };
    return <Badge variant={type.variant} data-testid={`badge-type-${tido}`}>{type.label}</Badge>;
  };

  const getStatusBadge = (esdo: string) => {
    const statuses: { [key: string]: { label: string; variant: "default" | "secondary" | "destructive" } } = {
      'E': { label: 'Emitida', variant: 'default' },
      'C': { label: 'Cancelada', variant: 'destructive' },
      'N': { label: 'Nula', variant: 'secondary' },
    };
    const status = statuses[esdo] || { label: esdo, variant: 'secondary' as const };
    return <Badge variant={status.variant} data-testid={`badge-status-${esdo}`}>{status.label}</Badge>;
  };

  // Filter facturas by search term
  const filteredFacturas = facturas?.filter(factura => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      factura.nokoen?.toLowerCase().includes(search) ||
      factura.nudo?.toLowerCase().includes(search) ||
      factura.nokofu?.toLowerCase().includes(search)
    );
  });

  const totalPages = filteredFacturas ? Math.ceil(filteredFacturas.length / itemsPerPage) : 1;

  // Stats calculations
  const stats = {
    total: filteredFacturas?.length || 0,
    facturas: filteredFacturas?.filter(f => f.tido === 'FCV').length || 0,
    boletas: filteredFacturas?.filter(f => f.tido === 'BLV').length || 0,
    notasCredito: filteredFacturas?.filter(f => f.tido === 'NCV').length || 0,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white" data-testid="title-facturas">Facturas</h2>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Gestiona y revisa todas las facturas del sistema
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card data-testid="card-total">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Total
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold" data-testid="text-total">{stats.total}</p>
          </CardContent>
        </Card>
        <Card data-testid="card-facturas">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Facturas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold" data-testid="text-facturas">{stats.facturas}</p>
          </CardContent>
        </Card>
        <Card data-testid="card-boletas">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Boletas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold" data-testid="text-boletas">{stats.boletas}</p>
          </CardContent>
        </Card>
        <Card data-testid="card-notas-credito">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Notas Crédito
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold" data-testid="text-notas-credito">{stats.notasCredito}</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Buscar por cliente, número de documento o vendedor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
            data-testid="input-search"
          />
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center" data-testid="text-loading">
              <p className="text-gray-500">Cargando facturas...</p>
            </div>
          ) : error ? (
            <div className="p-8 text-center" data-testid="text-error">
              <p className="text-red-500">Error al cargar las facturas</p>
            </div>
          ) : !filteredFacturas || filteredFacturas.length === 0 ? (
            <div className="p-8 text-center" data-testid="text-empty">
              <FileText className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500">No hay facturas</p>
              <p className="text-sm text-gray-400 mt-2">
                Aún no se han creado facturas en el sistema.
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12"></TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Número</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Vendedor</TableHead>
                      <TableHead className="text-right">Cantidad</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredFacturas.map((factura, index) => {
                      const rowId = `${factura.idmaeedo}-${factura.idmaeddo}-${index}`;
                      const isExpanded = expandedRows.has(rowId);
                      
                      return (
                        <>
                          <TableRow key={rowId} data-testid={`row-factura-${index}`} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleRow(rowId)}
                                className="h-8 w-8 p-0"
                                data-testid={`button-expand-${index}`}
                              >
                                {isExpanded ? (
                                  <ChevronUp className="h-4 w-4" />
                                ) : (
                                  <ChevronDown className="h-4 w-4" />
                                )}
                              </Button>
                            </TableCell>
                            <TableCell>{getDocumentTypeBadge(factura.tido)}</TableCell>
                            <TableCell className="font-medium" data-testid={`text-nudo-${index}`}>{factura.nudo}</TableCell>
                            <TableCell data-testid={`text-fecha-${index}`}>{formatDate(factura.feemdo)}</TableCell>
                            <TableCell className="max-w-[200px] truncate" data-testid={`text-cliente-${index}`}>{factura.nokoen}</TableCell>
                            <TableCell className="max-w-[150px] truncate" data-testid={`text-vendedor-${index}`}>{factura.nokofu}</TableCell>
                            <TableCell className="text-right" data-testid={`text-cantidad-${index}`}>{parseFloat(factura.caprco2 || '0').toFixed(2)}</TableCell>
                            <TableCell className="text-right font-semibold" data-testid={`text-monto-${index}`}>
                              {formatCurrency(factura.monto)}
                            </TableCell>
                            <TableCell>{getStatusBadge(factura.esdo)}</TableCell>
                          </TableRow>
                          {isExpanded && (
                            <TableRow key={`${rowId}-details`} className="bg-gray-50 dark:bg-gray-800/30">
                              <TableCell colSpan={9} className="py-4">
                                <div className="ml-12 space-y-2">
                                  <div className="flex items-center gap-2">
                                    <Package className="h-4 w-4 text-gray-500" />
                                    <span className="font-semibold text-sm">Producto:</span>
                                    <span className="text-sm" data-testid={`text-producto-detail-${index}`}>{factura.nokopr}</span>
                                  </div>
                                  {factura.noruen && (
                                    <div className="flex items-center gap-2">
                                      <FileText className="h-4 w-4 text-gray-500" />
                                      <span className="font-semibold text-sm">Segmento:</span>
                                      <span className="text-sm">{factura.noruen}</span>
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between px-6 py-4 border-t">
                <div className="text-sm text-gray-500" data-testid="text-pagination-info">
                  Mostrando {filteredFacturas.length} registros
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    data-testid="button-prev-page"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <div className="flex items-center gap-2 px-3">
                    <span className="text-sm" data-testid="text-current-page">Página {currentPage}</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => p + 1)}
                    disabled={!facturas || facturas.length < itemsPerPage}
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
