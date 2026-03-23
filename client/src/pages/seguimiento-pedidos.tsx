import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  FileText,
  ShoppingCart,
  Truck,
  FileCheck,
  DollarSign,
  Package,
  User,
  Search,
  PackageSearch,
  Clock,
  CheckCircle,
  XCircle,
  Send,
  ArrowRight,
  Loader2,
} from "lucide-react";

// ==============================
// Types
// ==============================

interface Quote {
  id: string;
  quoteNumber: string;
  clientName: string;
  clientRut?: string;
  status: "draft" | "sent" | "accepted" | "rejected" | "converted";
  total: string;
  createdAt: string;
  creatorName?: string;
}

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

// ==============================
// Helpers
// ==============================

const formatCurrency = (value: number | string) => {
  const num = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
};

const formatDate = (dateStr: string) => {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  return date.toLocaleDateString("es-CL", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const getTimeAgo = (dateString: string) => {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const days = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor(diffInMs / (1000 * 60 * 60));
    const minutes = Math.floor(diffInMs / (1000 * 60));

    if (days > 0) return `hace ${days}d`;
    if (hours > 0) return `hace ${hours}h`;
    if (minutes > 0) return `hace ${minutes}m`;
    return "ahora";
  } catch {
    return "";
  }
};

// ==============================
// Stage Config
// ==============================

const STAGES = [
  {
    key: "cotizacion",
    label: "Cotizaciones",
    icon: FileText,
    color: "blue",
    bgGradient: "from-blue-500 to-blue-600",
    bgLight: "bg-blue-50 dark:bg-blue-900/20",
    borderColor: "border-blue-200 dark:border-blue-800",
    textColor: "text-blue-600 dark:text-blue-400",
    badgeColor: "bg-blue-100 text-blue-700",
  },
  {
    key: "ingresado",
    label: "Ingresados (NVV)",
    icon: ShoppingCart,
    color: "amber",
    bgGradient: "from-amber-500 to-orange-600",
    bgLight: "bg-amber-50 dark:bg-amber-900/20",
    borderColor: "border-amber-200 dark:border-amber-800",
    textColor: "text-amber-600 dark:text-amber-400",
    badgeColor: "bg-amber-100 text-amber-700",
  },
  {
    key: "despacho",
    label: "En Despacho (GDV)",
    icon: Truck,
    color: "purple",
    bgGradient: "from-purple-500 to-violet-600",
    bgLight: "bg-purple-50 dark:bg-purple-900/20",
    borderColor: "border-purple-200 dark:border-purple-800",
    textColor: "text-purple-600 dark:text-purple-400",
    badgeColor: "bg-purple-100 text-purple-700",
  },
  {
    key: "facturado",
    label: "Facturado",
    icon: FileCheck,
    color: "green",
    bgGradient: "from-green-500 to-emerald-600",
    bgLight: "bg-green-50 dark:bg-green-900/20",
    borderColor: "border-green-200 dark:border-green-800",
    textColor: "text-green-600 dark:text-green-400",
    badgeColor: "bg-green-100 text-green-700",
  },
] as const;

const quoteStatusMap: Record<string, { label: string; icon: any; color: string }> = {
  draft: { label: "Borrador", icon: FileText, color: "bg-gray-100 text-gray-700" },
  sent: { label: "Enviada", icon: Send, color: "bg-blue-100 text-blue-700" },
  accepted: { label: "Aceptada", icon: CheckCircle, color: "bg-green-100 text-green-700" },
  rejected: { label: "Rechazada", icon: XCircle, color: "bg-red-100 text-red-700" },
  converted: { label: "Convertida", icon: Package, color: "bg-purple-100 text-purple-700" },
};

// ==============================
// Main Page
// ==============================

export default function SeguimientoPedidos() {
  const { user } = useAuth();
  const salespersonName = (user as any)?.salespersonName || "";
  const isAdmin = user?.role === "admin" || user?.role === "supervisor";
  const [activeStage, setActiveStage] = useState<string>("cotizacion");
  const [searchTerm, setSearchTerm] = useState("");

  // Quotes data
  const { data: quotes = [], isLoading: quotesLoading } = useQuery<Quote[]>({
    queryKey: ["/api/quotes?limit=200&offset=0"],
  });

  // NVV data
  const { data: nvvData = [], isLoading: nvvLoading } = useQuery<NVVRecord[]>({
    queryKey: ["/api/nvv/by-salesperson", salespersonName, "all", "all"],
    queryFn: async () => {
      if (!salespersonName && !isAdmin) return [];
      const params = new URLSearchParams();
      if (salespersonName) params.append("salesperson", salespersonName);
      const response = await fetch(`/api/nvv/by-salesperson?${params}`, {
        credentials: "include",
      });
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!salespersonName || isAdmin,
  });

  // GDV data
  const { data: gdvData = [], isLoading: gdvLoading } = useQuery<GDVRecord[]>({
    queryKey: ["/api/gdv/by-salesperson", salespersonName],
    queryFn: async () => {
      if (!salespersonName && !isAdmin) return [];
      const params = new URLSearchParams();
      if (salespersonName) params.append("salesperson", salespersonName);
      const response = await fetch(`/api/gdv/by-salesperson?${params}`, {
        credentials: "include",
      });
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!salespersonName || isAdmin,
  });

  // Facturas data (current month)
  const { data: facturas = [], isLoading: facturasLoading } = useQuery<any[]>({
    queryKey: ["/api/sales/transactions", salespersonName, "seguimiento"],
    queryFn: async () => {
      if (!salespersonName && !isAdmin) return [];
      const now = new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
      const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];
      const params = new URLSearchParams({
        startDate,
        endDate,
        limit: "200",
      });
      if (salespersonName) params.append("salesperson", salespersonName);
      const response = await fetch(`/api/sales/transactions?${params}`, {
        credentials: "include",
      });
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!salespersonName || isAdmin,
  });

  // Compute totals for each stage
  const stageCounts = {
    cotizacion: quotes.length,
    ingresado: nvvData.length,
    despacho: gdvData.length,
    facturado: facturas.length,
  };

  const stageTotals = {
    cotizacion: quotes.reduce((s, q) => s + parseFloat(q.total || "0"), 0),
    ingresado: nvvData.reduce((s, r) => s + (r.totalPendiente || 0), 0),
    despacho: gdvData.reduce((s, r) => s + (r.monto || 0), 0),
    facturado: facturas.reduce((s, r) => s + (Number(r.amount) || 0), 0),
  };

  // Filter helpers
  const filteredQuotes = quotes.filter(
    (q) =>
      !searchTerm ||
      q.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      q.quoteNumber?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredNVV = nvvData.filter(
    (r) =>
      !searchTerm ||
      r.NOKOEN?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.NOKOPR?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.NUDO?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredGDV = gdvData.filter(
    (r) =>
      !searchTerm ||
      r.cliente?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.producto?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.numeroGuia?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredFacturas = facturas.filter(
    (r) =>
      !searchTerm ||
      (r.clientName || r.nokoen || "")?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.productName || r.nokopr || "")?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.documentNumber || r.nudo || "")?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const isLoading = quotesLoading || nvvLoading || gdvLoading || facturasLoading;

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg shadow-indigo-500/20">
          <PackageSearch className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
            Seguimiento de Pedidos
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Sigue el estado de tus pedidos desde la cotización hasta la entrega
          </p>
        </div>
      </div>

      {/* Pipeline cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {STAGES.map((stage, idx) => {
          const Icon = stage.icon;
          const count = stageCounts[stage.key as keyof typeof stageCounts];
          const total = stageTotals[stage.key as keyof typeof stageTotals];
          const isActive = activeStage === stage.key;

          return (
            <button
              key={stage.key}
              onClick={() => setActiveStage(stage.key)}
              className={`relative p-4 rounded-2xl border-2 transition-all duration-200 text-left group
                ${isActive
                  ? `${stage.borderColor} ${stage.bgLight} ring-2 ring-offset-1 ring-${stage.color}-400/30 scale-[1.02]`
                  : "border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-gray-200 hover:shadow-md"
                }`}
              data-testid={`stage-${stage.key}`}
            >
              {/* Active indicator dot */}
              {isActive && (
                <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-current animate-pulse" style={{ color: `var(--${stage.color}-500, #6366f1)` }} />
              )}

              <div className="flex items-center gap-2 mb-2">
                <div className={`p-1.5 rounded-lg bg-gradient-to-br ${stage.bgGradient} shadow-sm`}>
                  <Icon className="h-3.5 w-3.5 text-white" />
                </div>
                <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 truncate">
                  {stage.label}
                </span>
              </div>

              <div className="flex items-end justify-between">
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{count}</p>
                  <p className="text-[10px] text-gray-400 font-medium">documentos</p>
                </div>
                <p className={`text-xs font-bold ${stage.textColor}`}>
                  {formatCurrency(total)}
                </p>
              </div>

              {/* Arrow connector (hidden on last) */}
              {idx < STAGES.length - 1 && (
                <ArrowRight className="hidden lg:block absolute -right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300 z-10" />
              )}
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Buscar por cliente, producto o documento..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 h-10 rounded-xl border-gray-200 focus:border-indigo-400"
          data-testid="input-search-seguimiento"
        />
      </div>

      {/* Stage content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
        </div>
      ) : (
        <Card className="rounded-2xl border-gray-100 shadow-sm">
          <CardContent className="p-0">
            {activeStage === "cotizacion" && (
              <CotizacionesTable quotes={filteredQuotes} isAdmin={isAdmin} />
            )}
            {activeStage === "ingresado" && (
              <NVVTable records={filteredNVV} />
            )}
            {activeStage === "despacho" && (
              <GDVTable records={filteredGDV} />
            )}
            {activeStage === "facturado" && (
              <FacturasTable records={filteredFacturas} />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ==============================
// Cotizaciones Table
// ==============================

function CotizacionesTable({ quotes, isAdmin }: { quotes: Quote[]; isAdmin: boolean }) {
  const [showAll, setShowAll] = useState(false);
  const displayed = showAll ? quotes : quotes.slice(0, 15);

  if (quotes.length === 0) {
    return (
      <div className="text-center py-12">
        <FileText className="h-10 w-10 text-gray-300 mx-auto mb-3" />
        <p className="text-sm text-gray-500">No hay cotizaciones</p>
      </div>
    );
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">N° Cotización</TableHead>
              <TableHead className="text-xs">Cliente</TableHead>
              <TableHead className="text-xs">Estado</TableHead>
              {isAdmin && <TableHead className="text-xs">Creado por</TableHead>}
              <TableHead className="text-xs">Fecha</TableHead>
              <TableHead className="text-xs text-right">Monto</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayed.map((q) => {
              const status = quoteStatusMap[q.status] || quoteStatusMap.draft;
              const StatusIcon = status.icon;
              return (
                <TableRow key={q.id} className="hover:bg-gray-50/50">
                  <TableCell className="text-xs font-medium text-gray-900">
                    #{q.quoteNumber}
                  </TableCell>
                  <TableCell className="text-xs">
                    <div className="font-medium text-gray-900">{q.clientName}</div>
                    {q.clientRut && (
                      <div className="text-[10px] text-gray-400">RUT: {q.clientRut}</div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge className={`${status.color} text-[10px] gap-1`}>
                      <StatusIcon className="w-3 h-3" />
                      {status.label}
                    </Badge>
                  </TableCell>
                  {isAdmin && (
                    <TableCell className="text-xs text-gray-600">
                      {q.creatorName || "—"}
                    </TableCell>
                  )}
                  <TableCell className="text-xs">
                    <div>{formatDate(q.createdAt)}</div>
                    <div className="text-[10px] text-gray-400">{getTimeAgo(q.createdAt)}</div>
                  </TableCell>
                  <TableCell className="text-xs text-right font-bold text-blue-600">
                    {formatCurrency(q.total)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      {quotes.length > 15 && (
        <div className="p-3 border-t">
          <Button variant="outline" size="sm" className="w-full" onClick={() => setShowAll(!showAll)}>
            {showAll ? "Ver menos" : `Ver todas (${quotes.length - 15} más)`}
          </Button>
        </div>
      )}
    </div>
  );
}

// ==============================
// NVV Table
// ==============================

function NVVTable({ records }: { records: NVVRecord[] }) {
  const [showAll, setShowAll] = useState(false);
  const displayed = showAll ? records : records.slice(0, 20);

  if (records.length === 0) {
    return (
      <div className="text-center py-12">
        <ShoppingCart className="h-10 w-10 text-gray-300 mx-auto mb-3" />
        <p className="text-sm text-gray-500">No hay notas de venta pendientes</p>
      </div>
    );
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Documento</TableHead>
              <TableHead className="text-xs">Fecha</TableHead>
              <TableHead className="text-xs">Cliente</TableHead>
              <TableHead className="text-xs">Producto</TableHead>
              <TableHead className="text-xs text-right">Cant. Pend.</TableHead>
              <TableHead className="text-xs text-right">Monto</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayed.map((r) => (
              <TableRow key={r.id} className="hover:bg-gray-50/50">
                <TableCell className="text-xs">
                  <div className="font-medium">{r.NUDO}</div>
                  <div className="text-[10px] text-gray-400">{r.TIDO}</div>
                </TableCell>
                <TableCell className="text-xs">{formatDate(r.FEEMDO)}</TableCell>
                <TableCell className="text-xs font-medium max-w-[150px] truncate" title={r.NOKOEN}>
                  {r.NOKOEN}
                </TableCell>
                <TableCell className="text-xs max-w-[200px] truncate" title={r.NOKOPR}>
                  {r.NOKOPR}
                </TableCell>
                <TableCell className="text-xs text-right">
                  <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px]">
                    {r.cantidadPendiente?.toLocaleString("es-CL")}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-right font-bold text-amber-600">
                  {formatCurrency(r.totalPendiente)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {records.length > 20 && (
        <div className="p-3 border-t">
          <Button variant="outline" size="sm" className="w-full" onClick={() => setShowAll(!showAll)}>
            {showAll ? "Ver menos" : `Ver todos (${records.length - 20} más)`}
          </Button>
        </div>
      )}
    </div>
  );
}

// ==============================
// GDV Table
// ==============================

function GDVTable({ records }: { records: GDVRecord[] }) {
  const [showAll, setShowAll] = useState(false);
  const displayed = showAll ? records : records.slice(0, 20);

  if (records.length === 0) {
    return (
      <div className="text-center py-12">
        <Truck className="h-10 w-10 text-gray-300 mx-auto mb-3" />
        <p className="text-sm text-gray-500">No hay guías de despacho pendientes</p>
      </div>
    );
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Guía</TableHead>
              <TableHead className="text-xs">Fecha</TableHead>
              <TableHead className="text-xs">Cliente</TableHead>
              <TableHead className="text-xs">Producto</TableHead>
              <TableHead className="text-xs text-right">Cant.</TableHead>
              <TableHead className="text-xs text-right">Monto</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayed.map((r, idx) => (
              <TableRow key={`${r.numeroGuia}-${idx}`} className="hover:bg-gray-50/50">
                <TableCell className="text-xs font-medium">{r.numeroGuia}</TableCell>
                <TableCell className="text-xs">{formatDate(r.fecha)}</TableCell>
                <TableCell className="text-xs font-medium max-w-[150px] truncate" title={r.cliente}>
                  {r.cliente}
                </TableCell>
                <TableCell className="text-xs max-w-[200px] truncate" title={r.producto}>
                  {r.producto}
                </TableCell>
                <TableCell className="text-xs text-right">
                  {r.cantidad?.toLocaleString("es-CL")}
                </TableCell>
                <TableCell className="text-xs text-right font-bold text-purple-600">
                  {formatCurrency(r.monto)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {records.length > 20 && (
        <div className="p-3 border-t">
          <Button variant="outline" size="sm" className="w-full" onClick={() => setShowAll(!showAll)}>
            {showAll ? "Ver menos" : `Ver todos (${records.length - 20} más)`}
          </Button>
        </div>
      )}
    </div>
  );
}

// ==============================
// Facturas Table
// ==============================

function FacturasTable({ records }: { records: any[] }) {
  const [showAll, setShowAll] = useState(false);
  const displayed = showAll ? records : records.slice(0, 20);

  if (records.length === 0) {
    return (
      <div className="text-center py-12">
        <FileCheck className="h-10 w-10 text-gray-300 mx-auto mb-3" />
        <p className="text-sm text-gray-500">No hay facturas en el mes actual</p>
      </div>
    );
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Documento</TableHead>
              <TableHead className="text-xs">Tipo</TableHead>
              <TableHead className="text-xs">Fecha</TableHead>
              <TableHead className="text-xs">Cliente</TableHead>
              <TableHead className="text-xs">Producto</TableHead>
              <TableHead className="text-xs text-right">Monto</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayed.map((r, idx) => (
              <TableRow key={`${r.documentNumber || r.nudo || idx}`} className="hover:bg-gray-50/50">
                <TableCell className="text-xs font-medium">
                  {r.documentNumber || r.nudo || "—"}
                </TableCell>
                <TableCell className="text-xs">
                  <Badge variant={r.docType === "FCV" ? "default" : "secondary"} className="text-[10px]">
                    {r.docType || "FCV"}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs">{formatDate(r.date || r.fecha || "")}</TableCell>
                <TableCell className="text-xs font-medium max-w-[150px] truncate" title={r.clientName || r.nokoen || ""}>
                  {r.clientName || r.nokoen || "—"}
                </TableCell>
                <TableCell className="text-xs max-w-[200px] truncate" title={r.productName || r.nokopr || ""}>
                  {r.productName || r.nokopr || "—"}
                </TableCell>
                <TableCell className="text-xs text-right font-bold text-green-600">
                  {formatCurrency(Number(r.amount) || 0)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {records.length > 20 && (
        <div className="p-3 border-t">
          <Button variant="outline" size="sm" className="w-full" onClick={() => setShowAll(!showAll)}>
            {showAll ? "Ver menos" : `Ver todos (${records.length - 20} más)`}
          </Button>
        </div>
      )}
    </div>
  );
}
