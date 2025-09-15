import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Search, Plus, ShoppingCart, Users, FileText, Trash2, Save, Calculator } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import type { PriceList, Client, Quote } from "@shared/schema";

// Types for cart management
interface CartItem {
  id: string;
  type: "standard" | "custom";
  productName: string;
  productCode?: string;
  customSku?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  costOfProduction?: number;
  profitMargin?: number;
  pricingMode?: "calculated" | "direct";
}

interface QuoteFormData {
  clientName: string;
  clientId?: string;
  clientRut?: string;
  clientEmail?: string;
  clientPhone?: string;
  clientAddress?: string;
  validUntil?: string;
  notes?: string;
}

const INITIAL_QUOTE_FORM: QuoteFormData = {
  clientName: "",
  clientId: undefined,
  clientRut: "",
  clientEmail: "",
  clientPhone: "",
  clientAddress: "",
  validUntil: "",
  notes: "",
};

export default function ConstructorPresupuesto() {
  const [searchTerm, setSearchTerm] = useState("");
  const [clientSearchTerm, setClientSearchTerm] = useState("");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [quoteForm, setQuoteForm] = useState<QuoteFormData>(INITIAL_QUOTE_FORM);
  const [activeTab, setActiveTab] = useState<"products" | "clients" | "quote">("products");
  const { toast } = useToast();

  // Fetch price list for product search
  const { data: priceList = [], isLoading: priceListLoading } = useQuery({
    queryKey: ["/api/price-list", { search: searchTerm, limit: 50 }],
    enabled: searchTerm.length >= 2,
  });

  // Fetch clients for client search
  const { data: clients = [], isLoading: clientsLoading } = useQuery({
    queryKey: ["/api/clients", { search: clientSearchTerm, limit: 20 }],
    enabled: clientSearchTerm.length >= 2,
  });

  // Calculate totals
  const subtotal = cart.reduce((sum, item) => sum + item.totalPrice, 0);
  const tax = subtotal * 0.19; // 19% IVA
  const total = subtotal + tax;

  // Add product to cart from price list
  const addProductToCart = (product: PriceList) => {
    const existingItem = cart.find(item => 
      item.type === "standard" && item.productCode === product.codigo
    );

    if (existingItem) {
      updateCartItemQuantity(existingItem.id, existingItem.quantity + 1);
      toast({
        title: "Producto actualizado",
        description: `Se aumentó la cantidad de ${product.descripcion}`,
      });
    } else {
      const newItem: CartItem = {
        id: `item-${Date.now()}-${Math.random()}`,
        type: "standard",
        productName: product.descripcion || "Producto sin nombre",
        productCode: product.codigo,
        quantity: 1,
        unitPrice: parseFloat(product.precio1 || "0"),
        totalPrice: parseFloat(product.precio1 || "0"),
      };
      
      setCart(prev => [...prev, newItem]);
      toast({
        title: "Producto agregado",
        description: `${product.descripcion} agregado al presupuesto`,
      });
    }
  };

  // Update cart item quantity
  const updateCartItemQuantity = (itemId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeFromCart(itemId);
      return;
    }

    setCart(prev => prev.map(item => 
      item.id === itemId 
        ? { ...item, quantity: newQuantity, totalPrice: item.unitPrice * newQuantity }
        : item
    ));
  };

  // Remove item from cart
  const removeFromCart = (itemId: string) => {
    setCart(prev => prev.filter(item => item.id !== itemId));
    toast({
      title: "Producto eliminado",
      description: "Producto eliminado del presupuesto",
    });
  };

  // Select client
  const selectClient = (client: Client) => {
    setSelectedClient(client);
    setQuoteForm(prev => ({
      ...prev,
      clientName: client.glosa || client.nokoen,
      clientId: client.id,
      clientRut: client.nokoen,
      clientEmail: client.email || "",
      clientPhone: client.telefono || "",
      clientAddress: `${client.direccion || ""} ${client.comuna || ""}`.trim(),
    }));
    setActiveTab("quote");
    toast({
      title: "Cliente seleccionado",
      description: `${client.glosa || client.nokoen} seleccionado para el presupuesto`,
    });
  };

  // Save quote
  const saveQuote = async () => {
    if (!quoteForm.clientName.trim()) {
      toast({
        title: "Error",
        description: "Debe seleccionar un cliente",
        variant: "destructive",
      });
      return;
    }

    if (cart.length === 0) {
      toast({
        title: "Error", 
        description: "Debe agregar al menos un producto",
        variant: "destructive",
      });
      return;
    }

    try {
      // Create quote
      const quoteData = {
        ...quoteForm,
        total: total.toString(),
        status: "draft" as const,
      };

      const response = await fetch('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(quoteData),
      });

      if (!response.ok) throw new Error('Failed to create quote');
      
      const quote: Quote = await response.json();

      // Add quote items
      for (const item of cart) {
        const itemData = {
          quoteId: quote.id,
          type: item.type,
          productName: item.productName,
          productCode: item.productCode,
          customSku: item.customSku,
          quantity: item.quantity.toString(),
          unitPrice: item.unitPrice.toString(),
          totalPrice: item.totalPrice.toString(),
          costOfProduction: item.costOfProduction?.toString(),
          profitMargin: item.profitMargin?.toString(),
          pricingMode: item.pricingMode,
        };

        const itemResponse = await fetch(`/api/quotes/${quote.id}/items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(itemData),
        });

        if (!itemResponse.ok) {
          console.error('Failed to add quote item:', await itemResponse.text());
        }
      }

      toast({
        title: "Presupuesto guardado",
        description: `Presupuesto ${quote.quoteNumber} creado exitosamente`,
      });

      // Reset form
      setCart([]);
      setQuoteForm(INITIAL_QUOTE_FORM);
      setSelectedClient(null);
      setActiveTab("products");

    } catch (error) {
      console.error('Error saving quote:', error);
      toast({
        title: "Error",
        description: "Error al guardar el presupuesto",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Constructor de Presupuesto</h1>
          <p className="text-gray-600">Cree cotizaciones profesionales con productos estándar y personalizados</p>
        </div>

        {/* Navigation Tabs */}
        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab("products")}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === "products" 
                    ? "border-blue-500 text-blue-600" 
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
                data-testid="tab-products"
              >
                <Search className="w-4 h-4 inline mr-2" />
                Buscar Productos
              </button>
              <button
                onClick={() => setActiveTab("clients")}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === "clients" 
                    ? "border-blue-500 text-blue-600" 
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
                data-testid="tab-clients"
              >
                <Users className="w-4 h-4 inline mr-2" />
                Seleccionar Cliente
              </button>
              <button
                onClick={() => setActiveTab("quote")}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === "quote" 
                    ? "border-blue-500 text-blue-600" 
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
                data-testid="tab-quote"
              >
                <FileText className="w-4 h-4 inline mr-2" />
                Datos del Presupuesto
              </button>
            </nav>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2">
            {/* Products Search Tab */}
            {activeTab === "products" && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Search className="w-5 h-5" />
                    Buscar Productos en Lista de Precios
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="product-search">Buscar producto por código o descripción</Label>
                      <Input
                        id="product-search"
                        type="text"
                        placeholder="Ej: ESMALTE, E001, pintura..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        data-testid="input-product-search"
                      />
                    </div>

                    {searchTerm.length >= 2 && (
                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        {priceListLoading ? (
                          <div className="text-center py-4">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
                            <p className="text-sm text-gray-500 mt-2">Buscando productos...</p>
                          </div>
                        ) : priceList.length === 0 ? (
                          <div className="text-center py-4">
                            <p className="text-gray-500">No se encontraron productos</p>
                          </div>
                        ) : (
                          priceList.map((product) => (
                            <div
                              key={product.id}
                              className="border rounded-lg p-3 hover:bg-gray-50 cursor-pointer transition-colors"
                              onClick={() => addProductToCart(product)}
                              data-testid={`product-${product.codigo}`}
                            >
                              <div className="flex justify-between items-start">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <Badge variant="secondary" className="text-xs">
                                      {product.codigo}
                                    </Badge>
                                  </div>
                                  <h4 className="font-medium text-gray-900 mb-1">
                                    {product.descripcion}
                                  </h4>
                                  <p className="text-sm text-gray-500">
                                    Unidad: {product.unidad || "N/A"}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="font-bold text-lg text-green-600">
                                    {formatCurrency(parseFloat(product.precio1 || "0"))}
                                  </p>
                                  <Button size="sm" className="mt-1">
                                    <Plus className="w-3 h-3" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}

                    {/* Custom Product Button */}
                    <Separator />
                    <Button
                      variant="outline"
                      size="lg"
                      className="w-full border-dashed border-2 border-blue-300 text-blue-600 hover:bg-blue-50"
                      data-testid="button-custom-product"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Agregar Producto Personalizado
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Client Selection Tab */}
            {activeTab === "clients" && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Seleccionar Cliente
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="client-search">Buscar cliente por nombre o RUT</Label>
                      <Input
                        id="client-search"
                        type="text"
                        placeholder="Ej: Juan Pérez, 12345678-9..."
                        value={clientSearchTerm}
                        onChange={(e) => setClientSearchTerm(e.target.value)}
                        data-testid="input-client-search"
                      />
                    </div>

                    {selectedClient && (
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <h4 className="font-medium text-blue-900">Cliente Seleccionado:</h4>
                        <p className="text-blue-700">{selectedClient.glosa || selectedClient.nokoen}</p>
                        <p className="text-sm text-blue-600">RUT: {selectedClient.nokoen}</p>
                      </div>
                    )}

                    {clientSearchTerm.length >= 2 && (
                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        {clientsLoading ? (
                          <div className="text-center py-4">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
                            <p className="text-sm text-gray-500 mt-2">Buscando clientes...</p>
                          </div>
                        ) : clients.length === 0 ? (
                          <div className="text-center py-4">
                            <p className="text-gray-500">No se encontraron clientes</p>
                          </div>
                        ) : (
                          clients.map((client) => (
                            <div
                              key={client.id}
                              className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                                selectedClient?.id === client.id
                                  ? "bg-blue-50 border-blue-300"
                                  : "hover:bg-gray-50"
                              }`}
                              onClick={() => selectClient(client)}
                              data-testid={`client-${client.nokoen}`}
                            >
                              <div className="flex justify-between items-start">
                                <div>
                                  <h4 className="font-medium text-gray-900">
                                    {client.glosa || client.nokoen}
                                  </h4>
                                  <p className="text-sm text-gray-500">RUT: {client.nokoen}</p>
                                  {client.comuna && (
                                    <p className="text-sm text-gray-500">Comuna: {client.comuna}</p>
                                  )}
                                </div>
                                <Badge variant={client.nokofu ? "default" : "secondary"}>
                                  {client.nokofu || "Sin vendedor"}
                                </Badge>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Quote Details Tab */}
            {activeTab === "quote" && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Datos del Presupuesto
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="client-name">Nombre del Cliente *</Label>
                      <Input
                        id="client-name"
                        value={quoteForm.clientName}
                        onChange={(e) => setQuoteForm(prev => ({ ...prev, clientName: e.target.value }))}
                        data-testid="input-client-name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="client-rut">RUT</Label>
                      <Input
                        id="client-rut"
                        value={quoteForm.clientRut}
                        onChange={(e) => setQuoteForm(prev => ({ ...prev, clientRut: e.target.value }))}
                        data-testid="input-client-rut"
                      />
                    </div>
                    <div>
                      <Label htmlFor="client-email">Email</Label>
                      <Input
                        id="client-email"
                        type="email"
                        value={quoteForm.clientEmail}
                        onChange={(e) => setQuoteForm(prev => ({ ...prev, clientEmail: e.target.value }))}
                        data-testid="input-client-email"
                      />
                    </div>
                    <div>
                      <Label htmlFor="client-phone">Teléfono</Label>
                      <Input
                        id="client-phone"
                        value={quoteForm.clientPhone}
                        onChange={(e) => setQuoteForm(prev => ({ ...prev, clientPhone: e.target.value }))}
                        data-testid="input-client-phone"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label htmlFor="client-address">Dirección</Label>
                      <Input
                        id="client-address"
                        value={quoteForm.clientAddress}
                        onChange={(e) => setQuoteForm(prev => ({ ...prev, clientAddress: e.target.value }))}
                        data-testid="input-client-address"
                      />
                    </div>
                    <div>
                      <Label htmlFor="valid-until">Válido hasta</Label>
                      <Input
                        id="valid-until"
                        type="date"
                        value={quoteForm.validUntil}
                        onChange={(e) => setQuoteForm(prev => ({ ...prev, validUntil: e.target.value }))}
                        data-testid="input-valid-until"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label htmlFor="notes">Notas adicionales</Label>
                      <Textarea
                        id="notes"
                        rows={3}
                        value={quoteForm.notes}
                        onChange={(e) => setQuoteForm(prev => ({ ...prev, notes: e.target.value }))}
                        placeholder="Condiciones especiales, términos, etc."
                        data-testid="textarea-notes"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Cart Sidebar */}
          <div className="lg:col-span-1">
            <Card className="sticky top-6">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <ShoppingCart className="w-5 h-5" />
                    Carrito ({cart.length})
                  </span>
                  {cart.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCart([])}
                      data-testid="button-clear-cart"
                    >
                      Limpiar
                    </Button>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {cart.length === 0 ? (
                  <div className="text-center py-8">
                    <ShoppingCart className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                    <p className="text-gray-500">No hay productos en el carrito</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {cart.map((item) => (
                      <div
                        key={item.id}
                        className="border rounded-lg p-3"
                        data-testid={`cart-item-${item.id}`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1">
                            <h4 className="font-medium text-sm">{item.productName}</h4>
                            {item.productCode && (
                              <Badge variant="secondary" className="text-xs mt-1">
                                {item.productCode}
                              </Badge>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeFromCart(item.id)}
                            data-testid={`button-remove-${item.id}`}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => updateCartItemQuantity(item.id, item.quantity - 1)}
                              data-testid={`button-decrease-${item.id}`}
                            >
                              -
                            </Button>
                            <span className="w-8 text-center text-sm font-medium">
                              {item.quantity}
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => updateCartItemQuantity(item.id, item.quantity + 1)}
                              data-testid={`button-increase-${item.id}`}
                            >
                              +
                            </Button>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-gray-500">
                              {formatCurrency(item.unitPrice)} c/u
                            </p>
                            <p className="font-medium text-green-600">
                              {formatCurrency(item.totalPrice)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}

                    <Separator />
                    
                    {/* Totals */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Subtotal:</span>
                        <span data-testid="text-subtotal">{formatCurrency(subtotal)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>IVA (19%):</span>
                        <span data-testid="text-tax">{formatCurrency(tax)}</span>
                      </div>
                      <Separator />
                      <div className="flex justify-between font-bold text-lg">
                        <span>Total:</span>
                        <span className="text-green-600" data-testid="text-total">
                          {formatCurrency(total)}
                        </span>
                      </div>
                    </div>

                    <Separator />

                    {/* Save Quote Button */}
                    <Button
                      onClick={saveQuote}
                      size="lg"
                      className="w-full"
                      disabled={!quoteForm.clientName || cart.length === 0}
                      data-testid="button-save-quote"
                    >
                      <Save className="w-4 h-4 mr-2" />
                      Guardar Presupuesto
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}