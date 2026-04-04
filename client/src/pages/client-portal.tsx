import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useAiChat } from "@/hooks/useAiChat";
import AiChatView from "@/components/ai-chat/AiChatView";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Package,
  Bot,
  Search,
  Loader2,
  ShoppingCart,
  Truck,
  FileCheck,
  DollarSign,
  Calendar,
  User,
  ClipboardList,
  TrendingUp,
  Gift,
  Star,
  Award,
  Crown,
  ChevronRight,
  ArrowRight,
  BarChart3,
  ExternalLink,
} from "lucide-react";

// ==========================================
// Helpers
// ==========================================

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

const formatDate = (dateStr: string) => {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  return date.toLocaleDateString("es-CL", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

// ==========================================
// Types
// ==========================================

interface NVVRecord {
  id: string;
  NUDO: string;
  TIDO: string;
  FEEMDO: string;
  ENDO: string;
  NOKOEN: string;
  NOKOPR: string;
  KOPRCT: string;
  CAPREX2: number;
  CAPRCO2: number;
  PPPRNE: number;
  cantidadPendiente: number;
  totalPendiente: number;
}

interface GDVRecord {
  numeroGuia: string;
  fecha: string;
  cliente: string;
  codigoCliente: string;
  producto: string;
  cantidad: number;
  monto: number;
}

const CLIENT_AI_SUGGESTIONS = [
  "¿Qué pinturas tienen para exterior?",
  "¿Qué esmaltes al agua tienen?",
  "Quiero cotizar productos para una obra",
  "¿Tienen barniz marino?",
  "¿Qué productos recomiendan para humedad?",
  "Necesito pintura para metal",
];

// ==========================================
// Dashboard Tab
// ==========================================

function DashboardTab({ salesperson }: { salesperson: string }) {
  // Fetch Web Orders (eCommerce) directly for the client
  const { data: webOrders = [], isLoading: webLoading } = useQuery<any[]>({
    queryKey: ["/api/ecommerce/client/orders"],
    queryFn: async () => {
      const res = await fetch(`/api/ecommerce/client/orders`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    }
  });

  // Fetch ERP Orders directly for the client
  const { data: erpData, isLoading: erpLoading } = useQuery({
    queryKey: ["/api/ecommerce/client/erp-orders"],
    queryFn: async () => {
      const res = await fetch(`/api/ecommerce/client/erp-orders`, { credentials: "include" });
      if (!res.ok) return { nvv: [], gdv: [], transactions: [] };
      return res.json();
    }
  });

  const isLoading = webLoading || erpLoading;

  // Compute metrics from Web Orders
  const validOrders = useMemo(() => {
    return webOrders.filter((o: any) => o.status === 'pending' || o.status === 'approved' || o.status === 'processing');
  }, [webOrders]);

  const totalAmount = useMemo(() => {
    let sum = validOrders.reduce((acc, o) => acc + (Number(o.total) || 0), 0);
    if (erpData?.nvv) {
       sum += erpData.nvv.reduce((acc: number, o: any) => acc + (Number(o.VABRDO) || 0), 0);
    }
    if (erpData?.transactions) {
       // Omitir NVV para no duplicar si consideramos todo histórico facturado,
       // o sumar transactions y quitar nvv. Para historial global sumamos facturado.
       // actually the previous design was sum of everything.
       sum += erpData.transactions.reduce((acc: number, o: any) => acc + (Number(o.vabrdo) || Number(o.amount) || 0), 0);
    }
    return sum;
  }, [validOrders, erpData]);

  const totalUnits = useMemo(() => {
    let sum = validOrders.reduce((acc, o) => {
      return acc + (o.items?.reduce((sum2: number, item: any) => sum2 + item.quantity, 0) || 0);
    }, 0);
    if (erpData?.nvv) {
       sum += erpData.nvv.reduce((acc: number, o: any) => acc + (Number(o.CAPRCO2) || 0), 0);
    }
    if (erpData?.transactions) {
       sum += erpData.transactions.reduce((acc: number, o: any) => acc + (Number(o.caprad) || 0), 0);
    }
    return sum;
  }, [validOrders, erpData]);

  const totalOrdersCount = useMemo(() => {
    return validOrders.length + (erpData?.nvv?.length || 0) + (erpData?.transactions?.length || 0);
  }, [validOrders, erpData]);

  // Compute Top Products
  const topProducts = useMemo(() => {
    const productMap: Record<string, { name: string; qty: number; timesOrdered: number; price: number }> = {};
    
    // Add Web Orders
    validOrders.forEach((o: any) => {
      if (!o.items) return;
      o.items.forEach((item: any) => {
        if (!productMap[item.productId]) {
          productMap[item.productId] = { 
            name: item.productName, 
            qty: 0, 
            timesOrdered: 0,
            price: Number(item.unitPrice) || 0
          };
        }
        productMap[item.productId].qty += item.quantity;
        productMap[item.productId].timesOrdered += 1;
      });
    });

    // Add ERP NVV
    if (erpData?.nvv) {
      erpData.nvv.forEach((row: any) => {
        if (!row.KOPRCT && !row.NOKOPR) return;
        const code = row.KOPRCT || row.NOKOPR; // Use name as fallback ID if code is empty
        if (!productMap[code]) {
           productMap[code] = {
             name: row.NOKOPR,
             qty: 0,
             timesOrdered: 0,
             price: Number(row.PPPRNE) || 0
           };
        }
        productMap[code].qty += Number(row.CAPRCO2) || 0;
        productMap[code].timesOrdered += 1;
      });
    }

    // Add ERP Transactions (Invoices)
    if (erpData?.transactions) {
      erpData.transactions.forEach((row: any) => {
        if (!row.koprct && !row.nokoprct) return;
        const code = row.koprct || row.nokoprct;
        if (!productMap[code]) {
           productMap[code] = {
             name: row.nokoprct,
             qty: 0,
             timesOrdered: 0,
             price: Number(row.precio) || 0
           };
        }
        productMap[code].qty += Number(row.caprad) || Number(row.caprad2) || 0;
        productMap[code].timesOrdered += 1;
      });
    }

    return Object.values(productMap).sort((a,b) => b.qty - a.qty).slice(0, 5);
  }, [validOrders, erpData]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome header */}
      <div className="bg-gradient-to-r from-blue-700 to-indigo-800 rounded-2xl p-6 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl" />
        <div className="relative z-10">
          <h2 className="text-2xl font-bold">Resumen de Cuenta</h2>
          <p className="text-blue-100 text-sm mt-1 max-w-2xl">
            Tus métricas de compra, pedidos recientes y productos más solicitados a través de nuestro portal eCommerce.
          </p>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-blue-50 to-blue-100/50">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 rounded-xl bg-blue-500/10">
                <ShoppingCart className="h-5 w-5 text-blue-600" />
              </div>
              <Badge className="bg-blue-100 text-blue-700 text-[10px] border-0">Total</Badge>
            </div>
            <p className="text-2xl font-bold text-blue-900">{totalOrdersCount}</p>
            <p className="text-xs text-blue-600 mt-1">Pedidos históricos generados</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-purple-50 to-purple-100/50">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 rounded-xl bg-purple-500/10">
                <Package className="h-5 w-5 text-purple-600" />
              </div>
              <Badge className="bg-purple-100 text-purple-700 text-[10px] border-0">Items</Badge>
            </div>
            <p className="text-2xl font-bold text-purple-900">{totalUnits.toLocaleString('es-CL')}</p>
            <p className="text-xs text-purple-600 mt-1">Unidades totales despachadas/pendientes</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-amber-50 to-amber-100/50">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 rounded-xl bg-amber-500/10">
                <DollarSign className="h-5 w-5 text-amber-600" />
              </div>
              <Badge className="bg-amber-100 text-amber-700 text-[10px] border-0">Valor</Badge>
            </div>
            <p className="text-2xl font-bold text-amber-900">{formatCurrency(totalAmount)}</p>
            <p className="text-xs text-amber-600 mt-1">Volumen de compra histórico</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Most Sold Products */}
        <Card className="rounded-2xl border border-gray-100 shadow-sm h-full">
          <CardHeader className="pb-3 border-b border-gray-50 bg-gray-50/50 rounded-t-2xl">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2 text-gray-800">
                <TrendingUp className="h-4 w-4 text-emerald-500" />
                Tus Productos Más Comprados
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {topProducts.length === 0 ? (
              <div className="p-8 text-center">
                <Package className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">Aún no hay historial suficiente de productos.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {topProducts.map((prod, idx) => (
                  <div key={idx} className="p-4 flex items-center justify-between hover:bg-gray-50/80 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 shrink-0 bg-emerald-50 rounded-lg flex items-center justify-center font-bold text-emerald-600">
                        #{idx + 1}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 line-clamp-1">{prod.name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">En {prod.timesOrdered} pedido(s) distintos</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-4">
                      <p className="text-sm font-bold text-gray-800">{prod.qty} uds</p>
                      <p className="text-[10px] text-gray-400">Total acumulado</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Last pending orders quick view */}
        <Card className="rounded-2xl border border-gray-100 shadow-sm h-full">
          <CardHeader className="pb-3 border-b border-gray-50 bg-gray-50/50 rounded-t-2xl">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2 text-gray-800">
                <ShoppingCart className="h-4 w-4 text-blue-500" />
                Pedidos Recientes Web
              </CardTitle>
              <a href="/mis-pedidos" className="text-xs text-blue-600 font-semibold flex items-center hover:underline">
                Ver todos <ArrowRight className="h-3 w-3 ml-1" />
              </a>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {validOrders.length === 0 ? (
              <div className="p-8 text-center">
                <ClipboardList className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No hay pedidos registrados.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {validOrders.slice(0, 5).map((r: any) => (
                  <div key={r.id} className="p-4 flex items-center justify-between hover:bg-gray-50/80 transition-colors">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-gray-900 truncate">
                          {r.items?.length === 1 ? r.items[0].productName : `Mix de Productos (${r.items?.length || 0})`}
                        </p>
                        <Badge variant="secondary" className="text-[9px] px-1.5 font-normal tracking-wide">
                          {r.status === 'pending' ? 'Pendiente' : r.status === 'approved' ? 'Aprobado' : r.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs font-mono text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">{r.id.substring(0, 8).toUpperCase()}</span>
                        <span className="text-[10px] text-gray-400">·</span>
                        <span className="text-[11px] text-gray-500 font-medium flex items-center gap-1">
                          <Calendar className="h-3 w-3" /> {formatDate(r.createdAt)}
                        </span>
                      </div>
                    </div>
                    <div className="text-right ml-4">
                      <p className="text-sm font-bold text-amber-600">{formatCurrency(Number(r.total))}</p>
                      <p className="text-[11px] text-gray-500">{r.items?.reduce((acc: number, val: any) => acc + val.quantity, 0)} uds</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
        <a href="/tienda" className="flex items-center gap-3 p-4 rounded-2xl bg-white border border-gray-100 hover:border-orange-200 hover:shadow-md transition-all group">
          <div className="p-2.5 rounded-xl bg-orange-50 group-hover:bg-orange-100 transition-colors">
            <ShoppingCart className="h-5 w-5 text-orange-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900">Ir a la Tienda</p>
            <p className="text-[10px] text-gray-500">Explorar catálogo y comprar</p>
          </div>
          <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-orange-400 transition-colors" />
        </a>
        <a href="/mis-pedidos" className="flex items-center gap-3 p-4 rounded-2xl bg-white border border-gray-100 hover:border-blue-200 hover:shadow-md transition-all group">
          <div className="p-2.5 rounded-xl bg-blue-50 group-hover:bg-blue-100 transition-colors">
            <ClipboardList className="h-5 w-5 text-blue-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900">Ver Pedidos Completos</p>
            <p className="text-[10px] text-gray-500">Ingresados y en despacho</p>
          </div>
          <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-blue-400 transition-colors" />
        </a>
      </div>
    </div>
  );
}

// ==========================================
// Pedidos Tab (NVV + GDV + Facturas)
// ==========================================

function PedidosTab({ salesperson }: { salesperson: string }) {
  const [subTab, setSubTab] = useState<"nvv" | "gdv" | "facturas">("nvv");

  // NVV by Salesperson (Only for assigned accounts/salespeople)
  const { data: nvvSalespersonData = [], isLoading: nvvLoading } = useQuery<NVVRecord[]>({
    queryKey: ["/api/nvv/by-salesperson", salesperson, "all", "all"],
    queryFn: async () => {
      if (!salesperson) return [];
      const params = new URLSearchParams({ salesperson });
      const res = await fetch(`/api/nvv/by-salesperson?${params}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Fetch ERP Orders directly for the client (linked by RUT)
  const { data: erpData, isLoading: erpLoading } = useQuery({
    queryKey: ["/api/ecommerce/client/erp-orders"],
    queryFn: async () => {
      const res = await fetch(`/api/ecommerce/client/erp-orders`, { credentials: "include" });
      if (!res.ok) return { nvv: [], gdv: [], transactions: [] };
      return res.json();
    }
  });

  // Fetch Web pending orders
  const { data: webOrders = [], isLoading: webLoading } = useQuery<any[]>({
    queryKey: ["/api/ecommerce/client/orders"],
    queryFn: async () => {
      const res = await fetch(`/api/ecommerce/client/orders`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    }
  });

  const pendingWebOrders = webOrders.filter((o: any) => o.status === 'pending' || o.status === 'approved').map((o: any) => ({
    id: o.id,
    NUDO: o.id.substring(0, 8).toUpperCase(),
    TIDO: 'WEB',
    FEEMDO: o.createdAt,
    ENDO: '',
    NOKOEN: o.clientName,
    NOKOPR: o.items?.length === 1 ? o.items[0].productName : `Ped. Web (${o.items?.length || 0} arts.)`,
    KOPRCT: '',
    CAPREX2: o.items?.reduce((acc: number, item: any) => acc + item.quantity, 0) || 0,
    CAPRCO2: 0,
    PPPRNE: 0,
    cantidadPendiente: o.items?.reduce((acc: number, item: any) => acc + item.quantity, 0) || 0,
    totalPendiente: Number(o.total) || 0,
  }));

  // Merge Web Orders, Salesperson NVV, and raw ERP NVV
  const rawErpNvv = (erpData?.nvv || []).map((row: any) => ({
    ...row,
    cantidadPendiente: Number(row.CAPRCO2) || 0,
    totalPendiente: Number(row.VABRDO) || Number(row.PPPRNE) * Number(row.CAPRCO2) || 0,
    NOKOPR: row.NOKOPR || 'Producto ERP'
  }));
  const allPendingOrders = [...pendingWebOrders, ...nvvSalespersonData, ...rawErpNvv];

  // GDV
  const { data: gdvSalespersonData = [], isLoading: gdvLoading } = useQuery<GDVRecord[]>({
    queryKey: ["/api/gdv/by-salesperson", salesperson],
    queryFn: async () => {
      const params = new URLSearchParams({ salesperson });
      const res = await fetch(`/api/gdv/by-salesperson?${params}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!salesperson,
  });
  
  const allGdv = [...gdvSalespersonData, ...(erpData?.gdv || [])];

  // Facturas
  const { data: transactionsSalesperson = [], isLoading: txLoading } = useQuery<any[]>({
    queryKey: ["/api/sales/transactions", salesperson, "pedidos-client"],
    queryFn: async () => {
      const now = new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
      const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];
      const params = new URLSearchParams({ salesperson, startDate, endDate, limit: "200" });
      const res = await fetch(`/api/sales/transactions?${params}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!salesperson,
  });

  const allTransactions = [...transactionsSalesperson, ...(erpData?.transactions || [])];

  const tabs = [
    { key: "nvv" as const, label: "Ingresados", icon: ShoppingCart, count: allPendingOrders.length, color: "amber" },
    { key: "gdv" as const, label: "En Despacho", icon: Truck, count: allGdv.length, color: "purple" },
    { key: "facturas" as const, label: "Facturados", icon: FileCheck, count: allTransactions.length, color: "green" },
  ];

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="flex gap-2 p-1 bg-gray-100 rounded-xl">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setSubTab(t.key)}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              subTab === t.key
                ? "bg-white shadow-sm text-gray-900"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <t.icon className="h-4 w-4" />
            <span className="hidden sm:inline">{t.label}</span>
            {t.count > 0 && (
              <Badge className={`text-[10px] px-1.5 py-0 ${
                subTab === t.key ? `bg-${t.color}-100 text-${t.color}-700` : 'bg-gray-200 text-gray-500'
              }`}>
                {t.count}
              </Badge>
            )}
          </button>
        ))}
      </div>

      {/* NVV & Web Content */}
      {subTab === "nvv" && (
        <NVVContent records={allPendingOrders} isLoading={nvvLoading || webLoading} />
      )}

      {/* GDV Content */}
      {subTab === "gdv" && (
        <GDVContent records={allGdv} isLoading={gdvLoading} />
      )}

      {/* Facturas Content */}
      {subTab === "facturas" && (
        <FacturasContent records={allTransactions} isLoading={txLoading} />
      )}
    </div>
  );
}

function NVVContent({ records, isLoading }: { records: NVVRecord[]; isLoading: boolean }) {
  const totalAmount = records.reduce((s, r) => s + r.totalPendiente, 0);
  const totalUnits = records.reduce((s, r) => s + r.cantidadPendiente, 0);

  if (isLoading) return <div className="h-48 bg-gray-100 rounded-xl animate-pulse" />;
  if (records.length === 0) return (
    <div className="text-center py-12">
      <Package className="h-12 w-12 text-gray-300 mx-auto mb-3" />
      <p className="text-sm text-gray-500">No hay notas de venta pendientes</p>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
          <div className="flex items-center gap-2 text-amber-600 mb-1">
            <DollarSign className="h-4 w-4" />
            <span className="text-xs font-medium">Monto Pendiente</span>
          </div>
          <p className="text-lg font-bold text-amber-700">{formatCurrency(totalAmount)}</p>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-3">
          <div className="flex items-center gap-2 text-purple-600 mb-1">
            <Package className="h-4 w-4" />
            <span className="text-xs font-medium">Unidades</span>
          </div>
          <p className="text-lg font-bold text-purple-700">{totalUnits.toLocaleString("es-CL")}</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
          <div className="flex items-center gap-2 text-blue-600 mb-1">
            <ShoppingCart className="h-4 w-4" />
            <span className="text-xs font-medium">Pedidos</span>
          </div>
          <p className="text-lg font-bold text-blue-700">{records.length}</p>
        </div>
      </div>
      <div className="overflow-x-auto border rounded-xl">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Doc</TableHead>
              <TableHead className="text-xs">Fecha</TableHead>
              <TableHead className="text-xs">Producto</TableHead>
              <TableHead className="text-xs text-right">Cant.</TableHead>
              <TableHead className="text-xs text-right">Monto</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="text-xs font-medium">
                  <div>{r.NUDO}</div>
                  <div className="text-[10px] text-gray-400">{r.TIDO}</div>
                </TableCell>
                <TableCell className="text-xs">{formatDate(r.FEEMDO)}</TableCell>
                <TableCell className="text-xs max-w-[200px] truncate" title={r.NOKOPR}>{r.NOKOPR}</TableCell>
                <TableCell className="text-xs text-right">
                  <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px]">
                    {r.cantidadPendiente.toLocaleString("es-CL")}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-right font-semibold text-amber-600">
                  {formatCurrency(r.totalPendiente)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function GDVContent({ records, isLoading }: { records: GDVRecord[]; isLoading: boolean }) {
  const totalAmount = records.reduce((s, r) => s + (r.monto || 0), 0);
  const totalUnits = records.reduce((s, r) => s + (r.cantidad || 0), 0);

  if (isLoading) return <div className="h-48 bg-gray-100 rounded-xl animate-pulse" />;
  if (records.length === 0) return (
    <div className="text-center py-12">
      <Truck className="h-12 w-12 text-gray-300 mx-auto mb-3" />
      <p className="text-sm text-gray-500">No hay guías de despacho pendientes</p>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-3">
          <div className="flex items-center gap-2 text-purple-600 mb-1">
            <DollarSign className="h-4 w-4" />
            <span className="text-xs font-medium">Monto en Despacho</span>
          </div>
          <p className="text-lg font-bold text-purple-700">{formatCurrency(totalAmount)}</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
          <div className="flex items-center gap-2 text-blue-600 mb-1">
            <Package className="h-4 w-4" />
            <span className="text-xs font-medium">Unidades</span>
          </div>
          <p className="text-lg font-bold text-blue-700">{totalUnits.toLocaleString("es-CL")}</p>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-3">
          <div className="flex items-center gap-2 text-orange-600 mb-1">
            <Truck className="h-4 w-4" />
            <span className="text-xs font-medium">Líneas</span>
          </div>
          <p className="text-lg font-bold text-orange-700">{records.length}</p>
        </div>
      </div>
      <div className="overflow-x-auto border rounded-xl">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Guía</TableHead>
              <TableHead className="text-xs">Fecha</TableHead>
              <TableHead className="text-xs">Producto</TableHead>
              <TableHead className="text-xs text-right">Cant.</TableHead>
              <TableHead className="text-xs text-right">Monto</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.map((r, idx) => (
              <TableRow key={`${r.numeroGuia}-${idx}`}>
                <TableCell className="text-xs font-medium">{r.numeroGuia}</TableCell>
                <TableCell className="text-xs">{formatDate(r.fecha)}</TableCell>
                <TableCell className="text-xs max-w-[200px] truncate" title={r.producto}>{r.producto}</TableCell>
                <TableCell className="text-xs text-right">{r.cantidad.toLocaleString("es-CL")}</TableCell>
                <TableCell className="text-xs text-right font-medium text-purple-600">
                  {formatCurrency(r.monto)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function FacturasContent({ records, isLoading }: { records: any[]; isLoading: boolean }) {
  const totalAmount = records.reduce((s: number, t: any) => s + (Number(t.amount) || 0), 0);

  if (isLoading) return <div className="h-48 bg-gray-100 rounded-xl animate-pulse" />;
  if (records.length === 0) return (
    <div className="text-center py-12">
      <FileCheck className="h-12 w-12 text-gray-300 mx-auto mb-3" />
      <p className="text-sm text-gray-500">No hay facturas en el mes actual</p>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-green-50 border border-green-200 rounded-xl p-3">
          <div className="flex items-center gap-2 text-green-600 mb-1">
            <DollarSign className="h-4 w-4" />
            <span className="text-xs font-medium">Monto Facturado</span>
          </div>
          <p className="text-lg font-bold text-green-700">{formatCurrency(totalAmount)}</p>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
          <div className="flex items-center gap-2 text-emerald-600 mb-1">
            <FileCheck className="h-4 w-4" />
            <span className="text-xs font-medium">Documentos</span>
          </div>
          <p className="text-lg font-bold text-emerald-700">{records.length}</p>
        </div>
      </div>
      <div className="overflow-x-auto border rounded-xl">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Doc</TableHead>
              <TableHead className="text-xs">Tipo</TableHead>
              <TableHead className="text-xs">Fecha</TableHead>
              <TableHead className="text-xs">Producto</TableHead>
              <TableHead className="text-xs text-right">Monto</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.map((r: any, idx: number) => (
              <TableRow key={`${r.documentNumber || r.nudo || idx}`}>
                <TableCell className="text-xs font-medium">{r.documentNumber || r.nudo || "-"}</TableCell>
                <TableCell className="text-xs">
                  <Badge variant={r.docType === "FCV" ? "default" : "secondary"} className="text-[10px]">
                    {r.docType || "FCV"}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs">{formatDate(r.date || r.fecha || "")}</TableCell>
                <TableCell className="text-xs max-w-[200px] truncate" title={r.productName || r.nokopr || ""}>
                  {r.productName || r.nokopr || "-"}
                </TableCell>
                <TableCell className="text-xs text-right font-medium text-green-600">
                  {formatCurrency(Number(r.amount) || 0)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ==========================================
// Main Portal Component
// ==========================================

export default function ClientPortal() {
  const { user } = useAuth();
  const salespersonName = (user as any)?.salespersonName || "";

  const getInitialTab = () => {
    const path = typeof window !== 'undefined' ? window.location.pathname : '';
    if (path === '/mis-pedidos') return 'pedidos';
    const tab = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('tab') : null;
    if (tab === 'pedidos') return 'pedidos';
    return 'dashboard';
  };
  const [activeTab] = useState<"dashboard" | "pedidos">(getInitialTab() as any);

  return (
    <div className="space-y-4">
      {/* Content — tabs are already in the header via ClientEcommerceLayout */}
      <div className="min-h-[500px]">
        {activeTab === "dashboard" && (
          <DashboardTab salesperson={salespersonName} />
        )}
        {activeTab === "pedidos" && (
          <PedidosTab salesperson={salespersonName} />
        )}
      </div>
    </div>
  );
}

