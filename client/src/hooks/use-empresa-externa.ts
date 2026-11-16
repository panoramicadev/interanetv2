import { useAuth } from "@/hooks/useAuth";
import { EMPRESAS_EXTERNAS, empresaExternaDe, type EmpresaExterna } from "@shared/empresas-externas";

/**
 * Empresa externa con la que trabaja el usuario (Pinturería del Sur), o null
 * si es un usuario de Panorámica. Ver shared/empresas-externas.ts.
 *
 * Un admin puede previsualizar las pantallas de una empresa externa agregando
 * `?empresa=<código>` a la dirección (por ejemplo /?empresa=02). En ese caso
 * `consulta` lleva el mismo parámetro para que el servidor sepa qué empresa leer.
 */
export function useEmpresaExterna(): { empresa: EmpresaExterna | null; consulta: string } {
  const { user } = useAuth();
  const propia = empresaExternaDe((user as any)?.email);
  if (propia) return { empresa: propia, consulta: "" };
  if ((user as any)?.role === "admin" && typeof window !== "undefined") {
    const codigo = new URLSearchParams(window.location.search).get("empresa");
    const empresa = EMPRESAS_EXTERNAS.find((e) => e.codigo === codigo) || null;
    if (empresa) return { empresa, consulta: `empresa=${encodeURIComponent(empresa.codigo)}` };
  }
  return { empresa: null, consulta: "" };
}

/** Pide JSON a una ruta de /api/empresa-externa agregando la vista previa del admin. */
export async function pedirEmpresaExterna<T>(ruta: string, params: Record<string, string | undefined>, consulta: string): Promise<T> {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v) qs.set(k, v);
  });
  const extra = consulta ? (qs.toString() ? `&${consulta}` : consulta) : "";
  const url = `/api/empresa-externa/${ruta}${qs.toString() || extra ? "?" : ""}${qs.toString()}${extra}`;
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) {
    const cuerpo = await res.json().catch(() => null);
    throw new Error(cuerpo?.message || "No se pudo cargar la información.");
  }
  return res.json();
}
