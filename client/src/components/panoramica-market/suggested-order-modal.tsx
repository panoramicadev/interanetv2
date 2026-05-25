import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Barcode, Loader2, Package, Plus, Minus, X, Zap,
  Check, Send, MessageSquare, ArrowRight, ArrowLeft, Image as ImageIcon,
  Sparkles, Wrench, AlertCircle, ShoppingCart, Trash2, Mail, FileText, Users, CreditCard,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { getFormatQuantityRules } from "@shared/format-utils";
import SuggestedOrderPayment, { type SuggestedPaymentValue } from "@/components/panoramica-market/suggested-order-payment";

const PRESET_EMAIL_CONTACTS = [
  { name: "Jefferson", email: "jperdomo@pinturaspanoramica.cl" },
  { name: "Carolina", email: "yfernandez@pinturaspanoramica.cl" },
  { name: "Franco", email: "fparra@pinturaspanoramica.cl" },
  { name: "Oscar", email: "storeconcepcion@pinturaspanoramica.cl" },
  { name: "Carlos", email: "cmelgarejo@pinturaspanoramica.cl" },
  { name: "Joaquin", email: "jsaiz@pinturaspanoramica.cl" },
];

// Roles que pueden fijar o cambiar el precio (lista) de cada línea. Un cliente que
// modifica su propio sugerido NO puede: sólo ajusta cantidades, agrega/quita SKUs y notas.
const PRICE_EDIT_ROLES = new Set(["admin", "supervisor", "encargado_area", "salesperson"]);

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

// ───────────────────────────────────────────────────────────────
// Tiers de precio (mismos del tomador). El backend respeta el
// priceTier que mandamos; si el tier no está disponible para ese
// SKU, cae a la lista del cliente y genera una warning.
// ───────────────────────────────────────────────────────────────
type PriceTier =
  | "lista"
  | "desc10"
  | "desc10_5"
  | "desc10_5_3"
  | "minimo"
  | "canalDigital"
  | "mix"
  | "oferta";

interface PriceTierOption {
  key: PriceTier;
  label: string;
  price: number;
}

const TIER_LABELS: Record<PriceTier, string> = {
  lista: "Lista",
  desc10: "10%",
  desc10_5: "10%+5%",
  desc10_5_3: "10%+5%+3%",
  minimo: "Mínimo",
  canalDigital: "Digital",
  mix: "Mix",
  oferta: "Oferta",
};

interface PriceListRow {
  codigo: string;
  producto?: string;
  unidad?: string | null;
  lista?: string | number | null;
  desc10?: string | number | null;
  desc10_5?: string | number | null;
  desc10_5_3?: string | number | null;
  minimo?: string | number | null;
  canalDigital?: string | number | null;
  offerPrice?: string | number | null;
}

const parsePrice = (v: string | number | null | undefined): number => {
  if (v == null) return 0;
  const n = typeof v === "string" ? parseFloat(v) : v;
  return isNaN(n) ? 0 : n;
};

const buildTiersFromPriceList = (
  row: PriceListRow,
  mixPrice: number | undefined,
): PriceTierOption[] => {
  const out: PriceTierOption[] = [];
  let lista = parsePrice(row.lista);
  if (!(lista > 0)) {
    const d10 = parsePrice(row.desc10);
    if (d10 > 0) lista = Math.round(d10 / 0.9);
  }
  const candidates: Array<[PriceTier, number]> = [
    ["lista", lista],
    ["desc10", parsePrice(row.desc10)],
    ["desc10_5", parsePrice(row.desc10_5)],
    ["desc10_5_3", parsePrice(row.desc10_5_3)],
    ["minimo", parsePrice(row.minimo)],
    ["canalDigital", parsePrice(row.canalDigital)],
    ["mix", mixPrice && mixPrice > 0 ? mixPrice : 0],
    ["oferta", parsePrice(row.offerPrice)],
  ];
  for (const [key, price] of candidates) {
    if (price > 0) out.push({ key, label: TIER_LABELS[key], price });
  }
  return out;
};

interface SuggestedItem {
  id: string;
  type: "standard" | "custom";
  productName: string;
  // Standard fields
  sku?: string;
  selectedColor?: string;
  selectedPackaging?: string;
  imageUrl?: string | null;
  // Tier control
  priceTier?: PriceTier;
  tierPrices?: PriceTierOption[];
  // Quantities & pricing
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  // Custom-only
  customSku?: string;
  productUnit?: string;
  productColor?: string;
  costOfProduction?: number;
  profitMargin?: number;
  pricingMode?: "calculated" | "direct";
}

export interface SuggestedOrderTargetClient {
  clientName: string;
  clientCode?: string | null;
}

export interface SuggestedOrderToModify {
  id: string;
  items?: any[] | string;
  notes?: string | null;
  clientName?: string;
}

interface Props {
  open: boolean;
  client: SuggestedOrderTargetClient;
  onClose: () => void;
  /**
   * 'create' (default): admin/vendedor arma un sugerido y lo envía (POST + correos).
   * 'modify': el propio cliente reabre su sugerido en el mismo builder, ajusta lo que
   *  quiera y lo reenvía a revisión vía PATCH (sin paso de destinatarios/correo).
   */
  mode?: "create" | "modify";
  existingOrder?: SuggestedOrderToModify | null;
}

interface CustomProductForm {
  productName: string;
  sku: string;
  pricingMode: "calculated" | "direct";
  costOfProduction: number;
  profitMargin: number;
  directPrice: number;
  quantity: number;
  unit: string;
  color: string;
}

const INITIAL_CUSTOM: CustomProductForm = {
  productName: "",
  sku: "",
  pricingMode: "direct",
  costOfProduction: 0,
  profitMargin: 55,
  directPrice: 0,
  quantity: 1,
  unit: "Unidad",
  color: "",
};

const formatPrice = (price: number | string | null | undefined): string => {
  if (!price || price === 0 || price === "0") return "";
  const numPrice = typeof price === "string" ? parseFloat(price) : price;
  if (isNaN(numPrice) || numPrice === 0) return "";
  return `$${new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 }).format(numPrice)}`;
};

const TIER_LABEL = (t?: string): string => (t && (TIER_LABELS as any)[t]) || "Lista";

// Mapea un ítem ya persistido (sugerido existente) al shape interno del builder.
const mapOrderItemToSuggested = (it: any, idx: number): SuggestedItem => {
  const isCustom = it?.type === "custom";
  const unitPrice = Number(it?.unitPrice ?? it?.price ?? 0) || 0;
  const quantity = Number(it?.quantity ?? 0) || 1;
  const tier = (it?.priceTier as PriceTier) || "lista";
  return {
    id: `pre-${idx}-${it?.sku || it?.customSku || it?.productName || "item"}`,
    type: isCustom ? "custom" : "standard",
    productName: it?.productName || it?.name || "Producto",
    sku: it?.sku || it?.productCode || undefined,
    selectedColor: it?.selectedColor || undefined,
    selectedPackaging: it?.selectedPackaging || undefined,
    imageUrl: it?.imageUrl ?? null,
    priceTier: isCustom ? undefined : tier,
    tierPrices: isCustom ? undefined : [{ key: tier, label: TIER_LABEL(tier), price: unitPrice }],
    quantity,
    unitPrice,
    totalPrice: Number(it?.totalPrice ?? unitPrice * quantity) || unitPrice * quantity,
    customSku: it?.customSku || undefined,
    productUnit: it?.productUnit || undefined,
    productColor: it?.productColor || undefined,
    costOfProduction: it?.costOfProduction,
    profitMargin: it?.profitMargin,
    pricingMode: it?.pricingMode,
  };
};

export function SuggestedOrderModal({ open, client, onClose, mode = "create", existingOrder = null }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const isModify = mode === "modify";
  // Sólo el equipo comercial puede elegir/cambiar la lista de precio. El cliente que
  // reabre su sugerido (modify) ve precios fijos y no puede agregar productos personalizados.
  const canEditPrice = PRICE_EDIT_ROLES.has((user?.role || "").toString());

  const [skuSearch, setSkuSearch] = useState("");
  const [debouncedSku, setDebouncedSku] = useState("");
  const [skuQuantities, setSkuQuantities] = useState<Record<string, number>>({});
  const [items, setItems] = useState<SuggestedItem[]>([]);
  const [notes, setNotes] = useState("");
  const [showNotes, setShowNotes] = useState(false);
  const [resolvingSku, setResolvingSku] = useState<string | null>(null);

  // Producto personalizado
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customForm, setCustomForm] = useState<CustomProductForm>(INITIAL_CUSTOM);

  // Flujo de pasos:
  //  - create (equipo): armar (build) → revisar PDF + destinatarios (review)
  //  - modify (cliente): armar (build) → pago (pay): forma de pago + OC, igual que el checkout
  const [step, setStep] = useState<"build" | "review" | "pay">("build");
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [teamRecipient, setTeamRecipient] = useState("");
  const [teamCc, setTeamCc] = useState("");
  const [teamMessage, setTeamMessage] = useState("");
  // Checkout del sugerido modificado (solo modo cliente).
  const [payment, setPayment] = useState<SuggestedPaymentValue>({ paymentMethod: "transfer", purchaseOrderPdfUrl: null, purchaseOrderFileName: null });
  const [payValid, setPayValid] = useState(true);

  useEffect(() => {
    if (open) {
      setSkuSearch("");
      setDebouncedSku("");
      setSkuQuantities({});
      setShowNotes(false);
      setShowCustomModal(false);
      setCustomForm(INITIAL_CUSTOM);
      setStep("build");
      setPdfUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return null; });
      setTeamRecipient(user?.email || "");
      setTeamCc("");
      setTeamMessage("");
      setPayment({ paymentMethod: "transfer", purchaseOrderPdfUrl: null, purchaseOrderFileName: null });
      setPayValid(true);

      if (isModify && existingOrder) {
        const raw = typeof existingOrder.items === "string"
          ? (() => { try { return JSON.parse(existingOrder.items as string); } catch { return []; } })()
          : (existingOrder.items || []);
        const preloaded = (Array.isArray(raw) ? raw : []).map(mapOrderItemToSuggested);
        setItems(preloaded);
        setNotes(existingOrder.notes || "");
        setShowNotes(!!existingOrder.notes);
        // Enriquecemos los tiers reales de cada SKU en segundo plano para que el
        // selector de lista de precio quede usable (igual que al agregar un producto).
        preloaded.forEach((it) => {
          if (it.type !== "standard" || !it.sku) return;
          fetchTiersForSku(it.sku).then((tiers) => {
            if (!tiers || tiers.length === 0) return;
            setItems((prev) => prev.map((p) => {
              if (p.id !== it.id) return p;
              const stillExists = tiers.find((t) => t.key === p.priceTier);
              const chosen = stillExists || tiers[0];
              return { ...p, tierPrices: tiers, priceTier: chosen.key, unitPrice: chosen.price, totalPrice: chosen.price * p.quantity };
            }));
          }).catch(() => { /* el ítem queda con el precio original */ });
        });
      } else {
        setItems([]);
        setNotes("");
      }
      setTimeout(() => inputRef.current?.focus(), 100);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user?.email, isModify, existingOrder?.id]);

  // Libera el blob URL del PDF al desmontar.
  useEffect(() => () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl); }, [pdfUrl]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSku(skuSearch.trim()), 200);
    return () => clearTimeout(t);
  }, [skuSearch]);

  // Búsqueda de catálogo (igual que antes — UI rica con color/format/stock)
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
      const variants = Object.values(product.colors).flat();
      // Variantes cuyo código SKU coincide con lo buscado.
      const skuMatches = variants.filter((variant) => {
        const skuUpper = (variant.sku || "").toUpperCase();
        return skuUpper === searchUpper || skuUpper.includes(searchUpper) || searchUpper.includes(skuUpper);
      });

      if (skuMatches.length > 0) {
        // Búsqueda por código: mostramos solo las variantes cuyo SKU coincide.
        skuMatches.forEach((variant) => {
          results.push({
            genericName: product.genericName,
            variant,
            imageUrl: product.imageUrl,
            isExactMatch: (variant.sku || "").toUpperCase() === searchUpper,
          });
        });
      } else {
        // El backend ya filtró por nombre/categoría/descripción/tags: si el producto
        // llegó hasta acá pero ningún SKU coincide, fue una coincidencia por texto →
        // mostramos todas sus variantes para que el usuario pueda elegir.
        variants.forEach((variant) => {
          results.push({
            genericName: product.genericName,
            variant,
            imageUrl: product.imageUrl,
            isExactMatch: false,
          });
        });
      }
    });
    return results
      .sort((a, b) => (a.isExactMatch === b.isExactMatch ? 0 : a.isExactMatch ? -1 : 1))
      .slice(0, 40);
  }, [searchResults, debouncedSku]);

  // Resuelve los tiers reales de un SKU consultando price_list + price_list_mix.
  // Cachea en queryClient para no re-pedir el mismo código.
  // `extraOfferPrice` viene del catálogo de tienda y se usa para sembrar el tier
  // 'oferta' cuando la oferta vive solo en price_list_offers (no en price_list.offer_price).
  const fetchTiersForSku = async (sku: string, extraOfferPrice?: number): Promise<PriceTierOption[]> => {
    const cached = qc.getQueryData<PriceTierOption[]>(["price-list-tiers", sku]);
    if (cached && !extraOfferPrice) return cached;

    const [plRes, mixRes] = await Promise.all([
      fetch(`/api/price-list?search=${encodeURIComponent(sku)}&limit=10`, { credentials: "include" }),
      fetch(`/api/price-list-mix?search=${encodeURIComponent(sku)}&limit=10`, { credentials: "include" }),
    ]);

    let tiers: PriceTierOption[] = [];
    if (plRes.ok) {
      const data = await plRes.json();
      const product: PriceListRow | undefined = (data.items || []).find(
        (p: PriceListRow) => (p.codigo || "").toUpperCase() === sku.toUpperCase(),
      );
      let mixPrice = 0;
      if (mixRes.ok) {
        const mixData = await mixRes.json();
        const mixRow = (mixData.items || mixData || []).find(
          (m: any) => (m.codigo || "").toUpperCase() === sku.toUpperCase(),
        );
        if (mixRow) mixPrice = parsePrice(mixRow.precio);
      }
      if (product) {
        tiers = buildTiersFromPriceList(product, mixPrice);
      }
    }

    // Sembrar 'oferta' desde el catálogo de tienda (price_list_offers) si no vino en price_list.
    if (extraOfferPrice && extraOfferPrice > 0 && !tiers.find((t) => t.key === "oferta")) {
      tiers.push({ key: "oferta", label: TIER_LABELS.oferta, price: extraOfferPrice });
    }

    qc.setQueryData(["price-list-tiers", sku], tiers);
    return tiers;
  };

  const handleAddVariant = async (variant: StoreFormatVariant, genericName: string) => {
    const qty = skuQuantities[variant.sku] || variant.minUnit || 1;

    // Precio inicial: oferta del catálogo si la hay, sino lista.
    const basePrice = variant.price || 0;
    const initialPrice = (variant.offerPrice && variant.offerPrice > 0) ? variant.offerPrice : basePrice;

    if (initialPrice === 0) {
      toast({ title: "Sin precio", description: "Este producto no tiene precio disponible.", variant: "destructive" });
      return;
    }

    // Pre-carga: agregamos con tier "lista" + el precio que ya teníamos del catálogo,
    // y en paralelo buscamos los tiers reales para enriquecer el selector.
    const initialTier: PriceTier = (variant.offerPrice && variant.offerPrice > 0) ? "oferta" : "lista";
    const placeholderTiers: PriceTierOption[] = [{ key: initialTier, label: TIER_LABELS[initialTier], price: initialPrice }];

    setItems((prev) => {
      const filtered = prev.filter((p) => !(p.type === "standard" && p.sku === variant.sku));
      return [
        ...filtered,
        {
          id: `std-${variant.sku}-${Date.now()}`,
          type: "standard",
          productName: genericName,
          sku: variant.sku,
          selectedColor: variant.color,
          selectedPackaging: variant.format,
          quantity: qty,
          unitPrice: initialPrice,
          totalPrice: initialPrice * qty,
          imageUrl: variant.imageUrl || null,
          priceTier: initialTier,
          tierPrices: placeholderTiers,
        },
      ];
    });
    setSkuQuantities({});
    setTimeout(() => inputRef.current?.focus(), 50);

    // Enriquecer tiers en background
    try {
      setResolvingSku(variant.sku);
      const tiers = await fetchTiersForSku(variant.sku, variant.offerPrice || undefined);
      if (tiers.length > 0) {
        setItems((prev) => prev.map((p) => {
          if (p.type !== "standard" || p.sku !== variant.sku) return p;
          // Mantenemos el tier elegido si todavía existe; sino caemos al primero disponible.
          const stillExists = tiers.find((t) => t.key === p.priceTier);
          const chosen = stillExists || tiers[0];
          const newUnit = chosen.price;
          return { ...p, tierPrices: tiers, priceTier: chosen.key, unitPrice: newUnit, totalPrice: newUnit * p.quantity };
        }));
      }
    } catch (_) {
      // sin tiers extra, el ítem queda con lista del catálogo
    } finally {
      setResolvingSku(null);
    }
  };

  const removeItem = (id: string) => setItems((prev) => prev.filter((p) => p.id !== id));

  const updateItemTier = (id: string, tier: PriceTier) => {
    setItems((prev) => prev.map((p) => {
      if (p.id !== id || p.type !== "standard" || !p.tierPrices) return p;
      const opt = p.tierPrices.find((t) => t.key === tier);
      if (!opt) return p;
      return { ...p, priceTier: tier, unitPrice: opt.price, totalPrice: opt.price * p.quantity };
    }));
  };

  const updateItemQty = (id: string, qty: number) => {
    if (qty <= 0) return removeItem(id);
    setItems((prev) => prev.map((p) => p.id === id ? { ...p, quantity: qty, totalPrice: p.unitPrice * qty } : p));
  };

  // ── Custom product ───────────────────────────────────────────
  const computedCustomUnitPrice = useMemo(() => {
    if (customForm.pricingMode !== "calculated") return customForm.directPrice;
    if (customForm.profitMargin <= 0 || customForm.profitMargin >= 100) return 0;
    return Math.round(customForm.costOfProduction / (1 - customForm.profitMargin / 100));
  }, [customForm]);

  const addCustomToCart = () => {
    if (!customForm.productName.trim() || customForm.quantity <= 0) {
      toast({ title: "Datos incompletos", description: "Completa nombre y cantidad", variant: "destructive" });
      return;
    }
    if (computedCustomUnitPrice <= 0) {
      toast({ title: "Precio inválido", description: "Revisa el precio o el margen", variant: "destructive" });
      return;
    }
    const unit = computedCustomUnitPrice;
    setItems((prev) => [
      ...prev,
      {
        id: `custom-${Date.now()}`,
        type: "custom",
        productName: customForm.productName.trim(),
        customSku: customForm.sku.trim() || undefined,
        productUnit: customForm.unit || "UN",
        productColor: customForm.color.trim() || undefined,
        quantity: customForm.quantity,
        unitPrice: unit,
        totalPrice: unit * customForm.quantity,
        costOfProduction: customForm.pricingMode === "calculated" ? customForm.costOfProduction : undefined,
        profitMargin: customForm.pricingMode === "calculated" ? customForm.profitMargin : undefined,
        pricingMode: customForm.pricingMode,
      },
    ]);
    setShowCustomModal(false);
    setCustomForm(INITIAL_CUSTOM);
    toast({ title: "Producto personalizado agregado" });
  };

  const subtotal = items.reduce((s, it) => s + it.totalPrice, 0);
  // Total estimado con IVA para el desglose de crédito del paso de pago. El backend
  // recalcula con la lista de precios del cliente; esto es solo referencial.
  const estimatedTotal = Math.round(subtotal * 1.19);

  const buildItemsPayload = () =>
    items.map((it) => {
      if (it.type === "custom") {
        return {
          type: "custom" as const,
          productName: it.productName,
          customSku: it.customSku,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          totalPrice: it.totalPrice,
          productUnit: it.productUnit,
          productColor: it.productColor,
          costOfProduction: it.costOfProduction,
          profitMargin: it.profitMargin,
          pricingMode: it.pricingMode,
        };
      }
      return {
        type: "standard" as const,
        productName: it.productName,
        sku: it.sku,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        totalPrice: it.totalPrice,
        selectedColor: it.selectedColor,
        selectedPackaging: it.selectedPackaging,
        imageUrl: it.imageUrl,
        priceTier: it.priceTier,
      };
    });

  // Paso 1 → 2: genera la vista previa del PDF (sin persistir) y pasa a revisión.
  const previewMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        clientCode: client.clientCode || undefined,
        clientName: client.clientName,
        notes: notes.trim() || undefined,
        items: buildItemsPayload(),
      };
      const res = await fetch("/api/ecommerce/orders/suggested/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message || "No se pudo generar la vista previa");
      }
      return res.blob();
    },
    onSuccess: (blob: Blob) => {
      setPdfUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(blob); });
      setStep("review");
    },
    onError: (err: any) => {
      toast({ title: "Error al generar la vista previa", description: err?.message, variant: "destructive" });
    },
  });

  // Paso 2: crea el sugerido y dispara los correos (cliente + copia al equipo).
  const sendMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        clientCode: client.clientCode || undefined,
        clientName: client.clientName,
        notes: notes.trim() || undefined,
        items: buildItemsPayload(),
        sendEmail: true,
        teamRecipient: teamRecipient.trim() || undefined,
        teamCc: teamCc.trim() || undefined,
        teamMessage: teamMessage.trim() || undefined,
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
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["/api/ecommerce/orders"] });
      if (data?.emailDelivered === false) {
        toast({
          title: "⚠️ Sugerido creado, pero el correo no llegó",
          description:
            (data?.emailError
              ? `El cliente verá el sugerido en su portal, pero falló el correo: ${data.emailError}`
              : "El cliente verá el sugerido en su portal, pero no se pudo enviar el correo. Revisá la configuración SMTP/Resend."),
          variant: "destructive",
        });
      } else {
        toast({
          title: "✓ Sugerido enviado",
          description: `${client.clientName} recibirá el correo en ${data?.emailTo || "su email"} en unos segundos.`,
        });
      }
      onClose();
    },
    onError: (err: any) => {
      toast({ title: "Error al enviar el sugerido", description: err?.message, variant: "destructive" });
    },
  });

  // Modo cliente: reenvía el sugerido modificado a revisión del equipo (PATCH).
  // No usa los endpoints admin (preview/create); va directo al endpoint del cliente.
  const modifyMutation = useMutation({
    mutationFn: async () => {
      if (!existingOrder?.id) throw new Error("Falta el pedido a modificar");
      if (items.length === 0) throw new Error("Dejá al menos un producto");
      const res = await fetch(`/api/ecommerce/orders/${existingOrder.id}/suggested-modify`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          items: buildItemsPayload(),
          notes: notes.trim() || null,
          paymentMethod: payment.paymentMethod,
          purchaseOrderPdfUrl: payment.purchaseOrderPdfUrl,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message || "No se pudo enviar el pedido modificado");
      }
      return res.json();
    },
    onSuccess: (updated: any) => {
      // Misma experiencia post-checkout del ecommerce (subir comprobante / pedido en proceso).
      window.location.href = `/pedido-confirmado?id=${updated?.id || existingOrder?.id || ""}`;
    },
    onError: (err: any) => {
      toast({ title: "Error al enviar tu pedido", description: err?.message, variant: "destructive" });
    },
  });

  const toggleTeamCc = (email: string) => {
    const itemsArr = teamCc.split(",").map((s) => s.trim()).filter(Boolean);
    const idx = itemsArr.findIndex((it) => it.toLowerCase() === email.toLowerCase());
    if (idx >= 0) itemsArr.splice(idx, 1);
    else itemsArr.push(email);
    setTeamCc(itemsArr.join(", "));
  };

  const totalQty = items.reduce((s, it) => s + it.quantity, 0);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-5xl mx-4 mt-[3vh] md:mt-[5vh] max-h-[92vh] overflow-hidden flex flex-col animate-in slide-in-from-top-4 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-[#FF6E23] to-[#E55E13] px-5 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center flex-shrink-0">
              {isModify ? <Wrench className="h-5 w-5 text-white" /> : <Zap className="h-5 w-5 text-white" />}
            </div>
            <div className="min-w-0">
              <h2 className="text-white font-bold text-lg truncate">
                {isModify ? "Modificar mi pedido" : "Enviar pedido sugerido"}
              </h2>
              <p className="text-white/80 text-xs truncate">
                {isModify
                  ? "Ajustá productos, listas y cantidades — lo revisamos antes de confirmar."
                  : <>Cliente: <strong>{client.clientName}</strong>{client.clientCode ? ` · ${client.clientCode}` : ""}</>}
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

        {/* PASO 1 — Cuerpo: 2 columnas en desktop (búsqueda/resultados | carrito) */}
        {step === "build" && (
        <div className="flex-1 flex flex-col md:flex-row min-h-0">

          {/* ── COLUMNA IZQUIERDA: Búsqueda + Resultados ───────────── */}
          <div className="flex-1 flex flex-col min-w-0 md:border-r border-gray-100">
            {/* Search + acción custom */}
            <div className="px-5 pt-4 pb-3 border-b border-gray-100 flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
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
                    placeholder="Buscá por nombre o código SKU (ej: LATEX, EP-001-BL-GL)"
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
                {canEditPrice && (
                  <button
                    onClick={() => setShowCustomModal(true)}
                    className="h-[52px] px-4 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold transition-all flex items-center gap-2 shadow-sm hover:shadow"
                    title="Agregar producto personalizado"
                  >
                    <Wrench className="h-4 w-4" />
                    <span className="hidden md:inline">Personalizado</span>
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
              {canEditPrice ? (
                <p className="text-[11px] text-gray-400 mt-2 pl-1 flex items-start gap-1">
                  <Sparkles className="h-3 w-3 mt-0.5 text-amber-500 flex-shrink-0" />
                  Podés elegir la lista de precio (Lista, 10%, Mínimo, Mix, Oferta…) en cada producto del carrito.
                </p>
              ) : (
                <p className="text-[11px] text-gray-400 mt-2 pl-1 flex items-start gap-1">
                  <Sparkles className="h-3 w-3 mt-0.5 text-amber-500 flex-shrink-0" />
                  Ajustá cantidades o agregá productos por SKU. Los precios los define el equipo comercial.
                </p>
              )}
            </div>

            {/* Resultados de búsqueda */}
            <div className="flex-1 overflow-y-auto">
              {!debouncedSku && (
                <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                  <div className="w-16 h-16 bg-orange-50 rounded-2xl flex items-center justify-center mb-4">
                    <Barcode className="h-8 w-8 text-[#FF6E23]/50" />
                  </div>
                  <h3 className="text-base font-bold text-gray-800 mb-1">Buscá productos por nombre o SKU</h3>
                  <p className="text-sm text-gray-500 max-w-xs">
                    Agregá los productos al carrito a la derecha, o sumá un producto personalizado.
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
                  <span className="text-sm text-gray-500">Buscando...</span>
                </div>
              )}

              {!isLoading && debouncedSku && debouncedSku.length >= 2 && matchedVariants.length === 0 && (
                <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
                  <Package className="h-10 w-10 text-gray-300 mb-3" />
                  <h3 className="text-sm font-bold text-gray-700 mb-1">Sin resultados para "{debouncedSku}"</h3>
                  <p className="text-xs text-gray-500">Probá con otro nombre o código SKU.</p>
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
            </div>
          </div>

          {/* ── COLUMNA DERECHA: Carrito ───────────────────────────── */}
          <div className="w-full md:w-[380px] md:flex-shrink-0 flex flex-col bg-gradient-to-b from-orange-50/40 to-white border-t md:border-t-0 border-gray-100">
            <div className="px-4 py-3 border-b border-orange-100/60 bg-white/70 backdrop-blur-sm flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <ShoppingCart className="h-5 w-5 text-[#FF6E23]" />
                  {items.length > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 bg-[#FF6E23] text-white text-[9px] font-bold rounded-full min-w-[16px] h-[16px] px-1 flex items-center justify-center">
                      {items.length}
                    </span>
                  )}
                </div>
                <h3 className="text-sm font-bold text-gray-800">Carrito sugerido</h3>
              </div>
              {items.length > 0 && (
                <button
                  onClick={() => setItems([])}
                  className="text-[10px] font-bold text-gray-400 hover:text-red-500 flex items-center gap-1 transition-colors"
                  title="Vaciar carrito"
                >
                  <Trash2 className="h-3 w-3" />
                  Vaciar
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-3">
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center py-10 px-4 h-full">
                  <div className="w-14 h-14 rounded-full bg-orange-100/60 flex items-center justify-center mb-3">
                    <ShoppingCart className="h-6 w-6 text-[#FF6E23]/60" />
                  </div>
                  <p className="text-xs font-bold text-gray-600 mb-1">El carrito está vacío</p>
                  <p className="text-[11px] text-gray-400 leading-relaxed max-w-[220px]">
                    Buscá por SKU o agregá un producto personalizado para sumarlo al sugerido.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {items.map((it) => {
                    const isCustom = it.type === "custom";
                    const isLoadingTiers = !isCustom && resolvingSku && it.sku === resolvingSku;
                    const tierOptions = it.tierPrices || [];
                    return (
                      <div
                        key={it.id}
                        className={`rounded-xl border p-2.5 ${isCustom ? "bg-violet-50/60 border-violet-200" : "bg-white border-gray-200 shadow-sm"}`}
                      >
                        <div className="flex items-start gap-2">
                          {!isCustom && it.imageUrl ? (
                            <img src={it.imageUrl} alt={it.productName} className="w-11 h-11 rounded-lg object-contain bg-gray-50 border border-gray-100 flex-shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                          ) : (
                            <div className={`w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0 ${isCustom ? "bg-violet-100" : "bg-gray-100"}`}>
                              {isCustom ? <Wrench className="h-4 w-4 text-violet-500" /> : <Package className="h-4 w-4 text-gray-400" />}
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-1">
                              <span className="text-[12px] font-bold text-gray-800 leading-snug line-clamp-2">
                                {it.productName}
                                {isCustom && <span className="ml-1 text-[8px] font-bold px-1 py-0.5 rounded bg-violet-100 text-violet-700 align-middle">CUSTOM</span>}
                              </span>
                              <button
                                onClick={() => removeItem(it.id)}
                                className="p-1 rounded hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors flex-shrink-0"
                                title="Quitar del carrito"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                            <p className="text-[10px] text-gray-500 truncate mt-0.5">
                              {isCustom
                                ? `${it.customSku ? it.customSku + " · " : ""}${it.productUnit || "UN"}${it.productColor ? " · " + it.productColor : ""}`
                                : `${it.sku} · ${it.selectedColor} · ${it.selectedPackaging}`}
                            </p>
                          </div>
                        </div>

                        {/* Tier selector (sólo standard) — sólo para el equipo comercial.
                            El cliente que modifica su sugerido no ve ni cambia la lista de precio. */}
                        {!isCustom && canEditPrice && (
                          <div className="mt-2 flex items-center gap-1.5">
                            <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Lista:</label>
                            {isLoadingTiers ? (
                              <div className="flex items-center gap-1 text-[10px] text-gray-400">
                                <Loader2 className="h-3 w-3 animate-spin" /> cargando…
                              </div>
                            ) : tierOptions.length > 1 ? (
                              <select
                                value={it.priceTier || "lista"}
                                onChange={(e) => updateItemTier(it.id, e.target.value as PriceTier)}
                                className="flex-1 text-[11px] font-semibold rounded border border-gray-200 px-1.5 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-[#FF6E23] truncate"
                              >
                                {tierOptions.map((t) => (
                                  <option key={t.key} value={t.key}>
                                    {t.label} · {formatPrice(t.price)}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className="text-[10px] text-gray-500 flex items-center gap-1">
                                {tierOptions[0]?.label || "Lista"}
                                {tierOptions.length === 0 && (
                                  <span title="No se encontraron tiers" className="text-amber-500">
                                    <AlertCircle className="h-3 w-3" />
                                  </span>
                                )}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Stepper de cantidad + total línea */}
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <div className="inline-flex items-center rounded-lg overflow-hidden border border-gray-200 bg-white h-7">
                            <button
                              onClick={() => updateItemQty(it.id, Math.max(1, it.quantity - 1))}
                              className="w-7 h-full flex items-center justify-center bg-gray-50 hover:bg-gray-100 text-gray-600"
                              title="Disminuir"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <input
                              type="number"
                              min="1"
                              value={it.quantity}
                              onChange={(e) => {
                                const v = parseInt(e.target.value);
                                if (!isNaN(v)) updateItemQty(it.id, v);
                              }}
                              className="w-10 h-full text-center text-xs font-bold border-x border-gray-200 focus:outline-none focus:ring-1 focus:ring-inset focus:ring-[#FF6E23] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                            <button
                              onClick={() => updateItemQty(it.id, it.quantity + 1)}
                              className="w-7 h-full flex items-center justify-center bg-gray-50 hover:bg-gray-100 text-gray-600"
                              title="Aumentar"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                          <div className="text-right">
                            <div className="text-[9px] text-gray-400 leading-tight">{it.quantity} × {formatPrice(it.unitPrice)}</div>
                            <div className={`text-sm font-black leading-tight ${isCustom ? "text-violet-700" : "text-[#FF6E23]"}`}>
                              {formatPrice(it.totalPrice)}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Nota opcional dentro del carrito */}
                  <div className="pt-2">
                    {!showNotes ? (
                      <button
                        onClick={() => setShowNotes(true)}
                        className="w-full text-xs text-[#FF6E23] hover:text-[#E55E13] font-semibold flex items-center justify-center gap-1 py-2 rounded-lg border border-dashed border-orange-200 hover:border-orange-300 hover:bg-orange-50/50 transition-colors"
                      >
                        <MessageSquare className="h-3 w-3" />
                        Agregar nota para el cliente
                      </button>
                    ) : (
                      <div className="bg-white rounded-lg border border-gray-200 p-2">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1">
                          <MessageSquare className="h-3 w-3" />
                          Nota para el cliente
                        </label>
                        <textarea
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          rows={2}
                          placeholder="Ej: Te recomendamos estos productos según tu última compra…"
                          className="mt-1 w-full text-xs rounded-md border border-gray-200 p-2 outline-none focus:border-[#FF6E23] focus:ring-2 focus:ring-[#FF6E23]/10 resize-none"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Resumen del carrito (siempre visible) */}
            <div className="border-t border-orange-100/60 bg-white px-4 py-3 flex-shrink-0">
              <div className="flex items-center justify-between text-[11px] text-gray-500 mb-1">
                <span>Productos</span>
                <span className="font-semibold text-gray-700">{items.length} ítem{items.length !== 1 ? "s" : ""} · {totalQty} u.</span>
              </div>
              <div className="flex items-end justify-between">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total ref.</span>
                <span className="text-2xl font-black text-[#FF6E23] leading-none">{formatPrice(subtotal) || "$0"}</span>
              </div>
              <p className="text-[10px] text-gray-400 mt-1 leading-snug">
                Sin IVA. El backend recalcula con la lista del cliente y aplica descuentos por sucursal.
              </p>
            </div>
          </div>
        </div>
        )}

        {/* PASO 2 — Revisión: PDF + destinatarios de la copia al equipo */}
        {step === "review" && (
        <div className="flex-1 flex flex-col md:flex-row min-h-0">
          {/* PDF preview */}
          <div className="flex-1 min-w-0 flex flex-col bg-gray-100 md:border-r border-gray-200">
            <div className="px-5 py-2.5 border-b border-gray-200 bg-white flex items-center gap-2 flex-shrink-0">
              <FileText className="h-4 w-4 text-[#FF6E23]" />
              <span className="text-sm font-bold text-gray-800">Vista previa del PDF</span>
              {pdfUrl && (
                <a
                  href={pdfUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-auto text-[11px] font-semibold text-[#FF6E23] hover:text-[#E55E13] flex items-center gap-1"
                >
                  Abrir en pestaña <ArrowRight className="h-3 w-3" />
                </a>
              )}
            </div>
            <div className="flex-1 min-h-[300px] md:min-h-0">
              {pdfUrl ? (
                <iframe title="Vista previa del sugerido" src={pdfUrl} className="w-full h-full border-0" />
              ) : (
                <div className="h-full flex items-center justify-center text-gray-400">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              )}
            </div>
          </div>

          {/* Destinatarios de la copia al equipo */}
          <div className="w-full md:w-[360px] md:flex-shrink-0 flex flex-col bg-white border-t md:border-t-0 border-gray-100 overflow-y-auto">
            <div className="p-4 space-y-4">
              <div className="rounded-xl bg-orange-50/60 border border-orange-100 p-3">
                <div className="flex items-center gap-2 text-[#E55E13]">
                  <Mail className="h-4 w-4" />
                  <span className="text-xs font-bold uppercase tracking-wider">El cliente recibirá</span>
                </div>
                <p className="text-sm font-bold text-gray-800 mt-1">{client.clientName}</p>
                <p className="text-[11px] text-gray-500 leading-snug mt-0.5">
                  Recibe el sugerido con el PDF adjunto y los botones para aceptar, modificar o rechazar.
                </p>
              </div>

              <div>
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-[#FF6E23]" />
                  Notificar al equipo (copia)
                </label>
                <input
                  type="email"
                  value={teamRecipient}
                  onChange={(e) => setTeamRecipient(e.target.value)}
                  placeholder="tu-correo@pinturaspanoramica.cl"
                  className="mt-1.5 w-full text-sm rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#FF6E23]/15 focus:border-[#FF6E23]"
                />
                <p className="text-[10px] text-gray-400 mt-1">Por defecto, tu correo. La copia incluye el PDF.</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {PRESET_EMAIL_CONTACTS.map((c) => {
                    const active = teamRecipient.trim().toLowerCase() === c.email.toLowerCase();
                    return (
                      <button
                        key={c.email}
                        type="button"
                        onClick={() => setTeamRecipient(c.email)}
                        className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${active ? "bg-[#FF6E23] border-[#FF6E23] text-white" : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"}`}
                        title={c.email}
                      >
                        {c.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">CC <span className="text-gray-400 font-normal normal-case">(separar con coma)</span></label>
                <input
                  value={teamCc}
                  onChange={(e) => setTeamCc(e.target.value)}
                  placeholder="otro@dom.cl, otro2@dom.cl"
                  className="mt-1.5 w-full text-sm rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#FF6E23]/15 focus:border-[#FF6E23]"
                />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {PRESET_EMAIL_CONTACTS.map((c) => {
                    const ccItems = teamCc.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
                    const active = ccItems.includes(c.email.toLowerCase());
                    return (
                      <button
                        key={c.email}
                        type="button"
                        onClick={() => toggleTeamCc(c.email)}
                        className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${active ? "bg-blue-500 border-blue-500 text-white" : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"}`}
                        title={c.email}
                      >
                        {active ? "✓ " : "+ "}{c.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Comentario interno (opcional)</label>
                <textarea
                  value={teamMessage}
                  onChange={(e) => setTeamMessage(e.target.value)}
                  rows={3}
                  placeholder="Nota visible solo en la copia al equipo…"
                  className="mt-1.5 w-full text-sm rounded-lg border border-gray-200 p-2 outline-none focus:ring-2 focus:ring-[#FF6E23]/15 focus:border-[#FF6E23] resize-none"
                />
              </div>

              <div className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2 flex items-center justify-between">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total ref.</span>
                <span className="text-lg font-black text-[#FF6E23]">{formatPrice(subtotal) || "$0"}</span>
              </div>
            </div>
          </div>
        </div>
        )}

        {/* PASO PAGO (modo cliente) — forma de pago + OC, igual que el checkout del ecommerce */}
        {step === "pay" && (
        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
          <div className="p-5 w-full max-w-xl mx-auto space-y-4">
            <div className="rounded-xl bg-orange-50/60 border border-orange-100 p-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-[#E55E13]">
                <ShoppingCart className="h-4 w-4" />
                <span className="text-xs font-bold uppercase tracking-wider">Tu pedido</span>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-gray-400 uppercase tracking-widest">Total estimado</p>
                <p className="text-lg font-black text-[#FF6E23] leading-none">{formatPrice(estimatedTotal) || "$0"}</p>
              </div>
            </div>

            <SuggestedOrderPayment
              total={estimatedTotal}
              value={payment}
              onChange={setPayment}
              onValidityChange={setPayValid}
            />

            <p className="text-[10px] text-gray-400 leading-snug">
              El total final se recalcula con tu lista de precios (IVA incluido).
            </p>
          </div>
        </div>
        )}

        {/* Footer */}
        <div className="border-t border-gray-200 px-5 py-3 flex items-center justify-between flex-shrink-0 bg-gray-50 gap-3">
          {step === "build" ? (
            <>
              <button
                onClick={onClose}
                className="text-sm text-gray-500 hover:text-gray-700 font-medium transition-colors"
                disabled={previewMutation.isPending || modifyMutation.isPending}
              >
                Cancelar
              </button>
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex flex-col items-end leading-tight">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total</span>
                  <span className="text-base font-black text-gray-800">{formatPrice(subtotal) || "$0"}</span>
                </div>
                {isModify ? (
                  <button
                    onClick={() => setStep("pay")}
                    disabled={items.length === 0}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#FF6E23] hover:bg-[#E55E13] text-white text-sm font-bold transition-all shadow-lg shadow-orange-200/50 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
                  >
                    <CreditCard className="h-4 w-4" />
                    Continuar al pago{items.length > 0 ? ` (${items.length})` : ""}
                  </button>
                ) : (
                  <button
                    onClick={() => previewMutation.mutate()}
                    disabled={items.length === 0 || previewMutation.isPending}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#FF6E23] hover:bg-[#E55E13] text-white text-sm font-bold transition-all shadow-lg shadow-orange-200/50 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
                  >
                    {previewMutation.isPending
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <FileText className="h-4 w-4" />}
                    Continuar a revisión{items.length > 0 ? ` (${items.length})` : ""}
                  </button>
                )}
              </div>
            </>
          ) : step === "review" ? (
            <>
              <button
                onClick={() => setStep("build")}
                disabled={sendMutation.isPending}
                className="text-sm text-gray-600 hover:text-gray-900 font-medium transition-colors flex items-center gap-1.5"
              >
                <ArrowLeft className="h-4 w-4" /> Volver a editar
              </button>
              <button
                onClick={() => sendMutation.mutate()}
                disabled={items.length === 0 || sendMutation.isPending}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#FF6E23] hover:bg-[#E55E13] text-white text-sm font-bold transition-all shadow-lg shadow-orange-200/50 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
              >
                {sendMutation.isPending
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Send className="h-4 w-4" />}
                Enviar sugerido
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setStep("build")}
                disabled={modifyMutation.isPending}
                className="text-sm text-gray-600 hover:text-gray-900 font-medium transition-colors flex items-center gap-1.5"
              >
                <ArrowLeft className="h-4 w-4" /> Volver a editar
              </button>
              <button
                onClick={() => modifyMutation.mutate()}
                disabled={items.length === 0 || modifyMutation.isPending || !payValid}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#FF6E23] hover:bg-[#E55E13] text-white text-sm font-bold transition-all shadow-lg shadow-orange-200/50 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
              >
                {modifyMutation.isPending
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Check className="h-4 w-4" />}
                Confirmar pedido
              </button>
            </>
          )}
        </div>
      </div>

      {/* Sub-modal: Producto personalizado */}
      {showCustomModal && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center"
          onClick={(e) => {
            // Frenar la propagación para que el click no llegue al backdrop del modal padre y lo cierre también.
            e.stopPropagation();
            setShowCustomModal(false);
          }}
        >
          <div className="absolute inset-0 bg-black/60" />
          <div
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[88vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-violet-600 to-violet-700 px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-white">
                <Wrench className="h-5 w-5" />
                <h3 className="font-bold">Producto personalizado</h3>
              </div>
              <button onClick={() => setShowCustomModal(false)} className="text-white hover:bg-white/20 rounded-full w-8 h-8 flex items-center justify-center">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              <div>
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Nombre del producto *</label>
                <input
                  type="text"
                  value={customForm.productName}
                  onChange={(e) => setCustomForm({ ...customForm, productName: e.target.value })}
                  placeholder="Ej: Pintura premium especial fachada"
                  className="mt-1 w-full text-sm rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">SKU (opcional)</label>
                  <input
                    type="text"
                    value={customForm.sku}
                    onChange={(e) => setCustomForm({ ...customForm, sku: e.target.value })}
                    placeholder="Ej: CUSTOM-001"
                    className="mt-1 w-full text-sm font-mono rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Unidad</label>
                  <input
                    type="text"
                    value={customForm.unit}
                    onChange={(e) => setCustomForm({ ...customForm, unit: e.target.value })}
                    placeholder="Ej: UN, GL, KG…"
                    className="mt-1 w-full text-sm rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                  />
                </div>
              </div>
              <div>
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Color (opcional)</label>
                <input
                  type="text"
                  value={customForm.color}
                  onChange={(e) => setCustomForm({ ...customForm, color: e.target.value })}
                  placeholder="Ej: Blanco, Rojo, RAL 9010…"
                  className="mt-1 w-full text-sm rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                />
              </div>

              {/* Modo de precio */}
              <div className="border border-gray-200 rounded-xl p-3 bg-gray-50/50">
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2 block">Cómo definir el precio</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCustomForm({ ...customForm, pricingMode: "direct" })}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${customForm.pricingMode === "direct" ? "bg-violet-600 text-white shadow" : "bg-white text-gray-600 border border-gray-200"}`}
                  >
                    Precio directo
                  </button>
                  <button
                    onClick={() => setCustomForm({ ...customForm, pricingMode: "calculated" })}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${customForm.pricingMode === "calculated" ? "bg-violet-600 text-white shadow" : "bg-white text-gray-600 border border-gray-200"}`}
                  >
                    Costo + margen
                  </button>
                </div>

                {customForm.pricingMode === "direct" ? (
                  <div className="mt-3">
                    <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Precio unitario *</label>
                    <div className="relative mt-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                      <input
                        type="number"
                        min="0"
                        value={customForm.directPrice || ""}
                        onChange={(e) => setCustomForm({ ...customForm, directPrice: parseInt(e.target.value) || 0 })}
                        className="w-full text-sm pl-7 pr-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Costo</label>
                      <div className="relative mt-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                        <input
                          type="number"
                          min="0"
                          value={customForm.costOfProduction || ""}
                          onChange={(e) => setCustomForm({ ...customForm, costOfProduction: parseInt(e.target.value) || 0 })}
                          className="w-full text-sm pl-7 pr-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Margen %</label>
                      <input
                        type="number"
                        min="0"
                        max="99"
                        value={customForm.profitMargin || ""}
                        onChange={(e) => setCustomForm({ ...customForm, profitMargin: parseInt(e.target.value) || 0 })}
                        className="mt-1 w-full text-sm px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                      />
                    </div>
                    <div className="col-span-2 text-xs text-gray-500 flex items-center justify-between bg-white px-3 py-2 rounded-lg border border-violet-100">
                      <span>Precio calculado:</span>
                      <span className="font-bold text-violet-700">{formatPrice(computedCustomUnitPrice) || "—"}</span>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Cantidad *</label>
                <input
                  type="number"
                  min="1"
                  value={customForm.quantity || ""}
                  onChange={(e) => setCustomForm({ ...customForm, quantity: parseInt(e.target.value) || 0 })}
                  className="mt-1 w-full text-sm rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                />
              </div>
            </div>

            <div className="border-t border-gray-200 px-5 py-3 flex items-center justify-end gap-2 bg-gray-50">
              <button
                onClick={() => setShowCustomModal(false)}
                className="text-sm text-gray-500 hover:text-gray-700 font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={addCustomToCart}
                disabled={!customForm.productName.trim() || customForm.quantity <= 0 || computedCustomUnitPrice <= 0}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Plus className="h-4 w-4" />
                Agregar al sugerido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SuggestedOrderModal;
