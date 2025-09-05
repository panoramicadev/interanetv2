import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-CL');
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
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Transacciones Recientes</CardTitle>
          <Button variant="link" size="sm" data-testid="button-view-all">
            Ver todas
          </Button>
        </div>
      </CardHeader>
      <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Transacción</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead>Cantidad</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
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
                  transactions?.map((transaction) => (
                    <TableRow 
                      key={transaction.id}
                      data-testid={`transaction-${transaction.id}`}
                    >
                      <TableCell className="font-medium">
                        {transaction.nudo}
                      </TableCell>
                      <TableCell>
                        {transaction.nokoen && transaction.nokoen !== 'N/A' ? (
                          <Link href={`/client/${encodeURIComponent(transaction.nokoen)}`}>
                            <span className="hover:text-blue-600 hover:underline cursor-pointer">
                              {transaction.nokoen}
                            </span>
                          </Link>
                        ) : (
                          'N/A'
                        )}
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {transaction.nokoprct || 'N/A'}
                      </TableCell>
                      <TableCell>
                        {transaction.caprad2 ? `${transaction.caprad2} GL` : 'N/A'}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {transaction.monto ? formatCurrency(Number(transaction.monto)) : 'N/A'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
    </Card>
  );
}
