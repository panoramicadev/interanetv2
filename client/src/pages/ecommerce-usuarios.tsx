import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { getNumericOrderId } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertSalespersonUserSchema, type InsertSalespersonUserInput, type SalespersonUser } from "@shared/schema";
import {
  Users, Search, Mail, Phone, MapPin, Calendar, ArrowLeft,
  UserCircle, Hash, Building2, KeyRound, ShoppingBag,
  CreditCard, FileText, TrendingUp, DollarSign, Package,
  Clock, Eye, Edit2, Save, X, Plus, Trash2, Home, Check, UserPlus,
  Link, LinkIcon, Unlink, AlertTriangle, SearchIcon, FilePlus,
  GitBranch, Building, Network
} from "lucide-react";

interface ClientUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  createdAt: string;
  hasCredentials: boolean;
  clientId: string | null;
  clientCode: string | null;
  clientName: string;
  rut: string | null;
  phone: string | null;
  address: string | null;
  commune: string | null;
  assignedSalesperson: string | null;
  salesRepCode: string | null;
  creditLimit: number | null;
  creditAvailable: number | null;
  creditUsed: number | null;
  paymentCondition: string | null;
  pickupWarehouseId: string | null;
  lcen: string | null;
  parentClientId: string | null;
  branchLabel: string | null;
  // SAP sales metrics
  sapTotalSales: number | null;
  sapTotalTransactions: number | null;
  sapLastTransactionDate: string | null;
  sapSalespersonName: string | null;
}

interface BranchInfo {
  id: string;
  name: string;
  branchLabel: string | null;
  isRoot: boolean;
  creditLimit: number | null;
  creditUsed: number | null;
  creditAvailable: number | null;
  salesRepCode: string | null;
  pickupWarehouseId: string | null;
  paymentCondition: string | null;
}

interface BranchGroup {
  rootId: string;
  branches: BranchInfo[];
  groupTotals: {
    creditLimit: number;
    creditUsed: number;
    creditAvailable: number;
    branchCount: number;
  };
}

interface Warehouse {
  id: string;
  kobo: string;
  kosu: string;
  name: string;
  location: string | null;
}

// ─── Client Profile Detail Panel ─────────────────────────
function ClientProfile({ client, onBack, onClientUpdated }: { client: ClientUser; onBack: () => void; onClientUpdated: (updated: ClientUser) => void }) {
  const [activeTab, setActiveTab] = useState("overview");
  const [isEditingCommercial, setIsEditingCommercial] = useState(false);
  const [linkSearchQuery, setLinkSearchQuery] = useState("");
  const [linkSearchResults, setLinkSearchResults] = useState<any[]>([]);
  const [isSearchingClients, setIsSearchingClients] = useState(false);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [commercialForm, setCommercialForm] = useState({
    paymentCondition: client.paymentCondition || "CONTADO",
    creditDays: "",
    pickupWarehouseId: client.pickupWarehouseId || "none",
    salesRepCode: client.salesRepCode || "",
    creditLimit: client.creditLimit?.toString() || "",
    creditAvailable: client.creditAvailable?.toString() || "",
    creditUsed: client.creditUsed?.toString() || "",
    lcen: client.lcen || ""
  });
    const { toast } = useToast();
  const queryClient = useQueryClient();

  // Parse credit days if condition is format "CREDITO X DIAS"
  useEffect(() => {
    let baseCondition = client.paymentCondition || "CONTADO";
    let days = "";
    if (client.paymentCondition?.toUpperCase().includes('CREDITO')) {
      const match = client.paymentCondition.match(/\d+/);
      if (match) {
        days = match[0];
        baseCondition = "CREDITO";
      }
    } else if (client.paymentCondition?.toUpperCase().includes('TRANSFERENCIA')) {
      baseCondition = "TRANSFERENCIA";
    }

    setCommercialForm({
      paymentCondition: baseCondition,
      creditDays: days,
      pickupWarehouseId: client.pickupWarehouseId || "none",
      salesRepCode: client.salesRepCode || "",
      creditLimit: client.creditLimit?.toString() || "",
      creditAvailable: client.creditAvailable?.toString() || "",
      creditUsed: client.creditUsed?.toString() || "",
      lcen: client.lcen || ""
    });
  }, [client]);

  // Fetch salespeople
  const { data: salespeople = [] } = useQuery<SalespersonUser[]>({
    queryKey: ["/api/users/salespeople"],
    queryFn: async () => {
      try {
        const res = await apiRequest("GET", `/api/users/salespeople`);
        return await res.json();
      } catch {
        return [];
      }
    },
  });

  // Fetch warehouses
  const { data: warehouses = [] } = useQuery<Warehouse[]>({
    queryKey: ["/api/warehouses"],
    queryFn: async () => {
      try {
        const res = await apiRequest("GET", `/api/warehouses?type=ecommerce`);
        return await res.json();
      } catch {
        return [];
      }
    },
  });

  // Fetch custom price lists for dynamic selector
  const { data: customPriceLists = [] } = useQuery<{ code: string; name: string; active: boolean; item_count: string }[]>({
    queryKey: ["/api/custom-price-lists"],
    queryFn: async () => {
      try {
        const res = await apiRequest("GET", "/api/custom-price-lists");
        return await res.json();
      } catch {
        return [];
      }
    },
  });

  // Helper to resolve list name from code
  const getListName = (code: string | null) => {
    if (!code || code === 'LP01') return 'Lista Comercial';
    const found = customPriceLists.find(l => l.code === code);
    return found ? `${found.name} (${found.code})` : code;
  };

  
    const updateCommercialInfo = useMutation({
    mutationFn: async (data: any) => {
      let targetClientId = client.clientId;
      let newClientIdAssigned = false;
      if (!targetClientId) {
        // Fallback: create minimal client and link if not already linked to SAP
        const linkRes = await apiRequest("POST", `/api/users/clients/${client.id}/create-and-link`);
        const linkData = await linkRes.json();
        if (linkData.client?.id) {
           targetClientId = linkData.client.id;
           newClientIdAssigned = true;
        } else {
           throw new Error(linkData.message || "No se pudo crear la ficha de cliente");
        }
      }
      const res = await apiRequest("PATCH", `/api/users/clients/${targetClientId}/commercial-info`, data);
      const resultData = await res.json();
      return { ...resultData, customNewClientId: newClientIdAssigned ? targetClientId : undefined };
    },
    onSuccess: (data: any, variables: any) => {
      toast({ title: "Guardado", description: "Información comercial actualizada." });
      queryClient.invalidateQueries({ queryKey: ["/api/users/clients"] });
      setIsEditingCommercial(false);
      // Immediately sync the parent's selectedClient so the UI reflects the save
      onClientUpdated({
        ...client,
        clientId: data.customNewClientId || client.clientId,
        paymentCondition: variables.cpen || client.paymentCondition,
        salesRepCode: variables.kofuen || client.salesRepCode,
        creditLimit: variables.crlt != null ? variables.crlt : client.creditLimit,
        creditAvailable: variables.cren != null ? variables.cren : client.creditAvailable,
        creditUsed: variables.crsd != null ? variables.crsd : client.creditUsed,
        pickupWarehouseId: variables.pickupWarehouseId ?? client.pickupWarehouseId,
        lcen: variables.lcen || client.lcen,
      });
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo actualizar la información comercial.", variant: "destructive" });
    }
  });

  // Mutation: Link user to existing client
  const linkClientMutation = useMutation({
    mutationFn: async (clientId: string) => {
      const res = await apiRequest("POST", `/api/users/clients/${client.id}/link-client`, { clientId });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Vinculado", description: "Usuario vinculado con ficha de cliente exitosamente." });
      queryClient.invalidateQueries({ queryKey: ["/api/users/clients"] });
      setShowLinkDialog(false);
      setLinkSearchQuery("");
      setLinkSearchResults([]);
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo vincular el usuario.", variant: "destructive" });
    }
  });

  // Mutation: Create client record and link
  const createAndLinkMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/users/clients/${client.id}/create-and-link`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Creado y vinculado", description: "Ficha de cliente creada y vinculada exitosamente." });
      queryClient.invalidateQueries({ queryKey: ["/api/users/clients"] });
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo crear la ficha de cliente.", variant: "destructive" });
    }
  });

  // Search clients for linking
  const searchClientsForLink = async (query: string) => {
    if (query.length < 2) { setLinkSearchResults([]); return; }
    setIsSearchingClients(true);
    try {
      const res = await apiRequest("GET", `/api/clients/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setLinkSearchResults(Array.isArray(data) ? data.slice(0, 10) : []);
    } catch {
      setLinkSearchResults([]);
    } finally {
      setIsSearchingClients(false);
    }
  };

  // ─── Branch (Sucursal) Management ─────────────────────
  const [showBranchDialog, setShowBranchDialog] = useState(false);
  const [branchForm, setBranchForm] = useState({
    branchLabel: "",
    username: "",
    email: "",
    password: "",
    salesRepCode: "",
    pickupWarehouseId: "none",
    creditLimit: "",
    paymentCondition: client.paymentCondition || "CONTADO",
    lcen: client.lcen || "",
  });

  // Fetch sibling branches
  const { data: branchGroup } = useQuery<BranchGroup>({
    queryKey: ["/api/users/clients/branches", client.clientId],
    queryFn: async () => {
      try {
        const res = await apiRequest("GET", `/api/users/clients/${client.clientId}/branches`);
        return await res.json();
      } catch {
        return null;
      }
    },
    enabled: !!client.clientId,
  });

  const hasBranches = branchGroup && branchGroup.branches.length > 1;
  const isBranch = !!client.branchLabel || !!client.parentClientId;

  // Mutation: Create branch
  const createBranchMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", `/api/users/clients/${client.id}/create-branch`, data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Sucursal creada", description: "La sucursal se ha creado exitosamente." });
      queryClient.invalidateQueries({ queryKey: ["/api/users/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users/clients/branches"] });
      setShowBranchDialog(false);
      setBranchForm({ branchLabel: "", username: "", email: "", password: "", salesRepCode: "", pickupWarehouseId: "none", creditLimit: "", paymentCondition: client.paymentCondition || "CONTADO", lcen: client.lcen || "" });
    },
    onError: (error: any) => {
      const msg = (() => { try { const m = error.message?.match(/\{.*\}/); return m ? JSON.parse(m[0]).message : error.message; } catch { return error.message || "Error desconocido"; } })();
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  });

  // Fetch client orders
  const { data: orders = [] } = useQuery<any[]>({
    queryKey: ["/api/ecommerce/orders", { clientUserId: client.id }],
    queryFn: async () => {
      try {
        const res = await apiRequest("GET", `/api/ecommerce/orders?userId=${client.id}`);
        return await res.json();
      } catch {
        return [];
      }
    },
  });

  // Fetch SAP price list for this client's code
  const { data: priceListData } = useQuery<{ items: any[]; totalCount: number }>({
    queryKey: ["/api/price-list", { clientCode: client.clientCode }],
    queryFn: async () => {
      try {
        const res = await apiRequest("GET", `/api/price-list?limit=100&offset=0`);
        return await res.json();
      } catch {
        return { items: [], totalCount: 0 };
      }
    },
    enabled: !!client.clientCode,
  });

  const priceList = priceListData?.items || [];

  const formatDate = (date: string | null) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("es-CL", {
      day: "2-digit", month: "short", year: "numeric",
    });
  };

  const formatCurrency = (value: number | null) => {
    if (!value) return "—";
    return `$${value.toLocaleString("de-DE", { maximumFractionDigits: 0 })}`;
  };

  const totalOrders = orders.length;
  const totalSpent = orders.reduce((acc: number, o: any) => acc + (parseFloat(o.total) || 0), 0);
  const pendingOrders = orders.filter((o: any) => o.status === "pending" || o.status === "Pendiente").length;
  const approvedOrders = orders.filter((o: any) => o.status === "approved" || o.status === "Aprobado").length;

  return (
    <div className="space-y-6 p-6">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group"
      >
        <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
        Volver a Usuarios
      </button>

      {/* Profile Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 md:p-8 text-white">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSA2MCAwIEwgMCAwIDAgNjAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjAzKSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-40" />
        <div className="relative flex flex-col md:flex-row md:items-center gap-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-2xl font-bold shadow-lg">
            {(client.clientName || client.email)?.[0]?.toUpperCase() || "?"}
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{client.clientName}</h1>
            <div className="flex flex-wrap items-center gap-3 mt-2 text-slate-300 text-sm">
              {client.email && (
                <span className="flex items-center gap-1">
                  <Mail className="h-3.5 w-3.5" /> {client.email}
                </span>
              )}
              {client.rut && (
                <span className="flex items-center gap-1">
                  <Building2 className="h-3.5 w-3.5" /> {client.rut}
                </span>
              )}
              {client.clientCode && (
                <span className="flex items-center gap-1">
                  <Hash className="h-3.5 w-3.5" /> {client.clientCode}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className="bg-green-500/20 text-green-300 border-green-500/30 px-3 py-1">
              <KeyRound className="h-3 w-3 mr-1" />
              Acceso activo
            </Badge>
            {client.clientId ? (
              <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 px-3 py-1">
                <LinkIcon className="h-3 w-3 mr-1" />
                Vinculado
              </Badge>
            ) : (
              <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 px-3 py-1">
                <Unlink className="h-3 w-3 mr-1" />
                Sin vincular
              </Badge>
            )}
            {isBranch && (
              <Badge className="bg-violet-500/20 text-violet-300 border-violet-500/30 px-3 py-1">
                <GitBranch className="h-3 w-3 mr-1" />
                Sucursal: {client.branchLabel}
              </Badge>
            )}
            {hasBranches && (
              <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-500/30 px-3 py-1">
                <Network className="h-3 w-3 mr-1" />
                Grupo: {branchGroup!.groupTotals.branchCount} sucursales
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Linking Alert — shown when user is not linked to SAP client */}
      {!client.clientId && (
        <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/30 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-200">Usuario sin ficha de cliente vinculada</h3>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                  Este usuario eCommerce no está vinculado con ninguna ficha de cliente del sistema (SAP). La información comercial (crédito, vendedor, lista de precios) no estará disponible hasta que se vincule.
                </p>
                <div className="flex flex-wrap gap-2 mt-3">
                  <Dialog open={showLinkDialog} onOpenChange={setShowLinkDialog}>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline" className="h-7 text-xs border-amber-300 text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-300">
                        <SearchIcon className="h-3 w-3 mr-1" />
                        Buscar y vincular cliente
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-lg">
                      <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                          <LinkIcon className="h-5 w-5 text-blue-500" />
                          Vincular con Cliente del Sistema
                        </DialogTitle>
                        <DialogDescription>
                          Busca un cliente por nombre, RUT o código para vincularlo con este usuario eCommerce.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-2">
                        <div className="relative">
                          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Buscar por nombre, RUT o código..."
                            value={linkSearchQuery}
                            onChange={(e) => {
                              setLinkSearchQuery(e.target.value);
                              searchClientsForLink(e.target.value);
                            }}
                            className="pl-9"
                          />
                        </div>
                        {isSearchingClients && (
                          <p className="text-xs text-muted-foreground text-center py-2">Buscando...</p>
                        )}
                        {linkSearchResults.length > 0 && (
                          <div className="max-h-60 overflow-y-auto space-y-1 rounded-lg border p-1">
                            {linkSearchResults.map((c: any) => (
                              <button
                                key={c.id || c.koen}
                                onClick={() => linkClientMutation.mutate(c.id)}
                                disabled={linkClientMutation.isPending}
                                className="w-full flex items-center justify-between p-2.5 rounded-md hover:bg-blue-50 dark:hover:bg-blue-950/50 text-left transition-colors"
                              >
                                <div className="min-w-0">
                                  <p className="text-sm font-medium truncate">{c.nokoen || c.clientName || 'Sin nombre'}</p>
                                  <p className="text-xs text-muted-foreground flex items-center gap-2">
                                    {c.rten && <span>RUT: {c.rten}</span>}
                                    {c.koen && <span>Código: {c.koen}</span>}
                                  </p>
                                </div>
                                <LinkIcon className="h-4 w-4 text-blue-500 flex-shrink-0" />
                              </button>
                            ))}
                          </div>
                        )}
                        {linkSearchQuery.length >= 2 && linkSearchResults.length === 0 && !isSearchingClients && (
                          <p className="text-xs text-muted-foreground text-center py-4">No se encontraron clientes con ese criterio.</p>
                        )}
                      </div>
                    </DialogContent>
                  </Dialog>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs border-amber-300 text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-300"
                    onClick={() => createAndLinkMutation.mutate()}
                    disabled={createAndLinkMutation.isPending}
                  >
                    <FilePlus className="h-3 w-3 mr-1" />
                    {createAndLinkMutation.isPending ? 'Creando...' : 'Crear ficha de cliente'}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPI Cards — SAP data first row, eCommerce data second row */}
      {client.sapTotalSales != null && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-0 shadow-sm bg-gradient-to-br from-indigo-50 to-indigo-100/50 dark:from-indigo-950/50 dark:to-indigo-900/30">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-medium text-indigo-600 uppercase tracking-wider">Ventas SAP Total</p>
                  <p className="text-2xl font-bold text-indigo-900 dark:text-indigo-100">{formatCurrency(client.sapTotalSales)}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-indigo-400/60" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-gradient-to-br from-cyan-50 to-cyan-100/50 dark:from-cyan-950/50 dark:to-cyan-900/30">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-medium text-cyan-600 uppercase tracking-wider">Transacciones SAP</p>
                  <p className="text-2xl font-bold text-cyan-900 dark:text-cyan-100">{client.sapTotalTransactions || 0}</p>
                </div>
                <FileText className="h-8 w-8 text-cyan-400/60" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-gradient-to-br from-rose-50 to-rose-100/50 dark:from-rose-950/50 dark:to-rose-900/30">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-medium text-rose-600 uppercase tracking-wider">Última Compra SAP</p>
                  <p className="text-lg font-bold text-rose-900 dark:text-rose-100">{client.sapLastTransactionDate ? formatDate(client.sapLastTransactionDate) : '—'}</p>
                </div>
                <Calendar className="h-8 w-8 text-rose-400/60" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-gradient-to-br from-violet-50 to-violet-100/50 dark:from-violet-950/50 dark:to-violet-900/30">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-medium text-violet-600 uppercase tracking-wider">Vendedor SAP</p>
                  <p className="text-lg font-bold text-violet-900 dark:text-violet-100 truncate">{client.sapSalespersonName || '—'}</p>
                </div>
                <UserCircle className="h-8 w-8 text-violet-400/60" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-0 shadow-sm bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/50 dark:to-blue-900/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-medium text-blue-600 uppercase tracking-wider">Pedidos eCommerce</p>
                <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">{totalOrders}</p>
              </div>
              <ShoppingBag className="h-8 w-8 text-blue-400/60" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/50 dark:to-emerald-900/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-medium text-emerald-600 uppercase tracking-wider">Comprado eCommerce</p>
                <p className="text-2xl font-bold text-emerald-900 dark:text-emerald-100">{formatCurrency(totalSpent)}</p>
              </div>
              <DollarSign className="h-8 w-8 text-emerald-400/60" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-950/50 dark:to-amber-900/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-medium text-amber-600 uppercase tracking-wider">Pendientes</p>
                <p className="text-2xl font-bold text-amber-900 dark:text-amber-100">{pendingOrders}</p>
              </div>
              <Clock className="h-8 w-8 text-amber-400/60" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-950/50 dark:to-purple-900/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-medium text-purple-600 uppercase tracking-wider">Aprobados</p>
                <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">{approvedOrders}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-purple-400/60" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs: Overview / Orders / Price List */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full flex h-auto p-1 bg-muted/50 rounded-xl gap-1">
          <TabsTrigger value="overview" className="flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <UserCircle className="h-4 w-4" /> Perfil
          </TabsTrigger>
          <TabsTrigger value="orders" className="flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <ShoppingBag className="h-4 w-4" /> Pedidos
            {totalOrders > 0 && <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">{totalOrders}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="pricelist" className="flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <FileText className="h-4 w-4" /> Lista de Precios
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <UserCircle className="h-4 w-4 text-blue-500" />
                  Información General
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { label: "Nombre", value: client.clientName, icon: UserCircle },
                  { label: "Email", value: client.email, icon: Mail },
                  { label: "RUT", value: client.rut, icon: Building2 },
                  { label: "Código", value: client.clientCode, icon: Hash },
                  { label: "Teléfono", value: client.phone, icon: Phone },
                  { label: "Dirección", value: client.address, icon: MapPin },
                  { label: "Comuna", value: client.commune, icon: MapPin },
                  { label: "Registro", value: formatDate(client.createdAt), icon: Calendar },
                ].map(({ label, value, icon: Icon }) => (
                  <div key={label} className="flex items-center justify-between py-2 border-b border-muted/50 last:border-0">
                    <span className="text-sm text-muted-foreground flex items-center gap-2">
                      <Icon className="h-3.5 w-3.5" /> {label}
                    </span>
                    <span className="text-sm font-medium text-right max-w-[60%] truncate">{value || "—"}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm relative overflow-visible">
              <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-emerald-500" />
                  Información Comercial
                </CardTitle>
                {!isEditingCommercial && (
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-emerald-600" onClick={() => setIsEditingCommercial(true)}>
                    <Edit2 className="h-3.5 w-3.5 mr-1" /> Editar
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                {isEditingCommercial ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Código Vendedor</Label>
                        <Select 
                          value={commercialForm.salesRepCode || "unassigned"} 
                          onValueChange={(val) => setCommercialForm(p => ({ ...p, salesRepCode: val === "unassigned" ? "" : val }))}
                        >
                          <SelectTrigger className="h-8 text-sm truncate">
                            <SelectValue placeholder="Seleccione vendedor..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unassigned" className="text-muted-foreground italic">Sin vendedor asignado</SelectItem>
                            {salespeople.map((sp: SalespersonUser) => (
                              <SelectItem key={sp.id} value={sp.username || sp.salespersonName.substring(0,3).toUpperCase()}>
                                {sp.salespersonName} {sp.username ? `(${sp.username.toUpperCase()})` : ''}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Condición de Pago</Label>
                        <Select 
                          value={["CREDITO", "TRANSFERENCIA"].includes(commercialForm.paymentCondition) ? commercialForm.paymentCondition : "CONTADO"} 
                          onValueChange={(val) => setCommercialForm(p => ({ ...p, paymentCondition: val }))}
                        >
                          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="CONTADO">Contado</SelectItem>
                            <SelectItem value="TRANSFERENCIA">Transferencia</SelectItem>
                            <SelectItem value="CREDITO">Crédito</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {commercialForm.paymentCondition === "CREDITO" && (
                      <div className="space-y-1.5 bg-blue-50/50 p-2 rounded-md border border-blue-100">
                        <Label className="text-xs text-blue-800">Días de Crédito (plazo)</Label>
                        <Input 
                          type="number" className="h-8 text-sm bg-white" placeholder="Ej: 30"
                          value={commercialForm.creditDays} 
                          onChange={(e) => setCommercialForm(p => ({ ...p, creditDays: e.target.value }))}
                        />
                      </div>
                    )}

                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs border-b border-dashed border-gray-300 pb-0.5 cursor-help" title="Monto máximo autorizado">Límite Crédito ($)</Label>
                        <Input 
                          type="number" className="h-8 text-sm" placeholder="Ej: 5000000"
                          value={commercialForm.creditLimit} 
                          onChange={(e) => {
                            const newLimit = e.target.value;
                            setCommercialForm(p => {
                               const limitNum = parseFloat(newLimit) || 0;
                               const usedNum = parseFloat(p.creditUsed) || 0;
                               return { ...p, creditLimit: newLimit, creditAvailable: (limitNum - usedNum).toString() };
                            });
                          }}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs border-b border-dashed border-gray-300 pb-0.5 cursor-help" title="Cupo ya utilizado / Deuda">Crédito Usado ($)</Label>
                        <Input 
                          type="number" className="h-8 text-sm" placeholder="Ej: 1000000"
                          value={commercialForm.creditUsed} 
                          onChange={(e) => {
                             const newUsed = e.target.value;
                             setCommercialForm(p => {
                               const limitNum = parseFloat(p.creditLimit) || 0;
                               const usedNum = parseFloat(newUsed) || 0;
                               return { ...p, creditUsed: newUsed, creditAvailable: (limitNum - usedNum).toString() };
                             });
                          }}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-emerald-700">Disponible ($)</Label>
                        <Input 
                          type="number" className="h-8 text-sm bg-emerald-50" placeholder="Automático"
                          value={commercialForm.creditAvailable} 
                          onChange={(e) => setCommercialForm(p => ({ ...p, creditAvailable: e.target.value }))}
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">Lista de Precios Asignada</Label>
                      <Select 
                        value={commercialForm.lcen || "__none__"} 
                        onValueChange={(val) => setCommercialForm(p => ({ ...p, lcen: val === "__none__" ? "" : val }))}
                      >
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue placeholder="Seleccione una lista" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Sin asignar</SelectItem>
                          <SelectItem value="LP01">Lista Comercial (Por defecto)</SelectItem>
                          {customPriceLists.filter(l => l.active).map(list => (
                            <SelectItem key={list.code} value={list.code}>{list.name} ({list.code})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">Bodega de Retiro Default</Label>
                        
                      </div>
                      <Select 
                        value={commercialForm.pickupWarehouseId} 
                        onValueChange={(val) => setCommercialForm(p => ({ ...p, pickupWarehouseId: val }))}
                      >
                        <SelectTrigger className="h-8 text-sm truncate">
                          <SelectValue placeholder="Sin asignar..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Sin asignar</SelectItem>
                          {warehouses
                            .filter((w: any) => w.isManual || w.is_manual || w.kobo?.startsWith('MNL'))
                            .map((w: any) => (
                              <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2">
                       <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setIsEditingCommercial(false)}>Cancelar</Button>
                       <Button size="sm" className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700" onClick={() => {
                          let cpen = commercialForm.paymentCondition;
                          let dccr = "0";
                          if (cpen === "CREDITO") {
                             const days = commercialForm.creditDays || "0";
                             cpen = `CREDITO ${days} DIAS`;
                             dccr = days;
                          }
                          updateCommercialInfo.mutate({
                             cpen, dccr, 
                             pickupWarehouseId: commercialForm.pickupWarehouseId === "none" ? null : commercialForm.pickupWarehouseId,
                             kofuen: commercialForm.salesRepCode || null,
                             crlt: commercialForm.creditLimit ? parseFloat(commercialForm.creditLimit) : null,
                             cren: commercialForm.creditAvailable ? parseFloat(commercialForm.creditAvailable) : null,
                             crsd: commercialForm.creditUsed ? parseFloat(commercialForm.creditUsed) : null,
                             lcen: commercialForm.lcen ? commercialForm.lcen : null
                          });
                       }}
                       disabled={updateCommercialInfo.isPending}>
                         {updateCommercialInfo.isPending ? "Guardando..." : "Guardar Cambios"}
                       </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    {[
                      { label: "Condición de Pago", value: client.paymentCondition },
                      { label: "Código Vendedor", value: client.salesRepCode },
                      { label: "Lista de Precios", value: getListName(client.lcen) || '—' },
                      { label: "Límite de Crédito", value: formatCurrency(client.creditLimit) },
                      { label: "Crédito Usado", value: formatCurrency(client.creditUsed) },
                      { label: "Crédito Disponible", value: formatCurrency(client.creditAvailable) },
                      { label: "Bodega de Retiro", value: warehouses.find(w => w.id === client.pickupWarehouseId)?.name || "—" },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex items-center justify-between py-2 border-b border-muted/50 last:border-0 hover:bg-muted/10">
                        <span className="text-sm text-muted-foreground">{label}</span>
                        <span className="text-sm font-medium">{value || "—"}</span>
                      </div>
                    ))}
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Orders Tab */}
        <TabsContent value="orders" className="mt-4">
          <Card className="border-0 shadow-sm rounded-xl overflow-hidden">
            <CardHeader className="bg-muted/30 border-b px-6 py-4">
              <CardTitle className="text-base">Historial de Pedidos</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Todos los pedidos realizados por este cliente
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {orders.length === 0 ? (
                <div className="text-center py-12">
                  <ShoppingBag className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">Este cliente aún no tiene pedidos</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/20">
                      <TableHead className="text-xs uppercase">Pedido</TableHead>
                      <TableHead className="text-xs uppercase">Fecha</TableHead>
                      <TableHead className="text-xs uppercase">Productos</TableHead>
                      <TableHead className="text-xs uppercase text-right">Total</TableHead>
                      <TableHead className="text-xs uppercase text-center">Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((order: any) => (
                      <TableRow key={order.id} className="hover:bg-muted/10">
                        <TableCell className="font-mono text-sm font-semibold text-orange-600">
                          #{order.orderNumber || getNumericOrderId(order.id)}
                        </TableCell>
                        <TableCell className="text-sm">{formatDate(order.createdAt)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {order.items?.length || 0} items
                        </TableCell>
                        <TableCell className="text-sm text-right font-medium tabular-nums">
                          {formatCurrency(parseFloat(order.total || "0"))}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant="secondary"
                            className={`text-[10px] px-2 py-0.5 ${
                              order.status === "approved" || order.status === "Aprobado"
                                ? "bg-green-100 text-green-700 border-green-200"
                                : order.status === "archived"
                                ? "bg-gray-100 text-gray-500"
                                : "bg-amber-100 text-amber-700 border-amber-200"
                            }`}
                          >
                            {order.status === "approved" || order.status === "Aprobado"
                              ? "Aprobado"
                              : order.status === "archived"
                              ? "Archivado"
                              : "Pendiente"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Price List Tab */}
        <TabsContent value="pricelist" className="mt-4">
          <Card className="border-0 shadow-sm rounded-xl overflow-hidden">
            <CardHeader className="bg-muted/30 border-b px-6 py-4">
              <CardTitle className="text-base">Lista de Precios</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Catálogo de precios comerciales disponible para este cliente
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {priceList.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No hay lista de precios cargada</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/20">
                        <TableHead className="text-xs uppercase">Código</TableHead>
                        <TableHead className="text-xs uppercase">Producto</TableHead>
                        <TableHead className="text-xs uppercase">Unidad</TableHead>
                        <TableHead className="text-xs uppercase text-right">Lista</TableHead>
                        <TableHead className="text-xs uppercase text-right">Desc. 10%</TableHead>
                        <TableHead className="text-xs uppercase text-right">Mínimo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {priceList.slice(0, 50).map((item: any) => (
                        <TableRow key={item.id} className="hover:bg-muted/10">
                          <TableCell className="font-mono text-sm font-semibold text-orange-600">{item.codigo}</TableCell>
                          <TableCell className="text-sm font-medium">{item.producto}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs rounded-md">{item.unidad}</Badge>
                          </TableCell>
                          <TableCell className="text-right tabular-nums font-medium">
                            {Number(item.lista) > 0 ? `$${Number(item.lista).toLocaleString("de-DE", { maximumFractionDigits: 0 })}` : "—"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">
                            {Number(item.desc10) > 0 ? `$${Number(item.desc10).toLocaleString("de-DE", { maximumFractionDigits: 0 })}` : "—"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums font-semibold text-emerald-600">
                            {Number(item.minimo) > 0 ? `$${Number(item.minimo).toLocaleString("de-DE", { maximumFractionDigits: 0 })}` : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Branch Hierarchy Section */}
      {client.clientId && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base flex items-center gap-2">
              <Network className="h-4 w-4 text-violet-500" />
              Grupo Empresarial / Sucursales
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs text-violet-600 border-violet-200 hover:bg-violet-50"
              onClick={() => setShowBranchDialog(true)}
            >
              <GitBranch className="h-3.5 w-3.5 mr-1" />
              Agregar Sucursal
            </Button>
          </CardHeader>
          <CardContent>
            {branchGroup && branchGroup.branches.length > 0 ? (
              <div className="space-y-4">
                {/* Group totals */}
                {branchGroup.branches.length > 1 && (
                  <div className="grid grid-cols-3 gap-3 p-3 bg-gradient-to-r from-violet-50 to-indigo-50 dark:from-violet-950/30 dark:to-indigo-950/30 rounded-lg border border-violet-100 dark:border-violet-800">
                    <div className="text-center">
                      <p className="text-[10px] font-medium text-violet-500 uppercase tracking-wider">Crédito Grupo</p>
                      <p className="text-lg font-bold text-violet-900 dark:text-violet-100">{formatCurrency(branchGroup.groupTotals.creditLimit)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] font-medium text-violet-500 uppercase tracking-wider">Usado Grupo</p>
                      <p className="text-lg font-bold text-violet-900 dark:text-violet-100">{formatCurrency(branchGroup.groupTotals.creditUsed)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] font-medium text-emerald-500 uppercase tracking-wider">Disponible Grupo</p>
                      <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">{formatCurrency(branchGroup.groupTotals.creditAvailable)}</p>
                    </div>
                  </div>
                )}

                {/* Branch list */}
                <div className="space-y-2">
                  {branchGroup.branches.map((branch) => (
                    <div
                      key={branch.id}
                      className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                        branch.id === client.clientId
                          ? "bg-violet-50/70 border-violet-200 dark:bg-violet-950/30 dark:border-violet-700"
                          : "bg-muted/20 border-muted hover:bg-muted/40"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                          branch.isRoot 
                            ? "bg-gradient-to-br from-violet-400 to-indigo-500 text-white" 
                            : "bg-gradient-to-br from-cyan-400 to-blue-500 text-white"
                        }`}>
                          {branch.isRoot ? <Building className="h-4 w-4" /> : <GitBranch className="h-4 w-4" />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{branch.name}</p>
                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                            {branch.isRoot && <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4">Matriz</Badge>}
                            {branch.branchLabel && <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4">{branch.branchLabel}</Badge>}
                            {branch.salesRepCode && <span>Vendedor: {branch.salesRepCode}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 ml-3">
                        <p className="text-xs font-medium">{formatCurrency(branch.creditLimit)}</p>
                        <p className="text-[10px] text-muted-foreground">
                          Usado: {formatCurrency(branch.creditUsed)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-6">
                <Network className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Este cliente no tiene sucursales.</p>
                <p className="text-xs text-muted-foreground mt-1">Crea una sucursal para gestionar múltiples puntos de venta con cupos independientes.</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ─── Dialog Crear Sucursal ───────────────────── */}
      <Dialog open={showBranchDialog} onOpenChange={setShowBranchDialog}>
        <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitBranch className="h-5 w-5 text-violet-600" />
              Crear Nueva Sucursal
            </DialogTitle>
            <DialogDescription>
              Crea una sucursal de <span className="font-semibold">{client.clientName}</span> con cupo de crédito, bodega y vendedor independientes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Branch label */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Nombre de la Sucursal *</Label>
              <Input
                placeholder="Ej: Santiago Centro, Valparaíso, Concepción..."
                value={branchForm.branchLabel}
                onChange={(e) => setBranchForm(p => ({ ...p, branchLabel: e.target.value }))}
              />
            </div>

            {/* Credentials */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Usuario *</Label>
                <Input
                  placeholder="Ej: sucursal-stgo"
                  value={branchForm.username}
                  onChange={(e) => setBranchForm(p => ({ ...p, username: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Contraseña *</Label>
                <Input
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={branchForm.password}
                  onChange={(e) => setBranchForm(p => ({ ...p, password: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Email (opcional)</Label>
              <Input
                type="email"
                placeholder="sucursal@empresa.cl"
                value={branchForm.email}
                onChange={(e) => setBranchForm(p => ({ ...p, email: e.target.value }))}
              />
            </div>

            <hr className="my-2" />

            {/* Commercial info */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Vendedor Asignado</Label>
                <Select
                  value={branchForm.salesRepCode || "unassigned"}
                  onValueChange={(val) => setBranchForm(p => ({ ...p, salesRepCode: val === "unassigned" ? "" : val }))}
                >
                  <SelectTrigger className="h-8 text-sm truncate"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned" className="text-muted-foreground italic">Heredar del padre</SelectItem>
                    {salespeople.map((sp: any) => (
                      <SelectItem key={sp.id} value={sp.username || sp.salespersonName.substring(0,3).toUpperCase()}>
                        {sp.salespersonName} {sp.username ? `(${sp.username.toUpperCase()})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Condición de Pago</Label>
                <Select
                  value={branchForm.paymentCondition}
                  onValueChange={(val) => setBranchForm(p => ({ ...p, paymentCondition: val }))}
                >
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CONTADO">Contado</SelectItem>
                    <SelectItem value="TRANSFERENCIA">Transferencia</SelectItem>
                    <SelectItem value="CREDITO">Crédito</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Límite de Crédito ($)</Label>
                <Input
                  type="number"
                  className="h-8 text-sm"
                  placeholder="Ej: 5000000"
                  value={branchForm.creditLimit}
                  onChange={(e) => setBranchForm(p => ({ ...p, creditLimit: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Bodega de Retiro</Label>
                <Select
                  value={branchForm.pickupWarehouseId}
                  onValueChange={(val) => setBranchForm(p => ({ ...p, pickupWarehouseId: val }))}
                >
                  <SelectTrigger className="h-8 text-sm truncate"><SelectValue placeholder="Sin asignar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin asignar</SelectItem>
                    {warehouses
                      .filter((w: any) => w.isManual || w.is_manual || w.kobo?.startsWith('MNL'))
                      .map((w: any) => (
                        <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Lista de Precios</Label>
              <Select
                value={branchForm.lcen || "__none__"}
                onValueChange={(val) => setBranchForm(p => ({ ...p, lcen: val === "__none__" ? "" : val }))}
              >
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Heredar del padre" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Heredar del padre</SelectItem>
                  <SelectItem value="LP01">Lista Comercial (Por defecto)</SelectItem>
                  {customPriceLists.filter(l => l.active).map(list => (
                    <SelectItem key={list.code} value={list.code}>{list.name} ({list.code})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBranchDialog(false)}>Cancelar</Button>
            <Button
              className="bg-violet-600 hover:bg-violet-700"
              disabled={!branchForm.branchLabel || !branchForm.username || !branchForm.password || branchForm.password.length < 6 || createBranchMutation.isPending}
              onClick={() => {
                createBranchMutation.mutate({
                  branchLabel: branchForm.branchLabel,
                  username: branchForm.username,
                  email: branchForm.email || null,
                  password: branchForm.password,
                  salesRepCode: branchForm.salesRepCode || null,
                  pickupWarehouseId: branchForm.pickupWarehouseId === "none" ? null : branchForm.pickupWarehouseId,
                  creditLimit: branchForm.creditLimit ? parseFloat(branchForm.creditLimit) : null,
                  paymentCondition: branchForm.paymentCondition || null,
                  lcen: branchForm.lcen || null,
                });
              }}
            >
              {createBranchMutation.isPending ? "Creando..." : "Crear Sucursal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      
    </div>
  );
}

// ─── Main eCommerce Users Page ────────────────────────────
export default function EcommerceUsuarios() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClient, setSelectedClient] = useState<ClientUser | null>(null);
  const [isCreateClientDialogOpen, setIsCreateClientDialogOpen] = useState(false);
  const [clientSearchOpen, setClientSearchOpen] = useState(false);
  const [createRutSearch, setCreateRutSearch] = useState('');
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // ─── Form para crear usuario cliente ────────────────────
  const createClientForm = useForm<InsertSalespersonUserInput>({
    resolver: zodResolver(insertSalespersonUserSchema),
    defaultValues: {
      salespersonName: "",
      username: "",
      email: "",
      password: "",
      isActive: true,
      role: "client",
      supervisorId: null,
      assignedSegment: null,
      clientRut: "",
    },
  });

  // Auto-generate username from name
  const watchedClientName = createClientForm.watch("salespersonName");
  useEffect(() => {
    if (watchedClientName) {
      const nameParts = watchedClientName.trim().toLowerCase().split(' ');
      const autoUsername = nameParts.length < 2
        ? nameParts[0].substring(0, 4)
        : nameParts[0].charAt(0) + nameParts[1];
      createClientForm.setValue("username", autoUsername);
    }
  }, [watchedClientName, createClientForm]);

  // RUT search query for client lookup
  const { data: createRutResult } = useQuery<{ found: boolean; client: any }>({
    queryKey: ['/api/clients/search-by-rut', createRutSearch],
    queryFn: () => fetch(`/api/clients/search-by-rut?rut=${encodeURIComponent(createRutSearch)}`, { credentials: 'include' }).then(r => r.json()),
    enabled: createRutSearch.length >= 4,
  });

  // Query para obtener clientes disponibles del sistema
  const { data: availableClients = [] } = useQuery<string[]>({
    queryKey: ["/api/goals/data/clients"],
  });

  // Helper para extraer mensaje de error del backend
  const extractErrorMessage = (error: any): string => {
    try {
      const errorMsg = error.message || "";
      const jsonMatch = errorMsg.match(/\{.*\}/);
      if (jsonMatch) {
        const errorData = JSON.parse(jsonMatch[0]);
        return errorData.message || errorMsg;
      }
      return errorMsg || "Error desconocido";
    } catch {
      return error.message || "Error desconocido";
    }
  };

  // Mutation para crear usuario cliente
  const createClientMutation = useMutation({
    mutationFn: async (userData: InsertSalespersonUserInput) => {
      // Forzar siempre rol cliente
      return await apiRequest("POST", "/api/users/salespeople", { ...userData, role: "client" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users/salespeople"] });
      createClientForm.reset();
      setCreateRutSearch('');
      setIsCreateClientDialogOpen(false);
      toast({
        title: "Usuario cliente creado",
        description: "El usuario se ha creado correctamente con acceso al portal de compras.",
      });
    },
    onError: (error: any) => {
      const errorMessage = extractErrorMessage(error);
      toast({
        title: "Error al crear usuario",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const handleCreateClientSubmit = (data: InsertSalespersonUserInput) => {
    const cleanedData = {
      ...data,
      role: "client" as const,
      supervisorId: null,
      assignedSegment: null,
    };
    createClientMutation.mutate(cleanedData);
  };

  const { data: clients = [], isLoading } = useQuery<ClientUser[]>({
    queryKey: ["/api/users/clients"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/users/clients");
      return res.json();
    },
  });

  const { data: rawRequests = [], isLoading: loadingRequests } = useQuery<any[]>({
    queryKey: ["/api/ecommerce/account-requests"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/ecommerce/account-requests");
      return res.json();
    },
  });

  const updateRequestStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string, status: string }) => {
      const res = await apiRequest("PATCH", `/api/ecommerce/account-requests/${id}`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ecommerce/account-requests"] });
      toast({ title: "Estado actualizado", description: "La solicitud ha sido procesada correctamente." });
    }
  });

  const filteredClients = clients.filter((c) => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (
      c.clientName?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.clientCode?.toLowerCase().includes(q) ||
      c.rut?.toLowerCase().includes(q) ||
      c.phone?.toLowerCase().includes(q)
    );
  });

  // Requests that are still pending
  const pendingRequests = rawRequests.filter((r: any) => r.status === 'pendiente');
  // Past requests
  const processedRequests = rawRequests.filter((r: any) => r.status !== 'pendiente');

  const formatDate = (date: string | null) => {
    if (!date) return "—";
    const associatedClients = filteredClients.filter((c) => c.clientId);
  const nonAssociatedClients = filteredClients.filter((c) => !c.clientId);

  const renderClientsList = (list: ClientUser[], emptyMessage: string) => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      );
    }
    if (list.length === 0) {
      return (
        <Card className="bg-white dark:bg-gray-800 border bg-muted/20">
          <CardContent className="py-16 text-center">
            <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-500">
              {searchTerm ? "Sin resultados" : emptyMessage}
            </h3>
            <p className="text-sm text-gray-400 mt-2 max-w-sm mx-auto">
              {searchTerm ? "Intenta con otro término de búsqueda" : ""}
            </p>
          </CardContent>
        </Card>
      );
    }
    return (
      <div className="space-y-3">
        {list.map((client) => (
          <Card
            key={client.id}
            className="bg-white dark:bg-gray-800 hover:shadow-md transition-all cursor-pointer group border border-gray-100 hover:border-blue-200"
            onClick={() => setSelectedClient(client)}
          >
            <CardContent className="p-4">
              <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                {/* Avatar + Name */}
                <div className="flex items-center gap-3 min-w-0 lg:w-1/3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-sm">
                    {(client.clientName || client.email)?.[0]?.toUpperCase() || "?"}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                        {client.clientName}
                      </h3>
                    </div>
                    {client.email && (
                      <p className="text-xs text-gray-500 flex items-center gap-1.5 truncate mt-0.5">
                        <Mail className="h-3 w-3 flex-shrink-0 opacity-70" />
                        {client.email}
                      </p>
                    )}
                  </div>
                </div>

                {/* Info pills */}
                <div className="flex flex-wrap items-center gap-2 lg:flex-1">
                  {client.clientCode && (
                    <span className="inline-flex items-center gap-1.5 text-xs bg-gray-50/80 text-gray-600 px-2.5 py-1 rounded-md border border-gray-100 font-medium">
                      <Hash className="h-3.5 w-3.5 opacity-60" /> {client.clientCode}
                    </span>
                  )}
                  {client.rut && (
                    <span className="inline-flex items-center gap-1.5 text-xs bg-gray-50/80 text-gray-600 px-2.5 py-1 rounded-md border border-gray-100 font-medium">
                      <Building2 className="h-3.5 w-3.5 opacity-60" /> {client.rut}
                    </span>
                  )}
                  {client.phone && (
                    <span className="inline-flex items-center gap-1.5 text-xs bg-gray-50/80 text-gray-600 px-2.5 py-1 rounded-md border border-gray-100 font-medium">
                      <Phone className="h-3.5 w-3.5 opacity-60" /> {client.phone}
                    </span>
                  )}
                  {client.branchLabel && (
                    <span className="inline-flex items-center gap-1.5 text-xs bg-violet-50/80 text-violet-600 px-2.5 py-1 rounded-md border border-violet-100 font-medium">
                      <GitBranch className="h-3.5 w-3.5 opacity-60" /> Sucursal: {client.branchLabel}
                    </span>
                  )}
                </div>

                {/* Date + Action */}
                <div className="flex items-center gap-4 text-xs text-gray-400 lg:w-auto lg:flex-shrink-0">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 opacity-60" />
                    {formatDate(client.createdAt)}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-3 text-xs opacity-0 group-hover:opacity-100 transition-opacity text-blue-600 bg-blue-50/50 hover:bg-blue-100 hover:text-blue-700"
                  >
                    <Eye className="h-3.5 w-3.5 mr-1.5" />
                    Ver perfil
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        <p className="text-xs text-gray-400 text-center pt-2">
          Mostrando {list.length} usuarios
        </p>
      </div>
    );
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-indigo-600 flex items-center gap-2">
            <ShoppingBag className="h-7 w-7 text-blue-600" />
            Usuarios eCommerce
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Gestión de clientes con acceso al portal de compras
          </p>
        </div>
        <Button
          onClick={() => setIsCreateClientDialogOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 shadow-md hover:shadow-lg transition-all rounded-full h-10 px-5"
        >
          <UserPlus className="w-4 h-4 mr-2" />
          Nuevo Usuario Cliente
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50 border-blue-200 shadow-sm rounded-2xl">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">Total Usuarios</p>
              <p className="text-3xl font-black text-blue-900 mt-1 drop-shadow-sm">{clients.length}</p>
            </div>
            <div className="bg-blue-200/50 p-3 rounded-xl">
              <Users className="h-6 w-6 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-50 to-green-100/50 border-green-200 shadow-sm rounded-2xl">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-green-600 uppercase tracking-widest">Con Ficha SAP (RUT)</p>
              <p className="text-3xl font-black text-green-900 mt-1 drop-shadow-sm">{associatedClients.length}</p>
            </div>
            <div className="bg-green-200/50 p-3 rounded-xl">
              <Building2 className="h-6 w-6 text-green-600" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-50 to-purple-100/50 border-purple-200 shadow-sm rounded-2xl">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-purple-600 uppercase tracking-widest">Sin Ficha SAP</p>
              <p className="text-3xl font-black text-purple-900 mt-1 drop-shadow-sm">{nonAssociatedClients.length}</p>
            </div>
            <div className="bg-purple-200/50 p-3 rounded-xl">
              <KeyRound className="h-6 w-6 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Global Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Buscar por nombre, email, RUT o código..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9 text-sm rounded-xl border-gray-200 shadow-sm focus-visible:ring-blue-500 h-10"
        />
      </div>

      <Tabs defaultValue="asociados" className="w-full">
        <TabsList className="w-full sm:w-auto inline-flex h-auto p-1.5 bg-slate-100/80 rounded-2xl gap-1.5">
          <TabsTrigger value="asociados" className="flex-1 sm:flex-none flex items-center gap-2 rounded-xl py-2 px-5 text-sm font-medium transition-all data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm">
            <Building2 className="h-4 w-4" /> Asociados a RUT
            <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 bg-blue-100 text-blue-700 border-none">{associatedClients.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="no-asociados" className="flex-1 sm:flex-none flex items-center gap-2 rounded-xl py-2 px-5 text-sm font-medium transition-all data-[state=active]:bg-white data-[state=active]:text-purple-700 data-[state=active]:shadow-sm">
            <KeyRound className="h-4 w-4" /> No Asociados
            {nonAssociatedClients.length > 0 && <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 bg-purple-100 text-purple-700 border-none">{nonAssociatedClients.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="requests" className="flex-1 sm:flex-none flex items-center gap-2 rounded-xl py-2 px-5 text-sm font-medium transition-all relative data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <FileText className="h-4 w-4" /> Solicitudes Pendientes
            {pendingRequests.length > 0 && (
              <Badge variant="destructive" className="ml-1 px-1.5 py-0 min-w-[1.25rem] h-5 flex items-center justify-center text-[10px] rounded-full sm:static sm:mr-0 border-none shadow-sm">
                {pendingRequests.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="asociados" className="mt-6 animation-fade-in">
          {renderClientsList(associatedClients, "No hay clientes asociados a RUT en este momento.")}
        </TabsContent>

        <TabsContent value="no-asociados" className="mt-6 animation-fade-in">
          {renderClientsList(nonAssociatedClients, "No hay clientes sin asociar.")}
        </TabsContent>         </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              <p className="text-xs text-gray-400 text-center pt-2">
                Mostrando {filteredClients.length} de {clients.length} usuarios
              </p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="requests" className="space-y-6 mt-6">
          {loadingRequests ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          ) : rawRequests.length === 0 ? (
            <Card className="bg-white dark:bg-gray-800 border bg-muted/20">
              <CardContent className="py-16 text-center">
                <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-500">
                  No hay solicitudes de cuentas registradas
                </h3>
                <p className="text-sm text-gray-400 mt-2 max-w-sm mx-auto">
                  Cuando los clientes llenan el formulario de registro en la tienda virtual, aparecerán aquí para ser procesados.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {/* Pending Section */}
              {pendingRequests.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold flex items-center gap-2 text-gray-700">
                     <span className="w-2 h-2 rounded-full bg-amber-500" />
                     Nuevas Solicitudes Pendientes ({pendingRequests.length})
                  </h3>
                  {pendingRequests.map((req: any) => (
                    <Card key={req.id} className="border-amber-200/50 hover:border-amber-300 transition-all shadow-sm">
                       <CardContent className="p-4 sm:p-5">
                          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                             <div className="space-y-3">
                                <div className="flex items-center gap-3">
                                   <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white font-bold text-sm shadow-sm flex-shrink-0">
                                      {req.empresa?.[0]?.toUpperCase() || "?"}
                                   </div>
                                   <div>
                                      <h4 className="text-base font-bold text-gray-900 leading-tight">{req.empresa}</h4>
                                      <span className="text-xs font-medium text-gray-500">{formatDate(req.createdAt)} • RUT: {req.rut}</span>
                                   </div>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-gray-50">
                                   <div className="space-y-1">
                                      <span className="text-[10px] uppercase font-semibold text-gray-400 tracking-wider">Contacto</span>
                                      <p className="text-sm text-gray-700 font-medium">{req.contacto || '—'}</p>
                                   </div>
                                   <div className="space-y-1">
                                      <span className="text-[10px] uppercase font-semibold text-gray-400 tracking-wider">Email</span>
                                      <p className="text-sm text-gray-700 font-medium flex items-center gap-1.5"><Mail className="w-3 h-3 opacity-60"/> {req.email || '—'}</p>
                                   </div>
                                   <div className="space-y-1">
                                      <span className="text-[10px] uppercase font-semibold text-gray-400 tracking-wider">Teléfono</span>
                                      <p className="text-sm text-gray-700 font-medium flex items-center gap-1.5"><Phone className="w-3 h-3 opacity-60"/> {req.telefono || '—'}</p>
                                   </div>
                                   <div className="space-y-1">
                                      <span className="text-[10px] uppercase font-semibold text-gray-400 tracking-wider">Ciudad</span>
                                      <p className="text-sm text-gray-700 font-medium flex items-center gap-1.5"><MapPin className="w-3 h-3 opacity-60"/> {req.ciudad || '—'}</p>
                                   </div>
                                </div>
                             </div>
                             <div className="flex md:flex-col gap-2 pt-4 md:pt-0 border-t border-gray-100 md:border-0 shrink-0">
                                <Button size="sm" variant="outline" className="w-full text-xs bg-white hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300"
                                   onClick={() => {
                                      if (confirm(`¿Marcar la solicitud de ${req.empresa} como revisada / aprobada?`)) {
                                         updateRequestStatus.mutate({ id: req.id, status: 'aprobado' });
                                      }
                                   }}
                                >
                                   Marcar como revisado
                                </Button>
                             </div>
                          </div>
                       </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* Processed Section */}
              {processedRequests.length > 0 && (
                <div className="space-y-3 pt-6 border-t border-gray-100">
                  <h3 className="text-sm font-semibold flex items-center gap-2 text-gray-500">
                     <span className="w-2 h-2 rounded-full bg-gray-300" />
                     Solicitudes Procesadas
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                     {processedRequests.map((req: any) => (
                        <Card key={req.id} className="border-gray-100 shadow-none bg-gray-50">
                           <CardContent className="p-3 sm:p-4">
                              <div className="flex justify-between items-start">
                                 <div>
                                    <h4 className="text-sm font-bold text-gray-700">{req.empresa}</h4>
                                    <p className="text-xs text-gray-500 mt-1">{req.contacto} • {req.email}</p>
                                    <p className="text-xs text-gray-400 mt-0.5">{req.rut} / {req.telefono}</p>
                                 </div>
                                 <Badge variant="outline" className="text-[10px] bg-white text-gray-500 font-medium">
                                    Revisada
                                 </Badge>
                              </div>
                           </CardContent>
                        </Card>
                     ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ─── Dialog Crear Usuario Cliente ───────────────────── */}
      <Dialog open={isCreateClientDialogOpen} onOpenChange={setIsCreateClientDialogOpen}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-blue-600" />
              Crear Usuario Cliente
            </DialogTitle>
            <DialogDescription>
              Crea credenciales de acceso al portal de compras para un cliente
            </DialogDescription>
          </DialogHeader>
          <Form {...createClientForm}>
            <form onSubmit={createClientForm.handleSubmit(handleCreateClientSubmit)} className="space-y-4">
              {/* Nombre Completo */}
              <FormField
                control={createClientForm.control}
                name="salespersonName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre / Razón Social</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value ?? ''}
                        placeholder="Ingresa el nombre del cliente"
                        data-testid="input-ecom-client-name"
                      />
                    </FormControl>
                    <FormDescription>
                      Nombre de la empresa o persona que usará el portal de compras
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Asistente de Importación desde SAP */}
              <FormItem className="flex flex-col p-3 bg-muted/50 rounded-lg border border-dashed">
                <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Asistente de Importación (Opcional)</FormLabel>
                <Popover open={clientSearchOpen} onOpenChange={setClientSearchOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between bg-white"
                    >
                      Cargar datos de cliente sistema...
                      <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[400px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Buscar cliente en sistema..." />
                      <CommandList>
                        <CommandEmpty>No se encontró ningún cliente.</CommandEmpty>
                        <CommandGroup>
                          {availableClients.map((client) => (
                            <CommandItem
                              value={client}
                              key={client}
                              onSelect={() => {
                                createClientForm.setValue("salespersonName", client);
                                setClientSearchOpen(false);
                              }}
                            >
                              <Check className="mr-2 h-4 w-4 opacity-0" />
                              {client}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <p className="text-[10px] text-muted-foreground mt-1 italic">
                  Selecciona un cliente para autocompletar, o escribe manualmente.
                </p>
              </FormItem>

              {/* RUT del Cliente */}
              <div className="space-y-2">
                <FormField
                  control={createClientForm.control}
                  name="clientRut"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>RUT del Cliente</FormLabel>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <FormControl>
                          <Input
                            {...field}
                            value={field.value ?? ''}
                            placeholder="Ej: 76.123.456-7"
                            className="pl-9"
                            data-testid="input-ecom-client-rut"
                            onChange={(e) => {
                              field.onChange(e.target.value);
                              setCreateRutSearch(e.target.value);
                            }}
                          />
                        </FormControl>
                      </div>
                      <FormDescription>
                        Ingresa el RUT para asociar este usuario con un cliente del sistema
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {createRutResult?.found && createRutResult.client && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                    <Building2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-emerald-800 truncate">{createRutResult.client.nokoen}</p>
                      <p className="text-xs text-emerald-600">RUT: {createRutResult.client.rten} • Código: {createRutResult.client.koen}</p>
                    </div>
                    <Check className="h-4 w-4 text-emerald-500 flex-shrink-0 ml-auto" />
                  </div>
                )}
                {createRutSearch.length >= 4 && createRutResult && !createRutResult.found && (
                  <div className="p-2 rounded-lg bg-amber-50 border border-amber-200">
                    <p className="text-xs text-amber-700">No se encontró un cliente con este RUT en el sistema</p>
                  </div>
                )}
              </div>

              {/* Username */}
              <FormField
                control={createClientForm.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre de Usuario</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-ecom-username" placeholder="Se genera automáticamente" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Email */}
              <FormField
                control={createClientForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} data-testid="input-ecom-email" placeholder="correo@empresa.cl" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Password */}
              <FormField
                control={createClientForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contraseña</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} data-testid="input-ecom-password" placeholder="Mínimo 6 caracteres" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Is Active */}
              <FormField
                control={createClientForm.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Acceso Activo</FormLabel>
                      <p className="text-sm text-muted-foreground">
                        El cliente puede acceder al portal de compras
                      </p>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value ?? true}
                        onCheckedChange={field.onChange}
                        data-testid="switch-ecom-is-active"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {/* Rol forzado - solo informativo */}
              <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-50 border border-blue-200">
                <KeyRound className="h-4 w-4 text-blue-600 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-blue-800">Rol: Cliente eCommerce</p>
                  <p className="text-xs text-blue-600">Este usuario tendrá acceso exclusivo al portal de compras</p>
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    createClientForm.reset();
                    setCreateRutSearch('');
                    setIsCreateClientDialogOpen(false);
                  }}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={createClientMutation.isPending} className="bg-blue-600 hover:bg-blue-700" data-testid="button-submit-create-client">
                  {createClientMutation.isPending ? "Creando..." : "Crear Usuario Cliente"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
