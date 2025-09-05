import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart } from "@/components/ui/charts";

interface TopProduct {
  productName: string;
  totalSales: number;
  totalUnits: number;
}

export default function TopProductsChart() {
  const { data: topProducts, isLoading } = useQuery<TopProduct[]>({
    queryKey: ["/api/sales/top-products?limit=5"],
  });

  const getProductCategory = (productName: string) => {
    const name = productName.toLowerCase();
    if (name.includes('esmalte')) return 'Esmaltes';
    if (name.includes('barniz') || name.includes('stain')) return 'Barnices';
    if (name.includes('base') || name.includes('zinc')) return 'Bases';
    if (name.includes('texture') || name.includes('textu')) return 'Texturas';
    return 'Otros';
  };

  const categories = topProducts?.reduce((acc: Record<string, number>, product) => {
    const category = getProductCategory(product.productName);
    acc[category] = (acc[category] || 0) + product.totalSales;
    return acc;
  }, {}) || {};

  const chartData = {
    labels: Object.keys(categories),
    datasets: [{
      data: Object.values(categories),
      backgroundColor: [
        'hsl(var(--chart-1))',
        'hsl(var(--chart-2))',
        'hsl(var(--chart-3))',
        'hsl(var(--chart-4))',
        'hsl(var(--chart-5))',
      ]
    }]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const value = new Intl.NumberFormat('es-CL', {
              style: 'currency',
              currency: 'CLP',
              minimumFractionDigits: 0,
            }).format(context.parsed);
            return `${context.label}: ${value}`;
          }
        }
      }
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Productos Más Vendidos</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <PieChart data={chartData} options={chartOptions} />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
