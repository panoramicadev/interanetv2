import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Edit, Trash2, Palette } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import type { 
  Pigment, 
  Base, 
  Envase, 
  Color, 
  Receta, 
  Parametro,
  InsertPigment,
  InsertBase,
  InsertEnvase,
  InsertColor,
  InsertReceta,
  InsertParametro
} from '@shared/schema';
import { useAuth } from '@/hooks/useAuth';

export default function TintometriaAdmin() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Verificar permisos de acceso
  if (!user || (user.role !== 'admin' && user.role !== 'laboratorio' && user.role !== 'jefe_planta')) {
    return (
      <div className="container mx-auto p-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <p className="text-center text-muted-foreground">
            No tiene permisos para acceder a esta página.
          </p>
        </div>
      </div>
    );
  }
  
  const [editingItem, setEditingItem] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('pigments');

  // Queries for all entities
  const { data: pigments = [], isLoading: loadingPigments } = useQuery<Pigment[]>({
    queryKey: ['/api/tintometria/pigments'],
  });

  const { data: bases = [], isLoading: loadingBases } = useQuery<Base[]>({
    queryKey: ['/api/tintometria/bases'],
  });

  const { data: envases = [], isLoading: loadingEnvases } = useQuery<Envase[]>({
    queryKey: ['/api/tintometria/envases'],
  });

  const { data: colores = [], isLoading: loadingColores } = useQuery({
    queryKey: ['/api/tintometria/colores'],
  });

  const { data: recetas = [], isLoading: loadingRecetas } = useQuery({
    queryKey: ['/api/tintometria/recetas'],
  });

  const { data: parametros = [], isLoading: loadingParametros } = useQuery({
    queryKey: ['/api/tintometria/parametros'],
  });

  const handleCreate = async (entity: string, data: any) => {
    try {
      await apiRequest(`/api/tintometria/${entity}`, {
        method: 'POST',
        data,
      });
      await queryClient.invalidateQueries({ queryKey: [`/api/tintometria/${entity}`] });
      toast({
        title: 'Creado exitosamente',
        description: `El ${entity.slice(0, -1)} ha sido creado.`,
      });
      setDialogOpen(false);
      setEditingItem(null);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Error al crear el elemento',
        variant: 'destructive',
      });
    }
  };

  const handleUpdate = async (entity: string, id: number, data: any) => {
    try {
      await apiRequest(`/api/tintometria/${entity}/${id}`, {
        method: 'PUT',
        data,
      });
      await queryClient.invalidateQueries({ queryKey: [`/api/tintometria/${entity}`] });
      toast({
        title: 'Actualizado exitosamente',
        description: `El ${entity.slice(0, -1)} ha sido actualizado.`,
      });
      setDialogOpen(false);
      setEditingItem(null);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Error al actualizar el elemento',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (entity: string, id: number) => {
    if (!confirm('¿Estás seguro de que quieres eliminar este elemento?')) return;
    
    try {
      await apiRequest(`/api/tintometria/${entity}/${id}`, {
        method: 'DELETE',
      });
      await queryClient.invalidateQueries({ queryKey: [`/api/tintometria/${entity}`] });
      toast({
        title: 'Eliminado exitosamente',
        description: `El ${entity.slice(0, -1)} ha sido eliminado.`,
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Error al eliminar el elemento',
        variant: 'destructive',
      });
    }
  };

  const PigmentForm = ({ pigment, onSubmit }: { pigment?: Pigment; onSubmit: (data: InsertPigment) => void }) => {
    const [compatibleBase, setCompatibleBase] = useState<'Agua' | 'Solvente' | ''>(pigment?.compatibleBase as 'Agua' | 'Solvente' || '');

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const formData = new FormData(e.currentTarget);
      
      if (!compatibleBase) {
        alert('Por favor complete todos los campos obligatorios');
        return;
      }
      
      onSubmit({
        pigmentoCode: formData.get('pigmentoCode') as string,
        nombre: formData.get('nombre') as string,
        compatibleBase: compatibleBase as 'Agua' | 'Solvente',
        costoKgClp: parseFloat(formData.get('costoKgClp') as string),
        proveedor: formData.get('proveedor') as string,
        notas: formData.get('notas') as string,
      });
    };

    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="pigmentoCode">Código del Pigmento</Label>
            <Input 
              id="pigmentoCode" 
              name="pigmentoCode" 
              defaultValue={pigment?.pigmentoCode} 
              required 
              data-testid="input-pigmento-code"
            />
          </div>
          <div>
            <Label htmlFor="nombre">Nombre</Label>
            <Input 
              id="nombre" 
              name="nombre" 
              defaultValue={pigment?.nombre} 
              required 
              data-testid="input-nombre"
            />
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="compatibleBase">Base Compatible</Label>
            <Select value={compatibleBase} onValueChange={(value: 'Agua' | 'Solvente') => setCompatibleBase(value)} required>
              <SelectTrigger data-testid="select-compatible-base">
                <SelectValue placeholder="Selecciona base" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Agua">Agua</SelectItem>
                <SelectItem value="Solvente">Solvente</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="costoKgClp">Costo por Kg (CLP)</Label>
            <Input 
              id="costoKgClp" 
              name="costoKgClp" 
              type="number" 
              step="0.01" 
              defaultValue={pigment?.costoKgClp} 
              required 
              data-testid="input-costo-kg"
            />
          </div>
        </div>
        
        <div>
          <Label htmlFor="proveedor">Proveedor</Label>
          <Input 
            id="proveedor" 
            name="proveedor" 
            defaultValue={pigment?.proveedor || ''} 
            data-testid="input-proveedor"
          />
        </div>
        
        <div>
          <Label htmlFor="notas">Notas</Label>
          <Textarea 
            id="notas" 
            name="notas" 
            defaultValue={pigment?.notas || ''} 
            data-testid="textarea-notas"
          />
        </div>
        
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} data-testid="button-cancelar">
            Cancelar
          </Button>
          <Button type="submit" data-testid="button-guardar">
            Guardar
          </Button>
        </div>
      </form>
    );
  };

  const BaseForm = ({ base, onSubmit }: { base?: Base; onSubmit: (data: InsertBase) => void }) => {
    const [tipoBase, setTipoBase] = useState<'Agua' | 'Solvente' | ''>(base?.tipoBase as 'Agua' | 'Solvente' || '');
    const [colorBase, setColorBase] = useState<'Blanco' | 'Incoloro' | ''>(base?.colorBase as 'Blanco' | 'Incoloro' || '');

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const formData = new FormData(e.currentTarget);
      
      if (!tipoBase || !colorBase) {
        alert('Por favor complete todos los campos obligatorios');
        return;
      }
      
      onSubmit({
        baseId: formData.get('baseId') as string,
        tipoBase: tipoBase as 'Agua' | 'Solvente',
        colorBase: colorBase as 'Blanco' | 'Incoloro',
        costoKgClp: parseFloat(formData.get('costoKgClp') as string),
        notas: formData.get('notas') as string,
      });
    };

    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="baseId">ID de Base</Label>
            <Input 
              id="baseId" 
              name="baseId" 
              defaultValue={base?.baseId} 
              required 
              data-testid="input-base-id"
            />
          </div>
          <div>
            <Label htmlFor="tipoBase">Tipo de Base</Label>
            <Select value={tipoBase} onValueChange={(value: 'Agua' | 'Solvente') => setTipoBase(value)} required>
              <SelectTrigger data-testid="select-tipo-base">
                <SelectValue placeholder="Selecciona tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Agua">Agua</SelectItem>
                <SelectItem value="Solvente">Solvente</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="colorBase">Color Base</Label>
            <Select value={colorBase} onValueChange={(value: 'Blanco' | 'Incoloro') => setColorBase(value)} required>
              <SelectTrigger data-testid="select-color-base">
                <SelectValue placeholder="Selecciona color" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Blanco">Blanco</SelectItem>
                <SelectItem value="Incoloro">Incoloro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="costoKgClp">Costo por Kg (CLP)</Label>
            <Input 
              id="costoKgClp" 
              name="costoKgClp" 
              type="number" 
              step="0.01" 
              defaultValue={base?.costoKgClp} 
              required 
              data-testid="input-costo-kg"
            />
          </div>
        </div>
        
        <div>
          <Label htmlFor="notas">Notas</Label>
          <Textarea 
            id="notas" 
            name="notas" 
            defaultValue={base?.notas || ''} 
            data-testid="textarea-notas"
          />
        </div>
        
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} data-testid="button-cancelar">
            Cancelar
          </Button>
          <Button type="submit" data-testid="button-guardar">
            Guardar
          </Button>
        </div>
      </form>
    );
  };

  const EnvaseForm = ({ envase, onSubmit }: { envase?: Envase; onSubmit: (data: InsertEnvase) => void }) => {
    const [material, setMaterial] = useState<'Plástico' | 'Metálico' | ''>(envase?.material as 'Plástico' | 'Metálico' || '');
    const [capacidad, setCapacidad] = useState<'BD' | 'BD5' | '1/4' | 'GL' | 'BD4' | ''>(envase?.capacidad as 'BD' | 'BD5' | '1/4' | 'GL' | 'BD4' || '');

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const formData = new FormData(e.currentTarget);
      
      if (!material || !capacidad) {
        alert('Por favor complete todos los campos obligatorios');
        return;
      }
      
      onSubmit({
        envaseId: formData.get('envaseId') as string,
        material: material as 'Plástico' | 'Metálico',
        capacidad: capacidad as 'BD' | 'BD5' | '1/4' | 'GL' | 'BD4',
        kgPorEnvase: parseFloat(formData.get('kgPorEnvase') as string),
        costoEnvaseClp: parseFloat(formData.get('costoEnvaseClp') as string),
        notas: formData.get('notas') as string,
      });
    };

    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="envaseId">ID del Envase</Label>
            <Input 
              id="envaseId" 
              name="envaseId" 
              defaultValue={envase?.envaseId} 
              required 
              data-testid="input-envase-id"
            />
          </div>
          <div>
            <Label htmlFor="material">Material</Label>
            <Select value={material} onValueChange={(value: 'Plástico' | 'Metálico') => setMaterial(value)} required>
              <SelectTrigger data-testid="select-material">
                <SelectValue placeholder="Selecciona material" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Plástico">Plástico</SelectItem>
                <SelectItem value="Metálico">Metálico</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label htmlFor="capacidad">Capacidad</Label>
            <Select value={capacidad} onValueChange={(value: 'BD' | 'BD5' | '1/4' | 'GL' | 'BD4') => setCapacidad(value)} required>
              <SelectTrigger data-testid="select-capacidad">
                <SelectValue placeholder="Selecciona capacidad" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="BD">BD</SelectItem>
                <SelectItem value="BD5">BD5</SelectItem>
                <SelectItem value="1/4">1/4</SelectItem>
                <SelectItem value="GL">GL</SelectItem>
                <SelectItem value="BD4">BD4</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="kgPorEnvase">Kg por Envase</Label>
            <Input 
              id="kgPorEnvase" 
              name="kgPorEnvase" 
              type="number" 
              step="0.001" 
              defaultValue={envase?.kgPorEnvase} 
              required 
              data-testid="input-kg-envase"
            />
          </div>
          <div>
            <Label htmlFor="costoEnvaseClp">Costo Envase (CLP)</Label>
            <Input 
              id="costoEnvaseClp" 
              name="costoEnvaseClp" 
              type="number" 
              step="0.01" 
              defaultValue={envase?.costoEnvaseClp} 
              required 
              data-testid="input-costo-envase"
            />
          </div>
        </div>
        
        <div>
          <Label htmlFor="notas">Notas</Label>
          <Textarea 
            id="notas" 
            name="notas" 
            defaultValue={envase?.notas || ''} 
            data-testid="textarea-notas"
          />
        </div>
        
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} data-testid="button-cancelar">
            Cancelar
          </Button>
          <Button type="submit" data-testid="button-guardar">
            Guardar
          </Button>
        </div>
      </form>
    );
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <Palette className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Administrador de Tintometría</h1>
          <p className="text-muted-foreground">
            Gestiona pigmentos, bases, envases, colores, recetas y parámetros del sistema
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="pigments" data-testid="tab-pigments">Pigmentos</TabsTrigger>
          <TabsTrigger value="bases" data-testid="tab-bases">Bases</TabsTrigger>
          <TabsTrigger value="envases" data-testid="tab-envases">Envases</TabsTrigger>
          <TabsTrigger value="colores" data-testid="tab-colores">Colores</TabsTrigger>
          <TabsTrigger value="recetas" data-testid="tab-recetas">Recetas</TabsTrigger>
          <TabsTrigger value="parametros" data-testid="tab-parametros">Parámetros</TabsTrigger>
        </TabsList>

        {/* PIGMENTS TAB */}
        <TabsContent value="pigments" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Pigmentos</CardTitle>
                <CardDescription>
                  Gestiona los pigmentos disponibles para tintometría
                </CardDescription>
              </div>
              <Dialog open={dialogOpen && activeTab === 'pigments'} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={() => { setEditingItem(null); setDialogOpen(true); }} data-testid="button-add-pigment">
                    <Plus className="h-4 w-4 mr-2" />
                    Nuevo Pigmento
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>
                      {editingItem ? 'Editar Pigmento' : 'Nuevo Pigmento'}
                    </DialogTitle>
                    <DialogDescription>
                      {editingItem ? 'Modifica los datos del pigmento' : 'Agrega un nuevo pigmento al sistema'}
                    </DialogDescription>
                  </DialogHeader>
                  <PigmentForm
                    pigment={editingItem}
                    onSubmit={(data) => {
                      if (editingItem) {
                        handleUpdate('pigments', editingItem.id, data);
                      } else {
                        handleCreate('pigments', data);
                      }
                    }}
                  />
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Base Compatible</TableHead>
                    <TableHead>Costo/Kg</TableHead>
                    <TableHead>Proveedor</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingPigments ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center">Cargando...</TableCell>
                    </TableRow>
                  ) : pigments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        No hay pigmentos registrados
                      </TableCell>
                    </TableRow>
                  ) : (
                    pigments.map((pigment: Pigment) => (
                      <TableRow key={pigment.id} data-testid={`row-pigment-${pigment.id}`}>
                        <TableCell className="font-medium">{pigment.pigmentoCode}</TableCell>
                        <TableCell>{pigment.nombre}</TableCell>
                        <TableCell>{pigment.compatibleBase}</TableCell>
                        <TableCell>${Number(pigment.costoKgClp).toLocaleString('es-CL')}</TableCell>
                        <TableCell>{pigment.proveedor || '-'}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setEditingItem(pigment);
                                setDialogOpen(true);
                              }}
                              data-testid={`button-edit-pigment-${pigment.id}`}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDelete('pigments', pigment.id)}
                              data-testid={`button-delete-pigment-${pigment.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* BASES TAB */}
        <TabsContent value="bases" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Bases</CardTitle>
                <CardDescription>
                  Gestiona las bases disponibles para tintometría
                </CardDescription>
              </div>
              <Dialog open={dialogOpen && activeTab === 'bases'} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={() => { setEditingItem(null); setDialogOpen(true); }} data-testid="button-add-base">
                    <Plus className="h-4 w-4 mr-2" />
                    Nueva Base
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>
                      {editingItem ? 'Editar Base' : 'Nueva Base'}
                    </DialogTitle>
                    <DialogDescription>
                      {editingItem ? 'Modifica los datos de la base' : 'Agrega una nueva base al sistema'}
                    </DialogDescription>
                  </DialogHeader>
                  <BaseForm
                    base={editingItem}
                    onSubmit={(data) => {
                      if (editingItem) {
                        handleUpdate('bases', editingItem.id, data);
                      } else {
                        handleCreate('bases', data);
                      }
                    }}
                  />
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID Base</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Color</TableHead>
                    <TableHead>Costo/Kg</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingBases ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center">Cargando...</TableCell>
                    </TableRow>
                  ) : bases.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        No hay bases registradas
                      </TableCell>
                    </TableRow>
                  ) : (
                    bases.map((base: Base) => (
                      <TableRow key={base.id} data-testid={`row-base-${base.id}`}>
                        <TableCell className="font-medium">{base.baseId}</TableCell>
                        <TableCell>{base.tipoBase}</TableCell>
                        <TableCell>{base.colorBase}</TableCell>
                        <TableCell>${Number(base.costoKgClp).toLocaleString('es-CL')}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setEditingItem(base);
                                setDialogOpen(true);
                              }}
                              data-testid={`button-edit-base-${base.id}`}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDelete('bases', base.id)}
                              data-testid={`button-delete-base-${base.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ENVASES TAB */}
        <TabsContent value="envases" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Envases</CardTitle>
                <CardDescription>
                  Gestiona los envases disponibles para productos
                </CardDescription>
              </div>
              <Dialog open={dialogOpen && activeTab === 'envases'} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={() => { setEditingItem(null); setDialogOpen(true); }} data-testid="button-add-envase">
                    <Plus className="h-4 w-4 mr-2" />
                    Nuevo Envase
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>
                      {editingItem ? 'Editar Envase' : 'Nuevo Envase'}
                    </DialogTitle>
                    <DialogDescription>
                      {editingItem ? 'Modifica los datos del envase' : 'Agrega un nuevo envase al sistema'}
                    </DialogDescription>
                  </DialogHeader>
                  <EnvaseForm
                    envase={editingItem}
                    onSubmit={(data) => {
                      if (editingItem) {
                        handleUpdate('envases', editingItem.id, data);
                      } else {
                        handleCreate('envases', data);
                      }
                    }}
                  />
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID Envase</TableHead>
                    <TableHead>Material</TableHead>
                    <TableHead>Capacidad</TableHead>
                    <TableHead>Kg/Envase</TableHead>
                    <TableHead>Costo Envase</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingEnvases ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center">Cargando...</TableCell>
                    </TableRow>
                  ) : envases.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        No hay envases registrados
                      </TableCell>
                    </TableRow>
                  ) : (
                    envases.map((envase: Envase) => (
                      <TableRow key={envase.id} data-testid={`row-envase-${envase.id}`}>
                        <TableCell className="font-medium">{envase.envaseId}</TableCell>
                        <TableCell>{envase.material}</TableCell>
                        <TableCell>{envase.capacidad}</TableCell>
                        <TableCell>{Number(envase.kgPorEnvase).toFixed(3)} kg</TableCell>
                        <TableCell>${Number(envase.costoEnvaseClp).toLocaleString('es-CL')}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setEditingItem(envase);
                                setDialogOpen(true);
                              }}
                              data-testid={`button-edit-envase-${envase.id}`}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDelete('envases', envase.id)}
                              data-testid={`button-delete-envase-${envase.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Placeholder for other tabs */}
        <TabsContent value="colores" className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center text-muted-foreground">
                <Palette className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Gestión de colores - En desarrollo</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recetas" className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center text-muted-foreground">
                <Palette className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Gestión de recetas - En desarrollo</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="parametros" className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center text-muted-foreground">
                <Palette className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Gestión de parámetros - En desarrollo</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}