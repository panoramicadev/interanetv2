import sqlServerConnection from './sqlserver';
import { db } from './db';
import { sql } from 'drizzle-orm';

const START_2025 = '2025-01-01';
const END_2026 = '2026-01-01';
const TIPOS_DOC = ['FCV', 'FVL', 'NCV'];

interface WatermarkState {
  ult_feemli: string;
  ult_idmaeedo: number;
}

interface MaeedoRow {
  IDMAEEDO: number;
  TIDO: string;
  NUDO: string;
  FEEMDO: string;
  ENDO: string;
  SUENDO: string;
  KOFUDO: string;
  VANEDO: number;
  VAIVDO: number;
  VABRDO: number;
}

async function getWatermark(): Promise<WatermarkState> {
  console.log('📊 Obteniendo watermark...');
  const result = await db.execute(sql`
    SELECT ult_feemli, ult_idmaeedo 
    FROM ventas.etl_estado 
    WHERE id = 1
  `);
  
  const row = result.rows[0] as any;
  const watermark = {
    ult_feemli: row.ult_feemli,
    ult_idmaeedo: parseInt(row.ult_idmaeedo)
  };
  
  console.log(`   Última fecha: ${watermark.ult_feemli}, Último ID: ${watermark.ult_idmaeedo}`);
  return watermark;
}

async function updateWatermark(feemli: string, idmaeedo: number): Promise<void> {
  console.log(`📝 Actualizando watermark: fecha=${feemli}, id=${idmaeedo}`);
  await db.execute(sql`
    UPDATE ventas.etl_estado
    SET ult_feemli = ${feemli}::date,
        ult_idmaeedo = ${idmaeedo},
        actualizado_en = now()
    WHERE id = 1
  `);
}

async function fetchMaeedo(watermark: WatermarkState): Promise<MaeedoRow[]> {
  console.log('🔍 Extrayendo MAEEDO desde SQL Server...');
  
  const query = `
    SELECT
      e.IDMAEEDO, e.TIDO, e.NUDO,
      CAST(e.FEEMDO AS date) AS FEEMDO,
      e.ENDO, e.SUENDO, e.KOFUDO,
      e.VANEDO, e.VAIVDO, e.VABRDO
    FROM dbo.MAEEDO e
    WHERE e.TIDO IN ('FCV','FVL','NCV')
      AND e.FEEMDO >= '${START_2025}'
      AND e.FEEMDO < '${END_2026}'
      AND e.KOFUDO != 'FHP'
      AND (
            e.FEEMDO > '${watermark.ult_feemli}'
         OR (e.FEEMDO = '${watermark.ult_feemli}' AND e.IDMAEEDO > ${watermark.ult_idmaeedo})
          )
    ORDER BY e.FEEMDO ASC, e.IDMAEEDO ASC
  `;
  
  const result = await sqlServerConnection.query<MaeedoRow>(query);
  console.log(`   ✅ ${result.recordset.length} registros extraídos de MAEEDO`);
  return result.recordset;
}

async function fetchMaeddo(idmaeedos: number[]): Promise<any[]> {
  if (idmaeedos.length === 0) return [];
  
  console.log('🔍 Extrayendo MAEDDO desde SQL Server...');
  
  const ids = idmaeedos.join(',');
  const query = `
    SELECT
      d.IDMAEDDO, d.IDMAEEDO, d.TIDO, d.KOPRCT,
      d.NOKOPR, d.CAPRCO1, d.CAPRCO2, d.PPPRNE,
      d.POIVLI AS POIVPR, d.PPPRNELT, d.VANELI,
      d.FEEMLI, d.SULIDO, d.BOSULIDO
    FROM dbo.MAEDDO d
    WHERE d.IDMAEEDO IN (${ids})
    ORDER BY d.IDMAEEDO, d.IDMAEDDO
  `;
  
  const result = await sqlServerConnection.query(query);
  console.log(`   ✅ ${result.recordset.length} registros extraídos de MAEDDO`);
  return result.recordset;
}

async function fetchMaeen(endos: string[]): Promise<any[]> {
  if (endos.length === 0) return [];
  
  console.log('🔍 Extrayendo MAEEN desde SQL Server...');
  
  const endosList = endos.map(e => `'${e}'`).join(',');
  const query = `
    SELECT DISTINCT
      e.KOEN, e.NOKOEN, e.GIEN AS RUT, e.SUEN AS ZONA
    FROM dbo.MAEEN e
    WHERE e.KOEN IN (${endosList})
  `;
  
  const result = await sqlServerConnection.query(query);
  console.log(`   ✅ ${result.recordset.length} registros extraídos de MAEEN`);
  return result.recordset;
}

async function fetchMaepr(koprs: string[]): Promise<any[]> {
  if (koprs.length === 0) return [];
  
  console.log('🔍 Extrayendo MAEPR desde SQL Server...');
  
  const koprList = koprs.map(k => `'${k}'`).join(',');
  const query = `
    SELECT DISTINCT
      p.KOPR, p.NOKOPR AS NOMRPR, p.RUPR AS UD01PR, p.PFPR AS UD02PR, '' AS TIPR
    FROM dbo.MAEPR p
    WHERE p.KOPR IN (${koprList})
  `;
  
  const result = await sqlServerConnection.query(query);
  console.log(`   ✅ ${result.recordset.length} registros extraídos de MAEPR`);
  return result.recordset;
}

async function fetchMaeven(kofus: string[]): Promise<any[]> {
  if (kofus.length === 0) return [];
  
  console.log('🔍 Extrayendo TABFU (vendedores) desde SQL Server...');
  
  const kofuList = kofus.map(k => `'${k}'`).join(',');
  const query = `
    SELECT DISTINCT
      v.KOFU, v.NOKOFU
    FROM dbo.TABFU v
    WHERE v.KOFU IN (${kofuList})
  `;
  
  const result = await sqlServerConnection.query(query);
  console.log(`   ✅ ${result.recordset.length} registros extraídos de TABFU`);
  return result.recordset;
}

async function fetchTabbo(sulis: Array<{suli: string, bosuli: string}>): Promise<any[]> {
  if (sulis.length === 0) return [];
  
  console.log('🔍 Extrayendo TABBO desde SQL Server...');
  
  const conditions = sulis.map(s => `(b.KOSU = '${s.suli}' AND b.KOBO = '${s.bosuli}')`).join(' OR ');
  const query = `
    SELECT DISTINCT
      b.KOSU AS SULI, b.KOBO AS BOSULI, b.NOKOBO AS NOBOSULI
    FROM dbo.TABBO b
    WHERE ${conditions}
  `;
  
  const result = await sqlServerConnection.query(query);
  console.log(`   ✅ ${result.recordset.length} registros extraídos de TABBO`);
  return result.recordset;
}

async function fetchTabpp(koprs: string[]): Promise<any[]> {
  if (koprs.length === 0) return [];
  
  console.log('🔍 Extrayendo TABPP desde SQL Server...');
  
  const koprList = koprs.map(k => `'${k}'`).join(',');
  const query = `
    SELECT DISTINCT
      p.TILT AS KOPR, p.KOLT, '' AS ECUACION
    FROM dbo.TABPP p
    WHERE p.TILT IN (${koprList})
  `;
  
  const result = await sqlServerConnection.query(query);
  console.log(`   ✅ ${result.recordset.length} registros extraídos de TABPP`);
  return result.recordset;
}

async function loadToStaging(
  maeedo: any[],
  maeddo: any[],
  maeen: any[],
  maepr: any[],
  maeven: any[],
  tabbo: any[],
  tabpp: any[]
): Promise<void> {
  console.log('\n💾 Cargando datos a tablas staging...');
  
  await db.execute(sql`TRUNCATE TABLE ventas.stg_maeedo CASCADE`);
  await db.execute(sql`TRUNCATE TABLE ventas.stg_maeddo CASCADE`);
  await db.execute(sql`TRUNCATE TABLE ventas.stg_maeen CASCADE`);
  await db.execute(sql`TRUNCATE TABLE ventas.stg_maepr CASCADE`);
  await db.execute(sql`TRUNCATE TABLE ventas.stg_maeven CASCADE`);
  await db.execute(sql`TRUNCATE TABLE ventas.stg_tabbo CASCADE`);
  await db.execute(sql`TRUNCATE TABLE ventas.stg_tabpp CASCADE`);
  
  if (maeedo.length > 0) {
    const values = maeedo.map(r => {
      const feemdo = r.FEEMDO instanceof Date ? r.FEEMDO.toISOString().split('T')[0] : r.FEEMDO;
      return `(${r.IDMAEEDO}, '${r.TIDO}', '${r.NUDO}', '${feemdo}', '${r.ENDO}', '${r.SUENDO}', '${r.KOFUDO}', ${r.VANEDO}, ${r.VAIVDO}, ${r.VABRDO})`;
    }).join(',');
    
    await db.execute(sql.raw(`
      INSERT INTO ventas.stg_maeedo 
      (idmaeedo, tido, nudo, feemdo, endo, suendo, kofudo, vanedo, vaivdo, vabrdo)
      VALUES ${values}
    `));
    console.log(`   ✅ ${maeedo.length} registros cargados en stg_maeedo`);
  }
  
  if (maeddo.length > 0) {
    const values = maeddo.map(r => {
      const feemli = r.FEEMLI instanceof Date ? r.FEEMLI.toISOString().split('T')[0] : r.FEEMLI;
      const nokopr = (r.NOKOPR || '').replace(/'/g, "''");
      return `(${r.IDMAEDDO}, ${r.IDMAEEDO}, '${r.TIDO}', '${r.KOPRCT}', '${nokopr}', ${r.CAPRCO1}, ${r.CAPRCO2}, ${r.PPPRNE}, ${r.POIVPR}, ${r.PPPRNELT}, ${r.VANELI}, '${feemli}', '${r.SULIDO}', '${r.BOSULIDO}')`;
    }).join(',');
    
    await db.execute(sql.raw(`
      INSERT INTO ventas.stg_maeddo
      (idmaeddo, idmaeedo, tido, koprct, nokopr, caprco1, caprco2, ppprne, poivpr, ppprnelt, vaneli, feemli, sulido, bosulido)
      VALUES ${values}
    `));
    console.log(`   ✅ ${maeddo.length} registros cargados en stg_maeddo`);
  }
  
  if (maeen.length > 0) {
    const values = maeen.map(r => {
      const nokoen = (r.NOKOEN || '').replace(/'/g, "''");
      return `('${r.KOEN}', '${nokoen}', '${r.RUT || ''}', '${r.ZONA || ''}')`;
    }).join(',');
    
    await db.execute(sql.raw(`
      INSERT INTO ventas.stg_maeen (koen, nokoen, rut, zona)
      VALUES ${values}
      ON CONFLICT (koen) DO NOTHING
    `));
    console.log(`   ✅ ${maeen.length} registros procesados en stg_maeen`);
  }
  
  if (maepr.length > 0) {
    const values = maepr.map(r => {
      const nomrpr = (r.NOMRPR || '').replace(/'/g, "''");
      return `('${r.KOPR}', '${nomrpr}', '${r.UD01PR || ''}', '${r.UD02PR || ''}', '${r.TIPR || ''}')`;
    }).join(',');
    
    await db.execute(sql.raw(`
      INSERT INTO ventas.stg_maepr (kopr, nomrpr, ud01pr, ud02pr, tipr)
      VALUES ${values}
      ON CONFLICT (kopr) DO NOTHING
    `));
    console.log(`   ✅ ${maepr.length} registros procesados en stg_maepr`);
  }
  
  if (maeven.length > 0) {
    const values = maeven.map(r => {
      const nokofu = (r.NOKOFU || '').replace(/'/g, "''");
      return `('${r.KOFU}', '${nokofu}')`;
    }).join(',');
    
    await db.execute(sql.raw(`
      INSERT INTO ventas.stg_maeven (kofu, nokofu)
      VALUES ${values}
      ON CONFLICT (kofu) DO NOTHING
    `));
    console.log(`   ✅ ${maeven.length} registros procesados en stg_maeven`);
  }
  
  if (tabbo.length > 0) {
    const values = tabbo.map(r => {
      const nobosuli = (r.NOBOSULI || '').replace(/'/g, "''");
      return `('${r.SULI}', '${r.BOSULI}', '${nobosuli}')`;
    }).join(',');
    
    await db.execute(sql.raw(`
      INSERT INTO ventas.stg_tabbo (suli, bosuli, nobosuli)
      VALUES ${values}
      ON CONFLICT (suli, bosuli) DO NOTHING
    `));
    console.log(`   ✅ ${tabbo.length} registros procesados en stg_tabbo`);
  }
  
  if (tabpp.length > 0) {
    const values = tabpp.map(r =>
      `('${r.KOPR}', '${r.KOLT || ''}', '${r.ECUACION || ''}')`
    ).join(',');
    
    await db.execute(sql.raw(`
      INSERT INTO ventas.stg_tabpp (kopr, kolt, ecuacion)
      VALUES ${values}
      ON CONFLICT (kopr, kolt) DO NOTHING
    `));
    console.log(`   ✅ ${tabpp.length} registros procesados en stg_tabpp`);
  }
}

async function loadToFactVentas(): Promise<void> {
  console.log('\n📊 Cargando datos a fact_ventas desde staging...');
  
  await db.execute(sql`
    INSERT INTO ventas.fact_ventas (
      idmaeddo, idmaeedo, tido, nudo, feemdo, feemli,
      endo, suendo, sulido, bosulido, kofudo,
      vanedo, vaivdo, vabrdo,
      koprct, nokoprct, caprco1, caprco2, ppprne, vaneli,
      monto,
      nokoen, zona,
      ud01pr, ud02pr, tipr,
      nokofu,
      nobosuli
    )
    SELECT
      d.idmaeddo, d.idmaeedo, d.tido, CAST(e.nudo AS BIGINT), e.feemdo, d.feemli,
      TRIM(e.endo), TRIM(e.suendo), 
      CASE 
        WHEN TRIM(d.sulido) ~ '^[0-9]+$' THEN CAST(TRIM(d.sulido) AS BIGINT)
        ELSE NULL 
      END,
      CASE 
        WHEN TRIM(d.bosulido) ~ '^[0-9]+$' THEN CAST(TRIM(d.bosulido) AS BIGINT)
        ELSE NULL 
      END,
      e.kofudo,
      e.vanedo, e.vaivdo, e.vabrdo,
      d.koprct, d.nokopr, d.caprco1, d.caprco2, d.ppprne, d.vaneli,
      CASE 
        WHEN d.tido = 'NCV' THEN -(d.caprco2 * d.ppprne)
        ELSE (d.caprco2 * d.ppprne)
      END as monto,
      en.nokoen, CAST(NULLIF(TRIM(en.zona), '') AS NUMERIC),
      pr.ud01pr, pr.ud02pr, pr.tipr,
      v.nokofu,
      b.nobosuli
    FROM ventas.stg_maeddo d
    JOIN ventas.stg_maeedo e ON d.idmaeedo = e.idmaeedo
    LEFT JOIN ventas.stg_maeen en ON TRIM(e.endo) = TRIM(en.koen)
    LEFT JOIN ventas.stg_maepr pr ON d.koprct = pr.kopr
    LEFT JOIN ventas.stg_maeven v ON e.kofudo = v.kofu
    LEFT JOIN ventas.stg_tabbo b ON (TRIM(d.sulido) = TRIM(b.suli) AND TRIM(d.bosulido) = TRIM(b.bosuli))
    ON CONFLICT (idmaeddo) DO UPDATE SET
      feemli = EXCLUDED.feemli,
      vanedo = EXCLUDED.vanedo,
      vaivdo = EXCLUDED.vaivdo,
      vabrdo = EXCLUDED.vabrdo,
      monto = EXCLUDED.monto
  `);
  
  const countResult = await db.execute(sql`SELECT COUNT(*) as count FROM ventas.fact_ventas`);
  const count = (countResult.rows[0] as any).count;
  console.log(`   ✅ fact_ventas ahora tiene ${count} registros en total`);
}

export async function runETL(): Promise<void> {
  console.log('🚀 Iniciando ETL de Ventas (2025 en adelante, TIDO: FCV, FVL, NCV, excluye FHP)\n');
  
  try {
    await sqlServerConnection.reset();
    
    const watermark = await getWatermark();
    const maeedo = await fetchMaeedo(watermark);
    
    if (maeedo.length === 0) {
      console.log('\n✨ No hay nuevos datos para procesar');
      return;
    }
    
    const idmaeedos = maeedo.map(r => r.IDMAEEDO);
    const endos = Array.from(new Set(maeedo.map(r => r.ENDO)));
    
    const maeddo = await fetchMaeddo(idmaeedos);
    const koprs = Array.from(new Set(maeddo.map((r: any) => r.KOPRCT)));
    
    const maeen = await fetchMaeen(endos);
    const maepr = await fetchMaepr(koprs);
    
    const kofus = Array.from(new Set(maeedo.map(r => r.KOFUDO)));
    const maeven = await fetchMaeven(kofus);
    
    const sulis = Array.from(new Set(maeddo.map((r: any) => JSON.stringify({ suli: r.SULIDO, bosuli: r.BOSULIDO })))).map(s => JSON.parse(s));
    const tabbo = await fetchTabbo(sulis);
    const tabpp = await fetchTabpp(koprs);
    
    await loadToStaging(maeedo, maeddo, maeen, maepr, maeven, tabbo, tabpp);
    await loadToFactVentas();
    
    const lastRecord = maeedo[maeedo.length - 1];
    await updateWatermark(lastRecord.FEEMDO, lastRecord.IDMAEEDO);
    
    console.log('\n✅ ETL completado exitosamente\n');
    
  } catch (error) {
    console.error('\n❌ Error durante el ETL:', error);
    throw error;
  } finally {
    await sqlServerConnection.close();
  }
}
