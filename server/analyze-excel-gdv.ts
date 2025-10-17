import XLSX from 'xlsx';

async function analyzeExcelGDV() {
  console.log('🔍 ANÁLISIS DE GDV EN ARCHIVO EXCEL');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Leer archivo Excel
  const workbook = XLSX.readFile('attached_assets/ventas 2025_1760704823985.xls');
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const excelData = XLSX.utils.sheet_to_json(worksheet);

  // Filtrar solo GDV
  const gdvDocs = excelData.filter((row: any) => row.TIDO === 'GDV');

  console.log(`Total GDV en Excel: ${gdvDocs.length}\n`);

  // Convertir fecha Excel
  const convertExcelDate = (serial: number) => {
    if (!serial || typeof serial !== 'number') return null;
    const utcDays = Math.floor(serial - 25569);
    const date = new Date(utcDays * 86400 * 1000);
    return date.toISOString().split('T')[0];
  };

  // Analizar campos de estado
  console.log('📊 ANÁLISIS DE CAMPOS DE ESTADO EN GDV:');
  console.log('─────────────────────────────────────────────────────────────');
  
  // Identificar todos los campos únicos que tienen
  if (gdvDocs.length > 0) {
    const firstGDV = gdvDocs[0];
    console.log('Campos disponibles en GDV del Excel:');
    Object.keys(firstGDV).forEach(key => {
      if (key.includes('ES') || key.includes('ESTADO') || key === 'ESDO' || key === 'ESPGDO' || key === 'ESFADO') {
        console.log(`  ${key}: ${firstGDV[key]}`);
      }
    });
    console.log('');
  }

  // Agrupar por estados
  const byEstado: any = {};
  gdvDocs.forEach((doc: any) => {
    const key = `ESDO:${doc.ESDO || 'NULL'} | ESPGDO:${doc.ESPGDO || 'NULL'}`;
    if (!byEstado[key]) {
      byEstado[key] = { count: 0, docs: [] };
    }
    byEstado[key].count++;
    byEstado[key].docs.push(doc);
  });

  console.log('📋 DISTRIBUCIÓN POR ESTADO:');
  console.log('─────────────────────────────────────────────────────────────');
  Object.keys(byEstado).forEach(estado => {
    console.log(`${estado}: ${byEstado[estado].count} documentos`);
  });
  console.log('');

  // Mostrar todos los GDV con sus estados
  console.log('📝 DETALLE DE TODOS LOS GDV EN EXCEL:');
  console.log('─────────────────────────────────────────────────────────────');
  console.log('NUDO         Fecha      ESDO  ESPGDO  ESFADO  LILG  ESLIDO  Monto');
  console.log('─────────────────────────────────────────────────────────────────────');
  
  gdvDocs.forEach((doc: any) => {
    const fecha = convertExcelDate(doc.FEEMLI || doc.FEEMDO);
    console.log(
      `${doc.NUDO}  ${fecha}  ${(doc.ESDO || '').padEnd(4)}  ` +
      `${(doc.ESPGDO || '').padEnd(6)}  ${(doc.ESFADO || '').padEnd(6)}  ` +
      `${(doc.LILG || '').padEnd(4)}  ${(doc.ESLIDO || '').padEnd(6)}  ${doc.MONTO}`
    );
  });
  console.log('─────────────────────────────────────────────────────────────────────\n');

  // Analizar otros campos que podrían ser filtros
  console.log('🔍 OTROS CAMPOS RELEVANTES:');
  console.log('─────────────────────────────────────────────────────────────');
  
  const uniqueFields: any = {
    LILG: new Set(),
    ESLIDO: new Set(),
    ESFADO: new Set(),
    TIGEDO: new Set(),
    SUDO: new Set(),
  };

  gdvDocs.forEach((doc: any) => {
    Object.keys(uniqueFields).forEach(field => {
      if (doc[field]) {
        uniqueFields[field].add(doc[field]);
      }
    });
  });

  Object.keys(uniqueFields).forEach(field => {
    const values = Array.from(uniqueFields[field]);
    console.log(`${field}: ${values.join(', ')}`);
  });
  console.log('');

  // Comparar con fechas de otros documentos
  console.log('📅 RANGO DE FECHAS POR TIPO DE DOCUMENTO:');
  console.log('─────────────────────────────────────────────────────────────');
  
  const byTipo: any = {};
  excelData.forEach((row: any) => {
    const tido = row.TIDO;
    const fecha = convertExcelDate(row.FEEMLI || row.FEEMDO);
    
    if (!byTipo[tido]) {
      byTipo[tido] = { min: fecha, max: fecha };
    }
    
    if (fecha && fecha < byTipo[tido].min) byTipo[tido].min = fecha;
    if (fecha && fecha > byTipo[tido].max) byTipo[tido].max = fecha;
  });

  Object.keys(byTipo).sort().forEach(tido => {
    console.log(`${tido}: ${byTipo[tido].min} → ${byTipo[tido].max}`);
  });
  console.log('');

  console.log('✅ Análisis completado\n');
}

analyzeExcelGDV()
  .then(() => {
    console.log('🎉 Análisis finalizado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Error:', error);
    process.exit(1);
  });
