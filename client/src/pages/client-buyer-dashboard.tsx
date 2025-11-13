import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Package, 
  ShoppingCart, 
  Clock, 
  DollarSign
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface LastOrder {
  id: string;
  nudo: string;
  feemdo: string;
  nokopr: string;
  vanedo: string;
  nokofu: string;
}

interface PurchaseHistory {
  id: string;
  nudo: string;
  feemdo: string;
  nokopr: string;
  vanedo: string;
  nokofu: string;
}

export default function ClientBuyerDashboard() {
  const { user } = useAuth();
  
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
      return dateString;
    }
  };

  if (isLoadingLastOrder || isLoadingHistory) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Cargando información...</p>
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
              Panel Cliente - {user?.salespersonName || `${user?.firstName} ${user?.lastName}`}
            </h1>
            <p className="text-gray-600 text-base lg:text-lg">
              Gestiona tus pedidos y consulta tu historial de compras
            </p>
          </div>
        </div>
      </header>

      {/* Contenido principal */}
      <main className="px-4 lg:px-6 pb-6 space-y-6">
        {/* Métricas rápidas */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="rounded-2xl shadow-sm border-blue-200/60">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-blue-900">Último Pedido</CardTitle>
              <ShoppingCart className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-900">
                {lastOrder ? formatCurrency(lastOrder.vanedo) : '-'}
              </div>
              <p className="text-xs text-blue-700">
                {lastOrder ? formatDate(lastOrder.feemdo) : 'Sin pedidos'}
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-sm border-green-200/60">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-green-900">Historial</CardTitle>
              <Clock className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-900">{purchaseHistory.length}</div>
              <p className="text-xs text-green-700">
                Compras registradas
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-sm border-purple-200/60">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-purple-900">Total Compras</CardTitle>
              <DollarSign className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-900">
                {formatCurrency(
                  purchaseHistory.reduce((sum, item) => sum + parseFloat(item.vanedo || '0'), 0)
                )}
              </div>
              <p className="text-xs text-purple-700">
                Monto total histórico
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-sm border-orange-200/60">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-orange-900">Estado</CardTitle>
              <Package className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-900">
                <Badge variant="outline" className="text-orange-800 border-orange-300">
                  Cliente Activo
                </Badge>
              </div>
              <p className="text-xs text-orange-700">
                Estado de la cuenta
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Último Pedido Detallado */}
        {lastOrder && (
          <Card className="rounded-2xl shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-blue-600" />
                Último Pedido
              </CardTitle>
              <CardDescription>Detalles de tu pedido más reciente</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <h4 className="font-medium text-gray-900">Información del Pedido</h4>
                  <div className="mt-2 space-y-1 text-sm">
                    <p><span className="font-medium">N° Documento:</span> {lastOrder.nudo}</p>
                    <p><span className="font-medium">Fecha:</span> {formatDate(lastOrder.feemdo)}</p>
                    <p><span className="font-medium">Producto:</span> {lastOrder.nokopr}</p>
                  </div>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">Monto y Detalles</h4>
                  <div className="mt-2 space-y-1 text-sm">
                    <p><span className="font-medium">Monto:</span> {formatCurrency(lastOrder.vanedo)}</p>
                    <p><span className="font-medium">Vendedor:</span> {lastOrder.nokofu}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Historial de Compras */}
        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-purple-600" />
              Historial de Compras
            </CardTitle>
            <CardDescription>Registro de tus últimas transacciones</CardDescription>
          </CardHeader>
          <CardContent>
            {purchaseHistory.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>N° Documento</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Producto</TableHead>
                      <TableHead>Monto</TableHead>
                      <TableHead>Vendedor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {purchaseHistory.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{item.nudo}</TableCell>
                        <TableCell>{formatDate(item.feemdo)}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{item.nokopr}</TableCell>
                        <TableCell className="font-medium text-green-600">
                          {formatCurrency(item.vanedo)}
                        </TableCell>
                        <TableCell>{item.nokofu}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Package className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p className="text-lg font-medium">Sin historial de compras</p>
                <p className="text-sm">Aún no tienes transacciones registradas</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Acciones Rápidas */}
        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle>Acciones Disponibles</CardTitle>
            <CardDescription>Opciones para gestionar tu cuenta</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" className="rounded-xl">
                <ShoppingCart className="h-4 w-4 mr-2" />
                Nuevo Pedido
              </Button>
              <Button variant="outline" className="rounded-xl">
                <Clock className="h-4 w-4 mr-2" />
                Ver Historial Completo
              </Button>
              <Button variant="outline" className="rounded-xl">
                <Package className="h-4 w-4 mr-2" />
                Solicitar Cotización
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </>
  );
}