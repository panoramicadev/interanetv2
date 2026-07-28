import * as React from "react";
import { Smile, Search, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// ── Catálogo de emojis ─────────────────────────────────────────
// [emoji, palabras clave en español para el buscador]
type EmojiEntry = [string, string];

const CATEGORIES: { id: string; label: string; icon: string; emojis: EmojiEntry[] }[] = [
  {
    id: "marketing",
    label: "Marketing",
    icon: "🚀",
    emojis: [
      ["🚀", "cohete lanzamiento nuevo despegue"],
      ["🎉", "fiesta celebracion lanzamiento"],
      ["🎊", "confeti celebracion"],
      ["✨", "brillo destello nuevo magia"],
      ["🔥", "fuego oferta caliente hot"],
      ["💥", "explosion boom impacto"],
      ["⭐", "estrella destacado favorito"],
      ["🌟", "estrella brillo destacado"],
      ["🎯", "objetivo meta target puntería"],
      ["💡", "idea tip consejo bombilla"],
      ["📣", "megafono anuncio aviso promocion"],
      ["📢", "altavoz anuncio aviso"],
      ["🔔", "campana aviso notificacion recordatorio"],
      ["🎁", "regalo obsequio promo"],
      ["🏷️", "etiqueta precio descuento oferta"],
      ["💰", "dinero plata precio ahorro"],
      ["💸", "dinero descuento ahorro pago"],
      ["💵", "billete dinero precio"],
      ["🛒", "carrito compra tienda ecommerce"],
      ["🛍️", "bolsas compras tienda"],
      ["📦", "caja despacho envio pedido"],
      ["🚚", "camion despacho envio entrega"],
      ["🆕", "nuevo novedad"],
      ["🆓", "gratis free"],
      ["🔝", "top mejor arriba"],
      ["💯", "cien perfecto full"],
      ["⚡", "rapido energia flash express"],
      ["⏰", "reloj alarma tiempo urgente"],
      ["⏳", "tiempo ultimo dia plazo"],
      ["📅", "calendario fecha agenda"],
      ["📈", "grafico subida crecimiento ventas"],
      ["📊", "grafico datos reporte estadistica"],
      ["🤝", "acuerdo trato alianza socio"],
      ["👉", "mano derecha señala aqui"],
      ["👇", "mano abajo mira aqui"],
      ["✅", "check listo aprobado si"],
      ["❗", "exclamacion importante atencion"],
      ["❓", "pregunta duda consulta"],
      ["💬", "mensaje comentario chat"],
      ["📩", "correo mail mensaje sobre"],
    ],
  },
  {
    id: "pintura",
    label: "Pintura y obra",
    icon: "🎨",
    emojis: [
      ["🎨", "pintura paleta color arte"],
      ["🖌️", "pincel pintura brocha"],
      ["🖍️", "crayon color dibujo"],
      ["🪣", "balde tineta cubeta pintura"],
      ["🧽", "esponja limpieza"],
      ["🧴", "envase botella diluyente producto"],
      ["🪜", "escalera altura obra"],
      ["🔨", "martillo herramienta obra"],
      ["🔧", "llave herramienta reparacion"],
      ["🪛", "destornillador herramienta"],
      ["🪚", "sierra madera herramienta"],
      ["🧰", "caja herramientas kit"],
      ["⚙️", "engranaje industrial maquina"],
      ["🧱", "ladrillo muro pared construccion"],
      ["🏗️", "grua construccion obra"],
      ["🚧", "obra faena precaucion trabajo"],
      ["👷", "maestro obrero constructor faena"],
      ["🦺", "chaleco seguridad epp"],
      ["🥽", "antiparras lentes seguridad epp"],
      ["🧤", "guantes seguridad epp"],
      ["😷", "mascarilla proteccion respirador"],
      ["🏠", "casa hogar vivienda"],
      ["🏡", "casa jardin hogar"],
      ["🏢", "edificio oficina empresa"],
      ["🏭", "fabrica industria planta"],
      ["🪟", "ventana marco"],
      ["🚪", "puerta acceso"],
      ["🛠️", "herramientas mantencion reparacion"],
      ["📐", "escuadra medida diseño"],
      ["📏", "regla medida metros"],
    ],
  },
  {
    id: "caras",
    label: "Caras",
    icon: "😀",
    emojis: [
      ["😀", "feliz sonrisa alegre"],
      ["😃", "feliz sonrisa"],
      ["😄", "feliz risa alegre"],
      ["😁", "sonrisa dientes feliz"],
      ["😊", "sonrisa tierna feliz timido"],
      ["🙂", "sonrisa leve"],
      ["😉", "guiño complice"],
      ["😍", "amor corazones encanta"],
      ["🥰", "amor cariño encanta"],
      ["😘", "beso cariño"],
      ["🤩", "estrellas asombro wow"],
      ["😎", "lentes cool genial"],
      ["🤓", "nerd estudioso"],
      ["🤔", "pensando duda"],
      ["🤗", "abrazo bienvenida"],
      ["😅", "risa nervios alivio"],
      ["😂", "risa llorando chiste"],
      ["🤣", "risa carcajada"],
      ["😮", "sorpresa asombro"],
      ["😱", "susto miedo shock"],
      ["😢", "triste llanto pena"],
      ["😭", "llanto triste"],
      ["😤", "molesto orgulloso enojo"],
      ["😠", "enojado molesto"],
      ["🥳", "fiesta celebracion cumpleaños"],
      ["🤯", "explota mente increible wow"],
      ["😴", "sueño dormir aburrido"],
      ["🤑", "dinero plata negocio"],
      ["🙌", "manos arriba celebracion"],
      ["🙏", "gracias favor porfavor rezo"],
    ],
  },
  {
    id: "gestos",
    label: "Gestos",
    icon: "👍",
    emojis: [
      ["👍", "pulgar arriba bien aprobado like"],
      ["👎", "pulgar abajo mal"],
      ["👏", "aplauso felicitaciones bravo"],
      ["👋", "hola saludo chao"],
      ["✌️", "paz victoria"],
      ["🤙", "llamame shaka"],
      ["💪", "fuerza musculo animo"],
      ["✍️", "escribir firma"],
      ["🫡", "saludo listo entendido"],
      ["🤞", "suerte dedos cruzados"],
      ["👌", "ok perfecto bien"],
      ["🫶", "corazon manos cariño"],
      ["👀", "ojos mira atencion"],
      ["🧠", "cerebro idea inteligente"],
      ["🦾", "fuerza brazo robot"],
      ["🫰", "dedos plata corazon"],
    ],
  },
  {
    id: "objetos",
    label: "Oficina",
    icon: "📋",
    emojis: [
      ["📋", "portapapeles lista tarea"],
      ["📝", "nota escribir apunte"],
      ["📄", "documento hoja archivo"],
      ["📑", "documentos separadores"],
      ["🗂️", "carpetas archivo orden"],
      ["📁", "carpeta archivo"],
      ["📚", "libros manual guia"],
      ["🔖", "marcador etiqueta"],
      ["🧾", "boleta factura recibo"],
      ["💳", "tarjeta pago credito"],
      ["🏦", "banco transferencia"],
      ["📞", "telefono llamada contacto"],
      ["📱", "celular movil app"],
      ["💻", "notebook computador"],
      ["🖥️", "computador pantalla escritorio"],
      ["🖨️", "impresora imprimir"],
      ["📷", "camara foto"],
      ["🎥", "video camara grabar"],
      ["🔍", "buscar lupa buscador"],
      ["🔒", "candado seguridad privado"],
      ["🔑", "llave acceso clave"],
      ["📍", "ubicacion pin lugar direccion"],
      ["🗺️", "mapa ubicacion ruta"],
      ["🌐", "web internet sitio mundo"],
      ["✉️", "correo mail sobre"],
      ["📮", "buzon correo"],
      ["🖇️", "clip adjunto"],
      ["📌", "chincheta fijar importante"],
      ["🗓️", "calendario agenda fecha"],
      ["⌛", "tiempo plazo"],
    ],
  },
  {
    id: "simbolos",
    label: "Símbolos",
    icon: "❤️",
    emojis: [
      ["❤️", "corazon amor rojo"],
      ["🧡", "corazon naranja"],
      ["💛", "corazon amarillo"],
      ["💚", "corazon verde"],
      ["💙", "corazon azul"],
      ["💜", "corazon morado"],
      ["🖤", "corazon negro"],
      ["🤍", "corazon blanco"],
      ["❌", "error no incorrecto"],
      ["⛔", "prohibido alto no"],
      ["⚠️", "advertencia precaucion cuidado"],
      ["♻️", "reciclaje ecologico sustentable"],
      ["🔴", "circulo rojo color"],
      ["🟠", "circulo naranja color"],
      ["🟡", "circulo amarillo color"],
      ["🟢", "circulo verde color"],
      ["🔵", "circulo azul color"],
      ["🟣", "circulo morado color"],
      ["🟤", "circulo cafe color"],
      ["⚫", "circulo negro color"],
      ["⚪", "circulo blanco color"],
      ["🔶", "rombo naranja"],
      ["▶️", "play reproducir"],
      ["➡️", "flecha derecha siguiente"],
      ["⬅️", "flecha izquierda volver"],
      ["⬆️", "flecha arriba subir"],
      ["⬇️", "flecha abajo bajar"],
      ["🔄", "actualizar repetir ciclo"],
      ["#️⃣", "numeral hashtag"],
      ["©️", "copyright derechos"],
    ],
  },
  {
    id: "varios",
    label: "Varios",
    icon: "🌞",
    emojis: [
      ["🌞", "sol verano dia"],
      ["☀️", "sol despejado verano"],
      ["🌤️", "sol nubes clima"],
      ["🌧️", "lluvia invierno clima"],
      ["❄️", "nieve frio invierno"],
      ["🌈", "arcoiris colores"],
      ["🌱", "brote planta crecer nuevo"],
      ["🌿", "hoja natural verde ecologico"],
      ["🌳", "arbol naturaleza"],
      ["🌸", "flor primavera"],
      ["🎄", "navidad arbol fiestas"],
      ["🎃", "halloween calabaza"],
      ["🥂", "brindis celebracion fiestas"],
      ["🍻", "cerveza brindis celebracion"],
      ["☕", "cafe pausa mañana"],
      ["🍽️", "comida almuerzo restaurante"],
      ["🏆", "trofeo premio ganador"],
      ["🥇", "medalla oro primero"],
      ["🎖️", "medalla reconocimiento"],
      ["🎓", "graduacion capacitacion curso"],
      ["🧑‍🏫", "profesor capacitacion clase"],
      ["🧑‍💼", "ejecutivo vendedor asesor"],
      ["👨‍🔧", "tecnico mecanico servicio"],
      ["🚗", "auto vehiculo movilidad"],
      ["✈️", "avion viaje envio"],
      ["🌍", "mundo global planeta"],
      ["🏁", "meta bandera fin"],
      ["🧩", "puzzle solucion pieza"],
      ["🪄", "varita magia truco"],
      ["🔮", "bola prediccion futuro"],
    ],
  },
];

const ALL_EMOJIS: EmojiEntry[] = CATEGORIES.flatMap((c) => c.emojis);

function normalize(s: string) {
  // Sin tildes: "campaña"/"campana", "atencion"/"atención" matchean igual.
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

// ── Panel de selección ─────────────────────────────────────────
function EmojiGrid({ onPick }: { onPick: (emoji: string) => void }) {
  const [query, setQuery] = React.useState("");
  const [category, setCategory] = React.useState(CATEGORIES[0].id);

  const q = normalize(query);
  const results = React.useMemo(() => {
    if (!q) return CATEGORIES.find((c) => c.id === category)?.emojis ?? [];
    return ALL_EMOJIS.filter(([emoji, keywords]) => emoji === query.trim() || normalize(keywords).includes(q));
  }, [q, query, category]);

  return (
    <div className="flex flex-col">
      <div className="relative mb-2">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar emoji..."
          className="h-8 pl-8 pr-7 text-sm"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Limpiar búsqueda"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {!q && (
        <div className="flex items-center gap-0.5 mb-2 border-b pb-2 overflow-x-auto">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              title={c.label}
              onClick={() => setCategory(c.id)}
              className={cn(
                "shrink-0 h-7 w-7 rounded-md text-base leading-none transition-colors",
                category === c.id ? "bg-orange-100 dark:bg-orange-500/20" : "hover:bg-muted",
              )}
            >
              {c.icon}
            </button>
          ))}
        </div>
      )}

      <div className="h-52 overflow-y-auto pr-1">
        {results.length === 0 ? (
          <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
            Sin resultados para “{query}”
          </div>
        ) : (
          <div className="grid grid-cols-8 gap-0.5">
            {results.map(([emoji, keywords]) => (
              <button
                key={emoji}
                type="button"
                title={keywords.split(" ")[0]}
                onClick={() => onPick(emoji)}
                className="h-8 w-8 flex items-center justify-center rounded-md text-lg leading-none hover:bg-muted"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Botón + popover reutilizable ───────────────────────────────
export function EmojiPicker({
  onSelect,
  disabled,
  className,
  align = "end",
  title = "Insertar emoji",
}: {
  onSelect: (emoji: string) => void;
  disabled?: boolean;
  className?: string;
  align?: "start" | "center" | "end";
  title?: string;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    // modal: necesario dentro de un Dialog; si no, el focus trap del diálogo
    // se roba el foco del buscador.
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          title={title}
          aria-label={title}
          className={cn(
            "inline-flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50 disabled:pointer-events-none",
            className,
          )}
        >
          <Smile className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align={align}
        className="w-[300px] p-2"
        // Al cerrar no devolvemos el foco al botón: quien inserta el emoji
        // (EmojiInput) vuelve a enfocar el campo en la posición del cursor.
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <EmojiGrid
          onPick={(emoji) => {
            onSelect(emoji);
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

// ── Input con selector de emojis integrado ─────────────────────
type EmojiInputProps = Omit<React.ComponentProps<"input">, "value" | "onChange"> & {
  value: string;
  onValueChange: (value: string) => void;
};

export const EmojiInput = React.forwardRef<HTMLInputElement, EmojiInputProps>(
  ({ value, onValueChange, className, disabled, ...props }, forwardedRef) => {
    const inputRef = React.useRef<HTMLInputElement | null>(null);
    // Última posición del cursor: el popover roba el foco al abrirse.
    const caret = React.useRef<number | null>(null);

    const rememberCaret = () => {
      caret.current = inputRef.current?.selectionStart ?? null;
    };

    const insert = (emoji: string) => {
      const el = inputRef.current;
      const pos = caret.current ?? value.length;
      const next = value.slice(0, pos) + emoji + value.slice(pos);
      onValueChange(next);
      const newPos = pos + emoji.length;
      caret.current = newPos;
      requestAnimationFrame(() => {
        el?.focus();
        el?.setSelectionRange(newPos, newPos);
      });
    };

    return (
      <div className="relative">
        <Input
          {...props}
          ref={(node) => {
            inputRef.current = node;
            if (typeof forwardedRef === "function") forwardedRef(node);
            else if (forwardedRef) forwardedRef.current = node;
          }}
          value={value}
          disabled={disabled}
          onChange={(e) => {
            onValueChange(e.target.value);
            rememberCaret();
          }}
          onKeyUp={(e) => {
            rememberCaret();
            props.onKeyUp?.(e);
          }}
          onClick={(e) => {
            rememberCaret();
            props.onClick?.(e);
          }}
          onSelect={(e) => {
            rememberCaret();
            props.onSelect?.(e);
          }}
          onBlur={(e) => {
            rememberCaret();
            props.onBlur?.(e);
          }}
          className={cn("pr-10", className)}
        />
        <div className="absolute right-1.5 top-1/2 -translate-y-1/2">
          <EmojiPicker onSelect={insert} disabled={disabled} />
        </div>
      </div>
    );
  },
);
EmojiInput.displayName = "EmojiInput";
