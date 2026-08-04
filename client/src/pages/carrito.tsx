import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useCart } from "@/hooks/useCart";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ShoppingBag, ArrowLeft, Trash2, Minus, Plus, Package, FileDown, Palette } from "lucide-react";
import { BillingSummary } from "@/components/cart";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

const formatPrice = (price: number): string => {
  return `$${new Intl.NumberFormat('es-CL', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price)}`;
};

// Extract color from product code
const extractColor = (code: string): string | null => {
  const upperCode = (code || '').toUpperCase();
  const colorMap: Record<string, string> = {
    'BLANC': 'Blanco', 'NEGRO': 'Negro', 'GRIS': 'Gris', 'AZUL': 'Azul',
    'ROJO': 'Rojo', 'VERDE': 'Verde', 'AMARI': 'Amarillo', 'CAFE': 'Café',
    'NAT': 'Natural', 'MAPLE': 'Maple', 'CAOBA': 'Caoba', 'NOGL': 'Nogal',
    'CASTA': 'Castaño', 'CEDER': 'Cedro', 'ROBLE': 'Roble', 'ALMEN': 'Almendra',
    'CREMA': 'Crema', 'MARFI': 'Marfil', 'CORAL': 'Coral', 'TERRA': 'Terracota',
    'POLCA': 'Caoba', 'POLNA': 'Natural', 'POLNO': 'Nogal',
  };
  for (const [key, val] of Object.entries(colorMap)) {
    if (upperCode.includes(key)) return val;
  }
  return null;
};

const escapeHtml = (text: string | null | undefined): string => {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
};

export default function Carrito() {
  const { state, clearCart, updateQuantity, removeItem } = useCart();
  const { toast } = useToast();
  const { user } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  
  // Track shipping for PDF generation
  const [shippingCost, setShippingCost] = useState(0);
  const [deliveryMethod, setDeliveryMethod] = useState<'retiro' | 'despacho'>('retiro');

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Cargando carrito...</p>
        </div>
      </div>
    );
  }

  const isEmpty = state.items.length === 0;

  if (isEmpty) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="container mx-auto px-2 sm:px-4 py-6">
          <div className="flex items-center gap-4 mb-8">
            <Link href="/tienda">
              <Button variant="ghost" size="sm" data-testid="button-back-to-shop">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Volver a la tienda
              </Button>
            </Link>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Mi carrito</h1>
          </div>
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-24 h-24 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-6">
              <ShoppingBag className="h-12 w-12 text-gray-400" />
            </div>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
              Tu carrito está vacío
            </h2>
            <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-md">
              No tienes productos en tu carrito. Explora nuestra tienda y encuentra los productos que necesitas.
            </p>
            <Link href="/tienda">
              <Button 
                className="bg-[#FF6E23] hover:bg-[#FF6E23]/90 text-white px-8 py-3"
                size="lg"
                data-testid="button-browse-products"
              >
                Explorar productos
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const handleClearCart = () => {
    if (window.confirm('¿Estás seguro de que quieres eliminar todos los productos del carrito?')) {
      clearCart();
    }
  };

  const handleRemove = (item: typeof state.items[0]) => {
    removeItem(item.id);
  };

  const startEdit = (item: typeof state.items[0]) => {
    setEditingId(item.id);
    setEditValue(item.quantity.toString());
  };

  const commitEdit = (item: typeof state.items[0]) => {
    const numValue = parseInt(editValue) || item.minQuantity;
    let newQty = numValue;
    if (newQty < item.minQuantity) newQty = item.minQuantity;
    if (newQty % item.quantityStep !== 0) {
      newQty = Math.ceil(newQty / item.quantityStep) * item.quantityStep;
    }
    updateQuantity(item.id, newQty);
    setEditingId(null);
  };

  const increment = (item: typeof state.items[0]) => {
    updateQuantity(item.id, item.quantity + item.quantityStep);
  };

  const decrement = (item: typeof state.items[0]) => {
    const newQty = Math.max(item.minQuantity, item.quantity - item.quantityStep);
    updateQuantity(item.id, newQty);
  };

  // PDF Export — mirrors tomador-pedidos style with cart accurate totals
  const handleExportPDF = () => {
    const formatCurrency = (n: number) => `$${Math.round(n).toLocaleString('es-CL').replace(/,/g, '.')}`;
    const now = new Date().toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });

    const totalProducts = state.subtotal;
    const discount = state.discountAmount;
    const tax = state.taxAmount;
    const effectiveShipping = deliveryMethod === 'despacho' ? shippingCost : 0;
    const finalTotal = state.total + effectiveShipping;

    const discountRow = discount > 0 ? `
      <div class="total-row">
        <span style="color: #ef4444;">Descuento Aplicado:</span>
        <span style="color: #ef4444;">-${formatCurrency(discount)}</span>
      </div>
    ` : '';

    const shippingRow = effectiveShipping > 0 ? `
      <div class="total-row">
        <span style="color: #fd6301;">Flete / Despacho a Domicilio:</span>
        <span style="color: #fd6301; font-weight: 600;">${formatCurrency(effectiveShipping)}</span>
      </div>
    ` : '';

    const productRows = state.items.map(item => {
      const color = item.selectedColor || extractColor(item.productCode);
      // En un color a medida el SKU no identifica el tono: el código de color va
      // explícito para que el documento impreso sirva en producción.
      const customLine = item.isCustomColor
        ? `<div class="product-code" style="color: #a21caf; font-weight: 600;">COLOR PERSONALIZADO: ${escapeHtml(item.customColorCode || '')}${item.customColorBrand ? ` (${escapeHtml(item.customColorBrand)})` : ''}${item.customColorHex ? ` • ${escapeHtml(item.customColorHex)}` : ''}</div>`
        : '';
      return `<tr>
        <td>
          <div class="product-name">${escapeHtml(item.productName)}</div>
          <div class="product-code">SKU: ${escapeHtml(item.productCode)}${color ? ` • ${color}` : ''}</div>
          ${customLine}
        </td>
        <td class="text-center">${escapeHtml(item.unit) || 'UN'}</td>
        <td class="text-center">${item.quantity}</td>
        <td class="text-right">${formatCurrency(item.unitPrice)}</td>
        <td class="text-right" style="color: #fd6301; font-weight: 600;">${formatCurrency(item.subtotal)}</td>
      </tr>`;
    }).join('');

    const userName = user?.firstName && user?.lastName 
      ? `${user.firstName} ${user.lastName}` 
      : user?.firstName || user?.email || 'Cliente';

    const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Carrito - ${userName}</title>
  <style>
    @page { size: A4; margin: 15mm; }
    body { font-family: Arial, sans-serif; margin: 0; padding: 0; color: #333; font-size: 14px; line-height: 1.4; }
    .container { max-width: 100%; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; border-bottom: 2px solid #fd6301; padding-bottom: 15px; }
    .header-left { flex-shrink: 0; }
    .header-right { text-align: right; }
    .header img { max-height: 60px; width: auto; }
    .header h1 { color: #fd6301; margin: 0; font-size: 24px; font-weight: bold; }
    .header-info { font-size: 13px; color: #374151; margin-top: 8px; }
    .header-info p { margin: 4px 0; }
    .section { margin-bottom: 15px; }
    .section h3 { color: #fd6301; margin: 0 0 10px 0; font-size: 16px; font-weight: bold; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 13px; }
    th { background: linear-gradient(to right, #fd6301, #e55100); color: white; padding: 8px; text-align: left; font-weight: bold; font-size: 12px; }
    td { padding: 8px; border-bottom: 1px solid #e5e7eb; }
    tr:nth-child(even) { background-color: #fafafa; }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .product-name { font-weight: 600; color: #1f2937; font-size: 13px; }
    .product-code { color: #6b7280; font-size: 11px; margin-top: 2px; }
    .totals { background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 15px; border-radius: 6px; margin-bottom: 15px; }
    .total-row { display: flex; justify-content: space-between; margin: 6px 0; font-size: 14px; }
    .total-row span:first-child { color: #374151; font-weight: 500; }
    .total-row span:last-child { font-weight: 600; }
    .final-total { font-size: 16px; font-weight: bold; border-top: 2px solid #e2e8f0; padding-top: 10px; margin-top: 8px; }
    .final-total span:last-child { color: #fd6301; }
    .payment-info { background-color: #fff7ed; border: 1px solid #fdba74; padding: 12px; border-radius: 6px; font-size: 12px; }
    .payment-info h4 { color: #ea580c; margin: 0 0 10px 0; font-size: 14px; }
    .payment-info p { margin: 0 0 8px 0; }
    .payment-info a { color: #2563eb; text-decoration: underline; word-break: break-all; }
    .payment-section { margin-bottom: 10px; }
    .payment-section:last-child { margin-bottom: 0; }
    @media print {
      body { margin: 0; font-size: 12px; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="header-left">
        <img src="${window.location.origin}/panoramica-logo.png" alt="Logo Panorámica" style="width:220px;height:auto;display:block" />
      </div>
      <div class="header-right">
        <h1>PEDIDO</h1>
        <div class="header-info">
          <p><strong>Fecha:</strong> ${now}</p>
          <p><strong>Cliente:</strong> ${escapeHtml(userName)}</p>
          ${user?.email ? `<p><strong>Email:</strong> ${escapeHtml(user.email)}</p>` : ''}
        </div>
      </div>
    </div>

    <div class="section">
      <h3>Detalle de Productos</h3>
      <table>
        <thead>
          <tr>
            <th>Producto</th>
            <th class="text-center">Unidad</th>
            <th class="text-center">Cant.</th>
            <th class="text-right">Precio</th>
            <th class="text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          ${productRows}
        </tbody>
      </table>
    </div>

    <div class="section">
      <div class="totals">
        <div class="total-row">
          <span>Subtotal (Neto):</span>
          <span>${formatCurrency(totalProducts)}</span>
        </div>
        ${discountRow}
        ${shippingRow}
        <div class="total-row">
          <span>IVA (19%):</span>
          <span>${formatCurrency(tax)}</span>
        </div>
        <div class="total-row final-total">
          <span>Total Final:</span>
          <span>${formatCurrency(finalTotal)}</span>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="payment-info">
        <h4>Información de Pagos</h4>
        <div class="payment-section">
          <p><strong>Link de pagos con tarjetas:</strong><br>
          <a href="https://micrositios.getnet.cl/pinturaspanoramica">https://micrositios.getnet.cl/pinturaspanoramica</a></p>
        </div>
        <div class="payment-section">
          <p><strong>Pagos con transferencia dirigirlos a:</strong><br>
          Pintureria Panoramica Limitada<br>
          RUT: 78.652.260-9<br>
          Cuenta Corriente Banco Santander: 2592916-0<br>
          Email: <a href="mailto:contacto@pinturaspanoramica.cl">contacto@pinturaspanoramica.cl</a></p>
        </div>
      </div>
    </div>
  </div>

  <div class="no-print" style="margin-top: 20px; text-align: center;">
    <button onclick="window.print()" style="padding: 10px 20px; background-color: #fd6301; color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: 600;">
      Imprimir / Descargar PDF
    </button>
  </div>
  <script>
    window.addEventListener('load', function() {
      var img = document.querySelector('.header-left img');
      function doPrint() {
        window.focus();
        window.print();
      }
      if (img && !img.complete) {
        img.onload = doPrint;
        img.onerror = doPrint;
        setTimeout(doPrint, 3000);
      } else {
        setTimeout(doPrint, 500);
      }
    });
  </script>
</body>
</html>`;

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
    } else {
      toast({
        title: "Error",
        description: "No se pudo abrir la ventana de PDF. Verifique que el navegador no bloquee ventanas emergentes.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <Link href="/tienda">
              <Button variant="ghost" size="sm" data-testid="button-back-to-shop-header">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Volver a la tienda
              </Button>
            </Link>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white" data-testid="text-cart-title">
                Mi carrito
              </h1>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400" data-testid="text-cart-count">
                {state.itemCount} Producto{state.itemCount !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportPDF}
              className="text-[#FF6E23] hover:text-[#E55E13] hover:bg-orange-50 border-orange-200"
              data-testid="button-export-pdf"
            >
              <FileDown className="h-4 w-4 mr-1.5" />
              Exportar PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearCart}
              className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950 border-red-200 dark:border-red-800"
              data-testid="button-clear-cart"
            >
              <Trash2 className="h-4 w-4 mr-1.5" />
              Vaciar
            </Button>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Left Side - Products Table */}
          <div className="lg:col-span-2">
            <Card className="bg-white dark:bg-gray-800 shadow-sm border-gray-200 dark:border-gray-700 overflow-hidden">
              {/* Desktop Table Header */}
              <div className="hidden md:grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-4 py-2 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                <div>Producto</div>
                <div className="w-24 text-center">Precio Unit.</div>
                <div className="w-32 text-center">Cantidad</div>
                <div className="w-24 text-right">Subtotal</div>
                <div className="w-8"></div>
              </div>

              {/* Product Rows */}
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {state.items.map((item) => {
                  const color = item.selectedColor || extractColor(item.productCode);
                  
                  return (
                    <div
                      key={item.id}
                      className={`group transition-colors ${
                        item.isCustomColor
                          ? 'bg-fuchsia-50/50 hover:bg-fuchsia-50 border-l-2 border-fuchsia-400'
                          : 'hover:bg-gray-50/50 dark:hover:bg-gray-750/50'
                      }`}
                      data-testid={`cart-page-item-${item.productId}`}
                    >
                      {/* Desktop Row */}
                      <div className="hidden md:grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 items-center px-4 py-2.5">
                        {/* Product Info */}
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className="w-9 h-9 flex-shrink-0 bg-gray-100 dark:bg-gray-800 rounded overflow-hidden border border-gray-200 flex items-center justify-center"
                            style={item.isCustomColor && item.customColorHex ? { background: item.customColorHex } : undefined}
                            title={item.isCustomColor ? item.customColorHex || undefined : undefined}
                          >
                            {item.isCustomColor ? (
                              <Palette className="h-4 w-4 text-white drop-shadow" />
                            ) : item.imageUrl ? (
                              <img src={item.imageUrl} alt={item.productName} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Package className="h-4 w-4 text-gray-400" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-sm font-semibold text-gray-900 dark:text-white truncate" data-testid={`text-cart-page-item-name-${item.productId}`}>
                                {item.productName}
                              </p>
                              {item.isCustomColor && (
                                <span
                                  className="flex-shrink-0 text-[9px] bg-fuchsia-600 text-white px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wide"
                                  title={`Color a medida ${item.customColorCode || ''}${item.customColorBrand ? ` (${item.customColorBrand})` : ''} — precio cotizado para ti`}
                                >
                                  Personalizado
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[11px] font-mono text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">{item.productCode}</span>
                              {item.unit && <span className="text-[11px] text-gray-400">{item.unit}</span>}
                              {color && (
                                <span className={`text-[11px] ${item.isCustomColor ? 'text-fuchsia-700 font-medium' : 'text-gray-400'}`}>
                                  • {color}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Unit Price */}
                        <div className="w-24 text-center">
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300" data-testid={`text-unit-price-${item.productId}`}>
                            {formatPrice(item.unitPrice)}
                          </span>
                        </div>

                        {/* Quantity Controls */}
                        <div className="w-32 flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => decrement(item)}
                            disabled={item.quantity <= item.minQuantity}
                            className="h-7 w-7 p-0 rounded-md hover:bg-gray-200"
                            data-testid={`button-decrease-${item.productId}`}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          
                          {editingId === item.id ? (
                            <Input
                              type="number"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onBlur={() => commitEdit(item)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') commitEdit(item);
                                if (e.key === 'Escape') setEditingId(null);
                              }}
                              autoFocus
                              className="w-14 h-7 text-center text-sm px-1 font-mono"
                              min={item.minQuantity}
                              step={item.quantityStep}
                              data-testid={`input-quantity-${item.productId}`}
                            />
                          ) : (
                            <button
                              onClick={() => startEdit(item)}
                              className="w-14 h-7 text-center text-sm font-mono font-semibold rounded-md border border-gray-200 bg-white hover:border-[#FF6E23] hover:text-[#FF6E23] transition-colors cursor-text"
                              data-testid={`input-quantity-${item.productId}`}
                            >
                              {item.quantity}
                            </button>
                          )}
                          
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => increment(item)}
                            className="h-7 w-7 p-0 rounded-md hover:bg-gray-200"
                            data-testid={`button-increase-${item.productId}`}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>

                        {/* Subtotal */}
                        <div className="w-24 text-right">
                          <span className="text-sm font-bold text-gray-900 dark:text-white" data-testid={`text-subtotal-${item.productId}`}>
                            {formatPrice(item.subtotal)}
                          </span>
                        </div>

                        {/* Remove */}
                        <div className="w-8">
                          <button
                            onClick={() => handleRemove(item)}
                            className="h-7 w-7 rounded-md flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                            data-testid={`button-remove-${item.productId}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Mobile Row - Compact */}
                      <div className="md:hidden px-2.5 py-2">
                        <div className="flex items-center gap-2">
                          {/* Small thumbnail */}
                          <div
                            className="w-12 h-12 flex-shrink-0 bg-gray-100 rounded overflow-hidden border border-gray-200 flex items-center justify-center"
                            style={item.isCustomColor && item.customColorHex ? { background: item.customColorHex } : undefined}
                          >
                            {item.isCustomColor ? (
                              <Palette className="h-5 w-5 text-white drop-shadow" />
                            ) : item.imageUrl ? (
                              <img src={item.imageUrl} alt={item.productName} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Package className="h-5 w-5 text-gray-400" />
                              </div>
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-1">
                              <div className="min-w-0">
                                <p className="text-[13px] font-semibold text-gray-900 truncate leading-tight">{item.productName}</p>
                                {item.isCustomColor && (
                                  <span className="inline-block mt-0.5 text-[9px] bg-fuchsia-600 text-white px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wide">
                                    Personalizado
                                  </span>
                                )}
                                <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                                  <span className="text-[10px] font-mono text-gray-500 bg-gray-100 px-1 py-0.5 rounded">{item.productCode}</span>
                                  {item.unit && <span className="text-[10px] text-gray-400">{item.unit}</span>}
                                  {color && (
                                    <span className={`text-[10px] ${item.isCustomColor ? 'text-fuchsia-700 font-medium' : 'text-gray-400'}`}>
                                      • {color}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <button
                                onClick={() => handleRemove(item)}
                                className="p-1 text-gray-400 hover:text-red-500 flex-shrink-0 -mr-1"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                            
                            {/* Price + Qty row */}
                            <div className="flex items-center justify-between mt-1">
                              <span className="text-[11px] text-gray-500">{formatPrice(item.unitPrice)} c/u</span>
                              
                              <div className="flex items-center gap-0.5">
                                <Button variant="ghost" size="sm" onClick={() => decrement(item)} disabled={item.quantity <= item.minQuantity} className="h-6 w-6 p-0 rounded-md">
                                  <Minus className="h-3 w-3" />
                                </Button>
                                <span className="text-xs font-mono font-bold w-6 text-center">{item.quantity}</span>
                                <Button variant="ghost" size="sm" onClick={() => increment(item)} className="h-6 w-6 p-0 rounded-md">
                                  <Plus className="h-3 w-3" />
                                </Button>
                              </div>

                              <span className="text-sm font-black text-gray-900">{formatPrice(item.subtotal)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Table Footer */}
              <div className="px-3 sm:px-4 py-2 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <span className="text-[11px] sm:text-xs text-gray-500">{state.items.length} líneas • {state.itemCount} unidades</span>
                <span className="text-sm font-bold text-gray-900 dark:text-white">
                  Neto: {formatPrice(state.items.reduce((sum, item) => sum + item.subtotal, 0))}
                </span>
              </div>
            </Card>
          </div>

          {/* Right Side - Billing Summary */}
          <div className="lg:col-span-1">
            <div className="sticky top-8">
              <BillingSummary 
                onShippingChange={(cost, method) => {
                  setShippingCost(cost);
                  setDeliveryMethod(method);
                }} 
              />
            </div>
          </div>
        </div>

        {/* Continue Shopping */}
        <div className="mt-6 text-center">
          <Link href="/tienda">
            <Button 
              variant="outline" 
              size="sm"
              data-testid="button-continue-shopping-bottom"
            >
              Continuar comprando
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}