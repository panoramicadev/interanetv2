import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useCart } from "@/hooks/useCart";
import {
    Search, ChevronDown, ChevronRight, Package, Palette,
    ShoppingCart, Plus, Minus, Loader2, Box, Info, X, HelpCircle,
    Play, FileText, Ruler
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
    tags?: string[];
    breveResena?: string | null;
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
            title: "Agregado al carrito",
            description: `${qty}x ${productName} (${variant.color}, ${variant.format})`,
        });
    };

    return (
        <>
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
                        const colorKeys = Object.keys(product.colors)
                            .sort((a, b) => product.colors[b].length - product.colors[a].length);
                        const isExpanded = expandedProducts.has(product.genericName);
                        const totalVariants = Object.values(product.colors).flat().length;

                        return (
                            <div key={product.genericName} className="border-b border-slate-100">
                                {/* Product row */}
                                <div
                                    className="px-4 py-2.5 cursor-pointer hover:bg-orange-50/50 transition-colors"
                                    onClick={() => toggleProduct(product.genericName)}
                                >
                                    <div className="flex items-center gap-2">
                                        {isExpanded
                                            ? <ChevronDown className="h-4 w-4 text-orange-500 flex-shrink-0" />
                                            : <ChevronRight className="h-4 w-4 text-slate-400 flex-shrink-0" />
                                        }
                                        <span className={`text-sm font-medium flex-1 truncate uppercase ${isExpanded ? "text-orange-700" : "text-slate-800"}`}>
                                            {product.genericName}
                                        </span>
                                        <div className="flex items-center gap-1 flex-shrink-0">
                                            {(product.tags || []).map(tag => (
                                                <span key={tag} className={`text-[9px] px-2 py-0.5 rounded-full font-bold whitespace-nowrap shadow-sm ${
                                                    tag === 'Mejor Precio' ? 'bg-green-500 text-white' :
                                                    tag === 'Rápida Rotación' ? 'bg-blue-500 text-white' :
                                                    tag === 'Pocas Unidades' ? 'bg-amber-500 text-white' :
                                                    'bg-gray-500 text-white'
                                                }`}>
                                                    {tag === 'Mejor Precio' ? '💰 ' : tag === 'Rápida Rotación' ? '🔥 ' : tag === 'Pocas Unidades' ? '⚠️ ' : ''}{tag}
                                                </span>
                                            ))}
                                        </div>
                                        <span className="text-[10px] text-slate-400 flex-shrink-0 ml-1">
                                            {colorKeys.length} color{colorKeys.length !== 1 ? 'es' : ''}
                                        </span>
                                    </div>
                                    {product.breveResena && (
                                        <div className="ml-6 mt-1">
                                            <span className="text-[11px] text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md line-clamp-1 inline-block">{product.breveResena}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Expanded: colors → formats */}
                                {isExpanded && (
                                    <div className="bg-slate-50/80">
                                        {/* Más información button */}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                openInfoModal(product.genericName);
                                            }}
                                            className="w-full flex items-center justify-between px-5 py-2 border-b border-slate-200 bg-white hover:bg-orange-50/50 transition-all group border-l-[3px] border-l-orange-400"
                                        >
                                            <div className="flex items-center gap-3">
                                                <span className="text-xs font-semibold text-slate-700 group-hover:text-orange-700">Más información</span>
                                                <div className="flex items-center gap-1">
                                                    <Play className="h-3 w-3 text-orange-400" />
                                                    <FileText className="h-3 w-3 text-orange-400" />
                                                    <Ruler className="h-3 w-3 text-orange-400" />
                                                </div>
                                            </div>
                                            <ChevronRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-orange-500 transition-colors" />
                                        </button>
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

            {/* Product Info Modal */}
            {infoModal.open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setInfoModal({ open: false, productName: '', loading: false, data: null })}>
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
                    <div
                        className="relative bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[85vh] overflow-y-auto mx-4"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Modal header */}
                        <div className="sticky top-0 bg-white border-b px-5 py-4 rounded-t-2xl flex items-center justify-between">
                            <div>
                                <h3 className="font-bold text-base text-slate-800 uppercase">{infoModal.productName}</h3>
                                <p className="text-xs text-slate-500">Ficha Técnica del Producto</p>
                            </div>
                            <button
                                onClick={() => setInfoModal({ open: false, productName: '', loading: false, data: null })}
                                className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                            >
                                <X className="h-4 w-4 text-slate-500" />
                            </button>
                        </div>

                        {/* Modal body */}
                        <div className="px-5 py-4">
                            {infoModal.loading ? (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                                    <span className="ml-2 text-sm text-slate-500">Cargando información...</span>
                                </div>
                            ) : !infoModal.data ? (
                                <div className="text-center py-12">
                                    <Package className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                                    <p className="text-sm text-slate-500">No hay información técnica disponible para este producto.</p>
                                    <p className="text-xs text-slate-400 mt-1">El administrador puede cargarla desde el panel de productos.</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {/* Featured Image */}
                                    {infoModal.data.imagenDestacada && (
                                        <div className="rounded-lg overflow-hidden border">
                                            <img
                                                src={infoModal.data.imagenDestacada}
                                                alt={infoModal.productName}
                                                className="w-full max-h-56 object-contain bg-slate-50"
                                                onError={(e) => {
                                                    (e.target as HTMLImageElement).style.display = 'none';
                                                }}
                                            />
                                        </div>
                                    )}

                                    {infoModal.data.breveResena && (
                                        <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                                            <p className="text-sm text-blue-800 font-medium">{infoModal.data.breveResena}</p>
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
                                                <div className="rounded-lg overflow-hidden border">
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
                                            <h4 className="text-xs font-semibold text-slate-500 uppercase mb-1">Descripción</h4>
                                            <p className="text-sm text-slate-700">{infoModal.data.descripcion}</p>
                                        </div>
                                    )}
                                    {infoModal.data.usos && (
                                        <div>
                                            <h4 className="text-xs font-semibold text-slate-500 uppercase mb-1">Usos y Aplicaciones</h4>
                                            <p className="text-sm text-slate-700">{infoModal.data.usos}</p>
                                        </div>
                                    )}
                                    {infoModal.data.presentacion && (
                                        <div>
                                            <h4 className="text-xs font-semibold text-slate-500 uppercase mb-1">Presentaciones</h4>
                                            <p className="text-sm text-slate-700">{infoModal.data.presentacion}</p>
                                        </div>
                                    )}
                                    {infoModal.data.rendimiento && (
                                        <div>
                                            <h4 className="text-xs font-semibold text-slate-500 uppercase mb-1">Rendimiento</h4>
                                            <p className="text-sm text-slate-700">{infoModal.data.rendimiento}</p>
                                        </div>
                                    )}
                                    {infoModal.data.preparacionSuperficie && (
                                        <div>
                                            <h4 className="text-xs font-semibold text-slate-500 uppercase mb-1">Preparación de Superficie</h4>
                                            <p className="text-sm text-slate-700">{infoModal.data.preparacionSuperficie}</p>
                                        </div>
                                    )}
                                    {infoModal.data.modoAplicacion && (
                                        <div>
                                            <h4 className="text-xs font-semibold text-slate-500 uppercase mb-1">Modo de Aplicación</h4>
                                            <p className="text-sm text-slate-700">{infoModal.data.modoAplicacion}</p>
                                        </div>
                                    )}
                                    {(infoModal.data.tiempoSecado || infoModal.data.capas || infoModal.data.dilucion) && (
                                        <div className="grid grid-cols-3 gap-3">
                                            {infoModal.data.tiempoSecado && (
                                                <div className="bg-slate-50 rounded-lg p-2.5">
                                                    <p className="text-[10px] font-semibold text-slate-500 uppercase">Secado</p>
                                                    <p className="text-sm text-slate-700 mt-0.5">{infoModal.data.tiempoSecado}</p>
                                                </div>
                                            )}
                                            {infoModal.data.capas && (
                                                <div className="bg-slate-50 rounded-lg p-2.5">
                                                    <p className="text-[10px] font-semibold text-slate-500 uppercase">Capas</p>
                                                    <p className="text-sm text-slate-700 mt-0.5">{infoModal.data.capas}</p>
                                                </div>
                                            )}
                                            {infoModal.data.dilucion && (
                                                <div className="bg-slate-50 rounded-lg p-2.5">
                                                    <p className="text-[10px] font-semibold text-slate-500 uppercase">Dilución</p>
                                                    <p className="text-sm text-slate-700 mt-0.5">{infoModal.data.dilucion}</p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    {infoModal.data.observaciones && (
                                        <div>
                                            <h4 className="text-xs font-semibold text-slate-500 uppercase mb-1">Observaciones</h4>
                                            <p className="text-sm text-slate-700">{infoModal.data.observaciones}</p>
                                        </div>
                                    )}

                                    {/* FAQs */}
                                    {(infoModal.data.preguntasFrecuentes || []).length > 0 && (
                                        <div className="border-t pt-4 mt-4">
                                            <h4 className="text-xs font-semibold text-slate-500 uppercase mb-3 flex items-center gap-1.5">
                                                <HelpCircle className="h-3.5 w-3.5" />
                                                Preguntas Frecuentes
                                            </h4>
                                            <div className="space-y-3">
                                                {(infoModal.data.preguntasFrecuentes as Array<{pregunta: string; respuesta: string}>).map((faq: {pregunta: string; respuesta: string}, i: number) => (
                                                    <div key={i} className="bg-purple-50/50 rounded-lg p-3 border border-purple-100">
                                                        <p className="text-sm font-semibold text-purple-800">{faq.pregunta}</p>
                                                        <p className="text-sm text-purple-700 mt-1">{faq.respuesta}</p>
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
