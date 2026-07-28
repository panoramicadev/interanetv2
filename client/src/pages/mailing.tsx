import MailingSection from "@/components/ecommerce/mailing-section";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Mail, Sparkles } from "lucide-react";

export default function MailingPage() {
  const { user } = useAuth();
  const canAccess = user?.role === 'admin' || (user?.role === 'supervisor' || user?.role === 'encargado_area') || user?.role === 'reception';

  return (
    <div className="min-h-screen bg-white dark:bg-slate-900">
      <div className="container mx-auto px-6 py-8 space-y-6 max-w-7xl">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-6 shadow-xl">
          <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
          <div className="relative flex items-center gap-4">
            <div className="p-3 rounded-xl bg-orange-500/20 backdrop-blur-sm border border-orange-400/30">
              <Mail className="h-6 w-6 text-orange-300" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-white tracking-tight">Mailing</h1>
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider bg-orange-500/20 text-orange-200 border border-orange-400/30 px-2 py-0.5 rounded-full">
                  <Sparkles className="h-3 w-3" /> Resend
                </span>
              </div>
              <p className="text-sm text-slate-300 mt-1">
                Centro de comunicaciones — venta, cobranza y notificaciones automáticas.
              </p>
            </div>
          </div>
        </div>

        {canAccess ? (
          <MailingSection />
        ) : (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Solo administradores, supervisores y recepción pueden gestionar el módulo de Mailing.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
