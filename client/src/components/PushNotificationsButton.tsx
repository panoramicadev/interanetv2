import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { BellRing, BellOff, Loader2, Share, SquarePlus, Send, ChevronDown } from 'lucide-react';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useToast } from '@/hooks/use-toast';

/**
 * Botón de activación de notificaciones push (PWA) para el header de la página
 * de Notificaciones. En iPhone/iPad sin instalar muestra las instrucciones de
 * "Añadir a pantalla de inicio" (requisito de iOS para recibir push).
 */
export function PushNotificationsButton() {
  const { status, isBusy, subscribe, unsubscribe, sendTest } = usePushNotifications();
  const { toast } = useToast();
  const [showIosDialog, setShowIosDialog] = useState(false);

  // Sin soporte o sin llaves VAPID en el server: no mostrar nada
  if (status === 'loading' || status === 'unsupported' || status === 'server-disabled') {
    return null;
  }

  const handleSubscribe = async () => {
    const ok = await subscribe();
    if (ok) {
      toast({
        title: '🔔 Notificaciones activadas',
        description: 'Este dispositivo recibirá las notificaciones de Panorámica.',
      });
    } else {
      toast({
        title: 'No se pudo activar',
        description:
          'Revisa que el permiso de notificaciones no esté bloqueado en el navegador.',
        variant: 'destructive',
      });
    }
  };

  const handleUnsubscribe = async () => {
    const ok = await unsubscribe();
    if (ok) {
      toast({
        title: 'Notificaciones desactivadas',
        description: 'Este dispositivo ya no recibirá notificaciones push.',
      });
    }
  };

  const handleTest = async () => {
    try {
      const sent = await sendTest();
      toast({
        title: sent > 0 ? 'Prueba enviada' : 'Sin dispositivos',
        description:
          sent > 0
            ? `Se envió una notificación de prueba a ${sent} dispositivo(s).`
            : 'No hay dispositivos suscritos para este usuario.',
      });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  // Permiso bloqueado a nivel navegador
  if (status === 'denied') {
    return (
      <Button
        variant="outline"
        className="rounded-2xl text-slate-500 dark:text-slate-400"
        onClick={() =>
          toast({
            title: 'Notificaciones bloqueadas',
            description:
              'Habilítalas en la configuración del navegador (Ajustes del sitio → Notificaciones) y recarga la página.',
          })
        }
        data-testid="button-push-denied"
      >
        <BellOff className="w-4 h-4 mr-2" />
        <span className="hidden sm:inline">Notificaciones bloqueadas</span>
        <span className="sm:hidden">Bloqueadas</span>
      </Button>
    );
  }

  // Activas en este dispositivo: pill con menú (probar / desactivar)
  if (status === 'subscribed') {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className="rounded-2xl border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 hover:border-emerald-300 transition-all"
            disabled={isBusy}
            data-testid="button-push-active"
          >
            <span className="relative flex h-2.5 w-2.5 mr-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
            <span className="hidden sm:inline">Notificaciones activas</span>
            <span className="sm:hidden">Activas</span>
            <ChevronDown className="w-3.5 h-3.5 ml-2 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="rounded-xl">
          <DropdownMenuItem onClick={handleTest} data-testid="menu-push-test">
            <Send className="w-4 h-4 mr-2" />
            Enviar notificación de prueba
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={handleUnsubscribe}
            className="text-red-600 focus:text-red-600"
            data-testid="menu-push-disable"
          >
            <BellOff className="w-4 h-4 mr-2" />
            Desactivar en este dispositivo
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  // 'unsubscribed' o 'ios-needs-install': CTA de activación
  return (
    <>
      <Button
        onClick={status === 'ios-needs-install' ? () => setShowIosDialog(true) : handleSubscribe}
        disabled={isBusy}
        className="rounded-2xl bg-gradient-to-r from-[#fd6301] to-[#fd6301] hover:from-[#e35400] hover:to-[#e35400] text-white shadow-md shadow-orange-500/25 transition-all"
        data-testid="button-push-subscribe"
      >
        {isBusy ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : (
          <BellRing className="w-4 h-4 mr-2" />
        )}
        <span className="hidden sm:inline">Activar notificaciones</span>
        <span className="sm:hidden">Activar</span>
      </Button>

      <Dialog open={showIosDialog} onOpenChange={setShowIosDialog}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/25 flex-shrink-0">
                <BellRing className="w-6 h-6 text-white" />
              </div>
              <DialogTitle className="text-left">Instala la app para recibir notificaciones</DialogTitle>
            </div>
            <DialogDescription className="text-left">
              En iPhone, las notificaciones solo funcionan con la app instalada en la
              pantalla de inicio. Toma menos de un minuto:
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="flex items-start gap-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700 rounded-2xl p-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-orange-50 dark:bg-orange-950/50 text-orange-600 flex-shrink-0">
                <Share className="h-4 w-4" />
              </div>
              <p className="text-sm text-slate-700 dark:text-slate-300 pt-1.5">
                <span className="font-semibold">1.</span> En Safari, toca el botón{' '}
                <span className="font-semibold">Compartir</span> (cuadrado con flecha hacia
                arriba).
              </p>
            </div>

            <div className="flex items-start gap-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700 rounded-2xl p-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-orange-50 dark:bg-orange-950/50 text-orange-600 flex-shrink-0">
                <SquarePlus className="h-4 w-4" />
              </div>
              <p className="text-sm text-slate-700 dark:text-slate-300 pt-1.5">
                <span className="font-semibold">2.</span> Baja en el menú y elige{' '}
                <span className="font-semibold">"Añadir a pantalla de inicio"</span>.
              </p>
            </div>

            <div className="flex items-start gap-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700 rounded-2xl p-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-orange-50 dark:bg-orange-950/50 text-orange-600 flex-shrink-0">
                <BellRing className="h-4 w-4" />
              </div>
              <p className="text-sm text-slate-700 dark:text-slate-300 pt-1.5">
                <span className="font-semibold">3.</span> Abre{' '}
                <span className="font-semibold">Panoramica</span> desde el nuevo ícono y
                vuelve a tocar "Activar notificaciones".
              </p>
            </div>
          </div>

          <p className="text-xs text-slate-400 dark:text-slate-500">
            Requiere iOS 16.4 o superior. En Android y computador no es necesario
            instalar: basta con aceptar el permiso.
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
