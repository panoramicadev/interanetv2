import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Loader2, ArrowLeft, ShoppingCart, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { TrackingScripts, trackEvent, trackGoogleAdsConversion } from "@/components/tracking-scripts";

type PublicProduct = {
  id: string;
  slug: string;
  descripcion?: string | null;
  imagenUrl?: string | null;
  precioEcommerce?: string | null;
  productFamily?: string | null;
  color?: string | null;
  variantGenericDisplayName?: string | null;
  categoria?: string | null;
  formatUnit?: string | null;
  sku?: string | null;
  plProducto?: string | null;
  activo?: boolean;
};

type StoreConfig = {
  siteName?: string;
  logoUrl?: string;
  trackingSettings?: {
    googleAdsId?: string;
    googleAdsConversions?: { viewItem?: string };
  };
};

function formatCLP(value: any) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(n);
}

export default function ProductoPublicPage() {
  const [, params] = useRoute<{ slug: string }>("/p/:slug");
  const slug = params?.slug;
  const { toast } = useToast();

  const { data: product, isLoading, isError } = useQuery<PublicProduct>({
    queryKey: [`/api/public/products/by-slug/${slug}`],
    enabled: !!slug,
  });

  const { data: store } = useQuery<StoreConfig>({
    queryKey: ["/api/ecommerce/store-config"],
  });

  const title =
    product?.descripcion ||
    product?.variantGenericDisplayName ||
    [product?.productFamily, product?.color].filter(Boolean).join(" ") ||
    product?.plProducto ||
    "";

  useEffect(() => {
    if (!product) return;
    trackEvent("view_item", {
      currency: "CLP",
      value: Number(product.precioEcommerce) || 0,
      items: [
        {
          item_id: product.sku || product.id,
          item_name: title,
          item_category: product.categoria || undefined,
          price: Number(product.precioEcommerce) || 0,
        },
      ],
    });
    trackGoogleAdsConversion(
      store?.trackingSettings?.googleAdsConversions?.viewItem,
      store?.trackingSettings?.googleAdsId,
      {
        value: Number(product.precioEcommerce) || 0,
        currency: "CLP",
      },
    );
  }, [product, title, store?.trackingSettings]);

  const handleShare = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
    } catch {
      /* user cancelled */
    }
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copiado", description: "Ya podés compartirlo." });
    } catch {
      toast({ title: "No se pudo copiar", description: url });
    }
  };

  const handleBuy = () => {
    if (!slug) return;
    window.location.href = `/tienda?openProduct=${encodeURIComponent(slug)}`;
  };

  if (!slug) return null;

  return (
    <>
      <TrackingScripts />
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
        <header className="border-b bg-white sticky top-0 z-10">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
            <Link href="/tienda">
              <a className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900">
                <ArrowLeft className="w-4 h-4" />
                Volver al catálogo
              </a>
            </Link>
            {store?.logoUrl ? (
              <img src={store.logoUrl} alt={store?.siteName || "Logo"} className="h-8" />
            ) : (
              <span className="font-semibold text-slate-800">{store?.siteName || "Pinturas Panorámica"}</span>
            )}
          </div>
        </header>

        <main className="max-w-5xl mx-auto px-4 py-6 md:py-10">
          {isLoading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
            </div>
          )}
          {isError && (
            <Card>
              <CardContent className="py-12 text-center">
                <h1 className="text-xl font-semibold mb-2">Producto no disponible</h1>
                <p className="text-slate-500 mb-6">Este producto no se encuentra o fue retirado del catálogo.</p>
                <Link href="/tienda">
                  <Button>Ver catálogo completo</Button>
                </Link>
              </CardContent>
            </Card>
          )}
          {product && (
            <div className="grid md:grid-cols-2 gap-8 md:gap-12">
              <div className="bg-white rounded-xl border p-4 md:p-6 flex items-center justify-center">
                {product.imagenUrl ? (
                  <img
                    src={product.imagenUrl}
                    alt={title}
                    className="max-w-full max-h-[480px] object-contain"
                  />
                ) : (
                  <div className="w-full aspect-square bg-slate-100 rounded-lg flex items-center justify-center text-slate-400">
                    Sin imagen
                  </div>
                )}
              </div>

              <div className="flex flex-col">
                {product.productFamily && (
                  <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">
                    {product.productFamily}
                  </p>
                )}
                <h1 className="text-2xl md:text-3xl font-bold text-slate-900 leading-tight">
                  {title}
                </h1>
                {product.color && (
                  <p className="text-slate-600 mt-1">Color: <span className="font-medium">{product.color}</span></p>
                )}

                {product.precioEcommerce && (
                  <div className="mt-6 bg-[#FF6E23]/5 rounded-lg px-5 py-4">
                    <div className="text-3xl md:text-4xl font-bold text-[#FF6E23]">
                      {formatCLP(product.precioEcommerce)}
                    </div>
                    {product.formatUnit && (
                      <div className="text-sm text-slate-500 mt-1">por {product.formatUnit}</div>
                    )}
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-3 mt-6">
                  <Button size="lg" className="flex-1 bg-[#FF6E23] hover:bg-[#FF6E23]/90" onClick={handleBuy}>
                    <ShoppingCart className="w-5 h-5 mr-2" />
                    Comprar ahora
                  </Button>
                  <Button size="lg" variant="outline" onClick={handleShare}>
                    <Share2 className="w-5 h-5 mr-2" />
                    Compartir
                  </Button>
                </div>

                <div className="mt-8 space-y-3 text-sm">
                  {product.sku && (
                    <div className="flex gap-2">
                      <span className="font-medium text-slate-700 w-28">Código:</span>
                      <span className="text-slate-600 font-mono">{product.sku}</span>
                    </div>
                  )}
                  {product.categoria && (
                    <div className="flex gap-2">
                      <span className="font-medium text-slate-700 w-28">Categoría:</span>
                      <span className="text-slate-600">{product.categoria}</span>
                    </div>
                  )}
                  {product.formatUnit && (
                    <div className="flex gap-2">
                      <span className="font-medium text-slate-700 w-28">Formato:</span>
                      <span className="text-slate-600">{product.formatUnit}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </main>

        <footer className="border-t mt-12 py-6 text-center text-sm text-slate-500">
          © {new Date().getFullYear()} {store?.siteName || "Pinturas Panorámica"}
        </footer>
      </div>
    </>
  );
}
