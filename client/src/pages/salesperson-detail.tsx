import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { ArrowLeft, TrendingUp, Users, ShoppingCart, DollarSign, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Sidebar from "@/components/dashboard/sidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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
  const [showImportDialog, setShowImportDialog] = useState(false);
  
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
      <div className="flex min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <Sidebar onImportClick={() => setShowImportDialog(true)} />
        <div className="flex-1 lg:ml-64">
          <div className="min-h-screen flex items-center justify-center">
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
        </div>
      </div>
    );
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('es-CL').format(num);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-CL');
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
    <div className="flex min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <Sidebar onImportClick={() => setShowImportDialog(true)} />
      <div className="flex-1 lg:ml-64 transition-all duration-300">
        {/* Header - Optimized for Mobile */}
        <header className="bg-white border-b border-gray-200/60 px-3 sm:px-4 lg:px-6 py-3 sm:py-4 lg:py-6 m-3 sm:m-4 rounded-2xl shadow-sm">
          <div className="flex flex-col space-y-2 sm:space-y-3 lg:space-y-0 lg:flex-row lg:items-center justify-between">
            <div className="min-w-0 flex-1">
              <nav className="flex items-center space-x-1 sm:space-x-2 text-xs sm:text-sm text-gray-600 mb-1 sm:mb-2">
                <Link href="/" className="hover:text-blue-600 transition-colors truncate">
                  Dashboard
                </Link>
                <span className="text-xs">›</span>
                <span className="hidden sm:inline">Vendedor</span>
                <span className="hidden sm:inline text-xs">›</span>
                <span className="font-medium text-gray-900 truncate">{decodeURIComponent(salespersonName)}</span>
              </nav>
              <h1 className="text-lg sm:text-xl lg:text-3xl font-bold text-gray-900 truncate">
                {decodeURIComponent(salespersonName)}
              </h1>
              <p className="text-gray-500 text-xs sm:text-sm hidden sm:block">
                Período: {new Date().toLocaleDateString('es-CL', { year: 'numeric', month: 'long' })}
              </p>
            </div>
            <Link href="/" className="self-start lg:self-center">
              <Button 
                variant="outline" 
                size="sm"
                className="rounded-xl border-gray-200 shadow-sm text-xs sm:text-sm"
                data-testid="button-back-dashboard"
              >
                <ArrowLeft className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Volver al Dashboard</span>
                <span className="sm:hidden">Volver</span>
              </Button>
            </Link>
          </div>
        </header>

        {/* Main Content */}
        <main className="p-3 sm:p-4 lg:p-6 space-y-4 lg:space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
            {/* Sales Total Card */}
            <div className="bg-gradient-to-br from-green-50 to-emerald-100 border border-green-200 rounded-2xl p-3 sm:p-4 lg:p-6 hover:shadow-lg transition-all duration-300">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-green-700 mb-1 sm:mb-2">Ventas Totales</p>
                  <p className="text-lg sm:text-xl lg:text-2xl font-bold text-green-800" data-testid="text-total-sales">
                    {isLoadingDetails ? 'Cargando...' : formatCurrency(details?.totalSales || 0)}
                  </p>
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 lg:w-14 lg:h-14 bg-green-500 rounded-2xl flex items-center justify-center ml-2 sm:ml-4 shadow-lg flex-shrink-0">
                  <DollarSign className="w-5 h-5 sm:w-6 sm:h-6 lg:w-7 lg:h-7 text-white" />
                </div>
              </div>
            </div>

            {/* Clients Card */}
            <div className="bg-gradient-to-br from-blue-50 to-sky-100 border border-blue-200 rounded-2xl p-3 sm:p-4 lg:p-6 hover:shadow-lg transition-all duration-300">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-blue-700 mb-1 sm:mb-2">Clientes</p>
                  <p className="text-lg sm:text-xl lg:text-2xl font-bold text-blue-800" data-testid="text-total-clients">
                    {isLoadingDetails ? 'Cargando...' : formatNumber(details?.totalClients || 0)}
                  </p>
                  <div className="text-xs text-blue-600 font-medium mt-1">
                    Atendidos
                  </div>
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 lg:w-14 lg:h-14 bg-blue-500 rounded-2xl flex items-center justify-center ml-2 sm:ml-4 shadow-lg flex-shrink-0">
                  <Users className="w-5 h-5 sm:w-6 sm:h-6 lg:w-7 lg:h-7 text-white" />
                </div>
              </div>
            </div>

            {/* Transactions Card */}
            <div className="bg-gradient-to-br from-purple-50 to-violet-100 border border-purple-200 rounded-2xl p-3 sm:p-4 lg:p-6 hover:shadow-lg transition-all duration-300">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-purple-700 mb-1 sm:mb-2">Transacciones</p>
                  <p className="text-lg sm:text-xl lg:text-2xl font-bold text-purple-800" data-testid="text-transaction-count">
                    {isLoadingDetails ? 'Cargando...' : formatNumber(details?.transactionCount || 0)}
                  </p>
                  <div className="text-xs text-purple-600 font-medium mt-1">
                    Realizadas
                  </div>
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 lg:w-14 lg:h-14 bg-purple-500 rounded-2xl flex items-center justify-center ml-2 sm:ml-4 shadow-lg flex-shrink-0">
                  <ShoppingCart className="w-5 h-5 sm:w-6 sm:h-6 lg:w-7 lg:h-7 text-white" />
                </div>
              </div>
            </div>

            {/* Frequency Card */}
            <div className="bg-gradient-to-br from-orange-50 to-amber-100 border border-orange-200 rounded-2xl p-3 sm:p-4 lg:p-6 hover:shadow-lg transition-all duration-300">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-orange-700 mb-1 sm:mb-2">Frecuencia</p>
                  <p className="text-lg sm:text-xl lg:text-2xl font-bold text-orange-800" data-testid="text-sales-frequency">
                    {isLoadingDetails ? 'Cargando...' : getFrequencyDescription(details?.salesFrequency || 0)}
                  </p>
                  <div className="text-xs text-orange-600 font-medium mt-1">
                    de Ventas
                  </div>
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 lg:w-14 lg:h-14 bg-orange-500 rounded-2xl flex items-center justify-center ml-2 sm:ml-4 shadow-lg flex-shrink-0">
                  <Clock className="w-5 h-5 sm:w-6 sm:h-6 lg:w-7 lg:h-7 text-white" />
                </div>
              </div>
            </div>
          </div>

          {/* Secondary Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
            {/* Average Ticket */}
            <div className="bg-gradient-to-br from-indigo-50 to-blue-100 border border-indigo-200 rounded-2xl p-6 hover:shadow-lg transition-all duration-300">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-indigo-700 mb-2">Ticket Promedio</p>
                  <p className="text-3xl font-bold text-indigo-800" data-testid="text-average-ticket">
                    {isLoadingDetails ? 'Cargando...' : formatCurrency(details?.averageTicket || 0)}
                  </p>
                  <div className="text-xs text-indigo-600 font-medium mt-2">
                    Por transacción
                  </div>
                </div>
                <div className="w-14 h-14 bg-indigo-500 rounded-2xl flex items-center justify-center ml-4 shadow-lg">
                  <TrendingUp className="w-7 h-7 text-white" />
                </div>
              </div>
            </div>

            {/* Productivity */}
            <div className="bg-gradient-to-br from-teal-50 to-cyan-100 border border-teal-200 rounded-2xl p-6 hover:shadow-lg transition-all duration-300">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-teal-700 mb-2">Productividad</p>
                  <p className="text-3xl font-bold text-teal-800">
                    {isLoadingDetails ? 'Cargando...' : details?.totalClients && details?.transactionCount 
                      ? (details.transactionCount / details.totalClients).toFixed(1) 
                      : '0.0'} 
                    <span className="text-sm text-muted-foreground ml-1">trans/cliente</span>
                  </p>
                  <div className="text-xs text-teal-600 font-medium mt-2">
                    Transacciones por cliente
                  </div>
                </div>
                <div className="w-14 h-14 bg-teal-500 rounded-2xl flex items-center justify-center ml-4 shadow-lg">
                  <TrendingUp className="w-7 h-7 text-white" />
                </div>
              </div>
            </div>
          </div>

          {/* Clients Table */}
          <div className="modern-card p-5 lg:p-6 hover-lift">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Clientes del Vendedor</h2>
            </div>
            
            <div className="space-y-3">
              {isLoadingClients ? (
                <div className="space-y-3">
                  {[...Array(8)].map((_, i) => (
                    <div key={i} className="animate-pulse h-16 bg-gray-200 rounded-lg"></div>
                  ))}
                </div>
              ) : clients.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No hay clientes registrados para este vendedor</p>
              ) : (
                clients.map((client, index) => (
                  <Link key={client.clientName} href={`/client/${encodeURIComponent(client.clientName)}`}>
                    <div 
                      className="flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                      data-testid={`client-${index}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-3">
                          <div className="flex-shrink-0">
                            <Badge variant="outline" className="text-xs">
                              #{index + 1}
                            </Badge>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {client.clientName}
                            </p>
                            <div className="flex items-center space-x-4 mt-1">
                              <p className="text-xs text-gray-500">
                                {formatNumber(client.transactionCount)} transacciones
                              </p>
                              <p className="text-xs text-gray-500">
                                Ticket: {formatCurrency(client.averageTicket)}
                              </p>
                              <p className={`text-xs ${getDaysColor(client.daysSinceLastSale)}`}>
                                Última venta: {client.daysSinceLastSale} días
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="text-right ml-4">
                        <p className="text-sm font-semibold text-gray-900">
                          {formatCurrency(client.totalSales)}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatDate(client.lastSale)}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}