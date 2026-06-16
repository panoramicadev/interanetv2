import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Minus, Plus, X, ShoppingCart, Check } from "lucide-react";

// === Tipos (estructuralmente compatibles con grouped-catalog) ===
export interface FormatVariant {
  sku: string;
  name: string;
  color: string;
  format: string;
  price: string | null;
  priceList: string | null;
  stock: number;
}
export interface GenericProduct {
  genericName: string;
  breveResena: string | null;
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

// === Helpers de color ===
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
const isDark = (c: string) => ["Negro", "Rojo", "Gris"].includes(c);
const clp = (n: number) => "$" + Math.round(n).toLocaleString("es-CL");

/**
 * Fallback de tramos: SOLO se usa si no se pasa `getAvailableTiers`.
 * En producción, pasa la función real del carrito como prop.
 */
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

export interface MultiColorProductCardProps {
  product: GenericProduct;
  /** La MISMA función de tramos que usa el carrito actual. */
  getAvailableTiers?: (v: FormatVariant) => PriceTier[];
  /** Recibe todas las líneas (una por color) al presionar Agregar. */
  onAdd: (lines: AddedLine[]) => void;
}

export function MultiColorProductCard({
  product,
  getAvailableTiers = defaultTiers,
  onAdd,
}: MultiColorProductCardProps) {
  const colors = useMemo(() => Object.keys(product.colors), [product]);

  // Envase = uno por tarjeta (define SKU + precio base)
  const allFormats = useMemo(() => {
    const s = new Set<string>();
    colors.forEach((c) =>
      product.colors[c].forEach((v) => v.format && s.add(v.format))
    );
    return Array.from(s);
  }, [product, colors]);
  const [format, setFormat] = useState(allFormats[0] ?? "");

  // 🔑 Multiselección: color → { tier, qty }
  const [selected, setSelected] = useState<Record<string, SelectedLine>>({});

  const resolve = (color: string): FormatVariant =>
    product.colors[color]?.find((v) => v.format === format) ??
    product.colors[color]?.[0];

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
    setSelected((p) => ({
      ...p,
      [color]: { ...p[color], qty: Math.max(1, p[color].qty + d) },
    }));

  const rows = colors.filter((c) => selected[c]);

  const tiersFor = (color: string): PriceTier[] => {
    const v = resolve(color);
    return v ? getAvailableTiers(v) : [];
  };

  const priceOf = (color: string) => {
    const tiers = tiersFor(color);
    const v = resolve(color);
    return (
      tiers.find((t) => t.key === selected[color].tier)?.price ??
      tiers[0]?.price ??
      Number(v?.price ?? 0)
    );
  };

  const totalQty = rows.reduce((n, c) => n + selected[c].qty, 0);
  const totalAmt = rows.reduce((n, c) => n + priceOf(c) * selected[c].qty, 0);

  const handleAdd = () => {
    if (rows.length === 0) return;
    const lines: AddedLine[] = rows.map((color) => {
      const v = resolve(color);
      const tiers = getAvailableTiers(v);
      const tier =
        tiers.find((t) => t.key === selected[color].tier) ??
        tiers[0] ?? { key: "lista", label: "Lista", price: Number(v?.price ?? 0) };
      return { variant: v, tier, qty: selected[color].qty };
    });
    onAdd(lines);
    setSelected({}); // limpia la tarjeta tras agregar
  };

  return (
    <div className="border rounded-2xl p-4">
      {/* Encabezado */}
      <div className="flex items-start gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-base leading-tight">
            {product.genericName}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {colors.length} colores · {allFormats.length} formatos
          </p>
        </div>
      </div>

      {/* Envase */}
      <div className="mb-3">
        <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-1.5">
          Envase
        </div>
        <div className="flex gap-2 flex-wrap">
          {allFormats.map((f) => (
            <Button
              key={f}
              size="sm"
              variant={f === format ? "default" : "outline"}
              className={f === format ? "bg-orange-500 hover:bg-orange-600" : ""}
              onClick={() => setFormat(f)}
            >
              {f}
            </Button>
          ))}
        </div>
      </div>

      {/* Color — multiselección */}
      <div className="mb-3">
        <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-1.5">
          Color · <span className="normal-case font-medium">elige uno o más</span>
        </div>
        <div className="flex gap-2 flex-wrap">
          {colors.map((c) => {
            const active = !!selected[c];
            return (
              <button
                key={c}
                title={c}
                onClick={() => toggleColor(c)}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition ${
                  active
                    ? "ring-2 ring-orange-500 ring-offset-2"
                    : "ring-1 ring-black/10"
                }`}
                style={{ background: colorHex(c) }}
              >
                {active && (
                  <Check
                    className="h-4 w-4"
                    style={{ color: isDark(c) ? "#fff" : "#0f172a" }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Una fila por color: precio + cantidad */}
      <div className="pt-3 border-t border-dashed">
        {rows.length > 0 && (
          <div className="flex flex-col gap-2 mb-3">
            {rows.map((color) => {
              const tiers = tiersFor(color);
              return (
                <div
                  key={color}
                  className="flex items-center gap-2 bg-muted/40 border rounded-xl px-3 py-2"
                >
                  <span
                    className="w-5 h-5 rounded-full ring-1 ring-black/10 shrink-0"
                    style={{ background: colorHex(color) }}
                  />
                  <span className="text-sm font-semibold min-w-[70px]">
                    {color}
                  </span>
                  <Select
                    value={selected[color].tier}
                    onValueChange={(t) => setTier(color, t)}
                  >
                    <SelectTrigger className="flex-1 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {tiers.map((t) => (
                        <SelectItem key={t.key} value={t.key}>
                          {t.label}: {clp(t.price)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-7 w-7"
                      onClick={() => bumpQty(color, -1)}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="text-sm font-bold w-5 text-center">
                      {selected[color].qty}
                    </span>
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-7 w-7"
                      onClick={() => bumpQty(color, 1)}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                  <span className="text-sm font-bold min-w-[80px] text-right">
                    {clp(priceOf(color) * selected[color].qty)}
                  </span>
                  <button
                    onClick={() => toggleColor(color)}
                    className="text-muted-foreground hover:text-red-500"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="text-xs font-semibold text-muted-foreground">
            {rows.length > 0
              ? `${rows.length} ${rows.length === 1 ? "color" : "colores"} · ${totalQty} un. · ${clp(totalAmt)}`
              : "Elige uno o más colores para cotizar"}
          </div>
          <Button
            onClick={handleAdd}
            disabled={rows.length === 0}
            className="gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50"
          >
            <ShoppingCart className="h-4 w-4" />
            {rows.length > 0
              ? `Agregar ${rows.length} ${rows.length === 1 ? "color" : "colores"}`
              : "Selecciona un color"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default MultiColorProductCard;
