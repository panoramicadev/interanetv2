/**
 * Catálogos del módulo de gastos — categorías, centros de costo, proyectos y
 * tipos de documento.
 *
 * Portado de primerosresultados/rendicion-gastos (client/src/pages/admin/catalogs-tab.tsx).
 * Antes estos valores estaban hardcodeados en el formulario de gasto; ahora los
 * administra RRHH/admin sin tocar código.
 *
 * Baja lógica, no borrado: los gastos históricos guardan el NOMBRE como texto,
 * así que desactivar un ítem lo saca del selector sin alterar lo ya rendido.
 */
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Eye, EyeOff, Loader2, Pencil, Plus, Tags } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TABS_LIST_PILL_SOFT, TAB_PILL_SOFT } from "@/components/gastos/tabs-pill";

type TipoCatalogo = "categoria" | "centro_costo" | "proyecto" | "tipo_documento";

interface ItemCatalogo {
  id: string;
  tipo: TipoCatalogo;
  nombre: string;
  codigo: string | null;
  cuentaContable: string | null;
  requiereRutProveedor: boolean;
  orden: number;
  activo: boolean;
}

const CATALOGOS: {
  tipo: TipoCatalogo;
  titulo: string;
  descripcion: string;
  /** Solo las categorías llevan cuenta contable. */
  usaCuentaContable?: boolean;
  /** Solo los tipos de documento pueden exigir RUT del proveedor. */
  usaRutProveedor?: boolean;
}[] = [
  {
    tipo: "categoria",
    titulo: "Categorías",
    descripcion: "Cómo se clasifica cada gasto (Combustibles, Peaje, Colación…).",
    usaCuentaContable: true,
  },
  {
    tipo: "centro_costo",
    titulo: "Centros de costo",
    descripcion: "A qué unidad se imputa el gasto.",
  },
  {
    tipo: "proyecto",
    titulo: "Proyectos",
    descripcion: "Obra o iniciativa asociada al gasto. Opcional en el formulario.",
  },
  {
    tipo: "tipo_documento",
    titulo: "Tipos de documento",
    descripcion: "Boleta, factura, recibo… y cuáles exigen el RUT del proveedor.",
    usaRutProveedor: true,
  },
];

const BOTON_NARANJA =
  "bg-[#fd6301] hover:bg-[#e35400] text-white shadow-md shadow-orange-500/25 transition-all rounded-2xl";

interface BorradorItem {
  id?: string;
  nombre: string;
  codigo: string;
  cuentaContable: string;
  requiereRutProveedor: boolean;
  orden: number;
  activo: boolean;
}

const BORRADOR_VACIO: BorradorItem = {
  nombre: "",
  codigo: "",
  cuentaContable: "",
  requiereRutProveedor: false,
  orden: 0,
  activo: true,
};

export default function GastosCatalogos() {
  const { toast } = useToast();
  const [tipoActivo, setTipoActivo] = useState<TipoCatalogo>("categoria");
  const [mostrarInactivos, setMostrarInactivos] = useState(false);
  const [dialogo, setDialogo] = useState(false);
  const [borrador, setBorrador] = useState<BorradorItem>(BORRADOR_VACIO);

  const config = CATALOGOS.find((c) => c.tipo === tipoActivo)!;

  // Se pide siempre con inactivos: el filtro se aplica en el cliente para que
  // el toggle no dispare un refetch por cada clic.
  const consulta = useQuery<ItemCatalogo[]>({
    queryKey: ["/api/gasto-catalogos", { incluirInactivos: "true" }],
  });

  const items = (consulta.data ?? [])
    .filter((i) => i.tipo === tipoActivo)
    .filter((i) => mostrarInactivos || i.activo);

  const refrescar = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/gasto-catalogos"] });
  };

  const guardarMut = useMutation({
    mutationFn: async (datos: BorradorItem) => {
      const cuerpo = {
        tipo: tipoActivo,
        nombre: datos.nombre.trim(),
        codigo: datos.codigo.trim() || null,
        cuentaContable: config.usaCuentaContable ? datos.cuentaContable.trim() || null : null,
        requiereRutProveedor: config.usaRutProveedor ? datos.requiereRutProveedor : false,
        orden: Number(datos.orden) || 0,
        activo: datos.activo,
      };
      const res = datos.id
        ? await apiRequest(`/api/gasto-catalogos/${datos.id}`, { method: "PATCH", data: cuerpo })
        : await apiRequest("/api/gasto-catalogos", { method: "POST", data: cuerpo });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: borrador.id ? "Ítem actualizado" : "Ítem creado" });
      setDialogo(false);
      setBorrador(BORRADOR_VACIO);
      refrescar();
    },
    onError: (e: Error) =>
      toast({ title: "No se pudo guardar", description: e.message, variant: "destructive" }),
  });

  const alternarActivoMut = useMutation({
    mutationFn: async (item: ItemCatalogo) => {
      const res = await apiRequest(`/api/gasto-catalogos/${item.id}`, {
        method: "PATCH",
        data: { activo: !item.activo },
      });
      return res.json();
    },
    onSuccess: (item: ItemCatalogo) => {
      toast({
        title: item.activo ? "Ítem reactivado" : "Ítem desactivado",
        description: item.activo
          ? "Vuelve a aparecer en el formulario de gasto."
          : "Deja de ofrecerse en el formulario; los gastos históricos no cambian.",
      });
      refrescar();
    },
    onError: (e: Error) =>
      toast({ title: "No se pudo cambiar el estado", description: e.message, variant: "destructive" }),
  });

  const abrirNuevo = () => {
    setBorrador({ ...BORRADOR_VACIO, orden: items.length + 1 });
    setDialogo(true);
  };

  const abrirEdicion = (item: ItemCatalogo) => {
    setBorrador({
      id: item.id,
      nombre: item.nombre,
      codigo: item.codigo ?? "",
      cuentaContable: item.cuentaContable ?? "",
      requiereRutProveedor: item.requiereRutProveedor,
      orden: item.orden,
      activo: item.activo,
    });
    setDialogo(true);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
            Catálogos de gastos
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Los valores que ofrece el formulario de gasto. Desactivar no borra lo ya rendido.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="rounded-2xl"
            onClick={() => setMostrarInactivos((v) => !v)}
            data-testid="button-toggle-inactivos"
          >
            {mostrarInactivos ? (
              <><EyeOff className="mr-2 h-4 w-4" />Ocultar inactivos</>
            ) : (
              <><Eye className="mr-2 h-4 w-4" />Ver inactivos</>
            )}
          </Button>
          <Button className={BOTON_NARANJA} size="sm" onClick={abrirNuevo} data-testid="button-nuevo-catalogo">
            <Plus className="mr-2 h-4 w-4" />
            Nuevo
          </Button>
        </div>
      </div>

      <Tabs value={tipoActivo} onValueChange={(v) => setTipoActivo(v as TipoCatalogo)}>
        <TabsList className={TABS_LIST_PILL_SOFT}>
          {CATALOGOS.map((c) => (
            <TabsTrigger key={c.tipo} value={c.tipo} className={TAB_PILL_SOFT} data-testid={`tab-catalogo-${c.tipo}`}>
              {c.titulo}
            </TabsTrigger>
          ))}
        </TabsList>

        {CATALOGOS.map((c) => (
          <TabsContent key={c.tipo} value={c.tipo} className="mt-4 space-y-3">
            <p className="text-sm text-slate-500 dark:text-slate-400">{c.descripcion}</p>

            {consulta.isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-14 w-full rounded-2xl" />
                <Skeleton className="h-14 w-full rounded-2xl" />
                <Skeleton className="h-14 w-full rounded-2xl" />
              </div>
            ) : items.length === 0 ? (
              <Card className="rounded-2xl border-dashed border-slate-300 dark:border-slate-700">
                <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fd6301] shadow-md shadow-[#fd6301]/25">
                    <Tags className="h-6 w-6 text-white" />
                  </div>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    Sin ítems en este catálogo
                  </p>
                  <Button className={BOTON_NARANJA} size="sm" onClick={abrirNuevo}>
                    <Plus className="mr-2 h-4 w-4" />
                    Agregar el primero
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <ul className="space-y-2">
                {items.map((item) => (
                  <li
                    key={item.id}
                    className={`flex items-center gap-3 rounded-2xl border border-slate-200/70 bg-white p-3.5 shadow-sm dark:border-slate-700 dark:bg-slate-900 ${
                      item.activo ? "" : "opacity-60"
                    }`}
                    data-testid={`item-catalogo-${item.id}`}
                  >
                    <span className="w-8 shrink-0 text-center text-xs font-bold tabular-nums text-slate-400">
                      {item.orden}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                        {item.nombre}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {[
                          item.codigo && `Código ${item.codigo}`,
                          item.cuentaContable && `Cuenta ${item.cuentaContable}`,
                          item.requiereRutProveedor && "Exige RUT del proveedor",
                        ]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </p>
                    </div>
                    {!item.activo && (
                      <Badge variant="outline" className="shrink-0 text-[11px]">
                        Inactivo
                      </Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 rounded-lg"
                      aria-label={`Editar ${item.nombre}`}
                      onClick={() => abrirEdicion(item)}
                      data-testid={`button-editar-catalogo-${item.id}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 rounded-lg"
                      aria-label={item.activo ? `Desactivar ${item.nombre}` : `Reactivar ${item.nombre}`}
                      disabled={alternarActivoMut.isPending}
                      onClick={() => alternarActivoMut.mutate(item)}
                      data-testid={`button-toggle-catalogo-${item.id}`}
                    >
                      {item.activo ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>
        ))}
      </Tabs>

      <Dialog open={dialogo} onOpenChange={setDialogo}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>{borrador.id ? "Editar ítem" : "Nuevo ítem"}</DialogTitle>
            <DialogDescription>{config.titulo} · {config.descripcion}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="cat-nombre">Nombre *</Label>
              <Input
                id="cat-nombre"
                className="mt-1.5"
                value={borrador.nombre}
                onChange={(e) => setBorrador({ ...borrador, nombre: e.target.value })}
                placeholder={config.tipo === "categoria" ? "Combustibles" : "Nombre del ítem"}
                data-testid="input-catalogo-nombre"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="cat-codigo">Código</Label>
                <Input
                  id="cat-codigo"
                  className="mt-1.5"
                  value={borrador.codigo}
                  onChange={(e) => setBorrador({ ...borrador, codigo: e.target.value })}
                  placeholder="Opcional"
                  data-testid="input-catalogo-codigo"
                />
              </div>
              <div>
                <Label htmlFor="cat-orden">Orden</Label>
                <Input
                  id="cat-orden"
                  type="number"
                  className="mt-1.5"
                  value={borrador.orden}
                  onChange={(e) => setBorrador({ ...borrador, orden: Number(e.target.value) })}
                  data-testid="input-catalogo-orden"
                />
              </div>
            </div>

            {config.usaCuentaContable && (
              <div>
                <Label htmlFor="cat-cuenta">Cuenta contable</Label>
                <Input
                  id="cat-cuenta"
                  className="mt-1.5"
                  value={borrador.cuentaContable}
                  onChange={(e) => setBorrador({ ...borrador, cuentaContable: e.target.value })}
                  placeholder="Opcional — para exportar a contabilidad"
                  data-testid="input-catalogo-cuenta"
                />
              </div>
            )}

            {config.usaRutProveedor && (
              <label className="flex items-center gap-2.5 text-sm text-slate-700 dark:text-slate-200">
                <Checkbox
                  checked={borrador.requiereRutProveedor}
                  onCheckedChange={(v) =>
                    setBorrador({ ...borrador, requiereRutProveedor: v === true })
                  }
                  data-testid="checkbox-catalogo-rut"
                />
                Exigir el RUT del proveedor al usar este tipo de documento
              </label>
            )}

            <label className="flex items-center gap-2.5 text-sm text-slate-700 dark:text-slate-200">
              <Checkbox
                checked={borrador.activo}
                onCheckedChange={(v) => setBorrador({ ...borrador, activo: v === true })}
                data-testid="checkbox-catalogo-activo"
              />
              Activo (visible en el formulario de gasto)
            </label>
          </div>

          <DialogFooter>
            <Button variant="outline" className="rounded-2xl" onClick={() => setDialogo(false)}>
              Cancelar
            </Button>
            <Button
              className={BOTON_NARANJA}
              disabled={!borrador.nombre.trim() || guardarMut.isPending}
              onClick={() => guardarMut.mutate(borrador)}
              data-testid="button-guardar-catalogo"
            >
              {guardarMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
