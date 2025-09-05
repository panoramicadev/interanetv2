import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { ArrowLeft, TrendingUp, Users, ShoppingCart, DollarSign } from "lucide-react";
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

interface SegmentClient {
  clientName: string;
  totalSales: number;
  transactionCount: number;
  averageTicket: number;
  percentage: number;
}

export default function SegmentDetail() {
  const { segmentName } = useParams();
  
  // Get current period (could be enhanced with date filters later)
  const currentPeriod = new Date().toISOString().slice(0, 7); // YYYY-MM format
  
  const { data: clients = [], isLoading } = useQuery<SegmentClient[]>({
    queryKey: [`/api/sales/segment/${segmentName}/clients`, currentPeriod],
    enabled: !!segmentName,
  });

  if (!segmentName) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600">Segmento no encontrado</h1>
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

  // Calculate KPIs
  const totalSales = clients.reduce((sum: number, client: SegmentClient) => sum + client.totalSales, 0);
  const totalClients = clients.length;
  const totalTransactions = clients.reduce((sum: number, client: SegmentClient) => sum + client.transactionCount, 0);
  const averageTicket = totalTransactions > 0 ? totalSales / totalTransactions : 0;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('es-CO').format(num);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          {/* Breadcrumb */}
          <nav className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400 mb-4">
            <Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
              Dashboard
            </Link>
            <span>›</span>
            <span>Segmento</span>
            <span>›</span>
            <span className="font-medium text-gray-900 dark:text-gray-100">{segmentName}</span>
          </nav>

          {/* Title and Back Button */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Análisis de Segmento: {segmentName}
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                Análisis detallado de clientes para el período actual
              </p>
            </div>
            <Link href="/">
              <Button 
                variant="outline" 
                className="bg-white/80 backdrop-blur-sm hover:bg-white/90 transition-all duration-200"
                data-testid="button-back-dashboard"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Volver al Dashboard
              </Button>
            </Link>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg hover:shadow-xl transition-all duration-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Ventas</CardTitle>
              <DollarSign className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600" data-testid="text-total-sales">
                {formatCurrency(totalSales)}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg hover:shadow-xl transition-all duration-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Clientes</CardTitle>
              <Users className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600" data-testid="text-total-clients">
                {formatNumber(totalClients)}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg hover:shadow-xl transition-all duration-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Transacciones</CardTitle>
              <ShoppingCart className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600" data-testid="text-total-transactions">
                {formatNumber(totalTransactions)}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg hover:shadow-xl transition-all duration-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Ticket Promedio</CardTitle>
              <TrendingUp className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600" data-testid="text-average-ticket">
                {formatCurrency(averageTicket)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Clients Table */}
        <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl font-semibold flex items-center">
              <Users className="mr-2 h-5 w-5 text-blue-600" />
              Ranking de Clientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-2 text-gray-600">Cargando datos...</p>
              </div>
            ) : clients.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No se encontraron clientes para este segmento
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">Rank</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-right">Ventas Totales</TableHead>
                    <TableHead className="text-right">Transacciones</TableHead>
                    <TableHead className="text-right">Ticket Promedio</TableHead>
                    <TableHead className="text-right">% del Segmento</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clients.map((client: SegmentClient, index: number) => (
                    <TableRow 
                      key={client.clientName} 
                      className="hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors"
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
                        {client.clientName}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-green-600" data-testid={`text-client-sales-${index}`}>
                        {formatCurrency(client.totalSales)}
                      </TableCell>
                      <TableCell className="text-right" data-testid={`text-client-transactions-${index}`}>
                        {formatNumber(client.transactionCount)}
                      </TableCell>
                      <TableCell className="text-right" data-testid={`text-client-average-${index}`}>
                        {formatCurrency(client.averageTicket)}
                      </TableCell>
                      <TableCell className="text-right" data-testid={`text-client-percentage-${index}`}>
                        <span className="font-medium text-blue-600">
                          {client.percentage.toFixed(1)}%
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