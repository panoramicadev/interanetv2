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

  // Generate colors for each product
  const generateColors = (count: number) => {
    const colors = [];
    for (let i = 0; i < count; i++) {
      const hue = (i * 360) / count;
      colors.push(`hsl(${hue}, 70%, 60%)`);
    }
    return colors;
  };

  const chartData = {
    labels: topProducts?.map(p => p.productName) || [],
    datasets: [{
      data: topProducts?.map(p => p.totalSales) || [],
      backgroundColor: generateColors(topProducts?.length || 5),
      borderColor: generateColors(topProducts?.length || 5).map(color => color.replace('60%', '40%')),
      borderWidth: 2,
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
