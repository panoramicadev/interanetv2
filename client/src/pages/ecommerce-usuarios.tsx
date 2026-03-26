import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Users, Search, Mail, Phone, MapPin, Calendar, ArrowLeft,
  UserCircle, Hash, Building2, KeyRound, ShoppingBag,
  CreditCard, FileText, TrendingUp, DollarSign, Package,
  Clock, Eye
} from "lucide-react";

interface ClientUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  createdAt: string;
  hasCredentials: boolean;
  clientId: string | null;
  clientCode: string | null;
  clientName: string;
  rut: string | null;
  phone: string | null;
  address: string | null;
  commune: string | null;
  assignedSalesperson: string | null;
  salesRepCode: string | null;
  creditLimit: number | null;
  creditAvailable: number | null;
  paymentCondition: string | null;
}

// ─── Client Profile Detail Panel ─────────────────────────
function ClientProfile({ client, onBack }: { client: ClientUser; onBack: () => void }) {
  const [activeTab, setActiveTab] = useState("overview");

  // Fetch client orders
  const { data: orders = [] } = useQuery<any[]>({
    queryKey: ["/api/ecommerce/orders", { clientUserId: client.id }],
    queryFn: async () => {
      try {
        const res = await apiRequest("GET", `/api/ecommerce/orders?userId=${client.id}`);
        return await res.json();
      } catch {
        return [];
      }
    },
  });

  // Fetch SAP price list for this client's code
  const { data: priceListData } = useQuery<{ items: any[]; totalCount: number }>({
    queryKey: ["/api/price-list", { clientCode: client.clientCode }],
    queryFn: async () => {
      try {
        const res = await apiRequest("GET", `/api/price-list?limit=100&offset=0`);
        return await res.json();
      } catch {
        return { items: [], totalCount: 0 };
      }
    },
    enabled: !!client.clientCode,
  });

  const priceList = priceListData?.items || [];

  const formatDate = (date: string | null) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("es-CL", {
      day: "2-digit", month: "short", year: "numeric",
    });
  };

  const formatCurrency = (value: number | null) => {
    if (!value) return "—";
    return `$${value.toLocaleString("de-DE", { maximumFractionDigits: 0 })}`;
  };

  const totalOrders = orders.length;
  const totalSpent = orders.reduce((acc: number, o: any) => acc + (parseFloat(o.total) || 0), 0);
  const pendingOrders = orders.filter((o: any) => o.status === "pending" || o.status === "Pendiente").length;
  const approvedOrders = orders.filter((o: any) => o.status === "approved" || o.status === "Aprobado").length;

  return (
    <div className="space-y-6 p-6">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group"
      >
        <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
        Volver a Usuarios
      </button>

      {/* Profile Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 md:p-8 text-white">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSA2MCAwIEwgMCAwIDAgNjAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjAzKSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-40" />
        <div className="relative flex flex-col md:flex-row md:items-center gap-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-2xl font-bold shadow-lg">
            {(client.clientName || client.email)?.[0]?.toUpperCase() || "?"}
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{client.clientName}</h1>
            <div className="flex flex-wrap items-center gap-3 mt-2 text-slate-300 text-sm">
              {client.email && (
                <span className="flex items-center gap-1">
                  <Mail className="h-3.5 w-3.5" /> {client.email}
                </span>
              )}
              {client.rut && (
                <span className="flex items-center gap-1">
                  <Building2 className="h-3.5 w-3.5" /> {client.rut}
                </span>
              )}
              {client.clientCode && (
                <span className="flex items-center gap-1">
                  <Hash className="h-3.5 w-3.5" /> {client.clientCode}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-green-500/20 text-green-300 border-green-500/30 px-3 py-1">
              <KeyRound className="h-3 w-3 mr-1" />
              Acceso activo
            </Badge>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-0 shadow-sm bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/50 dark:to-blue-900/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-medium text-blue-600 uppercase tracking-wider">Total Pedidos</p>
                <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">{totalOrders}</p>
              </div>
              <ShoppingBag className="h-8 w-8 text-blue-400/60" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/50 dark:to-emerald-900/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-medium text-emerald-600 uppercase tracking-wider">Total Comprado</p>
                <p className="text-2xl font-bold text-emerald-900 dark:text-emerald-100">{formatCurrency(totalSpent)}</p>
              </div>
              <DollarSign className="h-8 w-8 text-emerald-400/60" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-950/50 dark:to-amber-900/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-medium text-amber-600 uppercase tracking-wider">Pendientes</p>
                <p className="text-2xl font-bold text-amber-900 dark:text-amber-100">{pendingOrders}</p>
              </div>
              <Clock className="h-8 w-8 text-amber-400/60" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-950/50 dark:to-purple-900/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-medium text-purple-600 uppercase tracking-wider">Aprobados</p>
                <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">{approvedOrders}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-purple-400/60" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs: Overview / Orders / Price List */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full flex h-auto p-1 bg-muted/50 rounded-xl gap-1">
          <TabsTrigger value="overview" className="flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <UserCircle className="h-4 w-4" /> Perfil
          </TabsTrigger>
          <TabsTrigger value="orders" className="flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <ShoppingBag className="h-4 w-4" /> Pedidos
            {totalOrders > 0 && <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">{totalOrders}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="pricelist" className="flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <FileText className="h-4 w-4" /> Lista de Precios
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <UserCircle className="h-4 w-4 text-blue-500" />
                  Información General
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { label: "Nombre", value: client.clientName, icon: UserCircle },
                  { label: "Email", value: client.email, icon: Mail },
                  { label: "RUT", value: client.rut, icon: Building2 },
                  { label: "Código", value: client.clientCode, icon: Hash },
                  { label: "Teléfono", value: client.phone, icon: Phone },
                  { label: "Dirección", value: client.address, icon: MapPin },
                  { label: "Comuna", value: client.commune, icon: MapPin },
                  { label: "Registro", value: formatDate(client.createdAt), icon: Calendar },
                ].map(({ label, value, icon: Icon }) => (
                  <div key={label} className="flex items-center justify-between py-2 border-b border-muted/50 last:border-0">
                    <span className="text-sm text-muted-foreground flex items-center gap-2">
                      <Icon className="h-3.5 w-3.5" /> {label}
                    </span>
                    <span className="text-sm font-medium text-right max-w-[60%] truncate">{value || "—"}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-emerald-500" />
                  Información Comercial
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { label: "Condición de Pago", value: client.paymentCondition },
                  { label: "Código Vendedor", value: client.salesRepCode },
                  { label: "Límite de Crédito", value: formatCurrency(client.creditLimit) },
                  { label: "Crédito Disponible", value: formatCurrency(client.creditAvailable) },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between py-2 border-b border-muted/50 last:border-0">
                    <span className="text-sm text-muted-foreground">{label}</span>
                    <span className="text-sm font-medium">{value || "—"}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Orders Tab */}
        <TabsContent value="orders" className="mt-4">
          <Card className="border-0 shadow-sm rounded-xl overflow-hidden">
            <CardHeader className="bg-muted/30 border-b px-6 py-4">
              <CardTitle className="text-base">Historial de Pedidos</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Todos los pedidos realizados por este cliente
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {orders.length === 0 ? (
                <div className="text-center py-12">
                  <ShoppingBag className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">Este cliente aún no tiene pedidos</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/20">
                      <TableHead className="text-xs uppercase">Pedido</TableHead>
                      <TableHead className="text-xs uppercase">Fecha</TableHead>
                      <TableHead className="text-xs uppercase">Productos</TableHead>
                      <TableHead className="text-xs uppercase text-right">Total</TableHead>
                      <TableHead className="text-xs uppercase text-center">Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((order: any) => (
                      <TableRow key={order.id} className="hover:bg-muted/10">
                        <TableCell className="font-mono text-sm font-semibold text-orange-600">
                          #{order.orderNumber || order.id?.slice(0, 8)}
                        </TableCell>
                        <TableCell className="text-sm">{formatDate(order.createdAt)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {order.items?.length || 0} items
                        </TableCell>
                        <TableCell className="text-sm text-right font-medium tabular-nums">
                          {formatCurrency(parseFloat(order.total || "0"))}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant="secondary"
                            className={`text-[10px] px-2 py-0.5 ${
                              order.status === "approved" || order.status === "Aprobado"
                                ? "bg-green-100 text-green-700 border-green-200"
                                : order.status === "archived"
                                ? "bg-gray-100 text-gray-500"
                                : "bg-amber-100 text-amber-700 border-amber-200"
                            }`}
                          >
                            {order.status === "approved" || order.status === "Aprobado"
                              ? "Aprobado"
                              : order.status === "archived"
                              ? "Archivado"
                              : "Pendiente"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Price List Tab */}
        <TabsContent value="pricelist" className="mt-4">
          <Card className="border-0 shadow-sm rounded-xl overflow-hidden">
            <CardHeader className="bg-muted/30 border-b px-6 py-4">
              <CardTitle className="text-base">Lista de Precios</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Catálogo de precios comerciales disponible para este cliente
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {priceList.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No hay lista de precios cargada</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/20">
                        <TableHead className="text-xs uppercase">Código</TableHead>
                        <TableHead className="text-xs uppercase">Producto</TableHead>
                        <TableHead className="text-xs uppercase">Unidad</TableHead>
                        <TableHead className="text-xs uppercase text-right">Lista</TableHead>
                        <TableHead className="text-xs uppercase text-right">Desc. 10%</TableHead>
                        <TableHead className="text-xs uppercase text-right">Mínimo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {priceList.slice(0, 50).map((item: any) => (
                        <TableRow key={item.id} className="hover:bg-muted/10">
                          <TableCell className="font-mono text-sm font-semibold text-orange-600">{item.codigo}</TableCell>
                          <TableCell className="text-sm font-medium">{item.producto}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs rounded-md">{item.unidad}</Badge>
                          </TableCell>
                          <TableCell className="text-right tabular-nums font-medium">
                            {Number(item.lista) > 0 ? `$${Number(item.lista).toLocaleString("de-DE", { maximumFractionDigits: 0 })}` : "—"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">
                            {Number(item.desc10) > 0 ? `$${Number(item.desc10).toLocaleString("de-DE", { maximumFractionDigits: 0 })}` : "—"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums font-semibold text-emerald-600">
                            {Number(item.minimo) > 0 ? `$${Number(item.minimo).toLocaleString("de-DE", { maximumFractionDigits: 0 })}` : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Main eCommerce Users Page ────────────────────────────
export default function EcommerceUsuarios() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClient, setSelectedClient] = useState<ClientUser | null>(null);

  const { data: clients = [], isLoading } = useQuery<ClientUser[]>({
    queryKey: ["/api/users/clients"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/users/clients");
      return res.json();
    },
  });

  const filteredClients = clients.filter((c) => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (
      c.clientName?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.clientCode?.toLowerCase().includes(q) ||
      c.rut?.toLowerCase().includes(q) ||
      c.phone?.toLowerCase().includes(q)
    );
  });

  const formatDate = (date: string | null) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("es-CL", {
      day: "2-digit", month: "short", year: "numeric",
    });
  };

  // Show client profile detail
  if (selectedClient) {
    return <ClientProfile client={selectedClient} onBack={() => setSelectedClient(null)} />;
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Users className="h-6 w-6 text-blue-600" />
            Usuarios eCommerce
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Clientes con acceso al portal de compras
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50 border-blue-200">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-blue-600 uppercase">Total Usuarios</p>
              <p className="text-2xl font-bold text-blue-900">{clients.length}</p>
            </div>
            <Users className="h-8 w-8 text-blue-400" />
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-50 to-green-100/50 border-green-200">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-green-600 uppercase">Con Ficha Cliente</p>
              <p className="text-2xl font-bold text-green-900">{clients.filter(c => c.clientId).length}</p>
            </div>
            <Building2 className="h-8 w-8 text-green-400" />
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-50 to-purple-100/50 border-purple-200">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-purple-600 uppercase">Solo Credenciales</p>
              <p className="text-2xl font-bold text-purple-900">{clients.filter(c => !c.clientId).length}</p>
            </div>
            <KeyRound className="h-8 w-8 text-purple-400" />
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Buscar por nombre, email, RUT o código..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9 text-sm"
        />
      </div>

      {/* Clients List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : filteredClients.length === 0 ? (
        <Card className="bg-white dark:bg-gray-800">
          <CardContent className="py-16 text-center">
            <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-500">
              {searchTerm ? "Sin resultados" : "No hay clientes registrados"}
            </h3>
            <p className="text-sm text-gray-400 mt-1">
              {searchTerm ? "Intenta con otro término de búsqueda" : "Los usuarios se crean desde la sección de Clientes asignando credenciales"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredClients.map((client) => (
            <Card
              key={client.id}
              className="bg-white dark:bg-gray-800 hover:shadow-md transition-all cursor-pointer group border border-transparent hover:border-blue-200"
              onClick={() => setSelectedClient(client)}
            >
              <CardContent className="p-4">
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                  {/* Avatar + Name */}
                  <div className="flex items-center gap-3 min-w-0 lg:w-1/3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                      {(client.clientName || client.email)?.[0]?.toUpperCase() || "?"}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                          {client.clientName}
                        </h3>
                      </div>
                      {client.email && (
                        <p className="text-xs text-gray-500 flex items-center gap-1 truncate">
                          <Mail className="h-3 w-3 flex-shrink-0" />
                          {client.email}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Info pills */}
                  <div className="flex flex-wrap items-center gap-2 lg:flex-1">
                    {client.clientCode && (
                      <span className="inline-flex items-center gap-1 text-xs bg-gray-50 text-gray-600 px-2 py-1 rounded-md border border-gray-100">
                        <Hash className="h-3 w-3" /> {client.clientCode}
                      </span>
                    )}
                    {client.rut && (
                      <span className="inline-flex items-center gap-1 text-xs bg-gray-50 text-gray-600 px-2 py-1 rounded-md border border-gray-100">
                        <Building2 className="h-3 w-3" /> {client.rut}
                      </span>
                    )}
                    {client.phone && (
                      <span className="inline-flex items-center gap-1 text-xs bg-gray-50 text-gray-600 px-2 py-1 rounded-md border border-gray-100">
                        <Phone className="h-3 w-3" /> {client.phone}
                      </span>
                    )}
                    {client.commune && (
                      <span className="inline-flex items-center gap-1 text-xs bg-gray-50 text-gray-600 px-2 py-1 rounded-md border border-gray-100">
                        <MapPin className="h-3 w-3" /> {client.commune}
                      </span>
                    )}
                  </div>

                  {/* Date + Action */}
                  <div className="flex items-center gap-4 text-xs text-gray-400 lg:w-auto lg:flex-shrink-0">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDate(client.createdAt)}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs opacity-0 group-hover:opacity-100 transition-opacity text-blue-600"
                    >
                      <Eye className="h-3.5 w-3.5 mr-1" />
                      Ver perfil
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          <p className="text-xs text-gray-400 text-center pt-2">
            Mostrando {filteredClients.length} de {clients.length} usuarios
          </p>
        </div>
      )}
    </div>
  );
}
