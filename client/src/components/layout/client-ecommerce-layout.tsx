import { ReactNode, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import {
  LayoutDashboard,
  ShoppingBag,
  ClipboardList,
  User,
  LogOut,
  ShoppingCart,
  Menu,
  X,
  ChevronRight,
  Palette
} from "lucide-react";

interface StoreConfig {
  logoUrl?: string;
  phone?: string;
  email?: string;
}

const navItems = [
  { label: "Mi Panel", href: "/mi-cuenta", icon: LayoutDashboard },
  { label: "Mis Pedidos", href: "/mis-pedidos", icon: ClipboardList },
  { label: "Solicitar Cotización", href: "/solicitar-cotizacion", icon: ShoppingBag },
  { label: "Tintometría", href: "/tintometria/selector", icon: Palette },
];

export default function ClientEcommerceLayout({ children }: { children: ReactNode }) {
  const { user, logoutMutation } = useAuth();
  const [location, navigate] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const { data: storeConfig } = useQuery<StoreConfig>({
    queryKey: ['/api/store/config'],
    retry: false,
  });

  const displayName = (user as any)?.salespersonName || (user as any)?.name || (user as any)?.username || "Cliente";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Header Bar */}
      <header className="bg-gray-900 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            {/* Logo */}
            <a href="/" className="flex-shrink-0">
              <img
                src={storeConfig?.logoUrl || "/panoramica-logo.png"}
                alt="Panorámica"
                className="h-8 sm:h-9"
              />
            </a>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map(item => {
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

              {/* User avatar */}
              <div className="hidden md:flex items-center gap-2 text-gray-300 text-sm pl-3 border-l border-white/20 ml-2">
                <div className="w-7 h-7 rounded-full bg-[#FF6E23] flex items-center justify-center text-white font-bold text-xs">
                  {displayName.charAt(0).toUpperCase()}
                </div>
                <span className="max-w-[120px] truncate text-xs">{displayName}</span>
                <button
                  onClick={() => logoutMutation.mutate()}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
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
              {navItems.map(item => {
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
                  <div className="w-7 h-7 rounded-full bg-[#FF6E23] flex items-center justify-center text-white font-bold text-xs">
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                  <span className="truncate text-xs">{displayName}</span>
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
