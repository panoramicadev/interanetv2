import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileText, CheckCircle, AlertCircle, X } from "lucide-react";
import Papa from "papaparse";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { NvvImportResult } from "@shared/schema";

interface CsvImportProps {
  onImportComplete?: (result: NvvImportResult) => void;
}

interface CsvPreviewData {
  headers: string[];
  rows: Record<string, any>[];
  totalRows: number;
}

export function CsvImport({ onImportComplete }: CsvImportProps) {
  const [file, setFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<CsvPreviewData | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [importResult, setImportResult] = useState<NvvImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.toLowerCase().endsWith('.csv')) {
      toast({
        title: "Archivo inválido",
        description: "Por favor selecciona un archivo CSV válido.",
        variant: "destructive",
      });
      return;
    }

    setFile(selectedFile);
    setImportResult(null);
    
    // Parse CSV for preview
    Papa.parse(selectedFile, {
      header: true,
      skipEmptyLines: true,
      encoding: "UTF-8",
      complete: (results) => {
        if (results.errors.length > 0) {
          toast({
            title: "Error al leer CSV",
            description: "El archivo CSV contiene errores de formato.",
            variant: "destructive",
          });
          return;
        }

        const headers = results.meta.fields || [];
        const rows = results.data as Record<string, any>[];
        
        setCsvData({
          headers,
          rows: rows.slice(0, 5), // Preview first 5 rows
          totalRows: rows.length,
        });
      },
      error: (error) => {
        console.error("CSV parse error:", error);
        toast({
          title: "Error al procesar CSV",
          description: "No se pudo procesar el archivo CSV.",
          variant: "destructive",
        });
      }
    });
  };

  const handleImport = async () => {
    if (!file || !csvData) return;

    setUploading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append('file', file);

      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      const response = await fetch('/api/nvv/import', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result: NvvImportResult = await response.json();

      clearInterval(progressInterval);
      setUploadProgress(100);

      setImportResult(result);
      
      if (result.success) {
        toast({
          title: "Importación exitosa",
          description: `Se importaron ${result.successfulImports} de ${result.totalRows} registros.`,
        });
        
        // Clear the form after successful import
        setFile(null);
        setCsvData(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        
        // Invalidate queries to refresh data
        queryClient.invalidateQueries({ queryKey: ['/api/nvv'] });
        
        onImportComplete?.(result);
      } else {
        toast({
          title: "Importación con errores",
          description: `${result.errors.length} errores encontrados durante la importación.`,
          variant: "destructive",
        });
      }

    } catch (error) {
      console.error("Import error:", error);
      toast({
        title: "Error de importación",
        description: "Ocurrió un error durante la importación del archivo.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const clearFile = () => {
    setFile(null);
    setCsvData(null);
    setImportResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
            <Upload className="h-5 w-5 text-blue-600" />
          </div>
          <CardTitle className="text-xl font-bold text-gray-900">
            Importar Notas de Ventas Pendientes
          </CardTitle>
        </div>
        <p className="text-sm text-gray-600">
          Carga archivos CSV con datos de pedidos comprometidos y notas de ventas pendientes
        </p>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* File Upload Section */}
        <div className="space-y-4">
          <Label htmlFor="csv-file" className="text-sm font-medium">
            Seleccionar archivo CSV
          </Label>
          <div className="flex items-center space-x-3">
            <Input
              id="csv-file"
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              disabled={uploading}
              className="flex-1"
              data-testid="input-csv-file"
            />
            {file && (
              <Button
                variant="outline"
                size="sm"
                onClick={clearFile}
                disabled={uploading}
                data-testid="button-clear-file"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* File Preview */}
        {csvData && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-gray-900">Vista previa del archivo</h3>
              <Badge variant="secondary" data-testid="badge-total-rows">
                {csvData.totalRows} registros
              </Badge>
            </div>
            
            <div className="border rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      {csvData.headers.map((header, index) => (
                        <th key={index} className="px-3 py-2 text-left font-medium text-gray-900 border-b">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {csvData.rows.map((row, index) => (
                      <tr key={index} className="border-b border-gray-100">
                        {csvData.headers.map((header, cellIndex) => (
                          <td key={cellIndex} className="px-3 py-2 text-gray-700">
                            {String(row[header] || '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {csvData.totalRows > 5 && (
              <p className="text-xs text-gray-500 text-center">
                Mostrando las primeras 5 filas de {csvData.totalRows} registros
              </p>
            )}
          </div>
        )}

        {/* Upload Progress */}
        {uploading && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Importando datos...</span>
              <span className="text-gray-600">{uploadProgress}%</span>
            </div>
            <Progress value={uploadProgress} className="h-2" />
          </div>
        )}

        {/* Import Results */}
        {importResult && (
          <div className="space-y-4">
            <Alert className={importResult.success ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}>
              <div className="flex items-center space-x-2">
                {importResult.success ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-red-600" />
                )}
                <AlertDescription className={importResult.success ? "text-green-800" : "text-red-800"}>
                  <div className="space-y-1">
                    <p className="font-medium">
                      {importResult.success 
                        ? `Importación completada exitosamente` 
                        : `Importación completada con errores`}
                    </p>
                    <p className="text-sm">
                      {importResult.successfulImports} de {importResult.totalRows} registros importados
                    </p>
                    {importResult.errors.length > 0 && (
                      <p className="text-sm">
                        {importResult.errors.length} errores encontrados
                      </p>
                    )}
                  </div>
                </AlertDescription>
              </div>
            </Alert>

            {/* Error Details */}
            {importResult.errors.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium text-gray-900">Errores de importación:</h4>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {importResult.errors.slice(0, 10).map((error, index) => (
                    <div key={index} className="text-sm text-red-600 bg-red-50 p-2 rounded">
                      Fila {error.row}: {error.message}
                    </div>
                  ))}
                  {importResult.errors.length > 10 && (
                    <p className="text-xs text-gray-500">
                      Y {importResult.errors.length - 10} errores más...
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end space-x-3">
          {file && !uploading && !importResult && (
            <Button 
              onClick={handleImport}
              disabled={!csvData}
              className="bg-blue-600 hover:bg-blue-700"
              data-testid="button-import"
            >
              <FileText className="h-4 w-4 mr-2" />
              Importar Datos
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}