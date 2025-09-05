import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { 
  LayoutDashboard, 
  Upload, 
  FileText, 
  Users, 
  LogOut,
  Building2,
  Target
} from "lucide-react";
import { Link, useLocation } from "wouter";
import type { User } from "@shared/schema";

interface SidebarProps {
  onImportClick: () => void;
}

export default function Sidebar({ onImportClick }: SidebarProps) {
  const { user } = useAuth() as { user: User | null };
  const [location] = useLocation();

  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

  const getInitials = (firstName?: string | null, lastName?: string | null) => {
    const first = firstName?.charAt(0) || "";
    const last = lastName?.charAt(0) || "";
    return (first + last).toUpperCase() || "U";
  };

  const getDisplayName = (firstName?: string | null, lastName?: string | null) => {
    if (firstName && lastName) {
      return `${firstName} ${lastName}`;
    }
    if (firstName) return firstName;
    if (lastName) return lastName;
    return "Usuario";
  };

  return (
    <div className="fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-border">
      <div className="flex flex-col h-full">
        <div className="p-6 border-b border-border">
          <div className="flex items-center space-x-2">
            <Building2 className="w-6 h-6 text-primary" />
            <div>
              <h1 className="text-xl font-bold text-foreground">SalesAnalytics</h1>
              <p className="text-sm text-muted-foreground">Panel de Control</p>
            </div>
          </div>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          <Link href="/">
            <Button
              variant={location === "/" ? "secondary" : "ghost"}
              className="w-full justify-start"
              data-testid="nav-dashboard"
            >
              <LayoutDashboard className="w-5 h-5 mr-3" />
              Dashboard
            </Button>
          </Link>
          
          <Link href="/metas">
            <Button
              variant={location === "/metas" ? "secondary" : "ghost"}
              className="w-full justify-start"
              data-testid="nav-metas"
            >
              <Target className="w-5 h-5 mr-3" />
              Metas
            </Button>
          </Link>
          
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={onImportClick}
            data-testid="nav-import"
          >
            <Upload className="w-5 h-5 mr-3" />
            Importar Datos
          </Button>
          
          <Button
            variant="ghost"
            className="w-full justify-start"
            data-testid="nav-reports"
          >
            <FileText className="w-5 h-5 mr-3" />
            Reportes
          </Button>
          
          <Button
            variant="ghost"
            className="w-full justify-start"
            data-testid="nav-users"
          >
            <Users className="w-5 h-5 mr-3" />
            Usuarios
          </Button>
        </nav>
        
        <div className="p-4 border-t border-border">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
              <span className="text-xs font-medium text-primary-foreground">
                {getInitials(user?.firstName, user?.lastName)}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {getDisplayName(user?.firstName, user?.lastName)}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {user?.role === 'admin' ? 'Administrador' : 'Usuario'}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              data-testid="button-logout"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
