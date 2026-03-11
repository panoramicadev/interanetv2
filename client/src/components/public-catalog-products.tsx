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
    availableGroups?: string[];
    totalProducts: number;
}

function QuantitySelector({ value, onChange, min = 1, step = 1 }: {
    value: number;
    onChange: (v: number) => void;
    min?: number;
    step?: number;
}) {
    return (
        <div className="inline-flex items-center border border-slate-200 rounded-md overflow-hidden">
            <button
                onClick={() => onChange(Math.max(min, value - step))}
                className="w-6 h-6 flex items-center justify-center hover:bg-slate-100 text-slate-500 transition-colors"
                disabled={value <= min}
            >
                <Minus className="w-2.5 h-2.5" />
            </button>
            <input
                type="number"
                value={value}
                onChange={e => onChange(Math.max(min, parseInt(e.target.value) || min))}
                className="w-10 h-6 text-center text-xs border-x border-slate-200 focus:outline-none"
                min={min}
                step={step}
            />
            <button
                onClick={() => onChange(value + step)}
                className="w-6 h-6 flex items-center justify-center hover:bg-slate-100 text-slate-500 transition-colors"
            >
                <Plus className="w-2.5 h-2.5" />
            </button>
        </div>
    );
}

export default function PublicCatalogProducts({ onScroll }: { onScroll?: (scrollTop: number) => void }) {
    const [search, setSearch] = useState("");
    const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
    const [expandedColors, setExpandedColors] = useState<Set<string>>(new Set());
    const [quantities, setQuantities] = useState<Map<string, number>>(new Map());
    const { toast } = useToast();
    const { addItem } = useCart();

    const { data, isLoading } = useQuery<any>({
        queryKey: ["/api/public/products/grouped"],
        queryFn: async () => {
            const res = await fetch(`/api/public/products/grouped`);
            if (!res.ok) throw new Error("Error fetching catalog");
            return res.json();
        },
    });

    // Normalize response — API may return array (old format) or {catalog} (new format)
    const catalog: GenericProduct[] = useMemo(() => {
        if (!data) return [];
        // New format: {catalog: [...]}
        if (data.catalog) return data.catalog;
        // Old format: array of {family, colors: [{color, formats: [...]}]}
        if (Array.isArray(data)) {
            return data.map((item: any) => ({
                genericName: item.family || 'Sin Nombre',
                groupName: item.categoria || null,
                colors: (item.colors || []).reduce((acc: any, c: any) => {
                    acc[c.color || 'Sin Color'] = (c.formats || []).map((f: any) => ({
                        ecomId: f.id || '',
                        sku: f.codigo || '',
                        name: item.family || '',
                        color: c.color || 'Sin Color',
                        format: f.formatUnit || f.unidad || 'Sin formato',
                        groupName: item.categoria || null,
                        price: f.precio?.toString() || null,
                        priceList: null,
                        stock: Number(f.stock) || 0,
                        minUnit: f.minUnit || 1,
                        stepSize: f.stepSize || 1,
                        description: item.descripcion || null,
                    }));
                    return acc;
                }, {} as Record<string, FormatVariant[]>),
            }));
        }
        return [];
    }, [data]);

    const totalProducts = useMemo(() => {
        return catalog.reduce((sum, p) => sum + Object.values(p.colors).flat().length, 0);
    }, [catalog]);

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

    const toggleColor = (productName: string, color: string) => {
        const key = `${productName}-${color}`;
        setExpandedColors(prev => {
            const s = new Set(prev);
            s.has(key) ? s.delete(key) : s.add(key);
            return s;
        });
    };

    const getQuantity = (sku: string, defaultMin?: number) => quantities.get(sku) || defaultMin || 1;
    const setQuantity = (sku: string, val: number) => {
        setQuantities(prev => new Map(prev).set(sku, val));
    };

    const getStock = (variant: FormatVariant): number => {
        const s = Number(variant.stock);
        return isNaN(s) ? 0 : Math.round(s);
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
            unitPrice: 0, // Prices hidden in public catalog — each client has personalized pricing
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
            {/* Product list */}
            <div className="flex-1 overflow-y-auto" onScroll={e => onScroll?.((e.target as HTMLDivElement).scrollTop)}>
                {/* Search bar — scrolls with content */}
                <div className="px-4 py-3 border-b bg-white">
                    <div className="relative max-w-md mx-auto">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder="Buscar producto, color o SKU..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="pl-10 h-9 text-sm"
                        />
                    </div>
                    <p className="text-center text-xs text-slate-400 mt-1.5">
                        {filteredCatalog.length} productos · {totalProducts} SKUs
                    </p>
                </div>
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
                            {/* Product row */}
                            <div
                                className="flex items-center gap-2 px-4 py-2.5 cursor-pointer hover:bg-orange-50/50 transition-colors"
                                onClick={() => toggleProduct(product.genericName)}
                            >
                                {isExpanded
                                    ? <ChevronDown className="h-4 w-4 text-orange-500 flex-shrink-0" />
                                    : <ChevronRight className="h-4 w-4 text-slate-400 flex-shrink-0" />
                                }
                                <span className={`text-sm font-medium flex-1 truncate uppercase ${isExpanded ? "text-orange-700" : "text-slate-800"}`}>
                                    {product.genericName}
                                </span>
                                <span className="text-[10px] text-slate-400 flex-shrink-0">
                                    {colorKeys.length}c · {totalVariants}f
                                </span>
                            </div>

                            {/* Expanded: colors → formats */}
                            {isExpanded && (
                                <div className="bg-slate-50/80">
                                    {colorKeys.map(color => {
                                        const variants = product.colors[color];
                                        const isColorExpanded = expandedColors.has(`${product.genericName}-${color}`);

                                        return (
                                            <div key={color}>
                                                {/* Color header */}
                                                <div
                                                    className="flex items-center gap-1.5 px-6 py-1.5 bg-slate-100/90 border-t border-slate-200/60 cursor-pointer hover:bg-slate-200/60 transition-colors"
                                                    onClick={() => toggleColor(product.genericName, color)}
                                                >
                                                    {isColorExpanded
                                                        ? <ChevronDown className="h-3.5 w-3.5 text-orange-500" />
                                                        : <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                                                    }
                                                    <Palette className="h-3 w-3 text-orange-500 ml-0.5" />
                                                    <span className="text-xs font-bold text-slate-700 uppercase">{color}</span>
                                                    <span className="text-[10px] text-slate-400 ml-auto">{variants.map(v => v.format).join(' · ')}</span>
                                                </div>

                                                {/* Format rows – compact table */}
                                                {isColorExpanded && (
                                                    <div className="overflow-hidden">
                                                        <table className="w-full text-xs">
                                                            <thead>
                                                                <tr className="text-[10px] uppercase text-slate-400 tracking-wider bg-white">
                                                                    <th className="text-left pl-8 pr-2 py-1.5 font-semibold">Formato</th>
                                                                    <th className="text-center px-2 py-1.5 font-semibold w-16">Stock</th>
                                                                    <th className="text-center px-1 py-1.5 font-semibold w-24">Cant.</th>
                                                                    <th className="text-center pr-4 py-1.5 font-semibold w-16"></th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="bg-white">
                                                                {variants.map(variant => {
                                                                    const stock = getStock(variant);
                                                                    return (
                                                                        <tr key={variant.sku} className="border-t border-slate-100 hover:bg-orange-50/40 transition-colors">
                                                                            <td className="pl-8 pr-2 py-1.5">
                                                                                <div className="flex items-center gap-1.5">
                                                                                    <Box className="h-3 w-3 text-blue-400 flex-shrink-0" />
                                                                                    <span className="font-medium text-slate-700">{variant.format}</span>
                                                                                </div>
                                                                            </td>
                                                                            <td className="text-center px-2 py-1.5">
                                                                                <span className={`inline-block min-w-[28px] text-center text-[10px] font-bold px-1.5 py-0.5 rounded-full ${stock > 0
                                                                                    ? "bg-emerald-100 text-emerald-700"
                                                                                    : "bg-red-100 text-red-600"
                                                                                    }`}>
                                                                                    {stock}
                                                                                </span>
                                                                            </td>
                                                                            <td className="text-center px-1 py-1.5">
                                                                                <QuantitySelector
                                                                                    value={getQuantity(variant.sku, variant.minUnit || 1)}
                                                                                    onChange={val => setQuantity(variant.sku, val)}
                                                                                    min={variant.minUnit || 1}
                                                                                    step={variant.stepSize || 1}
                                                                                />
                                                                            </td>
                                                                            <td className="text-center pr-4 py-1.5">
                                                                                <button
                                                                                    className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-orange-500 hover:bg-orange-600 text-white transition-colors shadow-sm"
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        handleAddToCart(variant, product.genericName);
                                                                                    }}
                                                                                    title="Añadir al carrito"
                                                                                >
                                                                                    <ShoppingCart className="h-3.5 w-3.5" />
                                                                                </button>
                                                                            </td>
                                                                        </tr>
                                                                    );
                                                                })}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                )}
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
