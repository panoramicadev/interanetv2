/**
 * CRM Seguimiento — Importación / Exportación masiva de leads (formato español).
 *
 * Fuente ÚNICA de las columnas del CSV y de los normalizadores de valores.
 * Sin dependencias de UI ni de DB: lo usan tanto el frontend (plantilla +
 * parseo/preview) como el server (import + export), para que el mapeo de
 * encabezados y la normalización de estado/prioridad/origen no se
 * desincronicen entre ambos lados.
 */

export type CrmImportField =
  | "nombre" | "empresa" | "rut" | "telefono" | "email"
  | "region" | "comuna" | "contactoEncargado" | "segmento"
  | "condicionPago" | "estado" | "prioridad" | "origen"
  | "montoEstimado" | "proximoContacto" | "notas" | "etiquetas"
  | "vendedorEmail";

export interface CrmImportColumn {
  key: CrmImportField;
  /** Encabezado en español que se escribe en la plantilla / export. */
  label: string;
  /** Encabezados alternativos aceptados al importar (además del label). */
  aliases?: string[];
  /** Solo aparece en la plantilla del administrador. */
  adminOnly?: boolean;
}

// Orden en el que aparecen las columnas en la plantilla y el export.
export const CRM_IMPORT_COLUMNS: CrmImportColumn[] = [
  { key: "nombre", label: "Nombre", aliases: ["cliente", "nombre cliente", "razon social", "name"] },
  { key: "empresa", label: "Empresa", aliases: ["compania", "company"] },
  { key: "rut", label: "RUT", aliases: ["run", "rut cliente"] },
  { key: "telefono", label: "Teléfono", aliases: ["telefono", "fono", "celular", "phone"] },
  { key: "email", label: "Correo", aliases: ["email", "correo electronico", "e-mail", "mail"] },
  { key: "region", label: "Región", aliases: ["region"] },
  { key: "comuna", label: "Comuna", aliases: ["ciudad", "municipio"] },
  { key: "contactoEncargado", label: "Contacto encargado", aliases: ["contacto", "encargado", "contacto de compras"] },
  { key: "segmento", label: "Segmento", aliases: ["rubro", "segment"] },
  { key: "condicionPago", label: "Condición de pago", aliases: ["condicion de pago", "forma de pago", "condicion pago"] },
  { key: "estado", label: "Estado", aliases: ["etapa", "pipeline", "stage"] },
  { key: "prioridad", label: "Prioridad", aliases: ["priority"] },
  { key: "origen", label: "Origen", aliases: ["fuente", "source"] },
  { key: "montoEstimado", label: "Monto estimado", aliases: ["monto", "valor", "oportunidad", "monto oportunidad"] },
  { key: "proximoContacto", label: "Próximo contacto", aliases: ["proximo contacto", "fecha proximo contacto"] },
  { key: "notas", label: "Notas", aliases: ["nota", "observaciones", "comentarios"] },
  { key: "etiquetas", label: "Etiquetas", aliases: ["tags", "etiqueta"] },
  { key: "vendedorEmail", label: "Correo del vendedor", adminOnly: true, aliases: ["vendedor", "correo vendedor", "email vendedor", "asignado a"] },
];

/** Normaliza un texto para comparar encabezados/valores: minúsculas, sin acentos. */
export function normKey(s: string | null | undefined): string {
  return (s || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().trim().replace(/\s+/g, " ");
}

// encabezado (normalizado) -> campo interno
const HEADER_LOOKUP: Record<string, CrmImportField> = (() => {
  const map: Record<string, CrmImportField> = {};
  for (const col of CRM_IMPORT_COLUMNS) {
    map[normKey(col.label)] = col.key;
    map[normKey(col.key)] = col.key;
    for (const a of col.aliases || []) map[normKey(a)] = col.key;
  }
  return map;
})();

// ─── Normalizadores de valores ────────────────────────────────────────

export const CRM_ESTADO_LABELS: Record<string, string> = {
  prospecto: "Prospecto",
  seguimiento: "Seguimiento",
  cotizacion: "Cotización",
  venta: "Venta",
  despacho: "Despacho",
};

// Acepta los valores canónicos, sus etiquetas y los estados legacy.
const ESTADO_IMPORT_MAP: Record<string, string> = {
  prospecto: "prospecto",
  seguimiento: "seguimiento",
  cotizacion: "cotizacion", cotizaciones: "cotizacion",
  venta: "venta", ventas: "venta",
  despacho: "despacho", despachos: "despacho",
  // legacy (espejo de LEGACY_ESTADOS en client/src/lib/crm-seguimiento.ts)
  nuevo: "prospecto", contactado: "seguimiento", completado: "venta", perdido: "prospecto",
};

export function normalizeEstadoImport(v?: string | null): string {
  return ESTADO_IMPORT_MAP[normKey(v)] || "prospecto";
}

const PRIORIDAD_IMPORT_MAP: Record<string, string> = {
  baja: "baja", low: "baja",
  media: "media", normal: "media", medium: "media",
  alta: "alta", high: "alta",
};

export function normalizePrioridadImport(v?: string | null): string {
  return PRIORIDAD_IMPORT_MAP[normKey(v)] || "media";
}

const ORIGEN_IMPORT_MAP: Record<string, string> = {
  manual: "manual",
  "digital organico": "digital_organico", digital_organico: "digital_organico", organico: "digital_organico",
  "digital pagado": "digital_pagado", digital_pagado: "digital_pagado", pagado: "digital_pagado",
  referido: "referido", web: "web", llamada: "llamada",
};

export function normalizeOrigenImport(v?: string | null): string {
  return ORIGEN_IMPORT_MAP[normKey(v)] || "manual";
}

/** Etiquetas legibles del origen para el export. */
export const CRM_ORIGEN_LABELS: Record<string, string> = {
  manual: "Manual",
  digital_organico: "Digital orgánico",
  digital_pagado: "Digital pagado",
  referido: "Referido",
  web: "Web",
  llamada: "Llamada",
};

export const CRM_PRIORIDAD_LABELS: Record<string, string> = {
  baja: "Baja", media: "Media", alta: "Alta",
};

/**
 * Parsea un monto en formato chileno/español → string numérico o null.
 * Acepta "$1.234.567", "1.234.567", "1234567,50". Sin coma decimal los
 * puntos se tratan como separador de miles.
 */
export function parseMontoImport(v?: string | null): string | null {
  if (v == null) return null;
  let s = String(v).trim();
  if (!s) return null;
  s = s.replace(/[^0-9.,-]/g, "");
  if (!s || s === "-") return null;
  if (s.includes(",")) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else {
    s = s.replace(/\./g, "");
  }
  const n = Number(s);
  return isFinite(n) ? String(n) : null;
}

/** Parsea una fecha en dd-mm-aaaa, dd/mm/aaaa o aaaa-mm-dd → "aaaa-mm-dd" o null. */
export function parseFechaImport(v?: string | null): string | null {
  if (!v) return null;
  const s = String(v).trim();
  if (!s) return null;
  let m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (m) {
    const [, d, mo, y] = m;
    const yr = y.length === 2 ? "20" + y : y;
    return `${yr}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  m = s.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/);
  if (m) {
    const [, y, mo, d] = m;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return null;
}

/** Convierte "tag1, tag2 | tag3" → JSON array string, o null si no hay etiquetas. */
export function parseEtiquetasImport(v?: string | null): string | null {
  if (!v) return null;
  const parts = String(v).split(/[,|]/).map((t) => t.trim()).filter(Boolean);
  return parts.length ? JSON.stringify(parts) : null;
}

// ─── Mapeo de una fila del CSV a los campos del lead ──────────────────

export interface CrmImportRow {
  nombre: string;
  empresa: string | null;
  rut: string | null;
  telefono: string | null;
  email: string | null;
  region: string | null;
  comuna: string | null;
  contactoEncargado: string | null;
  segmento: string | null;
  condicionPago: string | null;
  /** null = la columna no venía (no pisar al actualizar; usar default al crear). */
  estado: string | null;
  prioridad: string | null;
  origen: string | null;
  montoEstimado: string | null;
  proximoContacto: string | null; // "aaaa-mm-dd" | null
  notas: string | null;
  etiquetas: string | null;        // JSON array string | null
  vendedorEmail: string | null;
}

/** Extrae el valor de un campo desde una fila cruda (encabezados en cualquier variante). */
function pick(raw: Record<string, any>, key: CrmImportField): string | null {
  for (const rawKey of Object.keys(raw)) {
    if (HEADER_LOOKUP[normKey(rawKey)] === key) {
      const val = (raw[rawKey] ?? "").toString().trim();
      return val === "" ? null : val;
    }
  }
  return null;
}

/**
 * Convierte una fila cruda parseada del CSV en los campos normalizados del
 * lead. Los campos ausentes/vacíos quedan en null (para no pisar datos al
 * actualizar un lead existente). El server es quien decide creación vs
 * actualización y resuelve el vendedor.
 */
export function mapRowToLead(raw: Record<string, any>): CrmImportRow {
  const estadoRaw = pick(raw, "estado");
  const prioridadRaw = pick(raw, "prioridad");
  const origenRaw = pick(raw, "origen");
  return {
    nombre: pick(raw, "nombre") || "",
    empresa: pick(raw, "empresa"),
    rut: pick(raw, "rut"),
    telefono: pick(raw, "telefono"),
    email: pick(raw, "email"),
    region: pick(raw, "region"),
    comuna: pick(raw, "comuna"),
    contactoEncargado: pick(raw, "contactoEncargado"),
    segmento: pick(raw, "segmento"),
    condicionPago: pick(raw, "condicionPago"),
    estado: estadoRaw ? normalizeEstadoImport(estadoRaw) : null,
    prioridad: prioridadRaw ? normalizePrioridadImport(prioridadRaw) : null,
    origen: origenRaw ? normalizeOrigenImport(origenRaw) : null,
    montoEstimado: parseMontoImport(pick(raw, "montoEstimado")),
    proximoContacto: parseFechaImport(pick(raw, "proximoContacto")),
    notas: pick(raw, "notas"),
    etiquetas: parseEtiquetasImport(pick(raw, "etiquetas")),
    vendedorEmail: pick(raw, "vendedorEmail"),
  };
}

// ─── Generación de CSV ────────────────────────────────────────────────

// Delimitador punto y coma: Excel en español lo usa por defecto y evita
// choques con la coma decimal de los montos.
export const CRM_CSV_DELIMITER = ";";

function csvCell(v: string | number | null | undefined): string {
  const s = v == null ? "" : String(v);
  if (/["\n\r;]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

export function csvRow(cells: (string | number | null | undefined)[]): string {
  return cells.map(csvCell).join(CRM_CSV_DELIMITER);
}

/** Encabezados de la plantilla; el admin incluye "Correo del vendedor". */
export function buildTemplateHeaders(includeAdmin: boolean): string[] {
  return CRM_IMPORT_COLUMNS.filter((c) => includeAdmin || !c.adminOnly).map((c) => c.label);
}

/** Plantilla vacía (solo encabezados). */
export function buildTemplateCsv(includeAdmin: boolean): string {
  return csvRow(buildTemplateHeaders(includeAdmin));
}
