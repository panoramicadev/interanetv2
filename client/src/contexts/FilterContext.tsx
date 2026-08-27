import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

// Etiqueta del período en español y con mayúscula inicial ("Agosto 2026")
export function formatPeriodDisplay(date: Date): string {
  const label = format(date, "MMMM yyyy", { locale: es });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

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
  type: "all" | "segment" | "branch" | "salesperson" | "client" | "product" | "global";
  value?: string;
}

export type GastosVista =
  | "all"
  | "usuario"
  | "segmento"
  | "categoria"
  | "estado"
  | "centroCostos";

export interface GastosFilter {
  mes: string;
  anio: string;
  usuarioFilter: string;
  fondoFilter?: string; // id del fondo entregado, 'sin_fondo' o 'all'
  diaDesde?: string; // DD format, e.g. "1", "15"
  diaHasta?: string; // DD format, e.g. "31"
  // Dashboard-style filter system applied to gastos
  selection?: YearMonthSelection; // Period selector state
  vista?: GastosVista;            // What to slice by
  vistaValue?: string;            // Selected value for the slice
}

interface FilterContextType {
  selection: YearMonthSelection;
  setSelection: (selection: YearMonthSelection) => void;
  globalFilter: GlobalFilter;
  setGlobalFilter: (filter: GlobalFilter) => void;
  // Modo Facturado / Combinado (Facturado + NVV + GDV) del dashboard.
  // Vive acá para que las tarjetas KPI y la tarjeta de meta muestren siempre lo mismo.
  showCombined: boolean;
  setShowCombined: (value: boolean) => void;
  gastosFilter: GastosFilter;
  setGastosFilter: (filter: GastosFilter) => void;
  updateGastosFilter: (partial: Partial<GastosFilter>) => void;
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
    display: formatPeriodDisplay(now)
  };
};

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

// Texto del período en español, armado desde la selección misma.
// Se usa para no depender del `display` guardado, que en versiones anteriores
// se generaba en inglés ("August 2026") y quedó persistido en el navegador.
export function buildPeriodDisplay(sel: YearMonthSelection): string | null {
  if (!sel) return null;
  const years = sel.years || [];
  if (years.length === 0) return null;
  const yearsStr = years.length === 1 ? `${years[0]}` : years.join(", ");

  if (sel.period === "custom-range" && sel.startDate && sel.endDate) {
    const fmt = (d: Date) => `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}`;
    return `${fmt(new Date(sel.startDate))} - ${fmt(new Date(sel.endDate))}`;
  }

  if (sel.period === "full-year") {
    return `${yearsStr} (año completo)`;
  }

  const months = sel.months && sel.months.length > 0 ? sel.months : [];
  const monthNames = months.map(m => MESES[m - 1]).filter(Boolean);
  if (monthNames.length === 0) return null;
  const monthsStr = monthNames.join(", ");

  if ((sel.period === "day" || sel.period === "days") && sel.days && sel.days.length > 0) {
    if (sel.days.length === 1 && monthNames.length === 1) {
      return years.length === 1
        ? `${sel.days[0]} ${monthNames[0]} ${years[0]}`
        : `${sel.days[0]} ${monthNames[0]} (${yearsStr})`;
    }
    return years.length === 1
      ? `Días ${sel.days.join(", ")} de ${monthsStr} ${years[0]}`
      : `Días ${sel.days.join(", ")} de ${monthsStr} (${yearsStr})`;
  }

  return years.length === 1 ? `${monthsStr} ${years[0]}` : `${monthsStr} (${yearsStr})`;
}

const STORAGE_KEY_SELECTION = "dashboard_filter_selection";
const STORAGE_KEY_GLOBAL_FILTER = "dashboard_global_filter";
const STORAGE_KEY_GASTOS_FILTER = "gastos_filter";

const getDefaultGastosFilter = (): GastosFilter => {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth(); // 0-indexed
  const firstDay = new Date(y, m, 1).toISOString().split('T')[0];
  const lastDay = new Date(y, m + 1, 0).toISOString().split('T')[0];
  return {
    mes: (m + 1).toString(),
    anio: y.toString(),
    usuarioFilter: "todos",
    diaDesde: firstDay,
    diaHasta: lastDay,
    selection: {
      years: [y],
      period: "month",
      months: [m + 1],
      display: formatPeriodDisplay(now),
    },
    vista: "all",
    vistaValue: "",
  };
};

const pad2 = (n: number) => String(n).padStart(2, "0");

// Derive the legacy date-range fields (mes/anio/diaDesde/diaHasta) from a YearMonthSelection.
// This keeps the existing backend queries unchanged when the user picks a period via the new selector.
export function gastosDatesFromSelection(sel: YearMonthSelection): {
  mes: string;
  anio: string;
  diaDesde: string;
  diaHasta: string;
} {
  const now = new Date();
  const year = sel.years?.[0] ?? now.getFullYear();

  // custom-range: explicit start/end
  if (sel.period === "custom-range" && sel.startDate && sel.endDate) {
    const from = sel.startDate;
    const to = sel.endDate;
    return {
      mes: String(from.getMonth() + 1),
      anio: String(from.getFullYear()),
      diaDesde: `${from.getFullYear()}-${pad2(from.getMonth() + 1)}-${pad2(from.getDate())}`,
      diaHasta: `${to.getFullYear()}-${pad2(to.getMonth() + 1)}-${pad2(to.getDate())}`,
    };
  }

  // full-year: 1-jan to 31-dec
  if (sel.period === "full-year") {
    return {
      mes: "1",
      anio: String(year),
      diaDesde: `${year}-01-01`,
      diaHasta: `${year}-12-31`,
    };
  }

  // day / days: pick min/max day within the selected month
  if ((sel.period === "day" || sel.period === "days") && sel.days && sel.days.length > 0) {
    const month = sel.months?.[0] ?? now.getMonth() + 1;
    const minDay = Math.min(...sel.days);
    const maxDay = Math.max(...sel.days);
    return {
      mes: String(month),
      anio: String(year),
      diaDesde: `${year}-${pad2(month)}-${pad2(minDay)}`,
      diaHasta: `${year}-${pad2(month)}-${pad2(maxDay)}`,
    };
  }

  // month / months: span first day of min-month to last day of max-month
  const months = sel.months && sel.months.length > 0 ? sel.months : [now.getMonth() + 1];
  const minMonth = Math.min(...months);
  const maxMonth = Math.max(...months);
  const firstDay = new Date(year, minMonth - 1, 1);
  const lastDay = new Date(year, maxMonth, 0);
  return {
    mes: String(minMonth),
    anio: String(year),
    diaDesde: `${year}-${pad2(minMonth)}-${pad2(firstDay.getDate())}`,
    diaHasta: `${year}-${pad2(maxMonth)}-${pad2(lastDay.getDate())}`,
  };
}

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

        // El texto guardado puede venir en inglés de versiones anteriores
        parsed.display = buildPeriodDisplay(parsed) || parsed.display;

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

  // Por defecto el dashboard arranca en Combinado, y vuelve a Combinado cada vez
  // que se cambia de vista (Todo, Segmento, Sucursal, Vendedor...). No se persiste
  // a propósito: cada entrada al dashboard parte del combinado.
  const [showCombined, setShowCombined] = useState<boolean>(true);

  const [gastosFilter, setGastosFilterState] = useState<GastosFilter>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_GASTOS_FILTER);
      if (stored) {
        const parsed = JSON.parse(stored) as GastosFilter;
        // Backfill new fields for users that have an older persisted shape
        if (!parsed.selection) {
          const m = parseInt(parsed.mes || `${new Date().getMonth() + 1}`, 10);
          const y = parseInt(parsed.anio || `${new Date().getFullYear()}`, 10);
          parsed.selection = {
            years: [y],
            period: "month",
            months: [m],
            display: formatPeriodDisplay(new Date(y, m - 1, 1)),
          };
        } else if (parsed.selection.startDate) {
          // Revive Date objects for custom-range
          parsed.selection.startDate = new Date(parsed.selection.startDate as any);
          if (parsed.selection.endDate) {
            parsed.selection.endDate = new Date(parsed.selection.endDate as any);
          }
        }
        if (!parsed.vista) parsed.vista = "all";
        if (parsed.vistaValue === undefined) parsed.vistaValue = "";
        return parsed;
      }
    } catch (e) {
      console.error("Error loading gastos filter from localStorage:", e);
    }
    return getDefaultGastosFilter();
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

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_GASTOS_FILTER, JSON.stringify(gastosFilter));
    } catch (e) {
      console.error("Error saving gastos filter to localStorage:", e);
    }
  }, [gastosFilter]);

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
    setSelectionState({
      ...newSelection,
      display: buildPeriodDisplay(newSelection) || newSelection.display,
    });
  };

  const setGlobalFilter = (filter: GlobalFilter) => {
    setGlobalFilterState(filter);
    // Al cambiar de vista el dashboard vuelve al modo Combinado
    setShowCombined(true);
  };

  const setGastosFilter = (filter: GastosFilter) => {
    setGastosFilterState(filter);
  };

  const updateGastosFilter = (partial: Partial<GastosFilter>) => {
    setGastosFilterState(prev => {
      const next = { ...prev, ...partial };
      // If selection was updated, derive the legacy date fields automatically.
      // This keeps existing backend queries working without changes.
      if (partial.selection) {
        const dates = gastosDatesFromSelection(partial.selection);
        next.mes = dates.mes;
        next.anio = dates.anio;
        next.diaDesde = dates.diaDesde;
        next.diaHasta = dates.diaHasta;
      }
      return next;
    });
  };

  const resetFilters = () => {
    setSelectionState(getDefaultSelection());
    setGlobalFilterState({ type: "all", value: "" });
    setShowCombined(true);
    setGastosFilterState(getDefaultGastosFilter());
  };

  return (
    <FilterContext.Provider
      value={{
        selection,
        setSelection,
        globalFilter,
        setGlobalFilter,
        showCombined,
        setShowCombined,
        gastosFilter,
        setGastosFilter,
        updateGastosFilter,
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
