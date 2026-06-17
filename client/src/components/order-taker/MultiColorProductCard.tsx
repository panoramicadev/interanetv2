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
}

export function MultiColorProductCard({
  product,
  getAvailableTiers = defaultTiers,
  onAdd,
}: MultiColorProductCardProps) {
  const colors = useMemo(() => Object.keys(product.colors), [product]);
  const allFormats = useMemo(() => {
    const s = new Set<string>();
    colors.forEach((c) => product.colors[c].forEach((v) => v.format && s.add(v.format)));
    return Array.from(s);
  }, [product, colors]);

  const [format, setFormat] = useState(allFormats[0] ?? "");
  const [selected, setSelected] = useState<Record<string, SelectedLine>>({});

  const resolve = (color: string): FormatVariant =>
    product.colors[color]?.find((v) => v.format === format) ?? product.colors[color]?.[0];

  // Hex real del color (color_palette vía API); fallback al mapa local y luego gris.
  const swatchOf = (color: string): string =>
    product.colors[color]?.[0]?.hex || colorHex(color);

  // Foto de la variante (SKU) para el color/envase actual; fallback a la 1ª variante.
  const imageOf = (color: string): string | null =>
    resolve(color)?.imageUrl || product.colors[color]?.[0]?.imageUrl || null;

  const toggleColor = (color: string) =>
    setSelected((prev) => {
      const next = { ...prev };
      if (next[color]) delete next[color];
      else next[color] = { tier: "lista", qty: 1 };
      return next;
    });
  const setTier = (color: string, tier: string) =>
    setSelected((p) => ({ ...p, [color]: { ...p[color], tier } }));
  const bumpQty = (color: string, d: number) =>
    setSelected((p) => ({ ...p, [color]: { ...p[color], qty: Math.max(1, p[color].qty + d) } }));

  // Solo colores disponibles para el envase (formato) seleccionado
  const colorsForFormat = colors.filter((c) => product.colors[c]?.some((v) => v.format === format));
  const rows = colorsForFormat.filter((c) => selected[c]);
  const priceOf = (color: string) => {
    const v = resolve(color);
    return getAvailableTiers(v).find((t) => t.key === selected[color].tier)?.price ?? Number(v.price ?? 0);
  };
  const totalQty = rows.reduce((n, c) => n + selected[c].qty, 0);
  const totalAmt = rows.reduce((n, c) => n + priceOf(c) * selected[c].qty, 0);
  const stock = (() => { const v = resolve(colors[0]); return v ? v.stock : 0; })();
  const fromPrice = Math.min(...colors.map((c) => Number(resolve(c)?.priceList ?? resolve(c)?.price ?? 0)).filter((n) => n > 0));

  const handleAdd = () => {
    if (rows.length === 0) return;
    onAdd(rows.map((color) => {
      const v = resolve(color);
      const tier = getAvailableTiers(v).find((t) => t.key === selected[color].tier)!;
      return { variant: v, tier, qty: selected[color].qty };
    }));
    setSelected({});
  };

  const initials = product.genericName.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  const FONT = "Inter, system-ui, sans-serif";

  return (
    <div style={{ fontFamily: FONT, color: "#0f172a", border: "1px solid #eef0f3", borderRadius: 16, padding: 16, background: "#fff" }}>
      {/* Encabezado */}
      <div style={{ display: "flex", gap: 13, alignItems: "flex-start", marginBottom: 14 }}>
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.genericName}
            style={{ width: 50, height: 50, borderRadius: 13, objectFit: "cover", border: "1px solid rgba(15,23,42,.1)", flexShrink: 0, background: "#f8fafc" }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
        ) : (
          <div style={{ width: 50, height: 50, borderRadius: 13, background: swatchOf(rows[0] ?? colors[0]), border: "1px solid rgba(15,23,42,.1)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: "rgba(15,23,42,.45)" }}>{initials}</div>
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
            const active = !!selected[c];
            const img = imageOf(c);
            return (
              <div key={c} onClick={() => toggleColor(c)} title={c} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, width: 64, cursor: "pointer" }}>
                <span style={{ position: "relative", width: 48, height: 48, borderRadius: 10, overflow: "hidden", transition: "all .15s", display: "flex", alignItems: "center", justifyContent: "center", background: "#fff", border: active ? "1.5px solid #fd6301" : "1px solid #e2e8f0", boxShadow: active ? "0 0 0 3px #fff7ed" : "none" }}>
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
        {rows.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 13 }}>
            {rows.map((color) => {
              const v = resolve(color);
              const tiers = getAvailableTiers(v);
              return (
                <div key={color} style={{ display: "flex", alignItems: "center", gap: 10, background: "#fafbfc", border: "1px solid #eef0f3", borderRadius: 11, padding: "9px 11px" }}>
                  <span style={{ width: 22, height: 22, borderRadius: 999, background: swatchOf(color), border: "1px solid rgba(15,23,42,.14)", flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: 700, minWidth: 70 }}>{color}</span>
                  <select value={selected[color].tier} onChange={(e) => setTier(color, e.target.value)} style={{ flex: 1, minWidth: 0, padding: "7px 9px", border: "1px solid #e2e8f0", borderRadius: 9, fontFamily: FONT, fontSize: 12, background: "#fff", outline: "none", cursor: "pointer" }}>
                    {tiers.map((t) => <option key={t.key} value={t.key}>{t.label}: {clp(t.price)}</option>)}
                  </select>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 9, padding: 3 }}>
                    <button onClick={() => bumpQty(color, -1)} style={{ width: 26, height: 26, borderRadius: 6, border: "none", background: "#f1f5f9", cursor: "pointer", color: "#64748b", display: "flex", alignItems: "center", justifyContent: "center" }}>{Ic.minus()}</button>
                    <span style={{ fontSize: 13, fontWeight: 700, minWidth: 20, textAlign: "center" }}>{selected[color].qty}</span>
                    <button onClick={() => bumpQty(color, 1)} style={{ width: 26, height: 26, borderRadius: 6, border: "none", background: "#f1f5f9", cursor: "pointer", color: "#64748b", display: "flex", alignItems: "center", justifyContent: "center" }}>{Ic.plus()}</button>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 800, minWidth: 80, textAlign: "right" }}>{clp(priceOf(color) * selected[color].qty)}</span>
                  <button onClick={() => toggleColor(color)} style={{ background: "none", border: "none", cursor: "pointer", color: "#cbd5e1", display: "flex", padding: 2 }}>{Ic.x()}</button>
                </div>
              );
            })}
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: "#475569" }}>
              {rows.length > 0 ? `${rows.length} ${rows.length === 1 ? "color" : "colores"} · ${totalQty} un. · ${clp(totalAmt)}` : "Elige uno o más colores para cotizar"}
            </div>
            {rows.length > 0 && (
              <div style={{ fontSize: 11, fontWeight: 600, color: "#16a34a", marginTop: 2 }}>Desde {clp(fromPrice)} · Stock {stock}</div>
            )}
          </div>
          <button onClick={handleAdd} disabled={rows.length === 0} style={{ display: "flex", alignItems: "center", gap: 7, border: "none", fontFamily: FONT, fontSize: 14, fontWeight: 700, padding: "12px 18px", borderRadius: 12, whiteSpace: "nowrap", background: rows.length > 0 ? "#fd6301" : "#f1f5f9", color: rows.length > 0 ? "#fff" : "#cbd5e1", cursor: rows.length > 0 ? "pointer" : "not-allowed", boxShadow: rows.length > 0 ? "0 3px 10px rgba(253,99,1,.3)" : "none" }}>
            {Ic.cart(17)} {rows.length > 0 ? `Agregar ${rows.length} ${rows.length === 1 ? "color" : "colores"}` : "Selecciona un color"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default MultiColorProductCard;
