import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ShoppingCart, Package, DollarSign, Users, Truck, User, ChevronDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";

// ─── NVV Types ───
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

interface NVVSalespersonGroup {
    salespersonCode: string;
    salespersonName: string;
    totalAmount: number;
    totalUnits: number;
    totalOrders: number;
    records: NVVRecord[];
}

interface NVVClientGroup {
    uniqueKey: string;
    clientCode: string;
    clientName: string;
    totalAmount: number;
    totalUnits: number;
    totalOrders: number;
    records: NVVRecord[];
}

// ─── GDV Types ───
interface GDVRecord {
    numeroGuia: string;
    fecha: string;
    cliente: string;
    codigoCliente: string;
    producto: string;
    cantidad: number;
    monto: number;
}

interface GDVSalespersonGroup {
    salespersonCode: string;
    salespersonName: string;
    totalAmount: number;
    totalUnits: number;
    totalGuias: number;
    records: GDVRecord[];
}

interface GDVClientGroup {
    uniqueKey: string;
    clientCode: string;
    clientName: string;
    totalAmount: number;
    totalUnits: number;
    totalGuias: number;
    records: GDVRecord[];
}

// ─── Props ───
interface PendingDocumentsUnifiedProps {
    selectedPeriod: string;
    filterType: "day" | "month" | "year" | "range";
    salesperson?: string;
}

// ─── Helpers ───
const formatCurrency = (value: number) =>
    new Intl.NumberFormat('es-CL', {
        style: 'currency',
        currency: 'CLP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(value);

const formatNumber = (num: number) =>
    num.toLocaleString('es-CL', { maximumFractionDigits: 0 });

const groupNvvByClient = (records: NVVRecord[]): NVVClientGroup[] => {
    const grouped = records.reduce((acc, record) => {
        const normalizedEndo = record.ENDO?.trim().toUpperCase() || '';
        const normalizedNokoen = record.NOKOEN?.trim().toUpperCase() || '';
        const uniqueKey = normalizedEndo || normalizedNokoen || 'SIN_CODIGO';
        const displayCode = record.ENDO?.trim() || record.NOKOEN?.trim() || 'Sin código';
        const displayName = record.NOKOEN?.trim() || 'Cliente sin nombre';

        if (!acc[uniqueKey]) {
            acc[uniqueKey] = { uniqueKey, clientCode: displayCode, clientName: displayName, totalAmount: 0, totalUnits: 0, totalOrders: 0, records: [] };
        }
        acc[uniqueKey].totalAmount += record.totalPendiente;
        acc[uniqueKey].totalUnits += record.cantidadPendiente;
        acc[uniqueKey].totalOrders += 1;
        acc[uniqueKey].records.push(record);
        return acc;
    }, {} as Record<string, NVVClientGroup>);
    return Object.values(grouped).sort((a, b) => b.totalAmount - a.totalAmount);
};

const groupGdvByClient = (records: GDVRecord[]): GDVClientGroup[] => {
    const grouped = records.reduce((acc, record) => {
        const normalizedCode = record.codigoCliente?.trim().toUpperCase() || '';
        const normalizedName = record.cliente?.trim().toUpperCase() || '';
        const uniqueKey = normalizedCode || normalizedName || 'SIN_CODIGO';
        const displayCode = record.codigoCliente?.trim() || record.cliente?.trim() || 'Sin código';
        const displayName = record.cliente?.trim() || 'Cliente sin nombre';

        if (!acc[uniqueKey]) {
            acc[uniqueKey] = { uniqueKey, clientCode: displayCode, clientName: displayName, totalAmount: 0, totalUnits: 0, totalGuias: 0, records: [] };
        }
        acc[uniqueKey].totalAmount += record.monto || 0;
        acc[uniqueKey].totalUnits += record.cantidad || 0;
        acc[uniqueKey].totalGuias += 1;
        acc[uniqueKey].records.push(record);
        return acc;
    }, {} as Record<string, GDVClientGroup>);
    return Object.values(grouped).sort((a, b) => b.totalAmount - a.totalAmount);
};

// ─── Component ───
export default function PendingDocumentsUnified({ selectedPeriod, filterType, salesperson }: PendingDocumentsUnifiedProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<"nvv" | "gdv">("nvv");
    const [showAllNvv, setShowAllNvv] = useState(false);
    const [showAllGdv, setShowAllGdv] = useState(false);

    const normalize = (s: string) => s?.trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') || '';

    // ─── NVV Data ───
    const { data: nvvDataRaw, isLoading: isLoadingNvv } = useQuery<NVVSalespersonGroup[]>({
        queryKey: ['/api/nvv/all-by-salespeople'],
        queryFn: async () => {
            const response = await fetch('/api/nvv/all-by-salespeople', { credentials: 'include' });
            if (!response.ok) throw new Error('Error al cargar NVV');
            return response.json();
        }
    });

    // ─── GDV Data ───
    const { data: gdvDataRaw, isLoading: isLoadingGdv } = useQuery<GDVSalespersonGroup[]>({
        queryKey: ['/api/gdv/all-by-salespeople'],
        queryFn: async () => {
            const response = await fetch('/api/gdv/all-by-salespeople', { credentials: 'include' });
            if (!response.ok) throw new Error('Error al cargar GDV');
            return response.json();
        }
    });

    // Filter by salesperson if provided
    const nvvData = salesperson
        ? nvvDataRaw?.filter(sp => normalize(sp.salespersonName) === normalize(salesperson))
        : nvvDataRaw;
    const gdvData = salesperson
        ? gdvDataRaw?.filter(sp => normalize(sp.salespersonName) === normalize(salesperson))
        : gdvDataRaw;

    // ─── NVV Totals ───
    const nvvTotalAmount = nvvData?.reduce((s, sp) => s + sp.totalAmount, 0) || 0;
    const nvvTotalUnits = nvvData?.reduce((s, sp) => s + sp.totalUnits, 0) || 0;
    const nvvTotalOrders = nvvData?.reduce((s, sp) => s + sp.totalOrders, 0) || 0;
    const nvvTotalSalespeople = nvvData?.length || 0;

    // ─── GDV Totals ───
    const gdvTotalAmount = gdvData?.reduce((s, sp) => s + sp.totalAmount, 0) || 0;
    const gdvTotalUnits = gdvData?.reduce((s, sp) => s + sp.totalUnits, 0) || 0;
    const gdvTotalGuias = gdvData?.reduce((s, sp) => s + sp.totalGuias, 0) || 0;
    const gdvTotalSalespeople = gdvData?.length || 0;

    // Combined total for the collapsed header
    const combinedTotal = nvvTotalAmount + gdvTotalAmount;

    const isLoading = isLoadingNvv || isLoadingGdv;

    return (
        <Collapsible open={isOpen} onOpenChange={setIsOpen} className="modern-card overflow-hidden">
            {/* ─── Collapsed Header ─── */}
            <CollapsibleTrigger className="w-full p-4 sm:p-5 flex items-center justify-between hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors" data-testid="trigger-pending-docs">
                <div className="flex items-center gap-3 sm:gap-4">
                    <div className="relative">
                        <div className="bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl p-2.5 shadow-lg shadow-amber-200/50 dark:shadow-amber-900/30">
                            <ShoppingCart className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                        </div>
                        {/* Small GDV indicator dot */}
                        <div className="absolute -bottom-0.5 -right-0.5 bg-purple-500 rounded-full w-3 h-3 border-2 border-white dark:border-gray-900" />
                    </div>
                    <div className="text-left">
                        <h3 className="font-bold text-base sm:text-lg text-gray-900 dark:text-gray-100">
                            Documentos Pendientes
                        </h3>
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                                {formatCurrency(combinedTotal)}
                            </span>
                            <span className="text-xs text-gray-400">•</span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                NVV: {formatCurrency(nvvTotalAmount)}
                            </span>
                            <span className="text-xs text-gray-400">•</span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                GDV: {formatCurrency(gdvTotalAmount)}
                            </span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="hidden sm:flex gap-1.5">
                        <Badge variant="outline" className="bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-700 text-xs">
                            {nvvTotalOrders} NVV
                        </Badge>
                        <Badge variant="outline" className="bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-700 text-xs">
                            {gdvTotalGuias} GDV
                        </Badge>
                    </div>
                    <ChevronDown className={`h-5 w-5 text-gray-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
                </div>
            </CollapsibleTrigger>

            {/* ─── Expanded Content ─── */}
            <CollapsibleContent>
                <div className="border-t border-gray-200/60 dark:border-gray-700/60">
                    <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "nvv" | "gdv")} className="w-full">
                        {/* Tab Selector */}
                        <div className="px-4 sm:px-5 pt-4">
                            <TabsList className="grid w-full grid-cols-2 h-10">
                                <TabsTrigger value="nvv" className="flex items-center gap-2 text-sm font-medium">
                                    <ShoppingCart className="h-3.5 w-3.5" />
                                    <span className="hidden sm:inline">Notas de Venta</span>
                                    <span className="sm:hidden">NVV</span>
                                    <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0 h-5 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                                        {nvvTotalOrders}
                                    </Badge>
                                </TabsTrigger>
                                <TabsTrigger value="gdv" className="flex items-center gap-2 text-sm font-medium">
                                    <Truck className="h-3.5 w-3.5" />
                                    <span className="hidden sm:inline">Guías Despacho</span>
                                    <span className="sm:hidden">GDV</span>
                                    <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0 h-5 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                                        {gdvTotalGuias}
                                    </Badge>
                                </TabsTrigger>
                            </TabsList>
                        </div>

                        {/* ════════════ NVV Tab ════════════ */}
                        <TabsContent value="nvv" className="px-4 sm:px-5 pb-5 pt-4 space-y-4 mt-0">
                            {/* KPI Row */}
                            <div className="grid grid-cols-3 gap-2 sm:gap-3">
                                <div className="bg-amber-50/80 dark:bg-amber-900/10 border border-amber-200/60 dark:border-amber-800/40 rounded-xl p-2.5 sm:p-3">
                                    <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 mb-0.5">
                                        <DollarSign className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                                        <span className="text-[10px] sm:text-xs font-medium">Monto</span>
                                    </div>
                                    <div className="text-sm sm:text-lg font-bold text-gray-900 dark:text-gray-100 truncate">{formatCurrency(nvvTotalAmount)}</div>
                                </div>
                                <div className="bg-purple-50/80 dark:bg-purple-900/10 border border-purple-200/60 dark:border-purple-800/40 rounded-xl p-2.5 sm:p-3">
                                    <div className="flex items-center gap-1.5 text-purple-600 dark:text-purple-400 mb-0.5">
                                        <Package className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                                        <span className="text-[10px] sm:text-xs font-medium">Unidades</span>
                                    </div>
                                    <div className="text-sm sm:text-lg font-bold text-gray-900 dark:text-gray-100">{formatNumber(nvvTotalUnits)}</div>
                                </div>
                                <div className="bg-blue-50/80 dark:bg-blue-900/10 border border-blue-200/60 dark:border-blue-800/40 rounded-xl p-2.5 sm:p-3">
                                    <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 mb-0.5">
                                        <ShoppingCart className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                                        <span className="text-[10px] sm:text-xs font-medium">Pedidos</span>
                                    </div>
                                    <div className="text-sm sm:text-lg font-bold text-gray-900 dark:text-gray-100">{nvvTotalOrders}</div>
                                </div>
                            </div>

                            {/* NVV By Salesperson */}
                            {isLoadingNvv ? (
                                <div className="h-40 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
                            ) : !nvvData || nvvData.length === 0 ? (
                                <div className="text-center py-6">
                                    <Package className="h-10 w-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                                    <p className="text-sm text-gray-500 dark:text-gray-400">No hay notas de venta pendientes</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                                        Por Vendedor ({nvvTotalSalespeople})
                                    </h4>
                                    <Accordion type="single" collapsible className="space-y-1.5">
                                        {(showAllNvv ? nvvData : nvvData.slice(0, 5)).map((sp) => {
                                            const clientGroups = groupNvvByClient(sp.records);
                                            return (
                                                <AccordionItem key={sp.salespersonCode} value={sp.salespersonCode} className="border rounded-lg overflow-hidden">
                                                    <AccordionTrigger className="px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 hover:no-underline">
                                                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between w-full pr-2 gap-1.5">
                                                            <div className="flex items-center gap-2 min-w-0 flex-1">
                                                                <div className="bg-green-100 dark:bg-green-900/30 p-1.5 rounded-lg shrink-0">
                                                                    <Users className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                                                                </div>
                                                                <div className="text-left min-w-0 flex-1">
                                                                    <div className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate">{sp.salespersonName}</div>
                                                                    <div className="text-xs text-gray-500 dark:text-gray-400">
                                                                        {clientGroups.length} {clientGroups.length === 1 ? 'cliente' : 'clientes'} • {sp.totalOrders} docs
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="flex gap-4 shrink-0">
                                                                <div className="text-left sm:text-right">
                                                                    <div className="text-[10px] sm:text-xs text-gray-500">Uds</div>
                                                                    <div className="font-semibold text-sm text-purple-700 dark:text-purple-300">{formatNumber(sp.totalUnits)}</div>
                                                                </div>
                                                                <div className="text-left sm:text-right">
                                                                    <div className="text-[10px] sm:text-xs text-gray-500">Monto</div>
                                                                    <div className="font-bold text-sm text-amber-700 dark:text-amber-300">{formatCurrency(sp.totalAmount)}</div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </AccordionTrigger>
                                                    <AccordionContent className="px-3 pb-3">
                                                        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 mt-1">
                                                            <Accordion type="single" collapsible className="space-y-1.5">
                                                                {clientGroups.map((cg) => (
                                                                    <AccordionItem key={`${sp.salespersonCode}-${cg.uniqueKey}`} value={`${sp.salespersonCode}-${cg.uniqueKey}`} className="border rounded-lg bg-white dark:bg-slate-900">
                                                                        <AccordionTrigger className="px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800 text-sm">
                                                                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between w-full pr-2 gap-1">
                                                                                <div className="text-left min-w-0 flex-1">
                                                                                    <div className="font-medium text-xs sm:text-sm text-gray-900 dark:text-gray-100 truncate">{cg.clientName}</div>
                                                                                    <div className="text-xs text-gray-500">{cg.totalOrders} docs</div>
                                                                                </div>
                                                                                <div className="flex gap-3 shrink-0">
                                                                                    <div className="text-left sm:text-right">
                                                                                        <div className="text-xs text-gray-500">Uds</div>
                                                                                        <div className="text-sm font-semibold text-purple-700 dark:text-purple-300">{formatNumber(cg.totalUnits)}</div>
                                                                                    </div>
                                                                                    <div className="text-left sm:text-right">
                                                                                        <div className="text-xs text-gray-500">Monto</div>
                                                                                        <div className="text-sm font-bold text-amber-700 dark:text-amber-300">{formatCurrency(cg.totalAmount)}</div>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        </AccordionTrigger>
                                                                        <AccordionContent className="px-2 pb-2">
                                                                            <div className="bg-gray-50 dark:bg-gray-800 rounded p-2 mt-1 space-y-1.5">
                                                                                {cg.records.map((r) => (
                                                                                    <div key={r.id} className="bg-white dark:bg-slate-900 rounded border dark:border-gray-700 p-2 text-xs">
                                                                                        <div className="flex justify-between items-start mb-1">
                                                                                            <div>
                                                                                                <div className="font-semibold text-gray-900 dark:text-gray-100">{r.NUDO}</div>
                                                                                                <div className="text-gray-500">{r.TIDO}</div>
                                                                                            </div>
                                                                                            <Badge variant="outline" className="bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 text-xs shrink-0">
                                                                                                {formatCurrency(r.totalPendiente)}
                                                                                            </Badge>
                                                                                        </div>
                                                                                        <div className="text-gray-600 dark:text-gray-400">
                                                                                            <div className="truncate"><span className="font-medium">Producto:</span> {r.NOKOPR}</div>
                                                                                            <div className="flex gap-2 mt-0.5">
                                                                                                <span><span className="font-medium">Req:</span> {formatNumber(r.CAPREX2)}</span>
                                                                                                <span><span className="font-medium">Conf:</span> {formatNumber(r.CAPRCO2)}</span>
                                                                                                <span className="font-semibold text-amber-700 dark:text-amber-300"><span className="font-medium">Pend:</span> {formatNumber(r.cantidadPendiente)}</span>
                                                                                            </div>
                                                                                        </div>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        </AccordionContent>
                                                                    </AccordionItem>
                                                                ))}
                                                            </Accordion>
                                                        </div>
                                                    </AccordionContent>
                                                </AccordionItem>
                                            );
                                        })}
                                    </Accordion>
                                    {nvvData.length > 5 && (
                                        <div className="mt-3 text-center">
                                            <Button variant="outline" size="sm" onClick={() => setShowAllNvv(!showAllNvv)} className="w-full">
                                                {showAllNvv ? 'Ver menos' : `Ver más (${nvvData.length - 5} más)`}
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </TabsContent>

                        {/* ════════════ GDV Tab ════════════ */}
                        <TabsContent value="gdv" className="px-4 sm:px-5 pb-5 pt-4 space-y-4 mt-0">
                            {/* KPI Row */}
                            <div className="grid grid-cols-3 gap-2 sm:gap-3">
                                <div className="bg-purple-50/80 dark:bg-purple-900/10 border border-purple-200/60 dark:border-purple-800/40 rounded-xl p-2.5 sm:p-3">
                                    <div className="flex items-center gap-1.5 text-purple-600 dark:text-purple-400 mb-0.5">
                                        <DollarSign className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                                        <span className="text-[10px] sm:text-xs font-medium">Monto</span>
                                    </div>
                                    <div className="text-sm sm:text-lg font-bold text-gray-900 dark:text-gray-100 truncate">{formatCurrency(gdvTotalAmount)}</div>
                                </div>
                                <div className="bg-blue-50/80 dark:bg-blue-900/10 border border-blue-200/60 dark:border-blue-800/40 rounded-xl p-2.5 sm:p-3">
                                    <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 mb-0.5">
                                        <Package className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                                        <span className="text-[10px] sm:text-xs font-medium">Unidades</span>
                                    </div>
                                    <div className="text-sm sm:text-lg font-bold text-gray-900 dark:text-gray-100">{formatNumber(gdvTotalUnits)}</div>
                                </div>
                                <div className="bg-orange-50/80 dark:bg-orange-900/10 border border-orange-200/60 dark:border-orange-800/40 rounded-xl p-2.5 sm:p-3">
                                    <div className="flex items-center gap-1.5 text-orange-600 dark:text-orange-400 mb-0.5">
                                        <Truck className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                                        <span className="text-[10px] sm:text-xs font-medium">Guías</span>
                                    </div>
                                    <div className="text-sm sm:text-lg font-bold text-gray-900 dark:text-gray-100">{gdvTotalGuias}</div>
                                </div>
                            </div>

                            {/* GDV By Salesperson */}
                            {isLoadingGdv ? (
                                <div className="h-40 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
                            ) : !gdvData || gdvData.length === 0 ? (
                                <div className="text-center py-6">
                                    <Truck className="h-10 w-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                                    <p className="text-sm text-gray-500 dark:text-gray-400">No hay guías de despacho pendientes</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                                        Por Vendedor ({gdvTotalSalespeople})
                                    </h4>
                                    <Accordion type="single" collapsible className="space-y-1.5">
                                        {(showAllGdv ? gdvData : gdvData.slice(0, 5)).map((sp) => {
                                            const clientGroups = groupGdvByClient(sp.records);
                                            return (
                                                <AccordionItem key={sp.salespersonCode} value={sp.salespersonCode} className="border rounded-lg overflow-hidden">
                                                    <AccordionTrigger className="px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 hover:no-underline">
                                                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between w-full pr-2 gap-1.5">
                                                            <div className="flex items-center gap-2 min-w-0 flex-1">
                                                                <div className="bg-purple-100 dark:bg-purple-900/30 p-1.5 rounded-lg shrink-0">
                                                                    <Users className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                                                                </div>
                                                                <div className="text-left min-w-0 flex-1">
                                                                    <div className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate">{sp.salespersonName}</div>
                                                                    <div className="text-xs text-gray-500 dark:text-gray-400">
                                                                        {clientGroups.length} {clientGroups.length === 1 ? 'cliente' : 'clientes'} • {sp.totalGuias} guías
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="flex gap-4 shrink-0">
                                                                <div className="text-left sm:text-right">
                                                                    <div className="text-[10px] sm:text-xs text-gray-500">Uds</div>
                                                                    <div className="font-semibold text-sm text-blue-700 dark:text-blue-300">{formatNumber(sp.totalUnits)}</div>
                                                                </div>
                                                                <div className="text-left sm:text-right">
                                                                    <div className="text-[10px] sm:text-xs text-gray-500">Monto</div>
                                                                    <div className="font-bold text-sm text-purple-700 dark:text-purple-300">{formatCurrency(sp.totalAmount)}</div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </AccordionTrigger>
                                                    <AccordionContent className="px-3 pb-3">
                                                        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 mt-1">
                                                            <Accordion type="single" collapsible className="space-y-1.5">
                                                                {clientGroups.map((cg) => (
                                                                    <AccordionItem key={`gdv-${sp.salespersonCode}-${cg.uniqueKey}`} value={`gdv-${sp.salespersonCode}-${cg.uniqueKey}`} className="border rounded-lg bg-white dark:bg-slate-900">
                                                                        <AccordionTrigger className="px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800 text-sm">
                                                                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between w-full pr-2 gap-1">
                                                                                <div className="text-left min-w-0 flex-1">
                                                                                    <div className="font-medium text-xs sm:text-sm text-gray-900 dark:text-gray-100 truncate">{cg.clientName}</div>
                                                                                    <div className="text-xs text-gray-500">{cg.totalGuias} guía{cg.totalGuias !== 1 ? 's' : ''}</div>
                                                                                </div>
                                                                                <div className="flex gap-3 shrink-0">
                                                                                    <div className="text-left sm:text-right">
                                                                                        <div className="text-xs text-gray-500">Uds</div>
                                                                                        <div className="text-sm font-semibold text-blue-700 dark:text-blue-300">{formatNumber(cg.totalUnits)}</div>
                                                                                    </div>
                                                                                    <div className="text-left sm:text-right">
                                                                                        <div className="text-xs text-gray-500">Monto</div>
                                                                                        <div className="text-sm font-bold text-purple-700 dark:text-purple-300">{formatCurrency(cg.totalAmount)}</div>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        </AccordionTrigger>
                                                                        <AccordionContent className="px-2 pb-2">
                                                                            <div className="bg-gray-50 dark:bg-gray-800 rounded p-2 mt-1 space-y-1.5">
                                                                                {cg.records.map((r, idx) => (
                                                                                    <div key={`${r.numeroGuia}-${idx}`} className="bg-white dark:bg-slate-900 rounded border dark:border-gray-700 p-2 text-xs">
                                                                                        <div className="flex justify-between items-start mb-1">
                                                                                            <div>
                                                                                                <div className="font-semibold text-gray-900 dark:text-gray-100">Guía {r.numeroGuia}</div>
                                                                                                <div className="text-gray-500">{r.fecha ? new Date(r.fecha).toLocaleDateString('es-CL', { year: 'numeric', month: 'short', day: 'numeric' }) : '-'}</div>
                                                                                            </div>
                                                                                            <Badge variant="outline" className="bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-200 text-xs shrink-0">
                                                                                                {formatCurrency(r.monto)}
                                                                                            </Badge>
                                                                                        </div>
                                                                                        <div className="text-gray-600 dark:text-gray-400">
                                                                                            <div className="truncate"><span className="font-medium">Producto:</span> {r.producto}</div>
                                                                                            <div className="mt-0.5">
                                                                                                <span className="font-semibold text-blue-700 dark:text-blue-300">Cantidad: {formatNumber(r.cantidad)}</span>
                                                                                            </div>
                                                                                        </div>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        </AccordionContent>
                                                                    </AccordionItem>
                                                                ))}
                                                            </Accordion>
                                                        </div>
                                                    </AccordionContent>
                                                </AccordionItem>
                                            );
                                        })}
                                    </Accordion>
                                    {gdvData.length > 5 && (
                                        <div className="mt-3 text-center">
                                            <Button variant="outline" size="sm" onClick={() => setShowAllGdv(!showAllGdv)} className="w-full">
                                                {showAllGdv ? 'Ver menos' : `Ver más (${gdvData.length - 5} más)`}
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </TabsContent>
                    </Tabs>
                </div>
            </CollapsibleContent>
        </Collapsible>
    );
}
