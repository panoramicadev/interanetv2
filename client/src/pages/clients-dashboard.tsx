import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Search, Users, Star, Clock, TrendingUp, Package, ArrowLeft, LayoutDashboard, FileText, CalendarIcon, Building2, LogOut, Menu, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Link, useLocation } from "wouter";

export default function ClientsDashboard() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [location] = useLocation();

  // Obtener análisis completo de clientes del vendedor
  const { data: clientsAnalysis, isLoading } = useQuery({
    queryKey: [`/api/sales/salesperson/${user?.salespersonName}/clients-analysis`],
    enabled: !!user?.salespersonName,
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

  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

  const getInitials = (firstName?: string | null, lastName?: string | null) => {
    const first = firstName?.charAt(0) || "";
    const last = lastName?.charAt(0) || "";
    return (first + last).toUpperCase() || "V";
  };

  const getDisplayName = (firstName?: string | null, lastName?: string | null) => {
    if (firstName && lastName) {
      return `${firstName} ${lastName}`;
    }
    if (firstName) return firstName;
    if (lastName) return lastName;
    return user?.salespersonName || "Vendedor";
  };

  const sidebarItems = [
    {
      href: "/",
      label: "Dashboard",
      icon: LayoutDashboard,
    },
    {
      href: "/mis-clientes",
      label: "Mis Clientes",
      icon: Users,
    },
    {
      href: "/presupuestos",
      label: "Presupuestos",
      icon: FileText,
    },
    {
      href: "/calendario",
      label: "Calendario",
      icon: CalendarIcon,
    },
  ];

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
    <div className="min-h-screen bg-background">
      {/* Mobile Menu Button */}
      <Button
        variant="ghost"
        size="sm"
        className="fixed top-4 left-4 z-50 lg:hidden glass-card p-2"
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        data-testid="mobile-menu-toggle"
      >
        {isMobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar negro igual al admin */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 border-r border-slate-700/50 transition-transform duration-300 lg:translate-x-0 ${
        isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}>
        <div className="flex flex-col h-full">
          <div className="p-6 border-b border-slate-700/50">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 flex items-center justify-center">
                <Building2 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Panel Vendedor</h1>
                <p className="text-sm text-slate-400">{user?.salespersonName}</p>
              </div>
            </div>
          </div>
        
          <nav className="flex-1 p-4 space-y-1">
            {sidebarItems.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.href;
              return (
                <Link key={item.href} href={item.href}>
                  <Button
                    variant="ghost"
                    className={`w-full justify-start text-slate-300 hover:text-white hover:bg-slate-800/50 ${
                      isActive ? "bg-slate-800 text-white" : ""
                    }`}
                    data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <Icon className="w-5 h-5 mr-3" />
                    {item.label}
                  </Button>
                </Link>
              );
            })}
          </nav>
          
          <div className="p-6 border-t border-slate-700/50">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center">
                <span className="text-xs font-medium text-white">
                  {getInitials(user?.firstName, user?.lastName)}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {getDisplayName(user?.firstName, user?.lastName)}
                </p>
                <p className="text-xs text-slate-400">Vendedor</p>
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              className="w-full justify-start text-slate-300 hover:text-white hover:bg-slate-800/50"
              onClick={handleLogout}
              data-testid="logout-button"
            >
              <LogOut className="w-4 h-4 mr-3" />
              Cerrar Sesión
            </Button>
          </div>
        </div>
      </div>
      
      <div className="lg:ml-64 transition-all duration-300">
        {/* Header */}
        <header className="bg-white border-b border-gray-200/60 px-4 lg:px-6 py-4 lg:py-6 m-4 rounded-2xl shadow-sm">
          <div className="flex flex-col space-y-4 lg:space-y-0 lg:flex-row lg:items-center justify-between">
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">
                Mis Clientes - {user?.salespersonName}
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
      </div>
    </div>
  );
}