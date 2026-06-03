/**
 * Pallet Config Panel — admin section to enable/configure pallet sales per SKU.
 *
 * Modelo (Opción B):
 *   - palletEnabled: muestra el botón "Pallet completo" en la tienda
 *   - packagingAmountPerPallet: unidades por pallet (ej 144 galones, 36 BD4, 24 BD5)
 *     Viene precargado del ETL de SAP/Softland; editable acá por overrides.
 *   - palletDiscountPct: descuento (0..100) sobre precio de lista.
 *     REEMPLAZA cualquier oferta activa del SKU (no se suman).
 *
 * Por SKU, no por familia: cada variante (galón / balde 4 gal / balde 5 gal)
 * puede tener su propia configuración.
 */
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Package, Search, Edit, AlertCircle } from "lucide-react";

interface ProductoEcommerce {
  id: string;
  codigo: string;
  producto: string;
  unidad?: string;
  color?: string | null;
  variantGenericDisplayName?: string | null;
  activo: boolean;
  palletEnabled?: boolean;
  packagingAmountPerPallet?: number | null;
  palletDiscountPct?: number | null;
}

function formatPrice(n: number): string {
  return `$${new Intl.NumberFormat("es-CL").format(Math.round(n))}`;
}

export default function PalletConfigPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [onlyEnabled, setOnlyEnabled] = useState(false);
  const [editing, setEditing] = useState<ProductoEcommerce | null>(null);
  const [formEnabled, setFormEnabled] = useState(false);
  const [formUnits, setFormUnits] = useState("");
  const [formDiscount, setFormDiscount] = useState("");

  const { data: productos = [], isLoading } = useQuery<ProductoEcommerce[]>({
    queryKey: ["/api/ecommerce/admin/productos"],
    queryFn: async () => {
      const res = await apiRequest("/api/ecommerce/admin/productos");
      return res.json();
    },
  });

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return productos.filter((p) => {
      if (onlyEnabled && !p.palletEnabled) return false;
      if (!s) return true;
      return (
        p.codigo.toLowerCase().includes(s) ||
        p.producto.toLowerCase().includes(s) ||
        (p.variantGenericDisplayName || "").toLowerCase().includes(s) ||
        (p.color || "").toLowerCase().includes(s)
      );
    });
  }, [productos, search, onlyEnabled]);

  const enabledCount = useMemo(
    () => productos.filter((p) => p.palletEnabled).length,
    [productos]
  );

  const saveMutation = useMutation({
    mutationFn: async (payload: {
      id: string;
      palletEnabled: boolean;
      packagingAmountPerPallet: number | null;
      palletDiscountPct: number | null;
    }) => {
      const { id, ...rest } = payload;
      const res = await apiRequest(`/api/ecommerce/admin/productos/${id}`, {
        method: "PATCH",
        data: rest,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ecommerce/admin/productos"] });
      toast({
        title: "Configuración guardada",
        description: "La venta por pallet se actualizó correctamente.",
      });
      setEditing(null);
    },
    onError: (err: any) => {
      toast({
        title: "Error",
        description: err?.message || "No se pudo guardar la configuración",
        variant: "destructive",
      });
    },
  });

  const openEdit = (p: ProductoEcommerce) => {
    setEditing(p);
    setFormEnabled(!!p.palletEnabled);
    setFormUnits(
      p.packagingAmountPerPallet !== null && p.packagingAmountPerPallet !== undefined
        ? String(p.packagingAmountPerPallet)
        : ""
    );
    setFormDiscount(
      p.palletDiscountPct !== null && p.palletDiscountPct !== undefined
        ? String(p.palletDiscountPct)
        : ""
    );
  };

  const handleSave = () => {
    if (!editing) return;
    const units = formUnits.trim() === "" ? null : parseInt(formUnits, 10);
    const discount = formDiscount.trim() === "" ? null : parseFloat(formDiscount);

    // Validación local antes de mandar al servidor
    if (formEnabled && (units === null || isNaN(units) || units < 1)) {
      toast({
        title: "Faltan unidades",
        description: "Para habilitar la venta por pallet, indica cuántas unidades trae el pallet.",
        variant: "destructive",
      });
      return;
    }
    if (units !== null && (isNaN(units) || units < 1)) {
      toast({
        title: "Unidades inválidas",
        description: "Debe ser un número entero ≥ 1.",
        variant: "destructive",
      });
      return;
    }
    if (discount !== null && (isNaN(discount) || discount < 0 || discount > 100)) {
      toast({
        title: "Descuento inválido",
        description: "Debe estar entre 0 y 100.",
        variant: "destructive",
      });
      return;
    }

    saveMutation.mutate({
      id: editing.id,
      palletEnabled: formEnabled,
      packagingAmountPerPallet: units,
      palletDiscountPct: discount,
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-blue-600" />
            Venta por Pallet
            <Badge variant="outline" className="ml-2">
              {enabledCount} SKU{enabledCount === 1 ? "" : "s"} habilitado
              {enabledCount === 1 ? "" : "s"}
            </Badge>
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Configura por SKU qué productos se pueden vender por pallet completo en la tienda online.
            El descuento por pallet <strong>reemplaza</strong> cualquier oferta activa del producto
            (no se suman). Pre-llena unidades desde SAP cuando están disponibles.
          </p>
        </CardHeader>
        <CardContent>
          {/* Search + filters */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar por SKU, nombre, color..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
                data-testid="input-pallet-search"
              />
            </div>
            <label className="flex items-center gap-2 px-3 py-2 border rounded-md cursor-pointer hover:bg-gray-50">
              <Switch
                checked={onlyEnabled}
                onCheckedChange={setOnlyEnabled}
                data-testid="switch-pallet-only-enabled"
              />
              <span className="text-sm whitespace-nowrap">Solo habilitados</span>
            </label>
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="text-sm text-gray-500 py-8 text-center">Cargando productos...</div>
          ) : filtered.length === 0 ? (
            <div className="text-sm text-gray-500 py-8 text-center">
              {onlyEnabled
                ? "Ningún SKU tiene venta por pallet habilitada todavía."
                : "Sin resultados para la búsqueda."}
            </div>
          ) : (
            <div className="overflow-x-auto border rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr className="text-left">
                    <th className="px-3 py-2 font-medium">SKU</th>
                    <th className="px-3 py-2 font-medium">Producto</th>
                    <th className="px-3 py-2 font-medium">Formato</th>
                    <th className="px-3 py-2 font-medium text-center">Pallet</th>
                    <th className="px-3 py-2 font-medium text-right">Unidades</th>
                    <th className="px-3 py-2 font-medium text-right">Descuento</th>
                    <th className="px-3 py-2 font-medium text-right">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, 200).map((p) => {
                    const hasUnits =
                      p.packagingAmountPerPallet !== null &&
                      p.packagingAmountPerPallet !== undefined &&
                      p.packagingAmountPerPallet > 0;
                    return (
                      <tr key={p.id} className="border-b hover:bg-gray-50">
                        <td className="px-3 py-2 font-mono text-xs">{p.codigo}</td>
                        <td className="px-3 py-2">
                          <div className="font-medium">
                            {p.variantGenericDisplayName || p.producto}
                          </div>
                          {p.color && (
                            <div className="text-xs text-gray-500">{p.color}</div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-gray-600">{p.unidad || "—"}</td>
                        <td className="px-3 py-2 text-center">
                          {p.palletEnabled ? (
                            <Badge className="bg-blue-600 text-white">Habilitado</Badge>
                          ) : (
                            <Badge variant="outline" className="text-gray-500">
                              Deshabilitado
                            </Badge>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {hasUnits ? p.packagingAmountPerPallet : "—"}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {p.palletDiscountPct !== null && p.palletDiscountPct !== undefined
                            ? `${p.palletDiscountPct}%`
                            : "—"}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openEdit(p)}
                            data-testid={`button-edit-pallet-${p.codigo}`}
                          >
                            <Edit className="h-3.5 w-3.5 mr-1" />
                            Configurar
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filtered.length > 200 && (
                <div className="px-3 py-2 text-xs text-gray-500 border-t bg-gray-50">
                  Mostrando primeros 200 resultados ({filtered.length} totales) — refina la búsqueda.
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-blue-600" />
              Configurar venta por pallet
            </DialogTitle>
            <DialogDescription>
              {editing && (
                <span>
                  <span className="font-mono text-xs">{editing.codigo}</span> —{" "}
                  {editing.variantGenericDisplayName || editing.producto}
                  {editing.color ? ` (${editing.color})` : ""}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="flex items-center justify-between p-3 bg-blue-50/50 border border-blue-200/40 rounded-lg">
              <div>
                <Label htmlFor="pallet-enabled" className="font-medium">
                  Habilitar venta por pallet
                </Label>
                <p className="text-xs text-gray-600 mt-0.5">
                  Mostrar botón "Pallet completo" en la tienda online
                </p>
              </div>
              <Switch
                id="pallet-enabled"
                checked={formEnabled}
                onCheckedChange={setFormEnabled}
                data-testid="switch-pallet-enabled"
              />
            </div>

            <div>
              <Label htmlFor="pallet-units">Unidades por pallet *</Label>
              <Input
                id="pallet-units"
                type="number"
                min={1}
                step={1}
                placeholder="144 (galón) / 36 (BD4) / 24 (BD5)"
                value={formUnits}
                onChange={(e) => setFormUnits(e.target.value)}
                className="mt-1"
                data-testid="input-pallet-units"
              />
              <p className="text-xs text-gray-500 mt-1">
                Cantidad de unidades del SKU que componen un pallet. Pre-cargado desde SAP si está
                disponible.
              </p>
            </div>

            <div>
              <Label htmlFor="pallet-discount">Descuento por pallet (%)</Label>
              <Input
                id="pallet-discount"
                type="number"
                min={0}
                max={100}
                step={0.01}
                placeholder="0 (opcional)"
                value={formDiscount}
                onChange={(e) => setFormDiscount(e.target.value)}
                className="mt-1"
                data-testid="input-pallet-discount"
              />
              <p className="text-xs text-gray-500 mt-1">
                0..100. Se aplica al precio unitario de lista del cliente.
              </p>
            </div>

            {formEnabled && (
              <div className="flex gap-2 p-3 bg-amber-50 border border-amber-200/50 rounded-lg text-xs text-amber-800">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <div>
                  <strong>Importante:</strong> el descuento por pallet <strong>reemplaza</strong>{" "}
                  cualquier oferta activa de este SKU. Las ofertas no se suman al descuento de pallet.
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={saveMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white"
              data-testid="button-save-pallet"
            >
              {saveMutation.isPending ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
