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
import { Plus, Trash2, Loader2, Save, Download, TrendingUp, Eye, EyeOff, AlertTriangle } from "lucide-react";

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

export default function PresupuestoTabMarketing({ userRole }: { userRole: string }) {
    const { toast } = useToast();
    const currentDate = new Date();
    const [selectedAnio, setSelectedAnio] = useState(currentDate.getFullYear());
    const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null);
    const [editValue, setEditValue] = useState("");
    const [addDialogOpen, setAddDialogOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [deleteItemId, setDeleteItemId] = useState<string | null>(null);
    const [newItem, setNewItem] = useState({ concepto: "", categoria: "DIGITAL" });
    const inputRef = useRef<HTMLInputElement>(null);
    // Vista comparativa presupuestado vs. gasto real
    const [showReal, setShowReal] = useState(false);
    const [barsIn, setBarsIn] = useState(false);

    const isAdmin = userRole === "admin" || userRole === "supervisor" || userRole === "marketing";

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

    // Gastos reales del año (para comparar contra el presupuesto)
    const { data: gastosAnio = [] } = useQuery<GastoLite[]>({
        queryKey: ["/api/marketing/gastos/anio", selectedAnio],
        queryFn: async () => {
            const res = await fetch(`/api/marketing/gastos/anio/${selectedAnio}`, { credentials: "include" });
            if (!res.ok) throw new Error("Error al cargar gastos");
            return res.json();
        },
        enabled: showReal, // solo trae los gastos cuando el usuario activa la vista real
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
            <div className="flex flex-wrap items-end gap-4">
                <div className="min-w-[120px]">
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
                    <Button
                        onClick={() => setShowReal((v) => !v)}
                        className={`rounded-xl font-semibold transition-all ${showReal
                            ? "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-lg shadow-emerald-500/30"
                            : "bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white shadow-lg shadow-rose-500/40 animate-pulse"
                            }`}
                    >
                        {showReal ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
                        {showReal ? "Ocultar gastos real" : "Ver gastos real"}
                    </Button>
                    <Button
                        variant="outline"
                        onClick={handleExportCSV}
                        className="rounded-xl"
                        disabled={items.length === 0}
                    >
                        <Download className="mr-2 h-4 w-4" />
                        Exportar Excel
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
                                            className="px-2 py-3 text-right font-bold text-slate-700 dark:text-slate-200"
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
