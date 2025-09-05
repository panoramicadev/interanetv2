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

  // Modern gradient colors for segments
  const generateSegmentColors = (count: number) => {
    const colors = [
      'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
      'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
      'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
      'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
      'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
      'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)',
      'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
    ];
    return colors.slice(0, count);
  };

  const backgroundColors = generateSegmentColors(segmentData?.length || 5);
  const borderColors = [
    '#667eea', '#f5576c', '#00f2fe', '#38f9d7', '#fee140', 
    '#fed6e3', '#fecfef', '#fcb69f'
  ].slice(0, segmentData?.length || 5);

  const chartConfig = {
    data: {
      labels: segmentData?.map(d => d.segment) || [],
      datasets: [{
        label: 'Ventas por Segmento ($)',
        data: segmentData?.map(d => d.totalSales) || [],
        backgroundColor: backgroundColors,
        borderColor: borderColors,
        borderWidth: 2,
        borderRadius: 8,
        borderSkipped: false,
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
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          titleColor: '#fff',
          bodyColor: '#fff',
          borderColor: '#667eea',
          borderWidth: 1,
          cornerRadius: 8,
          callbacks: {
            label: (context: any) => formatCurrency(context.parsed.y)
          }
        }
      },
      scales: {
        x: {
          grid: {
            display: false
          },
          ticks: {
            color: '#6b7280',
            font: {
              weight: 500
            }
          }
        },
        y: {
          beginAtZero: true,
          grid: {
            color: 'rgba(107, 114, 128, 0.1)',
            borderDash: [2, 2]
          },
          ticks: {
            color: '#6b7280',
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