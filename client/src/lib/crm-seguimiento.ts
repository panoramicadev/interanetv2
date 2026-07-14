/**
 * CRM Seguimiento de Clientes — constantes y helpers compartidos entre la
 * lista (seguimiento-clientes.tsx) y el detalle (seguimiento-cliente-detalle.tsx).
 * Fuente única del pipeline: si se agrega una etapa, se hace SOLO acá.
 */
import {
  Sparkles, UserCheck, FileText, ShoppingCart,
  PhoneCall, MapPin, MessageSquare, RefreshCw,
  Users, Mail, Video, XCircle,
} from "lucide-react";
import { getTodayAtMidnight } from "@/lib/dateUtils";

// ─── Pipeline (etapas del seguimiento) ────────────────────────────────
// Tokens de color por etapa para todos los contextos visuales:
// badge (chip), bgCard/border (tarjetas), column (fondo columna kanban),
// dot (acento sólido: stepper, indicadores), text (texto acentuado).
export const ESTADOS = [
  {
    value: "prospecto",
    label: "Prospecto",
    icon: Sparkles,
    color: "from-cyan-400 to-cyan-600",
    bgCard: "bg-cyan-50 dark:bg-cyan-900/20",
    badge: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300",
    border: "border-cyan-200 dark:border-cyan-800",
    column: "bg-cyan-50/60 dark:bg-cyan-950/20",
    dot: "bg-cyan-500",
    text: "text-cyan-600 dark:text-cyan-400",
  },
  {
    value: "seguimiento",
    label: "Seguimiento",
    icon: UserCheck,
    color: "from-blue-400 to-blue-600",
    bgCard: "bg-blue-50 dark:bg-blue-900/20",
    badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    border: "border-blue-200 dark:border-blue-800",
    column: "bg-blue-50/60 dark:bg-blue-950/20",
    dot: "bg-blue-500",
    text: "text-blue-600 dark:text-blue-400",
  },
  {
    value: "cotizacion",
    label: "Cotización",
    icon: FileText,
    color: "from-amber-400 to-amber-600",
    bgCard: "bg-amber-50 dark:bg-amber-900/20",
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    border: "border-amber-200 dark:border-amber-800",
    column: "bg-amber-50/60 dark:bg-amber-950/20",
    dot: "bg-amber-500",
    text: "text-amber-600 dark:text-amber-400",
  },
  {
    value: "venta",
    label: "Venta",
    icon: ShoppingCart,
    color: "from-emerald-400 to-emerald-600",
    bgCard: "bg-emerald-50 dark:bg-emerald-900/20",
    badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    border: "border-emerald-200 dark:border-emerald-800",
    column: "bg-emerald-50/60 dark:bg-emerald-950/20",
    dot: "bg-emerald-500",
    text: "text-emerald-600 dark:text-emerald-400",
  },
  {
    value: "perdido",
    label: "No le Interesa / Perdido",
    icon: XCircle,
    color: "from-rose-400 to-rose-600",
    bgCard: "bg-rose-50 dark:bg-rose-900/20",
    badge: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
    border: "border-rose-200 dark:border-rose-800",
    column: "bg-rose-50/60 dark:bg-rose-950/20",
    dot: "bg-rose-500",
    text: "text-rose-600 dark:text-rose-400",
  },
] as const;

export type EstadoValue = (typeof ESTADOS)[number]["value"];

// Datos antiguos pueden traer estados del esquema viejo (nuevo/contactado/…).
// Se normalizan solo para mostrar; al editar, la UI escribe el valor canónico.
const LEGACY_ESTADOS: Record<string, EstadoValue> = {
  nuevo: "prospecto",
  contactado: "seguimiento",
  completado: "venta",
  despacho: "venta", // etapa retirada del pipeline; leads antiguos caen en Venta
};

export function normalizeEstado(estado: string | null | undefined): EstadoValue {
  if (!estado) return "prospecto";
  if (ESTADOS.some((e) => e.value === estado)) return estado as EstadoValue;
  return LEGACY_ESTADOS[estado] || "prospecto";
}

export function getEstadoConfig(estado: string | null | undefined) {
  const value = normalizeEstado(estado);
  return ESTADOS.find((e) => e.value === value) || ESTADOS[0];
}

// ─── Prioridades ──────────────────────────────────────────────────────
export const PRIORIDADES = [
  { value: "baja", label: "Baja", color: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400", dot: "bg-slate-400" },
  { value: "media", label: "Media", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300", dot: "bg-yellow-500" },
  { value: "alta", label: "Alta", color: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300", dot: "bg-red-500" },
];

export function getPrioridadConfig(prioridad: string | null | undefined) {
  return PRIORIDADES.find((p) => p.value === prioridad) || PRIORIDADES[1];
}

// ─── Tipos de hito (interacciones del timeline) ───────────────────────
export const HITO_TIPOS = [
  { value: "contacto", label: "Contacto", icon: UserCheck, color: "text-blue-500", ring: "bg-blue-100 dark:bg-blue-900/40" },
  { value: "llamada", label: "Llamada", icon: PhoneCall, color: "text-indigo-500", ring: "bg-indigo-100 dark:bg-indigo-900/40" },
  { value: "cotizacion", label: "Cotización", icon: FileText, color: "text-amber-500", ring: "bg-amber-100 dark:bg-amber-900/40" },
  { value: "visita", label: "Visita", icon: MapPin, color: "text-green-500", ring: "bg-green-100 dark:bg-green-900/40" },
  { value: "venta", label: "Venta", icon: ShoppingCart, color: "text-emerald-600", ring: "bg-emerald-100 dark:bg-emerald-900/40" },
  { value: "nota", label: "Nota", icon: MessageSquare, color: "text-slate-500", ring: "bg-slate-100 dark:bg-slate-800" },
  { value: "sistema", label: "Sistema", icon: RefreshCw, color: "text-cyan-500", ring: "bg-cyan-100 dark:bg-cyan-900/40" },
];

// ─── Tipos agendables (modo "Agendar" del composer de Actividad) ──────
// Eventos a futuro que caen en el calendario: reuniones, llamadas,
// correos… Se guardan como hitos con fechaProgramada, salvo "seguimiento"
// que va a la bitácora (BIT_COMPOSER_VALUES en el detalle).
export const AGENDA_TIPOS = [
  { value: "reunion", label: "Reunión", icon: Users, color: "text-violet-500", ring: "bg-violet-100 dark:bg-violet-900/40" },
  { value: "llamada", label: "Llamada", icon: PhoneCall, color: "text-indigo-500", ring: "bg-indigo-100 dark:bg-indigo-900/40" },
  { value: "videollamada", label: "Videollamada", icon: Video, color: "text-fuchsia-500", ring: "bg-fuchsia-100 dark:bg-fuchsia-900/40" },
  { value: "correo", label: "Correo", icon: Mail, color: "text-sky-500", ring: "bg-sky-100 dark:bg-sky-900/40" },
  { value: "visita", label: "Visita", icon: MapPin, color: "text-green-500", ring: "bg-green-100 dark:bg-green-900/40" },
  { value: "seguimiento", label: "Seguimiento", icon: UserCheck, color: "text-purple-500", ring: "bg-purple-100 dark:bg-purple-900/40" },
];

export function getHitoConfig(tipo: string | null | undefined) {
  return (
    HITO_TIPOS.find((h) => h.value === tipo) ||
    AGENDA_TIPOS.find((h) => h.value === tipo) ||
    HITO_TIPOS[6]
  );
}

// ─── Catálogos fijos ──────────────────────────────────────────────────
export const SEGMENTOS_CRM = [
  "Construcción",
  "Ferretería",
  "Digital",
  "Industrial",
];

export const REGIONES_CHILE = [
  "Arica y Parinacota",
  "Tarapacá",
  "Antofagasta",
  "Atacama",
  "Coquimbo",
  "Valparaíso",
  "Metropolitana de Santiago",
  "O'Higgins",
  "Maule",
  "Ñuble",
  "Biobío",
  "La Araucanía",
  "Los Ríos",
  "Los Lagos",
  "Aysén",
  "Magallanes y la Antártica Chilena",
];

export const CONDICIONES_PAGO = [
  "CONTADO",
  "CREDITO 15 DIAS",
  "CREDITO 30 DIAS",
  "CREDITO 45 DIAS",
  "CREDITO 60 DIAS",
  "CREDITO 90 DIAS",
  "CREDITO 120 DIAS",
  "CONTRA ENTREGA",
  "TRANSFERENCIA",
];

// ─── Helpers de formato ───────────────────────────────────────────────

/**
 * Fechas "puras" (proximoContacto, feemdo…) llegan del server como
 * 'YYYY-MM-DD' o ISO a medianoche UTC. Parsearlas con new Date() las
 * corre un día hacia atrás en Chile (UTC-4/-3); acá se interpretan como
 * fecha calendario local. Timestamps reales (con hora) pasan intactos.
 */
function asCalendarDate(dateStr: string): Date | null {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  if (/^\d{4}-\d{2}-\d{2}([T ]00:00:00(\.\d+)?(Z|\+00(:00)?)?)?$/.test(dateStr)) {
    return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  }
  return d;
}

export function timeAgo(dateStr: string | null | undefined) {
  if (!dateStr) return "Sin contacto";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Hoy";
  if (diffDays === 1) return "Ayer";
  if (diffDays < 7) return `Hace ${diffDays} días`;
  if (diffDays < 30) return `Hace ${Math.floor(diffDays / 7)} sem.`;
  return `Hace ${Math.floor(diffDays / 30)} mes(es)`;
}

export function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return "—";
  const d = asCalendarDate(dateStr);
  if (!d) return "—";
  return d.toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });
}

/**
 * Hora de un evento agendado: "HH:mm", o null si es "todo el día".
 * El composer guarda las 12:00 exactas como sentinela de sin-hora (además
 * evita que el día se corra al pasar por UTC), así que esa hora no se
 * muestra.
 */
export function formatHoraAgendada(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  if (d.getHours() === 12 && d.getMinutes() === 0) return null;
  return d.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
}

/** Monto en pesos chilenos: "$1.234.567". Null/inválido → "—". */
export function formatCLP(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return "—";
  const n = typeof value === "number" ? value : parseFloat(value);
  if (isNaN(n)) return "—";
  return `$${Math.round(n).toLocaleString("es-CL")}`;
}

/** true si la fecha ya pasó (comparando solo el día, no la hora). */
export function isOverdue(dateStr: string | null | undefined) {
  if (!dateStr) return false;
  const d = asCalendarDate(dateStr);
  if (!d) return false;
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  return target.getTime() < getTodayAtMidnight().getTime();
}

/**
 * Etiqueta corta para el próximo contacto agendado:
 * vencido → "Venció hace N días", hoy → "Hoy", futuro → "En N días".
 */
export function proximoContactoLabel(dateStr: string | null | undefined) {
  if (!dateStr) return null;
  const d = asCalendarDate(dateStr);
  if (!d) return null;
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  const diffDays = Math.round((target.getTime() - getTodayAtMidnight().getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < -1) return `Venció hace ${-diffDays} días`;
  if (diffDays === -1) return "Venció ayer";
  if (diffDays === 0) return "Hoy";
  if (diffDays === 1) return "Mañana";
  return `En ${diffDays} días`;
}

// Fix encoding issues from legacy Latin1 data (ñ → Ñ etc.)
export function fixEncoding(str: string | null | undefined): string {
  if (!str) return "—";
  try {
    return str
      .replace(/Ã'/g, 'Ñ')
      .replace(/Ã±/g, 'ñ')
      .replace(/Ã¡/g, 'á')
      .replace(/Ã©/g, 'é')
      .replace(/Ã­/g, 'í')
      .replace(/Ã³/g, 'ó')
      .replace(/Ãº/g, 'ú')
      .replace(/Ã¼/g, 'ü')
      .replace(/Ã\u0091/g, 'Ñ')
      .replace(/\u00c3\u0091/g, 'Ñ')
      .replace(/\u00c3\u00b1/g, 'ñ')
      .replace(/\u00c3\u00a1/g, 'á')
      .replace(/\u00c3\u00a9/g, 'é')
      .replace(/\u00c3\u00ad/g, 'í')
      .replace(/\u00c3\u00b3/g, 'ó')
      .replace(/\u00c3\u00ba/g, 'ú')
      .replace(/\ufffd/g, 'Ñ'); // Replacement char often means Ñ
  } catch {
    return str;
  }
}

/** Iniciales para avatares: "Comercial Los Ríos" → "CL". */
export function getInitials(name: string | null | undefined) {
  const clean = fixEncoding(name);
  if (!clean || clean === "—") return "?";
  const parts = clean.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}
