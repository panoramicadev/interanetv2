import { useQuery } from "@tanstack/react-query";
import { UserCheck, Download, Search } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useState, useEffect } from "react";
import SalespersonDetail from "@/pages/salesperson-detail";

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
  const [displayedCount, setDisplayedCount] = useState(10); // Start with 10 salespeople
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSalesperson, setSelectedSalesperson] = useState<string | null>(null);
  
  const { data: topSalespeopleResponse, isLoading } = useQuery<TopSalespeopleResponse>({
    queryKey: ['/api/sales/top-salespeople', 'all', selectedPeriod, filterType, segment, salesperson],
    queryFn: async () => {
      const params = new URLSearchParams();
      // No enviamos límite para obtener TODOS los vendedores
      params.append('period', selectedPeriod);
      params.append('filterType', filterType);
      if (segment) params.append('segment', segment);
      if (salesperson) params.append('salesperson', salesperson);
      const res = await fetch(`/api/sales/top-salespeople?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return await res.json();
    },
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
  
  // Filter by search term
  const filteredSalespeople = salespeopleWithPercentage?.filter(sp =>
    sp.salesperson.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  // Reset displayedCount when search term changes
  useEffect(() => {
    setDisplayedCount(10);
  }, [searchTerm]);

  const exportToCSV = () => {
    if (!salespeopleWithPercentage || salespeopleWithPercentage.length === 0) return;

    const csvData = [];
    
    // Add header
    csvData.push(['REPORTE DE VENTAS POR VENDEDOR']);
    csvData.push(['Período: ' + selectedPeriod]);
    if (segment) csvData.push(['Segmento: ' + segment]);
    csvData.push(['Total de vendedores: ' + salespeopleWithPercentage.length]);
    csvData.push(['Total del periodo: ' + periodTotal.toLocaleString('es-CL')]);
    csvData.push(['Generado: ' + new Date().toLocaleString('es-CL')]);
    csvData.push([]); // Empty row

    // Preparar datos CSV con más detalles
    const headers = ['#', 'Vendedor', 'Total Ventas', 'Transacciones', 'Ticket Promedio', 'Porcentaje del Total'];
    csvData.push(headers);
    
    salespeopleWithPercentage.forEach((sp, index) => {
      const ticketPromedio = sp.transactionCount > 0 ? sp.totalSales / sp.transactionCount : 0;
      csvData.push([
        (index + 1).toString(),
        sp.salesperson,
        sp.totalSales.toString(),
        sp.transactionCount.toString(),
        ticketPromedio.toFixed(2),
        sp.percentage.toFixed(2) + '%'
      ]);
    });

    // Create CSV content
    const csvContent = csvData.map(row => 
      row.map(cell => {
        const stringCell = String(cell);
        if (stringCell.includes(',') || stringCell.includes('"') || stringCell.includes('\n')) {
          return '"' + stringCell.replace(/"/g, '""') + '"';
        }
        return stringCell;
      }).join(',')
    ).join('\n');

    // Descargar archivo
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `ventas_por_vendedor_${selectedPeriod.replace(/[\/\\:]/g, '-')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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
          <Button
            variant="outline"
            size="sm"
            onClick={exportToCSV}
            disabled={isLoading || !salespeopleWithPercentage || salespeopleWithPercentage.length === 0}
            data-testid="button-export-salespeople-csv"
          >
            <Download className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">Exportar CSV</span>
            <span className="sm:hidden">CSV</span>
          </Button>
          <Link href="/mis-vendedores">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs px-3 py-1"
              data-testid="button-view-all-salespeople"
            >
              Ver todos
            </Button>
          </Link>
        </div>
      </div>
      
      {/* Búsqueda */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          type="text"
          placeholder="Buscar vendedor..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
          data-testid="input-search-salespeople"
        />
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
        ) : filteredSalespeople && filteredSalespeople.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500 text-sm">
              {searchTerm ? `No se encontraron vendedores que coincidan con "${searchTerm}"` : 'No hay vendedores disponibles'}
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {filteredSalespeople?.slice(0, displayedCount).map((salesperson, index) => (
                <button
                  key={salesperson.salesperson}
                  onClick={() => setSelectedSalesperson(salesperson.salesperson)}
                  className="w-full block hover:bg-gray-50/50 rounded-lg transition-colors text-left"
                  data-testid={`salesperson-${index}`}
                >
                  <div 
                    className="flex flex-col sm:flex-row sm:items-center py-2 sm:py-3 space-y-2 sm:space-y-0"
                  >
                  {/* Nombre del vendedor y monto - Mobile */}
                  <div className="flex flex-col gap-2 sm:hidden">
                    <p className="text-sm text-gray-700 font-medium break-words line-clamp-2">
                      {salesperson.salesperson}
                    </p>
                    <div className="flex items-center justify-between">
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
                </button>
              ))}
            </div>
            
            {/* Ver más button */}
            {filteredSalespeople && displayedCount < filteredSalespeople.length && (
              <div className="text-center pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDisplayedCount(prev => Math.min(prev + 10, filteredSalespeople.length))}
                  className="text-xs px-4 py-2"
                  data-testid="button-see-more-salespeople"
                >
                  Ver más ({displayedCount} de {filteredSalespeople.length})
                </Button>
              </div>
            )}
            
            {/* Total Row */}
            {salespeopleWithPercentage && salespeopleWithPercentage.length > 0 && (
              <div className="border-t-2 border-gray-300 pt-3 mt-4">
                <div 
                  className="flex flex-col sm:flex-row sm:items-center py-2 sm:py-3 space-y-2 sm:space-y-0 bg-green-50 rounded-lg px-3"
                  data-testid="salespeople-total"
                >
                  {/* Total Mobile */}
                  <div className="flex flex-col gap-2 sm:hidden">
                    <p className="text-sm text-green-900 font-bold">
                      TOTAL ({salespeopleWithPercentage.length} vendedores)
                    </p>
                    <div className="flex items-center justify-between">
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
          </>
        )}
      </div>
      
      {/* Modal de Vendedor */}
      <Dialog open={!!selectedSalesperson} onOpenChange={(open) => !open && setSelectedSalesperson(null)}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Análisis de Vendedor</DialogTitle>
          </DialogHeader>
          {selectedSalesperson && (
            <SalespersonDetail
              salespersonName={selectedSalesperson}
              embedded={true}
              onBack={() => setSelectedSalesperson(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}