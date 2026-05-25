import { useState, useEffect, useMemo, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useAiChat } from "@/hooks/useAiChat";
import { getNumericOrderId } from "@/lib/utils";
import AiChatView from "@/components/ai-chat/AiChatView";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Package,
  Bot,
  Search,
  Loader2,
  ShoppingCart,
  Truck,
  FileCheck,
  DollarSign,
  Calendar,
  User,
  ClipboardList,
  TrendingUp,
  Gift,
  Star,
  Award,
  Crown,
  ChevronRight,
  ArrowRight,
  BarChart3,
  ExternalLink,
  FileText,
} from "lucide-react";

// ==========================================
// Helpers
// ==========================================

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

const formatDate = (dateStr: string) => {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  return date.toLocaleDateString("es-CL", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

// ==========================================
// Types
// ==========================================

interface NVVRecord {
  id: string;
  NUDO: string;
  TIDO: string;
  FEEMDO: string;
  ENDO: string;
  NOKOEN: string;
  NOKOPR: string;
  KOPRCT: string;
  CAPREX2: number;
  CAPRCO2: number;
  PPPRNE: number;
  cantidadPendiente: number;
  totalPendiente: number;
}

interface GDVRecord {
  numeroGuia: string;
  fecha: string;
  cliente: string;
  codigoCliente: string;
  producto: string;
  cantidad: number;
  monto: number;
}

const CLIENT_AI_SUGGESTIONS = [
  "¿Qué pinturas tienen para exterior?",
  "¿Qué esmaltes al agua tienen?",
  "Quiero cotizar productos para una obra",
  "¿Tienen barniz marino?",
  "¿Qué productos recomiendan para humedad?",
  "Necesito pintura para metal",
];

// ==========================================
// Profile Edit Component
// ==========================================

function ProfileEditDialog({ open, onOpenChange }: { open: boolean, onOpenChange: (o: boolean) => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState(user?.email || "");
  const [password, setPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/auth/update-profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Error al actualizar perfil");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Perfil actualizado", description: data.message });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Editar Perfil</DialogTitle>
          <DialogDescription>
            Actualiza tu correo de acceso y contraseña. Necesitarás tu contraseña actual para confirmar los cambios.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="email" className="text-sm font-medium">Correo Electrónico</Label>
            <Input 
              id="email" 
              type="email" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              className="rounded-xl"
              placeholder="ejemplo@correo.com"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">Nueva Contraseña (opcional)</Label>
            <Input 
              id="password" 
              type="password" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              className="rounded-xl" 
              placeholder="Mínimo 6 caracteres" 
            />
          </div>
          <div className="grid gap-2 pt-2 border-t mt-2">
            <Label htmlFor="currentPassword">Contraseña Actual <span className="text-red-500">*</span></Label>
            <Input 
              id="currentPassword" 
              type="password" 
              value={currentPassword} 
              onChange={e => setCurrentPassword(e.target.value)} 
              className="rounded-xl border-orange-200 focus-visible:ring-orange-500" 
            />
            <p className="text-[10px] text-muted-foreground">Obligatorio para cualquier cambio.</p>
          </div>
        </div>
        <DialogFooter className="flex gap-2">
          <Button variant="ghost" className="rounded-xl" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button 
            className="rounded-xl bg-blue-600 hover:bg-blue-700" 
            disabled={updateMutation.isPending || !currentPassword} 
            onClick={() => updateMutation.mutate({ email, password, currentPassword })}
          >
            {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Guardar Cambios
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ==========================================
// Dashboard Tab
// ==========================================

function DashboardTab({ salesperson }: { salesperson: string }) {
  const [showProfileModal, setShowProfileModal] = useState(false);
  // Fetch Web Orders (eCommerce) directly for the client
  const { data: webOrders = [], isLoading: webLoading } = useQuery<any[]>({
    queryKey: ["/api/ecommerce/client/orders"],
    queryFn: async () => {
      const res = await fetch(`/api/ecommerce/client/orders`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    }
  });

  // Fetch ERP Orders directly for the client
  const { data: erpData, isLoading: erpLoading } = useQuery({
    queryKey: ["/api/ecommerce/client/erp-orders"],
    queryFn: async () => {
      const res = await fetch(`/api/ecommerce/client/erp-orders`, { credentials: "include" });
      if (!res.ok) return { nvv: [], gdv: [], transactions: [] };
      return res.json();
    }
  });

  // Fetch client data to get credit condition
  const { user } = useAuth();
  const { data: clientData, isLoading: clientLoading } = useQuery<{ cpen?: string; crlt?: string; cren?: string; crsd?: string; }>({
    queryKey: ['/api/clients/by-user', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const res = await fetch(`/api/clients/by-user/${user.id}`, { credentials: 'include' });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!user?.id && user?.role === 'client',
  });

  const isLoading = webLoading || erpLoading || clientLoading;

  const rawName = (user as any)?.salespersonName || (user as any)?.name || (user as any)?.username || salesperson || "Cliente";
  const firstName = (() => {
    const f = String(rawName).trim().split(/\s+/)[0] || "Cliente";
    return f.charAt(0).toUpperCase() + f.slice(1).toLowerCase();
  })();

  // Compute metrics from Web Orders.
  // Incluimos todos los estados activos del flujo (pending → approved → sent → ingresado),
  // descartando sólo los terminales/cancelados (rejected/archived). Antes el filtro dejaba
  // fuera 'sent' e 'ingresado', así que clientes MCT — cuyos pedidos avanzan rápido al ERP —
  // veían "No hay pedidos registrados" apenas el admin marcaba el pedido como enviado.
  const validOrders = useMemo(() => {
    return webOrders.filter((o: any) => {
      const s = (o.status || '').toLowerCase();
      // Excluimos sugeridos pendientes: aún no son pedidos confirmados por el cliente.
      return s !== 'rejected' && s !== 'archived' && s !== 'suggested_pending';
    });
  }, [webOrders]);

  const totalAmount = useMemo(() => {
    let sum = validOrders.reduce((acc, o) => acc + (Number(o.total) || 0), 0);
    if (erpData?.nvv) {
       sum += erpData.nvv.reduce((acc: number, o: any) => acc + (Number(o.VABRDO) || 0), 0);
    }
    if (erpData?.transactions) {
       // Omitir NVV para no duplicar si consideramos todo histórico facturado,
       // o sumar transactions y quitar nvv. Para historial global sumamos facturado.
       // actually the previous design was sum of everything.
       sum += erpData.transactions.reduce((acc: number, o: any) => acc + (Number(o.vabrdo) || Number(o.amount) || 0), 0);
    }
    return sum;
  }, [validOrders, erpData]);

  const totalUnits = useMemo(() => {
    let sum = validOrders.reduce((acc, o) => {
      return acc + (o.items?.reduce((sum2: number, item: any) => sum2 + item.quantity, 0) || 0);
    }, 0);
    if (erpData?.nvv) {
       sum += erpData.nvv.reduce((acc: number, o: any) => acc + (Number(o.CAPRCO2) || 0), 0);
    }
    if (erpData?.transactions) {
       sum += erpData.transactions.reduce((acc: number, o: any) => acc + (Number(o.caprad) || 0), 0);
    }
    return sum;
  }, [validOrders, erpData]);

  const totalOrdersCount = useMemo(() => {
    return validOrders.length + (erpData?.nvv?.length || 0) + (erpData?.transactions?.length || 0);
  }, [validOrders, erpData]);

  // Compute Top Products
  const topProducts = useMemo(() => {
    const productMap: Record<string, { name: string; qty: number; timesOrdered: number; price: number }> = {};
    
    // Add Web Orders
    validOrders.forEach((o: any) => {
      if (!o.items) return;
      o.items.forEach((item: any) => {
        if (!productMap[item.productId]) {
          productMap[item.productId] = { 
            name: item.productName, 
            qty: 0, 
            timesOrdered: 0,
            price: Number(item.unitPrice) || 0
          };
        }
        productMap[item.productId].qty += item.quantity;
        productMap[item.productId].timesOrdered += 1;
      });
    });

    // Add ERP NVV
    if (erpData?.nvv) {
      erpData.nvv.forEach((row: any) => {
        if (!row.KOPRCT && !row.NOKOPR) return;
        const code = row.KOPRCT || row.NOKOPR; // Use name as fallback ID if code is empty
        if (!productMap[code]) {
           productMap[code] = {
             name: row.NOKOPR,
             qty: 0,
             timesOrdered: 0,
             price: Number(row.PPPRNE) || 0
           };
        }
        productMap[code].qty += Number(row.CAPRCO2) || 0;
        productMap[code].timesOrdered += 1;
      });
    }

    // Add ERP Transactions (Invoices)
    if (erpData?.transactions) {
      erpData.transactions.forEach((row: any) => {
        if (!row.koprct && !row.nokoprct) return;
        const code = row.koprct || row.nokoprct;
        if (!productMap[code]) {
           productMap[code] = {
             name: row.nokoprct,
             qty: 0,
             timesOrdered: 0,
             price: Number(row.precio) || 0
           };
        }
        productMap[code].qty += Number(row.caprad) || Number(row.caprad2) || 0;
        productMap[code].timesOrdered += 1;
      });
    }

    return Object.values(productMap).sort((a,b) => b.qty - a.qty).slice(0, 5);
  }, [validOrders, erpData]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome header — saludo personalizado */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-7 text-white">
        <div className="absolute -top-16 -right-10 w-72 h-72 bg-[#FF6E23]/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-20 -left-10 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl" />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#FF6E23]">Tu portal de compras</p>
            <h2 className="text-3xl sm:text-4xl font-black mt-1 leading-tight">
              Hola, <span className="text-[#FF6E23]">{firstName}</span>
            </h2>
            <p className="text-slate-300 text-sm mt-2 max-w-xl">
              Acá tenés tus métricas, pedidos, seguimiento de despachos y documentos — todo en un solo lugar.
            </p>
          </div>
          <Button
            variant="outline"
            className="bg-white/10 border-white/20 hover:bg-white/20 text-white rounded-xl shadow-lg backdrop-blur-sm flex-shrink-0"
            onClick={() => setShowProfileModal(true)}
          >
            <User className="w-4 h-4 mr-2" />
            Editar Perfil
          </Button>
        </div>
      </div>

      <ProfileEditDialog 
        open={showProfileModal} 
        onOpenChange={setShowProfileModal} 
      />

      {/* Metric Cards */}
      <div className={`grid grid-cols-1 sm:grid-cols-2 ${clientData && (clientData.cpen?.toUpperCase().includes('CREDITO') || clientData.cpen?.toUpperCase().includes('CRÉDITO') || Number(clientData.crlt) > 0) ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-4`}>
        <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-blue-50 to-blue-100/50">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 rounded-xl bg-blue-500/10">
                <ShoppingCart className="h-5 w-5 text-blue-600" />
              </div>
              <Badge className="bg-blue-100 text-blue-700 text-[10px] border-0">Total</Badge>
            </div>
            <p className="text-2xl font-bold text-blue-900">{totalOrdersCount}</p>
            <p className="text-xs text-blue-600 mt-1">Pedidos históricos generados</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-purple-50 to-purple-100/50">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 rounded-xl bg-purple-500/10">
                <Package className="h-5 w-5 text-purple-600" />
              </div>
              <Badge className="bg-purple-100 text-purple-700 text-[10px] border-0">Items</Badge>
            </div>
            <p className="text-2xl font-bold text-purple-900">{totalUnits.toLocaleString('es-CL')}</p>
            <p className="text-xs text-purple-600 mt-1">Unidades totales despachadas/pendientes</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-amber-50 to-amber-100/50">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 rounded-xl bg-amber-500/10">
                <DollarSign className="h-5 w-5 text-amber-600" />
              </div>
              <Badge className="bg-amber-100 text-amber-700 text-[10px] border-0">Valor</Badge>
            </div>
            <p className="text-2xl font-bold text-amber-900">{formatCurrency(totalAmount)}</p>
            <p className="text-xs text-amber-600 mt-1">Volumen de compra histórico</p>
          </CardContent>
        </Card>

        {/* Credit Card if applicable */}
        {clientData && (clientData.cpen?.toUpperCase().includes('CREDITO') || clientData.cpen?.toUpperCase().includes('CRÉDITO') || Number(clientData.crlt) > 0) && (() => {
          const creditLimit = Number(clientData.crlt || 0);
          const creditUsed = Number(clientData.crsd || 0);
          const creditAvailable = creditLimit - creditUsed;
          
          return (
            <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-emerald-50 to-emerald-100/50">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 rounded-xl bg-emerald-500/10">
                    <ClipboardList className="h-5 w-5 text-emerald-600" />
                  </div>
                  <Badge className={`text-[10px] border-0 ${creditAvailable < 0 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                    Línea: {formatCurrency(creditLimit)}
                  </Badge>
                </div>
                <p className={`text-2xl font-bold ${creditAvailable < 0 ? 'text-red-600' : 'text-emerald-900'}`}>
                  {formatCurrency(creditAvailable)}
                </p>
                <div className="flex justify-between items-center mt-1">
                  <p className={`text-xs ${creditAvailable < 0 ? 'text-red-500' : 'text-emerald-600'}`}>Cupo Disponible</p>
                  {clientData.cpen?.match(/\d+/) && (
                    <span className="text-[10px] text-emerald-700 font-medium">Plazo: {clientData.cpen.match(/\d+/)?.[0]} días</span>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })()}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Most Sold Products */}
        <Card className="rounded-2xl border border-gray-100 shadow-sm h-full">
          <CardHeader className="pb-3 border-b border-gray-50 bg-gray-50/50 rounded-t-2xl">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2 text-gray-800">
                <TrendingUp className="h-4 w-4 text-emerald-500" />
                Tus Productos Más Comprados
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {topProducts.length === 0 ? (
              <div className="p-8 text-center">
                <Package className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">Aún no hay historial suficiente de productos.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {topProducts.map((prod, idx) => (
                  <div key={idx} className="p-4 flex items-center justify-between hover:bg-gray-50/80 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 shrink-0 bg-emerald-50 rounded-lg flex items-center justify-center font-bold text-emerald-600">
                        #{idx + 1}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 line-clamp-1">{prod.name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">En {prod.timesOrdered} pedido(s) distintos</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-4">
                      <p className="text-sm font-bold text-gray-800">{prod.qty} uds</p>
                      <p className="text-[10px] text-gray-400">Total acumulado</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Last pending orders quick view */}
        <Card className="rounded-2xl border border-gray-100 shadow-sm h-full">
          <CardHeader className="pb-3 border-b border-gray-50 bg-gray-50/50 rounded-t-2xl">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2 text-gray-800">
                <ShoppingCart className="h-4 w-4 text-blue-500" />
                Pedidos Recientes Web
              </CardTitle>
              <a href="/mis-pedidos" className="text-xs text-blue-600 font-semibold flex items-center hover:underline">
                Ver todos <ArrowRight className="h-3 w-3 ml-1" />
              </a>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {validOrders.length === 0 ? (
              <div className="p-8 text-center">
                <ClipboardList className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No hay pedidos registrados.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {validOrders.slice(0, 5).map((r: any) => (
                  <div key={r.id} className="p-4 flex items-center justify-between hover:bg-gray-50/80 transition-colors">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-gray-900 truncate">
                          {r.items?.length === 1 ? r.items[0].productName : `Mix de Productos (${r.items?.length || 0})`}
                        </p>
                        <Badge variant="secondary" className="text-[9px] px-1.5 font-normal tracking-wide">
                          {statusConfig[(r.status || 'pending').toLowerCase()]?.label || r.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs font-mono text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">{getNumericOrderId(r.id)}</span>
                        <span className="text-[10px] text-gray-400">·</span>
                        <span className="text-[11px] text-gray-500 font-medium flex items-center gap-1">
                          <Calendar className="h-3 w-3" /> {formatDate(r.createdAt)}
                        </span>
                      </div>
                    </div>
                    <div className="text-right ml-4">
                      <p className="text-sm font-bold text-amber-600">{formatCurrency(Number(r.total))}</p>
                      <p className="text-[11px] text-gray-500">{r.items?.reduce((acc: number, val: any) => acc + val.quantity, 0)} uds</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
        <a href="/tienda" className="flex items-center gap-3 p-4 rounded-2xl bg-white border border-gray-100 hover:border-orange-200 hover:shadow-md transition-all group">
          <div className="p-2.5 rounded-xl bg-orange-50 group-hover:bg-orange-100 transition-colors">
            <ShoppingCart className="h-5 w-5 text-orange-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900">Ir a la Tienda</p>
            <p className="text-[10px] text-gray-500">Explorar catálogo y comprar</p>
          </div>
          <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-orange-400 transition-colors" />
        </a>
        <a href="/mis-pedidos" className="flex items-center gap-3 p-4 rounded-2xl bg-white border border-gray-100 hover:border-blue-200 hover:shadow-md transition-all group">
          <div className="p-2.5 rounded-xl bg-blue-50 group-hover:bg-blue-100 transition-colors">
            <ClipboardList className="h-5 w-5 text-blue-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900">Ver Pedidos</p>
            <p className="text-[10px] text-gray-500">Seguimiento y despachos</p>
          </div>
          <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-blue-400 transition-colors" />
        </a>
        <a href="/mis-documentos" className="flex items-center gap-3 p-4 rounded-2xl bg-white border border-gray-100 hover:border-emerald-200 hover:shadow-md transition-all group">
          <div className="p-2.5 rounded-xl bg-emerald-50 group-hover:bg-emerald-100 transition-colors">
            <FileText className="h-5 w-5 text-emerald-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900">Documentos</p>
            <p className="text-[10px] text-gray-500">Facturas y guías de despacho</p>
          </div>
          <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-emerald-400 transition-colors" />
        </a>
      </div>
    </div>
  );
}

// ==========================================
// Pedidos Tab (Lista Única Consolidada)
// ==========================================
import React from 'react';
import { OrderDetailView, EcommerceOrder, getOrderItems, statusConfig } from "@/components/ecommerce/order-detail-view";
import { ChevronDown, ChevronUp, Repeat, Sparkles, Check, X as XIcon, Pencil, ImageIcon } from "lucide-react";
import { useCart } from "@/hooks/useCart";
import { useQueryClient } from "@tanstack/react-query";
import { Textarea } from "@/components/ui/textarea";
import { SuggestedOrderModal } from "@/components/panoramica-market/suggested-order-modal";
import { groupFacturas, groupDespachos } from "@/components/ecommerce/client-documents";

// ==========================================
// Suggested Orders Panel — sugeridos pendientes
// ==========================================

function SuggestedOrdersPanel({ orders }: { orders: any[] }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [rejecting, setRejecting] = useState<any | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [editing, setEditing] = useState<any | null>(null);

  const acceptMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const res = await fetch(`/api/ecommerce/orders/${orderId}/suggested-accept`, {
        method: "POST", credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message || "No se pudo aceptar");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Sugerido aceptado", description: "Tu pedido pasa a revisión del equipo." });
      qc.invalidateQueries({ queryKey: ["/api/ecommerce/client/orders"] });
    },
    onError: (err: any) => toast({ title: "Error", description: err?.message, variant: "destructive" }),
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const res = await fetch(`/api/ecommerce/orders/${id}/suggested-reject`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message || "No se pudo rechazar");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Sugerido rechazado", description: "Le avisamos al equipo." });
      qc.invalidateQueries({ queryKey: ["/api/ecommerce/client/orders"] });
      setRejecting(null);
      setRejectReason("");
    },
    onError: (err: any) => toast({ title: "Error", description: err?.message, variant: "destructive" }),
  });

  if (!orders || orders.length === 0) return null;

  return (
    <>
      <div className="relative overflow-hidden rounded-3xl border border-orange-200/70 bg-gradient-to-br from-orange-50 via-amber-50 to-white p-5 sm:p-6 shadow-sm">
        <div className="absolute -top-12 -right-8 w-48 h-48 bg-[#FF6E23]/10 rounded-full blur-3xl" />
        <div className="relative flex items-start gap-3 mb-5">
          <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-[#FF6E23] to-[#E55E13] flex items-center justify-center flex-shrink-0 shadow-lg shadow-orange-500/30">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0">
            <h3 className="text-lg font-black text-slate-900">
              {orders.length} pedido{orders.length !== 1 ? "s" : ""} sugerido{orders.length !== 1 ? "s" : ""} para vos
            </h3>
            <p className="text-sm text-slate-600 mt-0.5">
              Nuestro equipo armó {orders.length !== 1 ? "estos pedidos" : "este pedido"} pensando en vos. Aceptalo, ajustalo a tu gusto o rechazalo.
            </p>
          </div>
        </div>

        <div className="relative grid grid-cols-1 gap-4">
          {orders.map((o) => {
            const items = getOrderItems(o);
            const totalUnits = items.reduce((s: number, it: any) => s + Number(it.quantity || 0), 0);
            const isAccepting = acceptMutation.isPending && acceptMutation.variables === o.id;
            return (
              <div key={o.id} className="rounded-2xl bg-white border border-orange-100 shadow-sm overflow-hidden">
                {/* Cabecera de la tarjeta */}
                <div className="flex items-center justify-between gap-3 px-4 py-3 bg-gradient-to-r from-orange-50/80 to-transparent border-b border-orange-100/70">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold bg-[#FF6E23]/10 text-[#E55E13] px-2 py-0.5 rounded-md">
                        #{getNumericOrderId(o.id)}
                      </span>
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> {formatDate(o.createdAt)}
                      </span>
                    </div>
                    {o.suggestedByName && (
                      <p className="text-[11px] text-slate-500 mt-1">
                        Preparado por <strong className="text-slate-700">{o.suggestedByName}</strong>
                      </p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xl font-black text-[#FF6E23] leading-none">{formatCurrency(Number(o.total))}</p>
                    <p className="text-[10px] text-slate-400 mt-1">{totalUnits} unidad{totalUnits !== 1 ? "es" : ""} · {items.length} ítem{items.length !== 1 ? "s" : ""}</p>
                  </div>
                </div>

                {/* Items con miniatura */}
                <div className="px-4 py-3 space-y-2 max-h-[220px] overflow-y-auto">
                  {items.slice(0, 8).map((it: any, idx: number) => (
                    <div key={idx} className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {it.imageUrl ? (
                          <img src={it.imageUrl} alt="" className="w-full h-full object-contain p-0.5" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                        ) : (
                          <ImageIcon className="h-4 w-4 text-slate-300" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-slate-700 truncate">{it.productName}</p>
                        {(it.selectedColor || it.selectedPackaging) && (
                          <p className="text-[10px] text-slate-400 truncate">
                            {[it.selectedColor, it.selectedPackaging].filter(Boolean).join(" · ")}
                          </p>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-500 flex-shrink-0 tabular-nums">
                        {it.quantity} × {formatCurrency(Number(it.unitPrice || 0))}
                      </span>
                    </div>
                  ))}
                  {items.length > 8 && (
                    <p className="text-[10px] text-slate-400 text-center pt-1">
                      + {items.length - 8} producto{items.length - 8 !== 1 ? "s" : ""} más
                    </p>
                  )}
                </div>

                {o.notes && (
                  <div className="mx-4 mb-3 p-2.5 bg-amber-50 rounded-xl border border-amber-200">
                    <p className="text-[10px] font-bold text-amber-800 uppercase tracking-wider mb-0.5">Nota del equipo</p>
                    <p className="text-xs text-amber-900 whitespace-pre-wrap">{o.notes}</p>
                  </div>
                )}

                {/* Acciones */}
                <div className="flex flex-wrap gap-2 px-4 py-3 bg-slate-50/60 border-t border-slate-100">
                  <Button
                    onClick={() => acceptMutation.mutate(o.id)}
                    disabled={acceptMutation.isPending}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm h-9 rounded-xl flex-[2] min-w-[150px] font-bold shadow-sm shadow-emerald-500/20"
                  >
                    {isAccepting ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Check className="h-4 w-4 mr-1.5" />}
                    Aceptar pedido
                  </Button>
                  <Button
                    onClick={() => setEditing(o)}
                    variant="outline"
                    className="text-sm h-9 rounded-xl flex-1 min-w-[120px] border-[#FF6E23]/30 text-[#E55E13] hover:bg-orange-50 font-semibold"
                  >
                    <Pencil className="h-4 w-4 mr-1.5" />
                    Modificar
                  </Button>
                  <Button
                    onClick={() => setRejecting(o)}
                    variant="ghost"
                    className="text-sm h-9 rounded-xl flex-1 min-w-[110px] text-red-600 hover:bg-red-50 font-semibold"
                  >
                    <XIcon className="h-4 w-4 mr-1.5" />
                    Rechazar
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Dialog: rechazar */}
      <Dialog open={!!rejecting} onOpenChange={(o) => { if (!o) { setRejecting(null); setRejectReason(""); } }}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Rechazar sugerido</DialogTitle>
            <DialogDescription>
              Contanos brevemente por qué. El equipo podrá ajustar la próxima propuesta.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Motivo</Label>
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Ej: ya tengo stock, los precios no me cierran, etc."
              className="mt-1 rounded-xl"
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejecting(null); setRejectReason(""); }} className="rounded-xl">
              Cancelar
            </Button>
            <Button
              onClick={() => rejecting && rejectMutation.mutate({ id: rejecting.id, reason: rejectReason.trim() })}
              disabled={rejectReason.trim().length < 3 || rejectMutation.isPending}
              className="rounded-xl bg-red-600 hover:bg-red-700"
            >
              {rejectMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Rechazar sugerido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modificar: reutiliza el MISMO builder que usa el equipo para armar sugeridos */}
      {editing && (
        <SuggestedOrderModal
          open={!!editing}
          mode="modify"
          existingOrder={{
            id: editing.id,
            items: getOrderItems(editing),
            notes: editing.notes,
            clientName: editing.clientName,
          }}
          client={{ clientName: editing.clientName || "Mi cuenta" }}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}

function PedidosTab({ salesperson }: { salesperson: string }) {
  const [selectedOrder, setSelectedOrder] = useState<EcommerceOrder | null>(null);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const { clearCart, addItem } = useCart();
  const [, setLocation] = useLocation();

  const handleRepeatOrder = (e: React.MouseEvent, order: EcommerceOrder) => {
    e.stopPropagation();
    clearCart();
    const items = getOrderItems(order);
    
    items.forEach(it => {
      addItem({
        productId: it.productId || it.sku || it.productCode || `custom-${it.productName}`,
        productName: it.productName,
        productCode: it.productCode || it.sku || `PC-${new Date().getTime()}`,
        quantity: it.quantity,
        unitPrice: it.unitPrice || it.price || 0,
        unit: 'UN',
        minQuantity: 1,
        quantityStep: 1,
        imageUrl: it.imageUrl,
        selectedColor: it.selectedColor,
        selectedPackaging: it.selectedPackaging
      });
    });
    
    setLocation('/carrito');
  };

  // Fetch ERP Orders directly for the client (linked by RUT)
  const { data: erpData, isLoading: erpLoading } = useQuery({
    queryKey: ["/api/ecommerce/client/erp-orders"],
    queryFn: async () => {
      const res = await fetch(`/api/ecommerce/client/erp-orders`, { credentials: "include" });
      if (!res.ok) return { nvv: [], gdv: [], transactions: [] };
      return res.json();
    }
  });

  // Fetch Web pending orders
  const { data: webOrders = [], isLoading: webLoading } = useQuery<any[]>({
    queryKey: ["/api/ecommerce/client/orders"],
    queryFn: async () => {
      const res = await fetch(`/api/ecommerce/client/orders`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    }
  });

  // Helper to group ERP lines into full EcommerceOrder objects
  const groupErpOrders = (rows: any[], idField: string, statusText: string) => {
    const map = new Map<string, EcommerceOrder>();
    rows.forEach(row => {
      const id = row[idField] || row.nudo || row.NUDO;
      if (!id) return;
      const amount = Number(row.monto || row.PPPRNE || row.vabrdo || row.VABRDO || row.amount || 0);
      const qty = Number(row.cantidad || row.CAPRCO2 || row.caprad2 || row.caprad || 1);
      const docTotal = Number(row.vabrdo || row.VABRDO || amount || 0); // VABRDO is usually doc total in NVV
      const itemName = row.producto || row.nokopr || row.NOKOPR || row.nokoprct || row.productName || row.koprct || 'Producto ERP';
      
      const item = {
        productName: itemName,
        quantity: qty,
        unitPrice: amount / qty,
        totalPrice: docTotal > 0 ? docTotal : amount
      };
      
      if (map.has(id)) {
        const existing = map.get(id)!;
        (existing.items as any[]).push(item);
        // Do not accumulate docTotal if it represents the whole doc, but fallback safely
      } else {
        map.set(id, {
          id: String(id),
          clientName: row.NOKOEN || row.nokoen || row.clientName || 'Cliente B2B',
          status: statusText, // ingresado, despacho, facturado
          total: String(docTotal > 0 ? docTotal : amount),
          items: [item],
          createdAt: row.feemdo || row.FEEMDO || row.fecha || row.date || new Date().toISOString()
        });
      }
    });
    return Array.from(map.values());
  };

  const nvvOrders = groupErpOrders(erpData?.nvv || [], 'NUDO', 'ingresado');
  const gdvOrders = groupErpOrders(erpData?.gdv || [], 'numeroGuia', 'despacho');
  const txOrders = groupErpOrders(erpData?.transactions || [], 'documentNumber', 'facturado');

  // Adjuntamos el documento (factura/despacho) generable a cada pedido ERP, para que
  // el detalle del pedido permita ver/descargar el PDF correspondiente.
  const facturaByNum = new Map(groupFacturas(erpData?.transactions || []).map((d) => [d.numero, d]));
  const despachoByNum = new Map(groupDespachos(erpData?.gdv || []).map((d) => [d.numero, d]));
  gdvOrders.forEach((o) => { (o as any)._document = despachoByNum.get(String(o.id)); });
  txOrders.forEach((o) => { (o as any)._document = facturaByNum.get(String(o.id)); });

  // Sugeridos pendientes se muestran en panel aparte arriba de la tabla principal
  const suggestedPendingOrders = webOrders.filter((o: any) => o.status === 'suggested_pending');

  const unifiedWebOrders: EcommerceOrder[] = webOrders
    .filter((o: any) => o.status !== 'suggested_pending')
    .map((o: any) => ({
      ...o,
      status: o.status === 'pending' || o.status === 'pendiente' ? 'pendiente' : (o.status === 'approved' ? 'approved' : o.status),
      items: typeof o.items === 'string' ? JSON.parse(o.items) : o.items
    }));

  const allOrders = [...unifiedWebOrders, ...nvvOrders, ...gdvOrders, ...txOrders].sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Deep-link desde el correo "pedido modificado": /mis-pedidos?pedido=<id> abre ese pedido.
  const autoOpenedRef = useRef(false);
  useEffect(() => {
    if (autoOpenedRef.current) return;
    if (erpLoading || webLoading) return;
    const target = new URLSearchParams(window.location.search).get('pedido');
    if (!target) return;
    autoOpenedRef.current = true; // intento único, ya con los pedidos cargados
    const match = allOrders.find(o => String(o.id) === target);
    if (match) setSelectedOrder(match);
  }, [allOrders, erpLoading, webLoading]);

  if (selectedOrder) {
    return (
      <div className="bg-white p-6 rounded-2xl border min-h-[500px]">
        <OrderDetailView 
          order={selectedOrder} 
          onBack={() => setSelectedOrder(null)} 
          isClientView={true} 
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Sugeridos pendientes (admin/supervisor envía pre-armado al cliente) */}
      <SuggestedOrdersPanel orders={suggestedPendingOrders} />

      {/* Encabezado de la lista */}
      <div className="flex items-end justify-between gap-3 px-1">
        <div>
          <h3 className="text-lg font-black text-slate-900">Mis Pedidos</h3>
          <p className="text-xs text-slate-500">Tocá un pedido para ver su seguimiento y documentos asociados.</p>
        </div>
        {allOrders.length > 0 && (
          <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full flex-shrink-0">
            {allOrders.length} pedido{allOrders.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {(erpLoading || webLoading) ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-orange-500" /></div>
      ) : allOrders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
          <ClipboardList className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500 mb-4">Aún no tienes pedidos registrados.</p>
          <a href="/tienda" className="inline-flex items-center gap-2 bg-[#FF6E23] hover:bg-[#E55E13] text-white text-sm font-bold px-4 py-2 rounded-xl transition-colors">
            <ShoppingCart className="h-4 w-4" /> Ir a la tienda
          </a>
        </div>
      ) : (
        <div className="space-y-2.5">
          {allOrders.map((order) => {
            const isExpanded = expandedRowId === order.id;
            const items = getOrderItems(order);
            const statusObj = statusConfig[order.status?.toLowerCase()] || statusConfig.pending;
            const StatusIcon = statusObj.icon;
            const totalUnits = items.reduce((s, it) => s + Number(it.quantity || 0), 0);
            const summary = items.length === 1 ? items[0].productName : `Mix de productos (${items.length})`;

            return (
              <div key={order.id} className="rounded-2xl border border-slate-200 bg-white shadow-sm hover:border-orange-200 hover:shadow-md transition-all overflow-hidden">
                <div className="flex items-center gap-3 p-4 cursor-pointer group" onClick={() => setSelectedOrder(order)}>
                  {/* Estado */}
                  <div className={`h-11 w-11 rounded-xl flex items-center justify-center flex-shrink-0 border ${statusObj.bg} ${statusObj.color}`}>
                    <StatusIcon className="w-5 h-5" />
                  </div>
                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-slate-800 truncate max-w-[220px]">{summary}</p>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusObj.bg} ${statusObj.color}`}>
                        {statusObj.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
                      <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">#{order.id?.includes('-') ? getNumericOrderId(order.id) : order.id}</span>
                      <span className="text-slate-300">·</span>
                      <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {formatDate(order.createdAt)}</span>
                    </div>
                  </div>
                  {/* Total */}
                  <div className="text-right flex-shrink-0">
                    <p className="text-base font-black text-slate-900">{formatCurrency(Number(order.total))}</p>
                    <p className="text-[10px] text-slate-400">{totalUnits} uds</p>
                  </div>
                  {/* Expand */}
                  <button
                    onClick={(e) => { e.stopPropagation(); setExpandedRowId(isExpanded ? null : order.id); }}
                    className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 flex-shrink-0"
                    title={isExpanded ? "Ocultar productos" : "Ver productos"}
                  >
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>

                {isExpanded && (
                  <div className="px-4 pb-4 pt-1 border-t border-slate-100 bg-slate-50/40 animate-in slide-in-from-top-2 fade-in duration-200">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest my-3 flex items-center gap-1.5">
                      <Package className="w-3 h-3" /> Productos ({items.length})
                    </h4>
                    <div className="space-y-2">
                      {items.slice(0, 6).map((it, idx) => (
                        <div key={idx} className="flex justify-between items-center text-sm">
                          <div className="flex flex-col min-w-0 mr-2">
                            <span className="font-medium text-slate-700 truncate">{it.productName}</span>
                            <span className="text-[10px] text-slate-400">{it.quantity} × {formatCurrency(Number(it.unitPrice || 0))}</span>
                          </div>
                          <span className="font-semibold text-slate-600 flex-shrink-0">{formatCurrency(Number(it.totalPrice || Number(it.unitPrice || 0) * it.quantity))}</span>
                        </div>
                      ))}
                      {items.length > 6 && (
                        <p className="text-[10px] text-slate-400 text-center">+ {items.length - 6} producto{items.length - 6 !== 1 ? "s" : ""} más</p>
                      )}
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-200 flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={(e) => handleRepeatOrder(e, order)} className="text-emerald-700 border-emerald-200 hover:bg-emerald-50 font-semibold text-xs h-8 rounded-lg">
                        <Repeat className="w-3 h-3 mr-1.5" /> Repetir Pedido
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setSelectedOrder(order)} className="text-orange-600 border-orange-200 hover:bg-orange-50 font-semibold text-xs h-8 rounded-lg">
                        Ver seguimiento y documentos
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ==========================================
// Main Portal Component
// ==========================================

export default function ClientPortal() {
  const { user } = useAuth();
  const salespersonName = (user as any)?.salespersonName || "";
  const [location] = useLocation();

  const getInitialTab = () => {
    if (location === '/mis-pedidos') return 'pedidos';
    const tab = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('tab') : null;
    if (tab === 'pedidos') return 'pedidos';
    return 'dashboard';
  };
  const activeTab = getInitialTab();

  return (
    <div className="space-y-4">
      {/* Content — tabs are already in the header via ClientEcommerceLayout */}
      <div className="min-h-[500px]">
        {activeTab === "dashboard" && (
          <DashboardTab salesperson={salespersonName} />
        )}
        {activeTab === "pedidos" && (
          <PedidosTab salesperson={salespersonName} />
        )}
      </div>
    </div>
  );
}

