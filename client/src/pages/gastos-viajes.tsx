/**
 * Planificador de viaje — pestaña del módulo Rendición de Gastos.
 *
 * Portado de primerosresultados/rendicion-gastos (client/src/pages/viajes-page.tsx),
 * reescrito con shadcn/ui y los tokens de Panorámica.
 *
 * Estima combustible y peajes de una ruta antes de salir, y con un clic deja el
 * gasto cargado (categoría Combustibles + Peaje) con el detalle del viaje
 * guardado en `gastos_empresariales.viaje_detalle`.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { MapContainer, Marker, Polyline, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  Fuel,
  Loader2,
  MapPin,
  Navigation,
  Plus,
  Route as RouteIcon,
  TriangleAlert,
  Zap,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  findTollBooths,
  geocode,
  getRoute,
  type GeoPoint,
  type RouteResult,
  type TollPoint,
} from "@/lib/viajes";

type TipoVehiculo = "combustion" | "electrico";

/** Multiplicador de tarifa de peaje por categoría (tabla estándar de autopistas). */
const CATEGORIAS = [
  { key: "auto", label: "Auto", mult: 1 },
  { key: "camioneta", label: "Camioneta / SUV", mult: 1 },
  { key: "moto", label: "Moto", mult: 0.5 },
  { key: "camion", label: "Camión", mult: 2.4 },
];

const num = (s: string) => {
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};

const plata = (v: number) =>
  new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(Math.round(v));

const BOTON_NARANJA =
  "bg-[#fd6301] hover:bg-[#e35400] text-white shadow-md shadow-orange-500/25 transition-all rounded-2xl";

// ─── Mapa ───────────────────────────────────────────────────────────────────

// El z-index explícito es necesario: leaflet.css le pone z-index:200 a los <svg>
// del mapa y sin él los marcadores quedan tapados.
const iconoPunto = (color: string) =>
  L.divIcon({
    className: "",
    html: `<div style="position:relative;z-index:400;width:18px;height:18px;border-radius:9999px;background:${color};border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35)"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });

const iconoPeaje = L.divIcon({
  className: "",
  html: `<div style="position:relative;z-index:400;width:14px;height:14px;border-radius:3px;background:#f59e0b;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.35)"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

/** Encuadra el mapa cada vez que cambia la ruta. */
function AjustarVista({ coords }: { coords: [number, number][] }) {
  const mapa = useMap();
  useEffect(() => {
    if (coords.length === 0) return;
    mapa.fitBounds(L.latLngBounds(coords), { padding: [28, 28] });
  }, [coords, mapa]);
  return null;
}

function MapaRuta({ ruta, peajes }: { ruta: RouteResult; peajes: TollPoint[] }) {
  const inicio = ruta.coordinates[0];
  const fin = ruta.coordinates[ruta.coordinates.length - 1];

  return (
    <div className="h-[360px] w-full overflow-hidden rounded-2xl border border-slate-200/70 dark:border-slate-700">
      <MapContainer
        center={inicio}
        zoom={7}
        scrollWheelZoom={false}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Polyline positions={ruta.coordinates} pathOptions={{ color: "#fd6301", weight: 4 }} />
        <Marker position={inicio} icon={iconoPunto("#16a34a")} />
        <Marker position={fin} icon={iconoPunto("#dc2626")} />
        {peajes.map((p) => (
          <Marker key={p.id} position={[p.lat, p.lon]} icon={iconoPeaje} />
        ))}
        <AjustarVista coords={ruta.coordinates} />
      </MapContainer>
    </div>
  );
}

// ─── Campo de dirección con autocompletado ──────────────────────────────────

function CampoDireccion({
  id,
  label,
  icono,
  placeholder,
  onSelect,
}: {
  id: string;
  label: string;
  icono: React.ReactNode;
  placeholder: string;
  onSelect: (p: GeoPoint | null) => void;
}) {
  const [texto, setTexto] = useState("");
  const [opciones, setOpciones] = useState<GeoPoint[]>([]);
  const [abierto, setAbierto] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce de 450ms: Nominatim pide no más de 1 request por segundo.
  useEffect(() => {
    if (temporizador.current) clearTimeout(temporizador.current);
    if (texto.trim().length < 3) {
      setOpciones([]);
      return;
    }
    temporizador.current = setTimeout(async () => {
      setBuscando(true);
      try {
        setOpciones(await geocode(texto));
        setAbierto(true);
      } catch {
        setOpciones([]);
      } finally {
        setBuscando(false);
      }
    }, 450);
    return () => {
      if (temporizador.current) clearTimeout(temporizador.current);
    };
  }, [texto]);

  return (
    <div className="relative">
      <Label htmlFor={id} className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
        {icono}
        {label}
      </Label>
      <Input
        id={id}
        className="mt-1.5"
        value={texto}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(e) => {
          setTexto(e.target.value);
          onSelect(null);
        }}
        onFocus={() => opciones.length > 0 && setAbierto(true)}
        onBlur={() => setTimeout(() => setAbierto(false), 150)}
        data-testid={`input-${id}`}
      />
      {buscando && (
        <Loader2 className="absolute right-3 top-[2.1rem] h-4 w-4 animate-spin text-slate-400" />
      )}
      {abierto && opciones.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
          {opciones.map((o) => (
            <li key={`${o.lat}-${o.lon}`}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-orange-50 dark:text-slate-200 dark:hover:bg-slate-800"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onSelect(o);
                  setTexto(o.label);
                  setAbierto(false);
                }}
              >
                {o.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════

export default function GastosViajes() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [origen, setOrigen] = useState<GeoPoint | null>(null);
  const [destino, setDestino] = useState<GeoPoint | null>(null);
  const [idaVuelta, setIdaVuelta] = useState(false);

  const [vehiculo, setVehiculo] = useState<TipoVehiculo>("combustion");
  const [rendimiento, setRendimiento] = useState("12"); // km/L
  const [precioLitro, setPrecioLitro] = useState("1290"); // $/L
  const [consumo, setConsumo] = useState("16"); // kWh/100km
  const [precioKwh, setPrecioKwh] = useState("160"); // $/kWh
  const [categoria, setCategoria] = useState("auto");
  const [tarifaPeaje, setTarifaPeaje] = useState("3500"); // $/peaje (auto)

  const [ruta, setRuta] = useState<RouteResult | null>(null);
  const [peajes, setPeajes] = useState<TollPoint[]>([]);
  const [precioPeaje, setPrecioPeaje] = useState<Record<string, string>>({});
  const [peajeActivo, setPeajeActivo] = useState<Record<string, boolean>>({});

  const [calculando, setCalculando] = useState(false);
  const [buscandoPeajes, setBuscandoPeajes] = useState(false);

  const mult = CATEGORIAS.find((c) => c.key === categoria)?.mult ?? 1;

  // Al llegar peajes nuevos (o cambiar tarifa/categoría) se recalculan precios.
  useEffect(() => {
    const base = Math.round(num(tarifaPeaje) * mult);
    const precios: Record<string, string> = {};
    const activos: Record<string, boolean> = {};
    for (const p of peajes) {
      precios[p.id] = String(base);
      activos[p.id] = true;
    }
    setPrecioPeaje(precios);
    setPeajeActivo(activos);
  }, [peajes, tarifaPeaje, mult]);

  const calcular = async () => {
    if (!origen || !destino) {
      toast({
        title: "Faltan datos",
        description: "Elige un origen y un destino de la lista de sugerencias.",
        variant: "destructive",
      });
      return;
    }
    setCalculando(true);
    setRuta(null);
    setPeajes([]);
    try {
      const r = await getRoute(origen, destino);
      setRuta(r);
      setBuscandoPeajes(true);
      try {
        setPeajes(await findTollBooths(r.coordinates));
      } catch {
        toast({
          title: "No se pudieron detectar peajes",
          description: "Puedes agregar el costo manualmente al crear el gasto.",
        });
      } finally {
        setBuscandoPeajes(false);
      }
    } catch (e) {
      toast({
        title: "No se pudo calcular la ruta",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
    } finally {
      setCalculando(false);
    }
  };

  // ─── Cálculo de costos ───

  const factorTramos = idaVuelta ? 2 : 1;
  const distanciaKm = (ruta?.distanceKm ?? 0) * factorTramos;
  const duracionMin = (ruta?.durationMin ?? 0) * factorTramos;

  const costoCombustible =
    vehiculo === "combustion"
      ? (distanciaKm / Math.max(num(rendimiento), 0.1)) * num(precioLitro)
      : (distanciaKm / 100) * num(consumo) * num(precioKwh);

  const totalPeajes =
    peajes.reduce((acc, p) => acc + (peajeActivo[p.id] ? num(precioPeaje[p.id] ?? "0") : 0), 0) *
    factorTramos;

  const total = costoCombustible + totalPeajes;
  const peajesActivos = peajes.filter((p) => peajeActivo[p.id]).length;

  // ─── Alta del gasto ───

  const catalogosQuery = useQuery<{ tipo: string; nombre: string }[]>({
    queryKey: ["/api/gasto-catalogos"],
  });

  /** Usa la categoría del catálogo si existe; si no, cae al literal histórico. */
  const categoriaDisponible = (preferida: string, respaldo: string) => {
    const nombres = (catalogosQuery.data ?? [])
      .filter((c) => c.tipo === "categoria")
      .map((c) => c.nombre);
    return nombres.includes(preferida) ? preferida : respaldo;
  };

  const crearGastosMut = useMutation({
    mutationFn: async () => {
      if (!origen || !destino || !ruta) throw new Error("Calcula la ruta primero");

      const hoy = new Date();
      const fechaEmision = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`;
      const tramo = `${origen.label.split(",")[0]} → ${destino.label.split(",")[0]}${idaVuelta ? " (ida y vuelta)" : ""}`;

      const detalleViaje = {
        origen: origen.label,
        destino: destino.label,
        idaVuelta,
        distanciaKm: Number(distanciaKm.toFixed(1)),
        duracionMin: Math.round(duracionMin),
        vehiculo,
        categoria,
        peajes: peajes
          .filter((p) => peajeActivo[p.id])
          .map((p) => ({ nombre: p.name, monto: num(precioPeaje[p.id] ?? "0") })),
      };

      const base = {
        userId: user?.id,
        fechaEmision,
        ruta: tramo,
        ciudad: destino.label.split(",")[0],
        fundingMode: "reembolso" as const,
        viajeDetalle: detalleViaje,
      };

      // Combustible y peajes van como dos gastos: se imputan a categorías
      // distintas y el aprobador necesita verlos separados.
      const creados: any[] = [];

      if (costoCombustible > 0) {
        const res = await apiRequest("/api/gastos-empresariales", {
          method: "POST",
          data: {
            ...base,
            monto: Math.round(costoCombustible),
            categoria: categoriaDisponible("Combustibles", "Otros"),
            descripcion: `${vehiculo === "electrico" ? "Carga eléctrica" : "Combustible"} ${tramo} · ${distanciaKm.toFixed(0)} km`,
            tipoDocumento: "Otro",
          },
        });
        creados.push(await res.json());
      }

      if (totalPeajes > 0) {
        const res = await apiRequest("/api/gastos-empresariales", {
          method: "POST",
          data: {
            ...base,
            monto: Math.round(totalPeajes),
            categoria: categoriaDisponible("Peaje", "Otros"),
            descripcion: `Peajes ${tramo} · ${peajesActivos} plaza(s)`,
            tipoDocumento: "Peaje",
          },
        });
        creados.push(await res.json());
      }

      if (creados.length === 0) throw new Error("No hay montos que registrar");
      return creados;
    },
    onSuccess: (creados) => {
      toast({
        title: `${creados.length} gasto(s) creado(s)`,
        description: "Quedaron pendientes en la pestaña Rendición, listos para incluir en un informe.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/gastos-empresariales"] });
      queryClient.invalidateQueries({ queryKey: ["/api/informes-rendicion/gastos-disponibles"] });
    },
    onError: (e: Error) =>
      toast({ title: "No se pudo crear el gasto", description: e.message, variant: "destructive" }),
  });

  const horas = Math.floor(duracionMin / 60);
  const minutos = Math.round(duracionMin % 60);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Planificador de viaje</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Estima combustible y peajes de una ruta, y déjala cargada como gasto con un clic.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
        {/* ── Formulario ── */}
        <div className="space-y-4">
          <Card className="rounded-2xl border-slate-200/70 dark:border-slate-700">
            <CardContent className="space-y-4 p-5">
              <CampoDireccion
                id="viaje-origen"
                label="Origen"
                icono={<MapPin className="h-3.5 w-3.5" />}
                placeholder="Ciudad, dirección o lugar"
                onSelect={setOrigen}
              />
              <CampoDireccion
                id="viaje-destino"
                label="Destino"
                icono={<Navigation className="h-3.5 w-3.5" />}
                placeholder="Ciudad, dirección o lugar"
                onSelect={setDestino}
              />
              <label className="flex items-center gap-2.5 text-sm text-slate-700 dark:text-slate-200">
                <Checkbox
                  checked={idaVuelta}
                  onCheckedChange={(v) => setIdaVuelta(v === true)}
                  data-testid="checkbox-ida-vuelta"
                />
                Ida y vuelta
              </label>
              <Button
                className={`w-full ${BOTON_NARANJA}`}
                onClick={calcular}
                disabled={calculando || !origen || !destino}
                data-testid="button-calcular-ruta"
              >
                {calculando ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RouteIcon className="mr-2 h-4 w-4" />
                )}
                Calcular ruta
              </Button>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-slate-200/70 dark:border-slate-700">
            <CardContent className="space-y-4 p-5">
              <p className="text-sm font-bold text-slate-800 dark:text-slate-100">Vehículo</p>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    { key: "combustion" as const, label: "Combustión", icono: Fuel },
                    { key: "electrico" as const, label: "Eléctrico", icono: Zap },
                  ]
                ).map(({ key, label, icono: Icono }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setVehiculo(key)}
                    className={`flex items-center justify-center gap-2 rounded-2xl border px-3 py-2.5 text-sm font-semibold transition-all ${
                      vehiculo === key
                        ? "border-[#fd6301] bg-orange-50 text-[#fd6301] dark:bg-orange-950/40"
                        : "border-slate-200 text-slate-600 hover:border-orange-200 dark:border-slate-700 dark:text-slate-300"
                    }`}
                    data-testid={`button-vehiculo-${key}`}
                  >
                    <Icono className="h-4 w-4" />
                    {label}
                  </button>
                ))}
              </div>

              {vehiculo === "combustion" ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="rendimiento" className="text-xs text-slate-500">Rendimiento (km/L)</Label>
                    <Input id="rendimiento" type="number" inputMode="decimal" className="mt-1" value={rendimiento} onChange={(e) => setRendimiento(e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="precio-litro" className="text-xs text-slate-500">Precio ($/L)</Label>
                    <Input id="precio-litro" type="number" inputMode="decimal" className="mt-1" value={precioLitro} onChange={(e) => setPrecioLitro(e.target.value)} />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="consumo" className="text-xs text-slate-500">Consumo (kWh/100km)</Label>
                    <Input id="consumo" type="number" inputMode="decimal" className="mt-1" value={consumo} onChange={(e) => setConsumo(e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="precio-kwh" className="text-xs text-slate-500">Precio ($/kWh)</Label>
                    <Input id="precio-kwh" type="number" inputMode="decimal" className="mt-1" value={precioKwh} onChange={(e) => setPrecioKwh(e.target.value)} />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-slate-500">Categoría peaje</Label>
                  <Select value={categoria} onValueChange={setCategoria}>
                    <SelectTrigger className="mt-1" data-testid="select-categoria-peaje">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIAS.map((c) => (
                        <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="tarifa-peaje" className="text-xs text-slate-500">Tarifa base ($)</Label>
                  <Input id="tarifa-peaje" type="number" inputMode="decimal" className="mt-1" value={tarifaPeaje} onChange={(e) => setTarifaPeaje(e.target.value)} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Resultado ── */}
        <div className="space-y-4">
          {!ruta ? (
            <Card className="rounded-2xl border-dashed border-slate-300 dark:border-slate-700">
              <CardContent className="flex flex-col items-center gap-3 py-20 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fd6301] shadow-md shadow-[#fd6301]/25">
                  <RouteIcon className="h-6 w-6 text-white" />
                </div>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  Sin ruta calculada
                </p>
                <p className="max-w-sm text-xs text-slate-500">
                  Elige origen y destino de las sugerencias y presiona «Calcular ruta».
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-4">
                {[
                  { label: "Distancia", valor: `${distanciaKm.toFixed(0)} km` },
                  { label: "Duración", valor: horas > 0 ? `${horas} h ${minutos} min` : `${minutos} min` },
                  { label: vehiculo === "electrico" ? "Energía" : "Combustible", valor: plata(costoCombustible) },
                  { label: `Peajes (${peajesActivos})`, valor: plata(totalPeajes) },
                ].map((kpi) => (
                  <Card key={kpi.label} className="rounded-2xl border-slate-200/70 dark:border-slate-700">
                    <CardContent className="p-4">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        {kpi.label}
                      </p>
                      <p className="mt-1 text-lg font-bold tabular-nums text-slate-800 dark:text-slate-100">
                        {kpi.valor}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Card className="rounded-2xl border-0 bg-gradient-to-r from-[#fd6301] to-[#e35400] text-white shadow-md shadow-orange-500/25">
                <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-white/80">
                      Costo estimado del viaje
                    </p>
                    <p className="mt-0.5 text-3xl font-bold tabular-nums">{plata(total)}</p>
                  </div>
                  <Button
                    className="rounded-2xl bg-white text-[#fd6301] hover:bg-white/90"
                    disabled={crearGastosMut.isPending || total <= 0}
                    onClick={() => crearGastosMut.mutate()}
                    data-testid="button-crear-gasto-viaje"
                  >
                    {crearGastosMut.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="mr-2 h-4 w-4" />
                    )}
                    Cargar como gasto
                  </Button>
                </CardContent>
              </Card>

              <MapaRuta ruta={ruta} peajes={peajes} />

              <Card className="rounded-2xl border-slate-200/70 dark:border-slate-700">
                <CardContent className="p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                      Peajes detectados
                    </p>
                    {buscandoPeajes && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
                  </div>

                  {peajes.length === 0 ? (
                    <div className="flex items-start gap-2.5 rounded-2xl bg-amber-50 p-3.5 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                      <p>
                        No se encontraron casetas de peaje en esta ruta según OpenStreetMap. Si el
                        viaje tuvo peajes, cárgalos como un gasto aparte.
                      </p>
                    </div>
                  ) : (
                    <>
                      <ul className="space-y-2">
                        {peajes.map((p) => (
                          <li
                            key={p.id}
                            className="flex items-center gap-3 rounded-2xl border border-slate-200/70 p-3 dark:border-slate-700"
                          >
                            <Checkbox
                              checked={peajeActivo[p.id] ?? true}
                              onCheckedChange={(v) =>
                                setPeajeActivo((prev) => ({ ...prev, [p.id]: v === true }))
                              }
                              aria-label={`Incluir ${p.name}`}
                              data-testid={`checkbox-peaje-${p.id}`}
                            />
                            <span className="min-w-0 flex-1 truncate text-sm text-slate-700 dark:text-slate-200">
                              {p.name}
                            </span>
                            <Input
                              type="number"
                              inputMode="numeric"
                              className="h-8 w-28 text-right"
                              value={precioPeaje[p.id] ?? ""}
                              onChange={(e) =>
                                setPrecioPeaje((prev) => ({ ...prev, [p.id]: e.target.value }))
                              }
                              aria-label={`Tarifa de ${p.name}`}
                              data-testid={`input-peaje-${p.id}`}
                            />
                          </li>
                        ))}
                      </ul>
                      <p className="mt-3 text-xs text-slate-500">
                        Las tarifas no están en OpenStreetMap: se calculan con la tarifa base por la
                        categoría del vehículo. Ajusta cada plaza si tienes el valor exacto.
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
