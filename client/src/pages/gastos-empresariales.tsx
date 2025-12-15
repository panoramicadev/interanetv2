import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, Search, Download, Check, X, Trash2, Eye, BarChart3, FileText, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { Link } from "wouter";
import { Separator } from "@/components/ui/separator";

interface GastoEmpresarial {
  id: string;
  monto: string;
  descripcion: string;
  userId: string;
  centroCostos: string | null;
  categoria: string;
  tipoGasto: string;
  tipoDocumento: string | null;
  proveedor: string | null;
  rutProveedor: string | null;
  numeroDocumento: string | null;
  fechaEmision: string | null;
  archivoUrl: string | null;
  estado: 'pendiente' | 'aprobado' | 'rechazado';
  supervisorId: string | null;
  fechaAprobacion: string | null;
  comentarioRechazo: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function GastosEmpresariales() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [estadoFilter, setEstadoFilter] = useState<string>("all");
  const [categoriaFilter, setCategoriaFilter] = useState<string>("all");
  const [selectedGasto, setSelectedGasto] = useState<GastoEmpresarial | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [showRejectionDialog, setShowRejectionDialog] = useState(false);
  const [comentarioRechazo, setComentarioRechazo] = useState("");

  // Fetch gastos
  const { data: gastos = [], isLoading } = useQuery<GastoEmpresarial[]>({
    queryKey: ['/api/gastos-empresariales', estadoFilter, categoriaFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (estadoFilter !== 'all') params.append('estado', estadoFilter);
      if (categoriaFilter !== 'all') params.append('categoria', categoriaFilter);
      
      const response = await fetch(`/api/gastos-empresariales?${params}`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Error al cargar gastos');
      return response.json();
    }
  });

  // Aprobar mutation
  const aprobarMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/gastos-empresariales/${id}/aprobar`, {
        method: 'POST'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/gastos-empresariales'] });
      toast({
        title: "Gasto aprobado",
        description: "El gasto ha sido aprobado correctamente",
      });
      setShowApprovalDialog(false);
      setSelectedGasto(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo aprobar el gasto",
        variant: "destructive",
      });
    }
  });

  // Rechazar mutation
  const rechazarMutation = useMutation({
    mutationFn: async ({ id, comentario }: { id: string; comentario: string }) => {
      return apiRequest(`/api/gastos-empresariales/${id}/rechazar`, {
        method: 'POST',
        data: { comentario }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/gastos-empresariales'] });
      toast({
        title: "Gasto rechazado",
        description: "El gasto ha sido rechazado",
      });
      setShowRejectionDialog(false);
      setSelectedGasto(null);
      setComentarioRechazo("");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo rechazar el gasto",
        variant: "destructive",
      });
    }
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/gastos-empresariales/${id}`, {
        method: 'DELETE'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/gastos-empresariales'] });
      toast({
        title: "Gasto eliminado",
        description: "El gasto ha sido eliminado correctamente",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo eliminar el gasto",
        variant: "destructive",
      });
    }
  });

  // Filter gastos based on search
  const filteredGastos = gastos.filter(gasto => {
    const matchesSearch = searchTerm === "" || 
      gasto.descripcion.toLowerCase().includes(searchTerm.toLowerCase()) ||
      gasto.categoria.toLowerCase().includes(searchTerm.toLowerCase()) ||
      gasto.proveedor?.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesSearch;
  });

  const getEstadoBadge = (estado: string) => {
    switch (estado) {
      case 'pendiente':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">Pendiente</Badge>;
      case 'aprobado':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Aprobado</Badge>;
      case 'rechazado':
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Rechazado</Badge>;
      default:
        return <Badge variant="outline">{estado}</Badge>;
    }
  };

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
  };

  const canApproveReject = user?.role === 'admin' || user?.role === 'supervisor' || user?.role === 'recursos_humanos';
  const canDelete = (gasto: GastoEmpresarial) => {
    return gasto.userId === user?.id && gasto.estado === 'pendiente' || user?.role === 'admin';
  };

  return (
    <>
      <div className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Rendición de Gastos</h1>
            <p className="text-sm text-gray-500 mt-1">Gestiona y controla la rendición de gastos</p>
          </div>
          <div className="flex gap-2">
            <Link href="/gastos-empresariales/dashboard">
              <Button variant="outline" className="w-full sm:w-auto" data-testid="button-dashboard">
                <BarChart3 className="h-4 w-4 mr-2" />
                Dashboard
              </Button>
            </Link>
            <Link href="/gastos-empresariales/nuevo">
              <Button className="w-full sm:w-auto" data-testid="button-add-gasto">
                <Plus className="h-4 w-4 mr-2" />
                Añadir Gasto
              </Button>
            </Link>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Buscar por descripción, categoría o proveedor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              data-testid="input-search"
            />
          </div>
          <Select value={estadoFilter} onValueChange={setEstadoFilter}>
            <SelectTrigger className="w-full sm:w-[180px]" data-testid="select-estado">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="pendiente">Pendiente</SelectItem>
              <SelectItem value="aprobado">Aprobado</SelectItem>
              <SelectItem value="rechazado">Rechazado</SelectItem>
            </SelectContent>
          </Select>
          <Select value={categoriaFilter} onValueChange={setCategoriaFilter}>
            <SelectTrigger className="w-full sm:w-[180px]" data-testid="select-categoria">
              <SelectValue placeholder="Categoría" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las categorías</SelectItem>
              <SelectItem value="Combustibles">Combustibles</SelectItem>
              <SelectItem value="Colación">Colación</SelectItem>
              <SelectItem value="Gestión Ventas">Gestión Ventas</SelectItem>
              <SelectItem value="Otros">Otros</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[100px]">Fecha</TableHead>
                  <TableHead className="min-w-[200px]">Descripción</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Tipo Gasto</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                      Cargando gastos...
                    </TableCell>
                  </TableRow>
                ) : filteredGastos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                      No se encontraron gastos
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredGastos.map((gasto) => (
                    <TableRow 
                      key={gasto.id} 
                      data-testid={`row-gasto-${gasto.id}`}
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => {
                        setSelectedGasto(gasto);
                        setShowDetailDialog(true);
                      }}
                    >
                      <TableCell className="text-sm">
                        {format(new Date(gasto.createdAt), 'dd/MM/yyyy', { locale: es })}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{gasto.descripcion}</p>
                          {gasto.proveedor && (
                            <p className="text-xs text-gray-500">{gasto.proveedor}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{gasto.categoria}</TableCell>
                      <TableCell className="text-sm">{gasto.tipoGasto}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(gasto.monto)}
                      </TableCell>
                      <TableCell>{getEstadoBadge(gasto.estado)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {canApproveReject && gasto.estado === 'pendiente' && (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedGasto(gasto);
                                  setShowApprovalDialog(true);
                                }}
                                title="Aprobar"
                                data-testid={`button-approve-${gasto.id}`}
                              >
                                <Check className="h-4 w-4 text-green-600" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedGasto(gasto);
                                  setComentarioRechazo("");
                                  setShowRejectionDialog(true);
                                }}
                                title="Rechazar"
                                data-testid={`button-reject-${gasto.id}`}
                              >
                                <X className="h-4 w-4 text-red-600" />
                              </Button>
                            </>
                          )}
                          {canDelete(gasto) && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm('¿Estás seguro de eliminar este gasto?')) {
                                  deleteMutation.mutate(gasto.id);
                                }
                              }}
                              data-testid={`button-delete-${gasto.id}`}
                            >
                              <Trash2 className="h-4 w-4 text-gray-600" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedGasto(gasto);
                              setShowDetailDialog(true);
                            }}
                            data-testid={`button-view-${gasto.id}`}
                          >
                            <Eye className="h-4 w-4 text-gray-600" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      {/* Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalle del Gasto</DialogTitle>
            <DialogDescription>
              Información completa del gasto empresarial
            </DialogDescription>
          </DialogHeader>
          
          {selectedGasto && (
            <div className="space-y-6">
              {/* Estado y Fecha */}
              <div className="flex items-center justify-between">
                {getEstadoBadge(selectedGasto.estado)}
                <span className="text-sm text-gray-500">
                  Creado: {format(new Date(selectedGasto.createdAt), 'dd/MM/yyyy HH:mm', { locale: es })}
                </span>
              </div>

              {/* Evidencia */}
              {selectedGasto.archivoUrl && (
                <div className="space-y-2">
                  <h3 className="font-semibold text-sm">Evidencia Adjunta</h3>
                  {selectedGasto.archivoUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                    <div className="border rounded-lg p-2 bg-gray-50">
                      <img 
                        src={selectedGasto.archivoUrl} 
                        alt="Evidencia" 
                        className="w-full max-h-80 object-contain rounded"
                      />
                    </div>
                  ) : (
                    <div className="border rounded-lg p-4 bg-gray-50 flex items-center gap-3">
                      <FileText className="h-8 w-8 text-blue-600" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">Documento adjunto</p>
                        <p className="text-xs text-gray-500">Haz clic para abrir el archivo</p>
                      </div>
                      <a 
                        href={selectedGasto.archivoUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                      >
                        <ExternalLink className="h-5 w-5 text-gray-600" />
                      </a>
                    </div>
                  )}
                </div>
              )}

              <Separator />

              {/* Información Principal */}
              <div className="space-y-4">
                <h3 className="font-semibold text-sm">Información del Gasto</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500">Monto</p>
                    <p className="font-bold text-lg">{formatCurrency(selectedGasto.monto)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Categoría</p>
                    <p className="font-medium">{selectedGasto.categoria}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Tipo de Gasto</p>
                    <p className="font-medium">{selectedGasto.tipoGasto}</p>
                  </div>
                  {selectedGasto.centroCostos && (
                    <div>
                      <p className="text-xs text-gray-500">Centro de Costos</p>
                      <p className="font-medium">{selectedGasto.centroCostos}</p>
                    </div>
                  )}
                </div>
                
                <div>
                  <p className="text-xs text-gray-500">Descripción</p>
                  <p className="font-medium mt-1">{selectedGasto.descripcion}</p>
                </div>
              </div>

              <Separator />

              {/* Información del Documento */}
              <div className="space-y-4">
                <h3 className="font-semibold text-sm">Información del Documento</h3>
                <div className="grid grid-cols-2 gap-4">
                  {selectedGasto.tipoDocumento && (
                    <div>
                      <p className="text-xs text-gray-500">Tipo de Documento</p>
                      <p className="font-medium">{selectedGasto.tipoDocumento}</p>
                    </div>
                  )}
                  {selectedGasto.numeroDocumento && (
                    <div>
                      <p className="text-xs text-gray-500">Número de Documento</p>
                      <p className="font-medium">{selectedGasto.numeroDocumento}</p>
                    </div>
                  )}
                  {selectedGasto.proveedor && (
                    <div>
                      <p className="text-xs text-gray-500">Proveedor</p>
                      <p className="font-medium">{selectedGasto.proveedor}</p>
                    </div>
                  )}
                  {selectedGasto.rutProveedor && (
                    <div>
                      <p className="text-xs text-gray-500">RUT Proveedor</p>
                      <p className="font-medium">{selectedGasto.rutProveedor}</p>
                    </div>
                  )}
                  {selectedGasto.fechaEmision && (
                    <div>
                      <p className="text-xs text-gray-500">Fecha de Emisión</p>
                      <p className="font-medium">
                        {format(new Date(selectedGasto.fechaEmision), 'dd/MM/yyyy', { locale: es })}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Estado y Aprobación */}
              {(selectedGasto.estado === 'aprobado' || selectedGasto.estado === 'rechazado') && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <h3 className="font-semibold text-sm">Información de Revisión</h3>
                    {selectedGasto.fechaAprobacion && (
                      <div>
                        <p className="text-xs text-gray-500">Fecha de {selectedGasto.estado === 'aprobado' ? 'Aprobación' : 'Rechazo'}</p>
                        <p className="font-medium">
                          {format(new Date(selectedGasto.fechaAprobacion), 'dd/MM/yyyy HH:mm', { locale: es })}
                        </p>
                      </div>
                    )}
                    {selectedGasto.comentarioRechazo && (
                      <div>
                        <p className="text-xs text-gray-500">Motivo del Rechazo</p>
                        <p className="font-medium text-red-600 mt-1">{selectedGasto.comentarioRechazo}</p>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Actions */}
              {canApproveReject && selectedGasto.estado === 'pendiente' && (
                <>
                  <Separator />
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      className="text-red-600 border-red-200 hover:bg-red-50"
                      onClick={() => {
                        setShowDetailDialog(false);
                        setShowRejectionDialog(true);
                      }}
                      data-testid="button-reject-detail"
                    >
                      <X className="h-4 w-4 mr-2" />
                      Rechazar
                    </Button>
                    <Button
                      className="bg-green-600 hover:bg-green-700"
                      onClick={() => {
                        setShowDetailDialog(false);
                        setShowApprovalDialog(true);
                      }}
                      data-testid="button-approve-detail"
                    >
                      <Check className="h-4 w-4 mr-2" />
                      Aprobar
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Approval Dialog */}
      <Dialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aprobar Gasto</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de aprobar este gasto por {selectedGasto && formatCurrency(selectedGasto.monto)}?
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => setShowApprovalDialog(false)}
              data-testid="button-cancel-approve"
            >
              Cancelar
            </Button>
            <Button
              onClick={() => selectedGasto && aprobarMutation.mutate(selectedGasto.id)}
              disabled={aprobarMutation.isPending}
              data-testid="button-confirm-approve"
            >
              {aprobarMutation.isPending ? 'Aprobando...' : 'Aprobar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rejection Dialog */}
      <Dialog open={showRejectionDialog} onOpenChange={setShowRejectionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rechazar Gasto</DialogTitle>
            <DialogDescription>
              Indica el motivo del rechazo de este gasto.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <Textarea
              placeholder="Motivo del rechazo..."
              value={comentarioRechazo}
              onChange={(e) => setComentarioRechazo(e.target.value)}
              rows={4}
              data-testid="textarea-rechazo"
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowRejectionDialog(false);
                  setComentarioRechazo("");
                }}
                data-testid="button-cancel-reject"
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  if (selectedGasto && comentarioRechazo.trim()) {
                    rechazarMutation.mutate({
                      id: selectedGasto.id,
                      comentario: comentarioRechazo
                    });
                  }
                }}
                disabled={rechazarMutation.isPending || !comentarioRechazo.trim()}
                data-testid="button-confirm-reject"
              >
                {rechazarMutation.isPending ? 'Rechazando...' : 'Rechazar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
