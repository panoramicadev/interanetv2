import { createCanvas } from 'canvas';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const execAsync = promisify(exec);

async function convertWithGhostscript(pdfBuffer: Buffer, width: number): Promise<Buffer | null> {
  const tempDir = os.tmpdir();
  const tempPdfPath = path.join(tempDir, `pdf_${Date.now()}_${Math.random().toString(36).slice(2)}.pdf`);
  const tempPngPath = path.join(tempDir, `png_${Date.now()}_${Math.random().toString(36).slice(2)}.png`);
  
  try {
    fs.writeFileSync(tempPdfPath, pdfBuffer);
    
    const dpi = Math.min(150, Math.round(width / 8.5 * 72));
    
    await execAsync(
      `gs -dSAFER -dBATCH -dNOPAUSE -sDEVICE=png16m -r${dpi} -dFirstPage=1 -dLastPage=1 -sOutputFile="${tempPngPath}" "${tempPdfPath}"`,
      { timeout: 30000 }
    );
    
    if (fs.existsSync(tempPngPath)) {
      const pngBuffer = fs.readFileSync(tempPngPath);
      console.log(`[PDF-TO-IMAGE] Ghostscript conversion successful: ${pngBuffer.length} bytes`);
      return pngBuffer;
    }
    
    return null;
  } catch (error) {
    console.error('[PDF-TO-IMAGE] Ghostscript conversion failed:', error);
    return null;
  } finally {
    try { if (fs.existsSync(tempPdfPath)) fs.unlinkSync(tempPdfPath); } catch {}
    try { if (fs.existsSync(tempPngPath)) fs.unlinkSync(tempPngPath); } catch {}
  }
}

async function convertWithPdfJs(pdfBuffer: Buffer, width: number): Promise<Buffer | null> {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  
  const uint8Array = new Uint8Array(pdfBuffer);
  const loadingTask = pdfjsLib.getDocument({ 
    data: uint8Array,
    useSystemFonts: true,
    disableFontFace: true
  });
  const pdf = await loadingTask.promise;
  const page = await pdf.getPage(1);
  
  const viewport = page.getViewport({ scale: 1 });
  const scale = width / viewport.width;
  const scaledViewport = page.getViewport({ scale });
  
  const canvas = createCanvas(scaledViewport.width, scaledViewport.height);
  const context = canvas.getContext('2d');
  
  const renderContext = {
    canvasContext: context as unknown as CanvasRenderingContext2D,
    viewport: scaledViewport
  };
  
  await page.render(renderContext).promise;
  
  return canvas.toBuffer('image/png');
}

export async function convertPdfToImage(pdfBuffer: Buffer, width: number = 600): Promise<Buffer | null> {
  try {
    const result = await convertWithPdfJs(pdfBuffer, width);
    if (result) return result;
  } catch (error) {
    console.log('[PDF-TO-IMAGE] pdf.js failed, trying Ghostscript fallback...');
  }
  
  try {
    return await convertWithGhostscript(pdfBuffer, width);
  } catch (error) {
    console.error('[PDF-TO-IMAGE] All conversion methods failed:', error);
    return null;
  }
}

export function isPdfFile(mimetype: string, filename: string): boolean {
  return mimetype === 'application/pdf' || filename.toLowerCase().endsWith('.pdf');
}
