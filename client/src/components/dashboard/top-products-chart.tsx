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

  // Modern gradient colors for products
  const modernProductColors = [
    'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', 
    'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
    'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
    'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)',
    'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
  ];

  const solidColors = [
    '#667eea', '#f5576c', '#00f2fe', '#38f9d7', 
    '#fee140', '#fed6e3', '#fecfef', '#fcb69f'
  ];

  const chartData = {
    labels: topProducts?.map(p => p.productName) || [],
    datasets: [{
      data: topProducts?.map(p => p.totalSales) || [],
      backgroundColor: modernProductColors.slice(0, topProducts?.length || 5),
      borderColor: solidColors.slice(0, topProducts?.length || 5),
      borderWidth: 3,
      hoverBorderWidth: 4,
      hoverOffset: 8,
    }]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          usePointStyle: true,
          pointStyle: 'circle',
          padding: 20,
          font: {
            size: 12,
            weight: 500
          },
          color: '#374151'
        }
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: '#fff',
        bodyColor: '#fff',
        borderWidth: 0,
        cornerRadius: 12,
        displayColors: true,
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
