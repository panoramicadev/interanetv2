import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  TrendingUp,
  Wrench,
  Users,
  DollarSign,
  Calendar,
  Package,
  CalendarDays,
} from "lucide-react";

export interface CmmsNavItem {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  testId: string;
}

export const cmmsNavItems: CmmsNavItem[] = [
  {
    path: "/cmms",
    label: "Dashboard",
    icon: LayoutDashboard,
    testId: "nav-cmms-dashboard",
  },
  {
    path: "/cmms/mantenciones-planificadas",
    label: "Mantenciones Planificadas",
    icon: TrendingUp,
    testId: "nav-cmms-mantenciones-planificadas",
  },
  {
    path: "/cmms/equipos",
    label: "Equipos Críticos",
    icon: Wrench,
    testId: "nav-cmms-equipos",
  },
  {
    path: "/cmms/proveedores",
    label: "Proveedores",
    icon: Users,
    testId: "nav-cmms-proveedores",
  },
  {
    path: "/cmms/presupuesto",
    label: "Presupuesto",
    icon: DollarSign,
    testId: "nav-cmms-presupuesto",
  },
  {
    path: "/cmms/planes-preventivos",
    label: "Planes Preventivos",
    icon: Calendar,
    testId: "nav-cmms-planes-preventivos",
  },
  {
    path: "/cmms/gastos-materiales",
    label: "Gastos Materiales",
    icon: Package,
    testId: "nav-cmms-gastos-materiales",
  },
  {
    path: "/cmms/calendario",
    label: "Calendario",
    icon: CalendarDays,
    testId: "nav-cmms-calendario",
  },
];

export function CmmsNavigation() {
  const [location, setLocation] = useLocation();

  return (
    <nav className="border-b bg-muted/30 overflow-x-auto">
      <div className="flex gap-1 p-2">
        {cmmsNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.path || 
            (item.path === "/cmms" && location === "/cmms/dashboard");
          
          return (
            <Button
              key={item.path}
              variant={isActive ? "default" : "ghost"}
              size="sm"
              className={cn(
                "flex items-center gap-2 whitespace-nowrap",
                isActive && "bg-primary text-primary-foreground"
              )}
              onClick={() => setLocation(item.path)}
              data-testid={item.testId}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden md:inline">{item.label}</span>
              <span className="md:hidden">{item.label.split(' ')[0]}</span>
            </Button>
          );
        })}
      </div>
    </nav>
  );
}
