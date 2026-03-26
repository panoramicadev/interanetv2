import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Users, Search, Mail, Phone, MapPin, Calendar,
  UserCircle, Hash, Building2, Clock, ShieldCheck, KeyRound
} from "lucide-react";

interface ClientRecord {
  id: string;
  clientCode: string | null;
  clientName: string;
  rut: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  commune: string | null;
  hasCredentials: boolean;
  userId: string | null;
  assignedSalesperson: string | null;
  salesRepCode: string | null;
  createdAt: string;
  creditLimit: number | null;
  creditAvailable: number | null;
}

export default function EcommerceUsuarios() {
  const [searchTerm, setSearchTerm] = useState("");

  const { data: clients = [], isLoading } = useQuery<ClientRecord[]>({
    queryKey: ["/api/users/clients"],
    queryFn: async () => {
      const res = await apiRequest("/api/users/clients");
      return res.json();
    },
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

  const withCredentials = clients.filter(c => c.hasCredentials).length;
  const withoutCredentials = clients.length - withCredentials;

  const formatDate = (date: string | null) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("es-CL", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Users className="h-6 w-6 text-blue-600" />
            Usuarios eCommerce
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Clientes registrados y su estado de acceso al portal
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50 border-blue-200">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-blue-600 uppercase">Total Clientes</p>
              <p className="text-2xl font-bold text-blue-900">{clients.length}</p>
            </div>
            <Users className="h-8 w-8 text-blue-400" />
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-50 to-green-100/50 border-green-200">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-green-600 uppercase">Con Acceso</p>
              <p className="text-2xl font-bold text-green-900">{withCredentials}</p>
            </div>
            <KeyRound className="h-8 w-8 text-green-400" />
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-50 to-amber-100/50 border-amber-200">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-amber-600 uppercase">Sin Credenciales</p>
              <p className="text-2xl font-bold text-amber-900">{withoutCredentials}</p>
            </div>
            <ShieldCheck className="h-8 w-8 text-amber-400" />
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Buscar por nombre, email, RUT o código..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9 text-sm"
        />
      </div>

      {/* Clients List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : filteredClients.length === 0 ? (
        <Card className="bg-white dark:bg-gray-800">
          <CardContent className="py-16 text-center">
            <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-500">
              {searchTerm ? "Sin resultados" : "No hay clientes registrados"}
            </h3>
            <p className="text-sm text-gray-400 mt-1">
              {searchTerm ? "Intenta con otro término de búsqueda" : "Los clientes se crean desde la sección de Clientes"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredClients.map((client) => (
            <Card
              key={client.id}
              className="bg-white dark:bg-gray-800 hover:shadow-md transition-shadow"
            >
              <CardContent className="p-4">
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                  {/* Avatar + Name */}
                  <div className="flex items-center gap-3 min-w-0 lg:w-1/3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                      client.hasCredentials
                        ? "bg-blue-100 text-blue-600"
                        : "bg-gray-100 text-gray-400"
                    }`}>
                      <UserCircle className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                          {client.clientName}
                        </h3>
                        <Badge
                          variant="secondary"
                          className={`text-[10px] px-1.5 py-0 ${
                            client.hasCredentials
                              ? "bg-green-100 text-green-700 border-green-200"
                              : "bg-gray-100 text-gray-500 border-gray-200"
                          }`}
                        >
                          {client.hasCredentials ? "Con acceso" : "Sin acceso"}
                        </Badge>
                      </div>
                      {client.email && (
                        <p className="text-xs text-gray-500 flex items-center gap-1 truncate">
                          <Mail className="h-3 w-3 flex-shrink-0" />
                          {client.email}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Info pills */}
                  <div className="flex flex-wrap items-center gap-2 lg:flex-1">
                    {client.clientCode && (
                      <span className="inline-flex items-center gap-1 text-xs bg-gray-50 text-gray-600 px-2 py-1 rounded-md border border-gray-100">
                        <Hash className="h-3 w-3" />
                        {client.clientCode}
                      </span>
                    )}
                    {client.rut && (
                      <span className="inline-flex items-center gap-1 text-xs bg-gray-50 text-gray-600 px-2 py-1 rounded-md border border-gray-100">
                        <Building2 className="h-3 w-3" />
                        {client.rut}
                      </span>
                    )}
                    {client.phone && (
                      <span className="inline-flex items-center gap-1 text-xs bg-gray-50 text-gray-600 px-2 py-1 rounded-md border border-gray-100">
                        <Phone className="h-3 w-3" />
                        {client.phone}
                      </span>
                    )}
                    {client.commune && (
                      <span className="inline-flex items-center gap-1 text-xs bg-gray-50 text-gray-600 px-2 py-1 rounded-md border border-gray-100">
                        <MapPin className="h-3 w-3" />
                        {client.commune}
                      </span>
                    )}
                  </div>

                  {/* Date */}
                  <div className="flex items-center gap-4 text-xs text-gray-400 lg:w-auto lg:flex-shrink-0">
                    <span className="flex items-center gap-1" title="Fecha de registro">
                      <Calendar className="h-3 w-3" />
                      {formatDate(client.createdAt)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          
          <p className="text-xs text-gray-400 text-center pt-2">
            Mostrando {filteredClients.length} de {clients.length} clientes
          </p>
        </div>
      )}
    </div>
  );
}
