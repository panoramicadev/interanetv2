import { useState, useEffect, useRef, useCallback } from "react";
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
import { Plus, Trash2, Loader2, Save, Download, TrendingUp } from "lucide-react";

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

const MESES = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
] as const;

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

    const isAdmin = userRole === "admin" || userRole === "supervisor";

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
        let csv = `Concepto,Categoría,${MESES_CORTO.join(",")},Total\n`;
        items.forEach((item) => {
            const vals = MESES.map((m) => parseNum(item[m as keyof PresupuestoItem] as string));
            const total = vals.reduce((a, b) => a + b, 0);
            csv += `"${item.concepto}","${item.categoria || ""}",${vals.join(",")},${total}\n`;
        });
        csv += `"TOTAL","",${totalesPorMes.join(",")},${totalAnual}\n`;

        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `presupuesto-marketing-${selectedAnio}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    if (isLoading) {
        return (
            <div className="flex justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
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
                        variant="outline"
                        onClick={handleExportCSV}
                        className="rounded-xl"
                        disabled={items.length === 0}
                    >
                        <Download className="mr-2 h-4 w-4" />
                        Exportar CSV
                    </Button>
                    {isAdmin && (
                        <Button
                            onClick={() => setAddDialogOpen(true)}
                            className="rounded-xl bg-indigo-600 hover:bg-indigo-700"
                        >
                            <Plus className="mr-2 h-4 w-4" />
                            Agregar Ítem
                        </Button>
                    )}
                </div>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="border-0 shadow-md bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
                    <CardContent className="pt-6">
                        <p className="text-sm font-medium text-indigo-100">Presupuesto Anual {selectedAnio}</p>
                        <p className="text-2xl font-bold mt-1">{formatCLP(totalAnual)}</p>
                        <p className="text-xs text-indigo-200 mt-1">{items.length} ítems presupuestados</p>
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

            {/* Excel-like table */}
            <Card className="border-0 shadow-lg overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-slate-800 to-slate-900 text-white pb-4">
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <TrendingUp className="h-5 w-5" />
                        Presupuesto de Marketing {selectedAnio}
                    </CardTitle>
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
                                    <th className="px-3 py-3 text-right font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/30">
                                        Total
                                    </th>
                                    {isAdmin && (
                                        <th className="px-1 py-3 text-center font-bold text-slate-500"></th>
                                    )}
                                </tr>
                            </thead>
                            {Object.entries(groupedItems).map(([category, categoryItems]) => {
                                const catTotals = getCategoryTotals(categoryItems);
                                const totalCols = 1 + MESES.length + 1 + (isAdmin ? 1 : 0);
                                return (
                                    <tbody key={category}>
                                        {/* Category header */}
                                        <tr className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/20 dark:to-purple-950/20 border-t-2 border-indigo-200 dark:border-indigo-800">
                                            <td
                                                colSpan={totalCols}
                                                className="px-4 py-2.5 font-bold text-indigo-800 dark:text-indigo-200 text-xs uppercase tracking-wider"
                                            >
                                                {category}
                                            </td>
                                        </tr>

                                        {/* Items */}
                                        {categoryItems.map((item, idx) => (
                                            <tr
                                                key={item.id}
                                                className={`border-b border-slate-100 dark:border-slate-800 transition-colors hover:bg-blue-50/50 dark:hover:bg-blue-950/20 ${idx % 2 === 0 ? "bg-white dark:bg-slate-900" : "bg-slate-50/50 dark:bg-slate-900/50"
                                                    }`}
                                            >
                                                {/* Concepto cell */}
                                                <td className="sticky left-0 z-10 bg-inherit px-4 py-2 font-medium text-slate-800 dark:text-slate-200 truncate">
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
                                                            className={isAdmin ? "cursor-pointer hover:text-indigo-600 transition-colors" : ""}
                                                            onDoubleClick={() => handleConceptoEdit(item.id, item.concepto)}
                                                            title={isAdmin ? "Doble click para editar" : ""}
                                                        >
                                                            {item.concepto}
                                                        </span>
                                                    )}
                                                </td>

                                                {/* Month cells */}
                                                {MESES.map((mes) => {
                                                    const val = parseNum(item[mes as keyof PresupuestoItem] as string);
                                                    const isEditing = editingCell?.id === item.id && editingCell.field === mes;

                                                    return (
                                                        <td
                                                            key={mes}
                                                            className={`px-2 py-2 text-right tabular-nums ${isAdmin
                                                                ? "cursor-pointer hover:bg-indigo-100 dark:hover:bg-indigo-950/40 transition-colors"
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
                                                                <span className="text-xs">{formatCLP(val)}</span>
                                                            )}
                                                        </td>
                                                    );
                                                })}

                                                {/* Row total */}
                                                <td className="px-3 py-2 text-right font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50/50 dark:bg-indigo-950/20 tabular-nums">
                                                    <span className="text-xs">{formatCLP(getRowTotal(item))}</span>
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
                                                    <span className="text-xs">{formatCLP(val)}</span>
                                                </td>
                                            ))}
                                            <td className="px-3 py-2 text-right font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50/50 dark:bg-indigo-950/20 tabular-nums">
                                                <span className="text-xs">{formatCLP(catTotals.total)}</span>
                                            </td>
                                            {isAdmin && <td></td>}
                                        </tr>
                                    </tbody>
                                );
                            })}

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
                                    <td className="px-3 py-3 text-right font-bold bg-indigo-700/30 tabular-nums">
                                        <span className="text-sm">{formatCLP(totalAnual)}</span>
                                    </td>
                                    {isAdmin && <td className="bg-slate-800"></td>}
                                </tr>
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
                                    className="mt-4 rounded-xl bg-indigo-600 hover:bg-indigo-700"
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
                            className="bg-indigo-600 hover:bg-indigo-700"
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
