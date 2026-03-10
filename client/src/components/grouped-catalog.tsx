import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
    Search, Package, Palette, ChevronDown, ChevronRight,
    Weight, Ruler, Truck, Loader2, Upload, Trash2, Box
} from "lucide-react";

interface FormatVariant {
    ecomId: string;
    sku: string;
    name: string;
    color: string;
    format: string;
    groupName: string | null;
    price: string | null;
    priceList: string | null;
    minUnit: number;
    stepSize: number;
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
    groupName: string | null;
    colors: { [color: string]: FormatVariant[] };
}

interface CatalogResponse {
    catalog: GenericProduct[];
    availableGroups: string[];
    totalProducts: number;
}

// Parse CSV handling quoted fields with commas
function parseGroupedCSV(text: string): Record<string, string>[] {
    const lines = text.split('\n').filter(l => l.trim());
    if (lines.length < 2) return [];

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

function PackagingInfo({ p }: { p: FormatVariant["packaging"] }) {
    const formats = [
        p.amountPerPackage && { name: p.packageName || "Display", qty: p.amountPerPackage },
        p.amountPerBox && { name: p.boxName || "Caja", qty: p.amountPerBox },
        p.amountPerPallet && { name: p.palletName || "Pallet", qty: p.amountPerPallet },
    ].filter(Boolean) as { name: string; qty: number }[];

    if (formats.length === 0) return null;

    return (
        <div className="flex items-center gap-2 flex-wrap">
            {formats.map((f, i) => (
                <Badge key={i} variant="outline" className="text-xs font-normal">
                    <Truck className="h-3 w-3 mr-1" />
                    {f.name}: {f.qty} uds
                </Badge>
            ))}
        </div>
    );
}

export default function GroupedCatalog() {
    const [search, setSearch] = useState("");
    const [groupFilter, setGroupFilter] = useState("all");
    const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
    const [selectedColors, setSelectedColors] = useState<Map<string, string>>(new Map());
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
                description: `${data.imported} productos importados de ${data.total} filas.`,
            });
        },
        onError: () => {
            toast({ variant: "destructive", title: "Error", description: "No se pudo importar el catálogo CSV." });
        },
    });

    // Clean table mutation
    const cleanMutation = useMutation({
        mutationFn: async () => {
            const res = await apiRequest("DELETE", "/api/products/grouped-catalog");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/products/grouped-catalog"] });
            toast({ title: "Tabla limpiada", description: "Se eliminaron todos los productos del catálogo agrupado." });
        },
        onError: () => {
            toast({ variant: "destructive", title: "Error", description: "No se pudo limpiar la tabla." });
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
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const catalog = data?.catalog || [];
    const availableGroups = data?.availableGroups || [];

    const toggleProduct = (name: string) => {
        setExpandedProducts(prev => {
            const s = new Set(prev);
            s.has(name) ? s.delete(name) : s.add(name);
            return s;
        });
    };

    const selectColor = (productName: string, color: string) => {
        setSelectedColors(prev => {
            const m = new Map(prev);
            if (m.get(productName) === color) {
                m.delete(productName);
            } else {
                m.set(productName, color);
            }
            return m;
        });
    };

    const expandAll = () => {
        const all = new Set(catalog.map(p => p.genericName));
        setExpandedProducts(all);
    };

    const collapseAll = () => {
        setExpandedProducts(new Set());
        setSelectedColors(new Map());
    };

    return (
        <div className="space-y-4">
            <Card>
                <CardContent className="pt-6">
                    <div className="flex flex-col sm:flex-row gap-4">
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar por nombre, color o SKU..."
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
                        <div className="flex gap-2 flex-wrap">
                            <Button variant="outline" size="sm" onClick={expandAll}>Expandir</Button>
                            <Button variant="outline" size="sm" onClick={collapseAll}>Colapsar</Button>
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
                                {importMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                                {importMutation.isPending ? "Importando..." : "Importar CSV"}
                            </Button>
                            {catalog.length > 0 && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        if (confirm("¿Limpiar todos los productos del catálogo agrupado? (No afecta la lista de precios SAP)")) {
                                            cleanMutation.mutate();
                                        }
                                    }}
                                    disabled={cleanMutation.isPending}
                                    className="gap-1.5 text-red-600 hover:text-red-700"
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    Limpiar
                                </Button>
                            )}
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
                const colorKeys = Object.keys(product.colors);
                const isExpanded = expandedProducts.has(product.genericName);
                const activeColor = selectedColors.get(product.genericName);
                const activeFormats = activeColor ? product.colors[activeColor] : null;

                return (
                    <Card key={product.genericName} className="overflow-hidden">
                        {/* Product header */}
                        <div
                            className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                            onClick={() => toggleProduct(product.genericName)}
                        >
                            {isExpanded ? (
                                <ChevronDown className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                            ) : (
                                <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                            )}
                            <Package className="h-5 w-5 text-orange-500 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-lg">{product.genericName}</h3>
                                <span className="text-sm text-muted-foreground">
                                    {colorKeys.length} color{colorKeys.length !== 1 ? "es" : ""} disponible{colorKeys.length !== 1 ? "s" : ""}
                                </span>
                            </div>
                            {product.groupName && (
                                <Badge variant="outline" className="text-xs">
                                    {product.groupName}
                                </Badge>
                            )}
                        </div>

                        {/* Colors section */}
                        {isExpanded && (
                            <div className="border-t">
                                {/* Color pills */}
                                <div className="p-4 bg-muted/10">
                                    <div className="flex items-center gap-2 mb-3">
                                        <Palette className="h-4 w-4 text-muted-foreground" />
                                        <span className="text-sm font-medium text-muted-foreground">Colores y formatos disponibles:</span>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                        {colorKeys.map(color => {
                                            const isActive = activeColor === color;
                                            const variants = product.colors[color];
                                            const formats = variants.map(v => v.format);
                                            return (
                                                <div
                                                    key={color}
                                                    className={`p-3 rounded-lg border cursor-pointer transition-all ${isActive
                                                            ? "border-orange-500 bg-orange-50 dark:bg-orange-950/30 shadow-sm"
                                                            : "border-border hover:border-orange-300 hover:bg-muted/30"
                                                        }`}
                                                    onClick={() => selectColor(product.genericName, color)}
                                                >
                                                    <div className="flex items-center gap-2 mb-1.5">
                                                        <Palette className={`h-4 w-4 ${isActive ? "text-orange-600" : "text-muted-foreground"}`} />
                                                        <span className={`font-semibold text-sm ${isActive ? "text-orange-700 dark:text-orange-400" : ""}`}>
                                                            {color}
                                                        </span>
                                                    </div>
                                                    <div className="flex flex-wrap gap-1">
                                                        {formats.map((f, i) => (
                                                            <Badge
                                                                key={i}
                                                                variant="secondary"
                                                                className={`text-xs font-normal ${isActive ? "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-200" : ""}`}
                                                            >
                                                                {f}
                                                            </Badge>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Format cards for selected color */}
                                {activeColor && activeFormats && (
                                    <div className="p-4 border-t bg-muted/5">
                                        <div className="flex items-center gap-2 mb-3">
                                            <Box className="h-4 w-4 text-muted-foreground" />
                                            <span className="text-sm font-medium text-muted-foreground">
                                                Envases disponibles para {activeColor}:
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                            {activeFormats.map((variant) => (
                                                <Card key={variant.sku} className="overflow-hidden hover:shadow-md transition-shadow">
                                                    <div className="p-4">
                                                        <div className="flex items-center justify-between mb-2">
                                                            <Badge className="bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100">
                                                                <Box className="h-3 w-3 mr-1" />
                                                                {variant.format}
                                                            </Badge>
                                                        </div>
                                                        <p className="font-mono text-xs text-muted-foreground mb-2">
                                                            SKU: {variant.sku}
                                                        </p>

                                                        {/* Dimensions */}
                                                        {variant.dimensions.weight && (
                                                            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                                                                <Weight className="h-3 w-3" />
                                                                {variant.dimensions.weight} {variant.dimensions.weightUnit || "kg"}
                                                            </div>
                                                        )}
                                                        {variant.dimensions.length && (
                                                            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                                                                <Ruler className="h-3 w-3" />
                                                                {variant.dimensions.length}×{variant.dimensions.width}×{variant.dimensions.height} {variant.dimensions.lengthUnit || "cm"}
                                                            </div>
                                                        )}

                                                        {/* Packaging */}
                                                        <div className="mt-2">
                                                            <PackagingInfo p={variant.packaging} />
                                                        </div>

                                                        {variant.description && (
                                                            <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                                                                {variant.description}
                                                            </p>
                                                        )}
                                                    </div>
                                                </Card>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
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
