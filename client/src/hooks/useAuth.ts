import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { apiRequest, getQueryFn } from "@/lib/queryClient";
import type { User, InsertUser } from "@shared/schema";

type LoginData = {
  email: string;
  password: string;
};

type RegisterData = InsertUser;

export function useAuth() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const { data: user, isLoading, error } = useQuery<User | null>({
    queryKey: ["/api/auth/user"],
    queryFn: async () => {
      const response = await fetch("/api/auth/user", {
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      });
      // Sólo un 401 significa "no hay sesión". Cualquier otro fallo (red caída,
      // 500, timeout) se propaga: react-query conserva el último usuario bueno
      // y así un parpadeo de red no expulsa a nadie al login.
      if (response.status === 401) {
        return null;
      }
      if (!response.ok) {
        throw new Error(`${response.status}: ${response.statusText}`);
      }
      return await response.json();
    },
    retry: false,
    // Se revalida al volver a la pestaña y al montar: si a alguien le cambian el
    // rol o los permisos, los ve sin tener que cerrar sesión a mano.
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    refetchInterval: false,
    staleTime: 60_000,
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      const response = await apiRequest("POST", "/api/auth/login", credentials);
      return await response.json();
    },
    onSuccess: (userData: User) => {
      queryClient.setQueryData(["/api/auth/user"], userData);
      toast({
        title: "¡Bienvenido!",
        description: "Has iniciado sesión correctamente.",
      });
      // Navigate to dashboard immediately after successful login.
      // Preserva el deep-link de un pedido (correo "pedido modificado") si se entró por él.
      setTimeout(() => {
        const { pathname, search } = window.location;
        if (pathname === "/mis-pedidos" && new URLSearchParams(search).get("pedido")) {
          setLocation(`/mis-pedidos${search}`);
        } else {
          setLocation("/");
        }
      }, 100);
    },
    onError: (error: any) => {
      toast({
        title: "Error de acceso",
        description: error.message || "Email o contraseña incorrectos.",
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (userData: RegisterData) => {
      const response = await apiRequest("POST", "/api/auth/register", userData);
      return await response.json();
    },
    onSuccess: (userData: User) => {
      queryClient.setQueryData(["/api/auth/user"], userData);
      toast({
        title: "¡Cuenta creada!",
        description: "Tu cuenta ha sido creada exitosamente.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error de registro",
        description: error.message || "No se pudo crear la cuenta.",
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/auth/logout");
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/auth/user"], null);
      // Invalidate all queries to clear cache
      queryClient.clear();
      toast({
        title: "Sesión cerrada",
        description: "Has cerrado sesión correctamente.",
      });
      // Navigate to login page using SPA routing
      setTimeout(() => {
        setLocation("/login");
      }, 500);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo cerrar sesión.",
        variant: "destructive",
      });
    },
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    loginMutation,
    registerMutation,
    logoutMutation,
  };
}
