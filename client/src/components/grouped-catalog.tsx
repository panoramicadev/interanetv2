import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
    DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import {
    Search, Package, Palette, ChevronDown, ChevronRight, ChevronUp,
    Weight, Ruler, Truck, Loader2, Upload, Trash2, Box, Tag, ArrowUp, ArrowDown, ImageIcon, Check, Plus, AlertTriangle,
    MoreVertical, Pencil,
} from "lucide-react";

interface FormatVariant {
    ecomId: string;
    sku: string;
    name: string;
    color: string;
    format: string;
    groupName: string | null;
    price: string | null;
    priceList: string | null;
    stock: number;
    minUnit: number;
    stepSize: number;
    description: string | null;
    dimensions: {
        weight: string | null; weightUnit: string | null;
        length: string | null; lengthUnit: string | null;
        width: string | null; widthUnit: string | null;
        height: string | null; heightUnit: string | null;
        volume: string | null; volumeUnit: string | null;
    };
    packaging: {
        packageName: string | null; packageUnit: string | null; amountPerPackage: number | null;
        boxName: string | null; boxUnit: string | null; amountPerBox: number | null;
        palletName: string | null; palletUnit: string | null; amountPerPallet: number | null;
    };
}

interface GenericProduct {
    genericName: string;
    groupName: string | null;
    tags: string[];
    breveResena: string | null;
    colors: { [color: string]: FormatVariant[] };
}

interface CatalogResponse {
    catalog: GenericProduct[];
    availableGroups: string[];
    totalProducts: number;
}

// Parse CSV handling quoted fields with commas
function parseGroupedCSV(text: string): Record<string, string>[] {
    const lines = text.split('\n').filter(l => l.trim());
    if (lines.length < 2) return [];

    const parseLine = (line: string): string[] => {
        const result: string[] = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"') {
                inQuotes = !inQuotes;
            } else if (ch === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += ch;
            }
        }
        result.push(current.trim());
        return result;
    };

    const headers = parseLine(lines[0]);
    const rows: Record<string, string>[] = [];
    for (let i = 1; i < lines.length; i++) {
        const values = parseLine(lines[i]);
        const row: Record<string, string> = {};
        headers.forEach((h, idx) => {
            row[h] = values[idx] || '';
        });
        rows.push(row);
    }
    return rows;
}

function PackagingInfo({ p }: { p: FormatVariant["packaging"] }) {
    const formats = [
        p.amountPerPackage && { name: p.packageName || "Display", qty: p.amountPerPackage },
        p.amountPerBox && { name: p.boxName || "Caja", qty: p.amountPerBox },
        p.amountPerPallet && { name: p.palletName || "Pallet", qty: p.amountPerPallet },
    ].filter(Boolean) as { name: string; qty: number }[];

    if (formats.length === 0) return null;

    return (
        <div className="flex items-center gap-2 flex-wrap">
            {formats.map((f, i) => (
                <Badge key={i} variant="outline" className="text-xs font-normal">
                    <Truck className="h-3 w-3 mr-1" />
                    {f.name}: {f.qty} uds
                </Badge>
            ))}
        </div>
    );
}

export default function GroupedCatalog() {
    const [search, setSearch] = useState("");
    const [groupFilter, setGroupFilter] = useState("all");
    const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
    const [selectedColors, setSelectedColors] = useState<Map<string, string>>(new Map());
    const [, setLocation] = useLocation();
    const { toast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const { data, isLoading } = useQuery<CatalogResponse>({
        queryKey: ["/api/products/grouped-catalog", { search, groupFilter }],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (search) params.set("search", search);
            if (groupFilter !== "all") params.set("groupFilter", groupFilter);
            const res = await apiRequest("GET", `/api/products/grouped-catalog?${params}`);
            return res.json();
        },
    });

    // Import mutation
    const importMutation = useMutation({
        mutationFn: async (products: Record<string, string>[]) => {
            const res = await apiRequest("POST", "/api/products/import-grouped-catalog", { products });
            return res.json();
        },
        onSuccess: (data: any) => {
            queryClient.invalidateQueries({ queryKey: ["/api/products/grouped-catalog"] });
            toast({
                title: "Importación completada",
                description: `${data.imported} productos importados de ${data.total} filas.`,
            });
        },
        onError: () => {
            toast({ variant: "destructive", title: "Error", description: "No se pudo importar el catálogo CSV." });
        },
    });

    // Clean table mutation
    const cleanMutation = useMutation({
        mutationFn: async () => {
            const res = await apiRequest("DELETE", "/api/products/grouped-catalog");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/products/grouped-catalog"] });
            toast({ title: "Tabla limpiada", description: "Se eliminaron todos los productos del catálogo agrupado." });
        },
        onError: () => {
            toast({ variant: "destructive", title: "Error", description: "No se pudo limpiar la tabla." });
        },
    });

    // Reorder product mutation (swap up/down)
    const reorderMutation = useMutation({
        mutationFn: async ({ productName, direction }: { productName: string; direction: 'up' | 'down' }) => {
            const res = await fetch("/api/ecommerce/product-order/swap", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ productName, direction }),
                credentials: "include",
            });
            if (!res.ok) throw new Error("Error al reordenar");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/products/grouped-catalog"] });
            queryClient.invalidateQueries({ queryKey: ["/api/public/products/grouped"] });
        },
    });

    // Set position mutation (move product to a specific index)
    const setPositionMutation = useMutation({
        mutationFn: async ({ productName, newPosition }: { productName: string; newPosition: number }) => {
            // First get current order
            const orderRes = await fetch("/api/ecommerce/product-order", { credentials: "include" });
            let order: string[] = await orderRes.json();

            // If order is empty, build from catalog
            if (!Array.isArray(order) || order.length === 0) {
                order = catalog.map((p: any) => p.genericName);
            }

            // Remove product from current position
            order = order.filter(n => n !== productName);
            // Ensure product names not in order get appended
            const catalogNames = catalog.map((p: any) => p.genericName);
            catalogNames.forEach((name: string) => {
                if (!order.includes(name)) order.push(name);
            });
            // Remove product again in case it was added
            order = order.filter(n => n !== productName);

            // Clamp position
            const targetIdx = Math.max(0, Math.min(newPosition - 1, order.length));
            order.splice(targetIdx, 0, productName);

            // Save
            const res = await fetch("/api/ecommerce/product-order", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ order }),
                credentials: "include",
            });
            if (!res.ok) throw new Error("Error al guardar orden");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/products/grouped-catalog"] });
            queryClient.invalidateQueries({ queryKey: ["/api/public/products/grouped"] });
            setEditingPosition(null);
        },
    });

    // State for editing position number
    const [editingPosition, setEditingPosition] = useState<string | null>(null);
    const [editingPositionValue, setEditingPositionValue] = useState("");

    // State for editing the agrupación (genericName)
    const [editingName, setEditingName] = useState<string | null>(null);
    const [editingNameValue, setEditingNameValue] = useState("");

    const renameMutation = useMutation({
        mutationFn: async ({ oldName, newName }: { oldName: string; newName: string }) => {
            const res = await apiRequest("PATCH", "/api/products/grouped-catalog/rename", { oldName, newName });
            return res.json();
        },
        onSuccess: (data: any) => {
            queryClient.invalidateQueries({ queryKey: ["/api/products/grouped-catalog"] });
            queryClient.invalidateQueries({ queryKey: ["/api/public/products/grouped"] });
            queryClient.invalidateQueries({ queryKey: ["/api/store/products/grouped"] });
            queryClient.invalidateQueries({ queryKey: ["/api/ecommerce/product-group-images"] });
            setEditingName(null);
            if (!data?.unchanged) {
                toast({ title: "Agrupación renombrada", description: `${data?.oldName} → ${data?.newName}` });
            }
        },
        onError: (err: any) => {
            toast({ variant: "destructive", title: "Error al renombrar", description: err?.message || "No se pudo renombrar la agrupación." });
        },
    });

    const commitRename = (oldName: string) => {
        const newName = editingNameValue.trim();
        if (!newName || newName.toUpperCase() === oldName.toUpperCase()) {
            setEditingName(null);
            return;
        }
        renameMutation.mutate({ oldName, newName });
    };

    // Delete agrupación (deletes all SKUs from ecommerce_products; SAP entries remain)
    const [deleteTarget, setDeleteTarget] = useState<GenericProduct | null>(null);
    const deleteFamilyMutation = useMutation({
        mutationFn: async (genericName: string) => {
            const res = await apiRequest("DELETE", "/api/products/grouped-catalog/family", { genericName });
            return res.json();
        },
        onSuccess: (data: any) => {
            queryClient.invalidateQueries({ queryKey: ["/api/products/grouped-catalog"] });
            queryClient.invalidateQueries({ queryKey: ["/api/products/grouped-catalog/unpublished"] });
            queryClient.invalidateQueries({ queryKey: ["/api/public/products/grouped"] });
            queryClient.invalidateQueries({ queryKey: ["/api/store/products/grouped"] });
            queryClient.invalidateQueries({ queryKey: ["/api/ecommerce/product-group-images"] });
            toast({
                title: "Agrupación eliminada",
                description: `${data?.genericName} — ${data?.deleted} SKU${data?.deleted === 1 ? '' : 's'} despublicado${data?.deleted === 1 ? '' : 's'}`,
            });
            setDeleteTarget(null);
        },
        onError: (err: any) => {
            toast({ variant: "destructive", title: "Error al eliminar", description: err?.message || "No se pudo eliminar la agrupación." });
        },
    });

    // Dynamic tags from API
    const TAG_COLOR_MAP: Record<string, { active: string; inactive: string }> = {
        green: { active: 'bg-green-500 text-white border-green-600 shadow-green-200 shadow-md ring-2 ring-green-300', inactive: 'bg-white text-green-700 border-dashed border-green-300 hover:bg-green-50' },
        blue: { active: 'bg-blue-500 text-white border-blue-600 shadow-blue-200 shadow-md ring-2 ring-blue-300', inactive: 'bg-white text-blue-700 border-dashed border-blue-300 hover:bg-blue-50' },
        amber: { active: 'bg-amber-500 text-white border-amber-600 shadow-amber-200 shadow-md ring-2 ring-amber-300', inactive: 'bg-white text-amber-700 border-dashed border-amber-300 hover:bg-amber-50' },
        red: { active: 'bg-red-500 text-white border-red-600', inactive: 'bg-white text-red-700 border-dashed border-red-300 hover:bg-red-50' },
        purple: { active: 'bg-purple-500 text-white border-purple-600', inactive: 'bg-white text-purple-700 border-dashed border-purple-300 hover:bg-purple-50' },
        pink: { active: 'bg-pink-500 text-white border-pink-600', inactive: 'bg-white text-pink-700 border-dashed border-pink-300 hover:bg-pink-50' },
        cyan: { active: 'bg-cyan-500 text-white border-cyan-600', inactive: 'bg-white text-cyan-700 border-dashed border-cyan-300 hover:bg-cyan-50' },
        orange: { active: 'bg-orange-500 text-white border-orange-600', inactive: 'bg-white text-orange-700 border-dashed border-orange-300 hover:bg-orange-50' },
        indigo: { active: 'bg-indigo-500 text-white border-indigo-600', inactive: 'bg-white text-indigo-700 border-dashed border-indigo-300 hover:bg-indigo-50' },
        teal: { active: 'bg-teal-500 text-white border-teal-600', inactive: 'bg-white text-teal-700 border-dashed border-teal-300 hover:bg-teal-50' },
    };
    const TAG_BADGE_BG: Record<string, string> = {
        green: 'bg-green-500 text-white border-green-600',
        blue: 'bg-blue-500 text-white border-blue-600',
        amber: 'bg-amber-500 text-white border-amber-600',
        red: 'bg-red-500 text-white border-red-600',
        purple: 'bg-purple-500 text-white border-purple-600',
        pink: 'bg-pink-500 text-white border-pink-600',
        cyan: 'bg-cyan-500 text-white border-cyan-600',
        orange: 'bg-orange-500 text-white border-orange-600',
        indigo: 'bg-indigo-500 text-white border-indigo-600',
        teal: 'bg-teal-500 text-white border-teal-600',
    };

    const { data: dynamicTags = [] } = useQuery<{ name: string; color: string }[]>({
        queryKey: ['/api/ecommerce/tags'],
        queryFn: async () => {
            const res = await fetch('/api/ecommerce/tags', { credentials: 'include' });
            if (!res.ok) return [];
            return res.json();
        },
    });

    // Product group images
    const { data: savedGroupImages = {} } = useQuery<Record<string, string>>({
        queryKey: ['/api/ecommerce/product-group-images'],
        queryFn: async () => {
            const res = await fetch('/api/ecommerce/product-group-images', { credentials: 'include' });
            if (!res.ok) return {};
            return res.json();
        },
    });

    const [imagePickerOpen, setImagePickerOpen] = useState(false);
    const [imagePickerProduct, setImagePickerProduct] = useState<any>(null);
    const [imageSaving, setImageSaving] = useState(false);
    const [isUploadingCustom, setIsUploadingCustom] = useState(false);
    const customImageRef = useRef<HTMLInputElement>(null);

    const handleCustomImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !imagePickerProduct) return;
        
        setIsUploadingCustom(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            
            const uploadRes = await fetch('/api/upload', {
                method: 'POST',
                credentials: 'include',
                body: formData,
            });
            
            if (!uploadRes.ok) throw new Error('Error subiendo imagen');
            const uploadData = await uploadRes.json();
            const fileUrl = uploadData.url || uploadData.fileUrl;
            
            await handleSaveImage(imagePickerProduct.genericName, fileUrl);
        } catch (err) {
            toast({ title: 'Error al subir imagen', variant: 'destructive' });
        } finally {
            setIsUploadingCustom(false);
            if (customImageRef.current) customImageRef.current.value = '';
        }
    };

    // Extract all unique images from a product
    const getAvailableImages = (product: any): { url: string; label: string }[] => {
        const images: { url: string; label: string }[] = [];
        const seen = new Set<string>();
        const colors = product.colors || {};
        for (const [colorName, variants] of Object.entries(colors)) {
            for (const v of (variants as any[])) {
                if (v.imageUrl && !seen.has(v.imageUrl)) {
                    seen.add(v.imageUrl);
                    images.push({ url: v.imageUrl, label: `${colorName} — ${v.format || 'Sin formato'}` });
                }
            }
        }
        return images;
    };

    // Get display image for a product
    const getProductImage = (product: any): string | null => {
        if (savedGroupImages[product.genericName]) return savedGroupImages[product.genericName];
        // Auto-select first available image
        const colors = product.colors || {};
        for (const variants of Object.values(colors)) {
            for (const v of (variants as any[])) {
                if (v.imageUrl) return v.imageUrl;
            }
        }
        return null;
    };

    // Save image for product group
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
            queryClient.invalidateQueries({ queryKey: ['/api/ecommerce/product-group-images'] });
            queryClient.invalidateQueries({ queryKey: ['/api/store/products/grouped'] });
            queryClient.invalidateQueries({ queryKey: ['/api/public/products/grouped'] });
            toast({ title: imageUrl ? 'Imagen actualizada' : 'Imagen restablecida', description: genericName });
            setImagePickerOpen(false);
        } catch {
            toast({ title: 'Error al guardar imagen', variant: 'destructive' });
        } finally {
            setImageSaving(false);
        }
    };

    const tagMutation = useMutation({
        mutationFn: async ({ productFamily, tag, action }: { productFamily: string; tag: string; action: 'add' | 'remove' }) => {
            const res = await fetch("/api/products/grouped-catalog/tags", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ productFamily, tag, action }),
                credentials: "include",
            });
            if (!res.ok) {
                const err = await res.text();
                console.error('Tag mutation error:', res.status, err);
                throw new Error(err);
            }
            return res.json();
        },
        onSuccess: (data) => {
            console.log('Tag updated:', data);
            queryClient.invalidateQueries({ queryKey: ["/api/products/grouped-catalog"] });
            queryClient.invalidateQueries({ queryKey: ["/api/public/products/grouped"] });
        },
        onError: (error) => {
            console.error('Tag mutation onError:', error);
            toast({ variant: "destructive", title: "Error", description: String(error) });
        },
    });

    // ===== Add SKU to existing grouping =====
    const [addSkuOpen, setAddSkuOpen] = useState(false);
    const [addSkuTarget, setAddSkuTarget] = useState<{ genericName: string; colors: string[]; formats: string[] } | null>(null);
    const [skuQuery, setSkuQuery] = useState("");
    const [selectedSku, setSelectedSku] = useState<{ codigo: string; producto: string; unidad: string | null; lista: string | null } | null>(null);
    const [addColor, setAddColor] = useState("");
    const [addFormat, setAddFormat] = useState("");
    const [addPrice, setAddPrice] = useState("");

    const resetAddSkuForm = () => {
        setSkuQuery("");
        setSelectedSku(null);
        setAddColor("");
        setAddFormat("");
        setAddPrice("");
    };

    const openAddSkuDialog = (product: GenericProduct) => {
        const colorKeys = Object.keys(product.colors);
        const formatsSet = new Set<string>();
        colorKeys.forEach(c => product.colors[c].forEach(v => v.format && formatsSet.add(v.format)));
        setAddSkuTarget({
            genericName: product.genericName,
            colors: colorKeys,
            formats: Array.from(formatsSet),
        });
        resetAddSkuForm();
        setAddSkuOpen(true);
    };

    // SKU autocomplete — debounced query against /api/price-list
    const [debouncedSkuQuery, setDebouncedSkuQuery] = useState("");
    useEffect(() => {
        const t = setTimeout(() => setDebouncedSkuQuery(skuQuery), 250);
        return () => clearTimeout(t);
    }, [skuQuery]);

    const { data: skuSearchResults = [] } = useQuery<any[]>({
        queryKey: ["/api/price-list/search-for-grouping", debouncedSkuQuery],
        queryFn: async () => {
            if (!debouncedSkuQuery || debouncedSkuQuery.length < 2) return [];
            const res = await apiRequest("GET", `/api/price-list?search=${encodeURIComponent(debouncedSkuQuery)}&limit=15`);
            const data = await res.json();
            return data.items || [];
        },
        enabled: addSkuOpen && debouncedSkuQuery.length >= 2,
    });

    // Look up if a SKU is already part of another grouping using the cached catalog (no extra request)
    const findExistingGrouping = (sku: string): { genericName: string; color: string; format: string } | null => {
        const upper = sku.toUpperCase();
        for (const product of catalog) {
            for (const [color, variants] of Object.entries(product.colors)) {
                for (const v of variants) {
                    if (v.sku?.toUpperCase() === upper) {
                        return { genericName: product.genericName, color, format: v.format };
                    }
                }
            }
        }
        return null;
    };

    const addSkuMutation = useMutation({
        mutationFn: async (payload: { sku: string; genericName: string; color: string; formatUnit: string; price: number | null }) => {
            const res = await apiRequest("POST", "/api/products/grouped-catalog/add-sku", payload);
            return res.json();
        },
        onSuccess: (data: any) => {
            queryClient.invalidateQueries({ queryKey: ["/api/products/grouped-catalog"] });
            queryClient.invalidateQueries({ queryKey: ["/api/public/products/grouped"] });
            queryClient.invalidateQueries({ queryKey: ["/api/store/products/grouped"] });
            toast({
                title: data?.wasUpdate ? "SKU reasignado" : "SKU agregado",
                description: `${data?.sku} → ${data?.genericName} / ${data?.color}`,
            });
            setAddSkuOpen(false);
            resetAddSkuForm();
        },
        onError: (err: any) => {
            toast({ variant: "destructive", title: "Error", description: err?.message || "No se pudo agregar el SKU." });
        },
    });

    const submitAddSku = () => {
        if (!addSkuTarget || !selectedSku) return;
        const color = addColor.trim();
        const format = addFormat.trim();
        if (!color) {
            toast({ variant: "destructive", title: "Color requerido", description: "Indicá el color de la variante." });
            return;
        }
        if (!format) {
            toast({ variant: "destructive", title: "Formato requerido", description: "Indicá el formato (ej: Balde 4 Galones)." });
            return;
        }
        const priceNum = addPrice.trim() === "" ? null : Number(addPrice);
        if (priceNum !== null && (Number.isNaN(priceNum) || priceNum < 0)) {
            toast({ variant: "destructive", title: "Precio inválido", description: "Dejalo vacío o ingresá un número ≥ 0." });
            return;
        }
        addSkuMutation.mutate({
            sku: selectedSku.codigo,
            genericName: addSkuTarget.genericName,
            color,
            formatUnit: format,
            price: priceNum,
        });
    };

    // ===== Publish new SAP products into a commercial grouping =====
    interface UnpublishedItem {
        id: string;
        codigo: string;
        producto: string;
        unidad: string | null;
        lista: string | null;
    }
    type PublishForm = { genericName: string; color: string; format: string };

    const [publishOpen, setPublishOpen] = useState(false);
    const [publishSearch, setPublishSearch] = useState("");
    const [debouncedPublishSearch, setDebouncedPublishSearch] = useState("");
    const [publishForms, setPublishForms] = useState<Record<string, PublishForm>>({});
    const [publishingSku, setPublishingSku] = useState<string | null>(null);

    useEffect(() => {
        const t = setTimeout(() => setDebouncedPublishSearch(publishSearch), 250);
        return () => clearTimeout(t);
    }, [publishSearch]);

    const { data: unpublishedData, isLoading: unpublishedLoading } = useQuery<{ items: UnpublishedItem[]; total: number }>({
        queryKey: ["/api/products/grouped-catalog/unpublished", debouncedPublishSearch],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (debouncedPublishSearch) params.set("search", debouncedPublishSearch);
            const res = await apiRequest("GET", `/api/products/grouped-catalog/unpublished?${params}`);
            return res.json();
        },
        enabled: publishOpen,
    });
    const unpublished = unpublishedData?.items || [];

    const defaultPublishForm = (item: UnpublishedItem): PublishForm => ({
        genericName: (item.producto || "").trim().toUpperCase(),
        color: "ÚNICO",
        format: item.unidad || "",
    });

    // Seed editable form state with defaults for any newly-listed SKU.
    useEffect(() => {
        if (!unpublishedData?.items?.length) return;
        setPublishForms(prev => {
            const next = { ...prev };
            let changed = false;
            for (const item of unpublishedData.items) {
                if (!next[item.codigo]) {
                    next[item.codigo] = defaultPublishForm(item);
                    changed = true;
                }
            }
            return changed ? next : prev;
        });
    }, [unpublishedData]);

    const updatePublishForm = (codigo: string, patch: Partial<PublishForm>) => {
        setPublishForms(prev => ({
            ...prev,
            [codigo]: { ...(prev[codigo] || { genericName: "", color: "ÚNICO", format: "" }), ...patch },
        }));
    };

    const publishMutation = useMutation({
        mutationFn: async (payload: { sku: string; genericName: string; color: string; formatUnit: string; price: number | null }) => {
            const res = await apiRequest("POST", "/api/products/grouped-catalog/add-sku", payload);
            return res.json();
        },
        onSuccess: (data: any) => {
            queryClient.invalidateQueries({ queryKey: ["/api/products/grouped-catalog"] });
            queryClient.invalidateQueries({ queryKey: ["/api/products/grouped-catalog/unpublished"] });
            queryClient.invalidateQueries({ queryKey: ["/api/public/products/grouped"] });
            queryClient.invalidateQueries({ queryKey: ["/api/store/products/grouped"] });
            toast({ title: "Producto publicado", description: `${data?.sku} → ${data?.genericName} / ${data?.color}` });
            setPublishingSku(null);
        },
        onError: (err: any) => {
            toast({ variant: "destructive", title: "Error", description: err?.message || "No se pudo publicar el producto." });
            setPublishingSku(null);
        },
    });

    const submitPublish = (item: UnpublishedItem) => {
        const form = publishForms[item.codigo] || defaultPublishForm(item);
        const genericName = form.genericName.trim();
        const color = form.color.trim();
        const format = form.format.trim();
        if (!genericName) {
            toast({ variant: "destructive", title: "Agrupación requerida", description: "Indicá el nombre de la agrupación." });
            return;
        }
        if (!color) {
            toast({ variant: "destructive", title: "Color requerido", description: "Indicá un color (ej: ÚNICO)." });
            return;
        }
        if (!format) {
            toast({ variant: "destructive", title: "Formato requerido", description: "Indicá el formato (ej: Galón)." });
            return;
        }
        setPublishingSku(item.codigo);
        publishMutation.mutate({
            sku: item.codigo,
            genericName,
            color,
            formatUnit: format,
            price: item.lista ? Number(item.lista) : null,
        });
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const text = await file.text();
            const rows = parseGroupedCSV(text);
            if (rows.length === 0) {
                toast({ variant: "destructive", title: "CSV vacío", description: "El archivo no contiene datos válidos." });
                return;
            }
            importMutation.mutate(rows);
        } catch {
            toast({ variant: "destructive", title: "Error", description: "No se pudo leer el archivo CSV." });
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const catalog = data?.catalog || [];
    const availableGroups = data?.availableGroups || [];

    // Computed after `catalog` is in scope — findExistingGrouping reads it.
    const existingForSelectedSku = selectedSku ? findExistingGrouping(selectedSku.codigo) : null;

    const toggleProduct = (name: string) => {
        setExpandedProducts(prev => {
            const s = new Set(prev);
            s.has(name) ? s.delete(name) : s.add(name);
            return s;
        });
    };

    const selectColor = (productName: string, color: string) => {
        setSelectedColors(prev => {
            const m = new Map(prev);
            if (m.get(productName) === color) {
                m.delete(productName);
            } else {
                m.set(productName, color);
            }
            return m;
        });
    };

    const expandAll = () => {
        const all = new Set(catalog.map(p => p.genericName));
        setExpandedProducts(all);
    };

    const collapseAll = () => {
        setExpandedProducts(new Set());
        setSelectedColors(new Map());
    };

    return (
        <div className="space-y-4">
            <Card>
                <CardContent className="pt-6">
                    <div className="flex flex-col sm:flex-row gap-4">
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar por nombre, color o SKU..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                        <Select value={groupFilter} onValueChange={setGroupFilter}>
                            <SelectTrigger className="w-full sm:w-[220px]">
                                <SelectValue placeholder="Todas las categorías" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todas las categorías</SelectItem>
                                {availableGroups.map(g => (
                                    <SelectItem key={g} value={g}>{g}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <div className="flex gap-2 flex-wrap">
                            <Button variant="outline" size="sm" onClick={expandAll}>Expandir</Button>
                            <Button variant="outline" size="sm" onClick={collapseAll}>Colapsar</Button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".csv"
                                className="hidden"
                                onChange={handleFileChange}
                            />
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={importMutation.isPending}
                                className="gap-1.5"
                            >
                                {importMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                                {importMutation.isPending ? "Importando..." : "Importar CSV"}
                            </Button>
                            <Button
                                size="sm"
                                onClick={() => setPublishOpen(true)}
                                className="gap-1.5 bg-orange-500 hover:bg-orange-600 text-white"
                            >
                                <Plus className="h-3.5 w-3.5" />
                                Publicar productos
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                    <Package className="h-4 w-4" />
                    {catalog.length} producto{catalog.length !== 1 ? "s" : ""}
                </span>
                <span className="flex items-center gap-1">
                    <Palette className="h-4 w-4" />
                    {data?.totalProducts || 0} SKUs totales
                </span>
            </div>

            {isLoading && (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-muted-foreground">Cargando catálogo...</span>
                </div>
            )}

            {!isLoading && catalog.map(product => {
                const colorKeys = Object.keys(product.colors)
                    .sort((a, b) => product.colors[b].length - product.colors[a].length);
                const isExpanded = expandedProducts.has(product.genericName);
                const activeColor = selectedColors.get(product.genericName);
                const activeFormats = activeColor ? product.colors[activeColor] : null;

                return (
                    <Card key={product.genericName} className="overflow-hidden">
                        {/* Product header */}
                        <div
                            className="flex items-start gap-3 p-3 sm:p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                            onClick={() => toggleProduct(product.genericName)}
                        >
                            {/* Editable Position number */}
                            <div onClick={(e) => e.stopPropagation()}>
                                {editingPosition === product.genericName ? (
                                    <input
                                        type="number"
                                        min={1}
                                        max={catalog.length}
                                        value={editingPositionValue}
                                        onChange={e => setEditingPositionValue(e.target.value)}
                                        onBlur={() => {
                                            const num = parseInt(editingPositionValue);
                                            if (num && num >= 1 && num <= catalog.length && num !== catalog.indexOf(product) + 1) {
                                                setPositionMutation.mutate({ productName: product.genericName, newPosition: num });
                                            } else {
                                                setEditingPosition(null);
                                            }
                                        }}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') {
                                                const num = parseInt(editingPositionValue);
                                                if (num && num >= 1 && num <= catalog.length) {
                                                    setPositionMutation.mutate({ productName: product.genericName, newPosition: num });
                                                } else {
                                                    setEditingPosition(null);
                                                }
                                            }
                                            if (e.key === 'Escape') setEditingPosition(null);
                                        }}
                                        className="w-9 h-7 text-center text-xs font-bold rounded-full border-2 border-orange-400 bg-orange-50 text-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-300"
                                        autoFocus
                                    />
                                ) : (
                                    <div 
                                        className="flex-shrink-0 w-7 h-7 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center text-xs font-bold border border-orange-200 cursor-pointer hover:bg-orange-200 hover:border-orange-300 transition-colors"
                                        title="Clic para cambiar posición"
                                        onClick={() => {
                                            setEditingPosition(product.genericName);
                                            setEditingPositionValue(String(catalog.indexOf(product) + 1));
                                        }}
                                    >
                                        {setPositionMutation.isPending && editingPosition === product.genericName
                                            ? '...'
                                            : catalog.indexOf(product) + 1}
                                    </div>
                                )}
                            </div>
                            {isExpanded ? (
                                <ChevronDown className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                            ) : (
                                <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                            )}
                            {/* Product thumbnail */}
                            <div
                                className="w-10 h-10 rounded-lg overflow-hidden border bg-white flex-shrink-0 cursor-pointer hover:ring-2 hover:ring-orange-300 transition-all"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setImagePickerProduct(product);
                                    setImagePickerOpen(true);
                                }}
                                title="Clic para cambiar imagen destacada"
                            >
                                {getProductImage(product) ? (
                                    <img src={getProductImage(product)!} alt={product.genericName} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-gray-50">
                                        <ImageIcon className="h-4 w-4 text-gray-300" />
                                    </div>
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                {editingName === product.genericName ? (
                                    <input
                                        type="text"
                                        value={editingNameValue}
                                        onChange={e => setEditingNameValue(e.target.value)}
                                        onClick={e => e.stopPropagation()}
                                        onBlur={() => commitRename(product.genericName)}
                                        onKeyDown={e => {
                                            e.stopPropagation();
                                            if (e.key === 'Enter') {
                                                commitRename(product.genericName);
                                            } else if (e.key === 'Escape') {
                                                setEditingName(null);
                                            }
                                        }}
                                        disabled={renameMutation.isPending}
                                        autoFocus
                                        className="font-semibold text-lg w-full bg-white border-2 border-orange-400 rounded px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-orange-300 uppercase"
                                    />
                                ) : (
                                    <h3
                                        className="font-semibold text-base sm:text-lg leading-tight break-words cursor-pointer hover:text-orange-600 transition-colors inline-block"
                                        title="Clic para renombrar la agrupación"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setEditingName(product.genericName);
                                            setEditingNameValue(product.genericName);
                                        }}
                                    >
                                        {product.genericName}
                                    </h3>
                                )}
                                {product.breveResena && (
                                    <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">{product.breveResena}</p>
                                )}
                                <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                    <span className="text-sm text-muted-foreground">
                                        {colorKeys.length} color{colorKeys.length !== 1 ? "es" : ""} disponible{colorKeys.length !== 1 ? "s" : ""}
                                    </span>
                                    {product.groupName && (
                                        <Badge variant="outline" className="text-xs">
                                            {product.groupName}
                                        </Badge>
                                    )}
                                    {(product.tags || []).map((tag: string) => {
                                        const tagDef = dynamicTags.find(t => t.name === tag);
                                        const bgClass = tagDef ? TAG_BADGE_BG[tagDef.color] || 'bg-gray-100 text-gray-700' : 'bg-gray-100 text-gray-700';
                                        return (
                                            <Badge key={tag} className={`text-[10px] font-bold border ${bgClass}`}>
                                                {tag}
                                            </Badge>
                                        );
                                    })}
                                </div>
                            </div>
                            <div onClick={(e) => e.stopPropagation()} className="flex-shrink-0">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                            title="Acciones de la agrupación"
                                        >
                                            <MoreVertical className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-48">
                                        <DropdownMenuItem
                                            onSelect={(e) => {
                                                e.preventDefault();
                                                setEditingName(product.genericName);
                                                setEditingNameValue(product.genericName);
                                            }}
                                        >
                                            <Pencil className="h-4 w-4 mr-2" />
                                            Renombrar
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                            className="text-red-600 focus:text-red-700 focus:bg-red-50"
                                            onSelect={(e) => {
                                                e.preventDefault();
                                                setDeleteTarget(product);
                                            }}
                                        >
                                            <Trash2 className="h-4 w-4 mr-2" />
                                            Eliminar agrupación
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </div>

                        {/* Colors section */}
                        {isExpanded && (
                            <div className="border-t">
                                {/* Tag toggles — Dynamic */}
                                <div className="px-3 py-2 bg-muted/20 border-b flex items-center gap-2 flex-wrap">
                                    <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                                    <span className="text-xs font-medium text-muted-foreground mr-1">Etiquetas:</span>
                                    {dynamicTags.map((tagObj) => {
                                        const isActive = (product.tags || []).includes(tagObj.name);
                                        const styles = TAG_COLOR_MAP[tagObj.color] || { active: 'bg-gray-500 text-white', inactive: 'bg-white text-gray-600 border-dashed border-gray-300' };
                                        return (
                                            <button
                                                key={tagObj.name}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    tagMutation.mutate({
                                                        productFamily: product.genericName,
                                                        tag: tagObj.name,
                                                        action: isActive ? 'remove' : 'add',
                                                    });
                                                }}
                                                disabled={tagMutation.isPending}
                                                className={`text-[11px] px-2.5 py-1 rounded-full border font-semibold transition-all duration-200 ${isActive ? styles.active : styles.inactive}`}
                                            >
                                                {isActive ? '✓ ' : '+ '}{tagObj.name}
                                            </button>
                                        );
                                    })}
                                </div>
                                {/* Color pills */}
                                <div className="p-3 bg-muted/10">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Palette className="h-4 w-4 text-muted-foreground" />
                                        <span className="text-sm font-medium text-muted-foreground">Colores y formatos disponibles:</span>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="ml-auto h-7 gap-1 text-xs border-orange-300 text-orange-700 hover:bg-orange-50"
                                            onClick={(e) => { e.stopPropagation(); openAddSkuDialog(product); }}
                                        >
                                            <Plus className="h-3.5 w-3.5" />
                                            Agregar SKU
                                        </Button>
                                    </div>
                                    <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-x-3 gap-y-1">
                                        {colorKeys.map(color => {
                                            const isActive = activeColor === color;
                                            const variants = product.colors[color];
                                            return (
                                                <div
                                                    key={color}
                                                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md border cursor-pointer transition-all ${isActive
                                                        ? "border-orange-500 bg-orange-50 dark:bg-orange-950/30 shadow-sm"
                                                        : "border-transparent hover:border-orange-300 hover:bg-muted/40"
                                                        }`}
                                                    onClick={() => selectColor(product.genericName, color)}
                                                >
                                                    <span
                                                        className={`font-semibold text-xs w-32 shrink-0 truncate ${isActive ? "text-orange-700 dark:text-orange-400" : ""}`}
                                                        title={color}
                                                    >
                                                        {color}
                                                    </span>
                                                    <div className="flex flex-wrap gap-1 justify-end ml-auto">
                                                        {variants.map((v, i) => (
                                                            <span
                                                                key={i}
                                                                className={`inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded border ${isActive ? "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900 dark:text-orange-200" : "bg-muted/60 border-border text-muted-foreground"}`}
                                                            >
                                                                {v.format}
                                                                <span className={`font-bold ${v.stock > 0 ? "text-emerald-600" : "text-red-500"}`}>
                                                                    ({Math.round(v.stock)})
                                                                </span>
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Format cards for selected color */}
                                {activeColor && activeFormats && (
                                    <div className="p-3 border-t bg-muted/5">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Box className="h-4 w-4 text-muted-foreground" />
                                            <span className="text-sm font-medium text-muted-foreground">
                                                Envases disponibles para {activeColor}:
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
                                            {activeFormats.map((variant) => (
                                                <Card key={variant.sku} className="overflow-hidden hover:shadow-md transition-shadow">
                                                    <div className="p-4">
                                                        <div className="flex items-center justify-between mb-2">
                                                            <Badge className="bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100">
                                                                <Box className="h-3 w-3 mr-1" />
                                                                {variant.format}
                                                            </Badge>
                                                        </div>
                                                        <p className="font-mono text-xs text-muted-foreground mb-2">
                                                            SKU: {variant.sku}
                                                        </p>

                                                        {/* Dimensions */}
                                                        {variant.dimensions.weight && (
                                                            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                                                                <Weight className="h-3 w-3" />
                                                                {variant.dimensions.weight} {variant.dimensions.weightUnit || "kg"}
                                                            </div>
                                                        )}
                                                        {variant.dimensions.length && (
                                                            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                                                                <Ruler className="h-3 w-3" />
                                                                {variant.dimensions.length}×{variant.dimensions.width}×{variant.dimensions.height} {variant.dimensions.lengthUnit || "cm"}
                                                            </div>
                                                        )}

                                                        {/* Packaging */}
                                                        <div className="mt-2">
                                                            <PackagingInfo p={variant.packaging} />
                                                        </div>

                                                        {variant.description && (
                                                            <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                                                                {variant.description}
                                                            </p>
                                                        )}
                                                    </div>
                                                </Card>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </Card>
                );
            })}

            {!isLoading && catalog.length === 0 && (
                <Card>
                    <CardContent className="py-12 text-center">
                        <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <h3 className="text-lg font-medium">No hay productos</h3>
                        <p className="text-muted-foreground text-sm mt-1">
                            Importa el catálogo CSV para ver los productos organizados.
                        </p>
                    </CardContent>
                </Card>
            )}

            {/* Image Picker Dialog */}
            <Dialog open={imagePickerOpen} onOpenChange={setImagePickerOpen}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-lg">
                            <ImageIcon className="h-5 w-5 text-orange-500" />
                            Imagen Destacada
                        </DialogTitle>
                        <DialogDescription>
                            {imagePickerProduct?.genericName} — Selecciona la imagen que aparecerá en la tienda
                        </DialogDescription>
                    </DialogHeader>

                    {imagePickerProduct && (() => {
                        const availableImages = getAvailableImages(imagePickerProduct);
                        const currentCustom = savedGroupImages[imagePickerProduct.genericName];
                        const autoImage = getProductImage(imagePickerProduct);

        return (
            <div className="space-y-4 pt-2">
                {/* Current Image */}
                <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/30 border border-muted">
                    <div className="w-20 h-20 rounded-lg overflow-hidden bg-white border flex items-center justify-center flex-shrink-0">
                        {autoImage ? (
                            <img src={currentCustom || autoImage} alt="Actual" className="w-full h-full object-cover" />
                        ) : (
                            <ImageIcon className="h-8 w-8 text-muted-foreground/30" />
                        )}
                    </div>
                    <div className="flex-1">
                        <h4 className="text-sm font-bold">Imagen Actual</h4>
                        <p className="text-xs text-muted-foreground mt-0.5 mb-3">
                            {currentCustom ? (
                                <span className="text-emerald-600 font-semibold">📷 Imagen personalizada</span>
                            ) : (
                                <span className="text-blue-600 font-semibold">🤖 Selección automática</span>
                            )}
                        </p>
                        <div className="flex items-center gap-2">
                            <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                ref={customImageRef}
                                onChange={handleCustomImageUpload}
                            />
                            <Button
                                size="sm"
                                variant="outline"
                                className="h-8 text-xs bg-white text-gray-700 hover:bg-gray-50 hover:text-orange-600 border-gray-200"
                                onClick={() => customImageRef.current?.click()}
                                disabled={imageSaving || isUploadingCustom}
                            >
                                {isUploadingCustom ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin"/> : <Upload className="h-3.5 w-3.5 mr-1.5" />}
                                Subir imagen personalizada
                            </Button>
                            
                            {currentCustom && (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 text-xs text-red-600 border-red-200 hover:bg-red-50"
                                    onClick={() => handleSaveImage(imagePickerProduct.genericName, null)}
                                    disabled={imageSaving || isUploadingCustom}
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Available Images Grid */}
                {availableImages.length > 0 ? (
                    <div>
                        <h4 className="text-sm font-bold mb-3 flex items-center gap-2">
                            <Palette className="h-4 w-4 text-orange-500" />
                            Imágenes de Variantes Disponibles
                            <Badge variant="secondary" className="text-[10px]">{availableImages.length}</Badge>
                        </h4>
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                            {availableImages.map((img) => {
                                const isSelected = currentCustom === img.url || (!currentCustom && autoImage === img.url);
                                return (
                                    <button
                                        key={img.url}
                                        onClick={() => handleSaveImage(imagePickerProduct.genericName, img.url)}
                                        disabled={imageSaving || isUploadingCustom}
                                        className={`relative rounded-xl overflow-hidden border-2 transition-all hover:shadow-lg group aspect-square ${
                                            isSelected
                                                ? 'border-emerald-500 ring-2 ring-emerald-200 shadow-md'
                                                : 'border-gray-200 dark:border-slate-700 hover:border-orange-400'
                                        }`}
                                    >
                                        <img src={img.url} alt={img.label} className="w-full h-full object-cover" />
                                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2 pt-6">
                                            <p className="text-white text-[9px] font-semibold leading-tight truncate">
                                                {img.label}
                                            </p>
                                        </div>
                                        {isSelected && (
                                            <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg">
                                                <Check className="h-3 w-3 text-white" />
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-xl">
                        <ImageIcon className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">No hay imágenes de variantes</p>
                        <p className="text-xs text-muted-foreground mt-1">Sube una imagen personalizada usando el botón de arriba</p>
                    </div>
                )}
            </div>
        );
    })()}
</DialogContent>
            </Dialog>

            {/* ===== Add SKU to Grouping Dialog ===== */}
            <Dialog open={addSkuOpen} onOpenChange={(open) => { if (!open) { setAddSkuOpen(false); resetAddSkuForm(); } }}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Plus className="h-5 w-5 text-orange-500" />
                            Agregar SKU a {addSkuTarget?.genericName}
                        </DialogTitle>
                        <DialogDescription>
                            Asocia un SKU existente del catálogo SAP a esta agrupación comercial.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 pt-2">
                        {/* SKU search */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold">Buscar SKU *</label>
                            {selectedSku ? (
                                <div className="flex items-center justify-between p-2 border rounded-md bg-muted/30">
                                    <div className="min-w-0">
                                        <div className="font-mono text-sm font-semibold">{selectedSku.codigo}</div>
                                        <div className="text-xs text-muted-foreground truncate">{selectedSku.producto}</div>
                                    </div>
                                    <Button size="sm" variant="ghost" onClick={() => { setSelectedSku(null); setSkuQuery(""); }}>
                                        Cambiar
                                    </Button>
                                </div>
                            ) : (
                                <>
                                    <div className="relative">
                                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            placeholder="Código o nombre (mín. 2 caracteres)"
                                            value={skuQuery}
                                            onChange={(e) => setSkuQuery(e.target.value)}
                                            className="pl-9 h-9"
                                            autoFocus
                                        />
                                    </div>
                                    {skuQuery.length >= 2 && skuSearchResults.length > 0 && (
                                        <div className="max-h-48 overflow-y-auto border rounded-md divide-y">
                                            {skuSearchResults.map((item: any) => (
                                                <button
                                                    key={item.id}
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedSku({
                                                            codigo: item.codigo,
                                                            producto: item.producto,
                                                            unidad: item.unidad || null,
                                                            lista: item.lista ? String(item.lista) : null,
                                                        });
                                                        if (item.lista && !addPrice) setAddPrice(String(item.lista));
                                                        if (item.unidad && !addFormat) setAddFormat(item.unidad);
                                                    }}
                                                    className="w-full text-left px-3 py-2 hover:bg-muted/50 text-sm"
                                                >
                                                    <div className="font-mono text-xs font-semibold text-orange-700">{item.codigo}</div>
                                                    <div className="text-xs text-muted-foreground truncate">{item.producto}</div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    {skuQuery.length >= 2 && skuSearchResults.length === 0 && (
                                        <p className="text-xs text-muted-foreground">Sin resultados.</p>
                                    )}
                                </>
                            )}
                        </div>

                        {/* Existing grouping warning */}
                        {existingForSelectedSku && existingForSelectedSku.genericName !== addSkuTarget?.genericName && (
                            <div className="flex items-start gap-2 p-3 rounded-md border border-amber-300 bg-amber-50 text-amber-800">
                                <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                                <div className="text-xs">
                                    Este SKU ya está en la agrupación <strong>{existingForSelectedSku.genericName}</strong> ({existingForSelectedSku.color} / {existingForSelectedSku.format}). Si continuás, se moverá a <strong>{addSkuTarget?.genericName}</strong>.
                                </div>
                            </div>
                        )}
                        {existingForSelectedSku && existingForSelectedSku.genericName === addSkuTarget?.genericName && (
                            <div className="flex items-start gap-2 p-3 rounded-md border border-blue-300 bg-blue-50 text-blue-800">
                                <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                                <div className="text-xs">
                                    Este SKU ya está en esta agrupación como <strong>{existingForSelectedSku.color}</strong> / <strong>{existingForSelectedSku.format}</strong>. Guardar lo actualizará.
                                </div>
                            </div>
                        )}

                        {/* Color */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold">Color *</label>
                            <Input
                                list="add-sku-colors"
                                placeholder="Ej: CAOBA, GRIS NOCHE, CASTAÑO"
                                value={addColor}
                                onChange={(e) => setAddColor(e.target.value)}
                                className="h-9"
                            />
                            <datalist id="add-sku-colors">
                                {(addSkuTarget?.colors || []).map(c => <option key={c} value={c} />)}
                            </datalist>
                            {(addSkuTarget?.colors.length ?? 0) > 0 && (
                                <p className="text-[11px] text-muted-foreground">
                                    Existentes: {addSkuTarget?.colors.join(", ")}
                                </p>
                            )}
                        </div>

                        {/* Format */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold">Formato *</label>
                            <Input
                                list="add-sku-formats"
                                placeholder="Ej: Balde 4 Galones, Galón"
                                value={addFormat}
                                onChange={(e) => setAddFormat(e.target.value)}
                                className="h-9"
                            />
                            <datalist id="add-sku-formats">
                                {(addSkuTarget?.formats || []).map(f => <option key={f} value={f} />)}
                            </datalist>
                        </div>

                        {/* Price */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold">Precio (opcional)</label>
                            <Input
                                type="number"
                                min={0}
                                placeholder="Dejalo vacío para conservar el precio actual"
                                value={addPrice}
                                onChange={(e) => setAddPrice(e.target.value)}
                                className="h-9 text-right font-mono"
                            />
                            <p className="text-[11px] text-muted-foreground">
                                Si lo dejás vacío, no se modifica el precio guardado del SKU.
                            </p>
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                            <Button variant="outline" onClick={() => { setAddSkuOpen(false); resetAddSkuForm(); }}>
                                Cancelar
                            </Button>
                            <Button
                                className="bg-orange-500 hover:bg-orange-600 text-white gap-1.5"
                                disabled={!selectedSku || !addColor.trim() || !addFormat.trim() || addSkuMutation.isPending}
                                onClick={submitAddSku}
                            >
                                {addSkuMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                                {addSkuMutation.isPending ? "Guardando..." : "Agregar a la agrupación"}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* ===== Publish New Products Dialog ===== */}
            <Dialog open={publishOpen} onOpenChange={setPublishOpen}>
                <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Plus className="h-5 w-5 text-orange-500" />
                            Publicar productos nuevos
                        </DialogTitle>
                        <DialogDescription>
                            Productos del catálogo SAP que todavía no están en ninguna agrupación comercial. Asigná nombre, color y formato para publicarlos en la tienda.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3 pt-2">
                        <div className="relative">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar por código o nombre..."
                                value={publishSearch}
                                onChange={(e) => setPublishSearch(e.target.value)}
                                className="pl-9 h-9"
                            />
                        </div>

                        <datalist id="publish-generic-names">
                            {catalog.map(p => <option key={p.genericName} value={p.genericName} />)}
                        </datalist>
                        <datalist id="publish-colors">
                            {Array.from(new Set(catalog.flatMap(p => Object.keys(p.colors)))).map(c => <option key={c} value={c} />)}
                        </datalist>

                        {unpublishedLoading && (
                            <div className="flex items-center justify-center py-10">
                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                <span className="ml-2 text-sm text-muted-foreground">Cargando catálogo SAP...</span>
                            </div>
                        )}

                        {!unpublishedLoading && unpublished.length === 0 && (
                            <div className="text-center py-10 border-2 border-dashed border-gray-200 rounded-xl">
                                <Check className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
                                <p className="text-sm text-muted-foreground">
                                    {debouncedPublishSearch
                                        ? "Sin resultados para la búsqueda."
                                        : "No hay productos sin publicar. Todo el catálogo SAP está en una agrupación."}
                                </p>
                            </div>
                        )}

                        {!unpublishedLoading && unpublished.map((item) => {
                            const form = publishForms[item.codigo] || defaultPublishForm(item);
                            const isPublishing = publishingSku === item.codigo;
                            return (
                                <div key={item.codigo} className="border rounded-lg p-3 space-y-2">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="font-mono text-xs font-semibold text-orange-700">{item.codigo}</div>
                                            <div className="text-sm truncate">{item.producto}</div>
                                            <div className="text-xs text-muted-foreground">
                                                {item.unidad || "Sin unidad"}{item.lista ? ` · $${item.lista}` : ""}
                                            </div>
                                        </div>
                                        <Button
                                            size="sm"
                                            className="bg-orange-500 hover:bg-orange-600 text-white gap-1.5 flex-shrink-0"
                                            disabled={isPublishing}
                                            onClick={() => submitPublish(item)}
                                        >
                                            {isPublishing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                                            {isPublishing ? "Publicando..." : "Publicar"}
                                        </Button>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                        <div className="space-y-1">
                                            <label className="text-[11px] font-semibold text-muted-foreground">Agrupación *</label>
                                            <Input
                                                list="publish-generic-names"
                                                value={form.genericName}
                                                onChange={(e) => updatePublishForm(item.codigo, { genericName: e.target.value })}
                                                className="h-8 text-sm"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[11px] font-semibold text-muted-foreground">Color *</label>
                                            <Input
                                                list="publish-colors"
                                                value={form.color}
                                                onChange={(e) => updatePublishForm(item.codigo, { color: e.target.value })}
                                                className="h-8 text-sm"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[11px] font-semibold text-muted-foreground">Formato *</label>
                                            <Input
                                                value={form.format}
                                                onChange={(e) => updatePublishForm(item.codigo, { format: e.target.value })}
                                                className="h-8 text-sm"
                                                placeholder="Ej: Galón"
                                            />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Delete agrupación confirmation */}
            <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-red-600">
                            <AlertTriangle className="h-5 w-5" />
                            Eliminar agrupación
                        </DialogTitle>
                        <DialogDescription className="pt-2">
                            ¿Seguro que querés eliminar la agrupación <strong>{deleteTarget?.genericName}</strong>?
                        </DialogDescription>
                    </DialogHeader>
                    {deleteTarget && (
                        <div className="text-sm text-muted-foreground space-y-2">
                            <p>
                                Se despublicarán {Object.values(deleteTarget.colors).reduce((acc, vs) => acc + vs.length, 0)} SKU(s)
                                en {Object.keys(deleteTarget.colors).length} color(es). Los productos quedarán fuera del e-commerce
                                pero seguirán disponibles en el catálogo SAP y podrás volver a publicarlos desde "Publicar productos".
                            </p>
                        </div>
                    )}
                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleteFamilyMutation.isPending}>
                            Cancelar
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={() => deleteTarget && deleteFamilyMutation.mutate(deleteTarget.genericName)}
                            disabled={deleteFamilyMutation.isPending}
                            className="gap-1.5"
                        >
                            {deleteFamilyMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                            {deleteFamilyMutation.isPending ? "Eliminando..." : "Eliminar"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
