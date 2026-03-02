import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
    Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Play, Video, Plus, Search, ExternalLink, Calendar, Loader2, Edit, Trash2, LayoutGrid, List } from "lucide-react";
import type { CreatividadMarketing } from "@shared/schema";

interface Props {
    mes: number;
    anio: number;
    userRole: string;
}

const tipoColors = {
    reel: "bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400 border-fuchsia-500/20",
    video: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
    post: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
    historia: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20",
};

const estadoColors = {
    planificacion: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    grabacion: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-400",
    edicion: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400",
    completado: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400",
    publicado: "bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-400",
};

const plataformaIcons = {
    instagram: <div className="p-1 rounded bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-500 text-white"><Video className="w-3 h-3" /></div>,
    tiktok: <div className="p-1 rounded bg-black text-white"><Play className="w-3 h-3" /></div>,
    youtube: <div className="p-1 rounded bg-red-600 text-white"><Play className="w-3 h-3" /></div>,
    facebook: <div className="p-1 rounded bg-blue-600 text-white"><ExternalLink className="w-3 h-3" /></div>,
    linkedin: <div className="p-1 rounded bg-blue-700 text-white"><ExternalLink className="w-3 h-3" /></div>,
};

export default function CreatividadesMarketing({ mes, anio, userRole }: Props) {
    const { toast } = useToast();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState<CreatividadMarketing | null>(null);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [searchQuery, setSearchQuery] = useState("");

    const { data: creatividades = [], isLoading } = useQuery<CreatividadMarketing[]>({
        queryKey: ['/api/marketing/creatividades', mes, anio],
    });

    const filteredData = creatividades.filter(c =>
        c.titulo.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.descripcion && c.descripcion.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    const formAction = useMutation({
        mutationFn: async (data: Partial<CreatividadMarketing>) => {
            if (selectedItem) {
                const res = await apiRequest("PATCH", `/api/marketing/creatividades/${selectedItem.id}`, data);
                return res.json();
            } else {
                const res = await apiRequest("POST", "/api/marketing/creatividades", {
                    ...data,
                    mes,
                    anio
                });
                return res.json();
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['/api/marketing/creatividades'] });
            setIsDialogOpen(false);
            setSelectedItem(null);
            toast({
                title: selectedItem ? "Creatividad actualizada" : "Creatividad agregada",
                description: "Los cambios se guardaron correctamente."
            });
        }
    });

    const deleteAction = useMutation({
        mutationFn: async (id: string) => {
            await apiRequest("DELETE", `/api/marketing/creatividades/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['/api/marketing/creatividades'] });
            toast({
                title: "Eliminada",
                description: "La creatividad fue eliminada de los registros."
            });
        }
    });

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold bg-gradient-to-r from-fuchsia-600 to-purple-600 bg-clip-text text-transparent">
                        Gestión de Creatividades
                    </h2>
                    <p className="text-muted-foreground text-sm">
                        Administra reels, videos y posts para las diferentes plataformas sociales.
                    </p>
                </div>
                <Button
                    onClick={() => { setSelectedItem(null); setIsDialogOpen(true); }}
                    className="bg-fuchsia-600 hover:bg-fuchsia-700 shadow-md shadow-fuchsia-500/20 rounded-xl"
                >
                    <Plus className="mr-2 h-4 w-4" />
                    Nueva Creatividad
                </Button>
            </div>

            <div className="flex flex-col sm:flex-row justify-between gap-4">
                <div className="relative max-w-md w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        className="pl-9 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm border-slate-200 dark:border-slate-800 rounded-xl"
                        placeholder="Buscar por título o descripción..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                    />
                </div>
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                    <Button
                        variant="ghost"
                        size="sm"
                        className={`rounded-lg ${viewMode === 'list' ? 'bg-white dark:bg-slate-700 shadow-sm' : ''}`}
                        onClick={() => setViewMode('list')}
                    >
                        <List className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        className={`rounded-lg ${viewMode === 'grid' ? 'bg-white dark:bg-slate-700 shadow-sm' : ''}`}
                        onClick={() => setViewMode('grid')}
                    >
                        <LayoutGrid className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {isLoading ? (
                <div className="py-12 flex justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            ) : filteredData.length === 0 ? (
                <Card className="border-dashed bg-transparent border-2">
                    <CardContent className="py-12 flex flex-col items-center justify-center text-center">
                        <div className="h-16 w-16 rounded-full bg-fuchsia-100 dark:bg-fuchsia-900/20 flex items-center justify-center mb-4 text-fuchsia-600">
                            <Video className="h-8 w-8" />
                        </div>
                        <p className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-1">No hay creatividades</p>
                        <p className="text-sm text-slate-500 max-w-sm">No se encontraron creatividades organizadas para este período.</p>
                    </CardContent>
                </Card>
            ) : viewMode === 'list' ? (
                <Card className="overflow-hidden border-slate-200/60 dark:border-slate-800 shadow-sm">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-slate-50/80 dark:bg-slate-800/50 backdrop-blur-sm">
                                <TableRow>
                                    <TableHead>Título</TableHead>
                                    <TableHead>Plataforma</TableHead>
                                    <TableHead>Estado</TableHead>
                                    <TableHead>Fecha Pub.</TableHead>
                                    <TableHead className="text-right">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredData.map((item) => (
                                    <TableRow key={item.id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                        <TableCell className="font-medium">
                                            <div className="flex items-center gap-2">
                                                <Badge variant="outline" className={tipoColors[item.tipo as keyof typeof tipoColors] || ""}>
                                                    {item.tipo.toUpperCase()}
                                                </Badge>
                                                <span>{item.titulo}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2 capitalize">
                                                {plataformaIcons[item.plataforma as keyof typeof plataformaIcons]}
                                                <span className="text-sm font-medium">{item.plataforma}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="secondary" className={estadoColors[item.estado as keyof typeof estadoColors] || ""}>
                                                {item.estado.replace('_', ' ')}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                <Calendar className="h-3.5 w-3.5" />
                                                {item.fechaPublicacion ? format(new Date(item.fechaPublicacion), "dd MMM", { locale: es }) : "Pendiente"}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {item.urlPublicacion && (
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-500 hover:text-blue-600 hover:bg-blue-50" asChild>
                                                        <a href={item.urlPublicacion} target="_blank" rel="noopener noreferrer">
                                                            <ExternalLink className="h-4 w-4" />
                                                        </a>
                                                    </Button>
                                                )}
                                                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-slate-100 text-slate-600" onClick={() => { setSelectedItem(item); setIsDialogOpen(true); }}>
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => { if (confirm('¿Eliminar esta creatividad?')) deleteAction.mutate(item.id); }}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredData.map(item => (
                        <Card key={item.id} className="group overflow-hidden bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm border-slate-200/60 dark:border-slate-800 hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
                            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-start gap-4">
                                <div className="flex gap-2">
                                    {plataformaIcons[item.plataforma as keyof typeof plataformaIcons]}
                                    <Badge variant="outline" className={`text-[10px] ${tipoColors[item.tipo as keyof typeof tipoColors] || ""}`}>
                                        {item.tipo.toUpperCase()}
                                    </Badge>
                                </div>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-500" onClick={() => { setSelectedItem(item); setIsDialogOpen(true); }}>
                                        <Edit className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            </div>
                            <CardContent className="p-4 pt-3 flex flex-col justify-between h-[160px]">
                                <div>
                                    <h3 className="font-semibold text-base line-clamp-1 mb-1">{item.titulo}</h3>
                                    <p className="text-sm text-slate-500 line-clamp-2">{item.descripcion || "Sin descripción"}</p>
                                </div>
                                <div className="space-y-3 mt-4">
                                    <Badge variant="secondary" className={`w-fit text-xs ${estadoColors[item.estado as keyof typeof estadoColors] || ""}`}>
                                        {item.estado.replace('_', ' ').charAt(0).toUpperCase() + item.estado.slice(1)}
                                    </Badge>
                                    <div className="flex justify-between items-center text-xs font-medium text-slate-500 border-t border-slate-100 dark:border-slate-800 pt-3">
                                        <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> {item.fechaPublicacion ? format(new Date(item.fechaPublicacion), "dd MMM, yyyy", { locale: es }) : "TBD"}</span>
                                        {item.urlPublicacion && (
                                            <a href={item.urlPublicacion} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-fuchsia-600 hover:underline">
                                                Ver post <ExternalLink className="h-3 w-3" />
                                            </a>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Editor Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-[520px] max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden rounded-2xl">
                    {/* Header */}
                    <div className="flex items-center gap-3 px-6 pt-6 pb-4 border-b border-slate-100 dark:border-slate-800">
                        <div className="h-10 w-10 rounded-xl bg-indigo-600 flex items-center justify-center flex-shrink-0">
                            <Video className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <DialogTitle className="text-base font-semibold text-slate-900 dark:text-white leading-tight">
                                {selectedItem ? 'Editar Creatividad' : 'Nueva Creatividad'}
                            </DialogTitle>
                            <DialogDescription className="text-xs text-slate-500 mt-0.5">
                                Completa los detalles de la pieza de contenido.
                            </DialogDescription>
                        </div>
                    </div>

                    {/* Scrollable body */}
                    <form onSubmit={(e) => {
                        e.preventDefault();
                        const formData = new FormData(e.currentTarget);
                        formAction.mutate({
                            titulo: formData.get('titulo') as string,
                            descripcion: formData.get('descripcion') as string,
                            tipo: formData.get('tipo') as string,
                            estado: formData.get('estado') as string,
                            plataforma: formData.get('plataforma') as string,
                            urlReferencia: formData.get('urlReferencia') as string,
                            urlPublicacion: formData.get('urlPublicacion') as string,
                            fechaPublicacion: formData.get('fechaPublicacion') ? formData.get('fechaPublicacion') as string : null,
                        });
                    }} className="flex flex-col flex-1 min-h-0">
                        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">

                            {/* Título */}
                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Título / Idea *</Label>
                                <Input
                                    name="titulo"
                                    defaultValue={selectedItem?.titulo}
                                    required
                                    placeholder="Ej: Challenge de Pintura Navideña"
                                    className="rounded-xl border-slate-200 dark:border-slate-700 focus-visible:ring-indigo-500"
                                />
                            </div>

                            {/* Tipo + Plataforma */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tipo</Label>
                                    <Select name="tipo" defaultValue={selectedItem?.tipo || "reel"}>
                                        <SelectTrigger className="rounded-xl border-slate-200 dark:border-slate-700">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="reel">🎬 Reel</SelectItem>
                                            <SelectItem value="video">📹 Video</SelectItem>
                                            <SelectItem value="post">🖼️ Post (Imagen)</SelectItem>
                                            <SelectItem value="historia">⏱️ Historia</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Plataforma</Label>
                                    <Select name="plataforma" defaultValue={selectedItem?.plataforma || "instagram"}>
                                        <SelectTrigger className="rounded-xl border-slate-200 dark:border-slate-700">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="instagram">📷 Instagram</SelectItem>
                                            <SelectItem value="tiktok">🎵 TikTok</SelectItem>
                                            <SelectItem value="youtube">▶️ YouTube</SelectItem>
                                            <SelectItem value="facebook">👤 Facebook</SelectItem>
                                            <SelectItem value="linkedin">💼 LinkedIn</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {/* Estado */}
                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Estado</Label>
                                <Select name="estado" defaultValue={selectedItem?.estado || "planificacion"}>
                                    <SelectTrigger className="rounded-xl border-slate-200 dark:border-slate-700">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="planificacion">📋 1. Planificación</SelectItem>
                                        <SelectItem value="grabacion">🎥 2. Grabación</SelectItem>
                                        <SelectItem value="edicion">✂️ 3. Edición</SelectItem>
                                        <SelectItem value="completado">✅ 4. Completado</SelectItem>
                                        <SelectItem value="publicado">🚀 5. Publicado</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Fecha + URL Referencia */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Fecha Publicación</Label>
                                    <Input
                                        name="fechaPublicacion"
                                        type="date"
                                        defaultValue={selectedItem?.fechaPublicacion ? new Date(selectedItem.fechaPublicacion).toISOString().split('T')[0] : ""}
                                        className="rounded-xl border-slate-200 dark:border-slate-700 focus-visible:ring-indigo-500"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">URL Referencia</Label>
                                    <Input
                                        name="urlReferencia"
                                        type="url"
                                        placeholder="https://..."
                                        defaultValue={selectedItem?.urlReferencia || ""}
                                        className="rounded-xl border-slate-200 dark:border-slate-700 focus-visible:ring-indigo-500"
                                    />
                                </div>
                            </div>

                            {/* URL Publicación */}
                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Enlace Publicado <span className="font-normal normal-case text-slate-400">(Opcional)</span></Label>
                                <Input
                                    name="urlPublicacion"
                                    type="url"
                                    placeholder="https://instagram.com/p/..."
                                    defaultValue={selectedItem?.urlPublicacion || ""}
                                    className="rounded-xl border-slate-200 dark:border-slate-700 focus-visible:ring-indigo-500"
                                />
                            </div>

                            {/* Descripción */}
                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Guión / Descripción</Label>
                                <Textarea
                                    name="descripcion"
                                    defaultValue={selectedItem?.descripcion || ""}
                                    rows={3}
                                    placeholder="Instrucciones, copies, hashtags..."
                                    className="rounded-xl border-slate-200 dark:border-slate-700 focus-visible:ring-indigo-500 resize-none"
                                />
                            </div>
                        </div>

                        {/* Footer fijo */}
                        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/50">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setIsDialogOpen(false)}
                                className="rounded-xl"
                            >
                                Cancelar
                            </Button>
                            <Button
                                type="submit"
                                disabled={formAction.isPending}
                                className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white min-w-[100px]"
                            >
                                {formAction.isPending
                                    ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando...</>
                                    : selectedItem ? 'Actualizar' : 'Guardar'
                                }
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
