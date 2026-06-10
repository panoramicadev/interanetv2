import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Upload, Download, Search, Plus, Edit, Trash2, FileText, AlertCircle, Loader2, Calculator, Percent, TrendingUp, TrendingDown, Check, Tag, Pause, Play, Users, X, UserCheck } from "lucide-react";

interface SelectedClient {
  id: string;
  name: string;
  rut?: string | null;
}

type OfferType = "regular" | "pallet";

interface OffersItem {
  id: string;
  codigo: string;
  offerType: OfferType;
  precio: string | null;
  unitsPerPallet: number | null;
  discountPct: string | null;
  paused: boolean;
  allClients: boolean;
  clientCount: number;
  targetClients: Array<{ id: string; name: string | null; rut: string | null }>;
  producto: string | null;
  unidad: string | null;
  costoProduccion: string | null;
  created_at: string;
  updated_at: string;
}

interface PriceListSearchItem {
  id: string;
  codigo: string;
  producto: string;
  unidad: string | null;
}

// Combobox buscador de SKUs: hits /api/price-list?search=, muestra "CODIGO — Producto".
// Se selecciona un solo producto. value es el código (string).
function SkuSearchCombobox({
  value,
  onChange,
  placeholder = "Buscar por código o nombre…",
  disabled,
}: {
  value: string;
  onChange: (codigo: string, item: PriceListSearchItem | null) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const { data, isFetching } = useQuery<{ items: PriceListSearchItem[] }>({
    queryKey: ["/api/price-list", "offer-picker", query],
    queryFn: () =>
      apiRequest(
        "GET",
        `/api/price-list?search=${encodeURIComponent(query)}&limit=20&offset=0`
      ).then((r) => r.json()),
    enabled: open && query.trim().length >= 2,
    staleTime: 30_000,
  });

  const items = data?.items || [];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between h-8 text-sm font-normal"
        >
          <span className={value ? "" : "text-muted-foreground"}>
            {value || placeholder}
          </span>
          <Search className="h-3.5 w-3.5 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[420px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Escribí 2+ caracteres del código o nombre…"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>
              {isFetching ? "Buscando…" : query.trim().length < 2 ? "Escribe al menos 2 caracteres" : "Sin resultados"}
            </CommandEmpty>
            <CommandGroup>
              {items.map((it) => (
                <CommandItem
                  key={it.id}
                  value={it.codigo}
                  onSelect={() => {
                    onChange(it.codigo, it);
                    setOpen(false);
                    setQuery("");
                  }}
                  className="flex flex-col items-start gap-0.5"
                >
                  <span className="font-mono text-xs">{it.codigo}</span>
                  <span className="text-[11px] text-muted-foreground truncate w-full">
                    {it.producto} {it.unidad ? `· ${it.unidad}` : ""}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// Selector reutilizable de audiencia de una oferta: todos los clientes o una lista
// específica buscable. Matchea por cliente (y todas las sucursales con el mismo RUT).
function AudienceSelector({
  allClients,
  onAllClientsChange,
  selected,
  onSelectedChange,
}: {
  allClients: boolean;
  onAllClientsChange: (v: boolean) => void;
  selected: SelectedClient[];
  onSelectedChange: (v: SelectedClient[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const { data: results = [], isFetching } = useQuery<any[]>({
    queryKey: ["/api/clients/search", query],
    queryFn: () => apiRequest("GET", `/api/clients/search?q=${encodeURIComponent(query)}`).then((r) => r.json()),
    enabled: open && query.trim().length >= 2,
  });

  const toggleClient = (c: any) => {
    const id = c.id as string;
    if (selected.some((s) => s.id === id)) {
      onSelectedChange(selected.filter((s) => s.id !== id));
    } else {
      onSelectedChange([...selected, { id, name: c.nokoen || c.name || "Sin nombre", rut: c.rten ?? c.rut ?? null }]);
    }
  };

  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-muted-foreground">¿A qué clientes aplica esta oferta?</label>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onAllClientsChange(true)}
          className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
            allClients
              ? "bg-red-100 text-red-800 border-2 border-red-400 shadow-sm"
              : "bg-gray-50 text-gray-500 border-2 border-gray-200 hover:bg-gray-100"
          }`}
        >
          <Users className="h-3.5 w-3.5" />
          Todos los clientes
        </button>
        <button
          type="button"
          onClick={() => onAllClientsChange(false)}
          className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
            !allClients
              ? "bg-red-100 text-red-800 border-2 border-red-400 shadow-sm"
              : "bg-gray-50 text-gray-500 border-2 border-gray-200 hover:bg-gray-100"
          }`}
        >
          <UserCheck className="h-3.5 w-3.5" />
          Clientes específicos
        </button>
      </div>

      {!allClients && (
        <div className="space-y-2">
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="w-full justify-between text-xs">
                <span className="flex items-center gap-1.5">
                  <Search className="h-3.5 w-3.5 opacity-50" />
                  Buscar y agregar clientes...
                </span>
                {selected.length > 0 && <Badge variant="secondary" className="text-[10px]">{selected.length}</Badge>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[360px] p-0" align="start">
              <Command shouldFilter={false}>
                <CommandInput placeholder="Nombre, código o RUT..." value={query} onValueChange={setQuery} />
                <CommandList>
                  {query.trim().length < 2 ? (
                    <div className="py-4 px-3 text-xs text-muted-foreground">Escribe al menos 2 caracteres para buscar.</div>
                  ) : isFetching ? (
                    <div className="py-4 px-3 text-xs text-muted-foreground flex items-center gap-2">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Buscando...
                    </div>
                  ) : (
                    <>
                      <CommandEmpty>No se encontró ningún cliente.</CommandEmpty>
                      <CommandGroup>
                        {results.map((c) => {
                          const isSel = selected.some((s) => s.id === c.id);
                          return (
                            <CommandItem key={c.id} value={c.id} onSelect={() => toggleClient(c)} className="text-xs">
                              <Check className={`mr-2 h-3.5 w-3.5 ${isSel ? "opacity-100 text-red-600" : "opacity-0"}`} />
                              <div className="flex flex-col">
                                <span className="font-medium">{c.nokoen || "Sin nombre"}</span>
                                <span className="text-[10px] text-muted-foreground">{c.rten || c.koen || ""}</span>
                              </div>
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </>
                  )}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          {selected.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-2 bg-muted/40 rounded-lg border">
              {selected.map((s) => (
                <Badge key={s.id} variant="secondary" className="text-[10px] gap-1 pr-1">
                  {s.name}
                  <button
                    type="button"
                    onClick={() => onSelectedChange(selected.filter((x) => x.id !== s.id))}
                    className="ml-0.5 rounded-full hover:bg-gray-300/60 p-0.5"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-amber-600">Selecciona al menos un cliente.</p>
          )}
        </div>
      )}
    </div>
  );
}

interface OffersResponse {
  items: OffersItem[];
  totalCount: number;
  hasMore: boolean;
}

export default function ListaPreciosOfertas({ vendorView = false }: { vendorView?: boolean }) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<any>(null);
  const [editItem, setEditItem] = useState<OffersItem | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newOfferType, setNewOfferType] = useState<OfferType>("regular");
  const [newProduct, setNewProduct] = useState({
    codigo: "",
    precio: "",
    unitsPerPallet: "",
    discountPct: "",
  });
  const [newAllClients, setNewAllClients] = useState(true);
  const [newClients, setNewClients] = useState<SelectedClient[]>([]);
  const [editAllClients, setEditAllClients] = useState(true);
  const [editClients, setEditClients] = useState<SelectedClient[]>([]);
  // Edits para campos pallet (paralelos a editItem.precio)
  const [editUnitsPerPallet, setEditUnitsPerPallet] = useState("");
  const [editDiscountPct, setEditDiscountPct] = useState("");
  const [simulatorPrices, setSimulatorPrices] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const [isBulkAdjustOpen, setIsBulkAdjustOpen] = useState(false);
  const [bulkAdjustDirection, setBulkAdjustDirection] = useState<'up'|'down'>('down');
  const [bulkAdjustPercentage, setBulkAdjustPercentage] = useState("");
  const [bulkAdjustRoundToDecena, setBulkAdjustRoundToDecena] = useState(true);
  const [bulkAdjustConfirm, setBulkAdjustConfirm] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const itemsPerPage = 50;

  const { data, isLoading, error } = useQuery<OffersResponse>({
    queryKey: ["/api/price-list-offers", search, page],
    queryFn: () =>
      apiRequest("GET", `/api/price-list-offers?search=${encodeURIComponent(search)}&limit=${itemsPerPage}&offset=${page * itemsPerPage}`)
        .then(r => r.json()),
  });

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
    mutationFn: (id: string) => apiRequest("DELETE", `/api/price-list-offers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/price-list-offers"] });
      toast({ title: "Eliminado", description: "Producto eliminado correctamente" });
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/price-list-offers", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/price-list-offers"] });
      setIsAddOpen(false);
      setNewProduct({ codigo: "", precio: "", unitsPerPallet: "", discountPct: "" });
      setNewOfferType("regular");
      setNewAllClients(true);
      setNewClients([]);
      toast({ title: "Creado", description: "Oferta agregada correctamente" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err?.message || "No se pudo crear la oferta", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: any) => apiRequest("PATCH", `/api/price-list-offers/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/price-list-offers"] });
      setIsEditOpen(false);
      setEditItem(null);
      toast({ title: "Actualizado", description: "Oferta actualizada correctamente" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err?.message || "No se pudo actualizar la oferta", variant: "destructive" });
    },
  });

  const pauseMutation = useMutation({
    mutationFn: ({ id, paused }: { id: string; paused: boolean }) =>
      apiRequest("PATCH", `/api/price-list-offers/${id}`, { paused }),
    onSuccess: (_data, { paused }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/price-list-offers"] });
      toast({
        title: paused ? "Oferta pausada" : "Oferta reactivada",
        description: paused
          ? "El precio de oferta no se mostrará mientras esté pausado."
          : "El precio de oferta está activo nuevamente.",
      });
    },
  });

  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/price-list-offers/import", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (data) => {
      setImportResult(data);
      queryClient.invalidateQueries({ queryKey: ["/api/price-list-offers"] });
      toast({ title: "Importado", description: `${data.importedCount} SKUs importados a ofertas` });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const bulkAdjustMutation = useMutation({
    mutationFn: async (percentage: number) => {
      const res = await fetch("/api/price-list-offers/bulk-adjust", {
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
      queryClient.invalidateQueries({ queryKey: ["/api/price-list-offers"] });
      toast({ title: "Ajuste Masivo", description: "Precios de ofertas actualizados correctamente" });
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
      const url = `/api/price-list-offers/export/excel${params.toString() ? '?' + params.toString() : ''}`;
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) throw new Error('Export failed');
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `lista_ofertas_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);
      toast({ title: "Exportación exitosa", description: "El archivo Excel se descargó correctamente" });
    } catch (err) {
      toast({ variant: "destructive", title: "Error", description: `No se pudo exportar la lista de ofertas` });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-2">
          {!vendorView && (<>
          <Button
            onClick={() => setIsAddOpen(true)}
            size="sm"
            className="flex items-center gap-1.5 text-xs bg-red-600 hover:bg-red-700 shadow-sm"
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
                <DialogTitle>Importar Lista de Ofertas</DialogTitle>
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
                    ✅ {importResult.importedCount} SKUs importados a ofertas
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

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
              <p className="text-muted-foreground">Cargando lista de ofertas...</p>
            </div>
          ) : error ? (
            <div className="text-center py-8 text-destructive">
              <AlertCircle className="h-8 w-8 mx-auto mb-2" />
              <p>Error al cargar la lista</p>
            </div>
          ) : !data?.items?.length ? (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-lg font-medium mb-2">Sin productos en oferta</p>
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
                    <TableHead className="text-xs">Clientes</TableHead>
                    <TableHead className="text-right text-xs font-semibold text-red-600 dark:text-red-400">
                      <span className="flex items-center justify-end gap-1"><Tag className="h-3 w-3" />Precio Oferta</span>
                    </TableHead>
                    {!vendorView && (<>
                    <TableHead className="text-right text-xs text-amber-700 dark:text-amber-400">Costo</TableHead>
                    <TableHead className="text-right text-xs">Margen</TableHead>
                    <TableHead className="text-right text-xs text-red-600 dark:text-red-400">
                      <span className="flex items-center justify-end gap-1"><Calculator className="h-3 w-3" />Simulador</span>
                    </TableHead>
                    <TableHead className="w-16 text-xs">Acc.</TableHead>
                    </>)}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((item) => {
                    const griEntry = item.codigo ? griPrices?.[item.codigo.toUpperCase()] : null;
                    const costoFromGri = griEntry?.price ? Number(griEntry.price) : null;
                    const costoFromList = item.costoProduccion ? Number(item.costoProduccion) : null;
                    const costoNum = costoFromGri || costoFromList;
                    const costoDate = griEntry?.date ?? null;
                    const precioNum = item.precio ? Number(item.precio) : null;
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
                      <TableRow key={item.id} className={`text-xs ${item.paused ? "opacity-50 bg-gray-50 dark:bg-gray-900/40" : ""}`}>
                        <TableCell className="font-mono text-xs py-2">{item.codigo}</TableCell>
                        <TableCell className="text-xs py-2 max-w-[250px] truncate">
                          {item.producto || <span className="text-muted-foreground italic">SKU no encontrado</span>}
                        </TableCell>
                        <TableCell className="text-xs py-2">{item.unidad || "-"}</TableCell>
                        <TableCell className="text-xs py-2">
                          {item.allClients ? (
                            <Badge variant="outline" className="text-[10px] gap-1 border-gray-300">
                              <Users className="h-2.5 w-2.5" />Todos
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-[10px] gap-1 border-red-300 text-red-700 dark:text-red-400"
                              title={(item.targetClients || []).map((c) => c.name).join(", ")}
                            >
                              <UserCheck className="h-2.5 w-2.5" />{item.clientCount} {item.clientCount === 1 ? "cliente" : "clientes"}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-xs py-2 font-semibold text-red-600 dark:text-red-400">
                          <div className="flex flex-col items-end gap-0.5">
                            {item.offerType === "pallet" ? (
                              <span className="inline-flex items-center gap-1">
                                <Badge variant="default" className="bg-blue-600 hover:bg-blue-700 text-[9px] px-1.5 py-0">PALLET</Badge>
                                <span>
                                  {item.unitsPerPallet ?? "?"}u × −{item.discountPct ?? "?"}%
                                </span>
                              </span>
                            ) : (
                              formatCurrency(item.precio)
                            )}
                            {item.paused && (
                              <span className="inline-flex items-center gap-0.5 text-[9px] font-medium text-gray-400 bg-gray-100 dark:bg-gray-800 rounded px-1 py-0.5">
                                <Pause className="h-2 w-2" />pausado
                              </span>
                            )}
                          </div>
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
                              className="h-6 w-20 text-[11px] text-right px-1.5 border-red-200 focus:border-red-400"
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
                              onClick={() => {
                                setEditItem(item);
                                setEditAllClients(item.allClients !== false);
                                setEditClients((item.targetClients || []).map((c) => ({ id: c.id, name: c.name || "Sin nombre", rut: c.rut })));
                                setEditUnitsPerPallet(item.unitsPerPallet != null ? String(item.unitsPerPallet) : "");
                                setEditDiscountPct(item.discountPct != null ? String(item.discountPct) : "");
                                setIsEditOpen(true);
                              }}
                              title="Editar oferta"
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className={`h-6 w-6 p-0 ${item.paused ? "text-amber-500 hover:text-amber-600" : "text-gray-400 hover:text-amber-500"}`}
                              onClick={() => pauseMutation.mutate({ id: item.id, paused: !item.paused })}
                              disabled={pauseMutation.isPending}
                              title={item.paused ? "Reactivar oferta" : "Pausar oferta"}
                            >
                              {item.paused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                              onClick={() => deleteMutation.mutate(item.id)}
                              disabled={deleteMutation.isPending}
                              title="Eliminar"
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

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Oferta</DialogTitle>
          </DialogHeader>
          {editItem && (
            <div className="space-y-3">
              <div className="p-3 bg-muted rounded-lg text-sm space-y-1">
                <div className="flex items-center gap-2">
                  <strong>SKU:</strong>
                  <span className="font-mono">{editItem.codigo}</span>
                  <Badge variant={editItem.offerType === "pallet" ? "default" : "outline"} className="text-[10px]">
                    {editItem.offerType === "pallet" ? "Pallet" : "Regular"}
                  </Badge>
                </div>
                <p><strong>Producto:</strong> {editItem.producto || "N/A"}</p>
              </div>

              {editItem.offerType === "regular" ? (
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Precio Oferta</label>
                  <Input
                    type="number"
                    value={editItem.precio || ""}
                    onChange={(e) => setEditItem({ ...editItem, precio: e.target.value })}
                    className="h-8 text-sm"
                  />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Unidades por pallet *</label>
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      value={editUnitsPerPallet}
                      onChange={(e) => setEditUnitsPerPallet(e.target.value)}
                      className="h-8 text-sm"
                      placeholder="144 / 36 / 24"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Descuento (%) *</label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={0.01}
                      value={editDiscountPct}
                      onChange={(e) => setEditDiscountPct(e.target.value)}
                      className="h-8 text-sm"
                      placeholder="0–100"
                    />
                  </div>
                </div>
              )}

              <AudienceSelector
                allClients={editAllClients}
                onAllClientsChange={setEditAllClients}
                selected={editClients}
                onSelectedChange={setEditClients}
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => {
                if (!editItem) return;
                const payload: any = {
                  id: editItem.id,
                  allClients: editAllClients,
                  clientIds: editAllClients ? [] : editClients.map((c) => c.id),
                };
                if (editItem.offerType === "regular") {
                  payload.precio = editItem.precio;
                } else {
                  const units = parseInt(editUnitsPerPallet, 10);
                  const pct = parseFloat(editDiscountPct);
                  if (!Number.isInteger(units) || units < 1) {
                    toast({ title: "Unidades inválidas", description: "Debe ser un entero ≥ 1", variant: "destructive" });
                    return;
                  }
                  if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
                    toast({ title: "Descuento inválido", description: "Debe estar entre 0 y 100", variant: "destructive" });
                    return;
                  }
                  payload.unitsPerPallet = units;
                  payload.discountPct = pct;
                }
                updateMutation.mutate(payload);
              }}
              disabled={updateMutation.isPending || (!editAllClients && editClients.length === 0)}
            >
              {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isAddOpen}
        onOpenChange={(o) => {
          setIsAddOpen(o);
          if (!o) {
            setNewProduct({ codigo: "", precio: "", unitsPerPallet: "", discountPct: "" });
            setNewOfferType("regular");
            setNewAllClients(true);
            setNewClients([]);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agregar Oferta</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {/* Tipo de oferta */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Tipo de oferta</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setNewOfferType("regular")}
                  className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                    newOfferType === "regular"
                      ? "bg-red-100 text-red-800 border-2 border-red-400 shadow-sm"
                      : "bg-gray-50 text-gray-500 border-2 border-gray-200 hover:bg-gray-100"
                  }`}
                >
                  <Tag className="h-3.5 w-3.5" />
                  Regular (precio fijo)
                </button>
                <button
                  type="button"
                  onClick={() => setNewOfferType("pallet")}
                  className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                    newOfferType === "pallet"
                      ? "bg-blue-100 text-blue-800 border-2 border-blue-400 shadow-sm"
                      : "bg-gray-50 text-gray-500 border-2 border-gray-200 hover:bg-gray-100"
                  }`}
                >
                  <Percent className="h-3.5 w-3.5" />
                  Pallet (% off)
                </button>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              {newOfferType === "regular"
                ? "Precio fijo que reemplaza el precio de lista del SKU."
                : "Habilita la venta por pallet con % de descuento. Reemplaza ofertas regulares al elegir el pallet completo."}
            </p>

            {/* Buscador SKU */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Producto (SKU) *</label>
              <SkuSearchCombobox
                value={newProduct.codigo}
                onChange={(codigo) => setNewProduct({ ...newProduct, codigo })}
                placeholder="Buscar por código o nombre…"
              />
            </div>

            {/* Campos condicionales por tipo */}
            {newOfferType === "regular" ? (
              <div>
                <label className="text-xs font-medium text-muted-foreground">Precio Oferta *</label>
                <Input
                  type="number"
                  value={newProduct.precio}
                  onChange={(e) => setNewProduct({ ...newProduct, precio: e.target.value })}
                  className="h-8 text-sm"
                  placeholder="Ej: 12500"
                />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Unidades por pallet *</label>
                  <Input
                    type="number"
                    min={1}
                    step={1}
                    value={newProduct.unitsPerPallet}
                    onChange={(e) => setNewProduct({ ...newProduct, unitsPerPallet: e.target.value })}
                    className="h-8 text-sm"
                    placeholder="144 / 36 / 24"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Descuento (%) *</label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step={0.01}
                    value={newProduct.discountPct}
                    onChange={(e) => setNewProduct({ ...newProduct, discountPct: e.target.value })}
                    className="h-8 text-sm"
                    placeholder="0–100"
                  />
                </div>
              </div>
            )}

            <AudienceSelector
              allClients={newAllClients}
              onAllClientsChange={setNewAllClients}
              selected={newClients}
              onSelectedChange={setNewClients}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => {
                const payload: any = {
                  codigo: newProduct.codigo,
                  offerType: newOfferType,
                  allClients: newAllClients,
                  clientIds: newAllClients ? [] : newClients.map((c) => c.id),
                };
                if (newOfferType === "regular") {
                  payload.precio = newProduct.precio;
                } else {
                  const units = parseInt(newProduct.unitsPerPallet, 10);
                  const pct = parseFloat(newProduct.discountPct);
                  if (!Number.isInteger(units) || units < 1) {
                    toast({ title: "Unidades inválidas", description: "Debe ser un entero ≥ 1", variant: "destructive" });
                    return;
                  }
                  if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
                    toast({ title: "Descuento inválido", description: "Debe estar entre 0 y 100", variant: "destructive" });
                    return;
                  }
                  payload.unitsPerPallet = units;
                  payload.discountPct = pct;
                }
                createMutation.mutate(payload);
              }}
              disabled={
                !newProduct.codigo ||
                (newOfferType === "regular" ? !newProduct.precio : (!newProduct.unitsPerPallet || !newProduct.discountPct)) ||
                (!newAllClients && newClients.length === 0) ||
                createMutation.isPending
              }
            >
              {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Agregar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isBulkAdjustOpen} onOpenChange={(open) => { setIsBulkAdjustOpen(open); if (!open) setBulkAdjustConfirm(false); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Percent className="h-5 w-5 text-red-600" />
              Ajuste Masivo de Precios (Ofertas)
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
                  {bulkAdjustDirection === 'up' ? '↑' : '↓'} Todos los precios de ofertas se {bulkAdjustDirection === 'up' ? 'multiplicarán' : 'reducirán'} por {(1 + (bulkAdjustDirection === 'up' ? 1 : -1) * parseFloat(bulkAdjustPercentage) / 100).toFixed(4)}x
                </p>
              )}
            </div>
            
            <p className="text-xs text-muted-foreground flex items-center gap-2 bg-slate-50 p-3 rounded-lg border border-slate-100">
              <AlertCircle className="h-4 w-4 text-blue-500 shrink-0" />
              Este ajuste se aplicará a todos los productos actualmente registrados en la Lista de Precios de Ofertas.
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
                      <>Se {bulkAdjustDirection === 'up' ? 'aumentarán' : 'disminuirán'} <strong>{bulkAdjustPercentage}%</strong> todos los precios de ofertas.</>
                    ) : (
                      <>Se redondearán a la decena todos los precios de ofertas.</>
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
