// Tramos de fechas del resumen consolidado del dashboard.
//
// Cuando se eligen varios períodos a la vez (cuatro meses, un puñado de días, dos años)
// el consolidado se calcula sobre la UNIÓN de esos tramos, no sobre un solo
// desde–hasta: la selección puede tener huecos (enero, marzo y abril) y un rango
// continuo metería febrero adentro.
//
// Acá viven las dos operaciones puras de ese cálculo, aparte de la ruta para poder
// probarlas solas.

export interface Tramo {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
}

/**
 * Funde los tramos que se tocan o se pisan y los deja ordenados.
 *
 * Hace falta porque el selector arma un período por cada combinación de año × mes: con
 * dos años y los doce meses llegan 24 tramos que en realidad son 2. Menos tramos es un
 * OR más corto en la consulta y una etiqueta más honesta en la tarjeta ("1–30 de abril"
 * solo se puede escribir si quedó un tramo).
 */
export function unirTramos(tramos: Tramo[]): Tramo[] {
  const ordenados = [...tramos].sort((a, b) => a.startDate.localeCompare(b.startDate));
  const unidos: Tramo[] = [];
  for (const tramo of ordenados) {
    const ultimo = unidos[unidos.length - 1];
    // `<=` y no `<`: dos meses seguidos no se pisan, se tocan, y queremos uno solo.
    if (ultimo && tramo.startDate <= diaSiguiente(ultimo.endDate)) {
      if (tramo.endDate > ultimo.endDate) ultimo.endDate = tramo.endDate;
    } else {
      unidos.push({ ...tramo });
    }
  }
  return unidos;
}

/**
 * El mismo tramo un año antes, para la comparación año contra año.
 *
 * Se parte el string en vez de usar `new Date('YYYY-MM-DD')`: ese constructor
 * interpreta UTC y en Chile (UTC-3) devuelve el día anterior. El 29 de febrero se corre
 * al 28 cuando el año de destino no es bisiesto.
 */
export function tramoAnioAnterior(tramo: Tramo): Tramo {
  return { startDate: unAnioAntes(tramo.startDate), endDate: unAnioAntes(tramo.endDate) };
}

function unAnioAntes(fecha: string): string {
  const [y, m, d] = fecha.split('-').map(Number);
  const anterior = new Date(y - 1, m - 1, d);
  // 29-feb de un año bisiesto hacia uno que no lo es: Date se pasa al 1-mar.
  if (m === 2 && d === 29 && anterior.getMonth() !== 1) {
    anterior.setMonth(1, 28);
  }
  return aTexto(anterior);
}

function diaSiguiente(fecha: string): string {
  const [y, m, d] = fecha.split('-').map(Number);
  const siguiente = new Date(y, m - 1, d + 1);
  return aTexto(siguiente);
}

function aTexto(f: Date): string {
  return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`;
}
