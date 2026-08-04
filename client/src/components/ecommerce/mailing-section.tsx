import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Mail, Search, Send, Loader2, RefreshCw, AlertCircle, CheckCircle2, XCircle, User as UserIcon,
  Receipt, AlertTriangle, Users, History, Zap, ShoppingBag, FileText, Palette,
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
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

type ClientSearchResult = {
  id: string;
  koen: string;
  nokoen: string;
  rten?: string;
  email?: string;
  foen?: string;
};

type ClientDetail = ClientSearchResult & {
  emailcomer?: string | null;
  dien?: string | null;
  comuna?: string | null;
  cmen?: string | null;
  cpen?: string | null;
  crsd?: string | number | null;
};

type EmailNotificationSetting = {
  id: string;
  notificationType: string;
  enabled: boolean;
  recipients: string | null;
  ccRecipients: string | null;
  displayName: string;
  description: string | null;
};

type EmailLog = {
  id: string;
  recipient: string;
  subject: string;
  notificationType: string | null;
  status: string;
  errorMessage: string | null;
  sentAt: string | null;
  createdAt: string;
};

function ClientPicker({
  selected,
  onSelect,
  onClear,
}: {
  selected: ClientDetail | null;
  onSelect: (c: ClientDetail) => void;
  onClear: () => void;
}) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  const { data: results = [], isFetching } = useQuery<ClientSearchResult[]>({
    queryKey: ["/api/clients/search", { q: debounced }],
    enabled: debounced.trim().length >= 2 && !selected,
  });

  const handlePick = async (item: ClientSearchResult) => {
    try {
      const res = await apiRequest(`/api/admin/mailing/client/${encodeURIComponent(item.koen)}`);
      const detail = await res.json();
      onSelect(detail);
      setQuery("");
      setDebounced("");
    } catch {
      onSelect(item as ClientDetail);
    }
  };

  if (selected) {
    return (
      <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <div className="font-medium flex items-center gap-2">
              <UserIcon className="h-4 w-4" />
              {selected.nokoen}
            </div>
            <div className="text-xs text-muted-foreground space-x-3">
              {selected.koen && <span>Cód: {selected.koen}</span>}
              {selected.rten && <span>RUT: {selected.rten}</span>}
            </div>
            <div className="text-xs text-muted-foreground space-x-3">
              <span>Email: {selected.email || <em>no registrado</em>}</span>
              {selected.foen && <span>Tel: {selected.foen}</span>}
            </div>
            {(selected.dien || selected.comuna || selected.cmen) && (
              <div className="text-xs text-muted-foreground">
                Dir: {[selected.dien, selected.comuna, selected.cmen].filter(Boolean).join(", ")}
              </div>
            )}
            {selected.cpen && <div className="text-xs text-muted-foreground">Condición de pago: {selected.cpen}</div>}
            {selected.crsd != null && Number(selected.crsd) > 0 && (
              <div className="text-xs">
                <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50">
                  Saldo registrado en sistema: {new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(Number(selected.crsd))}
                </Badge>
              </div>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={onClear}>Cambiar</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Buscar cliente por nombre, código o RUT..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      {debounced.trim().length >= 2 && (
        <div className="rounded-lg border max-h-64 overflow-y-auto">
          {isFetching && (
            <div className="p-3 text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Buscando...
            </div>
          )}
          {!isFetching && results.length === 0 && (
            <div className="p-3 text-sm text-muted-foreground">Sin resultados</div>
          )}
          {results.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => handlePick(r)}
              className="w-full text-left px-3 py-2 hover:bg-muted/60 border-b last:border-0"
            >
              <div className="font-medium text-sm">{r.nokoen}</div>
              <div className="text-xs text-muted-foreground space-x-3">
                {r.koen && <span>Cód: {r.koen}</span>}
                {r.rten && <span>RUT: {r.rten}</span>}
                {r.email && <span>{r.email}</span>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function RecipientsConfigCard() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: settings = [], isLoading } = useQuery<EmailNotificationSetting[]>({
    queryKey: ["/api/admin/email-notification-settings"],
  });

  const ensureMutation = useMutation({
    mutationFn: () => apiRequest("/api/admin/mailing/ensure-settings", { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/email-notification-settings"] });
      toast({ title: "Tipos de notificación inicializados" });
    },
  });

  useEffect(() => {
    if (!isLoading && settings.length > 0) {
      const hasCobranza = settings.some((s) => s.notificationType === "cobranza");
      const hasMailingVenta = settings.some((s) => s.notificationType === "mailing_venta");
      if (!hasCobranza || !hasMailingVenta) {
        ensureMutation.mutate();
      }
    }
  }, [isLoading, settings.length]);

  const updateMutation = useMutation({
    mutationFn: async (payload: { id: string; enabled?: boolean; recipients?: string; ccRecipients?: string }) => {
      const { id, ...rest } = payload;
      return apiRequest(`/api/admin/email-notification-settings/${id}`, { method: "PATCH", data: rest });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/email-notification-settings"] });
      toast({ title: "Destinatarios guardados" });
    },
    onError: (e: any) => toast({ title: "Error al guardar", description: e?.message, variant: "destructive" }),
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><Mail className="h-5 w-5" /> Destinatarios internos</CardTitle>
            <CardDescription>
              Define qué correos del equipo reciben copia para cada tipo de notificación. Separa varios correos con coma.
            </CardDescription>
          </div>
          <Button size="sm" variant="outline" onClick={() => ensureMutation.mutate()} disabled={ensureMutation.isPending}>
            <RefreshCw className={`h-4 w-4 mr-2 ${ensureMutation.isPending ? "animate-spin" : ""}`} />
            Inicializar tipos
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando configuración...
          </div>
        )}
        {!isLoading && settings.map((s) => (
          <RecipientsRow key={s.id} setting={s} onSave={updateMutation.mutate} saving={updateMutation.isPending} />
        ))}
      </CardContent>
    </Card>
  );
}

function RecipientsRow({
  setting,
  onSave,
  saving,
}: {
  setting: EmailNotificationSetting;
  onSave: (p: { id: string; enabled?: boolean; recipients?: string; ccRecipients?: string }) => void;
  saving: boolean;
}) {
  const [recipients, setRecipients] = useState(setting.recipients || "");
  const [ccRecipients, setCcRecipients] = useState(setting.ccRecipients || "");
  const [enabled, setEnabled] = useState(!!setting.enabled);
  const dirty =
    recipients !== (setting.recipients || "") ||
    ccRecipients !== (setting.ccRecipients || "") ||
    enabled !== !!setting.enabled;

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="font-medium">{setting.displayName}</div>
          {setting.description && <div className="text-xs text-muted-foreground">{setting.description}</div>}
          <div className="text-[10px] text-muted-foreground mt-1">tipo: {setting.notificationType}</div>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor={`en-${setting.id}`} className="text-xs">Activo</Label>
          <Switch id={`en-${setting.id}`} checked={enabled} onCheckedChange={setEnabled} />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Para (recipients)</Label>
          <Input value={recipients} onChange={(e) => setRecipients(e.target.value)} placeholder="correo1@dom.cl, correo2@dom.cl" />
        </div>
        <div>
          <Label className="text-xs">Copia (CC)</Label>
          <Input value={ccRecipients} onChange={(e) => setCcRecipients(e.target.value)} placeholder="cc1@dom.cl, cc2@dom.cl" />
        </div>
      </div>
      <div className="flex justify-end">
        <Button size="sm" disabled={!dirty || saving} onClick={() => onSave({ id: setting.id, enabled, recipients, ccRecipients })}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Guardar
        </Button>
      </div>
    </div>
  );
}

function SaleNotificationCard() {
  const { toast } = useToast();
  const [client, setClient] = useState<ClientDetail | null>(null);
  const [emailOverride, setEmailOverride] = useState("");
  const [monto, setMonto] = useState("");
  const [numeroDocumento, setNumeroDocumento] = useState("");
  const [detalle, setDetalle] = useState("");
  const [sendToClient, setSendToClient] = useState(true);
  const [ccInternal, setCcInternal] = useState(true);
  const [extraCc, setExtraCc] = useState("");

  const reset = () => {
    setClient(null); setEmailOverride(""); setMonto(""); setNumeroDocumento(""); setDetalle("");
    setSendToClient(true); setCcInternal(true); setExtraCc("");
  };

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!client) throw new Error("Selecciona un cliente");
      return apiRequest("/api/admin/mailing/send-sale", {
        method: "POST",
        data: {
          koen: client.koen,
          clientEmailOverride: emailOverride || undefined,
          monto: monto ? Number(monto) : undefined,
          numeroDocumento: numeroDocumento || undefined,
          detalle: detalle || undefined,
          sendToClient,
          ccInternal,
          extraCc: extraCc || undefined,
        },
      });
    },
    onSuccess: async (res) => {
      const data = await res.json();
      toast({ title: "Correo enviado", description: `Para: ${data.to}${data.cc ? ` · CC: ${data.cc}` : ""}` });
      reset();
    },
    onError: (e: any) => toast({ title: "Error al enviar", description: e?.message, variant: "destructive" }),
  });

  const canSend = !!client && (sendToClient || ccInternal || extraCc.trim().length > 0);

  return (
    <Card className="border-slate-200 shadow-sm rounded-xl overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-emerald-50 to-white border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 border border-emerald-200">
            <Receipt className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-lg text-slate-900">Notificación de venta</CardTitle>
            <CardDescription className="text-xs">
              Envía un correo al cliente con los datos de la venta. Copia opcional al equipo interno.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 p-6">
        <div>
          <Label className="text-xs font-medium text-slate-700 mb-2 block">Cliente</Label>
          <ClientPicker selected={client} onSelect={setClient} onClear={() => setClient(null)} />
        </div>

        {client && !client.email && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 flex gap-2">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <div>Este cliente no tiene email registrado. Ingresa uno manualmente abajo si quieres enviarle el correo.</div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs font-medium text-slate-700">Email del cliente (sobrescribir)</Label>
            <Input className="mt-1.5" value={emailOverride} onChange={(e) => setEmailOverride(e.target.value)} placeholder={client?.email || "cliente@correo.cl"} />
          </div>
          <div>
            <Label className="text-xs font-medium text-slate-700">N° documento (opcional)</Label>
            <Input className="mt-1.5" value={numeroDocumento} onChange={(e) => setNumeroDocumento(e.target.value)} placeholder="OC-12345" />
          </div>
          <div>
            <Label className="text-xs font-medium text-slate-700">Monto (CLP, opcional)</Label>
            <Input className="mt-1.5" type="number" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="0" />
          </div>
          <div>
            <Label className="text-xs font-medium text-slate-700">CC adicional</Label>
            <Input className="mt-1.5" value={extraCc} onChange={(e) => setExtraCc(e.target.value)} placeholder="otro@correo.cl, otro2@..." />
          </div>
        </div>

        <div>
          <Label className="text-xs font-medium text-slate-700">Detalle / mensaje (opcional)</Label>
          <Textarea className="mt-1.5" rows={4} value={detalle} onChange={(e) => setDetalle(e.target.value)} placeholder="Descripción de la venta, productos, condiciones..." />
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 p-4 bg-slate-50 rounded-lg border border-slate-200">
          <div className="flex items-center gap-2">
            <Switch checked={sendToClient} onCheckedChange={setSendToClient} id="ms-send-client" />
            <Label htmlFor="ms-send-client" className="text-sm font-medium cursor-pointer">Enviar al cliente</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={ccInternal} onCheckedChange={setCcInternal} id="ms-cc-internal" />
            <Label htmlFor="ms-cc-internal" className="text-sm font-medium cursor-pointer">Copia al equipo interno</Label>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button size="lg" onClick={() => sendMutation.mutate()} disabled={!canSend || sendMutation.isPending} className="bg-orange-500 hover:bg-orange-600">
            {sendMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
            Enviar correo
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function CobranzaCard() {
  const { toast } = useToast();
  const [client, setClient] = useState<ClientDetail | null>(null);
  const [emailOverride, setEmailOverride] = useState("");
  const [montoAdeudado, setMontoAdeudado] = useState("");
  const [fechaVencimiento, setFechaVencimiento] = useState("");
  const [numeroDocumento, setNumeroDocumento] = useState("");
  const [mensajeAdicional, setMensajeAdicional] = useState("");
  const [sendToClient, setSendToClient] = useState(true);
  const [ccInternal, setCcInternal] = useState(true);
  const [extraCc, setExtraCc] = useState("");

  const reset = () => {
    setClient(null); setEmailOverride(""); setMontoAdeudado(""); setFechaVencimiento("");
    setNumeroDocumento(""); setMensajeAdicional(""); setSendToClient(true); setCcInternal(true); setExtraCc("");
  };

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!client) throw new Error("Selecciona un cliente");
      if (!montoAdeudado || Number(montoAdeudado) <= 0) throw new Error("Monto adeudado inválido");
      if (!fechaVencimiento) throw new Error("Fecha de vencimiento requerida");
      return apiRequest("/api/admin/mailing/send-cobranza", {
        method: "POST",
        data: {
          koen: client.koen,
          clientEmailOverride: emailOverride || undefined,
          montoAdeudado: Number(montoAdeudado),
          fechaVencimiento,
          numeroDocumento: numeroDocumento || undefined,
          mensajeAdicional: mensajeAdicional || undefined,
          sendToClient,
          ccInternal,
          extraCc: extraCc || undefined,
        },
      });
    },
    onSuccess: async (res) => {
      const data = await res.json();
      toast({ title: "Correo de cobranza enviado", description: `Para: ${data.to}${data.cc ? ` · CC: ${data.cc}` : ""}` });
      reset();
    },
    onError: (e: any) => toast({ title: "Error al enviar", description: e?.message, variant: "destructive" }),
  });

  const canSend = !!client && !!montoAdeudado && !!fechaVencimiento && (sendToClient || ccInternal || extraCc.trim().length > 0);

  return (
    <Card className="border-slate-200 shadow-sm rounded-xl overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-amber-50 to-white border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 border border-amber-200">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-lg text-slate-900">Cobranza</CardTitle>
            <CardDescription className="text-xs">
              Envía un recordatorio de pago al cliente con monto adeudado y fecha de vencimiento.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 p-6">
        <div>
          <Label className="text-xs font-medium text-slate-700 mb-2 block">Cliente</Label>
          <ClientPicker selected={client} onSelect={setClient} onClear={() => setClient(null)} />
        </div>

        {client && !client.email && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 flex gap-2">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <div>Este cliente no tiene email registrado. Ingresa uno manualmente abajo.</div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs font-medium text-slate-700">Email del cliente (sobrescribir)</Label>
            <Input className="mt-1.5" value={emailOverride} onChange={(e) => setEmailOverride(e.target.value)} placeholder={client?.email || "cliente@correo.cl"} />
          </div>
          <div>
            <Label className="text-xs font-medium text-slate-700">N° documento (opcional)</Label>
            <Input className="mt-1.5" value={numeroDocumento} onChange={(e) => setNumeroDocumento(e.target.value)} placeholder="FAC-12345" />
          </div>
          <div>
            <Label className="text-xs font-medium text-slate-700">Monto adeudado (CLP) <span className="text-red-500">*</span></Label>
            <Input className="mt-1.5" type="number" value={montoAdeudado} onChange={(e) => setMontoAdeudado(e.target.value)} placeholder="0" />
          </div>
          <div>
            <Label className="text-xs font-medium text-slate-700">Fecha de vencimiento <span className="text-red-500">*</span></Label>
            <Input className="mt-1.5" type="date" value={fechaVencimiento} onChange={(e) => setFechaVencimiento(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Label className="text-xs font-medium text-slate-700">CC adicional</Label>
            <Input className="mt-1.5" value={extraCc} onChange={(e) => setExtraCc(e.target.value)} placeholder="cobranzas@dom.cl, ..." />
          </div>
        </div>

        <div>
          <Label className="text-xs font-medium text-slate-700">Mensaje adicional (opcional)</Label>
          <Textarea className="mt-1.5" rows={3} value={mensajeAdicional} onChange={(e) => setMensajeAdicional(e.target.value)} placeholder="Información adicional para el cliente..." />
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 p-4 bg-slate-50 rounded-lg border border-slate-200">
          <div className="flex items-center gap-2">
            <Switch checked={sendToClient} onCheckedChange={setSendToClient} id="cb-send-client" />
            <Label htmlFor="cb-send-client" className="text-sm font-medium cursor-pointer">Enviar al cliente</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={ccInternal} onCheckedChange={setCcInternal} id="cb-cc-internal" />
            <Label htmlFor="cb-cc-internal" className="text-sm font-medium cursor-pointer">Copia al equipo interno</Label>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button size="lg" onClick={() => sendMutation.mutate()} disabled={!canSend || sendMutation.isPending} className="bg-orange-500 hover:bg-orange-600">
            {sendMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
            Enviar cobranza
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function HistoryCard() {
  const { data: logs = [], isLoading, refetch, isFetching } = useQuery<EmailLog[]>({
    queryKey: ["/api/admin/email-logs"],
  });

  const mailingLogs = useMemo(
    () => logs.filter((l) => (l.notificationType || "").startsWith("mailing_")),
    [logs]
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Historial de envíos (Mailing)</CardTitle>
            <CardDescription>Últimos correos enviados desde el módulo Mailing.</CardDescription>
          </div>
          <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando...
          </div>
        ) : mailingLogs.length === 0 ? (
          <div className="text-sm text-muted-foreground">Aún no hay correos enviados desde este módulo.</div>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Asunto</TableHead>
                  <TableHead>Destinatarios</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mailingLogs.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="whitespace-nowrap text-xs">
                      {new Date(l.sentAt || l.createdAt).toLocaleString("es-CL")}
                    </TableCell>
                    <TableCell className="text-xs">
                      <Badge variant="outline">{(l.notificationType || "").replace("mailing_", "")}</Badge>
                    </TableCell>
                    <TableCell className="text-xs max-w-[260px] truncate" title={l.subject}>{l.subject}</TableCell>
                    <TableCell className="text-xs max-w-[260px] truncate" title={l.recipient}>{l.recipient}</TableCell>
                    <TableCell>
                      {l.status === "sent" ? (
                        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200"><CheckCircle2 className="h-3 w-3 mr-1" />Enviado</Badge>
                      ) : l.status === "failed" ? (
                        <Badge className="bg-red-100 text-red-700 border-red-200" title={l.errorMessage || ""}><XCircle className="h-3 w-3 mr-1" />Falló</Badge>
                      ) : (
                        <Badge variant="outline">{l.status}</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ModernTabTrigger({ value, icon: Icon, label }: { value: string; icon: any; label: string }) {
  return (
    <TabsTrigger
      value={value}
      className="gap-2 px-4 py-2.5 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-slate-900 text-slate-600 transition-all"
    >
      <Icon className="h-4 w-4" />
      <span className="font-medium">{label}</span>
    </TabsTrigger>
  );
}

export default function MailingSection() {
  return (
    <div className="space-y-6">
      <Tabs defaultValue="venta" className="w-full">
        <div className="bg-slate-100/70 border border-slate-200 rounded-xl p-1.5 inline-flex flex-wrap gap-1">
          <TabsList className="bg-transparent p-0 h-auto gap-1">
            <ModernTabTrigger value="venta" icon={Receipt} label="Notificación de venta" />
            <ModernTabTrigger value="cobranza" icon={AlertTriangle} label="Cobranza" />
            <ModernTabTrigger value="automatizaciones" icon={Zap} label="Automatizaciones" />
            <ModernTabTrigger value="destinatarios" icon={Users} label="Destinatarios" />
            <ModernTabTrigger value="historial" icon={History} label="Historial" />
          </TabsList>
        </div>
        <TabsContent value="venta" className="mt-6">
          <SaleNotificationCard />
        </TabsContent>
        <TabsContent value="cobranza" className="mt-6">
          <CobranzaCard />
        </TabsContent>
        <TabsContent value="automatizaciones" className="mt-6">
          <AutomationsCard />
        </TabsContent>
        <TabsContent value="destinatarios" className="mt-6">
          <RecipientsConfigCard />
        </TabsContent>
        <TabsContent value="historial" className="mt-6">
          <HistoryCard />
        </TabsContent>
      </Tabs>
    </div>
  );
}

const AUTO_TYPES = [
  {
    type: "ecommerce_sale_auto",
    title: "Venta recibida (Tienda)",
    desc: "Cuando un cliente realiza un pedido en Panorámica Market, le enviamos automáticamente un correo de confirmación con su número de orden, productos y datos de pago.",
    icon: ShoppingBag,
    color: "emerald",
  },
  {
    type: "ecommerce_quote_auto",
    title: "Cotización recibida (Tienda)",
    desc: "Cuando un visitante envía una solicitud de cotización desde el sitio público, le confirmamos automáticamente que recibimos su pedido y que el equipo lo está revisando.",
    icon: FileText,
    color: "blue",
  },
  {
    type: "ecommerce_color_personalizado",
    title: "Color personalizado cotizado (Tienda)",
    desc: "Cuando el equipo le asigna precio a un color personalizado, le avisamos al cliente que ya tiene precio y le mandamos un enlace que le deja el producto cargado en el carrito, listo para pedir.",
    icon: Palette,
    color: "fuchsia",
  },
];

function AutomationsCard() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: settings = [], isLoading } = useQuery<EmailNotificationSetting[]>({
    queryKey: ["/api/admin/email-notification-settings"],
  });

  const ensureMutation = useMutation({
    mutationFn: () => apiRequest("/api/admin/mailing/ensure-settings", { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/admin/email-notification-settings"] }),
  });

  useEffect(() => {
    if (!isLoading && settings.length > 0) {
      const missing = AUTO_TYPES.some((t) => !settings.find((s) => s.notificationType === t.type));
      if (missing) ensureMutation.mutate();
    }
  }, [isLoading, settings.length]);

  const updateMutation = useMutation({
    mutationFn: async (payload: { id: string; enabled?: boolean; ccRecipients?: string }) => {
      const { id, ...rest } = payload;
      return apiRequest(`/api/admin/email-notification-settings/${id}`, { method: "PATCH", data: rest });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/email-notification-settings"] });
      toast({ title: "Automatización actualizada" });
    },
    onError: (e: any) => toast({ title: "Error al guardar", description: e?.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 p-4 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100">
        <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 shrink-0">
          <Zap className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <div className="font-semibold text-slate-900">Correos automáticos</div>
          <div className="text-sm text-slate-600 mt-0.5">
            Activá o desactivá los correos que se envían automáticamente al cliente cuando interactúa con la tienda. Los CC son copias internas del equipo.
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground p-4">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando automatizaciones...
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {AUTO_TYPES.map((meta) => {
            const setting = settings.find((s) => s.notificationType === meta.type);
            return (
              <AutomationItem
                key={meta.type}
                meta={meta}
                setting={setting}
                onSave={updateMutation.mutate}
                saving={updateMutation.isPending}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function AutomationItem({
  meta,
  setting,
  onSave,
  saving,
}: {
  meta: typeof AUTO_TYPES[number];
  setting: EmailNotificationSetting | undefined;
  onSave: (p: { id: string; enabled?: boolean; ccRecipients?: string }) => void;
  saving: boolean;
}) {
  const Icon = meta.icon;
  const [enabled, setEnabled] = useState(!!setting?.enabled);
  const [cc, setCc] = useState(setting?.ccRecipients || "");

  useEffect(() => {
    setEnabled(!!setting?.enabled);
    setCc(setting?.ccRecipients || "");
  }, [setting?.id, setting?.enabled, setting?.ccRecipients]);

  if (!setting) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-500 flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" /> Inicializando {meta.title}...
      </div>
    );
  }

  const dirty = enabled !== !!setting.enabled || cc !== (setting.ccRecipients || "");
  const colorMap: Record<string, string> = {
    emerald: "bg-emerald-500/10 text-emerald-600 border-emerald-200",
    blue: "bg-blue-500/10 text-blue-600 border-blue-200",
    fuchsia: "bg-fuchsia-500/10 text-fuchsia-600 border-fuchsia-200",
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden hover:shadow-md transition-shadow">
      <div className={`p-5 border-b border-slate-100 ${enabled ? "" : "opacity-70"}`}>
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg border ${colorMap[meta.color] || "bg-slate-100"}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <div className="font-semibold text-slate-900 truncate">{meta.title}</div>
              <Switch checked={enabled} onCheckedChange={setEnabled} />
            </div>
            <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">{meta.desc}</p>
          </div>
        </div>
      </div>
      <div className="p-5 space-y-3 bg-slate-50/50">
        <div>
          <Label className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
            <Users className="h-3 w-3" />
            CC interno (separar con coma)
          </Label>
          <Input
            value={cc}
            onChange={(e) => setCc(e.target.value)}
            placeholder="ventas@dom.cl, jefe@dom.cl"
            className="mt-1.5 bg-white"
          />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500">
            Estado: <strong className={enabled ? "text-emerald-600" : "text-slate-400"}>{enabled ? "Activo" : "Pausado"}</strong>
          </span>
          <Button
            size="sm"
            disabled={!dirty || saving}
            onClick={() => onSave({ id: setting.id, enabled, ccRecipients: cc })}
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
            Guardar
          </Button>
        </div>
      </div>
    </div>
  );
}
