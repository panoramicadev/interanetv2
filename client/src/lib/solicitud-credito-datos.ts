/**
 * Lo que dice una solicitud de crédito, en un solo lugar.
 *
 * El PDF y el CSV muestran los mismos datos con las mismas etiquetas; si cada
 * uno arma su propia lista, al agregar un campo se actualiza uno y el otro
 * queda viejo —ya pasó con el correo DTE—. Acá viven las secciones y los
 * formatos; cada formato decide nada más cómo dibujarlas.
 */
import type { SolicitudCredito } from "@shared/schema";

export type CampoSolicitud = {
  label: string;
  valor: string | null | undefined;
  /** 2 = ocupa la fila entera (solo lo usa el PDF). */
  ancho?: 1 | 2;
};

export type SeccionSolicitud = {
  titulo: string;
  campos: CampoSolicitud[];
  /** Campos por fila en el PDF. Por defecto, dos. */
  columnas?: number;
};

/** Vacío se muestra como raya: un campo en blanco no se distingue de uno perdido. */
export const texto = (valor: unknown) => {
  const s = valor == null ? "" : String(valor).trim();
  return s || "—";
};

export const money = (valor: unknown) => {
  const n = Number(valor ?? 0);
  return Number.isFinite(n) ? `$${Math.round(n).toLocaleString("es-CL")}` : "—";
};

export const fmtFecha = (valor: string | Date | null | undefined) => {
  if (!valor) return "—";
  const d = new Date(valor as any);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("es-CL");
};

/** Para el nombre del archivo: "Constructora Los Ríos" → "constructora-los-rios". */
export const slug = (valor: string) =>
  valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "solicitud";

export const estadoLegible = (estado: string | null | undefined) => {
  const s = String(estado ?? "").trim();
  return s ? s[0].toUpperCase() + s.slice(1) : "—";
};

/** Aumento de la línea de un cliente que ya compra (las demás son de cliente nuevo). */
export const esAumento = (s: SolicitudCredito) => s.tipo === "aumento";

/** La línea que el cliente tenía al pedir el aumento. Sin línea se dice, no se muestra $0. */
export const lineaActual = (s: SolicitudCredito) =>
  Number(s.creditoActual) > 0 ? money(s.creditoActual) : "Sin línea";

/** El nombre del papel, para el encabezado y el pie. */
export const tituloDeSolicitud = (s: SolicitudCredito) =>
  esAumento(s) ? "Solicitud de aumento de crédito" : "Solicitud de crédito";

/**
 * Nombre de las descargas, sin extensión. El del aumento es otro para que no se
 * confunda con la solicitud con la que el mismo cliente obtuvo su crédito.
 */
export const nombreDeArchivo = (s: SolicitudCredito) =>
  `${esAumento(s) ? "aumento-credito" : "solicitud-credito"}-${slug(s.razonSocial)}`;

/**
 * Cómo quedó la solicitud: quién la pidió, por cuánto y en qué terminó.
 * El PDF lo muestra arriba (encabezado y cifras grandes) en vez de como
 * sección, así que va aparte de las del cuerpo.
 */
export function resumenDeSolicitud(s: SolicitudCredito): CampoSolicitud[] {
  const envio: CampoSolicitud[] = [
    { label: "Fecha de envío", valor: fmtFecha(s.createdAt) },
    { label: "Solicitante", valor: s.solicitanteNombre },
    { label: "Estado", valor: estadoLegible(s.estado) },
  ];
  // En un aumento las cifras se leen como líneas: desde cuál se sube y hasta
  // cuál. Lo solicitado y lo aprobado son la línea total, no lo que se suma.
  if (esAumento(s)) {
    return [
      ...envio,
      { label: "Tipo", valor: "Aumento de crédito" },
      { label: "Línea actual", valor: lineaActual(s) },
      { label: "Línea solicitada", valor: money(s.creditoSolicitado) },
      { label: "Línea aprobada", valor: s.creditoAprobado != null ? money(s.creditoAprobado) : null },
    ];
  }
  return [
    ...envio,
    { label: "Crédito solicitado", valor: money(s.creditoSolicitado) },
    { label: "Plazo solicitado", valor: s.diasSolicitados ? `${s.diasSolicitados} días` : null },
    { label: "Crédito aprobado", valor: s.creditoAprobado != null ? money(s.creditoAprobado) : null },
  ];
}

/** El cuerpo del formulario, sección por sección y en el orden del papel. */
export function seccionesDeSolicitud(s: SolicitudCredito): SeccionSolicitud[] {
  const empresa: SeccionSolicitud = {
    titulo: "Datos de la empresa",
    campos: [
      { label: "Razón social", valor: s.razonSocial },
      { label: "RUT", valor: s.rut },
      { label: "Dirección", valor: s.direccion },
      { label: "Ciudad", valor: s.ciudad },
      { label: "Teléfono", valor: s.telefono },
      { label: "Giro", valor: s.giro },
      { label: "Correo cobranza", valor: s.correo },
      { label: "Correo electrónico receptor DTE (SII)", valor: s.correoDte },
    ],
  };
  const carpeta: SeccionSolicitud = {
    titulo: "Carpeta tributaria",
    campos: [
      {
        label: "Adjunto",
        valor:
          s.carpetaTributariaNombre || (s.carpetaTributariaUrl ? "Adjunta" : "Sin carpeta tributaria"),
        ancho: 2,
      },
      ...(s.carpetaTributariaUrl
        ? [{ label: "Enlace", valor: s.carpetaTributariaUrl, ancho: 2 } as CampoSolicitud]
        : []),
    ],
  };
  const resolucion: SeccionSolicitud = {
    titulo: "Resolución de Finanzas",
    campos: [
      { label: "Estado", valor: estadoLegible(s.estado) },
      {
        label: esAumento(s) ? "Línea aprobada" : "Crédito aprobado",
        valor: s.creditoAprobado != null ? money(s.creditoAprobado) : null,
      },
      { label: "Resuelta por", valor: s.resueltaPorNombre },
      { label: "Resuelta el", valor: s.resueltaAt ? fmtFecha(s.resueltaAt) : null },
      { label: "Observaciones", valor: s.observaciones, ancho: 2 },
    ],
  };

  // Un aumento no pide socios, representante ni bancos: Finanzas ya los tiene de
  // cuando se le dio crédito al cliente, y esas secciones saldrían vacías. Lo
  // suyo es el plazo y el motivo.
  if (esAumento(s)) {
    return [
      {
        titulo: "Aumento de crédito",
        campos: [
          { label: "Plazo actual", valor: s.diasActuales ? `${s.diasActuales} días` : null },
          { label: "Plazo solicitado", valor: s.diasSolicitados ? `${s.diasSolicitados} días` : null },
          { label: "Motivo del aumento", valor: s.motivo, ancho: 2 },
        ],
      },
      empresa,
      carpeta,
      resolucion,
    ];
  }

  return [
    empresa,
    {
      titulo: "Socios principales",
      campos: [
        { label: "Socio 1", valor: s.socio1Nombre },
        { label: "Dirección particular", valor: s.socio1Direccion },
        { label: "Socio 2", valor: s.socio2Nombre },
        { label: "Dirección particular", valor: s.socio2Direccion },
      ],
    },
    {
      titulo: "Representante legal",
      campos: [
        { label: "Nombre", valor: s.representanteNombre },
        { label: "Cédula de identidad", valor: s.representanteCedula },
      ],
    },
    {
      titulo: "Cuentas corrientes",
      columnas: 3,
      campos: [
        { label: "Banco 1", valor: s.banco1 },
        { label: "Cuenta corriente Nº", valor: s.cuenta1 },
        { label: "Sucursal", valor: s.sucursal1 },
        { label: "Banco 2", valor: s.banco2 },
        { label: "Cuenta corriente Nº", valor: s.cuenta2 },
        { label: "Sucursal", valor: s.sucursal2 },
      ],
    },
    carpeta,
    resolucion,
  ];
}
