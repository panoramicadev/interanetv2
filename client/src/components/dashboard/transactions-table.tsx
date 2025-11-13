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
import React from "react";
import { Link } from "wouter";
import { ChevronDown, ChevronUp } from "lucide-react";
import TransactionDetailModal from "./transaction-detail-modal";
import type { Transaction, GroupedSale } from "@/types/sales";

interface TopSalesperson {
  salesperson: string;
  totalSales: number;
  transactionCount: number;
}

interface TransactionsTableProps {
  selectedPeriod: string;
  filterType: "day" | "month" | "year" | "range";
  segment?: string;
  salesperson?: string;
}

export default function TransactionsTable({ selectedPeriod, filterType, segment, salesperson }: TransactionsTableProps) {
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [expandedSales, setExpandedSales] = useState<Set<string>>(new Set());
  const [isOrdersExpanded, setIsOrdersExpanded] = useState(false);

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


  const { data: allTransactions, isLoading, isError } = useQuery<Transaction[]>({
    queryKey: ['/api/sales/transactions', { limit: 100, period: selectedPeriod, filterType, segment, salesperson }],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('limit', '100');
      params.append('period', selectedPeriod);
      params.append('filterType', filterType);
      if (segment) params.append('segment', segment);
      if (salesperson) params.append('salesperson', salesperson);
      
      const response = await fetch(`/api/sales/transactions?${params}`, { 
        credentials: 'include',
        cache: 'no-store' // Bypass browser cache to avoid 304 issues
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return response.json();
    },
  });


  const allGroupedSales = allTransactions ? groupTransactionsByNudo(allTransactions) : [];
  const groupedSales = isOrdersExpanded ? allGroupedSales : allGroupedSales.slice(0, 5);

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
        <div className="flex items-center space-x-2 sm:space-x-3">
          <div className="w-6 h-6 sm:w-8 sm:h-8 bg-blue-100 rounded-lg flex items-center justify-center">
            <span className="text-xs sm:text-sm font-medium text-blue-600">📋</span>
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-gray-900">Órdenes Recientes</h2>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/ordenes">
            <Button
              variant="outline"
              size="sm"
              className="text-xs px-3 py-1"
              data-testid="button-view-all-orders"
            >
              Ver todas las órdenes
            </Button>
          </Link>
        </div>
      </div>
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-gray-100">
                  <TableHead className="text-xs sm:text-sm font-medium text-gray-500 py-3 sm:py-4">Cliente</TableHead>
                  <TableHead className="text-xs sm:text-sm font-medium text-gray-500 px-2 sm:px-4">Vendedor</TableHead>
                  <TableHead className="text-xs sm:text-sm font-medium text-gray-500">ID</TableHead>
                  <TableHead className="text-xs sm:text-sm font-medium text-gray-500">Tiempo</TableHead>
                  <TableHead className="text-xs sm:text-sm font-medium text-gray-500 text-right">Monto</TableHead>
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
                ) : isError ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-red-600">
                      Error al cargar las transacciones. Por favor, intenta nuevamente.
                    </TableCell>
                  </TableRow>
                ) : groupedSales.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No se encontraron órdenes para el período seleccionado.
                    </TableCell>
                  </TableRow>
                ) : (
                  groupedSales.map((sale) => {
                    const salesperson = getSalespersonDisplay(sale.salesperson);
                    const timeAgo = getTimeAgo(sale.date);
                    const isExpanded = expandedSales.has(sale.nudo);
                    
                    return (
                      <React.Fragment key={sale.nudo}>
                        {/* Sale Summary Row */}
                        <TableRow 
                          key={sale.nudo}
                          className="border-b border-gray-50 hover:bg-blue-50/50 cursor-pointer transition-colors"
                          data-testid={`sale-${sale.nudo}`}
                          onClick={() => toggleSaleExpansion(sale.nudo)}
                          title="Haz clic para ver los productos en esta orden"
                        >
                          <TableCell className="py-3 sm:py-4">
                            <div className="flex items-center space-x-2 sm:space-x-3">
                              {/* Hide avatar on mobile, show on desktop */}
                              <div className="hidden sm:flex w-10 h-10 bg-gray-600 rounded-full items-center justify-center">
                                <span className="text-white text-sm font-medium">
                                  {getInitials(sale.customerName)}
                                </span>
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="font-medium text-gray-900 text-sm sm:text-base truncate">{sale.customerName}</div>
                                <div className="text-xs sm:text-sm text-gray-500">
                                  {sale.transactionCount} producto{sale.transactionCount > 1 ? 's' : ''}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="px-2 sm:px-4">
                            <span className={`inline-flex px-1.5 sm:px-2 py-1 text-xs font-medium rounded-full ${salesperson.color} max-w-full`}>
                              <span className="truncate">{salesperson.name}</span>
                            </span>
                          </TableCell>
                          <TableCell className="text-gray-600 font-medium text-xs sm:text-sm">
                            <span className="hidden sm:inline">#</span>{sale.nudo}
                          </TableCell>
                          <TableCell className="text-gray-500 text-xs sm:text-sm">
                            {timeAgo}
                          </TableCell>
                          <TableCell className="text-right font-semibold text-gray-900">
                            <div className="flex items-center justify-end gap-1 sm:gap-2">
                              <span className="text-sm sm:text-base">
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
                            title="Haz clic para ver los detalles completos de este producto en orden"
                          >
                            <TableCell className="py-2 pl-12">
                              <div className="text-sm text-gray-600">
                                {transaction.nokopr || 'Producto no especificado'}
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
                      </React.Fragment>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
          
          {/* Ver más button - only show if more than 5 orders */}
          {allGroupedSales.length > 5 && (
            <div className="p-4 border-t border-gray-200">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsOrdersExpanded(!isOrdersExpanded)}
                className="w-full"
                data-testid="button-toggle-orders"
              >
                {isOrdersExpanded ? (
                  <>
                    Ver menos
                    <ChevronUp className="ml-2 h-4 w-4" />
                  </>
                ) : (
                  <>
                    Ver más ({allGroupedSales.length - 5} órdenes adicionales)
                    <ChevronDown className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          )}
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
