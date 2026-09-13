/**
 * Geocodificación de direcciones chilenas — dirección de texto → lat/lon.
 *
 * Lo usa "Dónde Comprar": las ferreterías llegan del ERP con la dirección tal
 * como la tecleó un vendedor ("OHIGGIND 44, LAJA", "C. 1 Nte. 498, 4780000
 * Temuco", "SENDA SUR LOTE 5 LA VARA") y hay que ponerles un pin en el mapa.
 *
 * Antes esto era una cascada de tres consultas contra Nominatim con
 * `catch { /* try next *\/ }`: si la dirección no calzaba, o si Nominatim
 * devolvía 429 (permite 1 request por segundo por IP y acá salían tres
 * seguidas), la respuesta era siempre la misma pantalla — "No se pudo
 * geocodificar" — sin decir cuál de las dos cosas pasó. Este módulo arregla las
 * tres partes:
 *
 *  1. Más variantes de consulta, en orden de mayor a menor precisión, y la
 *     comuna deducida del propio texto cuando el registro no la trae.
 *  2. Dos proveedores: Nominatim primero (es el que mejor entiende las
 *     direcciones chilenas con coma) y Photon de respaldo cuando Nominatim
 *     rechaza o limita — así un 429 ya no mata el intento completo.
 *  3. Cada intento queda registrado y vuelve al que llamó, para que la UI
 *     pueda decir *por qué* falló en vez de "no se puede".
 *
 * Las coordenadas se validan contra el recuadro de Chile continental + austral:
 * un pin en Madrid porque la calle existe allá es peor que no tener pin.
 */

import { regionDeComuna, resolveComuna, resolveRegion } from '@shared/chile-geo';

/** Contacto en el User-Agent: Nominatim lo exige en su política de uso. */
const USER_AGENT = 'Panoramica-Intranet/1.0 (soporte@pinturaspanoramica.cl)';

/** Nominatim permite 1 request por segundo por IP; dejamos un margen. */
const ESPERA_NOMINATIM_MS = 1100;

const TIMEOUT_MS = 8000;

/**
 * Cuando Nominatim contesta 429 (o 403) no sirve seguir golpeándolo: castiga
 * por volumen sostenido, no sólo por pasarse del segundo. Lo dejamos dormido un
 * rato y mientras tanto trabaja Photon, que no tiene ese límite. Es lo que
 * mataba la importación masiva: 76 direcciones seguidas y las últimas 62 se
 * iban en 429 encadenados.
 */
const PAUSA_TRAS_LIMITE_MS = 60_000;
let nominatimEnPausaHasta = 0;

/** Recuadro de Chile: desde Arica hasta el Cabo de Hornos, isla de Pascua fuera. */
const CHILE_BBOX = { latMin: -56.0, latMax: -17.4, lonMin: -76.0, lonMax: -66.0 };

export type PrecisionGeo = 'exacta' | 'aproximada';

export type ResultadoGeo = {
  lat: string;
  lon: string;
  /** 'aproximada' = cayó al centro de la comuna, no a la dirección. */
  precision: PrecisionGeo;
  fuente: 'nominatim' | 'photon';
  consulta: string;
  etiqueta: string | null;
  /** Región y comuna que reportó el proveedor; se comparan con las esperadas. */
  regionEncontrada: string | null;
  /**
   * Todos los campos donde el proveedor puede haber puesto la comuna. Van
   * varios porque no hay uno fijo: en el Gran Santiago Photon manda `city:
   * "Santiago"` y la comuna real en `name`, mientras que en regiones la comuna
   * viene en `city`. Basta que uno calce para dar el resultado por bueno.
   */
  comunasEncontradas: string[];
};

export type IntentoGeo = {
  consulta: string;
  fuente: 'nominatim' | 'photon';
  resultado: 'ok' | 'sin resultados' | 'otra región' | 'otra comuna' | string;
};

export type RespuestaGeo =
  | { ok: true; resultado: ResultadoGeo; intentos: IntentoGeo[] }
  | { ok: false; motivo: string; intentos: IntentoGeo[] };

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * El límite de Nominatim es por IP, no por llamada a `geocodificar`: la
 * importación masiva la invoca una vez por ferretería, y sin un turno compartido
 * la primera consulta de cada una sale pegada a la última de la anterior. Por
 * eso el reloj vive en el módulo, igual que `nominatimEnPausaHasta`, y vale lo
 * mismo para la ficha, el botón de la lista y el lote.
 */
let ultimaLlamadaNominatim = 0;

async function esperarTurnoNominatim() {
  const falta = ultimaLlamadaNominatim + ESPERA_NOMINATIM_MS - Date.now();
  if (falta > 0) await dormir(falta);
  ultimaLlamadaNominatim = Date.now();
}

const enChile = (lat: number, lon: number) =>
  lat >= CHILE_BBOX.latMin && lat <= CHILE_BBOX.latMax &&
  lon >= CHILE_BBOX.lonMin && lon <= CHILE_BBOX.lonMax;

/**
 * Abreviaturas que el ERP escribe cortadas y que los buscadores no expanden.
 * Sólo las que aparecen de verdad en la base; agregar de a una, con evidencia.
 */
const ABREVIATURAS: [RegExp, string][] = [
  [/\bC\.\s+/gi, 'Calle '],
  [/\bCL\.\s+/gi, 'Calle '],
  [/\bAV\.?\s+/gi, 'Avenida '],
  [/\bAVDA\.?\s+/gi, 'Avenida '],
  [/\bNTE\.?\b/gi, 'Norte'],
  [/\bPJE\.?\s+/gi, 'Pasaje '],
  [/\bGRAL\.?\s+/gi, 'General '],
  [/\bSGTO\.?\s+/gi, 'Sargento '],
  [/\bPTE\.?\s+/gi, 'Presidente '],
];

/** Saca el ruido que hace fallar la búsqueda: código postal, "S/N", "#", comas dobles. */
function limpiarDireccion(direccion: string): string {
  let s = ` ${direccion} `;
  s = s.replace(/\bS\/N\b/gi, ' ');
  s = s.replace(/\b\d{7}\b/g, ' '); // código postal chileno
  s = s.replace(/#/g, ' ');
  for (const [patron, reemplazo] of ABREVIATURAS) s = s.replace(patron, reemplazo);
  s = s.replace(/[,\s]+,/g, ',');
  return s.replace(/\s+/g, ' ').trim().replace(/^,|,$/g, '').trim();
}

/**
 * Comuna deducida del texto de la dirección, para los registros que la traen
 * vacía. "C. 1 Nte. 498, 4780000 Temuco, Araucanía" no tiene comuna en la base,
 * pero dice Temuco: con eso al menos cae en la ciudad correcta.
 */
function comunaDesdeTexto(texto: string): string | null {
  const partes = texto.split(/[,\-]/).map((p) => p.trim()).filter(Boolean);
  for (const parte of partes.reverse()) {
    const comuna = resolveComuna(parte);
    if (comuna) return comuna.nombre;
  }
  return null;
}

type Variante = { consulta: string; precision: PrecisionGeo };

/** Consultas a probar, de la más específica a la más gruesa. */
export function construirVariantes(input: {
  address?: string | null;
  comuna?: string | null;
  region?: string | null;
}): Variante[] {
  const direccion = (input.address || '').trim();
  const limpia = limpiarDireccion(direccion);
  const comuna = (input.comuna || '').trim() || comunaDesdeTexto(direccion) || '';
  const region = (input.region || '').trim() || (comuna ? resolveRegion(comuna)?.nombreCorto ?? '' : '');

  const variantes: Variante[] = [];
  const agregar = (consulta: string, precision: PrecisionGeo) => {
    const q = consulta.replace(/\s+/g, ' ').trim().replace(/^,|,$/g, '').trim();
    if (q && !variantes.some((v) => v.consulta === q)) variantes.push({ consulta: q, precision });
  };
  const unir = (...partes: string[]) => partes.filter(Boolean).join(', ');

  if (direccion) {
    // La dirección cruda anda mejor que la limpia más veces de las que uno
    // esperaría (Nominatim entiende "C. 1 Nte."), así que va primero.
    agregar(unir(direccion, comuna, region, 'Chile'), 'exacta');
    agregar(unir(limpia, comuna, region, 'Chile'), 'exacta');
    // Sin comas: es la forma que entiende Photon.
    agregar([limpia, comuna].filter(Boolean).join(' '), 'exacta');
    // Sin numeración: cae a la calle en vez de la casa, sigue siendo útil.
    const sinNumero = limpia.replace(/\b\d+\b/g, '').replace(/\s+/g, ' ').trim().replace(/^,|,$/g, '');
    if (sinNumero && sinNumero !== limpia) agregar(unir(sinNumero, comuna, 'Chile'), 'exacta');
  }
  // Último recurso: el centro de la comuna. Impreciso, pero ubicable en el mapa.
  if (comuna) agregar(unir(comuna, region, 'Chile'), 'aproximada');

  return variantes;
}

async function pedirJson(url: string): Promise<any> {
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function buscarNominatim(consulta: string): Promise<ResultadoGeo | null> {
  await esperarTurnoNominatim();
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=cl&addressdetails=1&accept-language=es&q=${encodeURIComponent(consulta)}`;
  const data = (await pedirJson(url)) as any[];
  if (!Array.isArray(data) || !data[0]) return null;
  const lat = Number(data[0].lat);
  const lon = Number(data[0].lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !enChile(lat, lon)) return null;
  return {
    lat: lat.toFixed(7),
    lon: lon.toFixed(7),
    precision: 'exacta',
    fuente: 'nominatim',
    consulta,
    etiqueta: data[0].display_name ?? null,
    regionEncontrada: data[0].address?.state ?? null,
    // `county` es la provincia, no la comuna: no sirve para comparar.
    comunasEncontradas: [
      data[0].address?.city, data[0].address?.town, data[0].address?.village,
      data[0].address?.municipality, data[0].address?.suburb,
    ].filter(Boolean) as string[],
  };
}

async function buscarPhoton(consulta: string): Promise<ResultadoGeo | null> {
  // Sin `lang`: Photon sólo acepta de/en/fr/it y con cualquier otro responde 400.
  const url = `https://photon.komoot.io/api/?limit=1&q=${encodeURIComponent(consulta)}`;
  const data = await pedirJson(url);
  const feature = (data?.features || [])[0];
  if (!feature) return null;
  const [lon, lat] = feature.geometry?.coordinates || [];
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !enChile(lat, lon)) return null;
  if (feature.properties?.countrycode && feature.properties.countrycode !== 'CL') return null;
  const p = feature.properties || {};
  return {
    lat: Number(lat).toFixed(7),
    lon: Number(lon).toFixed(7),
    precision: 'exacta',
    fuente: 'photon',
    consulta,
    etiqueta: [p.name, p.street, p.city, p.state].filter(Boolean).join(', ') || null,
    regionEncontrada: p.state ?? null,
    comunasEncontradas: [p.name, p.district, p.city].filter(Boolean) as string[],
  };
}

/**
 * Busca las coordenadas de una dirección. Nunca lanza: devuelve el motivo y la
 * bitácora de intentos para que la UI pueda mostrarlo.
 */
export async function geocodificar(
  input: { address?: string | null; comuna?: string | null; region?: string | null },
): Promise<RespuestaGeo> {
  const variantes = construirVariantes(input);
  const intentos: IntentoGeo[] = [];

  // Región esperada: si el buscador devuelve algo de otra región, es un
  // homónimo, no la dirección que buscábamos. "Gran Vía 1, Temuco" caía en un
  // barrio de Antofagasta, a 1.400 km. Preferimos seguir bajando en la cascada
  // y terminar en el centro de la comuna antes que poner un pin en otra parte.
  const comunaEsperada = resolveComuna((input.comuna || '').trim() || comunaDesdeTexto(input.address || ''));
  const regionEsperada = resolveRegion(input.region) ?? regionDeComuna(comunaEsperada?.nombre);

  if (variantes.length === 0) {
    return { ok: false, motivo: 'La ubicación no tiene dirección ni comuna que buscar', intentos };
  }

  for (const variante of variantes) {
    // Nominatim primero: entiende mejor las direcciones chilenas con coma.
    // Photon después con la misma consulta, tanto si Nominatim falló como si no
    // encontró nada — resuelve calles rurales que el otro no tiene indexadas.
    for (const fuente of ['nominatim', 'photon'] as const) {
      if (fuente === 'nominatim' && Date.now() < nominatimEnPausaHasta) continue;
      try {
        const encontrado = fuente === 'nominatim'
          ? await buscarNominatim(variante.consulta)
          : await buscarPhoton(variante.consulta);

        // Homónimo en otra parte de Chile: le damos la consulta al otro proveedor
        // antes de bajar a una variante menos precisa. Photon en particular hace
        // coincidencias difusas — "OHIGGIND 44, LAJA" le devolvía un canal en
        // Tucapel, a 66 km — así que se descarta lo que caiga en otra comuna.
        const fuera = encontrado && (
          (regionEsperada && resolveRegion(encontrado.regionEncontrada) &&
            resolveRegion(encontrado.regionEncontrada)!.codigo !== regionEsperada.codigo && 'otra región') ||
          (comunaEsperada && (() => {
            const reconocidas = encontrado.comunasEncontradas
              .map((c) => resolveComuna(c)?.nombre)
              .filter(Boolean) as string[];
            // Si ninguno de los campos nombra una comuna, no hay con qué
            // comparar: muchas direcciones caen en localidades que no son
            // comuna (Hualpin, dentro de Teodoro Schmidt) y son respuestas
            // buenas. Sólo se descarta si nombra comunas y ninguna es la nuestra.
            return reconocidas.length > 0 && !reconocidas.includes(comunaEsperada.nombre) && 'otra comuna';
          })())
        );
        if (fuera) {
          intentos.push({ consulta: variante.consulta, fuente, resultado: fuera });
          continue;
        }

        if (encontrado) {
          intentos.push({ consulta: variante.consulta, fuente, resultado: 'ok' });
          return {
            ok: true,
            resultado: { ...encontrado, precision: variante.precision },
            intentos,
          };
        }
        intentos.push({ consulta: variante.consulta, fuente, resultado: 'sin resultados' });
      } catch (err: any) {
        const detalle = err?.name === 'TimeoutError' ? 'timeout' : (err?.message || 'error');
        intentos.push({ consulta: variante.consulta, fuente, resultado: detalle });
        console.warn(`[geocoding] ${fuente} falló con "${variante.consulta}": ${detalle}`);
        if (fuente === 'nominatim' && /HTTP (429|403)/.test(detalle)) {
          nominatimEnPausaHasta = Date.now() + PAUSA_TRAS_LIMITE_MS;
          console.warn(`[geocoding] nominatim limitado; se usa photon por ${PAUSA_TRAS_LIMITE_MS / 1000}s`);
        }
      }
    }
  }

  const descartes = ['sin resultados', 'otra región', 'otra comuna', 'ok'];
  const proveedorCaido = intentos.some((i) => !descartes.includes(i.resultado));
  const motivo = proveedorCaido
    ? `No se pudo consultar el buscador de mapas (${intentos.filter((i) => !descartes.includes(i.resultado)).map((i) => `${i.fuente}: ${i.resultado}`).join('; ')})`
    : `Ningún buscador encontró la dirección. Se probó con: ${variantes.map((v) => `"${v.consulta}"`).join(', ')}`;

  return { ok: false, motivo, intentos };
}
