import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "wouter";
import { 
  TrendingUp, 
  Users, 
  DollarSign, 
  ShoppingCart,
  MessageSquare,
  FileText,
  BarChart3,
  Calendar,
  Target,
  AlertCircle
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import type { SalespersonUser } from "@shared/schema";

interface SalespersonMetrics {
  totalSales: number;
  totalTransactions: number;
  totalUnits: number;
  activeCustomers: number;
}

interface Client {
  clientName: string;
  totalSales: number;
  transactionCount: number;
}

interface ChartData {
  period: string;
  sales: number;
}

export default function SalespersonDashboard() {
  const { user } = useAuth() as { user: SalespersonUser };

  // Obtener métricas específicas del vendedor
  const { data: metrics, isLoading: metricsLoading } = useQuery<SalespersonMetrics>({
    queryKey: ["/api/sales/metrics/salesperson", user?.salespersonName],
    enabled: !!user?.salespersonName,
  });

  // Obtener principales clientes del vendedor
  const { data: topClients = [], isLoading: clientsLoading } = useQuery<Client[]>({
    queryKey: ["/api/sales/clients/salesperson", user?.salespersonName],
    enabled: !!user?.salespersonName,
  });

  // Obtener datos de gráfico del vendedor
  const { data: chartData = [], isLoading: chartLoading } = useQuery<ChartData[]>({
    queryKey: ["/api/sales/chart-data/salesperson", user?.salespersonName],
    enabled: !!user?.salespersonName,
  });

  // Datos de mensajes (simulados por ahora)
  const messages = [
    {
      id: 1,
      from: "DANIEL HERMOSILLA",
      role: "Supervisor",
      message: "Excelente trabajo este mes. Cumpliste la meta!",
      time: "Hace 2 horas",
      type: "success"
    },
    {
      id: 2,
      from: "PINTURERIA DEL SUR",
      role: "Cliente",
      message: "Necesito cotización para pedido de 100 galones",
      time: "Hace 1 día",
      type: "client"
    },
    {
      id: 3,
      from: "Sistema",
      role: "Alerta",
      message: "Cliente FERRETERIA EL CONSTRUCTOR no compra hace 15 días",
      time: "Hace 2 días",
      type: "alert"
    }
  ];

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP'
    }).format(amount);
  };

  const getMessageIcon = (type: string) => {
    switch (type) {
      case 'success': return <TrendingUp className="w-4 h-4 text-green-600" />;
      case 'client': return <Users className="w-4 h-4 text-blue-600" />;
      case 'alert': return <AlertCircle className="w-4 h-4 text-orange-600" />;
      default: return <MessageSquare className="w-4 h-4" />;
    }
  };

  const [location] = useLocation();

  const sidebarItems = [
    {
      href: "/",
      label: "Dashboard",
      icon: BarChart3,
    },
    {
      href: "/presupuestos",
      label: "Presupuestos",
      icon: FileText,
    },
    {
      href: "/marketing",
      label: "Marketing",
      icon: TrendingUp,
    },
    {
      href: "/calendario",
      label: "Calendario",
      icon: Calendar,
    },
    {
      href: "/metas",
      label: "Mis Metas",
      icon: Target,
    },
  ];

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      {/* Sidebar específico para vendedor */}
      <div className="w-64 bg-white dark:bg-gray-800 shadow-lg">
        <div className="p-6 border-b">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white">Panel Vendedor</h2>
          <p className="text-sm text-gray-600 dark:text-gray-300">{user?.salespersonName}</p>
        </div>
        <nav className="mt-6">
          {sidebarItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.href;
            return (
              <Link key={item.href} href={item.href}>
                <div className={`flex items-center px-6 py-3 text-sm font-medium transition-colors duration-200 cursor-pointer ${
                  isActive 
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-r-2 border-blue-600' 
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}>
                  <Icon className="w-5 h-5 mr-3" />
                  {item.label}
                </div>
              </Link>
            );
          })}
        </nav>
        <div className="absolute bottom-0 w-64 p-6 border-t">
          <Button 
            variant="outline" 
            className="w-full" 
            onClick={() => window.location.href = "/api/auth/logout"}
          >
            <MessageSquare className="w-4 h-4 mr-2" />
            Cerrar Sesión
          </Button>
        </div>
      </div>
      
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white dark:bg-gray-800 shadow-sm border-b p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Mi Dashboard
              </h1>
              <p className="text-gray-600 dark:text-gray-300">
                Bienvenido/a, {user?.salespersonName}
              </p>
            </div>
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
              {user?.role === 'salesperson' ? 'Vendedor' : user?.role}
            </Badge>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            {/* Métricas Principales */}
            <div className="lg:col-span-2 space-y-6">
              {/* Cards de Métricas */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Ventas Totales</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {metricsLoading ? "..." : formatCurrency(metrics?.totalSales || 0)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Este mes
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Transacciones</CardTitle>
                    <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {metricsLoading ? "..." : metrics?.totalTransactions || 0}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Órdenes procesadas
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Clientes Activos</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {metricsLoading ? "..." : metrics?.activeCustomers || 0}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Este período
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Unidades</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {metricsLoading ? "..." : metrics?.totalUnits || 0}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Total vendidas
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Principales Clientes */}
              <Card>
                <CardHeader>
                  <CardTitle>Mis Principales Clientes</CardTitle>
                  <CardDescription>
                    Clientes con mayores ventas este período
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {clientsLoading ? (
                    <div className="text-center py-4">Cargando clientes...</div>
                  ) : (
                    <div className="space-y-4">
                      {topClients.slice(0, 5).map((client, index) => (
                        <div key={client.clientName} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                          <div className="flex items-center space-x-3">
                            <div className="bg-blue-100 text-blue-600 rounded-full w-8 h-8 flex items-center justify-center text-sm font-medium">
                              {index + 1}
                            </div>
                            <div>
                              <p className="font-medium text-sm">{client.clientName}</p>
                              <p className="text-xs text-muted-foreground">{client.transactionCount} transacciones</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-sm">{formatCurrency(client.totalSales)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Panel de Mensajes */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <MessageSquare className="w-5 h-5" />
                    <span>Mensajes</span>
                  </CardTitle>
                  <CardDescription>
                    Comunicaciones recientes
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {messages.map((message) => (
                      <div key={message.id} className="p-3 border rounded-lg bg-white dark:bg-gray-800">
                        <div className="flex items-start space-x-3">
                          {getMessageIcon(message.type)}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2 mb-1">
                              <p className="text-sm font-medium truncate">{message.from}</p>
                              <Badge variant="secondary" className="text-xs">{message.role}</Badge>
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                              {message.message}
                            </p>
                            <p className="text-xs text-muted-foreground">{message.time}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <Button variant="outline" className="w-full mt-4" size="sm">
                    Ver todos los mensajes
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}