import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { ArrowLeft, TrendingUp, Users, ShoppingCart, DollarSign, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface SalespersonDetails {
  totalSales: number;
  totalClients: number;
  transactionCount: number;
  averageTicket: number;
  salesFrequency: number; // days between sales
}

interface SalespersonClient {
  clientName: string;
  totalSales: number;
  transactionCount: number;
  averageTicket: number;
  lastSale: string;
  daysSinceLastSale: number;
}

export default function SalespersonDetail() {
  const { salespersonName } = useParams();
  
  // Get current period (could be enhanced with date filters later)
  const currentPeriod = new Date().toISOString().slice(0, 7); // YYYY-MM format
  
  const { data: details, isLoading: isLoadingDetails } = useQuery<SalespersonDetails>({
    queryKey: [`/api/sales/salesperson/${salespersonName}/details?period=${currentPeriod}&filterType=month`],
    enabled: !!salespersonName,
  });

  const { data: clients = [], isLoading: isLoadingClients } = useQuery<SalespersonClient[]>({
    queryKey: [`/api/sales/salesperson/${salespersonName}/clients?period=${currentPeriod}&filterType=month`],
    enabled: !!salespersonName,
  });

  if (!salespersonName) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600">Vendedor no encontrado</h1>
          <Link href="/">
            <Button variant="outline" className="mt-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver al Dashboard
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('es-CO').format(num);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-CO');
  };

  const getFrequencyDescription = (days: number) => {
    if (days < 1) return 'Diario';
    if (days < 7) return `Cada ${Math.round(days)} días`;
    if (days < 30) return `Cada ${Math.round(days / 7)} semanas`;
    return `Cada ${Math.round(days / 30)} meses`;
  };

  const getDaysColor = (days: number) => {
    if (days <= 7) return 'text-green-600';
    if (days <= 30) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="min-h-screen gradient-bg-alt">
      <div className="container mx-auto px-4 lg:px-6 py-6 lg:py-8">
        
        {/* Header */}
        <div className="glass-card p-6 rounded-2xl mb-6 lg:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
              <Link href="/">
                <Button variant="outline" size="sm" className="w-fit glass-card hover-scale">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Dashboard
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl lg:text-3xl font-bold text-gradient">
                  Análisis de Vendedor
                </h1>
                <p className="text-lg lg:text-xl text-foreground mt-1 font-semibold">
                  {decodeURIComponent(salespersonName)}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Período: {new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long' })}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-6 lg:mb-8">
          <div className="modern-card p-6 hover-scale">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground mb-2">Ventas Totales</p>
                <p className="text-xl lg:text-2xl font-bold text-green-600" data-testid="text-total-sales">
                  {isLoadingDetails ? 'Cargando...' : formatCurrency(details?.totalSales || 0)}
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/20 rounded-xl flex items-center justify-center ml-4">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="modern-card p-6 hover-scale">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground mb-2">Clientes Atendidos</p>
                <p className="text-xl lg:text-2xl font-bold text-blue-600" data-testid="text-total-clients">
                  {isLoadingDetails ? 'Cargando...' : formatNumber(details?.totalClients || 0)}
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-xl flex items-center justify-center ml-4">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="modern-card p-6 hover-scale">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground mb-2">Transacciones</p>
                <p className="text-xl lg:text-2xl font-bold text-purple-600" data-testid="text-transaction-count">
                  {isLoadingDetails ? 'Cargando...' : formatNumber(details?.transactionCount || 0)}
                </p>
              </div>
              <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/20 rounded-xl flex items-center justify-center ml-4">
                <ShoppingCart className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>

          <div className="modern-card p-6 hover-scale">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground mb-2">Frecuencia de Ventas</p>
                <p className="text-xl lg:text-2xl font-bold text-orange-600" data-testid="text-sales-frequency">
                  {isLoadingDetails ? 'Cargando...' : getFrequencyDescription(details?.salesFrequency || 0)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {isLoadingDetails ? '' : `${details?.salesFrequency || 0} días promedio`}
                </p>
              </div>
              <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/20 rounded-xl flex items-center justify-center ml-4">
                <Clock className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Secondary KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6 mb-6 lg:mb-8">
          <div className="modern-card p-6 hover-scale">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground mb-2">Ticket Promedio</p>
                <p className="text-xl lg:text-2xl font-bold text-indigo-600" data-testid="text-average-ticket">
                  {isLoadingDetails ? 'Cargando...' : formatCurrency(details?.averageTicket || 0)}
                </p>
              </div>
              <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/20 rounded-xl flex items-center justify-center ml-4">
                <TrendingUp className="w-6 h-6 text-indigo-600" />
              </div>
            </div>
          </div>

          <div className="modern-card p-6 hover-scale">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground mb-2">Ventas por Cliente</p>
                <p className="text-xl lg:text-2xl font-bold text-cyan-600" data-testid="text-sales-per-client">
                  {isLoadingDetails ? 'Cargando...' : formatCurrency((details?.totalSales || 0) / Math.max(1, details?.totalClients || 1))}
                </p>
              </div>
              <div className="w-12 h-12 bg-cyan-100 dark:bg-cyan-900/20 rounded-xl flex items-center justify-center ml-4">
                <Users className="w-6 h-6 text-cyan-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Clients Table */}
        <div className="modern-card p-6 hover-lift">
          <div className="mb-6">
            <h2 className="text-xl font-semibold flex items-center text-gradient mb-2">
              <Users className="mr-2 h-5 w-5 text-blue-600" />
              Principales Clientes ({clients.length})
            </h2>
            <p className="text-sm text-muted-foreground">
              Ranking de clientes por ventas, con análisis de frecuencia de compras
            </p>
          </div>
          <div>
            {isLoadingClients ? (
              <div className="text-center py-8">
                <div className="skeleton h-8 w-8 rounded-full mx-auto"></div>
                <p className="mt-2 text-muted-foreground">Cargando clientes...</p>
              </div>
            ) : clients.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No se encontraron clientes para este vendedor
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">Rank</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-right">Ventas Totales</TableHead>
                    <TableHead className="text-right">Transacciones</TableHead>
                    <TableHead className="text-right">Última Venta</TableHead>
                    <TableHead className="text-right">Días desde Última Venta</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clients.map((client: SalespersonClient, index: number) => (
                    <TableRow 
                      key={client.clientName} 
                      className="hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                      data-testid={`row-client-${index}`}
                    >
                      <TableCell className="font-medium">
                        <Badge 
                          variant={index < 3 ? "default" : "secondary"}
                          className={
                            index === 0 ? "bg-yellow-500 hover:bg-yellow-600" :
                            index === 1 ? "bg-gray-400 hover:bg-gray-500" :
                            index === 2 ? "bg-orange-500 hover:bg-orange-600" :
                            ""
                          }
                        >
                          #{index + 1}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium" data-testid={`text-client-name-${index}`}>
                        <Link href={`/client/${encodeURIComponent(client.clientName)}`}>
                          <span className="hover:text-blue-600 hover:underline cursor-pointer">
                            {client.clientName}
                          </span>
                        </Link>
                      </TableCell>
                      <TableCell className="text-right font-semibold text-green-600" data-testid={`text-client-sales-${index}`}>
                        {formatCurrency(client.totalSales)}
                      </TableCell>
                      <TableCell className="text-right" data-testid={`text-client-transactions-${index}`}>
                        {formatNumber(client.transactionCount)}
                      </TableCell>
                      <TableCell className="text-right" data-testid={`text-client-last-sale-${index}`}>
                        {formatDate(client.lastSale)}
                      </TableCell>
                      <TableCell className="text-right" data-testid={`text-client-days-since-${index}`}>
                        <span className={`font-medium ${getDaysColor(client.daysSinceLastSale)}`}>
                          {client.daysSinceLastSale} días
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}