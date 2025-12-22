import { useState } from "react";
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
  DialogFooter
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, BarChart3, HandCoins, Upload } from "lucide-react";
import { Link } from "wouter";

export default function GestionFondos() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [tipoFilter, setTipoFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("solicitudes");
  const [showCrearFondoDialog, setShowCrearFondoDialog] = useState(false);
  const [showSolicitarFondoDialog, setShowSolicitarFondoDialog] = useState(false);

  const isLoading = false;
  const fondos: any[] = [];

  const getEstadoBadge = (estado: string) => {
    switch (estado) {
      case 'solicitud':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Solicitud</Badge>;
      case 'pendiente':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">Pendiente</Badge>;
      case 'abierto':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Abierto</Badge>;
      case 'cerrado':
        return <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">Cerrado</Badge>;
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

  const filteredFondos = fondos.filter(fondo => {
    const matchesSearch = searchTerm === "" || 
      fondo.descripcion?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      fondo.solicitante?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesTipo = tipoFilter === "all" || fondo.tipo === tipoFilter;

    return matchesSearch && matchesTipo;
  });

  const renderTable = () => (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[100px]">Fecha</TableHead>
              <TableHead className="min-w-[150px]">Solicitante</TableHead>
              <TableHead className="min-w-[200px]">Descripción</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="text-right">Monto</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                  Cargando fondos...
                </TableCell>
              </TableRow>
            ) : filteredFondos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                  No se encontraron fondos en esta categoría
                </TableCell>
              </TableRow>
            ) : (
              filteredFondos.map((fondo) => (
                <TableRow 
                  key={fondo.id} 
                  data-testid={`row-fondo-${fondo.id}`}
                  className="cursor-pointer hover:bg-gray-50"
                >
                  <TableCell className="text-sm">
                    {fondo.fecha}
                  </TableCell>
                  <TableCell className="text-sm font-medium">
                    {fondo.solicitante}
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium text-sm">{fondo.descripcion}</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{fondo.tipo}</TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatCurrency(fondo.monto || 0)}
                  </TableCell>
                  <TableCell>{getEstadoBadge(fondo.estado)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        data-testid={`button-view-${fondo.id}`}
                      >
                        Ver
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
  );

  return (
    <>
      <div className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Gestión de Fondos</h1>
            <p className="text-sm text-gray-500 mt-1">Administra solicitudes y asignación de fondos</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button 
              className="w-full sm:w-auto" 
              data-testid="button-crear-fondo"
              onClick={() => setShowCrearFondoDialog(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Crear nuevo Fondo
            </Button>
            <Button 
              variant="secondary"
              className="w-full sm:w-auto" 
              data-testid="button-solicitar-fondo"
              onClick={() => setShowSolicitarFondoDialog(true)}
            >
              <HandCoins className="h-4 w-4 mr-2" />
              Solicitar Fondo
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Buscar por descripción o solicitante..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              data-testid="input-search"
            />
          </div>
          <Select value={tipoFilter} onValueChange={setTipoFilter}>
            <SelectTrigger className="w-full sm:w-[180px]" data-testid="select-tipo">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los tipos</SelectItem>
              <SelectItem value="operativo">Operativo</SelectItem>
              <SelectItem value="viático">Viático</SelectItem>
              <SelectItem value="proyecto">Proyecto</SelectItem>
              <SelectItem value="emergencia">Emergencia</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid">
            <TabsTrigger value="solicitudes" data-testid="tab-solicitudes">Solicitudes</TabsTrigger>
            <TabsTrigger value="pendientes" data-testid="tab-pendientes">Pendientes</TabsTrigger>
            <TabsTrigger value="abiertos" data-testid="tab-abiertos">Abiertos</TabsTrigger>
            <TabsTrigger value="cerrados" data-testid="tab-cerrados">Cerrados</TabsTrigger>
            <TabsTrigger value="rechazados" data-testid="tab-rechazados">Rechazados</TabsTrigger>
          </TabsList>

          <TabsContent value="solicitudes" className="mt-4">
            {renderTable()}
          </TabsContent>
          <TabsContent value="pendientes" className="mt-4">
            {renderTable()}
          </TabsContent>
          <TabsContent value="abiertos" className="mt-4">
            {renderTable()}
          </TabsContent>
          <TabsContent value="cerrados" className="mt-4">
            {renderTable()}

          </TabsContent>
          <TabsContent value="rechazados" className="mt-4">
            {renderTable()}
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialog Crear Fondo */}
      <Dialog open={showCrearFondoDialog} onOpenChange={setShowCrearFondoDialog}>
        <DialogContent className="max-w-2xl overflow-y-auto max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Crear nuevo Fondo</DialogTitle>
            <DialogDescription>
              Complete los datos para configurar el presupuesto y asignaciones.
            </DialogDescription>
          </DialogHeader>

          {/* Inicio del Formulario */}
          <div className="grid gap-6 py-4">

            {/* 1. Presupuesto (Elemento destacado) */}
            <div className="space-y-2">
              <label htmlFor="presupuesto" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Presupuesto del Fondo (CLP)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-gray-500">$</span>
                <input
                  id="presupuesto"
                  type="number"
                  placeholder="0"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pl-7 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
            </div>

            {/* 2. Detalles del Fondo */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Nombre del Fondo</label>
                <input
                  type="text"
                  placeholder="Ej: Fondos por rendir Diciembre 2025"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">ID de Contabilidad</label>
                <input
                  type="text"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                />
              </div>

              {/* Selects: Centro de Costos & Abonos */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Centro de Costos</label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
                  <option value="" disabled selected>Seleccionar...</option>
                  <option value="Maipú">Maipú</option>
                  <option value="Concepción">Concepción</option>
                  <option value="Lautaro">Lautaro</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Abonos Recurrentes</label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
                  <option value="no">No</option>
                  <option value="monthly">Mensual</option>
                  <option value="weekly">Semanal</option>
                </select>
              </div>
            </div>

            {/* Separador Visual */}
            <div className="border-t border-gray-200" />

            {/* 3. Personas */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Usuario Responsable</label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
                  <option value="" disabled selected>Asignar responsable...</option>
                  <option value="u1">Juan Pérez</option>
                  <option value="u2">María González</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Beneficiario</label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
                  <option value="" disabled selected>Asignar beneficiario...</option>
                  <option value="prov1">Proveedor X</option>
                  <option value="internal">Interno</option>
                </select>
              </div>
            </div>

            {/* Participantes (Opcional - Ancho completo) */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Participantes (Opcional)</label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
                 <option value="" disabled selected>Agregar participantes...</option>
                 <option value="team1">Equipo de Desarrollo</option>
                 <option value="team2">Equipo de Marketing</option>
              </select>
              <p className="text-[0.8rem] text-muted-foreground">Permite ver el fondo sin editarlo.</p>
            </div>

            {/* Separador Visual */}
            <div className="border-t border-gray-200" />

            {/* 4. Fechas */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Fecha de Inicio</label>
                <input
                  type="date"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Fecha de Término</label>
                <input
                  type="date"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                />
              </div>
            </div>

          </div>
          {/* Fin del Formulario */}

          {/* Footer con Botones */}
          <DialogFooter className="sm:justify-end gap-2">
            <Button variant="outline" onClick={() => setShowCrearFondoDialog(false)}>
              Cerrar
            </Button>
            <Button type="submit">
              Crear Fondo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Solicitar Fondo */}
      <Dialog open={showSolicitarFondoDialog} onOpenChange={setShowSolicitarFondoDialog}>
        <DialogContent className="max-w-xl"> {/* Aumenté ligeramente a xl para mejor espaciado */}
          <DialogHeader>
            <DialogTitle>Solicitar Fondo</DialogTitle>
            <DialogDescription>
              Complete los datos y adjunte los respaldos necesarios.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 py-4">

            {/* 1. Monto Solicitado (Destacado) */}
            <div className="space-y-2">
              <label htmlFor="monto-solicitud" className="text-sm font-medium leading-none">
                Monto a solicitar (CLP)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-gray-500">$</span>
                <input
                  id="monto-solicitud"
                  type="number"
                  placeholder="0"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pl-7 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
              </div>
            </div>

            {/* 2. Motivo (Textarea para permitir explicación) */}
            <div className="space-y-2">
              <label htmlFor="motivo" className="text-sm font-medium">Motivo de la solicitud</label>
              <textarea
                id="motivo"
                placeholder="Ej: Compra de insumos oficina central..."
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>

            {/* 3. Grid: Centro de Costos y Fecha */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Centro de Costos</label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
                  <option value="" disabled selected>Seleccionar...</option>
                  <option value="Maipú">Maipú</option>
                  <option value="Concepción">Concepción</option>
                  <option value="Lautaro">Lautaro</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Fecha de término</label>
                <input
                  type="date"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                />
              </div>
            </div>

            {/* 4. Sección de Documentos (Upload UI) */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Documentos de respaldo</label>

              {/* Zona de "Drop" simulada */}
              <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 hover:bg-gray-50 transition-colors cursor-pointer text-center group">
                  <input type="file" className="hidden" id="file-upload" multiple />
                  <label htmlFor="file-upload" className="cursor-pointer w-full h-full flex flex-col items-center justify-center">
                    <Upload className="h-12 w-12 text-gray-400 mb-3" />
                    <p className="text-sm text-gray-600 font-medium">
                      Haz clic para subir o arrastra archivos aquí
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      PDF, PNG, JPG (Máx. 5MB)
                    </p>
                  </label>
              </div>
            </div>

          </div>

          <DialogFooter className="sm:justify-end gap-2">
            <Button variant="outline" onClick={() => setShowSolicitarFondoDialog(false)}>
              Cancelar
            </Button>
            <Button type="submit">
              Enviar Solicitud
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
