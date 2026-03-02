import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, Save, Upload, Package, Warehouse, FileText, Bot, Pencil, CheckCircle, AlertCircle, MessageCircle, Check } from "lucide-react";
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

interface ProductContentData {
    id?: string;
    codigo: string;
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
    fichasTecnicas?: Array<{ name: string; url: string; type: string; uploadedAt: string }>;
    hojasSeguridad?: Array<{ name: string; url: string; uploadedAt: string }>;
    updatedAt?: string;
    updatedBy?: string;
}

const fmtCurrency = (val: string | null | undefined) => {
    if (!val) return "—";
    const n = Number(val);
    return isNaN(n) ? "—" : new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(n);
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

    // Sync content into form state when loaded
    useEffect(() => {
        if (content) {
            setForm(content);
        }
    }, [content]);

    // Save mutation
    const saveMutation = useMutation({
        mutationFn: async (data: Partial<ProductContentData>) => {
            const res = await apiRequest('PUT', `/api/product-content/${encodeURIComponent(codigo!)}`, data);
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['/api/product-content', codigo] });
            setIsDirty(false);
            toast({ title: "Ficha guardada", description: "La información del producto fue actualizada." });
        },
        onError: () => {
            toast({ title: "Error al guardar", variant: "destructive" });
        }
    });

    const handleChange = (field: keyof ProductContentData, value: string) => {
        setForm(prev => ({ ...prev, [field]: value }));
        setIsDirty(true);
    };

    const handleSave = () => {
        saveMutation.mutate(form);
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
                        <Button onClick={handleSave} disabled={saveMutation.isPending} className="shrink-0">
                            <Save className="h-4 w-4 mr-2" />
                            {saveMutation.isPending ? "Guardando..." : "Guardar Cambios"}
                        </Button>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
                <Tabs defaultValue="info" className="space-y-6">
                    <TabsList className="grid grid-cols-5 w-full max-w-2xl">
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
                        <TabsTrigger value="preguntas" className="relative">
                            <MessageCircle className="h-4 w-4 mr-1.5" />
                            Preguntas IA
                            {pendingCount > 0 && (
                                <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                                    {pendingCount}
                                </span>
                            )}
                        </TabsTrigger>
                        <TabsTrigger value="ia">
                            <Bot className="h-4 w-4 mr-1.5" />
                            Vista IA
                        </TabsTrigger>
                    </TabsList>

                    {/* ── Tab: Información ── */}
                    <TabsContent value="info" className="space-y-6">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                                                    { label: "Lista", val: product.lista },
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
                        </div>
                    </TabsContent>

                    {/* ── Tab: Ficha Técnica ── */}
                    <TabsContent value="ficha" className="space-y-6">
                        {isDirty && (
                            <Alert className="border-orange-200 bg-orange-50">
                                <Pencil className="h-4 w-4 text-orange-600" />
                                <AlertTitle className="text-orange-800">Cambios sin guardar</AlertTitle>
                                <AlertDescription className="text-orange-700">
                                    Hay cambios pendientes. Haz click en "Guardar Cambios" para confirmar.
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
                            </div>
                        </div>

                        <div className="flex justify-end">
                            <Button onClick={handleSave} disabled={saveMutation.isPending || !isDirty}>
                                <Save className="h-4 w-4 mr-2" />
                                {saveMutation.isPending ? "Guardando..." : "Guardar Ficha Técnica"}
                            </Button>
                        </div>
                    </TabsContent>

                    {/* ── Tab: Archivos ── */}
                    <TabsContent value="archivos" className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-base">Fichas Técnicas</CardTitle>
                                    <CardDescription>PDFs con especificaciones técnicas del producto</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {(form.fichasTecnicas || []).length === 0 ? (
                                        <div className="border-2 border-dashed border-muted rounded-lg p-8 text-center">
                                            <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                                            <p className="text-sm text-muted-foreground">No hay fichas técnicas adjuntas</p>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                Funcionalidad de carga de archivos próximamente
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {(form.fichasTecnicas || []).map((f, i) => (
                                                <div key={i} className="flex items-center gap-3 p-2 bg-muted/40 rounded-lg">
                                                    <FileText className="h-4 w-4 text-blue-600 shrink-0" />
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-sm font-medium truncate">{f.name}</p>
                                                        <p className="text-xs text-muted-foreground">{new Date(f.uploadedAt).toLocaleDateString()}</p>
                                                    </div>
                                                    <a href={f.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline shrink-0">
                                                        Ver
                                                    </a>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-base">Hojas de Seguridad</CardTitle>
                                    <CardDescription>SDS/MSDS - Seguridad y manejo del producto</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {(form.hojasSeguridad || []).length === 0 ? (
                                        <div className="border-2 border-dashed border-muted rounded-lg p-8 text-center">
                                            <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                                            <p className="text-sm text-muted-foreground">No hay hojas de seguridad adjuntas</p>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                Funcionalidad de carga de archivos próximamente
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {(form.hojasSeguridad || []).map((f, i) => (
                                                <div key={i} className="flex items-center gap-3 p-2 bg-muted/40 rounded-lg">
                                                    <FileText className="h-4 w-4 text-orange-600 shrink-0" />
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-sm font-medium truncate">{f.name}</p>
                                                        <p className="text-xs text-muted-foreground">{new Date(f.uploadedAt).toLocaleDateString()}</p>
                                                    </div>
                                                    <a href={f.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline shrink-0">
                                                        Ver
                                                    </a>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>

                    {/* ── Tab: Preguntas IA ── */}
                    <TabsContent value="preguntas" className="space-y-4">
                        <Alert className="border-purple-200 bg-purple-50">
                            <MessageCircle className="h-4 w-4 text-purple-600" />
                            <AlertTitle className="text-purple-800">Preguntas sin respuesta completa</AlertTitle>
                            <AlertDescription className="text-purple-700">
                                El asistente IA registra aquí las preguntas que recibe sobre este producto que no pudo resolver completamente por falta de información en la ficha técnica. Resuélvelas completando la Ficha Técnica y márcalas como resueltas.
                            </AlertDescription>
                        </Alert>

                        {/* Log manual question */}
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base">Registrar pregunta manualmente</CardTitle>
                                <CardDescription>Anota preguntas frecuentes de clientes que aún no están cubiertas en la ficha técnica</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="flex gap-2">
                                    <textarea
                                        className="flex-1 border rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                                        rows={2}
                                        placeholder="Ej: ¿Cuál es el rendimiento en m² por litro de este producto?"
                                        value={newQ}
                                        onChange={e => setNewQ(e.target.value)}
                                    />
                                    <Button
                                        size="sm"
                                        disabled={!newQ.trim() || logQuestion.isPending}
                                        onClick={() => newQ.trim() && logQuestion.mutate(newQ.trim())}
                                        className="self-start mt-0.5"
                                    >
                                        Registrar
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Questions list */}
                        {questionsLoading ? (
                            <div className="space-y-3">
                                {[1, 2, 3].map(i => <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />)}
                            </div>
                        ) : questions.length === 0 ? (
                            <Card>
                                <CardContent className="py-10 text-center">
                                    <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
                                    <p className="text-sm font-medium">Sin preguntas pendientes</p>
                                    <p className="text-xs text-muted-foreground mt-1">La IA no ha registrado preguntas sin resolver para este producto.</p>
                                </CardContent>
                            </Card>
                        ) : (
                            <div className="space-y-3">
                                {questions.map(q => (
                                    <Card key={q.id} className={q.resuelta ? "opacity-60" : ""}>
                                        <CardContent className="pt-4 pb-4">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        {q.resuelta ? (
                                                            <Badge variant="secondary" className="text-xs bg-green-100 text-green-800">Resuelta</Badge>
                                                        ) : (
                                                            <Badge variant="destructive" className="text-xs">Pendiente</Badge>
                                                        )}
                                                        <span className="text-xs text-muted-foreground">
                                                            {new Date(q.createdAt).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </div>
                                                    <p className="text-sm font-medium">{q.pregunta}</p>
                                                    {q.contexto && (
                                                        <p className="text-xs text-muted-foreground mt-1 italic">{q.contexto}</p>
                                                    )}
                                                    {q.resuelta && q.resueltaPor && (
                                                        <p className="text-xs text-green-700 mt-1">Resuelta por {q.resueltaPor}</p>
                                                    )}
                                                </div>
                                                {!q.resuelta && (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="shrink-0 text-green-700 border-green-300 hover:bg-green-50"
                                                        disabled={resolveQuestion.isPending}
                                                        onClick={() => resolveQuestion.mutate(q.id)}
                                                    >
                                                        <Check className="h-3.5 w-3.5 mr-1" />
                                                        Resuelta
                                                    </Button>
                                                )}
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
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
        </div>
    );
}
