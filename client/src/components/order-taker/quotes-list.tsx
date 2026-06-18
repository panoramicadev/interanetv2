import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  MoreVertical,
  Search,
  Filter,
  FileText,
  Calendar,
  User,
  DollarSign,
  Clock,
  CheckCircle,
  XCircle,
  Send,
  Package,
  Copy,
  Trash2,
  Mail,
  Download,
  Edit3,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { useIsMobile } from "@/hooks/use-mobile";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Paperclip, Loader2, X as XIcon } from "lucide-react";

interface Quote {
  id: string;
  quoteNumber: string;
  clientName: string;
  clientRut?: string;
  clientEmail?: string;
  clientPhone?: string;
  clientAddress?: string;
  createdBy: string;
  creatorName?: string;
  creatorEmail?: string;
  creatorFirstName?: string;
  creatorLastName?: string;
  status: "draft" | "sent" | "accepted" | "rejected" | "converted";
  validUntil?: string;
  notes?: string;
  total: string;
  taxAmount?: string;
  discount?: string;
  createdAt: string;
  updatedAt?: string;
}

const statusConfig = {
  draft: {
    label: "Borrador",
    color: "bg-slate-50 text-slate-600 ring-1 ring-slate-200",
    dot: "bg-slate-400",
    icon: FileText,
  },
  sent: {
    label: "Enviada",
    color: "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
    dot: "bg-blue-500",
    icon: Send,
  },
  accepted: {
    label: "Aceptada",
    color: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
    dot: "bg-emerald-500",
    icon: CheckCircle,
  },
  rejected: {
    label: "Rechazada",
    color: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
    dot: "bg-rose-500",
    icon: XCircle,
  },
  converted: {
    label: "Convertida a Pedido",
    color: "bg-violet-50 text-violet-700 ring-1 ring-violet-200",
    dot: "bg-violet-500",
    icon: Package,
  },
};

// Avatar de iniciales con color estable por emisor (deriva el color del seed).
const AVATAR_COLORS = [
  "bg-blue-500", "bg-emerald-500", "bg-orange-500", "bg-violet-500",
  "bg-rose-500", "bg-amber-500", "bg-cyan-500", "bg-indigo-500",
];
function initialsOf(name?: string): string {
  if (!name) return "?";
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p[1]?.[0] ?? "")).toUpperCase() || "?";
}
function avatarColor(seed?: string): string {
  const s = seed || "";
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

interface QuotesListProps {
  onEditQuote?: (quoteId: string) => void;
  onCountChange?: (count: number) => void;
}

export default function QuotesList({ onEditQuote, onCountChange }: QuotesListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [creatorFilter, setCreatorFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [displayLimit, setDisplayLimit] = useState(20);
  const { toast } = useToast();
  const { user } = useAuth();
  const [, navigate] = useLocation();

  // Build query parameters
  const buildQueryParams = () => {
    const params = new URLSearchParams();
    params.set('limit', '500'); // Get more records for client-side filtering
    params.set('offset', '0');

    if (statusFilter !== "all") {
      params.set('status', statusFilter);
    }

    if (searchTerm.trim()) {
      params.set('clientName', searchTerm.trim());
    }

    if (creatorFilter !== "all") {
      params.set('createdBy', creatorFilter);
    }

    if (dateFrom) {
      params.set('dateFrom', dateFrom);
    }

    if (dateTo) {
      params.set('dateTo', dateTo);
    }

    return params.toString();
  };

  const { data: quotes, isLoading, error } = useQuery<Quote[]>({
    queryKey: [`/api/quotes?${buildQueryParams()}`],
  });

  // Get unique creators for filter dropdown
  const { data: creators } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ['/api/quotes/creators'],
  });

  // Reset display limit when filters change
  const handleFilterChange = () => {
    setDisplayLimit(20);
  };

  // Paginated quotes
  const displayedQuotes = quotes?.slice(0, displayLimit) || [];

  // Reporta el total al contenedor para mostrar el pill de conteo en el título.
  useEffect(() => {
    onCountChange?.(quotes?.length ?? 0);
  }, [quotes?.length, onCountChange]);
  const hasMore = quotes && quotes.length > displayLimit;

  // Mutation to duplicate quote for editing
  const duplicateQuoteMutation = useMutation({
    mutationFn: async (quoteId: string) => {
      return await apiRequest(`/api/quotes/${quoteId}/duplicate`, {
        method: 'POST',
      });
    },
    onSuccess: (newQuote: any) => {
      toast({
        title: "Cotización duplicada",
        description: `Nueva cotización #${newQuote?.quoteNumber || 'N/A'} creada para editar. Abriendo editor...`,
      });
      // Invalidate all quote queries (fixes cache invalidation bug)
      queryClient.invalidateQueries({
        predicate: (query) =>
          typeof query.queryKey[0] === 'string' &&
          (query.queryKey[0] as string).startsWith('/api/quotes')
      });

      // Navigate immediately to tomador de pedidos with the new quote ID
      if (newQuote?.id) {
        navigate(`/tomador-pedidos?quoteId=${newQuote.id}`);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error al duplicar",
        description: error.message || "No se pudo duplicar la cotización",
        variant: "destructive",
      });
    },
  });

  const handleDuplicateForEdit = (quoteId: string) => {
    duplicateQuoteMutation.mutate(quoteId);
  };

  // Mutation to delete quote
  const deleteQuoteMutation = useMutation({
    mutationFn: async (quoteId: string) => {
      return await apiRequest(`/api/quotes/${quoteId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      toast({
        title: "Cotización eliminada",
        description: "La cotización ha sido eliminada exitosamente.",
      });
      // Invalidate all quote queries
      queryClient.invalidateQueries({
        predicate: (query) =>
          typeof query.queryKey[0] === 'string' &&
          (query.queryKey[0] as string).startsWith('/api/quotes')
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error al eliminar",
        description: error.message || "No se pudo eliminar la cotización",
        variant: "destructive",
      });
    },
  });

  const handleDeleteQuote = (quoteId: string, quoteNumber: string) => {
    // Simple confirmation using window.confirm
    if (window.confirm(`¿Estás seguro de que deseas eliminar la cotización ${quoteNumber}? Esta acción no se puede deshacer.`)) {
      deleteQuoteMutation.mutate(quoteId);
    }
  };

  // Mutation to update quote status
  const updateStatusMutation = useMutation({
    mutationFn: async ({ quoteId, status }: { quoteId: string; status: Quote['status'] }) => {
      return await apiRequest(`/api/quotes/${quoteId}/status`, {
        method: 'PATCH',
        data: { status }
      });
    },
    onSuccess: (updatedQuote: any) => {
      toast({
        title: "Estado actualizado",
        description: `Cotización ${updatedQuote?.quoteNumber || 'N/A'} actualizada exitosamente.`,
      });
      // Invalidate all quote queries
      queryClient.invalidateQueries({
        predicate: (query) =>
          typeof query.queryKey[0] === 'string' &&
          (query.queryKey[0] as string).startsWith('/api/quotes')
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error al actualizar estado",
        description: error.message || "No se pudo actualizar el estado",
        variant: "destructive",
      });
    },
  });

  const handleStatusChange = (quoteId: string, newStatus: Quote['status'], quoteNumber: string) => {
    const statusLabels: Record<Quote['status'], string> = {
      draft: 'borrador',
      sent: 'enviada',
      accepted: 'aprobada',
      rejected: 'cancelada',
      converted: 'convertida a pedido'
    };

    if (window.confirm(`¿Estás seguro de que deseas cambiar el estado de la cotización ${quoteNumber} a "${statusLabels[newStatus]}"?`)) {
      updateStatusMutation.mutate({ quoteId, status: newStatus });
    }
  };

  // Contactos internos predefinidos para selección rápida en el envío de cotizaciones
  const presetEmailContacts = [
    { name: "Jefferson", email: "jperdomo@pinturaspanoramica.cl" },
    { name: "Carolina", email: "yfernandez@pinturaspanoramica.cl" },
    { name: "Franco", email: "fparra@pinturaspanoramica.cl" },
    { name: "Oscar", email: "storeconcepcion@pinturaspanoramica.cl" },
    { name: "Carlos", email: "cmelgarejo@pinturaspanoramica.cl" },
    { name: "Joaquin", email: "jsaiz@pinturaspanoramica.cl" },
  ];

  // Email dialog state
  const [emailDialog, setEmailDialog] = useState<{ quoteId: string; quoteNumber: string; clientName: string } | null>(null);
  const [emailRecipient, setEmailRecipient] = useState("fparra@pinturaspanoramica.cl");
  const [emailCc, setEmailCc] = useState("");
  const [emailOcNumber, setEmailOcNumber] = useState("");
  const [emailSegment, setEmailSegment] = useState<string>("");
  const [emailPaymentMethod, setEmailPaymentMethod] = useState<string>("");
  const [emailScope, setEmailScope] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  const [emailSalespersonId, setEmailSalespersonId] = useState<string>("");
  const [emailAttachments, setEmailAttachments] = useState<Array<{ name: string; mime: string; base64: string }>>([]);
  const [attachmentLoading, setAttachmentLoading] = useState(false);
  // Email del supervisor que se agregó automáticamente al CC, para poder reemplazarlo si cambia el vendedor
  const [autoSupervisorEmail, setAutoSupervisorEmail] = useState<string>("");

  const isAdminOrSupervisor = user?.role === 'admin' || (user?.role === 'supervisor' || user?.role === 'encargado_area');
  const { data: salespeople = [] } = useQuery<Array<{ id: string; salespersonName?: string; email?: string; role?: string; supervisorId?: string | null }>>({
    queryKey: ["/api/users/salespeople"],
    enabled: !!emailDialog,
  });

  // Supervisores y encargados de área (selección rápida en "Para" y "CC").
  const supervisorContacts = salespeople
    .filter((u) => (u.role === "supervisor" || u.role === "encargado_area") && !!u.email)
    .map((u) => ({ name: u.salespersonName || u.email!, email: u.email! }));
  // Mezclamos predefinidos + supervisores (API) deduplicando por email: si hay
  // supervisores cargados, los contactos predefinidos NO deben desaparecer.
  const quickContacts = (() => {
    const seen = new Set<string>();
    const merged: Array<{ name: string; email: string }> = [];
    for (const c of [...presetEmailContacts, ...supervisorContacts]) {
      const key = c.email.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(c);
    }
    return merged;
  })();

  const resetEmailForm = () => {
    setEmailRecipient("fparra@pinturaspanoramica.cl");
    setEmailCc("");
    setEmailOcNumber("");
    setEmailSegment("");
    setEmailPaymentMethod("");
    setEmailScope("");
    setEmailMessage("");
    setEmailSalespersonId("");
    setEmailAttachments([]);
    setAutoSupervisorEmail("");
  };

  // Al elegir un vendedor asignado, se agrega automáticamente su supervisor al CC
  // (reemplazando al supervisor agregado por una selección previa).
  const handleSalespersonChange = (spId: string) => {
    setEmailSalespersonId(spId);
    const sp = salespeople.find((u) => u.id === spId);
    const supervisor = sp?.supervisorId ? salespeople.find((u) => u.id === sp.supervisorId) : undefined;
    const newSupervisorEmail = supervisor?.email || "";
    setEmailCc((prev) => {
      let items = prev.split(",").map((s) => s.trim()).filter(Boolean);
      if (autoSupervisorEmail) {
        items = items.filter((it) => it.toLowerCase() !== autoSupervisorEmail.toLowerCase());
      }
      if (newSupervisorEmail && !items.some((it) => it.toLowerCase() === newSupervisorEmail.toLowerCase())) {
        items.push(newSupervisorEmail);
      }
      return items.join(", ");
    });
    setAutoSupervisorEmail(newSupervisorEmail);
  };

  const handleAttachmentChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const MAX_FILE = 10 * 1024 * 1024;
    const MAX_TOTAL = 20 * 1024 * 1024;
    const oversized = files.find((f) => f.size > MAX_FILE);
    if (oversized) {
      toast({ title: "Archivo muy grande", description: `"${oversized.name}" supera los 10 MB.`, variant: "destructive" });
      e.target.value = "";
      return;
    }
    const currentTotal = emailAttachments.reduce((sum, a) => sum + Math.ceil((a.base64.length * 3) / 4), 0);
    const incomingTotal = files.reduce((sum, f) => sum + f.size, 0);
    if (currentTotal + incomingTotal > MAX_TOTAL) {
      toast({ title: "Adjuntos muy pesados", description: "El total de adjuntos no puede superar los 20 MB.", variant: "destructive" });
      e.target.value = "";
      return;
    }
    setAttachmentLoading(true);
    try {
      const read = await Promise.all(
        files.map(
          (file) =>
            new Promise<{ name: string; mime: string; base64: string }>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => {
                const result = reader.result as string;
                resolve({ name: file.name, mime: file.type || "application/octet-stream", base64: result.split(",")[1] || "" });
              };
              reader.onerror = reject;
              reader.readAsDataURL(file);
            }),
        ),
      );
      setEmailAttachments((prev) => [...prev, ...read]);
    } catch {
      toast({ title: "Error", description: "No se pudo leer el archivo.", variant: "destructive" });
    } finally {
      setAttachmentLoading(false);
      e.target.value = "";
    }
  };

  // Mutation to send email with PDF
  const sendEmailMutation = useMutation({
    mutationFn: async (params: { quoteId: string }) => {
      const pdfBase64 = await fetchQuotePdfAsBase64(params.quoteId);

      return await apiRequest(`/api/quotes/${params.quoteId}/send-email`, {
        method: 'POST',
        data: {
          pdfBase64,
          recipientEmail: emailRecipient.trim() || 'fparra@pinturaspanoramica.cl',
          ccEmails: emailCc.trim() || undefined,
          ocNumber: emailOcNumber.trim() || undefined,
          segment: emailSegment || undefined,
          paymentMethod: emailPaymentMethod || undefined,
          scope: emailScope.trim() || undefined,
          additionalMessage: emailMessage.trim() || undefined,
          salespersonId: emailSalespersonId || undefined,
          attachments: emailAttachments.map((a) => ({ base64: a.base64, name: a.name, mime: a.mime })),
        },
      });
    },
    onSuccess: async (res) => {
      const data = await res.json().catch(() => ({}));
      toast({
        title: "✉️ Correo enviado",
        description: `Para: ${data.sentTo}${data.cc ? ` · CC: ${data.cc}` : ""}`,
      });
      // Invalidate quotes list so status changes from "Borrador" → "Enviada"
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      setEmailDialog(null);
      resetEmailForm();
    },
    onError: (error: any) => {
      toast({
        title: "Error al enviar correo",
        description: error.message || "No se pudo enviar el correo.",
        variant: "destructive",
      });
    },
  });

  const handleSendEmail = (quoteId: string, quoteNumber: string, clientName: string, createdBy?: string) => {
    resetEmailForm();
    setEmailSalespersonId(createdBy || user?.id || "");
    setEmailDialog({ quoteId, quoteNumber, clientName });
  };

  // Download PDF directly without entering the editor
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const handleDownloadPDF = async (quoteId: string, quoteNumber: string) => {
    setDownloadingId(quoteId);
    try {
      const res = await fetch(`/api/quotes/${quoteId}/pdf?format=pdf`, {
        credentials: 'include',
      });
      if (!res.ok) {
        const text = await res.text().catch(() => res.statusText);
        throw new Error(`${res.status}: ${text}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Cotizacion_${quoteNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "PDF descargado", description: `Cotizacion_${quoteNumber}.pdf` });
    } catch (err: any) {
      toast({
        title: "Error al descargar PDF",
        description: err?.message || "No se pudo generar el PDF.",
        variant: "destructive",
      });
    } finally {
      setDownloadingId(null);
    }
  };

  // Fetch the server-rendered PDF (same template as creation) and return base64 for email.
  const fetchQuotePdfAsBase64 = async (quoteId: string): Promise<string> => {
    const res = await fetch(`/api/quotes/${quoteId}/pdf?format=pdf`, {
      credentials: 'include',
    });
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(`${res.status}: ${text}`);
    }
    const blob = await res.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  // Function to open quote in edit mode
  const handleEditQuote = (quoteId: string) => {
    if (onEditQuote) {
      onEditQuote(quoteId);
    } else {
      // Fallback to navigation if no prop is provided
      navigate(`/tomador-pedidos?quoteId=${quoteId}`);
    }
  };

  const formatCurrency = (amount: string | number) => {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
    }).format(numAmount);
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return format(date, "d 'de' MMMM, yyyy", { locale: es });
    } catch {
      return 'Fecha inválida';
    }
  };

  const getTimeAgo = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffInMs = now.getTime() - date.getTime();

      const minutes = Math.floor(diffInMs / (1000 * 60));
      const hours = Math.floor(diffInMs / (1000 * 60 * 60));
      const days = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

      if (days > 0) {
        return `hace ${days} día${days > 1 ? 's' : ''}`;
      } else if (hours > 0) {
        return `hace ${hours} hora${hours > 1 ? 's' : ''}`;
      } else if (minutes > 0) {
        return `hace ${minutes} min`;
      } else {
        return 'hace unos segundos';
      }
    } catch {
      return 'fecha inválida';
    }
  };

  const getStatusBadge = (status: Quote['status']) => {
    const config = statusConfig[status];

    return (
      <span className={`${config.color} inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap`}>
        <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
        {config.label}
      </span>
    );
  };

  const getTotalQuotes = () => quotes?.length || 0;
  const getQuotesByStatus = (status: Quote['status']) =>
    quotes?.filter(q => q.status === status).length || 0;

  if (error) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <XCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Error al cargar cotizaciones</h3>
          <p className="text-gray-500">No se pudieron cargar las cotizaciones. Inténtalo de nuevo.</p>
        </div>
      </div>
    );
  }

  const isMobile = useIsMobile();

  return (
    <div className="space-y-4">
      {/* Filters - Mobile Compact */}
      <div className={isMobile ? 'space-y-3' : 'bg-white rounded-2xl border border-slate-200/70 shadow-sm p-4 space-y-4'}>
      <div className={`${isMobile ? 'space-y-3' : 'flex flex-col sm:flex-row gap-3'}`}>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Buscar por nombre de cliente..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); handleFilterChange(); }}
            className={`pl-10 ${isMobile ? 'h-11 rounded-xl text-sm' : 'h-11 rounded-xl border-slate-200 focus-visible:ring-orange-300 focus-visible:border-orange-300'}`}
            style={isMobile ? { fontSize: '16px' } : undefined}
            data-testid="input-search-quotes"
          />
        </div>

        <div className={`${isMobile ? 'grid grid-cols-2 gap-2' : 'flex gap-3'}`}>
          <Select value={statusFilter} onValueChange={(value) => { setStatusFilter(value); handleFilterChange(); }}>
            <SelectTrigger className={`${isMobile ? 'h-10 rounded-xl text-xs' : 'w-full sm:w-[190px] h-11 rounded-xl border-slate-200'}`} data-testid="select-status-filter">
              <Filter className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="draft">Borradores</SelectItem>
              <SelectItem value="sent">Enviadas</SelectItem>
              <SelectItem value="accepted">Aceptadas</SelectItem>
              <SelectItem value="rejected">Rechazadas</SelectItem>
              <SelectItem value="converted">Convertidas</SelectItem>
            </SelectContent>
          </Select>

          {/* Creator Filter - Only for admin/supervisor */}
          {(user?.role === 'admin' || (user?.role === 'supervisor' || user?.role === 'encargado_area')) && creators && creators.length > 0 && (
            <Select value={creatorFilter} onValueChange={(value) => { setCreatorFilter(value); handleFilterChange(); }}>
              <SelectTrigger className={`${isMobile ? 'h-10 rounded-xl text-xs' : 'w-full sm:w-[190px] h-11 rounded-xl border-slate-200'}`} data-testid="select-creator-filter">
                <User className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                <SelectValue placeholder="Emisor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los emisores</SelectItem>
                {creators.map((creator) => (
                  <SelectItem key={creator.id} value={creator.id}>
                    {creator.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Date Filters - Compact Row */}
      {!isMobile && (
        <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); handleFilterChange(); }}
              className="w-[150px] h-11 rounded-xl border-slate-200"
              placeholder="Desde"
              data-testid="input-date-from"
            />
            <span className="text-gray-400">-</span>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); handleFilterChange(); }}
              className="w-[150px] h-11 rounded-xl border-slate-200"
              placeholder="Hasta"
              data-testid="input-date-to"
            />
          </div>
          {(dateFrom || dateTo || creatorFilter !== "all" || statusFilter !== "all" || searchTerm) && (
            <Button
              variant="ghost"
              size="sm"
              className="rounded-xl text-slate-500 hover:text-orange-600 hover:bg-orange-50"
              onClick={() => {
                setDateFrom("");
                setDateTo("");
                setCreatorFilter("all");
                setStatusFilter("all");
                setSearchTerm("");
                handleFilterChange();
              }}
              data-testid="button-clear-filters"
            >
              <XIcon className="w-3.5 h-3.5 mr-1" />
              Limpiar filtros
            </Button>
          )}
        </div>
      )}
      </div>{/* /filters card */}

      {/* Mobile Card View / Desktop Table View */}
      {isMobile ? (
        <div className="space-y-3">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-100 p-4 space-y-3 animate-pulse">
                <div className="flex justify-between">
                  <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                  <div className="h-5 bg-gray-200 rounded-full w-16"></div>
                </div>
                <div className="h-3 bg-gray-100 rounded w-1/3"></div>
                <div className="h-3 bg-gray-100 rounded w-1/2"></div>
              </div>
            ))
          ) : displayedQuotes && displayedQuotes.length > 0 ? (
            displayedQuotes.map((quote) => {
              const status = statusConfig[quote.status] || statusConfig.draft;
              const StatusIcon = status.icon;
              return (
                <div
                  key={quote.id}
                  className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 active:bg-gray-50 transition-colors"
                  onClick={() => handleEditQuote(quote.id)}
                  data-testid={`quote-row-${quote.id}`}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-sm truncate" data-testid={`client-name-${quote.id}`}>
                        {quote.clientName}
                      </p>
                      {quote.clientRut && (
                        <p className="text-xs text-gray-400 mt-0.5">RUT: {quote.clientRut}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge className={`${status.color} text-[10px] px-2 py-0.5 font-medium`}>
                        <StatusIcon className="w-3 h-3 mr-1" />
                        {status.label}
                      </Badge>
                      <div onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" data-testid={`actions-${quote.id}`}>
                              <MoreVertical className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEditQuote(quote.id)}>
                              <FileText className="w-4 h-4 mr-2" /> Ver / Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleSendEmail(quote.id, quote.quoteNumber, quote.clientName, quote.createdBy)} disabled={sendEmailMutation.isPending}>
                              <Mail className="w-4 h-4 mr-2" /> Enviar por correo
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDownloadPDF(quote.id, quote.quoteNumber)} disabled={downloadingId === quote.id}>
                              <Download className="w-4 h-4 mr-2" /> Descargar PDF
                            </DropdownMenuItem>
                            {(quote.status === 'draft' || quote.status === 'sent' || quote.status === 'accepted' || quote.status === 'rejected') && (
                              <DropdownMenuItem onClick={() => handleDuplicateForEdit(quote.id)} disabled={duplicateQuoteMutation.isPending}>
                                <Copy className="w-4 h-4 mr-2" /> Duplicar
                              </DropdownMenuItem>
                            )}
                            {(user?.role === 'admin' || (user?.role === 'supervisor' || user?.role === 'encargado_area')) && (
                              <DropdownMenuItem onClick={() => handleDeleteQuote(quote.id, quote.quoteNumber)} disabled={deleteQuoteMutation.isPending} className="text-red-600 focus:text-red-600 focus:bg-red-50">
                                <Trash2 className="w-4 h-4 mr-2" /> Eliminar
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      {(user?.role === 'admin' || (user?.role === 'supervisor' || user?.role === 'encargado_area')) && (
                        <span className="flex items-center gap-1.5">
                          <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white ${avatarColor(quote.creatorEmail || quote.creatorName)}`}>{initialsOf(quote.creatorName)}</span>
                          {quote.creatorName || 'Desconocido'}
                        </span>
                      )}
                      <span>{getTimeAgo(quote.createdAt)}</span>
                    </div>
                    <span className="text-sm font-bold text-orange-600">
                      ${parseFloat(quote.total).toLocaleString('es-CL', { minimumFractionDigits: 0 })}
                    </span>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-10">
              <FileText className="mx-auto h-10 w-10 text-gray-300 mb-3" />
              <p className="text-sm font-medium text-gray-500">No hay cotizaciones</p>
              <p className="text-xs text-gray-400 mt-1">
                {searchTerm || statusFilter !== "all" ? "Intenta con otros filtros." : "Crea tu primera cotización."}
              </p>
            </div>
          )}
        </div>
      ) : (
      <Card className="border-slate-200/70 shadow-sm rounded-2xl overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white hover:bg-slate-50">
                  <TableHead className="text-left hidden md:table-cell text-[11px] uppercase tracking-wider font-semibold text-slate-500">Cotización</TableHead>
                  <TableHead className="text-left text-[11px] uppercase tracking-wider font-semibold text-slate-500">Cliente</TableHead>
                  <TableHead className="text-left text-[11px] uppercase tracking-wider font-semibold text-slate-500">Estado</TableHead>
                  {(user?.role === 'admin' || (user?.role === 'supervisor' || user?.role === 'encargado_area')) && (
                    <TableHead className="text-left text-[11px] uppercase tracking-wider font-semibold text-slate-500">Creado por</TableHead>
                  )}
                  <TableHead className="text-left text-[11px] uppercase tracking-wider font-semibold text-slate-500">Creada</TableHead>
                  <TableHead className="text-right text-[11px] uppercase tracking-wider font-semibold text-slate-500">Monto</TableHead>
                  <TableHead className="text-right pr-4 text-[11px] uppercase tracking-wider font-semibold text-slate-500 w-[180px]">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={7} className="text-center py-8">
                        <div className="animate-pulse flex space-x-4">
                          <div className="flex-1 space-y-2 py-1">
                            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : displayedQuotes && displayedQuotes.length > 0 ? (
                  displayedQuotes.map((quote) => (
                    <TableRow
                      key={quote.id}
                      className="border-b border-slate-100 hover:bg-orange-50/30 transition-colors cursor-pointer group"
                      data-testid={`quote-row-${quote.id}`}
                      onClick={() => handleEditQuote(quote.id)}
                    >
                      <TableCell className="py-4 hidden md:table-cell">
                        <div className="font-medium text-gray-900" data-testid={`quote-number-${quote.id}`}>
                          #{quote.quoteNumber}
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">
                          {quote.notes && quote.notes.length > 40
                            ? `${quote.notes.substring(0, 40)}...`
                            : quote.notes || 'Sin notas'
                          }
                        </div>
                      </TableCell>

                      <TableCell className="py-4">
                        <div className="font-medium text-gray-900" data-testid={`client-name-${quote.id}`}>
                          {quote.clientName}
                        </div>
                        {quote.clientRut && (
                          <div className="text-xs text-gray-400 mt-0.5">
                            RUT: {quote.clientRut}
                          </div>
                        )}
                      </TableCell>

                      <TableCell className="py-4" onClick={(e) => e.stopPropagation()}>
                        {getStatusBadge(quote.status)}
                        {quote.status === 'accepted' && quote.notes?.includes('[NVV-AUTO]') && (
                          <div className="text-[9px] text-emerald-600 font-medium mt-0.5 flex items-center gap-0.5">
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            Auto NVV
                          </div>
                        )}
                      </TableCell>

                      {(user?.role === 'admin' || (user?.role === 'supervisor' || user?.role === 'encargado_area')) && (
                        <TableCell className="py-4">
                          <div className="flex items-center gap-2.5">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold text-white flex-shrink-0 ${avatarColor(quote.creatorEmail || quote.creatorName)}`}>
                              {initialsOf(quote.creatorName)}
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm text-gray-900 font-medium truncate">
                                {quote.creatorName || 'Desconocido'}
                              </div>
                              {quote.creatorEmail && (
                                <div className="text-[10px] text-gray-400 truncate">
                                  {quote.creatorEmail}
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                      )}

                      <TableCell className="py-4">
                        <div className="text-sm text-gray-900">
                          {formatDate(quote.createdAt)}
                        </div>
                        <div className="text-[10px] text-gray-400">
                          {getTimeAgo(quote.createdAt)}
                        </div>
                      </TableCell>

                      <TableCell className="py-4 text-right">
                        <span className="font-bold text-orange-600">
                          {formatCurrency(quote.total || '0')}
                        </span>
                      </TableCell>

                      <TableCell
                        className="py-4 pr-4 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center gap-1 justify-end">
                          {/* Enviar (correo) - botón principal */}
                          <Button
                            size="sm"
                            className="h-8 gap-1.5 bg-orange-600 hover:bg-orange-700 text-white shadow-sm shadow-orange-500/30 px-3 rounded-lg"
                            onClick={() => handleSendEmail(quote.id, quote.quoteNumber, quote.clientName, quote.createdBy)}
                            disabled={sendEmailMutation.isPending}
                            title="Enviar cotización por correo"
                            data-testid={`send-email-${quote.id}`}
                          >
                            <Send className="h-3.5 w-3.5" />
                            <span className="text-xs font-medium hidden lg:inline">Enviar</span>
                          </Button>

                          {/* Duplicar */}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 rounded-lg text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                            onClick={() => handleDuplicateForEdit(quote.id)}
                            disabled={duplicateQuoteMutation.isPending}
                            title="Duplicar para editar"
                            data-testid={`button-duplicate-quote-${quote.id}`}
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>

                          {/* Descargar PDF */}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 rounded-lg text-slate-600 hover:bg-emerald-50 hover:text-emerald-600 transition-colors"
                            onClick={() => handleDownloadPDF(quote.id, quote.quoteNumber)}
                            disabled={downloadingId === quote.id}
                            title="Descargar PDF"
                            data-testid={`download-pdf-${quote.id}`}
                          >
                            {downloadingId === quote.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Download className="h-3.5 w-3.5" />
                            )}
                          </Button>

                          {/* Más opciones */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                                data-testid={`actions-${quote.id}`}
                                title="Más acciones"
                              >
                                <MoreVertical className="h-3.5 w-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52">
                              <DropdownMenuItem
                                data-testid={`view-${quote.id}`}
                                onClick={() => handleEditQuote(quote.id)}
                                className="text-xs gap-2"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                Ver / Editar cotización
                              </DropdownMenuItem>

                              {quote.status === 'draft' && (
                                <DropdownMenuItem
                                  data-testid={`status-sent-${quote.id}`}
                                  onClick={() => handleStatusChange(quote.id, 'sent', quote.quoteNumber)}
                                  disabled={updateStatusMutation.isPending}
                                  className="text-xs gap-2"
                                >
                                  <Send className="w-3.5 h-3.5" />
                                  Marcar como enviada
                                </DropdownMenuItem>
                              )}

                              {quote.status === 'sent' && (
                                <DropdownMenuItem
                                  data-testid={`status-rejected-${quote.id}`}
                                  onClick={() => handleStatusChange(quote.id, 'rejected', quote.quoteNumber)}
                                  disabled={updateStatusMutation.isPending}
                                  className="text-xs gap-2"
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                  Marcar como rechazada
                                </DropdownMenuItem>
                              )}

                              {(quote.status === 'rejected' || quote.status === 'accepted') && (
                                <DropdownMenuItem
                                  data-testid={`status-draft-${quote.id}`}
                                  onClick={() => handleStatusChange(quote.id, 'draft', quote.quoteNumber)}
                                  disabled={updateStatusMutation.isPending}
                                  className="text-xs gap-2"
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                  Volver a borrador
                                </DropdownMenuItem>
                              )}

                              {(quote.status === 'accepted' || quote.status === 'sent') && (
                                <DropdownMenuItem data-testid={`convert-${quote.id}`} className="text-xs gap-2">
                                  <Package className="w-3.5 h-3.5" />
                                  Convertir a pedido
                                </DropdownMenuItem>
                              )}

                              {(user?.role === 'admin' || (user?.role === 'supervisor' || user?.role === 'encargado_area')) && (
                                <DropdownMenuItem
                                  data-testid={`button-delete-quote-${quote.id}`}
                                  onClick={() => handleDeleteQuote(quote.id, quote.quoteNumber)}
                                  disabled={deleteQuoteMutation.isPending}
                                  className="text-xs gap-2 text-red-600 focus:text-red-600 focus:bg-red-50"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  Eliminar
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12">
                      <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">
                        No hay cotizaciones
                      </h3>
                      <p className="text-gray-500">
                        {searchTerm || statusFilter !== "all"
                          ? "No se encontraron cotizaciones con los filtros aplicados."
                          : "Aún no se han creado cotizaciones en el sistema."
                        }
                      </p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      )}

      {/* Load More Button */}
      {hasMore && (
        <div className="flex justify-center pt-4">
          <Button
            variant="outline"
            onClick={() => setDisplayLimit(prev => prev + 20)}
            className="w-full sm:w-auto"
            data-testid="button-load-more"
          >
            <Clock className="w-4 h-4 mr-2" />
            Cargar más cotizaciones ({displayLimit} de {quotes?.length || 0})
          </Button>
        </div>
      )}

      {/* Results summary */}
      {quotes && quotes.length > 0 && (
        <div className="text-center text-sm text-gray-500">
          Mostrando {Math.min(displayLimit, quotes.length)} de {quotes.length} cotizaciones
        </div>
      )}

      {/* Send Email Dialog */}
      <Dialog open={!!emailDialog} onOpenChange={(open) => { if (!open) { setEmailDialog(null); resetEmailForm(); } }}>
        <DialogContent className="max-w-2xl max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden border-0 shadow-2xl rounded-2xl">
          {/* Header con gradient oscuro */}
          <DialogHeader className="relative px-7 pt-7 pb-6 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 shrink-0">
            <div className="absolute top-0 right-0 w-48 h-48 bg-orange-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4 pointer-events-none" />
            <div className="relative flex items-start gap-4">
              <div className="p-3 rounded-xl bg-orange-500/20 backdrop-blur-sm border border-orange-400/30">
                <Mail className="h-6 w-6 text-orange-300" />
              </div>
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-xl text-white tracking-tight font-bold">
                  Enviar cotización
                </DialogTitle>
                <DialogDescription className="text-slate-300 mt-1 text-sm">
                  {emailDialog && (
                    <>
                      <span className="text-orange-300 font-mono">{emailDialog.quoteNumber}</span>
                      <span className="text-slate-500 mx-2">·</span>
                      <span className="text-slate-200">{emailDialog.clientName}</span>
                    </>
                  )}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto bg-slate-50/50">
            <div className="px-7 py-6 space-y-6">

              {/* Sección 1: Destinatarios */}
              <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
                  <div className="h-6 w-6 rounded-md bg-blue-500/10 text-blue-600 flex items-center justify-center text-xs font-bold">1</div>
                  <h3 className="font-semibold text-sm text-slate-900">Destinatarios</h3>
                </div>
                <div className="p-5 space-y-4">
                  <div>
                    <Label className="text-xs font-medium text-slate-700">Para</Label>
                    <Input
                      type="email"
                      value={emailRecipient}
                      onChange={(e) => setEmailRecipient(e.target.value)}
                      className="mt-1.5 bg-slate-50 border-slate-200 focus-visible:bg-white"
                      placeholder="fparra@pinturaspanoramica.cl"
                    />
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {quickContacts.map((c) => {
                        const active = emailRecipient.trim().toLowerCase() === c.email.toLowerCase();
                        return (
                          <button
                            key={c.email}
                            type="button"
                            onClick={() => setEmailRecipient(c.email)}
                            className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
                              active
                                ? "bg-orange-500 border-orange-500 text-white"
                                : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300"
                            }`}
                            title={c.email}
                          >
                            {c.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-slate-700">CC <span className="text-slate-400 font-normal">(separar con coma)</span></Label>
                    <Input
                      value={emailCc}
                      onChange={(e) => setEmailCc(e.target.value)}
                      className="mt-1.5 bg-slate-50 border-slate-200 focus-visible:bg-white"
                      placeholder="copia@dom.cl, otro@dom.cl"
                    />
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {quickContacts.map((c) => {
                        const ccItems = emailCc.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
                        const active = ccItems.includes(c.email.toLowerCase());
                        const toggle = () => {
                          const items = emailCc.split(",").map((s) => s.trim()).filter(Boolean);
                          const idx = items.findIndex((it) => it.toLowerCase() === c.email.toLowerCase());
                          if (idx >= 0) items.splice(idx, 1);
                          else items.push(c.email);
                          setEmailCc(items.join(", "));
                        };
                        return (
                          <button
                            key={c.email}
                            type="button"
                            onClick={toggle}
                            className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
                              active
                                ? "bg-blue-500 border-blue-500 text-white"
                                : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300"
                            }`}
                            title={c.email}
                          >
                            {active ? "✓ " : "+ "}{c.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  {isAdminOrSupervisor && (
                    <div>
                      <Label className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-orange-500" />
                        Vendedor asignado
                      </Label>
                      <Select value={emailSalespersonId} onValueChange={handleSalespersonChange}>
                        <SelectTrigger className="mt-1.5 bg-slate-50 border-slate-200">
                          <SelectValue placeholder="Seleccionar vendedor" />
                        </SelectTrigger>
                        <SelectContent>
                          {salespeople.map((sp) => (
                            <SelectItem key={sp.id} value={sp.id}>
                              {sp.salespersonName || sp.email || sp.id}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-[11px] text-slate-500 mt-1.5 flex items-center gap-1">
                        <span className="inline-block w-1 h-1 rounded-full bg-slate-400" />
                        El correo se firma a nombre de este vendedor y se envía con copia automática a su email y al de su supervisor.
                      </p>
                    </div>
                  )}
                </div>
              </section>

              {/* Sección 2: Datos comerciales */}
              <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
                  <div className="h-6 w-6 rounded-md bg-emerald-500/10 text-emerald-600 flex items-center justify-center text-xs font-bold">2</div>
                  <h3 className="font-semibold text-sm text-slate-900">Datos comerciales</h3>
                </div>
                <div className="p-5 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs font-medium text-slate-700">N° de OC <span className="text-slate-400 font-normal">(opcional)</span></Label>
                      <Input
                        value={emailOcNumber}
                        onChange={(e) => setEmailOcNumber(e.target.value)}
                        className="mt-1.5 bg-slate-50 border-slate-200 focus-visible:bg-white"
                        placeholder="OC-12345"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-medium text-slate-700">Segmento</Label>
                      <Select value={emailSegment} onValueChange={setEmailSegment}>
                        <SelectTrigger className="mt-1.5 bg-slate-50 border-slate-200">
                          <SelectValue placeholder="Seleccionar..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="MCT">MCT</SelectItem>
                          <SelectItem value="FERRETERIAS">Ferreterías</SelectItem>
                          <SelectItem value="CONSTRUCCION">Construcción</SelectItem>
                          <SelectItem value="CANALES DIGITALES">Canales Digitales</SelectItem>
                          <SelectItem value="FABRICACION MODULAR">Fabricación Modular</SelectItem>
                          <SelectItem value="PANORAMICA STORE">Panorámica Store</SelectItem>
                          <SelectItem value="OTRO">Otro</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-slate-700">Método de pago</Label>
                    <Select value={emailPaymentMethod} onValueChange={setEmailPaymentMethod}>
                      <SelectTrigger className="mt-1.5 bg-slate-50 border-slate-200">
                        <SelectValue placeholder="Seleccionar método de pago" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Transferencia bancaria">Transferencia bancaria</SelectItem>
                        <SelectItem value="Tarjeta (Getnet)">Tarjeta (Getnet)</SelectItem>
                        <SelectItem value="Cheque">Cheque</SelectItem>
                        <SelectItem value="Efectivo">Efectivo</SelectItem>
                        <SelectItem value="Crédito 30 días">Crédito 30 días</SelectItem>
                        <SelectItem value="Crédito 60 días">Crédito 60 días</SelectItem>
                        <SelectItem value="Crédito 90 días">Crédito 90 días</SelectItem>
                        <SelectItem value="Contra entrega">Contra entrega</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-slate-700">Alcances</Label>
                    <Textarea
                      value={emailScope}
                      onChange={(e) => setEmailScope(e.target.value)}
                      className="mt-1.5 bg-slate-50 border-slate-200 focus-visible:bg-white resize-none"
                      rows={3}
                      placeholder="Detalles de entrega, plazos, condiciones especiales, despacho..."
                    />
                  </div>
                </div>
              </section>

              {/* Sección 3: Adjunto + mensaje */}
              <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
                  <div className="h-6 w-6 rounded-md bg-amber-500/10 text-amber-600 flex items-center justify-center text-xs font-bold">3</div>
                  <h3 className="font-semibold text-sm text-slate-900">Adjunto y mensaje</h3>
                </div>
                <div className="p-5 space-y-4">
                  <div>
                    <Label className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
                      <Paperclip className="h-3.5 w-3.5 text-slate-500" />
                      Archivos adjuntos <span className="text-slate-400 font-normal">(OC, captura de pago, etc.)</span>
                    </Label>
                    {emailAttachments.length > 0 && (
                      <div className="mt-1.5 space-y-2">
                        {emailAttachments.map((att, idx) => (
                          <div key={idx} className="flex items-center justify-between gap-2 rounded-lg border-2 border-emerald-200 bg-emerald-50/50 px-4 py-3">
                            <div className="text-sm truncate flex items-center gap-2 min-w-0">
                              <div className="h-8 w-8 rounded-md bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
                                <Paperclip className="h-4 w-4" />
                              </div>
                              <div className="min-w-0">
                                <div className="font-medium text-slate-900 truncate">{att.name}</div>
                                <div className="text-[11px] text-slate-500">Listo para enviar</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  try {
                                    const byteChars = atob(att.base64);
                                    const byteNumbers = new Array(byteChars.length);
                                    for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
                                    const blob = new Blob([new Uint8Array(byteNumbers)], { type: att.mime || 'application/octet-stream' });
                                    const url = URL.createObjectURL(blob);
                                    window.open(url, '_blank', 'noopener,noreferrer');
                                    setTimeout(() => URL.revokeObjectURL(url), 60_000);
                                  } catch {
                                    toast({ title: 'Error', description: 'No se pudo abrir el archivo.', variant: 'destructive' });
                                  }
                                }}
                                className="text-slate-500 hover:text-orange-600"
                                title="Ver archivo"
                              >
                                <FileText className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  try {
                                    const byteChars = atob(att.base64);
                                    const byteNumbers = new Array(byteChars.length);
                                    for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
                                    const blob = new Blob([new Uint8Array(byteNumbers)], { type: att.mime || 'application/octet-stream' });
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = att.name;
                                    document.body.appendChild(a);
                                    a.click();
                                    document.body.removeChild(a);
                                    setTimeout(() => URL.revokeObjectURL(url), 60_000);
                                  } catch {
                                    toast({ title: 'Error', description: 'No se pudo descargar el archivo.', variant: 'destructive' });
                                  }
                                }}
                                className="text-slate-500 hover:text-emerald-600"
                                title="Descargar archivo"
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                              <Button type="button" variant="ghost" size="sm" onClick={() => setEmailAttachments((prev) => prev.filter((_, i) => i !== idx))} className="text-slate-500 hover:text-red-600" title="Quitar archivo">
                                <XIcon className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <label className="mt-1.5 block rounded-lg border-2 border-dashed border-slate-300 hover:border-orange-400 hover:bg-orange-50/30 transition-colors cursor-pointer p-5 text-center">
                      <input
                        type="file"
                        multiple
                        onChange={handleAttachmentChange}
                        accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
                        className="hidden"
                        disabled={attachmentLoading}
                      />
                      {attachmentLoading ? (
                        <div className="flex items-center justify-center gap-2 text-sm text-slate-600">
                          <Loader2 className="h-4 w-4 animate-spin" /> Cargando...
                        </div>
                      ) : (
                        <>
                          <Paperclip className="h-6 w-6 text-slate-400 mx-auto mb-2" />
                          <div className="text-sm font-medium text-slate-700">{emailAttachments.length > 0 ? 'Agregar otro archivo' : 'Click para subir archivo'}</div>
                          <div className="text-xs text-slate-500 mt-0.5">PDF, imagen o documento · Máx 10 MB c/u</div>
                        </>
                      )}
                    </label>
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-slate-700">Mensaje adicional <span className="text-slate-400 font-normal">(opcional)</span></Label>
                    <Textarea
                      value={emailMessage}
                      onChange={(e) => setEmailMessage(e.target.value)}
                      className="mt-1.5 bg-slate-50 border-slate-200 focus-visible:bg-white resize-none"
                      rows={3}
                      placeholder="Notas o contexto para el destinatario..."
                    />
                  </div>
                </div>
              </section>
            </div>
          </div>

          <DialogFooter className="px-7 py-4 border-t bg-white shrink-0 flex items-center justify-between sm:justify-between">
            <div className="text-xs text-slate-500 hidden sm:block">
              El PDF de la cotización se adjunta automáticamente.
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => { setEmailDialog(null); resetEmailForm(); }}>Cancelar</Button>
              <Button
                className="bg-orange-500 hover:bg-orange-600 shadow-md shadow-orange-500/30"
                onClick={() => emailDialog && sendEmailMutation.mutate({ quoteId: emailDialog.quoteId })}
                disabled={sendEmailMutation.isPending || !emailRecipient.trim()}
              >
                {sendEmailMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Enviando...</>
                ) : (
                  <><Send className="h-4 w-4 mr-2" /> Enviar correo</>
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}