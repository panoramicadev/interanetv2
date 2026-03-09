import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
    Upload,
    FileSpreadsheet,
    Check,
    AlertTriangle,
    Trash2,
    Loader2,
    Download,
    Table2,
    Eye
} from "lucide-react";
import * as XLSX from "xlsx";

interface BudgetRecord {
    anio: number;
    mes: number;
    categoria: string;
    entidad: string;
    monto: string;
}

interface ParsedData {
    year: number;
    records: BudgetRecord[];
    categories: string[];
    summary: { categoria: string; entidades: number; total: number }[];
}

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const MESES_FULL = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

// Known category names in the Excel to detect section headers
const KNOWN_CATEGORIES = [
    "MCT", "PANORAMICA STORE", "CONSTRUCCION", "CONSTRUCCIÓN",
    "CANALES DIGITALES", "FERRETERIAS", "FERRETERÍAS",
    "FABRICACION MODULAR", "FABRICACIÓN MODULAR"
];

const SKIP_ROWS = ["TOTAL", "META"];

export default function PresupuestoVentas() {
    const { toast } = useToast();
    const { user } = useAuth();
    const [parsedData, setParsedData] = useState<ParsedData | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [viewMode, setViewMode] = useState<"upload" | "preview" | "existing">("upload");

    // Fetch existing years
    const { data: availableYears = [] } = useQuery<number[]>({
        queryKey: ["/api/presupuesto-ventas/years"],
    });

    // Fetch existing records for selected year
    const { data: existingRecords = [], isLoading: loadingExisting } = useQuery<any[]>({
        queryKey: ["/api/presupuesto-ventas", selectedYear],
        queryFn: async () => {
            const res = await fetch(`/api/presupuesto-ventas?anio=${selectedYear}`, { credentials: 'include' });
            if (!res.ok) throw new Error("Error al cargar datos");
            return res.json();
        },
    });

    // Bulk import mutation
    const importMutation = useMutation({
        mutationFn: async (records: BudgetRecord[]) => {
            return await apiRequest("POST", "/api/presupuesto-ventas/bulk", { records });
        },
        onSuccess: async (response: any) => {
            const data = await response.json();
            queryClient.invalidateQueries({ queryKey: ["/api/presupuesto-ventas"] });
            queryClient.invalidateQueries({ queryKey: ["/api/presupuesto-ventas/years"] });
            toast({
                title: "Importación exitosa",
                description: data.message || `${data.count} registros importados.`,
            });
            setParsedData(null);
            setViewMode("existing");
        },
        onError: (error: any) => {
            toast({
                title: "Error de importación",
                description: error.message || "No se pudieron importar los datos.",
                variant: "destructive",
            });
        },
    });

    // Delete mutation
    const deleteMutation = useMutation({
        mutationFn: async (anio: number) => {
            return await apiRequest("DELETE", `/api/presupuesto-ventas?anio=${anio}`);
        },
        onSuccess: async (response: any) => {
            const data = await response.json();
            queryClient.invalidateQueries({ queryKey: ["/api/presupuesto-ventas"] });
            queryClient.invalidateQueries({ queryKey: ["/api/presupuesto-ventas/years"] });
            toast({
                title: "Datos eliminados",
                description: data.message,
            });
        },
        onError: (error: any) => {
            toast({
                title: "Error",
                description: error.message || "No se pudieron eliminar los datos.",
                variant: "destructive",
            });
        },
    });

    // Parse Excel file
    const parseExcel = useCallback((file: File) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: "array", raw: true });
                const sheet = workbook.Sheets[workbook.SheetNames[0]];
                const json: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true });

                if (!json || json.length < 3) {
                    toast({ title: "Error", description: "El archivo no tiene suficientes filas.", variant: "destructive" });
                    return;
                }

                // Detect year from title row (row 0 or 1)
                let year = new Date().getFullYear();
                for (let i = 0; i < Math.min(3, json.length); i++) {
                    const row = json[i];
                    if (row) {
                        for (const cell of row) {
                            const cellStr = String(cell || "").toUpperCase();
                            const yearMatch = cellStr.match(/PRESUPUESTO\s+(\d{4})/);
                            if (yearMatch) {
                                year = parseInt(yearMatch[1]);
                                break;
                            }
                            // Also try just a 4-digit number in 2020-2030 range
                            const plainYear = cellStr.match(/\b(202\d|203\d)\b/);
                            if (plainYear) {
                                year = parseInt(plainYear[1]);
                            }
                        }
                    }
                }

                // Parse rows
                const records: BudgetRecord[] = [];
                let currentCategory = "SIN CATEGORÍA";

                for (let rowIdx = 0; rowIdx < json.length; rowIdx++) {
                    const row = json[rowIdx];
                    if (!row || row.length === 0) continue;

                    const firstCell = String(row[0] || "").trim().toUpperCase();
                    const secondCell = String(row[1] || "").trim().toUpperCase();

                    // Skip header/title rows
                    if (firstCell.includes("PRESUPUESTO") || firstCell.includes("ENERO") || secondCell.includes("ENERO")) continue;

                    // Detect category row: cell content matches known categories
                    // Categories are usually just the category name in a cell
                    const cellToCheck = firstCell || secondCell;
                    const matchedCategory = KNOWN_CATEGORIES.find(cat =>
                        cellToCheck === cat || cellToCheck.startsWith(cat)
                    );
                    if (matchedCategory) {
                        currentCategory = matchedCategory;
                        continue;
                    }

                    // Skip META row always
                    if (firstCell === "META" || secondCell === "META") {
                        continue;
                    }

                    // Skip TOTAL rows (except for FABRICACION MODULAR which only has a total)
                    if (firstCell === "TOTAL" || secondCell === "TOTAL") {
                        if (!currentCategory.includes("FABRICACION MODULAR") && !currentCategory.includes("FABRICACIÓN MODULAR")) {
                            continue;
                        }
                    }

                    // Skip empty or numeric-only first cells (empty rows)
                    // Check if this row has a name in column A or B and month values
                    let entityName = "";
                    let monthStartCol = -1;

                    // Entity name could be in column A (index 0) or column B (index 1)
                    if (firstCell && !firstCell.match(/^\$?[\d.,]+$/)) {
                        entityName = row[0] ? String(row[0]).trim() : "";
                        // Los meses empiezan directamente en la próxima columna
                        monthStartCol = 1;
                    } else if (secondCell && !secondCell.match(/^\$?[\d.,]+$/)) {
                        entityName = row[1] ? String(row[1]).trim() : "";
                        // Los meses empiezan directamente en la próxima columna
                        monthStartCol = 2;
                    }

                    if (!entityName || monthStartCol === -1) continue;

                    // Extract 12 months of data
                    for (let m = 0; m < 12; m++) {
                        const colIdx = monthStartCol + m;
                        if (colIdx >= row.length) break;
                        const rawVal = row[colIdx];
                        let monto = 0;
                        if (rawVal !== null && rawVal !== undefined && rawVal !== "") {
                            // Handle formatted numbers like "$15.000.000" or plain numbers
                            let cleaned = String(rawVal).replace(/[$\s]/g, "");

                            // Si el string incluye comas y puntos (ej. 1,500.50 o 1.500,50), estandarizamos
                            // Caso CL/ES: 15.000.000,00 -> removemos puntos, cambiamos coma a punto
                            if (cleaned.includes('.') && cleaned.includes(',')) {
                                const lastDotIdx = cleaned.lastIndexOf('.');
                                const lastCommaIdx = cleaned.lastIndexOf(',');
                                if (lastCommaIdx > lastDotIdx) {
                                    // Formato EU: 1.000.000,00
                                    cleaned = cleaned.replace(/\./g, "").replace(",", ".");
                                } else {
                                    // Formato US: 1,000,000.00
                                    cleaned = cleaned.replace(/,/g, "");
                                }
                            } else if (cleaned.includes('.')) {
                                // Si solo hay puntos pero varios (ej: 15.000.000), son separadores de miles
                                const parts = cleaned.split('.');
                                if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
                                    cleaned = cleaned.replace(/\./g, "");
                                }
                                // De lo contrario es un punto decimal: 1500.50 (se deja igual)
                            } else if (cleaned.includes(',')) {
                                // Si solo hay comas pero varias (15,000,000) o una al final (1500,50)
                                const parts = cleaned.split(',');
                                if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
                                    cleaned = cleaned.replace(/,/g, "");
                                } else {
                                    cleaned = cleaned.replace(",", ".");
                                }
                            }

                            monto = parseFloat(cleaned) || 0;
                        }

                        if (monto > 0) {
                            records.push({
                                anio: year,
                                mes: m + 1,
                                categoria: currentCategory,
                                entidad: entityName,
                                monto: monto.toString(),
                            });
                        }
                    }
                }

                if (records.length === 0) {
                    toast({ title: "Error", description: "No se encontraron datos válidos en el archivo.", variant: "destructive" });
                    return;
                }

                // Build summary
                const catMap = new Map<string, { entidades: Set<string>; total: number }>();
                records.forEach((r) => {
                    if (!catMap.has(r.categoria)) {
                        catMap.set(r.categoria, { entidades: new Set(), total: 0 });
                    }
                    const entry = catMap.get(r.categoria)!;
                    entry.entidades.add(r.entidad);
                    entry.total += parseFloat(r.monto);
                });

                const summary = Array.from(catMap.entries()).map(([categoria, data]) => ({
                    categoria,
                    entidades: data.entidades.size,
                    total: data.total,
                }));

                const categories = Array.from(catMap.keys());

                setParsedData({ year, records, categories, summary });
                setSelectedYear(year);
                setViewMode("preview");

                toast({
                    title: "Archivo procesado",
                    description: `${records.length} registros encontrados para el año ${year}.`,
                });
            } catch (err: any) {
                console.error("Error parsing Excel:", err);
                toast({
                    title: "Error al leer archivo",
                    description: err.message || "No se pudo procesar el archivo Excel.",
                    variant: "destructive",
                });
            }
        };
        reader.readAsArrayBuffer(file);
    }, [toast]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) parseExcel(file);
        e.target.value = ""; // Reset to allow re-upload
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file && (file.name.endsWith(".xlsx") || file.name.endsWith(".xls") || file.name.endsWith(".csv"))) {
            parseExcel(file);
        } else {
            toast({ title: "Formato inválido", description: "Solo se aceptan archivos .xlsx, .xls o .csv", variant: "destructive" });
        }
    };

    const handleImport = () => {
        if (!parsedData) return;
        importMutation.mutate(parsedData.records);
    };

    const handleDelete = (anio: number) => {
        if (confirm(`¿Estás seguro de que deseas eliminar todo el presupuesto del año ${anio}?`)) {
            deleteMutation.mutate(anio);
        }
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat("es-CL", {
            style: "currency",
            currency: "CLP",
            minimumFractionDigits: 0,
        }).format(amount);
    };

    // Group existing records for table display
    const existingGrouped = useMemo(() => {
        if (!existingRecords.length) return [];
        const map = new Map<string, Map<string, number[]>>();

        existingRecords.forEach((r: any) => {
            if (!map.has(r.categoria)) map.set(r.categoria, new Map());
            const catMap = map.get(r.categoria)!;
            if (!catMap.has(r.entidad)) catMap.set(r.entidad, new Array(12).fill(0));
            const months = catMap.get(r.entidad)!;
            months[r.mes - 1] = parseFloat(r.monto) || 0;
        });

        return Array.from(map.entries()).map(([categoria, entidades]) => ({
            categoria,
            entidades: Array.from(entidades.entries()).map(([entidad, montos]) => ({
                entidad,
                montos,
                total: montos.reduce((a, b) => a + b, 0),
            })),
        }));
    }, [existingRecords]);

    // Group preview data for table display
    const previewGrouped = useMemo(() => {
        if (!parsedData) return [];
        const map = new Map<string, Map<string, number[]>>();

        parsedData.records.forEach((r) => {
            if (!map.has(r.categoria)) map.set(r.categoria, new Map());
            const catMap = map.get(r.categoria)!;
            if (!catMap.has(r.entidad)) catMap.set(r.entidad, new Array(12).fill(0));
            const months = catMap.get(r.entidad)!;
            months[r.mes - 1] = parseFloat(r.monto) || 0;
        });

        return Array.from(map.entries()).map(([categoria, entidades]) => ({
            categoria,
            entidades: Array.from(entidades.entries()).map(([entidad, montos]) => ({
                entidad,
                montos,
                total: montos.reduce((a, b) => a + b, 0),
            })),
        }));
    }, [parsedData]);

    const isAdmin = user?.role === "admin" || user?.role === "supervisor";

    return (
        <div className="min-h-screen bg-background">
            <header className="bg-card border-b border-border px-4 lg:px-6 py-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                        <h1 className="text-xl lg:text-2xl font-bold text-foreground">
                            Presupuesto de Ventas
                        </h1>
                        <p className="text-muted-foreground text-sm">
                            Importación y visualización del presupuesto anual por categoría y entidad
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant={viewMode === "upload" ? "default" : "outline"}
                            size="sm"
                            onClick={() => setViewMode("upload")}
                        >
                            <Upload className="h-4 w-4 mr-1" />
                            Importar
                        </Button>
                        <Button
                            variant={viewMode === "existing" ? "default" : "outline"}
                            size="sm"
                            onClick={() => setViewMode("existing")}
                        >
                            <Table2 className="h-4 w-4 mr-1" />
                            Ver Datos
                        </Button>
                    </div>
                </div>
            </header>

            <main className="p-4 lg:p-6 space-y-6">
                {/* Upload Zone */}
                {viewMode === "upload" && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <FileSpreadsheet className="h-5 w-5 text-green-600" />
                                Subir Archivo de Presupuesto
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div
                                className={`border-2 border-dashed rounded-xl p-8 sm:p-12 text-center transition-colors cursor-pointer
                  ${isDragging
                                        ? "border-primary bg-primary/5"
                                        : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30"
                                    }`}
                                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                                onDragLeave={() => setIsDragging(false)}
                                onDrop={handleDrop}
                                onClick={() => document.getElementById("file-input")?.click()}
                            >
                                <Upload className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
                                <p className="text-sm font-medium mb-1">
                                    Arrastra tu archivo Excel / CSV aquí o haz clic para seleccionar
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    Formato: .xlsx, .xls, o .csv — Estructura esperada: Categorías como secciones, entidades como filas, meses como columnas
                                </p>
                                <input
                                    id="file-input"
                                    type="file"
                                    accept=".xlsx,.xls,.csv"
                                    className="hidden"
                                    onChange={handleFileChange}
                                />
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Preview Mode */}
                {viewMode === "preview" && parsedData && (
                    <>
                        {/* Summary */}
                        <Card className="border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20">
                            <CardHeader className="pb-3">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <CardTitle className="flex items-center gap-2 text-lg">
                                        <Eye className="h-5 w-5 text-green-600" />
                                        Vista previa — Presupuesto {parsedData.year}
                                    </CardTitle>
                                    <div className="flex gap-2">
                                        <Button variant="outline" size="sm" onClick={() => { setParsedData(null); setViewMode("upload"); }}>
                                            Cancelar
                                        </Button>
                                        <Button
                                            size="sm"
                                            onClick={handleImport}
                                            disabled={importMutation.isPending}
                                            className="bg-green-600 hover:bg-green-700"
                                        >
                                            {importMutation.isPending ? (
                                                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                            ) : (
                                                <Check className="h-4 w-4 mr-1" />
                                            )}
                                            Importar {parsedData.records.length} registros
                                        </Button>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                                    {parsedData.summary.map((s) => (
                                        <div key={s.categoria} className="bg-white dark:bg-gray-900 rounded-lg p-3 border">
                                            <p className="text-xs font-semibold text-muted-foreground truncate">{s.categoria}</p>
                                            <p className="text-sm font-bold mt-1">{formatCurrency(s.total)}</p>
                                            <p className="text-xs text-muted-foreground">{s.entidades} entidades</p>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Preview Table */}
                        {previewGrouped.map((group) => (
                            <Card key={group.categoria}>
                                <CardHeader className="py-3 bg-muted/30">
                                    <CardTitle className="text-sm flex items-center gap-2">
                                        <Badge variant="outline">{group.categoria}</Badge>
                                        <span className="text-muted-foreground text-xs">
                                            {group.entidades.length} entidades
                                        </span>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-xs">
                                            <thead>
                                                <tr className="border-b bg-muted/20">
                                                    <th className="px-3 py-2 text-left font-semibold min-w-[140px] sticky left-0 bg-white dark:bg-gray-950 z-10">Entidad</th>
                                                    {MESES.map((m) => (
                                                        <th key={m} className="px-2 py-2 text-right font-semibold min-w-[80px]">{m}</th>
                                                    ))}
                                                    <th className="px-3 py-2 text-right font-bold min-w-[100px] bg-muted/10">Total</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {group.entidades.map((ent) => (
                                                    <tr key={ent.entidad} className="border-b hover:bg-muted/10">
                                                        <td className="px-3 py-2 font-medium sticky left-0 bg-white dark:bg-gray-950 z-10">{ent.entidad}</td>
                                                        {ent.montos.map((m, i) => (
                                                            <td key={i} className="px-2 py-2 text-right tabular-nums">
                                                                {m > 0 ? formatCurrency(m) : <span className="text-muted-foreground">-</span>}
                                                            </td>
                                                        ))}
                                                        <td className="px-3 py-2 text-right font-bold tabular-nums bg-muted/10">
                                                            {formatCurrency(ent.total)}
                                                        </td>
                                                    </tr>
                                                ))}
                                                {/* Subtotal row */}
                                                <tr className="border-t-2 font-bold bg-muted/20">
                                                    <td className="px-3 py-2 sticky left-0 bg-muted/20 z-10">TOTAL</td>
                                                    {Array.from({ length: 12 }, (_, mIdx) => {
                                                        const monthTotal = group.entidades.reduce((sum, e) => sum + e.montos[mIdx], 0);
                                                        return (
                                                            <td key={mIdx} className="px-2 py-2 text-right tabular-nums">
                                                                {formatCurrency(monthTotal)}
                                                            </td>
                                                        );
                                                    })}
                                                    <td className="px-3 py-2 text-right tabular-nums bg-muted/10">
                                                        {formatCurrency(group.entidades.reduce((sum, e) => sum + e.total, 0))}
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}

                        {/* Grand Total across all categories */}
                        {previewGrouped.length > 0 && (
                            <Card className="border-primary/30 bg-primary/5">
                                <CardHeader className="py-3 bg-primary/10">
                                    <CardTitle className="text-sm flex items-center gap-2">
                                        <Badge className="bg-primary text-primary-foreground">TOTAL GENERAL</Badge>
                                        <span className="text-muted-foreground text-xs">
                                            {previewGrouped.length} segmentos
                                        </span>
                                        <span className="text-foreground text-xs font-bold ml-auto">
                                            Total: {formatCurrency(previewGrouped.reduce((sum, g) => sum + g.entidades.reduce((s, e) => s + e.total, 0), 0))}
                                        </span>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-xs">
                                            <thead>
                                                <tr className="border-b bg-muted/20">
                                                    <th className="px-3 py-2 text-left font-semibold min-w-[140px] sticky left-0 bg-white dark:bg-gray-950 z-10">Segmento</th>
                                                    {MESES.map((m) => (
                                                        <th key={m} className="px-2 py-2 text-right font-semibold min-w-[80px]">{m}</th>
                                                    ))}
                                                    <th className="px-3 py-2 text-right font-bold min-w-[100px] bg-muted/10">Total</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {previewGrouped.map((group) => {
                                                    const segMonths = Array.from({ length: 12 }, (_, mIdx) =>
                                                        group.entidades.reduce((sum, e) => sum + e.montos[mIdx], 0)
                                                    );
                                                    const segTotal = group.entidades.reduce((sum, e) => sum + e.total, 0);
                                                    return (
                                                        <tr key={group.categoria} className="border-b hover:bg-muted/10">
                                                            <td className="px-3 py-2 font-medium sticky left-0 bg-white dark:bg-gray-950 z-10">{group.categoria}</td>
                                                            {segMonths.map((m, i) => (
                                                                <td key={i} className="px-2 py-2 text-right tabular-nums">
                                                                    {m > 0 ? formatCurrency(m) : <span className="text-muted-foreground">-</span>}
                                                                </td>
                                                            ))}
                                                            <td className="px-3 py-2 text-right font-bold tabular-nums bg-muted/10">
                                                                {formatCurrency(segTotal)}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                                <tr className="border-t-2 font-bold bg-primary/10">
                                                    <td className="px-3 py-2 sticky left-0 bg-primary/10 z-10">TOTAL GENERAL</td>
                                                    {Array.from({ length: 12 }, (_, mIdx) => {
                                                        const grandMonthTotal = previewGrouped.reduce((sum, g) =>
                                                            sum + g.entidades.reduce((s, e) => s + e.montos[mIdx], 0), 0
                                                        );
                                                        return (
                                                            <td key={mIdx} className="px-2 py-2 text-right tabular-nums">
                                                                {formatCurrency(grandMonthTotal)}
                                                            </td>
                                                        );
                                                    })}
                                                    <td className="px-3 py-2 text-right tabular-nums bg-muted/10">
                                                        {formatCurrency(previewGrouped.reduce((sum, g) => sum + g.entidades.reduce((s, e) => s + e.total, 0), 0))}
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </>
                )}

                {/* Existing Data View */}
                {viewMode === "existing" && (
                    <>
                        <Card>
                            <CardHeader className="pb-3">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <CardTitle className="text-lg">Presupuesto Cargado</CardTitle>
                                    <div className="flex items-center gap-2">
                                        <Select
                                            value={selectedYear.toString()}
                                            onValueChange={(v) => setSelectedYear(parseInt(v))}
                                        >
                                            <SelectTrigger className="w-[120px]">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {(availableYears.length > 0 ? availableYears : [new Date().getFullYear()]).map((y) => (
                                                    <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        {isAdmin && existingRecords.length > 0 && (
                                            <Button
                                                variant="destructive"
                                                size="sm"
                                                onClick={() => handleDelete(selectedYear)}
                                                disabled={deleteMutation.isPending}
                                            >
                                                {deleteMutation.isPending ? (
                                                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                                ) : (
                                                    <Trash2 className="h-4 w-4 mr-1" />
                                                )}
                                                Eliminar Año
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </CardHeader>
                        </Card>

                        {loadingExisting ? (
                            <Card>
                                <CardContent className="p-8 text-center">
                                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-muted-foreground" />
                                    <p className="text-sm text-muted-foreground">Cargando datos...</p>
                                </CardContent>
                            </Card>
                        ) : existingGrouped.length === 0 ? (
                            <Card>
                                <CardContent className="p-8 text-center">
                                    <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                                    <h3 className="text-lg font-semibold mb-2">No hay presupuesto cargado</h3>
                                    <p className="text-sm text-muted-foreground mb-4">
                                        Sube un archivo Excel para importar el presupuesto del año {selectedYear}
                                    </p>
                                    <Button onClick={() => setViewMode("upload")}>
                                        <Upload className="h-4 w-4 mr-2" />
                                        Importar Presupuesto
                                    </Button>
                                </CardContent>
                            </Card>
                        ) : (
                            <>
                                {existingGrouped.map((group) => (
                                    <Card key={group.categoria}>
                                        <CardHeader className="py-3 bg-muted/30">
                                            <CardTitle className="text-sm flex items-center gap-2">
                                                <Badge variant="secondary">{group.categoria}</Badge>
                                                <span className="text-muted-foreground text-xs">
                                                    {group.entidades.length} entidades
                                                </span>
                                                <span className="text-muted-foreground text-xs ml-auto">
                                                    Total: {formatCurrency(group.entidades.reduce((sum, e) => sum + e.total, 0))}
                                                </span>
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="p-0">
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-xs">
                                                    <thead>
                                                        <tr className="border-b bg-muted/20">
                                                            <th className="px-3 py-2 text-left font-semibold min-w-[140px] sticky left-0 bg-white dark:bg-gray-950 z-10">Entidad</th>
                                                            {MESES.map((m) => (
                                                                <th key={m} className="px-2 py-2 text-right font-semibold min-w-[80px]">{m}</th>
                                                            ))}
                                                            <th className="px-3 py-2 text-right font-bold min-w-[100px] bg-muted/10">Total</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {group.entidades.map((ent) => (
                                                            <tr key={ent.entidad} className="border-b hover:bg-muted/10">
                                                                <td className="px-3 py-2 font-medium sticky left-0 bg-white dark:bg-gray-950 z-10">{ent.entidad}</td>
                                                                {ent.montos.map((m, i) => (
                                                                    <td key={i} className="px-2 py-2 text-right tabular-nums">
                                                                        {m > 0 ? formatCurrency(m) : <span className="text-muted-foreground">-</span>}
                                                                    </td>
                                                                ))}
                                                                <td className="px-3 py-2 text-right font-bold tabular-nums bg-muted/10">
                                                                    {formatCurrency(ent.total)}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                        <tr className="border-t-2 font-bold bg-muted/20">
                                                            <td className="px-3 py-2 sticky left-0 bg-muted/20 z-10">TOTAL</td>
                                                            {Array.from({ length: 12 }, (_, mIdx) => {
                                                                const monthTotal = group.entidades.reduce((sum, e) => sum + e.montos[mIdx], 0);
                                                                return (
                                                                    <td key={mIdx} className="px-2 py-2 text-right tabular-nums">
                                                                        {formatCurrency(monthTotal)}
                                                                    </td>
                                                                );
                                                            })}
                                                            <td className="px-3 py-2 text-right tabular-nums bg-muted/10">
                                                                {formatCurrency(group.entidades.reduce((sum, e) => sum + e.total, 0))}
                                                            </td>
                                                        </tr>
                                                    </tbody>
                                                </table>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}

                                {/* Grand Total across all categories */}
                                <Card className="border-primary/30 bg-primary/5">
                                    <CardHeader className="py-3 bg-primary/10">
                                        <CardTitle className="text-sm flex items-center gap-2">
                                            <Badge className="bg-primary text-primary-foreground">TOTAL GENERAL</Badge>
                                            <span className="text-muted-foreground text-xs">
                                                {existingGrouped.length} segmentos
                                            </span>
                                            <span className="text-foreground text-xs font-bold ml-auto">
                                                Total: {formatCurrency(existingGrouped.reduce((sum, g) => sum + g.entidades.reduce((s, e) => s + e.total, 0), 0))}
                                            </span>
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-0">
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-xs">
                                                <thead>
                                                    <tr className="border-b bg-muted/20">
                                                        <th className="px-3 py-2 text-left font-semibold min-w-[140px] sticky left-0 bg-white dark:bg-gray-950 z-10">Segmento</th>
                                                        {MESES.map((m) => (
                                                            <th key={m} className="px-2 py-2 text-right font-semibold min-w-[80px]">{m}</th>
                                                        ))}
                                                        <th className="px-3 py-2 text-right font-bold min-w-[100px] bg-muted/10">Total</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {existingGrouped.map((group) => {
                                                        const segMonths = Array.from({ length: 12 }, (_, mIdx) =>
                                                            group.entidades.reduce((sum, e) => sum + e.montos[mIdx], 0)
                                                        );
                                                        const segTotal = group.entidades.reduce((sum, e) => sum + e.total, 0);
                                                        return (
                                                            <tr key={group.categoria} className="border-b hover:bg-muted/10">
                                                                <td className="px-3 py-2 font-medium sticky left-0 bg-white dark:bg-gray-950 z-10">{group.categoria}</td>
                                                                {segMonths.map((m, i) => (
                                                                    <td key={i} className="px-2 py-2 text-right tabular-nums">
                                                                        {m > 0 ? formatCurrency(m) : <span className="text-muted-foreground">-</span>}
                                                                    </td>
                                                                ))}
                                                                <td className="px-3 py-2 text-right font-bold tabular-nums bg-muted/10">
                                                                    {formatCurrency(segTotal)}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                    <tr className="border-t-2 font-bold bg-primary/10">
                                                        <td className="px-3 py-2 sticky left-0 bg-primary/10 z-10">TOTAL GENERAL</td>
                                                        {Array.from({ length: 12 }, (_, mIdx) => {
                                                            const grandMonthTotal = existingGrouped.reduce((sum, g) =>
                                                                sum + g.entidades.reduce((s, e) => s + e.montos[mIdx], 0), 0
                                                            );
                                                            return (
                                                                <td key={mIdx} className="px-2 py-2 text-right tabular-nums">
                                                                    {formatCurrency(grandMonthTotal)}
                                                                </td>
                                                            );
                                                        })}
                                                        <td className="px-3 py-2 text-right tabular-nums bg-muted/10">
                                                            {formatCurrency(existingGrouped.reduce((sum, g) => sum + g.entidades.reduce((s, e) => s + e.total, 0), 0))}
                                                        </td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                    </CardContent>
                                </Card>
                            </>
                        )}
                    </>
                )}
            </main>
        </div>
    );
}
