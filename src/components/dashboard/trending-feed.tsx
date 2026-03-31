import { Badge } from "@/components/ui/badge";
import { Activity } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { CryptoPrice } from "@/hooks/use-crypto-price";
import { useTranslation } from "react-i18next";

interface TrendingFeedProps {
  prices: CryptoPrice[] | undefined;
  isLoading?: boolean;
}

export function TrendingFeed({ prices, isLoading }: TrendingFeedProps) {
  const { t } = useTranslation();

  if (isLoading || !prices) {
    return (
      <div>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Activity className="h-4 w-4 text-primary" />
          {t("dashboard.trending")}
        </h3>
        <div className="flex gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-6 w-24 rounded-full" />
          ))}
        </div>
      </div>
    );
  }

  const sorted = [...prices].sort(
    (a, b) => Math.abs(b.price_change_percentage_24h) - Math.abs(a.price_change_percentage_24h)
  );

  return (
    <div data-testid="section-trending-feed">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <Activity className="h-4 w-4 text-primary" />
        {t("dashboard.trending")}
      </h3>
      <div
        className="flex gap-2 overflow-x-auto scrollbar-hide pb-1"
        style={{ animation: "shimmerSlide 20s linear infinite" }}
      >
        {sorted.map((coin) => {
          const isGain = coin.price_change_percentage_24h >= 0;
          return (
            <Badge
              key={coin.id}
              variant="secondary"
              className={`whitespace-nowrap text-xs transition-transform duration-300 ${
                isGain
                  ? "bg-primary/10 text-neon-value"
                  : "bg-red-500/10 text-red-400"
              } no-default-hover-elevate no-default-active-elevate`}
              data-testid={`badge-trending-${coin.symbol}`}
            >
              {coin.symbol.toUpperCase()} {isGain ? "+" : ""}
              {coin.price_change_percentage_24h.toFixed(2)}%
            </Badge>
          );
        })}
      </div>
    </div>
  );
}
