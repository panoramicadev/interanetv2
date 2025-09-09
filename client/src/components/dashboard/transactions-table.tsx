import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useState } from "react";
import { Link } from "wouter";
import TransactionDetailModal from "./transaction-detail-modal";

interface Transaction {
  id: string;
  nudo: string;
  feemdo: string | null;
  nokoen: string | null;
  nokoprct: string | null;
  nokofu: string | null;
  caprad2: string | null;
  vanedo: string | null;
  monto: string | null;
}

interface GroupedSale {
  nudo: string;
  customerName: string;
  salesperson: string;
  date: string;
  totalAmount: number;
  transactionCount: number;
  transactions: Transaction[];
  isExpanded?: boolean;
}

interface TopSalesperson {
  salesperson: string;
  totalSales: number;
  transactionCount: number;
}

interface TransactionsTableProps {
  selectedPeriod: string;
  filterType: "day" | "month" | "range";
  salespersonFilter?: string;
}

export default function TransactionsTable({ selectedPeriod, filterType, salespersonFilter }: TransactionsTableProps) {
  const [limit] = useState(10);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [expandedSales, setExpandedSales] = useState<Set<string>>(new Set());

  const handleTransactionClick = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setIsModalOpen(true);
  };

  const toggleSaleExpansion = (nudo: string) => {
    const newExpanded = new Set(expandedSales);
    if (newExpanded.has(nudo)) {
      newExpanded.delete(nudo);
    } else {
      newExpanded.add(nudo);
    }
    setExpandedSales(newExpanded);
  };

  // Group transactions by NUDO (sale)
  const groupTransactionsByNudo = (transactions: Transaction[]): GroupedSale[] => {
    const grouped = transactions.reduce((acc, transaction) => {
      const nudo = transaction.nudo;
      if (!acc[nudo]) {
        acc[nudo] = {
          nudo,
          customerName: transaction.nokoen || 'Cliente Anónimo',
          salesperson: transaction.nokofu || 'Sin vendedor',
          date: transaction.feemdo || '',
          totalAmount: 0,
          transactionCount: 0,
          transactions: []
        };
      }
      
      acc[nudo].transactions.push(transaction);
      acc[nudo].transactionCount++;
      
      // Use monto if available, fallback to vanedo
      const amount = transaction.monto ? Number(transaction.monto) : (transaction.vanedo ? Number(transaction.vanedo) : 0);
      acc[nudo].totalAmount += amount;
      
      return acc;
    }, {} as Record<string, GroupedSale>);
    
    return Object.values(grouped).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  const { data: transactions, isLoading } = useQuery<Transaction[]>({
    queryKey: [`/api/sales/transactions?limit=${limit}&period=${selectedPeriod}&filterType=${filterType}${salespersonFilter ? `&salesperson=${encodeURIComponent(salespersonFilter)}` : ''}`],
  });

  const groupedSales = transactions ? groupTransactionsByNudo(transactions) : [];

  // Removed artificial salesperson assignment - now using real data from transactions

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getSalespersonDisplay = (salespersonName: string | null) => {
    if (!salespersonName) {
      return { name: 'Sin vendedor asignado', color: 'bg-gray-100 text-gray-600' };
    }
    
    // Generate consistent color based on salesperson name
    const colors = [
      'bg-blue-100 text-blue-800',
      'bg-green-100 text-green-800', 
      'bg-purple-100 text-purple-800',
      'bg-orange-100 text-orange-800',
      'bg-teal-100 text-teal-800',
      'bg-pink-100 text-pink-800'
    ];
    
    // Simple hash based on salesperson name for consistent coloring
    const hash = salespersonName.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    
    const colorIndex = Math.abs(hash) % colors.length;
    
    return {
      name: salespersonName,
      color: colors[colorIndex]
    };
  };

  const getTimeAgo = (dateString: string | null) => {
    if (!dateString) return 'sin fecha';
    
    try {
      const transactionDate = new Date(dateString);
      
      // Verificar si la fecha es válida
      if (isNaN(transactionDate.getTime())) {
        return 'fecha inválida';
      }
      
      const now = new Date();
      const diffInMs = now.getTime() - transactionDate.getTime();
      
      const minutes = Math.floor(diffInMs / (1000 * 60));
      const hours = Math.floor(diffInMs / (1000 * 60 * 60));
      const days = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
      const months = Math.floor(days / 30);
      
      if (months > 0) {
        return `hace ${months} mes${months > 1 ? 'es' : ''}`;
      } else if (days > 0) {
        return `hace ${days} día${days > 1 ? 's' : ''}`;
      } else if (hours > 0) {
        return `hace ${hours} hora${hours > 1 ? 's' : ''}`;
      } else if (minutes > 0) {
        return `hace ${minutes} min`;
      } else {
        return 'hace unos segundos';
      }
    } catch (error) {
      console.error('Error parsing date:', dateString, error);
      return 'error en fecha';
    }
  };

  const getClientContact = (name: string) => {
    // Don't generate fake emails - show honest placeholder
    return 'Email no disponible';
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
            <span className="text-sm font-medium text-blue-600">📋</span>
          </div>
          <h2 className="text-xl font-bold text-gray-900">Ventas Recientes</h2>
        </div>
        <Button variant="outline" size="sm" className="text-gray-600 border-gray-300 hover:bg-gray-50" data-testid="button-view-all">
          Últimas 24h ▼
        </Button>
      </div>
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-gray-100">
                  <TableHead className="text-sm font-medium text-gray-500 py-4">Cliente</TableHead>
                  <TableHead className="text-sm font-medium text-gray-500">Vendedor</TableHead>
                  <TableHead className="text-sm font-medium text-gray-500">ID Cliente</TableHead>
                  <TableHead className="text-sm font-medium text-gray-500">Tiempo</TableHead>
                  <TableHead className="text-sm font-medium text-gray-500 text-right">Monto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  [...Array(5)].map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><div className="h-4 bg-muted rounded animate-pulse"></div></TableCell>
                      <TableCell><div className="h-4 bg-muted rounded animate-pulse"></div></TableCell>
                      <TableCell><div className="h-4 bg-muted rounded animate-pulse"></div></TableCell>
                      <TableCell><div className="h-4 bg-muted rounded animate-pulse"></div></TableCell>
                      <TableCell><div className="h-4 bg-muted rounded animate-pulse"></div></TableCell>
                    </TableRow>
                  ))
                ) : (
                  groupedSales.map((sale) => {
                    const salesperson = getSalespersonDisplay(sale.salesperson);
                    const timeAgo = getTimeAgo(sale.date);
                    const isExpanded = expandedSales.has(sale.nudo);
                    
                    return (
                      <>
                        {/* Sale Summary Row */}
                        <TableRow 
                          key={sale.nudo}
                          className="border-b border-gray-50 hover:bg-blue-50/50 cursor-pointer transition-colors"
                          data-testid={`sale-${sale.nudo}`}
                          onClick={() => toggleSaleExpansion(sale.nudo)}
                          title="Haz clic para ver las transacciones de esta venta"
                        >
                          <TableCell className="py-4">
                            <div className="flex items-center space-x-3">
                              <div className="w-10 h-10 bg-gray-600 rounded-full flex items-center justify-center">
                                <span className="text-white text-sm font-medium">
                                  {getInitials(sale.customerName)}
                                </span>
                              </div>
                              <div>
                                <div className="font-medium text-gray-900">{sale.customerName}</div>
                                <div className="text-sm text-gray-500">
                                  {sale.transactionCount} transacción{sale.transactionCount > 1 ? 'es' : ''}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${salesperson.color}`}>
                              {salesperson.name}
                            </span>
                          </TableCell>
                          <TableCell className="text-gray-600 font-medium">
                            #{sale.nudo}
                          </TableCell>
                          <TableCell className="text-gray-500 text-sm">
                            {timeAgo}
                          </TableCell>
                          <TableCell className="text-right font-semibold text-gray-900">
                            <div className="flex items-center justify-end gap-2">
                              <span>
                                {formatCurrency(sale.totalAmount)}
                              </span>
                              <span className="text-xs text-blue-600">
                                {isExpanded ? '▲' : '▼'}
                              </span>
                            </div>
                          </TableCell>
                        </TableRow>
                        
                        {/* Expanded Transaction Details */}
                        {isExpanded && sale.transactions.map((transaction, index) => (
                          <TableRow 
                            key={`${sale.nudo}-${transaction.id}`}
                            className="bg-gray-50 border-b border-gray-100 hover:bg-gray-100 cursor-pointer transition-colors"
                            data-testid={`transaction-${transaction.id}`}
                            onClick={() => handleTransactionClick(transaction)}
                            title="Haz clic para ver los detalles completos de esta transacción"
                          >
                            <TableCell className="py-2 pl-12">
                              <div className="text-sm text-gray-600">
                                Línea {index + 1}: {transaction.nokoprct || 'Producto no especificado'}
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-gray-500">
                              ID: {transaction.id.slice(0, 8)}...
                            </TableCell>
                            <TableCell className="text-sm text-gray-500">
                              {transaction.caprad2 || 'Sin código'}
                            </TableCell>
                            <TableCell className="text-sm text-gray-500">
                              {getTimeAgo(transaction.feemdo)}
                            </TableCell>
                            <TableCell className="text-right text-sm font-medium text-gray-700">
                              {transaction.monto ? formatCurrency(Number(transaction.monto)) : 
                               transaction.vanedo ? formatCurrency(Number(transaction.vanedo)) : '$0'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
      </div>

      {/* Modal de Detalles */}
      {selectedTransaction && (
        <TransactionDetailModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedTransaction(null);
          }}
          transactionId={selectedTransaction.id}
          nudo={selectedTransaction.nudo}
        />
      )}
    </div>
  );
}
