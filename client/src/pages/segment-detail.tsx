import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { ArrowLeft, TrendingUp, Users, ShoppingCart, DollarSign, UserCheck } from "lucide-react";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface SegmentClient {
  clientName: string;
  totalSales: number;
  transactionCount: number;
  averageTicket: number;
  percentage: number;
}

interface SegmentSalesperson {
  salespersonName: string;
  totalSales: number;
  transactionCount: number;
  averageTicket: number;
  percentage: number;
}

export default function SegmentDetail() {
  const { segmentName } = useParams();
  
  // Get current period (could be enhanced with date filters later)
  const currentPeriod = new Date().toISOString().slice(0, 7); // YYYY-MM format
  
  const { data: clients = [], isLoading: isLoadingClients } = useQuery<SegmentClient[]>({
    queryKey: [`/api/sales/segment/${segmentName}/clients?period=${currentPeriod}&filterType=month`],
    enabled: !!segmentName,
  });

  const { data: salespeople = [], isLoading: isLoadingSalespeople } = useQuery<SegmentSalesperson[]>({
    queryKey: [`/api/sales/segment/${segmentName}/salespeople?period=${currentPeriod}&filterType=month`],
    enabled: !!segmentName,
  });

  if (!segmentName) {
    return (
      <div className="min-h-screen flex items-center justify-center">
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

  // Calculate KPIs from both clients and salespeople
  const totalSalesFromClients = clients.reduce((sum: number, client: SegmentClient) => sum + client.totalSales, 0);
  const totalClients = clients.length;
  const totalTransactionsFromClients = clients.reduce((sum: number, client: SegmentClient) => sum + client.transactionCount, 0);
  const averageTicketFromClients = totalTransactionsFromClients > 0 ? totalSalesFromClients / totalTransactionsFromClients : 0;
  
  // Salespeople KPIs
  const totalSalespeople = salespeople.length;
  const totalSalesFromSalespeople = salespeople.reduce((sum: number, salesperson: SegmentSalesperson) => sum + salesperson.totalSales, 0);
  const totalTransactionsFromSalespeople = salespeople.reduce((sum: number, salesperson: SegmentSalesperson) => sum + salesperson.transactionCount, 0);

  // Use clients data for main KPIs (more accurate for customer perspective)
  const totalSales = totalSalesFromClients;
  const totalTransactions = totalTransactionsFromClients;
  const averageTicket = averageTicketFromClients;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('es-CL').format(num);
  };

  return (
    <div className="min-h-screen">
      <div className="w-full">
        {/* Header - Optimized for Mobile */}
        <header className="bg-white border-b border-gray-200/60 px-3 sm:px-4 lg:px-6 py-3 sm:py-4 lg:py-6 m-3 sm:m-4 rounded-2xl shadow-sm">
          <div className="flex flex-col space-y-2 sm:space-y-3 lg:space-y-0 lg:flex-row lg:items-center justify-between">
            <div className="min-w-0 flex-1">
              <nav className="flex items-center space-x-1 sm:space-x-2 text-xs sm:text-sm text-gray-600 mb-1 sm:mb-2">
                <Link href="/" className="hover:text-blue-600 transition-colors truncate">
                  Dashboard
                </Link>
                <span className="text-xs">›</span>
                <span className="hidden sm:inline">Segmento</span>
                <span className="hidden sm:inline text-xs">›</span>
                <span className="font-medium text-gray-900 truncate">{segmentName}</span>
              </nav>
              <h1 className="text-lg sm:text-xl lg:text-3xl font-bold text-gray-900 truncate">
                {segmentName}
              </h1>
              <p className="text-gray-600 text-xs sm:text-sm lg:text-lg hidden sm:block">
                Análisis detallado de clientes para el período actual
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
            <div className="modern-card p-3 sm:p-4 lg:p-6 hover-lift">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-muted-foreground mb-1 sm:mb-2">Total Ventas</p>
                  <p className="text-base sm:text-lg lg:text-2xl font-bold text-green-600" data-testid="text-total-sales">
                    {formatCurrency(totalSales)}
                  </p>
                </div>
                <div className="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 bg-green-100 rounded-xl flex items-center justify-center ml-2 sm:ml-4 flex-shrink-0">
                  <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 text-green-600" />
                </div>
              </div>
            </div>

            <div className="modern-card p-3 sm:p-4 lg:p-6 hover-lift">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-muted-foreground mb-1 sm:mb-2">Clientes / Vendedores</p>
                  <p className="text-base sm:text-lg lg:text-2xl font-bold text-blue-600" data-testid="text-total-clients">
                    {formatNumber(totalClients)} / {formatNumber(totalSalespeople)}
                  </p>
                </div>
                <div className="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 bg-blue-100 rounded-xl flex items-center justify-center ml-2 sm:ml-4 flex-shrink-0">
                  <Users className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 text-blue-600" />
                </div>
              </div>
            </div>

            <div className="modern-card p-3 sm:p-4 lg:p-6 hover-lift">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-muted-foreground mb-1 sm:mb-2">Transacciones</p>
                  <p className="text-base sm:text-lg lg:text-2xl font-bold text-purple-600" data-testid="text-total-transactions">
                    {formatNumber(totalTransactions)}
                  </p>
                </div>
                <div className="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 bg-purple-100 rounded-xl flex items-center justify-center ml-2 sm:ml-4 flex-shrink-0">
                  <ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 text-purple-600" />
                </div>
              </div>
            </div>

            <div className="modern-card p-3 sm:p-4 lg:p-6 hover-lift">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-muted-foreground mb-1 sm:mb-2">Ticket Promedio</p>
                  <p className="text-base sm:text-lg lg:text-2xl font-bold text-orange-600" data-testid="text-average-ticket">
                    {formatCurrency(averageTicket)}
                  </p>
                </div>
                <div className="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 bg-orange-100 rounded-xl flex items-center justify-center ml-2 sm:ml-4 flex-shrink-0">
                  <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 text-orange-600" />
                </div>
              </div>
            </div>
          </div>

          {/* Data Tables */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 lg:gap-6">
            {/* Top Clients Table */}
            <div className="modern-card p-3 sm:p-4 lg:p-6 hover-lift">
              <div className="flex items-center space-x-2 sm:space-x-3 mb-3 sm:mb-4">
                <div className="w-6 h-6 sm:w-8 sm:h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Users className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
                </div>
                <h2 className="text-base sm:text-lg lg:text-xl font-bold text-gray-900">Top Clientes del Segmento</h2>
              </div>
              
              <div className="space-y-3">
                {isLoadingClients ? (
                  <div className="space-y-3">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="animate-pulse h-12 bg-gray-200 rounded"></div>
                    ))}
                  </div>
                ) : clients.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No hay clientes en este segmento</p>
                ) : (
                  clients.slice(0, 8).map((client, index) => (
                    <Link key={client.clientName} href={`/client/${encodeURIComponent(client.clientName)}`}>
                      <div className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {client.clientName}
                          </p>
                          <p className="text-xs text-gray-500">
                            {formatNumber(client.transactionCount)} transacciones
                          </p>
                        </div>
                        <div className="text-right ml-4">
                          <p className="text-sm font-semibold text-gray-900">
                            {formatCurrency(client.totalSales)}
                          </p>
                          <p className="text-xs text-gray-500">
                            {client.percentage.toFixed(1)}%
                          </p>
                        </div>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </div>

            {/* Top Salespeople Table */}
            <div className="modern-card p-3 sm:p-4 lg:p-6 hover-lift">
              <div className="flex items-center space-x-2 sm:space-x-3 mb-3 sm:mb-4">
                <div className="w-6 h-6 sm:w-8 sm:h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <UserCheck className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
                </div>
                <h2 className="text-base sm:text-lg lg:text-xl font-bold text-gray-900">Top Vendedores del Segmento</h2>
              </div>
              
              <div className="space-y-3">
                {isLoadingSalespeople ? (
                  <div className="space-y-3">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="animate-pulse h-12 bg-gray-200 rounded"></div>
                    ))}
                  </div>
                ) : salespeople.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No hay vendedores en este segmento</p>
                ) : (
                  salespeople.slice(0, 8).map((salesperson, index) => (
                    <Link key={salesperson.salespersonName} href={`/salesperson/${encodeURIComponent(salesperson.salespersonName)}`}>
                      <div className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {salesperson.salespersonName}
                          </p>
                          <p className="text-xs text-gray-500">
                            {formatNumber(salesperson.transactionCount)} transacciones
                          </p>
                        </div>
                        <div className="text-right ml-4">
                          <p className="text-sm font-semibold text-gray-900">
                            {formatCurrency(salesperson.totalSales)}
                          </p>
                          <p className="text-xs text-gray-500">
                            {salesperson.percentage.toFixed(1)}%
                          </p>
                        </div>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}