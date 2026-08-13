import { useState, useMemo, Fragment, type ReactNode } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatCLP } from "@/lib/crm-seguimiento";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DollarSign, ChevronDown, ChevronRight, Users, FileText, Download, Percent, RotateCcw,
  Receipt, TrendingUp, Truck, Scale, BadgeDollarSign, SlidersHorizontal, Search, X,
  type LucideIcon,
} from "lucide-react";

// ─── Tipos ───
interface CommissionItem {
  salesperson: string;
  netRevenue: number;
  netCost: number;
  netMargin: number;
  netMarginPct: number;
  // Regularización del flete (tasa configurable, 4% por defecto)
  fleteObjetivo: number;
  fleteCobrado: number;
  fleteDeficit: number;
  marginAdjusted: number;
  marginAdjustedPct: number;
  lineCount: number;
  overriddenClientCount: number;
  commissionPct: number;
  commissionAmount: number;
  // Comisión sin el piso en 0: negativa = las NC se comieron el margen
  commissionRaw: number;
}
interface CommissionTotals {
  netRevenue: number; netMargin: number;
  fleteObjetivo: number; fleteCobrado: number; fleteDeficit: number;
  marginAdjusted: number; commissionAmount: number; commissionRaw: number;
}
interface CommissionSummary {
  startDate: string;
  endDate: string;
  items: CommissionItem[];
  totals: CommissionTotals;
}
interface DetailClient {
  client: string; revenue: number; cost: number; margin: number; lineCount: number;
  fleteCobrado: number; fleteObjetivo: number; fleteDeficit: number; marginAdjusted: number;
  overridePct: number | null; effectivePct: number;
  fleteOverridePct: number | null; fleteEffectivePct: number;
}
interface DetailDocument {
  document: string; numero: string; tido: string; isCreditNote: boolean;
  client: string; fecha: string;
  revenue: number; cost: number; margin: number; lineCount: number;
  fleteCobrado: number; fleteObjetivo: number; fleteDeficit: number; marginAdjusted: number;
  overridePct: number | null; effectivePct: number; clientPct: number | null;
  fleteOverridePct: number | null; fleteClientPct: number | null; fleteEffectivePct: number;
}
interface SalespersonDetail {
  salesperson: string; startDate: string; endDate: string;
  defaultPct: number; defaultFletePct: number;
  clients: DetailClient[]; documents: DetailDocument[];
}
interface ExportLine {
  fecha: string; tido: string; isCreditNote: boolean; document: string; numero: string;
  salesperson: string; client: string; sku: string; producto: string;
  cantidad: number; revenue: number; cost: number; margin: number; esFlete: boolean;
}
interface CommissionExport {
  startDate: string; endDate: string; defaultFletePct: number;
  summary: CommissionSummary;
  clients: (DetailClient & { salesperson: string })[];
  documents: (DetailDocument & { salesperson: string })[];
  lines: ExportLine[];
  linesTruncated: boolean;
  lineLimit: number;
}

// ─── Encabezado de columna con su explicación ───
// Cada columna del módulo dice de dónde sale su número: son cifras que terminan
// en una liquidación de sueldo, así que nadie debería tener que adivinar cómo
// se calcularon ni pedir que se las expliquen por correo.
const COL_HELP: Record<string, string> = {
  "Facturado neto": "Facturas (FCV) menos notas de crédito (NCV) del período. Solo mercadería: las líneas de flete se cuentan aparte.",
  "Venta neta": "Facturas (FCV) menos notas de crédito (NCV) del período. Solo mercadería: las líneas de flete se cuentan aparte.",
  "Facturado": "Facturas menos notas de crédito de este cliente en el período, sin las líneas de flete.",
  "Costo neto": "Costo de la mercadería vendida: cantidad × costo unitario de cada línea. Los conceptos (fletes, servicios, descuentos) no llevan costo.",
  "Costo": "Costo de la mercadería vendida: cantidad × costo unitario de cada línea. Los conceptos (fletes, servicios, descuentos) no llevan costo.",
  "Margen neto": "Facturado neto − Costo neto.",
  "Margen": "Facturado − Costo.",
  "Flete cobrado": "Lo que se le cobró al cliente por despacho (líneas de flete del documento).",
  "% Flete": "Porcentaje de la venta que la empresa asume como costo de despacho. Por defecto 4%, editable por cliente o por venta.",
  "Reg. flete": "Flete que absorbe la empresa. Por documento: objetivo (venta × % flete) − flete cobrado. Si el cliente pagó de más, el excedente no suma. En las notas de crédito devuelve la regularización en vez de castigar de nuevo.",
  "Margen ajustado": "Margen − Regularización de flete. Es la base sobre la que se calcula la comisión.",
  "% Comisión": "Porcentaje que se aplica. Manda el de la venta, si no el del cliente, y si no el del vendedor. En 0 no paga comisión.",
  "Comisión a pagar": "Se calcula documento por documento: margen ajustado × % efectivo de cada uno. Si el total da negativo se informa pero se paga 0, y no arrastra saldo al mes siguiente.",
};

function ColHead({ children, className }: { children: string; className?: string }) {
  const help = COL_HELP[children];
  if (!help) return <TableHead className={className}>{children}</TableHead>;
  return (
    <TableHead className={className}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="cursor-help border-b border-dotted border-slate-400 dark:border-slate-500">{children}</span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-xs leading-relaxed">{help}</TooltipContent>
      </Tooltip>
    </TableHead>
  );
}

// ─── Hoja de liquidación por vendedor (formato que usa Finanzas) ───
// Todo va en FÓRMULAS, no en valores calculados: finanzas edita el % de flete,
// el % de comisión o los festivos del mes y la planilla recalcula sola. Los
// parámetros editables van en amarillo, igual que en la planilla que ya usan.
//
// La regularización de flete se aplica DOCUMENTO A DOCUMENTO, con el piso
// espejado de las notas de crédito (factura: nunca acredita; NC: nunca
// castiga), que es como lo calcula el módulo. Sumar primero y aplicar el piso
// al total daría otro número.
function buildLiquidacionSheet(
  XLSX: any,
  salesperson: string,
  docs: DetailDocument[],
  startDate: string,
  endDate: string,
  commissionPct: number,
) {
  const rows: any[][] = [];
  const fmtNum = "#,##0";

  rows.push(["PINTURERIA PANORAMICA LTDA."]);
  rows.push([salesperson]);
  rows.push([`Período: ${formatFecha(startDate)} al ${formatFecha(endDate)}`]);
  rows.push([]);
  rows.push(["Tipo", "Documento", "Fecha", "Cliente", "Venta neta", "Costo", "Margen",
             "Flete cobrado", "% Flete", "Flete objetivo", "Reg. flete", "Margen ajustado"]);

  const first = rows.length + 1; // 1-indexed para las fórmulas
  for (const d of docs) {
    const r = rows.length + 1;
    rows.push([
      d.tido,
      d.numero,
      formatFecha(d.fecha),
      d.client,
      Math.round(d.revenue),
      Math.round(d.cost),
      { f: `E${r}-F${r}`, z: fmtNum },
      Math.round(d.fleteCobrado),
      d.fleteEffectivePct,
      { f: `E${r}*I${r}/100`, z: fmtNum },
      // Piso espejado: la NC devuelve la regularización, nunca vuelve a castigar
      { f: `IF(E${r}>=0,MAX(0,J${r}-H${r}),MIN(0,J${r}-H${r}))`, z: fmtNum },
      { f: `G${r}-K${r}`, z: fmtNum },
    ]);
  }
  const last = rows.length;
  const sum = (col: string) => ({ f: `SUM(${col}${first}:${col}${last})`, z: fmtNum });

  rows.push(["TOTAL", "", "", "", sum("E"), sum("F"), sum("G"), sum("H"), "", sum("J"), sum("K"), sum("L")]);
  const totalRow = rows.length;
  rows.push([]);

  const label = (t: string, cell: any, note?: string) => {
    rows.push(["", "", "", t, cell, note || ""]);
    return rows.length;
  };

  const rVenta  = label("Venta neta",      { f: `E${totalRow}`, z: fmtNum });
  const rCosto  = label("Costo",           { f: `F${totalRow}`, z: fmtNum });
  const rMargen = label("Margen",          { f: `G${totalRow}`, z: fmtNum });
  label("% Margen", { f: `IF(E${rVenta}=0,0,E${rMargen}/E${rVenta})`, z: "0.0%" });
  const rReg    = label("Regularización flete", { f: `K${totalRow}`, z: fmtNum }, "suma del déficit documento a documento");
  const rMajus  = label("Margen ajustado", { f: `E${rMargen}-E${rReg}`, z: fmtNum }, "base de la comisión");
  rows.push([]);

  const rPct    = label("% Comisión", commissionPct, "editable");
  const rCom    = label("Comisión",   { f: `E${rMajus}*E${rPct}/100`, z: fmtNum });
  rows.push([]);

  // Semana corrida (Art. 45 del Código del Trabajo): el promedio diario de lo
  // devengado se paga por cada domingo y festivo del período. Los festivos van
  // a mano — son legales, cambian cada año y varios se trasladan.
  const d0 = new Date(startDate + "T00:00:00");
  const d1 = new Date(endDate + "T00:00:00");
  let dias = 0, domingos = 0, sabados = 0;
  for (const d = new Date(d0); d <= d1; d.setDate(d.getDate() + 1)) {
    dias++;
    if (d.getDay() === 0) domingos++;
    if (d.getDay() === 6) sabados++;
  }
  rows.push(["", "", "", "SEMANA CORRIDA (Art. 45 C. del Trabajo)"]);
  const rDias = label("Días del período",   dias);
  const rDom  = label("Domingos",           domingos);
  const rSab  = label("Sábados no laborables", sabados, "0 si la jornada incluye el sábado");
  // Dos casillas distintas a propósito. Un festivo que cae sábado o domingo ya
  // está descontado del divisor: volver a restarlo lo descuenta dos veces. Pero
  // sí suma al multiplicador, porque igual es un día que se paga.
  const rFerH = label("Festivos en día laborable", 0, "editable — solo los que caen de lunes a viernes");
  const rFer  = label("Festivos del período",      0, "editable — todos los feriados legales del mes");
  const rLab  = label("Días laborables",    { f: `E${rDias}-E${rDom}-E${rSab}-E${rFerH}` }, "divisor");
  const rDF   = label("Domingos + festivos", { f: `E${rDom}+E${rFer}` }, "multiplicador");
  const rSC   = label("Semana corrida", { f: `IF(E${rLab}=0,0,E${rCom}/E${rLab}*E${rDF})`, z: fmtNum });
  rows.push([]);
  const rTot  = label("TOTAL A PAGAR", { f: `E${rCom}+E${rSC}`, z: fmtNum });
  rows.push([]);
  rows.push([]);
  rows.push(["", "", "", "FIRMA TRABAJADOR", "", "FIRMA EMPLEADOR"]);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 6 }, { wch: 12 }, { wch: 12 }, { wch: 34 }, { wch: 16 },
                 { wch: 30 }, { wch: 14 }, { wch: 14 }, { wch: 9 }, { wch: 14 },
                 { wch: 14 }, { wch: 16 }];
  // Amarillo en lo que finanzas puede editar: % de flete por documento,
  // % de comisión, sábados y festivos.
  const editables = [`E${rPct}`, `E${rSab}`, `E${rFerH}`, `E${rFer}`];
  for (let r = first; r <= last; r++) editables.push(`I${r}`);
  for (const ref of editables) {
    if (!ws[ref]) continue;
    ws[ref].s = { fill: { fgColor: { rgb: "FFFF00" } } };
  }
  for (const ref of [`E${rTot}`, `E${rCom}`, `E${rSC}`]) {
    if (ws[ref]) ws[ref].s = { font: { bold: true } };
  }
  return ws;
}

// ─── Helpers de fecha ───
function pad(n: number) { return String(n).padStart(2, "0"); }
function isoDate(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function currentMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { startDate: isoDate(start), endDate: isoDate(end) };
}
function lastMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const end = new Date(now.getFullYear(), now.getMonth(), 0);
  return { startDate: isoDate(start), endDate: isoDate(end) };
}
function yearRange() {
  const now = new Date();
  return { startDate: `${now.getFullYear()}-01-01`, endDate: isoDate(now) };
}
function formatFecha(s: string | null | undefined) {
  if (!s) return "—";
  const d = new Date(s);
  if (isNaN(d.getTime())) return String(s).slice(0, 10);
  return d.toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function Comisiones() {
  const { toast } = useToast();
  const [{ startDate, endDate }, setRange] = useState(currentMonthRange());
  const [expanded, setExpanded] = useState<string | null>(null);
  // Buffer local del % que se está editando por vendedor
  const [pctDraft, setPctDraft] = useState<Record<string, string>>({});

  const summaryKey = ["/api/hr/commissions/summary", startDate, endDate] as const;
  const { data: summary, isLoading } = useQuery<CommissionSummary>({
    queryKey: summaryKey,
    queryFn: async () => {
      const res = await fetch(
        `/api/hr/commissions/summary?startDate=${startDate}&endDate=${endDate}`,
        { credentials: "include" },
      );
      if (!res.ok) throw new Error("No se pudo cargar el resumen de comisiones");
      return res.json();
    },
  });

  const savePct = useMutation({
    mutationFn: async ({ salespersonName, commissionPct }: { salespersonName: string; commissionPct: number }) => {
      const res = await apiRequest("PUT", "/api/hr/commissions/settings", { salespersonName, commissionPct });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hr/commissions/summary"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e?.message || "No se pudo guardar el %", variant: "destructive" }),
  });

  const saveOverride = useMutation({
    mutationFn: async (payload: {
      salespersonName: string; overrideType: "client" | "document"; value: string; commissionPct: number | null;
    }) => {
      const res = await apiRequest("PUT", "/api/hr/commissions/overrides", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hr/commissions/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hr/commissions/salesperson"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e?.message || "No se pudo guardar el %", variant: "destructive" }),
  });

  // Tasa de regularización de flete por cliente o por venta (global, no por
  // vendedor: el flete depende del destino del despacho).
  const saveFleteRate = useMutation({
    mutationFn: async (payload: { scope: "client" | "document"; value: string; fletePct: number | null }) => {
      const res = await apiRequest("PUT", "/api/hr/commissions/flete-rates", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hr/commissions/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hr/commissions/salesperson"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e?.message || "No se pudo guardar la tasa de flete", variant: "destructive" }),
  });

  const items = summary?.items || [];

  const commitPct = (salesperson: string, current: number) => {
    const raw = pctDraft[salesperson];
    if (raw === undefined) return;
    const value = parseFloat(raw.replace(",", "."));
    setPctDraft((prev) => { const p = { ...prev }; delete p[salesperson]; return p; });
    if (isNaN(value) || value < 0 || value > 100) {
      toast({ title: "Porcentaje inválido", description: "Ingresa un valor entre 0 y 100", variant: "destructive" });
      return;
    }
    if (value === current) return;
    savePct.mutate({ salespersonName: salesperson, commissionPct: value });
  };

  // Export a Excel: pide al servidor el volcado completo del período y arma un
  // libro con Resumen + Clientes + Documentos + Líneas.
  const [exporting, setExporting] = useState(false);
  const exportExcel = async () => {
    if (!items.length || exporting) return;
    setExporting(true);
    try {
      const res = await fetch(
        `/api/hr/commissions/export?startDate=${startDate}&endDate=${endDate}`,
        { credentials: "include" },
      );
      if (!res.ok) throw new Error("No se pudo generar la exportación");
      const data: CommissionExport = await res.json();
      const XLSX = await import("xlsx");
      const round = (n: number) => Math.round(n);
      const wb = XLSX.utils.book_new();

      // Hoja 1 — Resumen por vendedor
      const resumen = data.summary.items.map((it) => ({
        "Vendedor": it.salesperson,
        "Facturado neto (FCV − NCV)": round(it.netRevenue),
        "Costo neto": round(it.netCost),
        "Margen neto": round(it.netMargin),
        "% Margen": Number(it.netMarginPct.toFixed(2)),
        "Flete cobrado": round(it.fleteCobrado),
        "Flete objetivo": round(it.fleteObjetivo),
        "Regularización flete": round(it.fleteDeficit),
        "Margen ajustado": round(it.marginAdjusted),
        "% Comisión": it.commissionPct,
        "Comisión calculada": round(it.commissionRaw),
        "Comisión a pagar": round(it.commissionAmount),
      }));
      const t = data.summary.totals;
      resumen.push({
        "Vendedor": "TOTAL",
        "Facturado neto (FCV − NCV)": round(t.netRevenue),
        "Costo neto": round(t.netRevenue - t.netMargin),
        "Margen neto": round(t.netMargin),
        "% Margen": t.netRevenue !== 0 ? Number(((t.netMargin / t.netRevenue) * 100).toFixed(2)) : 0,
        "Flete cobrado": round(t.fleteCobrado),
        "Flete objetivo": round(t.fleteObjetivo),
        "Regularización flete": round(t.fleteDeficit),
        "Margen ajustado": round(t.marginAdjusted),
        "% Comisión": "",
        "Comisión calculada": round(t.commissionRaw),
        "Comisión a pagar": round(t.commissionAmount),
      } as any);
      const wsResumen = XLSX.utils.json_to_sheet(resumen);
      wsResumen["!cols"] = [{ wch: 28 }, { wch: 24 }, { wch: 14 }, { wch: 14 }, { wch: 10 },
        { wch: 14 }, { wch: 14 }, { wch: 18 }, { wch: 16 }, { wch: 12 }, { wch: 18 }, { wch: 16 }];
      XLSX.utils.book_append_sheet(wb, wsResumen, "Resumen");

      // Hoja 2 — Clientes de cada vendedor
      const wsClientes = XLSX.utils.json_to_sheet(data.clients.map((c) => ({
        "Vendedor": c.salesperson,
        "Cliente": c.client,
        "Facturado neto": round(c.revenue),
        "Costo": round(c.cost),
        "Margen": round(c.margin),
        "Flete cobrado": round(c.fleteCobrado),
        "% Flete": c.fleteEffectivePct,
        "Flete objetivo": round(c.fleteObjetivo),
        "Regularización flete": round(c.fleteDeficit),
        "Margen ajustado": round(c.marginAdjusted),
        "% Comisión": c.effectivePct,
        "Comisión": round(c.marginAdjusted * c.effectivePct / 100),
        "Líneas": c.lineCount,
      })));
      wsClientes["!cols"] = [{ wch: 28 }, { wch: 34 }, { wch: 16 }, { wch: 14 }, { wch: 14 },
        { wch: 14 }, { wch: 9 }, { wch: 14 }, { wch: 18 }, { wch: 16 }, { wch: 12 }, { wch: 14 }, { wch: 8 }];
      XLSX.utils.book_append_sheet(wb, wsClientes, "Clientes");

      // Hoja 3 — Documento por documento (facturas y notas de crédito)
      const wsDocs = XLSX.utils.json_to_sheet(data.documents.map((d) => ({
        "Vendedor": d.salesperson,
        "Tipo": d.tido,
        "Documento": d.numero,
        "Fecha": formatFecha(d.fecha),
        "Cliente": d.client,
        "Neto": round(d.revenue),
        "Costo": round(d.cost),
        "Margen": round(d.margin),
        "Flete cobrado": round(d.fleteCobrado),
        "% Flete": d.fleteEffectivePct,
        "Flete objetivo": round(d.fleteObjetivo),
        "Regularización flete": round(d.fleteDeficit),
        "Margen ajustado": round(d.marginAdjusted),
        "% Comisión": d.effectivePct,
        "Comisión": round(d.marginAdjusted * d.effectivePct / 100),
        "Líneas": d.lineCount,
      })));
      wsDocs["!cols"] = [{ wch: 28 }, { wch: 7 }, { wch: 12 }, { wch: 12 }, { wch: 34 },
        { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 9 }, { wch: 14 },
        { wch: 18 }, { wch: 16 }, { wch: 12 }, { wch: 14 }, { wch: 8 }];
      XLSX.utils.book_append_sheet(wb, wsDocs, "Documentos");

      // Hoja 4 — Detalle línea a línea
      const wsLineas = XLSX.utils.json_to_sheet(data.lines.map((l) => ({
        "Fecha": formatFecha(l.fecha),
        "Tipo": l.tido,
        "Documento": l.numero,
        "Vendedor": l.salesperson,
        "Cliente": l.client,
        "SKU": l.sku,
        "Producto": l.producto,
        "Es flete": l.esFlete ? "Sí" : "",
        "Cantidad": l.cantidad,
        "Neto": round(l.revenue),
        "Costo": round(l.cost),
        "Margen": round(l.margin),
      })));
      wsLineas["!cols"] = [{ wch: 12 }, { wch: 7 }, { wch: 12 }, { wch: 28 }, { wch: 34 },
        { wch: 14 }, { wch: 40 }, { wch: 9 }, { wch: 11 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];
      XLSX.utils.book_append_sheet(wb, wsLineas, "Líneas");

      // Hoja de liquidación por vendedor — el documento que firma finanzas.
      // Nombre corto y único: Excel corta en 31 caracteres y no admite repetidos.
      const usados = new Set<string>();
      for (const it of data.summary.items) {
        const docsVendedor = data.documents.filter((d) => d.salesperson === it.salesperson);
        if (!docsVendedor.length) continue;
        let nombre = `L. ${it.salesperson}`.slice(0, 31);
        let n = 2;
        while (usados.has(nombre)) nombre = `${`L. ${it.salesperson}`.slice(0, 28)} ${n++}`;
        usados.add(nombre);
        XLSX.utils.book_append_sheet(
          wb,
          buildLiquidacionSheet(XLSX, it.salesperson, docsVendedor, data.startDate, data.endDate, it.commissionPct),
          nombre,
        );
      }

      XLSX.writeFile(wb, `comisiones_${startDate}_${endDate}.xlsx`);

      if (data.linesTruncated) {
        toast({
          title: "Detalle de líneas recortado",
          description: `El período supera las ${data.lineLimit.toLocaleString("es-CL")} líneas: la hoja "Líneas" trae solo las más recientes. Las otras tres hojas están completas.`,
        });
      }
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "No se pudo exportar", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const activePreset = useMemo(() => {
    const cm = currentMonthRange(), lm = lastMonthRange(), yr = yearRange();
    if (startDate === cm.startDate && endDate === cm.endDate) return "current";
    if (startDate === lm.startDate && endDate === lm.endDate) return "last";
    if (startDate === yr.startDate && endDate === yr.endDate) return "year";
    return "custom";
  }, [startDate, endDate]);

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="w-11 h-11 rounded-xl bg-gradient-to-br from-orange-500 to-[#fd6301] text-white flex items-center justify-center flex-shrink-0 shadow-md shadow-orange-500/25">
            <DollarSign className="w-6 h-6" />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Comisiones de Vendedores</h1>
            <p className="text-sm text-muted-foreground">
              Comisión sobre el margen de lo facturado neto de devoluciones (FCV − NCV), tras regularizar el flete que asume la empresa.
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={exportExcel} disabled={!items.length || exporting}
          className="border-orange-200 text-orange-700 hover:bg-orange-50 hover:text-orange-800 dark:border-orange-900/60 dark:text-orange-300 dark:hover:bg-orange-950/40">
          <Download className="w-4 h-4 mr-2" /> {exporting ? "Generando…" : "Exportar Excel"}
        </Button>
      </div>

      {/* Selector de período */}
      <Card className="rounded-2xl border-slate-200/70 dark:border-slate-800 shadow-sm">
        <CardContent className="py-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="inline-flex gap-1.5 bg-slate-100/70 dark:bg-slate-800/60 p-1.5 rounded-2xl border border-slate-200/60 dark:border-slate-700/60">
              <PresetButton active={activePreset === "current"} onClick={() => setRange(currentMonthRange())}>Mes actual</PresetButton>
              <PresetButton active={activePreset === "last"} onClick={() => setRange(lastMonthRange())}>Mes anterior</PresetButton>
              <PresetButton active={activePreset === "year"} onClick={() => setRange(yearRange())}>Este año</PresetButton>
            </div>
            <div className="flex items-end gap-2 ml-auto">
              <div>
                <label className="text-xs text-slate-500 block mb-1">Desde</label>
                <Input type="date" value={startDate} className="w-40"
                  onChange={(e) => setRange((r) => ({ ...r, startDate: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1">Hasta</label>
                <Input type="date" value={endDate} className="w-40"
                  onChange={(e) => setRange((r) => ({ ...r, endDate: e.target.value }))} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard icon={Receipt} label="Facturado neto (base)" value={formatCLP(summary?.totals.netRevenue)} loading={isLoading} accent="orange" />
        <KpiCard icon={TrendingUp} label="Margen neto total" value={formatCLP(summary?.totals.netMargin)} loading={isLoading} />
        <KpiCard icon={Truck} label="Regularización flete (4%)" value={formatCLP(summary?.totals.fleteDeficit)} loading={isLoading}
          sub={summary ? `Cobrado ${formatCLP(summary.totals.fleteCobrado)} · objetivo ${formatCLP(summary.totals.fleteObjetivo)}` : undefined}
          accent="amber" showMinus />
        <KpiCard icon={Scale} label="Margen ajustado (base comisión)" value={formatCLP(summary?.totals.marginAdjusted)} loading={isLoading} />
        <KpiCard icon={BadgeDollarSign} label="Comisión total a pagar" value={formatCLP(summary?.totals.commissionAmount)} loading={isLoading}
          accent="emerald" />
      </div>

      {/* Tabla principal */}
      <Card className="rounded-2xl border-slate-200/70 dark:border-slate-800 shadow-sm overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4 text-orange-600" />
            Vendedores
            <span className="text-xs font-medium text-orange-700 bg-orange-50 border border-orange-200 rounded-full px-2 py-0.5 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-900/60">
              {items.length}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0 sm:px-2">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Vendedor</TableHead>
                  <ColHead className="text-right">Facturado neto</ColHead>
                  <ColHead className="text-right">Costo neto</ColHead>
                  <ColHead className="text-right">Margen neto</ColHead>
                  <ColHead className="text-right">Flete cobrado</ColHead>
                  <ColHead className="text-right">Reg. flete</ColHead>
                  <ColHead className="text-right">Margen ajustado</ColHead>
                  <ColHead className="text-right w-28">% Comisión</ColHead>
                  <ColHead className="text-right">Comisión a pagar</ColHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={10}><Skeleton className="h-8 w-full" /></TableCell>
                    </TableRow>
                  ))
                )}
                {!isLoading && items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-slate-500 py-10">
                      No hay ventas facturadas en el período seleccionado.
                    </TableCell>
                  </TableRow>
                )}
                {!isLoading && items.map((it) => {
                  const isOpen = expanded === it.salesperson;
                  const draft = pctDraft[it.salesperson];
                  return (
                    <Fragment key={it.salesperson}>
                      <TableRow
                        className={`cursor-pointer transition-colors ${isOpen ? "bg-orange-50/60 dark:bg-orange-950/20" : "hover:bg-orange-50/50 dark:hover:bg-orange-950/15"}`}
                        onClick={() => setExpanded(isOpen ? null : it.salesperson)}>
                        <TableCell>
                          {isOpen ? <ChevronDown className="w-4 h-4 text-orange-500" />
                            : <ChevronRight className="w-4 h-4 text-slate-400" />}
                        </TableCell>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span>{it.salesperson}</span>
                            {it.overriddenClientCount > 0 && (
                              <TooltipProvider delayDuration={100}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Badge
                                      variant="outline"
                                      onClick={(e) => { e.stopPropagation(); setExpanded(isOpen ? null : it.salesperson); }}
                                      className="gap-1 cursor-help border-orange-300 bg-orange-50 text-orange-700 font-medium hover:bg-orange-100 dark:border-orange-800 dark:bg-orange-950/40 dark:text-orange-300"
                                    >
                                      <SlidersHorizontal className="w-3 h-3" />
                                      {it.overriddenClientCount} {it.overriddenClientCount === 1 ? "cliente con % especial" : "clientes con % especial"}
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-xs text-center">
                                    <p>
                                      {it.overriddenClientCount === 1
                                        ? "Uno de sus clientes tiene un % de comisión distinto al general de este vendedor"
                                        : `${it.overriddenClientCount} de sus clientes tienen un % de comisión distinto al general de este vendedor`}
                                      {" "}({it.commissionPct}%). No es un error: es un ajuste manual. Abre la fila para verlo.
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className={`text-right tabular-nums ${it.netRevenue < 0 ? "text-rose-600 font-medium" : ""}`}>{formatCLP(it.netRevenue)}</TableCell>
                        <TableCell className="text-right tabular-nums text-slate-500">{formatCLP(it.netCost)}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCLP(it.netMargin)}
                          <span className="text-xs text-slate-400 ml-1">({it.netMarginPct.toFixed(1)}%)</span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-slate-500">{formatCLP(it.fleteCobrado)}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          <FleteDeficit value={it.fleteDeficit} />
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-medium">
                          {formatCLP(it.marginAdjusted)}
                          <span className="text-xs text-slate-400 ml-1">({it.marginAdjustedPct.toFixed(1)}%)</span>
                        </TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="relative inline-flex items-center">
                            <Input
                              type="number" min={0} max={100} step={0.1}
                              value={draft !== undefined ? draft : String(it.commissionPct)}
                              className="w-20 h-8 text-right pr-5 tabular-nums"
                              onChange={(e) => setPctDraft((p) => ({ ...p, [it.salesperson]: e.target.value }))}
                              onBlur={() => commitPct(it.salesperson, it.commissionPct)}
                              onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                            />
                            <Percent className="w-3 h-3 text-slate-400 absolute right-1.5 pointer-events-none" />
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums text-emerald-600">
                          {it.commissionRaw < 0 ? (
                            <TooltipProvider delayDuration={100}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="inline-flex items-center gap-1 cursor-help text-slate-400">
                                    {formatCLP(0)}
                                    <Badge variant="outline" className="border-rose-300 bg-rose-50 text-rose-700 text-[10px] px-1.5 py-0 font-medium dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
                                      NC
                                    </Badge>
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs text-center">
                                  <p>
                                    Las notas de crédito del período superan a las ventas: la comisión calculada da
                                    {" "}{formatCLP(it.commissionRaw)}. Se paga 0 y no arrastra saldo en contra al mes siguiente.
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ) : formatCLP(it.commissionAmount)}
                        </TableCell>
                      </TableRow>
                      {isOpen && (
                        <TableRow>
                          <TableCell colSpan={10} className="bg-slate-50/60 dark:bg-slate-900/40 p-0">
                            <SalespersonDetailPanel
                              salesperson={it.salesperson}
                              startDate={startDate}
                              endDate={endDate}
                              onSaveOverride={(overrideType, value, commissionPct) =>
                                saveOverride.mutate({ salespersonName: it.salesperson, overrideType, value, commissionPct })}
                              onSaveFleteRate={(scope, value, fletePct) =>
                                saveFleteRate.mutate({ scope, value, fletePct })}
                            />
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
              </TableBody>
              {!isLoading && items.length > 0 && (
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={2} className="font-semibold">Total</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{formatCLP(summary?.totals.netRevenue)}</TableCell>
                    <TableCell></TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{formatCLP(summary?.totals.netMargin)}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums text-slate-500">{formatCLP(summary?.totals.fleteCobrado)}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      <FleteDeficit value={summary?.totals.fleteDeficit || 0} />
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{formatCLP(summary?.totals.marginAdjusted)}</TableCell>
                    <TableCell></TableCell>
                    <TableCell className="text-right font-bold tabular-nums text-emerald-600">
                      {formatCLP(summary?.totals.commissionAmount)}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              )}
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Botón de preset de período con el look pill/naranja de Panorámica.
function PresetButton({ active, onClick, children }: {
  active: boolean; onClick: () => void; children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-1.5 text-sm font-semibold rounded-xl transition-all duration-200 ${
        active
          ? "bg-white text-orange-600 shadow-sm dark:bg-slate-900"
          : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
      }`}
    >
      {children}
    </button>
  );
}

type KpiAccent = "slate" | "emerald" | "amber" | "orange";

const KPI_ACCENTS: Record<KpiAccent, {
  card: string; iconWrap: string; icon: string; value: string;
}> = {
  slate: {
    card: "border-slate-200 dark:border-slate-800",
    iconWrap: "bg-slate-100 dark:bg-slate-800",
    icon: "text-slate-500",
    value: "text-slate-900 dark:text-white",
  },
  orange: {
    card: "border-orange-200 bg-orange-50/40 dark:border-orange-900/50 dark:bg-orange-950/10",
    iconWrap: "bg-gradient-to-br from-orange-500 to-[#fd6301] shadow-sm shadow-orange-500/25",
    icon: "text-white",
    value: "text-slate-900 dark:text-white",
  },
  emerald: {
    card: "border-emerald-300 bg-emerald-50/50 dark:border-emerald-800/60 dark:bg-emerald-900/10",
    iconWrap: "bg-emerald-500/15",
    icon: "text-emerald-600",
    value: "text-emerald-600",
  },
  amber: {
    card: "border-amber-300 bg-amber-50/50 dark:border-amber-800/60 dark:bg-amber-900/10",
    iconWrap: "bg-amber-500/15",
    icon: "text-amber-600",
    value: "text-amber-600",
  },
};

function KpiCard({ icon: Icon, label, value, loading, accent = "slate", showMinus, sub }: {
  icon?: LucideIcon; label: string; value: string; loading?: boolean;
  accent?: KpiAccent; showMinus?: boolean; sub?: string;
}) {
  const a = KPI_ACCENTS[accent];
  const displayValue = showMinus && value !== "$0" && value !== "—" ? `− ${value}` : value;
  return (
    <Card className={`rounded-2xl shadow-sm ${a.card}`}>
      <CardContent className="py-4">
        <div className="flex items-center gap-2 mb-2">
          {Icon && (
            <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${a.iconWrap}`}>
              <Icon className={`w-4 h-4 ${a.icon}`} />
            </span>
          )}
          <p className="text-xs font-medium text-slate-500 leading-tight">{label}</p>
        </div>
        {loading ? <Skeleton className="h-8 w-32" />
          : <p className={`text-2xl font-bold tabular-nums ${a.value}`}>{displayValue}</p>}
        {sub && !loading && <p className="text-[11px] text-slate-400 mt-1 leading-tight">{sub}</p>}
      </CardContent>
    </Card>
  );
}

// Regularización de flete: castiga el margen (rojo) en las facturas y lo
// devuelve (verde) en las notas de crédito.
function FleteDeficit({ value }: { value: number }) {
  if (value > 0) return <span className="text-rose-600">− {formatCLP(value)}</span>;
  if (value < 0) return <span className="text-emerald-600">+ {formatCLP(Math.abs(value))}</span>;
  return <span className="text-slate-300">—</span>;
}

// Celda editable de tasa de flete (%) por cliente o por venta. Sin ajuste
// manual muestra el valor por defecto en gris; con ajuste, resaltado y con
// botón para volver al default.
function FletePctCell({ value, isOverride, onSave, onReset }: {
  value: number; isOverride: boolean;
  onSave: (pct: number) => void; onReset: () => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft !== null ? draft : String(value);
  const commit = () => {
    if (draft === null) return;
    const raw = draft;
    setDraft(null);
    const v = parseFloat(raw.replace(",", "."));
    if (isNaN(v) || v < 0 || v > 100) return;
    if (v === value && !isOverride) return;
    onSave(v);
  };
  return (
    <div className="inline-flex items-center gap-1 justify-end">
      <div className="relative inline-flex items-center">
        <Input
          type="number" min={0} max={100} step={0.1}
          value={shown}
          title="Tasa de flete que asume la empresa sobre el neto de este documento"
          className={`w-16 h-8 text-right pr-5 tabular-nums ${isOverride ? "border-sky-400 text-sky-700 dark:text-sky-400 font-semibold" : "text-slate-500"}`}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
        />
        <Percent className="w-3 h-3 text-slate-400 absolute right-1.5 pointer-events-none" />
      </div>
      <button
        type="button"
        onClick={onReset}
        title="Volver a la tasa de flete por defecto"
        className={`text-slate-300 hover:text-sky-600 transition-opacity ${isOverride ? "opacity-100" : "opacity-0 pointer-events-none"}`}
      >
        <RotateCcw className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// Celda editable de % de comisión por fila. `value` es el % efectivo que se
// aplica; `isOverride` indica si viene de un ajuste manual (para resaltarlo y
// ofrecer "revertir" al % por defecto). Poner 0 = no paga comisión.
function PctCell({ value, isOverride, onSave, onReset }: {
  value: number; isOverride: boolean;
  onSave: (pct: number) => void; onReset: () => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft !== null ? draft : String(value);
  const commit = () => {
    if (draft === null) return;
    const raw = draft;
    setDraft(null);
    const v = parseFloat(raw.replace(",", "."));
    if (isNaN(v) || v < 0 || v > 100) return; // valor inválido: se descarta
    if (v === value && !isOverride) return;   // sin cambios respecto al efectivo
    onSave(v);
  };
  return (
    <div className="inline-flex items-center gap-1.5 justify-end">
      {isOverride && (
        <Badge variant="outline" className="hidden sm:inline-flex border-orange-300 bg-orange-50 text-orange-700 text-[10px] px-1.5 py-0 font-medium dark:border-orange-800 dark:bg-orange-950/40 dark:text-orange-300">
          especial
        </Badge>
      )}
      <div className="relative inline-flex items-center">
        <Input
          type="number" min={0} max={100} step={0.1}
          value={shown}
          className={`w-20 h-8 text-right pr-5 tabular-nums ${isOverride ? "border-orange-400 text-orange-700 dark:text-orange-400 font-semibold" : ""}`}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
        />
        <Percent className="w-3 h-3 text-slate-400 absolute right-1.5 pointer-events-none" />
      </div>
      <button
        type="button"
        onClick={onReset}
        title="Volver al % por defecto del vendedor"
        className={`text-slate-300 hover:text-orange-600 transition-opacity ${isOverride ? "opacity-100" : "opacity-0 pointer-events-none"}`}
      >
        <RotateCcw className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function SalespersonDetailPanel({ salesperson, startDate, endDate, onSaveOverride, onSaveFleteRate }: {
  salesperson: string; startDate: string; endDate: string;
  onSaveOverride: (type: "client" | "document", value: string, commissionPct: number | null) => void;
  onSaveFleteRate: (scope: "client" | "document", value: string, fletePct: number | null) => void;
}) {
  const [tab, setTab] = useState<"clients" | "documents">("clients");
  const [search, setSearch] = useState("");
  const { data, isLoading } = useQuery<SalespersonDetail>({
    queryKey: ["/api/hr/commissions/salesperson", salesperson, startDate, endDate],
    queryFn: async () => {
      const res = await fetch(
        `/api/hr/commissions/salesperson/${encodeURIComponent(salesperson)}?startDate=${startDate}&endDate=${endDate}`,
        { credentials: "include" },
      );
      if (!res.ok) throw new Error("No se pudo cargar el detalle");
      return res.json();
    },
  });

  // Filtro en vivo: por cliente en ambas pestañas, y además por N° de
  // documento y tipo (FCV/NCV) en la de ventas.
  const needle = search.trim().toLowerCase();
  const clients = useMemo(() => {
    if (!data) return [];
    if (!needle) return data.clients;
    return data.clients.filter((c) => c.client.toLowerCase().includes(needle));
  }, [data, needle]);
  const documents = useMemo(() => {
    if (!data) return [];
    if (!needle) return data.documents;
    return data.documents.filter((d) =>
      d.client.toLowerCase().includes(needle)
      || d.numero.toLowerCase().includes(needle)
      || d.tido.toLowerCase().includes(needle));
  }, [data, needle]);
  const shownCount = tab === "clients" ? clients.length : documents.length;
  const totalCount = tab === "clients" ? (data?.clients.length ?? 0) : (data?.documents.length ?? 0);

  return (
    <div className="p-4">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="inline-flex gap-1.5 bg-slate-100/70 dark:bg-slate-800/60 p-1.5 rounded-2xl border border-slate-200/60 dark:border-slate-700/60">
          <button type="button" onClick={() => setTab("clients")}
            className={`inline-flex items-center px-4 py-1.5 text-sm font-semibold rounded-xl transition-all duration-200 ${tab === "clients" ? "bg-white text-orange-600 shadow-sm dark:bg-slate-900" : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"}`}>
            <Users className="w-4 h-4 mr-1.5" /> Clientes ({data?.clients.length ?? 0})
          </button>
          <button type="button" onClick={() => setTab("documents")}
            className={`inline-flex items-center px-4 py-1.5 text-sm font-semibold rounded-xl transition-all duration-200 ${tab === "documents" ? "bg-white text-orange-600 shadow-sm dark:bg-slate-900" : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"}`}>
            <FileText className="w-4 h-4 mr-1.5" /> Ventas ({data?.documents.length ?? 0})
          </button>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tab === "clients" ? "Buscar cliente…" : "Buscar cliente o N° de documento…"}
            className="h-9 pl-8 pr-8 rounded-xl"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              title="Limpiar búsqueda"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        {needle && (
          <span className="text-xs text-slate-500 tabular-nums">{shownCount} de {totalCount}</span>
        )}
        {data && (
          <span className="text-xs text-slate-500 ml-auto">
            % por defecto del vendedor: <span className="font-semibold tabular-nums text-orange-600">{data.defaultPct}%</span>
            {" "}· flete por defecto: <span className="font-semibold tabular-nums text-sky-600">{data.defaultFletePct}%</span>
            {" "}· edítalos por cliente o venta (0 = no paga)
          </span>
        )}
      </div>

      {isLoading && <Skeleton className="h-24 w-full" />}

      {!isLoading && tab === "clients" && (
        <div className="rounded-lg border bg-white dark:bg-slate-950 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <ColHead className="text-right">Facturado</ColHead>
                <ColHead className="text-right">Costo</ColHead>
                <ColHead className="text-right">Margen</ColHead>
                <ColHead className="text-right">Flete cobrado</ColHead>
                <ColHead className="text-right w-28">% Flete</ColHead>
                <ColHead className="text-right">Reg. flete</ColHead>
                <ColHead className="text-right">Margen ajustado</ColHead>
                <ColHead className="text-right w-40">% Comisión</ColHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((c) => (
                <TableRow key={c.client} className={c.effectivePct === 0 ? "opacity-60" : ""}>
                  <TableCell>{c.client}</TableCell>
                  <TableCell className={`text-right tabular-nums ${c.revenue < 0 ? "text-rose-600 font-medium" : ""}`}>{formatCLP(c.revenue)}</TableCell>
                  <TableCell className="text-right tabular-nums text-slate-500">{formatCLP(c.cost)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCLP(c.margin)}</TableCell>
                  <TableCell className="text-right tabular-nums text-slate-500">{formatCLP(c.fleteCobrado)}</TableCell>
                  <TableCell className="text-right">
                    <FletePctCell
                      value={c.fleteEffectivePct}
                      isOverride={c.fleteOverridePct !== null}
                      onSave={(pct) => onSaveFleteRate("client", c.client, pct)}
                      onReset={() => onSaveFleteRate("client", c.client, null)}
                    />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    <FleteDeficit value={c.fleteDeficit} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-medium">{formatCLP(c.marginAdjusted)}</TableCell>
                  <TableCell className="text-right">
                    <PctCell
                      value={c.effectivePct}
                      isOverride={c.overridePct !== null}
                      onSave={(pct) => onSaveOverride("client", c.client, pct)}
                      onReset={() => onSaveOverride("client", c.client, null)}
                    />
                  </TableCell>
                </TableRow>
              ))}
              {data && clients.length === 0 && (
                <TableRow><TableCell colSpan={9} className="text-center text-slate-500 py-6">
                  {needle ? `Ningún cliente coincide con "${search}"` : "Sin clientes"}
                </TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {!isLoading && tab === "documents" && (
        <div className="rounded-lg border bg-white dark:bg-slate-950 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Documento</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Cliente</TableHead>
                <ColHead className="text-right">Venta neta</ColHead>
                <ColHead className="text-right">Costo</ColHead>
                <ColHead className="text-right">Margen</ColHead>
                <ColHead className="text-right">Flete cobrado</ColHead>
                <ColHead className="text-right w-28">% Flete</ColHead>
                <ColHead className="text-right">Reg. flete</ColHead>
                <ColHead className="text-right">Margen ajustado</ColHead>
                <ColHead className="text-right w-40">% Comisión</ColHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.map((d) => (
                <TableRow key={d.document} className={`${d.effectivePct === 0 ? "opacity-60" : ""} ${d.isCreditNote ? "bg-rose-50/40 dark:bg-rose-950/10" : ""}`}>
                  <TableCell>
                    <div className="flex items-center gap-1.5 whitespace-nowrap">
                      {d.isCreditNote && (
                        <Badge variant="outline" className="border-rose-300 bg-rose-50 text-rose-700 text-[10px] px-1.5 py-0 font-semibold dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
                          NC
                        </Badge>
                      )}
                      <span>N° {d.numero}</span>
                    </div>
                  </TableCell>
                  <TableCell>{formatFecha(d.fecha)}</TableCell>
                  <TableCell className="max-w-[220px] truncate" title={d.client}>{d.client}</TableCell>
                  <TableCell className={`text-right tabular-nums ${d.revenue < 0 ? "text-rose-600 font-medium" : ""}`}>{formatCLP(d.revenue)}</TableCell>
                  <TableCell className="text-right tabular-nums text-slate-500">{formatCLP(d.cost)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCLP(d.margin)}</TableCell>
                  <TableCell className="text-right tabular-nums text-slate-500" title={`Objetivo ${d.fleteEffectivePct}%: ${formatCLP(d.fleteObjetivo)}`}>{formatCLP(d.fleteCobrado)}</TableCell>
                  <TableCell className="text-right">
                    <FletePctCell
                      value={d.fleteEffectivePct}
                      isOverride={d.fleteOverridePct !== null}
                      onSave={(pct) => onSaveFleteRate("document", d.document, pct)}
                      onReset={() => onSaveFleteRate("document", d.document, null)}
                    />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    <FleteDeficit value={d.fleteDeficit} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-medium">{formatCLP(d.marginAdjusted)}</TableCell>
                  <TableCell className="text-right">
                    <PctCell
                      value={d.effectivePct}
                      isOverride={d.overridePct !== null}
                      onSave={(pct) => onSaveOverride("document", d.document, pct)}
                      onReset={() => onSaveOverride("document", d.document, null)}
                    />
                  </TableCell>
                </TableRow>
              ))}
              {data && documents.length === 0 && (
                <TableRow><TableCell colSpan={10} className="text-center text-slate-500 py-6">
                  {needle ? `Ninguna venta coincide con "${search}"` : "Sin ventas"}
                </TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
