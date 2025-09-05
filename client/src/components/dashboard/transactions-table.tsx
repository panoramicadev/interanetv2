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

interface Transaction {
  id: string;
  nudo: string;
  feemdo: string | null;
  nokoen: string | null;
  nokoprct: string | null;
  nokofu: string | null;
  caprad2: string | null;
  monto: string | null;
}

interface TopSalesperson {
  salesperson: string;
  totalSales: number;
  transactionCount: number;
}

interface TransactionsTableProps {
  selectedPeriod: string;
  filterType: "day" | "month" | "range";
}

export default function TransactionsTable({ selectedPeriod, filterType }: TransactionsTableProps) {
  const [limit] = useState(10);
  
  const { data: transactions, isLoading } = useQuery<Transaction[]>({
    queryKey: [`/api/sales/transactions?limit=${limit}&period=${selectedPeriod}&filterType=${filterType}`],
  });

  // Removed top salespeople query - now handled by separate component

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getRandomSalesperson = () => {
    const salespeople = [
      { name: 'Carlos Mendoza', color: 'bg-blue-100 text-blue-800' },
      { name: 'Ana García', color: 'bg-green-100 text-green-800' },
      { name: 'Luis Rodríguez', color: 'bg-purple-100 text-purple-800' },
      { name: 'María Silva', color: 'bg-orange-100 text-orange-800' }
    ];
    return salespeople[Math.floor(Math.random() * salespeople.length)];
  };

  const getTimeAgo = () => {
    const times = ['hace 5 min', 'hace 10 min', 'hace 15 min', 'hace 20 min', 'hace 1 hora'];
    return times[Math.floor(Math.random() * times.length)];
  };

  const generateEmail = (name: string) => {
    return `${name.toLowerCase().replace(/\s+/g, '.')}@email.com`;
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
          <h2 className="text-xl font-bold text-gray-900">Transacciones Recientes</h2>
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
                  transactions?.map((transaction) => {
                    const customerName = transaction.nokoen || 'Cliente Anónimo';
                    const salesperson = getRandomSalesperson();
                    const timeAgo = getTimeAgo();
                    
                    return (
                      <TableRow 
                        key={transaction.id}
                        className="border-b border-gray-50 hover:bg-gray-50/50"
                        data-testid={`transaction-${transaction.id}`}
                      >
                        <TableCell className="py-4">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-gray-600 rounded-full flex items-center justify-center">
                              <span className="text-white text-sm font-medium">
                                {getInitials(customerName)}
                              </span>
                            </div>
                            <div>
                              <div className="font-medium text-gray-900">{customerName}</div>
                              <div className="text-sm text-gray-500">{generateEmail(customerName)}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${salesperson.color}`}>
                            {salesperson.name}
                          </span>
                        </TableCell>
                        <TableCell className="text-gray-600 font-medium">
                          #{transaction.nudo}
                        </TableCell>
                        <TableCell className="text-gray-500 text-sm">
                          {timeAgo}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-gray-900">
                          {transaction.monto ? formatCurrency(Number(transaction.monto)) : '$0'}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
      </div>
    </div>
  );
}
