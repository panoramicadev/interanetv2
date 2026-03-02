import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
    Search, ChevronDown, ChevronRight, Package, Layers, Palette,
    Weight, Ruler, Box, Truck, Info, Loader2
} from "lucide-react";

interface Variant {
    ecomId: string;
    sku: string;
    name: string;
    color: string | null;
    unit: string | null;
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
    groupId: string | null;
    variantCount: number;
    variants: Variant[];
}

interface GroupCategory {
    groupName: string;
    productCount: number;
    products: GenericProduct[];
}

interface CatalogResponse {
    catalog: GroupCategory[];
    availableGroups: string[];
    totalProducts: number;
}

// Color badge helper
function getGroupColor(groupName: string): string {
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
    return colors[groupName] || "bg-muted text-muted-foreground";
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
        d.volume && `${d.volume} ${d.volumeUnit || "L"}`,
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
            {d.volume && (
                <span className="flex items-center gap-1">
                    <Box className="h-3 w-3" /> {d.volume} {d.volumeUnit || "L"}
                </span>
            )}
        </div>
    );
}

function PackagingInfo({ p }: { p: Variant["packaging"] }) {
    const formats = [
        p.amountPerPackage && { name: p.packageName || "Display", qty: p.amountPerPackage, unit: p.packageUnit },
        p.amountPerBox && { name: p.boxName || "Caja", qty: p.amountPerBox, unit: p.boxUnit },
        p.amountPerPallet && { name: p.palletName || "Pallet", qty: p.amountPerPallet, unit: p.palletUnit },
    ].filter(Boolean) as { name: string; qty: number; unit: string | null }[];

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

export default function GroupedCatalog() {
    const [search, setSearch] = useState("");
    const [groupFilter, setGroupFilter] = useState("all");
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
    const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
    const [expandedVariants, setExpandedVariants] = useState<Set<string>>(new Set());
    const [, setLocation] = useLocation();

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

    const catalog = data?.catalog || [];
    const availableGroups = data?.availableGroups || [];

    const toggleGroup = (name: string) => {
        setExpandedGroups(prev => {
            const s = new Set(prev);
            s.has(name) ? s.delete(name) : s.add(name);
            return s;
        });
    };

    const toggleProduct = (key: string) => {
        setExpandedProducts(prev => {
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
        const groups = new Set(catalog.map(c => c.groupName));
        const products = new Set(catalog.flatMap(c => c.products.map(p => `${c.groupName}::${p.genericName}`)));
        setExpandedGroups(groups);
        setExpandedProducts(products);
    };

    const collapseAll = () => {
        setExpandedGroups(new Set());
        setExpandedProducts(new Set());
        setExpandedVariants(new Set());
    };

    return (
        <div className="space-y-4">
            {/* Filters */}
            <Card>
                <CardContent className="pt-6">
                    <div className="flex flex-col sm:flex-row gap-4">
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar por SKU, nombre, color o grupo..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                        <Select value={groupFilter} onValueChange={setGroupFilter}>
                            <SelectTrigger className="w-[220px]">
                                <SelectValue placeholder="Todos los grupos" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos los grupos</SelectItem>
                                {availableGroups.map(g => (
                                    <SelectItem key={g} value={g}>{g}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={expandAll}>Expandir todo</Button>
                            <Button variant="outline" size="sm" onClick={collapseAll}>Colapsar todo</Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Summary stats */}
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                    <Layers className="h-4 w-4" />
                    {catalog.length} grupo{catalog.length !== 1 ? "s" : ""}
                </span>
                <span className="flex items-center gap-1">
                    <Package className="h-4 w-4" />
                    {catalog.reduce((a, g) => a + g.products.length, 0)} productos
                </span>
                <span className="flex items-center gap-1">
                    <Palette className="h-4 w-4" />
                    {data?.totalProducts || 0} SKUs totales
                </span>
            </div>

            {/* Loading */}
            {isLoading && (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-muted-foreground">Cargando catálogo...</span>
                </div>
            )}

            {/* Groups */}
            {!isLoading && catalog.map(group => {
                const isGroupExpanded = expandedGroups.has(group.groupName);

                return (
                    <Card key={group.groupName} className="overflow-hidden">
                        {/* Level 1: Group header */}
                        <div
                            className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/50 transition-colors border-b"
                            onClick={() => toggleGroup(group.groupName)}
                        >
                            <button className="flex-shrink-0">
                                {isGroupExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                            </button>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-3">
                                    <h3 className="font-semibold text-lg">{group.groupName}</h3>
                                    <Badge className={`${getGroupColor(group.groupName)} border`}>
                                        {group.productCount} SKUs
                                    </Badge>
                                    <Badge variant="secondary">
                                        {group.products.length} producto{group.products.length !== 1 ? "s" : ""}
                                    </Badge>
                                </div>
                            </div>
                        </div>

                        {/* Level 2: Products within group */}
                        {isGroupExpanded && (
                            <div className="bg-background">
                                {group.products.map(product => {
                                    const productKey = `${group.groupName}::${product.genericName}`;
                                    const isProductExpanded = expandedProducts.has(productKey);

                                    return (
                                        <div key={productKey} className="border-b last:border-b-0">
                                            {/* Product header */}
                                            <div
                                                className="flex items-center gap-3 px-6 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
                                                onClick={() => toggleProduct(productKey)}
                                            >
                                                <button className="flex-shrink-0 ml-4">
                                                    {isProductExpanded ?
                                                        <ChevronDown className="h-4 w-4 text-muted-foreground" /> :
                                                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                                    }
                                                </button>
                                                <Package className="h-4 w-4 text-primary flex-shrink-0" />
                                                <div className="flex-1 min-w-0">
                                                    <span className="font-medium text-sm">{product.genericName}</span>
                                                </div>
                                                <Badge variant="outline" className="text-xs">
                                                    {product.variantCount} variante{product.variantCount !== 1 ? "s" : ""}
                                                </Badge>
                                            </div>

                                            {/* Level 3: Variants table */}
                                            {isProductExpanded && (
                                                <div className="px-6 pb-4">
                                                    <Table>
                                                        <TableHeader>
                                                            <TableRow>
                                                                <TableHead className="w-8"></TableHead>
                                                                <TableHead>SKU</TableHead>
                                                                <TableHead>Nombre</TableHead>
                                                                <TableHead>Color</TableHead>
                                                                <TableHead>Formato</TableHead>
                                                                <TableHead className="text-right">Precio Lista</TableHead>
                                                                <TableHead className="text-center">Mín.</TableHead>
                                                                <TableHead>Formatos de Venta</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {product.variants.map(variant => {
                                                                const isExpanded = expandedVariants.has(variant.sku);
                                                                return (
                                                                    <>
                                                                        <TableRow
                                                                            key={variant.sku}
                                                                            className="cursor-pointer hover:bg-muted/40 transition-colors"
                                                                            onClick={() => toggleVariant(variant.sku)}
                                                                        >
                                                                            <TableCell>
                                                                                {isExpanded ?
                                                                                    <ChevronDown className="h-3 w-3 text-muted-foreground" /> :
                                                                                    <ChevronRight className="h-3 w-3 text-muted-foreground" />
                                                                                }
                                                                            </TableCell>
                                                                            <TableCell>
                                                                                <button
                                                                                    className="font-mono text-xs text-primary hover:underline"
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        setLocation(`/productos/${encodeURIComponent(variant.sku)}`);
                                                                                    }}
                                                                                >
                                                                                    {variant.sku}
                                                                                </button>
                                                                            </TableCell>
                                                                            <TableCell className="font-medium text-sm max-w-[200px] truncate">
                                                                                {variant.name}
                                                                            </TableCell>
                                                                            <TableCell>
                                                                                {variant.color && (
                                                                                    <Badge variant="outline" className="text-xs">
                                                                                        <Palette className="h-3 w-3 mr-1" />
                                                                                        {variant.color}
                                                                                    </Badge>
                                                                                )}
                                                                            </TableCell>
                                                                            <TableCell className="text-xs text-muted-foreground">
                                                                                {variant.unit || "—"}
                                                                            </TableCell>
                                                                            <TableCell className="text-right font-semibold">
                                                                                {formatPrice(variant.priceList)}
                                                                            </TableCell>
                                                                            <TableCell className="text-center">
                                                                                <Badge variant="secondary" className="text-xs">
                                                                                    {variant.minUnit}
                                                                                </Badge>
                                                                            </TableCell>
                                                                            <TableCell>
                                                                                <PackagingInfo p={variant.packaging} />
                                                                            </TableCell>
                                                                        </TableRow>

                                                                        {/* Expanded variant detail */}
                                                                        {isExpanded && (
                                                                            <TableRow key={`${variant.sku}-detail`}>
                                                                                <TableCell colSpan={8} className="bg-muted/20 p-0">
                                                                                    <div className="px-6 py-4 space-y-3">
                                                                                        {/* Dimensions */}
                                                                                        <DimensionsInfo d={variant.dimensions} />

                                                                                        {/* Description */}
                                                                                        {variant.description && (
                                                                                            <div className="flex items-start gap-2">
                                                                                                <Info className="h-3 w-3 mt-1 text-muted-foreground flex-shrink-0" />
                                                                                                <p className="text-xs text-muted-foreground leading-relaxed max-w-2xl">
                                                                                                    {variant.description}
                                                                                                </p>
                                                                                            </div>
                                                                                        )}

                                                                                        {/* Packaging table */}
                                                                                        {(variant.packaging.amountPerPackage || variant.packaging.amountPerBox || variant.packaging.amountPerPallet) && (
                                                                                            <div className="border rounded-md overflow-hidden max-w-md">
                                                                                                <Table>
                                                                                                    <TableHeader>
                                                                                                        <TableRow className="bg-muted/50">
                                                                                                            <TableHead className="text-xs py-2">Formato</TableHead>
                                                                                                            <TableHead className="text-xs py-2">Código</TableHead>
                                                                                                            <TableHead className="text-xs py-2 text-right">Unidades</TableHead>
                                                                                                        </TableRow>
                                                                                                    </TableHeader>
                                                                                                    <TableBody>
                                                                                                        {variant.packaging.amountPerPackage && (
                                                                                                            <TableRow>
                                                                                                                <TableCell className="text-xs py-1.5">{variant.packaging.packageName}</TableCell>
                                                                                                                <TableCell className="text-xs py-1.5 font-mono">{variant.packaging.packageUnit}</TableCell>
                                                                                                                <TableCell className="text-xs py-1.5 text-right font-semibold">{variant.packaging.amountPerPackage}</TableCell>
                                                                                                            </TableRow>
                                                                                                        )}
                                                                                                        {variant.packaging.amountPerBox && (
                                                                                                            <TableRow>
                                                                                                                <TableCell className="text-xs py-1.5">{variant.packaging.boxName}</TableCell>
                                                                                                                <TableCell className="text-xs py-1.5 font-mono">{variant.packaging.boxUnit}</TableCell>
                                                                                                                <TableCell className="text-xs py-1.5 text-right font-semibold">{variant.packaging.amountPerBox}</TableCell>
                                                                                                            </TableRow>
                                                                                                        )}
                                                                                                        {variant.packaging.amountPerPallet && (
                                                                                                            <TableRow>
                                                                                                                <TableCell className="text-xs py-1.5">{variant.packaging.palletName}</TableCell>
                                                                                                                <TableCell className="text-xs py-1.5 font-mono">{variant.packaging.palletUnit}</TableCell>
                                                                                                                <TableCell className="text-xs py-1.5 text-right font-semibold">{variant.packaging.amountPerPallet}</TableCell>
                                                                                                            </TableRow>
                                                                                                        )}
                                                                                                    </TableBody>
                                                                                                </Table>
                                                                                            </div>
                                                                                        )}

                                                                                        {/* Link to detail */}
                                                                                        <Button
                                                                                            variant="link"
                                                                                            size="sm"
                                                                                            className="text-xs p-0 h-auto"
                                                                                            onClick={() => setLocation(`/productos/${encodeURIComponent(variant.sku)}`)}
                                                                                        >
                                                                                            Ver ficha completa →
                                                                                        </Button>
                                                                                    </div>
                                                                                </TableCell>
                                                                            </TableRow>
                                                                        )}
                                                                    </>
                                                                );
                                                            })}
                                                        </TableBody>
                                                    </Table>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </Card>
                );
            })}

            {/* Empty state */}
            {!isLoading && catalog.length === 0 && (
                <Card>
                    <CardContent className="py-12 text-center">
                        <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <h3 className="text-lg font-medium">No hay productos agrupados</h3>
                        <p className="text-muted-foreground text-sm mt-1">
                            Importa el catálogo CSV para ver los productos organizados por grupo.
                        </p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
