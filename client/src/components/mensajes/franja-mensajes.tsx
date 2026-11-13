import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Megaphone, X } from "lucide-react";

export interface MensajeVisible {
  id: string;
  texto: string;
  color: string;
  autor: string | null;
  updatedAt: string;
}

const CLAVE_CERRADA = "franja-mensajes-cerrada";

/** Firma de lo que se está mostrando: si cambia un mensaje, la franja vuelve. */
function firma(mensajes: MensajeVisible[]): string {
  return mensajes.map((m) => `${m.id}:${m.updatedAt}`).join("|");
}

function leerCerrada(): string | null {
  try {
    return sessionStorage.getItem(CLAVE_CERRADA);
  } catch {
    return null;
  }
}

/**
 * Franja neón de la pantalla de inicio: los mensajes que el admin o el
 * supervisor dejaron para el rol de quien mira (Configuración → Mensajes).
 * El texto corre de derecha a izquierda y brilla como un letrero de neón; un
 * haz de luz recorre el borde. Se puede cerrar hasta que llegue un mensaje
 * nuevo o se edite uno (la firma va en sessionStorage).
 */
export function FranjaMensajes({
  className = "",
  vistaPrevia,
}: {
  className?: string;
  /** Muestra estos mensajes en vez de los del usuario, sin botón de cerrar (Configuración). */
  vistaPrevia?: MensajeVisible[];
}) {
  const { data: propios = [] } = useQuery<MensajeVisible[]>({
    queryKey: ["/api/mensajes-destacados/mios"],
    refetchInterval: 5 * 60 * 1000,
    staleTime: 60 * 1000,
    enabled: !vistaPrevia,
  });
  const mensajes = vistaPrevia ?? propios;
  const [cerrada, setCerrada] = useState<string | null>(vistaPrevia ? null : leerCerrada);

  const actual = firma(mensajes);
  // Más texto → más lento, para que se alcance a leer (≈ 9 caracteres por segundo).
  const duracion = useMemo(() => {
    const largo = mensajes.reduce((n, m) => n + m.texto.length + 8, 0);
    return Math.max(14, Math.round(largo / 9));
  }, [mensajes]);

  if (mensajes.length === 0 || cerrada === actual) return null;

  const cerrar = () => {
    try {
      sessionStorage.setItem(CLAVE_CERRADA, actual);
    } catch {
      /* sin storage: se cierra igual hasta recargar */
    }
    setCerrada(actual);
  };

  // Se repite la tira hasta llenar el ancho, y se duplica para que el bucle no salte.
  const repeticiones = Math.max(1, Math.ceil(4 / mensajes.length));
  const tira = Array.from({ length: repeticiones }, () => mensajes).flat();

  return (
    <div className={`px-2 sm:px-4 pt-2 sm:pt-4 ${className}`} data-sin-brillo>
      <div className="neon-borde rounded-2xl" role="region" aria-label="Mensajes destacados">
        <div className="relative flex items-center gap-3 rounded-[15px] bg-[#0a0a0a] pl-3 pr-2 py-2.5 sm:py-3 overflow-hidden">
          <div className="neon-icono flex items-center justify-center w-9 h-9 rounded-xl bg-[#fd6301] flex-shrink-0 z-10">
            <Megaphone className="h-4 w-4 text-white" />
          </div>

          {/* Lectores de pantalla: la lista quieta, una vez. */}
          <ul className="sr-only">
            {mensajes.map((m) => (
              <li key={m.id}>{m.texto}</li>
            ))}
          </ul>

          <div className="neon-ventana relative flex-1 min-w-0 overflow-hidden" aria-hidden="true">
            <div className="neon-cinta" style={{ ["--neon-dur" as any]: `${duracion * repeticiones}s` }}>
              {[0, 1].map((copia) => (
                <div key={copia} className="neon-tramo">
                  {tira.map((m, i) => (
                    <span key={`${copia}-${i}-${m.id}`} className={`inline-flex items-center ${i >= mensajes.length ? "neon-repetido" : ""}`}>
                      <span
                        className={`neon-texto neon-${m.color} text-sm sm:text-base font-semibold tracking-wide whitespace-nowrap`}
                        style={{ animationDelay: `${(i % 5) * 1.3}s` }}
                      >
                        {m.texto}
                      </span>
                      <span className="neon-separador mx-6 sm:mx-10">✦</span>
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {!vistaPrevia && <button
            type="button"
            onClick={cerrar}
            className="z-10 p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0"
            title="Ocultar hasta que haya un mensaje nuevo"
            aria-label="Ocultar mensajes"
            data-testid="franja-mensajes-cerrar"
          >
            <X className="h-4 w-4" />
          </button>}
        </div>
      </div>
    </div>
  );
}
