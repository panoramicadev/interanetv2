import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { ArrowLeft, TrendingUp, ShoppingBag, Package, DollarSign, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

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