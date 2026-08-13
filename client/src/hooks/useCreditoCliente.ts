import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";

/**
 * Cupo del cliente logueado para la tienda: línea, usado y disponible.
 *
 * Sale de /api/ecommerce/client/credit-summary, que es la misma cuenta que
 * alimenta la pestaña Crédito del portal: línea = override manual > CRTO del
 * ERP, usado = facturas pendientes en ventas.fact_ventas.
 *
 * El checkout leía antes clients.crlt y clients.cren desde /api/clients/by-user
 * y por eso mostraba el cupo vacío: crlt es el cupo en LETRAS (0 en todas las
 * fichas, Panorámica no vende con letras) y cren viene vacía desde el ERP. Ver
 * shared/credito.ts. Ningún flujo de la tienda debe volver a leer esas columnas.
 */
export interface CreditoCliente {
  hasFicha: boolean;
  /** Condición de pago de la ficha ("CREDITO 30 DIAS", "CONTADO", …). */
  paymentCondition: string | null;
  /** Línea autorizada. null = el cliente compra al contado. */
  creditLimit: number | null;
  /** Facturado pendiente de pago. */
  creditUsed: number | null;
  /** creditLimit - creditUsed. null si no hay línea. */
  creditAvailable: number | null;
  /** Si puede pagar a crédito (condición de pago o línea > 0). */
  hasCredit: boolean;
}

export function useCreditoCliente() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery<CreditoCliente | null>({
    queryKey: ["/api/ecommerce/client/credit-summary", user?.id],
    queryFn: async () => {
      const res = await fetch("/api/ecommerce/client/credit-summary", { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!user?.id && (user as any)?.role === "client",
  });

  const creditLimit = data?.creditLimit ?? null;
  const creditUsed = data?.creditUsed ?? null;
  const creditAvailable = data?.creditAvailable ?? null;

  return {
    credito: data ?? null,
    isLoading,
    paymentCondition: data?.paymentCondition ?? null,
    creditLimit,
    creditUsed,
    creditAvailable,
    hasCredit: !!data?.hasCredit,
    /** Hay cupo que mostrar en el desglose (si no, no se dibuja la caja). */
    tieneCupoQueMostrar: creditLimit != null || creditAvailable != null,
  };
}
