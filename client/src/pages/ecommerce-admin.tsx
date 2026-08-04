import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import TrackingConfigSection from "@/components/ecommerce/tracking-config-section";
import MailingSection from "@/components/ecommerce/mailing-section";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ShoppingCart, Search, Building2, Edit, Tag, Eye, EyeOff, Play, Pause, List, Grip, Link as LinkIcon, RefreshCw, Smartphone, Globe, PenTool, LayoutTemplate, Palette, MessageCircle, AlertTriangle, MonitorSmartphone, Plus, Upload, FileArchive, CheckCircle, AlertCircle, ExternalLink, CloudUpload, Package, Image, Clock, XCircle, Layers, Users, Phone, Mail, Check, X, Loader2, User, ChevronDown, ChevronRight, Truck, Save, Layout, MapPin, HelpCircle, FileText, ArrowUp, ArrowDown } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

interface ProductoEcommerce {
  id: string;
  codigo: string;
  producto: string;
  unidad?: string;
  precio: number;
  precioOriginal?: number;
  categoria?: string;
  descripcion?: string;
  activo: boolean;
  imagenUrl?: string;
  stock?: number;
  groupId?: string | null;
  variantLabel?: string | null;
  isMainVariant?: boolean;
  productFamily?: string | null;
  color?: string | null;
  variantParentSku?: string | null;
  variantGenericDisplayName?: string | null;
  variantIndex?: number;
}

interface ProductGroup {
  parentSku: string;
  displayName: string;
  products: ProductoEcommerce[];
  mainProduct: ProductoEcommerce;
}

interface CategoriaEcommerce {
  id: string;
  nombre: string;
  descripcion?: string;
  activa: boolean;
  productoCount: number;
}


interface SalespersonUser {
  id: string;
  salespersonName: string;
  email?: string | null;
  role: string;
  isActive: boolean;
  publicSlug?: string | null;
  profileImageUrl?: string | null;
  publicPhone?: string | null;
  publicEmail?: string | null;
  bio?: string | null;
  catalogEnabled?: boolean;
}

const catalogFormSchema = z.object({
  publicSlug: z.string()
    .regex(/^[a-z0-9-]+$/, "Slug debe contener solo letras minúsculas, números y guiones")
    .min(3, "Mínimo 3 caracteres")
    .max(50, "Máximo 50 caracteres"),
  publicEmail: z.string().email("Email inválido").or(z.literal("")).optional(),
  publicPhone: z.string().optional(),
  bio: z.string().max(500, "Máximo 500 caracteres").optional(),
  catalogEnabled: z.boolean(),
});

type CatalogFormData = z.infer<typeof catalogFormSchema>;

// Shipping Rates Configuration Component
function ShippingRatesSection() {
  const { toast } = useToast();
  const [rates, setRates] = useState<Record<string, number>>({
    '1_4_galon': 0,
    'galon': 0,
    'bd_4gl': 0,
    'bd_5gl': 0,
  });
  const [skus, setSkus] = useState<Record<string, string>>({
    '1_4_galon': '',
    'galon': '',
    'bd_4gl': '',
    'bd_5gl': '',
  });
  const [isSaving, setIsSaving] = useState(false);

  const { data: savedRates, isLoading } = useQuery<Record<string, any>>({
    queryKey: ['/api/ecommerce/shipping-rates'],
    queryFn: async () => {
      const res = await fetch('/api/ecommerce/shipping-rates', { credentials: 'include' });
      if (!res.ok) return {};
      return res.json();
    },
  });

  // Update local state when data loads
  React.useEffect(() => {
    if (savedRates) {
      // Rates can be either { key: number } or { key: { price: number, sku: string } }
      const newRates: Record<string, number> = {};
      const newSkus: Record<string, string> = {};
      for (const key of Object.keys(rates)) {
        const val = savedRates[key];
        if (typeof val === 'object' && val !== null) {
          newRates[key] = val.price || 0;
          newSkus[key] = val.sku || '';
        } else {
          newRates[key] = Number(val) || 0;
          newSkus[key] = savedRates[`${key}_sku`] || '';
        }
      }
      setRates(prev => ({ ...prev, ...newRates }));
      setSkus(prev => ({ ...prev, ...newSkus }));
    }
  }, [savedRates]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Save as structured object with price + sku
      const payload: Record<string, any> = {};
      for (const key of Object.keys(rates)) {
        payload[key] = { price: rates[key], sku: skus[key] || '' };
      }
      const res = await fetch('/api/ecommerce/shipping-rates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Error al guardar');
      queryClient.invalidateQueries({ queryKey: ['/api/ecommerce/shipping-rates'] });
      toast({ title: 'Tarifas guardadas', description: 'Las tarifas de despacho se han actualizado correctamente.' });
    } catch {
      toast({ title: 'Error', description: 'No se pudieron guardar las tarifas.', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const formatLabels: Record<string, { label: string; desc: string }> = {
    '1_4_galon': { label: '1/4 Galón', desc: 'Precio flete por unidad' },
    'galon': { label: 'Galón', desc: 'Precio flete por unidad' },
    'bd_4gl': { label: 'Balde 4 Galones', desc: 'Precio flete por unidad' },
    'bd_5gl': { label: 'Balde 5 Galones', desc: 'Precio flete por unidad' },
  };

  return (
    <Card className="border-border/40 shadow-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
              <Truck className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <CardTitle className="text-lg">Tarifas de Despacho</CardTitle>
              <p className="text-sm text-muted-foreground">Define el costo de flete por tipo de envase y su SKU de despacho</p>
            </div>
          </div>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-foreground text-background hover:bg-foreground/90 gap-2"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Guardar tarifas
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-6 text-muted-foreground text-sm">Cargando tarifas...</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Object.entries(formatLabels).map(([key, { label, desc }]) => (
              <div key={key} className="border rounded-xl p-4 bg-muted/20 space-y-3">
                <div>
                  <Label className="font-semibold text-sm">{label}</Label>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-muted-foreground">$</span>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={rates[key] || ''}
                    onChange={(e) => setRates(prev => ({
                      ...prev,
                      [key]: parseFloat(e.target.value) || 0,
                    }))}
                    placeholder="0"
                    className="h-9"
                  />
                  <span className="text-xs text-muted-foreground whitespace-nowrap">/ unidad</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">SKU</span>
                  <Input
                    type="text"
                    value={skus[key] || ''}
                    onChange={(e) => setSkus(prev => ({
                      ...prev,
                      [key]: e.target.value,
                    }))}
                    placeholder="Código producto despacho"
                    className="h-9 text-xs font-mono"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Topbar Configuration Component
interface TopbarConfigData {
  phone: { value: string; visible: boolean };
  email: { value: string; visible: boolean };
  address: { value: string; visible: boolean };
  faq: { visible: boolean };
  freeShipping: { threshold: number; visible: boolean };
  customText: { value: string; visible: boolean };
}

function TopbarConfigSection() {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [config, setConfig] = useState<TopbarConfigData>({
    phone: { value: '+56 2 2345 6789', visible: true },
    email: { value: 'contacto@panoramica.cl', visible: true },
    address: { value: 'Santiago, Chile', visible: true },
    faq: { visible: true },
    freeShipping: { threshold: 250000, visible: true },
    customText: { value: '', visible: false },
  });

  const { data: savedConfig, isLoading } = useQuery<TopbarConfigData>({
    queryKey: ['/api/ecommerce/topbar-config'],
    queryFn: async () => {
      const res = await fetch('/api/ecommerce/topbar-config', { credentials: 'include' });
      if (!res.ok) return config;
      return res.json();
    },
  });

  React.useEffect(() => {
    if (savedConfig) {
      setConfig(prev => ({
        phone: { ...prev.phone, ...savedConfig.phone },
        email: { ...prev.email, ...savedConfig.email },
        address: { ...prev.address, ...savedConfig.address },
        faq: { ...prev.faq, ...savedConfig.faq },
        freeShipping: { ...prev.freeShipping, ...savedConfig.freeShipping },
        customText: { ...prev.customText, ...(savedConfig as any).customText },
      }));
    }
  }, [savedConfig]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/ecommerce/topbar-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(config),
      });
      if (!res.ok) throw new Error('Error al guardar');
      queryClient.invalidateQueries({ queryKey: ['/api/ecommerce/topbar-config'] });
      queryClient.invalidateQueries({ queryKey: ['/api/ecommerce/free-shipping-threshold'] });
      toast({ title: 'Topbar actualizado', description: 'La configuración del topbar se guardó correctamente.' });
    } catch {
      toast({ title: 'Error', description: 'No se pudo guardar la configuración del topbar.', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const topbarItems = [
    {
      key: 'phone' as const,
      label: 'Teléfono',
      description: 'Número de contacto visible en el topbar',
      icon: Phone,
      hasValue: true,
      placeholder: '+56 2 2345 6789',
    },
    {
      key: 'email' as const,
      label: 'Correo Electrónico',
      description: 'Email de contacto visible en el topbar',
      icon: Mail,
      hasValue: true,
      placeholder: 'contacto@empresa.cl',
    },
    {
      key: 'address' as const,
      label: 'Dirección',
      description: 'Ubicación visible en el topbar',
      icon: MapPin,
      hasValue: true,
      placeholder: 'Santiago, Chile',
    },
    {
      key: 'faq' as const,
      label: 'Preguntas Frecuentes',
      description: 'Botón de FAQ en el topbar',
      icon: HelpCircle,
      hasValue: false,
      placeholder: '',
    },
  ];

  return (
    <Card className="border-border/40 shadow-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
              <Layout className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <CardTitle className="text-lg">Configuración del Topbar</CardTitle>
              <p className="text-sm text-muted-foreground">Edita los datos y controla qué elementos se muestran en la barra superior de la tienda</p>
            </div>
          </div>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-foreground text-background hover:bg-foreground/90 gap-2"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Guardar configuración
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-6 text-muted-foreground text-sm">Cargando configuración...</div>
        ) : (
          <div className="space-y-3">
            {/* Preview */}
            <div className="rounded-xl border bg-white dark:bg-slate-900 p-3 mb-4">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Vista previa del Topbar</p>
              <div className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-gray-50 dark:bg-slate-800 text-[11px] text-gray-500">
                <div className="flex items-center gap-4">
                  {config.phone.visible && (
                    <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{config.phone.value}</span>
                  )}
                  {config.email.visible && (
                    <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{config.email.value}</span>
                  )}
                  {config.address.visible && (
                    <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{config.address.value}</span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {config.faq.visible && (
                    <span className="flex items-center gap-1 font-medium"><HelpCircle className="h-3 w-3" />Preguntas Frecuentes</span>
                  )}
                  {config.freeShipping.visible && config.freeShipping.threshold > 0 && (
                    <span className="text-[#FF6E23] font-semibold flex items-center gap-1">
                      <Truck className="h-3 w-3" />
                      Envío gratis sobre ${config.freeShipping.threshold.toLocaleString('es-CL')}
                    </span>
                  )}
                  {config.customText.visible && config.customText.value && (
                    <span className="text-[#FF6E23] font-semibold">
                      {config.customText.value}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Editable items */}
            {topbarItems.map(item => {
              const Icon = item.icon;
              const itemConfig = config[item.key];
              const isVisible = itemConfig.visible;
              return (
                <div
                  key={item.key}
                  className={`border rounded-xl p-4 transition-all ${
                    isVisible ? 'bg-card border-border/40' : 'bg-muted/10 border-dashed border-border/20 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      isVisible ? 'bg-muted' : 'bg-muted/50'
                    }`}>
                      <Icon className={`h-4 w-4 ${isVisible ? 'text-foreground' : 'text-muted-foreground'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-semibold">{item.label}</span>
                        <Badge variant={isVisible ? 'default' : 'secondary'} className={`text-[9px] px-1.5 py-0 h-4 ${
                          isVisible ? 'bg-muted text-foreground' : ''
                        }`}>
                          {isVisible ? 'Visible' : 'Oculto'}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{item.description}</p>
                    </div>
                    {item.hasValue && (
                      <Input
                        value={'value' in itemConfig ? (itemConfig as any).value : ''}
                        onChange={(e) => setConfig(prev => ({
                          ...prev,
                          [item.key]: { ...prev[item.key], value: e.target.value }
                        }))}
                        placeholder={item.placeholder}
                        className="w-56 h-9 text-sm"
                        disabled={!isVisible}
                      />
                    )}
                    <Switch
                      checked={isVisible}
                      onCheckedChange={(checked) => setConfig(prev => ({
                        ...prev,
                        [item.key]: { ...prev[item.key], visible: checked }
                      }))}
                    />
                  </div>
                </div>
              );
            })}

            {/* Free Shipping — special item with numeric input */}
            <div
              className={`border rounded-xl p-4 transition-all ${
                config.freeShipping.visible ? 'bg-white dark:bg-slate-900 border-gray-200' : 'bg-muted/30 border-dashed border-gray-200 opacity-60'
              }`}
            >
              <div className="flex items-center gap-4">
                <div className={`h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  config.freeShipping.visible ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-gray-100 dark:bg-gray-800'
                }`}>
                  <Truck className={`h-4 w-4 ${config.freeShipping.visible ? 'text-emerald-600' : 'text-gray-400'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-semibold">Envío Gratis</span>
                    <Badge variant={config.freeShipping.visible ? 'default' : 'secondary'} className={`text-[9px] px-1.5 py-0 h-4 ${
                      config.freeShipping.visible ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : ''
                    }`}>
                      {config.freeShipping.visible ? 'Visible' : 'Oculto'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">Monto mínimo para envío gratuito. Se muestra en el topbar y en el carrito.</p>
                  {config.freeShipping.threshold > 0 && config.freeShipping.visible && (
                    <p className="text-xs text-emerald-600 font-medium mt-0.5">
                      → Envío gratis sobre ${config.freeShipping.threshold.toLocaleString('es-CL')}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium text-muted-foreground">$</span>
                  <Input
                    type="number"
                    min="0"
                    step="1000"
                    value={config.freeShipping.threshold || ''}
                    onChange={(e) => setConfig(prev => ({
                      ...prev,
                      freeShipping: { ...prev.freeShipping, threshold: parseFloat(e.target.value) || 0 }
                    }))}
                    placeholder="250000"
                    className="w-36 h-9 text-sm text-right font-mono"
                    disabled={!config.freeShipping.visible}
                  />
                </div>
                <Switch
                  checked={config.freeShipping.visible}
                  onCheckedChange={(checked) => setConfig(prev => ({
                    ...prev,
                    freeShipping: { ...prev.freeShipping, visible: checked }
                  }))}
                />
              </div>
            </div>

            {/* Custom Text Field */}
            <div
              className={`border rounded-xl p-4 transition-all ${
                config.customText.visible ? 'bg-white dark:bg-slate-900 border-gray-200' : 'bg-muted/30 border-dashed border-gray-200 opacity-60'
              }`}
            >
              <div className="flex items-center gap-4">
                <div className={`h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  config.customText.visible ? 'bg-orange-100 dark:bg-orange-900/30' : 'bg-gray-100 dark:bg-gray-800'
                }`}>
                  <FileText className={`h-4 w-4 ${config.customText.visible ? 'text-orange-600' : 'text-gray-400'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-semibold">Texto Personalizado</span>
                    <Badge variant={config.customText.visible ? 'default' : 'secondary'} className={`text-[9px] px-1.5 py-0 h-4 ${
                      config.customText.visible ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : ''
                    }`}>
                      {config.customText.visible ? 'Visible' : 'Oculto'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">Texto libre que aparece a la derecha del topbar. Ej: "Retiro Gratis en Bodega"</p>
                </div>
                <Input
                  value={config.customText.value}
                  onChange={(e) => setConfig(prev => ({
                    ...prev,
                    customText: { ...prev.customText, value: e.target.value }
                  }))}
                  placeholder="Retiro Gratis en Bodega"
                  className="w-56 h-9 text-sm"
                  disabled={!config.customText.visible}
                />
                <Switch
                  checked={config.customText.visible}
                  onCheckedChange={(checked) => setConfig(prev => ({
                    ...prev,
                    customText: { ...prev.customText, visible: checked }
                  }))}
                />
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Banner Form Component
function BannerForm({ onSuccess, existingBanner, type = 'hero' }: { onSuccess: () => void; existingBanner?: any; type?: string }) {
  const [titulo, setTitulo] = useState(existingBanner?.titulo || '');
  const [linkUrl, setLinkUrl] = useState(existingBanner?.linkUrl || '');
  const [orden, setOrden] = useState(existingBanner?.orden?.toString() || '0');
  const [tipoVisualizacion, setTipoVisualizacion] = useState(existingBanner?.tipoVisualizacion || type);
  const [desktopFile, setDesktopFile] = useState<File | null>(null);
  const [mobileFile, setMobileFile] = useState<File | null>(null);
  const [desktopPreview, setDesktopPreview] = useState(existingBanner?.imagenDesktop || '');
  const [mobilePreview, setMobilePreview] = useState(existingBanner?.imagenMobile || '');
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const handleDesktopChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setDesktopFile(file);
      setDesktopPreview(URL.createObjectURL(file));
    }
  };

  const handleMobileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setMobileFile(file);
      setMobilePreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async () => {
    if (!existingBanner && !desktopFile) {
      toast({ title: 'Error', description: 'Se requiere una imagen de escritorio', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('titulo', titulo || 'Banner');
      formData.append('linkUrl', linkUrl);
      formData.append('orden', orden);
      formData.append('tipoVisualizacion', tipoVisualizacion);
      if (desktopFile) formData.append('imagenDesktop', desktopFile);
      if (mobileFile) formData.append('imagenMobile', mobileFile);

      const url = existingBanner
        ? `/api/ecommerce/admin/banners/${existingBanner.id}`
        : '/api/ecommerce/admin/banners';
      const method = existingBanner ? 'PATCH' : 'POST';

      const res = await fetch(url, { method, body: formData, credentials: 'include' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || data.message || `Error ${res.status}`);
      }
      onSuccess();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <Label>Título (interno)</Label>
        <Input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ej: Promoción Verano" />
      </div>

      <div>
        <Label>Imagen Escritorio <span className="text-red-500">*</span></Label>
        <p className="text-xs text-muted-foreground mb-1">Recomendado: 1920×600px o similar</p>
        <Input type="file" accept="image/*" onChange={handleDesktopChange} />
        {desktopPreview && (
          <img src={desktopPreview} alt="Desktop preview" className="mt-2 rounded-lg border max-h-32 w-full object-cover" />
        )}
      </div>

      <div>
        <Label>Imagen Móvil (opcional)</Label>
        <p className="text-xs text-muted-foreground mb-1">Recomendado: 768×400px o similar</p>
        <Input type="file" accept="image/*" onChange={handleMobileChange} />
        {mobilePreview && (
          <img src={mobilePreview} alt="Mobile preview" className="mt-2 rounded-lg border max-h-32 w-full object-cover" />
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <Label>Ubicación del Banner</Label>
          <Select value={tipoVisualizacion} onValueChange={setTipoVisualizacion}>
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar ubicación" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="hero">Principal (Cabecera)</SelectItem>
              <SelectItem value="footer">Pie de Página (Footer)</SelectItem>
              <SelectItem value="ad">Publicitario (entre productos)</SelectItem>
              <SelectItem value="cotizador">Cotizador (Cabecera)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>URL de destino (opcional)</Label>
          <Input value={linkUrl} onChange={e => setLinkUrl(e.target.value)} placeholder="https://..." />
        </div>
        <div>
          <Label>Orden</Label>
          <Input type="number" value={orden} onChange={e => setOrden(e.target.value)} min="0" />
        </div>
      </div>

      <Button onClick={handleSubmit} disabled={saving} className="w-full bg-foreground text-background hover:bg-foreground/90">
        {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Guardando...</> : existingBanner ? 'Actualizar Banner' : 'Crear Banner'}
      </Button>
    </div>
  );
}

// Banner Settings Component
function BannerSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: config, isLoading } = useQuery<any>({
    queryKey: ['/api/ecommerce/store-config'],
  });

  const [delay, setDelay] = useState<number>(5);

  React.useEffect(() => {
    if (config?.seoSettings?.carouselDelay) {
      setDelay(config.seoSettings.carouselDelay);
    }
  }, [config]);

  const updateMutation = useMutation({
    mutationFn: async (newDelay: number) => {
      const res = await fetch('/api/ecommerce/store-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seoSettings: { ...config?.seoSettings, carouselDelay: newDelay } })
      });
      if (!res.ok) throw new Error('Error saving delay');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ecommerce/store-config'] });
      toast({ title: 'Demora actualizada' });
    }
  });

  if (isLoading) return null;

  return (
    <div className="flex items-center gap-4 bg-muted/30 p-3 rounded-lg mb-4 text-sm">
      <div className="flex items-center gap-2">
        <Clock className="w-4 h-4 text-muted-foreground" />
        <span className="font-semibold text-gray-700">Demora deslizar (seg):</span>
      </div>
      <div className="flex items-center gap-2">
        <Input 
          type="number" 
          className="w-20 h-8" 
          value={delay} 
          onChange={(e) => setDelay(parseInt(e.target.value) || 1)} 
          min="1" 
          max="30"
        />
        <Button 
          size="sm" 
          variant="secondary" 
          className="h-8"
          onClick={() => updateMutation.mutate(delay)}
          disabled={updateMutation.isPending || delay === config?.seoSettings?.carouselDelay}
        >
          {updateMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Guardar'}
        </Button>
      </div>
    </div>
  );
}

// Ad Banner Settings Component
function AdBannerSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: config, isLoading } = useQuery<any>({
    queryKey: ['/api/ecommerce/store-config'],
  });

  const [desktopFreq, setDesktopFreq] = useState<number>(6);
  const [mobileFreq, setMobileFreq] = useState<number>(4);
  const [desktopHeight, setDesktopHeight] = useState<number>(300);
  const [mobileHeight, setMobileHeight] = useState<number>(150);

  React.useEffect(() => {
    if (config?.adSettings) {
      if (config.adSettings.desktopFrequency) setDesktopFreq(config.adSettings.desktopFrequency);
      if (config.adSettings.mobileFrequency) setMobileFreq(config.adSettings.mobileFrequency);
      if (config.adSettings.desktopHeight) setDesktopHeight(config.adSettings.desktopHeight);
      if (config.adSettings.mobileHeight) setMobileHeight(config.adSettings.mobileHeight);
    }
  }, [config]);

  const updateMutation = useMutation({
    mutationFn: async ({ dFreq, mFreq, dHeight, mHeight }: { dFreq: number, mFreq: number, dHeight: number, mHeight: number }) => {
      const res = await fetch('/api/ecommerce/store-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adSettings: { ...config?.adSettings, desktopFrequency: dFreq, mobileFrequency: mFreq, desktopHeight: dHeight, mobileHeight: mHeight } })
      });
      if (!res.ok) throw new Error('Error saving ad settings');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ecommerce/store-config'] });
      toast({ title: 'Configuración actualizada', description: 'Las frecuencias y medidas de banners publicitarios se guardaron exitosamente.' });
    }
  });

  if (isLoading) return null;

  return (
    <div className="flex flex-col xl:flex-row xl:items-center gap-4 bg-muted/30 p-4 rounded-lg mb-4 text-sm">
      <div className="flex items-center gap-2">
        <MonitorSmartphone className="w-4 h-4 text-muted-foreground" />
        <span className="font-semibold text-gray-700">Ajustes Banners Publicitarios:</span>
      </div>
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500">Frec. Escritorio</span>
          <Input 
            type="number" 
            className="w-20 h-8 text-center bg-white" 
            value={desktopFreq} 
            onChange={(e) => setDesktopFreq(parseInt(e.target.value) || 1)} 
            min="1" 
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500">Altura Escritorio (px)</span>
          <Input 
            type="number" 
            className="w-24 h-8 text-center bg-white" 
            value={desktopHeight} 
            onChange={(e) => setDesktopHeight(parseInt(e.target.value) || 50)} 
            min="50" 
          />
        </div>
        <div className="w-px h-8 bg-border hidden md:block mx-2"></div>
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500">Frec. Móvil</span>
          <Input 
            type="number" 
            className="w-20 h-8 text-center bg-white" 
            value={mobileFreq} 
            onChange={(e) => setMobileFreq(parseInt(e.target.value) || 1)} 
            min="1" 
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500">Altura Móvil (px)</span>
          <Input 
            type="number" 
            className="w-24 h-8 text-center bg-white" 
            value={mobileHeight} 
            onChange={(e) => setMobileHeight(parseInt(e.target.value) || 50)} 
            min="50" 
          />
        </div>
        <Button 
          size="sm" 
          variant="secondary" 
          className="h-8 shadow-sm mt-5"
          onClick={() => updateMutation.mutate({ dFreq: desktopFreq, mFreq: mobileFreq, dHeight: desktopHeight, mHeight: mobileHeight })}
          disabled={updateMutation.isPending || (desktopFreq === (config?.adSettings?.desktopFrequency || 6) && mobileFreq === (config?.adSettings?.mobileFrequency || 4) && desktopHeight === (config?.adSettings?.desktopHeight || 300) && mobileHeight === (config?.adSettings?.mobileHeight || 150))}
        >
          {updateMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Guardar'}
        </Button>
      </div>
    </div>
  );
}

// Checkout Settings Component
function CheckoutSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: config, isLoading } = useQuery<any>({
    queryKey: ['/api/ecommerce/store-config'],
  });

  const [shippingDiscount, setShippingDiscount] = useState<number>(0);
  const [shippingMinAmount, setShippingMinAmount] = useState<number>(0);

  React.useEffect(() => {
    if (config?.checkoutSettings?.shippingDiscountPercentage !== undefined) {
      setShippingDiscount(config.checkoutSettings.shippingDiscountPercentage);
    }
    if (config?.checkoutSettings?.shippingDiscountMinAmount !== undefined) {
      setShippingMinAmount(config.checkoutSettings.shippingDiscountMinAmount);
    }
  }, [config]);

  const updateMutation = useMutation({
    mutationFn: async (payload: { discount: number; minAmount: number }) => {
      const res = await fetch('/api/ecommerce/store-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          checkoutSettings: {
            ...config?.checkoutSettings,
            shippingDiscountPercentage: payload.discount,
            shippingDiscountMinAmount: payload.minAmount,
          },
        }),
      });
      if (!res.ok) throw new Error('Error saving shipping discount');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ecommerce/store-config'] });
      toast({ title: 'Descuento de envío actualizado' });
    }
  });

  if (isLoading) return null;

  const savedDiscount = config?.checkoutSettings?.shippingDiscountPercentage || 0;
  const savedMinAmount = config?.checkoutSettings?.shippingDiscountMinAmount || 0;
  const isDirty = shippingDiscount !== savedDiscount || shippingMinAmount !== savedMinAmount;

  return (
    <div className="flex flex-col md:flex-row items-start md:items-center gap-4 bg-emerald-50/50 p-4 rounded-xl border border-emerald-100 mb-6 w-full">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
          <Truck className="w-5 h-5 text-emerald-600" />
        </div>
        <div>
          <h3 className="font-semibold text-emerald-900 text-sm">Configuración de Checkout</h3>
          <p className="text-xs text-emerald-700">
            Aplica el descuento de envío solo cuando el subtotal (neto) del carrito alcanza el monto mínimo
          </p>
        </div>
      </div>
      <div className="md:ml-auto flex items-end gap-3 bg-white p-3 rounded-lg shadow-sm w-full md:w-auto mt-2 md:mt-0">
        <div className="flex flex-col gap-1 w-full md:w-28">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-widest whitespace-nowrap">Descto. Envío (%)</span>
          <Input
            type="number"
            className="h-9 font-bold bg-gray-50 border-gray-200"
            value={shippingDiscount}
            onChange={(e) => setShippingDiscount(parseInt(e.target.value) || 0)}
            min="0"
            max="100"
          />
        </div>
        <div className="flex flex-col gap-1 w-full md:w-44">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-widest whitespace-nowrap">Monto Mín. Neto ($)</span>
          <Input
            type="number"
            className="h-9 font-bold bg-gray-50 border-gray-200"
            value={shippingMinAmount}
            onChange={(e) => setShippingMinAmount(parseInt(e.target.value) || 0)}
            min="0"
            placeholder="0 = sin mínimo"
          />
        </div>
        <Button
          size="sm"
          className="h-9 whitespace-nowrap bg-emerald-600 hover:bg-emerald-700"
          onClick={() => updateMutation.mutate({ discount: shippingDiscount, minAmount: shippingMinAmount })}
          disabled={updateMutation.isPending || !isDirty}
        >
          {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar'}
        </Button>
      </div>
    </div>
  );
}

// Banner List Component
function BannerList({ type = 'hero' }: { type?: string }) {
  const { toast } = useToast();
  const { data: banners = [], isLoading } = useQuery<any[]>({
    queryKey: ['/api/ecommerce/admin/banners', type],
    queryFn: async () => {
      const res = await fetch(`/api/ecommerce/admin/banners?type=${type}`);
      return res.json();
    }
  });

  const toggleMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/ecommerce/admin/banners/${id}/toggle`, { method: 'PATCH' });
      if (!res.ok) throw new Error('Error');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ecommerce/admin/banners'] });
      toast({ title: 'Banner actualizado' });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async ({ id, orden }: { id: string, orden: number }) => {
      const res = await fetch(`/api/ecommerce/admin/banners/${id}/reorder`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orden }),
      });
      if (!res.ok) throw new Error('Error');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ecommerce/admin/banners'] });
      toast({ title: 'Orden actualizado' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/ecommerce/admin/banners/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Error');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ecommerce/admin/banners'] });
      toast({ title: 'Banner eliminado' });
    },
  });

  if (isLoading) return <div className="text-center py-6 text-muted-foreground">Cargando banners...</div>;

  if (banners.length === 0) {
    return (
      <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-xl">
        <Image className="h-10 w-10 text-gray-300 mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">No hay banners configurados</p>
        <p className="text-xs text-muted-foreground">Usa el botón "Nuevo Banner" para agregar uno</p>
      </div>
    );
  }

  // Sort banners by order
  const sortedBanners = [...banners].sort((a, b) => (a.orden || 0) - (b.orden || 0));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {sortedBanners.map((banner: any, index: number) => (
        <div key={banner.id} className={`rounded-xl border overflow-hidden transition-all flex flex-col ${banner.activo ? 'border-emerald-200 shadow-sm' : 'border-gray-200 opacity-60'}`}>
          <div className="relative aspect-[16/6] bg-gray-100">
            <img src={banner.imagenDesktop} alt={banner.titulo} className="w-full h-full object-cover" />
            {banner.imagenMobile && (
              <div className="absolute bottom-1 right-1 bg-black/60 text-white text-[9px] px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                <Phone className="h-2.5 w-2.5" /> Móvil ✓
              </div>
            )}
            <div className={`absolute top-1.5 left-1.5 flex flex-col gap-1`}>
              <div className={`text-[9px] px-2 py-0.5 rounded-full font-bold w-max ${banner.activo ? 'bg-emerald-500 text-white' : 'bg-gray-500 text-white'}`}>
                {banner.activo ? 'Activo' : 'Inactivo'}
              </div>
              <div className="text-[9px] px-2 py-0.5 rounded-full font-bold w-max bg-blue-500 text-white">
                {banner.tipoVisualizacion === 'footer' ? 'Footer'
                  : banner.tipoVisualizacion === 'ad' ? 'Publicitario'
                  : banner.tipoVisualizacion === 'cotizador' ? 'Cotizador'
                  : 'Principal'}
              </div>
            </div>
            
            <div className="absolute top-1 right-1 flex flex-col gap-1">
              <Button 
                size="icon" 
                variant="secondary" 
                className="h-6 w-6 bg-white/80 hover:bg-white text-gray-700 shadow-sm"
                onClick={() => reorderMutation.mutate({ id: banner.id, orden: (banner.orden || 0) - 1 })}
              >
                <ArrowUp className="h-3 w-3" />
              </Button>
              <Button 
                size="icon" 
                variant="secondary" 
                className="h-6 w-6 bg-white/80 hover:bg-white text-gray-700 shadow-sm"
                onClick={() => reorderMutation.mutate({ id: banner.id, orden: (banner.orden || 0) + 1 })}
              >
                <ArrowDown className="h-3 w-3" />
              </Button>
            </div>
          </div>
          <div className="p-3 flex-1 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-1">
              <h4 className="font-semibold text-sm truncate">{banner.titulo}</h4>
              <span className="text-xs text-muted-foreground bg-gray-100 px-2 rounded-full">Orden: {banner.orden || 0}</span>
            </div>
            <div className="flex items-center gap-1.5 mt-2">
              <Button
                size="sm"
                variant={banner.activo ? 'outline' : 'default'}
                className="flex-1 h-7 text-xs"
                onClick={() => toggleMutation.mutate(banner.id)}
              >
                {banner.activo ? <><EyeOff className="h-3 w-3 mr-1" /> Desactivar</> : <><Eye className="h-3 w-3 mr-1" /> Activar</>}
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="h-7 text-xs px-2"
                onClick={() => { if (confirm('¿Eliminar este banner?')) deleteMutation.mutate(banner.id); }}
              >
                <XCircle className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}


function WarehouseManagementSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [warehouseForm, setWarehouseForm] = React.useState({ id: "", name: "", location: "", schedule: "", phone: "" });

  const { data: warehouses = [], isLoading } = useQuery({
    queryKey: ["/api/warehouses"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/warehouses?type=ecommerce`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  const saveWarehouse = useMutation({
    mutationFn: async (data: typeof warehouseForm) => {
      const isNew = !data.id;
      const method = isNew ? "POST" : "PATCH";
      const url = isNew ? "/api/warehouses" : `/api/warehouses/${data.id}`;
      // isManual default to true when posting from intranet
      const payload = { ...data, isManual: true };
      const res = await apiRequest(method, url, payload);
      if (!res.ok) throw new Error("Error al guardar");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Guardada", description: "La bodega se guardó correctamente." });
      queryClient.invalidateQueries({ queryKey: ["/api/warehouses"] });
      setWarehouseForm({ id: "", name: "", location: "", schedule: "", phone: "" });
    },
    onError: (e: any) => {
      toast({ title: "Error", description: e.message || "No se pudo guardar la bodega.", variant: "destructive" });
    }
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
            <Building2 className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <CardTitle className="text-lg">Gestión de Bodegas de Retiro</CardTitle>
            <p className="text-sm text-muted-foreground">Administra las bodegas disponibles para retiro en tienda por tus clientes.</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-xl border border-border/60">
            <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
              {warehouseForm.id ? <><Edit className="h-4 w-4 text-blue-500"/> Editar Bodega</> : <><Plus className="h-4 w-4 text-emerald-500"/> Nueva Bodega Manual</>}
            </h3>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Nombre de la Bodega <span className="text-red-500">*</span></Label>
                <Input 
                  placeholder="Ej: Sede Central Lautaro" 
                  value={warehouseForm.name}
                  onChange={(e) => setWarehouseForm(p => ({ ...p, name: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Dirección / Ubicación</Label>
                <Input 
                  placeholder="Ej: Av. Industrial 123, Galpón 4" 
                  value={warehouseForm.location || ""}
                  onChange={(e) => setWarehouseForm(p => ({ ...p, location: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                   <Label className="text-sm font-medium">Horarios de Atención</Label>
                   <Input 
                     placeholder="Ej: Lun-Vie 8:30 a 18:00 (Colación 13:00 - 14:00)" 
                     value={warehouseForm.schedule || ""}
                     onChange={(e) => setWarehouseForm(p => ({ ...p, schedule: e.target.value }))}
                   />
                </div>
                <div className="space-y-1.5">
                   <Label className="text-sm font-medium">Teléfono de Contacto</Label>
                   <Input 
                     placeholder="Ej: +56 9 1234 5678" 
                     value={warehouseForm.phone || ""}
                     onChange={(e) => setWarehouseForm(p => ({ ...p, phone: e.target.value }))}
                   />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                {warehouseForm.id && (
                  <Button variant="outline" onClick={() => setWarehouseForm({ id: "", name: "", location: "", schedule: "", phone: "" })}>
                    Cancelar
                  </Button>
                )}
                <Button 
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50" 
                  disabled={!warehouseForm.name || saveWarehouse.isPending}
                  onClick={() => saveWarehouse.mutate(warehouseForm)}
                >
                  {saveWarehouse.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2"/> : <Save className="h-4 w-4 mr-2" />}
                  {saveWarehouse.isPending ? "Guardando..." : "Guardar Bodega"}
                </Button>
              </div>
            </div>
          </div>

          <div className="flex flex-col h-[400px] bg-white dark:bg-slate-900 border rounded-xl overflow-hidden">
            <div className="bg-muted/30 p-3 border-b border-border/50">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">Bodegas Disponibles</h3>
            </div>
            <div className="p-3 flex-1 overflow-y-auto space-y-2">
              {isLoading ? (
                <div className="text-center py-6 text-muted-foreground text-sm flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Cargando...
                </div>
              ) : warehouses.filter((w: any) => w.isManual || w.is_manual || w.kobo?.startsWith('MNL')).length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground bg-slate-50 dark:bg-slate-800/20 rounded-lg">
                  No hay bodegas creadas manualmente.<br/>Añade tu primera bodega en el formulario.
                </div>
              ) : (
                warehouses.filter((w: any) => w.isManual || w.is_manual || w.kobo?.startsWith('MNL')).map((w: any) => (
                  <div key={w.id} className="p-3 bg-white dark:bg-slate-800 border rounded-lg hover:border-indigo-300 transition-colors flex items-start justify-between group shadow-sm">
                    <div className="min-w-0 pr-2 space-y-1 flex-1">
                      <p className="font-semibold text-sm text-foreground truncate">{w.name}</p>
                      {w.location && <p className="text-xs text-muted-foreground flex items-start gap-1 mt-1 pr-1"><MapPin className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" /> <span className="break-words">{w.location}</span></p>}
                      {w.schedule && <p className="text-xs text-muted-foreground flex items-start gap-1 pr-1"><Clock className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" /> <span className="break-words">{w.schedule}</span></p>}
                      {w.phone && <p className="text-xs text-muted-foreground flex items-start gap-1 pr-1"><Phone className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" /> <span>{w.phone}</span></p>}
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-indigo-600 bg-indigo-50/50 hover:bg-indigo-100 flex-shrink-0" onClick={() => setWarehouseForm({ id: w.id, name: w.name, location: w.location || "", schedule: w.schedule || "", phone: w.phone || "" })}>
                      <Edit className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function EcommerceAdmin() {

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("true");
  const [editingProduct, setEditingProduct] = useState<ProductoEcommerce | null>(null);
  const [showProductDialog, setShowProductDialog] = useState(false);
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);

  // Estados para edición de producto
  const [productCategoria, setProductCategoria] = useState("");
  const [productDescripcion, setProductDescripcion] = useState("");
  const [productImagen, setProductImagen] = useState("");
  const [productPrecio, setProductPrecio] = useState("");
  const [productActivo, setProductActivo] = useState(false);
  const [uploadingProductImage, setUploadingProductImage] = useState(false);
  const [productFamily, setProductFamily] = useState("");
  const [productColor, setProductColor] = useState("");

  // Estados para nueva categoría
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryDescription, setNewCategoryDescription] = useState("");

  // Estados para importador ZIP con sistema de jobs
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ processed: 0, total: 0, results: [] as any[] });
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'scanning' | 'processing' | 'completed' | 'error'>('idle');
  const [currentFile, setCurrentFile] = useState<string>('');
  const [uploadError, setUploadError] = useState<string>('');
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [progressData, setProgressData] = useState<any>(null);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);

  // Estados para catálogos públicos
  const [catalogSearchTerm, setCatalogSearchTerm] = useState('');
  const [selectedCatalogUser, setSelectedCatalogUser] = useState<SalespersonUser | null>(null);
  const [isCatalogDialogOpen, setIsCatalogDialogOpen] = useState(false);

  // Estado para grupos expandidos en la vista de productos
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Estado para importación de productos CSV
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvImportProgress, setCsvImportProgress] = useState<{ status: string; count: number }>({ status: '', count: 0 });

  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const catalogForm = useForm<CatalogFormData>({
    resolver: zodResolver(catalogFormSchema),
    defaultValues: {
      publicSlug: '',
      publicEmail: '',
      publicPhone: '',
      bio: '',
      catalogEnabled: false,
    },
  });

  // Query para obtener productos de ecommerce (basados en lista de precios)
  // El filtrado por búsqueda se hace localmente para evitar recargas por cada letra
  const { data: productos = [], isLoading } = useQuery<ProductoEcommerce[]>({
    queryKey: ['/api/ecommerce/admin/productos', { categoria: selectedCategory, activo: selectedStatus }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedCategory !== 'all') params.append('categoria', selectedCategory);
      if (selectedStatus !== 'all') params.append('activo', selectedStatus);

      const response = await apiRequest(`/api/ecommerce/admin/productos?${params.toString()}`);
      return response.json();
    }
  });

  // Query para obtener categorías
  const { data: categorias = [] } = useQuery<CategoriaEcommerce[]>({
    queryKey: ['/api/ecommerce/admin/categorias'],
    queryFn: async () => {
      const response = await apiRequest('/api/ecommerce/admin/categorias');
      return response.json();
    }
  });

  // Query para obtener estadísticas
  const { data: stats } = useQuery({
    queryKey: ['/api/ecommerce/admin/stats'],
    queryFn: async () => {
      const response = await apiRequest('/api/ecommerce/admin/stats');
      return response.json();
    },
    staleTime: 0,
    refetchOnMount: true
  });


  // Obtener familias y colores únicos de los productos existentes
  const uniqueFamilies = React.useMemo(() => {
    const families = new Set(productos.map(p => p.productFamily).filter(Boolean) as string[]);
    return Array.from(families).sort();
  }, [productos]);

  const uniqueColors = React.useMemo(() => {
    const colors = new Set(productos.map(p => p.color).filter(Boolean) as string[]);
    return Array.from(colors).sort();
  }, [productos]);

  // Query para obtener vendedores (solo admin)
  const { data: salespeople = [], isLoading: isLoadingSalespeople } = useQuery<SalespersonUser[]>({
    queryKey: ['/api/users/salespeople'],
    enabled: isAdmin,
  });

  // Mutación para actualizar catálogo de vendedor
  const updateCatalogMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: CatalogFormData }) => {
      const normalizedData = {
        publicSlug: data.publicSlug,
        catalogEnabled: data.catalogEnabled,
        publicEmail: data.publicEmail?.trim() || null,
        publicPhone: data.publicPhone?.trim() || null,
        bio: data.bio?.trim() || null,
      };
      return await apiRequest(`/api/users/salespeople/${id}`, {
        method: 'PUT',
        data: normalizedData,
      });
    },
    onSuccess: () => {
      toast({
        title: 'Catálogo actualizado',
        description: 'La configuración del catálogo se guardó correctamente',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/users/salespeople'] });
      setIsCatalogDialogOpen(false);
      setSelectedCatalogUser(null);
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'No se pudo actualizar el catálogo',
      });
    },
  });

  // Mutación para importar productos desde CSV de catálogo
  const importCatalogMutation = useMutation({
    mutationFn: async (csvData: any[]) => {
      const response = await apiRequest('/api/ecommerce/admin/productos/import-catalog', {
        method: 'POST',
        data: { data: csvData }
      });
      return response.json();
    },
    onSuccess: (data) => {
      setCsvImporting(false);
      queryClient.invalidateQueries({ queryKey: ['/api/ecommerce/admin/productos'] });
      queryClient.invalidateQueries({ queryKey: ['/api/ecommerce/admin/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/ecommerce/admin/categorias'] });
      toast({
        title: 'Importación completada',
        description: `${data.productsCreated} productos creados, ${data.productsUpdated} actualizados`,
      });
    },
    onError: (error: any) => {
      setCsvImporting(false);
      toast({
        variant: 'destructive',
        title: 'Error en importación',
        description: error.message || 'No se pudieron importar los productos',
      });
    },
  });

  // Mutación para limpiar todos los productos
  const clearProductsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('/api/ecommerce/admin/productos/clear-all', {
        method: 'DELETE'
      });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/ecommerce/admin/productos'] });
      queryClient.invalidateQueries({ queryKey: ['/api/ecommerce/admin/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/ecommerce/admin/categorias'] });
      toast({
        title: 'Productos eliminados',
        description: `Se eliminaron ${data.deletedCount} registros`,
      });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'No se pudieron eliminar los productos',
      });
    },
  });

  // Funciones auxiliares para catálogos
  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  };

  const openCatalogEditDialog = (salesperson: SalespersonUser) => {
    setSelectedCatalogUser(salesperson);
    catalogForm.reset({
      publicSlug: salesperson.publicSlug || generateSlug(salesperson.salespersonName),
      publicEmail: salesperson.publicEmail || salesperson.email || '',
      publicPhone: salesperson.publicPhone || '',
      bio: salesperson.bio || '',
      catalogEnabled: salesperson.catalogEnabled ?? false,
    });
    setIsCatalogDialogOpen(true);
  };

  const onCatalogSubmit = (data: CatalogFormData) => {
    if (!selectedCatalogUser) return;
    updateCatalogMutation.mutate({ id: selectedCatalogUser.id, data });
  };

  const filteredSalespeople = salespeople.filter(sp => {
    if (!catalogSearchTerm) return sp.role === 'salesperson' || (sp.role === 'supervisor' || sp.role === 'encargado_area');
    const search = catalogSearchTerm.toLowerCase();
    return (
      (sp.role === 'salesperson' || (sp.role === 'supervisor' || sp.role === 'encargado_area')) &&
      (sp.salespersonName.toLowerCase().includes(search) ||
        sp.email?.toLowerCase().includes(search) ||
        sp.publicSlug?.toLowerCase().includes(search))
    );
  });

  // Mutación para actualizar producto
  const updateProductMutation = useMutation({
    mutationFn: async (data: { id: string; updates: Partial<ProductoEcommerce> }) => {
      console.log('🔄 [FRONTEND] Iniciando actualización de producto:', {
        id: data.id,
        updates: data.updates,
        url: `/api/ecommerce/admin/productos/${data.id}`
      });

      try {
        const response = await apiRequest(`/api/ecommerce/admin/productos/${data.id}`, {
          method: 'PATCH',
          data: data.updates
        });

        console.log('✅ [FRONTEND] Respuesta del servidor recibida:', {
          status: response.status,
          ok: response.ok
        });

        const result = await response.json();
        console.log('✅ [FRONTEND] Producto actualizado exitosamente:', result);
        return result;
      } catch (error) {
        console.error('❌ [FRONTEND] Error en actualización de producto:', {
          error,
          id: data.id,
          updates: data.updates
        });
        throw error;
      }
    },
    onSuccess: (data) => {
      console.log('🎉 [FRONTEND] Mutación exitosa, invalidando queries...');
      queryClient.invalidateQueries({ queryKey: ['/api/ecommerce/admin/productos'] });
      queryClient.invalidateQueries({ queryKey: ['/api/ecommerce/admin/stats'] });
      setShowProductDialog(false);
      setEditingProduct(null);
      toast({
        title: "Producto actualizado",
        description: "Los cambios se guardaron correctamente.",
      });
    },
    onError: (error: any) => {
      console.error('❌ [FRONTEND] Error en mutación:', error);

      // Extract more detailed error information
      let errorMessage = "No se pudo actualizar el producto.";
      if (error?.message) {
        errorMessage += ` (${error.message})`;
      }

      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  });

  // Mutación para alternar estado activo del producto
  const toggleProductMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest(`/api/ecommerce/admin/productos/${id}/toggle`, {
        method: 'PATCH'
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ecommerce/admin/productos'] });
      queryClient.invalidateQueries({ queryKey: ['/api/ecommerce/admin/stats'] });
      toast({
        title: "Estado actualizado",
        description: "El producto fue actualizado correctamente.",
      });
    }
  });

  // Mutación para crear categoría
  const createCategoryMutation = useMutation({
    mutationFn: async (data: { nombre: string; descripcion?: string }) => {
      const response = await apiRequest('/api/ecommerce/admin/categorias', {
        method: 'POST',
        data
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ecommerce/admin/categorias'] });
      setShowCategoryDialog(false);
      setNewCategoryName("");
      setNewCategoryDescription("");
      toast({
        title: "Categoría creada",
        description: "La nueva categoría se creó correctamente.",
      });
    }
  });

  // Nueva mutación para iniciar job de importación de imágenes ZIP
  const uploadZipMutation = useMutation({
    mutationFn: async (file: File) => {
      setUploadStatus('uploading');
      setCurrentFile('Subiendo archivo ZIP...');
      setUploadError('');

      const formData = new FormData();
      formData.append('zipFile', file);

      const response = await fetch('/api/ecommerce/admin/upload-images', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error al iniciar importación');
      }

      return response.json();
    },
    onSuccess: (data) => {
      // Iniciar polling del job
      const jobId = data.jobId;
      setCurrentJobId(jobId);
      setUploadStatus('scanning');
      setCurrentFile('Escaneando archivo ZIP...');

      console.log(`🔄 [ZIP IMPORT] Job iniciado: ${jobId}, comenzando polling...`);

      // Iniciar polling cada 1 segundo
      const interval = setInterval(() => {
        pollJobStatus(jobId);
      }, 1000);

      setPollingInterval(interval);

      toast({
        title: "Importación iniciada",
        description: "El archivo ZIP se está procesando en segundo plano.",
      });
    },
    onError: (error: any) => {
      console.error('❌ [ZIP IMPORT] Error iniciando importación:', error);
      setUploadStatus('error');
      setCurrentFile('');
      setUploadError(error.message || "No se pudo iniciar la importación");

      toast({
        title: "Error en la importación",
        description: error.message || "No se pudo iniciar la importación.",
        variant: "destructive",
      });
      setIsUploading(false);
    }
  });

  // Función para hacer polling del status del job
  const pollJobStatus = async (jobId: string) => {
    try {
      const response = await apiRequest(`/api/ecommerce/admin/upload-images/${jobId}/status`);
      const jobData = await response.json();

      console.log(`📊 [ZIP IMPORT] Job ${jobId} status:`, jobData.status, `(${jobData.processedFiles}/${jobData.totalFiles})`);

      // Actualizar estado basado en el progreso del job
      setProgressData(jobData.progressData);

      if (jobData.totalFiles > 0) {
        setUploadProgress({
          processed: jobData.processedFiles,
          total: jobData.totalFiles,
          results: jobData.resultData?.results || []
        });
      }

      // Actualizar información de archivo actual
      if (jobData.progressData?.currentFile) {
        setCurrentFile(jobData.progressData.currentFile);
      } else if (jobData.progressData?.phase === 'scanning') {
        setCurrentFile('Escaneando archivo ZIP...');
      } else if (jobData.progressData?.phase === 'processing') {
        const batch = jobData.progressData.currentBatch || 0;
        const totalBatches = jobData.progressData.totalBatches || 0;
        setCurrentFile(`Procesando lote ${batch}/${totalBatches}...`);
      } else if (jobData.progressData?.phase === 'completed') {
        setCurrentFile('');
      }

      // Actualizar estado principal
      if (jobData.status === 'processing') {
        if (jobData.progressData?.phase === 'scanning') {
          setUploadStatus('scanning');
        } else {
          setUploadStatus('processing');
        }
      } else if (jobData.status === 'success' || jobData.status === 'partial') {
        // Job completado
        setUploadStatus('completed');
        setCurrentFile('');

        // Limpiar polling
        if (pollingInterval) {
          clearInterval(pollingInterval);
          setPollingInterval(null);
        }

        // Invalidar queries para refrescar productos
        queryClient.invalidateQueries({ queryKey: ['/api/ecommerce/admin/productos'] });

        // Mostrar resultado final
        const successCount = jobData.successfulFiles || 0;
        const errorCount = jobData.failedFiles || 0;

        toast({
          title: "Importación completada",
          description: `✅ ${successCount} imágenes procesadas exitosamente${errorCount > 0 ? `, ❌ ${errorCount} errores` : ''}`,
          variant: errorCount > 0 ? "destructive" : "default"
        });

        setIsUploading(false);
        setCurrentJobId(null);

      } else if (jobData.status === 'error') {
        // Error en el job
        setUploadStatus('error');
        setCurrentFile('');
        setUploadError(jobData.errorMessage || 'Error procesando ZIP');

        // Limpiar polling
        if (pollingInterval) {
          clearInterval(pollingInterval);
          setPollingInterval(null);
        }

        toast({
          title: "Error en la importación",
          description: jobData.errorMessage || "Error procesando el archivo ZIP.",
          variant: "destructive",
        });

        setIsUploading(false);
        setCurrentJobId(null);
      }

    } catch (error) {
      console.error('❌ [ZIP IMPORT] Error consultando status del job:', error);

      // En caso de error de polling, continuar intentando por un tiempo
      // pero si falla varias veces, detener el polling
    }
  };

  // Limpiar polling al desmontar componente
  React.useEffect(() => {
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [pollingInterval]);

  // Filtrar productos
  const filteredProducts = productos.filter(product => {
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      if (!product.codigo.toLowerCase().includes(searchLower) &&
        !product.producto.toLowerCase().includes(searchLower)) {
        return false;
      }
    }

    if (selectedCategory !== 'all' && product.categoria !== selectedCategory) {
      return false;
    }

    if (selectedStatus !== 'all') {
      const isActive = selectedStatus === 'true';
      if (product.activo !== isActive) return false;
    }

    return true;
  });

  // Agrupar productos por variantParentSku
  const groupedProducts = useMemo(() => {
    const groups: Map<string, ProductGroup> = new Map();
    const standalone: ProductoEcommerce[] = [];

    for (const product of filteredProducts) {
      const parentSku = product.variantParentSku;

      if (parentSku) {
        if (!groups.has(parentSku)) {
          groups.set(parentSku, {
            parentSku,
            displayName: product.variantGenericDisplayName || product.producto,
            products: [],
            mainProduct: product,
          });
        }
        const group = groups.get(parentSku)!;
        group.products.push(product);

        // El producto con variantIndex 0 es el principal
        if ((product.variantIndex ?? 0) === 0) {
          group.mainProduct = product;
          group.displayName = product.variantGenericDisplayName || product.producto;
        }
      } else {
        standalone.push(product);
      }
    }

    // Ordenar variantes por variantIndex dentro de cada grupo
    groups.forEach(group => {
      group.products.sort((a, b) => (a.variantIndex ?? 0) - (b.variantIndex ?? 0));
    });

    return { groups: Array.from(groups.values()), standalone };
  }, [filteredProducts]);

  // Toggle grupo expandido
  const toggleGroupExpand = (parentSku: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(parentSku)) {
        newSet.delete(parentSku);
      } else {
        newSet.add(parentSku);
      }
      return newSet;
    });
  };

  // Funciones auxiliares
  const handleEditProduct = (product: ProductoEcommerce) => {
    setEditingProduct(product);
    setProductCategoria(product.categoria || "");
    setProductDescripcion(product.descripcion || "");
    setProductImagen(product.imagenUrl || "");
    setProductPrecio(product.precio.toString());
    setProductActivo(product.activo);
    setProductFamily(product.productFamily || "");
    setProductColor(product.color || "");
    setShowProductDialog(true);
  };

  const handleSaveProduct = () => {
    if (!editingProduct) return;

    const updates: any = {
      categoria: productCategoria,
      descripcion: productDescripcion,
      imagenUrl: productImagen,
      precio: parseFloat(productPrecio),
      activo: productActivo,
      productFamily: productFamily.trim() || null,
      color: productColor.trim() || null,
    };

    updateProductMutation.mutate({
      id: editingProduct.id,
      updates
    });
  };

  const handleCreateCategory = () => {
    if (!newCategoryName.trim()) return;

    createCategoryMutation.mutate({
      nombre: newCategoryName.trim(),
      descripcion: newCategoryDescription.trim() || undefined
    });
  };

  const formatPrice = (price: number) => {
    return `$${price.toLocaleString('es-CL')}`;
  };

  // Mutación para subir imagen individual
  const uploadSingleImageMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('image', file);

      const response = await fetch('/api/ecommerce/admin/upload-single-image', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error al subir imagen');
      }

      return response.json();
    },
    onSuccess: (data, file) => {
      queryClient.invalidateQueries({ queryKey: ['/api/ecommerce/admin/productos'] });

      // Actualizar uploadProgress para mostrar el resultado
      setUploadProgress({
        processed: 1,
        total: 1,
        results: [{
          fileName: file.name,
          success: data.matched,
          productCode: data.productCode,
          message: data.message
        }]
      });

      toast({
        title: "Imagen importada",
        description: data.matched ? `Imagen asociada a: ${data.productName}` : "Imagen subida pero sin producto asociado",
      });
    },
    onError: (error: any, file) => {
      // Mostrar error en uploadProgress también
      setUploadProgress({
        processed: 1,
        total: 1,
        results: [{
          fileName: file.name,
          success: false,
          productCode: '',
          message: error.message
        }]
      });

      toast({
        title: "Error al subir imagen",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Mutación para subir imagen para un producto específico
  const uploadProductImageMutation = useMutation({
    mutationFn: async ({ file, productId, productCode }: { file: File; productId: string; productCode: string }) => {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('productId', productId);
      formData.append('productCode', productCode);

      const response = await fetch('/api/ecommerce/admin/upload-product-image', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error al subir imagen');
      }

      return response.json();
    },
    onSuccess: (data) => {
      setProductImagen(data.imageUrl);
      queryClient.invalidateQueries({ queryKey: ['/api/ecommerce/admin/productos'] });
      setUploadingProductImage(false);
      toast({
        title: "Imagen actualizada",
        description: "La imagen del producto se ha actualizado correctamente",
      });
    },
    onError: (error: any) => {
      setUploadingProductImage(false);
      toast({
        title: "Error al subir imagen",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Funciones para importador ZIP e imágenes sueltas
  const handleMultipleFiles = async (files: FileList | File[]) => {
    const filesArray = Array.from(files);

    if (filesArray.length === 0) return;

    // Si solo hay un archivo, usar lógica simple
    if (filesArray.length === 1) {
      handleFileUpload(filesArray[0]);
      return;
    }

    // Filtrar solo imágenes válidas
    const imageFiles = filesArray.filter(file => {
      const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(file.name);
      const isValidSize = file.size <= 10 * 1024 * 1024; // 10MB
      return isImage && isValidSize;
    });

    if (imageFiles.length === 0) {
      toast({
        title: "No hay archivos válidos",
        description: "Solo se permiten imágenes JPG/PNG/GIF/WEBP (máx 10MB cada una).",
        variant: "destructive",
      });
      return;
    }

    // Notificar archivos descartados
    const invalidCount = filesArray.length - imageFiles.length;
    if (invalidCount > 0) {
      toast({
        title: "Algunos archivos fueron descartados",
        description: `${invalidCount} archivo(s) no válido(s) o muy grande(s).`,
      });
    }

    // Resetear progreso
    const allResults: any[] = [];
    setUploadProgress({ processed: 0, total: imageFiles.length, results: [] });

    console.log(`📸 [MULTI-IMAGE] Subiendo ${imageFiles.length} imágenes...`);

    // Subir cada imagen secuencialmente
    for (let i = 0; i < imageFiles.length; i++) {
      const file = imageFiles[i];
      console.log(`📸 [MULTI-IMAGE] Procesando ${i + 1}/${imageFiles.length}: ${file.name}`);

      try {
        const formData = new FormData();
        formData.append('image', file);

        const response = await fetch('/api/ecommerce/admin/upload-single-image', {
          method: 'POST',
          body: formData
        });

        const data = await response.json();

        if (response.ok) {
          allResults.push({
            fileName: file.name,
            success: data.matched,
            productCode: data.productCode,
            message: data.message
          });
        } else {
          allResults.push({
            fileName: file.name,
            success: false,
            productCode: '',
            message: data.message || 'Error al subir'
          });
        }
      } catch (error: any) {
        console.error(`❌ Error subiendo ${file.name}:`, error);
        allResults.push({
          fileName: file.name,
          success: false,
          productCode: '',
          message: error.message
        });
      }

      // Actualizar progreso
      setUploadProgress({
        processed: i + 1,
        total: imageFiles.length,
        results: allResults
      });
    }

    // Invalidar cache de productos
    queryClient.invalidateQueries({ queryKey: ['/api/ecommerce/admin/productos'] });

    const successCount = allResults.filter(r => r.success).length;
    const errorCount = allResults.filter(r => !r.success).length;

    toast({
      title: "Importación completada",
      description: `✅ ${successCount} exitosa(s), ${errorCount > 0 ? `❌ ${errorCount} con errores` : ''}`,
    });
  };

  const handleFileUpload = (file: File) => {
    const isZip = file.name.toLowerCase().endsWith('.zip');
    const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(file.name);

    if (!isZip && !isImage) {
      toast({
        title: "Archivo inválido",
        description: "Solo se permiten archivos ZIP o imágenes (JPG, PNG, GIF, WEBP).",
        variant: "destructive",
      });
      return;
    }

    // Validar tamaño según tipo de archivo
    if (isImage && file.size > 10 * 1024 * 1024) { // 10MB limit para imágenes
      toast({
        title: "Imagen muy grande",
        description: "Las imágenes no deben exceder 10MB.",
        variant: "destructive",
      });
      return;
    }

    if (isZip && file.size > 100 * 1024 * 1024) { // 100MB limit para ZIP
      toast({
        title: "Archivo muy grande",
        description: "Los archivos ZIP no deben exceder 100MB.",
        variant: "destructive",
      });
      return;
    }

    if (isImage) {
      // Subir imagen individual
      console.log('📸 [IMAGE IMPORT] Subiendo imagen individual:', file.name);
      uploadSingleImageMutation.mutate(file);
      return;
    }

    // Resetear estados para ZIP
    setIsUploading(true);
    setUploadStatus('uploading');
    setUploadProgress({ processed: 0, total: 0, results: [] });
    setCurrentFile('');
    setUploadError('');

    console.log('🚀 [ZIP IMPORT] Iniciando importación de:', file.name);
    uploadZipMutation.mutate(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleMultipleFiles(files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  // Función para manejar importación de CSV de catálogo
  const handleCsvImport = async (file: File) => {
    if (!file.name.endsWith('.csv')) {
      toast({
        title: 'Archivo inválido',
        description: 'Por favor selecciona un archivo CSV',
        variant: 'destructive',
      });
      return;
    }

    setCsvImporting(true);
    setCsvImportProgress({ status: 'Leyendo archivo...', count: 0 });

    try {
      const text = await file.text();
      const Papa = await import('papaparse');

      Papa.default.parse(text, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (results.data && results.data.length > 0) {
            setCsvImportProgress({ status: 'Importando productos...', count: results.data.length });
            importCatalogMutation.mutate(results.data as any[]);
          } else {
            setCsvImporting(false);
            toast({
              title: 'CSV vacío',
              description: 'El archivo no contiene datos para importar',
              variant: 'destructive',
            });
          }
        },
        error: (error: any) => {
          setCsvImporting(false);
          toast({
            title: 'Error al leer CSV',
            description: error.message,
            variant: 'destructive',
          });
        }
      });
    } catch (error: any) {
      setCsvImporting(false);
      toast({
        title: 'Error',
        description: error.message || 'No se pudo leer el archivo',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Cargando productos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 px-2 md:px-4 pb-8">
      {/* Minimal Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-border/40 p-6 md:p-8 -mx-2 md:-mx-4 mt-[-2rem] mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
              <ShoppingCart className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">Configuración eCommerce</h1>
              <p className="text-muted-foreground text-sm">Administra catálogos, categorías y configuración general de tu tienda</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              className="bg-transparent border-input hover:bg-accent text-foreground gap-2"
              onClick={() => window.open('/tienda', '_blank')}
              data-testid="button-view-store"
            >
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
              Ver Tienda
            </Button>

            <Dialog open={showCategoryDialog} onOpenChange={setShowCategoryDialog}>
              <DialogTrigger asChild>
                <Button className="bg-foreground text-background hover:bg-foreground/90 gap-2" data-testid="button-new-category">
                  <Plus className="h-4 w-4" />
                  Nueva Categoría
                </Button>
              </DialogTrigger>
            </Dialog>
          </div>
        </div>
      </div>

      {/* Minimal Stat Cards */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 px-1">
          <Card className="bg-white dark:bg-slate-900 border-border/40 shadow-sm shadow-slate-100/50 dark:shadow-none hover:border-border/80 transition-colors">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Total Productos</p>
                  <p className="text-2xl font-semibold tracking-tight mt-1">{stats.totalProductos}</p>
                </div>
                <div className="h-8 w-8 rounded-md bg-muted/50 flex items-center justify-center">
                  <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-slate-900 border-border/40 shadow-sm shadow-slate-100/50 dark:shadow-none hover:border-border/80 transition-colors">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Productos Activos</p>
                  <p className="text-2xl font-semibold tracking-tight mt-1">{stats.productosActivos}</p>
                </div>
                <div className="h-8 w-8 rounded-md bg-muted/50 flex items-center justify-center">
                  <Eye className="h-4 w-4 text-emerald-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-slate-900 border-border/40 shadow-sm shadow-slate-100/50 dark:shadow-none hover:border-border/80 transition-colors">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Categorías</p>
                  <p className="text-2xl font-semibold tracking-tight mt-1">{stats.totalCategorias}</p>
                </div>
                <div className="h-8 w-8 rounded-md bg-muted/50 flex items-center justify-center">
                  <Tag className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-slate-900 border-border/40 shadow-sm shadow-slate-100/50 dark:shadow-none hover:border-border/80 transition-colors">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Pedidos</p>
                  <p className="text-2xl font-semibold tracking-tight mt-1">{stats.ventasMes}</p>
                </div>
                <div className="h-8 w-8 rounded-md bg-muted/50 flex items-center justify-center">
                  <Package className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      
      <Tabs defaultValue="general" className="w-full">
        <div className="px-1 border-b border-border/40 mb-6 flex overflow-x-auto">
          <TabsList className="w-auto h-auto bg-transparent p-0 flex space-x-6">
             <TabsTrigger value="general" className="relative h-12 rounded-none border-b-2 border-transparent bg-transparent px-0 text-sm font-medium text-muted-foreground hover:text-foreground data-[state=active]:border-foreground data-[state=active]:text-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none w-max">General</TabsTrigger>
             <TabsTrigger value="envios" className="relative h-12 rounded-none border-b-2 border-transparent bg-transparent px-0 text-sm font-medium text-muted-foreground hover:text-foreground data-[state=active]:border-foreground data-[state=active]:text-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none w-max">Envíos y Retiros</TabsTrigger>
             <TabsTrigger value="cupones" className="relative h-12 rounded-none border-b-2 border-transparent bg-transparent px-0 text-sm font-medium text-muted-foreground hover:text-foreground data-[state=active]:border-foreground data-[state=active]:text-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none w-max">Cupones</TabsTrigger>
             <TabsTrigger value="catalogos" className="relative h-12 rounded-none border-b-2 border-transparent bg-transparent px-0 text-sm font-medium text-muted-foreground hover:text-foreground data-[state=active]:border-foreground data-[state=active]:text-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none w-max">Catálogos de Vendedores</TabsTrigger>
             <TabsTrigger value="tracking" className="relative h-12 rounded-none border-b-2 border-transparent bg-transparent px-0 text-sm font-medium text-muted-foreground hover:text-foreground data-[state=active]:border-foreground data-[state=active]:text-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none w-max">Catálogo (Ads &amp; SEO)</TabsTrigger>
             <TabsTrigger value="cotizador" className="relative h-12 rounded-none border-b-2 border-transparent bg-transparent px-0 text-sm font-medium text-muted-foreground hover:text-foreground data-[state=active]:border-foreground data-[state=active]:text-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none w-max">Cotizador</TabsTrigger>
             <TabsTrigger value="mailing" className="relative h-12 rounded-none border-b-2 border-transparent bg-transparent px-0 text-sm font-medium text-muted-foreground hover:text-foreground data-[state=active]:border-foreground data-[state=active]:text-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none w-max">Mailing</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="general" className="space-y-6">
          {/* Topbar Configuration Section */}
          {isAdmin && (
            <TopbarConfigSection />
          )}

          {/* Banner Management Section */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                  <Image className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <CardTitle className="text-lg">Banners de la Tienda</CardTitle>
                  <p className="text-sm text-muted-foreground">Administra los banners del carrusel de tu tienda online</p>
                </div>
              </div>
              <Dialog>
                <DialogTrigger asChild>
                  <Button className="bg-foreground text-background hover:bg-foreground/90 gap-2">
                    <Plus className="h-4 w-4" />
                    Nuevo Banner
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Crear Nuevo Banner</DialogTitle>
                    <DialogDescription>Sube imágenes para escritorio y móvil</DialogDescription>
                  </DialogHeader>
                  <BannerForm onSuccess={() => {
                    queryClient.invalidateQueries({ queryKey: ['/api/ecommerce/admin/banners'] });
                    toast({ title: 'Banner creado', description: 'El banner se creó correctamente' });
                  }} />
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            <BannerSettings />
            <BannerList />
          </CardContent>
        </Card>
      )}

      {/* Ad Banners Management Section */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                  <MonitorSmartphone className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <CardTitle className="text-lg">Banners Publicitarios</CardTitle>
                  <p className="text-sm text-muted-foreground">Administra los banners que aparecen entre los productos del catálogo</p>
                </div>
              </div>
              <Dialog>
                <DialogTrigger asChild>
                  <Button className="bg-foreground text-background hover:bg-foreground/90 gap-2 shrink-0">
                    <Plus className="h-4 w-4" />
                    Nuevo Banner Publicitario
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Crear Banner Publicitario</DialogTitle>
                    <DialogDescription>Sube imágenes para mostrar entre productos</DialogDescription>
                  </DialogHeader>
                  <BannerForm 
                    type="ad"
                    onSuccess={() => {
                      queryClient.invalidateQueries({ queryKey: ['/api/ecommerce/admin/banners', 'ad'] });
                      toast({ title: 'Banner publicitario creado' });
                    }} 
                  />
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            <AdBannerSettings />
            <BannerList type="ad" />
          </CardContent>
        </Card>
      )}

      
        </TabsContent>

        <TabsContent value="envios" className="space-y-6">
          {isAdmin && <CheckoutSettings />}
          {isAdmin && (
            <ShippingRatesSection />
          )}
          {isAdmin && (
            <WarehouseManagementSection />
          )}
        </TabsContent>

        <TabsContent value="cupones" className="space-y-6">
          {isAdmin && <CuponesManager />}
        </TabsContent>

        <TabsContent value="catalogos" className="space-y-6">
          {/* Catálogos Públicos - Solo Admin */}
      {isAdmin && (
        <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Catálogos Públicos de Vendedores</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Habilita y configura el catálogo público para cada vendedor
                </p>
                <div className="relative mt-4">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar vendedor..."
                    value={catalogSearchTerm}
                    onChange={(e) => setCatalogSearchTerm(e.target.value)}
                    className="pl-10"
                    data-testid="input-catalog-search"
                  />
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingSalespeople ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredSalespeople.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No se encontraron vendedores
                  </p>
                ) : (
                  <div className="space-y-3">
                    {filteredSalespeople.map(salesperson => (
                      <div
                        key={salesperson.id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                        data-testid={`catalog-user-row-${salesperson.id}`}
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <User className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{salesperson.salespersonName}</p>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              {salesperson.publicSlug ? (
                                <span className="flex items-center gap-1">
                                  <LinkIcon className="h-3 w-3" />
                                  /catalogo/{salesperson.publicSlug}
                                </span>
                              ) : (
                                <span className="italic">Sin URL configurada</span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          {salesperson.catalogEnabled ? (
                            <Badge variant="default" className="bg-green-500 hover:bg-green-600">
                              <Check className="h-3 w-3 mr-1" />
                              Activo
                            </Badge>
                          ) : (
                            <Badge variant="secondary">
                              <X className="h-3 w-3 mr-1" />
                              Inactivo
                            </Badge>
                          )}

                          {salesperson.catalogEnabled && salesperson.publicSlug && (
                            <a
                              href={`/catalogo/${salesperson.publicSlug}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:text-primary/80"
                              data-testid={`catalog-preview-${salesperson.id}`}
                            >
                              <Eye className="h-4 w-4" />
                            </a>
                          )}

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openCatalogEditDialog(salesperson)}
                            data-testid={`catalog-edit-${salesperson.id}`}
                          >
                            Configurar
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Dialog para editar catálogo */}
            <Dialog open={isCatalogDialogOpen} onOpenChange={setIsCatalogDialogOpen}>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Configurar Catálogo Público</DialogTitle>
                  <DialogDescription>
                    {selectedCatalogUser?.salespersonName}
                  </DialogDescription>
                </DialogHeader>

                <Form {...catalogForm}>
                  <form onSubmit={catalogForm.handleSubmit(onCatalogSubmit)} className="space-y-4">
                    <FormField
                      control={catalogForm.control}
                      name="catalogEnabled"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Catálogo Habilitado</FormLabel>
                            <FormDescription>
                              Activa el catálogo público para este vendedor
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="catalog-switch-enabled"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={catalogForm.control}
                      name="publicSlug"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>URL del Catálogo</FormLabel>
                          <FormControl>
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-muted-foreground whitespace-nowrap">
                                /catalogo/
                              </span>
                              <Input
                                {...field}
                                placeholder="nombre-vendedor"
                                data-testid="catalog-input-slug"
                              />
                            </div>
                          </FormControl>
                          <FormDescription>
                            URL amigable para compartir (solo letras minúsculas, números y guiones)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={catalogForm.control}
                      name="publicEmail"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email de Contacto</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input
                                {...field}
                                type="email"
                                placeholder="vendedor@empresa.cl"
                                className="pl-10"
                                data-testid="catalog-input-email"
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={catalogForm.control}
                      name="publicPhone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Teléfono de Contacto</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input
                                {...field}
                                placeholder="+56 9 1234 5678"
                                className="pl-10"
                                data-testid="catalog-input-phone"
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={catalogForm.control}
                      name="bio"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Biografía</FormLabel>
                          <FormControl>
                            <Textarea
                              {...field}
                              placeholder="Breve descripción del vendedor..."
                              rows={3}
                              data-testid="catalog-input-bio"
                            />
                          </FormControl>
                          <FormDescription>
                            Máximo 500 caracteres
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex justify-end gap-2 pt-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsCatalogDialogOpen(false)}
                        data-testid="catalog-button-cancel"
                      >
                        Cancelar
                      </Button>
                      <Button
                        type="submit"
                        disabled={updateCatalogMutation.isPending}
                        data-testid="catalog-button-save"
                      >
                        {updateCatalogMutation.isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Guardando...
                          </>
                        ) : (
                          'Guardar'
                        )}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
        </div>
      )}


        </TabsContent>

        <TabsContent value="tracking" className="space-y-6">
          {isAdmin ? (
            <TrackingConfigSection />
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Solo los administradores pueden configurar los códigos de tracking.
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="cotizador" className="space-y-6">
          {isAdmin ? (
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Banners del Cotizador</CardTitle>
                      <p className="text-sm text-muted-foreground">Imágenes de la cabecera del cotizador público. Sube una versión para escritorio y otra para móvil.</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button variant="outline" className="gap-2" asChild>
                      <a href="/cotizador" target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4" />
                        Ver Cotizador
                      </a>
                    </Button>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button className="bg-foreground text-background hover:bg-foreground/90 gap-2">
                          <Plus className="h-4 w-4" />
                          Nuevo Banner
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-lg">
                        <DialogHeader>
                          <DialogTitle>Crear Banner del Cotizador</DialogTitle>
                          <DialogDescription>Sube imágenes para escritorio y móvil</DialogDescription>
                        </DialogHeader>
                        <BannerForm
                          type="cotizador"
                          onSuccess={() => {
                            queryClient.invalidateQueries({ queryKey: ['/api/ecommerce/admin/banners'] });
                            toast({ title: 'Banner creado', description: 'El banner del cotizador se creó correctamente' });
                          }}
                        />
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <BannerList type="cotizador" />
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Solo los administradores pueden configurar el cotizador.
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="mailing" className="space-y-6">
          {isAdmin ? (
            <MailingSection />
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Solo los administradores pueden gestionar el módulo de Mailing.
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ================================
// CUPONES MANAGER COMPONENT
// ================================
function CuponesManager() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [showForm, setShowForm] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<any | null>(null);
  const [form, setForm] = useState({
    code: '',
    description: '',
    discountType: 'percentage' as 'percentage' | 'fixed' | 'free_shipping',
    discountValue: 0,
    appliesTo: 'cart' as 'cart' | 'product',
    productSku: '',
    minOrderAmount: 0,
    maxUses: '',
    isActive: true,
    expiresAt: '',
  });

  const { data: coupons = [], isLoading } = useQuery({
    queryKey: ['/api/admin/coupons'],
    queryFn: async () => {
      const res = await fetch('/api/admin/coupons', { credentials: 'include' });
      if (!res.ok) throw new Error('Error al obtener cupones');
      return res.json();
    },
  });

  const resetForm = () => {
    setForm({ code: '', description: '', discountType: 'percentage', discountValue: 0, appliesTo: 'cart', productSku: '', minOrderAmount: 0, maxUses: '', isActive: true, expiresAt: '' });
    setEditingCoupon(null);
    setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        code: form.code.toUpperCase().trim(),
        description: form.description || null,
        discountType: form.discountType,
        discountValue: Number(form.discountValue),
        appliesTo: form.appliesTo,
        productSku: form.appliesTo === 'product' ? form.productSku.trim() || null : null,
        minOrderAmount: Number(form.minOrderAmount) || 0,
        maxUses: form.maxUses ? Number(form.maxUses) : null,
        isActive: form.isActive,
        expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
      };

      const url = editingCoupon ? `/api/admin/coupons/${editingCoupon.id}` : '/api/admin/coupons';
      const method = editingCoupon ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error al guardar cupón');
      }

      toast({ title: editingCoupon ? 'Cupón actualizado' : 'Cupón creado', description: `Código: ${payload.code}` });
      qc.invalidateQueries({ queryKey: ['/api/admin/coupons'] });
      resetForm();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string, code: string) => {
    if (!confirm(`¿Eliminar cupón ${code}?`)) return;
    try {
      const res = await fetch(`/api/admin/coupons/${id}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) throw new Error('Error al eliminar');
      toast({ title: 'Cupón eliminado' });
      qc.invalidateQueries({ queryKey: ['/api/admin/coupons'] });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleEdit = (coupon: any) => {
    setEditingCoupon(coupon);
    setForm({
      code: coupon.code,
      description: coupon.description || '',
      discountType: coupon.discountType,
      discountValue: Number(coupon.discountValue),
      appliesTo: coupon.appliesTo || 'cart',
      productSku: coupon.productSku || '',
      minOrderAmount: Number(coupon.minOrderAmount) || 0,
      maxUses: coupon.maxUses?.toString() || '',
      isActive: coupon.isActive,
      expiresAt: coupon.expiresAt ? new Date(coupon.expiresAt).toISOString().split('T')[0] : '',
    });
    setShowForm(true);
  };

  const discountTypeLabel = (type: string) => {
    if (type === 'percentage') return 'Porcentaje';
    if (type === 'fixed') return 'Monto fijo';
    if (type === 'free_shipping') return '🚚 Envío gratis';
    return type;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Cupones de Descuento</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Crea cupones de porcentaje, monto fijo o envío gratuito. Aplícalos al carrito completo o a un producto específico.
          </p>
        </div>
        <Button onClick={() => { resetForm(); setShowForm(true); }} className="gap-2">
          <Plus className="h-4 w-4" />
          Nuevo Cupón
        </Button>
      </div>

      {/* Form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editingCoupon ? 'Editar cupón' : 'Crear nuevo cupón'}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Código del cupón *</Label>
                <Input placeholder="Ej: VERANO20" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} required disabled={!!editingCoupon} />
                <p className="text-xs text-muted-foreground">En mayúsculas. No puede modificarse después de creado.</p>
              </div>
              <div className="space-y-1">
                <Label>Descripción</Label>
                <Input placeholder="Ej: 20% descuento verano" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Tipo de descuento *</Label>
                <Select value={form.discountType} onValueChange={(v: any) => setForm(f => ({ ...f, discountType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">% Porcentaje</SelectItem>
                    <SelectItem value="fixed">$ Monto fijo</SelectItem>
                    <SelectItem value="free_shipping">🚚 Envío gratuito</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.discountType !== 'free_shipping' && (
                <div className="space-y-1">
                  <Label>Valor del descuento *</Label>
                  <Input type="number" min={0} max={form.discountType === 'percentage' ? 100 : undefined}
                    placeholder={form.discountType === 'percentage' ? 'Ej: 10 (= 10%)' : 'Ej: 5000 ($5.000)'}
                    value={form.discountValue || ''} onChange={e => setForm(f => ({ ...f, discountValue: Number(e.target.value) }))} required />
                </div>
              )}
              <div className="space-y-1">
                <Label>Aplica a *</Label>
                <Select value={form.appliesTo} onValueChange={(v: any) => setForm(f => ({ ...f, appliesTo: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cart">Todo el carrito</SelectItem>
                    <SelectItem value="product">Producto específico</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.appliesTo === 'product' && (
                <div className="space-y-1">
                  <Label>SKU del producto *</Label>
                  <Input placeholder="Ej: PCA960COPPBL1" value={form.productSku} onChange={e => setForm(f => ({ ...f, productSku: e.target.value.toUpperCase() }))} required={form.appliesTo === 'product'} />
                  <p className="text-xs text-muted-foreground">El descuento solo aplica si este SKU está en el carrito.</p>
                </div>
              )}
              <div className="space-y-1">
                <Label>Monto mínimo del carrito ($)</Label>
                <Input type="number" min={0} placeholder="0 = sin mínimo" value={form.minOrderAmount || ''} onChange={e => setForm(f => ({ ...f, minOrderAmount: Number(e.target.value) }))} />
              </div>
              <div className="space-y-1">
                <Label>Usos máximos</Label>
                <Input type="number" min={1} placeholder="Vacío = ilimitado" value={form.maxUses} onChange={e => setForm(f => ({ ...f, maxUses: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Fecha de vencimiento</Label>
                <Input type="date" value={form.expiresAt} onChange={e => setForm(f => ({ ...f, expiresAt: e.target.value }))} />
              </div>
              <div className="flex items-center gap-2 mt-2">
                <input type="checkbox" id="couponIsActive" checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} className="h-4 w-4" />
                <Label htmlFor="couponIsActive">Cupón activo</Label>
              </div>
              <div className="md:col-span-2 flex gap-2 justify-end pt-2">
                <Button type="button" variant="outline" onClick={resetForm}>Cancelar</Button>
                <Button type="submit">{editingCoupon ? 'Guardar cambios' : 'Crear cupón'}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Cargando cupones...</div>
          ) : coupons.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No hay cupones creados aún.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-900 border-b">
                  <tr>
                    <th className="text-left p-3 font-semibold">Código</th>
                    <th className="text-left p-3 font-semibold">Tipo</th>
                    <th className="text-left p-3 font-semibold">Valor</th>
                    <th className="text-left p-3 font-semibold">Aplica a</th>
                    <th className="text-left p-3 font-semibold">Usos</th>
                    <th className="text-left p-3 font-semibold">Estado</th>
                    <th className="text-left p-3 font-semibold">Vence</th>
                    <th className="text-right p-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {coupons.map((coupon: any) => (
                    <tr key={coupon.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="p-3 font-mono font-bold text-orange-600">{coupon.code}</td>
                      <td className="p-3">{discountTypeLabel(coupon.discountType)}</td>
                      <td className="p-3">
                        {coupon.discountType === 'free_shipping' ? '—' :
                          coupon.discountType === 'percentage' ? `${coupon.discountValue}%` :
                          `$${Number(coupon.discountValue).toLocaleString('es-CL')}`}
                      </td>
                      <td className="p-3">
                        {coupon.appliesTo === 'product' && coupon.productSku
                          ? <span>SKU: <span className="font-mono text-xs bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">{coupon.productSku}</span></span>
                          : 'Carrito completo'}
                      </td>
                      <td className="p-3">
                        {coupon.timesUsed}{coupon.maxUses ? `/${coupon.maxUses}` : ''}
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${coupon.isActive ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'}`}>
                          {coupon.isActive ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="p-3 text-xs text-muted-foreground">
                        {coupon.expiresAt ? new Date(coupon.expiresAt).toLocaleDateString('es-CL') : 'Sin vencimiento'}
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex gap-1 justify-end">
                          <Button size="sm" variant="ghost" onClick={() => handleEdit(coupon)}>Editar</Button>
                          <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-700" onClick={() => handleDelete(coupon.id, coupon.code)}>Eliminar</Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
