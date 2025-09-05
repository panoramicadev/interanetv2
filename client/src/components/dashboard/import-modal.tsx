import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, X } from "lucide-react";

interface ImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ImportModal({ open, onOpenChange }: ImportModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const importMutation = useMutation({
    mutationFn: async (csvData: any[]) => {
      await apiRequest("POST", "/api/sales/import", { transactions: csvData });
    },
    onSuccess: () => {
      toast({
        title: "Éxito",
        description: "Datos importados correctamente",
      });
      onOpenChange(false);
      setSelectedFile(null);
      // Invalidate all sales queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Error al importar los datos",
        variant: "destructive",
      });
    },
  });

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ';' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current.trim());
    return result;
  };

  const parseCSV = (csvText: string) => {
    const lines = csvText.split('\n').filter(line => line.trim());
    if (lines.length < 2) {
      throw new Error('CSV debe tener al menos una fila de encabezados y una fila de datos');
    }

    const headers = parseCSVLine(lines[0]);
    const transactions = [];

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      if (values.length === headers.length) {
        const transaction: any = {};
        
        headers.forEach((header, index) => {
          const value = values[index];
          const cleanHeader = header.toLowerCase().trim();
          
          // Map CSV headers to database fields
          switch (cleanHeader) {
            case 'idmaeedo':
              transaction.idmaeedo = value ? parseFloat(value.replace(',', '.')) : null;
              break;
            case 'nudo':
              transaction.nudo = value;
              break;
            case 'feemdo':
              transaction.feemdo = value ? new Date(value.split('-').reverse().join('-')).toISOString().split('T')[0] : null;
              break;
            case 'koprct':
              transaction.koprct = value;
              break;
            case 'nokoen':
              transaction.nokoen = value;
              break;
            case 'noruen':
              transaction.noruen = value;
              break;
            case 'nokoprct':
              transaction.nokoprct = value;
              break;
            case 'nokofu':
              transaction.nokofu = value;
              break;
            case 'caprad2':
              transaction.caprad2 = value ? parseFloat(value.replace(',', '.')) : null;
              break;
            case 'vabrdo':
              transaction.vabrdo = value ? parseFloat(value.replace(/\./g, '').replace(',', '.')) : null;
              break;
            // Add other fields as needed
            default:
              // Store other fields with their original names (converted to lowercase)
              if (value !== undefined && value !== '') {
                transaction[cleanHeader] = value;
              }
          }
        });
        
        transactions.push(transaction);
      }
    }

    return transactions;
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleImport = async () => {
    if (!selectedFile) {
      toast({
        title: "Error",
        description: "Por favor selecciona un archivo CSV",
        variant: "destructive",
      });
      return;
    }

    try {
      const csvText = await selectedFile.text();
      const parsedData = parseCSV(csvText);
      
      if (parsedData.length === 0) {
        toast({
          title: "Error",
          description: "El archivo CSV está vacío o no tiene datos válidos",
          variant: "destructive",
        });
        return;
      }

      importMutation.mutate(parsedData);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Error al procesar el archivo CSV",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            Importar Datos CSV
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
        
        <div className="space-y-4">
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
              <li>NUDO: Número de transacción</li>
              <li>FEEMDO: Fecha de emisión</li>
              <li>KOPRCT: SKU del producto</li>
              <li>NOKOEN: Nombre del cliente</li>
              <li>NORUEN: Segmento</li>
              <li>NOKOPRCT: Nombre del producto</li>
              <li>NOKOFU: Vendedor</li>
              <li>CAPRAD2: Unidades vendidas</li>
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
              onClick={handleImport}
              disabled={!selectedFile || importMutation.isPending}
              data-testid="button-import-csv"
            >
              {importMutation.isPending ? "Importando..." : "Importar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
