import { useEffect, useState } from "react";
import { useRoute, useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Search,
  Package,
  Truck,
  CheckCircle2,
  Circle,
  Clock,
  MapPin,
  User,
  AlertTriangle,
  Loader2,
  PackageX,
  Store,
} from "lucide-react";

const ORANGE = "#FF6E23";

interface Etapa {
  key: string;
  label: string;
  fecha: string | null;
  done: boolean;
}
interface EntregaVigente {
  estadoEntrega: string | null;
  horaEntrega: string | null;
  motivoRechazo: string | null;
  operario: string | null;
  patente: string | null;
  rutaEstado: string | null;
}
interface Logistica {
  estadoPedido: string | null;
  envio: EntregaVigente | null;
  tieneFaltantes: boolean;
  backordersPendientes: number;
  retiroEnBodega: boolean;
}
interface SeguimientoResponse {
  found: boolean;
  message?: string;
  codigo?: string;
  estado?: string;
  etapas?: Etapa[];
  fecha?: string;
  cliente?: string;
  itemsCount?: number;
  items?: Array<{ nombre: string; cantidad: number | null }>;
  total?: string;
  envioDisponible?: boolean;
  envio?: Logistica | null;
  mensajeEnvio?: string | null;
}

const formatPrice = (price?: string | number | null): string => {
  if (price == null) return "";
  return `$${new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 }).format(Number(price))}`;
};

const formatDate = (value?: string | null): string => {
  if (!value) return "";
  try {
    return new Date(value).toLocaleDateString("es-CL", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "";
  }
};

export default function SeguimientoPublico() {
  const [, params] = useRoute<{ code: string }>("/seguimiento/:code");
  const [, setLocation] = useLocation();
  const routeCode = params?.code ? decodeURIComponent(params.code) : "";
  const [input, setInput] = useState(routeCode);

  useEffect(() => {
    setInput(routeCode);
  }, [routeCode]);

  const { data, isLoading, isError } = useQuery<SeguimientoResponse>({
    queryKey: ["/api/public/seguimiento", routeCode],
    queryFn: async () => {
      const res = await fetch(`/api/public/seguimiento/${encodeURIComponent(routeCode)}`);
      if (res.status === 429) {
        return { found: false, message: "Demasiadas consultas. Intenta nuevamente en un momento." };
      }
      if (!res.ok) {
        return { found: false, message: "No encontramos un pedido con ese código." };
      }
      return res.json();
    },
    enabled: !!routeCode,
    retry: false,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (trimmed) setLocation(`/seguimiento/${encodeURIComponent(trimmed)}`);
  };

  const logistica = data?.found ? data.envio : null;
  const entrega = logistica?.envio || null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white py-10 px-4">
      <div className="w-full max-w-xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl" style={{ backgroundColor: `${ORANGE}1A` }}>
            <Truck className="h-7 w-7" style={{ color: ORANGE }} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Seguimiento de pedido</h1>
          <p className="text-sm text-gray-500">
            Ingresa tu código de seguimiento para ver el estado de tu pedido.
          </p>
        </div>

        {/* Search box */}
        <Card className="border-0 shadow-md rounded-2xl">
          <CardContent className="p-4">
            <form onSubmit={handleSubmit} className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ej: PM-7K2QD9XR4T"
                className="flex-1 uppercase"
                autoFocus
              />
              <Button type="submit" className="gap-2 text-white" style={{ backgroundColor: ORANGE }}>
                <Search className="h-4 w-4" />
                Rastrear
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* States */}
        {routeCode && isLoading && (
          <div className="flex items-center justify-center gap-2 text-gray-500 py-8">
            <Loader2 className="h-5 w-5 animate-spin" />
            Buscando tu pedido...
          </div>
        )}

        {routeCode && !isLoading && (isError || !data?.found) && (
          <Card className="border-0 shadow-md rounded-2xl">
            <CardContent className="p-8 text-center space-y-2">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-50">
                <PackageX className="h-6 w-6 text-red-500" />
              </div>
              <p className="font-semibold text-gray-800">No encontramos tu pedido</p>
              <p className="text-sm text-gray-500">
                {data?.message || "Revisa que el código esté bien escrito e intenta nuevamente."}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Result */}
        {data?.found && (
          <>
            {/* Status summary */}
            <Card className="border-0 shadow-md rounded-2xl overflow-hidden">
              <CardContent className="p-6 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400 font-mono">{data.codigo}</span>
                  <span className="text-xs text-gray-400">{formatDate(data.fecha)}</span>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <Package className="h-5 w-5" style={{ color: ORANGE }} />
                  <span className="text-lg font-bold text-gray-900">{data.estado}</span>
                </div>
                {data.cliente && (
                  <p className="text-sm text-gray-500">Pedido de {data.cliente}</p>
                )}
              </CardContent>
            </Card>

            {/* Timeline */}
            {Array.isArray(data.etapas) && data.etapas.length > 0 && (
              <Card className="border-0 shadow-md rounded-2xl">
                <CardContent className="p-6">
                  <ol className="space-y-4">
                    {data.etapas.map((etapa) => (
                      <li key={etapa.key} className="flex items-start gap-3">
                        {etapa.done ? (
                          <CheckCircle2 className="h-5 w-5 mt-0.5 flex-shrink-0" style={{ color: ORANGE }} />
                        ) : (
                          <Circle className="h-5 w-5 mt-0.5 flex-shrink-0 text-gray-300" />
                        )}
                        <div className="flex-1">
                          <p className={etapa.done ? "text-sm font-medium text-gray-900" : "text-sm text-gray-400"}>
                            {etapa.label}
                          </p>
                          {etapa.fecha && (
                            <p className="text-xs text-gray-400 flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDate(etapa.fecha)}
                            </p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ol>
                </CardContent>
              </Card>
            )}

            {/* Shipping (TMS) */}
            <Card className="border-0 shadow-md rounded-2xl">
              <CardContent className="p-6 space-y-3">
                <div className="flex items-center gap-2">
                  <Truck className="h-5 w-5" style={{ color: ORANGE }} />
                  <span className="font-semibold text-gray-900">Estado del envío</span>
                </div>

                {logistica?.retiroEnBodega ? (
                  <div className="flex items-start gap-2 text-sm text-gray-600">
                    <Store className="h-4 w-4 mt-0.5 text-gray-400" />
                    <span>Este pedido es para <strong>retiro en bodega</strong>.</span>
                  </div>
                ) : entrega ? (
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Entrega</span>
                      <span className="font-medium text-gray-900">{entrega.estadoEntrega || "—"}</span>
                    </div>
                    {entrega.horaEntrega && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Hora</span>
                        <span className="font-medium text-gray-900">{entrega.horaEntrega}</span>
                      </div>
                    )}
                    {entrega.operario && (
                      <div className="flex justify-between">
                        <span className="text-gray-500 flex items-center gap-1"><User className="h-3.5 w-3.5" /> Transportista</span>
                        <span className="font-medium text-gray-900">{entrega.operario}</span>
                      </div>
                    )}
                    {entrega.patente && (
                      <div className="flex justify-between">
                        <span className="text-gray-500 flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> Vehículo</span>
                        <span className="font-medium text-gray-900">{entrega.patente}</span>
                      </div>
                    )}
                    {entrega.motivoRechazo && (
                      <div className="flex items-start gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
                        <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <span>{entrega.motivoRechazo}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">
                    {data.mensajeEnvio || "Aún no hay información de envío para este pedido."}
                  </p>
                )}

                {logistica?.tieneFaltantes && (
                  <div className="flex items-start gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2 text-sm">
                    <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>Tu pedido se despachará en partes (hay productos pendientes por entregar).</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Order summary */}
            {Array.isArray(data.items) && data.items.length > 0 && (
              <Card className="border-0 shadow-md rounded-2xl">
                <CardContent className="p-6 space-y-3">
                  <span className="font-semibold text-gray-900">Resumen del pedido</span>
                  <ul className="space-y-1 text-sm">
                    {data.items.map((item, idx) => (
                      <li key={idx} className="flex justify-between gap-3">
                        <span className="text-gray-600">{item.nombre}</span>
                        {item.cantidad != null && (
                          <span className="text-gray-400 flex-shrink-0">x{item.cantidad}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                  {data.total && (
                    <>
                      <Separator />
                      <div className="flex justify-between font-semibold">
                        <span className="text-gray-700">Total</span>
                        <span style={{ color: ORANGE }}>{formatPrice(data.total)}</span>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-gray-400">
          ¿Problemas con tu código?{" "}
          <Link href="/tienda" className="underline hover:text-gray-600">
            Volver a la tienda
          </Link>
        </p>
      </div>
    </div>
  );
}
