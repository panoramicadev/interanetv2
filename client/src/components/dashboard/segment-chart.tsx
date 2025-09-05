import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart3, TrendingUp } from "lucide-react";
import { Link } from "wouter";

interface SegmentData {
  segment: string;
  totalSales: number;
  percentage: number;
}

interface SegmentChartProps {
  selectedPeriod: string;
  filterType: "day" | "month" | "range";
}

export default function SegmentChart({ selectedPeriod, filterType }: SegmentChartProps) {
  const { data: segmentData, isLoading } = useQuery<SegmentData[]>({
    queryKey: [`/api/sales/segments?period=${selectedPeriod}&filterType=${filterType}`],
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const getSegmentInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getGradientColor = (index: number) => {
    const gradients = [
      'from-blue-500 to-purple-600',
      'from-green-500 to-blue-600', 
      'from-purple-500 to-pink-600',
      'from-orange-500 to-red-600',
      'from-teal-500 to-cyan-600',
      'from-indigo-500 to-blue-600',
      'from-pink-500 to-rose-600',
      'from-emerald-500 to-teal-600',
    ];
    return gradients[index % gradients.length];
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Ventas por Segmento
          </CardTitle>
          <Badge variant="secondary" className="gap-1">
            <TrendingUp className="h-3 w-3" />
            {segmentData?.length || 0}
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
            segmentData?.map((segment, index) => (
              <Link 
                key={segment.segment} 
                href={`/segment/${encodeURIComponent(segment.segment)}`}
                className="block"
              >
                <div 
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 hover:shadow-md transition-all duration-200 cursor-pointer"
                  data-testid={`segment-${index}`}
                >
                  <div className="flex items-center space-x-3">
                    <div className={`w-12 h-12 rounded-full bg-gradient-to-r ${getGradientColor(index)} flex items-center justify-center text-white font-bold text-sm shadow-lg`}>
                      {getSegmentInitials(segment.segment)}
                    </div>
                    <div>
                      <p className="font-medium text-sm leading-tight">
                        {segment.segment}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {segment.percentage.toFixed(1)}% del total
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-sm">
                      {formatCurrency(segment.totalSales)}
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
        
        {!isLoading && segmentData && segmentData.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Total segmentos</span>
              <span className="font-medium">{segmentData.length}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}