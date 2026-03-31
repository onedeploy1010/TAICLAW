import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DASHBOARD_ASSETS } from "@/lib/data";

interface AssetTabsProps {
  selected: string;
  onChange: (val: string) => void;
}

export function AssetTabs({ selected, onChange }: AssetTabsProps) {
  return (
    <Tabs value={selected} onValueChange={onChange}>
      <TabsList className="w-full bg-card border border-border">
        {DASHBOARD_ASSETS.map((asset) => (
          <TabsTrigger
            key={asset}
            value={asset}
            className="flex-1 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            data-testid={`tab-${asset}`}
          >
            {asset}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
