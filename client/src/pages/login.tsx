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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative background shapes */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-400/20 dark:bg-blue-600/20 blur-[100px] pointer-events-none animate-pulse" style={{ animationDuration: '8s' }} />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-400/20 dark:bg-indigo-600/20 blur-[100px] pointer-events-none animate-pulse" style={{ animationDuration: '10s', animationDelay: '1s' }} />
      <div className="absolute top-[20%] right-[10%] w-[20%] h-[20%] rounded-full bg-cyan-400/20 dark:bg-cyan-600/20 blur-[80px] pointer-events-none animate-pulse" style={{ animationDuration: '12s', animationDelay: '2s' }} />

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-10">
          <img
            src={panoramicaLogo}
            alt="Panoramica - 30 Años"
            className="mx-auto max-w-full h-auto max-h-28 drop-shadow-xl"
          />
        </div>

        <LoginForm />

        <div className="mt-10 text-center flex items-center justify-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <div className="h-px bg-slate-300 dark:bg-slate-700 flex-1 max-w-[50px]"></div>
          <span className="flex items-center gap-1.5 font-medium">
            <span className="text-base">🔒</span> Sistema Seguro
          </span>
          <div className="h-px bg-slate-300 dark:bg-slate-700 flex-1 max-w-[50px]"></div>
        </div>
      </div>
    </div>
  );
}