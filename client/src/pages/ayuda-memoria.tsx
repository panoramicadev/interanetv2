import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import {
  Plus, Search, BookOpen, User, Building2, Phone, Mail, MapPin,
  Edit3, Trash2, X, Save, ChevronRight, ShieldCheck, AlertTriangle,
  Sparkles, Target, Package, Clock, CreditCard, Swords, Eye,
  FileText, RefreshCw, CheckCircle2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";

// ─── Constants ────────────────────────────────────────────────────────
const TIPOS_CLIENTE = [
  { value: "ferreteria", label: "Ferretería" },
  { value: "construccion", label: "Construcción" },
  { value: "industrial", label: "Industrial" },
  { value: "hogar", label: "Hogar" },
  { value: "pintureria", label: "Pinturería" },
  { value: "distribuidor", label: "Distribuidor" },
  { value: "otro", label: "Otro" },
];

const FRECUENCIAS = [
  { value: "semanal", label: "Semanal" },
  { value: "quincenal", label: "Quincenal" },
  { value: "mensual", label: "Mensual" },
  { value: "bimestral", label: "Bimestral" },
  { value: "trimestral", label: "Trimestral" },
  { value: "esporadico", label: "Esporádico" },
];

interface AyudaMemoria {
  id: string;
  clienteSeguimientoId: string | null;
  clienteNombre: string;
  rut: string | null;
  giro: string | null;
  direccion: string | null;
  ciudad: string | null;
  tipoCliente: string | null;
  contactoPrincipal: string | null;
  telefonoContacto: string | null;
  emailContacto: string | null;
  productosInteres: string | null;
  frecuenciaCompra: string | null;
  condicionesPago: string | null;
  competencia: string | null;
  fortalezas: string | null;
  debilidades: string | null;
  oportunidades: string | null;
  observaciones: string | null;
  creadoPor: string;
  creadoPorNombre: string;
  createdAt: string;
  updatedAt: string;
}

const emptyForm = {
  clienteNombre: "", rut: "", giro: "", direccion: "", ciudad: "",
  tipoCliente: "", contactoPrincipal: "", telefonoContacto: "", emailContacto: "",
  productosInteres: "", frecuenciaCompra: "", condicionesPago: "", competencia: "",
  fortalezas: "", debilidades: "", oportunidades: "", observaciones: "",
  clienteSeguimientoId: "",
};

// ─── Main Component ───────────────────────────────────────────────────
export default function AyudaMemoriaPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [busqueda, setBusqueda] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewingFicha, setViewingFicha] = useState<AyudaMemoria | null>(null);
  const [form, setForm] = useState(emptyForm);

  const isAdminOrSupervisor = user?.role === "admin" || (user?.role === "supervisor" || user?.role === "encargado_area");

  // ─── Queries ─────────────────────────────────────────────────────
  const { data: fichas = [], isLoading } = useQuery<AyudaMemoria[]>({
    queryKey: ["/api/crm/ayuda-memoria", busqueda],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (busqueda) params.set("busqueda", busqueda);
      const res = await fetch(`/api/crm/ayuda-memoria?${params}`);
      if (!res.ok) throw new Error("Error al cargar fichas");
      return res.json();
    },
  });

  // ─── Mutations ───────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/crm/ayuda-memoria", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Error al crear ficha");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/ayuda-memoria"] });
      toast({ title: "Ficha creada", description: "La ayuda memoria se ha guardado correctamente." });
      closeModal();
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await fetch(`/api/crm/ayuda-memoria/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Error al actualizar");
      return res.json();
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/ayuda-memoria"] });
      toast({ title: "Ficha actualizada" });
      if (viewingFicha?.id === updated.id) setViewingFicha(updated);
      closeModal();
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/crm/ayuda-memoria/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Error al eliminar");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/ayuda-memoria"] });
      toast({ title: "Ficha eliminada" });
      setViewingFicha(null);
    },
  });

  // ─── Helpers ─────────────────────────────────────────────────────
  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const openCreate = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowModal(true);
  };

  const openEdit = (ficha: AyudaMemoria) => {
    setForm({
      clienteNombre: ficha.clienteNombre || "",
      rut: ficha.rut || "",
      giro: ficha.giro || "",
      direccion: ficha.direccion || "",
      ciudad: ficha.ciudad || "",
      tipoCliente: ficha.tipoCliente || "",
      contactoPrincipal: ficha.contactoPrincipal || "",
      telefonoContacto: ficha.telefonoContacto || "",
      emailContacto: ficha.emailContacto || "",
      productosInteres: ficha.productosInteres || "",
      frecuenciaCompra: ficha.frecuenciaCompra || "",
      condicionesPago: ficha.condicionesPago || "",
      competencia: ficha.competencia || "",
      fortalezas: ficha.fortalezas || "",
      debilidades: ficha.debilidades || "",
      oportunidades: ficha.oportunidades || "",
      observaciones: ficha.observaciones || "",
      clienteSeguimientoId: ficha.clienteSeguimientoId || "",
    });
    setEditingId(ficha.id);
    setShowModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = { ...form };
    if (editingId) {
      updateMutation.mutate({ id: editingId, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const formatDate = (d: string | null) => {
    if (!d) return "—";
    const date = new Date(d);
    if (isNaN(date.getTime())) return "—";
    return date.toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });
  };

  // ─── Render ──────────────────────────────────────────────────────

  // Detail view
  if (viewingFicha) {
    return (
      <div className="min-h-screen" data-testid="ayuda-memoria-detail">
        <div className="border-b">
          <div className="px-4 sm:px-6 py-4">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => setViewingFicha(null)} className="text-muted-foreground hover:text-foreground">
                ← Volver
              </Button>
              <div className="h-4 w-px bg-border" />
              <h1 className="text-xl font-bold bg-gradient-to-r from-teal-600 to-emerald-600 bg-clip-text text-transparent truncate">
                {viewingFicha.clienteNombre}
              </h1>
              <div className="ml-auto flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => openEdit(viewingFicha)}>
                  <Edit3 className="w-3.5 h-3.5 mr-1.5" /> Editar
                </Button>
                <Button variant="outline" size="sm" className="text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => { if (confirm("¿Eliminar esta ficha?")) deleteMutation.mutate(viewingFicha.id); }}>
                  <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Eliminar
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
          {/* Info Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Datos del Cliente */}
            <div className="bg-background rounded-2xl border shadow-sm p-5 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-8 h-8 rounded-xl bg-teal-100 dark:bg-teal-900/40 flex items-center justify-center">
                  <User className="w-4 h-4 text-teal-600" />
                </div>
                <h3 className="font-semibold text-sm">Datos del Cliente</h3>
              </div>
              <DetailRow icon={User} label="Nombre" value={viewingFicha.clienteNombre} />
              <DetailRow icon={FileText} label="RUT" value={viewingFicha.rut} mono />
              <DetailRow icon={Building2} label="Giro" value={viewingFicha.giro} />
              <DetailRow icon={MapPin} label="Dirección" value={viewingFicha.direccion} />
              <DetailRow icon={MapPin} label="Ciudad" value={viewingFicha.ciudad} />
              {viewingFicha.tipoCliente && (
                <div className="flex items-center gap-2 pt-1">
                  <Badge className="bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300 border-0 text-[10px]">
                    {TIPOS_CLIENTE.find(t => t.value === viewingFicha.tipoCliente)?.label || viewingFicha.tipoCliente}
                  </Badge>
                </div>
              )}
            </div>

            {/* Contacto */}
            <div className="bg-background rounded-2xl border shadow-sm p-5 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                  <Phone className="w-4 h-4 text-blue-600" />
                </div>
                <h3 className="font-semibold text-sm">Contacto</h3>
              </div>
              <DetailRow icon={User} label="Contacto Principal" value={viewingFicha.contactoPrincipal} />
              <DetailRow icon={Phone} label="Teléfono" value={viewingFicha.telefonoContacto} />
              <DetailRow icon={Mail} label="Email" value={viewingFicha.emailContacto} />
            </div>

            {/* Comercial */}
            <div className="bg-background rounded-2xl border shadow-sm p-5 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
                  <Package className="w-4 h-4 text-amber-600" />
                </div>
                <h3 className="font-semibold text-sm">Información Comercial</h3>
              </div>
              <DetailRow icon={Package} label="Productos de Interés" value={viewingFicha.productosInteres} />
              <DetailRow icon={Clock} label="Frecuencia de Compra" value={FRECUENCIAS.find(f => f.value === viewingFicha.frecuenciaCompra)?.label || viewingFicha.frecuenciaCompra} />
              <DetailRow icon={CreditCard} label="Condiciones de pago" value={viewingFicha.condicionesPago} />
              <DetailRow icon={Swords} label="Competencia" value={viewingFicha.competencia} />
            </div>
          </div>

          {/* FODA Section */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FodaCard icon={ShieldCheck} title="Fortalezas" content={viewingFicha.fortalezas} gradient="from-emerald-500 to-green-600" bgLight="bg-emerald-50 dark:bg-emerald-900/20" />
            <FodaCard icon={AlertTriangle} title="Debilidades" content={viewingFicha.debilidades} gradient="from-red-500 to-rose-600" bgLight="bg-red-50 dark:bg-red-900/20" />
            <FodaCard icon={Target} title="Oportunidades" content={viewingFicha.oportunidades} gradient="from-blue-500 to-indigo-600" bgLight="bg-blue-50 dark:bg-blue-900/20" />
          </div>

          {/* Observaciones */}
          {viewingFicha.observaciones && (
            <div className="bg-background rounded-2xl border shadow-sm p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-xl bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center">
                  <FileText className="w-4 h-4 text-purple-600" />
                </div>
                <h3 className="font-semibold text-sm">Observaciones</h3>
              </div>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{viewingFicha.observaciones}</p>
            </div>
          )}

          {/* Metadata */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground/60 pt-2">
            <span>Creado por: <span className="font-medium text-muted-foreground">{viewingFicha.creadoPorNombre}</span></span>
            <span>•</span>
            <span>Creado: {formatDate(viewingFicha.createdAt)}</span>
            <span>•</span>
            <span>Actualizado: {formatDate(viewingFicha.updatedAt)}</span>
          </div>
        </div>

        {/* Edit/Create Modal */}
        <FormModal
          open={showModal}
          onOpenChange={(v) => { if (!v) closeModal(); }}
          form={form}
          setForm={setForm}
          onSubmit={handleSubmit}
          isLoading={createMutation.isPending || updateMutation.isPending}
          isEditing={!!editingId}
        />
      </div>
    );
  }

  // List view
  return (
    <div className="min-h-screen" data-testid="ayuda-memoria-page">
      {/* Header */}
      <div className="border-b">
        <div className="px-4 sm:px-6 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-teal-600 to-emerald-600 bg-clip-text text-transparent">
                Ayuda Memoria
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Fichas de cliente — define quién es cada cliente, qué compra y más
              </p>
            </div>
            <Button
              onClick={openCreate}
              className="bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 text-white shadow-lg shadow-teal-500/25 transition-all duration-300 hover:shadow-xl hover:shadow-teal-500/30"
              data-testid="btn-nueva-ficha"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nueva Ficha
            </Button>
          </div>

          {/* Search */}
          <div className="flex items-center gap-2 mt-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre, RUT, giro, ciudad..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="pl-9 bg-background/50"
                data-testid="input-busqueda"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 sm:p-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="w-6 h-6 animate-spin text-teal-500" />
            <span className="ml-3 text-muted-foreground">Cargando fichas...</span>
          </div>
        ) : fichas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center mb-4">
              <BookOpen className="w-8 h-8 text-teal-500" />
            </div>
            <h3 className="font-semibold text-lg mb-1">Sin fichas aún</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-sm">
              Crea tu primera ayuda memoria para documentar la información clave de tus clientes.
            </p>
            <Button onClick={openCreate} className="bg-gradient-to-r from-teal-500 to-emerald-600 text-white">
              <Plus className="w-4 h-4 mr-2" /> Crear Primera Ficha
            </Button>
          </div>
        ) : (
          <div className="bg-background rounded-2xl border shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b bg-muted/30 flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">
                {fichas.length} {fichas.length === 1 ? "ficha" : "fichas"} de ayuda memoria
              </p>
            </div>
            <div className="overflow-x-auto">
              <Table className="w-full min-w-[900px]">
                <TableHeader>
                  <TableRow className="bg-slate-50/80 dark:bg-slate-800/40 hover:bg-slate-50/80">
                    <TableHead className="font-semibold text-[10px] uppercase tracking-wider text-muted-foreground py-2.5 pl-4 w-[200px]">Cliente</TableHead>
                    <TableHead className="font-semibold text-[10px] uppercase tracking-wider text-muted-foreground py-2.5 w-[100px]">Tipo</TableHead>
                    <TableHead className="font-semibold text-[10px] uppercase tracking-wider text-muted-foreground py-2.5 w-[120px]">Contacto</TableHead>
                    <TableHead className="font-semibold text-[10px] uppercase tracking-wider text-muted-foreground py-2.5 w-[100px]">Ciudad</TableHead>
                    <TableHead className="font-semibold text-[10px] uppercase tracking-wider text-muted-foreground py-2.5 w-[100px]">Frecuencia</TableHead>
                    <TableHead className="font-semibold text-[10px] uppercase tracking-wider text-muted-foreground py-2.5 w-[120px]">Creado por</TableHead>
                    <TableHead className="font-semibold text-[10px] uppercase tracking-wider text-muted-foreground py-2.5 w-[90px]">Actualizado</TableHead>
                    <TableHead className="text-right font-semibold text-[10px] uppercase tracking-wider text-muted-foreground py-2.5 pr-4 w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fichas.map((ficha) => {
                    const initials = (ficha.clienteNombre || "?").split(" ").map((w: string) => w[0]).join("").substring(0, 2).toUpperCase();
                    return (
                      <TableRow
                        key={ficha.id}
                        className="group cursor-pointer hover:bg-teal-50/40 dark:hover:bg-teal-950/20 transition-colors border-b border-muted/50 last:border-0"
                        onClick={() => setViewingFicha(ficha)}
                      >
                        <TableCell className="py-2.5 pl-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                              {initials}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-xs text-foreground truncate">{ficha.clienteNombre}</p>
                              {ficha.rut && <p className="text-[10px] text-muted-foreground font-mono">{ficha.rut}</p>}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="py-2.5">
                          {ficha.tipoCliente ? (
                            <Badge variant="outline" className="text-[9px] font-medium px-1.5 py-0 bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-900/30 dark:text-teal-300 dark:border-teal-700">
                              {TIPOS_CLIENTE.find(t => t.value === ficha.tipoCliente)?.label || ficha.tipoCliente}
                            </Badge>
                          ) : <span className="text-[10px] text-muted-foreground/50">—</span>}
                        </TableCell>
                        <TableCell className="py-2.5">
                          <div className="flex flex-col">
                            <span className="text-[11px] truncate">{ficha.contactoPrincipal || "—"}</span>
                            {ficha.telefonoContacto && <span className="text-[10px] text-muted-foreground/60 tabular-nums">{ficha.telefonoContacto}</span>}
                          </div>
                        </TableCell>
                        <TableCell className="py-2.5">
                          <span className="text-[11px] text-foreground/70">{ficha.ciudad || "—"}</span>
                        </TableCell>
                        <TableCell className="py-2.5">
                          {ficha.frecuenciaCompra ? (
                            <Badge variant="outline" className="text-[9px] font-medium px-1.5 py-0">
                              {FRECUENCIAS.find(f => f.value === ficha.frecuenciaCompra)?.label || ficha.frecuenciaCompra}
                            </Badge>
                          ) : <span className="text-[10px] text-muted-foreground/50">—</span>}
                        </TableCell>
                        <TableCell className="py-2.5">
                          <span className="text-[11px] text-foreground/70 truncate block">{ficha.creadoPorNombre}</span>
                        </TableCell>
                        <TableCell className="py-2.5">
                          <span className="text-[11px] text-foreground/70 whitespace-nowrap">{formatDate(ficha.updatedAt)}</span>
                        </TableCell>
                        <TableCell className="text-right py-2.5 pr-4" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 hover:bg-teal-100 dark:hover:bg-teal-900/30 text-teal-600" onClick={() => setViewingFicha(ficha)}>
                              <Eye className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-600" onClick={() => openEdit(ficha)}>
                              <Edit3 className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500" onClick={() => { if (confirm("¿Eliminar esta ficha?")) deleteMutation.mutate(ficha.id); }}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <FormModal
        open={showModal}
        onOpenChange={(v) => { if (!v) closeModal(); }}
        form={form}
        setForm={setForm}
        onSubmit={handleSubmit}
        isLoading={createMutation.isPending || updateMutation.isPending}
        isEditing={!!editingId}
      />
    </div>
  );
}

// ─── Detail Row ───────────────────────────────────────────────────────
function DetailRow({ icon: Icon, label, value, mono }: { icon: any; label: string; value: string | null | undefined; mono?: boolean }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2">
      <Icon className="w-3.5 h-3.5 text-muted-foreground/50 mt-0.5 flex-shrink-0" />
      <div>
        <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">{label}</p>
        <p className={`text-sm text-foreground ${mono ? "font-mono" : ""}`}>{value}</p>
      </div>
    </div>
  );
}

// ─── FODA Card ────────────────────────────────────────────────────────
function FodaCard({ icon: Icon, title, content, gradient, bgLight }: { icon: any; title: string; content: string | null; gradient: string; bgLight: string }) {
  return (
    <div className={`rounded-2xl border shadow-sm overflow-hidden ${bgLight}`}>
      <div className={`h-1.5 bg-gradient-to-r ${gradient}`} />
      <div className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center`}>
            <Icon className="w-3.5 h-3.5 text-white" />
          </div>
          <h3 className="font-semibold text-sm">{title}</h3>
        </div>
        {content ? (
          <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{content}</p>
        ) : (
          <p className="text-xs text-muted-foreground/40 italic">Sin información</p>
        )}
      </div>
    </div>
  );
}

// ─── Form Modal ───────────────────────────────────────────────────────
function FormModal({ open, onOpenChange, form, setForm, onSubmit, isLoading, isEditing }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  form: typeof emptyForm;
  setForm: React.Dispatch<React.SetStateAction<typeof emptyForm>>;
  onSubmit: (e: React.FormEvent) => void;
  isLoading: boolean;
  isEditing: boolean;
}) {
  const updateField = (field: string, value: string) => setForm(f => ({ ...f, [field]: value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center">
              {isEditing ? <Edit3 className="w-4 h-4 text-white" /> : <Plus className="w-4 h-4 text-white" />}
            </div>
            {isEditing ? "Editar Ayuda Memoria" : "Nueva Ayuda Memoria"}
          </DialogTitle>
          <DialogDescription>
            {isEditing ? "Actualiza la información de la ficha del cliente." : "Completa la información del cliente para crear su ficha."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-5 mt-2">
          {/* Sección: Datos del Cliente */}
          <fieldset className="space-y-3">
            <legend className="text-xs font-semibold uppercase tracking-wider text-teal-600 flex items-center gap-1.5 mb-2">
              <User className="w-3.5 h-3.5" /> Datos del Cliente
            </legend>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label htmlFor="clienteNombre">Nombre del cliente *</Label>
                <Input id="clienteNombre" value={form.clienteNombre} onChange={e => updateField("clienteNombre", e.target.value)} required placeholder="Nombre o razón social" />
              </div>
              <div>
                <Label htmlFor="rut">RUT</Label>
                <Input id="rut" value={form.rut} onChange={e => updateField("rut", e.target.value)} placeholder="12.345.678-9" />
              </div>
              <div>
                <Label htmlFor="giro">Giro</Label>
                <Input id="giro" value={form.giro} onChange={e => updateField("giro", e.target.value)} placeholder="Rubro del negocio" />
              </div>
              <div>
                <Label htmlFor="direccion">Dirección</Label>
                <Input id="direccion" value={form.direccion} onChange={e => updateField("direccion", e.target.value)} placeholder="Dirección principal" />
              </div>
              <div>
                <Label htmlFor="ciudad">Ciudad</Label>
                <Input id="ciudad" value={form.ciudad} onChange={e => updateField("ciudad", e.target.value)} placeholder="Ciudad" />
              </div>
              <div>
                <Label htmlFor="tipoCliente">Tipo de Cliente</Label>
                <Select value={form.tipoCliente} onValueChange={v => updateField("tipoCliente", v)}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar tipo" /></SelectTrigger>
                  <SelectContent>
                    {TIPOS_CLIENTE.map(t => (<SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </fieldset>

          <div className="border-t" />

          {/* Sección: Contacto */}
          <fieldset className="space-y-3">
            <legend className="text-xs font-semibold uppercase tracking-wider text-blue-600 flex items-center gap-1.5 mb-2">
              <Phone className="w-3.5 h-3.5" /> Contacto
            </legend>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label htmlFor="contactoPrincipal">Contacto Principal</Label>
                <Input id="contactoPrincipal" value={form.contactoPrincipal} onChange={e => updateField("contactoPrincipal", e.target.value)} placeholder="Nombre del contacto" />
              </div>
              <div>
                <Label htmlFor="telefonoContacto">Teléfono</Label>
                <Input id="telefonoContacto" value={form.telefonoContacto} onChange={e => updateField("telefonoContacto", e.target.value)} placeholder="+56 9..." />
              </div>
              <div>
                <Label htmlFor="emailContacto">Email</Label>
                <Input id="emailContacto" type="email" value={form.emailContacto} onChange={e => updateField("emailContacto", e.target.value)} placeholder="correo@empresa.cl" />
              </div>
            </div>
          </fieldset>

          <div className="border-t" />

          {/* Sección: Comercial */}
          <fieldset className="space-y-3">
            <legend className="text-xs font-semibold uppercase tracking-wider text-amber-600 flex items-center gap-1.5 mb-2">
              <Package className="w-3.5 h-3.5" /> Información Comercial
            </legend>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label htmlFor="productosInteres">Productos de Interés</Label>
                <Textarea id="productosInteres" value={form.productosInteres} onChange={e => updateField("productosInteres", e.target.value)} placeholder="¿Qué suele comprar o qué le interesa?" rows={2} />
              </div>
              <div>
                <Label htmlFor="frecuenciaCompra">Frecuencia de Compra</Label>
                <Select value={form.frecuenciaCompra} onValueChange={v => updateField("frecuenciaCompra", v)}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    {FRECUENCIAS.map(f => (<SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="condicionesPago">Condiciones de Pago</Label>
                <Input id="condicionesPago" value={form.condicionesPago} onChange={e => updateField("condicionesPago", e.target.value)} placeholder="Contado, Crédito 30 días..." />
              </div>
              <div className="col-span-2">
                <Label htmlFor="competencia">Competencia</Label>
                <Textarea id="competencia" value={form.competencia} onChange={e => updateField("competencia", e.target.value)} placeholder="¿Qué marcas de la competencia usa?" rows={2} />
              </div>
            </div>
          </fieldset>

          <div className="border-t" />

          {/* Sección: Análisis */}
          <fieldset className="space-y-3">
            <legend className="text-xs font-semibold uppercase tracking-wider text-emerald-600 flex items-center gap-1.5 mb-2">
              <Target className="w-3.5 h-3.5" /> Análisis del Cliente
            </legend>
            <div className="grid grid-cols-1 gap-3">
              <div>
                <Label htmlFor="fortalezas" className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3 h-3 text-emerald-500" /> Fortalezas
                </Label>
                <Textarea id="fortalezas" value={form.fortalezas} onChange={e => updateField("fortalezas", e.target.value)} placeholder="Puntos fuertes de la relación comercial..." rows={2} />
              </div>
              <div>
                <Label htmlFor="debilidades" className="flex items-center gap-1.5">
                  <AlertTriangle className="w-3 h-3 text-red-500" /> Debilidades
                </Label>
                <Textarea id="debilidades" value={form.debilidades} onChange={e => updateField("debilidades", e.target.value)} placeholder="Puntos débiles o riesgos a tener en cuenta..." rows={2} />
              </div>
              <div>
                <Label htmlFor="oportunidades" className="flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-blue-500" /> Oportunidades
                </Label>
                <Textarea id="oportunidades" value={form.oportunidades} onChange={e => updateField("oportunidades", e.target.value)} placeholder="Oportunidades de crecimiento con este cliente..." rows={2} />
              </div>
            </div>
          </fieldset>

          <div className="border-t" />

          {/* Observaciones */}
          <div>
            <Label htmlFor="observaciones" className="flex items-center gap-1.5">
              <FileText className="w-3 h-3 text-purple-500" /> Observaciones Generales
            </Label>
            <Textarea id="observaciones" value={form.observaciones} onChange={e => updateField("observaciones", e.target.value)} placeholder="Notas adicionales sobre el cliente..." rows={3} />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !form.clienteNombre.trim()}
              className="bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 text-white"
            >
              {isLoading ? (
                <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Guardando...</>
              ) : (
                <><Save className="w-4 h-4 mr-2" /> {isEditing ? "Guardar Cambios" : "Crear Ficha"}</>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
