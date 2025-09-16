import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Minus, Plus, Trash2 } from "lucide-react";
import { useCart } from "@/hooks/useCart";
import { CartItem as CartItemType } from "@shared/schema";

interface CartItemProps {
  item: CartItemType;
  compact?: boolean; // For floating cart vs full cart page
}

const formatPrice = (price: number): string => {
  return `$${new Intl.NumberFormat('es-CL', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price)}`;
};

const getPackagingDisplay = (unit: string, selectedPackaging?: string): string => {
  if (selectedPackaging) return selectedPackaging;
  
  // Enhanced unit display mapping
  const unitDisplayMap: Record<string, string> = {
    'GL': 'Galón',
    'GAL': 'Galón', 
    'GALON': 'Galón',
    'BD4': 'Balde 4 Galones',
    'BD5': 'Balde 5 Galones',
    'BALDE': 'Balde',
    '1/4': '1/4 de Galón',
    'CUARTO': '1/4 de Galón',
    'LT': 'Litro',
    'LITRO': 'Litro',
    'KG': 'Kilogramo',
    'KILO': 'Kilogramo',
    'GR': 'Gramo',
    'UN': 'Unidad',
    'UNIDAD': 'Unidad'
  };
  
  const normalizedUnit = unit.toUpperCase().trim();
  return unitDisplayMap[normalizedUnit] || unit || 'Unidad';
};

export default function CartItem({ item, compact = false }: CartItemProps) {
  const { updateQuantity, removeItem } = useCart();

  const handleQuantityChange = (newQuantity: number) => {
    if (newQuantity <= 0) {
      removeItem(item.id);
    } else {
      updateQuantity(item.id, newQuantity);
    }
  };

  const incrementQuantity = () => {
    const newQuantity = item.quantity + item.quantityStep;
    updateQuantity(item.id, newQuantity);
  };

  const decrementQuantity = () => {
    const newQuantity = Math.max(item.minQuantity, item.quantity - item.quantityStep);
    if (newQuantity < item.minQuantity) {
      removeItem(item.id);
    } else {
      updateQuantity(item.id, newQuantity);
    }
  };

  const handleRemove = () => {
    removeItem(item.id);
  };

  if (compact) {
    // Compact version for floating cart
    return (
      <div className="flex items-center gap-3 p-3 border-b border-gray-100 last:border-b-0">
        {/* Product Image */}
        <div className="flex-shrink-0 w-12 h-12 bg-gray-100 rounded-md overflow-hidden">
          {item.imageUrl ? (
            <img
              src={item.imageUrl}
              alt={item.productName}
              className="w-full h-full object-cover"
              data-testid={`img-cart-item-${item.productId}`}
            />
          ) : (
            <div className="w-full h-full bg-gray-200 flex items-center justify-center">
              <span className="text-gray-400 text-xs font-medium">
                {item.productCode}
              </span>
            </div>
          )}
        </div>

        {/* Product Details */}
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-gray-900 truncate" data-testid={`text-cart-item-name-${item.productId}`}>
            {item.productName}
          </h4>
          <p className="text-xs text-gray-500 truncate">
            {getPackagingDisplay(item.unit, item.selectedPackaging)}
          </p>
          
          {/* Color/Finish badges if present */}
          <div className="flex gap-1 mt-1">
            {item.selectedColor && (
              <Badge variant="outline" className="text-xs h-5 px-1">
                {item.selectedColor}
              </Badge>
            )}
            {item.selectedFinish && (
              <Badge variant="outline" className="text-xs h-5 px-1">
                {item.selectedFinish}
              </Badge>
            )}
          </div>
        </div>

        {/* Price and Controls */}
        <div className="flex flex-col items-end gap-2">
          <span className="text-sm font-semibold text-gray-900" data-testid={`text-cart-item-subtotal-${item.productId}`}>
            {formatPrice(item.subtotal)}
          </span>
          
          {/* Quantity Controls */}
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={decrementQuantity}
              disabled={item.quantity <= item.minQuantity}
              data-testid={`button-decrease-quantity-${item.productId}`}
            >
              <Minus className="h-3 w-3" />
            </Button>
            
            <span className="text-sm font-medium min-w-[2rem] text-center" data-testid={`text-quantity-${item.productId}`}>
              {item.quantity}
            </span>
            
            <Button
              variant="outline"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={incrementQuantity}
              data-testid={`button-increase-quantity-${item.productId}`}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>

          {/* Remove button */}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-gray-400 hover:text-red-500"
            onClick={handleRemove}
            data-testid={`button-remove-item-${item.productId}`}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
    );
  }

  // Full version for cart page
  return (
    <Card className="w-full" data-testid={`card-cart-item-${item.productId}`}>
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          {/* Product Image */}
          <div className="flex-shrink-0 w-20 h-20 bg-gray-100 rounded-lg overflow-hidden">
            {item.imageUrl ? (
              <img
                src={item.imageUrl}
                alt={item.productName}
                className="w-full h-full object-cover"
                data-testid={`img-cart-item-full-${item.productId}`}
              />
            ) : (
              <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                <span className="text-gray-400 text-sm font-medium">
                  {item.productCode}
                </span>
              </div>
            )}
          </div>

          {/* Product Details */}
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-1" data-testid={`text-cart-item-full-name-${item.productId}`}>
              {item.productName}
            </h3>
            <p className="text-sm text-gray-600 mb-2">
              Código: {item.productCode}
            </p>
            <p className="text-sm text-gray-600 mb-2">
              {getPackagingDisplay(item.unit, item.selectedPackaging)}
            </p>
            
            {/* Variations */}
            <div className="flex gap-2 mb-3">
              {item.selectedColor && (
                <Badge variant="secondary">
                  Color: {item.selectedColor}
                </Badge>
              )}
              {item.selectedFinish && (
                <Badge variant="secondary">
                  Acabado: {item.selectedFinish}
                </Badge>
              )}
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {/* Unit Price */}
                <div>
                  <span className="text-sm text-gray-500">Precio unitario:</span>
                  <p className="font-semibold">{formatPrice(item.unitPrice)}</p>
                </div>

                {/* Quantity Controls */}
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-500">Cantidad:</span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={decrementQuantity}
                      disabled={item.quantity <= item.minQuantity}
                      data-testid={`button-decrease-full-${item.productId}`}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    
                    <span className="font-medium min-w-[3rem] text-center" data-testid={`text-quantity-full-${item.productId}`}>
                      {item.quantity}
                    </span>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={incrementQuantity}
                      data-testid={`button-increase-full-${item.productId}`}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Subtotal and Remove */}
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <span className="text-sm text-gray-500">Subtotal:</span>
                  <p className="text-xl font-bold text-[#FF6E23]" data-testid={`text-subtotal-full-${item.productId}`}>
                    {formatPrice(item.subtotal)}
                  </p>
                </div>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRemove}
                  className="text-red-500 hover:text-red-700 hover:bg-red-50"
                  data-testid={`button-remove-full-${item.productId}`}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Eliminar
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}