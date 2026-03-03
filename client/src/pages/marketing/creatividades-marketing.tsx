import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    Play, Video, Plus, Search, ExternalLink, Calendar, Loader2, Edit, Trash2, LayoutGrid, List,
    ThumbsUp, ThumbsDown, FileText, Clapperboard, CheckCircle, XCircle, Clock
} from "lucide-react";
import type { CreatividadMarketing } from "@shared/schema";

interface Props {
    mes: number;
    anio: number;
    userRole: string;
}

interface GuionMarketing {
    id: string;
    creatividadId: string;
    actor: string | null;
    locacion: string | null;
    insumos: string | null;
    vestuario: string | null;
    guion: string | null;
    notas: string | null;
}

const tipoColors: Record<string, string> = {
    reel: "bg-fuchsia-500/10 text-fuchsia-600 border-fuchsia-500/20",
    video: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    post: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20",
    historia: "bg-orange-500/10 text-orange-600 border-orange-500/20",
};

const estadoColors: Record<string, string> = {
    planificacion: "bg-slate-100 text-slate-600",
    grabacion: "bg-yellow-100 text-yellow-700",
    edicion: "bg-blue-100 text-blue-700",
    completado: "bg-emerald-100 text-emerald-700",
    publicado: "bg-purple-100 text-purple-700",
};

const plataformaIcons: Record<string, JSX.Element> = {
    instagram: <div className="p-1 rounded-md bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-500 text-white"><Video className="w-3.5 h-3.5" /></div>,
    tiktok: <div className="p-1 rounded-md bg-black text-white"><Play className="w-3.5 h-3.5" /></div>,
    youtube: <div className="p-1 rounded-md bg-red-600 text-white"><Play className="w-3.5 h-3.5" /></div>,
    facebook: <div className="p-1 rounded-md bg-blue-600 text-white"><ExternalLink className="w-3.5 h-3.5" /></div>,
    linkedin: <div className="p-1 rounded-md bg-blue-700 text-white"><ExternalLink className="w-3.5 h-3.5" /></div>,
};

const aprobacionConfig: Record<string, { label: string; icon: any; className: string }> = {
    pendiente: { label: "Pendiente", icon: Clock, className: "bg-slate-50 text-slate-500 border-slate-200" },
    aprobada: { label: "Aprobada", icon: CheckCircle, className: "bg-emerald-50 text-emerald-600 border-emerald-200" },
    rechazada: { label: "Rechazada", icon: XCircle, className: "bg-red-50 text-red-600 border-red-200" },
};

export default function CreatividadesMarketing({ mes, anio, userRole }: Props) {
    const { toast } = useToast();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState<CreatividadMarketing | null>(null);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [searchQuery, setSearchQuery] = useState("");
    const [viewItem, setViewItem] = useState<CreatividadMarketing | null>(null);
    const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
    const [rejectTarget, setRejectTarget] = useState<string | null>(null);
    const [rejectReason, setRejectReason] = useState("");
    // Guión state
    const [guionDialogOpen, setGuionDialogOpen] = useState(false);
    const [guionTarget, setGuionTarget] = useState<CreatividadMarketing | null>(null);
    const [guionForm, setGuionForm] = useState({ actor: "", locacion: "", insumos: "", vestuario: "", guion: "", notas: "" });
    const [editingGuionId, setEditingGuionId] = useState<string | null>(null);

    const isAdmin = userRole === "admin" || userRole === "supervisor";

    const { data: creatividades = [], isLoading } = useQuery<CreatividadMarketing[]>({
        queryKey: ['/api/marketing/creatividades', { mes, anio }],
    });

    const filteredData = creatividades.filter(c =>
        c.titulo.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.descripcion && c.descripcion.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    const formAction = useMutation({
        mutationFn: async (data: Partial<CreatividadMarketing>) => {
            if (selectedItem) {
                const res = await apiRequest(`/api/marketing/creatividades/${selectedItem.id}`, { method: "PATCH", data });
                return res.json();
            } else {
                const res = await apiRequest("/api/marketing/creatividades", { method: "POST", data: { ...data, mes, anio } });
                return res.json();
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['/api/marketing/creatividades'] });
            setIsDialogOpen(false);
            setSelectedItem(null);
            toast({ title: selectedItem ? "Creatividad actualizada" : "Creatividad agregada" });
        }
    });

    const deleteAction = useMutation({
        mutationFn: async (id: string) => {
            await apiRequest(`/api/marketing/creatividades/${id}`, { method: "DELETE" });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['/api/marketing/creatividades'] });
            toast({ title: "Creatividad eliminada" });
        }
    });

    const approveMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await apiRequest("PATCH", `/api/marketing/creatividades/${id}/aprobar`);
            return res;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['/api/marketing/creatividades'] });
            toast({ title: "✅ Idea aprobada" });
        },
    });

    const rejectMutation = useMutation({
        mutationFn: async ({ id, motivoRechazo }: { id: string; motivoRechazo: string }) => {
            const res = await apiRequest("PATCH", `/api/marketing/creatividades/${id}/rechazar`, { motivoRechazo });
            return res;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['/api/marketing/creatividades'] });
            setRejectDialogOpen(false);
            setRejectReason("");
            toast({ title: "❌ Idea rechazada" });
        },
    });

    const guionSaveMutation = useMutation({
        mutationFn: async (data: any) => {
            if (editingGuionId) {
                return await apiRequest("PATCH", `/api/marketing/guiones/${editingGuionId}`, data);
            } else {
                return await apiRequest("POST", `/api/marketing/guiones`, data);
            }
        },
        onSuccess: () => {
            setGuionDialogOpen(false);
            toast({ title: editingGuionId ? "Guión actualizado" : "Guión creado" });
        },
    });

    const handleOpenGuion = async (item: CreatividadMarketing) => {
        setGuionTarget(item);
        try {
            const res = await fetch(`/api/marketing/guiones/${item.id}`, { credentials: "include" });
            const guion = await res.json();
            if (guion && guion.id) {
                setEditingGuionId(guion.id);
                setGuionForm({
                    actor: guion.actor || "",
                    locacion: guion.locacion || "",
                    insumos: guion.insumos || "",
                    vestuario: guion.vestuario || "",
                    guion: guion.guion || "",
                    notas: guion.notas || "",
                });
            } else {
                setEditingGuionId(null);
                setGuionForm({ actor: "", locacion: "", insumos: "", vestuario: "", guion: "", notas: "" });
            }
        } catch {
            setEditingGuionId(null);
            setGuionForm({ actor: "", locacion: "", insumos: "", vestuario: "", guion: "", notas: "" });
        }
        setGuionDialogOpen(true);
    };

    const handleGuionSubmit = () => {
        if (!guionTarget) return;
        const payload = {
            creatividadId: guionTarget.id,
            actor: guionForm.actor.trim() || null,
            locacion: guionForm.locacion.trim() || null,
            insumos: guionForm.insumos.trim() || null,
            vestuario: guionForm.vestuario.trim() || null,
            guion: guionForm.guion.trim() || null,
            notas: guionForm.notas.trim() || null,
        };
        guionSaveMutation.mutate(payload);
    };

    const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        formAction.mutate({
            titulo: fd.get('titulo') as string,
            descripcion: fd.get('descripcion') as string,
            tipo: fd.get('tipo') as string,
            estado: fd.get('estado') as string,
            plataforma: fd.get('plataforma') as string,
            urlReferencia: fd.get('urlReferencia') as string || null,
            urlPublicacion: fd.get('urlPublicacion') as string || null,
            fechaPublicacion: fd.get('fechaPublicacion') as string || null,
        });
    };

    if (isLoading) {
        return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-indigo-500" /></div>;
    }

    return (
        <div className="space-y-6">
            {/* Controls */}
            <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                        placeholder="Buscar creatividades..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="pl-9 rounded-xl"
                    />
                </div>
                <div className="flex gap-1 bg-slate-100 rounded-lg p-0.5">
                    <Button variant={viewMode === 'grid' ? 'default' : 'ghost'} size="sm" className="h-8 rounded-md" onClick={() => setViewMode('grid')}>
                        <LayoutGrid className="h-4 w-4" />
                    </Button>
                    <Button variant={viewMode === 'list' ? 'default' : 'ghost'} size="sm" className="h-8 rounded-md" onClick={() => setViewMode('list')}>
                        <List className="h-4 w-4" />
                    </Button>
                </div>
                {isAdmin && (
                    <Button onClick={() => { setSelectedItem(null); setIsDialogOpen(true); }} className="rounded-xl bg-indigo-600 hover:bg-indigo-700 ml-auto">
                        <Plus className="mr-2 h-4 w-4" /> Nueva Creatividad
                    </Button>
                )}
            </div>

            {filteredData.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                    <Video className="h-12 w-12 mb-4 opacity-30" />
                    <p className="text-lg font-medium">Sin creatividades</p>
                    <p className="text-sm">Agrega reels, videos, posts e historias.</p>
                </div>
            ) : viewMode === 'list' ? (
                <Card className="border-0 shadow-md overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-slate-50 border-b">
                                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Título</th>
                                    <th className="px-3 py-3 text-left font-semibold text-slate-600">Tipo</th>
                                    <th className="px-3 py-3 text-left font-semibold text-slate-600">Estado</th>
                                    <th className="px-3 py-3 text-center font-semibold text-slate-600">Aprobación</th>
                                    <th className="px-3 py-3 text-left font-semibold text-slate-600">Fecha</th>
                                    {isAdmin && <th className="px-2 py-3 w-[100px]"></th>}
                                </tr>
                            </thead>
                            <tbody>
                                {filteredData.map(item => {
                                    const aprob = aprobacionConfig[(item as any).estadoAprobacion || 'pendiente'] || aprobacionConfig.pendiente;
                                    const AprobIcon = aprob.icon;
                                    return (
                                        <tr key={item.id} className="border-b hover:bg-slate-50/60 transition-colors cursor-pointer" onClick={() => setViewItem(item)}>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    {plataformaIcons[item.plataforma]}
                                                    <span className="font-medium text-slate-800">{item.titulo}</span>
                                                </div>
                                            </td>
                                            <td className="px-3 py-3">
                                                <Badge variant="outline" className={`text-[10px] ${tipoColors[item.tipo] || ''}`}>{item.tipo.toUpperCase()}</Badge>
                                            </td>
                                            <td className="px-3 py-3">
                                                <Badge variant="secondary" className={`text-[10px] ${estadoColors[item.estado] || ''}`}>{item.estado}</Badge>
                                            </td>
                                            <td className="px-3 py-3 text-center">
                                                <Badge variant="outline" className={`text-[10px] ${aprob.className}`}>
                                                    <AprobIcon className="h-3 w-3 mr-1" />{aprob.label}
                                                </Badge>
                                            </td>
                                            <td className="px-3 py-3 text-slate-500 text-xs">
                                                {item.fechaPublicacion ? format(new Date(item.fechaPublicacion), "dd MMM yyyy", { locale: es }) : "—"}
                                            </td>
                                            {isAdmin && (
                                                <td className="px-2 py-3" onClick={e => e.stopPropagation()}>
                                                    <div className="flex gap-1 justify-center">
                                                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setSelectedItem(item); setIsDialogOpen(true); }}><Edit className="h-3.5 w-3.5" /></Button>
                                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => { if (confirm('¿Eliminar?')) deleteAction.mutate(item.id); }}><Trash2 className="h-3.5 w-3.5" /></Button>
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </Card>
            ) : (
                /* ──── GRID CARDS ──── */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredData.map(item => {
                        const aprob = aprobacionConfig[(item as any).estadoAprobacion || 'pendiente'] || aprobacionConfig.pendiente;
                        const AprobIcon = aprob.icon;
                        const isApproved = (item as any).estadoAprobacion === 'aprobada';
                        const isRejected = (item as any).estadoAprobacion === 'rechazada';

                        return (
                            <Card
                                key={item.id}
                                className={`group relative overflow-hidden border transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5
                                    ${isApproved ? 'border-emerald-200 bg-emerald-50/30' : isRejected ? 'border-red-200 bg-red-50/20' : 'border-slate-200 bg-white'}`}
                            >
                                {/* Approval ribbon */}
                                {isApproved && (
                                    <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[9px] font-bold px-3 py-0.5 rounded-bl-lg">
                                        APROBADA
                                    </div>
                                )}
                                {isRejected && (
                                    <div className="absolute top-0 right-0 bg-red-500 text-white text-[9px] font-bold px-3 py-0.5 rounded-bl-lg">
                                        RECHAZADA
                                    </div>
                                )}

                                {/* Top bar: platform + type + actions */}
                                <div className="px-4 pt-4 pb-2 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        {plataformaIcons[item.plataforma]}
                                        <Badge variant="outline" className={`text-[10px] font-medium ${tipoColors[item.tipo] || ''}`}>
                                            {item.tipo.toUpperCase()}
                                        </Badge>
                                    </div>
                                    {isAdmin && (
                                        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-indigo-600" onClick={(e) => { e.stopPropagation(); setSelectedItem(item); setIsDialogOpen(true); }}>
                                                <Edit className="h-3.5 w-3.5" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-red-600" onClick={(e) => { e.stopPropagation(); if (confirm('¿Eliminar?')) deleteAction.mutate(item.id); }}>
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    )}
                                </div>

                                {/* Content - clickable */}
                                <CardContent className="px-4 pb-3 pt-0 cursor-pointer" onClick={() => setViewItem(item)}>
                                    <h3 className="font-semibold text-sm text-slate-900 line-clamp-2 leading-snug mb-1.5">{item.titulo}</h3>
                                    <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">{item.descripcion || "Sin descripción"}</p>
                                </CardContent>

                                {/* Reference link */}
                                {item.urlReferencia && (
                                    <div className="px-4 pb-2">
                                        <a href={item.urlReferencia} target="_blank" rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 text-[11px] text-indigo-600 hover:text-indigo-700 hover:underline font-medium"
                                            onClick={e => e.stopPropagation()}>
                                            <ExternalLink className="h-3 w-3" /> Referencia
                                        </a>
                                    </div>
                                )}

                                {/* Footer: status + date */}
                                <div className="px-4 pb-3 flex items-center justify-between gap-2">
                                    <Badge variant="secondary" className={`text-[10px] ${estadoColors[item.estado] || ''}`}>
                                        {item.estado.charAt(0).toUpperCase() + item.estado.slice(1)}
                                    </Badge>
                                    <span className="text-[11px] text-slate-400 flex items-center gap-1">
                                        <Calendar className="h-3 w-3" />
                                        {item.fechaPublicacion ? format(new Date(item.fechaPublicacion), "dd MMM, yyyy", { locale: es }) : "TBD"}
                                    </span>
                                </div>

                                {/* Rejection reason */}
                                {isRejected && (item as any).motivoRechazo && (
                                    <div className="mx-4 mb-3 p-2 bg-red-50 border border-red-100 rounded-lg">
                                        <p className="text-[11px] text-red-600"><span className="font-semibold">Motivo:</span> {(item as any).motivoRechazo}</p>
                                    </div>
                                )}

                                {/* Admin actions: Approve/Reject + Create Script */}
                                {isAdmin && (
                                    <div className="px-4 pb-4 pt-1 border-t border-slate-100 space-y-2">
                                        {(item as any).estadoAprobacion !== 'aprobada' && (item as any).estadoAprobacion !== 'rechazada' && (
                                            <div className="flex gap-2">
                                                <Button
                                                    size="sm"
                                                    className="flex-1 h-8 text-xs rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white"
                                                    disabled={approveMutation.isPending}
                                                    onClick={(e) => { e.stopPropagation(); approveMutation.mutate(item.id); }}
                                                >
                                                    <ThumbsUp className="h-3 w-3 mr-1" /> Aprobar
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="flex-1 h-8 text-xs rounded-lg border-red-200 text-red-600 hover:bg-red-50"
                                                    onClick={(e) => { e.stopPropagation(); setRejectTarget(item.id); setRejectDialogOpen(true); }}
                                                >
                                                    <ThumbsDown className="h-3 w-3 mr-1" /> Rechazar
                                                </Button>
                                            </div>
                                        )}
                                        {isApproved && (
                                            <Button
                                                size="sm"
                                                className="w-full h-8 text-xs rounded-lg bg-violet-600 hover:bg-violet-700 text-white"
                                                onClick={(e) => { e.stopPropagation(); handleOpenGuion(item); }}
                                            >
                                                <Clapperboard className="h-3.5 w-3.5 mr-1.5" /> Crear Guión
                                            </Button>
                                        )}
                                    </div>
                                )}
                            </Card>
                        );
                    })}
                </div>
            )}

            {/* ──── Detail View Modal ──── */}
            <Dialog open={!!viewItem} onOpenChange={(open) => { if (!open) setViewItem(null); }}>
                <DialogContent className="sm:max-w-[520px] rounded-2xl p-6 pt-8">
                    {viewItem && (() => {
                        const aprob = aprobacionConfig[(viewItem as any).estadoAprobacion || 'pendiente'] || aprobacionConfig.pendiente;
                        const AprobIcon = aprob.icon;
                        return (
                            <div className="space-y-4">
                                <div>
                                    <h2 className="text-lg font-semibold text-slate-900 leading-snug pr-6">{viewItem.titulo}</h2>
                                    <div className="flex flex-wrap items-center gap-2 mt-3">
                                        {plataformaIcons[viewItem.plataforma]}
                                        <Badge variant="outline" className={`text-[10px] ${tipoColors[viewItem.tipo] || ''}`}>{viewItem.tipo.toUpperCase()}</Badge>
                                        <Badge variant="secondary" className={`text-[10px] ${estadoColors[viewItem.estado] || ''}`}>{viewItem.estado.charAt(0).toUpperCase() + viewItem.estado.slice(1)}</Badge>
                                        <Badge variant="outline" className={`text-[10px] ${aprob.className}`}>
                                            <AprobIcon className="h-3 w-3 mr-1" />{aprob.label}
                                        </Badge>
                                        <span className="text-xs text-slate-400 ml-auto flex items-center gap-1">
                                            <Calendar className="h-3 w-3" />
                                            {viewItem.fechaPublicacion ? format(new Date(viewItem.fechaPublicacion), "dd MMM yyyy", { locale: es }) : "Sin fecha"}
                                        </span>
                                    </div>
                                </div>
                                <div className="h-px bg-slate-100" />
                                <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">{viewItem.descripcion || 'Sin descripción'}</p>
                                {(viewItem as any).motivoRechazo && (
                                    <div className="p-3 bg-red-50 border border-red-100 rounded-lg">
                                        <p className="text-xs text-red-600"><span className="font-semibold">Motivo de rechazo:</span> {(viewItem as any).motivoRechazo}</p>
                                    </div>
                                )}
                                {(viewItem.urlReferencia || viewItem.urlPublicacion) && (
                                    <>
                                        <div className="h-px bg-slate-100" />
                                        <div className="flex flex-wrap gap-4">
                                            {viewItem.urlReferencia && (
                                                <a href={viewItem.urlReferencia} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-700">
                                                    <ExternalLink className="h-3.5 w-3.5" /> Referencia
                                                </a>
                                            )}
                                            {viewItem.urlPublicacion && (
                                                <a href={viewItem.urlPublicacion} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-fuchsia-600 hover:text-fuchsia-700">
                                                    <ExternalLink className="h-3.5 w-3.5" /> Publicación
                                                </a>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        );
                    })()}
                </DialogContent>
            </Dialog>

            {/* ──── Reject Dialog ──── */}
            <Dialog open={rejectDialogOpen} onOpenChange={(open) => { if (!open) { setRejectDialogOpen(false); setRejectReason(""); } }}>
                <DialogContent className="sm:max-w-[420px] rounded-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-red-600">
                            <XCircle className="h-5 w-5" /> Rechazar Idea
                        </DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                        <Label>Motivo del rechazo *</Label>
                        <Textarea
                            value={rejectReason}
                            onChange={e => setRejectReason(e.target.value)}
                            placeholder="Explica por qué se rechaza esta idea..."
                            className="mt-2"
                            rows={3}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>Cancelar</Button>
                        <Button
                            className="bg-red-600 hover:bg-red-700 text-white"
                            disabled={!rejectReason.trim() || rejectMutation.isPending}
                            onClick={() => rejectTarget && rejectMutation.mutate({ id: rejectTarget, motivoRechazo: rejectReason })}
                        >
                            {rejectMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Rechazar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ──── Guión Dialog ──── */}
            <Dialog open={guionDialogOpen} onOpenChange={(open) => { if (!open) setGuionDialogOpen(false); }}>
                <DialogContent className="sm:max-w-[560px] rounded-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Clapperboard className="h-5 w-5 text-violet-600" />
                            {editingGuionId ? "Editar Guión" : "Crear Guión"}
                        </DialogTitle>
                        {guionTarget && <p className="text-sm text-slate-500 mt-1">{guionTarget.titulo}</p>}
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Actor / Protagonista</Label>
                                <Input value={guionForm.actor} onChange={e => setGuionForm({ ...guionForm, actor: e.target.value })} placeholder="Ej: Dani" className="mt-1" />
                            </div>
                            <div>
                                <Label>Locación</Label>
                                <Input value={guionForm.locacion} onChange={e => setGuionForm({ ...guionForm, locacion: e.target.value })} placeholder="Ej: Fábrica, Oficina" className="mt-1" />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Insumos</Label>
                                <Textarea value={guionForm.insumos} onChange={e => setGuionForm({ ...guionForm, insumos: e.target.value })} placeholder="Cámara, trípode, luces..." className="mt-1" rows={2} />
                            </div>
                            <div>
                                <Label>Vestuario</Label>
                                <Textarea value={guionForm.vestuario} onChange={e => setGuionForm({ ...guionForm, vestuario: e.target.value })} placeholder="Uniforme, casual..." className="mt-1" rows={2} />
                            </div>
                        </div>
                        <div>
                            <Label>Guión / Script</Label>
                            <Textarea value={guionForm.guion} onChange={e => setGuionForm({ ...guionForm, guion: e.target.value })} placeholder="Escribe el guión de la creatividad..." className="mt-1" rows={5} />
                        </div>
                        <div>
                            <Label>Notas adicionales</Label>
                            <Textarea value={guionForm.notas} onChange={e => setGuionForm({ ...guionForm, notas: e.target.value })} placeholder="Observaciones, horarios, etc." className="mt-1" rows={2} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setGuionDialogOpen(false)}>Cancelar</Button>
                        <Button
                            className="bg-violet-600 hover:bg-violet-700 text-white"
                            disabled={guionSaveMutation.isPending}
                            onClick={handleGuionSubmit}
                        >
                            {guionSaveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {editingGuionId ? "Guardar Cambios" : "Crear Guión"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ──── Editor Dialog ──── */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-[520px] max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden rounded-2xl">
                    <div className="bg-gradient-to-r from-indigo-600 to-fuchsia-600 px-6 py-4 text-white">
                        <h2 className="text-lg font-bold">{selectedItem ? 'Editar Creatividad' : 'Nueva Creatividad'}</h2>
                        <p className="text-sm text-white/70">Registra una nueva idea de contenido</p>
                    </div>
                    <form onSubmit={handleFormSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
                        <div>
                            <Label>Título *</Label>
                            <Input name="titulo" defaultValue={selectedItem?.titulo || ''} required className="mt-1" placeholder="Ej: Reel de presentación fábrica" />
                        </div>
                        <div>
                            <Label>Descripción</Label>
                            <Textarea name="descripcion" defaultValue={selectedItem?.descripcion || ''} className="mt-1" rows={3} placeholder="Detalle de la idea..." />
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                            <div>
                                <Label>Tipo</Label>
                                <Select name="tipo" defaultValue={selectedItem?.tipo || 'reel'}>
                                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="reel">Reel</SelectItem>
                                        <SelectItem value="video">Video</SelectItem>
                                        <SelectItem value="post">Post</SelectItem>
                                        <SelectItem value="historia">Historia</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Plataforma</Label>
                                <Select name="plataforma" defaultValue={selectedItem?.plataforma || 'instagram'}>
                                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="instagram">Instagram</SelectItem>
                                        <SelectItem value="tiktok">TikTok</SelectItem>
                                        <SelectItem value="youtube">YouTube</SelectItem>
                                        <SelectItem value="facebook">Facebook</SelectItem>
                                        <SelectItem value="linkedin">LinkedIn</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Estado</Label>
                                <Select name="estado" defaultValue={selectedItem?.estado || 'planificacion'}>
                                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="planificacion">Planificación</SelectItem>
                                        <SelectItem value="grabacion">Grabación</SelectItem>
                                        <SelectItem value="edicion">Edición</SelectItem>
                                        <SelectItem value="completado">Completado</SelectItem>
                                        <SelectItem value="publicado">Publicado</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label>URL Referencia</Label>
                                <Input name="urlReferencia" defaultValue={selectedItem?.urlReferencia || ''} className="mt-1" placeholder="https://..." />
                            </div>
                            <div>
                                <Label>Fecha Publicación</Label>
                                <Input name="fechaPublicacion" type="date" defaultValue={selectedItem?.fechaPublicacion || ''} className="mt-1" />
                            </div>
                        </div>
                        <div>
                            <Label>URL Publicación</Label>
                            <Input name="urlPublicacion" defaultValue={selectedItem?.urlPublicacion || ''} className="mt-1" placeholder="https://instagram.com/..." />
                        </div>
                        <div className="flex justify-end gap-3 pt-2">
                            <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                            <Button type="submit" disabled={formAction.isPending} className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white min-w-[100px]">
                                {formAction.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando...</> : selectedItem ? 'Actualizar' : 'Guardar'}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
