import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { Search, Plus, Trash2, ArrowLeft, FileText, Download, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { PriceList, Client } from "@shared/schema";
import { Document, Page, Text, View, StyleSheet, pdf, Image } from '@react-pdf/renderer';

type ProductCategory = "base" | "accesorios" | "terminacion";

interface AdvancedQuoteItem {
  id: string;
  productId?: number;
  codigo: string;
  producto: string;
  descripcion: string;
  formatoProducto: string;
  valorUnitario: number;
  valorConDescuento: number;
  cantidadPorFormato: number;
  unidadMedida: string;
  consumoEstimado: number;
  rendimiento: number;
  costoPorUnidad: number;
  unidadesNecesarias: number;
  valorFinal: number;
  category: ProductCategory;
  superficieACubrir: number;
}

interface QuoteClient {
  id?: number;
  nombre: string;
  rut: string;
  direccion: string;
  telefono: string;
  email: string;
}

const CATEGORY_LABELS: Record<ProductCategory, string> = {
  base: "Productos Base del Sistema",
  accesorios: "Accesorios de Refuerzo",
  terminacion: "Productos de Terminación",
};

const INITIAL_ITEM: Omit<AdvancedQuoteItem, "id" | "category"> = {
  productId: undefined,
  codigo: "",
  producto: "",
  descripcion: "",
  formatoProducto: "",
  valorUnitario: 0,
  valorConDescuento: 0,
  cantidadPorFormato: 0,
  unidadMedida: "m²",
  consumoEstimado: 0,
  rendimiento: 0,
  costoPorUnidad: 0,
  unidadesNecesarias: 0,
  valorFinal: 0,
  superficieACubrir: 0,
};

const pdfStyles = StyleSheet.create({
  page: { padding: 30, fontSize: 8, fontFamily: 'Helvetica', color: '#333' },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15, paddingBottom: 10, borderBottom: '2 solid #fd6301' },
  logo: { width: 100, height: 40 },
  headerRight: { alignItems: 'flex-end' },
  title: { fontSize: 16, fontWeight: 'bold', color: '#fd6301', marginBottom: 4 },
  subtitle: { fontSize: 9, color: '#666' },
  section: { marginBottom: 12 },
  sectionTitle: { fontSize: 10, fontWeight: 'bold', color: '#333', marginBottom: 6, paddingBottom: 3, borderBottom: '1 solid #e5e7eb' },
  clientGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  clientField: { width: '50%', marginBottom: 4 },
  fieldLabel: { fontSize: 7, color: '#666' },
  fieldValue: { fontSize: 8, color: '#333', fontWeight: 'bold' },
  categoryHeader: { backgroundColor: '#f3f4f6', padding: 6, marginTop: 8, marginBottom: 4 },
  categoryTitle: { fontSize: 9, fontWeight: 'bold', color: '#374151' },
  table: { marginTop: 4 },
  tableHeader: { flexDirection: 'row', backgroundColor: '#f9fafb', borderBottom: '1 solid #d1d5db', paddingVertical: 4, paddingHorizontal: 2 },
  tableHeaderText: { fontSize: 7, fontWeight: 'bold', color: '#374151' },
  tableRow: { flexDirection: 'row', borderBottom: '1 solid #e5e7eb', paddingVertical: 4, paddingHorizontal: 2 },
  col1: { width: '8%' },
  col2: { width: '22%' },
  col3: { width: '8%', textAlign: 'center' },
  col4: { width: '10%', textAlign: 'right' },
  col5: { width: '10%', textAlign: 'right' },
  col6: { width: '8%', textAlign: 'right' },
  col7: { width: '8%', textAlign: 'center' },
  col8: { width: '8%', textAlign: 'right' },
  col9: { width: '8%', textAlign: 'right' },
  col10: { width: '10%', textAlign: 'right' },
  cellText: { fontSize: 7, color: '#333' },
  cellTextBold: { fontSize: 7, color: '#333', fontWeight: 'bold' },
  categoryTotalRow: { flexDirection: 'row', backgroundColor: '#fef3e2', paddingVertical: 4, paddingHorizontal: 2, marginTop: 2 },
  totalsSection: { marginTop: 15, marginLeft: 'auto', width: 200, paddingTop: 8, borderTop: '1 solid #d1d5db' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  totalLabel: { fontSize: 8, color: '#4b5563' },
  totalValue: { fontSize: 8, fontWeight: 'bold', color: '#111827' },
  grandTotalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, marginTop: 4, backgroundColor: '#fef3e2', borderRadius: 3, paddingHorizontal: 6 },
  grandTotalLabel: { fontSize: 10, fontWeight: 'bold', color: '#fd6301' },
  grandTotalValue: { fontSize: 11, fontWeight: 'bold', color: '#fd6301' },
  notesSection: { marginTop: 12, padding: 8, backgroundColor: '#f9fafb', borderRadius: 4 },
  notesTitle: { fontSize: 8, fontWeight: 'bold', marginBottom: 4 },
  notesText: { fontSize: 7, color: '#4b5563' },
  footer: { position: 'absolute', bottom: 20, left: 30, right: 30, textAlign: 'center', fontSize: 6, color: '#9ca3af', paddingTop: 6, borderTop: '1 solid #e5e7eb' },
});

interface PDFProps {
  projectName: string;
  projectM2: number;
  client: QuoteClient;
  items: AdvancedQuoteItem[];
  categoryTotals: Record<ProductCategory, { m2: number; amount: number }>;
  grandTotal: { subtotal: number; iva: number; total: number };
  notes: string;
}

const AdvancedQuotePDF = ({ projectName, projectM2, client, items, categoryTotals, grandTotal, notes }: PDFProps) => {
  const formatCurrency = (value: number) => `$${value.toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  const formatDate = () => {
    const date = new Date();
    return `${date.getDate()} de ${date.toLocaleDateString('es-CL', { month: 'long' })} de ${date.getFullYear()}`;
  };

  const itemsByCategory: Record<ProductCategory, AdvancedQuoteItem[]> = { base: [], accesorios: [], terminacion: [] };
  items.forEach((item) => { itemsByCategory[item.category].push(item); });

  return (
    <Document>
      <Page size="A4" style={pdfStyles.page}>
        <View style={pdfStyles.header}>
          <Image src="/panoramica-30-logo.webp" style={pdfStyles.logo} />
          <View style={pdfStyles.headerRight}>
            <Text style={pdfStyles.title}>PRESUPUESTO DETALLADO</Text>
            <Text style={pdfStyles.subtitle}>Fecha: {formatDate()}</Text>
            <Text style={pdfStyles.subtitle}>{projectName || 'Sin nombre de proyecto'}</Text>
          </View>
        </View>

        <View style={pdfStyles.section}>
          <Text style={pdfStyles.sectionTitle}>Información del Cliente</Text>
          <View style={pdfStyles.clientGrid}>
            <View style={pdfStyles.clientField}>
              <Text style={pdfStyles.fieldLabel}>Cliente:</Text>
              <Text style={pdfStyles.fieldValue}>{client.nombre || 'Sin especificar'}</Text>
            </View>
            <View style={pdfStyles.clientField}>
              <Text style={pdfStyles.fieldLabel}>RUT:</Text>
              <Text style={pdfStyles.fieldValue}>{client.rut || 'Sin especificar'}</Text>
            </View>
            <View style={pdfStyles.clientField}>
              <Text style={pdfStyles.fieldLabel}>Dirección:</Text>
              <Text style={pdfStyles.fieldValue}>{client.direccion || 'Sin especificar'}</Text>
            </View>
            <View style={pdfStyles.clientField}>
              <Text style={pdfStyles.fieldLabel}>Superficie Total:</Text>
              <Text style={pdfStyles.fieldValue}>{projectM2 ? `${projectM2} m²` : 'Sin especificar'}</Text>
            </View>
          </View>
        </View>

        {(['base', 'accesorios', 'terminacion'] as ProductCategory[]).map((category) => {
          const catItems = itemsByCategory[category];
          if (catItems.length === 0) return null;
          return (
            <View key={category} style={pdfStyles.section} wrap={false}>
              <View style={pdfStyles.categoryHeader}>
                <Text style={pdfStyles.categoryTitle}>{CATEGORY_LABELS[category]}</Text>
              </View>
              <View style={pdfStyles.table}>
                <View style={pdfStyles.tableHeader}>
                  <Text style={[pdfStyles.tableHeaderText, pdfStyles.col1]}>Código</Text>
                  <Text style={[pdfStyles.tableHeaderText, pdfStyles.col2]}>Producto</Text>
                  <Text style={[pdfStyles.tableHeaderText, pdfStyles.col3]}>Formato</Text>
                  <Text style={[pdfStyles.tableHeaderText, pdfStyles.col4]}>V. Desc.</Text>
                  <Text style={[pdfStyles.tableHeaderText, pdfStyles.col5]}>Cant.</Text>
                  <Text style={[pdfStyles.tableHeaderText, pdfStyles.col6]}>Consumo</Text>
                  <Text style={[pdfStyles.tableHeaderText, pdfStyles.col7]}>Rend.</Text>
                  <Text style={[pdfStyles.tableHeaderText, pdfStyles.col8]}>Costo/U</Text>
                  <Text style={[pdfStyles.tableHeaderText, pdfStyles.col9]}>Unid.</Text>
                  <Text style={[pdfStyles.tableHeaderText, pdfStyles.col10]}>Total</Text>
                </View>
                {catItems.map((item, idx) => (
                  <View key={idx} style={pdfStyles.tableRow}>
                    <Text style={[pdfStyles.cellText, pdfStyles.col1]}>{item.codigo}</Text>
                    <Text style={[pdfStyles.cellText, pdfStyles.col2]}>{item.producto}</Text>
                    <Text style={[pdfStyles.cellText, pdfStyles.col3]}>{item.formatoProducto}</Text>
                    <Text style={[pdfStyles.cellText, pdfStyles.col4]}>{formatCurrency(item.valorConDescuento)}</Text>
                    <Text style={[pdfStyles.cellText, pdfStyles.col5]}>{item.cantidadPorFormato}</Text>
                    <Text style={[pdfStyles.cellText, pdfStyles.col6]}>{item.consumoEstimado}</Text>
                    <Text style={[pdfStyles.cellText, pdfStyles.col7]}>{item.rendimiento.toFixed(2)}</Text>
                    <Text style={[pdfStyles.cellText, pdfStyles.col8]}>{formatCurrency(item.costoPorUnidad)}</Text>
                    <Text style={[pdfStyles.cellText, pdfStyles.col9]}>{item.unidadesNecesarias}</Text>
                    <Text style={[pdfStyles.cellTextBold, pdfStyles.col10]}>{formatCurrency(item.valorFinal)}</Text>
                  </View>
                ))}
                <View style={pdfStyles.categoryTotalRow}>
                  <Text style={[pdfStyles.cellTextBold, { width: '90%' }]}>Subtotal {CATEGORY_LABELS[category]}</Text>
                  <Text style={[pdfStyles.cellTextBold, pdfStyles.col10]}>{formatCurrency(categoryTotals[category].amount)}</Text>
                </View>
              </View>
            </View>
          );
        })}

        <View style={pdfStyles.totalsSection}>
          <View style={pdfStyles.totalRow}>
            <Text style={pdfStyles.totalLabel}>Subtotal Neto:</Text>
            <Text style={pdfStyles.totalValue}>{formatCurrency(grandTotal.subtotal)}</Text>
          </View>
          <View style={pdfStyles.totalRow}>
            <Text style={pdfStyles.totalLabel}>IVA (19%):</Text>
            <Text style={pdfStyles.totalValue}>{formatCurrency(grandTotal.iva)}</Text>
          </View>
          <View style={pdfStyles.grandTotalRow}>
            <Text style={pdfStyles.grandTotalLabel}>TOTAL:</Text>
            <Text style={pdfStyles.grandTotalValue}>{formatCurrency(grandTotal.total)}</Text>
          </View>
        </View>

        {notes && (
          <View style={pdfStyles.notesSection}>
            <Text style={pdfStyles.notesTitle}>Observaciones:</Text>
            <Text style={pdfStyles.notesText}>{notes}</Text>
          </View>
        )}

        <Text style={pdfStyles.footer}>
          Pinturas Panoramica - Cotización generada el {new Date().toLocaleDateString('es-CL')}
        </Text>
      </Page>
    </Document>
  );
};

export default function PresupuestosAvanzados() {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  
  const [projectName, setProjectName] = useState("");
  const [projectM2, setProjectM2] = useState<number>(0);
  const [notes, setNotes] = useState("");
  const [client, setClient] = useState<QuoteClient>({
    nombre: "",
    rut: "",
    direccion: "",
    telefono: "",
    email: "",
  });
  
  const [items, setItems] = useState<AdvancedQuoteItem[]>([]);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory>("base");
  const [productSearch, setProductSearch] = useState("");
  const [showClientSearch, setShowClientSearch] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [showSurfaceDialog, setShowSurfaceDialog] = useState(false);
  const [pendingProduct, setPendingProduct] = useState<PriceList | null>(null);
  const [surfaceInput, setSurfaceInput] = useState<number>(0);
  const [surfaceUnit, setSurfaceUnit] = useState<string>("m²");

  const { data: priceListData } = useQuery<{ items: PriceList[] }>({
    queryKey: ["/api/price-list", { limit: 10000 }],
    queryFn: async () => {
      const response = await fetch('/api/price-list?limit=10000', { credentials: 'include' });
      if (!response.ok) return { items: [] };
      return response.json();
    },
  });
  
  const priceList = priceListData?.items || [];

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const filteredProducts = useMemo(() => {
    const products = Array.isArray(priceList) ? priceList : [];
    if (!productSearch.trim()) return products.slice(0, 20);
    const search = productSearch.toLowerCase();
    return products.filter(
      (p) =>
        p.producto?.toLowerCase().includes(search) ||
        p.codigo?.toLowerCase().includes(search)
    ).slice(0, 20);
  }, [priceList, productSearch]);

  const filteredClients = useMemo(() => {
    const clientList = Array.isArray(clients) ? clients : [];
    if (!clientSearch.trim()) return clientList.slice(0, 10);
    const search = clientSearch.toLowerCase();
    return clientList.filter(
      (c) =>
        c.name?.toLowerCase().includes(search) ||
        c.rut?.toLowerCase().includes(search) ||
        c.code?.toLowerCase().includes(search)
    ).slice(0, 10);
  }, [clients, clientSearch]);

  const itemsByCategory = useMemo(() => {
    const grouped: Record<ProductCategory, AdvancedQuoteItem[]> = {
      base: [],
      accesorios: [],
      terminacion: [],
    };
    items.forEach((item) => {
      grouped[item.category].push(item);
    });
    return grouped;
  }, [items]);

  const categoryTotals = useMemo(() => {
    const totals: Record<ProductCategory, { m2: number; amount: number }> = {
      base: { m2: 0, amount: 0 },
      accesorios: { m2: 0, amount: 0 },
      terminacion: { m2: 0, amount: 0 },
    };
    items.forEach((item) => {
      totals[item.category].m2 += item.costoPorUnidad;
      totals[item.category].amount += item.valorFinal;
    });
    return totals;
  }, [items]);

  const grandTotal = useMemo(() => {
    const subtotal = items.reduce((sum, item) => sum + item.valorFinal, 0);
    const iva = subtotal * 0.19;
    return { subtotal, iva, total: subtotal + iva };
  }, [items]);

  const calculateItem = (item: Partial<AdvancedQuoteItem>, m2Total: number): Partial<AdvancedQuoteItem> => {
    const valorConDescuento = item.valorConDescuento || item.valorUnitario || 0;
    const cantidadPorFormato = item.cantidadPorFormato || 1;
    const consumoEstimado = item.consumoEstimado || 0;
    
    let rendimiento = 0;
    let costoPorUnidad = 0;
    let unidadesNecesarias = 0;
    let valorFinal = 0;

    if (cantidadPorFormato > 0 && consumoEstimado > 0) {
      rendimiento = cantidadPorFormato / consumoEstimado;
      costoPorUnidad = valorConDescuento / rendimiento;
      unidadesNecesarias = Math.ceil(m2Total / rendimiento);
      valorFinal = unidadesNecesarias * valorConDescuento;
    }

    return {
      ...item,
      rendimiento: Math.round(rendimiento * 100) / 100,
      costoPorUnidad: Math.round(costoPorUnidad),
      unidadesNecesarias,
      valorFinal,
    };
  };

  const openSurfaceDialog = (product: PriceList) => {
    setPendingProduct(product);
    setSurfaceInput(projectM2 || 0);
    setSurfaceUnit((product as any).unidadMedida || "m²");
    setShowSurfaceDialog(true);
  };

  const confirmAddProduct = () => {
    if (!pendingProduct) return;
    
    const product = pendingProduct;
    const surfaceToUse = surfaceInput || projectM2;
    
    const newItem: AdvancedQuoteItem = {
      id: `item-${Date.now()}`,
      productId: product.id,
      codigo: product.codigo || "",
      producto: product.producto || "",
      descripcion: "",
      formatoProducto: product.unidad || "",
      valorUnitario: parseFloat(product.lista?.toString() || "0"),
      valorConDescuento: parseFloat(product.desc10?.toString() || product.lista?.toString() || "0"),
      cantidadPorFormato: (product as any).cantidadProducto || 0,
      unidadMedida: surfaceUnit,
      consumoEstimado: (product as any).consumoEstimado || 0,
      rendimiento: (product as any).rendimiento || 0,
      costoPorUnidad: (product as any).costoUnidadMedida || 0,
      unidadesNecesarias: 0,
      valorFinal: 0,
      category: selectedCategory,
      superficieACubrir: surfaceToUse,
    };

    const calculated = calculateItem(newItem, surfaceToUse);
    setItems([...items, { ...newItem, ...calculated } as AdvancedQuoteItem]);
    setShowSurfaceDialog(false);
    setShowAddProduct(false);
    setProductSearch("");
    setPendingProduct(null);
    setSurfaceInput(0);
  };

  const addCustomProduct = () => {
    const newItem: AdvancedQuoteItem = {
      id: `item-${Date.now()}`,
      ...INITIAL_ITEM,
      category: selectedCategory,
    };
    setItems([...items, newItem]);
    setShowAddProduct(false);
  };

  const updateItem = (id: string, updates: Partial<AdvancedQuoteItem>) => {
    setItems(
      items.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, ...updates };
        const calculated = calculateItem(updated, projectM2);
        return { ...updated, ...calculated } as AdvancedQuoteItem;
      })
    );
  };

  const removeItem = (id: string) => {
    setItems(items.filter((item) => item.id !== id));
  };

  const recalculateAll = (m2: number) => {
    setItems(
      items.map((item) => {
        const calculated = calculateItem(item, m2);
        return { ...item, ...calculated } as AdvancedQuoteItem;
      })
    );
  };

  const selectClient = (c: Client) => {
    setClient({
      id: c.id,
      nombre: c.name || "",
      rut: c.rut || "",
      direccion: c.address || "",
      telefono: c.phone || "",
      email: c.email || "",
    });
    setShowClientSearch(false);
    setClientSearch("");
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const handleDownloadPdf = async () => {
    setIsGeneratingPdf(true);
    try {
      const pdfDoc = (
        <AdvancedQuotePDF
          projectName={projectName}
          projectM2={projectM2}
          client={client}
          items={items}
          categoryTotals={categoryTotals}
          grandTotal={grandTotal}
          notes={notes}
        />
      );
      const blob = await pdf(pdfDoc).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Presupuesto_${projectName || 'detallado'}_${new Date().toLocaleDateString('es-CL').replace(/\//g, '-')}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast({ title: "PDF descargado", description: "El presupuesto se ha descargado correctamente." });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({ variant: "destructive", title: "Error", description: "No se pudo generar el PDF." });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const renderCategoryTable = (category: ProductCategory) => {
    const categoryItems = itemsByCategory[category];
    if (categoryItems.length === 0) return null;

    return (
      <div key={category} className="mb-6 print:break-inside-avoid">
        <div className="bg-gray-100 dark:bg-gray-800 px-3 py-2 font-semibold text-sm border-b">
          {CATEGORY_LABELS[category]}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-gray-50 dark:bg-gray-900">
                <th className="px-2 py-1 text-left w-16">Código</th>
                <th className="px-2 py-1 text-left">Producto</th>
                <th className="px-2 py-1 text-center w-16">Formato</th>
                <th className="px-2 py-1 text-right w-20">Valor Unit.</th>
                <th className="px-2 py-1 text-right w-20">V. Desc.</th>
                <th className="px-2 py-1 text-right w-16">Cant.</th>
                <th className="px-2 py-1 text-center w-12">Unid.</th>
                <th className="px-2 py-1 text-right w-16">Consumo</th>
                <th className="px-2 py-1 text-right w-16">Rend.</th>
                <th className="px-2 py-1 text-right w-20">Costo/U</th>
                <th className="px-2 py-1 text-right w-16">Unid. Nec.</th>
                <th className="px-2 py-1 text-right w-24">Valor Final</th>
                <th className="px-2 py-1 w-8 print:hidden"></th>
              </tr>
            </thead>
            <tbody>
              {categoryItems.map((item) => (
                <tr key={item.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-2 py-1">
                    <Input
                      value={item.codigo}
                      onChange={(e) => updateItem(item.id, { codigo: e.target.value })}
                      className="h-7 text-xs w-full"
                      data-testid={`input-codigo-${item.id}`}
                    />
                  </td>
                  <td className="px-2 py-1">
                    <div>
                      <Input
                        value={item.producto}
                        onChange={(e) => updateItem(item.id, { producto: e.target.value })}
                        className="h-7 text-xs w-full mb-1"
                        data-testid={`input-producto-${item.id}`}
                      />
                      <Input
                        value={item.descripcion}
                        onChange={(e) => updateItem(item.id, { descripcion: e.target.value })}
                        placeholder="Descripción"
                        className="h-6 text-xs w-full text-muted-foreground"
                        data-testid={`input-descripcion-${item.id}`}
                      />
                    </div>
                  </td>
                  <td className="px-2 py-1">
                    <Input
                      value={item.formatoProducto}
                      onChange={(e) => updateItem(item.id, { formatoProducto: e.target.value })}
                      className="h-7 text-xs text-center w-full"
                      data-testid={`input-formato-${item.id}`}
                    />
                  </td>
                  <td className="px-2 py-1">
                    <Input
                      type="number"
                      value={item.valorUnitario || ""}
                      onChange={(e) => updateItem(item.id, { valorUnitario: parseFloat(e.target.value) || 0 })}
                      className="h-7 text-xs text-right w-full"
                      data-testid={`input-valor-unit-${item.id}`}
                    />
                  </td>
                  <td className="px-2 py-1">
                    <Input
                      type="number"
                      value={item.valorConDescuento || ""}
                      onChange={(e) => updateItem(item.id, { valorConDescuento: parseFloat(e.target.value) || 0 })}
                      className="h-7 text-xs text-right w-full"
                      data-testid={`input-valor-desc-${item.id}`}
                    />
                  </td>
                  <td className="px-2 py-1">
                    <Input
                      type="number"
                      step="0.01"
                      value={item.cantidadPorFormato || ""}
                      onChange={(e) => updateItem(item.id, { cantidadPorFormato: parseFloat(e.target.value) || 0 })}
                      className="h-7 text-xs text-right w-full"
                      data-testid={`input-cantidad-${item.id}`}
                    />
                  </td>
                  <td className="px-2 py-1">
                    <Input
                      value={item.unidadMedida}
                      onChange={(e) => updateItem(item.id, { unidadMedida: e.target.value })}
                      className="h-7 text-xs text-center w-full"
                      data-testid={`input-unidad-${item.id}`}
                    />
                  </td>
                  <td className="px-2 py-1">
                    <Input
                      type="number"
                      step="0.01"
                      value={item.consumoEstimado || ""}
                      onChange={(e) => updateItem(item.id, { consumoEstimado: parseFloat(e.target.value) || 0 })}
                      className="h-7 text-xs text-right w-full"
                      data-testid={`input-consumo-${item.id}`}
                    />
                  </td>
                  <td className="px-2 py-1 text-right text-xs">
                    {item.rendimiento.toFixed(1)}
                  </td>
                  <td className="px-2 py-1 text-right text-xs">
                    {formatCurrency(item.costoPorUnidad)}
                  </td>
                  <td className="px-2 py-1 text-right text-xs font-medium">
                    {item.unidadesNecesarias}
                  </td>
                  <td className="px-2 py-1 text-right text-xs font-semibold">
                    {formatCurrency(item.valorFinal)}
                  </td>
                  <td className="px-2 py-1 print:hidden">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeItem(item.id)}
                      className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                      data-testid={`button-remove-${item.id}`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-100 dark:bg-gray-800 font-semibold">
                <td colSpan={9} className="px-2 py-1 text-right text-xs">
                  Sub Total {itemsByCategory[category][0]?.unidadMedida || "m²"}
                </td>
                <td className="px-2 py-1 text-right text-xs">
                  {formatCurrency(categoryTotals[category].m2)}
                </td>
                <td className="px-2 py-1 text-right text-xs">Sub total</td>
                <td className="px-2 py-1 text-right text-xs">
                  {formatCurrency(categoryTotals[category].amount)}
                </td>
                <td className="print:hidden"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className={`${isMobile ? "px-4 py-6" : "px-6 py-6 m-4"}`}>
      <div className="space-y-6">
        <div className="flex items-center justify-between print:hidden">
          <div className="flex items-center gap-4">
            <Link href="/tomador-pedidos">
              <Button variant="ghost" size="sm" data-testid="button-back">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Volver
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-semibold">Presupuestos Avanzados</h1>
              <p className="text-muted-foreground text-sm">
                Cotizaciones detalladas con rendimientos y cálculos por m²
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleDownloadPdf} disabled={isGeneratingPdf} data-testid="button-download-pdf">
              {isGeneratingPdf ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
              {isGeneratingPdf ? 'Generando...' : 'Descargar PDF'}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 print:hidden">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Datos del Proyecto</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs">Nombre del Proyecto</Label>
                <Input
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="Ej: Edificio Central"
                  data-testid="input-project-name"
                />
              </div>
              <div>
                <Label className="text-xs">M² Totales del Proyecto</Label>
                <Input
                  type="number"
                  value={projectM2 || ""}
                  onChange={(e) => {
                    const m2 = parseFloat(e.target.value) || 0;
                    setProjectM2(m2);
                    recalculateAll(m2);
                  }}
                  placeholder="Ej: 1500"
                  data-testid="input-project-m2"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Datos del Cliente</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowClientSearch(true)}
                  data-testid="button-search-client"
                >
                  <Search className="h-3 w-3 mr-1" />
                  Buscar
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <Input
                value={client.nombre}
                onChange={(e) => setClient({ ...client, nombre: e.target.value })}
                placeholder="Nombre"
                className="h-8 text-sm"
                data-testid="input-client-name"
              />
              <div className="grid grid-cols-2 gap-2">
                <Input
                  value={client.rut}
                  onChange={(e) => setClient({ ...client, rut: e.target.value })}
                  placeholder="RUT"
                  className="h-8 text-sm"
                  data-testid="input-client-rut"
                />
                <Input
                  value={client.telefono}
                  onChange={(e) => setClient({ ...client, telefono: e.target.value })}
                  placeholder="Teléfono"
                  className="h-8 text-sm"
                  data-testid="input-client-phone"
                />
              </div>
              <Input
                value={client.direccion}
                onChange={(e) => setClient({ ...client, direccion: e.target.value })}
                placeholder="Dirección"
                className="h-8 text-sm"
                data-testid="input-client-address"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Agregar Productos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Select
                value={selectedCategory}
                onValueChange={(v) => setSelectedCategory(v as ProductCategory)}
              >
                <SelectTrigger data-testid="select-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="base">Productos Base del Sistema</SelectItem>
                  <SelectItem value="accesorios">Accesorios de Refuerzo</SelectItem>
                  <SelectItem value="terminacion">Productos de Terminación</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  onClick={() => setShowAddProduct(true)}
                  data-testid="button-add-from-catalog"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Del Catálogo
                </Button>
                <Button
                  variant="outline"
                  onClick={addCustomProduct}
                  data-testid="button-add-custom"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Manual
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="print:shadow-none print:border-0">
          <CardHeader className="print:pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  {projectName || "Presupuesto Detallado"}
                </CardTitle>
                {client.nombre && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Cliente: {client.nombre} | {projectM2} m²
                  </p>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {items.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No hay productos agregados</p>
                <p className="text-sm">Usa los botones de arriba para agregar productos</p>
              </div>
            ) : (
              <>
                {renderCategoryTable("base")}
                {renderCategoryTable("accesorios")}
                {renderCategoryTable("terminacion")}

                <div className="mt-6 flex justify-end">
                  <div className="w-64 space-y-1 text-sm">
                    <div className="flex justify-between py-1 border-b">
                      <span>Subtotal</span>
                      <span className="font-medium">{formatCurrency(grandTotal.subtotal)}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b">
                      <span>IVA (19%)</span>
                      <span className="font-medium">{formatCurrency(grandTotal.iva)}</span>
                    </div>
                    <div className="flex justify-between py-2 text-base font-bold">
                      <span>Total</span>
                      <span>{formatCurrency(grandTotal.total)}</span>
                    </div>
                  </div>
                </div>

                {notes && (
                  <div className="mt-6 border-t pt-4">
                    <h4 className="font-semibold text-sm mb-2">Notas Importantes</h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{notes}</p>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card className="print:hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Notas Importantes</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej: Para obtener un rendimiento adecuado de los materiales, se requiere una superficie aplomada (5 mm por cada 2.5 ml)."
              rows={3}
              data-testid="input-notes"
            />
          </CardContent>
        </Card>
      </div>

      <Dialog open={showAddProduct} onOpenChange={setShowAddProduct}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Agregar Producto del Catálogo</DialogTitle>
            <DialogDescription>
              Categoría: {CATEGORY_LABELS[selectedCategory]}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Buscar por código o nombre..."
                className="pl-9"
                data-testid="input-product-search"
              />
            </div>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredProducts.map((product) => (
                <div
                  key={product.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted cursor-pointer"
                  onClick={() => openSurfaceDialog(product)}
                  data-testid={`product-item-${product.id}`}
                >
                  <div>
                    <div className="font-medium text-sm">{product.producto}</div>
                    <div className="text-xs text-muted-foreground">
                      {product.codigo} | {product.unidad}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-sm">
                      {formatCurrency(parseFloat(product.lista?.toString() || "0"))}
                    </div>
                    {product.desc10 && (
                      <div className="text-xs text-green-600">
                        -10%: {formatCurrency(parseFloat(product.desc10.toString()))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showClientSearch} onOpenChange={setShowClientSearch}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Buscar Cliente</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                placeholder="Buscar por nombre o RUT..."
                className="pl-9"
                data-testid="input-client-search"
              />
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {filteredClients.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted cursor-pointer"
                  onClick={() => selectClient(c)}
                  data-testid={`client-item-${c.id}`}
                >
                  <div>
                    <div className="font-medium text-sm">{c.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {c.rut} | {c.phone}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showSurfaceDialog} onOpenChange={setShowSurfaceDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Superficie a Cubrir</DialogTitle>
            <DialogDescription>
              {pendingProduct?.producto}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <Label className="text-sm font-medium">Superficie necesaria</Label>
                <Input
                  type="number"
                  value={surfaceInput}
                  onChange={(e) => setSurfaceInput(parseFloat(e.target.value) || 0)}
                  placeholder="Ej: 30"
                  className="mt-1"
                  data-testid="input-surface"
                />
              </div>
              <div className="w-24">
                <Label className="text-sm font-medium">Unidad</Label>
                <div className="mt-1 h-10 px-3 flex items-center border rounded-md bg-muted text-sm font-medium">
                  {surfaceUnit || "m²"}
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Opcional: ingresa la superficie que necesitas cubrir para calcular automáticamente.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSurfaceDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={confirmAddProduct} data-testid="button-confirm-add">
              Agregar Producto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
