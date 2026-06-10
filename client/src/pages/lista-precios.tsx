import { useState, useRef } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { DollarSign, Upload, Download, Search, Plus, Edit, Trash2, FileText, AlertCircle, Loader2, Calculator, List, TrendingUp, TrendingDown, Percent, Check, Tag, Package } from "lucide-react";
import { PriceList } from "@shared/schema";
import ListaPreciosMix from "./lista-precios-mix";
import ListaPreciosOfertas from "./lista-precios-ofertas";

interface PriceListResponse {
  items: PriceList[];
  totalCount: number;
  hasMore: boolean;
}

// vendorView: vista de solo lectura para vendedores — sin costos, márgenes, simulador ni acciones de edición
export default function ListaPrecios({ vendorView = false }: { vendorView?: boolean }) {
  const [search, setSearch] = useState("");
  const [selectedUnidad, setSelectedUnidad] = useState<string>("");
  const [selectedColor, setSelectedColor] = useState<string>("");
  const [page, setPage] = useState(0);

  // Custom price lists state
  const [isNewListOpen, setIsNewListOpen] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<any>(null);
  const [editItem, setEditItem] = useState<PriceList | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  // Venta por pallet — state local del dialog Editar Producto.
  // Vive separado del editItem porque guarda en ecommerce_products, no en price_list.
  const [palletEnabled, setPalletEnabled] = useState(false);
  const [palletUnitsInput, setPalletUnitsInput] = useState("");
  const [palletDiscountInput, setPalletDiscountInput] = useState("");

  const [isBulkAdjustOpen, setIsBulkAdjustOpen] = useState(false);
  const [bulkAdjustPercentage, setBulkAdjustPercentage] = useState("");
  const [bulkAdjustDirection, setBulkAdjustDirection] = useState<'up' | 'down'>('up');
  const [bulkAdjustFields, setBulkAdjustFields] = useState<string[]>(['lista', 'desc10', 'desc10_5', 'desc10_5_3', 'minimo', 'canalDigital']);
  const [bulkAdjustUnit, setBulkAdjustUnit] = useState("");
  const [bulkAdjustConfirm, setBulkAdjustConfirm] = useState(false);
  const [bulkAdjustRoundToDecena, setBulkAdjustRoundToDecena] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [newProduct, setNewProduct] = useState({
    codigo: "",
    producto: "",
    unidad: "",
    color: "",
    lista: "",
    desc10: "",
    desc10_5: "",
    minimo: "",
    costoProduccion: "",
    cantidadProducto: "",
    unidadMedida: "",
    rendimiento: "",
  });
  const [simulatorPrices, setSimulatorPrices] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const itemsPerPage = 50;


  // Fetch custom price lists for dynamic tabs
  const { data: customPriceLists = [] } = useQuery<{ code: string; name: string; active: boolean; item_count: string }[]>({
    queryKey: ["/api/custom-price-lists"],
    queryFn: async () => {
      try {
        const res = await apiRequest("GET", "/api/custom-price-lists");
        return await res.json();
      } catch {
        return [];
      }
    },
  });

  // Query para obtener unidades disponibles para filtros
  const { data: availableUnits = [] } = useQuery({
    queryKey: ["/api/price-list/units"],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/price-list/units');
      return response.json() as string[];
    },
  });

  // Query para obtener colores disponibles para filtros
  const { data: availableColors = [] } = useQuery({
    queryKey: ["/api/price-list/colors"],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/price-list/colors');
      return response.json() as string[];
    },
  });

  // Query para obtener lista de precios
  const { data, isLoading, error } = useQuery<PriceListResponse>({
    queryKey: ['/api/price-list', { search, unidad: selectedUnidad, color: selectedColor, limit: itemsPerPage, offset: page * itemsPerPage }],
    queryFn: async () => {
      const params = new URLSearchParams({ search, limit: itemsPerPage.toString(), offset: (page * itemsPerPage).toString() });
      if (selectedUnidad) {
        params.append('unidad', selectedUnidad);
      }
      if (selectedColor) {
        params.append('color', selectedColor);
      }
      const response = await apiRequest('GET', `/api/price-list?${params}`);
      return response.json();
    },
  });

  // Lista Mix (LP02): mapa codigo→precio para mostrar como columna extra en la vista de vendedor
  const { data: mixPricesByCode } = useQuery<Record<string, number>>({
    queryKey: ['/api/custom-price-lists/LP02/items', 'all-for-comercial'],
    queryFn: async () => {
      const response = await fetch('/api/custom-price-lists/LP02/items?limit=5000&offset=0', { credentials: 'include' });
      if (!response.ok) return {};
      const json = await response.json();
      const map: Record<string, number> = {};
      for (const it of (json.items || [])) {
        if (it.codigo && it.precio != null) {
          const n = typeof it.precio === 'string' ? parseFloat(it.precio) : it.precio;
          if (!isNaN(n)) map[it.codigo.toUpperCase()] = n;
        }
      }
      return map;
    },
    staleTime: 5 * 60 * 1000,
    enabled: vendorView,
  });

  // Query para obtener precios GRI (costo producción desde SQL Server)
  const { data: griPrices } = useQuery<Record<string, { price: number; date: string | null }>>({
    queryKey: ['/api/inventory/gri-prices'],
    queryFn: async () => {
      const response = await fetch('/api/inventory/gri-prices', { credentials: 'include' });
      if (!response.ok) return {};
      return response.json();
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
    enabled: !vendorView,
  });

  // Mutación para importar CSV
  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/price-list/import', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw error;
      }
      
      return response.json();
    },
    onSuccess: (result) => {
      toast({
        title: "Importación exitosa",
        description: `Se importaron ${result.importedCount} elementos correctamente.`,
      });
      setImportResult(result);
      queryClient.invalidateQueries({ queryKey: ['/api/price-list'] });
      setImportFile(null);
      setIsImportDialogOpen(false);
    },
    onError: (error: any) => {
      console.error('Error importing:', error);
      toast({
        variant: "destructive",
        title: "Error en la importación",
        description: error.message || "Hubo un error al importar el archivo.",
      });
      setImportResult(error);
    },
  });

  // Mutación para eliminar item
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest('DELETE', `/api/price-list/${id}`),
    onSuccess: () => {
      toast({
        title: "Elemento eliminado",
        description: "El elemento se eliminó correctamente.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/price-list'] });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo eliminar el elemento.",
      });
    },
  });

  // Mutación para actualizar item
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<PriceList> }) => {
      return apiRequest('PATCH', `/api/price-list/${id}`, data);
    },
    onSuccess: () => {
      toast({
        title: "Elemento actualizado",
        description: "El producto se actualizó correctamente.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/price-list'] });
      setIsEditDialogOpen(false);
      setEditItem(null);
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo actualizar el elemento.",
      });
    },
  });

  // Mutación para crear nuevo producto
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('POST', `/api/price-list`, data);
    },
    onSuccess: () => {
      toast({
        title: "Producto creado",
        description: "El producto se agregó correctamente a la lista de precios.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/price-list'] });
      setIsAddDialogOpen(false);
      setNewProduct({
        codigo: "",
        producto: "",
        unidad: "",
        color: "",
        lista: "",
        desc10: "",
        desc10_5: "",
        minimo: "",
        costoProduccion: "",
        cantidadProducto: "",
        unidadMedida: "",
        rendimiento: "",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo crear el producto.",
      });
    },
  });

  // Mutación para ajuste masivo de precios
  const bulkAdjustMutation = useMutation({
    mutationFn: async (params: { percentage: number; fields: string[]; unidad?: string; roundToDecena?: boolean }) => {
      return apiRequest('POST', '/api/price-list/bulk-adjust', params);
    },
    onSuccess: async (response) => {
      const result = await response.json();
      toast({
        title: "Precios ajustados",
        description: `Se ajustaron ${result.affectedRows} productos (${result.percentage > 0 ? '+' : ''}${result.percentage}%)`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/price-list'] });
      setIsBulkAdjustOpen(false);
      setBulkAdjustPercentage("");
      setBulkAdjustConfirm(false);
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "No se pudieron ajustar los precios",
      });
      setBulkAdjustConfirm(false);
    },
  });

  const handleBulkAdjust = () => {
    const pctStr = bulkAdjustPercentage.replace(',', '.');
    const pct = pctStr ? parseFloat(pctStr) : 0;
    if (isNaN(pct) || (pct === 0 && !bulkAdjustRoundToDecena) || pct > 100) return;
    const finalPct = bulkAdjustDirection === 'up' ? pct : -pct;
    bulkAdjustMutation.mutate({
      percentage: finalPct,
      fields: bulkAdjustFields,
      unidad: bulkAdjustUnit || undefined,
      roundToDecena: bulkAdjustRoundToDecena,
    });
  };

  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (selectedUnidad) params.append('unidad', selectedUnidad);
      if (selectedColor) params.append('color', selectedColor);
      const url = `/api/price-list/export/excel${params.toString() ? '?' + params.toString() : ''}`;
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) throw new Error('Export failed');
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `lista_precios_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);
      toast({ title: "Exportación exitosa", description: "El archivo Excel se descargó correctamente" });
    } catch (err) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo exportar la lista de precios" });
    } finally {
      setIsExporting(false);
    }
  };

  const handleCreateProduct = () => {
    const lista = newProduct.lista ? parseFloat(newProduct.lista) : null;
    const rendimiento = newProduct.rendimiento ? parseFloat(newProduct.rendimiento) : null;
    const costoUnidadMedida = lista && rendimiento ? Math.round(lista / rendimiento) : null;
    
    const data: any = {
      codigo: newProduct.codigo || null,
      producto: newProduct.producto,
      unidad: newProduct.unidad || null,
      color: newProduct.color || null,
      lista,
      desc10: newProduct.desc10 ? parseFloat(newProduct.desc10) : null,
      desc10_5: newProduct.desc10_5 ? parseFloat(newProduct.desc10_5) : null,
      minimo: newProduct.minimo ? parseFloat(newProduct.minimo) : null,
      costoProduccion: newProduct.costoProduccion ? parseFloat(newProduct.costoProduccion) : null,
      cantidadProducto: newProduct.cantidadProducto ? parseFloat(newProduct.cantidadProducto) : null,
      unidadMedida: newProduct.unidadMedida || null,
      rendimiento,
      costoUnidadMedida,
    };
    createMutation.mutate(data);
  };

  const handleEdit = (item: PriceList) => {
    setEditItem({ ...item });
    // Pallet config — pre-llena del item enriquecido (LEFT JOIN ecommerce_products)
    const anyItem = item as any;
    setPalletEnabled(!!anyItem.palletEnabled);
    setPalletUnitsInput(
      anyItem.packagingAmountPerPallet !== null && anyItem.packagingAmountPerPallet !== undefined
        ? String(anyItem.packagingAmountPerPallet)
        : ""
    );
    setPalletDiscountInput(
      anyItem.palletDiscountPct !== null && anyItem.palletDiscountPct !== undefined
        ? String(anyItem.palletDiscountPct)
        : ""
    );
    setIsEditDialogOpen(true);
  };

  // Mutación pallet — guarda en ecommerce_products (no en price_list)
  // Usa el endpoint existente PATCH /api/ecommerce/admin/productos/:id
  // (el :id es el priceListId, que coincide con editItem.id).
  const palletMutation = useMutation({
    mutationFn: async (payload: {
      id: string;
      palletEnabled: boolean;
      packagingAmountPerPallet: number | null;
      palletDiscountPct: number | null;
    }) => {
      const { id, ...rest } = payload;
      return apiRequest(`/api/ecommerce/admin/productos/${id}`, {
        method: "PATCH",
        data: rest,
      });
    },
    onSuccess: () => {
      // Refresh price-list (que incluye los campos pallet via LEFT JOIN)
      queryClient.invalidateQueries({ queryKey: ['/api/price-list'] });
    },
    onError: (err: any) => {
      toast({
        variant: "destructive",
        title: "Error al guardar venta por pallet",
        description: err?.message || "No se pudo guardar la configuración de pallet",
      });
    },
  });

  const handleSaveEdit = () => {
    if (!editItem) return;
    const lista = editItem.lista;
    const rendimiento = (editItem as any).rendimiento;
    const costoUnidadMedida = lista && rendimiento ? Math.round(lista / rendimiento) : null;

    // Validación local pallet antes de disparar nada
    const units = palletUnitsInput.trim() === "" ? null : parseInt(palletUnitsInput, 10);
    const discount = palletDiscountInput.trim() === "" ? null : parseFloat(palletDiscountInput);

    if (palletEnabled && (units === null || isNaN(units) || units < 1)) {
      toast({
        variant: "destructive",
        title: "Faltan unidades por pallet",
        description: "Para habilitar la venta por pallet, indica cuántas unidades trae el pallet (ej: 144 galones).",
      });
      return;
    }
    if (units !== null && (isNaN(units) || units < 1)) {
      toast({
        variant: "destructive",
        title: "Unidades inválidas",
        description: "Las unidades por pallet deben ser un entero ≥ 1.",
      });
      return;
    }
    if (discount !== null && (isNaN(discount) || discount < 0 || discount > 100)) {
      toast({
        variant: "destructive",
        title: "Descuento inválido",
        description: "El descuento por pallet debe estar entre 0 y 100.",
      });
      return;
    }

    // 1) Guardar campos del PriceList (precios, costo, etc.)
    updateMutation.mutate({
      id: editItem.id,
      data: {
        codigo: editItem.codigo,
        producto: editItem.producto,
        unidad: editItem.unidad,
        color: editItem.color,
        lista: editItem.lista,
        desc10: editItem.desc10,
        desc10_5: editItem.desc10_5,
        minimo: editItem.minimo,
        costoProduccion: (editItem as any).costoProduccion,
        cantidadProducto: (editItem as any).cantidadProducto,
        unidadMedida: (editItem as any).unidadMedida,
        rendimiento: (editItem as any).rendimiento,
        costoUnidadMedida,
      }
    });

    // 2) Guardar pallet config (ecommerce_products) en paralelo
    palletMutation.mutate({
      id: editItem.id,
      palletEnabled,
      packagingAmountPerPallet: units,
      palletDiscountPct: discount,
    });
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
        toast({
          variant: "destructive",
          title: "Archivo inválido",
          description: "Por favor selecciona un archivo CSV.",
        });
        return;
      }
      setImportFile(file);
      setImportResult(null);
    }
  };

  const handleImport = () => {
    if (importFile) {
      importMutation.mutate(importFile);
    }
  };

  const formatCurrency = (value: number | string | null) => {
    if (value === null || value === undefined) return '-';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return isNaN(num) ? '-' : `$${num.toLocaleString('es-CL', { maximumFractionDigits: 0 })}`;
  };

  const formatNumber = (value: number | string | null | undefined): string => {
    if (value === null || value === undefined || value === '') return '';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return '';
    return Number.isInteger(num) ? num.toString() : num.toString();
  };

  return (
    <div className="space-y-4">
      <Tabs defaultValue="comercial" className="w-full">
        <div className="flex items-center gap-2">
        <TabsList className={`h-9 bg-muted/50 p-0.5 rounded-lg flex-1 ${vendorView ? 'hidden' : ''}`}>
          <TabsTrigger value="comercial" className="text-xs gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md px-3 py-1.5">
            <List className="h-3.5 w-3.5" />
            Lista Comercial
          </TabsTrigger>
          {customPriceLists.map(list => (
            <TabsTrigger key={list.code} value={list.code} className="text-xs gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md px-3 py-1.5">
              <DollarSign className="h-3.5 w-3.5" />
              {list.name}
              <Badge variant="secondary" className="ml-1 text-[10px] px-1 py-0 h-4">{list.item_count}</Badge>
            </TabsTrigger>
          ))}
          <TabsTrigger value="ofertas" className="text-xs gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md px-3 py-1.5">
            <Tag className="h-3.5 w-3.5" />
            Ofertas
          </TabsTrigger>
        </TabsList>
        {!vendorView && (
        <Button
          onClick={() => setIsNewListOpen(true)}
          variant="outline"
          size="sm"
          className="h-9 text-xs gap-1.5 border-dashed border-emerald-300 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-400 shrink-0"
        >
          <Plus className="h-3.5 w-3.5" />
          Nueva Lista
        </Button>
        )}
        </div>

        <TabsContent value="comercial" className="mt-3">
      {/* Compact Toolbar */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-2">
          {!vendorView && (
          <Button
            onClick={() => setIsAddDialogOpen(true)}
            size="sm"
            className="flex items-center gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 shadow-sm"
            data-testid="button-add-product"
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Agregar</span>
          </Button>
          )}
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
          <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-1.5 text-xs border-amber-300 text-amber-700 hover:bg-amber-50 hover:text-amber-800"
            onClick={() => { setIsBulkAdjustOpen(true); setBulkAdjustConfirm(false); setBulkAdjustPercentage(''); }}
            data-testid="button-bulk-adjust"
          >
            <Percent className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Ajuste Masivo</span>
          </Button>
          )}
          {!vendorView && (
          <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="flex items-center gap-1.5 text-xs" data-testid="button-import-csv">
                <Upload className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Importar</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Importar Lista de Precios</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="csv-file">Archivo CSV</Label>
                  <Input
                    id="csv-file"
                    type="file"
                    accept=".csv"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    className="mt-1"
                    data-testid="input-csv-file"
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    Selecciona un archivo CSV con la estructura de precios.
                  </p>
                </div>

                {importFile && (
                  <div className="p-3 bg-muted rounded-lg">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      <span className="text-sm font-medium">{importFile.name}</span>
                      <Badge variant="secondary">{(importFile.size / 1024).toFixed(1)} KB</Badge>
                    </div>
                  </div>
                )}

                {importResult && (
                  <div className={`p-3 rounded-lg ${importResult.errors ? 'bg-destructive/10' : 'bg-green-50'}`}>
                    <div className="flex items-center gap-2">
                      {importResult.errors ? (
                        <AlertCircle className="h-4 w-4 text-destructive" />
                      ) : (
                        <div className="h-4 w-4 rounded-full bg-green-500" />
                      )}
                      <span className="text-sm font-medium">
                        {importResult.errors ? 'Errores encontrados' : 'Importación exitosa'}
                      </span>
                    </div>
                    {importResult.importedCount && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {importResult.importedCount} elementos importados
                      </p>
                    )}
                    {importResult.errors && (
                      <div className="mt-2 max-h-32 overflow-y-auto">
                        <pre className="text-xs text-destructive">
                          {JSON.stringify(importResult.errors, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setIsImportDialogOpen(false)}
                    data-testid="button-cancel-import"
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleImport}
                    disabled={!importFile || importMutation.isPending}
                    data-testid="button-confirm-import"
                  >
                    {importMutation.isPending ? 'Importando...' : 'Importar'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          )}
        </div>

        {/* Search + Filters inline */}
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Buscar código o producto..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              className="pl-8 h-8 text-xs"
              data-testid="input-search"
            />
          </div>
          <Select
            value={selectedUnidad}
            onValueChange={(value) => {
              setSelectedUnidad(value === "all" ? "" : value);
              setPage(0);
            }}
          >
            <SelectTrigger className="h-8 w-36 text-xs" data-testid="select-unit-filter">
              <SelectValue placeholder="Formato" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {availableUnits.map((unit) => (
                <SelectItem key={unit} value={unit}>{unit}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={selectedColor}
            onValueChange={(value) => {
              setSelectedColor(value === "all" ? "" : value);
              setPage(0);
            }}
          >
            <SelectTrigger className="h-8 w-36 text-xs" data-testid="select-color-filter">
              <SelectValue placeholder="Color" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {availableColors.map((color) => (
                <SelectItem key={color} value={color}>{color}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {data && (
            <span className="text-xs text-muted-foreground whitespace-nowrap" data-testid="text-total-count">
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
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-muted-foreground">Cargando lista de precios...</p>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <AlertCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">Error al cargar</h3>
              <p className="text-muted-foreground">No se pudo cargar la lista de precios.</p>
            </div>
          ) : !data?.items?.length ? (
            <div className="text-center py-12">
              <DollarSign className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                {search ? 'No se encontraron resultados' : 'Lista vacía'}
              </h3>
              <p className="text-muted-foreground mb-6">
                {search 
                  ? 'Intenta con otros términos de búsqueda' 
                  : 'Importa un archivo CSV para comenzar a gestionar la lista de precios'
                }
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow className="text-xs">
                    <TableHead className="text-xs">Código</TableHead>
                    <TableHead className="text-xs">Producto</TableHead>
                    <TableHead className="text-xs">Formato</TableHead>
                    <TableHead className="text-right text-xs">Lista</TableHead>
                    <TableHead className="text-right text-xs">Desc10</TableHead>
                    <TableHead className="text-right text-xs">Desc10+5</TableHead>
                    <TableHead className="text-right text-xs">Mínimo</TableHead>
                    {vendorView && (
                      <TableHead className="text-right text-xs text-red-600 dark:text-red-400 font-semibold">Lista Mix</TableHead>
                    )}
                    {!vendorView && (<>
                    <TableHead className="text-right text-xs text-amber-700 dark:text-amber-400">Costo</TableHead>
                    <TableHead className="text-right text-xs">Margen</TableHead>
                    <TableHead className="text-right text-xs text-blue-600 dark:text-blue-400"><span className="flex items-center justify-end gap-1"><Calculator className="h-3 w-3" />Simulador</span></TableHead>
                    <TableHead className="w-16 text-xs">Acc.</TableHead>
                    </>)}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((item) => (
                    <TableRow key={item.id} data-testid={`row-price-${item.id}`} className="text-xs">
                      <TableCell className="font-mono text-xs py-2" data-testid={`text-codigo-${item.id}`}>
                        {item.codigo}
                      </TableCell>
                      <TableCell className="text-xs py-2 max-w-[280px]" data-testid={`text-producto-${item.id}`}>
                        <TooltipProvider delayDuration={200}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="block leading-tight cursor-default">{item.producto}</span>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-xs text-xs">
                              {item.producto}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell className="text-xs py-2" data-testid={`text-unidad-${item.id}`}>
                        {item.unidad || '-'}
                      </TableCell>
                      {(() => {
                        const griEntry = item.codigo ? griPrices?.[item.codigo.toUpperCase()] : null;
                        const costoGri = griEntry?.price ?? null;
                        const costo = costoGri || (item as any).costoProduccion;
                        const costoNum = typeof costo === 'string' ? parseFloat(costo) : costo;

                        const calcMargin = (price: number | string | null) => {
                          if (!price || !costoNum || costoNum === 0) return null;
                          const p = typeof price === 'string' ? parseFloat(price) : price;
                          if (isNaN(p) || p === 0) return null;
                          return ((p - costoNum) / p) * 100;
                        };

                        const marginBadge = (margin: number | null) => {
                          if (vendorView || margin === null) return null;
                          const color = margin >= 0
                            ? 'text-emerald-600/70 dark:text-emerald-400/70'
                            : 'text-red-500/70 dark:text-red-400/70';
                          return (
                            <span className={`block text-[10px] leading-tight mt-0.5 font-medium ${color}`}>
                              {margin >= 0 ? '+' : ''}{margin.toFixed(1)}%
                            </span>
                          );
                        };

                        return (
                          <>
                            <TableCell className="text-right py-2" data-testid={`text-lista-${item.id}`}>
                              <div className="text-xs">
                                {formatCurrency(item.lista)}
                                {marginBadge(calcMargin(item.lista))}
                              </div>
                            </TableCell>
                            <TableCell className="text-right py-2" data-testid={`text-desc10-${item.id}`}>
                              <div className="text-xs">
                                {formatCurrency(item.desc10)}
                                {marginBadge(calcMargin(item.desc10))}
                              </div>
                            </TableCell>
                            <TableCell className="text-right py-2" data-testid={`text-desc10-5-${item.id}`}>
                              <div className="text-xs">
                                {formatCurrency(item.desc10_5)}
                                {marginBadge(calcMargin(item.desc10_5))}
                              </div>
                            </TableCell>
                            <TableCell className="text-right py-2" data-testid={`text-minimo-${item.id}`}>
                              <div className="text-xs">
                                {formatCurrency(item.minimo)}
                                {marginBadge(calcMargin(item.minimo))}
                              </div>
                            </TableCell>
                            {vendorView && (
                              <TableCell className="text-right py-2 text-red-600 dark:text-red-400 font-semibold" data-testid={`text-mix-${item.id}`}>
                                <div className="text-xs">
                                  {formatCurrency(item.codigo ? (mixPricesByCode?.[item.codigo.toUpperCase()] ?? null) : null)}
                                </div>
                              </TableCell>
                            )}
                          </>
                        );
                      })()}
                      {!vendorView && (<>
                      <TableCell className="text-right text-xs py-2 font-semibold text-amber-700 dark:text-amber-400" data-testid={`text-costo-${item.id}`}>
                        {(() => {
                          const griEntry = item.codigo ? griPrices?.[item.codigo.toUpperCase()] : null;
                          const costoValue = griEntry?.price ?? (item as any).costoProduccion;
                          const costoDate = griEntry?.date ?? null;
                          if (!costoValue) return '-';
                          return (
                            <div>
                              {formatCurrency(costoValue)}
                              {costoDate && (
                                <span className="block text-[9px] leading-tight mt-0.5 font-normal text-muted-foreground/60">
                                  {new Date(costoDate + 'T00:00:00').toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: '2-digit' })}
                                </span>
                              )}
                            </div>
                          );
                        })()}
                      </TableCell>
                      <TableCell className="text-right text-xs py-2 font-semibold" data-testid={`text-margen-${item.id}`}>
                        {(() => {
                          const griEntry = item.codigo ? griPrices?.[item.codigo.toUpperCase()] : null;
                          const costo = griEntry?.price ?? (item as any).costoProduccion;
                          const minimo = typeof item.minimo === 'string' ? parseFloat(item.minimo) : item.minimo;
                          if (!costo || !minimo || costo === 0) return '-';
                          const margen = ((minimo - costo) / minimo) * 100;
                          const color = margen >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
                          return <span className={color}>{margen.toFixed(1)}%</span>;
                        })()}
                      </TableCell>
                      <TableCell className="py-2" data-testid={`text-simulador-${item.id}`}>
                        {(() => {
                          const griEntry = item.codigo ? griPrices?.[item.codigo.toUpperCase()] : null;
                          const costo = griEntry?.price ?? (item as any).costoProduccion;
                          const costoNum = typeof costo === 'string' ? parseFloat(costo) : costo;
                          const simPrice = simulatorPrices[item.id];
                          const simNum = simPrice ? parseFloat(simPrice) : null;
                          let simMargin: number | null = null;
                          if (simNum && costoNum && simNum > 0) {
                            simMargin = ((simNum - costoNum) / simNum) * 100;
                          }
                          return (
                            <div className="flex flex-col items-end">
                              <Input
                                type="number"
                                placeholder="$"
                                value={simulatorPrices[item.id] || ''}
                                onChange={(e) => setSimulatorPrices(prev => ({ ...prev, [item.id]: e.target.value }))}
                                className="h-6 w-20 text-[11px] text-right px-1.5 border-blue-200 focus:border-blue-400"
                              />
                              {simMargin !== null && (
                                <span className={`text-[10px] font-semibold mt-0.5 ${
                                  simMargin >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'
                                }`}>
                                  {simMargin >= 0 ? '+' : ''}{simMargin.toFixed(1)}%
                                </span>
                              )}
                            </div>
                          );
                        })()}
                      </TableCell>
                      <TableCell className="py-2">
                        <div className="flex gap-0.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => handleEdit(item)}
                            data-testid={`button-edit-${item.id}`}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                      </>)}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {data.totalCount > itemsPerPage && (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="text-xs sm:text-sm text-muted-foreground text-center sm:text-left">
                    Mostrando {page * itemsPerPage + 1}-{Math.min((page + 1) * itemsPerPage, data.totalCount)} de {data.totalCount}
                  </div>
                  <div className="flex gap-2 justify-center sm:justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs sm:text-sm"
                      onClick={() => setPage(page - 1)}
                      disabled={page === 0}
                      data-testid="button-prev-page"
                    >
                      Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs sm:text-sm"
                      onClick={() => setPage(page + 1)}
                      disabled={!data.hasMore}
                      data-testid="button-next-page"
                    >
                      Siguiente
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de Edición */}
      <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setIsEditDialogOpen(false);
          setEditItem(null);
          setShowDeleteConfirm(false);
        }
      }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5" />
              Editar Producto
            </DialogTitle>
            <DialogDescription>
              Modifica los datos del producto en la lista de precios
            </DialogDescription>
          </DialogHeader>
          
          {editItem && (
            <div className="py-4 max-h-[60vh] overflow-y-auto">
              <div className="space-y-3">
                {/* Producto - Primero */}
                <div className="flex items-center py-2 border-b">
                  <Label className="text-sm font-medium w-1/2">Producto</Label>
                  <Input
                    id="edit-producto"
                    className="w-1/2 text-right"
                    value={editItem.producto || ''}
                    onChange={(e) => setEditItem({ ...editItem, producto: e.target.value })}
                    data-testid="input-edit-producto"
                  />
                </div>

                {/* Código */}
                <div className="flex items-center py-2 border-b">
                  <Label className="text-sm font-medium w-1/2">Código</Label>
                  <Input
                    id="edit-codigo"
                    className="w-1/2 text-right"
                    value={editItem.codigo || ''}
                    onChange={(e) => setEditItem({ ...editItem, codigo: e.target.value })}
                    data-testid="input-edit-codigo"
                  />
                </div>

                {/* Formato */}
                <div className="flex items-center py-2 border-b">
                  <Label className="text-sm font-medium w-1/2">Formato</Label>
                  <Input
                    id="edit-unidad"
                    className="w-1/2 text-right"
                    value={editItem.unidad || ''}
                    onChange={(e) => setEditItem({ ...editItem, unidad: e.target.value })}
                    data-testid="input-edit-unidad"
                  />
                </div>

                {/* Color */}
                <div className="flex items-center py-2 border-b">
                  <Label className="text-sm font-medium w-1/2">Color</Label>
                  <Input
                    id="edit-color"
                    className="w-1/2 text-right"
                    value={editItem.color || ''}
                    onChange={(e) => setEditItem({ ...editItem, color: e.target.value })}
                    data-testid="input-edit-color"
                  />
                </div>

                {/* Precio Lista */}
                <div className="flex items-center py-2 border-b">
                  <Label className="text-sm font-medium w-1/2">Precio Lista</Label>
                  <Input
                    id="edit-lista"
                    type="number"
                    className="w-1/2 text-right"
                    value={formatNumber(editItem.lista)}
                    onChange={(e) => setEditItem({ ...editItem, lista: e.target.value ? parseFloat(e.target.value) : null })}
                    data-testid="input-edit-lista"
                  />
                </div>

                {/* Desc 10% */}
                <div className="flex items-center py-2 border-b">
                  <Label className="text-sm font-medium w-1/2">Desc 10%</Label>
                  <Input
                    id="edit-desc10"
                    type="number"
                    className="w-1/2 text-right"
                    value={formatNumber(editItem.desc10)}
                    onChange={(e) => setEditItem({ ...editItem, desc10: e.target.value ? parseFloat(e.target.value) : null })}
                    data-testid="input-edit-desc10"
                  />
                </div>

                {/* Desc 10+5% */}
                <div className="flex items-center py-2 border-b">
                  <Label className="text-sm font-medium w-1/2">Desc 10+5%</Label>
                  <Input
                    id="edit-desc10-5"
                    type="number"
                    className="w-1/2 text-right"
                    value={formatNumber(editItem.desc10_5)}
                    onChange={(e) => setEditItem({ ...editItem, desc10_5: e.target.value ? parseFloat(e.target.value) : null })}
                    data-testid="input-edit-desc10-5"
                  />
                </div>

                {/* Precio Mínimo */}
                <div className="flex items-center py-2 border-b">
                  <Label className="text-sm font-medium w-1/2">Precio Mínimo</Label>
                  <Input
                    id="edit-minimo"
                    type="number"
                    className="w-1/2 text-right"
                    value={formatNumber(editItem.minimo)}
                    onChange={(e) => setEditItem({ ...editItem, minimo: e.target.value ? parseFloat(e.target.value) : null })}
                    data-testid="input-edit-minimo"
                  />
                </div>

                {/* Costo de Producción */}
                <div className="flex items-center py-2 border-b">
                  <Label className="text-sm font-medium w-1/2">Costo de Producción</Label>
                  <Input
                    id="edit-costo"
                    type="number"
                    className="w-1/2 text-right"
                    value={formatNumber((editItem as any).costoProduccion)}
                    onChange={(e) => setEditItem({ ...editItem, costoProduccion: e.target.value ? parseFloat(e.target.value) : null } as any)}
                    data-testid="input-edit-costo"
                  />
                </div>

                {/* Cantidad de Producto */}
                <div className="flex items-center py-2 border-b">
                  <Label className="text-sm font-medium w-1/2">Cantidad de Producto</Label>
                  <Input
                    id="edit-cantidad"
                    type="number"
                    step="0.0001"
                    className="w-1/2 text-right"
                    value={formatNumber((editItem as any).cantidadProducto)}
                    onChange={(e) => setEditItem({ ...editItem, cantidadProducto: e.target.value ? parseFloat(e.target.value) : null } as any)}
                    data-testid="input-edit-cantidad"
                  />
                </div>

                {/* Unidad de Medida */}
                <div className="flex items-center py-2 border-b">
                  <Label className="text-sm font-medium w-1/2">Unidad de Medida</Label>
                  <Input
                    id="edit-unidad-medida"
                    className="w-1/2 text-right"
                    placeholder="m², lt, kg"
                    value={(editItem as any).unidadMedida || ''}
                    onChange={(e) => setEditItem({ ...editItem, unidadMedida: e.target.value } as any)}
                    data-testid="input-edit-unidad-medida"
                  />
                </div>

                {/* Rendimiento */}
                <div className="flex items-center py-2 border-b">
                  <Label className="text-sm font-medium w-1/2">Rendimiento</Label>
                  <Input
                    id="edit-rendimiento"
                    type="number"
                    step="0.0001"
                    className="w-1/2 text-right"
                    value={formatNumber((editItem as any).rendimiento)}
                    onChange={(e) => setEditItem({ ...editItem, rendimiento: e.target.value ? parseFloat(e.target.value) : null } as any)}
                    data-testid="input-edit-rendimiento"
                  />
                </div>

                {/* Costo por Unidad de Medida (calculado automáticamente) */}
                <div className="flex items-center py-2">
                  <Label className="text-sm font-medium w-1/2">Costo/Unidad Medida</Label>
                  <div className="w-1/2 text-right text-sm py-2 px-3 bg-gray-100 dark:bg-gray-800 rounded">
                    {editItem.lista && (editItem as any).rendimiento
                      ? formatNumber(Math.round(editItem.lista / (editItem as any).rendimiento))
                      : '-'}
                  </div>
                </div>

                {/* ────────── Venta por Pallet ──────────
                    Guarda en ecommerce_products (vía PATCH /api/ecommerce/admin/productos/:id).
                    El descuento por pallet REEMPLAZA ofertas activas; no se suman. */}
                <div className="pt-4 mt-2 border-t border-blue-200/40 bg-blue-50/30 -mx-3 px-3 pb-2 rounded-md">
                  <div className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-blue-600" />
                      <Label className="text-sm font-semibold text-blue-900">Venta por Pallet</Label>
                    </div>
                    <Switch
                      checked={palletEnabled}
                      onCheckedChange={setPalletEnabled}
                      data-testid="switch-pallet-enabled"
                    />
                  </div>
                  <p className="text-[11px] text-blue-700/80 mb-2">
                    Si está habilitado, la tienda online mostrará un botón "Pallet completo".
                  </p>

                  <div className="flex items-center py-1.5">
                    <Label className="text-xs text-blue-900/80 w-1/2">Unidades por pallet</Label>
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      placeholder="144 / 36 / 24"
                      className="w-1/2 text-right h-8 text-xs"
                      value={palletUnitsInput}
                      onChange={(e) => setPalletUnitsInput(e.target.value)}
                      data-testid="input-pallet-units"
                    />
                  </div>

                  <div className="flex items-center py-1.5">
                    <Label className="text-xs text-blue-900/80 w-1/2">Descuento (%)</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={0.01}
                      placeholder="0 (opcional)"
                      className="w-1/2 text-right h-8 text-xs"
                      value={palletDiscountInput}
                      onChange={(e) => setPalletDiscountInput(e.target.value)}
                      data-testid="input-pallet-discount"
                    />
                  </div>

                  {palletEnabled && (
                    <div className="flex gap-2 mt-2 p-2 bg-amber-50 border border-amber-200/60 rounded text-[11px] text-amber-800">
                      <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                      <span>
                        El descuento por pallet <strong>reemplaza</strong> cualquier oferta activa
                        de este SKU (no se suman).
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="flex !justify-between items-center">
            <div>
              {!showDeleteConfirm ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-1.5"
                  onClick={() => setShowDeleteConfirm(true)}
                  data-testid="button-delete-product"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Eliminar
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-destructive font-medium">¿Eliminar este producto?</span>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => {
                      if (editItem) {
                        deleteMutation.mutate(editItem.id, {
                          onSuccess: () => {
                            setIsEditDialogOpen(false);
                            setEditItem(null);
                            setShowDeleteConfirm(false);
                          },
                        });
                      }
                    }}
                    disabled={deleteMutation.isPending}
                    data-testid="button-confirm-delete"
                  >
                    {deleteMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Sí, eliminar'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setShowDeleteConfirm(false)}
                    data-testid="button-cancel-delete"
                  >
                    No
                  </Button>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsEditDialogOpen(false);
                  setEditItem(null);
                  setShowDeleteConfirm(false);
                }}
                data-testid="button-cancel-edit"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSaveEdit}
                disabled={updateMutation.isPending}
                data-testid="button-save-edit"
              >
                {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Guardar
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal para agregar producto */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Agregar Nuevo Producto</DialogTitle>
            <DialogDescription>
              Completa los campos para agregar un producto a la lista de precios
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-3">
            {/* Producto */}
            <div className="flex items-center py-2 border-b">
              <Label className="text-sm font-medium w-1/2">Producto *</Label>
              <Input
                className="w-1/2 text-right"
                value={newProduct.producto}
                onChange={(e) => setNewProduct({ ...newProduct, producto: e.target.value })}
                placeholder="Nombre del producto"
                data-testid="input-add-producto"
              />
            </div>

            {/* Código */}
            <div className="flex items-center py-2 border-b">
              <Label className="text-sm font-medium w-1/2">Código</Label>
              <Input
                className="w-1/2 text-right"
                value={newProduct.codigo}
                onChange={(e) => setNewProduct({ ...newProduct, codigo: e.target.value })}
                placeholder="Código del producto"
                data-testid="input-add-codigo"
              />
            </div>

            {/* Formato */}
            <div className="flex items-center py-2 border-b">
              <Label className="text-sm font-medium w-1/2">Formato</Label>
              <Input
                className="w-1/2 text-right"
                value={newProduct.unidad}
                onChange={(e) => setNewProduct({ ...newProduct, unidad: e.target.value })}
                placeholder="Ej: Galón, Rollo"
                data-testid="input-add-unidad"
              />
            </div>

            {/* Color */}
            <div className="flex items-center py-2 border-b">
              <Label className="text-sm font-medium w-1/2">Color</Label>
              <Input
                className="w-1/2 text-right"
                value={newProduct.color}
                onChange={(e) => setNewProduct({ ...newProduct, color: e.target.value })}
                data-testid="input-add-color"
              />
            </div>

            {/* Precio Lista */}
            <div className="flex items-center py-2 border-b">
              <Label className="text-sm font-medium w-1/2">Precio Lista</Label>
              <Input
                type="number"
                className="w-1/2 text-right"
                value={newProduct.lista}
                onChange={(e) => setNewProduct({ ...newProduct, lista: e.target.value })}
                data-testid="input-add-lista"
              />
            </div>

            {/* Desc 10% */}
            <div className="flex items-center py-2 border-b">
              <Label className="text-sm font-medium w-1/2">Desc 10%</Label>
              <Input
                type="number"
                className="w-1/2 text-right"
                value={newProduct.desc10}
                onChange={(e) => setNewProduct({ ...newProduct, desc10: e.target.value })}
                data-testid="input-add-desc10"
              />
            </div>

            {/* Desc 10+5% */}
            <div className="flex items-center py-2 border-b">
              <Label className="text-sm font-medium w-1/2">Desc 10+5%</Label>
              <Input
                type="number"
                className="w-1/2 text-right"
                value={newProduct.desc10_5}
                onChange={(e) => setNewProduct({ ...newProduct, desc10_5: e.target.value })}
                data-testid="input-add-desc10-5"
              />
            </div>

            {/* Precio Mínimo */}
            <div className="flex items-center py-2 border-b">
              <Label className="text-sm font-medium w-1/2">Precio Mínimo</Label>
              <Input
                type="number"
                className="w-1/2 text-right"
                value={newProduct.minimo}
                onChange={(e) => setNewProduct({ ...newProduct, minimo: e.target.value })}
                data-testid="input-add-minimo"
              />
            </div>

            {/* Costo de Producción */}
            <div className="flex items-center py-2 border-b">
              <Label className="text-sm font-medium w-1/2">Costo de Producción</Label>
              <Input
                type="number"
                className="w-1/2 text-right"
                value={newProduct.costoProduccion}
                onChange={(e) => setNewProduct({ ...newProduct, costoProduccion: e.target.value })}
                data-testid="input-add-costo"
              />
            </div>

            {/* Cantidad de Producto */}
            <div className="flex items-center py-2 border-b">
              <Label className="text-sm font-medium w-1/2">Cantidad de Producto</Label>
              <Input
                type="number"
                step="0.0001"
                className="w-1/2 text-right"
                value={newProduct.cantidadProducto}
                onChange={(e) => setNewProduct({ ...newProduct, cantidadProducto: e.target.value })}
                data-testid="input-add-cantidad"
              />
            </div>

            {/* Unidad de Medida */}
            <div className="flex items-center py-2 border-b">
              <Label className="text-sm font-medium w-1/2">Unidad de Medida</Label>
              <Input
                className="w-1/2 text-right"
                placeholder="m², lt, kg"
                value={newProduct.unidadMedida}
                onChange={(e) => setNewProduct({ ...newProduct, unidadMedida: e.target.value })}
                data-testid="input-add-unidad-medida"
              />
            </div>

            {/* Rendimiento */}
            <div className="flex items-center py-2 border-b">
              <Label className="text-sm font-medium w-1/2">Rendimiento</Label>
              <Input
                type="number"
                step="0.0001"
                className="w-1/2 text-right"
                value={newProduct.rendimiento}
                onChange={(e) => setNewProduct({ ...newProduct, rendimiento: e.target.value })}
                data-testid="input-add-rendimiento"
              />
            </div>

            {/* Costo por Unidad de Medida (calculado automáticamente) */}
            <div className="flex items-center py-2">
              <Label className="text-sm font-medium w-1/2">Costo/Unidad Medida</Label>
              <div className="w-1/2 text-right text-sm py-2 px-3 bg-gray-100 dark:bg-gray-800 rounded">
                {newProduct.lista && newProduct.rendimiento 
                  ? Math.round(parseFloat(newProduct.lista) / parseFloat(newProduct.rendimiento))
                  : '-'}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsAddDialogOpen(false)}
              data-testid="button-cancel-add"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCreateProduct}
              disabled={!newProduct.producto || createMutation.isPending}
              data-testid="button-save-add"
            >
              {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Crear Producto
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
              Ajuste Masivo de Precios
            </DialogTitle>
            <DialogDescription>
              Aumenta o disminuye todos los precios de la lista de forma porcentual
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-5 py-2">
            {/* Direction toggle */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setBulkAdjustDirection('up')}
                className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                  bulkAdjustDirection === 'up'
                    ? 'bg-emerald-100 text-emerald-800 border-2 border-emerald-400 shadow-sm'
                    : 'bg-gray-50 text-gray-500 border-2 border-gray-200 hover:bg-gray-100'
                }`}
                data-testid="toggle-adjust-up"
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
                data-testid="toggle-adjust-down"
              >
                <TrendingDown className="h-4 w-4" />
                Disminuir
              </button>
            </div>

            {/* Percentage input */}
            <div>
              <Label className="text-sm font-semibold text-gray-700 mb-1.5 block">Porcentaje de ajuste</Label>
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
                  data-testid="input-bulk-percentage"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-lg font-bold text-gray-400">%</span>
              </div>
              {bulkAdjustPercentage && parseFloat(bulkAdjustPercentage) > 0 && (
                <p className={`text-xs mt-1.5 font-medium ${bulkAdjustDirection === 'up' ? 'text-emerald-600' : 'text-red-600'}`}>
                  {bulkAdjustDirection === 'up' ? '↑' : '↓'} Todos los precios se {bulkAdjustDirection === 'up' ? 'multiplicarán' : 'reducirán'} por {(1 + (bulkAdjustDirection === 'up' ? 1 : -1) * parseFloat(bulkAdjustPercentage) / 100).toFixed(4)}x
                </p>
              )}
            </div>

            {/* Fields to adjust */}
            <div>
              <Label className="text-sm font-semibold text-gray-700 mb-2 block">Columnas a ajustar</Label>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { key: 'lista', label: 'Lista' },
                  { key: 'desc10', label: 'Desc10' },
                  { key: 'desc10_5', label: 'Desc10+5' },
                  { key: 'desc10_5_3', label: 'Desc10+5+3' },
                  { key: 'minimo', label: 'Mínimo' },
                  { key: 'canalDigital', label: 'Canal Digital' },
                ].map(({ key, label }) => (
                  <label
                    key={key}
                    className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-medium cursor-pointer transition-all ${
                      bulkAdjustFields.includes(key)
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : 'bg-gray-50 text-gray-400 border border-gray-200'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={bulkAdjustFields.includes(key)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setBulkAdjustFields([...bulkAdjustFields, key]);
                        } else {
                          setBulkAdjustFields(bulkAdjustFields.filter(f => f !== key));
                        }
                      }}
                      className="rounded border-gray-300 text-blue-600 h-3.5 w-3.5"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>

            {/* Optional unit filter */}
            <div>
              <Label className="text-sm font-semibold text-gray-700 mb-1.5 block">Filtrar por formato (opcional)</Label>
              <Select
                value={bulkAdjustUnit}
                onValueChange={(value) => setBulkAdjustUnit(value === "all" ? "" : value)}
              >
                <SelectTrigger className="h-9 text-sm" data-testid="select-bulk-unit">
                  <SelectValue placeholder="Todos los formatos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los formatos</SelectItem>
                  {availableUnits.map((unit) => (
                    <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Round to Decena */}
            <div className="flex items-center gap-2 mt-2">
              <input
                type="checkbox"
                id="roundToDecena"
                checked={bulkAdjustRoundToDecena}
                onChange={(e) => setBulkAdjustRoundToDecena(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 border-gray-300"
              />
              <Label htmlFor="roundToDecena" className="text-sm font-medium text-gray-700 cursor-pointer select-none">
                Redondear a la decena (ej: 4977 → 4980)
              </Label>
            </div>
          </div>

          <DialogFooter className="flex flex-col gap-2 sm:flex-col">
            {!bulkAdjustConfirm ? (
              <Button
                onClick={() => setBulkAdjustConfirm(true)}
                disabled={((!bulkAdjustPercentage || parseFloat(bulkAdjustPercentage) <= 0) && !bulkAdjustRoundToDecena) || bulkAdjustFields.length === 0}
                className={`w-full h-11 text-sm font-bold ${
                  bulkAdjustDirection === 'up'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
                data-testid="button-bulk-preview"
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
                      <>Se {bulkAdjustDirection === 'up' ? 'aumentarán' : 'disminuirán'} <strong>{bulkAdjustPercentage}%</strong> las columnas</>
                    ) : (
                      <>Se redondearán a la decena las columnas</>
                    )}: <strong>{bulkAdjustFields.join(', ')}</strong>{bulkAdjustUnit ? ` (solo formato: ${bulkAdjustUnit})` : ' (todos los productos)'}.
                  </p>
                  <p className="mt-1 text-xs opacity-70">Esta acción no se puede deshacer.</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setBulkAdjustConfirm(false)}
                    data-testid="button-bulk-cancel"
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
                    data-testid="button-bulk-confirm"
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
        </TabsContent>

        {customPriceLists.map(list => (
          <TabsContent key={list.code} value={list.code} className="mt-3">
            <ListaPreciosMix listCode={list.code} listName={list.name} vendorView={vendorView} />
          </TabsContent>
        ))}

        <TabsContent value="ofertas" className="mt-3">
          <ListaPreciosOfertas vendorView={vendorView} />
        </TabsContent>
      </Tabs>

      {/* New List Dialog */}
      <Dialog open={isNewListOpen} onOpenChange={setIsNewListOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-emerald-600" />
              Nueva Lista de Precios
            </DialogTitle>
            <DialogDescription>
              Se creará una nueva lista con código automático (LP03, LP04, etc.)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-sm font-medium">Nombre de la Lista *</Label>
              <Input
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                placeholder="Ej: Lista VIP, Lista Constructora"
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsNewListOpen(false); setNewListName(""); }}>Cancelar</Button>
            <Button
              onClick={async () => {
                if (!newListName.trim()) return;
                try {
                  await apiRequest("POST", "/api/custom-price-lists", { name: newListName.trim() });
                  queryClient.invalidateQueries({ queryKey: ["/api/custom-price-lists"] });
                  setIsNewListOpen(false);
                  setNewListName("");
                } catch (err: any) {
                  console.error(err);
                }
              }}
              disabled={!newListName.trim()}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              Crear Lista
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}