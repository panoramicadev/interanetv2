/**
 * Shared taxonomy for Reclamos Generales areas
 * Used by both backend filtering and frontend display
 */

// Canonical area values for areaResponsableActual and areaAsignadaInicial
export const RECLAMOS_AREAS = {
  PRODUCCION: 'produccion',
  LABORATORIO: 'laboratorio',
  LOGISTICA: 'logistica',
  APLICACION: 'aplicacion',
  ENVASE: 'envase',
  ETIQUETA: 'etiqueta',
  MATERIA_PRIMA: 'materia_prima',
  COLORES: 'colores',
} as const;

export type ReclamoArea = typeof RECLAMOS_AREAS[keyof typeof RECLAMOS_AREAS];

// All valid area values as array for schema enums
export const RECLAMOS_AREAS_VALUES: ReclamoArea[] = Object.values(RECLAMOS_AREAS);

/**
 * Maps specific complaint areas to their operational areas
 * This allows technical areas (envase, etiqueta, colores) to be handled by operational teams
 * 
 * Example: A complaint about "Envase" is handled by the "Logística" team
 */
export const AREA_ESPECIFICA_TO_OPERATIVA: Partial<Record<ReclamoArea, ReclamoArea>> = {
  [RECLAMOS_AREAS.ENVASE]: RECLAMOS_AREAS.LOGISTICA,      // Envase → Logística (bodega de envases)
  [RECLAMOS_AREAS.ETIQUETA]: RECLAMOS_AREAS.PRODUCCION,   // Etiqueta → Producción (etiquetado en línea)
  [RECLAMOS_AREAS.COLORES]: RECLAMOS_AREAS.PRODUCCION,    // Colores → Producción (mezcla y aplicación)
};

// Role to area mapping - converts user roles to their responsible area(s)
// NOTE: Roles for specific areas (area_envase, area_etiqueta, area_colores) map to operative areas
export const ROLE_TO_AREA_MAP: Record<string, ReclamoArea> = {
  // Area roles (with area_ prefix) - specific areas map to operative areas
  'area_produccion': RECLAMOS_AREAS.PRODUCCION,
  'area_logistica': RECLAMOS_AREAS.LOGISTICA,
  'area_aplicacion': RECLAMOS_AREAS.APLICACION,
  'area_materia_prima': RECLAMOS_AREAS.MATERIA_PRIMA,
  'area_colores': RECLAMOS_AREAS.PRODUCCION,      // Colores handled by Producción
  'area_envase': RECLAMOS_AREAS.LOGISTICA,        // Envase handled by Logística
  'area_etiqueta': RECLAMOS_AREAS.PRODUCCION,     // Etiqueta handled by Producción
  
  // Organizational roles (without area_ prefix)
  'produccion': RECLAMOS_AREAS.PRODUCCION,
  'logistica_bodega': RECLAMOS_AREAS.LOGISTICA,
  'planificacion': RECLAMOS_AREAS.PRODUCCION,
  'bodega_materias_primas': RECLAMOS_AREAS.LOGISTICA,
  'prevencion_riesgos': RECLAMOS_AREAS.PRODUCCION,
  
  // Management roles
  'jefe_planta': RECLAMOS_AREAS.PRODUCCION,
  
  // Special roles
  'laboratorio': RECLAMOS_AREAS.LABORATORIO,
};

/**
 * Get the responsible area for a user role
 * Returns null if role doesn't map to an area
 */
export function getRoleArea(userRole: string | undefined | null): ReclamoArea | null {
  if (!userRole) return null;
  
  // First, check if it's an area_ role and extract the suffix automatically
  if (userRole.startsWith('area_')) {
    const areaSuffix = userRole.replace('area_', '');
    // Validate that the extracted suffix is a valid area
    if (RECLAMOS_AREAS_VALUES.includes(areaSuffix as ReclamoArea)) {
      return areaSuffix as ReclamoArea;
    }
  }
  
  // Otherwise, use the explicit mapping for organizational roles
  return ROLE_TO_AREA_MAP[userRole] || null;
}

/**
 * Check if a user role has area responsibilities
 */
export function isAreaRole(userRole: string | undefined | null): boolean {
  if (!userRole) return false;
  return userRole in ROLE_TO_AREA_MAP;
}

/**
 * Get normalized area name from a string (handles variations)
 */
export function normalizeAreaName(area: string | undefined | null): ReclamoArea | null {
  if (!area) return null;
  
  // Direct match
  const directMatch = RECLAMOS_AREAS_VALUES.find(a => a === area);
  if (directMatch) return directMatch;
  
  // Handle colores_variacion -> colores
  if (area === 'colores_variacion') return RECLAMOS_AREAS.COLORES;
  
  return null;
}

/**
 * Map a specific area to its operative area
 * Returns the operative area if there's a mapping, otherwise returns the original area
 * 
 * Example: mapToOperativeArea('envase') returns 'logistica'
 */
export function mapToOperativeArea(area: ReclamoArea | string | null | undefined): ReclamoArea | null {
  if (!area) return null;
  
  const normalized = normalizeAreaName(area);
  if (!normalized) return null;
  
  // Check if this specific area maps to an operative area
  return AREA_ESPECIFICA_TO_OPERATIVA[normalized] || normalized;
}

// Display labels for areas (Spanish)
export const AREA_LABELS: Record<ReclamoArea, string> = {
  [RECLAMOS_AREAS.PRODUCCION]: 'Producción',
  [RECLAMOS_AREAS.LABORATORIO]: 'Laboratorio',
  [RECLAMOS_AREAS.LOGISTICA]: 'Logística',
  [RECLAMOS_AREAS.APLICACION]: 'Aplicación/Cliente',
  [RECLAMOS_AREAS.ENVASE]: 'Envase',
  [RECLAMOS_AREAS.ETIQUETA]: 'Etiqueta',
  [RECLAMOS_AREAS.MATERIA_PRIMA]: 'Materia Prima',
  [RECLAMOS_AREAS.COLORES]: 'Colores',
};

/**
 * Get display label for an area
 */
export function getAreaLabel(area: ReclamoArea | string | null | undefined): string {
  if (!area) return 'Sin asignar';
  const normalized = normalizeAreaName(area);
  if (!normalized) return area;
  return AREA_LABELS[normalized] || area;
}

/**
 * Check if a user role can view ALL reclamos from ALL areas
 * Used for management and administrative oversight
 */
export function canViewAllReclamos(userRole: string | undefined | null): boolean {
  if (!userRole) return false;
  return ['admin', 'supervisor', 'jefe_planta'].includes(userRole);
}
