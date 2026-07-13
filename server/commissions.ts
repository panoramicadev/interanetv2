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
 * Diseño resiliente (igual que server/permissions.ts): las tablas se
 * crean en runtime con CREATE TABLE IF NOT EXISTS porque el runner de
 * migraciones no es confiable en producción.
 */
import type { Express } from "express";
import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { db } from "./db";
import { commissionSettings, commissionExclusions } from "../shared/schema";
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
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS commission_exclusions (
          id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
          salesperson_name varchar NOT NULL,
          exclusion_type varchar NOT NULL,
          value varchar NOT NULL,
          note varchar,
          created_by varchar,
          created_at timestamp DEFAULT now()
        )
      `);
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "IDX_commission_excl_salesperson"
        ON commission_exclusions (salesperson_name)
      `);
      await db.execute(sql`
        CREATE UNIQUE INDEX IF NOT EXISTS "UQ_commission_excl_person_type_value"
        ON commission_exclusions (salesperson_name, exclusion_type, value)
      `);
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
 * Resumen por vendedor: venta bruta/neta, costo, margen y comisión.
 * "Bruto" = todo lo facturado; "neto" = descontando lo excluido
 * (clientes o documentos). La comisión se calcula sobre el margen neto.
 */
async function getCommissionSummary(startDate: string, endDate: string) {
  const result = await db.execute(sql`
    WITH lineas AS (
      SELECT
        fv."nokofu" AS salesperson,
        fv."monto" AS revenue,
        ${COST_EXPR} AS cost,
        EXISTS (
          SELECT 1 FROM commission_exclusions ce
          WHERE ce.salesperson_name = fv."nokofu"
            AND (
              (ce.exclusion_type = 'client' AND ce.value = fv."nokoen")
              OR (ce.exclusion_type = 'document' AND ce.value = fv."idmaeedo"::text)
            )
        ) AS excluded
      FROM ${FACT_JOINS}
      WHERE fv."tido" = 'FCV'
        AND fv."nokofu" IS NOT NULL AND fv."nokofu" != ''
        AND fv."monto" IS NOT NULL
        AND fv."feemdo" >= ${startDate}::date
        AND fv."feemdo" <= ${endDate}::date
    )
    SELECT
      salesperson,
      SUM(revenue) AS gross_revenue,
      SUM(cost) AS gross_cost,
      SUM(CASE WHEN excluded THEN 0 ELSE revenue END) AS net_revenue,
      SUM(CASE WHEN excluded THEN 0 ELSE cost END) AS net_cost,
      COUNT(*) AS line_count,
      SUM(CASE WHEN excluded THEN 1 ELSE 0 END) AS excluded_line_count
    FROM lineas
    GROUP BY salesperson
    HAVING SUM(revenue) > 0
    ORDER BY SUM(CASE WHEN excluded THEN 0 ELSE revenue END) DESC
  `);

  const rows = (result.rows || []) as any[];

  // % configurados por vendedor
  const settings = await db.select().from(commissionSettings);
  const pctByName = new Map<string, number>();
  for (const s of settings) pctByName.set(s.salespersonName, num(s.commissionPct));

  const items = rows.map((r) => {
    const grossRevenue = num(r.gross_revenue);
    const grossCost = num(r.gross_cost);
    const netRevenue = num(r.net_revenue);
    const netCost = num(r.net_cost);
    const netMargin = netRevenue - netCost;
    const commissionPct = pctByName.get(r.salesperson) ?? 0;
    const commissionAmount = (netMargin * commissionPct) / 100;
    return {
      salesperson: r.salesperson as string,
      grossRevenue,
      netRevenue,
      grossCost,
      netCost,
      grossMargin: grossRevenue - grossCost,
      netMargin,
      netMarginPct: netRevenue > 0 ? (netMargin / netRevenue) * 100 : 0,
      lineCount: num(r.line_count),
      excludedLineCount: num(r.excluded_line_count),
      commissionPct,
      commissionAmount,
    };
  });

  const totals = items.reduce(
    (acc, it) => {
      acc.netRevenue += it.netRevenue;
      acc.netMargin += it.netMargin;
      acc.commissionAmount += it.commissionAmount;
      return acc;
    },
    { netRevenue: 0, netMargin: 0, commissionAmount: 0 },
  );

  return { startDate, endDate, items, totals };
}

/**
 * Detalle de un vendedor: desglose por cliente y por documento (venta),
 * con el flag `excluded` para que RRHH pueda marcar/desmarcar exclusiones.
 */
async function getSalespersonDetail(salesperson: string, startDate: string, endDate: string) {
  const commonWhere = sql`
    WHERE fv."tido" = 'FCV'
      AND fv."nokofu" = ${salesperson}
      AND fv."monto" IS NOT NULL
      AND fv."feemdo" >= ${startDate}::date
      AND fv."feemdo" <= ${endDate}::date
  `;

  const clientsResult = await db.execute(sql`
    SELECT
      COALESCE(fv."nokoen", 'SIN CLIENTE') AS client,
      SUM(fv."monto") AS revenue,
      SUM(${COST_EXPR}) AS cost,
      COUNT(*) AS line_count,
      bool_or(
        EXISTS (
          SELECT 1 FROM commission_exclusions ce
          WHERE ce.salesperson_name = ${salesperson}
            AND ce.exclusion_type = 'client'
            AND ce.value = fv."nokoen"
        )
      ) AS excluded
    FROM ${FACT_JOINS}
    ${commonWhere}
    GROUP BY COALESCE(fv."nokoen", 'SIN CLIENTE')
    HAVING SUM(fv."monto") <> 0
    ORDER BY SUM(fv."monto") DESC
  `);

  const documentsResult = await db.execute(sql`
    SELECT
      fv."idmaeedo"::text AS document,
      MAX(fv."nudo"::text) AS numero,
      MAX(fv."nokoen") AS client,
      MAX(fv."feemdo") AS fecha,
      SUM(fv."monto") AS revenue,
      SUM(${COST_EXPR}) AS cost,
      COUNT(*) AS line_count,
      bool_or(
        EXISTS (
          SELECT 1 FROM commission_exclusions ce
          WHERE ce.salesperson_name = ${salesperson}
            AND ce.exclusion_type = 'document'
            AND ce.value = fv."idmaeedo"::text
        )
      ) AS doc_excluded,
      bool_or(
        EXISTS (
          SELECT 1 FROM commission_exclusions ce
          WHERE ce.salesperson_name = ${salesperson}
            AND ce.exclusion_type = 'client'
            AND ce.value = fv."nokoen"
        )
      ) AS client_excluded
    FROM ${FACT_JOINS}
    ${commonWhere}
      AND fv."idmaeedo" IS NOT NULL
    GROUP BY fv."idmaeedo"
    HAVING SUM(fv."monto") <> 0
    ORDER BY MAX(fv."feemdo") DESC
  `);

  const clients = ((clientsResult.rows || []) as any[]).map((r) => {
    const revenue = num(r.revenue);
    const cost = num(r.cost);
    return {
      client: r.client as string,
      revenue,
      cost,
      margin: revenue - cost,
      lineCount: num(r.line_count),
      excluded: !!r.excluded,
    };
  });

  const documents = ((documentsResult.rows || []) as any[]).map((r) => {
    const revenue = num(r.revenue);
    const cost = num(r.cost);
    return {
      document: r.document as string,
      numero: (r.numero as string) || r.document,
      client: (r.client as string) || "SIN CLIENTE",
      fecha: r.fecha as string,
      revenue,
      cost,
      margin: revenue - cost,
      lineCount: num(r.line_count),
      excluded: !!r.doc_excluded,
      clientExcluded: !!r.client_excluded,
    };
  });

  return { salesperson, startDate, endDate, clients, documents };
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

  // Fijar/quitar una exclusión (cliente o documento) de un vendedor.
  // excluded=true la crea; excluded=false la elimina.
  app.put("/api/hr/commissions/exclusions", requireAuth, guard, async (req: any, res) => {
    try {
      const parsed = z.object({
        salespersonName: z.string().trim().min(1).max(255),
        exclusionType: z.enum(["client", "document"]),
        value: z.string().trim().min(1).max(255),
        excluded: z.boolean(),
        note: z.string().trim().max(500).optional(),
      }).safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Formato inválido", errors: parsed.error.flatten() });
      }
      await ensureTables();
      const { salespersonName, exclusionType, value, excluded, note } = parsed.data;
      if (excluded) {
        await db.insert(commissionExclusions)
          .values({
            salespersonName,
            exclusionType,
            value,
            note: note || null,
            createdBy: req.user?.id || null,
            createdAt: new Date(),
          })
          .onConflictDoNothing({
            target: [commissionExclusions.salespersonName, commissionExclusions.exclusionType, commissionExclusions.value],
          });
      } else {
        await db.delete(commissionExclusions).where(
          and(
            eq(commissionExclusions.salespersonName, salespersonName),
            eq(commissionExclusions.exclusionType, exclusionType),
            eq(commissionExclusions.value, value),
          ),
        );
      }
      res.json({ salespersonName, exclusionType, value, excluded });
    } catch (error: any) {
      console.error("Error guardando exclusión de comisión:", error);
      res.status(500).json({ message: "Error guardando la exclusión: " + (error?.message || "desconocido") });
    }
  });
}
