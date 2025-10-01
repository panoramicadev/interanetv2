import { useQuery } from "@tanstack/react-query";
import { Users, User, Building2, Phone, Mail, MapPin, CreditCard, TrendingUp, Calendar } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface TopClient {
  clientName: string;
  totalSales: number;
  transactionCount: number;
}

interface TopClientsResponse {
  items: TopClient[];
  periodTotalSales: number;
}

interface Client {
  id: string;
  koen: string | null;
  nokoen: string;
  rten: string | null;
  email: string | null;
  foen: string | null;
  dien: string | null;
  crlt: string | null;
  cren: string | null;
  crsd: string | null;
  gien: string | null;
  sien: string | null;
  totalTransactions?: number;
  totalSales?: number;
  lastTransactionDate?: string;
}

interface TopClientsPanelProps {
  selectedPeriod: string;
  filterType: "day" | "month" | "year" | "range";
  segment?: string;
  salesperson?: string;
}

export default function TopClientsPanel({ selectedPeriod, filterType, segment, salesperson }: TopClientsPanelProps) {
  const [displayedCount, setDisplayedCount] = useState(10); // Start with 10 clients
  const apiLimit = 5000; // Get all data from API
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [loadingClientDetails, setLoadingClientDetails] = useState(false);
  
  const { data: topClientsResponse, isLoading } = useQuery<TopClientsResponse>({
    queryKey: [`/api/sales/top-clients?limit=${apiLimit}&period=${selectedPeriod}&filterType=${filterType}${segment ? `&segment=${encodeURIComponent(segment)}` : ''}${salesperson ? `&salesperson=${encodeURIComponent(salesperson)}` : ''}`],
  });

  const topClients = topClientsResponse?.items;
  const periodTotal = topClientsResponse?.periodTotalSales || 0;

  const formatCurrency = (amount: number | string | null) => {
    if (!amount) return "CLP $0";
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
    }).format(numAmount);
  };

  const formatDate = (date: string | null) => {
    if (!date) return "Sin datos";
    return new Date(date).toLocaleDateString('es-CL');
  };

  const getCreditStatus = (available: string | null, limit: string | null, debt: string | null) => {
    if (!limit) return { status: "sin-limite", text: "Sin límite", color: "bg-gray-500" };
    
    const availableNum = available ? parseFloat(available) : 0;
    const limitNum = parseFloat(limit);
    const debtNum = debt ? parseFloat(debt) : 0;
    
    const usagePercentage = ((limitNum - availableNum) / limitNum) * 100;
    
    if (debtNum > 0) return { status: "con-deuda", text: "Con deuda", color: "bg-red-500" };
    if (usagePercentage > 80) return { status: "limite-alto", text: "Límite alto", color: "bg-orange-500" };
    if (usagePercentage > 50) return { status: "limite-medio", text: "Uso moderado", color: "bg-yellow-500" };
    return { status: "limite-bajo", text: "Buen estado", color: "bg-green-500" };
  };

  const openClientDetails = async (clientName: string) => {
    setLoadingClientDetails(true);
    try {
      const response = await fetch(`/api/clients?search=${encodeURIComponent(clientName)}&limit=1`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Error al cargar cliente');
      
      const data = await response.json();
      if (data.clients && data.clients.length > 0) {
        setSelectedClient(data.clients[0]);
        setIsClientModalOpen(true);
      }
    } catch (error) {
      console.error('Error loading client details:', error);
    } finally {
      setLoadingClientDetails(false);
    }
  };

  // Calculate percentages based on period total
  const clientsWithPercentage = topClients?.map(client => ({
    ...client,
    percentage: periodTotal > 0 ? (client.totalSales / periodTotal) * 100 : 0
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2 sm:space-x-3">
          <div className="w-6 h-6 sm:w-8 sm:h-8 bg-blue-100 rounded-lg flex items-center justify-center">
            <Users className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-gray-900">Clientes</h2>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/clientes">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs px-3 py-1"
              data-testid="button-view-all-clients"
            >
              Ver todos
            </Button>
          </Link>
        </div>
      </div>
      
      <div className="bg-white rounded-xl border border-gray-200/60 p-3 sm:p-6 shadow-sm">
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center justify-between animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-32"></div>
                <div className="h-4 bg-gray-200 rounded w-12"></div>
                <div className="flex-1 mx-4">
                  <div className="h-6 bg-gray-200 rounded"></div>
                </div>
                <div className="h-4 bg-gray-200 rounded w-16"></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {clientsWithPercentage?.slice(0, displayedCount).map((client, index) => (
              <div
                key={client.clientName}
                onClick={() => openClientDetails(client.clientName)}
                className="block hover:bg-gray-50/50 rounded-lg transition-colors cursor-pointer"
              >
                <div 
                  className="flex flex-col sm:flex-row sm:items-center py-2 sm:py-3 space-y-2 sm:space-y-0"
                  data-testid={`client-${index}`}
                >
                  {/* Nombre del cliente y monto - Mobile */}
                  <div className="flex justify-between items-center sm:hidden">
                    <p className="text-sm text-gray-700 font-medium truncate flex-1 min-w-0 pr-2">
                      {client.clientName}
                    </p>
                    <div className="flex items-center space-x-2 shrink-0">
                      <span className="text-xs text-gray-600">
                        {client.percentage.toFixed(1)}%
                      </span>
                      <span className="text-sm font-semibold text-gray-900">
                        {formatCurrency(client.totalSales)}
                      </span>
                    </div>
                  </div>
                  
                  {/* Desktop Layout */}
                  <div className="hidden sm:flex sm:items-center w-full">
                    {/* Nombre del cliente */}
                    <div className="w-32 lg:w-48 flex-shrink-0">
                      <p className="text-sm text-gray-700 font-medium truncate">
                        {client.clientName}
                      </p>
                    </div>
                    
                    {/* Porcentaje */}
                    <div className="w-12 flex-shrink-0 text-center">
                      <span className="text-sm text-gray-600">
                        {client.percentage.toFixed(1)}%
                      </span>
                    </div>
                    
                    {/* Barra de progreso */}
                    <div className="flex-1 mx-2 lg:mx-4">
                      <div className="relative">
                        <div className="h-6 bg-gray-100 rounded-lg overflow-hidden">
                          <div 
                            className="h-full bg-blue-500 rounded-lg transition-all duration-500 ease-out"
                            style={{ width: `${client.percentage}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Monto */}
                    <div className="w-20 flex-shrink-0 text-right">
                      <span className="text-sm font-semibold text-gray-900">
                        {formatCurrency(client.totalSales)}
                      </span>
                    </div>
                  </div>
                  
                  {/* Barra de progreso - Mobile */}
                  <div className="sm:hidden">
                    <div className="relative">
                      <div className="h-3 bg-gray-100 rounded-lg overflow-hidden">
                        <div 
                          className="h-full bg-blue-500 rounded-lg transition-all duration-500 ease-out"
                          style={{ width: `${client.percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            
            {/* Ver más button */}
            {clientsWithPercentage && displayedCount < clientsWithPercentage.length && (
              <div className="text-center pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDisplayedCount(prev => Math.min(prev + 10, clientsWithPercentage.length))}
                  className="text-xs px-4 py-2"
                  data-testid="button-see-more-clients"
                >
                  Ver más ({displayedCount} de {clientsWithPercentage.length})
                </Button>
              </div>
            )}
            
            {/* Total Row */}
            {clientsWithPercentage && clientsWithPercentage.length > 0 && (
              <div className="border-t-2 border-gray-300 pt-3 mt-4">
                <div 
                  className="flex flex-col sm:flex-row sm:items-center py-2 sm:py-3 space-y-2 sm:space-y-0 bg-blue-50 rounded-lg px-3"
                  data-testid="clients-total"
                >
                  {/* Total Mobile */}
                  <div className="flex justify-between items-center sm:hidden">
                    <p className="text-sm text-blue-900 font-bold">
                      TOTAL ({clientsWithPercentage.length} clientes)
                    </p>
                    <div className="flex items-center space-x-2 shrink-0">
                      <span className="text-xs text-blue-700">
                        100.0%
                      </span>
                      <span className="text-sm font-bold text-blue-900">
                        {formatCurrency(periodTotal)}
                      </span>
                    </div>
                  </div>
                  
                  {/* Total Desktop */}
                  <div className="hidden sm:flex sm:items-center w-full">
                    <div className="w-32 lg:w-48 flex-shrink-0">
                      <p className="text-sm text-blue-900 font-bold">
                        TOTAL ({clientsWithPercentage.length} clientes)
                      </p>
                    </div>
                    
                    <div className="w-12 flex-shrink-0 text-center">
                      <span className="text-sm text-blue-700 font-semibold">
                        100.0%
                      </span>
                    </div>
                    
                    <div className="flex-1 mx-2 lg:mx-4">
                      <div className="relative">
                        <div className="h-6 bg-blue-200 rounded-lg overflow-hidden">
                          <div className="h-full bg-blue-600 rounded-lg w-full"></div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="w-20 flex-shrink-0 text-right">
                      <span className="text-sm font-bold text-blue-900">
                        {formatCurrency(periodTotal)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Client Details Modal */}
      <Dialog open={isClientModalOpen} onOpenChange={setIsClientModalOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <User className="h-5 w-5 text-primary" />
              <span>Detalles del Cliente</span>
            </DialogTitle>
          </DialogHeader>
          
          {selectedClient && (
            <div className="space-y-6">
              {/* Basic Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center space-x-2">
                      <Building2 className="h-4 w-4" />
                      <span>Información Básica</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <label className="text-sm font-medium text-gray-500">Nombre del Cliente</label>
                      <p className="text-lg font-semibold">{selectedClient.nokoen}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Código Cliente</label>
                      <p className="font-medium">{selectedClient.koen || "N/A"}</p>
                    </div>
                    {selectedClient.rten && (
                      <div>
                        <label className="text-sm font-medium text-gray-500">RUT</label>
                        <p className="font-medium">{selectedClient.rten}</p>
                      </div>
                    )}
                    {selectedClient.gien && (
                      <div>
                        <label className="text-sm font-medium text-gray-500">Tipo de Negocio</label>
                        <p className="font-medium">{selectedClient.gien}</p>
                      </div>
                    )}
                    {selectedClient.sien && (
                      <div>
                        <label className="text-sm font-medium text-gray-500">Sector Industrial</label>
                        <p className="font-medium">{selectedClient.sien}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center space-x-2">
                      <Phone className="h-4 w-4" />
                      <span>Información de Contacto</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {selectedClient.email && (
                      <div>
                        <label className="text-sm font-medium text-gray-500">Email</label>
                        <p className="font-medium flex items-center">
                          <Mail className="h-4 w-4 mr-2 text-gray-400" />
                          {selectedClient.email}
                        </p>
                      </div>
                    )}
                    {selectedClient.foen && (
                      <div>
                        <label className="text-sm font-medium text-gray-500">Teléfono</label>
                        <p className="font-medium flex items-center">
                          <Phone className="h-4 w-4 mr-2 text-gray-400" />
                          {selectedClient.foen}
                        </p>
                      </div>
                    )}
                    {selectedClient.dien && (
                      <div>
                        <label className="text-sm font-medium text-gray-500">Dirección</label>
                        <p className="font-medium flex items-start">
                          <MapPin className="h-4 w-4 mr-2 text-gray-400 mt-0.5" />
                          <span>{selectedClient.dien}</span>
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <Separator />

              {/* Credit Information */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center space-x-2">
                    <CreditCard className="h-4 w-4" />
                    <span>Información de Crédito</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">
                        {formatCurrency(selectedClient.crlt)}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Límite de Crédito</div>
                    </div>
                    <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">
                        {formatCurrency(selectedClient.cren)}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Crédito Disponible</div>
                    </div>
                    {selectedClient.crsd && parseFloat(selectedClient.crsd) > 0 && (
                      <div className="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                        <div className="text-2xl font-bold text-red-600">
                          {formatCurrency(selectedClient.crsd)}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">Deuda Pendiente</div>
                      </div>
                    )}
                  </div>
                  
                  <div className="mt-4 flex justify-center">
                    <Badge className={`${getCreditStatus(selectedClient.cren, selectedClient.crlt, selectedClient.crsd).color} text-white`}>
                      {getCreditStatus(selectedClient.cren, selectedClient.crlt, selectedClient.crsd).text}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              <Separator />

              {/* Sales Statistics */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center space-x-2">
                    <TrendingUp className="h-4 w-4" />
                    <span>Estadísticas de Ventas</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="text-center p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
                      <div className="text-2xl font-bold text-indigo-600">
                        {formatCurrency(selectedClient.totalSales || 0)}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Total en Ventas</div>
                    </div>
                    <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                      <div className="text-2xl font-bold text-purple-600">
                        {selectedClient.totalTransactions || 0}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Total Transacciones</div>
                    </div>
                    {selectedClient.lastTransactionDate && (
                      <div className="text-center p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                        <div className="text-lg font-bold text-orange-600 flex items-center justify-center">
                          <Calendar className="h-4 w-4 mr-2" />
                          {formatDate(selectedClient.lastTransactionDate)}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">Última Compra</div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}