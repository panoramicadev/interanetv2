/**
 * Días de semana corrida de un período (Art. 45 del Código del Trabajo).
 * ---------------------------------------------------------------------
 * El trabajador con remuneración variable devengada día a día —la comisión
 * por venta lo es— cobra los domingos y festivos al promedio de lo que ganó
 * los días que sí trabajó:
 *
 *     semana corrida = comisión / días laborables × (domingos + festivos)
 *
 * OJO CON LOS FESTIVOS, que es donde se equivoca el cálculo a mano: un feriado
 * que cae sábado o domingo YA está fuera del divisor, así que restarlo de nuevo
 * lo descuenta dos veces. Pero sí suma al multiplicador, porque igual es un día
 * que se paga. Por eso van dos cuentas separadas.
 *
 * Verificado contra la liquidación de Finanzas de abril de 2026: 21 días
 * laborables y 6 domingos/festivos (4 domingos + Viernes y Sábado Santo). Con
 * las constantes fijas que había antes (22 y 5) el papel no cuadraba.
 *
 * Los feriados con traslado (29 de junio, 12 de octubre y 31 de octubre, Ley
 * 19.973) van en su fecha nominal: las reglas de corrimiento cambian según el
 * día de la semana en que caen. En junio y octubre conviene revisar el número
 * antes de firmar — las celdas del Excel quedan editables justamente por eso.
 */

/** Domingo de Pascua (algoritmo de Meeus/Butcher). */
function pascua(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, mes - 1, dia));
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Feriados legales de Chile de un año, como fechas ISO. */
export function feriadosChile(year: number): Set<string> {
  const p = pascua(year);
  const viernesSanto = new Date(p); viernesSanto.setUTCDate(p.getUTCDate() - 2);
  const sabadoSanto = new Date(p); sabadoSanto.setUTCDate(p.getUTCDate() - 1);
  const fijos = [
    "01-01", // Año Nuevo
    "05-01", // Día del Trabajo
    "05-21", // Glorias Navales
    "06-20", // Día Nacional de los Pueblos Indígenas
    "06-29", // San Pedro y San Pablo (trasladable)
    "07-16", // Virgen del Carmen
    "08-15", // Asunción de la Virgen
    "09-18", // Independencia Nacional
    "09-19", // Glorias del Ejército
    "10-12", // Encuentro de Dos Mundos (trasladable)
    "10-31", // Iglesias Evangélicas (trasladable)
    "11-01", // Día de Todos los Santos
    "12-08", // Inmaculada Concepción
    "12-25", // Navidad
  ];
  return new Set([...fijos.map((f) => `${year}-${f}`), iso(viernesSanto), iso(sabadoSanto)]);
}

export interface DiasSemanaCorrida {
  dias: number;
  domingos: number;
  sabados: number;
  /** Festivos que caen de lunes a viernes: solo estos salen del divisor. */
  festivosHabiles: number;
  /** Todos los festivos del período: estos suman al multiplicador. */
  festivosTotales: number;
  /** Divisor: días en que el trabajador legalmente debió laborar. */
  diasLaborables: number;
  /** Multiplicador: domingos + festivos. */
  domingosYFestivos: number;
}

/**
 * @param sabadoLaboral true si la jornada del vendedor incluye el sábado
 *        (entonces el sábado entra al divisor y no es día de semana corrida).
 */
export function diasSemanaCorrida(
  startDate: string,
  endDate: string,
  sabadoLaboral = false,
): DiasSemanaCorrida {
  const feriados = new Set<string>();
  const y0 = Number(startDate.slice(0, 4));
  const y1 = Number(endDate.slice(0, 4));
  for (let y = y0; y <= y1; y++) feriadosChile(y).forEach((f) => feriados.add(f));

  let dias = 0, domingos = 0, sabados = 0, festivosHabiles = 0, festivosTotales = 0;
  const d = new Date(startDate + "T00:00:00Z");
  const fin = new Date(endDate + "T00:00:00Z");
  while (d <= fin) {
    const dow = d.getUTCDay();
    const esFeriado = feriados.has(iso(d));
    dias++;
    if (dow === 0) domingos++;
    else if (dow === 6 && !sabadoLaboral) sabados++;
    if (esFeriado) {
      festivosTotales++;
      // Solo descuenta del divisor si ese día se habría trabajado.
      const seTrabajaba = dow !== 0 && (dow !== 6 || sabadoLaboral);
      if (seTrabajaba) festivosHabiles++;
    }
    d.setUTCDate(d.getUTCDate() + 1);
  }

  return {
    dias, domingos, sabados, festivosHabiles, festivosTotales,
    diasLaborables: Math.max(1, dias - domingos - sabados - festivosHabiles),
    domingosYFestivos: domingos + festivosTotales,
  };
}
