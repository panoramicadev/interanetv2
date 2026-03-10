import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
    Search, ChevronDown, ChevronRight, Package, Palette,
    Weight, Ruler, Box, Truck, Info, Loader2, Upload
} from "lucide-react";

interface Variant {
    ecomId: string;
    sku: string;
    name: string;
    color: string | null;
    unit: string | null;
    groupName: string | null;
    price: string | null;
    priceList: string | null;
    minUnit: number;
    stepSize: number;
    variantIndex: number;
    isMainVariant: boolean;
    description: string | null;
    dimensions: {
        weight: string | null; weightUnit: string | null;
        length: string | null; lengthUnit: string | null;
        width: string | null; widthUnit: string | null;
        height: string | null; heightUnit: string | null;
        volume: string | null; volumeUnit: string | null;
    };
    packaging: {
        packageName: string | null; packageUnit: string | null; amountPerPackage: number | null;
        boxName: string | null; boxUnit: string | null; amountPerBox: number | null;
        palletName: string | null; palletUnit: string | null; amountPerPallet: number | null;
    };
}

interface GenericProduct {
    genericName: string;
    parentSku: string | null;
    groupName: string | null;
    formats: { [key: string]: Variant[] };
}

interface CatalogResponse {
    catalog: GenericProduct[];
    availableGroups: string[];
    totalProducts: number;
}

function getGroupColor(groupName: string | null): string {
    const colors: Record<string, string> = {
        "Esmalte al Agua": "bg-blue-500/10 text-blue-400 border-blue-500/30",
        "Pintura para Metales": "bg-orange-500/10 text-orange-400 border-orange-500/30",
        "Oleo": "bg-amber-500/10 text-amber-400 border-amber-500/30",
        "Latex": "bg-green-500/10 text-green-400 border-green-500/30",
        "Barnices": "bg-yellow-600/10 text-yellow-500 border-yellow-600/30",
        "Texturas": "bg-purple-500/10 text-purple-400 border-purple-500/30",
        "Pasta": "bg-pink-500/10 text-pink-400 border-pink-500/30",
        "Sellador": "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
        "Pinturas Especiales": "bg-indigo-500/10 text-indigo-400 border-indigo-500/30",
    };
    return colors[groupName || ""] || "bg-muted text-muted-foreground";
}

function formatPrice(p: string | number | null) {
    if (!p || p === "0") return "—";
    const n = typeof p === "string" ? parseFloat(p) : p;
    return `$${n.toLocaleString("es-CL")}`;
}

function DimensionsInfo({ d }: { d: Variant["dimensions"] }) {
    const items = [
        d.weight && `${d.weight} ${d.weightUnit || "kg"}`,
        d.length && `${d.length}×${d.width || "?"}×${d.height || "?"} ${d.lengthUnit || "cm"}`,
    ].filter(Boolean);

    if (items.length === 0) return null;
    return (
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {d.weight && (
                <span className="flex items-center gap-1">
                    <Weight className="h-3 w-3" /> {d.weight} {d.weightUnit || "kg"}
                </span>
            )}
            {d.length && (
                <span className="flex items-center gap-1">
                    <Ruler className="h-3 w-3" /> {d.length}×{d.width}×{d.height} {d.lengthUnit || "cm"}
                </span>
            )}
        </div>
    );
}

function PackagingInfo({ p }: { p: Variant["packaging"] }) {
    const formats = [
        p.amountPerPackage && { name: p.packageName || "Display", qty: p.amountPerPackage },
        p.amountPerBox && { name: p.boxName || "Caja", qty: p.amountPerBox },
        p.amountPerPallet && { name: p.palletName || "Pallet", qty: p.amountPerPallet },
    ].filter(Boolean) as { name: string; qty: number }[];

    if (formats.length === 0) return null;

    return (
        <div className="flex items-center gap-2">
            {formats.map((f, i) => (
                <span key={i}>
                    <Badge variant="outline" className="text-xs font-normal">
                        <Truck className="h-3 w-3 mr-1" />
                        {f.name}: {f.qty} uds
                    </Badge>
                    {i < formats.length - 1 && <span className="text-muted-foreground mx-1">→</span>}
                </span>
            ))}
        </div>
    );
}

// Parse CSV handling quoted fields with commas
function parseGroupedCSV(text: string): Record<string, string>[] {
    const lines = text.split('\n').filter(l => l.trim());
    if (lines.length < 2) return [];

    // Parse a CSV line respecting quotes
    const parseLine = (line: string): string[] => {
        const result: string[] = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"') {
                inQuotes = !inQuotes;
            } else if (ch === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += ch;
            }
        }
        result.push(current.trim());
        return result;
    };

    const headers = parseLine(lines[0]);
    const rows: Record<string, string>[] = [];
    for (let i = 1; i < lines.length; i++) {
        const values = parseLine(lines[i]);
        const row: Record<string, string> = {};
        headers.forEach((h, idx) => {
            row[h] = values[idx] || '';
        });
        rows.push(row);
    }
    return rows;
}

export default function GroupedCatalog() {
    const [search, setSearch] = useState("");
    const [groupFilter, setGroupFilter] = useState("all");
    const [selectedFormats, setSelectedFormats] = useState<Set<string>>(new Set());
    const [expandedVariants, setExpandedVariants] = useState<Set<string>>(new Set());
    const [, setLocation] = useLocation();
    const { toast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const { data, isLoading } = useQuery<CatalogResponse>({
        queryKey: ["/api/products/grouped-catalog", { search, groupFilter }],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (search) params.set("search", search);
            if (groupFilter !== "all") params.set("groupFilter", groupFilter);
            const res = await apiRequest("GET", `/api/products/grouped-catalog?${params}`);
            return res.json();
        },
    });

    // Import mutation
    const importMutation = useMutation({
        mutationFn: async (products: Record<string, string>[]) => {
            const res = await apiRequest("POST", "/api/products/import-grouped-catalog", { products });
            return res.json();
        },
        onSuccess: (data: any) => {
            queryClient.invalidateQueries({ queryKey: ["/api/products/grouped-catalog"] });
            toast({
                title: "Importación completada",
                description: `${data.imported} productos importados, ${data.skipped} omitidos de ${data.total} filas.`,
            });
        },
        onError: () => {
            toast({
                variant: "destructive",
                title: "Error",
                description: "No se pudo importar el catálogo CSV.",
            });
        },
    });

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const text = await file.text();
            const rows = parseGroupedCSV(text);
            if (rows.length === 0) {
                toast({ variant: "destructive", title: "CSV vacío", description: "El archivo no contiene datos válidos." });
                return;
            }
            importMutation.mutate(rows);
        } catch {
            toast({ variant: "destructive", title: "Error", description: "No se pudo leer el archivo CSV." });
        }
        // Reset the input so the same file can be re-imported
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const catalog = data?.catalog || [];
    const availableGroups = data?.availableGroups || [];

    const toggleFormat = (key: string) => {
        setSelectedFormats(prev => {
            const s = new Set(prev);
            s.has(key) ? s.delete(key) : s.add(key);
            return s;
        });
    };

    const toggleVariant = (sku: string) => {
        setExpandedVariants(prev => {
            const s = new Set(prev);
            s.has(sku) ? s.delete(sku) : s.add(sku);
            return s;
        });
    };

    const expandAll = () => {
        const allFormats = new Set<string>();
        catalog.forEach(p => {
            Object.keys(p.formats).forEach(f => {
                allFormats.add(`${p.genericName}::${f}`);
            });
        });
        setSelectedFormats(allFormats);
    };

    const collapseAll = () => {
        setSelectedFormats(new Set());
        setExpandedVariants(new Set());
    };

    return (
        <div className="space-y-4">
            <Card>
                <CardContent className="pt-6">
                    <div className="flex flex-col sm:flex-row gap-4">
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar por SKU, nombre o color..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                        <Select value={groupFilter} onValueChange={setGroupFilter}>
                            <SelectTrigger className="w-[220px]">
                                <SelectValue placeholder="Todas las categorías" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todas las categorías</SelectItem>
                                {availableGroups.map(g => (
                                    <SelectItem key={g} value={g}>{g}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={expandAll}>Expandir todo</Button>
                            <Button variant="outline" size="sm" onClick={collapseAll}>Colapsar todo</Button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".csv"
                                className="hidden"
                                onChange={handleFileChange}
                            />
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={importMutation.isPending}
                                className="gap-1.5"
                            >
                                {importMutation.isPending ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                    <Upload className="h-3.5 w-3.5" />
                                )}
                                {importMutation.isPending ? "Importando..." : "Importar CSV"}
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                    <Package className="h-4 w-4" />
                    {catalog.length} producto{catalog.length !== 1 ? "s" : ""}
                </span>
                <span className="flex items-center gap-1">
                    <Palette className="h-4 w-4" />
                    {data?.totalProducts || 0} SKUs totales
                </span>
            </div>

            {isLoading && (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-muted-foreground">Cargando catálogo...</span>
                </div>
            )}

            {!isLoading && catalog.map(product => {
                const formatKeys = Object.keys(product.formats);
                const selectedFormatKey = selectedFormats.has(product.genericName)
                    ? Array.from(selectedFormats).find((k: string) => k.startsWith(product.genericName + "::"))?.split("::")[1]
                    : null;

                return (
                    <Card key={product.genericName} className="overflow-hidden">
                        <div className="flex items-center gap-3 p-4 border-b">
                            <Package className="h-5 w-5 text-orange-500 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-3 flex-wrap">
                                    <h3 className="font-semibold text-lg">{product.genericName}</h3>
                                    {product.groupName && (
                                        <Badge className={`${getGroupColor(product.groupName)} border`}>
                                            {product.groupName}
                                        </Badge>
                                    )}
                                </div>
                            </div>
                            <Select
                                value={selectedFormatKey || ""}
                                onValueChange={(format) => {
                                    toggleFormat(`${product.genericName}::${format}`);
                                }}
                            >
                                <SelectTrigger className="w-[180px]">
                                    <SelectValue placeholder="Seleccionar formato" />
                                </SelectTrigger>
                                <SelectContent>
                                    {formatKeys.map(formatUnit => (
                                        <SelectItem key={formatUnit} value={formatUnit}>
                                            {formatUnit} ({product.formats[formatUnit].length} colores)
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {selectedFormatKey && (() => {
                            const formatKey = `${product.genericName}::${selectedFormatKey}`;
                            const isFormatExpanded = selectedFormats.has(formatKey);
                            const variants = product.formats[selectedFormatKey];
                            const mainVariant = variants.find(v => v.isMainVariant);

                            return (
                                <div className="bg-muted/10 p-4">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium">{selectedFormatKey}</span>
                                            {mainVariant && (
                                                <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200">
                                                    Principal: {mainVariant.color || mainVariant.sku}
                                                </Badge>
                                            )}
                                        </div>
                                        <Badge variant="secondary">
                                            {variants.length} color{variants.length !== 1 ? "es" : ""}
                                        </Badge>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                                        {variants.map((variant) => {
                                            const isExpanded = expandedVariants.has(variant.sku);
                                            return (
                                                <Card key={variant.sku} className="overflow-hidden">
                                                    <div
                                                        className="p-3 cursor-pointer hover:bg-muted/30 transition-colors"
                                                        onClick={() => toggleVariant(variant.sku)}
                                                    >
                                                        <div className="flex items-center justify-between mb-2">
                                                            <Badge variant={variant.isMainVariant ? "default" : "outline"} className="text-xs">
                                                                <Palette className="h-3 w-3 mr-1" />
                                                                {variant.color || "—"}
                                                            </Badge>
                                                            {variant.isMainVariant && <span className="text-xs">⭐</span>}
                                                        </div>
                                                        <button
                                                            className="font-mono text-xs text-primary hover:underline block mb-2"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setLocation(`/productos/${encodeURIComponent(variant.sku)}`);
                                                            }}
                                                        >
                                                            {variant.sku}
                                                        </button>
                                                        <div className="text-right font-semibold">
                                                            {formatPrice(variant.priceList)}
                                                        </div>
                                                    </div>

                                                    {isExpanded && (
                                                        <div className="border-t p-3 bg-muted/20 space-y-2">
                                                            <div className="text-xs">
                                                                <span className="text-muted-foreground">Mín: </span>
                                                                <Badge variant="secondary" className="text-xs">
                                                                    {variant.minUnit}
                                                                </Badge>
                                                            </div>
                                                            <DimensionsInfo d={variant.dimensions} />
                                                            <PackagingInfo p={variant.packaging} />
                                                            {variant.description && (
                                                                <p className="text-xs text-muted-foreground leading-relaxed">
                                                                    {variant.description}
                                                                </p>
                                                            )}
                                                            <Button
                                                                variant="link"
                                                                size="sm"
                                                                className="text-xs p-0 h-auto w-full justify-end"
                                                                onClick={() => setLocation(`/productos/${encodeURIComponent(variant.sku)}`)}
                                                            >
                                                                Ver ficha completa →
                                                            </Button>
                                                        </div>
                                                    )}
                                                </Card>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })()}
                    </Card>
                );
            })}

            {!isLoading && catalog.length === 0 && (
                <Card>
                    <CardContent className="py-12 text-center">
                        <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <h3 className="text-lg font-medium">No hay productos</h3>
                        <p className="text-muted-foreground text-sm mt-1">
                            Importa el catálogo CSV para ver los productos organizados.
                        </p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
