import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Package, 
  ShoppingCart, 
  Clock, 
  DollarSign, 
  Building2,
  LogOut,
  Menu,
  X,
  Calendar,
  FileText,
  Calculator,
  Palette,
  Wrench,
  Upload
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";

interface LastOrder {
  id: string;
  nudo: string;
  feemdo: string;
  nokoprct: string;
  vanedo: string;
  nokofu: string;
}

interface PurchaseHistory {
  id: string;
  nudo: string;
  feemdo: string;
  nokoprct: string;
  vanedo: string;
  nokofu: string;
}

export default function ClientBuyerDashboard() {
  const { user } = useAuth();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  
  // Obtener último pedido del cliente
  const { data: lastOrder, isLoading: isLoadingLastOrder } = useQuery<LastOrder>({
    queryKey: [`/api/sales/client/${user?.salespersonName}/last-order`],
    enabled: !!user?.salespersonName,
  });

  // Obtener historial de compras del cliente (últimas 10)
  const { data: purchaseHistory = [], isLoading: isLoadingHistory } = useQuery<PurchaseHistory[]>({
    queryKey: [`/api/sales/client/${user?.salespersonName}/purchase-history?limit=10`],
    enabled: !!user?.salespersonName,
  });

  const formatCurrency = (amount: string | number) => {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(numAmount)) return '$0';
    
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
    }).format(numAmount);
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('es-CL', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return 'Fecha no disponible';
    }
  };

  const formatShortDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('es-CL');
    } catch {
      return '-';
    }
  };

  const { logoutMutation } = useAuth();
  
  const handleLogout = () => {
    logoutMutation.mutate();
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const sidebarItems = [
    {
      href: "/",
      label: "Mi Panel",
      icon: Package,
    },
    {
      href: "/mis-pedidos",
      label: "Mis Pedidos",
      icon: ShoppingCart,
    },
    {
      href: "/solicitar-cotizacion",
      label: "Solicitar Cotización",
      icon: FileText,
    },
    {
      href: "/calendario",
      label: "Calendario",
      icon: Calendar,
    },
    {
      href: "#",
      label: "Crear Presupuesto",
      icon: Calculator,
      disabled: true,
      comingSoon: true,
    },
    {
      href: "#",
      label: "Calcular Tintometría",
      icon: Palette,
      disabled: true,
      comingSoon: true,
    },
    {
      href: "#",
      label: "Revisión de Stock",
      icon: Package,
      disabled: true,
      comingSoon: true,
    },
    {
      href: "#",
      label: "Herramientas de Venta",
      icon: Wrench,
      disabled: true,
      comingSoon: true,
    },
  ];

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

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 border-r border-slate-700/50 transition-transform duration-300 lg:translate-x-0 ${
        isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}>
        <div className="flex flex-col h-full">
          <div className="p-6 border-b border-slate-700/50">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 flex items-center justify-center">
                <Building2 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Mi Cuenta</h1>
                <p className="text-sm text-slate-400">Panel de Compras</p>
              </div>
            </div>
          </div>
        
          <nav className="flex-1 p-4 space-y-1">
            {sidebarItems.map((item, index) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.href;
              const itemKey = (item as any).disabled ? `disabled-${index}` : item.href;

              if ((item as any).onClick) {
                return (
                  <div key={itemKey}>
                    <Button
                      variant="ghost"
                      onClick={(item as any).onClick}
                      className="w-full justify-start text-slate-300 hover:text-white hover:bg-slate-800/50"
                      data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      <Icon className="w-5 h-5 mr-3" />
                      {item.label}
                    </Button>
                  </div>
                );
              }
              
              return (
                <div key={itemKey}>
                  <Button
                    variant="ghost"
                    disabled={(item as any).disabled}
                    className={`w-full justify-start text-slate-300 hover:text-white hover:bg-slate-800/50 ${
                      isActive ? "bg-slate-800 text-white" : ""
                    } ${(item as any).disabled ? "opacity-60 cursor-not-allowed" : ""}`}
                    data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <Icon className="w-5 h-5 mr-3" />
                    <div className="text-left">
                      <div>{item.label}</div>
                      {(item as any).comingSoon && (
                        <div className="text-xs text-slate-500">Próximamente</div>
                      )}
                    </div>
                  </Button>
                </div>
              );
            })}
          </nav>
          
          <div className="p-6 border-t border-slate-700/50">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center">
                <span className="text-xs font-medium text-white">
                  {user?.salespersonName ? getInitials(user.salespersonName) : 'C'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {user?.salespersonName || 'Cliente'}
                </p>
                <p className="text-xs text-slate-400">Comprador</p>
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
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">
              Bienvenido, {user?.salespersonName}
            </h1>
            <p className="text-gray-600 text-base lg:text-lg">
              Panel de compras y gestión de pedidos
            </p>
          </div>
        </header>

        {/* Main Content */}
        <main className="px-4 lg:px-6 pb-6 space-y-6">
          
          {/* Último Pedido */}
          <Card className="rounded-2xl border-gray-200/60 shadow-sm">
            <CardHeader>
              <CardTitle className="text-xl font-semibold text-gray-900 flex items-center">
                <ShoppingCart className="w-6 h-6 mr-2 text-emerald-500" />
                Último Pedido
              </CardTitle>
              <CardDescription className="text-gray-600">
                Tu compra más reciente
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingLastOrder ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500 mx-auto mb-4"></div>
                  <p className="text-muted-foreground">Cargando último pedido...</p>
                </div>
              ) : lastOrder ? (
                <div className="bg-emerald-50 rounded-lg p-6 border border-emerald-200">
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline" className="text-emerald-700 border-emerald-300 bg-emerald-50">
                          Pedido #{lastOrder.nudo}
                        </Badge>
                        <span className="text-sm text-gray-500">
                          {formatDate(lastOrder.feemdo)}
                        </span>
                      </div>
                      <p className="font-medium text-gray-900 text-lg">
                        {lastOrder.nokoprct || 'Producto sin especificar'}
                      </p>
                      <p className="text-sm text-gray-600">
                        Vendedor: {lastOrder.nokofu || 'No especificado'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-emerald-600">
                        {formatCurrency(lastOrder.vanedo || '0')}
                      </p>
                      <p className="text-sm text-gray-500">Monto del pedido</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No se encontró ningún pedido</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Historial de Compras */}
          <Card className="rounded-2xl border-gray-200/60 shadow-sm">
            <CardHeader>
              <CardTitle className="text-xl font-semibold text-gray-900 flex items-center">
                <Clock className="w-6 h-6 mr-2 text-blue-500" />
                Historial de Compras
              </CardTitle>
              <CardDescription className="text-gray-600">
                Tus últimas 10 compras realizadas
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingHistory ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
                  <p className="text-muted-foreground">Cargando historial...</p>
                </div>
              ) : purchaseHistory.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Pedido</TableHead>
                        <TableHead>Producto</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Vendedor</TableHead>
                        <TableHead className="text-right">Monto</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {purchaseHistory.map((purchase) => (
                        <TableRow key={purchase.id} data-testid={`purchase-${purchase.id}`}>
                          <TableCell className="font-medium">
                            #{purchase.nudo}
                          </TableCell>
                          <TableCell className="max-w-xs truncate">
                            {purchase.nokoprct || 'Producto sin especificar'}
                          </TableCell>
                          <TableCell>
                            {formatShortDate(purchase.feemdo)}
                          </TableCell>
                          <TableCell>
                            {purchase.nokofu || 'No especificado'}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {formatCurrency(purchase.vanedo || '0')}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8">
                  <ShoppingCart className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No se encontraron compras en el historial</p>
                </div>
              )}
            </CardContent>
          </Card>

        </main>
      </div>

    </div>
  );
}