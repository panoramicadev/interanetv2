/**
 * CMMS Permissions Helper
 * Funciones para verificar permisos de usuario en módulos CMMS
 */

export type UserRole = 
  | 'admin' 
  | 'jefe_planta' 
  | 'mantencion' 
  | 'supervisor' 
  | 'laboratorio' 
  | 'bodega_materias_primas' 
  | 'logistica_bodega' 
  | 'produccion' 
  | 'planificacion'
  | string;

/**
 * Acceso total a TODOS los módulos CMMS (crear, editar, eliminar)
 * Solo admin y jefe_planta
 */
export const canAccessCMMSFull = (role?: string | null): boolean => {
  if (!role) return false;
  return ['admin', 'jefe_planta'].includes(role);
};

/**
 * Puede resolver órdenes de trabajo
 * admin, jefe_planta, mantencion
 */
export const canResolveCMMS = (role?: string | null): boolean => {
  if (!role) return false;
  return ['admin', 'jefe_planta', 'mantencion'].includes(role);
};

/**
 * Puede ver módulos CMMS (solo lectura para personal de planta)
 * Todos los roles relacionados con CMMS
 */
export const canViewCMMS = (role?: string | null): boolean => {
  if (!role) return false;
  return [
    'admin',
    'jefe_planta',
    'mantencion',
    'supervisor',
    'laboratorio',
    'bodega_materias_primas',
    'logistica_bodega',
    'produccion',
    'planificacion',
  ].includes(role);
};

/**
 * Puede ver el Dashboard CMMS con métricas y estadísticas
 * Roles con gestión: admin, jefe_planta, mantencion, supervisor, logistica_bodega
 * Roles limitados (laboratorio, produccion, planificacion, bodega_materias_primas) solo pueden crear OT y ver calendario
 */
export const canViewCMMSDashboard = (role?: string | null): boolean => {
  if (!role) return false;
  return ['admin', 'jefe_planta', 'mantencion', 'supervisor', 'logistica_bodega'].includes(role);
};

/**
 * Puede crear órdenes de trabajo
 * Todos los usuarios con acceso a CMMS pueden crear OTs
 */
export const canCreateOT = (role?: string | null): boolean => {
  return canViewCMMS(role);
};

/**
 * Puede eliminar registros (equipos, OTs, proveedores, etc.)
 * Solo admin y jefe_planta
 */
export const canDeleteCMMS = (role?: string | null): boolean => {
  return canAccessCMMSFull(role);
};

/**
 * Puede editar equipos, proveedores, presupuestos
 * Solo admin y jefe_planta
 */
export const canEditCMMS = (role?: string | null): boolean => {
  return canAccessCMMSFull(role);
};

/**
 * Puede acceder a módulos de gestión (equipos, proveedores, presupuesto, gastos materiales)
 * Solo admin y jefe_planta
 */
export const canAccessManagementModules = (role?: string | null): boolean => {
  if (!role) return false;
  return ['admin', 'jefe_planta'].includes(role);
};

/**
 * Puede acceder a Mantenciones Planificadas
 * admin, jefe_planta, mantencion
 */
export const canAccessMantencionesPlanificadas = (role?: string | null): boolean => {
  if (!role) return false;
  return ['admin', 'jefe_planta', 'mantencion'].includes(role);
};

/**
 * Puede acceder a Planes Preventivos
 * admin, jefe_planta, mantencion
 */
export const canAccessPlanesPreventivos = (role?: string | null): boolean => {
  if (!role) return false;
  return ['admin', 'jefe_planta', 'mantencion'].includes(role);
};

/**
 * Puede acceder a Gastos de Materiales
 * Solo admin y jefe_planta
 */
export const canAccessGastosMateriales = (role?: string | null): boolean => {
  return canAccessCMMSFull(role);
};

/**
 * Puede exportar datos a Excel
 * Todos los usuarios con acceso a CMMS
 */
export const canExportCMMS = (role?: string | null): boolean => {
  return canViewCMMS(role);
};

/**
 * Puede ver calendario CMMS
 * Todos los usuarios con acceso a CMMS
 */
export const canViewCalendar = (role?: string | null): boolean => {
  return canViewCMMS(role);
};
