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
import { Search, Plus, Trash2, ArrowLeft, FileText, Download, Printer } from "lucide-react";
import { Link } from "wouter";
import { PriceList, Client } from "@shared/schema";

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

  const { data: priceList = [] } = useQuery<PriceList[]>({
    queryKey: ["/api/lista-precios"],
  });

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

  const addProductFromCatalog = (product: PriceList) => {
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
      unidadMedida: (product as any).unidadMedida || "m²",
      consumoEstimado: (product as any).consumoEstimado || 0,
      rendimiento: (product as any).rendimiento || 0,
      costoPorUnidad: (product as any).costoUnidadMedida || 0,
      unidadesNecesarias: 0,
      valorFinal: 0,
      category: selectedCategory,
    };

    const calculated = calculateItem(newItem, projectM2);
    setItems([...items, { ...newItem, ...calculated } as AdvancedQuoteItem]);
    setShowAddProduct(false);
    setProductSearch("");
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

  const handlePrint = () => {
    window.print();
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
            <Button variant="outline" onClick={handlePrint} data-testid="button-print">
              <Printer className="h-4 w-4 mr-2" />
              Imprimir
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
                  onClick={() => addProductFromCatalog(product)}
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
    </div>
  );
}
