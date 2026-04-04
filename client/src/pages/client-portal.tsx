import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useAiChat } from "@/hooks/useAiChat";
import { getNumericOrderId } from "@/lib/utils";
import AiChatView from "@/components/ai-chat/AiChatView";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
// Dashboard Tab
// ==========================================

function DashboardTab({ salesperson }: { salesperson: string }) {
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

  const isLoading = webLoading || erpLoading;

  // Compute metrics from Web Orders
  const validOrders = useMemo(() => {
    return webOrders.filter((o: any) => o.status === 'pending' || o.status === 'approved' || o.status === 'processing');
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
      {/* Welcome header */}
      <div className="bg-gradient-to-r from-blue-700 to-indigo-800 rounded-2xl p-6 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl" />
        <div className="relative z-10">
          <h2 className="text-2xl font-bold">Resumen de Cuenta</h2>
          <p className="text-blue-100 text-sm mt-1 max-w-2xl">
            Tus métricas de compra, pedidos recientes y productos más solicitados a través de nuestro portal eCommerce.
          </p>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                          {r.status === 'pending' ? 'Pendiente' : r.status === 'approved' ? 'Aprobado' : r.status}
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
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
            <p className="text-sm font-semibold text-gray-900">Ver Pedidos Completos</p>
            <p className="text-[10px] text-gray-500">Ingresados y en despacho</p>
          </div>
          <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-blue-400 transition-colors" />
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
import { ChevronDown, ChevronUp, Repeat } from "lucide-react";
import { useCart } from "@/hooks/useCart";

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

  const unifiedWebOrders: EcommerceOrder[] = webOrders.map((o: any) => ({
    ...o,
    status: o.status === 'pending' || o.status === 'pendiente' ? 'pendiente' : (o.status === 'approved' ? 'approved' : o.status),
    items: typeof o.items === 'string' ? JSON.parse(o.items) : o.items
  }));

  const allOrders = [...unifiedWebOrders, ...nvvOrders, ...gdvOrders, ...txOrders].sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

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
      <div className="overflow-x-auto border rounded-xl bg-white shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50 border-b">
              <TableHead className="w-[40px]"></TableHead>
              <TableHead className="text-xs font-bold text-slate-500 uppercase">ID de Pedido</TableHead>
              <TableHead className="text-xs font-bold text-slate-500 uppercase">Fecha</TableHead>
              <TableHead className="text-xs font-bold text-slate-500 uppercase">Estado</TableHead>
              <TableHead className="text-xs font-bold text-slate-500 uppercase text-right">Total</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(erpLoading || webLoading) ? (
               <TableRow><TableCell colSpan={6} className="h-48 text-center text-slate-500">Cargando...</TableCell></TableRow>
            ) : allOrders.length === 0 ? (
               <TableRow><TableCell colSpan={6} className="h-48 text-center text-slate-500">No tienes pedidos registrados.</TableCell></TableRow>
            ) : (
              allOrders.map((order) => {
                const isExpanded = expandedRowId === order.id;
                const items = getOrderItems(order);
                const statusObj = statusConfig[order.status?.toLowerCase()] || statusConfig.pending;
                const StatusIcon = statusObj.icon;
                
                return (
                  <React.Fragment key={order.id}>
                    <TableRow className="hover:bg-orange-50/20 cursor-pointer group transition-colors" onClick={() => setSelectedOrder(order)}>
                      <TableCell className="pl-4 cursor-pointer" onClick={(e) => { e.stopPropagation(); setExpandedRowId(isExpanded ? null : order.id); }}>
                        <div className="w-6 h-6 rounded-md hover:bg-slate-100 flex items-center justify-center text-slate-400">
                           {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm font-semibold text-slate-700">
                        #{order.id?.includes('-') ? getNumericOrderId(order.id) : order.id}
                      </TableCell>
                      <TableCell className="text-sm text-slate-600">
                        {formatDate(order.createdAt)}
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${statusObj.bg} ${statusObj.color}`}>
                          <StatusIcon className="w-3 h-3" />
                          {statusObj.label}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-bold text-slate-900">
                        {formatCurrency(Number(order.total))}
                      </TableCell>
                    </TableRow>
                    
                    {isExpanded && (
                      <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                        <TableCell colSpan={6} className="p-0 border-b-2 border-slate-100">
                          <div className="py-4 pl-14 pr-8 animate-in slide-in-from-top-2 fade-in duration-200">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                               <Package className="w-3 h-3" />
                               Productos Solicitados ({items.length})
                            </h4>
                            <div className="space-y-3">
                              {items.map((it, idx) => (
                                <div key={idx} className="flex justify-between items-center text-sm border-b border-slate-100 pb-2 last:border-0 last:pb-0">
                                  <div className="flex flex-col">
                                    <span className="font-medium text-slate-700">{it.productName}</span>
                                    <span className="text-[10px] text-slate-400">{it.quantity} x {formatCurrency(Number(it.unitPrice || 0))}</span>
                                  </div>
                                  <span className="font-semibold text-slate-600">{formatCurrency(Number(it.totalPrice || Number(it.unitPrice || 0) * it.quantity))}</span>
                                </div>
                              ))}
                            </div>
                            <div className="mt-4 pt-3 border-t border-slate-200 flex justify-end gap-2">
                               <Button variant="outline" size="sm" onClick={(e) => handleRepeatOrder(e, order)} className="text-emerald-700 border-emerald-200 hover:bg-emerald-50 font-semibold text-xs h-8">
                                 <Repeat className="w-3 h-3 mr-1.5" />
                                 Repetir Pedido
                               </Button>
                               <Button variant="outline" size="sm" onClick={() => setSelectedOrder(order)} className="text-orange-600 border-orange-200 hover:bg-orange-50 font-semibold text-xs h-8">
                                 Ver detalle completo
                               </Button>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
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

