import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Send, Plus, Loader2, Mail, Users, Trash2, ArrowLeft, Eye, FileText, Megaphone,
  CheckCircle2, XCircle, Clock, AlertTriangle, RefreshCw, Calendar, Sparkles,
  Bold, Italic, List, Link2, Heading, Save, TestTube2, PlayCircle, Ban,
  Image as ImageIcon, Upload, Minus, Quote, MousePointerClick, MoveVertical,
  Search, Building2, Target, ClipboardList, Download, Monitor, Smartphone,
  UserPlus, CheckCheck, Square, X,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient as globalQC } from "@/lib/queryClient";
import { renderCampaignEmail } from "@shared/campaign-email";

// ── Tipos ──────────────────────────────────────────────────────
type Campaign = {
  id: string;
  name: string;
  subject: string;
  preheader?: string | null;
  fromName?: string | null;
  replyTo?: string | null;
  bodyHtml: string;
  status: string;
  scheduledAt?: string | null;
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  registerInCrm: boolean;
  sentAt?: string | null;
  createdAt: string;
};

type Recipient = {
  id: string;
  email: string;
  name?: string | null;
  source: string;
  status: string;
  errorMessage?: string | null;
};

type CampaignDetail = {
  campaign: Campaign;
  recipients: Recipient[];
  stats: { status: string; count: number }[];
};

// ── Helpers ────────────────────────────────────────────────────
const fmtNum = (n: number) => new Intl.NumberFormat("es-CL").format(n || 0);
const fmtDate = (s?: string | null) => (s ? new Date(s).toLocaleString("es-CL", { dateStyle: "medium", timeStyle: "short" }) : "—");

const STATUS_META: Record<string, { label: string; cls: string; icon: any }> = {
  draft: { label: "Borrador", cls: "bg-slate-100 text-slate-700 border-slate-200", icon: FileText },
  scheduled: { label: "Programada", cls: "bg-blue-100 text-blue-700 border-blue-200", icon: Calendar },
  sending: { label: "Enviando", cls: "bg-amber-100 text-amber-700 border-amber-200", icon: Loader2 },
  sent: { label: "Enviada", cls: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
  partial: { label: "Parcial", cls: "bg-orange-100 text-orange-700 border-orange-200", icon: AlertTriangle },
  failed: { label: "Falló", cls: "bg-red-100 text-red-700 border-red-200", icon: XCircle },
  cancelled: { label: "Cancelada", cls: "bg-slate-100 text-slate-500 border-slate-200", icon: Ban },
};

function StatusBadge({ status }: { status: string }) {
  const m = STATUS_META[status] || STATUS_META.draft;
  const Icon = m.icon;
  return (
    <Badge className={`${m.cls} gap-1 font-medium`}>
      <Icon className={`h-3 w-3 ${status === "sending" ? "animate-spin" : ""}`} />
      {m.label}
    </Badge>
  );
}

const SOURCE_LABEL: Record<string, string> = {
  client: "Cliente", manual: "Manual", crm: "CRM", seguimiento: "Seguimiento",
};

// ================================================================
// PÁGINA PRINCIPAL
// ================================================================
export default function CampanasPage() {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: campaigns = [], isLoading } = useQuery<Campaign[]>({
    queryKey: ["/api/campanas"],
    refetchInterval: (q) => ((q.state.data as Campaign[] | undefined)?.some((c) => c.status === "sending") ? 4000 : false),
  });

  const stats = useMemo(() => {
    const total = campaigns.length;
    const sent = campaigns.filter((c) => ["sent", "partial"].includes(c.status)).length;
    const recipients = campaigns.reduce((a, c) => a + (c.sentCount || 0), 0);
    const scheduled = campaigns.filter((c) => c.status === "scheduled").length;
    return { total, sent, recipients, scheduled };
  }, [campaigns]);

  if (editingId) {
    return <CampaignEditor campaignId={editingId} onBack={() => { setEditingId(null); qc.invalidateQueries({ queryKey: ["/api/campanas"] }); }} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-orange-50/30">
      <div className="container mx-auto px-6 py-8 space-y-6 max-w-7xl">
        {/* Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-6 shadow-xl">
          <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
          <div className="relative flex items-center gap-4">
            <div className="p-3 rounded-xl bg-orange-500/20 backdrop-blur-sm border border-orange-400/30">
              <Megaphone className="h-6 w-6 text-orange-300" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-white tracking-tight">Campañas de Marketing</h1>
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider bg-orange-500/20 text-orange-200 border border-orange-400/30 px-2 py-0.5 rounded-full">
                  <Sparkles className="h-3 w-3" /> Resend
                </span>
              </div>
              <p className="text-sm text-slate-300 mt-1">Creá newsletters y envíos masivos a clientes, CRM, seguimiento o listas propias.</p>
            </div>
            <Button onClick={() => setCreating(true)} className="bg-orange-500 hover:bg-orange-600">
              <Plus className="h-4 w-4 mr-2" /> Nueva campaña
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Campañas" value={fmtNum(stats.total)} icon={Mail} color="text-slate-700" />
          <StatCard label="Enviadas" value={fmtNum(stats.sent)} icon={CheckCircle2} color="text-emerald-600" />
          <StatCard label="Correos enviados" value={fmtNum(stats.recipients)} icon={Send} color="text-orange-600" />
          <StatCard label="Programadas" value={fmtNum(stats.scheduled)} icon={Calendar} color="text-blue-600" />
        </div>

        {/* Lista */}
        <Card>
          <CardHeader>
            <CardTitle>Tus campañas</CardTitle>
            <CardDescription>Historial de campañas creadas. Hacé clic para editar, revisar o enviar.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
                <Loader2 className="h-4 w-4 animate-spin" /> Cargando...
              </div>
            ) : campaigns.length === 0 ? (
              <div className="text-center py-12">
                <Megaphone className="h-10 w-10 mx-auto text-slate-300 mb-3" />
                <p className="text-sm text-muted-foreground">Todavía no creaste campañas.</p>
                <Button variant="outline" className="mt-4" onClick={() => setCreating(true)}>
                  <Plus className="h-4 w-4 mr-2" /> Crear la primera
                </Button>
              </div>
            ) : (
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Campaña</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Destinatarios</TableHead>
                      <TableHead className="text-right">Enviados</TableHead>
                      <TableHead>Fecha</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {campaigns.map((c) => (
                      <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setEditingId(c.id)}>
                        <TableCell>
                          <div className="font-medium">{c.name}</div>
                          <div className="text-xs text-muted-foreground truncate max-w-[320px]">{c.subject}</div>
                        </TableCell>
                        <TableCell><StatusBadge status={c.status} /></TableCell>
                        <TableCell className="text-right tabular-nums">{fmtNum(c.totalRecipients)}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          <span className="text-emerald-600 font-medium">{fmtNum(c.sentCount)}</span>
                          {c.failedCount > 0 && <span className="text-red-500 text-xs ml-1">/ {fmtNum(c.failedCount)} ✕</span>}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {c.status === "scheduled" ? `⏰ ${fmtDate(c.scheduledAt)}` : fmtDate(c.sentAt || c.createdAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <CreateCampaignDialog
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(id) => { setCreating(false); setEditingId(id); }}
      />
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color }: { label: string; value: string; icon: any; color: string }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`p-2 rounded-lg bg-slate-50 border ${color}`}><Icon className="h-5 w-5" /></div>
        <div>
          <div className="text-2xl font-bold tabular-nums">{value}</div>
          <div className="text-xs text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Crear campaña ──────────────────────────────────────────────
function CreateCampaignDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");

  useEffect(() => { if (open) { setName(""); setSubject(""); } }, [open]);

  const createMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("/api/campanas", { method: "POST", data: { name, subject, bodyHtml: "" } });
      return res.json();
    },
    onSuccess: (c: Campaign) => { globalQC.invalidateQueries({ queryKey: ["/api/campanas"] }); onCreated(c.id); },
    onError: (e: any) => toast({ title: "Error", description: e?.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Nueva campaña</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Nombre interno</Label>
            <Input className="mt-1.5" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Newsletter Julio 2026" />
          </div>
          <div>
            <Label>Asunto del correo</Label>
            <Input className="mt-1.5" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Ej: Nuevas ofertas de invierno 🎨" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => createMut.mutate()} disabled={!name.trim() || !subject.trim() || createMut.isPending} className="bg-orange-500 hover:bg-orange-600">
            {createMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
            Crear y continuar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ================================================================
// EDITOR DE CAMPAÑA
// ================================================================
function CampaignEditor({ campaignId, onBack }: { campaignId: string; onBack: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<CampaignDetail>({
    queryKey: ["/api/campanas", campaignId],
    refetchInterval: (q) => ((q.state.data as CampaignDetail | undefined)?.campaign.status === "sending" ? 3000 : false),
  });

  const campaign = data?.campaign;
  const locked = !!campaign && ["sending", "sent", "partial"].includes(campaign.status);

  // Form local (detalles + contenido)
  const [form, setForm] = useState({ name: "", subject: "", preheader: "", fromName: "", replyTo: "", bodyHtml: "", registerInCrm: false });
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (campaign && !loaded) {
      setForm({
        name: campaign.name, subject: campaign.subject, preheader: campaign.preheader || "",
        fromName: campaign.fromName || "", replyTo: campaign.replyTo || "",
        bodyHtml: campaign.bodyHtml || "", registerInCrm: !!campaign.registerInCrm,
      });
      setLoaded(true);
    }
  }, [campaign, loaded]);

  const saveMut = useMutation({
    mutationFn: async () => (await apiRequest(`/api/campanas/${campaignId}`, { method: "PATCH", data: form })).json(),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/campanas", campaignId] }); toast({ title: "Cambios guardados" }); },
    onError: (e: any) => toast({ title: "Error al guardar", description: e?.message, variant: "destructive" }),
  });

  if (isLoading || !campaign) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground gap-2">
        <Loader2 className="h-5 w-5 animate-spin" /> Cargando campaña...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50">
      <div className="container mx-auto px-6 py-6 space-y-5 max-w-6xl">
        {/* Barra superior */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-1" /> Volver</Button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold">{form.name || "Campaña"}</h2>
              <StatusBadge status={campaign.status} />
            </div>
          </div>
          {!locked && (
            <Button variant="outline" onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
              {saveMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Guardar
            </Button>
          )}
        </div>

        {locked ? (
          <SentDashboard detail={data!} campaignId={campaignId} />
        ) : (
          <Tabs defaultValue="detalles">
            <TabsList>
              <TabsTrigger value="detalles"><FileText className="h-4 w-4 mr-1.5" /> Detalles</TabsTrigger>
              <TabsTrigger value="contenido"><Mail className="h-4 w-4 mr-1.5" /> Contenido</TabsTrigger>
              <TabsTrigger value="audiencia"><Users className="h-4 w-4 mr-1.5" /> Audiencia ({fmtNum(campaign.totalRecipients)})</TabsTrigger>
              <TabsTrigger value="enviar"><Send className="h-4 w-4 mr-1.5" /> Revisar y enviar</TabsTrigger>
            </TabsList>

            {/* DETALLES */}
            <TabsContent value="detalles" className="mt-5">
              <Card>
                <CardHeader><CardTitle className="text-base">Detalles de la campaña</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Nombre interno</Label>
                      <Input className="mt-1.5" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                    </div>
                    <div>
                      <Label>Asunto <span className="text-red-500">*</span></Label>
                      <Input className="mt-1.5" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Podés usar {{nombre}}" />
                    </div>
                    <div className="md:col-span-2">
                      <Label>Preheader <span className="text-xs text-muted-foreground">(texto de vista previa en la bandeja)</span></Label>
                      <Input className="mt-1.5" value={form.preheader} onChange={(e) => setForm({ ...form, preheader: e.target.value })} placeholder="Una línea que aparece junto al asunto" />
                    </div>
                    <div>
                      <Label>Nombre del remitente</Label>
                      <Input className="mt-1.5" value={form.fromName} onChange={(e) => setForm({ ...form, fromName: e.target.value })} placeholder="Panorámica Marketing" />
                    </div>
                    <div>
                      <Label>Responder a (reply-to)</Label>
                      <Input className="mt-1.5" value={form.replyTo} onChange={(e) => setForm({ ...form, replyTo: e.target.value })} placeholder="marketing@pinturaspanoramica.cl" />
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-4 rounded-lg bg-blue-50 border border-blue-100">
                    <Switch checked={form.registerInCrm} onCheckedChange={(v) => setForm({ ...form, registerInCrm: v })} />
                    <div>
                      <div className="font-medium text-sm">Registrar contactos manuales en CRM y Seguimiento</div>
                      <div className="text-xs text-muted-foreground">Al enviar, los correos cargados manualmente se insertan como leads (etapa "campaña") y en Seguimiento, si no existen ya.</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* CONTENIDO */}
            <TabsContent value="contenido" className="mt-5">
              <ContentEditor value={form.bodyHtml} onChange={(html) => setForm({ ...form, bodyHtml: html })} subject={form.subject} preheader={form.preheader} />
            </TabsContent>

            {/* AUDIENCIA */}
            <TabsContent value="audiencia" className="mt-5">
              <AudienceBuilder campaignId={campaignId} detail={data!} />
            </TabsContent>

            {/* ENVIAR */}
            <TabsContent value="enviar" className="mt-5">
              <SendPanel campaign={campaign} form={form} onSaveFirst={() => saveMut.mutateAsync()} onBack={onBack} />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}

// ── Recursos del correo (subida de imágenes) ───────────────────
const MAX_ASSET_MB = 5;
const LOGO_URL = `${typeof window !== "undefined" ? window.location.origin : ""}/panoramica-logo-white.png`;

/** Sube un archivo al storage del sistema y devuelve una URL ABSOLUTA
 *  (los clientes de correo no resuelven rutas relativas). */
async function uploadAsset(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await apiRequest("/api/upload", { method: "POST", data: fd });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.message || "No se pudo subir el archivo");
  }
  const d = await res.json();
  const url: string = d?.url || "";
  if (!url) throw new Error("El servidor no devolvió una URL");
  return url.startsWith("http") ? url : `${window.location.origin}${url}`;
}

function imageHtml({ url, width = 100, href, alt = "" }: { url: string; width?: number; href?: string; alt?: string }) {
  const img = `<img src="${url}" alt="${alt}" style="width:${width}%;max-width:100%;height:auto;border:0;border-radius:6px;display:inline-block" />`;
  return `<p style="text-align:center;margin:18px 0">${href ? `<a href="${href}" target="_blank" style="text-decoration:none">${img}</a>` : img}</p>`;
}

function buttonHtml({ text, url, color, full }: { text: string; url: string; color: string; full: boolean }) {
  return `<p style="text-align:center;margin:24px 0"><a href="${url}" target="_blank" style="background:${color};color:#ffffff;padding:14px 32px;border-radius:6px;text-decoration:none;font-weight:bold;display:inline-block;font-family:Arial,Helvetica,sans-serif${full ? ";width:75%" : ""}">${text}</a></p>`;
}

const DIVIDER_HTML = `<div style="border-top:1px solid #e5e7eb;margin:26px 0;line-height:0;font-size:0">&nbsp;</div>`;
const SPACER_HTML = `<div style="height:28px;line-height:28px;font-size:0">&nbsp;</div>`;
const CALLOUT_HTML = `<div style="background:#fff7ed;border-left:4px solid #fd6301;padding:14px 18px;border-radius:4px;margin:20px 0"><p style="margin:0;color:#1a1f2e;font-size:14px;line-height:1.6">Escribí acá tu mensaje destacado.</p></div>`;

// ── Editor de contenido (rich text ligero + preview) ───────────
function ContentEditor({ value, onChange, subject, preheader }: { value: string; onChange: (html: string) => void; subject: string; preheader: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const savedRange = useRef<Range | null>(null);
  const [mode, setMode] = useState<"visual" | "html">("visual");
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [imgOpen, setImgOpen] = useState(false);
  const [btnOpen, setBtnOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (mode === "visual" && ref.current && ref.current.innerHTML !== value) {
      ref.current.innerHTML = value || "";
    }
  }, [mode]); // eslint-disable-line

  // El cursor se pierde al abrir un diálogo: guardamos el rango para insertar
  // el recurso exactamente donde estaba escribiendo el usuario.
  const saveSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && ref.current?.contains(sel.anchorNode)) {
      savedRange.current = sel.getRangeAt(0).cloneRange();
    }
  };

  const focusEditor = () => {
    ref.current?.focus();
    const sel = window.getSelection();
    if (savedRange.current && sel && ref.current?.contains(savedRange.current.commonAncestorContainer)) {
      sel.removeAllRanges();
      sel.addRange(savedRange.current);
    }
  };

  const exec = (cmd: string, arg?: string) => {
    focusEditor();
    document.execCommand(cmd, false, arg);
    if (ref.current) onChange(ref.current.innerHTML);
    saveSelection();
  };

  const insertHtml = (html: string) => {
    focusEditor();
    document.execCommand("insertHTML", false, html);
    if (ref.current) onChange(ref.current.innerHTML);
    saveSelection();
  };

  /** Sube e inserta imágenes soltadas o pegadas directamente en el editor. */
  const insertFiles = async (files: FileList | File[]) => {
    const imgs = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (!imgs.length) {
      toast({ title: "Solo se pueden insertar imágenes", description: "Arrastrá archivos JPG, PNG, GIF o WebP.", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      for (const f of imgs) {
        if (f.size > MAX_ASSET_MB * 1024 * 1024) {
          toast({ title: `"${f.name}" supera ${MAX_ASSET_MB} MB`, description: "Comprimí la imagen: los correos pesados caen en spam.", variant: "destructive" });
          continue;
        }
        const url = await uploadAsset(f);
        insertHtml(imageHtml({ url, width: 100, alt: f.name.replace(/\.[^.]+$/, "") }));
      }
    } catch (e: any) {
      toast({ title: "Error al subir la imagen", description: e?.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const previewSrc = useMemo(() => {
    const body = (value?.trim() || "<p style='color:#94a3b8'>(Sin contenido)</p>")
      .replace(/\{\{\s*nombre\s*\}\}/gi, "Juan Pérez")
      .replace(/\{\{\s*email\s*\}\}/gi, "cliente@correo.cl");
    // Misma función que usa el servidor al enviar → la vista previa es fiel.
    return renderCampaignEmail({ body, logoUrl: LOGO_URL, preheader: null });
  }, [value]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Contenido del correo</CardTitle>
            <div className="flex gap-1">
              <Button size="sm" variant={mode === "visual" ? "default" : "outline"} onClick={() => setMode("visual")}>Visual</Button>
              <Button size="sm" variant={mode === "html" ? "default" : "outline"} onClick={() => setMode("html")}>HTML</Button>
            </div>
          </div>
          <CardDescription>
            Usá <code className="bg-slate-100 px-1 rounded">{"{{nombre}}"}</code> para personalizar con el nombre de cada destinatario.
            El logo, la cabecera negra y el pie se agregan automáticamente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {mode === "visual" ? (
            <>
              <div className="border rounded-lg bg-slate-50 mb-2 divide-y">
                {/* Formato */}
                <div className="flex flex-wrap items-center gap-1 p-1.5">
                  <ToolbarBtn onClick={() => exec("bold")} icon={Bold} title="Negrita" />
                  <ToolbarBtn onClick={() => exec("italic")} icon={Italic} title="Cursiva" />
                  <ToolbarBtn onClick={() => exec("formatBlock", "<h2>")} icon={Heading} title="Título" />
                  <ToolbarBtn onClick={() => exec("insertUnorderedList")} icon={List} title="Lista" />
                  <ToolbarBtn onClick={() => { const url = prompt("URL del enlace:"); if (url) exec("createLink", url); }} icon={Link2} title="Enlace" />
                  <ToolbarBtn onClick={() => exec("removeFormat")} icon={X} title="Quitar formato" />
                </div>
                {/* Recursos */}
                <div className="flex flex-wrap items-center gap-1 p-1.5">
                  <span className="text-[11px] font-medium text-slate-500 px-1.5">Insertar</span>
                  <InsertBtn onClick={() => { saveSelection(); setImgOpen(true); }} icon={ImageIcon} label="Imagen" />
                  <InsertBtn onClick={() => { saveSelection(); setBtnOpen(true); }} icon={MousePointerClick} label="Botón" />
                  <InsertBtn onClick={() => insertHtml(DIVIDER_HTML)} icon={Minus} label="Separador" />
                  <InsertBtn onClick={() => insertHtml(SPACER_HTML)} icon={MoveVertical} label="Espacio" />
                  <InsertBtn onClick={() => insertHtml(CALLOUT_HTML)} icon={Quote} label="Destacado" />
                </div>
              </div>

              <div
                ref={ref}
                contentEditable
                onInput={(e) => onChange((e.target as HTMLDivElement).innerHTML)}
                onKeyUp={saveSelection}
                onMouseUp={saveSelection}
                onBlur={saveSelection}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files?.length) insertFiles(e.dataTransfer.files); }}
                onPaste={(e) => {
                  const files = Array.from(e.clipboardData?.files || []);
                  if (files.length) { e.preventDefault(); insertFiles(files); }
                }}
                className={`min-h-[320px] border rounded-lg p-4 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400/40 prose prose-sm max-w-none transition-colors ${dragging ? "border-orange-400 bg-orange-50/50 ring-2 ring-orange-300/40" : ""}`}
                style={{ lineHeight: 1.6 }}
                suppressContentEditableWarning
              />
              <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                {uploading ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin text-orange-500" /> Subiendo imagen…</>
                ) : (
                  <><Upload className="h-3.5 w-3.5" /> Arrastrá o pegá imágenes acá y se suben solas (máx. {MAX_ASSET_MB} MB).</>
                )}
              </div>
            </>
          ) : (
            <Textarea
              value={value}
              onChange={(e) => onChange(e.target.value)}
              rows={16}
              className="font-mono text-xs"
              placeholder="<p>Hola {{nombre}}, ...</p>"
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base flex items-center gap-2"><Eye className="h-4 w-4" /> Vista previa</CardTitle>
            <div className="flex gap-1">
              <Button size="sm" variant={device === "desktop" ? "default" : "outline"} className="h-8 w-8 p-0" title="Escritorio" onClick={() => setDevice("desktop")}><Monitor className="h-4 w-4" /></Button>
              <Button size="sm" variant={device === "mobile" ? "default" : "outline"} className="h-8 w-8 p-0" title="Móvil" onClick={() => setDevice("mobile")}><Smartphone className="h-4 w-4" /></Button>
            </div>
          </div>
          <CardDescription className="truncate">Asunto: <strong>{subject || "(sin asunto)"}</strong></CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center bg-slate-100 rounded-lg p-2">
            <iframe
              title="preview"
              srcDoc={previewSrc}
              className="h-[460px] border rounded-lg bg-white transition-all"
              style={{ width: device === "mobile" ? 380 : "100%" }}
            />
          </div>
          {preheader && (
            <p className="text-xs text-muted-foreground mt-2 truncate">Preheader: {preheader}</p>
          )}
        </CardContent>
      </Card>

      <InsertImageDialog open={imgOpen} onClose={() => setImgOpen(false)} onInsert={(html) => { setImgOpen(false); insertHtml(html); }} />
      <InsertButtonDialog open={btnOpen} onClose={() => setBtnOpen(false)} onInsert={(html) => { setBtnOpen(false); insertHtml(html); }} />
    </div>
  );
}

function ToolbarBtn({ onClick, icon: Icon, title }: { onClick: () => void; icon: any; title: string }) {
  return (
    <Button type="button" size="sm" variant="ghost" className="h-8 w-8 p-0" title={title} onClick={onClick}>
      <Icon className="h-4 w-4" />
    </Button>
  );
}

function InsertBtn({ onClick, icon: Icon, label }: { onClick: () => void; icon: any; label: string }) {
  return (
    <Button type="button" size="sm" variant="outline" className="h-8 text-xs bg-white gap-1.5" onClick={onClick}>
      <Icon className="h-3.5 w-3.5" /> {label}
    </Button>
  );
}

// ── Diálogo: insertar imagen (subida o URL) ────────────────────
function InsertImageDialog({ open, onClose, onInsert }: { open: boolean; onClose: () => void; onInsert: (html: string) => void }) {
  const { toast } = useToast();
  const [url, setUrl] = useState("");
  const [href, setHref] = useState("");
  const [alt, setAlt] = useState("");
  const [width, setWidth] = useState("100");
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (open) { setUrl(""); setHref(""); setAlt(""); setWidth("100"); setDrag(false); } }, [open]);

  const take = async (file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast({ title: "Solo imágenes", description: "Elegí un JPG, PNG, GIF o WebP.", variant: "destructive" });
    if (file.size > MAX_ASSET_MB * 1024 * 1024) return toast({ title: `Máximo ${MAX_ASSET_MB} MB`, description: "Comprimí la imagen antes de subirla.", variant: "destructive" });
    setBusy(true);
    try {
      setUrl(await uploadAsset(file));
      if (!alt) setAlt(file.name.replace(/\.[^.]+$/, ""));
    } catch (e: any) {
      toast({ title: "Error al subir", description: e?.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><ImageIcon className="h-4 w-4" /> Insertar imagen</DialogTitle></DialogHeader>
        <div className="space-y-4 py-1">
          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); take(e.dataTransfer.files?.[0]); }}
            className={`cursor-pointer rounded-lg border-2 border-dashed p-6 text-center transition-colors ${drag ? "border-orange-400 bg-orange-50" : "border-slate-200 hover:border-orange-300 hover:bg-slate-50"}`}
          >
            {busy ? (
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Subiendo…</div>
            ) : url ? (
              <img src={url} alt="" className="max-h-40 mx-auto rounded" />
            ) : (
              <>
                <Upload className="h-7 w-7 mx-auto text-slate-400 mb-2" />
                <div className="text-sm font-medium">Arrastrá una imagen o hacé clic para elegirla</div>
                <div className="text-xs text-muted-foreground mt-1">JPG, PNG, GIF o WebP · hasta {MAX_ASSET_MB} MB</div>
              </>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => take(e.target.files?.[0])} />
          </div>

          <div>
            <Label className="text-xs">…o pegá la URL de una imagen</Label>
            <Input className="mt-1.5" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Tamaño</Label>
              <Select value={width} onValueChange={setWidth}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="100">Ancho completo</SelectItem>
                  <SelectItem value="70">Grande (70%)</SelectItem>
                  <SelectItem value="45">Mediana (45%)</SelectItem>
                  <SelectItem value="25">Chica (25%)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Enlace al hacer clic (opcional)</Label>
              <Input className="mt-1.5" value={href} onChange={(e) => setHref(e.target.value)} placeholder="https://..." />
            </div>
          </div>

          <div>
            <Label className="text-xs">Texto alternativo <span className="text-muted-foreground">(se ve si el correo bloquea imágenes)</span></Label>
            <Input className="mt-1.5" value={alt} onChange={(e) => setAlt(e.target.value)} placeholder="Ej: Promoción de invierno" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            className="bg-orange-500 hover:bg-orange-600"
            disabled={!url.trim() || busy}
            onClick={() => onInsert(imageHtml({ url: url.trim(), width: Number(width), href: href.trim() || undefined, alt: alt.trim() }))}
          >
            <Plus className="h-4 w-4 mr-1.5" /> Insertar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Diálogo: insertar botón ────────────────────────────────────
function InsertButtonDialog({ open, onClose, onInsert }: { open: boolean; onClose: () => void; onInsert: (html: string) => void }) {
  const [text, setText] = useState("Ver más");
  const [url, setUrl] = useState("");
  const [color, setColor] = useState("#fd6301");
  const [full, setFull] = useState(false);

  useEffect(() => { if (open) { setText("Ver más"); setUrl(""); setColor("#fd6301"); setFull(false); } }, [open]);

  const COLORS = [
    { v: "#fd6301", label: "Naranja" },
    { v: "#000000", label: "Negro" },
    { v: "#1a1f2e", label: "Azul oscuro" },
    { v: "#16a34a", label: "Verde" },
  ];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle className="flex items-center gap-2"><MousePointerClick className="h-4 w-4" /> Insertar botón</DialogTitle></DialogHeader>
        <div className="space-y-4 py-1">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Texto</Label>
              <Input className="mt-1.5" value={text} onChange={(e) => setText(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Enlace</Label>
              <Input className="mt-1.5" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." />
            </div>
          </div>
          <div>
            <Label className="text-xs">Color</Label>
            <div className="flex gap-2 mt-1.5">
              {COLORS.map((c) => (
                <button
                  key={c.v}
                  type="button"
                  title={c.label}
                  onClick={() => setColor(c.v)}
                  className={`h-8 w-8 rounded-full border-2 transition ${color === c.v ? "border-orange-400 scale-110" : "border-transparent"}`}
                  style={{ background: c.v }}
                />
              ))}
              <label className="flex items-center gap-2 ml-3 text-xs text-muted-foreground cursor-pointer">
                <Checkbox checked={full} onCheckedChange={(v) => setFull(!!v)} /> Ancho grande
              </label>
            </div>
          </div>
          <div className="rounded-lg border bg-slate-50 p-4 text-center">
            <div className="text-[11px] text-muted-foreground mb-2">Vista previa</div>
            <span style={{ background: color, color: "#fff", padding: "12px 28px", borderRadius: 6, fontWeight: "bold", display: "inline-block", fontSize: 14 }}>
              {text || "Botón"}
            </span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button className="bg-orange-500 hover:bg-orange-600" disabled={!text.trim() || !url.trim()} onClick={() => onInsert(buttonHtml({ text: text.trim(), url: url.trim(), color, full }))}>
            <Plus className="h-4 w-4 mr-1.5" /> Insertar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Constructor de audiencia ───────────────────────────────────
type Cand = { email: string; name: string | null; source: string; sourceId: string | null };

const CRM_STAGES = [
  { v: "lead", label: "Lead" }, { v: "contacto", label: "Contacto" }, { v: "visita", label: "Visita" },
  { v: "lista_precio", label: "Lista de precios" }, { v: "campana", label: "Campaña" },
  { v: "primera_venta", label: "Primera venta" }, { v: "promesa", label: "Promesa" }, { v: "venta", label: "Venta" },
];
const SEG_ESTADOS = [
  { v: "nuevo", label: "Nuevo" }, { v: "contactado", label: "Contactado" }, { v: "cotizacion", label: "Cotización" },
  { v: "venta", label: "Venta" }, { v: "despacho", label: "Despacho" }, { v: "completado", label: "Completado" },
  { v: "perdido", label: "Perdido" },
];

function AudienceBuilder({ campaignId, detail }: { campaignId: string; detail: CampaignDetail }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["/api/campanas", campaignId] });

  const addMut = useMutation({
    mutationFn: async (body: any) => (await apiRequest(`/api/campanas/${campaignId}/recipients`, { method: "POST", data: body })).json(),
    onSuccess: (r: any) => {
      invalidate();
      toast({
        title: r.added > 0 ? `${fmtNum(r.added)} destinatarios agregados` : "No se agregó ninguno nuevo",
        description: r.added > 0 ? `Total en la campaña: ${fmtNum(r.total)}` : "Todos los correos ya estaban en la lista.",
      });
    },
    onError: (e: any) => toast({ title: "Error", description: e?.message, variant: "destructive" }),
  });

  const clearMut = useMutation({
    mutationFn: async () => (await apiRequest(`/api/campanas/${campaignId}/recipients`, { method: "DELETE" })).json(),
    onSuccess: () => { invalidate(); toast({ title: "Destinatarios vaciados" }); },
  });

  const removeMut = useMutation({
    mutationFn: async (rid: string) => (await apiRequest(`/api/campanas/${campaignId}/recipients/${rid}`, { method: "DELETE" })).json(),
    onSuccess: invalidate,
  });

  // Los correos que ya están en la campaña: el picker los marca como agregados
  // en vez de dejar que el usuario los elija dos veces.
  const existing = useMemo(
    () => new Set(detail.recipients.map((r) => r.email.toLowerCase())),
    [detail.recipients],
  );

  const [crmStages, setCrmStages] = useState<string[]>([]);
  const [segEstados, setSegEstados] = useState<string[]>([]);

  const add = (b: any) => addMut.mutate(b);
  const adding = addMut.isPending;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
      {/* Fuentes */}
      <div className="lg:col-span-3 space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><UserPlus className="h-4 w-4" /> Agregar destinatarios</CardTitle>
            <CardDescription>
              Elegí una fuente, buscá y agregá todos los que coincidan o marcá uno por uno. Los correos repetidos se descartan solos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="clients">
              <TabsList className="mb-4 grid grid-cols-4 w-full">
                <TabsTrigger value="clients" className="gap-1.5"><Building2 className="h-3.5 w-3.5" /> Clientes</TabsTrigger>
                <TabsTrigger value="crm" className="gap-1.5"><Target className="h-3.5 w-3.5" /> CRM</TabsTrigger>
                <TabsTrigger value="seguimiento" className="gap-1.5"><ClipboardList className="h-3.5 w-3.5" /> Seguimiento</TabsTrigger>
                <TabsTrigger value="manual" className="gap-1.5"><Mail className="h-3.5 w-3.5" /> Lista manual</TabsTrigger>
              </TabsList>

              <TabsContent value="clients">
                <SourceExplorer
                  source="clients"
                  hint="Clientes del sistema con email registrado."
                  placeholder="Buscar por nombre, código, RUT o email…"
                  extraParams={{}}
                  existing={existing}
                  onAdd={add}
                  adding={adding}
                />
              </TabsContent>

              <TabsContent value="crm">
                <SourceExplorer
                  source="crm"
                  hint="Leads del CRM con email. Sin etapas marcadas se incluyen todas."
                  placeholder="Buscar por nombre o email…"
                  extraParams={{ stages: crmStages }}
                  existing={existing}
                  onAdd={add}
                  adding={adding}
                  filters={<ChipFilter options={CRM_STAGES} selected={crmStages} onChange={setCrmStages} />}
                />
              </TabsContent>

              <TabsContent value="seguimiento">
                <SourceExplorer
                  source="seguimiento"
                  hint="Clientes en Seguimiento con email. Sin estados marcados se incluyen todos."
                  placeholder="Buscar por nombre o email…"
                  extraParams={{ estados: segEstados }}
                  existing={existing}
                  onAdd={add}
                  adding={adding}
                  filters={<ChipFilter options={SEG_ESTADOS} selected={segEstados} onChange={setSegEstados} />}
                />
              </TabsContent>

              <TabsContent value="manual">
                <ManualSource existing={existing} onAdd={add} adding={adding} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Lista final */}
      <div className="lg:col-span-2">
        <RecipientsPanel detail={detail} onRemove={(id) => removeMut.mutate(id)} onClear={() => clearMut.mutate()} clearing={clearMut.isPending} />
      </div>
    </div>
  );
}

function ChipFilter({ options, selected, onChange }: { options: { v: string; label: string }[]; selected: string[]; onChange: (v: string[]) => void }) {
  const toggle = (v: string) => onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          onClick={() => toggle(o.v)}
          className={`text-xs px-2.5 py-1 rounded-full border transition ${selected.includes(o.v) ? "bg-orange-500 text-white border-orange-500" : "bg-white text-slate-600 border-slate-200 hover:border-orange-300"}`}
        >
          {o.label}
        </button>
      ))}
      {selected.length > 0 && (
        <button type="button" onClick={() => onChange([])} className="text-xs text-muted-foreground underline ml-1">Limpiar</button>
      )}
    </div>
  );
}

/**
 * Explorador de una fuente: busca en vivo, muestra los contactos reales y
 * permite agregar toda la coincidencia o solo los marcados.
 */
function SourceExplorer({ source, hint, placeholder, extraParams, filters, existing, onAdd, adding }: {
  source: string;
  hint: string;
  placeholder: string;
  extraParams: Record<string, any>;
  filters?: ReactNode;
  existing: Set<string>;
  onAdd: (b: any) => void;
  adding: boolean;
}) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Cand[]>([]);
  const [total, setTotal] = useState(0);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState<Record<string, Cand>>({});

  const paramsKey = JSON.stringify({ source, q: q.trim(), ...extraParams });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await apiRequest("/api/campanas/audience/list", {
          method: "POST",
          data: { source, q: q.trim() || undefined, ...extraParams, limit: 300 },
        });
        const d = await res.json();
        if (cancelled) return;
        setItems(d.items || []);
        setTotal(d.total || 0);
        setTruncated(!!d.truncated);
      } catch {
        if (!cancelled) { setItems([]); setTotal(0); setTruncated(false); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 350);
    return () => { cancelled = true; clearTimeout(t); };
  }, [paramsKey]); // eslint-disable-line

  // Al cambiar el filtro, la selección anterior deja de tener sentido.
  useEffect(() => { setSel({}); }, [paramsKey]); // eslint-disable-line

  const available = items.filter((i) => !existing.has(i.email));
  const selected = Object.values(sel).filter((c) => !existing.has(c.email));
  const allSelected = available.length > 0 && available.every((i) => sel[i.email]);

  const toggleAll = () => {
    if (allSelected) return setSel({});
    const next: Record<string, Cand> = {};
    for (const i of available) next[i.email] = i;
    setSel(next);
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{hint}</p>

      <div className="relative">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <Input className="pl-9" placeholder={placeholder} value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {filters}

      <div className="rounded-lg border overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b text-xs">
          <div className="flex items-center gap-2">
            {loading ? (
              <span className="flex items-center gap-1.5 text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Buscando…</span>
            ) : (
              <span className="text-muted-foreground">
                <strong className="text-slate-800">{fmtNum(total)}</strong> contactos coinciden
                {truncated && <span className="ml-1">· se muestran los primeros {fmtNum(items.length)}</span>}
              </span>
            )}
          </div>
          {available.length > 0 && (
            <button type="button" onClick={toggleAll} className="flex items-center gap-1.5 text-slate-600 hover:text-orange-600">
              {allSelected ? <CheckCheck className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
              {allSelected ? "Quitar marcas" : "Marcar los visibles"}
            </button>
          )}
        </div>

        <div className="max-h-[260px] overflow-y-auto divide-y">
          {!loading && items.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-8">
              No se encontraron contactos con email para este filtro.
            </div>
          ) : (
            items.map((c) => {
              const already = existing.has(c.email);
              const checked = !!sel[c.email];
              return (
                <label
                  key={`${c.email}-${c.sourceId || ""}`}
                  className={`flex items-center gap-3 px-3 py-2 text-sm ${already ? "opacity-50" : "hover:bg-muted/40 cursor-pointer"}`}
                >
                  <Checkbox
                    checked={already || checked}
                    disabled={already}
                    onCheckedChange={(v) =>
                      setSel((p) => {
                        const n = { ...p };
                        if (v) n[c.email] = c; else delete n[c.email];
                        return n;
                      })
                    }
                  />
                  <div className="flex-1 min-w-0">
                    <div className="truncate font-medium">{c.name || c.email}</div>
                    <div className="truncate text-xs text-muted-foreground">{c.email}</div>
                  </div>
                  {already && <Badge variant="outline" className="text-[10px] shrink-0">Ya agregado</Badge>}
                </label>
              );
            })
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Button
          size="sm"
          className="bg-orange-500 hover:bg-orange-600"
          disabled={adding || selected.length === 0}
          onClick={() => onAdd({ source: "selection", items: selected })}
        >
          {adding ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
          Agregar {selected.length > 0 ? `${fmtNum(selected.length)} marcados` : "marcados"}
        </Button>
        <div className="flex-1" />
        <Button
          size="sm"
          variant="outline"
          disabled={adding || total === 0}
          onClick={() => onAdd({ source, q: q.trim() || undefined, ...extraParams })}
          title="Agrega todos los contactos que coinciden con el filtro, no solo los visibles"
        >
          <Users className="h-4 w-4 mr-2" /> Agregar los {fmtNum(total)} del filtro
        </Button>
      </div>
    </div>
  );
}

const CLIENT_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function ManualSource({ existing, onAdd, adding }: { existing: Set<string>; onAdd: (b: any) => void; adding: boolean }) {
  const { toast } = useToast();
  const [raw, setRaw] = useState("");
  const [drag, setDrag] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Análisis en vivo del pegado: el usuario ve al instante qué va a entrar.
  const parsed = useMemo(() => {
    const valid = new Map<string, string | null>();
    const invalid: string[] = [];
    let dupes = 0, already = 0;
    for (const line of raw.split(/[\n\r]+/)) {
      for (const part of line.split(/[,;\t]+/)) {
        const entry = part.trim();
        if (!entry) continue;
        const angle = entry.match(/^(.*?)<([^>]+)>$/);
        const email = (angle ? angle[2] : entry).trim().toLowerCase();
        const name = angle ? angle[1].trim().replace(/^["']|["']$/g, "") : null;
        if (!CLIENT_EMAIL_RE.test(email)) { invalid.push(entry); continue; }
        if (existing.has(email)) { already++; continue; }
        if (valid.has(email)) { dupes++; continue; }
        valid.set(email, name || null);
      }
    }
    return { count: valid.size, invalid, dupes, already };
  }, [raw, existing]);

  const readFile = (file?: File | null) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return toast({ title: "Archivo muy grande", description: "Máximo 2 MB de texto.", variant: "destructive" });
    const reader = new FileReader();
    reader.onload = () => setRaw((p) => (p ? `${p}\n${String(reader.result || "")}` : String(reader.result || "")));
    reader.readAsText(file);
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Pegá correos separados por coma, punto y coma o saltos de línea. Soporta el formato "Nombre &lt;correo@dom.cl&gt;".
      </p>

      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); readFile(e.dataTransfer.files?.[0]); }}
        className={`rounded-lg transition-colors ${drag ? "ring-2 ring-orange-300" : ""}`}
      >
        <Textarea
          rows={8}
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder={"juan@dom.cl\nMaría Pérez <maria@dom.cl>\npedro@dom.cl"}
          className="font-mono text-xs"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs">
        <Button size="sm" variant="outline" className="h-8" onClick={() => fileRef.current?.click()}>
          <Upload className="h-3.5 w-3.5 mr-1.5" /> Importar CSV / TXT
        </Button>
        <input ref={fileRef} type="file" accept=".csv,.txt,text/plain,text/csv" className="hidden" onChange={(e) => readFile(e.target.files?.[0])} />
        {raw.trim() && (
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">{fmtNum(parsed.count)} nuevos</Badge>
            {parsed.already > 0 && <Badge variant="outline">{fmtNum(parsed.already)} ya en la lista</Badge>}
            {parsed.dupes > 0 && <Badge variant="outline">{fmtNum(parsed.dupes)} repetidos</Badge>}
            {parsed.invalid.length > 0 && (
              <Badge className="bg-red-100 text-red-700 border-red-200" title={parsed.invalid.slice(0, 20).join("\n")}>
                {fmtNum(parsed.invalid.length)} inválidos
              </Badge>
            )}
          </div>
        )}
        <div className="flex-1" />
        <Button size="sm" className="bg-orange-500 hover:bg-orange-600" disabled={adding || parsed.count === 0} onClick={() => onAdd({ source: "manual", raw })}>
          {adding ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
          Agregar {fmtNum(parsed.count)}
        </Button>
      </div>
      {parsed.invalid.length > 0 && (
        <p className="text-xs text-red-500 truncate">Se ignorarán: {parsed.invalid.slice(0, 5).join(", ")}{parsed.invalid.length > 5 ? "…" : ""}</p>
      )}
    </div>
  );
}

/** Lista final de destinatarios: buscador, filtro por origen y exportación. */
function RecipientsPanel({ detail, onRemove, onClear, clearing }: { detail: CampaignDetail; onRemove: (id: string) => void; onClear: () => void; clearing: boolean }) {
  const [q, setQ] = useState("");
  const [srcFilter, setSrcFilter] = useState<string | null>(null);

  const bySource = useMemo(() => {
    const m: Record<string, number> = {};
    for (const r of detail.recipients) m[r.source] = (m[r.source] || 0) + 1;
    return m;
  }, [detail.recipients]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return detail.recipients.filter(
      (r) => (!srcFilter || r.source === srcFilter) && (!t || r.email.includes(t) || (r.name || "").toLowerCase().includes(t)),
    );
  }, [detail.recipients, q, srcFilter]);

  const exportCsv = () => {
    const rows = [["email", "nombre", "origen"], ...detail.recipients.map((r) => [r.email, r.name || "", SOURCE_LABEL[r.source] || r.source])];
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `destinatarios-${detail.campaign.name || "campana"}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <Card className="lg:sticky lg:top-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Destinatarios ({fmtNum(detail.campaign.totalRecipients)})</CardTitle>
          {detail.recipients.length > 0 && (
            <div className="flex items-center gap-1">
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0" title="Exportar CSV" onClick={exportCsv}>
                <Download className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="ghost" className="text-red-500 h-8" onClick={onClear} disabled={clearing}>
                {clearing ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Trash2 className="h-4 w-4 mr-1" /> Vaciar</>}
              </Button>
            </div>
          )}
        </div>
        {detail.recipients.length > 0 && (
          <>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {Object.entries(bySource).map(([s, n]) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSrcFilter(srcFilter === s ? null : s)}
                  className={`text-xs px-2 py-0.5 rounded-full border transition ${srcFilter === s ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"}`}
                >
                  {SOURCE_LABEL[s] || s}: {fmtNum(n)}
                </button>
              ))}
            </div>
            <div className="relative pt-2">
              <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 text-slate-400" />
              <Input className="pl-8 h-9 text-sm" placeholder="Buscar en la lista…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          </>
        )}
      </CardHeader>
      <CardContent className="p-0">
        {detail.recipients.length === 0 ? (
          <div className="text-center py-10 px-6">
            <Users className="h-9 w-9 mx-auto text-slate-300 mb-3" />
            <p className="text-sm text-muted-foreground">Sin destinatarios todavía.</p>
            <p className="text-xs text-muted-foreground mt-1">Agregá contactos desde el panel de la izquierda.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-8">Ningún destinatario coincide con el filtro.</div>
        ) : (
          <div className="max-h-[420px] overflow-y-auto divide-y">
            {filtered.slice(0, 500).map((r) => (
              <div key={r.id} className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-muted/40 group">
                <div className="h-7 w-7 shrink-0 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-[11px] font-semibold uppercase">
                  {(r.name || r.email).trim().charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="truncate font-medium">{r.name || r.email}</div>
                  <div className="truncate text-xs text-muted-foreground">{r.email}</div>
                </div>
                <Badge variant="outline" className="text-[10px] shrink-0">{SOURCE_LABEL[r.source] || r.source}</Badge>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-slate-300 group-hover:text-red-500" title="Quitar" onClick={() => onRemove(r.id)}>
                  <XCircle className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {filtered.length > 500 && (
              <div className="px-4 py-2 text-xs text-muted-foreground text-center">… y {fmtNum(filtered.length - 500)} más</div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Panel de envío ─────────────────────────────────────────────
function SendPanel({ campaign, form, onSaveFirst, onBack }: { campaign: Campaign; form: any; onSaveFirst: () => Promise<any>; onBack: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [testEmail, setTestEmail] = useState("");
  const [schedule, setSchedule] = useState("");

  const testMut = useMutation({
    mutationFn: async () => { await onSaveFirst(); return (await apiRequest(`/api/campanas/${campaign.id}/test`, { method: "POST", data: { email: testEmail } })).json(); },
    onSuccess: () => toast({ title: "Correo de prueba enviado", description: testEmail }),
    onError: (e: any) => toast({ title: "Error", description: e?.message, variant: "destructive" }),
  });

  const sendMut = useMutation({
    mutationFn: async () => { await onSaveFirst(); return (await apiRequest(`/api/campanas/${campaign.id}/send`, { method: "POST" })).json(); },
    onSuccess: (r: any) => { qc.invalidateQueries({ queryKey: ["/api/campanas", campaign.id] }); toast({ title: "Envío iniciado", description: r.message }); },
    onError: (e: any) => toast({ title: "No se pudo enviar", description: e?.message, variant: "destructive" }),
  });

  const scheduleMut = useMutation({
    mutationFn: async () => { await onSaveFirst(); return (await apiRequest(`/api/campanas/${campaign.id}/schedule`, { method: "POST", data: { scheduledAt: new Date(schedule).toISOString() } })).json(); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/campanas", campaign.id] }); toast({ title: "Campaña programada" }); },
    onError: (e: any) => toast({ title: "Error", description: e?.message, variant: "destructive" }),
  });

  const cancelMut = useMutation({
    mutationFn: async () => (await apiRequest(`/api/campanas/${campaign.id}/cancel`, { method: "POST" })).json(),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/campanas", campaign.id] }); toast({ title: "Programación cancelada" }); },
  });

  const ready = campaign.totalRecipients > 0 && !!form.subject?.trim() && !!form.bodyHtml?.trim();
  const scheduled = campaign.status === "scheduled";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Resumen</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <Row label="Asunto" value={form.subject || <span className="text-red-500">Falta</span>} />
          <Row label="Contenido" value={form.bodyHtml?.trim() ? "Listo" : <span className="text-red-500">Falta</span>} />
          <Row label="Destinatarios" value={<strong>{fmtNum(campaign.totalRecipients)}</strong>} />
          <Row label="Remitente" value={form.fromName || "Panorámica (default)"} />
          {form.registerInCrm && <Row label="CRM/Seguimiento" value="Registrará contactos manuales" />}
          {!ready && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              Completá asunto, contenido y al menos un destinatario para poder enviar.
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-4">
        {scheduled && (
          <Card className="border-blue-200">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="text-sm"><Clock className="h-4 w-4 inline mr-1.5 text-blue-600" /> Programada para <strong>{fmtDate(campaign.scheduledAt)}</strong></div>
              <Button size="sm" variant="outline" onClick={() => cancelMut.mutate()} disabled={cancelMut.isPending}><Ban className="h-4 w-4 mr-1" /> Cancelar</Button>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><TestTube2 className="h-4 w-4" /> Enviar prueba</CardTitle></CardHeader>
          <CardContent className="flex gap-2">
            <Input placeholder="tu@correo.cl" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} />
            <Button variant="outline" onClick={() => testMut.mutate()} disabled={!testEmail.trim() || testMut.isPending}>
              {testMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Calendar className="h-4 w-4" /> Programar (opcional)</CardTitle></CardHeader>
          <CardContent className="flex gap-2">
            <Input type="datetime-local" value={schedule} onChange={(e) => setSchedule(e.target.value)} />
            <Button variant="outline" onClick={() => scheduleMut.mutate()} disabled={!schedule || !ready || scheduleMut.isPending}>
              {scheduleMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Programar"}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-orange-200 bg-orange-50/40">
          <CardContent className="p-4">
            <Button size="lg" className="w-full bg-orange-500 hover:bg-orange-600" disabled={!ready || sendMut.isPending} onClick={() => {
              if (confirm(`¿Enviar la campaña a ${campaign.totalRecipients} destinatarios ahora?`)) sendMut.mutate();
            }}>
              {sendMut.isPending ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <PlayCircle className="h-5 w-5 mr-2" />}
              Enviar ahora a {fmtNum(campaign.totalRecipients)} destinatarios
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: any }) {
  return (
    <div className="flex items-center justify-between border-b pb-2 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}

// ── Dashboard de campaña enviada / en envío ────────────────────
function SentDashboard({ detail, campaignId }: { detail: CampaignDetail; campaignId: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const c = detail.campaign;
  const total = c.totalRecipients || 1;
  const progress = Math.round(((c.sentCount + c.failedCount) / total) * 100);

  const resendMut = useMutation({
    mutationFn: async () => (await apiRequest(`/api/campanas/${campaignId}/resend-failed`, { method: "POST" })).json(),
    onSuccess: (r: any) => { qc.invalidateQueries({ queryKey: ["/api/campanas", campaignId] }); toast({ title: `Reintentando ${r.retrying} correos` }); },
    onError: (e: any) => toast({ title: "Error", description: e?.message, variant: "destructive" }),
  });

  const failed = detail.recipients.filter((r) => r.status === "failed");

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Destinatarios" value={fmtNum(c.totalRecipients)} icon={Users} color="text-slate-700" />
        <StatCard label="Enviados" value={fmtNum(c.sentCount)} icon={CheckCircle2} color="text-emerald-600" />
        <StatCard label="Fallidos" value={fmtNum(c.failedCount)} icon={XCircle} color="text-red-600" />
        <StatCard label="Progreso" value={`${progress}%`} icon={Send} color="text-orange-600" />
      </div>

      {c.status === "sending" && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-amber-700 mb-2"><Loader2 className="h-4 w-4 animate-spin" /> Enviando campaña…</div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-orange-500 transition-all" style={{ width: `${progress}%` }} />
            </div>
          </CardContent>
        </Card>
      )}

      {c.failedCount > 0 && c.status !== "sending" && (
        <Card className="border-red-200">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="text-sm text-red-700">{fmtNum(c.failedCount)} correos fallaron.</div>
            <Button size="sm" variant="outline" onClick={() => resendMut.mutate()} disabled={resendMut.isPending}>
              <RefreshCw className={`h-4 w-4 mr-1.5 ${resendMut.isPending ? "animate-spin" : ""}`} /> Reintentar fallidos
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Destinatarios</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[400px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow><TableHead>Destinatario</TableHead><TableHead>Origen</TableHead><TableHead>Estado</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {detail.recipients.slice(0, 1000).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="text-sm font-medium">{r.name || r.email}</div>
                      <div className="text-xs text-muted-foreground">{r.email}</div>
                    </TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{SOURCE_LABEL[r.source] || r.source}</Badge></TableCell>
                    <TableCell>
                      {r.status === "sent" ? <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200"><CheckCircle2 className="h-3 w-3 mr-1" />Enviado</Badge>
                        : r.status === "failed" ? <Badge className="bg-red-100 text-red-700 border-red-200" title={r.errorMessage || ""}><XCircle className="h-3 w-3 mr-1" />Falló</Badge>
                        : r.status === "skipped" ? <Badge variant="outline" className="text-slate-500">Omitido</Badge>
                        : <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />Pendiente</Badge>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
