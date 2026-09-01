/**
 * Las otras dos formas de bajarse una solicitud de crédito: el CSV para
 * trabajarla en Excel y el adjunto de la carpeta tributaria.
 *
 * El PDF sirve para archivar y mandar; el CSV sirve para editar —Finanzas
 * completa datos, corrige un RUT, arma su propia planilla— y la carpeta
 * tributaria es el respaldo que subió el vendedor. Antes la carpeta era un
 * enlace chico debajo del nombre; ahora es un botón al lado de los otros.
 */
import type { SolicitudCredito } from "@shared/schema";
import {
  resumenDeSolicitud,
  seccionesDeSolicitud,
  slug,
  texto,
} from "./solicitud-credito-datos";

/** Excel en Chile parte las columnas con punto y coma, no con coma. */
const SEPARADOR = ";";
/** Sin el BOM, Excel abre el archivo en Latin-1 y los acentos salen rotos. */
const BOM = "\uFEFF";

/** Dispara la descarga de un blob con el nombre que corresponda. */
function bajarArchivo(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/**
 * Una celda de CSV. Va siempre entre comillas: los valores traen punto y coma,
 * comas y saltos de línea (las observaciones, sobre todo) y sin comillas eso
 * corre las columnas.
 */
const celda = (valor: unknown) => `"${texto(valor).replace(/"/g, '""')}"`;

/**
 * La solicitud como planilla: una fila por campo, con la sección al lado para
 * poder filtrar. Vertical y no en una sola fila larga a propósito: así se lee y
 * se corrige sin tener que ir para el costado.
 */
export function descargarSolicitudCreditoCsv(solicitud: SolicitudCredito) {
  const filas: string[][] = [["Sección", "Campo", "Valor"]];

  for (const campo of resumenDeSolicitud(solicitud)) {
    filas.push(["Solicitud", campo.label, texto(campo.valor)]);
  }
  for (const { titulo, campos } of seccionesDeSolicitud(solicitud)) {
    for (const campo of campos) {
      filas.push([titulo, campo.label, texto(campo.valor)]);
    }
  }

  const csv = filas.map((fila) => fila.map(celda).join(SEPARADOR)).join("\r\n");
  bajarArchivo(
    new Blob([BOM + csv], { type: "text/csv;charset=utf-8;" }),
    `solicitud-credito-${slug(solicitud.razonSocial)}.csv`,
  );
}

/**
 * El adjunto de la carpeta tributaria.
 *
 * Los archivos viven en Supabase o en el object storage, así que bajarlos
 * directo desde el navegador choca con CORS: van por /api/proxy-file, el mismo
 * camino que ya usa el reporte de gastos para leer los comprobantes. Si aun así
 * falla, se abre el archivo en una pestaña —que es lo que hacía el enlace de
 * antes— en vez de dejar al usuario sin nada.
 */
export async function descargarCarpetaTributaria(solicitud: SolicitudCredito) {
  const url = solicitud.carpetaTributariaUrl;
  if (!url) throw new Error("Esta solicitud no tiene carpeta tributaria adjunta");

  const nombre =
    solicitud.carpetaTributariaNombre?.trim() ||
    `carpeta-tributaria-${slug(solicitud.razonSocial)}`;

  const mismoOrigen = url.startsWith("/") || url.startsWith(window.location.origin);
  const fuente = mismoOrigen ? url : `/api/proxy-file?url=${encodeURIComponent(url)}`;

  try {
    const res = await fetch(fuente, { credentials: "include" });
    if (!res.ok) throw new Error(`El archivo no se pudo traer (${res.status})`);
    bajarArchivo(await res.blob(), nombre);
  } catch (error) {
    const abierto = window.open(url, "_blank", "noopener");
    if (!abierto) throw error;
  }
}
