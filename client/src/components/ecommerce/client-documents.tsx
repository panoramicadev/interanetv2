import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { pdf, Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import {
  FileText,
  Truck,
  Eye,
  Download,
  Loader2,
  Search,
  X,
  Calendar,
  Package,
  ReceiptText,
  FileDigit,
} from "lucide-react";

// ==========================================
// Helpers
// ==========================================

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value || 0);

const formatDate = (dateStr?: string | null) => {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return String(dateStr);
  return date.toLocaleDateString("es-CL", { year: "numeric", month: "short", day: "numeric" });
};

const num = (v: any): number => {
  if (v == null) return 0;
  const n = typeof v === "string" ? parseFloat(v) : Number(v);
  return isNaN(n) ? 0 : n;
};

export const facturaTipoLabel = (tido?: string): string => {
  const t = (tido || "").toUpperCase();
  switch (t) {
    case "FCV": return "Factura";
    case "FDV": return "Factura";
    case "BLV": return "Boleta";
    case "NCV": return "Nota de Crédito";
    case "NDV": return "Nota de Débito";
    case "FEX": return "Factura Exportación";
    default: return t ? `Documento ${t}` : "Documento";
  }
};

// ==========================================
// Types
// ==========================================

export interface DocLineItem {
  productName: string;
  sku?: string;
  quantity: number;
  lineTotal: number;
}

export interface ClientDocument {
  kind: "factura" | "despacho";
  key: string;
  numero: string;
  tido?: string;
  tipoLabel: string;
  fecha: string;
  cliente: string;
  vendedor?: string;
  items: DocLineItem[];
  total: number;
}

// ==========================================
// Grouping helpers (raw ERP rows → documents)
// ==========================================

export function groupFacturas(rows: any[]): ClientDocument[] {
  const map = new Map<string, ClientDocument>();
  (rows || []).forEach((row) => {
    const numero = String(row.nudo ?? row.NUDO ?? "");
    if (!numero) return;
    const tido = (row.tido ?? row.TIDO ?? "FCV") as string;
    const key = `${tido}|${numero}`;
    const lineTotal = num(row.vabrdo ?? row.monto ?? row.vanedo);
    const item: DocLineItem = {
      productName: row.nokoprct ?? row.nokopr ?? row.NOKOPR ?? "Producto",
      sku: row.koprct ?? row.KOPRCT ?? undefined,
      quantity: num(row.caprad2 ?? row.caprco2 ?? row.caprad ?? row.CAPRCO2) || 1,
      lineTotal,
    };
    const existing = map.get(key);
    if (existing) {
      existing.items.push(item);
      existing.total += lineTotal;
    } else {
      map.set(key, {
        kind: "factura",
        key,
        numero,
        tido,
        tipoLabel: facturaTipoLabel(tido),
        fecha: row.feemdo ?? row.FEEMDO ?? "",
        cliente: row.nokoen ?? row.NOKOEN ?? "",
        vendedor: row.nokofu ?? row.NOKOFU ?? undefined,
        items: [item],
        total: lineTotal,
      });
    }
  });
  return Array.from(map.values()).sort(
    (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime(),
  );
}

export function groupDespachos(rows: any[]): ClientDocument[] {
  const map = new Map<string, ClientDocument>();
  (rows || []).forEach((row) => {
    const numero = String(row.nudo ?? row.numeroGuia ?? row.NUDO ?? "");
    if (!numero) return;
    const key = `GDV|${numero}`;
    const lineTotal = num(row.monto ?? row.vabrli ?? row.vaneli);
    const item: DocLineItem = {
      productName: row.nokoprct ?? row.producto ?? row.NOKOPR ?? "Producto",
      sku: row.koprct ?? row.KOPRCT ?? undefined,
      quantity: num(row.caprco2 ?? row.cantidad ?? row.caprad2) || 1,
      lineTotal,
    };
    const existing = map.get(key);
    if (existing) {
      existing.items.push(item);
      existing.total += lineTotal;
    } else {
      map.set(key, {
        kind: "despacho",
        key,
        numero,
        tido: "GDV",
        tipoLabel: "Guía de Despacho",
        fecha: row.feemdo ?? row.fecha ?? row.FEEMDO ?? "",
        cliente: row.nokoen ?? row.cliente ?? row.NOKOEN ?? "",
        items: [item],
        total: lineTotal,
      });
    }
  });
  return Array.from(map.values()).sort(
    (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime(),
  );
}

// ==========================================
// PDF document (client-side generated)
// ==========================================

const pdfStyles = StyleSheet.create({
  page: { padding: 36, fontSize: 9, fontFamily: "Helvetica", color: "#1e293b" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 },
  brand: { fontSize: 16, fontFamily: "Helvetica-Bold", color: "#FF6E23" },
  brandSub: { fontSize: 8, color: "#64748b", marginTop: 2 },
  docBox: { borderWidth: 1, borderColor: "#FF6E23", borderRadius: 4, padding: 8, alignItems: "flex-end", minWidth: 150 },
  docType: { fontSize: 11, fontFamily: "Helvetica-Bold", color: "#FF6E23" },
  docNum: { fontSize: 13, fontFamily: "Helvetica-Bold", marginTop: 2 },
  docDate: { fontSize: 8, color: "#64748b", marginTop: 2 },
  metaRow: { flexDirection: "row", marginBottom: 4 },
  metaLabel: { width: 70, color: "#64748b", fontFamily: "Helvetica-Bold" },
  metaValue: { flex: 1 },
  section: { marginTop: 14 },
  tHead: { flexDirection: "row", backgroundColor: "#f1f5f9", paddingVertical: 6, paddingHorizontal: 6, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  tRow: { flexDirection: "row", paddingVertical: 5, paddingHorizontal: 6, borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  cProd: { flex: 4 },
  cSku: { flex: 2, color: "#64748b" },
  cQty: { flex: 1, textAlign: "right" },
  cTotal: { flex: 2, textAlign: "right" },
  thText: { fontFamily: "Helvetica-Bold", fontSize: 8, color: "#475569", textTransform: "uppercase" },
  totalRow: { flexDirection: "row", justifyContent: "flex-end", marginTop: 12 },
  totalBox: { backgroundColor: "#FF6E23", borderRadius: 4, paddingVertical: 8, paddingHorizontal: 14 },
  totalLabel: { color: "#ffffff", fontSize: 8, textTransform: "uppercase" },
  totalValue: { color: "#ffffff", fontSize: 14, fontFamily: "Helvetica-Bold", marginTop: 2 },
  footer: { position: "absolute", bottom: 24, left: 36, right: 36, textAlign: "center", fontSize: 7, color: "#94a3b8", borderTopWidth: 1, borderTopColor: "#e2e8f0", paddingTop: 8 },
});

function DocumentoPDFDocument({ doc }: { doc: ClientDocument }) {
  return (
    <Document>
      <Page size="A4" style={pdfStyles.page}>
        <View style={pdfStyles.headerRow}>
          <View>
            <Text style={pdfStyles.brand}>Pinturas Panorámica</Text>
            <Text style={pdfStyles.brandSub}>Documento de respaldo · Generado desde el portal del cliente</Text>
          </View>
          <View style={pdfStyles.docBox}>
            <Text style={pdfStyles.docType}>{doc.tipoLabel}</Text>
            <Text style={pdfStyles.docNum}>N° {doc.numero}</Text>
            <Text style={pdfStyles.docDate}>{formatDate(doc.fecha)}</Text>
          </View>
        </View>

        <View style={pdfStyles.metaRow}>
          <Text style={pdfStyles.metaLabel}>Cliente:</Text>
          <Text style={pdfStyles.metaValue}>{doc.cliente || "-"}</Text>
        </View>
        {doc.vendedor ? (
          <View style={pdfStyles.metaRow}>
            <Text style={pdfStyles.metaLabel}>Vendedor:</Text>
            <Text style={pdfStyles.metaValue}>{doc.vendedor}</Text>
          </View>
        ) : null}

        <View style={pdfStyles.section}>
          <View style={pdfStyles.tHead}>
            <Text style={[pdfStyles.cProd, pdfStyles.thText]}>Producto</Text>
            <Text style={[pdfStyles.cSku, pdfStyles.thText]}>SKU</Text>
            <Text style={[pdfStyles.cQty, pdfStyles.thText]}>Cant.</Text>
            <Text style={[pdfStyles.cTotal, pdfStyles.thText]}>Importe</Text>
          </View>
          {doc.items.map((it, idx) => (
            <View style={pdfStyles.tRow} key={idx}>
              <Text style={pdfStyles.cProd}>{it.productName}</Text>
              <Text style={pdfStyles.cSku}>{it.sku || "-"}</Text>
              <Text style={pdfStyles.cQty}>{it.quantity}</Text>
              <Text style={pdfStyles.cTotal}>{formatCurrency(it.lineTotal)}</Text>
            </View>
          ))}
        </View>

        <View style={pdfStyles.totalRow}>
          <View style={pdfStyles.totalBox}>
            <Text style={pdfStyles.totalLabel}>Total</Text>
            <Text style={pdfStyles.totalValue}>{formatCurrency(doc.total)}</Text>
          </View>
        </View>

        <Text style={pdfStyles.footer} fixed>
          Este documento es una representación de respaldo generada para el cliente. No reemplaza el documento tributario electrónico (DTE) oficial.
        </Text>
      </Page>
    </Document>
  );
}

async function buildBlob(doc: ClientDocument): Promise<string> {
  const blob = await pdf(<DocumentoPDFDocument doc={doc} />).toBlob();
  return URL.createObjectURL(blob);
}

export async function downloadDocumento(doc: ClientDocument) {
  const url = await buildBlob(doc);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${doc.tipoLabel.replace(/\s+/g, "-")}-${doc.numero}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export async function openDocumento(doc: ClientDocument) {
  const url = await buildBlob(doc);
  window.open(url, "_blank", "noopener");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

// ==========================================
// Viewer modal (on-screen document detail)
// ==========================================

export function DocumentViewerModal({ doc, onClose }: { doc: ClientDocument; onClose: () => void }) {
  const [busy, setBusy] = useState<"download" | "open" | null>(null);
  const isFactura = doc.kind === "factura";

  const run = async (kind: "download" | "open") => {
    try {
      setBusy(kind);
      if (kind === "download") await downloadDocumento(doc);
      else await openDocumento(doc);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 mt-[5vh] max-h-[88vh] overflow-hidden flex flex-col animate-in slide-in-from-top-4 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`px-5 py-4 flex items-center justify-between flex-shrink-0 ${isFactura ? "bg-gradient-to-r from-blue-600 to-indigo-700" : "bg-gradient-to-r from-emerald-600 to-teal-700"}`}>
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
              {isFactura ? <ReceiptText className="h-5 w-5 text-white" /> : <Truck className="h-5 w-5 text-white" />}
            </div>
            <div className="min-w-0">
              <h2 className="text-white font-bold text-lg truncate">{doc.tipoLabel} N° {doc.numero}</h2>
              <p className="text-white/80 text-xs">{formatDate(doc.fecha)}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white flex-shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {doc.cliente && (
            <p className="text-sm text-slate-600 mb-4">
              <span className="font-semibold text-slate-700">Cliente:</span> {doc.cliente}
              {doc.vendedor ? <span className="text-slate-400"> · Vendedor: {doc.vendedor}</span> : null}
            </p>
          )}

          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-50 px-4 py-2 flex items-center text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              <span className="flex-[4]">Producto</span>
              <span className="flex-1 text-right">Cant.</span>
              <span className="flex-[2] text-right">Importe</span>
            </div>
            <div className="divide-y divide-slate-100 max-h-[40vh] overflow-y-auto">
              {doc.items.map((it, idx) => (
                <div key={idx} className="px-4 py-2.5 flex items-center text-sm">
                  <div className="flex-[4] min-w-0 pr-2">
                    <p className="text-slate-700 truncate">{it.productName}</p>
                    {it.sku && <p className="text-[10px] text-slate-400 font-mono">{it.sku}</p>}
                  </div>
                  <span className="flex-1 text-right text-slate-600">{it.quantity}</span>
                  <span className="flex-[2] text-right font-semibold text-slate-800">{formatCurrency(it.lineTotal)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end mt-4">
            <div className="bg-slate-900 text-white rounded-xl px-5 py-2.5 text-right">
              <p className="text-[10px] uppercase tracking-wider text-white/60">Total</p>
              <p className="text-xl font-black">{formatCurrency(doc.total)}</p>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-200 px-5 py-3 flex items-center justify-end gap-2 bg-slate-50 flex-shrink-0">
          <button
            onClick={() => run("open")}
            disabled={busy !== null}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
          >
            {busy === "open" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
            Abrir PDF
          </button>
          <button
            onClick={() => run("download")}
            disabled={busy !== null}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#FF6E23] hover:bg-[#E55E13] text-white text-sm font-bold disabled:opacity-50"
          >
            {busy === "download" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Descargar PDF
          </button>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// Document row (compact, reusable)
// ==========================================

export function DocumentRow({ doc, onView }: { doc: ClientDocument; onView: (d: ClientDocument) => void }) {
  const [downloading, setDownloading] = useState(false);
  const isFactura = doc.kind === "factura";

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setDownloading(true);
      await downloadDocumento(doc);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div
      onClick={() => onView(doc)}
      className="flex items-center gap-3 p-3.5 rounded-xl border border-slate-200 bg-white hover:border-orange-200 hover:shadow-sm transition-all cursor-pointer group"
    >
      <div className={`h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isFactura ? "bg-blue-50 text-blue-600" : "bg-emerald-50 text-emerald-600"}`}>
        {isFactura ? <ReceiptText className="h-5 w-5" /> : <Truck className="h-5 w-5" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-bold text-slate-800 truncate">{doc.tipoLabel} N° {doc.numero}</p>
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${isFactura ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"}`}>
            {isFactura ? "FACTURA" : "DESPACHO"}
          </span>
        </div>
        <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
          <Calendar className="h-3 w-3" /> {formatDate(doc.fecha)}
          <span className="text-slate-300">·</span>
          <Package className="h-3 w-3" /> {doc.items.length} ítem{doc.items.length !== 1 ? "s" : ""}
        </p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-sm font-black text-slate-800">{formatCurrency(doc.total)}</p>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={(e) => { e.stopPropagation(); onView(doc); }}
          className="p-2 rounded-lg text-slate-400 hover:text-orange-600 hover:bg-orange-50 transition-colors"
          title="Ver documento"
        >
          <Eye className="h-4 w-4" />
        </button>
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="p-2 rounded-lg text-slate-400 hover:text-orange-600 hover:bg-orange-50 transition-colors disabled:opacity-50"
          title="Descargar PDF"
        >
          {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

// ==========================================
// Standalone "Facturas y Despachos" view
// ==========================================

type DocFilter = "all" | "factura" | "despacho";

export default function ClientDocumentos() {
  const [filter, setFilter] = useState<DocFilter>("all");
  const [search, setSearch] = useState("");
  const [viewing, setViewing] = useState<ClientDocument | null>(null);

  const { data: erpData, isLoading } = useQuery<{ nvv: any[]; gdv: any[]; transactions: any[] }>({
    queryKey: ["/api/ecommerce/client/erp-orders"],
    queryFn: async () => {
      const res = await fetch(`/api/ecommerce/client/erp-orders`, { credentials: "include" });
      if (!res.ok) return { nvv: [], gdv: [], transactions: [] };
      return res.json();
    },
  });

  const facturas = useMemo(() => groupFacturas(erpData?.transactions || []), [erpData]);
  const despachos = useMemo(() => groupDespachos(erpData?.gdv || []), [erpData]);

  const allDocs = useMemo(() => {
    let docs: ClientDocument[] = [];
    if (filter === "all" || filter === "factura") docs = docs.concat(facturas);
    if (filter === "all" || filter === "despacho") docs = docs.concat(despachos);
    const q = search.trim().toLowerCase();
    if (q) {
      docs = docs.filter(
        (d) =>
          d.numero.toLowerCase().includes(q) ||
          d.tipoLabel.toLowerCase().includes(q) ||
          d.items.some((it) => it.productName.toLowerCase().includes(q) || (it.sku || "").toLowerCase().includes(q)),
      );
    }
    return docs.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
  }, [filter, search, facturas, despachos]);

  const facturasTotal = useMemo(() => facturas.reduce((s, d) => s + d.total, 0), [facturas]);

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-2xl p-6 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-20 -mt-20 blur-3xl" />
        <div className="relative z-10">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <FileDigit className="h-6 w-6 text-orange-400" />
            Facturas y Despachos
          </h2>
          <p className="text-slate-300 text-sm mt-1 max-w-2xl">
            Consultá, visualizá y descargá tus documentos de los últimos 12 meses en un solo lugar.
          </p>
        </div>
      </div>

      {/* Stat strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-100 bg-white shadow-sm p-5 flex items-center gap-4">
          <div className="p-2.5 rounded-xl bg-blue-50"><ReceiptText className="h-5 w-5 text-blue-600" /></div>
          <div>
            <p className="text-2xl font-bold text-slate-800">{facturas.length}</p>
            <p className="text-xs text-slate-500">Facturas / boletas</p>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white shadow-sm p-5 flex items-center gap-4">
          <div className="p-2.5 rounded-xl bg-emerald-50"><Truck className="h-5 w-5 text-emerald-600" /></div>
          <div>
            <p className="text-2xl font-bold text-slate-800">{despachos.length}</p>
            <p className="text-xs text-slate-500">Guías de despacho</p>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white shadow-sm p-5 flex items-center gap-4">
          <div className="p-2.5 rounded-xl bg-amber-50"><FileText className="h-5 w-5 text-amber-600" /></div>
          <div>
            <p className="text-2xl font-bold text-slate-800">{formatCurrency(facturasTotal)}</p>
            <p className="text-xs text-slate-500">Total facturado (12m)</p>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="inline-flex rounded-xl bg-slate-100 p-1 self-start">
          {([
            { key: "all", label: "Todos" },
            { key: "factura", label: "Facturas" },
            { key: "despacho", label: "Despachos" },
          ] as { key: DocFilter; label: string }[]).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                filter === tab.key ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="relative sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por N°, producto o SKU…"
            className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/15 focus:border-orange-400"
          />
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-orange-500" /></div>
      ) : allDocs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
          <FileText className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500">
            {search ? "No hay documentos que coincidan con tu búsqueda." : "Aún no tienes documentos registrados."}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {allDocs.map((doc) => (
            <DocumentRow key={doc.key} doc={doc} onView={setViewing} />
          ))}
        </div>
      )}

      {viewing && <DocumentViewerModal doc={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}
