import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { DollarSign, Upload, Download, Search, Plus, Edit, Trash2, FileText, AlertCircle, Loader2 } from "lucide-react";
import { PriceList } from "@shared/schema";

interface PriceListResponse {
  items: PriceList[];
  totalCount: number;
  hasMore: boolean;
}

export default function ListaPrecios() {
  const [search, setSearch] = useState("");
  const [selectedUnidad, setSelectedUnidad] = useState<string>("");
  const [selectedColor, setSelectedColor] = useState<string>("");
  const [page, setPage] = useState(0);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<any>(null);
  const [editItem, setEditItem] = useState<PriceList | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
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
    consumoEstimado: "",
    rendimiento: "",
    costoUnidadMedida: "",
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const itemsPerPage = 50;

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
        params.set('unidad', selectedUnidad);
      }
      if (selectedColor) {
        params.set('color', selectedColor);
      }
      const response = await apiRequest('GET', `/api/price-list?${params}`);
      return response.json();
    },
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
        consumoEstimado: "",
        rendimiento: "",
        costoUnidadMedida: "",
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

  const handleCreateProduct = () => {
    const data: any = {
      codigo: newProduct.codigo || null,
      producto: newProduct.producto,
      unidad: newProduct.unidad || null,
      color: newProduct.color || null,
      lista: newProduct.lista ? parseFloat(newProduct.lista) : null,
      desc10: newProduct.desc10 ? parseFloat(newProduct.desc10) : null,
      desc10_5: newProduct.desc10_5 ? parseFloat(newProduct.desc10_5) : null,
      minimo: newProduct.minimo ? parseFloat(newProduct.minimo) : null,
      costoProduccion: newProduct.costoProduccion ? parseFloat(newProduct.costoProduccion) : null,
      cantidadProducto: newProduct.cantidadProducto ? parseFloat(newProduct.cantidadProducto) : null,
      unidadMedida: newProduct.unidadMedida || null,
      consumoEstimado: newProduct.consumoEstimado ? parseFloat(newProduct.consumoEstimado) : null,
      rendimiento: newProduct.rendimiento ? parseFloat(newProduct.rendimiento) : null,
      costoUnidadMedida: newProduct.costoUnidadMedida ? parseFloat(newProduct.costoUnidadMedida) : null,
    };
    createMutation.mutate(data);
  };

  const handleEdit = (item: PriceList) => {
    setEditItem({ ...item });
    setIsEditDialogOpen(true);
  };

  const handleSaveEdit = () => {
    if (!editItem) return;
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
        consumoEstimado: (editItem as any).consumoEstimado,
        rendimiento: (editItem as any).rendimiento,
        costoUnidadMedida: (editItem as any).costoUnidadMedida,
      }
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
    return isNaN(num) ? '-' : `$${num.toLocaleString('es-CL')}`;
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold text-foreground flex items-center gap-2">
            <DollarSign className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
            Lista de Precios
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base mt-1 sm:mt-2">
            Gestión y consulta de precios comerciales
          </p>
        </div>
        
        <div className="flex gap-2 self-start sm:self-auto">
          <Button 
            onClick={() => setIsAddDialogOpen(true)}
            size="sm" 
            className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm bg-green-600 hover:bg-green-700" 
            data-testid="button-add-product"
          >
            <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Agregar Producto</span>
            <span className="sm:hidden">Agregar</span>
          </Button>
          <Button variant="outline" size="sm" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm" disabled>
            <Download className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Exportar</span>
          </Button>
          <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm" data-testid="button-import-csv">
                <Upload className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Importar CSV</span>
                <span className="sm:hidden">Importar</span>
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
        </div>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Buscar por código o producto..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0); // Reset to first page when searching
                }}
                className="pl-10"
                data-testid="input-search"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="filter-unidad">Filtrar por formato</Label>
                <Select
                  value={selectedUnidad}
                  onValueChange={(value) => {
                    setSelectedUnidad(value === "all" ? "" : value);
                    setPage(0); // Reset to first page when filtering
                  }}
                >
                  <SelectTrigger data-testid="select-unit-filter">
                    <SelectValue placeholder="Todos los formatos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los formatos</SelectItem>
                    {availableUnits.map((unit) => (
                      <SelectItem key={unit} value={unit}>
                        {unit}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="filter-color">Filtrar por color</Label>
                <Select
                  value={selectedColor}
                  onValueChange={(value) => {
                    setSelectedColor(value === "all" ? "" : value);
                    setPage(0); // Reset to first page when filtering
                  }}
                >
                  <SelectTrigger data-testid="select-color-filter">
                    <SelectValue placeholder="Todos los colores" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los colores</SelectItem>
                    {availableColors.map((color) => (
                      <SelectItem key={color} value={color}>
                        {color}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  {data && (
                    <span data-testid="text-total-count">
                      {data.totalCount} elementos total
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Precios</CardTitle>
        </CardHeader>
        <CardContent>
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
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Producto</TableHead>
                    <TableHead>Formato</TableHead>
                    <TableHead className="text-right">Lista</TableHead>
                    <TableHead className="text-right">Desc10</TableHead>
                    <TableHead className="text-right">Desc10+5</TableHead>
                    <TableHead className="text-right">Mínimo</TableHead>
                    <TableHead className="text-right">PPP</TableHead>
                    <TableHead className="text-right">Costo Prod.</TableHead>
                    <TableHead className="w-24">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((item) => (
                    <TableRow key={item.id} data-testid={`row-price-${item.id}`}>
                      <TableCell className="font-mono text-sm" data-testid={`text-codigo-${item.id}`}>
                        {item.codigo}
                      </TableCell>
                      <TableCell data-testid={`text-producto-${item.id}`}>
                        {item.producto}
                      </TableCell>
                      <TableCell data-testid={`text-unidad-${item.id}`}>
                        {item.unidad || '-'}
                      </TableCell>
                      <TableCell className="text-right" data-testid={`text-lista-${item.id}`}>
                        {formatCurrency(item.lista)}
                      </TableCell>
                      <TableCell className="text-right" data-testid={`text-desc10-${item.id}`}>
                        {formatCurrency(item.desc10)}
                      </TableCell>
                      <TableCell className="text-right" data-testid={`text-desc10-5-${item.id}`}>
                        {formatCurrency(item.desc10_5)}
                      </TableCell>
                      <TableCell className="text-right" data-testid={`text-minimo-${item.id}`}>
                        {formatCurrency(item.minimo)}
                      </TableCell>
                      <TableCell className="text-right font-medium text-primary" data-testid={`text-ppp-${item.id}`}>
                        {(item as any).precioPromedioPonderado ? formatCurrency((item as any).precioPromedioPonderado) : '-'}
                      </TableCell>
                      <TableCell className="text-right" data-testid={`text-costo-${item.id}`}>
                        {(item as any).costoProduccion ? formatCurrency((item as any).costoProduccion) : '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => handleEdit(item)}
                            data-testid={`button-edit-${item.id}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                            onClick={() => deleteMutation.mutate(item.id)}
                            disabled={deleteMutation.isPending}
                            data-testid={`button-delete-${item.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
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
                    value={editItem.lista || ''}
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
                    value={editItem.desc10 || ''}
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
                    value={editItem.desc10_5 || ''}
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
                    value={editItem.minimo || ''}
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
                    value={(editItem as any).costoProduccion || ''}
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
                    value={(editItem as any).cantidadProducto || ''}
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

                {/* Consumo Estimado */}
                <div className="flex items-center py-2 border-b">
                  <Label className="text-sm font-medium w-1/2">Consumo Estimado</Label>
                  <Input
                    id="edit-consumo"
                    type="number"
                    step="0.0001"
                    className="w-1/2 text-right"
                    value={(editItem as any).consumoEstimado || ''}
                    onChange={(e) => setEditItem({ ...editItem, consumoEstimado: e.target.value ? parseFloat(e.target.value) : null } as any)}
                    data-testid="input-edit-consumo"
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
                    value={(editItem as any).rendimiento || ''}
                    onChange={(e) => setEditItem({ ...editItem, rendimiento: e.target.value ? parseFloat(e.target.value) : null } as any)}
                    data-testid="input-edit-rendimiento"
                  />
                </div>

                {/* Costo por Unidad de Medida */}
                <div className="flex items-center py-2">
                  <Label className="text-sm font-medium w-1/2">Costo/Unidad Medida</Label>
                  <Input
                    id="edit-costo-unidad"
                    type="number"
                    className="w-1/2 text-right"
                    value={(editItem as any).costoUnidadMedida || ''}
                    onChange={(e) => setEditItem({ ...editItem, costoUnidadMedida: e.target.value ? parseFloat(e.target.value) : null } as any)}
                    data-testid="input-edit-costo-unidad"
                  />
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsEditDialogOpen(false);
                setEditItem(null);
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

            {/* Consumo Estimado */}
            <div className="flex items-center py-2 border-b">
              <Label className="text-sm font-medium w-1/2">Consumo Estimado</Label>
              <Input
                type="number"
                step="0.0001"
                className="w-1/2 text-right"
                value={newProduct.consumoEstimado}
                onChange={(e) => setNewProduct({ ...newProduct, consumoEstimado: e.target.value })}
                data-testid="input-add-consumo"
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

            {/* Costo por Unidad de Medida */}
            <div className="flex items-center py-2">
              <Label className="text-sm font-medium w-1/2">Costo/Unidad Medida</Label>
              <Input
                type="number"
                className="w-1/2 text-right"
                value={newProduct.costoUnidadMedida}
                onChange={(e) => setNewProduct({ ...newProduct, costoUnidadMedida: e.target.value })}
                data-testid="input-add-costo-unidad"
              />
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
    </div>
  );
}