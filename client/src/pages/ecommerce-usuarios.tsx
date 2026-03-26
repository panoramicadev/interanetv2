import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Users, Search, Mail, Phone, MapPin, Calendar, ShieldCheck,
  ShieldX, UserCircle, Hash, Building2, Clock
} from "lucide-react";

interface ClientUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  createdAt: string;
  lastLogin: string | null;
  isActive: boolean;
  clientCode: string | null;
  clientName: string;
  rut: string | null;
  phone: string | null;
  address: string | null;
  commune: string | null;
  assignedSalesperson: string | null;
}

export default function EcommerceUsuarios() {
  const [searchTerm, setSearchTerm] = useState("");

  const { data: clientUsers = [], isLoading } = useQuery<ClientUser[]>({
    queryKey: ["/api/users/clients"],
    queryFn: async () => {
      const res = await apiRequest("/api/users/clients");
      return res.json();
    },
  });

  const filteredUsers = clientUsers.filter((u) => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (
      u.email?.toLowerCase().includes(q) ||
      u.clientName?.toLowerCase().includes(q) ||
      u.clientCode?.toLowerCase().includes(q) ||
      u.rut?.toLowerCase().includes(q) ||
      u.phone?.toLowerCase().includes(q)
    );
  });

  const activeCount = clientUsers.filter(u => u.isActive).length;
  const recentCount = clientUsers.filter(u => {
    if (!u.lastLogin) return false;
    const diff = Date.now() - new Date(u.lastLogin).getTime();
    return diff < 7 * 24 * 60 * 60 * 1000; // last 7 days
  }).length;

  const formatDate = (date: string | null) => {
    if (!date) return "Nunca";
    return new Date(date).toLocaleDateString("es-CL", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatRelativeTime = (date: string | null) => {
    if (!date) return "Nunca";
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Ahora";
    if (mins < 60) return `Hace ${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `Hace ${hrs}h`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `Hace ${days}d`;
    return formatDate(date);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Users className="h-6 w-6 text-blue-600" />
            Usuarios eCommerce
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Clientes con acceso al portal de compras
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50 border-blue-200">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-blue-600 uppercase">Total Usuarios</p>
              <p className="text-2xl font-bold text-blue-900">{clientUsers.length}</p>
            </div>
            <Users className="h-8 w-8 text-blue-400" />
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-50 to-green-100/50 border-green-200">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-green-600 uppercase">Activos</p>
              <p className="text-2xl font-bold text-green-900">{activeCount}</p>
            </div>
            <ShieldCheck className="h-8 w-8 text-green-400" />
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-50 to-purple-100/50 border-purple-200">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-purple-600 uppercase">Activos última semana</p>
              <p className="text-2xl font-bold text-purple-900">{recentCount}</p>
            </div>
            <Clock className="h-8 w-8 text-purple-400" />
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

      {/* Users List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : filteredUsers.length === 0 ? (
        <Card className="bg-white dark:bg-gray-800">
          <CardContent className="py-16 text-center">
            <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-500">
              {searchTerm ? "Sin resultados" : "No hay usuarios cliente aún"}
            </h3>
            <p className="text-sm text-gray-400 mt-1">
              {searchTerm ? "Intenta con otro término de búsqueda" : "Los usuarios se crean desde la sección de clientes"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredUsers.map((user) => (
            <Card
              key={user.id}
              className="bg-white dark:bg-gray-800 hover:shadow-md transition-shadow"
            >
              <CardContent className="p-4">
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                  {/* Avatar + Name */}
                  <div className="flex items-center gap-3 min-w-0 lg:w-1/3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                      user.isActive
                        ? "bg-blue-100 text-blue-600"
                        : "bg-gray-100 text-gray-400"
                    }`}>
                      <UserCircle className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                          {user.clientName}
                        </h3>
                        <Badge
                          variant={user.isActive ? "default" : "secondary"}
                          className={`text-[10px] px-1.5 py-0 ${
                            user.isActive
                              ? "bg-green-100 text-green-700 border-green-200"
                              : "bg-gray-100 text-gray-500 border-gray-200"
                          }`}
                        >
                          {user.isActive ? "Activo" : "Inactivo"}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-500 flex items-center gap-1 truncate">
                        <Mail className="h-3 w-3 flex-shrink-0" />
                        {user.email}
                      </p>
                    </div>
                  </div>

                  {/* Info pills */}
                  <div className="flex flex-wrap items-center gap-2 lg:flex-1">
                    {user.clientCode && (
                      <span className="inline-flex items-center gap-1 text-xs bg-gray-50 text-gray-600 px-2 py-1 rounded-md border border-gray-100">
                        <Hash className="h-3 w-3" />
                        {user.clientCode}
                      </span>
                    )}
                    {user.rut && (
                      <span className="inline-flex items-center gap-1 text-xs bg-gray-50 text-gray-600 px-2 py-1 rounded-md border border-gray-100">
                        <Building2 className="h-3 w-3" />
                        {user.rut}
                      </span>
                    )}
                    {user.phone && (
                      <span className="inline-flex items-center gap-1 text-xs bg-gray-50 text-gray-600 px-2 py-1 rounded-md border border-gray-100">
                        <Phone className="h-3 w-3" />
                        {user.phone}
                      </span>
                    )}
                    {user.commune && (
                      <span className="inline-flex items-center gap-1 text-xs bg-gray-50 text-gray-600 px-2 py-1 rounded-md border border-gray-100">
                        <MapPin className="h-3 w-3" />
                        {user.commune}
                      </span>
                    )}
                  </div>

                  {/* Dates */}
                  <div className="flex items-center gap-4 text-xs text-gray-400 lg:w-auto lg:flex-shrink-0">
                    <span className="flex items-center gap-1" title="Fecha de registro">
                      <Calendar className="h-3 w-3" />
                      {formatDate(user.createdAt)}
                    </span>
                    <span className="flex items-center gap-1" title="Último acceso">
                      <Clock className="h-3 w-3" />
                      {formatRelativeTime(user.lastLogin)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
