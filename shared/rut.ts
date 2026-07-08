// Utilidades de RUT chileno: normalización, validación (módulo 11) y formato.
// Se usa en el formulario de cliente (client), la API de creación (server/routes)
// y el ETL de clientes para cruzar clientes cargados a mano con el ERP por RUT.

/**
 * Deja el RUT en su forma canónica para comparar: solo dígitos y K, en mayúscula,
 * sin puntos, guion ni espacios. Ej: "12.345.678-9" -> "123456789", "7.654.321-k" -> "7654321K".
 */
export function normalizeRut(rut: string | null | undefined): string {
  if (!rut) return "";
  return rut.toString().trim().toUpperCase().replace(/[^0-9K]/g, "");
}

/** Calcula el dígito verificador (0-9 o K) para un cuerpo numérico. */
function computeDv(body: string): string {
  let sum = 0;
  let mul = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i], 10) * mul;
    mul = mul === 7 ? 2 : mul + 1;
  }
  const res = 11 - (sum % 11);
  if (res === 11) return "0";
  if (res === 10) return "K";
  return String(res);
}

/** Valida un RUT chileno completo (cuerpo + dígito verificador) con módulo 11. */
export function isValidRut(rut: string | null | undefined): boolean {
  const clean = normalizeRut(rut);
  // Cuerpo mínimo de 6 dígitos + DV evita aceptar números demasiado cortos.
  if (clean.length < 7) return false;
  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);
  if (!/^\d+$/.test(body)) return false;
  return computeDv(body) === dv;
}

/** Formatea un RUT a "12.345.678-9". Si no puede, devuelve la forma normalizada. */
export function formatRut(rut: string | null | undefined): string {
  const clean = normalizeRut(rut);
  if (clean.length < 2) return clean;
  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);
  const withDots = body.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${withDots}-${dv}`;
}
