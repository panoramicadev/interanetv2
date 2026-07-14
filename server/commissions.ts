/**
 * Módulo de Comisiones de Vendedores (Recursos Humanos)
 * ---------------------------------------------------------------
 * Calcula la comisión a pagar a cada vendedor sobre el MARGEN de lo
 * FACTURADO (tido = 'FCV') en un período, permitiendo:
 *   - fijar un % de comisión individual por vendedor,
 *   - excluir clientes completos o ventas (documentos) puntuales
 *     de la base imponible.
 *
 * Reglas de negocio (definidas con el usuario):
 *   - Base: solo facturas (FCV). NVV/GDV/NCV no cuentan.
 *   - Cálculo sobre el margen: comisión = margen_neto × % / 100,
 *     donde margen_neto = (venta − costo) de las líneas NO excluidas.
 *   - Costo unitario: misma cadena COALESCE que el módulo de Margen
 *     (gri_prices_cache → ppprpm → listacost → costo_produccion → 0)
 *     multiplicada por la cantidad (caprco2).
 *
 * Regularización del flete (4%):
 *   - La empresa asume un 4% de flete sobre el NETO facturado de
 *     mercadería de cada documento. Lo que se le cobra al cliente por
 *     flete (líneas cuyo nombre de producto contiene "flete") muchas
 *     veces NO alcanza ese 4%; el faltante lo absorbe la empresa.
 *   - Por cada documento:  objetivo = neto_mercadería × 4%,
 *     déficit = max(0, objetivo − flete_cobrado). El excedente (cuando
 *     el cliente pagó ≥ 4%) NO suma.
 *   - Ese déficit CASTIGA el margen antes de comisionar:
 *     margen_ajustado = margen − déficit_flete, y la comisión se calcula
 *     sobre el margen ajustado. El déficit se computa documento a
 *     documento (con piso en 0) y recién ahí se suma por vendedor.
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
import { commissionSettings, commissionOverrides } from "../shared/schema";
import { requireAuth } from "./auth";
import { requirePermission } from "./permissions";

// Costo por línea: misma expresión que getMarginBySalesperson (storage.ts).
const COST_EXPR = sql`(
  COALESCE(
    gpc."price",
    NULLIF(fv."ppprpm", 0),
    NULLIF(fv."listacost", 0),
    pl."costo_produccion",
    0
  ) * COALESCE(fv."caprco2", 0)
)`;

const FACT_JOINS = sql`
  ventas.fact_ventas fv
  LEFT JOIN price_list pl ON UPPER(TRIM(pl."codigo")) = UPPER(TRIM(fv."koprct"))
  LEFT JOIN gri_prices_cache gpc ON UPPER(TRIM(gpc."sku")) = UPPER(TRIM(fv."koprct"))
`;

// Detección de líneas de flete: el ERP las nombra con "flete" en el
// producto (nokoprct) y les deja el vendedor (nokofu) en NULL.
const IS_FLETE = sql`fv."nokoprct" ILIKE '%flete%'`;
const NOT_FLETE = sql`(fv."nokoprct" IS NULL OR fv."nokoprct" NOT ILIKE '%flete%')`;
// Fracción de flete que asume la empresa sobre el neto de mercadería.
const FLETE_RATE = 0.04;

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
async function getCommissionSummary(startDate: string, endDate: string) {
  const result = await db.execute(sql`
    WITH flete_doc AS (
      -- Flete cobrado al cliente por documento (líneas "flete", nokofu NULL)
      SELECT
        fv."idmaeedo"::text AS document,
        SUM(COALESCE(fv."monto", 0)) AS flete_cobrado
      FROM ventas.fact_ventas fv
      WHERE fv."tido" = 'FCV'
        AND ${IS_FLETE}
        AND fv."idmaeedo" IS NOT NULL
        AND fv."feemdo" >= ${startDate}::date
        AND fv."feemdo" <= ${endDate}::date
      GROUP BY fv."idmaeedo"
    ),
    lineas AS (
      -- Base de mercadería (sin líneas de flete)
      SELECT
        fv."nokofu" AS salesperson,
        fv."nokoen" AS client,
        fv."idmaeedo"::text AS document,
        fv."monto" AS revenue,
        ${COST_EXPR} AS cost
      FROM ${FACT_JOINS}
      WHERE fv."tido" = 'FCV'
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
    priced AS (
      SELECT
        d.salesperson,
        d.client,
        d.revenue,
        d.cost,
        d.margin,
        d.line_count,
        COALESCE(fd.flete_cobrado, 0) AS flete_cobrado,
        (d.revenue * ${FLETE_RATE}) AS flete_objetivo,
        GREATEST(0, d.revenue * ${FLETE_RATE} - COALESCE(fd.flete_cobrado, 0)) AS flete_deficit,
        (d.margin - GREATEST(0, d.revenue * ${FLETE_RATE} - COALESCE(fd.flete_cobrado, 0))) AS margin_adj,
        COALESCE(
          doc_ovr.commission_pct,
          cli_ovr.commission_pct,
          cs.commission_pct,
          0
        ) AS eff_pct,
        (doc_ovr.value IS NOT NULL OR cli_ovr.value IS NOT NULL) AS overridden
      FROM doc_agg d
      LEFT JOIN flete_doc fd
        ON fd.document = d.document
      LEFT JOIN commission_settings cs
        ON cs.salesperson_name = d.salesperson
      LEFT JOIN commission_overrides cli_ovr
        ON cli_ovr.salesperson_name = d.salesperson
       AND cli_ovr.override_type = 'client'
       AND cli_ovr.value = d.client
      LEFT JOIN commission_overrides doc_ovr
        ON doc_ovr.salesperson_name = d.salesperson
       AND doc_ovr.override_type = 'document'
       AND doc_ovr.value = d.document
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
    HAVING SUM(revenue) > 0
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
    const commissionAmount = num(r.commission_amount);
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
    };
  });

  const totals = items.reduce(
    (acc, it) => {
      acc.netRevenue += it.netRevenue;
      acc.netMargin += it.netMargin;
      acc.fleteObjetivo += it.fleteObjetivo;
      acc.fleteCobrado += it.fleteCobrado;
      acc.fleteDeficit += it.fleteDeficit;
      acc.marginAdjusted += it.marginAdjusted;
      acc.commissionAmount += it.commissionAmount;
      return acc;
    },
    { netRevenue: 0, netMargin: 0, fleteObjetivo: 0, fleteCobrado: 0, fleteDeficit: 0, marginAdjusted: 0, commissionAmount: 0 },
  );

  return { startDate, endDate, items, totals };
}

/**
 * Detalle de un vendedor: desglose por cliente y por documento (venta),
 * con el % efectivo de comisión de cada uno. `overridePct` = valor fijado
 * manualmente (null si hereda); `effectivePct` = el que se aplica de verdad
 * (override si existe, si no el % por defecto del vendedor / del cliente).
 */
async function getSalespersonDetail(salesperson: string, startDate: string, endDate: string) {
  // Base de mercadería del vendedor (sin líneas de flete)
  const commonWhere = sql`
    WHERE fv."tido" = 'FCV'
      AND fv."nokofu" = ${salesperson}
      AND fv."monto" IS NOT NULL
      AND fv."idmaeedo" IS NOT NULL
      AND ${NOT_FLETE}
      AND fv."feemdo" >= ${startDate}::date
      AND fv."feemdo" <= ${endDate}::date
  `;

  // Flete cobrado por documento en el período (líneas "flete", nokofu NULL).
  // Se une por idmaeedo para atribuirlo al documento del vendedor.
  const fleteDocCte = sql`
    flete_doc AS (
      SELECT
        fv."idmaeedo"::text AS document,
        SUM(COALESCE(fv."monto", 0)) AS flete_cobrado
      FROM ventas.fact_ventas fv
      WHERE fv."tido" = 'FCV'
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

  // Clientes: el flete se calcula por documento (piso en 0) y se suma al cliente.
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
    )
    SELECT
      d.client,
      SUM(d.revenue) AS revenue,
      SUM(d.cost) AS cost,
      SUM(d.line_count) AS line_count,
      SUM(COALESCE(fd.flete_cobrado, 0)) AS flete_cobrado,
      SUM(d.revenue * ${FLETE_RATE}) AS flete_objetivo,
      SUM(GREATEST(0, d.revenue * ${FLETE_RATE} - COALESCE(fd.flete_cobrado, 0))) AS flete_deficit,
      MAX(ovr.commission_pct) AS override_pct
    FROM doc_base d
    LEFT JOIN flete_doc fd ON fd.document = d.document
    LEFT JOIN commission_overrides ovr
      ON ovr.salesperson_name = ${salesperson}
     AND ovr.override_type = 'client'
     AND ovr.value = d.client
    GROUP BY d.client
    HAVING SUM(d.revenue) <> 0
    ORDER BY SUM(d.revenue) DESC
  `);

  const documentsResult = await db.execute(sql`
    WITH ${fleteDocCte}
    SELECT
      fv."idmaeedo"::text AS document,
      MAX(fv."nudo"::text) AS numero,
      MAX(fv."nokoen") AS client,
      MAX(fv."feemdo") AS fecha,
      SUM(fv."monto") AS revenue,
      SUM(${COST_EXPR}) AS cost,
      COUNT(*) AS line_count,
      MAX(COALESCE(fd.flete_cobrado, 0)) AS flete_cobrado,
      MAX(doc_ovr.commission_pct) AS override_pct,
      MAX(cli_ovr.commission_pct) AS client_pct
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
    ${commonWhere}
    GROUP BY fv."idmaeedo"
    HAVING SUM(fv."monto") <> 0
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
    };
  });

  const documents = ((documentsResult.rows || []) as any[]).map((r) => {
    const revenue = num(r.revenue);
    const cost = num(r.cost);
    const margin = revenue - cost;
    const fleteCobrado = num(r.flete_cobrado);
    const fleteObjetivo = revenue * FLETE_RATE;
    const fleteDeficit = Math.max(0, fleteObjetivo - fleteCobrado);
    const overridePct = r.override_pct == null ? null : num(r.override_pct);
    const clientPct = r.client_pct == null ? null : num(r.client_pct);
    return {
      document: r.document as string,
      numero: (r.numero as string) || r.document,
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
    };
  });

  return { salesperson, startDate, endDate, defaultPct, clients, documents };
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
}
