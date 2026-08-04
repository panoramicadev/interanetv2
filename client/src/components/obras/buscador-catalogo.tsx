/**
 * Buscador de productos contra el catálogo real (SKU, nombre o color).
 *
 * Lo usan los dos puntos donde entra un producto a una obra: el formulario de
 * alta (donde los productos se eligen junto con la obra y se crean con ella) y
 * el panel de la obra ya cargada (donde se van sumando después). Es el mismo
 * buscador para que un producto se elija igual en los dos lados.
 *
 * Tiene dos presentaciones porque los dos lugares son distintos:
 *  - "popover": en la tabla de la planilla, que scrollea de lado; el desplegable
 *    va en un portal para que no lo recorte el contenedor.
 *  - "inline": en el formulario de obra, donde el diálogo ya scrollea y un
 *    portal encima de un modal se pelea con el foco; los resultados van en el
 *    flujo, debajo del input.
 *
 * El catálogo se arma en storage.buscarCatalogoObra a partir de price_list y
 * ecommerce_products — no de la tabla `products`.
 */
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Input } from "@/components/ui/input";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import type { CatalogoObraItem } from "@shared/schema";
import { Loader2, PenLine, Plus } from "lucide-react";
import { etiquetaCortaUnidad, unidadDesdeCatalogo } from "./unidades";

/**
 * La unidad de medida con la que entra un producto a la obra.
 *
 * En obra se pide en cuatro formatos (tineta de 4 o de 5 galones, galón y
 * litro), así que la unidad del maestro se traduce a uno de ellos en vez de
 * copiarse cruda: `ud02pr` trae la presentación genérica ("GL") y no distingue
 * la tineta de 4 de la de 5, que es lo que cambia el consumo por vivienda. El
 * nombre del producto sí lo dice, y por eso pesa más que el código.
 */
export function unidadDeObra(item: Pick<CatalogoObraItem, "nombre" | "unidad">): string {
  return unidadDesdeCatalogo(item.nombre, item.unidad);
}

/** Cuántas opciones muestra el desplegable. Ver el comentario de la query. */
const MAX_RESULTADOS = 6;

export function BuscadorCatalogo({
  onElegir,
  onManual,
  guardando,
  variante = "popover",
  placeholder = "Agregar producto por SKU, nombre o color…",
  testId = "input-obra-producto-buscar",
}: {
  onElegir: (item: CatalogoObraItem) => void;
  onManual: (nombre: string) => void;
  guardando: boolean;
  variante?: "popover" | "inline";
  placeholder?: string;
  testId?: string;
}) {
  const [texto, setTexto] = useState("");
  const [termino, setTermino] = useState("");
  const [abierto, setAbierto] = useState(false);

  // La búsqueda pega contra tres maestros: no vale la pena dispararla en cada tecla.
  useEffect(() => {
    const t = setTimeout(() => setTermino(texto.trim()), 250);
    return () => clearTimeout(t);
  }, [texto]);

  // Se piden pocos resultados a propósito: el desplegable tiene que quedar
  // compacto y no taparle media pantalla a la planilla. Si lo que se busca no
  // sale en estos, se afina el texto —que es más rápido que scrollear 20.
  const { data: resultados = [], isFetching } = useQuery<CatalogoObraItem[]>({
    queryKey: ["/api/obra-productos/catalogo", termino],
    queryFn: async () => {
      const res = await apiRequest(
        `/api/obra-productos/catalogo?q=${encodeURIComponent(termino)}&limit=${MAX_RESULTADOS}`,
      );
      return res.json();
    },
    enabled: termino.length >= 2,
  });

  const limpiar = () => {
    setTexto("");
    setTermino("");
    setAbierto(false);
  };

  const elegir = (item: CatalogoObraItem) => {
    onElegir(item);
    limpiar();
  };

  const manual = () => {
    const nombre = texto.trim();
    if (!nombre) return;
    onManual(nombre);
    limpiar();
  };

  const desplegado = texto.trim().length >= 2;

  const campo = (
    <div className="relative">
      <Plus className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-orange-500" />
      <Input
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value);
          setAbierto(true);
        }}
        onFocus={() => setAbierto(true)}
        placeholder={placeholder}
        className="pl-9 h-9 rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 focus:border-orange-400 focus:ring-orange-400/20"
        data-testid={testId}
      />
      {(isFetching || guardando) && (
        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-slate-300" />
      )}
    </div>
  );

  const lista = (
    <Resultados
      resultados={resultados}
      buscando={isFetching}
      texto={texto.trim()}
      onElegir={elegir}
      onManual={manual}
    />
  );

  if (variante === "inline") {
    return (
      <div className="space-y-2">
        {campo}
        {desplegado && (
          <div className="max-h-[172px] overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
            {lista}
          </div>
        )}
      </div>
    );
  }

  // El buscador vive dentro de una tabla con scroll horizontal, y un desplegable
  // posicionado en el flujo queda recortado por ese contenedor (se veía cortado
  // por abajo). Va en un popover, que se renderiza en un portal fuera de la
  // tabla; el ancla es el input para que quede pegado y del mismo ancho.
  //
  // La altura la manda el espacio que hay en pantalla, no una constante: Radix
  // publica el alto disponible y el desplegable nunca pasa de eso, así que ni se
  // corta por abajo ni se come la vista. El tope propio lo deja compacto igual
  // cuando sobra pantalla.
  return (
    <Popover open={abierto && desplegado} onOpenChange={setAbierto}>
      <PopoverAnchor asChild>{campo}</PopoverAnchor>
      <PopoverContent
        align="start"
        sideOffset={6}
        collisionPadding={12}
        avoidCollisions
        // El foco se queda en el input: se sigue escribiendo para filtrar.
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
        className="p-0 w-[var(--radix-popover-trigger-width)] min-w-[280px] max-h-[min(212px,var(--radix-popover-content-available-height))] overflow-y-auto rounded-2xl border-slate-200/80 dark:border-slate-700 z-[80]"
      >
        {lista}
      </PopoverContent>
    </Popover>
  );
}

/** Las opciones del catálogo, iguales en las dos presentaciones. */
function Resultados({
  resultados,
  buscando,
  texto,
  onElegir,
  onManual,
}: {
  resultados: CatalogoObraItem[];
  buscando: boolean;
  texto: string;
  onElegir: (item: CatalogoObraItem) => void;
  onManual: () => void;
}) {
  return (
    <>
      {resultados.map((item) => (
        <button
          key={item.sku}
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onElegir(item)}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left hover:bg-orange-50/60 dark:hover:bg-orange-950/20 transition-colors border-b border-slate-100 dark:border-slate-800 last:border-0"
          data-testid={`option-catalogo-${item.sku}`}
        >
          <span
            className="w-3 h-3 rounded-full border border-slate-200 dark:border-slate-600 flex-shrink-0"
            style={{ background: item.hex || "linear-gradient(135deg,#f1f5f9,#cbd5e1)" }}
          />
          <span className="min-w-0 flex-1">
            {/* Una línea por producto: el nombre, y debajo solo el SKU con el
                formato en que entra a la obra. El color ya se ve en el punto. */}
            <span className="block text-[13px] font-medium leading-tight text-slate-700 dark:text-slate-200 truncate">
              {item.nombre}
            </span>
            <span className="flex items-center gap-1.5 text-[10px] leading-tight text-slate-400">
              <span className="font-bold tabular-nums">{item.sku}</span>
              <span className="truncate">{etiquetaCortaUnidad(unidadDeObra(item))}</span>
            </span>
          </span>
        </button>
      ))}

      {resultados.length === 0 && !buscando && (
        <div className="px-3 py-2.5 text-sm text-slate-400">Sin resultados en el catálogo.</div>
      )}

      {/* Tonos de tintometría y productos que todavía no están en el maestro. */}
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={onManual}
        className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border-t border-slate-100 dark:border-slate-800"
        data-testid="button-catalogo-manual"
      >
        <PenLine className="h-3.5 w-3.5 flex-shrink-0" />
        Agregar «{texto}» a mano
      </button>
    </>
  );
}
