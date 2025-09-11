import { useAuth } from "@/hooks/useAuth";
import { LoginForm } from "@/components/auth/LoginForm";
import { Redirect } from "wouter";
import panoramicaLogo from "@assets/logo-inicio_1757596790120.png";

export default function Login() {
  const { user, isLoading } = useAuth();

  // Redirect if already logged in
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Cargando...</p>
        </div>
      </div>
    );
  }

  if (user) {
    return <Redirect to="/" />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img 
            src={panoramicaLogo}
            alt="Panoramica - 30 Años"
            className="mx-auto max-w-full h-auto max-h-24 mb-4"
          />
        </div>

        <LoginForm />

        <div className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
          <p>🔒 Sistema seguro con autenticación profesional</p>
        </div>
      </div>
    </div>
  );
}