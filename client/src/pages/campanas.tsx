import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Send, Plus, Loader2, Mail, Users, Trash2, ArrowLeft, Eye, FileText, Megaphone,
  CheckCircle2, XCircle, Clock, AlertTriangle, RefreshCw, Calendar, Sparkles,
  Bold, Italic, List, Link2, Heading, Save, TestTube2, PlayCircle, Ban,
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
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient as globalQC } from "@/lib/queryClient";

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

// ── Editor de contenido (rich text ligero + preview) ───────────
function ContentEditor({ value, onChange, subject, preheader }: { value: string; onChange: (html: string) => void; subject: string; preheader: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<"visual" | "html">("visual");
  const { toast } = useToast();

  useEffect(() => {
    if (mode === "visual" && ref.current && ref.current.innerHTML !== value) {
      ref.current.innerHTML = value || "";
    }
  }, [mode]); // eslint-disable-line

  const exec = (cmd: string, arg?: string) => {
    ref.current?.focus();
    document.execCommand(cmd, false, arg);
    if (ref.current) onChange(ref.current.innerHTML);
  };

  const insertHtml = (html: string) => {
    ref.current?.focus();
    document.execCommand("insertHTML", false, html);
    if (ref.current) onChange(ref.current.innerHTML);
  };

  const previewSrc = useMemo(() => {
    const body = (value || "<p style='color:#94a3b8'>(Sin contenido)</p>")
      .replace(/\{\{\s*nombre\s*\}\}/gi, "Juan Pérez").replace(/\{\{\s*email\s*\}\}/gi, "cliente@correo.cl");
    return `<!doctype html><html><body style="margin:0;background:#f4f4f4;font-family:Arial,sans-serif">
      <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.1)">
        <div style="background:#1a1f2e;padding:18px 24px;color:#fff;font-weight:bold">Pinturas Panorámica</div>
        <div style="padding:24px;color:#333;line-height:1.6">${body}</div>
        <div style="padding:16px 24px;background:#f8f9fa;color:#94a3b8;font-size:12px;text-align:center">Pinturas Panorámica · Este correo fue enviado desde el sistema de campañas.</div>
      </div></body></html>`;
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
          <CardDescription>Usá <code className="bg-slate-100 px-1 rounded">{"{{nombre}}"}</code> para personalizar con el nombre de cada destinatario.</CardDescription>
        </CardHeader>
        <CardContent>
          {mode === "visual" ? (
            <>
              <div className="flex flex-wrap gap-1 mb-2 p-1.5 border rounded-lg bg-slate-50">
                <ToolbarBtn onClick={() => exec("bold")} icon={Bold} title="Negrita" />
                <ToolbarBtn onClick={() => exec("italic")} icon={Italic} title="Cursiva" />
                <ToolbarBtn onClick={() => exec("formatBlock", "<h2>")} icon={Heading} title="Título" />
                <ToolbarBtn onClick={() => exec("insertUnorderedList")} icon={List} title="Lista" />
                <ToolbarBtn onClick={() => { const url = prompt("URL del enlace:"); if (url) exec("createLink", url); }} icon={Link2} title="Enlace" />
                <div className="w-px bg-slate-300 mx-1" />
                <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => {
                  const url = prompt("URL del botón:"); const txt = prompt("Texto del botón:", "Ver más");
                  if (url && txt) insertHtml(`<p style="text-align:center;margin:24px 0"><a href="${url}" style="background:#fd6301;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold;display:inline-block">${txt}</a></p>`);
                }}>+ Botón</Button>
                <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => {
                  const url = prompt("URL de la imagen:"); if (url) insertHtml(`<p style="text-align:center"><img src="${url}" style="max-width:100%;border-radius:6px" /></p>`);
                }}>+ Imagen</Button>
              </div>
              <div
                ref={ref}
                contentEditable
                onInput={(e) => onChange((e.target as HTMLDivElement).innerHTML)}
                className="min-h-[320px] border rounded-lg p-4 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400/40 prose prose-sm max-w-none"
                style={{ lineHeight: 1.6 }}
                suppressContentEditableWarning
              />
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
          <CardTitle className="text-base flex items-center gap-2"><Eye className="h-4 w-4" /> Vista previa</CardTitle>
          <CardDescription className="truncate">Asunto: <strong>{subject || "(sin asunto)"}</strong></CardDescription>
        </CardHeader>
        <CardContent>
          <iframe title="preview" srcDoc={previewSrc} className="w-full h-[420px] border rounded-lg bg-white" />
        </CardContent>
      </Card>
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

// ── Constructor de audiencia ───────────────────────────────────
function AudienceBuilder({ campaignId, detail }: { campaignId: string; detail: CampaignDetail }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["/api/campanas", campaignId] });

  const addMut = useMutation({
    mutationFn: async (body: any) => (await apiRequest(`/api/campanas/${campaignId}/recipients`, { method: "POST", data: body })).json(),
    onSuccess: (r: any) => { invalidate(); toast({ title: `${r.added} destinatarios agregados`, description: `Total: ${r.total}` }); },
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

  const bySource = useMemo(() => {
    const m: Record<string, number> = {};
    for (const r of detail.recipients) m[r.source] = (m[r.source] || 0) + 1;
    return m;
  }, [detail.recipients]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
      {/* Fuentes */}
      <div className="lg:col-span-3 space-y-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Agregar destinatarios</CardTitle></CardHeader>
          <CardContent>
            <Tabs defaultValue="clients">
              <TabsList className="mb-4">
                <TabsTrigger value="clients">Clientes</TabsTrigger>
                <TabsTrigger value="crm">CRM</TabsTrigger>
                <TabsTrigger value="seguimiento">Seguimiento</TabsTrigger>
                <TabsTrigger value="manual">Lista manual</TabsTrigger>
              </TabsList>
              <TabsContent value="clients"><ClientsSource campaignId={campaignId} onAdd={(b) => addMut.mutate(b)} adding={addMut.isPending} /></TabsContent>
              <TabsContent value="crm"><CrmSource campaignId={campaignId} onAdd={(b) => addMut.mutate(b)} adding={addMut.isPending} /></TabsContent>
              <TabsContent value="seguimiento"><SeguimientoSource campaignId={campaignId} onAdd={(b) => addMut.mutate(b)} adding={addMut.isPending} /></TabsContent>
              <TabsContent value="manual"><ManualSource onAdd={(b) => addMut.mutate(b)} adding={addMut.isPending} /></TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Resumen */}
      <div className="lg:col-span-2 space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Destinatarios ({fmtNum(detail.campaign.totalRecipients)})</CardTitle>
              {detail.recipients.length > 0 && (
                <Button size="sm" variant="ghost" className="text-red-500 h-8" onClick={() => clearMut.mutate()} disabled={clearMut.isPending}>
                  <Trash2 className="h-4 w-4 mr-1" /> Vaciar
                </Button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {Object.entries(bySource).map(([s, n]) => (
                <Badge key={s} variant="outline" className="text-xs">{SOURCE_LABEL[s] || s}: {n}</Badge>
              ))}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {detail.recipients.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-8">Sin destinatarios todavía.</div>
            ) : (
              <div className="max-h-[380px] overflow-y-auto divide-y">
                {detail.recipients.slice(0, 500).map((r) => (
                  <div key={r.id} className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-muted/40">
                    <div className="flex-1 min-w-0">
                      <div className="truncate font-medium">{r.name || r.email}</div>
                      <div className="truncate text-xs text-muted-foreground">{r.email}</div>
                    </div>
                    <Badge variant="outline" className="text-[10px]">{SOURCE_LABEL[r.source] || r.source}</Badge>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-400" onClick={() => removeMut.mutate(r.id)}>
                      <XCircle className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                {detail.recipients.length > 500 && (
                  <div className="px-4 py-2 text-xs text-muted-foreground text-center">… y {fmtNum(detail.recipients.length - 500)} más</div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Previsualiza y agrega desde una fuente.
function useAudiencePreview() {
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const preview = async (body: any) => {
    setLoading(true);
    try {
      const res = await apiRequest("/api/campanas/audience/preview", { method: "POST", data: body });
      const d = await res.json();
      setCount(d.count);
    } catch { setCount(null); } finally { setLoading(false); }
  };
  return { count, loading, preview, reset: () => setCount(null) };
}

function ClientsSource({ campaignId, onAdd, adding }: { campaignId: string; onAdd: (b: any) => void; adding: boolean }) {
  const [q, setQ] = useState("");
  const { count, loading, preview } = useAudiencePreview();
  const body = { source: "clients", q: q.trim() || undefined };
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Clientes del sistema con email registrado. Dejá el filtro vacío para incluir a todos.</p>
      <Input placeholder="Filtrar por nombre, código o RUT (opcional)" value={q} onChange={(e) => setQ(e.target.value)} />
      <PreviewAddRow count={count} loading={loading} adding={adding} onPreview={() => preview(body)} onAdd={() => onAdd(body)} />
    </div>
  );
}

function CrmSource({ onAdd, adding }: { campaignId: string; onAdd: (b: any) => void; adding: boolean }) {
  const STAGES = ["lead", "contacto", "visita", "lista_precio", "campana", "primera_venta", "promesa", "venta"];
  const [sel, setSel] = useState<string[]>([]);
  const { count, loading, preview } = useAudiencePreview();
  const body = { source: "crm", stages: sel };
  const toggle = (s: string) => setSel((p) => (p.includes(s) ? p.filter((x) => x !== s) : [...p, s]));
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Leads del CRM con email. Elegí las etapas del pipeline (vacío = todas).</p>
      <div className="flex flex-wrap gap-1.5">
        {STAGES.map((s) => (
          <button key={s} onClick={() => toggle(s)} className={`text-xs px-2.5 py-1 rounded-full border ${sel.includes(s) ? "bg-orange-500 text-white border-orange-500" : "bg-white text-slate-600 border-slate-200"}`}>{s}</button>
        ))}
      </div>
      <PreviewAddRow count={count} loading={loading} adding={adding} onPreview={() => preview(body)} onAdd={() => onAdd(body)} />
    </div>
  );
}

function SeguimientoSource({ onAdd, adding }: { campaignId: string; onAdd: (b: any) => void; adding: boolean }) {
  const ESTADOS = ["nuevo", "contactado", "cotizacion", "venta", "despacho", "completado", "perdido"];
  const [sel, setSel] = useState<string[]>([]);
  const { count, loading, preview } = useAudiencePreview();
  const body = { source: "seguimiento", estados: sel };
  const toggle = (s: string) => setSel((p) => (p.includes(s) ? p.filter((x) => x !== s) : [...p, s]));
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Clientes en Seguimiento con email. Elegí los estados (vacío = todos).</p>
      <div className="flex flex-wrap gap-1.5">
        {ESTADOS.map((s) => (
          <button key={s} onClick={() => toggle(s)} className={`text-xs px-2.5 py-1 rounded-full border ${sel.includes(s) ? "bg-orange-500 text-white border-orange-500" : "bg-white text-slate-600 border-slate-200"}`}>{s}</button>
        ))}
      </div>
      <PreviewAddRow count={count} loading={loading} adding={adding} onPreview={() => preview(body)} onAdd={() => onAdd(body)} />
    </div>
  );
}

function ManualSource({ onAdd, adding }: { onAdd: (b: any) => void; adding: boolean }) {
  const [raw, setRaw] = useState("");
  const { count, loading, preview } = useAudiencePreview();
  const body = { source: "manual", raw };
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Pegá correos separados por coma, punto y coma o saltos de línea. Soporta "Nombre &lt;correo@dom.cl&gt;".</p>
      <Textarea rows={8} value={raw} onChange={(e) => setRaw(e.target.value)} placeholder={"juan@dom.cl\nMaría Pérez <maria@dom.cl>\npedro@dom.cl"} className="font-mono text-xs" />
      <PreviewAddRow count={count} loading={loading} adding={adding} onPreview={() => preview(body)} onAdd={() => onAdd(body)} disabled={!raw.trim()} />
    </div>
  );
}

function PreviewAddRow({ count, loading, adding, onPreview, onAdd, disabled }: { count: number | null; loading: boolean; adding: boolean; onPreview: () => void; onAdd: () => void; disabled?: boolean }) {
  return (
    <div className="flex items-center gap-3 pt-1">
      <Button variant="outline" size="sm" onClick={onPreview} disabled={loading || disabled}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Eye className="h-4 w-4 mr-2" />} Previsualizar
      </Button>
      {count !== null && <span className="text-sm text-muted-foreground">{fmtNum(count)} destinatarios</span>}
      <div className="flex-1" />
      <Button size="sm" onClick={onAdd} disabled={adding || disabled} className="bg-orange-500 hover:bg-orange-600">
        {adding ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />} Agregar
      </Button>
    </div>
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
