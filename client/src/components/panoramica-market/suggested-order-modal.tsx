import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Barcode, Loader2, Package, Plus, Minus, X, Zap,
  Check, Send, MessageSquare, ArrowRight, Image as ImageIcon,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getFormatQuantityRules } from "@shared/format-utils";

interface StoreFormatVariant {
  ecomId: string;
  sku: string;
  name: string;
  color: string;
  format: string;
  price: number | null;
  originalPrice?: number | null;
  offerPrice?: number | null;
  stock: number;
  minUnit: number;
  stepSize: number;
  imageUrl?: string | null;
}

interface StoreGenericProduct {
  genericName: string;
  imageUrl?: string | null;
  colors: { [color: string]: StoreFormatVariant[] };
}

interface StoreCatalogResponse {
  catalog: StoreGenericProduct[];
  totalProducts: number;
}

interface SuggestedItem {
  sku: string;
  productName: string;
  selectedColor: string;
  selectedPackaging: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  imageUrl?: string | null;
}

export interface SuggestedOrderTargetClient {
  clientName: string;
  clientCode?: string | null;
}

interface Props {
  open: boolean;
  client: SuggestedOrderTargetClient;
  onClose: () => void;
}

const formatPrice = (price: number | string | null | undefined): string => {
  if (!price || price === 0 || price === "0") return "";
  const numPrice = typeof price === "string" ? parseFloat(price) : price;
  if (isNaN(numPrice) || numPrice === 0) return "";
  return `$${new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 }).format(numPrice)}`;
};

export function SuggestedOrderModal({ open, client, onClose }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);

  const [skuSearch, setSkuSearch] = useState("");
  const [debouncedSku, setDebouncedSku] = useState("");
  const [skuQuantities, setSkuQuantities] = useState<Record<string, number>>({});
  const [items, setItems] = useState<SuggestedItem[]>([]);
  const [notes, setNotes] = useState("");
  const [showNotes, setShowNotes] = useState(false);

  // Resetear al abrir/cerrar para que cada apertura sea limpia
  useEffect(() => {
    if (open) {
      setSkuSearch("");
      setDebouncedSku("");
      setSkuQuantities({});
      setItems([]);
      setNotes("");
      setShowNotes(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSku(skuSearch.trim()), 200);
    return () => clearTimeout(t);
  }, [skuSearch]);

  const { data: searchResults, isLoading } = useQuery<StoreCatalogResponse>({
    queryKey: ["/api/store/products/grouped", debouncedSku, "suggested-modal"],
    queryFn: async () => {
      if (!debouncedSku) return { catalog: [], totalProducts: 0 };
      const params = new URLSearchParams();
      params.append("search", debouncedSku);
      const response = await fetch(`/api/store/products/grouped?${params.toString()}`, { credentials: "include" });
      if (!response.ok) throw new Error("Error al buscar");
      return response.json();
    },
    enabled: open && debouncedSku.length >= 2,
    staleTime: 15_000,
  });

  const matchedVariants = useMemo(() => {
    if (!searchResults?.catalog || !debouncedSku) return [];
    const searchUpper = debouncedSku.toUpperCase();
    const results: Array<{
      genericName: string;
      variant: StoreFormatVariant;
      imageUrl: string | null | undefined;
      isExactMatch: boolean;
    }> = [];

    searchResults.catalog.forEach((product) => {
      Object.values(product.colors).flat().forEach((variant) => {
        const skuUpper = (variant.sku || "").toUpperCase();
        const isExact = skuUpper === searchUpper;
        const isPartial = skuUpper.includes(searchUpper) || searchUpper.includes(skuUpper);
        if (isExact || isPartial) {
          results.push({
            genericName: product.genericName,
            variant,
            imageUrl: product.imageUrl,
            isExactMatch: isExact,
          });
        }
      });
    });
    return results
      .sort((a, b) => (a.isExactMatch === b.isExactMatch ? 0 : a.isExactMatch ? -1 : 1))
      .slice(0, 10);
  }, [searchResults, debouncedSku]);

  const handleAddVariant = (variant: StoreFormatVariant, genericName: string) => {
    const qty = skuQuantities[variant.sku] || variant.minUnit || 1;
    const basePrice = variant.price || 0;
    const effectivePrice = (variant.offerPrice && variant.offerPrice > 0) ? variant.offerPrice : basePrice;

    if (effectivePrice === 0) {
      toast({ title: "Sin precio", description: "Este producto no tiene precio disponible.", variant: "destructive" });
      return;
    }

    setItems((prev) => {
      // Reemplazar si ya existía (mismo SKU)
      const filtered = prev.filter((p) => p.sku !== variant.sku);
      return [
        ...filtered,
        {
          sku: variant.sku,
          productName: genericName,
          selectedColor: variant.color,
          selectedPackaging: variant.format,
          quantity: qty,
          unitPrice: effectivePrice,
          totalPrice: effectivePrice * qty,
          imageUrl: variant.imageUrl || null,
        },
      ];
    });
    setSkuQuantities({});
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const removeItem = (sku: string) => setItems((prev) => prev.filter((p) => p.sku !== sku));

  const subtotal = items.reduce((s, it) => s + it.totalPrice, 0);

  const sendMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        clientCode: client.clientCode || undefined,
        clientName: client.clientName,
        notes: notes.trim() || undefined,
        items: items.map((it) => ({
          productName: it.productName,
          sku: it.sku,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          totalPrice: it.totalPrice,
          selectedColor: it.selectedColor,
          selectedPackaging: it.selectedPackaging,
          imageUrl: it.imageUrl,
        })),
      };
      const res = await fetch("/api/ecommerce/orders/suggested", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message || "No se pudo enviar el sugerido");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "✓ Sugerido enviado", description: `${client.clientName} recibirá el correo en unos segundos.` });
      qc.invalidateQueries({ queryKey: ["/api/ecommerce/orders"] });
      onClose();
    },
    onError: (err: any) => {
      toast({ title: "Error al enviar el sugerido", description: err?.message, variant: "destructive" });
    },
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 mt-[5vh] md:mt-[8vh] max-h-[88vh] overflow-hidden flex flex-col animate-in slide-in-from-top-4 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-[#FF6E23] to-[#E55E13] px-5 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center flex-shrink-0">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="text-white font-bold text-lg truncate">Enviar pedido sugerido</h2>
              <p className="text-white/80 text-xs truncate">
                Cliente: <strong>{client.clientName}</strong>{client.clientCode ? ` · ${client.clientCode}` : ""}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors flex-shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 pt-4 pb-3 border-b border-gray-100 flex-shrink-0">
          <div className="relative">
            {skuSearch !== debouncedSku && debouncedSku ? (
              <div className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 border-2 border-[#FF6E23] border-t-transparent rounded-full animate-spin" />
            ) : (
              <Barcode className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            )}
            <input
              ref={inputRef}
              type="text"
              value={skuSearch}
              onChange={(e) => setSkuSearch(e.target.value.toUpperCase())}
              placeholder="Buscá por código SKU (ej: EP-001-BL-GL)"
              className="w-full pl-12 pr-24 py-3.5 text-base font-mono rounded-xl border-2 border-gray-200 focus:border-[#FF6E23] focus:ring-2 focus:ring-[#FF6E23]/10 bg-gray-50 hover:bg-white transition-all outline-none placeholder:text-gray-400 placeholder:font-sans"
              autoComplete="off"
              spellCheck={false}
            />
            {skuSearch && (
              <button
                onClick={() => { setSkuSearch(""); setSkuQuantities({}); inputRef.current?.focus(); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-700 transition-colors text-[11px] font-semibold"
              >
                <X className="h-3 w-3" /> Limpiar
              </button>
            )}
          </div>
          {debouncedSku && matchedVariants.length > 0 && (
            <p className="text-xs text-gray-400 mt-2 pl-1">
              {matchedVariants.length} resultado{matchedVariants.length !== 1 ? "s" : ""}
              {matchedVariants.some((m) => m.isExactMatch) && (
                <span className="text-emerald-600 font-semibold ml-1">• Coincidencia exacta</span>
              )}
            </p>
          )}
          <p className="text-[11px] text-gray-400 mt-2 pl-1">
            Los precios mostrados son referenciales. El sistema recalcula con la lista del cliente al enviar.
          </p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {!debouncedSku && items.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
              <div className="w-16 h-16 bg-orange-50 rounded-2xl flex items-center justify-center mb-4">
                <Barcode className="h-8 w-8 text-[#FF6E23]/50" />
              </div>
              <h3 className="text-base font-bold text-gray-800 mb-1">Buscá productos por SKU</h3>
              <p className="text-sm text-gray-500 max-w-xs">
                Agregá los productos que querés sugerirle al cliente. Cuando termines, hacé clic en "Enviar sugerido".
              </p>
              <div className="flex items-center gap-2 mt-5 text-xs text-gray-400">
                <span className="bg-gray-100 px-2.5 py-1 rounded-lg font-mono font-bold">SKU</span>
                <ArrowRight className="h-3 w-3" />
                <span className="bg-gray-100 px-2.5 py-1 rounded-lg">Cantidad</span>
                <ArrowRight className="h-3 w-3" />
                <span className="bg-orange-100 text-[#FF6E23] px-2.5 py-1 rounded-lg font-bold">Agregar</span>
              </div>
            </div>
          )}

          {isLoading && debouncedSku && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-[#FF6E23] mr-2" />
              <span className="text-sm text-gray-500">Buscando SKU...</span>
            </div>
          )}

          {!isLoading && debouncedSku && debouncedSku.length >= 2 && matchedVariants.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
              <Package className="h-10 w-10 text-gray-300 mb-3" />
              <h3 className="text-sm font-bold text-gray-700 mb-1">Sin resultados para "{debouncedSku}"</h3>
              <p className="text-xs text-gray-500">Verificá el código SKU e intentá de nuevo.</p>
            </div>
          )}

          {!isLoading && matchedVariants.length > 0 && (
            <div className="px-5 py-3 space-y-2.5">
              {matchedVariants.map(({ genericName, variant, imageUrl, isExactMatch }) => {
                const qty = skuQuantities[variant.sku] || 0;
                const effectivePrice = (variant.offerPrice && variant.offerPrice > 0) ? variant.offerPrice : (variant.price || 0);
                const hasOffer = variant.offerPrice && variant.offerPrice > 0 && variant.price && variant.price > variant.offerPrice;
                const rules = getFormatQuantityRules(variant.format);

                return (
                  <div
                    key={variant.sku}
                    className={`rounded-xl border-2 p-3.5 transition-all ${isExactMatch ? "border-[#FF6E23]/40 bg-orange-50/30 shadow-sm" : "border-gray-200 bg-white hover:border-gray-300"}`}
                  >
                    <div className="flex gap-3">
                      <div className="w-16 h-16 rounded-xl bg-gray-50 border border-gray-100 flex-shrink-0 overflow-hidden flex items-center justify-center">
                        {(variant.imageUrl || imageUrl) ? (
                          <img src={variant.imageUrl || imageUrl || ""} alt={genericName} className="w-full h-full object-contain p-1" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                        ) : (
                          <ImageIcon className="w-6 h-6 text-gray-200" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h4 className="text-sm font-bold text-gray-900 leading-tight truncate">{genericName}</h4>
                            <div className="flex flex-wrap items-center gap-1.5 mt-1">
                              <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${isExactMatch ? "bg-[#FF6E23]/10 text-[#FF6E23]" : "bg-gray-100 text-gray-600"}`}>{variant.sku}</span>
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{variant.format}</span>
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">{variant.color}</span>
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            {hasOffer ? (
                              <>
                                <span className="text-[10px] line-through text-gray-400 block">{formatPrice(variant.price)}</span>
                                <span className="text-sm font-black text-rose-600">{formatPrice(variant.offerPrice)}</span>
                              </>
                            ) : effectivePrice > 0 ? (
                              <span className="text-sm font-black text-[#FF6E23]">{formatPrice(effectivePrice)}</span>
                            ) : (
                              <span className="text-xs text-gray-400">Consultar</span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between mt-2.5 gap-2">
                          <span className="text-[9px] text-gray-400 font-medium">
                            {rules.minQuantity > 1 ? `Mín: ${rules.minQuantity} · Saltos de ${rules.stepQuantity}` : "Mín: 1 unidad"}
                          </span>
                          <div className="flex items-center gap-2">
                            {qty > 0 && effectivePrice > 0 && (
                              <span className="text-xs font-bold text-gray-500">{formatPrice(effectivePrice * qty)}</span>
                            )}
                            <div className="inline-flex items-center rounded-lg overflow-hidden border border-gray-200 bg-white shadow-sm h-8">
                              <button
                                onClick={() => setSkuQuantities((prev) => ({ ...prev, [variant.sku]: Math.max(0, (prev[variant.sku] || 0) - (variant.stepSize || rules.stepQuantity)) }))}
                                className="w-8 h-full flex items-center justify-center bg-gray-50 hover:bg-gray-100 text-gray-500 transition-colors"
                                disabled={qty === 0}
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <input
                                type="number"
                                value={qty || ""}
                                placeholder="0"
                                onChange={(e) => {
                                  const val = e.target.value === "" ? 0 : parseInt(e.target.value);
                                  if (!isNaN(val)) setSkuQuantities((prev) => ({ ...prev, [variant.sku]: Math.max(0, val) }));
                                }}
                                className="w-12 h-full text-center text-sm font-bold border-x border-gray-200 focus:outline-none focus:ring-1 focus:ring-inset focus:ring-[#FF6E23] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                min="0"
                                step={variant.stepSize || rules.stepQuantity}
                              />
                              <button
                                onClick={() => {
                                  const current = skuQuantities[variant.sku] || 0;
                                  const next = current === 0 ? (variant.minUnit || rules.minQuantity) : current + (variant.stepSize || rules.stepQuantity);
                                  setSkuQuantities((prev) => ({ ...prev, [variant.sku]: next }));
                                }}
                                className="w-8 h-full flex items-center justify-center bg-gray-50 hover:bg-gray-100 text-gray-500 transition-colors"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                            <button
                              onClick={() => handleAddVariant(variant, genericName)}
                              disabled={qty === 0 || effectivePrice === 0}
                              className="h-8 px-3 rounded-lg bg-[#FF6E23] hover:bg-[#E55E13] text-white text-xs font-bold transition-all shadow-sm hover:shadow disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
                            >
                              <Plus className="w-3 h-3" />
                              <span className="hidden sm:inline">Agregar</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Items agregados */}
          {items.length > 0 && (
            <div className="px-5 py-3 border-t border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  Productos en el sugerido ({items.length})
                </span>
                <span className="text-xs font-bold text-gray-700">Subtotal ref.: {formatPrice(subtotal)}</span>
              </div>
              <div className="space-y-1.5 max-h-[220px] overflow-y-auto">
                {items.map((it) => (
                  <div key={it.sku} className="flex items-center justify-between py-1.5 px-2.5 bg-emerald-50/50 rounded-lg border border-emerald-100/50 group">
                    <div className="flex items-center gap-2 min-w-0">
                      <Check className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-gray-800 truncate block">{it.productName}</span>
                        <span className="text-[10px] text-gray-500">
                          {it.sku} · {it.selectedColor} · {it.selectedPackaging} · x{it.quantity}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs font-bold text-emerald-700">{formatPrice(it.totalPrice)}</span>
                      <button
                        onClick={() => removeItem(it.sku)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-red-100 text-red-500"
                        title="Quitar"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Nota opcional */}
              <div className="mt-3">
                {!showNotes ? (
                  <button
                    onClick={() => setShowNotes(true)}
                    className="text-xs text-[#FF6E23] hover:text-[#E55E13] font-semibold flex items-center gap-1"
                  >
                    <MessageSquare className="h-3 w-3" />
                    Agregar nota para el cliente (opcional)
                  </button>
                ) : (
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                      Nota para el cliente
                    </label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={2}
                      placeholder="Ej: Te recomendamos estos productos según tu última compra…"
                      className="mt-1 w-full text-sm rounded-lg border border-gray-200 p-2 outline-none focus:border-[#FF6E23] focus:ring-2 focus:ring-[#FF6E23]/10"
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-5 py-3 flex items-center justify-between flex-shrink-0 bg-gray-50">
          <button
            onClick={onClose}
            className="text-sm text-gray-500 hover:text-gray-700 font-medium transition-colors"
            disabled={sendMutation.isPending}
          >
            Cancelar
          </button>
          <button
            onClick={() => sendMutation.mutate()}
            disabled={items.length === 0 || sendMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#FF6E23] hover:bg-[#E55E13] text-white text-sm font-bold transition-all shadow-lg shadow-orange-200/50 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
          >
            {sendMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Enviar sugerido ({items.length})
          </button>
        </div>
      </div>
    </div>
  );
}

export default SuggestedOrderModal;
