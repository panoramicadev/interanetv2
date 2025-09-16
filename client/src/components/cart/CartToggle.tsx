import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart } from "lucide-react";
import { useCart } from "@/hooks/useCart";

interface CartToggleProps {
  onClick: () => void;
  className?: string;
}

export default function CartToggle({ onClick, className = "" }: CartToggleProps) {
  const { state } = useCart();
  
  const itemCount = state.unitCount; // Total quantity of all items, not just different products

  return (
    <Button 
      variant="ghost" 
      className={`relative p-2 hover:bg-[#FF6E23]/10 ${className}`}
      onClick={onClick}
      data-testid="button-cart-toggle"
    >
      <ShoppingCart className="h-6 w-6 text-gray-700" />
      {itemCount > 0 && (
        <Badge 
          className="absolute -top-2 -right-2 bg-[#FF6E23] hover:bg-[#FF6E23] text-white text-xs w-5 h-5 rounded-full flex items-center justify-center p-0 border-2 border-white"
          data-testid="badge-cart-count"
        >
          {itemCount > 99 ? '99+' : itemCount}
        </Badge>
      )}
    </Button>
  );
}