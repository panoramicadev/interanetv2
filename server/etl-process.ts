import mssql from 'mssql';
import { db } from './db';
import { sql } from 'drizzle-orm';
import { 
  stgMaeedo, 
  stgMaeddo, 
  stgMaeen, 
  stgMaepr, 
  stgMaeven, 
  stgTabbo, 
  stgTabpp,
  factVentas 
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
  requestTimeout: 30000,
};

interface ETLStats {
  tabla: string;
  registrosExtraidos: number;
  registrosCargados: number;
  tiempoMs: number;
}

async function extractAndLoad() {
  const stats: ETLStats[] = [];
  let pool: mssql.ConnectionPool | null = null;

  try {
    console.log('🚀 INICIANDO PROCESO ETL');
    console.log('========================\n');
    
    // Limpiar tablas staging y fact antes de cargar
    console.log('🧹 Limpiando tablas staging y fact...');
    await db.execute(sql`TRUNCATE TABLE ventas.fact_ventas CASCADE`);
    await db.execute(sql`TRUNCATE TABLE ventas.stg_maeedo CASCADE`);
    await db.execute(sql`TRUNCATE TABLE ventas.stg_maeddo CASCADE`);
    await db.execute(sql`TRUNCATE TABLE ventas.stg_maeen CASCADE`);
    await db.execute(sql`TRUNCATE TABLE ventas.stg_maepr CASCADE`);
    await db.execute(sql`TRUNCATE TABLE ventas.stg_maeven CASCADE`);
    await db.execute(sql`TRUNCATE TABLE ventas.stg_tabbo CASCADE`);
    await db.execute(sql`TRUNCATE TABLE ventas.stg_tabpp CASCADE`);
    console.log('✅ Tablas limpiadas\n');
    
    // Conectar a SQL Server
    console.log('🔄 Conectando a SQL Server...');
    pool = new mssql.ConnectionPool(sqlServerConfig);
    await pool.connect();
    console.log('✅ Conectado a SQL Server\n');

    // Filtros
    const mesActual = '2025-10';
    const tiposDoc = ['FCV', 'GDV', 'FVL', 'NCV'];
    const sucursal = '004';

    console.log('📋 FILTROS APLICADOS:');
    console.log(`   Periodo: ${mesActual}`);
    console.log(`   Tipos documento: ${tiposDoc.join(', ')}`);
    console.log(`   Sucursal (SUDO): ${sucursal}\n`);

    // 1. EXTRAER Y CARGAR MAEEDO (Encabezados)
    console.log('1️⃣  Extrayendo MAEEDO (Encabezados)...');
    const startMaeedo = Date.now();
    const maeedo = await pool.request().query(`
      SELECT *
      FROM dbo.MAEEDO
      WHERE TIDO IN ('${tiposDoc.join("','")}')
        AND SUDO = '${sucursal}'
        AND CONVERT(VARCHAR(7), FEEMDO, 120) = '${mesActual}'
      ORDER BY FEEMDO, NUDO
    `);
    
    if (maeedo.recordset.length > 0) {
      await db.insert(stgMaeedo).values(
        maeedo.recordset.map(r => ({
          idmaeedo: r.IDMAEEDO,
          empresa: r.EMPRESA?.trim(),
          tido: r.TIDO?.trim(),
          nudo: r.NUDO?.trim(),
          endo: r.ENDO?.trim(),
          suendo: r.SUENDO?.trim(),
          endofi: r.ENDOFI?.trim(),
          tigedo: r.TIGEDO?.trim(),
          sudo: r.SUDO?.trim(),
          luvtdo: r.LUVTDO?.trim(),
          feemdo: r.FEEMDO,
          kofudo: r.KOFUDO?.trim(),
          esdo: r.ESDO?.trim(),
          espgdo: r.ESPGDO?.trim(),
          caprco: r.CAPRCO,
          caprad: r.CAPRAD,
          caprex: r.CAPREX,
          caprnc: r.CAPRNC,
          meardo: r.MEARDO?.trim(),
          modo: r.MODO?.trim(),
          timodo: r.TIMODO?.trim(),
          tamodo: r.TAMODO,
          nuctap: r.NUCTAP,
          vactdtnedo: r.VACTDTNEDO,
          vactdtbrdo: r.VACTDTBRDO,
          nuivdo: r.NUIVDO,
          poivdo: r.POIVDO,
          vaivdo: r.VAIVDO,
          nuimdo: r.NUIMDO,
          vaimdo: r.VAIMDO,
          vanedo: r.VANEDO,
          vabrdo: r.VABRDO,
          popido: r.POPIDO,
          vapido: r.VAPIDO,
        }))
      );
    }
    stats.push({
      tabla: 'MAEEDO',
      registrosExtraidos: maeedo.recordset.length,
      registrosCargados: maeedo.recordset.length,
      tiempoMs: Date.now() - startMaeedo,
    });
    console.log(`   ✅ ${maeedo.recordset.length} registros cargados en ${Date.now() - startMaeedo}ms\n`);

    // 2. EXTRAER Y CARGAR MAEDDO (Detalles)
    console.log('2️⃣  Extrayendo MAEDDO (Detalles)...');
    const startMaeddo = Date.now();
    const maeddo = await pool.request().query(`
      SELECT d.*
      FROM dbo.MAEDDO d
      INNER JOIN dbo.MAEEDO e ON d.IDMAEEDO = e.IDMAEEDO
      WHERE e.TIDO IN ('${tiposDoc.join("','")}')
        AND e.SUDO = '${sucursal}'
        AND CONVERT(VARCHAR(7), e.FEEMDO, 120) = '${mesActual}'
      ORDER BY d.IDMAEEDO, d.KOPRCT
    `);
    
    if (maeddo.recordset.length > 0) {
      await db.insert(stgMaeddo).values(
        maeddo.recordset.map(r => ({
          idmaeddo: r.IDMAEDDO,
          idmaeedo: r.IDMAEEDO,
          empresa: typeof r.EMPRESA === 'string' ? r.EMPRESA.trim() : r.EMPRESA,
          tido: typeof r.TIDO === 'string' ? r.TIDO.trim() : r.TIDO,
          nudo: typeof r.NUDO === 'string' ? r.NUDO.trim() : r.NUDO,
          koprct: typeof r.KOPRCT === 'string' ? r.KOPRCT.trim() : r.KOPRCT,
          nokopr: typeof r.NOKOPR === 'string' ? r.NOKOPR.trim() : r.NOKOPR,
          koprcd: typeof r.KOPRCD === 'string' ? r.KOPRCD.trim() : r.KOPRCD,
          udtrpr: typeof r.UDTRPR === 'string' ? r.UDTRPR.trim() : r.UDTRPR,
          caprco1: r.CAPRCO1,
          caprex1: r.CAPREX1,
          caprco2: r.CAPRCO2,
          caprex2: r.CAPREX2,
          caprex: r.CAPREX,
          ud01pr: typeof r.UD01PR === 'string' ? r.UD01PR.trim() : r.UD01PR,
          ud02pr: typeof r.UD02PR === 'string' ? r.UD02PR.trim() : r.UD02PR,
          prct: r.PRCT,
          ppprne: r.PPPRNE,
          ppprpm: r.PPPRPM,
          ppprbr: r.PPPRBR,
          vaprne1: r.VAPRNE1,
          pporva: r.PPORVA,
          vaivpr: r.VAIVPR,
          vabrpr: r.VABRPR,
        }))
      );
    }
    stats.push({
      tabla: 'MAEDDO',
      registrosExtraidos: maeddo.recordset.length,
      registrosCargados: maeddo.recordset.length,
      tiempoMs: Date.now() - startMaeddo,
    });
    console.log(`   ✅ ${maeddo.recordset.length} registros cargados en ${Date.now() - startMaeddo}ms\n`);

    // 3. EXTRAER Y CARGAR MAEEN (Entidades - Clientes)
    console.log('3️⃣  Extrayendo MAEEN (Entidades)...');
    const startMaeen = Date.now();
    const maeen = await pool.request().query(`
      SELECT DISTINCT en.*
      FROM dbo.MAEEN en
      INNER JOIN dbo.MAEEDO e ON en.KOEN = e.ENDO
      WHERE e.TIDO IN ('${tiposDoc.join("','")}')
        AND e.SUDO = '${sucursal}'
        AND CONVERT(VARCHAR(7), e.FEEMDO, 120) = '${mesActual}'
    `);
    
    if (maeen.recordset.length > 0) {
      await db.insert(stgMaeen).values(
        maeen.recordset.map(r => ({
          koen: r.KOEN?.trim(),
          tipr: r.TIPR?.trim(),
          suen: r.SUEN?.trim(),
          rten: r.RTEN?.trim(),
          nokoen: r.NOKOEN?.trim(),
          dien: r.DIEN?.trim(),
          cien: r.CIEN?.trim(),
          cmen: r.CMEN?.trim(),
          paen: r.PAEN?.trim(),
          zoen: r.ZOEN?.trim(),
        }))
      ).onConflictDoNothing();
    }
    stats.push({
      tabla: 'MAEEN',
      registrosExtraidos: maeen.recordset.length,
      registrosCargados: maeen.recordset.length,
      tiempoMs: Date.now() - startMaeen,
    });
    console.log(`   ✅ ${maeen.recordset.length} registros cargados en ${Date.now() - startMaeen}ms\n`);

    // 4. EXTRAER Y CARGAR MAEPR (Productos)
    console.log('4️⃣  Extrayendo MAEPR (Productos)...');
    const startMaepr = Date.now();
    const maepr = await pool.request().query(`
      SELECT DISTINCT pr.*
      FROM dbo.MAEPR pr
      INNER JOIN dbo.MAEDDO d ON pr.KOPR = d.KOPRCT
      INNER JOIN dbo.MAEEDO e ON d.IDMAEEDO = e.IDMAEEDO
      WHERE e.TIDO IN ('${tiposDoc.join("','")}')
        AND e.SUDO = '${sucursal}'
        AND CONVERT(VARCHAR(7), e.FEEMDO, 120) = '${mesActual}'
    `);
    
    if (maepr.recordset.length > 0) {
      await db.insert(stgMaepr).values(
        maepr.recordset.map(r => ({
          kopr: r.KOPR?.trim(),
          nokopr: r.NOKOPR?.trim(),
          nokoprra: r.NOKOPRRA?.trim(),
          rupr: r.RUPR?.trim(),
          mrpr: r.MRPR?.trim(),
          tipr: r.TIPR?.trim(),
          clpr: r.CLPR?.trim(),
          unpr: r.UNPR?.trim(),
          prct: r.PRCT,
        }))
      ).onConflictDoNothing();
    }
    stats.push({
      tabla: 'MAEPR',
      registrosExtraidos: maepr.recordset.length,
      registrosCargados: maepr.recordset.length,
      tiempoMs: Date.now() - startMaepr,
    });
    console.log(`   ✅ ${maepr.recordset.length} registros cargados en ${Date.now() - startMaepr}ms\n`);

    // 5. EXTRAER Y CARGAR MAEVEN (Vendedores) - Extraer desde MAEEDO
    console.log('5️⃣  Extrayendo MAEVEN (Vendedores desde MAEEDO)...');
    const startMaeven = Date.now();
    const maeven = await pool.request().query(`
      SELECT DISTINCT
        e.KOFUDO as kofuven,
        'VENDEDOR ' + e.KOFUDO as nokofu
      FROM dbo.MAEEDO e
      WHERE e.TIDO IN ('${tiposDoc.join("','")}')
        AND e.SUDO = '${sucursal}'
        AND CONVERT(VARCHAR(7), e.FEEMDO, 120) = '${mesActual}'
        AND e.KOFUDO IS NOT NULL
        AND e.KOFUDO <> ''
    `);
    
    if (maeven.recordset.length > 0) {
      await db.insert(stgMaeven).values(
        maeven.recordset.map(r => ({
          kofu: typeof r.kofuven === 'string' ? r.kofuven.trim() : r.kofuven,
          nokofu: typeof r.nokofu === 'string' ? r.nokofu.trim() : r.nokofu,
        }))
      ).onConflictDoNothing();
    }
    stats.push({
      tabla: 'MAEVEN',
      registrosExtraidos: maeven.recordset.length,
      registrosCargados: maeven.recordset.length,
      tiempoMs: Date.now() - startMaeven,
    });
    console.log(`   ✅ ${maeven.recordset.length} registros cargados en ${Date.now() - startMaeven}ms\n`);

    // 6. EXTRAER Y CARGAR TABBO (Bodegas)
    console.log('6️⃣  Extrayendo TABBO (Bodegas)...');
    const startTabbo = Date.now();
    const tabbo = await pool.request().query(`
      SELECT EMPRESA, KOSU, KOBO, NOKOBO
      FROM dbo.TABBO
    `);
    
    if (tabbo.recordset.length > 0) {
      await db.insert(stgTabbo).values(
        tabbo.recordset.map(r => ({
          suli: typeof r.EMPRESA === 'string' ? r.EMPRESA.trim() : r.EMPRESA || '',
          bosuli: typeof r.KOBO === 'string' ? r.KOBO.trim() : r.KOBO || '',
          nobosuli: typeof r.NOKOBO === 'string' ? r.NOKOBO.trim() : r.NOKOBO,
        }))
      ).onConflictDoNothing();
    }
    stats.push({
      tabla: 'TABBO',
      registrosExtraidos: tabbo.recordset.length,
      registrosCargados: tabbo.recordset.length,
      tiempoMs: Date.now() - startTabbo,
    });
    console.log(`   ✅ ${tabbo.recordset.length} registros cargados en ${Date.now() - startTabbo}ms\n`);

    // 7. EXTRAER Y CARGAR TABPP (Propiedades Productos desde MAEPR)
    console.log('7️⃣  Extrayendo TABPP (Propiedades Productos desde MAEPR)...');
    const startTabpp = Date.now();
    const tabpp = await pool.request().query(`
      SELECT DISTINCT
        pr.KOPR,
        pr.PM as listacost,
        pr.PM as liscosmod
      FROM dbo.MAEPR pr
      INNER JOIN dbo.MAEDDO d ON pr.KOPR = d.KOPRCT
      INNER JOIN dbo.MAEEDO e ON d.IDMAEEDO = e.IDMAEEDO
      WHERE e.TIDO IN ('${tiposDoc.join("','")}')
        AND e.SUDO = '${sucursal}'
        AND CONVERT(VARCHAR(7), e.FEEMDO, 120) = '${mesActual}'
    `);
    
    if (tabpp.recordset.length > 0) {
      await db.insert(stgTabpp).values(
        tabpp.recordset.map(r => ({
          kopr: typeof r.KOPR === 'string' ? r.KOPR.trim() : r.KOPR,
          listacost: r.listacost,
          liscosmod: r.liscosmod,
        }))
      ).onConflictDoNothing();
    }
    stats.push({
      tabla: 'TABPP',
      registrosExtraidos: tabpp.recordset.length,
      registrosCargados: tabpp.recordset.length,
      tiempoMs: Date.now() - startTabpp,
    });
    console.log(`   ✅ ${tabpp.recordset.length} registros cargados en ${Date.now() - startTabpp}ms\n`);

    // 8. PROCESAR Y CARGAR FACT_VENTAS
    console.log('8️⃣  Procesando y cargando FACT_VENTAS...');
    const startFactVentas = Date.now();
    
    const factData = await pool.request().query(`
      SELECT 
        e.IDMAEEDO,
        d.IDMAEDDO,
        e.EMPRESA,
        e.TIDO,
        e.NUDO,
        e.FEEMDO,
        e.SUDO,
        e.LUVTDO,
        e.ENDO as cliente_rut,
        en.NOKOEN as cliente_nombre,
        en.CIEN as cliente_ciudad,
        en.CMEN as cliente_comuna,
        e.KOFUDO as vendedor_codigo,
        'VENDEDOR ' + e.KOFUDO as vendedor_nombre,
        d.KOPRCT as producto_codigo,
        pr.NOKOPR as producto_nombre,
        pr.RUPR as producto_rubro,
        pr.MRPR as producto_marca,
        d.CAPRCO1,
        d.CAPREX1,
        d.CAPRCO2,
        d.CAPREX2,
        d.UDTRPR,
        d.PPPRNE as precio_unitario,
        d.VANELI as valor_neto_linea,
        d.VAIVLI as valor_iva_linea,
        d.VABRLI as valor_bruto_linea,
        e.VANEDO as documento_neto,
        e.VAIVDO as documento_iva,
        e.VABRDO as documento_bruto,
        e.ESDO as estado,
        e.MEARDO as medio_pago
      FROM dbo.MAEEDO e
      INNER JOIN dbo.MAEDDO d ON e.IDMAEEDO = d.IDMAEEDO
      LEFT JOIN dbo.MAEEN en ON e.ENDO = en.KOEN
      LEFT JOIN dbo.MAEPR pr ON d.KOPRCT = pr.KOPR
      WHERE e.TIDO IN ('${tiposDoc.join("','")}')
        AND e.SUDO = '${sucursal}'
        AND CONVERT(VARCHAR(7), e.FEEMDO, 120) = '${mesActual}'
      ORDER BY e.FEEMDO, e.NUDO, d.KOPRCT
    `);
    
    if (factData.recordset.length > 0) {
      await db.insert(factVentas).values(
        factData.recordset.map(r => ({
          idmaeedo: r.IDMAEEDO,
          idmaeddo: r.IDMAEDDO,
          empresa: typeof r.EMPRESA === 'string' ? r.EMPRESA.trim() : r.EMPRESA,
          tido: typeof r.TIDO === 'string' ? r.TIDO.trim() : r.TIDO,
          nudo: typeof r.NUDO === 'string' ? r.NUDO.trim() : r.NUDO,
          feemdo: r.FEEMDO,
          sudo: typeof r.SUDO === 'string' ? r.SUDO.trim() : r.SUDO,
          luvtdo: typeof r.LUVTDO === 'string' ? r.LUVTDO.trim() : r.LUVTDO,
          clienteRut: typeof r.cliente_rut === 'string' ? r.cliente_rut.trim() : r.cliente_rut,
          clienteNombre: typeof r.cliente_nombre === 'string' ? r.cliente_nombre.trim() : r.cliente_nombre,
          clienteCiudad: typeof r.cliente_ciudad === 'string' ? r.cliente_ciudad.trim() : r.cliente_ciudad,
          clienteComuna: typeof r.cliente_comuna === 'string' ? r.cliente_comuna.trim() : r.cliente_comuna,
          vendedorCodigo: typeof r.vendedor_codigo === 'string' ? r.vendedor_codigo.trim() : r.vendedor_codigo,
          vendedorNombre: typeof r.vendedor_nombre === 'string' ? r.vendedor_nombre.trim() : r.vendedor_nombre,
          productoCodigo: typeof r.producto_codigo === 'string' ? r.producto_codigo.trim() : r.producto_codigo,
          productoNombre: typeof r.producto_nombre === 'string' ? r.producto_nombre.trim() : r.producto_nombre,
          productoRubro: typeof r.producto_rubro === 'string' ? r.producto_rubro.trim() : r.producto_rubro,
          productoMarca: typeof r.producto_marca === 'string' ? r.producto_marca.trim() : r.producto_marca,
          caprco1: r.CAPRCO1,
          caprex1: r.CAPREX1,
          caprco2: r.CAPRCO2,
          caprex2: r.CAPREX2,
          udtrpr: typeof r.UDTRPR === 'string' ? r.UDTRPR.trim() : r.UDTRPR,
          precioUnitario: r.precio_unitario,
          valorNetoLinea: r.valor_neto_linea,
          valorIvaLinea: r.valor_iva_linea,
          valorBrutoLinea: r.valor_bruto_linea,
          documentoNeto: r.documento_neto,
          documentoIva: r.documento_iva,
          documentoBruto: r.documento_bruto,
          estado: typeof r.estado === 'string' ? r.estado.trim() : r.estado,
          medioPago: typeof r.medio_pago === 'string' ? r.medio_pago.trim() : r.medio_pago,
        }))
      ).onConflictDoNothing();
    }
    stats.push({
      tabla: 'FACT_VENTAS',
      registrosExtraidos: factData.recordset.length,
      registrosCargados: factData.recordset.length,
      tiempoMs: Date.now() - startFactVentas,
    });
    console.log(`   ✅ ${factData.recordset.length} registros cargados en ${Date.now() - startFactVentas}ms\n`);

    // RESUMEN FINAL
    console.log('✅ PROCESO ETL COMPLETADO');
    console.log('========================\n');
    console.log('📊 RESUMEN DE CARGA:');
    console.log('─────────────────────────────────────────────────');
    stats.forEach(stat => {
      const tiempo = (stat.tiempoMs / 1000).toFixed(2);
      console.log(`   ${stat.tabla.padEnd(15)} | ${String(stat.registrosCargados).padStart(8)} registros | ${tiempo}s`);
    });
    console.log('─────────────────────────────────────────────────');
    
    const totalRegistros = stats.reduce((sum, s) => sum + s.registrosCargados, 0);
    const totalTiempo = (stats.reduce((sum, s) => sum + s.tiempoMs, 0) / 1000).toFixed(2);
    console.log(`   TOTAL           | ${String(totalRegistros).padStart(8)} registros | ${totalTiempo}s`);
    console.log('─────────────────────────────────────────────────\n');

    if (pool) {
      await pool.close();
      console.log('✅ Conexión a SQL Server cerrada\n');
    }

    return stats;

  } catch (error: any) {
    console.error('\n❌ ERROR EN PROCESO ETL:');
    console.error(`   ${error.message}`);
    if (error.stack) {
      console.error(`\n   Stack: ${error.stack}`);
    }
    
    if (pool) {
      await pool.close();
    }
    
    throw error;
  }
}

// Ejecutar ETL
extractAndLoad()
  .then(() => {
    console.log('🎉 ETL finalizado exitosamente');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 ETL falló:', error.message);
    process.exit(1);
  });
