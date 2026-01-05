import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { format } from "date-fns";

export interface YearMonthSelection {
  years: number[];
  period: "full-year" | "month" | "months" | "day" | "days" | "custom-range";
  months?: number[]; // Always in 1-12 format
  days?: number[];
  startDate?: Date;
  endDate?: Date;
  display: string;
}

export interface GlobalFilter {
  type: "all" | "segment" | "salesperson" | "client" | "product";
  value: string;
}

interface FilterContextType {
  selection: YearMonthSelection;
  setSelection: (selection: YearMonthSelection) => void;
  globalFilter: GlobalFilter;
  setGlobalFilter: (filter: GlobalFilter) => void;
  resetFilters: () => void;
}

const FilterContext = createContext<FilterContextType | undefined>(undefined);

const getDefaultSelection = (): YearMonthSelection => {
  const now = new Date();
  const currentMonth = now.getMonth() + 1; // Convert to 1-12 format
  return {
    years: [now.getFullYear()],
    period: "month",
    months: [currentMonth], // Use months array in 1-12 format
    display: format(now, "MMMM yyyy")
  };
};

const STORAGE_KEY_SELECTION = "dashboard_filter_selection";
const STORAGE_KEY_GLOBAL_FILTER = "dashboard_global_filter";

export function FilterProvider({ children }: { children: ReactNode }) {
  // Initialize from localStorage or defaults
  const [selection, setSelectionState] = useState<YearMonthSelection>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_SELECTION);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Convert date strings back to Date objects
        if (parsed.startDate) parsed.startDate = new Date(parsed.startDate);
        if (parsed.endDate) parsed.endDate = new Date(parsed.endDate);
        
        // Migration: convert old format with singular 'month' to 'months' array
        if (parsed.month !== undefined && !parsed.months) {
          parsed.months = [parsed.month];
          delete parsed.month;
        }
        
        // Ensure months is always an array
        if (parsed.months && !Array.isArray(parsed.months)) {
          parsed.months = [parsed.months];
        }
        
        return parsed;
      }
    } catch (e) {
      console.error("Error loading filter selection from localStorage:", e);
    }
    return getDefaultSelection();
  });

  const [globalFilter, setGlobalFilterState] = useState<GlobalFilter>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_GLOBAL_FILTER);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error("Error loading global filter from localStorage:", e);
    }
    return { type: "all", value: "" };
  });

  // Persist to localStorage whenever selection changes
  useEffect(() => {
    console.log("💾 [FilterContext] selection changed, saving to localStorage:", selection);
    try {
      localStorage.setItem(STORAGE_KEY_SELECTION, JSON.stringify(selection));
    } catch (e) {
      console.error("Error saving filter selection to localStorage:", e);
    }
  }, [selection]);

  // Persist to localStorage whenever globalFilter changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_GLOBAL_FILTER, JSON.stringify(globalFilter));
    } catch (e) {
      console.error("Error saving global filter to localStorage:", e);
    }
  }, [globalFilter]);

  const setSelection = (newSelection: YearMonthSelection) => {
    console.log("🔧 [FilterContext] setSelection called:", {
      old: selection,
      new: newSelection
    });
    console.trace("📍 Stack trace de setSelection");
    
    // Comparación profunda para evitar actualizaciones innecesarias
    const isSame = JSON.stringify(selection) === JSON.stringify(newSelection);
    if (isSame) {
      console.log("⏭️  [FilterContext] Valor idéntico, ignorando actualización");
      return;
    }
    
    console.log("✅ [FilterContext] Actualizando selection state");
    setSelectionState(newSelection);
  };

  const setGlobalFilter = (filter: GlobalFilter) => {
    setGlobalFilterState(filter);
  };

  const resetFilters = () => {
    setSelectionState(getDefaultSelection());
    setGlobalFilterState({ type: "all", value: "" });
  };

  return (
    <FilterContext.Provider
      value={{
        selection,
        setSelection,
        globalFilter,
        setGlobalFilter,
        resetFilters
      }}
    >
      {children}
    </FilterContext.Provider>
  );
}

export function useFilter() {
  const context = useContext(FilterContext);
  if (context === undefined) {
    throw new Error("useFilter must be used within a FilterProvider");
  }
  return context;
}
