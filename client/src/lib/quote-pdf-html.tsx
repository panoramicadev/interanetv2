// Frontend wrapper for the shared quote-pdf template.
// Opens a new window with the rendered HTML and triggers printing.
//
// The actual HTML/CSS lives in shared/quote-pdf-template.ts so the server
// (/api/external/cotizaciones/:id/pdf) generates the EXACT same document.

import { renderQuoteHtml } from '@shared/quote-pdf-template';

export const generatePDFFromQuote = (quote: any, items: any[]) => {
  try {
    const htmlContent = renderQuoteHtml(quote, items, {
      logoUrl: `${window.location.origin}/panoramica-logo.png`,
      autoPrint: true,
    });

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      throw new Error('No se pudo abrir la ventana del PDF. Verifique que no esté bloqueada por el navegador.');
    }

    printWindow.document.write(htmlContent);
    printWindow.document.close();

    const logoImg = printWindow.document.querySelector('.header-left img') as HTMLImageElement | null;
    const triggerPrint = () => {
      setTimeout(() => {
        printWindow.print();
        setTimeout(() => {
          try { printWindow.close(); } catch (e) { /* ignored */ }
        }, 1000);
      }, 300);
    };

    if (logoImg && !logoImg.complete) {
      logoImg.onload = triggerPrint;
      logoImg.onerror = triggerPrint;
      setTimeout(triggerPrint, 3000);
    } else {
      triggerPrint();
    }
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error;
  }
};
