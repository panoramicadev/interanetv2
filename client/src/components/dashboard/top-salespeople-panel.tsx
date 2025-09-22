import { useQuery } from "@tanstack/react-query";
import { UserCheck } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface TopSalesperson {
  salesperson: string;
  totalSales: number;
  transactionCount: number;
}

interface TopSalespeopleResponse {
  items: TopSalesperson[];
  periodTotalSales: number;
}

interface TopSalespeoplePanelProps {
  selectedPeriod: string;
  filterType: "day" | "month" | "year" | "range";
  segment?: string;
  salesperson?: string;
}

export default function TopSalespeoplePanel({ selectedPeriod, filterType, segment, salesperson }: TopSalespeoplePanelProps) {
  const displayLimit = 1000; // Show all salespeople
  
  const { data: topSalespeopleResponse, isLoading } = useQuery<TopSalespeopleResponse>({
    queryKey: [`/api/sales/top-salespeople?limit=${displayLimit}&period=${selectedPeriod}&filterType=${filterType}${segment ? `&segment=${encodeURIComponent(segment)}` : ''}${salesperson ? `&salesperson=${encodeURIComponent(salesperson)}` : ''}`],
  });

  const topSalespeople = topSalespeopleResponse?.items;
  const periodTotal = topSalespeopleResponse?.periodTotalSales || 0;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Calculate percentages based on period total
  const salespeopleWithPercentage = topSalespeople?.map(salesperson => ({
    ...salesperson,
    percentage: periodTotal > 0 ? (salesperson.totalSales / periodTotal) * 100 : 0
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2 sm:space-x-3">
          <div className="w-6 h-6 sm:w-8 sm:h-8 bg-blue-100 rounded-lg flex items-center justify-center">
            <UserCheck className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-gray-900">Vendedores</h2>
        </div>
        <div className="flex items-center gap-2">
          {/* Removed "Ver más" button since we show all salespeople */}
        </div>
      </div>
      
      <div className="bg-white rounded-xl border border-gray-200/60 p-3 sm:p-6 shadow-sm">
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center justify-between animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-32"></div>
                <div className="h-4 bg-gray-200 rounded w-12"></div>
                <div className="flex-1 mx-4">
                  <div className="h-6 bg-gray-200 rounded"></div>
                </div>
                <div className="h-4 bg-gray-200 rounded w-16"></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {salespeopleWithPercentage?.map((salesperson, index) => (
              <Link 
                key={salesperson.salesperson} 
                href={`/salesperson/${encodeURIComponent(salesperson.salesperson)}`}
                className="block hover:bg-gray-50/50 rounded-lg transition-colors"
              >
                <div 
                  className="flex flex-col sm:flex-row sm:items-center py-2 sm:py-3 space-y-2 sm:space-y-0"
                  data-testid={`salesperson-${index}`}
                >
                  {/* Nombre del vendedor y monto - Mobile */}
                  <div className="flex justify-between items-center sm:hidden">
                    <p className="text-sm text-gray-700 font-medium truncate flex-1 min-w-0 pr-2">
                      {salesperson.salesperson}
                    </p>
                    <div className="flex items-center space-x-2 shrink-0">
                      <span className="text-xs text-gray-600">
                        {salesperson.percentage.toFixed(1)}%
                      </span>
                      <span className="text-sm font-semibold text-gray-900">
                        {formatCurrency(salesperson.totalSales)}
                      </span>
                    </div>
                  </div>
                  
                  {/* Desktop Layout */}
                  <div className="hidden sm:flex sm:items-center w-full">
                    {/* Nombre del vendedor */}
                    <div className="w-32 lg:w-48 flex-shrink-0">
                      <p className="text-sm text-gray-700 font-medium truncate">
                        {salesperson.salesperson}
                      </p>
                    </div>
                    
                    {/* Porcentaje */}
                    <div className="w-12 flex-shrink-0 text-center">
                      <span className="text-sm text-gray-600">
                        {salesperson.percentage.toFixed(1)}%
                      </span>
                    </div>
                    
                    {/* Barra de progreso */}
                    <div className="flex-1 mx-2 lg:mx-4">
                      <div className="relative">
                        <div className="h-6 bg-gray-100 rounded-lg overflow-hidden">
                          <div 
                            className="h-full bg-blue-500 rounded-lg transition-all duration-500 ease-out"
                            style={{ width: `${salesperson.percentage}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Monto */}
                    <div className="w-20 flex-shrink-0 text-right">
                      <span className="text-sm font-semibold text-gray-900">
                        {formatCurrency(salesperson.totalSales)}
                      </span>
                    </div>
                  </div>
                  
                  {/* Barra de progreso - Mobile */}
                  <div className="sm:hidden">
                    <div className="relative">
                      <div className="h-3 bg-gray-100 rounded-lg overflow-hidden">
                        <div 
                          className="h-full bg-blue-500 rounded-lg transition-all duration-500 ease-out"
                          style={{ width: `${salesperson.percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
            
            {/* Total Row */}
            {salespeopleWithPercentage && salespeopleWithPercentage.length > 0 && (
              <div className="border-t-2 border-gray-300 pt-3 mt-4">
                <div 
                  className="flex flex-col sm:flex-row sm:items-center py-2 sm:py-3 space-y-2 sm:space-y-0 bg-green-50 rounded-lg px-3"
                  data-testid="salespeople-total"
                >
                  {/* Total Mobile */}
                  <div className="flex justify-between items-center sm:hidden">
                    <p className="text-sm text-green-900 font-bold">
                      TOTAL ({salespeopleWithPercentage.length} vendedores)
                    </p>
                    <div className="flex items-center space-x-2 shrink-0">
                      <span className="text-xs text-green-700">
                        100.0%
                      </span>
                      <span className="text-sm font-bold text-green-900">
                        {formatCurrency(periodTotal)}
                      </span>
                    </div>
                  </div>
                  
                  {/* Total Desktop */}
                  <div className="hidden sm:flex sm:items-center w-full">
                    <div className="w-32 lg:w-48 flex-shrink-0">
                      <p className="text-sm text-green-900 font-bold">
                        TOTAL ({salespeopleWithPercentage.length} vendedores)
                      </p>
                    </div>
                    
                    <div className="w-12 flex-shrink-0 text-center">
                      <span className="text-sm text-green-700 font-semibold">
                        100.0%
                      </span>
                    </div>
                    
                    <div className="flex-1 mx-2 lg:mx-4">
                      <div className="relative">
                        <div className="h-6 bg-green-200 rounded-lg overflow-hidden">
                          <div className="h-full bg-green-600 rounded-lg w-full"></div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="w-20 flex-shrink-0 text-right">
                      <span className="text-sm font-bold text-green-900">
                        {formatCurrency(periodTotal)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}