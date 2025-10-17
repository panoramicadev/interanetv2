import XLSX from 'xlsx';
import { db } from './db';
import { sql } from 'drizzle-orm';

async function analyzeExcelDates() {
  console.log('📅 ANÁLISIS DE FECHAS Y DOCUMENTOS');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Leer archivo Excel
  const workbook = XLSX.readFile('attached_assets/ventas 2025_1760704823985.xls');
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const excelData = XLSX.utils.sheet_to_json(worksheet);

  // Convertir fechas de Excel (número serial) a fechas reales
  const convertExcelDate = (serial: number) => {
    if (!serial || typeof serial !== 'number') return null;
    const utcDays = Math.floor(serial - 25569);
    const date = new Date(utcDays * 86400 * 1000);
    return date.toISOString().split('T')[0];
  };

  // Analizar fechas en Excel
  const excelByMonth: any = {};
  const excelByTido: any = { FCV: {}, GDV: {}, FVL: {}, NCV: {} };

  excelData.forEach((row: any) => {
    const fechaSerial = row.FEEMLI || row.FEEMDO;
    const fecha = convertExcelDate(fechaSerial);
    const tido = row.TIDO;
    const monto = row.MONTO || 0;

    if (fecha && tido) {
      const mes = fecha.substring(0, 7); // YYYY-MM
      
      if (!excelByMonth[mes]) {
        excelByMonth[mes] = { FCV: 0, GDV: 0, FVL: 0, NCV: 0, total: 0 };
      }
      if (!excelByMonth[mes][tido]) {
        excelByMonth[mes][tido] = 0;
      }
      excelByMonth[mes][tido]++;
      excelByMonth[mes].total++;

      // Por tipo de documento
      if (!excelByTido[tido]) {
        excelByTido[tido] = {};
      }
      if (!excelByTido[tido][mes]) {
        excelByTido[tido][mes] = { count: 0, monto: 0 };
      }
      excelByTido[tido][mes].count++;
      excelByTido[tido][mes].monto += monto;
    }
  });

  console.log('📊 DISTRIBUCIÓN POR MES EN ARCHIVO EXCEL:');
  console.log('─────────────────────────────────────────────────────────────────────');
  console.log('Mes        Total    FCV      GDV      FVL      NCV');
  console.log('─────────────────────────────────────────────────────────────────────');

  const meses = Object.keys(excelByMonth).sort();
  meses.forEach(mes => {
    const data = excelByMonth[mes];
    console.log(
      `${mes}    ${String(data.total).padEnd(8)} ${String(data.FCV || 0).padEnd(8)} ` +
      `${String(data.GDV || 0).padEnd(8)} ${String(data.FVL || 0).padEnd(8)} ${String(data.NCV || 0).padEnd(8)}`
    );
  });
  console.log('─────────────────────────────────────────────────────────────────────\n');

  // Comparar con ETL
  console.log('🔍 COMPARACIÓN DETALLADA ETL vs EXCEL POR MES:');
  console.log('─────────────────────────────────────────────────────────────────────\n');

  const etlByMonth = await db.execute(sql`
    SELECT 
      TO_CHAR(feemli, 'YYYY-MM') as mes,
      tido,
      COUNT(*) as cantidad,
      SUM(CAST(monto AS NUMERIC)) as monto_total
    FROM ventas.fact_ventas
    GROUP BY TO_CHAR(feemli, 'YYYY-MM'), tido
    ORDER BY mes, tido
  `);

  // Organizar datos ETL
  const etlByMonthOrg: any = {};
  etlByMonth.rows.forEach((row: any) => {
    if (!etlByMonthOrg[row.mes]) {
      etlByMonthOrg[row.mes] = { FCV: 0, GDV: 0, FVL: 0, NCV: 0 };
    }
    etlByMonthOrg[row.mes][row.tido] = Number(row.cantidad);
  });

  console.log('═══════════════════════════════════════════════════════════════════════════');
  console.log('                        FCV                  GDV                  FVL        ');
  console.log('Mes        Excel  ETL   Dif    Excel  ETL    Dif    Excel  ETL   Dif    NCV  ');
  console.log('─────────────────────────────────────────────────────────────────────────────');

  meses.forEach(mes => {
    const excel = excelByMonth[mes];
    const etl = etlByMonthOrg[mes] || { FCV: 0, GDV: 0, FVL: 0, NCV: 0 };
    
    const fcvDiff = (excel.FCV || 0) - etl.FCV;
    const gdvDiff = (excel.GDV || 0) - etl.GDV;
    const fvlDiff = (excel.FVL || 0) - etl.FVL;
    const ncvDiff = (excel.NCV || 0) - etl.NCV;

    console.log(
      `${mes}   ${String(excel.FCV || 0).padStart(5)}  ${String(etl.FCV).padStart(5)}  ${String(fcvDiff).padStart(4)}   ` +
      `${String(excel.GDV || 0).padStart(5)}  ${String(etl.GDV).padStart(5)}  ${String(gdvDiff).padStart(5)}   ` +
      `${String(excel.FVL || 0).padStart(5)}  ${String(etl.FVL).padStart(4)}  ${String(fvlDiff).padStart(4)}   ` +
      `${String(ncvDiff).padStart(4)}`
    );
  });

  console.log('═══════════════════════════════════════════════════════════════════════════\n');

  // Verificar documentos GDV en Excel
  console.log('🔍 DOCUMENTOS GDV EN ARCHIVO EXCEL:');
  console.log('─────────────────────────────────────────────────────────────────────');
  const gdvDocs = excelData.filter((row: any) => row.TIDO === 'GDV');
  console.log(`Total GDV en Excel: ${gdvDocs.length}`);
  
  if (gdvDocs.length > 0) {
    console.log('\nPrimeros 10 documentos GDV en Excel:');
    gdvDocs.slice(0, 10).forEach((doc: any) => {
      const fecha = convertExcelDate(doc.FEEMLI || doc.FEEMDO);
      console.log(`  ${doc.NUDO} | ${fecha} | ${doc.SUDO} | Monto: ${doc.MONTO}`);
    });
  }

  console.log('\n─────────────────────────────────────────────────────────────────────\n');

  // Verificar sucursales
  console.log('🏢 DISTRIBUCIÓN POR SUCURSAL EN EXCEL:');
  const bySucursal: any = {};
  excelData.forEach((row: any) => {
    const sudo = row.SUDO;
    if (!bySucursal[sudo]) {
      bySucursal[sudo] = { FCV: 0, GDV: 0, FVL: 0, NCV: 0 };
    }
    bySucursal[sudo][row.TIDO]++;
  });

  console.log('Sucursal   FCV      GDV      FVL      NCV      Total');
  console.log('─────────────────────────────────────────────────────────');
  Object.keys(bySucursal).sort().forEach(sudo => {
    const data = bySucursal[sudo];
    const total = data.FCV + data.GDV + data.FVL + data.NCV;
    console.log(
      `${sudo}        ${String(data.FCV).padEnd(8)} ${String(data.GDV).padEnd(8)} ` +
      `${String(data.FVL).padEnd(8)} ${String(data.NCV).padEnd(8)} ${total}`
    );
  });
  console.log('─────────────────────────────────────────────────────────\n');

  console.log('✅ Análisis completado\n');
}

analyzeExcelDates()
  .then(() => {
    console.log('🎉 Análisis finalizado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Error:', error);
    process.exit(1);
  });
