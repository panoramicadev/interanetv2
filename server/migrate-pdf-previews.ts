import { db } from "./db";
import { gastosEmpresariales, fundAllocations } from "../shared/schema";
import { eq, and, or, isNull, sql } from "drizzle-orm";
import { convertPdfToImage } from "./pdf-to-image";
import { ObjectStorageService } from "./objectStorage";

async function migratePdfPreviews() {
  console.log("🚀 Starting PDF preview migration...\n");
  
  const results: any[] = [];
  const objectStorageService = new ObjectStorageService();
  const baseUrl = process.env.REPLIT_DEV_DOMAIN 
    ? `https://${process.env.REPLIT_DEV_DOMAIN}` 
    : "http://localhost:5000";
  
  // 1. Get PDFs from gastos_empresariales without preview
  const gastosConPdf = await db
    .select({
      id: gastosEmpresariales.id,
      archivoUrl: gastosEmpresariales.archivoUrl,
      comprobantePreviewUrl: gastosEmpresariales.comprobantePreviewUrl,
    })
    .from(gastosEmpresariales)
    .where(
      and(
        sql`${gastosEmpresariales.archivoUrl} ILIKE '%.pdf'`,
        or(
          isNull(gastosEmpresariales.comprobantePreviewUrl),
          eq(gastosEmpresariales.comprobantePreviewUrl, '')
        )
      )
    );
  
  console.log(`📄 Found ${gastosConPdf.length} gastos with PDF without preview\n`);
  
  for (const gasto of gastosConPdf) {
    try {
      if (!gasto.archivoUrl) continue;
      
      console.log(`  Processing gasto ${gasto.id}...`);
      console.log(`    URL: ${gasto.archivoUrl}`);
      
      // Download PDF
      const pdfUrl = `${baseUrl}${gasto.archivoUrl}`;
      const pdfResponse = await fetch(pdfUrl);
      
      if (!pdfResponse.ok) {
        console.log(`    ❌ Failed to download PDF: ${pdfResponse.status}`);
        results.push({ id: gasto.id, type: 'gasto', status: 'error', message: 'No se pudo descargar el PDF' });
        continue;
      }
      
      const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());
      console.log(`    Downloaded: ${pdfBuffer.length} bytes`);
      
      // Convert to image
      const previewBuffer = await convertPdfToImage(pdfBuffer, 600);
      
      if (!previewBuffer) {
        console.log(`    ❌ Failed to convert PDF`);
        results.push({ id: gasto.id, type: 'gasto', status: 'error', message: 'No se pudo convertir el PDF' });
        continue;
      }
      
      console.log(`    Converted: ${previewBuffer.length} bytes`);
      
      // Upload preview image
      const previewFileName = gasto.archivoUrl.replace(/\.pdf$/i, '_preview.png').replace(/^\/public-objects\//, '');
      const previewUrl = await objectStorageService.uploadImage(previewFileName, previewBuffer, 'image/png');
      
      console.log(`    Uploaded: ${previewUrl}`);
      
      // Update database
      await db
        .update(gastosEmpresariales)
        .set({ comprobantePreviewUrl: previewUrl })
        .where(eq(gastosEmpresariales.id, gasto.id));
      
      results.push({ id: gasto.id, type: 'gasto', status: 'success', previewUrl });
      console.log(`    ✅ Success!\n`);
    } catch (error: any) {
      results.push({ id: gasto.id, type: 'gasto', status: 'error', message: error.message });
      console.error(`    ❌ Error: ${error.message}\n`);
    }
  }
  
  // 2. Get PDFs from fund_allocations without preview
  const fondosConPdf = await db
    .select({
      id: fundAllocations.id,
      comprobanteUrl: fundAllocations.comprobanteUrl,
      comprobantePreviewUrl: fundAllocations.comprobantePreviewUrl,
    })
    .from(fundAllocations)
    .where(
      and(
        sql`${fundAllocations.comprobanteUrl} ILIKE '%.pdf'`,
        or(
          isNull(fundAllocations.comprobantePreviewUrl),
          eq(fundAllocations.comprobantePreviewUrl, '')
        )
      )
    );
  
  console.log(`📄 Found ${fondosConPdf.length} fondos with PDF without preview\n`);
  
  for (const fondo of fondosConPdf) {
    try {
      if (!fondo.comprobanteUrl) continue;
      
      console.log(`  Processing fondo ${fondo.id}...`);
      console.log(`    URL: ${fondo.comprobanteUrl}`);
      
      // Download PDF
      const pdfUrl = `${baseUrl}${fondo.comprobanteUrl}`;
      const pdfResponse = await fetch(pdfUrl);
      
      if (!pdfResponse.ok) {
        console.log(`    ❌ Failed to download PDF: ${pdfResponse.status}`);
        results.push({ id: fondo.id, type: 'fondo', status: 'error', message: 'No se pudo descargar el PDF' });
        continue;
      }
      
      const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());
      console.log(`    Downloaded: ${pdfBuffer.length} bytes`);
      
      // Convert to image
      const previewBuffer = await convertPdfToImage(pdfBuffer, 600);
      
      if (!previewBuffer) {
        console.log(`    ❌ Failed to convert PDF`);
        results.push({ id: fondo.id, type: 'fondo', status: 'error', message: 'No se pudo convertir el PDF' });
        continue;
      }
      
      console.log(`    Converted: ${previewBuffer.length} bytes`);
      
      // Upload preview image
      const previewFileName = fondo.comprobanteUrl.replace(/\.pdf$/i, '_preview.png').replace(/^\/public-objects\//, '');
      const previewUrl = await objectStorageService.uploadImage(previewFileName, previewBuffer, 'image/png');
      
      console.log(`    Uploaded: ${previewUrl}`);
      
      // Update database
      await db
        .update(fundAllocations)
        .set({ comprobantePreviewUrl: previewUrl })
        .where(eq(fundAllocations.id, fondo.id));
      
      results.push({ id: fondo.id, type: 'fondo', status: 'success', previewUrl });
      console.log(`    ✅ Success!\n`);
    } catch (error: any) {
      results.push({ id: fondo.id, type: 'fondo', status: 'error', message: error.message });
      console.error(`    ❌ Error: ${error.message}\n`);
    }
  }
  
  const successCount = results.filter(r => r.status === 'success').length;
  const errorCount = results.filter(r => r.status === 'error').length;
  
  console.log("\n" + "=".repeat(50));
  console.log(`📊 Migration completed:`);
  console.log(`   ✅ Success: ${successCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);
  console.log(`   📄 Total: ${results.length}`);
  console.log("=".repeat(50) + "\n");
  
  return results;
}

migratePdfPreviews()
  .then(() => {
    console.log("Migration finished. Exiting...");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Migration failed:", error);
    process.exit(1);
  });
