import { useQuery, useMutation } from '@tanstack/react-query';
import { Bell, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
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

export default function NotificationPanel() {
  // Fetch unread count
  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ['/api/notifications/unread-count'],
    refetchInterval: 30000,
  });

  const unreadCount = unreadData?.count || 0;

  // Fetch latest notifications
  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ['/api/notifications', { isArchived: 'false' }],
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

  const latestNotifications = Array.isArray(notifications) ? notifications.slice(0, 3) : [];

  return (
    <div className="border-t border-slate-700/50 bg-slate-900/50 p-3">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-medium text-slate-300">Notificaciones</span>
        </div>
        {unreadCount > 0 && (
          <Badge variant="destructive" className="h-5 px-2 text-xs">
            {unreadCount}
          </Badge>
        )}
      </div>

      <ScrollArea className="h-[200px]">
        {latestNotifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 text-xs py-6">
            <Clock className="w-8 h-8 mb-2 opacity-50" />
            <p>No hay notificaciones</p>
          </div>
        ) : (
          <div className="space-y-2">
            {latestNotifications.map((notification) => (
              <div
                key={notification.id}
                onClick={() => handleNotificationClick(notification)}
                className={`p-2 rounded-lg cursor-pointer transition-colors ${
                  !notification.hasRead
                    ? 'bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20'
                    : 'bg-slate-800/50 hover:bg-slate-800/80'
                }`}
                data-testid={`sidebar-notification-${notification.id}`}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <span className="text-xs font-medium text-slate-200 line-clamp-1">
                    {notification.title}
                  </span>
                  <span
                    className={`h-2 w-2 rounded-full flex-shrink-0 mt-1 ${getPriorityColor(
                      notification.priority
                    )}`}
                  />
                </div>
                <p className="text-xs text-slate-400 line-clamp-2 mb-1">
                  {notification.message}
                </p>
                <span className="text-xs text-slate-500">
                  {formatDistanceToNow(new Date(notification.createdAt), {
                    addSuffix: true,
                    locale: es,
                  })}
                </span>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      <Link href="/notificaciones">
        <Button
          variant="ghost"
          size="sm"
          className="w-full mt-3 text-xs text-blue-400 hover:text-blue-300 hover:bg-slate-800/50"
          data-testid="sidebar-view-all-notifications"
        >
          Ver todas las notificaciones
        </Button>
      </Link>
    </div>
  );
}
