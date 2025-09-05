import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart } from "@/components/ui/charts";

interface SegmentData {
  segment: string;
  totalSales: number;
  percentage: number;
}

export default function SegmentChart() {
  const { data: segmentData, isLoading } = useQuery<SegmentData[]>({
    queryKey: ["/api/sales/segments"],
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const chartConfig = {
    data: {
      labels: segmentData?.map(d => d.segment) || [],
      datasets: [{
        label: 'Ventas por Segmento ($)',
        data: segmentData?.map(d => d.totalSales) || [],
        backgroundColor: 'hsla(var(--primary), 0.8)',
        borderColor: 'hsl(var(--primary))',
        borderWidth: 1,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: (context: any) => formatCurrency(context.parsed.y)
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: (value: any) => formatCurrency(value)
          }
        }
      }
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ventas por Segmento</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <BarChart {...chartConfig} />
          )}
        </div>
      </CardContent>
    </Card>
  );
}