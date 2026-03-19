import { useState, useRef, useCallback, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Upload,
  FileArchive,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  ImageIcon,
  X,
} from "lucide-react";

interface JobStatus {
  jobId: string;
  status: string;
  fileName: string;
  totalFiles: number;
  processedFiles: number;
  successfulFiles: number;
  failedFiles: number;
  isCompleted: boolean;
  progressData?: {
    phase: string;
    currentBatch: number;
    totalBatches: number;
    currentFile: string;
  };
  resultData?: {
    results: Array<{
      fileName: string;
      sku: string;
      success: boolean;
      error?: string;
      errorType?: string;
    }>;
    summary: {
      totalProcessed: number;
      successful: number;
      failed: number;
      matched: number;
      unmatched: number;
      errors: Array<{ file: string; sku: string; error: string; type: string }>;
    };
  };
  errorMessage?: string;
}

interface BulkImageUploadProps {
  onComplete?: () => void;
}

export default function BulkImageUpload({ onComplete }: BulkImageUploadProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  // Poll job status
  useEffect(() => {
    if (!jobId) return;

    const pollStatus = async () => {
      try {
        const res = await fetch(`/api/ecommerce/admin/upload-images/${jobId}/status`, {
          credentials: 'include',
        });
        if (!res.ok) return;
        const data: JobStatus = await res.json();
        setJobStatus(data);

        if (data.isCompleted) {
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
          if (data.status === 'success') {
            toast({
              title: "Carga completada",
              description: `${data.successfulFiles} imágenes asignadas exitosamente.`,
            });
          } else if (data.status === 'partial') {
            toast({
              title: "Carga parcial",
              description: `${data.successfulFiles} exitosas, ${data.failedFiles} fallidas.`,
              variant: "destructive",
            });
          } else if (data.status === 'error') {
            toast({
              title: "Error en la carga",
              description: data.errorMessage || "Error procesando el archivo ZIP.",
              variant: "destructive",
            });
          }
          onComplete?.();
        }
      } catch (err) {
        console.error("Error polling job status:", err);
      }
    };

    // Initial poll
    pollStatus();
    // Poll every 2 seconds
    pollingRef.current = setInterval(pollStatus, 2000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [jobId]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.zip') || file.type === 'application/zip' || file.type === 'application/x-zip-compressed')) {
      setSelectedFile(file);
    } else {
      toast({
        title: "Archivo inválido",
        description: "Solo se aceptan archivos ZIP.",
        variant: "destructive",
      });
    }
  }, [toast]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setJobStatus(null);

    try {
      const formData = new FormData();
      formData.append('zipFile', selectedFile);

      const res = await fetch('/api/ecommerce/admin/upload-images', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `Error ${res.status}`);
      }

      const data = await res.json();
      setJobId(data.jobId);
      setIsUploading(false);
    } catch (err) {
      setIsUploading(false);
      toast({
        title: "Error al subir archivo",
        description: err instanceof Error ? err.message : "No se pudo iniciar la carga.",
        variant: "destructive",
      });
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setJobId(null);
    setJobStatus(null);
    setIsUploading(false);
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const progressPercent = jobStatus && jobStatus.totalFiles > 0
    ? Math.round((jobStatus.processedFiles / jobStatus.totalFiles) * 100)
    : 0;

  const isProcessing = jobId && jobStatus && !jobStatus.isCompleted;
  const isComplete = jobStatus?.isCompleted;

  return (
    <div className="space-y-5">
      {/* Instructions */}
      <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <ImageIcon className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm space-y-1">
            <p className="font-medium text-blue-900 dark:text-blue-100">
              Instrucciones para la carga masiva
            </p>
            <ul className="text-blue-700 dark:text-blue-300 space-y-0.5 list-disc list-inside">
              <li>Crea un archivo <strong>ZIP</strong> con las imágenes de los productos</li>
              <li>Cada imagen debe tener como nombre el <strong>código SKU</strong> del producto</li>
              <li>Ejemplo: <code className="bg-blue-100 dark:bg-blue-900 px-1.5 py-0.5 rounded text-xs font-mono">PCA106BLANCO02.png</code></li>
              <li>Formatos soportados: PNG, JPG, JPEG, GIF, WEBP</li>
              <li>Las imágenes se asignarán automáticamente al producto correspondiente</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Drop Zone (only when not processing) */}
      {!isProcessing && !isComplete && (
        <>
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`
              relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200
              ${isDragging
                ? 'border-orange-400 bg-orange-50 dark:bg-orange-950/20 scale-[1.01]'
                : selectedFile
                  ? 'border-green-400 bg-green-50/50 dark:bg-green-950/20'
                  : 'border-gray-300 dark:border-gray-600 hover:border-orange-300 hover:bg-orange-50/30 dark:hover:bg-orange-950/10'
              }
            `}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".zip,application/zip,application/x-zip-compressed"
              onChange={handleFileSelect}
              className="hidden"
            />

            {selectedFile ? (
              <div className="flex flex-col items-center gap-3">
                <div className="w-14 h-14 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <FileArchive className="h-7 w-7 text-green-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-gray-100">{selectedFile.name}</p>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {(selectedFile.size / (1024 * 1024)).toFixed(1)} MB
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-gray-500"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleReset();
                  }}
                >
                  <X className="h-3 w-3 mr-1" /> Cambiar archivo
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="w-14 h-14 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                  <Upload className="h-7 w-7 text-gray-400" />
                </div>
                <div>
                  <p className="font-medium text-gray-700 dark:text-gray-300">
                    Arrastra tu archivo ZIP aquí
                  </p>
                  <p className="text-sm text-gray-400 mt-1">
                    o haz clic para seleccionar
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Upload Button */}
          {selectedFile && (
            <div className="flex justify-end">
              <Button
                onClick={handleUpload}
                disabled={isUploading}
                className="bg-orange-500 hover:bg-orange-600 text-white gap-2"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Subiendo...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    Iniciar Carga
                  </>
                )}
              </Button>
            </div>
          )}
        </>
      )}

      {/* Progress */}
      {isProcessing && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 text-orange-500 animate-spin" />
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                Procesando imágenes...
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {jobStatus?.progressData?.phase === 'scanning' ? 'Escaneando archivos en ZIP...' :
                 jobStatus?.progressData?.currentFile ? `Procesando: ${jobStatus.progressData.currentFile}` :
                 `${jobStatus?.processedFiles || 0} de ${jobStatus?.totalFiles || 0} archivos`}
              </p>
            </div>
            <span className="text-sm font-semibold text-orange-600">{progressPercent}%</span>
          </div>
          <Progress value={progressPercent} className="h-2" />
          <div className="flex gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-green-500" />
              {jobStatus?.successfulFiles || 0} exitosas
            </span>
            <span className="flex items-center gap-1">
              <XCircle className="h-3 w-3 text-red-500" />
              {jobStatus?.failedFiles || 0} fallidas
            </span>
          </div>
        </div>
      )}

      {/* Results */}
      {isComplete && jobStatus && (
        <div className="space-y-4">
          {/* Summary */}
          <div className={`rounded-lg p-4 border ${
            jobStatus.status === 'success'
              ? 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800'
              : jobStatus.status === 'partial'
                ? 'bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800'
                : 'bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800'
          }`}>
            <div className="flex items-center gap-3 mb-3">
              {jobStatus.status === 'success' ? (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              ) : jobStatus.status === 'partial' ? (
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              ) : (
                <XCircle className="h-5 w-5 text-red-600" />
              )}
              <p className="font-semibold text-gray-900 dark:text-gray-100">
                {jobStatus.status === 'success' ? 'Carga completada exitosamente' :
                 jobStatus.status === 'partial' ? 'Carga completada con errores' :
                 'Error en la carga'}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-2 bg-white/60 dark:bg-gray-800/60 rounded-lg">
                <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{jobStatus.totalFiles}</p>
                <p className="text-xs text-gray-500">Total</p>
              </div>
              <div className="text-center p-2 bg-white/60 dark:bg-gray-800/60 rounded-lg">
                <p className="text-lg font-bold text-green-600">{jobStatus.successfulFiles}</p>
                <p className="text-xs text-gray-500">Asignadas</p>
              </div>
              <div className="text-center p-2 bg-white/60 dark:bg-gray-800/60 rounded-lg">
                <p className="text-lg font-bold text-red-600">{jobStatus.failedFiles}</p>
                <p className="text-xs text-gray-500">Fallidas</p>
              </div>
            </div>
          </div>

          {/* Failed items detail */}
          {jobStatus.resultData?.summary?.errors && jobStatus.resultData.summary.errors.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-gray-50 dark:bg-gray-800/50 px-4 py-2 border-b">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Imágenes no asignadas ({jobStatus.resultData.summary.errors.length})
                </p>
              </div>
              <div className="max-h-48 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700">
                {jobStatus.resultData.summary.errors.map((err, i) => (
                  <div key={i} className="px-4 py-2 flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge variant="outline" className="text-xs font-mono flex-shrink-0">
                        {err.sku}
                      </Badge>
                      <span className="text-gray-500 truncate text-xs">{err.file}</span>
                    </div>
                    <span className="text-xs text-red-500 flex-shrink-0 ml-2">
                      {err.type === 'product_not_found' ? 'SKU no encontrado' : err.error}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reset button */}
          <div className="flex justify-end">
            <Button variant="outline" onClick={handleReset} className="gap-2">
              <Upload className="h-4 w-4" />
              Cargar otro archivo
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
