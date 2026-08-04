import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import {
  ArrowLeft, ShoppingBag, Package, DollarSign, Clock, CalendarIcon,
  Tag, History, Mail, Building2, Hash, KeyRound, Link as LinkIcon, Unlink,
  UserCircle, FileText, CreditCard, ExternalLink, MapPin, Phone, AlertTriangle,
  Store, Send, Truck, Receipt, Copy, Check, Pencil, X, Save, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import SuggestedOrderModal from "@/components/panoramica-market/suggested-order-modal";
import { OrderTrackingTimeline } from "@/components/ecommerce/order-tracking-timeline";
import { statusConfig } from "@/components/ecommerce/order-detail-view";
import TmsOrdersPanel from "@/components/logistica/tms-orders-panel";

interface ClientDetails {
  totalPurchases: number;
  totalProducts: number;
  transactionCount: number;
  averageTicket: number;
  purchaseFrequency: number; // days between purchases
  segments: string[];
  lastPurchaseDate?: string;
}

interface ClientProduct {
  productName: string;
  totalPurchases: number;
  transactionCount: number;
  averagePrice: number;
  lastPurchase: string;
  daysSinceLastPurchase: number;
}

interface LastOrder {
  id: string;
  nudo: string;
  feemdo: string;
  nokopr: string;
  monto: string;
  nokofu: string;
}

interface PurchaseItem {
  id: string;
  nudo: string;
  feemdo: string;
  nokopr: string;
  monto: string;
  nokofu: string;
}

interface ErpDocument {
  source: string;
  docType: "FCV" | "NVV";
  id: string;
  idmaeedo?: number | null;
  orderNumber: string | number | null;
  date: string | null;
  items: number;
  total: number;
  totalPending?: number;
  status: "facturado" | "pendiente_facturacion";
  salesperson: string | null;
  deliveryDate: string | null;
}

interface ErpOrdersResponse {
  documents: ErpDocument[];
  fcvCount: number;
  nvvPendingCount: number;
  clientName?: string;
}

interface FichaInfo {
  id: string;
  clientCode: string | null;
  clientName: string | null;
  rut: string | null;
  phone: string | null;
  address: string | null;
  commune: string | null;
  email: string | null;
  paymentCondition: string | null;
  salesRepCode: string | null;
  priceList: string | null;
  priceListOverride: string | null;
  priceListErp: string | null;
  creditLimit: number | null;
  creditAvailable: number | null;
  creditUsed: number | null;
  creditOverdue: number | null;
  overdueSince: string | null;
  creditUpcoming: number | null;
  nextDueDate: string | null;
}

interface CarteraDoc {
  nudo: string | null;
  tido: string | null;
  vencimiento: string | null;
  saldo: number;
  vencida: boolean;
}

interface AccountStatus {
  hasFicha: boolean;
  ficha: FichaInfo | null;
  inEcommerce: boolean;
  linked: boolean;
  ecommerceUserId: string | null;
  clientId: string | null;
  pendingRequest: {
    id: string;
    empresa: string;
    rut: string;
    contacto: string;
    email: string;
    telefono: string;
    ciudad: string;
    createdAt: string;
  } | null;
}

function CredField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard no disponible */
    }
  };
  return (
    <div>
      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
      <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
        <code className="flex-1 text-sm font-mono break-all">{value}</code>
        <Button variant="ghost" size="sm" className="h-7 px-2 shrink-0" onClick={copy} type="button">
          {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

export default function ClientDetail() {
  const { clientName } = useParams();
  const { user } = useAuth();
  const canManage = user?.role === "admin" || user?.role === "supervisor" || user?.role === "encargado_area" || user?.role === "reception";
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Date filter states - default to last 30 days for better initial data display
  const [selectedPeriod, setSelectedPeriod] = useState<string>("last-30-days");
  const [filterType, setFilterType] = useState<"day" | "month" | "year" | "range">("range");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [isLastPurchaseActive, setIsLastPurchaseActive] = useState(false);
  const [periodInitializedFor, setPeriodInitializedFor] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("info");
  const [suggestedOpen, setSuggestedOpen] = useState(false);
  const [editingFicha, setEditingFicha] = useState(false);
  const [fichaForm, setFichaForm] = useState({ clientName: "", email: "", phone: "", address: "", commune: "" });
  const [editingComercial, setEditingComercial] = useState(false);
  const [priceListForm, setPriceListForm] = useState<string>("__erp__");
  const [trackingOrderId, setTrackingOrderId] = useState<string | null>(null);
  const [marketCreds, setMarketCreds] = useState<{ loginEmail: string | null; tempPassword: string | null; username: string; created: boolean } | null>(null);

  // Estado del diálogo "Enviar cobranza"
  const [cobranzaOpen, setCobranzaOpen] = useState(false);
  const [cobranzaMode, setCobranzaMode] = useState<"vencidas" | "porvencer">("vencidas");
  const [cobranzaEmail, setCobranzaEmail] = useState("");
  const [cobranzaMonto, setCobranzaMonto] = useState("");
  const [cobranzaFecha, setCobranzaFecha] = useState("");
  const [cobranzaDoc, setCobranzaDoc] = useState("");
  const [cobranzaSubject, setCobranzaSubject] = useState("");
  const [cobranzaMensaje, setCobranzaMensaje] = useState("");
  const [cobranzaCcInternal, setCobranzaCcInternal] = useState(true);
  const [cobranzaExtraCc, setCobranzaExtraCc] = useState("");
  const [cobranzaPreview, setCobranzaPreview] = useState<{ subject: string; html: string } | null>(null);
  const [cobranzaPreviewLoading, setCobranzaPreviewLoading] = useState(false);

  // Fetch available periods
  const { data: availablePeriods } = useQuery<{
    months: Array<{ value: string; label: string }>;
    years: Array<{ value: string; label: string }>;
  }>({
    queryKey: ['/api/sales/available-periods'],
  });

  const decodedClientName = clientName ? decodeURIComponent(clientName) : '';

  // Fetch last order to get the global last purchase date (independent of period filters)
  const { data: lastOrder } = useQuery<LastOrder>({
    queryKey: [`/api/sales/client/${encodeURIComponent(decodedClientName)}/last-order`],
    enabled: !!decodedClientName,
  });

  // Update selected period when filter type changes
  useEffect(() => {
    switch (filterType) {
      case "day":
        if (selectedDate) {
          setSelectedPeriod(format(selectedDate, "yyyy-MM-dd"));
        } else {
          setSelectedPeriod(format(new Date(), "yyyy-MM-dd"));
        }
        break;
      case "month":
        if (!selectedPeriod || selectedPeriod.includes("_") || selectedPeriod === "current-month" || selectedPeriod === "last-month" || selectedPeriod === "last-30-days" || selectedPeriod === "last-7-days") {
          setSelectedPeriod(format(new Date(), "yyyy-MM"));
        }
        break;
      case "year":
        setSelectedPeriod(selectedYear.toString());
        break;
      case "range":
        if (startDate && endDate) {
          setSelectedPeriod(`${format(startDate, "yyyy-MM-dd")}_${format(endDate, "yyyy-MM-dd")}`);
        }
        break;
    }
  }, [filterType, selectedDate, selectedYear, startDate, endDate]);

  // On first load (per client), default the period to the client's last-purchase
  // month so the KPIs show real data immediately instead of an empty
  // "last 30 days" window. Skips clients with no sales; never overrides a manual change.
  useEffect(() => {
    if (periodInitializedFor === decodedClientName) return;
    if (!lastOrder?.feemdo) return;
    const lastDate = new Date(lastOrder.feemdo);
    if (Number.isNaN(lastDate.getTime())) return;
    setFilterType("month");
    setSelectedPeriod(format(lastDate, "yyyy-MM"));
    setIsLastPurchaseActive(true);
    setPeriodInitializedFor(decodedClientName);
  }, [lastOrder, decodedClientName, periodInitializedFor]);

  // Handler for "Mes Ultima Compra" button
  const handleLastPurchaseMonth = useCallback(() => {
    if (!lastOrder?.feemdo) return;
    const lastDate = new Date(lastOrder.feemdo);
    const monthPeriod = format(lastDate, "yyyy-MM");
    setFilterType("month");
    setSelectedPeriod(monthPeriod);
    setIsLastPurchaseActive(true);
  }, [lastOrder]);

  const handleFilterTypeChange = useCallback((value: "day" | "month" | "year" | "range") => {
    setFilterType(value);
    setIsLastPurchaseActive(false);
  }, []);

  const handlePeriodChange = useCallback((value: string) => {
    setSelectedPeriod(value);
    setIsLastPurchaseActive(false);
  }, []);

  const { data: details, isLoading: isLoadingDetails } = useQuery<ClientDetails>({
    queryKey: [`/api/sales/client/${encodeURIComponent(decodedClientName)}/details?period=${selectedPeriod}&filterType=${filterType}`],
    enabled: !!decodedClientName,
  });

  const { data: products = [], isLoading: isLoadingProducts } = useQuery<ClientProduct[]>({
    queryKey: [`/api/sales/client/${encodeURIComponent(decodedClientName)}/products?period=${selectedPeriod}&filterType=${filterType}`],
    enabled: !!decodedClientName,
  });

  // Account status — powers the status badges + commercial panel
  const { data: accountStatus } = useQuery<AccountStatus>({
    queryKey: [`/api/clients/account-status?name=${encodeURIComponent(decodedClientName)}`],
    enabled: !!decodedClientName,
  });

  // Listas de precios disponibles para el selector de "Lista de Precios".
  const { data: customPriceLists = [] } = useQuery<{ code: string; name: string }[]>({
    queryKey: ["/api/custom-price-lists"],
    enabled: canManage,
  });

  // Detalle de cuentas por cobrar (facturas pendientes con vencimiento + saldo)
  const { data: carteraData, isLoading: isLoadingCartera } = useQuery<{ docs: CarteraDoc[] }>({
    queryKey: [`/api/clients/cartera?name=${encodeURIComponent(decodedClientName)}`],
    enabled: !!decodedClientName,
  });
  const carteraDocs = carteraData?.docs ?? [];

  // Purchase history (recent transactions) for the "Pedidos" tab
  const { data: purchaseHistory = [], isLoading: isLoadingHistory } = useQuery<PurchaseItem[]>({
    queryKey: [`/api/sales/client/${encodeURIComponent(decodedClientName)}/purchase-history?limit=25`],
    enabled: !!decodedClientName && activeTab === "pedidos",
  });

  const ficha = accountStatus?.ficha;

  /**
   * Cobranza del cliente, cuadrada contra la MISMA lista de documentos que se
   * muestra debajo.
   *
   * El panel mostraba los números de la ficha y la lista de cuentas por cobrar
   * como dos cosas separadas, y aunque salen del mismo cálculo del servidor no
   * había forma de verlo: cualquier diferencia de redondeo o de momento de
   * carga se leía como "no calzan". Ahora la deuda, el vencido y el por vencer
   * se derivan de los documentos listados; la ficha del ERP queda de respaldo
   * para cuando el detalle todavía no cargó.
   *
   * Disponible = límite − deuda. Sin línea de crédito asignada no hay
   * disponible que calcular, y se dice en vez de mostrar un guión.
   */
  const cobranza = useMemo(() => {
    const hayDetalle = carteraDocs.length > 0;
    const suma = (filtro: (d: CarteraDoc) => boolean) =>
      carteraDocs.filter(filtro).reduce((total, d) => total + (Number(d.saldo) || 0), 0);

    const deuda = hayDetalle ? suma(() => true) : ficha?.creditUsed ?? null;
    const vencido = hayDetalle ? suma((d) => d.vencida) : ficha?.creditOverdue ?? null;
    const porVencer = hayDetalle ? suma((d) => !d.vencida) : ficha?.creditUpcoming ?? null;
    const limite = ficha?.creditLimit ?? null;

    return {
      limite,
      deuda,
      vencido,
      porVencer,
      documentos: carteraDocs.length,
      disponible: limite != null ? limite - (deuda ?? 0) : null,
      // Un disponible negativo no es un número más: es crédito excedido.
      excedido: limite != null && (deuda ?? 0) > limite,
      derivadoDelDetalle: hayDetalle,
    };
  }, [carteraDocs, ficha]);

  const ecommerceUserId = accountStatus?.ecommerceUserId || null;
  const fichaIdForActivation = accountStatus?.ficha?.id || accountStatus?.clientId || null;

  // eCommerce orders feed the Panorámica Market KPIs (only when the client has access)
  const { data: marketOrders = [] } = useQuery<any[]>({
    queryKey: [`/api/ecommerce/orders?userId=${ecommerceUserId}`],
    enabled: !!ecommerceUserId && !!accountStatus?.inEcommerce && canManage,
  });

  // FCV (facturas) + NVV (notas de venta pendientes) desde el ERP — para ver el estado real.
  const { data: erpOrders, isLoading: isLoadingErp } = useQuery<ErpOrdersResponse>({
    queryKey: [`/api/users/clients/${fichaIdForActivation}/erp-orders`],
    enabled: !!fichaIdForActivation && canManage && activeTab === "pedidos",
  });
  const erpDocuments = erpOrders?.documents || [];
  const nvvDocs = erpDocuments.filter((d) => d.docType === "NVV");
  const fcvDocs = erpDocuments.filter((d) => d.docType === "FCV");

  const activateMarket = useMutation({
    mutationFn: async () => {
      if (!fichaIdForActivation) throw new Error("Este cliente no tiene ficha SAP para activar.");
      const res = await apiRequest("POST", `/api/clients/${fichaIdForActivation}/activate-market`, {});
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: [`/api/clients/account-status?name=${encodeURIComponent(decodedClientName)}`] });
      setMarketCreds({
        loginEmail: data?.loginEmail ?? null,
        tempPassword: data?.tempPassword ?? null,
        username: data?.username ?? "",
        created: !!data?.created,
      });
    },
    onError: (e: any) => {
      toast({ title: "No se pudo activar", description: e?.message || "Error al activar acceso", variant: "destructive" });
    },
  });

  const saveFicha = useMutation({
    mutationFn: async () => {
      if (!ficha?.id) throw new Error("Este cliente no tiene ficha.");
      const res = await apiRequest("PATCH", `/api/clients/${ficha.id}/ficha`, fichaForm);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/clients/account-status?name=${encodeURIComponent(decodedClientName)}`] });
      setEditingFicha(false);
      toast({ title: "Ficha actualizada", description: "Los cambios se guardaron correctamente." });
    },
    onError: (e: any) => {
      toast({ title: "No se pudo guardar", description: e?.message || "Error al guardar la ficha", variant: "destructive" });
    },
  });

  const startEditFicha = () => {
    setFichaForm({
      clientName: ficha?.clientName || decodedClientName || "",
      email: ficha?.email || "",
      phone: ficha?.phone || "",
      address: ficha?.address || "",
      commune: ficha?.commune || "",
    });
    setEditingFicha(true);
  };

  // Guarda la lista de precios como override manual (sobrevive al ETL) y refresca
  // la ficha. Esa lista pasa a regir presupuestos y el panel de Panorámica Market.
  const savePriceList = useMutation({
    mutationFn: async () => {
      if (!ficha?.id) throw new Error("Este cliente no tiene ficha.");
      const priceList = priceListForm === "__erp__" ? "" : priceListForm;
      const res = await apiRequest("PATCH", `/api/clients/${ficha.id}/ficha`, { priceList });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/clients/account-status?name=${encodeURIComponent(decodedClientName)}`] });
      setEditingComercial(false);
      toast({ title: "Lista de precios actualizada", description: "Se aplicará a presupuestos y al panel de Panorámica Market." });
    },
    onError: (e: any) => {
      toast({ title: "No se pudo guardar", description: e?.message || "Error al guardar la lista de precios", variant: "destructive" });
    },
  });

  const startEditComercial = () => {
    // El override manual manda; si no hay, arranca en "ERP por defecto".
    setPriceListForm(ficha?.priceListOverride || "__erp__");
    setEditingComercial(true);
  };

  // Nombre legible de una lista a partir de su código (LP01 = lista comercial general).
  const getListName = (code: string | null | undefined) => {
    if (!code) return "—";
    if (code === "LP01") return "Lista Comercial (Por defecto)";
    const found = customPriceLists.find((l) => l.code === code);
    return found ? `${found.name} (${found.code})` : code;
  };

  const approveRequest = useMutation({
    mutationFn: async () => {
      const reqId = accountStatus?.pendingRequest?.id;
      if (!reqId) throw new Error("Sin solicitud pendiente");
      const res = await apiRequest("PATCH", `/api/ecommerce/account-requests/${reqId}`, { status: "aprobada" });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/clients/account-status?name=${encodeURIComponent(decodedClientName)}`] });
      toast({ title: "Solicitud aprobada", description: "Se creó el acceso a Panorámica Market." });
    },
    onError: (e: any) => {
      toast({ title: "No se pudo aprobar", description: e?.message || "Error al aprobar la solicitud", variant: "destructive" });
    },
  });

  // Listado público "Dónde Comprar" — ver si el cliente ya está publicado y poder agregarlo.
  // Los endpoints de retail-locations requieren admin o supervisor.
  const canManageRetail = user?.role === "admin" || user?.role === "supervisor" || user?.role === "encargado_area";
  const { data: publicLocations = [] } = useQuery<{ id: string; name: string | null; address: string | null; active: boolean }[]>({
    queryKey: ['/api/admin/retail-locations'],
    enabled: canManageRetail && !!accountStatus?.hasFicha,
  });

  const addToRetail = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/retail-locations", {
        name: ficha?.clientName || decodedClientName,
        address: ficha?.address,
        comuna: ficha?.commune || undefined,
        phone: ficha?.phone || undefined,
        email: ficha?.email || undefined,
        type: "distribuidor",
        active: true,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/retail-locations'] });
      toast({ title: "Agregado al listado público", description: 'Ahora aparece en "Dónde Comprar" como distribuidor.' });
    },
    onError: (e: any) => {
      toast({ title: "No se pudo agregar", description: e?.message || "Error al agregar al listado", variant: "destructive" });
    },
  });

  // ── Enviar cobranza por correo ───────────────────────────────────────────
  const applyCobranzaMode = (mode: "vencidas" | "porvencer") => {
    setCobranzaMode(mode);
    if (mode === "vencidas") {
      setCobranzaMonto(ficha?.creditOverdue != null ? String(Math.round(ficha.creditOverdue)) : "");
      setCobranzaFecha((ficha?.overdueSince || "").slice(0, 10));
      setCobranzaMensaje("Le escribimos para recordarle que mantiene facturas vencidas con Pinturas Panorámica. Le agradeceremos regularizar el pago a la brevedad. Si ya realizó el pago, por favor omita este mensaje.");
    } else {
      setCobranzaMonto(ficha?.creditUpcoming != null ? String(Math.round(ficha.creditUpcoming)) : "");
      setCobranzaFecha((ficha?.nextDueDate || "").slice(0, 10));
      setCobranzaMensaje("Le escribimos para recordarle que tiene documentos próximos a vencer con Pinturas Panorámica. Le agradeceremos considerar el pago dentro del plazo indicado.");
    }
  };

  const openCobranza = () => {
    applyCobranzaMode((ficha?.creditOverdue ?? 0) > 0 ? "vencidas" : "porvencer");
    setCobranzaEmail(ficha?.email || "");
    setCobranzaDoc("");
    setCobranzaSubject("");
    setCobranzaCcInternal(true);
    setCobranzaExtraCc("");
    setCobranzaPreview(null);
    setCobranzaOpen(true);
  };

  const fetchCobranzaPreview = useCallback(async () => {
    if (!cobranzaMonto || Number(cobranzaMonto) <= 0 || !cobranzaFecha) {
      setCobranzaPreview(null);
      return;
    }
    setCobranzaPreviewLoading(true);
    try {
      const res = await apiRequest("POST", "/api/admin/mailing/cobranza-preview", {
        clientName: ficha?.clientName || decodedClientName,
        clientRut: ficha?.rut || undefined,
        montoAdeudado: cobranzaMonto,
        fechaVencimiento: cobranzaFecha,
        numeroDocumento: cobranzaDoc || undefined,
        mensajeAdicional: cobranzaMensaje || undefined,
        subjectOverride: cobranzaSubject || undefined,
      });
      setCobranzaPreview(await res.json());
    } catch {
      setCobranzaPreview(null);
    } finally {
      setCobranzaPreviewLoading(false);
    }
  }, [cobranzaMonto, cobranzaFecha, cobranzaDoc, cobranzaMensaje, cobranzaSubject, ficha?.clientName, ficha?.rut, decodedClientName]);

  useEffect(() => {
    if (!cobranzaOpen) return;
    const t = setTimeout(() => { fetchCobranzaPreview(); }, 500);
    return () => clearTimeout(t);
  }, [cobranzaOpen, fetchCobranzaPreview]);

  const sendCobranza = useMutation({
    mutationFn: async () => {
      if (!ficha?.clientCode) throw new Error("Este cliente no tiene código SAP para registrar la cobranza.");
      const res = await apiRequest("POST", "/api/admin/mailing/send-cobranza", {
        koen: ficha.clientCode,
        clientEmailOverride: cobranzaEmail || undefined,
        montoAdeudado: cobranzaMonto,
        fechaVencimiento: cobranzaFecha,
        numeroDocumento: cobranzaDoc || undefined,
        mensajeAdicional: cobranzaMensaje || undefined,
        subjectOverride: cobranzaSubject || undefined,
        sendToClient: true,
        ccInternal: cobranzaCcInternal,
        extraCc: cobranzaExtraCc || undefined,
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: "Cobranza enviada", description: `Para: ${data.to}${data.cc ? ` · CC: ${data.cc}` : ""}` });
      setCobranzaOpen(false);
    },
    onError: (e: any) => {
      toast({ title: "No se pudo enviar", description: e?.message || "Error al enviar la cobranza", variant: "destructive" });
    },
  });

  if (!decodedClientName) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600">Cliente no encontrado</h1>
          <Link href="/">
            <Button variant="outline" className="mt-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver al Dashboard
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const formatCurrency = (amount: number | null | undefined) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  const formatNumber = (num: number) => new Intl.NumberFormat('es-CL').format(num);

  const formatDate = (dateString?: string) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('es-CL');
  };

  const getDaysColor = (days: number) => {
    if (days <= 7) return 'text-green-600';
    if (days <= 30) return 'text-yellow-600';
    return 'text-red-600';
  };

  const lastPurchaseLabel = lastOrder?.feemdo
    ? format(new Date(lastOrder.feemdo), "MMMM yyyy", { locale: es })
    : null;

  const vendedor = lastOrder?.nokofu || ficha?.salesRepCode || null;

  const normalizeRetail = (s?: string | null) => (s || "").toLowerCase().trim();
  const retailEntry = ficha?.address
    ? publicLocations.find(
        (loc) =>
          normalizeRetail(loc.name) === normalizeRetail(ficha?.clientName || decodedClientName) &&
          normalizeRetail(loc.address) === normalizeRetail(ficha?.address),
      )
    : undefined;
  const canAddToRetail = !!(ficha?.address && (ficha?.clientName || decodedClientName));

  const canSendCobranza = !!ficha?.clientCode && !!cobranzaEmail.trim() && Number(cobranzaMonto) > 0 && !!cobranzaFecha;

  return (
    <div className="min-h-screen bg-background">
      <div className="p-3 sm:p-4 lg:p-6 space-y-4 lg:space-y-6">
        {/* Profile Header — modern dark gradient */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-5 md:p-7 text-white">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSA2MCAwIEwgMCAwIDAgNjAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjAzKSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-40" />
          <div className="relative">
            <nav className="flex items-center space-x-1 text-xs text-slate-400 mb-3">
              <Link href="/" className="hover:text-white transition-colors">Dashboard</Link>
              <span>&rsaquo;</span>
              <span className="hidden sm:inline">Cliente</span>
              <span className="hidden sm:inline">&rsaquo;</span>
              <span className="font-medium text-slate-200 truncate">{decodedClientName}</span>
            </nav>

            <div className="flex flex-col md:flex-row md:items-center gap-5">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-2xl font-bold shadow-lg shrink-0">
                {decodedClientName?.[0]?.toUpperCase() || "?"}
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl font-bold truncate">{decodedClientName}</h1>
                <div className="flex flex-wrap items-center gap-3 mt-2 text-slate-300 text-sm">
                  {ficha?.email && (
                    <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" /> {ficha.email}</span>
                  )}
                  {ficha?.rut && (
                    <span className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5" /> {ficha.rut}</span>
                  )}
                  {ficha?.clientCode && (
                    <span className="flex items-center gap-1"><Hash className="h-3.5 w-3.5" /> {ficha.clientCode}</span>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-start md:items-end gap-3">
                <div className="flex items-center gap-2 flex-wrap md:justify-end">
                  {canManage && accountStatus?.inEcommerce && (
                    <Button
                      onClick={() => setSuggestedOpen(true)}
                      size="sm"
                      className="rounded-xl bg-[#FF6E23] hover:bg-[#E55E13] text-white"
                      data-testid="button-enviar-sugerido"
                    >
                      <Send className="mr-2 h-4 w-4" /> Enviar sugerido
                    </Button>
                  )}
                  {canManage && !accountStatus?.inEcommerce && fichaIdForActivation && (
                    <Button
                      onClick={() => activateMarket.mutate()}
                      disabled={activateMarket.isPending}
                      size="sm"
                      className="rounded-xl bg-[#FF6E23] hover:bg-[#E55E13] text-white"
                      data-testid="button-activate-market"
                    >
                      <KeyRound className="mr-2 h-4 w-4" />
                      {activateMarket.isPending ? "Activando…" : "Activar Market"}
                    </Button>
                  )}
                  <Link href="/">
                    <Button variant="outline" size="sm" className="rounded-xl border-slate-600 bg-slate-800/50 text-slate-200 hover:bg-slate-700 hover:text-white" data-testid="button-back-dashboard">
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      <span className="hidden sm:inline">Volver al Dashboard</span>
                      <span className="sm:hidden">Volver</span>
                    </Button>
                  </Link>
                </div>
                {/* Status badges — the four client contexts */}
                <div className="flex items-center gap-2 flex-wrap md:justify-end">
                  {accountStatus?.inEcommerce ? (
                    <Badge className="bg-green-500/20 text-green-300 border-green-500/30 px-3 py-1">
                      <KeyRound className="h-3 w-3 mr-1" /> En eCommerce
                    </Badge>
                  ) : accountStatus?.pendingRequest ? (
                    <Badge className="bg-orange-500/20 text-orange-300 border-orange-500/30 px-3 py-1">
                      <Clock className="h-3 w-3 mr-1" /> Solicitó unirse
                    </Badge>
                  ) : accountStatus?.hasFicha ? (
                    <Badge className="bg-slate-500/30 text-slate-200 border-slate-400/30 px-3 py-1">
                      <UserCircle className="h-3 w-3 mr-1" /> Cliente registrado
                    </Badge>
                  ) : (
                    <Badge className="bg-slate-500/30 text-slate-200 border-slate-400/30 px-3 py-1">
                      <UserCircle className="h-3 w-3 mr-1" /> Cliente
                    </Badge>
                  )}
                  {accountStatus?.inEcommerce && (
                    accountStatus.linked ? (
                      <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 px-3 py-1">
                        <LinkIcon className="h-3 w-3 mr-1" /> Vinculado
                      </Badge>
                    ) : (
                      <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 px-3 py-1">
                        <Unlink className="h-3 w-3 mr-1" /> Sin ficha
                      </Badge>
                    )
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Filter toolbar */}
        <div className="bg-white border border-gray-200/60 px-3 sm:px-4 py-3 rounded-2xl shadow-sm">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Filtrar:</label>
              <Select value={filterType} onValueChange={handleFilterTypeChange}>
                <SelectTrigger className="w-24 rounded-xl border-gray-200 shadow-sm text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-gray-200">
                  <SelectItem value="day">Dia</SelectItem>
                  <SelectItem value="month">Mes</SelectItem>
                  <SelectItem value="year">Ano</SelectItem>
                  <SelectItem value="range">Rango</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Periodo:</label>
              {filterType === "day" ? (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-40 justify-start text-left font-normal rounded-xl border-gray-200 shadow-sm text-sm">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      <span>{selectedDate ? format(selectedDate, "dd/MM/yyyy") : "Seleccionar"}</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 rounded-xl border-gray-200" align="start">
                    <Calendar mode="single" selected={selectedDate} onSelect={setSelectedDate} initialFocus />
                  </PopoverContent>
                </Popover>
              ) : filterType === "range" ? (
                <div className="flex items-center gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-24 justify-start text-left font-normal rounded-xl border-gray-200 shadow-sm text-sm">
                        <CalendarIcon className="mr-1 h-3 w-3" />
                        <span>{startDate ? format(startDate, "dd/MM") : "Inicio"}</span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 rounded-xl border-gray-200" align="start">
                      <Calendar mode="single" selected={startDate} onSelect={setStartDate} initialFocus />
                    </PopoverContent>
                  </Popover>
                  <span className="text-gray-500">-</span>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-24 justify-start text-left font-normal rounded-xl border-gray-200 shadow-sm text-sm">
                        <CalendarIcon className="mr-1 h-3 w-3" />
                        <span>{endDate ? format(endDate, "dd/MM") : "Final"}</span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 rounded-xl border-gray-200" align="start">
                      <Calendar mode="single" selected={endDate} onSelect={setEndDate} initialFocus disabled={(date) => startDate ? date < startDate : false} />
                    </PopoverContent>
                  </Popover>
                </div>
              ) : filterType === "year" ? (
                <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
                  <SelectTrigger className="w-44 rounded-xl border-gray-200 shadow-sm text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-gray-200">
                    {availablePeriods?.years.map((year) => (
                      <SelectItem key={year.value} value={year.value}>{year.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Select value={selectedPeriod} onValueChange={handlePeriodChange}>
                  <SelectTrigger className="w-44 rounded-xl border-gray-200 shadow-sm text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-gray-200">
                    {availablePeriods?.months.map((month) => (
                      <SelectItem key={month.value} value={month.value}>{month.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {lastOrder?.feemdo && (
              <Button
                variant={isLastPurchaseActive ? "default" : "outline"}
                size="sm"
                onClick={handleLastPurchaseMonth}
                className={`rounded-xl shadow-sm text-sm whitespace-nowrap ${isLastPurchaseActive ? "bg-blue-600 hover:bg-blue-700 text-white" : "border-blue-300 text-blue-700 hover:bg-blue-50 hover:border-blue-400"}`}
                title={lastPurchaseLabel ? `Ir a ${lastPurchaseLabel}` : undefined}
              >
                <History className="mr-2 h-4 w-4" />
                Mes Ultima Compra
                {lastPurchaseLabel && (
                  <span className={`ml-1.5 text-xs ${isLastPurchaseActive ? "text-blue-100" : "text-blue-500"}`}>({lastPurchaseLabel})</span>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Pending request alert */}
        {accountStatus?.pendingRequest && !accountStatus?.inEcommerce && (
          <Card className="border-orange-200 bg-orange-50/60 shadow-sm">
            <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <Clock className="h-5 w-5 text-orange-500 mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-orange-800">Solicitud de acceso a Panorámica Market pendiente</h3>
                <p className="text-xs text-orange-600 mt-0.5">
                  {accountStatus.pendingRequest.contacto || accountStatus.pendingRequest.empresa} solicitó unirse el {formatDate(accountStatus.pendingRequest.createdAt)}.
                </p>
              </div>
              {canManage && (
                <Button
                  size="sm"
                  onClick={() => approveRequest.mutate()}
                  disabled={approveRequest.isPending}
                  className="rounded-xl bg-orange-500 hover:bg-orange-600 text-white shrink-0"
                  data-testid="button-approve-request"
                >
                  <KeyRound className="h-4 w-4 mr-2" />
                  {approveRequest.isPending ? "Aprobando…" : "Aprobar acceso"}
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* KPI Cards — compactas */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-3">
          <Card className="border-0 shadow-sm bg-gradient-to-br from-green-50 to-green-100/50">
            <CardContent className="p-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[10px] font-medium text-green-600 uppercase tracking-wider truncate">Compras Totales</p>
                  <p className="text-sm lg:text-base font-bold text-green-900 truncate" data-testid="text-total-purchases">
                    {isLoadingDetails ? '…' : formatCurrency(details?.totalPurchases || 0)}
                  </p>
                </div>
                <DollarSign className="h-5 w-5 text-green-400/60 shrink-0" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-gradient-to-br from-blue-50 to-blue-100/50">
            <CardContent className="p-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[10px] font-medium text-blue-600 uppercase tracking-wider truncate">Productos Diferentes</p>
                  <p className="text-sm lg:text-base font-bold text-blue-900 truncate" data-testid="text-total-products">
                    {isLoadingDetails ? '…' : formatNumber(details?.totalProducts || 0)}
                  </p>
                </div>
                <Package className="h-5 w-5 text-blue-400/60 shrink-0" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-gradient-to-br from-rose-50 to-rose-100/50">
            <CardContent className="p-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[10px] font-medium text-rose-600 uppercase tracking-wider truncate">Última Compra</p>
                  <p className="text-sm lg:text-base font-bold text-rose-900 truncate" data-testid="text-last-purchase">
                    {(() => {
                      const last = details?.lastPurchaseDate || lastOrder?.feemdo;
                      return last ? formatDate(last) : '—';
                    })()}
                  </p>
                </div>
                <CalendarIcon className="h-5 w-5 text-rose-400/60 shrink-0" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-gradient-to-br from-violet-50 to-violet-100/50">
            <CardContent className="p-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[10px] font-medium text-violet-600 uppercase tracking-wider truncate">Vendedor</p>
                  <p className="text-sm lg:text-base font-bold text-violet-900 truncate">{vendedor || '—'}</p>
                </div>
                <UserCircle className="h-5 w-5 text-violet-400/60 shrink-0" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-gradient-to-br from-teal-50 to-teal-100/50">
            <CardContent className="p-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[10px] font-medium text-teal-600 uppercase tracking-wider truncate">Segmentos</p>
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {details?.segments && details.segments.length > 0 ? (
                      details.segments.slice(0, 2).map((s, i) => (
                        <Badge key={i} variant="secondary" className="text-[9px] px-1.5 py-0 bg-teal-100 text-teal-700 hover:bg-teal-200">{s}</Badge>
                      ))
                    ) : (
                      <span className="text-sm font-bold text-teal-900">—</span>
                    )}
                  </div>
                </div>
                <Tag className="h-5 w-5 text-teal-400/60 shrink-0" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full flex h-auto p-1 bg-muted/50 rounded-xl gap-1">
            <TabsTrigger value="info" className="flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <UserCircle className="h-4 w-4" /> Información
            </TabsTrigger>
            <TabsTrigger value="pedidos" className="flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <FileText className="h-4 w-4" /> Pedidos
            </TabsTrigger>
            <TabsTrigger value="productos" className="flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <ShoppingBag className="h-4 w-4" /> Productos
            </TabsTrigger>
            <TabsTrigger value="despachos" className="flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <Truck className="h-4 w-4" /> Despachos
            </TabsTrigger>
          </TabsList>

          {/* Productos tab — products bought */}
          <TabsContent value="productos" className="mt-4">
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <ShoppingBag className="h-4 w-4 text-blue-500" />
                  Productos Comprados por el Cliente
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {isLoadingProducts ? (
                    <div className="space-y-3">
                      {[...Array(6)].map((_, i) => (
                        <div key={i} className="animate-pulse h-16 bg-gray-200 rounded-lg"></div>
                      ))}
                    </div>
                  ) : products.length === 0 ? (
                    <div className="text-center py-8 space-y-1">
                      {!lastOrder?.feemdo ? (
                        <p className="text-gray-500">Este cliente no tiene historial de compras registrado.</p>
                      ) : (
                        <>
                          <p className="text-gray-500">Sin compras en el período seleccionado.</p>
                          <p className="text-sm text-gray-400">Última compra: {formatDate(lastOrder.feemdo)}. Cambiá el período para verla.</p>
                        </>
                      )}
                    </div>
                  ) : (
                    products.map((product, index) => (
                      <div
                        key={product.productName}
                        className="flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                        data-testid={`product-${index}`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-3">
                            <Badge variant="outline" className="text-xs shrink-0">#{index + 1}</Badge>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-gray-900 truncate">{product.productName}</p>
                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
                                <p className="text-xs text-gray-500">{formatNumber(product.transactionCount)} transacciones</p>
                                <p className="text-xs text-gray-500">Precio promedio: {formatCurrency(product.averagePrice)}</p>
                                <p className={`text-xs ${getDaysColor(product.daysSinceLastPurchase)}`}>Ultima compra: {product.daysSinceLastPurchase} dias</p>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="text-right ml-4 shrink-0">
                          <p className="text-sm font-semibold text-gray-900">{formatCurrency(product.totalPurchases)}</p>
                          <p className="text-xs text-gray-500">{formatDate(product.lastPurchase)}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Información tab — general + commercial from ficha */}
          <TabsContent value="info" className="mt-4">
            {!accountStatus?.hasFicha ? (
              <Card className="border-amber-200 bg-amber-50/50 shadow-sm">
                <CardContent className="p-4 flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
                  <div>
                    <h3 className="text-sm font-semibold text-amber-800">Sin ficha SAP asociada</h3>
                    <p className="text-xs text-amber-600 mt-0.5">
                      Este cliente no tiene una ficha de cliente (SAP) en el sistema, por lo que no hay información comercial disponible. Los datos mostrados provienen del historial de ventas.
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                <Card className="border-0 shadow-sm">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <UserCircle className="h-4 w-4 text-blue-500" /> Información General
                      </CardTitle>
                      {canManage && (
                        editingFicha ? (
                          <div className="flex items-center gap-1.5">
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-muted-foreground" onClick={() => setEditingFicha(false)} disabled={saveFicha.isPending} data-testid="button-cancel-ficha">
                              <X className="h-4 w-4" />
                            </Button>
                            <Button size="sm" className="h-7 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white" onClick={() => saveFicha.mutate()} disabled={saveFicha.isPending} data-testid="button-save-ficha">
                              <Save className="h-3.5 w-3.5 mr-1.5" /> {saveFicha.isPending ? "Guardando…" : "Guardar"}
                            </Button>
                          </div>
                        ) : (
                          <Button size="sm" variant="outline" className="h-7 px-3 rounded-lg" onClick={startEditFicha} data-testid="button-edit-ficha">
                            <Pencil className="h-3.5 w-3.5 mr-1.5" /> Editar
                          </Button>
                        )
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-1">
                    {[
                      { label: "Nombre", field: "clientName", value: ficha?.clientName || decodedClientName, icon: UserCircle, editable: true },
                      { label: "Email", field: "email", value: ficha?.email, icon: Mail, editable: true },
                      { label: "RUT", field: null, value: ficha?.rut, icon: Building2, editable: false },
                      { label: "Código", field: null, value: ficha?.clientCode, icon: Hash, editable: false },
                      { label: "Teléfono", field: "phone", value: ficha?.phone, icon: Phone, editable: true },
                      { label: "Dirección", field: "address", value: ficha?.address, icon: MapPin, editable: true },
                      { label: "Comuna", field: "commune", value: ficha?.commune, icon: MapPin, editable: true },
                    ].map(({ label, value, icon: Icon, field, editable }) => (
                      <div key={label} className="flex items-center justify-between gap-3 py-2 border-b border-muted/50 last:border-0">
                        <span className="text-sm text-muted-foreground flex items-center gap-2 shrink-0"><Icon className="h-3.5 w-3.5" /> {label}</span>
                        {editingFicha && editable && field ? (
                          <Input
                            value={(fichaForm as any)[field]}
                            onChange={(e) => setFichaForm((s) => ({ ...s, [field]: e.target.value }))}
                            className="h-8 max-w-[65%] text-sm"
                            data-testid={`input-ficha-${field}`}
                          />
                        ) : (
                          <span className="text-sm font-medium text-right max-w-[60%] truncate">{value || "—"}</span>
                        )}
                      </div>
                    ))}

                    {canManageRetail && (
                      <div className="pt-3 mt-1 border-t border-muted/50">
                        {retailEntry ? (
                          <div className="flex items-center justify-center gap-2 text-sm text-emerald-700 py-1">
                            <Check className="h-4 w-4 shrink-0" />
                            <span>En el listado público de distribuidores{retailEntry.active === false ? " (oculto)" : ""}</span>
                          </div>
                        ) : (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full rounded-lg border-[#FF6E23]/40 text-[#FF6E23] hover:bg-[#FF6E23]/5 hover:text-[#FF6E23]"
                              onClick={() => addToRetail.mutate()}
                              disabled={!canAddToRetail || addToRetail.isPending}
                              data-testid="button-add-retail-location"
                            >
                              <MapPin className="h-4 w-4 mr-2" />
                              {addToRetail.isPending ? "Agregando…" : "Agregar a listado público de distribuidores"}
                            </Button>
                            {!canAddToRetail && (
                              <p className="text-[11px] text-muted-foreground mt-1.5 text-center">
                                Agregá una dirección en la ficha para poder publicarla en "Dónde Comprar".
                              </p>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-sm">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-emerald-500" /> Información Comercial
                      </CardTitle>
                      {canManage && (
                        editingComercial ? (
                          <div className="flex items-center gap-1.5">
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-muted-foreground" onClick={() => setEditingComercial(false)} disabled={savePriceList.isPending} data-testid="button-cancel-comercial">
                              <X className="h-4 w-4" />
                            </Button>
                            <Button size="sm" className="h-7 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => savePriceList.mutate()} disabled={savePriceList.isPending} data-testid="button-save-comercial">
                              <Save className="h-3.5 w-3.5 mr-1.5" /> {savePriceList.isPending ? "Guardando…" : "Guardar"}
                            </Button>
                          </div>
                        ) : (
                          <Button size="sm" variant="outline" className="h-7 px-3 rounded-lg" onClick={startEditComercial} data-testid="button-edit-comercial">
                            <Pencil className="h-3.5 w-3.5 mr-1.5" /> Editar
                          </Button>
                        )
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-1">
                    {([
                      { label: "Condición de Pago", value: ficha?.paymentCondition },
                      { label: "Vendedor", value: vendedor },
                      { label: "Lista de Precios", value: ficha?.priceList },
                      // Los cinco números de cobranza, en el orden en que se leen:
                      // cuánto se le dio, cuánto debe, cuánto de eso está vencido,
                      // cuánto está por vencer y cuánto le queda.
                      {
                        label: "Límite de Crédito",
                        value: cobranza.limite != null ? formatCurrency(cobranza.limite) : "Sin línea asignada",
                        valueClassName: cobranza.limite == null ? "text-slate-400 font-normal" : undefined,
                      },
                      {
                        label: "Deuda (saldo total)",
                        value: cobranza.deuda != null ? formatCurrency(cobranza.deuda) : null,
                        valueClassName: (cobranza.deuda ?? 0) > 0 ? "font-semibold" : undefined,
                      },
                      {
                        label: "Vencido",
                        value: cobranza.vencido != null ? formatCurrency(cobranza.vencido) : null,
                        valueClassName: (cobranza.vencido ?? 0) > 0 ? "text-red-600 font-semibold" : undefined,
                      },
                      { label: "Vencido desde", value: ficha?.overdueSince ? formatDate(ficha.overdueSince) : null, valueClassName: ficha?.overdueSince ? "text-red-600" : undefined },
                      { label: "Por vencer", value: cobranza.porVencer != null ? formatCurrency(cobranza.porVencer) : null },
                      { label: "Próximo vencimiento", value: ficha?.nextDueDate ? formatDate(ficha.nextDueDate) : null },
                      {
                        label: "Crédito Disponible",
                        value:
                          cobranza.disponible != null
                            ? formatCurrency(cobranza.disponible)
                            : cobranza.limite == null
                              ? "Sin línea asignada"
                              : null,
                        valueClassName: cobranza.excedido
                          ? "text-red-600 font-semibold"
                          : cobranza.limite == null
                            ? "text-slate-400 font-normal"
                            : undefined,
                      },
                    ] as { label: string; value: any; valueClassName?: string }[]).map(({ label, value, valueClassName }) => (
                      <div key={label} className="flex items-center justify-between gap-3 py-2 border-b border-muted/50 last:border-0">
                        <span className="text-sm text-muted-foreground shrink-0">{label}</span>
                        {label === "Lista de Precios" ? (
                          editingComercial ? (
                            <Select value={priceListForm} onValueChange={setPriceListForm}>
                              <SelectTrigger className="h-8 max-w-[65%] text-sm" data-testid="select-price-list">
                                <SelectValue placeholder="Seleccionar lista" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__erp__">Por defecto del ERP{ficha?.priceListErp ? ` (${ficha.priceListErp})` : ""}</SelectItem>
                                <SelectItem value="LP01">Lista Comercial (Por defecto)</SelectItem>
                                {customPriceLists.map((l) => (
                                  <SelectItem key={l.code} value={l.code}>{l.name} ({l.code})</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className="text-sm font-medium text-right max-w-[60%] truncate flex items-center gap-1.5 justify-end">
                              {ficha?.priceListOverride && <Badge variant="secondary" className="text-[9px] px-1.5 py-0">manual</Badge>}
                              {getListName(ficha?.priceList)}
                            </span>
                          )
                        ) : (
                          <span className={`text-sm font-medium text-right max-w-[60%] truncate ${valueClassName ?? ""}`}>{value || "—"}</span>
                        )}
                      </div>
                    ))}

                    {/* De dónde salen los números: son la suma de los documentos
                        de la tarjeta de al lado, no otra fuente. */}
                    {cobranza.derivadoDelDetalle && (
                      <p className="pt-2 text-[11px] text-muted-foreground" data-testid="text-cobranza-origen">
                        Deuda, vencido y por vencer suman los {cobranza.documentos}{" "}
                        {cobranza.documentos === 1 ? "documento pendiente" : "documentos pendientes"} de Cuentas por Cobrar.
                        {cobranza.excedido && <span className="text-red-600 font-semibold"> Crédito excedido.</span>}
                      </p>
                    )}

                    {canManage && (
                      <div className="pt-3 mt-1 border-t border-muted/50">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full rounded-lg border-rose-300 text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                          onClick={openCobranza}
                          data-testid="button-enviar-cobranza"
                        >
                          <Send className="h-4 w-4 mr-2" /> Enviar cobranza
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Cuentas por Cobrar — detalle de facturas pendientes */}
                <Card className="border-0 shadow-sm md:col-span-2">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileText className="h-4 w-4 text-emerald-500" /> Cuentas por Cobrar
                      {carteraDocs.length > 0 && (
                        <Badge variant="outline" className="ml-auto text-[10px] font-bold">{carteraDocs.length} pend.</Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {isLoadingCartera ? (
                      <div className="space-y-2">
                        {[...Array(3)].map((_, i) => (
                          <div key={i} className="animate-pulse h-12 bg-gray-100 rounded-lg" />
                        ))}
                      </div>
                    ) : carteraDocs.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-6">Sin facturas pendientes de pago.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {carteraDocs.map((d) => (
                          <div key={`${d.tido}-${d.nudo}`} className="flex items-center justify-between gap-3 py-2 border-b border-muted/50 last:border-0">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">{d.tido} N° {d.nudo}</span>
                                {d.vencida ? (
                                  <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-red-200 text-[10px] font-bold">Vencida</Badge>
                                ) : (
                                  <Badge variant="outline" className="text-[10px] font-bold text-muted-foreground">Por vencer</Badge>
                                )}
                              </div>
                              <p className={`text-xs mt-0.5 ${d.vencida ? "text-red-600" : "text-muted-foreground"}`}>
                                Vence {d.vencimiento ? formatDate(d.vencimiento) : "—"}
                              </p>
                            </div>
                            <span className={`text-sm font-semibold shrink-0 ${d.vencida ? "text-red-600" : ""}`}>{formatCurrency(d.saldo)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* Pedidos tab — Documentos ERP (FCV/NVV) + Pedidos Market + Historial SAP */}
          <TabsContent value="pedidos" className="mt-4 space-y-4">
            {/* Documentos ERP: notas de venta pendientes (NVV) + facturas (FCV) */}
            {canManage && fichaIdForActivation && (
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Receipt className="h-4 w-4 text-emerald-500" /> Documentos ERP (FCV / NVV)
                    <span className="ml-auto flex items-center gap-2">
                      <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700 text-[10px] font-bold">{nvvDocs.length} NVV pend.</Badge>
                      <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 text-[10px] font-bold">{fcvDocs.length} FCV</Badge>
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoadingErp ? (
                    <div className="space-y-2">
                      {[...Array(4)].map((_, i) => (
                        <div key={i} className="animate-pulse h-14 bg-gray-200 rounded-lg"></div>
                      ))}
                    </div>
                  ) : erpDocuments.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">Sin documentos de venta en el ERP para este cliente.</p>
                  ) : (
                    <div className="space-y-4">
                      {nvvDocs.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-[11px] font-bold uppercase tracking-wider text-amber-600">Notas de venta pendientes de facturación</p>
                          {nvvDocs.map((d) => (
                            <div key={d.id} className="flex items-center justify-between p-3 rounded-lg border border-amber-200 bg-amber-50/40">
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-amber-200 text-[10px] font-bold">NVV</Badge>
                                  <span className="text-sm font-semibold text-gray-900">N° {d.orderNumber ?? "—"}</span>
                                  <Badge variant="outline" className="text-amber-700 border-amber-200 text-[10px] font-bold gap-1"><Clock className="h-3 w-3" /> Pendiente facturación</Badge>
                                </div>
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-xs text-gray-500">
                                  <span className="flex items-center gap-1"><CalendarIcon className="h-3 w-3" /> {formatDate(d.date || undefined)}</span>
                                  {d.deliveryDate && <span className="flex items-center gap-1"><Truck className="h-3 w-3" /> Entrega: {formatDate(d.deliveryDate)}</span>}
                                  {d.salesperson && <span className="flex items-center gap-1"><UserCircle className="h-3 w-3" /> {d.salesperson}</span>}
                                  <span>{formatNumber(d.items)} ítems</span>
                                </div>
                              </div>
                              <div className="text-right ml-4 shrink-0">
                                <p className="text-sm font-semibold text-gray-900">{formatCurrency(d.total)}</p>
                                {d.totalPending ? <p className="text-xs text-amber-600 font-medium">Pend.: {formatCurrency(d.totalPending)}</p> : null}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {fcvDocs.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">Facturas</p>
                          {fcvDocs.map((d) => (
                            <div key={d.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200 text-[10px] font-bold">FCV</Badge>
                                  <span className="text-sm font-semibold text-gray-900">N° {d.orderNumber ?? "—"}</span>
                                  <Badge variant="outline" className="text-emerald-700 border-emerald-200 text-[10px] font-bold">Facturado</Badge>
                                </div>
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-xs text-gray-500">
                                  <span className="flex items-center gap-1"><CalendarIcon className="h-3 w-3" /> {formatDate(d.date || undefined)}</span>
                                  {d.salesperson && <span className="flex items-center gap-1"><UserCircle className="h-3 w-3" /> {d.salesperson}</span>}
                                  <span>{formatNumber(d.items)} ítems</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-3 ml-4 shrink-0">
                                <p className="text-sm font-semibold text-gray-900">{formatCurrency(d.total)}</p>
                                {d.idmaeedo ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 gap-1.5 text-xs"
                                    onClick={() => window.open(`/api/erp/facturas/${d.idmaeedo}/pdf`, "_blank", "noopener")}
                                    title="Descargar factura en PDF"
                                  >
                                    <FileText className="h-3.5 w-3.5" /> PDF
                                  </Button>
                                ) : null}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Pedidos Panorámica Market — con seguimiento de envío */}
            {canManage && accountStatus?.inEcommerce && (
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Store className="h-4 w-4 text-[#FF6E23]" /> Pedidos Panorámica Market
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {marketOrders.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">Este cliente aún no tiene pedidos en Panorámica Market.</p>
                  ) : (
                    <div className="space-y-2">
                      {marketOrders.map((order: any) => {
                        const cfg = statusConfig[(order.status || "pending").toLowerCase()] || statusConfig.pending;
                        return (
                          <div key={order.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-semibold text-gray-900">Pedido #{String(order.id).slice(0, 8)}</span>
                                <Badge variant="outline" className={`text-[10px] font-bold ${cfg.bg} ${cfg.color}`}>{cfg.label}</Badge>
                              </div>
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-xs text-gray-500">
                                <span className="flex items-center gap-1"><CalendarIcon className="h-3 w-3" /> {formatDate(order.createdAt)}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <p className="text-sm font-semibold text-gray-900">{formatCurrency(Number(order.total) || 0)}</p>
                              <Button
                                size="sm"
                                variant="outline"
                                className="rounded-lg gap-1.5 h-8"
                                onClick={() => setTrackingOrderId(order.id)}
                                data-testid={`button-tracking-${order.id}`}
                              >
                                <Truck className="h-3.5 w-3.5" /> Ver seguimiento
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Historial de compras SAP */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4 text-blue-500" /> Historial de Compras (SAP)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {isLoadingHistory ? (
                    <div className="space-y-2">
                      {[...Array(6)].map((_, i) => (
                        <div key={i} className="animate-pulse h-14 bg-gray-200 rounded-lg"></div>
                      ))}
                    </div>
                  ) : purchaseHistory.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">Sin compras registradas para este cliente</p>
                  ) : (
                    purchaseHistory.map((item, index) => (
                      <div key={`${item.id}-${index}`} className="flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-900 truncate">{item.nokopr || 'Producto'}</p>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5 text-xs text-gray-500">
                            <span className="flex items-center gap-1"><CalendarIcon className="h-3 w-3" /> {formatDate(item.feemdo)}</span>
                            {item.nudo && <span className="flex items-center gap-1"><Hash className="h-3 w-3" /> {item.nudo}</span>}
                            {item.nokofu && <span className="flex items-center gap-1"><UserCircle className="h-3 w-3" /> {item.nokofu}</span>}
                          </div>
                        </div>
                        <p className="text-sm font-semibold text-gray-900 ml-4 shrink-0">{formatCurrency(Number(item.monto) || 0)}</p>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Despachos tab — espejo del TMS acotado al RUT de este cliente */}
          <TabsContent value="despachos" className="mt-4">
            {ficha?.rut ? (
              <TmsOrdersPanel clienteIdErp={ficha.rut} />
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
                Este cliente no tiene RUT/ficha SAP asociada, por lo que no podemos mostrar sus despachos del TMS.
              </div>
            )}
          </TabsContent>
        </Tabs>

        {canManage && accountStatus?.inEcommerce && suggestedOpen && (
          <SuggestedOrderModal
            open={suggestedOpen}
            client={{ clientName: decodedClientName, clientCode: ficha?.clientCode || null }}
            onClose={() => setSuggestedOpen(false)}
          />
        )}

        {/* Seguimiento de envío del pedido (reutiliza el sistema de envío existente) */}
        <Dialog open={!!trackingOrderId} onOpenChange={(open) => !open && setTrackingOrderId(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5 text-[#FF6E23]" /> Seguimiento del pedido
              </DialogTitle>
            </DialogHeader>
            {trackingOrderId && <OrderTrackingTimeline orderId={trackingOrderId} />}
          </DialogContent>
        </Dialog>

        {/* Credenciales de acceso a Panorámica Market */}
        <Dialog open={!!marketCreds} onOpenChange={(open) => !open && setMarketCreds(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-[#FF6E23]" />
                {marketCreds?.created ? "Acceso creado" : "Acceso ya existente"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {marketCreds?.created
                  ? "Entregá estas credenciales al cliente para que ingrese a Panorámica Market. La contraseña no vuelve a mostrarse."
                  : "Este cliente ya tenía acceso. Por seguridad, la contraseña está cifrada y no se puede recuperar."}
              </p>

              {marketCreds?.loginEmail ? (
                <CredField label="Usuario (email de acceso)" value={marketCreds.loginEmail} />
              ) : (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700 flex gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    La ficha no tiene un email cargado, por lo que el cliente <strong>no podrá iniciar sesión</strong>.
                    Cargá un email en la ficha del cliente y volvé a activar el acceso.
                  </span>
                </div>
              )}

              {marketCreds?.tempPassword ? (
                <CredField label="Contraseña inicial" value={marketCreds.tempPassword} />
              ) : marketCreds && !marketCreds.created ? (
                <p className="text-xs text-muted-foreground">Contraseña: definida previamente (no recuperable).</p>
              ) : null}

              <div className="flex justify-end pt-2">
                <Button
                  className="rounded-xl bg-[#FF6E23] hover:bg-[#E55E13] text-white"
                  onClick={() => setMarketCreds(null)}
                >
                  Listo
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Enviar cobranza — vista previa + edición antes de enviar */}
        <Dialog open={cobranzaOpen} onOpenChange={(open) => { if (!open) setCobranzaOpen(false); }}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Send className="h-5 w-5 text-rose-600" /> Enviar cobranza
              </DialogTitle>
            </DialogHeader>

            <div className="grid gap-5 md:grid-cols-2">
              {/* Formulario */}
              <div className="space-y-4">
                <div>
                  <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Tipo de cobranza</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant={cobranzaMode === "porvencer" ? "default" : "outline"}
                      size="sm"
                      className={`rounded-lg text-xs ${cobranzaMode === "porvencer" ? "bg-amber-500 hover:bg-amber-600 text-white" : ""}`}
                      onClick={() => applyCobranzaMode("porvencer")}
                    >
                      <Clock className="h-3.5 w-3.5 mr-1.5" /> Recordatorio de vencimiento
                    </Button>
                    <Button
                      type="button"
                      variant={cobranzaMode === "vencidas" ? "default" : "outline"}
                      size="sm"
                      className={`rounded-lg text-xs ${cobranzaMode === "vencidas" ? "bg-rose-600 hover:bg-rose-700 text-white" : ""}`}
                      onClick={() => applyCobranzaMode("vencidas")}
                    >
                      <AlertTriangle className="h-3.5 w-3.5 mr-1.5" /> Facturas vencidas
                    </Button>
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Correo del cliente</Label>
                  <Input className="mt-1.5" value={cobranzaEmail} onChange={(e) => setCobranzaEmail(e.target.value)} placeholder={ficha?.email || "cliente@correo.cl"} data-testid="input-cobranza-email" />
                  {!ficha?.email && (
                    <p className="text-[11px] text-amber-600 mt-1">La ficha no tiene correo registrado. Ingresá uno para poder enviar.</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground">Monto (CLP)</Label>
                    <Input className="mt-1.5" type="number" value={cobranzaMonto} onChange={(e) => setCobranzaMonto(e.target.value)} placeholder="0" data-testid="input-cobranza-monto" />
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground">{cobranzaMode === "vencidas" ? "Vencido desde" : "Fecha de vencimiento"}</Label>
                    <Input className="mt-1.5" type="date" value={cobranzaFecha} onChange={(e) => setCobranzaFecha(e.target.value)} data-testid="input-cobranza-fecha" />
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-medium text-muted-foreground">N° documento (opcional)</Label>
                  <Input className="mt-1.5" value={cobranzaDoc} onChange={(e) => setCobranzaDoc(e.target.value)} placeholder="Ej: FCV 12345" />
                </div>

                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Asunto (opcional)</Label>
                  <Input className="mt-1.5" value={cobranzaSubject} onChange={(e) => setCobranzaSubject(e.target.value)} placeholder="Se genera automáticamente si lo dejás vacío" />
                </div>

                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Mensaje</Label>
                  <Textarea className="mt-1.5" rows={4} value={cobranzaMensaje} onChange={(e) => setCobranzaMensaje(e.target.value)} data-testid="textarea-cobranza-mensaje" />
                </div>

                <div className="flex items-center gap-2">
                  <Switch id="cob-cc" checked={cobranzaCcInternal} onCheckedChange={setCobranzaCcInternal} />
                  <Label htmlFor="cob-cc" className="text-sm cursor-pointer">Copia al equipo interno de cobranzas</Label>
                </div>
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">CC adicional (opcional)</Label>
                  <Input className="mt-1.5" value={cobranzaExtraCc} onChange={(e) => setCobranzaExtraCc(e.target.value)} placeholder="cobranzas@empresa.cl, ..." />
                </div>
              </div>

              {/* Vista previa */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium text-muted-foreground">Vista previa del correo</Label>
                  <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => fetchCobranzaPreview()} disabled={cobranzaPreviewLoading}>
                    {cobranzaPreviewLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Actualizar"}
                  </Button>
                </div>
                {cobranzaPreview?.subject && (
                  <p className="text-xs text-muted-foreground truncate"><span className="font-medium">Asunto:</span> {cobranzaPreview.subject}</p>
                )}
                <div className="rounded-lg border bg-muted/20 overflow-hidden h-[440px]">
                  {cobranzaPreview?.html ? (
                    <iframe title="Vista previa cobranza" srcDoc={cobranzaPreview.html} sandbox="" className="w-full h-full border-0 bg-white" />
                  ) : (
                    <div className="flex items-center justify-center h-full text-sm text-muted-foreground p-4 text-center">
                      {cobranzaPreviewLoading
                        ? "Generando vista previa…"
                        : (Number(cobranzaMonto) > 0 && cobranzaFecha ? "—" : "Completá monto y fecha para ver la vista previa.")}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-3 mt-1 border-t">
              <Button variant="outline" onClick={() => setCobranzaOpen(false)} disabled={sendCobranza.isPending}>Cancelar</Button>
              <Button
                className="bg-rose-600 hover:bg-rose-700 text-white"
                onClick={() => sendCobranza.mutate()}
                disabled={!canSendCobranza || sendCobranza.isPending}
                data-testid="button-confirm-cobranza"
              >
                {sendCobranza.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                {sendCobranza.isPending ? "Enviando…" : "Enviar cobranza"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
