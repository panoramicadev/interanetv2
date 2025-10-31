import { useState } from 'react';
import { Bell } from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Link } from 'wouter';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

interface Notification {
  id: string;
  targetType: string;
  title: string;
  message: string;
  priority: string;
  type: string;
  createdAt: string;
  hasRead?: boolean;
  actionUrl?: string;
}

export default function FloatingNotificationBell() {
  const [open, setOpen] = useState(false);

  // Fetch unread count
  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ['/api/notifications/unread-count'],
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const unreadCount = unreadData?.count || 0;

  // Fetch latest notifications (unarchived)
  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ['/api/notifications', { isArchived: 'false' }],
    enabled: open, // Only fetch when dropdown is open
  });

  // Mark as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      return await apiRequest(`/api/notifications/${notificationId}/read`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/unread-count'] });
    },
  });

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.hasRead) {
      markAsReadMutation.mutate(notification.id);
    }
    setOpen(false);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critica':
        return 'bg-red-500';
      case 'alta':
        return 'bg-orange-500';
      case 'media':
        return 'bg-yellow-500';
      case 'baja':
        return 'bg-blue-500';
      default:
        return 'bg-gray-500';
    }
  };

  const latestNotifications = Array.isArray(notifications) ? notifications.slice(0, 5) : [];

  return (
    <div className="fixed top-4 right-4 z-50">
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            size="icon"
            className="relative w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-lg hover:shadow-xl transition-all duration-200"
            data-testid="floating-notification-bell"
          >
            <Bell className="w-6 h-6" />
            {unreadCount > 0 && (
              <Badge
                variant="destructive"
                className="absolute -top-1 -right-1 h-6 w-6 flex items-center justify-center p-0 text-xs font-bold"
                data-testid="floating-notification-badge"
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-80 max-h-[500px] overflow-y-auto">
          <DropdownMenuLabel className="flex items-center justify-between">
            <span>Notificaciones</span>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                {unreadCount} nuevas
              </Badge>
            )}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />

          {latestNotifications.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No hay notificaciones
            </div>
          ) : (
            <>
              {latestNotifications.map((notification: Notification) => (
                <DropdownMenuItem
                  key={notification.id}
                  className={`flex flex-col items-start gap-1 p-3 cursor-pointer ${
                    !notification.hasRead ? 'bg-blue-50 dark:bg-blue-950/20' : ''
                  }`}
                  onClick={() => handleNotificationClick(notification)}
                  data-testid={`floating-notification-item-${notification.id}`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-medium text-sm">{notification.title}</span>
                    <span className={`h-2 w-2 rounded-full ${getPriorityColor(notification.priority)}`} />
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {notification.message}
                  </p>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(notification.createdAt), {
                      addSuffix: true,
                      locale: es,
                    })}
                  </span>
                </DropdownMenuItem>
              ))}

              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/notificaciones">
                  <div className="w-full text-center text-sm text-primary cursor-pointer">
                    Ver todas las notificaciones
                  </div>
                </Link>
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
