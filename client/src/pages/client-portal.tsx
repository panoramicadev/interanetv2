import { useState, useEffect } from "react";
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
  // Fetch NVV (pending orders)
  const { data: nvvData = [], isLoading: nvvLoading } = useQuery<NVVRecord[]>({
    queryKey: ["/api/nvv/by-salesperson", salesperson, "all", "all"],
    queryFn: async () => {
      const params = new URLSearchParams({ salesperson });
      const res = await fetch(`/api/nvv/by-salesperson?${params}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!salesperson,
  });

  // Fetch GDV (dispatch)
  const { data: gdvData = [], isLoading: gdvLoading } = useQuery<GDVRecord[]>({
    queryKey: ["/api/gdv/by-salesperson", salesperson],
    queryFn: async () => {
      const params = new URLSearchParams({ salesperson });
      const res = await fetch(`/api/gdv/by-salesperson?${params}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!salesperson,
  });

  // Fetch recent transactions (invoices)
  const { data: transactions = [], isLoading: txLoading } = useQuery<any[]>({
    queryKey: ["/api/sales/transactions", salesperson, "dashboard-client"],
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

  const isLoading = nvvLoading || gdvLoading || txLoading;

  const totalNVV = nvvData.reduce((s, r) => s + r.totalPendiente, 0);
  const totalDocsNVV = nvvData.length;
  const totalGDV = gdvData.reduce((s, r) => s + (r.monto || 0), 0);
  const totalDocsGDV = gdvData.length;
  const totalFacturado = transactions.reduce((s: number, t: any) => s + (Number(t.amount) || 0), 0);
  const totalDocsFact = transactions.length;

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
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-6 text-white">
        <h2 className="text-xl font-bold">Bienvenido a tu Panel</h2>
        <p className="text-blue-100 text-sm mt-1">
          Aquí puedes ver el resumen de tus pedidos y actividad con Panorámica.
        </p>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-amber-50 to-amber-100/50">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 rounded-xl bg-amber-500/10">
                <ShoppingCart className="h-5 w-5 text-amber-600" />
              </div>
              <Badge className="bg-amber-100 text-amber-700 text-[10px] border-0">NVV</Badge>
            </div>
            <p className="text-2xl font-bold text-amber-900">{formatCurrency(totalNVV)}</p>
            <p className="text-xs text-amber-600 mt-1">{totalDocsNVV} pedido{totalDocsNVV !== 1 ? 's' : ''} pendiente{totalDocsNVV !== 1 ? 's' : ''}</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-purple-50 to-purple-100/50">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 rounded-xl bg-purple-500/10">
                <Truck className="h-5 w-5 text-purple-600" />
              </div>
              <Badge className="bg-purple-100 text-purple-700 text-[10px] border-0">GDV</Badge>
            </div>
            <p className="text-2xl font-bold text-purple-900">{formatCurrency(totalGDV)}</p>
            <p className="text-xs text-purple-600 mt-1">{totalDocsGDV} guía{totalDocsGDV !== 1 ? 's' : ''} en despacho</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-green-50 to-emerald-100/50">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 rounded-xl bg-green-500/10">
                <FileCheck className="h-5 w-5 text-green-600" />
              </div>
              <Badge className="bg-green-100 text-green-700 text-[10px] border-0">Mes</Badge>
            </div>
            <p className="text-2xl font-bold text-green-900">{formatCurrency(totalFacturado)}</p>
            <p className="text-xs text-green-600 mt-1">{totalDocsFact} factura{totalDocsFact !== 1 ? 's' : ''} este mes</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-blue-50 to-blue-100/50">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 rounded-xl bg-blue-500/10">
                <BarChart3 className="h-5 w-5 text-blue-600" />
              </div>
              <Badge className="bg-blue-100 text-blue-700 text-[10px] border-0">Total</Badge>
            </div>
            <p className="text-2xl font-bold text-blue-900">{formatCurrency(totalNVV + totalGDV + totalFacturado)}</p>
            <p className="text-xs text-blue-600 mt-1">Actividad total del período</p>
          </CardContent>
        </Card>
      </div>

      {/* Last NVV orders quick view */}
      {nvvData.length > 0 && (
        <Card className="rounded-2xl border-0 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-amber-500" />
                Últimos Pedidos Ingresados
              </CardTitle>
              <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50 text-[10px]">
                NVV
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {nvvData.slice(0, 5).map((r) => (
                <div key={r.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">{r.NOKOPR}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-gray-500 font-mono">{r.NUDO}</span>
                      <span className="text-[10px] text-gray-400">·</span>
                      <span className="text-[10px] text-gray-500">{formatDate(r.FEEMDO)}</span>
                    </div>
                  </div>
                  <div className="text-right ml-4">
                    <p className="text-sm font-bold text-amber-600">{formatCurrency(r.totalPendiente)}</p>
                    <p className="text-[10px] text-gray-400">{r.cantidadPendiente} uds</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
            <p className="text-sm font-semibold text-gray-900">Ver Pedidos</p>
            <p className="text-[10px] text-gray-500">Seguimiento completo</p>
          </div>
          <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-blue-400 transition-colors" />
        </a>
        <a href="/panoramica-market-cliente" className="flex items-center gap-3 p-4 rounded-2xl bg-white border border-gray-100 hover:border-emerald-200 hover:shadow-md transition-all group">
          <div className="p-2.5 rounded-xl bg-emerald-50 group-hover:bg-emerald-100 transition-colors">
            <Gift className="h-5 w-5 text-emerald-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900">Panorámica Market</p>
            <p className="text-[10px] text-gray-500">Beneficios y programa</p>
          </div>
          <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-emerald-400 transition-colors" />
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

  // NVV
  const { data: nvvData = [], isLoading: nvvLoading } = useQuery<NVVRecord[]>({
    queryKey: ["/api/nvv/by-salesperson", salesperson, "all", "all"],
    queryFn: async () => {
      const params = new URLSearchParams({ salesperson });
      const res = await fetch(`/api/nvv/by-salesperson?${params}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!salesperson,
  });

  // GDV
  const { data: gdvData = [], isLoading: gdvLoading } = useQuery<GDVRecord[]>({
    queryKey: ["/api/gdv/by-salesperson", salesperson],
    queryFn: async () => {
      const params = new URLSearchParams({ salesperson });
      const res = await fetch(`/api/gdv/by-salesperson?${params}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!salesperson,
  });

  // Facturas
  const { data: transactions = [], isLoading: txLoading } = useQuery<any[]>({
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

  const tabs = [
    { key: "nvv" as const, label: "Ingresados", icon: ShoppingCart, count: nvvData.length, color: "amber" },
    { key: "gdv" as const, label: "En Despacho", icon: Truck, count: gdvData.length, color: "purple" },
    { key: "facturas" as const, label: "Facturados", icon: FileCheck, count: transactions.length, color: "green" },
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

      {/* NVV Content */}
      {subTab === "nvv" && (
        <NVVContent records={nvvData} isLoading={nvvLoading} />
      )}

      {/* GDV Content */}
      {subTab === "gdv" && (
        <GDVContent records={gdvData} isLoading={gdvLoading} />
      )}

      {/* Facturas Content */}
      {subTab === "facturas" && (
        <FacturasContent records={transactions} isLoading={txLoading} />
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
// Panorámica Market Tab
// ==========================================

function PanoramicaMarketTab() {
  const tiers = [
    {
      name: "Bronce",
      icon: Award,
      color: "from-amber-700 to-amber-900",
      textColor: "text-amber-800",
      bgColor: "bg-amber-50",
      borderColor: "border-amber-200",
      min: "$0",
      max: "$5.000.000",
      benefits: [
        "Acceso al catálogo completo",
        "Atención preferente por email",
        "Descuento base en productos seleccionados",
      ],
    },
    {
      name: "Plata",
      icon: Star,
      color: "from-gray-400 to-gray-600",
      textColor: "text-gray-700",
      bgColor: "bg-gray-50",
      borderColor: "border-gray-200",
      min: "$5.000.000",
      max: "$15.000.000",
      benefits: [
        "Todo lo de Bronce",
        "Despacho prioritario",
        "Asesoría técnica personalizada",
        "Acceso a promociones exclusivas",
      ],
    },
    {
      name: "Oro",
      icon: Crown,
      color: "from-yellow-500 to-amber-500",
      textColor: "text-yellow-700",
      bgColor: "bg-yellow-50",
      borderColor: "border-yellow-200",
      min: "$15.000.000",
      max: "$30.000.000",
      benefits: [
        "Todo lo de Plata",
        "Ejecutivo comercial dedicado",
        "Descuentos por volumen superiores",
        "Capacitaciones técnicas gratuitas",
        "Invitación a eventos exclusivos",
      ],
    },
    {
      name: "Diamante",
      icon: Gift,
      color: "from-blue-500 to-indigo-600",
      textColor: "text-blue-700",
      bgColor: "bg-blue-50",
      borderColor: "border-blue-200",
      min: "$30.000.000+",
      max: "",
      benefits: [
        "Todo lo de Oro",
        "Precios preferenciales en todo el catálogo",
        "Línea de crédito ampliada",
        "Soporte técnico 24/7",
        "Visitas a planta y laboratorio",
        "Co-marketing y apoyo publicitario",
      ],
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 rounded-2xl p-6 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-20 -mt-20" />
        <div className="relative">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-white/20 rounded-xl">
              <Gift className="h-6 w-6" />
            </div>
            <h2 className="text-xl font-bold">Panorámica Market</h2>
          </div>
          <p className="text-emerald-100 text-sm max-w-lg">
            Nuestro programa de beneficios te premia por tu fidelidad. Mientras más compras, más beneficios exclusivos obtienes.
          </p>
        </div>
      </div>

      {/* Current status */}
      <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-amber-50 to-amber-100/30 border-amber-200">
        <CardContent className="p-5">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-amber-700 to-amber-900 rounded-xl text-white">
              <Award className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-amber-700 font-medium">Tu nivel actual</p>
              <p className="text-xl font-bold text-amber-900">Bronce</p>
              <p className="text-xs text-amber-600 mt-0.5">
                Contacta a tu ejecutivo para conocer tu progreso al siguiente nivel.
              </p>
            </div>
            <div className="hidden sm:block text-right">
              <p className="text-xs text-amber-600">Siguiente nivel</p>
              <p className="text-sm font-bold text-gray-700">Plata →</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tiers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {tiers.map((tier) => {
          const Icon = tier.icon;
          return (
            <Card key={tier.name} className={`rounded-2xl border shadow-sm ${tier.borderColor} overflow-hidden`}>
              <div className={`bg-gradient-to-r ${tier.color} p-4 text-white`}>
                <div className="flex items-center gap-3">
                  <Icon className="h-6 w-6" />
                  <div>
                    <p className="font-bold text-lg">{tier.name}</p>
                    <p className="text-white/70 text-xs">
                      {tier.max ? `${tier.min} — ${tier.max} anuales` : `${tier.min} anuales`}
                    </p>
                  </div>
                </div>
              </div>
              <CardContent className="p-4">
                <ul className="space-y-2">
                  {tier.benefits.map((b, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                      <ChevronRight className={`h-4 w-4 mt-0.5 flex-shrink-0 ${tier.textColor}`} />
                      {b}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Contact CTA */}
      <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-r from-gray-900 to-gray-800 text-white">
        <CardContent className="p-6 flex items-center justify-between">
          <div>
            <p className="font-bold text-lg">¿Quieres subir de nivel?</p>
            <p className="text-gray-300 text-sm mt-1">
              Contacta a tu ejecutivo comercial para conocer las metas y beneficios disponibles para ti.
            </p>
          </div>
          <a
            href="/tienda"
            className="hidden sm:inline-flex items-center gap-2 bg-[#FF6E23] hover:bg-[#E55E13] text-white font-bold text-sm px-5 py-2.5 rounded-xl transition-all flex-shrink-0"
          >
            <ShoppingCart className="h-4 w-4" />
            Comprar ahora
          </a>
        </CardContent>
      </Card>
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
    if (path === '/panoramica-market-cliente') return 'market';
    const tab = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('tab') : null;
    if (tab === 'pedidos') return 'pedidos';
    if (tab === 'market') return 'market';
    return 'dashboard';
  };
  const [activeTab] = useState<"dashboard" | "pedidos" | "market">(getInitialTab() as any);

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
        {activeTab === "market" && (
          <PanoramicaMarketTab />
        )}
      </div>
    </div>
  );
}

