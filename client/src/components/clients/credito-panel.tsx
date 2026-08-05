// ═══════════════════════════════════════════════════════════════════════════
// PANEL DE CRÉDITO DEL CLIENTE — fuente de verdad compartida
// ═══════════════════════════════════════════════════════════════════════════
// La pestaña Crédito de la ficha del cliente y el panel de Cobranza del Panel
// de Trabajo son la MISMA vista: mismo endpoint (/api/clients/credito) y mismo
// componente, en dos densidades. Antes cada uno sumaba por su cuenta y podían
// mostrar cifras distintas para el mismo cliente.
//
// Todos los montos salen de los documentos pendientes del ERP (no de
// clients.crsd, que viene vacío); de la ficha solo se toma la línea de crédito.
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  CalendarClock,
  CircleDollarSign,
  Clock,
  FileText,
  Loader2,
  ShieldCheck,
  Wallet,
} from "lucide-react";

export interface CreditoDoc {
  nudo: string | null;
  tido: string | null;
  clientCode: string | null;
  emision: string | null;
  vencimiento: string | null;
  saldo: number;
  diasVencido: number;
  vencida: boolean;
}

export interface CreditoResponse {
  client: {
    id: string;
    clientCode: string | null;
    name: string | null;
    rut: string | null;
    paymentCondition: string | null;
    creditDays: number | null;
    salesRepCode: string | null;
    branchCount: number;
  } | null;
  credit: {
    limit: number | null;
    used: number;
    overdue: number;
    upcoming: number;
    available: number | null;
    exceeded: boolean;
    overdueSince: string | null;
    nextDueDate: string | null;
    documentCount: number;
    oldestOverdueDays: number | null;
  };
  aging: { porVencer: number; d1a30: number; d31a60: number; d61a90: number; d90mas: number };
  docs: CreditoDoc[];
}

const clp = (n: number | null | undefined) =>
  n == null
    ? "—"
    : new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(Number(n) || 0);

const fecha = (v: string | null) => {
  if (!v) return "—";
  const [y, m, d] = v.split("-");
  if (!y || !m || !d) return v;
  return `${d}-${m}-${y}`;
};

/** Query compartida: cualquier vista que muestre crédito debe usar esta clave. */
export function useCredito(clientName: string | null | undefined, rut?: string | null) {
  return useQuery<CreditoResponse>({
    queryKey: ["/api/clients/credito", { name: clientName || "", rut: rut || "" }],
    enabled: !!clientName || !!rut,
  });
}

function KpiCredito({
  label,
  value,
  hint,
  icon: Icon,
  tono,
}: {
  label: string;
  value: string;
  hint?: string | null;
  icon: any;
  tono: "marca" | "neutro" | "alerta" | "error" | "ok";
}) {
  const tonos = {
    marca: "border-orange-200/70 bg-orange-50/60 text-[#fd6301] dark:border-orange-900/40 dark:bg-orange-950/30",
    neutro: "border-slate-200/70 bg-slate-50/60 text-slate-700 dark:border-slate-700/60 dark:bg-slate-800/40 dark:text-slate-200",
    alerta: "border-amber-200/70 bg-amber-50/60 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300",
    error: "border-red-200/70 bg-red-50/60 text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300",
    ok: "border-emerald-200/70 bg-emerald-50/60 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300",
  }[tono];

  return (
    <div className={`rounded-2xl border p-3 ${tonos}`}>
      <div className="flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 opacity-70" />
        <p className="text-[10px] font-bold uppercase tracking-wider opacity-80">{label}</p>
      </div>
      <p className="mt-1 text-lg font-bold tabular-nums leading-tight">{value}</p>
      {hint && <p className="mt-0.5 text-[11px] opacity-70">{hint}</p>}
    </div>
  );
}

/**
 * Panel de crédito. `variant="compact"` es la versión para el Panel de Trabajo
 * (cabe en el alto del modal de tarea); `full` es la pestaña de la ficha.
 */
export function CreditoPanel({
  clientName,
  rut,
  variant = "full",
  footer,
}: {
  clientName: string | null | undefined;
  rut?: string | null;
  variant?: "full" | "compact";
  footer?: React.ReactNode;
}) {
  const { data, isLoading, isError } = useCredito(clientName, rut);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-6 text-xs text-slate-400">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Cargando crédito…
      </div>
    );
  }
  if (isError || !data) {
    return <p className="py-6 text-xs italic text-slate-400">No se pudo cargar el crédito del cliente.</p>;
  }

  const { credit, aging, docs, client } = data;
  // Sin línea asignada no se dibuja uso: 0 de 0 no es "al día", es "sin línea".
  const usoPct = credit.limit && credit.limit > 0 ? Math.min(100, Math.round((credit.used / credit.limit) * 100)) : null;
  const compact = variant === "compact";

  const tramos = [
    { label: "Por vencer", monto: aging.porVencer, color: "bg-slate-400" },
    { label: "1–30 días", monto: aging.d1a30, color: "bg-amber-400" },
    { label: "31–60 días", monto: aging.d31a60, color: "bg-orange-500" },
    { label: "61–90 días", monto: aging.d61a90, color: "bg-red-400" },
    { label: "+90 días", monto: aging.d90mas, color: "bg-red-600" },
  ];
  const totalTramos = tramos.reduce((t, x) => t + x.monto, 0);

  const listaDocs = (
    <div className="space-y-1.5">
      {docs.map((d, i) => (
        <div
          key={`${d.tido}-${d.nudo}-${i}`}
          className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2 ${
            d.vencida
              ? "border-red-100 bg-red-50/60 dark:border-red-900/40 dark:bg-red-950/20"
              : "border-slate-100 bg-white dark:border-slate-700/60 dark:bg-slate-800/40"
          }`}
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                {d.tido} N° {d.nudo}
              </span>
              {d.vencida ? (
                <Badge className="border-red-200 bg-red-100 text-[10px] font-bold text-red-700 hover:bg-red-100">
                  {d.diasVencido} {d.diasVencido === 1 ? "día" : "días"} vencida
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] font-bold text-muted-foreground">
                  Por vencer
                </Badge>
              )}
            </div>
            <p className={`mt-0.5 text-xs ${d.vencida ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`}>
              Vence {fecha(d.vencimiento)}
              {d.emision && ` · emitida ${fecha(d.emision)}`}
            </p>
          </div>
          <span
            className={`shrink-0 text-sm font-semibold tabular-nums ${
              d.vencida ? "text-red-600 dark:text-red-400" : "text-slate-700 dark:text-slate-200"
            }`}
          >
            {clp(d.saldo)}
          </span>
        </div>
      ))}
    </div>
  );

  // ── Versión compacta (Panel de Trabajo) ──
  if (compact) {
    return (
      <div className="space-y-2.5">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <KpiCredito label="Deuda" value={clp(credit.used)} icon={Wallet} tono="neutro" />
          <KpiCredito label="Vencido" value={clp(credit.overdue)} icon={AlertTriangle} tono={credit.overdue > 0 ? "error" : "ok"} />
          <KpiCredito label="Por vencer" value={clp(credit.upcoming)} icon={CalendarClock} tono="neutro" />
          <KpiCredito
            label="Disponible"
            value={credit.limit == null ? "Sin línea" : clp(credit.available)}
            icon={ShieldCheck}
            tono={credit.exceeded ? "error" : "ok"}
          />
        </div>
        {docs.length === 0 ? (
          <p className="text-xs italic text-slate-400">Sin documentos pendientes.</p>
        ) : (
          listaDocs
        )}
        {footer}
      </div>
    );
  }

  // ── Versión completa (pestaña Crédito de la ficha) ──
  return (
    <div className="space-y-4">
      {/* Resumen */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <CircleDollarSign className="h-4 w-4 text-[#fd6301]" /> Panorama de crédito
            {credit.exceeded && (
              <Badge className="ml-auto border-red-200 bg-red-100 text-[10px] font-bold text-red-700 hover:bg-red-100">
                Crédito excedido
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
            <KpiCredito
              label="Límite de crédito"
              value={credit.limit == null ? "Sin línea" : clp(credit.limit)}
              hint={client?.creditDays ? `${client.creditDays} días` : client?.paymentCondition || null}
              icon={CircleDollarSign}
              tono="marca"
            />
            <KpiCredito
              label="Deuda total"
              value={clp(credit.used)}
              hint={`${credit.documentCount} ${credit.documentCount === 1 ? "documento" : "documentos"}`}
              icon={Wallet}
              tono="neutro"
            />
            <KpiCredito
              label="Vencido"
              value={clp(credit.overdue)}
              hint={credit.overdueSince ? `desde ${fecha(credit.overdueSince)}` : null}
              icon={AlertTriangle}
              tono={credit.overdue > 0 ? "error" : "ok"}
            />
            <KpiCredito
              label="Por vencer"
              value={clp(credit.upcoming)}
              hint={credit.nextDueDate ? `próximo ${fecha(credit.nextDueDate)}` : null}
              icon={CalendarClock}
              tono="alerta"
            />
            <KpiCredito
              label="Disponible"
              value={credit.limit == null ? "Sin línea" : clp(credit.available)}
              hint={usoPct != null ? `${usoPct}% de la línea usada` : "sin línea asignada"}
              icon={ShieldCheck}
              tono={credit.exceeded ? "error" : "ok"}
            />
          </div>

          {/* Uso de la línea */}
          {usoPct != null && (
            <div>
              <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Uso de la línea de crédito</span>
                <span className="font-semibold tabular-nums">
                  {clp(credit.used)} de {clp(credit.limit)}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  className={`h-full rounded-full transition-all ${
                    credit.exceeded ? "bg-red-500" : usoPct > 80 ? "bg-amber-500" : "bg-[#fd6301]"
                  }`}
                  style={{ width: `${Math.max(2, usoPct)}%` }}
                />
              </div>
            </div>
          )}

          {/* De dónde salen los números */}
          <p className="text-[11px] text-muted-foreground">
            Deuda, vencido y por vencer suman los {credit.documentCount}{" "}
            {credit.documentCount === 1 ? "documento pendiente" : "documentos pendientes"} del ERP (facturas y facturas
            de débito sin pagar). Disponible = límite − deuda.
            {client && client.branchCount > 1 && ` Incluye las ${client.branchCount} fichas de la empresa.`}
          </p>

          {footer}
        </CardContent>
      </Card>

      {/* Antigüedad de la deuda */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4 text-amber-500" /> Antigüedad de la deuda
            {credit.oldestOverdueDays != null && (
              <Badge variant="outline" className="ml-auto text-[10px] font-bold">
                más antigua: {credit.oldestOverdueDays} días
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {totalTramos === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">Sin deuda pendiente.</p>
          ) : (
            <div className="space-y-3">
              <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                {tramos
                  .filter((t) => t.monto > 0)
                  .map((t) => (
                    <div key={t.label} className={t.color} style={{ width: `${(t.monto / totalTramos) * 100}%` }} title={`${t.label}: ${clp(t.monto)}`} />
                  ))}
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {tramos.map((t) => (
                  <div key={t.label} className="rounded-xl border border-slate-200/70 p-2 dark:border-slate-700/60">
                    <div className="flex items-center gap-1.5">
                      <span className={`h-2 w-2 rounded-full ${t.color}`} />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t.label}</span>
                    </div>
                    <p className="mt-0.5 text-sm font-semibold tabular-nums text-slate-700 dark:text-slate-200">{clp(t.monto)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Documentos pendientes */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4 text-emerald-500" /> Documentos pendientes
            {docs.length > 0 && (
              <Badge variant="outline" className="ml-auto text-[10px] font-bold">
                {docs.length} pend.
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {docs.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Sin facturas pendientes de pago.</p>
          ) : (
            listaDocs
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default CreditoPanel;
