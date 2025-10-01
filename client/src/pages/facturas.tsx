import { useState } from "react";
import { format } from "date-fns";
import TransactionsTable from "@/components/dashboard/transactions-table";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarIcon, ChevronLeft } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useLocation } from "wouter";

export default function Facturas() {
  const [, setLocation] = useLocation();
  const [filterType, setFilterType] = useState<"day" | "month" | "year" | "range">("month");
  const [selectedPeriod, setSelectedPeriod] = useState(format(new Date(), "yyyy-MM"));
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });

  // Update selected period when filter type changes
  const handleFilterTypeChange = (type: "day" | "month" | "year" | "range") => {
    setFilterType(type);
    switch (type) {
      case "day":
        if (selectedDate) {
          setSelectedPeriod(format(selectedDate, "yyyy-MM-dd"));
        } else {
          setSelectedPeriod(format(new Date(), "yyyy-MM-dd"));
        }
        break;
      case "month":
        setSelectedPeriod(format(new Date(), "yyyy-MM"));
        break;
      case "year":
        setSelectedPeriod(selectedYear.toString());
        break;
      case "range":
        if (dateRange?.from && dateRange?.to) {
          setSelectedPeriod(`${format(dateRange.from, "yyyy-MM-dd")}_${format(dateRange.to, "yyyy-MM-dd")}`);
        } else {
          setSelectedPeriod("last-30-days");
        }
        break;
    }
  };

  const handleDateChange = (date: Date | undefined) => {
    setSelectedDate(date);
    if (date) {
      setSelectedPeriod(format(date, "yyyy-MM-dd"));
    }
  };

  const handleYearChange = (year: string) => {
    setSelectedYear(parseInt(year));
    setSelectedPeriod(year);
  };

  const handlePeriodChange = (period: string) => {
    setSelectedPeriod(period);
  };

  const handleDateRangeChange = (range: { from: Date | undefined; to: Date | undefined } | undefined) => {
    if (range) {
      setDateRange(range);
      if (range.from && range.to) {
        setSelectedPeriod(`${format(range.from, "yyyy-MM-dd")}_${format(range.to, "yyyy-MM-dd")}`);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-gray-50">
      <div className="container mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation("/")}
              className="text-gray-600 hover:text-gray-900"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Volver
            </Button>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Facturas</h1>
              <p className="text-sm text-gray-500 mt-1">Historial de transacciones de ventas</p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="modern-card p-4 sm:p-6">
          <div className="flex flex-wrap items-center gap-4">
            {/* Filter Type */}
            <div className="flex items-center space-x-3">
              <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
                Filtrar:
              </label>
              <Select value={filterType} onValueChange={(value: "day" | "month" | "year" | "range") => handleFilterTypeChange(value)}>
                <SelectTrigger className="h-11 w-28 rounded-xl border-gray-200 shadow-sm text-sm">
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
            <div className="flex items-center space-x-3">
              <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
                Período:
              </label>
              
              {filterType === "day" ? (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="h-11 w-52 justify-start text-left font-normal rounded-xl border-gray-200 shadow-sm text-sm"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {selectedDate ? format(selectedDate, "dd/MM/yyyy") : "Seleccionar fecha"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 rounded-xl border-gray-200" align="start">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={handleDateChange}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              ) : filterType === "range" ? (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="h-11 w-80 justify-start text-left font-normal rounded-xl border-gray-200 shadow-sm text-sm"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateRange?.from && dateRange?.to
                        ? `${format(dateRange.from, "dd/MM")} - ${format(dateRange.to, "dd/MM")}`
                        : dateRange?.from
                        ? `${format(dateRange.from, "dd/MM")} - Seleccionar fin`
                        : "Seleccionar rango"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 rounded-xl border-gray-200" align="start">
                    <Calendar
                      mode="range"
                      selected={dateRange}
                      onSelect={handleDateRangeChange}
                      initialFocus
                      numberOfMonths={2}
                    />
                  </PopoverContent>
                </Popover>
              ) : filterType === "year" ? (
                <Select value={selectedYear.toString()} onValueChange={handleYearChange}>
                  <SelectTrigger className="h-11 w-52 rounded-xl border-gray-200 shadow-sm text-sm">
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
                <Select value={selectedPeriod} onValueChange={handlePeriodChange}>
                  <SelectTrigger className="h-11 w-52 rounded-xl border-gray-200 shadow-sm text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-gray-200">
                    <SelectItem value="2025-09">Septiembre 2025</SelectItem>
                    <SelectItem value="2025-08">Agosto 2025</SelectItem>
                    <SelectItem value="2025-07">Julio 2025</SelectItem>
                    <SelectItem value="2025-06">Junio 2025</SelectItem>
                    <SelectItem value="2025-05">Mayo 2025</SelectItem>
                    <SelectItem value="current-month">Mes actual</SelectItem>
                    <SelectItem value="last-month">Mes anterior</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="modern-card p-4 sm:p-6">
          <TransactionsTable 
            selectedPeriod={selectedPeriod}
            filterType={filterType}
          />
        </div>
      </div>
    </div>
  );
}
