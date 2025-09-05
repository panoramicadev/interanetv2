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

  const parseNumber = (value: string): string | null => {
    if (!value || value.trim() === '') return null;
    // Remove thousands separators and replace comma with dot, return as string
    const cleanValue = value.replace(/\./g, '').replace(',', '.');
    const parsed = parseFloat(cleanValue);
    return isNaN(parsed) ? null : cleanValue;
  };

  const parseDate = (value: string): string | null => {
    if (!value || value.trim() === '') return null;
    try {
      // Format DD-MM-YYYY from CSV
      const parts = value.split('-');
      if (parts.length === 3) {
        const day = parseInt(parts[0]);
        const month = parseInt(parts[1]);
        const year = parseInt(parts[2]);
        
        if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1900) {
          // Convert to YYYY-MM-DD format for database
          const formattedMonth = month.toString().padStart(2, '0');
          const formattedDay = day.toString().padStart(2, '0');
          return `${year}-${formattedMonth}-${formattedDay}`;
        }
      }
    } catch (e) {
      console.warn('Invalid date format:', value);
    }
    return null;
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
          
          // Map CSV headers to database fields - EXACT type conversion per schema
          if (value && value.trim() !== '') {
            switch (cleanHeader) {
              // Required string fields
              case 'nudo':
                transaction.nudo = value.toString();
                break;
              
              // Required date fields  
              case 'feemdo':
                transaction.feemdo = parseDate(value);
                break;
                
              // Optional string fields (varchar/text)
              case 'koprct':
              case 'nokoen':
              case 'noruen':
              case 'nokoprct':
              case 'nokofu':
              case 'tido':
              case 'endo':
              case 'suendo':
              case 'sudo':
              case 'kofudo':
              case 'modo':
              case 'timodo':
              case 'lilg':
              case 'nulido':
              case 'sulido':
              case 'bosulido':
              case 'kofulido':
              case 'prct':
              case 'tict':
              case 'tipr':
              case 'nusepr':
              case 'ud01pr':
              case 'ud02pr':
              case 'eslido':
              case 'fmpr':
              case 'mrpr':
              case 'zona':
              case 'ruen':
              case 'pfpr':
              case 'hfpr':
              case 'ocdo':
              case 'nofmpr':
              case 'nopfpr':
              case 'nohfpr':
              case 'listacost':
                transaction[cleanHeader] = value.toString();
                break;
                
              // Optional date fields
              case 'feulvedo':
              case 'feemli':
              case 'feerli':
                transaction[cleanHeader] = parseDate(value);
                break;
                
              // Integer field
              case 'luvtlido':
                const intVal = parseInt(value);
                transaction.luvtlido = isNaN(intVal) ? null : intVal;
                break;
                
              // Numeric fields (all others)
              case 'idmaeedo':
              case 'tamodo':
              case 'caprad':
              case 'caprex':
              case 'vanedo':
              case 'vaivdo':
              case 'vabrdo':
              case 'udtrpr':
              case 'rludpr':
              case 'caprco1':
              case 'caprad1':
              case 'caprex1':
              case 'caprnc1':
              case 'caprco2':
              case 'caprad2':
              case 'caprex2':
              case 'caprnc2':
              case 'ppprne':
              case 'ppprbr':
              case 'vaneli':
              case 'vabrli':
              case 'ppprpm':
              case 'ppprpmifrs':
              case 'logistica':
              case 'ppprnere1':
              case 'ppprnere2':
              case 'idmaeddo':
              case 'recaprre':
              case 'monto':
              case 'devol1':
              case 'devol2':
              case 'stockfis':
              case 'liscosmod':
                transaction[cleanHeader] = parseNumber(value);
                break;
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
