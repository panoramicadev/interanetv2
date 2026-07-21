/**
 * Panel de Trabajo — cambios recientes por sección (badges + destacado).
 *
 * Consume /api/panel-changes/summary (polling cada 20s + refetch tras cada
 * mutación propia vía el MutationCache global de queryClient) y expone:
 *  - counts/total: cambios no vistos por sección, filtrados por el área activa,
 *    para los badges de las pestañas y la campana junto al selector de Área.
 *  - markSeen/enterSection: al entrar a una pestaña se marcan vistos sus
 *    cambios y los ids afectados quedan como "highlights" para destacar las
 *    tarjetas modificadas durante la visita.
 *  - PanelChangesContext/usePanelHighlights: los sub-componentes de cada
 *    pestaña leen los ids destacados sin prop-drilling.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

export type PanelSection =
  | "tareas"
  | "seguimiento"
  | "estimacion"
  | "marketing"
  | "crm"
  | "rutas";

export const PANEL_SECTIONS: PanelSection[] = [
  "tareas",
  "seguimiento",
  "estimacion",
  "marketing",
  "crm",
  "rutas",
];

/** Pestaña del panel → sección del change-log (calendario/obras no registran cambios propios). */
export const PANEL_TAB_TO_SECTION: Record<string, PanelSection | undefined> = {
  tareas: "tareas",
  seguimiento: "seguimiento",
  estimacion: "estimacion",
  marketing: "marketing",
  crm: "crm",
  "rutas-comerciales": "rutas",
};

export const PANEL_SECTION_TO_TAB: Record<PanelSection, string> = {
  tareas: "tareas",
  seguimiento: "seguimiento",
  estimacion: "estimacion",
  marketing: "marketing",
  crm: "crm",
  rutas: "rutas-comerciales",
};

export interface PanelChangeItem {
  id: string;
  section: PanelSection;
  segmento: string | null;
  entityType: string;
  entityId: string | null;
  action: string;
  title: string;
  userId: string;
  userName: string | null;
  createdAt: string;
}

export interface PanelChangesController {
  /** Ítems no vistos visibles en el área actual (para la campana). */
  visibleItems: PanelChangeItem[];
  /** Conteo de no vistos por sección (para los badges de pestañas). */
  counts: Partial<Record<PanelSection, number>>;
  total: number;
  /** Ids de entidades a destacar por sección durante la visita actual. */
  highlights: Partial<Record<PanelSection, Set<string>>>;
  markSeen: (section: PanelSection) => void;
  markAllSeen: () => void;
  /** Llamar al pinchar una pestaña ya activa (el cambio de pestaña se maneja solo). */
  enterSection: (section: PanelSection) => void;
}

const EMPTY_SET = new Set<string>();

export function usePanelChangesController(opts: {
  enabled: boolean;
  segmentoFilter: string;
  activeTab: string;
}): PanelChangesController {
  const { enabled, segmentoFilter, activeTab } = opts;

  const summaryQuery = useQuery<{ items: PanelChangeItem[] }>({
    queryKey: ["/api/panel-changes/summary"],
    enabled,
    refetchInterval: 20000,
    // Seguir sondeando aunque la pestaña no tenga foco: el equipo suele dejar
    // el panel abierto de fondo y los badges deben reflejar cambios igual.
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
    staleTime: 10000,
  });

  const items = summaryQuery.data?.items;
  // Un cambio cuenta para el área que se está mirando; los cambios sin
  // segmento (null) cuentan en todas.
  const visibleItems = useMemo(
    () =>
      (items ?? []).filter(
        (it) => !it.segmento || segmentoFilter === "all" || it.segmento === segmentoFilter,
      ),
    [items, segmentoFilter],
  );

  const counts = useMemo(() => {
    const c: Partial<Record<PanelSection, number>> = {};
    for (const it of visibleItems) c[it.section] = (c[it.section] ?? 0) + 1;
    return c;
  }, [visibleItems]);

  const [highlights, setHighlights] = useState<Partial<Record<PanelSection, Set<string>>>>({});

  const markSeen = useCallback(
    (section: PanelSection) => {
      // Capturar los ids a destacar ANTES de marcar visto (después desaparecen del summary).
      const ids = new Set(
        visibleItems
          .filter((i) => i.section === section && i.entityId)
          .map((i) => i.entityId as string),
      );
      setHighlights((prev) => ({ ...prev, [section]: ids }));
      apiRequest("/api/panel-changes/seen", {
        method: "POST",
        data: { section, segmento: segmentoFilter },
      })
        .then(() => queryClient.invalidateQueries({ queryKey: ["/api/panel-changes/summary"] }))
        .catch(() => {});
    },
    [visibleItems, segmentoFilter],
  );

  const markAllSeen = useCallback(() => {
    const next: Partial<Record<PanelSection, Set<string>>> = {};
    for (const s of PANEL_SECTIONS) {
      next[s] = new Set(
        visibleItems.filter((i) => i.section === s && i.entityId).map((i) => i.entityId as string),
      );
    }
    setHighlights(next);
    apiRequest("/api/panel-changes/seen", { method: "POST", data: { all: true } })
      .then(() => queryClient.invalidateQueries({ queryKey: ["/api/panel-changes/summary"] }))
      .catch(() => {});
  }, [visibleItems]);

  // Refs para que el efecto de "entrar a la pestaña" use siempre la versión
  // fresca sin re-dispararse en cada refetch del summary.
  const markSeenRef = useRef(markSeen);
  markSeenRef.current = markSeen;
  const countsRef = useRef(counts);
  countsRef.current = counts;

  const activeSection = PANEL_TAB_TO_SECTION[activeTab];
  const hasData = !!items;

  // Al entrar a una pestaña (o al cargar el panel ya parado en una) con cambios
  // pendientes: quedan destacados y se marcan vistos. Sin pendientes, se limpia
  // el destacado de la visita anterior.
  useEffect(() => {
    if (!enabled || !activeSection || !hasData) return;
    if ((countsRef.current[activeSection] ?? 0) > 0) {
      markSeenRef.current(activeSection);
    } else {
      setHighlights((prev) =>
        prev[activeSection]?.size ? { ...prev, [activeSection]: new Set<string>() } : prev,
      );
    }
  }, [enabled, activeSection, hasData]);

  const enterSection = useCallback((section: PanelSection) => {
    if ((countsRef.current[section] ?? 0) > 0) markSeenRef.current(section);
  }, []);

  return { visibleItems, counts, total: visibleItems.length, highlights, markSeen, markAllSeen, enterSection };
}

export const PanelChangesContext = createContext<PanelChangesController | null>(null);

/** Ids destacados de una sección (Set vacío si no hay contexto o nada que destacar). */
export function usePanelHighlights(section: PanelSection): Set<string> {
  const ctx = useContext(PanelChangesContext);
  return ctx?.highlights[section] ?? EMPTY_SET;
}
