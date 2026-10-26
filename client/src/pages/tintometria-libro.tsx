/**
 * Libro de Fórmulas: el libro tintométrico de cada producto (Esmalte al agua
 * Copper…), con una pestaña por cartilla del Excel (Pantonera, colores de
 * línea, Sherwin-Williams).
 *
 * Vive aparte de la Pantonera Digital: el libro no crea colores en la carta.
 * Los códigos de la pantonera Panorámica sí traen su nombre y su muestra.
 *
 * Lo ve el operador que tiñe ("Ver fórmulas") y quien administra tintometría,
 * que además sube el libro de cada producto. Subir otra versión del mismo
 * producto reemplaza la anterior (queda apagada, no se borra).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, BookOpen, FileSpreadsheet, Loader2, Package, Search, Upload, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TABS_LIST_PILL_SOFT, TAB_PILL_SOFT } from "@/components/gastos/tabs-pill";
import { ICONO_CHIP, ICONO_CHIP_ICONO } from "@/lib/icono-chip";
import { usePermissions } from "@/hooks/usePermissions";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { esDosisVacia, nombreFormato, type ItemFormula } from "@shared/tintometria";
import { TarjetaFormula, type FormulaCarta } from "@/pages/tintometria-carta";

interface LibroProducto {
  id: string;
  producto: string;
  linea: string | null;
  version: string | null;
  archivo: string | null;
  formulas: number;
  creadoPorNombre: string | null;
  createdAt: string | null;
  cartillas: Array<{ cartilla: string; formulas: number }>;
}

interface FormulaLibro {
  id: string;
  hoja: string | null;
  cartilla: string;
  codigo: string;
  base: string;
  variante: number;
  items: ItemFormula[];
  alerta: string | null;
  nombre: string | null;
  hex: string | null;
}

interface ResultadoCarga {
  producto: string;
  version: string | null;
  formulas: number;
  librosApagados: number;
  hojas: Array<{ hoja: string; cartilla: string; filas: number; formulas: number; repetidasIdenticas: number }>;
  alertas: Array<{ cartilla: string; codigo: string; alerta: string }>;
}

/** Nombre de cada cartilla en el libro. */
const CARTILLAS_LIBRO: Record<string, string> = {
  PANORAMICA: "Pantonera Copper Color",
  LINEA: "Colores de línea",
  SW: "Sherwin-Williams",
};
const nombreCartillaLibro = (c: string) => CARTILLAS_LIBRO[c] ?? c;

const normalizar = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[\s-]+/g, "");
const titulo = (s: string) => s.toLowerCase().replace(/(^|\s)\S/g, (l) => l.toUpperCase());
const num = (n: number) => n.toLocaleString("es-CL");
const fecha = (v: string | null) => (v ? new Date(v).toLocaleDateString("es-CL", { dateStyle: "medium" }) : "");

// 2.800 filas de una vez traban el celular: se muestran de a tramos.
const TRAMO = 200;

export default function TintometriaLibroPage() {
  const { can } = usePermissions();
  const esAdmin = can("tintometria.admin");
  const [libroId, setLibroId] = useState<string | null>(null);
  const [cartilla, setCartilla] = useState<string | null>(null);
  const [formato, setFormato] = useState("1");
  const [busqueda, setBusqueda] = useState("");
  const [mostrar, setMostrar] = useState(TRAMO);
  const [elegida, setElegida] = useState<FormulaLibro | null>(null);
  const [subirAbierto, setSubirAbierto] = useState(false);

  const { data: libros = [], isLoading: cargandoLibros } = useQuery<LibroProducto[]>({
    queryKey: ["/api/tintometria/libros"],
  });
  const libro = libros.find((l) => l.id === libroId) ?? libros[0] ?? null;

  const { data: formulas = [], isLoading: cargandoFormulas } = useQuery<FormulaLibro[]>({
    queryKey: [`/api/tintometria/libros/${libro?.id}/formulas`],
    enabled: !!libro,
    staleTime: 5 * 60 * 1000,
  });

  const cartillaActiva = cartilla && libro?.cartillas.some((c) => c.cartilla === cartilla)
    ? cartilla
    : libro?.cartillas[0]?.cartilla ?? null;

  const formatos = useMemo(() => {
    const set = new Set<string>();
    formulas.forEach((f) => f.items.forEach((i) => Object.keys(i.dosis ?? {}).forEach((k) => set.add(k))));
    return Array.from(set).sort((a, b) => Number(a) - Number(b));
  }, [formulas]);

  const q = normalizar(busqueda.trim());
  const filtradas = useMemo(
    () =>
      formulas.filter(
        (f) =>
          f.cartilla === cartillaActiva &&
          (!q || normalizar(f.codigo).includes(q) || normalizar(f.nombre ?? "").includes(q)),
      ),
    [formulas, cartillaActiva, q],
  );
  const maxColorantes = useMemo(() => Math.max(1, ...filtradas.map((f) => f.items.length)), [filtradas]);

  useEffect(() => setMostrar(TRAMO), [cartillaActiva, q, libro?.id]);

  return (
    <div className="p-3 sm:p-5 space-y-4 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className={ICONO_CHIP}>
            <BookOpen className={ICONO_CHIP_ICONO} />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Libro de Fórmulas</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {libro
                ? [libro.producto, libro.version ? `versión ${titulo(libro.version)}` : null, `${num(libro.formulas)} fórmulas`]
                    .filter(Boolean)
                    .join(" · ")
                : "Fórmulas tintométricas por producto"}
            </p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          {libros.length > 1 && (
            <div className="flex items-center gap-3 bg-white dark:bg-slate-900/40 border border-slate-200/70 dark:border-slate-700/60 rounded-2xl pl-2.5 pr-4 py-2.5 shadow-sm hover:border-orange-200 hover:shadow transition-all">
              <div className="flex items-center justify-center w-9 h-9 rounded-xl text-[#fd6301] flex-shrink-0">
                <Package className="h-4 w-4" />
              </div>
              <div className="flex flex-col leading-none">
                <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-0.5">Producto</span>
                <Select value={libro?.id} onValueChange={(v) => { setLibroId(v); setCartilla(null); setBusqueda(""); }}>
                  <SelectTrigger
                    className="h-5 border-0 shadow-none p-0 gap-2 w-auto bg-transparent font-semibold text-sm text-slate-700 dark:text-slate-200 focus:ring-0 [&>svg]:h-3.5 [&>svg]:w-3.5 [&>svg]:opacity-60"
                    data-testid="select-producto-libro"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {libros.map((l) => (
                      <SelectItem key={l.id} value={l.id}>{l.producto}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          {esAdmin && (
            <Button
              onClick={() => setSubirAbierto(true)}
              className="h-10 px-4 rounded-2xl bg-gradient-to-r from-[#fd6301] to-[#fd6301] hover:from-[#e35400] hover:to-[#e35400] text-white shadow-md shadow-orange-500/25 transition-all"
              data-testid="button-subir-libro-producto"
            >
              <Upload className="h-4 w-4 mr-2" /> Subir libro
            </Button>
          )}
        </div>
      </div>

      {cargandoLibros ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
        </div>
      ) : !libro ? (
        <p className="py-16 text-center text-sm text-slate-400">
          Todavía no hay libros cargados.{esAdmin ? " Usa «Subir libro» para cargar el Excel de un producto." : ""}
        </p>
      ) : (
        <>
          <div className="flex flex-col lg:flex-row lg:items-center gap-3">
            {libro.cartillas.length > 1 && (
              <Tabs value={cartillaActiva ?? undefined} onValueChange={(v) => { setCartilla(v); setBusqueda(""); }}>
                <TabsList className={`${TABS_LIST_PILL_SOFT} max-w-full overflow-x-auto justify-start [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`}>
                  {libro.cartillas.map((c) => (
                    <TabsTrigger key={c.cartilla} value={c.cartilla} className={`${TAB_PILL_SOFT} shrink-0`} data-testid={`tab-libro-${c.cartilla}`}>
                      {nombreCartillaLibro(c.cartilla)}
                      <span className="tabular-nums opacity-60">{num(c.formulas)}</span>
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            )}
            <div className="relative flex-1 lg:max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por código o nombre"
                className="h-10 rounded-xl pl-9 pr-9 bg-slate-50/60 focus-visible:border-[#fd6301] focus-visible:ring-orange-500/20"
                data-testid="input-buscar-libro"
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
          </div>

          {formatos.length > 1 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mr-1">Formato</span>
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
                  data-testid={`formato-${g}`}
                >
                  {nombreFormato(g)}
                </button>
              ))}
              {q && (
                <span className="ml-auto text-sm text-slate-500 tabular-nums">
                  {num(filtradas.length)} {filtradas.length === 1 ? "fórmula" : "fórmulas"}
                </span>
              )}
            </div>
          )}

          {cargandoFormulas ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" /> Cargando fórmulas…
            </div>
          ) : filtradas.length === 0 ? (
            <p className="py-16 text-center text-sm text-slate-400">
              {q ? `Ninguna fórmula coincide con «${busqueda}».` : "Esta cartilla no trae fórmulas."}
            </p>
          ) : (
            <>
              <div className="hidden md:block rounded-2xl border border-slate-200/70 dark:border-slate-700/60 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800/60">
                    <tr className="text-[10px] uppercase tracking-wider text-slate-400">
                      <th className="text-left font-bold px-3 py-2">Color</th>
                      <th className="text-left font-bold px-3 py-2">Base</th>
                      {Array.from({ length: maxColorantes }, (_, i) => (
                        <th key={i} className="text-left font-bold px-3 py-2">Colorante {i + 1}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtradas.slice(0, mostrar).map((f) => (
                      <tr
                        key={f.id}
                        onClick={() => setElegida(f)}
                        className="border-t border-slate-100 dark:border-slate-800 cursor-pointer hover:bg-orange-50/60 dark:hover:bg-slate-800/60"
                        data-testid={`fila-libro-${f.codigo}`}
                      >
                        <td className="px-3 py-2">
                          <CeldaColor formula={f} />
                        </td>
                        <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{titulo(f.base)}</td>
                        {Array.from({ length: maxColorantes }, (_, i) => {
                          const it = f.items[i];
                          const dosis = it?.dosis?.[formato];
                          return (
                            <td key={i} className={`px-3 py-2 whitespace-nowrap ${it && esDosisVacia(dosis) ? "opacity-45" : ""}`}>
                              {it ? (
                                <>
                                  <span className="font-bold text-slate-800 dark:text-slate-100">{it.colorante}</span>{" "}
                                  <span className="tabular-nums slashed-zero text-slate-700 dark:text-slate-200">{dosis ?? "—"}</span>
                                </>
                              ) : null}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="md:hidden space-y-2">
                {filtradas.slice(0, mostrar).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setElegida(f)}
                    className="w-full text-left rounded-2xl border border-slate-200/70 dark:border-slate-700/60 bg-white dark:bg-slate-900/40 p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <CeldaColor formula={f} />
                      <span className="text-xs text-slate-500">Base {titulo(f.base)}</span>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                      {f.items.map((it) => (
                        <span key={it.colorante} className={esDosisVacia(it.dosis?.[formato]) ? "opacity-45" : ""}>
                          <span className="font-bold text-slate-800 dark:text-slate-100">{it.colorante}</span>{" "}
                          <span className="tabular-nums slashed-zero">{it.dosis?.[formato] ?? "—"}</span>
                        </span>
                      ))}
                    </div>
                  </button>
                ))}
              </div>

              {filtradas.length > mostrar && (
                <div className="flex justify-center">
                  <Button
                    variant="outline"
                    onClick={() => setMostrar((m) => m + TRAMO * 2)}
                    className="h-10 px-4 rounded-2xl text-sm font-semibold hover:border-orange-200 hover:text-[#fd6301]"
                  >
                    Ver más ({num(filtradas.length - mostrar)} restantes)
                  </Button>
                </div>
              )}
            </>
          )}

          <p className="text-[11px] text-slate-400">
            Dosis en la notación de la máquina: onzas «Y» 48avos de onza, y «-1» suma media raya.
            {libro.createdAt ? ` Cargado el ${fecha(libro.createdAt)}` : ""}
            {libro.creadoPorNombre ? ` por ${libro.creadoPorNombre}` : ""}
            {libro.archivo ? ` (${libro.archivo}).` : "."}
          </p>
        </>
      )}

      <Dialog open={!!elegida} onOpenChange={(abierto) => !abierto && setElegida(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl">
          {elegida && libro && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-baseline gap-2">
                  <span>{elegida.codigo}</span>
                  {elegida.nombre && <span className="font-normal text-slate-500">{elegida.nombre}</span>}
                </DialogTitle>
                <DialogDescription>
                  {libro.producto} · {nombreCartillaLibro(elegida.cartilla)}
                </DialogDescription>
              </DialogHeader>
              {elegida.hex && <div className="rounded-2xl h-20 w-full shadow-inner" style={{ backgroundColor: elegida.hex }} />}
              <TarjetaFormula
                formula={{
                  id: elegida.id,
                  linea: libro.producto,
                  base: elegida.base,
                  variante: elegida.variante,
                  origen: "libro",
                  version: libro.version,
                  items: elegida.items,
                  alerta: elegida.alerta,
                  observaciones: null,
                } as unknown as FormulaCarta}
              />
            </>
          )}
        </DialogContent>
      </Dialog>

      {esAdmin && (
        <SubirLibro
          abierto={subirAbierto}
          productoSugerido={libro?.producto ?? ""}
          onCerrar={() => setSubirAbierto(false)}
          onCargado={(id) => { setLibroId(id); setCartilla(null); }}
        />
      )}
    </div>
  );
}

function CeldaColor({ formula }: { formula: FormulaLibro }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      {formula.hex ? (
        <span className="h-6 w-6 shrink-0 rounded-md border border-black/5" style={{ backgroundColor: formula.hex }} />
      ) : null}
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-100">
          <span className="truncate">{formula.codigo}</span>
          {formula.variante > 1 && <span className="text-[10px] font-normal text-slate-400">var. {formula.variante}</span>}
          {formula.alerta && <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" aria-label="Revisar con laboratorio" />}
        </div>
        {formula.nombre && <div className="truncate text-xs text-slate-500">{formula.nombre}</div>}
      </div>
    </div>
  );
}

function SubirLibro({
  abierto,
  productoSugerido,
  onCerrar,
  onCargado,
}: {
  abierto: boolean;
  productoSugerido: string;
  onCerrar: () => void;
  onCargado: (libroId: string) => void;
}) {
  const { toast } = useToast();
  const archivoRef = useRef<HTMLInputElement>(null);
  const [producto, setProducto] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [resultado, setResultado] = useState<ResultadoCarga | null>(null);

  useEffect(() => {
    if (abierto) {
      setProducto(productoSugerido);
      setArchivo(null);
      setResultado(null);
    }
  }, [abierto, productoSugerido]);

  const subir = async () => {
    if (!archivo || !producto.trim()) return;
    setSubiendo(true);
    try {
      const datos = new FormData();
      datos.append("producto", producto.trim());
      datos.append("archivo", archivo);
      const res = await fetch("/api/tintometria/libros/importar", { method: "POST", body: datos, credentials: "include" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || "No se pudo cargar el libro");
      setResultado(json);
      await queryClient.invalidateQueries({ queryKey: ["/api/tintometria/libros"] });
      onCargado(json.libroId);
      toast({ title: "Libro cargado", description: `${num(json.formulas)} fórmulas de ${json.producto}.` });
    } catch (error: any) {
      toast({ title: "No se pudo cargar el libro", description: error?.message, variant: "destructive" });
    } finally {
      setSubiendo(false);
    }
  };

  return (
    <Dialog open={abierto} onOpenChange={(a) => !a && !subiendo && onCerrar()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle>Subir libro de fórmulas</DialogTitle>
          <DialogDescription>
            El Excel del libro tintométrico de un producto, con una hoja por cartilla. Si el producto ya tenía libro,
            este lo reemplaza.
          </DialogDescription>
        </DialogHeader>

        {resultado ? (
          <div className="space-y-3" data-testid="resultado-libro-producto">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-100">
              <FileSpreadsheet className="h-4 w-4 text-[#fd6301]" /> {num(resultado.formulas)} fórmulas de {resultado.producto}
            </div>
            <ul className="text-sm text-slate-700 dark:text-slate-200 space-y-1">
              {resultado.hojas.map((h) => (
                <li key={h.hoja}>
                  <span className="font-semibold">{nombreCartillaLibro(h.cartilla)}</span>: {num(h.formulas)} fórmulas
                  {h.repetidasIdenticas > 0 ? ` · ${num(h.repetidasIdenticas)} filas repetidas omitidas` : ""}
                </li>
              ))}
              {resultado.librosApagados > 0 && (
                <li className="text-slate-500">Reemplaza el libro anterior de este producto.</li>
              )}
            </ul>
            {resultado.alertas.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-sm font-semibold text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="h-4 w-4" /> Para revisar con laboratorio ({num(resultado.alertas.length)})
                </div>
                <ul className="max-h-48 overflow-y-auto space-y-1 text-xs text-slate-600 dark:text-slate-300">
                  {resultado.alertas.map((a) => (
                    <li key={`${a.cartilla}|${a.codigo}`}>
                      <span className="font-mono font-bold">{a.codigo}</span> ({nombreCartillaLibro(a.cartilla)}): {a.alerta}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <Button onClick={onCerrar} className="w-full h-10 rounded-2xl bg-[#fd6301] hover:bg-[#e35400] text-white">
              Listo
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Producto</label>
              <Input
                value={producto}
                onChange={(e) => setProducto(e.target.value)}
                placeholder="Ej: Esmalte al agua Copper"
                className="h-10 rounded-xl bg-slate-50/60 focus-visible:border-[#fd6301] focus-visible:ring-orange-500/20"
                data-testid="input-producto-libro"
              />
            </div>
            <input
              ref={archivoRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
              data-testid="input-archivo-libro"
            />
            <button
              type="button"
              onClick={() => archivoRef.current?.click()}
              className="w-full rounded-2xl border border-dashed border-slate-300 dark:border-slate-600 px-4 py-5 text-sm text-slate-600 dark:text-slate-300 hover:border-[#fd6301] hover:text-[#fd6301] flex items-center justify-center gap-2"
            >
              <FileSpreadsheet className="h-4 w-4" />
              {archivo ? archivo.name : "Elegir el Excel del libro"}
            </button>
            <Button
              onClick={subir}
              disabled={!archivo || !producto.trim() || subiendo}
              className="w-full h-10 rounded-2xl bg-gradient-to-r from-[#fd6301] to-[#fd6301] hover:from-[#e35400] hover:to-[#e35400] text-white shadow-md shadow-orange-500/25"
              data-testid="button-cargar-libro"
            >
              {subiendo ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
              {subiendo ? "Cargando…" : "Cargar libro"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
