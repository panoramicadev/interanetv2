import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LineChart } from "@/components/ui/charts";
import { useState } from "react";

interface ChartDataPoint {
  period: string;
  sales: number;
}

export default function SalesChart() {
  const [period, setPeriod] = useState<'weekly' | 'monthly'>('monthly');
  
  const { data: chartData, isLoading } = useQuery<ChartDataPoint[]>({
    queryKey: ["/api/sales/chart-data", { period }],
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
      labels: chartData?.map(d => d.period) || [],
      datasets: [{
        label: 'Ventas ($)',
        data: chartData?.map(d => d.sales) || [],
        borderColor: 'hsl(var(--primary))',
        backgroundColor: 'hsla(var(--primary), 0.1)',
        tension: 0.4,
        fill: true,
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
        <div className="flex items-center justify-between">
          <CardTitle>Tendencia de Ventas</CardTitle>
          <div className="flex space-x-2">
            <Button
              variant={period === 'monthly' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setPeriod('monthly')}
              data-testid="button-monthly"
            >
              Mensual
            </Button>
            <Button
              variant={period === 'weekly' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setPeriod('weekly')}
              data-testid="button-weekly"
            >
              Semanal
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <LineChart {...chartConfig} />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
