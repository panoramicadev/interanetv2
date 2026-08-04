/**
 * Catálogo geográfico canónico de Chile — fuente única de verdad.
 *
 * Antes había tres catálogos en paralelo (`server/chile-regions.ts`, la tabla
 * `comuna_region_mapping` cargada desde CSV, y el campo libre `provincia` que
 * llega del ERP), cada uno con su propia forma de escribir lo mismo. Por eso el
 * filtro de Región del CRM mostraba "ARAUCANIA", "ARAUCANÍA", "La Araucanía" y
 * "La araucania" como cuatro opciones distintas, además de valores que ni
 * siquiera son de Chile ("NEUQUEN").
 *
 * Todo lo que toque comunas o regiones debe pasar por acá: 16 regiones y 346
 * comunas oficiales (división político-administrativa vigente, códigos CUT del
 * INE). `resolveComuna` / `resolveRegion` absorben la basura histórica y
 * devuelven siempre la forma canónica, o `null` si el valor no es de Chile.
 */

export interface RegionChile {
  /** Código CUT del INE, con cero a la izquierda ("01".."16"). */
  codigo: string;
  /** Nombre oficial completo. */
  nombre: string;
  /** Nombre corto, el que se muestra en la UI (selects, tablas, chips). */
  nombreCorto: string;
  /** Numeral romano histórico ("RM" para la Metropolitana). */
  romano: string;
}

export interface ComunaChile {
  /** Nombre canónico de la comuna, tal cual se muestra y se guarda. */
  nombre: string;
  /** Código CUT de la región a la que pertenece. */
  regionCodigo: string;
}

/** Etiqueta única para lo que no resuelve contra el catálogo. */
export const SIN_REGION = "Sin región";
export const SIN_COMUNA = "Sin comuna";

/** Las 16 regiones, ordenadas de norte a sur (no por código). */
export const REGIONES_CHILE: RegionChile[] = [
  { codigo: "15", nombre: "Región de Arica y Parinacota", nombreCorto: "Arica y Parinacota", romano: "XV" },
  { codigo: "01", nombre: "Región de Tarapacá", nombreCorto: "Tarapacá", romano: "I" },
  { codigo: "02", nombre: "Región de Antofagasta", nombreCorto: "Antofagasta", romano: "II" },
  { codigo: "03", nombre: "Región de Atacama", nombreCorto: "Atacama", romano: "III" },
  { codigo: "04", nombre: "Región de Coquimbo", nombreCorto: "Coquimbo", romano: "IV" },
  { codigo: "05", nombre: "Región de Valparaíso", nombreCorto: "Valparaíso", romano: "V" },
  { codigo: "13", nombre: "Región Metropolitana de Santiago", nombreCorto: "Metropolitana", romano: "RM" },
  { codigo: "06", nombre: "Región del Libertador General Bernardo O'Higgins", nombreCorto: "O'Higgins", romano: "VI" },
  { codigo: "07", nombre: "Región del Maule", nombreCorto: "Maule", romano: "VII" },
  { codigo: "16", nombre: "Región de Ñuble", nombreCorto: "Ñuble", romano: "XVI" },
  { codigo: "08", nombre: "Región del Biobío", nombreCorto: "Biobío", romano: "VIII" },
  { codigo: "09", nombre: "Región de La Araucanía", nombreCorto: "La Araucanía", romano: "IX" },
  { codigo: "14", nombre: "Región de Los Ríos", nombreCorto: "Los Ríos", romano: "XIV" },
  { codigo: "10", nombre: "Región de Los Lagos", nombreCorto: "Los Lagos", romano: "X" },
  { codigo: "11", nombre: "Región de Aysén del General Carlos Ibáñez del Campo", nombreCorto: "Aysén", romano: "XI" },
  { codigo: "12", nombre: "Región de Magallanes y de la Antártica Chilena", nombreCorto: "Magallanes", romano: "XII" },
];

const comunasDe = (regionCodigo: string, nombres: string[]): ComunaChile[] =>
  nombres.map((nombre) => ({ nombre, regionCodigo }));

/** Las 346 comunas, agrupadas por región y ordenadas alfabéticamente dentro de cada una. */
export const COMUNAS_CHILE: ComunaChile[] = [
  // 15 — Arica y Parinacota (4 comunas)
  ...comunasDe("15", [
    "Arica", "Camarones", "General Lagos", "Putre",
  ]),
  // 01 — Tarapacá (7 comunas)
  ...comunasDe("01", [
    "Alto Hospicio", "Camiña", "Colchane", "Huara", "Iquique", "Pica", "Pozo Almonte",
  ]),
  // 02 — Antofagasta (9 comunas)
  ...comunasDe("02", [
    "Antofagasta", "Calama", "María Elena", "Mejillones", "Ollagüe", "San Pedro de Atacama",
    "Sierra Gorda", "Taltal", "Tocopilla",
  ]),
  // 03 — Atacama (9 comunas)
  ...comunasDe("03", [
    "Alto del Carmen", "Caldera", "Chañaral", "Copiapó", "Diego de Almagro", "Freirina",
    "Huasco", "Tierra Amarilla", "Vallenar",
  ]),
  // 04 — Coquimbo (15 comunas)
  ...comunasDe("04", [
    "Andacollo", "Canela", "Combarbalá", "Coquimbo", "Illapel", "La Higuera", "La Serena",
    "Los Vilos", "Monte Patria", "Ovalle", "Paihuano", "Punitaqui", "Río Hurtado", "Salamanca",
    "Vicuña",
  ]),
  // 05 — Valparaíso (38 comunas)
  ...comunasDe("05", [
    "Algarrobo", "Cabildo", "Calle Larga", "Cartagena", "Casablanca", "Catemu", "Concón",
    "El Quisco", "El Tabo", "Hijuelas", "Isla de Pascua", "Juan Fernández", "La Calera",
    "La Cruz", "La Ligua", "Limache", "Llay-Llay", "Los Andes", "Nogales", "Olmué", "Panquehue",
    "Papudo", "Petorca", "Puchuncaví", "Putaendo", "Quillota", "Quilpué", "Quintero",
    "Rinconada", "San Antonio", "San Esteban", "San Felipe", "Santa María", "Santo Domingo",
    "Valparaíso", "Villa Alemana", "Viña del Mar", "Zapallar",
  ]),
  // 13 — Metropolitana (52 comunas)
  ...comunasDe("13", [
    "Alhué", "Buin", "Calera de Tango", "Cerrillos", "Cerro Navia", "Colina", "Conchalí",
    "Curacaví", "El Bosque", "El Monte", "Estación Central", "Huechuraba", "Independencia",
    "Isla de Maipo", "La Cisterna", "La Florida", "La Granja", "La Pintana", "La Reina",
    "Lampa", "Las Condes", "Lo Barnechea", "Lo Espejo", "Lo Prado", "Macul", "Maipú",
    "María Pinto", "Melipilla", "Ñuñoa", "Padre Hurtado", "Paine", "Pedro Aguirre Cerda",
    "Peñaflor", "Peñalolén", "Pirque", "Providencia", "Pudahuel", "Puente Alto", "Quilicura",
    "Quinta Normal", "Recoleta", "Renca", "San Bernardo", "San Joaquín", "San José de Maipo",
    "San Miguel", "San Pedro", "San Ramón", "Santiago", "Talagante", "Til Til", "Vitacura",
  ]),
  // 06 — O'Higgins (33 comunas)
  ...comunasDe("06", [
    "Chépica", "Chimbarongo", "Codegua", "Coinco", "Coltauco", "Doñihue", "Graneros",
    "La Estrella", "Las Cabras", "Litueche", "Lolol", "Machalí", "Malloa", "Marchigüe",
    "Mostazal", "Nancagua", "Navidad", "Olivar", "Palmilla", "Paredones", "Peralillo", "Peumo",
    "Pichidegua", "Pichilemu", "Placilla", "Pumanque", "Quinta de Tilcoco", "Rancagua", "Rengo",
    "Requínoa", "San Fernando", "San Vicente", "Santa Cruz",
  ]),
  // 07 — Maule (30 comunas)
  ...comunasDe("07", [
    "Cauquenes", "Chanco", "Colbún", "Constitución", "Curepto", "Curicó", "Empedrado",
    "Hualañé", "Licantén", "Linares", "Longaví", "Maule", "Molina", "Parral", "Pelarco",
    "Pelluhue", "Pencahue", "Rauco", "Retiro", "Río Claro", "Romeral", "Sagrada Familia",
    "San Clemente", "San Javier", "San Rafael", "Talca", "Teno", "Vichuquén", "Villa Alegre",
    "Yerbas Buenas",
  ]),
  // 16 — Ñuble (21 comunas)
  ...comunasDe("16", [
    "Bulnes", "Chillán", "Chillán Viejo", "Cobquecura", "Coelemu", "Coihueco", "El Carmen",
    "Ninhue", "Ñiquén", "Pemuco", "Pinto", "Portezuelo", "Quillón", "Quirihue", "Ránquil",
    "San Carlos", "San Fabián", "San Ignacio", "San Nicolás", "Treguaco", "Yungay",
  ]),
  // 08 — Biobío (33 comunas)
  ...comunasDe("08", [
    "Alto Biobío", "Antuco", "Arauco", "Cabrero", "Cañete", "Chiguayante", "Concepción",
    "Contulmo", "Coronel", "Curanilahue", "Florida", "Hualpén", "Hualqui", "Laja", "Lebu",
    "Los Álamos", "Los Ángeles", "Lota", "Mulchén", "Nacimiento", "Negrete", "Penco", "Quilaco",
    "Quilleco", "San Pedro de la Paz", "San Rosendo", "Santa Bárbara", "Santa Juana",
    "Talcahuano", "Tirúa", "Tomé", "Tucapel", "Yumbel",
  ]),
  // 09 — La Araucanía (32 comunas)
  ...comunasDe("09", [
    "Angol", "Carahue", "Cholchol", "Collipulli", "Cunco", "Curacautín", "Curarrehue",
    "Ercilla", "Freire", "Galvarino", "Gorbea", "Lautaro", "Loncoche", "Lonquimay",
    "Los Sauces", "Lumaco", "Melipeuco", "Nueva Imperial", "Padre Las Casas", "Perquenco",
    "Pitrufquén", "Pucón", "Purén", "Renaico", "Saavedra", "Temuco", "Teodoro Schmidt",
    "Toltén", "Traiguén", "Victoria", "Vilcún", "Villarrica",
  ]),
  // 14 — Los Ríos (12 comunas)
  ...comunasDe("14", [
    "Corral", "Futrono", "La Unión", "Lago Ranco", "Lanco", "Los Lagos", "Máfil", "Mariquina",
    "Paillaco", "Panguipulli", "Río Bueno", "Valdivia",
  ]),
  // 10 — Los Lagos (30 comunas)
  ...comunasDe("10", [
    "Ancud", "Calbuco", "Castro", "Chaitén", "Chonchi", "Cochamó", "Curaco de Vélez",
    "Dalcahue", "Fresia", "Frutillar", "Futaleufú", "Hualaihué", "Llanquihue", "Los Muermos",
    "Maullín", "Osorno", "Palena", "Puerto Montt", "Puerto Octay", "Puerto Varas", "Puqueldón",
    "Purranque", "Puyehue", "Queilén", "Quellón", "Quemchi", "Quinchao", "Río Negro",
    "San Juan de la Costa", "San Pablo",
  ]),
  // 11 — Aysén (10 comunas)
  ...comunasDe("11", [
    "Aysén", "Chile Chico", "Cisnes", "Cochrane", "Coyhaique", "Guaitecas", "Lago Verde",
    "O'Higgins", "Río Ibáñez", "Tortel",
  ]),
  // 12 — Magallanes (11 comunas)
  ...comunasDe("12", [
    "Antártica", "Cabo de Hornos", "Laguna Blanca", "Natales", "Porvenir", "Primavera",
    "Punta Arenas", "Río Verde", "San Gregorio", "Timaukel", "Torres del Paine",
  ]),
];

/**
 * Clave de comparación: mayúsculas, sin tildes ni diéresis, sin apóstrofes ni
 * puntos, y cualquier otro separador colapsado a un espacio.
 *
 * A diferencia de la normalización que hacía el viejo comunaRegionService, acá
 * NO se borran artículos ("LA", "LOS", "DE"…): hacerlo convertía "Las Condes" en
 * "CONDES" y "Los Lagos" en "LAGOS", que era justamente lo que impedía que el
 * join contra `comuna_region_mapping` encontrara nada.
 */
export function normalizeGeoKey(value: string | null | undefined): string {
  if (!value) return "";
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/['’`´.]/g, "")
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

/**
 * Variantes reales que aparecen en el ERP, en planillas de importación y en los
 * campos escritos a mano. La clave ya viene pasada por `normalizeGeoKey`.
 */
const ALIAS_COMUNA: Record<string, string> = {
  "LLAILLAY": "Llay-Llay",
  "LLAY LLAY": "Llay-Llay",
  "TILTIL": "Til Til",
  "PAIGUANO": "Paihuano",
  "TREHUACO": "Treguaco",
  "MARCHIHUE": "Marchigüe",
  "COIHAIQUE": "Coyhaique",
  "AISEN": "Aysén",
  "PUERTO AYSEN": "Aysén",
  "PUERTO AISEN": "Aysén",
  "PUERTO NATALES": "Natales",
  "PUERTO WILLIAMS": "Cabo de Hornos",
  "SAN VICENTE DE TAGUA TAGUA": "San Vicente",
  "ALTO BIO BIO": "Alto Biobío",
  "CHOL CHOL": "Cholchol",
  "HANGA ROA": "Isla de Pascua",
  "CALERA": "La Calera",
  "SANTIAGO CENTRO": "Santiago",
  "PENA FLOR": "Peñaflor",
  "ANTARTICA CHILENA": "Antártica",
  "PUERTO SAAVEDRA": "Saavedra",
  "SAN PEDRO DE LA COSTA": "San Pedro",
  "TEODORO SCHMITH": "Teodoro Schmidt",
  "PADRE LAS CASA": "Padre Las Casas",
  "OHIGGINS": "O'Higgins",
};

/** Variantes de nombre de región. La clave ya viene pasada por `normalizeGeoKey`. */
const ALIAS_REGION_EXTRA: Record<string, string> = {
  "ARICA": "15",
  "METROPOLITANA DE SANTIAGO": "13",
  "SANTIAGO": "13",
  "RM": "13",
  "R METROPOLITANA": "13",
  "LIB GRAL BERNARDO OHIGGINS": "06",
  "LIBERTADOR BERNARDO OHIGGINS": "06",
  "LIBERTADOR GENERAL BERNARDO OHIGGINS": "06",
  "BERNARDO OHIGGINS": "06",
  "BIO BIO": "08",
  "ARAUCANIA": "09",
  "AYSEN DEL GENERAL CARLOS IBANEZ DEL CAMPO": "11",
  "AISEN": "11",
  "MAGALLANES Y ANTARTICA CHILENA": "12",
  "MAGALLANES Y LA ANTARTICA CHILENA": "12",
  "MAGALLANES Y DE LA ANTARTICA CHILENA": "12",
};

const REGION_POR_CODIGO = new Map(REGIONES_CHILE.map((r) => [r.codigo, r]));

const COMUNA_POR_CLAVE = (() => {
  const map = new Map<string, ComunaChile>();
  for (const comuna of COMUNAS_CHILE) map.set(normalizeGeoKey(comuna.nombre), comuna);
  for (const [alias, nombre] of Object.entries(ALIAS_COMUNA)) {
    const canonica = map.get(normalizeGeoKey(nombre));
    if (canonica) map.set(alias, canonica);
  }
  return map;
})();

const REGION_POR_CLAVE = (() => {
  const map = new Map<string, RegionChile>();
  for (const region of REGIONES_CHILE) {
    for (const clave of [region.nombre, region.nombreCorto, region.romano]) {
      map.set(normalizeGeoKey(clave), region);
    }
  }
  for (const [alias, codigo] of Object.entries(ALIAS_REGION_EXTRA)) {
    const region = REGION_POR_CODIGO.get(codigo);
    if (region) map.set(alias, region);
  }
  return map;
})();

/**
 * Quita las palabras de encabezado que suelen venir pegadas al nombre, en
 * cualquier posición: "REGIÓN DE LA ARAUCANÍA", "VIII REGIÓN" y "Comuna de
 * Maipú" tienen que caer todas en la misma clave que el nombre pelado.
 */
function stripRuido(clave: string): string {
  return clave
    .replace(/\b(REGION|COMUNA|PROVINCIA|CIUDAD)(\s+(DE\s+LA|DEL|DE))?\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Devuelve la comuna canónica, o `null` si el texto no corresponde a una comuna de Chile. */
export function resolveComuna(value: string | null | undefined): ComunaChile | null {
  const clave = normalizeGeoKey(value);
  if (!clave) return null;
  return COMUNA_POR_CLAVE.get(clave) ?? COMUNA_POR_CLAVE.get(stripRuido(clave)) ?? null;
}

/** Devuelve la región canónica, o `null` si el texto no corresponde a una región de Chile. */
export function resolveRegion(value: string | null | undefined): RegionChile | null {
  const clave = normalizeGeoKey(value);
  if (!clave) return null;
  return REGION_POR_CLAVE.get(clave) ?? REGION_POR_CLAVE.get(stripRuido(clave)) ?? null;
}

/** Región a la que pertenece una comuna (acepta cualquier variante de escritura). */
export function regionDeComuna(value: string | null | undefined): RegionChile | null {
  const comuna = resolveComuna(value);
  return comuna ? REGION_POR_CODIGO.get(comuna.regionCodigo) ?? null : null;
}

export function regionPorCodigo(codigo: string | null | undefined): RegionChile | null {
  return codigo ? REGION_POR_CODIGO.get(codigo) ?? null : null;
}

/** Comunas de una región, en orden alfabético. */
export function comunasDeRegion(regionCodigo: string | null | undefined): ComunaChile[] {
  if (!regionCodigo) return COMUNAS_CHILE;
  return COMUNAS_CHILE.filter((c) => c.regionCodigo === regionCodigo);
}

type Candidatos = string | null | undefined | Array<string | null | undefined>;

const primero = <T>(valores: Candidatos, fn: (v: string) => T | null): T | null => {
  for (const v of Array.isArray(valores) ? valores : [valores]) {
    const hit = v ? fn(v) : null;
    if (hit) return hit;
  }
  return null;
};

/**
 * Resuelve la ubicación de un registro a partir de lo que haya disponible: la
 * comuna manda, y recién si ninguna candidata resuelve se cae a la región (o a
 * la provincia que manda el ERP, que suele traer nombres de región).
 *
 * Cada campo acepta una lista de candidatas en orden de preferencia, para que
 * un valor sucio en el primer campo no tape a uno bueno en el siguiente.
 * Es el helper que usan la UI, los endpoints y la importación: la cascada se
 * define una sola vez.
 */
export function resolveUbicacion(input: {
  comuna?: Candidatos;
  region?: Candidatos;
  provincia?: Candidatos;
}): { comuna: string | null; region: RegionChile | null } {
  const comuna = primero(input.comuna, resolveComuna);
  if (comuna) {
    return { comuna: comuna.nombre, region: REGION_POR_CODIGO.get(comuna.regionCodigo) ?? null };
  }
  const region = primero(input.region, resolveRegion) ?? primero(input.provincia, resolveRegion);
  return { comuna: null, region };
}

/**
 * Normaliza el par comuna/región antes de guardarlo.
 *
 * La comuna es el dato que manda: si resuelve contra el catálogo se guarda
 * canónica y la región se deriva de ella (nunca al revés, para que no puedan
 * quedar en desacuerdo). Si no resuelve se conserva el texto tal cual —perder
 * el dato sería peor que tenerlo sucio— y la región cae a lo que se haya
 * declarado, siempre que sea una región de Chile.
 */
export function normalizarGeoCrm(input: {
  comuna?: string | null;
  region?: string | null;
}): { comuna: string | null; region: string | null } {
  const comuna = resolveComuna(input.comuna);
  if (comuna) {
    return {
      comuna: comuna.nombre,
      region: REGION_POR_CODIGO.get(comuna.regionCodigo)?.nombreCorto ?? null,
    };
  }
  return {
    comuna: input.comuna?.trim() || null,
    region: resolveRegion(input.region)?.nombreCorto ?? null,
  };
}

/**
 * Ubicación canónica de un registro de CRM.
 *
 * Un seguimiento puede tener comuna/región propias (editadas a mano) y además
 * estar vinculado a un cliente del ERP, que trae su propia comuna y una
 * `provincia` que en la práctica guarda nombres de región. La prioridad es:
 * comuna del CRM → comuna del ERP → región del CRM → provincia del ERP.
 *
 * Devuelve los campos ya listos para el front, para que ninguna pantalla tenga
 * que volver a decidir cuál de los cuatro campos manda.
 */
export function ubicacionCanonicaDe(row: {
  comuna?: string | null;
  region?: string | null;
  linkedComuna?: string | null;
  linkedProvincia?: string | null;
}): { comunaCanonica: string | null; regionCanonica: string | null; regionCodigo: string | null } {
  const { comuna, region } = resolveUbicacion({
    comuna: [row.comuna, row.linkedComuna],
    region: row.region,
    provincia: row.linkedProvincia,
  });
  return {
    comunaCanonica: comuna,
    regionCanonica: region?.nombreCorto ?? null,
    regionCodigo: region?.codigo ?? null,
  };
}

/** Nombre canónico de comuna, o `null`. Azúcar para formularios e importaciones. */
export function nombreComunaCanonico(value: string | null | undefined): string | null {
  return resolveComuna(value)?.nombre ?? null;
}

/** Nombre corto de región (el que se muestra), o `null`. */
export function nombreRegionCanonico(value: string | null | undefined): string | null {
  return resolveRegion(value)?.nombreCorto ?? null;
}
