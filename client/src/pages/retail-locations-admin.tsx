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
import { MapPin, Plus, Pencil, Trash2, Search, Loader2, ExternalLink, Download, CheckCircle2, XCircle, Code, Copy, Check } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { ComunaSelect } from "@/components/shared/comuna-select";
import { regionDeComuna } from "@shared/chile-geo";

type RetailLocation = {
  id: string;
  name: string;
  type: "sucursal_propia" | "distribuidor" | "ferreteria";
  address: string;
  comuna?: string | null;
  region?: string | null;
  latitude: string | null;
  longitude: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  schedule?: string | null;
  logoUrl?: string | null;
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

type Candidate = {
  id: string;
  name: string;
  address: string;
  comuna: string | null;
  region: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  business_type: string | null;
  alreadyImported: boolean;
};

type ImportResult = {
  inserted: number;
  skipped: number;
  failed: number;
  details: { id: string; name: string; status: string; reason?: string }[];
};

export default function RetailLocationsAdmin() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<FormState | null>(null);
  const [open, setOpen] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [months, setMonths] = useState(2);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [geocodeOnImport, setGeocodeOnImport] = useState(false);
  const [geocodingRowId, setGeocodingRowId] = useState<string | null>(null);
  const [embedOpen, setEmbedOpen] = useState(false);
  const [embedHeight, setEmbedHeight] = useState(700);
  const [embedCopied, setEmbedCopied] = useState(false);

  const embedOrigin = typeof window !== "undefined" ? window.location.origin : "";
  const embedSrc = `${embedOrigin}/donde-comprar?embed=1`;
  const embedCode = `<iframe src="${embedSrc}" width="100%" height="${embedHeight}" style="border:0;border-radius:12px;" loading="lazy" title="Dónde Comprar - Panorámica" allowfullscreen></iframe>`;

  const copyEmbed = async () => {
    try {
      await navigator.clipboard.writeText(embedCode);
      setEmbedCopied(true);
      toast({ title: "Código copiado" });
      setTimeout(() => setEmbedCopied(false), 2000);
    } catch (err: any) {
      toast({ title: "No se pudo copiar", description: err.message, variant: "destructive" });
    }
  };

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

  const candidatesQuery = useQuery<Candidate[]>({
    queryKey: ["/api/admin/retail-locations/candidates", months],
    queryFn: async () => {
      const res = await apiRequest(`/api/admin/retail-locations/candidates?months=${months}`, { method: "GET" });
      return res.json();
    },
    enabled: importOpen,
  });

  const importMutation = useMutation({
    mutationFn: async (payload: { clientIds: string[]; geocode: boolean }) => {
      const res = await apiRequest("/api/admin/retail-locations/import-candidates", { method: "POST", data: payload });
      return res.json() as Promise<ImportResult>;
    },
    onSuccess: (result) => {
      setImportResult(result);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/retail-locations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/retail-locations/candidates", months] });
      setSelectedIds(new Set());
      toast({
        title: `Importación completada`,
        description: `${result.inserted} nuevas · ${result.skipped} ya existían · ${result.failed} fallaron`,
      });
    },
    onError: (err: any) => {
      toast({ title: "Error al importar", description: err.message, variant: "destructive" });
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
    if (!editing.name || !editing.address) {
      toast({ title: "Faltan campos", description: "Nombre y dirección son obligatorios", variant: "destructive" });
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
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => setEmbedOpen(true)}
          >
            <Code className="w-4 h-4 mr-2" /> Insertar en sitio web
          </Button>
          <Button
            variant="outline"
            onClick={() => { setImportResult(null); setImportOpen(true); }}
          >
            <Download className="w-4 h-4 mr-2" /> Importar ferreterías
          </Button>
          <Button onClick={openNew} className="bg-[#ff7f33] hover:bg-[#e66a1f]">
            <Plus className="w-4 h-4 mr-2" /> Agregar ubicación
          </Button>
        </div>
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
                  <td className="px-4 py-3 font-medium">
                    <div className="flex items-center gap-2">
                      <span>{loc.name}</span>
                      {(!loc.latitude || !loc.longitude) && (
                        <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 text-[10px]">sin coords</Badge>
                      )}
                    </div>
                  </td>
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
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {(!loc.latitude || !loc.longitude) && (
                      <Button
                        size="sm"
                        variant="ghost"
                        title="Geocodificar"
                        disabled={geocodingRowId === loc.id}
                        onClick={async () => {
                          setGeocodingRowId(loc.id);
                          try {
                            const res = await apiRequest(`/api/admin/retail-locations/${loc.id}/geocode`, { method: "POST" });
                            const json = await res.json();
                            if (json.success) {
                              queryClient.invalidateQueries({ queryKey: ["/api/admin/retail-locations"] });
                              toast({ title: "Geocodificada", description: `${json.latitude}, ${json.longitude}` });
                            } else {
                              toast({ title: "No se encontró", description: json.message || "Sin resultados", variant: "destructive" });
                            }
                          } catch (err: any) {
                            toast({ title: "Error", description: err.message, variant: "destructive" });
                          } finally {
                            setGeocodingRowId(null);
                          }
                        }}
                      >
                        {geocodingRowId === loc.id
                          ? <Loader2 className="w-4 h-4 animate-spin" />
                          : <MapPin className="w-4 h-4 text-amber-600" />}
                      </Button>
                    )}
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

              {/* Comuna del catálogo oficial; la región se deriva de ella y se
                  guarda junto, para que el buscador de "Dónde Comprar" agrupe. */}
              <div>
                <Label>Comuna</Label>
                <ComunaSelect
                  value={editing.comuna}
                  onChange={(comuna) => setEditing({
                    ...editing,
                    comuna,
                    region: comuna ? regionDeComuna(comuna)?.nombreCorto ?? null : null,
                  })}
                />
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
                <Label>Logo (opcional)</Label>
                <div className="flex items-center gap-3">
                  {editing.logoUrl && (
                    <div className="w-14 h-14 rounded-xl overflow-hidden bg-white border flex items-center justify-center flex-shrink-0">
                      <img src={editing.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                    </div>
                  )}
                  <div className="flex-1">
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const formData = new FormData();
                        formData.append("file", file);
                        try {
                          const res = await fetch("/api/upload", { method: "POST", body: formData, credentials: "include" });
                          const json = await res.json();
                          if (json.url) {
                            setEditing({ ...editing, logoUrl: json.url });
                            toast({ title: "Logo subido" });
                          } else {
                            throw new Error(json.message || "error");
                          }
                        } catch (err: any) {
                          toast({ title: "Error al subir", description: err.message, variant: "destructive" });
                        }
                      }}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Si no subís logo, se usa el ícono Panorámica por defecto.
                    </p>
                  </div>
                  {editing.logoUrl && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditing({ ...editing, logoUrl: null })}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
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

      {/* Import ferreterías dialog */}
      <Dialog open={importOpen} onOpenChange={(v) => { setImportOpen(v); if (!v) setImportResult(null); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Importar ferreterías con compras recientes</DialogTitle>
          </DialogHeader>

          {importResult ? (
            <div className="py-4 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                  <CheckCircle2 className="w-6 h-6 text-green-600 mx-auto mb-1" />
                  <div className="text-2xl font-bold text-green-700">{importResult.inserted}</div>
                  <div className="text-xs text-green-600">Nuevas</div>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-gray-700">{importResult.skipped}</div>
                  <div className="text-xs text-gray-600">Ya existían</div>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                  <XCircle className="w-6 h-6 text-red-600 mx-auto mb-1" />
                  <div className="text-2xl font-bold text-red-700">{importResult.failed}</div>
                  <div className="text-xs text-red-600">Fallaron</div>
                </div>
              </div>
              {importResult.details.filter(d => d.status === 'failed').length > 0 && (
                <div className="border rounded-lg p-3 max-h-60 overflow-y-auto">
                  <div className="text-xs font-semibold text-gray-500 mb-2">Detalles de fallos:</div>
                  {importResult.details.filter(d => d.status === 'failed').map((d, i) => (
                    <div key={i} className="text-xs text-gray-600 py-1">
                      <span className="font-medium">{d.name}</span>: <span className="text-red-600">{d.reason}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="py-4 space-y-4">
              <div className="flex items-center gap-3">
                <Label className="text-sm whitespace-nowrap">Compras en los últimos</Label>
                <Input
                  type="number"
                  min={1}
                  max={24}
                  value={months}
                  onChange={(e) => setMonths(Math.max(1, parseInt(e.target.value) || 2))}
                  className="w-20"
                />
                <Label className="text-sm">meses</Label>
              </div>

              {candidatesQuery.isLoading && (
                <div className="py-8 text-center text-gray-400">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                </div>
              )}

              {candidatesQuery.isError && (
                <div className="py-6 px-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  <div className="font-semibold mb-1">Error al consultar candidatos</div>
                  <div className="text-xs break-all">{(candidatesQuery.error as any)?.message || 'Error desconocido'}</div>
                </div>
              )}

              {candidatesQuery.data && (
                <>
                  <div className="flex items-center justify-between text-sm text-gray-600">
                    <span>
                      {candidatesQuery.data.length} ferretería(s) con compras · {candidatesQuery.data.filter(c => !c.alreadyImported).length} importable(s)
                    </span>
                    <button
                      className="text-[#ff7f33] font-semibold hover:underline"
                      onClick={() => {
                        const importables = candidatesQuery.data!.filter(c => !c.alreadyImported).map(c => c.id);
                        setSelectedIds(new Set(selectedIds.size === importables.length ? [] : importables));
                      }}
                    >
                      {selectedIds.size > 0 ? "Deseleccionar" : "Seleccionar todas"}
                    </button>
                  </div>

                  <div className="border rounded-lg max-h-96 overflow-y-auto">
                    {candidatesQuery.data.length === 0 && (
                      <div className="p-6 text-center text-gray-400 text-sm">Sin ferreterías con compras en el período.</div>
                    )}
                    {candidatesQuery.data.map((c) => (
                      <label
                        key={c.id}
                        className={`flex items-start gap-3 p-3 border-b last:border-0 ${
                          c.alreadyImported ? "bg-gray-50 opacity-60" : "hover:bg-gray-50 cursor-pointer"
                        }`}
                      >
                        <Checkbox
                          checked={selectedIds.has(c.id)}
                          disabled={c.alreadyImported}
                          onCheckedChange={(v) => {
                            const next = new Set(selectedIds);
                            if (v) next.add(c.id); else next.delete(c.id);
                            setSelectedIds(next);
                          }}
                          className="mt-1"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm truncate">{c.name}</span>
                            {c.alreadyImported && <Badge variant="secondary" className="text-[10px]">Ya importada</Badge>}
                          </div>
                          <div className="text-xs text-gray-500 truncate">
                            {c.address}{c.comuna ? `, ${c.comuna}` : ""}{c.region ? `, ${c.region}` : ""}
                          </div>
                          {c.phone && <div className="text-xs text-gray-400">{c.phone}</div>}
                        </div>
                      </label>
                    ))}
                  </div>

                  <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <Switch checked={geocodeOnImport} onCheckedChange={setGeocodeOnImport} />
                    <div className="text-xs text-amber-800 flex-1">
                      <div className="font-semibold">Geocodificar al importar</div>
                      <div>
                        {geocodeOnImport
                          ? "⏱️ Tarda ~1 segundo por dirección. Para 50 puntos son ~1 minuto."
                          : "🚀 Importación rápida. Las ferreterías se crean sin coordenadas y podés geocodificar después una por una desde la lista."}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          <DialogFooter>
            {importResult ? (
              <Button onClick={() => { setImportOpen(false); setImportResult(null); }} className="bg-[#ff7f33] hover:bg-[#e66a1f]">
                Cerrar
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setImportOpen(false)}>Cancelar</Button>
                <Button
                  onClick={() => importMutation.mutate({ clientIds: Array.from(selectedIds), geocode: geocodeOnImport })}
                  disabled={selectedIds.size === 0 || importMutation.isPending}
                  className="bg-[#ff7f33] hover:bg-[#e66a1f]"
                >
                  {importMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Importar {selectedIds.size > 0 ? `(${selectedIds.size})` : ""}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Embed dialog: snippet de iframe para insertar en sitio externo */}
      <Dialog open={embedOpen} onOpenChange={(v) => { setEmbedOpen(v); if (!v) setEmbedCopied(false); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Code className="w-5 h-5 text-[#ff7f33]" />
              Insertar Dónde Comprar en sitio web
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <p className="text-sm text-gray-600">
              Copiá este código HTML y pegalo en tu sitio donde quieras mostrar el mapa con sucursales,
              distribuidores y ferreterías. Se actualiza solo cuando edites las ubicaciones desde acá.
            </p>

            <div className="flex items-center gap-3">
              <Label className="text-sm whitespace-nowrap">Alto (px)</Label>
              <Input
                type="number"
                min={400}
                max={1600}
                value={embedHeight}
                onChange={(e) => setEmbedHeight(Math.max(400, parseInt(e.target.value) || 700))}
                className="w-28"
              />
              <span className="text-xs text-gray-500">Recomendado: 600–800 px</span>
            </div>

            <div className="relative">
              <Textarea
                value={embedCode}
                readOnly
                rows={5}
                className="font-mono text-xs bg-gray-50 pr-12"
                onFocus={(e) => e.currentTarget.select()}
              />
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="absolute top-2 right-2"
                onClick={copyEmbed}
                title="Copiar al portapapeles"
              >
                {embedCopied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 space-y-1">
              <div className="font-semibold">Tips de integración</div>
              <ul className="list-disc list-inside space-y-1">
                <li>El iframe es responsive: el ancho se adapta al contenedor.</li>
                <li>En WordPress / Wix / Webflow, pegalo en un bloque "HTML personalizado" o "Embed".</li>
                <li>El parámetro <code className="bg-amber-100 px-1 rounded">?embed=1</code> oculta la cabecera de Panorámica para que se integre limpio.</li>
              </ul>
            </div>

            <div>
              <Label className="text-xs text-gray-500">Vista previa</Label>
              <div className="border rounded-lg overflow-hidden mt-1">
                <iframe
                  src={embedSrc}
                  width="100%"
                  height={320}
                  style={{ border: 0, display: "block" }}
                  title="Preview Dónde Comprar"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEmbedOpen(false)}>Cerrar</Button>
            <Button onClick={copyEmbed} className="bg-[#ff7f33] hover:bg-[#e66a1f]">
              {embedCopied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
              {embedCopied ? "Copiado" : "Copiar código"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
