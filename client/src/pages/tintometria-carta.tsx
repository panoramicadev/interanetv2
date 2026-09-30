/**
 * Carta de colores: la pantonera Panorámica (Copper Color) y la cartilla
 * Sherwin-Williams del libro tintométrico.
 *
 * Es lo que se le muestra al cliente: código, nombre y el color. Al tocar un
 * color se abre su ficha y, para quien tenga "Ver fórmulas" (el operador que
 * tiñe), la fórmula de cada línea y base, con las dosis por formato tal como
 * las escribe el libro ("0Y12-0") y su equivalente aproximado en ml.
 *
 * La carta completa (unos 2.800 colores) se trae una vez y se filtra en el
 * navegador: buscar no espera al servidor.
 */
import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Check, Copy, FlaskConical, Loader2, Palette, Search, Send, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TABS_LIST_PILL_SOFT, TAB_PILL_SOFT } from "@/components/gastos/tabs-pill";
import { ICONO_CHIP, ICONO_CHIP_ICONO } from "@/lib/icono-chip";
import { usePermissions } from "@/hooks/usePermissions";
import {
  dosisEnMl,
  esDosisVacia,
  formatosDeFormula,
  nombreCartilla,
  nombreFormato,
  type ItemFormula,
} from "@shared/tintometria";
import type { TintoFormula } from "@shared/schema";

interface ColorCarta {
  id: string;
  cartilla: string;
  codigo: string;
  nombre: string | null;
  hex: string | null;
  grupo: string | null;
  formulas: number;
}

/** Texto blanco sobre colores oscuros, gris oscuro sobre claros. */
function esOscuro(hex: string | null): boolean {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex ?? "");
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.299 * r + 0.587 * g + 0.114 * b < 150;
}

const normalizar = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[\s-]+/g, "");

const titulo = (s: string) => s.toLowerCase().replace(/(^|\s)\S/g, (l) => l.toUpperCase());

export default function TintometriaCartaPage() {
  const { can } = usePermissions();
  const verFormulas = can("tintometria.formulas");
  const puedeSolicitar = can("tintometria.solicitudes");
  const [cartilla, setCartilla] = useState("PANORAMICA");
  const [busqueda, setBusqueda] = useState("");
  const [elegido, setElegido] = useState<ColorCarta | null>(null);

  const { data: colores = [], isLoading } = useQuery<ColorCarta[]>({
    queryKey: ["/api/tintometria/carta"],
    staleTime: 5 * 60 * 1000,
  });

  const cartillas = useMemo(() => {
    const cuenta = new Map<string, number>();
    colores.forEach((c) => cuenta.set(c.cartilla, (cuenta.get(c.cartilla) ?? 0) + 1));
    // Panorámica primero: es la carta de la casa.
    return Array.from(cuenta.entries()).sort(([a], [b]) =>
      a === "PANORAMICA" ? -1 : b === "PANORAMICA" ? 1 : a.localeCompare(b),
    );
  }, [colores]);

  const deLaCartilla = useMemo(() => colores.filter((c) => c.cartilla === cartilla), [colores, cartilla]);

  const q = normalizar(busqueda.trim());
  const filtrados = useMemo(
    () =>
      q
        ? deLaCartilla.filter(
            (c) => normalizar(c.codigo).includes(q) || normalizar(c.nombre ?? "").includes(q),
          )
        : deLaCartilla,
    [deLaCartilla, q],
  );

  // Sin búsqueda, la carta se lee como la pantonera: por carátula.
  const caratulas = useMemo(() => {
    if (q) return [];
    const grupos = new Map<string, ColorCarta[]>();
    for (const c of deLaCartilla) {
      const g = c.grupo ?? "";
      if (!grupos.has(g)) grupos.set(g, []);
      grupos.get(g)!.push(c);
    }
    return Array.from(grupos.entries());
  }, [deLaCartilla, q]);
  const porCaratula = !q && deLaCartilla.every((c) => !!c.grupo) && deLaCartilla.length > 0;

  return (
    <div className="p-3 sm:p-5 space-y-4 max-w-7xl mx-auto">
      <div className="flex items-start gap-3">
        <div className={ICONO_CHIP}>
          <Palette className={ICONO_CHIP_ICONO} />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Carta de colores</h1>
          <p className="hidden sm:block text-sm text-slate-500 dark:text-slate-400">
            Pantonera Panorámica y cartilla Sherwin-Williams. Toca un color para ver su ficha
            {verFormulas ? " y su fórmula" : ""}.
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        {cartillas.length > 1 && (
          <Tabs value={cartilla} onValueChange={(v) => { setCartilla(v); setBusqueda(""); }}>
            <TabsList className={TABS_LIST_PILL_SOFT}>
              {cartillas.map(([codigo, total]) => (
                <TabsTrigger key={codigo} value={codigo} className={TAB_PILL_SOFT} data-testid={`tab-cartilla-${codigo}`}>
                  {nombreCartilla(codigo)}
                  <span className="tabular-nums opacity-60">{total.toLocaleString("es-CL")}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        )}
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por código o nombre"
            className="h-10 rounded-xl pl-9 pr-9 bg-slate-50/60 focus-visible:border-[#fd6301] focus-visible:ring-orange-500/20"
            data-testid="input-buscar-color"
          />
          {busqueda && (
            <button
              onClick={() => setBusqueda("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              aria-label="Limpiar búsqueda"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        {q && (
          <span className="text-sm text-slate-500 tabular-nums">
            {filtrados.length.toLocaleString("es-CL")} {filtrados.length === 1 ? "color" : "colores"}
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando la carta…
        </div>
      ) : deLaCartilla.length === 0 ? (
        <p className="py-16 text-center text-sm text-slate-400">Todavía no hay colores cargados en esta cartilla.</p>
      ) : filtrados.length === 0 ? (
        <p className="py-16 text-center text-sm text-slate-400">Ningún color coincide con «{busqueda}».</p>
      ) : porCaratula ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {caratulas.map(([grupo, lista]) => (
            <div
              key={grupo}
              className="rounded-2xl border border-slate-200/70 dark:border-slate-700/60 bg-white dark:bg-slate-900/40 p-2 shadow-sm"
            >
              <div className="flex items-baseline justify-between px-1 pb-1.5 mb-1.5 border-b-2 border-[#fd6301]/70">
                <span className="text-sm font-bold text-slate-800 dark:text-slate-100">{grupo}</span>
                <span className="text-[10px] text-slate-400">{lista.length} colores</span>
              </div>
              <div className="space-y-1">
                {lista.map((c) => (
                  <Muestra key={c.id} color={c} onElegir={setElegido} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2">
          {filtrados.map((c) => (
            <Muestra key={c.id} color={c} onElegir={setElegido} />
          ))}
        </div>
      )}

      <p className="text-[11px] text-slate-400">
        Colores referenciales para visualización digital: la percepción puede variar según la pantalla, la
        iluminación y el sustrato.
      </p>

      <FichaColor
        color={elegido}
        verFormulas={verFormulas}
        puedeSolicitar={puedeSolicitar}
        onCerrar={() => setElegido(null)}
      />
    </div>
  );
}

function Muestra({ color, onElegir }: { color: ColorCarta; onElegir: (c: ColorCarta) => void }) {
  const oscuro = esOscuro(color.hex);
  const conColor = !!color.hex;
  return (
    <button
      type="button"
      onClick={() => onElegir(color)}
      className={`group w-full rounded-lg px-2 py-1.5 text-left transition-all hover:ring-2 hover:ring-[#fd6301]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fd6301] ${
        conColor ? "min-h-[56px]" : "border border-slate-200/70 bg-slate-50 dark:border-slate-700/60 dark:bg-slate-800/60"
      }`}
      style={conColor ? { backgroundColor: color.hex! } : undefined}
      data-testid={`color-${color.codigo}`}
    >
      <div
        className={`flex items-baseline justify-between gap-1 text-[11px] font-bold ${
          conColor ? (oscuro ? "text-white" : "text-slate-800") : "text-slate-700 dark:text-slate-200"
        }`}
      >
        <span className="truncate">{color.codigo}</span>
        {conColor && <span className="font-normal opacity-70 hidden sm:inline">{color.hex}</span>}
      </div>
      {color.nombre && (
        <div className={`mt-2 truncate text-[11px] ${oscuro ? "text-white/90" : "text-slate-700"}`}>{color.nombre}</div>
      )}
    </button>
  );
}

function FichaColor({
  color,
  verFormulas,
  puedeSolicitar,
  onCerrar,
}: {
  color: ColorCarta | null;
  verFormulas: boolean;
  puedeSolicitar: boolean;
  onCerrar: () => void;
}) {
  const [copiado, setCopiado] = useState(false);
  const [, navegar] = useLocation();
  const { data: formulas = [], isLoading } = useQuery<TintoFormula[]>({
    queryKey: [`/api/tintometria/carta/${color?.id}/formulas`],
    enabled: !!color && verFormulas,
  });

  const copiarHex = async () => {
    if (!color?.hex) return;
    try {
      await navigator.clipboard.writeText(color.hex);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    } catch {
      // Sin permiso de portapapeles no pasa nada: el hex está a la vista.
    }
  };

  return (
    <Dialog open={!!color} onOpenChange={(abierto) => !abierto && onCerrar()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl">
        {color && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-baseline gap-2">
                <span>{color.codigo}</span>
                {color.nombre && <span className="font-normal text-slate-500">{color.nombre}</span>}
              </DialogTitle>
              <DialogDescription>
                {nombreCartilla(color.cartilla)}
                {color.grupo ? ` · carátula ${color.grupo}` : ""}
              </DialogDescription>
            </DialogHeader>

            {color.hex ? (
              <div className="rounded-2xl h-28 w-full shadow-inner" style={{ backgroundColor: color.hex }} />
            ) : (
              <div className="rounded-2xl h-16 w-full border border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center text-xs text-slate-400">
                Esta cartilla no trae muestra digital del color
              </div>
            )}
            {color.hex && (
              <button
                onClick={copiarHex}
                className="inline-flex items-center gap-1.5 justify-self-start rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-xs font-mono text-slate-600 dark:text-slate-300 hover:border-orange-200 hover:text-[#fd6301]"
              >
                {copiado ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {color.hex}
              </button>
            )}

            {verFormulas && (
              <div className="space-y-3 pt-1">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
                  <FlaskConical className="h-4 w-4 text-[#fd6301]" /> Fórmula
                </div>
                {isLoading ? (
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
                  </div>
                ) : formulas.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    Este color no tiene fórmula cargada. Si la necesitas, pídela a laboratorio.
                  </p>
                ) : (
                  formulas.map((f) => <TarjetaFormula key={f.id} formula={f} />)
                )}
              </div>
            )}

            {/* Fórmula para otra línea, o el precio para un cliente: se le pide a
                laboratorio con el color ya cargado. */}
            {puedeSolicitar && (
              <button
                type="button"
                onClick={() => navegar(`/tintometria/solicitudes?color=${color.id}`)}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:border-orange-200 hover:text-[#fd6301] dark:border-slate-700 dark:text-slate-200"
                data-testid="button-solicitar-laboratorio"
              >
                <Send className="h-4 w-4" /> Pedir fórmula o precio a laboratorio
              </button>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function TarjetaFormula({ formula }: { formula: TintoFormula }) {
  // Se muestran todos los colorantes del libro, también los que en este
  // formato no llegan a media raya ("0Y0-0"): así la ficha dice lo mismo que el
  // libro. Esos van atenuados.
  const items = (formula.items as ItemFormula[]) ?? [];
  const formatos = formatosDeFormula(items);
  const [formato, setFormato] = useState(formatos[0] ?? "1");

  return (
    <div className="rounded-2xl border border-slate-200/70 dark:border-slate-700/60 p-3 space-y-2.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          {titulo(formula.linea)} · Base {titulo(formula.base)}
          {formula.variante > 1 && <span className="font-normal text-slate-500"> · variante {formula.variante}</span>}
        </div>
        <div className="text-[11px] text-slate-400">
          {formula.origen === "libro" ? "Libro" : "Laboratorio"}
          {formula.version ? ` ${titulo(formula.version)}` : ""}
        </div>
      </div>

      {formula.alerta && (
        <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{formula.alerta}</span>
        </div>
      )}

      {formatos.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {formatos.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setFormato(g)}
              aria-pressed={formato === g}
              className={`h-8 px-3 rounded-xl text-xs font-bold border transition-all ${
                formato === g
                  ? "bg-[#fd6301] text-white border-[#fd6301] shadow-sm shadow-[#fd6301]/25"
                  : "bg-white dark:bg-slate-900/40 text-slate-600 dark:text-slate-300 border-slate-200/70 dark:border-slate-700/60 hover:border-[#fd6301]/50 hover:text-[#fd6301]"
              }`}
            >
              {nombreFormato(g)}
            </button>
          ))}
        </div>
      )}

      <table className="w-full text-sm">
        <thead>
          <tr className="text-[10px] uppercase tracking-wider text-slate-400">
            <th className="text-left font-bold pb-1">Colorante</th>
            <th className="text-right font-bold pb-1">{formatos.length > 1 ? "Dosis" : nombreFormato(formato)}</th>
            <th className="text-right font-bold pb-1">≈ ml</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it) => {
            const dosis = it.dosis?.[formato];
            const ml = dosisEnMl(dosis);
            const vacia = esDosisVacia(dosis);
            return (
              <tr
                key={it.colorante}
                className={`border-t border-slate-100 dark:border-slate-800 ${vacia ? "opacity-45" : ""}`}
              >
                <td className="py-1.5 font-bold text-slate-800 dark:text-slate-100">{it.colorante}</td>
                {/* Cero tachado: en la dosis un 0 confundido con una O cambia la fórmula. */}
                <td className="py-1.5 text-right font-semibold tabular-nums slashed-zero text-slate-800 dark:text-slate-100">
                  {dosis ?? "—"}
                </td>
                <td className="py-1.5 text-right tabular-nums text-slate-500">
                  {ml === null ? "—" : ml.toLocaleString("es-CL", { maximumFractionDigits: 1 })}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {formula.observaciones && (
        <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-line">{formula.observaciones}</p>
      )}
    </div>
  );
}
