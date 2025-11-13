import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CalendarIcon, Search, FileText, Users, ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { Link } from "wouter";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import TransactionDetailModal from "@/components/dashboard/transaction-detail-modal";
import type { Transaction, GroupedSale } from "@/types/sales";

export default function Facturas() {
  const { user } = useAuth();
  const [selectedPeriod, setSelectedPeriod] = useState(() => {
    return format(new Date(), "yyyy-MM");
  });
  const [filterType, setFilterType] = useState<"day" | "month" | "year" | "range">("month");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [expandedSales, setExpandedSales] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  // Update selected period when filter type changes
  useEffect(() => {
    switch (filterType) {
      case "day":
        if (selectedDate) {
          setSelectedPeriod(format(selectedDate, "yyyy-MM-dd"));
        } else {
          setSelectedPeriod(format(new Date(), "yyyy-MM-dd"));
        }
        break;
      case "month":
        if (!selectedPeriod || selectedPeriod.includes("_")) {
          setSelectedPeriod(format(new Date(), "yyyy-MM"));
        }
        break;
      case "year":
        setSelectedPeriod(selectedYear.toString());
        break;
      case "range":
        if (startDate && endDate) {
          setSelectedPeriod(`${format(startDate, "yyyy-MM-dd")}_${format(endDate, "yyyy-MM-dd")}`);
        } else {
          setSelectedPeriod("last-30-days");
        }
        break;
    }
  }, [filterType, selectedDate, selectedYear, startDate, endDate]);

  // Construct query parameters based on user role
  const getQueryKey = () => {
    let baseQuery = `/api/sales/transactions?limit=200&period=${selectedPeriod}&filterType=${filterType}`;
    
    // If user is a salesperson, filter by their name
    if (user?.role === 'salesperson' && (user as any)?.salespersonName) {
      baseQuery += `&salesperson=${encodeURIComponent((user as any).salespersonName)}`;
    }
    
    return baseQuery;
  };

  const { data: allTransactions, isLoading } = useQuery<Transaction[]>({
    queryKey: [getQueryKey()],
    enabled: !!user, // Only run query when user is loaded
  });

  const handleTransactionClick = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setIsModalOpen(true);
  };

  const toggleSaleExpansion = (nudo: string) => {
    const newExpanded = new Set(expandedSales);
    if (newExpanded.has(nudo)) {
      newExpanded.delete(nudo);
    } else {
      newExpanded.add(nudo);
    }
    setExpandedSales(newExpanded);
  };

  // Group transactions by NUDO (sale)
  const groupTransactionsByNudo = (transactions: Transaction[]): GroupedSale[] => {
    const grouped = transactions.reduce((acc, transaction) => {
      const nudo = transaction.nudo;
      if (!acc[nudo]) {
        acc[nudo] = {
          nudo,
          customerName: transaction.nokoen || 'Cliente Anónimo',
          salesperson: transaction.nokofu || 'Sin vendedor',
          date: transaction.feemdo || '',
          totalAmount: 0,
          transactionCount: 0,
          transactions: []
        };
      }
      
      acc[nudo].transactions.push(transaction);
      acc[nudo].transactionCount++;
      
      const amount = transaction.monto ? Number(transaction.monto) : (transaction.vanedo ? Number(transaction.vanedo) : 0);
      acc[nudo].totalAmount += amount;
      
      return acc;
    }, {} as Record<string, GroupedSale>);
    
    return Object.values(grouped).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  const filteredTransactions = allTransactions ? allTransactions.filter(transaction => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      transaction.nokoen?.toLowerCase().includes(search) ||
      transaction.nokopr?.toLowerCase().includes(search) ||
      transaction.nokofu?.toLowerCase().includes(search) ||
      transaction.nudo?.toLowerCase().includes(search)
    );
  }) : [];

  const allGroupedSales = groupTransactionsByNudo(filteredTransactions);
  const totalPages = Math.ceil(allGroupedSales.length / itemsPerPage);
  const paginatedSales = allGroupedSales.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getTimeAgo = (dateString: string | null) => {
    if (!dateString) return 'sin fecha';
    
    try {
      const transactionDate = new Date(dateString);
      if (isNaN(transactionDate.getTime())) {
        return 'fecha inválida';
      }
      
      const now = new Date();
      const diffInMs = now.getTime() - transactionDate.getTime();
      
      const minutes = Math.floor(diffInMs / (1000 * 60));
      const hours = Math.floor(diffInMs / (1000 * 60 * 60));
      const days = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
      const months = Math.floor(days / 30);
      
      if (months > 0) {
        return `hace ${months} mes${months > 1 ? 'es' : ''}`;
      } else if (days > 0) {
        return `hace ${days} día${days > 1 ? 's' : ''}`;
      } else if (hours > 0) {
        return `hace ${hours} hora${hours > 1 ? 's' : ''}`;
      } else if (minutes > 0) {
        return `hace ${minutes} min`;
      } else {
        return 'hace unos segundos';
      }
    } catch (error) {
      return 'error en fecha';
    }
  };

  const getSalespersonDisplay = (salespersonName: string | null) => {
    if (!salespersonName) {
      return { name: 'Sin vendedor asignado', color: 'bg-gray-100 text-gray-600' };
    }
    
    const colors = [
      'bg-blue-100 text-blue-800',
      'bg-green-100 text-green-800', 
      'bg-purple-100 text-purple-800',
      'bg-orange-100 text-orange-800',
      'bg-teal-100 text-teal-800',
      'bg-pink-100 text-pink-800'
    ];
    
    const hash = salespersonName.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    
    const colorIndex = Math.abs(hash) % colors.length;
    
    return {
      name: salespersonName,
      color: colors[colorIndex]
    };
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-white border-b border-gray-200/60 px-3 sm:px-4 lg:px-6 py-3 sm:py-4 lg:py-6 m-3 sm:m-4 rounded-2xl shadow-sm">
        <div className="flex flex-col space-y-3 lg:space-y-0 lg:flex-row lg:items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/">
              <Button variant="ghost" size="sm" className="flex items-center gap-2" data-testid="back-to-dashboard">
                <ArrowLeft className="h-4 w-4" />
                Dashboard
              </Button>
            </Link>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg sm:text-xl lg:text-3xl font-bold text-gray-900 truncate flex items-center gap-2">
                <FileText className="h-6 w-6 lg:h-8 lg:w-8" />
                Todas las Órdenes
              </h1>
              <p className="text-gray-600 text-xs sm:text-sm lg:text-lg">
                Vista completa de todas las órdenes del sistema
              </p>
            </div>
          </div>
          
          <div className="flex flex-col space-y-2 lg:space-y-0 lg:flex-row lg:items-center lg:space-x-4 w-full lg:w-auto">
            {/* Filter Type Selector */}
            <div className="flex items-center space-x-2 flex-none">
              <label className="text-xs sm:text-sm font-medium text-gray-700 whitespace-nowrap">
                Filtrar:
              </label>
              <Select value={filterType} onValueChange={(value: "day" | "month" | "year" | "range") => setFilterType(value)}>
                <SelectTrigger className="w-20 sm:w-32 rounded-xl border-gray-200 shadow-sm text-xs sm:text-sm" data-testid="select-filter-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-gray-200">
                  <SelectItem value="day">Día</SelectItem>
                  <SelectItem value="month">Mes</SelectItem>
                  <SelectItem value="year">Año</SelectItem>
                  <SelectItem value="range">Rango</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Period Selector */}
            <div className="flex items-center space-x-2 sm:space-x-3 flex-1 lg:flex-none min-w-0">
              <label className="text-xs sm:text-sm font-medium text-gray-700 whitespace-nowrap">
                Período:
              </label>
              
              {filterType === "day" ? (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="flex-1 lg:w-52 justify-start text-left font-normal rounded-xl border-gray-200 shadow-sm text-xs sm:text-sm min-w-0"
                      data-testid="calendar-trigger"
                    >
                      <CalendarIcon className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4 shrink-0" />
                      <span className="truncate">
                        {selectedDate ? format(selectedDate, "dd/MM/yyyy") : "Seleccionar fecha"}
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 rounded-xl border-gray-200" align="start">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={setSelectedDate}
                      initialFocus
                      data-testid="calendar"
                    />
                  </PopoverContent>
                </Popover>
              ) : filterType === "range" ? (
                <div className="flex items-center space-x-1 sm:space-x-2 flex-1 min-w-0">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="flex-1 min-w-0 justify-start text-left font-normal rounded-xl border-gray-200 shadow-sm text-xs sm:text-sm"
                        data-testid="start-date-trigger"
                      >
                        <CalendarIcon className="mr-1 h-3 w-3 sm:h-4 sm:w-4 shrink-0" />
                        <span className="truncate">
                          {startDate ? format(startDate, "dd/MM") : "Inicio"}
                        </span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 rounded-xl border-gray-200" align="start">
                      <Calendar
                        mode="single"
                        selected={startDate}
                        onSelect={setStartDate}
                        initialFocus
                        data-testid="start-date-calendar"
                      />
                    </PopoverContent>
                  </Popover>
                  
                  <span className="text-gray-500 text-xs sm:text-sm shrink-0">-</span>
                  
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="flex-1 min-w-0 justify-start text-left font-normal rounded-xl border-gray-200 shadow-sm text-xs sm:text-sm"
                        data-testid="end-date-trigger"
                      >
                        <CalendarIcon className="mr-1 h-3 w-3 sm:h-4 sm:w-4 shrink-0" />
                        <span className="truncate">
                          {endDate ? format(endDate, "dd/MM") : "Final"}
                        </span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 rounded-xl border-gray-200" align="start">
                      <Calendar
                        mode="single"
                        selected={endDate}
                        onSelect={setEndDate}
                        initialFocus
                        data-testid="end-date-calendar"
                        disabled={(date) => startDate ? date < startDate : false}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              ) : filterType === "year" ? (
                <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
                  <SelectTrigger className="flex-1 lg:w-52 rounded-xl border-gray-200 shadow-sm text-xs sm:text-sm min-w-0" data-testid="select-year">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-gray-200">
                    <SelectItem value="2025">2025</SelectItem>
                    <SelectItem value="2024">2024</SelectItem>
                    <SelectItem value="2023">2023</SelectItem>
                    <SelectItem value="2022">2022</SelectItem>
                    <SelectItem value="2021">2021</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                  <SelectTrigger className="flex-1 lg:w-52 rounded-xl border-gray-200 shadow-sm text-xs sm:text-sm min-w-0" data-testid="select-period">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-gray-200">
                    <SelectItem value="2025-09">Septiembre 2025</SelectItem>
                    <SelectItem value="2025-08">Agosto 2025</SelectItem>
                    <SelectItem value="2025-07">Julio 2025</SelectItem>
                    <SelectItem value="2025-06">Junio 2025</SelectItem>
                    <SelectItem value="2025-05">Mayo 2025</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Search and Stats */}
      <div className="px-3 sm:px-4 lg:px-6 space-y-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div className="flex-1 max-w-md">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Buscar por cliente, producto, vendedor o ID de orden..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                    data-testid="search-orders"
                  />
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <div className="flex items-center gap-1">
                  <FileText className="h-4 w-4" />
                  <span>{allGroupedSales.length} órdenes</span>
                </div>
                <div className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  <span>{filteredTransactions.length} transacciones</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Orders Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Órdenes del período
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="font-semibold">Cliente</TableHead>
                    <TableHead className="font-semibold">Vendedor</TableHead>
                    <TableHead className="font-semibold">ID Orden</TableHead>
                    <TableHead className="font-semibold">Tiempo</TableHead>
                    <TableHead className="font-semibold text-right">Monto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    [...Array(10)].map((_, i) => (
                      <TableRow key={i}>
                        <TableCell><div className="h-4 bg-muted rounded animate-pulse"></div></TableCell>
                        <TableCell><div className="h-4 bg-muted rounded animate-pulse"></div></TableCell>
                        <TableCell><div className="h-4 bg-muted rounded animate-pulse"></div></TableCell>
                        <TableCell><div className="h-4 bg-muted rounded animate-pulse"></div></TableCell>
                        <TableCell><div className="h-4 bg-muted rounded animate-pulse"></div></TableCell>
                      </TableRow>
                    ))
                  ) : (
                    paginatedSales.map((sale) => {
                      const salesperson = getSalespersonDisplay(sale.salesperson);
                      const timeAgo = getTimeAgo(sale.date);
                      const isExpanded = expandedSales.has(sale.nudo);
                      
                      return (
                        <React.Fragment key={sale.nudo}>
                          {/* Sale Summary Row */}
                          <TableRow 
                            className="border-b border-gray-50 hover:bg-blue-50/50 cursor-pointer transition-colors"
                            data-testid={`sale-${sale.nudo}`}
                            onClick={() => toggleSaleExpansion(sale.nudo)}
                            title="Haz clic para ver los productos en esta orden"
                          >
                            <TableCell className="py-3 sm:py-4">
                              <div className="flex items-center space-x-2 sm:space-x-3">
                                <div className="hidden sm:flex w-10 h-10 bg-gray-600 rounded-full items-center justify-center">
                                  <span className="text-white text-sm font-medium">
                                    {getInitials(sale.customerName)}
                                  </span>
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="font-medium text-gray-900 text-sm sm:text-base truncate">{sale.customerName}</div>
                                  <div className="text-xs sm:text-sm text-gray-500">
                                    {sale.transactionCount} producto{sale.transactionCount > 1 ? 's' : ''}
                                  </div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="px-2 sm:px-4">
                              <Badge variant="secondary" className={`${salesperson.color} max-w-full`}>
                                <span className="truncate">{salesperson.name}</span>
                              </Badge>
                            </TableCell>
                            <TableCell className="text-gray-600 font-medium text-xs sm:text-sm">
                              <span className="hidden sm:inline">#</span>{sale.nudo}
                            </TableCell>
                            <TableCell className="text-gray-500 text-xs sm:text-sm">
                              {timeAgo}
                            </TableCell>
                            <TableCell className="text-right font-semibold text-gray-900">
                              <div className="flex items-center justify-end gap-1 sm:gap-2">
                                <span className="text-sm sm:text-base">
                                  {formatCurrency(sale.totalAmount)}
                                </span>
                                <span className="text-xs text-blue-600">
                                  {isExpanded ? '▲' : '▼'}
                                </span>
                              </div>
                            </TableCell>
                          </TableRow>
                          
                          {/* Expanded Transaction Details */}
                          {isExpanded && sale.transactions.map((transaction) => (
                            <TableRow 
                              key={`${sale.nudo}-${transaction.id}`}
                              className="bg-gray-50 border-b border-gray-100 hover:bg-gray-100 cursor-pointer transition-colors"
                              data-testid={`transaction-${transaction.id}`}
                              onClick={() => handleTransactionClick(transaction)}
                              title="Haz clic para ver los detalles completos de este producto"
                            >
                              <TableCell className="py-2 pl-12">
                                <div className="text-sm text-gray-600">
                                  {transaction.nokopr || 'Producto no especificado'}
                                </div>
                              </TableCell>
                              <TableCell className="text-sm text-gray-500">
                                ID: {transaction.id.slice(0, 8)}...
                              </TableCell>
                              <TableCell className="text-sm text-gray-500">
                                {transaction.caprad2 || 'Sin código'}
                              </TableCell>
                              <TableCell className="text-sm text-gray-500">
                                {transaction.noruen ? transaction.noruen.slice(0, 10) : 'N/A'}
                              </TableCell>
                              <TableCell className="text-right text-sm font-medium text-gray-700">
                                {formatCurrency(transaction.monto ? Number(transaction.monto) : (transaction.vanedo ? Number(transaction.vanedo) : 0))}
                              </TableCell>
                            </TableRow>
                          ))}
                        </React.Fragment>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
            
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t px-6 py-4">
                <div className="text-sm text-gray-600">
                  Página {currentPage} de {totalPages}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    data-testid="prev-page"
                  >
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    data-testid="next-page"
                  >
                    Siguiente
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Transaction Detail Modal */}
      {selectedTransaction && (
        <TransactionDetailModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedTransaction(null);
          }}
          transactionId={selectedTransaction.id}
          nudo={selectedTransaction.nudo}
        />
      )}
    </div>
  );
}
