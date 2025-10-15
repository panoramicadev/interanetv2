import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Filter, TrendingUp, Package, DollarSign } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export default function FactVentasPage() {
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [cliente, setCliente] = useState("");
  const [producto, setProducto] = useState("");
  const [vendedor, setVendedor] = useState("");

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ['/api/fact-ventas/stats', fechaDesde, fechaHasta, cliente, vendedor],
    enabled: true
  });

  // Fetch ventas data
  const { data: ventas, isLoading } = useQuery({
    queryKey: ['/api/fact-ventas', fechaDesde, fechaHasta, cliente, producto, vendedor],
    enabled: true
  });

  const handleReset = () => {
    setFechaDesde("");
    setFechaHasta("");
    setCliente("");
    setProducto("");
    setVendedor("");
  };

  const formatNumber = (num: any) => {
    return new Intl.NumberFormat('es-CL').format(Number(num) || 0);
  };

  const formatCurrency = (num: any) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP'
    }).format(Number(num) || 0);
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Fact Ventas</h1>
          <p className="text-muted-foreground" data-testid="text-page-description">
            Análisis de datos de ventas detallado
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card data-testid="card-total-ventas">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Ventas</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-ventas">
              {formatCurrency(stats?.totalVentas || 0)}
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-total-unidades">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Unidades</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-unidades">
              {formatNumber(stats?.totalUnidades || 0)}
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-total-transacciones">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Transacciones</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-transacciones">
              {formatNumber(stats?.totalTransacciones || 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters Card */}
      <Card data-testid="card-filtros">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros
          </CardTitle>
          <CardDescription>Filtra los datos de ventas por diferentes criterios</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="fecha-desde">Fecha Desde</label>
              <Input
                id="fecha-desde"
                type="date"
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
                data-testid="input-fecha-desde"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="fecha-hasta">Fecha Hasta</label>
              <Input
                id="fecha-hasta"
                type="date"
                value={fechaHasta}
                onChange={(e) => setFechaHasta(e.target.value)}
                data-testid="input-fecha-hasta"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="cliente">Cliente</label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="cliente"
                  placeholder="Buscar cliente..."
                  value={cliente}
                  onChange={(e) => setCliente(e.target.value)}
                  className="pl-8"
                  data-testid="input-cliente"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="producto">Producto</label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="producto"
                  placeholder="Buscar producto..."
                  value={producto}
                  onChange={(e) => setProducto(e.target.value)}
                  className="pl-8"
                  data-testid="input-producto"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="vendedor">Vendedor</label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="vendedor"
                  placeholder="Buscar vendedor..."
                  value={vendedor}
                  onChange={(e) => setVendedor(e.target.value)}
                  className="pl-8"
                  data-testid="input-vendedor"
                />
              </div>
            </div>
            <div className="flex items-end">
              <Button 
                variant="outline" 
                onClick={handleReset} 
                className="w-full"
                data-testid="button-reset-filters"
              >
                Limpiar Filtros
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card data-testid="card-tabla-ventas">
        <CardHeader>
          <CardTitle>Detalle de Ventas</CardTitle>
          <CardDescription>
            {ventas?.length || 0} transacciones encontradas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>N° Documento</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead>Vendedor</TableHead>
                  <TableHead className="text-right">Unidades</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      Cargando datos...
                    </TableCell>
                  </TableRow>
                ) : !ventas || ventas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No se encontraron ventas
                    </TableCell>
                  </TableRow>
                ) : (
                  ventas.map((venta: any) => (
                    <TableRow key={venta.idmaeddo} data-testid={`row-venta-${venta.idmaeddo}`}>
                      <TableCell>
                        {venta.feemli ? format(new Date(venta.feemli), 'dd/MM/yyyy', { locale: es }) : '-'}
                      </TableCell>
                      <TableCell>{venta.nudo || '-'}</TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {venta.nokoen || venta.endo || '-'}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {venta.nokoprct || venta.koprct || '-'}
                      </TableCell>
                      <TableCell>{venta.nokofu || venta.kofudo || '-'}</TableCell>
                      <TableCell className="text-right">
                        {formatNumber(venta.caprco2 || 0)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(venta.vaneli || 0)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
