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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <div className="container mx-auto px-4 py-8">
        
        {/* Header */}
        <div className="mb-8">
          <Link href="/">
            <Button variant="outline" className="mb-4 hover:bg-blue-50 dark:hover:bg-slate-800">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver al Dashboard
            </Button>
          </Link>
          <div className="bg-white/80 backdrop-blur-sm rounded-lg p-6 border-0 shadow-lg">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Análisis de Vendedor
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-300 mt-2 font-semibold">
              {decodeURIComponent(salespersonName)}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Período: {new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long' })}
            </p>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Ventas Totales</CardTitle>
              <DollarSign className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600" data-testid="text-total-sales">
                {isLoadingDetails ? 'Cargando...' : formatCurrency(details?.totalSales || 0)}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Clientes Atendidos</CardTitle>
              <Users className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600" data-testid="text-total-clients">
                {isLoadingDetails ? 'Cargando...' : formatNumber(details?.totalClients || 0)}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Transacciones</CardTitle>
              <ShoppingCart className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600" data-testid="text-transaction-count">
                {isLoadingDetails ? 'Cargando...' : formatNumber(details?.transactionCount || 0)}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Frecuencia de Ventas</CardTitle>
              <Clock className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600" data-testid="text-sales-frequency">
                {isLoadingDetails ? 'Cargando...' : getFrequencyDescription(details?.salesFrequency || 0)}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {isLoadingDetails ? '' : `${details?.salesFrequency || 0} días promedio`}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Secondary KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Ticket Promedio</CardTitle>
              <TrendingUp className="h-4 w-4 text-indigo-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-indigo-600" data-testid="text-average-ticket">
                {isLoadingDetails ? 'Cargando...' : formatCurrency(details?.averageTicket || 0)}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Ventas por Cliente</CardTitle>
              <Users className="h-4 w-4 text-cyan-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-cyan-600" data-testid="text-sales-per-client">
                {isLoadingDetails ? 'Cargando...' : formatCurrency((details?.totalSales || 0) / Math.max(1, details?.totalClients || 1))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Clients Table */}
        <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl font-semibold flex items-center">
              <Users className="mr-2 h-5 w-5 text-blue-600" />
              Principales Clientes ({clients.length})
            </CardTitle>
            <p className="text-sm text-gray-500">
              Ranking de clientes por ventas, con análisis de frecuencia de compras
            </p>
          </CardHeader>
          <CardContent>
            {isLoadingClients ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-2 text-gray-600">Cargando clientes...</p>
              </div>
            ) : clients.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}