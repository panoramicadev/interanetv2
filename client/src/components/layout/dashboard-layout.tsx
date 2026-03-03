import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  Upload,
  LogOut,
  Menu,
  ChevronDown,
  RefreshCw,
  Sparkles
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { SIDEBAR_CONFIG } from "@/config/sidebar-config";
import ImportModal from "@/components/dashboard/import-modal";
import ChangelogDialog from "@/components/ChangelogDialog";
import logoPath from "@assets/logo_1757532115858.png";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, logoutMutation } = useAuth();
  const [location] = useLocation();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showChangelogDialog, setShowChangelogDialog] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const handleLogout = () => logoutMutation.mutate();

  const toggleSubmenu = (itemHref: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      next.has(itemHref) ? next.delete(itemHref) : next.add(itemHref);
      return next;
    });
  };

  const getInitials = (firstName?: string | null, lastName?: string | null) => {
    return ((firstName?.charAt(0) || "") + (lastName?.charAt(0) || "")).toUpperCase() || "U";
  };

  const getDisplayName = (firstName?: string | null, lastName?: string | null) => {
    if (firstName && lastName) return `${firstName} ${lastName}`;
    return firstName || lastName || "Usuario";
  };

  const getRoleTitle = (role?: string | null) => {
    const map: Record<string, string> = {
      admin: "Administrador",
      supervisor: "Supervisor",
      salesperson: "Vendedor",
      client: "Cliente",
    };
    return map[role || ""] || "Usuario";
  };

  const getRoleColor = (role?: string | null) => {
    const map: Record<string, string> = {
      admin: "bg-blue-500",
      supervisor: "bg-emerald-500",
      salesperson: "bg-violet-500",
      client: "bg-amber-500",
    };
    return map[role || ""] || "bg-slate-500";
  };

  const sidebarItems = SIDEBAR_CONFIG[user?.role || ""] || [];

  const { data: unreadCount = 0 } = useQuery<number>({
    queryKey: ["/api/notifications/unread-count"],
    refetchInterval: 30000,
    enabled: !!user,
  });

  // Each nav item rendered
  const NavItem = ({ item, index }: { item: any; index: number }) => {
    const Icon = item.icon;
    const isActive = location === item.href;
    const isNotif = item.href === "/notificaciones";
    const isAi = item.href === "/ai-assistant";
    const isExpanded = expandedItems.has(item.href);
    const hasChildren = item.children && item.children.length > 0;

    if (item.disabled) {
      return (
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-slate-600 text-sm opacity-50 cursor-not-allowed">
          <Icon className="w-4 h-4 flex-shrink-0" />
          <span className="flex-1">{item.label}</span>
          {item.comingSoon && (
            <span className="text-[10px] text-slate-600 bg-slate-800 px-1.5 py-0.5 rounded">Pronto</span>
          )}
        </div>
      );
    }

    if (hasChildren) {
      return (
        <div>
          <button
            onClick={() => toggleSubmenu(item.href)}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-200 hover:text-white hover:bg-slate-700/60 transition-all duration-150"
            data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
          >
            <Icon className="w-4 h-4 flex-shrink-0 text-slate-400" />
            <span className="flex-1 text-left">{item.label}</span>
            <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
          </button>

          {isExpanded && (
            <div className="mt-1 ml-4 pl-3 border-l border-slate-600/50 space-y-0.5 mb-1">
              {item.children?.map((child: any) => {
                const ChildIcon = child.icon;
                const isChildActive = location === child.href || (child.href !== "/mantenciones" && location.startsWith(child.href + "/"));
                return (
                  <Link key={child.href} href={child.href}>
                    <button
                      onClick={() => setIsMobileOpen(false)}
                      className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg text-sm transition-all duration-150
                        ${isChildActive ? "text-white bg-white/10" : "text-slate-300 hover:text-white hover:bg-slate-700/60"}`}
                      data-testid={`nav-submenu-${child.label.toLowerCase().replace(/\s+/g, "-")}`}
                    >
                      <ChildIcon className="w-3.5 h-3.5 flex-shrink-0" />
                      {child.label}
                    </button>
                  </Link>
                );
              })}
            </div>
          )}
          {item.separator && <div className="h-px bg-slate-700/40 my-1 mx-2" />}
        </div>
      );
    }

    if ((item as any).isExternalCatalog) {
      if (!(user as any)?.publicSlug) return null;
      return (
        <a href={`/catalogo/${(user as any).publicSlug}`} target="_blank" rel="noopener noreferrer">
          <button
            onClick={() => setIsMobileOpen(false)}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-slate-400 hover:text-white hover:bg-[#1e2a3a] transition-all duration-150"
            data-testid="nav-mi-catalogo"
          >
            <Icon className="w-4 h-4 flex-shrink-0 text-slate-400" />
            {item.label}
          </button>
        </a>
      );
    }

    return (
      <div>
        <Link href={item.href}>
          <button
            onClick={() => setIsMobileOpen(false)}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 relative group
              ${isAi
                ? isActive
                  ? "text-blue-400 bg-blue-500/10 border border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.1)]"
                  : "text-blue-400/80 hover:text-blue-300 hover:bg-blue-500/10"
                : isNotif
                  ? isActive ? "text-amber-300 bg-amber-500/20" : "text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
                  : isActive ? "text-white bg-white/10" : "text-slate-200 hover:text-white hover:bg-slate-700/60"
              }`}
            data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
          >
            <Icon className={`w-4 h-4 flex-shrink-0 transition-transform group-hover:scale-110 ${isAi
              ? "text-blue-500"
              : isActive && !isNotif ? "text-white" : "text-slate-400"
              }`}
            />
            <span className={`flex-1 text-left ${isAi ? "font-bold tracking-tight" : ""}`}>
              {item.label}
            </span>
            {isAi && (
              <span className="flex h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.8)]"></span>
            )}
            {isNotif && unreadCount > 0 && (
              <span
                className="min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-500 rounded-full flex items-center justify-center"
                data-testid="notification-badge"
              >
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>
        </Link>
        {item.separator && <div className="h-px bg-slate-700/40 my-1.5 mx-2" />}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Button */}
      <button
        className="fixed bottom-5 left-5 z-50 lg:hidden w-10 h-10 bg-[#0f1724] border border-slate-700 rounded-full flex items-center justify-center shadow-lg"
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        data-testid="mobile-menu-toggle-floating"
      >
        <Menu className="h-4 w-4 text-slate-300" />
      </button>

      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-[#0f1724] flex flex-col transition-transform duration-300 lg:translate-x-0 ${isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
          }`}
      >
        {/* Logo */}
        <div className="px-4 pt-5 pb-4 flex items-center justify-center flex-shrink-0">
          <button
            className="hover:opacity-80 transition-opacity"
            onClick={() => {
              window.dispatchEvent(new CustomEvent("reset-dashboard"));
              window.location.href = "/";
            }}
          >
            <img src={logoPath} alt="PANORAMICA" className="h-14 w-auto object-contain" />
          </button>
        </div>

        {/* Navigation — items in card sections */}
        <nav className="flex-1 px-4 pb-4 space-y-0.5 overflow-y-auto overscroll-contain scrollbar-hide">
          {sidebarItems.map((item, index) => (
            <NavItem key={item.disabled ? `disabled-${index}` : item.href} item={item} index={index} />
          ))}

          {user?.role === "admin" && (
            <button
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-slate-200 hover:text-white hover:bg-slate-700/60 transition-all duration-150"
              onClick={() => {
                setShowImportModal(true);
                setIsMobileOpen(false);
              }}
              data-testid="nav-import"
            >
              <Upload className="w-4 h-4 flex-shrink-0 text-slate-500" />
              Importar Datos
            </button>
          )}
        </nav>

        {/* User card — at bottom */}
        <div className="px-4 py-3 flex-shrink-0 border-t border-slate-700/40">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl ${getRoleColor(user?.role)} flex items-center justify-center flex-shrink-0`}>
              <span className="text-sm font-bold text-white">
                {getInitials(user?.firstName, user?.lastName)}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate leading-tight">
                {getDisplayName(user?.firstName, user?.lastName)}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">{getRoleTitle(user?.role)}</p>
            </div>
            <button
              className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all duration-150"
              onClick={() => {
                setIsMobileOpen(false);
                handleLogout();
              }}
              data-testid="logout-button"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="lg:ml-64 transition-all duration-300">
        {children}
      </div >

      {/* Modals */}
      {
        user?.role === "admin" && (
          <ImportModal open={showImportModal} onOpenChange={setShowImportModal} />
        )
      }
      <ChangelogDialog open={showChangelogDialog} onOpenChange={setShowChangelogDialog} />
    </div >
  );
}