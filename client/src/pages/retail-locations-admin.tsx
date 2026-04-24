import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { MapPin, Plus, Pencil, Trash2, Search, Loader2, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type RetailLocation = {
  id: string;
  name: string;
  type: "sucursal_propia" | "distribuidor" | "ferreteria";
  address: string;
  comuna?: string | null;
  region?: string | null;
  latitude: string;
  longitude: string;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  schedule?: string | null;
  notes?: string | null;
  active: boolean;
};

type FormState = Partial<RetailLocation>;

const TYPE_LABELS: Record<RetailLocation["type"], string> = {
  sucursal_propia: "Sucursal Panorámica",
  distribuidor: "Distribuidor",
  ferreteria: "Ferretería",
};

function emptyForm(): FormState {
  return { type: "ferreteria", active: true };
}

export default function RetailLocationsAdmin() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<FormState | null>(null);
  const [open, setOpen] = useState(false);
  const [geocoding, setGeocoding] = useState(false);

  const { data: locations = [], isLoading } = useQuery<RetailLocation[]>({
    queryKey: ["/api/admin/retail-locations"],
  });

  const saveMutation = useMutation({
    mutationFn: async (data: FormState) => {
      const isEdit = Boolean(data.id);
      const url = isEdit ? `/api/admin/retail-locations/${data.id}` : "/api/admin/retail-locations";
      const res = await apiRequest(url, { method: isEdit ? "PATCH" : "POST", data });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/retail-locations"] });
      toast({ title: "Guardado correctamente" });
      setOpen(false);
      setEditing(null);
    },
    onError: (err: any) => {
      toast({ title: "Error al guardar", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest(`/api/admin/retail-locations/${id}`, { method: "DELETE" });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/retail-locations"] });
      toast({ title: "Ubicación eliminada" });
    },
  });

  const filtered = locations.filter((l) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      l.name.toLowerCase().includes(q) ||
      l.address.toLowerCase().includes(q) ||
      (l.comuna || "").toLowerCase().includes(q)
    );
  });

  const openNew = () => {
    setEditing(emptyForm());
    setOpen(true);
  };

  const openEdit = (loc: RetailLocation) => {
    setEditing(loc);
    setOpen(true);
  };

  const geocode = async () => {
    if (!editing?.address) return;
    setGeocoding(true);
    try {
      const q = encodeURIComponent(
        `${editing.address}${editing.comuna ? ", " + editing.comuna : ""}${editing.region ? ", " + editing.region : ""}, Chile`
      );
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`);
      const data = await res.json();
      if (data && data[0]) {
        setEditing((prev) => prev ? { ...prev, latitude: data[0].lat, longitude: data[0].lon } : prev);
        toast({ title: "Coordenadas encontradas", description: `${data[0].lat}, ${data[0].lon}` });
      } else {
        toast({ title: "No se encontró la dirección", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Error al geocodificar", description: err.message, variant: "destructive" });
    } finally {
      setGeocoding(false);
    }
  };

  const handleSave = () => {
    if (!editing) return;
    if (!editing.name || !editing.address || !editing.latitude || !editing.longitude) {
      toast({ title: "Faltan campos", description: "Nombre, dirección y coordenadas son obligatorios", variant: "destructive" });
      return;
    }
    saveMutation.mutate(editing);
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <MapPin className="w-7 h-7 text-[#ff7f33]" />
            Dónde Comprar
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Sucursales, distribuidores y ferreterías mostradas en la página pública{" "}
            <a href="/donde-comprar" target="_blank" rel="noopener noreferrer" className="text-[#ff7f33] font-medium inline-flex items-center gap-1">
              /donde-comprar <ExternalLink className="w-3 h-3" />
            </a>
          </p>
        </div>
        <Button onClick={openNew} className="bg-[#ff7f33] hover:bg-[#e66a1f]">
          <Plus className="w-4 h-4 mr-2" /> Agregar ubicación
        </Button>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          placeholder="Buscar..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="border rounded-lg overflow-hidden bg-white">
        {isLoading ? (
          <div className="p-10 text-center text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin mx-auto" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-gray-400 text-sm">Sin ubicaciones</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left">Nombre</th>
                <th className="px-4 py-3 text-left">Tipo</th>
                <th className="px-4 py-3 text-left">Dirección</th>
                <th className="px-4 py-3 text-left">Comuna</th>
                <th className="px-4 py-3 text-left">Estado</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((loc) => (
                <tr key={loc.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{loc.name}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline">{TYPE_LABELS[loc.type]}</Badge>
                  </td>
                  <td className="px-4 py-3 text-gray-600 max-w-[300px] truncate">{loc.address}</td>
                  <td className="px-4 py-3 text-gray-600">{loc.comuna || "—"}</td>
                  <td className="px-4 py-3">
                    {loc.active ? (
                      <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Activa</Badge>
                    ) : (
                      <Badge variant="secondary">Inactiva</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(loc)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (confirm(`¿Eliminar "${loc.name}"?`)) deleteMutation.mutate(loc.id);
                      }}
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar ubicación" : "Nueva ubicación"}</DialogTitle>
          </DialogHeader>

          {editing && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Nombre *</Label>
                  <Input
                    value={editing.name || ""}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                    placeholder="Ferretería El Martillo"
                  />
                </div>
                <div>
                  <Label>Tipo *</Label>
                  <Select
                    value={editing.type}
                    onValueChange={(v) => setEditing({ ...editing, type: v as RetailLocation["type"] })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sucursal_propia">Sucursal Panorámica</SelectItem>
                      <SelectItem value="distribuidor">Distribuidor</SelectItem>
                      <SelectItem value="ferreteria">Ferretería</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Dirección *</Label>
                <Input
                  value={editing.address || ""}
                  onChange={(e) => setEditing({ ...editing, address: e.target.value })}
                  placeholder="Av. Siempre Viva 742"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Comuna</Label>
                  <Input
                    value={editing.comuna || ""}
                    onChange={(e) => setEditing({ ...editing, comuna: e.target.value })}
                    placeholder="Maipú"
                  />
                </div>
                <div>
                  <Label>Región</Label>
                  <Input
                    value={editing.region || ""}
                    onChange={(e) => setEditing({ ...editing, region: e.target.value })}
                    placeholder="Metropolitana"
                  />
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">Coordenadas *</Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={geocode}
                    disabled={geocoding || !editing.address}
                  >
                    {geocoding ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : <MapPin className="w-3 h-3 mr-2" />}
                    Obtener desde dirección
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Latitud</Label>
                    <Input
                      value={editing.latitude || ""}
                      onChange={(e) => setEditing({ ...editing, latitude: e.target.value })}
                      placeholder="-33.4489"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Longitud</Label>
                    <Input
                      value={editing.longitude || ""}
                      onChange={(e) => setEditing({ ...editing, longitude: e.target.value })}
                      placeholder="-70.6693"
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-500">
                  Tip: podés obtener coords desde Google Maps (clic derecho → copiar coordenadas) o usar el botón de arriba.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Teléfono</Label>
                  <Input
                    value={editing.phone || ""}
                    onChange={(e) => setEditing({ ...editing, phone: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input
                    value={editing.email || ""}
                    onChange={(e) => setEditing({ ...editing, email: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <Label>Sitio web</Label>
                <Input
                  value={editing.website || ""}
                  onChange={(e) => setEditing({ ...editing, website: e.target.value })}
                  placeholder="https://..."
                />
              </div>

              <div>
                <Label>Horario de atención</Label>
                <Input
                  value={editing.schedule || ""}
                  onChange={(e) => setEditing({ ...editing, schedule: e.target.value })}
                  placeholder="Lun-Vie 9:00-19:00, Sáb 10:00-14:00"
                />
              </div>

              <div>
                <Label>Notas internas</Label>
                <Textarea
                  value={editing.notes || ""}
                  onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
                  rows={2}
                />
              </div>

              <div className="flex items-center gap-3">
                <Switch
                  checked={editing.active !== false}
                  onCheckedChange={(v) => setEditing({ ...editing, active: v })}
                />
                <Label>Activa (se muestra en la página pública)</Label>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleSave}
              disabled={saveMutation.isPending}
              className="bg-[#ff7f33] hover:bg-[#e66a1f]"
            >
              {saveMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
