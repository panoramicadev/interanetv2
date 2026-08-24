import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, Save, Upload, Package, Warehouse, FileText, Bot, Pencil, CheckCircle, AlertCircle, MessageCircle, Check, Users, Link2, Plus, Trash2, HelpCircle, ImageIcon, Youtube } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";

interface PriceItem {
    codigo: string;
    producto: string;
    unidad: string | null;
    lista: string | null;
    desc10: string | null;
    desc10_5: string | null;
    desc10_5_3: string | null;
    minimo: string | null;
}

interface InventoryItem {
    bodega: string;
    nombreBodega: string | null;
    stock1: number;
    stock2: number;
    unidad1: string | null;
    unidad2: string | null;
}

interface ProductQuestion {
    id: string;
    codigo: string;
    pregunta: string;
    contexto?: string | null;
    resuelta: boolean;
    resueltaAt?: string | null;
    resueltaPor?: string | null;
    createdAt: string;
}

interface ProductContentMeta {
    productFamily: string | null;
    familySiblingCount: number;
    isInherited: boolean;
    isFamilyLevel: boolean;
}

interface ProductContentData {
    id?: string;
    codigo: string;
    productFamily?: string | null;
    breveResena?: string;
    descripcion?: string;
    usos?: string;
    presentacion?: string;
    rendimiento?: string;
    preparacionSuperficie?: string;
    modoAplicacion?: string;
    tiempoSecado?: string;
    dilucion?: string;
    capas?: string;
    observaciones?: string;
    youtubeUrl?: string;
    imagenDestacada?: string;
    fichasTecnicas?: Array<{ name: string; url: string; type: string; uploadedAt: string }>;
    hojasSeguridad?: Array<{ name: string; url: string; uploadedAt: string }>;
    fotosPromocionales?: Array<{ name: string; url: string; uploadedAt: string }>;
    preguntasFrecuentes?: Array<{ pregunta: string; respuesta: string }>;
    updatedAt?: string;
    updatedBy?: string;
    _meta?: ProductContentMeta;
}

const fmtCurrency = (val: string | null | undefined) => {
    if (!val) return "—";
    const n = Number(val);
    if (isNaN(n) || n === 0) return "—";
    return `$${n.toLocaleString('de-DE', { maximumFractionDigits: 0 })}`;
};

export default function ProductCatalogDetail() {
    const { codigo } = useParams<{ codigo: string }>();
    const [, navigate] = useLocation();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const { user } = useAuth();

    // Form state for technical sheet
    const [form, setForm] = useState<Partial<ProductContentData>>({});
    const [isDirty, setIsDirty] = useState(false);
    const [newQ, setNewQ] = useState("");
    const [applyToFamily, setApplyToFamily] = useState(true); // Default: apply to entire family
    const [meta, setMeta] = useState<ProductContentMeta | null>(null);

    // Fetch product questions
    const { data: questions = [], isLoading: questionsLoading } = useQuery<ProductQuestion[]>({
        queryKey: ['/api/product-questions', codigo],
        queryFn: async () => {
            const res = await apiRequest('GET', `/api/product-questions/${encodeURIComponent(codigo!)}`);
            return res.json();
        },
        enabled: !!codigo,
    });

    const pendingCount = questions.filter(q => !q.resuelta).length;

    const resolveQuestion = useMutation({
        mutationFn: async (id: string) => {
            const res = await apiRequest('PUT', `/api/product-questions/${id}/resolve`, {});
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['/api/product-questions', codigo] });
            toast({ title: "Pregunta marcada como resuelta" });
        },
    });

    const logQuestion = useMutation({
        mutationFn: async (pregunta: string) => {
            const res = await apiRequest('POST', '/api/product-questions', { codigo, pregunta, contexto: 'Registrada manualmente por el administrador' });
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['/api/product-questions', codigo] });
            setNewQ("");
            toast({ title: "Pregunta registrada" });
        },
    });

    // Fetch price list info for this product
    const { data: priceInfo } = useQuery<{ items: PriceItem[] }>({
        queryKey: ['/api/price-list', { search: codigo, limit: 1 }],
        queryFn: async () => {
            const res = await apiRequest('GET', `/api/price-list?search=${encodeURIComponent(codigo!)}&limit=5`);
            return res.json();
        },
        enabled: !!codigo,
    });

    const product = priceInfo?.items?.find(p => p.codigo === codigo) || priceInfo?.items?.[0];

    // Fetch inventory stock by warehouse
    const { data: inventory = [], isLoading: inventoryLoading } = useQuery<InventoryItem[]>({
        queryKey: ['/api/inventory/by-product', codigo],
        queryFn: async () => {
            const res = await apiRequest('GET', `/api/inventory/by-product/${encodeURIComponent(codigo!)}`);
            return res.json();
        },
        enabled: !!codigo,
    });

    const totalStock = inventory.reduce((sum, i) => sum + i.stock2, 0);



    // Fetch product content / technical sheet
    const { data: content, isLoading: contentLoading } = useQuery<ProductContentData>({
        queryKey: ['/api/product-content', codigo],
        queryFn: async () => {
            const res = await apiRequest('GET', `/api/product-content/${encodeURIComponent(codigo!)}`);
            return res.json();
        },
        enabled: !!codigo,
    });

    // Fetch ecommerce product image directly as a fallback
    const { data: ecomProduct } = useQuery<{ imagenUrl?: string }>({
        queryKey: ['/api/ecommerce/admin/product-image', codigo],
        queryFn: async () => {
            const res = await apiRequest('GET', `/api/ecommerce/admin/product-image/${encodeURIComponent(codigo!)}`);
            return res.json();
        },
        enabled: !!codigo,
    });

    // Resolve the best available image (multiple fallback sources)
    const productImageUrl = content?.imagenDestacada || ecomProduct?.imagenUrl || null;

    // Sync content into form state when loaded
    useEffect(() => {
        if (content) {
            const { _meta, ...formData } = content;
            setForm(formData);
            if (_meta) {
                setMeta(_meta);
                // If content is family-level or inherited, default toggle ON
                setApplyToFamily(_meta.isFamilyLevel || _meta.isInherited || !_meta.productFamily ? true : true);
            }
        }
    }, [content]);

    // Save mutation
    const saveMutation = useMutation({
        mutationFn: async (data: Partial<ProductContentData>) => {
            console.log('[PRODUCT-CONTENT SAVE] Sending data:', JSON.stringify(data, null, 2));
            const res = await fetch(`/api/product-content/${encodeURIComponent(codigo!)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
                credentials: 'include',
            });
            if (!res.ok) {
                const errText = await res.text();
                throw new Error(errText || `Error ${res.status}`);
            }
            return res.json();
        },
        onSuccess: () => {
            // Invalidate ALL product-content queries (siblings may have been updated too)
            queryClient.invalidateQueries({ queryKey: ['/api/product-content'] });
            setIsDirty(false);
            toast({ title: "Ficha guardada", description: "La información del producto fue actualizada." });
        },
        onError: (error: any) => {
            console.error('[PRODUCT-CONTENT SAVE ERROR]', error);
            toast({ title: "Error al guardar", description: error?.message || "Error desconocido", variant: "destructive" });
        }
    });

    const handleChange = (field: keyof ProductContentData, value: string) => {
        setForm(prev => ({ ...prev, [field]: value }));
        setIsDirty(true);
    };

    const handleSave = () => {
        const { _meta, ...saveData } = form;
        saveMutation.mutate({ ...saveData, applyToFamily: applyToFamily && !!meta?.productFamily } as any);
    };

    // Build AI preview text
    const buildAiPreview = () => {
        const f = form;
        if (!product && !f.descripcion) return "No hay información de producto cargada aún.";
        const lines: string[] = [];
        if (product) {
            lines.push(`PRODUCTO: ${product.producto}`);
            lines.push(`CÓDIGO: ${product.codigo}`);
            if (product.unidad) lines.push(`UNIDAD: ${product.unidad}`);
            lines.push(`\nPRECIOS:`);
            if (product.lista) lines.push(`  - Lista: ${fmtCurrency(product.lista)}`);
            if (product.desc10) lines.push(`  - Desc. 10%: ${fmtCurrency(product.desc10)}`);
            if (product.desc10_5) lines.push(`  - Desc. 10%+5%: ${fmtCurrency(product.desc10_5)}`);
            if (product.desc10_5_3) lines.push(`  - Desc. 10%+5%+3%: ${fmtCurrency(product.desc10_5_3)}`);
            if (product.minimo) lines.push(`  - Mínimo: ${fmtCurrency(product.minimo)}`);
        }
        if (inventory.length > 0) {
            lines.push(`\nSTOCK POR BODEGA:`);
            inventory.forEach(i => {
                if (i.stock1 > 0 || i.stock2 > 0) {
                    lines.push(`  - ${i.nombreBodega || i.bodega}: ${i.stock1} ${i.unidad1 || ''} / ${i.stock2} ${i.unidad2 || ''}`);
                }
            });
        }
        if (f.descripcion) lines.push(`\nDESCRIPCIÓN:\n${f.descripcion}`);
        if (f.usos) lines.push(`\nUSOS Y APLICACIONES:\n${f.usos}`);
        if (f.presentacion) lines.push(`\nPRESENTACIONES:\n${f.presentacion}`);
        if (f.rendimiento) lines.push(`\nRENDIMIENTO:\n${f.rendimiento}`);
        if (f.modoAplicacion) lines.push(`\nMODO DE APLICACIÓN:\n${f.modoAplicacion}`);
        if (f.tiempoSecado) lines.push(`\nTIEMPO DE SECADO:\n${f.tiempoSecado}`);
        if (f.dilucion) lines.push(`\nDILUCIÓN:\n${f.dilucion}`);
        if (f.capas) lines.push(`\nNÚMERO DE CAPAS:\n${f.capas}`);
        if (f.preparacionSuperficie) lines.push(`\nPREPARACIÓN DE SUPERFICIE:\n${f.preparacionSuperficie}`);
        if (f.observaciones) lines.push(`\nOBSERVACIONES:\n${f.observaciones}`);
        return lines.join('\n');
    };

    if (!codigo) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <p className="text-muted-foreground">Código de producto no especificado.</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <div className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                        <Button variant="ghost" size="sm" onClick={() => navigate('/productos')}>
                            <ArrowLeft className="h-4 w-4 mr-1" />
                            Productos
                        </Button>
                        <Separator orientation="vertical" className="h-5" />
                        {/* Product image */}
                        {productImageUrl ? (
                            <div className="w-14 h-14 rounded-xl border border-gray-200 overflow-hidden bg-white shrink-0 shadow-sm">
                                <img
                                    src={productImageUrl}
                                    alt={product?.producto || "Producto"}
                                    className="w-full h-full object-contain p-1"
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).style.display = 'none';
                                    }}
                                />
                            </div>
                        ) : (
                            <div className="w-14 h-14 rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-center shrink-0">
                                <ImageIcon className="h-6 w-6 text-gray-300" />
                            </div>
                        )}
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                                <span className="font-mono text-sm text-muted-foreground">{codigo}</span>
                                {totalStock > 0 && (
                                    <Badge variant="secondary" className="text-xs">
                                        {totalStock.toLocaleString()} uds. en stock
                                    </Badge>
                                )}
                            </div>
                            <h1 className="text-lg font-bold truncate mt-0.5">
                                {product?.producto || "Producto"}
                            </h1>
                        </div>
                    </div>
                    {isDirty && (
                        <Badge variant="destructive" className="text-xs animate-pulse">
                            Cambios sin guardar
                        </Badge>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
                <Tabs defaultValue="info" className="space-y-6">
                    <TabsList className="grid grid-cols-4 w-full max-w-2xl">
                        <TabsTrigger value="info">
                            <Package className="h-4 w-4 mr-1.5" />
                            Información
                        </TabsTrigger>
                        <TabsTrigger value="ficha">
                            <FileText className="h-4 w-4 mr-1.5" />
                            Ficha Técnica
                        </TabsTrigger>
                        <TabsTrigger value="archivos">
                            <Upload className="h-4 w-4 mr-1.5" />
                            Archivos
                        </TabsTrigger>
                        <TabsTrigger value="ia">
                            <Bot className="h-4 w-4 mr-1.5" />
                            Vista IA
                        </TabsTrigger>
                    </TabsList>

                    {/* ── Tab: Información ── */}
                    <TabsContent value="info" className="space-y-6">
                        {/* Product Image + Info Grid */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Product Image Card */}
                            <div className="lg:col-span-1">
                                <Card className="h-full">
                                    <CardContent className="p-4 flex items-center justify-center h-full min-h-[200px]">
                                        {productImageUrl ? (
                                            <img
                                                src={productImageUrl}
                                                alt={product?.producto || "Producto"}
                                                className="max-w-full max-h-[280px] object-contain rounded-lg"
                                                onError={(e) => {
                                                    (e.target as HTMLImageElement).style.display = 'none';
                                                    (e.target as HTMLImageElement).parentElement!.innerHTML = '<div class="flex flex-col items-center justify-center text-gray-300 py-8"><svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg><p class="text-sm mt-2">Sin imagen</p></div>';
                                                }}
                                            />
                                        ) : (
                                            <div className="flex flex-col items-center justify-center text-gray-300 py-8">
                                                <ImageIcon className="h-12 w-12" />
                                                <p className="text-sm mt-2">Sin imagen del producto</p>
                                                <p className="text-xs text-gray-400 mt-1">Sube una imagen en la pestaña Ficha Técnica</p>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Precios + Stock */}
                            <div className="lg:col-span-2 grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Precios SAP */}
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-base">Precios SAP</CardTitle>
                                    <CardDescription>Lista de precios oficial actualizada desde el sistema</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {product ? (
                                        <div className="space-y-3">
                                            <div className="grid grid-cols-2 gap-3">
                                                {[
                                                    { label: "Lista", val: (() => {
                                                        const lista = Number(product.lista);
                                                        if (lista > 0) return product.lista;
                                                        const desc10 = Number(product.desc10);
                                                        if (desc10 > 0) return String(Math.round(desc10 / 0.90));
                                                        return null;
                                                    })() },
                                                    { label: "Desc. 10%", val: product.desc10 },
                                                    { label: "Desc. 10%+5%", val: product.desc10_5 },
                                                    { label: "Desc. 10%+5%+3%", val: product.desc10_5_3 },
                                                    { label: "Mínimo", val: product.minimo },
                                                ].map(({ label, val }) => (
                                                    <div key={label} className="bg-muted/40 rounded-lg p-3">
                                                        <p className="text-xs text-muted-foreground">{label}</p>
                                                        <p className="font-semibold text-sm mt-0.5">{fmtCurrency(val)}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="text-sm text-muted-foreground">No hay datos de lista de precios para este código.</p>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Stock por Bodega */}
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <Warehouse className="h-4 w-4" />
                                        Stock por Bodega
                                    </CardTitle>
                                    <CardDescription>
                                        Disponibilidad actual en el inventario
                                        {totalStock > 0 && (
                                            <span className="ml-2 font-semibold text-green-600">Total: {totalStock.toLocaleString()} uds.</span>
                                        )}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {inventoryLoading ? (
                                        <div className="space-y-2">
                                            {[1, 2, 3].map(i => (
                                                <div key={i} className="h-10 bg-muted animate-pulse rounded-md" />
                                            ))}
                                        </div>
                                    ) : inventory.length === 0 ? (
                                        <Alert>
                                            <AlertCircle className="h-4 w-4" />
                                            <AlertTitle>Sin datos de inventario</AlertTitle>
                                            <AlertDescription>
                                                Este producto no tiene registros en el sistema de inventario. Sincroniza el inventario desde la sección correspondiente.
                                            </AlertDescription>
                                        </Alert>
                                    ) : (
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Bodega</TableHead>
                                                    <TableHead className="text-right">Stock Primario</TableHead>
                                                    <TableHead className="text-right">Stock Secundario</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {inventory.map((item) => (
                                                    <TableRow key={item.bodega}>
                                                        <TableCell>
                                                            <div>
                                                                <p className="font-medium text-sm">{item.nombreBodega || item.bodega}</p>
                                                                <p className="text-xs text-muted-foreground font-mono">{item.bodega}</p>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <span className={item.stock1 > 0 ? "font-semibold text-green-700" : "text-muted-foreground"}>
                                                                {item.stock1.toLocaleString()} {item.unidad1 || ''}
                                                            </span>
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <span className={item.stock2 > 0 ? "font-semibold text-blue-700" : "text-muted-foreground"}>
                                                                {item.stock2.toLocaleString()} {item.unidad2 || ''}
                                                            </span>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    )}
                                </CardContent>
                            </Card>
                            </div> {/* Close lg:col-span-2 */}
                        </div> {/* Close lg:grid-cols-3 */}

                        {/* Read-only Ficha Técnica Summary */}
                        {(form.breveResena || form.descripcion || form.usos || form.rendimiento || form.modoAplicacion) && (
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <FileText className="h-4 w-4 text-blue-600" />
                                        Resumen Ficha Técnica
                                    </CardTitle>
                                    <CardDescription>Información técnica del producto (editable en la pestaña Ficha Técnica)</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-3 text-sm">
                                        {form.breveResena && (
                                            <div>
                                                <span className="font-semibold text-slate-700">Breve Reseña:</span>
                                                <p className="text-slate-600 mt-0.5">{form.breveResena}</p>
                                            </div>
                                        )}
                                        {form.descripcion && (
                                            <div>
                                                <span className="font-semibold text-slate-700">Descripción:</span>
                                                <p className="text-slate-600 mt-0.5">{form.descripcion}</p>
                                            </div>
                                        )}
                                        {form.usos && (
                                            <div>
                                                <span className="font-semibold text-slate-700">Usos:</span>
                                                <p className="text-slate-600 mt-0.5">{form.usos}</p>
                                            </div>
                                        )}
                                        {form.rendimiento && (
                                            <div>
                                                <span className="font-semibold text-slate-700">Rendimiento:</span>
                                                <p className="text-slate-600 mt-0.5">{form.rendimiento}</p>
                                            </div>
                                        )}
                                        {form.modoAplicacion && (
                                            <div>
                                                <span className="font-semibold text-slate-700">Modo de Aplicación:</span>
                                                <p className="text-slate-600 mt-0.5">{form.modoAplicacion}</p>
                                            </div>
                                        )}
                                        {form.tiempoSecado && (
                                            <div>
                                                <span className="font-semibold text-slate-700">Tiempo de Secado:</span>
                                                <p className="text-slate-600 mt-0.5">{form.tiempoSecado}</p>
                                            </div>
                                        )}
                                        {(form.preguntasFrecuentes || []).length > 0 && (
                                            <div>
                                                <span className="font-semibold text-slate-700">Preguntas Frecuentes:</span>
                                                <span className="text-slate-500 ml-1">{form.preguntasFrecuentes!.length} registradas</span>
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </TabsContent>

                    {/* ── Tab: Ficha Técnica ── */}
                    <TabsContent value="ficha" className="space-y-6">
                        {/* Family toggle */}
                        {meta?.productFamily && (
                            <Alert className={`border-blue-200 ${applyToFamily ? 'bg-blue-50' : 'bg-slate-50 border-slate-200'}`}>
                                <Users className={`h-4 w-4 ${applyToFamily ? 'text-blue-600' : 'text-slate-500'}`} />
                                <AlertTitle className={applyToFamily ? 'text-blue-800' : 'text-slate-700'}>
                                    <div className="flex items-center justify-between">
                                        <span>
                                            {applyToFamily
                                                ? `Ficha compartida con toda la familia`
                                                : `Ficha individual para este SKU`}
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-normal">
                                                Aplicar a toda la familia
                                            </span>
                                            <Switch
                                                checked={applyToFamily}
                                                onCheckedChange={(checked) => {
                                                    setApplyToFamily(checked);
                                                    setIsDirty(true);
                                                }}
                                            />
                                        </div>
                                    </div>
                                </AlertTitle>
                                <AlertDescription className={applyToFamily ? 'text-blue-700' : 'text-slate-600'}>
                                    {applyToFamily ? (
                                        <>
                                            <strong>"{meta.productFamily}"</strong> — esta ficha técnica se aplica a los{' '}
                                            <strong>{meta.familySiblingCount} SKUs</strong> de esta familia.
                                            {meta.isInherited && (
                                                <span className="ml-1 inline-flex items-center gap-1 text-xs">
                                                    <Link2 className="h-3 w-3" /> Heredada
                                                </span>
                                            )}
                                        </>
                                    ) : (
                                        <>Al guardar, esta ficha solo se aplicará a <strong>{codigo}</strong>. Los demás SKUs de la familia no se verán afectados.</>
                                    )}
                                </AlertDescription>
                            </Alert>
                        )}

                        {isDirty && (
                            <Alert className="border-orange-200 bg-orange-50">
                                <Pencil className="h-4 w-4 text-orange-600" />
                                <AlertTitle className="text-orange-800">Cambios sin guardar</AlertTitle>
                                <AlertDescription className="text-orange-700">
                                    Hay cambios pendientes. Usa la barra inferior para guardar.
                                </AlertDescription>
                            </Alert>
                        )}

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Columna izquierda */}
                            <div className="space-y-5">
                                <Card>
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-base">Descripción del Producto</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="space-y-1.5">
                                            <Label htmlFor="breveResena">Breve Reseña</Label>
                                            <Textarea
                                                id="breveResena"
                                                placeholder="Una breve reseña del producto que se mostrará en el catálogo del vendedor..."
                                                value={form.breveResena || ""}
                                                onChange={e => handleChange('breveResena', e.target.value)}
                                                rows={2}
                                            />
                                            <p className="text-[10px] text-muted-foreground">Se muestra debajo del nombre del producto en el catálogo del vendedor.</p>
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label htmlFor="descripcion">Descripción General</Label>
                                            <Textarea
                                                id="descripcion"
                                                placeholder="Describe el producto, sus características y ventajas principales..."
                                                value={form.descripcion || ""}
                                                onChange={e => handleChange('descripcion', e.target.value)}
                                                rows={4}
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label htmlFor="usos">Usos y Aplicaciones</Label>
                                            <Textarea
                                                id="usos"
                                                placeholder="¿Para qué superficies es ideal? ¿En qué condiciones se usa?"
                                                value={form.usos || ""}
                                                onChange={e => handleChange('usos', e.target.value)}
                                                rows={3}
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label htmlFor="presentacion">Presentaciones Disponibles</Label>
                                            <Input
                                                id="presentacion"
                                                placeholder="Ej: 1/4 galón, 1 galón, 4 galones"
                                                value={form.presentacion || ""}
                                                onChange={e => handleChange('presentacion', e.target.value)}
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label htmlFor="rendimiento">Rendimiento Teórico</Label>
                                            <Input
                                                id="rendimiento"
                                                placeholder="Ej: 10-12 m² por litro en una mano"
                                                value={form.rendimiento || ""}
                                                onChange={e => handleChange('rendimiento', e.target.value)}
                                            />
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Columna derecha */}
                            <div className="space-y-5">
                                <Card>
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-base">Aplicación</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="space-y-1.5">
                                            <Label htmlFor="preparacionSuperficie">Preparación de Superficie</Label>
                                            <Textarea
                                                id="preparacionSuperficie"
                                                placeholder="Limpieza, lijado, imprimación necesaria..."
                                                value={form.preparacionSuperficie || ""}
                                                onChange={e => handleChange('preparacionSuperficie', e.target.value)}
                                                rows={3}
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label htmlFor="modoAplicacion">Modo de Aplicación</Label>
                                            <Textarea
                                                id="modoAplicacion"
                                                placeholder="Brocha, rodillo, pistola. Instrucciones de aplicación..."
                                                value={form.modoAplicacion || ""}
                                                onChange={e => handleChange('modoAplicacion', e.target.value)}
                                                rows={3}
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1.5">
                                                <Label htmlFor="tiempoSecado">Tiempo de Secado</Label>
                                                <Input
                                                    id="tiempoSecado"
                                                    placeholder="Ej: 2-4 horas al tacto"
                                                    value={form.tiempoSecado || ""}
                                                    onChange={e => handleChange('tiempoSecado', e.target.value)}
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label htmlFor="capas">Número de Manos</Label>
                                                <Input
                                                    id="capas"
                                                    placeholder="Ej: 2 manos"
                                                    value={form.capas || ""}
                                                    onChange={e => handleChange('capas', e.target.value)}
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label htmlFor="dilucion">Dilución</Label>
                                            <Input
                                                id="dilucion"
                                                placeholder="Ej: 10-15% de aguarrás mineral"
                                                value={form.dilucion || ""}
                                                onChange={e => handleChange('dilucion', e.target.value)}
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label htmlFor="observaciones">Observaciones / Seguridad</Label>
                                            <Textarea
                                                id="observaciones"
                                                placeholder="Precauciones, almacenamiento, disposición de residuos..."
                                                value={form.observaciones || ""}
                                                onChange={e => handleChange('observaciones', e.target.value)}
                                                rows={3}
                                            />
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Multimedia Card */}
                                <Card>
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-base flex items-center gap-2">
                                            <Youtube className="h-4 w-4 text-red-600" />
                                            Multimedia
                                        </CardTitle>
                                        <CardDescription>Video de YouTube e imagen destacada del producto</CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="space-y-1.5">
                                            <Label htmlFor="youtubeUrl">Video de YouTube</Label>
                                            <Input
                                                id="youtubeUrl"
                                                placeholder="https://www.youtube.com/watch?v=... o https://youtu.be/..."
                                                value={form.youtubeUrl || ""}
                                                onChange={e => handleChange('youtubeUrl', e.target.value)}
                                            />
                                            <p className="text-[10px] text-muted-foreground">Pega la URL del video de YouTube del producto.</p>
                                            {form.youtubeUrl && (() => {
                                                const url = form.youtubeUrl;
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
                                                        <div className="mt-2 rounded-lg overflow-hidden border">
                                                            <iframe
                                                                src={`https://www.youtube.com/embed/${videoId}`}
                                                                className="w-full aspect-video"
                                                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                                                allowFullScreen
                                                                title="YouTube video preview"
                                                            />
                                                        </div>
                                                    );
                                                }
                                                return <p className="text-xs text-orange-600 mt-1">URL no válida. Usa una URL de YouTube.</p>;
                                            })()}
                                        </div>
                                        <Separator />
                                        <div className="space-y-1.5">
                                            <Label htmlFor="imagenDestacada">Imagen Destacada</Label>
                                            <Input
                                                id="imagenDestacada"
                                                placeholder="https://ejemplo.com/imagen-producto.jpg"
                                                value={form.imagenDestacada || ""}
                                                onChange={e => handleChange('imagenDestacada', e.target.value)}
                                            />
                                            <p className="text-[10px] text-muted-foreground">URL de la imagen destacada del producto.</p>
                                            {form.imagenDestacada && (
                                                <div className="mt-2 rounded-lg overflow-hidden border bg-muted/30 p-2">
                                                    <img
                                                        src={form.imagenDestacada}
                                                        alt="Imagen destacada del producto"
                                                        className="w-full max-h-48 object-contain rounded"
                                                        onError={(e) => {
                                                            (e.target as HTMLImageElement).style.display = 'none';
                                                        }}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </div>

                        {/* ── Preguntas Frecuentes ── */}
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <HelpCircle className="h-4 w-4 text-purple-600" />
                                    Preguntas Frecuentes
                                </CardTitle>
                                <CardDescription>Agrega preguntas frecuentes de clientes sobre este producto. Se comparten con toda la familia.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {(form.preguntasFrecuentes || []).map((faq, idx) => (
                                    <div key={idx} className="border rounded-lg p-3 space-y-2 bg-muted/30 relative group">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const updated = [...(form.preguntasFrecuentes || [])];
                                                updated.splice(idx, 1);
                                                setForm(prev => ({ ...prev, preguntasFrecuentes: updated }));
                                                setIsDirty(true);
                                            }}
                                            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-600 p-1 rounded"
                                            title="Eliminar pregunta"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                        <div className="space-y-1">
                                            <Label className="text-xs font-semibold text-purple-700">Pregunta</Label>
                                            <Input
                                                placeholder="Ej: ¿Cuánto rinde por galón?"
                                                value={faq.pregunta}
                                                onChange={e => {
                                                    const updated = [...(form.preguntasFrecuentes || [])];
                                                    updated[idx] = { ...updated[idx], pregunta: e.target.value };
                                                    setForm(prev => ({ ...prev, preguntasFrecuentes: updated }));
                                                    setIsDirty(true);
                                                }}
                                                className="text-sm"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs font-semibold text-green-700">Respuesta</Label>
                                            <Textarea
                                                placeholder="Respuesta para el cliente..."
                                                value={faq.respuesta}
                                                onChange={e => {
                                                    const updated = [...(form.preguntasFrecuentes || [])];
                                                    updated[idx] = { ...updated[idx], respuesta: e.target.value };
                                                    setForm(prev => ({ ...prev, preguntasFrecuentes: updated }));
                                                    setIsDirty(true);
                                                }}
                                                rows={2}
                                                className="text-sm"
                                            />
                                        </div>
                                    </div>
                                ))}
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        setForm(prev => ({
                                            ...prev,
                                            preguntasFrecuentes: [...(prev.preguntasFrecuentes || []), { pregunta: '', respuesta: '' }]
                                        }));
                                        setIsDirty(true);
                                    }}
                                    className="gap-1.5"
                                >
                                    <Plus className="h-3.5 w-3.5" />
                                    Agregar pregunta
                                </Button>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* ── Tab: Archivos ── */}
                    <TabsContent value="archivos" className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {/* Fichas Técnicas */}
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-base">Fichas Técnicas</CardTitle>
                                    <CardDescription>PDFs con especificaciones técnicas del producto</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    {(form.fichasTecnicas || []).map((f, i) => (
                                        <div key={i} className="flex items-center gap-3 p-2.5 bg-muted/40 rounded-lg group">
                                            <FileText className="h-4 w-4 text-blue-600 shrink-0" />
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-medium truncate">{f.name}</p>
                                                <p className="text-xs text-muted-foreground">{new Date(f.uploadedAt).toLocaleDateString()}</p>
                                            </div>
                                            <a href={f.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline shrink-0">
                                                Ver
                                            </a>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const updated = [...(form.fichasTecnicas || [])];
                                                    updated.splice(i, 1);
                                                    setForm(prev => ({ ...prev, fichasTecnicas: updated }));
                                                    setIsDirty(true);
                                                }}
                                                className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                                                title="Eliminar"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    ))}
                                    <label className="border-2 border-dashed border-muted hover:border-blue-400 rounded-lg p-6 text-center cursor-pointer transition-colors block">
                                        <input
                                            type="file"
                                            accept=".pdf"
                                            className="hidden"
                                            onChange={async (e) => {
                                                const file = e.target.files?.[0];
                                                if (!file) return;
                                                const formData = new FormData();
                                                formData.append('file', file);
                                                try {
                                                    const res = await fetch('/api/upload', { method: 'POST', body: formData, credentials: 'include' });
                                                    if (!res.ok) throw new Error('Upload failed');
                                                    const data = await res.json();
                                                    setForm(prev => ({
                                                        ...prev,
                                                        fichasTecnicas: [...(prev.fichasTecnicas || []), {
                                                            name: file.name,
                                                            url: data.url,
                                                            type: file.type,
                                                            uploadedAt: new Date().toISOString()
                                                        }]
                                                    }));
                                                    setIsDirty(true);
                                                    toast({ title: "Archivo cargado", description: `${file.name} subido correctamente.` });
                                                } catch {
                                                    toast({ title: "Error", description: "No se pudo subir el archivo.", variant: "destructive" });
                                                }
                                                e.target.value = '';
                                            }}
                                        />
                                        <Upload className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
                                        <p className="text-sm text-muted-foreground font-medium">Haz clic para subir ficha técnica</p>
                                        <p className="text-xs text-muted-foreground mt-1">PDF, máx. 10MB</p>
                                    </label>
                                </CardContent>
                            </Card>

                            {/* Hojas de Seguridad */}
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-base">Hojas de Seguridad</CardTitle>
                                    <CardDescription>SDS/MSDS - Seguridad y manejo del producto</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    {(form.hojasSeguridad || []).map((f, i) => (
                                        <div key={i} className="flex items-center gap-3 p-2.5 bg-muted/40 rounded-lg group">
                                            <FileText className="h-4 w-4 text-orange-600 shrink-0" />
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-medium truncate">{f.name}</p>
                                                <p className="text-xs text-muted-foreground">{new Date(f.uploadedAt).toLocaleDateString()}</p>
                                            </div>
                                            <a href={f.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline shrink-0">
                                                Ver
                                            </a>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const updated = [...(form.hojasSeguridad || [])];
                                                    updated.splice(i, 1);
                                                    setForm(prev => ({ ...prev, hojasSeguridad: updated }));
                                                    setIsDirty(true);
                                                }}
                                                className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                                                title="Eliminar"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    ))}
                                    <label className="border-2 border-dashed border-muted hover:border-orange-400 rounded-lg p-6 text-center cursor-pointer transition-colors block">
                                        <input
                                            type="file"
                                            accept=".pdf"
                                            className="hidden"
                                            onChange={async (e) => {
                                                const file = e.target.files?.[0];
                                                if (!file) return;
                                                const formData = new FormData();
                                                formData.append('file', file);
                                                try {
                                                    const res = await fetch('/api/upload', { method: 'POST', body: formData, credentials: 'include' });
                                                    if (!res.ok) throw new Error('Upload failed');
                                                    const data = await res.json();
                                                    setForm(prev => ({
                                                        ...prev,
                                                        hojasSeguridad: [...(prev.hojasSeguridad || []), {
                                                            name: file.name,
                                                            url: data.url,
                                                            uploadedAt: new Date().toISOString()
                                                        }]
                                                    }));
                                                    setIsDirty(true);
                                                    toast({ title: "Archivo cargado", description: `${file.name} subido correctamente.` });
                                                } catch {
                                                    toast({ title: "Error", description: "No se pudo subir el archivo.", variant: "destructive" });
                                                }
                                                e.target.value = '';
                                            }}
                                        />
                                        <Upload className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
                                        <p className="text-sm text-muted-foreground font-medium">Haz clic para subir hoja de seguridad</p>
                                        <p className="text-xs text-muted-foreground mt-1">PDF, máx. 10MB</p>
                                    </label>
                                </CardContent>
                            </Card>

                            {/* Fotos Promocionales */}
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-base">Fotos Promocionales</CardTitle>
                                    <CardDescription>Imágenes que se muestran en el detalle público del producto</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    {(form.fotosPromocionales || []).length > 0 && (
                                        <div className="grid grid-cols-2 gap-2">
                                            {(form.fotosPromocionales || []).map((f, i) => (
                                                <div key={i} className="relative group rounded-lg overflow-hidden border bg-muted/40 aspect-square">
                                                    <img
                                                        src={f.url}
                                                        alt={f.name}
                                                        className="w-full h-full object-cover"
                                                        loading="lazy"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const updated = [...(form.fotosPromocionales || [])];
                                                            updated.splice(i, 1);
                                                            setForm(prev => ({ ...prev, fotosPromocionales: updated }));
                                                            setIsDirty(true);
                                                        }}
                                                        className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow"
                                                        title="Eliminar"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </button>
                                                    <div className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[10px] px-1.5 py-1 truncate">
                                                        {f.name}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    <label className="border-2 border-dashed border-muted hover:border-purple-400 rounded-lg p-6 text-center cursor-pointer transition-colors block">
                                        <input
                                            type="file"
                                            accept="image/jpeg,image/png,image/webp,image/jpg"
                                            className="hidden"
                                            onChange={async (e) => {
                                                const file = e.target.files?.[0];
                                                if (!file) return;
                                                if (file.size > 10 * 1024 * 1024) {
                                                    toast({ title: "Archivo muy grande", description: "La imagen no puede superar los 10MB.", variant: "destructive" });
                                                    e.target.value = '';
                                                    return;
                                                }
                                                const formData = new FormData();
                                                formData.append('file', file);
                                                try {
                                                    const res = await fetch('/api/upload', { method: 'POST', body: formData, credentials: 'include' });
                                                    if (!res.ok) throw new Error('Upload failed');
                                                    const data = await res.json();
                                                    setForm(prev => ({
                                                        ...prev,
                                                        fotosPromocionales: [...(prev.fotosPromocionales || []), {
                                                            name: file.name,
                                                            url: data.url,
                                                            uploadedAt: new Date().toISOString()
                                                        }]
                                                    }));
                                                    setIsDirty(true);
                                                    toast({ title: "Imagen cargada", description: `${file.name} subida correctamente.` });
                                                } catch {
                                                    toast({ title: "Error", description: "No se pudo subir la imagen.", variant: "destructive" });
                                                }
                                                e.target.value = '';
                                            }}
                                        />
                                        <Upload className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
                                        <p className="text-sm text-muted-foreground font-medium">Haz clic para subir foto promocional</p>
                                        <p className="text-xs text-muted-foreground mt-1">JPG/PNG/WEBP, máx. 10MB</p>
                                    </label>
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>



                    {/* ── Tab: Vista IA ── */}
                    <TabsContent value="ia" className="space-y-4">
                        <Alert className="border-blue-200 bg-blue-50">
                            <Bot className="h-4 w-4 text-blue-600" />
                            <AlertTitle className="text-blue-800">Vista del Asistente IA</AlertTitle>
                            <AlertDescription className="text-blue-700">
                                Así es como el asistente IA verá la información de este producto cuando un usuario le pregunte sobre él. Completa la Ficha Técnica para enriquecer esta respuesta.
                            </AlertDescription>
                        </Alert>

                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <CheckCircle className="h-4 w-4 text-green-600" />
                                    Información disponible para la IA
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <pre className="text-xs font-mono bg-muted/40 rounded-lg p-4 whitespace-pre-wrap text-muted-foreground leading-relaxed max-h-[500px] overflow-y-auto">
                                    {buildAiPreview()}
                                </pre>
                            </CardContent>
                        </Card>

                        {content?.updatedAt && (
                            <p className="text-xs text-muted-foreground text-right">
                                Última actualización: {new Date((content as ProductContentData).updatedAt!).toLocaleString()} {(content as ProductContentData).updatedBy ? `por ${(content as ProductContentData).updatedBy}` : ''}
                            </p>
                        )}
                    </TabsContent>
                </Tabs>
            </div>

            {/* Sticky save bar */}
            {isDirty && (
                <div className="fixed bottom-0 left-0 lg:left-64 right-0 z-30 bg-white/95 backdrop-blur-sm border-t shadow-lg">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="h-2 w-2 bg-orange-500 rounded-full animate-pulse" />
                            <span className="text-sm text-muted-foreground">
                                Cambios sin guardar
                                {meta?.productFamily && applyToFamily && (
                                    <span className="ml-1 text-blue-600">
                                        · Se aplicará a toda la familia "{meta.productFamily}"
                                    </span>
                                )}
                            </span>
                        </div>
                        <div className="flex items-center gap-3">
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    if (content) {
                                        const { _meta, ...formData } = content;
                                        setForm(formData);
                                    }
                                    setIsDirty(false);
                                }}
                            >
                                Descartar
                            </Button>
                            <Button
                                type="button"
                                onClick={handleSave}
                                disabled={saveMutation.isPending}
                                className="bg-green-600 hover:bg-green-700 text-white gap-2"
                            >
                                {saveMutation.isPending ? (
                                    <>
                                        <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Guardando...
                                    </>
                                ) : (
                                    <>
                                        <Save className="h-4 w-4" />
                                        Guardar Cambios
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
