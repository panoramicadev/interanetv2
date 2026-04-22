import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save, BarChart3, Facebook, Globe } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

type TrackingSettings = {
  enabled?: boolean;
  googleTagId?: string;
  googleAdsId?: string;
  googleAdsConversions?: {
    viewItem?: string;
    addToCart?: string;
    beginCheckout?: string;
    purchase?: string;
  };
  metaPixelId?: string;
};

type StoreConfig = { trackingSettings?: TrackingSettings };

const empty: TrackingSettings = {
  enabled: false,
  googleTagId: "",
  googleAdsId: "",
  googleAdsConversions: { viewItem: "", addToCart: "", beginCheckout: "", purchase: "" },
  metaPixelId: "",
};

export default function TrackingConfigSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: config, isLoading } = useQuery<StoreConfig>({ queryKey: ["/api/ecommerce/store-config"] });

  const [form, setForm] = useState<TrackingSettings>(empty);

  useEffect(() => {
    if (config?.trackingSettings) {
      setForm({ ...empty, ...config.trackingSettings, googleAdsConversions: { ...empty.googleAdsConversions, ...(config.trackingSettings.googleAdsConversions || {}) } });
    }
  }, [config]);

  const saveMutation = useMutation({
    mutationFn: async (ts: TrackingSettings) => {
      const res = await fetch("/api/ecommerce/store-config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackingSettings: ts }),
      });
      if (!res.ok) throw new Error("Error guardando configuración");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ecommerce/store-config"] });
      toast({ title: "Configuración guardada", description: "Los códigos de tracking se aplicarán en el catálogo público." });
    },
    onError: (e: any) => toast({ title: "Error", description: e?.message || "No se pudo guardar", variant: "destructive" }),
  });

  const setField = (key: keyof TrackingSettings, value: any) => setForm((prev) => ({ ...prev, [key]: value }));
  const setConv = (key: keyof NonNullable<TrackingSettings["googleAdsConversions"]>, value: string) =>
    setForm((prev) => ({ ...prev, googleAdsConversions: { ...(prev.googleAdsConversions || {}), [key]: value } }));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-muted-foreground" />
                Tracking del catálogo
              </CardTitle>
              <CardDescription>
                Códigos de seguimiento para Google Ads / GA4 y Meta Pixel. Se aplican únicamente en el catálogo público
                (<code className="text-xs bg-muted px-1 rounded">/tienda</code>, <code className="text-xs bg-muted px-1 rounded">/catalogo/*</code>, <code className="text-xs bg-muted px-1 rounded">/p/*</code>).
              </CardDescription>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <Label htmlFor="tracking-enabled" className="text-sm">Activo</Label>
              <Switch id="tracking-enabled" checked={!!form.enabled} onCheckedChange={(v) => setField("enabled", v)} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="gtag">
                <Globe className="inline w-4 h-4 mr-1 -mt-0.5" /> Google Tag / GA4 ID
              </Label>
              <Input
                id="gtag"
                placeholder="G-XXXXXXXXXX"
                value={form.googleTagId || ""}
                onChange={(e) => setField("googleTagId", e.target.value.trim())}
              />
              <p className="text-xs text-muted-foreground">Formato: <code>G-XXXXXXXX</code>. Se usa para medir tráfico del catálogo.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ads">Google Ads ID</Label>
              <Input
                id="ads"
                placeholder="AW-XXXXXXXXXX"
                value={form.googleAdsId || ""}
                onChange={(e) => setField("googleAdsId", e.target.value.trim())}
              />
              <p className="text-xs text-muted-foreground">Formato: <code>AW-XXXXXXXX</code>. Necesario para reportar conversiones.</p>
            </div>
          </div>

          <div className="border rounded-lg p-4 bg-slate-50/60">
            <h4 className="text-sm font-semibold mb-3">Labels de conversión Google Ads</h4>
            <p className="text-xs text-muted-foreground mb-4">
              Pegá solo el <em>label</em> (parte después de la barra en <code>AW-XXXXX/<b>ABC123</b></code>). Dejá vacíos los que no uses.
            </p>
            <div className="grid md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Ver producto</Label>
                <Input placeholder="label view_item" value={form.googleAdsConversions?.viewItem || ""} onChange={(e) => setConv("viewItem", e.target.value.trim())} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Agregar al carrito</Label>
                <Input placeholder="label add_to_cart" value={form.googleAdsConversions?.addToCart || ""} onChange={(e) => setConv("addToCart", e.target.value.trim())} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Iniciar checkout</Label>
                <Input placeholder="label begin_checkout" value={form.googleAdsConversions?.beginCheckout || ""} onChange={(e) => setConv("beginCheckout", e.target.value.trim())} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Compra</Label>
                <Input placeholder="label purchase" value={form.googleAdsConversions?.purchase || ""} onChange={(e) => setConv("purchase", e.target.value.trim())} />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="metaPixel">
              <Facebook className="inline w-4 h-4 mr-1 -mt-0.5" /> Meta Pixel ID (Facebook / Instagram)
            </Label>
            <Input
              id="metaPixel"
              placeholder="1234567890123456"
              value={form.metaPixelId || ""}
              onChange={(e) => setField("metaPixelId", e.target.value.trim())}
            />
            <p className="text-xs text-muted-foreground">ID numérico del Pixel. Dispara <code>ViewContent</code>, <code>AddToCart</code>, <code>Purchase</code> automáticamente.</p>
          </div>

          <div className="flex justify-end pt-2">
            <Button onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Guardar cambios
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">URLs únicas por producto</CardTitle>
          <CardDescription>
            Cada producto activo del catálogo tiene una URL pública del tipo <code className="text-xs bg-muted px-1 rounded">/p/[slug]</code>. Usá estos links en tus
            campañas de Google Ads / Meta para llevar al usuario directo a la ficha del producto.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-1">
            <li>El slug se genera automáticamente (legible, amigable para SEO).</li>
            <li>Se inyectan meta tags OG para preview en WhatsApp, Facebook y Twitter.</li>
            <li>La experiencia de navegación del catálogo (modal) no cambia: la URL única es un punto de entrada adicional.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
