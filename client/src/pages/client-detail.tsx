import { useQuery } from "@tanstack/react-query";
import { useParams, Link, useLocation } from "wouter";
import { ArrowLeft, TrendingUp, ShoppingBag, Package, DollarSign, Clock, BarChart3, Users, Target, Settings, Building2, Menu, X, LogOut, Calculator, Palette, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";

interface ClientDetails {
  totalPurchases: number;
  totalProducts: number;
  transactionCount: number;
  averageTicket: number;
  purchaseFrequency: number; // days between purchases
}

interface ClientProduct {
  productName: string;
  totalPurchases: number;
  transactionCount: number;
  averagePrice: number;
  lastPurchase: string;
  daysSinceLastPurchase: number;
}

export default function ClientDetail() {
  const { clientName } = useParams();
  const { user } = useAuth();
  const [location] = useLocation();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Sidebar navigation items para admin
  const sidebarItems = [
    { icon: BarChart3, label: "Dashboard", href: "/" },
    { icon: Users, label: "Gestión de Usuarios", href: "/usuarios" },
    { icon: Target, label: "Gestión de Metas", href: "/metas" },
    { icon: Calculator, label: "Crear Presupuesto", href: "#", disabled: true },
    { icon: Palette, label: "Calcular Tintometría", href: "#", disabled: true },
    { icon: Package, label: "Revisión de Stock", href: "#", disabled: true },
    { icon: Wrench, label: "Herramientas de Venta", href: "#", disabled: true },
  ];

  const handleLogout = () => {
    window.location.href = "/login";
  };

  const getInitials = (name?: string) => {
    if (!name) return "A";
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
    }
    return parts[0].charAt(0).toUpperCase();
  };

  const getDisplayName = () => {
    return user?.salespersonName || "Administrador";
  };
  
  // Get current period (could be enhanced with date filters later)
  const currentPeriod = new Date().toISOString().slice(0, 7); // YYYY-MM format
  
  const { data: details, isLoading: isLoadingDetails } = useQuery<ClientDetails>({
    queryKey: [`/api/sales/client/${clientName}/details?period=${currentPeriod}&filterType=month`],
    enabled: !!clientName,
  });

  const { data: products = [], isLoading: isLoadingProducts } = useQuery<ClientProduct[]>({
    queryKey: [`/api/sales/client/${clientName}/products?period=${currentPeriod}&filterType=month`],
    enabled: !!clientName,
  });

  if (!clientName) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600">Cliente no encontrado</h1>
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
    <div className="min-h-screen bg-background">
      {user?.role === 'admin' && (
        <>
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

          {/* Sidebar */}
          <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 border-r border-slate-700/50 transition-transform duration-300 lg:translate-x-0 ${
            isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
          }`}>
            <div className="flex flex-col h-full">
              <div className="p-6 border-b border-slate-700/50">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-purple-500 to-violet-600 flex items-center justify-center">
                    <Building2 className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h1 className="text-xl font-bold text-white">Panel Admin</h1>
                    <p className="text-sm text-slate-400">Gestión del Sistema</p>
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
                      {getInitials(user?.salespersonName)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      {getDisplayName()}
                    </p>
                    <p className="text-xs text-slate-400">Administrador</p>
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
        </>
      )}
      <div className="lg:ml-64 transition-all duration-300">
        {/* Header */}
        <header className="bg-white border-b border-gray-200/60 px-4 lg:px-6 py-4 lg:py-6 m-4 rounded-2xl shadow-sm">
          <div className="flex flex-col space-y-4 lg:space-y-0 lg:flex-row lg:items-center justify-between">
            <div>
              <nav className="flex items-center space-x-2 text-sm text-gray-600 mb-2">
                <Link href="/" className="hover:text-blue-600 transition-colors">
                  Dashboard
                </Link>
                <span>›</span>
                <span>Cliente</span>
                <span>›</span>
                <span className="font-medium text-gray-900">{decodeURIComponent(clientName)}</span>
              </nav>
              <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">
                Análisis de Cliente
              </h1>
              <p className="text-gray-600 text-base lg:text-lg font-semibold">
                {decodeURIComponent(clientName)}
              </p>
              <p className="text-gray-500 text-sm">
                Período: {new Date().toLocaleDateString('es-CL', { year: 'numeric', month: 'long' })}
              </p>
            </div>
            <Link href="/">
              <Button 
                variant="outline" 
                className="rounded-xl border-gray-200 shadow-sm"
                data-testid="button-back-dashboard"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Volver al Dashboard
              </Button>
            </Link>
          </div>
        </header>

        {/* Main Content */}
        <main className="p-4 lg:p-6 space-y-4 lg:space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
            <div className="modern-card p-5 lg:p-6 hover-lift">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-muted-foreground mb-2">Compras Totales</p>
                  <p className="text-xl lg:text-2xl font-bold text-green-600" data-testid="text-total-purchases">
                    {isLoadingDetails ? 'Cargando...' : formatCurrency(details?.totalPurchases || 0)}
                  </p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center ml-4">
                  <DollarSign className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </div>

            <div className="modern-card p-5 lg:p-6 hover-lift">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-muted-foreground mb-2">Productos Diferentes</p>
                  <p className="text-xl lg:text-2xl font-bold text-blue-600" data-testid="text-total-products">
                    {isLoadingDetails ? 'Cargando...' : formatNumber(details?.totalProducts || 0)}
                  </p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center ml-4">
                  <Package className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </div>

            <div className="modern-card p-5 lg:p-6 hover-lift">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-muted-foreground mb-2">Transacciones</p>
                  <p className="text-xl lg:text-2xl font-bold text-purple-600" data-testid="text-transaction-count">
                    {isLoadingDetails ? 'Cargando...' : formatNumber(details?.transactionCount || 0)}
                  </p>
                </div>
                <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center ml-4">
                  <ShoppingBag className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </div>

            <div className="modern-card p-5 lg:p-6 hover-lift">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-muted-foreground mb-2">Frecuencia de Compra</p>
                  <p className="text-xl lg:text-2xl font-bold text-orange-600" data-testid="text-purchase-frequency">
                    {isLoadingDetails ? 'Cargando...' : getFrequencyDescription(details?.purchaseFrequency || 0)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {isLoadingDetails ? '' : `${details?.purchaseFrequency || 0} días promedio`}
                  </p>
                </div>
                <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center ml-4">
                  <Clock className="w-6 h-6 text-orange-600" />
                </div>
              </div>
            </div>
          </div>

          {/* Additional KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
            <div className="modern-card p-5 lg:p-6 hover-lift">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-muted-foreground mb-2">Ticket Promedio</p>
                  <p className="text-xl lg:text-2xl font-bold text-indigo-600" data-testid="text-average-ticket">
                    {isLoadingDetails ? 'Cargando...' : formatCurrency(details?.averageTicket || 0)}
                  </p>
                </div>
                <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center ml-4">
                  <TrendingUp className="w-6 h-6 text-indigo-600" />
                </div>
              </div>
            </div>

            <div className="modern-card p-5 lg:p-6 hover-lift">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-muted-foreground mb-2">Diversidad de Productos</p>
                  <p className="text-xl lg:text-2xl font-bold text-teal-600">
                    {isLoadingDetails ? 'Cargando...' : details?.totalProducts && details?.transactionCount 
                      ? (details.totalProducts / details.transactionCount * 100).toFixed(1) 
                      : '0.0'}%
                    <span className="text-sm text-muted-foreground ml-1">variedad</span>
                  </p>
                </div>
                <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center ml-4">
                  <Package className="w-6 h-6 text-teal-600" />
                </div>
              </div>
            </div>
          </div>

          {/* Products Table */}
          <div className="modern-card p-5 lg:p-6 hover-lift">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <ShoppingBag className="h-5 w-5 text-blue-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Productos Comprados por el Cliente</h2>
            </div>
            
            <div className="space-y-3">
              {isLoadingProducts ? (
                <div className="space-y-3">
                  {[...Array(8)].map((_, i) => (
                    <div key={i} className="animate-pulse h-16 bg-gray-200 rounded-lg"></div>
                  ))}
                </div>
              ) : products.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No hay productos registrados para este cliente</p>
              ) : (
                products.map((product, index) => (
                  <div 
                    key={product.productName}
                    className="flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                    data-testid={`product-${index}`}
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
                            {product.productName}
                          </p>
                          <div className="flex items-center space-x-4 mt-1">
                            <p className="text-xs text-gray-500">
                              {formatNumber(product.transactionCount)} transacciones
                            </p>
                            <p className="text-xs text-gray-500">
                              Precio promedio: {formatCurrency(product.averagePrice)}
                            </p>
                            <p className={`text-xs ${getDaysColor(product.daysSinceLastPurchase)}`}>
                              Última compra: {product.daysSinceLastPurchase} días
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="text-right ml-4">
                      <p className="text-sm font-semibold text-gray-900">
                        {formatCurrency(product.totalPurchases)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatDate(product.lastPurchase)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}