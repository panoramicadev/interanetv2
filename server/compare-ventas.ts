import XLSX from 'xlsx';
import { db } from './db';
import { sql } from 'drizzle-orm';

async function compareVentas() {
  console.log('📊 COMPARACIÓN DE DATOS DE VENTAS 2025');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Leer archivo Excel
  console.log('📂 Leyendo archivo Excel...');
  const workbook = XLSX.readFile('attached_assets/ventas 2025_1760704823985.xls');
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const excelData = XLSX.utils.sheet_to_json(worksheet);

  console.log(`✅ Archivo leído: ${excelData.length} registros\n`);

  // Obtener datos del ETL
  console.log('🔍 Consultando datos del ETL...');
  const etlResult = await db.execute(sql`
    SELECT 
      COUNT(*) as total_registros,
      COUNT(DISTINCT nudo) as documentos_unicos,
      SUM(CAST(monto AS NUMERIC)) as monto_total,
      MIN(feemli) as fecha_minima,
      MAX(feemli) as fecha_maxima,
      COUNT(*) FILTER (WHERE tido = 'FCV') as fcv_count,
      COUNT(*) FILTER (WHERE tido = 'GDV') as gdv_count,
      COUNT(*) FILTER (WHERE tido = 'FVL') as fvl_count,
      COUNT(*) FILTER (WHERE tido = 'NCV') as ncv_count,
      SUM(CAST(monto AS NUMERIC)) FILTER (WHERE tido = 'FCV') as fcv_monto,
      SUM(CAST(monto AS NUMERIC)) FILTER (WHERE tido = 'GDV') as gdv_monto,
      SUM(CAST(monto AS NUMERIC)) FILTER (WHERE tido = 'FVL') as fvl_monto,
      SUM(CAST(monto AS NUMERIC)) FILTER (WHERE tido = 'NCV') as ncv_monto
    FROM ventas.fact_ventas
  `);

  const etlStats = etlResult.rows[0];

  console.log('✅ Datos ETL obtenidos\n');

  // Mostrar primeras filas del Excel para entender la estructura
  console.log('📋 ESTRUCTURA DEL ARCHIVO EXCEL (primeras 3 filas):');
  console.log('─────────────────────────────────────────────────────────');
  console.log(JSON.stringify(excelData.slice(0, 3), null, 2));
  console.log('─────────────────────────────────────────────────────────\n');

  // Analizar columnas del Excel
  const excelColumns = Object.keys(excelData[0] || {});
  console.log('📊 COLUMNAS EN EL ARCHIVO EXCEL:');
  console.log(excelColumns.join(', '));
  console.log('\n');

  // Comparación básica
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║              COMPARACIÓN GENERAL                          ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  console.log('Métrica                  Excel                ETL');
  console.log('─────────────────────────────────────────────────────────────');
  console.log(`Total Registros:         ${String(excelData.length).padEnd(20)} ${etlStats.total_registros}`);
  console.log('─────────────────────────────────────────────────────────────');

  // Si tiene campo de tipo de documento
  const excelByTido: any = {};
  let excelMontoTotal = 0;

  // Intentar identificar campos de tipo de documento y monto
  const possibleTidoFields = ['TIDO', 'Tipo', 'TipoDoc', 'TipoDocumento', 'Tipo Documento'];
  const possibleMontoFields = ['MONTO', 'Monto', 'Total', 'TOTAL', 'Valor', 'VALOR'];

  const tidoField = excelColumns.find(col => 
    possibleTidoFields.some(f => col.toUpperCase().includes(f.toUpperCase()))
  );
  
  const montoField = excelColumns.find(col => 
    possibleMontoFields.some(f => col.toUpperCase().includes(f.toUpperCase()))
  );

  console.log(`\n🔍 Campos detectados:`);
  console.log(`   Tipo Documento: ${tidoField || 'NO ENCONTRADO'}`);
  console.log(`   Monto: ${montoField || 'NO ENCONTRADO'}`);
  console.log('');

  if (tidoField) {
    // Agrupar por tipo de documento
    excelData.forEach((row: any) => {
      const tido = row[tidoField];
      if (!excelByTido[tido]) {
        excelByTido[tido] = { count: 0, monto: 0 };
      }
      excelByTido[tido].count++;
      
      if (montoField && row[montoField]) {
        const monto = typeof row[montoField] === 'number' 
          ? row[montoField] 
          : parseFloat(String(row[montoField]).replace(/[^0-9.-]/g, ''));
        
        if (!isNaN(monto)) {
          excelByTido[tido].monto += monto;
          excelMontoTotal += monto;
        }
      }
    });

    console.log('\n╔═══════════════════════════════════════════════════════════╗');
    console.log('║         COMPARACIÓN POR TIPO DE DOCUMENTO                ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');

    console.log('Tipo   Excel (Reg)    ETL (Reg)     Excel (Monto)          ETL (Monto)');
    console.log('─────────────────────────────────────────────────────────────────────────');
    
    const tipos = ['FCV', 'GDV', 'FVL', 'NCV'];
    tipos.forEach(tipo => {
      const excelCount = excelByTido[tipo]?.count || 0;
      const excelMonto = excelByTido[tipo]?.monto || 0;
      const etlCount = etlStats[`${tipo.toLowerCase()}_count`] || 0;
      const etlMonto = etlStats[`${tipo.toLowerCase()}_monto`] || 0;
      
      const countMatch = excelCount === Number(etlCount) ? '✅' : '❌';
      const montoMatch = Math.abs(excelMonto - Number(etlMonto)) < 1 ? '✅' : '❌';
      
      console.log(
        `${tipo}    ${String(excelCount).padEnd(13)} ${String(etlCount).padEnd(13)} ` +
        `${excelMonto.toFixed(2).padEnd(22)} ${Number(etlMonto).toFixed(2).padEnd(15)} ${countMatch} ${montoMatch}`
      );
    });
    
    console.log('─────────────────────────────────────────────────────────────────────────');
    console.log(
      `TOTAL  ${String(excelData.length).padEnd(13)} ${String(etlStats.total_registros).padEnd(13)} ` +
      `${excelMontoTotal.toFixed(2).padEnd(22)} ${Number(etlStats.monto_total).toFixed(2).padEnd(15)}`
    );
    console.log('─────────────────────────────────────────────────────────────────────────\n');
  }

  // Verificar fechas
  const possibleDateFields = ['FEEMDO', 'Fecha', 'FECHA', 'FechaEmision', 'Fecha Emision'];
  const dateField = excelColumns.find(col => 
    possibleDateFields.some(f => col.toUpperCase().includes(f.toUpperCase()))
  );

  if (dateField) {
    console.log(`\n📅 RANGO DE FECHAS:`);
    console.log(`   Campo fecha en Excel: ${dateField}`);
    console.log(`   ETL: ${etlStats.fecha_minima} → ${etlStats.fecha_maxima}`);
  }

  console.log('\n✅ Comparación completada\n');
}

compareVentas()
  .then(() => {
    console.log('🎉 Comparación finalizada');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Error en comparación:', error);
    process.exit(1);
  });
