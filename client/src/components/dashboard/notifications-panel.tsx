import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bell, X, AlertCircle, Clock, TrendingUp, Target, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Card, CardContent } from "@/components/ui/card";

interface Notification {
  id?: string;
  type: string;
  priority: string;
  title: string;
  message: string;
  actionText?: string;
  data?: any;
  icon?: string;
  details?: string;
  actionUrl?: string;
  createdAt?: string;
}

interface NotificationsPanelProps {
  salespersonName: string;
  salespersonId: string;
}

export default function NotificationsPanel({ salespersonName, salespersonId }: NotificationsPanelProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Fetch notificaciones
  const { data: notifications, isLoading } = useQuery({
    queryKey: [`/api/alerts/salesperson/${salespersonName}`],
    enabled: !!salespersonName,
    refetchInterval: 5 * 60 * 1000, // Actualizar cada 5 minutos
  });

  const notificationsList: Notification[] = notifications || [];

  const getIcon = (type: string, icon?: string) => {
    if (icon) return icon;
    
    switch (type) {
      case 'inactive_client':
        return '😴';
      case 'recurring_client':
        return '🔄';
      case 'goal_risk':
        return '⚠️';
      case 'opportunity':
        return '🎯';
      case 'high_value':
        return '💎';
      case 'seasonal_pattern':
        return '📅';
      case 'cross_sell':
        return '🛍️';
      default:
        return '📢';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-500';
      case 'medium':
        return 'bg-yellow-500';
      case 'low':
        return 'bg-blue-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'inactive_client':
        return 'border-l-orange-400 bg-orange-50';
      case 'recurring_client':
        return 'border-l-green-400 bg-green-50';
      case 'goal_risk':
        return 'border-l-red-400 bg-red-50';
      case 'opportunity':
        return 'border-l-blue-400 bg-blue-50';
      case 'high_value':
        return 'border-l-purple-400 bg-purple-50';
      case 'seasonal_pattern':
        return 'border-l-indigo-400 bg-indigo-50';
      case 'cross_sell':
        return 'border-l-teal-400 bg-teal-50';
      default:
        return 'border-l-gray-400 bg-gray-50';
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="relative" size="sm">
          <Bell className="h-4 w-4" />
          {notificationsList.length > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs"
            >
              {notificationsList.length}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <div className="bg-white rounded-lg shadow-lg border">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">
                Notificaciones Inteligentes
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsOpen(false)}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Content */}
          <div className="max-h-96 overflow-y-auto">
            {isLoading ? (
              <div className="p-4 text-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-sm text-gray-500 mt-2">Cargando alertas...</p>
              </div>
            ) : notificationsList.length === 0 ? (
              <div className="p-6 text-center">
                <Bell className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-500 mb-1">No hay notificaciones</p>
                <p className="text-xs text-gray-400">Te notificaremos sobre oportunidades importantes</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {notificationsList.map((notification, index) => (
                  <div 
                    key={notification.id || index} 
                    className={`p-4 border-l-4 ${getTypeColor(notification.type)} hover:bg-gray-50 transition-colors`}
                  >
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 text-lg">
                        {getIcon(notification.type, notification.icon)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <h4 className="text-sm font-medium text-gray-900 truncate">
                            {notification.title}
                          </h4>
                          <div 
                            className={`w-2 h-2 rounded-full ${getPriorityColor(notification.priority)}`}
                            title={`Prioridad: ${notification.priority}`}
                          />
                        </div>
                        <p className="text-sm text-gray-600 mt-1 leading-relaxed">
                          {notification.message}
                        </p>
                        {notification.details && (
                          <p className="text-xs text-gray-500 mt-1">
                            {notification.details}
                          </p>
                        )}
                        {notification.actionText && (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="mt-2 h-7 text-xs"
                            onClick={() => {
                              if (notification.actionUrl) {
                                window.open(notification.actionUrl, '_blank');
                              }
                              setIsOpen(false);
                            }}
                          >
                            {notification.actionText}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {notificationsList.length > 0 && (
            <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
              <p className="text-xs text-gray-500 text-center">
                Actualizadas cada 5 minutos
              </p>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}