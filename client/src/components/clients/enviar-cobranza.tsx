// ═══════════════════════════════════════════════════════════════════════════
// ENVIAR COBRANZA — botón + diálogo compartido
// ═══════════════════════════════════════════════════════════════════════════
// El correo de cobranza se dispara desde dos lugares: la ficha del cliente
// (pestaña Crédito e Información) y la pestaña Cobranza del Panel de Trabajo
// (Seguimiento). Antes vivía sólo en la ficha y desde Seguimiento había que
// saltar allá; ahora es este componente en los dos lados, para que el correo
// que sale sea exactamente el mismo se dispare donde se dispare.
//
// Los montos y el código del cliente salen de la MISMA consulta que pinta el
// panel de crédito (/api/clients/credito), así el correo dice lo mismo que la
// pantalla. De la ficha (/api/clients/account-status) sólo se toma el correo
// del cliente para precargarlo.
import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertTriangle, Clock, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useCredito } from "@/components/clients/credito-panel";

/** Roles que pueden mandar correos de cobranza (mismo filtro que el servidor). */
const ROLES_COBRANZA = ["admin", "supervisor", "encargado_area", "reception"];

export function puedeEnviarCobranza(role?: string | null) {
  return !!role && ROLES_COBRANZA.includes(role);
}

interface EnviarCobranzaProps {
  /** Nombre del cliente tal como lo conoce el ERP. */
  clientName: string;
  /** RUT, para resolver el cliente cuando el nombre no calza. */
  rut?: string | null;
  /** Clases del botón, para que cada pantalla lo acomode a su diseño. */
  className?: string;
  buttonSize?: "sm" | "default";
  testId?: string;
}

export function EnviarCobranzaButton({
  clientName,
  rut,
  className,
  buttonSize = "sm",
  testId = "button-enviar-cobranza",
}: EnviarCobranzaProps) {
  const { user } = useAuth();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"vencidas" | "porvencer">("vencidas");
  const [email, setEmail] = useState("");
  const [monto, setMonto] = useState("");
  const [fecha, setFecha] = useState("");
  const [doc, setDoc] = useState("");
  const [subject, setSubject] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [ccInternal, setCcInternal] = useState(true);
  const [extraCc, setExtraCc] = useState("");
  const [preview, setPreview] = useState<{ subject: string; html: string } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  // El correo de la ficha se precarga una sola vez por apertura: si quien
  // envía lo corrigió a mano, no se lo pisamos cuando llega la consulta.
  const [emailPrefilled, setEmailPrefilled] = useState(false);

  const { data: credito } = useCredito(clientName, rut);
  const cred = credito?.credit;
  const clientCode = credito?.client?.clientCode || null;

  // La ficha sólo se consulta cuando el diálogo está abierto: en la ficha del
  // cliente ya está en caché y acá evita una consulta de más al entrar.
  const { data: accountStatus } = useQuery<{ ficha: { email: string | null } | null }>({
    queryKey: [`/api/clients/account-status?name=${encodeURIComponent(clientName)}`],
    enabled: open && !!clientName,
  });
  const fichaEmail = accountStatus?.ficha?.email || null;

  const applyMode = useCallback(
    (next: "vencidas" | "porvencer") => {
      setMode(next);
      // Cuando el ERP no trae fecha (cliente sin documentos pendientes) se parte
      // con la de hoy: así el único dato que falta escribir es el monto.
      const hoy = new Date().toISOString().slice(0, 10);
      if (next === "vencidas") {
        setMonto(cred?.overdue ? String(Math.round(cred.overdue)) : "");
        setFecha((cred?.overdueSince || "").slice(0, 10) || hoy);
        setMensaje(
          "Le escribimos para recordarle que mantiene facturas vencidas con Pinturas Panorámica. Le agradeceremos regularizar el pago a la brevedad. Si ya realizó el pago, por favor omita este mensaje.",
        );
      } else {
        setMonto(cred?.upcoming ? String(Math.round(cred.upcoming)) : "");
        setFecha((cred?.nextDueDate || "").slice(0, 10) || hoy);
        setMensaje(
          "Le escribimos para recordarle que tiene documentos próximos a vencer con Pinturas Panorámica. Le agradeceremos considerar el pago dentro del plazo indicado.",
        );
      }
    },
    [cred?.overdue, cred?.overdueSince, cred?.upcoming, cred?.nextDueDate],
  );

  const abrir = () => {
    applyMode((cred?.overdue ?? 0) > 0 ? "vencidas" : "porvencer");
    setEmail(fichaEmail || "");
    setEmailPrefilled(!!fichaEmail);
    setDoc("");
    setSubject("");
    setCcInternal(true);
    setExtraCc("");
    setPreview(null);
    setOpen(true);
  };

  // La ficha suele llegar después de abrir (se consulta recién ahí).
  useEffect(() => {
    if (open && !emailPrefilled && fichaEmail) {
      setEmail((actual) => actual || fichaEmail);
      setEmailPrefilled(true);
    }
  }, [open, emailPrefilled, fichaEmail]);

  const fetchPreview = useCallback(async () => {
    if (!monto || Number(monto) <= 0 || !fecha) {
      setPreview(null);
      return;
    }
    setPreviewLoading(true);
    try {
      const res = await apiRequest("POST", "/api/admin/mailing/cobranza-preview", {
        clientName: credito?.client?.name || clientName,
        clientRut: credito?.client?.rut || rut || undefined,
        montoAdeudado: monto,
        fechaVencimiento: fecha,
        numeroDocumento: doc || undefined,
        mensajeAdicional: mensaje || undefined,
        subjectOverride: subject || undefined,
      });
      setPreview(await res.json());
    } catch {
      setPreview(null);
    } finally {
      setPreviewLoading(false);
    }
  }, [monto, fecha, doc, mensaje, subject, credito?.client?.name, credito?.client?.rut, clientName, rut]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => { fetchPreview(); }, 500);
    return () => clearTimeout(t);
  }, [open, fetchPreview]);

  const enviar = useMutation({
    mutationFn: async () => {
      if (!clientCode) throw new Error("Este cliente no tiene código SAP para registrar la cobranza.");
      const res = await apiRequest("POST", "/api/admin/mailing/send-cobranza", {
        koen: clientCode,
        clientEmailOverride: email || undefined,
        montoAdeudado: monto,
        fechaVencimiento: fecha,
        numeroDocumento: doc || undefined,
        mensajeAdicional: mensaje || undefined,
        subjectOverride: subject || undefined,
        sendToClient: true,
        ccInternal,
        extraCc: extraCc || undefined,
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: "Cobranza enviada", description: `Para: ${data.to}${data.cc ? ` · CC: ${data.cc}` : ""}` });
      setOpen(false);
    },
    onError: (e: any) => {
      toast({ title: "No se pudo enviar", description: e?.message || "Error al enviar la cobranza", variant: "destructive" });
    },
  });

  // Qué falta para poder armar la vista previa. El correo no se puede dibujar
  // sin monto, y decirlo con el nombre del campo evita quedarse mirando un
  // recuadro en blanco sin saber por qué (pasa con clientes sin deuda cargada).
  const faltaParaVerPreview = useMemo(() => {
    const falta: string[] = [];
    if (!(Number(monto) > 0)) falta.push("el monto");
    if (!fecha) falta.push("la fecha");
    if (falta.length === 0) return "—";
    return `Escribí ${falta.join(" y ")} arriba y la vista previa del correo aparece acá.`;
  }, [monto, fecha]);

  const puedeEnviar = useMemo(
    () => !!clientCode && !!email.trim() && Number(monto) > 0 && !!fecha,
    [clientCode, email, monto, fecha],
  );

  if (!puedeEnviarCobranza(user?.role)) return null;

  return (
    <>
      <Button
        variant="outline"
        size={buttonSize}
        className={className || "w-full rounded-2xl border-rose-300 text-rose-700 hover:bg-rose-50 hover:text-rose-800 sm:w-auto"}
        onClick={abrir}
        data-testid={testId}
      >
        <Send className="h-4 w-4 mr-2" /> Enviar cobranza
      </Button>

      {/* Vista previa + edición antes de enviar */}
      <Dialog open={open} onOpenChange={(o) => { if (!o) setOpen(false); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-rose-600" /> Enviar cobranza
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-5 md:grid-cols-2">
            {/* Formulario */}
            <div className="space-y-4">
              <div>
                <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Tipo de cobranza</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={mode === "porvencer" ? "default" : "outline"}
                    size="sm"
                    className={`rounded-lg text-xs ${mode === "porvencer" ? "bg-amber-500 hover:bg-amber-600 text-white" : ""}`}
                    onClick={() => applyMode("porvencer")}
                  >
                    <Clock className="h-3.5 w-3.5 mr-1.5" /> Recordatorio de vencimiento
                  </Button>
                  <Button
                    type="button"
                    variant={mode === "vencidas" ? "default" : "outline"}
                    size="sm"
                    className={`rounded-lg text-xs ${mode === "vencidas" ? "bg-rose-600 hover:bg-rose-700 text-white" : ""}`}
                    onClick={() => applyMode("vencidas")}
                  >
                    <AlertTriangle className="h-3.5 w-3.5 mr-1.5" /> Facturas vencidas
                  </Button>
                </div>
              </div>

              <div>
                <Label className="text-xs font-medium text-muted-foreground">Correo del cliente</Label>
                <Input
                  className="mt-1.5"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={fichaEmail || "cliente@correo.cl"}
                  data-testid="input-cobranza-email"
                />
                {!fichaEmail && (
                  <p className="text-[11px] text-amber-600 mt-1">La ficha no tiene correo registrado. Ingresá uno para poder enviar.</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Monto (CLP)</Label>
                  <Input className="mt-1.5" type="number" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="0" data-testid="input-cobranza-monto" />
                </div>
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">{mode === "vencidas" ? "Vencido desde" : "Fecha de vencimiento"}</Label>
                  <Input className="mt-1.5" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} data-testid="input-cobranza-fecha" />
                </div>
              </div>

              <div>
                <Label className="text-xs font-medium text-muted-foreground">N° documento (opcional)</Label>
                <Input className="mt-1.5" value={doc} onChange={(e) => setDoc(e.target.value)} placeholder="Ej: FCV 12345" />
              </div>

              <div>
                <Label className="text-xs font-medium text-muted-foreground">Asunto (opcional)</Label>
                <Input className="mt-1.5" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Se genera automáticamente si lo dejás vacío" />
              </div>

              <div>
                <Label className="text-xs font-medium text-muted-foreground">Mensaje</Label>
                <Textarea className="mt-1.5" rows={4} value={mensaje} onChange={(e) => setMensaje(e.target.value)} data-testid="textarea-cobranza-mensaje" />
              </div>

              <div className="flex items-center gap-2">
                <Switch id="cob-cc" checked={ccInternal} onCheckedChange={setCcInternal} />
                <Label htmlFor="cob-cc" className="text-sm cursor-pointer">Copia al equipo interno de cobranzas</Label>
              </div>
              <div>
                <Label className="text-xs font-medium text-muted-foreground">CC adicional (opcional)</Label>
                <Input className="mt-1.5" value={extraCc} onChange={(e) => setExtraCc(e.target.value)} placeholder="cobranzas@empresa.cl, ..." />
              </div>
            </div>

            {/* Vista previa */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium text-muted-foreground">Vista previa del correo</Label>
                <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => fetchPreview()} disabled={previewLoading}>
                  {previewLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Actualizar"}
                </Button>
              </div>
              {preview?.subject && (
                <p className="text-xs text-muted-foreground truncate"><span className="font-medium">Asunto:</span> {preview.subject}</p>
              )}
              <div className="rounded-lg border bg-muted/20 overflow-hidden h-[440px]">
                {preview?.html ? (
                  <iframe title="Vista previa cobranza" srcDoc={preview.html} sandbox="" className="w-full h-full border-0 bg-white" />
                ) : (
                  <div className="flex items-center justify-center h-full text-sm text-muted-foreground p-4 text-center">
                    {previewLoading ? "Generando vista previa…" : faltaParaVerPreview}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-3 mt-1 border-t">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={enviar.isPending}>Cancelar</Button>
            <Button
              className="bg-rose-600 hover:bg-rose-700 text-white"
              onClick={() => enviar.mutate()}
              disabled={!puedeEnviar || enviar.isPending}
              data-testid="button-confirm-cobranza"
            >
              {enviar.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              {enviar.isPending ? "Enviando…" : "Enviar cobranza"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
