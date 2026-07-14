import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Loader2, Pencil, Users, Phone, Mail, Building2 } from "lucide-react";

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

export default function ProveedoresTabMarketing({ userRole }: { userRole: string }) {
    const { toast } = useToast();
    const [provDialogOpen, setProvDialogOpen] = useState(false);
    const [editingProv, setEditingProv] = useState<ProveedorMarketing | null>(null);
    const [provForm, setProvForm] = useState({ nombre: "", contacto: "", email: "", telefono: "", rut: "", rubro: "", notas: "" });
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [deleteId, setDeleteId] = useState<string | null>(null);

    const isAdmin = userRole === "admin" || userRole === "supervisor" || userRole === "marketing";

    const { data: proveedores = [] } = useQuery<ProveedorMarketing[]>({
        queryKey: ["/api/marketing/proveedores"],
    });

    const resetProvForm = () => {
        setProvDialogOpen(false);
        setEditingProv(null);
        setProvForm({ nombre: "", contacto: "", email: "", telefono: "", rut: "", rubro: "", notas: "" });
    };

    const createProvMutation = useMutation({
        mutationFn: async (data: any) => await apiRequest("POST", "/api/marketing/proveedores", data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/marketing/proveedores"] });
            resetProvForm();
            toast({ title: "Proveedor registrado" });
        },
        onError: () => toast({ title: "Error", variant: "destructive" }),
    });

    const updateProvMutation = useMutation({
        mutationFn: async ({ id, updates }: { id: string; updates: any }) => await apiRequest("PATCH", `/api/marketing/proveedores/${id}`, updates),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/marketing/proveedores"] });
            resetProvForm();
            toast({ title: "Proveedor actualizado" });
        },
        onError: () => toast({ title: "Error", variant: "destructive" }),
    });

    const deleteProvMutation = useMutation({
        mutationFn: async (id: string) => await apiRequest("DELETE", `/api/marketing/proveedores/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/marketing/proveedores"] });
            setDeleteDialogOpen(false);
            toast({ title: "Proveedor eliminado" });
        },
        onError: () => toast({ title: "Error", variant: "destructive" }),
    });

    const handleProvSubmit = () => {
        if (!provForm.nombre.trim()) return;
        const payload = {
            nombre: provForm.nombre.trim(),
            contacto: provForm.contacto.trim() || null,
            email: provForm.email.trim() || null,
            telefono: provForm.telefono.trim() || null,
            rut: provForm.rut.trim() || null,
            rubro: provForm.rubro.trim() || null,
            notas: provForm.notas.trim() || null,
        };
        if (editingProv) {
            updateProvMutation.mutate({ id: editingProv.id, updates: payload });
        } else {
            createProvMutation.mutate(payload);
        }
    };

    const handleEditProv = (prov: ProveedorMarketing) => {
        setEditingProv(prov);
        setProvForm({
            nombre: prov.nombre,
            contacto: prov.contacto || "",
            email: prov.email || "",
            telefono: prov.telefono || "",
            rut: prov.rut || "",
            rubro: prov.rubro || "",
            notas: prov.notas || "",
        });
        setProvDialogOpen(true);
    };

    return (
        <div className="space-y-6">
            <Card className="border-0 shadow-lg overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-orange-700 to-orange-800 text-white pb-4">
                    <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <Users className="h-5 w-5" />
                            Proveedores de Marketing
                        </CardTitle>
                        {isAdmin && (
                            <Button
                                onClick={() => { resetProvForm(); setProvDialogOpen(true); }}
                                size="sm"
                                className="rounded-xl bg-white/20 hover:bg-white/30 text-white border-0"
                            >
                                <Plus className="mr-1 h-4 w-4" /> Agregar
                            </Button>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {proveedores.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                            <Building2 className="h-10 w-10 mb-3 opacity-30" />
                            <p className="font-medium">Sin proveedores registrados</p>
                            <p className="text-sm">Registra proveedores para tener su info a mano.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {proveedores.map((prov) => (
                                <div key={prov.id} className="flex items-center gap-4 px-5 py-4 hover:bg-orange-50/40 transition-colors group">
                                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                                        {prov.nombre.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold text-slate-800 text-sm">{prov.nombre}</span>
                                            {prov.rubro && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{prov.rubro}</Badge>}
                                        </div>
                                        <div className="flex flex-wrap gap-3 mt-1 text-xs text-slate-500">
                                            {prov.contacto && <span className="flex items-center gap-1"><Users className="h-3 w-3" />{prov.contacto}</span>}
                                            {prov.telefono && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{prov.telefono}</span>}
                                            {prov.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{prov.email}</span>}
                                            {prov.rut && <span className="text-slate-400">RUT: {prov.rut}</span>}
                                        </div>
                                        {prov.notas && <p className="text-xs text-slate-400 mt-1 line-clamp-1">{prov.notas}</p>}
                                    </div>
                                    {isAdmin && (
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-400 hover:text-orange-600 hover:bg-orange-50" onClick={() => handleEditProv(prov)}>
                                                <Pencil className="h-3.5 w-3.5" />
                                            </Button>
                                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-400 hover:text-red-500 hover:bg-red-50" onClick={() => { setDeleteId(prov.id); setDeleteDialogOpen(true); }}>
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Proveedor Add/Edit Dialog */}
            <Dialog open={provDialogOpen} onOpenChange={(open) => { if (!open) resetProvForm(); }}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Users className="h-5 w-5 text-orange-600" />
                            {editingProv ? "Editar Proveedor" : "Nuevo Proveedor"}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Nombre *</Label>
                                <Input value={provForm.nombre} onChange={(e) => setProvForm({ ...provForm, nombre: e.target.value })} placeholder="Ej: Agencia XYZ" className="mt-1" />
                            </div>
                            <div>
                                <Label>Rubro</Label>
                                <Input value={provForm.rubro} onChange={(e) => setProvForm({ ...provForm, rubro: e.target.value })} placeholder="Ej: Diseño gráfico" className="mt-1" />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Persona de contacto</Label>
                                <Input value={provForm.contacto} onChange={(e) => setProvForm({ ...provForm, contacto: e.target.value })} placeholder="Juan Pérez" className="mt-1" />
                            </div>
                            <div>
                                <Label>RUT</Label>
                                <Input value={provForm.rut} onChange={(e) => setProvForm({ ...provForm, rut: e.target.value })} placeholder="12.345.678-9" className="mt-1" />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Teléfono</Label>
                                <Input value={provForm.telefono} onChange={(e) => setProvForm({ ...provForm, telefono: e.target.value })} placeholder="+56 9 1234 5678" className="mt-1" />
                            </div>
                            <div>
                                <Label>Email</Label>
                                <Input value={provForm.email} onChange={(e) => setProvForm({ ...provForm, email: e.target.value })} placeholder="contacto@proveedor.cl" className="mt-1" type="email" />
                            </div>
                        </div>
                        <div>
                            <Label>Notas</Label>
                            <Textarea value={provForm.notas} onChange={(e) => setProvForm({ ...provForm, notas: e.target.value })} placeholder="Observaciones..." className="mt-1" rows={2} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={resetProvForm}>Cancelar</Button>
                        <Button onClick={handleProvSubmit} disabled={!provForm.nombre.trim() || createProvMutation.isPending || updateProvMutation.isPending} className="bg-orange-600 hover:bg-orange-700">
                            {(createProvMutation.isPending || updateProvMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {editingProv ? "Guardar Cambios" : "Registrar"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete confirmation */}
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar este proveedor?</AlertDialogTitle>
                        <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <Button
                            className="bg-red-600 hover:bg-red-700 text-white"
                            disabled={deleteProvMutation.isPending}
                            onClick={() => { if (deleteId) deleteProvMutation.mutate(deleteId); }}
                        >
                            {deleteProvMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Eliminar
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
