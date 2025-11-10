import { TrendingUp, Building, Users } from "lucide-react";

export type ViewKey = "all" | "segment" | "branch" | "salesperson";

export interface ViewOption {
  value: ViewKey;
  label: string;
  icon: typeof TrendingUp;
  iconColor: string;
}

export const VIEW_OPTIONS: ViewOption[] = [
  {
    value: "all",
    label: "Todo el dashboard",
    icon: TrendingUp,
    iconColor: "text-gray-500"
  },
  {
    value: "segment",
    label: "Por segmento",
    icon: Building,
    iconColor: "text-green-500"
  },
  {
    value: "branch",
    label: "Por sucursal",
    icon: Building,
    iconColor: "text-blue-500"
  },
  {
    value: "salesperson",
    label: "Por vendedor",
    icon: Users,
    iconColor: "text-purple-500"
  }
];
