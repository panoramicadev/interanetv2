import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Minus, Plus, Trash2 } from "lucide-react";
import { useCart } from "@/hooks/useCart";
import { useToast } from "@/hooks/use-toast";
import { CartItem } from "@shared/schema";

interface CartPageItemProps {
  item: CartItem;
  showDivider?: boolean;
}

const formatPrice = (price: number): string => {
  return `$${new Intl.NumberFormat('es-CL', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price)}`;
};

const getAvailablePackaging = (unit: string): string[] => {
  const normalizedUnit = unit.toUpperCase().trim();
  
  // BD4 and BD5 packaging options
  if (normalizedUnit.includes('BD4') || normalizedUnit.includes('BALDE') && normalizedUnit.includes('4')) {
    return ['Balde 4 Galones'];
  }
  if (normalizedUnit.includes('BD5') || normalizedUnit.includes('BALDE') && normalizedUnit.includes('5')) {
    return ['Balde 5 Galones'];
  }
  
  // Gallon packaging options
  if (normalizedUnit.includes('GL') || normalizedUnit.includes('GAL')) {
    return ['Galón', 'Balde 4 Galones', 'Balde 5 Galones'];
  }
  
  // Quarter gallon packaging
  if (normalizedUnit.includes('1/4') || normalizedUnit.includes('CUARTO')) {
    return ['1/4 de Galón'];
  }
  
  return ['Unidad', 'Galón', 'Balde 4 Galones', 'Balde 5 Galones'];
};

const getAvailableColors = (): string[] => {
  return ['BLANCO', 'NEGRO', 'AZUL', 'ROJO', 'VERDE', 'AMARILLO', 'CAFÉ', 'GRIS'];
};

export default function CartPageItem({ item, showDivider = true }: CartPageItemProps) {
  const { updateQuantity, removeItem, updateItem } = useCart();
  const { toast } = useToast();
  const [quantityInput, setQuantityInput] = useState(item.quantity.toString());
  const [isEditing, setIsEditing] = useState(false);
  const [validationMessage, setValidationMessage] = useState<string>("");
  const [validationStatus, setValidationStatus] = useState<'valid' | 'warning' | 'error'>('valid');

  const availablePackaging = getAvailablePackaging(item.unit);
  const availableColors = getAvailableColors();

  const discountPercent = item.discountAmount && item.subtotal > 0 
    ? Math.round((item.discountAmount / item.subtotal) * 100) 
    : 0;

  // Real-time quantity validation
  const validateQuantity = (inputValue: string): { isValid: boolean; message: string; status: 'valid' | 'warning' | 'error' } => {
    const numValue = parseInt(inputValue);
    
    // Check if it's a valid number
    if (isNaN(numValue) || inputValue.trim() === '') {
      return { isValid: false, message: 'Ingresa un número válido', status: 'error' };
    }
    
    // Check minimum quantity
    if (numValue < item.minQuantity) {
      return { 
        isValid: false, 
        message: `Cantidad mínima: ${item.minQuantity}`, 
        status: 'error' 
      };
    }
    
    // Check quantity step compliance
    if (numValue % item.quantityStep !== 0) {
      const nextValid = Math.ceil(numValue / item.quantityStep) * item.quantityStep;
      const prevValid = Math.floor(numValue / item.quantityStep) * item.quantityStep;
      const suggestion = nextValid <= numValue + item.quantityStep ? nextValid : prevValid;
      
      return { 
        isValid: false, 
        message: `Debe ser múltiplo de ${item.quantityStep}. Sugerencia: ${Math.max(suggestion, item.minQuantity)}`, 
        status: 'warning' 
      };
    }
    
    // All validations passed
    return { isValid: true, message: '', status: 'valid' };
  };

  const handleQuantityInputChange = (value: string) => {
    setQuantityInput(value);
    
    // Immediate validation feedback
    if (isEditing) {
      const validation = validateQuantity(value);
      setValidationMessage(validation.message);
      setValidationStatus(validation.status);
    }
  };

  const handleQuantityInputBlur = () => {
    setIsEditing(false);
    const validation = validateQuantity(quantityInput);
    
    let newQuantity: number;
    if (validation.isValid) {
      newQuantity = parseInt(quantityInput);
    } else {
      // Auto-correct to valid quantity
      const numValue = parseInt(quantityInput) || item.minQuantity;
      if (numValue < item.minQuantity) {
        newQuantity = item.minQuantity;
      } else if (numValue % item.quantityStep !== 0) {
        newQuantity = Math.ceil(numValue / item.quantityStep) * item.quantityStep;
      } else {
        newQuantity = Math.max(numValue, item.minQuantity);
      }
    }
    
    if (newQuantity !== item.quantity) {
      updateQuantity(item.id, newQuantity);
    }
    setQuantityInput(newQuantity.toString());
    
    // Clear validation messages after blur
    setValidationMessage("");
    setValidationStatus('valid');
  };

  const handleQuantityInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleQuantityInputBlur();
    }
    if (e.key === 'Escape') {
      setQuantityInput(item.quantity.toString());
      setIsEditing(false);
      setValidationMessage("");
      setValidationStatus('valid');
    }
  };

  const handleQuantityInputFocus = () => {
    setIsEditing(true);
    // Reset validation on focus
    setValidationMessage("");
    setValidationStatus('valid');
  };

  const incrementQuantity = () => {
    const newQuantity = item.quantity + item.quantityStep;
    updateQuantity(item.id, newQuantity);
    setQuantityInput(newQuantity.toString());
  };

  const decrementQuantity = () => {
    const newQuantity = Math.max(item.minQuantity, item.quantity - item.quantityStep);
    if (newQuantity >= item.minQuantity) {
      updateQuantity(item.id, newQuantity);
      setQuantityInput(newQuantity.toString());
    }
  };

  const handleRemove = () => {
    if (window.confirm(`¿Eliminar ${item.productName} del carrito?`)) {
      removeItem(item.id);
    }
  };

  const handlePackagingChange = (packaging: string) => {
    // Define packaging quantity rules
    const getPackagingRules = (packaging: string): { minQuantity: number; quantityStep: number } => {
      const normalizedPackaging = packaging.toLowerCase();
      
      if (normalizedPackaging.includes('galón') && !normalizedPackaging.includes('balde')) {
        return { minQuantity: 4, quantityStep: 4 }; // GL=4
      }
      if (normalizedPackaging.includes('1/4') || normalizedPackaging.includes('cuarto')) {
        return { minQuantity: 6, quantityStep: 6 }; // 1/4=6
      }
      if (normalizedPackaging.includes('balde') || normalizedPackaging.includes('bd')) {
        return { minQuantity: 1, quantityStep: 1 }; // BD=1
      }
      
      // Default for other packaging types
      return { minQuantity: 1, quantityStep: 1 };
    };

    const newRules = getPackagingRules(packaging);
    let adjustedQuantity = item.quantity;
    
    // Adjust quantity to meet new rules if necessary
    if (adjustedQuantity < newRules.minQuantity) {
      adjustedQuantity = newRules.minQuantity;
    } else if (adjustedQuantity % newRules.quantityStep !== 0) {
      // Round up to next valid multiple
      adjustedQuantity = Math.ceil(adjustedQuantity / newRules.quantityStep) * newRules.quantityStep;
    }

    // Update item with new packaging and adjusted quantity
    updateItem(item.id, { 
      selectedPackaging: packaging,
      minQuantity: newRules.minQuantity,
      quantityStep: newRules.quantityStep
    });

    // If quantity was adjusted, update it and show user feedback
    if (adjustedQuantity !== item.quantity) {
      updateQuantity(item.id, adjustedQuantity);
      setQuantityInput(adjustedQuantity.toString());
      
      // Show user feedback about quantity adjustment
      const message = adjustedQuantity > item.quantity 
        ? `Cantidad ajustada a ${adjustedQuantity} para cumplir con los requisitos del envase ${packaging}`
        : `Cantidad ajustada a ${adjustedQuantity} para el envase ${packaging}`;
      
      // Show user feedback about quantity adjustment
      toast({
        title: "Cantidad ajustada",
        description: message,
        duration: 3000
      });
    }
  };

  const handleColorChange = (color: string) => {
    updateItem(item.id, { selectedColor: color });
  };

  const currentPackaging = item.selectedPackaging || 
    (availablePackaging.length > 0 ? availablePackaging[0] : 'Unidad');

  return (
    <div className="w-full" data-testid={`cart-page-item-${item.productId}`}>
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Product Image */}
        <div className="flex-shrink-0">
          <div className="w-32 h-32 lg:w-40 lg:h-40 bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
            {item.imageUrl ? (
              <img
                src={item.imageUrl}
                alt={item.productName}
                className="w-full h-full object-cover"
                data-testid={`img-cart-page-item-${item.productId}`}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700">
                <div className="text-center p-4">
                  <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                    CÓDIGO
                  </div>
                  <div className="text-sm font-bold text-gray-700 dark:text-gray-300">
                    {item.productCode}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Product Details */}
        <div className="flex-1 space-y-4">
          {/* Product Name and Code */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1" data-testid={`text-cart-page-item-name-${item.productId}`}>
              {item.productName}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Código: {item.productCode}
            </p>
            {item.category && (
              <Badge variant="secondary" className="mt-1">
                {item.category}
              </Badge>
            )}
          </div>

          {/* Product Format & Color - Read-only display */}
          <div className="flex flex-wrap gap-3">
            {/* Format/Packaging info from unit */}
            {item.unit && (
              <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                <span className="text-xs font-medium text-gray-500 uppercase">Envase</span>
                <span className="text-sm font-semibold text-gray-800">{item.unit}</span>
              </div>
            )}
            {/* Color extracted from selectedColor or product code */}
            {(item.selectedColor || (() => {
              // Try to extract color from product code (e.g., PCA106BANAT06 -> NATURAL)
              const code = (item.productCode || '').toUpperCase();
              const colorMap: Record<string, string> = {
                'BLANC': 'BLANCO', 'NEGRO': 'NEGRO', 'GRIS': 'GRIS', 'AZUL': 'AZUL',
                'ROJO': 'ROJO', 'VERDE': 'VERDE', 'AMARI': 'AMARILLO', 'CAFE': 'CAFÉ',
                'NAT': 'NATURAL', 'MAPLE': 'MAPLE', 'CAOBA': 'CAOBA', 'NOGL': 'NOGAL',
                'CASTA': 'CASTAÑO', 'CEDER': 'CEDRO', 'ROBLE': 'ROBLE', 'ALMEN': 'ALMENDRA',
                'CREMA': 'CREMA', 'MARFI': 'MARFIL', 'CORAL': 'CORAL', 'TERRA': 'TERRACOTA',
              };
              for (const [key, val] of Object.entries(colorMap)) {
                if (code.includes(key)) return val;
              }
              return null;
            })()) && (
              <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                <span className="text-xs font-medium text-gray-500 uppercase">Color</span>
                <span className="text-sm font-semibold text-gray-800">
                  {item.selectedColor || (() => {
                    const code = (item.productCode || '').toUpperCase();
                    const colorMap: Record<string, string> = {
                      'BLANC': 'BLANCO', 'NEGRO': 'NEGRO', 'GRIS': 'GRIS', 'AZUL': 'AZUL',
                      'ROJO': 'ROJO', 'VERDE': 'VERDE', 'AMARI': 'AMARILLO', 'CAFE': 'CAFÉ',
                      'NAT': 'NATURAL', 'MAPLE': 'MAPLE', 'CAOBA': 'CAOBA', 'NOGL': 'NOGAL',
                      'CASTA': 'CASTAÑO', 'CEDER': 'CEDRO', 'ROBLE': 'ROBLE', 'ALMEN': 'ALMENDRA',
                      'CREMA': 'CREMA', 'MARFI': 'MARFIL', 'CORAL': 'CORAL', 'TERRA': 'TERRACOTA',
                    };
                    for (const [key, val] of Object.entries(colorMap)) {
                      if (code.includes(key)) return val;
                    }
                    return '';
                  })()}
                </span>
              </div>
            )}
          </div>

          {/* Price and Quantity Section */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Price Information */}
            <div className="space-y-2">
              <div className="text-sm text-gray-500 dark:text-gray-400">Precio unitario:</div>
              {item.discountAmount && item.discountAmount > 0 ? (
                <>
                  <div className="text-sm text-gray-400 line-through" data-testid={`text-unit-price-original-${item.productId}`}>
                    {formatPrice(item.unitPrice)}
                  </div>
                  <div className="text-xl font-bold text-emerald-600" data-testid={`text-unit-price-${item.productId}`}>
                    {formatPrice(item.unitPriceAfterDiscount || item.unitPrice)}
                  </div>
                  <div className="inline-flex items-center gap-1 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-semibold px-1.5 py-0.5 rounded-md">
                    🏷️ {discountPercent > 0 ? `Cupón aplicado (-${discountPercent}%)` : 'Cupón aplicado'}
                  </div>
                </>
              ) : item.originalPrice && item.originalPrice > item.unitPrice ? (
                <>
                  <div className="text-sm text-gray-400 line-through" data-testid={`text-unit-price-original-${item.productId}`}>
                    {formatPrice(item.originalPrice)}
                  </div>
                  <div className={`text-xl font-bold ${item.isPalletPurchase ? 'text-blue-700' : item.isOffer ? 'text-rose-600' : 'text-emerald-600'}`} data-testid={`text-unit-price-${item.productId}`}>
                    {formatPrice(item.unitPrice)}
                  </div>
                  {item.isPalletPurchase ? (
                    <div className="inline-flex items-center gap-1 bg-blue-50 border border-blue-200 text-blue-700 text-[10px] font-semibold px-1.5 py-0.5 rounded-md" title={`Pallet completo: ${item.quantity} unidades${item.palletDiscountPct ? ` con ${item.palletDiscountPct}% off` : ''}`}>
                      🟦 Pallet completo {item.palletDiscountPct ? `-${item.palletDiscountPct}%` : ''}
                    </div>
                  ) : item.isOffer ? (
                    <div className="inline-flex items-center gap-1 bg-rose-50 border border-rose-200 text-rose-700 text-[10px] font-semibold px-1.5 py-0.5 rounded-md">
                      🔥 Precio oferta
                    </div>
                  ) : item.convenioPct ? (
                    <div className="inline-flex items-center gap-1 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-semibold px-1.5 py-0.5 rounded-md" title="Descuento por convenio aplicado sobre la lista asignada">
                      🤝 Convenio -{item.convenioPct}%
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="text-xl font-bold text-gray-900 dark:text-white" data-testid={`text-unit-price-${item.productId}`}>
                  {formatPrice(item.unitPrice)}
                </div>
              )}
              <div className="text-xs text-gray-400">
                Por {currentPackaging.toLowerCase()}
              </div>
            </div>

            {/* Quantity Controls */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Cantidad</Label>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={decrementQuantity}
                  disabled={item.quantity <= item.minQuantity}
                  className="h-9 w-9 p-0"
                  data-testid={`button-decrease-${item.productId}`}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                
                <div className="relative">
                  <Input
                    type="number"
                    value={quantityInput}
                    onChange={(e) => handleQuantityInputChange(e.target.value)}
                    onFocus={handleQuantityInputFocus}
                    onBlur={handleQuantityInputBlur}
                    onKeyDown={handleQuantityInputKeyDown}
                    className={`w-20 text-center h-9 ${
                      validationStatus === 'error' 
                        ? 'border-red-500 focus:border-red-500 focus:ring-red-500' 
                        : validationStatus === 'warning'
                        ? 'border-yellow-500 focus:border-yellow-500 focus:ring-yellow-500'
                        : ''
                    }`}
                    min={item.minQuantity}
                    step={item.quantityStep}
                    data-testid={`input-quantity-${item.productId}`}
                  />
                </div>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={incrementQuantity}
                  className="h-9 w-9 p-0"
                  data-testid={`button-increase-${item.productId}`}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="text-xs text-gray-400">
                {item.quantityStep > 1 && `Mínimo ${item.minQuantity}, múltiplos de ${item.quantityStep}`}
                {item.quantityStep === 1 && `Mínimo ${item.minQuantity}`}
              </div>
              
              {/* Real-time validation feedback */}
              {isEditing && validationMessage && (
                <div className={`text-xs mt-1 ${
                  validationStatus === 'error' 
                    ? 'text-red-500' 
                    : validationStatus === 'warning'
                    ? 'text-yellow-600'
                    : 'text-green-500'
                }`} data-testid={`validation-message-${item.productId}`}>
                  {validationMessage}
                </div>
              )}
            </div>

            {/* Subtotal and Remove */}
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Subtotal:</div>
                {item.discountAmount && item.discountAmount > 0 ? (
                  <>
                    <div className="text-sm text-gray-400 line-through">
                      {formatPrice(item.subtotal)}
                    </div>
                    <div className="text-2xl font-bold text-emerald-600" data-testid={`text-subtotal-${item.productId}`}>
                      {formatPrice(item.subtotalAfterDiscount || item.subtotal)}
                    </div>
                    <div className="text-xs text-emerald-600 font-medium">
                      -{formatPrice(item.discountAmount)} dcto. {discountPercent > 0 && `(-${discountPercent}%)`}
                    </div>
                  </>
                ) : item.originalPrice && item.originalPrice > item.unitPrice ? (
                  <>
                    <div className="text-sm text-gray-400 line-through">
                      {formatPrice(item.originalPrice * item.quantity)}
                    </div>
                    <div className={`text-2xl font-bold ${item.isPalletPurchase ? 'text-blue-700' : item.isOffer ? 'text-rose-600' : 'text-emerald-600'}`} data-testid={`text-subtotal-${item.productId}`}>
                      {formatPrice(item.subtotal)}
                    </div>
                    <div className="text-xs text-gray-400">
                      {formatPrice(item.unitPrice)} × {item.quantity}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-2xl font-bold text-[#FF6E23]" data-testid={`text-subtotal-${item.productId}`}>
                      {formatPrice(item.subtotal)}
                    </div>
                    <div className="text-xs text-gray-400">
                      {formatPrice(item.unitPrice)} × {item.quantity}
                    </div>
                  </>
                )}
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={handleRemove}
                className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950 border-red-200 dark:border-red-800"
                data-testid={`button-remove-${item.productId}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Variations Summary */}
          {(item.selectedColor || item.selectedFinish) && (
            <div className="flex gap-2">
              {item.selectedColor && (
                <Badge variant="outline" className="text-xs">
                  Color: {item.selectedColor}
                </Badge>
              )}
              {item.selectedFinish && (
                <Badge variant="outline" className="text-xs">
                  Acabado: {item.selectedFinish}
                </Badge>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Divider */}
      {showDivider && (
        <Separator className="mt-6" />
      )}
    </div>
  );
}