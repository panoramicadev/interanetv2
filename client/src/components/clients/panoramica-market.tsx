import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  Award, 
  Star, 
  Crown, 
  Users, 
  TrendingUp, 
  Settings, 
  Plus, 
  Edit, 
  Trash2, 
  Loader2,
  Gift,
  DollarSign,
  Calendar,
  ChevronRight
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface LoyaltyTier {
  id: string;
  nombre: string;
  codigo: string;
  descripcion: string | null;
  montoMinimo: string;
  periodoEvaluacionDias: number;
  colorPrimario: string | null;
  colorSecundario: string | null;
  icono: string | null;
  orden: number;
  activo: boolean;
  clientCount?: number;
  totalSales?: number;
  benefitCount?: number;
}

interface LoyaltyBenefit {
  id: string;
  tierId: string;
  titulo: string;
  descripcion: string | null;
  tipo: string;
  valor: string | null;
  orden: number;
  activo: boolean;
}

interface TierClient {
  clientName: string;
  clientCode: string | null;
  totalSales: number;
  transactionCount: number;
  tierCode: string;
  tierName: string;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0
  }).format(amount);
};

const getTierIcon = (codigo: string, className: string = "h-6 w-6") => {
  switch (codigo) {
    case 'lider':
      return <Award className={className} />;
    case 'gold':
      return <Star className={className} />;
    case 'platinum':
      return <Crown className={className} />;
    default:
      return <Award className={className} />;
  }
};

export default function PanoramicaMarket() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTier, setSelectedTier] = useState<LoyaltyTier | null>(null);
  const [isEditTierOpen, setIsEditTierOpen] = useState(false);
  const [isAddBenefitOpen, setIsAddBenefitOpen] = useState(false);
  const [editingBenefit, setEditingBenefit] = useState<LoyaltyBenefit | null>(null);
  
  const [tierForm, setTierForm] = useState({
    nombre: "",
    codigo: "",
    descripcion: "",
    montoMinimo: "",
    periodoEvaluacionDias: 90,
  });

  const [benefitForm, setBenefitForm] = useState({
    titulo: "",
    descripcion: "",
    tipo: "beneficio",
    valor: "",
  });

  const { data: tiersSummary, isLoading: isLoadingSummary } = useQuery<LoyaltyTier[]>({
    queryKey: ['/api/loyalty/summary'],
  });

  const { data: tierClients, isLoading: isLoadingClients } = useQuery<TierClient[]>({
    queryKey: ['/api/loyalty/tiers', selectedTier?.id, 'clients'],
    queryFn: async () => {
      if (!selectedTier) return [];
      const res = await fetch(`/api/loyalty/tiers/${selectedTier.id}/clients`, { credentials: 'include' });
      return res.json();
    },
    enabled: !!selectedTier,
  });

  const { data: tierBenefits, isLoading: isLoadingBenefits } = useQuery<LoyaltyBenefit[]>({
    queryKey: ['/api/loyalty/tiers', selectedTier?.id, 'benefits'],
    queryFn: async () => {
      if (!selectedTier) return [];
      const res = await fetch(`/api/loyalty/tiers/${selectedTier.id}/benefits`, { credentials: 'include' });
      return res.json();
    },
    enabled: !!selectedTier,
  });

  const updateTierMutation = useMutation({
    mutationFn: async (data: { id: string; updates: Partial<LoyaltyTier> }) => {
      const res = await apiRequest(`/api/loyalty/tiers/${data.id}`, {
        method: 'PATCH',
        data: data.updates,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/loyalty/summary'] });
      setIsEditTierOpen(false);
      toast({ title: "Categoría actualizada correctamente" });
    },
    onError: () => {
      toast({ title: "Error al actualizar la categoría", variant: "destructive" });
    },
  });

  const createBenefitMutation = useMutation({
    mutationFn: async (data: Omit<LoyaltyBenefit, 'id' | 'createdAt' | 'activo'>) => {
      const res = await apiRequest('/api/loyalty/benefits', {
        method: 'POST',
        data: data,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/loyalty/tiers', selectedTier?.id, 'benefits'] });
      queryClient.invalidateQueries({ queryKey: ['/api/loyalty/summary'] });
      setIsAddBenefitOpen(false);
      setBenefitForm({ titulo: "", descripcion: "", tipo: "beneficio", valor: "" });
      toast({ title: "Beneficio agregado correctamente" });
    },
    onError: () => {
      toast({ title: "Error al agregar el beneficio", variant: "destructive" });
    },
  });

  const updateBenefitMutation = useMutation({
    mutationFn: async (data: { id: string; updates: Partial<LoyaltyBenefit> }) => {
      const res = await apiRequest(`/api/loyalty/benefits/${data.id}`, {
        method: 'PATCH',
        data: data.updates,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/loyalty/tiers', selectedTier?.id, 'benefits'] });
      setEditingBenefit(null);
      toast({ title: "Beneficio actualizado correctamente" });
    },
    onError: () => {
      toast({ title: "Error al actualizar el beneficio", variant: "destructive" });
    },
  });

  const deleteBenefitMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest(`/api/loyalty/benefits/${id}`, { method: 'DELETE' });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/loyalty/tiers', selectedTier?.id, 'benefits'] });
      queryClient.invalidateQueries({ queryKey: ['/api/loyalty/summary'] });
      toast({ title: "Beneficio eliminado correctamente" });
    },
    onError: () => {
      toast({ title: "Error al eliminar el beneficio", variant: "destructive" });
    },
  });

  const handleEditTier = (tier: LoyaltyTier) => {
    setTierForm({
      nombre: tier.nombre,
      codigo: tier.codigo,
      descripcion: tier.descripcion || "",
      montoMinimo: tier.montoMinimo,
      periodoEvaluacionDias: tier.periodoEvaluacionDias,
    });
    setSelectedTier(tier);
    setIsEditTierOpen(true);
  };

  const handleSaveTier = () => {
    if (!selectedTier) return;
    updateTierMutation.mutate({
      id: selectedTier.id,
      updates: {
        nombre: tierForm.nombre,
        descripcion: tierForm.descripcion,
        montoMinimo: tierForm.montoMinimo,
        periodoEvaluacionDias: tierForm.periodoEvaluacionDias,
      },
    });
  };

  const handleAddBenefit = () => {
    if (!selectedTier) return;
    createBenefitMutation.mutate({
      tierId: selectedTier.id,
      titulo: benefitForm.titulo,
      descripcion: benefitForm.descripcion,
      tipo: benefitForm.tipo,
      valor: benefitForm.valor,
      orden: (tierBenefits?.length || 0) + 1,
    });
  };

  if (isLoadingSummary) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-lg">Cargando programa de lealtad...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="panoramica-market">
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-3 mb-2">
          <Gift className="h-8 w-8" />
          <h2 className="text-2xl font-bold">Panoramica Market</h2>
        </div>
        <p className="text-purple-100">
          Programa de incentivos y categorías de clientes basado en compras de los últimos 90 días
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {tiersSummary?.map((tier) => (
          <Card 
            key={tier.id} 
            className={`cursor-pointer transition-all hover:shadow-lg ${
              selectedTier?.id === tier.id ? 'ring-2 ring-primary' : ''
            }`}
            style={{ 
              borderColor: tier.colorPrimario || undefined,
              background: selectedTier?.id === tier.id 
                ? `linear-gradient(135deg, ${tier.colorSecundario || '#f3f4f6'} 0%, white 100%)`
                : undefined
            }}
            onClick={() => setSelectedTier(tier)}
            data-testid={`tier-card-${tier.codigo}`}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div 
                  className="p-2 rounded-lg" 
                  style={{ backgroundColor: tier.colorPrimario || '#6B7280' }}
                >
                  {getTierIcon(tier.codigo, "h-6 w-6 text-white")}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEditTier(tier);
                  }}
                  data-testid={`button-edit-tier-${tier.codigo}`}
                >
                  <Settings className="h-4 w-4" />
                </Button>
              </div>
              <CardTitle className="text-lg mt-2">{tier.nombre}</CardTitle>
              <CardDescription>{tier.descripcion}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500 flex items-center gap-1">
                    <DollarSign className="h-4 w-4" />
                    Mínimo
                  </span>
                  <span className="font-semibold">{formatCurrency(Number(tier.montoMinimo))}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500 flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    Período
                  </span>
                  <span className="font-medium">{tier.periodoEvaluacionDias} días</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500 flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    Clientes
                  </span>
                  <Badge 
                    variant="secondary"
                    style={{ backgroundColor: tier.colorSecundario || undefined }}
                  >
                    {tier.clientCount || 0}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500 flex items-center gap-1">
                    <TrendingUp className="h-4 w-4" />
                    Ventas Totales
                  </span>
                  <span className="font-semibold text-green-600">
                    {formatCurrency(tier.totalSales || 0)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500 flex items-center gap-1">
                    <Gift className="h-4 w-4" />
                    Beneficios
                  </span>
                  <Badge variant="outline">{tier.benefitCount || 0}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {selectedTier && (
        <Card className="mt-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div 
                  className="p-2 rounded-lg"
                  style={{ backgroundColor: selectedTier.colorPrimario || '#6B7280' }}
                >
                  {getTierIcon(selectedTier.codigo, "h-5 w-5 text-white")}
                </div>
                <div>
                  <CardTitle>{selectedTier.nombre}</CardTitle>
                  <CardDescription>
                    Clientes y beneficios de esta categoría
                  </CardDescription>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="clients" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="clients" data-testid="tab-tier-clients">
                  <Users className="h-4 w-4 mr-2" />
                  Clientes ({tierClients?.length || 0})
                </TabsTrigger>
                <TabsTrigger value="benefits" data-testid="tab-tier-benefits">
                  <Gift className="h-4 w-4 mr-2" />
                  Términos y Beneficios ({tierBenefits?.length || 0})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="clients" className="mt-4">
                {isLoadingClients ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : tierClients && tierClients.length > 0 ? (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Código</TableHead>
                          <TableHead className="text-right">Ventas (90 días)</TableHead>
                          <TableHead className="text-right">Transacciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {tierClients.map((client, idx) => (
                          <TableRow key={idx} data-testid={`row-client-${idx}`}>
                            <TableCell className="font-medium">{client.clientName}</TableCell>
                            <TableCell>{client.clientCode || '-'}</TableCell>
                            <TableCell className="text-right font-semibold text-green-600">
                              {formatCurrency(client.totalSales)}
                            </TableCell>
                            <TableCell className="text-right">{client.transactionCount}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No hay clientes en esta categoría</p>
                    <p className="text-sm mt-1">
                      Los clientes que compren al menos {formatCurrency(Number(selectedTier.montoMinimo))} en {selectedTier.periodoEvaluacionDias} días aparecerán aquí
                    </p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="benefits" className="mt-4">
                <div className="flex justify-end mb-4">
                  <Button
                    onClick={() => setIsAddBenefitOpen(true)}
                    data-testid="button-add-benefit"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Agregar Beneficio
                  </Button>
                </div>

                {isLoadingBenefits ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : tierBenefits && tierBenefits.length > 0 ? (
                  <div className="space-y-3">
                    {tierBenefits.map((benefit) => (
                      <div 
                        key={benefit.id}
                        className="p-4 border rounded-lg flex items-start justify-between"
                        data-testid={`benefit-${benefit.id}`}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Badge variant={
                              benefit.tipo === 'beneficio' ? 'default' :
                              benefit.tipo === 'termino' ? 'secondary' : 'outline'
                            }>
                              {benefit.tipo === 'beneficio' ? 'Beneficio' :
                               benefit.tipo === 'termino' ? 'Término' : 'Condición'}
                            </Badge>
                            {benefit.valor && (
                              <span className="text-sm font-semibold text-green-600">{benefit.valor}</span>
                            )}
                          </div>
                          <h4 className="font-medium mt-1">{benefit.titulo}</h4>
                          {benefit.descripcion && (
                            <p className="text-sm text-gray-500 mt-1">{benefit.descripcion}</p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setEditingBenefit(benefit)}
                            data-testid={`button-edit-benefit-${benefit.id}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => deleteBenefitMutation.mutate(benefit.id)}
                            data-testid={`button-delete-benefit-${benefit.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Gift className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No hay beneficios configurados</p>
                    <p className="text-sm mt-1">
                      Agrega beneficios, términos o condiciones para esta categoría
                    </p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      <Dialog open={isEditTierOpen} onOpenChange={setIsEditTierOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Categoría</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Nombre</Label>
              <Input
                value={tierForm.nombre}
                onChange={(e) => setTierForm({ ...tierForm, nombre: e.target.value })}
                data-testid="input-tier-name"
              />
            </div>
            <div>
              <Label>Descripción</Label>
              <Textarea
                value={tierForm.descripcion}
                onChange={(e) => setTierForm({ ...tierForm, descripcion: e.target.value })}
                data-testid="input-tier-description"
              />
            </div>
            <div>
              <Label>Monto Mínimo (CLP)</Label>
              <Input
                type="number"
                value={tierForm.montoMinimo}
                onChange={(e) => setTierForm({ ...tierForm, montoMinimo: e.target.value })}
                data-testid="input-tier-amount"
              />
            </div>
            <div>
              <Label>Período de Evaluación (días)</Label>
              <Input
                type="number"
                value={tierForm.periodoEvaluacionDias}
                onChange={(e) => setTierForm({ ...tierForm, periodoEvaluacionDias: parseInt(e.target.value) })}
                data-testid="input-tier-period"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditTierOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSaveTier}
              disabled={updateTierMutation.isPending}
              data-testid="button-save-tier"
            >
              {updateTierMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isAddBenefitOpen} onOpenChange={setIsAddBenefitOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agregar Beneficio</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Tipo</Label>
              <select
                className="w-full border rounded-md p-2"
                value={benefitForm.tipo}
                onChange={(e) => setBenefitForm({ ...benefitForm, tipo: e.target.value })}
                data-testid="select-benefit-type"
              >
                <option value="beneficio">Beneficio</option>
                <option value="termino">Término</option>
                <option value="condicion">Condición</option>
              </select>
            </div>
            <div>
              <Label>Título</Label>
              <Input
                value={benefitForm.titulo}
                onChange={(e) => setBenefitForm({ ...benefitForm, titulo: e.target.value })}
                placeholder="Ej: Descuento en compras"
                data-testid="input-benefit-title"
              />
            </div>
            <div>
              <Label>Valor (opcional)</Label>
              <Input
                value={benefitForm.valor}
                onChange={(e) => setBenefitForm({ ...benefitForm, valor: e.target.value })}
                placeholder="Ej: 5%, Envío gratis"
                data-testid="input-benefit-value"
              />
            </div>
            <div>
              <Label>Descripción (opcional)</Label>
              <Textarea
                value={benefitForm.descripcion}
                onChange={(e) => setBenefitForm({ ...benefitForm, descripcion: e.target.value })}
                placeholder="Descripción detallada del beneficio"
                data-testid="input-benefit-description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddBenefitOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleAddBenefit}
              disabled={!benefitForm.titulo || createBenefitMutation.isPending}
              data-testid="button-save-benefit"
            >
              {createBenefitMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Agregar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingBenefit} onOpenChange={() => setEditingBenefit(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Beneficio</DialogTitle>
          </DialogHeader>
          {editingBenefit && (
            <div className="space-y-4 py-4">
              <div>
                <Label>Tipo</Label>
                <select
                  className="w-full border rounded-md p-2"
                  value={editingBenefit.tipo}
                  onChange={(e) => setEditingBenefit({ ...editingBenefit, tipo: e.target.value })}
                >
                  <option value="beneficio">Beneficio</option>
                  <option value="termino">Término</option>
                  <option value="condicion">Condición</option>
                </select>
              </div>
              <div>
                <Label>Título</Label>
                <Input
                  value={editingBenefit.titulo}
                  onChange={(e) => setEditingBenefit({ ...editingBenefit, titulo: e.target.value })}
                />
              </div>
              <div>
                <Label>Valor (opcional)</Label>
                <Input
                  value={editingBenefit.valor || ""}
                  onChange={(e) => setEditingBenefit({ ...editingBenefit, valor: e.target.value })}
                />
              </div>
              <div>
                <Label>Descripción (opcional)</Label>
                <Textarea
                  value={editingBenefit.descripcion || ""}
                  onChange={(e) => setEditingBenefit({ ...editingBenefit, descripcion: e.target.value })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingBenefit(null)}>
              Cancelar
            </Button>
            <Button 
              onClick={() => {
                if (editingBenefit) {
                  updateBenefitMutation.mutate({
                    id: editingBenefit.id,
                    updates: {
                      titulo: editingBenefit.titulo,
                      descripcion: editingBenefit.descripcion,
                      tipo: editingBenefit.tipo,
                      valor: editingBenefit.valor,
                    },
                  });
                }
              }}
              disabled={updateBenefitMutation.isPending}
            >
              {updateBenefitMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
