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
 *  - markEntitySeen: los cambios "por ficha" (tareas y seguimientos de cliente)
 *    NO se dan por vistos al entrar a la pestaña. La tarjeta queda destacada,
 *    y contando en el badge, hasta que se abre esa ficha.
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
  // Marketing dejó de ser pestaña del panel (vive en el módulo Marketing): sus
  // cambios aterrizan en Tareas, que es donde la encargada ve sus tareas.
  marketing: "tareas",
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
  /** Se da por visto al abrir su ficha (entityId), no al entrar a la pestaña. */
  porFicha?: boolean;
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
  /** Llamar al abrir (y al cerrar) una ficha: da por vistos sus cambios. */
  markEntitySeen: (entityId: string) => void;
  /** Ids de fichas con cambios sin ver (para filtrar "con novedades"). */
  pendingEntityIds: Set<string>;
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

  // Destacado "de la visita": ids capturados al marcar vista una sección. Solo
  // cubre los cambios que se van al entrar; los por-ficha se destacan mientras
  // sigan en el summary (ver `highlights` más abajo).
  const [visitHighlights, setVisitHighlights] = useState<Partial<Record<PanelSection, Set<string>>>>({});

  // Cuántos cambios de cada sección se van al entrar a la pestaña.
  const countsAlEntrar = useMemo(() => {
    const c: Partial<Record<PanelSection, number>> = {};
    for (const it of visibleItems) if (!it.porFicha) c[it.section] = (c[it.section] ?? 0) + 1;
    return c;
  }, [visibleItems]);

  const pendingEntityIds = useMemo(
    () => new Set(visibleItems.filter((i) => i.porFicha && i.entityId).map((i) => i.entityId as string)),
    [visibleItems],
  );

  const highlights = useMemo(() => {
    const out: Partial<Record<PanelSection, Set<string>>> = { ...visitHighlights };
    for (const it of visibleItems) {
      if (!it.porFicha || !it.entityId) continue;
      const actual = out[it.section];
      // Copiar antes de sumar: el Set de la visita es estado de React.
      const set = actual && actual !== visitHighlights[it.section] ? actual : new Set(actual);
      set.add(it.entityId);
      out[it.section] = set;
    }
    return out;
  }, [visitHighlights, visibleItems]);

  const pendingEntityIdsRef = useRef(pendingEntityIds);
  pendingEntityIdsRef.current = pendingEntityIds;

  const markEntitySeen = useCallback((entityId: string) => {
    if (!entityId || !pendingEntityIdsRef.current.has(entityId)) return;
    // Se saca del summary en el momento: la tarjeta deja de destacarse al
    // abrirla, sin esperar la respuesta ni el próximo sondeo.
    queryClient.setQueryData<{ items: PanelChangeItem[] }>(["/api/panel-changes/summary"], (prev) =>
      prev ? { ...prev, items: prev.items.filter((i) => !(i.porFicha && i.entityId === entityId)) } : prev,
    );
    apiRequest("/api/panel-changes/seen", { method: "POST", data: { entityId } })
      .catch(() => {})
      .finally(() => queryClient.invalidateQueries({ queryKey: ["/api/panel-changes/summary"] }));
  }, []);

  const markSeen = useCallback(
    (section: PanelSection) => {
      // Capturar los ids a destacar ANTES de marcar visto (después desaparecen del summary).
      const ids = new Set(
        visibleItems
          .filter((i) => i.section === section && i.entityId && !i.porFicha)
          .map((i) => i.entityId as string),
      );
      setVisitHighlights((prev) => ({ ...prev, [section]: ids }));
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
      // Los por-ficha no se capturan: "marcar todo" los da por vistos de verdad
      // y dejarlos destacados contradice lo que se acaba de pedir.
      next[s] = new Set(
        visibleItems
          .filter((i) => i.section === s && i.entityId && !i.porFicha)
          .map((i) => i.entityId as string),
      );
    }
    setVisitHighlights(next);
    apiRequest("/api/panel-changes/seen", { method: "POST", data: { all: true } })
      .then(() => queryClient.invalidateQueries({ queryKey: ["/api/panel-changes/summary"] }))
      .catch(() => {});
  }, [visibleItems]);

  // Refs para que el efecto de "entrar a la pestaña" use siempre la versión
  // fresca sin re-dispararse en cada refetch del summary.
  const markSeenRef = useRef(markSeen);
  markSeenRef.current = markSeen;
  // Solo lo que se va al entrar gatilla el "visto" de la sección: con cambios
  // por-ficha pendientes el badge sigue en pie y no hay nada que marcar.
  const countsRef = useRef(countsAlEntrar);
  countsRef.current = countsAlEntrar;

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
      setVisitHighlights((prev) =>
        prev[activeSection]?.size ? { ...prev, [activeSection]: new Set<string>() } : prev,
      );
    }
  }, [enabled, activeSection, hasData]);

  const enterSection = useCallback((section: PanelSection) => {
    if ((countsRef.current[section] ?? 0) > 0) markSeenRef.current(section);
  }, []);

  return {
    visibleItems,
    counts,
    total: visibleItems.length,
    highlights,
    markSeen,
    markEntitySeen,
    pendingEntityIds,
    markAllSeen,
    enterSection,
  };
}

export const PanelChangesContext = createContext<PanelChangesController | null>(null);

/** Ids destacados de una sección (Set vacío si no hay contexto o nada que destacar). */
export function usePanelHighlights(section: PanelSection): Set<string> {
  const ctx = useContext(PanelChangesContext);
  return ctx?.highlights[section] ?? EMPTY_SET;
}
