import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Upload, Download, Search, Plus, Edit, Trash2, FileText, AlertCircle, Loader2, Calculator, Percent, TrendingUp, TrendingDown, Check } from "lucide-react";

// Response includes JOINed fields from price_list
interface MixItem {
  id: string;
  codigo: string;
  precio: string | null;
  producto: string | null; // from price_list JOIN
  unidad: string | null;   // from price_list JOIN
  costoProduccion: string | null; // from price_list JOIN
  created_at: string;
  updated_at: string;
}

interface MixResponse {
  items: MixItem[];
  totalCount: number;
  hasMore: boolean;
}

export default function ListaPreciosMix({ listCode = 'LP02', listName = 'Mix', vendorView = false }: { listCode?: string; listName?: string; vendorView?: boolean }) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<any>(null);
  const [editItem, setEditItem] = useState<MixItem | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newProduct, setNewProduct] = useState({ codigo: "", precio: "" });
  const [simulatorPrices, setSimulatorPrices] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const [isBulkAdjustOpen, setIsBulkAdjustOpen] = useState(false);
  const [bulkAdjustDirection, setBulkAdjustDirection] = useState<'up'|'down'>('up');
  const [bulkAdjustPercentage, setBulkAdjustPercentage] = useState("");
  const [bulkAdjustRoundToDecena, setBulkAdjustRoundToDecena] = useState(true);
  const [bulkAdjustConfirm, setBulkAdjustConfirm] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const itemsPerPage = 50;

  const { data, isLoading, error } = useQuery<MixResponse>({
    queryKey: [`/api/custom-price-lists/${listCode}/items`, search, page],
    queryFn: () =>
      apiRequest("GET", `/api/custom-price-lists/${listCode}/items?search=${encodeURIComponent(search)}&limit=${itemsPerPage}&offset=${page * itemsPerPage}`)
        .then(r => r.json()),
  });

  // GRI prices for real cost (same source as Lista Comercial)
  const { data: griPrices } = useQuery<Record<string, { price: number; date: string | null }>>({
    queryKey: ['/api/inventory/gri-prices'],
    queryFn: async () => {
      const response = await fetch('/api/inventory/gri-prices', { credentials: 'include' });
      if (!response.ok) return {};
      return response.json();
    },
    staleTime: 10 * 60 * 1000,
    enabled: !vendorView,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/custom-price-lists/${listCode}/items/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/custom-price-lists/${listCode}/items`] });
      toast({ title: "Eliminado", description: "Producto eliminado correctamente" });
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/custom-price-lists/${listCode}/items`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/custom-price-lists/${listCode}/items`] });
      setIsAddOpen(false);
      setNewProduct({ codigo: "", precio: "" });
      toast({ title: "Creado", description: "SKU agregado correctamente" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: any) => apiRequest("PATCH", `/api/custom-price-lists/${listCode}/items/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/custom-price-lists/${listCode}/items`] });
      setIsEditOpen(false);
      setEditItem(null);
      toast({ title: "Actualizado", description: "Precio actualizado correctamente" });
    },
  });

  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/custom-price-lists/${listCode}/items/import`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (data) => {
      setImportResult(data);
      queryClient.invalidateQueries({ queryKey: [`/api/custom-price-lists/${listCode}/items`] });
      toast({ title: "Importado", description: `${data.importedCount} SKUs importados` });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const bulkAdjustMutation = useMutation({
    mutationFn: async (percentage: number) => {
      const res = await fetch(`/api/custom-price-lists/${listCode}/items/bulk-adjust`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          percentage,
          roundToDecena: bulkAdjustRoundToDecena 
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/custom-price-lists/${listCode}/items`] });
      toast({ title: "Ajuste Masivo", description: "Precios actualizados correctamente" });
      setIsBulkAdjustOpen(false);
      setBulkAdjustConfirm(false);
      setBulkAdjustPercentage("");
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Error al aplicar ajuste", variant: "destructive" });
    }
  });

  const handleBulkAdjust = () => {
    const pctStr = bulkAdjustPercentage.replace(',', '.');
    let pct = pctStr ? parseFloat(pctStr) : 0;
    if (isNaN(pct) || (pct === 0 && !bulkAdjustRoundToDecena) || pct > 100) return;
    if (bulkAdjustDirection === 'down') pct = -pct;

    bulkAdjustMutation.mutate(pct);
  };

  const formatCurrency = (val: string | number | null) => {
    if (!val) return "-";
    const num = typeof val === "string" ? parseFloat(val) : val;
    if (isNaN(num)) return "-";
    return `$${Math.round(num).toLocaleString("es-CL")}`;
  };

  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      const url = `/api/custom-price-lists/${listCode}/items/export/excel${params.toString() ? '?' + params.toString() : ''}`;
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) throw new Error('Export failed');
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `lista_${listCode}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);
      toast({ title: "Exportación exitosa", description: "El archivo Excel se descargó correctamente" });
    } catch (err) {
      toast({ variant: "destructive", title: "Error", description: `No se pudo exportar la lista ${listName}` });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-2">
          {!vendorView && (<>
          <Button
            onClick={() => setIsAddOpen(true)}
            size="sm"
            className="flex items-center gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 shadow-sm"
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Agregar SKU</span>
          </Button>
          <Button
            onClick={() => setIsBulkAdjustOpen(true)}
            variant="outline"
            size="sm"
            className="flex items-center gap-1.5 text-xs text-amber-600 border-amber-200 hover:bg-amber-50 shadow-sm"
          >
            <Percent className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Ajuste Masivo</span>
          </Button>
          </>)}
          <Button
            variant="outline" 
            size="sm" 
            className="flex items-center gap-1.5 text-xs" 
            onClick={handleExportExcel}
            disabled={isExporting}
            data-testid="button-export-excel"
          >
            {isExporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">Exportar</span>
          </Button>
          {!vendorView && (
          <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="flex items-center gap-1.5 text-xs">
                <Upload className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Importar CSV</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Importar Lista Mix</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Input
                    type="file"
                    accept=".csv"
                    ref={fileInputRef}
                    onChange={(e) => {
                      setImportFile(e.target.files?.[0] || null);
                      setImportResult(null);
                    }}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    CSV con columnas: <strong>codigo</strong> y <strong>precio</strong> (el resto se obtiene de la lista comercial)
                  </p>
                </div>
                {importFile && (
                  <div className="p-3 bg-muted rounded-lg flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    <span className="text-sm">{importFile.name}</span>
                    <Badge variant="secondary">{(importFile.size / 1024).toFixed(1)} KB</Badge>
                  </div>
                )}
                {importResult && (
                  <div className="p-3 bg-green-50 rounded-lg text-sm">
                    ✅ {importResult.importedCount} SKUs importados
                  </div>
                )}
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsImportOpen(false)}>Cancelar</Button>
                  <Button
                    onClick={() => importFile && importMutation.mutate(importFile)}
                    disabled={!importFile || importMutation.isPending}
                  >
                    {importMutation.isPending ? "Importando..." : "Importar"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          )}
        </div>

        {/* Search */}
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Buscar código o producto..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              className="pl-8 h-8 text-xs"
            />
          </div>
          {data && (
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {data.totalCount} items
            </span>
          )}
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
              <p className="text-muted-foreground">Cargando lista mix...</p>
            </div>
          ) : error ? (
            <div className="text-center py-8 text-destructive">
              <AlertCircle className="h-8 w-8 mx-auto mb-2" />
              <p>Error al cargar la lista</p>
            </div>
          ) : !data?.items?.length ? (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-lg font-medium mb-2">Sin productos</p>
              <p className="text-sm">Importa un CSV con columnas <strong>codigo</strong> y <strong>precio</strong></p>
            </div>
          ) : (
            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow className="text-xs">
                    <TableHead className="text-xs">Código</TableHead>
                    <TableHead className="text-xs">Producto</TableHead>
                    <TableHead className="text-xs">Formato</TableHead>
                    <TableHead className="text-right text-xs font-semibold text-blue-600 dark:text-blue-400">Precio {listName}</TableHead>
                    {!vendorView && (<>
                    <TableHead className="text-right text-xs text-amber-700 dark:text-amber-400">Costo</TableHead>
                    <TableHead className="text-right text-xs">Margen</TableHead>
                    <TableHead className="text-right text-xs text-blue-600 dark:text-blue-400">
                      <span className="flex items-center justify-end gap-1"><Calculator className="h-3 w-3" />Simulador</span>
                    </TableHead>
                    <TableHead className="w-16 text-xs">Acc.</TableHead>
                    </>)}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((item) => {
                    // Cost from GRI (primary) or price_list JOIN (fallback)
                    const griEntry = item.codigo ? griPrices?.[item.codigo.toUpperCase()] : null;
                    const costoNum = griEntry?.price || (item.costoProduccion ? parseFloat(item.costoProduccion) : null);
                    const costoDate = griEntry?.date ?? null;
                    const precioNum = item.precio ? parseFloat(item.precio) : null;
                    let margen: number | null = null;
                    if (precioNum && costoNum && precioNum > 0) {
                      margen = ((precioNum - costoNum) / precioNum) * 100;
                    }
                    const simVal = simulatorPrices[item.id];
                    const simNum = simVal ? parseFloat(simVal) : null;
                    let simMargen: number | null = null;
                    if (simNum && costoNum && simNum > 0) {
                      simMargen = ((simNum - costoNum) / simNum) * 100;
                    }

                    return (
                      <TableRow key={item.id} className="text-xs">
                        <TableCell className="font-mono text-xs py-2">{item.codigo}</TableCell>
                        <TableCell className="text-xs py-2 max-w-[250px] truncate">
                          {item.producto || <span className="text-muted-foreground italic">SKU no encontrado</span>}
                        </TableCell>
                        <TableCell className="text-xs py-2">{item.unidad || "-"}</TableCell>
                        <TableCell className="text-right text-xs py-2 font-semibold text-blue-600 dark:text-blue-400">
                          {formatCurrency(item.precio)}
                        </TableCell>
                        {!vendorView && (<>
                        <TableCell className="text-right text-xs py-2 font-semibold text-amber-700 dark:text-amber-400">
                          {costoNum ? (
                            <div>
                              {formatCurrency(costoNum)}
                              {costoDate && (
                                <span className="block text-[9px] leading-tight mt-0.5 font-normal text-muted-foreground/60">
                                  {new Date(costoDate + 'T00:00:00').toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: '2-digit' })}
                                </span>
                              )}
                            </div>
                          ) : "-"}
                        </TableCell>
                        <TableCell className="text-right text-xs py-2 font-semibold">
                          {margen !== null ? (
                            <span className={margen >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                              {margen.toFixed(1)}%
                            </span>
                          ) : "-"}
                        </TableCell>
                        <TableCell className="py-2">
                          <div className="flex flex-col items-end">
                            <Input
                              type="number"
                              placeholder="$"
                              value={simulatorPrices[item.id] || ""}
                              onChange={(e) => setSimulatorPrices(prev => ({ ...prev, [item.id]: e.target.value }))}
                              className="h-6 w-20 text-[11px] text-right px-1.5 border-blue-200 focus:border-blue-400"
                            />
                            {simMargen !== null && (
                              <span className={`text-[10px] font-semibold mt-0.5 ${
                                simMargen >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"
                              }`}>
                                {simMargen >= 0 ? "+" : ""}{simMargen.toFixed(1)}%
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="py-2">
                          <div className="flex gap-0.5">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => { setEditItem(item); setIsEditOpen(true); }}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                              onClick={() => deleteMutation.mutate(item.id)}
                              disabled={deleteMutation.isPending}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                        </>)}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {/* Pagination */}
              {data.totalCount > itemsPerPage && (
                <div className="flex items-center justify-between px-4 pb-4">
                  <span className="text-xs text-muted-foreground">
                    {page * itemsPerPage + 1}-{Math.min((page + 1) * itemsPerPage, data.totalCount)} de {data.totalCount}
                  </span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="text-xs" onClick={() => setPage(p => p - 1)} disabled={page === 0}>
                      Anterior
                    </Button>
                    <Button variant="outline" size="sm" className="text-xs" onClick={() => setPage(p => p + 1)} disabled={!data.hasMore}>
                      Siguiente
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog - only precio is editable */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Precio {listName}</DialogTitle>
          </DialogHeader>
          {editItem && (
            <div className="space-y-3">
              <div className="p-3 bg-muted rounded-lg text-sm">
                <p><strong>SKU:</strong> {editItem.codigo}</p>
                <p><strong>Producto:</strong> {editItem.producto || "N/A"}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Precio {listName}</label>
                <Input type="number" value={editItem.precio || ""} onChange={(e) => setEditItem({ ...editItem, precio: e.target.value })} className="h-8 text-sm" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => editItem && updateMutation.mutate({ id: editItem.id, precio: editItem.precio })}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Dialog - only codigo + precio */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agregar SKU a {listName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Ingresa el código (SKU) del producto y el precio. El producto debe existir en la lista comercial.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Código (SKU) *</label>
                <Input value={newProduct.codigo} onChange={(e) => setNewProduct({ ...newProduct, codigo: e.target.value })} className="h-8 text-sm" placeholder="Ej: PAE500BL14" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Precio {listName} *</label>
                <Input type="number" value={newProduct.precio} onChange={(e) => setNewProduct({ ...newProduct, precio: e.target.value })} className="h-8 text-sm" placeholder="Ej: 12500" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => createMutation.mutate(newProduct)}
              disabled={!newProduct.codigo || !newProduct.precio || createMutation.isPending}
            >
              {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Agregar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Ajuste Masivo de Precios */}
      <Dialog open={isBulkAdjustOpen} onOpenChange={(open) => { setIsBulkAdjustOpen(open); if (!open) setBulkAdjustConfirm(false); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Percent className="h-5 w-5 text-amber-600" />
              Ajuste Masivo de Precios ({listName})
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-5 py-2">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setBulkAdjustDirection('up')}
                className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                  bulkAdjustDirection === 'up'
                    ? 'bg-emerald-100 text-emerald-800 border-2 border-emerald-400 shadow-sm'
                    : 'bg-gray-50 text-gray-500 border-2 border-gray-200 hover:bg-gray-100'
                }`}
              >
                <TrendingUp className="h-4 w-4" />
                Aumentar
              </button>
              <button
                onClick={() => setBulkAdjustDirection('down')}
                className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                  bulkAdjustDirection === 'down'
                    ? 'bg-red-100 text-red-800 border-2 border-red-400 shadow-sm'
                    : 'bg-gray-50 text-gray-500 border-2 border-gray-200 hover:bg-gray-100'
                }`}
              >
                <TrendingDown className="h-4 w-4" />
                Disminuir
              </button>
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Porcentaje de ajuste</label>
              <div className="relative">
                <Input
                  type="number"
                  placeholder="Ej: 5"
                  min="0.1"
                  max="100"
                  step="0.1"
                  value={bulkAdjustPercentage}
                  onChange={(e) => { setBulkAdjustPercentage(e.target.value); setBulkAdjustConfirm(false); }}
                  className="pr-10 text-lg font-bold h-12"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-lg font-bold text-gray-400">%</span>
              </div>
              {bulkAdjustPercentage && parseFloat(bulkAdjustPercentage) > 0 && (
                <p className={`text-xs mt-1.5 font-medium ${bulkAdjustDirection === 'up' ? 'text-emerald-600' : 'text-red-600'}`}>
                  {bulkAdjustDirection === 'up' ? '↑' : '↓'} Todos los precios mix se {bulkAdjustDirection === 'up' ? 'multiplicarán' : 'reducirán'} por {(1 + (bulkAdjustDirection === 'up' ? 1 : -1) * parseFloat(bulkAdjustPercentage) / 100).toFixed(4)}x
                </p>
              )}
            </div>
            
            <p className="text-xs text-muted-foreground flex items-center gap-2 bg-slate-50 p-3 rounded-lg border border-slate-100">
              <AlertCircle className="h-4 w-4 text-blue-500 shrink-0" />
              Este ajuste se aplicará a todos los productos actualmente registrados en la Lista de Precios Mix.
            </p>
          </div>

          <DialogFooter className="flex flex-col gap-2 sm:flex-col mt-4">
            {!bulkAdjustConfirm ? (
              <Button
                onClick={() => setBulkAdjustConfirm(true)}
                disabled={(!bulkAdjustPercentage || parseFloat(bulkAdjustPercentage) <= 0) && !bulkAdjustRoundToDecena}
                className={`w-full h-11 text-sm font-bold ${
                  bulkAdjustDirection === 'up'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {bulkAdjustDirection === 'up' ? <TrendingUp className="h-4 w-4 mr-2" /> : <TrendingDown className="h-4 w-4 mr-2" />}
                {bulkAdjustPercentage ? `${bulkAdjustDirection === 'up' ? 'Aumentar' : 'Disminuir'} ${bulkAdjustPercentage}%` : 'Redondear Precios'} — Vista previa
              </Button>
            ) : (
              <div className="space-y-2 w-full">
                <div className={`p-3 rounded-xl text-sm font-medium ${
                  bulkAdjustDirection === 'up' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
                }`}>
                  <p className="font-bold mb-1">⚠️ Confirmar ajuste masivo</p>
                  <p>
                    {bulkAdjustPercentage && parseFloat(bulkAdjustPercentage) > 0 ? (
                      <>Se {bulkAdjustDirection === 'up' ? 'aumentarán' : 'disminuirán'} <strong>{bulkAdjustPercentage}%</strong> todos los precios de la lista mix.</>
                    ) : (
                      <>Se redondearán a la decena todos los precios de la lista mix.</>
                    )}
                  </p>
                  <p className="mt-1 text-xs opacity-70">Esta acción no se puede deshacer.</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setBulkAdjustConfirm(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleBulkAdjust}
                    disabled={bulkAdjustMutation.isPending}
                    className={`flex-1 font-bold ${
                      bulkAdjustDirection === 'up'
                        ? 'bg-emerald-600 hover:bg-emerald-700'
                        : 'bg-red-600 hover:bg-red-700'
                    }`}
                  >
                    {bulkAdjustMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
                    Sí, aplicar ajuste
                  </Button>
                </div>
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
