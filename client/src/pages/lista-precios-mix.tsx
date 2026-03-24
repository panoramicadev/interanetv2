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
import { Upload, Search, Plus, Edit, Trash2, FileText, AlertCircle, Loader2, Calculator } from "lucide-react";

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

export default function ListaPreciosMix() {
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

  const itemsPerPage = 50;

  const { data, isLoading, error } = useQuery<MixResponse>({
    queryKey: ["/api/price-list-mix", search, page],
    queryFn: () =>
      apiRequest("GET", `/api/price-list-mix?search=${encodeURIComponent(search)}&limit=${itemsPerPage}&offset=${page * itemsPerPage}`)
        .then(r => r.json()),
  });

  // GRI prices for real cost (same source as Lista Comercial)
  const { data: griPrices } = useQuery<Record<string, number>>({
    queryKey: ['/api/inventory/gri-prices'],
    queryFn: async () => {
      const response = await fetch('/api/inventory/gri-prices', { credentials: 'include' });
      if (!response.ok) return {};
      return response.json();
    },
    staleTime: 10 * 60 * 1000,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/price-list-mix/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/price-list-mix"] });
      toast({ title: "Eliminado", description: "Producto eliminado correctamente" });
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/price-list-mix", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/price-list-mix"] });
      setIsAddOpen(false);
      setNewProduct({ codigo: "", precio: "" });
      toast({ title: "Creado", description: "SKU agregado correctamente" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: any) => apiRequest("PATCH", `/api/price-list-mix/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/price-list-mix"] });
      setIsEditOpen(false);
      setEditItem(null);
      toast({ title: "Actualizado", description: "Precio actualizado correctamente" });
    },
  });

  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/price-list-mix/import", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (data) => {
      setImportResult(data);
      queryClient.invalidateQueries({ queryKey: ["/api/price-list-mix"] });
      toast({ title: "Importado", description: `${data.importedCount} SKUs importados` });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const formatCurrency = (val: string | number | null) => {
    if (!val) return "-";
    const num = typeof val === "string" ? parseFloat(val) : val;
    if (isNaN(num)) return "-";
    return `$${Math.round(num).toLocaleString("es-CL")}`;
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-2">
          <Button
            onClick={() => setIsAddOpen(true)}
            size="sm"
            className="flex items-center gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 shadow-sm"
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Agregar SKU</span>
          </Button>
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
                    <TableHead className="text-right text-xs font-semibold text-blue-600 dark:text-blue-400">Precio Mix</TableHead>
                    <TableHead className="text-right text-xs text-amber-700 dark:text-amber-400">Costo</TableHead>
                    <TableHead className="text-right text-xs">Margen</TableHead>
                    <TableHead className="text-right text-xs text-blue-600 dark:text-blue-400">
                      <span className="flex items-center justify-end gap-1"><Calculator className="h-3 w-3" />Simulador</span>
                    </TableHead>
                    <TableHead className="w-16 text-xs">Acc.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((item) => {
                    // Cost from GRI (primary) or price_list JOIN (fallback)
                    const griCosto = item.codigo ? griPrices?.[item.codigo.toUpperCase()] : null;
                    const costoNum = griCosto || (item.costoProduccion ? parseFloat(item.costoProduccion) : null);
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
                        <TableCell className="text-right text-xs py-2 font-semibold text-amber-700 dark:text-amber-400">
                          {costoNum ? formatCurrency(costoNum) : "-"}
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
            <DialogTitle>Editar Precio Mix</DialogTitle>
          </DialogHeader>
          {editItem && (
            <div className="space-y-3">
              <div className="p-3 bg-muted rounded-lg text-sm">
                <p><strong>SKU:</strong> {editItem.codigo}</p>
                <p><strong>Producto:</strong> {editItem.producto || "N/A"}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Precio Mix</label>
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
            <DialogTitle>Agregar SKU a Lista Mix</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Ingresa el código (SKU) del producto y el precio mix. El producto debe existir en la lista comercial.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Código (SKU) *</label>
                <Input value={newProduct.codigo} onChange={(e) => setNewProduct({ ...newProduct, codigo: e.target.value })} className="h-8 text-sm" placeholder="Ej: PAE500BL14" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Precio Mix *</label>
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
    </div>
  );
}
