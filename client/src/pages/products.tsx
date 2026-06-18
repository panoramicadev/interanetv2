import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Search, Upload, Package, TrendingUp, Warehouse, Edit, History, Filter, Eye, Building2, Globe, ShoppingCart, Tags, Image, Settings, Link, Palette, BarChart3, Layers, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, ExternalLink, RefreshCw, BookOpen, ImageIcon, Truck, Save, DollarSign, Tag, Plus, Trash2, ArrowUpDown, GripVertical, Check, X, Percent } from "lucide-react";
import { PriceList } from "@shared/schema";
import { PRODUCT_FORMATS } from "@shared/format-utils";
import GroupedCatalog from "@/components/grouped-catalog";
import { InventarioContent } from "@/pages/inventario";
import ListaPrecios from "@/pages/lista-precios";
import BulkImageUpload from "@/components/products/bulk-image-upload";

// Fletes (Shipping rates) component
function FletesContent() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Derive shipping format options from the centralized PRODUCT_FORMATS
  const FORMATS = Object.entries(PRODUCT_FORMATS)
    .filter(([, def]) => def.shippingKey !== 'unidad') // Exclude 'Unidad' from shipping rates
    .sort(([, a], [, b]) => a.sortOrder - b.sortOrder)
    .map(([, def]) => ({
      key: def.shippingKey,
      label: def.label,
      description: `Precio flete por unidad — ${def.label}`,
    }));

  // Fetch shipping rates
  const { data: rawShippingRates = {}, isLoading } = useQuery<Record<string, any>>({
    queryKey: ['/api/ecommerce/shipping-rates'],
    queryFn: async () => {
      try {
        const res = await apiRequest('GET', '/api/ecommerce/shipping-rates');
        return await res.json();
      } catch {
        return {};
      }
    },
  });

  const [rates, setRates] = useState<Record<string, string>>({});
  const [skus, setSkus] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Initialize rates from fetched data
  useEffect(() => {
    if (Object.keys(rawShippingRates).length > 0) {
      const initial: Record<string, string> = {};
      const initialSkus: Record<string, string> = {};
      FORMATS.forEach(f => {
        const val = rawShippingRates[f.key];
        if (typeof val === 'object' && val !== null) {
          initial[f.key] = val.price?.toString() || '';
          initialSkus[f.key] = val.sku || '';
        } else {
          initial[f.key] = val?.toString() || '';
          initialSkus[f.key] = '';
        }
      });
      setRates(initial);
      setSkus(initialSkus);
    }
  }, [rawShippingRates]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload: Record<string, any> = {};
      FORMATS.forEach(f => {
        const val = parseFloat(rates[f.key] || '0');
        payload[f.key] = { price: isNaN(val) ? 0 : val, sku: skus[f.key] || '' };
      });
      await apiRequest('PUT', '/api/ecommerce/shipping-rates', payload);
      queryClient.invalidateQueries({ queryKey: ['/api/ecommerce/shipping-rates'] });
      toast({ title: 'Tarifas de flete actualizadas' });
    } catch {
      toast({ title: 'Error al guardar tarifas', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
    <Card className="border-0 shadow-sm rounded-xl overflow-hidden">
      <CardHeader className="bg-muted/30 border-b px-4 sm:px-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <Truck className="h-5 w-5 text-orange-500 flex-shrink-0" />
              Tarifas de Flete por Formato
            </CardTitle>
            <CardDescription className="mt-0.5">
              Define el costo de envío estándar por tipo de formato de producto y su SKU de despacho
            </CardDescription>
          </div>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="gap-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg w-full sm:w-auto flex-shrink-0"
          >
            <Save className="h-4 w-4" />
            {isSaving ? 'Guardando...' : 'Guardar Tarifas'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-orange-500 border-t-transparent" />
          </div>
        ) : (
          <div className="grid gap-6 max-w-3xl">
            {FORMATS.map((format) => (
              <div key={format.key} className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 p-4 rounded-xl bg-muted/30 border border-muted hover:border-orange-200 transition-colors">
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-bold text-foreground">{format.label}</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">{format.description}</p>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-44">
                  <DollarSign className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <Input
                    type="number"
                    placeholder="0"
                    value={rates[format.key] || ''}
                    onChange={(e) => setRates(prev => ({ ...prev, [format.key]: e.target.value }))}
                    className="h-10 rounded-lg text-right font-mono"
                  />
                  <span className="text-xs text-muted-foreground whitespace-nowrap">CLP</span>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-48">
                  <Tag className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <Input
                    type="text"
                    placeholder="SKU despacho"
                    value={skus[format.key] || ''}
                    onChange={(e) => setSkus(prev => ({ ...prev, [format.key]: e.target.value }))}
                    className="h-10 rounded-lg text-xs font-mono"
                  />
                </div>
              </div>
            ))}

            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 mt-2">
              <Truck className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-700 dark:text-amber-400">
                Estas tarifas y SKUs están sincronizadas con la Configuración de Checkout del Ecommerce. Si se modifican aquí, se actualizarán en toda la plataforma.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>

    {/* Free Shipping Threshold Config */}
    <FreeShippingThresholdConfig />
  </>
  );
}

// Free Shipping Threshold sub-component
function FreeShippingThresholdConfig() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: thresholdData, isLoading } = useQuery<{ threshold: number }>({
    queryKey: ['/api/ecommerce/free-shipping-threshold'],
    retry: false,
  });

  const [thresholdValue, setThresholdValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (thresholdData?.threshold !== undefined) {
      setThresholdValue(thresholdData.threshold.toString());
    }
  }, [thresholdData]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await apiRequest('PUT', '/api/ecommerce/free-shipping-threshold', {
        threshold: parseFloat(thresholdValue) || 0
      });
      queryClient.invalidateQueries({ queryKey: ['/api/ecommerce/free-shipping-threshold'] });
      toast({ title: 'Monto de envío gratis actualizado' });
    } catch {
      toast({ title: 'Error al guardar', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="border-0 shadow-sm rounded-xl overflow-hidden mt-4">
      <CardHeader className="bg-emerald-50/50 dark:bg-emerald-950/20 border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Package className="h-5 w-5 text-emerald-500" />
              Envío Gratis
            </CardTitle>
            <CardDescription className="mt-0.5">
              Monto mínimo de compra para envío gratuito. Se muestra en la tienda y en el carrito.
            </CardDescription>
          </div>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="gap-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg"
          >
            <Save className="h-4 w-4" />
            {isSaving ? 'Guardando...' : 'Guardar'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-emerald-500 border-t-transparent" />
          </div>
        ) : (
          <div className="max-w-md">
            <label className="text-sm font-medium text-foreground mb-2 block">
              Monto mínimo para envío gratis (CLP)
            </label>
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <Input
                type="number"
                placeholder="250000"
                value={thresholdValue}
                onChange={(e) => setThresholdValue(e.target.value)}
                className="h-10 rounded-lg text-right font-mono max-w-xs"
              />
              <span className="text-xs text-muted-foreground whitespace-nowrap">CLP</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Ej: 250000 se mostrará como "Envío gratis sobre $250.000" en la tienda.
              {thresholdValue && parseFloat(thresholdValue) > 0 && (
                <span className="block mt-1 text-emerald-600 font-medium">
                  → Envío gratis sobre ${parseFloat(thresholdValue).toLocaleString('es-CL')}
                </span>
              )}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Product adder component for categories (uses its own state for the select)
function CategoryProductAdder({ catalog, categoryName, assignMutation }: {
  catalog: any[];
  categoryName: string;
  assignMutation: any;
}) {
  const [selectedProduct, setSelectedProduct] = useState('');
  return (
    <div className="p-3 sm:p-4 bg-muted/10 border-b space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">Agregar producto:</span>
        <Select value={selectedProduct} onValueChange={setSelectedProduct}>
          <SelectTrigger className="h-8 text-xs flex-1">
            <SelectValue placeholder="Seleccionar producto..." />
          </SelectTrigger>
          <SelectContent>
            {catalog
              .filter((p: any) => {
                const cats: string[] = p.categories || (p.groupName ? [p.groupName] : []);
                return !cats.includes(categoryName); // Show if NOT already in this category
              })
              .sort((a: any, b: any) => a.genericName.localeCompare(b.genericName))
              .map((p: any) => (
                <SelectItem key={p.genericName} value={p.genericName} className="text-xs">
                  {p.genericName} {p.groupName ? `(${p.groupName})` : ''}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          className="h-8 px-4 bg-orange-500 hover:bg-orange-600 text-white text-xs gap-1 flex-shrink-0"
          disabled={!selectedProduct || assignMutation.isPending}
          onClick={() => {
            if (selectedProduct) {
              assignMutation.mutate({ productFamily: selectedProduct, categoryName });
              setSelectedProduct('');
            }
          }}
        >
          <Plus className="h-3.5 w-3.5" />
          Agregar
        </Button>
      </div>
    </div>
  );
}

// Categorías y Etiquetas component
function CategoriasEtiquetasContent() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newCatName, setNewCatName] = useState("");
  const [newCatDesc, setNewCatDesc] = useState("");
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editingCatName, setEditingCatName] = useState("");

  const TAG_COLOR_OPTIONS = ['green', 'blue', 'amber', 'red', 'purple', 'pink', 'cyan', 'orange', 'indigo', 'teal'];
  const TAG_COLOR_MAP: Record<string, string> = {
    green: 'bg-green-500', blue: 'bg-blue-500', amber: 'bg-amber-500', red: 'bg-red-500',
    purple: 'bg-purple-500', pink: 'bg-pink-500', cyan: 'bg-cyan-500', orange: 'bg-orange-500',
    indigo: 'bg-indigo-500', teal: 'bg-teal-500',
  };

  // Fetch tags from API
  const { data: availableTags = [] } = useQuery<{ name: string; color: string }[]>({
    queryKey: ['/api/ecommerce/tags'],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/ecommerce/tags");
      return res.json();
    },
  });

  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("green");
  const [editingTagIdx, setEditingTagIdx] = useState<number | null>(null);
  const [editingTagName, setEditingTagName] = useState("");

  const saveTagsMutation = useMutation({
    mutationFn: async (tags: { name: string; color: string }[]) => {
      const res = await fetch("/api/ecommerce/tags", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Error al guardar etiquetas");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ecommerce/tags'] });
      queryClient.invalidateQueries({ queryKey: ['/api/store/tags'] });
      toast({ title: "Etiquetas actualizadas" });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Error", description: "No se pudieron guardar" });
    },
  });

  const addTag = () => {
    if (!newTagName.trim()) return;
    if (availableTags.some(t => t.name.toLowerCase() === newTagName.trim().toLowerCase())) {
      toast({ variant: "destructive", title: "Error", description: "Ya existe una etiqueta con ese nombre" });
      return;
    }
    saveTagsMutation.mutate([...availableTags, { name: newTagName.trim(), color: newTagColor }]);
    setNewTagName("");
    setNewTagColor("green");
  };

  const removeTag = (idx: number) => {
    if (!confirm(`¿Eliminar etiqueta "${availableTags[idx].name}"?`)) return;
    saveTagsMutation.mutate(availableTags.filter((_, i) => i !== idx));
  };

  const saveEditTag = (idx: number) => {
    if (!editingTagName.trim()) return;
    const updated = [...availableTags];
    updated[idx] = { ...updated[idx], name: editingTagName.trim() };
    saveTagsMutation.mutate(updated);
    setEditingTagIdx(null);
  };

  const updateTagColor = (idx: number, color: string) => {
    const updated = [...availableTags];
    updated[idx] = { ...updated[idx], color };
    saveTagsMutation.mutate(updated);
  };
  const CATEGORY_COLORS = [
    "#f97316", "#3b82f6", "#10b981", "#8b5cf6", "#ec4899",
    "#f59e0b", "#06b6d4", "#ef4444", "#84cc16", "#6366f1"
  ];

  // Fetch grouped catalog
  const { data, isLoading } = useQuery<{ catalog: any[]; availableGroups: string[] }>({
    queryKey: ["/api/products/grouped-catalog", { search: "", groupFilter: "all" }],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/products/grouped-catalog");
      return res.json();
    },
  });

  // Fetch custom categories
  const { data: customCategories = [] } = useQuery<any[]>({
    queryKey: ["/api/ecommerce/categories-config"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/ecommerce/categories-config");
      return res.json();
    },
  });

  const catalog = data?.catalog || [];

  // Group products by their categories (multi-category support)
  const productsByCategory = new Map<string, any[]>();
  const unassigned: any[] = [];
  catalog.forEach(product => {
    const cats: string[] = product.categories || (product.groupName ? [product.groupName] : []);
    if (cats.length === 0) {
      unassigned.push(product);
    } else {
      cats.forEach(cat => {
        if (!productsByCategory.has(cat)) productsByCategory.set(cat, []);
        productsByCategory.get(cat)!.push(product);
      });
    }
  });

  // Create category mutation
  const createCatMutation = useMutation({
    mutationFn: async (data: { name: string; description: string }) => {
      const res = await fetch("/api/ecommerce/categories-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, color: CATEGORY_COLORS[customCategories.length % CATEGORY_COLORS.length] }),
        credentials: "include",
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.message); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ecommerce/categories-config"] });
      setNewCatName("");
      setNewCatDesc("");
      toast({ title: "Categoría creada", description: "La categoría se creó correctamente." });
    },
    onError: (e) => toast({ variant: "destructive", title: "Error", description: String(e.message) }),
  });

  // Delete category mutation
  const deleteCatMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/ecommerce/categories-config/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Error al eliminar");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ecommerce/categories-config"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products/grouped-catalog"] });
      toast({ title: "Categoría eliminada" });
    },
  });

  // Rename category mutation
  const renameCatMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const res = await fetch(`/api/ecommerce/categories-config/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
        credentials: "include",
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.message); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ecommerce/categories-config"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products/grouped-catalog"] });
      queryClient.invalidateQueries({ queryKey: ["/api/public/products/grouped"] });
      queryClient.invalidateQueries({ queryKey: ["/api/store/categories"] });
      setEditingCatId(null);
      setEditingCatName("");
      toast({ title: "Categoría renombrada" });
    },
    onError: (e) => toast({ variant: "destructive", title: "Error", description: String(e.message) }),
  });

  // Reorder category mutation
  const reorderCatMutation = useMutation({
    mutationFn: async ({ id, direction }: { id: string; direction: 'up' | 'down' }) => {
      const res = await fetch("/api/ecommerce/categories-config/reorder", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, direction }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Error al reordenar");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ecommerce/categories-config"] });
      queryClient.invalidateQueries({ queryKey: ["/api/store/categories"] });
    },
  });

  // Assign product to category
  const assignMutation = useMutation({
    mutationFn: async ({ productFamily, categoryName, action }: { productFamily: string; categoryName: string | null; action?: 'add' | 'remove' }) => {
      const res = await fetch("/api/ecommerce/product-category", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productFamily, categoryName, action: action || 'add' }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Error al asignar");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products/grouped-catalog"] });
      queryClient.invalidateQueries({ queryKey: ["/api/public/products/grouped"] });
    },
    onError: () => toast({ variant: "destructive", title: "Error al asignar producto" }),
  });

  // Tag mutation
  const tagMutation = useMutation({
    mutationFn: async ({ productFamily, tag, action }: { productFamily: string; tag: string; action: 'add' | 'remove' }) => {
      const res = await fetch("/api/products/grouped-catalog/tags", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productFamily, tag, action }),
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products/grouped-catalog"] });
      queryClient.invalidateQueries({ queryKey: ["/api/public/products/grouped"] });
    },
    onError: (error) => {
      toast({ variant: "destructive", title: "Error", description: String(error) });
    },
  });

  const toggleCat = (id: string) => {
    setExpandedCats(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  // All category names for the dropdown
  const allCategoryNames = customCategories.map((c: any) => c.name);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="border-0 shadow-sm bg-gradient-to-br from-orange-50 to-orange-100/50">
          <CardContent className="p-3 sm:p-4">
            <p className="text-[10px] font-medium text-orange-600 uppercase tracking-wider">Categorías</p>
            <p className="text-2xl font-bold text-orange-900">{customCategories.length}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-gradient-to-br from-blue-50 to-blue-100/50">
          <CardContent className="p-3 sm:p-4">
            <p className="text-[10px] font-medium text-blue-600 uppercase tracking-wider">Productos</p>
            <p className="text-2xl font-bold text-blue-900">{catalog.length}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-gradient-to-br from-green-50 to-green-100/50">
          <CardContent className="p-3 sm:p-4">
            <p className="text-[10px] font-medium text-green-600 uppercase tracking-wider">Asignados</p>
            <p className="text-2xl font-bold text-green-900">{catalog.filter(p => p.groupName).length}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-gradient-to-br from-purple-50 to-purple-100/50">
          <CardContent className="p-3 sm:p-4">
            <p className="text-[10px] font-medium text-purple-600 uppercase tracking-wider">Sin Categoría</p>
            <p className="text-2xl font-bold text-purple-900">{unassigned.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Create Category */}
      <Card className="border-0 shadow-sm rounded-xl">
        <CardHeader className="bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-t-xl px-6 py-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Crear Nueva Categoría
          </CardTitle>
          <CardDescription className="text-white/80 text-xs mt-0.5">
            Crea categorías personalizadas para organizar tus productos en la tienda
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <Input
                placeholder="Nombre de la categoría (ej: Pintura para techos)"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                className="h-10"
              />
            </div>
            <div className="flex-1">
              <Input
                placeholder="Descripción (opcional)"
                value={newCatDesc}
                onChange={(e) => setNewCatDesc(e.target.value)}
                className="h-10"
              />
            </div>
            <Button
              onClick={() => createCatMutation.mutate({ name: newCatName, description: newCatDesc })}
              disabled={!newCatName.trim() || createCatMutation.isPending}
              className="bg-orange-500 hover:bg-orange-600 text-white h-10 px-6"
            >
              <Plus className="h-4 w-4 mr-1" />
              {createCatMutation.isPending ? "Creando..." : "Crear"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Etiquetas disponibles — Editable */}
      <Card className="border-0 shadow-sm rounded-xl">
        <CardHeader className="bg-muted/30 border-b px-6 py-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Tags className="h-5 w-5 text-orange-500" />
            Etiquetas Disponibles
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 space-y-4">
          {/* Existing tags */}
          <div className="flex flex-wrap gap-3">
            {availableTags.map((tag, idx) => {
              const count = catalog.filter(p => (p.tags || []).includes(tag.name)).length;
              const isEditing = editingTagIdx === idx;
              return (
                <div key={idx} className="flex items-center gap-2 p-2.5 rounded-xl bg-muted/30 border border-muted group">
                  {/* Color dot — click to change */}
                  <div className="relative">
                    <button
                      className={`w-4 h-4 rounded-full ${TAG_COLOR_MAP[tag.color] || 'bg-gray-500'} cursor-pointer hover:ring-2 hover:ring-offset-1 hover:ring-gray-300 transition-all`}
                      onClick={() => {
                        const currentIdx = TAG_COLOR_OPTIONS.indexOf(tag.color);
                        const nextColor = TAG_COLOR_OPTIONS[(currentIdx + 1) % TAG_COLOR_OPTIONS.length];
                        updateTagColor(idx, nextColor);
                      }}
                      title="Cambiar color"
                    />
                  </div>
                  {isEditing ? (
                    <div className="flex items-center gap-1">
                      <Input
                        value={editingTagName}
                        onChange={e => setEditingTagName(e.target.value)}
                        className="h-6 text-xs w-28 px-1.5"
                        onKeyDown={e => e.key === 'Enter' && saveEditTag(idx)}
                        autoFocus
                      />
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => saveEditTag(idx)}>
                        <Check className="h-3 w-3 text-green-600" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setEditingTagIdx(null)}>
                        <X className="h-3 w-3 text-red-500" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <span
                        className="text-sm font-semibold cursor-pointer hover:text-orange-600 transition-colors"
                        onClick={() => { setEditingTagIdx(idx); setEditingTagName(tag.name); }}
                        title="Clic para editar"
                      >
                        {tag.name}
                      </span>
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{count}</Badge>
                      <button
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-600 ml-1"
                        onClick={() => removeTag(idx)}
                        title="Eliminar etiqueta"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {/* Add new tag */}
          <div className="flex items-center gap-2 pt-2 border-t">
            <div className="flex items-center gap-2 flex-1">
              <button
                className={`w-5 h-5 rounded-full ${TAG_COLOR_MAP[newTagColor] || 'bg-gray-500'} cursor-pointer hover:ring-2 hover:ring-offset-1 transition-all flex-shrink-0`}
                onClick={() => {
                  const idx = TAG_COLOR_OPTIONS.indexOf(newTagColor);
                  setNewTagColor(TAG_COLOR_OPTIONS[(idx + 1) % TAG_COLOR_OPTIONS.length]);
                }}
                title="Cambiar color"
              />
              <Input
                value={newTagName}
                onChange={e => setNewTagName(e.target.value)}
                placeholder="Nueva etiqueta..."
                className="h-8 text-sm"
                onKeyDown={e => e.key === 'Enter' && addTag()}
              />
            </div>
            <Button
              size="sm"
              onClick={addTag}
              disabled={!newTagName.trim() || saveTagsMutation.isPending}
              className="h-8 gap-1 bg-orange-500 hover:bg-orange-600 text-white"
            >
              <Plus className="h-3.5 w-3.5" />
              Agregar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Custom Categories — Visual Grouped View */}
      <Card className="border-0 shadow-sm rounded-xl overflow-hidden">
        <CardHeader className="bg-muted/30 border-b px-6 py-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Layers className="h-5 w-5 text-orange-500" />
            Categorías y Productos Asignados
          </CardTitle>
          <CardDescription className="text-xs mt-0.5">
            Vista agrupada de todos los productos organizados por categoría
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 space-y-4">
          {customCategories.map((cat: any, catIdx: number) => {
            const productsInCat = productsByCategory.get(cat.name) || [];
            const isExpanded = expandedCats.has(cat.id);
            return (
              <div key={cat.id} className="rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
                {/* Category Header */}
                <div
                  className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-gray-50 to-white dark:from-slate-800 dark:to-slate-900 cursor-pointer hover:from-gray-100 dark:hover:from-slate-700 transition-all"
                  onClick={() => editingCatId !== cat.id && toggleCat(cat.id)}
                >
                  <div className="w-4 h-4 rounded-lg flex-shrink-0 shadow-sm" style={{ backgroundColor: cat.color || '#f97316' }} />
                  <div className="flex-1 min-w-0">
                    {editingCatId === cat.id ? (
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <Input
                          value={editingCatName}
                          onChange={(e) => setEditingCatName(e.target.value)}
                          className="h-7 text-sm font-bold w-48"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && editingCatName.trim()) {
                              renameCatMutation.mutate({ id: cat.id, name: editingCatName.trim() });
                            }
                            if (e.key === 'Escape') {
                              setEditingCatId(null);
                              setEditingCatName("");
                            }
                          }}
                        />
                        <Button
                          size="sm"
                          className="h-7 px-2 bg-green-500 hover:bg-green-600 text-white text-xs"
                          disabled={!editingCatName.trim() || renameCatMutation.isPending}
                          onClick={() => renameCatMutation.mutate({ id: cat.id, name: editingCatName.trim() })}
                        >
                          {renameCatMutation.isPending ? '...' : '✓'}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs"
                          onClick={() => { setEditingCatId(null); setEditingCatName(""); }}
                        >
                          ✕
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <h3 className="font-bold text-sm text-foreground">{cat.name}</h3>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingCatId(cat.id);
                            setEditingCatName(cat.name);
                          }}
                          className="text-muted-foreground hover:text-orange-500 p-0.5 rounded transition-colors opacity-0 group-hover:opacity-100 hover:opacity-100"
                          style={{ opacity: 0.4 }}
                          onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                          onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.4')}
                          title="Renombrar categoría"
                        >
                          <Edit className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                    {cat.description && editingCatId !== cat.id && <p className="text-[11px] text-muted-foreground truncate">{cat.description}</p>}
                  </div>
                  <Badge variant="secondary" className="text-[11px] font-bold px-2.5 py-0.5 flex-shrink-0">
                    {productsInCat.length} producto{productsInCat.length !== 1 ? 's' : ''}
                  </Badge>
                  <div className="flex flex-col -my-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => reorderCatMutation.mutate({ id: cat.id, direction: 'up' })}
                      disabled={catIdx === 0 || reorderCatMutation.isPending}
                      className="text-muted-foreground hover:text-orange-500 disabled:opacity-20 disabled:cursor-not-allowed p-0.5 transition-colors"
                      title="Subir"
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => reorderCatMutation.mutate({ id: cat.id, direction: 'down' })}
                      disabled={catIdx === customCategories.length - 1 || reorderCatMutation.isPending}
                      className="text-muted-foreground hover:text-orange-500 disabled:opacity-20 disabled:cursor-not-allowed p-0.5 transition-colors"
                      title="Bajar"
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); if (confirm(`¿Eliminar la categoría "${cat.name}"?`)) deleteCatMutation.mutate(cat.id); }}
                    className="text-red-400 hover:text-red-600 p-1 rounded transition-colors flex-shrink-0"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
                </div>

                {/* Products as visual pills/chips */}
                <div className="px-4 py-3 border-t border-gray-100 dark:border-slate-700/50 bg-white dark:bg-slate-900/50">
                  {productsInCat.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {productsInCat.map((product: any) => {
                        const tags = product.tags || [];
                        const colorCount = Object.keys(product.colors || {}).length;
                        return (
                          <div
                            key={product.genericName}
                            className="group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 hover:border-orange-300 hover:bg-orange-50 dark:hover:bg-orange-950/20 transition-all"
                          >
                            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color || '#f97316' }} />
                            <span className="text-gray-800 dark:text-gray-200">{product.genericName}</span>
                            {colorCount > 0 && (
                              <span className="text-[10px] text-muted-foreground">({colorCount})</span>
                            )}
                            {tags.length > 0 && (
                              <div className="flex gap-0.5 ml-0.5">
                                {tags.map((tag: string) => {
                                  const tagDef = availableTags.find(t => t.name === tag);
                                  return <div key={tag} className={`w-2 h-2 rounded-full ${tagDef ? TAG_COLOR_MAP[tagDef.color] || 'bg-gray-400' : 'bg-gray-400'}`} title={tag} />;
                                })}
                              </div>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                assignMutation.mutate({ productFamily: product.genericName, categoryName: cat.name, action: 'remove' });
                              }}
                              className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 -mr-1 transition-opacity"
                              title="Quitar de categoría"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">Sin productos asignados</p>
                  )}
                </div>

                {/* Expanded: full table + product adder */}
                {isExpanded && (
                  <div className="border-t border-gray-100 dark:border-slate-700/50">
                    <CategoryProductAdder
                      catalog={catalog}
                      categoryName={cat.name}
                      assignMutation={assignMutation}
                    />
                    {productsInCat.length > 0 && (
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/10">
                            <TableHead className="text-xs uppercase">Producto</TableHead>
                            <TableHead className="text-xs uppercase w-20">Colores</TableHead>
                            <TableHead className="text-xs uppercase">Etiquetas</TableHead>
                            <TableHead className="text-xs uppercase w-12"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {productsInCat.map((product: any) => (
                            <TableRow key={product.genericName} className="hover:bg-muted/5">
                              <TableCell className="font-medium text-xs sm:text-sm">{product.genericName}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {Object.keys(product.colors || {}).length}
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-wrap gap-1">
                                  {availableTags.map((tagObj: { name: string; color: string }) => {
                                    const isActive = (product.tags || []).includes(tagObj.name);
                                    return (
                                      <button
                                        key={tagObj.name}
                                        onClick={() => tagMutation.mutate({
                                          productFamily: product.genericName,
                                          tag: tagObj.name,
                                          action: isActive ? 'remove' : 'add',
                                        })}
                                        disabled={tagMutation.isPending}
                                        className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold transition-all ${
                                          isActive
                                            ? `${TAG_COLOR_MAP[tagObj.color] || 'bg-gray-500'} text-white border-transparent`
                                            : 'bg-white text-gray-500 border-dashed border-gray-300 hover:border-gray-400'
                                        }`}
                                      >
                                        {isActive ? '✓ ' : '+ '}{tagObj.name}
                                      </button>
                                    );
                                  })}
                                </div>
                              </TableCell>
                              <TableCell>
                                <button
                                  onClick={() => assignMutation.mutate({ productFamily: product.genericName, categoryName: cat.name, action: 'remove' })}
                                  className="text-red-400 hover:text-red-600 p-1"
                                  title="Quitar de categoría"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          
          {customCategories.length === 0 && !isLoading && (
            <div className="text-center py-8 text-muted-foreground">
              <Layers className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">No hay categorías creadas</p>
              <p className="text-xs mt-1">Usa el formulario de arriba para crear tu primera categoría</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Unassigned Products */}
      {unassigned.length > 0 && (
        <Card className="border-0 shadow-sm rounded-xl overflow-hidden border-dashed">
          <CardHeader className="bg-muted/20 border-b px-4 sm:px-6 py-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-muted-foreground">
                <Package className="h-4 w-4" />
                Productos sin categoría
              </CardTitle>
              <Badge variant="outline" className="text-xs">{unassigned.length}</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/10">
                  <TableHead className="text-xs uppercase">Producto</TableHead>
                  <TableHead className="text-xs uppercase w-32 sm:w-48">Asignar a</TableHead>
                  <TableHead className="text-xs uppercase">Etiquetas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {unassigned.map((product: any) => (
                  <TableRow key={product.genericName} className="hover:bg-muted/5">
                    <TableCell className="font-medium text-xs sm:text-sm">{product.genericName}</TableCell>
                    <TableCell>
                      <Select onValueChange={(val) => assignMutation.mutate({ productFamily: product.genericName, categoryName: val })}>
                        <SelectTrigger className="h-7 text-[11px] w-full">
                          <SelectValue placeholder="Categoría..." />
                        </SelectTrigger>
                        <SelectContent>
                          {allCategoryNames.map((name: string) => (
                            <SelectItem key={name} value={name} className="text-xs">{name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {availableTags.map((tagObj: { name: string; color: string }) => {
                          const isActive = (product.tags || []).includes(tagObj.name);
                          return (
                            <button
                              key={tagObj.name}
                              onClick={() => tagMutation.mutate({
                                productFamily: product.genericName,
                                tag: tagObj.name,
                                action: isActive ? 'remove' : 'add',
                              })}
                              disabled={tagMutation.isPending}
                              className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold transition-all ${
                                isActive
                                  ? `${TAG_COLOR_MAP[tagObj.color] || 'bg-gray-500'} text-white border-transparent`
                                  : 'bg-white text-gray-500 border-dashed border-gray-300 hover:border-gray-400'
                              }`}
                            >
                              {isActive ? '✓ ' : '+ '}{tagObj.name}
                            </button>
                          );
                        })}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-orange-500 border-t-transparent" />
        </div>
      )}
    </div>
  );
}

// Orden de Productos component
function OrdenProductosContent() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSaving, setIsSaving] = useState(false);
  const [searchFilter, setSearchFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  // Image picker state
  const [imagePickerOpen, setImagePickerOpen] = useState(false);
  const [imagePickerProduct, setImagePickerProduct] = useState<any>(null);
  const [customImages, setCustomImages] = useState<Record<string, string>>({});
  const [imageSaving, setImageSaving] = useState(false);

  // Fetch grouped catalog to get all generic product names
  const { data: catalogData, isLoading: catalogLoading } = useQuery<{ catalog: any[] }>({
    queryKey: ["/api/store/products/grouped"],
    queryFn: async () => {
      const res = await fetch("/api/store/products/grouped", { credentials: "include" });
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
  });

  // Fetch saved product order
  const { data: savedOrder = [], isLoading: orderLoading } = useQuery<string[]>({
    queryKey: ["/api/ecommerce/product-order"],
    queryFn: async () => {
      const res = await fetch("/api/ecommerce/product-order", { credentials: "include" });
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
  });

  // Fetch saved product group images
  const { data: savedImages = {} } = useQuery<Record<string, string>>({
    queryKey: ["/api/ecommerce/product-group-images"],
    queryFn: async () => {
      const res = await fetch("/api/ecommerce/product-group-images", { credentials: "include" });
      if (!res.ok) return {};
      return res.json();
    },
  });

  useEffect(() => {
    setCustomImages(savedImages);
  }, [savedImages]);

  // Fetch categories for filter
  const { data: customCategories = [] } = useQuery<any[]>({
    queryKey: ["/api/ecommerce/categories-config"],
    queryFn: async () => {
      const res = await fetch("/api/ecommerce/categories-config", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Build ordered list: saved order first, then any new products not in saved order
  const [orderedProducts, setOrderedProducts] = useState<any[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (!catalogData?.catalog) return;
    const catalog = catalogData.catalog;
    
    if (savedOrder.length > 0) {
      const catalogMap = new Map<string, any>();
      catalog.forEach(p => catalogMap.set(p.genericName, p));
      
      const ordered: any[] = [];
      savedOrder.forEach(name => {
        if (catalogMap.has(name)) {
          ordered.push(catalogMap.get(name)!);
          catalogMap.delete(name);
        }
      });
      
      const remaining = Array.from(catalogMap.values()).sort((a, b) => 
        a.genericName.localeCompare(b.genericName)
      );
      
      setOrderedProducts([...ordered, ...remaining]);
    } else {
      setOrderedProducts([...catalog]);
    }
    setHasChanges(false);
  }, [catalogData, savedOrder]);

  const moveProduct = (index: number, direction: 'up' | 'down') => {
    const newOrder = [...orderedProducts];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= newOrder.length) return;
    [newOrder[index], newOrder[swapIndex]] = [newOrder[swapIndex], newOrder[index]];
    setOrderedProducts(newOrder);
    setHasChanges(true);
  };

  const moveToTop = (index: number) => {
    if (index === 0) return;
    const newOrder = [...orderedProducts];
    const [item] = newOrder.splice(index, 1);
    newOrder.unshift(item);
    setOrderedProducts(newOrder);
    setHasChanges(true);
  };

  const moveToBottom = (index: number) => {
    if (index === orderedProducts.length - 1) return;
    const newOrder = [...orderedProducts];
    const [item] = newOrder.splice(index, 1);
    newOrder.push(item);
    setOrderedProducts(newOrder);
    setHasChanges(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const order = orderedProducts.map(p => p.genericName);
      const res = await fetch('/api/ecommerce/product-order', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order }),
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Error al guardar');
      queryClient.invalidateQueries({ queryKey: ["/api/ecommerce/product-order"] });
      queryClient.invalidateQueries({ queryKey: ["/api/store/products/grouped"] });
      setHasChanges(false);
      toast({ title: "Orden guardado", description: `Se guardó el orden de ${order.length} productos.` });
    } catch {
      toast({ title: "Error al guardar", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  // Image picker: extract all unique images from a product's variants
  const getAvailableImages = (product: any): { url: string; label: string }[] => {
    const images: { url: string; label: string }[] = [];
    const seen = new Set<string>();
    const colors = product.colors || {};
    
    for (const [colorName, variants] of Object.entries(colors)) {
      for (const v of (variants as any[])) {
        if (v.imageUrl && !seen.has(v.imageUrl)) {
          seen.add(v.imageUrl);
          images.push({
            url: v.imageUrl,
            label: `${colorName} — ${v.format || 'Sin formato'}`,
          });
        }
      }
    }
    return images;
  };

  // Save image for a specific product group
  const handleSaveImage = async (genericName: string, imageUrl: string | null) => {
    setImageSaving(true);
    try {
      const res = await fetch('/api/ecommerce/product-group-images', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ genericName, imageUrl }),
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Error');
      
      // Update local state immediately
      setCustomImages(prev => {
        const next = { ...prev };
        if (imageUrl) {
          next[genericName] = imageUrl;
        } else {
          delete next[genericName];
        }
        return next;
      });
      
      queryClient.invalidateQueries({ queryKey: ["/api/ecommerce/product-group-images"] });
      queryClient.invalidateQueries({ queryKey: ["/api/store/products/grouped"] });
      toast({ title: imageUrl ? "Imagen actualizada" : "Imagen restablecida", description: genericName });
      setImagePickerOpen(false);
    } catch {
      toast({ title: "Error al guardar imagen", variant: "destructive" });
    } finally {
      setImageSaving(false);
    }
  };

  // Filter products for display
  const filteredProducts = orderedProducts.filter(p => {
    if (searchFilter) {
      if (!p.genericName.toLowerCase().includes(searchFilter.toLowerCase())) return false;
    }
    if (categoryFilter !== 'all') {
      if (p.groupName !== categoryFilter) return false;
    }
    return true;
  });

  // Get real index in orderedProducts
  const getRealIndex = (product: any) => orderedProducts.findIndex(p => p.genericName === product.genericName);

  // Get effective image for a product (custom override or auto)
  const getEffectiveImage = (product: any): string | null => {
    return customImages[product.genericName] || product.imageUrl || null;
  };

  const isLoading = catalogLoading || orderLoading;

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="border-0 shadow-sm rounded-xl overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-indigo-500 to-violet-500 text-white rounded-t-xl px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <ArrowUpDown className="h-5 w-5" />
                Orden e Imágenes de Productos
              </CardTitle>
              <CardDescription className="text-white/80 text-xs mt-0.5">
                Controla el orden y la imagen destacada de cada grupo de productos en la tienda.
              </CardDescription>
            </div>
            <Button
              onClick={handleSave}
              disabled={isSaving || !hasChanges}
              className={`gap-2 rounded-lg font-bold transition-all ${
                hasChanges 
                  ? 'bg-white text-indigo-600 hover:bg-indigo-50 shadow-lg' 
                  : 'bg-white/20 text-white/60 cursor-not-allowed'
              }`}
            >
              <Save className="h-4 w-4" />
              {isSaving ? 'Guardando...' : hasChanges ? 'Guardar Orden' : 'Sin cambios'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar producto..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="pl-10 h-10 rounded-lg"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="h-10 w-48 rounded-lg">
                <SelectValue placeholder="Categoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las categorías</SelectItem>
                {customCategories.map((c: any) => (
                  <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {hasChanges && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 mt-3">
              <Save className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-700 dark:text-amber-400">
                Tienes cambios sin guardar. Presiona "Guardar Orden" para aplicar el nuevo orden en la tienda.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Product List */}
      <Card className="border-0 shadow-sm rounded-xl overflow-hidden">
        <CardHeader className="bg-muted/30 border-b px-6 py-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Package className="h-4 w-4 text-indigo-500" />
              {filteredProducts.length} productos
              {(searchFilter || categoryFilter !== 'all') && ` (filtrados de ${orderedProducts.length})`}
            </CardTitle>
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-semibold">
                #1 = Primer producto visible
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 font-semibold">
                📷 Click imagen = Cambiar
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-500 border-t-transparent" />
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">No se encontraron productos</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-slate-800">
              {filteredProducts.map((product) => {
                const realIdx = getRealIndex(product);
                const colorCount = Object.keys(product.colors || {}).length;
                const tags: string[] = product.tags || [];
                const effectiveImage = getEffectiveImage(product);
                const hasCustomImage = !!customImages[product.genericName];
                return (
                  <div
                    key={product.genericName}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors group"
                  >
                    {/* Position Number */}
                    <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-100 to-violet-100 dark:from-indigo-900/40 dark:to-violet-900/40 flex items-center justify-center">
                      <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                        {realIdx + 1}
                      </span>
                    </div>

                    {/* Grip Handle */}
                    <GripVertical className="h-4 w-4 text-muted-foreground/30 flex-shrink-0" />

                    {/* Product Image — Clickable for image picker */}
                    <button
                      onClick={() => {
                        setImagePickerProduct(product);
                        setImagePickerOpen(true);
                      }}
                      className={`relative w-12 h-12 rounded-lg overflow-hidden flex items-center justify-center flex-shrink-0 transition-all border-2 hover:shadow-md hover:scale-105 cursor-pointer ${
                        hasCustomImage 
                          ? 'border-emerald-400 ring-1 ring-emerald-200' 
                          : 'border-transparent bg-gray-100 dark:bg-slate-800 hover:border-indigo-300'
                      }`}
                      title="Click para cambiar imagen destacada"
                    >
                      {effectiveImage ? (
                        <img src={effectiveImage} alt={product.genericName} className="w-full h-full object-cover" />
                      ) : (
                        <ImageIcon className="h-5 w-5 text-muted-foreground/40" />
                      )}
                      {/* Edit overlay */}
                      <div className="absolute inset-0 bg-black/0 hover:bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-all rounded-lg">
                        <Edit className="h-4 w-4 text-white drop-shadow" />
                      </div>
                      {/* Custom image indicator */}
                      {hasCustomImage && (
                        <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border border-white" title="Imagen personalizada" />
                      )}
                    </button>

                    {/* Product Info */}
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-bold text-foreground truncate">{product.genericName}</h4>
                      <div className="flex items-center gap-2 mt-0.5">
                        {product.groupName && (
                          <span className="text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
                            {product.groupName}
                          </span>
                        )}
                        <span className="text-[10px] text-muted-foreground">
                          {colorCount} color{colorCount !== 1 ? 'es' : ''}
                        </span>
                        {tags.length > 0 && (
                          <div className="flex gap-0.5">
                            {tags.map((tag: string) => (
                              <div
                                key={tag}
                                className={`w-2 h-2 rounded-full ${
                                  tag === 'Mejor Precio' ? 'bg-green-500' :
                                  tag === 'Rápida Rotación' ? 'bg-blue-500' :
                                  tag === 'Pocas Unidades' ? 'bg-amber-500' : 'bg-gray-400'
                                }`}
                                title={tag}
                              />
                            ))}
                          </div>
                        )}
                        {hasCustomImage && (
                          <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-950/30 px-1.5 py-0.5 rounded-full">
                            📷 personalizada
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Move Controls */}
                    <div className="flex items-center gap-0.5 flex-shrink-0 opacity-60 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => moveToTop(realIdx)}
                        disabled={realIdx === 0}
                        className="p-1 rounded hover:bg-indigo-100 dark:hover:bg-indigo-900/30 text-muted-foreground hover:text-indigo-600 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                        title="Mover al inicio"
                      >
                        <ChevronUp className="h-3.5 w-3.5" />
                        <ChevronUp className="h-3.5 w-3.5 -mt-2.5" />
                      </button>
                      <button
                        onClick={() => moveProduct(realIdx, 'up')}
                        disabled={realIdx === 0}
                        className="p-1.5 rounded hover:bg-indigo-100 dark:hover:bg-indigo-900/30 text-muted-foreground hover:text-indigo-600 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                        title="Subir"
                      >
                        <ChevronUp className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => moveProduct(realIdx, 'down')}
                        disabled={realIdx === orderedProducts.length - 1}
                        className="p-1.5 rounded hover:bg-indigo-100 dark:hover:bg-indigo-900/30 text-muted-foreground hover:text-indigo-600 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                        title="Bajar"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => moveToBottom(realIdx)}
                        disabled={realIdx === orderedProducts.length - 1}
                        className="p-1 rounded hover:bg-indigo-100 dark:hover:bg-indigo-900/30 text-muted-foreground hover:text-indigo-600 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                        title="Mover al final"
                      >
                        <ChevronDown className="h-3.5 w-3.5" />
                        <ChevronDown className="h-3.5 w-3.5 -mt-2.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Image Picker Dialog */}
      <Dialog open={imagePickerOpen} onOpenChange={setImagePickerOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <ImageIcon className="h-5 w-5 text-indigo-500" />
              Imagen Destacada
            </DialogTitle>
            <DialogDescription>
              {imagePickerProduct?.genericName} — Selecciona la imagen que aparecerá en el catálogo de la tienda
            </DialogDescription>
          </DialogHeader>
          
          {imagePickerProduct && (() => {
            const availableImages = getAvailableImages(imagePickerProduct);
            const currentCustom = customImages[imagePickerProduct.genericName];
            const autoImage = imagePickerProduct.imageUrl;
            
            return (
              <div className="space-y-4 pt-2">
                {/* Current Image */}
                <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/30 border border-muted">
                  <div className="w-20 h-20 rounded-lg overflow-hidden bg-white border flex items-center justify-center flex-shrink-0">
                    {(currentCustom || autoImage) ? (
                      <img src={currentCustom || autoImage} alt="Actual" className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="h-8 w-8 text-muted-foreground/30" />
                    )}
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-bold">Imagen Actual</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {currentCustom ? (
                        <span className="text-emerald-600 font-semibold">📷 Imagen personalizada (manual)</span>
                      ) : (
                        <span className="text-blue-600 font-semibold">🤖 Selección automática (GALÓN BLANCO prioridad)</span>
                      )}
                    </p>
                    {currentCustom && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-2 h-7 text-xs text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                        onClick={() => handleSaveImage(imagePickerProduct.genericName, null)}
                        disabled={imageSaving}
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        Restablecer a automático
                      </Button>
                    )}
                  </div>
                </div>

                {/* Available Images Grid */}
                {availableImages.length > 0 ? (
                  <div>
                    <h4 className="text-sm font-bold mb-3 flex items-center gap-2">
                      <Palette className="h-4 w-4 text-indigo-500" />
                      Imágenes de Variantes Disponibles
                      <Badge variant="secondary" className="text-[10px]">{availableImages.length}</Badge>
                    </h4>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                      {availableImages.map((img) => {
                        const isSelected = currentCustom === img.url;
                        return (
                          <button
                            key={img.url}
                            onClick={() => handleSaveImage(imagePickerProduct.genericName, img.url)}
                            disabled={imageSaving}
                            className={`relative rounded-xl overflow-hidden border-2 transition-all hover:shadow-lg group aspect-square ${
                              isSelected 
                                ? 'border-emerald-500 ring-2 ring-emerald-200 shadow-md' 
                                : 'border-gray-200 dark:border-slate-700 hover:border-indigo-400'
                            }`}
                          >
                            <img 
                              src={img.url} 
                              alt={img.label} 
                              className="w-full h-full object-cover"
                            />
                            {/* Label */}
                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2 pt-6">
                              <p className="text-white text-[9px] font-semibold leading-tight truncate">
                                {img.label}
                              </p>
                            </div>
                            {/* Selected indicator */}
                            {isSelected && (
                              <div className="absolute top-1.5 right-1.5 w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center shadow-md">
                                <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              </div>
                            )}
                            {/* Hover overlay */}
                            {!isSelected && (
                              <div className="absolute inset-0 bg-indigo-500/0 group-hover:bg-indigo-500/10 transition-colors flex items-center justify-center">
                                <span className="text-white text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity bg-indigo-600/80 px-3 py-1 rounded-full">
                                  Seleccionar
                                </span>
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <ImageIcon className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm font-medium">No hay imágenes de variantes disponibles</p>
                    <p className="text-xs mt-1">Las imágenes se asignan individualmente a cada SKU desde el tab de Catálogo Agrupado</p>
                  </div>
                )}

                {imageSaving && (
                  <div className="flex items-center justify-center py-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-indigo-500 border-t-transparent" />
                    <span className="ml-2 text-xs text-muted-foreground">Guardando...</span>
                  </div>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface Product {
  id: string;
  kopr: string; // Product code (primary key)
  sku: string; // Legacy compatibility
  name: string;
  category: string;
  price: string;
  priceOffer?: number;
  active: boolean;
  totalStock: number;
  showInStore?: boolean;
  // eCommerce specific fields
  ecomActive?: boolean;
  ecomPrice?: number;
  ecomPriceOffer?: number;
  ecomCategory?: string;
  ecomTags?: string[];
  ecomSlug?: string;
  ecomImages?: Array<{ id: string; url: string; alt: string; primary: boolean }>;
  ecomSeoTitle?: string;
  ecomSeoDescription?: string;
  ecomOgImage?: string;
  // Legacy or other fields used in code
  seoTitle?: string;
  seoDescription?: string;
  ogImageUrl?: string;
  // Dynamic fields
  priceProduct?: number;
  pricePerUnit?: number;
  slug?: string;
  tags?: string[];
  images?: any[];
}

interface WarehouseSummary {
  id: string;
  kopr: string; // Product code (primary key)
  sku: string; // Legacy compatibility
  name: string;
  unit1?: string;
  unit2?: string;
  unitRatio?: string;
  ud02pr?: string; // Secondary unit presentation
  price?: string; // Legacy price field
  pricePerUnit?: string; // Legacy price field
  packagingUnitName?: string;
  priceProduct?: number; // Regular product price
  priceOffer?: number; // Offer price
  showInStore?: boolean;

  // eCommerce fields
  slug?: string; // SEO-friendly URL slug
  ecomActive: boolean; // Show in eCommerce store
  ecomPrice?: number; // eCommerce-specific price
  category?: string; // Product category for eCommerce
  tags?: string[]; // Product tags for filtering/search
  images?: Array<{
    id: string;
    url: string;
    alt: string;
    primary: boolean;
    sort: number;
  }>; // Product images
  seoTitle?: string; // SEO title for product page
  seoDescription?: string; // SEO description for product page
  ogImageUrl?: string; // Open Graph image URL

  active: boolean;
  totalStock?: number;
  warehouses?: string[];
  createdAt: string;
  updatedAt: string;
}

interface WarehouseSummary {
  warehouseCode: string;
  warehouseName: string;
  totalProducts: number;
  totalPhysicalStock: number;
  totalAvailableStock: number;
}

interface WarehouseStock {
  productSku: string;
  productName: string;
  branchCode: string;
  physicalStock1: number;
  physicalStock2: number;
  availableStock1: number;
  availableStock2: number;
  unit1?: string;
  unit2?: string;
}

interface ImportResult {
  processedProducts: number;
  newProducts: number;
  updatedStock: number;
  errors: string[];
}

export default function ProductsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterActive, setFilterActive] = useState<string>("all");
  const [filterPrices, setFilterPrices] = useState<string>("all");
  const [filterEcomActive, setFilterEcomActive] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>("");
  const [newPrice, setNewPrice] = useState("");
  const [newOfferPrice, setNewOfferPrice] = useState("");
  const [showInStore, setShowInStore] = useState(false);
  const [priceReason, setPriceReason] = useState("");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showImageUploadDialog, setShowImageUploadDialog] = useState(false);
  const [showPriceDialog, setShowPriceDialog] = useState(false);
  const [showStockDialog, setShowStockDialog] = useState(false);
  const [showEcomDialog, setShowEcomDialog] = useState(false);
  const [activeTab, setActiveTab] = useState("sap");
  const [activeSegment, setActiveSegment] = useState("FERRETERIAS");

  // Price List State (for SAP tab)
  const [priceListSearch, setPriceListSearch] = useState("");
  const [selectedUnidadPrice, setSelectedUnidadPrice] = useState<string>("");
  const [selectedColorPrice, setSelectedColorPrice] = useState<string>("");
  const [priceListPage, setPriceListPage] = useState(0);
  const itemsPerPage = 50;

  // Bulk offer price state (SAP tab)
  const [selectedSapCodes, setSelectedSapCodes] = useState<Set<string>>(new Set());
  const [bulkOfferPriceInput, setBulkOfferPriceInput] = useState("");
  const [showBulkOfferBar, setShowBulkOfferBar] = useState(false);

  // CRUD state for price list items (SAP catalog)
  const [showPriceListDialog, setShowPriceListDialog] = useState(false);
  const [editingPriceListItem, setEditingPriceListItem] = useState<PriceList | null>(null);
  const [plForm, setPlForm] = useState({ codigo: '', producto: '', unidad: '', lista: '', desc10: '', desc10_5: '', desc10_5_3: '', minimo: '', canalDigital: '' });
  const [deletingPriceListId, setDeletingPriceListId] = useState<string | null>(null);

  // eCommerce form state
  const [ecomSlug, setEcomSlug] = useState("");
  const [ecomCategory, setEcomCategory] = useState("");
  const [ecomTags, setEcomTags] = useState<string[]>([]);
  const [ecomImages, setEcomImages] = useState<Array<{ id: string; url: string; alt: string; primary: boolean; sort: number }>>([]);
  const [ecomSeoTitle, setEcomSeoTitle] = useState("");
  const [ecomSeoDescription, setEcomSeoDescription] = useState("");
  const [ecomOgImage, setEcomOgImage] = useState("");
  const [ecomPriceValue, setEcomPriceValue] = useState("");
  const [ecomActiveValue, setEcomActiveValue] = useState(false);
  const [newImageUrl, setNewImageUrl] = useState("");
  const [newImageAlt, setNewImageAlt] = useState("");

  const { toast } = useToast();
  const { user, isAuthenticated, isLoading } = useAuth();
  const { can, isReady: permissionsReady } = usePermissions();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  // Modo restringido (vista vendedor): sin permiso de costos solo ve
  // Lista de Precios e Inventario, sin costos/márgenes/simulador.
  // Configurable por rol en Configuración → Roles y Permisos.
  const isVendedor = !can('productos.costos');

  // Redirect to dashboard if not authenticated or without module permission
  useEffect(() => {
    if (!isLoading && permissionsReady && (!isAuthenticated || !can('productos'))) {
      toast({
        title: "Acceso denegado",
        description: "Tu rol no tiene habilitado el módulo de Productos.",
        variant: "destructive",
      });
      setTimeout(() => {
        setLocation('/');
      }, 1000);
    }
  }, [isAuthenticated, isLoading, permissionsReady, can, user, toast]);

  // Vendedores: solo pestañas Lista de Precios e Inventario (por defecto Lista de Precios)
  useEffect(() => {
    if (isVendedor && activeTab !== 'lista-precios' && activeTab !== 'inventario') {
      setActiveTab('lista-precios');
    }
  }, [isVendedor, activeTab]);

  // Fetch eCommerce products
  const { data: products = [], isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: ['/api/ecommerce/products', { search: searchTerm, active: filterActive, ecomActive: filterEcomActive, category: filterCategory }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (filterActive !== 'all') params.append('active', (filterActive === 'true').toString());
      if (filterEcomActive !== 'all') params.append('ecomActive', (filterEcomActive === 'true').toString());
      if (filterCategory !== 'all') params.append('category', filterCategory);

      const response = await apiRequest('GET', `/api/ecommerce/products?${params.toString()}`);
      return await response.json() as Product[];
    }
  });

  // Fetch segment prices
  const { data: segmentPrices = [], isLoading: segmentPricesLoading } = useQuery<any[]>({
    queryKey: ['/api/segment-prices', activeSegment],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/segment-prices/${activeSegment}`);
      return await response.json();
    }
  });

  // Fetch eCommerce categories
  const { data: categories = [] } = useQuery<string[]>({
    queryKey: ['/api/ecommerce/categories'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/ecommerce/categories');
      return await response.json() as string[];
    }
  });

  // Fetch Price List (Commercial/SAP)
  const { data: priceListResponse, isLoading: priceListLoading } = useQuery<{ items: PriceList[], totalCount: number, hasMore: boolean }>({
    queryKey: ['/api/price-list', { search: priceListSearch, unidad: selectedUnidadPrice, color: selectedColorPrice, limit: itemsPerPage, offset: priceListPage * itemsPerPage }],
    queryFn: async () => {
      const params = new URLSearchParams({
        search: priceListSearch,
        limit: itemsPerPage.toString(),
        offset: (priceListPage * itemsPerPage).toString()
      });
      if (selectedUnidadPrice) params.set('unidad', selectedUnidadPrice);
      if (selectedColorPrice) params.set('color', selectedColorPrice);
      const response = await apiRequest('GET', `/api/price-list?${params}`);
      return response.json();
    },
  });

  const { data: availableUnits = [] } = useQuery<string[]>({
    queryKey: ["/api/price-list/units"],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/price-list/units');
      return await response.json() as string[];
    },
  });

  const priceList = priceListResponse?.items || [];

  // Update price mutation
  const updatePriceMutation = useMutation({
    mutationFn: async ({ sku, price, offerPrice, showInStore, reason }: { sku: string; price: number; offerPrice?: number; showInStore?: boolean; reason?: string }) => {
      const response = await fetch(`/api/products/${sku}/price`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          price,
          offerPrice,
          showInStore,
          reason
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update price');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ecommerce/products'] });
      setShowPriceDialog(false);
      setSelectedProduct(null);
      setNewPrice("");
      setNewOfferPrice("");
      setShowInStore(false);
      setPriceReason("");
      toast({
        title: "Precio actualizado",
        description: "El precio del producto se ha actualizado correctamente.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "No se pudo actualizar el precio del producto.",
        variant: "destructive",
      });
    }
  });

  // Import CSV mutation
  const importMutation = useMutation({
    mutationFn: async (csvData: any[]) => {
      await apiRequest("POST", "/api/products/import-products-csv", { products: csvData });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/ecommerce/products'] });
      setShowImportDialog(false);
      setImportFile(null);

      toast({
        title: "Importación completada",
        description: `Se procesaron ${data.result.processedProducts} productos. ${data.result.newProducts} nuevos productos creados.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Error de importación",
        description: "No se pudo importar el archivo CSV.",
        variant: "destructive",
      });
    }
  });

  // eCommerce update mutation
  const updateEcommerceMutation = useMutation({
    mutationFn: async (data: { kopr: string; ecommerce: any }) => {
      const response = await apiRequest('PATCH', `/api/ecommerce/products/${data.kopr}`, data.ecommerce);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ecommerce/products'] });
      setShowEcomDialog(false);
      setSelectedProduct(null);
      resetEcommerceForm();
      toast({
        title: "eCommerce actualizado",
        description: "La configuración de eCommerce se ha actualizado correctamente.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "No se pudo actualizar la configuración de eCommerce.",
        variant: "destructive",
      });
    }
  });

  // Toggle eCommerce active mutation
  const toggleEcommerceMutation = useMutation({
    mutationFn: async (kopr: string) => {
      const response = await apiRequest('PATCH', `/api/ecommerce/products/${kopr}/toggle-active`);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ecommerce/products'] });
      toast({
        title: "Estado actualizado",
        description: "El estado de eCommerce se ha actualizado correctamente.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "No se pudo actualizar el estado de eCommerce.",
        variant: "destructive",
      });
    }
  });

  // Slug validation mutation
  const validateSlugMutation = useMutation({
    mutationFn: async ({ slug, excludeKopr }: { slug: string; excludeKopr?: string }) => {
      const response = await apiRequest('POST', '/api/ecommerce/products/validate-slug', { slug, excludeKopr });
      return await response.json();
    }
  });

  // Bulk offer price mutation (SAP tab)
  const bulkOfferPriceMutation = useMutation({
    mutationFn: async ({ codes, offerPrice }: { codes: string[]; offerPrice: number | null }) => {
      const response = await apiRequest('PUT', '/api/price-list/bulk-offer-price', { codes, offerPrice });
      return await response.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/price-list'] });
      setSelectedSapCodes(new Set());
      setBulkOfferPriceInput("");
      toast({
        title: data.offerPrice !== null ? "Precio oferta aplicado" : "Ofertas removidas",
        description: `${data.affectedRows} productos actualizados.`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo actualizar los precios de oferta.",
        variant: "destructive",
      });
    }
  });

  // ===== Price List CRUD mutations =====
  const createPriceListMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('POST', '/api/price-list', data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/price-list'] });
      setShowPriceListDialog(false);
      setPlForm({ codigo: '', producto: '', unidad: '', lista: '', desc10: '', desc10_5: '', desc10_5_3: '', minimo: '', canalDigital: '' });
      toast({ title: 'Producto creado', description: 'El producto se agregó al catálogo.' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'No se pudo crear el producto.', variant: 'destructive' });
    },
  });

  const updatePriceListMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await apiRequest('PATCH', `/api/price-list/${id}`, data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/price-list'] });
      setShowPriceListDialog(false);
      setEditingPriceListItem(null);
      setPlForm({ codigo: '', producto: '', unidad: '', lista: '', desc10: '', desc10_5: '', desc10_5_3: '', minimo: '', canalDigital: '' });
      toast({ title: 'Producto actualizado', description: 'Los datos del producto se actualizaron.' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'No se pudo actualizar el producto.', variant: 'destructive' });
    },
  });

  const deletePriceListMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest('DELETE', `/api/price-list/${id}`);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/price-list'] });
      setDeletingPriceListId(null);
      toast({ title: 'Producto eliminado', description: 'El producto se eliminó del catálogo.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'No se pudo eliminar el producto.', variant: 'destructive' });
    },
  });

  const openAddPriceListDialog = () => {
    setEditingPriceListItem(null);
    setPlForm({ codigo: '', producto: '', unidad: '', lista: '', desc10: '', desc10_5: '', desc10_5_3: '', minimo: '', canalDigital: '' });
    setShowPriceListDialog(true);
  };

  const openEditPriceListDialog = (item: PriceList) => {
    setEditingPriceListItem(item);
    setPlForm({
      codigo: item.codigo || '',
      producto: item.producto || '',
      unidad: item.unidad || '',
      lista: item.lista?.toString() || '',
      desc10: item.desc10?.toString() || '',
      desc10_5: item.desc10_5?.toString() || '',
      desc10_5_3: item.desc10_5_3?.toString() || '',
      minimo: item.minimo?.toString() || '',
      canalDigital: item.canalDigital?.toString() || '',
    });
    setShowPriceListDialog(true);
  };

  const handlePriceListSubmit = () => {
    const payload: any = {
      codigo: plForm.codigo.trim(),
      producto: plForm.producto.trim(),
      unidad: plForm.unidad.trim() || undefined,
      lista: plForm.lista || undefined,
      desc10: plForm.desc10 || undefined,
      desc10_5: plForm.desc10_5 || undefined,
      desc10_5_3: plForm.desc10_5_3 || undefined,
      minimo: plForm.minimo || undefined,
      canalDigital: plForm.canalDigital || undefined,
    };
    if (editingPriceListItem) {
      updatePriceListMutation.mutate({ id: editingPriceListItem.id, data: payload });
    } else {
      createPriceListMutation.mutate(payload);
    }
  };

  // SAP selection helpers
  const toggleSapCode = (codigo: string) => {
    setSelectedSapCodes(prev => {
      const next = new Set(prev);
      if (next.has(codigo)) next.delete(codigo);
      else next.add(codigo);
      return next;
    });
  };

  const toggleAllSapCodes = () => {
    if (selectedSapCodes.size === priceList.length) {
      setSelectedSapCodes(new Set());
    } else {
      setSelectedSapCodes(new Set(priceList.map(p => p.codigo)));
    }
  };

  const handleBulkOfferSubmit = () => {
    const codes = Array.from(selectedSapCodes);
    if (codes.length === 0) return;
    const price = bulkOfferPriceInput ? parseFloat(bulkOfferPriceInput) : null;
    if (price !== null && (isNaN(price) || price < 0)) {
      toast({ title: "Precio inválido", variant: "destructive" });
      return;
    }
    bulkOfferPriceMutation.mutate({ codes, offerPrice: price });
  };

  const handleRemoveOffers = () => {
    const codes = Array.from(selectedSapCodes);
    if (codes.length === 0) return;
    bulkOfferPriceMutation.mutate({ codes, offerPrice: null });
  };

  // Get unique categories for filter dropdown (use from backend + product categories)
  const productCategories = Array.from(new Set(products.map(p => p.category).filter(Boolean))) as string[];
  const uniqueCategories = Array.from(new Set([...categories, ...productCategories]));

  // Filter products based on search and filters
  const filteredProducts = products.filter(product => {
    // Search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const sku = product.sku?.toLowerCase() || "";
      const name = product.name?.toLowerCase() || "";
      const kopr = product.kopr?.toLowerCase() || "";
      if (!sku.includes(searchLower) &&
        !name.includes(searchLower) &&
        !kopr.includes(searchLower)) {
        return false;
      }
    }

    // Active filter
    if (filterActive !== 'all') {
      if (filterActive === 'true' && !product.active) return false;
      if (filterActive === 'false' && product.active) return false;
    }

    // eCommerce Active filter
    if (filterEcomActive !== 'all') {
      const isEcomActive = !!product.ecomActive;
      if (filterEcomActive === 'true' && !isEcomActive) return false;
      if (filterEcomActive === 'false' && isEcomActive) return false;
    }

    // Category filter
    if (filterCategory !== 'all') {
      if (!product.category || product.category !== filterCategory) return false;
    }


    return true;
  });

  const handlePriceUpdate = () => {
    if (!selectedProduct || !newPrice) return;

    updatePriceMutation.mutate({
      sku: selectedProduct.kopr || selectedProduct.sku, // Use kopr if available, fallback to sku
      price: parseFloat(newPrice),
      offerPrice: newOfferPrice ? parseFloat(newOfferPrice) : undefined,
      showInStore: showInStore,
      reason: priceReason
    });
  };

  // Helper functions for eCommerce form
  const resetEcommerceForm = () => {
    setEcomSlug("");
    setEcomCategory("");
    setEcomTags([]);
    setEcomImages([]);
    setEcomSeoTitle("");
    setEcomSeoDescription("");
    setEcomOgImage("");
    setEcomPriceValue("");
    setEcomActiveValue(false);
    setNewImageUrl("");
    setNewImageAlt("");
  };

  const initializeEcommerceForm = (product: Product) => {
    setEcomSlug(product.slug || "");
    setEcomCategory(product.category || "");
    setEcomTags(product.tags || []);
    setEcomImages(product.images || []);
    setEcomSeoTitle(product.seoTitle || "");
    setEcomSeoDescription(product.seoDescription || "");
    setEcomOgImage(product.ogImageUrl || "");
    setEcomPriceValue(product.ecomPrice?.toString() || "");
    setEcomActiveValue(product.ecomActive || false);
  };

  const handleEcommerceUpdate = () => {
    if (!selectedProduct) return;

    const ecommerceData = {
      slug: ecomSlug,
      category: ecomCategory,
      tags: ecomTags,
      images: ecomImages,
      seoTitle: ecomSeoTitle,
      seoDescription: ecomSeoDescription,
      ogImageUrl: ecomOgImage,
      ecomPrice: ecomPriceValue ? parseFloat(ecomPriceValue) : undefined,
      ecomActive: ecomActiveValue
    };

    updateEcommerceMutation.mutate({
      kopr: selectedProduct.kopr,
      ecommerce: ecommerceData
    });
  };

  const handleToggleEcommerce = (product: Product) => {
    toggleEcommerceMutation.mutate(product.kopr);
  };

  const validateSlug = async (slug: string, excludeKopr?: string) => {
    if (!slug.trim()) return { available: false, message: 'Slug is required' };

    try {
      const result = await validateSlugMutation.mutateAsync({ slug, excludeKopr });
      return result;
    } catch (error) {
      return { available: false, message: 'Error validating slug' };
    }
  };

  const addImageToProduct = () => {
    if (!newImageUrl || !newImageAlt) return;

    const newImage = {
      id: Date.now().toString(),
      url: newImageUrl,
      alt: newImageAlt,
      primary: ecomImages.length === 0, // First image is primary by default
      sort: ecomImages.length
    };

    setEcomImages([...ecomImages, newImage]);
    setNewImageUrl("");
    setNewImageAlt("");
  };

  const removeImageFromProduct = (imageId: string) => {
    const updatedImages = ecomImages.filter(img => img.id !== imageId);
    // If we removed the primary image and there are other images, make the first one primary
    if (updatedImages.length > 0) {
      const hadPrimary = ecomImages.some(img => img.primary);
      const stillHasPrimary = updatedImages.some(img => img.primary);
      if (hadPrimary && !stillHasPrimary) {
        updatedImages[0].primary = true;
      }
    }
    setEcomImages(updatedImages);
  };

  const setPrimaryImage = (imageId: string) => {
    const updatedImages = ecomImages.map(img => ({
      ...img,
      primary: img.id === imageId
    }));
    setEcomImages(updatedImages);
  };

  const addTag = (tag: string) => {
    if (tag.trim() && !ecomTags.includes(tag.trim())) {
      setEcomTags([...ecomTags, tag.trim()]);
    }
  };

  const removeTag = (tagToRemove: string) => {
    setEcomTags(ecomTags.filter(tag => tag !== tagToRemove));
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setImportFile(file);
    }
  };

  // Funciones de separación universal de CSV (copiadas de import-modal.tsx)
  const detectSeparator = (csvText: string): string => {
    // Analyze the first line to detect separator
    const firstLine = csvText.split('\n')[0];
    const commaCount = (firstLine.match(/,/g) || []).length;
    const semicolonCount = (firstLine.match(/;/g) || []).length;

    const separator = semicolonCount > commaCount ? ';' : ',';
    console.log(`🔍 Separador detectado: "${separator}" (comas: ${commaCount}, punto y coma: ${semicolonCount})`);
    return separator;
  };

  const parseCSVLine = (line: string, separator: string = ','): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === separator && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    result.push(current.trim());
    return result;
  };

  const parseProductCSV = (csvText: string) => {
    const lines = csvText.split('\n').filter(line => line.trim());
    if (lines.length < 2) {
      throw new Error('CSV debe tener al menos una fila de encabezados y una fila de datos');
    }

    // Auto-detect separator
    const separator = detectSeparator(csvText);

    const headers = parseCSVLine(lines[0], separator);
    console.log('🔍 Headers detectados:', headers);
    console.log('🔍 Total filas de datos:', lines.length - 1);

    const products = [];

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i], separator);

      if (values.length !== headers.length) {
        console.warn(`⚠️ Fila ${i + 1}: ${values.length} valores vs ${headers.length} headers. Saltando.`);
        continue;
      }

      const product: any = {};
      headers.forEach((header, index) => {
        product[header.trim()] = values[index]?.trim() || '';
      });

      // Validación básica - KOPR y NOKOPR son requeridos
      if (product.KOPR && product.NOKOPR) {
        products.push(product);
      }
    }

    console.log(`✅ CSV parseado: ${products.length} productos válidos`);
    return products;
  };

  const handleImport = async () => {
    if (!importFile) {
      toast({
        title: "Error",
        description: "Por favor selecciona un archivo CSV",
        variant: "destructive",
      });
      return;
    }

    try {
      const csvText = await importFile.text();
      const parsedData = parseProductCSV(csvText);

      if (parsedData.length === 0) {
        toast({
          title: "Error",
          description: "El archivo CSV está vacío o no tiene datos válidos",
          variant: "destructive",
        });
        return;
      }

      // Enviar datos parseados al backend
      importMutation.mutate(parsedData);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Error al procesar el archivo CSV",
        variant: "destructive",
      });
    }
  };

  const formatPrice = (price: string | number | null) => {
    if (!price || price === "0" || price === 0) return "Sin precio";
    const numPrice = typeof price === 'string' ? parseFloat(price) : price;
    return `$${numPrice.toLocaleString('de-DE', { maximumFractionDigits: 0 })}`;
  };

  const formatStock = (stock: number | undefined) => {
    if (stock === undefined) return "N/A";
    return stock.toLocaleString();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || (permissionsReady && !can('productos'))) {
    return null;
  }

  return (
    <div className="space-y-8 px-2 md:px-4 pb-8 pt-8">
      {/* Modern Header with Gradient */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 md:p-8 text-white">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSA2MCAwIEwgMCAwIDAgNjAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjAzKSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-40" />
        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-white/10 backdrop-blur-sm">
                <Package className="h-5 w-5 text-orange-400" />
              </div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Gestión de Productos</h1>
            </div>
            <p className="text-slate-300 text-sm md:text-base">
              Administra el catálogo de productos, precios y stock por bodega
            </p>
          </div>

          {!isVendedor && (<>
          <Dialog open={showImageUploadDialog} onOpenChange={setShowImageUploadDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" className="bg-white/10 border-white/20 text-white hover:bg-white/20 gap-2" data-testid="button-bulk-images">
                <ImageIcon className="h-4 w-4" />
                Cargar Imágenes
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader className="pb-2">
                <DialogTitle>Carga Masiva de Imágenes</DialogTitle>
                <DialogDescription>
                  Sube un archivo ZIP con imágenes nombradas por SKU para asignarlas automáticamente a los productos.
                </DialogDescription>
              </DialogHeader>
              <BulkImageUpload
                onComplete={() => {
                  queryClient.invalidateQueries({ queryKey: ['/api/ecommerce/products'] });
                }}
              />
            </DialogContent>
          </Dialog>

          <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" className="bg-white/10 border-white/20 text-white hover:bg-white/20 gap-2" data-testid="button-import-csv">
                <Upload className="h-4 w-4" />
                Importar CSV
              </Button>
            </DialogTrigger>
            <DialogContent className="p-6">
              <DialogHeader className="pb-2">
                <DialogTitle>Importar Productos desde CSV</DialogTitle>
                <DialogDescription>
                  Selecciona un archivo CSV con la estructura de stock para actualizar productos y inventario.
                  Los precios existentes se preservarán.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-5 pt-2">
                <div>
                  <Label htmlFor="csv-file">Archivo CSV</Label>
                  <Input
                    id="csv-file"
                    type="file"
                    accept=".csv"
                    onChange={handleFileUpload}
                    data-testid="input-csv-file"
                  />
                </div>
                {importFile && (
                  <div className="text-sm text-muted-foreground">
                    Archivo seleccionado: {importFile.name}
                  </div>
                )}
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowImportDialog(false)}>
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleImport}
                    disabled={!importFile || importMutation.isPending}
                    data-testid="button-confirm-import"
                  >
                    {importMutation.isPending ? "Importando..." : "Importar"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          </>)}
        </div>
      </div>

      {/* Modern Stat Cards */}
      {!productsLoading && (
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 px-1">
          <Card className="relative overflow-hidden border-0 shadow-sm hover:shadow-md transition-all hover:scale-[1.02] bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/50 dark:to-blue-900/30">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-blue-600/70 dark:text-blue-400/70 uppercase tracking-wider">Total Productos</p>
                  <p className="text-2xl font-bold mt-1 text-blue-900 dark:text-blue-100" data-testid="text-total-products">{priceListResponse?.totalCount || products.length}</p>
                </div>
                <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-blue-500/10 dark:bg-blue-400/10 backdrop-blur-sm">
                  <Package className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-400 to-blue-600" />
            </CardContent>
          </Card>
          <Card className="relative overflow-hidden border-0 shadow-sm hover:shadow-md transition-all hover:scale-[1.02] bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/50 dark:to-emerald-900/30">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-emerald-600/70 dark:text-emerald-400/70 uppercase tracking-wider">Con Precio</p>
                  <p className="text-2xl font-bold mt-1 text-emerald-900 dark:text-emerald-100" data-testid="text-products-with-price">
                    {priceList.filter(p => Number(p.lista) > 0 || Number(p.desc10) > 0).length || products.filter(p =>
                      (p.price && parseFloat(p.price) > 0) ||
                      (p.priceProduct && p.priceProduct > 0) ||
                      (p.ecomPrice && p.ecomPrice > 0)
                    ).length}
                  </p>
                </div>
                <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-emerald-500/10 dark:bg-emerald-400/10 backdrop-blur-sm">
                  <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 to-emerald-600" />
            </CardContent>
          </Card>
          <Card className="relative overflow-hidden border-0 shadow-sm hover:shadow-md transition-all hover:scale-[1.02] bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-950/50 dark:to-amber-900/30">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-amber-600/70 dark:text-amber-400/70 uppercase tracking-wider">Catálogo SAP</p>
                  <p className="text-2xl font-bold mt-1 text-amber-900 dark:text-amber-100" data-testid="text-total-warehouses">
                    {priceListResponse?.totalCount || 0}
                  </p>
                </div>
                <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-amber-500/10 dark:bg-amber-400/10 backdrop-blur-sm">
                  <BookOpen className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 to-amber-600" />
            </CardContent>
          </Card>
          <Card className="relative overflow-hidden border-0 shadow-sm hover:shadow-md transition-all hover:scale-[1.02] bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-950/50 dark:to-purple-900/30">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-purple-600/70 dark:text-purple-400/70 uppercase tracking-wider">eCommerce Activos</p>
                  <p className="text-2xl font-bold mt-1 text-purple-900 dark:text-purple-100" data-testid="text-ecom-active-products">
                    {products.filter(p => !!p.ecomActive).length}
                  </p>
                </div>
                <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-purple-500/10 dark:bg-purple-400/10 backdrop-blur-sm">
                  <ShoppingCart className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-400 to-purple-600" />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modern Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="tab-strip -mx-2 px-2 md:mx-0 md:px-0">
        <TabsList className="flex h-auto w-max min-w-full p-1 bg-muted/50 rounded-xl gap-1">
          <TabsTrigger value="lista-precios" className="flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-foreground">
            <DollarSign className="h-4 w-4" />
            <span className="hidden sm:inline">Lista de Precios</span>
            <span className="sm:hidden">Precios</span>
          </TabsTrigger>
          {!isVendedor && (<>
          <TabsTrigger value="sap" className="flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-foreground">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Catálogo SAP</span>
            <span className="sm:hidden">SAP</span>
          </TabsTrigger>
          <TabsTrigger value="grouped" className="flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-foreground">
            <Layers className="h-4 w-4" />
            <span className="hidden sm:inline">Agrupación Comercial</span>
            <span className="sm:hidden">Agrupado</span>
          </TabsTrigger>
          </>)}
          <TabsTrigger value="inventario" className="flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-foreground">
            <Package className="h-4 w-4" />
            <span className="hidden sm:inline">Inventario</span>
            <span className="sm:hidden">Inv</span>
          </TabsTrigger>
          {!isVendedor && (<>
          <TabsTrigger value="fletes" className="flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-foreground">
            <Truck className="h-4 w-4" />
            <span className="hidden sm:inline">Fletes</span>
            <span className="sm:hidden">Fletes</span>
          </TabsTrigger>
          <TabsTrigger value="categorias" className="flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-foreground">
            <Tags className="h-4 w-4" />
            <span className="hidden sm:inline">Categorías y Etiquetas</span>
            <span className="sm:hidden">Tags</span>
          </TabsTrigger>
          </>)}
          {/* Tab Orden oculta — ya se gestiona desde Catálogo Agrupado */}
        </TabsList>
        </div>

        {/* Tab de Lista de Precios */}
        <TabsContent value="lista-precios" className="space-y-4 mt-4">
          <ListaPrecios vendorView={isVendedor} />
        </TabsContent>

        {/* Tab de Catálogo SAP (Lista de Precios Comercial) */}
        <TabsContent value="sap" className="space-y-4 mt-4">
          {/* Search & Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar en SAP (código o producto)..."
                value={priceListSearch}
                onChange={(e) => {
                  setPriceListSearch(e.target.value);
                  setPriceListPage(0);
                }}
                className="pl-10 h-11 rounded-xl border-muted bg-muted/30 focus:bg-background transition-colors"
              />
            </div>
            <Select
              value={selectedUnidadPrice}
              onValueChange={(v) => {
                setSelectedUnidadPrice(v === "all" ? "" : v);
                setPriceListPage(0);
              }}
            >
              <SelectTrigger className="w-full sm:w-[200px] h-11 rounded-xl border-muted">
                <SelectValue placeholder="Formato / Unidad" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los formatos</SelectItem>
                {availableUnits.map(unit => (
                  <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Price Table */}
          <Card className="border-0 shadow-sm rounded-xl overflow-hidden">
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between space-y-0 bg-muted/30 border-b px-4 sm:px-6 py-4">
              <div className="min-w-0">
                <CardTitle className="text-base sm:text-lg">Catálogo de Precios Comerciales</CardTitle>
                <CardDescription className="mt-0.5">Información sincronizada con el tomador de pedidos</CardDescription>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Button size="sm" className="flex-1 sm:flex-none rounded-lg gap-1.5 bg-orange-500 hover:bg-orange-600 text-white" onClick={openAddPriceListDialog}>
                  <Plus className="h-3.5 w-3.5" />
                  Agregar Producto
                </Button>
                <Button variant="outline" size="sm" className="flex-1 sm:flex-none rounded-lg gap-1.5" onClick={() => setLocation('/lista-precios')}>
                  <ExternalLink className="h-3.5 w-3.5" />
                  Ver completo
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {priceListLoading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
                  <p className="text-sm text-muted-foreground">Cargando datos de SAP...</p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/20 hover:bg-muted/20">
                          <TableHead className="w-10">
                            <Checkbox
                              checked={priceList.length > 0 && selectedSapCodes.size === priceList.length}
                              onCheckedChange={toggleAllSapCodes}
                              aria-label="Seleccionar todos"
                            />
                          </TableHead>
                          <TableHead className="font-semibold text-xs uppercase tracking-wider">Código</TableHead>
                          <TableHead className="font-semibold text-xs uppercase tracking-wider">Producto</TableHead>
                          <TableHead className="font-semibold text-xs uppercase tracking-wider">Unidad</TableHead>
                          <TableHead className="text-right font-semibold text-xs uppercase tracking-wider">Lista</TableHead>
                          <TableHead className="text-right font-semibold text-xs uppercase tracking-wider">Desc. 10%</TableHead>
                          <TableHead className="text-right font-semibold text-xs uppercase tracking-wider">10%+5%</TableHead>
                          <TableHead className="text-right font-semibold text-xs uppercase tracking-wider">10%+5%+3%</TableHead>
                          <TableHead className="text-right font-semibold text-xs uppercase tracking-wider">Mínimo</TableHead>
                          <TableHead className="text-right font-semibold text-xs uppercase tracking-wider text-rose-600 dark:text-rose-400">Oferta</TableHead>
                          <TableHead className="w-8"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {priceList.map((item, i) => (
                          <TableRow
                            key={item.id}
                            className={`cursor-pointer hover:bg-orange-50/50 dark:hover:bg-orange-950/20 transition-colors ${i % 2 === 0 ? '' : 'bg-muted/10'} ${selectedSapCodes.has(item.codigo) ? 'bg-blue-50/60 dark:bg-blue-950/30' : ''}`}
                          >
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <Checkbox
                                checked={selectedSapCodes.has(item.codigo)}
                                onCheckedChange={() => toggleSapCode(item.codigo)}
                                aria-label={`Seleccionar ${item.codigo}`}
                              />
                            </TableCell>
                            <TableCell
                              className="font-mono text-sm font-semibold text-orange-600 dark:text-orange-400"
                              onClick={() => setLocation(`/productos/${encodeURIComponent(item.codigo)}`)}
                            >{item.codigo}</TableCell>
                            <TableCell
                              className="font-medium text-sm"
                              onClick={() => setLocation(`/productos/${encodeURIComponent(item.codigo)}`)}
                            >{item.producto}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs font-normal rounded-md">{item.unidad}</Badge>
                            </TableCell>
                            <TableCell className="text-right tabular-nums font-medium">
                              {(() => {
                                const lista = Number(item.lista);
                                if (lista > 0) return `$${lista.toLocaleString('de-DE', { maximumFractionDigits: 0 })}`;
                                const desc10 = Number(item.desc10);
                                if (desc10 > 0) {
                                  const calculatedLista = Math.round(desc10 / 0.90);
                                  return `$${calculatedLista.toLocaleString('de-DE', { maximumFractionDigits: 0 })}`;
                                }
                                return <span className="text-muted-foreground">-</span>;
                              })()}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-muted-foreground">
                              {Number(item.desc10) > 0 ? `$${Number(item.desc10).toLocaleString('de-DE', { maximumFractionDigits: 0 })}` : '-'}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-muted-foreground">
                              {Number(item.desc10_5) > 0 ? `$${Number(item.desc10_5).toLocaleString('de-DE', { maximumFractionDigits: 0 })}` : '-'}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-muted-foreground">
                              {Number(item.desc10_5_3) > 0 ? `$${Number(item.desc10_5_3).toLocaleString('de-DE', { maximumFractionDigits: 0 })}` : '-'}
                            </TableCell>
                            <TableCell className="text-right tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">
                              {Number(item.minimo) > 0 ? `$${Number(item.minimo).toLocaleString('de-DE', { maximumFractionDigits: 0 })}` : '-'}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {Number(item.offerPrice) > 0 ? (
                                <div className="flex items-center justify-end gap-1.5">
                                  <Badge className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800 text-xs font-semibold px-1.5 py-0.5">
                                    ${Number(item.offerPrice).toLocaleString('de-DE', { maximumFractionDigits: 0 })}
                                  </Badge>
                                </div>
                              ) : (
                                <span className="text-muted-foreground/40">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={(e) => { e.stopPropagation(); openEditPriceListDialog(item); }}
                                  className="w-7 h-7 rounded-md hover:bg-blue-50 dark:hover:bg-blue-950/30 flex items-center justify-center text-muted-foreground hover:text-blue-600 transition-colors"
                                  title="Editar producto"
                                >
                                  <Edit className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); setDeletingPriceListId(item.id); }}
                                  className="w-7 h-7 rounded-md hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center justify-center text-muted-foreground hover:text-red-600 transition-colors"
                                  title="Eliminar producto"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Floating Bulk Offer Bar */}
                  {selectedSapCodes.size > 0 && (
                    <div className="sticky bottom-0 border-t bg-gradient-to-r from-rose-50 to-orange-50 dark:from-rose-950/40 dark:to-orange-950/40 px-6 py-3 flex flex-col sm:flex-row items-center gap-3 z-10 shadow-[0_-4px_12px_rgba(0,0,0,0.08)]">
                      <div className="flex items-center gap-2 text-sm font-medium text-rose-700 dark:text-rose-300">
                        <Tag className="h-4 w-4" />
                        <span>{selectedSapCodes.size} producto{selectedSapCodes.size > 1 ? 's' : ''} seleccionado{selectedSapCodes.size > 1 ? 's' : ''}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-1 justify-end">
                        <div className="relative">
                          <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                          <Input
                            type="number"
                            step="1"
                            min="0"
                            placeholder="Precio oferta..."
                            value={bulkOfferPriceInput}
                            onChange={(e) => setBulkOfferPriceInput(e.target.value)}
                            className="w-40 h-9 pl-8 rounded-lg text-sm"
                          />
                        </div>
                        <Button
                          size="sm"
                          className="h-9 rounded-lg bg-rose-600 hover:bg-rose-700 text-white gap-1.5"
                          onClick={handleBulkOfferSubmit}
                          disabled={!bulkOfferPriceInput || bulkOfferPriceMutation.isPending}
                        >
                          <Percent className="h-3.5 w-3.5" />
                          Aplicar Oferta
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-9 rounded-lg gap-1.5 text-muted-foreground"
                          onClick={handleRemoveOffers}
                          disabled={bulkOfferPriceMutation.isPending}
                        >
                          <X className="h-3.5 w-3.5" />
                          Quitar Ofertas
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-9 rounded-lg"
                          onClick={() => setSelectedSapCodes(new Set())}
                        >
                          Deseleccionar
                        </Button>
                      </div>
                    </div>
                  )}

                  {priceListResponse && priceListResponse.totalCount > itemsPerPage && (() => {
                    const totalPages = Math.ceil(priceListResponse.totalCount / itemsPerPage);
                    const currentPage = priceListPage;
                    // Generate page numbers to show
                    const pages: (number | 'ellipsis')[] = [];
                    if (totalPages <= 7) {
                      for (let i = 0; i < totalPages; i++) pages.push(i);
                    } else {
                      pages.push(0);
                      if (currentPage > 2) pages.push('ellipsis');
                      for (let i = Math.max(1, currentPage - 1); i <= Math.min(totalPages - 2, currentPage + 1); i++) {
                        pages.push(i);
                      }
                      if (currentPage < totalPages - 3) pages.push('ellipsis');
                      pages.push(totalPages - 1);
                    }
                    return (
                      <div className="flex items-center justify-between px-6 py-4 border-t bg-muted/10">
                        <p className="text-sm text-muted-foreground">
                          <span className="font-medium text-foreground">{priceListPage * itemsPerPage + 1}-{Math.min((priceListPage + 1) * itemsPerPage, priceListResponse.totalCount)}</span>
                          {' '}de{' '}
                          <span className="font-medium text-foreground">{priceListResponse.totalCount.toLocaleString('de-DE')}</span>
                          {' '}productos
                        </p>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline" size="sm"
                            className="h-8 w-8 p-0 rounded-lg"
                            onClick={() => setPriceListPage(p => p - 1)}
                            disabled={priceListPage === 0}
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          {pages.map((page, idx) =>
                            page === 'ellipsis' ? (
                              <span key={`e-${idx}`} className="px-1 text-muted-foreground">…</span>
                            ) : (
                              <Button
                                key={page}
                                variant={page === currentPage ? 'default' : 'outline'}
                                size="sm"
                                className={`h-8 min-w-[2rem] px-2 rounded-lg text-xs ${page === currentPage ? 'bg-orange-500 hover:bg-orange-600 text-white' : ''}`}
                                onClick={() => setPriceListPage(page)}
                              >
                                {page + 1}
                              </Button>
                            )
                          )}
                          <Button
                            variant="outline" size="sm"
                            className="h-8 w-8 p-0 rounded-lg"
                            onClick={() => setPriceListPage(p => p + 1)}
                            disabled={!priceListResponse.hasMore}
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })()}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== ADD / EDIT Price List Dialog ===== */}
        <Dialog open={showPriceListDialog} onOpenChange={(open) => { if (!open) { setShowPriceListDialog(false); setEditingPriceListItem(null); } }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {editingPriceListItem ? <Edit className="h-5 w-5 text-blue-500" /> : <Plus className="h-5 w-5 text-orange-500" />}
                {editingPriceListItem ? 'Editar Producto' : 'Agregar Producto al Catálogo'}
              </DialogTitle>
              <DialogDescription>
                {editingPriceListItem ? `Editando ${editingPriceListItem.codigo}` : 'Completa los datos del nuevo producto'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="pl-codigo" className="text-xs font-semibold">Código *</Label>
                  <Input
                    id="pl-codigo"
                    placeholder="Ej: PCA106BLANCO2"
                    value={plForm.codigo}
                    onChange={(e) => setPlForm(p => ({ ...p, codigo: e.target.value }))}
                    disabled={!!editingPriceListItem}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pl-unidad" className="text-xs font-semibold">Unidad</Label>
                  <Select value={plForm.unidad} onValueChange={(v) => setPlForm(p => ({ ...p, unidad: v }))}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                    <SelectContent>
                      {availableUnits.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pl-producto" className="text-xs font-semibold">Producto *</Label>
                <Input
                  id="pl-producto"
                  placeholder="Nombre del producto"
                  value={plForm.producto}
                  onChange={(e) => setPlForm(p => ({ ...p, producto: e.target.value }))}
                  className="h-9"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Lista</Label>
                  <Input type="number" placeholder="0" value={plForm.lista} onChange={(e) => setPlForm(p => ({ ...p, lista: e.target.value }))} className="h-9 text-right font-mono" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Desc. 10%</Label>
                  <Input type="number" placeholder="0" value={plForm.desc10} onChange={(e) => setPlForm(p => ({ ...p, desc10: e.target.value }))} className="h-9 text-right font-mono" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">10%+5%</Label>
                  <Input type="number" placeholder="0" value={plForm.desc10_5} onChange={(e) => setPlForm(p => ({ ...p, desc10_5: e.target.value }))} className="h-9 text-right font-mono" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">10%+5%+3%</Label>
                  <Input type="number" placeholder="0" value={plForm.desc10_5_3} onChange={(e) => setPlForm(p => ({ ...p, desc10_5_3: e.target.value }))} className="h-9 text-right font-mono" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Mínimo</Label>
                  <Input type="number" placeholder="0" value={plForm.minimo} onChange={(e) => setPlForm(p => ({ ...p, minimo: e.target.value }))} className="h-9 text-right font-mono" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Canal Digital</Label>
                  <Input type="number" placeholder="0" value={plForm.canalDigital} onChange={(e) => setPlForm(p => ({ ...p, canalDigital: e.target.value }))} className="h-9 text-right font-mono" />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => { setShowPriceListDialog(false); setEditingPriceListItem(null); }}>Cancelar</Button>
                <Button
                  className="bg-orange-500 hover:bg-orange-600 text-white gap-1.5"
                  disabled={!plForm.codigo.trim() || !plForm.producto.trim() || createPriceListMutation.isPending || updatePriceListMutation.isPending}
                  onClick={handlePriceListSubmit}
                >
                  {(createPriceListMutation.isPending || updatePriceListMutation.isPending) ? 'Guardando...' : (editingPriceListItem ? 'Guardar Cambios' : 'Agregar')}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* ===== DELETE Confirmation Dialog ===== */}
        <Dialog open={!!deletingPriceListId} onOpenChange={(open) => { if (!open) setDeletingPriceListId(null); }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600">
                <Trash2 className="h-5 w-5" />
                Eliminar Producto
              </DialogTitle>
              <DialogDescription>
                ¿Estás seguro de que deseas eliminar este producto del catálogo? Esta acción no se puede deshacer.
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setDeletingPriceListId(null)}>Cancelar</Button>
              <Button
                variant="destructive"
                className="gap-1.5"
                disabled={deletePriceListMutation.isPending}
                onClick={() => { if (deletingPriceListId) deletePriceListMutation.mutate(deletingPriceListId); }}
              >
                <Trash2 className="h-3.5 w-3.5" />
                {deletePriceListMutation.isPending ? 'Eliminando...' : 'Eliminar'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Tab de Catálogo Agrupado */}
        <TabsContent value="grouped" className="space-y-4">
          <GroupedCatalog />
        </TabsContent>


        {/* Tab de Inventario */}
        <TabsContent value="inventario" className="space-y-4 mt-4">
          <InventarioContent />
        </TabsContent>

        {/* Tab de Fletes */}
        <TabsContent value="fletes" className="space-y-4 mt-4">
          <FletesContent />
        </TabsContent>

        {/* Tab de Categorías y Etiquetas */}
        <TabsContent value="categorias" className="space-y-4 mt-4">
          <CategoriasEtiquetasContent />
        </TabsContent>

        {/* Tab Orden oculta — ya se gestiona desde Catálogo Agrupado */}
      </Tabs>

      {/* Dialog para editar precio */}
      <Dialog open={showPriceDialog} onOpenChange={setShowPriceDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Precios</DialogTitle>
            <DialogDescription>
              Actualizar precios para {selectedProduct?.sku} - {selectedProduct?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="price">Precio Normal</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                placeholder="0.00"
                data-testid="input-new-price"
              />
            </div>
            <div>
              <Label htmlFor="offer-price">Precio de Oferta (opcional)</Label>
              <Input
                id="offer-price"
                type="number"
                step="0.01"
                value={newOfferPrice}
                onChange={(e) => setNewOfferPrice(e.target.value)}
                placeholder="0.00"
                data-testid="input-offer-price"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="show-in-store"
                checked={showInStore}
                onCheckedChange={setShowInStore}
                data-testid="switch-show-in-store"
              />
              <Label htmlFor="show-in-store">Mostrar en tienda</Label>
            </div>
            <div>
              <Label htmlFor="reason">Motivo del cambio (opcional)</Label>
              <Textarea
                id="reason"
                value={priceReason}
                onChange={(e) => setPriceReason(e.target.value)}
                placeholder="Describe el motivo del cambio de precio..."
                data-testid="textarea-price-reason"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowPriceDialog(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handlePriceUpdate}
                disabled={!newPrice || updatePriceMutation.isPending}
                data-testid="button-update-price"
              >
                {updatePriceMutation.isPending ? "Actualizando..." : "Actualizar Precios"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog para gestión de eCommerce */}
      <Dialog open={showEcomDialog} onOpenChange={setShowEcomDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Gestión de eCommerce</DialogTitle>
            <DialogDescription>
              Configurar propiedades de eCommerce para {selectedProduct?.kopr || selectedProduct?.sku} - {selectedProduct?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            {/* eCommerce Active Toggle */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Switch
                  id="ecom-active"
                  checked={ecomActiveValue}
                  onCheckedChange={setEcomActiveValue}
                  data-testid="switch-ecom-active"
                />
                <Label htmlFor="ecom-active" className="text-sm font-medium">Activo en eCommerce</Label>
              </div>
              <p className="text-xs text-muted-foreground">
                Habilita este producto para ser visible en la tienda online
              </p>
            </div>

            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ecom-slug">URL Slug</Label>
                <Input
                  id="ecom-slug"
                  value={ecomSlug}
                  onChange={(e) => setEcomSlug(e.target.value)}
                  placeholder="producto-ejemplo"
                  data-testid="input-ecom-slug"
                />
                <p className="text-xs text-muted-foreground">
                  URL amigable para SEO (solo letras minúsculas, números y guiones)
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ecom-price">Precio eCommerce</Label>
                <Input
                  id="ecom-price"
                  type="number"
                  step="0.01"
                  value={ecomPriceValue}
                  onChange={(e) => setEcomPriceValue(e.target.value)}
                  placeholder="0.00"
                  data-testid="input-ecom-price"
                />
                <p className="text-xs text-muted-foreground">
                  Precio específico para la tienda online
                </p>
              </div>
            </div>

            {/* Category */}
            <div className="space-y-2">
              <Label htmlFor="ecom-category">Categoría</Label>
              <Input
                id="ecom-category"
                value={ecomCategory}
                onChange={(e) => setEcomCategory(e.target.value)}
                placeholder="Categoria del producto"
                data-testid="input-ecom-category"
              />
              <p className="text-xs text-muted-foreground">
                Categoría para organizar productos en la tienda
              </p>
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <Label>Tags del Producto</Label>
              <div className="flex gap-2 mb-2">
                <Input
                  placeholder="Agregar tag"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      const target = e.target as HTMLInputElement;
                      addTag(target.value);
                      target.value = '';
                    }
                  }}
                  data-testid="input-add-tag"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const input = document.querySelector('[data-testid="input-add-tag"]') as HTMLInputElement;
                    if (input && input.value.trim()) {
                      addTag(input.value.trim());
                      input.value = '';
                    }
                  }}
                >
                  <Tags className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-1">
                {ecomTags.map((tag, index) => (
                  <Badge key={index} variant="secondary" className="text-xs">
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="ml-1 text-xs hover:text-destructive"
                      data-testid={`remove-tag-${index}`}
                    >
                      ×
                    </button>
                  </Badge>
                ))}
              </div>
            </div>

            {/* Images */}
            <div className="space-y-2">
              <Label>Imágenes del Producto</Label>
              <div className="flex gap-2 mb-2">
                <Input
                  placeholder="URL de imagen"
                  value={newImageUrl}
                  onChange={(e) => setNewImageUrl(e.target.value)}
                  data-testid="input-image-url"
                />
                <Input
                  placeholder="Texto alternativo"
                  value={newImageAlt}
                  onChange={(e) => setNewImageAlt(e.target.value)}
                  data-testid="input-image-alt"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addImageToProduct}
                  disabled={!newImageUrl || !newImageAlt}
                >
                  <Image className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
                {ecomImages.map((image, index) => (
                  <div key={image.id} className="flex items-center gap-2 p-2 border rounded">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs truncate" title={image.url}>{image.url}</p>
                      <p className="text-xs text-muted-foreground">{image.alt}</p>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setPrimaryImage(image.id)}
                        className={image.primary ? 'bg-primary text-primary-foreground' : ''}
                        data-testid={`primary-image-${index}`}
                      >
                        {image.primary ? '★' : '☆'}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => removeImageFromProduct(image.id)}
                        data-testid={`remove-image-${index}`}
                      >
                        ×
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* SEO Fields */}
            <div className="space-y-4">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="skus" className="flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4" />
                  <span>SKUs Disponibles</span>
                </TabsTrigger>
                <TabsTrigger value="segments" className="flex items-center gap-2">
                  <Palette className="h-4 w-4" />
                  <span>Segmentos</span>
                </TabsTrigger>
                <TabsTrigger value="seo" className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  <span>SEO</span>
                </TabsTrigger>
              </TabsList>

              <div className="space-y-2">
                <Label htmlFor="seo-title">Título SEO</Label>
                <Input
                  id="seo-title"
                  value={ecomSeoTitle}
                  onChange={(e) => setEcomSeoTitle(e.target.value)}
                  placeholder="Título optimizado para buscadores"
                  data-testid="input-seo-title"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="seo-description">Descripción SEO</Label>
                <Textarea
                  id="seo-description"
                  value={ecomSeoDescription}
                  onChange={(e) => setEcomSeoDescription(e.target.value)}
                  placeholder="Descripción para motores de búsqueda (150-160 caracteres recomendado)"
                  rows={3}
                  data-testid="textarea-seo-description"
                />
                <p className="text-xs text-muted-foreground">
                  {ecomSeoDescription.length}/160 caracteres
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="og-image">Imagen Open Graph</Label>
                <Input
                  id="og-image"
                  value={ecomOgImage}
                  onChange={(e) => setEcomOgImage(e.target.value)}
                  placeholder="URL de imagen para redes sociales"
                  data-testid="input-og-image"
                />
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => setShowEcomDialog(false)}
                data-testid="button-cancel-ecom"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleEcommerceUpdate}
                disabled={updateEcommerceMutation.isPending}
                data-testid="button-save-ecom"
              >
                {updateEcommerceMutation.isPending ? "Guardando..." : "Guardar Configuración"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog para ver stock detallado de bodega */}
      <Dialog open={showStockDialog} onOpenChange={setShowStockDialog}>
        <DialogContent className="max-w-6xl">
          <DialogHeader>
            <DialogTitle>Stock Detallado - {selectedWarehouse}</DialogTitle>
            <DialogDescription>
              Inventario completo por producto en esta bodega
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead>Sucursal</TableHead>
                  <TableHead>Stock Físico 1</TableHead>
                  <TableHead>Stock Físico 2</TableHead>
                  <TableHead>Stock Disponible 1</TableHead>
                  <TableHead>Stock Disponible 2</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No hay datos de stock por bodega disponibles.
                    <br />
                    Esta funcionalidad será implementada en una futura actualización.
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}