/**
 * Libro tintométrico: lee el Excel que entrega laboratorio y lo carga como
 * fórmulas de la carta de colores.
 *
 * El formato es el del "AKZO LIBRO TINTOMETRICO EA COPPER 960" (sep-2026): una
 * hoja por cartilla ("CARTILLA PANORAMICA", "SHERWIN WILLIAMS"), con arriba la
 * ficha del libro (LINEA, CARTILLA, BASES A UTILIZAR, FORMATO, VERSION) y
 * después una fila de encabezado BASE | COLOR | COL_1 … COL_4. Cada COL_n trae
 * el colorante y sus columnas de dosis: "GALON" y "5 GL" en la notación de la
 * máquina ("0Y12-0") y, en la cartilla Panorámica, también las rayas sin
 * redondear ("RAYAS O PINTAS", "RAYAS 5 GALONES"). Las columnas se ubican por
 * su título, no por posición: las dos hojas no las tienen en el mismo lugar.
 *
 * Lo que el libro trae raro no se corrige a ciegas, se avisa:
 *  - un mismo color con dos fórmulas distintas en la misma base → se guardan
 *    las dos (variante 1 y 2) con una alerta para que laboratorio decida;
 *  - el mismo color en dos bases → se guardan las dos con una alerta;
 *  - una fila repetida idéntica → se guarda una sola vez.
 * Así el operador ve lo mismo que dice el libro, y la duda queda a la vista.
 */
import * as XLSX from 'xlsx';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../db';
import { tintoColores, tintoFormulas } from '../../shared/schema';
import { escribirDosis, esDosisVacia, leerDosis, type ItemFormula } from '../../shared/tintometria';

export interface HojaLeida {
  hoja: string;
  cartilla: string;
  linea: string;
  version: string | null;
  filas: FilaLibro[];
}

interface FilaLibro {
  codigo: string;
  base: string;
  items: ItemFormula[];
}

export interface ResumenImportacion {
  hojas: Array<{
    hoja: string;
    cartilla: string;
    linea: string;
    version: string | null;
    filas: number;
    formulas: number;
    repetidasIdenticas: number;
  }>;
  coloresNuevos: number;
  formulasNuevas: number;
  formulasActualizadas: number;
  formulasDesactivadas: number;
  alertas: Array<{ cartilla: string; codigo: string; alerta: string }>;
  /** Colores de la pantonera que siguen sin ninguna fórmula activa. */
  sinFormula: string[];
}

const texto = (v: unknown) => (v === null || v === undefined ? '' : String(v).trim());
const mayus = (v: unknown) => texto(v).toUpperCase().replace(/\s+/g, ' ');

/** "SHERWIN WILLIAMS" → "SW", "PANORAMICA" → "PANORAMICA"; el resto tal cual. */
function codigoCartilla(nombre: string): string {
  const n = mayus(nombre).normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (n.includes('SHERWIN')) return 'SW';
  if (n.includes('PANORAMICA')) return 'PANORAMICA';
  return n;
}

/** Códigos de color sin espacios; los de Sherwin-Williams sin guion ("SW-7539" → "SW7539"). */
function normalizarCodigo(v: unknown): string {
  const c = mayus(v).replace(/\s+/g, '');
  const sw = /^SW-?(\d+)$/.exec(c);
  return sw ? `SW${sw[1]}` : c;
}

/** Galones de una columna de dosis por su título: "GALON" → 1, "5 GL" → 5, "RAYAS 5 GALONES" → 5. */
function galonesDeTitulo(titulo: string): number | null {
  const n = /(\d+(?:[.,]\d+)?)\s*(?:GL|GALONES|GAL)\b/.exec(titulo);
  if (n) return Number(n[1].replace(',', '.'));
  if (/GAL[OÓ]N|RAYAS O PINTAS/.test(titulo)) return 1;
  return null;
}

/**
 * Lee todas las hojas del libro que tengan el encabezado BASE | COLOR. Las
 * hojas sin ese encabezado (vacías, notas) se ignoran.
 */
export function leerLibro(buffer: Buffer): HojaLeida[] {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const hojas: HojaLeida[] = [];

  for (const nombreHoja of wb.SheetNames) {
    const filas = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[nombreHoja], {
      header: 1,
      raw: true,
      defval: null,
      blankrows: false,
    });

    const iEncabezado = filas.findIndex((f) => {
      const celdas = (f || []).map(mayus);
      const iBase = celdas.indexOf('BASE');
      return iBase >= 0 && celdas[iBase + 1] === 'COLOR';
    });
    if (iEncabezado < 0) continue;

    // Ficha del libro: "LINEA … ESMATE AL AGUA COPPER 960".
    const ficha: Record<string, string> = {};
    for (const f of filas.slice(0, iEncabezado)) {
      const celdas = (f || []).map(texto).filter(Boolean);
      if (celdas.length < 2) continue;
      const clave = mayus(celdas[0]);
      // "VERSION: OCTUBRE 2026 2026" → "OCTUBRE 2026" (el año viene repetido).
      ficha[clave] = Array.from(new Set(celdas.slice(1))).join(' ');
    }

    const encabezado = (filas[iEncabezado] || []).map(mayus);
    const colBase = encabezado.indexOf('BASE');
    const colColor = colBase + 1;

    // Bloques COL_n: el colorante y, hasta el próximo COL_, sus columnas de dosis.
    const bloques: Array<{ colColorante: number; textos: Map<number, number>; rayas: Map<number, number> }> = [];
    encabezado.forEach((titulo, i) => {
      if (/^COL_?\d+$/.test(titulo)) {
        bloques.push({ colColorante: i, textos: new Map(), rayas: new Map() });
        return;
      }
      const bloque = bloques[bloques.length - 1];
      if (!bloque) return;
      const galones = galonesDeTitulo(titulo);
      if (galones === null) return;
      if (titulo.includes('RAYAS')) bloque.rayas.set(galones, i);
      else bloque.textos.set(galones, i);
    });

    const cartilla = codigoCartilla(ficha['CARTILLA'] || nombreHoja);
    const linea = mayus(ficha['LINEA'] || '');
    if (!linea || bloques.length === 0) continue;

    const leidas: FilaLibro[] = [];
    for (const f of filas.slice(iEncabezado + 1)) {
      const codigo = normalizarCodigo(f?.[colColor]);
      const base = mayus(f?.[colBase]);
      if (!codigo || !base) continue;

      const items: ItemFormula[] = [];
      for (const b of bloques) {
        const colorante = mayus(f?.[b.colColorante]);
        if (!colorante) continue;
        const dosis: Record<string, string> = {};
        b.textos.forEach((col, galones) => {
          const d = leerDosis(texto(f?.[col]));
          if (d) dosis[String(galones)] = escribirDosis(d.totalRayas);
        });
        // La cantidad por galón sin redondear: la del libro si la trae; si no,
        // la del formato más grande dividida por sus galones (menos error).
        let rayasPorGalon: number | null = null;
        const rayas1 = b.rayas.has(1) ? Number(f?.[b.rayas.get(1)!]) : NaN;
        if (Number.isFinite(rayas1)) {
          rayasPorGalon = rayas1;
        } else {
          const formatos = Object.keys(dosis).map(Number).sort((a, c) => c - a);
          const mayor = formatos[0];
          const d = mayor ? leerDosis(dosis[String(mayor)]) : null;
          if (d) rayasPorGalon = d.totalRayas / mayor;
        }
        if (Object.values(dosis).every(esDosisVacia) && !rayasPorGalon) continue;
        items.push({
          colorante,
          dosis,
          rayasPorGalon: rayasPorGalon === null ? null : Math.round(rayasPorGalon * 10000) / 10000,
        });
      }
      if (items.length > 0) leidas.push({ codigo, base, items });
    }

    hojas.push({
      hoja: nombreHoja,
      cartilla,
      linea,
      version: ficha['VERSION'] ? mayus(ficha['VERSION']) : null,
      filas: leidas,
    });
  }

  return hojas;
}

const mismaFormula = (a: ItemFormula[], b: ItemFormula[]) =>
  JSON.stringify(a.map((i) => [i.colorante, i.dosis])) === JSON.stringify(b.map((i) => [i.colorante, i.dosis]));

const ALERTA_VARIANTES =
  'El libro trae más de una fórmula para este color en la misma base. Confirma con laboratorio cuál usar.';
const alertaBases = (bases: string[]) =>
  `Este color aparece en más de una base del libro (${bases.join(' y ').toLowerCase()}). Confirma con laboratorio cuál corresponde.`;

/**
 * Carga el libro: crea los colores que falten, actualiza las fórmulas del libro
 * de cada línea importada y apaga las que ya no vienen. Todo en una
 * transacción: si algo falla, queda la versión anterior intacta.
 */
export async function importarLibro(
  hojas: HojaLeida[],
  autor: { id?: string | null; nombre?: string | null },
): Promise<ResumenImportacion> {
  const resumen: ResumenImportacion = {
    hojas: [],
    coloresNuevos: 0,
    formulasNuevas: 0,
    formulasActualizadas: 0,
    formulasDesactivadas: 0,
    alertas: [],
    sinFormula: [],
  };

  await db.transaction(async (tx) => {
    for (const hoja of hojas) {
      // 1) Colores: los de la pantonera ya existen; los de Sherwin-Williams
      // (y cualquier código nuevo) se crean acá, sin nombre ni hex.
      const codigos = Array.from(new Set(hoja.filas.map((f) => f.codigo)));
      for (let i = 0; i < codigos.length; i += 500) {
        const lote = codigos.slice(i, i + 500);
        const creados = await tx
          .insert(tintoColores)
          .values(lote.map((codigo) => ({ cartilla: hoja.cartilla, codigo, grupo: null })))
          .onConflictDoNothing()
          .returning({ id: tintoColores.id });
        resumen.coloresNuevos += creados.length;
      }
      const colores = await tx
        .select({ id: tintoColores.id, codigo: tintoColores.codigo })
        .from(tintoColores)
        .where(and(eq(tintoColores.cartilla, hoja.cartilla), inArray(tintoColores.codigo, codigos)));
      const idDe = new Map(colores.map((c) => [c.codigo, c.id]));

      // 2) Variantes y alertas por color.
      const basesDe = new Map<string, Set<string>>();
      for (const f of hoja.filas) {
        if (!basesDe.has(f.codigo)) basesDe.set(f.codigo, new Set());
        basesDe.get(f.codigo)!.add(f.base);
      }
      const vistas = new Map<string, ItemFormula[][]>(); // codigo|base → variantes
      const aGuardar: Array<{ codigo: string; base: string; variante: number; items: ItemFormula[]; alerta: string | null }> = [];
      let repetidas = 0;
      for (const f of hoja.filas) {
        const clave = `${f.codigo}|${f.base}`;
        const previas = vistas.get(clave) ?? [];
        if (previas.some((p) => mismaFormula(p, f.items))) {
          repetidas++;
          continue;
        }
        previas.push(f.items);
        vistas.set(clave, previas);
        aGuardar.push({ codigo: f.codigo, base: f.base, variante: previas.length, items: f.items, alerta: null });
      }
      for (const g of aGuardar) {
        const variantes = vistas.get(`${g.codigo}|${g.base}`)!.length;
        const bases = Array.from(basesDe.get(g.codigo) ?? []);
        if (variantes > 1) g.alerta = ALERTA_VARIANTES;
        else if (bases.length > 1) g.alerta = alertaBases(bases);
      }
      const conAlerta = new Set<string>();
      for (const g of aGuardar) {
        if (g.alerta && !conAlerta.has(g.codigo)) {
          conAlerta.add(g.codigo);
          resumen.alertas.push({ cartilla: hoja.cartilla, codigo: g.codigo, alerta: g.alerta });
        }
      }

      // 3) Se apagan las fórmulas del libro de esta línea y cartilla; las que
      // vienen en el Excel se vuelven a prender al guardarlas. Lo que quede
      // apagado es lo que el libro nuevo ya no trae.
      const antes = await tx.execute(sql`
        SELECT f.id FROM tinto_formulas f
        JOIN tinto_colores c ON c.id = f.color_id
        WHERE f.origen = 'libro' AND f.activo = true AND f.linea = ${hoja.linea} AND c.cartilla = ${hoja.cartilla}
      `);
      const activasAntes = new Set((((antes as any).rows || []) as Array<{ id: string }>).map((r) => r.id));
      await tx.execute(sql`
        UPDATE tinto_formulas f SET activo = false
        FROM tinto_colores c
        WHERE c.id = f.color_id AND f.origen = 'libro' AND f.linea = ${hoja.linea} AND c.cartilla = ${hoja.cartilla}
      `);

      // 4) Guardar. xmax = 0 distingue la fila recién insertada de la actualizada.
      const guardadas = new Set<string>();
      for (let i = 0; i < aGuardar.length; i += 500) {
        const lote = aGuardar.slice(i, i + 500);
        const filas = await tx
          .insert(tintoFormulas)
          .values(
            lote.map((g) => ({
              colorId: idDe.get(g.codigo)!,
              linea: hoja.linea,
              base: g.base,
              variante: g.variante,
              origen: 'libro',
              version: hoja.version,
              items: g.items,
              alerta: g.alerta,
              creadoPorId: autor.id ?? null,
              creadoPorNombre: autor.nombre ?? null,
              activo: true,
            })),
          )
          .onConflictDoUpdate({
            target: [tintoFormulas.colorId, tintoFormulas.linea, tintoFormulas.base, tintoFormulas.variante],
            targetWhere: sql`origen = 'libro'`,
            set: {
              version: sql`EXCLUDED.version`,
              items: sql`EXCLUDED.items`,
              alerta: sql`EXCLUDED.alerta`,
              activo: true,
              updatedAt: sql`now()`,
            },
          })
          .returning({ id: tintoFormulas.id, nueva: sql<boolean>`(xmax = 0)` });
        for (const r of filas) {
          guardadas.add(r.id);
          if (r.nueva) resumen.formulasNuevas++;
          else resumen.formulasActualizadas++;
        }
      }
      activasAntes.forEach((id) => {
        if (!guardadas.has(id)) resumen.formulasDesactivadas++;
      });

      resumen.hojas.push({
        hoja: hoja.hoja,
        cartilla: hoja.cartilla,
        linea: hoja.linea,
        version: hoja.version,
        filas: hoja.filas.length,
        formulas: aGuardar.length,
        repetidasIdenticas: repetidas,
      });
    }
  });

  const sinFormula = await db.execute(sql`
    SELECT c.codigo FROM tinto_colores c
    WHERE c.cartilla = 'PANORAMICA' AND c.activo = true
      AND NOT EXISTS (SELECT 1 FROM tinto_formulas f WHERE f.color_id = c.id AND f.activo = true)
    ORDER BY c.orden NULLS LAST, c.codigo
  `);
  resumen.sinFormula = (((sinFormula as any).rows || []) as Array<{ codigo: string }>).map((r) => r.codigo);

  return resumen;
}
