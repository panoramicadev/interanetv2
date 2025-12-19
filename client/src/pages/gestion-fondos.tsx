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
import { Plus, Search, BarChart3, HandCoins } from "lucide-react";
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
            <Link href="/gastos-empresariales/dashboard">
              <Button variant="outline" className="w-full sm:w-auto" data-testid="button-dashboard">
                <BarChart3 className="h-4 w-4 mr-2" />
                Dashboard
              </Button>
            </Link>
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Crear nuevo Fondo</DialogTitle>
            <DialogDescription>
              Complete los datos para crear un nuevo fondo
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-gray-500 text-center">
              Contenido del formulario por definir
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Solicitar Fondo */}
      <Dialog open={showSolicitarFondoDialog} onOpenChange={setShowSolicitarFondoDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Solicitar Fondo</DialogTitle>
            <DialogDescription>
              Complete los datos para solicitar un fondo
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-gray-500 text-center">
              Contenido del formulario por definir
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
