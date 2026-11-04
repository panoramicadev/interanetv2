/**
 * Vitrina de la imagen del producto: halos naranjos que se mueven, el envase flota
 * y le pasa un barrido de luz. No sigue al mouse: el usuario pidió que la imagen no
 * se mueva con él. La usan la página
 * de producto y el detalle en ventana. Animaciones en index.css (clases `cz-`).
 */
import type { ReactNode } from 'react';
import { Package } from 'lucide-react';
import { imagenLiviana } from '@/lib/imagen-liviana';

interface Props {
  imageUrl?: string | null;
  alt: string;
  /** Ancho pedido a imagenLiviana. */
  ancho?: number;
  className?: string;
  /** Contenido encima de la imagen (etiquetas, categoría). */
  children?: ReactNode;
}

export default function CotizadorVitrina({ imageUrl, alt, ancho = 900, className = '', children }: Props) {
  const src = imageUrl ? imagenLiviana(imageUrl, ancho) : null;

  return (
    <div
      className={`group relative overflow-hidden bg-gradient-to-br from-slate-50 via-white to-orange-50 flex items-center justify-center ${className}`}
    >
      {/* Halos */}
      <div aria-hidden className="cz-halo absolute -top-20 -left-16 w-72 h-72 rounded-full bg-[#fd6301]/25 blur-3xl" />
      <div aria-hidden className="cz-halo-2 absolute -bottom-24 -right-16 w-80 h-80 rounded-full bg-amber-300/30 blur-3xl" />
      {/* Trama fina */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.35] pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(rgba(15,23,42,.12) 1px, transparent 1px)',
          backgroundSize: '18px 18px',
          maskImage: 'radial-gradient(circle at center, black, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(circle at center, black, transparent 75%)',
        }}
      />

      {children}

      {src ? (
        <div className="cz-flotar relative w-[78%] h-[78%]">
          <div aria-hidden className="cz-sombra absolute left-1/2 bottom-[2%] w-2/3 h-5 -translate-x-1/2 rounded-[50%] bg-slate-900/40 blur-xl" />
          <div className="relative w-full h-full">
            <img
              key={src}
              src={src}
              alt={alt}
              className="cz-aparecer w-full h-full object-contain drop-shadow-[0_24px_30px_rgba(15,23,42,0.28)]"
            />
            {/* Barrido de luz recortado a la silueta del envase */}
            <div
              aria-hidden
              className="absolute inset-0 overflow-hidden pointer-events-none"
              style={{
                maskImage: `url("${src}")`, WebkitMaskImage: `url("${src}")`,
                maskSize: 'contain', WebkitMaskSize: 'contain',
                maskRepeat: 'no-repeat', WebkitMaskRepeat: 'no-repeat',
                maskPosition: 'center', WebkitMaskPosition: 'center',
              }}
            >
              <div key={src} className="cz-barrido absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/60 to-transparent motion-reduce:hidden" />
            </div>
          </div>
        </div>
      ) : (
        <Package className="relative w-24 h-24 text-slate-200" />
      )}
    </div>
  );
}
