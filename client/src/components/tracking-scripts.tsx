import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";

const PUBLIC_TRACKED_PATHS = ["/tienda", "/shop", "/catalogo", "/p/", "/pedido-confirmado", "/carrito"];

function isPublicCatalogPath(pathname: string): boolean {
  return PUBLIC_TRACKED_PATHS.some((p) => pathname === p || pathname.startsWith(p === "/p/" ? "/p/" : `${p}/`) || pathname === p);
}

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

type StoreConfig = {
  trackingSettings?: TrackingSettings | null;
};

declare global {
  interface Window {
    dataLayer: any[];
    gtag: (...args: any[]) => void;
    fbq: any;
    _fbq: any;
    __panoramicaTrackingLoaded?: boolean;
  }
}

function injectGoogleTag(tagIds: string[]) {
  if (tagIds.length === 0) return;
  const primaryId = tagIds[0];
  if (document.getElementById("panoramica-gtag-loader")) return;

  const s = document.createElement("script");
  s.id = "panoramica-gtag-loader";
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${primaryId}`;
  document.head.appendChild(s);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    window.dataLayer.push(arguments as any);
  };
  window.gtag("js", new Date());
  tagIds.forEach((id) => window.gtag("config", id));
}

function injectMetaPixel(pixelId: string) {
  if (!pixelId) return;
  if (document.getElementById("panoramica-fbq-loader")) return;

  /* eslint-disable */
  (function (f: any, b: any, e: any, v: any, n?: any, t?: any, s?: any) {
    if (f.fbq) return;
    n = f.fbq = function () {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
    };
    if (!f._fbq) f._fbq = n;
    n.push = n;
    n.loaded = !0;
    n.version = "2.0";
    n.queue = [];
    t = b.createElement(e);
    t.async = !0;
    t.id = "panoramica-fbq-loader";
    t.src = v;
    s = b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t, s);
  })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
  /* eslint-enable */

  window.fbq("init", pixelId);
  window.fbq("track", "PageView");
}

export function TrackingScripts() {
  const [location] = useLocation();

  const { data: config } = useQuery<StoreConfig>({
    queryKey: ["/api/ecommerce/store-config"],
    staleTime: 5 * 60 * 1000,
    enabled: isPublicCatalogPath(location),
  });

  const tracking = config?.trackingSettings;

  useEffect(() => {
    if (!isPublicCatalogPath(location)) return;
    if (!tracking || !tracking.enabled) return;
    if (window.__panoramicaTrackingLoaded) return;
    window.__panoramicaTrackingLoaded = true;

    const tagIds = [tracking.googleTagId, tracking.googleAdsId].filter(Boolean) as string[];
    if (tagIds.length > 0) injectGoogleTag(tagIds);
    if (tracking.metaPixelId) injectMetaPixel(tracking.metaPixelId);
  }, [tracking, location]);

  return null;
}

/** Dispara un evento GA4 y Meta Pixel. No hace nada si tracking está apagado. */
export function trackEvent(eventName: string, params: Record<string, any> = {}) {
  try {
    if (typeof window !== "undefined" && typeof window.gtag === "function") {
      window.gtag("event", eventName, params);
    }
    if (typeof window !== "undefined" && typeof window.fbq === "function") {
      const fbMap: Record<string, string> = {
        view_item: "ViewContent",
        add_to_cart: "AddToCart",
        begin_checkout: "InitiateCheckout",
        purchase: "Purchase",
      };
      const fbEvent = fbMap[eventName];
      if (fbEvent) window.fbq("track", fbEvent, params);
    }
  } catch {
    // swallow tracking errors
  }
}

/** Dispara una conversión de Google Ads si hay label configurado. */
export function trackGoogleAdsConversion(
  label: string | undefined,
  adsId: string | undefined,
  params: Record<string, any> = {},
) {
  if (!label || !adsId) return;
  try {
    if (typeof window !== "undefined" && typeof window.gtag === "function") {
      window.gtag("event", "conversion", {
        send_to: `${adsId}/${label}`,
        ...params,
      });
    }
  } catch {
    /* ignore */
  }
}
