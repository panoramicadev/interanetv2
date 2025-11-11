import { executeGDVETL } from './server/etl-gdv.ts';

console.log('🚀 Ejecutando ETL de GDV...');
executeGDVETL().then(result => {
  console.log('✅ Completado:', result);
  process.exit(0);
}).catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
