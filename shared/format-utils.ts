/**
 * PRODUCT FORMAT UTILITIES — Single Source of Truth
 * 
 * This module centralizes all product format/unit normalization logic.
 * All components across the system should reference this module instead of 
 * maintaining their own format mapping tables or regex patterns.
 */

// ================================
// CANONICAL FORMAT DEFINITIONS
// ================================

export interface FormatDefinition {
  /** Human-readable label for UI display */
  label: string;
  /** Key used in eCommerce shipping rates config */
  shippingKey: string;
  /** Emoji icon for UI */
  icon: string;
  /** Sort order for display (lower = first) */
  sortOrder: number;
  /** Minimum quantity per order */
  minQuantity: number;
  /** Quantity step (must order in multiples of this) */
  stepQuantity: number;
  /** Display name for quantity rules */
  quantityDisplayName: string;
}

/**
 * The 5 canonical product formats used across the entire system.
 * Keys are the exact values stored in `price_list.unidad` in the database.
 */
export const PRODUCT_FORMATS: Record<string, FormatDefinition> = {
  '1/4 Galon': {
    label: '1/4 Galón',
    shippingKey: '1_4_galon',
    icon: '🫙',
    sortOrder: 1,
    minQuantity: 6,
    stepQuantity: 6,
    quantityDisplayName: '1/4 Galón',
  },
  'Galon': {
    label: 'Galón',
    shippingKey: 'galon',
    icon: '🪣',
    sortOrder: 2,
    minQuantity: 4,
    stepQuantity: 4,
    quantityDisplayName: 'Galón',
  },
  'Balde 4 Galones': {
    label: 'Balde 4 GL',
    shippingKey: 'bd_4gl',
    icon: '🪣',
    sortOrder: 3,
    minQuantity: 1,
    stepQuantity: 1,
    quantityDisplayName: 'Balde 4 GL',
  },
  'Balde 5 Galones': {
    label: 'Balde 5 GL',
    shippingKey: 'bd_5gl',
    icon: '🪣',
    sortOrder: 4,
    minQuantity: 1,
    stepQuantity: 1,
    quantityDisplayName: 'Balde 5 GL',
  },
  'Unidad': {
    label: 'Unidad',
    shippingKey: 'unidad',
    icon: '📦',
    sortOrder: 5,
    minQuantity: 1,
    stepQuantity: 1,
    quantityDisplayName: 'Unidad',
  },
} as const;

// ================================
// NORMALIZATION ALIASES
// ================================

/**
 * Maps every known variation/alias to its canonical format key.
 * This is used by `normalizeFormat()` for exact (case-insensitive) matching.
 */
const FORMAT_ALIASES: Record<string, string> = {
  // 1/4 Galón variations
  '1/4 galon': '1/4 Galon',
  '1/4 galón': '1/4 Galon',
  '1/4 de galon': '1/4 Galon',
  '1/4 de galón': '1/4 Galon',
  '1/4 de galones': '1/4 Galon',
  '1/4galon': '1/4 Galon',
  '1/4galón': '1/4 Galon',
  'cuarto galon': '1/4 Galon',
  'cuarto galón': '1/4 Galon',
  'cuarto de galon': '1/4 Galon',
  'cuarto de galón': '1/4 Galon',
  'cuarto': '1/4 Galon',
  '14': '1/4 Galon',
  '1/4': '1/4 Galon',

  // Galón variations
  'galon': 'Galon',
  'galón': 'Galon',
  'galones': 'Galon',
  'gl': 'Galon',

  // Balde 4 Galones variations
  'balde 4 galones': 'Balde 4 Galones',
  'balde 4 gl': 'Balde 4 Galones',
  'balde 4gl': 'Balde 4 Galones',
  'balde4': 'Balde 4 Galones',
  'bd 4 gl': 'Balde 4 Galones',
  'bd 4gl': 'Balde 4 Galones',
  'bd4': 'Balde 4 Galones',
  'bd4gl': 'Balde 4 Galones',
  'bd-4': 'Balde 4 Galones',
  'bd-4gl': 'Balde 4 Galones',
  'balde4gl': 'Balde 4 Galones',
  'balde4galones': 'Balde 4 Galones',
  'balde 4': 'Balde 4 Galones',

  // Balde 5 Galones variations
  'balde 5 galones': 'Balde 5 Galones',
  'balde 5 gl': 'Balde 5 Galones',
  'balde 5gl': 'Balde 5 Galones',
  'balde5': 'Balde 5 Galones',
  'bd 5 gl': 'Balde 5 Galones',
  'bd 5gl': 'Balde 5 Galones',
  'bd5': 'Balde 5 Galones',
  'bd5gl': 'Balde 5 Galones',
  'bd-5': 'Balde 5 Galones',
  'bd-5gl': 'Balde 5 Galones',
  'balde5gl': 'Balde 5 Galones',
  'balde5galones': 'Balde 5 Galones',
  'balde 5': 'Balde 5 Galones',

  // Tonel — término del vendedor para los baldes de 4 / 5 galones
  'tonel 4': 'Balde 4 Galones',
  'tonel 4 gl': 'Balde 4 Galones',
  'tonel 4 galones': 'Balde 4 Galones',
  'tonel de 4 galones': 'Balde 4 Galones',
  'tonel 5': 'Balde 5 Galones',
  'tonel 5 gl': 'Balde 5 Galones',
  'tonel 5 galones': 'Balde 5 Galones',
  'tonel de 5 galones': 'Balde 5 Galones',

  // Unidad variations
  'unidad': 'Unidad',
  'un': 'Unidad',
  'und': 'Unidad',
  'u': 'Unidad',
};

// ================================
// NORMALIZATION FUNCTIONS
// ================================

/**
 * Normalizes any product format/unit string to its canonical form.
 * Returns the canonical format key (e.g., "Galon") or null if unrecognized.
 * 
 * @example
 * normalizeFormat("GL")           // "Galon"
 * normalizeFormat("1/4 de galón") // "1/4 Galon"
 * normalizeFormat("BD4")          // "Balde 4 Galones"
 * normalizeFormat("GALON")        // "Galon"
 * normalizeFormat(null)           // null
 */
export function normalizeFormat(raw: string | null | undefined): string | null {
  if (!raw || !raw.trim()) return null;

  const cleaned = raw.trim();

  // Check if already a canonical value (case-sensitive)
  if (PRODUCT_FORMATS[cleaned]) return cleaned;

  // Try exact match from aliases (case-insensitive)
  const normalized = cleaned.toLowerCase().replace(/\s+/g, ' ');
  if (FORMAT_ALIASES[normalized]) return FORMAT_ALIASES[normalized];

  // Regex-based fallback for edge cases not covered by aliases
  const upper = cleaned.toUpperCase().replace(/\s+/g, ' ');

  // 1/4 Galón patterns — check BEFORE Galón to avoid false match
  if (/1\s*[\/\-]\s*4|CUARTO/i.test(upper)) return '1/4 Galon';

  // Balde / Tonel patterns — check BEFORE Galón to avoid false match on "4 GALONES"
  if (/BD\s*[-_\s]*4|BALDE\s*[-_\s]*4|TONEL\s*(?:DE\s*)?4/i.test(upper)) return 'Balde 4 Galones';
  if (/BD\s*[-_\s]*5|BALDE\s*[-_\s]*5|TONEL\s*(?:DE\s*)?5/i.test(upper)) return 'Balde 5 Galones';

  // Galón patterns (only if not matched as 1/4, Balde or Tonel above)
  if (/\bGL\b|\bGAL[ÓO]N(?:ES)?\b/i.test(upper) && !/BD|BALDE|TONEL|1\s*\/\s*4|CUARTO/i.test(upper)) {
    return 'Galon';
  }

  // Unidad patterns
  if (/^\s*(?:UN|UND?|UNIDAD)\s*$/i.test(upper)) return 'Unidad';

  // Unknown format — return as-is (don't lose data)
  return cleaned;
}

/**
 * Gets the shipping rate key for the given format.
 * Returns null if the format doesn't have a shipping rate.
 *
 * @example
 * getShippingKey("Galon")             // "galon"
 * getShippingKey("GL")                // "galon" (normalizes first)
 * getShippingKey("Balde 4 Galones")   // "bd_4gl"
 */
export function getShippingKey(format: string | null | undefined): string | null {
  if (!format) return null;
  const canonical = normalizeFormat(format);
  if (!canonical) return null;
  return PRODUCT_FORMATS[canonical]?.shippingKey ?? null;
}

/**
 * Gets the human-readable label for a format.
 *
 * @example
 * getFormatLabel("Galon")           // "Galón"
 * getFormatLabel("1/4 Galon")       // "1/4 Galón"
 * getFormatLabel("GL")              // "Galón" (normalizes first)
 */
export function getFormatLabel(format: string | null | undefined): string {
  if (!format) return 'N/A';
  const canonical = normalizeFormat(format);
  if (!canonical) return format;
  return PRODUCT_FORMATS[canonical]?.label ?? format;
}

/**
 * Gets the icon for a format.
 */
export function getFormatIcon(format: string | null | undefined): string {
  if (!format) return '📦';
  const canonical = normalizeFormat(format);
  if (!canonical) return '📦';
  return PRODUCT_FORMATS[canonical]?.icon ?? '📦';
}

/**
 * Gets quantity rules for a given format/unit.
 * Used by cart validation and store quantity controls.
 */
export function getFormatQuantityRules(format: string | null | undefined): {
  minQuantity: number;
  stepQuantity: number;
  displayName: string;
} {
  if (!format) return { minQuantity: 1, stepQuantity: 1, displayName: 'Unidad' };
  const canonical = normalizeFormat(format);
  if (!canonical || !PRODUCT_FORMATS[canonical]) {
    return { minQuantity: 1, stepQuantity: 1, displayName: format };
  }
  const def = PRODUCT_FORMATS[canonical];
  return {
    minQuantity: def.minQuantity,
    stepQuantity: def.stepQuantity,
    displayName: def.quantityDisplayName,
  };
}

/**
 * Returns the list of canonical format keys, sorted by sortOrder.
 */
export function getCanonicalFormats(): string[] {
  return Object.entries(PRODUCT_FORMATS)
    .sort(([, a], [, b]) => a.sortOrder - b.sortOrder)
    .map(([key]) => key);
}

/**
 * Returns format options suitable for dropdown/select components.
 */
export function getFormatOptions(): Array<{ value: string; label: string; icon: string }> {
  return Object.entries(PRODUCT_FORMATS)
    .sort(([, a], [, b]) => a.sortOrder - b.sortOrder)
    .map(([key, def]) => ({
      value: key,
      label: def.label,
      icon: def.icon,
    }));
}
