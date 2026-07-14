import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import * as XLSX from "xlsx";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Loader2, Save, Download, TrendingUp, Eye, EyeOff, AlertTriangle, Table2, CalendarDays, Wallet, Receipt, PiggyBank, ChevronLeft, ChevronRight, CheckCircle2 } from "lucide-react";

interface PresupuestoItem {
    id: string;
    anio: number;
    concepto: string;
    categoria: string | null;
    enero: string | null;
    febrero: string | null;
    marzo: string | null;
    abril: string | null;
    mayo: string | null;
    junio: string | null;
    julio: string | null;
    agosto: string | null;
    septiembre: string | null;
    octubre: string | null;
    noviembre: string | null;
    diciembre: string | null;
    createdAt: string;
    updatedAt: string;
}

interface GastoLite {
    id: string;
    concepto: string;
    monto: string;
    categoria: string | null;
    mes: number;
    anio: number;
    presupuestoItemId: string | null;
}

const MESES = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
] as const;

const ZEROS = () => Array(12).fill(0) as number[];

// Color de cumplimiento: verde si va bajo/en presupuesto, ámbar si lo roza,
// rojo si se pasó. `budget === 0 && real > 0` = ítem nuevo sin presupuesto.
function cumplimientoColor(real: number, budget: number): { text: string; bar: string; label: string } {
    if (budget === 0) {
        return real > 0
            ? { text: "text-rose-600 dark:text-rose-400", bar: "bg-rose-500", label: "Nuevo" }
            : { text: "text-slate-400", bar: "bg-slate-300", label: "—" };
    }
    const pct = (real / budget) * 100;
    if (pct > 110) return { text: "text-rose-600 dark:text-rose-400", bar: "bg-rose-500", label: `${Math.round(pct)}%` };
    if (pct > 100) return { text: "text-amber-600 dark:text-amber-400", bar: "bg-amber-500", label: `${Math.round(pct)}%` };
    return { text: "text-emerald-600 dark:text-emerald-400", bar: "bg-emerald-500", label: `${Math.round(pct)}%` };
}

const MESES_CORTO = [
    "Ene", "Feb", "Mar", "Abr", "May", "Jun",
    "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"
];

const MESES_NOMBRES = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

const CATEGORIAS = [
    "DIGITAL",
    "MEDIOS TRADICIONALES",
    "MATERIAL GRÁFICO",
    "OTROS",
];

function parseNum(val: string | null | undefined): number {
    if (!val) return 0;
    const n = parseFloat(val);
    return isNaN(n) ? 0 : n;
}

function formatCLP(amount: number): string {
    if (amount === 0) return "-";
    return "$" + amount.toLocaleString("es-CL", { maximumFractionDigits: 0 });
}

export default function PresupuestoTabMarketing({
    userRole,
    selectedMes,
    setSelectedMes,
    selectedAnio,
    setSelectedAnio,
}: {
    userRole: string;
    selectedMes?: number;
    setSelectedMes?: (mes: number) => void;
    selectedAnio: number;
    setSelectedAnio: (anio: number) => void;
}) {
    const { toast } = useToast();
    const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null);
    const [editValue, setEditValue] = useState("");
    const [addDialogOpen, setAddDialogOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [deleteItemId, setDeleteItemId] = useState<string | null>(null);
    const [newItem, setNewItem] = useState({ concepto: "", categoria: "DIGITAL" });
    const inputRef = useRef<HTMLInputElement>(null);
    // Vista: "mensual" (práctica, día a día) o "anual" (tabla Excel completa)
    const [viewMode, setViewMode] = useState<"mensual" | "anual">("mensual");
    // Vista comparativa presupuestado vs. gasto real (solo aplica a la tabla anual)
    const [showReal, setShowReal] = useState(false);
    const [barsIn, setBarsIn] = useState(false);

    const isAdmin = userRole === "admin" || userRole === "supervisor" || userRole === "marketing";

    // Mes activo (1-12). En vista mensual siempre trabajamos sobre este mes.
    const mesActual = selectedMes && selectedMes >= 1 && selectedMes <= 12 ? selectedMes : new Date().getMonth() + 1;
    const mesIdx = mesActual - 1;
    const cambiarMes = (m: number) => setSelectedMes?.(Math.min(12, Math.max(1, m)));

    const { data: items = [], isLoading } = useQuery<PresupuestoItem[]>({
        queryKey: ["/api/marketing/presupuesto-items", selectedAnio],
        queryFn: async () => {
            const response = await fetch(`/api/marketing/presupuesto-items/${selectedAnio}`, {
                credentials: "include",
            });
            if (!response.ok) throw new Error("Error al cargar presupuesto");
            return response.json();
        },
    });

    // Gastos reales del año (para comparar contra el presupuesto).
    // La vista mensual siempre los necesita; la anual solo al activar "Ver gastos real".
    const { data: gastosAnio = [] } = useQuery<GastoLite[]>({
        queryKey: ["/api/marketing/gastos/anio", selectedAnio],
        queryFn: async () => {
            const res = await fetch(`/api/marketing/gastos/anio/${selectedAnio}`, { credentials: "include" });
            if (!res.ok) throw new Error("Error al cargar gastos");
            return res.json();
        },
        enabled: viewMode === "mensual" || showReal,
    });

    // Real por ítem de presupuesto (12 meses) + gastos sin asignar → "ítems nuevos"
    const { realByItem, virtualItems } = useMemo(() => {
        const byItem: Record<string, number[]> = {};
        const sinAsignar: Record<string, { concepto: string; categoria: string; real: number[] }> = {};
        for (const g of gastosAnio) {
            const monto = parseNum(g.monto);
            const idx = Math.min(11, Math.max(0, (g.mes || 1) - 1));
            if (g.presupuestoItemId) {
                if (!byItem[g.presupuestoItemId]) byItem[g.presupuestoItemId] = ZEROS();
                byItem[g.presupuestoItemId][idx] += monto;
            } else {
                const cat = g.categoria || "OTROS";
                const key = `${cat}||${g.concepto}`;
                if (!sinAsignar[key]) sinAsignar[key] = { concepto: g.concepto, categoria: cat, real: ZEROS() };
                sinAsignar[key].real[idx] += monto;
            }
        }
        const virtual = Object.entries(sinAsignar).map(([key, v]) => ({ id: `virtual-${key}`, ...v }));
        return { realByItem: byItem, virtualItems: virtual };
    }, [gastosAnio]);

    const getItemReal = useCallback((id: string) => realByItem[id] || ZEROS(), [realByItem]);

    const createMutation = useMutation({
        mutationFn: async (data: any) => {
            return await apiRequest("POST", "/api/marketing/presupuesto-items", data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/marketing/presupuesto-items"] });
            setAddDialogOpen(false);
            setNewItem({ concepto: "", categoria: "DIGITAL" });
            toast({ title: "Ítem agregado", description: "Se agregó la fila al presupuesto." });
        },
        onError: () => {
            toast({ title: "Error", description: "No se pudo agregar el ítem.", variant: "destructive" });
        },
    });

    const updateMutation = useMutation({
        mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
            return await apiRequest("PATCH", `/api/marketing/presupuesto-items/${id}`, updates);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/marketing/presupuesto-items"] });
        },
        onError: () => {
            toast({ title: "Error", description: "No se pudo actualizar.", variant: "destructive" });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            return await apiRequest("DELETE", `/api/marketing/presupuesto-items/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/marketing/presupuesto-items"] });
            setDeleteDialogOpen(false);
            toast({ title: "Eliminado", description: "Se eliminó el ítem." });
        },
        onError: () => {
            toast({ title: "Error", description: "No se pudo eliminar.", variant: "destructive" });
        },
    });

    useEffect(() => {
        if (editingCell && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [editingCell]);

    // Dispara la animación de las barras un tick después de activar la vista real
    useEffect(() => {
        if (showReal) {
            const t = setTimeout(() => setBarsIn(true), 60);
            return () => clearTimeout(t);
        }
        setBarsIn(false);
    }, [showReal, selectedAnio]);

    const handleCellClick = useCallback((id: string, field: string, currentValue: string | null) => {
        if (!isAdmin) return;
        setEditingCell({ id, field });
        setEditValue(parseNum(currentValue).toString());
    }, [isAdmin]);

    const handleCellSave = useCallback(() => {
        if (!editingCell) return;
        const numVal = parseFloat(editValue) || 0;
        updateMutation.mutate({
            id: editingCell.id,
            updates: { [editingCell.field]: numVal.toString() },
        });
        setEditingCell(null);
        setEditValue("");
    }, [editingCell, editValue, updateMutation]);

    const handleCellKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            handleCellSave();
        } else if (e.key === "Escape") {
            setEditingCell(null);
            setEditValue("");
        }
    }, [handleCellSave]);

    const handleConceptoEdit = useCallback((id: string, currentValue: string) => {
        if (!isAdmin) return;
        setEditingCell({ id, field: "concepto" });
        setEditValue(currentValue);
    }, [isAdmin]);

    const handleConceptoSave = useCallback(() => {
        if (!editingCell || !editValue.trim()) return;
        updateMutation.mutate({
            id: editingCell.id,
            updates: { concepto: editValue.trim() },
        });
        setEditingCell(null);
        setEditValue("");
    }, [editingCell, editValue, updateMutation]);

    // Group by category
    const groupedItems = items.reduce((acc, item) => {
        const cat = item.categoria || "OTROS";
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(item);
        return acc;
    }, {} as Record<string, PresupuestoItem[]>);

    // Totals per month (all items)
    const totalesPorMes = MESES.map((mes) =>
        items.reduce((sum, item) => sum + parseNum(item[mes as keyof PresupuestoItem] as string), 0)
    );
    const totalAnual = totalesPorMes.reduce((a, b) => a + b, 0);

    // Totales reales por mes (ítems presupuestados + ítems nuevos sin asignar)
    const realTotalesPorMes = MESES.map((_, i) => {
        let sum = 0;
        for (const item of items) sum += getItemReal(item.id)[i];
        for (const v of virtualItems) sum += v.real[i];
        return sum;
    });
    const realTotalAnual = realTotalesPorMes.reduce((a, b) => a + b, 0);
    const diferenciaAnual = totalAnual - realTotalAnual; // >0 = queda saldo; <0 = sobregiro
    const ejecucionPct = totalAnual > 0 ? Math.round((realTotalAnual / totalAnual) * 100) : 0;
    const virtualTotalAnual = virtualItems.reduce((s, v) => s + v.real.reduce((a, b) => a + b, 0), 0);

    // Ítems nuevos (sin presupuesto) agrupados por categoría, para el bloque final
    const virtualPorCategoria = virtualItems.reduce((acc, v) => {
        (acc[v.categoria] ||= []).push(v);
        return acc;
    }, {} as Record<string, typeof virtualItems>);

    // Category subtotals
    const getCategoryTotals = (categoryItems: PresupuestoItem[]) => {
        const mesesTotals = MESES.map((mes) =>
            categoryItems.reduce((sum, item) => sum + parseNum(item[mes as keyof PresupuestoItem] as string), 0)
        );
        return { mesesTotals, total: mesesTotals.reduce((a, b) => a + b, 0) };
    };

    const getRowTotal = (item: PresupuestoItem) =>
        MESES.reduce((sum, mes) => sum + parseNum(item[mes as keyof PresupuestoItem] as string), 0);

    // ─── Datos de la vista MENSUAL (foco en el mes activo) ───
    const mesField = MESES[mesIdx] as keyof PresupuestoItem;
    // Filas del mes por categoría: presupuesto y gasto real de cada concepto en este mes
    const filasMesPorCategoria = Object.entries(groupedItems).map(([categoria, catItems]) => {
        const filas = catItems.map((item) => ({
            id: item.id,
            concepto: item.concepto,
            presupuesto: parseNum(item[mesField] as string),
            gastado: getItemReal(item.id)[mesIdx],
        }));
        const presupuesto = filas.reduce((s, f) => s + f.presupuesto, 0);
        const gastado = filas.reduce((s, f) => s + f.gastado, 0);
        return { categoria, filas, presupuesto, gastado };
    });
    // Gastos "extra" del mes: gastos sin ítem de presupuesto asignado (los que se
    // registran en la pestaña Gastos y no coinciden con nada itemizado).
    const extrasMes = virtualItems
        .map((v) => ({ id: v.id, concepto: v.concepto, categoria: v.categoria, gastado: v.real[mesIdx] }))
        .filter((v) => v.gastado > 0);
    const presupuestadoMes = filasMesPorCategoria.reduce((s, c) => s + c.presupuesto, 0);
    const gastadoItemsMes = filasMesPorCategoria.reduce((s, c) => s + c.gastado, 0);
    const extraMes = extrasMes.reduce((s, v) => s + v.gastado, 0);
    const gastadoMes = gastadoItemsMes + extraMes;
    const disponibleMes = presupuestadoMes - gastadoMes;
    const ejecucionMesPct = presupuestadoMes > 0 ? Math.round((gastadoMes / presupuestadoMes) * 100) : (gastadoMes > 0 ? 100 : 0);

    const handleAddItem = () => {
        if (!newItem.concepto.trim()) return;
        createMutation.mutate({
            anio: selectedAnio,
            concepto: newItem.concepto.trim(),
            categoria: newItem.categoria,
        });
    };

    const handleExportCSV = () => {
        // Build data rows for Excel
        const excelData = items.map((item) => {
            const row: Record<string, any> = {
                'Concepto': item.concepto,
                'Categoría': item.categoria || '',
            };
            MESES.forEach((mes, i) => {
                row[MESES_CORTO[i]] = parseNum(item[mes as keyof PresupuestoItem] as string);
            });
            row['Total'] = getRowTotal(item);
            return row;
        });

        // Add grand total row
        const totalRow: Record<string, any> = { 'Concepto': 'TOTAL GENERAL', 'Categoría': '' };
        MESES_CORTO.forEach((mes, i) => {
            totalRow[mes] = totalesPorMes[i];
        });
        totalRow['Total'] = totalAnual;
        excelData.push(totalRow);

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(excelData);
        ws['!cols'] = [
            { wch: 30 }, // Concepto
            { wch: 22 }, // Categoría
            ...MESES.map(() => ({ wch: 14 })), // Month columns
            { wch: 16 }, // Total
        ];
        XLSX.utils.book_append_sheet(wb, ws, `Presupuesto ${selectedAnio}`);
        XLSX.writeFile(wb, `presupuesto-marketing-${selectedAnio}.xlsx`);
    };

    if (isLoading) {
        return (
            <div className="flex justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Controls */}
            <div className="flex flex-wrap items-end gap-3">
                {/* Toggle Mes / Año */}
                <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 shadow-inner">
                    <button
                        onClick={() => setViewMode("mensual")}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-all ${viewMode === "mensual"
                            ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm"
                            : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                            }`}
                    >
                        <CalendarDays className="h-4 w-4" /> Mensual
                    </button>
                    <button
                        onClick={() => setViewMode("anual")}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-all ${viewMode === "anual"
                            ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm"
                            : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                            }`}
                    >
                        <Table2 className="h-4 w-4" /> Anual
                    </button>
                </div>

                {/* Mes (solo vista mensual) */}
                {viewMode === "mensual" && (
                    <div className="min-w-[150px]">
                        <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Mes</Label>
                        <Select value={mesActual.toString()} onValueChange={(v) => cambiarMes(parseInt(v))}>
                            <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {MESES_NOMBRES.map((m, i) => (
                                    <SelectItem key={i + 1} value={(i + 1).toString()}>{m}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}

                <div className="min-w-[110px]">
                    <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Año</Label>
                    <Select value={selectedAnio.toString()} onValueChange={(v) => setSelectedAnio(parseInt(v))}>
                        <SelectTrigger className="rounded-xl">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {[2024, 2025, 2026, 2027].map((a) => (
                                <SelectItem key={a} value={a.toString()}>{a}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="flex gap-2 ml-auto">
                    {viewMode === "anual" && (
                        <Button
                            onClick={() => setShowReal((v) => !v)}
                            className={`rounded-xl font-semibold transition-all ${showReal
                                ? "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-lg shadow-emerald-500/30"
                                : "bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white shadow-lg shadow-rose-500/40"
                                }`}
                        >
                            {showReal ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
                            {showReal ? "Ocultar gastos real" : "Ver gastos real"}
                        </Button>
                    )}
                    <Button
                        variant="outline"
                        onClick={handleExportCSV}
                        className="rounded-xl"
                        disabled={items.length === 0}
                    >
                        <Download className="mr-2 h-4 w-4" />
                        <span className="hidden sm:inline">Exportar Excel</span>
                    </Button>
                    {isAdmin && (
                        <Button
                            onClick={() => setAddDialogOpen(true)}
                            className="rounded-xl bg-orange-600 hover:bg-orange-700"
                        >
                            <Plus className="mr-2 h-4 w-4" />
                            Agregar Ítem
                        </Button>
                    )}
                </div>
            </div>

            {/* ══════════ VISTA MENSUAL ══════════ */}
            {viewMode === "mensual" && (
                <div className="space-y-6 animate-in fade-in duration-300">
                    {/* Navegación de mes + resumen */}
                    <div className="flex items-center justify-between gap-3">
                        <button
                            onClick={() => cambiarMes(mesActual - 1)}
                            disabled={mesActual <= 1}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition"
                            aria-label="Mes anterior"
                        >
                            <ChevronLeft className="h-5 w-5" />
                        </button>
                        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                            {MESES_NOMBRES[mesIdx]} <span className="text-slate-400 font-medium">{selectedAnio}</span>
                        </h2>
                        <button
                            onClick={() => cambiarMes(mesActual + 1)}
                            disabled={mesActual >= 12}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition"
                            aria-label="Mes siguiente"
                        >
                            <ChevronRight className="h-5 w-5" />
                        </button>
                    </div>

                    {/* Tarjetas resumen del mes */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                        <div className="rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-600 p-4 text-white shadow-md">
                            <div className="flex items-center gap-2 text-indigo-100 text-xs font-semibold uppercase tracking-wide">
                                <Wallet className="h-4 w-4" /> Presupuestado
                            </div>
                            <p className="text-2xl font-bold mt-1.5 tabular-nums">{formatCLP(presupuestadoMes)}</p>
                            <p className="text-[11px] text-indigo-200 mt-1">asignado a este mes</p>
                        </div>
                        <div className="rounded-2xl bg-gradient-to-br from-rose-500 to-red-600 p-4 text-white shadow-md">
                            <div className="flex items-center gap-2 text-rose-100 text-xs font-semibold uppercase tracking-wide">
                                <Receipt className="h-4 w-4" /> Gastado
                            </div>
                            <p className="text-2xl font-bold mt-1.5 tabular-nums">{formatCLP(gastadoMes)}</p>
                            <p className="text-[11px] text-rose-200 mt-1">{ejecucionMesPct}% del presupuesto</p>
                        </div>
                        <div className={`rounded-2xl p-4 text-white shadow-md bg-gradient-to-br ${disponibleMes < 0 ? "from-rose-600 to-rose-800" : "from-emerald-500 to-teal-600"}`}>
                            <div className="flex items-center gap-2 text-white/80 text-xs font-semibold uppercase tracking-wide">
                                <PiggyBank className="h-4 w-4" /> {disponibleMes < 0 ? "Sobregiro" : "Disponible"}
                            </div>
                            <p className="text-2xl font-bold mt-1.5 tabular-nums">{formatCLP(Math.abs(disponibleMes))}</p>
                            <p className="text-[11px] text-white/70 mt-1">{disponibleMes < 0 ? "sobre lo presupuestado" : "por gastar este mes"}</p>
                        </div>
                        <div className="rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 p-4 text-white shadow-md">
                            <div className="flex items-center gap-2 text-amber-100 text-xs font-semibold uppercase tracking-wide">
                                <AlertTriangle className="h-4 w-4" /> Gastos extra
                            </div>
                            <p className="text-2xl font-bold mt-1.5 tabular-nums">{formatCLP(extraMes)}</p>
                            <p className="text-[11px] text-amber-200 mt-1">{extrasMes.length} fuera de presupuesto</p>
                        </div>
                    </div>

                    {/* Barra de ejecución global del mes */}
                    {presupuestadoMes > 0 && (
                        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
                            <div className="flex items-center justify-between text-sm mb-2">
                                <span className="font-semibold text-slate-700 dark:text-slate-200">Ejecución del mes</span>
                                <span className={`font-bold ${ejecucionMesPct > 110 ? "text-rose-600" : ejecucionMesPct > 100 ? "text-amber-600" : "text-emerald-600"}`}>
                                    {formatCLP(gastadoMes)} / {formatCLP(presupuestadoMes)}
                                </span>
                            </div>
                            <div className="h-3 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all duration-700 ease-out ${ejecucionMesPct > 110 ? "bg-rose-500" : ejecucionMesPct > 100 ? "bg-amber-500" : "bg-emerald-500"}`}
                                    style={{ width: `${Math.min(100, ejecucionMesPct)}%` }}
                                />
                            </div>
                        </div>
                    )}

                    {/* Detalle por concepto */}
                    {items.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-slate-400 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                            <TrendingUp className="h-12 w-12 mb-4 opacity-30" />
                            <p className="text-lg font-medium">Sin datos de presupuesto</p>
                            <p className="text-sm">Agrega ítems al presupuesto para visualizarlos aquí.</p>
                            {isAdmin && (
                                <Button onClick={() => setAddDialogOpen(true)} className="mt-4 rounded-xl bg-indigo-600 hover:bg-indigo-700">
                                    <Plus className="mr-2 h-4 w-4" /> Agregar Primer Ítem
                                </Button>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-5">
                            {filasMesPorCategoria.map(({ categoria, filas, presupuesto, gastado }) => (
                                <div key={categoria} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
                                    <div className="flex items-center justify-between gap-3 px-4 py-3 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800">
                                        <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">{categoria}</h3>
                                        <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                                            <span className="font-semibold text-slate-700 dark:text-slate-200">{formatCLP(gastado)}</span> / {formatCLP(presupuesto)}
                                        </div>
                                    </div>
                                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {filas.map((f) => {
                                            const col = cumplimientoColor(f.gastado, f.presupuesto);
                                            const pct = f.presupuesto > 0 ? Math.min(100, (f.gastado / f.presupuesto) * 100) : (f.gastado > 0 ? 100 : 0);
                                            const saldo = f.presupuesto - f.gastado;
                                            const sinMovimiento = f.presupuesto === 0 && f.gastado === 0;
                                            return (
                                                <div key={f.id} className={`px-4 py-3 ${sinMovimiento ? "opacity-50" : ""}`}>
                                                    <div className="flex items-center justify-between gap-3">
                                                        <span className="font-medium text-slate-800 dark:text-slate-100 truncate">{f.concepto}</span>
                                                        <div className="flex items-center gap-2 shrink-0">
                                                            {f.gastado > f.presupuesto && f.presupuesto > 0 && (
                                                                <span className="text-[10px] font-bold text-rose-600 bg-rose-50 dark:bg-rose-950/30 px-1.5 py-0.5 rounded">Excedido</span>
                                                            )}
                                                            {f.presupuesto > 0 && f.gastado <= f.presupuesto && f.gastado > 0 && (
                                                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                                                            )}
                                                            <span className={`text-sm font-bold tabular-nums ${col.text}`}>{f.presupuesto > 0 ? col.label : (f.gastado > 0 ? "Nuevo" : "—")}</span>
                                                        </div>
                                                    </div>
                                                    <div className="mt-2 h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                                        <div className={`h-full rounded-full ${col.bar} transition-all duration-700 ease-out`} style={{ width: `${pct}%` }} />
                                                    </div>
                                                    <div className="mt-1.5 flex items-center justify-between text-xs tabular-nums">
                                                        <span className="text-slate-500 dark:text-slate-400">
                                                            Gastado <span className="font-semibold text-slate-700 dark:text-slate-200">{formatCLP(f.gastado)}</span>
                                                            <span className="text-slate-300 dark:text-slate-600"> · </span>
                                                            Presup. {formatCLP(f.presupuesto)}
                                                        </span>
                                                        {f.presupuesto > 0 && (
                                                            <span className={saldo < 0 ? "text-rose-600 font-semibold" : "text-emerald-600 font-semibold"}>
                                                                {saldo < 0 ? `${formatCLP(Math.abs(saldo))} sobre` : `${formatCLP(saldo)} disp.`}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}

                            {/* Gastos extra del mes (fuera del presupuesto) */}
                            <div className="rounded-2xl border-2 border-amber-200 dark:border-amber-900/50 bg-amber-50/40 dark:bg-amber-950/10 shadow-sm overflow-hidden">
                                <div className="flex items-center justify-between gap-3 px-4 py-3 bg-amber-100/60 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-900/50">
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300 inline-flex items-center gap-1.5">
                                        <AlertTriangle className="h-3.5 w-3.5" /> Gastos extra — sin presupuesto asignado
                                    </h3>
                                    <span className="text-xs font-bold text-amber-800 dark:text-amber-300 tabular-nums">{formatCLP(extraMes)}</span>
                                </div>
                                {extrasMes.length === 0 ? (
                                    <p className="px-4 py-5 text-sm text-slate-400 text-center">
                                        No hay gastos extra este mes. Los gastos que registres en la pestaña <span className="font-semibold">Gastos</span> sin asociar a un ítem del presupuesto aparecerán aquí.
                                    </p>
                                ) : (
                                    <div className="divide-y divide-amber-100 dark:divide-amber-900/30">
                                        {extrasMes.map((v) => (
                                            <div key={v.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
                                                <div className="min-w-0">
                                                    <span className="font-medium text-slate-800 dark:text-slate-100 truncate block">{v.concepto}</span>
                                                    <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide">{v.categoria}</span>
                                                </div>
                                                <span className="text-sm font-bold text-rose-600 dark:text-rose-400 tabular-nums shrink-0">{formatCLP(v.gastado)}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ══════════ VISTA ANUAL (tabla Excel) ══════════ */}
            {viewMode === "anual" && (
            <>
            {/* Summary cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="border-0 shadow-md bg-gradient-to-br from-orange-500 to-orange-600 text-white">
                    <CardContent className="pt-6">
                        <p className="text-sm font-medium text-orange-100">Presupuesto Anual {selectedAnio}</p>
                        <p className="text-2xl font-bold mt-1">{formatCLP(totalAnual)}</p>
                        <p className="text-xs text-orange-200 mt-1">{items.length} ítems presupuestados</p>
                    </CardContent>
                </Card>
                <Card className="border-0 shadow-md bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
                    <CardContent className="pt-6">
                        <p className="text-sm font-medium text-emerald-100">Promedio Mensual</p>
                        <p className="text-2xl font-bold mt-1">{formatCLP(Math.round(totalAnual / 12))}</p>
                        <p className="text-xs text-emerald-200 mt-1">por mes promedio</p>
                    </CardContent>
                </Card>
                <Card className="border-0 shadow-md bg-gradient-to-br from-amber-500 to-orange-600 text-white">
                    <CardContent className="pt-6">
                        <p className="text-sm font-medium text-amber-100">Categorías</p>
                        <p className="text-2xl font-bold mt-1">{Object.keys(groupedItems).length}</p>
                        <p className="text-xs text-amber-200 mt-1">
                            {Object.keys(groupedItems).join(", ").substring(0, 40)}...
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Comparativa presupuestado vs. real */}
            {showReal && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in slide-in-from-top-2 duration-500">
                    <Card className="border-0 shadow-md bg-gradient-to-br from-slate-700 to-slate-900 text-white">
                        <CardContent className="pt-6">
                            <p className="text-sm font-medium text-slate-300">Presupuestado {selectedAnio}</p>
                            <p className="text-2xl font-bold mt-1">{formatCLP(totalAnual)}</p>
                        </CardContent>
                    </Card>
                    <Card className="border-0 shadow-md bg-gradient-to-br from-rose-500 to-red-600 text-white">
                        <CardContent className="pt-6">
                            <p className="text-sm font-medium text-rose-100">Gasto Real</p>
                            <p className="text-2xl font-bold mt-1">{formatCLP(realTotalAnual)}</p>
                            <p className="text-xs text-rose-200 mt-1">{ejecucionPct}% del presupuesto</p>
                        </CardContent>
                    </Card>
                    <Card className={`border-0 shadow-md text-white bg-gradient-to-br ${diferenciaAnual < 0 ? "from-rose-600 to-rose-800" : "from-emerald-500 to-teal-600"}`}>
                        <CardContent className="pt-6">
                            <p className="text-sm font-medium text-white/80">{diferenciaAnual < 0 ? "Sobregiro" : "Saldo disponible"}</p>
                            <p className="text-2xl font-bold mt-1">{formatCLP(Math.abs(diferenciaAnual))}</p>
                            <p className="text-xs text-white/70 mt-1">{diferenciaAnual < 0 ? "por sobre lo presupuestado" : "sin gastar aún"}</p>
                        </CardContent>
                    </Card>
                    <Card className="border-0 shadow-md bg-gradient-to-br from-amber-500 to-orange-600 text-white">
                        <CardContent className="pt-6">
                            <p className="text-sm font-medium text-amber-100">Ítems nuevos</p>
                            <p className="text-2xl font-bold mt-1">{formatCLP(virtualTotalAnual)}</p>
                            <p className="text-xs text-amber-200 mt-1">{virtualItems.length} sin presupuesto</p>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Excel-like table */}
            <Card className="border-0 shadow-lg overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-slate-800 to-slate-900 text-white pb-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <TrendingUp className="h-5 w-5" />
                            Presupuesto de Marketing {selectedAnio}
                        </CardTitle>
                        {showReal && (
                            <div className="flex items-center gap-3 text-[11px] font-medium animate-in fade-in duration-500">
                                <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-emerald-500" /> En presupuesto</span>
                                <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-amber-500" /> Al límite</span>
                                <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-rose-500" /> Sobregiro / nuevo</span>
                            </div>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm border-collapse" style={{ minWidth: "1400px", tableLayout: "fixed" }}>
                            <colgroup>
                                <col style={{ width: "200px" }} />
                                {MESES.map((_, i) => (
                                    <col key={i} style={{ width: "90px" }} />
                                ))}
                                <col style={{ width: "110px" }} />
                                {isAdmin && <col style={{ width: "44px" }} />}
                            </colgroup>
                            <thead>
                                <tr className="bg-slate-100 dark:bg-slate-800 border-b-2 border-slate-300 dark:border-slate-600">
                                    <th className="sticky left-0 z-10 bg-slate-100 dark:bg-slate-800 px-4 py-3 text-left font-bold text-slate-700 dark:text-slate-200">
                                        Concepto
                                    </th>
                                    {MESES_CORTO.map((mes, i) => (
                                        <th
                                            key={i}
                                            className={`px-2 py-3 text-right font-bold ${
                                                selectedMes === i + 1
                                                    ? "text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-950/40"
                                                    : "text-slate-700 dark:text-slate-200"
                                            }`}
                                        >
                                            {mes}
                                        </th>
                                    ))}
                                    <th className="px-3 py-3 text-right font-bold text-orange-700 dark:text-orange-300 bg-orange-50 dark:bg-orange-950/30">
                                        Total
                                    </th>
                                    {isAdmin && (
                                        <th className="px-1 py-3 text-center font-bold text-slate-500"></th>
                                    )}
                                </tr>
                            </thead>
                            {Object.entries(groupedItems).map(([category, categoryItems]) => {
                                const catTotals = getCategoryTotals(categoryItems);
                                const realCatMeses = MESES.map((_, i) => categoryItems.reduce((s, it) => s + getItemReal(it.id)[i], 0));
                                const realCatTotal = realCatMeses.reduce((a, b) => a + b, 0);
                                const totalCols = 1 + MESES.length + 1 + (isAdmin ? 1 : 0);
                                return (
                                    <tbody key={category}>
                                        {/* Category header */}
                                        <tr className="bg-gradient-to-r from-orange-50 to-orange-50 dark:from-orange-950/20 dark:to-orange-950/20 border-t-2 border-orange-200 dark:border-orange-800">
                                            <td
                                                colSpan={totalCols}
                                                className="px-4 py-2.5 font-bold text-orange-800 dark:text-orange-200 text-xs uppercase tracking-wider"
                                            >
                                                {category}
                                            </td>
                                        </tr>

                                        {/* Items */}
                                        {categoryItems.map((item, idx) => (
                                            <tr
                                                key={item.id}
                                                className={`border-b border-slate-100 dark:border-slate-800 transition-colors hover:bg-orange-50/50 dark:hover:bg-orange-950/20 ${idx % 2 === 0 ? "bg-white dark:bg-slate-900" : "bg-slate-50/50 dark:bg-slate-900/50"
                                                    }`}
                                            >
                                                {/* Concepto cell */}
                                                <td className="sticky left-0 z-10 bg-inherit px-4 py-2 font-medium text-slate-800 dark:text-slate-200">
                                                    {editingCell?.id === item.id && editingCell.field === "concepto" ? (
                                                        <Input
                                                            ref={inputRef}
                                                            value={editValue}
                                                            onChange={(e) => setEditValue(e.target.value)}
                                                            onBlur={handleConceptoSave}
                                                            onKeyDown={(e) => {
                                                                if (e.key === "Enter") handleConceptoSave();
                                                                if (e.key === "Escape") {
                                                                    setEditingCell(null);
                                                                    setEditValue("");
                                                                }
                                                            }}
                                                            className="h-7 text-sm px-2 rounded-md"
                                                        />
                                                    ) : (
                                                        <span
                                                            className={`truncate block ${isAdmin ? "cursor-pointer hover:text-orange-600 transition-colors" : ""}`}
                                                            onDoubleClick={() => handleConceptoEdit(item.id, item.concepto)}
                                                            title={isAdmin ? "Doble click para editar" : item.concepto}
                                                        >
                                                            {item.concepto}
                                                        </span>
                                                    )}
                                                    {showReal && (() => {
                                                        const b = getRowTotal(item);
                                                        const r = getItemReal(item.id).reduce((a, c) => a + c, 0);
                                                        const col = cumplimientoColor(r, b);
                                                        const pct = b > 0 ? Math.min(100, (r / b) * 100) : (r > 0 ? 100 : 0);
                                                        return (
                                                            <div className="mt-1.5 flex items-center gap-1.5">
                                                                <div className="flex-1 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                                                                    <div
                                                                        className={`h-full rounded-full ${col.bar} origin-left transition-transform duration-700 ease-out`}
                                                                        style={{ transform: `scaleX(${barsIn ? pct / 100 : 0})` }}
                                                                    />
                                                                </div>
                                                                <span className={`text-[10px] font-bold ${col.text}`}>{col.label}</span>
                                                            </div>
                                                        );
                                                    })()}
                                                </td>

                                                {/* Month cells */}
                                                {MESES.map((mes, mi) => {
                                                    const val = parseNum(item[mes as keyof PresupuestoItem] as string);
                                                    const isEditing = editingCell?.id === item.id && editingCell.field === mes;
                                                    const real = showReal ? getItemReal(item.id)[mi] : 0;
                                                    const realCol = cumplimientoColor(real, val);

                                                    return (
                                                        <td
                                                            key={mes}
                                                            className={`px-2 py-2 text-right tabular-nums ${isAdmin
                                                                ? "cursor-pointer hover:bg-orange-100 dark:hover:bg-orange-950/40 transition-colors"
                                                                : ""
                                                                } ${val === 0 ? "text-slate-300 dark:text-slate-600" : "text-slate-700 dark:text-slate-300"}`}
                                                            onClick={() => handleCellClick(item.id, mes, item[mes as keyof PresupuestoItem] as string)}
                                                        >
                                                            {isEditing ? (
                                                                <Input
                                                                    ref={inputRef}
                                                                    type="number"
                                                                    value={editValue}
                                                                    onChange={(e) => setEditValue(e.target.value)}
                                                                    onBlur={handleCellSave}
                                                                    onKeyDown={handleCellKeyDown}
                                                                    className="h-7 text-sm text-right px-1 rounded-md w-full"
                                                                />
                                                            ) : (
                                                                <div className="flex flex-col items-end leading-tight">
                                                                    <span className="text-xs">{formatCLP(val)}</span>
                                                                    {showReal && real > 0 && (
                                                                        <span className={`text-[10px] font-bold animate-in fade-in slide-in-from-bottom-1 duration-500 ${realCol.text}`}>
                                                                            {formatCLP(real)}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </td>
                                                    );
                                                })}

                                                {/* Row total */}
                                                <td className="px-3 py-2 text-right font-semibold text-orange-700 dark:text-orange-300 bg-orange-50/50 dark:bg-orange-950/20 tabular-nums">
                                                    <div className="flex flex-col items-end leading-tight">
                                                        <span className="text-xs">{formatCLP(getRowTotal(item))}</span>
                                                        {showReal && (() => {
                                                            const r = getItemReal(item.id).reduce((a, c) => a + c, 0);
                                                            return r > 0 ? (
                                                                <span className={`text-[10px] font-bold animate-in fade-in duration-500 ${cumplimientoColor(r, getRowTotal(item)).text}`}>
                                                                    {formatCLP(r)}
                                                                </span>
                                                            ) : null;
                                                        })()}
                                                    </div>
                                                </td>

                                                {/* Delete button */}
                                                {isAdmin && (
                                                    <td className="px-1 py-2 text-center">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-7 w-7 p-0 text-slate-400 hover:text-red-500 hover:bg-red-50"
                                                            onClick={() => {
                                                                setDeleteItemId(item.id);
                                                                setDeleteDialogOpen(true);
                                                            }}
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </td>
                                                )}
                                            </tr>
                                        ))}

                                        {/* Category subtotal */}
                                        <tr className="bg-slate-50 dark:bg-slate-800/50 border-b-2 border-slate-200 dark:border-slate-700">
                                            <td className="sticky left-0 z-10 bg-slate-50 dark:bg-slate-800/50 px-4 py-2 font-bold text-xs uppercase text-slate-600 dark:text-slate-300">
                                                Subtotal {category}
                                            </td>
                                            {catTotals.mesesTotals.map((val, i) => (
                                                <td key={i} className="px-2 py-2 text-right font-semibold text-slate-700 dark:text-slate-300 tabular-nums">
                                                    <div className="flex flex-col items-end leading-tight">
                                                        <span className="text-xs">{formatCLP(val)}</span>
                                                        {showReal && realCatMeses[i] > 0 && (
                                                            <span className={`text-[10px] font-bold ${cumplimientoColor(realCatMeses[i], val).text}`}>{formatCLP(realCatMeses[i])}</span>
                                                        )}
                                                    </div>
                                                </td>
                                            ))}
                                            <td className="px-3 py-2 text-right font-bold text-orange-700 dark:text-orange-300 bg-orange-50/50 dark:bg-orange-950/20 tabular-nums">
                                                <div className="flex flex-col items-end leading-tight">
                                                    <span className="text-xs">{formatCLP(catTotals.total)}</span>
                                                    {showReal && realCatTotal > 0 && (
                                                        <span className={`text-[10px] font-bold ${cumplimientoColor(realCatTotal, catTotals.total).text}`}>{formatCLP(realCatTotal)}</span>
                                                    )}
                                                </div>
                                            </td>
                                            {isAdmin && <td></td>}
                                        </tr>
                                    </tbody>
                                );
                            })}

                            {/* Ítems nuevos (gastos sin asignar a un ítem de presupuesto) */}
                            {showReal && virtualItems.length > 0 && (
                                <tbody>
                                    <tr className="bg-gradient-to-r from-amber-50 to-rose-50 dark:from-amber-950/20 dark:to-rose-950/20 border-t-2 border-amber-300 dark:border-amber-800">
                                        <td
                                            colSpan={1 + MESES.length + 1 + (isAdmin ? 1 : 0)}
                                            className="px-4 py-2.5 font-bold text-amber-800 dark:text-amber-200 text-xs uppercase tracking-wider"
                                        >
                                            <span className="inline-flex items-center gap-1.5">
                                                <AlertTriangle className="h-3.5 w-3.5" />
                                                Ítems nuevos — gastos sin presupuesto asignado
                                            </span>
                                        </td>
                                    </tr>
                                    {virtualItems.map((v) => {
                                        const rowReal = v.real.reduce((a, c) => a + c, 0);
                                        return (
                                            <tr key={v.id} className="border-b border-amber-100 dark:border-amber-900/40 bg-amber-50/30 dark:bg-amber-950/10">
                                                <td className="sticky left-0 z-10 bg-inherit px-4 py-2 font-medium text-slate-800 dark:text-slate-200">
                                                    <span className="truncate block">{v.concepto}</span>
                                                    <span className="mt-0.5 inline-block text-[9px] font-semibold text-amber-700 dark:text-amber-300 uppercase tracking-wide">
                                                        {v.categoria} · sin presupuesto
                                                    </span>
                                                </td>
                                                {v.real.map((r, mi) => (
                                                    <td key={mi} className="px-2 py-2 text-right tabular-nums">
                                                        {r > 0 ? (
                                                            <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 animate-in fade-in duration-500">{formatCLP(r)}</span>
                                                        ) : (
                                                            <span className="text-xs text-slate-300 dark:text-slate-600">-</span>
                                                        )}
                                                    </td>
                                                ))}
                                                <td className="px-3 py-2 text-right font-bold text-rose-600 dark:text-rose-400 bg-rose-50/50 dark:bg-rose-950/20 tabular-nums">
                                                    <span className="text-xs">{formatCLP(rowReal)}</span>
                                                </td>
                                                {isAdmin && <td></td>}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            )}

                            {/* Grand total */}
                            <tfoot>
                                <tr className="bg-gradient-to-r from-slate-800 to-slate-900 text-white border-t-2 border-slate-600">
                                    <td className="sticky left-0 z-10 bg-slate-800 px-4 py-3 font-bold text-sm uppercase tracking-wider">
                                        Total General
                                    </td>
                                    {totalesPorMes.map((val, i) => (
                                        <td key={i} className="px-2 py-3 text-right font-bold tabular-nums">
                                            <span className="text-xs">{formatCLP(val)}</span>
                                        </td>
                                    ))}
                                    <td className="px-3 py-3 text-right font-bold bg-orange-700/30 tabular-nums">
                                        <span className="text-sm">{formatCLP(totalAnual)}</span>
                                    </td>
                                    {isAdmin && <td className="bg-slate-800"></td>}
                                </tr>
                                {showReal && (
                                    <tr className="bg-gradient-to-r from-rose-700 to-red-800 text-white">
                                        <td className="sticky left-0 z-10 bg-rose-700 px-4 py-3 font-bold text-sm uppercase tracking-wider">
                                            Gasto Real
                                        </td>
                                        {realTotalesPorMes.map((val, i) => (
                                            <td key={i} className="px-2 py-3 text-right font-bold tabular-nums">
                                                <span className="text-xs">{val > 0 ? formatCLP(val) : "-"}</span>
                                            </td>
                                        ))}
                                        <td className="px-3 py-3 text-right font-bold bg-rose-900/40 tabular-nums">
                                            <span className="text-sm">{formatCLP(realTotalAnual)}</span>
                                        </td>
                                        {isAdmin && <td className="bg-rose-700"></td>}
                                    </tr>
                                )}
                            </tfoot>
                        </table>
                    </div>

                    {items.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                            <TrendingUp className="h-12 w-12 mb-4 opacity-30" />
                            <p className="text-lg font-medium">Sin datos de presupuesto</p>
                            <p className="text-sm">Agrega ítems al presupuesto para visualizarlos aquí.</p>
                            {isAdmin && (
                                <Button
                                    onClick={() => setAddDialogOpen(true)}
                                    className="mt-4 rounded-xl bg-orange-600 hover:bg-orange-700"
                                >
                                    <Plus className="mr-2 h-4 w-4" />
                                    Agregar Primer Ítem
                                </Button>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>
            </>
            )}

            {/* Add dialog */}
            <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Agregar Ítem de Presupuesto</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div>
                            <Label>Concepto</Label>
                            <Input
                                value={newItem.concepto}
                                onChange={(e) => setNewItem({ ...newItem, concepto: e.target.value })}
                                placeholder="Ej: Google Ads"
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <Label>Categoría</Label>
                            <Select
                                value={newItem.categoria}
                                onValueChange={(v) => setNewItem({ ...newItem, categoria: v })}
                            >
                                <SelectTrigger className="mt-1">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {CATEGORIAS.map((cat) => (
                                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                            Cancelar
                        </Button>
                        <Button
                            onClick={handleAddItem}
                            disabled={!newItem.concepto.trim() || createMutation.isPending}
                            className="bg-orange-600 hover:bg-orange-700"
                        >
                            {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Agregar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete confirmation dialog */}
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar este ítem?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción no se puede deshacer. Se eliminará permanentemente esta fila del presupuesto.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => deleteItemId && deleteMutation.mutate(deleteItemId)}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            Eliminar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
