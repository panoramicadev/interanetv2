import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { User, LogIn, LogOut } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { SalespersonUser } from "@shared/schema";

export function LoginSelector() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedUserId, setSelectedUserId] = useState<string>("");

  // Query para obtener todos los usuarios
  const { data: users = [], isLoading } = useQuery<SalespersonUser[]>({
    queryKey: ["/api/users/salespeople"],
  });

  // Query para obtener el usuario actual
  const { data: currentUser } = useQuery<SalespersonUser>({
    queryKey: ["/api/auth/user"],
    retry: false,
  });

  // Mutation para simular login
  const loginMutation = useMutation({
    mutationFn: async (userId: string) => {
      return await apiRequest("POST", "/api/auth/simulate-login", { userId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "Acceso exitoso",
        description: "Has cambiado de usuario correctamente.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo cambiar de usuario.",
        variant: "destructive",
      });
    },
  });

  // Mutation para logout
  const logoutMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/auth/logout");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "Sesión cerrada",
        description: "Has cerrado sesión correctamente.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo cerrar sesión.",
        variant: "destructive",
      });
    },
  });

  const handleLogin = () => {
    if (selectedUserId) {
      loginMutation.mutate(selectedUserId);
    }
  };

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'supervisor': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'salesperson': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'client': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin': return 'Administrador';
      case 'supervisor': return 'Supervisor';
      case 'salesperson': return 'Vendedor';
      case 'client': return 'Cliente';
      default: return role;
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="flex items-center justify-center mb-2">
          <User className="w-8 h-8 text-primary" />
        </div>
        <CardTitle>Selector de Usuario</CardTitle>
        <CardDescription>
          Cambia entre diferentes usuarios para probar los paneles según el rol
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {currentUser ? (
          <div className="text-center space-y-4">
            <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
              <p className="text-sm text-green-600 dark:text-green-400 font-medium">
                Conectado como:
              </p>
              <p className="font-semibold text-green-800 dark:text-green-200">
                {currentUser?.salespersonName || "Usuario"}
              </p>
              <Badge className={`mt-2 ${getRoleBadgeColor(currentUser?.role || '')}`}>
                {getRoleLabel(currentUser?.role || '')}
              </Badge>
            </div>
            <Button 
              onClick={handleLogout}
              disabled={logoutMutation.isPending}
              variant="outline"
              className="w-full"
              data-testid="button-logout"
            >
              <LogOut className="w-4 h-4 mr-2" />
              {logoutMutation.isPending ? "Cerrando sesión..." : "Cerrar Sesión"}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Seleccionar Usuario
              </label>
              <Select onValueChange={setSelectedUserId} value={selectedUserId}>
                <SelectTrigger data-testid="select-user">
                  <SelectValue placeholder="Elige un usuario para probar" />
                </SelectTrigger>
                <SelectContent>
                  {isLoading ? (
                    <SelectItem value="loading" disabled>Cargando usuarios...</SelectItem>
                  ) : (
                    users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        <div className="flex items-center justify-between w-full">
                          <span className="truncate">{user.salespersonName || 'Sin nombre'}</span>
                          <Badge 
                            className={`text-xs ml-2 ${getRoleBadgeColor(user.role || '')}`}
                            variant="secondary"
                          >
                            {getRoleLabel(user.role || '')}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <Button 
              onClick={handleLogin}
              disabled={!selectedUserId || loginMutation.isPending}
              className="w-full"
              data-testid="button-login"
            >
              <LogIn className="w-4 h-4 mr-2" />
              {loginMutation.isPending ? "Conectando..." : "Conectar"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}