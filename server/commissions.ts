/**
 * Módulo de Comisiones de Vendedores (Recursos Humanos)
 * ---------------------------------------------------------------
 * Calcula la comisión a pagar a cada vendedor sobre el MARGEN de lo
 * facturado NETO de devoluciones en un período, permitiendo:
 *   - fijar un % de comisión individual por vendedor,
 *   - fijar un % distinto por cliente o por venta (documento),
 *   - fijar la tasa de regularización de flete por cliente o por venta.
 *
 * Reglas de negocio (definidas con el usuario):
 *   - Base: facturas (FCV) MENOS notas de crédito (NCV). NVV/GDV no
 *     cuentan. La NC se imputa al vendedor que trae el documento
 *     (nokofu) y al mes de su propia emisión (feemdo), no al de la
 *     factura original: el ERP no guarda el vínculo entre ambas.
 *   - Signos: el ETL ya graba `monto` en negativo para las NCV, pero
 *     `caprco2` (cantidad) queda en positivo — por eso el costo se
 *     invierte explícitamente para NCV (ver COST_EXPR).
 *   - Cálculo sobre el margen: comisión = margen_ajustado × % / 100.
 *   - Costo por línea: manda el costo del documento (ppprpm × caprco1), que
 *     es lo que costó esa venta según el ERP. Si la línea no lo trae, cae al
 *     último costo GRI (× caprco2 — otra unidad). Las líneas de concepto
 *     (ZZ*) van con costo 0: no salió mercadería de bodega.
 *     Ver server/costo-linea.ts.
 *   - Piso en 0 por vendedor: si las NC superan a las ventas la comisión
 *     del período da negativa; se informa (commissionRaw) pero se paga 0.
 *     No arrastra saldo en contra al período siguiente.
 *
 * Regularización del flete (4% por defecto, configurable):
 *   - La empresa asume un % de flete sobre el NETO facturado de
 *     mercadería de cada documento. Lo que se le cobra al cliente por
 *     flete (líneas cuyo nombre de producto contiene "flete") muchas
 *     veces NO alcanza esa tasa; el faltante lo absorbe la empresa.
 *   - La tasa NO es fija: sale de commission_flete_rates con prioridad
 *     documento > cliente > DEFAULT_FLETE_RATE (4%). Es global por
 *     cliente, no por vendedor: el costo de despacho depende del destino.
 *   - Por cada documento:  objetivo = neto_mercadería × tasa,
 *     déficit = max(0, objetivo − flete_cobrado). El excedente (cuando
 *     el cliente pagó de más) NO suma.
 *   - En las NOTAS DE CRÉDITO el piso se espeja: el déficit se calcula
 *     con LEAST(0, …), de modo que la NC DEVUELVE la regularización en
 *     vez de castigar de nuevo (su neto es negativo). Sus líneas de
 *     flete también vienen en negativo y restan el flete cobrado.
 *   - Ese déficit CASTIGA el margen antes de comisionar:
 *     margen_ajustado = margen − déficit_flete, y la comisión se calcula
 *     sobre el margen ajustado. El déficit se computa documento a
 *     documento y recién ahí se suma por vendedor.
 *   - Las líneas de flete traen nokofu (vendedor) en NULL en el ERP, por
 *     eso NO forman parte de la base de mercadería; se recuperan por
 *     idmaeedo para atribuirles el documento/vendedor.
 *
 * Diseño resiliente (igual que server/permissions.ts): las tablas se
 * crean en runtime con CREATE TABLE IF NOT EXISTS porque el runner de
 * migraciones no es confiable en producción.
 */
import type { Express } from "express";
import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { db } from "./db";
import { commissionSettings, commissionOverrides, commissionFleteRates } from "../shared/schema";
import { requireAuth } from "./auth";
import { requirePermission } from "./permissions";
import { LINE_COST_EXPR } from "./costo-linea";

// Documentos que forman la base: facturas menos notas de crédito.
const BASE_TIDOS = sql`fv."tido" IN ('FCV', 'NCV')`;

// Signo del documento: las NCV llegan con `monto` ya negativo desde el ETL,
// pero con la cantidad (caprco2) en positivo. Todo lo que se derive de la
// cantidad —el costo— tiene que invertirse a mano.
const DOC_SIGN = sql`(CASE WHEN fv."tido" = 'NCV' THEN -1 ELSE 1 END)`;

// Costo por línea: misma expresión que getMarginBySalesperson (storage.ts),
// con el signo del documento aplicado para que una NC reste costo.
// Las líneas de concepto (ZZ*: fletes, servicios, descuentos) no llevan
// costo de mercadería — ver server/costo-linea.ts.
const COST_EXPR = sql`(${LINE_COST_EXPR} * ${DOC_SIGN})`;

const FACT_JOINS = sql`
  ventas.fact_ventas fv
  LEFT JOIN price_list pl ON UPPER(TRIM(pl."codigo")) = UPPER(TRIM(fv."koprct"))
  LEFT JOIN gri_prices_cache gpc ON UPPER(TRIM(gpc."sku")) = UPPER(TRIM(fv."koprct"))
`;

// Detección de líneas de flete: el ERP las nombra con "flete" en el
// producto (nokoprct) y les deja el vendedor (nokofu) en NULL.
const IS_FLETE = sql`fv."nokoprct" ILIKE '%flete%'`;
const NOT_FLETE = sql`(fv."nokoprct" IS NULL OR fv."nokoprct" NOT ILIKE '%flete%')`;
// Tasa de flete por defecto (%) cuando el cliente no tiene una configurada.
const DEFAULT_FLETE_RATE = 4;

/**
 * Déficit de flete de un documento, con el piso espejado para las NC.
 * Venta (neto ≥ 0): déficit = max(0, objetivo − cobrado) → castiga el margen.
 * Nota de crédito (neto < 0): déficit = min(0, objetivo − cobrado) → devuelve
 * la regularización, nunca vuelve a castigar.
 */
const fleteDeficitExpr = (revenue: any, objetivo: any, cobrado: any) => sql`(
  CASE WHEN ${revenue} >= 0
    THEN GREATEST(0, ${objetivo} - ${cobrado})
    ELSE LEAST(0, ${objetivo} - ${cobrado})
  END
)`;

// ─── Tablas en runtime (deploy de migraciones no confiable) ───

let ensureTablesPromise: Promise<void> | null = null;

function ensureTables(): Promise<void> {
  if (!ensureTablesPromise) {
    ensureTablesPromise = (async () => {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS commission_settings (
          id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
          salesperson_name varchar NOT NULL,
          commission_pct numeric(6,3) NOT NULL DEFAULT 0,
          updated_by varchar,
          updated_at timestamp DEFAULT now()
        )
      `);
      await db.execute(sql`
        CREATE UNIQUE INDEX IF NOT EXISTS "UQ_commission_settings_salesperson"
        ON commission_settings (salesperson_name)
      `);
      // Overrides de % por cliente/venta (reemplaza a las exclusiones).
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS commission_overrides (
          id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
          salesperson_name varchar NOT NULL,
          override_type varchar NOT NULL,
          value varchar NOT NULL,
          commission_pct numeric(6,3) NOT NULL DEFAULT 0,
          updated_by varchar,
          updated_at timestamp DEFAULT now()
        )
      `);
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "IDX_commission_ovr_salesperson"
        ON commission_overrides (salesperson_name)
      `);
      await db.execute(sql`
        CREATE UNIQUE INDEX IF NOT EXISTS "UQ_commission_ovr_person_type_value"
        ON commission_overrides (salesperson_name, override_type, value)
      `);
      // Tasa de regularización de flete por cliente / por venta.
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS commission_flete_rates (
          id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
          scope varchar NOT NULL,
          value varchar NOT NULL,
          flete_pct numeric(6,3) NOT NULL DEFAULT 4,
          updated_by varchar,
          updated_at timestamp DEFAULT now()
        )
      `);
      await db.execute(sql`
        CREATE UNIQUE INDEX IF NOT EXISTS "UQ_commission_flete_scope_value"
        ON commission_flete_rates (scope, value)
      `);
      // Migración: las exclusiones existentes se conservan como override 0%
      // (misma semántica: no pagan comisión). Solo si la tabla vieja existe.
      await db.execute(sql`
        INSERT INTO commission_overrides (salesperson_name, override_type, value, commission_pct)
        SELECT salesperson_name, exclusion_type, value, 0
        FROM commission_exclusions
        WHERE EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_name = 'commission_exclusions'
        )
        ON CONFLICT (salesperson_name, override_type, value) DO NOTHING
      `).catch(() => { /* tabla vieja inexistente: nada que migrar */ });
    })().catch((error) => {
      ensureTablesPromise = null; // permite reintentar
      throw error;
    });
  }
  return ensureTablesPromise;
}

// ─── Helpers ───

const num = (v: any): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Valida y normaliza el rango de fechas (YYYY-MM-DD). */
function parseDateRange(query: any): { startDate: string; endDate: string } {
  const isoDate = /^\d{4}-\d{2}-\d{2}$/;
  let { startDate, endDate } = query || {};
  if (!isoDate.test(startDate) || !isoDate.test(endDate)) {
    // Por defecto: mes en curso
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
    startDate = `${y}-${m}-01`;
    endDate = `${y}-${m}-${String(lastDay).padStart(2, "0")}`;
  }
  return { startDate, endDate };
}

// ─── Consultas ───

/**
 * Resumen por vendedor: facturado, costo, margen, regularización de
 * flete y comisión.
 * La comisión se calcula por DOCUMENTO (un documento tiene un solo
 * cliente y vendedor, así que su % efectivo es único) sobre el margen
 * YA AJUSTADO por el déficit de flete: comisión = margen_ajustado × %.
 * El % efectivo tiene prioridad: override del documento → override del
 * cliente → % del vendedor (commission_settings). Sin override = % del
 * vendedor; un override en 0 no paga comisión (reemplaza a las
 * exclusiones). El déficit de flete se computa documento a documento
 * (piso en 0) antes de sumar por vendedor.
 */
export async function getCommissionSummary(startDate: string, endDate: string) {
  const result = await db.execute(sql`
    WITH flete_doc AS (
      -- Flete cobrado al cliente por documento (líneas "flete", nokofu NULL).
      -- En las NCV el monto ya viene negativo: resta el flete cobrado.
      SELECT
        fv."idmaeedo"::text AS document,
        SUM(COALESCE(fv."monto", 0)) AS flete_cobrado
      FROM ventas.fact_ventas fv
      WHERE ${BASE_TIDOS}
        AND ${IS_FLETE}
        AND fv."idmaeedo" IS NOT NULL
        AND fv."feemdo" >= ${startDate}::date
        AND fv."feemdo" <= ${endDate}::date
      GROUP BY fv."idmaeedo"
    ),
    lineas AS (
      -- Base de mercadería (sin líneas de flete): FCV suma, NCV resta
      SELECT
        fv."nokofu" AS salesperson,
        fv."nokoen" AS client,
        fv."idmaeedo"::text AS document,
        fv."monto" AS revenue,
        ${COST_EXPR} AS cost
      FROM ${FACT_JOINS}
      WHERE ${BASE_TIDOS}
        AND fv."nokofu" IS NOT NULL AND fv."nokofu" != ''
        AND fv."monto" IS NOT NULL
        AND fv."idmaeedo" IS NOT NULL
        AND ${NOT_FLETE}
        AND fv."feemdo" >= ${startDate}::date
        AND fv."feemdo" <= ${endDate}::date
    ),
    doc_agg AS (
      -- Un documento = un cliente y un vendedor → el % efectivo es único
      SELECT
        salesperson,
        client,
        document,
        SUM(revenue) AS revenue,
        SUM(cost) AS cost,
        SUM(revenue - cost) AS margin,
        COUNT(*) AS line_count
      FROM lineas
      GROUP BY salesperson, client, document
    ),
    rated AS (
      -- Tasa de flete efectiva: documento > cliente > default
      SELECT
        d.*,
        COALESCE(fr_doc.flete_pct, fr_cli.flete_pct, ${DEFAULT_FLETE_RATE}) / 100.0 AS flete_rate,
        COALESCE(fd.flete_cobrado, 0) AS flete_cobrado
      FROM doc_agg d
      LEFT JOIN flete_doc fd
        ON fd.document = d.document
      LEFT JOIN commission_flete_rates fr_cli
        ON fr_cli.scope = 'client' AND fr_cli.value = d.client
      LEFT JOIN commission_flete_rates fr_doc
        ON fr_doc.scope = 'document' AND fr_doc.value = d.document
    ),
    priced AS (
      SELECT
        r.salesperson,
        r.client,
        r.revenue,
        r.cost,
        r.margin,
        r.line_count,
        r.flete_cobrado,
        (r.revenue * r.flete_rate) AS flete_objetivo,
        ${fleteDeficitExpr(sql`r.revenue`, sql`r.revenue * r.flete_rate`, sql`r.flete_cobrado`)} AS flete_deficit,
        (r.margin - ${fleteDeficitExpr(sql`r.revenue`, sql`r.revenue * r.flete_rate`, sql`r.flete_cobrado`)}) AS margin_adj,
        COALESCE(
          doc_ovr.commission_pct,
          cli_ovr.commission_pct,
          cs.commission_pct,
          0
        ) AS eff_pct,
        (doc_ovr.value IS NOT NULL OR cli_ovr.value IS NOT NULL) AS overridden
      FROM rated r
      LEFT JOIN commission_settings cs
        ON cs.salesperson_name = r.salesperson
      LEFT JOIN commission_overrides cli_ovr
        ON cli_ovr.salesperson_name = r.salesperson
       AND cli_ovr.override_type = 'client'
       AND cli_ovr.value = r.client
      LEFT JOIN commission_overrides doc_ovr
        ON doc_ovr.salesperson_name = r.salesperson
       AND doc_ovr.override_type = 'document'
       AND doc_ovr.value = r.document
    )
    SELECT
      salesperson,
      SUM(revenue) AS net_revenue,
      SUM(cost) AS net_cost,
      SUM(flete_cobrado) AS flete_cobrado,
      SUM(flete_objetivo) AS flete_objetivo,
      SUM(flete_deficit) AS flete_deficit,
      SUM(margin_adj) AS margin_adj,
      SUM(margin_adj * eff_pct / 100.0) AS commission_amount,
      SUM(line_count) AS line_count,
      COUNT(DISTINCT CASE WHEN overridden THEN client END) AS overridden_client_count
    FROM priced
    GROUP BY salesperson
    ORDER BY SUM(revenue) DESC
  `);

  const rows = (result.rows || []) as any[];

  // % por defecto configurado por vendedor
  const settings = await db.select().from(commissionSettings);
  const pctByName = new Map<string, number>();
  for (const s of settings) pctByName.set(s.salespersonName, num(s.commissionPct));

  const items = rows.map((r) => {
    const netRevenue = num(r.net_revenue);
    const netCost = num(r.net_cost);
    const netMargin = netRevenue - netCost;
    const fleteObjetivo = num(r.flete_objetivo);
    const fleteCobrado = num(r.flete_cobrado);
    const fleteDeficit = num(r.flete_deficit);
    const marginAdjusted = num(r.margin_adj);
    const commissionPct = pctByName.get(r.salesperson) ?? 0;
    // Piso en 0: si las NC del período superan a las ventas la comisión da
    // negativa; se informa el valor crudo pero se paga 0 (no arrastra saldo).
    const commissionRaw = num(r.commission_amount);
    const commissionAmount = Math.max(0, commissionRaw);
    return {
      salesperson: r.salesperson as string,
      netRevenue,
      netCost,
      netMargin,
      netMarginPct: netRevenue > 0 ? (netMargin / netRevenue) * 100 : 0,
      // Regularización del flete (4% que asume la empresa)
      fleteObjetivo,
      fleteCobrado,
      fleteDeficit,
      // Margen ya castigado por el déficit de flete (base de la comisión)
      marginAdjusted,
      marginAdjustedPct: netRevenue > 0 ? (marginAdjusted / netRevenue) * 100 : 0,
      lineCount: num(r.line_count),
      // Clientes con un % distinto al del vendedor (para el badge de la fila)
      overriddenClientCount: num(r.overridden_client_count),
      commissionPct,
      commissionAmount,
      // Valor sin el piso en 0 (negativo = las NC se comieron la comisión)
      commissionRaw,
    };
  });

  // El total a pagar suma comisiones ya pisadas en 0: un vendedor en negativo
  // no le descuenta comisión a los demás.
  const totals = items.reduce(
    (acc, it) => {
      acc.netRevenue += it.netRevenue;
      acc.netMargin += it.netMargin;
      acc.fleteObjetivo += it.fleteObjetivo;
      acc.fleteCobrado += it.fleteCobrado;
      acc.fleteDeficit += it.fleteDeficit;
      acc.marginAdjusted += it.marginAdjusted;
      acc.commissionAmount += it.commissionAmount;
      acc.commissionRaw += it.commissionRaw;
      return acc;
    },
    { netRevenue: 0, netMargin: 0, fleteObjetivo: 0, fleteCobrado: 0, fleteDeficit: 0, marginAdjusted: 0, commissionAmount: 0, commissionRaw: 0 },
  );

  return { startDate, endDate, items, totals };
}

/**
 * Detalle de un vendedor: desglose por cliente y por documento (venta),
 * con el % efectivo de comisión de cada uno. `overridePct` = valor fijado
 * manualmente (null si hereda); `effectivePct` = el que se aplica de verdad
 * (override si existe, si no el % por defecto del vendedor / del cliente).
 */
export async function getSalespersonDetail(salesperson: string, startDate: string, endDate: string) {
  // Base de mercadería del vendedor (sin líneas de flete): FCV menos NCV
  const commonWhere = sql`
    WHERE ${BASE_TIDOS}
      AND fv."nokofu" = ${salesperson}
      AND fv."monto" IS NOT NULL
      AND fv."idmaeedo" IS NOT NULL
      AND ${NOT_FLETE}
      AND fv."feemdo" >= ${startDate}::date
      AND fv."feemdo" <= ${endDate}::date
  `;

  // Flete cobrado por documento en el período (líneas "flete", nokofu NULL).
  // Se une por idmaeedo para atribuirlo al documento del vendedor. Las líneas
  // de flete de una NCV vienen en negativo, así que restan el flete cobrado.
  const fleteDocCte = sql`
    flete_doc AS (
      SELECT
        fv."idmaeedo"::text AS document,
        SUM(COALESCE(fv."monto", 0)) AS flete_cobrado
      FROM ventas.fact_ventas fv
      WHERE ${BASE_TIDOS}
        AND ${IS_FLETE}
        AND fv."idmaeedo" IS NOT NULL
        AND fv."feemdo" >= ${startDate}::date
        AND fv."feemdo" <= ${endDate}::date
      GROUP BY fv."idmaeedo"
    )
  `;

  // % por defecto del vendedor
  const settingRow = await db
    .select({ pct: commissionSettings.commissionPct })
    .from(commissionSettings)
    .where(eq(commissionSettings.salespersonName, salesperson))
    .limit(1);
  const defaultPct = settingRow.length ? num(settingRow[0].pct) : 0;

  // Clientes: el flete se calcula documento a documento (con su propia tasa
  // y su propio piso según sea factura o NC) y recién ahí se suma al cliente.
  const clientsResult = await db.execute(sql`
    WITH ${fleteDocCte},
    doc_base AS (
      SELECT
        COALESCE(fv."nokoen", 'SIN CLIENTE') AS client,
        fv."idmaeedo"::text AS document,
        SUM(fv."monto") AS revenue,
        SUM(${COST_EXPR}) AS cost,
        COUNT(*) AS line_count
      FROM ${FACT_JOINS}
      ${commonWhere}
      GROUP BY COALESCE(fv."nokoen", 'SIN CLIENTE'), fv."idmaeedo"
    ),
    doc_rated AS (
      SELECT
        d.client,
        d.document,
        d.revenue,
        d.cost,
        d.line_count,
        COALESCE(fd.flete_cobrado, 0) AS flete_cobrado,
        COALESCE(fr_doc.flete_pct, fr_cli.flete_pct, ${DEFAULT_FLETE_RATE}) / 100.0 AS flete_rate
      FROM doc_base d
      LEFT JOIN flete_doc fd ON fd.document = d.document
      LEFT JOIN commission_flete_rates fr_cli
        ON fr_cli.scope = 'client' AND fr_cli.value = d.client
      LEFT JOIN commission_flete_rates fr_doc
        ON fr_doc.scope = 'document' AND fr_doc.value = d.document
    )
    SELECT
      d.client,
      SUM(d.revenue) AS revenue,
      SUM(d.cost) AS cost,
      SUM(d.line_count) AS line_count,
      SUM(d.flete_cobrado) AS flete_cobrado,
      SUM(d.revenue * d.flete_rate) AS flete_objetivo,
      SUM(${fleteDeficitExpr(sql`d.revenue`, sql`d.revenue * d.flete_rate`, sql`d.flete_cobrado`)}) AS flete_deficit,
      MAX(ovr.commission_pct) AS override_pct,
      MAX(fr.flete_pct) AS flete_override_pct
    FROM doc_rated d
    LEFT JOIN commission_overrides ovr
      ON ovr.salesperson_name = ${salesperson}
     AND ovr.override_type = 'client'
     AND ovr.value = d.client
    LEFT JOIN commission_flete_rates fr
      ON fr.scope = 'client' AND fr.value = d.client
    GROUP BY d.client
    ORDER BY SUM(d.revenue) DESC
  `);

  const documentsResult = await db.execute(sql`
    WITH ${fleteDocCte}
    SELECT
      fv."idmaeedo"::text AS document,
      MAX(fv."nudo"::text) AS numero,
      MAX(fv."tido") AS tido,
      MAX(fv."nokoen") AS client,
      MAX(fv."feemdo") AS fecha,
      SUM(fv."monto") AS revenue,
      SUM(${COST_EXPR}) AS cost,
      COUNT(*) AS line_count,
      MAX(COALESCE(fd.flete_cobrado, 0)) AS flete_cobrado,
      MAX(doc_ovr.commission_pct) AS override_pct,
      MAX(cli_ovr.commission_pct) AS client_pct,
      MAX(fr_doc.flete_pct) AS flete_override_pct,
      MAX(fr_cli.flete_pct) AS flete_client_pct
    FROM ${FACT_JOINS}
    LEFT JOIN flete_doc fd
      ON fd.document = fv."idmaeedo"::text
    LEFT JOIN commission_overrides doc_ovr
      ON doc_ovr.salesperson_name = ${salesperson}
     AND doc_ovr.override_type = 'document'
     AND doc_ovr.value = fv."idmaeedo"::text
    LEFT JOIN commission_overrides cli_ovr
      ON cli_ovr.salesperson_name = ${salesperson}
     AND cli_ovr.override_type = 'client'
     AND cli_ovr.value = fv."nokoen"
    LEFT JOIN commission_flete_rates fr_doc
      ON fr_doc.scope = 'document' AND fr_doc.value = fv."idmaeedo"::text
    LEFT JOIN commission_flete_rates fr_cli
      ON fr_cli.scope = 'client' AND fr_cli.value = fv."nokoen"
    ${commonWhere}
    GROUP BY fv."idmaeedo"
    ORDER BY MAX(fv."feemdo") DESC
  `);

  const clients = ((clientsResult.rows || []) as any[]).map((r) => {
    const revenue = num(r.revenue);
    const cost = num(r.cost);
    const margin = revenue - cost;
    const fleteCobrado = num(r.flete_cobrado);
    const fleteObjetivo = num(r.flete_objetivo);
    const fleteDeficit = num(r.flete_deficit);
    const overridePct = r.override_pct == null ? null : num(r.override_pct);
    const fleteOverridePct = r.flete_override_pct == null ? null : num(r.flete_override_pct);
    return {
      client: r.client as string,
      revenue,
      cost,
      margin,
      fleteCobrado,
      fleteObjetivo,
      fleteDeficit,
      marginAdjusted: margin - fleteDeficit,
      lineCount: num(r.line_count),
      overridePct,
      effectivePct: overridePct ?? defaultPct,
      // Tasa de flete: fijada para este cliente (null = usa el 4% por defecto)
      fleteOverridePct,
      fleteEffectivePct: fleteOverridePct ?? DEFAULT_FLETE_RATE,
    };
  });

  const documents = ((documentsResult.rows || []) as any[]).map((r) => {
    const revenue = num(r.revenue);
    const cost = num(r.cost);
    const margin = revenue - cost;
    const fleteCobrado = num(r.flete_cobrado);
    const fleteOverridePct = r.flete_override_pct == null ? null : num(r.flete_override_pct);
    const fleteClientPct = r.flete_client_pct == null ? null : num(r.flete_client_pct);
    // Tasa efectiva: documento > cliente > default (mismo orden que el SQL)
    const fleteEffectivePct = fleteOverridePct ?? fleteClientPct ?? DEFAULT_FLETE_RATE;
    const fleteObjetivo = revenue * (fleteEffectivePct / 100);
    const isCreditNote = r.tido === "NCV";
    // Piso espejado: la factura nunca acredita flete, la NC nunca lo castiga
    const fleteDeficit = isCreditNote
      ? Math.min(0, fleteObjetivo - fleteCobrado)
      : Math.max(0, fleteObjetivo - fleteCobrado);
    const overridePct = r.override_pct == null ? null : num(r.override_pct);
    const clientPct = r.client_pct == null ? null : num(r.client_pct);
    return {
      document: r.document as string,
      numero: (r.numero as string) || r.document,
      tido: (r.tido as string) || "FCV",
      isCreditNote,
      client: (r.client as string) || "SIN CLIENTE",
      fecha: r.fecha as string,
      revenue,
      cost,
      margin,
      fleteCobrado,
      fleteObjetivo,
      fleteDeficit,
      marginAdjusted: margin - fleteDeficit,
      lineCount: num(r.line_count),
      overridePct,
      // % que aplica: documento > cliente > vendedor
      effectivePct: overridePct ?? clientPct ?? defaultPct,
      // heredado del cliente (para mostrar de dónde viene el valor por defecto)
      clientPct,
      // Tasa de flete fijada para esta venta puntual (null = hereda)
      fleteOverridePct,
      fleteClientPct,
      fleteEffectivePct,
    };
  });

  return { salesperson, startDate, endDate, defaultPct, defaultFletePct: DEFAULT_FLETE_RATE, clients, documents };
}

// Tope de líneas del export: un período muy largo puede traer cientos de
// miles de filas y reventar el Excel. Se avisa al usuario si se recorta.
const EXPORT_LINE_LIMIT = 50000;

/**
 * Volcado completo del período para el Excel: el resumen, el desglose por
 * cliente y por documento de todos los vendedores, y el detalle línea a línea.
 * Reutiliza getSalespersonDetail para que los números del Excel sean
 * exactamente los mismos que muestra la pantalla.
 */
export async function getCommissionExport(startDate: string, endDate: string) {
  const summary = await getCommissionSummary(startDate, endDate);

  // De a 4 vendedores en paralelo: en serie son ~3 consultas por vendedor y
  // con 20 vendedores el export se hace eterno; sin límite, satura el pool.
  const clients: any[] = [];
  const documents: any[] = [];
  const CONCURRENCY = 4;
  for (let i = 0; i < summary.items.length; i += CONCURRENCY) {
    const batch = summary.items.slice(i, i + CONCURRENCY);
    const details = await Promise.all(
      batch.map((item) => getSalespersonDetail(item.salesperson, startDate, endDate)),
    );
    for (const detail of details) {
      for (const c of detail.clients) clients.push({ salesperson: detail.salesperson, ...c });
      for (const d of detail.documents) documents.push({ salesperson: detail.salesperson, ...d });
    }
  }

  // Líneas: incluye las de flete (que vienen sin vendedor) atribuyéndolas al
  // vendedor del documento, para que el detalle cuadre con las otras hojas.
  const linesResult = await db.execute(sql`
    WITH doc_vendor AS (
      SELECT
        fv."idmaeedo"::text AS document,
        MAX(fv."nokofu") AS salesperson
      FROM ventas.fact_ventas fv
      WHERE ${BASE_TIDOS}
        AND fv."nokofu" IS NOT NULL AND fv."nokofu" != ''
        AND fv."feemdo" >= ${startDate}::date
        AND fv."feemdo" <= ${endDate}::date
      GROUP BY fv."idmaeedo"
    )
    SELECT
      fv."feemdo" AS fecha,
      fv."tido" AS tido,
      fv."idmaeedo"::text AS document,
      fv."nudo"::text AS numero,
      COALESCE(fv."nokofu", dv.salesperson) AS salesperson,
      COALESCE(fv."nokoen", 'SIN CLIENTE') AS client,
      fv."koprct" AS sku,
      fv."nokoprct" AS producto,
      (COALESCE(fv."caprco2", 0) * ${DOC_SIGN}) AS cantidad,
      fv."monto" AS revenue,
      ${COST_EXPR} AS cost,
      ${IS_FLETE} AS es_flete
    FROM ${FACT_JOINS}
    LEFT JOIN doc_vendor dv ON dv.document = fv."idmaeedo"::text
    WHERE ${BASE_TIDOS}
      AND fv."monto" IS NOT NULL
      AND fv."idmaeedo" IS NOT NULL
      AND fv."feemdo" >= ${startDate}::date
      AND fv."feemdo" <= ${endDate}::date
    ORDER BY fv."feemdo" DESC, fv."idmaeedo", fv."idmaeddo"
    LIMIT ${EXPORT_LINE_LIMIT + 1}
  `);

  const lineRows = (linesResult.rows || []) as any[];
  const linesTruncated = lineRows.length > EXPORT_LINE_LIMIT;
  if (linesTruncated) {
    console.warn(
      `[comisiones] export ${startDate}..${endDate}: más de ${EXPORT_LINE_LIMIT} líneas, se recorta la hoja de detalle`,
    );
  }
  const lines = lineRows.slice(0, EXPORT_LINE_LIMIT).map((r) => {
    const revenue = num(r.revenue);
    const cost = num(r.cost);
    return {
      fecha: r.fecha as string,
      tido: (r.tido as string) || "FCV",
      isCreditNote: r.tido === "NCV",
      document: r.document as string,
      numero: (r.numero as string) || r.document,
      salesperson: (r.salesperson as string) || "SIN VENDEDOR",
      client: r.client as string,
      sku: (r.sku as string) || "",
      producto: (r.producto as string) || "",
      cantidad: num(r.cantidad),
      revenue,
      cost,
      margin: revenue - cost,
      esFlete: r.es_flete === true,
    };
  });

  return {
    startDate,
    endDate,
    defaultFletePct: DEFAULT_FLETE_RATE,
    summary,
    clients,
    documents,
    lines,
    linesTruncated,
    lineLimit: EXPORT_LINE_LIMIT,
  };
}

// ─── Endpoints ───

export function registerCommissionRoutes(app: Express) {
  const guard = requirePermission("rrhh.comisiones");

  // Resumen de comisiones de todos los vendedores en un período
  app.get("/api/hr/commissions/summary", requireAuth, guard, async (req: any, res) => {
    try {
      await ensureTables();
      const { startDate, endDate } = parseDateRange(req.query);
      const data = await getCommissionSummary(startDate, endDate);
      res.json(data);
    } catch (error: any) {
      console.error("Error calculando comisiones:", error);
      res.status(500).json({ message: "Error calculando comisiones: " + (error?.message || "desconocido") });
    }
  });

  // Detalle (clientes + documentos) de un vendedor
  app.get("/api/hr/commissions/salesperson/:name", requireAuth, guard, async (req: any, res) => {
    try {
      await ensureTables();
      const name = decodeURIComponent(req.params.name || "");
      if (!name) return res.status(400).json({ message: "Vendedor requerido" });
      const { startDate, endDate } = parseDateRange(req.query);
      const data = await getSalespersonDetail(name, startDate, endDate);
      res.json(data);
    } catch (error: any) {
      console.error("Error obteniendo detalle de comisión:", error);
      res.status(500).json({ message: "Error obteniendo el detalle: " + (error?.message || "desconocido") });
    }
  });

  // Fijar el % de comisión de un vendedor
  app.put("/api/hr/commissions/settings", requireAuth, guard, async (req: any, res) => {
    try {
      const parsed = z.object({
        salespersonName: z.string().trim().min(1).max(255),
        commissionPct: z.number().min(0).max(100),
      }).safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Formato inválido", errors: parsed.error.flatten() });
      }
      await ensureTables();
      const { salespersonName, commissionPct } = parsed.data;
      await db.insert(commissionSettings)
        .values({
          salespersonName,
          commissionPct: String(commissionPct),
          updatedBy: req.user?.id || null,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: commissionSettings.salespersonName,
          set: { commissionPct: String(commissionPct), updatedBy: req.user?.id || null, updatedAt: new Date() },
        });
      res.json({ salespersonName, commissionPct });
    } catch (error: any) {
      console.error("Error guardando % de comisión:", error);
      res.status(500).json({ message: "Error guardando el porcentaje: " + (error?.message || "desconocido") });
    }
  });

  // Fijar/quitar el % de comisión de un cliente o una venta (documento).
  // commissionPct = número → fija ese %; null → quita el override (vuelve a
  // heredar el % por defecto del vendedor). Poner 0 = no paga comisión.
  app.put("/api/hr/commissions/overrides", requireAuth, guard, async (req: any, res) => {
    try {
      const parsed = z.object({
        salespersonName: z.string().trim().min(1).max(255),
        overrideType: z.enum(["client", "document"]),
        value: z.string().trim().min(1).max(255),
        commissionPct: z.number().min(0).max(100).nullable(),
      }).safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Formato inválido", errors: parsed.error.flatten() });
      }
      await ensureTables();
      const { salespersonName, overrideType, value, commissionPct } = parsed.data;
      if (commissionPct === null) {
        await db.delete(commissionOverrides).where(
          and(
            eq(commissionOverrides.salespersonName, salespersonName),
            eq(commissionOverrides.overrideType, overrideType),
            eq(commissionOverrides.value, value),
          ),
        );
      } else {
        await db.insert(commissionOverrides)
          .values({
            salespersonName,
            overrideType,
            value,
            commissionPct: String(commissionPct),
            updatedBy: req.user?.id || null,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: [commissionOverrides.salespersonName, commissionOverrides.overrideType, commissionOverrides.value],
            set: { commissionPct: String(commissionPct), updatedBy: req.user?.id || null, updatedAt: new Date() },
          });
      }
      res.json({ salespersonName, overrideType, value, commissionPct });
    } catch (error: any) {
      console.error("Error guardando % de comisión por cliente/venta:", error);
      res.status(500).json({ message: "Error guardando el porcentaje: " + (error?.message || "desconocido") });
    }
  });

  // Fijar/quitar la tasa de regularización de flete de un cliente o una venta.
  // fletePct = número → fija esa tasa; null → vuelve al 4% por defecto.
  // Es global (no por vendedor): el flete depende del destino, no de quién vende.
  app.put("/api/hr/commissions/flete-rates", requireAuth, guard, async (req: any, res) => {
    try {
      const parsed = z.object({
        scope: z.enum(["client", "document"]),
        value: z.string().trim().min(1).max(255),
        fletePct: z.number().min(0).max(100).nullable(),
      }).safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Formato inválido", errors: parsed.error.flatten() });
      }
      await ensureTables();
      const { scope, value, fletePct } = parsed.data;
      if (fletePct === null) {
        await db.delete(commissionFleteRates).where(
          and(eq(commissionFleteRates.scope, scope), eq(commissionFleteRates.value, value)),
        );
      } else {
        await db.insert(commissionFleteRates)
          .values({
            scope,
            value,
            fletePct: String(fletePct),
            updatedBy: req.user?.id || null,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: [commissionFleteRates.scope, commissionFleteRates.value],
            set: { fletePct: String(fletePct), updatedBy: req.user?.id || null, updatedAt: new Date() },
          });
      }
      res.json({ scope, value, fletePct });
    } catch (error: any) {
      console.error("Error guardando la tasa de flete:", error);
      res.status(500).json({ message: "Error guardando la tasa de flete: " + (error?.message || "desconocido") });
    }
  });

  // Volcado completo del período para exportar a Excel: resumen + detalle por
  // cliente y por documento de TODOS los vendedores + líneas.
  app.get("/api/hr/commissions/export", requireAuth, guard, async (req: any, res) => {
    try {
      await ensureTables();
      const { startDate, endDate } = parseDateRange(req.query);
      const data = await getCommissionExport(startDate, endDate);
      res.json(data);
    } catch (error: any) {
      console.error("Error armando la exportación de comisiones:", error);
      res.status(500).json({ message: "Error armando la exportación: " + (error?.message || "desconocido") });
    }
  });
}
