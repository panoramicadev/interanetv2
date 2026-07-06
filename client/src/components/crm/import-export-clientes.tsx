/**
 * CRM Seguimiento — Modal de Importación / Exportación masiva de leads.
 *
 * - Plantilla: CSV vacío (solo encabezados en español) para rellenar. El admin
 *   incluye la columna "Correo del vendedor"; el vendedor no la necesita.
 * - Importar: parsea el CSV con Papa y lo envía a POST /api/crm/seguimiento/import.
 *   El admin puede elegir un "vendedor por defecto" para las filas sin correo.
 * - Exportar: descarga GET /api/crm/seguimiento/export respetando los filtros.
 */
import { useRef, useState } from "react";
import Papa from "papaparse";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Download, Upload, FileSpreadsheet, FileDown, CheckCircle2, AlertTriangle, X, Loader2,
} from "lucide-react";
import {
  buildTemplateCsv, mapRowToLead, CRM_ESTADO_LABELS,
} from "@shared/crm-import";

interface Vendedor {
  id: string;
  salespersonName: string;
  email: string;
}

interface ImportResult {
  created: number;
  updated: number;
  total: number;
  skipped: { fila: number; nombre: string; motivo: string }[];
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  isAdminOrSupervisor: boolean;
  vendedores: Vendedor[];
  exportQuery: string;
  onImported: () => void;
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function ImportExportClientes({
  open, onOpenChange, isAdminOrSupervisor, vendedores, exportQuery, onImported,
}: Props) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [fileName, setFileName] = useState<string>("");
  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [parseError, setParseError] = useState<string>("");
  const [defaultVendedor, setDefaultVendedor] = useState<string>("");
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const resetImport = () => {
    setFileName("");
    setRows([]);
    setParseError("");
    setResult(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleDownloadTemplate = () => {
    // BOM para que Excel en español reconozca UTF-8 al abrir.
    const csv = "\uFEFF" + buildTemplateCsv(isAdminOrSupervisor) + "\r\n";
    downloadBlob("plantilla-crm-seguimiento.csv", new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setResult(null);
    setParseError("");
    setFileName(file.name);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: "greedy",
      encoding: "UTF-8",
      transformHeader: (h) => h.trim(),
      complete: (res) => {
        const data = (res.data as Record<string, any>[]).filter(
          (r) => Object.values(r).some((v) => (v ?? "").toString().trim() !== "")
        );
        if (data.length === 0) {
          setParseError("El archivo no tiene filas con datos.");
          setRows([]);
          return;
        }
        setRows(data);
      },
      error: (err) => {
        setParseError(err.message || "No se pudo leer el archivo.");
        setRows([]);
      },
    });
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch(`/api/crm/seguimiento/export${exportQuery ? `?${exportQuery}` : ""}`);
      if (!res.ok) throw new Error("Error al exportar");
      const blob = await res.blob();
      const today = new Date().toISOString().slice(0, 10);
      downloadBlob(`crm-seguimiento-${today}.csv`, blob);
      toast({ title: "Exportación lista", description: "Se descargó el CSV con los leads." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "No se pudo exportar.", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async () => {
    if (rows.length === 0) return;
    setImporting(true);
    try {
      const res = await fetch("/api/crm/seguimiento/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows, defaultVendedorEmail: defaultVendedor || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Error al importar");
      setResult(data as ImportResult);
      onImported();
      toast({
        title: "Importación completada",
        description: `${data.created} creados · ${data.updated} actualizados · ${data.skipped.length} omitidos.`,
      });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "No se pudo importar.", variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  // Preview de las primeras filas mapeadas
  const preview = rows.slice(0, 5).map((r) => mapRowToLead(r));
  const sinNombre = rows.length > 0 && rows.every((r) => !mapRowToLead(r).nombre);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetImport(); onOpenChange(v); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
            Importar / Exportar clientes
          </DialogTitle>
          <DialogDescription>
            Carga o descarga leads del seguimiento en formato CSV (Excel en español).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Paso 1: Plantilla */}
          <section className="rounded-lg border bg-muted/30 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold flex items-center gap-1.5">
                  <FileDown className="w-4 h-4 text-indigo-600" /> 1. Descarga la plantilla
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Un CSV con solo los nombres de las columnas. Rellena las que necesites
                  (la única obligatoria es <span className="font-medium">Nombre</span>).
                  {isAdminOrSupervisor && (
                    <> Incluye <span className="font-medium">Correo del vendedor</span> para
                    asignar cada lead a quien corresponda.</>
                  )}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={handleDownloadTemplate} data-testid="btn-descargar-plantilla" className="shrink-0">
                <Download className="w-4 h-4 mr-1.5" /> Plantilla
              </Button>
            </div>
          </section>

          {/* Paso 2: Importar */}
          <section className="rounded-lg border p-4">
            <h3 className="text-sm font-semibold flex items-center gap-1.5 mb-2">
              <Upload className="w-4 h-4 text-emerald-600" /> 2. Importa tu archivo
            </h3>

            {!result && (
              <>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleFile}
                  className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-indigo-600 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-indigo-700 cursor-pointer"
                  data-testid="input-csv-import"
                />

                {parseError && (
                  <p className="mt-2 text-xs text-red-600 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> {parseError}
                  </p>
                )}

                {rows.length > 0 && (
                  <div className="mt-3 space-y-3">
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{rows.length}</span> fila(s) detectada(s) en{" "}
                      <span className="font-medium text-foreground">{fileName}</span>.
                    </p>

                    {sinNombre && (
                      <p className="text-xs text-amber-600 flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" /> Ninguna fila tiene la columna
                        "Nombre" con datos. Revisa el encabezado del archivo.
                      </p>
                    )}

                    {/* Preview */}
                    <div className="rounded-md border overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-muted/50 text-muted-foreground">
                          <tr>
                            <th className="px-2 py-1.5 text-left font-medium">Nombre</th>
                            <th className="px-2 py-1.5 text-left font-medium">Empresa</th>
                            <th className="px-2 py-1.5 text-left font-medium">Estado</th>
                            {isAdminOrSupervisor && (
                              <th className="px-2 py-1.5 text-left font-medium">Vendedor (correo)</th>
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {preview.map((p, i) => (
                            <tr key={i} className="border-t">
                              <td className="px-2 py-1.5">{p.nombre || <span className="text-red-500">— vacío —</span>}</td>
                              <td className="px-2 py-1.5 text-muted-foreground">{p.empresa || "—"}</td>
                              <td className="px-2 py-1.5 text-muted-foreground">
                                {p.estado ? (CRM_ESTADO_LABELS[p.estado] || p.estado) : "Prospecto"}
                              </td>
                              {isAdminOrSupervisor && (
                                <td className="px-2 py-1.5 text-muted-foreground">
                                  {p.vendedorEmail || defaultVendedor || <span className="text-amber-600">por defecto</span>}
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {rows.length > 5 && (
                        <p className="px-2 py-1.5 text-[11px] text-muted-foreground bg-muted/30 border-t">
                          … y {rows.length - 5} fila(s) más.
                        </p>
                      )}
                    </div>

                    {/* Vendedor por defecto (solo admin) */}
                    {isAdminOrSupervisor && (
                      <div className="space-y-1">
                        <Label className="text-xs">Vendedor por defecto (para filas sin "Correo del vendedor")</Label>
                        <Select value={defaultVendedor} onValueChange={setDefaultVendedor}>
                          <SelectTrigger className="h-9" data-testid="select-vendedor-default">
                            <SelectValue placeholder="Elegir vendedor…" />
                          </SelectTrigger>
                          <SelectContent>
                            {vendedores.map((v) => (
                              <SelectItem key={v.id} value={v.email}>
                                {v.salespersonName} — {v.email}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-[11px] text-muted-foreground">
                          Si una fila trae su propio correo de vendedor, ese tiene prioridad.
                        </p>
                      </div>
                    )}

                    {!isAdminOrSupervisor && (
                      <p className="text-[11px] text-muted-foreground">
                        Todos los leads importados se asignarán a ti automáticamente.
                      </p>
                    )}

                    <div className="flex items-center gap-2">
                      <Button onClick={handleImport} disabled={importing || sinNombre} className="bg-emerald-600 hover:bg-emerald-700 text-white" data-testid="btn-confirmar-import">
                        {importing ? (
                          <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Importando…</>
                        ) : (
                          <><Upload className="w-4 h-4 mr-1.5" /> Importar {rows.length} lead(s)</>
                        )}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={resetImport} disabled={importing}>
                        <X className="w-4 h-4 mr-1" /> Cancelar
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Resultado */}
            {result && (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-md bg-emerald-50 dark:bg-emerald-900/20 p-2">
                    <div className="text-lg font-bold text-emerald-600">{result.created}</div>
                    <div className="text-[11px] text-muted-foreground">Creados</div>
                  </div>
                  <div className="rounded-md bg-blue-50 dark:bg-blue-900/20 p-2">
                    <div className="text-lg font-bold text-blue-600">{result.updated}</div>
                    <div className="text-[11px] text-muted-foreground">Actualizados</div>
                  </div>
                  <div className="rounded-md bg-amber-50 dark:bg-amber-900/20 p-2">
                    <div className="text-lg font-bold text-amber-600">{result.skipped.length}</div>
                    <div className="text-[11px] text-muted-foreground">Omitidos</div>
                  </div>
                </div>

                {result.skipped.length > 0 && (
                  <div className="rounded-md border border-amber-200 dark:border-amber-800 overflow-hidden">
                    <div className="bg-amber-50 dark:bg-amber-900/20 px-3 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" /> Filas omitidas
                    </div>
                    <div className="max-h-40 overflow-y-auto divide-y text-xs">
                      {result.skipped.map((s, i) => (
                        <div key={i} className="px-3 py-1.5 flex items-start gap-2">
                          <span className="font-medium text-muted-foreground shrink-0">Fila {s.fila}</span>
                          <span className="text-muted-foreground">{s.nombre ? `"${s.nombre}" — ` : ""}{s.motivo}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <p className="text-xs text-emerald-600 flex items-center gap-1 flex-1">
                    <CheckCircle2 className="w-4 h-4" /> Importación finalizada.
                  </p>
                  <Button variant="outline" size="sm" onClick={resetImport} data-testid="btn-import-otro">
                    Importar otro archivo
                  </Button>
                </div>
              </div>
            )}
          </section>

          {/* Paso 3: Exportar */}
          <section className="rounded-lg border p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold flex items-center gap-1.5">
                  <Download className="w-4 h-4 text-purple-600" /> Exportar leads
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Descarga en CSV los leads según los filtros de vendedor, estado,
                  prioridad y búsqueda.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting} className="shrink-0" data-testid="btn-exportar">
                {exporting ? (
                  <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Exportando…</>
                ) : (
                  <><Download className="w-4 h-4 mr-1.5" /> Exportar CSV</>
                )}
              </Button>
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
