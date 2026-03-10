import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useCart } from "@/hooks/useCart";
import {
    Search, ChevronDown, ChevronRight, Package, Palette,
    ShoppingCart, Plus, Minus, Loader2, Box
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
    stock: number;
    minUnit: number;
    stepSize: number;
    description: string | null;
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

function QuantitySelector({ value, onChange, min = 1, step = 1 }: {
    value: number;
    onChange: (v: number) => void;
    min?: number;
    step?: number;
}) {
    return (
        <div className="flex items-center gap-1">
            <button
                onClick={() => onChange(Math.max(min, value - step))}
                className="w-7 h-7 flex items-center justify-center rounded-md border border-slate-200 hover:bg-slate-100 text-slate-500 transition-colors"
                disabled={value <= min}
            >
                <Minus className="w-3 h-3" />
            </button>
            <input
                type="number"
                value={value}
                onChange={e => onChange(Math.max(min, parseInt(e.target.value) || min))}
                className="w-14 h-7 text-center text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-orange-500"
                min={min}
                step={step}
            />
            <button
                onClick={() => onChange(value + step)}
                className="w-7 h-7 flex items-center justify-center rounded-md border border-slate-200 hover:bg-slate-100 text-slate-500 transition-colors"
            >
                <Plus className="w-3 h-3" />
            </button>
        </div>
    );
}

export default function PublicCatalogProducts() {
    const [search, setSearch] = useState("");
    const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
    const [quantities, setQuantities] = useState<Map<string, number>>(new Map());
    const { toast } = useToast();
    const { addItem } = useCart();

    const { data, isLoading } = useQuery<CatalogResponse>({
        queryKey: ["/api/public/products/grouped", { search }],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (search) params.set("search", search);
            const res = await fetch(`/api/public/products/grouped?${params}`);
            if (!res.ok) throw new Error("Error fetching catalog");
            return res.json();
        },
    });

    const catalog = data?.catalog || [];

    const filteredCatalog = useMemo(() => {
        if (!search.trim()) return catalog;
        const s = search.toLowerCase();
        return catalog.filter(p =>
            p.genericName.toLowerCase().includes(s) ||
            Object.keys(p.colors).some(c => c.toLowerCase().includes(s)) ||
            Object.values(p.colors).flat().some(v => v.sku.toLowerCase().includes(s))
        );
    }, [catalog, search]);

    const toggleProduct = (name: string) => {
        setExpandedProducts(prev => {
            const s = new Set(prev);
            s.has(name) ? s.delete(name) : s.add(name);
            return s;
        });
    };

    const getQuantity = (sku: string) => quantities.get(sku) || 1;
    const setQuantity = (sku: string, val: number) => {
        setQuantities(prev => new Map(prev).set(sku, val));
    };

    const handleAddToCart = (variant: FormatVariant, productName: string) => {
        const qty = getQuantity(variant.sku);
        addItem({
            productId: variant.sku,
            productCode: variant.sku,
            productName: productName,
            selectedPackaging: variant.format,
            selectedColor: variant.color,
            unit: variant.format,
            unitPrice: variant.price ? parseFloat(variant.price) : 0,
            quantity: qty,
            minQuantity: variant.minUnit || 1,
            quantityStep: variant.stepSize || 1,
        });
        toast({
            title: "Agregado al carrito",
            description: `${qty}x ${productName} (${variant.color}, ${variant.format})`,
        });
    };

    return (
        <div className="flex flex-col h-full">
            {/* Search bar */}
            <div className="p-3 border-b bg-white flex-shrink-0">
                <div className="relative max-w-lg mx-auto">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <Input
                        placeholder="Buscar producto, color o SKU..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="pl-10 h-9 text-sm"
                    />
                </div>
                <div className="flex items-center justify-center gap-3 mt-2 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                        <Package className="h-3.5 w-3.5" />
                        {filteredCatalog.length} producto{filteredCatalog.length !== 1 ? "s" : ""}
                    </span>
                    <span>·</span>
                    <span>{data?.totalProducts || 0} SKUs</span>
                </div>
            </div>

            {/* Product list */}
            <div className="flex-1 overflow-y-auto">
                {isLoading && (
                    <div className="flex items-center justify-center py-16">
                        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                        <span className="ml-2 text-sm text-slate-500">Cargando productos...</span>
                    </div>
                )}

                {!isLoading && filteredCatalog.length === 0 && (
                    <div className="text-center py-16">
                        <Package className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                        <p className="text-sm text-slate-500">No se encontraron productos</p>
                    </div>
                )}

                {!isLoading && filteredCatalog.map(product => {
                    const colorKeys = Object.keys(product.colors);
                    const isExpanded = expandedProducts.has(product.genericName);
                    const totalVariants = Object.values(product.colors).flat().length;

                    return (
                        <div key={product.genericName} className="border-b border-slate-100">
                            {/* Product row - Excel style */}
                            <div
                                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-orange-50/50 transition-colors"
                                onClick={() => toggleProduct(product.genericName)}
                            >
                                {isExpanded ? (
                                    <ChevronDown className="h-4 w-4 text-orange-500 flex-shrink-0" />
                                ) : (
                                    <ChevronRight className="h-4 w-4 text-slate-400 flex-shrink-0" />
                                )}
                                <Package className={`h-4 w-4 flex-shrink-0 ${isExpanded ? "text-orange-500" : "text-slate-400"}`} />
                                <span className={`font-medium text-sm flex-1 ${isExpanded ? "text-orange-700" : "text-slate-800"}`}>
                                    {product.genericName}
                                </span>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-slate-200">
                                        {colorKeys.length} color{colorKeys.length !== 1 ? "es" : ""}
                                    </Badge>
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-slate-200">
                                        {totalVariants} SKU{totalVariants !== 1 ? "s" : ""}
                                    </Badge>
                                </div>
                            </div>

                            {/* Expanded content: colors → formats */}
                            {isExpanded && (
                                <div className="bg-slate-50/50">
                                    {colorKeys.map(color => {
                                        const variants = product.colors[color];
                                        return (
                                            <div key={color} className="border-t border-slate-100">
                                                {/* Color header */}
                                                <div className="flex items-center gap-2 px-8 py-2 bg-slate-50">
                                                    <Palette className="h-3.5 w-3.5 text-orange-500" />
                                                    <span className="text-xs font-semibold text-slate-700">{color}</span>
                                                    <span className="text-[10px] text-slate-400">
                                                        ({variants.length} formato{variants.length !== 1 ? "s" : ""})
                                                    </span>
                                                </div>

                                                {/* Format table header */}
                                                <div className="grid grid-cols-[1fr_80px_70px_100px_80px] gap-2 px-8 py-1.5 text-[10px] uppercase font-semibold text-slate-400 tracking-wide bg-slate-100/50">
                                                    <span>Formato</span>
                                                    <span className="text-center">SKU</span>
                                                    <span className="text-center">Stock</span>
                                                    <span className="text-center">Cantidad</span>
                                                    <span className="text-center">Acción</span>
                                                </div>

                                                {/* Format rows */}
                                                {variants.map(variant => (
                                                    <div
                                                        key={variant.sku}
                                                        className="grid grid-cols-[1fr_80px_70px_100px_80px] gap-2 items-center px-8 py-2 border-t border-slate-100 hover:bg-orange-50/30 transition-colors"
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <Box className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
                                                            <span className="text-sm font-medium text-slate-700">{variant.format}</span>
                                                        </div>
                                                        <span className="text-[10px] text-center font-mono text-slate-400 truncate" title={variant.sku}>
                                                            {variant.sku.length > 10 ? variant.sku.slice(-8) : variant.sku}
                                                        </span>
                                                        <div className="text-center">
                                                            <Badge
                                                                variant="outline"
                                                                className={`text-[10px] px-1.5 py-0 ${variant.stock > 0
                                                                    ? "border-emerald-200 text-emerald-700 bg-emerald-50"
                                                                    : "border-red-200 text-red-600 bg-red-50"
                                                                    }`}
                                                            >
                                                                {Math.round(variant.stock)}
                                                            </Badge>
                                                        </div>
                                                        <div className="flex justify-center">
                                                            <QuantitySelector
                                                                value={getQuantity(variant.sku)}
                                                                onChange={val => setQuantity(variant.sku, val)}
                                                                min={variant.minUnit || 1}
                                                                step={variant.stepSize || 1}
                                                            />
                                                        </div>
                                                        <div className="flex justify-center">
                                                            <Button
                                                                size="sm"
                                                                className="h-7 px-2 text-[10px] font-semibold bg-orange-500 hover:bg-orange-600 text-white gap-1"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleAddToCart(variant, product.genericName);
                                                                }}
                                                            >
                                                                <ShoppingCart className="h-3 w-3" />
                                                                Añadir
                                                            </Button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
