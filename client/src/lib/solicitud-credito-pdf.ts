/**
 * El PDF de una solicitud de crédito: el mismo papel que se llenaba a mano,
 * pero armado con lo que quedó registrado en el sistema.
 *
 * Finanzas y el cliente siguen necesitando el documento —para el archivador,
 * para mandarlo por correo, para adjuntarlo a la carpeta—, así que la solicitud
 * se baja tal cual se envió (empresa, socios, bancos, monto y plazo) y con la
 * resolución adentro cuando ya está resuelta.
 *
 * Se arma en el navegador con jsPDF, el mismo camino que el reporte de gastos:
 * los datos ya están en la pantalla y no hace falta pasar por el servidor.
 */
import jsPDF from "jspdf";
import type { SolicitudCredito } from "@shared/schema";
import {
  fmtFecha,
  resumenDeSolicitud,
  seccionesDeSolicitud,
  slug,
  texto,
  type CampoSolicitud,
} from "./solicitud-credito-datos";

// jsPDF no lee las variables CSS del tema: acá el naranja de marca y los grises
// van en RGB, que es lo único que entiende el generador.
const NARANJA: [number, number, number] = [253, 99, 1];
const TINTA: [number, number, number] = [30, 41, 59];
const GRIS: [number, number, number] = [110, 122, 138];
const SUPERFICIE: [number, number, number] = [247, 249, 251];
const VERDE: [number, number, number] = [5, 150, 105];
const ROJO: [number, number, number] = [190, 45, 45];
const AMBAR: [number, number, number] = [180, 120, 10];

const ANCHO_PAGINA = 210;
const ALTO_PAGINA = 297;
const MARGEN = 14;
const ANCHO_CONTENIDO = ANCHO_PAGINA - MARGEN * 2;
const PAD = 6;
const GAP = 6;
const AIRE_FILA = 5.5;
/** Debajo de esto empieza el pie: lo que no entra, se va a la página siguiente. */
const PISO = ALTO_PAGINA - 20;

const LOGO_BLANCO = "/panoramica-logo-white.png";
const LOGO_RATIO = 371 / 1000; // alto/ancho del PNG, para no deformarlo

/**
 * El logo va embebido en el PDF, así que hay que traerlo como bytes. Si no se
 * puede (sin red, archivo movido), el encabezado cae al nombre escrito: mejor
 * un PDF sin logo que un botón que no descarga nada.
 */
async function cargarLogo(): Promise<Uint8Array | null> {
  try {
    const res = await fetch(LOGO_BLANCO);
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  } catch {
    return null;
  }
}

const COLOR_ESTADO: Record<string, [number, number, number]> = {
  enviada: AMBAR,
  aprobada: VERDE,
  rechazada: ROJO,
};

export async function descargarSolicitudCreditoPdf(solicitud: SolicitudCredito) {
  const doc = new jsPDF({ orientation: "p", unit: "mm", format: "a4", compress: true });
  const logo = await cargarLogo();

  // ── Encabezado ────────────────────────────────────────────────────────────
  doc.setFillColor(...NARANJA);
  doc.rect(0, 0, ANCHO_PAGINA, 34, "F");
  doc.setTextColor(255, 255, 255);

  if (logo) {
    const ancho = 34;
    doc.addImage(logo, "PNG", MARGEN, 10, ancho, ancho * LOGO_RATIO);
  } else {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("PANORÁMICA", MARGEN, 19);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("SOLICITUD DE CRÉDITO", ANCHO_PAGINA - MARGEN, 17, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.text(
    `${solicitud.razonSocial} · ${solicitud.rut}`,
    ANCHO_PAGINA - MARGEN,
    24,
    { align: "right", maxWidth: ANCHO_CONTENIDO - 40 },
  );

  let y = 44;

  // ── Quién la pidió y en qué estado quedó ──────────────────────────────────
  doc.setFontSize(8.5);
  doc.setTextColor(...GRIS);
  doc.text(
    `Enviada el ${fmtFecha(solicitud.createdAt)} por ${texto(solicitud.solicitanteNombre)}`,
    MARGEN,
    y,
  );

  const estado = String(solicitud.estado ?? "");
  const colorEstado = COLOR_ESTADO[estado] ?? GRIS;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  const anchoPill = doc.getTextWidth(estado.toUpperCase()) + 8;
  doc.setFillColor(...colorEstado);
  doc.roundedRect(ANCHO_PAGINA - MARGEN - anchoPill, y - 4.2, anchoPill, 6, 3, 3, "F");
  doc.setTextColor(255, 255, 255);
  doc.text(estado.toUpperCase(), ANCHO_PAGINA - MARGEN - anchoPill / 2, y, { align: "center" });

  y += 7;

  // ── Las tres cifras que se miran primero ──────────────────────────────────
  const resumen = resumenDeSolicitud(solicitud);
  const delResumen = (label: string) => texto(resumen.find((c) => c.label === label)?.valor);
  const tiles: { label: string; valor: string; color: [number, number, number] }[] = [
    { label: "Crédito solicitado", valor: delResumen("Crédito solicitado"), color: TINTA },
    { label: "Plazo solicitado", valor: delResumen("Plazo solicitado"), color: TINTA },
    {
      label: "Crédito aprobado",
      valor: delResumen("Crédito aprobado"),
      color: solicitud.creditoAprobado != null ? VERDE : GRIS,
    },
  ];
  const anchoTile = (ANCHO_CONTENIDO - GAP * 2) / 3;
  tiles.forEach((tile, i) => {
    const x = MARGEN + i * (anchoTile + GAP);
    doc.setFillColor(...SUPERFICIE);
    doc.roundedRect(x, y, anchoTile, 20, 3.5, 3.5, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(...GRIS);
    doc.setCharSpace(0.35);
    doc.text(tile.label.toUpperCase(), x + 5, y + 7);
    doc.setCharSpace(0);
    doc.setFontSize(14);
    doc.setTextColor(...tile.color);
    doc.text(tile.valor, x + 5, y + 15.5);
  });
  y += 20 + GAP + 2;

  // ── Secciones ─────────────────────────────────────────────────────────────
  /** Ancho útil de una columna cuando la sección se parte en `columnas`. */
  const anchoColumna = (columnas: number) =>
    (ANCHO_CONTENIDO - PAD * 2 - GAP * (columnas - 1)) / columnas;

  /** Alto de un campo: la etiqueta arriba y el valor abajo, ya cortado en líneas. */
  const altoCampo = (campo: CampoSolicitud, columnas: number) => {
    const ancho = campo.ancho === 2 ? ANCHO_CONTENIDO - PAD * 2 : anchoColumna(columnas);
    doc.setFontSize(9.5);
    return 3.5 + doc.splitTextToSize(texto(campo.valor), ancho).length * 4.4;
  };

  /** Los campos se acomodan de a `columnas`; los de ancho 2 toman la fila entera. */
  const filas = (campos: CampoSolicitud[], columnas: number) => {
    const salida: CampoSolicitud[][] = [];
    for (let i = 0; i < campos.length; i++) {
      if (campos[i].ancho === 2) {
        salida.push([campos[i]]);
        continue;
      }
      const fila = [campos[i]];
      while (fila.length < columnas && campos[i + 1] && campos[i + 1].ancho !== 2) {
        fila.push(campos[++i]);
      }
      salida.push(fila);
    }
    return salida;
  };

  const seccion = (titulo: string, campos: CampoSolicitud[], columnas = 2) => {
    const grupos = filas(campos, columnas);
    // El aire va entre filas, no después de la última: si no, la tarjeta queda
    // con el doble de espacio abajo que arriba y se nota.
    const altoFilas = grupos.map((g) => Math.max(...g.map((c) => altoCampo(c, columnas))));
    const alto =
      PAD + 6 +
      altoFilas.reduce((t, h) => t + h, 0) +
      AIRE_FILA * (altoFilas.length - 1) +
      PAD - 2.5;

    if (y + alto > PISO) {
      doc.addPage();
      y = MARGEN + 6;
    }

    doc.setFillColor(...SUPERFICIE);
    doc.roundedRect(MARGEN, y, ANCHO_CONTENIDO, alto, 3.5, 3.5, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...NARANJA);
    doc.setCharSpace(0.5);
    doc.text(titulo.toUpperCase(), MARGEN + PAD, y + PAD + 1.5);
    doc.setCharSpace(0);

    let yFila = y + PAD + 6;
    for (const grupo of grupos) {
      grupo.forEach((campo, i) => {
        const x = MARGEN + PAD + i * (anchoColumna(columnas) + GAP);
        const ancho = campo.ancho === 2 ? ANCHO_CONTENIDO - PAD * 2 : anchoColumna(columnas);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(6.5);
        doc.setTextColor(...GRIS);
        doc.setCharSpace(0.35);
        doc.text(campo.label.toUpperCase(), x, yFila);
        doc.setCharSpace(0);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9.5);
        doc.setTextColor(...TINTA);
        doc.text(doc.splitTextToSize(texto(campo.valor), ancho), x, yFila + 4.4);
      });
      yFila += Math.max(...grupo.map((c) => altoCampo(c, columnas))) + AIRE_FILA;
    }

    y += alto + GAP;
  };

  for (const { titulo, campos, columnas } of seccionesDeSolicitud(solicitud)) {
    seccion(titulo, campos, columnas ?? 2);
  }

  // ── Pie, en todas las páginas ─────────────────────────────────────────────
  const paginas = doc.getNumberOfPages();
  for (let p = 1; p <= paginas; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...GRIS);
    doc.text(
      `Panorámica · Solicitud de crédito de ${solicitud.razonSocial} · generada el ${new Date().toLocaleDateString("es-CL")}`,
      MARGEN,
      ALTO_PAGINA - 10,
    );
    doc.text(`${p} / ${paginas}`, ANCHO_PAGINA - MARGEN, ALTO_PAGINA - 10, { align: "right" });
  }

  doc.save(`solicitud-credito-${slug(solicitud.razonSocial)}.pdf`);
}
