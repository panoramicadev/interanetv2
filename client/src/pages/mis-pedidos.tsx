import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import {
  ShoppingCart,
  Package,
  Truck,
  FileCheck,
  DollarSign,
  Calendar,
  FileText,
  User,
  ClipboardList
} from "lucide-react";

// ==============================
// Types
// ==============================

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

interface FactRecord {
  nudo: string;
  tido: string;
  fecha: string;
  nokoen: string;
  endo: string;
  nokopr: string;
  cantidad: number;
  monto: number;
}

interface ClientGroup<T> {
  uniqueKey: string;
  clientCode: string;
  clientName: string;
  totalAmount: number;
  totalUnits: number;
  totalDocs: number;
  records: T[];
}

// ==============================
// Helpers
// ==============================

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

// ==============================
// NVV Tab (Ingresados)
// ==============================

function IngresadosTab({ salesperson }: { salesperson: string }) {
  const [showAll, setShowAll] = useState(false);

  const { data: nvvData, isLoading } = useQuery<NVVRecord[]>({
    queryKey: ["/api/nvv/by-salesperson", salesperson, "all", "all"],
    queryFn: async () => {
      const params = new URLSearchParams({ salesperson });
      const response = await fetch(`/api/nvv/by-salesperson?${params}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Error cargando NVV");
      return response.json();
    },
    enabled: !!salesperson,
  });

  const groupedByClient: ClientGroup<NVVRecord>[] = nvvData
    ? Object.values(
        nvvData.reduce((acc, record) => {
          const key = record.ENDO?.trim().toUpperCase() || record.NOKOEN?.trim().toUpperCase() || "SIN_CODIGO";
          if (!acc[key]) {
            acc[key] = {
              uniqueKey: key,
              clientCode: record.ENDO?.trim() || "",
              clientName: record.NOKOEN?.trim() || "Sin nombre",
              totalAmount: 0,
              totalUnits: 0,
              totalDocs: 0,
              records: [],
            };
          }
          acc[key].totalAmount += record.totalPendiente;
          acc[key].totalUnits += record.cantidadPendiente;
          acc[key].totalDocs += 1;
          acc[key].records.push(record);
          return acc;
        }, {} as Record<string, ClientGroup<NVVRecord>>)
      ).sort((a, b) => b.totalAmount - a.totalAmount)
    : [];

  const totalAmount = nvvData?.reduce((s, r) => s + r.totalPendiente, 0) || 0;
  const totalUnits = nvvData?.reduce((s, r) => s + r.cantidadPendiente, 0) || 0;
  const totalDocs = nvvData?.length || 0;

  if (isLoading) {
    return <div className="h-64 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />;
  }

  if (!nvvData || nvvData.length === 0) {
    return (
      <div className="text-center py-12">
        <Package className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
        <p className="text-sm text-gray-500 dark:text-gray-400">No hay notas de venta pendientes</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 mb-1">
            <DollarSign className="h-4 w-4" />
            <span className="text-xs font-medium">Monto Pendiente</span>
          </div>
          <p className="text-lg font-bold text-amber-700 dark:text-amber-300">{formatCurrency(totalAmount)}</p>
        </div>
        <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-3">
          <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 mb-1">
            <Package className="h-4 w-4" />
            <span className="text-xs font-medium">Unidades</span>
          </div>
          <p className="text-lg font-bold text-purple-700 dark:text-purple-300">{totalUnits.toLocaleString("es-CL")}</p>
        </div>
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
          <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-1">
            <ShoppingCart className="h-4 w-4" />
            <span className="text-xs font-medium">Pedidos</span>
          </div>
          <p className="text-lg font-bold text-blue-700 dark:text-blue-300">{totalDocs}</p>
        </div>
      </div>

      {/* Client accordion */}
      <Accordion type="single" collapsible className="space-y-2">
        {(showAll ? groupedByClient : groupedByClient.slice(0, 5)).map((g) => (
          <AccordionItem key={g.uniqueKey} value={g.uniqueKey} className="border rounded-lg overflow-hidden">
            <AccordionTrigger className="px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 hover:no-underline">
              <div className="flex items-center justify-between w-full pr-2">
                <div className="flex items-center gap-2 min-w-0">
                  <User className="h-4 w-4 text-gray-400 shrink-0" />
                  <div className="text-left min-w-0">
                    <p className="font-medium text-sm truncate">{g.clientName}</p>
                    <p className="text-xs text-gray-500">{g.totalDocs} doc{g.totalDocs !== 1 ? "s" : ""}</p>
                  </div>
                </div>
                <div className="flex gap-4 text-right shrink-0">
                  <div>
                    <p className="text-xs text-gray-500">Unidades</p>
                    <p className="text-sm font-semibold text-purple-600">{g.totalUnits.toLocaleString("es-CL")}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Monto</p>
                    <p className="text-sm font-bold text-amber-600">{formatCurrency(g.totalAmount)}</p>
                  </div>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-3 pb-3">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Doc</TableHead>
                      <TableHead className="text-xs">Fecha</TableHead>
                      <TableHead className="text-xs">Producto</TableHead>
                      <TableHead className="text-xs text-right">Cant. Pend.</TableHead>
                      <TableHead className="text-xs text-right">Monto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {g.records.map((r) => (
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
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      {groupedByClient.length > 5 && (
        <Button variant="outline" size="sm" className="w-full" onClick={() => setShowAll(!showAll)}>
          {showAll ? "Ver menos" : `Ver todos (${groupedByClient.length - 5} más)`}
        </Button>
      )}
    </div>
  );
}

// ==============================
// GDV Tab (En Despacho)
// ==============================

function EnDespachoTab({ salesperson }: { salesperson: string }) {
  const [showAll, setShowAll] = useState(false);

  const { data: gdvData, isLoading } = useQuery<GDVRecord[]>({
    queryKey: ["/api/gdv/by-salesperson", salesperson],
    queryFn: async () => {
      const params = new URLSearchParams({ salesperson });
      const response = await fetch(`/api/gdv/by-salesperson?${params}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Error cargando GDV");
      return response.json();
    },
    enabled: !!salesperson,
  });

  const groupedByClient: ClientGroup<GDVRecord>[] = gdvData
    ? Object.values(
        gdvData.reduce((acc, record) => {
          const key = record.codigoCliente?.trim().toUpperCase() || record.cliente?.trim().toUpperCase() || "SIN_CODIGO";
          if (!acc[key]) {
            acc[key] = {
              uniqueKey: key,
              clientCode: record.codigoCliente?.trim() || "",
              clientName: record.cliente?.trim() || "Sin nombre",
              totalAmount: 0,
              totalUnits: 0,
              totalDocs: 0,
              records: [],
            };
          }
          acc[key].totalAmount += record.monto || 0;
          acc[key].totalUnits += record.cantidad || 0;
          acc[key].totalDocs += 1;
          acc[key].records.push(record);
          return acc;
        }, {} as Record<string, ClientGroup<GDVRecord>>)
      ).sort((a, b) => b.totalAmount - a.totalAmount)
    : [];

  const totalAmount = groupedByClient.reduce((s, g) => s + g.totalAmount, 0);
  const totalUnits = groupedByClient.reduce((s, g) => s + g.totalUnits, 0);
  const totalGuias = gdvData?.length || 0;

  if (isLoading) {
    return <div className="h-64 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />;
  }

  if (!gdvData || gdvData.length === 0) {
    return (
      <div className="text-center py-12">
        <Truck className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
        <p className="text-sm text-gray-500 dark:text-gray-400">No hay guías de despacho pendientes</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-3">
          <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 mb-1">
            <DollarSign className="h-4 w-4" />
            <span className="text-xs font-medium">Monto Pendiente</span>
          </div>
          <p className="text-lg font-bold text-purple-700 dark:text-purple-300">{formatCurrency(totalAmount)}</p>
        </div>
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
          <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-1">
            <Package className="h-4 w-4" />
            <span className="text-xs font-medium">Unidades</span>
          </div>
          <p className="text-lg font-bold text-blue-700 dark:text-blue-300">{totalUnits.toLocaleString("es-CL")}</p>
        </div>
        <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-3">
          <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400 mb-1">
            <Truck className="h-4 w-4" />
            <span className="text-xs font-medium">Líneas</span>
          </div>
          <p className="text-lg font-bold text-orange-700 dark:text-orange-300">{totalGuias}</p>
        </div>
      </div>

      {/* Client accordion */}
      <Accordion type="single" collapsible className="space-y-2">
        {(showAll ? groupedByClient : groupedByClient.slice(0, 5)).map((g) => (
          <AccordionItem key={g.uniqueKey} value={g.uniqueKey} className="border rounded-lg overflow-hidden">
            <AccordionTrigger className="px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 hover:no-underline">
              <div className="flex items-center justify-between w-full pr-2">
                <div className="flex items-center gap-2 min-w-0">
                  <User className="h-4 w-4 text-gray-400 shrink-0" />
                  <div className="text-left min-w-0">
                    <p className="font-medium text-sm truncate">{g.clientName}</p>
                    <p className="text-xs text-gray-500">{g.totalDocs} línea{g.totalDocs !== 1 ? "s" : ""}</p>
                  </div>
                </div>
                <div className="flex gap-4 text-right shrink-0">
                  <div>
                    <p className="text-xs text-gray-500">Unidades</p>
                    <p className="text-sm font-semibold text-blue-600">{g.totalUnits.toLocaleString("es-CL")}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Monto</p>
                    <p className="text-sm font-bold text-purple-600">{formatCurrency(g.totalAmount)}</p>
                  </div>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-3 pb-3">
              <div className="overflow-x-auto">
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
                    {g.records.map((r, idx) => (
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
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      {groupedByClient.length > 5 && (
        <Button variant="outline" size="sm" className="w-full" onClick={() => setShowAll(!showAll)}>
          {showAll ? "Ver menos" : `Ver todos (${groupedByClient.length - 5} más)`}
        </Button>
      )}
    </div>
  );
}

// ==============================
// Facturas Tab (Listos)
// ==============================

function ListosTab({ salesperson }: { salesperson: string }) {
  const [showAll, setShowAll] = useState(false);

  const { data: transactions, isLoading } = useQuery<any[]>({
    queryKey: ["/api/sales/transactions", salesperson, "mis-pedidos"],
    queryFn: async () => {
      // Get current month date range
      const now = new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
      const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];

      const params = new URLSearchParams({
        salesperson,
        startDate,
        endDate,
        limit: "200",
      });
      const response = await fetch(`/api/sales/transactions?${params}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Error cargando facturas");
      return response.json();
    },
    enabled: !!salesperson,
  });

  // Group transactions by client
  const groupedByClient: ClientGroup<any>[] = transactions
    ? Object.values(
        transactions.reduce((acc: Record<string, ClientGroup<any>>, tx: any) => {
          const key = tx.clientCode?.trim().toUpperCase() || tx.clientName?.trim().toUpperCase() || "SIN_CODIGO";
          if (!acc[key]) {
            acc[key] = {
              uniqueKey: key,
              clientCode: tx.clientCode?.trim() || "",
              clientName: tx.clientName?.trim() || "Sin nombre",
              totalAmount: 0,
              totalUnits: 0,
              totalDocs: 0,
              records: [],
            };
          }
          acc[key].totalAmount += Number(tx.amount) || 0;
          acc[key].totalUnits += Number(tx.quantity) || 0;
          acc[key].totalDocs += 1;
          acc[key].records.push(tx);
          return acc;
        }, {})
      ).sort((a, b) => b.totalAmount - a.totalAmount)
    : [];

  const totalAmount = groupedByClient.reduce((s, g) => s + g.totalAmount, 0);
  const totalDocs = transactions?.length || 0;

  if (isLoading) {
    return <div className="h-64 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />;
  }

  if (!transactions || transactions.length === 0) {
    return (
      <div className="text-center py-12">
        <FileCheck className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
        <p className="text-sm text-gray-500 dark:text-gray-400">No hay facturas en el mes actual</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
          <div className="flex items-center gap-2 text-green-600 dark:text-green-400 mb-1">
            <DollarSign className="h-4 w-4" />
            <span className="text-xs font-medium">Monto Facturado</span>
          </div>
          <p className="text-lg font-bold text-green-700 dark:text-green-300">{formatCurrency(totalAmount)}</p>
        </div>
        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-3">
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 mb-1">
            <FileCheck className="h-4 w-4" />
            <span className="text-xs font-medium">Documentos</span>
          </div>
          <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">{totalDocs}</p>
        </div>
        <div className="bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 rounded-lg p-3">
          <div className="flex items-center gap-2 text-teal-600 dark:text-teal-400 mb-1">
            <User className="h-4 w-4" />
            <span className="text-xs font-medium">Clientes</span>
          </div>
          <p className="text-lg font-bold text-teal-700 dark:text-teal-300">{groupedByClient.length}</p>
        </div>
      </div>

      {/* Client accordion */}
      <Accordion type="single" collapsible className="space-y-2">
        {(showAll ? groupedByClient : groupedByClient.slice(0, 5)).map((g) => (
          <AccordionItem key={g.uniqueKey} value={g.uniqueKey} className="border rounded-lg overflow-hidden">
            <AccordionTrigger className="px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 hover:no-underline">
              <div className="flex items-center justify-between w-full pr-2">
                <div className="flex items-center gap-2 min-w-0">
                  <User className="h-4 w-4 text-gray-400 shrink-0" />
                  <div className="text-left min-w-0">
                    <p className="font-medium text-sm truncate">{g.clientName}</p>
                    <p className="text-xs text-gray-500">{g.totalDocs} factura{g.totalDocs !== 1 ? "s" : ""}</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-gray-500">Monto</p>
                  <p className="text-sm font-bold text-green-600">{formatCurrency(g.totalAmount)}</p>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-3 pb-3">
              <div className="overflow-x-auto">
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
                    {g.records.map((r: any, idx: number) => (
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
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      {groupedByClient.length > 5 && (
        <Button variant="outline" size="sm" className="w-full" onClick={() => setShowAll(!showAll)}>
          {showAll ? "Ver menos" : `Ver todos (${groupedByClient.length - 5} más)`}
        </Button>
      )}
    </div>
  );
}

// ==============================
// Main Page
// ==============================

export default function MisPedidos() {
  const { user } = useAuth();
  const salespersonName = (user as any)?.salespersonName || "";
  const [activeTab, setActiveTab] = useState("ingresados");

  if (!salespersonName) {
    return (
      <div className="p-6 text-center">
        <ClipboardList className="h-12 w-12 text-gray-300 mx-auto mb-3" />
        <h2 className="text-lg font-semibold text-gray-700">Sin acceso</h2>
        <p className="text-sm text-gray-500">No se pudo determinar el vendedor asociado a tu cuenta.</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl">
          <ClipboardList className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Mis Pedidos</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Seguimiento de tus documentos comerciales</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="ingresados" className="flex items-center gap-1.5 text-xs sm:text-sm" data-testid="tab-ingresados">
            <ShoppingCart className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Ingresados</span>
            <span className="sm:hidden">NVV</span>
          </TabsTrigger>
          <TabsTrigger value="despacho" className="flex items-center gap-1.5 text-xs sm:text-sm" data-testid="tab-despacho">
            <Truck className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">En Despacho</span>
            <span className="sm:hidden">GDV</span>
          </TabsTrigger>
          <TabsTrigger value="listos" className="flex items-center gap-1.5 text-xs sm:text-sm" data-testid="tab-listos">
            <FileCheck className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Listos</span>
            <span className="sm:hidden">Fact</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ingresados" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5 text-amber-500" />
                  Notas de Venta (NVV)
                </CardTitle>
                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Ingresados</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <IngresadosTab salesperson={salespersonName} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="despacho" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Truck className="h-5 w-5 text-purple-500" />
                  Guías de Despacho (GDV)
                </CardTitle>
                <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">En Despacho</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <EnDespachoTab salesperson={salespersonName} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="listos" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileCheck className="h-5 w-5 text-green-500" />
                  Facturas (Mes Actual)
                </CardTitle>
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Listos</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <ListosTab salesperson={salespersonName} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
