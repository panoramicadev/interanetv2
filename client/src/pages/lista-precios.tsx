import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { DollarSign, Upload, Download, Search, Plus, Edit, Trash2, FileText, AlertCircle } from "lucide-react";
import { PriceList } from "@shared/schema";

interface PriceListResponse {
  items: PriceList[];
  totalCount: number;
  hasMore: boolean;
}

export default function ListaPrecios() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const itemsPerPage = 50;

  // Query para obtener lista de precios
  const { data, isLoading, error } = useQuery<PriceListResponse>({
    queryKey: ['/api/price-list', { search, limit: itemsPerPage, offset: page * itemsPerPage }],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/price-list?search=${encodeURIComponent(search)}&limit=${itemsPerPage}&offset=${page * itemsPerPage}`);
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <DollarSign className="h-8 w-8 text-primary" />
            Lista de Precios
          </h1>
          <p className="text-muted-foreground mt-2">
            Gestión y consulta de precios comerciales
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" className="flex items-center gap-2" disabled>
            <Download className="h-4 w-4" />
            Exportar
          </Button>
          <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2" data-testid="button-import-csv">
                <Upload className="h-4 w-4" />
                Importar CSV
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

      {/* Search */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-4 items-center">
            <div className="relative flex-1">
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
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {data && (
                <span data-testid="text-total-count">
                  {data.totalCount} elementos total
                </span>
              )}
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
                    <TableHead>Unidad</TableHead>
                    <TableHead className="text-right">Lista</TableHead>
                    <TableHead className="text-right">Desc10</TableHead>
                    <TableHead className="text-right">Desc10+5</TableHead>
                    <TableHead className="text-right">Mínimo</TableHead>
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
                      <TableCell>
                        <div className="flex gap-1">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="h-8 w-8 p-0"
                            disabled
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
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    Mostrando {page * itemsPerPage + 1}-{Math.min((page + 1) * itemsPerPage, data.totalCount)} de {data.totalCount}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(page - 1)}
                      disabled={page === 0}
                      data-testid="button-prev-page"
                    >
                      Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
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
    </div>
  );
}