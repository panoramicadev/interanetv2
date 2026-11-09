/**
 * Círculo de color de un producto, con el reflejo según su brillo.
 * Lo usan la ficha del producto en la tienda y la pantonera de "Editar Producto",
 * así lo que se elige es exactamente lo que ve el cliente.
 */

export type Acabado = 'brillante' | 'semibrillo' | 'mate';

export const ACABADOS: { value: Acabado; label: string }[] = [
  { value: 'brillante', label: 'Brillante' },
  { value: 'semibrillo', label: 'Semibrillo' },
  { value: 'mate', label: 'Mate' },
];

export interface ProductSwatch {
  hex: string;
  acabado: Acabado;
  nombreColor?: string | null;
}

// Reflejo de luz encima del color: fuerte en brillante, suave en semibrillo, nada en mate.
const REFLEJO: Record<Acabado, string> = {
  brillante:
    'radial-gradient(circle at 32% 26%, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.45) 14%, rgba(255,255,255,0) 38%), ' +
    'radial-gradient(circle at 70% 82%, rgba(0,0,0,0.22) 0%, rgba(0,0,0,0) 55%)',
  semibrillo:
    'radial-gradient(circle at 32% 26%, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0.15) 22%, rgba(255,255,255,0) 48%), ' +
    'radial-gradient(circle at 70% 82%, rgba(0,0,0,0.12) 0%, rgba(0,0,0,0) 55%)',
  mate: 'none',
};

export function ColorSwatch({
  hex,
  acabado = 'mate',
  className = '',
  title,
}: {
  hex: string;
  acabado?: Acabado;
  className?: string;
  title?: string;
}) {
  return (
    <div
      className={`rounded-full ${className}`}
      title={title}
      style={{
        backgroundColor: hex,
        backgroundImage: REFLEJO[acabado] ?? 'none',
        boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.08), inset 0 -2px 4px rgba(0,0,0,0.08)',
      }}
    />
  );
}
