import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapPin, Search, X, Phone, Globe, Navigation, Store, Factory, Wrench } from "lucide-react";
import { Link } from "wouter";

type RetailLocation = {
  id: string;
  name: string;
  type: "sucursal_propia" | "distribuidor" | "ferreteria";
  address: string;
  comuna?: string | null;
  region?: string | null;
  latitude: string | null;
  longitude: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  schedule?: string | null;
  logoUrl?: string | null;
  notes?: string | null;
};

const TYPE_META: Record<RetailLocation["type"], { label: string; color: string; icon: typeof Store }> = {
  sucursal_propia: { label: "Sucursal Panorámica", color: "#ff7f33", icon: Factory },
  distribuidor: { label: "Distribuidor", color: "#2563eb", icon: Store },
  ferreteria: { label: "Ferretería", color: "#ec4899", icon: Wrench },
};

// Pin compacto naranja con el ícono "C" Panorámica centrado en círculo blanco.
// Si la ubicación tiene un logo propio cargado, lo usa en lugar del default.
const PIN_DEFAULT_LOGO = "/panoramica-icon.png";
function makeIcon(_color: string, logoUrl?: string | null, _isFerreteria = false) {
  const PIN_COLOR = "#ff7f33"; // naranja Panorámica
  const innerLogo = logoUrl || PIN_DEFAULT_LOGO;
  // Tamaño del pin: 36×46. Círculo blanco interior 28×28 con el logo a tamaño completo.
  // El z-index explícito es necesario: leaflet.css le pone z-index:200 a los <svg> del mapa
  // y sin él el círculo blanco tapa el logo.
  return L.divIcon({
    className: "panoramica-pin",
    html: `
      <div style="position:relative;width:36px;height:46px;filter:drop-shadow(0 3px 6px rgba(0,0,0,0.3));">
        <svg viewBox="0 0 36 46" xmlns="http://www.w3.org/2000/svg" width="36" height="46" style="position:absolute;inset:0;display:block;z-index:0;">
          <path d="M18 0C8 0 0 8 0 18c0 12 18 28 18 28s18-16 18-28C36 8 28 0 18 0z" fill="${PIN_COLOR}"/>
          <circle cx="18" cy="18" r="14" fill="white"/>
        </svg>
        <img src="${innerLogo}" alt="" style="position:absolute;top:5px;left:5px;width:26px;height:26px;border-radius:50%;object-fit:contain;display:block;z-index:1;"/>
      </div>
    `,
    iconSize: [36, 46],
    iconAnchor: [18, 46],
    popupAnchor: [0, -42],
  });
}

function FlyTo({ center }: { center: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.flyTo(center, 13, { duration: 0.8 });
  }, [center, map]);
  return null;
}

// Vista inicial centrada en la Araucanía (zona de mayor densidad de puntos de venta).
const DEFAULT_CENTER: [number, number] = [-38.3, -72.3];
const DEFAULT_ZOOM = 8;

export default function DondeComprar() {
  const [search, setSearch] = useState("");
  const [focus, setFocus] = useState<[number, number] | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const embed = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("embed") === "1";

  const { data: locations = [], isLoading } = useQuery<RetailLocation[]>({
    queryKey: ["/api/public/retail-locations"],
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return locations;
    return locations.filter((l) =>
      l.name.toLowerCase().includes(q) ||
      l.address.toLowerCase().includes(q) ||
      (l.comuna || "").toLowerCase().includes(q) ||
      (l.region || "").toLowerCase().includes(q)
    );
  }, [locations, search]);

  const firstMatch = useMemo(() => filtered.find((l) => l.latitude && l.longitude), [filtered]);

  useEffect(() => {
    if (search.trim() && firstMatch) {
      setFocus([Number(firstMatch.latitude), Number(firstMatch.longitude)]);
    }
  }, [search, firstMatch]);

  return (
    <div className="h-dvh bg-white flex flex-col">
      {/* Top nav (oculta en modo embed para integrarse en sitios externos vía iframe) */}
      {!embed && (
        <header className="border-b border-gray-100 bg-white flex-shrink-0 z-[1000]">
          <div className="max-w-[1600px] mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
            <Link href="/tienda" className="flex items-center gap-3">
              <img src="/panoramica-logo.png" alt="Panorámica" className="h-8 w-auto" />
              <span className="sr-only">Panorámica</span>
            </Link>
            <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-700">
              <Link href="/tienda" className="hover:text-[#ff7f33]">Productos</Link>
              <Link href="/donde-comprar" className="text-[#ff7f33] border-b-2 border-[#ff7f33] pb-1">Dónde Comprar</Link>
              <Link href="/catalogo" className="hover:text-[#ff7f33]">Cotizador</Link>
            </nav>
            <Link href="/tienda" className="bg-[#ff7f33] text-white rounded-full px-5 py-2 text-sm font-semibold hover:bg-[#e66a1f] transition">
              Tienda Online
            </Link>
          </div>
        </header>
      )}

      {/* Split layout */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Sidebar */}
        <aside className="h-[42%] lg:h-full flex-shrink-0 lg:w-[420px] xl:w-[480px] lg:border-r border-b lg:border-b-0 border-gray-100 bg-white flex flex-col overflow-hidden">
          <div className="p-4 md:p-8 pb-3 md:pb-4 border-b border-gray-100">
            <h1 className="text-xl md:text-4xl font-bold tracking-tight text-gray-900 mb-1 md:mb-2">
              Dónde comprar
            </h1>
            <p className="text-gray-500 text-xs md:text-sm mb-3 md:mb-6 hidden md:block">
              Encuentra tu sucursal Panorámica, distribuidor o ferretería más cercana.
            </p>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por comuna, nombre, dirección..."
                className="w-full h-11 md:h-12 pl-11 pr-11 rounded-full border border-gray-200 focus:border-[#ff7f33] focus:ring-2 focus:ring-[#ff7f33]/20 outline-none text-sm transition"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Results list */}
          <div ref={listRef} className="flex-1 overflow-y-auto p-3 md:p-6 space-y-3">
            {isLoading && (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />
                ))}
              </div>
            )}
            {!isLoading && filtered.length === 0 && (
              <div className="text-center py-12 text-gray-400 text-sm">
                <MapPin className="w-10 h-10 mx-auto mb-3 opacity-30" />
                No se encontraron ubicaciones
              </div>
            )}
            {filtered.map((loc) => {
              const meta = TYPE_META[loc.type];
              const Icon = meta.icon;
              return (
                <button
                  key={loc.id}
                  onClick={() => {
                    if (loc.latitude && loc.longitude) {
                      setFocus([Number(loc.latitude), Number(loc.longitude)]);
                    }
                  }}
                  className="w-full text-left bg-white border border-gray-100 rounded-2xl p-4 hover:border-[#ff7f33] hover:shadow-md transition group"
                >
                  <div className="flex gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `${meta.color}15`, color: meta.color }}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <h3 className="font-bold text-gray-900 truncate group-hover:text-[#ff7f33]">
                          {loc.name}
                        </h3>
                        <span
                          className="text-[10px] font-semibold uppercase tracking-wide flex-shrink-0"
                          style={{ color: meta.color }}
                        >
                          {meta.label}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                        {loc.address}
                        {loc.comuna ? `, ${loc.comuna}` : ""}
                      </p>
                      <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-500">
                        {loc.phone && (
                          <span className="inline-flex items-center gap-1">
                            <Phone className="w-3 h-3" /> {loc.phone}
                          </span>
                        )}
                        {loc.latitude && loc.longitude ? (
                          <a
                            href={`https://www.google.com/maps/dir/?api=1&destination=${loc.latitude},${loc.longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 text-[#ff7f33] font-semibold hover:underline"
                          >
                            <Navigation className="w-3 h-3" /> Cómo llegar
                          </a>
                        ) : (
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${loc.address}${loc.comuna ? ", " + loc.comuna : ""}, Chile`)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 text-[#ff7f33] font-semibold hover:underline"
                          >
                            <Navigation className="w-3 h-3" /> Ver en Maps
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Map */}
        <div className="flex-1 min-h-0 relative">
          <MapContainer
            center={DEFAULT_CENTER}
            zoom={DEFAULT_ZOOM}
            scrollWheelZoom
            style={{ height: "100%", width: "100%" }}
            className="z-0"
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
            />
            <FlyTo center={focus} />
            {filtered.filter((l) => l.latitude && l.longitude).map((loc) => {
              const meta = TYPE_META[loc.type];
              return (
                <Marker
                  key={loc.id}
                  position={[Number(loc.latitude), Number(loc.longitude)]}
                  icon={makeIcon(meta.color, loc.logoUrl, loc.type === "ferreteria")}
                >
                  <Popup minWidth={260} maxWidth={280}>
                    <div className="min-w-[240px]">
                      <div className="flex items-start gap-3 mb-3">
                        {loc.logoUrl && (
                          <div className="w-14 h-14 rounded-xl overflow-hidden bg-white border flex items-center justify-center flex-shrink-0">
                            <img src={loc.logoUrl} alt={loc.name} className="w-full h-full object-contain" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div
                            className="text-[10px] font-bold uppercase tracking-wide"
                            style={{ color: meta.color }}
                          >
                            {meta.label}
                          </div>
                          <div className="font-bold text-gray-900 text-base leading-tight">{loc.name}</div>
                        </div>
                      </div>

                      <div className="flex items-start gap-2 mb-2">
                        <MapPin className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                        <div className="text-sm text-gray-700 leading-snug">
                          {loc.address}
                          {loc.comuna ? `, ${loc.comuna}` : ""}
                          {loc.region ? `, ${loc.region}` : ""}
                        </div>
                      </div>

                      {loc.phone && (
                        <a
                          href={`tel:${loc.phone.replace(/\s/g, "")}`}
                          className="flex items-center gap-2 mb-2 py-1.5 px-2 -mx-2 rounded-lg hover:bg-gray-50 no-underline"
                        >
                          <Phone className="w-4 h-4 text-[#ff7f33] flex-shrink-0" />
                          <span className="text-sm font-semibold text-gray-900">{loc.phone}</span>
                        </a>
                      )}

                      {loc.website && (
                        <a
                          href={loc.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-[#ff7f33] flex items-center gap-1 hover:underline mb-1"
                        >
                          <Globe className="w-3 h-3" /> Sitio web
                        </a>
                      )}
                      {loc.schedule && (
                        <div className="text-xs text-gray-500 mt-2 pt-2 border-t">{loc.schedule}</div>
                      )}
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${loc.latitude},${loc.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 inline-flex items-center gap-1 bg-[#ff7f33] text-white text-xs font-semibold px-3 py-2 rounded-full hover:bg-[#e66a1f] w-full justify-center"
                      >
                        <Navigation className="w-3 h-3" /> Cómo llegar
                      </a>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        </div>
      </div>
    </div>
  );
}
