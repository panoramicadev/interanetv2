import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Search, Users, Star, Clock, TrendingUp, Package, ArrowLeft } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export default function ClientsDashboard() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");

  // Obtener análisis completo de clientes del vendedor
  const { data: clientsAnalysis, isLoading } = useQuery({
    queryKey: [`/api/salesperson/${user?.id}/clients`],
    enabled: !!user?.id,
  });

  // Type-safe accessors with fallbacks
  const vipClients = (clientsAnalysis as any)?.vipClients || [];
  const inactiveClients = (clientsAnalysis as any)?.inactiveClients || [];
  const frequentClients = (clientsAnalysis as any)?.frequentClients || [];
  const clientsWithTopProducts = (clientsAnalysis as any)?.clientsWithTopProducts || [];

  // Filtrar clientes por búsqueda
  const filterClients = (clients: any[], term: string) => {
    if (!term) return clients;
    return clients?.filter(client => 
      client.clientName?.toLowerCase().includes(term.toLowerCase())
    ) || [];
  };


  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Cargando análisis de clientes...</p>
        </div>
      </div>
    );
  }

  return (
    <>
        {/* Header */}
        <header className="bg-white border-b border-gray-200/60 px-4 lg:px-6 py-4 lg:py-6 m-4 rounded-2xl shadow-sm">
          <div className="flex flex-col space-y-4 lg:space-y-0 lg:flex-row lg:items-center justify-between">
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">
                Mis Clientes - {user?.firstName} {user?.lastName}
              </h1>
              <p className="text-gray-600 text-base lg:text-lg">
                Análisis detallado y categorización de tu cartera de clientes
              </p>
            </div>
            
            {/* Buscador */}
            <div className="relative w-full lg:w-96">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Buscar cliente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 rounded-xl border-gray-200"
                data-testid="search-clients"
              />
            </div>
          </div>
        </header>

        {/* Contenido principal */}
        <main className="px-4 lg:px-6 pb-6 space-y-6">
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="overview">Resumen</TabsTrigger>
              <TabsTrigger value="vip">Clientes VIP</TabsTrigger>
              <TabsTrigger value="inactive">Inactivos</TabsTrigger>
              <TabsTrigger value="frequent">Frecuentes</TabsTrigger>
              <TabsTrigger value="products">Por Producto</TabsTrigger>
            </TabsList>

            {/* Resumen General */}
            <TabsContent value="overview" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card className="rounded-2xl border-gray-200/60 shadow-sm">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-gray-600">Clientes VIP</CardTitle>
                    <Star className="h-4 w-4 text-yellow-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-gray-900">
                      {vipClients.length}
                    </div>
                    <p className="text-xs text-gray-600 mt-1">
                      Alto volumen de compras
                    </p>
                  </CardContent>
                </Card>

                <Card className="rounded-2xl border-gray-200/60 shadow-sm">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-gray-600">Clientes Inactivos</CardTitle>
                    <Clock className="h-4 w-4 text-orange-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-gray-900">
                      {inactiveClients.length}
                    </div>
                    <p className="text-xs text-gray-600 mt-1">
                      Sin compras en 60+ días
                    </p>
                  </CardContent>
                </Card>

                <Card className="rounded-2xl border-gray-200/60 shadow-sm">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-gray-600">Clientes Frecuentes</CardTitle>
                    <TrendingUp className="h-4 w-4 text-green-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-gray-900">
                      {frequentClients.length}
                    </div>
                    <p className="text-xs text-gray-600 mt-1">
                      Compras regulares
                    </p>
                  </CardContent>
                </Card>

                <Card className="rounded-2xl border-gray-200/60 shadow-sm">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-gray-600">Total Clientes</CardTitle>
                    <Users className="h-4 w-4 text-blue-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-gray-900">
                      {vipClients.length + inactiveClients.length + frequentClients.length}
                    </div>
                    <p className="text-xs text-gray-600 mt-1">
                      En tu cartera
                    </p>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Clientes VIP */}
            <TabsContent value="vip" className="space-y-6">
              <Card className="rounded-2xl border-gray-200/60 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-xl font-semibold text-gray-900 flex items-center">
                    <Star className="w-5 h-5 mr-2 text-yellow-500" />
                    Clientes VIP
                  </CardTitle>
                  <CardDescription className="text-gray-600">
                    Clientes con mayor volumen de compras (top 20%)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {filterClients(vipClients, searchTerm)?.map((client: any, index: number) => (
                      <div key={client.clientName} className="flex items-center justify-between p-4 border rounded-lg bg-yellow-50">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-full bg-yellow-500 flex items-center justify-center">
                            <Star className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{client.clientName}</p>
                            <p className="text-sm text-gray-600">
                              {client.transactionCount} transacciones • 
                              Última compra: {new Date(client.lastPurchaseDate).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-gray-900">
                            {new Intl.NumberFormat('es-CL', {
                              style: 'currency',
                              currency: 'CLP',
                              minimumFractionDigits: 0,
                            }).format(client.totalSales)}
                          </p>
                          <p className="text-sm text-gray-600">
                            Ticket promedio: {new Intl.NumberFormat('es-CL', {
                              style: 'currency',
                              currency: 'CLP',
                              minimumFractionDigits: 0,
                            }).format(client.averageTicket)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Clientes Inactivos */}
            <TabsContent value="inactive" className="space-y-6">
              <Card className="rounded-2xl border-gray-200/60 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-xl font-semibold text-gray-900 flex items-center">
                    <Clock className="w-5 h-5 mr-2 text-orange-500" />
                    Clientes Inactivos
                  </CardTitle>
                  <CardDescription className="text-gray-600">
                    Clientes sin compras en los últimos 60 días - Requieren atención
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {filterClients(inactiveClients, searchTerm)?.map((client: any, index: number) => (
                      <div key={client.clientName} className="flex items-center justify-between p-4 border rounded-lg bg-orange-50">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center">
                            <Clock className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{client.clientName}</p>
                            <p className="text-sm text-gray-600">
                              Última compra: {new Date(client.lastPurchaseDate).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge variant="outline" className="text-orange-700 border-orange-300">
                            {client.daysSinceLastPurchase} días inactivo
                          </Badge>
                          <p className="text-sm text-gray-600 mt-1">
                            Total histórico: {new Intl.NumberFormat('es-CL', {
                              style: 'currency',
                              currency: 'CLP',
                              minimumFractionDigits: 0,
                            }).format(client.totalSales)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Clientes Frecuentes */}
            <TabsContent value="frequent" className="space-y-6">
              <Card className="rounded-2xl border-gray-200/60 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-xl font-semibold text-gray-900 flex items-center">
                    <TrendingUp className="w-5 h-5 mr-2 text-green-500" />
                    Clientes Frecuentes
                  </CardTitle>
                  <CardDescription className="text-gray-600">
                    Clientes con alta frecuencia de compras
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {filterClients(frequentClients, searchTerm)?.map((client: any, index: number) => (
                      <div key={client.clientName} className="flex items-center justify-between p-4 border rounded-lg bg-green-50">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center">
                            <TrendingUp className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{client.clientName}</p>
                            <p className="text-sm text-gray-600">
                              {client.transactionCount} transacciones
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge variant="outline" className="text-green-700 border-green-300">
                            Cada {client.purchaseFrequency} días
                          </Badge>
                          <p className="text-sm text-gray-600 mt-1">
                            {new Intl.NumberFormat('es-CL', {
                              style: 'currency',
                              currency: 'CLP',
                              minimumFractionDigits: 0,
                            }).format(client.totalSales)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Clientes por Producto Favorito */}
            <TabsContent value="products" className="space-y-6">
              <Card className="rounded-2xl border-gray-200/60 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-xl font-semibold text-gray-900 flex items-center">
                    <Package className="w-5 h-5 mr-2 text-blue-500" />
                    Clientes por Producto Favorito
                  </CardTitle>
                  <CardDescription className="text-gray-600">
                    Productos que más compra cada cliente
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {filterClients(clientsWithTopProducts, searchTerm)?.map((client: any, index: number) => (
                      <div key={client.clientName} className="flex items-center justify-between p-4 border rounded-lg bg-blue-50">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center">
                            <Package className="w-5 h-5 text-white" />
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">{client.clientName}</p>
                            <p className="text-sm text-gray-600 font-medium">{client.topProduct}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-gray-900">
                            {new Intl.NumberFormat('es-CL', {
                              style: 'currency',
                              currency: 'CLP',
                              minimumFractionDigits: 0,
                            }).format(client.productSales)}
                          </p>
                          <p className="text-sm text-gray-600">
                            {Math.round((client.productSales / client.totalClientSales) * 100)}% de sus compras
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </main>
    </>
  );
}