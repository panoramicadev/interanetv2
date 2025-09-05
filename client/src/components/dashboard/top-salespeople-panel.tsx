import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UserCheck, TrendingUp } from "lucide-react";
import { Link } from "wouter";

interface TopSalesperson {
  salesperson: string;
  totalSales: number;
  transactionCount: number;
}

interface TopSalespeoplePanelProps {
  selectedPeriod: string;
  filterType: "day" | "month" | "range";
}

export default function TopSalespeoplePanel({ selectedPeriod, filterType }: TopSalespeoplePanelProps) {
  const { data: topSalespeople, isLoading } = useQuery<TopSalesperson[]>({
    queryKey: [`/api/sales/top-salespeople?limit=8&period=${selectedPeriod}&filterType=${filterType}`],
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getSalespersonInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getGradientColor = (index: number) => {
    const gradients = [
      'from-purple-500 to-pink-600',
      'from-blue-500 to-indigo-600', 
      'from-green-500 to-teal-600',
      'from-orange-500 to-yellow-600',
      'from-red-500 to-rose-600',
      'from-cyan-500 to-blue-600',
      'from-violet-500 to-purple-600',
      'from-emerald-500 to-green-600',
    ];
    return gradients[index % gradients.length];
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5" />
            Top Vendedores
          </CardTitle>
          <Badge variant="secondary" className="gap-1">
            <TrendingUp className="h-3 w-3" />
            {topSalespeople?.length || 0}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {isLoading ? (
            [...Array(5)].map((_, i) => (
              <div key={i} className="animate-pulse flex items-center space-x-3">
                <div className="w-12 h-12 bg-muted rounded-full"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded w-32"></div>
                  <div className="h-3 bg-muted rounded w-24"></div>
                </div>
                <div className="space-y-1">
                  <div className="h-4 bg-muted rounded w-20"></div>
                  <div className="h-3 bg-muted rounded w-16"></div>
                </div>
              </div>
            ))
          ) : (
            topSalespeople?.map((salesperson, index) => (
              <Link 
                key={salesperson.salesperson} 
                href={`/salesperson/${encodeURIComponent(salesperson.salesperson)}`}
              >
                <div 
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer hover:scale-105 hover:shadow-md"
                  data-testid={`salesperson-${index}`}
                >
                  <div className="flex items-center space-x-3">
                    <div className={`w-12 h-12 rounded-full bg-gradient-to-r ${getGradientColor(index)} flex items-center justify-center text-white font-bold text-sm`}>
                      {getSalespersonInitials(salesperson.salesperson)}
                    </div>
                    <div>
                      <p className="font-medium text-sm leading-tight hover:text-purple-600 transition-colors">
                        {salesperson.salesperson}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {salesperson.transactionCount} transacciones
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-sm">
                      {formatCurrency(salesperson.totalSales)}
                    </p>
                    <div className="flex items-center gap-1">
                      <div className={`w-2 h-2 rounded-full bg-gradient-to-r ${getGradientColor(index)}`}></div>
                      <span className="text-xs text-muted-foreground">
                        #{index + 1}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
        
        {!isLoading && topSalespeople && topSalespeople.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Total vendedores activos</span>
              <span className="font-medium">{topSalespeople.length}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}