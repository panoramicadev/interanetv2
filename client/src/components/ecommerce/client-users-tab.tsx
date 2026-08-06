/**
 * "Usuarios" del portal del cliente — el titular administra a su gente.
 *
 * Sólo se ve si Panorámica habilitó la función en la ficha del cliente. Cada
 * usuario creado acá entra al Market con su propio correo, compra con los precios
 * de la empresa, y sus pedidos quedan esperando el visto bueno del titular en
 * "Mis Pedidos" antes de salir a Panorámica.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Users,
  UserPlus,
  Loader2,
  Mail,
  KeyRound,
  Power,
  ShieldCheck,
  Clock,
} from "lucide-react";

interface SubUser {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  createdAt?: string;
  pendingOrders?: number;
}

interface SubUsersResponse {
  canCreateSubUsers: boolean;
  subUsers: SubUser[];
}

export default function ClientUsersTab() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [creando, setCreando] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [claveDe, setClaveDe] = useState<SubUser | null>(null);
  const [nuevaClave, setNuevaClave] = useState("");

  const { data, isLoading } = useQuery<SubUsersResponse>({
    queryKey: ["/api/ecommerce/client/sub-users"],
    queryFn: async () => {
      const res = await fetch("/api/ecommerce/client/sub-users", { credentials: "include" });
      if (!res.ok) return { canCreateSubUsers: false, subUsers: [] };
      return res.json();
    },
  });

  const usuarios = data?.subUsers || [];
  const habilitado = !!data?.canCreateSubUsers;

  const invalidar = () => qc.invalidateQueries({ queryKey: ["/api/ecommerce/client/sub-users"] });

  const crear = useMutation({
    mutationFn: async (payload: typeof form) => {
      const res = await fetch("/api/ecommerce/client/sub-users", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || "No se pudo crear el usuario");
      return json;
    },
    onSuccess: () => {
      toast({ title: "Usuario creado", description: "Ya puede entrar a Panorámica Market con su correo y clave." });
      setCreando(false);
      setForm({ name: "", email: "", password: "" });
      invalidar();
    },
    onError: (e: any) => toast({ title: "Error", description: e?.message, variant: "destructive" }),
  });

  const actualizar = useMutation({
    mutationFn: async ({ id, cambios }: { id: string; cambios: Record<string, unknown> }) => {
      const res = await fetch(`/api/ecommerce/client/sub-users/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cambios),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || "No se pudo actualizar");
      return json;
    },
    onSuccess: (_d, vars) => {
      toast({
        title: vars.cambios.password ? "Clave actualizada" : "Usuario actualizado",
        description: vars.cambios.password ? "Pásale la nueva clave a tu usuario." : undefined,
      });
      setClaveDe(null);
      setNuevaClave("");
      invalidar();
    },
    onError: (e: any) => toast({ title: "Error", description: e?.message, variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Encabezado */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
          <div className="flex items-start gap-3 min-w-0">
            <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-[#FF6E23] to-[#E55E13] flex items-center justify-center flex-shrink-0 shadow-lg shadow-orange-500/25">
              <Users className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-black text-slate-900">Usuarios de tu empresa</h3>
              <p className="text-sm text-slate-600 mt-0.5">
                Cada usuario entra al Market con su propio correo y arma pedidos con tus precios.
                <strong className="text-slate-800"> Ningún pedido sale a Panorámica sin tu aprobación.</strong>
              </p>
            </div>
          </div>
          {habilitado && (
            <Button
              onClick={() => setCreando(true)}
              className="rounded-xl bg-[#FF6E23] hover:bg-[#E55E13] text-white font-bold shadow-sm shadow-orange-500/20 flex-shrink-0"
            >
              <UserPlus className="h-4 w-4 mr-2" /> Crear usuario
            </Button>
          )}
        </div>
      </div>

      {!habilitado ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
          <ShieldCheck className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-700">La creación de usuarios no está habilitada</p>
          <p className="text-sm text-slate-500 mt-1">
            Pídesela a tu vendedor de Panorámica y la activamos en tu cuenta.
          </p>
        </div>
      ) : usuarios.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
          <Users className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500 mb-4">Todavía no creaste usuarios.</p>
          <Button
            onClick={() => setCreando(true)}
            className="rounded-xl bg-[#FF6E23] hover:bg-[#E55E13] text-white font-bold"
          >
            <UserPlus className="h-4 w-4 mr-2" /> Crear el primero
          </Button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {usuarios.map((u) => (
            <div
              key={u.id}
              className="rounded-2xl border border-slate-200 bg-white shadow-sm hover:border-orange-200 hover:shadow-md transition-all p-4"
            >
              <div className="flex items-center gap-3 flex-wrap">
                <div
                  className={`h-11 w-11 rounded-xl flex items-center justify-center flex-shrink-0 border font-bold ${
                    u.isActive
                      ? "bg-orange-50 border-orange-200 text-[#E55E13]"
                      : "bg-slate-100 border-slate-200 text-slate-400"
                  }`}
                >
                  {(u.name || "?").charAt(0).toUpperCase()}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold text-slate-800 truncate">{u.name}</p>
                    {!u.isActive && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border bg-slate-100 border-slate-200 text-slate-500">
                        Desactivado
                      </span>
                    )}
                    {!!u.pendingOrders && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border bg-orange-50 border-orange-200 text-orange-700">
                        <Clock className="h-3 w-3" />
                        {u.pendingOrders} por aprobar
                      </span>
                    )}
                  </div>
                  <p className="flex items-center gap-1 mt-1 text-[11px] text-slate-500 truncate">
                    <Mail className="h-3 w-3 flex-shrink-0" /> {u.email}
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setClaveDe(u); setNuevaClave(""); }}
                    className="h-8 rounded-lg text-xs font-semibold text-slate-600 border-slate-200 hover:bg-slate-50"
                  >
                    <KeyRound className="h-3.5 w-3.5 mr-1.5" /> Cambiar clave
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={actualizar.isPending}
                    onClick={() => actualizar.mutate({ id: u.id, cambios: { isActive: !u.isActive } })}
                    className={`h-8 rounded-lg text-xs font-semibold ${
                      u.isActive
                        ? "text-red-600 border-red-200 hover:bg-red-50"
                        : "text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                    }`}
                  >
                    <Power className="h-3.5 w-3.5 mr-1.5" />
                    {u.isActive ? "Desactivar" : "Activar"}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Crear usuario */}
      <Dialog open={creando} onOpenChange={(o) => !o && setCreando(false)}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Crear usuario</DialogTitle>
            <DialogDescription>
              Va a poder comprar con los precios de tu empresa. Sus pedidos te llegan a vos para aprobar.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="sub-name">Nombre</Label>
              <Input
                id="sub-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ej: Juan Pérez"
                className="rounded-xl mt-1"
              />
            </div>
            <div>
              <Label htmlFor="sub-email">Correo (con este entra)</Label>
              <Input
                id="sub-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="juan@miempresa.cl"
                className="rounded-xl mt-1"
              />
            </div>
            <div>
              <Label htmlFor="sub-pass">Clave (mínimo 6 caracteres)</Label>
              <Input
                id="sub-pass"
                type="text"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Se la pasás vos"
                className="rounded-xl mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreando(false)} className="rounded-xl">
              Cancelar
            </Button>
            <Button
              onClick={() => crear.mutate(form)}
              disabled={crear.isPending || !form.name.trim() || !form.email.trim() || form.password.length < 6}
              className="rounded-xl bg-[#FF6E23] hover:bg-[#E55E13] text-white font-bold"
            >
              {crear.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Crear usuario
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cambiar clave */}
      <Dialog open={!!claveDe} onOpenChange={(o) => !o && setClaveDe(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Cambiar clave de {claveDe?.name}</DialogTitle>
            <DialogDescription>La clave anterior deja de funcionar apenas guardes.</DialogDescription>
          </DialogHeader>
          <div>
            <Label htmlFor="sub-newpass">Nueva clave (mínimo 6 caracteres)</Label>
            <Input
              id="sub-newpass"
              type="text"
              value={nuevaClave}
              onChange={(e) => setNuevaClave(e.target.value)}
              className="rounded-xl mt-1"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClaveDe(null)} className="rounded-xl">
              Cancelar
            </Button>
            <Button
              onClick={() => claveDe && actualizar.mutate({ id: claveDe.id, cambios: { password: nuevaClave } })}
              disabled={actualizar.isPending || nuevaClave.length < 6}
              className="rounded-xl bg-[#FF6E23] hover:bg-[#E55E13] text-white font-bold"
            >
              {actualizar.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Guardar clave
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
