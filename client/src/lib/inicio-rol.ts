/**
 * Pantalla de inicio de cada rol, para mostrar ahí la franja de mensajes.
 *
 * Replica el switch de `<Route path="/">` en client/src/App.tsx: si cambia el
 * aterrizaje de un rol allá, hay que reflejarlo acá.
 *
 * Los roles que aterrizan en el Dashboard no se resuelven en el shell: el
 * Dashboard dibuja la franja él mismo, debajo de su barra del logo en celular
 * (si la pusiera el shell arriba, empujaría esa barra y el botón del menú, que
 * va fijo, quedaría desalineado).
 */
const INICIO_FUERA_DE_RAIZ: Record<string, string> = {
  marketing: "/marketing/hoy",
  recursos_humanos: "/comisiones",
};

const ROLES_SIN_DASHBOARD = new Set([
  "tecnico_obra",
  "reception",
  "jefe_planta",
  "mantencion",
  "recursos_humanos",
  "marketing",
  "planificacion",
  "produccion",
  "bodega_materias_primas",
  "prevencion_riesgos",
  "laboratorio",
  "area_produccion",
  "area_logistica",
  "area_aplicacion",
  "area_materia_prima",
  "area_colores",
  "area_envase",
  "area_etiqueta",
]);

/** ¿El shell tiene que dibujar la franja en esta ruta para este rol? */
export function shellMuestraFranja(role: string | undefined, location: string): boolean {
  if (!role || !ROLES_SIN_DASHBOARD.has(role)) return false;
  return location === (INICIO_FUERA_DE_RAIZ[role] ?? "/");
}
