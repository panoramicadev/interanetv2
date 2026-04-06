import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useCart } from "@/hooks/useCart";
import {
    Search, ChevronDown, ChevronRight, Package, Palette,
    ShoppingCart, Plus, Minus, Loader2, Box, Info, X, HelpCircle,
    Play, FileText, Ruler, ImageIcon
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
    imageUrl?: string | null;
}

interface GenericProduct {
    genericName: string;
    groupName: string | null;
    tags?: string[];
    breveResena?: string | null;
    imageUrl?: string | null;
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
        <div className="inline-flex items-center border-2 border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
            <button
                onClick={() => onChange(Math.max(min, value - step))}
                className="w-10 h-10 flex items-center justify-center hover:bg-slate-100 text-slate-500 transition-colors active:bg-slate-200"
                disabled={value <= min}
            >
                <Minus className="w-4 h-4" />
            </button>
            <input
                type="number"
                value={value}
                onChange={e => onChange(Math.max(min, parseInt(e.target.value) || min))}
                className="w-14 h-10 text-center text-base font-bold border-x-2 border-slate-200 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                min={min}
                step={step}
            />
            <button
                onClick={() => onChange(value + step)}
                className="w-10 h-10 flex items-center justify-center hover:bg-slate-100 text-slate-500 transition-colors active:bg-slate-200"
            >
                <Plus className="w-4 h-4" />
            </button>
        </div>
    );
}

export default function PublicCatalogProducts({ onScroll }: { onScroll?: (scrollTop: number) => void }) {
    const [search, setSearch] = useState("");
    const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
    const [expandedColors, setExpandedColors] = useState<Set<string>>(new Set());
    const [quantities, setQuantities] = useState<Record<string, number>>({});
    const { toast } = useToast();
    const { addItem } = useCart();

    // Info modal state
    const [infoModal, setInfoModal] = useState<{ open: boolean; productName: string; loading: boolean; data: any | null }>({
        open: false, productName: '', loading: false, data: null
    });

    const openInfoModal = useCallback(async (productName: string) => {
        setInfoModal({ open: true, productName, loading: true, data: null });
        try {
            const res = await fetch(`/api/public/product-content/${encodeURIComponent(productName)}`);
            const data = await res.json();
            setInfoModal(prev => ({ ...prev, loading: false, data }));
        } catch {
            setInfoModal(prev => ({ ...prev, loading: false, data: null }));
        }
    }, []);

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
                imageUrl: null,
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

    const getQuantity = (sku: string, defaultMin?: number) => quantities[sku] || defaultMin || 1;
    const setQuantity = (sku: string, val: number) => {
        setQuantities(prev => ({ ...prev, [sku]: val }));
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
            title: "✓ Agregado al carrito",
            description: `${qty}x ${productName} (${variant.color}, ${variant.format})`,
        });
    };

    return (
        <>
            <div className="flex flex-col h-full bg-gradient-to-b from-slate-50 to-white">
                {/* Product list */}
                <div className="flex-1 overflow-y-auto" onScroll={e => onScroll?.((e.target as HTMLDivElement).scrollTop)}>
                    {/* Search bar */}
                    <div className="px-4 py-4 border-b bg-white/80 backdrop-blur-md sticky top-0 z-10">
                        <div className="relative max-w-lg mx-auto">
                            <Search className="absolute left-4 top-3.5 h-5 w-5 text-slate-400" />
                            <Input
                                placeholder="Buscar producto, color o SKU..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="pl-12 h-12 text-base rounded-2xl border-2 border-slate-200 focus:border-orange-400 bg-white shadow-sm transition-all"
                            />
                        </div>
                        </div>

                    {isLoading && (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
                            <span className="ml-3 text-base text-slate-500">Cargando productos...</span>
                        </div>
                    )}

                    {!isLoading && filteredCatalog.length === 0 && (
                        <div className="text-center py-20">
                            <Package className="h-14 w-14 text-slate-300 mx-auto mb-4" />
                            <p className="text-lg text-slate-500 font-medium">No se encontraron productos</p>
                            <p className="text-sm text-slate-400 mt-1">Intenta con otro término de búsqueda</p>
                        </div>
                    )}

                    {/* Product Cards */}
                    <div className="px-3 py-3 space-y-2">
                        {!isLoading && filteredCatalog.map(product => {
                            const colorKeys = Object.keys(product.colors)
                                .sort((a, b) => product.colors[b].length - product.colors[a].length);
                            const isExpanded = expandedProducts.has(product.genericName);
                            const totalVariants = Object.values(product.colors).flat().length;

                            return (
                                <div
                                    key={product.genericName}
                                    className={`rounded-2xl border-2 overflow-hidden transition-all duration-300 ${
                                        isExpanded
                                            ? 'border-orange-300 shadow-lg shadow-orange-100/50 bg-white'
                                            : 'border-slate-100 bg-white hover:border-slate-200 hover:shadow-md'
                                    }`}
                                >
                                    {/* Product Header */}
                                    <div
                                        className={`cursor-pointer transition-all duration-200 ${
                                            isExpanded ? 'bg-gradient-to-r from-orange-50 to-amber-50' : 'hover:bg-slate-50/80'
                                        }`}
                                        onClick={() => toggleProduct(product.genericName)}
                                    >
                                        <div className="p-4 flex items-center gap-4">
                                            {/* Product Image */}
                                            <div className={`w-16 h-16 rounded-xl flex-shrink-0 overflow-hidden border-2 transition-all ${
                                                isExpanded ? 'border-orange-200 shadow-sm' : 'border-slate-100'
                                            }`}>
                                                {product.imageUrl ? (
                                                    <img
                                                        src={product.imageUrl}
                                                        alt={product.genericName}
                                                        loading="lazy"
                                                        decoding="async"
                                                        className="w-full h-full object-cover"
                                                        onError={(e) => {
                                                            (e.target as HTMLImageElement).style.display = 'none';
                                                            (e.target as HTMLImageElement).parentElement!.classList.add('bg-gradient-to-br', 'from-slate-100', 'to-slate-50', 'flex', 'items-center', 'justify-center');
                                                            const icon = document.createElement('div');
                                                            icon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="text-slate-300"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>';
                                                            (e.target as HTMLImageElement).parentElement!.appendChild(icon);
                                                        }}
                                                    />
                                                ) : (
                                                    <div className="w-full h-full bg-gradient-to-br from-slate-100 to-slate-50 flex items-center justify-center">
                                                        <ImageIcon className="w-6 h-6 text-slate-300" />
                                                    </div>
                                                )}
                                            </div>

                                            {/* Product Info */}
                                            <div className="flex-1 min-w-0">
                                                <h3 className={`text-base font-bold uppercase leading-tight ${
                                                    isExpanded ? 'text-orange-800' : 'text-slate-800'
                                                }`}>
                                                    {product.genericName}
                                                </h3>
                                                {/* Tags */}
                                                {(product.tags || []).length > 0 && (
                                                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                                        {(product.tags || []).map(tag => (
                                                            <span key={tag} className={`text-xs px-2.5 py-1 rounded-full font-bold whitespace-nowrap shadow-sm ${
                                                                tag === 'Mejor Precio' ? 'bg-emerald-500 text-white' :
                                                                tag === 'Rápida Rotación' ? 'bg-blue-500 text-white' :
                                                                tag === 'Pocas Unidades' ? 'bg-amber-500 text-white' :
                                                                'bg-gray-500 text-white'
                                                            }`}>
                                                                {tag === 'Mejor Precio' ? '💰 ' : tag === 'Rápida Rotación' ? '🔥 ' : tag === 'Pocas Unidades' ? '⚠️ ' : ''}{tag}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                                {product.breveResena && (
                                                    <p className="text-sm text-slate-500 mt-1 line-clamp-1">{product.breveResena}</p>
                                                )}
                                            </div>

                                            {/* Right side */}
                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                <div className="text-right">
                                                    <span className="text-sm font-semibold text-slate-500">
                                                        {colorKeys.length} color{colorKeys.length !== 1 ? 'es' : ''}
                                                    </span>
                                                </div>
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                                                    isExpanded ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-400'
                                                }`}>
                                                    {isExpanded
                                                        ? <ChevronDown className="h-5 w-5" />
                                                        : <ChevronRight className="h-5 w-5" />
                                                    }
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Expanded Content */}
                                    {isExpanded && (
                                        <div className="border-t-2 border-orange-100">
                                            {/* Info Button */}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    openInfoModal(product.genericName);
                                                }}
                                                className="w-full flex items-center justify-between px-5 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 transition-all group border-b border-blue-100"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                                                        <Info className="h-4 w-4 text-blue-600" />
                                                    </div>
                                                    <span className="text-sm font-bold text-blue-700 group-hover:text-blue-800">Ver ficha técnica</span>
                                                    <div className="flex items-center gap-1.5">
                                                        <Play className="h-3.5 w-3.5 text-blue-400" />
                                                        <FileText className="h-3.5 w-3.5 text-blue-400" />
                                                        <Ruler className="h-3.5 w-3.5 text-blue-400" />
                                                    </div>
                                                </div>
                                                <ChevronRight className="h-4 w-4 text-blue-400 group-hover:text-blue-600 transition-colors" />
                                            </button>

                                            {/* Color sections */}
                                            {colorKeys.map(color => {
                                                const variants = product.colors[color];
                                                const isColorExpanded = expandedColors.has(`${product.genericName}-${color}`);

                                                return (
                                                    <div key={color}>
                                                        {/* Color Header */}
                                                        <div
                                                            className={`flex items-center gap-3 px-5 py-3 cursor-pointer transition-all border-b ${
                                                                isColorExpanded
                                                                    ? 'bg-amber-50/80 border-amber-100'
                                                                    : 'bg-slate-50/50 border-slate-100 hover:bg-slate-100/80'
                                                            }`}
                                                            onClick={() => toggleColor(product.genericName, color)}
                                                        >
                                                            <div className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                                                                isColorExpanded ? 'bg-orange-500 text-white' : 'bg-slate-200 text-slate-400'
                                                            }`}>
                                                                {isColorExpanded
                                                                    ? <ChevronDown className="h-4 w-4" />
                                                                    : <ChevronRight className="h-4 w-4" />
                                                                }
                                                            </div>
                                                            {/* Per-color thumbnail */}
                                                            {(() => {
                                                                const colorImg = variants.find(v => v.imageUrl)?.imageUrl;
                                                                return colorImg ? (
                                                                    <div className="w-9 h-9 rounded-lg overflow-hidden border border-slate-200 flex-shrink-0 bg-white">
                                                                        <img src={colorImg} alt={color} loading="lazy" decoding="async" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                                                    </div>
                                                                ) : (
                                                                    <Palette className="h-4 w-4 text-orange-500" />
                                                                );
                                                            })()}
                                                            <span className="text-sm font-bold text-slate-700 uppercase flex-1">{color}</span>
                                                            <span className="text-sm text-slate-400 font-medium">
                                                                {variants.length} formato{variants.length > 1 ? 's' : ''}
                                                            </span>
                                                        </div>

                                                        {/* Format Variants */}
                                                        {isColorExpanded && (
                                                            <div className="bg-white">
                                                                {variants.map(variant => {
                                                                    const stock = getStock(variant);
                                                                    return (
                                                                        <div
                                                                            key={variant.sku}
                                                                            className="px-5 py-3.5 border-b border-slate-50 last:border-b-0 hover:bg-orange-50/30 transition-colors"
                                                                        >
                                                                            <div className="flex items-center gap-3 mb-2.5">
                                                                                {/* Format Info */}
                                                                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                                                                    <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                                                                                        <Box className="h-4 w-4 text-blue-500" />
                                                                                    </div>
                                                                                    <div className="min-w-0">
                                                                                        <span className="text-base font-bold text-slate-800 block">
                                                                                            {variant.format}
                                                                                        </span>
                                                                                        <span className="text-xs text-slate-400 font-mono">{variant.sku}</span>
                                                                                    </div>
                                                                                </div>
                                                                                {/* Stock Badge */}
                                                                                <div className={`px-3 py-1.5 rounded-xl text-sm font-bold ${
                                                                                    stock > 0
                                                                                        ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                                                                                        : 'bg-red-50 text-red-600 border border-red-200'
                                                                                }`}>
                                                                                    {stock > 0 ? `${stock} uds` : 'Sin stock'}
                                                                                </div>
                                                                            </div>

                                                                            {/* Quantity + Cart Row */}
                                                                            <div className="flex items-center gap-3 justify-end">
                                                                                <QuantitySelector
                                                                                    value={getQuantity(variant.sku, variant.minUnit || 1)}
                                                                                    onChange={val => setQuantity(variant.sku, val)}
                                                                                    min={variant.minUnit || 1}
                                                                                    step={variant.stepSize || 1}
                                                                                />
                                                                                <button
                                                                                    className="inline-flex items-center gap-2 px-5 h-10 rounded-xl bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white transition-all shadow-md shadow-orange-200 hover:shadow-lg hover:shadow-orange-300 font-bold text-sm"
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        handleAddToCart(variant, product.genericName);
                                                                                    }}
                                                                                    title="Añadir al carrito"
                                                                                >
                                                                                    <ShoppingCart className="h-4 w-4" />
                                                                                    <span className="hidden sm:inline">Agregar</span>
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
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
            </div>

            {/* Product Info Modal */}
            {infoModal.open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setInfoModal({ open: false, productName: '', loading: false, data: null })}>
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
                    <div
                        className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto mx-4"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Modal header */}
                        <div className="sticky top-0 bg-white border-b px-5 py-4 rounded-t-2xl flex items-center justify-between z-10">
                            <div>
                                <h3 className="font-bold text-lg text-slate-800 uppercase">{infoModal.productName}</h3>
                                <p className="text-sm text-slate-500">Ficha Técnica del Producto</p>
                            </div>
                            <button
                                onClick={() => setInfoModal({ open: false, productName: '', loading: false, data: null })}
                                className="p-2 rounded-xl hover:bg-slate-100 transition-colors"
                            >
                                <X className="h-5 w-5 text-slate-500" />
                            </button>
                        </div>

                        {/* Modal body */}
                        <div className="px-5 py-5">
                            {infoModal.loading ? (
                                <div className="flex items-center justify-center py-16">
                                    <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
                                    <span className="ml-3 text-base text-slate-500">Cargando información...</span>
                                </div>
                            ) : !infoModal.data ? (
                                <div className="text-center py-16">
                                    <Package className="h-14 w-14 text-slate-300 mx-auto mb-4" />
                                    <p className="text-base text-slate-500 font-medium">No hay información técnica disponible.</p>
                                    <p className="text-sm text-slate-400 mt-1">El administrador puede cargarla desde el panel.</p>
                                </div>
                            ) : (
                                <div className="space-y-5">
                                    {/* Featured Image */}
                                    {infoModal.data.imagenDestacada && (
                                        <div className="rounded-xl overflow-hidden border-2 border-slate-100">
                                            <img
                                                src={infoModal.data.imagenDestacada}
                                                alt={infoModal.productName}
                                                loading="lazy"
                                                decoding="async"
                                                className="w-full max-h-64 object-contain bg-slate-50"
                                                onError={(e) => {
                                                    (e.target as HTMLImageElement).style.display = 'none';
                                                }}
                                            />
                                        </div>
                                    )}

                                    {infoModal.data.breveResena && (
                                        <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                                            <p className="text-base text-blue-800 font-medium">{infoModal.data.breveResena}</p>
                                        </div>
                                    )}

                                    {/* YouTube Video */}
                                    {infoModal.data.youtubeUrl && (() => {
                                        const url = infoModal.data.youtubeUrl;
                                        let videoId: string | null = null;
                                        try {
                                            if (url.includes('youtu.be/')) {
                                                videoId = url.split('youtu.be/')[1]?.split(/[?&#]/)[0] || null;
                                            } else if (url.includes('youtube.com')) {
                                                const urlObj = new URL(url);
                                                videoId = urlObj.searchParams.get('v');
                                            }
                                        } catch {}
                                        if (videoId) {
                                            return (
                                                <div className="rounded-xl overflow-hidden border-2 border-slate-100">
                                                    <iframe
                                                        src={`https://www.youtube.com/embed/${videoId}`}
                                                        className="w-full aspect-video"
                                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                                        allowFullScreen
                                                        title="Video del producto"
                                                    />
                                                </div>
                                            );
                                        }
                                        return null;
                                    })()}
                                    {infoModal.data.descripcion && (
                                        <div>
                                            <h4 className="text-sm font-bold text-slate-500 uppercase mb-2">Descripción</h4>
                                            <p className="text-base text-slate-700">{infoModal.data.descripcion}</p>
                                        </div>
                                    )}
                                    {infoModal.data.usos && (
                                        <div>
                                            <h4 className="text-sm font-bold text-slate-500 uppercase mb-2">Usos y Aplicaciones</h4>
                                            <p className="text-base text-slate-700">{infoModal.data.usos}</p>
                                        </div>
                                    )}
                                    {infoModal.data.presentacion && (
                                        <div>
                                            <h4 className="text-sm font-bold text-slate-500 uppercase mb-2">Presentaciones</h4>
                                            <p className="text-base text-slate-700">{infoModal.data.presentacion}</p>
                                        </div>
                                    )}
                                    {infoModal.data.rendimiento && (
                                        <div>
                                            <h4 className="text-sm font-bold text-slate-500 uppercase mb-2">Rendimiento</h4>
                                            <p className="text-base text-slate-700">{infoModal.data.rendimiento}</p>
                                        </div>
                                    )}
                                    {infoModal.data.preparacionSuperficie && (
                                        <div>
                                            <h4 className="text-sm font-bold text-slate-500 uppercase mb-2">Preparación de Superficie</h4>
                                            <p className="text-base text-slate-700">{infoModal.data.preparacionSuperficie}</p>
                                        </div>
                                    )}
                                    {infoModal.data.modoAplicacion && (
                                        <div>
                                            <h4 className="text-sm font-bold text-slate-500 uppercase mb-2">Modo de Aplicación</h4>
                                            <p className="text-base text-slate-700">{infoModal.data.modoAplicacion}</p>
                                        </div>
                                    )}
                                    {(infoModal.data.tiempoSecado || infoModal.data.capas || infoModal.data.dilucion) && (
                                        <div className="grid grid-cols-3 gap-3">
                                            {infoModal.data.tiempoSecado && (
                                                <div className="bg-slate-50 rounded-xl p-3">
                                                    <p className="text-xs font-bold text-slate-500 uppercase">Secado</p>
                                                    <p className="text-sm text-slate-700 mt-1 font-medium">{infoModal.data.tiempoSecado}</p>
                                                </div>
                                            )}
                                            {infoModal.data.capas && (
                                                <div className="bg-slate-50 rounded-xl p-3">
                                                    <p className="text-xs font-bold text-slate-500 uppercase">Capas</p>
                                                    <p className="text-sm text-slate-700 mt-1 font-medium">{infoModal.data.capas}</p>
                                                </div>
                                            )}
                                            {infoModal.data.dilucion && (
                                                <div className="bg-slate-50 rounded-xl p-3">
                                                    <p className="text-xs font-bold text-slate-500 uppercase">Dilución</p>
                                                    <p className="text-sm text-slate-700 mt-1 font-medium">{infoModal.data.dilucion}</p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    {infoModal.data.observaciones && (
                                        <div>
                                            <h4 className="text-sm font-bold text-slate-500 uppercase mb-2">Observaciones</h4>
                                            <p className="text-base text-slate-700">{infoModal.data.observaciones}</p>
                                        </div>
                                    )}

                                    {/* FAQs */}
                                    {(infoModal.data.preguntasFrecuentes || []).length > 0 && (
                                        <div className="border-t pt-5 mt-5">
                                            <h4 className="text-sm font-bold text-slate-500 uppercase mb-3 flex items-center gap-2">
                                                <HelpCircle className="h-4 w-4" />
                                                Preguntas Frecuentes
                                            </h4>
                                            <div className="space-y-3">
                                                {(infoModal.data.preguntasFrecuentes as Array<{pregunta: string; respuesta: string}>).map((faq: {pregunta: string; respuesta: string}, i: number) => (
                                                    <div key={i} className="bg-purple-50/50 rounded-xl p-4 border border-purple-100">
                                                        <p className="text-base font-bold text-purple-800">{faq.pregunta}</p>
                                                        <p className="text-sm text-purple-700 mt-1.5">{faq.respuesta}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
