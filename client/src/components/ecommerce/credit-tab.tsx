import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Loader2,
  Wallet,
  ShieldCheck,
  AlertTriangle,
  Clock,
  CalendarClock,
  ReceiptText,
  TrendingDown,
  CircleDollarSign,
} from "lucide-react";
import { TransferDetails } from "./transfer-details";
import { FacturaDownloadButton } from "./factura-download-button";

const formatCurrency = (value: number | null | undefined) =>
  new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);

const formatDate = (dateStr?: string | null) => {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return String(dateStr);
  return d.toLocaleDateString("es-CL", { year: "numeric", month: "short", day: "numeric" });
};

// Días entre hoy y una fecha (positivo = futuro / faltan; negativo = pasado / vencido).
const daysFromToday = (dateStr?: string | null): number | null => {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86400000);
};

interface AccountStatus {
  hasFicha: boolean;
  clientName: string | null;
  rut: string | null;
  paymentCondition: string | null;
  creditLimit: number | null;
  creditUsed: number | null;
  creditOverdue: number | null;
  creditUpcoming: number | null;
  creditAvailable: number | null;
  nextDueDate: string | null;
  overdueSince: string | null;
  hasCredit: boolean;
  hasDebt: boolean;
  hasOverdue: boolean;
}

interface CarteraDoc {
  idmaeedo: string | null;
  nudo: string | null;
  tido: string | null;
  emision: string | null;
  vencimiento: string | null;
  saldo: number;
  total: number;
  vencida: boolean;
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone = "slate",
  sub,
}: {
  icon: any;
  label: string;
  value: string;
  tone?: "slate" | "emerald" | "amber" | "red" | "blue";
  sub?: string;
}) {
  const tones: Record<string, string> = {
    slate: "from-slate-50 to-slate-100/50 text-slate-900",
    emerald: "from-emerald-50 to-emerald-100/50 text-emerald-900",
    amber: "from-amber-50 to-amber-100/50 text-amber-900",
    red: "from-red-50 to-red-100/50 text-red-700",
    blue: "from-blue-50 to-blue-100/50 text-blue-900",
  };
  const iconTones: Record<string, string> = {
    slate: "bg-slate-500/10 text-slate-600",
    emerald: "bg-emerald-500/10 text-emerald-600",
    amber: "bg-amber-500/10 text-amber-600",
    red: "bg-red-500/10 text-red-600",
    blue: "bg-blue-500/10 text-blue-600",
  };
  return (
    <div className={`rounded-2xl border-0 shadow-sm bg-gradient-to-br ${tones[tone]} p-5`}>
      <div className="flex items-center justify-between mb-3">
        <div className={`p-2 rounded-xl ${iconTones[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs opacity-80 mt-1">{label}</p>
      {sub && <p className="text-[11px] opacity-70 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function CreditTab() {
  const { data: status, isLoading: statusLoading } = useQuery<AccountStatus>({
    queryKey: ["/api/ecommerce/client/account-status"],
    queryFn: async () => {
      const res = await fetch(`/api/ecommerce/client/account-status`, { credentials: "include" });
      if (!res.ok) throw new Error("No se pudo cargar el estado de cuenta");
      return res.json();
    },
  });

  const { data: carteraData, isLoading: carteraLoading } = useQuery<{ docs: CarteraDoc[] }>({
    queryKey: ["/api/ecommerce/client/cartera"],
    queryFn: async () => {
      const res = await fetch(`/api/ecommerce/client/cartera`, { credentials: "include" });
      if (!res.ok) return { docs: [] };
      return res.json();
    },
  });

  const docs = carteraData?.docs || [];
  const isLoading = statusLoading || carteraLoading;

  // Estado global de deuda → define el banner.
  const debtState = useMemo<"al-dia" | "por-pagar" | "vencido">(() => {
    if (!status) return "al-dia";
    if (status.hasOverdue) return "vencido";
    if (status.hasDebt) return "por-pagar";
    return "al-dia";
  }, [status]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  const banner = {
    "al-dia": {
      icon: ShieldCheck,
      title: "Estás al día",
      desc: "No registrás saldos pendientes con Pinturas Panorámica.",
      wrap: "from-emerald-600 to-emerald-700",
    },
    "por-pagar": {
      icon: Clock,
      title: "Tenés saldos por pagar",
      desc: status?.nextDueDate
        ? `Tu próximo vencimiento es el ${formatDate(status.nextDueDate)}.`
        : "Tenés documentos pendientes de pago, aún sin vencer.",
      wrap: "from-amber-500 to-amber-600",
    },
    vencido: {
      icon: AlertTriangle,
      title: "Tenés deuda vencida",
      desc: status?.overdueSince
        ? `Hay saldos vencidos desde el ${formatDate(status.overdueSince)}. Regularizá tu cuenta para seguir comprando con normalidad.`
        : "Tenés saldos vencidos. Regularizá tu cuenta para seguir comprando con normalidad.",
      wrap: "from-red-600 to-rose-700",
    },
  }[debtState];

  const BannerIcon = banner.icon;
  const totalAdeudado = Number(status?.creditUsed) || 0;

  return (
    <div className="space-y-6">
      {/* Banner de estado */}
      <div className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${banner.wrap} p-6 sm:p-7 text-white`}>
        <div className="absolute -top-16 -right-10 w-72 h-72 bg-white/10 rounded-full blur-3xl" />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div className="flex items-start gap-4 min-w-0">
            <div className="h-12 w-12 rounded-2xl bg-white/15 flex items-center justify-center flex-shrink-0 backdrop-blur-sm">
              <BannerIcon className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-widest text-white/70">Estado de cuenta</p>
              <h2 className="text-2xl sm:text-3xl font-black mt-0.5 leading-tight">{banner.title}</h2>
              <p className="text-white/85 text-sm mt-1.5 max-w-xl">{banner.desc}</p>
            </div>
          </div>
          {totalAdeudado > 0 && (
            <div className="text-right flex-shrink-0 bg-white/10 rounded-2xl px-5 py-3 backdrop-blur-sm">
              <p className="text-[11px] uppercase tracking-wider text-white/70">Saldo total pendiente</p>
              <p className="text-3xl font-black leading-none mt-1">{formatCurrency(totalAdeudado)}</p>
            </div>
          )}
        </div>
      </div>

      {/* Resumen de crédito / cartera */}
      {status?.hasCredit ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={Wallet}
            tone="blue"
            label="Línea de crédito"
            value={status.creditLimit != null ? formatCurrency(status.creditLimit) : "—"}
            sub={status.paymentCondition ? status.paymentCondition : undefined}
          />
          <StatCard
            icon={CircleDollarSign}
            tone={Number(status.creditAvailable) < 0 ? "red" : "emerald"}
            label="Cupo disponible"
            value={status.creditAvailable != null ? formatCurrency(status.creditAvailable) : "—"}
          />
          <StatCard
            icon={TrendingDown}
            tone="amber"
            label="Saldo utilizado"
            value={formatCurrency(status.creditUsed)}
            sub={status.nextDueDate ? `Próx. vencimiento ${formatDate(status.nextDueDate)}` : undefined}
          />
          <StatCard
            icon={AlertTriangle}
            tone="red"
            label="Vencido"
            value={formatCurrency(status.creditOverdue)}
            sub={status.overdueSince ? `Desde ${formatDate(status.overdueSince)}` : "Sin vencidos"}
          />
        </div>
      ) : totalAdeudado > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <StatCard icon={TrendingDown} tone="amber" label="Saldo pendiente" value={formatCurrency(status?.creditUsed)} />
          <StatCard
            icon={AlertTriangle}
            tone="red"
            label="Vencido"
            value={formatCurrency(status?.creditOverdue)}
            sub={status?.overdueSince ? `Desde ${formatDate(status.overdueSince)}` : "Sin vencidos"}
          />
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-slate-100">
            <Wallet className="h-5 w-5 text-slate-500" />
          </div>
          <p className="text-sm text-slate-600">
            Tu cuenta opera <strong className="text-slate-800">al contado</strong>
            {status?.paymentCondition ? ` (${status.paymentCondition})` : ""}. No tenés una línea de crédito asignada.
          </p>
        </div>
      )}

      {/* Documentos pendientes (cuentas por cobrar) */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <ReceiptText className="h-4 w-4 text-blue-500" />
            Documentos pendientes de pago
          </h3>
          {docs.length > 0 && (
            <span className="text-xs font-semibold text-slate-500 bg-white border border-slate-200 px-2.5 py-1 rounded-full">
              {docs.length} documento{docs.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {docs.length === 0 ? (
          <div className="p-10 text-center">
            <ShieldCheck className="h-9 w-9 text-emerald-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500">No tenés documentos pendientes de pago. ¡Estás al día!</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {docs.map((d) => {
              const days = daysFromToday(d.vencimiento);
              const overdue = d.vencida;
              const dueLabel =
                days == null
                  ? null
                  : overdue
                    ? `Vencida hace ${Math.abs(days)} día${Math.abs(days) !== 1 ? "s" : ""}`
                    : days === 0
                      ? "Vence hoy"
                      : `Vence en ${days} día${days !== 1 ? "s" : ""}`;
              return (
                <div key={d.idmaeedo || d.nudo} className="px-5 py-3.5 flex items-center gap-3 hover:bg-slate-50/60 transition-colors">
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 ${overdue ? "bg-red-50 text-red-600" : "bg-blue-50 text-blue-600"}`}>
                    <ReceiptText className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-slate-800">Factura N° {d.nudo || "—"}</p>
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${overdue ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                        <CalendarClock className="h-3 w-3" />
                        {overdue ? "Vencida" : "Por vencer"}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Emitida {formatDate(d.emision)} · Vence {formatDate(d.vencimiento)}
                      {dueLabel ? <span className={overdue ? "text-red-500 font-medium" : "text-slate-400"}> · {dueLabel}</span> : null}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`text-sm font-black ${overdue ? "text-red-600" : "text-slate-900"}`}>{formatCurrency(d.saldo)}</p>
                    <p className="text-[10px] text-slate-400">saldo</p>
                  </div>
                  {d.idmaeedo && (
                    <FacturaDownloadButton idmaeedo={d.idmaeedo} folio={d.nudo} variant="icon" />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Datos para transferencia — abiertos por defecto si hay deuda */}
      <TransferDetails defaultOpen={debtState !== "al-dia"} />
    </div>
  );
}
