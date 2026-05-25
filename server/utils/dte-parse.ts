// Parser sin dependencias del XML de un DTE (formato estándar SII).
// Solo extrae lo necesario para la representación impresa. El XML viene de
// Softland (dbo.FMAEDTE.XML) y tiene estructura fija:
//   <DTE><Documento><Encabezado>(IdDoc/Emisor/Receptor/Totales)</Encabezado>
//        <Detalle>* <Referencia>* <TED>... <Signature>...</Documento></DTE>

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

/** Primer valor del tag `name` dentro de `xml` (o ''). */
function tag(xml: string, name: string): string {
  const m = xml.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`));
  return m ? decodeEntities(m[1]).trim() : '';
}

/** Contenido de la primera ocurrencia de un bloque `<name>...</name>`. */
function section(xml: string, name: string): string {
  const m = xml.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`));
  return m ? m[1] : '';
}

/** Todas las ocurrencias de un bloque repetido. */
function blocks(xml: string, name: string): string[] {
  const re = new RegExp(`<${name}>([\\s\\S]*?)</${name}>`, 'g');
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) out.push(m[1]);
  return out;
}

function num(s: string): number {
  const n = Number(String(s).replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

export interface DteItem {
  linea: number;
  codigo: string;
  nombre: string;
  descripcion: string;
  cantidad: number;
  unidad: string;
  precio: number;
  descuentoPct: number;
  monto: number;
}

export interface DteReferencia {
  tipo: string;   // TpoDocRef (801=OC, 52=Guía, etc.)
  folio: string;
  fecha: string;
  razon: string;
}

export interface ParsedDte {
  tipoDte: number;
  folio: string;
  fechaEmision: string;
  fechaVencimiento: string;
  formaPago: string;       // glosa
  emisor: { rut: string; razonSocial: string; giro: string; direccion: string; comuna: string; ciudad: string; acteco: string; correo: string };
  receptor: { rut: string; razonSocial: string; giro: string; direccion: string; comuna: string; ciudad: string };
  totales: { neto: number; exento: number; tasaIva: number; iva: number; total: number };
  items: DteItem[];
  referencias: DteReferencia[];
}

const FORMA_PAGO: Record<string, string> = { '1': 'Contado', '2': 'Crédito', '3': 'Sin costo (gratuito)' };

export function parseDte(xml: string): ParsedDte {
  const enc = section(xml, 'Encabezado');
  const idDoc = section(enc, 'IdDoc');
  const emi = section(enc, 'Emisor');
  const rec = section(enc, 'Receptor');
  const tot = section(enc, 'Totales');

  const items: DteItem[] = blocks(xml, 'Detalle').map((d) => {
    const cdg = section(d, 'CdgItem');
    return {
      linea: num(tag(d, 'NroLinDet')),
      codigo: tag(cdg, 'VlrCodigo'),
      nombre: tag(d, 'NmbItem'),
      descripcion: tag(d, 'DscItem'),
      cantidad: num(tag(d, 'QtyItem')),
      unidad: tag(d, 'UnmdItem'),
      precio: num(tag(d, 'PrcItem')),
      descuentoPct: num(tag(d, 'DescuentoPct')),
      monto: num(tag(d, 'MontoItem')),
    };
  });

  const referencias: DteReferencia[] = blocks(xml, 'Referencia').map((r) => ({
    tipo: tag(r, 'TpoDocRef'),
    folio: tag(r, 'FolioRef'),
    fecha: tag(r, 'FchRef'),
    razon: tag(r, 'RazonRef'),
  }));

  const fmaPago = tag(idDoc, 'FmaPago');
  const glosa = tag(idDoc, 'TermPagoGlosa') || FORMA_PAGO[fmaPago] || '';

  return {
    tipoDte: num(tag(idDoc, 'TipoDTE')),
    folio: tag(idDoc, 'Folio'),
    fechaEmision: tag(idDoc, 'FchEmis'),
    fechaVencimiento: tag(idDoc, 'FchVenc'),
    formaPago: glosa,
    emisor: {
      rut: tag(emi, 'RUTEmisor'),
      razonSocial: tag(emi, 'RznSoc'),
      giro: tag(emi, 'GiroEmis'),
      direccion: tag(emi, 'DirOrigen'),
      comuna: tag(emi, 'CmnaOrigen'),
      ciudad: tag(emi, 'CiudadOrigen'),
      acteco: tag(emi, 'Acteco'),
      correo: tag(emi, 'CorreoEmisor'),
    },
    receptor: {
      rut: tag(rec, 'RUTRecep'),
      razonSocial: tag(rec, 'RznSocRecep'),
      giro: tag(rec, 'GiroRecep'),
      direccion: tag(rec, 'DirRecep'),
      comuna: tag(rec, 'CmnaRecep'),
      ciudad: tag(rec, 'CiudadRecep'),
    },
    totales: {
      neto: num(tag(tot, 'MntNeto')),
      exento: num(tag(tot, 'MntExe')),
      tasaIva: num(tag(tot, 'TasaIVA')),
      iva: num(tag(tot, 'IVA')),
      total: num(tag(tot, 'MntTotal')),
    },
    items,
    referencias,
  };
}

/** Nombre legible del tipo de DTE SII. */
export function tipoDteNombre(tipo: number): string {
  switch (tipo) {
    case 33: return 'FACTURA ELECTRÓNICA';
    case 34: return 'FACTURA NO AFECTA O EXENTA ELECTRÓNICA';
    case 39: return 'BOLETA ELECTRÓNICA';
    case 41: return 'BOLETA EXENTA ELECTRÓNICA';
    case 52: return 'GUÍA DE DESPACHO ELECTRÓNICA';
    case 56: return 'NOTA DE DÉBITO ELECTRÓNICA';
    case 61: return 'NOTA DE CRÉDITO ELECTRÓNICA';
    default: return `DTE TIPO ${tipo}`;
  }
}

/** Nombre legible del tipo de documento de referencia. */
export function tipoRefNombre(tipo: string): string {
  const map: Record<string, string> = {
    '33': 'Factura', '34': 'Factura exenta', '39': 'Boleta', '46': 'Factura de compra',
    '52': 'Guía de despacho', '56': 'Nota de débito', '61': 'Nota de crédito',
    '801': 'Orden de compra', '802': 'Nota de pedido', 'HES': 'HES', 'NVV': 'Nota de venta',
  };
  return map[tipo] || `Doc. ${tipo}`;
}
