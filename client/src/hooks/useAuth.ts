import { useQuery } from "@tanstack/react-query";
import type { SalespersonUser } from "@shared/schema";

export function useAuth() {
  const { data: user, isLoading } = useQuery<SalespersonUser>({
    queryKey: ["/api/auth/user"],
    retry: false,
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
  };
}
