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

/**
 * Cómo quedó la solicitud: quién la pidió, por cuánto y en qué terminó.
 * El PDF lo muestra arriba (encabezado y cifras grandes) en vez de como
 * sección, así que va aparte de las del cuerpo.
 */
export function resumenDeSolicitud(s: SolicitudCredito): CampoSolicitud[] {
  return [
    { label: "Fecha de envío", valor: fmtFecha(s.createdAt) },
    { label: "Solicitante", valor: s.solicitanteNombre },
    { label: "Estado", valor: estadoLegible(s.estado) },
    { label: "Crédito solicitado", valor: money(s.creditoSolicitado) },
    { label: "Plazo solicitado", valor: s.diasSolicitados ? `${s.diasSolicitados} días` : null },
    { label: "Crédito aprobado", valor: s.creditoAprobado != null ? money(s.creditoAprobado) : null },
  ];
}

/** El cuerpo del formulario, sección por sección y en el orden del papel. */
export function seccionesDeSolicitud(s: SolicitudCredito): SeccionSolicitud[] {
  return [
    {
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
    },
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
    {
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
    },
    {
      titulo: "Resolución de Finanzas",
      campos: [
        { label: "Estado", valor: estadoLegible(s.estado) },
        { label: "Crédito aprobado", valor: s.creditoAprobado != null ? money(s.creditoAprobado) : null },
        { label: "Resuelta por", valor: s.resueltaPorNombre },
        { label: "Resuelta el", valor: s.resueltaAt ? fmtFecha(s.resueltaAt) : null },
        { label: "Observaciones", valor: s.observaciones, ancho: 2 },
      ],
    },
  ];
}
