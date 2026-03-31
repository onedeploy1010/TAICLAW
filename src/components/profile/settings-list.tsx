import { BarChart3, Headphones, Globe, LogOut, ChevronRight } from "lucide-react";
import { SETTINGS_ITEMS } from "@/lib/data";
import type { LucideIcon } from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  leaderboard: BarChart3,
  "contact-us": Headphones,
  "language-settings": Globe,
  "disconnect-wallet": LogOut,
};

export function SettingsList() {
  return (
    <div className="space-y-1">
      {SETTINGS_ITEMS.map((item) => {
        const Icon = iconMap[item.key] || Globe;
        return (
          <button
            key={item.key}
            className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-3 text-sm hover-elevate"
            data-testid={`button-${item.key}`}
          >
            <div className="flex items-center gap-3">
              <Icon className="h-4 w-4 text-muted-foreground" />
              <span>{item.label}</span>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        );
      })}
    </div>
  );
}
