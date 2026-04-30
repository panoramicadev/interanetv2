import MailingSection from "@/components/ecommerce/mailing-section";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Mail } from "lucide-react";

export default function MailingPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'supervisor';

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-orange-100 text-orange-600">
          <Mail className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Mailing</h1>
          <p className="text-sm text-muted-foreground">
            Notificaciones de venta, cobranzas y destinatarios internos.
          </p>
        </div>
      </div>

      {isAdmin ? (
        <MailingSection />
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Solo administradores y supervisores pueden gestionar el módulo de Mailing.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
