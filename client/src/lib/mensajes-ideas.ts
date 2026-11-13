/**
 * Ideas de mensajes para la franja neón (Configuración → Mensajes).
 *
 * Son puntos de partida: quien escribe toca una, la ajusta y publica. Van
 * según a quién se le escribe, y cada una trae el color de neón que mejor le
 * calza (urgente → naranjo/amarillo, felicitación → verde, novedad → cian).
 * El mes se arma con la fecha de hoy para que "cierre de mes" no quede viejo.
 */

export interface IdeaMensaje {
  titulo: string;
  texto: string;
  color: "naranjo" | "cian" | "verde" | "rosa" | "amarillo";
}

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

const ROLES_PLANTA = new Set([
  "jefe_planta", "mantencion", "laboratorio", "produccion", "planificacion",
  "bodega_materias_primas", "prevencion_riesgos",
  "area_produccion", "area_aplicacion", "area_materia_prima", "area_colores",
  "area_envase", "area_etiqueta",
]);
const ROLES_LOGISTICA = new Set(["logistica_bodega", "area_logistica"]);
const ROLES_COMERCIALES = new Set(["salesperson", "supervisor", "encargado_area", "tecnico_obra", "reception"]);

export function ideasPara(audiencia: string, hoy = new Date()): IdeaMensaje[] {
  const mes = MESES[hoy.getMonth()];
  const mesAnterior = MESES[(hoy.getMonth() + 11) % 12];

  const generales: IdeaMensaje[] = [
    { titulo: "Bienvenida", texto: `¡Bienvenidos a ${mes}! Vamos con todo este mes, equipo Panorámica 🧡`, color: "naranjo" },
    { titulo: "Reconocimiento", texto: "¡Gracias a todo el equipo por el esfuerzo de esta semana! Cada tarea suma 🙌", color: "verde" },
    { titulo: "Aviso importante", texto: "📢 Importante: revisa tu correo, hay información nueva para todo el equipo", color: "amarillo" },
    { titulo: "Feriado", texto: "🗓️ Recuerden: el próximo feriado no hay atención. Planifiquen sus pendientes con tiempo", color: "cian" },
  ];

  if (audiencia === "todos") return generales;

  if (ROLES_COMERCIALES.has(audiencia)) {
    return [
      { titulo: "Cierre de mes", texto: `⏰ ¡Se viene el cierre de ${mes}! Ingresen sus notas de venta antes del último día hábil a las 13:00`, color: "naranjo" },
      { titulo: "Meta del mes", texto: `🎯 Vamos por la meta de ${mes}: cada visita y cada cotización cuenta. ¡A cerrar fuerte!`, color: "amarillo" },
      { titulo: "Felicitaciones", texto: `🏆 ¡Felicitaciones al equipo por los resultados de ${mesAnterior}! Sigamos así`, color: "verde" },
      { titulo: "Lista de precios", texto: "💲 Nueva lista de precios vigente desde el lunes. Revísenla antes de cotizar", color: "cian" },
      { titulo: "Seguimiento", texto: "📋 Actualicen el seguimiento de sus clientes en el Panel de Trabajo antes del viernes", color: "naranjo" },
      { titulo: "Cobranza", texto: "💳 Revisen los documentos vencidos de su cartera y contacten a sus clientes esta semana", color: "rosa" },
    ];
  }

  if (ROLES_PLANTA.has(audiencia)) {
    return [
      { titulo: "Seguridad", texto: "🦺 La seguridad es primero: uso obligatorio de elementos de protección en toda la planta", color: "amarillo" },
      { titulo: "Orden y aseo", texto: "🧹 Un puesto ordenado es un puesto seguro. Dejemos limpio al terminar cada turno", color: "verde" },
      { titulo: "Producción", texto: `🏭 Vamos con todo con la producción de ${mes}. ¡Cada lote bien hecho suma!`, color: "naranjo" },
      { titulo: "Reclamos", texto: "🔎 Revisen los reclamos pendientes de su área y respondan antes del viernes", color: "cian" },
      { titulo: "Mantención", texto: "🔧 Reporten cualquier falla de equipos apenas la detecten. Prevenir es más barato que reparar", color: "rosa" },
    ];
  }

  if (ROLES_LOGISTICA.has(audiencia)) {
    return [
      { titulo: "Despachos", texto: "🚚 Recuerden confirmar cada despacho en el sistema apenas salga el camión", color: "naranjo" },
      { titulo: "Inventario", texto: "📦 Este viernes hay conteo de inventario. Mantengamos la bodega ordenada", color: "amarillo" },
      { titulo: "Seguridad", texto: "🦺 Uso obligatorio de casco y zapatos de seguridad en bodega y patio de carga", color: "verde" },
      { titulo: "Cierre de mes", texto: `⏰ Cierre de ${mes}: todas las guías deben quedar ingresadas antes del último día hábil`, color: "cian" },
    ];
  }

  if (audiencia === "marketing") {
    return [
      { titulo: "Campañas", texto: `📣 Revisemos el calendario de campañas de ${mes} y cerremos las piezas pendientes`, color: "rosa" },
      { titulo: "Solicitudes", texto: "🗂️ Hay solicitudes nuevas del equipo comercial esperando respuesta. ¡Vamos!", color: "naranjo" },
      ...generales.slice(0, 2),
    ];
  }

  if (audiencia === "recursos_humanos") {
    return [
      { titulo: "Remuneraciones", texto: `💼 Recordatorio: el cierre de remuneraciones de ${mes} es esta semana`, color: "naranjo" },
      { titulo: "Comisiones", texto: `📊 Revisemos las comisiones de ${mesAnterior} antes de enviarlas a pago`, color: "cian" },
      ...generales.slice(0, 2),
    ];
  }

  return generales;
}
