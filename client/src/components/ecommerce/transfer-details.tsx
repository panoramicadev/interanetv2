import { useState } from "react";
import { Landmark, Copy, Check, ChevronDown, ChevronUp, CreditCard, ExternalLink } from "lucide-react";

// ==========================================================================
// Datos de pago de Pinturas Panorámica — única fuente de verdad en el frontend.
// Deben coincidir con el pie del PDF del tomador de pedidos (cotización):
// server/routes.ts (/api/quotes/:id/pdf) y server/services/quote-request-pdf.ts.
// ==========================================================================
export const PANORAMICA_PAYMENT = {
  razonSocial: "Pintureria Panoramica Limitada",
  rut: "78.652.260-9",
  banco: "Banco Santander",
  tipoCuenta: "Cuenta Corriente",
  numeroCuenta: "2592916-0",
  email: "contacto@pinturaspanoramica.cl",
  cardLink: "https://micrositios.getnet.cl/pinturaspanoramica",
} as const;

const fields: { label: string; value: string }[] = [
  { label: "Razón social", value: PANORAMICA_PAYMENT.razonSocial },
  { label: "RUT", value: PANORAMICA_PAYMENT.rut },
  { label: "Banco", value: PANORAMICA_PAYMENT.banco },
  { label: "Tipo de cuenta", value: PANORAMICA_PAYMENT.tipoCuenta },
  { label: "N° de cuenta", value: PANORAMICA_PAYMENT.numeroCuenta },
  { label: "Email", value: PANORAMICA_PAYMENT.email },
];

const copyAllText = [
  PANORAMICA_PAYMENT.razonSocial,
  `RUT: ${PANORAMICA_PAYMENT.rut}`,
  `${PANORAMICA_PAYMENT.banco} · ${PANORAMICA_PAYMENT.tipoCuenta}`,
  `N° ${PANORAMICA_PAYMENT.numeroCuenta}`,
  `Email: ${PANORAMICA_PAYMENT.email}`,
].join("\n");

async function copy(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to legacy path */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    if (await copy(value)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    }
  };
  return (
    <button
      type="button"
      onClick={onCopy}
      className="group w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border border-slate-200 bg-white hover:border-orange-200 hover:bg-orange-50/40 transition-colors text-left"
      title={`Copiar ${label.toLowerCase()}`}
    >
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
        <p className="text-sm font-semibold text-slate-800 truncate">{value}</p>
      </div>
      <span className={`flex-shrink-0 inline-flex items-center gap-1 text-xs font-semibold ${copied ? "text-emerald-600" : "text-slate-400 group-hover:text-orange-600"}`}>
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        {copied ? "Copiado" : "Copiar"}
      </span>
    </button>
  );
}

interface TransferDetailsProps {
  /** Si es true arranca expandido (no colapsable). Por defecto colapsable y cerrado. */
  defaultOpen?: boolean;
  collapsible?: boolean;
}

export function TransferDetails({ defaultOpen = false, collapsible = true }: TransferDetailsProps) {
  const [open, setOpen] = useState(defaultOpen || !collapsible);
  const [copiedAll, setCopiedAll] = useState(false);

  const onCopyAll = async () => {
    if (await copy(copyAllText)) {
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 1600);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => collapsible && setOpen((v) => !v)}
        className={`w-full flex items-center justify-between gap-3 px-5 py-4 ${collapsible ? "cursor-pointer hover:bg-slate-50/80" : "cursor-default"} transition-colors`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-10 w-10 rounded-xl bg-slate-900 flex items-center justify-center flex-shrink-0">
            <Landmark className="h-5 w-5 text-orange-400" />
          </div>
          <div className="min-w-0 text-left">
            <h3 className="text-sm font-bold text-slate-900">Datos para transferencia</h3>
            <p className="text-xs text-slate-500 truncate">Realizá tu pago y envianos el comprobante</p>
          </div>
        </div>
        {collapsible && (
          <span className="flex-shrink-0 text-slate-400">
            {open ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </span>
        )}
      </button>

      {open && (
        <div className="px-5 pb-5 pt-1 space-y-3 animate-in slide-in-from-top-2 fade-in duration-200">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {fields.map((f) => (
              <CopyRow key={f.label} label={f.label} value={f.value} />
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={onCopyAll}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#FF6E23] hover:bg-[#E55E13] text-white text-sm font-bold transition-colors"
            >
              {copiedAll ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copiedAll ? "Datos copiados" : "Copiar todos los datos"}
            </button>
            <a
              href={PANORAMICA_PAYMENT.cardLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors"
            >
              <CreditCard className="h-4 w-4" />
              Pagar con tarjeta
              <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
            </a>
          </div>

          <p className="text-[11px] text-slate-400 leading-relaxed">
            Una vez realizada la transferencia, enviá el comprobante a{" "}
            <a href={`mailto:${PANORAMICA_PAYMENT.email}`} className="text-orange-600 font-medium hover:underline">
              {PANORAMICA_PAYMENT.email}
            </a>{" "}
            para procesar tu pedido.
          </p>
        </div>
      )}
    </div>
  );
}

export default TransferDetails;
