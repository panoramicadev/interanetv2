import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload, FileSpreadsheet, Users, Package, DollarSign, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ImportResult {
  success: boolean;
  message: string;
  recordsImported?: number;
  errors?: string[];
}

export default function ImportarDatos() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [importResults, setImportResults] = useState<Record<string, ImportResult>>({});

  const importVentasMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch('/api/sales/import', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al importar ventas');
      }
      return response.json();
    },
    onSuccess: (data) => {
      setImportResults(prev => ({ ...prev, ventas: { success: true, message: 'Ventas importadas correctamente', recordsImported: data.count } }));
      queryClient.invalidateQueries({ queryKey: ['/api/sales'] });
      toast({ title: "Ventas importadas correctamente" });
    },
    onError: (error: Error) => {
      setImportResults(prev => ({ ...prev, ventas: { success: false, message: error.message } }));
      toast({ title: "Error al importar ventas", description: error.message, variant: "destructive" });
    }
  });

  const importClientesMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch('/api/clients/import', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al importar clientes');
      }
      return response.json();
    },
    onSuccess: (data) => {
      setImportResults(prev => ({ ...prev, clientes: { success: true, message: 'Clientes importados correctamente', recordsImported: data.count } }));
      queryClient.invalidateQueries({ queryKey: ['/api/clients'] });
      toast({ title: "Clientes importados correctamente" });
    },
    onError: (error: Error) => {
      setImportResults(prev => ({ ...prev, clientes: { success: false, message: error.message } }));
      toast({ title: "Error al importar clientes", description: error.message, variant: "destructive" });
    }
  });

  const importProductosMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch('/api/products/import', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al importar productos');
      }
      return response.json();
    },
    onSuccess: (data) => {
      setImportResults(prev => ({ ...prev, productos: { success: true, message: 'Productos importados correctamente', recordsImported: data.count } }));
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      toast({ title: "Productos importados correctamente" });
    },
    onError: (error: Error) => {
      setImportResults(prev => ({ ...prev, productos: { success: false, message: error.message } }));
      toast({ title: "Error al importar productos", description: error.message, variant: "destructive" });
    }
  });

  const importPreciosMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch('/api/price-list/import', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al importar lista de precios');
      }
      return response.json();
    },
    onSuccess: (data) => {
      setImportResults(prev => ({ ...prev, precios: { success: true, message: 'Lista de precios importada correctamente', recordsImported: data.count } }));
      queryClient.invalidateQueries({ queryKey: ['/api/price-list'] });
      toast({ title: "Lista de precios importada correctamente" });
    },
    onError: (error: Error) => {
      setImportResults(prev => ({ ...prev, precios: { success: false, message: error.message } }));
      toast({ title: "Error al importar lista de precios", description: error.message, variant: "destructive" });
    }
  });

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>, type: string) => {
    const file = event.target.files?.[0];
    if (!file) return;

    switch (type) {
      case 'ventas':
        importVentasMutation.mutate(file);
        break;
      case 'clientes':
        importClientesMutation.mutate(file);
        break;
      case 'productos':
        importProductosMutation.mutate(file);
        break;
      case 'precios':
        importPreciosMutation.mutate(file);
        break;
    }
    event.target.value = '';
  };

  const importOptions = [
    {
      id: 'ventas',
      title: 'Ventas',
      description: 'Importar transacciones de ventas desde archivo CSV',
      icon: FileSpreadsheet,
      mutation: importVentasMutation,
      color: 'text-green-600',
      bgColor: 'bg-green-100 dark:bg-green-900/30',
    },
    {
      id: 'clientes',
      title: 'Clientes',
      description: 'Importar base de datos de clientes desde archivo CSV',
      icon: Users,
      mutation: importClientesMutation,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    },
    {
      id: 'productos',
      title: 'Productos',
      description: 'Importar catálogo de productos desde archivo CSV',
      icon: Package,
      mutation: importProductosMutation,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100 dark:bg-purple-900/30',
    },
    {
      id: 'precios',
      title: 'Lista de Precios',
      description: 'Importar lista de precios desde archivo CSV',
      icon: DollarSign,
      mutation: importPreciosMutation,
      color: 'text-amber-600',
      bgColor: 'bg-amber-100 dark:bg-amber-900/30',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {importOptions.map((option) => {
          const Icon = option.icon;
          const result = importResults[option.id];
          const isPending = option.mutation.isPending;

          return (
            <Card key={option.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-lg ${option.bgColor}`}>
                    <Icon className={`h-6 w-6 ${option.color}`} />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{option.title}</CardTitle>
                    <CardDescription>{option.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <input
                    type="file"
                    accept=".csv"
                    onChange={(e) => handleFileChange(e, option.id)}
                    className="hidden"
                    id={`import-${option.id}`}
                    disabled={isPending}
                  />
                  <label htmlFor={`import-${option.id}`}>
                    <Button 
                      variant="outline" 
                      className="w-full cursor-pointer" 
                      disabled={isPending}
                      asChild
                    >
                      <span>
                        {isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Importando...
                          </>
                        ) : (
                          <>
                            <Upload className="mr-2 h-4 w-4" />
                            Seleccionar archivo CSV
                          </>
                        )}
                      </span>
                    </Button>
                  </label>

                  {result && (
                    <Alert variant={result.success ? "default" : "destructive"}>
                      {result.success ? (
                        <CheckCircle className="h-4 w-4" />
                      ) : (
                        <AlertCircle className="h-4 w-4" />
                      )}
                      <AlertDescription>
                        {result.message}
                        {result.recordsImported && (
                          <span className="font-medium"> ({result.recordsImported} registros)</span>
                        )}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Formato de archivos CSV</CardTitle>
          <CardDescription>
            Asegúrate de que tus archivos CSV cumplan con el formato esperado
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 text-sm">
            <div>
              <h4 className="font-medium mb-1">Ventas</h4>
              <p className="text-muted-foreground">
                Columnas: fecha, cliente, producto, cantidad, monto, vendedor
              </p>
            </div>
            <div>
              <h4 className="font-medium mb-1">Clientes</h4>
              <p className="text-muted-foreground">
                Columnas: código, nombre, rut, dirección, teléfono, email, segmento
              </p>
            </div>
            <div>
              <h4 className="font-medium mb-1">Productos</h4>
              <p className="text-muted-foreground">
                Columnas: código, nombre, descripción, precio, categoría, stock
              </p>
            </div>
            <div>
              <h4 className="font-medium mb-1">Lista de Precios</h4>
              <p className="text-muted-foreground">
                Columnas: código, descripción, unidad, precio, precio_alternativo
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
