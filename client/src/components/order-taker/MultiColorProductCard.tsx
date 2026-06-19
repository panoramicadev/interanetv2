import { useState, useMemo } from "react";

// ============================================================================
// MultiColorProductCard — versión PIXEL-EXACTA del prototipo
// ----------------------------------------------------------------------------
// Reproduce 1:1 el diseño del Constructor de Presupuesto (Tomador de Pedidos):
// mismos colores (#fd6301), paddings, radios, tipografías e íconos SVG, todos
// como estilos INLINE — NO depende de shadcn ni de tu config de Tailwind, así
// que se ve idéntico en cualquier entorno.
//
// Comportamiento:
//   - Envase único por tarjeta (define SKU + precio base).
//   - Color MULTISELECCIÓN: cada color marcado abre su propia fila con tramo
//     de precio y cantidad independientes.
//   - "Agregar" entrega una línea por color vía onAdd().
//
// Integración: pásale `getAvailableTiers` (la función de tramos del carrito) y
// `onAdd` (mapea las líneas a tu CartItem). Flete/IVA/totales no cambian.
// ============================================================================

// === Tipos (reutiliza los reales del repo si ya existen) ===
export interface FormatVariant {
  sku: string;
  name: string;
  color: string;
  format: string;
  price: string | null;
  priceList: string | null;
  stock: number;
  hex?: string | null;       // hex real desde color_palette (vía API)
  imageUrl?: string | null;  // imagen de la variante (rara vez poblada)
}
export interface GenericProduct {
  genericName: string;
  breveResena: string | null;
  imageUrl?: string | null;  // foto representativa del producto (vía API)
  colors: { [color: string]: FormatVariant[] };
}
export type PriceTier = { key: string; label: string; price: number };
export interface AddedLine {
  variant: FormatVariant;
  tier: PriceTier;
  qty: number;
}
interface SelectedLine {
  color: string;
  format: string;
  tier: string;
  qty: number;
}

// === Helpers de color (reemplaza por el util del repo si existe) ===
const COLOR_HEX: Record<string, string> = {
  Blanco: "#f8fafc",
  Hueso: "#f5f0e1",
  Gris: "#94a3b8",
  "Gris Perla": "#cbd5e1",
  Negro: "#1e293b",
  Rojo: "#dc2626",
  Transparente: "linear-gradient(135deg,#e0f2fe,#fef9c3)",
  Incoloro: "linear-gradient(135deg,#e2e8f0,#f1f5f9)",
};
const colorHex = (c: string) => COLOR_HEX[c] ?? "#cbd5e1";
// Contraste del check según luminancia del fondo (funciona con cualquier hex).
const isDarkHex = (bg: string): boolean => {
  const m = /^#([0-9a-fA-F]{6})$/.exec(bg?.trim() || "");
  if (!m) {
    const s = /^#([0-9a-fA-F]{3})$/.exec(bg?.trim() || "");
    if (!s) return false; // gradientes u otros → asume claro
    const r = parseInt(s[1][0] + s[1][0], 16);
    const g = parseInt(s[1][1] + s[1][1], 16);
    const b = parseInt(s[1][2] + s[1][2], 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) < 140;
  }
  const r = parseInt(m[1].slice(0, 2), 16);
  const g = parseInt(m[1].slice(2, 4), 16);
  const b = parseInt(m[1].slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) < 140;
};
const clp = (n: number) => "$" + Math.round(n).toLocaleString("es-CL");

// Fallback de tramos — SOLO si no se pasa getAvailableTiers.
function defaultTiers(v: FormatVariant): PriceTier[] {
  const base = Number(v.priceList ?? v.price ?? 0);
  const r = (f: number) => Math.round((base * f) / 10) * 10;
  return [
    { key: "lista", label: "Lista", price: base },
    { key: "mix", label: "Lista Mix", price: r(0.83) },
    { key: "d10", label: "10%", price: r(0.9) },
    { key: "d10_5", label: "10%+5%", price: r(0.857) },
    { key: "d10_5_3", label: "10%+5%+3%", price: r(0.83) },
    { key: "minimo", label: "Mínimo", price: r(0.83) },
  ];
}

// === Íconos SVG (Lucide, inline) ===
const Ic = {
  cart: (s = 17) => (
    <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="21" r="1" /><circle cx="19" cy="21" r="1" />
      <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
    </svg>
  ),
  minus: (s = 13) => (<svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round"><path d="M5 12h14" /></svg>),
  plus: (s = 13) => (<svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>),
  x: (s = 15) => (<svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>),
  check: (s = 15) => (<svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>),
};

export interface MultiColorProductCardProps {
  product: GenericProduct;
  getAvailableTiers?: (v: FormatVariant) => PriceTier[];
  onAdd: (lines: AddedLine[]) => void;
  /** Layout compacto para móvil: paddings/swatches más chicos y filas en 2 líneas. */
  compact?: boolean;
}

export function MultiColorProductCard({
  product,
  getAvailableTiers = defaultTiers,
  onAdd,
  compact = false,
}: MultiColorProductCardProps) {
  const colors = useMemo(() => Object.keys(product.colors), [product]);
  const allFormats = useMemo(() => {
    const s = new Set<string>();
    colors.forEach((c) => product.colors[c].forEach((v) => v.format && s.add(v.format)));
    return Array.from(s);
  }, [product, colors]);

  const [format, setFormat] = useState(allFormats[0] ?? "");
  // Selección keyed por SKU → cada combinación color+envase vive independiente,
  // así se acumulan colores de distintos formatos en el mismo listado.
  const [selected, setSelected] = useState<Record<string, SelectedLine>>({});

  // Mapa SKU → variante (todas las variantes de todos los formatos).
  const variantBySku = useMemo(() => {
    const m: Record<string, FormatVariant> = {};
    colors.forEach((c) => product.colors[c].forEach((v) => { m[v.sku] = v; }));
    return m;
  }, [product, colors]);

  const resolve = (color: string): FormatVariant =>
    product.colors[color]?.find((v) => v.format === format) ?? product.colors[color]?.[0];

  // Hex real del color (color_palette vía API); fallback al mapa local y luego gris.
  const swatchOf = (color: string): string =>
    product.colors[color]?.[0]?.hex || colorHex(color);

  // Foto de la variante (SKU) para el color/envase actual; fallback a la 1ª variante.
  const imageOf = (color: string): string | null =>
    resolve(color)?.imageUrl || product.colors[color]?.[0]?.imageUrl || null;

  // Toggle del color para el ENVASE activo: cada uno vive bajo su SKU propio.
  const toggleColor = (color: string) => {
    const v = resolve(color);
    if (!v) return;
    setSelected((prev) => {
      const next = { ...prev };
      if (next[v.sku]) delete next[v.sku];
      else next[v.sku] = { color, format, tier: "lista", qty: 1 };
      return next;
    });
  };
  const removeSku = (sku: string) =>
    setSelected((prev) => { const next = { ...prev }; delete next[sku]; return next; });
  const setTier = (sku: string, tier: string) =>
    setSelected((p) => ({ ...p, [sku]: { ...p[sku], tier } }));
  const bumpQty = (sku: string, d: number) =>
    setSelected((p) => ({ ...p, [sku]: { ...p[sku], qty: Math.max(1, p[sku].qty + d) } }));
  // Cantidad escrita a mano: fija un valor absoluto (acotado 1..99999).
  const setQty = (sku: string, n: number) =>
    setSelected((p) => ({ ...p, [sku]: { ...p[sku], qty: Math.min(99999, Math.max(1, n)) } }));

  // Solo colores disponibles para el envase (formato) seleccionado
  const colorsForFormat = colors.filter((c) => product.colors[c]?.some((v) => v.format === format));

  // Filas = TODAS las selecciones de TODOS los formatos, ordenadas por envase y color.
  const rowSkus = Object.keys(selected).sort((a, b) => {
    const fa = allFormats.indexOf(selected[a].format);
    const fb = allFormats.indexOf(selected[b].format);
    if (fa !== fb) return fa - fb;
    return selected[a].color.localeCompare(selected[b].color);
  });
  const priceOf = (sku: string) => {
    const v = variantBySku[sku];
    return getAvailableTiers(v).find((t) => t.key === selected[sku].tier)?.price ?? Number(v?.price ?? 0);
  };
  const totalQty = rowSkus.reduce((n, sku) => n + selected[sku].qty, 0);
  const totalAmt = rowSkus.reduce((n, sku) => n + priceOf(sku) * selected[sku].qty, 0);
  const stock = (() => { const v = resolve(colors[0]); return v ? v.stock : 0; })();
  const fromPrice = Math.min(...colors.map((c) => Number(resolve(c)?.priceList ?? resolve(c)?.price ?? 0)).filter((n) => n > 0));

  const handleAdd = () => {
    if (rowSkus.length === 0) return;
    onAdd(rowSkus.map((sku) => {
      const v = variantBySku[sku];
      const tier = getAvailableTiers(v).find((t) => t.key === selected[sku].tier)!;
      return { variant: v, tier, qty: selected[sku].qty };
    }));
    setSelected({});
  };

  const initials = product.genericName.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  const FONT = "Inter, system-ui, sans-serif";

  return (
    <div style={{ fontFamily: FONT, color: "#0f172a", border: "1px solid #eef0f3", borderRadius: compact ? 14 : 16, padding: compact ? 13 : 16, background: "#fff" }}>
      {/* Encabezado */}
      <div style={{ display: "flex", gap: compact ? 11 : 13, alignItems: "flex-start", marginBottom: compact ? 12 : 14 }}>
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.genericName}
            style={{ width: compact ? 44 : 50, height: compact ? 44 : 50, borderRadius: 13, objectFit: "cover", border: "1px solid rgba(15,23,42,.1)", flexShrink: 0, background: "#f8fafc" }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
        ) : (
          <div style={{ width: compact ? 44 : 50, height: compact ? 44 : 50, borderRadius: 13, background: swatchOf(selected[rowSkus[0]]?.color ?? colors[0]), border: "1px solid rgba(15,23,42,.1)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: "rgba(15,23,42,.45)" }}>{initials}</div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", background: "#f1f5f9", padding: "2px 7px", borderRadius: 6, fontFamily: "ui-monospace, monospace" }}>{resolve(colors[0])?.sku}</span>
            <span style={{ fontSize: 11, color: "#cbd5e1" }}>{colors.length} colores · {allFormats.length} formatos</span>
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.2, marginTop: 4 }}>{product.genericName}</div>
          {product.breveResena && <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 3, lineHeight: 1.4 }}>{product.breveResena}</div>}
        </div>
      </div>

      {/* Envase */}
      <div style={{ marginBottom: 11 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 7 }}>Envase</div>
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
          {allFormats.map((f) => {
            const active = f === format;
            return (
              <button key={f} onClick={() => setFormat(f)} style={{ cursor: "pointer", fontFamily: FONT, fontSize: 12, fontWeight: 600, padding: "7px 13px", borderRadius: 9, whiteSpace: "nowrap", transition: "all .15s", border: active ? "1px solid #fd6301" : "1px solid #e2e8f0", background: active ? "#fff7ed" : "#fff", color: active ? "#fd6301" : "#64748b" }}>{f}</button>
            );
          })}
        </div>
      </div>

      {/* Color — multiselección */}
      <div style={{ marginBottom: 13 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 7 }}>
          Color · <span style={{ color: "#94a3b8", textTransform: "none", letterSpacing: 0, fontWeight: 600 }}>elige uno o más</span>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-start" }}>
          {colorsForFormat.map((c) => {
            const cv = resolve(c);
            const active = !!(cv && selected[cv.sku]);
            const img = imageOf(c);
            return (
              <div key={c} onClick={() => toggleColor(c)} title={c} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, width: compact ? 54 : 64, cursor: "pointer" }}>
                <span style={{ position: "relative", width: compact ? 44 : 48, height: compact ? 44 : 48, borderRadius: 10, overflow: "hidden", transition: "all .15s", display: "flex", alignItems: "center", justifyContent: "center", background: "#fff", border: active ? "1.5px solid #fd6301" : "1px solid #e2e8f0", boxShadow: active ? "0 0 0 3px #fff7ed" : "none" }}>
                  {img ? (
                    <img
                      src={img}
                      alt={c}
                      style={{ width: "100%", height: "100%", objectFit: "contain", padding: 3, boxSizing: "border-box" }}
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                    />
                  ) : (
                    <span style={{ fontSize: 9, fontWeight: 700, color: "#cbd5e1" }}>S/F</span>
                  )}
                  {active && (
                    <span style={{ position: "absolute", top: 2, right: 2, display: "flex", color: "#fd6301", background: "#fff", borderRadius: 999 }}>{Ic.check(13)}</span>
                  )}
                </span>
                <span style={{ fontSize: 10, lineHeight: 1.2, textAlign: "center", color: active ? "#fd6301" : "#64748b", fontWeight: active ? 700 : 500, wordBreak: "break-word", textTransform: "capitalize" }}>{c.toLowerCase()}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filas por color: precio + cantidad */}
      <div style={{ paddingTop: 13, borderTop: "1px dashed #eef0f3" }}>
        {rowSkus.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 13 }}>
            {rowSkus.map((sku) => {
              const line = selected[sku];
              const v = variantBySku[sku];
              const tiers = getAvailableTiers(v);
              const colorFormat = (
                <div style={{ minWidth: compact ? 0 : 92, flex: compact ? 1 : undefined, display: "flex", flexDirection: "column", gap: 3 }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{line.color}</span>
                  <span style={{ fontSize: 9, fontWeight: 700, color: "#fd6301", background: "#fff7ed", border: "1px solid #fde6d3", padding: "1px 6px", borderRadius: 6, alignSelf: "flex-start", whiteSpace: "nowrap", textTransform: "uppercase", letterSpacing: ".02em" }}>{line.format}</span>
                </div>
              );
              const tierSelect = (
                <select value={line.tier} onChange={(e) => setTier(sku, e.target.value)} style={{ flex: 1, minWidth: 0, padding: "7px 9px", border: "1px solid #e2e8f0", borderRadius: 9, fontFamily: FONT, fontSize: 12, background: "#fff", outline: "none", cursor: "pointer" }}>
                  {tiers.map((t) => <option key={t.key} value={t.key}>{t.label}: {clp(t.price)}</option>)}
                </select>
              );
              const stepper = (
                <div style={{ display: "flex", alignItems: "center", gap: 5, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 9, padding: 3, flexShrink: 0 }}>
                  <button onClick={() => bumpQty(sku, -1)} style={{ width: 26, height: 26, borderRadius: 6, border: "none", background: "#f1f5f9", cursor: "pointer", color: "#64748b", display: "flex", alignItems: "center", justifyContent: "center" }}>{Ic.minus()}</button>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={line.qty}
                    onChange={(e) => { const value = parseInt(e.target.value, 10) || 1; setQty(sku, value); }}
                    onFocus={(e) => e.currentTarget.select()}
                    onBlur={(e) => { if (!e.currentTarget.value || parseInt(e.currentTarget.value, 10) < 1) setQty(sku, 1); }}
                    aria-label={`Cantidad ${line.color}`}
                    style={{ width: 34, fontSize: 13, fontWeight: 700, textAlign: "center", border: "none", outline: "none", background: "transparent", padding: 0, fontFamily: FONT, color: "#0f172a" }}
                  />
                  <button onClick={() => bumpQty(sku, 1)} style={{ width: 26, height: 26, borderRadius: 6, border: "none", background: "#f1f5f9", cursor: "pointer", color: "#64748b", display: "flex", alignItems: "center", justifyContent: "center" }}>{Ic.plus()}</button>
                </div>
              );
              const lineTotal = (
                <span style={{ fontSize: 13, fontWeight: 800, minWidth: compact ? 0 : 80, textAlign: "right", whiteSpace: "nowrap" }}>{clp(priceOf(sku) * line.qty)}</span>
              );
              const removeBtn = (
                <button onClick={() => removeSku(sku)} style={{ background: "none", border: "none", cursor: "pointer", color: "#cbd5e1", display: "flex", padding: 2, flexShrink: 0 }}>{Ic.x()}</button>
              );
              if (compact) {
                return (
                  <div key={sku} style={{ display: "flex", flexDirection: "column", gap: 8, background: "#fafbfc", border: "1px solid #eef0f3", borderRadius: 11, padding: "9px 11px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {colorFormat}
                      {lineTotal}
                      {removeBtn}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {tierSelect}
                      {stepper}
                    </div>
                  </div>
                );
              }
              return (
                <div key={sku} style={{ display: "flex", alignItems: "center", gap: 10, background: "#fafbfc", border: "1px solid #eef0f3", borderRadius: 11, padding: "9px 11px" }}>
                  {colorFormat}
                  {tierSelect}
                  {stepper}
                  {lineTotal}
                  {removeBtn}
                </div>
              );
            })}
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: "#475569" }}>
              {rowSkus.length > 0 ? `${rowSkus.length} ${rowSkus.length === 1 ? "color" : "colores"} · ${totalQty} un. · ${clp(totalAmt)}` : "Elige uno o más colores para cotizar"}
            </div>
            {rowSkus.length > 0 && (
              <div style={{ fontSize: 11, fontWeight: 600, color: "#16a34a", marginTop: 2 }}>Desde {clp(fromPrice)} · Stock {stock}</div>
            )}
          </div>
          <button onClick={handleAdd} disabled={rowSkus.length === 0} style={{ display: "flex", alignItems: "center", gap: 7, border: "none", fontFamily: FONT, fontSize: 14, fontWeight: 700, padding: "12px 18px", borderRadius: 12, whiteSpace: "nowrap", background: rowSkus.length > 0 ? "#fd6301" : "#f1f5f9", color: rowSkus.length > 0 ? "#fff" : "#cbd5e1", cursor: rowSkus.length > 0 ? "pointer" : "not-allowed", boxShadow: rowSkus.length > 0 ? "0 3px 10px rgba(253,99,1,.3)" : "none" }}>
            {Ic.cart(17)} {rowSkus.length > 0 ? `Agregar ${rowSkus.length} ${rowSkus.length === 1 ? "color" : "colores"}` : "Selecciona un color"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default MultiColorProductCard;
