import { useState, useEffect, useMemo } from "react";
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
  GitBranch, Building, Network, Send
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import SuggestedOrderModal, { type SuggestedOrderTargetClient } from "@/components/panoramica-market/suggested-order-modal";

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
  freeShipping: boolean;
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
  address: string | null;
  discountPercent: number;
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
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const canSendSuggested = user?.role === "admin" || (user?.role === "supervisor" || user?.role === "encargado_area");
  const [suggestedTarget, setSuggestedTarget] = useState<SuggestedOrderTargetClient | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [isEditingCommercial, setIsEditingCommercial] = useState(false);
  const [isEditingContact, setIsEditingContact] = useState(false);
  const [contactForm, setContactForm] = useState({
    email: client.email || "",
    phone: client.phone || "",
    address: client.address || "",
  });
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
    lcen: client.lcen || "",
    freeShipping: !!client.freeShipping
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
      lcen: client.lcen || "",
      freeShipping: !!client.freeShipping
    });
    setContactForm({
      email: client.email || "",
      phone: client.phone || "",
      address: client.address || "",
    });
    setIsEditingContact(false);
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

  // Fetch ERP vendedores (real salesperson codes from ERP system)
  const { data: erpVendedores = [] } = useQuery<{ code: string; name: string }[]>({
    queryKey: ["/api/erp/vendedores"],
    queryFn: async () => {
      try {
        const res = await apiRequest("GET", "/api/erp/vendedores");
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
        creditLimit: variables.creditLimit !== undefined ? variables.creditLimit : client.creditLimit,
        pickupWarehouseId: variables.pickupWarehouseId ?? client.pickupWarehouseId,
        lcen: variables.lcen || client.lcen,
        freeShipping: variables.freeShipping !== undefined ? !!variables.freeShipping : !!client.freeShipping,
      });
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo actualizar la información comercial.", variant: "destructive" });
    }
  });

  // Mutation: Update contact info — email, phone, address (keyed by user id, not clientId)
  const updateContactInfo = useMutation({
    mutationFn: async (data: { email: string; phone: string; address: string }) => {
      // Phone/address live on the SAP client ficha; ensure one exists when setting them.
      let newClientId: string | null = null;
      if (!client.clientId && (data.phone.trim() || data.address.trim())) {
        const linkRes = await apiRequest("POST", `/api/users/clients/${client.id}/create-and-link`);
        const linkData = await linkRes.json();
        newClientId = linkData.client?.id || null;
      }
      const res = await apiRequest("PATCH", `/api/users/clients/${client.id}/contact-info`, data);
      const result = await res.json();
      return { ...result, newClientId };
    },
    onSuccess: (data: any) => {
      toast({ title: "Guardado", description: "Datos de contacto actualizados." });
      queryClient.invalidateQueries({ queryKey: ["/api/users/clients"] });
      setIsEditingContact(false);
      onClientUpdated({
        ...client,
        email: data.email,
        phone: data.phone ?? null,
        address: data.address ?? null,
        clientId: data.clientId || data.newClientId || client.clientId,
      });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err?.message || "No se pudieron actualizar los datos de contacto.", variant: "destructive" });
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
  const [useExistingUser, setUseExistingUser] = useState(false);
  const [branchUserSearch, setBranchUserSearch] = useState("");
  const [branchForm, setBranchForm] = useState({
    branchLabel: "",
    username: "",
    email: "",
    password: "",
    existingUserIds: [] as string[],
    salesRepCode: "",
    pickupWarehouseId: "none",
    creditLimit: "",
    paymentCondition: client.paymentCondition || "CONTADO",
    lcen: client.lcen || "",
    address: client.address || "",
    discountPercent: "0",
  });

  const [showEditBranchDialog, setShowEditBranchDialog] = useState(false);
  const [editingBranchId, setEditingBranchId] = useState<string | null>(null);
  const [editBranchForm, setEditBranchForm] = useState({
    branchLabel: "",
    username: "",
    email: "",
    password: "",
    existingUserIds: [] as string[],
    salesRepCode: "",
    pickupWarehouseId: "none",
    creditLimit: "",
    paymentCondition: "",
    lcen: "",
    address: "",
    discountPercent: "0",
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
      queryClient.invalidateQueries({ queryKey: ["/api/users/clients/users", client.clientId] });
      setShowBranchDialog(false);
      setUseExistingUser(false);
      setBranchUserSearch("");
      setBranchForm({ branchLabel: "", username: "", email: "", password: "", existingUserIds: [], salesRepCode: "", pickupWarehouseId: "none", creditLimit: "", paymentCondition: client.paymentCondition || "CONTADO", lcen: client.lcen || "", address: client.address || "", discountPercent: "0" });
    },
    onError: (error: any) => {
      const msg = (() => { try { const m = error.message?.match(/\{.*\}/); return m ? JSON.parse(m[0]).message : error.message; } catch { return error.message || "Error desconocido"; } })();
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  });

  // Mutation: Edit branch
  const editBranchMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("PUT", `/api/users/clients/branches/${editingBranchId}`, data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Sucursal actualizada", description: "La sucursal se ha actualizado exitosamente." });
      queryClient.invalidateQueries({ queryKey: ["/api/users/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users/clients/branches"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users/clients/users", client.clientId] });
      setShowEditBranchDialog(false);
      setEditingBranchId(null);
      setUseExistingUser(false);
      setBranchUserSearch("");
      setEditBranchForm({ branchLabel: "", username: "", email: "", password: "", existingUserIds: [], salesRepCode: "", pickupWarehouseId: "none", creditLimit: "", paymentCondition: "", lcen: "", address: "", discountPercent: "0" });
    },
    onError: (error: any) => {
      const msg = (() => { try { const m = error.message?.match(/\{.*\}/); return m ? JSON.parse(m[0]).message : error.message; } catch { return error.message || "Error desconocido"; } })();
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  });

  const handleEditBranch = async (branch: BranchInfo) => {
    setEditingBranchId(branch.id);
    setUseExistingUser(false);
    
    // Refetch users with fresh data before pre-populating
    let freshUsers = groupUsers;
    try {
      const res = await apiRequest("GET", `/api/users/clients/${client.clientId}/users`);
      freshUsers = await res.json();
      // Also update the query cache
      queryClient.setQueryData(["/api/users/clients/users", client.clientId], freshUsers);
    } catch {
      // fallback to cached groupUsers
    }

    // Pre-populate existingUserIds with users currently assigned to this branch
    // Primary strategy: use branchAssignments array (from junction table)
    let currentBranchUserIds = freshUsers
      .filter((u: any) => {
        const assignments = u.branchAssignments || [];
        return assignments.some((a: any) => a.clientId === branch.id);
      })
      .map((u: any) => u.id);
    
    // Fallback 1: match by clientId (legacy)
    if (currentBranchUserIds.length === 0) {
      currentBranchUserIds = freshUsers
        .filter((u: any) => u.clientId === branch.id)
        .map((u: any) => u.id);
    }

    // Fallback 2: match by branchLabel
    if (currentBranchUserIds.length === 0 && branch.branchLabel) {
      currentBranchUserIds = freshUsers
        .filter((u: any) => u.branchLabel === branch.branchLabel)
        .map((u: any) => u.id);
    }

    // Fallback 3: match by branchName (auto-generated "COMPANY - LABEL")
    if (currentBranchUserIds.length === 0 && branch.name) {
      currentBranchUserIds = freshUsers
        .filter((u: any) => u.branchName === branch.name)
        .map((u: any) => u.id);
    }

    setEditBranchForm({
      branchLabel: branch.branchLabel || "",
      username: "",
      email: "",
      password: "",
      existingUserIds: currentBranchUserIds,
      salesRepCode: branch.salesRepCode || "",
      pickupWarehouseId: branch.pickupWarehouseId || "none",
      creditLimit: branch.creditLimit !== null ? branch.creditLimit.toString() : "",
      paymentCondition: branch.paymentCondition || "CONTADO",
      lcen: client.lcen || "",
      address: branch.address || "",
      discountPercent: branch.discountPercent != null ? branch.discountPercent.toString() : "0",
    });
    setShowEditBranchDialog(true);
  };

  // ─── User Management ──────────────────────────────────
  const [showUserDialog, setShowUserDialog] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [userIsActive, setUserIsActive] = useState(true);
  const [userForm, setUserForm] = useState({
    salespersonName: "",
    username: "",
    email: "",
    password: "",
    phone: "",
  });

  // Optional: when opening to CREATE a new user, clear state
  const handleCreateUser = () => {
    setEditingUserId(null);
    setUserIsActive(true);
    setUserForm({ salespersonName: "", username: "", email: "", password: "", phone: "" });
    setShowUserDialog(true);
  };

  // Fetch group users
  interface GroupUser {
    id: string;
    salespersonName: string;
    username: string | null;
    email: string | null;
    phone: string | null;
    role: string;
    isActive: boolean;
    clientId: string | null;
    clientRut: string | null;
    createdAt: string;
    branchLabel: string | null;
    branchName: string | null;
    isRoot: boolean;
    branchAssignments?: Array<{ clientId: string; branchLabel: string | null; branchName: string | null }>;
  }

  const { data: groupUsers = [] } = useQuery<GroupUser[]>({
    queryKey: ["/api/users/clients/users", client.clientId],
    queryFn: async () => {
      try {
        const res = await apiRequest("GET", `/api/users/clients/${client.clientId}/users`);
        return await res.json();
      } catch {
        return [];
      }
    },
    enabled: !!client.clientId,
  });

  // Filter group users for selector
  const availableExistingUsers = groupUsers.filter((u) => {
    const q = branchUserSearch.toLowerCase();
    if (!q) return true;
    return (
      u.salespersonName?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.clientRut?.toLowerCase().includes(q)
    );
  });

  // Mutation: Create user for group
  const createUserMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", `/api/users/clients/${client.clientId}/users`, data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Usuario creado", description: "El usuario se ha creado exitosamente." });
      queryClient.invalidateQueries({ queryKey: ["/api/users/clients/users", client.clientId] });
      queryClient.invalidateQueries({ queryKey: ["/api/users/clients"] });
      setShowUserDialog(false);
      setUserForm({ salespersonName: "", username: "", email: "", password: "", phone: "" });
    },
    onError: (error: any) => {
      const msg = (() => { try { const m = error.message?.match(/\{.*\}/); return m ? JSON.parse(m[0]).message : error.message; } catch { return error.message || "Error desconocido"; } })();
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  });

  const editUserMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("PUT", `/api/users/salespeople/${editingUserId}`, data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Usuario actualizado", description: "El usuario se ha actualizado exitosamente." });
      queryClient.invalidateQueries({ queryKey: ["/api/users/clients/users", client.clientId] });
      queryClient.invalidateQueries({ queryKey: ["/api/users/clients"] });
      setShowUserDialog(false);
      setEditingUserId(null);
      setUserForm({ salespersonName: "", username: "", email: "", password: "", phone: "" });
    },
    onError: (error: any) => {
      const msg = (() => { try { const m = error.message?.match(/\{.*\}/); return m ? JSON.parse(m[0]).message : error.message; } catch { return error.message || "Error desconocido"; } })();
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/users/salespeople/${id}`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Usuario eliminado", description: "El usuario se ha eliminado exitosamente." });
      queryClient.invalidateQueries({ queryKey: ["/api/users/clients/users", client.clientId] });
      queryClient.invalidateQueries({ queryKey: ["/api/users/clients"] });
    },
    onError: (error: any) => {
      const msg = (() => { try { const m = error.message?.match(/\{.*\}/); return m ? JSON.parse(m[0]).message : error.message; } catch { return error.message || "Error desconocido"; } })();
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  });

  // Set default branch for a user
  const setDefaultBranchMutation = useMutation({
    mutationFn: async ({ userId, branchClientId }: { userId: string; branchClientId: string }) => {
      const res = await apiRequest("PUT", `/api/users/${userId}/default-branch`, { branchClientId });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Sucursal por defecto actualizada", description: "El usuario ahora tiene una nueva sucursal por defecto." });
      queryClient.invalidateQueries({ queryKey: ["/api/users/clients/users", client.clientId] });
    },
    onError: (error: any) => {
      const msg = (() => { try { const m = error.message?.match(/\{.*\}/); return m ? JSON.parse(m[0]).message : error.message; } catch { return error.message || "Error desconocido"; } })();
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  });

  const handleEditUser = (user: GroupUser) => {
    setEditingUserId(user.id);
    setUserIsActive(user.isActive);
    setUserForm({
      salespersonName: user.salespersonName || "",
      username: user.username || "",
      email: user.email || "",
      password: "", // Leave blank, only submit if changed
      phone: user.phone || "",
    });
    setShowUserDialog(true);
  };

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

  // Fetch SAP (ERP) order history for the linked client: FCV facturas + NVV pending invoicing.
  // Only fired for SAP-linked clients (clientId present), mirroring the commercial dashboard.
  const { data: erpData } = useQuery<{ documents: any[]; fcvCount?: number; nvvPendingCount?: number }>({
    queryKey: ["/api/users/clients", client.clientId, "erp-orders"],
    queryFn: async () => {
      try {
        const res = await apiRequest("GET", `/api/users/clients/${client.clientId}/erp-orders`);
        return await res.json();
      } catch {
        return { documents: [] };
      }
    },
    enabled: !!client.clientId,
  });
  const sapDocuments = erpData?.documents || [];

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

  // Unified order history: eCommerce store orders + SAP documents (FCV facturas + NVV pendientes
  // de facturación). SAP-linked clients should see their full history, not only store orders.
  const mergedOrders = useMemo(() => {
    const ecommerceRows = orders.map((o: any) => ({
      key: `ecom-${o.id}`,
      source: "ecommerce" as const,
      docType: "ECOM" as const,
      orderNumber: o.orderNumber || getNumericOrderId(o.id),
      date: o.createdAt,
      items: o.items?.length || 0,
      total: parseFloat(o.total || "0") || 0,
      status: o.status,
    }));
    const sapRows = (sapDocuments || []).map((d: any) => ({
      key: d.id,
      source: "sap" as const,
      docType: d.docType as "FCV" | "NVV",
      orderNumber: d.orderNumber,
      date: d.date,
      items: d.items || 0,
      total: d.total || 0,
      status: d.status,
    }));
    return [...ecommerceRows, ...sapRows].sort((a, b) => {
      const da = a.date ? new Date(a.date).getTime() : 0;
      const dbb = b.date ? new Date(b.date).getTime() : 0;
      return dbb - da;
    });
  }, [orders, sapDocuments]);

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
          <div className="flex flex-col items-end gap-3">
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <Button
                variant="outline"
                onClick={() => setLocation(`/client/${encodeURIComponent(client.clientName)}`)}
                className="border-slate-600 bg-slate-800/50 text-slate-200 hover:bg-slate-700 hover:text-white h-9 px-4 text-sm font-semibold"
                data-testid="button-view-analysis-detail"
              >
                <TrendingUp className="h-4 w-4 mr-2" />
                Ver análisis
              </Button>
              {canSendSuggested && (
                <Button
                  onClick={() => setSuggestedTarget({ clientName: client.clientName, clientCode: client.clientCode })}
                  className="bg-[#FF6E23] hover:bg-[#E55E13] text-white shadow-lg shadow-orange-500/20 h-9 px-4 text-sm font-semibold"
                  data-testid="button-send-suggested-detail"
                >
                  <Send className="h-4 w-4 mr-2" />
                  Enviar sugerido
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-end">
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
            {mergedOrders.length > 0 && <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">{mergedOrders.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="pricelist" className="flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <FileText className="h-4 w-4" /> Lista de Precios
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base flex items-center gap-2">
                  <UserCircle className="h-4 w-4 text-blue-500" />
                  Información General
                </CardTitle>
                {!isEditingContact && (
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-blue-600" onClick={() => { setContactForm({ email: client.email || "", phone: client.phone || "", address: client.address || "" }); setIsEditingContact(true); }}>
                    <Edit2 className="h-3.5 w-3.5 mr-1" /> Editar
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { label: "Nombre", value: client.clientName, icon: UserCircle, field: null },
                  { label: "Email", value: client.email, icon: Mail, field: "email" as const },
                  { label: "RUT", value: client.rut, icon: Building2, field: null },
                  { label: "Código", value: client.clientCode, icon: Hash, field: null },
                  { label: "Teléfono", value: client.phone, icon: Phone, field: "phone" as const },
                  { label: "Dirección", value: client.address, icon: MapPin, field: "address" as const },
                  { label: "Comuna", value: client.commune, icon: MapPin, field: null },
                  { label: "Registro", value: formatDate(client.createdAt), icon: Calendar, field: null },
                ].map(({ label, value, icon: Icon, field }) => (
                  <div key={label} className="flex items-center justify-between py-2 border-b border-muted/50 last:border-0">
                    <span className="text-sm text-muted-foreground flex items-center gap-2">
                      <Icon className="h-3.5 w-3.5" /> {label}
                    </span>
                    {field && isEditingContact ? (
                      <Input
                        type={field === "email" ? "email" : field === "phone" ? "tel" : "text"}
                        value={contactForm[field]}
                        onChange={(e) => setContactForm((f) => ({ ...f, [field]: e.target.value }))}
                        placeholder={field === "email" ? "correo@ejemplo.com" : field === "phone" ? "Teléfono" : "Dirección"}
                        className="h-8 text-sm max-w-[60%]"
                      />
                    ) : (
                      <span className="text-sm font-medium text-right max-w-[60%] truncate">{value || "—"}</span>
                    )}
                  </div>
                ))}
                {isEditingContact && (
                  <div className="flex items-center justify-end gap-2 pt-2">
                    <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { setIsEditingContact(false); setContactForm({ email: client.email || "", phone: client.phone || "", address: client.address || "" }); }}>Cancelar</Button>
                    <Button size="sm" className="h-8 text-xs bg-blue-600 hover:bg-blue-700" onClick={() => updateContactInfo.mutate({ email: contactForm.email.trim(), phone: contactForm.phone.trim(), address: contactForm.address.trim() })} disabled={updateContactInfo.isPending || !contactForm.email.trim()}>
                      {updateContactInfo.isPending ? "Guardando..." : "Guardar"}
                    </Button>
                  </div>
                )}
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
                        <Label className="text-xs">Vendedor Asignado</Label>
                        <Select 
                          value={commercialForm.salesRepCode || "unassigned"} 
                          onValueChange={(val) => setCommercialForm(p => ({ ...p, salesRepCode: val === "unassigned" ? "" : val }))}
                        >
                          <SelectTrigger className="h-8 text-sm truncate">
                            <SelectValue placeholder="Seleccione vendedor..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unassigned" className="text-muted-foreground italic">Sin vendedor asignado</SelectItem>
                            {erpVendedores.map((v: any) => (
                              <SelectItem key={v.code} value={v.code}>
                                {v.name} ({v.code})
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

                    {/* Solo la línea se escribe. El usado y el disponible salen de
                        las cuentas por cobrar (pestaña Crédito de la ficha), no
                        se tipean: antes eran tres campos libres que se guardaban
                        en columnas del ERP y el ETL los borraba en la siguiente
                        corrida. Vacío = rige la línea que dice Softland. */}
                    <div className="space-y-1.5">
                      <Label className="text-xs border-b border-dashed border-gray-300 pb-0.5 cursor-help" title="Línea de crédito fijada a mano. Vacío = la del ERP.">Límite Crédito ($)</Label>
                      <Input
                        type="number" className="h-8 text-sm" placeholder="Vacío = usar la línea del ERP"
                        value={commercialForm.creditLimit}
                        onChange={(e) => setCommercialForm(p => ({ ...p, creditLimit: e.target.value }))}
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Queda marcada como <span className="font-medium">manual</span> en la ficha. La deuda y el
                        disponible se calculan solos desde las cuentas por cobrar.
                      </p>
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

                    <div className="flex items-center justify-between gap-2 rounded-md border border-emerald-100 bg-emerald-50/40 px-3 py-2">
                      <div className="space-y-0.5">
                        <Label className="text-xs font-medium text-emerald-900">Envío Gratis</Label>
                        <p className="text-[11px] text-emerald-700/80 leading-tight">El cliente no paga costo de envío en la tienda.</p>
                      </div>
                      <Switch
                        checked={commercialForm.freeShipping}
                        onCheckedChange={(val) => setCommercialForm(p => ({ ...p, freeShipping: val }))}
                      />
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
                             // Override marcado de la ficha. null = quitar el override
                             // y volver a la línea del ERP.
                             creditLimit: commercialForm.creditLimit ? parseFloat(commercialForm.creditLimit) : null,
                             lcen: commercialForm.lcen ? commercialForm.lcen : null,
                             freeShipping: commercialForm.freeShipping
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
                      { label: "Vendedor", value: (() => {
                        const v = erpVendedores.find((v: any) => v.code === client.salesRepCode);
                        return v ? `${v.name} (${v.code})` : client.salesRepCode;
                      })() },
                      { label: "Lista de Precios", value: getListName(client.lcen) || '—' },
                      // Usado y disponible viven en la pestaña Crédito de la ficha,
                      // que los calcula desde las cuentas por cobrar. Acá salían de
                      // columnas de cupo del ERP y eran números inventados.
                      { label: "Límite de Crédito", value: formatCurrency(client.creditLimit) },
                      { label: "Bodega de Retiro", value: warehouses.find(w => w.id === client.pickupWarehouseId)?.name || "—" },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex items-center justify-between py-2 border-b border-muted/50 last:border-0 hover:bg-muted/10">
                        <span className="text-sm text-muted-foreground">{label}</span>
                        <span className="text-sm font-medium">{value || "—"}</span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between py-2 border-b border-muted/50 last:border-0 hover:bg-muted/10">
                      <span className="text-sm text-muted-foreground">Envío Gratis</span>
                      {client.freeShipping ? (
                        <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-200">Activo</Badge>
                      ) : (
                        <span className="text-sm font-medium">—</span>
                      )}
                    </div>
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
                Pedidos eCommerce, facturas (FCV) y notas de venta (NVV) pendientes de facturación
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {mergedOrders.length === 0 ? (
                <div className="text-center py-12">
                  <ShoppingBag className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">Este cliente aún no tiene pedidos</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/20">
                      <TableHead className="text-xs uppercase">Tipo</TableHead>
                      <TableHead className="text-xs uppercase">Documento</TableHead>
                      <TableHead className="text-xs uppercase">Fecha</TableHead>
                      <TableHead className="text-xs uppercase">Productos</TableHead>
                      <TableHead className="text-xs uppercase text-right">Total</TableHead>
                      <TableHead className="text-xs uppercase text-center">Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mergedOrders.map((order) => (
                      <TableRow key={order.key} className="hover:bg-muted/10">
                        <TableCell>
                          {order.docType === "FCV" ? (
                            <Badge variant="secondary" className="text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-700 border-emerald-200">Factura</Badge>
                          ) : order.docType === "NVV" ? (
                            <Badge variant="secondary" className="text-[10px] px-2 py-0.5 bg-violet-100 text-violet-700 border-violet-200">Nota de venta</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px] px-2 py-0.5 bg-blue-100 text-blue-700 border-blue-200">eCommerce</Badge>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-sm font-semibold text-orange-600">
                          #{order.orderNumber}
                        </TableCell>
                        <TableCell className="text-sm">{formatDate(order.date)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {order.items} items
                        </TableCell>
                        <TableCell className="text-sm text-right font-medium tabular-nums">
                          {formatCurrency(order.total)}
                        </TableCell>
                        <TableCell className="text-center">
                          {order.source === "sap" ? (
                            order.docType === "FCV" ? (
                              <Badge variant="secondary" className="text-[10px] px-2 py-0.5 bg-green-100 text-green-700 border-green-200">Facturado</Badge>
                            ) : (
                              <Badge variant="secondary" className="text-[10px] px-2 py-0.5 bg-amber-100 text-amber-700 border-amber-200">Pend. facturación</Badge>
                            )
                          ) : (
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
                          )}
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
                  <div className="p-3 bg-gradient-to-r from-violet-50 to-indigo-50 dark:from-violet-950/30 dark:to-indigo-950/30 rounded-lg border border-violet-100 dark:border-violet-800">
                    <div className="text-center">
                      <p className="text-[10px] font-medium text-violet-500 uppercase tracking-wider">Crédito Grupo</p>
                      <p className="text-lg font-bold text-violet-900 dark:text-violet-100">{formatCurrency(branchGroup.groupTotals.creditLimit)}</p>
                      {/* Usado y disponible del grupo salían de columnas de cupo
                          del ERP. El uso real está en la pestaña Crédito de la
                          ficha, que suma las cuentas por cobrar de la empresa. */}
                      <p className="text-[10px] text-violet-500 mt-0.5">Suma de las líneas de las sucursales</p>
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
                          {branch.address && (
                            <p className="text-[10px] text-muted-foreground truncate flex items-center gap-1">
                              <MapPin className="h-2.5 w-2.5 flex-shrink-0" />
                              {branch.address}
                            </p>
                          )}
                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                            {branch.isRoot && <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4">Matriz</Badge>}
                            {branch.branchLabel && <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4">{branch.branchLabel}</Badge>}
                            {branch.discountPercent > 0 && (
                              <Badge className="text-[9px] px-1.5 py-0 h-4 bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100">
                                -{branch.discountPercent}%
                              </Badge>
                            )}
                            {branch.salesRepCode && <span>Vendedor: {erpVendedores.find((v: any) => v.code === branch.salesRepCode)?.name || branch.salesRepCode}</span>}
                            {(() => {
                              const bUsers = groupUsers.filter(u => u.clientId === branch.id);
                              const bEmails = bUsers.map(u => u.email || u.username).filter(Boolean);
                              return bEmails.length > 0 ? (
                                <span className="flex items-center gap-1 text-slate-500">
                                  <UserCircle className="h-3 w-3" />
                                  {bEmails.join(', ')}
                                </span>
                              ) : null;
                            })()}
                          </div>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 ml-3 flex flex-col items-end gap-1">
                        <p className="text-xs font-medium">{formatCurrency(branch.creditLimit)}</p>
                        <Button variant="ghost" size="icon" className="h-6 w-6 mt-1" onClick={() => handleEditBranch(branch)}>
                          <Edit2 className="h-3 w-3" />
                        </Button>
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

      {/* ─── Users Section ───────────────────────────── */}
      {client.clientId && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-500" />
              Usuarios de la Empresa
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs text-blue-600 border-blue-200 hover:bg-blue-50"
              onClick={() => setShowUserDialog(true)}
            >
              <UserPlus className="h-3.5 w-3.5 mr-1" />
              Crear Usuario
            </Button>
          </CardHeader>
          <CardContent>
            {groupUsers.length > 0 ? (
              <div className="space-y-2">
                {/* Summary badge */}
                <div className="flex items-center gap-2 mb-3">
                  <Badge variant="secondary" className="text-xs px-2 py-0.5">
                    {groupUsers.length} {groupUsers.length === 1 ? 'usuario' : 'usuarios'}
                  </Badge>
                  <Badge variant="outline" className="text-xs px-2 py-0.5 text-green-600 border-green-200">
                    {groupUsers.filter(u => u.isActive).length} activos
                  </Badge>
                </div>

                {/* User list */}
                {groupUsers.map((gUser) => (
                  <div
                    key={gUser.id}
                    className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                      gUser.id === client.id
                        ? "bg-blue-50/70 border-blue-200 dark:bg-blue-950/30 dark:border-blue-700"
                        : "bg-muted/20 border-muted hover:bg-muted/40"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                        gUser.isActive
                          ? "bg-gradient-to-br from-blue-400 to-indigo-500 text-white"
                          : "bg-gray-300 text-gray-500"
                      }`}>
                        {(gUser.salespersonName || gUser.email)?.[0]?.toUpperCase() || "?"}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{gUser.salespersonName}</p>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground flex-wrap">
                          {gUser.username && (
                            <span className="flex items-center gap-0.5">
                              <KeyRound className="h-2.5 w-2.5" />
                              {gUser.username}
                            </span>
                          )}
                          {gUser.email && (
                            <span className="flex items-center gap-0.5">
                              <Mail className="h-2.5 w-2.5" />
                              {gUser.email}
                            </span>
                          )}
                          {(gUser.branchAssignments && gUser.branchAssignments.length > 0) ? (
                            gUser.branchAssignments.map((ba, idx) => {
                              const isDefault = gUser.clientId === ba.clientId;
                              const canSetDefault = gUser.branchAssignments!.length > 1;
                              return (
                                <Badge
                                  key={idx}
                                  variant={isDefault ? "default" : "outline"}
                                  className={`text-[9px] px-1.5 py-0 h-4 ${
                                    isDefault
                                      ? "bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-300"
                                      : canSetDefault
                                      ? "cursor-pointer hover:bg-blue-50 hover:border-blue-300 transition-colors"
                                      : ""
                                  }`}
                                  title={isDefault ? "Sucursal por defecto" : canSetDefault ? "Clic para establecer como sucursal por defecto" : ""}
                                  onClick={!isDefault && canSetDefault ? (e: React.MouseEvent) => {
                                    e.stopPropagation();
                                    setDefaultBranchMutation.mutate({ userId: gUser.id, branchClientId: ba.clientId });
                                  } : undefined}
                                >
                                  {isDefault && <span className="mr-0.5">⭐</span>}
                                  <GitBranch className="h-2.5 w-2.5 mr-0.5" />
                                  {ba.branchLabel || ba.branchName || 'Matriz'}
                                </Badge>
                              );
                            })
                          ) : gUser.branchLabel ? (
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4">
                              <GitBranch className="h-2.5 w-2.5 mr-0.5" />
                              {gUser.branchLabel}
                            </Badge>
                          ) : gUser.isRoot ? (
                            <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4">Matriz</Badge>
                          ) : null}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                      <Badge
                        variant="secondary"
                        className={`text-[9px] px-1.5 py-0.5 ${
                          gUser.isActive
                            ? "bg-green-100 text-green-700 border-green-200"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {gUser.isActive ? "Activo" : "Inactivo"}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/30"
                        onClick={() => handleEditUser(gUser)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/30"
                        onClick={() => {
                          if (confirm('¿Estás seguro de que deseas eliminar este usuario?')) {
                            deleteUserMutation.mutate(gUser.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <Users className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No hay usuarios registrados para esta empresa.</p>
                <p className="text-xs text-muted-foreground mt-1">Crea usuarios para que puedan acceder al eCommerce y luego vincúlalos a sucursales.</p>
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

            {/* Address */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Dirección</Label>
              <Input
                placeholder="Ej: Av. Libertador 1234, Santiago"
                value={branchForm.address}
                onChange={(e) => setBranchForm(p => ({ ...p, address: e.target.value }))}
              />
              <p className="text-[10px] text-muted-foreground">Se hereda del padre si no se modifica.</p>
            </div>

            {/* Discount */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Descuento Global (%)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                step="0.01"
                placeholder="0"
                value={branchForm.discountPercent}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (!isNaN(val) && val >= 0 && val <= 100) {
                    setBranchForm(p => ({ ...p, discountPercent: e.target.value }));
                  } else if (e.target.value === '') {
                    setBranchForm(p => ({ ...p, discountPercent: '' }));
                  }
                }}
              />
              <p className="text-[10px] text-muted-foreground">Descuento aplicado sobre todos los productos en /tienda (0-100). 0 = sin descuento.</p>
            </div>

            {/* Toggle: New user vs Existing user */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-violet-50/70 dark:bg-violet-950/20 border border-violet-100 dark:border-violet-800">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-violet-500" />
                <span className="text-sm font-medium text-violet-800 dark:text-violet-200">Usar usuario existente</span>
              </div>
              <Switch
                checked={useExistingUser}
                onCheckedChange={(checked) => {
                  setUseExistingUser(checked);
                  if (checked) {
                    setBranchForm(p => ({ ...p, username: "", password: "", email: "" }));
                  } else {
                    setBranchForm(p => ({ ...p, existingUserIds: [] }));
                  }
                }}
              />
            </div>

            {useExistingUser ? (
              /* Existing user selector */
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Seleccionar Usuarios Existentes *</Label>
                <div className="space-y-2">
                  <Input
                    placeholder="Buscar por nombre, email o RUT..."
                    value={branchUserSearch}
                    onChange={(e) => setBranchUserSearch(e.target.value)}
                    className="h-9"
                  />
                  <div className="max-h-[180px] overflow-y-auto rounded-lg border bg-background">
                    {availableExistingUsers.length === 0 ? (
                      <div className="text-center py-6 text-sm text-muted-foreground">
                        {branchUserSearch ? "Sin resultados" : "No hay usuarios disponibles"}
                      </div>
                    ) : (
                      availableExistingUsers.slice(0, 20).map((u) => {
                        const isSelected = branchForm.existingUserIds.includes(u.id);
                        return (
                          <div
                            key={u.id}
                            onClick={() => {
                              setBranchForm(p => {
                                const newIds = p.existingUserIds.includes(u.id)
                                  ? p.existingUserIds.filter(id => id !== u.id)
                                  : [...p.existingUserIds, u.id];
                                return { ...p, existingUserIds: newIds };
                              });
                            }}
                            className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors border-b last:border-0 ${
                              isSelected
                                ? "bg-violet-50 dark:bg-violet-950/30 border-l-2 border-l-violet-500"
                                : "hover:bg-muted/50"
                            }`}
                          >
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
                              isSelected
                                ? "bg-violet-600 text-white"
                                : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                            }`}>
                              {(u.salespersonName || u.email)?.[0]?.toUpperCase() || "?"}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium truncate">{u.salespersonName || u.email}</p>
                              <p className="text-[11px] text-muted-foreground truncate">
                                {u.email}{u.clientRut ? ` · ${u.clientRut}` : ""}
                                {u.branchLabel ? ` · ${u.branchLabel}` : ""}
                              </p>
                            </div>
                            {isSelected && (
                              <Check className="h-4 w-4 text-violet-600 flex-shrink-0" />
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                  {branchForm.existingUserIds.length > 0 && (
                    <div className="text-xs text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 p-2 rounded-md">
                      <p className="font-medium mb-1">Usuarios seleccionados ({branchForm.existingUserIds.length}):</p>
                      <ul className="list-disc pl-4 space-y-0.5">
                        {branchForm.existingUserIds.map(uid => {
                          const u = groupUsers.find(cu => cu.id === uid);
                          return <li key={uid}>{u?.salespersonName || u?.email || "Desconocido"}</li>;
                        })}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* New user credentials */
              <>
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
              </>
            )}

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
                    {erpVendedores.map((v: any) => (
                      <SelectItem key={v.code} value={v.code}>
                        {v.name} ({v.code})
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
              disabled={
                !branchForm.branchLabel ||
                (useExistingUser ? branchForm.existingUserIds.length === 0 : (!branchForm.username || !branchForm.password || branchForm.password.length < 6)) ||
                createBranchMutation.isPending
              }
              onClick={() => {
                const payload: any = {
                  branchLabel: branchForm.branchLabel,
                  salesRepCode: branchForm.salesRepCode || null,
                  pickupWarehouseId: branchForm.pickupWarehouseId === "none" ? null : branchForm.pickupWarehouseId,
                  creditLimit: branchForm.creditLimit ? parseFloat(branchForm.creditLimit) : null,
                  paymentCondition: branchForm.paymentCondition || null,
                  lcen: branchForm.lcen || null,
                  address: branchForm.address || null,
                  discountPercent: branchForm.discountPercent ? parseFloat(branchForm.discountPercent) : 0,
                };
                if (useExistingUser && branchForm.existingUserIds.length > 0) {
                  payload.existingUserIds = branchForm.existingUserIds;
                } else {
                  payload.username = branchForm.username;
                  payload.email = branchForm.email || null;
                  payload.password = branchForm.password;
                }
                createBranchMutation.mutate(payload);
              }}
            >
              {createBranchMutation.isPending ? "Creando..." : "Crear Sucursal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Dialog Editar Sucursal ───────────────────── */}
      <Dialog open={showEditBranchDialog} onOpenChange={setShowEditBranchDialog}>
        <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="h-5 w-5 text-violet-600" />
              Editar Sucursal
            </DialogTitle>
            <DialogDescription>
              Modifica los detalles comerciales o agrega un usuario a esta sucursal.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Branch label */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Nombre de la Sucursal *</Label>
              <Input
                placeholder="Ej: Santiago Centro, Valparaíso, Concepción..."
                value={editBranchForm.branchLabel}
                onChange={(e) => setEditBranchForm(p => ({ ...p, branchLabel: e.target.value }))}
              />
            </div>

            {/* Address */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Dirección</Label>
              <Input
                placeholder="Ej: Av. Libertador 1234, Santiago"
                value={editBranchForm.address}
                onChange={(e) => setEditBranchForm(p => ({ ...p, address: e.target.value }))}
              />
            </div>

            {/* Discount */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Descuento Global (%)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                step="0.01"
                placeholder="0"
                value={editBranchForm.discountPercent}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (!isNaN(val) && val >= 0 && val <= 100) {
                    setEditBranchForm(p => ({ ...p, discountPercent: e.target.value }));
                  } else if (e.target.value === '') {
                    setEditBranchForm(p => ({ ...p, discountPercent: '' }));
                  }
                }}
              />
              <p className="text-[10px] text-muted-foreground">Descuento aplicado sobre todos los productos en /tienda (0-100). 0 = sin descuento.</p>
            </div>

            {/* Currently assigned users — always visible */}
            {(() => {
              // Use pre-populated existingUserIds to find assigned users (set in handleEditBranch)
              const assignedUsers = editBranchForm.existingUserIds.length > 0
                ? editBranchForm.existingUserIds
                    .map(uid => groupUsers.find(u => u.id === uid))
                    .filter((u): u is GroupUser => !!u)
                : groupUsers.filter(u => u.clientId === editingBranchId);
              if (assignedUsers.length === 0) return null;
              return (
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Usuarios Asignados ({assignedUsers.length})</Label>
                  <div className="rounded-lg border bg-slate-50/50 dark:bg-slate-950/20 divide-y">
                    {assignedUsers.map(u => (
                      <div key={u.id} className="flex items-center gap-3 px-3 py-2.5">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold flex-shrink-0 bg-violet-600 text-white">
                          {(u.salespersonName || u.email)?.[0]?.toUpperCase() || "?"}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{u.salespersonName || u.email}</p>
                          <p className="text-[10px] text-muted-foreground truncate">
                            {u.email}{u.username ? ` · @${u.username}` : ""}{u.clientRut ? ` · ${u.clientRut}` : ""}
                          </p>
                        </div>
                        <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 flex-shrink-0">
                          {u.isActive ? "Activo" : "Inactivo"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Toggle: Add User to Branch */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-violet-50/70 dark:bg-violet-950/20 border border-violet-100 dark:border-violet-800">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-violet-500" />
                <span className="text-sm font-medium text-violet-800 dark:text-violet-200">Agregar / Reasignar Usuarios (Opcional)</span>
              </div>
              <Switch
                checked={useExistingUser}
                onCheckedChange={(checked) => {
                  setUseExistingUser(checked);
                  if (checked) {
                    setEditBranchForm(p => ({ ...p, username: "", password: "", email: "" }));
                  } else {
                    // Restore to current branch users, don't clear
                    const currentBranchUserIds = groupUsers
                      .filter(u => u.clientId === editingBranchId)
                      .map(u => u.id);
                    setEditBranchForm(p => ({ ...p, existingUserIds: currentBranchUserIds }));
                  }
                }}
              />
            </div>

            {useExistingUser ? (
              /* Existing user selector */
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Seleccionar Usuarios Existentes</Label>
                <div className="space-y-2">
                  <Input
                    placeholder="Buscar por nombre, email o RUT..."
                    value={branchUserSearch}
                    onChange={(e) => setBranchUserSearch(e.target.value)}
                    className="h-9"
                  />
                  <div className="max-h-[180px] overflow-y-auto rounded-lg border bg-background">
                    {availableExistingUsers.length === 0 ? (
                      <div className="text-center py-6 text-sm text-muted-foreground">
                        {branchUserSearch ? "Sin resultados" : "No hay usuarios disponibles"}
                      </div>
                    ) : (
                      availableExistingUsers.slice(0, 20).map((u) => {
                        const isSelected = editBranchForm.existingUserIds.includes(u.id);
                        return (
                          <div
                            key={u.id}
                            onClick={() => {
                              setEditBranchForm(p => {
                                const newIds = p.existingUserIds.includes(u.id)
                                  ? p.existingUserIds.filter(id => id !== u.id)
                                  : [...p.existingUserIds, u.id];
                                return { ...p, existingUserIds: newIds };
                              });
                            }}
                            className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors border-b last:border-0 ${
                              isSelected
                                ? "bg-violet-50 dark:bg-violet-950/30 border-l-2 border-l-violet-500"
                                : "hover:bg-muted/50"
                            }`}
                          >
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
                              isSelected
                                ? "bg-violet-600 text-white"
                                : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                            }`}>
                              {(u.salespersonName || u.email)?.[0]?.toUpperCase() || "?"}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium truncate">{u.salespersonName || u.email}</p>
                              <p className="text-[11px] text-muted-foreground truncate">
                                {u.email}{u.clientRut ? ` · ${u.clientRut}` : ""}
                                {u.branchLabel ? ` · ${u.branchLabel}` : ""}
                              </p>
                            </div>
                            {isSelected && (
                              <Check className="h-4 w-4 text-violet-600 flex-shrink-0" />
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                  {editBranchForm.existingUserIds.length > 0 && (
                    <div className="text-xs text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 p-2 rounded-md">
                      <p className="font-medium mb-1">Usuarios seleccionados ({editBranchForm.existingUserIds.length}):</p>
                      <ul className="list-disc pl-4 space-y-0.5">
                        {editBranchForm.existingUserIds.map(uid => {
                          const u = groupUsers.find(cu => cu.id === uid);
                          return <li key={uid}>{u?.salespersonName || u?.email || "Desconocido"}</li>;
                        })}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* New user credentials - Optional since we might just be editing commercial info */
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">Nuevo Usuario (Opcional)</Label>
                    <Input
                      placeholder="Ej: sucursal-stgo"
                      value={editBranchForm.username}
                      onChange={(e) => setEditBranchForm(p => ({ ...p, username: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">Contraseña</Label>
                    <Input
                      type="password"
                      placeholder="Mínimo 6 caracteres"
                      value={editBranchForm.password}
                      disabled={!editBranchForm.username}
                      onChange={(e) => setEditBranchForm(p => ({ ...p, password: e.target.value }))}
                    />
                  </div>
                </div>

                {editBranchForm.username && (
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">Email (opcional)</Label>
                    <Input
                      type="email"
                      placeholder="sucursal@empresa.cl"
                      value={editBranchForm.email}
                      onChange={(e) => setEditBranchForm(p => ({ ...p, email: e.target.value }))}
                    />
                  </div>
                )}
              </>
            )}

            <hr className="my-2" />

            {/* Commercial info */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Vendedor Asignado</Label>
                <Select
                  value={editBranchForm.salesRepCode || "unassigned"}
                  onValueChange={(val) => setEditBranchForm(p => ({ ...p, salesRepCode: val === "unassigned" ? "" : val }))}
                >
                  <SelectTrigger className="h-8 text-sm truncate"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned" className="text-muted-foreground italic">Heredar del padre</SelectItem>
                    {erpVendedores.map((v: any) => (
                      <SelectItem key={v.code} value={v.code}>
                        {v.name} ({v.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Condición de Pago</Label>
                <Select
                  value={editBranchForm.paymentCondition}
                  onValueChange={(val) => setEditBranchForm(p => ({ ...p, paymentCondition: val }))}
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
                  value={editBranchForm.creditLimit}
                  onChange={(e) => setEditBranchForm(p => ({ ...p, creditLimit: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Bodega de Retiro</Label>
                <Select
                  value={editBranchForm.pickupWarehouseId}
                  onValueChange={(val) => setEditBranchForm(p => ({ ...p, pickupWarehouseId: val }))}
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
                value={editBranchForm.lcen || "__none__"}
                onValueChange={(val) => setEditBranchForm(p => ({ ...p, lcen: val === "__none__" ? "" : val }))}
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
            <Button variant="outline" onClick={() => setShowEditBranchDialog(false)}>Cancelar</Button>
            <Button
              className="bg-violet-600 hover:bg-violet-700"
              disabled={
                !editBranchForm.branchLabel ||
                (!useExistingUser && editBranchForm.username && (!editBranchForm.password || editBranchForm.password.length < 6)) ||
                editBranchMutation.isPending
              }
              onClick={() => {
                const payload: any = {
                  branchLabel: editBranchForm.branchLabel,
                  salesRepCode: editBranchForm.salesRepCode || null,
                  pickupWarehouseId: editBranchForm.pickupWarehouseId === "none" ? null : editBranchForm.pickupWarehouseId,
                  creditLimit: editBranchForm.creditLimit ? parseFloat(editBranchForm.creditLimit) : null,
                  paymentCondition: editBranchForm.paymentCondition || null,
                  lcen: editBranchForm.lcen || null,
                  address: editBranchForm.address || null,
                  discountPercent: editBranchForm.discountPercent ? parseFloat(editBranchForm.discountPercent) : 0,
                };
                // Always send user associations to maintain them
                if (editBranchForm.existingUserIds.length > 0) {
                  payload.existingUserIds = editBranchForm.existingUserIds;
                }
                // Also create a new user if credentials provided
                if (!useExistingUser && editBranchForm.username && editBranchForm.password) {
                  payload.username = editBranchForm.username;
                  payload.email = editBranchForm.email || null;
                  payload.password = editBranchForm.password;
                }
                editBranchMutation.mutate(payload);
              }}
            >
              {editBranchMutation.isPending ? "Guardando..." : "Guardar Cambios"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Dialog Crear Usuario ───────────────────── */}
      <Dialog open={showUserDialog} onOpenChange={setShowUserDialog}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-blue-600" />
              {editingUserId ? "Editar Usuario" : "Crear Nuevo Usuario"}
            </DialogTitle>
            <DialogDescription>
              {editingUserId ? "Modifica los datos del usuario." : <>Crea un usuario para <span className="font-semibold">{client.clientName}</span> que podrá acceder al portal eCommerce.</>}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Nombre Completo *</Label>
              <Input
                placeholder="Ej: Juan Pérez"
                value={userForm.salespersonName}
                onChange={(e) => {
                  const name = e.target.value;
                  setUserForm(p => {
                    // Auto-generate username from name
                    const parts = name.trim().toLowerCase().split(' ');
                    const autoUsername = parts.length < 2
                      ? parts[0]?.substring(0, 6) || ''
                      : parts[0].charAt(0) + parts[1];
                    return { ...p, salespersonName: name, username: autoUsername };
                  });
                }}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Usuario *</Label>
                <Input
                  placeholder="Ej: jperez"
                  value={userForm.username}
                  onChange={(e) => setUserForm(p => ({ ...p, username: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Contraseña {editingUserId ? "(Opcional)" : "*"}</Label>
                <Input
                  type="password"
                  placeholder={editingUserId ? "Dejar en blanco para mantener actual" : "Mínimo 6 caracteres"}
                  value={userForm.password}
                  onChange={(e) => setUserForm(p => ({ ...p, password: e.target.value }))}
                />
              </div>
            </div>

            {editingUserId && (
              <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">Estado del Usuario</Label>
                  <p className="text-xs text-muted-foreground">Si desactivas el usuario no podrá acceder al portal.</p>
                </div>
                <Switch
                  checked={userIsActive}
                  onCheckedChange={setUserIsActive}
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Email (opcional)</Label>
                <Input
                  type="email"
                  placeholder="usuario@empresa.cl"
                  value={userForm.email}
                  onChange={(e) => setUserForm(p => ({ ...p, email: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Teléfono (opcional)</Label>
                <Input
                  placeholder="+56 9 1234 5678"
                  value={userForm.phone}
                  onChange={(e) => setUserForm(p => ({ ...p, phone: e.target.value }))}
                />
              </div>
            </div>

            {!editingUserId && (
              <div className="p-3 rounded-lg bg-blue-50/70 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-800">
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  <strong>Nota:</strong> El usuario será creado con acceso al portal de compras eCommerce vinculado a <strong>{client.clientName}</strong>. Luego podrás asignarlo a una sucursal específica.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUserDialog(false)}>Cancelar</Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700"
              disabled={
                !userForm.salespersonName ||
                !userForm.username ||
                (!editingUserId && (!userForm.password || userForm.password.length < 6)) ||
                (editingUserId && userForm.password && userForm.password.length > 0 && userForm.password.length < 6) ||
                createUserMutation.isPending ||
                editUserMutation.isPending
              }
              onClick={() => {
                const payload: any = {
                  salespersonName: userForm.salespersonName,
                  username: userForm.username,
                  email: userForm.email || null,
                  phone: userForm.phone || null,
                };
                if (userForm.password) {
                  payload.password = userForm.password;
                }
                
                if (editingUserId) {
                  payload.isActive = userIsActive;
                  editUserMutation.mutate(payload);
                } else {
                  createUserMutation.mutate(payload);
                }
              }}
            >
              {createUserMutation.isPending || editUserMutation.isPending ? "Guardando..." : (editingUserId ? "Guardar Cambios" : "Crear Usuario")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Enviar sugerido */}
      {canSendSuggested && suggestedTarget && (
        <SuggestedOrderModal
          open={!!suggestedTarget}
          client={suggestedTarget}
          onClose={() => setSuggestedTarget(null)}
        />
      )}
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
  const [suggestedTarget, setSuggestedTarget] = useState<SuggestedOrderTargetClient | null>(null);
  const { user } = useAuth();
  const canSendSuggested = user?.role === "admin" || (user?.role === "supervisor" || user?.role === "encargado_area");
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
    try {
      return new Date(date).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });
    } catch {
      return "—";
    }
  };

  const associatedClients = filteredClients.filter((c) => c.clientId);
  const nonAssociatedClients = filteredClients.filter((c) => !c.clientId);

  // ─── If a client is selected, show the profile detail panel ───
  if (selectedClient) {
    return (
      <ClientProfile
        client={selectedClient}
        onBack={() => setSelectedClient(null)}
        onClientUpdated={(updated) => setSelectedClient(updated)}
      />
    );
  }

  // ─── Render user table rows ───
  const renderUsersTable = (list: ClientUser[], emptyMessage: string) => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent" />
            <p className="text-sm text-gray-400">Cargando usuarios...</p>
          </div>
        </div>
      );
    }
    if (list.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-20 px-6">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
            <Users className="h-8 w-8 text-gray-300" />
          </div>
          <h3 className="text-base font-semibold text-gray-500">
            {searchTerm ? "Sin resultados" : emptyMessage}
          </h3>
          <p className="text-sm text-gray-400 mt-1.5 max-w-sm text-center">
            {searchTerm ? "Intenta con otro término de búsqueda." : "Crea un nuevo usuario para comenzar."}
          </p>
        </div>
      );
    }
    return (
      <div className="overflow-hidden">
        {/* Table Header */}
        <div className="hidden lg:grid lg:grid-cols-12 gap-4 px-5 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100 bg-gray-50/50">
          <div className="col-span-4">Cliente</div>
          <div className="col-span-2">Identificación</div>
          <div className="col-span-2">Contacto</div>
          <div className="col-span-2">Estado</div>
          <div className="col-span-2 text-right">Registro</div>
        </div>

        {/* Table Rows */}
        <div className="divide-y divide-gray-50">
          {list.map((client, idx) => (
            <div
              key={client.id}
              onClick={() => setSelectedClient(client)}
              className={`group grid grid-cols-1 lg:grid-cols-12 gap-3 lg:gap-4 px-5 py-4 cursor-pointer transition-all duration-150 hover:bg-blue-50/40 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}
            >
              {/* Client Name + Avatar */}
              <div className="col-span-4 flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 shadow-sm group-hover:shadow-md group-hover:scale-105 transition-all">
                  {(client.clientName || client.email)?.[0]?.toUpperCase() || "?"}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate group-hover:text-blue-700 transition-colors">
                    {client.clientName}
                  </p>
                  {client.email && (
                    <p className="text-xs text-gray-400 truncate mt-0.5">{client.email}</p>
                  )}
                </div>
              </div>

              {/* Identification */}
              <div className="col-span-2 flex flex-col justify-center gap-1">
                {client.clientCode && (
                  <span className="text-xs text-gray-600 font-mono bg-gray-100 rounded px-1.5 py-0.5 w-fit">{client.clientCode}</span>
                )}
                {client.rut && (
                  <span className="text-xs text-gray-500">{client.rut}</span>
                )}
                {!client.clientCode && !client.rut && (
                  <span className="text-xs text-gray-300 italic">Sin datos</span>
                )}
              </div>

              {/* Contact */}
              <div className="col-span-2 flex flex-col justify-center gap-1">
                {client.phone && (
                  <span className="text-xs text-gray-500 flex items-center gap-1">
                    <Phone className="h-3 w-3 text-gray-400" /> {client.phone}
                  </span>
                )}
                {client.branchLabel && (
                  <span className="text-xs text-violet-600 flex items-center gap-1 font-medium">
                    <GitBranch className="h-3 w-3" /> {client.branchLabel}
                  </span>
                )}
                {!client.phone && !client.branchLabel && (
                  <span className="text-xs text-gray-300">—</span>
                )}
              </div>

              {/* Status */}
              <div className="col-span-2 flex items-center">
                {client.clientId ? (
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Vinculado SAP
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-100">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    Sin ficha
                  </span>
                )}
              </div>

              {/* Date + Action */}
              <div className="col-span-2 flex items-center justify-end gap-3">
                <span className="text-xs text-gray-400 hidden lg:block">{formatDate(client.createdAt)}</span>
                <div className="flex items-center gap-1 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                  {canSendSuggested && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSuggestedTarget({ clientName: client.clientName, clientCode: client.clientCode });
                      }}
                      className="h-7 px-2.5 text-xs text-orange-600 hover:text-orange-700 hover:bg-orange-50 rounded-lg"
                      data-testid={`button-send-suggested-${client.id}`}
                    >
                      <Send className="h-3.5 w-3.5 mr-1" />
                      Sugerido
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2.5 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-100 rounded-lg"
                  >
                    <Eye className="h-3.5 w-3.5 mr-1" />
                    Ver
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/30 flex items-center justify-between">
          <p className="text-xs text-gray-400">
            {list.length} usuario{list.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-sm">
              <ShoppingBag className="h-5 w-5 text-white" />
            </div>
            Usuarios eCommerce
          </h1>
          <p className="text-sm text-gray-500 mt-1.5 ml-[46px]">
            Gestión de clientes con acceso al portal de compras
          </p>
        </div>
        <Button
          onClick={() => setIsCreateClientDialogOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 shadow-sm hover:shadow-md transition-all h-9 px-4 text-sm font-medium"
        >
          <UserPlus className="w-4 h-4 mr-2" />
          Nuevo Usuario
        </Button>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="flex items-center gap-3 bg-white border border-gray-100 rounded-xl px-4 py-3 shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
            <Users className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 leading-none">{clients.length}</p>
            <p className="text-[11px] text-gray-400 font-medium mt-0.5">Total</p>
          </div>
        </div>
        <div className="flex items-center gap-3 bg-white border border-gray-100 rounded-xl px-4 py-3 shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
            <Building2 className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 leading-none">{associatedClients.length}</p>
            <p className="text-[11px] text-gray-400 font-medium mt-0.5">Vinculados SAP</p>
          </div>
        </div>
        <div className="flex items-center gap-3 bg-white border border-gray-100 rounded-xl px-4 py-3 shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
            <KeyRound className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 leading-none">{nonAssociatedClients.length}</p>
            <p className="text-[11px] text-gray-400 font-medium mt-0.5">Sin ficha</p>
          </div>
        </div>
        <div className="flex items-center gap-3 bg-white border border-gray-100 rounded-xl px-4 py-3 shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center">
            <FileText className="h-5 w-5 text-rose-500" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 leading-none">{pendingRequests.length}</p>
            <p className="text-[11px] text-gray-400 font-medium mt-0.5">Solicitudes</p>
          </div>
        </div>
      </div>

      {/* Search + Tabs Container */}
      <div className="bg-white border border-gray-200/80 rounded-2xl shadow-sm overflow-hidden">
        {/* Search & Tabs Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 pt-5 pb-4">
          <Tabs defaultValue="asociados" className="w-full" onValueChange={() => {}}>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full">
              <TabsList className="h-9 bg-gray-100/80 rounded-lg p-0.5 gap-0.5">
                <TabsTrigger value="asociados" className="h-8 text-xs px-3 rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-blue-700 font-medium">
                  Vinculados
                  <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0 h-4 bg-blue-100 text-blue-700 border-none">{associatedClients.length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="no-asociados" className="h-8 text-xs px-3 rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-amber-700 font-medium">
                  Sin ficha
                  {nonAssociatedClients.length > 0 && <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0 h-4 bg-amber-100 text-amber-700 border-none">{nonAssociatedClients.length}</Badge>}
                </TabsTrigger>
                <TabsTrigger value="requests" className="h-8 text-xs px-3 rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm font-medium relative">
                  Solicitudes
                  {pendingRequests.length > 0 && (
                    <Badge variant="destructive" className="ml-1.5 text-[10px] px-1.5 py-0 h-4 min-w-4 flex items-center justify-center border-none">
                      {pendingRequests.length}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              <div className="relative sm:ml-auto sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                <Input
                  placeholder="Buscar usuario..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 h-9 text-sm rounded-lg border-gray-200 bg-gray-50/50 focus-visible:bg-white focus-visible:ring-blue-500"
                />
              </div>
            </div>

            <TabsContent value="asociados" className="mt-0 pt-0 -mx-5">
              {renderUsersTable(associatedClients, "No hay clientes vinculados a SAP.")}
            </TabsContent>

            <TabsContent value="no-asociados" className="mt-0 pt-0 -mx-5">
              {renderUsersTable(nonAssociatedClients, "No hay clientes sin ficha SAP.")}
            </TabsContent>

            <TabsContent value="requests" className="mt-4 space-y-4">
              {loadingRequests ? (
                <div className="flex items-center justify-center py-16">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent" />
                </div>
              ) : rawRequests.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
                    <FileText className="h-8 w-8 text-gray-300" />
                  </div>
                  <h3 className="text-base font-semibold text-gray-500">No hay solicitudes</h3>
                  <p className="text-sm text-gray-400 mt-1.5 max-w-sm text-center">
                    Cuando los clientes se registren en la tienda virtual, aparecerán aquí.
                  </p>
                </div>
              ) : (
                <div className="space-y-5">
                  {/* Pending Section */}
                  {pendingRequests.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-xs font-semibold flex items-center gap-2 text-gray-500 uppercase tracking-wider">
                        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                        Pendientes ({pendingRequests.length})
                      </h3>
                      {pendingRequests.map((req: any) => (
                        <div key={req.id} className="border border-amber-100 rounded-xl p-4 bg-amber-50/30 hover:bg-amber-50/60 transition-colors">
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white font-bold text-sm shadow-sm flex-shrink-0">
                                {req.empresa?.[0]?.toUpperCase() || "?"}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-bold text-gray-900 truncate">{req.empresa}</p>
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-gray-500">
                                  <span>RUT: {req.rut}</span>
                                  {req.contacto && <span>• {req.contacto}</span>}
                                  {req.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {req.email}</span>}
                                  {req.telefono && <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {req.telefono}</span>}
                                  {req.ciudad && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {req.ciudad}</span>}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-xs text-gray-400">{formatDate(req.createdAt)}</span>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 text-xs bg-white hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300"
                                onClick={() => {
                                  if (confirm(`¿Marcar la solicitud de ${req.empresa} como revisada?`)) {
                                    updateRequestStatus.mutate({ id: req.id, status: 'aprobado' });
                                  }
                                }}
                              >
                                <Check className="h-3.5 w-3.5 mr-1" />
                                Revisada
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Processed Section */}
                  {processedRequests.length > 0 && (
                    <div className="space-y-3 pt-4 border-t border-gray-100">
                      <h3 className="text-xs font-semibold flex items-center gap-2 text-gray-400 uppercase tracking-wider">
                        <span className="w-2 h-2 rounded-full bg-gray-300" />
                        Procesadas
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {processedRequests.map((req: any) => (
                          <div key={req.id} className="border border-gray-100 rounded-lg p-3 bg-gray-50/50">
                            <div className="flex justify-between items-start">
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-gray-600 truncate">{req.empresa}</p>
                                <p className="text-xs text-gray-400 mt-0.5">{req.contacto} • {req.email}</p>
                              </div>
                              <Badge variant="outline" className="text-[10px] text-gray-400 font-medium shrink-0 ml-2">
                                Revisada
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>

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

      {/* Modal: Enviar sugerido */}
      {canSendSuggested && suggestedTarget && (
        <SuggestedOrderModal
          open={!!suggestedTarget}
          client={suggestedTarget}
          onClose={() => setSuggestedTarget(null)}
        />
      )}
    </div>
  );
}
