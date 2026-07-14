import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
    Plus, Trash2, Loader2, Receipt, Upload, FileText,
    TrendingDown, CheckCircle2, Clock, ShoppingCart, Pencil,
    Users, Phone, Mail, Building2, Eye, Download, X, RefreshCw, Send,
} from "lucide-react";

interface GastoMarketing {
    id: string;
    concepto: string;
    descripcion: string | null;
    monto: string;
    categoria: string | null;
    proveedor: string | null;
    fecha: string | null;
    mes: number;
    anio: number;
    estado: string;
    presupuestoItemId: string | null;
    urlCotizacion: string | null;
    urlOrdenCompra: string | null;
    urlFactura: string | null;
    numeroFactura: string | null;
    fechaFactura: string | null;
    comentarios: { autor: string; autorId: string; contenido: string; fecha: string }[] | null;
    creadoPorId: string;
    createdAt: string;
    updatedAt: string;
}

interface PresupuestoItemLite {
    id: string;
    concepto: string;
    categoria: string | null;
}

// Valor centinela para "sin asignar" (Radix Select no admite value="")
const SIN_ASIGNAR = "__sin_asignar__";

interface ProveedorMarketing {
    id: string;
    nombre: string;
    contacto: string | null;
    email: string | null;
    telefono: string | null;
    rut: string | null;
    rubro: string | null;
    notas: string | null;
    createdAt: string;
    updatedAt: string;
}

const MESES_NOMBRES = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const CATEGORIAS = [
    "DIGITAL",
    "MEDIOS TRADICIONALES",
    "MATERIAL GRÁFICO",
    "OTROS",
];

const ESTADOS = {
    pendiente: { label: "Pendiente", color: "bg-yellow-100 text-yellow-800 border-yellow-300", icon: Clock },
    con_oc: { label: "Con OC", color: "bg-blue-100 text-blue-800 border-blue-300", icon: ShoppingCart },
    facturado: { label: "Facturado", color: "bg-emerald-100 text-emerald-800 border-emerald-300", icon: CheckCircle2 },
};

function formatCLP(amount: number): string {
    if (amount === 0) return "$0";
    return "$" + amount.toLocaleString("es-CL", { maximumFractionDigits: 0 });
}

export default function GastosTabMarketing({
    userRole,
    selectedMes,
    setSelectedMes,
    selectedAnio,
    setSelectedAnio,
}: {
    userRole: string;
    selectedMes: number;
    setSelectedMes: (mes: number) => void;
    selectedAnio: number;
    setSelectedAnio: (anio: number) => void;
}) {
    const { toast } = useToast();
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingGasto, setEditingGasto] = useState<GastoMarketing | null>(null);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [uploading, setUploading] = useState<string | null>(null); // Format: "gastoId-field"
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploadTarget, setUploadTarget] = useState<{ id: string; field: string } | null>(null);
    const uploadTargetRef = useRef<{ id: string; field: string } | null>(null);
    const [fileInputKey, setFileInputKey] = useState(0);

    // PDF/document preview modal state
    const [previewOpen, setPreviewOpen] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [previewTitle, setPreviewTitle] = useState("");
    const [detailGasto, setDetailGasto] = useState<GastoMarketing | null>(null);
    const [newComment, setNewComment] = useState("");

    const isAdmin = userRole === "admin" || userRole === "supervisor" || userRole === "marketing";

    const getDefaultFecha = () => {
        const today = new Date();
        if (today.getMonth() + 1 === selectedMes && today.getFullYear() === selectedAnio) {
            return `${selectedAnio}-${String(selectedMes).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        }
        return `${selectedAnio}-${String(selectedMes).padStart(2, '0')}-01`;
    };

    const [formData, setFormData] = useState({
        concepto: "",
        descripcion: "",
        monto: "",
        categoria: "DIGITAL",
        proveedor: "",
        fecha: getDefaultFecha(),
        estado: "pendiente",
        numeroFactura: "",
        presupuestoItemId: SIN_ASIGNAR,
    });

    // Ítems del presupuesto del año seleccionado (para asociar cada gasto)
    const { data: presupuestoItems = [] } = useQuery<PresupuestoItemLite[]>({
        queryKey: ["/api/marketing/presupuesto-items", selectedAnio],
        queryFn: async () => {
            const res = await fetch(`/api/marketing/presupuesto-items/${selectedAnio}`, { credentials: "include" });
            if (!res.ok) throw new Error("Error al cargar ítems de presupuesto");
            return res.json();
        },
    });
    const presupuestoItemById = new Map(presupuestoItems.map((p) => [p.id, p]));

    // ─── Gastos queries ───
    const { data: gastos = [], isLoading } = useQuery<GastoMarketing[]>({
        queryKey: ["/api/marketing/gastos", selectedMes, selectedAnio],
        queryFn: async () => {
            const res = await fetch(`/api/marketing/gastos?mes=${selectedMes}&anio=${selectedAnio}`, { credentials: "include" });
            if (!res.ok) throw new Error("Error al cargar gastos");
            return res.json();
        },
    });

    const createMutation = useMutation({
        mutationFn: async (data: any) => await apiRequest("POST", "/api/marketing/gastos", data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/marketing/gastos"] });
            queryClient.invalidateQueries({ queryKey: ["/api/marketing/metrics"] });
            resetForm();
            toast({ title: "Gasto registrado" });
        },
        onError: () => toast({ title: "Error", description: "No se pudo registrar.", variant: "destructive" }),
    });

    const updateMutation = useMutation({
        mutationFn: async ({ id, updates }: { id: string; updates: any }) => await apiRequest("PATCH", `/api/marketing/gastos/${id}`, updates),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/marketing/gastos"] });
            queryClient.invalidateQueries({ queryKey: ["/api/marketing/metrics"] });
            resetForm();
            toast({ title: "Gasto actualizado" });
        },
        onError: () => toast({ title: "Error", description: "No se pudo actualizar.", variant: "destructive" }),
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => await apiRequest("DELETE", `/api/marketing/gastos/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/marketing/gastos"] });
            queryClient.invalidateQueries({ queryKey: ["/api/marketing/metrics"] });
            setDeleteDialogOpen(false);
            toast({ title: "Gasto eliminado" });
        },
        onError: () => toast({ title: "Error", variant: "destructive" }),
    });

    // ─── Proveedores query (solo lectura, para el selector del gasto) ───
    const { data: proveedores = [] } = useQuery<ProveedorMarketing[]>({
        queryKey: ["/api/marketing/proveedores"],
    });

    // ─── Handlers ───
    const resetForm = () => {
        setDialogOpen(false);
        setEditingGasto(null);
        setFormData({ concepto: "", descripcion: "", monto: "", categoria: "DIGITAL", proveedor: "", fecha: getDefaultFecha(), estado: "pendiente", numeroFactura: "", presupuestoItemId: SIN_ASIGNAR });
    };

    const handleSubmit = () => {
        if (!formData.concepto.trim() || !formData.monto) return;
        const payload = {
            concepto: formData.concepto.trim(),
            descripcion: formData.descripcion.trim() || null,
            monto: formData.monto,
            categoria: formData.categoria,
            proveedor: formData.proveedor.trim() || null,
            fecha: formData.fecha || null,
            estado: formData.estado,
            numeroFactura: formData.numeroFactura.trim() || null,
            presupuestoItemId: formData.presupuestoItemId === SIN_ASIGNAR ? null : formData.presupuestoItemId,
            mes: selectedMes,
            anio: selectedAnio,
        };
        if (editingGasto) {
            updateMutation.mutate({ id: editingGasto.id, updates: payload });
        } else {
            createMutation.mutate(payload);
        }
    };

    const addCommentMutation = useMutation({
        mutationFn: async ({ id, contenido }: { id: string; contenido: string }) => {
            const res = await apiRequest("POST", `/api/marketing/gastos/${id}/comentarios`, { contenido });
            return await res.json();
        },
        onSuccess: (updatedGasto) => {
            queryClient.invalidateQueries({ queryKey: ["/api/marketing/gastos"] });
            setDetailGasto(updatedGasto);
            setNewComment("");
            toast({ title: "Comentario agregado" });
        },
        onError: (error: any) => {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        }
    });

    const handleEdit = (gasto: GastoMarketing) => {
        setEditingGasto(gasto);
        setFormData({
            concepto: gasto.concepto,
            descripcion: gasto.descripcion || "",
            monto: gasto.monto,
            categoria: gasto.categoria || "DIGITAL",
            proveedor: gasto.proveedor || "",
            fecha: gasto.fecha || getDefaultFecha(),
            estado: gasto.estado,
            numeroFactura: gasto.numeroFactura || "",
            presupuestoItemId: gasto.presupuestoItemId || SIN_ASIGNAR,
        });
        setDialogOpen(true);
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const currentTarget = uploadTargetRef.current;
        if (!e.target.files?.[0] || !currentTarget) {
            console.warn('[Upload] No file or no upload target. uploadTarget:', currentTarget);
            return;
        }
        const file = e.target.files[0];
        const targetId = currentTarget.id;
        const targetField = currentTarget.field;
        const uploadKey = `${targetId}-${targetField}`;
        setUploading(uploadKey);
        try {
            const fd = new FormData();
            fd.append("file", file);
            console.log('[Upload] Uploading file:', file.name, file.type, file.size, 'to gasto:', targetId, 'field:', targetField);
            const res = await fetch("/api/upload", { method: "POST", credentials: "include", body: fd });
            const responseData = await res.json();
            console.log('[Upload] Upload response:', responseData);
            if (!res.ok) throw new Error(responseData.message || "Upload failed");
            const { url } = responseData;
            console.log('[Upload] PATCHing gasto:', targetId, 'with', targetField, '=', url);
            await apiRequest("PATCH", `/api/marketing/gastos/${targetId}`, {
                [targetField]: url,
                ...(targetField === "urlOrdenCompra" ? { estado: "con_oc" } : {}),
                ...(targetField === "urlFactura" ? { estado: "facturado" } : {}),
            });
            queryClient.invalidateQueries({ queryKey: ["/api/marketing/gastos"] });
            queryClient.invalidateQueries({ queryKey: ["/api/marketing/metrics"] });
            toast({ title: "Documento subido correctamente" });
        } catch (error: any) {
            console.error('[Upload] Error:', error);
            toast({ title: "Error", description: error.message || "No se pudo subir el archivo.", variant: "destructive" });
        } finally {
            setUploading(null);
            setUploadTarget(null);
            uploadTargetRef.current = null;
            setFileInputKey(prev => prev + 1);
        }
    };

    const triggerUpload = (id: string, field: string) => {
        const target = { id, field };
        uploadTargetRef.current = target;
        setUploadTarget(target);
        setFileInputKey(prev => prev + 1);
        setTimeout(() => {
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
                fileInputRef.current.click();
            }
        }, 150);
    };

    const openPreview = (url: string, title: string) => {
        setPreviewUrl(url);
        setPreviewTitle(title);
        setPreviewOpen(true);
    };

    const isPdfUrl = (url: string) => {
        if (!url) return false;
        const path = url.split('?')[0].toLowerCase();
        return path.endsWith('.pdf') || url.toLowerCase().includes('application/pdf') || url.toLowerCase().includes('.pdf');
    };

    const isImageUrl = (url: string) => {
        if (!url) return false;
        const path = url.split('?')[0].toLowerCase();
        return /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(path);
    };

    const renderDocButton = (gasto: GastoMarketing, field: 'urlCotizacion' | 'urlOrdenCompra' | 'urlFactura', label: string, colorClass: string, iconColorClass: string) => {
        const url = gasto[field];
        const uploadKey = `${gasto.id}-${field}`;
        const isUploading = uploading === uploadKey;

        if (url) {
            // Document exists — show badge to preview + replace button
            return (
                <div className="flex items-center gap-0.5">
                    <Button
                        variant="ghost"
                        size="sm"
                        className={`h-6 text-[10px] px-1.5 ${colorClass} hover:opacity-80`}
                        onClick={() => openPreview(url, `${label} — ${gasto.concepto}`)}
                    >
                        <Eye className="h-2.5 w-2.5 mr-0.5" />{label}
                    </Button>
                    {isAdmin && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className={`h-5 w-5 p-0 ${iconColorClass} opacity-50 hover:opacity-100`}
                            onClick={() => triggerUpload(gasto.id, field)}
                            disabled={isUploading}
                            title={`Reemplazar ${label}`}
                        >
                            {isUploading ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <RefreshCw className="h-2.5 w-2.5" />}
                        </Button>
                    )}
                </div>
            );
        }

        // No document — show upload button (admin only)
        if (isAdmin) {
            return (
                <Button
                    variant="ghost"
                    size="sm"
                    className={`h-6 text-[10px] px-1.5 text-slate-400 ${iconColorClass}`}
                    onClick={() => triggerUpload(gasto.id, field)}
                    disabled={isUploading}
                >
                    {isUploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3 mr-0.5" />}{label}
                </Button>
            );
        }

        return <Badge variant="outline" className="text-[9px] text-slate-300">—</Badge>;
    };

    // Calculations
    const totalGastos = gastos.reduce((sum, g) => sum + parseFloat(g.monto || "0"), 0);
    const gastosFacturados = gastos.filter((g) => g.estado === "facturado").reduce((sum, g) => sum + parseFloat(g.monto || "0"), 0);
    const gastosPendientes = gastos.filter((g) => g.estado !== "facturado").reduce((sum, g) => sum + parseFloat(g.monto || "0"), 0);

    if (isLoading) {
        return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-orange-500" /></div>;
    }

    return (
        <div className="space-y-6">
            <input key={fileInputKey} type="file" ref={fileInputRef} className="hidden" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx" onChange={handleFileUpload} />

            {/* Controls */}
            <div className="flex flex-wrap items-end gap-4">
                <div className="min-w-[140px]">
                    <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Mes</Label>
                    <Select value={selectedMes.toString()} onValueChange={(v) => setSelectedMes(parseInt(v))}>
                        <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {MESES_NOMBRES.map((mes, i) => (
                                <SelectItem key={i + 1} value={(i + 1).toString()}>{mes}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="min-w-[100px]">
                    <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Año</Label>
                    <Select value={selectedAnio.toString()} onValueChange={(v) => setSelectedAnio(parseInt(v))}>
                        <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {[2024, 2025, 2026, 2027].map((a) => (
                                <SelectItem key={a} value={a.toString()}>{a}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                {isAdmin && (
                    <Button onClick={() => { resetForm(); setDialogOpen(true); }} className="rounded-xl bg-orange-600 hover:bg-orange-700 ml-auto">
                        <Plus className="mr-2 h-4 w-4" />
                        Registrar Gasto
                    </Button>
                )}
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="border-0 shadow-md bg-gradient-to-br from-red-500 to-rose-600 text-white">
                    <CardContent className="pt-6">
                        <p className="text-sm font-medium text-red-100">Total Gastos</p>
                        <p className="text-2xl font-bold mt-1">{formatCLP(totalGastos)}</p>
                        <p className="text-xs text-red-200 mt-1">{gastos.length} registrados</p>
                    </CardContent>
                </Card>
                <Card className="border-0 shadow-md bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
                    <CardContent className="pt-6">
                        <p className="text-sm font-medium text-emerald-100">Facturados</p>
                        <p className="text-2xl font-bold mt-1">{formatCLP(gastosFacturados)}</p>
                        <p className="text-xs text-emerald-200 mt-1">{gastos.filter((g) => g.estado === "facturado").length} con factura</p>
                    </CardContent>
                </Card>
                <Card className="border-0 shadow-md bg-gradient-to-br from-amber-500 to-orange-600 text-white">
                    <CardContent className="pt-6">
                        <p className="text-sm font-medium text-amber-100">Pendientes</p>
                        <p className="text-2xl font-bold mt-1">{formatCLP(gastosPendientes)}</p>
                        <p className="text-xs text-amber-200 mt-1">{gastos.filter((g) => g.estado !== "facturado").length} sin factura</p>
                    </CardContent>
                </Card>
            </div>

            {/* Gastos table */}
            <Card className="border-0 shadow-lg overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-slate-800 to-slate-900 text-white pb-4">
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <Receipt className="h-5 w-5" />
                        Gastos — {MESES_NOMBRES[selectedMes - 1]} {selectedAnio}
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {gastos.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                            <TrendingDown className="h-12 w-12 mb-4 opacity-30" />
                            <p className="text-lg font-medium">Sin gastos registrados</p>
                            <p className="text-sm">Registra gastos para llevar el control mensual.</p>
                            {isAdmin && (
                                <Button onClick={() => { resetForm(); setDialogOpen(true); }} className="mt-4 rounded-xl bg-orange-600 hover:bg-orange-700">
                                    <Plus className="mr-2 h-4 w-4" /> Registrar Primer Gasto
                                </Button>
                            )}
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm" style={{ minWidth: "900px" }}>
                                <thead>
                                    <tr className="bg-slate-100 dark:bg-slate-800 border-b-2 border-slate-300">
                                        <th className="px-4 py-3 text-left font-bold text-slate-700 w-[200px]">Concepto</th>
                                        <th className="px-3 py-3 text-left font-bold text-slate-700 w-[120px]">Categoría</th>
                                        <th className="px-3 py-3 text-left font-bold text-slate-700 w-[140px]">Proveedor</th>
                                        <th className="px-3 py-3 text-right font-bold text-slate-700 w-[110px]">Monto</th>
                                        <th className="px-3 py-3 text-center font-bold text-slate-700 w-[100px]">N° Factura</th>
                                        <th className="px-3 py-3 text-center font-bold text-slate-700 w-[100px]">Estado</th>
                                        <th className="px-3 py-3 text-center font-bold text-slate-700 w-[200px]">Documentos</th>
                                        {isAdmin && <th className="px-2 py-3 text-center w-[80px]"></th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {gastos.map((gasto, idx) => {
                                        const estadoInfo = ESTADOS[gasto.estado as keyof typeof ESTADOS] || ESTADOS.pendiente;
                                        const EstadoIcon = estadoInfo.icon;
                                        return (
                                            <tr key={gasto.id} className={`border-b border-slate-100 hover:bg-orange-50/50 transition-colors ${idx % 2 === 0 ? "bg-white" : "bg-slate-50/50"}`}>
                                                <td className="px-4 py-3">
                                                    <button
                                                        onClick={() => setDetailGasto(gasto)}
                                                        className="font-medium text-slate-800 hover:text-orange-600 transition-colors text-left"
                                                    >
                                                        {gasto.concepto}
                                                    </button>
                                                    {gasto.descripcion && <div className="text-xs text-slate-500 mt-0.5 line-clamp-1">{gasto.descripcion}</div>}
                                                    {gasto.presupuestoItemId && presupuestoItemById.has(gasto.presupuestoItemId) ? (
                                                        <div className="mt-1 inline-flex items-center gap-1 text-[10px] font-medium text-orange-600 bg-orange-50 border border-orange-200 rounded px-1.5 py-0.5">
                                                            <TrendingDown className="h-2.5 w-2.5 rotate-180" />
                                                            {presupuestoItemById.get(gasto.presupuestoItemId)!.concepto}
                                                        </div>
                                                    ) : (
                                                        <div className="mt-1 inline-flex items-center text-[10px] font-medium text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
                                                            Ítem nuevo
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-3 py-3"><span className="text-xs font-medium text-slate-600">{gasto.categoria || "—"}</span></td>
                                                <td className="px-3 py-3"><span className="text-xs text-slate-600">{gasto.proveedor || "—"}</span></td>
                                                <td className="px-3 py-3 text-right tabular-nums font-semibold text-slate-800">{formatCLP(parseFloat(gasto.monto || "0"))}</td>
                                                <td className="px-3 py-3 text-center"><span className="text-xs text-slate-500">{gasto.numeroFactura || "—"}</span></td>
                                                <td className="px-3 py-3 text-center">
                                                    <Badge variant="outline" className={`text-[10px] px-2 py-0.5 ${estadoInfo.color}`}>
                                                        <EstadoIcon className="h-3 w-3 mr-1" />{estadoInfo.label}
                                                    </Badge>
                                                </td>
                                                <td className="px-3 py-3">
                                                    <div className="flex items-center justify-center gap-1">
                                                        {renderDocButton(gasto, 'urlCotizacion', 'Cotiz.', 'bg-orange-50 text-orange-700 border-orange-300', 'hover:text-orange-600')}
                                                        {renderDocButton(gasto, 'urlOrdenCompra', 'OC', 'bg-blue-50 text-blue-700 border-blue-300', 'hover:text-blue-600')}
                                                        {renderDocButton(gasto, 'urlFactura', 'Factura', 'bg-emerald-50 text-emerald-700 border-emerald-300', 'hover:text-emerald-600')}
                                                    </div>
                                                </td>
                                                {isAdmin && (
                                                    <td className="px-2 py-3 text-center">
                                                        <div className="flex gap-1 justify-center">
                                                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-400 hover:text-orange-600 hover:bg-orange-50" onClick={() => handleEdit(gasto)}>
                                                                <Pencil className="h-3.5 w-3.5" />
                                                            </Button>
                                                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-400 hover:text-red-500 hover:bg-red-50" onClick={() => { setDeleteId(gasto.id); setDeleteDialogOpen(true); }}>
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </Button>
                                                        </div>
                                                    </td>
                                                )}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-gradient-to-r from-slate-800 to-slate-900 text-white">
                                        <td className="px-4 py-3 font-bold text-sm" colSpan={3}>Total</td>
                                        <td className="px-3 py-3 text-right font-bold tabular-nums">{formatCLP(totalGastos)}</td>
                                        <td colSpan={isAdmin ? 3 : 2}></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* ═══════════════════════════════════════════════
          DIALOGS
          ═══════════════════════════════════════════════ */}

            {/* Gasto Add/Edit Dialog */}
            <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) resetForm(); }}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>{editingGasto ? "Editar Gasto" : "Registrar Gasto"}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div>
                            <Label>Concepto *</Label>
                            <Input value={formData.concepto} onChange={(e) => setFormData({ ...formData, concepto: e.target.value })} placeholder="Ej: Pauta Google Ads Marzo" className="mt-1" />
                        </div>
                        <div>
                            <Label>Descripción</Label>
                            <Textarea value={formData.descripcion} onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })} placeholder="Detalle del gasto..." className="mt-1" rows={2} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Monto (CLP) *</Label>
                                <Input type="number" value={formData.monto} onChange={(e) => setFormData({ ...formData, monto: e.target.value })} placeholder="1500000" className="mt-1" />
                            </div>
                            <div>
                                <Label>Categoría</Label>
                                <Select value={formData.categoria} onValueChange={(v) => setFormData({ ...formData, categoria: v })}>
                                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {CATEGORIAS.map((cat) => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div>
                            <Label>Fecha</Label>
                            <Input
                                type="date"
                                value={formData.fecha}
                                onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
                                min={`${selectedAnio}-${String(selectedMes).padStart(2, '0')}-01`}
                                max={`${selectedAnio}-${String(selectedMes).padStart(2, '0')}-${String(new Date(selectedAnio, selectedMes, 0).getDate()).padStart(2, '0')}`}
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <Label>Ítem de presupuesto</Label>
                            <Select value={formData.presupuestoItemId} onValueChange={(v) => setFormData({ ...formData, presupuestoItemId: v })}>
                                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={SIN_ASIGNAR}>Sin asignar (ítem nuevo)</SelectItem>
                                    {presupuestoItems.map((p) => (
                                        <SelectItem key={p.id} value={p.id}>
                                            {p.concepto}{p.categoria ? ` — ${p.categoria}` : ""}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-[11px] text-slate-400 mt-1">
                                Si no lo asignas, en Presupuesto aparecerá como un ítem nuevo (sin presupuesto).
                            </p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Proveedor</Label>
                                {proveedores.length > 0 ? (
                                    <Select value={formData.proveedor} onValueChange={(v) => setFormData({ ...formData, proveedor: v })}>
                                        <SelectTrigger className="mt-1"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                                        <SelectContent>
                                            {proveedores.map((p) => <SelectItem key={p.id} value={p.nombre}>{p.nombre}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                ) : (
                                    <Input value={formData.proveedor} onChange={(e) => setFormData({ ...formData, proveedor: e.target.value })} placeholder="Nombre proveedor" className="mt-1" />
                                )}
                            </div>
                            <div>
                                <Label>Estado</Label>
                                <Select value={formData.estado} onValueChange={(v) => setFormData({ ...formData, estado: v })}>
                                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="pendiente">Pendiente</SelectItem>
                                        <SelectItem value="con_oc">Con OC</SelectItem>
                                        <SelectItem value="facturado">Facturado</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        {formData.estado === "facturado" && (
                            <div>
                                <Label>N° Factura</Label>
                                <Input value={formData.numeroFactura} onChange={(e) => setFormData({ ...formData, numeroFactura: e.target.value })} placeholder="Ej: F-12345" className="mt-1" />
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={resetForm}>Cancelar</Button>
                        <Button onClick={handleSubmit} disabled={!formData.concepto.trim() || !formData.monto || createMutation.isPending || updateMutation.isPending} className="bg-orange-600 hover:bg-orange-700">
                            {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {editingGasto ? "Guardar Cambios" : "Registrar"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete confirmation */}
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar este gasto?</AlertDialogTitle>
                        <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <Button
                            className="bg-red-600 hover:bg-red-700 text-white"
                            disabled={deleteMutation.isPending}
                            onClick={() => {
                                if (!deleteId) return;
                                deleteMutation.mutate(deleteId);
                            }}
                        >
                            {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Eliminar
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Document Preview Modal */}
            <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
                <DialogContent className="sm:max-w-[800px] max-h-[90vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle className="flex items-center justify-between pr-8">
                            <span className="flex items-center gap-2 text-sm truncate">
                                <FileText className="h-4 w-4 text-orange-600 shrink-0" />
                                {previewTitle}
                            </span>
                            {previewUrl && (() => {
                                const downloadUrl = previewUrl.includes('?')
                                    ? `${previewUrl}&download=true`
                                    : `${previewUrl}?download=true`;
                                return <a href={downloadUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-medium bg-orange-600 text-white px-3 py-1.5 rounded-lg hover:bg-orange-700 transition-colors shrink-0"><Download className="h-3.5 w-3.5" />Descargar</a>;
                            })()}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="flex-1 min-h-0 overflow-auto rounded-lg border border-slate-200 bg-slate-50">
                        {previewUrl && (
                            isPdfUrl(previewUrl) ? (
                                <div className="w-full h-[65vh] rounded-lg overflow-hidden bg-white">
                                    <iframe
                                        src={`${previewUrl}${previewUrl.includes('?') ? '&' : '?'}_t=${Date.now()}`}
                                        className="w-full h-full"
                                        title="Vista previa del documento"
                                    />
                                </div>
                            ) : isImageUrl(previewUrl) ? (
                                <div className="flex items-center justify-center p-4">
                                    <img
                                        src={previewUrl}
                                        alt="Vista previa"
                                        className="max-w-full max-h-[60vh] object-contain rounded-lg shadow-sm"
                                    />
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                                    <FileText className="h-16 w-16 mb-4 opacity-30" />
                                    <p className="font-medium">Vista previa no disponible para este tipo de archivo</p>
                                    <p className="text-sm mt-1">Usa el botón de descargar para ver el archivo</p>
                                </div>
                            )
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Gasto Detail Dialog */}
            <Dialog open={!!detailGasto} onOpenChange={(open) => { if (!open) setDetailGasto(null); }}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <FileText className="h-5 w-5 text-orange-600" />
                            Detalle del Gasto
                        </DialogTitle>
                    </DialogHeader>
                    {detailGasto && (
                        <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto">
                            <div>
                                <Label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Concepto</Label>
                                <p className="text-lg font-semibold text-slate-800">{detailGasto.concepto}</p>
                            </div>
                            <div>
                                <Label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Descripción / Detalle</Label>
                                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mt-1">
                                    <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">
                                        {detailGasto.descripcion || "Sin detalle adicional."}
                                    </p>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Monto</Label>
                                    <p className="font-bold text-orange-600 text-lg">{formatCLP(parseFloat(detailGasto.monto))}</p>
                                </div>
                                <div>
                                    <Label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Proveedor</Label>
                                    <p className="text-slate-700 font-medium">{detailGasto.proveedor || "—"}</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Categoría</Label>
                                    <p className="text-slate-700">{detailGasto.categoria || "—"}</p>
                                </div>
                                <div>
                                    <Label className="text-xs font-bold text-slate-400 uppercase tracking-wider">N° Factura</Label>
                                    <p className="text-slate-700">{detailGasto.numeroFactura || "—"}</p>
                                </div>
                            </div>
                            <div>
                                <Label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Ítem de presupuesto</Label>
                                {detailGasto.presupuestoItemId && presupuestoItemById.has(detailGasto.presupuestoItemId) ? (
                                    <p className="text-orange-700 font-medium">{presupuestoItemById.get(detailGasto.presupuestoItemId)!.concepto}</p>
                                ) : (
                                    <p className="text-amber-600 font-medium">Sin asignar — ítem nuevo</p>
                                )}
                            </div>

                            {/* Comments Section */}
                            <div className="border-t border-slate-200 pt-4">
                                <Label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 block">Comentarios</Label>
                                {/* Comment list */}
                                <div className="space-y-2 mb-3 max-h-[200px] overflow-y-auto">
                                    {(!detailGasto.comentarios || detailGasto.comentarios.length === 0) ? (
                                        <p className="text-sm text-slate-400 italic py-2">Sin comentarios aún.</p>
                                    ) : (
                                        detailGasto.comentarios.map((c, i) => (
                                            <div key={i} className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="text-xs font-semibold text-orange-600">{c.autor}</span>
                                                    <span className="text-[10px] text-slate-400">
                                                        {new Date(c.fecha).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-slate-700 whitespace-pre-wrap">{c.contenido}</p>
                                            </div>
                                        ))
                                    )}
                                </div>
                                {/* Add comment input */}
                                <div className="flex gap-2">
                                    <Textarea
                                        value={newComment}
                                        onChange={(e) => setNewComment(e.target.value)}
                                        placeholder="Escribe un comentario..."
                                        className="flex-1 min-h-[40px] text-sm resize-none"
                                        rows={2}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey && newComment.trim()) {
                                                e.preventDefault();
                                                addCommentMutation.mutate({ id: detailGasto.id, contenido: newComment });
                                            }
                                        }}
                                    />
                                    <Button
                                        size="sm"
                                        className="self-end h-10 px-3"
                                        disabled={!newComment.trim() || addCommentMutation.isPending}
                                        onClick={() => addCommentMutation.mutate({ id: detailGasto.id, contenido: newComment })}
                                    >
                                        {addCommentMutation.isPending ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <Send className="h-4 w-4" />
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button onClick={() => { setDetailGasto(null); setNewComment(""); }}>Cerrar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </div>
    );
}
