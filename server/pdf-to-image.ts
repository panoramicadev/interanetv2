import { createCanvas } from 'canvas';

export async function convertPdfToImage(pdfBuffer: Buffer, width: number = 600): Promise<Buffer | null> {
  try {
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
  } catch (error) {
    console.error('[PDF-TO-IMAGE] Error converting PDF to image:', error);
    return null;
  }
}

export function isPdfFile(mimetype: string, filename: string): boolean {
  return mimetype === 'application/pdf' || filename.toLowerCase().endsWith('.pdf');
}
