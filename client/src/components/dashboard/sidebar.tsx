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
  Package,
  Calculator,
  Palette,
  Wrench,
  Receipt,
  AlertTriangle,
  CalendarCheck,
  Megaphone,
  ExternalLink
} from "lucide-react";
import { Link, useLocation } from "wouter";
import type { User, SalespersonUser } from "@shared/schema";
import { useState } from "react";
import logoPath from "@assets/logo_1757523053833.png";

interface SidebarProps {
  onImportClick: () => void;
}

export default function Sidebar({ onImportClick }: SidebarProps) {
  const { user, logoutMutation } = useAuth() as {
    user: (User | SalespersonUser) | null;
    logoutMutation: any;
  };
  const [location] = useLocation();
  const [, setLocation] = useLocation();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const handleLogout = () => {
    logoutMutation.mutate();
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
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 border-r border-slate-700/50 transition-transform duration-300 lg:translate-x-0 ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}>
        <div className="flex flex-col h-full">
          <div className="p-6 border-b border-slate-700/50">
            <div className="flex items-center space-x-3">
              <div className="w-14 h-14 flex items-center justify-center">
                <img
                  src={logoPath}
                  alt="PANORAMICA Logo"
                  className="w-14 h-14 object-contain"
                />
              </div>
            </div>
          </div>

          <nav className="flex-1 p-4 space-y-1">
            {user?.role === 'tecnico_obra' ? (
              // Técnico de Obra ve Visitas Técnicas y Reclamos Generales
              <>
                <Link href="/visitas-tecnicas">
                  <Button
                    variant="ghost"
                    className={`w-full justify-start text-slate-300 hover:text-white hover:bg-slate-800/50 ${location === "/visitas-tecnicas" ? "bg-slate-800 text-white" : ""
                      }`}
                    data-testid="nav-visitas-tecnicas"
                  >
                    <Wrench className="w-5 h-5 mr-3" />
                    Visitas Técnicas
                  </Button>
                </Link>

                <Link href="/reclamos-generales">
                  <Button
                    variant="ghost"
                    className={`w-full justify-start text-slate-300 hover:text-white hover:bg-slate-800/50 ${location === "/reclamos-generales" ? "bg-slate-800 text-white" : ""
                      }`}
                    data-testid="nav-reclamos-generales"
                  >
                    <AlertTriangle className="w-5 h-5 mr-3" />
                    Reclamos Generales
                  </Button>
                </Link>
              </>
            ) : (user?.role === 'produccion' ||
              user?.role === 'logistica_bodega' ||
              user?.role === 'planificacion' ||
              user?.role === 'bodega_materias_primas' ||
              user?.role === 'prevencion_riesgos') ? (
              // Roles organizacionales solo ven Reclamos Generales
              <>
                <Link href="/reclamos-generales">
                  <Button
                    variant="ghost"
                    className={`w-full justify-start text-slate-300 hover:text-white hover:bg-slate-800/50 ${location === "/reclamos-generales" ? "bg-slate-800 text-white" : ""
                      }`}
                    data-testid="nav-reclamos-generales"
                  >
                    <AlertTriangle className="w-5 h-5 mr-3" />
                    Reclamos Generales
                  </Button>
                </Link>
              </>
            ) : (
              // Otros roles ven el menú completo
              <>
                <Link href="/">
                  <Button
                    variant="ghost"
                    className={`w-full justify-start text-slate-300 hover:text-white hover:bg-slate-800/50 ${location === "/" ? "bg-slate-800 text-white" : ""
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
                    className={`w-full justify-start text-slate-300 hover:text-white hover:bg-slate-800/50 ${location === "/metas" ? "bg-slate-800 text-white" : ""
                      }`}
                    data-testid="nav-metas"
                  >
                    <Target className="w-5 h-5 mr-3" />
                    Metas
                  </Button>
                </Link>

                {['admin', 'supervisor', 'salesperson'].includes(user?.role || '') && (
                  <Link href="/promesas-compra">
                    <Button
                      variant="ghost"
                      className={`w-full justify-start text-slate-300 hover:text-white hover:bg-slate-800/50 ${location === "/promesas-compra" ? "bg-slate-800 text-white" : ""
                        }`}
                      data-testid="nav-promesas-compra"
                    >
                      <CalendarCheck className="w-5 h-5 mr-3" />
                      Promesas de Compra
                    </Button>
                  </Link>
                )}

                {user?.role === 'salesperson' && (user as SalespersonUser)?.publicSlug && (
                  <a
                    href={`/catalogo/${(user as SalespersonUser).publicSlug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button
                      variant="ghost"
                      className="w-full justify-start text-slate-300 hover:text-white hover:bg-slate-800/50"
                      data-testid="nav-mi-catalogo"
                    >
                      <ExternalLink className="w-5 h-5 mr-3" />
                      Mi Catálogo
                    </Button>
                  </a>
                )}

                <Link href="/facturas">
                  <Button
                    variant="ghost"
                    className={`w-full justify-start text-slate-300 hover:text-white hover:bg-slate-800/50 ${location === "/facturas" ? "bg-slate-800 text-white" : ""
                      }`}
                    data-testid="nav-facturas"
                  >
                    <Receipt className="w-5 h-5 mr-3" />
                    Facturas
                  </Button>
                </Link>

                <Link href="/inventario">
                  <Button
                    variant="ghost"
                    className={`w-full justify-start text-slate-300 hover:text-white hover:bg-slate-800/50 ${location === "/inventario" ? "bg-slate-800 text-white" : ""
                      }`}
                    data-testid="nav-inventario"
                  >
                    <Package className="w-5 h-5 mr-3" />
                    Inventario
                  </Button>
                </Link>

                {['admin', 'supervisor', 'salesperson', 'marketing'].includes(user?.role || '') && (
                  <Link href="/marketing">
                    <Button
                      variant="ghost"
                      className={`w-full justify-start text-slate-300 hover:text-white hover:bg-slate-800/50 ${location === "/marketing" ? "bg-slate-800 text-white" : ""
                        }`}
                      data-testid="nav-marketing"
                    >
                      <Megaphone className="w-5 h-5 mr-3" />
                      Marketing
                    </Button>
                  </Link>
                )}

                {user?.role === 'admin' && (
                  <>
                    <Link href="/visitas-tecnicas">
                      <Button
                        variant="ghost"
                        className={`w-full justify-start text-slate-300 hover:text-white hover:bg-slate-800/50 ${location === "/visitas-tecnicas" ? "bg-slate-800 text-white" : ""
                          }`}
                        data-testid="nav-visitas-tecnicas"
                      >
                        <Wrench className="w-5 h-5 mr-3" />
                        Visitas Técnicas
                      </Button>
                    </Link>

                    <Link href="/reclamos-generales">
                      <Button
                        variant="ghost"
                        className={`w-full justify-start text-slate-300 hover:text-white hover:bg-slate-800/50 ${location === "/reclamos-generales" ? "bg-slate-800 text-white" : ""
                          }`}
                        data-testid="nav-reclamos-generales-admin"
                      >
                        <AlertTriangle className="w-5 h-5 mr-3" />
                        Reclamos Generales
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
                  </>
                )}

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
                        className={`w-full justify-start text-slate-300 hover:text-white hover:bg-slate-800/50 ${location === "/usuarios" ? "bg-slate-800 text-white" : ""
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
                        className={`w-full justify-start text-slate-300 hover:text-white hover:bg-slate-800/50 ${location === "/productos" ? "bg-slate-800 text-white" : ""
                          }`}
                        data-testid="nav-products"
                      >
                        <Package className="w-5 h-5 mr-3" />
                        Gestión de Productos
                      </Button>
                    </Link>
                  </>
                )}

                {/* Divider */}
                <div className="border-t border-slate-700/50 my-2"></div>

                {/* New Tools Section */}
                <Button
                  variant="ghost"
                  className="w-full text-slate-400 hover:text-slate-300 cursor-not-allowed flex-col items-start p-3 h-auto"
                  disabled
                >
                  <div className="flex items-center w-full">
                    <Calculator className="w-5 h-5 mr-3" />
                    Crear Presupuesto
                  </div>
                  <span className="text-xs text-slate-500 ml-8">Próximamente</span>
                </Button>

                <Button
                  variant="ghost"
                  className="w-full text-slate-400 hover:text-slate-300 cursor-not-allowed flex-col items-start p-3 h-auto"
                  disabled
                >
                  <div className="flex items-center w-full">
                    <Palette className="w-5 h-5 mr-3" />
                    Calcular Tintometría
                  </div>
                  <span className="text-xs text-slate-500 ml-8">Próximamente</span>
                </Button>

                <Button
                  variant="ghost"
                  className="w-full text-slate-400 hover:text-slate-300 cursor-not-allowed flex-col items-start p-3 h-auto"
                  disabled
                >
                  <div className="flex items-center w-full">
                    <Package className="w-5 h-5 mr-3" />
                    Revisión de Stock
                  </div>
                  <span className="text-xs text-slate-500 ml-8">Próximamente</span>
                </Button>

                <Button
                  variant="ghost"
                  className="w-full text-slate-400 hover:text-slate-300 cursor-not-allowed flex-col items-start p-3 h-auto"
                  disabled
                >
                  <div className="flex items-center w-full">
                    <Wrench className="w-5 h-5 mr-3" />
                    Herramientas de Venta
                  </div>
                  <span className="text-xs text-slate-500 ml-8">Próximamente</span>
                </Button>
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
                        user?.role === 'salesperson' ? 'Vendedor' :
                          user?.role === 'tecnico_obra' ? 'Técnico de Obra' :
                            user?.role === 'laboratorio' ? 'Laboratorio' :
                              user?.role === 'produccion' ? 'Producción' :
                                user?.role === 'logistica_bodega' ? 'Logística y Bodega' :
                                  user?.role === 'planificacion' ? 'Planificación' :
                                    user?.role === 'bodega_materias_primas' ? 'Bodega Materias Primas' :
                                      user?.role === 'prevencion_riesgos' ? 'Prevención de Riesgos' :
                                        user?.role === 'marketing' ? 'Marketing' :
                                          user?.role === 'client' ? 'Cliente' :
                                            user?.role === 'reception' ? 'Recepción' : 'Usuario'}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5 font-mono">
                    {(__COMMIT_DATE__)} - {(__COMMIT_HASH__)}
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
                  onClick={() => setLocation("/login")}
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
