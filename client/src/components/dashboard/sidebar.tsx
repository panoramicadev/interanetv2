import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { 
  LayoutDashboard, 
  Upload, 
  FileText, 
  Users, 
  LogOut,
  Building2,
  Target,
  Menu,
  X,
  Settings,
  Package
} from "lucide-react";
import { Link, useLocation } from "wouter";
import type { User, SalespersonUser } from "@shared/schema";
import { useState } from "react";

interface SidebarProps {
  onImportClick: () => void;
}

export default function Sidebar({ onImportClick }: SidebarProps) {
  const { user } = useAuth() as { user: (User | SalespersonUser) | null };
  const [location] = useLocation();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

  const getInitials = (user: any) => {
    if (user?.salespersonName) {
      const parts = user.salespersonName.split(' ');
      return (parts[0]?.charAt(0) + (parts[1]?.charAt(0) || '')).toUpperCase();
    }
    const first = user?.firstName?.charAt(0) || "";
    const last = user?.lastName?.charAt(0) || "";
    return (first + last).toUpperCase() || "U";
  };

  const getDisplayName = (user: any) => {
    if (user?.salespersonName) {
      return user.salespersonName;
    }
    if (user?.firstName && user?.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    if (user?.firstName) return user.firstName;
    if (user?.lastName) return user.lastName;
    return "Usuario";
  };

  return (
    <>
      {/* Mobile Menu Button */}
      <Button
        variant="ghost"
        size="sm"
        className="fixed top-4 left-4 z-50 lg:hidden bg-white/90 backdrop-blur-sm border border-gray-200/60 shadow-lg rounded-xl p-2 hover:bg-white hover:shadow-xl transition-all"
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        data-testid="mobile-menu-toggle"
      >
        {isMobileOpen ? <X className="h-5 w-5 text-gray-700" /> : <Menu className="h-5 w-5 text-gray-700" />}
      </Button>

      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 border-r border-slate-700/50 transition-transform duration-300 lg:translate-x-0 ${
        isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}>
        <div className="flex flex-col h-full">
          <div className="p-6 border-b border-slate-700/50">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 flex items-center justify-center">
                <Building2 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">SalesAnalytics</h1>
                <p className="text-sm text-slate-400">Panel Profesional</p>
              </div>
            </div>
          </div>
        
        <nav className="flex-1 p-4 space-y-1">
          <Link href="/">
            <Button
              variant="ghost"
              className={`w-full justify-start text-slate-300 hover:text-white hover:bg-slate-800/50 ${
                location === "/" ? "bg-slate-800 text-white" : ""
              }`}
              data-testid="nav-dashboard"
            >
              <LayoutDashboard className="w-5 h-5 mr-3" />
              Dashboard
            </Button>
          </Link>
          
          <Link href="/metas">
            <Button
              variant="ghost"
              className={`w-full justify-start text-slate-300 hover:text-white hover:bg-slate-800/50 ${
                location === "/metas" ? "bg-slate-800 text-white" : ""
              }`}
              data-testid="nav-metas"
            >
              <Target className="w-5 h-5 mr-3" />
              Metas
            </Button>
          </Link>
          
          <Button
            variant="ghost"
            className="w-full justify-start text-slate-300 hover:text-white hover:bg-slate-800/50"
            onClick={onImportClick}
            data-testid="nav-import"
          >
            <Upload className="w-5 h-5 mr-3" />
            Importar Datos
          </Button>
          
          <Button
            variant="ghost"
            className="w-full justify-start text-slate-300 hover:text-white hover:bg-slate-800/50"
            data-testid="nav-reports"
          >
            <FileText className="w-5 h-5 mr-3" />
            Reportes
          </Button>
          
          {user?.role === 'admin' && (
            <>
              <Link href="/usuarios">
                <Button
                  variant="ghost"
                  className={`w-full justify-start text-slate-300 hover:text-white hover:bg-slate-800/50 ${
                    location === "/usuarios" ? "bg-slate-800 text-white" : ""
                  }`}
                  data-testid="nav-users"
                >
                  <Settings className="w-5 h-5 mr-3" />
                  Gestión de Usuarios
                </Button>
              </Link>
              
              <Link href="/productos">
                <Button
                  variant="ghost"
                  className={`w-full justify-start text-slate-300 hover:text-white hover:bg-slate-800/50 ${
                    location === "/productos" ? "bg-slate-800 text-white" : ""
                  }`}
                  data-testid="nav-products"
                >
                  <Package className="w-5 h-5 mr-3" />
                  Gestión de Productos
                </Button>
              </Link>
            </>
          )}
        </nav>
        
        <div className="p-4 border-t border-slate-700/50">
          {user ? (
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                <span className="text-xs font-medium text-white">
                  {getInitials(user)}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {getDisplayName(user)}
                </p>
                <p className="text-xs text-slate-400 truncate">
                  {user?.role === 'admin' ? 'Administrador' : 
                   user?.role === 'supervisor' ? 'Supervisor' : 
                   user?.role === 'salesperson' ? 'Vendedor' : 'Usuario'}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-slate-400 hover:text-white hover:bg-slate-800/50"
                onClick={handleLogout}
                data-testid="logout-button"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-slate-400 text-center">No autenticado</p>
              <Button 
                onClick={() => window.location.href = "/api/login"}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs"
                size="sm"
                data-testid="login-button"
              >
                Iniciar Sesión
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
    </>
  );
}
