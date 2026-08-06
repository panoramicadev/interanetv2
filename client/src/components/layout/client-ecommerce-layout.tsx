import { ReactNode, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import {
  LayoutDashboard,
  ClipboardList,
  LogOut,
  ShoppingCart,
  Menu,
  X,
  ChevronRight,
  FileText,
  Truck,
  Wallet,
  Users,
} from "lucide-react";

interface StoreConfig {
  logoUrl?: string;
  phone?: string;
  email?: string;
}

const navItems = [
  { label: "Mi Panel", href: "/mi-cuenta", icon: LayoutDashboard },
  { label: "Mis Pedidos", href: "/mis-pedidos", icon: ClipboardList },
  { label: "Estado de Cuenta", href: "/mi-credito", icon: Wallet },
  { label: "Seguimiento", href: "/seguimiento", icon: Truck },
  { label: "Documentos", href: "/mis-documentos", icon: FileText },
];

// "Usuarios" sólo aparece si Panorámica le habilitó al cliente crear su propia gente.
const USUARIOS_ITEM = { label: "Usuarios", href: "/mis-usuarios", icon: Users };
// Un comprador (sub-usuario del cliente) entra sólo a comprar: no ve el estado de
// cuenta, los documentos ni el panel de la empresa.
const NAV_COMPRADOR = ["/mis-pedidos", "/seguimiento"];

const niceFirstName = (full: string) => {
  const first = (full || "").trim().split(/\s+/)[0] || "Cliente";
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
};

export default function ClientEcommerceLayout({ children }: { children: ReactNode }) {
  const { user, logoutMutation } = useAuth();
  const [location, navigate] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const { data: storeConfig } = useQuery<StoreConfig>({
    queryKey: ['/api/store/config'],
    retry: false,
  });

  const displayName = (user as any)?.salespersonName || (user as any)?.name || (user as any)?.username || "Cliente";
  const firstName = niceFirstName(displayName);

  const esComprador = !!(user as any)?.parentUserId;
  const items = esComprador
    ? navItems.filter(i => NAV_COMPRADOR.includes(i.href))
    : (user as any)?.canCreateSubUsers
      ? [...navItems, USUARIOS_ITEM]
      : navItems;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top Header Bar */}
      <header className="bg-gradient-to-r from-slate-900 via-slate-900 to-slate-800 sticky top-0 z-50 shadow-lg shadow-slate-900/10 border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo — fondo claro para que el logo de letras oscuras se lea sobre la barra oscura */}
            <a href="/" className="flex-shrink-0">
              <span className="inline-flex items-center bg-white rounded-xl px-3 py-1.5 shadow-sm ring-1 ring-black/5">
                <img
                  src={storeConfig?.logoUrl || "/panoramica-logo.png"}
                  alt="Panorámica"
                  className="h-7 sm:h-8 w-auto"
                />
              </span>
            </a>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-1">
              {items.map(item => {
                const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
                const Icon = item.icon;
                return (
                  <button
                    key={item.href}
                    onClick={() => navigate(item.href)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      isActive
                        ? "bg-white/15 text-white"
                        : "text-gray-300 hover:text-white hover:bg-white/10"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </button>
                );
              })}
            </nav>

            {/* Right: CTA + User */}
            <div className="flex items-center gap-2">
              <a
                href="/tienda"
                className="hidden sm:inline-flex items-center gap-2 bg-[#FF6E23] hover:bg-[#E55E13] text-white font-bold text-sm px-4 py-2 rounded-lg transition-all shadow-lg shadow-orange-500/20"
              >
                <ShoppingCart className="h-4 w-4" />
                Ver mi Catálogo
              </a>

              {/* User greeting */}
              <div className="hidden md:flex items-center gap-2.5 text-gray-300 text-sm pl-3 border-l border-white/20 ml-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#FF6E23] to-[#E55E13] flex items-center justify-center text-white font-bold text-xs ring-2 ring-white/10">
                  {firstName.charAt(0).toUpperCase()}
                </div>
                <div className="leading-tight max-w-[150px]">
                  <p className="text-[10px] text-gray-400 -mb-0.5">Hola,</p>
                  <p className="text-xs font-semibold text-white truncate">{firstName}</p>
                </div>
                <button
                  onClick={() => logoutMutation.mutate()}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors ml-1"
                  title="Cerrar sesión"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>

              {/* Mobile menu toggle */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 rounded-lg text-gray-300 hover:text-white hover:bg-white/10"
              >
                {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-white/10 bg-gray-900/95 backdrop-blur-sm">
            <div className="px-4 py-3 space-y-1">
              {items.map(item => {
                const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
                const Icon = item.icon;
                return (
                  <button
                    key={item.href}
                    onClick={() => { navigate(item.href); setMobileMenuOpen(false); }}
                    className={`flex items-center justify-between w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      isActive
                        ? "bg-white/15 text-white"
                        : "text-gray-300 hover:text-white hover:bg-white/10"
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </span>
                    <ChevronRight className="h-4 w-4 opacity-40" />
                  </button>
                );
              })}

              {/* Mobile CTA */}
              <a
                href="/tienda"
                className="flex items-center justify-center gap-2 bg-[#FF6E23] hover:bg-[#E55E13] text-white font-bold text-sm px-4 py-2.5 rounded-lg transition-all mt-2"
              >
                <ShoppingCart className="h-4 w-4" />
                Ver mi Catálogo
              </a>

              {/* Mobile user info */}
              <div className="flex items-center justify-between pt-3 mt-2 border-t border-white/10">
                <div className="flex items-center gap-2 text-gray-300 text-sm">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#FF6E23] to-[#E55E13] flex items-center justify-center text-white font-bold text-xs">
                    {firstName.charAt(0).toUpperCase()}
                  </div>
                  <span className="truncate text-xs">Hola, <span className="font-semibold text-white">{firstName}</span></span>
                </div>
                <button
                  onClick={() => logoutMutation.mutate()}
                  className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Salir
                </button>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Page Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>
    </div>
  );
}
