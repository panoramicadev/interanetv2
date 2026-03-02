import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
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
  Search,
  ShieldCheck,
  Crown,
  Star,
  Award,
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

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function getTierIcon(codigo: string, className: string = "h-6 w-6") {
  switch (codigo.toLowerCase()) {
    case 'lider': return <ShieldCheck className={className} />;
    case 'gold': return <Crown className={className} />;
    case 'platinum': return <Star className={className} />;
    default: return <Award className={className} />;
  }
}

export default function PanoramicaMarket() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTier, setSelectedTier] = useState<LoyaltyTier | null>(null);
  const [isEditTierOpen, setIsEditTierOpen] = useState(false);
  const [isAddBenefitOpen, setIsAddBenefitOpen] = useState(false);
  const [editingBenefit, setEditingBenefit] = useState<LoyaltyBenefit | null>(null);
  const [clientSearch, setClientSearch] = useState("");

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

  // Auto-select first tier when data loads
  useEffect(() => {
    if (tiersSummary && tiersSummary.length > 0 && !selectedTier) {
      setSelectedTier(tiersSummary[0]);
    }
  }, [tiersSummary, selectedTier]);

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

  // Global KPI calculations
  const totalClients = tiersSummary?.reduce((sum, t) => sum + (t.clientCount || 0), 0) || 0;
  const totalSales = tiersSummary?.reduce((sum, t) => sum + (t.totalSales || 0), 0) || 0;
  const totalBenefits = tiersSummary?.reduce((sum, t) => sum + (t.benefitCount || 0), 0) || 0;

  // Filtered clients
  const filteredClients = tierClients?.filter(c =>
    !clientSearch ||
    c.clientName.toLowerCase().includes(clientSearch.toLowerCase()) ||
    (c.clientCode && c.clientCode.toLowerCase().includes(clientSearch.toLowerCase()))
  ) || [];

  if (isLoadingSummary) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        <span className="ml-3 text-lg text-slate-500">Cargando programa de lealtad...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="panoramica-market">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-3 mb-1">
          <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center">
            <Gift className="h-5 w-5" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Panorámica Market</h2>
        </div>
        <p className="text-slate-400 text-sm">
          Programa de incentivos y categorías de clientes basado en compras
        </p>
      </div>

      {/* Global KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-slate-200 dark:border-slate-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                <Users className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{totalClients}</p>
                <p className="text-xs text-slate-500">Clientes activos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200 dark:border-slate-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatCurrency(totalSales)}</p>
                <p className="text-xs text-slate-500">Ventas totales</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200 dark:border-slate-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <Award className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{tiersSummary?.length || 0}</p>
                <p className="text-xs text-slate-500">Categorías activas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200 dark:border-slate-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <Gift className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{totalBenefits}</p>
                <p className="text-xs text-slate-500">Beneficios totales</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Master-Detail Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">

        {/* Sidebar: Tier Cards */}
        <div className="space-y-3">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-1">Categorías</p>
          {tiersSummary?.map((tier) => {
            const isSelected = selectedTier?.id === tier.id;
            return (
              <div
                key={tier.id}
                className={`relative rounded-xl border p-4 cursor-pointer transition-all duration-200 ${isSelected
                    ? 'border-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/20 shadow-sm ring-1 ring-indigo-400/50'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-sm'
                  }`}
                onClick={() => { setSelectedTier(tier); setClientSearch(""); }}
                data-testid={`tier-card-${tier.codigo}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="h-9 w-9 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: tier.colorPrimario || '#6366f1' }}
                    >
                      {getTierIcon(tier.codigo, "h-5 w-5 text-white")}
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm text-slate-900 dark:text-white">{tier.nombre}</h3>
                      <p className="text-xs text-slate-500">Mín. {formatCurrency(Number(tier.montoMinimo))}</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={(e) => { e.stopPropagation(); handleEditTier(tier); }}
                    data-testid={`button-edit-tier-${tier.codigo}`}
                  >
                    <Settings className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-1.5 text-slate-500">
                    <Users className="h-3.5 w-3.5" />
                    <span className="font-medium text-slate-700 dark:text-slate-300">{tier.clientCount || 0}</span> clientes
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-500">
                    <TrendingUp className="h-3.5 w-3.5" />
                    <span className="font-medium text-emerald-600">{formatCurrency(tier.totalSales || 0)}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-500">
                    <Calendar className="h-3.5 w-3.5" />
                    {tier.periodoEvaluacionDias} días
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-500">
                    <Gift className="h-3.5 w-3.5" />
                    <span className="font-medium text-slate-700 dark:text-slate-300">{tier.benefitCount || 0}</span> beneficios
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Detail Panel */}
        {selectedTier ? (
          <Card className="border-slate-200 dark:border-slate-800">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="h-10 w-10 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: selectedTier.colorPrimario || '#6366f1' }}
                  >
                    {getTierIcon(selectedTier.codigo, "h-5 w-5 text-white")}
                  </div>
                  <div>
                    <CardTitle className="text-lg">{selectedTier.nombre}</CardTitle>
                    <CardDescription className="text-xs">
                      {selectedTier.descripcion || `Clientes con mín. ${formatCurrency(Number(selectedTier.montoMinimo))} en ${selectedTier.periodoEvaluacionDias} días`}
                    </CardDescription>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="clients" className="w-full">
                <TabsList className="flex w-full gap-1 h-auto p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                  <TabsTrigger
                    value="clients"
                    data-testid="tab-tier-clients"
                    className="flex flex-1 items-center justify-center gap-2 py-2 text-sm font-medium rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-slate-900"
                  >
                    <Users className="h-4 w-4" />
                    Clientes ({tierClients?.length || 0})
                  </TabsTrigger>
                  <TabsTrigger
                    value="benefits"
                    data-testid="tab-tier-benefits"
                    className="flex flex-1 items-center justify-center gap-2 py-2 text-sm font-medium rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-slate-900"
                  >
                    <Gift className="h-4 w-4" />
                    Beneficios ({tierBenefits?.length || 0})
                  </TabsTrigger>
                </TabsList>

                {/* Clients Tab */}
                <TabsContent value="clients" className="mt-4">
                  {/* Search */}
                  <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      placeholder="Buscar cliente por nombre o código..."
                      value={clientSearch}
                      onChange={(e) => setClientSearch(e.target.value)}
                      className="pl-10 rounded-xl"
                      data-testid="input-search-clients"
                    />
                  </div>

                  {isLoadingClients ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
                    </div>
                  ) : filteredClients.length > 0 ? (
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-slate-50 dark:bg-slate-800/50">
                            <TableHead className="font-semibold">Cliente</TableHead>
                            <TableHead className="font-semibold">Código</TableHead>
                            <TableHead className="text-right font-semibold">Ventas (90d)</TableHead>
                            <TableHead className="text-right font-semibold">Transacciones</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredClients.map((client, idx) => (
                            <TableRow key={idx} data-testid={`row-client-${idx}`}>
                              <TableCell className="font-medium">{client.clientName}</TableCell>
                              <TableCell className="text-slate-500">{client.clientCode || '-'}</TableCell>
                              <TableCell className="text-right font-semibold text-emerald-600">
                                {formatCurrency(client.totalSales)}
                              </TableCell>
                              <TableCell className="text-right">
                                <Badge variant="secondary" className="rounded-full">{client.transactionCount}</Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="text-center py-12 text-slate-400">
                      <Users className="h-12 w-12 mx-auto mb-3 opacity-40" />
                      <p className="font-medium text-slate-500">
                        {clientSearch ? 'Sin resultados para la búsqueda' : 'No hay clientes en esta categoría'}
                      </p>
                      <p className="text-sm mt-1">
                        {clientSearch
                          ? 'Intenta con otro nombre o código'
                          : `Clientes con al menos ${formatCurrency(Number(selectedTier.montoMinimo))} en ${selectedTier.periodoEvaluacionDias} días aparecerán aquí`
                        }
                      </p>
                    </div>
                  )}
                </TabsContent>

                {/* Benefits Tab */}
                <TabsContent value="benefits" className="mt-4">
                  <div className="flex justify-end mb-4">
                    <Button
                      onClick={() => setIsAddBenefitOpen(true)}
                      className="rounded-xl bg-indigo-600 hover:bg-indigo-700"
                      data-testid="button-add-benefit"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Agregar Beneficio
                    </Button>
                  </div>

                  {isLoadingBenefits ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
                    </div>
                  ) : tierBenefits && tierBenefits.length > 0 ? (
                    <div className="space-y-3">
                      {tierBenefits.map((benefit) => (
                        <div
                          key={benefit.id}
                          className="p-4 border border-slate-200 dark:border-slate-800 rounded-xl flex items-start justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                          data-testid={`benefit-${benefit.id}`}
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge
                                variant={
                                  benefit.tipo === 'beneficio' ? 'default' :
                                    benefit.tipo === 'termino' ? 'secondary' : 'outline'
                                }
                                className="rounded-full text-xs"
                              >
                                {benefit.tipo === 'beneficio' ? '🎁 Beneficio' :
                                  benefit.tipo === 'termino' ? '📋 Término' : '⚡ Condición'}
                              </Badge>
                              {benefit.valor && (
                                <span className="text-sm font-semibold text-emerald-600">{benefit.valor}</span>
                              )}
                            </div>
                            <h4 className="font-medium text-sm">{benefit.titulo}</h4>
                            {benefit.descripcion && (
                              <p className="text-xs text-slate-500 mt-1">{benefit.descripcion}</p>
                            )}
                          </div>
                          <div className="flex gap-1 ml-3">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => setEditingBenefit(benefit)}
                              data-testid={`button-edit-benefit-${benefit.id}`}
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                              onClick={() => deleteBenefitMutation.mutate(benefit.id)}
                              data-testid={`button-delete-benefit-${benefit.id}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-slate-400">
                      <Gift className="h-12 w-12 mx-auto mb-3 opacity-40" />
                      <p className="font-medium text-slate-500">No hay beneficios configurados</p>
                      <p className="text-sm mt-1">
                        Agrega beneficios, términos o condiciones para esta categoría
                      </p>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-slate-200 dark:border-slate-800 flex items-center justify-center min-h-[400px]">
            <div className="text-center text-slate-400">
              <Award className="h-16 w-16 mx-auto mb-3 opacity-30" />
              <p className="font-medium text-slate-500">Selecciona una categoría</p>
              <p className="text-sm mt-1">Haz click en una categoría para ver sus clientes y beneficios</p>
            </div>
          </Card>
        )}
      </div>

      {/* Dialog: Edit Tier */}
      <Dialog open={isEditTierOpen} onOpenChange={setIsEditTierOpen}>
        <DialogContent className="sm:max-w-[480px] p-0 gap-0 rounded-2xl overflow-hidden">
          <div className="flex items-center gap-3 px-6 pt-6 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="h-10 w-10 rounded-xl bg-indigo-600 flex items-center justify-center">
              <Settings className="h-5 w-5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">Editar Categoría</DialogTitle>
              <DialogDescription className="text-xs text-slate-500">Configura los parámetros de esta categoría</DialogDescription>
            </div>
          </div>
          <div className="px-6 py-5 space-y-4">
            <div>
              <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Nombre</Label>
              <Input
                value={tierForm.nombre}
                onChange={(e) => setTierForm({ ...tierForm, nombre: e.target.value })}
                className="rounded-xl mt-1"
                data-testid="input-tier-name"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Descripción</Label>
              <Textarea
                value={tierForm.descripcion}
                onChange={(e) => setTierForm({ ...tierForm, descripcion: e.target.value })}
                className="rounded-xl mt-1"
                data-testid="input-tier-description"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Monto Mínimo (CLP)</Label>
                <Input
                  type="number"
                  value={tierForm.montoMinimo}
                  onChange={(e) => setTierForm({ ...tierForm, montoMinimo: e.target.value })}
                  className="rounded-xl mt-1"
                  data-testid="input-tier-amount"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Período (días)</Label>
                <Input
                  type="number"
                  value={tierForm.periodoEvaluacionDias}
                  onChange={(e) => setTierForm({ ...tierForm, periodoEvaluacionDias: parseInt(e.target.value) })}
                  className="rounded-xl mt-1"
                  data-testid="input-tier-period"
                />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/50">
            <Button variant="outline" onClick={() => setIsEditTierOpen(false)} className="rounded-xl">
              Cancelar
            </Button>
            <Button
              onClick={handleSaveTier}
              disabled={updateTierMutation.isPending}
              className="rounded-xl bg-indigo-600 hover:bg-indigo-700"
              data-testid="button-save-tier"
            >
              {updateTierMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Guardar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: Add Benefit */}
      <Dialog open={isAddBenefitOpen} onOpenChange={setIsAddBenefitOpen}>
        <DialogContent className="sm:max-w-[480px] p-0 gap-0 rounded-2xl overflow-hidden">
          <div className="flex items-center gap-3 px-6 pt-6 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="h-10 w-10 rounded-xl bg-indigo-600 flex items-center justify-center">
              <Plus className="h-5 w-5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">Agregar Beneficio</DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Agrega un beneficio, término o condición a {selectedTier?.nombre}
              </DialogDescription>
            </div>
          </div>
          <div className="px-6 py-5 space-y-4">
            <div>
              <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tipo</Label>
              <Select value={benefitForm.tipo} onValueChange={(v) => setBenefitForm({ ...benefitForm, tipo: v })}>
                <SelectTrigger className="rounded-xl mt-1" data-testid="select-benefit-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="beneficio">🎁 Beneficio</SelectItem>
                  <SelectItem value="termino">📋 Término</SelectItem>
                  <SelectItem value="condicion">⚡ Condición</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Título</Label>
              <Input
                value={benefitForm.titulo}
                onChange={(e) => setBenefitForm({ ...benefitForm, titulo: e.target.value })}
                placeholder="Ej: Descuento en compras"
                className="rounded-xl mt-1"
                data-testid="input-benefit-title"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Valor (opcional)</Label>
              <Input
                value={benefitForm.valor}
                onChange={(e) => setBenefitForm({ ...benefitForm, valor: e.target.value })}
                placeholder="Ej: 5%, Envío gratis"
                className="rounded-xl mt-1"
                data-testid="input-benefit-value"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Descripción (opcional)</Label>
              <Textarea
                value={benefitForm.descripcion}
                onChange={(e) => setBenefitForm({ ...benefitForm, descripcion: e.target.value })}
                placeholder="Descripción detallada"
                className="rounded-xl mt-1"
                data-testid="input-benefit-description"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/50">
            <Button variant="outline" onClick={() => setIsAddBenefitOpen(false)} className="rounded-xl">
              Cancelar
            </Button>
            <Button
              onClick={handleAddBenefit}
              disabled={!benefitForm.titulo || createBenefitMutation.isPending}
              className="rounded-xl bg-indigo-600 hover:bg-indigo-700"
              data-testid="button-save-benefit"
            >
              {createBenefitMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Agregar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: Edit Benefit */}
      <Dialog open={!!editingBenefit} onOpenChange={() => setEditingBenefit(null)}>
        <DialogContent className="sm:max-w-[480px] p-0 gap-0 rounded-2xl overflow-hidden">
          <div className="flex items-center gap-3 px-6 pt-6 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="h-10 w-10 rounded-xl bg-indigo-600 flex items-center justify-center">
              <Edit className="h-5 w-5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">Editar Beneficio</DialogTitle>
              <DialogDescription className="text-xs text-slate-500">Modifica los datos del beneficio</DialogDescription>
            </div>
          </div>
          {editingBenefit && (
            <div className="px-6 py-5 space-y-4">
              <div>
                <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tipo</Label>
                <Select value={editingBenefit.tipo} onValueChange={(v) => setEditingBenefit({ ...editingBenefit, tipo: v })}>
                  <SelectTrigger className="rounded-xl mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="beneficio">🎁 Beneficio</SelectItem>
                    <SelectItem value="termino">📋 Término</SelectItem>
                    <SelectItem value="condicion">⚡ Condición</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Título</Label>
                <Input
                  value={editingBenefit.titulo}
                  onChange={(e) => setEditingBenefit({ ...editingBenefit, titulo: e.target.value })}
                  className="rounded-xl mt-1"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Valor (opcional)</Label>
                <Input
                  value={editingBenefit.valor || ""}
                  onChange={(e) => setEditingBenefit({ ...editingBenefit, valor: e.target.value })}
                  className="rounded-xl mt-1"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Descripción (opcional)</Label>
                <Textarea
                  value={editingBenefit.descripcion || ""}
                  onChange={(e) => setEditingBenefit({ ...editingBenefit, descripcion: e.target.value })}
                  className="rounded-xl mt-1"
                />
              </div>
            </div>
          )}
          <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/50">
            <Button variant="outline" onClick={() => setEditingBenefit(null)} className="rounded-xl">
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
              className="rounded-xl bg-indigo-600 hover:bg-indigo-700"
            >
              {updateBenefitMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Guardar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
