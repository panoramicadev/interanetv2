import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import OrdersContent from "./orders-content";

interface OrdersModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function OrdersModal({ open, onOpenChange }: OrdersModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-full h-[90vh] p-6 overflow-y-auto" data-testid="orders-modal">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Todas las Órdenes</DialogTitle>
          <DialogDescription>
            Visualiza y filtra todas las transacciones de ventas del sistema
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4">
          <OrdersContent />
        </div>
      </DialogContent>
    </Dialog>
  );
}
