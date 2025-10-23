import mssql from 'mssql';
import { db } from './db';
import { sql, desc, eq } from 'drizzle-orm';
import { 
  stgMaeedo, 
  stgMaeddo, 
  stgMaeen, 
  stgMaepr, 
  stgMaeven, 
  stgTabbo, 
  stgTabpp,
  factVentas,
  etlExecutionLog,
  etlConfig
} from '../shared/schema';

const sqlServerConfig: mssql.config = {
  server: process.env.SQL_SERVER_HOST || '',
  port: parseInt(process.env.SQL_SERVER_PORT || '1433'),
  user: process.env.SQL_SERVER_USER || '',
  password: process.env.SQL_SERVER_PASSWORD || '',
  database: process.env.SQL_SERVER_DATABASE || '',
  options: {
    encrypt: true,
    trustServerCertificate: true,
    enableArithAbort: true,
  },
  connectionTimeout: 30000,
  requestTimeout: 60000,
};

interface ETLResult {
  success: boolean;
  recordsProcessed: number;
  executionTimeMs: number;
  period: string;
  watermarkDate: Date;
  error?: string;
}

function cleanNumeric(value: any): number {
  if (value === null || value === undefined || value === '') return 0;
  const str = String(value).replace(/[^0-9.-]/g, '');
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

async function getLastWatermark(etlName: string = 'ventas_incremental'): Promise<Date> {
  // Verificar si hay configuración personalizada
  const config = await db
    .select()
    .from(etlConfig)
    .where(eq(etlConfig.etlName, etlName))
    .limit(1);

  // Si hay configuración personalizada activa, usarla
  if (config.length > 0 && config[0].useCustomWatermark && config[0].customWatermark) {
    console.log(`📍 Usando watermark personalizado: ${new Date(config[0].customWatermark).toISOString()}`);
    return new Date(config[0].customWatermark);
  }

  // Obtener el último watermark de ejecución exitosa
  const lastExecution = await db
    .select()
    .from(etlExecutionLog)
    .where(sql`status = 'success' AND etl_name = ${etlName}`)
    .orderBy(desc(etlExecutionLog.watermarkDate))
    .limit(1);

  if (lastExecution.length > 0 && lastExecution[0].watermarkDate) {
    return new Date(lastExecution[0].watermarkDate);
  }

  // Si no hay ejecuciones previas, comenzar desde 2025-01-01
  return new Date('2025-01-01');
}

export async function getETLConfig(etlName: string = 'ventas_incremental') {
  const config = await db
    .select()
    .from(etlConfig)
    .where(eq(etlConfig.etlName, etlName))
    .limit(1);

  if (config.length > 0) {
    return config[0];
  }

  // Crear configuración por defecto si no existe
  const [newConfig] = await db.insert(etlConfig).values({
    etlName,
    useCustomWatermark: false,
    timeoutMinutes: 10,
    intervalMinutes: 15,
  }).returning();

  return newConfig;
}

export async function executeIncrementalETL(etlName: string = 'ventas_incremental'): Promise<ETLResult> {
  const startTime = Date.now();
  let pool: mssql.ConnectionPool | null = null;
  const tiposDoc = ['FCV', 'GDV', 'FVL', 'NCV', 'BLV', 'FDV'];
  const sucursales = ['004', '006', '007'];
  let timeoutHandle: NodeJS.Timeout | null = null;
  let timedOut = false;

  try {
    console.log('\n🔄 INICIANDO ETL INCREMENTAL');
    console.log('═══════════════════════════════════════════════════');

    // Obtener configuración ETL (incluye timeout)
    const config = await getETLConfig(etlName);
    const timeoutMs = config.timeoutMinutes * 60 * 1000;

    // Obtener el último watermark
    const lastWatermark = await getLastWatermark(etlName);
    const currentWatermark = new Date();
    
    // Configurar timeout automático
    timeoutHandle = setTimeout(async () => {
      timedOut = true;
      console.log(`\n⏱️  TIMEOUT: ETL excedió el límite de ${config.timeoutMinutes} minutos`);
      
      // Marcar ejecución como cancelada por timeout
      try {
        const runningExecution = await db
          .select()
          .from(etlExecutionLog)
          .where(sql`status = 'running' AND etl_name = ${etlName}`)
          .orderBy(desc(etlExecutionLog.executionDate))
          .limit(1);

        if (runningExecution.length > 0) {
          await db.update(etlExecutionLog)
            .set({
              status: 'error',
              errorMessage: `Cancelado automáticamente por timeout (${config.timeoutMinutes} minutos)`,
              executionTimeMs: Date.now() - startTime,
            })
            .where(sql`id = ${runningExecution[0].id}`);
        }
      } catch (timeoutError) {
        console.error('Error al marcar timeout:', timeoutError);
      }
      
      // Cerrar conexión SQL Server si está abierta
      if (pool) {
        try {
          await pool.close();
        } catch (closeError) {
          console.error('Error cerrando pool por timeout:', closeError);
        }
      }
    }, timeoutMs);

    console.log(`⏱️  Timeout configurado: ${config.timeoutMinutes} minutos`);
    
    console.log(`📅 Período incremental:`);
    console.log(`   ETL: ${etlName}`);
    console.log(`   Desde: ${lastWatermark.toISOString()}`);
    console.log(`   Hasta: ${currentWatermark.toISOString()}`);
    console.log(`   Tipos documento: ${tiposDoc.join(', ')}`);
    console.log(`   Sucursales: ${sucursales.join(', ')}\n`);

    // Conectar a SQL Server
    console.log('🔄 Conectando a SQL Server...');
    pool = await mssql.connect(sqlServerConfig);
    console.log('✅ Conectado a SQL Server\n');

    // Registrar inicio de ejecución
    const periodLabel = `${lastWatermark.toISOString().split('T')[0]} to ${currentWatermark.toISOString().split('T')[0]}`;
    const [executionLog] = await db.insert(etlExecutionLog).values({
      etlName,
      status: 'running',
      period: periodLabel,
      documentTypes: tiposDoc.join(','),
      branches: sucursales.join(','),
      watermarkDate: currentWatermark,
    }).returning();

    // Limpiar tablas staging
    console.log('🧹 Limpiando tablas staging...');
    await db.execute(sql`TRUNCATE TABLE ventas.stg_maeedo CASCADE`);
    await db.execute(sql`TRUNCATE TABLE ventas.stg_maeddo CASCADE`);
    await db.execute(sql`TRUNCATE TABLE ventas.stg_maeen CASCADE`);
    await db.execute(sql`TRUNCATE TABLE ventas.stg_maepr CASCADE`);
    await db.execute(sql`TRUNCATE TABLE ventas.stg_maeven CASCADE`);
    await db.execute(sql`TRUNCATE TABLE ventas.stg_tabbo CASCADE`);
    await db.execute(sql`TRUNCATE TABLE ventas.stg_tabpp CASCADE`);
    console.log('✅ Tablas staging limpias\n');

    // 1. EXTRAER MAEEDO (solo registros modificados desde el último watermark)
    console.log('1️⃣  Extrayendo MAEEDO (Encabezados modificados)...');
    const maeedo = await pool.request().query(`
      SELECT *
      FROM dbo.MAEEDO
      WHERE TIDO IN (${tiposDoc.map(t => `'${t}'`).join(',')})
        AND SUDO IN (${sucursales.map(s => `'${s}'`).join(',')})
        AND YEAR(FEEMDO) >= 2024
        AND FEER >= '${lastWatermark.toISOString().split('T')[0]}'
      ORDER BY FEEMDO
    `);
    
    if (maeedo.recordset.length === 0) {
      console.log('   ℹ️  No hay registros nuevos para procesar');
      
      await db.update(etlExecutionLog)
        .set({
          status: 'success',
          recordsProcessed: 0,
          executionTimeMs: Date.now() - startTime,
        })
        .where(sql`id = ${executionLog.id}`);

      await pool.close();
      
      return {
        success: true,
        recordsProcessed: 0,
        executionTimeMs: Date.now() - startTime,
        period: periodLabel,
        watermarkDate: currentWatermark,
      };
    }

    console.log(`   ✅ ${maeedo.recordset.length} registros encontrados`);

    // Cargar MAEEDO a staging
    for (const row of maeedo.recordset) {
      await db.insert(stgMaeedo).values({
        idmaeedo: cleanNumeric(row.IDMAEEDO),
        empresa: row.EMPRESA?.trim() || null,
        tido: row.TIDO?.trim() || null,
        nudo: row.NUDO?.trim() || null,
        endo: row.ENDO?.trim() || null,
        suendo: row.SUENDO?.trim() || null,
        endofi: row.ENDOFI?.trim() || null,
        tigedo: row.TIGEDO?.trim() || null,
        sudo: row.SUDO?.trim() || null,
        luvtdo: row.LUVTDO?.trim() || null,
        feemdo: row.FEEMDO || null,
        kofudo: row.KOFUDO?.trim() || null,
        esdo: row.ESDO?.trim() || null,
        espgdo: row.ESPGDO?.trim() || null,
        suli: row.SULI?.trim() || null,
        bosulido: row.BOSULIDO?.trim() || null,
        feer: row.FEER || null,
        vanedo: cleanNumeric(row.VANEDO),
        vaivdo: cleanNumeric(row.VAIVDO),
        vabrdo: cleanNumeric(row.VABRDO),
        lilg: row.LILG?.trim() || null,
        modo: row.MODO?.trim() || null,
        timodo: row.TIMODO?.trim() || null,
        tamodo: cleanNumeric(row.TAMODO),
        ocdo: row.OCDO?.trim() || null,
      });
    }

    // 2. EXTRAER MAEDDO (detalles de los documentos modificados)
    console.log('2️⃣  Extrayendo MAEDDO (Detalles)...');
    const idmaeedos = maeedo.recordset.map(r => r.IDMAEEDO);
    const maeddo = await pool.request().query(`
      SELECT *
      FROM dbo.MAEDDO
      WHERE IDMAEEDO IN (${idmaeedos.join(',')})
    `);
    console.log(`   ✅ ${maeddo.recordset.length} registros encontrados`);

    // Cargar MAEDDO
    for (const row of maeddo.recordset) {
      await db.insert(stgMaeddo).values({
        idmaeddo: cleanNumeric(row.IDMAEDDO),
        idmaeedo: cleanNumeric(row.IDMAEEDO),
        koprct: row.KOPRCT?.trim() || null,
        nokopr: row.NOKOPR?.trim() || null,
        udtrpr: row.UDTRPR ? String(row.UDTRPR).trim() : null,
        caprco: cleanNumeric(row.CAPRCO),
        preuni: cleanNumeric(row.PREUNI),
        vaneli: cleanNumeric(row.VANELI),
        feemli: row.FEEMLI || null,
        feerli: row.FEERLI || null,
        devol1: cleanNumeric(row.DEVOL1),
        devol2: cleanNumeric(row.DEVOL2),
        stockfis: cleanNumeric(row.STOCKFIS),
      });
    }

    // 3. EXTRAER entidades (clientes únicos)
    console.log('3️⃣  Extrayendo MAEEN (Entidades)...');
    const kofudos = [...new Set(maeedo.recordset.map(r => r.KOFUDO))];
    const maeen = await pool.request().query(`
      SELECT KOEN, NOKOEN, RUEN, ZOEN
      FROM dbo.MAEEN
      WHERE KOEN IN (${kofudos.map(k => `'${k}'`).join(',')})
    `);
    console.log(`   ✅ ${maeen.recordset.length} registros encontrados`);

    for (const row of maeen.recordset) {
      await db.insert(stgMaeen).values({
        koen: row.KOEN?.trim() || '',
        nokoen: row.NOKOEN?.trim() || null,
        rut: row.RUEN?.trim() || null,
        zona: row.ZOEN?.trim() || null,
      });
    }

    // 4. EXTRAER productos únicos
    console.log('4️⃣  Extrayendo MAEPR (Productos)...');
    const koprcts = [...new Set(maeddo.recordset.map(r => r.KOPRCT))];
    const maepr = await pool.request().query(`
      SELECT KOPR, NOKOPR, UD01PR, UD02PR, TIPR
      FROM dbo.MAEPR
      WHERE KOPR IN (${koprcts.map(k => `'${k}'`).join(',')})
    `);
    console.log(`   ✅ ${maepr.recordset.length} registros encontrados`);

    for (const row of maepr.recordset) {
      await db.insert(stgMaepr).values({
        kopr: row.KOPR?.trim() || '',
        nomrpr: row.NOKOPR?.trim() || null,
        ud01pr: row.UD01PR?.trim() || null,
        ud02pr: row.UD02PR?.trim() || null,
        tipr: row.TIPR?.trim() || null,
      });
    }

    // 5. EXTRAER vendedores
    console.log('5️⃣  Extrayendo MAEVEN (Vendedores)...');
    const kofulidos = [...new Set(maeedo.recordset.map(r => r.KOFULIDO))];
    const maeven = await pool.request().query(`
      SELECT KOFU, NOKOFU
      FROM dbo.TABFU
      WHERE KOFU IN (${kofulidos.map(k => `'${k}'`).join(',')})
    `);
    console.log(`   ✅ ${maeven.recordset.length} registros encontrados`);

    for (const row of maeven.recordset) {
      await db.insert(stgMaeven).values({
        kofu: row.KOFU?.trim() || '',
        nokofu: row.NOKOFU?.trim() || null,
      });
    }

    // 6. EXTRAER bodegas únicas
    console.log('6️⃣  Extrayendo TABBO (Bodegas)...');
    const sulis = [...new Set(maeedo.recordset.map(r => r.SULI))];
    const bosulis = [...new Set(maeedo.recordset.map(r => r.BOSULIDO))];
    
    const tabbo = await pool.request().query(`
      SELECT EMPRESA, KOBO, NOKOBO
      FROM dbo.TABBO
      WHERE EMPRESA IN (${sulis.map(s => `'${s}'`).join(',')})
        AND KOBO IN (${bosulis.map(b => `'${b}'`).join(',')})
    `);
    console.log(`   ✅ ${tabbo.recordset.length} registros encontrados`);

    for (const row of tabbo.recordset) {
      await db.insert(stgTabbo).values({
        suli: row.EMPRESA?.trim() || '',
        bosuli: row.KOBO?.trim() || '',
        nobosuli: row.NOKOBO?.trim() || null,
      });
    }

    // 7. EXTRAER propiedades de productos desde MAEPR
    console.log('7️⃣  Extrayendo TABPP (Propiedades Productos desde MAEPR)...');
    const tabpp = await pool.request().query(`
      SELECT DISTINCT
        pr.KOPR,
        pr.PM as listacost,
        pr.PM as liscosmod
      FROM dbo.MAEPR pr
      WHERE pr.KOPR IN (${koprcts.map(k => `'${k}'`).join(',')})
    `);
    console.log(`   ✅ ${tabpp.recordset.length} registros encontrados`);

    for (const row of tabpp.recordset) {
      await db.insert(stgTabpp).values({
        kopr: row.KOPR?.trim() || '',
        listacost: cleanNumeric(row.listacost),
        liscosmod: cleanNumeric(row.liscosmod),
      });
    }

    // 8. PROCESAR A FACT_VENTAS (UPSERT - eliminar registros antiguos e insertar nuevos)
    console.log('8️⃣  Procesando FACT_VENTAS (UPSERT)...');
    
    // Primero eliminar registros existentes de los documentos modificados
    const idmaeddosToDelete = maeddo.recordset.map(r => cleanNumeric(r.IDMAEDDO));
    if (idmaeddosToDelete.length > 0) {
      await db.execute(sql`
        DELETE FROM ventas.fact_ventas 
        WHERE idmaeddo IN (${sql.raw(idmaeddosToDelete.join(','))})
      `);
    }

    // Insertar registros actualizados
    const factQuery = await db.execute(sql`
      INSERT INTO ventas.fact_ventas (
        idmaeddo, idmaeedo, tido, nudo, endo, suendo, sudo, feemdo, feulvedo,
        esdo, espgdo, kofudo, modo, timodo, tamodo, caprad, caprex, vanedo, vaivdo, vabrdo,
        lilg, nulido, sulido, luvtlido, bosulido, kofulido, prct, tict, tipr, nusepr,
        koprct, udtrpr, rludpr, caprco1, caprad1, caprex1, caprnc1, ud01pr,
        caprco2, caprad2, caprex2, caprnc2, ud02pr, ppprne, ppprbr, vaneli, vabrli,
        feemli, feerli, ppprpm, ppprpmifrs, logistica, eslido, ppprnere1, ppprnere2,
        fmpr, mrpr, zona, ruen, recaprre, pfpr, hfpr, monto, ocdo,
        nokoprct, nokozo, nosudo, nokofu, nokofudo, nobosuli, nokoen, noruen,
        nomrpr, nofmpr, nopfpr, nohfpr, devol1, devol2, stockfis, listacost, liscosmod
      )
      SELECT 
        dd.idmaeddo,
        dd.idmaeedo,
        ed.tido,
        CAST(ed.nudo AS NUMERIC(20,0)),
        ed.endo,
        ed.suendo,
        CAST(ed.sudo AS NUMERIC(20,0)),
        ed.feemdo,
        ed.feer,
        ed.esdo,
        ed.espgdo,
        ed.kofudo,
        ed.modo,
        ed.timodo,
        ed.tamodo,
        CAST(NULL AS NUMERIC(20,0)),
        CAST(NULL AS NUMERIC(20,0)),
        ed.vanedo,
        ed.vaivdo,
        ed.vabrdo,
        ed.lilg,
        CAST(NULL AS NUMERIC(20,0)),
        CAST(NULL AS NUMERIC(20,0)),
        CAST(NULL AS NUMERIC(18,6)),
        CAST(ed.bosulido AS NUMERIC(20,0)),
        ed.kofudo,
        false,
        CAST(NULL AS NUMERIC(18,6)),
        pr.tipr,
        CAST(NULL AS NUMERIC(18,6)),
        dd.koprct,
        CAST(dd.udtrpr AS NUMERIC(20,0)),
        CAST(NULL AS NUMERIC(18,6)),
        dd.caprco,
        CAST(NULL AS NUMERIC(18,6)),
        CAST(NULL AS NUMERIC(18,6)),
        CAST(NULL AS NUMERIC(18,6)),
        pr.ud01pr,
        CAST(dd.caprco AS NUMERIC(20,0)),
        CAST(NULL AS NUMERIC(20,0)),
        CAST(NULL AS NUMERIC(20,0)),
        CAST(NULL AS NUMERIC(20,0)),
        pr.ud02pr,
        dd.preuni,
        CAST(NULL AS NUMERIC(18,6)),
        dd.vaneli,
        CAST(NULL AS NUMERIC(20,0)),
        dd.feemli,
        dd.feerli,
        CAST(NULL AS NUMERIC(18,6)),
        CAST(NULL AS NUMERIC(18,6)),
        CAST(NULL AS NUMERIC(20,0)),
        CAST(NULL AS TEXT),
        CAST(NULL AS NUMERIC(18,6)),
        CAST(NULL AS NUMERIC(18,6)),
        CAST(NULL AS NUMERIC(20,0)),
        CAST(NULL AS NUMERIC(18,6)),
        CASE WHEN en.zona ~ '^[0-9]+\.?[0-9]*$' THEN CAST(en.zona AS NUMERIC(18,6)) ELSE NULL END,
        CASE WHEN en.rut ~ '^[0-9]+\.?[0-9]*$' THEN CAST(en.rut AS NUMERIC(18,6)) ELSE NULL END,
        false,
        CAST(NULL AS NUMERIC(18,6)),
        CAST(NULL AS NUMERIC(18,6)),
        CASE 
          WHEN ed.tido = 'NCV' THEN CAST(dd.caprco AS NUMERIC(20,0)) * dd.preuni * -1
          ELSE CAST(dd.caprco AS NUMERIC(20,0)) * dd.preuni
        END,
        ed.ocdo,
        dd.nokopr,
        CAST(NULL AS NUMERIC(18,6)),
        CAST(NULL AS TEXT),
        ve.nokofu,
        en.nokoen,
        bo.nobosuli,
        en.nokoen,
        en.rut,
        CASE WHEN pr.nomrpr ~ '^[0-9]+\.?[0-9]*$' THEN CAST(pr.nomrpr AS NUMERIC(18,6)) ELSE NULL END,
        CAST(NULL AS TEXT),
        CAST(NULL AS TEXT),
        CAST(NULL AS TEXT),
        dd.devol1,
        dd.devol2,
        dd.stockfis,
        pp.listacost,
        pp.liscosmod
      FROM ventas.stg_maeddo dd
      INNER JOIN ventas.stg_maeedo ed ON dd.idmaeedo = ed.idmaeedo
      LEFT JOIN ventas.stg_maeen en ON ed.kofudo = en.koen
      LEFT JOIN ventas.stg_maepr pr ON dd.koprct = pr.kopr
      LEFT JOIN ventas.stg_maeven ve ON ed.kofudo = ve.kofu
      LEFT JOIN ventas.stg_tabbo bo ON ed.suli = bo.suli AND ed.bosulido = bo.bosuli
      LEFT JOIN ventas.stg_tabpp pp ON dd.koprct = pp.kopr
    `);

    const recordsProcessed = maeddo.recordset.length;
    console.log(`   ✅ ${recordsProcessed} registros procesados\n`);

    // 9. VALIDACIÓN POST-ETL: Verificar campos críticos
    console.log('9️⃣  Validando datos críticos...');
    const validationResult = await db.execute(sql`
      SELECT 
        COUNT(*) as total_registros,
        SUM(CASE WHEN feemdo IS NULL THEN 1 ELSE 0 END) as null_feemdo,
        SUM(CASE WHEN feulvedo IS NULL THEN 1 ELSE 0 END) as null_feulvedo,
        SUM(CASE WHEN sudo IS NULL THEN 1 ELSE 0 END) as null_sudo,
        SUM(CASE WHEN esdo IS NULL THEN 1 ELSE 0 END) as null_esdo,
        SUM(CASE WHEN espgdo IS NULL THEN 1 ELSE 0 END) as null_espgdo
      FROM ventas.fact_ventas
      WHERE idmaeddo IN (${sql.raw(idmaeddosToDelete.join(','))})
    `);

    const validation = validationResult.rows[0];
    const hasNulls = 
      Number(validation.null_feemdo) > 0 || 
      Number(validation.null_feulvedo) > 0 || 
      Number(validation.null_sudo) > 0 || 
      Number(validation.null_esdo) > 0 || 
      Number(validation.null_espgdo) > 0;

    if (hasNulls) {
      console.log('   ⚠️  ADVERTENCIA: Se encontraron campos críticos NULL:');
      if (Number(validation.null_feemdo) > 0) console.log(`      - feemdo: ${validation.null_feemdo} registros`);
      if (Number(validation.null_feulvedo) > 0) console.log(`      - feulvedo: ${validation.null_feulvedo} registros`);
      if (Number(validation.null_sudo) > 0) console.log(`      - sudo: ${validation.null_sudo} registros`);
      if (Number(validation.null_esdo) > 0) console.log(`      - esdo: ${validation.null_esdo} registros`);
      if (Number(validation.null_espgdo) > 0) console.log(`      - espgdo: ${validation.null_espgdo} registros`);
    } else {
      console.log(`   ✅ Todos los campos críticos completos (${validation.total_registros} registros validados)\n`);
    }

    // Actualizar log de ejecución
    await db.update(etlExecutionLog)
      .set({
        status: 'success',
        recordsProcessed: recordsProcessed,
        executionTimeMs: Date.now() - startTime,
        watermarkDate: currentWatermark,
      })
      .where(sql`id = ${executionLog.id}`);

    // Desactivar watermark personalizado solo si keepCustomWatermark es false
    if (!config.keepCustomWatermark) {
      await db.update(etlConfig)
        .set({
          useCustomWatermark: false,
          updatedAt: new Date(),
        })
        .where(eq(etlConfig.etlName, etlName));
    }

    // Limpiar timeout
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }

    await pool.close();

    console.log('╔═══════════════════════════════════════════════════╗');
    console.log('║     ✅ ETL INCREMENTAL COMPLETADO                 ║');
    console.log('╚═══════════════════════════════════════════════════╝\n');
    console.log(`📊 Registros procesados: ${recordsProcessed}`);
    console.log(`⏱️  Tiempo de ejecución: ${((Date.now() - startTime) / 1000).toFixed(2)}s\n`);

    return {
      success: true,
      recordsProcessed,
      executionTimeMs: Date.now() - startTime,
      period: periodLabel,
      watermarkDate: currentWatermark,
    };

  } catch (error: any) {
    console.error('\n❌ ERROR EN ETL INCREMENTAL:', error.message);
    
    const executionTimeMs = Date.now() - startTime;
    
    // Limpiar timeout si hubo error
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
    
    // Registrar error en el log (solo si no fue timeout)
    if (!timedOut) {
      try {
        await db.insert(etlExecutionLog).values({
          etlName,
          status: 'error',
          period: 'incremental',
          documentTypes: tiposDoc.join(','),
          branches: sucursales.join(','),
          executionTimeMs,
          errorMessage: error.message,
        });
      } catch (logError) {
        console.error('Error registrando fallo:', logError);
      }
    }

    if (pool) {
      await pool.close();
    }

    return {
      success: false,
      recordsProcessed: 0,
      executionTimeMs,
      period: 'incremental',
      watermarkDate: new Date(),
      error: timedOut ? `Timeout: Proceso cancelado automáticamente` : error.message,
    };
  }
}

export async function updateETLConfig(
  etlName: string,
  customWatermark?: Date | null,
  useCustomWatermark?: boolean,
  keepCustomWatermark?: boolean,
  timeoutMinutes?: number,
  intervalMinutes?: number
) {
  try {
    // Verificar si existe configuración
    const existing = await db
      .select()
      .from(etlConfig)
      .where(eq(etlConfig.etlName, etlName))
      .limit(1);

    if (existing.length > 0) {
      // Actualizar configuración existente
      const updateData: any = { updatedAt: new Date() };
      if (customWatermark !== undefined) updateData.customWatermark = customWatermark;
      if (useCustomWatermark !== undefined) updateData.useCustomWatermark = useCustomWatermark;
      if (keepCustomWatermark !== undefined) updateData.keepCustomWatermark = keepCustomWatermark;
      if (timeoutMinutes !== undefined) updateData.timeoutMinutes = timeoutMinutes;
      if (intervalMinutes !== undefined) updateData.intervalMinutes = intervalMinutes;

      const [updated] = await db.update(etlConfig)
        .set(updateData)
        .where(eq(etlConfig.etlName, etlName))
        .returning();

      return updated;
    } else {
      // Crear nueva configuración
      const [newConfig] = await db.insert(etlConfig).values({
        etlName,
        customWatermark: customWatermark || null,
        useCustomWatermark: useCustomWatermark || false,
        timeoutMinutes: timeoutMinutes || 10,
        intervalMinutes: intervalMinutes || 15,
      }).returning();

      return newConfig;
    }
  } catch (error: any) {
    console.error('Error updating ETL config:', error);
    throw error;
  }
}

export async function getETLStatus(
  etlName: string = 'ventas_incremental',
  startDate?: string,
  endDate?: string
) {
  try {
    // Build where conditions
    let whereConditions = eq(etlExecutionLog.etlName, etlName);
    
    // Add date filters if provided
    if (startDate && endDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      
      whereConditions = sql`${etlExecutionLog.etlName} = ${etlName} 
        AND ${etlExecutionLog.executionDate} >= ${start.toISOString()} 
        AND ${etlExecutionLog.executionDate} <= ${end.toISOString()}`;
    }

    const lastExecutions = await db
      .select()
      .from(etlExecutionLog)
      .where(whereConditions)
      .orderBy(desc(etlExecutionLog.executionDate))
      .limit(100);

    const totalExecutionsResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(etlExecutionLog)
      .where(eq(etlExecutionLog.etlName, etlName));

    const successfulExecutionsResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(etlExecutionLog)
      .where(sql`etl_name = ${etlName} AND status = 'success'`);

    const failedExecutionsResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(etlExecutionLog)
      .where(sql`etl_name = ${etlName} AND (status = 'failed' OR status = 'error')`);

    // Get total records in fact_ventas table - wrap in try-catch for safety
    let totalFactVentasCount = 0;
    try {
      const totalFactVentasResult = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(factVentas);
      totalFactVentasCount = totalFactVentasResult[0]?.count || 0;
    } catch (factVentasError) {
      console.warn('⚠️  Could not query fact_ventas table:', factVentasError);
      // Continue without failing - this table might not exist yet
    }

    const lastExecution = lastExecutions[0] || null;
    const isRunning = lastExecution?.status === 'running';

    // Add totalFactVentasRecords to lastExecution if it exists
    const enrichedLastExecution = lastExecution ? {
      ...lastExecution,
      totalFactVentasRecords: totalFactVentasCount
    } : null;

    // Get ETL configuration
    const config = await getETLConfig(etlName);

    return {
      lastExecution: enrichedLastExecution,
      isRunning,
      history: lastExecutions,
      totalExecutions: totalExecutionsResult[0]?.count || 0,
      successfulExecutions: successfulExecutionsResult[0]?.count || 0,
      failedExecutions: failedExecutionsResult[0]?.count || 0,
      totalFactVentasRecords: totalFactVentasCount,
      config, // Include configuration
    };
  } catch (error: any) {
    console.error('❌ Error in getETLStatus:', error);
    // Return safe default values instead of throwing
    return {
      lastExecution: null,
      isRunning: false,
      history: [],
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      totalFactVentasRecords: 0,
      error: error.message,
    };
  }
}
