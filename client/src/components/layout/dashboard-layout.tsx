import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  Upload,
  LogOut,
  Menu,
  ChevronDown,
  RefreshCw,
  Sparkles,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePermissions } from "@/hooks/usePermissions";
import { buildSidebarItems } from "@/lib/sidebar-permissions";
import ImportModal from "@/components/dashboard/import-modal";
import ChangelogDialog from "@/components/ChangelogDialog";
import logoPath from "@assets/logo_1757532115858.png";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

/* Botón del menú en móvil: arriba o abajo.
 *
 * Por defecto va en una barra fija al pie de la pantalla (ver el render). La excepción es
 * una página que ya tiene su propia barra superior móvil con el logo — hoy solo el
 * Dashboard principal —: ahí el botón vuelve al círculo de arriba a la izquierda, calzado
 * con esa barra. Esa página lo pide con `useBotonMenuArriba()` en vez de que el shell
 * adivine la ruta o el rol, que cambian con el tiempo. */
const BotonMenuArribaContext = createContext<(claimed: boolean) => void>(() => {});

export function useBotonMenuArriba(activo: boolean = true) {
  const claim = useContext(BotonMenuArribaContext);
  useEffect(() => {
    if (!activo) return;
    claim(true);
    return () => claim(false);
  }, [claim, activo]);
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, logoutMutation } = useAuth();
  const { can, permissions } = usePermissions();
  const [location] = useLocation();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showChangelogDialog, setShowChangelogDialog] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  // Lo prende la página que tiene barra superior propia (ver BotonMenuArribaContext).
  const [botonMenuArriba, setBotonMenuArriba] = useState(false);

  // Colapsar el sidebar a un rail de íconos (persistido por navegador). Solo aplica en desktop;
  // en móvil el drawer siempre se abre a ancho completo.
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem("sidebar_collapsed") === "1"; } catch { return false; }
  });
  const setCollapsed = (val: boolean) => {
    setIsCollapsed(val);
    try { localStorage.setItem("sidebar_collapsed", val ? "1" : "0"); } catch {}
  };
  const toggleCollapsed = () => setCollapsed(!isCollapsed);

  // Colapso efectivo: en móvil (drawer abierto) siempre expandido
  const collapsed = isCollapsed && !isMobileOpen;

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
      encargado_area: "Encargado de Área",
      salesperson: "Vendedor",
      marketing: "Marketing",
      recursos_humanos: "Recursos Humanos",
      tecnico_obra: "Técnico de Obra",
      client: "Cliente",
      reception: "Recepción",
    };
    return map[role || ""] || "Usuario";
  };

  const getSegmentLabel = (u?: typeof user) => {
    const raw = (u as any)?.assignedSegment ?? (u as any)?.segmento ?? (u as any)?.noruen;
    if (!raw || typeof raw !== "string") return null;
    const map: Record<string, string> = {
      ferreterias: "Ferretería",
      ferreteria: "Ferretería",
      construccion: "Construcción",
      digital: "Digital",
      industrial: "Industrial",
      marketing: "Marketing",
    };
    const key = raw.trim().toLowerCase();
    return map[key] || raw.trim().replace(/\b\w/g, (c) => c.toUpperCase());
  };

  // Avatar: foto de perfil si existe, si no un círculo naranja con las iniciales
  const UserAvatar = ({ size = "w-9 h-9" }: { size?: string }) => {
    const photo = (user as any)?.profileImageUrl as string | undefined;
    if (photo) {
      return (
        <img
          src={photo}
          alt={getDisplayName(user?.firstName, user?.lastName)}
          className={`${size} rounded-xl object-cover flex-shrink-0`}
        />
      );
    }
    return (
      <div className={`${size} rounded-xl bg-[#fd6301] flex items-center justify-center flex-shrink-0`}>
        <span className="text-sm font-bold text-white">
          {getInitials(user?.firstName, user?.lastName)}
        </span>
      </div>
    );
  };

  // Sidebar dinámico: base del rol filtrado por permisos efectivos
  // (configurables desde Configuración → Roles y Permisos).
  //
  // El segmento va aparte del rol porque el supervisor tiene un menú por área
  // (Construcción / Ferretería); para el resto de los roles se ignora.
  const assignedSegment = ((user as any)?.assignedSegment as string | null | undefined) ?? null;
  const sidebarItems = useMemo(
    () => buildSidebarItems(user?.role || undefined, can, { assignedSegment }),
    [user?.role, assignedSegment, can, permissions],
  );

  const { data: unreadCount = 0 } = useQuery<number>({
    queryKey: ["/api/notifications/unread-count"],
    refetchInterval: 30000,
    enabled: !!user,
  });

  const { data: pendingOrdersCountData } = useQuery<{count: number}>({
    queryKey: ["/api/ecommerce/orders/pending-count"],
    refetchInterval: 30000,
    enabled: !!user && ['admin', 'supervisor', 'encargado_area', 'salesperson'].includes(user.role || ''),
  });
  const pendingOrdersCount = pendingOrdersCountData?.count || 0;

  // Solicitudes de Marketing esperando respuesta: el número va en el propio ítem del
  // menú para que la encargada sepa que hay algo que atender sin entrar al módulo.
  // El ítem puede venir dentro del grupo "Marketing" (roles que tienen el módulo
  // entre varios) o suelto en el primer nivel (rol Marketing, que lo tiene plano).
  const hasMarketingInbox = useMemo(
    () =>
      sidebarItems.some(
        (item) =>
          item.href === "/marketing/solicitudes" ||
          item.children?.some((c) => c.href === "/marketing/solicitudes"),
      ),
    [sidebarItems],
  );
  const { data: marketingSolicitudes = [] } = useQuery<Array<{ estado: string }>>({
    queryKey: ["/api/marketing/solicitudes"],
    refetchInterval: 60000,
    enabled: !!user && hasMarketingInbox,
  });
  const marketingPorAceptar = marketingSolicitudes.filter((s) => s.estado === "solicitado").length;

  // Al entrar a una ruta que vive dentro de un grupo, el grupo se abre solo: si no,
  // el menú se ve colapsado y no se entiende dónde está uno parado.
  useEffect(() => {
    const grupoActivo = sidebarItems.find((item) =>
      item.children?.some((c) => location === c.href || location.startsWith(c.href + "/")),
    );
    if (!grupoActivo) return;
    setExpandedItems((prev) => (prev.has(grupoActivo.href) ? prev : new Set(prev).add(grupoActivo.href)));
  }, [location, sidebarItems]);

  // Each nav item rendered
  const NavItem = ({ item, index }: { item: any; index: number }) => {
    const Icon = item.icon;
    const isActive = location === item.href;
    const isNotif = item.href === "/notificaciones";
    const isAi = item.href === "/ai-assistant";
    // Bandeja de Marketing suelta en el primer nivel: lleva el mismo contador que
    // cuando cuelga del grupo "Marketing".
    const isMarketingInbox = item.href === "/marketing/solicitudes";
    const isPremium = item.isPremium;
    const isExpanded = expandedItems.has(item.href);
    const hasChildren = item.children && item.children.length > 0;
    const hasActiveChild = hasChildren && item.children.some(
      (c: any) => location === c.href || (c.href !== "/mantenciones" && location.startsWith(c.href + "/"))
    );
    const hasPendingChild = hasChildren &&
      ((pendingOrdersCount > 0 && item.children.some((c: any) => c.href === "/ecommerce-pedidos")) ||
        (marketingPorAceptar > 0 && item.children.some((c: any) => c.href === "/marketing/solicitudes")));

    if (item.disabled) {
      if (collapsed) {
        return (
          <div title={item.label} className="flex items-center justify-center py-2.5 rounded-xl text-slate-600 opacity-50 cursor-not-allowed">
            <Icon className="w-5 h-5 flex-shrink-0" />
          </div>
        );
      }
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
      // Rail colapsado: el grupo se muestra como ícono; al pulsar, expande el sidebar y abre el submenú
      if (collapsed) {
        return (
          <button
            title={item.label}
            onClick={() => {
              setCollapsed(false);
              if (!expandedItems.has(item.href)) toggleSubmenu(item.href);
            }}
            className={`relative w-full flex items-center justify-center py-3 rounded-xl transition-all duration-150 ${
              hasActiveChild
                ? "bg-[#fd6301] text-white shadow-md shadow-[#fd6301]/30"
                : isPremium ? "hover:bg-amber-500/10" : "text-slate-300 hover:text-white hover:bg-slate-800/70"
            }`}
            data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
            data-tour-children={item.children?.map((c: any) => c.href).join(" ")}
          >
            <Icon className={`w-5 h-5 flex-shrink-0 ${hasActiveChild ? "text-white" : isPremium ? "text-amber-400" : "text-slate-400"}`} />
            {hasPendingChild && (
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)] animate-pulse" />
            )}
          </button>
        );
      }
      return (
        <div>
          <button
            onClick={() => toggleSubmenu(item.href)}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
              isPremium
                ? "hover:bg-amber-500/10 group"
                : hasActiveChild
                  ? "text-white bg-slate-800/70"
                  : "text-slate-200 hover:text-white hover:bg-slate-800/70"
            }`}
            data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
            /* El tour guiado necesita saber qué módulos viven dentro del grupo:
               el anidamiento cambia según el rol y no se puede inferir del DOM
               cuando el submenú está cerrado. */
            data-tour-children={item.children?.map((c: any) => c.href).join(" ")}
          >
            <Icon className={`w-4 h-4 flex-shrink-0 ${isPremium ? "text-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.4)]" : hasActiveChild ? "text-white" : "text-slate-400"}`} />
            {isPremium ? (
              <span
                className="flex-1 text-left font-bold tracking-tight bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 bg-clip-text text-transparent drop-shadow-[0_0_8px_rgba(251,191,36,0.3)] animate-[shimmer_3s_ease-in-out_infinite] bg-[length:200%_100%]"
                style={{ WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}
              >
                {item.label}
              </span>
            ) : (
              <span className="flex-1 text-left">{item.label}</span>
            )}
            {hasPendingChild && !isExpanded && (
              <span className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)] animate-pulse" />
            )}
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""} ${isPremium ? "text-amber-400/60" : "text-slate-500"}`} />
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
                        ${isChildActive ? "text-white bg-[#fd6301] shadow-sm shadow-[#fd6301]/30" : "text-slate-300 hover:text-white hover:bg-slate-800/70"}`}
                      data-testid={`nav-submenu-${child.label.toLowerCase().replace(/\s+/g, "-")}`}
                    >
                      <ChildIcon className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="flex-1 text-left">{child.label}</span>
                      {child.href === "/ecommerce-pedidos" && pendingOrdersCount > 0 && (
                        <span className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)] animate-pulse"></span>
                      )}
                      {child.href === "/marketing/solicitudes" && marketingPorAceptar > 0 && (
                        <span
                          className={`flex-shrink-0 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold ${
                            isChildActive ? "bg-white text-[#fd6301]" : "bg-[#fd6301] text-white"
                          }`}
                          data-testid="badge-solicitudes-marketing"
                        >
                          {marketingPorAceptar}
                        </span>
                      )}
                    </button>
                  </Link>
                );
              })}
            </div>
          )}
          {item.separator && !collapsed && <div className="h-px bg-slate-700/40 my-1 mx-2" />}
        </div>
      );
    }

    if ((item as any).isExternalCatalog) {
      if (!(user as any)?.publicSlug) return null;
      return (
        <a href={`/catalogo/${(user as any).publicSlug}`} target="_blank" rel="noopener noreferrer">
          <button
            onClick={() => setIsMobileOpen(false)}
            title={collapsed ? item.label : undefined}
            className={`w-full flex items-center ${collapsed ? "justify-center py-3" : "gap-3 px-4 py-2.5"} rounded-xl text-sm text-slate-400 hover:text-white hover:bg-slate-800/70 transition-all duration-150`}
            data-testid="nav-mi-catalogo"
          >
            <Icon className={`${collapsed ? "w-5 h-5" : "w-4 h-4"} flex-shrink-0 text-slate-400`} />
            {!collapsed && item.label}
          </button>
        </a>
      );
    }

    // Rail colapsado: ítem simple como ícono con tooltip
    if (collapsed) {
      return (
        <div>
          <Link href={item.href}>
            <button
              onClick={() => setIsMobileOpen(false)}
              title={item.label}
              className={`relative w-full flex items-center justify-center py-3 rounded-xl transition-all duration-150 ${
                isActive
                  ? "bg-[#fd6301] text-white shadow-md shadow-[#fd6301]/30"
                  : isPremium ? "hover:bg-amber-500/10" : "text-slate-300 hover:text-white hover:bg-slate-800/70"
              }`}
              data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
            >
              <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? "text-white" : isPremium ? "text-amber-400" : "text-slate-400"}`} />
              {((isNotif && unreadCount > 0) || (isMarketingInbox && marketingPorAceptar > 0)) && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
              )}
            </button>
          </Link>
          {item.separator && <div className="h-px bg-slate-700/40 my-1.5 mx-2" />}
        </div>
      );
    }

    return (
      <div>
        <Link href={item.href}>
          <button
            onClick={() => setIsMobileOpen(false)}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 relative group
              ${isPremium
                ? isActive ? "bg-amber-500/15 group" : "hover:bg-amber-500/10 group"
                : isAi
                  ? isActive
                    ? "text-blue-400 bg-blue-500/10 border border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.1)]"
                    : "text-blue-400/80 hover:text-blue-300 hover:bg-blue-500/10"
                  : isNotif
                    ? isActive ? "text-amber-300 bg-amber-500/20" : "text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
                    : isActive ? "text-white bg-[#fd6301] shadow-md shadow-[#fd6301]/30" : "text-slate-200 hover:text-white hover:bg-slate-800/70"
              }`}
            data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
          >
            <Icon className={`w-4 h-4 flex-shrink-0 transition-transform group-hover:scale-110 ${isPremium
              ? "text-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.4)]"
              : isAi
                ? "text-blue-500"
                : isActive && !isNotif ? "text-white" : "text-slate-400"
              }`}
            />
            {isPremium ? (
              <span
                className="flex-1 text-left font-bold tracking-tight bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 bg-clip-text text-transparent drop-shadow-[0_0_8px_rgba(251,191,36,0.3)] animate-[shimmer_3s_ease-in-out_infinite] bg-[length:200%_100%]"
                style={{ WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}
              >
                {item.label}
              </span>
            ) : (
              <span className={`flex-1 text-left ${isAi ? "font-bold tracking-tight" : ""}`}>
                {item.label}
              </span>
            )}
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
            {isMarketingInbox && marketingPorAceptar > 0 && (
              <span
                className={`flex-shrink-0 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold ${
                  isActive ? "bg-white text-[#fd6301]" : "bg-[#fd6301] text-white"
                }`}
                data-testid="badge-solicitudes-marketing"
              >
                {marketingPorAceptar}
              </span>
            )}
          </button>
        </Link>
        {item.separator && <div className="h-px bg-slate-700/40 my-1.5 mx-2" />}
      </div>
    );
  };

  return (
    <BotonMenuArribaContext.Provider value={setBotonMenuArriba}>
    <div className="min-h-screen bg-white dark:bg-slate-900">
      {/* Botón del menú en móvil.
          Cuando la página tiene su propia barra superior con el logo (hoy solo el
          Dashboard principal, que lo reclama con `useBotonMenuArriba`), el botón va
          arriba a la izquierda, calzado con esa barra.
          ⚠️ El `top-[42px]` está calzado con el centro de la barra móvil del Dashboard
          (`pt-7` + fila de 4rem = centro en 60px, menos la mitad del botón). Si esa barra
          cambia de alto, de padding o el logo cambia de tamaño, hay que mover este número
          también.
          En el resto de los módulos (Panorámica Market, Panel de Trabajo, Tomador de
          Pedidos, Inventario…) no hay barra arriba: ahí el círculo caía justo encima del
          ícono y del título de la página y los tapaba (corrección del usuario, ago-2026),
          así que va en una barra blanca fija al pie, con línea de borde arriba. El módulo
          reserva ese alto con el `pb-[calc(3.5rem+…)]` del contenedor principal — los dos
          números van juntos.
          z-40 en las dos formas: por encima de las cabeceras pegajosas de las páginas
          (z-30), pero por debajo del menú cuando se abre — el sidebar también es z-40 y
          va después en el orden del documento, así que lo cubre. */}
      {botonMenuArriba ? (
        <button
          className="fixed top-[42px] left-4 z-40 lg:hidden w-9 h-9 bg-[#0a0a0a] rounded-full flex items-center justify-center shadow-md"
          onClick={() => setIsMobileOpen(!isMobileOpen)}
          aria-label="Abrir menú"
          data-testid="mobile-menu-toggle-floating"
        >
          <Menu className="h-4 w-4 text-white" />
        </button>
      ) : (
        <div
          className="fixed bottom-0 inset-x-0 z-40 lg:hidden bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shadow-[0_-4px_16px_rgba(15,23,42,0.06)] pb-[env(safe-area-inset-bottom)]"
          data-testid="mobile-menu-bar"
        >
          <div className="h-14 px-4 flex items-center">
            <button
              className="w-10 h-10 bg-[#0a0a0a] rounded-full flex items-center justify-center shadow-md active:scale-95 transition-transform"
              onClick={() => setIsMobileOpen(!isMobileOpen)}
              aria-label="Abrir menú"
              data-testid="mobile-menu-toggle-floating"
            >
              <Menu className="h-4 w-4 text-white" />
            </button>
          </div>
        </div>
      )}

      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-[35] bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar — tarjeta flotante
       *
       * Escala de z-index de la app (respetarla al agregar UI flotante):
       *   0-20  contenido: celdas/thead sticky dentro de una tarjeta
       *   30    chrome de página: headers sticky de módulo, barras fijas, FABs
       *   35    backdrop móvil de este sidebar
       *   40    el shell (este sidebar)
       *   50    modales: dialog, alert-dialog, sheet, drawer (base de shadcn)
       *   60+   flotantes portalados: select, popover, dropdown, tooltip, toast
       *
       * El sidebar va DEBAJO de la capa modal a propósito: antes estaba en z-[60]
       * y tapaba todos los diálogos, que además no lo oscurecían ni bloqueaban.
       * Si algo de la página queda encima del menú móvil, bajá ese elemento a
       * z-30 — no subas el sidebar.
       */}
      <div
        className={`fixed inset-y-0 left-0 z-40 ${collapsed ? "w-[4.25rem]" : "w-[16rem]"} transition-all duration-300 lg:translate-x-0 ${isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
          }`}
      >
      {/* El menú va a sangre: pegado arriba, abajo y a la izquierda, sin esquinas
          redondeadas (corrección del usuario, ago-2026). Antes flotaba con 12px de
          margen y `rounded-3xl`. Los anchos bajaron de 17.5rem/5.75rem a 16rem/4.25rem
          justamente porque ya no hay que descontar ese margen: el menú se ve del mismo
          ancho de siempre (256px / 68px). */}
      <div className="h-full flex flex-col bg-[#0a0a0a] shadow-xl shadow-slate-900/10 overflow-hidden">
        {/* Logo + collapse toggle */}
        <div className={`relative flex-shrink-0 ${collapsed ? "px-2 pt-5 pb-3 flex flex-col items-center gap-2" : "px-3 pt-5 pb-3 flex items-center justify-center"}`}>
          <button
            className="hover:opacity-80 transition-opacity"
            onClick={() => {
              window.dispatchEvent(new CustomEvent("reset-dashboard"));
              window.location.href = "/";
            }}
          >
            <img src={logoPath} alt="PANORAMICA" className={`${collapsed ? "h-9" : "h-11"} w-auto object-contain transition-all duration-300`} />
          </button>
          <button
            onClick={toggleCollapsed}
            className={`hidden lg:inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/70 transition-all duration-150 ${collapsed ? "" : "absolute right-3 top-1/2 -translate-y-1/2"}`}
            title={collapsed ? "Expandir menú" : "Colapsar menú"}
            data-testid="sidebar-collapse-toggle"
          >
            {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>
        </div>

        {/* Navigation */}
        <nav className={`flex-1 ${collapsed ? "px-2.5" : "px-4"} pt-1 pb-4 space-y-0.5 overflow-y-auto overscroll-contain scrollbar-hide`}>
          {sidebarItems.map((item, index) => (
            <NavItem key={item.disabled ? `disabled-${index}` : item.href} item={item} index={index} />
          ))}

          {can("config.importar") && (
            <button
              className={`w-full flex items-center ${collapsed ? "justify-center py-3" : "gap-3 px-4 py-2.5"} rounded-xl text-sm text-slate-200 hover:text-white hover:bg-slate-800/70 transition-all duration-150`}
              title={collapsed ? "Importar Datos" : undefined}
              onClick={() => {
                setShowImportModal(true);
                setIsMobileOpen(false);
              }}
              data-testid="nav-import"
            >
              <Upload className={`${collapsed ? "w-5 h-5" : "w-4 h-4"} flex-shrink-0 text-slate-500`} />
              {!collapsed && "Importar Datos"}
            </button>
          )}
        </nav>

        {/* User card — at bottom */}
        <div className={`${collapsed ? "px-2 py-3" : "px-4 py-3"} flex-shrink-0 border-t border-slate-700/40`}>
          {collapsed ? (
            <div className="flex flex-col items-center gap-2">
              <div
                title={`${getDisplayName(user?.firstName, user?.lastName)} · ${getRoleTitle(user?.role)}${getSegmentLabel(user) ? ` · ${getSegmentLabel(user)}` : ""}`}
              >
                <UserAvatar />
              </div>
              <button
                className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all duration-150"
                title="Cerrar sesión"
                onClick={() => {
                  setIsMobileOpen(false);
                  handleLogout();
                }}
                data-testid="logout-button"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <UserAvatar />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate leading-tight">
                  {getDisplayName(user?.firstName, user?.lastName)}
                </p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-[11px] font-medium text-[#fd6301]">
                    {getRoleTitle(user?.role)}
                  </span>
                  {getSegmentLabel(user) && (
                    <>
                      <span className="text-slate-600">·</span>
                      <span className="text-[11px] text-slate-400 truncate">
                        {getSegmentLabel(user)}
                      </span>
                    </>
                  )}
                </div>
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
          )}
        </div>
      </div>
      </div>

      {/* Main Content — el módulo ocupa todo el blanco, sin marco.
          Antes flotaba como una tarjeta (borde + esquinas redondeadas + margen sobre un
          canvas gris) y eso lo hacía leer como un recuadro dentro de la pantalla en vez
          de como la pantalla misma (corrección del usuario, ago-2026). El sidebar sí
          sigue siendo una tarjeta flotante: su composición no cambió. */}
      <div className={`${isCollapsed ? "lg:pl-[4.25rem]" : "lg:pl-[16rem]"} min-w-0 max-w-full overflow-x-clip transition-all duration-300 ${botonMenuArriba ? "" : "pb-[calc(3.5rem+env(safe-area-inset-bottom))] lg:pb-0"}`}>
        <main>
          <div className="module-card bg-white dark:bg-slate-900 min-h-screen overflow-clip">
            {children}
          </div>
        </main>
      </div >

      {/* Modals */}
      {
        can("config.importar") && (
          <ImportModal open={showImportModal} onOpenChange={setShowImportModal} />
        )
      }
      <ChangelogDialog open={showChangelogDialog} onOpenChange={setShowChangelogDialog} />
    </div >
    </BotonMenuArribaContext.Provider>
  );
}
