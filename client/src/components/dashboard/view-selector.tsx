import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TrendingUp, Target, Grid3x3, Users, Check, ChevronDown } from "lucide-react";

export type DashboardView = "all" | "goals-only" | "by-segment" | "by-salesperson";

interface ViewSelectorProps {
  value: DashboardView;
  onChange: (view: DashboardView) => void;
}

const VIEW_OPTIONS = [
  {
    value: "all" as DashboardView,
    label: "Todo el dashboard",
    icon: TrendingUp,
    color: "text-gray-700",
  },
  {
    value: "goals-only" as DashboardView,
    label: "Solo metas globales",
    icon: Target,
    color: "text-blue-600",
  },
  {
    value: "by-segment" as DashboardView,
    label: "Por segmento",
    icon: Grid3x3,
    color: "text-green-600",
  },
  {
    value: "by-salesperson" as DashboardView,
    label: "Por vendedor",
    icon: Users,
    color: "text-purple-600",
  },
];

export function ViewSelector({ value, onChange }: ViewSelectorProps) {
  const [open, setOpen] = useState(false);

  const selectedOption = VIEW_OPTIONS.find(opt => opt.value === value) || VIEW_OPTIONS[0];
  const SelectedIcon = selectedOption.icon;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="h-8 px-3 justify-start gap-2 text-xs font-medium hover:bg-gray-50"
          data-testid="button-view-selector"
        >
          <SelectedIcon className={`h-3 w-3 ${selectedOption.color}`} />
          <span>{selectedOption.label}</span>
          <ChevronDown className="h-3 w-3 ml-auto text-gray-400" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[260px] p-1.5" align="start">
        <div className="space-y-0.5">
          {VIEW_OPTIONS.map((option) => {
            const Icon = option.icon;
            const isSelected = option.value === value;
            
            return (
              <button
                key={option.value}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded text-sm hover:bg-gray-100 transition-colors ${
                  isSelected ? 'bg-gray-50' : ''
                }`}
                data-testid={`view-option-${option.value}`}
              >
                {isSelected && <Check className="h-4 w-4 text-primary shrink-0" />}
                {!isSelected && <div className="h-4 w-4 shrink-0" />}
                <Icon className={`h-4 w-4 ${option.color} shrink-0`} />
                <span className="text-gray-900 font-medium">{option.label}</span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
