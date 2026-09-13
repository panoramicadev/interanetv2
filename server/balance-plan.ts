/**
 * Balance — leer y normalizar lo que manda Softland
 * ---------------------------------------------------------------
 * Aparte de las rutas a propósito: acá no se toca la base ni Express, sólo se
 * convierte un archivo del ERP en filas limpias. Así se puede probar el trozo
 * que de verdad tiene reglas —la normalización del código de cuenta— sin
 * levantar el servidor.
 */
import * as XLSX from 'xlsx';

// ─── Normalización del plan de cuentas ──────────────────────────────────────

/** Sin tildes, sin dobles espacios, en mayúsculas y sin bordes. */
export function limpiarTexto(v: unknown): string {
  return String(v ?? '').replace(/\s+/g, ' ').trim();
}

/**
 * El código de cuenta como debería ser: gran cuenta + mayor a tres dígitos +
 * sufijo a tres dígitos.
 *
 * Hay que reconstruirlo, no leerlo. Dos cosas lo rompen, y las dos borran ceros
 * a la izquierda:
 *
 *  - Softland entrega `CMAYOR = "20"` para GASTOS DE OPERACION en vez de `"020"`,
 *    y en el `CUENTA` deja el hueco como un espacio: `"5120 106"` cuando la
 *    cuenta real es `51020106`. Son 20 de las 77 cuentas del plan, todo el mayor
 *    de operación —incluida REMUNERACIONES DE OPERACI, que es una de las del
 *    cruce con Talana—.
 *  - La hoja de cálculo lee las columnas como números, así que el `"010"` de los
 *    demás mayores llega como `10`.
 *
 * Por eso el mayor se rellena a tres siempre, venga como venga, y el sufijo se
 * toma de los últimos tres caracteres del código en vez de intentar descontarle
 * el prefijo: el prefijo es justamente lo que llega mal escrito.
 */
export function normalizarCodigo(granCuenta: unknown, mayorCrudo: unknown, cuentaCruda: unknown): string {
  const gran = limpiarTexto(granCuenta).replace(/\s/g, '');
  const mayor = limpiarTexto(mayorCrudo).replace(/\s/g, '').padStart(3, '0');
  const limpio = String(cuentaCruda ?? '').replace(/\s/g, '');
  const sufijo = limpio.slice(-3).padStart(3, '0');
  return `${gran}${mayor}${sufijo}`;
}

/** 41 suma, 51 y 52 restan. Es lo único que define el signo en el resultado. */
export function naturalezaDe(granCuenta: string): 'ingreso' | 'egreso' {
  return limpiarTexto(granCuenta).startsWith('4') ? 'ingreso' : 'egreso';
}

/**
 * Número desde una celda que puede venir como `"$1.234.567"`, `"1.234.567,89"`,
 * `"(1.234)"` (negativo contable) o ya como number.
 */
export function aNumero(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  let s = String(v ?? '').trim();
  if (!s) return 0;
  const negativoEntreParentesis = /^\(.*\)$/.test(s);
  s = s.replace(/[()$\s]/g, '');
  // Formato chileno: el punto es miles y la coma es decimal.
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (/\.\d{3}(\D|$)/.test(s)) s = s.replace(/\./g, '');
  const n = Number(s);
  if (!Number.isFinite(n)) return 0;
  return negativoEntreParentesis ? -Math.abs(n) : n;
}

/**
 * Cuánto pesa una cuenta en el resultado del mes, siempre en positivo cuando el
 * concepto ocurrió de forma normal.
 *
 * Con debe y haber la cuenta es inequívoca. Con sólo el saldo hay que asumir el
 * signo contable —el haber va negativo, así que un ingreso llega en negativo— y
 * eso **está pendiente de confirmar contra un export real de Softland**: es una
 * de las preguntas abiertas al cliente. Se resuelve en un solo lugar a propósito.
 */
export function montoDeFila(naturaleza: string, debe: number, haber: number, saldo: number): number {
  if (debe !== 0 || haber !== 0) {
    return naturaleza === 'ingreso' ? haber - debe : debe - haber;
  }
  return naturaleza === 'ingreso' ? -saldo : saldo;
}

/** Busca en un objeto de fila la primera columna cuyo encabezado calce. */
function columna(fila: Record<string, unknown>, ...candidatas: string[]): unknown {
  const normal = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const buscadas = candidatas.map(normal);
  for (const [clave, valor] of Object.entries(fila)) {
    if (buscadas.includes(normal(clave))) return valor;
  }
  return undefined;
}

/** Lee la primera hoja de un .xlsx o .csv como objetos por encabezado. */
function leerHoja(buffer: Buffer): Record<string, unknown>[] {
  const libro = XLSX.read(buffer, { type: 'buffer' });
  const hoja = libro.Sheets[libro.SheetNames[0]];
  if (!hoja) return [];
  return XLSX.utils.sheet_to_json(hoja, { defval: '' }) as Record<string, unknown>[];
}

// ─── Importadores ───────────────────────────────────────────────────────────

type FilaCuenta = {
  codigo: string; codigoErp: string;
  granCuenta: string; granCuentaNombre: string;
  mayor: string; mayorNombre: string;
  nombre: string; naturaleza: 'ingreso' | 'egreso';
};

type ErrorFila = { fila: number; motivo: string; detalle?: string };

/**
 * Lee el plan de cuentas de Softland (CGRANCUE, NOGRANCUE, CMAYOR, NOMAYOR,
 * CUENTA, NOCUENTA) y devuelve lo que se guardaría, sin guardar nada.
 *
 * `rowNumber = i + 2` como el resto de los importadores del repo: la fila 1 es
 * el encabezado, así que el número que se muestra es el que ve el usuario en
 * Excel.
 */
export function parsearPlanDeCuentas(buffer: Buffer) {
  const filas = leerHoja(buffer);
  const cuentas: FilaCuenta[] = [];
  const errores: ErrorFila[] = [];
  const vistos = new Map<string, number>();

  filas.forEach((f, i) => {
    const numeroFila = i + 2;
    const granCuenta = limpiarTexto(columna(f, 'CGRANCUE', 'gran cuenta', 'grupo'));
    const cuentaCruda = String(columna(f, 'CUENTA', 'codigo', 'código') ?? '').trim();
    const mayorCrudo = limpiarTexto(columna(f, 'CMAYOR', 'mayor'));
    if (!granCuenta && !cuentaCruda) return; // fila en blanco al final de la hoja
    if (!granCuenta || !cuentaCruda) {
      errores.push({ fila: numeroFila, motivo: 'Falta la gran cuenta o el código', detalle: cuentaCruda || granCuenta });
      return;
    }
    const codigo = normalizarCodigo(granCuenta, mayorCrudo, cuentaCruda);
    const anterior = vistos.get(codigo);
    if (anterior) {
      errores.push({ fila: numeroFila, motivo: `Código repetido, ya venía en la fila ${anterior}`, detalle: codigo });
      return;
    }
    vistos.set(codigo, numeroFila);
    cuentas.push({
      codigo,
      codigoErp: cuentaCruda,
      granCuenta,
      granCuentaNombre: limpiarTexto(columna(f, 'NOGRANCUE', 'nombre gran cuenta')) || granCuenta,
      mayor: mayorCrudo.padStart(3, '0'),
      mayorNombre: limpiarTexto(columna(f, 'NOMAYOR', 'nombre mayor')) || mayorCrudo,
      nombre: limpiarTexto(columna(f, 'NOCUENTA', 'nombre', 'descripcion', 'descripción')) || codigo,
      naturaleza: naturalezaDe(granCuenta),
    });
  });

  // Nombres repetidos con códigos distintos: "INDEMNIZACIONES VENTAS" está dos
  // veces (51030429 y 51030431). No es un error —el código manda— pero hay que
  // preguntarle al cliente en qué se diferencian, así que se informa aparte.
  const porNombre = new Map<string, string[]>();
  for (const c of cuentas) {
    const lista = porNombre.get(c.nombre) ?? [];
    lista.push(c.codigo);
    porNombre.set(c.nombre, lista);
  }
  const posiblesDuplicados = Array.from(porNombre.entries())
    .filter(([, codigos]) => codigos.length > 1)
    .map(([nombre, codigos]) => ({ nombre, codigos }));

  // Las que Softland entregó con el código mal formado, para que se vea qué se
  // corrigió en vez de que la corrección pase inadvertida.
  const normalizadas = cuentas
    .filter((c) => c.codigo !== c.codigoErp)
    .map((c) => ({ codigoErp: c.codigoErp, codigo: c.codigo, nombre: c.nombre }));

  return { cuentas, errores, posiblesDuplicados, normalizadas };
}

/**
 * Lee un archivo de saldos. Acepta el código en cualquiera de las dos formas
 * (normalizada o cruda de Softland) y lo resuelve contra el plan cargado: es el
 * punto donde el `"5120 106"` del ERP se vuelve `51020106`.
 */
export function parsearSaldos(
  buffer: Buffer,
  plan: { codigo: string; codigoErp: string; naturaleza: string }[],
) {
  const porCodigo = new Map<string, typeof plan[number]>();
  const sinEspacios = (s: string) => s.replace(/\s/g, '');
  for (const c of plan) {
    porCodigo.set(sinEspacios(c.codigo), c);
    porCodigo.set(sinEspacios(c.codigoErp), c);
  }

  const filas = leerHoja(buffer);
  const saldos: { cuentaCodigo: string; debe: number; haber: number; saldo: number; monto: number }[] = [];
  const errores: ErrorFila[] = [];
  const vistos = new Set<string>();

  filas.forEach((f, i) => {
    const numeroFila = i + 2;
    const codigoCrudo = String(columna(f, 'CUENTA', 'codigo', 'código', 'cuenta contable') ?? '').trim();
    if (!codigoCrudo) return;
    const cuenta = porCodigo.get(sinEspacios(codigoCrudo));
    if (!cuenta) {
      errores.push({ fila: numeroFila, motivo: 'La cuenta no está en el plan', detalle: codigoCrudo });
      return;
    }
    if (vistos.has(cuenta.codigo)) {
      errores.push({ fila: numeroFila, motivo: 'La cuenta viene dos veces en el archivo', detalle: cuenta.codigo });
      return;
    }
    vistos.add(cuenta.codigo);
    const debe = aNumero(columna(f, 'DEBE', 'debitos', 'débitos'));
    const haber = aNumero(columna(f, 'HABER', 'creditos', 'créditos'));
    const saldo = aNumero(columna(f, 'SALDO', 'monto', 'total'));
    saldos.push({
      cuentaCodigo: cuenta.codigo,
      debe, haber, saldo,
      monto: montoDeFila(cuenta.naturaleza, debe, haber, saldo),
    });
  });

  return { saldos, errores };
}
