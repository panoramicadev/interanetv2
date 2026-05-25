import type { ParsedDte } from '../utils/dte-parse';
import { tipoDteNombre, tipoRefNombre } from '../utils/dte-parse';

function esc(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function clp(n: number): string {
  return '$' + Math.round(n || 0).toLocaleString('es-CL');
}

function qty(n: number): string {
  return (n || 0).toLocaleString('es-CL', { maximumFractionDigits: 2 });
}

function fmtRut(rut: string): string {
  const clean = (rut || '').replace(/\./g, '').replace(/\s/g, '').toUpperCase();
  const m = clean.match(/^(\d+)-?([\dK])$/);
  if (!m) return rut;
  return Number(m[1]).toLocaleString('es-CL') + '-' + m[2];
}

function fmtDate(iso: string): string {
  if (!iso) return '—';
  const [y, mo, d] = iso.slice(0, 10).split('-');
  return d && mo && y ? `${d}-${mo}-${y}` : iso;
}

export interface FacturaPdfOptions {
  timbreBase64: string; // JPEG base64 (FMAEDTE.PDF417)
  logoUrl?: string | null;
}

export function renderFacturaHtml(dte: ParsedDte, opts: FacturaPdfOptions): string {
  const { emisor, receptor, totales } = dte;
  const tituloDoc = tipoDteNombre(dte.tipoDte);

  const itemsRows = dte.items.map((it) => `
    <tr>
      <td class="c">${esc(it.codigo)}</td>
      <td>${esc(it.nombre)}${it.descripcion ? `<div class="desc">${esc(it.descripcion)}</div>` : ''}</td>
      <td class="r">${qty(it.cantidad)}</td>
      <td class="c">${esc(it.unidad)}</td>
      <td class="r">${clp(it.precio)}</td>
      <td class="r">${it.descuentoPct ? qty(it.descuentoPct) + '%' : ''}</td>
      <td class="r">${clp(it.monto)}</td>
    </tr>`).join('');

  const refsHtml = dte.referencias.length ? `
    <div class="refs">
      <span class="refs-title">Referencias:</span>
      ${dte.referencias.map((r) =>
        `${esc(tipoRefNombre(r.tipo))} ${esc(r.folio)}${r.fecha ? ' · ' + fmtDate(r.fecha) : ''}${r.razon ? ' · ' + esc(r.razon) : ''}`
      ).join(' &nbsp;|&nbsp; ')}
    </div>` : '';

  const logoHtml = opts.logoUrl
    ? `<img src="${esc(opts.logoUrl)}" alt="logo" class="logo" />`
    : '';

  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8" />
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #1a1a1a; font-size: 11px; margin: 0; }
  .doc { width: 100%; }
  .top { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
  .emisor { max-width: 60%; }
  .logo { max-height: 60px; max-width: 240px; object-fit: contain; margin-bottom: 6px; }
  .logo-text { font-size: 18px; font-weight: 800; color: #FF6E23; margin-bottom: 4px; }
  .emisor .name { font-size: 14px; font-weight: 800; }
  .emisor .line { color: #444; }
  .sii-box { border: 2px solid #c0392b; border-radius: 8px; padding: 12px 18px; text-align: center; min-width: 230px; color: #c0392b; }
  .sii-box .rut { font-size: 14px; font-weight: 800; }
  .sii-box .tipo { font-size: 13px; font-weight: 800; margin: 4px 0; }
  .sii-box .folio { font-size: 16px; font-weight: 800; }
  .sii-box .unidad { color: #c0392b; font-size: 10px; margin-top: 4px; }
  .meta { display: flex; gap: 10px; margin-top: 14px; }
  .receptor { flex: 1; border: 1px solid #ddd; border-radius: 8px; padding: 10px 12px; }
  .receptor .h { font-size: 9px; font-weight: 800; color: #888; text-transform: uppercase; letter-spacing: .05em; margin-bottom: 4px; }
  .receptor .grid { display: grid; grid-template-columns: auto 1fr; gap: 2px 8px; }
  .receptor .k { color: #888; }
  .receptor .v { font-weight: 600; }
  .pago { width: 200px; border: 1px solid #ddd; border-radius: 8px; padding: 10px 12px; }
  .pago .row { display: flex; justify-content: space-between; padding: 2px 0; }
  .pago .k { color: #888; }
  table.items { width: 100%; border-collapse: collapse; margin-top: 14px; }
  table.items th { background: #f3f4f6; color: #555; font-size: 9px; text-transform: uppercase; letter-spacing: .04em; padding: 7px 8px; text-align: left; border-bottom: 2px solid #e5e7eb; }
  table.items td { padding: 6px 8px; border-bottom: 1px solid #f0f0f0; vertical-align: top; }
  table.items td.r, table.items th.r { text-align: right; }
  table.items td.c, table.items th.c { text-align: center; }
  .desc { color: #888; font-size: 10px; }
  .bottom { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 16px; gap: 20px; }
  .timbre { text-align: center; max-width: 320px; }
  .timbre img { width: 320px; height: auto; }
  .timbre .cap { font-size: 9px; color: #555; margin-top: 2px; }
  .tot { min-width: 240px; }
  .tot .row { display: flex; justify-content: space-between; padding: 3px 0; }
  .tot .row.total { border-top: 2px solid #1a1a1a; margin-top: 4px; padding-top: 6px; font-size: 14px; font-weight: 800; }
  .tot .k { color: #555; }
  .refs { margin-top: 10px; font-size: 10px; color: #555; }
  .refs-title { font-weight: 700; color: #333; }
</style></head>
<body>
  <div class="doc">
    <div class="top">
      <div class="emisor">
        ${logoHtml}
        <div class="name">${esc(emisor.razonSocial)}</div>
        <div class="line">${esc(emisor.giro)}</div>
        <div class="line">${esc(emisor.direccion)}${emisor.comuna ? ', ' + esc(emisor.comuna) : ''}${emisor.ciudad ? ', ' + esc(emisor.ciudad) : ''}</div>
        ${emisor.correo ? `<div class="line">${esc(emisor.correo.trim())}</div>` : ''}
      </div>
      <div class="sii-box">
        <div class="rut">R.U.T. ${esc(fmtRut(emisor.rut))}</div>
        <div class="tipo">${esc(tituloDoc)}</div>
        <div class="folio">N° ${esc(dte.folio)}</div>
        <div class="unidad">S.I.I.${emisor.ciudad ? ' - ' + esc(emisor.ciudad) : ''}</div>
      </div>
    </div>

    <div class="meta">
      <div class="receptor">
        <div class="h">Señor(es)</div>
        <div class="grid">
          <span class="k">Razón social</span><span class="v">${esc(receptor.razonSocial)}</span>
          <span class="k">R.U.T.</span><span class="v">${esc(fmtRut(receptor.rut))}</span>
          ${receptor.giro ? `<span class="k">Giro</span><span class="v">${esc(receptor.giro.trim())}</span>` : ''}
          ${receptor.direccion ? `<span class="k">Dirección</span><span class="v">${esc(receptor.direccion.trim())}</span>` : ''}
          ${(receptor.comuna || receptor.ciudad) ? `<span class="k">Comuna</span><span class="v">${esc(receptor.comuna.trim())}${receptor.ciudad ? ', ' + esc(receptor.ciudad.trim()) : ''}</span>` : ''}
        </div>
      </div>
      <div class="pago">
        <div class="row"><span class="k">Emisión</span><span>${fmtDate(dte.fechaEmision)}</span></div>
        ${dte.formaPago ? `<div class="row"><span class="k">Pago</span><span>${esc(dte.formaPago)}</span></div>` : ''}
        ${dte.fechaVencimiento ? `<div class="row"><span class="k">Vencimiento</span><span>${fmtDate(dte.fechaVencimiento)}</span></div>` : ''}
      </div>
    </div>

    <table class="items">
      <thead><tr>
        <th class="c">Código</th><th>Descripción</th><th class="r">Cant.</th>
        <th class="c">Un.</th><th class="r">Precio</th><th class="r">Desc.</th><th class="r">Monto</th>
      </tr></thead>
      <tbody>${itemsRows}</tbody>
    </table>

    ${refsHtml}

    <div class="bottom">
      <div class="timbre">
        ${opts.timbreBase64 ? `<img src="data:image/jpeg;base64,${opts.timbreBase64}" alt="Timbre Electrónico SII" />` : ''}
        <div class="cap">Timbre Electrónico SII<br/>Verifique documento: www.sii.cl</div>
      </div>
      <div class="tot">
        <div class="row"><span class="k">Monto Neto</span><span>${clp(totales.neto)}</span></div>
        ${totales.exento ? `<div class="row"><span class="k">Monto Exento</span><span>${clp(totales.exento)}</span></div>` : ''}
        <div class="row"><span class="k">IVA (${totales.tasaIva || 19}%)</span><span>${clp(totales.iva)}</span></div>
        <div class="row total"><span>TOTAL</span><span>${clp(totales.total)}</span></div>
      </div>
    </div>
  </div>
</body></html>`;
}
