/**
 * Libro de fórmulas: lo que hay cargado y la subida del libro tintométrico en
 * Excel. Vive como pestaña de Tintometría → Administrar Datos.
 *
 * Subir el libro reemplaza las fórmulas del libro de cada línea que venga en el
 * archivo (las que ya no vienen se apagan) y nunca toca las que respondió
 * laboratorio a pedido de un vendedor. Lo raro del libro no se corrige a
 * ciegas: vuelve como alertas para que laboratorio decida.
 */
import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, BookOpen, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { nombreCartilla } from "@shared/tintometria";

interface ResumenLibro {
  colores: Array<{ cartilla: string; colores: number; con_formula: number }>;
  lineas: Array<{
    cartilla: string;
    linea: string;
    origen: string;
    version: string | null;
    formulas: number;
    con_alerta: number;
    actualizado: string | null;
    cargado_por: string | null;
  }>;
}

interface ResultadoImportacion {
  hojas: Array<{ hoja: string; cartilla: string; linea: string; version: string | null; filas: number; formulas: number; repetidasIdenticas: number }>;
  coloresNuevos: number;
  formulasNuevas: number;
  formulasActualizadas: number;
  formulasDesactivadas: number;
  alertas: Array<{ cartilla: string; codigo: string; alerta: string }>;
  sinFormula: string[];
}

const num = (n: number) => n.toLocaleString("es-CL");
const fecha = (v: string | null) => (v ? new Date(v).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" }) : "—");

export function LibroFormulasAdmin() {
  const { toast } = useToast();
  const archivoRef = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [resultado, setResultado] = useState<ResultadoImportacion | null>(null);

  const { data: resumen, isLoading } = useQuery<ResumenLibro>({
    queryKey: ["/api/tintometria/libro/resumen"],
  });

  const subir = async (archivo: File) => {
    setSubiendo(true);
    setResultado(null);
    try {
      const datos = new FormData();
      datos.append("archivo", archivo);
      const res = await fetch("/api/tintometria/libro/importar", {
        method: "POST",
        body: datos,
        credentials: "include",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || "No se pudo importar el libro");
      setResultado(json);
      queryClient.invalidateQueries({ queryKey: ["/api/tintometria/libro/resumen"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tintometria/carta"] });
      toast({
        title: "Libro importado",
        description: `${num(json.formulasNuevas + json.formulasActualizadas)} fórmulas cargadas.`,
      });
    } catch (error: any) {
      toast({ title: "No se pudo importar el libro", description: error?.message, variant: "destructive" });
    } finally {
      setSubiendo(false);
      if (archivoRef.current) archivoRef.current.value = "";
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200/70 dark:border-slate-700/60 bg-white dark:bg-slate-900/40 p-4 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <BookOpen className="h-5 w-5 text-[#fd6301] mt-0.5" />
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Libro de fórmulas</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xl">
                Sube el libro tintométrico en Excel (el mismo formato del «Libro tintométrico EA Copper 960»). Se
                cargan todas sus hojas; las fórmulas del libro que ya no vengan quedan apagadas. Las fórmulas que
                respondió laboratorio no se tocan.
              </p>
            </div>
          </div>
          <input
            ref={archivoRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void subir(f);
            }}
            data-testid="input-libro-excel"
          />
          <Button
            onClick={() => archivoRef.current?.click()}
            disabled={subiendo}
            className="rounded-2xl bg-gradient-to-r from-[#fd6301] to-[#fd6301] hover:from-[#e35400] hover:to-[#e35400] text-white shadow-md shadow-orange-500/25"
            data-testid="button-subir-libro"
          >
            {subiendo ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
            {subiendo ? "Importando…" : "Subir libro en Excel"}
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {(resumen?.colores ?? []).map((c) => (
              <div key={c.cartilla} className="rounded-xl bg-slate-50 dark:bg-slate-800/60 px-3 py-2.5">
                <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
                  {nombreCartilla(c.cartilla)}
                </div>
                <div className="text-sm text-slate-700 dark:text-slate-200">
                  <span className="font-semibold tabular-nums">{num(c.colores)}</span> colores ·{" "}
                  <span className="font-semibold tabular-nums">{num(c.con_formula)}</span> con fórmula
                </div>
              </div>
            ))}
          </div>
        )}

        {(resumen?.lineas ?? []).length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-slate-400">
                  <th className="text-left font-bold py-1.5">Cartilla</th>
                  <th className="text-left font-bold py-1.5">Línea</th>
                  <th className="text-left font-bold py-1.5">Origen</th>
                  <th className="text-right font-bold py-1.5">Fórmulas</th>
                  <th className="text-right font-bold py-1.5">Con alerta</th>
                  <th className="text-left font-bold py-1.5 pl-3">Última carga</th>
                </tr>
              </thead>
              <tbody>
                {resumen!.lineas.map((l) => (
                  <tr key={`${l.cartilla}|${l.linea}|${l.origen}`} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="py-1.5">{nombreCartilla(l.cartilla)}</td>
                    <td className="py-1.5">
                      {l.linea}
                      {l.version && <span className="text-slate-400"> · {l.version}</span>}
                    </td>
                    <td className="py-1.5">{l.origen === "libro" ? "Libro" : "Laboratorio"}</td>
                    <td className="py-1.5 text-right tabular-nums">{num(l.formulas)}</td>
                    <td className="py-1.5 text-right tabular-nums">{num(l.con_alerta)}</td>
                    <td className="py-1.5 pl-3 text-slate-500">
                      {fecha(l.actualizado)}
                      {l.cargado_por ? ` · ${l.cargado_por}` : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {resultado && (
        <div className="rounded-2xl border border-slate-200/70 dark:border-slate-700/60 bg-white dark:bg-slate-900/40 p-4 space-y-3" data-testid="resultado-importacion">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-100">
            <FileSpreadsheet className="h-4 w-4 text-[#fd6301]" /> Resultado de la importación
          </div>
          <ul className="text-sm text-slate-700 dark:text-slate-200 space-y-1">
            {resultado.hojas.map((h) => (
              <li key={h.hoja}>
                <span className="font-semibold">{h.hoja}</span>: {num(h.formulas)} fórmulas de {h.linea}
                {h.version ? ` (${h.version})` : ""}
                {h.repetidasIdenticas > 0 ? ` · ${num(h.repetidasIdenticas)} filas repetidas idénticas omitidas` : ""}
              </li>
            ))}
            <li className="text-slate-500">
              {num(resultado.formulasNuevas)} nuevas · {num(resultado.formulasActualizadas)} actualizadas ·{" "}
              {num(resultado.formulasDesactivadas)} apagadas · {num(resultado.coloresNuevos)} colores nuevos
            </li>
          </ul>

          {resultado.sinFormula.length > 0 && (
            <div className="text-sm">
              <div className="font-semibold text-slate-700 dark:text-slate-200">
                Colores de la pantonera sin fórmula ({num(resultado.sinFormula.length)})
              </div>
              <p className="text-slate-500 break-words">{resultado.sinFormula.join(", ")}</p>
            </div>
          )}

          {resultado.alertas.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-sm font-semibold text-amber-700 dark:text-amber-400">
                <AlertTriangle className="h-4 w-4" /> Para revisar con laboratorio ({num(resultado.alertas.length)})
              </div>
              <ul className="max-h-64 overflow-y-auto space-y-1 text-xs text-slate-600 dark:text-slate-300">
                {resultado.alertas.map((a) => (
                  <li key={`${a.cartilla}|${a.codigo}`}>
                    <span className="font-mono font-bold">{a.codigo}</span> ({nombreCartilla(a.cartilla)}): {a.alerta}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
