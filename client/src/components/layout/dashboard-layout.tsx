import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { 
  Upload, 
  LogOut,
  Building2,
  Menu,
  X,
  ChevronRight
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { useState } from "react";
import { SIDEBAR_CONFIG } from "@/config/sidebar-config";
import ImportModal from "@/components/dashboard/import-modal";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, logoutMutation } = useAuth();
  const [location] = useLocation();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  const handleLogout = () => {
    logoutMutation.mutate();
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

  const getRoleTitle = (role?: string | null) => {
    switch (role) {
      case 'admin': return 'Administrador';
      case 'supervisor': return 'Supervisor';
      case 'salesperson': return 'Vendedor';
      case 'client': return 'Cliente';
      default: return 'Usuario';
    }
  };

  const getRoleColor = (role?: string | null) => {
    switch (role) {
      case 'admin': return 'from-blue-500 to-indigo-600';
      case 'supervisor': return 'from-green-500 to-emerald-600';
      case 'salesperson': return 'from-purple-500 to-violet-600';
      case 'client': return 'from-orange-500 to-amber-600';
      default: return 'from-gray-500 to-slate-600';
    }
  };

  // Obtener configuración del sidebar según el rol
  const sidebarItems = SIDEBAR_CONFIG[user?.role || ''] || [];

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Menu Button - Top */}
      <Button
        variant="ghost"
        size="sm"
        className="fixed top-4 left-4 z-50 lg:hidden bg-white/90 backdrop-blur-sm border border-gray-200/60 shadow-lg rounded-xl p-2 hover:bg-white hover:shadow-xl transition-all"
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        data-testid="mobile-menu-toggle"
      >
        {isMobileOpen ? <X className="h-5 w-5 text-gray-700" /> : <Menu className="h-5 w-5 text-gray-700" />}
      </Button>

      {/* Mobile Menu Button - Floating Bottom Left */}
      <Button
        variant="default"
        size="lg"
        className="fixed bottom-6 left-6 z-50 lg:hidden bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-2xl rounded-full p-4 transition-all duration-300 hover:scale-110 hover:shadow-blue-500/25"
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        data-testid="mobile-menu-toggle-floating"
      >
        <ChevronRight className={`h-6 w-6 text-white transition-transform duration-300 ${
          isMobileOpen ? 'rotate-180' : ''
        }`} />
      </Button>

      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar Estático */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 border-r border-slate-700/50 transition-transform duration-300 lg:translate-x-0 ${
        isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-6 border-b border-slate-700/50">
            <div className="flex items-center space-x-3">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-r ${getRoleColor(user?.role)} flex items-center justify-center`}>
                <Building2 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">SalesAnalytics</h1>
                <p className="text-sm text-slate-400">Panel Profesional</p>
              </div>
            </div>
          </div>
        
          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1">
            {sidebarItems.map((item, index) => {
              const Icon = item.icon;
              const isActive = location === item.href;
              const itemKey = item.disabled ? `disabled-${index}` : item.href;
              
              if (item.disabled) {
                return (
                  <div key={itemKey}>
                    <Button
                      variant="ghost"
                      disabled={true}
                      className="w-full justify-start text-slate-300 opacity-60 cursor-not-allowed flex-col items-start p-3 h-auto"
                      data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      <div className="flex items-center w-full">
                        <Icon className="w-5 h-5 mr-3" />
                        {item.label}
                      </div>
                      {item.comingSoon && (
                        <span className="text-xs text-slate-500 ml-8">Próximamente</span>
                      )}
                    </Button>
                  </div>
                );
              }
              
              return (
                <Link key={item.href} href={item.href}>
                  <Button
                    variant="ghost"
                    className={`w-full justify-start text-slate-300 hover:text-white hover:bg-slate-800/50 ${
                      isActive ? "bg-slate-800 text-white" : ""
                    }`}
                    data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <Icon className="w-5 h-5 mr-3" />
                    {item.label}
                  </Button>
                </Link>
              );
            })}
            
            {/* Importar Datos - Solo Admin */}
            {user?.role === 'admin' && (
              <Button
                variant="ghost"
                className="w-full justify-start text-slate-300 hover:text-white hover:bg-slate-800/50"
                onClick={() => setShowImportModal(true)}
                data-testid="nav-import"
              >
                <Upload className="w-5 h-5 mr-3" />
                Importar Datos
              </Button>
            )}
          </nav>
          
          {/* Footer */}
          <div className="p-6 border-t border-slate-700/50">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center">
                <span className="text-xs font-medium text-white">
                  {getInitials(user?.firstName, user?.lastName)}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {getDisplayName(user?.firstName, user?.lastName)}
                </p>
                <p className="text-xs text-slate-400">{getRoleTitle(user?.role)}</p>
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              className="w-full justify-start text-slate-300 hover:text-white hover:bg-slate-800/50"
              onClick={handleLogout}
              data-testid="logout-button"
            >
              <LogOut className="w-4 h-4 mr-3" />
              Cerrar Sesión
            </Button>
          </div>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="lg:ml-64 transition-all duration-300">
        {children}
      </div>

      {/* Import Modal - Solo para Admin */}
      {user?.role === 'admin' && (
        <ImportModal 
          open={showImportModal} 
          onOpenChange={setShowImportModal}
        />
      )}
    </div>
  );
}