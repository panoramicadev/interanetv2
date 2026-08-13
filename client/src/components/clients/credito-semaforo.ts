// ═══════════════════════════════════════════════════════════════════════════
// SEMÁFORO DE CRÉDITO — regla única para toda la intranet
// ═══════════════════════════════════════════════════════════════════════════
// Verde / amarillo / rojo según cómo está el cliente con sus pagos, para decidir
// de un vistazo si conviene salir a venderle:
//
//   rojo     tiene documentos vencidos (o se pasó de su línea) → cobrar primero
//   amarillo sin vencido, pero con documentos por vencer
//   verde    sin documentos pendientes
//
// Los montos salen siempre de los documentos pendientes del ERP: los del panel
// de crédito cuando se mira un cliente, y los del endpoint masivo cuando hay
// que pintar una lista entera (una fila no puede disparar una consulta propia).
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export type NivelCredito = "rojo" | "amarillo" | "verde";

export interface EstadoCredito {
  nivel: NivelCredito;
  /** Etiqueta corta para el chip: "Vencido", "Próximo a vencer", "Al día". */
  label: string;
  punto: string;
  chip: string;
}

const ESTADOS: Record<NivelCredito, EstadoCredito> = {
  rojo: {
    nivel: "rojo",
    label: "Vencido",
    punto: "bg-red-500",
    chip: "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400",
  },
  amarillo: {
    nivel: "amarillo",
    label: "Próximo a vencer",
    punto: "bg-amber-400",
    chip: "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400",
  },
  verde: {
    nivel: "verde",
    label: "Al día",
    punto: "bg-emerald-500",
    chip: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400",
  },
};

/** Nivel del semáforo a partir de los montos de la cartera del cliente. */
export function nivelCredito({
  overdue,
  upcoming,
  exceeded,
}: {
  overdue: number;
  upcoming: number;
  exceeded?: boolean;
}): EstadoCredito {
  if (overdue > 0 || exceeded) return ESTADOS.rojo;
  if (upcoming > 0) return ESTADOS.amarillo;
  return ESTADOS.verde;
}

export interface CreditoResumen {
  overdue: number;
  upcoming: number;
  documentCount: number;
}

/**
 * Cartera de varios clientes de una sola vez, por código de cliente (koen).
 * Un código que no vuelve en la respuesta está al día (sin documentos pendientes),
 * así que la ausencia de dato es verde y no "desconocido"; los clientes sin código
 * quedan fuera y no muestran semáforo.
 */
export function useCreditoSemaforo(codes: string[]) {
  const limpios = Array.from(new Set(codes.map((c) => String(c || "").trim()).filter(Boolean))).sort();
  return useQuery<Record<string, CreditoResumen>>({
    queryKey: ["/api/clients/credito-semaforo", limpios.join(",")],
    queryFn: async () => {
      const r = await apiRequest("/api/clients/credito-semaforo", {
        method: "POST",
        data: { codes: limpios },
      });
      const json = await r.json();
      return (json?.credito || {}) as Record<string, CreditoResumen>;
    },
    enabled: limpios.length > 0,
    staleTime: 5 * 60 * 1000,
  });
}
