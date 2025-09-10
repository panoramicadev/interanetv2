import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, Users, CreditCard, TrendingUp, MapPin, Phone, Mail } from "lucide-react";

interface Client {
  id: string;
  koen: string | null;
  nokoen: string;
  rten: string | null;
  email: string | null;
  foen: string | null;
  dien: string | null;
  crlt: string | null; // Credit limit
  cren: string | null; // Available credit
  crsd: string | null; // Credit balance/debt
  gien: string | null; // Business type
  sien: string | null; // Industry sector
  totalTransactions?: number;
  totalSales?: number;
  lastTransactionDate?: string;
}

const formatCurrency = (amount: string | number | null) => {
  if (!amount) return "CLP $0";
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0
  }).format(numAmount);
};

const formatDate = (date: string | null) => {
  if (!date) return "Sin datos";
  return new Date(date).toLocaleDateString('es-CL');
};

export default function Clients() {
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const { data: clients, isLoading, error } = useQuery({
    queryKey: ['/api/clients', search, currentPage],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      params.set('limit', itemsPerPage.toString());
      params.set('offset', ((currentPage - 1) * itemsPerPage).toString());
      
      const response = await fetch(`/api/clients?${params}`);
      if (!response.ok) {
        throw new Error('Error al cargar clientes');
      }
      return response.json() as Promise<Client[]>;
    },
  });

  const handleSearch = (value: string) => {
    setSearch(value);
    setCurrentPage(1); // Reset to first page when searching
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-lg">Cargando clientes...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <p className="text-red-600 text-lg mb-2">Error al cargar clientes</p>
          <p className="text-gray-600">Por favor, intenta nuevamente más tarde</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="clients-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Users className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Gestión de Clientes</h1>
        </div>
        <Badge variant="outline" className="text-sm">
          {clients?.length || 0} clientes
        </Badge>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              type="text"
              placeholder="Buscar por nombre, RUT o código del cliente..."
              className="pl-10"
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              data-testid="input-search-clients"
            />
          </div>
        </CardContent>
      </Card>

      {/* Clients Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {clients?.map((client) => {
          const creditStatus = getCreditStatus(client.cren, client.crlt, client.crsd);
          
          return (
            <Card key={client.id} className="hover:shadow-lg transition-shadow" data-testid={`card-client-${client.id}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg font-semibold text-gray-900 dark:text-white">
                    {client.nokoen}
                  </CardTitle>
                  <Badge className={`${creditStatus.color} text-white text-xs`}>
                    {creditStatus.text}
                  </Badge>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Código: {client.koen || "N/A"}
                </div>
              </CardHeader>
              
              <CardContent className="space-y-3">
                {/* Basic Info */}
                <div className="space-y-2">
                  {client.rten && (
                    <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                      <CreditCard className="h-4 w-4 mr-2" />
                      RUT: {client.rten}
                    </div>
                  )}
                  
                  {client.gien && (
                    <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                      <TrendingUp className="h-4 w-4 mr-2" />
                      {client.gien}
                    </div>
                  )}
                  
                  {client.dien && (
                    <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                      <MapPin className="h-4 w-4 mr-2" />
                      {client.dien.length > 40 ? client.dien.substring(0, 40) + "..." : client.dien}
                    </div>
                  )}
                </div>

                {/* Contact Info */}
                <div className="space-y-1">
                  {client.email && (
                    <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                      <Mail className="h-4 w-4 mr-2" />
                      {client.email}
                    </div>
                  )}
                  
                  {client.foen && (
                    <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                      <Phone className="h-4 w-4 mr-2" />
                      {client.foen}
                    </div>
                  )}
                </div>

                {/* Credit Info */}
                <div className="border-t pt-3 space-y-2">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-gray-500">Límite de crédito:</span>
                      <div className="font-semibold text-green-600">
                        {formatCurrency(client.crlt)}
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-500">Crédito disponible:</span>
                      <div className="font-semibold text-blue-600">
                        {formatCurrency(client.cren)}
                      </div>
                    </div>
                  </div>
                  
                  {client.crsd && parseFloat(client.crsd) > 0 && (
                    <div className="text-sm">
                      <span className="text-gray-500">Deuda:</span>
                      <div className="font-semibold text-red-600">
                        {formatCurrency(client.crsd)}
                      </div>
                    </div>
                  )}
                </div>

                {/* Transaction Stats */}
                <div className="border-t pt-3 space-y-1">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-gray-500">Total ventas:</span>
                      <div className="font-semibold text-indigo-600">
                        {formatCurrency(client.totalSales || 0)}
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-500">Transacciones:</span>
                      <div className="font-semibold">
                        {client.totalTransactions || 0}
                      </div>
                    </div>
                  </div>
                  
                  {client.lastTransactionDate && (
                    <div className="text-sm">
                      <span className="text-gray-500">Última compra:</span>
                      <div className="font-medium">
                        {formatDate(client.lastTransactionDate)}
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="border-t pt-3">
                  <Button variant="outline" size="sm" className="w-full" data-testid={`button-view-client-${client.id}`}>
                    Ver detalles
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Empty State */}
      {clients?.length === 0 && (
        <div className="text-center py-12">
          <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            {search ? "No se encontraron clientes" : "No hay clientes disponibles"}
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            {search 
              ? `No hay clientes que coincidan con "${search}"`
              : "Los clientes aparecerán aquí una vez que sean importados"
            }
          </p>
        </div>
      )}

      {/* Pagination */}
      {clients && clients.length >= itemsPerPage && (
        <div className="flex justify-center space-x-2">
          <Button
            variant="outline"
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            data-testid="button-prev-page"
          >
            Anterior
          </Button>
          <span className="flex items-center px-4 py-2 text-sm text-gray-600">
            Página {currentPage}
          </span>
          <Button
            variant="outline"
            onClick={() => setCurrentPage(prev => prev + 1)}
            disabled={clients.length < itemsPerPage}
            data-testid="button-next-page"
          >
            Siguiente
          </Button>
        </div>
      )}
    </div>
  );
}