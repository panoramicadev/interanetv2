import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
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

  const { data: user, isLoading, error } = useQuery<User | null>({
    queryKey: ["/api/auth/user"],
    queryFn: async () => {
      try {
        const response = await fetch("/api/auth/user", {
          credentials: "include",
        });
        if (response.status === 401) {
          return null; // Return null for unauthorized instead of throwing
        }
        if (!response.ok) {
          throw new Error(`${response.status}: ${response.statusText}`);
        }
        return await response.json();
      } catch (error) {
        console.error("Auth check error:", error);
        return null;
      }
    },
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchInterval: false,
    staleTime: Infinity,
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

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    loginMutation,
    registerMutation,
    logoutMutation,
  };
}
