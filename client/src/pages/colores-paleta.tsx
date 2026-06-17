import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Palette, Search, Save, Loader2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface PaletteEntry {
  nombreColor: string;
  hex: string | null;
}

const DEFAULT_HEX = "#cbd5e1";
const isValidHex = (h: string) => /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(h.trim());

export default function ColoresPaleta() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery<{ palette: PaletteEntry[] }>({
    queryKey: ["/api/color-palette"],
    queryFn: async () => {
      const res = await fetch("/api/color-palette", { credentials: "include" });
      if (!res.ok) throw new Error("No se pudo cargar la paleta");
      return res.json();
    },
  });

  // Sincroniza el borrador con lo que llega del server (sin pisar ediciones).
  useEffect(() => {
    if (!data?.palette) return;
    setDraft((prev) => {
      const next = { ...prev };
      for (const p of data.palette) {
        if (next[p.nombreColor] === undefined) next[p.nombreColor] = p.hex || DEFAULT_HEX;
      }
      return next;
    });
  }, [data]);

  const palette = data?.palette ?? [];
  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return palette.filter((p) => !s || p.nombreColor.toLowerCase().includes(s));
  }, [palette, search]);

  // Colores cuyo hex en borrador difiere del guardado (o que no tenían hex).
  const dirty = useMemo(
    () => palette.filter((p) => draft[p.nombreColor] && draft[p.nombreColor] !== (p.hex || "")),
    [palette, draft]
  );

  const save = async () => {
    const colors = dirty
      .map((p) => ({ nombreColor: p.nombreColor, hex: (draft[p.nombreColor] || "").trim() }))
      .filter((c) => isValidHex(c.hex));
    if (colors.length === 0) {
      toast({ title: "Sin cambios válidos para guardar" });
      return;
    }
    setSaving(true);
    try {
      const res = await apiRequest("/api/color-palette", { method: "PUT", data: { colors } });
      const json = await res.json();
      toast({ title: `Guardado`, description: `${json.saved} color(es) actualizados` });
      queryClient.invalidateQueries({ queryKey: ["/api/color-palette"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products/grouped-catalog"] });
    } catch (e: any) {
      toast({ title: "Error al guardar", description: e?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-4xl">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5 text-orange-500" />
                Paleta de colores
              </CardTitle>
              <CardDescription>
                Define el color (hex) de cada nombre del catálogo. Se usa en los swatches del
                Tomador de Pedidos / Constructor de Presupuesto.
              </CardDescription>
            </div>
            <Button onClick={save} disabled={saving || dirty.length === 0} className="bg-orange-500 hover:bg-orange-600">
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Guardar{dirty.length > 0 ? ` (${dirty.length})` : ""}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar color..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {isLoading ? (
            <div className="py-12 text-center text-muted-foreground">
              <Loader2 className="h-6 w-6 mx-auto animate-spin mb-2" />
              Cargando colores...
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">
              No hay colores en el catálogo (o ninguno coincide con la búsqueda).
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {filtered.map((p) => {
                const value = draft[p.nombreColor] || DEFAULT_HEX;
                const valid = isValidHex(value);
                return (
                  <div
                    key={p.nombreColor}
                    className="flex items-center gap-3 border rounded-xl px-3 py-2 bg-white"
                  >
                    <span
                      className="w-8 h-8 rounded-full border flex-shrink-0"
                      style={{ background: valid ? value : "#cbd5e1" }}
                    />
                    <span className="flex-1 min-w-0 text-sm font-medium truncate" title={p.nombreColor}>
                      {p.nombreColor}
                    </span>
                    <input
                      type="color"
                      value={valid ? value : DEFAULT_HEX}
                      onChange={(e) => setDraft((d) => ({ ...d, [p.nombreColor]: e.target.value }))}
                      className="w-9 h-9 rounded cursor-pointer border bg-transparent p-0.5"
                      title="Elegir color"
                    />
                    <Input
                      value={value}
                      onChange={(e) => setDraft((d) => ({ ...d, [p.nombreColor]: e.target.value }))}
                      className={`w-24 font-mono text-xs ${valid ? "" : "border-red-400"}`}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
