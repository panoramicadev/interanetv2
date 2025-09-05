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

export default function TransactionsTable() {
  const [limit] = useState(10);
  
  const { data: transactions, isLoading } = useQuery<Transaction[]>({
    queryKey: [`/api/sales/transactions?limit=${limit}`],
  });

  const { data: topSalespeople } = useQuery<TopSalesperson[]>({
    queryKey: ["/api/sales/top-salespeople?limit=3"],
  });

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
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      {/* Top Salespeople */}
      <Card>
        <CardHeader>
          <CardTitle>Top Vendedores</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {isLoading ? (
              [...Array(3)].map((_, i) => (
                <div key={i} className="animate-pulse flex items-center space-x-3">
                  <div className="w-8 h-8 bg-muted rounded-full"></div>
                  <div className="flex-1 space-y-1">
                    <div className="h-4 bg-muted rounded w-24"></div>
                    <div className="h-3 bg-muted rounded w-16"></div>
                  </div>
                  <div className="space-y-1">
                    <div className="h-4 bg-muted rounded w-16"></div>
                    <div className="h-3 bg-muted rounded w-8"></div>
                  </div>
                </div>
              ))
            ) : (
              topSalespeople?.map((person, index) => (
                <div 
                  key={person.salesperson} 
                  className="flex items-center justify-between"
                  data-testid={`salesperson-${index}`}
                >
                  <div className="flex items-center space-x-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      index === 0 ? 'bg-gradient-to-r from-blue-500 to-purple-600' :
                      index === 1 ? 'bg-gradient-to-r from-green-500 to-blue-600' :
                      'bg-gradient-to-r from-orange-500 to-red-600'
                    }`}>
                      <span className="text-xs font-medium text-white">
                        {getInitials(person.salesperson)}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {person.salesperson}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {person.transactionCount} transacciones
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-foreground">
                      {formatCurrency(person.totalSales)}
                    </p>
                    <p className="text-xs text-green-600">+18%</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Recent Transactions */}
      <Card className="xl:col-span-2">
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
                        {transaction.nokoen || 'N/A'}
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
    </div>
  );
}
