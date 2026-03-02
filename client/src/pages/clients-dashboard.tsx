import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  Search,
  Users,
  Star,
  Clock,
  TrendingUp,
  Package,
  ArrowLeft,
  LayoutDashboard,
  Calendar,
  ChevronRight
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "wouter";

export default function ClientsDashboard() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("overview");

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
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-slate-500 font-medium">Analizando tu cartera...</p>
        </div>
      </div>
    );
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const menuItems = [
    { id: "overview", label: "Resumen", icon: LayoutDashboard },
    { id: "vip", label: "Clientes VIP", icon: Star },
    { id: "inactive", label: "Inactivos", icon: Clock },
    { id: "frequent", label: "Frecuentes", icon: TrendingUp },
    { id: "products", label: "Por Producto", icon: Package },
  ];

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-y-auto">
      <main className="flex-1 w-full max-w-[1600px] mx-auto p-4 lg:p-8 space-y-8">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-indigo-600 mb-2">
              <Link href="/clientes" className="flex items-center gap-1.5 text-sm font-semibold hover:underline">
                <ArrowLeft className="h-4 w-4" />
                Volver a Clientes
              </Link>
            </div>
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
              Panel de Análisis de Cartera
            </h1>
            <p className="text-slate-500 mt-1">
              {user?.firstName} {user?.lastName} • Categorización inteligente de tus clientes
            </p>
          </div>

          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
            <Input
              placeholder="Buscar por nombre..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-11 rounded-xl border-slate-200 bg-white shadow-sm focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Custom High-End Tab Navigation */}
        <div className="flex items-center gap-2 p-1.5 bg-slate-200/40 border border-slate-200/60 rounded-2xl w-fit overflow-x-auto no-scrollbar">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 whitespace-nowrap ${activeTab === item.id
                  ? "bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200"
                  : "text-slate-600 hover:bg-white/50"
                }`}
            >
              <item.icon className={`h-4 w-4 ${activeTab === item.id ? "text-indigo-600" : "text-slate-400"}`} />
              {item.label}
            </button>
          ))}
        </div>

        {/* Dynamic Content Based on Tab */}
        <div className="space-y-8">
          {activeTab === "overview" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { label: "Clientes VIP", value: vipClients.length, icon: Star, color: "text-amber-500", bg: "bg-amber-50", desc: "Alto volumen de compras" },
                { label: "Inactivos", value: inactiveClients.length, icon: Clock, color: "text-rose-500", bg: "bg-rose-50", desc: "Sin compras en 60+ días" },
                { label: "Frecuentes", value: frequentClients.length, icon: TrendingUp, color: "text-emerald-500", bg: "bg-emerald-50", desc: "Compras regulares" },
                { label: "Total Cartera", value: (vipClients.length + inactiveClients.length + frequentClients.length), icon: Users, color: "text-indigo-500", bg: "bg-indigo-50", desc: "Clientes analizados" },
              ].map((stat, idx) => (
                <Card key={idx} className="rounded-2xl border-slate-200/60 shadow-sm bg-white overflow-hidden group hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className={`p-3 rounded-xl ${stat.bg} ${stat.color} transition-transform group-hover:scale-110`}>
                        <stat.icon className="h-6 w-6" />
                      </div>
                      <Badge variant="outline" className="rounded-lg bg-slate-50 text-slate-500 border-slate-100 font-bold">
                        {Math.round((stat.value / (vipClients.length + inactiveClients.length + frequentClients.length || 1)) * 100)}%
                      </Badge>
                    </div>
                    <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider">{stat.label}</p>
                    <div className="flex items-baseline gap-2 mt-1">
                      <p className="text-3xl font-bold text-slate-900">{stat.value}</p>
                    </div>
                    <p className="text-xs text-slate-400 mt-2 font-medium">{stat.desc}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {activeTab === "vip" && (
            <Card className="rounded-2xl border-slate-200/60 shadow-sm overflow-hidden bg-white">
              <CardHeader className="bg-slate-50/50 border-b border-slate-100/60 p-6">
                <CardTitle className="text-xl font-bold flex items-center gap-2">
                  <Star className="h-5 w-5 text-amber-500 fill-amber-500" />
                  Clientes VIP
                </CardTitle>
                <CardDescription>Los clientes con mayor volumen de compras en tu cartera.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-slate-50">
                  {filterClients(vipClients, searchTerm).map((client: any) => (
                    <div key={client.clientName} className="flex flex-col sm:flex-row sm:items-center justify-between p-6 hover:bg-slate-50/50 transition-colors group">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600 font-bold text-lg">
                          {client.clientName.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{client.clientName}</p>
                          <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                            <span className="font-semibold text-slate-700">{client.transactionCount} compras</span>
                            <span>•</span>
                            <span>Última: {new Date(client.lastPurchaseDate).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                      <div className="mt-4 sm:mt-0 text-right">
                        <p className="text-lg font-bold text-slate-900">{formatCurrency(client.totalSales)}</p>
                        <p className="text-xs font-semibold text-indigo-600">Ticket prom: {formatCurrency(client.averageTicket)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === "inactive" && (
            <Card className="rounded-2xl border-slate-200/60 shadow-sm overflow-hidden bg-white">
              <CardHeader className="bg-slate-50/50 border-b border-slate-100/60 p-6">
                <CardTitle className="text-xl font-bold flex items-center gap-2">
                  <Clock className="h-5 w-5 text-rose-500" />
                  Clientes Inactivos
                </CardTitle>
                <CardDescription>Clientes que no han realizado compras en los últimos 60 días.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-slate-50">
                  {filterClients(inactiveClients, searchTerm).map((client: any) => (
                    <div key={client.clientName} className="flex flex-col sm:flex-row sm:items-center justify-between p-6 hover:bg-slate-50/50 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-600 font-bold text-lg">
                          {client.clientName.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{client.clientName}</p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Última compra: <span className="font-semibold text-rose-600">{new Date(client.lastPurchaseDate).toLocaleDateString()}</span>
                          </p>
                        </div>
                      </div>
                      <div className="mt-4 sm:mt-0 flex flex-col items-end gap-2">
                        <Badge className="bg-rose-500 hover:bg-rose-600 text-white rounded-lg px-2.5 py-1">
                          {client.daysSinceLastPurchase} días inactivo
                        </Badge>
                        <p className="text-xs text-slate-400 font-medium">Total hist: {formatCurrency(client.totalSales)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === "frequent" && (
            <Card className="rounded-2xl border-slate-200/60 shadow-sm overflow-hidden bg-white">
              <CardHeader className="bg-slate-50/50 border-b border-slate-100/60 p-6">
                <CardTitle className="text-xl font-bold flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-emerald-500" />
                  Clientes Frecuentes
                </CardTitle>
                <CardDescription>Clientes con un patrón de compra regular y predecible.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-slate-50">
                  {filterClients(frequentClients, searchTerm).map((client: any) => (
                    <div key={client.clientName} className="flex flex-col sm:flex-row sm:items-center justify-between p-6 hover:bg-slate-50/50 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 font-bold text-lg">
                          {client.clientName.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{client.clientName}</p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Total compras: <span className="font-semibold">{client.transactionCount}</span>
                          </p>
                        </div>
                      </div>
                      <div className="mt-4 sm:mt-0 text-right">
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-100 rounded-lg px-2.5 py-1 font-bold mb-1">
                          Cada {client.purchaseFrequency} días
                        </Badge>
                        <p className="text-sm font-bold text-slate-900">{formatCurrency(client.totalSales)} total</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === "products" && (
            <Card className="rounded-2xl border-slate-200/60 shadow-sm overflow-hidden bg-white">
              <CardHeader className="bg-slate-50/50 border-b border-slate-100/60 p-6">
                <CardTitle className="text-xl font-bold flex items-center gap-2">
                  <Package className="h-5 w-5 text-indigo-500" />
                  Análisis por Producto
                </CardTitle>
                <CardDescription>Descubre el producto principal de cada uno de tus clientes.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-slate-50">
                  {filterClients(clientsWithTopProducts, searchTerm).map((client: any) => (
                    <div key={client.clientName} className="flex flex-col sm:flex-row sm:items-center justify-between p-6 hover:bg-slate-50/50 transition-colors">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
                          <Package className="h-6 w-6" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900">{client.clientName}</p>
                          <p className="text-sm text-indigo-600 font-semibold truncate mt-0.5">
                            {client.topProduct}
                          </p>
                        </div>
                      </div>
                      <div className="mt-4 sm:mt-0 text-right shrink-0">
                        <p className="text-lg font-bold text-slate-900">{formatCurrency(client.productSales)}</p>
                        <div className="flex items-center justify-end gap-2 mt-1">
                          <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-indigo-500 rounded-full"
                              style={{ width: `${Math.round((client.productSales / client.totalClientSales) * 100)}%` }}
                            />
                          </div>
                          <span className="text-xs font-bold text-slate-500">
                            {Math.round((client.productSales / client.totalClientSales) * 100)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}