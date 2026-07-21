/**
 * Campana de cambios del Panel de Trabajo — vive en el header junto al
 * selector de Área. Muestra el total de cambios no vistos y, al abrirla,
 * la lista de cambios recientes agrupados por sección; pinchar un cambio
 * navega a su pestaña (donde queda destacado) y lo da por visto.
 */
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { Bell, Building2, CheckCheck, CheckSquare, MapPin, Palette, TrendingUp, Users } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  PANEL_SECTION_TO_TAB,
  type PanelChangesController,
  type PanelSection,
} from "@/hooks/use-panel-changes";

const SECTION_META: Record<PanelSection, { label: string; icon: typeof Bell }> = {
  tareas: { label: "Tareas", icon: CheckSquare },
  seguimiento: { label: "Seguimiento", icon: Building2 },
  estimacion: { label: "Estimación de ventas", icon: TrendingUp },
  marketing: { label: "Marketing", icon: Palette },
  crm: { label: "CRM", icon: Users },
  rutas: { label: "Rutas Comerciales", icon: MapPin },
};

interface Props {
  changes: PanelChangesController;
  onNavigate: (tabValue: string) => void;
}

export function PanelChangesBell({ changes, onNavigate }: Props) {
  const [open, setOpen] = useState(false);
  const { total, visibleItems, markAllSeen } = changes;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="relative flex items-center justify-center w-11 h-11 rounded-2xl border border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-800 shadow-sm hover:border-orange-200 hover:shadow transition-all"
          data-testid="button-panel-changes"
          aria-label={total > 0 ? `${total} cambios sin ver` : "Sin cambios nuevos"}
        >
          <Bell className={`h-[18px] w-[18px] ${total > 0 ? "text-[#fd6301]" : "text-slate-400"}`} />
          {total > 0 && (
            <span
              className="absolute -top-1.5 -right-1.5 inline-flex items-center justify-center min-w-[19px] h-[19px] px-1 rounded-full bg-[#fd6301] text-white text-[10px] font-bold shadow-sm shadow-orange-500/40"
              data-testid="badge-panel-changes-total"
            >
              {total > 99 ? "99+" : total}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[340px] p-0 rounded-2xl overflow-hidden border-slate-200/80 dark:border-slate-800 shadow-lg">
        <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-orange-50 via-white to-white dark:from-orange-950/30 dark:via-slate-900 dark:to-slate-900 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-[#fd6301]" />
            <span className="text-sm font-bold text-slate-800 dark:text-slate-100">Cambios recientes</span>
          </div>
          {total > 0 && (
            <button
              onClick={() => { markAllSeen(); setOpen(false); }}
              className="flex items-center gap-1 text-[11px] font-semibold text-orange-600 hover:text-[#e35400] transition-colors"
              data-testid="button-mark-all-seen"
            >
              <CheckCheck className="h-3.5 w-3.5" /> Marcar todo visto
            </button>
          )}
        </div>
        <div className="max-h-[320px] overflow-y-auto">
          {visibleItems.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <CheckCheck className="h-6 w-6 text-emerald-500 mx-auto mb-2" />
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Estás al día</p>
              <p className="text-xs text-slate-400">No hay cambios sin ver en el panel</p>
            </div>
          ) : (
            visibleItems.map((item) => {
              const meta = SECTION_META[item.section];
              const Icon = meta?.icon ?? Bell;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onNavigate(PANEL_SECTION_TO_TAB[item.section] ?? "tareas");
                    setOpen(false);
                  }}
                  className="w-full flex items-start gap-2.5 px-4 py-2.5 text-left hover:bg-orange-50/60 dark:hover:bg-orange-950/20 transition-colors border-b border-slate-50 dark:border-slate-800/60 last:border-b-0"
                  data-testid={`panel-change-item-${item.id}`}
                >
                  <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400 flex-shrink-0 mt-0.5">
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0 flex-1 leading-tight">
                    <span className="block text-[13px] font-medium text-slate-800 dark:text-slate-100 truncate">{item.title}</span>
                    <span className="block text-[11px] text-slate-400 mt-0.5">
                      {meta?.label ?? item.section}
                      {item.userName ? ` · ${item.userName}` : ""}
                      {item.createdAt
                        ? ` · ${formatDistanceToNow(new Date(item.createdAt), { addSuffix: true, locale: es })}`
                        : ""}
                    </span>
                  </span>
                  <span className="w-2 h-2 rounded-full bg-[#fd6301] flex-shrink-0 mt-1.5" aria-hidden />
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
