import { useState, useRef, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Mic, Square, Loader2, Plus, Minus, Trash2, Sparkles, User, Package, AlertCircle, Wand2,
} from "lucide-react";

// ─── Types ───
interface TierOption { key: string; label: string; price: number; }

interface ParsedIntentItem { productQuery: string; quantity: number; priceTier: string; }
interface ParsedIntent { clientQuery: string; notes: string; items: ParsedIntentItem[]; }

interface ResolvedClient { query: string; match: any | null; alternatives: any[]; }
interface ResolvedItem {
  query: string;
  quantity: number;
  requestedTier: string;
  product: any | null;
  alternatives: any[];
}
interface ParseResult {
  intent: ParsedIntent;
  client: ResolvedClient;
  items: ResolvedItem[];
  notes: string;
}

export interface VoiceOrderConfirmItem { product: any; quantity: number; tier: string; }
export interface VoiceOrderConfirmPayload {
  client: any | null;
  clientName: string;
  notes: string;
  items: VoiceOrderConfirmItem[];
}

interface VoiceOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  getAvailableTiers: (product: any) => TierOption[];
  onConfirm: (payload: VoiceOrderConfirmPayload) => void;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP" }).format(amount || 0);

// Resolves the effective tier + price for a product given the requested tier.
function effectiveTier(
  product: any,
  requestedTier: string,
  getAvailableTiers: (p: any) => TierOption[],
): { tiers: TierOption[]; option: TierOption | undefined } {
  const tiers = product ? getAvailableTiers(product) : [];
  const option = tiers.find((t) => t.key === requestedTier) || tiers[0];
  return { tiers, option };
}

export default function VoiceOrderDialog({ open, onOpenChange, getAvailableTiers, onConfirm }: VoiceOrderDialogProps) {
  const { toast } = useToast();
  const [instruction, setInstruction] = useState("");
  const [listening, setListening] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [draft, setDraft] = useState<ParseResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const SpeechRecognitionCtor =
    typeof window !== "undefined"
      ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      : undefined;
  const speechSupported = !!SpeechRecognitionCtor;

  // Reset when opened; stop recognition when closed
  useEffect(() => {
    if (open) {
      setInstruction("");
      setDraft(null);
      setError(null);
      setIsParsing(false);
    } else {
      try { recognitionRef.current?.stop(); } catch { /* noop */ }
      setListening(false);
    }
  }, [open]);

  useEffect(() => {
    return () => {
      try { recognitionRef.current?.stop(); } catch { /* noop */ }
    };
  }, []);

  // ─── Voice ───
  const startListening = useCallback(() => {
    if (!SpeechRecognitionCtor) return;
    const rec = new SpeechRecognitionCtor();
    rec.lang = "es-CL";
    rec.continuous = true;
    rec.interimResults = true;
    let baseText = instruction ? instruction.trim() + " " : "";

    rec.onresult = (event: any) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          baseText += transcript + " ";
        } else {
          interim += transcript;
        }
      }
      setInstruction((baseText + interim).replace(/\s+/g, " ").trimStart());
    };
    rec.onerror = (e: any) => {
      console.error("[voice] recognition error:", e?.error);
      setListening(false);
      if (e?.error === "not-allowed" || e?.error === "service-not-allowed") {
        toast({
          title: "Micrófono no disponible",
          description: "Permite el acceso al micrófono o escribe el pedido.",
          variant: "destructive",
        });
      }
    };
    rec.onend = () => setListening(false);

    recognitionRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  }, [SpeechRecognitionCtor, instruction, toast]);

  const stopListening = useCallback(() => {
    try { recognitionRef.current?.stop(); } catch { /* noop */ }
    setListening(false);
  }, []);

  // ─── Parse / refine ───
  const buildCurrentIntent = (): ParsedIntent | null => {
    if (!draft) return null;
    return {
      clientQuery: draft.client.match ? (draft.client.match.nokoen || draft.client.query) : draft.client.query,
      notes: draft.notes || "",
      items: draft.items.map((it) => ({
        productQuery: it.product ? (it.product.producto || it.query) : it.query,
        quantity: it.quantity,
        priceTier: it.requestedTier || "",
      })),
    };
  };

  const handleApply = async () => {
    const text = instruction.trim();
    if (!text) return;
    if (listening) stopListening();
    setIsParsing(true);
    setError(null);
    try {
      const res = await apiRequest("/api/tomador/parse-order", {
        method: "POST",
        data: { text, currentIntent: buildCurrentIntent() },
      });
      const data: ParseResult = await res.json();
      setDraft(data);
      setInstruction("");
      if (data.items.length === 0 && !data.client.match) {
        setError("No se pudo identificar el cliente ni los productos. Intenta reformular el pedido.");
      }
    } catch (e: any) {
      console.error("[voice-order] parse error:", e);
      setError(e?.message || "No se pudo interpretar el pedido.");
    } finally {
      setIsParsing(false);
    }
  };

  // ─── Manual draft edits ───
  const updateItem = (index: number, patch: Partial<ResolvedItem>) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const items = prev.items.map((it, i) => (i === index ? { ...it, ...patch } : it));
      return { ...prev, items };
    });
  };

  const removeItem = (index: number) => {
    setDraft((prev) => {
      if (!prev) return prev;
      return { ...prev, items: prev.items.filter((_, i) => i !== index) };
    });
  };

  const selectAlternativeProduct = (index: number, codigo: string) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const items = prev.items.map((it, i) => {
        if (i !== index) return it;
        const product = it.alternatives.find((p) => p.codigo === codigo) || it.product;
        return { ...it, product };
      });
      return { ...prev, items };
    });
  };

  const selectAlternativeClient = (rten: string) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const match = prev.client.alternatives.find((c) => (c.rten || c.id) === rten) || prev.client.match;
      return { ...prev, client: { ...prev.client, match } };
    });
  };

  // ─── Totals ───
  const resolvedItems = (draft?.items || []).filter((it) => it.product);
  const subtotal = resolvedItems.reduce((sum, it) => {
    const { option } = effectiveTier(it.product, it.requestedTier, getAvailableTiers);
    return sum + (option?.price || 0) * it.quantity;
  }, 0);

  const handleConfirm = () => {
    if (!draft) return;
    const items: VoiceOrderConfirmItem[] = resolvedItems.map((it) => {
      const { option } = effectiveTier(it.product, it.requestedTier, getAvailableTiers);
      return { product: it.product, quantity: it.quantity, tier: option?.key || "lista" };
    });
    if (items.length === 0) {
      toast({ title: "Sin productos", description: "Agrega al menos un producto reconocido.", variant: "destructive" });
      return;
    }
    onConfirm({
      client: draft.client.match,
      clientName: draft.client.match?.nokoen || draft.client.query || "",
      notes: draft.notes || "",
      items,
    });
    onOpenChange(false);
  };

  const exampleText = "Ej: presupuesto para Terrandina, dos stain a precio mix, un latex a precio lista";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-voice-order">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-[#fd6301] flex items-center justify-center border border-orange-100 shadow-md shadow-[#fd6301]/25">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            Presupuesto por Voz o Texto
          </DialogTitle>
          <DialogDescription>
            Dicta o escribe el pedido en lenguaje natural. El sistema reconoce el cliente, los productos y la lista de precio.
          </DialogDescription>
        </DialogHeader>

        {/* Input area */}
        <div className="space-y-2">
          <div className="relative">
            <Textarea
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder={exampleText}
              rows={3}
              className="resize-none pr-12"
              data-testid="input-voice-instruction"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  handleApply();
                }
              }}
            />
            {speechSupported && (
              <Button
                type="button"
                size="icon"
                variant={listening ? "destructive" : "outline"}
                onClick={listening ? stopListening : startListening}
                className="absolute top-2 right-2 h-8 w-8"
                data-testid="button-voice-mic"
                title={listening ? "Detener" : "Dictar"}
              >
                {listening ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </Button>
            )}
          </div>

          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              {listening ? (
                <span className="flex items-center gap-1.5 text-red-600 font-medium">
                  <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" /> Escuchando…
                </span>
              ) : speechSupported ? (
                draft ? "Agrega una corrección y aplícala (ej: \"el latex que sean 3\")." : "Presiona el micrófono para dictar o escribe el pedido."
              ) : (
                "El dictado por voz no está disponible en este navegador; escribe el pedido."
              )}
            </p>
            <Button
              onClick={handleApply}
              disabled={!instruction.trim() || isParsing}
              className="bg-orange-600 hover:bg-orange-700 text-white shrink-0"
              size="sm"
              data-testid="button-voice-apply"
            >
              {isParsing ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Wand2 className="h-4 w-4 mr-1.5" />}
              {draft ? "Aplicar" : "Interpretar"}
            </Button>
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Draft preview */}
        {draft && (
          <div className="space-y-3 border-t pt-3">
            {/* Client */}
            <div className="rounded-lg border p-3">
              <div className="flex items-center gap-2 mb-2">
                <User className="h-4 w-4 text-slate-500" />
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Cliente</span>
              </div>
              {draft.client.match ? (
                <div className="space-y-1">
                  <div className="font-medium text-slate-800">{draft.client.match.nokoen}</div>
                  {draft.client.match.rten && (
                    <div className="text-xs text-slate-500">RUT: {draft.client.match.rten}</div>
                  )}
                  {draft.client.alternatives.length > 1 && (
                    <Select
                      value={(draft.client.match.rten || draft.client.match.id) as string}
                      onValueChange={selectAlternativeClient}
                    >
                      <SelectTrigger className="h-8 mt-1 text-xs" data-testid="select-voice-client-alt">
                        <SelectValue placeholder="Cambiar cliente" />
                      </SelectTrigger>
                      <SelectContent>
                        {draft.client.alternatives.map((c, idx) => (
                          <SelectItem key={(c.rten || c.id || idx) as string} value={(c.rten || c.id) as string}>
                            {c.nokoen}{c.rten ? ` · ${c.rten}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              ) : (
                <div className="text-sm text-amber-700">
                  No se encontró cliente para <strong>"{draft.client.query}"</strong>.
                  {draft.client.query && " Se usará el nombre tal cual; podrás corregirlo en el constructor."}
                </div>
              )}
            </div>

            {/* Items */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-slate-500" />
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Productos ({draft.items.length})
                </span>
              </div>

              {draft.items.length === 0 && (
                <p className="text-sm text-slate-500 italic">No se reconocieron productos.</p>
              )}

              {draft.items.map((it, index) => {
                const { tiers, option } = effectiveTier(it.product, it.requestedTier, getAvailableTiers);
                const lineTotal = (option?.price || 0) * it.quantity;
                return (
                  <div
                    key={index}
                    className="rounded-lg border p-3 space-y-2"
                    data-testid={`voice-item-${index}`}
                  >
                    {it.product ? (
                      <>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-medium text-slate-800 text-sm leading-tight">
                              {it.product.producto}
                            </div>
                            <div className="text-xs text-slate-500 mt-0.5">
                              {it.product.codigo}{it.product.unidad ? ` · ${it.product.unidad}` : ""}
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-slate-400 hover:text-red-600 shrink-0"
                            onClick={() => removeItem(index)}
                            data-testid={`button-voice-remove-${index}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          {/* Quantity */}
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => updateItem(index, { quantity: Math.max(1, it.quantity - 1) })}
                              data-testid={`button-voice-qty-dec-${index}`}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <Input
                              type="number"
                              min={1}
                              max={99999}
                              value={it.quantity}
                              onChange={(e) =>
                                updateItem(index, {
                                  quantity: Math.min(99999, Math.max(1, parseInt(e.target.value) || 1)),
                                })
                              }
                              className="h-8 w-16 text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              data-testid={`input-voice-qty-${index}`}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => updateItem(index, { quantity: Math.min(99999, it.quantity + 1) })}
                              data-testid={`button-voice-qty-inc-${index}`}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>

                          {/* Tier */}
                          <Select
                            value={option?.key || ""}
                            onValueChange={(v) => updateItem(index, { requestedTier: v })}
                            disabled={tiers.length === 0}
                          >
                            <SelectTrigger className="h-8 w-[140px] text-xs" data-testid={`select-voice-tier-${index}`}>
                              <SelectValue placeholder="Lista de precio" />
                            </SelectTrigger>
                            <SelectContent>
                              {tiers.map((t) => (
                                <SelectItem key={t.key} value={t.key}>
                                  {t.label} · {formatCurrency(t.price)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          <div className="ml-auto text-right">
                            <div className="text-xs text-slate-400">{formatCurrency(option?.price || 0)} c/u</div>
                            <div className="font-semibold text-green-600">{formatCurrency(lineTotal)}</div>
                          </div>
                        </div>

                        {/* Alternatives */}
                        {it.alternatives.length > 1 && (
                          <Select
                            value={it.product.codigo}
                            onValueChange={(v) => selectAlternativeProduct(index, v)}
                          >
                            <SelectTrigger className="h-8 text-xs" data-testid={`select-voice-product-alt-${index}`}>
                              <SelectValue placeholder="Cambiar producto" />
                            </SelectTrigger>
                            <SelectContent>
                              {it.alternatives.map((p, altIdx) => (
                                <SelectItem key={(p.codigo || altIdx) as string} value={p.codigo}>
                                  {p.producto}{p.unidad ? ` · ${p.unidad}` : ""}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </>
                    ) : (
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm text-amber-700">
                          No se encontró producto para <strong>"{it.query}"</strong>
                          <span className="text-slate-500"> (cantidad {it.quantity})</span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-slate-400 hover:text-red-600 shrink-0"
                          onClick={() => removeItem(index)}
                          data-testid={`button-voice-remove-${index}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {draft.notes && (
              <div className="rounded-lg border p-3 text-sm">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Notas: </span>
                <span className="text-slate-700">{draft.notes}</span>
              </div>
            )}

            {/* Subtotal */}
            {resolvedItems.length > 0 && (
              <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                <span className="text-sm text-slate-600">Subtotal neto ({resolvedItems.length} ítems)</span>
                <span className="font-semibold text-slate-800">{formatCurrency(subtotal)}</span>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t pt-3">
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-voice-cancel">
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!draft || resolvedItems.length === 0}
            className="bg-orange-600 hover:bg-orange-700 text-white"
            data-testid="button-voice-create-quote"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Crear Presupuesto
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
