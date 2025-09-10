import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useLocation } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, X, Download, AlertTriangle, Calendar, Database, FileText } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface PreviewData {
  totalTransactions: number;
  dateRange: {
    start: string;
    end: string;
  };
  monthsAffected: string[];
  existingTransactions: number;
  wouldDelete: number;
  wouldInsert: number;
}

export default function ImportModal({ open, onOpenChange }: ImportModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  // Preview mutation - analyzes CSV without importing
  const previewMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/sales/preview', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to preview CSV');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      setPreviewData(data.preview);
      setShowPreview(true);
    },
    onError: (error) => {
      if (error.message.includes('401')) {
        toast({
          title: "No autorizado",
          description: "Tu sesión ha expirado. Iniciando sesión...",
          variant: "destructive",
        });
        setTimeout(() => {
          setLocation("/login");
        }, 500);
        return;
      }
      toast({
        title: "Error de análisis",
        description: error instanceof Error ? error.message : "Error al analizar el archivo CSV",
        variant: "destructive",
      });
    },
  });

  // Replace import mutation - performs atomic delete + insert
  const replaceMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('confirmed', 'true');
      
      const response = await fetch('/api/sales/import-replace', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to import CSV');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "¡Importación exitosa!",
        description: `Se eliminaron ${data.deleted} registros y se importaron ${data.inserted} nuevos`,
      });
      onOpenChange(false);
      resetState();
      // Invalidate all sales queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
    },
    onError: (error) => {
      if (error.message.includes('401')) {
        toast({
          title: "No autorizado",
          description: "Tu sesión ha expirado. Iniciando sesión...",
          variant: "destructive",
        });
        setTimeout(() => {
          setLocation("/login");
        }, 500);
        return;
      }
      toast({
        title: "Error de importación",
        description: error instanceof Error ? error.message : "Error al importar los datos",
        variant: "destructive",
      });
    },
  });

  const resetState = () => {
    setSelectedFile(null);
    setPreviewData(null);
    setShowPreview(false);
  };

  const formatDate = (dateStr: string) => {
    // Handle YYYY-MM-DD format from backend
    console.log('🗓️ Formatting date:', dateStr);
    const date = new Date(dateStr + 'T00:00:00'); // Add time to avoid timezone issues
    const formatted = date.toLocaleDateString('es-CL', {
      year: 'numeric',
      month: 'long', 
      day: 'numeric'
    });
    console.log('📅 Formatted result:', formatted);
    return formatted;
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('es-CL').format(num);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleAnalyze = () => {
    if (!selectedFile) {
      toast({
        title: "Error",
        description: "Por favor selecciona un archivo CSV",
        variant: "destructive",
      });
      return;
    }

    previewMutation.mutate(selectedFile);
  };

  const handleConfirmImport = () => {
    if (!selectedFile) return;
    replaceMutation.mutate(selectedFile);
  };

  const handleBackToSelection = () => {
    setShowPreview(false);
    setPreviewData(null);
  };

  const handleDownloadTemplate = () => {
    // Create download link to the template endpoint
    const downloadUrl = '/api/sales/template';
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = 'template-ventas.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      if (!newOpen) {
        resetState();
      }
      onOpenChange(newOpen);
    }}>
      <DialogContent className={showPreview ? "sm:max-w-2xl" : "sm:max-w-md"}>
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            {showPreview ? "Confirmar Importación" : "Importar Datos CSV"}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              data-testid="button-close-modal"
            >
              <X className="w-4 h-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>
        
        {!showPreview ? (
          // File Selection Screen
          <div className="space-y-4">
            <div className="flex justify-center">
              <Button
                variant="outline"
                onClick={handleDownloadTemplate}
                className="flex items-center gap-2"
                data-testid="button-download-template"
              >
                <Download className="w-4 h-4" />
                Descargar Ejemplo CSV
              </Button>
            </div>
            <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
              <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-sm text-muted-foreground mb-2">
                {selectedFile ? selectedFile.name : "Selecciona tu archivo CSV"}
              </p>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
                id="csvFile"
                data-testid="input-csv-file"
              />
              <label htmlFor="csvFile">
                <Button variant="outline" className="cursor-pointer" asChild>
                  <span>Seleccionar archivo</span>
                </Button>
              </label>
            </div>
            
            <div className="text-xs text-muted-foreground">
              <p className="font-medium">Formato esperado:</p>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li>IDMAEEDO: Identificador de transacción</li>
                <li>NUDO: Número de transacción</li>
                <li>FEEMDO: Fecha de emisión</li>
                <li>TIDO: Tipo de documento (FCV/FVL/NCV)</li>
                <li>KOPRCT: SKU del producto</li>
                <li>NOKOEN: Nombre del cliente</li>
                <li>NORUEN: Segmento</li>
                <li>NOKOPRCT: Nombre del producto</li>
                <li>NOKOFU: Vendedor</li>
                <li>CAPRCO2: Unidades vendidas</li>
              </ul>
            </div>
            
            <div className="flex space-x-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel-import"
              >
                Cancelar
              </Button>
              <Button
                className="flex-1"
                onClick={handleAnalyze}
                disabled={!selectedFile || previewMutation.isPending}
                data-testid="button-analyze-csv"
              >
                {previewMutation.isPending ? "Analizando..." : "Analizar"}
              </Button>
            </div>
          </div>
        ) : (
          // Preview Confirmation Screen  
          <div className="space-y-6">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Operación de reemplazo:</strong> Se eliminarán los datos existentes en el rango de fechas detectado y se importarán los nuevos datos.
              </AlertDescription>
            </Alert>
            
            {previewData && (
              <div className="grid gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-muted/50 p-4 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Calendar className="h-4 w-4 text-blue-500" />
                      <span className="font-medium">Período detectado</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(previewData.dateRange.start)} - {formatDate(previewData.dateRange.end)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Meses: {previewData.monthsAffected.join(', ')}
                    </p>
                  </div>
                  
                  <div className="bg-muted/50 p-4 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="h-4 w-4 text-green-500" />
                      <span className="font-medium">Nuevos datos</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {formatNumber(previewData.totalTransactions)} transacciones
                    </p>
                  </div>
                </div>
                
                <div className="bg-red-50 dark:bg-red-950/20 p-4 rounded-lg border border-red-200 dark:border-red-800">
                  <div className="flex items-center gap-2 mb-2">
                    <Database className="h-4 w-4 text-red-500" />
                    <span className="font-medium text-red-700 dark:text-red-300">Datos que serán eliminados</span>
                  </div>
                  <p className="text-sm text-red-600 dark:text-red-400">
                    {formatNumber(previewData.existingTransactions)} transacciones existentes en el período
                  </p>
                </div>
                
                <div className="bg-green-50 dark:bg-green-950/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
                  <div className="flex items-center gap-2 mb-2">
                    <Upload className="h-4 w-4 text-green-500" />
                    <span className="font-medium text-green-700 dark:text-green-300">Resultado final</span>
                  </div>
                  <p className="text-sm text-green-600 dark:text-green-400">
                    Se eliminarán {formatNumber(previewData.wouldDelete)} y se insertarán {formatNumber(previewData.wouldInsert)} transacciones
                  </p>
                </div>
              </div>
            )}
            
            <div className="flex space-x-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleBackToSelection}
                disabled={replaceMutation.isPending}
                data-testid="button-back-selection"
              >
                Volver
              </Button>
              <Button
                className="flex-1"
                onClick={handleConfirmImport}
                disabled={replaceMutation.isPending}
                data-testid="button-confirm-import"
              >
                {replaceMutation.isPending ? "Importando..." : "Confirmar Importación"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
